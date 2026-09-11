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
//! directory is where the *books* go: a reader that fetches
//! `frank://localhost/books/<slug>/book.json` wants one handler, one root and
//! one set of path rules -- not a second scheme bolted on later. Since G-PULL
//! (11 Sep) that is what it gets: a Sync pull writes each book through the
//! `book_*` commands into `<app data>/books/`, BESIDE the shell's folder (an
//! update clears the shell's; a book outlives it), and [`route`] answers
//! `/books/...` from there. See "the books", below.
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
mod search;

/// The scheme. One word, and it is in three places that must agree: here, the
/// window URL built by [`shell_url`], and `tauri.conf.json`'s CSP (which is
/// `null` -- so, two).
const SCHEME: &str = "frank";

/// Where the served tree lives under the app's data directory. A folder and not
/// the data dir itself, because the books have their own beside it
/// ([`BOOKS_DIR`], G-PULL) and must survive this one being cleared.
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
// injects a `window.TTSTVHost` whose methods call it. Pairing, the
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
/// desktop app's shape (`desktop/src/host.js`), five methods wide. The shell
/// checks for it and works without it: a page that is not in Frank simply
/// finds no Studios and offers the address field instead, and its look-up
/// panel's Search shows one sentence rather than moving anything.
///
/// `search(q)` is the reader's one way out (TTSTV `reader/lookup.js`, job 15c
/// re-wired 6 Sep: *"THE GUARD IS ON THE METHOD, never the object"* --
/// `typeof TTSTVHost.search === "function"` is the page's only test, and with
/// the method absent the panel writes `#note` and moves nothing). The name
/// and shape are `desktop/src/host.js`'s, so one page reaches both hosts by
/// one call: the word as printed goes in, a `Promise<string | null>` comes
/// out -- `null` for an empty query, the landing it took otherwise. Here the
/// landing is the Safari sheet (`search.rs`), and **the sheet takes the
/// `-site:` form**: `host.js` builds `web` from the mock's `COVERED` list and
/// passes `{ query, web }` to its window; `search.rs` says the exclusions
/// "arrive already in it ... this file never builds, adds to, or trims that
/// list". So this is where they are built for the phone -- the same five
/// domains in the same order, `webQuery()` as `design/reader/search.html`
/// writes it -- and `frank_search` is invoked on `web`, the one argument its
/// door reads (`SEARCH_JS`: `open(args && args.query)`). The call is made at
/// the press, through `TAURI.invoke` as it is THEN, which is how the plugin's
/// wrapper (installed at `load`, after this script) gets to answer it.
///
/// **The three doors (Osca, 7 September): `openReader`, `openLibrary`,
/// `openWindow`.** They were absent -- the count on disk was 0 -- and
/// `window.open` is inert in a WKWebView, so a tap on a book in the shelf did
/// nothing whatever: `library/library.html::openReader` asks the host first and
/// falls back to `window.open`, and on the phone neither end existed. They are
/// added here as **navigations of this same webview**, which is the only kind
/// of door a phone has. The URLs are `desktop/src-tauri/src/tabs.rs::url_for`'s
/// -- `/library/library.html`, `/reader/reader.html?book=books/<slug>[&ch=<unit>]`
/// -- so the desktop and the phone send one shell to one set of paths, and the
/// crate's job is the shape, not a second opinion about it. `openWindow` keeps
/// `host.js`'s rule that a first argument which is not a kind is a reader slug.
/// This reverses the older blanket line "HOST_JS never touches location"
/// (6 Sep, written when `search` was the whole object): `location` is now
/// exactly one call, `go`, and **`window.open` appears nowhere** -- which is
/// the half of that rule that still holds, and the half the tests keep.
pub const HOST_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  /* the Bonjour browse behind the Transfer tab's Sync button (job 26) */
  window.TTSTVHost.syncDiscover = function (ms) { return TAURI.invoke("sync_discover", { ms: ms }); };
  window.TTSTVHost.deviceName = "Frank on this phone";
  /* design/reader/search.html's COVERED, in its order, and its webQuery():
     the words, then -site: for every source the app already covers. The
     same two lines desktop/src/host.js carries; the sheet adds nothing. */
  var COVERED = ["gutenberg.org", "archive.org", "youtube.com", "wikipedia.org", "wiktionary.org"];
  var webQuery = function (q) { return q + COVERED.map(function (d) { return " -site:" + d; }).join(""); };
  // TTSTVHost.search(q: string) -> Promise<string | null>
  window.TTSTVHost.search = function (q) {
    const query = String(q == null ? "" : q).trim();
    if (!query) return Promise.resolve(null);
    const web = webQuery(query);
    return TAURI.invoke("frank_search", { query: web }).then(() => "sheet");
  };
  /* --------------------------------------------------------- the doors (7 Sep)
     the `open()` a page calls on `window` is INERT in a WKWebView -- no window,
     no tab, no error, and nothing in the console -- so until now a tap on a
     tile in the shelf did nothing at all: library.html asks the host first and
     falls back to that call, and on the phone both ends were dead. (The name
     itself is not written in this string: a test asserts the literal is absent,
     which is a dumb check and stays true.) Every door here is a
     navigation of THIS webview, and the paths are not invented: they are
     `desktop/src-tauri/src/tabs.rs::url_for`'s, spelt once in `urlFor` below,
     so one shell reaches one set of URLs on the desktop and on the phone.
     Absolute, because `frank://localhost/` is a real origin whose paths are the
     site's paths (see the module header) -- the same strings work behind a dev
     server. No door is a command: the two `invoke`s above are still the whole
     of what this object asks the crate for. */
  var KINDS = { reader: 1, studio: 1, library: 1 };
  var enc = encodeURIComponent;
  var urlFor = function (kind, slug, unit) {
    if (kind === "library") return "/library/library.html";
    if (kind === "settings") return "/settings/settings.html";
    /* url_for's Studio is the base itself. There is no Studio page in the
       phone shell, so `/` is index.html and index.html goes to the Library --
       which is the truthful landing here, not a stub pretending otherwise. */
    if (kind === "studio") return slug ? "/?slug=" + enc(slug) : "/";
    var u = "/reader/reader.html";
    if (slug) {
      u += "?book=books/" + enc(slug);
      if (unit) u += "&ch=" + enc(unit);
    }
    return u;
  };
  var go = function (url) { window.location.assign(url); return Promise.resolve(url); };
  // TTSTVHost.openReader(slug: string, unit?: string) -> Promise<string>
  window.TTSTVHost.openReader = function (slug, unit) { return go(urlFor("reader", slug, unit)); };
  // TTSTVHost.openLibrary() -> Promise<string>
  window.TTSTVHost.openLibrary = function () { return go(urlFor("library")); };
  /* host.js's own rule, kept word for word: the prompt's shape is
     openWindow(kind, slug), library.html calls openWindow(slug), and a first
     argument that is not a kind is the slug of a reader. There is no second
     window on a phone, so "window" here means the same door as the others. */
  window.TTSTVHost.openWindow = function (kind, slug) {
    if (!KINDS[kind]) { slug = kind; kind = "reader"; }
    return go(urlFor(kind, slug));
  };
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

// ------------------------------------------------------- Google (job 26b)
//
// *"Google IS the account"* (Osca, 6 Sep). The account is the same one on
// the Mac and here, and neither device has a server of ours behind it: the
// flow is PKCE, and an iOS OAuth client has no secret at all -- so nothing
// in this crate is a credential, and the one string it carries (the client
// id) is public by design, printed in Google's console and readable in any
// installed app's binary.
//
// WHAT THIS CRATE OWNS, AND THE TWO THINGS IT DOES NOT. It owns the two
// halves the page cannot do for itself:
//
//   1. **Opening the consent page in the SYSTEM BROWSER.** Google refuses
//      its consent page inside an embedded web view (the "disallowed_useragent"
//      answer), which is the whole reason `google_sign_in` is a command and
//      not a `window.open` in the shell. RFC 8252 §8.12 says the same thing
//      from the other side: an app must not put the authorization request in
//      a web view it controls, because the person cannot see what they are
//      typing their password into.
//   2. **Catching the redirect the OS hands back** -- `com.googleusercontent.
//      apps.<n>:/oauth?code=…` -- and writing it into the ONE key the shell
//      polls. The same shape as `frank-pair://`: read in Rust, written into
//      `localStorage` from here, so the page never has the deep-link plugin's
//      commands and cannot read a redirect it was not given.
//
// It does NOT own the PKCE, the exchange, or anything the tokens touch:
// that is `library/drive.js` in the shell (TTSTV), which makes the verifier
// with `crypto.subtle`, exchanges the code, and keeps the refresh token in
// its own `ttstv.sync.google`. One flow, and the crate is the two doors the
// web page has no key to.
//
// THE ID IS PASTED ONCE, IN `google.json`, AND THE SCHEME IS DERIVED FROM
// IT. `tauri.conf.json`'s `plugins.deep-link.mobile` is what the plugin's
// build script writes into `CFBundleURLTypes`, and it is static JSON -- so
// the scheme is written there by hand and `tests/test_google_scheme.py`
// asserts it is exactly the reverse of the id in `google.json`. Two places,
// one fact, and a test rather than a comment holding them together. The id
// is CARRIED, not pasted (11 Sep): every `tools/import_shell.py` run reads
// it out of TTSTV's account.json and writes google.json, tauri.conf.json and
// project.yml (`carry_google`, tests/test_google_carry.py). With no id
// `TTSTVHost.google` is not injected at all -- the Settings page then says
// "no Google client on this device" and stays on This network, which is the
// truthful state and not a stub.

/// The iOS client id, from `src-tauri/google.json` at compile time. Empty
/// until Osca pastes it (`studio/STATUS.md` job 26 §6.3: Credentials ▸
/// Create client ▸ iOS, bundle id `com.ttstv.frank`).
pub const GOOGLE_JSON: &str = include_str!("../google.json");

/// The one field of it, scanned by hand rather than with a JSON crate --
/// `parse_pair_link` reads its own URL the same way, and a dependency for
/// one string in one file is a dependency to keep in step forever.
pub fn google_ios_client_id() -> &'static str {
    json_field(GOOGLE_JSON, "ios_client_id")
}

/// `"key": "value"` out of a flat object, or `""`. No escapes are honoured
/// because none can occur: a Google client id is `<digits>-<base32ish>.apps.
/// googleusercontent.com`, and anything else is not one.
pub fn json_field<'a>(src: &'a str, key: &str) -> &'a str {
    let needle = format!("\"{key}\"");
    let Some(i) = src.find(&needle) else { return "" };
    let rest = &src[i + needle.len()..];
    let Some(c) = rest.find(':') else { return "" };
    let rest = &rest[c + 1..];
    let Some(o) = rest.find('"') else { return "" };
    let rest = &rest[o + 1..];
    match rest.find('"') {
        Some(e) => &rest[..e],
        None => "",
    }
}

/// The redirect an installed iOS app gets: the client id's parts reversed,
/// then `:/oauth`. Google prints this beside the id as the "iOS URL scheme"
/// and it is what `CFBundleURLTypes` must carry. `""` when there is no id.
pub fn google_redirect_scheme() -> String {
    let id = google_ios_client_id();
    let Some(number) = id.strip_suffix(".apps.googleusercontent.com") else {
        return String::new();
    };
    if number.is_empty() {
        return String::new();
    }
    format!("com.googleusercontent.apps.{number}")
}

pub fn google_redirect_uri() -> String {
    let s = google_redirect_scheme();
    if s.is_empty() { s } else { format!("{s}:/oauth") }
}

/// The key the shell polls for the redirect -- `library/drive.js`'s
/// `GOOGLE_REDIRECT_KEY`, and the only name shared between the two files.
pub const GOOGLE_REDIRECT_KEY: &str = "ttstv.sync.googleRedirect";

/// Open the consent page in the system browser. The page hands the whole
/// URL over (it made the PKCE challenge and the state, so only it can), and
/// this refuses anything that is not Google's own authorization endpoint:
/// a command that opens any URL a page names is a way out of the app, and
/// the one thing this command exists for has exactly one address.
#[tauri::command]
fn google_sign_in<R: tauri::Runtime>(app: tauri::AppHandle<R>, url: String) -> Result<(), String> {
    const AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth?";
    if !url.starts_with(AUTH) {
        return Err(format!("not Google's consent page (must begin {AUTH})"));
    }
    if google_ios_client_id().is_empty() {
        return Err("no Google client id in google.json -- see studio/STATUS.md job 26 §6.3".into());
    }
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_url(url, None::<&str>)
        .map_err(|e| format!("could not open the browser: {e}"))
}

/// `window.TTSTVHost.google` and `.googleSignIn`, injected separately from
/// [`HOST_JS`] because there is a state in which they must NOT exist: with
/// no client id pasted there is no account to sign in to, and a button that
/// pretends is worse than one that says so (the shell's own rule for a face
/// a device lacks). Empty string then, and the Settings page reads the
/// absence.
pub fn google_js() -> String {
    let id = google_ios_client_id();
    let redirect = google_redirect_uri();
    if id.is_empty() || redirect.is_empty() {
        return String::new();
    }
    format!(
        r#"(function () {{
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {{}};
  window.TTSTVHost.google = {{ clientId: {id}, redirect: {redirect} }};
  window.TTSTVHost.googleSignIn = function (url) {{ return TAURI.invoke("google_sign_in", {{ url: url }}); }};
}})();
"#,
        id = json_string(id),
        redirect = json_string(&redirect),
    )
}

/// The redirect, into the key the shell polls. One `setItem` and nothing
/// else: the code in that URL is single-use, tied to the verifier the page
/// still holds, and the page is the only thing that can spend it.
pub fn google_write_js(url: &str) -> String {
    format!(
        "try {{ localStorage.setItem({key}, {url}); }} catch (e) {{}}",
        key = json_string(GOOGLE_REDIRECT_KEY),
        url = json_string(url),
    )
}

/// Is this one of ours? The reverse client id, and nothing else -- a link
/// that is not this and not `frank-pair://` is logged and dropped.
pub fn is_google_redirect(url: &str) -> bool {
    let scheme = google_redirect_scheme();
    !scheme.is_empty() && url.starts_with(&format!("{scheme}:"))
}

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

/// The same, for Google's redirect (job 26b) -- a whole URL rather than a
/// parsed object, because the page is what parses it: the code inside is
/// tied to a verifier only the page holds.
#[derive(Default)]
pub struct PendingGoogle(pub Mutex<Option<String>>);

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

// ------------------------------------------------------------ the books
//
// G-PULL (Osca, 11 Sep): *"the phone can read Drive but cannot take a book."*
// The Sync press read `library.json` off Drive (26 rows), said `Pulling 1 of
// 26 · Les Pensées · 0/31`, and failed on the first byte of the first file,
// every press. The shell kept a book in the Cache API (`library/import.js`),
// and `Cache.put` refuses any URL whose scheme is not http or https -- WebKit's
// words are `Request url is not HTTP/HTTPS` -- and this origin is `frank://`.
// Nor would a Cache have been read if it had taken the bytes: there is no
// service worker on a custom scheme, and `frank://localhost/books/<slug>/...`
// is answered by THIS crate's handler, off disk, which is where the module
// head always said the books were going.
//
// So the books go to disk, through four commands, and the shell's store seam
// (`import.js`, "the store") hands them the same four verbs it gives the
// Cache on the web: `book_put` one file, `book_meta` the row -- written LAST,
// and it is the commit -- `book_list` every row, `book_remove` a slug. The
// reader and the Library need nothing new: they already ask for
// `frank://localhost/books/<slug>/...`, and [`route`] now answers that from
// the books folder.
//
// THE FOLDER IS NOT UNDER SHELL_DIR. `unpack_shell` clears the shell tree
// whenever the app carries a different shell -- every update -- and a book
// must outlive every update. `<app data>/books/` sits beside `shell/`:
//
//   books/<slug>/<rel>                 the installed version, whole
//   books/<slug>/.meta.json            its row (what the Library lists)
//   books/<slug>/.hash                 its hash, for the next commit to name
//   books/.part/<slug>@<hash>/<rel>    a version being pulled
//   books/.old/<slug>@<hash>-<n>/      a replaced version, waiting for its delete
//
// A pull writes into `.part/`; `book_meta` writes the row there and swaps
// the folder in. A pull that dies half-way leaves a `.part/` folder and no
// row, so the book is not on the shelf and the version already installed is
// untouched -- the same promise `import.js` makes for a Cache ("a power cut
// mid-import leaves the old book whole and the new one partial-but-
// unreferenced"). Every dot-named name here is the crate's own: a book file
// may not have one ([`book_rel`]) and none is ever served ([`route`]).

/// The books folder's name under the app's data directory -- beside
/// [`SHELL_DIR`], never in it.
const BOOKS_DIR: &str = "books";

/// The request paths that are books. The reader lives in `reader/` and asks
/// for `../books/<slug>/...`, which is this.
const BOOKS_PREFIX: &str = "/books/";

/// A version being pulled, and a version a commit has replaced.
const BOOKS_PART: &str = ".part";
const BOOKS_OLD: &str = ".old";

/// The row `listInstalled` reads -- `import.js`'s meta object, as the page
/// sent it -- and the installed version's hash beside it (plain text, so a
/// commit can say which version it replaced without parsing JSON).
const BOOK_META: &str = ".meta.json";
const BOOK_HASH: &str = ".hash";

/// The three names a `book_put` carries, as request headers (the body is the
/// bytes). Percent-encoded by [`BOOKS_JS`]: a header value is ASCII.
const BOOK_SLUG_HEADER: &str = "frank-book-slug";
const BOOK_HASH_HEADER: &str = "frank-book-hash";
const BOOK_REL_HEADER: &str = "frank-book-rel";

fn books_root<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("no app data dir")
        .join(BOOKS_DIR)
}

/// Which file answers a request: `/books/<slug>/<rel>` from the books folder,
/// everything else from the shell. ONE extra root and the same path rules as
/// [`resolve`] -- the same `..` refusals, the same decoding -- plus one of its
/// own: a dot-named segment under `/books/` is refused, because every dot
/// name there is the crate's (`.meta.json`, `.hash`, `.part/`, `.old/`).
/// `None` means 404.
///
/// The prefix is tested on the path AS SENT. A request that spells it in
/// percent-escapes (`/%62ooks/...`) is therefore a shell path, and the
/// shell has no `books/` beyond the dev shelf -- so it can only miss, and a
/// `..` spelt `%2e%2e` is decoded before [`resolve`] reads the components,
/// where it is refused like any other.
fn route(shell: &Path, books: &Path, request_path: &str) -> Option<PathBuf> {
    let Some(rest) = request_path.strip_prefix(BOOKS_PREFIX) else {
        return resolve(shell, request_path);
    };
    if rest.is_empty() {
        return None;
    }
    let p = resolve(books, rest)?;
    let dotted = p
        .strip_prefix(books)
        .ok()?
        .components()
        .any(|c| c.as_os_str().to_string_lossy().starts_with('.'));
    if dotted {
        None
    } else {
        Some(p)
    }
}

/// import.js's slug rule (`validateBook`): lower-case letters, digits and
/// hyphens, a letter or digit first. It is a folder name and a URL segment
/// here, exactly as it is a Cache name and a URL segment on the web.
fn book_slug_ok(slug: &str) -> Result<(), String> {
    let b = slug.as_bytes();
    let first = b
        .first()
        .map_or(false, |c| c.is_ascii_lowercase() || c.is_ascii_digit());
    let rest = b
        .iter()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-');
    if first && rest && b.len() <= 128 {
        Ok(())
    } else {
        Err(format!(
            "{slug:?} is not a book slug (lower-case letters, digits and hyphens)"
        ))
    }
}

/// A book's version: core/provenance.py's word-id hash, lower-case hex.
fn book_hash_ok(hash: &str) -> Result<(), String> {
    let ok = !hash.is_empty()
        && hash.len() <= 64
        && hash.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c));
    if ok {
        Ok(())
    } else {
        Err(format!("{hash:?} is not a book hash (lower-case hex)"))
    }
}

/// A file of a book, relative to the book's folder -- `chapters/c001.txt`,
/// `audio/c001.opus`. [`resolve`]'s rules and then some, because this path is
/// WRITTEN: no `..`, nothing absolute, no empty segment, no backslash or NUL,
/// and no dot-named segment (those are the crate's). Every refusal a sentence.
fn book_rel(rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() {
        return Err("an empty path is not a file of a book".into());
    }
    if rel.starts_with('/') || rel.contains('\\') || rel.contains('\0') {
        return Err(format!("{rel:?} is not a relative path inside a book"));
    }
    let mut out = PathBuf::new();
    for seg in rel.split('/') {
        if seg.is_empty() {
            return Err(format!("{rel:?} has an empty segment"));
        }
        if seg == "." || seg == ".." {
            return Err(format!("{rel:?} tries to leave the book's folder"));
        }
        if seg.starts_with('.') {
            return Err(format!("{rel:?} names a dot-file, and those are Frank's own"));
        }
        let mut parts = Path::new(seg).components();
        match (parts.next(), parts.next()) {
            (Some(Component::Normal(_)), None) => out.push(seg),
            _ => return Err(format!("{rel:?} is not a plain path")),
        }
    }
    Ok(out)
}

fn book_part(books: &Path, slug: &str, hash: &str) -> PathBuf {
    books.join(BOOKS_PART).join(format!("{slug}@{hash}"))
}

fn io_why(what: &str, path: &Path, e: std::io::Error) -> String {
    format!("frank: cannot {what} {} -- {e}", path.display())
}

/// `book_put`'s body: one file of a version being pulled, into `.part/`.
/// Answers the byte count.
fn book_write(books: &Path, slug: &str, hash: &str, rel: &str, bytes: &[u8]) -> Result<u64, String> {
    book_slug_ok(slug)?;
    book_hash_ok(hash)?;
    let dst = book_part(books, slug, hash).join(book_rel(rel)?);
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| io_why("create", parent, e))?;
    }
    fs::write(&dst, bytes).map_err(|e| io_why("write", &dst, e))?;
    Ok(bytes.len() as u64)
}

/// `book_meta`'s body: THE COMMIT. The row and the hash go into the version's
/// `.part/` folder, and the folder becomes `books/<slug>`. The version it
/// replaced -- if its hash differs -- is named in the answer (`<slug>@<hash>`,
/// as the Cache store names the cache it dropped). A folder that cannot be
/// swapped in puts the old one back and says so.
fn book_commit(books: &Path, slug: &str, hash: &str, meta_json: &str) -> Result<Vec<String>, String> {
    book_slug_ok(slug)?;
    book_hash_ok(hash)?;
    let part = book_part(books, slug, hash);
    if !part.is_dir() {
        return Err(format!(
            "nothing was put for {slug}@{hash} -- a book's row comes after its files"
        ));
    }
    let meta = part.join(BOOK_META);
    fs::write(&meta, meta_json).map_err(|e| io_why("write", &meta, e))?;
    let stamp = part.join(BOOK_HASH);
    fs::write(&stamp, hash).map_err(|e| io_why("write", &stamp, e))?;

    let live = books.join(slug);
    let mut replaced = Vec::new();
    if live.exists() {
        let old = fs::read_to_string(live.join(BOOK_HASH))
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let label = if old.is_empty() { "unknown" } else { old.as_str() };
        let aside = books.join(BOOKS_OLD).join(format!("{slug}@{label}-{nanos}"));
        if let Some(parent) = aside.parent() {
            fs::create_dir_all(parent).map_err(|e| io_why("create", parent, e))?;
        }
        fs::rename(&live, &aside).map_err(|e| io_why("move aside", &live, e))?;
        if let Err(e) = fs::rename(&part, &live) {
            let back = fs::rename(&aside, &live);
            return Err(format!(
                "{} ({})",
                io_why("install", &part, e),
                if back.is_ok() { "the old version is back" } else { "and the old version could not be put back" }
            ));
        }
        let _ = fs::remove_dir_all(&aside);
        if !old.is_empty() && old != hash {
            replaced.push(format!("{slug}@{old}"));
        }
    } else {
        fs::rename(&part, &live).map_err(|e| io_why("install", &part, e))?;
    }
    Ok(replaced)
}

/// `book_list`'s body: `(slug, row text, hash)` for every installed book,
/// in slug order -- the row as the page wrote it, `None` when a folder has
/// no readable one (the command then answers a `broken` row, as the Cache
/// store does for a cache with no meta entry).
fn book_rows(books: &Path) -> Vec<(String, Option<String>, String)> {
    let Ok(dir) = fs::read_dir(books) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in dir.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || !entry.path().is_dir() {
            continue;
        }
        let meta = fs::read_to_string(entry.path().join(BOOK_META)).ok();
        let hash = fs::read_to_string(entry.path().join(BOOK_HASH))
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        out.push((name, meta, hash));
    }
    out.sort();
    out
}

/// `book_remove`'s body: the slug's installed folder and every half-pulled
/// version of it. Answers how many folders went (0 when none was here) --
/// the Cache store's count, which includes a cache with no meta.
fn book_delete(books: &Path, slug: &str) -> Result<u32, String> {
    book_slug_ok(slug)?;
    let mut n = 0;
    let live = books.join(slug);
    if live.is_dir() {
        fs::remove_dir_all(&live).map_err(|e| io_why("remove", &live, e))?;
        n += 1;
    }
    let prefix = format!("{slug}@");
    if let Ok(dir) = fs::read_dir(books.join(BOOKS_PART)) {
        for entry in dir.flatten() {
            if entry.file_name().to_string_lossy().starts_with(&prefix) {
                fs::remove_dir_all(entry.path()).map_err(|e| io_why("remove", &entry.path(), e))?;
                n += 1;
            }
        }
    }
    Ok(n)
}

/// One file of a book. **The bytes are the RAW IPC body** -- `invoke(
/// "book_put", bytes, { headers })` from [`BOOKS_JS`] -- and the three names
/// ride as headers: a book's audio is megabytes, and a JSON array of numbers
/// is four to five bytes a byte and a parse. On iOS the body crosses as the
/// body of Tauri's own `ipc://` request (wry reads `HTTPBody`, or
/// `HTTPBodyStream` when WebKit hands it that way). Where the custom-protocol
/// IPC is not used -- Android, or a webview that refused it -- Tauri falls
/// back to `postMessage`, which serialises the bytes as a JSON array; that
/// arrives as `InvokeBody::Json` and is taken too, slowly, rather than
/// refused. A synchronous command, so it runs on the main thread: one
/// `fs::write` of one file. Its cost is the log line below (debug builds
/// log at Info; Xcode's console, filter `book_put`).
#[tauri::command]
fn book_put<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    request: tauri::ipc::Request<'_>,
) -> Result<u64, String> {
    let header = |name: &str| -> Result<String, String> {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(percent_decode)
            .ok_or_else(|| format!("book_put: no {name} header"))
    };
    let slug = header(BOOK_SLUG_HEADER)?;
    let hash = header(BOOK_HASH_HEADER)?;
    let rel = header(BOOK_REL_HEADER)?;
    let started = Instant::now();
    let books = books_root(&app);
    let n = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => book_write(&books, &slug, &hash, &rel, bytes)?,
        tauri::ipc::InvokeBody::Json(serde_json::Value::Array(items)) => {
            let bytes: Option<Vec<u8>> = items
                .iter()
                .map(|v| v.as_u64().filter(|n| *n < 256).map(|n| n as u8))
                .collect();
            let bytes = bytes.ok_or("book_put: the body is not bytes")?;
            book_write(&books, &slug, &hash, &rel, &bytes)?
        }
        _ => {
            return Err(
                "book_put: the bytes go as the raw body -- invoke(\"book_put\", bytes, { headers })".into(),
            )
        }
    };
    log::info!(
        "frank: book_put {slug}@{hash}/{rel} -- {n} bytes in {} ms",
        started.elapsed().as_millis()
    );
    Ok(n)
}

/// The row, LAST: the commit ([`book_commit`]). Answers the versions it
/// replaced.
#[tauri::command]
fn book_meta<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    slug: String,
    hash: String,
    meta: serde_json::Value,
) -> Result<Vec<String>, String> {
    if !meta.is_object() {
        return Err("book_meta: a book's row is a JSON object".into());
    }
    let text = serde_json::to_string(&meta).map_err(|e| format!("book_meta: {e}"))?;
    let replaced = book_commit(&books_root(&app), &slug, &hash, &text)?;
    log::info!("frank: book_meta {slug}@{hash} -- installed, replaced {replaced:?}");
    Ok(replaced)
}

/// Every installed book's row -- what the Library lists as "On this device".
#[tauri::command]
fn book_list<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Vec<serde_json::Value> {
    book_rows(&books_root(&app))
        .into_iter()
        .map(|(slug, meta, hash)| {
            meta.and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
                .filter(|v| v.is_object())
                .unwrap_or_else(|| {
                    serde_json::json!({
                        "slug": slug, "hash": hash, "title": slug,
                        "broken": true, "bytes": 0, "chapters": 0
                    })
                })
        })
        .collect()
}

/// A book off this phone, every version of it.
#[tauri::command]
fn book_remove<R: tauri::Runtime>(app: tauri::AppHandle<R>, slug: String) -> Result<u32, String> {
    book_delete(&books_root(&app), &slug)
}

/// `window.TTSTVHost.books`, the door `library/import.js`'s `HostStore`
/// talks to: the four commands, and nothing else. Injected on its own rather
/// than inside [`HOST_JS`], whose tests pin that object to its two commands;
/// guarded the same way -- a page that is not in Frank gets no door, and
/// import.js then keeps the Cache API, which is right on every origin but
/// this one. `put` sends the bytes as the raw body and the three names as
/// headers, percent-encoded (a header value is ASCII; a book file's name is
/// not promised to be).
pub const BOOKS_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  var enc = encodeURIComponent;
  window.TTSTVHost.books = {
    // put(slug, hash, rel, bytes: Uint8Array) -> Promise<number>
    put: function (slug, hash, rel, bytes) {
      return TAURI.invoke("book_put", bytes, { headers: {
        "frank-book-slug": enc(slug), "frank-book-hash": enc(hash), "frank-book-rel": enc(rel) } });
    },
    // meta(slug, hash, row) -> Promise<string[]>, the versions it replaced
    meta: function (slug, hash, meta) { return TAURI.invoke("book_meta", { slug: slug, hash: hash, meta: meta }); },
    // list() -> Promise<row[]>
    list: function () { return TAURI.invoke("book_list"); },
    // remove(slug) -> Promise<number>
    remove: function (slug) { return TAURI.invoke("book_remove", { slug: slug }); }
  };
})();
"#;

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
        // A book's files, since the books folder is served from here too
        // (G-PULL, 11 Sep): `library/import.js`'s own TYPES, so a chapter is
        // UTF-8 text and an audio file is audio whichever store it came from.
        Some("txt") => "text/plain; charset=utf-8",
        Some("ogg") => "audio/ogg",
        Some("m4a") => "audio/mp4",
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
/// A top-level page rather than a script, a style, a book file or an icon.
/// The doors' probe line (7 Sep) is one per page, and this is the whole of
/// what "a page" means here: the index, or something ending `.html`.
fn is_document(path: &str) -> bool {
    path.is_empty() || path == "/" || path.ends_with(".html")
}

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

// ------------------------------------------------- the float: audio session
//
// Job 8b (Osca, 6 Sep, off the float spike): *"Frank's audio does not survive
// leaving the app."* It did not, and the reason was two absences rather than a
// bug. `gen/apple/project.yml` claimed no `UIBackgroundModes`, so iOS suspended
// the process seconds after it went to the background; and nothing anywhere set
// the AVAudioSession category, so even with the key the sound would have been
// treated as decoration and silenced. Both are fixed now, and neither works
// without the other.
//
// What is HERE is the Rust half: the C symbols `src-tauri/ios/FrankAudio.m`
// exports, and the one command the page uses to say "the reader has started".
// The category is set at launch (it interrupts nothing); the session is taken
// on the first `play`, because activating a Playback session stops whatever
// else the phone is playing and opening Frank must not do that.
//
// Off iOS every one of these is a no-op that says so. `cargo test` on the Mac
// targets macOS, where the symbols do not exist and the `extern` block is not
// compiled -- which is why this is `cfg(target_os = "ios")` and not `cfg(mobile)`.

#[cfg(target_os = "ios")]
extern "C" {
    fn frank_audio_session_category() -> i32;
    fn frank_audio_session_activate() -> i32;
}

/// What `FrankAudio.m` returns, as a sentence. `0` is success on both calls.
pub fn audio_session_why(code: i32) -> &'static str {
    match code {
        0 => "ok",
        1 => "setCategory(Playback) refused -- the sound will stop at the app switcher",
        2 => "setActive refused -- another app holds the session",
        _ => "unknown AVAudioSession result",
    }
}

/// Route this app's sound as playback. Called once, in `setup`.
pub fn audio_session_category() -> Result<(), String> {
    // SAFETY: a C function taking nothing and returning an int, defined in
    // `src-tauri/ios/FrankAudio.m` and compiled into this crate by `build.rs`
    // (the `cc` crate, iOS targets only). NOT by the Xcode target: there is
    // deliberately no `- path: ../../ios` in `gen/apple/project.yml`, because
    // two compilations of one file is `duplicate symbol
    // _frank_audio_session_category` at link time. Corrected 6 Sep -- the
    // sentence this replaces described the arrangement as it was proposed and
    // never as it was built.
    #[cfg(target_os = "ios")]
    let code = unsafe { frank_audio_session_category() };
    #[cfg(not(target_os = "ios"))]
    let code = 0i32;
    if code == 0 { Ok(()) } else { Err(audio_session_why(code).into()) }
}

/// Take the session. The page calls this through [`NOW_PLAYING_JS`] on the
/// first `play` event and never again.
pub fn audio_session_activate() -> Result<(), String> {
    // SAFETY: as above.
    #[cfg(target_os = "ios")]
    let code = unsafe { frank_audio_session_activate() };
    #[cfg(not(target_os = "ios"))]
    let code = 0i32;
    if code == 0 { Ok(()) } else { Err(audio_session_why(code).into()) }
}

/// The reader has started playing. Idempotent on the iOS side (taking a session
/// twice is not an error), and a no-op everywhere else, so the same shell runs
/// unchanged on the Mac.
#[tauri::command]
fn audio_session_start() -> Result<(), String> {
    let r = audio_session_activate();
    match &r {
        Ok(()) => log::info!("frank: audio session active -- playback continues in the background"),
        Err(why) => log::error!("frank: audio session NOT active: {why}"),
    }
    r
}

/// The lock screen, and the guard that keeps the WORD off it.
///
/// Two jobs, one script.
///
/// **1. The session.** A `play` listener in the CAPTURE phase on `document` --
/// media events do not bubble, so a listener on `document` sees them only with
/// `true` as the third argument, and this is the one place in the app that
/// notices the reader has started without reaching into the shell's DOM for its
/// `<audio>` element. It fires once.
///
/// **2. `TTSTVHost.nowPlaying(sentence, book)`.** The title on the lock screen
/// is the SENTENCE the reader is in, never the word. That is not a preference:
/// the float spike measured the corpus at 3.56 words a second typically and 25
/// at the floor, and a lock-screen title written once a second shows 61.7% of
/// nothing (`scratch-float/ANSWER.md` §1). So the rate limit is enforced HERE,
/// at the seam, rather than written down and hoped for -- at most one write a
/// second, trailing edge so the newest sentence wins, and an identical title is
/// never written twice. A caller that pushes a word per word gets one word a
/// second and no cost; a caller that pushes sentences gets every sentence.
///
/// The mechanism is `navigator.mediaSession` and not `MPNowPlayingInfoCenter`,
/// because the audio is WebKit's: the media element playing the chapter is what
/// owns the system's now-playing session, and metadata set beside it from the
/// app is the one the system may ignore. This is the writer WebKit itself
/// forwards.
///
/// Injected unconditionally, like [`PAIR_JS`] and for the same reason: the
/// `mediaSession` half needs no `__TAURI__`, and the shell should not have to
/// carry a second copy of the rule for the case where Frank is not the host.
/// The seam exists; the caller is `reader/listen.js`'s (STATUS §6).
pub const NOW_PLAYING_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  var MS = window.navigator && window.navigator.mediaSession;
  var MIN_MS = 1000;                    /* one write a second, and no more */

  var started = false, last = 0, lastTitle = null, timer = 0, pending = null;
  var wrote = 0, coalesced = 0, refused = 0;

  function put(title, book) {
    if (!MS || !window.MediaMetadata) { refused++; return; }
    if (title === lastTitle) { coalesced++; return; }
    try {
      MS.metadata = new window.MediaMetadata({ title: title, artist: book || "", album: "Frank" });
      MS.playbackState = "playing";
      lastTitle = title; last = Date.now(); wrote++;
    } catch (e) { refused++; }
  }

  /* trailing edge: while the sentences come faster than MIN_MS the newest one
     replaces the one waiting, so the lock screen is never behind the book. */
  function schedule(title, book) {
    pending = { title: title, book: book };
    if (timer) { coalesced++; return; }
    var wait = Math.max(0, MIN_MS - (Date.now() - last));
    timer = window.setTimeout(function () {
      timer = 0;
      var p = pending; pending = null;
      if (p) put(p.title, p.book);
    }, wait);
  }

  function firstPlay() {
    if (started) return;
    started = true;
    /* the lock screen is never blank: the book's own title stands until the
       reader names a sentence. */
    put(document.title || "Frank", "");
    if (TAURI && typeof TAURI.invoke === "function") {
      TAURI.invoke("audio_session_start").then(null, function (e) {
        window.console && console.warn("frank: audio session " + e);
      });
    }
  }
  document.addEventListener("play", firstPlay, true);

  window.TTSTVHost = window.TTSTVHost || {};
  /* the SENTENCE the cursor is in, and the book it is from. Called as often as
     the reader likes; written to the lock screen at most once a second. */
  window.TTSTVHost.nowPlaying = function (sentence, book) {
    var t = (sentence == null ? "" : String(sentence)).trim();
    if (!t) return false;
    schedule(t, book);
    return true;
  };
  window.TTSTVHost.nowPlayingStats = function () {
    return { supported: !!(MS && window.MediaMetadata), started: started,
             wrote: wrote, coalesced: coalesced, refused: refused, title: lastTitle };
  };
})();
"#;

// ------------------------------------------------------- the black bar
//
// Job 2 (Osca, 6 Sep): *"the WebView stops ~60pt short of the bottom and the
// root view shows black"*. Not CSS. `wry` builds the WKWebView with the root
// view's `frame` -- a rectangle in the ROOT's superview's coordinate space --
// and then adds it as a subview of that same root, where the rectangle is read
// in the root's own space instead, so any non-zero origin is applied twice; and
// it sets no autoresizing mask, so whatever rectangle came out of that one
// instant is the rectangle forever. `ios/FrankWebView.m` has the long version
// and the three lines of wry that cause it.
//
// The fix has to be native and it has to be after the webview exists, which is
// what `with_webview` is for. Everything below is `cfg(target_os = "ios")`:
// there is no bar on the Mac, and `cargo test` targets macOS.

#[cfg(target_os = "ios")]
extern "C" {
    fn frank_webview_fill(webview: *mut std::ffi::c_void, out: *mut f64) -> i32;
}

/// How many doubles [`frank_webview_fill`] writes: root w,h after; webview
/// x,y,w,h before; window w,h before. `FrankWebView.m` writes exactly these.
#[cfg(target_os = "ios")]
const FILL_OUT: usize = 8;

/// What `FrankWebView.m` returns, as a sentence. `0` is success.
pub fn webview_fill_why(code: i32) -> &'static str {
    match code {
        0 => "ok",
        1 => "no webview pointer",
        2 => "the pointer is not a UIView",
        3 => "the webview has no superview -- nothing to fill",
        4 => "the webview is in no window -- nothing to size against the screen",
        _ => "unknown frank_webview_fill result",
    }
}

/// Make the one window's WKWebView fill its root view, and keep it filling.
///
/// `Wry` and not a generic `R` on purpose: `PlatformWebview` is the wry
/// runtime's, and `with_webview` downcasts to it -- spelling the runtime here
/// is the difference between a compile error and a panic on a runtime that is
/// never going to be swapped anyway.
///
/// The closure runs on the UI thread, dispatched, so this returns before the
/// work happens; the numbers arrive in the log a moment later. That is also
/// what makes it safe to call from `setup`, where the event loop has not
/// started and the first layout has not happened: the message is delivered
/// after both.
#[cfg(target_os = "ios")]
fn fill_root_view(window: &tauri::WebviewWindow<Wry>) {
    let sent = window.with_webview(|platform| {
        let mut out = [0f64; FILL_OUT];
        // SAFETY: `inner()` is this window's WKWebView, which is a UIView;
        // `out` is FILL_OUT doubles the callee writes and this frame owns.
        // Both outlive the call, and the call is on the UI thread.
        let code = unsafe { frank_webview_fill(platform.inner(), out.as_mut_ptr()) };
        if code == 0 {
            probe_note(&format!(
                "frank: webview fills the screen -- window was {:.0}x{:.0}, root now \
                 {:.0}x{:.0}, webview was ({:.0},{:.0}) {:.0}x{:.0}, now (0,0) {:.0}x{:.0}",
                out[6], out[7], out[0], out[1], out[2], out[3], out[4], out[5], out[0], out[1]
            ));
        } else {
            probe_note(&format!("frank: webview NOT filled -- {}", webview_fill_why(code)));
        }
    });
    if let Err(why) = sent {
        log::error!("frank: could not reach the webview to fill it -- {why}");
    }
}

// ------------------------------------------------------------- the probe
//
// A WKWebView's console goes nowhere a process log can read, and
// `xcrun simctl launch --console` reads the process log -- so the two numbers
// jobs 2 and 3 are judged on have to come out of the app itself, through the
// one door the page already has to the host: a `fetch` on its own origin.
//
// DEBUG BUILDS ONLY, both halves: the script is not injected in a release
// binary and the route is not answered there either, so `--release` has neither
// the script nor the handler (and neither build has a button: 10 Sep). It is here and not in `shell/` because `shell/`
// is another lane's folder and because a diagnostic that measures the host
// belongs to the host.

/// The path [`PROBE_JS`] reports to. Two leading underscores so it can never
/// collide with a file in the shell tree -- `resolve` would answer 404 for it
/// anyway, but the handler answers first.
const PROBE_PATH: &str = "/__probe";

/// The two measurements. NO BUTTON ANY MORE (Osca, 10 Sep, PROMPTS/phone-chrome.md
/// in TTSTV: *"No probe artifact."*): the 64x36 "probe" button this script
/// appended sat bottom-right over the reader's own controls -- the strip's speed
/// button at G-PHONE, the bar's mic now -- in every debug build Osca pressed.
/// The reader has real rendered audio now, so `adopt` below reports on ITS media
/// element and the sine the button played is not needed to have a sound to
/// measure. The button, the sine and the function that started it are deleted.
///
/// **The viewport (job 2).** `window.innerHeight * devicePixelRatio` against
/// `screen.height * devicePixelRatio`, plus the safe-area insets read off a
/// throwaway element -- because a webview that does not reach the bottom of the
/// screen reports `env(safe-area-inset-bottom)` as 0, so the shell's `--safe-*`
/// vars were right and describing the wrong box. Reported at load, at 1500 ms
/// (after UIKit has finished laying out), and on every resize.
///
/// **The sound (job 3).** Whatever media element plays first -- the reader's
/// own master, now that chapters are rendered -- is adopted, and every
/// `timeupdate` reports how many seconds it is since the app went to the
/// background. The last such line while `hidden=1` is the answer.
pub const PROBE_JS: &str = r#"(function () {
  "use strict";
  var MIN_MS = 1000;
  var media = null, playAt = 0, hiddenAt = 0, lastBeat = 0, resizeTimer = 0;

  function say(kind, fields) {
    var q = "/__probe?k=" + kind;
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        q += "&" + key + "=" + encodeURIComponent(String(fields[key]));
      }
    }
    try { fetch(q, { cache: "no-store" }).catch(function () {}); } catch (e) {}
  }

  /* ---------------------------------------------------------- the viewport */
  function viewport(why) {
    var d = window.devicePixelRatio || 1;
    var s = window.screen || {};
    var pad = document.createElement("div");
    pad.style.cssText = "position:fixed;left:0;top:0;width:0;visibility:hidden;" +
      "pointer-events:none;padding-top:env(safe-area-inset-top,0px);" +
      "padding-bottom:env(safe-area-inset-bottom,0px)";
    document.documentElement.appendChild(pad);
    var cs = window.getComputedStyle(pad);
    var safeTop = parseFloat(cs.paddingTop) || 0;
    var safeBottom = parseFloat(cs.paddingBottom) || 0;
    pad.parentNode.removeChild(pad);
    var inner = Math.round(window.innerHeight * d);
    var screenH = Math.round((s.height || 0) * d);
    /* the first-run gate's sheet, when it is up: its rect must sit inside
       0..innerWidth, which is the claim "the card is centred on the PHONE" */
    var card = document.querySelector(".ttstv-settings.fr-gate .fr-sheet");
    var r = card ? card.getBoundingClientRect() : null;
    var mq = window.matchMedia ? window.matchMedia("(max-width: 600px)") : null;
    say("viewport", {
      why: why, dpr: d,
      innerH: inner, screenH: screenH, fills: inner === screenH ? 1 : 0,
      innerW: Math.round(window.innerWidth * d),
      screenW: Math.round((s.width || 0) * d),
      cssW: window.innerWidth, cssH: window.innerHeight,
      cssScreenW: s.width || 0, cssScreenH: s.height || 0,
      band: Math.max(0, (s.height || 0) - window.innerHeight),
      phone: mq ? (mq.matches ? 1 : 0) : -1,
      cardL: r ? Math.round(r.left) : -1, cardR: r ? Math.round(r.right) : -1,
      cardW: r ? Math.round(r.width) : -1,
      cardIn: r ? ((r.left >= 0 && r.right <= window.innerWidth) ? 1 : 0) : -1,
      safeTop: safeTop, safeBottom: safeBottom
    });
  }

  /* ------------------------------------------------------------- the sound */
  function beat(what) {
    var now = Date.now();
    if (what === "tick" && now - lastBeat < MIN_MS) { return; }
    lastBeat = now;
    say("audio", {
      e: what,
      t: media ? media.currentTime.toFixed(2) : -1,
      paused: media ? (media.paused ? 1 : 0) : -1,
      secs: playAt ? Math.round((now - playAt) / 1000) : 0,
      hidden: document.hidden ? 1 : 0,
      bg: hiddenAt ? Math.round((now - hiddenAt) / 1000) : 0
    });
  }

  /* ---------------------------------------------------------------- wiring */
  function ready() {
    viewport("load");
    window.setTimeout(function () { viewport("settled"); }, 1500);
    window.addEventListener("resize", function () {
      if (resizeTimer) { return; }
      resizeTimer = window.setTimeout(function () { resizeTimer = 0; viewport("resize"); }, 250);
    });

    /* `adopt` is what makes this a probe of the APP: whatever media element
       plays first -- the reader's master -- is the one reported on. */
    function adopt(ev) {
      if (!media && ev && ev.target && typeof ev.target.currentTime === "number") { media = ev.target; }
    }
    document.addEventListener("timeupdate", function (ev) { adopt(ev); beat("tick"); }, true);
    document.addEventListener("play", function (ev) {
      adopt(ev); playAt = playAt || Date.now(); beat("play");
    }, true);
    document.addEventListener("pause", function () { beat("pause"); }, true);
    document.addEventListener("visibilitychange", function () {
      hiddenAt = document.hidden ? Date.now() : 0;
      beat(document.hidden ? "hidden" : "shown");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
"#;

/// The window's size on a desktop, and nothing at all on iOS.
///
/// THE WEBVIEW FRAME (Osca, 6 Sep): *"the WKWebView is 1024x768 and never
/// resizes to the screen"* -- a 560 px card centred at x~262, a black band
/// under the page. Job 2's fill was right and filling the wrong box: on iOS
/// `tao` builds the UIWindow, the root view and the view controller's view
/// from `inner_size` when one is given (`tao-0.35.3/src/platform_impl/ios/
/// window.rs`, `let frame = match window_attributes.inner_size { Some(dim) =>
/// CGRect { origin: screen_bounds.origin, size: dim }, None => screen_bounds }`),
/// so the 1100x800 meant for a Mac window was the PHONE's window, the root
/// view was 1100x800, and `frank_webview_fill` dutifully filled 1100x800 of
/// it. `min_inner_size` is a warning on iOS ("ignored") and nothing else.
///
/// Off iOS the two lines are what they were. On iOS the builder is returned
/// untouched and tao's `None` arm -- the screen's bounds -- is the frame; the
/// native fill then re-asserts the window against the screen as well, so a
/// size that ever sneaks back in here is corrected rather than obeyed.
fn desktop_size<'a, R: tauri::Runtime, M: Manager<R>>(
    b: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    #[cfg(target_os = "ios")]
    {
        b
    }
    #[cfg(not(target_os = "ios"))]
    {
        b.inner_size(1100.0, 800.0).min_inner_size(400.0, 400.0)
    }
}

/// Where the simulator's numbers land so a session without a macOS shell can
/// read them: `<repo>/scratch-probe/probe.log`, one line per probe, appended.
/// Compiled into a SIMULATOR DEBUG build and nothing else (`target_abi =
/// "sim"` is `aarch64-apple-ios-sim`; a device build has no host disk to write
/// and a release build has no probe). `CARGO_MANIFEST_DIR` is baked in at
/// compile time, which is the point -- the app knows the checkout it was built
/// from, and a simulator process runs as the Mac user with the host's disk.
#[cfg(all(debug_assertions, target_os = "ios", target_abi = "sim"))]
const PROBE_FILE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../scratch-probe/probe.log");

/// One probe line: the process log always, and [`PROBE_FILE`] on a simulator.
fn probe_note(line: &str) {
    log::info!("{line}");
    #[cfg(all(debug_assertions, target_os = "ios", target_abi = "sim"))]
    {
        use std::io::Write;
        let p = std::path::Path::new(PROBE_FILE);
        if let Some(dir) = p.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(p) {
            let _ = writeln!(f, "{line}");
        }
    }
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
        .invoke_handler(tauri::generate_handler![
            sync_discover,
            google_sign_in,
            audio_session_start,
            book_put,
            book_meta,
            book_list,
            book_remove
        ])
        // The launch scheme (`frank-pair://`, NOT the asset scheme). The
        // plugin is what turns an OS open into an event on iOS, macOS and
        // Android; on the phone the scheme itself is declared in
        // `tauri.conf.json`'s `plugins.deep-link.mobile`, which the plugin's
        // own build script writes into `CFBundleURLTypes`.
        .plugin(tauri_plugin_deep_link::init())
        // Google's consent page in the SYSTEM browser (job 26b): Google
        // refuses it inside a web view, and RFC 8252 §8.12 says an app must
        // not put it in one anyway. The plugin is registered here and gets
        // no permission on the page: `google_sign_in` below is the only way
        // to it, and it opens Google's authorization endpoint or nothing.
        .plugin(tauri_plugin_opener::init())
        .plugin(search::init())
        .manage(PendingPair::default())
        .manage(PendingGoogle::default())
        // `Wry` and not a generic `R`: `Builder::default()` is a
        // `Builder<Wry>`, and spelling it lets the closure's argument type be
        // written down rather than inferred through a `_`.
        .register_uri_scheme_protocol(SCHEME, |ctx: UriSchemeContext<'_, Wry>, request| {
            let app = ctx.app_handle();
            let root = shell_root(app);
            let books = books_root(app);
            let path = request.uri().path().to_string();

            // The probe (jobs 2 and 3), and nothing in a release binary:
            // `cfg!(debug_assertions)` is false there and `PROBE_JS` is not
            // injected there either. Answered before the disk is touched so a
            // measurement never depends on the shell being unpacked.
            if cfg!(debug_assertions) && path == PROBE_PATH {
                probe_note(&format!("frank: probe {}", request.uri().query().unwrap_or("")));
                return http_response(204, "text/plain; charset=utf-8", Vec::new());
            }

            // A DOCUMENT REQUEST IS THE DOOR'S OWN PROOF (7 Sep). The three
            // openers in `HOST_JS` navigate this webview, so the thing that
            // shows a tap opened the right book is the request the navigation
            // makes -- recorded HERE rather than from the page, because a page
            // that is navigating away is being torn down and a `fetch` it
            // started is not owed a delivery. Debug only, like the probe above;
            // documents only, so it is one line per page and not one per asset.
            if cfg!(debug_assertions) && is_document(&path) {
                probe_note(&format!(
                    "frank: page {}{}",
                    path,
                    request
                        .uri()
                        .query()
                        .map(|q| format!("?{q}"))
                        .unwrap_or_default()
                ));
            }

            // A book from the books folder (G-PULL); anything else from the
            // shell. A book that is not there is looked for once more in the
            // shell's own `books/` -- the dev shelf `tools/dev_books.py` embeds
            // for the simulator -- so both kinds open at the same URL.
            let disk = route(&root, &books, &path);
            let dev_shelf = disk
                .as_ref()
                .filter(|_| path.starts_with(BOOKS_PREFIX))
                .and_then(|_| resolve(&root, &path));

            for p in disk.iter().chain(dev_shelf.iter()) {
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

            // The sound's category, before any page can play anything. Not
            // the ACTIVATION -- that would stop the phone's music the moment
            // Frank opened; `audio_session_start` takes the session when the
            // reader first plays (FrankAudio.m's own note).
            match audio_session_category() {
                Ok(()) => log::info!("frank: audio session category = Playback/SpokenAudio"),
                Err(why) => log::error!("frank: audio session category NOT set: {why}"),
            }

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
            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::CustomProtocol(shell_url(HOME_PAGE).parse()?),
            )
            .title("Frank")
            .initialization_script(HOST_JS)
            // The book door (G-PULL): `TTSTVHost.books`, before any page
            // script, so `library/import.js` finds it when it loads and
            // keeps its books on disk instead of in a Cache that refuses
            // this scheme.
            .initialization_script(BOOKS_JS)
            // Separate from HOST_JS, and unconditional -- see PAIR_JS's own
            // note. Both run before the document's own scripts, so a page that
            // reads the key at load reads a key a link has already written.
            .initialization_script(PAIR_JS)
            // ...and Google's two names (job 26b), which are absent -- not
            // inert -- until an id is pasted into `google.json`.
            .initialization_script(google_js())
            // The lock screen and the audio session (job 8b). Unconditional,
            // like PAIR_JS: its `mediaSession` half runs in a browser too.
            .initialization_script(NOW_PLAYING_JS)
            // The probe, in a debug build and nowhere else: the empty string
            // rather than a second builder branch, because `WebviewWindowBuilder`
            // is a move-consuming chain and a `cfg!` on the value keeps it one
            // expression. An empty init script is a no-op, not an empty
            // `<script>`.
            .initialization_script(if cfg!(debug_assertions) { PROBE_JS } else { "" })
            // Every document, including the first: whatever a launch link left
            // pending is written here, once.
            .on_page_load(|window, _payload| flush_pair(window.app_handle()));
            // The desktop's 1100x800 -- and on iOS NOTHING, because tao makes
            // the UIWindow from `inner_size` (the webview frame, 6 Sep; the
            // long version is over `desktop_size`).
            let window = desktop_size(window).build()?;

            // The black bar (job 2). After `build`, because there is no
            // webview to reach into before it; dispatched, so it lands after
            // the first layout. Off iOS there is no bar and no symbol.
            #[cfg(target_os = "ios")]
            fill_root_view(&window);
            #[cfg(not(target_os = "ios"))]
            let _ = &window;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Frank");
}

/// Google's redirect into the key the shell polls, and clear it. Same
/// shape as [`flush_pair`] and called from it: one link, one write, and a
/// slot that has been taken cannot be written twice.
fn flush_google<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let pending = app
        .try_state::<PendingGoogle>()
        .and_then(|s| s.0.lock().ok().and_then(|mut slot| slot.take()));
    let Some(url) = pending else { return };
    match app.get_webview_window("main") {
        Some(w) => {
            if let Err(why) = w.eval(google_write_js(&url)) {
                log::error!("frank: could not write the Google redirect -- {why}");
            }
        }
        None => {
            if let Some(state) = app.try_state::<PendingGoogle>() {
                if let Ok(mut slot) = state.0.lock() {
                    *slot = Some(url);
                }
            }
        }
    }
}

/// Keep the last pairing link of a batch, and say in the log what happened to
/// the rest. A batch is normally one URL; the OS may hand over several, and a
/// link that is not ours (or is malformed) is dropped with its reason rather
/// than failing the open -- an app that refuses to launch because a QR was
/// wrong is worse than one that launches unpaired.
fn take_pair_links<R: tauri::Runtime, I: Iterator<Item = String>>(app: &tauri::AppHandle<R>, urls: I) {
    for u in urls {
        // Google's redirect (job 26b) comes through the same door and is
        // kept whole, in its own slot: `frank-pair://` is a pairing to
        // parse, this is a URL to hand back to the page that started it.
        if is_google_redirect(&u) {
            log::info!("frank: Google redirect");
            if let Some(state) = app.try_state::<PendingGoogle>() {
                if let Ok(mut slot) = state.0.lock() {
                    *slot = Some(u);
                }
            }
            continue;
        }
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
    flush_google(app);
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
    fn the_host_object_calls_its_two_commands_and_nothing_else() {
        // the page reaches the browse through window.TTSTVHost.syncDiscover
        // and the browse is the command build.rs declares; the reader reaches
        // the sheet through window.TTSTVHost.search and the sheet is the name
        // search.rs's wrapper answers (job 13) -- two commands, two calls
        assert!(HOST_JS.contains("window.TTSTVHost.syncDiscover"));
        assert!(HOST_JS.contains(r#"invoke("sync_discover""#));
        assert!(HOST_JS.contains("window.TTSTVHost.search = function (q)"));
        assert!(HOST_JS.contains(&format!(r#"invoke("{}", {{ query: web }})"#, search::CMD)));
        assert_eq!(HOST_JS.matches("invoke(").count(), 2, "two commands, two calls");
        assert!(HOST_JS.contains("const TAURI = window.__TAURI__ && window.__TAURI__.core")
            || HOST_JS.contains("var TAURI = window.__TAURI__ && window.__TAURI__.core"));
        assert!(HOST_JS.contains("if (!TAURI"), "a page outside Frank gets no host object");
    }

    #[test]
    fn search_is_the_desktop_hosts_shape_and_the_sheet_takes_the_site_form() {
        // the name and shape lookup.js guards on, exactly as desktop/src/host.js
        // spells them: q in, Promise<string | null> out, null for nothing
        assert!(HOST_JS.contains("// TTSTVHost.search(q: string) -> Promise<string | null>"));
        assert!(HOST_JS.contains(r#"const query = String(q == null ? "" : q).trim();"#));
        assert!(HOST_JS.contains("if (!query) return Promise.resolve(null);"));
        assert!(HOST_JS.contains(r#".then(() => "sheet")"#));
        // the -site: form is built HERE (search.rs never builds it), from the
        // mock's five domains in the mock's order -- host.js's own two lines
        let covered = r#"["gutenberg.org", "archive.org", "youtube.com", "wikipedia.org", "wiktionary.org"]"#;
        assert!(HOST_JS.contains(covered), "COVERED is the mock's list, in its order");
        assert!(HOST_JS.contains(r#"" -site:" + d"#));
        assert!(HOST_JS.contains("const web = webQuery(query);"));
        // and it is `web`, not the bare word, that crosses to the sheet
        assert!(!HOST_JS.contains(r#"invoke("frank_search", { query })"#));
        assert!(!HOST_JS.contains(r#"invoke("frank_search", { query: query })"#));
        // The sheet is the wrapper's (search.rs), reached through invoke and
        // nothing else -- `search` still touches neither location nor a door.
        // The blanket form of this ("HOST_JS never touches location", 6 Sep,
        // when search was the whole object) is REVERSED by Osca, 7 Sep: "Add
        // them as same-webview navigations ... No window.open anywhere on the
        // phone." So the ban is kept where it still holds, and `location` is
        // pinned to the one call the doors go through.
        assert_eq!(
            HOST_JS.matches("location.").count(),
            1,
            "one navigation in the whole object, and it is go()'s"
        );
        assert!(HOST_JS.contains("var go = function (url) { window.location.assign(url);"));
        assert!(!HOST_JS.contains("window.open"), "no window.open anywhere on the phone");
        assert!(!HOST_JS.contains(search::DOOR), "door one is search.rs's, not the host's");
    }

    #[test]
    fn the_three_doors_are_navigations_of_this_webview() {
        // Osca, 7 Sep: the count on disk was 0 for all three, so a tap on a
        // book did nothing -- window.open is inert in a WKWebView. The names
        // are the ones the shell already guards on (library/library.html
        // `openReader`/`openWindow`, bar/askbar.js `openReader`/`openLibrary`).
        assert!(HOST_JS.contains("window.TTSTVHost.openReader = function (slug, unit)"));
        assert!(HOST_JS.contains("window.TTSTVHost.openLibrary = function ()"));
        assert!(HOST_JS.contains("window.TTSTVHost.openWindow = function (kind, slug)"));
        // ...and the URLs are tabs.rs::url_for's, built in ONE place. These are
        // the same four strings that file's own `url_for` test asserts, minus
        // the desktop's `http://127.0.0.1:5555` base -- here the base is the
        // origin, so the paths are absolute.
        assert!(HOST_JS.contains(r#"if (kind === "library") return "/library/library.html";"#));
        assert!(HOST_JS.contains(r#"if (kind === "settings") return "/settings/settings.html";"#));
        assert!(HOST_JS.contains(r#"if (kind === "studio") return slug ? "/?slug=" + enc(slug) : "/";"#));
        assert!(HOST_JS.contains(r#"var u = "/reader/reader.html";"#));
        assert!(HOST_JS.contains(r#"u += "?book=books/" + enc(slug);"#));
        assert!(HOST_JS.contains(r#"if (unit) u += "&ch=" + enc(unit);"#));
        // host.js's rule, kept: a first argument that is not a kind is a slug
        assert!(HOST_JS.contains(r#"if (!KINDS[kind]) { slug = kind; kind = "reader"; }"#));
        assert!(HOST_JS.contains(r#"var KINDS = { reader: 1, studio: 1, library: 1 };"#));
        // a door is not a command: still two invokes, still the two commands
        assert_eq!(HOST_JS.matches("invoke(").count(), 2, "the doors invoke nothing");
    }

    #[test]
    fn a_document_is_what_the_doors_probe_line_counts() {
        assert!(is_document("/reader/reader.html"));
        assert!(is_document("/library/library.html"));
        assert!(is_document("/"));
        assert!(is_document(""));
        // not one line per asset
        assert!(!is_document("/reader/lookup.js"));
        assert!(!is_document("/books/eclogues-virgil/book-data.js"));
        assert!(!is_document("/reader/reader.css"));
        assert!(!is_document(PROBE_PATH));
    }

    // ------------------------------------------------- Google (job 26b)

    #[test]
    fn the_client_id_is_read_from_google_json_and_the_scheme_is_its_reverse() {
        // the file exists and is the shape the ONE field is scanned out of
        assert!(GOOGLE_JSON.contains("ios_client_id"), "google.json has lost its field");
        assert_eq!(json_field(r#"{"a": "x", "ios_client_id": "12-ab.apps.googleusercontent.com"}"#,
                              "ios_client_id"), "12-ab.apps.googleusercontent.com");
        assert_eq!(json_field(r#"{"ios_client_id": ""}"#, "ios_client_id"), "");
        assert_eq!(json_field(r#"{"other": "x"}"#, "ios_client_id"), "");
        // and whatever is pasted, the redirect is Google's own reverse form
        let id = google_ios_client_id();
        if id.is_empty() {
            assert_eq!(google_redirect_uri(), "", "no id -> no redirect, and no host object");
            assert_eq!(google_js(), "", "no id -> the page is told there is no Google here");
            assert!(!is_google_redirect("com.googleusercontent.apps.12-ab:/oauth?code=x"));
        } else {
            let number = id.strip_suffix(".apps.googleusercontent.com")
                .expect("an iOS client id ends .apps.googleusercontent.com");
            assert_eq!(google_redirect_scheme(), format!("com.googleusercontent.apps.{number}"));
            assert_eq!(google_redirect_uri(), format!("com.googleusercontent.apps.{number}:/oauth"));
            assert!(is_google_redirect(&format!("{}:/oauth?code=4/x", google_redirect_scheme())));
            assert!(!is_google_redirect("frank-pair://v1?url=x"));
            let js = google_js();
            assert!(js.contains(r#"invoke("google_sign_in""#) && js.contains("window.TTSTVHost.google"));
            assert!(js.contains("if (!TAURI"), "a page outside Frank gets no sign-in");
            assert!(!js.contains("client_secret"), "an iOS client has none, and this crate carries none");
        }
    }

    #[test]
    fn the_redirect_is_written_into_the_one_key_the_shell_polls() {
        // the key `library/drive.js` polls, and one setItem -- nothing else
        assert_eq!(GOOGLE_REDIRECT_KEY, "ttstv.sync.googleRedirect");
        let js = google_write_js("com.googleusercontent.apps.12-ab:/oauth?code=4/x&state=s");
        assert!(js.contains(r#""ttstv.sync.googleRedirect""#));
        assert!(js.contains(r#"4\/x"#), "the URL is a JSON string, escaped by json_string");
        assert_eq!(js.matches("setItem").count(), 1);
        assert!(!js.contains("eval") && !js.contains("<script"));
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

/// The book door (G-PULL, 11 Sep). Everything here but the last test is
/// std-only -- no Tauri, no webview -- so it is provable by extraction in a
/// shell with no Xcode (the session that wrote it compiled these with a bare
/// `rustc --test` against this file's own functions). `cargo test` on the Mac
/// is the whole proof.
#[cfg(test)]
mod book_tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let d = std::env::temp_dir().join(format!("frank-books-{name}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn a_book_is_served_from_the_books_folder_and_nothing_leaves_it() {
        let shell = Path::new("/tmp/shell");
        let books = Path::new("/tmp/books");
        assert_eq!(
            route(shell, books, "/books/eclogues-en/book-data.js").unwrap(),
            books.join("eclogues-en").join("book-data.js")
        );
        assert_eq!(
            route(shell, books, "/books/eclogues-en/chapters/c001.txt").unwrap(),
            books.join("eclogues-en").join("chapters").join("c001.txt")
        );
        // resolve's refusals, one root over
        for bad in [
            "/books/../x",
            "/books/../../etc/passwd",
            "/books/%2e%2e/x",
            "/books/a/../../shell/index.html",
            "/books/",
        ] {
            assert!(route(shell, books, bad).is_none(), "{bad}");
        }
        // ...and the crate's own names are never served
        for mine in [
            "/books/eclogues-en/.meta.json",
            "/books/eclogues-en/.hash",
            "/books/.part/eclogues-en@ab/book.json",
            "/books/.old/eclogues-en@ab-1/book.json",
        ] {
            assert!(route(shell, books, mine).is_none(), "{mine}");
        }
        // the shell is where it was
        assert_eq!(
            route(shell, books, "/library/library.html").unwrap(),
            shell.join("library").join("library.html")
        );
        assert_eq!(route(shell, books, "/").unwrap(), shell.join("index.html"));
        assert!(route(shell, books, "/../etc/passwd").is_none());
        // the prefix spelt in escapes is a shell path, and it stays in the shell
        assert_eq!(route(shell, books, "/%62ooks/x.js").unwrap(), shell.join("books").join("x.js"));
        assert_eq!(route(shell, books, "/books").unwrap(), shell.join("books"));
        // a book's name is decoded like any other path
        assert_eq!(
            route(shell, books, "/books/a%20b/book.json").unwrap(),
            books.join("a b").join("book.json")
        );
    }

    #[test]
    fn a_book_files_path_and_names_are_refused_in_words() {
        assert_eq!(book_rel("book.json").unwrap(), PathBuf::from("book.json"));
        assert_eq!(
            book_rel("audio/c001.opus").unwrap(),
            Path::new("audio").join("c001.opus")
        );
        for bad in ["", "/etc/passwd", "../x", "a/../../x", "a//b", "./x", "a\\b", ".meta.json", "chapters/.hash", "a/"] {
            let why = book_rel(bad).unwrap_err();
            assert!(!why.is_empty(), "{bad:?}");
        }
        assert!(book_slug_ok("eclogues-en").is_ok() && book_slug_ok("c001").is_ok());
        for bad in ["", "-a", "A", "les-pensées", "a/b", "..", "a b", "a.b"] {
            assert!(book_slug_ok(bad).is_err(), "{bad:?}");
        }
        assert!(book_hash_ok("0123456789abcdef").is_ok());
        for bad in ["", "ABCDEF", "xyz", "01/2", &"a".repeat(65)] {
            assert!(book_hash_ok(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_write_cannot_leave_the_books_folder() {
        let books = scratch("escape");
        for bad in ["../x", "/etc/passwd", "a/../../x", "a//b", ".meta.json", "chapters/.hash", "a\\b", "", "./x"] {
            assert!(book_write(&books, "a", "01", bad, b"x").is_err(), "{bad:?}");
        }
        assert!(book_write(&books, "A", "01", "x", b"x").is_err());
        assert!(book_write(&books, "a", "XY", "x", b"x").is_err());
        assert!(book_write(&books, "a/b", "01", "x", b"x").is_err());
        assert!(book_write(&books, "..", "01", "x", b"x").is_err());
        assert!(!books.join(BOOKS_PART).exists(), "a refused write writes nothing");
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn a_pull_has_no_row_until_its_commit_and_a_new_version_replaces_the_old() {
        let books = scratch("commit");
        assert_eq!(book_write(&books, "eclogues-en", "aaaa", "book.json", b"{}").unwrap(), 2);
        book_write(&books, "eclogues-en", "aaaa", "chapters/c001.txt", b"arma").unwrap();
        assert!(book_rows(&books).is_empty(), "files and no row: not on the shelf");
        assert!(!books.join("eclogues-en").exists(), "and not at the reader's URL either");

        let row = r#"{"slug":"eclogues-en","hash":"aaaa","title":"The Bucolics and Eclogues"}"#;
        assert!(book_commit(&books, "eclogues-en", "aaaa", row).unwrap().is_empty());
        assert_eq!(fs::read(books.join("eclogues-en").join("chapters").join("c001.txt")).unwrap(), b"arma");
        let rows = book_rows(&books);
        assert_eq!(rows.len(), 1);
        assert_eq!((rows[0].0.as_str(), rows[0].2.as_str()), ("eclogues-en", "aaaa"));
        assert_eq!(rows[0].1.as_deref(), Some(row));

        // a newer version, half-pulled: the installed one is untouched
        book_write(&books, "eclogues-en", "bbbb", "book.json", b"{\"v\":2}").unwrap();
        assert_eq!(fs::read(books.join("eclogues-en").join("book.json")).unwrap(), b"{}");
        assert_eq!(book_rows(&books)[0].2, "aaaa");
        // ...committed: it is swapped in whole, and the one it replaced is named and gone
        assert_eq!(book_commit(&books, "eclogues-en", "bbbb", "{}").unwrap(), vec!["eclogues-en@aaaa".to_string()]);
        assert_eq!(fs::read(books.join("eclogues-en").join("book.json")).unwrap(), b"{\"v\":2}");
        assert!(!books.join("eclogues-en").join("chapters").exists(), "no file of the old version lingers");
        assert_eq!(fs::read_dir(books.join(BOOKS_OLD)).map(|d| d.count()).unwrap_or(0), 0);
        assert!(!book_part(&books, "eclogues-en", "bbbb").exists());

        // the same version again replaces nothing; a row with no files is refused
        book_write(&books, "eclogues-en", "bbbb", "book.json", b"{\"v\":2}").unwrap();
        assert!(book_commit(&books, "eclogues-en", "bbbb", "{}").unwrap().is_empty());
        assert!(book_commit(&books, "hamlet", "cccc", "{}").unwrap_err().contains("after its files"));
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn remove_takes_the_book_and_its_half_pulled_versions_and_no_neighbour() {
        let books = scratch("remove");
        book_write(&books, "a", "01", "book.json", b"1").unwrap();
        book_commit(&books, "a", "01", "{}").unwrap();
        book_write(&books, "a", "02", "book.json", b"2").unwrap();
        book_write(&books, "ab", "01", "book.json", b"3").unwrap();
        book_commit(&books, "ab", "01", "{}").unwrap();
        assert_eq!(book_delete(&books, "a").unwrap(), 2, "the installed one and the half-pulled one");
        let left: Vec<String> = book_rows(&books).into_iter().map(|r| r.0).collect();
        assert_eq!(left, vec!["ab".to_string()], "a slug that starts the same is a different book");
        assert_eq!(book_delete(&books, "a").unwrap(), 0);
        assert!(book_delete(&books, "../x").is_err());
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn a_book_file_is_served_with_the_type_the_cache_gave_it() {
        assert_eq!(content_type(Path::new("chapters/c001.txt")), "text/plain; charset=utf-8");
        assert_eq!(content_type(Path::new("book-data.js")), "text/javascript; charset=utf-8");
        assert_eq!(content_type(Path::new("audio/c001.opus")), "audio/ogg");
        assert_eq!(content_type(Path::new("audio/c001.m4a")), "audio/mp4");
    }

    /// The wiring: four commands, declared (build.rs), granted (the
    /// capability), handled (`generate_handler!`), and one door that calls
    /// them -- `put` with the bytes as the raw body.
    #[test]
    fn the_book_door_is_four_commands_and_put_sends_the_raw_body() {
        let js = BOOKS_JS;
        assert_eq!(js.matches("invoke(").count(), 4);
        assert!(js.contains(r#"TAURI.invoke("book_put", bytes, { headers: {"#), "the bytes are the body, not an argument");
        assert!(js.contains(r#""frank-book-slug": enc(slug)"#) && js.contains(r#""frank-book-rel": enc(rel)"#));
        assert!(js.contains(r#"invoke("book_meta", { slug: slug, hash: hash, meta: meta })"#));
        assert!(js.contains(r#"invoke("book_list")"#) && js.contains(r#"invoke("book_remove", { slug: slug })"#));
        assert!(js.contains("if (!TAURI"), "a page outside Frank gets no door");
        assert_eq!(BOOK_SLUG_HEADER, "frank-book-slug");
        assert_eq!(BOOK_HASH_HEADER, "frank-book-hash");
        assert_eq!(BOOK_REL_HEADER, "frank-book-rel");
        assert_eq!(HOST_JS.matches("invoke(").count(), 2, "HOST_JS keeps its two");
        let build = include_str!("../build.rs");
        let cap = include_str!("../capabilities/default.json");
        let lib = include_str!("lib.rs");
        for (cmd, perm) in [
            ("book_put", "allow-book-put"),
            ("book_meta", "allow-book-meta"),
            ("book_list", "allow-book-list"),
            ("book_remove", "allow-book-remove"),
        ] {
            assert!(build.contains(&format!("\"{cmd}\"")), "build.rs declares {cmd}");
            assert!(cap.contains(&format!("\"{perm}\"")), "the capability grants {perm}");
            assert!(lib.contains(&format!("            {cmd},\n")) || lib.contains(&format!("            {cmd}\n")),
                    "generate_handler! handles {cmd}");
        }
        assert!(lib.contains(".initialization_script(BOOKS_JS)"));
    }
}
