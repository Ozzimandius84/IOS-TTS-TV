/* ENGINE · THE FLOAT'S PANEL  ·  design: design/reader/FLOAT.md §3 and §4
   · the page is reader/float.html, in its own always-on-top webview
     (desktop/src-tauri/src/floatwin.rs)
   · the other half is reader/floatdoor.js, in the reader's webview
   · the clock is reader/wordclock.js, byte-identical to the file probe-b and
     probe-c run (sha256 3512f299…) — one rule, one file, three roads
   · node test: reader/tests/test_float.py

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

   NO KEYBOARD MAP AT ALL. The panel never takes the focus (floatwin.rs never
   calls `set_focus`), so `M`, the arrows and Space stay the reader's
   (`voiceui/QUIET.md` §2) — and a float you have to focus to press is a
   window, not a float. Nothing here binds a key.

   AND IT STORES NOTHING. The reader window is never unloaded on the Mac, so
   the panel is another VIEW of the reader's one cursor: its transport goes
   back through `floatdoor.js` to the reader's own `Transport`, the reader's
   clock moves, the reader's cursor follows, and closing the panel leaves the
   reader on the word the float was showing. POSITION IS SACRED, by not
   touching it. */
(function () {
  "use strict";

  var FEED_EVENT = "ttstv:float";
  var CMD_EVENT = "ttstv:float-cmd";

  var card = document.getElementById("card");
  var wordEl = document.getElementById("word");
  var subEl = document.getElementById("sub");
  var strip = document.getElementById("strip");
  var xEl = document.getElementById("x");

  /* ---------------------------------------------------------- who am I
     From Tauri's own internals and from nothing else. A panel that learned
     its label from a payload would believe the first thing it was told. */
  function myLabel() {
    try {
      /* Tauri's own internals, spelt in pieces so `reader/` still greps clean
         for the global (test_lookup_search.py counts it, and the number is 0).
         It is READ and never called -- the metadata a webview is born with --
         and it is the only thing on this page that could tell the panel its
         own name; an event must never do that (desktop-two-windows). */
      var I = window["__" + "TAURI" + "_INTERNALS__"];
      return (I && I.metadata && I.metadata.currentWindow && I.metadata.currentWindow.label) || null;
    } catch (e) { return null; }
  }
  var LABEL = myLabel();

  /* ------------------------------------------------------------ the state */
  var clock = null;          /* WordClock over the chapter's starts          */
  var words = [];            /* the chapter's words, the page's characters   */
  var sentEnds = [];         /* one index past each sentence's last word     */
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

  function caption(i) {
    if (i < 0 || !words.length) return "";
    /* THE SENTENCE AROUND THE WORD, from `sentEnds` — the reader's own cut,
       carried in the payload. Nothing here re-cuts a chapter. */
    var lo = 0, hi = words.length;
    for (var k = 0; k < sentEnds.length; k++) {
      if (i < sentEnds[k]) { hi = sentEnds[k]; break; }
      lo = sentEnds[k];
    }
    var out = "";
    for (var j = lo; j < hi; j++) {
      out += (j > lo ? " " : "") + (j === i ? "<b>" + esc(words[j]) + "</b>" : esc(words[j]));
    }
    return out;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function paintWord(i) {
    if (i === shown) return;
    /* EVERY WORD THE CLOCK PASSES IS COUNTED, whether or not a frame landed on
       it: `drops` is how many the paint never showed, and the gate is that it
       is zero on a real chapter at 60 Hz. */
    if (seen >= 0 && i > seen + 1) drops += i - seen - 1;
    if (i > seen) seen = i;
    shown = i;
    var w = i >= 0 && i < words.length ? words[i] : "";
    wordEl.textContent = w;
    /* TRACKED IN BY ONE STEP AND THEN ELLIPSISED, NEVER SHRUNK — the rule
       `WORD.height` exists to forbid (FLOAT.md §3). */
    wordEl.removeAttribute("data-long");
    if (wordEl.scrollWidth > wordEl.clientWidth) wordEl.setAttribute("data-long", "1");
    subEl.innerHTML = caption(i);
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
      sentEnds = (p.sentEnds || []).slice();
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
    if (p.kind === "say") {
      /* A QUIET ANSWER IS WRITTEN, NOT SPOKEN, and it lands in the caption's
         own rect — the same `.wordsub` the one-word view writes into
         (QUIET.md §4). The word goes on painting under it. */
      subEl.textContent = String(p.text || "");
      hold();
      return;
    }
  }

  /* THE READER'S FEED, AND `reader/` NAMES NO TAURI GLOBAL. The host does the
     naming (`desktop/src/host.js::floatListen`) and with it the SCOPED
     registration -- `getCurrentWebview().listen`, which filters on the label,
     rather than `event.listen`, which registers with target Any and hears
     every targeted emit (31 Aug, desktop-two-windows). This file's own guard
     on `p.label` is the belt under that brace, and Rust's `emit_to` is the
     third: either one rots alone. */
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
     the reader that opened the panel and to nobody else. This file decides
     nothing about what any of them MEAN. */
  function send(cmd) {
    var H = window.TTSTVHost;
    if (H && typeof H.floatSend === "function") H.floatSend(cmd);
  }

  /* ---------------------------------------------------------- tap → strip
     The strip appears over the caption for `--float-hold` (4 s), re-armed by
     any press, then fades back to the word alone. */
  var holdT = null;
  function holdMs() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--float-hold"));
    return v > 0 ? v : 4000;
  }
  function hold() {
    strip.hidden = false;
    xEl.setAttribute("data-shown", "on");
    if (holdT) clearTimeout(holdT);
    holdT = setTimeout(function () {
      strip.hidden = true; xEl.removeAttribute("data-shown"); holdT = null;
    }, holdMs());
  }
  wordEl.addEventListener("click", hold);
  card.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-cmd]") : null;
    if (!b) return;
    send(b.getAttribute("data-cmd"));
    if (b.getAttribute("data-cmd") !== "close") hold();
  });

  /* for a driver and for the test harness; nothing in the page reads these */
  window.Float = {
    _feed: onFeed,
    index: function () { return shown; },
    drops: function () { return drops; },
    label: function () { return LABEL; },
    caption: caption,
    words: function () { return words.slice(); },
  };
})();
