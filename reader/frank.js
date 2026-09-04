/* ============================ FRANK — the face, wired ====================
 * Turns the reader's appearance into the design without touching its DOM.
 * frank.css does the look; this does the one thing a stylesheet cannot --
 * choose the chapter's box by measuring the text that is actually in it.
 *
 * IT WRITES EXACTLY ONE THING: --fk-w on .paneReading. No element is added,
 * moved, wrapped or reclassed, so .word / .sentence identity, the block
 * whitelist "p, h3, blockquote, .argument", offsetTop against .paneReading,
 * and every module hanging off them are untouched by construction.
 */
(function () {
  "use strict";

  /* THE COLUMN: A ROUGH STANDARD, NOT A MEASUREMENT.
     A chapter gets the NARROWEST STANDARD BOX THAT HOLDS ITS 90th-PERCENTILE
     LINE. The boxes ARE the thresholds -- no table of character counts to
     keep in step, and no test anywhere for "is this poetry". Prose falls
     through to the measure on its own: its lines wrap, so they report the
     measure, and no box is wide enough to hold them.
     Chosen off the books -- per-chapter 90th-percentile line length, pooled
     over ten of them, clusters at 35-55 characters and then jumps past 110,
     so the gap between the verse box and the measure is real and nothing
     sensible lives in it. */
  var BOXES = ["--fk-lyric", "--fk-verse"];   // narrowest first; then the measure
  var SAMPLE = 160;   // lines measured per chapter: bounded, so cost does not
                      // scale with the length of the book

  function px(name, el) {
    var v = getComputedStyle(el || document.documentElement).getPropertyValue(name);
    var probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:" + v;
    (el || document.body).appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  }

  function classify(reading) {
    if (!reading) return null;   /* a .paneReading run, or one .fkCh section */
    /* pass 1: no box, so a line that would not wrap reports its TRUE ink
       width and one that would reports the measure */
    reading.style.removeProperty("--fk-w");
    var lines = reading.querySelectorAll("p.verse-line, p.direction, p.body");
    if (!lines.length) return null;
    var step = Math.max(1, Math.ceil(lines.length / SAMPLE));
    var r = document.createRange(), w = [];
    for (var i = 0; i < lines.length; i += step) {
      if (!lines[i].textContent.trim()) continue;
      r.selectNodeContents(lines[i]);
      var m = 0, rects = r.getClientRects();
      for (var j = 0; j < rects.length; j++) if (rects[j].width > m) m = rects[j].width;
      if (m > 1) w.push(m);
    }
    if (!w.length) return null;
    w.sort(function (a, b) { return a - b; });
    var p90 = w[Math.min(w.length - 1, Math.floor(w.length * 0.9))];
    for (var b = 0; b < BOXES.length; b++) {
      var box = px(BOXES[b], reading);
      if (box > 0 && box >= p90) {          /* pass 2: the narrowest that holds it */
        reading.style.setProperty("--fk-w", "var(" + BOXES[b] + ")");
        return { p90: Math.round(p90), box: BOXES[b] };
      }
    }
    return { p90: Math.round(p90), box: "measure" };   /* prose: leave it wide */
  }

  /* ONE BOX PER CHAPTER, not one per book. With the whole book in the run,
     a chapter of hexameters and a chapter of prose are in the same scroller
     and must not share a width -- so each section is classified on its own
     and carries its own --fk-w. Falls back to the run itself when the old
     one-chapter path is what rendered. */
  function all() {
    var out = [];
    var secs = document.querySelectorAll(".paneReading .fkCh");
    if (secs.length) {
      secs.forEach(function (el) { var g = classify(el); if (g) out.push(g); });
      return out;
    }
    document.querySelectorAll(".paneReading").forEach(function (el) {
      var got = classify(el);
      if (got) out.push(got);
    });
    return out;
  }

  /* WHEN TO RE-MEASURE. renderChapter replaces the run wholesale and says so
     to nobody, so this watches the run rather than hooking a function it does
     not own -- which also means it survives every future change to the
     renderer. Debounced to a frame: a chapter arrives as one mutation burst. */
  var pending = 0;
  function soon() {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = 0; all(); });
  }

  function watch() {
    /* A DOM WITHOUT A MutationObserver IS STILL A DOM. The test harness's stub
       has no observer and no layout, and this file's whole job is measurement
       -- so it watches when it can and stays out of the way when it cannot,
       rather than throwing on load and taking the page down with it
       (reader/tests/boot_page.js runs every script the page names). */
    var obs = typeof MutationObserver === "function" ? new MutationObserver(soon) : null;
    if (obs) document.querySelectorAll(".paneReading").forEach(function (el) {
      obs.observe(el, { childList: true });
    });
    addEventListener("resize", soon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
    soon();
  }

  function on() {
    document.documentElement.setAttribute("data-frank", "1");
    soon();
    setTimeout(function () { markStation(); goTo("reading"); }, 0);
  }
  function off() {
    document.documentElement.removeAttribute("data-frank");
    document.documentElement.removeAttribute("data-station");
  }
  function toggle() {
    if (document.documentElement.hasAttribute("data-frank")) { off(); return false; }
    on(); return true;
  }

  /* ---------------------- THE STATIONS -----------------------------------
   * Two stops on one axis: the contents, and the reading. Scrolling `.shell`
   * sideways moves between them and the snap does the rest, so this exists
   * only to let a key or a tool do what the hand already can -- and to say
   * which stop we are at, since the face dims the contents behind you. */
  function shell() { return document.querySelector(".shell"); }
  function stationNow() {
    var sh = shell(); if (!sh) return "reading";
    return sh.scrollLeft < sh.clientWidth * 0.12 ? "contents" : "reading";
  }
  function goTo(where) {
    var sh = shell(); if (!sh) return;
    var side = document.getElementById("sidebar");
    var left = where === "contents" ? 0 : (side ? side.offsetWidth : 0);
    /* `scrollTo` where there is one, and the property where there is not: a
       DOM stub has scrollLeft and no smooth scrolling, and the station must
       still MOVE so `stationNow` answers the truth. */
    if (typeof sh.scrollTo === "function") sh.scrollTo({ left: left, behavior: "smooth" });
    else sh.scrollLeft = left;
  }
  var stations = {
    to: goTo,
    at: stationNow,
    toggle: function () { goTo(stationNow() === "contents" ? "reading" : "contents"); }
  };
  function markStation() {
    document.documentElement.setAttribute("data-station", stationNow());
  }
  addEventListener("scroll", function (e) {
    if (e.target && e.target.classList && e.target.classList.contains("shell")) markStation();
  }, true);

  /* ---- MOVING ALONG THE AXIS, and it must not depend on scroll chaining.
   * The cursor is nearly always over .paneReading, which scrolls vertically
   * and has no sideways overflow of its own. Whether a sideways gesture then
   * reaches the track behind it is up to the browser, and WebKit will not do
   * it reliably once the track carries scroll-snap -- so the gesture is taken
   * here instead and applied to the track directly. It works from anywhere on
   * the page, over text or over the Column, and it cannot be chained away.
   *
   * AND IT TAKES A DRAG AS WELL AS A SCROLL, because they are two different
   * hands: a trackpad swipes, a mouse grabs. A drag begins only outside the
   * text -- selecting a sentence must stay a selection -- and only once it has
   * gone 8px sideways and is mostly sideways, so a vertical drag on the Column
   * still turns it. */
  var HOLD = 8;
  function trackScroll(dx) {
    var sh = shell(); if (!sh) return false;
    if (sh.scrollWidth <= sh.clientWidth + 2) return false;
    sh.scrollLeft += dx;
    return true;
  }
  addEventListener("wheel", function (e) {
    if (!document.documentElement.hasAttribute("data-frank")) return;
    var dx = e.deltaX, dy = e.deltaY;
    if (Math.abs(dx) <= Math.abs(dy)) return;        /* up and down is not ours */
    var sh = shell(); if (!sh) return;
    /* the snap fights a running gesture, so it is lifted while one is in
       flight and put back when the hand stops -- which is also what makes
       the settle land on a station instead of halfway. */
    sh.style.scrollSnapType = "none";
    if (trackScroll(dx)) e.preventDefault();
    clearTimeout(sh._fkSettle);
    sh._fkSettle = setTimeout(function () {
      sh.style.removeProperty("scroll-snap-type");
      goTo(stationNow()); markStation();
    }, 90);
  }, { passive: false, capture: true });

  /* MIDDLE-BUTTON DRAG IS THE ONE THAT WORKS EVERYWHERE. Held down, it pans
   * the axis from anywhere on the page -- over the text included -- because
   * the middle button has no other job here: it cannot start a selection, and
   * the browser's own middle-click autoscroll and paste are the only things
   * it would otherwise do, and both are cancelled. A left drag pans too, but
   * only outside the text, where selecting a sentence must stay a selection.
   * A middle drag has no threshold and no axis test: you asked for it. */
  var drag = null;
  addEventListener("pointerdown", function (e) {
    if (!document.documentElement.hasAttribute("data-frank")) return;
    var mid = e.button === 1;
    if (!mid && (e.button !== 0 || !e.isPrimary)) return;
    if (!mid && e.target.closest && (e.target.closest(".paneReading") ||
        e.target.closest("button, a, input, select, textarea, .popup"))) return;
    drag = { x: e.clientX, y: e.clientY, live: mid, mid: mid,
             from: (shell() || {}).scrollLeft || 0 };
    if (mid) {
      e.preventDefault();                       /* no autoscroll, no paste */
      var sh = shell(); if (sh) sh.style.scrollSnapType = "none";
      document.documentElement.setAttribute("data-fk-panning", "1");
    }
  }, true);
  addEventListener("auxclick", function (e) {
    if (drag === null && e.button === 1 &&
        document.documentElement.hasAttribute("data-frank")) e.preventDefault();
  }, true);
  addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = drag.x - e.clientX, dy = drag.y - e.clientY;
    if (!drag.live) {
      if (Math.abs(dx) < HOLD || Math.abs(dx) <= Math.abs(dy)) return;
      drag.live = true;
      var sh = shell(); if (sh) sh.style.scrollSnapType = "none";
    }
    var sh2 = shell(); if (sh2) sh2.scrollLeft = drag.from + dx;
    e.preventDefault();
  }, true);
  function endDrag() {
    if (!drag) return;
    var was = drag.live; drag = null;
    document.documentElement.removeAttribute("data-fk-panning");
    var sh = shell(); if (!sh) return;
    sh.style.removeProperty("scroll-snap-type");
    if (was) { goTo(stationNow()); markStation(); }
  }
  addEventListener("pointerup", endDrag, true);
  addEventListener("pointercancel", endDrag, true);

  window.Frank = { on: on, off: off, toggle: toggle, measure: all,
                   classify: classify, stations: stations };

  /* ON BY DEFAULT, and remembered. It is the reader's face now, not a
     preview of one; the switch exists so a fault in it can never make the
     book unreadable. */
  try { if (localStorage.getItem("frank") === "0") off(); else on(); }
  catch (e) { on(); }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
