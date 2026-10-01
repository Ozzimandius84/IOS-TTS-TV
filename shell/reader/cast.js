/* design/reader/cast.js -- THE CAST PICKER FOR A PLAY (Z12, 1 Oct 2026)

   ZERO-TO-ONE §0b C ("plays with a full cast", in 1.0 -- Osca, 29 Sep); ZERO-TO-ONE-FOR-DESIGN Z12: "for a play: its
   characters, a voice for each, one scene heard". The back end is CAST-RENDER (173684f): a speech's voice comes from
   its speaker through render.json `cast`; directions and headings are the narrator's; a speaker left out of the cast
   falls to the narrator. So the picker is that one map, drawn: every character the parse found (book-data.js's `sp`
   cues, counted), a voice each, the narrator for the rest, and a scene heard before anything is rendered.

   THE ONE SEAM. Cast.useSource(read, write):
     read(slug, cb)  -> cb({ narrator: voiceId, cast: { "NORA": voiceId, ... }, voices: [{ id, name, whose }] })
                        whose: "yours" (a voice you made) · "shared" (someone's, shared with consent) · "device" (this
                        Mac's or iPhone's own, free, no cloud). render.json's `cast` + `voice`, and the voice list.
     write(rec)      <- { narrator, cast } on every change: render.json `cast`, as CAST-RENDER reads it.
   The bench's source is a stand-in: the play's own render.json voice as the narrator, three voices of the person's,
   one shared, and the device's; ?state=novoices hands it the narrator alone.

   HEARING A SCENE: the device's own speech (speechSynthesis) reads the first scene's speeches, one voice per
   character -- free, no cloud, the same voice Frank's first run uses -- so a person hears the cast before a GPU
   minute is spent; the row of whoever is speaking is lit. Where the device has no speech, the scene is walked at a
   reading pace and says so. Rendering the whole play with this cast is the Surface's Run (Voice/Surface's). */
(function () {
  "use strict";
  var R = document.documentElement, SRC = null, SRC_WRITE = null, BOOK = null, SLUG = "", REC = null, SHEET = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function title(cue) { return String(cue).toLowerCase().replace(/(^|[\s'’-])\S/g, function (c) { return c.toUpperCase(); }).replace(/^Mrs\b/, "Mrs").replace(/^Mr\b/, "Mr"); }
  function people(book) {
    var n = {}, order = [];
    (book && book.chapters || []).forEach(function (ch) { (ch.blocks || []).forEach(function (b) { if (b.r !== "sp" || !b.t) return; var k = b.t.trim(); if (!/[A-Za-zÀ-ÿ]{2}/.test(k)) return; if (!n[k]) { n[k] = 0; order.push(k); } n[k]++; }); });
    return order.map(function (k) { return { cue: k, name: title(k), lines: n[k] }; }).sort(function (a, b) { return b.lines - a.lines; });
  }
  function isPlay(book) { var p = people(book || BOOK); return p.length >= 2 && p.reduce(function (a, x) { return a + x.lines; }, 0) >= 20; }
  /* the first scene: the speeches of the first chapter that has speeches, up to the first heading or 14 speeches */
  function scene(book) {
    var out = [];
    (book && book.chapters || []).some(function (ch) {
      var who = null, cur = null;
      (ch.blocks || []).some(function (b) {
        if (b.r === "sp") { who = b.t.trim(); cur = { cue: who, text: "" }; out.push(cur); return out.length > 14; }
        if (b.r === "dir" || b.r === "h") return false;
        if (cur && b.t) cur.text += (cur.text ? " " : "") + b.t.replace(/^[.\s]+/, "");
        return false;
      });
      return out.length > 0;
    });
    return out.filter(function (x) { return x.text; }).slice(0, 12);
  }
  function benchSource(slug, cb) {
    var nar = "ashbery";
    fetch("../books/" + encodeURIComponent(slug) + "/render.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; }).then(function (rj) {
      nar = (rj && rj.voice) || nar;
      var voices = [{ id: nar, name: title(nar), whose: "yours" }, { id: "merrill", name: "Merrill", whose: "yours" }, { id: "osca", name: "Osca", whose: "yours" },
                    { id: "sofia", name: "Sofia", whose: "shared" }, { id: "device-1", name: "Daniel", whose: "device" }, { id: "device-2", name: "Karen", whose: "device" }];
      if (/(?:^|[?&])state=novoices\b/.test(location.search) || BENCH_NONE) voices = [{ id: nar, name: title(nar), whose: "yours" }];
      cb({ narrator: nar, cast: (rj && rj.cast) || null, voices: voices });
    });
  }
  var BENCH_NONE = false;
  /* a first proposal where render.json has no cast: the biggest parts get the person's own voices, then shared,
     then the device's; once a voice is used up the narrator reads the rest (CAST-RENDER's own fallback) */
  function propose(rec, ps) {
    if (rec.cast) return rec.cast;
    var pool = rec.voices.filter(function (v) { return v.id !== rec.narrator; }), cast = {};
    ps.forEach(function (p, i) { cast[p.cue] = pool[i] ? pool[i].id : rec.narrator; });
    return cast;
  }
  function voiceOf(id) { var v = (REC && REC.voices || []).filter(function (x) { return x.id === id; })[0]; return v || { id: id, name: title(id), whose: "yours" }; }
  var WHOSE = { yours: "yours", shared: "shared", device: "this device" };

  function press(el, fn) {
    var t = 0;
    el.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (e.button === 0) t = Date.now(); });
    el.addEventListener("pointerup", function (e) { e.stopPropagation(); if (e.button !== 0 || !t) return; t = 0; el.__acted = Date.now(); fn(e); });
    el.addEventListener("click", function (e) { e.stopPropagation(); if (Date.now() - (el.__acted || 0) < 600) return; el.__acted = Date.now(); fn(e); });
  }

  var playing = null;   /* {i, timer} while a scene is heard */
  function stop() { if (!playing) return; clearTimeout(playing.timer); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} playing = null; if (SHEET) SHEET.draw(); }
  function open(o) {
    o = o || {};
    close();
    var doc = document, ps = people(BOOK), sc = scene(BOOK), chosen = {};
    var scrim = doc.createElement("div"); scrim.className = "cx-scrim";
    var sh = doc.createElement("div"); sh.className = "cx"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-label", "Cast");
    function sel(cue, cur) {
      var opts = REC.voices.map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === cur ? " selected" : "") + ">" + esc(v.name) + (v.whose !== "yours" ? " · " + esc(WHOSE[v.whose] || v.whose) : "") + "</option>"; }).join("");
      return '<select class="cx-v" data-cue="' + esc(cue) + '" aria-label="Voice for ' + esc(cue === "*" ? "the narrator" : title(cue)) + '">' + opts + "</select>";
    }
    function draw() {
      var none = REC.voices.length < 2, speaking = playing ? sc[playing.i] : null;
      sh.innerHTML = '<div class="cx-head"><b>Cast</b><span>' + esc(BOOK.title || "") + '</span><button type="button" class="cx-x" aria-label="Close">×</button></div>'
        + (none ? '<p class="cx-say cx-none">You have one voice so far, ' + esc(voiceOf(REC.narrator).name) + '’s, so it reads every part. Give a character its own voice by making one — from a recording, in the Surface — or by using one someone has shared.</p>'
                : '<p class="cx-say">Each character speaks in its own voice; the stage directions are the narrator’s.</p>')
        + '<ul class="cx-list">' + ps.map(function (p) {
            var v = REC.cast[p.cue] || REC.narrator, lit = speaking && speaking.cue === p.cue;
            return '<li' + (lit ? ' class="cx-on"' : "") + '><span class="cx-who"><b>' + esc(p.name) + '</b><i>' + p.lines + " speeches</i></span>"
              + (chosen[p.cue] ? '<span class="cx-mark" aria-hidden="true">●</span>' : '<span class="cx-mark"></span>') + sel(p.cue, v) + "</li>";
          }).join("")
        + '<li class="cx-nar"><span class="cx-who"><b>Narrator</b><i>directions, headings</i></span><span class="cx-mark"></span>' + sel("*", REC.narrator) + "</li></ul>"
        + (speaking ? '<div class="cx-now" role="status"><b>' + esc(title(speaking.cue)) + "</b> " + esc(speaking.text.slice(0, 160)) + (speaking.text.length > 160 ? "…" : "") + "</div>" : "")
        + '<div class="cx-foot">' + (playing ? '<button type="button" class="cx-act cx-stop">Stop</button>' : '<button type="button" class="cx-act cx-hear"' + (sc.length ? "" : " disabled") + ">Hear a scene</button>")
        + '<span class="cx-note">' + (playing ? (playing.silent ? "This device can’t speak here — the scene is walked through at a reading pace." : "In this device’s voices, before anything is made.") : "") + "</span>"
        + '<button type="button" class="cx-verb cx-done">Done</button></div>';
      press(sh.querySelector(".cx-x"), close); press(sh.querySelector(".cx-done"), close);
      sh.querySelectorAll(".cx-v").forEach(function (s) {
        ["pointerdown", "pointerup", "click", "mousedown"].forEach(function (t) { s.addEventListener(t, function (e) { e.stopPropagation(); }); });
        s.addEventListener("change", function () { var cue = s.getAttribute("data-cue"); if (cue === "*") REC.narrator = s.value; else { REC.cast[cue] = s.value; chosen[cue] = 1; } save(); draw(); });
      });
      var hr = sh.querySelector(".cx-hear"); if (hr) press(hr, function () { hear(0); });
      var st = sh.querySelector(".cx-stop"); if (st) press(st, stop);
    }
    function hear(i) {
      if (i >= sc.length) { playing = null; draw(); return; }
      var line = sc[i], ss = window.speechSynthesis, idx = ps.map(function (p) { return p.cue; }).indexOf(line.cue);
      var silent = !ss || !ss.getVoices || !ss.getVoices().length;
      playing = { i: i, silent: silent, timer: 0 }; draw();
      var next = function () { if (playing && playing.i === i) hear(i + 1); };
      if (silent) { playing.timer = setTimeout(next, Math.min(5200, 900 + line.text.split(/\s+/).length * 230)); return; }
      try {
        var u = new SpeechSynthesisUtterance(line.text), vs = ss.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
        if (vs.length) u.voice = vs[Math.max(0, idx) % vs.length];
        u.pitch = [1, 0.8, 1.15, 0.9, 1.25, 0.7][Math.max(0, idx) % 6]; u.rate = 1;
        u.onend = next; u.onerror = next; ss.speak(u);
      } catch (e) { playing.timer = setTimeout(next, 2200); }
    }
    function save() { try { if (SRC_WRITE) SRC_WRITE({ narrator: REC.narrator, cast: JSON.parse(JSON.stringify(REC.cast)) }); } catch (e) {} }
    ["pointerdown", "pointerup", "click", "touchstart", "touchend", "mousedown", "wheel"].forEach(function (t) { sh.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: t === "wheel" || /touch/.test(t) }); scrim.addEventListener(t, function (e) { e.stopPropagation(); }); });
    press(scrim, close);
    sh.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    doc.body.appendChild(scrim); doc.body.appendChild(sh);
    SHEET = { el: sh, scrim: scrim, draw: draw, hear: hear, chosen: chosen };
    function go() { REC.cast = propose(REC, ps); draw(); if (o.then) o.then(SHEET); }
    if (REC) go(); else (SRC || benchSource)(SLUG, function (r) { REC = { narrator: r.narrator, cast: r.cast ? JSON.parse(JSON.stringify(r.cast)) : null, voices: r.voices || [] }; if (SHEET && SHEET.el === sh) go(); });
    return sh;
  }
  function close() { stop(); if (!SHEET) return; var S = SHEET; SHEET = null; S.scrim.remove(); S.el.remove(); }
  window.Cast = {
    mount: function (o) { BOOK = o.book || null; SLUG = o.slug || (BOOK && BOOK.slug) || ""; REC = null; },
    isPlay: function () { return !!BOOK && isPlay(BOOK); },
    people: function () { return people(BOOK); }, scene: function () { return scene(BOOK); },
    open: open, close: close, stop: stop, sheet: function () { return SHEET; },
    useSource: function (read, write) { SRC = read || null; SRC_WRITE = write || null; REC = null; },
    /* the bench's doors to each state (zstates.js) */
    bench: function (none) { BENCH_NONE = !!none; REC = null; }
  };
})();
