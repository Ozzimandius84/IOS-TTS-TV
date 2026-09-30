/* SETTINGS' HEAD, the Library's (DESIGN, 29 Sep; settings-look.css says why). The tab you are on becomes the page's
   name in the book serif, with SETTINGS and the tab's own line under it in the shelf's capitals -- the Library's
   "Library / OPENED 28-29 SEP" shape. It follows the tabs: a press on one rewrites it. No state of its own. */
(function () {
  "use strict";
  function draw() {
    /* the tab whose panel is on screen (the mockup can leave more than one tab marked selected) */
    var panel = [].filter.call(document.querySelectorAll(".set-panel[data-tab]"), function (p) { return !p.hidden && p.offsetParent !== null; })[0];
    var tab = (panel && document.querySelector('.set-tab[data-tab="' + panel.getAttribute("data-tab") + '"]')) || document.querySelector('.set-tab[aria-selected="true"]');
    var main = document.querySelector("main");
    if (!tab || !main) return false;
    var name = (tab.querySelector("span:not(.set-sub)") || tab).textContent.trim();
    var sub = (tab.querySelector(".set-sub") || {}).textContent || "";
    var h = document.querySelector(".look-head");
    if (!h) { h = document.createElement("div"); h.className = "look-head"; h.innerHTML = "<h1></h1><p></p>"; main.insertBefore(h, main.firstChild); }
    /* every write only when it CHANGES: the observer below watches `hidden` and `aria-selected`, and a same-value
       write is still a mutation record -- draw -> record -> draw hung the Mac and web pages (Stranger, 29 Sep) */
    var h1 = h.querySelector("h1"), p = h.querySelector("p");
    if (h1.textContent !== name) h1.textContent = name;
    if (p.textContent) p.textContent = "";   /* said once (Osca, 29 Sep): the tab's name alone */
    if (!p.hidden) p.hidden = true;
    return true;
  }
  var n = 0;
  (function wait() { if (!draw() && n++ < 60) setTimeout(wait, 100); })();
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".set-tab")) setTimeout(draw, 0); }, true);
  new MutationObserver(function (recs) { if (recs.some(function (r) { return !(r.target.closest && r.target.closest(".look-head")); })) draw(); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "hidden"] });
})();
/* TELL FRANK IN SETTINGS (ASKS #134): the web's and the phone's way in, beside the key and the shake -- one row at the
   foot of General, "Tell Frank", a press opens the sheet. The sheet itself is tellfrank.js, loaded here too. */
(function () {
  "use strict";
  var base = "/design/reader/";
  if (!window.TellFrank && !document.querySelector("script[data-tf]")) {
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "tellfrank.css"; document.head.appendChild(l);
    var s = document.createElement("script"); s.src = base + "tellfrank.js"; s.setAttribute("data-tf", ""); document.head.appendChild(s);
  }
  function row() {
    var g = document.querySelector('.set-panel[data-tab="general"]'); if (!g || g.querySelector(".tf-setrow")) return !!g;
    var head = document.createElement("div"); head.className = "set-head"; head.textContent = "Frank";
    var card = document.createElement("div"); card.className = "set-card tf-setrow";
    card.innerHTML = '<div class="set-row"><div class="set-l"><div class="set-name">Tell Frank</div></div>'
      + '<div class="set-c"><button type="button" class="kag-btn">Tell Frank…</button></div></div>';
    card.querySelector("button").addEventListener("click", function () { if (window.TellFrank) TellFrank.open(); });
    g.appendChild(head); g.appendChild(card); return true;
  }
  var n = 0; (function wait() { if (!row() && n++ < 60) setTimeout(wait, 100); })();
})();
/* SETTINGS SEARCHES SETTINGS (ASKS #33, Osca 28 Sep: "when you open settings, the search searches settings"). The
   module had it (43b0bf1) and lost it with the app's revert to FLOAT-HANDS (4b844c1); the design master carries it
   here until EXPORT puts it back in settings/settings.js. A search glyph at the end of the tab strip, and Cmd/Ctrl-K,
   open ONE field; it searches every tab's rows (the name, its grey line, the section it sits under) and a press lands
   on the row: its tab shown, the row in the middle of the window, outlined for a moment. It never opens the Surface. */
(function () {
  "use strict";
  var box = null, list = null, input = null, hits = [], at = 0;
  var GLYPH = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  function rows() {
    var out = [];
    [].forEach.call(document.querySelectorAll(".set-panel[data-tab]"), function (p) {
      var tab = document.querySelector('.set-tab[data-tab="' + p.getAttribute("data-tab") + '"]');
      var tabName = tab ? (tab.querySelector("span:not(.set-sub)") || tab).textContent.trim() : "";
      var head = "";
      [].forEach.call(p.querySelectorAll(".set-head, .set-row, .set-faces-row"), function (el) {
        if (el.classList.contains("set-head")) { head = el.textContent.trim(); return; }
        var name = (el.querySelector(".set-name") || {}).textContent || head; if (!name.trim()) return;   /* a row with no name of its own (the TYPE faces) is its section's */
        var grey = [].map.call(el.querySelectorAll(".set-l small, .opt-main, .set-faces button"), function (s) { return s.textContent; }).join(" ")
          + (/type/i.test(name) ? " font typeface face" : "");
        out.push({ el: el, tab: tab, name: name.trim(), where: tabName + (head && head.trim() !== name.trim() ? " · " + head : ""), hay: (name + " " + grey + " " + head + " " + tabName).toLowerCase() });
      });
    });
    return out;
  }
  function draw() {
    var q = input.value.trim().toLowerCase(); list.innerHTML = ""; at = 0;
    if (!q) { hits = []; return; }
    var words = q.split(/\s+/);
    hits = rows().filter(function (r) { return words.every(function (w) { return r.hay.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return (b.name.toLowerCase().indexOf(q) === 0) - (a.name.toLowerCase().indexOf(q) === 0); }).slice(0, 12);
    if (!hits.length) { var n = document.createElement("div"); n.className = "set-findnone"; n.textContent = "No setting says “" + input.value.trim() + "”."; list.appendChild(n); return; }
    hits.forEach(function (h, i) {
      var b = document.createElement("button"); b.type = "button"; b.className = "set-findhit"; b.setAttribute("role", "option");
      b.innerHTML = "<b></b><small></small>"; b.firstChild.textContent = h.name; b.lastChild.textContent = h.where;
      b.addEventListener("click", function () { land(h); }); list.appendChild(b);
    });
    mark();
  }
  function mark() { [].forEach.call(list.querySelectorAll(".set-findhit"), function (b, i) { b.setAttribute("aria-selected", i === at ? "true" : "false"); }); }
  function land(h) {
    close();
    if (h.tab && h.tab.getAttribute("aria-selected") !== "true") h.tab.click();
    setTimeout(function () {
      try { h.el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { h.el.scrollIntoView(); }
      h.el.classList.add("set-found"); setTimeout(function () { h.el.classList.remove("set-found"); }, 1400);
    }, 60);
  }
  function open(q) {
    if (!box) {
      box = document.createElement("div"); box.className = "set-find"; box.hidden = true;
      box.innerHTML = '<input type="search" spellcheck="false" autocomplete="off" placeholder="Search Settings" aria-label="Search Settings"><div class="set-findlist" role="listbox"></div>'
        + '<button type="button" class="set-findx" aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>';
      document.body.appendChild(box); input = box.querySelector("input"); list = box.querySelector(".set-findlist");
      /* the × stands where the mic stood (the phone; the Surface's own × -- surface.css .sf-esc): a press is close */
      box.querySelector(".set-findx").addEventListener("click", function (e) { e.preventDefault(); close(); });
      input.addEventListener("input", draw);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); at = (at + 1) % hits.length; mark(); }
        else if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); at = (at - 1 + hits.length) % hits.length; mark(); }
        else if (e.key === "Enter" && hits[at]) { e.preventDefault(); land(hits[at]); }
      });
      document.addEventListener("pointerdown", function (e) { if (box && !box.hidden && !box.contains(e.target) && !(e.target.closest && e.target.closest(".set-findbtn"))) close(); }, true);
    }
    /* ONE FIELD (ASKS #168, the phone-search Stranger: "in Settings the pill opens a second 'Search Settings' field
       inside the page that is half-covered by the band's own pill"): while the find is up the page says so as the
       Surface does (html[data-sheet]) and the band steps aside (band.css html[data-phone][data-sheet] .band; the
       canvas mirrors the flag) -- on the phone this field IS the pill, in its place (settings-look.css) */
    document.documentElement.setAttribute("data-sheet", "");
    box.hidden = false; input.value = typeof q === "string" ? q : ""; list.innerHTML = ""; hits = []; if (input.value) draw();
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 0);
  }
  /* × and Esc put everything back: the field hides, the caret leaves it (no keyboard over nothing), the words go,
     the band comes back */
  function close() {
    if (!box) return;
    box.hidden = true;
    if (document.activeElement === input) input.blur();
    input.value = ""; list.innerHTML = ""; hits = [];
    document.documentElement.removeAttribute("data-sheet");
  }
  function glyph() {
    var strip = document.querySelector(".set-tabs"); if (!strip) return false;
    if (strip.querySelector(".set-findbtn")) return true;
    var b = document.createElement("button"); b.type = "button"; b.className = "set-findbtn"; b.setAttribute("aria-label", "Search Settings"); b.title = "Search Settings (⌘K)";
    b.innerHTML = GLYPH; b.addEventListener("click", function () { if (box && !box.hidden) close(); else open(); });
    strip.appendChild(b); return true;
  }
  /* the Mac's Settings window has no band, so its strip keeps the glyph (design: settings.html is the Mac's; at EXPORT the
     Mac window sets html[data-mac-window]); on the web and the phone the band's search is the one search (ASKS #159) */
  if (/\/settings\.html$/.test(location.pathname)) document.documentElement.setAttribute("data-mac-window", "");
  var n = 0; (function wait() { if (!glyph() && n++ < 60) setTimeout(wait, 100); })();
  /* the Mac's settings.js redraws its tab strip after load, and a redraw drops the glyph: put it back, only when missing */
  new MutationObserver(function () { var s = document.querySelector(".set-tabs"); if (s && !s.querySelector(".set-findbtn")) glyph(); })
    .observe(document.body || document.documentElement, { childList: true, subtree: true });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); e.stopPropagation(); open(); }
    /* ONE ESC CLOSES THE FIND FROM ANYWHERE (ASKS #168) -- the caret in the field or not -- and only the find:
       Settings' own Esc never sees it */
    else if (e.key === "Escape" && box && !box.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  window.SettingsFind = { open: open, close: close };
})();
/* THE PACE SLIDER IS A CURVE (ASKS #142, Osca 29 Sep: "keep 80–900, and make the slider a curve: normal speed (300) in
   the middle, everyday speeds given most of the travel, the fast end squeezed to the right"). A second range stands in
   front of Settings' own (which stays in the DOM, is what settings.js reads, and now takes 5-wpm steps so 300 itself
   is reachable -- at step 25 from 80 it read 305). Travel t in 0..1 maps to wpm:
     left half   80 -> 300, even          (t 0 .. .5)
     right half  300 -> 900 as ((t-.5)/.5)^2.2, so 450 wpm is at t .77 and 600-900 is the last eighth
   150-450 wpm, a reader's everyday, is 61 % of the rail. */
(function () {
  "use strict";
  var LO = 80, MID = 300, HI = 900, K = 2.2;
  function wpmOf(t) { t = Math.max(0, Math.min(1, t)); return t <= 0.5 ? LO + (MID - LO) * (t / 0.5) : MID + (HI - MID) * Math.pow((t - 0.5) / 0.5, K); }
  function tOf(w) { w = Math.max(LO, Math.min(HI, w)); return w <= MID ? 0.5 * (w - LO) / (MID - LO) : 0.5 + 0.5 * Math.pow((w - MID) / (HI - MID), 1 / K); }
  function snap(w) { return Math.round(w / 5) * 5; }
  function mount() {
    var real = document.querySelector('input[type="range"][aria-label="Pace"]:not(.pace-curve)');
    if (!real || real.__curve) return !!real;
    real.__curve = 1; real.step = "5";
    var c = document.createElement("input"); c.type = "range"; c.min = "0"; c.max = "1000"; c.step = "1";
    c.className = real.className + " pace-curve"; c.setAttribute("aria-label", "Pace");
    real.setAttribute("aria-hidden", "true"); real.tabIndex = -1; real.style.display = "none";
    real.parentNode.insertBefore(c, real);
    function fromReal() { c.value = String(Math.round(tOf(+real.value || MID) * 1000)); c.setAttribute("aria-valuetext", (+real.value || MID) + " words a minute"); }
    c.addEventListener("input", function () {
      var w = snap(wpmOf(+c.value / 1000)); if (String(w) === real.value) return;
      real.value = String(w); c.setAttribute("aria-valuetext", w + " words a minute");
      real.dispatchEvent(new Event("input", { bubbles: true }));
    });
    c.addEventListener("change", function () { real.dispatchEvent(new Event("change", { bubbles: true })); });
    real.addEventListener("input", fromReal); fromReal();
    window.PaceCurve = { wpmOf: wpmOf, tOf: tOf };
    return true;
  }
  var n = 0; (function wait() { if (!mount() && n++ < 60) setTimeout(wait, 150); })();
  new MutationObserver(function () { var r = document.querySelector('input[type="range"][aria-label="Pace"]:not(.pace-curve)'); if (r && !r.__curve) mount(); })
    .observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
/* GENERAL IS READING, APPEARANCE COMES FIRST, CONTRAST, AND ACCOUNT (ASKS #179 #180 #182 #183 #172, Osca 30 Sep):
     #183 "I think reading can maybe just be general, then another tab is account, where you set your user name,
          and your email and things, your user stuff is there. - you get a set name even as a browser."
     #182 "warmth and light darm should be right there whhen you press settings, in the phone UI you want it right
          where your thumb is ... maybe bring appearence, before voice in general."
     #172 "I'd also like a contrast setting in there."
   settings/settings.js is the module (D26: read, never written), so the design master re-lays its DOM once it is
   built -- every row MOVED, never rebuilt, so each keeps its own handler and settings.js's one paint still paints
   it. General, in order: Appearance (Light / dark · Warmth · Contrast), Type, Interface, Size & spacing, the
   preview, One word, Voice, Frank, and the Mac's extension card. The Reading tab is not drawn (settings-look.css).
   Account is a tab after General: the name (a reader name given at once, even in a browser, and changeable),
   the email, and the sign-in card that sat under Transfer.
   STORES, until EXPORT: prefs.js's normalise() keeps only the fields it knows, so contrast is kept beside it in
   "frank.look" and the account in "frank.account" (localStorage, this origin). EXPORT: `contrast` becomes a prefs
   field (-2..2, default 0, cssVars "--contrast", absent at 0) so every page's own apply() writes it; the account
   needs: a route that holds a name and an email per user (the back end's, written in the ASKS row). */
(function () {
  "use strict";
  var LOOK = "frank.look", ACCT = "frank.account", TAB_KEY = "ttstv.reader.settingsTab";
  function get(k) { try { return JSON.parse(localStorage.getItem(k) || "null") || {}; } catch (e) { return {}; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------------------------------------------------------------- contrast */
  var STOPS = [
    { v: -2, label: "Faint" }, { v: -1, label: "Soft" }, { v: 0, label: "Book", sub: "default" },
    { v: 1, label: "Firm" }, { v: 2, label: "Sharp" }
  ];
  function contrastNow() { var c = Number(get(LOOK).contrast); return STOPS.some(function (s) { return s.v === c; }) ? c : 0; }
  function applyContrast() {
    var c = contrastNow(), root = document.documentElement;
    if (c) root.style.setProperty("--contrast", String(c)); else root.style.removeProperty("--contrast");
    var row = document.querySelector('.set-row[data-look="contrast"]'); if (!row) return;
    [].forEach.call(row.querySelectorAll(".set-ticks button"), function (b) { b.setAttribute("aria-pressed", Number(b.getAttribute("data-value")) === c ? "true" : "false"); });
    var val = row.querySelector(".set-val"), lab = STOPS.filter(function (s) { return s.v === c; })[0].label;
    if (val.textContent !== lab) val.textContent = lab;
  }
  applyContrast();
  window.addEventListener("storage", function (e) { if (e.key === LOOK) applyContrast(); });
  function contrastRow() {
    var row = document.createElement("div"); row.className = "set-row"; row.setAttribute("data-look", "contrast");
    var ticks = STOPS.map(function (s, i) {
      return '<button type="button" data-value="' + s.v + '" aria-pressed="false" style="left:' + (i * 25) + '%"><span class="opt-main">'
        + s.label + '</span>' + (s.sub ? '<span class="sub">' + s.sub + '</span>' : "") + "</button>";
    }).join("");
    row.innerHTML = '<div class="set-l"><div class="set-name">Contrast</div></div><div class="set-c"><div class="set-slider"><i class="set-rail"></i>'
      + '<div class="opts set-ticks" role="group" aria-label="Contrast">' + ticks + '</div></div><div class="set-val"></div></div>';
    /* the row answers its own presses, in CAPTURE, and stops them: settings.js's form listens for any `.opts button`
       and would try to save a field it has no name for */
    row.addEventListener("click", function (e) {
      var track = e.target.closest && e.target.closest(".set-slider"); if (!track) return;
      e.stopPropagation(); e.preventDefault();
      var b = e.target.closest(".set-ticks button");
      if (!b) {
        var best = null, gap = Infinity;
        [].forEach.call(track.querySelectorAll(".set-ticks button"), function (t) { var r = t.getBoundingClientRect(), g = Math.abs((r.left + r.right) / 2 - e.clientX); if (g < gap) { gap = g; best = t; } });
        b = best;
      }
      if (!b) return;
      var look = get(LOOK); look.contrast = Number(b.getAttribute("data-value")); put(LOOK, look); applyContrast();
    }, true);
    return row;
  }

  /* ---------------------------------------------------------------- account */
  var FIRST = ["Quiet", "Amber", "Early", "Patient", "Wandering", "Lamplit", "Slow", "Bright", "Candid", "Idle", "Northern", "Gentle"];
  var LAST = ["Heron", "Reader", "Wren", "Lark", "Owl", "Finch", "Marginalia", "Quill", "Linden", "Kestrel", "Folio", "Rook"];
  function newName() { return FIRST[Math.floor(Math.random() * FIRST.length)] + " " + LAST[Math.floor(Math.random() * LAST.length)]; }
  function account() {
    var a = get(ACCT);
    if (!a.name) { a.name = newName(); a.given = true; put(ACCT, a); }   /* a name at once, even as a guest in a browser */
    return a;
  }
  var ACCT_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="8.4" r="3.8" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M4.6 20.4c.9-3.9 3.9-6 7.4-6s6.5 2.1 7.4 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  function accountPanel(panels) {
    var a = account();
    var p = document.createElement("div"); p.className = "set-panel"; p.setAttribute("data-tab", "account"); p.setAttribute("role", "tabpanel"); p.hidden = true;
    p.innerHTML = '<div class="set-head">You</div><div class="set-card">'
      + '<div class="set-row" data-look="name"><div class="set-l"><div class="set-name">Name</div></div><div class="set-c">'
      + '<input class="kag-in" type="text" autocomplete="nickname" spellcheck="false" aria-label="Name"><button type="button" class="kag-btn" data-look="rename">Another</button></div></div>'
      + '<div class="set-row" data-look="email"><div class="set-l"><div class="set-name">Email</div></div><div class="set-c">'
      + '<input class="kag-in" type="email" autocomplete="email" spellcheck="false" placeholder="you@example.com" aria-label="Email"></div></div>'
      + '</div>';
    var name = p.querySelector('[data-look="name"] input'), mail = p.querySelector('[data-look="email"] input');
    name.value = a.name; mail.value = a.email || "";
    function keep() { var b = get(ACCT); b.name = name.value.trim() || b.name; b.email = mail.value.trim(); b.given = b.given && name.value.trim() === b.name; put(ACCT, b); }
    name.addEventListener("change", function () { if (!name.value.trim()) name.value = get(ACCT).name; keep(); });
    mail.addEventListener("change", keep);
    p.querySelector('[data-look="rename"]').addEventListener("click", function () { name.value = newName(); var b = get(ACCT); b.name = name.value; b.given = true; put(ACCT, b); });
    /* the sign-in: Transfer's "Account" card, moved here with its handlers (Sign in with Google, who you are) */
    var tr = panels.querySelector('.set-panel[data-tab="transfer"]');
    var h = tr && [].filter.call(tr.querySelectorAll(":scope > .set-head"), function (x) { return /^account$/i.test(x.textContent.trim()); })[0];
    if (h && h.nextElementSibling) { var card = h.nextElementSibling; h.textContent = "Sign in"; p.appendChild(h); p.appendChild(card); }
    return p;
  }
  function showAccount(on) {
    var p = document.querySelector('.set-panel[data-tab="account"]'), b = document.querySelector('.set-tab[data-tab="account"]');
    if (!p || !b) return;
    if (on) {
      [].forEach.call(document.querySelectorAll(".set-panel[data-tab]"), function (x) { x.hidden = x !== p; });
      [].forEach.call(document.querySelectorAll(".set-tab[data-tab]"), function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      try { localStorage.setItem(TAB_KEY, "account"); } catch (e) {}
    } else { p.hidden = true; b.setAttribute("aria-selected", "false"); }
  }
  function accountTab() {
    var strip = document.querySelector(".set-tabs"), gen = strip && strip.querySelector('.set-tab[data-tab="general"]');
    if (!gen || strip.querySelector('.set-tab[data-tab="account"]')) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "set-tab"; b.setAttribute("data-tab", "account"); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", "false");
    b.innerHTML = ACCT_ICON + "<span>Account</span><span class=\"set-sub\">you</span>";
    var after = strip.querySelector('.set-tab[data-tab="reading"]') || gen;
    strip.insertBefore(b, after.nextSibling);
  }
  /* a press on any tab: Account is ours (settings.js's showTab has no panel by that name and returns), every other
     one is settings.js's and Account steps aside; Reading, if something presses it, is General */
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".set-tab[data-tab]"); if (!t) return;
    var id = t.getAttribute("data-tab");
    setTimeout(thumbFit, 0);
    if (id === "account") { e.stopPropagation(); showAccount(true); return; }
    showAccount(false);
    if (id === "reading") { e.stopPropagation(); var g = document.querySelector('.set-tab[data-tab="general"]'); if (g) g.click(); }
  }, true);

  /* ---------------------------------------------------------------- general */
  function sections(panel) {
    var out = [], cur = null;
    [].slice.call(panel.children).forEach(function (el) {
      if (el.id === "preview") return;
      if (el.classList.contains("set-head")) { cur = { name: el.textContent.trim(), els: [el] }; out.push(cur); }
      else if (cur) cur.els.push(el);
      else out.push({ name: "", els: [el] });
    });
    return out;
  }
  var ORDER = ["Appearance", "Type", "Interface", "Size & spacing", "#preview", "One word", "Voice", "Frank"];
  function relay() {
    var G = document.querySelector('.set-panel[data-tab="general"]'), R = document.querySelector('.set-panel[data-tab="reading"]');
    if (!G || !R) return false;
    if (G.querySelector(".look-appear")) return true;
    var theme = document.querySelector('.set-row[data-field="theme"]'), warmth = document.querySelector('.set-row[data-field="warmth"]');
    if (!theme || !warmth) return false;
    var preview = document.getElementById("preview");
    var all = sections(G).concat(sections(R));
    var by = {}; all.forEach(function (s) { if (s.name) by[s.name] = s; });
    /* Appearance: light / dark, warmth, contrast -- in one card */
    var oldAp = by.Appearance, paper = by["The paper"];
    var head = document.createElement("div"); head.className = "set-head"; head.textContent = "Appearance";
    var card = document.createElement("div"); card.className = "set-card look-appear";
    card.appendChild(theme); card.appendChild(warmth); card.appendChild(contrastRow());
    var thumb = document.createElement("div"); thumb.className = "look-thumb";
    if (document.documentElement.hasAttribute("data-phone") && preview) thumb.appendChild(preview);
    thumb.appendChild(head); thumb.appendChild(card);
    /* the old Appearance card keeps the interface font, as "Interface"; its note was warmth's, and warmth left */
    if (oldAp) { oldAp.els[0].textContent = "Interface"; oldAp.els = oldAp.els.filter(function (x) { if (x.classList.contains("set-note")) { x.remove(); return false; } return true; }); by.Interface = oldAp; delete by.Appearance; }
    if (paper) paper.els.forEach(function (x) { x.remove(); });
    delete by["The paper"];
    var list = [{ name: "Appearance", els: [thumb] }];
    ORDER.slice(1).forEach(function (n) {
      if (n === "#preview") { if (preview && preview.parentNode !== thumb) list.push({ name: n, els: [preview] }); return; }
      if (by[n]) list.push(by[n]);
    });
    all.forEach(function (s) { if (s.name !== "The paper" && s.name !== "Appearance" && list.indexOf(s) < 0 && s !== oldAp) list.push(s); });
    list.forEach(function (s) { s.els.forEach(function (x) { G.appendChild(x); }); });
    applyContrast();
    /* Account, after General */
    accountTab();
    if (!document.querySelector('.set-panel[data-tab="account"]')) G.parentNode.appendChild(accountPanel(G.parentNode));
    /* the tab to open: Reading remembered is General now; Account remembered is Account */
    var stored = null; try { stored = localStorage.getItem(TAB_KEY); } catch (e) {}
    if (stored === "account") showAccount(true);
    else if (!R.hidden || stored === "reading") { var g = document.querySelector('.set-tab[data-tab="general"]'); if (g) g.click(); }
    thumbFit();
    return true;
  }
  /* the phone's first screen: the block holding the preview and Appearance is as tall as what is left of the
     screen under the head, less the band at the foot -- so the card's foot sits just over the band, where the
     thumb that pressed ⚙ still is */
  function thumbFit() {
    var t = document.querySelector(".look-thumb"); if (!t || t.offsetParent === null) return;   /* measured only while General is on screen */
    if (!document.documentElement.hasAttribute("data-phone")) { t.style.removeProperty("--look-thumb-h"); return; }
    var main = document.querySelector("main"); if (!main) return;
    var top = t.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    var foot = 48 + Math.max(8, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")) || 34) + 16;   /* the band (--band-float 48, sitting on the home strip, band.css #188) and a breath */
    var h = Math.max(0, main.clientHeight - top - foot);
    t.style.setProperty("--look-thumb-h", Math.round(h) + "px");
  }
  window.addEventListener("resize", thumbFit);
  /* and again whenever the page above it changes (the head is drawn after the form; a tab's panel is swapped) */
  new MutationObserver(function () { if (!fitting) { fitting = true; setTimeout(function () { fitting = false; thumbFit(); }, 50); } })
    .observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  var fitting = false;
  /* ...and when the window or the head above main changes size (the canvas sets the phone's insets after load) */
  [300, 1000, 2500].forEach(function (ms) { setTimeout(thumbFit, ms); });   /* a page in a background tab gets no ResizeObserver or frame callbacks */
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { thumbFit(); }); (function watch() { var m = document.querySelector("main"); if (m) ro.observe(m); else setTimeout(watch, 100); })(); }
  var n = 0; (function wait() { if (!relay() && n++ < 80) setTimeout(wait, 100); })();
  /* the Mac's settings.js redraws its tab strip after load: Account comes back if a redraw drops it */
  new MutationObserver(function () { var s = document.querySelector(".set-tabs"); if (s && document.querySelector(".look-appear") && !s.querySelector('.set-tab[data-tab="account"]')) accountTab(); })
    .observe(document.body || document.documentElement, { childList: true, subtree: true });
  window.SettingsLook = { contrast: contrastNow, account: account, relay: relay, thumbFit: thumbFit };
})();
/* THE WEB SAYS ONLY WHAT THE WEB CAN DO (ASKS #187, the web Stranger 30 Sep; POLISH 5). On the web edition
   (html[data-web], what settings.js's host sets for a browser with no studio) the rows written for the Mac and the
   phone are ABSENT, not greyed: the browser extension's developer steps, its port line and Reveal in Finder; the
   Studio sidebar hotkey; Transfer's Studio network, the door's pairing and iCloud (not built, and Apple's); the
   Account's "no Google client ... built into Studio" line and its dead Google button. Sign in on the web is what the
   web really does today: you are a guest with the Account's name, and your books stay in this browser -- said in
   one line, the same line the first run's Sign in says (design/library/library.html). The save line's "Not
   mirrored to the SSD: no studio behind this page" reads "Saved in this browser." The Mac and the phone keep every
   row. EXPORT: settings.js builds none of these rows when TTSTVHost.isWeb (the extension card, hk "studio",
   tr-dest lan/icloud, tr-doorcard) and its Account card draws the guest row; its commit() status says the same. */
(function () {
  "use strict";
  var R = document.documentElement;
  function web() { return R.hasAttribute("data-web") && !R.hasAttribute("data-phone"); }
  function off(el) { if (el && !el.hasAttribute("data-look-off")) el.setAttribute("data-look-off", ""); }
  function headOf(card) { var h = card && card.previousElementSibling; return h && h.classList.contains("set-head") ? h : null; }
  function name() { try { return (JSON.parse(localStorage.getItem("frank.account") || "null") || {}).name || ""; } catch (e) { return ""; } }
  var GUEST = function () { return "Reading as " + (name() || "a guest") + ", a guest. Your books stay in this browser."; };
  function sweep() {
    if (!web()) return;
    /* the extension card: its head says SEND ARTICLES FROM YOUR BROWSER; the card holds Reveal in Finder */
    [].forEach.call(document.querySelectorAll(".set-card"), function (c) {
      var t = c.textContent;
      if (/Reveal in Finder|Load the extension unpacked|listening on port/.test(t)) { off(c); off(headOf(c)); }
    });
    [].forEach.call(document.querySelectorAll(".set-head"), function (h) { if (/send articles from your browser/i.test(h.textContent)) { off(h); var n = h.nextElementSibling; if (n && /set-card|set-note/.test(n.className)) off(n); } });
    /* hotkeys: a row whose name says Studio */
    [].forEach.call(document.querySelectorAll(".hk-row"), function (r) { var n = r.querySelector(".set-name"); if (n && /studio/i.test(n.textContent)) off(r); });
    /* Transfer: the Studio network, iCloud, and the door */
    off(document.querySelector('.tr-dest[data-dest="lan"]'));
    off(document.querySelector('.tr-dest[data-dest="icloud"]'));
    var door = document.querySelector(".tr-doorcard"); if (door) { off(door); off(headOf(door)); }
    /* Account: the guest, said once, in place of the Mac's line and the dead button */
    var acct = document.querySelector('.set-panel[data-tab="account"] .tr-acct');
    if (acct) {
      [].forEach.call(acct.children, function (c) { if (!c.classList.contains("look-guest")) off(c); });
      var g = acct.querySelector(".look-guest");
      if (!g) { g = document.createElement("div"); g.className = "set-l look-guest"; g.innerHTML = '<div class="set-name">Guest</div><small></small>'; acct.appendChild(g); }
      var s = g.querySelector("small"), line = GUEST(); if (s.textContent !== line) s.textContent = line;
    }
    /* the save line */
    var st = document.getElementById("status");
    if (st && /Not mirrored to the SSD/.test(st.textContent)) st.textContent = "Saved in this browser.";
  }
  var busy = false;
  function soon() { if (busy) return; busy = true; setTimeout(function () { busy = false; sweep(); }, 0); }
  sweep();
  new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-web"] });
  document.addEventListener("change", function (e) { if (e.target.closest && e.target.closest('[data-look="name"]')) sweep(); }, true);
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest('[data-look="rename"]')) setTimeout(sweep, 0); }, true);
  window.addEventListener("storage", function (e) { if (e.key === "frank.account") sweep(); });
})();
