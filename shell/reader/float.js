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

   §10 (Osca, 28 Sep) / FLOAT-HANDS stage 1: the RED LETTER is wrapped by
   wordview.js's rule (paintText); the WINDOW IS THE WORD'S -- card + 2 ×
   `--float-margin`, asked for after every paint with the origin shift that
   keeps the pivot letter on its screen pixel (fit); and the em follows the
   window's height when the window is the driver (onWindowResize), which is
   how the slide from the reader's rect and, later, a corner drag scale the
   word.

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
  var markEl = document.getElementById("mark");   /* D18: the unit marker */

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
  /* D18 (28 Sep): APPARATUS IS A MARKER, NOT A WORD. `skip` is the set of
     indices the reader's feed named as apparatus -- never painted as the
     word; the paint moves on to the next body word instead -- and `marks` the
     unit crossings [{i, label, of}], painted above the word and changed only
     on crossing. Both arrive in the chapter payload (floatdoor.js), off
     wordview.js's one rule; a feed without them (an older reader) paints as
     before. */
  var skip = null, marks = [], markOn = "";
  function bodyOf(i) {
    if (!skip || !skip.has(i)) return i;
    var j = i;
    while (j < words.length && skip.has(j)) j++;
    if (j < words.length) return j;
    j = i; while (j >= 0 && skip.has(j)) j--;
    return j >= 0 ? j : i;
  }
  function paintMark(i) {
    if (!markEl) return;
    var m = null;
    for (var k = 0; k < marks.length; k++) { if (marks[k].i <= i) m = marks[k]; else break; }
    var key = m ? (m.of || "") + "\u0001" + (m.label || "") : "";
    if (key === markOn) return;
    markOn = key;
    markEl.querySelector(".of").textContent = m ? (m.of || "") : "";
    markEl.querySelector(".label").textContent = m ? (m.label || "") : "";
    var wasOn = markEl.classList.contains("on");
    markEl.classList.toggle("on", !!(m && m.label));
    markEl.removeAttribute("data-ev"); void markEl.offsetWidth; markEl.setAttribute("data-ev", "unit");
    /* the marker is above the word, so the card's height changed: the window
       follows and the word's top does not move (fit's dy). When the marker
       just came ON under Frank, the em was read off the window with the
       marker's share of the height missing (the slide's steps arrive before
       the first paint) -- read it again with the marker in, or every open
       grows the word by (1.96 / 1.6) (seen on the Air: 293 -> 363 -> 450). */
    if (wasOn !== markEl.classList.contains("on") && typeof onWindowResize === "function" && hosted) { wantH = null; onWindowResize(); return; }
    if (typeof fit === "function") fit();
  }

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
    paintMark(i);                       /* the marker follows the cursor's word... */
    var b = bodyOf(i);                  /* ...the slot the nearest body word (D18) */
    var w = b >= 0 && b < words.length ? words[b] : "";
    paintText(w);
    /* TRACKED IN BY ONE STEP AND THEN ELLIPSISED, NEVER SHRUNK — the rule
       `WORD.height` exists to forbid (FLOAT.md §3). */
    wordEl.removeAttribute("data-long");
    if (wordEl.scrollWidth > wordEl.clientWidth) wordEl.setAttribute("data-long", "1");
    fit();                              /* the window is the word's (§8) */
  }

  /* THE RED LETTER (FLOAT-HANDS stage 1, 28 Sep). The float painted the whole
     word as one text node, so `#word .pv` matched nothing and the pivot was
     ink -- while the one-word view behind it showed the red. The rule is
     wordview.js's `pivotIndex` (letters only, the prototype's table), loaded
     by float.html for this one call; the letter is wrapped in `.pv` exactly
     as `wordview.js::set` and `lookup.js::drawWord` wrap it. Three spans,
     one text, no second rule. */
  var pvEl = null;
  function paintText(text) {
    text = text == null ? "" : String(text);
    var WV = window.WordView;
    var k = (WV && typeof WV.pivotIndex === "function" && text) ? WV.pivotIndex(text) : -1;
    if (k < 0 || k >= text.length) { wordEl.textContent = text; pvEl = null; return; }
    wordEl.textContent = "";
    var a = document.createElement("span"), b = document.createElement("span"), c = document.createElement("span");
    b.className = "pv";
    a.textContent = text.slice(0, k); b.textContent = text.slice(k, k + 1); c.textContent = text.slice(k + 1);
    wordEl.appendChild(a); wordEl.appendChild(b); wordEl.appendChild(c);
    pvEl = b;
  }

  /* ------------------------------------------------ the window is the word's
     FLOAT.md §8: "Size is the word's ... the window is fit-content of one
     <span>". §10: the outer rect = the word + a margin (the dial
     `--float-margin`, 12 px), and the margin IS the bands and corners. So
     after every paint the window is asked to be card + 2 × margin, and THE
     PIVOT LETTER STAYS WHERE IT WAS: the request carries the origin shift that
     keeps the red letter's left edge and the word's top on the same screen
     pixels -- the one-word view's own rule (the letter stands on one column;
     the word grows around it), carried out here in window coordinates.

     Two drivers, one em. When the PAGE drives (a new word, the marker
     appearing), the em is its own and the height follows. When the WINDOW
     drives (a corner drag, the slide home, the slide from the reader's rect),
     the em follows the height: em = (h - 2m - gap) / 1.36 with the marker on,
     h - 2m without. `wantH` tells the two apart: a resize event whose height
     is the one this page asked for is the page's own echo. */
  var MARGIN_RATIO = 0.3, MARK_GAP = 12, MARK_RATIO = 0.36;   /* float.css's numbers; MARK_GAP follows --float-mark-gap (12 since 29 Sep) */
  /* the margin is 0.3 em (float.css `--float-margin: calc(var(--float-em) * .3)`
     -- a custom property keeps its calc() unresolved, so it is computed here
     from the em, the one number) */
  function marginPx() { return emPx() * MARGIN_RATIO; }
  function emPx() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--float-em"));
    return v > 0 ? v : 40;
  }
  function setEm(px) {
    px = Math.max(8, Math.min(1400, +px || 40));
    document.documentElement.style.setProperty("--float-em", px.toFixed(2) + "px");
  }
  var wantH = null, wantW = null;
  var anchor = null;             /* {px, top}: the pivot's left and the word's top, in window px */
  var pad = { l: 0, t: 0, r: 0, b: 0 };   /* the fan's room around the box (stage 3) */
  var hosted = !!LABEL;          /* under Frank the window is ours to size; on the bench it is the browser's */
  function fit() {
    var H = window.TTSTVHost;
    if (!hosted || !H || typeof H.floatResize !== "function") return;
    /* NO WORD, NO FIT: the window opened at the reader's word rect and keeps
       it until the first word is painted (a fit to an empty card would
       shrink it to the margins and grow it back -- a blink). */
    if (!wordEl.textContent) return;
    var m = marginPx();
    var cr = card.getBoundingClientRect();
    var wr = wordEl.getBoundingClientRect();
    var pr = pvEl ? pvEl.getBoundingClientRect() : wr;
    /* the window is box + the fan's pads while the fan is up (stage 3) -- and while the fan (or an answer) is up THE
       BOX HOLDS STILL (ASKS #146, Osca 29 Sep): the size and place it had when the fan opened, whatever word is on it */
    var still = (fan && fan.box) || (answer && answer.box);
    var bw = still ? still.w : cr.width, bh = still ? still.h : cr.height;
    var w = Math.ceil(bw + 2 * m + pad.l + pad.r), h = Math.ceil(bh + 2 * m + pad.t + pad.b);
    /* the pivot's left and the word's top, in WINDOW px: the screen pixel is
       origin + these, so the origin moves by (last - now) and the letter
       stays. The anchor is the last frame's window-px, never shifted. */
    var px = pr.left, top = wr.top;
    var dx = anchor && !still ? anchor.px - px : 0, dy = anchor && !still ? anchor.top - top : 0;
    if (still && anchor) { px = anchor.px; top = anchor.top; }
    if (Math.abs(dx) < 0.5) dx = 0;
    if (Math.abs(dy) < 0.5) dy = 0;
    anchor = { px: px, top: top };
    if (w === wantW && h === wantH && !dx && !dy) return;
    wantW = w; wantH = h;
    H.floatResize(w, h, dx, dy);
  }
  /* the window drove: a corner, the slide, the reader's rect at open */
  function onWindowResize() {
    if (!hosted) return;
    var h = window.innerHeight;
    if (wantH != null && Math.abs(h - wantH) <= 1) return;   /* our own echo */
    /* h = em + 2 × 0.3 em (+ the marker's 0.36 em + gap when on) */
    var on = markEl && markEl.classList.contains("on");
    h -= pad.t + pad.b;                   /* the fan's room is not the word's */
    var em = on ? (h - MARK_GAP) / (1 + 2 * MARGIN_RATIO + MARK_RATIO) : h / (1 + 2 * MARGIN_RATIO);
    if (!(em > 0)) return;
    setEm(em);
    wantH = h; anchor = null;            /* the window put us here; measure afresh */
    fit();
  }
  window.addEventListener("resize", onWindowResize);
  /* at open the window IS the reader's word rect + margin: take the em off it */
  if (hosted) { wantH = null; onWindowResize(); }

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
      skip = p.skip && p.skip.length ? new Set(p.skip) : null;
      marks = (p.marks || []).slice().sort(function (a, b) { return a.i - b.i; });
      markOn = null; paintMark(-1);      /* null, so an empty marker is written */
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
    /* §8 had no caption and ignored "say". ASKS #147 (Osca 29 Sep): Define and Explain answer IN A CARD BESIDE THE
       FLOATING WORD and Frank stays minimised -- an "answer" (Define, from the reader's dictionary) or a "say"
       (Explain's written answer) is that card. */
    if (p.kind === "answer") { showAnswer(p.head || "Frank", p.lines || []); return; }
    if (p.kind === "say" && p.text) { showAnswer("Frank · Explain", [String(p.text)]); return; }
  }
  var answer = null;               /* {el, side, box} while an answer card is up */
  var ANSWER_W = 264, ANSWER_GAP = 12;
  function showAnswer(head, lines) {
    hideAnswer(true);
    if (typeof closeFan === "function" && fan) closeFan(true);
    var el = document.createElement("div"); el.id = "answer";
    var h = document.createElement("div"); h.className = "a-head"; h.textContent = head; el.appendChild(h);
    lines.forEach(function (t) { var l = document.createElement("p"); l.textContent = t; el.appendChild(l); });
    document.body.appendChild(el);
    var cb = card.getBoundingClientRect(), side = away || "right";
    answer = { el: el, side: side, box: { w: cb.width, h: cb.height } };
    var m = marginPx(), need = ANSWER_W + ANSWER_GAP;
    var tall = Math.max(0, el.offsetHeight - (cb.height + 2 * m));
    pad = { l: side === "left" ? need : 0, t: 0, r: side === "right" ? need : 0, b: Math.ceil(tall) };
    applyPad();
    el.style.width = ANSWER_W + "px";
    el.style.top = "0px";
    el.style.left = side === "right" ? Math.round(cb.width + 2 * m + ANSWER_GAP / 2) + "px" : "0px";
    if (typeof hold === "function") hold(true);
    fit();
  }
  function hideAnswer(keepHold) {
    if (!answer) return;
    if (answer.el.parentNode) answer.el.parentNode.removeChild(answer.el);
    answer = null; pad = { l: 0, t: 0, r: 0, b: 0 }; applyPad(); fit();
    if (!keepHold && typeof hold === "function") hold(false);
  }
  /* a press anywhere but on the answer takes it down (the same finger that asked can dismiss it) */
  window.addEventListener("pointerdown", function (e) { if (answer && !(e.target.closest && e.target.closest("#answer"))) hideAnswer(); }, true);

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

  /* ====================== THE CONTENTS (FLOAT.md §10) — float.design.json ===
     "we need to be able to change what's present in the options, but the
     interactions remain the same." The fan's 3-4 entries and the dials come
     from `float.design.json` beside this page (the editor's Float page writes
     it); the verbs' names and glyphs are here, the INTERACTIONS are fixed in
     the hands below. A missing file is the default fan. */
  var DESIGN = {
    fan: ["speak", "define", "explain", "frank"],
    dials: { hold: 350, snap: 12, home: 80, fan: { radius: 64, size: 40, arc: 100 },
             breathe: { period: 4000, sat: 0.15, light: 0.08, hue: 3 } },
  };
  var VERBS = {
    speak:     { label: "Speak",     glyph: "\u25CE", toggle: true, cmd: function () { return "speak:" + (mic ? "off" : "on"); } },
    define:    { label: "Define",    cmd: "define" },
    explain:   { label: "Explain",   cmd: "explain" },
    translate: { label: "Translate", cmd: "translate" },
    frank:     { label: "Frank",     glyph: "\u2302", cmd: "close" },
    prevch:    { label: "Chapter",   glyph: "\u25C0", cmd: "chapter:-1" },
    nextch:    { label: "Chapter",   glyph: "\u25B6", cmd: "chapter:1" },
    pace:      { label: "Pace",      cmd: "pace" },
    sleep:     { label: "Sleep",     cmd: "sleep" },
  };
  function fanVerbs() {
    var out = [];
    (DESIGN.fan || []).forEach(function (id) { if (VERBS[id] && out.indexOf(id) < 0) out.push(id); });
    return out.slice(0, 4);
  }
  function dial(path, dflt) {
    var v = DESIGN.dials;
    path.split(".").forEach(function (k) { v = v && v[k]; });
    return (typeof v === "number" && isFinite(v)) ? v : dflt;
  }
  var designReady = (function () {
    if (typeof fetch !== "function") return Promise.resolve(DESIGN);
    return fetch("float.design.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && Array.isArray(j.fan)) DESIGN.fan = j.fan.slice();
        if (j && j.dials) DESIGN.dials = Object.assign({}, DESIGN.dials, j.dials);
        return DESIGN;
      }, function () { return DESIGN; });
  })();

  /* ============================ THE HANDS (FLOAT.md §10, Osca 28 Sep) =====
     "an invisible box WITH boxes inside it which interact differently with
     presses, holds and drags". The window is the outer rect; the margin
     (`--float-margin`) is cut into the bands and corners; the card is W.

         box            press          hold (350 ms)     drag
         W  the word    play / pause   the fan           move (snaps to the borders)
         S  sides       the fan        --                vertical = scrub · inward from the
                                                         border side = HOME (stage 4)
         top / bottom   the fan        --                move
         R  corners     the fan        --                resize (the word follows)

     CLICK-THROUGH AT REST is Rust's (floatwin.rs::watch_cursor): the window
     takes input only while the pointer is over the outer rect, and the page
     HOLDS it awake from pointerdown to pointerup so a drag that leaves the
     rect is not cut off. The old mouse-enter/leave toggle on the word and
     the ⌥-only drag (§9) are superseded by this table.

     The fan (press on a band/corner, hold on W) is stage 3: `onFan` is the
     one door it will come through; here it records the press. */
  var HOLD_MS = 350, DRAG_PX = 4, SNAP_PX = 12, SCRUB_PX = 20;
  var gesture = null;          /* the live pointer: {id, region, x0, y0, sx, sy, moved, timer, ...} */
  var lastPress = null;        /* for the bench: where the last tap/hold landed */
  var onFan = function (at) { lastPress = at; };   /* stage 3 replaces this */

  function regionAt(x, y) {
    var m = marginPx(), W = window.innerWidth, H = window.innerHeight;
    var cx = x < m ? "l" : x >= W - m ? "r" : "";
    var cy = y < m ? "t" : y >= H - m ? "b" : "";
    if (cx && cy) return { box: "R", corner: cy + cx };            /* tl tr bl br */
    if (cx) return { box: "S", side: cx === "l" ? "left" : "right" };
    if (cy) return { box: cy === "t" ? "top" : "bottom" };
    return { box: "W" };
  }
  function host() { return window.TTSTVHost || null; }
  function hold(on) { var H = host(); if (H && typeof H.floatHold === "function") H.floatHold(!!on); }
  function moveBy(dx, dy) { var H = host(); if (H && typeof H.floatMove === "function") H.floatMove(dx, dy); }
  function geom() {
    var H = host();
    if (!H || typeof H.floatGeom !== "function") return Promise.resolve(null);
    try { return Promise.resolve(H.floatGeom()); } catch (e) { return Promise.resolve(null); }
  }

  /* THE SNAP, pure: a window rect released within SNAP_PX of a screen border
     sits on it. Returns the delta to move by. */
  function snapTo(r, screen, magnet) {
    magnet = magnet == null ? SNAP_PX : magnet;
    var dx = 0, dy = 0;
    if (!r || !screen) return { dx: 0, dy: 0 };
    var l = r.x - screen.sx, rr = screen.sx + screen.sw - (r.x + r.w);
    var t = r.y - screen.sy, bb = screen.sy + screen.sh - (r.y + r.h);
    if (Math.abs(l) <= magnet) dx = -l; else if (Math.abs(rr) <= magnet) dx = rr;
    if (Math.abs(t) <= magnet) dy = -t; else if (Math.abs(bb) <= magnet) dy = bb;
    return { dx: dx, dy: dy };
  }
  function snapNow() {
    return geom().then(function (g) {
      if (!g) return null;
      var d = snapTo(g, g, SNAP_PX);
      if (d.dx || d.dy) moveBy(d.dx, d.dy);
      return d;
    });
  }

  /* THE SCRUB: a vertical drag on a side steps the reading one word per
     SCRUB_PX, down = forward; the reader's transport moves its own cursor
     (floatdoor.js routes `scrub:N` to Transport.stepWord) and the feed brings
     the word back here. Release resumes there -- nothing to do, the cursor
     IS there. */
  function scrubTo(dyTotal) {
    var want = Math.round(dyTotal / SCRUB_PX);
    var step = want - gesture.scrubbed;
    if (!step) return;
    gesture.scrubbed = want;
    send("scrub:" + step);
  }

  /* THE RESIZE: a corner drag scales the em by the box's height -- pull the
     bottom-right corner down 20 px on a 64 px box and the word grows by
     20/64; the window follows through fit(), height and font-size in one
     ratio (the bench's number). Top corners scale by the upward pull. */
  function resizeTo(dx, dy) {
    var c = gesture.corner, h0 = gesture.h0, em0 = gesture.em0;
    var pull = (c[0] === "t" ? -dy : dy);
    var k = (h0 + pull) / h0;
    if (!(k > 0)) return;
    setEm(Math.max(8, Math.min(1400, em0 * k)));
    fit();
  }

  function pointerDown(e) {
    if (!e.isPrimary || e.button !== 0) return;
    /* a press by the SAME pointer while a gesture is still recorded means
       its up was never seen (released off-window): the old one is stale */
    if (gesture) { if (e.pointerId === gesture.id) endGesture(); else return; }
    /* THE FAN IS UP: a press on a circle acts, a press anywhere else closes
       it -- and neither starts a gesture */
    if (fan) {
      var c = circleAt(e.clientX, e.clientY);
      e.preventDefault();
      if (c) { act(c.id); closeFan(false); }
      else closeFan(false);
      return;
    }
    var r = regionAt(e.clientX, e.clientY);
    gesture = { id: e.pointerId, region: r, box: r.box, corner: r.corner || "", side: r.side || "",
                x0: e.clientX, y0: e.clientY, sx: e.screenX, sy: e.screenY, lx: e.screenX, ly: e.screenY,
                moved: false, kind: null, scrubbed: 0, h0: window.innerHeight, em0: emPx(), timer: null };
    hold(true);
    if (r.box === "S") refreshAway();                  /* HOME needs the nearer border */
    try { if (e.target && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId); } catch (_) {}
    /* a hold on any box opens the fan under the finger (W: §10's hold; a
       band: the same fan its press would open, so a slide onto a circle can
       start from the press) */
    gesture.timer = setTimeout(function () {
      if (!gesture || gesture.moved) return;
      gesture.kind = "hold";
      onFan({ box: gesture.box, side: gesture.side, corner: gesture.corner, x: gesture.x0, y: gesture.y0, hold: true });
    }, dial("hold", HOLD_MS));
    e.preventDefault();
  }
  function pointerMove(e) {
    if (!gesture || e.pointerId !== gesture.id) return;
    var dx = e.screenX - gesture.sx, dy = e.screenY - gesture.sy;
    if (!gesture.moved) {
      if (Math.abs(dx) < DRAG_PX && Math.abs(dy) < DRAG_PX) return;
      gesture.moved = true;
      if (gesture.timer) { clearTimeout(gesture.timer); gesture.timer = null; }
      if (gesture.kind === "hold") { /* the fan is up: the slide is its own */ }
      else
      gesture.kind = gesture.box === "W" || gesture.box === "top" || gesture.box === "bottom" ? "move"
                   : gesture.box === "R" ? "resize"
                   : (Math.abs(dy) >= Math.abs(dx) ? "scrub" : "home");
    }
    if (gesture.kind === "hold") {
      if (fan) fan.circles.forEach(function (c) { c.el.setAttribute("data-hot", circleAt(e.clientX, e.clientY) === c ? "1" : "0"); });
      return;
    }
    if (gesture.kind === "move") {
      var mx = e.screenX - gesture.lx, my = e.screenY - gesture.ly;
      gesture.lx = e.screenX; gesture.ly = e.screenY;
      if (mx || my) moveBy(mx, my);
    } else if (gesture.kind === "scrub") {
      scrubTo(dy);
    } else if (gesture.kind === "resize") {
      resizeTo(dx, dy);
    } else if (gesture.kind === "home") {
      onHome && onHome(gesture, dx, dy, false);         /* stage 4 */
    }
  }
  function endGesture() {
    if (!gesture) return;
    if (gesture.timer) clearTimeout(gesture.timer);
    gesture = null;
    hold(false);
  }
  function pointerUp(e) {
    if (!gesture || e.pointerId !== gesture.id) return;
    var g = gesture; gesture = null;
    if (g.timer) clearTimeout(g.timer);
    try { if (e.target && e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId); } catch (_) {}
    if (g.kind === "hold") {                                   /* slide onto a circle and release */
      var c = fan ? circleAt(e.clientX, e.clientY) : null;
      if (c) { act(c.id); closeFan(false); }
      /* released off a circle: the fan stays up, holding the window, until a press */
      return;
    }
    if (!g.moved) {
      if (g.box === "W") { lastPress = { box: "W", tap: true }; send("play"); }
      else onFan({ box: g.box, side: g.side, corner: g.corner, x: g.x0, y: g.y0, hold: false });
      hold(false);
      return;
    }
    if (g.kind === "move") { snapNow().then(function () { hold(false); }); return; }
    if (g.kind === "home") { onHome && onHome(g, e.screenX - g.sx, e.screenY - g.sy, true); hold(false); return; }
    hold(false);
  }
  /* ================================= HOME (§10, Osca 28 Sep) ==============
     "a drag from the screen's edge, inward." The float is anywhere, but it
     knows which of the LEFT/RIGHT borders is nearer, and the side of the box
     facing it is the handle: right half -> from its right side, drag left;
     left half -> from its left side, drag right. Top and bottom never count.
     The window follows the finger; past the threshold (the `home` dial, 80
     px) the word slides back into Frank's one-word view -- Rust plays §9's
     slide in reverse to the rect it opened from and closes, D17 restores the
     reader, on the same word because the reader's cursor never moved. Short
     of it, it springs back. The wheel over W is the same door (§7). */
  var nearer = "left";            /* the nearer left/right border, read at each press */
  function homeSide() { return nearer === "left" ? "left" : "right"; }
  var onHome = function (g, dx, dy, released) {
    if (g.side !== homeSide()) return;                 /* the far side is not the handle */
    var inward = nearer === "left" ? dx : -dx;         /* positive = toward the screen's middle */
    if (!released) {
      /* the window follows the finger, inward only */
      var want = Math.max(0, inward), step = want - (g.homed || 0);
      g.homed = want;
      if (step) moveBy(nearer === "left" ? step : -step, 0);
      return;
    }
    var threshold = dial("home", 80);
    if (inward >= threshold) {
      /* back to the rest first: the finger's follow is not the remembered
         spot (Rust persists every Moved), then the door -- the slide home
         starts from where the word lives */
      if (g.homed) moveBy(nearer === "left" ? -g.homed : g.homed, 0);
      lastPress = { box: "S", home: true, px: inward }; send("close"); return;
    }
    /* short of it: spring back */
    if (g.homed) moveBy(nearer === "left" ? -g.homed : g.homed, 0);
    lastPress = { box: "S", home: false, px: inward };
  };

  /* ================================= THE FAN (§10, Air Command) ============
     Three or four circles from the press point, OUTSIDE the box, on the side
     away from the nearer left/right screen border. Tap one or slide onto it
     and release; a press anywhere else closes it. The window grows to hold
     the circles while the fan is up (pads around the box, the word stays on
     its pixel through fit's anchor) and shrinks back after. A toggle shows
     its state as a filled circle. */
  var fanEl = document.getElementById("fan");
  var fan = null;                 /* {at, circles:[{id, el, x, y}], away} while open */
  var away = "right";             /* the side the fan opens on: away from the nearer border */
  var mic = false;                /* Speak's state */
  function applyPad() {
    card.style.left = "calc(var(--float-margin) + " + pad.l + "px)";
    card.style.top = "calc(var(--float-margin) + " + pad.t + "px)";
    fanEl.style.left = pad.l + "px"; fanEl.style.top = pad.t + "px";
  }
  function refreshAway() {
    return geom().then(function (g) {
      if (!g || !(g.sw > 0)) return away;
      var mid = g.x + g.w / 2 - g.sx;
      nearer = mid < g.sw / 2 ? "left" : "right";
      away = nearer === "left" ? "right" : "left";    /* nearer border = left -> fan opens right */
      return away;
    });
  }
  /* PURE: the circles' centres for N verbs from a press at (x, y) in a box
     [0,0,W,H], fanned on the `away` side, every centre outside the box. */
  function fanLayout(x, y, W, H, n, awaySide, R, size, arcDeg) {
    var out = [];
    if (!n) return out;
    var dir = awaySide === "left" ? Math.PI : 0;
    var arc = (arcDeg * Math.PI) / 180;
    for (var i = 0; i < n; i++) {
      var a = n === 1 ? dir : dir - arc / 2 + (arc * i) / (n - 1);
      out.push({ x: x + R * Math.cos(a), y: y + R * Math.sin(a) });
    }
    /* outside the box: push the whole fan along `away` until every centre
       clears the box edge by half a circle */
    var clear = size / 2 + 2, shift = 0;
    out.forEach(function (c) {
      var need = awaySide === "left" ? c.x + clear : (W + clear) - c.x;   /* how far this one is short of clear */
      if (need > shift) shift = need;
    });
    out.forEach(function (c) { c.x += awaySide === "left" ? -shift : shift; });
    return out;
  }
  function openFan(at) {
    closeFan(true);
    lastPress = at;
    var ids = fanVerbs();
    if (!ids.length) return;
    var R = dial("fan.radius", 64), size = dial("fan.size", 40), arc = dial("fan.arc", 100);
    var W = window.innerWidth - pad.l - pad.r, H = window.innerHeight - pad.t - pad.b;
    var pts = fanLayout(at.x - pad.l, at.y - pad.t, W, H, ids.length, away, R, size, arc);
    var minX = 0, minY = 0, maxX = W, maxY = H;
    pts.forEach(function (c) { minX = Math.min(minX, c.x - size / 2 - 4); minY = Math.min(minY, c.y - size / 2 - 4); maxX = Math.max(maxX, c.x + size / 2 + 4); maxY = Math.max(maxY, c.y + size / 2 + 4); });
    pad = { l: Math.ceil(-minX), t: Math.ceil(-minY), r: Math.ceil(maxX - W), b: Math.ceil(maxY - H) };
    applyPad();
    document.documentElement.style.setProperty("--fan-size", size + "px");
    var cb = card.getBoundingClientRect();
    fan = { at: at, circles: [], away: away, box: { w: cb.width, h: cb.height } };
    ids.forEach(function (id, i) {
      var v = VERBS[id], el = document.createElement("div");
      el.className = "fc"; el.setAttribute("data-verb", id);
      el.style.left = pts[i].x + "px"; el.style.top = pts[i].y + "px";
      el.innerHTML = (v.glyph ? '<span class="g">' + v.glyph + "</span>" : "") + (v.glyph ? "" : v.label);
      el.title = v.label;
      if (v.toggle) el.setAttribute("data-on", mic ? "1" : "0");
      fanEl.appendChild(el);
      fan.circles.push({ id: id, el: el, x: pts[i].x, y: pts[i].y });
    });
    hold(true);
    fit();
  }
  function closeFan(keepHold) {
    if (!fan) return;
    fan = null;
    while (fanEl.firstChild) fanEl.removeChild(fanEl.firstChild);
    pad = { l: 0, t: 0, r: 0, b: 0 };
    applyPad();
    fit();
    if (!keepHold) hold(false);
  }
  function circleAt(x, y) {
    if (!fan) return null;
    var size = dial("fan.size", 40);
    for (var i = 0; i < fan.circles.length; i++) {
      var c = fan.circles[i], dx = x - pad.l - c.x, dy = y - pad.t - c.y;
      if (dx * dx + dy * dy <= (size / 2) * (size / 2) + 16) return c;
    }
    return null;
  }
  function act(id) {
    var v = VERBS[id];
    if (!v) return;
    if (id === "speak") { mic = !mic; breathe(mic); }
    var cmd = typeof v.cmd === "function" ? v.cmd() : v.cmd;
    if (id === "speak") cmd = "speak:" + (mic ? "on" : "off");
    send(cmd);
    lastPress = { box: "fan", verb: id, cmd: cmd };
  }
  var realFan = function (at) { refreshAway().then(function () { openFan(at); }); };
  onFan = realFan;

  /* ============================ THE RED LETTER BREATHES (§10) =============
     While Speak is on the pivot breathes -- warmth, saturation, darkness --
     over the period, and nothing else about it moves. --pivot-warm is
     computed once off the computed --pivot so the swing is the dial's. */
  function rgbOf(str) { var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(str || ""); return m ? [+m[1], +m[2], +m[3]] : null; }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4); h *= 60; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function warmOf(rgb) {
    var hsl = rgb2hsl(rgb[0], rgb[1], rgb[2]);
    var h = hsl[0], s = Math.min(1, hsl[1] + dial("breathe.sat", 0.15)), l = Math.min(1, hsl[2] + dial("breathe.light", 0.08));
    var toward = 30, dh = dial("breathe.hue", 3);           /* orange is 30° */
    h += (toward > h ? 1 : -1) * dh;
    return hsl2rgb(h, s, l);
  }
  function breathe(on) {
    var root = document.documentElement;
    if (on) {
      var base = rgbOf(getComputedStyle(pvEl || wordEl).color) || rgbOf(getComputedStyle(root).getPropertyValue("--pivot")) || [192, 44, 70];
      var w = warmOf(base);
      root.style.setProperty("--pivot-warm", "rgb(" + w.join(", ") + ")");
      root.style.setProperty("--breathe-ms", dial("breathe.period", 4000) + "ms");
      wordEl.classList.add("breathing");
    } else {
      wordEl.classList.remove("breathing");
    }
  }

  card.style.pointerEvents = "auto";
  document.addEventListener("pointerdown", pointerDown);
  document.addEventListener("pointermove", pointerMove);
  document.addEventListener("pointerup", pointerUp);
  document.addEventListener("pointercancel", pointerUp);
  window.addEventListener("blur", endGesture);
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* for a driver and for the test harness; nothing in the page reads these */
  window.Float = {
    _feed: onFeed,
    index: function () { return shown; },
    drops: function () { return drops; },
    label: function () { return LABEL; },
    /* D18, read-only: the marker's text and which indices are never painted */
    marker: function () { return markEl ? { of: markEl.querySelector(".of").textContent, label: markEl.querySelector(".label").textContent, on: markEl.classList.contains("on") } : null; },
    skipped: function () { return skip ? Array.from(skip).sort(function (a, b) { return a - b; }) : []; },
    words: function () { return words.slice(); },
    back: function () { return BACK; },
    backRun: function () { return backRun; },
    /* FLOAT-HANDS stage 1: the red letter and the fit, as numbers */
    pivot: function () { return pvEl ? pvEl.textContent : null; },
    pivotColor: function () { return pvEl ? getComputedStyle(pvEl).color : null; },
    em: function () { return emPx(); },
    margin: function () { return marginPx(); },
    want: function () { return { w: wantW, h: wantH, anchor: anchor }; },
    setEm: setEm,
    fit: fit,
    paintText: paintText,
    /* one frame, now -- a headless bench does not always get a rAF */
    paintNow: function () { paintWord(indexNow()); return shown; },
    /* stage 2: the hands, as numbers */
    regionAt: regionAt,
    snapTo: snapTo,
    gesture: function () { return gesture; },
    lastPress: function () { return lastPress; },
    numbers: function () { return { HOLD_MS: HOLD_MS, DRAG_PX: DRAG_PX, SNAP_PX: SNAP_PX, SCRUB_PX: SCRUB_PX }; },
    _setFan: function (f) { onFan = f || realFan; },
    _setHome: function (f) { onHome = f; },
    nearer: function () { return nearer; },
    /* stage 3: the fan, as numbers */
    design: function () { return DESIGN; },
    designReady: function () { return designReady; },
    fanVerbs: fanVerbs,
    fanLayout: fanLayout,
    showAnswer: function (h, l) { showAnswer(h, l); }, hideAnswer: function () { hideAnswer(); },
    fan: function () { return fan ? { at: fan.at, away: fan.away, circles: fan.circles.map(function (c) { return { id: c.id, x: c.x + pad.l, y: c.y + pad.t, on: c.el.getAttribute("data-on") }; }) } : null; },
    pad: function () { return Object.assign({}, pad); },
    away: function () { return away; },
    mic: function () { return mic; },
    act: act,
    openFan: openFan,
    closeFan: function () { closeFan(false); },
    warmOf: warmOf,
  };
})();
