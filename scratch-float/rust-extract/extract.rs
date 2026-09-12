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
    // `src-tauri/ios/FrankAudio.m` and linked into the same binary by the Xcode
    // target (`gen/apple/project.yml` -> sources: ../../ios).
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
