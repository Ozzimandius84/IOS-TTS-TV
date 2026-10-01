/* design/library/zero.js -- THE LIBRARY'S PART OF FRANK 1.0 (ZERO-TO-ONE-FOR-DESIGN Z1 Z3 Z5 Z6 Z7 Z17; ASKS #197).

   Osca, 1 Oct: "MAke the finished front end for version ONE ... then we can be done here and just focus on the back."
   Every screen here asks one seam in seams.js and nothing else; library.html calls this file at six named hooks
   (search it for "FrankZero"). The Photos rules (PROMPTS/lanes/design.md, the seven) hold throughout: the content is
   the page, a door is a toggle, the head says what is on screen, opening a thing grows it full bleed with its name
   in a capsule between ‹ and ⋯ and its actions in one glass row at the foot.

     Z1   the web as shop window   -- an act beyond browsing HAPPENS, then a card asks "Sign in to keep this"
     Z3   "What do you read?"      -- four answers, one press each; that shelf; the reader at first_content_chapter
     Z5   your stuff from the books -- the Library's second door (the highlighter circle in the head): every mark, by colour
     Z6   a card per mark          -- again · later · done; "by what you did" is one of the sorts, nothing more
     Z7   shelves as albums        -- make and name, add and remove, a book opened on its shelf, share a code, join,
                                      the owner's notes as the shelf's layer, where the voice lands you
     Z17  the creator's link       -- one link opens a public book with a named voice and a named person's notes */
(function () {
  "use strict";
  var W = window, D = document, R = D.documentElement;
  var Z = W.FrankZero = { view: "books" };
  function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function books() { try { return libraryBooks || []; } catch (x) { return []; } }
  function bookOf(slug) { var b = books().filter(function (x) { return x.slug === slug; })[0]; return b || null; }
  function titleOf(slug) { var b = bookOf(slug); return (b && (b.title || b.slug)) || slug; }
  function phone() { return R.hasAttribute("data-phone"); }
  function web() { return !!(W.TTSTVHost && W.TTSTVHost.isWeb); }
  function cover(b) { try { return tileCoverHTML(b); } catch (x) { return '<span class="tilecov"></span>'; } }
  function shelves() { try { return library.shelves; } catch (x) { return []; } }
  function repaint() { try { shelfDrawn = ""; } catch (x) {} try { renderShelf(); } catch (x) {} }
  function ago(t) {
    if (!t) return "";
    var d = Math.round((Date.now() - t) / 86400000);
    if (d <= 0) return "today"; if (d === 1) return "yesterday"; if (d < 7) return d + " days ago";
    var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], x = new Date(t);
    return x.getDate() + " " + M[x.getMonth()] + (x.getFullYear() !== new Date().getFullYear() ? " " + x.getFullYear() : "");
  }
  var GLYPH = {
    back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>',
    more: '<svg viewBox="0 0 20 20" aria-hidden="true" class="fill"><circle cx="5" cy="10" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="15" cy="10" r="1.3"/></svg>',
    close: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>',
    play: '<svg viewBox="0 0 20 20" aria-hidden="true" class="fill"><path d="M6.5 4.6v10.8L15.4 10z"/></svg>',
    pen: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16h5"/><path d="M12.6 3.9l3.5 3.5-6.9 6.9-4.2.7.7-4.2z"/></svg>'
  };
  /* the reader's four inks (marginalia.css, byte for byte) and any colour a person adds (Z4: any number, named or not --
     the record carries the colour as written, so a CSS colour is drawn as itself and a name we do not know is grey) */
  var INK = { green: "#4a8f3c", yellow: "#d8b431", red: "#c0453a", pink: "#c9558f" };
  function ink(c) { if (INK[c]) return INK[c]; if (/^#[0-9a-f]{3,8}$/i.test(String(c || ""))) return c; return "#8a8782"; }
  function inkName(c) { return INK[c] ? c.charAt(0).toUpperCase() + c.slice(1) : (c ? String(c) : "No colour"); }

  /* ================================================================ common: the sheet and the foot card
     A sheet is glass: centred on a window, from the foot on the phone (above the band). One at a time; Esc and the
     scrim close it. */
  var SHEET = null;
  function sheet(html, cls) {
    closeSheet();
    var s = D.createElement("div"); s.className = "zs-wrap" + (cls ? " " + cls : "");
    s.innerHTML = '<div class="zs-scrim" data-zclose></div><div class="zs" role="dialog" aria-modal="true">' + html + "</div>";
    D.body.appendChild(s); SHEET = s;
    s.addEventListener("click", function (ev) { if (ev.target.closest("[data-zclose]")) { ev.preventDefault(); closeSheet(); } });
    var f = s.querySelector("input, button.zs-go, button"); if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (x) {} }, 0);
    return s.querySelector(".zs");
  }
  function closeSheet() { if (SHEET) { SHEET.remove(); SHEET = null; } }
  D.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (SHEET) { ev.preventDefault(); ev.stopPropagation(); closeSheet(); return; }
    if (RUN) { ev.preventDefault(); ev.stopPropagation(); runClose(); return; }
    if (LINK) { ev.preventDefault(); ev.stopPropagation(); linkClose(); }
  }, true);
  function fail(where, o) {
    var host = typeof where === "string" ? D.querySelector(where) : where;
    if (!host) return null;
    var card = W.TellFrank && W.TellFrank.failure ? W.TellFrank.failure(o)
      : (function () { var d = D.createElement("div"); d.className = "tf-fail"; d.innerHTML = "<p class=\"tf-what\">" + e(o.what) + "</p><p class=\"tf-why\">" + e(o.why || "") + "</p>"; return d; })();
    card.classList.add("zfail"); host.appendChild(card); return card;
  }

  /* ================================================================ Z1 · THE WEB IS THE SHOP WINDOW
     The act happens; THEN the card. "Sign in to keep this" -- and signing in starts the four weeks. Never a wall
     before the act, never a nag after (the trial line lives in Settings ▸ Frank's cloud and nowhere else). */
  var ASK = null;
  var KEEP_WHAT = { shelf: "Your shelf", add: "The book", mark: "Your mark", join: "Joining", share: "Sharing", import: "The book you added" };
  Z.kept = function (act, what) {
    if (!W.FrankAccount || !FrankAccount.needsAsk(act)) return false;
    askToKeep(act, what || KEEP_WHAT[act] || "This");
    return true;
  };
  function askToKeep(act, what) {
    if (ASK) ASK.remove();
    var cant = act === "share" || act === "join";   /* these cannot happen at all without an account: the card says so */
    var a = D.createElement("div"); a.className = "zask"; a.setAttribute("role", "dialog"); a.setAttribute("aria-label", "Sign in to keep this");
    a.innerHTML = '<p class="zask-t">' + (cant ? "Sign in to " + (act === "share" ? "share it" : "join") : "Sign in to keep this") + "</p>" +
      '<p class="zask-l">' + (cant ? e(what) + " needs your Frank account. Signing in starts your four weeks free."
                                   : e(what) + " stays on this page until you close it. Signing in keeps it, and starts your four weeks free.") + "</p>" +
      '<div class="zask-row"><button type="button" class="zask-go" data-zsignin>Continue with Google</button><button type="button" class="zask-no" data-znot>Not now</button></div>';
    D.body.appendChild(a); ASK = a;
    a.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-znot]")) { a.remove(); ASK = null; return; }
      if (!ev.target.closest("[data-zsignin]")) return;
      a.setAttribute("data-busy", ""); a.querySelector(".zask-go").textContent = "Signing in…";
      Promise.resolve().then(function () { return FrankAccount.signIn(); }).then(function (acc) {
        a.removeAttribute("data-busy"); a.setAttribute("data-kept", "");
        a.innerHTML = '<p class="zask-t">Kept.</p><p class="zask-l">' + (acc && acc.name ? e(acc.name) + ", your" : "Your") + " four weeks start today. Everything works; nothing you make is ever held back.</p>";
        if (!Z.hold) setTimeout(function () { if (ASK === a) { a.remove(); ASK = null; } }, 3200);
      }, function (err) {
        a.remove(); ASK = null;
        var c = fail(D.body, { kind: "Sign in", what: "You're not signed in.", why: (err && err.message) || "Google didn't answer.", fix: "Try again", onFix: function () { c && c.remove(); askToKeep(act, what); } });
        if (c) c.classList.add("zfail-foot");
      });
    });
  }

  /* ================================================================ Z5 · Z6 · YOUR STUFF FROM THE BOOKS
     The Library's second door: one glass circle in the head beside the order, a highlighter. Pressed, it lights and
     the page under the head is every highlight and note from every book; pressed again, the books come back (rule 2).
     The head says what is on screen (rule 5): "From the books", and under it the books in view, or the colour. */
  var ST = { list: null, err: null, colour: "all", sort: "book", loading: false };
  var SORTS = [["book", "By book"], ["new", "Newest first"], ["colour", "By colour"], ["did", "By what you did"]];
  var DID = ["again", "later", "", "done"], DID_NAME = { again: "Again", later: "Later", "": "Not marked yet", done: "Done" };
  Z.isStuff = function () { return Z.view === "stuff"; };
  Z.setView = function (v) {
    Z.view = v === "stuff" ? "stuff" : "books";
    R.toggleAttribute("data-zstuff", Z.view === "stuff");
    var b = D.getElementById("phstuff"); if (b) b.setAttribute("aria-pressed", Z.view === "stuff" ? "true" : "false");
    if (Z.view === "stuff") loadStuff(); else repaint();
    try { var sc = D.getElementById("shelf"); if (sc) sc.scrollTop = 0; (D.scrollingElement || R).scrollTop = 0; } catch (x) {}
  };
  function loadStuff() {
    ST.loading = true; drawStuff();
    FrankStuff.list().then(function (l) { ST.list = l || []; ST.err = null; ST.loading = false; drawStuff(); },
                           function (err) { ST.err = err || new Error("unreadable"); ST.loading = false; drawStuff(); });
  }
  W.addEventListener("storage", function (ev) { if (Z.view === "stuff" && ev.key && /^(frank\.mine\.|ttstv\.reader\.marginalia\.|frank\.review\.)/.test(ev.key)) loadStuff(); });
  function items() {
    var out = [];
    (ST.list || []).forEach(function (b) {
      var bk = bookOf(b.slug) || {};
      b.items.forEach(function (it) { out.push(Object.assign({ slug: b.slug, title: b.title || bk.title || b.slug, author: b.author || bk.author || "" }, it)); });
    });
    return out;
  }
  function colours(all) { var seen = {}, out = []; all.forEach(function (it) { var c = it.colour || ""; if (it.kind === "highlight" && !seen[c]) { seen[c] = 1; out.push(c); } }); var known = Object.keys(INK); out.sort(function (a, b) { var i = known.indexOf(a), j = known.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }); return out; }
  function shown(all) {
    return all.filter(function (it) { return ST.colour === "all" ? true : ST.colour === "notes" ? it.kind === "note" : it.kind === "highlight" && (it.colour || "") === ST.colour; });
  }
  function cardHTML(it, withBook) {
    var st = (it.review && it.review.state) || "";
    var q = it.quote ? '<blockquote class="zc-q">' + e(it.quote) + "</blockquote>"
                     : '<p class="zc-q zc-noq">' + (it.kind === "note" ? "A note" : "A highlight") + (it.chapterTitle ? " in " + e(it.chapterTitle) : it.chapter ? " in chapter " + Number(it.chapter.slice(1)) : "") + "</p>";
    var meta = [withBook ? it.title : "", it.chapterTitle || "", ago(it.at)].filter(Boolean).map(e).join(" · ");
    return '<article class="zc" tabindex="0" data-zid="' + e(it.id) + '" data-slug="' + e(it.slug) + '" data-kind="' + it.kind + '" data-review="' + st + '" style="--zink:' + ink(it.colour) + '">' +
      '<button type="button" class="zc-open" data-zrun="' + e(it.slug + "\u0001" + it.id) + '" aria-label="Open this ' + (it.kind === "note" ? "note" : "highlight") + '">' + q +
      (it.kind === "note" && it.note ? '<p class="zc-n">' + e(it.note) + "</p>" : "") + "</button>" +
      '<div class="zc-foot"><p class="zc-m">' + meta + "</p>" + marksHTML(st) + "</div></article>";
  }
  function marksHTML(st) {
    return '<div class="zc-marks" role="group" aria-label="Mark it">' + ["again", "later", "done"].map(function (m) {
      return '<button type="button" data-zmark="' + m + '" aria-pressed="' + (st === m ? "true" : "false") + '">' + DID_NAME[m] + "</button>"; }).join("") + "</div>";
  }
  function groupHTML(label, list, withBook, cls) {
    return '<section class="zst-grp' + (cls ? " " + cls : "") + '"><h2 class="libhead zst-h">' + label + '</h2><div class="zst-cards">' + list.map(function (it) { return cardHTML(it, withBook); }).join("") + "</div></section>";
  }
  function stuffHTML() {
    if (ST.loading && !ST.list) return '<div class="zst" aria-busy="true"><p class="zst-wait">Gathering your marks…</p></div>';
    if (ST.err) return '<div class="zst"><div class="zst-head"><h2 class="libhead zst-top">From the books</h2></div><div class="zst-bad" id="zstBad"></div></div>';
    var all = items();
    if (!all.length) return '<div class="zst zst-none"><div class="zst-head"><h2 class="libhead zst-top">From the books</h2></div><div class="zst-empty"><b>Nothing from your books yet.</b>' +
      "<p>Hold a sentence in any book and choose a colour. Every highlight and note you make lands here, by colour, to run through.</p>" +
      '<button type="button" class="zst-door" data-zview="books">Open a book</button></div></div>';
    var cs = colours(all), hasNotes = all.some(function (it) { return it.kind === "note"; });
    var pens = '<div class="zst-pens" role="radiogroup" aria-label="By colour">' +
      '<button type="button" role="radio" data-zpen="all" aria-checked="' + (ST.colour === "all") + '" class="zp-all">All</button>' +
      cs.map(function (c) { return '<button type="button" role="radio" data-zpen="' + e(c) + '" aria-checked="' + (ST.colour === c) + '" aria-label="' + e(inkName(c)) + '" style="--zink:' + ink(c) + '"><i></i></button>'; }).join("") +
      (hasNotes ? '<button type="button" role="radio" data-zpen="notes" aria-checked="' + (ST.colour === "notes") + '" aria-label="Notes" class="zp-notes">' + GLYPH.pen + "</button>" : "") + "</div>";
    var list = shown(all), body = "";
    if (!list.length) body = '<p class="zst-few">No ' + (ST.colour === "notes" ? "notes" : e(inkName(ST.colour).toLowerCase()) + " highlights") + " yet.</p>";
    else if (ST.sort === "book") {
      var by = {}, order = [];
      list.forEach(function (it) { if (!by[it.slug]) { by[it.slug] = []; order.push(it.slug); } by[it.slug].push(it); });
      body = order.map(function (slug) {
        var b = bookOf(slug) || { slug: slug, title: by[slug][0].title, author: by[slug][0].author };
        by[slug].sort(function (x, y) { return (x.chapter || "").localeCompare(y.chapter || "") || x.at - y.at; });
        return '<section class="zst-book" data-slug="' + e(slug) + '"><button type="button" class="zst-bh" data-zbook="' + e(slug) + '"><span class="zst-bc">' + cover(b) + '</span><span class="zst-bt"><b>' + e(b.title || slug) + "</b><i>" + e(b.author || "") + "</i></span></button>" +
          '<div class="zst-cards">' + by[slug].map(function (it) { return cardHTML(it, false); }).join("") + "</div></section>";
      }).join("");
    } else if (ST.sort === "new") {
      body = '<div class="zst-cards zst-flat">' + list.slice().sort(function (a, b) { return b.at - a.at; }).map(function (it) { return cardHTML(it, true); }).join("") + "</div>";
    } else if (ST.sort === "colour") {
      var cols = colours(list).concat(list.some(function (it) { return it.kind === "note"; }) ? ["\u0000notes"] : []);
      body = cols.map(function (c) {
        var g = list.filter(function (it) { return c === "\u0000notes" ? it.kind === "note" : it.kind === "highlight" && (it.colour || "") === c; });
        return g.length ? groupHTML(c === "\u0000notes" ? "Notes" : e(inkName(c)), g.sort(function (a, b) { return b.at - a.at; }), true) : "";
      }).join("");
    } else {
      /* BY WHAT YOU DID (Z6): again, later, not marked yet, done -- the order of the marks, nothing scheduled */
      body = DID.map(function (d) {
        var g = list.filter(function (it) { return ((it.review && it.review.state) || "") === d; });
        return g.length ? groupHTML(DID_NAME[d], g.sort(function (a, b) { return ((b.review && b.review.at) || b.at) - ((a.review && a.review.at) || a.at); }), true, "zst-did-" + (d || "none")) : "";
      }).join("");
    }
    return '<div class="zst" data-sort="' + ST.sort + '" data-colour="' + e(ST.colour) + '"><div class="zst-head"><h2 class="libhead zst-top">' + headWords() + "</h2>" + pens + "</div>" + body + "</div>";
  }
  /* THE HEAD SAYS WHAT IS ON SCREEN (rule 5), in the shelf's own small voice -- the Library has no big title (29 Sep) */
  function headWords() { return ST.colour === "all" ? "From the books" : ST.colour === "notes" ? "Notes from the books" : e(inkName(ST.colour)) + " · from the books"; }
  function drawStuff() {
    var el = D.getElementById("shelf"); if (!el || Z.view !== "stuff") return;
    el.innerHTML = stuffHTML();
    try { shelfDrawn = ""; } catch (x) {}
    if (ST.err) fail("#zstBad", { kind: "Your highlights and notes", what: "Your highlights couldn't be read.", why: (ST.err && ST.err.message) || "This browser's storage didn't answer.", fix: "Try again", onFix: loadStuff });
    sayRange();
  }
  Z.drawInto = function (el) { if (Z.view !== "stuff") return false; if (!el.querySelector(".zst")) drawStuff(); return true; };
  function sayRange() {
    var out = null; if (!out || Z.view !== "stuff") return;
    if (ST.colour !== "all") { out.textContent = ST.colour === "notes" ? "Notes" : inkName(ST.colour); return; }
    var top = 80, bot = innerHeight, seen = [];
    D.querySelectorAll("#shelf .zc").forEach(function (c) { var r = c.getBoundingClientRect(); if (r.bottom > top && r.top < bot) { var t = c.getAttribute("data-slug"); if (seen.indexOf(t) < 0) seen.push(t); } });
    out.textContent = !seen.length ? "" : seen.length === 1 ? titleOf(seen[0]) : titleOf(seen[0]) + " – " + titleOf(seen[seen.length - 1]);
  }
  W.addEventListener("scroll", function () { if (Z.view === "stuff") sayRange(); }, true);
  function mark(card, m) {
    var slug = card.getAttribute("data-slug"), id = card.getAttribute("data-zid");
    var now = card.getAttribute("data-review"), next = now === m ? null : m;
    return FrankStuff.mark(slug, id, next).then(function (rv) {
      (ST.list || []).forEach(function (b) { if (b.slug === slug) b.items.forEach(function (it) { if (it.id === id) it.review = rv && rv.state ? rv : null; }); });
      D.querySelectorAll('.zc[data-zid="' + (W.CSS && CSS.escape ? CSS.escape(id) : id) + '"]').forEach(function (c) {
        c.setAttribute("data-review", next || ""); c.querySelectorAll("[data-zmark]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-zmark") === next ? "true" : "false"); });
      });
      if (web()) Z.kept("mark", "Your mark");
      return next;
    }, function (err) { fail(card, { kind: "Marking", what: "That mark wasn't kept.", why: err && err.message, fix: "Try again", onFix: function () { mark(card, m); } }); });
  }
  Z.orderItems = function () { return Z.view === "stuff" ? SORTS.map(function (s) { return { id: "zsort:" + s[0], label: s[1], checked: ST.sort === s[0] }; }) : null; };
  Z.orderExtra = function () { return [{ id: "sep" }, { id: "znewshelf", label: "New shelf…" }, { id: "zjoin", label: "Join a shelf…" }]; };

  /* ---------------------------------------------------------------- Z6 · run through them, one at a time
     A card opened grows to the page (rule 4): the words large on their ink, the book and the chapter in the capsule
     between ‹ and ⋯, the three marks in one glass row at the foot. A mark moves on to the next card. ← → or a
     sideways drag walk the cards; ‹, Esc or a drag down put it back. */
  var RUN = null;
  function runList() { var all = shown(items()); var cards = [].slice.call(D.querySelectorAll("#shelf .zc")).map(function (c) { return c.getAttribute("data-slug") + "\u0001" + c.getAttribute("data-zid"); });
    var by = {}; all.forEach(function (it) { by[it.slug + "\u0001" + it.id] = it; }); return cards.map(function (k) { return by[k]; }).filter(Boolean); }
  function runOpen(key) {
    var list = runList(), i = 0; list.forEach(function (it, n) { if (it.slug + "\u0001" + it.id === key) i = n; });
    if (!list.length) return;
    RUN = { list: list, i: i, el: D.createElement("div") };
    RUN.el.className = "zrun"; RUN.el.setAttribute("role", "dialog"); RUN.el.setAttribute("aria-modal", "true");
    D.body.appendChild(RUN.el); runDraw();
    RUN.el.addEventListener("click", runClick);
    var x0 = null, y0 = null;
    RUN.el.addEventListener("pointerdown", function (ev) { if (ev.target.closest("button")) return; x0 = ev.clientX; y0 = ev.clientY; });
    RUN.el.addEventListener("pointerup", function (ev) { if (x0 == null) return; var dx = ev.clientX - x0, dy = ev.clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) runGo(dx < 0 ? 1 : -1); else if (dy > 90 && dy > Math.abs(dx)) runClose(); });
  }
  function runDraw() {
    if (!RUN) return;
    var it = RUN.list[RUN.i]; if (!it) { runEnd(); return; }
    var st = (it.review && it.review.state) || "";
    RUN.el.style.setProperty("--zink", ink(it.colour));
    RUN.el.innerHTML = '<div class="zrun-top"><button type="button" class="zg" data-zrunback aria-label="Back to your stuff">' + GLYPH.back + "</button>" +
      '<div class="zcap"><b>' + e(it.title) + "</b><i>" + e([it.chapterTitle || (it.chapter ? "Chapter " + Number(it.chapter.slice(1)) : ""), ago(it.at)].filter(Boolean).join(" · ")) + "</i></div>" +
      '<button type="button" class="zg" data-zrunread aria-label="Open it in the book">' + GLYPH.more + "</button></div>" +
      '<div class="zrun-page"><div class="zrun-w" data-kind="' + it.kind + '">' +
      (it.quote ? '<blockquote class="zrun-q"><span>' + e(it.quote) + "</span></blockquote>" : '<p class="zrun-q zrun-noq">' + (it.kind === "note" ? "A note" : "A highlight") + (it.chapter ? " in chapter " + Number(it.chapter.slice(1)) : "") + "</p>") +
      (it.kind === "note" && it.note ? '<p class="zrun-n">' + e(it.note) + "</p>" : "") + "</div></div>" +
      '<div class="zrun-foot" data-review="' + st + '">' + ["again", "later", "done"].map(function (m) { return '<button type="button" data-zrunmark="' + m + '" aria-pressed="' + (st === m) + '">' + DID_NAME[m] + "</button>"; }).join("") + "</div>";
  }
  function runEnd() {
    RUN.el.innerHTML = '<div class="zrun-top"><button type="button" class="zg" data-zrunback aria-label="Back to your stuff">' + GLYPH.back + '</button><div class="zcap"><b>From the books</b><i></i></div><span class="zg-gap"></span></div>' +
      '<div class="zrun-page"><div class="zrun-w zrun-done"><p class="zrun-q">That’s all of them.</p><button type="button" class="zst-door" data-zrunback>Back to your stuff</button></div></div>';
  }
  function runGo(d) { if (!RUN) return; var j = RUN.i + d; if (j < 0) return; RUN.i = j; runDraw(); }
  function runClick(ev) {
    if (ev.target.closest("[data-zrunback]")) { runClose(); return; }
    if (ev.target.closest("[data-zrunread]")) { var it = RUN.list[RUN.i]; if (it) openAt(it.slug, it.chapter, { mark: it.id }); return; }
    var m = ev.target.closest("[data-zrunmark]"); if (!m) return;
    var it2 = RUN.list[RUN.i], st = (it2.review && it2.review.state) || "", next = st === m.getAttribute("data-zrunmark") ? null : m.getAttribute("data-zrunmark");
    FrankStuff.mark(it2.slug, it2.id, next).then(function (rv) {
      it2.review = rv && rv.state ? rv : null;
      var c = D.querySelector('#shelf .zc[data-zid="' + (W.CSS && CSS.escape ? CSS.escape(it2.id) : it2.id) + '"]');
      if (c) { c.setAttribute("data-review", next || ""); c.querySelectorAll("[data-zmark]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-zmark") === next ? "true" : "false"); }); }
      runDraw();
      if (next) setTimeout(function () { if (RUN && RUN.list[RUN.i] === it2) runGo(1); }, Z.hold ? 1e9 : 260);
    });
  }
  function runClose() { if (!RUN) return; var k = RUN.list[RUN.i]; RUN.el.remove(); RUN = null;
    if (k) { var c = D.querySelector('#shelf .zc[data-zid="' + (W.CSS && CSS.escape ? CSS.escape(k.id) : k.id) + '"]'); if (c) { try { c.focus({ preventScroll: true }); } catch (x) {} } } }
  D.addEventListener("keydown", function (ev) { if (!RUN || SHEET) return; if (ev.key === "ArrowRight") { ev.preventDefault(); runGo(1); } else if (ev.key === "ArrowLeft") { ev.preventDefault(); runGo(-1); } });

  /* ================================================================ the clicks the page hands on */
  D.addEventListener("click", function (ev) {
    var t = ev.target;
    var door = t.closest("#phstuff"); if (door) { ev.preventDefault(); Z.setView(Z.view === "stuff" ? "books" : "stuff"); return; }
    if (!t.closest("#shelf, .zfr, .zlink")) return;
    var v = t.closest("[data-zview]"); if (v) { ev.preventDefault(); ev.stopPropagation(); Z.setView(v.getAttribute("data-zview")); return; }
    var p = t.closest("[data-zpen]"); if (p) { ev.preventDefault(); ev.stopPropagation(); ST.colour = p.getAttribute("data-zpen"); drawStuff(); return; }
    var mk = t.closest("[data-zmark]"); if (mk) { ev.preventDefault(); ev.stopPropagation(); mark(mk.closest(".zc"), mk.getAttribute("data-zmark")); return; }
    var rn = t.closest("[data-zrun]"); if (rn) { ev.preventDefault(); ev.stopPropagation(); runOpen(rn.getAttribute("data-zrun")); return; }
    var bk = t.closest("[data-zbook]"); if (bk) { ev.preventDefault(); ev.stopPropagation(); if (W.FrankBookView) FrankBookView.open(bk.getAttribute("data-zbook")); return; }
    var made = t.closest("[data-zmade]"); if (made) { ev.preventDefault(); ev.stopPropagation(); Z.openMade(made.getAttribute("data-zmade")); return; }
    var lay = t.closest("[data-zlayer]"); if (lay) { ev.preventDefault(); ev.stopPropagation(); ownerLayer(lay); return; }
    var sh = t.closest("[data-zshare]"); if (sh) { ev.preventDefault(); ev.stopPropagation(); shareSheet(sh.getAttribute("data-zshare")); return; }
    var ad = t.closest("[data-zadd]"); if (ad) { ev.preventDefault(); ev.stopPropagation(); addSheet(ad.getAttribute("data-zadd")); return; }
  }, true);

  /* menu acts library.html hands on (menuAct's FrankZero hook) */
  Z.act = function (act, slug) {
    if (act.indexOf("zsort:") === 0) { ST.sort = act.slice(6); drawStuff(); return true; }
    if (act === "znewshelf") return Z.newShelf([]);
    if (act === "zjoin") return joinSheet();
    return null;
  };

  /* ================================================================ Z7 · SHELVES AS ALBUMS
     The shelf itself is library.html's (the album row, the shelf's page, the companion, drag a book onto a book --
     #184/#185). This adds what the plan's row asks beyond those: making one by name, adding books without a drag
     (the phone, a keyboard), a book's outputs opened on its shelf, sharing (a code), joining (the sheet), the
     owner's notes as the shelf's layer for a member, and where the voice lands you. A shelf's group is CONTRIB-1's;
     it sits beside the library record (frank.shelfgroups: {shelfId: {id, code, role, name, owner}}), because the
     record's normaliser keeps only the fields it knows -- SHELVES-FRONT folds it in when it wires the server. */
  var GKEY = "frank.shelfgroups";
  function groups() { try { return JSON.parse(localStorage.getItem(GKEY) || "{}") || {}; } catch (x) { return {}; } }
  function groupOf(id) { return groups()[id] || null; }
  function setGroup(id, g) { var all = groups(); if (g) all[id] = g; else delete all[id]; try { localStorage.setItem(GKEY, JSON.stringify(all)); } catch (x) {} }
  Z.groupOf = groupOf;
  function codeFmt(c) { c = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return c.length > 4 ? c.slice(0, 4) + " " + c.slice(4, 8) : c; }

  Z.newShelf = function (slugs) {
    var s = sheet('<h2 class="zs-t">New shelf</h2><p class="zs-l">A shelf holds books and everything made from them. A book on two shelves is still one book.</p>' +
      '<input class="zs-in" id="zsName" placeholder="Latin, Poems, Philosophy…" autocomplete="off" spellcheck="false" aria-label="The shelf\'s name">' +
      '<p class="zs-why" id="zsWhy" aria-live="polite"></p><div class="zs-row"><button type="button" class="zs-no" data-zclose>Cancel</button><button type="button" class="zs-go" id="zsMake">Make it</button></div>');
    var inp = s.querySelector("#zsName"), go = s.querySelector("#zsMake");
    function make() {
      var name = inp.value.trim(); if (!name) { s.querySelector("#zsWhy").textContent = "Give it a name first."; inp.focus(); return; }
      if (shelves().some(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })) { s.querySelector("#zsWhy").textContent = "There is already a shelf called “" + name + "”."; return; }
      var id = shelfCreate(name); if (!id) return;
      if (slugs && slugs.length) shelfAdd(id, slugs);
      closeSheet(); openShelfPage(id); Z.kept("shelf", "Your new shelf");
    }
    go.addEventListener("click", make);
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); make(); } });
    return true;
  };
  function addSheet(id) {
    var sh = shelves().filter(function (x) { return x.id === id; })[0]; if (!sh) return;
    var pick = {};
    var all = books().filter(function (b) { return !b.merge; });
    var s = sheet('<h2 class="zs-t">Add to ' + e(sh.name) + '</h2><div class="zs-grid" role="listbox" aria-multiselectable="true">' +
      all.map(function (b) { var on = sh.books.indexOf(b.slug) >= 0; return '<button type="button" role="option" class="zs-b" data-slug="' + e(b.slug) + '" aria-selected="' + on + '"' + (on ? ' disabled aria-disabled="true"' : "") + ' aria-label="' + e(b.title || b.slug) + '"><span class="zs-bc">' + cover(b) + '</span><i aria-hidden="true"></i></button>'; }).join("") +
      '</div><div class="zs-row"><button type="button" class="zs-no" data-zclose>Cancel</button><button type="button" class="zs-go" id="zsAdd" disabled>Add</button></div>', "zs-wide");
    var go = s.querySelector("#zsAdd");
    s.querySelector(".zs-grid").addEventListener("click", function (ev) {
      var b = ev.target.closest(".zs-b"); if (!b || b.disabled) return;
      var k = b.getAttribute("data-slug"); pick[k] = !pick[k]; b.setAttribute("aria-selected", pick[k] ? "true" : "false");
      var n = Object.keys(pick).filter(function (x) { return pick[x]; }).length; go.disabled = !n; go.textContent = n ? "Add " + n : "Add";
    });
    go.addEventListener("click", function () { var l = Object.keys(pick).filter(function (x) { return pick[x]; }); if (!l.length) return; shelfAdd(id, l); closeSheet(); repaint(); Z.kept("shelf", "Your shelf"); });
  }
  Z.addSheet = addSheet;
  function shareSheet(id) {
    var sh = shelves().filter(function (x) { return x.id === id; })[0]; if (!sh) return;
    var g = groupOf(id);
    if (g && g.code) return drawShare(sh, g);
    if (FrankAccount.needsAsk("share") && Z.kept("share", "Sharing a shelf")) return;
    var s = sheet('<h2 class="zs-t">Share ' + e(sh.name) + '</h2><p class="zs-l">Making a code…</p>');
    FrankGroups.share(sh).then(function (r) {
      var gg = Object.assign({ role: "owner" }, (r && r.group) || {}); setGroup(id, gg); drawShare(sh, gg); paintShelfPageZ();
    }, function (err) {
      closeSheet(); var p = D.querySelector("#shelf .spage") || D.body;
      fail(p, { kind: "Sharing", what: "This shelf couldn't be shared.", why: err && err.message, fix: "Try again", onFix: function () { this && this.closest && this.closest(".zfail") && this.closest(".zfail").remove(); shareSheet(id); } });
    });
  }
  function drawShare(sh, g) {
    var s = sheet('<h2 class="zs-t">Share ' + e(sh.name) + '</h2><p class="zs-code" aria-label="The code">' + e(codeFmt(g.code)) + "</p>" +
      '<p class="zs-l">Anyone with this code can join. They see these books, and your notes on them as the shelf\'s layer. Never what you looked up.</p>' +
      '<div class="zs-row"><button type="button" class="zs-no" id="zsStop">Stop sharing</button><button type="button" class="zs-go" id="zsCopy">Copy the code</button></div>');
    s.querySelector("#zsCopy").addEventListener("click", function () { var b = this; try { navigator.clipboard.writeText(codeFmt(g.code)); } catch (x) {} b.textContent = "Copied"; });
    s.querySelector("#zsStop").addEventListener("click", function () { FrankGroups.unshare(sh).then(function () { setGroup(sh.id, null); closeSheet(); paintShelfPageZ(); }); });
  }
  Z.shareSheet = shareSheet;
  function joinSheet(prefill) {
    var s = sheet('<h2 class="zs-t">Join a shelf</h2><p class="zs-l">Type the code you were sent. You get the shelf\'s books and its owner\'s notes on them.</p>' +
      '<input class="zs-in zs-codein" id="zsCode" placeholder="K7Q2 M9XA" autocomplete="off" spellcheck="false" autocapitalize="characters" maxlength="9" aria-label="The code">' +
      '<p class="zs-why" id="zsWhy" aria-live="polite"></p><div class="zs-row"><button type="button" class="zs-no" data-zclose>Cancel</button><button type="button" class="zs-go" id="zsJoin" disabled>Join</button></div>');
    var inp = s.querySelector("#zsCode"), go = s.querySelector("#zsJoin"), why = s.querySelector("#zsWhy");
    function tidy() { var v = codeFmt(inp.value); if (inp.value !== v) inp.value = v; go.disabled = v.replace(/ /g, "").length !== 8; }
    inp.addEventListener("input", tidy);
    function join() {
      var code = inp.value.replace(/ /g, ""); if (code.length !== 8) return;
      if (FrankAccount.needsAsk("join")) { closeSheet(); Z.kept("join", "Joining a shelf"); return; }
      go.disabled = true; go.textContent = "Joining…"; why.textContent = "";
      FrankGroups.join(code).then(function (r) {
        var g = Object.assign({ role: "member", code: code }, r.group || {});
        var id = shelfCreate(g.name || "A shared shelf") || shelfCreate((g.name || "A shared shelf") + " (" + ((g.owner && g.owner.name) || "shared") + ")");
        if (!id) { why.textContent = "You already have a shelf with that name."; go.disabled = false; go.textContent = "Join"; return; }
        var have = (r.works || []).filter(function (s2) { return !!bookOf(s2); });
        if (have.length) shelfAdd(id, have);
        if (r.about) libPatch(function (d) { var x = d.shelves.filter(function (y) { return y.id === id; })[0]; if (x) { x.about = x.about || {}; Object.keys(r.about).forEach(function (k) { x.about[k] = String(r.about[k]); }); } });
        g.missing = (r.works || []).filter(function (s2) { return !bookOf(s2); });
        setGroup(id, g); closeSheet(); openShelfPage(id);
      }, function (err) {
        go.disabled = false; go.textContent = "Join";
        why.textContent = ""; var c = fail(s, { kind: "Joining", what: "No shelf opened with that code.", why: (err && err.message) || "Check it with whoever sent it.", fix: "Try again", onFix: function () { c && c.remove(); inp.focus(); } });
      });
    }
    go.addEventListener("click", join);
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); join(); } });
    if (prefill) { inp.value = prefill; tidy(); }
    return true;
  }
  Z.joinSheet = joinSheet;
  /* the shelf's ⋯ (library.html's shelfActionItems hook): Add books… · Share this shelf… / Sharing · code · Stop
     sharing · and for a member, Leave this shelf (a member neither renames nor deletes the owner's shelf) */
  Z.shelfItems = function (id, items) {
    var g = groupOf(id);
    var add = [{ id: "sh:zadd", label: "Add books…" }];
    if (g && g.role === "member") return [{ id: "sh:zleave", label: "Leave this shelf", danger: true }];
    var share = g && g.code ? [{ id: "sh:zshare", label: "Sharing · " + codeFmt(g.code) }, { id: "sh:zunshare", label: "Stop sharing" }] : [{ id: "sh:zshare", label: "Share this shelf…" }];
    return add.concat(share, [{ id: "sep" }], items);
  };
  Z.shelfAct = function (what, id) {
    if (what === "zadd") { addSheet(id); return true; }
    if (what === "zshare") { shareSheet(id); return true; }
    if (what === "zunshare") { var sh = shelves().filter(function (x) { return x.id === id; })[0]; FrankGroups.unshare(sh).then(function () { setGroup(id, null); paintShelfPageZ(); }); return true; }
    if (what === "zleave") { var s2 = shelves().filter(function (x) { return x.id === id; })[0]; FrankGroups.leave(s2).then(function () { setGroup(id, null); closeShelfPage(); shelfDelete(id); }); return true; }
    return null;
  };

  /* ---------------------------------------------------------------- the shelf's page, finished (paintShelfPage hook)
     Under the name: who it is shared with, or whose it is. For a member: the owner's notes as the shelf's layer, on
     by default, one pill to take them away. Under each book: what was made from it, each a press -- "2 highlights"
     opens that book's cards right there (Z5/Z6), a voice's row plays it in the book. */
  var OWNER_ON = {}, OPEN_MADE = {}, CUR = {}, COUNTS = null, COUNTS_ASKED = false;
  W.addEventListener("storage", function () { COUNTS = null; COUNTS_ASKED = false; });
  function paintShelfPageZ() {
    var page = D.querySelector("#shelf .spage"); if (!page) return;
    var id = page.getAttribute("data-shelfpage"), g = groupOf(id), sh = shelves().filter(function (x) { return x.id === id; })[0];
    if (!sh) return;
    page.setAttribute("data-zrole", g ? g.role : "");
    var t = page.querySelector(".sp-t"), sub = page.querySelector(".zsp-g");
    var line = !g ? "" : g.role === "member" ? e(((g.owner && g.owner.name) || "Someone") + "’s shelf · you joined with a code")
      : "Shared · " + e(codeFmt(g.code));
    if (t) {
      if (!sub) { sub = D.createElement("p"); sub.className = "zsp-g"; t.appendChild(sub); }
      var on = OWNER_ON[id] !== false;
      sub.innerHTML = line ? '<span>' + line + "</span>" + (g.role === "member" ? '<button type="button" class="zlayer" data-zlayer="' + e(id) + '" aria-pressed="' + on + '">' + e(((g.owner && g.owner.name) || "Owner") + "’s notes") + "</button>"
        : '<button type="button" class="zlayer zlayer-q" data-zshare="' + e(id) + '">Show the code</button>') : '<button type="button" class="zlayer zlayer-q" data-zshare="' + e(id) + '">Share</button><button type="button" class="zlayer zlayer-q" data-zadd="' + e(id) + '">Add books</button>';
      page.toggleAttribute("data-zowner", g && g.role === "member" && on);
    }
    if (g && g.missing && g.missing.length && !page.querySelector(".zsp-miss")) {
      var ol = page.querySelector(".sp-books"); if (ol) { var li = D.createElement("li"); li.className = "zsp-miss"; li.textContent = g.missing.length === 1 ? "One book on this shelf isn't on this device yet." : g.missing.length + " books on this shelf aren't on this device yet."; ol.appendChild(li); }
    }
    if (!COUNTS && !COUNTS_ASKED) { COUNTS_ASKED = true; FrankStuff.list().then(function (l) { COUNTS = {}; (l || []).forEach(function (b) { var h = 0, n = 0; b.items.forEach(function (it) { if (it.kind === "note") n++; else h++; }); COUNTS[b.slug] = [h, n]; }); paintShelfPageZ(); }, function () { COUNTS = {}; }); }
    page.querySelectorAll(".sp-book").forEach(function (li) {
      var slug = li.getAttribute("data-slug"), made = li.querySelector(".sp-made");
      /* the book's marks, counted from the same record the second door reads (the reader's own count, madeOf, sees
         only the word-id store), as ONE press that opens them here */
      var c = COUNTS && COUNTS[slug];
      if (c && (c[0] || c[1]) && !li.querySelector('[data-k="marks"]')) {
        if (!made) { var none = li.querySelector(".sp-none"); made = D.createElement("ul"); made.className = "sp-made"; if (none) none.replaceWith(made); else (li.querySelector(".sp-side") || li).insertBefore(made, li.querySelector(".sp-about")); }
        made.querySelectorAll('li[data-k="highlight"], li[data-k="note"]').forEach(function (x) { x.remove(); });
        var words = [c[0] ? c[0] + (c[0] === 1 ? " highlight" : " highlights") : "", c[1] ? c[1] + (c[1] === 1 ? " note" : " notes") : ""].filter(Boolean).join(" · ");
        made.insertAdjacentHTML("afterbegin", '<li data-k="marks"><button type="button" class="zmade-b" data-zmade="' + e(slug) + '" aria-expanded="' + !!OPEN_MADE[slug] + '"><i aria-hidden="true">\u25AE</i>' + e(words) + "</button></li>");
      }
      if (made && !made.hasAttribute("data-z")) {
        made.setAttribute("data-z", "");
        made.querySelectorAll("li").forEach(function (x) {
          var k = x.getAttribute("data-k");
          if (k === "render") { x.innerHTML = '<button type="button" class="zmade-b" data-zplay="' + e(slug) + '">' + x.innerHTML + "</button>"; }
        });
      }
      var mb = li.querySelector('[data-k="marks"] button'); if (mb) mb.setAttribute("aria-expanded", OPEN_MADE[slug] ? "true" : "false");
      li.toggleAttribute("data-zcur", CUR[id] === slug);
      var box = li.querySelector(".zmade");
      if (OPEN_MADE[slug]) {
        if (!box) { box = D.createElement("div"); box.className = "zmade"; (li.querySelector(".sp-side") || li).appendChild(box); fillMade(box, slug); }
      } else if (box) box.remove();
      var own = li.querySelector(".zown");
      if (g && g.role === "member" && OWNER_ON[id] !== false) {
        if (!own) { own = D.createElement("div"); own.className = "zown"; (li.querySelector(".sp-side") || li).appendChild(own); fillOwner(own, sh, slug, g); }
      } else if (own) own.remove();
    });
  }
  Z.paintShelfPage = paintShelfPageZ;
  function fillMade(box, slug) {
    box.innerHTML = '<p class="zmade-h">Highlights and notes</p><div class="zst-cards zmade-cards"><p class="zst-wait">…</p></div>';
    FrankStuff.list().then(function (l) {
      var b = (l || []).filter(function (x) { return x.slug === slug; })[0], cards = box.querySelector(".zmade-cards");
      if (!b || !b.items.length) { cards.innerHTML = '<p class="zst-few">Nothing marked in this book yet.</p>'; return; }
      ST.list = ST.list || l;
      cards.innerHTML = b.items.map(function (it) { return cardHTML(Object.assign({ slug: slug, title: titleOf(slug) }, it), false); }).join("");
    }, function (err) { fail(box, { kind: "Your highlights and notes", what: "This book's marks couldn't be read.", why: err && err.message, fix: "Try again", onFix: function () { fillMade(box, slug); } }); });
  }
  function fillOwner(box, sh, slug, g) {
    var who = (g.owner && g.owner.name) || "The owner";
    box.innerHTML = '<p class="zmade-h">' + e(who) + "’s notes</p>";
    FrankGroups.ownerNotes(sh, slug).then(function (l) {
      if (!l || !l.length) { box.insertAdjacentHTML("beforeend", '<p class="zst-few">' + e(who) + " hasn't written on this one yet.</p>"); return; }
      box.insertAdjacentHTML("beforeend", '<div class="zst-cards">' + l.map(function (it) {
        return '<article class="zc zc-own" style="--zink:' + ink(it.colour) + '"><div class="zc-open">' + (it.quote ? '<blockquote class="zc-q">' + e(it.quote) + "</blockquote>" : "") + (it.note ? '<p class="zc-n">' + e(it.note) + "</p>" : "") + '</div><div class="zc-foot"><p class="zc-m">' + e(who) + (it.chapterTitle ? " · " + e(it.chapterTitle) : "") + "</p></div></article>"; }).join("") + "</div>");
    }, function (err) { fail(box, { kind: "The shelf's layer", what: who + "'s notes didn't come.", why: err && err.message, fix: "Try again", onFix: function () { fillOwner(box, sh, slug, g); } }); });
  }
  function ownerLayer(btn) { var id = btn.getAttribute("data-zlayer"); OWNER_ON[id] = OWNER_ON[id] === false; paintShelfPageZ(); }
  Z.openMade = function (slug, on) { OPEN_MADE[slug] = on == null ? !OPEN_MADE[slug] : !!on; paintShelfPageZ(); };
  D.addEventListener("click", function (ev) { var p = ev.target.closest("[data-zplay]"); if (!p || !ev.target.closest("#shelf")) return; ev.preventDefault(); ev.stopPropagation(); openAt(p.getAttribute("data-zplay"), null, { listen: true }); }, true);

  /* ---------------------------------------------------------------- WHERE THE VOICE LANDS YOU (Z7)
     voiceui/commands.js gains four phrases (SHELVES-FRONT); each lands here, over the same records, offline:
       "open the <name> shelf"  -> that shelf's page                "next book" / "previous book" -> the shelf's next
       "my notes on this book"  -> that book's cards, opened         "back to the shelf" -> the shelf's page, cards shut
     The words heard show for a moment in a capsule at the foot -- the voice UI's own last-utterance line. */
  Z.voice = function (said) {
    var s = String(said || "").trim().toLowerCase().replace(/[.!?]$/, ""), m;
    heard(said);
    var page = D.querySelector("#shelf .spage"), id = page && page.getAttribute("data-shelfpage");
    if ((m = /^(?:open )?(?:the |my )?(.+?) shelf$/.exec(s)) && !/^back to/.test(s)) {
      var hit = shelves().filter(function (x) { return x.name.toLowerCase() === m[1] || x.name.toLowerCase().indexOf(m[1]) === 0; })[0];
      if (!hit) return land("none", "No shelf called “" + m[1] + "”.");
      openShelfPage(hit.id); CUR[hit.id] = hit.books[0] || null; paintShelfPageZ(); return land("shelf", hit.id);
    }
    if (!id) return land("none", "Open a shelf first.");
    var sh = shelves().filter(function (x) { return x.id === id; })[0], list = sh ? sh.books.filter(function (b) { return !!bookOf(b); }) : [];
    var at = list.indexOf(CUR[id]);
    if (/^(next|previous) book$/.test(s)) {
      var j = s[0] === "n" ? Math.min(list.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      CUR[id] = list[j]; paintShelfPageZ(); bring(list[j]); return land("book", list[j]);
    }
    if (/^my notes( on (this|the) book)?$/.test(s)) {
      var b = CUR[id] || list[0]; CUR[id] = b; Z.openMade(b, true); bring(b); return land("notes", b);
    }
    if (/^back to the shelf$/.test(s)) {
      Object.keys(OPEN_MADE).forEach(function (k) { OPEN_MADE[k] = false; }); paintShelfPageZ();
      var sc = D.getElementById("shelf"); if (sc) sc.scrollTop = 0; try { (D.scrollingElement || R).scrollTop = 0; } catch (x) {}
      return land("shelf", id);
    }
    return land("none", "Frank didn't catch that.");
  };
  function bring(slug) {
    var li = D.querySelector('#shelf .sp-book[data-slug="' + (W.CSS && CSS.escape ? CSS.escape(slug) : slug) + '"]'); if (!li) return;
    var sc = D.getElementById("shelf"), r = li.getBoundingClientRect();
    /* never scrollIntoView: from inside the canvas's frame it scrolls the canvas too (library.html's own rule) */
    /* under the shelf's head where it stays on screen (a window); where it rides away (the phone), under the island */
    var head = D.querySelector("#shelf .sp-head"), hb = head ? head.getBoundingClientRect().bottom : 96;
    if (hb <= 0) hb = phone() ? 56 : 24;
    var y = r.top - hb - 12;
    if (sc && sc.scrollHeight > sc.clientHeight + 4) sc.scrollTop += y; else { try { (D.scrollingElement || R).scrollTop += y; } catch (x) {} }
  }
  function land(kind, what) { Z.landed = { kind: kind, what: what }; try { D.dispatchEvent(new CustomEvent("frank:voice-landed", { detail: Z.landed })); } catch (x) {} if (kind === "none") heard(null, what); return Z.landed; }
  var HEARD = null, HT = 0;
  function heard(said, answer) {
    if (!HEARD) { HEARD = D.createElement("div"); HEARD.className = "zheard"; HEARD.setAttribute("aria-live", "polite"); D.body.appendChild(HEARD); }
    HEARD.innerHTML = (said ? "<b>“" + e(said) + "”</b>" : "") + (answer ? "<span>" + e(answer) + "</span>" : "");
    HEARD.setAttribute("data-on", ""); clearTimeout(HT); if (!Z.hold) HT = setTimeout(function () { HEARD.removeAttribute("data-on"); }, 2600);
  }

  /* ================================================================ OPENING THE READER AT A PLACE
     The host's door when it has one that takes a chapter (desktop: openReaderAt -- a §6 request; the Mac's
     openReader takes a slug alone), else this page's own address with ?ch= (reader.html honours it, 7 Sep) and
     &listen (the reader starts the device voice on open: a request to the reader's lane). */
  function openAt(slug, ch, o) {
    o = o || {};
    var h = null; try { h = host(); } catch (x) {}
    if (h && typeof h.openReaderAt === "function") { h.openReaderAt(slug, { ch: ch || null, listen: !!o.listen, voice: o.voice || null, notes: o.notes || null }); return "host"; }
    var u = readerUrl(slug) + (ch ? "&ch=" + encodeURIComponent(ch) : "") + (o.listen ? "&listen" : "") + (o.mark ? "&mark=" + encodeURIComponent(o.mark) : "") +
      (o.voice ? "&voice=" + encodeURIComponent(o.voice) : "") + (o.notes ? "&layer=everyone&by=" + encodeURIComponent(o.notes) : "");
    Z.lastOpen = u;
    if (Z.hold) return u;
    try { rememberBook(slug); } catch (x) {}
    location.assign(u); return u;
  }
  Z.openAt = openAt;

  /* ================================================================ Z3 · "WHAT DO YOU READ?"
     After the gate (Books made Frank · Sign in · Not now), once: one question, four answers, one press each. The
     band stays where it is, so a stranger can see where they are. The press makes that answer's shelf (an album,
     Z7), shows it, grows its first book into the page and opens it at its first_content_chapter -- past the title
     page and the preface -- with the device voice asked to start (&listen). Reading needs no account. */
  var FR = null;
  Z.firstRun = function (opts) {
    opts = opts || {};
    return FrankFirstRun.shelves().then(function (m) {
      if (!m || !m.shelves) return false;
      if (!opts.force && FrankFirstRun.answered()) return false;
      drawQuestion(m, opts); return true;
    });
  };
  function drawQuestion(m, opts) {
    if (FR) FR.remove();
    FR = D.createElement("section"); FR.className = "zfr"; FR.setAttribute("aria-label", "What do you read?");
    var order = m.order || Object.keys(m.shelves);
    FR.innerHTML = '<div class="zfr-in"><h1 class="zfr-t">What do you read?</h1><ol class="zfr-a">' + order.map(function (k) {
      var s = m.shelves[k]; if (!s) return "";
      var bs = (s.books || []).filter(function (b) { return b.bundled !== false; });
      return '<li><button type="button" class="zfr-b" data-zanswer="' + e(k) + '"><span class="zfr-w"><b>' + e(s.answer || FrankFirstRun.ANSWERS[k] || k) + "</b>" + (s.line ? "<i>" + e(s.line) + "</i>" : "") + "</span>" +
        '<span class="zfr-c" aria-hidden="true">' + bs.slice(0, 3).map(function (b) { return '<span class="zfr-cv">' + cover(bookOf(b.slug) || { slug: b.slug, title: b.title || b.slug, author: b.author || "" }) + "</span>"; }).join("") + "</span></button></li>";
    }).join("") + '</ol><p class="zfr-f">No account needed to read. You can change your mind any time: it is just a shelf.</p></div>';
    D.body.appendChild(FR);
    /* under the band, whichever edge it is on: a window's band is at the top (under the Mac's tab strip), the phone's at the foot */
    var band = D.querySelector("header .band"), br = band && band.getBoundingClientRect();
    if (!phone() && br && br.height && br.top < innerHeight / 2) FR.style.top = Math.round(br.bottom) + "px";
    FR.addEventListener("click", function (ev) { var b = ev.target.closest("[data-zanswer]"); if (b) choose(m, b.getAttribute("data-zanswer"), opts); });
    var first = FR.querySelector(".zfr-b"); if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (x) {} }, 0);
  }
  function choose(m, key, opts) {
    var s = m.shelves[key]; if (!s) return;
    var bs = (s.books || []).filter(function (b) { return b.bundled !== false && bookOf(b.slug); });
    var opens = bs.filter(function (b) { return b.slug === s.opens; })[0] || bs[0];
    FrankFirstRun.answer(key, bs.map(function (b) { return b.slug; }));
    var name = s.answer || FrankFirstRun.ANSWERS[key] || key, id = null;
    try { var had = shelves().filter(function (x) { return x.name === name; })[0]; id = had ? had.id : shelfCreate(name); if (id) shelfAdd(id, bs.map(function (b) { return b.slug; })); } catch (x) {}
    Z.firstShelf = { key: key, id: id, opens: opens && opens.slug, ch: opens && opens.first_content_chapter && opens.first_content_chapter.id, t0: performance.now() };
    /* the press's moment, for the reader: "the device voice speaks the first sentence within 10 s" is counted from here */
    try { sessionStorage.setItem("frank.firstread.pressed", String(Date.now())); } catch (x) {}
    var ch = opens && opens.first_content_chapter;
    FR.setAttribute("data-step", "shelf");
    FR.innerHTML = '<div class="zfr-in zfr-shelf"><h1 class="zfr-t">' + e(name) + '</h1><p class="zfr-say">' + (opens ? "Opening <b>" + e(titleOf(opens.slug)) + "</b>" + (ch && ch.title ? " at " + e(String(ch.title).replace(/\.$/, "")) : "") + ". It starts reading to you." : "") + "</p>" +
      '<div class="zfr-grid">' + bs.map(function (b, i) { return '<span class="zfr-g' + (i === bs.indexOf(opens) ? " zfr-first" : "") + '" data-slug="' + e(b.slug) + '">' + cover(bookOf(b.slug)) + "</span>"; }).join("") + "</div></div>";
    if (!opens) return;
    if (opts.stop === "shelf") return;
    setTimeout(function () {
      var f = FR.querySelector(".zfr-first"); if (!f) return;
      var r = f.getBoundingClientRect(), sx = innerWidth / r.width, sy = innerHeight / r.height, k = Math.max(sx, sy);
      f.style.transformOrigin = "0 0"; f.style.transition = "transform .42s cubic-bezier(.2,.8,.2,1)";
      f.style.transform = "translate(" + (-r.left + (innerWidth - r.width * k) / 2) + "px," + (-r.top + (innerHeight - r.height * k) / 2) + "px) scale(" + k + ")";
      FR.setAttribute("data-step", "open");
      setTimeout(function () { if (opts.stop === "open") return; openAt(opens.slug, ch && ch.id, { listen: true }); }, 460);
    }, 700);
  }
  Z.chooseFirst = function (key, opts) { return FrankFirstRun.shelves().then(function (m) { if (!FR) drawQuestion(m, opts || {}); choose(m, key, opts || {}); }); };

  /* ================================================================ Z17 · THE CREATOR'S LINK
     One link -- the Library's address with ?read=<book>&voice=<voice>&notes=<person> -- opens that public book the
     way a cover opens (rule 4): full bleed, its title in the capsule, the voice and the notes named under it, READ
     and ▶ in the glass row at the foot. Nothing asks for an account: reading and listening are free (Z1). */
  var LINK = null;
  Z.openLink = function (l) {
    l = l || FrankLink.parse(); if (!l) return Promise.resolve(false);
    return FrankLink.resolve(l).then(function (r) { drawLink(l, r); return true; }, function (err) { drawLink(l, null, err); return false; });
  };
  function drawLink(l, r, err) {
    if (LINK) LINK.remove();
    LINK = D.createElement("section"); LINK.className = "zlink"; LINK.setAttribute("role", "dialog"); LINK.setAttribute("aria-label", r ? r.title : "A link");
    if (!r) {
      LINK.innerHTML = '<div class="zrun-top"><button type="button" class="zg" data-zlinkback aria-label="To the shelf">' + GLYPH.back + '</button><div class="zcap"><b>A Frank book</b><i></i></div><span class="zg-gap"></span></div><div class="zlink-page" id="zlinkBad"></div>';
      D.body.appendChild(LINK);
      fail("#zlinkBad", { kind: "A link", what: "This link's book isn't on Frank's public shelf.", why: (err && err.message) || "It may have been taken down, or the link was cut short.", fix: "See the shelf", onFix: linkClose });
    } else {
      var b = bookOf(r.slug) || { slug: r.slug, title: r.title, author: r.author };
      var miss = r.missing || [];
      var who = l.notes, vn = (r.voice && r.voice.name) || l.voice;
      var lines = [];
      if (l.voice) lines.push(r.voice ? "Read by <b>" + e(vn) + "</b>" + (r.voice.chapters && r.voice.of && r.voice.chapters < r.voice.of ? ", " + r.voice.chapters + " of " + r.voice.of + " chapters" : "")
                                       : e(l.voice) + " hasn't read this book yet, so it reads in this device's voice.");
      if (who) lines.push(r.notes ? "With <b>" + e(r.notes.by || who) + "’s</b> notes" + (r.notes.count ? " on " + r.notes.count + " passages" : "") : e(who) + " has no public notes on this book yet.");
      LINK.innerHTML = '<div class="zrun-top"><button type="button" class="zg" data-zlinkback aria-label="To the shelf">' + GLYPH.back + "</button>" +
        '<div class="zcap"><b>' + e(r.title) + "</b><i>" + e(r.author || "") + '</i></div><span class="zg-gap"></span></div>' +
        '<div class="zlink-page"><div class="zlink-cv">' + cover(b) + "</div>" +
        (lines.length ? '<p class="zlink-l">' + lines.join("<br>") + "</p>" : "") + "</div>" +
        '<div class="zlink-foot"><button type="button" class="zg zlink-play" data-zlinkplay aria-label="Listen">' + GLYPH.play + '</button><button type="button" class="zlink-read" data-zlinkread>Read</button></div>' +
        (FrankAccount.now().state === "browser" ? '<p class="zlink-free">No account needed to read or listen.</p>' : "");
      LINK.setAttribute("data-miss", miss.join(" "));
      D.body.appendChild(LINK);
      LINK.addEventListener("click", function (ev) {
        if (ev.target.closest("[data-zlinkread]")) openAt(r.slug, r.ch || null, { voice: r.voice ? vn : null, notes: r.notes ? (r.notes.by || who) : null });
        if (ev.target.closest("[data-zlinkplay]")) openAt(r.slug, r.ch || null, { listen: true, voice: r.voice ? vn : null, notes: r.notes ? (r.notes.by || who) : null });
      });
    }
    LINK.addEventListener("click", function (ev) { if (ev.target.closest("[data-zlinkback]")) linkClose(); });
  }
  function linkClose() { if (!LINK) return; LINK.remove(); LINK = null; try { var u = new URL(location.href); ["read", "voice", "notes"].forEach(function (k) { u.searchParams.delete(k); }); history.replaceState(null, "", u.pathname + u.search); } catch (x) {} }

  /* ================================================================ at load
     The order is the person's: a creator's link first (it was the reason they came), else the first-run question
     (only once, only where the bundle exists), else the Library as it always was. */
  Z.boot = function () {
    if (FrankLink.parse()) { var tries = 0; (function t() { if (books().length || tries++ > 40) Z.openLink(); else setTimeout(t, 100); })(); return; }
    /* after the gate: it is settings.js's, and it leaves the page when a choice is made */
    if (!D.querySelector(".fr-gate")) { Z.firstRun(); return; }
    var mo = new MutationObserver(function () { if (!D.querySelector(".fr-gate")) { mo.disconnect(); Z.firstRun(); } });
    mo.observe(D.body, { childList: true, subtree: true });
  };
})();
