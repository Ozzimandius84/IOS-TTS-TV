//! The native voice: `AVSpeechSynthesizer` behind a door the page already
//! knows how to open.
//!
//! # What this is for, in one paragraph
//!
//! D1(a) (13 Sep) pointed `window.speechSynthesis` at a chapter, and on a Mac
//! that is the whole answer. On a phone it is half of one. iOS suspends a
//! backgrounded WKWebView's JavaScript, so a reader that speaks one sentence
//! and asks the page for the next goes quiet at the lock screen -- which is
//! the exact moment "listen along while doing something else" begins. Web
//! speech also offers four controls and no SSML (it was dropped from the
//! spec), so D6's thesis -- *"we do not need a better synthesiser, we need a
//! better SCRIPT"* -- has nothing to play on. `AVSpeechSynthesizer` fixes both:
//! it takes a QUEUE that outlives the page's own liveness, and since iOS 16 it
//! takes SSML.
//!
//! # The shape, and why it is not a second engine
//!
//! `reader/sysvoice.js` was written against an interface, not against
//! `speechSynthesis`: `create()` takes `opts.synth` and `opts.Utterance` and
//! calls `speak`, `cancel`, `getVoices`, `speaking`, `pending`, `onboundary`,
//! `onend`. So the native engine is presented to it as **an object of that
//! shape** (`SysVoice.createNativeSynth`), and the engine cannot tell which
//! one it has. Nothing about the sentence cut, the boundary->word-id map, the
//! rebase or the cursor changes, and `design/reader/test-sysvoice.mjs`'s 25
//! assertions cover both engines because they are the same engine.
//!
//! The one thing the interface grew is `synth.queues`. A synth that says
//! `true` is handed the rest of the chapter at once instead of one sentence at
//! a time; that is the lock screen, and it is the only structural difference
//! between the two paths.
//!
//! # What crosses the FFI boundary
//!
//! Strings in, four ints out -- `kind`, `uid`, `location`, `length` -- through
//! one C function pointer registered at start-up. No object, no allocation to
//! free, nothing to drop in an order. `ios/FrankSpeech.m` holds the other
//! half.
//!
//! **The id is never interpreted here.** The map from utterance id to sentence
//! lives in the adapter that made both. Rust carries the number.
//!
//! # Off iOS
//!
//! `AVSpeechSynthesizer` is AVFoundation's. `cargo test` targets macOS, so the
//! `extern "C"` block is not compiled there and what runs is [`av_rate`] and
//! [`why`] -- which is, deliberately, the part worth arguing about.
//! [`speech_available`] answers `false` off iOS whatever else is true, because
//! the page's honest question is "will speaking through this door work here",
//! and off the phone the answer is no and the page should use its own
//! `speechSynthesis`.

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

// ------------------------------------------------------------------- the rate

/// Apple's own `AVSpeechUtteranceDefaultSpeechRate`. Normal speech.
pub const AV_NORMAL: f64 = 0.5;
/// Apple's own `AVSpeechUtteranceMinimumSpeechRate` and `...Maximum...`.
pub const AV_MIN: f64 = 0.0;
pub const AV_MAX: f64 = 1.0;

/// A web-speech RATE (a multiple of normal) as an `AVSpeechUtteranceRate`.
///
/// The two scales do not agree and something has to convert. `utterance.rate`
/// on the web is a multiple: 1 is normal, 2 is twice as fast.
/// `AVSpeechUtterance.rate` is a number from 0 to 1 with **0.5** as normal and
/// a curve of Apple's own that is not published.
///
/// **This is a straight line through Apple's one published point, and it is a
/// REFERENCE, not a measurement** -- the same standing this file's neighbour
/// gives `BASE_WPM` in `reader/sysvoice.js`, and for the same reason: it is
/// exact where it is anchored (`m = 1` is `0.5` by definition), it is a guess
/// everywhere else, and it can be corrected by A NUMBER rather than by taste.
/// The number that would correct it is `SysVoice.stats().wpm` read off a
/// phone -- words boundaried over seconds elapsed, which this door reports for
/// the native engine exactly as it does for the web one.
///
/// **The cap is real and worth saying out loud:** the line reaches Apple's
/// maximum at `m = 2`, so a phone will not speak faster than twice normal
/// through this door however high `wpm` goes. [`av_rate_capped`] is how a
/// caller finds out, and the reader can then say so rather than silently
/// disobeying the Settings row.
pub fn av_rate(multiple: f64) -> f64 {
    if !multiple.is_finite() || multiple <= 0.0 {
        return AV_NORMAL;
    }
    (AV_NORMAL * multiple).clamp(AV_MIN, AV_MAX)
}

/// Was the rate clipped -- i.e. is the phone about to speak slower than asked?
pub fn av_rate_capped(multiple: f64) -> bool {
    multiple.is_finite() && multiple > 0.0 && AV_NORMAL * multiple > AV_MAX
}

// ---------------------------------------------------------------- the C door

/// The event kinds `FrankSpeech.m` sends. Kept in step with the enum at the
/// top of that file, and with `EVENT` in [`SPEECH_JS`] -- three lists, one
/// order, and the test at the bottom holds two of them together.
pub const KIND_START: i32 = 1;
pub const KIND_WORD: i32 = 2;
pub const KIND_END: i32 = 3;
pub const KIND_CANCEL: i32 = 4;
pub const KIND_PAUSE: i32 = 5;
pub const KIND_CONTINUE: i32 = 6;

/// Bytes for the voice list. Every voice on a phone with a dozen languages
/// downloaded is a few tens of kilobytes; 256 KiB is room for a phone with
/// every one of them and is a single allocation asked for once at open.
const VOICES_CAP: usize = 256 * 1024;

#[cfg(target_os = "ios")]
extern "C" {
    fn frank_speech_init(cb: extern "C" fn(i32, i32, i32, i32)) -> i32;
    fn frank_speech_speak(
        text: *const std::os::raw::c_char,
        lang: *const std::os::raw::c_char,
        voice_id: *const std::os::raw::c_char,
        rate: f64,
        pitch: f64,
        volume: f64,
        ssml: i32,
        uid: i32,
    ) -> i32;
    fn frank_speech_cancel() -> i32;
    fn frank_speech_pause() -> i32;
    fn frank_speech_resume() -> i32;
    fn frank_speech_speaking() -> i32;
    fn frank_speech_voices(out: *mut std::os::raw::c_char, cap: i32) -> i32;
}

/// What `FrankSpeech.m` returns, as a sentence. `0` is success.
pub fn why(code: i32) -> &'static str {
    match code {
        0 => "ok",
        1 => "the text is not valid UTF-8 or has a NUL in it",
        2 => "there is nothing to say",
        3 => "the speech door was never opened -- frank_speech_init has not run",
        4 => "not iOS -- AVSpeechSynthesizer is AVFoundation's",
        5 => "no voice installed for that language",
        6 => "SSML needs iOS 16 and this phone is older",
        7 => "the SSML did not parse -- Apple returned no utterance",
        _ => "unknown frank_speech result",
    }
}

// ------------------------------------------------------- the way back to JS
//
// A boundary is a message going the OTHER way: the phone has something to say
// and the page did not ask for it. There are two ways to do that in Tauri and
// this is the one the app already uses -- `webview.eval`, the same door
// `pair_write_js` and `google_write_js` go through in `lib.rs`. The other,
// `emit`, would need the page granted `core:event` and would put a second
// mechanism in a file that has one.
//
// COST, because "per word" deserves a number: the corpus reads at 3.56 words a
// second typically (`scratch-float/ANSWER.md` §1), so this is about four short
// `eval`s a second while speaking and none at all while silent. The lock
// screen's own writer next door is rate-limited to one a second because a
// title is a repaint; a boundary is a variable assignment in a page that is
// very often not even visible.

static APP: OnceLock<tauri::AppHandle<tauri::Wry>> = OnceLock::new();

/// The one C callback. Every event from the synthesiser arrives here, on the
/// main thread, and leaves as one line of JavaScript.
///
/// It cannot fail in a way worth reporting: a page that has navigated away has
/// no `__frankSpeech` and the call is a no-op by construction (the guard is in
/// the emitted line, not here), and a webview that has gone is an `Err` that
/// would arrive four times a second if it were logged.
#[cfg(target_os = "ios")]
extern "C" fn on_event(kind: i32, uid: i32, location: i32, length: i32) {
    let Some(app) = APP.get() else { return };
    let Some(w) = tauri::Manager::get_webview_window(app, "main") else { return };
    let _ = w.eval(&format!(
        "window.__frankSpeech&&window.__frankSpeech({kind},{uid},{location},{length})"
    ));
}

/// Open the door: hand `FrankSpeech.m` the callback and remember the app.
///
/// Called once, from `setup`, and only the FIRST call counts -- `OnceLock`, so
/// a second one cannot leave the C side pointing at a handle this side has
/// replaced. A no-op off iOS that still remembers the handle, so the shape of
/// the code is the same on both and the `cfg` is one line rather than a fork.
pub fn open(app: &tauri::AppHandle<tauri::Wry>) {
    if APP.set(app.clone()).is_err() {
        log::info!("frank: speech door already open");
        return;
    }
    #[cfg(target_os = "ios")]
    {
        // SAFETY: a C function taking a function pointer and returning an int,
        // defined in `src-tauri/ios/FrankSpeech.m` and compiled into this
        // binary by `build.rs` (the `cc` crate, archive `frankspeech`). The
        // pointer is to an `extern "C" fn` with static lifetime; the C side
        // stores it and calls it on the main thread.
        let code = unsafe { frank_speech_init(on_event) };
        if code == 0 {
            log::info!("frank: speech door open -- AVSpeechSynthesizer, boundaries to the page");
        } else {
            log::error!("frank: speech door NOT open: {}", why(code));
        }
    }
    #[cfg(not(target_os = "ios"))]
    log::info!("frank: no speech door here -- the page uses its own speechSynthesis");
}

// ----------------------------------------------------------------- the shapes

/// One sentence to speak, with the id its events will carry.
///
/// The id is the page's and is never re-used: a cancelled utterance may still
/// deliver a boundary after the cancel, and an id that came round again would
/// land that boundary on a live sentence. `FrankSpeech.m`'s own note says the
/// same thing from the other side.
#[derive(Debug, Clone, Deserialize)]
pub struct Line {
    pub id: i32,
    pub text: String,
}

/// Everything one `speak` shares: the voice, the rate, and whether the text is
/// SSML. One per batch, because a chapter is read in one voice -- and because
/// a per-sentence voice would be a `<lang>` switch, which is SSML's job and
/// not this struct's (D6's whole point).
#[derive(Debug, Clone, Deserialize)]
pub struct Say {
    pub lines: Vec<Line>,
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub voice: Option<String>,
    /// A MULTIPLE of normal, web-speech units. Converted by [`av_rate`].
    #[serde(default = "one")]
    pub rate: f64,
    #[serde(default = "one")]
    pub pitch: f64,
    #[serde(default = "one")]
    pub volume: f64,
    #[serde(default)]
    pub ssml: bool,
}
fn one() -> f64 {
    1.0
}

/// What a `speak` did: how many were queued, and the two honesties -- the rate
/// the phone will actually use, and whether that is slower than asked.
#[derive(Debug, Clone, Serialize)]
pub struct Queued {
    pub queued: usize,
    pub rate: f64,
    pub capped: bool,
}

/// One installed voice, in `speechSynthesis.getVoices()`'s own shape so
/// `sysvoice.js::pickVoice` ranks a native list with the code it already has.
/// `quality` is the addition: AVFoundation reports it as a field, where the
/// Mac's web voices carry it in the NAME ("Daniel (Enhanced)").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Voice {
    pub name: String,
    pub lang: String,
    #[serde(rename = "voiceURI")]
    pub voice_uri: String,
    #[serde(rename = "localService")]
    pub local_service: bool,
    #[serde(rename = "default")]
    pub is_default: bool,
    pub quality: String,
}

// --------------------------------------------------------------- the commands

/// `TTSTVHost.speech.available()`: is there a native synthesiser here at all.
///
/// `false` off iOS whatever else is true. The page's question is "should I use
/// this door or my own `speechSynthesis`", and on the Mac the answer is its
/// own -- which already speaks with the same system voices and does not have a
/// lock screen to survive.
#[tauri::command]
pub fn speech_available() -> bool {
    cfg!(target_os = "ios")
}

/// `TTSTVHost.speech.voices()`: every installed voice.
///
/// Asked once when the reader opens and again on nothing: the list changes
/// only when somebody downloads a voice in Settings, which is a trip out of
/// the app and back.
#[tauri::command]
pub fn speech_voices() -> Result<Vec<Voice>, String> {
    #[cfg(target_os = "ios")]
    {
        let mut buf = vec![0_u8; VOICES_CAP];
        // SAFETY: the callee writes at most `cap` bytes into `buf` and
        // NUL-terminates; `buf` outlives the call and is owned by this frame.
        let n = unsafe {
            frank_speech_voices(buf.as_mut_ptr() as *mut std::os::raw::c_char, VOICES_CAP as i32)
        };
        if n < 0 {
            return Err(match n {
                -2 => "the voice list is longer than the buffer".to_string(),
                -3 => "the voice list could not be encoded".to_string(),
                _ => "no buffer for the voice list".to_string(),
            });
        }
        buf.truncate(n as usize);
        let text = String::from_utf8(buf).map_err(|_| "the voice list is not UTF-8".to_string())?;
        serde_json::from_str(&text).map_err(|e| format!("the voice list did not parse: {e}"))
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = VOICES_CAP;
        Ok(Vec::new())
    }
}

/// `TTSTVHost.speech.speak(say)`: queue these sentences and start.
///
/// **The whole remainder of a chapter arrives in one of these**, which is the
/// point: once it is queued, nothing of ours needs to be running for the
/// reading to go on, so the screen can lock and the app can go to the back.
/// See `FrankSpeech.m`'s note on `frank_speech_speak`.
///
/// It does NOT cancel first. A caller that wants the queue replaced -- a rate
/// change, a voice change, a pause, a seek -- calls [`speech_stop`] and then
/// this, which is exactly what `sysvoice.js`'s `rebase` already does for the
/// web engine. Two calls rather than a flag, because "stop" is a thing the
/// reader does on its own as well.
#[tauri::command]
pub fn speech_speak(say: Say) -> Result<Queued, String> {
    let rate = av_rate(say.rate);
    let capped = av_rate_capped(say.rate);
    let lines: Vec<&Line> = say.lines.iter().filter(|l| !l.text.trim().is_empty()).collect();
    if lines.is_empty() {
        return Err(why(2).into());
    }
    #[cfg(target_os = "ios")]
    {
        use std::ffi::CString;
        let lang = say.lang.as_deref().filter(|s| !s.is_empty()).map(CString::new);
        let voice = say.voice.as_deref().filter(|s| !s.is_empty()).map(CString::new);
        let lang = match lang {
            Some(Ok(c)) => Some(c),
            Some(Err(_)) => return Err(why(1).into()),
            None => None,
        };
        let voice = match voice {
            Some(Ok(c)) => Some(c),
            Some(Err(_)) => return Err(why(1).into()),
            None => None,
        };
        let lang_p = lang.as_ref().map_or(std::ptr::null(), |c| c.as_ptr());
        let voice_p = voice.as_ref().map_or(std::ptr::null(), |c| c.as_ptr());

        let mut queued = 0_usize;
        for line in &lines {
            let text = match CString::new(line.text.as_str()) {
                Ok(c) => c,
                Err(_) => return Err(why(1).into()),
            };
            // SAFETY: three NUL-terminated strings valid for the length of the
            // call (the callee copies each into an NSString before returning),
            // and six numbers. Defined in `ios/FrankSpeech.m`, compiled into
            // this binary by `build.rs` (archive `frankspeech`).
            let code = unsafe {
                frank_speech_speak(
                    text.as_ptr(),
                    lang_p,
                    voice_p,
                    rate,
                    say.pitch,
                    say.volume,
                    if say.ssml { 1 } else { 0 },
                    line.id,
                )
            };
            if code != 0 {
                // Whatever is already queued keeps speaking: a chapter that
                // reads to sentence 400 and stops is a better answer than one
                // that stops at sentence 0, and the page learns the count.
                log::error!("frank: speech refused sentence {}: {}", line.id, why(code));
                if queued == 0 {
                    return Err(why(code).into());
                }
                break;
            }
            queued += 1;
        }
        log::info!("frank: speech queued {queued} of {} at rate {rate:.3}", lines.len());
        Ok(Queued { queued, rate, capped })
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (&say.pitch, &say.volume, &say.ssml, &say.voice, &say.lang, rate, capped);
        Err(why(4).into())
    }
}

/// `TTSTVHost.speech.stop()`: silence, and the queue emptied.
///
/// Idempotent, and never an error -- stopping a synthesiser that is not
/// speaking is the ordinary case (it is what `pagehide` does).
#[tauri::command]
pub fn speech_stop() -> bool {
    #[cfg(target_os = "ios")]
    // SAFETY: a C function taking nothing and returning an int.
    let code = unsafe { frank_speech_cancel() };
    #[cfg(not(target_os = "ios"))]
    let code = 4_i32;
    code == 0
}

/// `TTSTVHost.speech.pause()` and `.resume()`: the exact pause.
///
/// **`sysvoice.js` does not use these and should not.** Its pause is
/// cancel-and-remember-the-word (★ POSITION IS SACRED, `plan-12-sep.md`
/// A2c.32), because a resume that lands somewhere else is worse than a
/// restart, and because `speechSynthesis.pause()` is the web call that
/// silently fails on iOS -- so the engine has one pause and it works on both
/// paths.
///
/// Native pause has no such fault: `AVSpeechBoundaryWord` finishes the word
/// and stops where it stopped. It is here for the caller that cannot use the
/// engine's -- **the lock screen and a headphone press, which pause an APP and
/// not a page**. That caller does not exist yet; the report's §6 says so and
/// says whose it is. It costs nothing per word and cannot be called in a loop,
/// which is the test a door has to pass in this app (`lookup.rs`, no
/// `lookup_has`).
#[tauri::command]
pub fn speech_pause() -> bool {
    #[cfg(target_os = "ios")]
    // SAFETY: a C function taking nothing and returning an int.
    let code = unsafe { frank_speech_pause() };
    #[cfg(not(target_os = "ios"))]
    let code = 4_i32;
    code == 0
}

/// See [`speech_pause`].
#[tauri::command]
pub fn speech_resume() -> bool {
    #[cfg(target_os = "ios")]
    // SAFETY: a C function taking nothing and returning an int.
    let code = unsafe { frank_speech_resume() };
    #[cfg(not(target_os = "ios"))]
    let code = 4_i32;
    code == 0
}

/// `TTSTVHost.speech.speaking()`: `{speaking, paused}`.
///
/// The engine's watchdog asks this four times a second while a chapter is in
/// the mouth -- the loop that stops a chapter wedging on an utterance that
/// ended in silence (`sysvoice.js`, THE WATCHDOG). It is two atomic reads on
/// the synthesiser and no allocation on the native side.
#[tauri::command]
pub fn speech_speaking() -> Speaking {
    #[cfg(target_os = "ios")]
    // SAFETY: a C function taking nothing and returning an int.
    let bits = unsafe { frank_speech_speaking() };
    #[cfg(not(target_os = "ios"))]
    let bits = 0_i32;
    Speaking { speaking: bits & 1 != 0, paused: bits & 2 != 0 }
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Speaking {
    pub speaking: bool,
    pub paused: bool,
}

// ---------------------------------------------------------------------- the JS
//
// Its own init script, `dict.rs`'s and `lookup.rs`'s pattern and their reason:
// two tests in `lib.rs` pin `HOST_JS.matches("invoke(").count()` to 2, so an
// `invoke` added there is a red suite in another lane's file -- and the door
// and the script that opens it belong in one file so neither can be moved
// without the other.
//
// WHAT IS NOT IN IT: any knowledge of sentences, words, chapters or cursors.
// This writes `window.TTSTVHost.speech` -- six calls and an event -- and
// `reader/sysvoice.js::createNativeSynth` is the only thing that reads it.
// That is the seam: the phone knows how to speak, the page knows what to say,
// and neither has a copy of the other's job.

/// `window.TTSTVHost.speech`, and nothing else.
pub const SPEECH_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};

  /* THE EVENT, and it is a plain global function rather than an EventTarget
     for one reason: `speech.rs::on_event` writes ONE LINE of JavaScript per
     word boundary through `webview.eval`, about four times a second, and the
     cheapest thing that line can be is a call to a function that is either
     there or not. The guard `window.__frankSpeech &&` is in the emitted line,
     so a page that never mounted the reader costs nothing at all.

     kind: 1 start · 2 word · 3 end · 4 cancel · 5 pause · 6 continue
     -- `FrankSpeech.m`'s enum and `speech.rs`'s KIND_* constants, one order.

     The subscriber is `sysvoice.js::createNativeSynth`, which is also what
     minted the uid, so it is the one thing that can say which sentence this
     was. Nothing here interprets the number. */
  var subs = [];
  window.__frankSpeech = function (kind, uid, location, length) {
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](kind, uid, location, length); } catch (e) {}
    }
  };

  window.TTSTVHost.speech = {
    /* onEvent(fn) -> off(). */
    onEvent: function (fn) {
      if (typeof fn !== "function") return function () {};
      subs.push(fn);
      return function () {
        var i = subs.indexOf(fn);
        if (i >= 0) subs.splice(i, 1);
      };
    },
    /* available() -> Promise<boolean>: is there a native synthesiser here.
       False on the Mac, where the page's own speechSynthesis speaks with the
       same voices and has no lock screen to survive. */
    available: function () { return TAURI.invoke("speech_available"); },
    /* voices() -> Promise<[{name, lang, voiceURI, localService, default,
       quality}]> -- getVoices()'s own shape, plus `quality` as a word. */
    voices: function () { return TAURI.invoke("speech_voices"); },
    /* speak({lines:[{id, text}], lang, voice, rate, pitch, volume, ssml})
       -> Promise<{queued, rate, capped}>. `rate` is a MULTIPLE of normal, as
       on the web; the phone's own 0..1 scale is Rust's business. LINES,
       PLURAL, AND THE WHOLE CHAPTER AT ONCE: a queued utterance goes on
       speaking with this webview suspended, and a JS-driven one does not. */
    speak: function (say) { return TAURI.invoke("speech_speak", { say: say }); },
    /* stop() -> Promise<boolean>: silence, and the queue emptied. */
    stop: function () { return TAURI.invoke("speech_stop"); },
    /* pause()/resume() -> Promise<boolean>: the EXACT pause, for a caller that
       pauses an app and not a page. The reader's own pause is not this one --
       it is cancel-and-remember-the-word, so the position cannot drift. */
    pause: function () { return TAURI.invoke("speech_pause"); },
    resume: function () { return TAURI.invoke("speech_resume"); },
    /* speaking() -> Promise<{speaking, paused}>: the watchdog's question. */
    speaking: function () { return TAURI.invoke("speech_speaking"); },
  };
})();
"#;

// ----------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    /// The anchor is Apple's one published point and the line goes through it.
    #[test]
    fn normal_speech_is_apples_own_number() {
        assert_eq!(av_rate(1.0), AV_NORMAL, "a multiple of 1 IS AVSpeechUtteranceDefaultSpeechRate");
        assert!(!av_rate_capped(1.0));
    }

    /// The Settings default: `wpm` 300 over `BASE_WPM` 180 is 1.667, and it
    /// fits under the cap with room -- which is the number that matters,
    /// because it is the one every reader starts at.
    #[test]
    fn the_settings_default_is_not_capped() {
        let m = 300.0 / 180.0;
        assert!(!av_rate_capped(m), "the default wpm must not be silently slowed");
        let r = av_rate(m);
        assert!((r - 0.8333).abs() < 0.001, "{r}");
    }

    /// **The cap, stated as a test so nobody has to rediscover it.** The line
    /// reaches Apple's maximum at twice normal; past that the phone speaks at
    /// its maximum and `capped` is how the page finds out.
    #[test]
    fn the_phone_stops_at_twice_normal_and_says_so() {
        assert_eq!(av_rate(2.0), AV_MAX);
        assert!(!av_rate_capped(2.0), "exactly at the maximum is not capped");
        assert_eq!(av_rate(3.0), AV_MAX);
        assert!(av_rate_capped(3.0), "past the maximum the page must be told");
        assert!(av_rate_capped(1000.0));
    }

    /// Nonsense in, normal speech out -- never a silent 0, which is a
    /// synthesiser that says nothing and looks like a broken door.
    #[test]
    fn nothing_and_nonsense_speak_normally() {
        for m in [0.0, -1.0, f64::NAN, f64::NEG_INFINITY] {
            assert_eq!(av_rate(m), AV_NORMAL, "{m} should fall back to normal");
            assert!(!av_rate_capped(m));
        }
        assert_eq!(av_rate(f64::INFINITY), AV_NORMAL, "infinity is nonsense, not speed");
    }

    /// Slow is slow, and it never goes under Apple's floor.
    #[test]
    fn slow_is_a_line_too() {
        assert_eq!(av_rate(0.5), 0.25);
        assert!(av_rate(0.0001) >= AV_MIN);
        assert!(av_rate(0.5) < av_rate(1.0) && av_rate(1.0) < av_rate(1.5));
    }

    #[test]
    fn every_code_has_a_sentence() {
        assert_eq!(why(0), "ok");
        for c in 1..=7 {
            assert!(!why(c).starts_with("unknown"), "code {c} has no sentence");
        }
        assert!(why(99).starts_with("unknown"));
    }

    /// Off iOS the door says no, in every direction, and says it the same way.
    #[test]
    fn off_ios_there_is_no_native_voice() {
        #[cfg(not(target_os = "ios"))]
        {
            assert!(!speech_available(), "the Mac uses its own speechSynthesis");
            assert_eq!(speech_voices().unwrap().len(), 0);
            assert!(!speech_stop() && !speech_pause() && !speech_resume());
            let s = speech_speaking();
            assert!(!s.speaking && !s.paused);
            let say = Say {
                lines: vec![Line { id: 1, text: "shepherd".into() }],
                lang: None, voice: None, rate: 1.0, pitch: 1.0, volume: 1.0, ssml: false,
            };
            assert_eq!(speech_speak(say).map(|q| q.queued), Err(why(4).to_string()));
        }
    }

    /// Nothing to say is refused before the platform is asked -- on both.
    #[test]
    fn an_empty_batch_is_refused_everywhere() {
        let empty = Say {
            lines: vec![Line { id: 1, text: "   \n ".into() }],
            lang: None, voice: None, rate: 1.0, pitch: 1.0, volume: 1.0, ssml: false,
        };
        assert_eq!(speech_speak(empty).map(|q| q.queued), Err(why(2).to_string()));
        let none = Say {
            lines: vec![], lang: None, voice: None,
            rate: 1.0, pitch: 1.0, volume: 1.0, ssml: false,
        };
        assert_eq!(speech_speak(none).map(|q| q.queued), Err(why(2).to_string()));
    }

    /// The page may send a bare `{lines}` and mean normal speech.
    #[test]
    fn the_defaults_are_the_web_defaults() {
        let say: Say = serde_json::from_str(r#"{"lines":[{"id":7,"text":"a"}]}"#).unwrap();
        assert_eq!(say.rate, 1.0);
        assert_eq!(say.pitch, 1.0);
        assert_eq!(say.volume, 1.0);
        assert!(!say.ssml);
        assert_eq!(say.lines[0].id, 7);
    }

    /// A voice crosses in `getVoices()`'s spelling, because that is the shape
    /// `sysvoice.js::pickVoice` already ranks -- `voiceURI` and `default`, not
    /// `voice_uri` and `is_default`.
    #[test]
    fn a_voice_is_spelled_the_way_the_web_spells_one() {
        let v = Voice {
            name: "Daniel".into(), lang: "en-GB".into(),
            voice_uri: "com.apple.voice.enhanced.en-GB.Daniel".into(),
            local_service: true, is_default: false, quality: "enhanced".into(),
        };
        let j = serde_json::to_string(&v).unwrap();
        assert!(j.contains(r#""voiceURI":"#), "{j}");
        assert!(j.contains(r#""localService":true"#), "{j}");
        assert!(j.contains(r#""default":false"#), "{j}");
        assert!(j.contains(r#""quality":"enhanced""#), "{j}");
        assert!(!j.contains("voice_uri") && !j.contains("is_default"), "{j}");
    }

    /// The kinds are one order in three files.
    #[test]
    fn the_kinds_agree_with_the_objective_c_and_with_the_js() {
        let m = include_str!("../ios/FrankSpeech.m");
        for (name, n) in [
            ("FRANK_SPEECH_START", KIND_START), ("FRANK_SPEECH_WORD", KIND_WORD),
            ("FRANK_SPEECH_END", KIND_END), ("FRANK_SPEECH_CANCEL", KIND_CANCEL),
            ("FRANK_SPEECH_PAUSE", KIND_PAUSE), ("FRANK_SPEECH_CONTINUE", KIND_CONTINUE),
        ] {
            assert!(m.contains(&format!("{name} = {n}")), "{name} is not {n} in FrankSpeech.m");
        }
        assert!(SPEECH_JS.contains("1 start · 2 word · 3 end · 4 cancel · 5 pause · 6 continue"));
    }

    /// The door: SEVEN commands and one event, declared, granted, handled and
    /// injected -- and no eighth. `HOST_JS` is another lane's file and its two
    /// `invoke`s are pinned by two tests there, which is why this script is
    /// its own (`lookup.rs` learned it first).
    #[test]
    fn the_door_is_seven_commands_and_one_event() {
        let js = SPEECH_JS;
        assert_eq!(js.matches("invoke(").count(), 7, "seven commands, seven calls");
        assert!(js.contains("if (!TAURI"), "a page outside Frank gets no door");
        assert!(js.contains("window.__frankSpeech = function (kind, uid, location, length)"));

        let build = include_str!("../build.rs");
        let cap = include_str!("../capabilities/default.json");
        let lib = include_str!("lib.rs");
        for (cmd, perm) in [
            ("speech_available", "allow-speech-available"),
            ("speech_voices", "allow-speech-voices"),
            ("speech_speak", "allow-speech-speak"),
            ("speech_stop", "allow-speech-stop"),
            ("speech_pause", "allow-speech-pause"),
            ("speech_resume", "allow-speech-resume"),
            ("speech_speaking", "allow-speech-speaking"),
        ] {
            assert!(build.contains(&format!("\"{cmd}\"")), "build.rs declares {cmd}");
            assert!(cap.contains(&format!("\"{perm}\"")), "the capability grants {perm}");
            assert!(
                lib.contains(&format!("            speech::{cmd},\n")),
                "generate_handler! handles {cmd}"
            );
        }
        assert!(build.contains("ios/FrankSpeech.m"), "build.rs compiles the synthesiser");
        assert!(lib.contains(".initialization_script(speech::SPEECH_JS)"));
        assert!(lib.contains("speech::open(app.handle())"), "the door is opened in setup");
    }

    /// The boundary goes back by `eval`, which is the app's one way of talking
    /// to a page it did not answer -- not a second event bus.
    #[test]
    fn the_way_back_is_the_one_the_app_already_has() {
        // The FILE ABOVE THE TESTS -- this module's own text would otherwise
        // satisfy the second assertion by containing the string it forbids,
        // which is a test that can only pass.
        let me = include_str!("speech.rs").split("#[cfg(test)]").next().unwrap();
        assert!(me.contains("w.eval(&format!("), "boundaries go back by eval");
        assert!(!me.contains(".emit("), "no second mechanism for one message");
    }
}
