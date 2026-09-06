//! The search sheet: `frank_search` on a phone is an `SFSafariViewController`.
//!
//! Job 13, 6 September, off `design/reader/search.html`. The app's search bar
//! shows results IN the app, in three lanes -- **BOOKS** (the search tool's own
//! rows), **VIDEOS** (YouTube's results page in the pane) and **WEB**, which is
//! one row, "Search the web", carrying the query as it will be sent: the words,
//! then `-site:` for every source the app already covers. Pressing that row, and
//! pressing Search in the word panel, must land on the web **without leaving the
//! reader** -- which on iOS means a sheet over the app, not a jump to Safari.
//!
//! # What this file is, in one line
//!
//! One native door -- `SFSafariViewController` -- and two knocks at it.
//!
//! ## Knock one: the anchor
//!
//! `design/reader/search.html`'s WEB row is already written, and it is a plain
//! anchor:
//!
//! ```text
//! r.href = "x-web-search://?" + encodeURIComponent(webQuery());
//! ```
//!
//! `x-web-search:` is the platform's own spelling for "hand this to the default
//! search engine" and it is what the mock chose (`design/reader/STATUS.md`:
//! *"the platform already decided it; no"*). In a browser it still means that.
//! Inside Frank it never leaves the page: [`init`]'s `on_navigation` sees the
//! address, **cancels the navigation**, and opens the sheet instead. Nothing in
//! `bar/` had to be written for this, and nothing in `bar/` may be changed by it.
//!
//! ## Knock two: the command
//!
//! `reader/lookup.js` (TTSTV) has carried the other caller since job 15c, and
//! its shape is a contract that file states in prose:
//!
//! ```text
//! invoke("frank_search", { query: q })   // tried first, everywhere
//! WebviewWindow  900x700                 // a Frank whose Rust lacks it
//! window.open                            // a browser
//! ```
//!
//! **A bare command name cannot be served by a plugin.** `tauri`'s webview
//! router (`webview/mod.rs`, `request.cmd.strip_prefix("plugin:")`) sends
//! anything without that prefix to the *app's* `generate_handler!` and nowhere
//! else; and with an app ACL manifest present -- this crate has one, `build.rs`
//! declares three commands -- an unknown command is refused before it is
//! dispatched. Registering `frank_search` properly therefore means a line in
//! `src/lib.rs`'s `generate_handler!`, a line in `build.rs`'s command list and a
//! line in `capabilities/default.json` -- and `lib.rs` was another session's open
//! file on 6 September, which is the day this had to work. So this file asks for
//! none of the three. It ships
//! [`SEARCH_JS`], which the plugin injects, and which makes exactly one command
//! name -- `frank_search`, and no other -- resolve by walking through door one.
//! Everything else `invoke` is asked to do goes to the real `invoke` untouched.
//!
//! When `frank_search` does become a real command in `lib.rs`, [`SEARCH_JS`]
//! is what should be deleted; the `on_navigation` door stays, because the
//! anchor in the mock stays.
//!
//! # Why cancelling a navigation is the strongest form of "back returns"
//!
//! The sheet's Done button has to put the reader back where it was: same
//! chapter, same word, same scroll, audio uninterrupted. Nothing here restores
//! any of that, and nothing needs to -- **the reader never navigates.**
//! `WKNavigationActionPolicyCancel` means the load is not started, so
//! `didCommitNavigation` never fires, the document is never torn down, and the
//! page that comes back from under the sheet is the same page object that was
//! there before. The proof is an absence, and it is enforced here: every road
//! into the sheet is a navigation this file returns `false` for.
//!
//! # The engine
//!
//! `SFSafariViewController` takes a URL. It cannot be handed "whatever the
//! phone's default search engine is" -- that is what `x-web-search:` means to
//! Safari, and there is no API that answers it. So the sheet must name an
//! engine, and the one this app has already named is `reader/lookup.js`'s:
//!
//! ```text
//! const SEARCH = "https://www.google.com/search?q=";   // lookup.js:251
//! ```
//!
//! [`SEARCH`] is that constant, spelled the same, and a test says so. Nothing
//! else goes in the URL and nothing is taken out of the query -- the `-site:`
//! exclusions arrive already in it, built once in the page from the mock's own
//! `COVERED` list, and this file never builds, adds to, or trims that list.
//! Reversing the engine is one constant here and one in `lookup.js`.
//!
//! # Off iOS
//!
//! Every door is `cfg(target_os = "ios")`. On the Mac the plugin allows the
//! navigation and the desktop lane's 900x700 `WebviewWindow` road is untouched;
//! `cargo test` targets macOS, so the `extern "C"` block is not compiled and the
//! pure functions below are what run.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime, Url,
};

// --------------------------------------------------------------- the constants

/// The command name `reader/lookup.js` invokes, and the only one [`SEARCH_JS`]
/// interferes with.
pub const CMD: &str = "frank_search";

/// Door one. The scheme `design/reader/search.html`'s WEB row already writes.
/// Matched case-insensitively on the scheme only; everything after it is the
/// query, `encodeURIComponent`d by the page.
pub const DOOR: &str = "x-web-search:";

/// Door two, and the engine. Byte-identical to `reader/lookup.js`'s `SEARCH`
/// (line 251): a URL that arrives at this prefix is *already* the search URL --
/// it is `lookup.js`'s last-ditch `window.open` on a Frank where [`SEARCH_JS`]
/// never installed -- so it is passed through unchanged rather than rebuilt.
pub const SEARCH: &str = "https://www.google.com/search?q=";

// ------------------------------------------------------------------ the codec
//
// `encodeURIComponent` and its inverse, written out rather than pulled in. Two
// reasons, and neither is fashion. The first is that this file is proved by
// extraction -- lifted whole into a dependency-free crate and run -- which a
// `percent-encoding` call would end. The second is that the exact escape set
// matters: the query crosses from the page to here and back out to Google, and
// the two roads (`SEARCH_JS` -> here, and `lookup.js`'s own `encodeURIComponent`
// -> `window.open`) must produce the SAME URL or "the same press" is two
// different searches.

/// `encodeURIComponent`'s unreserved set: `A-Z a-z 0-9 - _ . ! ~ * ' ( )`.
///
/// Not `percent_encoding::NON_ALPHANUMERIC` (which escapes all ten of the
/// punctuation marks) and not Python's `quote(safe="")` (which keeps only
/// `-_.~`). Those three disagree on `!*'()`; a query with an apostrophe in it
/// -- *Spinoza's Ethics* -- is where the disagreement shows.
fn unreserved(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')')
}

/// UTF-8 bytes, `%XX` in UPPER-case hex for everything outside [`unreserved`].
pub fn encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        if unreserved(b) {
            out.push(b as char);
        } else {
            out.push('%');
            out.push_str(&format!("{b:02X}"));
        }
    }
    out
}

/// The inverse. **`+` is a plus, not a space**: `encodeURIComponent` writes a
/// space as `%20` and never as `+`, so a `+` that arrives here was typed, and
/// `application/x-www-form-urlencoded`'s rule would silently rewrite the query.
/// A stray `%` with nothing usable after it is kept as a `%`, which is what a
/// browser does and is the only behaviour that cannot lose a character.
pub fn decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let hi = (b[i + 1] as char).to_digit(16);
            let lo = (b[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                out.push((hi * 16 + lo) as u8);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

// ------------------------------------------------------------------ the doors

/// The query carried by a door-one address, still percent-encoded.
///
/// Tolerant of all three spellings a URL parser can hand back for a scheme with
/// no host -- `x-web-search://?q`, `x-web-search:?q`, `x-web-search://q` -- and
/// of the scheme's case, because `Url` lower-cases it and a hand-typed anchor
/// may not. Everything after the first `?` (or, with no `?`, everything after
/// the scheme and its slashes) is the query.
pub fn door_query(nav: &str) -> Option<&str> {
    let head = nav.get(..DOOR.len())?;
    if !head.eq_ignore_ascii_case(DOOR) {
        return None;
    }
    let rest = &nav[DOOR.len()..];
    let rest = rest.strip_prefix("//").unwrap_or(rest);
    let q = match rest.find('?') {
        Some(i) => &rest[i + 1..],
        None => rest,
    };
    // A fragment is not part of the query. `encodeURIComponent` writes `#` as
    // `%23`, so a `#` that survives to here was never in the words.
    let q = match q.find('#') {
        Some(i) => &q[..i],
        None => q,
    };
    if q.is_empty() {
        None
    } else {
        Some(q)
    }
}

/// The address the sheet should open for a navigation, or `None` to let the
/// navigation happen.
///
/// This is the whole of the routing decision, and it is a pure function of a
/// string so that it can be read, argued with, and tested without a phone.
///
/// * door one -- decode the page's query and put it back through [`encode`], so
///   one encoder decides the final URL no matter which road the query came by;
/// * door two -- already the search URL, passed through byte for byte;
/// * everything else -- `None`. The reader's own `frank://` assets, the VIDEOS
///   lane's YouTube frame, Studio on the LAN: all untouched.
pub fn sheet_url(nav: &str) -> Option<String> {
    if let Some(q) = door_query(nav) {
        return Some(format!("{SEARCH}{}", encode(&decode(q))));
    }
    if nav.len() > SEARCH.len() && nav.starts_with(SEARCH) {
        return Some(nav.to_string());
    }
    None
}

// -------------------------------------------------------------------- the JS
//
// Injected by the plugin (`Builder::js_init_script`), and the timing is the
// interesting part.
//
// A plugin's init script runs BEFORE `window.__TAURI__` exists. Tauri builds the
// list in `manager/webview.rs::prepare_webview`: the internals object, the ipc
// script, the core script, then `plugin_init_scripts` (line 202) -- and only
// then, at line 216, `plugin_global_api_scripts`, which is the bundled global
// API that defines `window.__TAURI__` under `withGlobalTauri: true`. Patching at
// install time would therefore patch nothing, silently, and the failure would
// look like "the sheet does not open on the phone".
//
// So `install()` is idempotent and is called three times: now (in case the order
// ever changes), at `DOMContentLoaded`, and at `load`. All three are long before
// the first press -- `lookup.js` reads `__TAURI__.core.invoke` inside its own
// `search()`, at the moment a finger lands on the button. No timer, no polling,
// and where `__TAURI__` never appears at all (a browser, the design bench)
// nothing is patched and `lookup.js`'s own second and third landings run, which
// is exactly what they are for.

/// `window.__TAURI__.core.invoke`, with one name intercepted.
///
/// The wrapper is deliberately blind to everything but [`CMD`]: `sync_discover`,
/// `google_sign_in`, `audio_session_start` and every core command are forwarded
/// with `apply`, arguments and `this` untouched. It marks itself so a second
/// injection -- another webview, a reload, a future caller of `install()` -- is
/// a no-op rather than a second layer of wrapping.
///
/// It touches `window.TTSTVHost` not at all. That object is `lib.rs`'s
/// (`HOST_JS`, `PAIR_JS`, `NOW_PLAYING_JS`), it is injected after this script,
/// and two files writing one object is how a merge goes wrong.
pub const SEARCH_JS: &str = r#"(function () {
  "use strict";
  var CMD = "frank_search";
  var DOOR = "x-web-search://?";
  var MARK = "__frankSearchSheet";

  /* The command, and the whole of it: turn the query into door one and let
     Rust cancel the navigation. Resolves rather than returns nothing, because
     reader/lookup.js reads the promise to decide the press landed here. */
  function open(query) {
    var q = String(query == null ? "" : query);
    if (!q) return Promise.reject(new Error("a search needs a query"));
    try { window.location.href = DOOR + encodeURIComponent(q); }
    catch (e) { return Promise.reject(e); }
    return Promise.resolve(null);
  }

  function install() {
    var core = window.__TAURI__ && window.__TAURI__.core;
    if (!core || typeof core.invoke !== "function" || core.invoke[MARK]) return;
    var real = core.invoke;
    function invoke(cmd, args) {
      if (cmd === CMD) return open(args && args.query);
      return real.apply(this, arguments);
    }
    invoke[MARK] = true;
    core.invoke = invoke;
  }

  install();
  document.addEventListener("DOMContentLoaded", install);
  window.addEventListener("load", install);
})();
"#;

// ------------------------------------------------------------------- the sheet

#[cfg(target_os = "ios")]
extern "C" {
    fn frank_search_present(url: *const std::os::raw::c_char) -> i32;
}

/// What `ios/FrankSearch.m` returns, as a sentence. `0` is success.
pub fn present_why(code: i32) -> &'static str {
    match code {
        0 => "ok",
        1 => "the address has a NUL in it and cannot cross to C",
        2 => "the address is not http(s) -- SFSafariViewController takes nothing else",
        3 => "no view controller on screen to present the sheet from",
        4 => "not iOS -- there is no sheet here",
        _ => "unknown frank_search_present result",
    }
}

/// Open the sheet over the app.
///
/// The presentation itself is dispatched to the main queue by the Objective-C
/// side (presenting a modal from inside `decidePolicyForNavigationAction`'s
/// decision handler is how WebKit gets wedged), so a `0` here means *handed
/// over*, not *on screen*. The one failure worth a code -- nothing to present
/// from -- is still checked synchronously when the call already arrives on the
/// main thread, which is where a navigation decision comes from.
pub fn present(url: &str) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        // SAFETY: a C function taking a NUL-terminated string and returning an
        // int, defined in `src-tauri/ios/FrankSearch.m` and compiled into this
        // binary by `build.rs` (the `cc` crate, archive `franksearch`). The
        // pointer is valid for the length of the call and is copied into an
        // NSString before it returns.
        let c = match std::ffi::CString::new(url) {
            Ok(c) => c,
            Err(_) => return Err(present_why(1).into()),
        };
        let code = unsafe { frank_search_present(c.as_ptr()) };
        if code == 0 {
            Ok(())
        } else {
            Err(present_why(code).into())
        }
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = url;
        Err(present_why(4).into())
    }
}

// ------------------------------------------------------------------ the plugin

/// The two lines `src/lib.rs` carries are `mod search;` and
/// `.plugin(search::init())`. Everything else about the search sheet is in this
/// file and in `ios/FrankSearch.m`.
///
/// No command, and so **no ACL entry**: a plugin command would be
/// `plugin:search|…` and would need a permission in `capabilities/default.json`,
/// another session's file. What is granted here is nothing at all -- a page can
/// ask for a navigation, which is a thing every page could already do.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("search")
        .js_init_script(SEARCH_JS)
        .on_navigation(|_webview, url: &Url| {
            let Some(target) = sheet_url(url.as_str()) else {
                return true;
            };
            #[cfg(target_os = "ios")]
            {
                // Through `probe_note` (lib.rs) and not `log::` alone: on a
                // simulator debug build that line also lands in
                // `scratch-probe/probe.log`, which is how a session with no
                // macOS shell reads that the press reached the sheet, and with
                // which address (the webview frame, 6 Sep).
                match present(&target) {
                    Ok(()) => crate::probe_note(&format!("frank: search sheet -> {target}")),
                    Err(why) => crate::probe_note(&format!("frank: search sheet refused: {why} ({target})")),
                }
                // Cancelled either way. A door that opened nothing must not fall
                // through to a real navigation -- that is the reader leaving.
                false
            }
            #[cfg(not(target_os = "ios"))]
            {
                log::info!("frank: search sheet is iOS only -- allowing {target}");
                true
            }
        })
        .build()
}

// ----------------------------------------------------------------------- tests
//
// The numbers, and where they come from. `design/reader/search.html` is the only
// source for the query and the exclusions: `QUERY` is "Spinoza Ethics", `COVERED`
// is the five domains in the order below, and `webQuery()` is the words followed
// by " -site:" and each domain. `MOCK_ENC` is what `encodeURIComponent` makes of
// that -- generated by node from the mock's own two lines, not typed by hand.

#[cfg(test)]
mod tests {
    use super::*;

    /// `design/reader/search.html`'s `COVERED`, in its order.
    const COVERED: [&str; 5] = [
        "gutenberg.org",
        "archive.org",
        "youtube.com",
        "wikipedia.org",
        "wiktionary.org",
    ];
    /// `webQuery()` for the mock's one query.
    const MOCK_Q: &str = "Spinoza Ethics -site:gutenberg.org -site:archive.org -site:youtube.com -site:wikipedia.org -site:wiktionary.org";
    /// `encodeURIComponent(webQuery())`.
    const MOCK_ENC: &str = "Spinoza%20Ethics%20-site%3Agutenberg.org%20-site%3Aarchive.org%20-site%3Ayoutube.com%20-site%3Awikipedia.org%20-site%3Awiktionary.org";

    fn mock_web_query() -> String {
        let mut q = String::from("Spinoza Ethics");
        for d in COVERED {
            q.push_str(" -site:");
            q.push_str(d);
        }
        q
    }

    #[test]
    fn the_exclusion_list_is_the_mocks() {
        assert_eq!(mock_web_query(), MOCK_Q);
        for d in COVERED {
            assert!(MOCK_Q.contains(&format!(" -site:{d}")), "{d} is not excluded");
        }
        assert_eq!(MOCK_Q.matches(" -site:").count(), 5);
    }

    #[test]
    fn the_engine_is_lookup_js_s() {
        // reader/lookup.js:251 -- `const SEARCH = "https://www.google.com/search?q=";`
        assert_eq!(SEARCH, "https://www.google.com/search?q=");
    }

    #[test]
    fn encode_is_encodeuricomponent() {
        assert_eq!(encode(MOCK_Q), MOCK_ENC);
        assert_eq!(encode(" "), "%20");
        assert_eq!(encode(":"), "%3A");
        assert_eq!(encode("+"), "%2B");
        assert_eq!(encode("&"), "%26");
        assert_eq!(encode("#"), "%23");
        assert_eq!(encode("/"), "%2F");
        assert_eq!(encode("?"), "%3F");
        // the ten `encodeURIComponent` keeps and `NON_ALPHANUMERIC` would not
        assert_eq!(encode("-_.!~*'()"), "-_.!~*'()");
        // and one beyond ASCII, as UTF-8 bytes
        assert_eq!(encode("Éthique"), "%C3%89thique");
    }

    #[test]
    fn decode_is_the_inverse_and_a_plus_is_a_plus() {
        assert_eq!(decode(MOCK_ENC), MOCK_Q);
        assert_eq!(encode(&decode(MOCK_ENC)), MOCK_ENC, "round trip is byte-stable");
        assert_eq!(decode("a+b"), "a+b");
        assert_eq!(decode("100%"), "100%");
        assert_eq!(decode("%zz"), "%zz");
        assert_eq!(decode("%C3%89thique"), "Éthique");
    }

    #[test]
    fn door_one_is_the_mocks_anchor() {
        let href = format!("x-web-search://?{MOCK_ENC}");
        assert_eq!(door_query(&href), Some(MOCK_ENC));
        assert_eq!(
            sheet_url(&href).as_deref(),
            Some(format!("{SEARCH}{MOCK_ENC}").as_str())
        );
    }

    #[test]
    fn door_one_takes_every_spelling_a_url_parser_can_hand_back() {
        for href in [
            format!("x-web-search://?{MOCK_ENC}"),
            format!("x-web-search:?{MOCK_ENC}"),
            format!("x-web-search://{MOCK_ENC}"),
            format!("X-Web-Search://?{MOCK_ENC}"),
        ] {
            assert_eq!(
                sheet_url(&href).as_deref(),
                Some(format!("{SEARCH}{MOCK_ENC}").as_str()),
                "{href}"
            );
        }
    }

    #[test]
    fn an_empty_search_opens_nothing() {
        assert_eq!(door_query("x-web-search://?"), None);
        assert_eq!(door_query("x-web-search://"), None);
        assert_eq!(sheet_url("x-web-search://?"), None);
    }

    #[test]
    fn door_two_is_passed_through_byte_for_byte() {
        let u = format!("{SEARCH}Gerontion");
        assert_eq!(sheet_url(&u).as_deref(), Some(u.as_str()));
        // the bare prefix is not a search
        assert_eq!(sheet_url(SEARCH), None);
    }

    #[test]
    fn nothing_else_is_touched() {
        for nav in [
            "frank://localhost/reader/reader.html",
            "frank://localhost/index.html",
            "https://www.youtube.com/results?search_query=Spinoza%20Ethics",
            "https://www.youtube.com/watch?v=abc",
            "http://192.168.1.24:8000/state",
            "https://en.wiktionary.org/api/rest_v1/page/definition/ethics",
            "https://www.google.com/",
            "https://accounts.google.com/o/oauth2/v2/auth?client_id=x",
            "about:blank",
            "",
        ] {
            assert_eq!(sheet_url(nav), None, "{nav} should have been left alone");
        }
    }

    #[test]
    fn the_shim_intercepts_one_name_and_installs_three_times() {
        assert!(SEARCH_JS.contains(&format!("var CMD = \"{CMD}\";")));
        assert!(SEARCH_JS.contains("cmd === CMD"));
        assert!(SEARCH_JS.contains("real.apply(this, arguments)"), "everything else passes through");
        assert_eq!(SEARCH_JS.matches("location.href").count(), 1, "one road out");
        assert!(SEARCH_JS.contains("x-web-search://?"));
        assert!(SEARCH_JS.contains("encodeURIComponent"));
        // installed now, at DOMContentLoaded and at load -- and nowhere else
        assert_eq!(SEARCH_JS.matches("\n  install();").count(), 1, "called once at the top");
        assert_eq!(SEARCH_JS.matches("install);").count(), 2);
        assert!(SEARCH_JS.contains("DOMContentLoaded") && SEARCH_JS.contains("\"load\""));
        assert!(!SEARCH_JS.contains("setTimeout") && !SEARCH_JS.contains("setInterval"),
                "no timer, no polling");
        // idempotent, and out of lib.rs's way
        assert!(SEARCH_JS.contains("core.invoke[MARK]"));
        assert!(!SEARCH_JS.contains("TTSTVHost"), "that object is lib.rs's");
    }

    #[test]
    fn the_codes_have_sentences() {
        assert_eq!(present_why(0), "ok");
        for c in 1..=4 {
            assert!(!present_why(c).starts_with("unknown"), "code {c} has no sentence");
        }
        assert!(present_why(9).starts_with("unknown"));
    }

    #[test]
    fn off_ios_there_is_no_sheet() {
        // `cargo test` targets macOS; this is the branch that runs there.
        #[cfg(not(target_os = "ios"))]
        assert_eq!(present("https://www.google.com/search?q=x"), Err(present_why(4).to_string()));
    }
}
