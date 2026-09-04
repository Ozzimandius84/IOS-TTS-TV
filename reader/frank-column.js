/* ======================= FRANK — THE COLUMN, as the sidebar ===============
 * The chapter list becomes the design's Column: a barrel of names, turned
 * rather than scrolled, cyclical, with a hard stop at the first chapter and
 * a ribbon of coupled springs driven by how fast it is moving.
 *
 * IT REPLACES THE SIDEBAR'S FACE, NOT ITS JOB. The old list is still mounted
 * and still holds every state the app puts in it -- the render dots, the
 * picks, the groups. It is hidden while Frank is on and shown again the
 * moment he is off, so nothing that reads or writes it has to know this file
 * exists. Opening a chapter goes through pane.openChapter(), which is the
 * same call the old rows make.
 *
 * AND THE TEXT TOWS IT. Reading carries the Column with it, continuously:
 * the chapter's index plus how far through the chapter the reading has got,
 * so the Column sits BETWEEN two names exactly when the reading sits between
 * two chapters. The other direction is deliberately not symmetrical --
 * turning the Column opens nothing until a click. That asymmetry is what
 * lets the whole book be browsed without losing the page being read.
 */
(function () {
  "use strict";
  var mounted = new WeakMap();

  function chaptersOf(book) {
    var cs = (book && (book.chapters || book.units || book.toc)) || [];
    return cs.map(function (c, i) {
      var n = c.number || c.n || "";
      var t = c.title || c.name || c.t || "";
      return { id: c.id != null ? c.id : i, t: t || String(n) || "—", s: t ? String(n) : "" };
    });
  }

  function reading(pane) {
    return (pane.els && pane.els.reading) || null;
  }

  /* WHERE THE READING IS, AS A FRACTION. The app paints one chapter at a
     time, so the whole number is which chapter and the fraction is how far
     down it -- which is the same quantity the design's collection page gets
     from section offsets, arrived at differently because the DOM is
     different. It is the fraction that makes the Column glide rather than
     click over. */
  function fractionFor(pane, items) {
    var r = reading(pane); if (!r || !items.length) return 0;
    var i = items.findIndex(function (it) { return String(it.id) === String(pane.currentChapterId); });
    if (i < 0) i = 0;
    var span = Math.max(1, r.scrollHeight - r.clientHeight);
    var f = span > 1 ? Math.min(1, Math.max(0, r.scrollTop / span)) : 0;
    return i + f;
  }

  function mount(pane) {
    if (!window.Wheel || !pane || !pane.els || !pane.els.sidebarBox) return;
    var box = pane.els.sidebarBox;
    var items = chaptersOf(pane.book);
    if (!items.length) return;

    var old = mounted.get(pane);
    if (old) { old.wheel.destroy(); old.host.remove(); }

    /* INSIDE the container, not beside it: #sidebar carries the panel's own
       width, border and open/closed animation, and the Column should inherit
       every one of them rather than reimplement four of them badly. */
    var host = document.createElement("div");
    host.className = "fkColumn";
    box.appendChild(host);

    var wheel = window.Wheel.mount({
      el: host,
      items: items,
      onOpen: function (i) {
        var it = items[i];
        if (it && pane.openChapter) pane.openChapter(it.id);
      }
    });

    var r = reading(pane);
    var tow = function () { wheel.follow(fractionFor(pane, items)); };
    if (r) r.addEventListener("scroll", tow, { passive: true });
    tow();

    mounted.set(pane, { wheel: wheel, host: host, tow: tow, reading: r, items: items });
  }

  function unmount(pane) {
    var m = mounted.get(pane); if (!m) return;
    if (m.reading) m.reading.removeEventListener("scroll", m.tow);
    m.wheel.destroy(); m.host.remove();
    mounted.delete(pane);
  }

  function sync() {
    /* `Array.isArray`, not a truth test -- reader.html's own frame loop guards
       the same name the same way: `let panes` is in its temporal dead zone
       until the panes are built, and a sync can fire before that. */
    var panes = Array.isArray(window.TTSTVPanes) ? window.TTSTVPanes : [];
    var on = document.documentElement.hasAttribute("data-frank");
    panes.forEach(function (pane) {
      if (on) { if (!mounted.has(pane)) mount(pane); else mounted.get(pane).tow(); }
      else unmount(pane);
    });
  }

  /* The sidebar is mounted after the book arrives and re-mounted whenever it
     changes, and none of that announces itself. Watching is cheaper than
     hooking a function this file does not own, and it cannot go stale. */
  var t = 0;
  function soon() { if (t) return; t = setTimeout(function () { t = 0; sync(); }, 60); }
  /* Watched where there is an observer to watch with, and skipped where there
     is not -- reader/frank.js's note: the test harness's stub DOM has none,
     and a throw on load takes the whole page down with it. */
  if (typeof MutationObserver === "function") {
    new MutationObserver(soon).observe(document.documentElement,
      { subtree: true, childList: true, attributes: true, attributeFilter: ["data-frank"] });
  }
  addEventListener("resize", soon);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", soon);
  else soon();

  window.FrankColumn = { sync: sync, mount: mount, unmount: unmount };
})();
