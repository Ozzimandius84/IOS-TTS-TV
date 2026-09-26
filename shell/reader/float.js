/* ENGINE · THE FLOAT'S PANEL  ·  design: design/reader/FLOAT.md §8 + §9
   · the page is design/reader/float.html, in its own always-on-top webview
     (desktop/src-tauri/src/floatwin.rs)
   · the other half is design/reader/floatdoor.js, in the reader's webview
   · the clock is design/reader/wordclock.js, byte-identical to the file probe-b and
     probe-c run (sha256 3512f299…) — one rule, one file, three roads
   · node test: design/reader/test-float-scroll.js

   §8 (Osca, 24 Sep): the float is ONE WORD and nothing else. No card, no
   caption, no strip, no ✕. Close = scroll home (§7). The word paints
   at 60 Hz off a clock, the same as before; only the chrome is gone.

   §9 (Osca, 25 Sep): THE FLOAT IS A HUD. Click-through
   (ignore_cursor_events(true), word span is the only hit region via
   mouse-enter/leave toggle), never focused, above everything on every
   Space (NSStatusWindowLevel), ⌥-drag to move. No Escape handler (no
   focus → no key). Home = axis scroll back (§7).

   WHAT IT DOES: paints the word the reader's voice is on, at 60 Hz, off a
   clock rather than off a message. The reader pushes the chapter's words and
   starts ONCE and a drift correction four times a second; everything between
   those is arithmetic here. Never one message per word — 3.56 words/s
   typically and 16.4/s at p01, forever, over a JSON bridge.

   THE TWO TRAPS, BOTH ALREADY PAID FOR ONCE (`desktop-two-windows`, 31 Aug):

   1. Tauri v2's plain `event.listen` registers with target **Any** and hears
      every targeted emit. So the feed is registered on the CURRENT WEBVIEW --
      `getCurrentWebview().listen`, which filters on the label, and it is
      `desktop/src/host.js::floatListen` that does it, because `reader/` names
      no Tauri global (test_lookup_search.py counts it, and the number is 0).
      This file's guard on `p.label` is the belt under that brace and Rust's
      `emit_to` is the third: either one rots alone.
   2. It learns its own label from Tauri's own per-webview metadata, **never
      from an event**.

   NO KEYBOARD MAP AT ALL (§9). The panel never takes the focus (floatwin.rs
   focused(false), set_ignore_cursor_events(true)), so `M`, the arrows and
   Space stay the reader's (`voiceui/QUIET.md` §2) — and a float you have to
   focus to press is a window, not a float. Nothing here binds a key.

   AND IT STORES NOTHING. The reader window is never unloaded on the Mac, so
   the panel is another VIEW of the reader's one cursor: closing the panel
   leaves the reader on the word the float was showing. POSITION IS SACRED,
   by not touching it. */
(function () {
  "use strict";

  var FEED_EVENT = "ttstv:float";
  var CMD_EVENT = "ttstv:float-cmd";

  var card = document.getElementById("card");
  var wordEl = document.getElementById("word");

  /* ---------------------------------------------------------- who am I
     From Tauri's own internals and from nothing else. A panel that learned
     its label from a payload would believe the first thing it was told. */
  function myLabel() {
    try {
      var I = window["__" + "TAURI" + "_INTERNALS__"];
      return (I && I.metadata && I.metadata.currentWindow && I.metadata.currentWindow.label) || null;
    } catch (e) { return null; }
  }
  var LABEL = myLabel();

  /* ------------------------------------------------------------ the state */
  var clock = null;          /* WordClock over the chapter's starts          */
  var words = [];            /* the chapter's words, the page's characters   */
  var base = 0;              /* the audio time the last tick reported        */
  var baseWall = 0;          /* the wall clock when it reported it           */
  var playing = false;
  var fixedWord = null;      /* the system voice answers in WORDS, not time  */
  var shown = -1;            /* the index on screen, so nothing repaints for
                                a picture that is already right              */
  var drops = 0;             /* words the paint never showed — the number the
                                gate is about, counted rather than assumed   */
  var seen = -1;

  /* -------------------------------------------------------------- the paint

     ONE FRAME, ONE INDEX. `WordClock.indexAt` is the whole of the decision and
     it is a binary search over the starts — no rAF arithmetic, no accumulated
     addition (5490 additions drift past the last word; the shared file says
     so), and a word is skipped only if the audio skipped it. */
  function indexNow() {
    if (fixedWord != null) return fixedWord;
    if (!clock) return -1;
    var t = playing ? base + (now() - baseWall) / 1000 : base;
    return clock.indexAt(t);
  }
  function now() {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function paintWord(i) {
    if (i === shown) return;
    if (seen >= 0 && i > seen + 1) drops += i - seen - 1;
    if (i > seen) seen = i;
    shown = i;
    var w = i >= 0 && i < words.length ? words[i] : "";
    wordEl.textContent = w;
    /* TRACKED IN BY ONE STEP AND THEN ELLIPSISED, NEVER SHRUNK — the rule
       `WORD.height` exists to forbid (FLOAT.md §3). */
    wordEl.removeAttribute("data-long");
    if (wordEl.scrollWidth > wordEl.clientWidth) wordEl.setAttribute("data-long", "1");
  }

  var frame = null;
  function loop() {
    paintWord(indexNow());
    frame = requestAnimationFrame(loop);
  }
  function run() { if (frame == null) frame = requestAnimationFrame(loop); }

  /* --------------------------------------------------------- what comes in */
  function onFeed(p) {
    if (!p || (LABEL && p.label !== LABEL)) return;   /* not addressed to me */
    if (p.kind === "chapter") {
      words = (p.words || []).slice();
      clock = window.WordClock
        ? WordClock.make((p.starts || []).map(function (t, i) { return { t: +t || 0, w: words[i] }; }))
        : null;
      shown = -1; seen = -1; drops = 0;
      run();
      return;
    }
    if (p.kind === "tick") {
      playing = !!p.playing;
      if (p.word != null) { fixedWord = p.word | 0; }
      else { fixedWord = null; base = +p.t || 0; baseWall = now(); }
      run();
      return;
    }
    /* §8: no caption, no strip — "say" payloads are silently ignored. */
  }

  /* THE READER'S FEED, AND `reader/` NAMES NO TAURI GLOBAL. */
  function listen() {
    var H = window.TTSTVHost;
    if (!H || typeof H.floatListen !== "function") return false;
    H.floatListen(FEED_EVENT, onFeed);
    return true;
  }
  listen();

  /* --------------------------------------------------------- what goes out
     Every press is one name through `TTSTVHost.floatSend`, which is
     `float_cmd` in Rust, refused from any webview but this one and emitted to
     the reader that opened the panel and to nobody else. */
  function send(cmd) {
    var H = window.TTSTVHost;
    if (H && typeof H.floatSend === "function") H.floatSend(cmd);
  }

  /* ------------------------------------------- the scroll back is the way home
     Osca, 14 Sep: *"a further scroll right, after one-word view -- it does a
     one-word floater ... Scrolling back brings it home."* §7.

     BACK is px of wheel and `book-nav.js`'s PHYS table holds the same number
     as `floatBack`, keyed by platform; `reader/tests/test_float_axis.py` pins
     the two literals together. */
  var BACK = 120, GAP = 400;
  var backRun = 0, backAt = 0;
  card.addEventListener("wheel", function (e) {
    var dxw = +e.deltaX || 0;
    if (!dxw) return;
    var t = now();
    if (t - backAt > GAP || (backRun < 0) !== (dxw < 0)) backRun = 0;
    backAt = t;
    backRun += dxw;
    if (backRun <= -BACK) { backRun = 0; send("close"); }
  }, { passive: true });

  /* §9: NO KEYBOARD MAP AT ALL. The window never takes focus (floatwin.rs
     focused(false)), so no key can reach it, and there is nothing to bind.
     The Escape handler from §8 is REMOVED — §9 says: *\"Escape only when
     the word has focus cannot exist now (it never has focus).\"* */

  /* ⌥-DRAG ON THE WORD, NOT A BARE DRAG (§9). A HUD an accidental hand
     moves is not furniture. The word itself is the drag handle, but only
     when ⌥ is held: `mousedown` with altKey → `TTSTVHost.floatDrag()` →
     Rust `start_dragging`. Without ⌥, the click-through is re-enabled and
     the press falls to the window beneath.

     MOUSE ENTER/LEAVE toggle `ignore_cursor_events`: the whole window is
     click-through by default (floatwin.rs); entering the word turns it off
     so clicks/drags land; leaving turns it back on. This is the one hit
     region §9 names. */
  wordEl.addEventListener("mouseenter", function () {
    var H = window.TTSTVHost;
    if (H && typeof H.floatCursor === "function") H.floatCursor(false);
  });
  wordEl.addEventListener("mouseleave", function () {
    var H = window.TTSTVHost;
    if (H && typeof H.floatCursor === "function") H.floatCursor(true);
  });
  wordEl.addEventListener("mousedown", function (e) {
    if (!e.altKey) return;
    e.preventDefault();
    var H = window.TTSTVHost;
    if (H && typeof H.floatDrag === "function") H.floatDrag();
  });

  /* for a driver and for the test harness; nothing in the page reads these */
  window.Float = {
    _feed: onFeed,
    index: function () { return shown; },
    drops: function () { return drops; },
    label: function () { return LABEL; },
    words: function () { return words.slice(); },
    back: function () { return BACK; },
    backRun: function () { return backRun; },
  };
})();
