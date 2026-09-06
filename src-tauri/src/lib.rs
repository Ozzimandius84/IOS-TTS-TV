// MOVED, NOT REWRITTEN. This file came here from TTSTV
// `Frank/src-tauri/src/lib.rs` at commit `83da179` and is byte-identical to it
// below this block -- the four fixes the phone needed (the stamp is a
// fingerprint of what was embedded, the home page must be on disk before that
// stamp is believed, an empty embed is an error with a sentence rather than a
// silent 0, and the asset count is logged at Info) all landed in that commit,
// on the evening of 5 Sep, and none of them is new here.
//
// One thing the prose below is no longer literally right about: it says
// `Frank/dist/`, which was the staged tree in the old repo. Here the shell is
// COMMITTED as `shell/` and `tools/prebuild.py` verifies it rather than
// staging it, so `frontendDist` is `../shell`. Everything else -- the scheme,
// the origin arithmetic, the unpack, the dev fallback -- is unchanged, and the
// old spellings are left alone so a diff against TTSTV stays readable.
//
// `Frank/` in TTSTV stays the DESKTOP thin client. The phone is here.

//! Frank, the thin client: one window, the app shell, and no Python anywhere.
//!
//! 5 Sep. `desktop/SHIPPING.md` 8b split one app into two. Studio (route A) is
//! `desktop/`: a tab strip, a native menu bar, tear-off windows, and a
//! `studio serve` child process it has to find a python3 for. Frank (route C)
//! is this: the sold app, the phone, Windows -- a tightly wrapped shell that
//! talks to the cloud and has no local door to close.
//!
//! It is `desktop/src-tauri/src/mobile.rs` made a desktop target too, not a new
//! idea. `mobile.rs` (4 Sep) already proved the shape: do not reuse `lib::run`,
//! start from nothing, ask for one window, and let `frontendDist` carry the
//! reader *inside* the bundle. What is added here is the second half of the
//! same sentence -- the origin the shell is served from.
//!
//! # Why a custom scheme and not `WebviewUrl::App`
//!
//! Tauri's own asset protocol would serve these files perfectly well, at
//! `tauri://localhost/library/library.html`. The reason not to take it is that
//! the shell is not Frank's; it is the PWA's, byte-for-byte, the same files
//! `reader/sw.js` caches and `reader/tools/publish_shell.py` publishes. Those
//! pages fetch each other by relative path and register a service worker by
//! relative path, and the phone shell, the browser and this app have to be
//! able to disagree about *nothing*. So Frank serves them from an origin of its
//! own -- `frank://localhost/` -- whose paths are the site's paths:
//!
//! ```text
//!   PWA     https://<host>/library/library.html   fetch("../reader/keys.js")
//!   Frank   frank://localhost/library/library.html   ... the same request path
//! ```
//!
//! A URL that is byte-identical below the origin is what lets one bug be found
//! once. `tauri://localhost` would have been identical too -- but it is also
//! the origin Tauri's own IPC lives on, and Frank grants the shell no IPC at
//! all (`capabilities/default.json`). A scheme of our own says that in the
//! address rather than in a comment.
//!
//! On Windows and Android a custom scheme is reached as
//! `http://frank.localhost/...` (wry's rule, not ours -- see
//! `shell_origin` below); the path half is unchanged, which is the half the
//! pages care about.
//!
//! # Why the files are unpacked to the data dir first
//!
//! `frontendDist` embeds the staged shell in the binary, and the handler could
//! read it back out of the embedded assets on every request. It writes them to
//! the app's data directory once instead, and serves from there, because that
//! directory is where the *books* are going: sync (not today) puts a
//! `.frank/` object store beside this folder, and a reader that fetches
//! `frank://localhost/books/<slug>/book.json` will want one handler, one root
//! and one set of path rules -- not a second scheme bolted on later. Today
//! nothing but the shell is under that root, so today the app opens empty,
//! which is exactly what it is meant to do.
//!
//! The unpack is stamped with a fingerprint of what was embedded -- how many
//! assets and a hash of their names and bytes -- so a launch after the first
//! copies nothing, and a build carrying a different shell rewrites the tree.
//! It used to be stamped with the app version, and that is the whole of the
//! bug of 5 Sep: a launch that unpacked *nothing* wrote `0.1.0` and every
//! launch after it believed the stamp.
//!
//! # `tauri dev` embeds no assets, and that is not a bug in Tauri
//!
//! `frontendDist` is a directory, so `tauri ios dev` starts its own static dev
//! server and sets `devUrl` to it; `tauri-codegen` then embeds an EMPTY asset
//! set (`context.rs`: `dev && config.build.dev_url.is_some()`), because
//! re-embedding 55 files on every rebuild would be waste. Tauri's own
//! `AssetResolver::get` covers itself for that case by reading `frontendDist`
//! off disk instead -- but `iter()`, which is what an unpack needs, does not,
//! and returns nothing. So in dev the handler falls back to `get()` for the
//! same file (`#[cfg(dev)]`, below), which is the same second source Tauri
//! uses; in release there is exactly one source, the data dir.

use std::borrow::Cow;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{Manager, UriSchemeContext, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_deep_link::DeepLinkExt;

/// The scheme. One word, and it is in three places that must agree: here, the
/// window URL built by [`shell_url`], and `tauri.conf.json`'s CSP (which is
/// `null` -- so, two).
const SCHEME: &str = "frank";

/// Where the served tree lives under the app's data directory. A folder and not
/// the data dir itself, because sync's object store is going to want its own.
const SHELL_DIR: &str = "shell";

/// The page the one window opens on. The Library is the app -- there is no
/// chrome to open first, and `index.html` (the redirect `tools/prebuild.py`
/// writes) exists only so the bundle has a root.
const HOME_PAGE: &str = "library/library.html";

/// The stamp file, beside the unpacked tree. It was `.version` and held the app
/// version; the name changed with the meaning, and the old file goes with the
/// first re-unpack because that clears the root.
const STAMP: &str = ".shell";

/// The origin the shell is served from, spelled the way the platform's webview
/// spells it. wry maps a custom scheme to `http://<scheme>.localhost` on
/// Windows and Android and leaves it as `<scheme>://localhost` everywhere else;
/// Tauri's own manager does the same arithmetic when it computes a window's
/// origin (`tauri::manager::webview`). Getting this wrong does not fail loudly
/// -- the window opens blank -- so it is one function with one caller.
fn shell_origin() -> &'static str {
    #[cfg(any(windows, target_os = "android"))]
    {
        "http://frank.localhost"
    }
    #[cfg(not(any(windows, target_os = "android")))]
    {
        "frank://localhost"
    }
}

fn shell_url(path: &str) -> String {
    format!("{}/{}", shell_origin(), path)
}

// ------------------------------------------------------------------- sync
//
// Job 26 (Osca, 6 Sep): *"a Sync button in both, in the Settings"*. The
// button is the shell's (`settings/settings.js`, the same file the Mac runs)
// and everything it does is `fetch` against the Studio it paired with --
// pull the manifest, pull the files, push the marks and the position. The
// ONE thing a page cannot do for itself is find Studio: a webview has no
// multicast socket. So this crate offers exactly one command, `sync_discover`,
// which browses `_ttstv._tcp` for a moment and answers what it saw, and
// injects a `window.TTSTVHost` with one method that calls it. Pairing, the
// token, the store, the merge: none of it is here. The phone's half of sync
// is a browse and forty lines.

/// The service `studio/sync.py::Advert` registers, and the one
/// `NSBonjourServices` (gen/apple/project.yml) lets this app see.
pub const SYNC_SERVICE: &str = "_ttstv._tcp.local.";

/// How long a browse waits for answers. A Studio on the same network answers
/// its first query inside a few hundred milliseconds; the rest is for a
/// sleepy Wi-Fi radio. The page's own timeout (`settings.js`,
/// `SYNC_DISCOVER_MS` + 1500) sits above this so it is this answer, not a
/// race, that the row prints.
pub const SYNC_BROWSE_MS: u64 = 2500;

/// One Studio, as the row's picker draws it: `name` is what the advert
/// called itself ("Osca's MacBook Air Studio"), `host` an address the phone
/// can reach it at, `port` the LAN listener's.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Studio {
    pub name: String,
    pub host: String,
    pub port: u16,
}

/// The page's view of the browse: `sync_discover(ms)` -> `[Studio]`, at most
/// one per advertised name, IPv4 first. `ms` is clamped to
/// `[500, 3 * SYNC_BROWSE_MS]` so a page cannot hold the radio open.
#[tauri::command]
fn sync_discover(ms: Option<u64>) -> Result<Vec<Studio>, String> {
    let wait = Duration::from_millis(ms.unwrap_or(SYNC_BROWSE_MS).clamp(500, 3 * SYNC_BROWSE_MS));
    let daemon = mdns_sd::ServiceDaemon::new().map_err(|e| format!("mDNS: {e}"))?;
    let rx = daemon.browse(SYNC_SERVICE).map_err(|e| format!("mDNS browse: {e}"))?;
    let mut found: BTreeMap<String, Studio> = BTreeMap::new();
    let end = Instant::now() + wait;
    while let Some(left) = end.checked_duration_since(Instant::now()).filter(|d| !d.is_zero()) {
        match rx.recv_timeout(left) {
            Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) => {
                if let Some(studio) = studio_of(&info) {
                    found.entry(studio.name.clone()).or_insert(studio);
                }
            }
            Ok(_) => continue,
            Err(_) => break,
        }
    }
    let _ = daemon.stop_browse(SYNC_SERVICE);
    let _ = daemon.shutdown();
    Ok(found.into_values().collect())
}

/// A resolved advert -> the row's `Studio`, preferring an IPv4 address (the
/// page prints it, and `http://[fe80::…%en0]` is not a thing a person
/// types). `None` when the advert carried no address at all.
fn studio_of(info: &mdns_sd::ServiceInfo) -> Option<Studio> {
    let mut v4 = None;
    let mut v6 = None;
    for a in info.get_addresses() {
        match a {
            std::net::IpAddr::V4(ip) => {
                if v4.is_none() {
                    v4 = Some(ip.to_string());
                }
            }
            std::net::IpAddr::V6(ip) => {
                if v6.is_none() {
                    v6 = Some(format!("[{ip}]"));
                }
            }
        }
    }
    Some(Studio {
        name: studio_name(info.get_fullname(), info.get_property_val_str("name")),
        host: v4.or(v6)?,
        port: info.get_port(),
    })
}

/// The name the row prints: the advert's `name` TXT when it carries one,
/// else the instance name cut off the full name
/// (`Air Studio._ttstv._tcp.local.` -> `Air Studio`).
fn studio_name(fullname: &str, txt: Option<&str>) -> String {
    if let Some(n) = txt.filter(|n| !n.is_empty()) {
        return n.to_string();
    }
    fullname
        .strip_suffix(SYNC_SERVICE)
        .map(|s| s.trim_end_matches('.'))
        .unwrap_or(fullname)
        .to_string()
}

/// `window.TTSTVHost`, injected into every page this app opens -- the
/// desktop app's shape (`desktop/src/host.js`), one method wide. The shell
/// checks for it and works without it: a page that is not in Frank simply
/// finds no Studios and offers the address field instead.
pub const HOST_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  /* the Bonjour browse behind the Transfer tab's Sync button (job 26) */
  window.TTSTVHost.syncDiscover = function (ms) { return TAURI.invoke("sync_discover", { ms: ms }); };
  window.TTSTVHost.deviceName = "Frank on this phone";
})();
"#;

/// The writer of [`PAIR_KEY`], and it is injected separately from [`HOST_JS`]
/// on purpose: **it must exist on a page that is not in Frank.**
///
/// `HOST_JS` returns early where there is no `__TAURI__`, because everything in
/// it is a command and a command needs one. This is not a command. Settings >
/// Transfer writes the same key from a typed address on the Mac, in a browser,
/// in the simulator's dev server -- everywhere -- and the shell should not have
/// to carry a second copy of the fingerprint rule for the case where Frank is
/// not the one writing. So the function is defined unconditionally and the page
/// may use it or not.
///
/// `fp` is computed here rather than carried: eight hex of sha256(pass), the
/// same eight `deploy_to_my_modal.py::fingerprint` puts on the Mac's screen,
/// through the same `crypto.subtle.digest("SHA-256", …)` `library/import.js`
/// hashes a book's word ids with. A person compares two short strings across a
/// room; nothing else uses it, and the pass itself is never drawn.
///
/// The `ttstv:pairing` event is so a Transfer tab that is already open redraws.
/// A page that does not listen is unaffected -- the key is written either way.
pub const PAIR_JS: &str = r#"(function () {
  "use strict";
  window.TTSTVHost = window.TTSTVHost || {};
  var KEY = "transfer.pairing";
  window.TTSTVHost.PAIR_KEY = KEY;
  window.TTSTVHost.pairWrite = function (f) {
    var pass = String((f && f.pass) || "");
    if (!f || !f.url || !pass) return Promise.reject(new Error("a pairing needs an address and a pass"));
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(pass)).then(function (buf) {
      var fp = Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, "0"); }).join("").slice(0, 8);
      var row = {
        v: f.v || 1,
        url: String(f.url),
        pass: pass,
        workspace: String(f.workspace || ""),
        app: String(f.app || "ttstv-cloud"),
        fp: fp,
        made: f.made || Math.floor(Date.now() / 1000)
      };
      localStorage.setItem(KEY, JSON.stringify(row));
      try {
        window.dispatchEvent(new CustomEvent("ttstv:pairing", { detail: { fp: fp, url: row.url } }));
      } catch (e) {}
      return fp;
    });
  };
  window.TTSTVHost.pairRead = function () {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  };
})();
"#;

// ------------------------------------------------------------ the pairing
//
// A phone that is going to send a book somewhere to be parsed and voiced has
// to be told WHERE and WITH WHAT. `cloud/tools/deploy_to_my_modal.py::pairing`
// (TTSTV, job 23b) settles what that is -- seven fields, one object -- and
// settles that it is carried across the room rather than signed in to: the
// Mac shows a square, the phone's camera reads it, and the customer's own
// Modal workspace is never touched by anything of ours.
//
// THE PHONE MUST NOT BE ABLE TO TELL THE BACKENDS APART. `url` is a deployed
// Modal door, or Frank Studio's own door on the LAN (job 23c, the Kaggle lane
// and the no-account path), and the four calls are byte-for-byte the same
// against either. So nothing here reads `url` for meaning beyond "is it http",
// and there is no `backend` branch in this file. One client, one pairing shape.
//
// WHAT THIS CRATE DOES, AND THE ONE THING IT DOES NOT. It owns the LINK: the
// scheme, the URL type, the parse, and the write into the one key. It does not
// own the calls -- `library/transfer.js` (TTSTV, the sync lane) is one client
// for the Mac and the phone, and it reads the same key. And it does not own
// the Pair FIELD: that is Settings > Transfer, the shell's own page, and it
// writes this key by hand from an address and a pass typed in. Two writers,
// one key, and the key is the whole contract between them.

/// The launch scheme, and it is deliberately **not** [`SCHEME`].
///
/// `frank://` is this app's ASSET scheme -- the thing `register_uri_scheme_protocol`
/// answers with the shell's own files. A launch scheme is a different job: the
/// OS hands it to the app from outside. Declaring one word for both would mean
/// the system camera could ask the app to open `frank://localhost/...`, which
/// is a request to render an arbitrary path of the served tree from a QR code
/// somebody else printed. One word, one job.
///
/// It is in three places that must agree, and a test holds each: here,
/// `tauri.conf.json`'s `plugins.deep-link.mobile` (which is what the plugin's
/// own build script writes `CFBundleURLTypes` from), and
/// `gen/apple/project.yml` (which is what an `xcodegen` regeneration puts back
/// into the Info.plist the build script edits).
pub const PAIR_SCHEME: &str = "frank-pair";

/// The version this build understands, and the `v` of the object it writes.
pub const PAIR_V: u32 = 1;

/// The one key in the shell's `localStorage`. **The contract.** Settings >
/// Transfer writes it from a typed address and pass; this file writes it from
/// a scanned link; `library/transfer.js` reads it and nothing else.
pub const PAIR_KEY: &str = "transfer.pairing";

/// The app name a link may omit -- `cloud/endpoint.py::APP_NAME`'s own value,
/// which is what `pairing()` defaults to on the Mac.
pub const PAIR_APP: &str = "ttstv-cloud";

/// What a link carries. `fp` is **not** here and is not carried: it is eight
/// hex of sha256(pass) (`deploy_to_my_modal.py::fingerprint`), so a link that
/// carried it could disagree with its own pass. It is computed at the write,
/// in the page, by the same `crypto.subtle` `library/import.js` hashes a book
/// with.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Pairing {
    pub v: u32,
    pub url: String,
    pub pass: String,
    pub workspace: String,
    pub app: String,
    pub made: u64,
}

/// `frank-pair://v1?url=…&pass=…&workspace=…&app=…&made=…` -> [`Pairing`].
///
/// Hand-parsed, on the string, with this file's own [`percent_decode`] -- not
/// through `url::Url`, though the plugin hands one over. Two reasons and both
/// are practical: it keeps the whole of the decision dependency-free, so it is
/// provable by extraction in a shell with no Xcode and no phone (`STATUS.md`
/// §2); and `url::Url` normalises a non-special scheme's authority in ways
/// that would make `v1` and `V1` and `v1.` one thing, when the version segment
/// is the one part of this link that must be read exactly as sent.
///
/// Every refusal is a sentence, because the only place a bad link is seen is a
/// person's phone.
pub fn parse_pair_link(link: &str) -> Result<Pairing, String> {
    let prefix = format!("{PAIR_SCHEME}://");
    let rest = match link.len() >= prefix.len()
        && link[..prefix.len()].eq_ignore_ascii_case(&prefix)
    {
        true => &link[prefix.len()..],
        false => {
            return Err(format!(
                "this is not a Frank pairing link (it does not start {prefix})"
            ))
        }
    };
    let (authority, query) = match rest.find('?') {
        Some(i) => (&rest[..i], &rest[i + 1..]),
        None => (rest, ""),
    };
    // `v1` or `v1/` -- a trailing slash is what some readers add and it means
    // nothing here.
    let ver = authority.trim_end_matches('/');
    let n: u32 = match ver.strip_prefix('v').and_then(|d| d.parse().ok()) {
        Some(n) => n,
        None => return Err(format!("{ver:?} is not a pairing-link version")),
    };
    if n > PAIR_V {
        // The same sentence `library/import.js` says to a book from a newer
        // parser, for the same reason: the remedy is the app, not the link.
        return Err(format!(
            "this pairing link is version {n}; Frank knows up to {PAIR_V} — update the app"
        ));
    }
    let mut url = String::new();
    let mut pass = String::new();
    let mut workspace = String::new();
    let mut app = String::new();
    let mut made: u64 = 0;
    for pair in query.split('&').filter(|s| !s.is_empty()) {
        let (k, v) = match pair.find('=') {
            Some(i) => (&pair[..i], &pair[i + 1..]),
            None => (pair, ""),
        };
        // `+` is a space in a query string; percent_decode does not know that.
        let v = percent_decode(&v.replace('+', " "));
        match k {
            "url" => url = v,
            "pass" => pass = v,
            "workspace" => workspace = v,
            "app" => app = v,
            "made" => made = v.parse().unwrap_or(0),
            // Unknown keys are ignored, not refused: a later Mac may add one,
            // and `v` is what says whether this build can read the link at all.
            _ => {}
        }
    }
    if url.is_empty() {
        return Err("this pairing link carries no address".into());
    }
    // The one thing read for meaning. A link is a string a stranger can print
    // on a wall; `url` is about to be handed to `fetch` with a bearer token on
    // it, so anything that is not a plain http(s) address is refused here
    // rather than in the page.
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(format!("{url:?} is not an http address"));
    }
    if pass.is_empty() {
        return Err("this pairing link carries no pass".into());
    }
    Ok(Pairing {
        v: n,
        url,
        pass,
        workspace,
        app: if app.is_empty() { PAIR_APP.into() } else { app },
        made,
    })
}

/// One JSON string literal, quotes and all. Hand-rolled for the same reason
/// [`percent_decode`] is: this file has no `serde_json` and does not want one
/// for six fields. Escapes what JSON requires plus `<` and `/`, so the result
/// is safe inside a `<script>` as well as inside an `eval`.
pub fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '<' => out.push_str("\\u003c"),
            '>' => out.push_str("\\u003e"),
            '&' => out.push_str("\\u0026"),
            '/' => out.push_str("\\/"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// The call that writes the key, as JavaScript. The writer itself is
/// [`HOST_JS`]'s `pairWrite` -- this is only the call, with the five carried
/// values quoted into it. Nothing is concatenated into a string the page then
/// parses; every value goes through [`json_string`].
pub fn pair_write_js(p: &Pairing) -> String {
    format!(
        "window.TTSTVHost && window.TTSTVHost.pairWrite && window.TTSTVHost.pairWrite({{\
v:{},url:{},pass:{},workspace:{},app:{},made:{}}});",
        p.v,
        json_string(&p.url),
        json_string(&p.pass),
        json_string(&p.workspace),
        json_string(&p.app),
        p.made,
    )
}

/// A link that arrived before there was a document to write it into.
///
/// Two ways in and they need different handling. A **cold** open -- the app was
/// launched BY the link -- is `get_current()` in `setup`, at which point the
/// window does not exist yet, let alone a page. A **warm** open -- the app was
/// already running -- is `on_open_url`, and there a document is loaded and
/// `eval` reaches it. So both put the pairing here, `on_page_load` drains it,
/// and the warm path additionally evals straight away so the field the person
/// is looking at redraws without a navigation. Draining is what makes the
/// double write harmless: whichever gets there first empties it.
#[derive(Default)]
pub struct PendingPair(pub Mutex<Option<Pairing>>);

/// Turn a request path into a path under `root`, or `None` if it tries to leave.
///
/// The check is on the *components*, before any filesystem call: a `..` or a
/// rooted component is refused outright rather than resolved and compared.
/// `canonicalize` would be the other way to do it and is worse here -- it
/// answers about symlinks on the user's disk, and it cannot answer at all for a
/// path that does not exist, which is every 404.
fn resolve(root: &Path, request_path: &str) -> Option<PathBuf> {
    // One copy of the two defaults -- `/` means the index, and `%20` is a
    // space -- shared with [`site_path`], which is the same request path spelt
    // the way the asset keys spell it. Two copies drifting is how the handler
    // and the dev fallback would come to disagree about which file was asked
    // for, which is a bug that looks like a missing file.
    let decoded = site_path(request_path);
    let decoded = decoded.trim_start_matches('/');
    let mut out = root.to_path_buf();
    for c in Path::new(&decoded).components() {
        match c {
            Component::Normal(part) => out.push(part),
            // `/a/./b` is fine and means `/a/b`.
            Component::CurDir => {}
            // Everything else -- `..`, a root, a Windows drive prefix -- is a
            // request to leave the served tree, and there is no legitimate one.
            _ => return None,
        }
    }
    Some(out)
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                out.push((hi * 16 + lo) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// The content type for a file of the shell, by extension.
///
/// Every extension the app shell actually contains is named here, and
/// `tests/test_frank_shell.py` holds this list equal to the extensions in
/// `reader/sw.js`'s `SHELL_FILES` -- so a shell that gains a `.svg` or a
/// `.woff2` fails a test rather than shipping as `application/octet-stream`,
/// which a webview would refuse to execute and a reader would see as a blank
/// page. That is the whole reason this is a match and not a fallback.
fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("webmanifest") => "application/manifest+json; charset=utf-8",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("woff2") => "font/woff2",
        Some("wav") => "audio/wav",
        Some("opus") => "audio/ogg",
        Some("mp3") => "audio/mpeg",
        _ => "application/octet-stream",
    }
}

/// FNV-1a. Six lines rather than `DefaultHasher` because this value is written
/// to a file and read back by a later launch, and `DefaultHasher`'s output is
/// explicitly not stable across Rust versions -- a stamp that changed when the
/// toolchain did would re-unpack for no reason and hide the case where the
/// shell really did change.
fn fnv1a(mut h: u64, bytes: &[u8]) -> u64 {
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

/// What was embedded: the count, and a hash over every asset's name and bytes.
///
/// Names alone would have caught the bug in front of us and not the next one:
/// editing `library.html` without renaming it leaves the key set identical, and
/// a silently stale page is the expensive kind of wrong. Hashing the bytes as
/// well is one pass over 1.5 MB at launch, which is not a cost worth having an
/// opinion about.
fn fingerprint(assets: &[(String, Vec<u8>)]) -> String {
    let mut ordered: Vec<&(String, Vec<u8>)> = assets.iter().collect();
    ordered.sort_by(|a, b| a.0.cmp(&b.0));
    let mut h = 0xcbf2_9ce4_8422_2325_u64;
    for (key, bytes) in ordered {
        h = fnv1a(h, key.as_bytes());
        h = fnv1a(h, &bytes.len().to_le_bytes());
        h = fnv1a(h, bytes);
    }
    format!("{}-{:016x}", assets.len(), h)
}

/// Does this look like the page the window is about to be pointed at?
///
/// The narrowest check that catches the Brotli bug and nothing else: after a
/// BOM and any leading whitespace, the first byte of an HTML file is `<`. A
/// Brotli stream has no magic number to test for -- a real
/// `brotli.compress(<!doctype html>…)` starts `1b d1 02 40`, and the first byte
/// is a window-size header that varies -- so the test is written the way round
/// that has a true answer: *this is HTML*, never *this is not Brotli*.
///
/// It is not a parser and must not become one. It runs once, on one file, to
/// turn "the Library is a page of glyphs on a phone" into a sentence.
fn looks_like_html(bytes: &[u8]) -> bool {
    let rest = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes);
    matches!(
        rest.iter().find(|b| !b.is_ascii_whitespace()),
        Some(b'<')
    )
}

/// Why this build has no shell in it. There are exactly two reasons and they
/// want opposite fixes, so the app has to say which one it is rather than
/// guess: one is a missing build step, the other is `tauri dev` behaving as
/// designed. Takes the `devUrl` rather than the app so it can be tested.
fn no_shell_reason(dev_url: Option<&str>) -> String {
    match dev_url {
        Some(url) => format!(
            "frank: the shell is not in this build -- `tauri dev` started its own dev server \
             ({url}) and set devUrl, and tauri-codegen embeds no assets at all when dev and \
             devUrl are both set. Re-run with `--no-dev-server`, or build."
        ),
        None => "frank: the shell is not in this build -- prebuild.py was not run before compile"
            .to_string(),
    }
}

/// What to say on the 404 page when the binary carries no shell at all.
///
/// This is reached only after the dev fallback has ALSO come up empty, so in
/// dev it knows one thing [`no_shell_reason`] does not: `frontendDist` has not
/// got the file either, which means `Frank/dist/` is empty or stale and the
/// answer is `prebuild.py` -- not `--no-dev-server`, which would embed the same
/// nothing. Outside dev there is no second place to have looked.
fn nothing_anywhere(dev_url: Option<&str>, path: &str) -> String {
    match dev_url {
        Some(url) => format!(
            "frank: no {path}. This build embeds no assets -- `tauri dev` set devUrl ({url}), \
             and tauri-codegen embeds nothing when it is set -- and the fallback read of \
             frontendDist has no {path} either. Run tools/prebuild.py."
        ),
        None => no_shell_reason(None),
    }
}

/// A request path as the asset keys spell it: leading slash, percent-decoded,
/// `/` meaning `/index.html`.
///
/// The two defaults live here and [`resolve`] calls this on its way to a
/// filesystem path, so the handler's disk lookup and the dev fallback's asset
/// lookup cannot come to disagree about which file was asked for. Percent-
/// decoding is the small decoder and not a dependency because the shell's own
/// names are ASCII; a book slug with a space in it later is the case it is for.
fn site_path(request_path: &str) -> String {
    let rel = request_path.trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    format!("/{}", percent_decode(rel))
}

/// Write the embedded shell into `root`, once per distinct shell.
///
/// `Err` is a sentence for a human, already prefixed `frank:`. It is not a
/// reason to stop the app: see the `setup` closure.
fn unpack_shell<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    root: &Path,
) -> Result<usize, String> {
    let resolver = app.asset_resolver();
    // `iter()` yields the bytes AS EMBEDDED, and a `tauri build` embeds them
    // Brotli-compressed -- written to disk as they came, library.html was a
    // .br stream served as text/html, which is the page of glyphs Osca's phone
    // showed on the first real build (6 Sep, 12:00). `get()` is the accessor
    // that decompresses (it is what the handler's own fallback uses), so the
    // keys come from `iter()` and every byte from `get()`. The fingerprint is
    // therefore over the decompressed bytes, the same in dev and build.
    let assets: Vec<(String, Vec<u8>)> = resolver
        .iter()
        .filter_map(|(k, _)| {
            let key = k.into_owned();
            resolver.get(key.clone()).map(|a| (key, a.bytes().to_vec()))
        })
        .collect();
    // Logged before anything can go wrong with it, and at Info, because "how
    // many files does this binary think it is carrying" is the first question
    // every one of these failures asks.
    log::info!("frank: {} embedded shell assets", assets.len());
    if assets.is_empty() {
        return Err(no_shell_reason(
            app.config().build.dev_url.as_ref().map(|u| u.as_str()),
        ));
    }
    // The `filter_map` above DROPS a key `get()` cannot resolve, and a shell
    // that is quietly one file short is the same class of fault as the one this
    // function was just fixed for. Every key came out of the map `get` looks in,
    // so this can only fire if the two halves of one resolver disagree -- but
    // that is a sentence worth having rather than a page that 404s later.
    //
    // (Worth knowing and not obvious from the name: on a miss
    // `AppManager::get_asset` does not stop, it tries `<key>.html`, then
    // `<key>/index.html`, then **`index.html`**. So a key that is not passed
    // back exactly as `iter()` yielded it does not come back `None` -- it comes
    // back as the home page, under the wrong name. Nothing here builds a key;
    // that is what keeps the chain unreachable.)
    let embedded = resolver.iter().count();
    if assets.len() != embedded {
        return Err(format!(
            "frank: the binary lists {embedded} assets and only {} could be read back \
             -- iter() and get() disagree, which is a Tauri-side fault, not a missing file",
            assets.len()
        ));
    }

    let want = fingerprint(&assets);
    let stamp = root.join(STAMP);
    // The stamp says what was once written, not what is still there -- a user
    // can delete files and a write can half-finish -- so the home page has to
    // be on disk before the stamp is believed.
    if fs::read_to_string(&stamp).ok().as_deref() == Some(want.as_str())
        && root.join(HOME_PAGE).is_file()
    {
        log::info!("frank: shell {want} already unpacked in {}", root.display());
        return Ok(assets.len());
    }

    let io = |what: &str, path: &Path, e: std::io::Error| {
        format!("frank: cannot {what} {} -- {e}", path.display())
    };
    if root.exists() {
        fs::remove_dir_all(root).map_err(|e| io("clear", root, e))?;
    }
    fs::create_dir_all(root).map_err(|e| io("create", root, e))?;
    let mut n = 0usize;
    for (key, bytes) in &assets {
        // Asset keys are absolute-ish site paths (`/library/library.css`).
        let Some(dst) = resolve(root, key) else {
            continue;
        };
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| io("create", parent, e))?;
        }
        fs::write(&dst, bytes).map_err(|e| io("write", &dst, e))?;
        n += 1;
    }
    // Belt to the stamp's braces: the one file the window is about to ask for.
    let home = root.join(HOME_PAGE);
    if !home.is_file() {
        return Err(format!(
            "frank: unpacked {n} files into {} and {HOME_PAGE} is not one of them",
            root.display()
        ));
    }
    // ...and that what landed is the PAGE and not a compressed copy of it. Read
    // BACK off disk rather than checked in memory: the bug of 6 Sep put the
    // right number of files in the right places and every one of them was a
    // Brotli stream, so the only check that would have caught it is this one,
    // made after the bytes are where the handler will find them.
    let head: Vec<u8> = fs::read(&home)
        .map_err(|e| io("read back", &home, e))?
        .into_iter()
        .take(64)
        .collect();
    if !looks_like_html(&head) {
        return Err(format!(
            "frank: unpacked {n} files into {} but {HOME_PAGE} does not begin with '<' \
             (first bytes {:02x?}) -- the embedded assets are Brotli-compressed and \
             something wrote iter()'s bytes where get()'s belong; see lib.rs's head",
            root.display(),
            &head[..head.len().min(8)],
        ));
    }
    fs::write(&stamp, &want).map_err(|e| io("write", &stamp, e))?;
    log::info!("frank: unpacked {n} shell files -> {}", root.display());
    Ok(n)
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

/// The page served instead of a file that is not there.
///
/// HTML and not `text/plain` because on a phone this is the entire user
/// interface when something has gone wrong, and it carries the three facts that
/// tell the two failures apart: what was asked for, where the shell was looked
/// for, and how many assets the binary is carrying.
fn not_here<R: tauri::Runtime>(app: &tauri::AppHandle<R>, root: &Path, path: &str) -> String {
    let n = app.asset_resolver().iter().count();
    let why = if n == 0 {
        nothing_anywhere(
            app.config().build.dev_url.as_ref().map(|u| u.as_str()),
            path,
        )
    } else {
        format!("frank: no {path} in the shell")
    };
    format!(
        "<!doctype html><meta name=viewport content=\"width=device-width\"><title>Frank</title>\
         <body style=\"font:15px/1.6 -apple-system,system-ui,sans-serif;margin:2rem;color:#222\">\
         <p>{}</p><p style=\"opacity:.65\">{n} embedded assets &middot; shell root <code>{}</code></p>",
        escape(&why),
        escape(&root.display().to_string()),
    )
}

/// The one entry point, on all four platforms.
///
/// `main.rs` calls this on desktop. On a phone there is no `main`: the
/// generated Xcode and Gradle projects link `frank_lib` as a static library and
/// call a C symbol, and `tauri::mobile_entry_point` is what emits it (it keeps
/// the function and adds `extern "C" fn start_app()` beside it). Without the
/// attribute the crate compiles for iOS perfectly well and then fails at the
/// *link* step with an undefined `_start_app` -- which is why it is here before
/// `ios init` rather than after the first red Xcode build.
///
/// `desktop/src-tauri` spells this as two functions because its mobile half is
/// a different app (`mobile.rs`, no tab strip, no server child). Frank's two
/// halves are the same app -- that is the whole claim of this crate -- so it is
/// one function with `cfg_attr` rather than two with `cfg`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync_discover])
        // The launch scheme (`frank-pair://`, NOT the asset scheme). The
        // plugin is what turns an OS open into an event on iOS, macOS and
        // Android; on the phone the scheme itself is declared in
        // `tauri.conf.json`'s `plugins.deep-link.mobile`, which the plugin's
        // own build script writes into `CFBundleURLTypes`.
        .plugin(tauri_plugin_deep_link::init())
        .manage(PendingPair::default())
        // `Wry` and not a generic `R`: `Builder::default()` is a
        // `Builder<Wry>`, and spelling it lets the closure's argument type be
        // written down rather than inferred through a `_`.
        .register_uri_scheme_protocol(SCHEME, |ctx: UriSchemeContext<'_, Wry>, request| {
            let app = ctx.app_handle();
            let root = shell_root(app);
            let path = request.uri().path().to_string();
            let disk = resolve(&root, &path);

            if let Some(p) = &disk {
                if let Ok(bytes) = fs::read(p) {
                    return http_response(200, content_type(p), bytes);
                }
            }

            // Dev only. `tauri dev` sets devUrl, so nothing is embedded and the
            // unpack above found nothing to write; Tauri's own
            // `AssetResolver::get` handles exactly this by reading
            // `frontendDist` off disk, and this is that same second source
            // rather than a second idea. `content_type` is ours either way --
            // the asset's own mime type is inferred from bytes and is not the
            // curated table `tests/test_frank_shell.py` holds to the shell.
            #[cfg(dev)]
            if let Some(p) = &disk {
                if let Some(asset) = app.asset_resolver().get(site_path(&path)) {
                    log::info!("frank: dev -- {path} served from frontendDist");
                    return http_response(200, content_type(p), asset.bytes);
                }
            }

            http_response(
                404,
                "text/html; charset=utf-8",
                not_here(app, &root, &path).into_bytes(),
            )
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // A COLD OPEN: the app was launched BY the link, so the URL is
            // already in the plugin's hand and there is no window yet. Held,
            // and `on_page_load` writes it into the first document there is.
            // `get_current` answers `Ok(None)` on a normal launch and `Err` on
            // a platform that has no such notion; neither is a fault here.
            match app.deep_link().get_current() {
                Ok(Some(urls)) => take_pair_links(app.handle(), urls.iter().map(|u| u.to_string())),
                Ok(None) => {}
                Err(why) => log::info!("frank: no launch link ({why})"),
            }

            // A WARM OPEN: the app was already running. A document is loaded,
            // so this writes the key now -- the Transfer field the person is
            // looking at redraws off `ttstv:pairing` without a navigation --
            // and still leaves it pending, because `on_page_load` drains and a
            // drained pending cannot be written twice.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                take_pair_links(&handle, event.urls().iter().map(|u| u.to_string()));
                flush_pair(&handle);
            });

            let root = shell_root(app.handle());
            match unpack_shell(app.handle(), &root) {
                Ok(n) => log::info!("frank: shell ready, {n} files"),
                // Deliberately not `?`. Returning Err here aborts `setup`, and
                // an aborted setup on a phone is a process that dies before it
                // draws anything -- the blank screen this change exists to
                // stop. Loud in the log, and the window opens anyway onto the
                // page that says the same sentence.
                Err(why) => log::error!("{why}"),
            }

            // `app.windows` is `[]` in tauri.conf.json: a window declared there
            // is opened before `setup` runs, which would race the unpack above
            // and paint a 404 on a first launch. One window, asked for here,
            // after the files exist. (`mobile.rs` asks for its window in
            // `setup` for the same shape of reason.)
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::CustomProtocol(shell_url(HOME_PAGE).parse()?),
            )
            .title("Frank")
            .initialization_script(HOST_JS)
            // Separate from HOST_JS, and unconditional -- see PAIR_JS's own
            // note. Both run before the document's own scripts, so a page that
            // reads the key at load reads a key a link has already written.
            .initialization_script(PAIR_JS)
            .inner_size(1100.0, 800.0)
            .min_inner_size(400.0, 400.0)
            // Every document, including the first: whatever a launch link left
            // pending is written here, once.
            .on_page_load(|window, _payload| flush_pair(window.app_handle()))
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Frank");
}

/// Keep the last pairing link of a batch, and say in the log what happened to
/// the rest. A batch is normally one URL; the OS may hand over several, and a
/// link that is not ours (or is malformed) is dropped with its reason rather
/// than failing the open -- an app that refuses to launch because a QR was
/// wrong is worse than one that launches unpaired.
fn take_pair_links<R: tauri::Runtime, I: Iterator<Item = String>>(app: &tauri::AppHandle<R>, urls: I) {
    for u in urls {
        match parse_pair_link(&u) {
            Ok(p) => {
                // The pass is in `p` and goes no further than the store. What
                // the log gets is the address and nothing else; a log is read
                // over a shoulder and copied into a bug report.
                log::info!("frank: pairing link for {}", p.url);
                if let Some(state) = app.try_state::<PendingPair>() {
                    if let Ok(mut slot) = state.0.lock() {
                        *slot = Some(p);
                    }
                }
            }
            Err(why) => log::warn!("frank: link ignored -- {why}"),
        }
    }
}

/// Write whatever is pending into the main window, and clear it. Safe to call
/// on every page load and on every open: an empty slot is a no-op, and the take
/// is what stops one link being written twice.
fn flush_pair<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let pending = app
        .try_state::<PendingPair>()
        .and_then(|s| s.0.lock().ok().and_then(|mut slot| slot.take()));
    let Some(p) = pending else { return };
    match app.get_webview_window("main") {
        Some(w) => {
            if let Err(why) = w.eval(pair_write_js(&p)) {
                log::error!("frank: could not write the pairing -- {why}");
            }
        }
        // No window yet (a link that arrived between setup and the build). Put
        // it back; the first page load takes it.
        None => {
            if let Some(state) = app.try_state::<PendingPair>() {
                if let Ok(mut slot) = state.0.lock() {
                    *slot = Some(p);
                }
            }
        }
    }
}

fn shell_root<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("no app data dir")
        .join(SHELL_DIR)
}

fn http_response(
    status: u16,
    content_type: &str,
    body: Vec<u8>,
) -> tauri::http::Response<Cow<'static, [u8]>> {
    tauri::http::Response::builder()
        .status(status)
        .header(tauri::http::header::CONTENT_TYPE, content_type)
        // The shell is one origin talking to itself, and it is the only thing
        // served here; a page that wants the network goes to the endpoint by
        // its own absolute URL and never through this handler.
        .header("Cache-Control", "no-store")
        .body(Cow::Owned(body))
        .expect("static response")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_host_object_calls_the_one_command_and_nothing_else() {
        // the page reaches the browse through window.TTSTVHost.syncDiscover
        // and the browse is the command build.rs declares
        assert!(HOST_JS.contains("window.TTSTVHost.syncDiscover"));
        assert!(HOST_JS.contains(r#"invoke("sync_discover""#));
        assert_eq!(HOST_JS.matches("invoke(").count(), 1, "one command, one call");
        assert!(HOST_JS.contains("const TAURI = window.__TAURI__ && window.__TAURI__.core")
            || HOST_JS.contains("var TAURI = window.__TAURI__ && window.__TAURI__.core"));
        assert!(HOST_JS.contains("if (!TAURI"), "a page outside Frank gets no host object");
    }

    #[test]
    fn the_service_is_the_one_studio_advertises_and_the_plist_allows() {
        assert_eq!(SYNC_SERVICE, "_ttstv._tcp.local.");
        let yml = include_str!("../gen/apple/project.yml");
        assert!(yml.contains("NSBonjourServices: [_ttstv._tcp]"));
        assert!(yml.contains("NSLocalNetworkUsageDescription:"));
        assert!(yml.contains("NSAllowsLocalNetworking: true"));
        let cap = include_str!("../capabilities/default.json");
        assert!(cap.contains(r#""allow-sync-discover""#));
        let build = include_str!("../build.rs");
        assert!(build.contains(r#"commands(&["sync_discover"])"#));
    }

    /// The 6 Sep phone bug, as an assertion. The Brotli bytes are real: they
    /// are the first eight of `brotli.compress(b"<!doctype html>...", 11)`,
    /// which is what `iter()` was handing the unpack.
    #[test]
    fn the_unpacked_home_page_must_begin_with_a_page() {
        assert!(looks_like_html(b"<!doctype html>\n<html lang=\"en\">"));
        assert!(looks_like_html(b"<!DOCTYPE html>"));
        assert!(looks_like_html(b"\n\n  <html>"), "leading whitespace is fine");
        assert!(looks_like_html(b"\xef\xbb\xbf<!doctype html>"), "and a BOM");

        // what the phone actually got
        assert!(!looks_like_html(&[0x1b, 0xd1, 0x02, 0x40, 0x2d, 0x0e, 0xec, 0x36]));
        assert!(!looks_like_html(b""), "an empty file is not a page");
        assert!(!looks_like_html(b"   "), "and neither is whitespace");
        assert!(!looks_like_html(b"PK\x03\x04"), "nor a zip");
        assert!(!looks_like_html(b"doctype html>"), "nor HTML with its bracket gone");
    }

    #[test]
    fn the_launch_scheme_is_not_the_asset_scheme() {
        // The whole of why this constant exists. `frank://` answers with files
        // off the served tree; if the OS could hand this app a `frank://` from
        // outside, a printed QR would be a request to open an arbitrary path.
        assert_ne!(PAIR_SCHEME, SCHEME);
        assert!(!PAIR_SCHEME.is_empty());
        assert!(PAIR_SCHEME
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'));
    }

    #[test]
    fn the_scheme_is_the_same_word_in_all_three_places() {
        // here; what the plugin's build script writes CFBundleURLTypes from;
        // and what an xcodegen regeneration puts back into the Info.plist it
        // edited. Two of the three are files, so this is the drift guard.
        let conf = include_str!("../tauri.conf.json");
        assert!(conf.contains(&format!("\"{PAIR_SCHEME}\"")), "tauri.conf.json");
        assert!(conf.contains("\"deep-link\""), "the plugin is configured");
        let yml = include_str!("../gen/apple/project.yml");
        assert!(yml.contains(&format!("- {PAIR_SCHEME}")), "project.yml CFBundleURLSchemes");
        assert!(yml.contains("CFBundleURLTypes:"), "project.yml");
    }

    #[test]
    fn a_link_becomes_the_seven_field_object_minus_the_fingerprint() {
        let got = parse_pair_link(
            "frank-pair://v1?url=https%3A%2F%2Fozzi--ttstv-cloud-api.modal.run\
&pass=abc-123_XYZ&workspace=ozzi&app=ttstv-cloud&made=1788000000",
        )
        .unwrap();
        assert_eq!(got.v, 1);
        assert_eq!(got.url, "https://ozzi--ttstv-cloud-api.modal.run");
        assert_eq!(got.pass, "abc-123_XYZ");
        assert_eq!(got.workspace, "ozzi");
        assert_eq!(got.app, "ttstv-cloud");
        assert_eq!(got.made, 1788000000);
    }

    #[test]
    fn the_lan_door_and_the_cloud_door_parse_the_same_way() {
        // Job 23c's whole point: the phone cannot tell them apart, and this
        // file is where it would learn to if anything read `url` for meaning.
        let lan = parse_pair_link("frank-pair://v1?url=http%3A%2F%2F192.168.1.24%3A8099&pass=p")
            .unwrap();
        let cloud = parse_pair_link("frank-pair://v1?url=https%3A%2F%2Fx.modal.run&pass=p").unwrap();
        assert_eq!(lan.pass, cloud.pass);
        assert_eq!(lan.app, cloud.app, "both default to the same app name");
        assert_eq!(lan.v, cloud.v);
    }

    #[test]
    fn the_defaults_are_the_macs_defaults() {
        let got = parse_pair_link("frank-pair://v1?url=https%3A%2F%2Fx.modal.run&pass=p").unwrap();
        assert_eq!(got.app, PAIR_APP);
        assert_eq!(got.workspace, "");
        assert_eq!(got.made, 0, "0 means the page stamps it at the write");
    }

    #[test]
    fn a_plus_is_a_space_and_a_percent_is_a_byte() {
        let got =
            parse_pair_link("frank-pair://v1?url=https%3A%2F%2Fx.modal.run&pass=p&workspace=my+team")
                .unwrap();
        assert_eq!(got.workspace, "my team");
    }

    #[test]
    fn a_trailing_slash_and_a_shouted_scheme_are_the_same_link() {
        let a = parse_pair_link("frank-pair://v1?url=https%3A%2F%2Fx.io&pass=p").unwrap();
        let b = parse_pair_link("FRANK-PAIR://v1/?url=https%3A%2F%2Fx.io&pass=p").unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn every_refusal_is_a_sentence_and_nothing_is_half_read() {
        // not ours at all
        assert!(parse_pair_link("https://example.com/?pass=p").is_err());
        // the ASSET scheme, which is the one that must never be a launch link
        assert!(parse_pair_link("frank://localhost/library/library.html").is_err());
        // a version this build does not know says so, in import.js's words
        let why = parse_pair_link("frank-pair://v2?url=https%3A%2F%2Fx.io&pass=p").unwrap_err();
        assert!(why.contains("version 2") && why.contains("update the app"), "{why}");
        // the two required fields
        assert!(parse_pair_link("frank-pair://v1?pass=p").unwrap_err().contains("address"));
        assert!(parse_pair_link("frank-pair://v1?url=https%3A%2F%2Fx.io").unwrap_err().contains("pass"));
        // and an address that is not an address. A QR is printed by strangers.
        for bad in [
            "frank-pair://v1?url=javascript%3Aalert(1)&pass=p",
            "frank-pair://v1?url=file%3A%2F%2F%2Fetc%2Fpasswd&pass=p",
            "frank-pair://v1?url=frank%3A%2F%2Flocalhost%2Fx&pass=p",
        ] {
            assert!(parse_pair_link(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn the_written_javascript_cannot_be_broken_out_of() {
        let p = Pairing {
            v: 1,
            url: "https://x.io".into(),
            pass: "\");alert(1);//".into(),
            workspace: "</script><script>".into(),
            app: "a\\b\"c".into(),
            made: 7,
        };
        let js = pair_write_js(&p);
        // the payload's own quote never appears unescaped
        assert!(!js.contains("\");alert(1);//\""), "{js}");
        assert!(js.contains("\\\");alert(1);\\/\\/"), "{js}");
        assert!(!js.contains("</script>"), "{js}");
        assert!(js.contains("\\u003c\\/script\\u003e"), "{js}");
        assert!(js.contains("window.TTSTVHost.pairWrite"));
        assert!(js.ends_with(");"), "{js}");
    }

    #[test]
    fn the_writer_is_the_page_s_and_it_is_not_behind_the_tauri_check() {
        // PAIR_JS must work where HOST_JS returns early -- Settings > Transfer
        // writes this same key in a browser, on the Mac, with no __TAURI__.
        assert!(!PAIR_JS.contains("__TAURI__"), "the writer needs no host");
        assert!(!PAIR_JS.contains("invoke("), "and no command");
        assert!(PAIR_JS.contains(&format!("var KEY = \"{PAIR_KEY}\"")));
        assert!(PAIR_JS.contains("crypto.subtle.digest(\"SHA-256\""));
        assert!(PAIR_JS.contains(".slice(0, 8)"), "eight hex, like the Mac's");
        assert!(PAIR_JS.contains("localStorage.setItem(KEY"));
        assert!(PAIR_JS.contains("ttstv:pairing"), "an open Transfer tab redraws");
        assert!(!PAIR_JS.contains("console.log"), "the pass is never printed");
    }

    #[test]
    fn the_key_is_the_contract_and_it_is_spelled_once() {
        assert_eq!(PAIR_KEY, "transfer.pairing");
        // Rust's constant and the page's literal are the same string, and the
        // page is where Settings > Transfer will read it from.
        assert!(PAIR_JS.contains(PAIR_KEY));
    }

    #[test]
    fn the_rows_name_is_the_txt_or_the_instance() {
        assert_eq!(studio_name("Air Studio._ttstv._tcp.local.", Some("Osca's Air Studio")), "Osca's Air Studio");
        assert_eq!(studio_name("Air Studio._ttstv._tcp.local.", Some("")), "Air Studio");
        assert_eq!(studio_name("Air Studio._ttstv._tcp.local.", None), "Air Studio");
        assert_eq!(studio_name("odd", None), "odd");
    }

    #[test]
    fn resolve_refuses_to_leave_the_shell() {
        let root = Path::new("/tmp/shell");
        assert!(resolve(root, "/../../etc/passwd").is_none());
        assert!(resolve(root, "/library/../../etc/passwd").is_none());
        assert_eq!(
            resolve(root, "/library/library.html").unwrap(),
            root.join("library").join("library.html")
        );
        assert_eq!(resolve(root, "/").unwrap(), root.join("index.html"));
        assert_eq!(
            resolve(root, "/a%20b/c.js").unwrap(),
            root.join("a b").join("c.js")
        );
    }

    #[test]
    fn the_shell_url_is_the_site_path() {
        assert!(shell_url(HOME_PAGE).ends_with("/library/library.html"));
    }

    /// The two defaults are applied once and both callers see the same answer.
    #[test]
    fn a_request_path_means_the_same_file_to_both_lookups() {
        let root = Path::new("/tmp/shell");
        for (request, key) in [
            ("/", "/index.html"),
            ("/library/library.html", "/library/library.html"),
            ("/a%20b/c.js", "/a b/c.js"),
        ] {
            assert_eq!(site_path(request), key, "site_path({request})");
            assert_eq!(
                resolve(root, request).unwrap(),
                root.join(key.trim_start_matches('/')),
                "resolve({request})"
            );
        }
    }

    /// The bug of 5 Sep in one assertion: a stamp that only counted names would
    /// have called an edited `library.html` up to date.
    #[test]
    fn the_fingerprint_follows_the_bytes_and_not_only_the_names() {
        let a = vec![("/library/library.html".to_string(), b"one".to_vec())];
        let b = vec![("/library/library.html".to_string(), b"two".to_vec())];
        assert_ne!(fingerprint(&a), fingerprint(&b));

        // Same shell, listed in a different order, is the same shell.
        let one = vec![
            ("/a.js".to_string(), b"x".to_vec()),
            ("/b.js".to_string(), b"y".to_vec()),
        ];
        let other = vec![
            ("/b.js".to_string(), b"y".to_vec()),
            ("/a.js".to_string(), b"x".to_vec()),
        ];
        assert_eq!(fingerprint(&one), fingerprint(&other));

        // An empty shell can never match a stamp a real one wrote.
        assert!(fingerprint(&[]).starts_with("0-"));
        assert!(fingerprint(&a).starts_with("1-"));
        assert_ne!(fingerprint(&[]), fingerprint(&a));
    }

    /// Two causes, two fixes; the sentence has to name the right one.
    #[test]
    fn the_reason_tells_the_dev_server_from_the_missing_build_step() {
        let dev = no_shell_reason(Some("http://192.168.1.4:1430/"));
        assert!(dev.contains("--no-dev-server"), "{dev}");
        assert!(dev.contains("192.168.1.4"), "{dev}");
        assert!(!dev.contains("prebuild.py"), "{dev}");

        let built = no_shell_reason(None);
        assert!(built.contains("prebuild.py"), "{built}");
        assert!(!built.contains("--no-dev-server"), "{built}");
    }

    /// The 404 page is reached after the dev fallback failed too, so in dev it
    /// must send you to `prebuild.py` and not to the flag that would embed the
    /// same empty folder.
    #[test]
    fn the_404_page_blames_the_empty_dist_and_not_the_dev_server() {
        let dev = nothing_anywhere(Some("http://127.0.0.1:1430/"), "/library/library.html");
        assert!(dev.contains("prebuild.py"), "{dev}");
        assert!(!dev.contains("--no-dev-server"), "{dev}");
        assert!(dev.contains("/library/library.html"), "{dev}");

        // Not in dev there is no second place, so it is the plain sentence.
        assert_eq!(nothing_anywhere(None, "/x"), no_shell_reason(None));
    }

    #[test]
    fn the_error_page_cannot_be_broken_by_a_path() {
        assert_eq!(escape("a<b>&c"), "a&lt;b&gt;&amp;c");
    }
}
