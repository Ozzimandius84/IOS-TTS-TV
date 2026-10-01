/* design/reader/colours.js -- THE HIGHLIGHT COLOURS, ANY NUMBER (Z4, 1 Oct 2026)

   Osca, 30 Sep (ZERO-TO-ONE §0b G): "pens are just the existing highlight colours (any number, user-added), no
   glyphs, no new backend -- front end only". Nothing else about highlighting changes: a mark is still one record
   in marginalia.js's store with one `colour`; the bar is still marginalia.js's (the phone's hold) and layers.js's
   (a selection on the Mac and the web). This file only owns THE PALETTE -- which colours the person has, in what
   order, and what each is called -- and the one panel that adds, names and removes them.

   THE COLOUR A MARK CARRIES. The four of today keep their words ("green", "yellow", "red", "pink" -- marginalia's
   MARG_COLOURS, the record's vocabulary, unchanged). An ADDED colour is stored as itself, "#rrggbb", so a mark made
   on the phone paints on the Mac whatever the Mac's palette holds, and a colour taken out of the palette leaves
   every mark made with it exactly as it was. CONTRIB-1 (b018694) already keeps `colour` as the person set it.

   THE ONE SEAM. Colours.useSource(read, write): read(cb) hands the palette record
     { version: 1, colours: [{ colour: "yellow" | "#rrggbb", name: "" }], at: <ms> }
   and write(record) is told of every change. Until the account's sync plugs in, the record is this device's
   (localStorage "frank.colours") -- the same record a source would be handed. The Library's second door (Z5)
   reads the same record through Colours.list() to group a book's highlights by colour and name.

   The look is colours.css. Nothing here draws a mark: marginalia.js and layers.js paint, and ask Colours.cls(c)
   for the class/highlight name and Colours.css() for the rules an added colour needs. */
(function () {
  "use strict";
  var BASE = ["green", "yellow", "red", "pink"];   /* marginalia's MARG_COLOURS, in Osca's order */
  var HEX = { green: "#4a8f3c", yellow: "#d8b431", red: "#c0453a", pink: "#c9558f" };
  var WORD = { green: "Green", yellow: "Yellow", red: "Red", pink: "Pink" };
  /* what the panel offers to add: mid-tones that read on the paper in light and on the warm dark, never so
     pale they vanish under a 26 % tint nor so dark the text over them goes muddy (measured in test-z-reader) */
  var OFFER = ["#4a74c9", "#7a5bc4", "#2e8b8b", "#d9822b", "#8a5a3c", "#5d6b7a", "#3a9bd5", "#8e3f7a", "#b8a04a", "#d0607a", "#6f8f2e", "#8a8580"];
  var KEY = "frank.colours";
  var SRC = null, SRC_WRITE = null, REC = null, LISTEN = [];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function valid(c) { return BASE.indexOf(c) >= 0 || (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)); }
  function norm(c) { return BASE.indexOf(c) >= 0 ? c : String(c).toLowerCase(); }
  function fresh() { return { version: 1, colours: BASE.map(function (c) { return { colour: c, name: "" }; }), at: 0 }; }
  function clean(r) {
    var out = fresh(), seen = {};
    if (r && Array.isArray(r.colours)) {
      out.colours = [];
      r.colours.forEach(function (e) { if (!e || !valid(e.colour)) return; var c = norm(e.colour); if (seen[c]) return; seen[c] = 1; out.colours.push({ colour: c, name: typeof e.name === "string" ? e.name.slice(0, 40) : "" }); });
      BASE.forEach(function (c) { if (!seen[c]) out.colours.splice(BASE.indexOf(c), 0, { colour: c, name: "" }); });   /* the four are always there */
      out.at = Number(r.at) || 0;
    }
    return out;
  }
  function load() {
    if (REC) return REC;
    var raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { raw = null; }
    REC = clean(raw);
    if (SRC) try { SRC(function (r) { REC = clean(r); emit(); }); } catch (e) {}
    return REC;
  }
  function save() {
    REC.at = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(REC)); } catch (e) {}
    try { if (SRC_WRITE) SRC_WRITE(JSON.parse(JSON.stringify(REC))); } catch (e) {}
    emit();
  }
  function emit() { css(); LISTEN.forEach(function (f) { try { f(); } catch (e) {} }); }

  function hex(c) { return HEX[c] || (valid(c) ? norm(c) : HEX.green); }
  function cls(c) { return BASE.indexOf(c) >= 0 ? c : "x" + norm(c).slice(1); }   /* "yellow" or "x4a74c9": the tail of marg-… / ly-hl-… */
  function entry(c) { var L = load().colours; for (var i = 0; i < L.length; i++) if (L[i].colour === norm(c)) return L[i]; return null; }
  function nameOf(c) { var e = entry(c); return (e && e.name) || ""; }
  function label(c) { return nameOf(c) || WORD[c] || "Unnamed colour"; }   /* what a screen reader is told; the screen says only a NAME someone gave */

  /* THE RULES AN ADDED COLOUR NEEDS, in every place the four already have theirs -- the same tints, the same
     two engines (Custom Highlights; the rect layer WebKit's unselectable phone column falls back to) */
  var known = {};
  function css(extra) {
    var list = load().colours.map(function (e) { return e.colour; }).concat(extra || []), add = [];
    list.forEach(function (c) { if (BASE.indexOf(c) >= 0 || known[c]) return; known[c] = 1; add.push(c); });
    if (!add.length && document.getElementById("frank-colours")) return;
    var st = document.getElementById("frank-colours");
    if (!st) { st = document.createElement("style"); st.id = "frank-colours"; (document.head || document.documentElement).appendChild(st); }
    st.textContent += add.map(function (c) {
      var k = cls(c), h = norm(c);
      return "::highlight(marg-" + k + "){ background-color: color-mix(in oklab, " + h + " 28%, transparent); }\n"
        + ".margrects i.marg-" + k + "{ background-color: color-mix(in oklab, " + h + " 28%, transparent); }\n"
        + ".margdot.marg-" + k + "{ background-color: color-mix(in oklab, " + h + " 56%, transparent); }\n"
        + "::highlight(ly-hl-" + k + "){ background-color: color-mix(in srgb, " + h + " 28%, transparent); }\n"
        + ".ly-swatch[data-colour=\"" + h + "\"], .ly-dot[data-colour=\"" + h + "\"], .fc-sw[data-colour=\"" + h + "\"]{ background: " + h + "; }\n";
    }).join("");
  }

  function press(el, fn) {
    var t = 0;
    el.addEventListener("pointerdown", function (e) { if (e.button === 0) t = Date.now(); });
    el.addEventListener("pointerup", function (e) { if (e.button !== 0 || !t) return; t = 0; el.__acted = Date.now(); fn(e); });
    el.addEventListener("click", function (e) { e.stopPropagation(); if (Date.now() - (el.__acted || 0) < 600) return; el.__acted = Date.now(); fn(e); });
    return el;
  }

  /* THE DOTS, for either bar: the palette in its order, then "+" -- the one way to add, name or take one away.
     `kind` is the bar's own dot class ("margdot" for marginalia's, "ly-dot" for the layers' selection bar), so
     each bar keeps its own picture and its own press. */
  function dots(o) {
    css();
    var wrap = document.createElement("span"); wrap.className = "fc-dots" + (o.kind === "margdot" ? " fc-hand" : "");
    load().colours.forEach(function (e) {
      var b = document.createElement("button"); b.type = "button";
      b.className = o.kind === "margdot" ? "margdot marg-" + cls(e.colour) : "ly-dot";
      b.setAttribute("data-colour", e.colour); b.setAttribute("aria-label", label(e.colour));
      if (o.current) b.setAttribute("aria-pressed", String(o.current === e.colour));
      wrap.appendChild(b);
    });
    var plus = document.createElement("button"); plus.type = "button"; plus.className = "fc-plus" + (o.kind === "margdot" ? " margdot" : "");
    plus.setAttribute("aria-label", "Your colours"); plus.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>';
    wrap.appendChild(plus);
    if (o.onAdd) press(plus, function (e) { e.stopPropagation(); o.onAdd(plus); });
    return wrap;
  }

  /* THE PANEL: your colours, each with its name (or none), and the colours to add. One place, three verbs:
     add (press a colour), name (type), take away (×, an added colour only -- the four always stay, and a
     colour taken away leaves its marks as they are). Done closes it; a colour added is the one the next press
     of the bar will use. */
  var PANEL = null;
  function panel(o) {
    o = o || {};
    close();
    css();
    var doc = document, R = doc.documentElement;
    var scrim = doc.createElement("div"); scrim.className = "fc-scrim";
    var p = doc.createElement("div"); p.className = "fc-panel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Your colours");
    var focusOn = o.focus || null;
    function draw() {
      var L = load().colours;
      p.innerHTML = '<div class="fc-head"><b>Your colours</b><button type="button" class="fc-done">Done</button></div>'
        + '<ul class="fc-list">' + L.map(function (e) {
            var base = BASE.indexOf(e.colour) >= 0;
            return '<li data-colour="' + esc(e.colour) + '"><i class="fc-sw" data-colour="' + esc(e.colour) + '" style="background:' + esc(hex(e.colour)) + '"></i>'
              + '<input class="fc-name" type="text" maxlength="40" spellcheck="false" autocomplete="off" value="' + esc(e.name) + '" placeholder="' + (base ? esc(WORD[e.colour]) : "No name") + '" aria-label="Name for ' + esc(label(e.colour)) + '">'
              + (base ? '<span class="fc-keep"></span>' : '<button type="button" class="fc-del" aria-label="Take this colour away">×</button>') + "</li>";
          }).join("") + "</ul>"
        + '<div class="fc-add"><span class="fc-addsay">Add a colour</span><div class="fc-offer">'
        + OFFER.filter(function (c) { return !entry(c); }).map(function (c) { return '<button type="button" class="fc-sw fc-new" data-colour="' + c + '" style="background:' + c + '" aria-label="Add this colour"></button>'; }).join("")
        + '<label class="fc-sw fc-any" aria-label="Any colour"><input type="color" value="#4a74c9"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg></label>'
        + "</div></div>";
      press(p.querySelector(".fc-done"), function () { close(); });
      p.querySelectorAll(".fc-name").forEach(function (inp) {
        var c = inp.parentNode.getAttribute("data-colour");
        inp.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") { inp.blur(); } if (e.key === "Escape") close(); });
        inp.addEventListener("input", function () { var en = entry(c); if (!en) return; en.name = inp.value.trim(); save(); });
        ["pointerdown", "pointerup", "click", "mousedown", "mouseup"].forEach(function (t) { inp.addEventListener(t, function (e) { e.stopPropagation(); }); });
      });
      p.querySelectorAll(".fc-del").forEach(function (b) { press(b, function () { var c = b.parentNode.getAttribute("data-colour"); var L2 = load().colours; for (var i = 0; i < L2.length; i++) if (L2[i].colour === c) L2.splice(i, 1); save(); draw(); }); });
      p.querySelectorAll(".fc-new").forEach(function (b) { press(b, function () { add(b.getAttribute("data-colour")); }); });
      var any = p.querySelector(".fc-any input");
      any.addEventListener("change", function () { add(any.value); });
      ["pointerdown", "pointerup", "click"].forEach(function (t) { any.addEventListener(t, function (e) { e.stopPropagation(); }); });
      if (focusOn) { var f = p.querySelector('li[data-colour="' + focusOn + '"] .fc-name'); focusOn = null; if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 0); }
    }
    function add(c) {
      if (!valid(c)) return; c = norm(c);
      if (!entry(c)) { load().colours.push({ colour: c, name: "" }); save(); }
      focusOn = c; draw();
      var li = p.querySelector('li[data-colour="' + c + '"]'); if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
      if (o.onAdd) o.onAdd(c);
    }
    ["pointerdown", "pointerup", "click", "touchstart", "touchend", "mousedown"].forEach(function (t) {
      p.addEventListener(t, function (e) { e.stopPropagation(); });
      scrim.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    press(scrim, function () { close(); });
    p.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    draw();
    doc.body.appendChild(scrim); doc.body.appendChild(p);
    /* beside the bar that opened it on a window; a sheet at the foot on the phone */
    if (!R.hasAttribute("data-phone") && o.anchor && o.anchor.getBoundingClientRect) {
      var a = o.anchor.getBoundingClientRect(), w = p.offsetWidth, hgt = p.offsetHeight;
      var x = Math.max(8, Math.min(innerWidth - w - 8, a.left + a.width / 2 - w / 2)), y = a.top - hgt - 10;
      if (y < 56) y = Math.min(innerHeight - hgt - 8, a.bottom + 10);
      p.style.left = x + "px"; p.style.top = Math.max(8, y) + "px";
    } else p.setAttribute("data-sheet", "");
    PANEL = { el: p, close: function () { scrim.remove(); p.remove(); if (o.onClose) o.onClose(); } };
    return p;
  }
  function close() { if (PANEL) { var P = PANEL; PANEL = null; P.close(); } }

  window.Colours = {
    BASE: BASE, OFFER: OFFER,
    useSource: function (read, write) { SRC = read || null; SRC_WRITE = write || null; REC = null; load(); },
    list: function () { return load().colours.map(function (e) { return { colour: e.colour, name: e.name, hex: hex(e.colour), label: label(e.colour) }; }); },
    valid: valid, hex: hex, cls: cls, nameOf: nameOf, label: label, css: css, dots: dots, panel: panel, close: close,
    add: function (c, name) { if (!valid(c)) return null; c = norm(c); var e = entry(c); if (!e) { e = { colour: c, name: "" }; load().colours.push(e); } if (name != null) e.name = String(name).slice(0, 40); save(); return e; },
    rename: function (c, name) { var e = entry(c); if (!e) return false; e.name = String(name || "").slice(0, 40); save(); return true; },
    remove: function (c) { if (BASE.indexOf(c) >= 0) return false; var L = load().colours; for (var i = 0; i < L.length; i++) if (L[i].colour === norm(c)) { L.splice(i, 1); save(); return true; } return false; },
    reset: function (rec) { REC = clean(rec || null); save(); },
    on: function (f) { LISTEN.push(f); },
    open: function () { return !!PANEL; }
  };
})();
