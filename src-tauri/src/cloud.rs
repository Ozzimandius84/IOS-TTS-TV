//! The cloud's versions, kept on the phone (CLOUD lane, 11 Oct 2026).
//!
//! Osca, 11 Oct 12:58: "WHAT IS TOO MUCH FOR THE PHONE, HAS to be done OVER the cloud" -- and the
//! phone must work with the Mac OFF (`design/surface-drafts/WHERE-IT-RUNS.md`). Make (a text read
//! aloud in a chosen voice) and Add a LibriVox reading run in Frank's cloud (`cloud/endpoint.py`,
//! `POST /make`, `POST /attach`); the page asks the door itself (the door answers CORS `*`). What a
//! page cannot do is write into the app's folders -- so the finished version comes down through
//! here, file by file, and is KEPT.
//!
//! # A version is never overwritten (Osca, 11 Oct 12:40: "a book can have many audio versions")
//!
//! Every version lives in its own folder, `<app data>/versions/<slug>/<id>/`, OUTSIDE `books/` --
//! a sync that installs a new parse of the book swaps `books/<slug>/` whole (`book_commit`), and a
//! version inside it would go with it. The id is the cloud's (`make-…`, `read-…`), new on every
//! press, and `save` refuses an id that is already here.
//!
//! What the reader plays is `books/<slug>/audio/<cid>.<ext>` (+ `timings/<cid>.json`). `save` puts a
//! chapter there ONLY when the chapter has no audio yet. `use` makes another version the one that
//! plays: whatever was playing is moved into `versions/<slug>/_before-<nanos>/` first -- moved,
//! never deleted -- and then the version's files are copied in. Nothing here deletes a file.
//!
//! # The three commands
//!
//! * `cloud_version_save { url, pass, id, slug }` -> `{ id, files, placed, kept }`
//! * `cloud_version_use  { slug, id }`            -> `{ id, placed, moved }`
//! * `cloud_versions     { slug }`                -> `[ version.json, … ]`, newest first
//!
//! `url` and `pass` are the door's pairing (`localStorage["transfer.pairing"]`, which Osca types in
//! Settings ▸ Transfer ▸ Your door); the pass goes in one `Authorization` header and nowhere else.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use tauri::Manager;

pub const VERSIONS_DIR: &str = "versions";
/// What one version may hold -- the door's own `VERSION_FILE` rule, file for file.
const AUDIO_EXTS: &[&str] = &["mp3", "wav", "m4a", "opus", "ogg"];
const MAX_FILE: u64 = 400 * 1024 * 1024;
const TIMEOUT_MS: u64 = 120_000;

/// The cloud's version id: `make-<hex>` or `read-<hex>`.
pub fn id_ok(id: &str) -> Result<(), String> {
    let (kind, hex) = id.split_once('-').ok_or_else(|| format!("{id:?} is not a version id"))?;
    let ok = (kind == "make" || kind == "read")
        && (6..=16).contains(&hex.len())
        && hex.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c));
    if ok { Ok(()) } else { Err(format!("{id:?} is not a version id")) }
}

/// A file of a version, as the door names it: `version.json`, `read_by.json`,
/// `audio/c001.m4a|engine.json|unvoiced.json`, `timings/c001.json`.
pub fn rel_ok(rel: &str) -> Result<(), String> {
    let chap = |s: &str| {
        s.len() >= 4 && s.len() <= 5 && s.starts_with('c') && s[1..].bytes().all(|c| c.is_ascii_digit())
    };
    let ok = match rel {
        "version.json" | "read_by.json" => true,
        _ => {
            if let Some(f) = rel.strip_prefix("audio/") {
                let (c, ext) = f.split_once('.').unwrap_or(("", ""));
                chap(c) && matches!(ext, "m4a" | "engine.json" | "unvoiced.json")
            } else if let Some(f) = rel.strip_prefix("timings/") {
                f.strip_suffix(".json").map_or(false, chap)
            } else {
                false
            }
        }
    };
    if ok { Ok(()) } else { Err(format!("{rel:?} is not a file of a version")) }
}

fn slug_ok(slug: &str) -> Result<(), String> {
    let ok = !slug.is_empty()
        && slug.chars().count() <= 128
        && !slug.starts_with(['-', '+', '.'])
        && slug.chars().all(|c| (c.is_alphabetic() && !c.is_uppercase()) || c.is_ascii_digit() || c == '-' || c == '+');
    if ok { Ok(()) } else { Err(format!("{slug:?} is not a book slug")) }
}

fn why(what: &str, p: &Path, e: std::io::Error) -> String {
    format!("frank: cannot {what} {} -- {e}", p.display())
}

/// The chapters a version carries, off its `version.json` (`chapters: {c001: {...}}`).
fn chapters_of(doc: &serde_json::Value) -> Vec<String> {
    let mut v: Vec<String> = doc
        .get("chapters")
        .and_then(|c| c.as_object())
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default();
    v.sort();
    v
}

fn has_audio(book: &Path, cid: &str) -> bool {
    AUDIO_EXTS.iter().any(|e| book.join("audio").join(format!("{cid}.{e}")).is_file())
}

#[derive(serde::Serialize, Debug, PartialEq)]
pub struct Saved {
    pub id: String,
    pub files: usize,
    /// chapters that had no audio and play this version now
    pub placed: Vec<String>,
    /// chapters that already had audio: this version is kept, and `use` plays it
    pub kept: Vec<String>,
}

/// THE BODY of `cloud_version_save`, with the network injected: `files` is the door's list and
/// `get(rel)` the bytes of one. Writes `versions/<slug>/<id>/…`, then places what has no audio yet.
pub fn save_with(
    versions: &Path,
    books: &Path,
    slug: &str,
    id: &str,
    files: &[String],
    get: &mut dyn FnMut(&str) -> Result<Vec<u8>, String>,
) -> Result<Saved, String> {
    slug_ok(slug)?;
    id_ok(id)?;
    if !files.iter().any(|f| f == "version.json") {
        return Err(format!("{id} is not finished -- the cloud lists no version.json yet"));
    }
    for f in files {
        rel_ok(f)?;
    }
    let home = versions.join(slug).join(id);
    if home.exists() {
        return Err(format!("{id} is already on this phone -- a version is never written twice"));
    }
    // written into a dot-folder first and renamed, so a broken download never looks like a version
    let part = versions.join(slug).join(format!(".part-{id}"));
    for f in files {
        let bytes = get(f)?;
        let dst = part.join(f);
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| why("create", parent, e))?;
        }
        fs::write(&dst, &bytes).map_err(|e| why("write", &dst, e))?;
    }
    fs::rename(&part, &home).map_err(|e| why("keep", &home, e))?;
    let doc: serde_json::Value = serde_json::from_slice(
        &fs::read(home.join("version.json")).map_err(|e| why("read", &home, e))?,
    )
    .map_err(|e| format!("{id}: version.json is not JSON -- {e}"))?;
    let book = books.join(slug);
    let (mut placed, mut kept) = (Vec::new(), Vec::new());
    for cid in chapters_of(&doc) {
        let src = home.join("audio").join(format!("{cid}.m4a"));
        if !src.is_file() {
            continue;
        }
        if !book.is_dir() || has_audio(&book, &cid) {
            kept.push(cid);
            continue;
        }
        copy_chapter(&home, &book, &cid)?;
        placed.push(cid);
    }
    Ok(Saved { id: id.to_string(), files: files.len(), placed, kept })
}

/// A version's chapter into the book the reader reads: the audio, its timings, its records.
fn copy_chapter(home: &Path, book: &Path, cid: &str) -> Result<(), String> {
    for rel in [
        format!("audio/{cid}.m4a"),
        format!("audio/{cid}.engine.json"),
        format!("audio/{cid}.unvoiced.json"),
        format!("timings/{cid}.json"),
    ] {
        let src = home.join(&rel);
        if !src.is_file() {
            continue;
        }
        let dst = book.join(&rel);
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| why("create", parent, e))?;
        }
        fs::copy(&src, &dst).map_err(|e| why("copy", &dst, e))?;
    }
    Ok(())
}

#[derive(serde::Serialize, Debug, PartialEq)]
pub struct Used {
    pub id: String,
    pub placed: Vec<String>,
    /// where what was playing went (`versions/<slug>/_before-<nanos>`), when anything was
    pub moved: Option<String>,
}

/// THE BODY of `cloud_version_use`: this version plays now; what played before is moved aside.
pub fn use_version(versions: &Path, books: &Path, slug: &str, id: &str) -> Result<Used, String> {
    slug_ok(slug)?;
    id_ok(id)?;
    let home = versions.join(slug).join(id);
    let doc: serde_json::Value = serde_json::from_slice(
        &fs::read(home.join("version.json")).map_err(|_| format!("{id} is not on this phone"))?,
    )
    .map_err(|e| format!("{id}: version.json is not JSON -- {e}"))?;
    let book = books.join(slug);
    if !book.is_dir() {
        return Err(format!("{slug} is not on this phone's shelf"));
    }
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let aside = versions.join(slug).join(format!("_before-{nanos}"));
    let mut moved = false;
    let mut placed = Vec::new();
    for cid in chapters_of(&doc) {
        if !home.join("audio").join(format!("{cid}.m4a")).is_file() {
            continue;
        }
        let mut olds: Vec<String> = AUDIO_EXTS.iter().map(|e| format!("audio/{cid}.{e}")).collect();
        olds.extend([
            format!("audio/{cid}.engine.json"),
            format!("audio/{cid}.unvoiced.json"),
            format!("audio/{cid}.play.json"),
            format!("timings/{cid}.json"),
        ]);
        for rel in olds {
            let p = book.join(&rel);
            if p.is_file() {
                let dst = aside.join(&rel);
                if let Some(parent) = dst.parent() {
                    fs::create_dir_all(parent).map_err(|e| why("create", parent, e))?;
                }
                fs::rename(&p, &dst).map_err(|e| why("move aside", &p, e))?;
                moved = true;
            }
        }
        copy_chapter(&home, &book, &cid)?;
        placed.push(cid);
    }
    Ok(Used {
        id: id.to_string(),
        placed,
        moved: if moved { Some(aside.file_name().unwrap().to_string_lossy().into_owned()) } else { None },
    })
}

/// THE BODY of `cloud_versions`: every version of a text on this phone, newest first.
pub fn list(versions: &Path, slug: &str) -> Result<Vec<serde_json::Value>, String> {
    slug_ok(slug)?;
    let dir = versions.join(slug);
    let mut out = Vec::new();
    let Ok(rd) = fs::read_dir(&dir) else { return Ok(out) };
    let mut ids: Vec<String> = rd
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| id_ok(n).is_ok())
        .collect();
    ids.sort();
    ids.reverse();
    for id in ids {
        if let Ok(b) = fs::read(dir.join(&id).join("version.json")) {
            if let Ok(mut v) = serde_json::from_slice::<serde_json::Value>(&b) {
                if let Some(o) = v.as_object_mut() {
                    o.insert("id".into(), serde_json::Value::String(id.clone()));
                }
                out.push(v);
            }
        }
    }
    Ok(out)
}

// ------------------------------------------------------------ the network

fn door(url: &str) -> Result<String, String> {
    let u = url.trim().trim_end_matches('/');
    if !(u.starts_with("https://") || u.starts_with("http://")) {
        return Err(format!("{url:?} is not the door's address"));
    }
    Ok(u.to_string())
}

fn get_bytes(agent: &ureq::Agent, url: &str, pass: &str) -> Result<Vec<u8>, String> {
    let r = agent
        .get(url)
        .set("Authorization", &format!("Bearer {pass}"))
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("http {code}: {url}"),
            other => format!("no answer: {other}"),
        })?;
    let mut buf = Vec::new();
    r.into_reader()
        .take(MAX_FILE + 1)
        .read_to_end(&mut buf)
        .map_err(|e| format!("no answer: {e}"))?;
    if buf.len() as u64 > MAX_FILE {
        return Err(format!("too big: {url}"));
    }
    Ok(buf)
}

fn roots<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> (PathBuf, PathBuf) {
    let data = app.path().app_data_dir().expect("no app data dir");
    (data.join(VERSIONS_DIR), data.join(crate::BOOKS_DIR))
}

#[tauri::command]
pub async fn cloud_version_save<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    pass: String,
    id: String,
    slug: String,
) -> Result<Saved, String> {
    id_ok(&id)?;
    slug_ok(&slug)?;
    let base = door(&url)?;
    let (versions, books) = roots(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new().timeout(Duration::from_millis(TIMEOUT_MS)).build();
        let doc: serde_json::Value = serde_json::from_slice(&get_bytes(&agent, &format!("{base}/make/{id}"), &pass)?)
            .map_err(|e| format!("the door's answer is not JSON -- {e}"))?;
        if doc.get("state").and_then(|s| s.as_str()) != Some("done") {
            return Err(format!("{id} is {} in the cloud, not done", doc.get("state").and_then(|s| s.as_str()).unwrap_or("?")));
        }
        let files: Vec<String> = doc
            .get("files")
            .and_then(|f| f.as_array())
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let mut get = |rel: &str| get_bytes(&agent, &format!("{base}/make/{id}/file/{rel}"), &pass);
        let saved = save_with(&versions, &books, &slug, &id, &files, &mut get)?;
        log::info!("frank: cloud_version_save {slug}/{id} -- {} files, placed {:?}, kept {:?}",
                   saved.files, saved.placed, saved.kept);
        Ok(saved)
    })
    .await
    .map_err(|e| format!("no answer: {e}"))?
}

#[tauri::command]
pub fn cloud_version_use<R: tauri::Runtime>(app: tauri::AppHandle<R>, slug: String, id: String) -> Result<Used, String> {
    let (versions, books) = roots(&app);
    use_version(&versions, &books, &slug, &id)
}

#[tauri::command]
pub fn cloud_versions<R: tauri::Runtime>(app: tauri::AppHandle<R>, slug: String) -> Result<Vec<serde_json::Value>, String> {
    let (versions, _) = roots(&app);
    list(&versions, &slug)
}

/// The page's door to the three commands, on every page in Frank (guarded like `BOOKS_JS`: a page
/// outside Frank has no `__TAURI__` and gets nothing). `TTSTVHost.cloudVersions`.
pub const CLOUD_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  window.TTSTVHost.cloudVersions = {
    save: function (url, pass, id, slug) { return TAURI.invoke("cloud_version_save", { url: url, pass: pass, id: id, slug: slug }); },
    use: function (slug, id) { return TAURI.invoke("cloud_version_use", { slug: slug, id: id }); },
    list: function (slug) { return TAURI.invoke("cloud_versions", { slug: slug }); }
  };
})();"#;

#[cfg(test)]
mod cloud_tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("frank-cloud-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn version_files() -> Vec<String> {
        ["audio/c001.m4a", "audio/c001.engine.json", "timings/c001.json", "audio/c002.m4a", "version.json"]
            .iter().map(|s| s.to_string()).collect()
    }

    fn getter(tag: &'static str) -> impl FnMut(&str) -> Result<Vec<u8>, String> {
        move |rel: &str| {
            if rel == "version.json" {
                Ok(br#"{"name":"tester","chapters":{"c001":{},"c002":{}}}"#.to_vec())
            } else {
                Ok(format!("{tag}:{rel}").into_bytes())
            }
        }
    }

    #[test]
    fn ids_and_files_are_the_doors_own_names() {
        assert!(id_ok("make-1a2b3c").is_ok() && id_ok("read-00ff00aa").is_ok());
        for bad in ["make-", "make-XYZ123", "scan-123456", "../make-123456", "make-1234567890abcdef0"] {
            assert!(id_ok(bad).is_err(), "{bad}");
        }
        for ok in ["version.json", "read_by.json", "audio/c001.m4a", "audio/c0012.engine.json", "timings/c001.json"] {
            assert!(rel_ok(ok).is_ok(), "{ok}");
        }
        for bad in ["../x", "audio/c001.wav", "audio/../../x.m4a", "timings/c001.txt", "request.json", "audio/x.m4a", "/etc/passwd"] {
            assert!(rel_ok(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_saved_version_plays_where_the_chapter_had_no_audio_and_is_kept_where_it_had() {
        let root = tmp("save");
        let (versions, books) = (root.join("versions"), root.join("books"));
        fs::create_dir_all(books.join("short").join("audio")).unwrap();
        fs::write(books.join("short").join("audio").join("c002.opus"), b"the mac's").unwrap();
        let s = save_with(&versions, &books, "short", "make-0000aa", &version_files(), &mut getter("A")).unwrap();
        assert_eq!(s.placed, vec!["c001".to_string()]);
        assert_eq!(s.kept, vec!["c002".to_string()]);
        assert_eq!(fs::read(books.join("short/audio/c001.m4a")).unwrap(), b"A:audio/c001.m4a");
        assert_eq!(fs::read(books.join("short/timings/c001.json")).unwrap(), b"A:timings/c001.json");
        assert_eq!(fs::read(books.join("short/audio/c002.opus")).unwrap(), b"the mac's");
        assert!(!books.join("short/audio/c002.m4a").exists());
        assert!(versions.join("short/make-0000aa/audio/c002.m4a").is_file());
        // the same id again is refused, and nothing it would have written is written
        let again = save_with(&versions, &books, "short", "make-0000aa", &version_files(), &mut getter("B"));
        assert!(again.unwrap_err().contains("never written twice"));
        assert_eq!(fs::read(versions.join("short/make-0000aa/audio/c001.m4a")).unwrap(), b"A:audio/c001.m4a");
        // an unfinished version (no version.json) and a path out of the folder are refused
        assert!(save_with(&versions, &books, "short", "make-0000bb", &["audio/c001.m4a".into()], &mut getter("C")).is_err());
        assert!(save_with(&versions, &books, "short", "make-0000cc", &["version.json".into(), "../../x".into()], &mut getter("C")).is_err());
        assert!(!versions.join("short/make-0000cc").exists());
    }

    #[test]
    fn using_a_version_moves_what_played_aside_and_deletes_nothing() {
        let root = tmp("use");
        let (versions, books) = (root.join("versions"), root.join("books"));
        fs::create_dir_all(books.join("short")).unwrap();
        save_with(&versions, &books, "short", "make-0000aa", &version_files(), &mut getter("A")).unwrap();
        save_with(&versions, &books, "short", "make-0000bb", &version_files(), &mut getter("B")).unwrap();
        assert_eq!(fs::read(books.join("short/audio/c001.m4a")).unwrap(), b"A:audio/c001.m4a");
        let u = use_version(&versions, &books, "short", "make-0000bb").unwrap();
        assert_eq!(u.placed, vec!["c001".to_string(), "c002".to_string()]);
        assert_eq!(fs::read(books.join("short/audio/c001.m4a")).unwrap(), b"B:audio/c001.m4a");
        let aside = versions.join("short").join(u.moved.unwrap());
        assert_eq!(fs::read(aside.join("audio/c001.m4a")).unwrap(), b"A:audio/c001.m4a");
        // both versions are still whole
        assert!(versions.join("short/make-0000aa/audio/c001.m4a").is_file());
        assert!(versions.join("short/make-0000bb/audio/c001.m4a").is_file());
        let l = list(&versions, "short").unwrap();
        assert_eq!(l.len(), 2);
        assert_eq!(l[0]["id"], "make-0000bb");
        assert!(use_version(&versions, &books, "short", "make-0000ff").unwrap_err().contains("not on this phone"));
    }

    #[test]
    fn the_door_on_the_page_is_three_invokes() {
        assert_eq!(CLOUD_JS.matches("TAURI.invoke(").count(), 3);
        assert!(CLOUD_JS.contains("\"cloud_version_save\"") && CLOUD_JS.contains("\"cloud_version_use\"")
            && CLOUD_JS.contains("\"cloud_versions\""));
    }
}
