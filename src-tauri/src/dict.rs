//! The language packs: a whole language on the phone, one file, looked up
//! from Rust.
//!
//! G-LANG (Osca, 11 Sep 2026, after G-DICT): *dictionaries on the phone are
//! per LANGUAGE, never per book; the phone gets the whole language; lookups
//! are answered through Rust from SQLite.* G-DICT measured the shape
//! (`TTSTV dictionary/STATUS.md` §3 E): ~15 us a lookup through SQLite's C
//! API, in a file iOS cannot evict (web storage at `frank://` is unproven,
//! and the Cache API refuses the scheme outright -- G-PULL).
//!
//! WHAT A PACK IS is TTSTV `dictionary/pack.py`'s (`PACK_SCHEMA = 1`): one
//! SQLite file per language -- every lemma of the language, `lemma`, `form`,
//! `tagset`, `fold`, `meta` -- gzipped for the journey. This file is its
//! reader, and [`resolve`] is a PORT, step for step, of `pack.py::resolve`,
//! which is itself `dictionary/lookup.py::_resolve_lemma` read through the
//! pack's tables (on the real depot: 0 differences in 8,887 words across
//! Latin, French and English -- TTSTV `dictionary/STATUS.md`, G-LANG §2).
//! Nothing here decides what a word means; it answers what the Mac's
//! dictionary answers.
//!
//! Three things it is:
//!
//!   * THE HOME. `<app data>/languages/` -- beside `books/` and `shell/`,
//!     never inside `shell/` (cleared on every update):
//!
//!     ```text
//!       languages/<code>.sqlite            the pack, installed
//!       languages/<code>.json              its catalogue row (written last: the commit)
//!       languages/.part/<code>@<hash>/     a pack being pulled
//!     ```
//!
//!   * THE DOOR THE PULL WRITES THROUGH ([`Packs`], a [`crate::pull::Door`]).
//!     A pack is ONE MORE DOWNLOAD JOB for the runner `pull.rs` already is
//!     (`kind: "language"`), not a second downloader: the same fetch, the
//!     same retries and token refresh, the same resume-by-bytes, the same
//!     `sync_status` the settings dot reads. Only the destination and the
//!     commit are this file's: the gz lands in `.part/`, is inflated beside
//!     itself, checked (a SQLite header, the listed size, `meta.schema`,
//!     `meta.code`), and swapped in with its row written LAST.
//!
//!   * THE LOOKUP. `dict_lookup(term, lang)` -> `{lang, term, entries, us}`,
//!     `dict_langs()` -> the installed rows, `dict_remove(code)`. The page
//!     reaches them as `window.TTSTVHost.dict` ([`DICT_JS`]). An open pack
//!     is kept open ([`DictState`]) and reopened when its file changes.
//!
//! What the page draws from an entry is not here: the reader has had no
//! lookup panel since 7 Sep, and the one consumer today is voice's spoken
//! answer (`reader/lookup.js`). `links` is not in a pack -- every link is a
//! template with the word filled in, so the page builds it from the word.

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;

use rusqlite::{Connection, OpenFlags, OptionalExtension};

/// The pack format this reader knows -- `dictionary/pack.py::PACK_SCHEMA`.
pub const PACK_SCHEMA: &str = "1";
/// The folder under the app's data directory, beside `books/`.
pub const LANGUAGES_DIR: &str = "languages";
pub const PACKS_PART: &str = ".part";
/// A job for the pull that carries packs, not books (`pull::Job::kind`).
pub const KIND: &str = "language";
const SQLITE_MAGIC: &[u8; 16] = b"SQLite format 3\0";

// ------------------------------------------------------------ the names

/// A language code as the Mac writes it (`la`, `grc`, `en`; a kaikki code
/// with a hyphen): lower-case ascii letters, digits and hyphens, a letter
/// first, at most 16. It is a file name here.
pub fn code_ok(code: &str) -> Result<(), String> {
    let b = code.as_bytes();
    let ok = !b.is_empty()
        && b.len() <= 16
        && b[0].is_ascii_lowercase()
        && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-');
    if ok {
        Ok(())
    } else {
        Err(format!("{code:?} is not a language code"))
    }
}

/// The one file a pack's job may carry: `<code>.sqlite.gz`.
pub fn pack_rel(code: &str) -> String {
    format!("{code}.sqlite.gz")
}

fn hash_ok(hash: &str) -> Result<(), String> {
    let ok = !hash.is_empty() && hash.len() <= 64 && hash.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c));
    if ok {
        Ok(())
    } else {
        Err(format!("{hash:?} is not a pack hash (lower-case hex)"))
    }
}

fn io_why(what: &str, path: &Path, e: std::io::Error) -> String {
    format!("frank: cannot {what} {} -- {e}", path.display())
}

pub fn pack_path(root: &Path, code: &str) -> PathBuf {
    root.join(format!("{code}.sqlite"))
}

fn row_path(root: &Path, code: &str) -> PathBuf {
    root.join(format!("{code}.json"))
}

fn part_dir(root: &Path, code: &str, hash: &str) -> PathBuf {
    root.join(PACKS_PART).join(format!("{code}@{hash}"))
}

// ------------------------------------------------------------- the pack

/// An open pack: the connection, the fold table (`pack.py::fold_table` --
/// `_normalize.norm` for every code point it changes, so Python's key is
/// reproduced with no Unicode library) and the tag sets.
pub struct Pack {
    con: Connection,
    fold: HashMap<char, String>,
    tags: HashMap<i64, Vec<String>>,
    pub lang: String,
    pub meta: HashMap<String, String>,
}

/// One `form` row: the spelling (its key when stored NULL), the lemma it
/// points at (`None`: a dead pointer, kept only for its tags), the tags.
struct FormRow {
    form: String,
    lemma: Option<i64>,
    tags: Vec<String>,
}

struct LemmaHead {
    id: i64,
    flags: i64,
    gloss: String,
}

/// What the form tier matched: `dictionary.json`'s `matched_form`.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct Matched {
    pub form: String,
    pub tags: Vec<String>,
}

fn db(e: rusqlite::Error) -> String {
    format!("the pack: {e}")
}

impl Pack {
    /// Open a pack read-only, and refuse anything that is not one this
    /// reader knows -- in words.
    pub fn open(path: &Path) -> Result<Pack, String> {
        let con = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
            .map_err(|e| format!("{}: {e}", path.display()))?;
        let mut meta = HashMap::new();
        {
            let mut st = con
                .prepare("SELECT key, value FROM meta")
                .map_err(|e| format!("{}: not a pack ({e})", path.display()))?;
            let rows = st
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?)))
                .map_err(db)?;
            for r in rows {
                let (k, v) = r.map_err(db)?;
                meta.insert(k, v.unwrap_or_default());
            }
        }
        let schema = meta.get("schema").cloned().unwrap_or_default();
        if schema != PACK_SCHEMA {
            return Err(format!(
                "{}: pack schema {schema:?}, this app reads {PACK_SCHEMA} -- update the app",
                path.display()
            ));
        }
        let mut fold = HashMap::new();
        {
            let mut st = con.prepare("SELECT cp, \"to\" FROM fold").map_err(db)?;
            let rows = st.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))).map_err(db)?;
            for r in rows {
                let (cp, to) = r.map_err(db)?;
                if let Some(c) = u32::try_from(cp).ok().and_then(char::from_u32) {
                    fold.insert(c, to);
                }
            }
        }
        let mut tags = HashMap::new();
        {
            let mut st = con.prepare("SELECT id, tags FROM tagset").map_err(db)?;
            let rows = st.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))).map_err(db)?;
            for r in rows {
                let (id, t) = r.map_err(db)?;
                tags.insert(id, serde_json::from_str::<Vec<String>>(&t).unwrap_or_default());
            }
        }
        let lang = meta.get("code").cloned().unwrap_or_default();
        Ok(Pack { con, fold, tags, lang, meta })
    }

    /// `_normalize.norm`: every code point through the table, the rest as
    /// they are. (Python NFC-normalises first; a book's words already are --
    /// `parser/segment.py` -- and so is what a keyboard types.)
    pub fn norm(&self, s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        for c in s.chars() {
            match self.fold.get(&c) {
                Some(to) => out.push_str(to),
                None => out.push(c),
            }
        }
        out
    }

    fn forms(&self, n: &str) -> Result<Vec<FormRow>, String> {
        let mut st = self
            .con
            .prepare_cached("SELECT form, lemma, tags FROM form WHERE norm = ?1 ORDER BY ord")
            .map_err(db)?;
        let rows = st
            .query_map([n], |r| Ok((r.get::<_, Option<String>>(0)?, r.get::<_, Option<i64>>(1)?, r.get::<_, i64>(2)?)))
            .map_err(db)?;
        let mut out = Vec::new();
        for r in rows {
            let (form, lemma, t) = r.map_err(db)?;
            out.push(FormRow {
                form: form.unwrap_or_else(|| n.to_string()),
                lemma,
                tags: self.tags.get(&t).cloned().unwrap_or_default(),
            });
        }
        Ok(out)
    }

    /// `(word, norm)` of a lemma.
    fn lemma_word(&self, id: i64) -> Result<(String, String), String> {
        let mut st = self.con.prepare_cached("SELECT word, norm FROM lemma WHERE id = ?1").map_err(db)?;
        st.query_row([id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map_err(db)
    }

    fn lemmas_by_norm(&self, n: &str) -> Result<Vec<LemmaHead>, String> {
        let mut st = self
            .con
            .prepare_cached("SELECT id, flags, gloss FROM lemma WHERE norm = ?1 ORDER BY id")
            .map_err(db)?;
        let rows = st
            .query_map([n], |r| Ok(LemmaHead { id: r.get(0)?, flags: r.get(1)?, gloss: r.get(2)? }))
            .map_err(db)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(db)?);
        }
        Ok(out)
    }

    /// A lemma's entry -- `dictionary.json`'s shape, less `links` (the
    /// page's) and `matched_form` (the caller's).
    fn entry_of(&self, id: i64) -> Result<Option<serde_json::Value>, String> {
        let mut st = self
            .con
            .prepare_cached("SELECT word, pos, gloss, etym, related, phon FROM lemma WHERE id = ?1")
            .map_err(db)?;
        let row = st
            .query_row([id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, Option<String>>(5)?,
                ))
            })
            .optional()
            .map_err(db)?;
        Ok(row.map(|(word, pos, gloss, etym, related, phon)| {
            serde_json::json!({
                "lemma": word,
                "pos": pos,
                "gloss": serde_json::from_str::<serde_json::Value>(&gloss).unwrap_or_else(|_| serde_json::json!([])),
                "phon": phon,
                "etymology": etym,
                "related": serde_json::from_str::<serde_json::Value>(&related).unwrap_or_else(|_| serde_json::json!([])),
            })
        }))
    }
}

// ------------------------------------------------------------ the lookup
// `pack.py::resolve` -- which is `lookup.py::_resolve_lemma` -- step for step.

const XREF: [&str; 2] = ["form-of", "alt-of"];
const HYPHENS: [char; 3] = ['-', '\u{2010}', '\u{2011}'];

fn lower_first(w: &str) -> bool {
    w.chars().next().map_or(false, char::is_lowercase)
}

fn upper_first(w: &str) -> bool {
    w.chars().next().map_or(false, char::is_uppercase)
}

/// Typographic apostrophes -> the straight one the dictionary is keyed by
/// (`lookup.py::_APOSTROPHES`).
pub fn fold_apostrophes(s: &str) -> String {
    s.chars()
        .map(|c| if matches!(c, '\u{2019}' | '\u{2018}' | '\u{02bc}') { '\'' } else { c })
        .collect()
}

fn is_word(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Python's `(?<!\w)target(?!\w)`, searched in `hay`.
fn has_word(hay: &str, target: &str) -> bool {
    if target.is_empty() {
        return false;
    }
    for (i, _) in hay.match_indices(target) {
        let before = hay[..i].chars().next_back();
        let after = hay[i + target.len()..].chars().next();
        if !before.map_or(false, is_word) && !after.map_or(false, is_word) {
            return true;
        }
    }
    false
}

fn chars(s: &str) -> usize {
    s.chars().count()
}

fn take(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

fn own_headword(p: &Pack, n: &str, w: &str) -> Result<Option<i64>, String> {
    for l in p.lemmas_by_norm(n)? {
        if l.flags & 1 != 0 || (l.flags & 2 != 0 && !lower_first(w)) {
            return Ok(Some(l.id));
        }
    }
    Ok(None)
}

fn own_glossed(p: &Pack, n: &str, w: &str) -> Result<(Option<i64>, Vec<String>), String> {
    let (mut lemma, mut glosses) = (None, Vec::new());
    for l in p.lemmas_by_norm(n)? {
        if l.flags & 4 != 0 && lower_first(w) {
            continue;
        }
        let gs: Vec<String> = serde_json::from_str(&l.gloss).unwrap_or_default();
        if !gs.is_empty() {
            if lemma.is_none() {
                lemma = Some(l.id);
            }
            glosses.extend(gs);
        }
    }
    Ok((lemma, glosses))
}

fn points_at(p: &Pack, glosses: &[String], word: &str) -> bool {
    let target = p.norm(word);
    !target.is_empty() && !glosses.is_empty() && glosses.iter().all(|g| has_word(&p.norm(g), &target))
}

/// A lemma id and the form it was matched by.
pub type Hit = Option<(i64, Option<Matched>)>;

fn form_row_or_own(p: &Pack, rows: &[&FormRow], n: &str, w: &str) -> Result<Hit, String> {
    for r in rows {
        let Some(lemma) = r.lemma else { continue };
        let (word, lnorm) = p.lemma_word(lemma)?;
        if lnorm != n {
            if let Some(own) = own_headword(p, n, w)? {
                return Ok(Some((own, None)));
            }
            let declares = rows.iter().any(|x| x.tags.iter().any(|t| XREF.contains(&t.as_str())));
            if !declares {
                let (own, glosses) = own_glossed(p, n, w)?;
                if let Some(own) = own {
                    if !points_at(p, &glosses, &word) {
                        return Ok(Some((own, None)));
                    }
                }
            }
        }
        return Ok(Some((lemma, Some(Matched { form: r.form.clone(), tags: r.tags.clone() }))));
    }
    Ok(None)
}

fn core(p: &Pack, w: &str, n: &str) -> Result<Hit, String> {
    let rows = p.forms(n)?;
    let exact: Vec<&FormRow> = rows.iter().filter(|r| r.form == w).collect();
    if let Some(hit) = form_row_or_own(p, &exact, n, w)? {
        return Ok(Some(hit));
    }
    let all: Vec<&FormRow> = rows.iter().collect();
    if let Some(hit) = form_row_or_own(p, &all, n, w)? {
        return Ok(Some(hit));
    }
    Ok(p.lemmas_by_norm(n)?.first().map(|l| (l.id, None)))
}

fn core_id(p: &Pack, w: &str) -> Result<Option<i64>, String> {
    Ok(core(p, w, &p.norm(w))?.map(|(i, _)| i))
}

/// The lemma `word` resolves to and the form it matched, or `None`: the
/// three direct tiers, then V for U, a Latin enclitic, an English
/// apostrophe suffix, a hyphen closed up -- each only after every earlier
/// one missed.
pub fn resolve(p: &Pack, word: &str) -> Result<Hit, String> {
    let w = fold_apostrophes(word);
    if let Some(hit) = core(p, &w, &p.norm(&w))? {
        return Ok(Some(hit));
    }
    let low = w.to_lowercase();
    if low.contains('v') {
        let vu = w.replace('V', "U").replace('v', "u");
        if vu != w {
            if let Some(hit) = core(p, &vu, &p.norm(&vu))? {
                return Ok(Some(hit));
            }
        }
    }
    for suf in ["que", "ve"] {
        if low.ends_with(suf) && chars(&w) >= chars(suf) + 3 {
            let stem = take(&w, chars(&w) - chars(suf));
            if let Some(i) = core_id(p, &stem)? {
                return Ok(Some((i, Some(Matched { form: stem, tags: vec![format!("enclitic-{suf}")] }))));
            }
            break;
        }
    }
    if p.lang == "en" {
        for (suf, tag) in [("'st", "archaic-2sg"), ("'s", "possessive"), ("'d", "elided-ed")] {
            if low.ends_with(suf) && chars(&w) >= chars(suf) + 2 {
                let stem = take(&w, chars(&w) - chars(suf));
                let stems = if suf == "'d" { vec![stem.clone(), format!("{stem}ed")] } else { vec![stem] };
                for s in stems {
                    if let Some(i) = core_id(p, &s)? {
                        return Ok(Some((i, Some(Matched { form: s, tags: vec!["derived".into(), tag.into()] }))));
                    }
                }
                break;
            }
        }
    }
    if w.trim_matches(&HYPHENS[..]).contains(&HYPHENS[..]) {
        let joined: String = w.chars().filter(|c| !HYPHENS.contains(c)).collect();
        if !joined.is_empty() {
            if let Some(i) = core_id(p, &joined)? {
                let (lemma, _) = p.lemma_word(i)?;
                if !(upper_first(&lemma) && !upper_first(&joined)) {
                    return Ok(Some((i, Some(Matched { form: joined, tags: vec!["derived".into(), "hyphen-joined".into()] }))));
                }
            }
        }
    }
    Ok(None)
}

/// The phone's answer for `word`: `dictionary.json`'s entry without
/// `links`, or `None` -- `pack.py::entry`.
pub fn entry(p: &Pack, word: &str) -> Result<Option<serde_json::Value>, String> {
    let Some((id, matched)) = resolve(p, word)? else { return Ok(None) };
    let Some(mut e) = p.entry_of(id)? else { return Ok(None) };
    e["matched_form"] = serde_json::to_value(matched).unwrap_or(serde_json::Value::Null);
    Ok(Some(e))
}

// ------------------------------------------------------ the installed packs

/// The packs on this phone -- each `<code>.json` whose pack is there, as
/// written at its commit -- with `installed_bytes`, the file's size here.
pub fn installed(root: &Path) -> Vec<serde_json::Value> {
    let Ok(dir) = fs::read_dir(root) else { return Vec::new() };
    let mut out = Vec::new();
    for e in dir.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let Some(code) = name.strip_suffix(".json") else { continue };
        if code_ok(code).is_err() {
            continue;
        }
        let Ok(meta) = fs::metadata(pack_path(root, code)) else { continue };
        let Some(mut row) = fs::read_to_string(e.path()).ok().and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        else {
            continue;
        };
        if !row.is_object() {
            continue;
        }
        row["code"] = serde_json::Value::String(code.to_string());
        row["installed_bytes"] = serde_json::Value::from(meta.len());
        out.push(row);
    }
    out.sort_by(|a, b| a["code"].as_str().cmp(&b["code"].as_str()));
    out
}

fn installed_hash(root: &Path, code: &str) -> Option<String> {
    code_ok(code).ok()?;
    if !pack_path(root, code).is_file() {
        return None;
    }
    let t = fs::read_to_string(row_path(root, code)).ok()?;
    let v: serde_json::Value = serde_json::from_str(&t).ok()?;
    v.get("hash").and_then(|h| h.as_str()).map(str::to_string)
}

/// A pack off this phone: its file, its row, any half-pulled version.
/// Answers how many things went.
pub fn remove(root: &Path, code: &str) -> Result<u32, String> {
    code_ok(code)?;
    let mut n = 0;
    for p in [pack_path(root, code), row_path(root, code)] {
        if p.exists() {
            fs::remove_file(&p).map_err(|e| io_why("remove", &p, e))?;
            n += 1;
        }
    }
    let prefix = format!("{code}@");
    if let Ok(dir) = fs::read_dir(root.join(PACKS_PART)) {
        for e in dir.flatten() {
            if e.file_name().to_string_lossy().starts_with(&prefix) {
                fs::remove_dir_all(e.path()).map_err(|er| io_why("remove", &e.path(), er))?;
                n += 1;
            }
        }
    }
    Ok(n)
}

// ------------------------------------------------ the door the pull uses

/// The pull's destination for a `kind: "language"` job ([`crate::pull::Door`]):
/// the job's "slug" is the language code, its "hash" the pack's, its one
/// file `<code>.sqlite.gz`.
pub struct Packs {
    pub root: PathBuf,
}

impl Packs {
    fn dest(&self, code: &str, hash: &str, rel: &str) -> Result<PathBuf, String> {
        code_ok(code)?;
        hash_ok(hash)?;
        if rel != pack_rel(code) {
            return Err(format!("{rel:?} is not {code}'s pack ({})", pack_rel(code)));
        }
        let dir = part_dir(&self.root, code, hash);
        fs::create_dir_all(&dir).map_err(|e| io_why("create", &dir, e))?;
        Ok(dir.join(rel))
    }
}

/// Inflate `gz` -- every member: `pack.py` writes one per 64 MiB -- into
/// `out`. Answers the inflated byte count.
pub fn inflate(gz: &Path, out: &Path) -> Result<u64, String> {
    let src = fs::File::open(gz).map_err(|e| io_why("open", gz, e))?;
    let mut dec = flate2::read::MultiGzDecoder::new(std::io::BufReader::with_capacity(1 << 20, src));
    let mut dst = fs::File::create(out).map_err(|e| io_why("write", out, e))?;
    std::io::copy(&mut dec, &mut dst).map_err(|e| format!("{}: not a whole gzip ({e})", gz.display()))
}

impl crate::pull::Door for Packs {
    fn installed(&self, code: &str) -> Option<String> {
        installed_hash(&self.root, code)
    }

    fn have(&self, code: &str, hash: &str, rel: &str) -> Option<u64> {
        code_ok(code).ok()?;
        hash_ok(hash).ok()?;
        if rel != pack_rel(code) {
            return None;
        }
        fs::metadata(part_dir(&self.root, code, hash).join(rel)).ok().filter(|m| m.is_file()).map(|m| m.len())
    }

    fn write_from(&self, code: &str, hash: &str, rel: &str, src: &mut dyn Read) -> Result<u64, String> {
        let dst = self.dest(code, hash, rel)?;
        let mut out = fs::File::create(&dst).map_err(|e| io_why("write", &dst, e))?;
        std::io::copy(src, &mut out).map_err(|e| format!("{rel}: {e}"))
    }

    /// THE COMMIT: inflate beside the gz, prove it is this language's pack
    /// at the listed size, then swap the pack in and write its row LAST. A
    /// lookup holding the old file keeps reading it until it sees the
    /// change ([`DictState`]); a rename never tears a file in half.
    fn commit(&self, code: &str, hash: &str, meta_json: &str) -> Result<Vec<String>, String> {
        code_ok(code)?;
        hash_ok(hash)?;
        let part = part_dir(&self.root, code, hash);
        let gz = part.join(pack_rel(code));
        if !gz.is_file() {
            return Err(format!("nothing was pulled for {code}@{hash} -- a pack's row comes after its file"));
        }
        let raw = part.join(format!("{code}.sqlite"));
        let n = inflate(&gz, &raw)?;
        let row: serde_json::Value =
            serde_json::from_str(meta_json).map_err(|e| format!("{code}: the row is not JSON ({e})"))?;
        if let Some(want) = row.get("bytes").and_then(|b| b.as_u64()) {
            if want != n {
                return Err(format!("{code}: {n} bytes inflated, {want} were listed"));
            }
        }
        let mut head = [0u8; 16];
        fs::File::open(&raw)
            .and_then(|mut f| f.read_exact(&mut head))
            .map_err(|e| io_why("read", &raw, e))?;
        if &head != SQLITE_MAGIC {
            return Err(format!("{code}: the file is not SQLite"));
        }
        let p = Pack::open(&raw)?;
        if p.lang != code {
            return Err(format!("{code}: the file is the {:?} pack", p.lang));
        }
        drop(p);
        let old = installed_hash(&self.root, code);
        let meta = part.join(format!("{code}.json"));
        fs::write(&meta, meta_json).map_err(|e| io_why("write", &meta, e))?;
        let live = pack_path(&self.root, code);
        fs::rename(&raw, &live).map_err(|e| io_why("install", &raw, e))?;
        fs::rename(&meta, row_path(&self.root, code)).map_err(|e| io_why("install", &meta, e))?;
        let _ = fs::remove_dir_all(&part);
        Ok(old.filter(|h| h != hash).map(|h| vec![format!("{code}@{h}")]).unwrap_or_default())
    }
}

// ---------------------------------------------------- the open packs

/// The packs a lookup has opened, kept open, and reopened when the file on
/// disk is no longer the one that was opened (a newer pack swapped in).
#[derive(Default)]
pub struct DictState {
    open: Mutex<HashMap<String, (Stamp, Pack)>>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct Stamp(u64, Option<std::time::SystemTime>);

fn stamp(p: &Path) -> Option<Stamp> {
    fs::metadata(p).ok().map(|m| Stamp(m.len(), m.modified().ok()))
}

impl DictState {
    /// `dict_lookup`'s body: `{lang, term, entries, us}` -- `entries` empty
    /// for a word the pack does not have; an `Err` is a sentence (no pack
    /// for that language on this phone, a pack this app cannot read).
    pub fn lookup(&self, root: &Path, lang: &str, term: &str) -> Result<serde_json::Value, String> {
        code_ok(lang)?;
        let t0 = Instant::now();
        let path = pack_path(root, lang);
        let Some(now) = stamp(&path) else {
            self.forget(lang);
            return Err(format!("no {lang} dictionary on this phone -- Settings > Languages"));
        };
        let mut open = self.open.lock().map_err(|_| "frank: the dictionary lock is poisoned".to_string())?;
        if open.get(lang).map_or(true, |(s, _)| *s != now) {
            let pack = Pack::open(&path)?;
            open.insert(lang.to_string(), (now, pack));
        }
        let (_, pack) = open.get(lang).expect("just opened");
        let entries: Vec<serde_json::Value> = entry(pack, term)?.into_iter().collect();
        Ok(serde_json::json!({
            "lang": lang, "term": term, "entries": entries, "us": t0.elapsed().as_micros() as u64
        }))
    }

    pub fn forget(&self, lang: &str) {
        if let Ok(mut open) = self.open.lock() {
            open.remove(lang);
        }
    }
}

// ------------------------------------------------------------ the commands

pub fn languages_root<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    use tauri::Manager;
    app.path().app_data_dir().expect("no app data dir").join(LANGUAGES_DIR)
}

/// `TTSTVHost.dict.langs()`: the packs on this phone.
#[tauri::command]
pub fn dict_langs<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Vec<serde_json::Value> {
    installed(&languages_root(&app))
}

/// `TTSTVHost.dict.lookup(term, lang)`.
#[tauri::command]
pub fn dict_lookup<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: tauri::State<'_, DictState>,
    term: String,
    lang: String,
) -> Result<serde_json::Value, String> {
    state.lookup(&languages_root(&app), &lang, &term)
}

/// `TTSTVHost.dict.remove(code)`: the pack off this phone.
#[tauri::command]
pub fn dict_remove<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: tauri::State<'_, DictState>,
    code: String,
) -> Result<u32, String> {
    state.forget(&code);
    let n = remove(&languages_root(&app), &code)?;
    log::info!("frank: dict_remove {code} -- {n} gone");
    Ok(n)
}

/// `window.TTSTVHost.dict`, the pack door: the three commands and nothing
/// else. Its own init script, guarded like the book door -- a page outside
/// Frank gets no `dict`, and `reader/lookup.js` keeps reading the book's own
/// `dictionary.json` there, as the Mac's reader always has. Adding a pack is
/// not here: it is a download, so it is a job for the pull
/// (`TTSTVHost.sync.start({kind: "language", ...})`, TTSTV `library/langs.js`).
pub const DICT_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  window.TTSTVHost.dict = {
    // langs() -> Promise<row[]>: the packs on this phone, each its catalogue row + installed_bytes
    langs: function () { return TAURI.invoke("dict_langs"); },
    // lookup(term, lang) -> Promise<{lang, term, entries: [entry], us}>; rejects in words with no pack
    lookup: function (term, lang) { return TAURI.invoke("dict_lookup", { term: String(term), lang: String(lang) }); },
    // remove(code) -> Promise<number>
    remove: function (code) { return TAURI.invoke("dict_remove", { code: String(code) }); }
  };
})();
"#;

#[cfg(test)]
pub(crate) mod dict_tests {
    use super::*;
    use crate::pull::Door;

    /// A directory no other call gets. The pid and the millisecond are NOT
    /// enough: two calls in one test land in the same millisecond on a fast
    /// machine, the second `fixture` opens the first one's pack and dies on
    /// `table meta already exists` (Osca's Mac, 11 Sep -- green in the slower
    /// container, red on an M-series). The counter is what makes it unique.
    pub(crate) fn scratch(name: &str) -> PathBuf {
        static NTH: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let nth = NTH.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let d = std::env::temp_dir().join(format!(
            "frank-dict-{name}-{}-{}-{nth}", std::process::id(), crate::pull::now_ms()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    /// A pack as `dictionary/pack.py` writes one, in miniature: its schema
    /// verbatim, the fold rows these words need (the real table has 3,977),
    /// Latin with a macron, an enclitic and a river; English with a
    /// contraction and a borrowing that keeps its apostrophe.
    pub(crate) fn fixture(dir: &Path, code: &str) -> PathBuf {
        let path = pack_path(dir, code);
        let con = Connection::open(&path).unwrap();
        con.execute_batch(
            r#"
            CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
            CREATE TABLE fold (cp INTEGER PRIMARY KEY, "to" TEXT NOT NULL);
            CREATE TABLE lemma (id INTEGER PRIMARY KEY, word TEXT NOT NULL, norm TEXT NOT NULL, pos TEXT,
                                flags INTEGER NOT NULL, gloss TEXT NOT NULL, etym TEXT NOT NULL,
                                related TEXT NOT NULL, phon TEXT);
            CREATE TABLE tagset (id INTEGER PRIMARY KEY, tags TEXT NOT NULL UNIQUE);
            CREATE TABLE form (norm TEXT NOT NULL, ord INTEGER NOT NULL, form TEXT, lemma INTEGER,
                               tags INTEGER NOT NULL, PRIMARY KEY (norm, ord)) WITHOUT ROWID;
            CREATE INDEX lemma_norm ON lemma (norm);
            INSERT INTO fold VALUES (65,'a'),(67,'c'),(68,'d'),(70,'f'),(73,'i'),(76,'l'),(77,'m'),(79,'o'),(83,'s'),
                                    (84,'t'),(85,'u'),(86,'v'),(257,'a'),(333,'o'),(299,'i'),(332,'o'),(363,'u'),
                                    (771,''),(772,''),(769,''),(962,'σ'),(223,'ss');
            INSERT INTO tagset VALUES (1,'[]'),(2,'["canonical"]'),(3,'["imperfect","plural"]'),(4,'["form-of"]'),
                                      (5,'["genitive","singular"]');
            "#,
        )
        .unwrap();
        con.execute_batch(&format!("INSERT INTO meta VALUES ('code','{code}'),('schema','1'),('name','X');")).unwrap();
        if code == "la" {
            con.execute_batch(
                r#"
                INSERT INTO lemma VALUES (1,'voco','voco','verb',1,'["to call","a second sense"]','From vox.','["vocatio","vox"]','/ˈwo.koː/');
                INSERT INTO lemma VALUES (2,'vocabant','vocabant','verb',0,'["third-person plural imperfect of vocō"]','','[]',NULL);
                INSERT INTO lemma VALUES (3,'fagus','fagus','noun',1,'["beech"]','','[]',NULL);
                INSERT INTO lemma VALUES (4,'custos','custos','noun',1,'["guard"]','','[]',NULL);
                INSERT INTO lemma VALUES (5,'Minio','minio','name',6,'["a river of Etruria"]','','[]',NULL);
                INSERT INTO lemma VALUES (6,'minium','minium','noun',1,'["cinnabar"]','','[]',NULL);
                INSERT INTO form VALUES ('voco',10,'vocō',1,2),('vocabant',11,'vocābant',1,3),('vocabant',30,NULL,1,4),
                                        ('fagi',12,'fāgī',3,5),('minio',13,'miniō',6,1);
                "#,
            )
            .unwrap();
        } else {
            con.execute_batch(
                r#"
                INSERT INTO lemma VALUES (1,'father','father','noun',1,'["a male parent"]','','[]',NULL);
                INSERT INTO lemma VALUES (2,'over','over','prep',1,'["above"]','','[]',NULL);
                INSERT INTO lemma VALUES (3,'o''er','o''er','prep',0,'["Contraction of over"]','','[]',NULL);
                INSERT INTO lemma VALUES (4,'l''amour','l''amour','noun',1,'["love (a borrowing)"]','','[]',NULL);
                INSERT INTO form VALUES ('o''er',1,NULL,2,4);
                "#,
            )
            .unwrap();
        }
        path
    }

    fn lemma(p: &Pack, w: &str) -> Option<String> {
        entry(p, w).unwrap().map(|e| e["lemma"].as_str().unwrap().to_string())
    }

    #[test]
    fn a_hit_answers_dictionary_json_s_entry_without_links() {
        let d = scratch("hit");
        let p = Pack::open(&fixture(&d, "la")).unwrap();
        let e = entry(&p, "vocābant").unwrap().expect("a hit");
        assert_eq!(e["lemma"], "voco");
        assert_eq!(e["gloss"], serde_json::json!(["to call", "a second sense"]));
        assert_eq!(e["related"], serde_json::json!(["vocatio", "vox"]));
        assert_eq!(
            (e["pos"].as_str(), e["phon"].as_str(), e["etymology"].as_str()),
            (Some("verb"), Some("/ˈwo.koː/"), Some("From vox."))
        );
        assert_eq!(e["matched_form"], serde_json::json!({"form": "vocābant", "tags": ["imperfect", "plural"]}));
        assert!(e.get("links").is_none(), "the page builds links from the word");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_miss_is_empty_and_an_absent_pack_is_a_sentence() {
        let d = scratch("miss");
        let p = Pack::open(&fixture(&d, "la")).unwrap();
        assert_eq!(entry(&p, "qwertyuiop").unwrap(), None);
        assert_eq!(entry(&p, "").unwrap(), None);
        let st = DictState::default();
        let r = st.lookup(&d, "la", "zzzz").unwrap();
        assert_eq!((r["entries"].clone(), r["lang"].as_str(), r["term"].as_str()), (serde_json::json!([]), Some("la"), Some("zzzz")));
        let err = st.lookup(&d, "grc", "λόγος").unwrap_err();
        assert!(err.contains("no grc dictionary on this phone"), "{err}");
        assert!(st.lookup(&d, "../la", "x").unwrap_err().contains("not a language code"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn latin_is_accent_and_case_insensitive_and_takes_its_enclitics_and_v_for_u() {
        let d = scratch("latin");
        let p = Pack::open(&fixture(&d, "la")).unwrap();
        for w in ["voco", "vocō", "Voco", "VOCO", "VOCŌ"] {
            assert_eq!(lemma(&p, w).as_deref(), Some("voco"), "{w}");
        }
        assert_eq!(lemma(&p, "fagi").as_deref(), Some("fagus"), "the accent-insensitive form tier");
        assert_eq!(lemma(&p, "fāgī").as_deref(), Some("fagus"));
        let e = entry(&p, "fagusque").unwrap().unwrap();
        assert_eq!(
            (e["lemma"].as_str(), &e["matched_form"]),
            (Some("fagus"), &serde_json::json!({"form": "fagus", "tags": ["enclitic-que"]}))
        );
        assert_eq!(lemma(&p, "CVSTOS").as_deref(), Some("custos"), "V written for U");
        // lower case is not the river: minio -> minium's ablative
        assert_eq!(lemma(&p, "minio").as_deref(), Some("minium"));
        assert_eq!(lemma(&p, "Minio").as_deref(), Some("Minio"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_term_with_an_apostrophe_is_folded_and_an_english_suffix_is_its_stem() {
        let d = scratch("apos");
        let p = Pack::open(&fixture(&d, "en")).unwrap();
        assert_eq!(lemma(&p, "o'er").as_deref(), Some("over"), "o'er is only ever over");
        assert_eq!(lemma(&p, "o\u{2019}er").as_deref(), Some("over"), "the typographic apostrophe");
        assert_eq!(lemma(&p, "l\u{2019}amour").as_deref(), Some("l'amour"));
        let e = entry(&p, "father\u{2019}s").unwrap().unwrap();
        assert_eq!(
            (e["lemma"].as_str(), &e["matched_form"]),
            (Some("father"), &serde_json::json!({"form": "father", "tags": ["derived", "possessive"]}))
        );
        assert_eq!(fold_apostrophes("\u{2018}Tis \u{02bc}x"), "'Tis 'x");
        assert!(has_word("contraction of over", "over") && !has_word("overture", "over") && !has_word("", "over"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn a_pack_this_app_cannot_read_is_refused_in_words() {
        let d = scratch("schema");
        let path = fixture(&d, "la");
        Connection::open(&path).unwrap().execute_batch("UPDATE meta SET value='2' WHERE key='schema'").unwrap();
        let err = Pack::open(&path).err().unwrap();
        assert!(err.contains("pack schema \"2\"") && err.contains("update the app"), "{err}");
        fs::write(d.join("junk.sqlite"), b"not a database at all, not even close......").unwrap();
        assert!(Pack::open(&d.join("junk.sqlite")).is_err());
        let _ = fs::remove_dir_all(&d);
    }

    pub(crate) fn gz(bytes: &[u8]) -> Vec<u8> {
        use std::io::Write;
        let mut e = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        e.write_all(bytes).unwrap();
        e.finish().unwrap()
    }

    #[test]
    fn the_door_takes_a_gz_inflates_it_checks_it_and_writes_the_row_last() {
        let d = scratch("door");
        let src = scratch("door-src");
        let raw = fs::read(fixture(&src, "la")).unwrap();
        // two members, as pack.py writes them (one per 64 MiB)
        let mut body = gz(&raw[..raw.len() / 2]);
        body.extend(gz(&raw[raw.len() / 2..]));
        let door = Packs { root: d.clone() };
        assert_eq!(door.installed("la"), None);
        assert_eq!(door.write_from("la", "abcd", "la.sqlite.gz", &mut &body[..]).unwrap(), body.len() as u64);
        assert_eq!(door.have("la", "abcd", "la.sqlite.gz"), Some(body.len() as u64));
        assert!(installed(&d).is_empty(), "nothing on the shelf before the commit");
        let row = format!(r#"{{"code":"la","hash":"abcd","name":"Latin","bytes":{}}}"#, raw.len());
        assert_eq!(door.commit("la", "abcd", &row).unwrap(), Vec::<String>::new());
        assert_eq!(fs::read(pack_path(&d, "la")).unwrap(), raw);
        assert_eq!(door.installed("la").as_deref(), Some("abcd"));
        let rows = installed(&d);
        assert_eq!(
            (rows.len(), rows[0]["name"].as_str(), rows[0]["installed_bytes"].as_u64()),
            (1, Some("Latin"), Some(raw.len() as u64))
        );
        assert!(!part_dir(&d, "la", "abcd").exists(), "the .part folder went with the commit");
        // a newer pack replaces it and names the one it replaced; the open pack notices
        let st = DictState::default();
        assert_eq!(st.lookup(&d, "la", "voco").unwrap()["entries"][0]["lemma"], "voco");
        door.write_from("la", "beef", "la.sqlite.gz", &mut &gz(&raw)[..]).unwrap();
        let row2 = format!(r#"{{"code":"la","hash":"beef","bytes":{}}}"#, raw.len());
        std::thread::sleep(std::time::Duration::from_millis(20));
        assert_eq!(door.commit("la", "beef", &row2).unwrap(), vec!["la@abcd".to_string()]);
        assert_eq!(st.lookup(&d, "la", "fagi").unwrap()["entries"][0]["lemma"], "fagus");
        // remove: the file and its row, and the lookup says so
        assert_eq!(remove(&d, "la").unwrap(), 2);
        assert!(st.lookup(&d, "la", "voco").is_err() && installed(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
        let _ = fs::remove_dir_all(&src);
    }

    #[test]
    fn the_door_refuses_a_wrong_name_a_short_file_or_another_language_and_installs_nothing() {
        let d = scratch("refuse");
        let src = scratch("refuse-src");
        let raw = fs::read(fixture(&src, "la")).unwrap();
        let door = Packs { root: d.clone() };
        for (code, hash, rel) in [
            ("la", "abcd", "la.sqlite"),
            ("la", "abcd", "../la.sqlite.gz"),
            ("La", "abcd", "La.sqlite.gz"),
            ("la", "XYZ", "la.sqlite.gz"),
            ("la", "abcd", "en.sqlite.gz"),
        ] {
            assert!(door.write_from(code, hash, rel, &mut &b"x"[..]).is_err(), "{code} {hash} {rel}");
        }
        // listed at another size
        door.write_from("la", "abcd", "la.sqlite.gz", &mut &gz(&raw)[..]).unwrap();
        let err = door.commit("la", "abcd", &format!(r#"{{"bytes":{}}}"#, raw.len() + 1)).unwrap_err();
        assert!(err.contains("bytes inflated"), "{err}");
        // not gzip at all
        door.write_from("la", "cafe", "la.sqlite.gz", &mut &raw[..]).unwrap();
        assert!(door.commit("la", "cafe", "{}").unwrap_err().contains("not a whole gzip"));
        // the English pack under Latin's name
        let en = fs::read(fixture(&src, "en")).unwrap();
        door.write_from("la", "f00d", "la.sqlite.gz", &mut &gz(&en)[..]).unwrap();
        assert!(door.commit("la", "f00d", "{}").unwrap_err().contains("is the \"en\" pack"));
        // a commit with nothing pulled
        assert!(door.commit("la", "0123", "{}").unwrap_err().contains("nothing was pulled"));
        assert!(!pack_path(&d, "la").exists() && installed(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
        let _ = fs::remove_dir_all(&src);
    }

    /// The wiring: three commands, declared (build.rs), granted (the
    /// capability), handled (`generate_handler!`), one door that calls them,
    /// injected with the others; the state managed.
    #[test]
    fn the_pack_door_is_three_commands_and_nothing_else() {
        let js = DICT_JS;
        assert_eq!(js.matches("invoke(").count(), 3);
        assert!(js.contains(r#"TAURI.invoke("dict_langs")"#));
        assert!(js.contains(r#"TAURI.invoke("dict_lookup", { term: String(term), lang: String(lang) })"#));
        assert!(js.contains(r#"TAURI.invoke("dict_remove", { code: String(code) })"#));
        assert!(js.contains("if (!TAURI"), "a page outside Frank gets no door");
        let build = include_str!("../build.rs");
        let cap = include_str!("../capabilities/default.json");
        let lib = include_str!("lib.rs");
        let run_fn = &lib[lib.find("pub fn run() {").unwrap()..lib.find("fn flush_google<").unwrap()];
        for (cmd, perm) in [("dict_langs", "allow-dict-langs"), ("dict_lookup", "allow-dict-lookup"), ("dict_remove", "allow-dict-remove")] {
            assert!(build.contains(&format!("\"{cmd}\"")), "build.rs declares {cmd}");
            assert!(cap.contains(&format!("\"{perm}\"")), "the capability grants {perm}");
            assert!(run_fn.contains(&format!("dict::{cmd}")), "handled: {cmd}");
        }
        assert!(run_fn.contains(".initialization_script(dict::DICT_JS)"));
        assert!(run_fn.contains(".manage(dict::DictState::default())"));
    }
}
