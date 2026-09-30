/* DISMISS -- THE WAYS OUT OF A BOOK THAT ARE HANDS, NOT BUTTONS (ASKS #148, #149; Osca 29 Sep: "on every host, from a
   book's page and from inside a book: pinch out zooms you back to the shelf, and grabbing the book, dragging it and
   flinging it takes you out, like swiping a photo away in Photos. Mac: trackpad pinch and drag").

   Two hands, one file, used by the Library's book view and by the reader:
     Dismiss.pinch(zone, show, out)   pinch OUT on `zone` -- the Mac trackpad (a ctrl/⌘-wheel, which is what Chromium
                                      and WebKit make of a pinch), Safari's gesture scale, or two fingers closing --
                                      calls show(p) with 0..1 as the fingers close (the thing shrinks with them) and
                                      out() past the threshold; a pinch that stops short springs back (show(0)).
     Dismiss.fling(handle, show, out) grab `handle` (mouse, trackpad click-drag, finger), drag: show(dx, dy, p);
                                      let go past 110 px, or thrown faster than 0.6 px/ms, and out(); else back.
   Neither prevents a click that did not move; a drag that moved swallows its own click. */
(function () {
  "use strict";
  var PINCH_OUT = 0.72, WHEEL_OUT = 90, FLING_D = 110, FLING_V = 0.6;
  function pinch(zone, show, out) {
    if (!zone || zone.__dismissPinch) return; zone.__dismissPinch = 1;
    var acc = 0, t = 0, done = false;
    function settle() { clearTimeout(t); t = setTimeout(function () { if (!done) { acc = 0; show(0); } }, 180); }
    zone.addEventListener("wheel", function (e) {
      if (!(e.ctrlKey || e.metaKey) || done) return;           /* a trackpad pinch arrives as a ctrl-wheel */
      e.preventDefault();
      acc = Math.max(0, acc + e.deltaY);                          /* deltaY > 0: the fingers closing, zooming out */
      var p = Math.min(1, acc / WHEEL_OUT); show(p);
      if (p >= 1) { done = true; out(); } else settle();
    }, { passive: false });
    var g0 = null;
    zone.addEventListener("gesturestart", function (e) { g0 = 1; e.preventDefault(); }, { passive: false });
    zone.addEventListener("gesturechange", function (e) {
      if (g0 == null || done) return; e.preventDefault();
      var p = Math.max(0, Math.min(1, (1 - e.scale) / (1 - PINCH_OUT))); show(p);
      if (p >= 1) { done = true; out(); }
    }, { passive: false });
    zone.addEventListener("gestureend", function () { g0 = null; if (!done) show(0); });
    var d0 = null;
    function dist(t) { var a = t[0], b = t[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    zone.addEventListener("touchstart", function (e) { d0 = e.touches.length === 2 ? dist(e.touches) : null; }, { passive: true });
    zone.addEventListener("touchmove", function (e) {
      if (d0 == null || e.touches.length !== 2 || done) return;
      var r = dist(e.touches) / d0, p = Math.max(0, Math.min(1, (1 - r) / (1 - PINCH_OUT))); show(p);
      if (p >= 1) { done = true; d0 = null; out(); }
    }, { passive: true });
    zone.addEventListener("touchend", function (e) { if (d0 != null && e.touches.length < 2) { d0 = null; if (!done) show(0); } }, { passive: true });
    return { reset: function () { done = false; acc = 0; } };
  }
  function fling(handle, show, out, opts) {
    if (!handle || handle.__dismissFling) return; handle.__dismissFling = 1;
    var mouseOnly = !!(opts && opts.mouseOnly);   /* where a finger already scrolls (the book view), fingers keep that */
    var s = null, moved = false;
    handle.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || (mouseOnly && e.pointerType === "touch")) return;
      s = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0, id: e.pointerId };
      moved = false;
    });
    handle.addEventListener("pointermove", function (e) {
      if (!s || e.pointerId !== s.id) return;
      var dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) { moved = true; try { handle.setPointerCapture(e.pointerId); } catch (x) {} }
      var now = performance.now(), dt = Math.max(1, now - s.lt);
      s.vx = (e.clientX - s.lx) / dt; s.vy = (e.clientY - s.ly) / dt; s.lx = e.clientX; s.ly = e.clientY; s.lt = now;
      show(dx, dy, Math.min(1, Math.hypot(dx, dy) / (FLING_D * 2)));
    });
    function end(e) {
      if (!s || (e && e.pointerId !== s.id)) return;
      var dx = (e ? e.clientX : s.lx) - s.x, dy = (e ? e.clientY : s.ly) - s.y, v = Math.hypot(s.vx, s.vy); s = null;
      if (!moved) return;
      if (Math.hypot(dx, dy) > FLING_D || v > FLING_V) out(dx, dy); else show(0, 0, 0);
    }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", function (e) { if (s) { s = null; if (moved) show(0, 0, 0); } });
    handle.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopImmediatePropagation(); moved = false; } }, true);
    if (!mouseOnly) handle.style.touchAction = "none";
  }
  window.Dismiss = { pinch: pinch, fling: fling, PINCH_OUT: PINCH_OUT, WHEEL_OUT: WHEEL_OUT, FLING_D: FLING_D, FLING_V: FLING_V };
})();
