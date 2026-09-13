//! Apple's own Look Up panel, for the word the reader asked about -- and the
//! one question that decides whether the control offering it exists at all.
//!
//! # Why this file is two commands and not three
//!
//! G-LOOKUP-2 (TTSTV `dictionary/STATUS.md`, `9e37f00`, 13 Sep) measured what
//! "search the OS dictionary" can honestly mean on iOS, over 23,837 calls on an
//! iPhone 17 Pro simulator with Apple's English and French dictionaries actually
//! downloaded. Three of its numbers are the whole design of this module:
//!
//! * `dictionaryHasDefinitionForTerm:` returns **a Bool and nothing else**, and
//!   costs **31-95 ms a word** (p95 129 ms, worst single call 353 ms). It does
//!   not parallelise (four queues, x1.1), it has no cache to warm, and it does
//!   no prefix matching. Asking it per word would cost **23 s on a median
//!   chapter and 112 s on a long one**.
//! * The panel itself opens for **any** typed term in **535-620 ms** warm, and
//!   **none of its text is in our process** (0 text views, 2 remote scene hosts,
//!   counted twice).
//! * iOS ships **no Latin, no Ancient Greek and no Sanskrit** dictionary in any
//!   version. Against our own headwords Apple can define **1.9%** of Latin and
//!   **0.1%** of Ancient Greek.
//!
//! Osca took the recommendation on the 13th: **one press for ours, a second
//! named press for Apple's, and the control is decided once per book from the
//! book's language** (K-L1). So there is no `lookup_has` here. A per-word Bool
//! is the one thing the measurement rules out, and a command that exists is a
//! command somebody calls in a loop.
//!
//! [`offered`] is that once-per-book question, and it is a pure function of a
//! language code so it can be read, argued with and tested without a phone.
//! [`lookup_apple`] is the press.
//!
//! # What this module may and may not do with the panel
//!
//! Apple's terms: the panel may be presented "modally or as part of another
//! interface"; it "should not be used to display wordlists, create a standalone
//! dictionary app, or republish the content". Presenting it for the word the
//! reader asked about is inside the letter. Reading it, caching it, re-drawing
//! it, speaking it, or building a word list out of it is not -- and none of
//! those is possible from here anyway, which is the useful half of "0 of its
//! text is in our process". **Nothing comes back but a success code.**
//!
//! # Off iOS
//!
//! `UIReferenceLibraryViewController` is UIKit's. `cargo test` targets macOS, so
//! the `extern "C"` block is not compiled there and [`offered`] -- the part
//! worth arguing about -- is what runs. The command answers `false` off iOS
//! whatever the language, because the honest question the page is asking is
//! "will this press do something", not "does Apple have a dictionary
//! somewhere".

use std::ffi::CString;

// ------------------------------------------------------- iOS's own language list

/// The **primary subtags** of iOS's 32 monolingual definition dictionaries, as
/// Apple publishes them (iOS Feature Availability, Dictionary), lower-case and
/// sorted.
///
/// Apple's page names them in words -- *Bulgarian, Cantonese (Traditional),
/// Catalan, Chinese (Simplified), Chinese (Traditional, Hong Kong), Chinese
/// (Traditional), Croatian, Danish, Dutch, English (United Kingdom), English
/// (United States), French, German, Greek, Hebrew, Hindi, Hungarian, Italian,
/// Japanese, Korean, Malay, Norwegian, Polish, Portuguese, Punjabi, Romanian,
/// Russian, Spanish, Swedish, Thai, Turkish, Vietnamese* -- and a book carries a
/// code (`core/bookdata.py`'s `lang`: `en`, `fr`, `la`, `el`, `grc`). This is
/// that list as codes, which is why three entries look like duplicates and are
/// not: the two Englishes and the three Chineses collapse to one subtag each.
///
/// **The 40 bilingual pairs are deliberately not here.** They are translation
/// dictionaries, they are only ever *X - English*, and the recommendation this
/// module implements says the control appears on the **definition** list. A
/// language reachable only through a bilingual pair would show a control that
/// opens a panel of translations rather than the definition the reader pressed
/// for, and "two clean states, never a blend" is the whole point.
///
/// Norwegian is `no`, `nb` and `nn`, and Hebrew is `he` and `iw`, because a
/// catalogue row, an epub and an ISO table do not agree about which spelling is
/// the language -- and being wrong here costs a control that should be there,
/// or offers one that leads to "No Content Found".
pub const DEF_LANGS: [&str; 34] = [
    "bg",  // Bulgarian
    "ca",  // Catalan
    "da",  // Danish
    "de",  // German
    "el",  // Greek -- MODERN Greek. `grc` is not here and never will be.
    "en",  // English (United Kingdom) and English (United States)
    "es",  // Spanish
    "fr",  // French
    "he",  // Hebrew
    "hi",  // Hindi
    "hr",  // Croatian
    "hu",  // Hungarian
    "it",  // Italian
    "iw",  // Hebrew, the legacy subtag
    "ja",  // Japanese
    "ko",  // Korean
    "ms",  // Malay
    "nb",  // Norwegian Bokmal
    "nl",  // Dutch
    "nn",  // Norwegian Nynorsk
    "no",  // Norwegian
    "pa",  // Punjabi
    "pl",  // Polish
    "pt",  // Portuguese
    "ro",  // Romanian
    "ru",  // Russian
    "sv",  // Swedish
    "th",  // Thai
    "tr",  // Turkish
    "vi",  // Vietnamese
    "yue", // Cantonese (Traditional)
    "zh",  // Chinese (Simplified), (Traditional) and (Traditional, Hong Kong)
    "zh-hans",
    "zh-hant",
];

/// A language tag's primary subtag, lower-case: `el-GR` -> `el`, `zh_Hant` ->
/// `zh`, `  LA ` -> `la`. Both separators, because a book's `lang` has come off
/// an epub, a catalogue row and a parser, and all three spell it differently.
fn primary(lang: &str) -> String {
    let t = lang.trim().to_ascii_lowercase();
    let cut = t.find(['-', '_']).unwrap_or(t.len());
    t[..cut].to_string()
}

/// **Does iOS ship a definition dictionary for this book's language?**
///
/// Pure, and asked **once per book**. Not "is one installed on this phone" --
/// there is no API that answers that, and the only per-term signal is the 31-95
/// ms Bool this module refuses to put on the path of a press. So this is the
/// honest question: is the control worth showing at all.
///
/// `zh-Hant` is accepted whole as well as by its subtag; everything else is
/// decided on the subtag, so `pt-BR`, `en-GB` and `nb-NO` all answer yes.
pub fn offered(lang: &str) -> bool {
    let t = lang.trim().to_ascii_lowercase();
    if DEF_LANGS.contains(&t.as_str()) {
        return true;
    }
    let p = primary(&t);
    !p.is_empty() && DEF_LANGS.contains(&p.as_str())
}

// ----------------------------------------------------------------- the panel

#[cfg(target_os = "ios")]
extern "C" {
    fn frank_lookup_present(term: *const std::os::raw::c_char) -> i32;
}

/// What `ios/FrankLookup.m` returns, as a sentence. `0` is success.
pub fn present_why(code: i32) -> &'static str {
    match code {
        0 => "ok",
        1 => "the word has a NUL in it and cannot cross to C",
        2 => "there is no word to look up",
        3 => "no view controller on screen to present the panel from",
        4 => "not iOS -- Apple's dictionary panel is UIKit's",
        _ => "unknown frank_lookup_present result",
    }
}

/// Present Apple's panel for `term`, as a half sheet over the reader.
///
/// K-L2's answer, and the reason it is a half sheet: the reader stays visible
/// behind it, so the two states are side by side rather than one on top of the
/// other. All three shapes measured at 535-620 ms, so the choice cost nothing.
///
/// The presentation is dispatched to the main queue by the Objective-C side, so
/// a `0` here means *handed over*, not *on screen* -- `FrankSearch.m`'s rule,
/// and its reason. **A term with no entry still opens a panel saying "No Content
/// Found"**, which is exactly why the control that calls this does not exist for
/// a language [`offered`] says no to.
pub fn present(term: &str) -> Result<(), String> {
    if term.trim().is_empty() {
        return Err(present_why(2).into());
    }
    #[cfg(target_os = "ios")]
    {
        // SAFETY: a C function taking a NUL-terminated string and returning an
        // int, defined in `src-tauri/ios/FrankLookup.m` and compiled into this
        // binary by `build.rs` (the `cc` crate, archive `franklookup`). The
        // pointer is valid for the length of the call and is copied into an
        // NSString before it returns.
        let c = match CString::new(term) {
            Ok(c) => c,
            Err(_) => return Err(present_why(1).into()),
        };
        let code = unsafe { frank_lookup_present(c.as_ptr()) };
        if code == 0 {
            Ok(())
        } else {
            Err(present_why(code).into())
        }
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = CString::new("");
        Err(present_why(4).into())
    }
}

// --------------------------------------------------------------- the commands

/// `TTSTVHost.lookupApple(word)`: the SECOND press, and the last one.
///
/// It is reached only from the one control at the foot of our own card
/// (`reader/lookup.js`), which is only drawn when [`lookup_apple_offered`] has
/// said yes for the book's language.
#[tauri::command]
pub fn lookup_apple(term: String) -> Result<(), String> {
    let r = present(&term);
    match &r {
        Ok(()) => log::info!("frank: apple panel for {term:?}"),
        Err(why) => log::info!("frank: apple panel refused: {why}"),
    }
    r
}

/// `TTSTVHost.lookupAppleOffered(lang)`: asked **once per book**, at open.
///
/// `false` off iOS whatever the language: the page is asking whether the press
/// will do something here, and off the phone there is no panel to present.
#[tauri::command]
pub fn lookup_apple_offered(lang: String) -> bool {
    cfg!(target_os = "ios") && offered(&lang)
}

// ---------------------------------------------------------------------- the JS
//
// Its own init script rather than a line in `HOST_JS`, which is what
// G-LOOKUP-2 §6 sketched. Two reasons, and the first is mechanical: two tests
// in `lib.rs` pin `HOST_JS.matches("invoke(").count()` to 2 ("HOST_JS keeps its
// two"), so a third and a fourth `invoke` there is a red suite in another
// lane's file. The second is the house pattern: `dict.rs` already carries its
// own `DICT_JS` writing `window.TTSTVHost.dict`, for the same reason -- the
// door and the script that opens it in one file, so neither can be moved
// without the other. The names are G-LOOKUP-2 §6's, unchanged.

/// `window.TTSTVHost.lookupApple` and `.lookupAppleOffered`, and nothing else.
///
/// Guarded like the book door and the pack door: a page outside Frank gets
/// neither, and `reader/lookup.js` reads `typeof TTSTVHost.lookupApple ===
/// "function"` as its only test -- with the method absent there is no Apple
/// control on the card at all, which is the right answer on the Mac and in a
/// browser, where the reading column has the OS's own Look Up already.
pub const LOOKUP_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  // lookupApple(word) -> Promise<null>: Apple's own panel, as a half sheet over
  // the reader. Nothing of Apple's comes back -- none of its text is in this
  // process -- so the answer is only that the sheet was handed over.
  window.TTSTVHost.lookupApple = function (word) {
    var term = String(word == null ? "" : word).trim();
    if (!term) return Promise.reject(new Error("there is no word to look up"));
    return TAURI.invoke("lookup_apple", { term: term }).then(function () { return null; });
  };
  // lookupAppleOffered(lang) -> Promise<boolean>: ONCE PER BOOK, from the
  // book's language. Never per word: the per-word question costs 31-95 ms.
  window.TTSTVHost.lookupAppleOffered = function (lang) {
    return TAURI.invoke("lookup_apple_offered", { lang: String(lang == null ? "" : lang) });
  };
})();
"#;

// ----------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    /// The list is Apple's, and it is the DEFINITION list.
    #[test]
    fn the_list_is_apples_thirty_two_definition_languages() {
        // 32 names, and three pairs of them share a subtag (the two Englishes,
        // the three Chineses) -- so 30 distinct subtags, plus the four spare
        // spellings the doc comment names (iw, nb, nn, and zh-hant/zh-hans as
        // whole tags) minus `no`/`nb`/`nn` counted once each.
        let mut sorted = DEF_LANGS;
        sorted.sort_unstable();
        assert_eq!(sorted, DEF_LANGS, "the list is sorted, so a reader can find a code in it");
        let mut seen = DEF_LANGS.to_vec();
        seen.dedup();
        assert_eq!(seen.len(), DEF_LANGS.len(), "a code is named once");
        for c in DEF_LANGS {
            assert!(!c.is_empty() && c == c.to_ascii_lowercase(), "{c} is not a lower-case code");
        }
    }

    /// **The two languages this product is actually about are not on it**, and
    /// that is the whole reason the packs exist (la 1.9%, grc 0.1%).
    #[test]
    fn there_is_no_latin_and_no_ancient_greek() {
        for c in ["la", "grc", "sa", "la-x-classical", "GRC", " grc "] {
            assert!(!offered(c), "iOS does not ship a dictionary for {c:?}");
        }
    }

    /// The four languages this repo's `books/` actually carries today
    /// (28 `en`, 5 `fr`, 3 `la`, 1 `el`).
    #[test]
    fn the_books_we_have_answer_the_way_the_report_says() {
        assert!(offered("en"), "Moby-Dick gets the control");
        assert!(offered("fr"), "Les Pensees gets the control");
        assert!(!offered("la"), "the Eclogues do not");
        // The Iliad is tagged `el` (a standing decision, 12 Sep) and iOS DOES
        // ship a Greek dictionary, so the control is there. What it will define
        // is another matter -- the sweep found 8 of 1,000 Homeric forms, and
        // that is coverage, not availability. The control is honest either way:
        // it says "Apple", it does not promise an answer.
        assert!(offered("el"), "modern Greek is on Apple's list");
    }

    #[test]
    fn a_region_or_a_script_is_still_the_language() {
        for c in ["en-GB", "en_US", "pt-BR", "zh-Hant", "zh_Hans", "nb-NO", "EL-GR", "fr-CA"] {
            assert!(offered(c), "{c} should be offered");
        }
        assert_eq!(primary("zh_Hant"), "zh");
        assert_eq!(primary("  EL-GR "), "el");
        assert_eq!(primary(""), "");
    }

    #[test]
    fn nothing_is_offered_for_nothing() {
        for c in ["", "   ", "-", "_", "xx", "zz-ZZ"] {
            assert!(!offered(c), "{c:?} should not be offered");
        }
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
    fn off_ios_there_is_no_panel_and_no_control() {
        // `cargo test` targets macOS; this is the branch that runs there.
        #[cfg(not(target_os = "ios"))]
        {
            assert_eq!(present("shepherd"), Err(present_why(4).to_string()));
            assert!(!lookup_apple_offered("en".into()), "off iOS the press would do nothing");
        }
        // and an empty term is refused before the platform is even asked
        assert_eq!(present("   "), Err(present_why(2).to_string()));
    }

    /// The door: **two** commands and no third one. A `lookup_has` would be a
    /// 31-95 ms Bool somebody would eventually call in a loop, and the whole
    /// recommendation is that nothing of Apple's is on the path of a press.
    #[test]
    fn the_door_is_two_commands_declared_granted_handled_and_injected() {
        let js = LOOKUP_JS;
        assert_eq!(js.matches("invoke(").count(), 2, "two commands, and no third");
        assert!(js.contains(r#"invoke("lookup_apple", { term: term })"#));
        assert!(js.contains(r#"invoke("lookup_apple_offered", { lang:"#));
        assert!(!js.contains("lookup_has"), "the per-word Bool is not a door");
        assert!(js.contains("if (!TAURI"), "a page outside Frank gets no door");

        let build = include_str!("../build.rs");
        let cap = include_str!("../capabilities/default.json");
        let lib = include_str!("lib.rs");
        for (cmd, perm) in [
            ("lookup_apple", "allow-lookup-apple"),
            ("lookup_apple_offered", "allow-lookup-apple-offered"),
        ] {
            assert!(build.contains(&format!("\"{cmd}\"")), "build.rs declares {cmd}");
            assert!(cap.contains(&format!("\"{perm}\"")), "the capability grants {perm}");
            assert!(
                lib.contains(&format!("            lookup::{cmd},\n")),
                "generate_handler! handles {cmd}"
            );
        }
        assert!(build.contains("ios/FrankLookup.m"), "build.rs compiles the panel");
        assert!(lib.contains(".initialization_script(lookup::LOOKUP_JS)"));
        assert_eq!(HOST_JS_TWO, 2);
    }

    /// `HOST_JS` is another lane's file and two of its tests pin this number.
    /// Spelled here so that a future session that moves these two names into
    /// `HOST_JS` has to look at those tests first.
    const HOST_JS_TWO: usize = 2;
}
