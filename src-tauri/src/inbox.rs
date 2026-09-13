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
/// `gen/apple/frank_iOS/frank_iOS.entitlements`,
/// `gen/apple/FrankShare/FrankShare.entitlements`,
/// `gen/apple/FrankShare/ShareViewController.swift`, and here.
/// `inbox_tests::the_group_id_is_the_same_in_every_file` holds them equal.
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
            // one -- the same rule the book door keeps in `lib.rs`.
            let mut payload: Option<(String, u64)> = None;
            if let Ok(inner) = fs::read_dir(&here) {
                for e in inner.flatten() {
                    let name = e.file_name().to_string_lossy().to_string();
                    if skip(&name) || name == SOURCE_JSON || name.ends_with(".part") {
                        continue;
                    }
                    if let Ok(m) = e.metadata() {
                        if m.is_file() {
                            payload = Some((name, m.len()));
                            break;
                        }
                    }
                }
            }
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
            "gen/apple/frank_iOS/frank_iOS.entitlements",
            "gen/apple/FrankShare/FrankShare.entitlements",
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
        eprintln!("the group id agreed in {checked} of 3 files present");
    }

    #[test]
    fn every_code_frank_inbox_can_return_has_a_sentence() {
        for code in [0, 2, 3, 4, 5] {
            assert_ne!(root_why(code), "unknown frank_inbox result", "code {code}");
        }
        assert_eq!(root_why(99), "unknown frank_inbox result");
    }
}
