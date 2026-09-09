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
  function playing() { return ask(function (c) { return !c.isPaused(); }, false); }

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
    arming = true;
    try {
      Promise.resolve(c.open(want)).then(function () { arming = false; armed = true; },
                                         function () { arming = false; });
    } catch (e) { arming = false; return false; }
    return true;
  }

  /* ------------------------------------------------------------- the doors */

  function play() { return tell(function (c) { c.play(); }); }
  function pause() { return tell(function (c) { c.pause(); }); }
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
    if (!(d > 0)) return false;
    return seekTo(Math.max(0, Math.min(1, +f || 0)) * d);
  }
  function nudge(sec) { return tell(function (c) { c.seekSeconds(null, +sec || 0); }); }
  function stepSentence(n) { return tell(function (c) { c.seekSentenceDelta(null, n | 0); }); }
  function stepWord(n) { return tell(function (c) { c.seekWordDelta(null, n | 0); }); }

  function setSpeed(r) {
    var v = +r || 1;
    return tell(function (c) { c.setSpeed(null, v); });
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
      ready: ready(), voice: hasVoice(), timings: hasTimings(),
      playing: playing(), t: t, d: d,
      f: d > 0 ? Math.max(0, Math.min(1, t / d)) : 0,
      rate: speed(), chapterId: chapterId(), chapterIndex: chapterIndex(),
    };
  }

  /* --------------------------------------------------------- the heartbeat */

  var listeners = [], timer = null, raf = null, last = "";

  /* The signature is what a bar can SEE: the tenth of a second, not the
     microsecond. A rail 300px wide cannot draw finer than that, and a
     repaint per frame for a number that has not changed is the cost this
     avoids. */
  function sig(s) {
    return [s.ready, s.voice, s.timings, s.playing, s.rate, s.chapterId,
            Math.round(s.t * 10), Math.round(s.d * 10)].join("|");
  }
  function beat() {
    timer = raf = null;
    if (!listeners.length) return;
    arm();                       /* once, and only while nothing is loaded */
    var s = state(), k = sig(s);
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
    stepSentence: stepSentence, stepWord: stepWord,
    setSpeed: setSpeed, cycleSpeed: cycleSpeed,
    fmt: fmt, state: state, on: on,
    get control() { return control(); },
  };
})(window);
