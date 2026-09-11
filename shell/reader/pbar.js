/* ENGINE · THE PHONE BAR -- the mount, the gestures, the open-books list
   · picture: pbar.css (design/reader/pbar.css is the master)
   · mounted by: reader/reader.html, one <script src>, where the inline mount stood
   · moved here from reader.html's own <script> on 11 Sep (G-CHROME2), byte for
     byte, so that a second page can mount the same bar -- the comment below is
     the one that stood over it there. */
/* ===================== THE PHONE BAR — the mount ==========================
     Osca, 10 September, signed off (PROMPTS/phone-chrome.md, `9a2d649`):
     *"real estate is scarce on the phone. Three elements. Nothing that a
     gesture already does."* ONE small bar at the FOOT, modelled on iOS
     Safari's bottom address bar, and nothing at the top at all:

        ⚙ settings    [ the book / the chapter ]    the mic

     THE PILL IS SAFARI'S ADDRESS BAR, AND IT DOES EVERYTHING:
       tap         -> `SearchSurface.open("")` -- the surface, where search,
                      the voices and the studio all live
       slide  <- -> -> the next / previous OPEN book (open books are tabs)
       drag up     -> the library (`nav.closeToLibrary()`, the one exit) --
                      a PEEK: the book stays open (scrolling out through the
                      contents is the route that closes it; CLOSING A BOOK)
     Every one is a function the page already has, never a second route.

     WHAT WENT, AND IT WENT FROM THE FILE, NOT FROM THE SCREEN (Osca, 10 Sep:
     *"No back button. No library button. No search icon. No pull-down tabs.
     No sun/settings icon in the reader."*): the top bar and its peek, G-PHONE's
     `#pbarback` (step 3) and its grab, tab row and scrim (step 2), the search
     door `#pbarfind`, and the top-right Settings glyph that drew as a sun.
     Kept from G-PHONE: it hides as you read (step 1) and the strip rolls into
     the next voiced chapter (step 4, transport.js).

     THE PICTURE IS shell.css (design/reader/shell.css is the master). This is
     the hand: the markup, the gestures, and the open-books list.

     THE MAC GAINS NOTHING. It returns on the first line unless
     `html[data-phone]` is set, so on a Mac this page's DOM is the same
     document it was before the bar existed -- not a hidden node, no node.
     ======================================================================== */
(function () {
  var R = document.documentElement;
  if (!R.hasAttribute("data-phone")) return;          /* the Mac: no node at all */

  /* ===================== TWO PAGES, ONE BAR (11 Sep, G-CHROME2) =============
     Osca's round two: *"The Library on the phone uses THIS bar, not its own
     ≡/⚙/☾."* So the bar is mounted by two pages and is told which one by its
     own <script> tag (`data-page="library"` in library.html). Without the
     attribute it asks the page: a page with the reader's running head is the
     reader. ON THE LIBRARY the bar is the same three elements and says so --
     the ⚙, a pill reading "Library" whose tap is the same surface, the mic's
     slot -- and three things differ, each because there is no book:
       the pill says "Library", and nothing beneath it;
       a DRAG UP DOES NOTHING (the library is where it would go), and it
         does not even rise under the finger;
       it never hides -- there is no reading to get out of the way of.
     A slide already does nothing there: the Library is not an open book, so
     it has no neighbour and the pill gives its quarter and comes back. */
  var CS = document.currentScript;
  var PAGE = (CS && CS.getAttribute && CS.getAttribute("data-page"))
          || (document.getElementById("readerhead") ? "reader" : "library");
  var LIB = PAGE === "library";
  R.setAttribute("data-pbar", PAGE);                  /* for the one rule each page's sheet keys on it */

  var ink = function (d, w) {
    return '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor"'
         + ' stroke-width="' + (w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round">'
         + d + '</svg>';
  };
  var bar = document.createElement("div");
  bar.className = "pbar"; bar.id = "pbar";
  bar.setAttribute("data-shown", "on");
  bar.setAttribute("data-page", PAGE);
  /* LEFT, the one way to Settings on the phone. A DOOR, so a link: a place
     you go is a navigation on the phone (the Library's `#settingsDoor` is the
     same shape). A toothed wheel with a hole -- never rays around a disc,
     which is what the old glyph was and why it read as a sun. */
  bar.innerHTML =
      '<a class="pbar-b pbar-set" id="pbarset" href="../settings/settings.html"'
    + ' aria-label="Settings" title="Settings">'
    +   ink('<path d="M15.93 8.58L17.83 8.95L17.83 11.05L15.93 11.42L15.20 13.19L16.28 14.79'
    +       'L14.79 16.28L13.19 15.20L11.42 15.93L11.05 17.83L8.95 17.83L8.58 15.93L6.81 15.20'
    +       'L5.21 16.28L3.72 14.79L4.80 13.19L4.07 11.42L2.17 11.05L2.17 8.95L4.07 8.58L4.80 6.81'
    +       'L3.72 5.21L5.21 3.72L6.81 4.80L8.58 4.07L8.95 2.17L11.05 2.17L11.42 4.07L13.19 4.80'
    +       'L14.79 3.72L16.28 5.21L15.20 6.81Z"/><circle cx="10" cy="10" r="2.6"/>', 1.4)
    /* THE DOT (Osca, 11 Sep, D5): *"a DOT on the settings icon while
       syncing (no line under the pill)"*. Always in the document, drawn only
       while `.pbar[data-sync="on"]` (pbar.css) -- see THE DOT below. */
    +   '<span class="pbar-dot" id="pbardot" aria-hidden="true"></span>'
    + '</a>'
    /* MIDDLE, the pill: the book, and the chapter beneath it. A BUTTON --
       its tap opens a surface OVER the page, which is not a navigation. */
    + '<button type="button" class="pbar-pill" id="pbarpill" aria-label="Search"'
    + ' title="Search"><b></b><span></span></button>'
    /* RIGHT, the mic: voiceui's own element, moved in (below). */
    + '<span class="pbar-mic" id="pbarmic"></span>';
  var peek = document.createElement("div");
  peek.className = "pbar-peek"; peek.id = "pbarpeek";
  document.body.appendChild(bar);
  document.body.appendChild(peek);           /* the peek is the bar's next sibling */
  var pill = document.getElementById("pbarpill");
  var pb = pill.querySelector("b"), ps = pill.querySelector("span");

  /* ====================== THE OPEN BOOKS -- the phone's tabs ===============
     *"Open books: an ordered list kept across launches; opening from the
     library adds/moves a book to the front; the title-pill slide walks it.
     Frontend state only -- no Rust."* One localStorage key, front first,
     `[{slug, title}]`. The library reads the same key for its first band.

     A SLIDE WALKS IT AND DOES NOT REORDER IT. Safari's tabs keep their order
     when you swipe between them; so the book a slide goes to is written in
     sessionStorage just before the page goes, and the open that finds its own
     slug there leaves the list alone. Every other open -- the library, the
     surface, a link -- puts the book at the front. */
  var OPEN_KEY = "ttstv.openBooks", SLID_KEY = "ttstv.openBooks.slid";
  var current = null;
  function readOpen() {
    var v = null;
    try { v = JSON.parse(localStorage.getItem(OPEN_KEY) || "[]"); } catch (_) { v = null; }
    if (!Array.isArray(v)) return [];
    return v.filter(function (e) { return e && typeof e.slug === "string" && e.slug; });
  }
  function writeOpen(list) {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(list)); } catch (_) { /* private mode */ }
  }
  function at(list, slug) {
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return i;
    return -1;
  }
  function noteOpen(slug) {
    if (!slug) return;
    current = slug;
    var slid = null;
    try { slid = sessionStorage.getItem(SLID_KEY); sessionStorage.removeItem(SLID_KEY); } catch (_) {}
    var list = readOpen(), i = at(list, slug);
    if (slid === slug && i >= 0) return;               /* a slide: the order stands */
    var e = i >= 0 ? list.splice(i, 1)[0] : { slug: slug, title: "" };
    list.unshift(e);
    writeOpen(list);
  }
  function noteTitle(t) {
    if (!current || !t) return;
    var list = readOpen(), i = at(list, current);
    if (i < 0 || list[i].title === t) return;
    list[i].title = t;
    writeOpen(list);
  }
  /* +1 is the next book along (the one a finger sliding LEFT brings in, as
     Safari's next tab), -1 the one before it. */
  function neighbour(step) {
    var list = readOpen(), i = at(list, current);
    return i < 0 ? null : (list[i + step] || null);
  }
  function switchTo(e) {
    if (!e || !e.slug) return false;
    try { sessionStorage.setItem(SLID_KEY, e.slug); } catch (_) {}
    /* the grammar library.html's `readerUrl` builds, and a REPLACE: moving
       between tabs is not a trail to walk back along */
    location.replace("?" + new URLSearchParams({ book: "books/" + e.slug }));
    return true;
  }

  /* ===================== CLOSING A BOOK (Osca, 10 Sep, added) ==============
     PROMPTS/phone-chrome.md, "Closing an open book" (`d4ba26e`): *"Scrolling
     OUT through the contents pane (the reading route: contents -> panes ->
     past the deepest -> library) closes the book -- it leaves the open-books
     list. Drag-up from the bar is the peek route: it shows the library and
     leaves the book open."* The library's ✕ is the third way, and it is the
     library's own.

     BOTH ROUTES END IN THE ONE `closeToLibrary()`, so what tells them apart is
     WHO ASKED -- and only the bar knows when it was the bar: `goLibrary()`
     below marks `peeking` before it asks. The LEAVING is heard where
     book-nav.js says it happens, `#book` losing `open` -- written by
     `showScreen("dashboard")`, which only `leaveNow()` calls, at the moment
     the leaving travel lands and before the page goes. A leaving that is not
     the bar's peek closes the book. book-nav.js is not touched: the push past
     the deepest pane, its second ArrowLeft and Escape are all its own
     `closeToLibrary()`, and all three are the reading route out.

     THE BOOK CLOSED IS THE ONE BEING READ -- `OPEN_BOOK`, the book nav
     actually opened (declared further down this file), and the slug this page
     noted on load only when there is none. A book not on the list closes
     nothing, and the list is written only when it changed. */
  var peeking = false;
  function closeOpen(slug) {
    if (!slug) return false;
    var list = readOpen(), i = at(list, slug);
    if (i < 0) return false;
    list.splice(i, 1);
    writeOpen(list);
    return true;
  }
  function readingSlug() {
    var b = null;
    try { b = OPEN_BOOK; } catch (_) { b = null; }     /* a top-level `let`, further down */
    return (b && b.slug) || current;
  }
  var bookEl = document.getElementById("book");
  var bookWasOpen = !!(bookEl && bookEl.classList.contains("open"));
  var closedLast = null;                              /* what the last leaving closed, for a driver */
  function leaveWatch() {
    var open = !!(bookEl && bookEl.classList.contains("open"));
    if (bookWasOpen && !open) {
      var slug = readingSlug();
      closedLast = peeking ? { slug: slug, closed: false, route: "peek" }
                           : { slug: slug, closed: closeOpen(slug), route: "read" };
    }
    bookWasOpen = open;
  }
  if (bookEl) new MutationObserver(leaveWatch).observe(bookEl, { attributes: true, attributeFilter: ["class"] });
  /* the slug is `slugFromUrl()`'s, a function the page declares further down
     -- asked once the document is parsed, by which point it exists */
  addEventListener("DOMContentLoaded", function () {
    try { noteOpen(typeof slugFromUrl === "function" ? slugFromUrl() : null); } catch (_) {}
    title();
  });

  /* ------------------------------------------------ the pill's two lines, once
     page.js keeps `.runhead` current (<b>the book</b><span>the chapter</span>),
     so the pill mirrors that one element; `.runhead` itself does not paint on
     the phone. Before the first paint it says the title the open list knows. */
  var src = document.getElementById("readerhead");
  function title() {
    var b = src && src.querySelector("b"), s = src && src.querySelector("span");
    var sq = function (x) { return x ? x.textContent.replace(/\s+/g, " ").trim() : ""; };
    var t1 = sq(b), t2 = sq(s);
    if (LIB) { t1 = "Library"; t2 = ""; }              /* no book: the pill names the page */
    else if (t1) noteTitle(t1);
    else { var list = readOpen(), i = at(list, current); if (i >= 0) t1 = list[i].title || ""; }
    if (pill.getAttribute("data-to")) return;          /* a slide is naming the next book */
    if (pb.textContent !== t1) pb.textContent = t1;
    if (ps.textContent !== t2) ps.textContent = t2;
    var label = t1 ? "Search — " + t1 : "Search";
    if (pill.getAttribute("aria-label") !== label) pill.setAttribute("aria-label", label);
  }
  if (src) new MutationObserver(title).observe(src, { childList: true, subtree: true, characterData: true });
  title();

  /* ------------------------------------------------------------- the mic */
  var slot = document.getElementById("pbarmic");
  function mic() {
    var m = document.querySelector(".voiceui-pill");
    if (!m) return;
    var want = (getComputedStyle(R).getPropertyValue("--pbar-mic") || "bar").trim();
    var home = (want === "float") ? document.body : slot;
    if (m.parentNode !== home) home.appendChild(m);
  }
  new MutationObserver(mic).observe(document.body, { childList: true });

  /* ===================== AWAY AS YOU READ (G-PHONE step 1, kept) ============
     A scroll is READING when a hand is on the page (a touch, a wheel, a key in
     the last 1.5 s) or the voice is playing and the page is following it.
     Anything else -- the page placing itself -- leaves the bar where it is.
     MEASURED at G-PHONE: scrub.js writes `.sb-live` on the pane every frame of
     a scroll and the column's class is rewritten every frame the voice plays
     (371 records in 2.7 s), so the zoom watch below acts on the zoom FLIPPING
     and never per record. A bar the READER asked for (the bottom-edge tap, a
     hand scrolling up) stays through the voice's own paragraph scrolls and
     goes on the next scroll down by hand. HIDDEN WHILE ZOOMED is a forced
     hide: the page is the control, and nothing brings the bar back over it. */
  var pane = document.getElementById("readerpane");
  var last = pane ? (pane.scrollTop || 0) : 0, tick = false;
  function autohide() {
    if (LIB) return false;                             /* the Library: nothing to read past */
    var v = (getComputedStyle(R).getPropertyValue("--pbar-autohide") || "1").trim();
    return v !== "0" && v !== "off" && v !== "false";
  }
  function zoomed() { return !!document.querySelector(".pane.zoomed, .column.zoomed"); }
  function put(v) {
    if (bar.getAttribute("data-shown") === v) return;
    bar.setAttribute("data-shown", v);
    if (v === "on") dotStart(); else dotStop();       /* THE DOT is asked only while it can be seen */
  }
  function show() { put(zoomed() ? "off" : "on"); }
  function hide() { if (autohide() || zoomed()) put("off"); }

  var touched = 0;
  function chrome(t) {
    return !!(t && t.closest && t.closest("#pbar, #pbarpeek, #pplay"));
  }
  ["touchstart", "wheel", "keydown"].forEach(function (type) {
    addEventListener(type, function (e) { if (!chrome(e.target)) touched = Date.now(); },
                     { passive: true, capture: true });
  });
  function hand() { return Date.now() - touched < 1500; }
  function reading() {
    if (hand()) return true;
    var T = window.Transport;
    return !!(T && T.playing && T.playing());
  }
  var asked = false;
  function moved(top) {
    var d = top - last;
    if (Math.abs(d) < 5) return;
    last = top;
    if (!autohide()) { show(); return; }
    if (top <= bar.offsetHeight) { show(); return; }
    if (!reading()) return;                /* the page placed itself */
    if (d < 0) { if (hand()) asked = true; show(); return; }
    if (asked && !hand()) return;          /* the voice moved on; the reader asked for the bar */
    asked = false;
    hide();
  }
  function onScroll(el) {
    if (tick) return; tick = true;
    requestAnimationFrame(function () { tick = false; moved(el.scrollTop || 0); });
  }
  if (pane) pane.addEventListener("scroll", function () { onScroll(pane); }, { passive: true });
  addEventListener("scroll", function () {
    if (pane && pane.scrollHeight > pane.clientHeight + 4) return;   /* the pane is the scroller */
    onScroll(document.scrollingElement || document.documentElement);
  }, { passive: true });

  /* THE BOTTOM-EDGE TAP IS THE BAR'S, ALL OF IT. The peek takes the pointer
     only while the bar is away (shell.css); `pointerdown` brings the bar back
     at once, and the bar rising under the finger takes the pointer away from
     the peek -- so the `click` that ends the same tap would land on whatever
     the bar put there, the pill included, and open the surface. That one
     click is swallowed, once, within half a second, wherever it lands. */
  var eatUntil = 0;
  peek.addEventListener("pointerdown", function () { asked = true; show(); eatUntil = Date.now() + 500; });
  peek.addEventListener("click", show);
  addEventListener("click", function (e) {
    if (Date.now() >= eatUntil) return;
    eatUntil = 0; e.preventDefault(); e.stopPropagation();
  }, true);

  /* ============================== THE PILL'S THREE GESTURES ================
     ONE POINTER, and the first 8px decide what it is:
       it never moves      -> a TAP, and the click that follows opens the surface
       it goes sideways    -> a SLIDE (begun on the pill): the pill follows the
                              finger; past SLIDE_AT, or flicked, the neighbour
                              book is named in it and the release goes there. No
                              neighbour that way -> it gives a quarter and comes back.
       it goes up          -> a LIFT: the bar rises with the finger; past UP_AT,
                              or flicked, the release goes to the library.
     THE LIFT IS GENEROUS ON PURPOSE (Osca: *"the drag-out to the library is
     unreliable"*). MEASURED at HEAD with real touch: G-PHONE's route was a
     pull DOWN that had to be released ON a 127x52 entry, and 0 of 8 pulls
     reached the library. So: it starts ANYWHERE on the bar (the pill, the
     ⚙, the mic -- 402 px of reach, not one target), "up" is anything more up
     than sideways, it is judged on how far the finger IS, not where it lets
     go, and 28px of it -- or a flick -- is enough. */
  var SLOP = 8, UP_AT = 28, SLIDE_AT = 56, FLICK = 0.3;    /* px, px, px, px/ms */
  var g = null, eatDrag = 0, lastG = null;           /* lastG: what the last gesture was, for a driver */
  /* the event's own clock where it has one: a flick is judged on when the
     finger moved, not on when the page got round to hearing about it */
  function when(e) { return (e && e.timeStamp > 0) ? e.timeStamp : Date.now(); }
  function speedOf(h, axis) {                        /* px/ms over the last ~100 ms */
    var n = h.length; if (n < 2) return 0;
    var a = h[n - 1], b = h[0];
    for (var i = n - 1; i >= 0; i--) { b = h[i]; if (a.t - h[i].t >= 100) break; }
    var dt = a.t - b.t; if (dt <= 0) return 0;
    return (axis === "x" ? a.x - b.x : a.y - b.y) / dt;
  }
  function settle() {
    bar.removeAttribute("data-drag"); bar.removeAttribute("data-armed");
    bar.style.removeProperty("--pbar-lift");
    pill.style.removeProperty("--pbar-slide");
    if (pill.getAttribute("data-to")) { pill.removeAttribute("data-to"); title(); }
  }
  function nameNext(e) {                             /* the pill says where a release goes */
    var t = e ? (e.title || e.slug) : "";
    if ((pill.getAttribute("data-to") || "") === t) return;
    if (t) { pill.setAttribute("data-to", t); pb.textContent = t; ps.textContent = ""; }
    else { pill.removeAttribute("data-to"); title(); }
  }
  function goLibrary() {
    /* the page's own `nav` (a top-level const further down this file),
       asked at the moment of the gesture and inside a try: a mount that threw
       leaves the name uninitialised and even `typeof` of it throws */
    /* THE PEEK: the library, and the book stays open (CLOSING A BOOK, above) */
    peeking = true;
    try { if (nav && nav.closeToLibrary) { nav.closeToLibrary(); return true; } } catch (_) {}
    peeking = false;
    return false;
  }
  bar.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || g) return;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, axis: null,
          pill: !!(e.target && e.target.closest && e.target.closest("#pbarpill")),
          nb: null, h: [{ t: when(e), x: e.clientX, y: e.clientY }] };
  });
  bar.addEventListener("pointermove", function (e) {
    if (!g || e.pointerId !== g.id) return;
    g.dx = e.clientX - g.x0; g.dy = e.clientY - g.y0;
    g.h.push({ t: when(e), x: e.clientX, y: e.clientY });
    if (g.h.length > 12) g.h.shift();
    var ax = Math.abs(g.dx), ay = Math.abs(g.dy);
    if (!g.axis) {
      if (Math.max(ax, ay) < SLOP) return;
      if (g.dy < 0 && ay >= ax) g.axis = LIB ? "still" : "up";   /* the Library: up goes nowhere */
      else if (g.pill && ax > ay) g.axis = "x";
      else g.axis = "none";
      if (g.axis === "none") return;
      /* a mouse keeps its drag by capture; a finger is captured already */
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
      bar.setAttribute("data-drag", g.axis);
    }
    if (g.axis === "up") {
      var lift = Math.max(0, Math.min(-g.dy, 96));
      bar.style.setProperty("--pbar-lift", Math.round(lift * 0.5) + "px");
      if (-g.dy >= UP_AT) bar.setAttribute("data-armed", ""); else bar.removeAttribute("data-armed");
    } else if (g.axis === "x") {
      g.nb = neighbour(g.dx < 0 ? 1 : -1);
      var off = g.nb ? g.dx : g.dx / 4;
      pill.style.setProperty("--pbar-slide", Math.round(off) + "px");
      var armed = !!g.nb && ax >= SLIDE_AT;
      if (armed) bar.setAttribute("data-armed", ""); else bar.removeAttribute("data-armed");
      nameNext(armed ? g.nb : null);
    }
  });
  function release(e, cancelled) {
    if (!g || (e && e.pointerId !== g.id)) return;
    var p = g; g = null;
    lastG = { axis: p.axis || "tap", dx: Math.round(p.dx), dy: Math.round(p.dy),
              vx: +speedOf(p.h, "x").toFixed(3), vy: +speedOf(p.h, "y").toFixed(3), went: null };
    if (!p.axis || p.axis === "none") { settle(); return; }   /* a tap: the click decides */
    if (p.axis === "still") { eatDrag = Date.now() + 400; settle(); return; }   /* the Library's up: nothing, not even a tap */
    eatDrag = Date.now() + 400;             /* the drag's own trailing click is not a tap */
    if (cancelled) { settle(); return; }
    if (p.axis === "up") {
      var vy = speedOf(p.h, "y");
      if (-p.dy >= UP_AT || (vy <= -FLICK && -p.dy >= SLOP * 2)) {
        settle(); lastG.went = "library"; goLibrary(); return;
      }
    } else {
      var vx = speedOf(p.h, "x");
      var nb = neighbour(p.dx < 0 ? 1 : -1);
      var flick = Math.abs(vx) >= FLICK && Math.abs(p.dx) >= SLOP * 3 && (vx < 0) === (p.dx < 0);
      if (nb && (Math.abs(p.dx) >= SLIDE_AT || flick)) {
        nameNext(nb);
        pill.style.setProperty("--pbar-slide", (p.dx < 0 ? "-" : "") + "100vw");
        bar.removeAttribute("data-drag");      /* it eases the rest of the way out */
        lastG.went = nb.slug;
        switchTo(nb);
        return;
      }
    }
    settle();
  }
  /* THE BAR'S TOUCHES ARE THE BAR'S. book-nav.js hears every one-finger
     touch on the WINDOW and takes a sideways one as the axis -- the contents
     panes coming out -- and then stops that touch's `pointerup` in the
     capture phase (THE SWIPE IS THE WHEEL). MEASURED: a slide on the pill got
     `lostpointercapture` and `touchend` and never a `pointerup`, so no slide
     could ever land. The bar is not the page: its touches stop here, before
     the window, and book-nav.js never arms on them. */
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(function (t) {
    bar.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
  });
  bar.addEventListener("pointerup", function (e) { release(e, false); });
  bar.addEventListener("pointercancel", function (e) { release(e, true); });
  pill.addEventListener("click", function (e) {
    /* a drag's trailing click, or the bottom-edge tap's (see the peek) */
    if (Date.now() < eatDrag || Date.now() < eatUntil) { e.preventDefault(); return; }
    show();
    if (window.SearchSurface) window.SearchSurface.open("");
  });
  /* the ⚙ and the mic are the bar's too: a lift begun on them is a lift, and
     its trailing click must not also be a press */
  bar.addEventListener("click", function (e) {
    if (Date.now() < eatDrag) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* the bench writes its dials as inline properties on <html>; re-read them */
  new MutationObserver(function () { mic(); if (!autohide()) show(); })
    .observe(R, { attributes: true, attributeFilter: ["style"] });

  /* the zoom going in or out is not a scroll, so it has its own watch, and it
     acts ONLY when the zoom flips (see AWAY AS YOU READ, above) */
  var wasZoomed = zoomed();
  function zoomWatch() {
    var z = zoomed();
    if (z === wasZoomed) return;
    wasZoomed = z;
    if (z) put("off"); else show();
  }
  [document.querySelector(".pane"), document.querySelector(".column")]
    .forEach(function (el) {
      if (el) new MutationObserver(zoomWatch)
        .observe(el, { attributes: true, attributeFilter: ["class"] });
    });

  /* =========================== THE DOT -- a sync is running ================
     Osca, 11 Sep (D5): *"a DOT on the settings icon while syncing (no line
     under the pill)"*. The phone's pull is the host's (G-SYNCBG: Rust owns the
     bulk, so it runs while the reader is used), and the host says whether it
     is running: `TTSTVHost.sync.status()` -> `{running, transport, book, i, n,
     file, done, total, pulled, why, since}` -- a value or a promise of one,
     both are taken. `running` is the only field read here: the dot is on
     while it is true and gone the moment it is not; what ran and why is the
     Settings row's to say.
     ASKED EVERY 2 s WHILE THE BAR CAN BE SEEN, AND NOT ASKED OTHERWISE: the
     first ask is the moment the bar comes back (so a returning bar is right at
     once), the timer stops when the bar goes away or the page is hidden, and a
     page whose host has no `sync.status` -- the Mac, a browser, a phone build
     before G-SYNCBG -- never starts one at all. */
  var dot = document.getElementById("pbardot");
  var DOT_MS = 2000, dotTimer = 0, dotSeen = null, dotAsks = 0;
  function hostSync() {
    try {
      var h = window.TTSTVHost, s = h && h.sync;
      return (s && typeof s.status === "function") ? s : null;
    } catch (_) { return null; }
  }
  function paintDot(st) {
    dotSeen = st || null;
    var on = !!(st && st.running);
    if ((bar.getAttribute("data-sync") === "on") === on) return;
    if (on) bar.setAttribute("data-sync", "on"); else bar.removeAttribute("data-sync");
    document.getElementById("pbarset").setAttribute("aria-label", on ? "Settings — syncing" : "Settings");
  }
  function askDot() {
    var s = hostSync();
    if (!s) { dotStop(); paintDot(null); return; }
    dotAsks++;
    var v = null;
    try { v = s.status(); } catch (_) { v = null; }
    if (v && typeof v.then === "function") v.then(paintDot, function () { paintDot(null); });
    else paintDot(v);
  }
  function watching() {
    return bar.getAttribute("data-shown") !== "off" && document.visibilityState !== "hidden";
  }
  function dotStart() {
    if (dotTimer || !hostSync() || !watching()) return;
    askDot();
    dotTimer = setInterval(function () { if (watching()) askDot(); else dotStop(); }, DOT_MS || 2000);
  }
  function dotStop() { if (dotTimer) { clearInterval(dotTimer); dotTimer = 0; } }
  document.addEventListener("visibilitychange", function () { if (watching()) dotStart(); else dotStop(); });

  window.PhoneBar = { el: bar, peek: peek, pill: pill, show: show, hide: hide, page: PAGE,
                      dot: { el: dot, MS: DOT_MS, ask: askDot, start: dotStart, stop: dotStop,
                             get polling() { return !!dotTimer; },
                             get asks() { return dotAsks; },
                             get seen() { return dotSeen; },
                             get on() { return bar.getAttribute("data-sync") === "on"; } },
                      sync: function () { title(); mic(); if (!autohide()) show(); },
                      autohide: autohide, zoomed: zoomed, reading: reading,
                      zoomWatch: zoomWatch,
                      open: { key: OPEN_KEY, list: readOpen, note: noteOpen,
                              neighbour: neighbour, go: switchTo, close: closeOpen,
                              leaveWatch: leaveWatch,
                              get current() { return current; },
                              get peeking() { return peeking; },
                              get closed() { return closedLast; } },
                      dials: { SLOP: SLOP, UP_AT: UP_AT, SLIDE_AT: SLIDE_AT, FLICK: FLICK },
                      get last() { return lastG; } };
  mic();
  dotStart();
})();
