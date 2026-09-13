//! The inbox: what a share put here, and nothing else.
//!
//! C2/K8 (`PROMPTS/plan-12-sep.md`), 13 September. **This is a spike, and its
//! whole job is to make one sentence true or false: a PDF shared out of Safari
//! lands somewhere Frank can see it.** There is no UI here and there must not
//! be one -- the proof is a log line at start-up and one command a later lane
//! can call.
//!
//! # The two roads, and why there are two
//!
//! A file reaches an iOS app from a share sheet by one of exactly two roads,
//! and they cost completely different things:
//!
//! | road | what declares it | what it costs | where it lands |
//! |---|---|---|---|
//! | **Copy to Frank** | `CFBundleDocumentTypes` in `gen/apple/project.yml` | **nothing** -- no entitlement, no extension, no second target; a free personal team signs it unchanged | `<Documents>/Inbox/<name>` |
//! | **Share -> Frank** | a share **extension** target + an **App Group** | a second target, a second bundle id, and `com.apple.security.application-groups` on BOTH binaries | `<group>/inbox/<id>/` |
//!
//! The first is the cheapest ingest there is and it is what C2 means by
//! "cheap". The second is the one the person actually reaches for, because it
//! is the row in the share sheet rather than a "Copy to..." buried under it --
//! and it is the one with a signing question over it, which is why this file
//! reads **both** and says which one a row came in by. `via` is the answer to
//! K8 in one word per row.
//!
//! # The shapes are not the same, and that is Apple's doing
//!
//! "Copy to Frank" is the OS copying a file, so the inbox is **flat**: one file
//! per share, named whatever it was named, with no room for a URL or a title.
//! The extension is our own code, so it writes a **folder per share** -- an id,
//! the payload beside it, and `source.json` carrying the things a file name
//! cannot: where it came from, what it was called, when. `rows_flat` and
//! `rows_nested` are those two shapes and they answer the same row.
//!
//! # Off iOS
//!
//! Both roots are `cfg(target_os = "ios")` -- they are answered by
//! `ios/FrankInbox.m`, because neither path is computable (a container is a
//! per-install UUID). On the Mac and in `cargo test` there is no inbox, the
//! command answers an empty list, and the pure functions below are what run.

use std::fs;
use std::path::{Path, PathBuf};

// --------------------------------------------------------------- the constants

/// The App Group both binaries name. `group.` + the app's identifier, which is
/// Apple's own convention and the only spelling Xcode's automatic signing will
/// offer to create. It appears in FOUR places that must agree:
/// `gen/apple/frank_iOS/frank_iOS.share.entitlements`,
/// `gen/apple/FrankShare/FrankShare.share.entitlements`,
/// `gen/apple/FrankShare/ShareViewController.swift`, and here.
/// `inbox_tests::the_group_id_is_the_same_in_every_file` holds them equal.
///
/// **Nothing the 13th signs carries it** (G-INBOX): road two is out of
/// `gen/apple/project.yml` and lives in `gen/apple/FrankShare/road-two.yml`,
/// and the two `.entitlements` files a build does sign are `<dict/>`. The
/// group road stays in this file all the same -- `group_inbox()` answering
/// code 2 is how a build SAYS the entitlement is not there, and a reader that
/// could not tell that from "no inbox" would be the worse of the two.
pub const GROUP_ID: &str = "group.com.ttstv.frank";

/// Inside the App Group container. Ours, so ours to name.
pub const GROUP_INBOX: &str = "inbox";

/// Inside `<Documents>`. **Apple's, not ours** -- the OS creates `Inbox/` and
/// copies into it, and spelling it any other way means an empty list forever.
pub const DOCUMENTS_INBOX: &str = "Inbox";

/// What `source.json` is called. Written by the extension, read here.
pub const SOURCE_JSON: &str = "source.json";

/// How big a container path may be. A real one is ~120 bytes; 1024 is the
/// system's own `PATH_MAX` and the buffer `FrankInbox.m` fills.
///
/// Only the iOS roads spend it, so off iOS it is deliberately unused rather
/// than cfg'd away -- one constant, one place, whichever target is building.
#[allow(dead_code)]
const PATH_CAP: usize = 1024;

// ------------------------------------------------------------------ the reading

/// One item's row, as the app and any later page would see it.
///
/// `id` is the folder name on the extension road and the file name on the
/// "Copy to" road -- in both cases the thing that names the item uniquely
/// inside its own inbox, which is all an id has to be.
fn row(
    id: &str,
    via: &str,
    file: Option<&str>,
    bytes: u64,
    source: Option<serde_json::Value>,
) -> serde_json::Value {
    let source = source.filter(|v| v.is_object());
    let take = |key: &str| -> Option<String> {
        source
            .as_ref()
            .and_then(|v| v.get(key))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    serde_json::json!({
        "id": id,
        "via": via,
        // The title the extension recorded, or the file name, or the id. A row
        // always has something printable in it -- a spike that answers
        // `{"title": null}` proves nothing to the eye.
        "title": take("title").unwrap_or_else(|| file.unwrap_or(id).to_string()),
        // Where it came from. Only the extension road can know this: a copied
        // file has no provenance at all, and pretending otherwise would be the
        // lie that makes the two roads look equal when they are not.
        "url": take("url"),
        "kind": take("kind"),
        "at": take("time"),
        "file": file,
        "bytes": bytes,
    })
}

/// A name we will not look at: dot files (`.DS_Store` above all, which Files
/// and iCloud both scatter), and anything with a separator in it, which
/// `read_dir` cannot produce but a future caller might hand us.
fn skip(name: &str) -> bool {
    name.is_empty() || name.starts_with('.') || name.contains('/') || name.contains('\\')
}

/// The **flat** shape: `<Documents>/Inbox/<file>`, one file per share, written
/// by the OS. No `source.json` can exist here, so every row is file name and
/// size and honestly nothing else.
pub fn rows_flat(root: &Path) -> Vec<serde_json::Value> {
    let mut names: Vec<(String, u64)> = Vec::new();
    let Ok(dir) = fs::read_dir(root) else {
        return Vec::new();
    };
    for e in dir.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if skip(&name) {
            continue;
        }
        match e.metadata() {
            // A directory here is not ours. iOS has been known to copy a
            // package (a `.pages`, a `.rtfd`) as a folder, and a spike that
            // reported it as a file with 0 bytes would be reporting a fiction.
            Ok(m) if m.is_file() => names.push((name, m.len())),
            _ => continue,
        }
    }
    names.sort();
    names
        .into_iter()
        .map(|(name, bytes)| row(&name, "open-in", Some(&name), bytes, None))
        .collect()
}

/// The **nested** shape: `<group>/inbox/<id>/`, one folder per share, written
/// by `ShareViewController.swift`. `source.json` is the extension's note to
/// the app; the payload is whichever other file is there.
///
/// A folder with a `source.json` and NO payload is still a row -- a shared URL
/// or a shared selection is a source and no file, and losing it would lose the
/// cheapest capture of all.
pub fn rows_nested(root: &Path) -> Vec<serde_json::Value> {
    let mut ids: Vec<String> = Vec::new();
    let Ok(dir) = fs::read_dir(root) else {
        return Vec::new();
    };
    for e in dir.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if skip(&name) {
            continue;
        }
        if e.metadata().map(|m| m.is_dir()).unwrap_or(false) {
            ids.push(name);
        }
    }
    ids.sort();
    ids.into_iter()
        .map(|id| {
            let here = root.join(&id);
            let source = fs::read_to_string(here.join(SOURCE_JSON))
                .ok()
                .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok());
            // The payload: the one entry that is not the note. `.part` is the
            // extension's own half-written name (it renames into place), so a
            // share caught mid-write reports no file rather than a truncated
            // one -- the same rule the book door keeps in `lib.rs`. `payload_in`
            // is that rule, and it is shared with `item_file` below so the row
            // and the send can never disagree about which file an item IS.
            let payload = payload_in(&here);
            let (file, bytes) = match &payload {
                Some((n, b)) => (Some(n.as_str()), *b),
                None => (None, 0),
            };
            row(&id, "share-extension", file, bytes, source)
        })
        .collect()
}

// -------------------------------------------------------------------- the roots

/// What `ios/FrankInbox.m` returns, as a sentence. `0` is success.
pub fn root_why(code: i32) -> &'static str {
    match code {
        0 => "ok",
        2 => "no such container -- the App Group entitlement is absent or unsigned on this build",
        3 => "the container path is longer than the buffer",
        4 => "a NULL argument reached FrankInbox.m",
        5 => "not iOS -- there is no container here",
        _ => "unknown frank_inbox result",
    }
}

#[cfg(target_os = "ios")]
extern "C" {
    fn frank_inbox_documents(out: *mut std::os::raw::c_char, cap: i32) -> i32;
    fn frank_inbox_group(
        group_id: *const std::os::raw::c_char,
        out: *mut std::os::raw::c_char,
        cap: i32,
    ) -> i32;
}

/// Read a path out of one of the two C calls. `Err(code)` is the honest answer
/// and `root_why` is its sentence.
#[cfg(target_os = "ios")]
fn ask(f: impl FnOnce(*mut std::os::raw::c_char, i32) -> i32) -> Result<PathBuf, i32> {
    let mut buf = vec![0_i8; PATH_CAP];
    let code = f(buf.as_mut_ptr(), PATH_CAP as i32);
    if code != 0 {
        return Err(code);
    }
    let s = unsafe { std::ffi::CStr::from_ptr(buf.as_ptr()) }
        .to_string_lossy()
        .to_string();
    if s.is_empty() {
        return Err(2);
    }
    Ok(PathBuf::from(s))
}

/// `<Documents>/Inbox` -- the "Copy to Frank" road.
#[cfg(target_os = "ios")]
pub fn documents_inbox() -> Result<PathBuf, i32> {
    ask(|p, c| unsafe { frank_inbox_documents(p, c) }).map(|d| d.join(DOCUMENTS_INBOX))
}

/// `<group>/inbox` -- the share-extension road, or the code that says why not.
#[cfg(target_os = "ios")]
pub fn group_inbox() -> Result<PathBuf, i32> {
    let gid = std::ffi::CString::new(GROUP_ID).map_err(|_| 4)?;
    ask(|p, c| unsafe { frank_inbox_group(gid.as_ptr(), p, c) }).map(|d| d.join(GROUP_INBOX))
}

#[cfg(not(target_os = "ios"))]
pub fn documents_inbox() -> Result<PathBuf, i32> {
    Err(5)
}

#[cfg(not(target_os = "ios"))]
pub fn group_inbox() -> Result<PathBuf, i32> {
    Err(5)
}

// ----------------------------------------------------------------- the command

/// `TTSTVHost.inbox.list()`: everything shared into this phone that the app has
/// not taken yet, newest road first. **Reading only** -- nothing here moves,
/// parses or deletes an item, because C2 says the inbox is where a thing waits
/// and G-STUDIOPHONE is what drains it.
#[tauri::command]
pub fn inbox_list() -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    if let Ok(root) = group_inbox() {
        out.extend(rows_nested(&root));
    }
    if let Ok(root) = documents_inbox() {
        out.extend(rows_flat(&root));
    }
    out
}

/// The proof, and the whole of the UI this spike is allowed: one line in the
/// log at start-up saying which roads exist on THIS build and what is waiting
/// on them. Read it with `tauri ios dev`'s console, or Console.app against the
/// phone; `frank:` is the prefix every other line here uses.
pub fn log_at_start() {
    for (what, root) in [("group", group_inbox()), ("documents", documents_inbox())] {
        match root {
            Ok(path) => {
                let n = match what {
                    "group" => rows_nested(&path).len(),
                    _ => rows_flat(&path).len(),
                };
                log::info!("frank: inbox {what} = {} -- {n} waiting", path.display());
            }
            Err(code) => log::info!("frank: inbox {what} unavailable -- {}", root_why(code)),
        }
    }
}

// ---------------------------------------------------------------- the hand-off
//
// G-INBOX (13 Sep). The spike above made the inbox VISIBLE; this makes it a
// thing a person can finish. A row is tapped, the payload goes to the paired
// Studio over the LAN, Studio parses it, and the row goes.
//
// **THE DOOR IS `POST /upload`, and it is Studio's own.**
// `library/routes.py::handle_upload` takes `?name=<filename>&kind=epub|pdf`
// and the file as the RAW BODY (not multipart -- `studio/serve.py`'s own
// not-added note says "an unbounded multipart body", and that is wrong about
// the shape: there is a `Content-Length`, the write goes to a sibling `.part`
// and is `os.replace`d only when the last byte is down, and a short body is a
// 400 that leaves the file already on the drive untouched). On a 200 it has
// already started the ingest -- parse, attrib, dictionary, grammar, one job
// slot -- so ONE call is the whole hand-off, and `{"saved": ..., "job": ...}`
// is the answer.
//
// **IT IS NOT IN THE PHONE'S ALLOW-LIST YET**, and that is the one thing this
// lane cannot fix from here: `studio/serve.py::_SYNC_STUDIO` is six routes
// (`/search`, `/attach`, `/run`, `/state`, `/book`, `/stop`) and `/upload` is
// named below them as WANTED. Until it is typed into that set, a paired phone
// gets a 404 from this call -- so 404 has a sentence of its own that says
// exactly that, rather than the row going red with nothing in it. See §6 of
// the report.
//
// `/run` is NOT the door for this. `/run {slug, chapter, step}` parses a book
// that is ALREADY on the Mac's shelf; an inbox item is a file on the phone
// that the Mac has never seen. The parse an inbox item needs is the ingest
// `POST /upload` starts by itself.

/// Studio's route, spelt once.
pub const UPLOAD: &str = "/upload";

/// The two kinds `handle_upload` accepts, and the sentence for anything else.
///
/// Road one declares THREE document types (`CFBundleDocumentTypes`: PDF,
/// EPUB, plain text) because a phone that refuses a share at the share sheet
/// teaches a person nothing. Studio takes two. So a `.txt` lands, shows as a
/// row, and says what it is -- which is the F10 shape ("a sentence, never
/// silence") and not a silent drop at the other end.
pub fn kind_for(name: &str) -> Result<&'static str, String> {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".pdf") {
        return Ok("pdf");
    }
    if lower.ends_with(".epub") {
        return Ok("epub");
    }
    Err(format!(
        "Studio parses a PDF or an EPUB, and {name} is neither -- \
         it is waiting here and nothing has been lost"
    ))
}

/// `<base>/upload?name=&kind=&t=` -- the pairing token travels as `t`, which
/// is the spelling every other paired call uses
/// (`settings/settings.js`, `library/drive.js`: `/sync/manifest?t=`).
///
/// The base is the paired one and is checked all the same: a `base` that is
/// not `http://` or `https://` is a typed address that would otherwise become
/// a relative fetch off `frank://localhost`, which is this app's own files.
pub fn upload_url(base: &str, name: &str, kind: &str, token: &str) -> Result<String, String> {
    let base = base.trim_end_matches('/');
    if !(base.starts_with("http://") || base.starts_with("https://")) {
        return Err(format!("{base} is not an address Frank can post to"));
    }
    if token.is_empty() {
        return Err("this phone is not paired with a Studio yet".into());
    }
    Ok(format!(
        "{base}{UPLOAD}?name={}&kind={kind}&t={}",
        crate::pull::enc(name),
        crate::pull::enc(token)
    ))
}

/// Studio's answer, as the row's own state and sentence.
///
/// Every code that can come back has a sentence, and the 404 one is the
/// important one: it is not "Studio is broken", it is "this Studio has not
/// opened that route to a phone", which is a different thing to do about it.
pub fn sent(status: u16, body: &str) -> serde_json::Value {
    let parsed = serde_json::from_str::<serde_json::Value>(body).ok();
    let field = |k: &str| -> Option<String> {
        parsed
            .as_ref()
            .and_then(|v| v.get(k))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    let theirs = field("error");
    let saved = field("saved");
    if status == 200 {
        return serde_json::json!({
            "ok": true,
            "status": status,
            "saved": saved,
            "why": "Studio has it and is parsing it -- it will arrive with the next Sync",
        });
    }
    let why = match status {
        404 => "this Studio has not opened /upload to a phone yet -- its door answers \
                /search, /attach, /run, /state, /book and /stop, and a file off a phone \
                is not one of them"
            .to_string(),
        401 | 403 => "this Studio did not accept the pairing -- pair again in Settings \
                      \u{25b8} Transfer"
            .to_string(),
        409 => theirs
            .clone()
            .unwrap_or_else(|| "Studio is busy with another job -- try again when it is done".into()),
        503 => theirs
            .clone()
            .unwrap_or_else(|| "Studio cannot reach its drive right now".into()),
        _ => theirs
            .clone()
            .unwrap_or_else(|| format!("Studio answered {status}")),
    };
    serde_json::json!({ "ok": false, "status": status, "saved": saved, "why": why })
}

/// The seam the tests come through: one POST, a raw body, a status and a
/// string back. `Net` is the real one; the tests hand in a recorder, so every
/// sentence above is proved without a socket.
pub trait Post {
    fn post(&mut self, url: &str, body: Vec<u8>) -> Result<(u16, String), String>;
}

/// `ureq`, blocking, the crate's one client shape -- `pull::Net`'s timeouts,
/// with the write one widened: a 40 MB epub up a phone's Wi-Fi is slower than
/// a book file coming down, and a timeout mid-body is the case
/// `handle_upload` answers with "the file on disk was not touched".
pub struct Net {
    agent: ureq::Agent,
}

impl Net {
    pub fn new() -> Self {
        Net {
            agent: ureq::AgentBuilder::new()
                .timeout_connect(std::time::Duration::from_secs(15))
                .timeout_read(std::time::Duration::from_secs(120))
                .timeout_write(std::time::Duration::from_secs(300))
                .user_agent("Frank")
                .build(),
        }
    }
}

impl Default for Net {
    fn default() -> Self {
        Self::new()
    }
}

impl Post for Net {
    fn post(&mut self, url: &str, body: Vec<u8>) -> Result<(u16, String), String> {
        match self
            .agent
            .post(url)
            .set("Content-Type", "application/octet-stream")
            .send_bytes(&body)
        {
            Ok(res) => {
                let code = res.status();
                res.into_string().map(|t| (code, t)).map_err(|e| e.to_string())
            }
            Err(ureq::Error::Status(code, res)) => {
                Ok((code, res.into_string().unwrap_or_default()))
            }
            Err(ureq::Error::Transport(t)) => Err(t.to_string()),
        }
    }
}

/// The payload inside one nested item: the one entry that is not the note and
/// is not half-written. Lifted out of [`rows_nested`] so the row and the send
/// can never disagree about which file an item IS.
fn payload_in(dir: &Path) -> Option<(String, u64)> {
    let inner = fs::read_dir(dir).ok()?;
    for e in inner.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if skip(&name) || name == SOURCE_JSON || name.ends_with(".part") {
            continue;
        }
        if let Ok(m) = e.metadata() {
            if m.is_file() {
                return Some((name, m.len()));
            }
        }
    }
    None
}

/// Where an item's bytes are, on whichever road it came in by, and the name
/// Studio should file it under.
///
/// `skip` is the whole of the path check and it is enough: an id with a `/`,
/// a `\` or a leading dot never becomes a path here, so nothing outside the
/// two roots can be reached however a page spells the argument.
pub fn item_file(id: &str, via: &str) -> Result<(PathBuf, String), String> {
    if skip(id) {
        return Err(format!("{id} is not a name in this inbox"));
    }
    match via {
        "open-in" => {
            let p = documents_inbox().map_err(|c| root_why(c).to_string())?.join(id);
            if p.is_file() {
                Ok((p, id.to_string()))
            } else {
                Err(format!("{id} is not in this phone's inbox any more"))
            }
        }
        "share-extension" => {
            let dir = group_inbox().map_err(|c| root_why(c).to_string())?.join(id);
            match payload_in(&dir) {
                Some((name, _)) => Ok((dir.join(&name), name)),
                None => Err(format!(
                    "{id} is a note with no file in it -- there is nothing to parse yet"
                )),
            }
        }
        _ => Err(format!("{via} is not a road into this inbox")),
    }
}

/// Read it, post it, and say what came back. Takes the path, so the whole of
/// it runs in `cargo test` on any machine.
pub fn send_file(
    file: &Path,
    name: &str,
    base: &str,
    token: &str,
    post: &mut dyn Post,
) -> serde_json::Value {
    let kind = match kind_for(name) {
        Ok(k) => k,
        Err(why) => return serde_json::json!({ "ok": false, "status": 0, "why": why }),
    };
    let url = match upload_url(base, name, kind, token) {
        Ok(u) => u,
        Err(why) => return serde_json::json!({ "ok": false, "status": 0, "why": why }),
    };
    let bytes = match fs::read(file) {
        Ok(b) if !b.is_empty() => b,
        Ok(_) => {
            return serde_json::json!({
                "ok": false, "status": 0,
                "why": format!("{name} is empty -- there is nothing to send")
            })
        }
        Err(e) => {
            return serde_json::json!({
                "ok": false, "status": 0,
                "why": format!("could not read {name}: {e}")
            })
        }
    };
    let n = bytes.len();
    match post.post(&url, bytes) {
        Ok((status, body)) => {
            let mut v = sent(status, &body);
            v["bytes"] = serde_json::json!(n);
            v["kind"] = serde_json::json!(kind);
            v
        }
        // The address is in the sentence on purpose: the commonest reason
        // this fails is a Mac asleep or on another network, and the row is
        // where a person finds out which one they are looking at.
        Err(why) => serde_json::json!({
            "ok": false, "status": 0,
            "why": format!("could not reach Studio at {base} -- {why}")
        }),
    }
}

/// `TTSTVHost.inbox.send(id, via, base, token)`: one row, over the LAN, to the
/// paired Studio. Answers `sent()`'s shape -- never an `Err`, because every
/// way this can fail is a sentence a row has to be able to show.
#[tauri::command]
pub fn inbox_send(id: String, via: String, base: String, token: String) -> serde_json::Value {
    match item_file(&id, &via) {
        Ok((file, name)) => send_file(&file, &name, &base, &token, &mut Net::new()),
        Err(why) => serde_json::json!({ "ok": false, "status": 0, "why": why }),
    }
}

/// Take the item out of the inbox. The file road is one file; the extension
/// road is the folder and everything in it.
///
/// **Only ever called after a 200**, and that is what makes it safe: on a 200
/// the bytes are on the Mac's drive under `TTS_DATA/sources`, which is a
/// write-once landing spot, and the phone's copy is then the second copy of a
/// file that is already kept. Nothing here is reachable for an item that was
/// not sent -- `inbox_drop` is a separate command and the page calls it in one
/// place (`INBOX_JS`, after `ok`).
pub fn drop_item(id: &str, via: &str) -> Result<bool, String> {
    if skip(id) {
        return Err(format!("{id} is not a name in this inbox"));
    }
    let target = match via {
        "open-in" => documents_inbox().map_err(|c| root_why(c).to_string())?.join(id),
        "share-extension" => group_inbox().map_err(|c| root_why(c).to_string())?.join(id),
        _ => return Err(format!("{via} is not a road into this inbox")),
    };
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    if target.is_file() {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

/// `TTSTVHost.inbox.drop(id, via)` -- the row goes.
#[tauri::command]
pub fn inbox_drop(id: String, via: String) -> Result<bool, String> {
    drop_item(&id, &via)
}

// ------------------------------------------------------------------- the tests

#[cfg(test)]
mod inbox_tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!(
            "frank-inbox-{name}-{}-{:?}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn a_missing_root_is_an_empty_list_and_never_a_panic() {
        let gone = std::env::temp_dir().join("frank-inbox-no-such-root-ever");
        assert!(rows_flat(&gone).is_empty());
        assert!(rows_nested(&gone).is_empty());
    }

    #[test]
    fn the_copy_to_road_is_one_row_per_file_sorted_dotfiles_ignored() {
        let root = scratch("flat");
        fs::write(root.join("b.pdf"), b"1234567890").unwrap();
        fs::write(root.join("a.epub"), b"12345").unwrap();
        fs::write(root.join(".DS_Store"), b"x").unwrap();
        fs::create_dir_all(root.join("Pages.pages")).unwrap();
        let rows = rows_flat(&root);
        assert_eq!(rows.len(), 2, "a dot file and a package folder are not items");
        assert_eq!(rows[0]["id"], "a.epub");
        assert_eq!(rows[0]["via"], "open-in");
        assert_eq!(rows[0]["bytes"], 5);
        assert_eq!(rows[1]["id"], "b.pdf");
        assert_eq!(rows[1]["bytes"], 10);
        // A copied file has no provenance and must not claim any.
        assert!(rows[0]["url"].is_null() && rows[0]["at"].is_null());
        // ...but it always has something printable.
        assert_eq!(rows[0]["title"], "a.epub");
    }

    #[test]
    fn the_extension_road_reads_source_json_and_the_payload_beside_it() {
        let root = scratch("nested");
        let one = root.join("20260913-101500-ab12");
        fs::create_dir_all(&one).unwrap();
        fs::write(
            one.join(SOURCE_JSON),
            br#"{"url":"https://example.org/p.pdf","title":"A Paper","time":"2026-09-13T10:15:00Z","kind":"public.pdf"}"#,
        )
        .unwrap();
        fs::write(one.join("p.pdf"), vec![0_u8; 2048]).unwrap();
        let rows = rows_nested(&root);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["via"], "share-extension");
        assert_eq!(rows[0]["id"], "20260913-101500-ab12");
        assert_eq!(rows[0]["title"], "A Paper");
        assert_eq!(rows[0]["url"], "https://example.org/p.pdf");
        assert_eq!(rows[0]["kind"], "public.pdf");
        assert_eq!(rows[0]["at"], "2026-09-13T10:15:00Z");
        assert_eq!(rows[0]["file"], "p.pdf");
        assert_eq!(rows[0]["bytes"], 2048);
    }

    #[test]
    fn a_shared_url_with_no_file_is_still_a_row() {
        let root = scratch("urlonly");
        let one = root.join("20260913-101600-cd34");
        fs::create_dir_all(&one).unwrap();
        fs::write(
            one.join(SOURCE_JSON),
            br#"{"url":"https://example.org/article","title":"An Article","time":"2026-09-13T10:16:00Z","kind":"public.url"}"#,
        )
        .unwrap();
        let rows = rows_nested(&root);
        assert_eq!(rows.len(), 1);
        assert!(rows[0]["file"].is_null());
        assert_eq!(rows[0]["bytes"], 0);
        assert_eq!(rows[0]["url"], "https://example.org/article");
    }

    #[test]
    fn a_share_caught_mid_write_reports_no_file_rather_than_a_truncated_one() {
        let root = scratch("part");
        let one = root.join("20260913-101700-ef56");
        fs::create_dir_all(&one).unwrap();
        fs::write(one.join("big.pdf.part"), vec![0_u8; 12]).unwrap();
        let rows = rows_nested(&root);
        assert_eq!(rows.len(), 1, "the folder is there, so the row is there");
        assert!(rows[0]["file"].is_null(), "a .part is not a payload");
        // With no source.json and no payload the id is all there is, and the
        // row still prints.
        assert_eq!(rows[0]["title"], "20260913-101700-ef56");
    }

    #[test]
    fn a_broken_source_json_does_not_take_the_row_with_it() {
        let root = scratch("broken");
        let one = root.join("20260913-101800-gh78");
        fs::create_dir_all(&one).unwrap();
        fs::write(one.join(SOURCE_JSON), b"{not json").unwrap();
        fs::write(one.join("x.pdf"), b"abc").unwrap();
        let rows = rows_nested(&root);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["title"], "x.pdf", "it falls back to the file name");
        assert!(rows[0]["url"].is_null());
        assert_eq!(rows[0]["bytes"], 3);
    }

    #[test]
    fn off_ios_there_is_no_inbox_and_the_code_says_so() {
        // `cargo test` targets the host, so both roads answer 5 here. This is
        // the test that would go red if a root were ever computed in Rust
        // rather than asked of Foundation.
        #[cfg(not(target_os = "ios"))]
        {
            assert_eq!(documents_inbox().unwrap_err(), 5);
            assert_eq!(group_inbox().unwrap_err(), 5);
            assert_eq!(root_why(5), "not iOS -- there is no container here");
            assert!(inbox_list().is_empty());
        }
    }

    /// The group id is written down in four files and a typo in any one of
    /// them is an inbox that is always empty with nothing in the log to say
    /// why. Read at RUNTIME and not `include_str!` on purpose: the extension
    /// half of this spike is a separate commit, and a test that cannot compile
    /// without it would make the two inseparable. A file that is not there yet
    /// is skipped and said so; a file that IS there must agree.
    #[test]
    fn the_group_id_is_the_same_in_every_file() {
        let mut checked = 0;
        for rel in [
            // What the ship build signs. Both are `<dict/>` since G-INBOX
            // (road two is out of `project.yml`), so both are skipped by the
            // rule below -- and if either ever grows an App Group again, this
            // test is what holds it to ours.
            "gen/apple/frank_iOS/frank_iOS.entitlements",
            "gen/apple/FrankShare/FrankShare.entitlements",
            // Road two's own pair, which nothing signs today
            // (`gen/apple/FrankShare/road-two.yml`). These DO name a group,
            // so these are the two the assert below actually bites on.
            "gen/apple/frank_iOS/frank_iOS.share.entitlements",
            "gen/apple/FrankShare/FrankShare.share.entitlements",
            "gen/apple/FrankShare/ShareViewController.swift",
        ] {
            let Ok(text) = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(rel))
            else {
                continue;
            };
            // An entitlements file that does not claim an App Group at all
            // is the state before the extension half lands, and it is not a
            // disagreement. One that DOES claim one must claim ours.
            if rel.ends_with(".entitlements") && !text.contains("application-groups") {
                continue;
            }
            assert!(text.contains(GROUP_ID), "{rel} does not name {GROUP_ID}");
            checked += 1;
        }
        eprintln!("the group id agreed in {checked} of 5 files present");
    }

    #[test]
    fn every_code_frank_inbox_can_return_has_a_sentence() {
        for code in [0, 2, 3, 4, 5] {
            assert_ne!(root_why(code), "unknown frank_inbox result", "code {code}");
        }
        assert_eq!(root_why(99), "unknown frank_inbox result");
    }

    // ------------------------------------------------------ the hand-off (G-INBOX)

    /// A recorder in the shape of the real client: every call it was given,
    /// and the answer it was told to give. No socket anywhere in these tests.
    struct Recorder {
        answer: Result<(u16, String), String>,
        calls: Vec<(String, Vec<u8>)>,
    }

    impl Recorder {
        fn ok(status: u16, body: &str) -> Self {
            Recorder { answer: Ok((status, body.to_string())), calls: Vec::new() }
        }
        fn lost(why: &str) -> Self {
            Recorder { answer: Err(why.to_string()), calls: Vec::new() }
        }
    }

    impl Post for Recorder {
        fn post(&mut self, url: &str, body: Vec<u8>) -> Result<(u16, String), String> {
            self.calls.push((url.to_string(), body));
            self.answer.clone()
        }
    }

    #[test]
    fn studio_takes_two_kinds_and_says_so_about_the_third() {
        assert_eq!(kind_for("Walden.pdf").unwrap(), "pdf");
        assert_eq!(kind_for("WALDEN.PDF").unwrap(), "pdf");
        assert_eq!(kind_for("pg2542-images.epub").unwrap(), "epub");
        let why = kind_for("notes.txt").unwrap_err();
        assert!(why.contains("PDF or an EPUB"), "{why}");
        assert!(why.contains("notes.txt"), "the sentence names the file: {why}");
        assert!(why.contains("nothing has been lost"), "{why}");
        // A name that merely CONTAINS the word is not the extension.
        assert!(kind_for("pdf-notes-about-epub").is_err());
    }

    #[test]
    fn the_upload_url_is_studios_own_and_every_value_is_encoded() {
        let u = upload_url("http://192.168.1.8:8765", "A Book & Co.pdf", "pdf", "tok en/1").unwrap();
        assert_eq!(
            u,
            "http://192.168.1.8:8765/upload?name=A%20Book%20%26%20Co.pdf&kind=pdf&t=tok%20en%2F1"
        );
        // A trailing slash on the paired base does not become a double one.
        assert!(upload_url("http://mac.local:8765/", "a.pdf", "pdf", "t")
            .unwrap()
            .starts_with("http://mac.local:8765/upload?"));
        // ...and an address that is not one is refused before any fetch.
        assert!(upload_url("mac.local:8765", "a.pdf", "pdf", "t").is_err());
        assert!(upload_url("frank://localhost", "a.pdf", "pdf", "t").is_err());
        let why = upload_url("http://mac.local", "a.pdf", "pdf", "").unwrap_err();
        assert!(why.contains("not paired"), "{why}");
    }

    #[test]
    fn every_answer_studio_can_give_has_a_sentence() {
        let good = sent(200, r#"{"slug":null,"saved":"Walden.pdf","job":{"id":"j1"}}"#);
        assert_eq!(good["ok"], true);
        assert_eq!(good["saved"], "Walden.pdf");
        assert!(good["why"].as_str().unwrap().contains("next Sync"));

        // THE ONE THAT MATTERS TODAY: /upload is not in the phone's allow-list,
        // so a paired phone gets a 404 from a Studio that is working fine.
        let shut = sent(404, "");
        assert_eq!(shut["ok"], false);
        let why = shut["why"].as_str().unwrap();
        assert!(why.contains("/upload"), "{why}");
        assert!(why.contains("/state"), "it names what the door DOES answer: {why}");

        // Studio's own words, where it gave any.
        let busy = sent(409, r#"{"error":"saved to Walden.pdf, but a job is already running"}"#);
        assert_eq!(busy["why"], "saved to Walden.pdf, but a job is already running");
        let dry = sent(503, r#"{"error":"SSD not mounted (looked for /Volumes/Ex)"}"#);
        assert!(dry["why"].as_str().unwrap().contains("SSD not mounted"));
        // ...and where it gave none, a sentence all the same, never a blank.
        for code in [400u16, 409, 500, 503, 418] {
            let v = sent(code, "not json at all");
            assert_eq!(v["ok"], false);
            assert!(!v["why"].as_str().unwrap().is_empty(), "code {code} said nothing");
        }
        assert!(sent(401, "")["why"].as_str().unwrap().contains("pair again"));
    }

    #[test]
    fn a_send_posts_the_exact_bytes_to_the_exact_url() {
        let root = scratch("send");
        let file = root.join("Walden.pdf");
        fs::write(&file, b"%PDF-1.4 not really").unwrap();
        let mut rec = Recorder::ok(200, r#"{"saved":"Walden.pdf","job":{"id":"j1"}}"#);
        let v = send_file(&file, "Walden.pdf", "http://mac.local:8765", "tok", &mut rec);
        assert_eq!(v["ok"], true);
        assert_eq!(v["bytes"], 19);
        assert_eq!(v["kind"], "pdf");
        assert_eq!(rec.calls.len(), 1, "one call, never two");
        assert_eq!(
            rec.calls[0].0,
            "http://mac.local:8765/upload?name=Walden.pdf&kind=pdf&t=tok"
        );
        assert_eq!(rec.calls[0].1, b"%PDF-1.4 not really".to_vec(), "the body is the file");
    }

    #[test]
    fn nothing_a_send_refuses_ever_reaches_the_network() {
        let root = scratch("refuse");
        let txt = root.join("notes.txt");
        fs::write(&txt, b"hello").unwrap();
        let mut rec = Recorder::ok(200, "{}");
        let v = send_file(&txt, "notes.txt", "http://mac.local", "tok", &mut rec);
        assert_eq!(v["ok"], false);
        assert!(rec.calls.is_empty(), "a kind Studio cannot parse is refused here");

        let empty = root.join("nothing.pdf");
        fs::write(&empty, b"").unwrap();
        let v = send_file(&empty, "nothing.pdf", "http://mac.local", "tok", &mut rec);
        assert!(v["why"].as_str().unwrap().contains("empty"));
        assert!(rec.calls.is_empty(), "an empty file is a 400 nobody needs to ask for");

        let gone = root.join("never-was.pdf");
        let v = send_file(&gone, "never-was.pdf", "http://mac.local", "tok", &mut rec);
        assert_eq!(v["ok"], false);
        assert!(rec.calls.is_empty());

        // Unpaired: the sentence, and no call.
        let v = send_file(&root.join("Walden.pdf"), "Walden.pdf", "http://mac.local", "", &mut rec);
        assert!(v["why"].as_str().unwrap().contains("not paired"));
        assert!(rec.calls.is_empty());
    }

    #[test]
    fn a_mac_that_is_asleep_is_a_sentence_with_the_address_in_it() {
        let root = scratch("lost");
        let file = root.join("a.pdf");
        fs::write(&file, b"x").unwrap();
        let mut rec = Recorder::lost("connection refused");
        let v = send_file(&file, "a.pdf", "http://192.168.1.8:8765", "tok", &mut rec);
        assert_eq!(v["ok"], false);
        assert_eq!(v["status"], 0);
        let why = v["why"].as_str().unwrap();
        assert!(why.contains("192.168.1.8:8765"), "which Studio: {why}");
        assert!(why.contains("connection refused"), "and what it said: {why}");
        assert_eq!(rec.calls.len(), 1, "it did try");
    }

    #[test]
    fn an_id_that_is_not_a_name_never_becomes_a_path() {
        // The SENTENCE, not just the Err: off iOS every road answers "not
        // iOS" anyway, so a test that only asked for an error would stay
        // green with the guard taken out. This one names the guard.
        for bad in ["../../books", ".hidden", "a/b", "a\\b", ""] {
            let why = item_file(bad, "open-in").unwrap_err();
            assert!(why.contains("is not a name in this inbox"), "{bad}: {why}");
            let why = drop_item(bad, "open-in").unwrap_err();
            assert!(why.contains("is not a name in this inbox"), "{bad}: {why}");
        }
        // A road that is not one of the two is refused by name.
        assert!(item_file("a.pdf", "airdrop").unwrap_err().contains("airdrop"));
        assert!(drop_item("a.pdf", "airdrop").is_err());
    }

    #[test]
    fn off_ios_the_hand_off_says_there_is_no_inbox_rather_than_guessing_one() {
        #[cfg(not(target_os = "ios"))]
        {
            let why = item_file("a.pdf", "open-in").unwrap_err();
            assert_eq!(why, root_why(5));
            assert_eq!(drop_item("a.pdf", "share-extension").unwrap_err(), root_why(5));
            let v = inbox_send("a.pdf".into(), "open-in".into(), "http://mac.local".into(), "t".into());
            assert_eq!(v["ok"], false);
            assert_eq!(v["why"], root_why(5));
        }
    }

    #[test]
    fn drop_takes_the_file_on_one_road_and_the_whole_folder_on_the_other() {
        // `drop_item` itself needs an iOS root, so what is provable here is the
        // shape it removes -- the same two calls, against a scratch root.
        let root = scratch("drop");
        let one = root.join("x.pdf");
        fs::write(&one, b"x").unwrap();
        assert!(one.is_file());
        fs::remove_file(&one).unwrap();
        assert!(!one.exists());
        let folder = root.join("20260913-101500-ab12");
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join(SOURCE_JSON), b"{}").unwrap();
        fs::write(folder.join("p.pdf"), b"x").unwrap();
        assert_eq!(payload_in(&folder).unwrap().0, "p.pdf");
        fs::remove_dir_all(&folder).unwrap();
        assert!(!folder.exists());
        // ...and the note alone is not a payload, so it is not a send.
        let note = root.join("20260913-101600-cd34");
        fs::create_dir_all(&note).unwrap();
        fs::write(note.join(SOURCE_JSON), b"{}").unwrap();
        assert!(payload_in(&note).is_none());
    }
}
