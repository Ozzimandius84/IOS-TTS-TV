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
 *                 route `library/library.html`'s own search bar calls. Only on
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
  var notes = "";                // adapterNote's own html, drawn at the foot
  var choosing = null;           // {pick, files} while an item's files are the list
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
    /* CHOOSING A FILE IS STILL CHOOSING, so it happens in this list rather
       than in a picker somewhere else -- an archive.org item that ships nine
       files asks the same question a search does, one row each. Nothing else
       is offered while it is up: the question on the table is which file. */
    if (choosing) {
      return choosing.files.map(function (f) {
        return { kind: "file", f: f };
      });
    }
    var out = yours(q);
    if (window.TTSTVFind && typeof window.TTSTVFind.search === "function" && q) {
      out.push({ kind: "find" });
    }
    if (cands && cands.length) {
      /* `sources/library.py` searches YOUR OWN SHELF with no network, so a
         search now answers with your books as candidates too -- and this list
         already drew them, above, from `/state`. Elsewhere means elsewhere, so
         they are dropped here rather than shown twice under two headings. */
      var web = cands.filter(function (c) { return c && c.source !== "library"; });
      for (var i = 0; i < web.length && i < 12; i++) {
        out.push({ kind: "web", c: web[i] });
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
      var btn = e.target.closest ? e.target.closest("button[data-b]") : null;
      if (btn) {
        /* PRESSING A BUTTON IS NOT CHOOSING THE ROW. Sample and read are how
           you decide whether to take it at all, so they must not also take it. */
        e.preventDefault();
        act(btn.dataset.b, rows[Number(btn.dataset.i)]);
        return;
      }
      var el = e.target.closest ? e.target.closest(".askRow") : null;
      if (!el) return;
      e.preventDefault();
      take(rows[Number(el.dataset.i)]);
    });
    return box;
  }

  /* THE PANEL FITS THE BAR, BUT NEVER GOES UNDER ITS OWN FLOOR (Osca, 5 Sep,
     in tools/search/bar.html: *"I want the popup to FIT the bar UNLESS the bar
     is smaller than it is RIGHT there"* -- PROMPTS/bar-handover.md §3 calls it
     one of the two rules here that are decisions rather than taste).

     So it is the field's width and the field's left edge, and below P_MIN it
     holds its width and grows LEFTWARD -- keeping the right edges together,
     because the field's right edge is the fixed one -- then is clamped into
     the window. An answer is not readable in 340px, which is what the field
     goes to with eight tabs open. */
  var P_MIN = 640;

  function place() {
    if (!box) return;
    if (at && at.width) {
      /* THE STRIP MEASURED IT, so the strip is the top: in the app this page's
         webview begins BELOW the strip, and its own <header> is a thing inside
         the page rather than the chrome above it. `reportAsk` sends left and
         width on every layout, and lining the panel up with the field is what
         makes that message load-bearing (§4.1). */
      box.style.top = "6px";
      var w = Math.max(P_MIN, at.width);
      var left = w > at.width ? at.left + at.width - w : at.left;
      left = Math.max(8, Math.min(innerWidth - w - 8, left));
      box.style.transform = "";
      box.style.left = Math.round(left) + "px";
      box.style.width = Math.round(w) + "px";
      return;
    }
    /* No strip -- a browser, or the phone. The page's own header is the top
       and the list is centred, because there is no field to line up with. */
    var top = 0;
    var h = document.querySelector("header");
    if (h && !h.hidden && h.getBoundingClientRect) {
      var r = h.getBoundingClientRect();
      if (r.height) top = r.bottom;
    }
    box.style.top = Math.round(top + 6) + "px";
    box.style.left = "50%";
    box.style.width = "min(" + P_MIN + "px, 92vw)";
    box.style.transform = "translateX(-50%)";
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
            : SOURCES + " · ⏎") + "</span></div>";
    }
    if (r.kind === "file") {
      var f = r.f;
      return '<div class="askRow' + on + '" data-i="' + i + '">'
        + '<span class="t">' + esc(f.name) + "</span>"
        + '<span class="m">' + (f.size ? esc(bytes(f.size)) : "in this item") + "</span></div>";
    }
    var c = r.c;
    /* THE BUTTONS, and each has a route behind it that studio already answers
       in-process (`tools/search/serve.py`, imported by studio/serve.py):
       `/sample` is one 64 KB ranged read judged by `quality.sample_verdict`,
       `/peek` resolves a place to read or a url to hear. Neither downloads,
       parses or writes anything -- which is the only reason either belongs on
       a row rather than behind a confirmation. Drawn always, never on hover. */
    var acts = c.kind === "audio"
      ? '<button class="askBtn askPlay" data-b="play" data-i="' + i + '" title="hear it">' + PLAY + "</button>"
      : '<button class="askBtn" data-b="sample" data-i="' + i + '">sample</button>'
        + '<button class="askBtn" data-b="peek" data-i="' + i + '">read</button>';
    return '<div class="askRow' + on + '" data-i="' + i + '">'
      + '<span class="askRw"><span class="t">' + esc(c.title) + "</span>"
      + '<span class="m">' + webMeta(c) + "</span></span>"
      + '<span class="askAct">' + acts + "</span></div>";
  }

  /* WHO ANSWERS, in `sources/__init__.py`'s own order. One file per source,
     each registering itself with `@register`, all returning the same
     `Candidate` -- so this is a sentence, not a list of special cases, and a
     new adapter is one import line there and one word here. */
  var SOURCES = "your library, Gutenberg, Faded Page, archive.org, dokumen, LibriVox, YouTube";

  function secs(n) {
    if (n == null) return "";
    n = Math.round(n);
    var h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
    return h ? h + "h " + m + "m" : m ? m + "m " + (n % 60) + "s" : n + "s";
  }
  /* EVERYTHING THE SOURCE STATED, AND NOTHING IT DID NOT. All of this comes
     back in the same response that named the item -- size and popularity
     separate the edition people actually read from the nine near-identical
     scans beside it (`candidate_rank` sorts on them), chapters is what
     `filters.chapters_agree` compares across a pair, and the jurisdiction is
     the half of a licence that says WHERE it is clear. A field the source did
     not state is simply absent: never guessed, never a placeholder. */
  function webMeta(c) {
    var lic = c.license_status
      ? c.license_status + (c.license_jurisdiction ? " (" + c.license_jurisdiction + ")" : "")
      : null;
    return [c.source, c.author, c.language,
            c.kind === "audio" ? secs(c.duration_s)
              : (c.word_count ? c.word_count.toLocaleString() + " words" : null),
            c.chapters ? c.chapters + " parts" : null,
            c.format, bytes(c.size_bytes),
            c.popularity ? c.popularity.toLocaleString() + " taken" : null,
            lic]
      .filter(Boolean).map(esc).join(" · ");
  }

  /* The shelf's own convention is MB to one decimal, which reads "0 MB" for
     the plain-text files this list mostly names -- a real 193 KB book shown as
     nothing at all. Under a megabyte, say KB. */
  function bytes(n) {
    n = Number(n);
    if (!isFinite(n) || n <= 0) return "";
    return n < 1e6 ? Math.round(n / 1024) + " KB" : (n / 1e6).toFixed(1) + " MB";
  }

  /* One heading per group, drawn only where the group starts -- so a list
     with nothing of yours in it says nothing about yours. */
  var HEAD = { book: "Yours", find: "In this book", web: "Elsewhere", more: "Elsewhere",
               file: "More than one file in it \u2014 which one?" };

  /* TWO SIDES, AND THEY ARE THE DATA'S OWN (Osca, 5 Sep: *"it should have
     audio on one side and text in the other"*). `tools/search/candidate.py`
     opens with `Kind = Literal["text", "audio"]` and every adapter already
     returns one or the other, so this is not a layout invented for the
     picture -- it is the shape the answer already has.

     ONLY THE DRAWING IS TWO COLUMNS. `rows` stays one flat array in one
     order, so ⏎, ↑ and ↓ walk exactly what they walked before and every one
     of test_askbar.py's behaviour tests still describes this list. A side
     with nothing in it is not drawn at all, rather than left as a blank half. */
  function webHtml(idxs) {
    var text = "", audio = "";
    for (var k = 0; k < idxs.length; k++) {
      var i = idxs[k], c = rows[i].c || {};
      if (String(c.kind || "text") === "audio") audio += label(rows[i], i);
      else text += label(rows[i], i);
    }
    if (!text || !audio) return text + audio;
    return '<div class="askCols">'
      + '<div class="askCol"><div class="askSide">Text</div>' + text + "</div>"
      + '<div class="askCol"><div class="askSide">Audio</div>' + audio + "</div>"
      + "</div>";
  }

  function paint() {
    mount();
    if (!open || !rows.length) { box.hidden = true; return; }
    var html = "", last = null, i;
    var web = [];
    for (i = 0; i < rows.length; i++) if (rows[i].kind === "web") web.push(i);
    for (i = 0; i < rows.length; i++) {
      if (rows[i].kind === "web") {
        // the whole group, drawn once, where the first of it stands
        if (i !== web[0]) continue;
        var g0 = HEAD.web;
        if (g0 !== last) { html += '<div class="askHead">' + g0 + "</div>"; last = g0; }
        html += webHtml(web);
        continue;
      }
      var g = HEAD[rows[i].kind];
      if (g !== last) { html += '<div class="askHead">' + g + "</div>"; last = g; }
      html += label(rows[i], i);
    }
    /* WHICH SOURCES WERE NOT REACHED, at the foot, in the Library's own words
       (`adapterNote`) -- a source that was DOWN must not read as a source with
       nothing to offer. It is the page's html, not this file's: one sentence,
       one owner. */
    listEl.innerHTML = html + (notes || "");
    box.hidden = false;
    place();
    var on = listEl.querySelector(".askRow.on");
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  }

  function shut() {
    open = false; sel = -1; choosing = null; notes = ""; inflight = 0;
    if (box) box.hidden = true;
    pvShut();
  }

  // ------------------------------------------------------------- the search
  //
  // THROUGH THE LIBRARY WHERE THERE IS ONE. `TTSTVLibrary.search` is the same
  // request this file would make -- but it also REMEMBERS the candidates, and
  // staging one wants the whole candidate dict back, which a row's identity is
  // not. On the Library page that means the search and the take are the same
  // list. On the reader's or studio's tab there is no Library object, so this
  // asks studio directly and a chosen row travels to the Library instead.
  var token = 0;
  var inflight = 0;              // the token of the search that is running, or 0
  function everywhere() {
    var mine = ++token;
    inflight = mine;
    notes = "";
    rows = build(null); paint();                 // "searching…" in the row itself
    var got;
    if (window.TTSTVLibrary && typeof window.TTSTVLibrary.search === "function") {
      got = window.TTSTVLibrary.search(q, "");
    } else {
      var url = api("/search?" + new URLSearchParams({ title: q }).toString());
      if (!url) { rows = build([]); paint(); return; }
      got = fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        return { candidates: (d && d.candidates) || [], notes: "", error: d && d.error };
      });
    }
    /* A DEADLINE OF OUR OWN, one step past the server's. `sources/__init__.py`
       gives the whole search SEARCH_BUDGET = 25s and answers without whatever
       is still running, so a request that is still open after 30 is not a slow
       source -- it is a request that will never land, and the panel should say
       so rather than sit on "searching…" for ever. */
    var late = new Promise(function (_, no) {
      setTimeout(function () { no(new Error("the search did not answer in 30s")); }, 30000);
    });
    Promise.race([Promise.resolve(got), late]).then(function (d) {
      if (mine !== token || !d) return;          // an older search never wins
      inflight = 0;
      notes = d.error ? '<div class="askNote askBad">' + esc(d.error) + "</div>" : (d.notes || "");
      rows = build(d.candidates || []);
      /* AND IT COMES BACK OPEN. The field lives in another webview, so anything
         that takes focus off the strip sends `blur` -- and `blur` shut the
         list. A search takes up to 25 seconds, so the answer routinely landed
         into a panel that had already closed and was never seen once: from the
         outside that is a search that "times out" (Osca, 5 Sep). What you asked
         for arriving is reason enough to show it. */
      open = true;
      sel = -1; paint();
    }).catch(function (e) {
      if (mine !== token) return;
      inflight = 0;
      notes = '<div class="askNote askBad">' + esc(e && e.message ? e.message : String(e)) + "</div>";
      rows = build([]); open = true; paint();
    });
  }

  /* WHAT HAPPENED, WHERE THE CARET IS. The Library answers with a status
     rather than drawing, because the drawing is here now. */
  function report(r) {
    if (!r) return;
    if (r.status === "choose") {
      // the PICK is kept, not replaced: the second pass hands the same
      // candidate back with one of its files, and `take` set it just before
      // calling this
      choosing = { pick: (choosing && choosing.pick) || null, files: r.files };
      rows = build(); sel = -1; open = true; paint(); return;
    }
    choosing = null;
    if (r.status === "none") {
      notes = '<div class="askNote">Nothing in that item the parser reads directly '
            + "(.epub, .html, .txt or .pdf).</div>";
      rows = build([]); paint(); return;
    }
    if (r.status === "error") {
      notes = '<div class="askNote askBad">' + esc(r.error) + "</div>";
      rows = build([]); paint(); return;
    }
    if (r.status === "parsing") { shut(); return; }   // the shelf takes it from here
    /* EVERY OTHER ANSWER IS SAID OUT LOUD. `shut()` used to be the fall-through,
       so `stale` and `pipeline` -- both of which `TTSTVLibrary.take` returns --
       closed the panel and did nothing else: the row was clicked, the list
       disappeared, and no book was ever parsed (Osca, 5 Sep: *"when I click on
       something, in the search, it disappears, doesn't start parsing"*). A
       status nobody drew is still an answer. */
    if (r.status === "stale") {
      notes = '<div class="askNote">The answer moved on before that could be taken — search again.</div>';
      rows = build([]); paint(); return;
    }
    if (r.status === "pipeline") {
      notes = '<div class="askNote">A recording has no parser step, so that opened in <b>Attach</b>, '
            + "which aligns it against a text.</div>";
      rows = build([]); paint(); return;
    }
    notes = '<div class="askNote askBad">' + esc(r.status || "that did not come back with an answer")
          + "</div>";
    rows = build([]); paint();
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
    if (r.kind === "file") {
      /* the second pass: one of the item's files, handed straight back to the
         same staging call, which resolves that file instead of listing them */
      var p2 = choosing.pick;
      choosing = null;
      Promise.resolve(window.TTSTVLibrary.take(p2, r.f)).then(report);
      return;
    }
    /* ELSEWHERE, CHOSEN. The Library owns staging and parsing -- one path onto
       the shelf, not two -- so the pick is handed to it. On the Library page
       that is a direct call; anywhere else it is written down and the Library
       is opened, which reads it once and acts. */
    var pick = { title: q, source: r.c.source, ctitle: r.c.title, at: Date.now() };
    if (window.TTSTVLibrary && typeof window.TTSTVLibrary.take === "function") {
      // kept, because a "choose" answer needs it again for the second pass
      Promise.resolve(window.TTSTVLibrary.take(pick)).then(function (res) {
        if (res && res.status === "choose") choosing = { pick: pick, files: res.files };
        report(res);
      });
      return;
    }
    shut();
    try { localStorage.setItem(HANDOFF, JSON.stringify(pick)); } catch (e) { /* private */ }
    if (window.TTSTVHost && window.TTSTVHost.openLibrary) window.TTSTVHost.openLibrary();
    // "../library/" resolves to the Library from both pages that load this
    // file (/reader/reader.html and /library/library.html, module-split 2b step 4).
    else location.href = "../library/library.html";
  }

  // ---------------------------------------------------------- what the bar did
  function ask(verb, query) {
    if (verb === "at") {
      try { at = JSON.parse(query); } catch (e) { at = null; }
      place();
      return;
    }
    if (verb === "blur") {
      /* A SEARCH IN FLIGHT SURVIVES A BLUR. Moving the pointer off the strip,
         or clicking into the panel itself -- which is a different webview --
         both send `blur`, and shutting then threw away a request that was
         already 25 seconds from an answer. Escape still closes it, and so does
         choosing something. */
      /* ...AND A PREVIEW OPEN IS THE SAME CASE. Pressing `sample` or `read`
         puts the caret in THIS webview, so the strip sends `blur` -- and the
         list went with it, which is why a button looked like it dismissed the
         search (Osca, 5 Sep: *"it removes me from the search bar, it just
         disappears"*). You pressed a control belonging to the list; that is
         not leaving it. */
      if (inflight) return;
      if (pv && !pv.hidden) return;
      shut();
      return;
    }
    if (verb === "escape") { shut(); return; }
    if (verb === "focus") { open = true; q = String(query || ""); }
    if (verb === "type") {
      q = String(query || "");
      open = true;
      token++;                                   // a keystroke ends any search in flight
      choosing = null; notes = "";                // ...and any question it had raised
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

  // ==================================================================
  //  WHAT A BUTTON OPENS
  // ==================================================================
  var PLAY = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1.2 8.4 5 2 8.8Z"/></svg>';
  var STOP = '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="2.4" y="2.4" width="5.2" height="5.2" rx="1"/></svg>';
  var pv = null, pvBody = null, audio = null;

  function post(path, body) {
    var url = api(path);
    if (!url) return Promise.reject(new Error("no server behind this page"));
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body) }).then(function (r) {
      /* NEVER `r.json()` A NON-200: a 404 then throws a parse error that names
         nothing, and the window sits there empty. Say the route and the code. */
      if (!r.ok) throw new Error(path + " answered " + r.status + " " + r.statusText);
      return r.text().then(function (t) {
        try { return JSON.parse(t); }
        catch (e) { throw new Error(path + " answered " + r.status + " but not JSON"); }
      });
    });
  }

  function pvMount() {
    if (pv) return pv;
    pv = document.createElement("div");
    pv.className = "askPv";
    pv.hidden = true;
    pv.innerHTML = '<div class="askPvHead"><span class="askRw"><span class="t"></span>'
      + '<span class="m"></span></span><button class="askPvX" aria-label="Close">×</button></div>'
      + '<div class="askPvBody"></div>';
    pvBody = pv.querySelector(".askPvBody");
    pv.querySelector(".askPvX").addEventListener("click", pvShut);
    /* it is a window you work in: a press inside it must not blur the field and
       take the panel away underneath, and its own controls still get the click */
    pv.addEventListener("mousedown", function (e) {
      if (!e.target.closest("a, select, input")) e.preventDefault();
    });
    (document.body || document.documentElement).appendChild(pv);
    return pv;
  }
  function pvShut() {
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
    if (pv) { pv.hidden = true; pvBody.innerHTML = ""; }
    paint();
  }
  /* BESIDE THE PANEL, NOT OVER IT -- you chose a row there and should still be
     able to see it and choose another. Left of it where there is room. */
  function pvPlace() {
    if (!pv || pv.hidden) return;
    var d = (box && !box.hidden) ? box.getBoundingClientRect()
                                 : { left: innerWidth, right: innerWidth, top: 40 };
    var w = pv.offsetWidth, gap = 10, x;
    if (d.left - gap - w >= 12) x = d.left - gap - w;
    else if (d.right + gap + w <= innerWidth - 12) x = d.right + gap;
    else x = Math.max(12, Math.min(d.left, innerWidth - w - 12));
    pv.style.left = Math.round(x) + "px";
    pv.style.top = Math.round(d.top) + "px";
  }
  function pvShow(c, html) {
    pvMount();
    pv.querySelector(".t").textContent = c.title || "";
    pv.querySelector(".m").textContent = [c.source, c.kind, c.author, c.license_status]
      .filter(Boolean).join(" · ");
    pvBody.innerHTML = html;
    pv.hidden = false;
    pvPlace();
  }
  function pvFail(c, what, e) {
    pvShow(c, "<b>" + esc(what) + "</b> — " + esc((e && e.message) || String(e)));
  }
  /* THE HOSTS THAT NEVER FRAME. Kept short and named rather than guessed: each
     one here has been seen to send X-Frame-Options, and a host that is merely
     slow or occasionally blocked does NOT belong -- being wrong in this
     direction takes away a preview that would have worked. */
  var NO_FRAME = ["gutenberg.org", "www.gutenberg.org", "youtube.com", "www.youtube.com",
                  "youtu.be", "m.youtube.com"];
  function hostOf(u) {
    try { return new URL(u, location.href).hostname; } catch (e) { return ""; }
  }
  function refusesFrames(u) {
    var h = hostOf(u);
    for (var i = 0; i < NO_FRAME.length; i++) {
      if (h === NO_FRAME[i] || (h && h.slice(-(NO_FRAME[i].length + 1)) === "." + NO_FRAME[i]))
        return true;
    }
    return false;
  }

  function band(b) {
    return '<span class="askBand ' + esc(b) + '">' + esc(String(b).replace("_", " ")) + "</span>";
  }
  function clock(t) {
    t = Math.max(0, Math.round(t || 0));
    var m = Math.floor(t / 60), s2 = t % 60;
    return m + ":" + (s2 < 10 ? "0" : "") + s2;
  }

  /* THE PLAYER, built as elements rather than a string: the scrub is written to
     many times a second, and re-rendering the window under it would stop the
     sound. */
  function player(c, url) {
    pvShow(c, "");
    var wrap = document.createElement("div"); wrap.className = "askPlayer";
    var btn = document.createElement("button"); btn.innerHTML = PLAY; btn.title = "play";
    var track = document.createElement("div"); track.className = "track";
    var fill = document.createElement("i"); track.appendChild(fill);
    var time = document.createElement("span"); time.className = "time"; time.textContent = "0:00";
    wrap.appendChild(btn); wrap.appendChild(track); wrap.appendChild(time);
    var note = document.createElement("div");
    note.style.cssText = "margin-top:10px;font-size:11.5px";
    note.innerHTML = 'streamed from the source — nothing is downloaded. '
      + '<a href="' + esc(url) + '" target="_blank" rel="noopener">the file itself</a>';
    pvBody.appendChild(wrap); pvBody.appendChild(note);

    if (audio) { try { audio.pause(); } catch (e) {} }
    audio = new Audio(url); audio.preload = "metadata";
    function draw() {
      var d = audio.duration;
      fill.style.width = (d ? (audio.currentTime / d * 100) : 0) + "%";
      time.textContent = clock(audio.currentTime) + (d && isFinite(d) ? " / " + clock(d) : "");
    }
    audio.addEventListener("timeupdate", draw);
    audio.addEventListener("loadedmetadata", draw);
    audio.addEventListener("play", function () { btn.classList.add("playing"); btn.innerHTML = STOP; });
    audio.addEventListener("pause", function () { btn.classList.remove("playing"); btn.innerHTML = PLAY; });
    audio.addEventListener("ended", function () { btn.classList.remove("playing"); btn.innerHTML = PLAY; });
    audio.addEventListener("error", function () {
      note.innerHTML = "<b>could not load that audio.</b> "
        + '<a href="' + esc(url) + '" target="_blank" rel="noopener">open it directly</a>';
    });
    btn.addEventListener("click", function () {
      if (audio.paused) { audio.play().catch(function () {}); } else { audio.pause(); }
    });
    track.addEventListener("click", function (e) {
      var r = track.getBoundingClientRect();
      if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    audio.play().catch(function () { /* a browser wanting a gesture: the button is one */ });
  }

  function act(what, r) {
    if (!r || r.kind !== "web") return;
    var c = r.c;
    if (what === "play") {
      pvShow(c, "resolving the file…");
      post("/peek", { candidate: c }).then(function (res) {
        if (res.error) return pvShow(c, "<b>could not resolve</b> — " + esc(res.error));
        if (res.status === "choose") return pvShow(c, "<b>more than one file in this item</b> — "
          + "press the row itself and the list will ask which.");
        if (res.kind !== "audio" || !res.url) return pvShow(c, "nothing playable came back");
        player(c, res.url);
      }).catch(function (e) { pvFail(c, "could not resolve", e); });
      return;
    }
    if (what === "sample") {
      pvShow(c, "reading the first 64 KB…");
      /* `/search-sample`, never `/sample`: studio's `/sample` is the VOICE
         sample (thirty seconds of a chapter read aloud) and it had the name
         first. `tools/search/serve.py` answers to both spellings, so this one
         word reaches either server. */
      post("/search-sample", { candidate: c }).then(function (res) {
        if (res.error) return pvShow(c, "<b>sample failed</b> — " + esc(res.error));
        if (res.status !== "sampled")
          return pvShow(c, esc(res.reason || res.status || "nothing to sample"));
        pvShow(c, band(res.band) + esc((res.reasons || []).join("; "))
          + (res.bytes_read ? " · " + esc(bytes(res.bytes_read)) + " read" : "")
          + '<div class="askProse">' + esc(res.preview || "") + "</div>");
      }).catch(function (e) { pvFail(c, "sample failed", e); });
      return;
    }
    if (what === "peek") {
      pvShow(c, "resolving where to read it…");
      post("/peek", { candidate: c }).then(function (res) {
        if (res.error) return pvShow(c, "<b>could not open</b> — " + esc(res.error));
        if (res.status === "choose") return pvShow(c, "<b>more than one file in this item</b> — "
          + "press the row itself and the list will ask which.");
        if (res.text != null) return pvShow(c, '<div class="askProse">' + esc(res.text) + "</div>");
        if (res.url) {
          /* IF WE KNOW IT IS DEAD, DO NOT DRAW IT (Osca, 5 Sep: *"IF it can't be
             got, OPEN the raw source straight away, don't give me something you
             know is dead"*). These hosts send X-Frame-Options and no page can
             overrule that, so an iframe on them is a white box by construction:
             a control that is certain to fail should not be offered. Everything
             else still tries, with the link underneath. */
          if (refusesFrames(res.url)) {
            var w = window.open(res.url, "_blank", "noopener");
            return pvShow(c, "<b>" + esc(hostOf(res.url)) + "</b> refuses to be framed, so this "
              + (w ? "opened in your browser." : "could not be opened — your browser blocked it.")
              + ' <a href="' + esc(res.url) + '" target="_blank" rel="noopener">the raw source</a>');
          }
          return pvShow(c, '<iframe src="' + esc(res.url) + '" title="preview"></iframe>'
            + '<div style="margin-top:8px"><a href="' + esc(res.url) + '" target="_blank" rel="noopener">'
            + "open the raw source</a> — if the box above is blank the site refused to be "
            + "framed; the link always works.</div>");
        }
        pvShow(c, "nothing to show");
      }).catch(function (e) { pvFail(c, "could not open", e); });
      return;
    }
  }

  /* THE PAGE'S ONE DOOR. `TTSTVPage` is the object the strip evaluates into
     (`tab_tool` -> .tool, `tab_ask` -> .ask), and the pages define `.tool`
     themselves -- so this MERGES rather than assigns, and the order the two
     are written in stops mattering. */
  window.TTSTVAsk = { ask: ask, close: shut };
  window.TTSTVPage = Object.assign(window.TTSTVPage || {}, { ask: ask });

  addEventListener("resize", place);
  addEventListener("resize", pvPlace);
})();
