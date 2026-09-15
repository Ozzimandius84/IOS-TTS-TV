/* ENGINE · THE TRANSPORT -- one play/pause/seek/speed for both playback bars
   · bench: design/phone/playbar.html (the phone), design/reader/bench-playbar.html (the Mac)
   · mounted by: reader/reader.html, one <script src>, before either bar mounts */
/* ============================ THE ONE TRANSPORT ============================
   Osca, 7 September: *"a SEPARATE PLAYBACK bar -- the TTS transport
   (play/pause, scrub the chapter, speed) -- on BOTH platforms ... the phone's
   (designed in design/phone/) and the Mac's (designed in design/reader/) are
   NOT based on each other, but they share one transport API (play/pause/seek/
   speed against the voice module -- build it if it doesn't exist, guard every
   call)."*

   WHY IT EXISTS. `reader/listen.js` already drives the audio and already
   publishes `window.ReaderControl` -- but that object is shaped for
   `voiceui/reader-bridge.js` and not for a bar. Every method there takes a
   `side` argument naming the other book of a pair; there is no duration, no
   fraction, no "is there actually a voice to play", and nothing to subscribe
   to. A bar needs those four and a bar must never throw. TWO bars needing
   them is two copies of the same guessing, in two files, drifting apart the
   first time listen.js moves. So the guessing is done ONCE, here, and the two
   presentations read it.

   IT OWNS NOTHING. It starts no audio, renders nothing, and holds no state of
   its own but a listener list and one timer. Every call goes through `ask` or
   `tell`, which answer with a fallback instead of throwing when
   `window.ReaderControl` is absent (no book open yet), half-built (a chapter
   still loading) or gone (the book closed under it). A bar mounts while the
   page is parsed and a book arrives a second or more later, so **no control
   is the normal state, not an error**, and nothing is logged for it.

   THE ONE JUDGEMENT IT MAKES: IS THERE A VOICE?
   listen.js falls back to a `VirtualClock` when a chapter has timings and no
   rendered audio, so the highlight still runs over a silence. A clock is not
   a voice. `hasVoice()` answers by IDENTITY plus a duration --
   `control.clock === control.audioEl`, which is only ever true on the path
   `loadAudio` resolves from `oncanplay`, AND a finite non-zero
   `audioEl.duration`, because `clock` starts life as that same element with
   no `src` on it at all (listen.js: `let clock = audio`). That is the
   1 September rule -- *"no playback or volume control shows when the chapter
   has no audio ... hide the player when there's no master for the chapter"*
   (`reader/_to_delete/tests-old-reader/test_no_transport.py`) -- asked once
   here instead of guessed twice in two bars.

   WHAT A SUBSCRIBER GETS. `Transport.on(fn)` returns an unsubscribe and calls
   `fn(state)` whenever anything in `state()` changes -- and only then, so a
   bar repaints on a change and not on a frame. The loop runs at animation
   rate while the voice is playing and at 250 ms otherwise (a seek by voice,
   a chapter turning, `window.ReaderControl` arriving), and STOPS ENTIRELY
   when the last listener leaves. Nothing here polls a page nobody is
   watching.
========================================================================== */
(function (root) {
  "use strict";

  /* The speeds the two bars step through. One list, because "faster" spoken
     to voiceui and "1.5x" tapped on a bar must mean the same thing. */
  var SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

  /* =========================== ★ THE PACE, IN WPM =========================
     Osca, 13 September: *"Needs to be a rough wpm play in the voice."* A
     COARSE rate the listener nudges while listening, and the number on the
     bar is the number Settings calls Pace -- `wpm`, the one stored value.
     Nothing here holds a second one: `paceNow()` reads the store through the
     page that registered it, `stepPace()` writes it back through the same
     door, and every engine is a CONSEQUENCE of that write.

     THE EIGHT STOPS, and they are the whole list:
         150  200  250  300  350  400  500  600
     Coarse on purpose -- Settings' own slider is 80..900 in 25s (thirty-three
     stops, `prefs/prefs.js`'s `WPM`), which is a thing you dial sitting down,
     not a thing you nudge with a thumb while a voice is talking. Every stop
     here is a multiple of that step and inside that range, so a pace picked
     on the bar is a pace the Settings row can also show and land on exactly;
     the two controls can never disagree about what is stored. 300 -- the
     default -- is one of them, and the list runs half that to twice it.

     TWO ENGINES, TWO CONSEQUENCES, and D7 is why they differ:
       - A RENDERED MASTER is played faster or slower. `rate = wpm / 300`, so
         the pace the audio was made at is rate 1 (a STATED reference, the
         store's own default, not a measurement of any engine) and the eight
         stops are 0.5x .. 2x. *"With rendered audio, word rate can change at
         playback with no re-render"* -- so this writes `playbackRate` and
         NOTHING ELSE. No render, no seek, no reload.
       - THE SYSTEM VOICE re-bases. `sysvoice.js` reads the same `wpm` for
         `utterance.rate` and its `rebase()` speaks the SAME word again at the
         new rate; the page wires the store's change to it. Not this file's:
         this file owns no engine (see THE SYSTEM VOICE, below).

     ★ POSITION IS SACRED (`plan-12-sep-cd.md` D7). Changing the pace must not
     move the reader -- not by a word. Every door below writes a rate and a
     stored number; not one of them calls `seekTo`, `open`, `paint` or
     `nav.goTo`, and `design/reader/test-pace.mjs` is that claim as a number
     on both engines: note the word, change the pace, the word is the word. */
  var PACES = [150, 200, 250, 300, 350, 400, 500, 600];
  var PACE_REF = 300;                  /* wpm at rate 1 -- the store's default */
  var PACE_MIN = 0.25, PACE_MAX = 4;   /* what an <audio> element honours */

  var IDLE_MS = 250;            /* the slow tick: not playing, still watching */

  function control() {
    try { return root.ReaderControl || null; } catch (e) { return null; }
  }
  /* ask: a READ that cannot throw and cannot return undefined. */
  function ask(fn, fallback) {
    var c = control();
    if (!c) return fallback;
    try { var v = fn(c); return (v === undefined || v === null) ? fallback : v; }
    catch (e) { return fallback; }
  }
  /* tell: a WRITE that cannot throw. true = it reached the voice. */
  function tell(fn) {
    var c = control();
    if (!c) return false;
    try { fn(c); return true; } catch (e) { return false; }
  }

  function clockOf(c) { return c.clock || null; }
  function audioOf(c) { return c.audioEl || null; }

  /* ------------------------------------------------------------- the state */

  function ready() { return !!control(); }

  /* A REAL MASTER, not a VirtualClock and not the empty element it starts as. */
  function hasVoice() {
    return ask(function (c) {
      var a = audioOf(c), k = clockOf(c);
      return !!(a && k === a && !a.error && isFinite(a.duration) && a.duration > 0);
    }, false);
  }
  /* Timings without a master: the highlight runs, the bar does not show
     (the 1 Sep rule), and `--pb-when: timings` is the dial that says otherwise. */
  function hasTimings() {
    return ask(function (c) {
      var t = c.timings;
      return !!(t && t.sentences && t.sentences.length);
    }, false);
  }
  function playing() {
    if (sysSpeaking()) return true;
    return ask(function (c) { return !c.isPaused(); }, false);
  }

  function time() {
    return ask(function (c) {
      var t = clockOf(c).currentTime;
      return isFinite(t) && t > 0 ? t : 0;
    }, 0);
  }
  /* THE CHAPTER'S LENGTH, and the audio is asked first. A rendered master is
     the truth about how long the chapter is; `timings.duration` is the last
     sentence's end, which is the truth only when there is no master. */
  function duration() {
    return ask(function (c) {
      var a = audioOf(c), k = clockOf(c);
      if (a && k === a && isFinite(a.duration) && a.duration > 0) return a.duration;
      var t = c.timings;
      return t && isFinite(t.duration) && t.duration > 0 ? t.duration : 0;
    }, 0);
  }
  function fraction() {
    var d = duration();
    return d > 0 ? Math.max(0, Math.min(1, time() / d)) : 0;
  }
  function speed() { return ask(function (c) { return +c.getSpeed() || 1; }, 1); }
  function chapterId() { return ask(function (c) { return c.chapterIdOf(c.chapterIndex); }, null); }
  function chapterIndex() { return ask(function (c) { var i = c.chapterIndex; return i >= 0 ? i : -1; }, -1); }

  /* ------------------------------------------------------- arming the voice
     THE ONE THING A BAR NEEDS THAT PRESSING PLAY USED TO DO FIRST.
     `listen.js` opens a chapter -- its timings, its map, its audio -- only
     when something asks it to play, so before the first press
     `ReaderControl.chapterIndex` is -1, there is no `cur`, and `hasVoice()`
     is false for a book that is entirely rendered. A transport BAR is the
     thing you press play WITH, so it has to know the answer before the press;
     otherwise the bar can never appear and the button can never be reached.

     `arm()` therefore asks the control to open the chapter on screen ONCE per
     page -- only while `chapterIndex` is still -1, never again on a scroll --
     which is the same `open()` a press of play would have done a moment
     later. After that, listen.js owns which chapter is loaded and this never
     second-guesses it.

     WHAT IT COSTS, SAID PLAINLY: opening a chapter fetches its master, so a
     rendered book now buffers its first chapter when the reader opens rather
     than when play is pressed. On a phone on cellular that is real. The
     cheaper answer exists and is NOT this lane's to take: `books/<slug>/
     state.json` carries `chapters.<cid>.audio_s`, so a per-chapter "is this
     rendered" could be read from one small file instead -- §6 asks for it.

     WHICH CHAPTER IS ON SCREEN is read off page.js's own DOM, and this is a
     COPY of `listen.js::chapterUnderLine` -- the same `.chapter[data-ch]`
     against the same pane at the same 35% line. It is a copy because
     `window.ReaderControl` does not publish it and this lane does not edit
     the voice module. §6 asks for `getChapterUnderLine()` on the control; the
     day it lands, these ten lines go and this calls it instead. */
  function chapterOnScreen() {
    var col = document.getElementById("readercol");
    var pane = document.getElementById("readerpane");
    if (!col) return -1;
    var secs = col.querySelectorAll(".chapter[data-ch]");
    if (!secs.length) return -1;
    var line = pane ? pane.getBoundingClientRect().top + pane.clientHeight * 0.35 : 0;
    var idx = +secs[0].getAttribute("data-ch");
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= line) idx = +secs[i].getAttribute("data-ch");
      else break;
    }
    return idx;
  }
  var arming = false, armed = false;
  function arm() {
    if (arming || armed) return false;
    var c = control();
    if (!c || c.chapterIndex >= 0) { if (c && c.chapterIndex >= 0) armed = true; return false; }
    var want = chapterOnScreen();
    if (!(want >= 0)) return false;
    if (folderFn && listenFirst(c, want)) return true;
    return openToLook(c, want);
  }
  function openToLook(c, want) {
    if (arming || armed) return false;
    arming = true;
    try {
      Promise.resolve(c.open(want)).then(function () { arming = false; armed = true; },
                                         function () { arming = false; });
    } catch (e) { arming = false; return false; }
    return true;
  }

  /* ------------------------------------------- ...AND ARMING MOVED THE PAGE
     PROMPTS/phone-chrome.md (Osca, 10 Sep): *"Opening a book threw Osca off
     the title page to the next chapter-header slide: nothing moves on open
     unless a saved reading position exists."* THIS WAS THE MOVER. MEASURED at
     HEAD, Chromium 402x874, eclogues-en with an empty localStorage (no
     cursor, no position): `#readerpane.scrollTop` 0 -> 8 -> 168 -> 515 -> 830
     -> 1023 -> 1066 in ~0.6 s, starting the beat `state().voice` went true --
     i.e. `arm()`'s `open()`. Opening a chapter starts listen.js's paint loop,
     and paint scrolls the paragraph of the clock's sentence -- the chapter's
     FIRST sentence, at 0:00 -- into view: off the title page, onto c001's
     opener. The two unvoiced books on the same shelf moved 0 px. G-PHONE
     measured the same 0 -> 1066 on the simulator and took it for a restore.

     SO THE PAGE THAT CAN SAY WHERE ITS VOICES ARE ASKS INSTEAD OF OPENING.
     `voiceFolder(fn)` is that page's answer (`fn()` -> the book's `audio/`
     URL, or null); with it, `arm()` asks `masterIn` -- the HEAD the chapter
     turn already asks -- for the chapter on screen, once per chapter id, and
     `state().voice` is true while nothing is loaded and that chapter has a
     master. Nothing is opened, nothing is painted, nothing moves; the first
     press of play opens the chapter exactly as it always did, and from then
     on listen.js owns the answer. A HEAD that cannot tell (`null`) falls back
     to opening and looking, which is what this did before. No `voiceFolder`
     -> the old arm, unchanged. BOTH BARS' PAGE REGISTERS ONE NOW: the Mac's
     capsule registered none until 10 Sep and jumped 976 px on opening a voiced
     book for exactly this reason (Osca: "the same `arm()` cause") -- so
     reader.html asks the one question for both bars. It also stops a
     rendered book buffering its first master the moment it opens. */
  var folderFn = null, known = {};        /* cid -> true | false | undefined (asking) */
  function voiceFolder(fn) {
    folderFn = typeof fn === "function" ? fn : null;
    known = {};
  }
  function cidOnScreen(c) {
    var want = chapterOnScreen();
    if (!(want >= 0)) return null;
    try { return c.chapterIdOf(want) || null; } catch (e) { return null; }
  }
  function listenFirst(c, want) {
    var cid = null;
    try { cid = c.chapterIdOf(want) || null; } catch (e) { cid = null; }
    if (!cid) return false;
    if (Object.prototype.hasOwnProperty.call(known, cid)) return true;   /* asked, or asking */
    var folder = null;
    try { folder = folderFn(); } catch (e) { folder = null; }
    if (!folder) return false;
    known[cid] = undefined;
    masterIn(folder, cid).then(function (there) {
      if (there === null) { delete known[cid]; openToLook(c, want); return; }
      known[cid] = there;
    }, function () { delete known[cid]; });
    return true;
  }
  /* the chapter on screen has a master, and nothing has been opened yet */
  function heard() {
    if (!folderFn) return false;
    var c = control();
    if (!c || c.chapterIndex >= 0) return false;
    var cid = cidOnScreen(c);
    return !!cid && known[cid] === true;
  }

  /* ------------------------------------------------- THE SYSTEM VOICE
     `plan-12-sep-cd.md` D1(a). A chapter with no master used to mean the
     space bar did nothing: `listen.js` armed a `VirtualClock`, the highlight
     ran over a silence, and there was no sound in the building. There is a
     synthesiser in every browser this app runs in, so a chapter with no
     master is not a silent chapter -- it is a chapter this reads aloud.

     `sysvoice.js` is that engine and it is REGISTERED, not imported: this
     file owns no engine and knows nothing about `speechSynthesis`. The page
     builds it (it needs the DOM's own word list and Settings' `wpm`) and
     hands it over, exactly as it hands over `voiceFolder`.

     WHEN IT TAKES THE PRESS -- `speaks()`, and every clause of it is load-
     bearing: there is an engine; the chapter on screen has no master
     (`hasVoice()`), none is being turned to (`turning`), and none has been
     HEARD OF but not yet opened (`heard()` -- a rendered chapter before the
     first press looks exactly like an unrendered one to `hasVoice()`, and
     speaking over a book that has a cloned voice waiting would be the worst
     failure this could have); and the engine has words for that chapter.

     THE 1 SEPTEMBER RULE IS UNTOUCHED. `state().voice` still means A MASTER,
     so neither bar appears for a chapter with no audio; `state().system` is
     the separate fact, and what a bar does with it is the bars' lane, not
     this one. */
  var sys = null;
  function sysvoice(engine) { sys = engine || null; }
  function sysSpeaking() {
    if (!sys) return false;
    try { return !!sys.speaking; } catch (e) { return false; }
  }
  function speaks() {
    if (!sys) return false;
    if (hasVoice() || turning || heard()) return false;
    if (sysSpeaking()) return true;
    try { return !!sys.available(chapterOnScreen()); } catch (e) { return false; }
  }

  /* ------------------------------------------------------- THE CHAPTER TURN
     G-PHONE step 4 (Osca, 10 Sep): *"the playback foot strip works ...
     play/pause/seek/speed act on a real render in the sim; survives a chapter
     turn."*

     WHAT HAPPENED AT A CHAPTER'S END, MEASURED on the iPhone 17 simulator at
     HEAD (eclogues-en, c001 rendered 263.36 s, c002 rendered): the voice
     stopped dead -- `pause` at 263.36, the strip at 4:23 / -0:00, and nothing
     after it. listen.js opens a chapter only when asked and has no `ended`
     handler, so the book's narration was one chapter long. And the one door
     left, pressing play again, played from the CURSOR -- which the voice had
     carried to c001's last word -- so it played 263.16 -> 263.36 and stopped
     again, even with the reader already scrolled 6,000px into c002.

     SO THE TRANSPORT TURNS THE CHAPTER, and only when the voice itself runs
     off the end of one: the master was playing, and now it is paused with
     `ended` true (never a pause the reader made, and never a seek). Then:
       - the next chapter has a master  -> open it, play it from 0:00. listen.js
         paints the new chapter, so its highlight moves the ONE cursor
         (book-nav.js) and the page follows the voice into the new chapter.
       - it has none                    -> nothing moves. The voice stops where
         the book's voice stops, and the strip stays on the chapter it played
         rather than hiding under a reader who has not moved (the 1 Sep rule is
         about the chapter ON SCREEN having no master, and it still does).
       - the book is over               -> nothing moves.
     WHICH IS WHY IT ASKS BEFORE IT OPENS: opening a chapter PAINTS it, and a
     paint scrolls the page to that chapter's first sentence -- to turn to an
     unvoiced chapter only to turn back would throw the page there and back.
     The question is a HEAD request against the voice's own URL, with the
     chapter id swapped in -- no book path is re-derived here, the playing
     master names its own folder -- and a HEAD that cannot answer (no fetch,
     a refusal that is not a 404) is "could not tell", which opens and looks.

     THE STRIP DOES NOT BLINK FOR IT. Between the open and the new master's
     `canplay`, listen.js has taken the old `src` off the element, so for a
     beat `hasVoice()` is false and a bar would hide and come back. While a
     turn is in hand, `state().voice` is held true; if the turn finds no
     voice after all, it lets go and the strip goes as it should. */
  var AUDIO_EXTS = ["mp3", "wav", "m4a", "opus", "ogg"];   /* a COPY of listen.js's, same order */
  var turning = false, wasPlaying = false;
  function folderOf(a) {
    var s = (a && (a.currentSrc || a.src)) || "";
    var q = s.indexOf("?"); if (q >= 0) s = s.slice(0, q);
    var i = s.lastIndexOf("/");
    return i > 0 ? s.slice(0, i + 1) : "";
  }
  /* true: a master is there · false: every extension 404s · null: cannot tell */
  function masterIn(folder, cid) {
    if (!folder || !cid || typeof root.fetch !== "function") return Promise.resolve(null);
    var i = 0, unsure = false;
    function next() {
      if (i >= AUDIO_EXTS.length) return Promise.resolve(unsure ? null : false);
      var url = folder + encodeURIComponent(cid) + "." + AUDIO_EXTS[i++];
      return root.fetch(url, { method: "HEAD", cache: "no-store" }).then(function (r) {
        if (r && r.ok) return true;
        if (!r || r.status !== 404) unsure = true;
        return next();
      }, function () { unsure = true; return next(); });
    }
    return next();
  }
  function ranOff(c) {
    var a = audioOf(c);
    return !!(a && clockOf(c) === a && a.ended);
  }
  function turn() {
    var c = control();
    if (!c || turning || !ranOff(c)) return false;
    var from = c.chapterIndex;
    /* THE APPARATUS IS NOT READ ALOUD UNASKED (P6, 14 Sep). listen.js knows
       which chapters the parser marked `speak: false` -- an index, the
       notes, a title page -- and names the next chapter that is TEXT; the
       voice running off the end of one chapter turns to that, and a book
       whose last chapters are all apparatus is over when the text is. A
       listen.js without the door (an older shell) turns to `from + 1`. */
    var to = ask(function (k) {
      return typeof k.nextChapterIndex === "function" ? k.nextChapterIndex(from) : from + 1;
    }, from + 1);
    if (!(to >= 0)) return false;                       /* the text is over */
    var cid = ask(function (k) { return k.chapterIdOf(to); }, null);
    if (!(from >= 0) || !cid) return false;             /* the last chapter: the book is over */
    turning = true;
    var done = function () { turning = false; };
    masterIn(folderOf(audioOf(c)), cid).then(function (there) {
      if (there === false) { done(); return; }          /* unvoiced: nothing moves */
      var k = control();
      if (!k || k.chapterIndex !== from) { done(); return; }   /* someone else moved the voice */
      return Promise.resolve(k.open(to)).then(function () {
        done();
        var k2 = control();
        if (!k2 || k2.chapterIndex !== to || !hasVoice()) return;
        var clk = clockOf(k2);
        try { clk.currentTime = 0; } catch (e) { /* a clock that will not seek starts where it is */ }
        return clk.play();
      });
    }).then(null, done);
    return true;
  }

  /* ------------------------------------------------------------- the doors */

  /* THE PRESS GOES TO ONE ENGINE OR THE OTHER, NEVER BOTH. `speaks()` is
     asked first and answers no the moment a master is there, so a rendered
     chapter reaches `listen.js` exactly as it always did. */
  function play() {
    if (speaks()) { try { return !!sys.play(); } catch (e) { return false; } }
    return tell(function (c) { c.play(); });
  }
  function pause() {
    var stopped = false;
    if (sysSpeaking()) { try { stopped = !!sys.pause(); } catch (e) {} }
    return tell(function (c) { c.pause(); }) || stopped;
  }
  function toggle() { return playing() ? pause() : play(); }

  /* AN ABSOLUTE SEEK IS THE ONE THING ReaderControl HAS NO DOOR FOR -- it
     offers deltas only, because voice says "back" and never "to 4:12". The
     rail says exactly that, so this writes the clock and asks listen.js to
     repaint its two marks, which is what its own `seek*` methods do. */
  function seekTo(sec) {
    var d = duration();
    var t = Math.max(0, d > 0 ? Math.min(d, +sec || 0) : (+sec || 0));
    return tell(function (c) { clockOf(c).currentTime = t; c.paint(); });
  }
  function seekFraction(f) {
    var d = duration();
    if (!(d > 0)) return seekOnceOpen(f);
    return seekTo(Math.max(0, Math.min(1, +f || 0)) * d);
  }
  /* A RAIL PRESSED BEFORE PLAY. With `voiceFolder` nothing is opened until
     something asks (see "...AND ARMING MOVED THE PAGE"), so the chapter has no
     length yet and a scrub had nothing to scrub. The rail IS asking: it opens
     the chapter on screen -- the same `open` play would -- and lands the seek
     once the chapter knows how long it is. The newest fraction wins. */
  var pendingF = null;
  function seekOnceOpen(f) {
    var c = control();
    if (!c || c.chapterIndex >= 0 || !heard()) return false;
    var first = pendingF === null;
    pendingF = Math.max(0, Math.min(1, +f || 0));
    if (!first) return true;
    var want = chapterOnScreen();
    try {
      Promise.resolve(c.open(want)).then(function () {
        var g = pendingF; pendingF = null;
        var d = duration();
        if (d > 0 && g !== null) seekTo(g * d);
      }, function () { pendingF = null; });
    } catch (e) { pendingF = null; return false; }
    return true;
  }
  function nudge(sec) { return tell(function (c) { c.seekSeconds(null, +sec || 0); }); }
  function stepSentence(n) { return tell(function (c) { c.seekSentenceDelta(null, n | 0); }); }
  function stepWord(n) { return tell(function (c) { c.seekWordDelta(null, n | 0); }); }

  function setSpeed(r) {
    var v = +r || 1;
    return tell(function (c) { c.setSpeed(null, v); });
  }
  /* ------------------------------------------------------------- the pace
     REGISTERED, never imported -- the same shape as `voiceFolder` and
     `sysvoice` above. The page owns the store (`prefs/prefs.js` is loaded in
     its <head>, before first paint); this file owns what a rate change does
     to a master. `io` is `{read: () -> wpm, write: (wpm) -> void}` and a page
     that registers none leaves every door below a no-op returning 0. */
  var paceIO = null, paceCid = null;
  function pace(io) {
    paceIO = (io && typeof io.read === "function" && typeof io.write === "function") ? io : null;
    paceCid = null;
    return !!paceIO;
  }
  /* the stored pace, or 0 for "there is no store" -- never a guessed default:
     a bar with nothing behind it must draw nothing, not 300 */
  function paceNow() {
    if (!paceIO) return 0;
    var w = 0;
    try { w = +paceIO.read(); } catch (e) { return 0; }
    return isFinite(w) && w > 0 ? w : 0;
  }
  /* wpm -> the multiple a master is played at, clamped to what an element takes */
  function rateForPace(wpm) {
    var w = +wpm;
    if (!isFinite(w) || w <= 0) return 1;
    return Math.max(PACE_MIN, Math.min(PACE_MAX, w / PACE_REF));
  }
  /* which stop a stored wpm is standing on -- the nearest, so a pace dialled
     to 325 in Settings steps to 350 rather than to a number off the list */
  function nearestPace(wpm) {
    var w = +wpm, i = 0, best = Infinity;
    for (var k = 0; k < PACES.length; k++) {
      var d = Math.abs(PACES[k] - w);
      if (d < best) { best = d; i = k; }
    }
    return i;
  }
  /* the master follows the stored pace. A WRITE OF ONE PROPERTY: no seek, no
     open, no paint -- ★ POSITION IS SACRED. */
  function applyPace() {
    var w = paceNow();
    if (!w) return false;
    return setSpeed(rateForPace(w));
  }
  /* the listener's nudge: one stop along the list, wrapping, stored, applied.
     Returns the wpm now stored (the old one if there is no store to write). */
  function stepPace(n) {
    var w = paceNow();
    if (!w) return 0;
    var i = nearestPace(w) + ((n | 0) || 1);
    i = ((i % PACES.length) + PACES.length) % PACES.length;
    return setPace(PACES[i]);
  }
  /* an exact pace, for voiceui or a driver. Off-list values are allowed --
     the store's range is the store's -- and the master follows at once. */
  function setPace(wpm) {
    var w = +wpm, was = paceNow();
    if (!paceIO || !isFinite(w) || w <= 0) return was;
    try { paceIO.write(w); } catch (e) { return was; }
    applyPace();
    return paceNow() || w;
  }

  /* the next speed up the list, wrapping -- what a one-button bar does */
  function cycleSpeed() {
    var now = speed(), i = 0, best = Infinity;
    for (var k = 0; k < SPEEDS.length; k++) {
      var d = Math.abs(SPEEDS[k] - now);
      if (d < best) { best = d; i = k; }
    }
    var next = SPEEDS[(i + 1) % SPEEDS.length];
    return setSpeed(next) ? next : now;
  }

  /* ------------------------------------------------------- one clock face */
  /* m:ss under an hour, h:mm:ss over it. One implementation, because two bars
     rounding differently is two bars disagreeing about where you are. */
  function fmt(sec) {
    var s = Math.max(0, Math.floor(+sec || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    var mm = h ? (m < 10 ? "0" + m : "" + m) : "" + m;
    return (h ? h + ":" : "") + mm + ":" + (r < 10 ? "0" + r : "" + r);
  }

  function state() {
    var d = duration(), t = time();
    return {
      ready: ready(), voice: hasVoice() || turning || heard(), timings: hasTimings(),
      system: speaks(),
      playing: playing(), t: t, d: d,
      f: d > 0 ? Math.max(0, Math.min(1, t / d)) : 0,
      rate: speed(), wpm: paceNow(),
      chapterId: chapterId(), chapterIndex: chapterIndex(),
    };
  }

  /* --------------------------------------------------------- the heartbeat */

  var listeners = [], timer = null, raf = null, last = "";

  /* The signature is what a bar can SEE: the tenth of a second, not the
     microsecond. A rail 300px wide cannot draw finer than that, and a
     repaint per frame for a number that has not changed is the cost this
     avoids. */
  function sig(s) {
    return [s.ready, s.voice, s.system, s.timings, s.playing, s.rate, s.wpm, s.chapterId,
            Math.round(s.t * 10), Math.round(s.d * 10)].join("|");
  }
  function beat() {
    timer = raf = null;
    if (!listeners.length) return;
    arm();                       /* once, and only while nothing is loaded */
    var s = state(), k = sig(s);
    /* the voice ran off the end of its chapter -- the ONE moment a turn is
       taken (see THE CHAPTER TURN) */
    if (wasPlaying && !s.playing && turn()) s = state(), k = sig(s);
    wasPlaying = s.playing;
    /* A NEW MASTER STARTS AT RATE 1 and the listener did not ask for that.
       listen.js's `rate` lives with the chapter it opened, so a chapter turn
       -- or the first open of a book -- hands back an element playing at 1x
       under a bar that says 400 wpm. The pace is re-asserted on the chapter
       id CHANGING and at no other moment, so a rate voiceui set mid-chapter
       (its "slower", its clarify) is left alone, which is voiceui's lane. */
    if (paceIO && s.chapterId !== paceCid) {
      paceCid = s.chapterId;
      if (s.voice && applyPace()) s = state(), k = sig(s);
    }
    if (k !== last) {
      last = k;
      for (var i = listeners.length - 1; i >= 0; i--) {
        try { listeners[i](s); } catch (e) { /* a bar that throws is not the transport's problem */ }
      }
    }
    schedule(s.playing);
  }
  function schedule(fast) {
    if (!listeners.length) return;
    if (fast && root.requestAnimationFrame && !document.hidden) raf = root.requestAnimationFrame(beat);
    else timer = root.setTimeout(beat, IDLE_MS);
  }
  function stop() {
    if (timer) root.clearTimeout(timer);
    if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
    timer = raf = null;
  }
  /* subscribe; the return value unsubscribes. The FIRST subscriber starts the
     loop and the last one out stops it. */
  function on(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    try { fn(state()); } catch (e) {}
    if (listeners.length === 1) { last = ""; schedule(playing()); }
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
      if (!listeners.length) stop();
    };
  }
  /* a tab coming back to the front has a stale face: wake the loop at once */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || !listeners.length) return;
    stop(); last = ""; schedule(playing());
  });

  root.Transport = {
    SPEEDS: SPEEDS,
    ready: ready, hasVoice: hasVoice, hasTimings: hasTimings,
    playing: playing, time: time, duration: duration, fraction: fraction,
    speed: speed, chapterId: chapterId, chapterIndex: chapterIndex,
    play: play, pause: pause, toggle: toggle,
    seekTo: seekTo, seekFraction: seekFraction, nudge: nudge, arm: arm,
    voiceFolder: voiceFolder, heard: heard,
    sysvoice: sysvoice, speaks: speaks, speaking: sysSpeaking,
    get system() { return sys; },
    turn: turn, get turning() { return turning; },
    stepSentence: stepSentence, stepWord: stepWord,
    setSpeed: setSpeed, cycleSpeed: cycleSpeed,
    PACES: PACES, PACE_REF: PACE_REF,
    pace: pace, paceNow: paceNow, stepPace: stepPace, setPace: setPace,
    applyPace: applyPace, rateForPace: rateForPace, nearestPace: nearestPace,
    fmt: fmt, state: state, on: on,
    get control() { return control(); },
  };
})(window);
