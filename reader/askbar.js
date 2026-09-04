/* THE BAR'S OTHER HALF — the answers.
 *
 * The bar itself is the shell's: a field in the title-bar strip
 * (`desktop/src/tabs.html`), which reports what was typed and owns no answers
 * (PROMPTS/module-split.md: *"the shell owns the bar and owns no answers ...
 * The bar is a MOUNT POINT ... search to whatever owns searching"*). This file
 * is what owns the searching, and it lives in the page because everything that
 * can answer already does:
 *
 *   YOURS         `/state`'s shelf rows -- title, author, language, counts.
 *                 8 KB since the shelf/detail split, so a keystroke can have
 *                 them and no request has to be made to answer one.
 *   IN THIS BOOK  `window.TTSTVFind` -- the find bar the reader already has.
 *                 NOT a second find: the row hands the query to it and the
 *                 real bar opens at the first match, with its own next,
 *                 previous and whole-book. PROMPTS/search.md keeps the two
 *                 names apart and this keeps the two BARS apart with them.
 *   ELSEWHERE     `/search` -- Gutenberg, archive.org, LibriVox -- the same
 *                 route `reader/library.html`'s own search bar calls. Only on
 *                 ⏎: it leaves this Mac, and no keystroke should.
 *
 * Nothing here parses, stages or ingests. Choosing something from elsewhere
 * hands it to the Library, which has the whole of that already
 * (`parseSearchResult`), so there is one path onto the shelf and not two.
 *
 * AND IT DRAWS THE LIST. Not the strip: that webview is 46px tall and would
 * clip it -- and a list drawn by the page is the same list the browser and the
 * phone get, where there is no strip at all and the field is the page's own.
 */
(function () {
  "use strict";

  /* the one-shot handoff to the Library, when a result was chosen in another
     tab. Same origin, so localStorage is the whole mechanism; read once and
     cleared, so a stale pick can never act twice. */
  var HANDOFF = "ttstv.ask.handoff";
  var SHELF_MS = 4000;          // how long a shelf answer is reused for

  var box = null, listEl = null;
  var rows = [], sel = -1, q = "", open = false;
  var shelf = null, shelfAt = 0, shelfWait = null;
  var at = null;                 // where the field is, as the strip measured it

  function api(path) {
    return /^https?:$/.test(location.protocol) ? location.origin + path : null;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* Matching is diacritic-blind on purpose: this library is half in French,
     Latin and Greek, and a person typing "eclogues" means Éclogues too. */
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s;
  }

  // ------------------------------------------------------------- the shelf
  function shelfNow() {
    if (shelf && Date.now() - shelfAt < SHELF_MS) return Promise.resolve(shelf);
    if (shelfWait) return shelfWait;
    var url = api("/state");
    if (!url) return Promise.resolve(shelf || []);
    shelfWait = fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        shelf = (d && d.books) || [];
        shelfAt = Date.now();
        shelfWait = null;
        return shelf;
      })
      .catch(function () { shelfWait = null; return shelf || []; });
    return shelfWait;
  }

  function yours(text) {
    var n = norm(text);
    if (!n) return [];
    return (shelf || []).filter(function (b) {
      return norm(b.title).indexOf(n) >= 0
          || norm(b.author).indexOf(n) >= 0
          || norm(b.slug).indexOf(n) >= 0;
    }).slice(0, 6).map(function (b) {
      return { kind: "book", slug: b.slug, title: b.title, author: b.author,
               lang: b.lang, n: b.chapters_n, voiced: b.voiced };
    });
  }

  // ------------------------------------------------------- what is on offer
  function build(cands) {
    var out = yours(q);
    if (window.TTSTVFind && typeof window.TTSTVFind.search === "function" && q) {
      out.push({ kind: "find" });
    }
    if (cands && cands.length) {
      for (var i = 0; i < cands.length && i < 6; i++) {
        out.push({ kind: "web", c: cands[i] });
      }
    } else if (q) {
      out.push({ kind: "more", state: cands === null ? "searching" : "idle" });
    }
    return out;
  }

  // ------------------------------------------------------------ the drawing
  function mount() {
    if (box) return box;
    box = document.createElement("div");
    box.className = "askList";
    box.hidden = true;
    listEl = document.createElement("div");
    listEl.className = "askRows";
    box.appendChild(listEl);
    (document.body || document.documentElement).appendChild(box);
    listEl.addEventListener("mousedown", function (e) {
      /* mousedown, not click: the field is in another webview and clicking
         here blurs it, which would close the list before a click landed. */
      var el = e.target.closest ? e.target.closest(".askRow") : null;
      if (!el) return;
      e.preventDefault();
      take(rows[Number(el.dataset.i)]);
    });
    return box;
  }

  function place() {
    if (!box) return;
    /* Under the field, as the strip measured it. In a browser there is no
       strip, so the page's own header is the top and the list is centred. */
    var top = 0;
    var h = document.querySelector("header");
    if (h && !h.hidden && h.getBoundingClientRect) {
      var r = h.getBoundingClientRect();
      if (r.height) top = r.bottom;
    }
    box.style.top = Math.round(top + 6) + "px";
    if (at && at.width) {
      var w = Math.max(320, Math.min(560, at.width + 140));
      var left = Math.round(at.left + at.width / 2 - w / 2);
      left = Math.max(8, Math.min(innerWidth - w - 8, left));
      box.style.left = left + "px";
      box.style.width = w + "px";
    } else {
      box.style.left = "50%";
      box.style.width = "min(560px, 92vw)";
      box.style.transform = "translateX(-50%)";
    }
  }

  function label(r, i) {
    var on = i === sel ? " on" : "";
    if (r.kind === "book") {
      var meta = [r.author || "unknown author", r.lang, r.n ? r.n + " ch" : null]
        .filter(Boolean).map(esc).join(" · ");
      return '<div class="askRow' + on + '" data-i="' + i + '">'
        + '<span class="t">' + esc(r.title) + "</span>"
        + '<span class="m">' + meta + (r.voiced ? ' · <b>' + r.voiced + " voiced</b>" : "")
        + "</span></div>";
    }
    if (r.kind === "find") {
      return '<div class="askRow' + on + '" data-i="' + i + '">'
        + '<span class="t">Find “' + esc(q) + "” in this book</span>"
        + '<span class="m">opens the find bar</span></div>';
    }
    if (r.kind === "more") {
      return '<div class="askRow' + on + '" data-i="' + i + '">'
        + '<span class="t">Search everywhere for “' + esc(q) + "”</span>"
        + '<span class="m">' + (r.state === "searching" ? "searching…"
            : "Gutenberg, archive.org, LibriVox · ⏎") + "</span></div>";
    }
    var c = r.c;
    return '<div class="askRow' + on + '" data-i="' + i + '">'
      + '<span class="t">' + esc(c.title) + "</span>"
      + '<span class="m">' + esc(c.source) + " · " + esc(c.kind)
      + (c.author ? " · " + esc(c.author) : "")
      + (c.license_status ? " · " + esc(c.license_status) : "") + "</span></div>";
  }

  /* One heading per group, drawn only where the group starts -- so a list
     with nothing of yours in it says nothing about yours. */
  var HEAD = { book: "Yours", find: "In this book", web: "Elsewhere", more: "Elsewhere" };

  function paint() {
    mount();
    if (!open || !rows.length) { box.hidden = true; return; }
    var html = "", last = null;
    for (var i = 0; i < rows.length; i++) {
      var g = HEAD[rows[i].kind];
      if (g !== last) { html += '<div class="askHead">' + g + "</div>"; last = g; }
      html += label(rows[i], i);
    }
    listEl.innerHTML = html;
    box.hidden = false;
    place();
    var on = listEl.querySelector(".askRow.on");
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  }

  function shut() { open = false; sel = -1; if (box) box.hidden = true; }

  // ------------------------------------------------------------- the search
  var token = 0;
  function everywhere() {
    var url = api("/search?" + new URLSearchParams({ title: q }).toString());
    if (!url) return;
    var mine = ++token;
    rows = build(null); paint();                 // "searching…" in the row itself
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (mine !== token) return;                // an older search never wins
      rows = build((d && d.candidates) || []);
      sel = -1; paint();
    }).catch(function () {
      if (mine !== token) return;
      rows = build([]); paint();
    });
  }

  // -------------------------------------------------------------- the doing
  function take(r) {
    if (!r) return;
    if (r.kind === "book") {
      shut();
      if (window.TTSTVHost && window.TTSTVHost.openReader) window.TTSTVHost.openReader(r.slug);
      else location.href = "reader.html?book=books/" + encodeURIComponent(r.slug);
      return;
    }
    if (r.kind === "find") {
      shut();
      try { window.TTSTVFind.search(q); } catch (e) { /* no book open */ }
      return;
    }
    if (r.kind === "more") { everywhere(); return; }
    /* ELSEWHERE, CHOSEN. The Library owns staging and parsing -- one path onto
       the shelf, not two -- so the pick is handed to it. On the Library page
       that is a direct call; anywhere else it is written down and the Library
       is opened, which reads it once and acts. */
    shut();
    var pick = { title: q, source: r.c.source, ctitle: r.c.title, at: Date.now() };
    if (window.TTSTVLibrary && typeof window.TTSTVLibrary.take === "function") {
      window.TTSTVLibrary.take(pick);
      return;
    }
    try { localStorage.setItem(HANDOFF, JSON.stringify(pick)); } catch (e) { /* private */ }
    if (window.TTSTVHost && window.TTSTVHost.openLibrary) window.TTSTVHost.openLibrary();
    else location.href = "library.html";
  }

  // ---------------------------------------------------------- what the bar did
  function ask(verb, query) {
    if (verb === "at") {
      try { at = JSON.parse(query); } catch (e) { at = null; }
      place();
      return;
    }
    if (verb === "blur") { shut(); return; }
    if (verb === "escape") { shut(); return; }
    if (verb === "focus") { open = true; q = String(query || ""); }
    if (verb === "type") {
      q = String(query || "");
      open = true;
      token++;                                   // a keystroke ends any search in flight
      if (!q) { rows = []; paint(); return; }
      shelfNow().then(function () { rows = build([]); sel = -1; paint(); });
      return;
    }
    if (verb === "down" || verb === "up") {
      if (!rows.length) return;
      sel += (verb === "down" ? 1 : -1);
      if (sel < 0) sel = rows.length - 1;
      if (sel >= rows.length) sel = 0;
      paint();
      return;
    }
    if (verb === "enter") {
      if (sel >= 0 && rows[sel]) { take(rows[sel]); return; }
      /* Nothing picked: ⏎ means "and everywhere else", which is the one thing
         typing never does on its own. With results already in, it opens the
         first of them. */
      var web = rows.filter(function (r) { return r.kind === "web"; });
      if (web.length) take(web[0]);
      else if (rows.length && rows[0].kind !== "more") take(rows[0]);
      else everywhere();
      return;
    }
    paint();
  }

  /* THE PAGE'S ONE DOOR. `TTSTVPage` is the object the strip evaluates into
     (`tab_tool` -> .tool, `tab_ask` -> .ask), and the pages define `.tool`
     themselves -- so this MERGES rather than assigns, and the order the two
     are written in stops mattering. */
  window.TTSTVAsk = { ask: ask, close: shut };
  window.TTSTVPage = Object.assign(window.TTSTVPage || {}, { ask: ask });

  addEventListener("resize", place);
})();
