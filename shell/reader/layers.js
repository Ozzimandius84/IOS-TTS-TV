/* ENGINE · THE LAYERS -- Book · Mine · Everyone · Voice over ONE text
   · picture: layers.css (design/reader/layers.css is the master)
   · mounted by: the reader, one call -- Layers.mount(page, {band, book,
     notes, pub, marks, layer, onLayer})
   · THE MARKS COME FROM STUDIO (MARKS-ROUTE, 27 Sep): `marks` is the
     body of GET /marks/<slug>/<cid> (studio/marks.py -- marks.json's
     record, or the by:model plan built on demand), fetched with
     Layers.marks(url, cb); the bench hands the fixture (layers-samples.js
     MARKS, the same shape) instead. `marksUrl` makes the Re-run sheet
     WRITE: one POST per changed chunk {chunk:{id,...}, rerun} and the
     last press carries rerun:true, which queues the chapter as the
     surface's Run does. Without it (the bench) the sheet only pretends.
   · drawn 27 Sep 2026 (wave 10 round 3, LAYERS-DESIGN; PROMPTS/LAYERS.md).

   THE RULE THAT SHAPES IT: the text is written once, and a layer is an
   attribute on the page (`data-layer`) plus classes on the words -- every
   thing a layer draws is a background, an underline, a box-shadow, or an
   element positioned ABSOLUTELY in the margin. Nothing a layer does is in
   the text's flow, so switching never moves a word (the proof is the first
   word's rectangle, printed under each stage).

   The switch is one <div class="layers" role="radiogroup"> with four
   <button role="radio">s. On the Mac and the web it stands in the band's
   right cluster; on the phone the band's pill SHOWS the layer and a strip
   under the safe area carries the same control. */
(function () {
  var R = document.documentElement;
  var LAYERS = [['book', 'Book'], ['mine', 'Mine'], ['everyone', 'Everyone'], ['voice', 'Voice']];
  /* THE LAYERS' GLYPHS (Osca, 28 Sep: "the layers in the phone, again GLYPH only,
     no words") -- one 16-grid at stroke 1.25, band.js's rule; the word stays the
     button's name (aria-label). Book: an open book; Mine: a pencil (what you
     wrote); Everyone: two people; Voice: a wave. */
  var LGLYPH = {
    book: '<path d="M8 4.5C6.5 3.5 4.5 3 2.5 3.2v9c2-.2 4 .3 5.5 1.3 1.5-1 3.5-1.5 5.5-1.3v-9C11.5 3 9.5 3.5 8 4.5zM8 4.5v9"/>',
    mine: '<path d="M3 13l.9-3.4L10.4 3.1l2.5 2.5-6.5 6.5z"/><path d="M9.2 4.3l2.5 2.5"/>',
    everyone: '<circle cx="6" cy="5.5" r="2"/><path d="M2.5 13c.5-2.3 1.9-3.5 3.5-3.5s3 1.2 3.5 3.5"/><circle cx="11.2" cy="6.2" r="1.6"/><path d="M10.6 9.6c1.5 0 2.6 1 2.9 3"/>',
    voice: '<path d="M2.5 8h0M5 6v4M7.5 3.5v9M10 5.5v5M12.5 7v2"/>'
  };
  function lglyph(id) { return '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">' + LGLYPH[id] + '</svg>'; }
  var VIS = ['private', 'friends', 'group', 'public', 'on request'];
  var VISWORD = { 'private': 'Private', 'friends': 'Friends', 'group': 'Group', 'public': 'Public', 'on request': 'On request' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function wid(sid, n) { return sid + '.w' + String(n).padStart(3, '0'); }
  function ordOf(id) { return parseInt(id.slice(-3), 10); }
  function sidOf(id) { return id.replace(/\.w\d{3}$/, ''); }
  /* PRESS. A control here answers pointerup (a primary press that did not
     move) and, for the keyboard, click -- one act per press. Why not click
     alone: with the editor mounted (design/editor/editor.js bindCanvas), a
     click on any selectable element is the editor's -- it SELECTS -- and
     never reaches the control; a pointerup does. So in the bench the same
     control can be edited (click) and used (press), and in the product the
     two are the same press. */
  function press(el, fn) {
    var t = 0;
    el.addEventListener('pointerdown', function (e) { if (e.button === 0) t = Date.now(); });
    el.addEventListener('pointerup', function (e) { if (e.button !== 0 || !t) return; t = 0; el.__acted = Date.now(); fn(e); });
    el.addEventListener('click', function (e) { if (Date.now() - (el.__acted || 0) < 600) return; el.__acted = Date.now(); fn(e); });
    return el;
  }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  function mount(page, o) {
    o = o || {};
    var phone = R.hasAttribute('data-phone');
    var layer = o.layer || 'book', state = o.state || '';
    var marks = o.marks || { windows: {}, chapters: {} }, notes = (o.notes || []).slice(), pub = o.pub || { counts: {}, contributions: [] };
    var marksUrl = o.marksUrl || null;   /* studio's /marks/<slug>/<cid>; null in the bench */
    var sel = null;       /* the selected run: {sid, a, b} word ordinals */
    var overrides = {};   /* sid -> {window?, direction?, reading?} edited this session */
    var byId = {};

    /* ---- the text, written ONCE ---------------------------------------- */
    page.innerHTML = '';
    page.setAttribute('data-layer', layer);
    if (state) page.setAttribute('data-state', state);
    var strip = null, rider = null;
    if (phone) { strip = h('div', 'lstrip'); page.appendChild(strip); if (window.Band && Band.ride) rider = Band.ride(strip); }   /* the strip rides the page (Osca, 28 Sep) */
    var read = h('div', 'read');
    var text = h('div', 'text');
    var margin = h('div', 'margin');
    read.appendChild(text); read.appendChild(margin); page.appendChild(read);
    var head = h('h1', 'chap', esc(o.book.chapter.title.replace(/\.$/, '')));
    text.appendChild(head);
    o.book.paras.forEach(function (p) {
      var el = h('p', 'para'); el.setAttribute('data-id', p.id);
      p.s.forEach(function (s, i) {
        var sp = h('span', 's'); sp.setAttribute('data-id', s.id);
        s.t.split(/\s+/).forEach(function (w, j) {
          if (j) sp.appendChild(document.createTextNode(' '));
          var ws = h('span', 'w', esc(w)); ws.setAttribute('data-id', wid(s.id, j + 1));
          byId[wid(s.id, j + 1)] = ws; sp.appendChild(ws);
        });
        if (i) el.appendChild(document.createTextNode(' '));
        el.appendChild(sp);
      });
      text.appendChild(el);
    });
    var words = Array.prototype.slice.call(text.querySelectorAll('.w'));

    /* ---- the switch ---------------------------------------------------- */
    function switchEl() {
      var g = h('div', 'layers'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Layer');
      LAYERS.forEach(function (l) {
        var b = h('button', null, lglyph(l[0]));   /* GLYPHS on every host (Osca: glyphs over words, you'd have to read AND translate a word) */ b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-layer', l[0]); b.setAttribute('aria-label', l[1]);
        b.setAttribute('aria-checked', l[0] === layer ? 'true' : 'false');
        press(b, function () { setLayer(l[0]); });
        g.appendChild(b);
      });
      return g;
    }
    var sw = switchEl();
    if (phone) strip.appendChild(sw);
    else if (o.band) { var right = o.band.querySelector('.band-right'); right.insertBefore(sw, right.firstChild); }
    else page.insertBefore(sw, read);

    function setLayer(l) {
      layer = l; state = ''; sel = null; msel = null;
      page.setAttribute('data-layer', l); page.removeAttribute('data-state');
      sw.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-layer') === l ? 'true' : 'false'); });
      pill();
      paint();
      if (o.onLayer) o.onLayer(l);
    }
    /* THE TOP OF THE PHONE IS A SWIPE (Osca, 28 Sep: "in the top layer, on the phone
       ... I want to swipe between these bars, if I swipe in that area of the screen,
       with or without them being visible ... people will expect it"). A horizontal
       swipe that STARTS in the strip's zone -- the top two taps (88) of the page,
       whether the strip is showing or has ridden away -- moves one layer: left =
       the next, right = the one before, no wrap. The strip comes back to show where
       you landed. A swipe must be mostly sideways (|dx| > 40 and > 1.5 |dy|), so a
       scroll that starts up there stays a scroll. */
    if (phone) (function () {
      var x0 = null, y0 = 0, ZONE = 88, MIN = 40;
      page.addEventListener('pointerdown', function (e) {
        var top = page.getBoundingClientRect().top;
        x0 = (e.clientY - top < ZONE) ? e.clientX : null; y0 = e.clientY;
      });
      page.addEventListener('pointerup', function (e) {
        if (x0 == null) return;
        var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
        if (Math.abs(dx) < MIN || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
        var ids = LAYERS.map(function (l) { return l[0]; }), i = ids.indexOf(layer) + (dx < 0 ? 1 : -1);
        if (i < 0 || i >= ids.length) return;
        var ls = page.querySelector('.lstrip'); if (ls) ls.dispatchEvent(new Event('ride:show'));   /* the strip comes back to show where you landed */
        setLayer(ids[i]);
      });
    })();
    function setState(s) { state = s; if (s) page.setAttribute('data-state', s); else page.removeAttribute('data-state'); paint(); window.dispatchEvent(new CustomEvent('layers:state', { detail: { layer: layer, state: s } })); }
    /* the phone's pill shows the layer (rule 3: a control shows its state) */
    function pill() {
      if (!phone || !o.band) return;
      var i = o.band.querySelector('.band-pill i'); if (!i) return;
      var name = LAYERS.filter(function (l) { return l[0] === layer; })[0][1];
      i.textContent = o.book.chapter.title;   /* never the layer's name: the strip above already says it (Osca, 28 Sep) */
    }
    pill();

    /* ---- helpers over words -------------------------------------------- */
    /* a RUN of words is wrapped in one inline span (words and the spaces between
       them) so its paint is one band across the line breaks -- an inline span
       with no padding, border or font of its own costs the text nothing (the
       proof below is what says so). Unwrapped on every repaint. */
    function wrapRun(ws, cls) {
      if (!ws.length) return null;
      var a = ws[0], z = ws[ws.length - 1];
      if (a.parentNode !== z.parentNode) { ws.forEach(function (w) { w.classList.add(cls); }); return null; }
      var r = h('span', 'run ' + cls); a.parentNode.insertBefore(r, a);
      var n = a; while (n) { var nx = n.nextSibling; r.appendChild(n); if (n === z) break; n = nx; }
      return r;
    }
    function unwrapAll() {
      text.querySelectorAll('.run').forEach(function (r) { var p = r.parentNode; while (r.firstChild) p.insertBefore(r.firstChild, r); p.removeChild(r); });
      text.normalize();
    }
    function range(ids) { var a = byId[ids[0]], b = byId[ids[1]]; if (!a || !b) return []; return words.slice(words.indexOf(a), words.indexOf(b) + 1); }
    function clearMarks() {
      unwrapAll();
      text.querySelectorAll('.s').forEach(function (sp) { sp.removeAttribute('data-win'); sp.removeAttribute('style'); sp.classList.remove('pub'); });
      words.forEach(function (w) { w.className = 'w'; w.removeAttribute('data-win'); w.removeAttribute('style'); w.removeAttribute('title'); });
      margin.innerHTML = '';
      page.querySelectorAll('.rerun, .scrim, .sheet, .ly-share, .ly-scrim').forEach(function (e) { e.remove(); });
      text.querySelectorAll('.para').forEach(function (p) { p.classList.remove('empty'); });
    }
    function topOf(el) { var r = el.getBoundingClientRect(), b = read.getBoundingClientRect(); var z = (window.Editor && Editor.zoom()) || 1; return (r.top - b.top) / z; }
    /* the margin's cards stack: each sits at its sentence's top, or below the one before it */
    function place() {
      var y = 0, gap = 8;
      /* in the order of the text, whatever order they were made in: the legend (y 0) first */
      var kids = Array.prototype.slice.call(margin.children).sort(function (a, b) { return parseFloat(a.getAttribute('data-y') || '0') - parseFloat(b.getAttribute('data-y') || '0'); });
      kids.forEach(function (c) { margin.appendChild(c); });
      kids.forEach(function (c) {
        var want = parseFloat(c.getAttribute('data-y') || '0');
        var top = Math.max(want, y); c.style.top = top + 'px'; y = top + c.offsetHeight + gap;
      });
      read.style.minHeight = Math.max(text.offsetHeight, y) + 'px';
    }
    function card(cls, anchorEl, html) {
      var c = h('div', 'card ' + cls, html); c.setAttribute('data-y', String(topOf(anchorEl))); margin.appendChild(c); return c;
    }
    function firstOf(ids) { return byId[ids[0]]; }

    /* ---- MINE: notes and highlights, fully exposed, editable ------------ */
    function paintMine() {
      var mine = notes.filter(function (n) { return state !== 'empty'; });
      mine.forEach(function (n) {
        var ws = range(n.anchor.ids); wrapRun(ws, 'hl hl-' + (HLC.indexOf(n.colour) >= 0 ? n.colour : 'yellow'));   /* in the reader's own colour (ASKS #178) */
        if (n.kind === 'highlight') return;
        var c = card('note kind-' + n.kind, firstOf(n.anchor.ids),
            '<div class="body" contenteditable="true" spellcheck="false">' + esc(n.body) + '</div>'
          + '<div class="foot"><button type="button" class="vis" data-vis="' + esc(n.visibility) + '" aria-label="Visibility">' + esc(VISWORD[n.visibility]) + '</button>'
          + '<button type="button" class="verb ly-share-b" aria-label="Share">' + glyphShare() + 'Share</button>'
          + '<span class="when">' + esc(when(n.made_at)) + '</span></div>');
        press(c.querySelector('.vis'), function (ev) { visMenu(ev.currentTarget, n); });
        press(c.querySelector('.ly-share-b'), function () { shareMine(n); });
        c.querySelector('.body').addEventListener('input', function (ev) { n.body = ev.currentTarget.textContent; });
      });
      if (!mine.length) card('hint', text.querySelector('.s'), 'Nothing of yours here yet. Select words to mark them.');
      if (msel) selCard();
      place();
    }
    /* ADDING ONE (ASKS #178): press a word, release on another -- the run is
       selected, and its card offers the four colours, a note, and Share */
    var msel = null;
    function selCard() {
      var ws = words.filter(function (w) { var id = w.getAttribute('data-id'); return sidOf(id) === msel.sid && ordOf(id) >= msel.a && ordOf(id) <= msel.b; });
      if (!ws.length) { msel = null; return; }
      wrapRun(ws, 'selrun mselrun');
      var exact = ws.map(function (w) { return w.textContent; }).join(' ').replace(/[,.;:]$/, '');
      var c = card('run msel', ws[0], '<div class="who">' + esc(exact) + '</div><div class="foot">' + dots('') + '<button type="button" class="verb ly-bnote">Note</button><button type="button" class="verb ly-bshare" aria-label="Share">' + glyphShare() + 'Share</button><button type="button" class="verb close">Cancel</button></div>');
      function make(kind, colour) {
        var rec = { id: 'm' + Date.now().toString(36), kind: kind, colour: colour || 'yellow', visibility: 'private', made_at: new Date().toISOString(),
          anchor: { ids: [ws[0].getAttribute('data-id'), ws[ws.length - 1].getAttribute('data-id')], quote: { exact: exact } } };
        if (kind === 'note') rec.body = '';
        notes.push(rec); wrote('note', rec); msel = null; paint();
        if (kind === 'note') { var b = margin.querySelector('.card.note:last-of-type .body'); var all = margin.querySelectorAll('.card.note .body'); all.forEach(function (x) { if (!x.textContent) b = x; }); if (b) setTimeout(function () { try { b.focus({ preventScroll: true }); } catch (e) {} }, 0); }
        return rec;
      }
      c.querySelectorAll('.ly-dot').forEach(function (b) { press(b, function () { make('highlight', b.getAttribute('data-colour')); }); });
      press(c.querySelector('.ly-bnote'), function () { make('note'); });
      press(c.querySelector('.ly-bshare'), function () { share(page, { mine: false, quote: exact }, shareCtx()); });
      press(c.querySelector('.close'), function () { msel = null; paint(); });
    }
    function shareCtx(extra) { var B = o.book || {}; var x = { title: B.title, author: B.author, chapter: B.chapter ? String(B.chapter.title).replace(/^CHAPTER\s+\d+\.\s*/i, '').replace(/\.$/, '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }) : '', work: pub.work_id || B.slug, slug: B.slug, origin: location.origin, onClose: function () { paint(); } };
      for (var k in (extra || {})) x[k] = extra[k]; return x; }
    function shareMine(n) {
      share(page, { mine: true, visibility: n.visibility, quote: n.anchor.quote.exact, body: n.body }, shareCtx({ onVis: function (v) {
        n.visibility = v; wrote('visibility', n);
        var at = pub.contributions.map(function (p) { return p.id; }).indexOf(n.id);
        if (v === 'public' && at < 0) pub.contributions.push({ id: n.id, kind: n.kind === 'highlight' ? 'note' : n.kind, author: 'you', made_at: n.made_at.slice(0, 10), body: n.body || '', anchor: n.anchor, replies: 0 });
        if (v !== 'public' && at >= 0) pub.contributions.splice(at, 1);
      } }));
    }
    function visMenu(btn, n) {
      var old = btn.parentNode.querySelector('.menu'); if (old) { old.remove(); return; }
      var m = h('div', 'menu'); m.setAttribute('role', 'menu');
      VIS.forEach(function (v) { var b = h('button', v === n.visibility ? 'on' : '', esc(VISWORD[v])); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', v === n.visibility ? 'true' : 'false');
        press(b, function () { n.visibility = v; btn.textContent = VISWORD[v]; btn.setAttribute('data-vis', v); m.remove(); }); m.appendChild(b); });
      btn.parentNode.appendChild(m);
    }
    function when(iso) { var d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

    /* ---- EVERYONE: the public tree, read-only, reply / quote ----------- */
    function paintEveryone() {
      Object.keys(pub.counts).forEach(function (sid) {
        var s = text.querySelector('.s[data-id="' + sid + '"]'); if (!s) return;
        var c = pub.counts[sid];
        s.classList.add('pub');
        var n = h('div', 'count'); n.setAttribute('data-y', String(topOf(s.querySelector('.w'))));
        n.innerHTML = '<b>' + c.highlights + '</b> readers' + (c.notes ? ' · ' + c.notes + ' notes' : '');
        margin.appendChild(n);
      });
      pub.contributions.forEach(function (p) {
        var own = p.author === 'you';
        var ws = range(p.anchor.ids); wrapRun(ws, own ? 'hl' : 'pubrun');
        var verbs = state === 'signed-out'
          ? '<span class="signin">Sign in to reply</span>'
          : '<button type="button" class="verb">Reply' + (p.replies ? ' <i>' + p.replies + '</i>' : '') + '</button><button type="button" class="verb">Quote</button>';
        var pc = card('pub kind-' + p.kind + (own ? ' own' : ''), firstOf(p.anchor.ids),
            '<div class="who"><i class="ly-av" aria-hidden="true">' + (own ? 'Y' : initial(p.author)) + '</i>' + (own ? 'You' : esc(p.author)) + '<span class="when">' + esc(p.made_at) + '</span></div>'
          + '<div class="body">' + esc(p.body) + '</div><div class="foot">' + verbs + (state === 'signed-out' ? '' : '<button type="button" class="verb ly-share-b" aria-label="Share">' + glyphShare() + 'Share</button>') + '</div>');
        var sb = pc.querySelector('.ly-share-b'); if (sb) press(sb, function () { share(page, { mine: own, visibility: 'public', quote: p.anchor.quote.exact, body: p.body, author: own ? '' : p.author }, shareCtx()); });
      });
      place();
    }

    /* ---- VOICE: the passage painted by window; legend; run; re-run ----- */
    /* marks.json (voice/marks.py, version 1): one chapter's chunks; the windows by id.
       A window's colour is the layer's own, one token per window in the file's order. */
    var COLOURS = WINCOL;   /* never a green (ASKS #178): the baseline window is the paper's grey */
    var chap = (marks.chapters || {})[o.book.chapter.id] || { chunks: {} };
    var WINS = Object.keys(marks.windows || {}).map(function (id, i) { var w = marks.windows[id]; return { id: id, name: w.name, clip: w.ref_clip, kind: w.kind, colour: w.colour || COLOURS[i % COLOURS.length] }; });
    marks.chunks = chap.chunks; marks.engine = chap.engine || ''; marks.voice = WINS.length ? WINS[0].voice || WINS[0].id.split('/')[0] : '';
    function winOf(sid) { var ov = overrides[sid] || {}, m = marks.chunks[sid] || {}; return ov.window || m.window; }
    function dirOf(sid) { var ov = overrides[sid] || {}, m = marks.chunks[sid] || {}; return ov.direction || m.direction || null; }
    function win(id) { return WINS.filter(function (w) { return w.id === id; })[0]; }
    /* the homographs in a chunk: the layer's table over the chunk's words; the mark is {word, ipa} */
    function homographsOf(sid) { var out = {}; words.forEach(function (w) { var id = w.getAttribute('data-id'); if (sidOf(id) !== sid) return;
      var t = w.textContent.replace(/[^\w]/g, '').toLowerCase(); if (marks.homographs && marks.homographs[t]) out[id.slice(-4)] = { word: w.textContent.replace(/[^\w]/g, ''), readings: marks.homographs[t] }; }); return out; }
    /* what this chapter's engine can HEAR (68ca09f): a direction is noted, not yet heard, on every
       engine; a reading is heard only where the engine takes phonemes */
    var CAPS = (marks.caps || {})[marks.engine] || { instruct: false, phoneme_wrap: false };
    var DIR_NOTE = CAPS.instruct ? '' : 'noted · not yet heard';
    var RD_NOTE = CAPS.phoneme_wrap ? 'heard on ' + marks.engine : 'carried · ' + marks.engine + ' takes no phonemes';
    function readingOf(sid, k) { var ov = (overrides[sid] || {}).reading, m = (marks.chunks[sid] || {}).reading; var r = ov || m; return r && r.k === k ? r : null; }
    function changed() { return Object.keys(overrides); }
    /* a fresh GET/POST body: the chapter's rows and the windows, as the route answered */
    function take(body) { var c = (body.chapters || {})[o.book.chapter.id]; if (!c) return;
      marks.windows = body.windows || marks.windows; marks.chapters = body.chapters; marks.caps = body.caps || marks.caps; marks.homographs = body.homographs || marks.homographs; marks.directions = body.directions || marks.directions;
      chap = c; marks.chunks = c.chunks || {}; marks.engine = c.engine || marks.engine;
      WINS = Object.keys(marks.windows || {}).map(function (id, i) { var w = marks.windows[id]; return { id: id, name: w.name, clip: w.ref_clip, kind: w.kind, colour: w.colour || COLOURS[i % COLOURS.length] }; }); }
    function paintVoice() {
      if (state === 'no-audio') { card('hint', text.querySelector('.s'), 'No audio yet for this chapter — nothing to correct until it is read.'); place(); return; }
      /* the legend: the book's windows, from marks.json */
      var lg = h('div', 'legend'); lg.setAttribute('data-y', '0');
      lg.innerHTML = '<div class="lhead">Windows <span>' + esc(marks.voice) + ' · ' + esc(marks.engine) + '</span></div>'
        + WINS.map(function (w) { return '<button type="button" class="row" data-win="' + w.id + '"><i class="sw" style="--win:var(' + w.colour + ')"></i><b>' + esc(w.name) + '</b><span>' + esc(w.clip.split('/').pop()) + '</span></button>'; }).join('')
        + (changed().length ? '<button type="button" class="act rerun-open">Re-run · ' + changed().length + ' chunk' + (changed().length > 1 ? 's' : '') + '</button>' : '');
      margin.appendChild(lg);
      lg.querySelectorAll('.row').forEach(function (b) { press(b, function () { if (sel) pick('window', b.getAttribute('data-win')); }); });
      var ro = lg.querySelector('.rerun-open'); if (ro) press(ro, function () { setState('sheet'); });
      text.querySelectorAll('.s').forEach(function (s) {
        var sid = s.getAttribute('data-id'), w = win(winOf(sid)); if (!w) return;
        s.setAttribute('data-win', w.id); s.style.setProperty('--win', 'var(' + w.colour + ')');
        s.querySelectorAll('.w').forEach(function (ws) { ws.setAttribute('data-win', w.id); });
        var d = dirOf(sid);
        if (d) { var tag = h('div', 'dir', '<i>' + esc(d) + '</i>' + (DIR_NOTE ? '<span class="realised">' + esc(DIR_NOTE) + '</span>' : '')); tag.setAttribute('data-y', String(topOf(s.querySelector('.w')))); tag.setAttribute('aria-label', 'Direction: ' + d); margin.appendChild(tag); }
        var hg = homographsOf(sid);
        Object.keys(hg).forEach(function (k) { var ws = byId[sid + '.' + k]; if (!ws) return; var r = readingOf(sid, k);
          ws.classList.add('rd'); ws.setAttribute('title', r ? '/' + r.ipa + '/ (marked)' : hg[k].word + ': ' + hg[k].readings.map(function (x) { return '/' + x.ipa + '/ ' + x.sense; }).join(' · ') + " — the model's reading, unmarked"); if (r) ws.classList.add('rd-set'); });
      });
      if (state === 'selected' && !sel) { sel = { sid: 'c003.p0030.s01', a: 1, b: 5 }; }
      if (sel) runCard();
      if (state === 'sheet' || state === 'queued') sheet();
      place();
    }
    function selWords() { return words.filter(function (w) { var id = w.getAttribute('data-id'); return sidOf(id) === sel.sid && ordOf(id) >= sel.a && ordOf(id) <= sel.b; }); }
    function runCard() {
      var ws = selWords(); ws.forEach(function (w) { w.classList.add('sel'); }); wrapRun(ws, 'selrun');
      var sid = sel.sid, m = marks.chunks[sid] || {}, cur = winOf(sid), d = dirOf(sid);
      var hg = homographsOf(sid), rdKeys = Object.keys(hg).filter(function (k) { var n = parseInt(k.slice(1), 10); return n >= sel.a && n <= sel.b; });
      var html = '<div class="who">' + ws.map(function (w) { return esc(w.textContent); }).join(' ') + '<span class="when">' + esc(sid) + '</span></div>'
        + '<div class="mark"><label>Window</label><div class="sws">' + WINS.map(function (w) { return '<button type="button" class="sw' + (w.id === cur ? ' on' : '') + '" data-win="' + w.id + '" style="--win:var(' + w.colour + ')" aria-label="' + esc(w.name) + '" aria-pressed="' + (w.id === cur) + '"></button>'; }).join('') + '<span>' + esc(win(cur).name) + '</span></div></div>'
        + '<div class="mark"><label>Direction</label><div class="sws"><button type="button" class="pick dirpick">' + (d ? esc(d) : '<i>' + esc(m.inferred || 'inferred') + '</i>') + '</button>' + (d && DIR_NOTE ? '<span class="realised">' + esc(DIR_NOTE) + '</span>' : '') + '</div></div>'
        + rdKeys.map(function (k) { var r = hg[k], set = readingOf(sid, k);
            return '<div class="mark reading"><label>Reading</label><div class="rds"><b>' + esc(r.word) + '</b>'
              + '<button type="button" class="rd-opt' + (!set ? ' on' : '') + '" data-k="' + k + '" data-i="-1"><i>as the model reads it</i></button>'
              + r.readings.map(function (x, i) { return '<button type="button" class="rd-opt' + (set && set.ipa === x.ipa ? ' on' : '') + '" data-k="' + k + '" data-i="' + i + '">/' + esc(x.ipa) + '/ <span>' + esc(x.sense) + '</span></button>'; }).join('') + '<span class="realised">' + esc(RD_NOTE) + '</span></div></div>'; }).join('')
        + '<div class="foot"><button type="button" class="act rerun-open"' + (changed().length ? '' : ' disabled') + '>Re-run…</button><button type="button" class="verb close">Done</button></div>';
      var c = card('run', ws[0], html);
      c.querySelectorAll('.sw').forEach(function (b) { press(b, function () { pick('window', b.getAttribute('data-win')); }); });
      press(c.querySelector('.dirpick'), function (ev) { dirMenu(ev.currentTarget, sid); });
      c.querySelectorAll('.rd-opt').forEach(function (b) { press(b, function () {
        var k = b.getAttribute('data-k'), i = parseInt(b.getAttribute('data-i'), 10); var ov = overrides[sid] = overrides[sid] || {};
        if (i < 0) { delete ov.reading; if (!Object.keys(ov).length) delete overrides[sid]; } else ov.reading = { word: hg[k].word, ipa: hg[k].readings[i].ipa, k: k };
        paint(); }); });
      press(c.querySelector('.rerun-open'), function () { setState('sheet'); });
      press(c.querySelector('.close'), function () { sel = null; paint(); });
    }
    function pick(kind, v) { var sid = sel.sid, base = (marks.chunks[sid] || {})[kind]; var ov = overrides[sid] = overrides[sid] || {};
      if (v === base || (kind === 'direction' && !v)) delete ov[kind]; else ov[kind] = v; if (!Object.keys(ov).length) delete overrides[sid]; paint(); }
    function dirMenu(btn, sid) {
      var old = btn.parentNode.querySelector('.menu'); if (old) { old.remove(); return; }
      var m = h('div', 'menu'); m.setAttribute('role', 'menu'); var cur = dirOf(sid);
      [['', 'Inferred (' + ((marks.chunks[sid] || {}).inferred || '') + ')']].concat(marks.directions.map(function (d) { return [d, d]; })).forEach(function (d) {
        var b = h('button', d[0] === (cur || '') ? 'on' : '', esc(d[1])); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', d[0] === (cur || '') ? 'true' : 'false');
        press(b, function () { pick('direction', d[0]); }); m.appendChild(b); });
      btn.parentNode.appendChild(m);
    }
    function sheet() {
      var n = changed().length || 1, scrim = h('div', 'scrim'), sh = h('div', 'rerun'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Re-run');
      var list = changed().map(function (sid) { var ov = overrides[sid]; return '<li><span>' + esc(sid) + '</span><i>' + [ov.window ? 'window → ' + esc(win(ov.window).name) : '', ov.direction ? 'direction → ' + esc(ov.direction) : '', ov.reading ? 'reading → ' + esc(ov.reading.word) + ' /' + esc(ov.reading.ipa) + '/' : ''].filter(Boolean).join(' · ') + '</i></li>'; }).join('');
      if (state === 'queued') sh.innerHTML = '<div class="shead">Queued</div><p>' + n + ' chunk' + (n > 1 ? 's' : '') + ' on ' + esc(marks.engine) + ' · ' + esc(marks.voice) + '. The rest of the chapter keeps its audio.</p><div class="foot"><button type="button" class="verb close">Done</button></div>';
      else sh.innerHTML = '<div class="shead">Re-run</div><ul>' + (list || '<li><span>' + esc(sel ? sel.sid : '') + '</span><i>no change yet</i></li>') + '</ul><p>' + n + ' chunk' + (n > 1 ? 's' : '') + ' on ' + esc(marks.engine) + ' · ' + esc(marks.voice) + '. Only these are read again.</p>'
        + '<div class="foot"><button type="button" class="act go">Re-run passage</button><button type="button" class="verb go">Re-run chapter</button><button type="button" class="verb close">Cancel</button></div>';
      page.appendChild(scrim); page.appendChild(sh);
      sh.querySelectorAll('.go').forEach(function (b) { press(b, function () {
        if (!marksUrl) { setState('queued'); return; }
        /* the route: one POST per changed chunk, the last one carrying rerun -- so
           marks.json changes one row per press and the chapter is queued once */
        var ids = changed(), i = 0; sh.querySelectorAll('.go, .close').forEach(function (x) { x.disabled = true; });
        (function next() {
          if (i >= ids.length) return;
          var sid = ids[i], ov = overrides[sid], body = { chunk: { id: sid }, rerun: i === ids.length - 1 };
          if (ov.window) body.chunk.window = ov.window; if (ov.direction) body.chunk.direction = ov.direction;
          if (ov.reading) body.chunk.reading = { word: ov.reading.word, ipa: ov.reading.ipa };
          i += 1;
          fetch(marksUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
              if (res.j && res.j.chapters) take(res.j);
              if (!res.ok && !(res.j && res.j.written)) { fail((res.j && res.j.error) || ('HTTP error')); return; }
              if (i < ids.length) { next(); return; }
              var rr = res.j && res.j.rerun; if (rr && rr.error) { fail(rr.error); return; }
              overrides = {}; setState('queued');
            })
            .catch(function (e) { fail(String(e && e.message || e)); });
        })();
        function fail(why) { var pp = sh.querySelector('p'); if (pp) pp.textContent = why; sh.querySelectorAll('.go, .close').forEach(function (x) { x.disabled = false; }); }
      }); });
      press(sh.querySelector('.close'), function () { if (state === 'queued') { overrides = {}; sel = null; } setState(''); });
      press(scrim, function () { setState(''); });
    }
    /* selecting a run: press on a word, release on another, in the Voice layer */
    var down = null;
    text.addEventListener('pointerdown', function (ev) { if (layer !== 'voice' && layer !== 'mine') return; var w = ev.target.closest('.w'); if (!w) return; down = w.getAttribute('data-id'); ev.preventDefault(); });
    text.addEventListener('pointerup', function (ev) { if ((layer !== 'voice' && layer !== 'mine') || !down) return; var w = ev.target.closest('.w'); var up = w ? w.getAttribute('data-id') : down;
      if (sidOf(up) !== sidOf(down)) up = down; var a = ordOf(down), b = ordOf(up), run = { sid: sidOf(down), a: Math.min(a, b), b: Math.max(a, b) }; down = null;
      if (layer === 'mine') msel = run; else sel = run; paint(); });

    function paint() {
      clearMarks();
      if (layer === 'mine') paintMine();
      else if (layer === 'everyone') paintEveryone();
      else if (layer === 'voice') paintVoice();
      else read.style.minHeight = '';
      if (window.ResizeObserver && !paint.ro) { paint.ro = new ResizeObserver(function () { place(); }); paint.ro.observe(text); }
    }
    paint();
    return { setLayer: setLayer, setState: setState, layer: function () { return layer; }, overrides: function () { return overrides; }, sel: function () { return sel; }, select: function (s) { sel = s; paint(); } };
  }
  /* ======================================================================
     THE LAYERS ARE A WHOLE EXPERIENCE, ON EVERY PAGE (ASKS #178, 30 Sep).
     Osca: "in design, it should be a full user experience, because we're
     designing the whole front end, not waiting for the back end to get here.
     Where we plug in we can. So for example in the share mode ... I want to
     see all the other layers." His picture: the phone reader, Mine chosen,
     and a card saying "You have none yet". So a page that writes its OWN
     text (the reader: page.js's p.line, one text node each) gets the layers
     drawn over that text too -- not only the bench's c003 master.

     HOW IT DRAWS WITHOUT TOUCHING THE TEXT. Marginalia's rule (marginalia.js):
     nothing is wrapped, no class is added to a word. Every mark is a CSS
     Custom Highlight over a Range found by the record's QUOTE SELECTOR
     (ANCHOR-0 {exact, prefix, suffix}) -- which is exactly how a real
     Contribution is anchored, so the real record plugs straight in. Cards
     float in a fixed layer beside the column (Mac, web) or in a sheet above
     the foot (phone), following their passage as the page scrolls.

     THE ONE SEAM. Layers.useSource(read, write): read(slug, cb) hands the
     layers {notes, pub, marks, sentences}; write(kind, record) is told of
     every change a person makes (a highlight, a note, a reply, a share).
     Until a lane plugs in, the DESIGN source reads layers-samples.js (the
     fixtures, marked as such) and only for its own book, and only on a
     /design/ page -- a shipped page with no source is a truly empty book,
     and reader.html's "none yet" card is what it shows. */
  var SRC = null, SRC_WRITE = null;
  function useSource(read, write) { SRC = read || null; SRC_WRITE = write || null; }
  /* THE DEVICE KEEPS YOUR MARKS UNTIL A SOURCE IS PLUGGED IN (ASKS #187, 30 Sep). The web Stranger: "no way to
     make a highlight/note on a laptop -- the Mine layer can never fill". A book with no source and no fixture was
     `null`, so a selection had nowhere to put a highlight. Now it is this device's own record of your marks on that
     book -- localStorage `frank.mine.<slug>`, the same {id, kind, colour, visibility, made_at, body, anchor} a
     source would be handed -- and every change is written back to it. A source (useSource) still wins. */
  var LOCAL = {}, LKEY = 'frank.mine.';
  function devStore(slug) {
    var notes = [];
    try { notes = JSON.parse(localStorage.getItem(LKEY + slug) || '[]') || []; } catch (e) { notes = []; }
    if (!Array.isArray(notes)) notes = [];
    LOCAL[slug] = notes;
    return { device: true, book: { slug: slug, title: document.title.replace(/ · Frank$/, '').replace(/ — .*$/, '') }, sentences: {}, notes: notes,
             pub: { counts: {}, contributions: [] }, marks: { windows: {}, chapters: {} } };
  }
  function wrote(kind, rec) {
    /* a mark taken away here is taken away from the page's own record too (marginalia.js listens) */
    if (kind === 'remove' && rec && rec.id) { try { document.dispatchEvent(new CustomEvent('layers:remove', { detail: { id: rec.id } })); } catch (e) {} }
    try { if (SRC_WRITE) { SRC_WRITE(kind, rec); return; } } catch (e) {}
    Object.keys(LOCAL).forEach(function (slug) { try { localStorage.setItem(LKEY + slug, JSON.stringify(LOCAL[slug])); } catch (e) {} });
  }
  /* THE PHONE'S HAND WRITES TO MINE TOO (#191, 1 Oct). The iOS Stranger: "I tapped yellow, the bar closed, and
     the pen layer still said 'You have none yet'." The hold's bar is marginalia.js's, and its record
     (`ttstv.reader.marginalia.<slug>`, word ids, synced) is not this layer's (`frank.mine.<slug>`, quotes) --
     so every mark made by thumb was saved where Mine never looked. marginalia.js now hands each mark here as
     this layer's own record, under the SAME id, so Mine lists it and a Remove on either side removes both. */
  function keep(slug, rec) {
    if (!slug || !rec || !rec.id) return false;
    var list = LOCAL[slug] || devStore(slug).notes;
    var i = -1; for (var k = 0; k < list.length; k++) if (list[k].id === rec.id) { i = k; break; }
    if (i >= 0) list[i] = rec; else list.push(rec);
    try { localStorage.setItem(LKEY + slug, JSON.stringify(list)); } catch (e) {}
    try { if (SRC_WRITE) SRC_WRITE('note', rec); } catch (e) {}
    if (LAST && LAST.refresh) LAST.refresh();
    return true;
  }
  function unkeep(slug, id) {
    if (!slug || !id) return false;
    var list = LOCAL[slug] || devStore(slug).notes, hit = false;
    for (var k = list.length - 1; k >= 0; k--) if (list[k].id === id) { list.splice(k, 1); hit = true; }
    if (!hit) return false;
    try { localStorage.setItem(LKEY + slug, JSON.stringify(list)); } catch (e) {}
    if (LAST && LAST.refresh) LAST.refresh();
    return true;
  }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function scriptBase() { var s = document.querySelector('script[src*="layers.js"]'); return s ? s.src.replace(/layers\.js.*$/, '') : ''; }
  function loadJs(urls, done) { var i = 0; (function next() { if (i >= urls.length) { done(); return; } var s = document.createElement('script'); s.src = urls[i++]; s.onload = next; s.onerror = next; document.head.appendChild(s); })(); }
  function sourceOf(slug, cb) {
    if (SRC) { SRC(slug, cb); return; }
    var W = window;
    function pack() {
      var B = W.__LAYERS_BOOK; if (!B || typeof NOTES === 'undefined' || B.slug !== slug) return null;
      var sent = {}; B.paras.forEach(function (p) { p.s.forEach(function (s) { sent[s.id] = s.t; }); });
      return { fixture: true, book: B, sentences: sent, notes: clone(NOTES), pub: clone(PUBLIC), marks: clone(MARKS) };
    }
    if (W.__LAYERS_BOOK && typeof NOTES !== 'undefined') { cb(pack() || devStore(slug)); return; }
    if (!/\/design\//.test(location.pathname)) { cb(devStore(slug)); return; }
    loadJs([scriptBase() + 'layers-fixture.js', scriptBase() + 'layers-samples.js'], function () { cb(pack() || devStore(slug)); });
  }

  /* ---- shared pieces: the same drawing in the bench and over the reader -- */
  var HLC = ['yellow', 'red', 'pink', 'green'];   /* marginalia's four (MARG_COLOURS), the reader's own vocabulary; yellow first */
  var WHO = { 'private': 'Only you', 'friends': 'Your friends', 'group': 'Your group', 'public': 'Everyone on Frank', 'on request': 'Anyone who asks you' };
  function initial(name) { return esc(String(name || '?').replace(/^[^A-Za-z]+/, '').charAt(0).toUpperCase() || '?'); }
  function ago(iso) { var d = new Date(iso); if (isNaN(d)) return String(iso || ''); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function dots(cur) { return '<span class="ly-dots">' + HLC.map(function (c) { return '<button type="button" class="ly-dot" data-colour="' + c + '" aria-label="' + c + '" aria-pressed="' + (c === cur) + '"></button>'; }).join('') + '</span>'; }
  function glyphShare() { return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2.5M5 5.5l3-3 3 3M4 8H3v5.5h10V8h-1"/></svg>'; }

  /* THE SHARE MODE: one sheet, three questions -- what (the passage, as the
     card it will be), who can see it, and how it leaves (a link, a card).
     A note of yours carries the who; someone else's public note, or a bare
     passage, is shared as it stands. Making a note Everyone's puts it in the
     Everyone layer as yours (the accent edge). One loud thing: Copy link. */
  function share(host, item, ctx) {
    var doc = host.ownerDocument || document, old = doc.querySelector('.ly-share'); if (old) old.__close();
    var mine = item.mine, vis = item.visibility || 'private';
    var scrim = h('div', 'ly-scrim'), sh = h('div', 'ly-share'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Share');
    var cap = esc(ctx.title || '') + (ctx.author ? ' · ' + esc(ctx.author) : '') + (ctx.chapter ? ' · ' + esc(ctx.chapter) : '');
    /* the link opens THIS book, where it is read now (#187: a /w/ route no host serves yet was a link to nothing) */
    var link = String(location.href).split('#')[0] + '#q=' + encodeURIComponent((item.quote || '').slice(0, 60));
    var NATIVE = !!(navigator.share && (!navigator.canShare || navigator.canShare({ text: 'x', url: link })));
    function draw() {
      sh.innerHTML = '<div class="ly-sh-head"><b>Share</b><button type="button" class="ly-x" aria-label="Close">×</button></div>'
        + '<figure class="ly-sh-card"><blockquote>“' + esc(item.quote || '') + '”</blockquote>'
        + (item.body ? '<p>' + esc(item.body) + '</p>' : '')
        + '<figcaption>' + cap + (item.author && !mine ? '<span>' + esc(item.author) + '’s note</span>' : item.body ? '<span>Your note</span>' : '') + '</figcaption></figure>'
        + (mine ? '<div class="ly-sh-who"><div class="ly-seg" role="radiogroup" aria-label="Who can see it">'
            + ['private', 'friends', 'group', 'public'].map(function (v) { return '<button type="button" role="radio" data-vis="' + v + '" aria-checked="' + (v === vis) + '">' + { 'private': 'Me', friends: 'Friends', group: 'Group', 'public': 'Everyone' }[v] + '</button>'; }).join('')
            + '</div><p class="ly-sh-say">' + esc(WHO[vis] || WHO['private']) + ' can see this' + (vis === 'public' ? ', in the Everyone layer of this book.' : '.') + '</p></div>' : '')
        + '<div class="ly-sh-acts"><button type="button" class="ly-act ly-copy">Copy link</button><button type="button" class="ly-verb ly-card-out">' + (NATIVE ? 'Share…' : 'Share as a card') + '</button></div>'
        + '<p class="ly-sh-link" aria-live="polite">' + esc(link.replace(/^https?:\/\//, '')) + '</p>';
      press(sh.querySelector('.ly-x'), close);
      sh.querySelectorAll('.ly-seg button').forEach(function (b) { press(b, function () { vis = b.getAttribute('data-vis'); if (ctx.onVis) ctx.onVis(vis); draw(); }); });
      press(sh.querySelector('.ly-copy'), function () {
        try { if (navigator.clipboard) navigator.clipboard.writeText(link).catch(function () {}); } catch (e) {}
        sh.setAttribute('data-done', 'link'); sh.querySelector('.ly-sh-link').textContent = 'Link copied — it opens this passage, in this book.';
        wrote('share', { how: 'link', link: link, item: item });
      });
      press(sh.querySelector('.ly-card-out'), function () {
        /* the system's own share sheet where the host has one (Safari, the Mac and iPhone apps, Chrome on a phone):
           the passage, the book and the link, handed to it whole */
        if (NATIVE) {
          var said = '“' + (item.quote || '') + '”' + (item.body ? '\n\n' + item.body : '') + '\n— ' + [ctx.title, ctx.author].filter(Boolean).join(', ');
          try { navigator.share({ title: ctx.title || 'Frank', text: said, url: link }).then(function () { sh.setAttribute('data-done', 'card'); sh.querySelector('.ly-sh-link').textContent = 'Shared.'; wrote('share', { how: 'system', item: item }); }, function () {}); } catch (e) {}
          return;
        }
        sh.setAttribute('data-done', 'card'); sh.querySelector('.ly-sh-link').textContent = 'Card made — the passage, the book and ' + (item.body ? 'the note' : 'nothing else') + ', ready to send.';
        wrote('share', { how: 'card', item: item });
      });
    }
    function close() { scrim.remove(); sh.remove(); if (ctx.onClose) ctx.onClose(); }
    sh.__close = close;
    ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach(function (t) { sh.addEventListener(t, function (e) { e.stopPropagation(); }); scrim.addEventListener(t, function (e) { e.stopPropagation(); }); });
    press(scrim, close);
    draw(); host.appendChild(scrim); host.appendChild(sh);
    return sh;
  }

  /* ---- the overlay itself ------------------------------------------------ */
  var WINCOL = ['--chrome-fg-dim', '--mg-gold', '--mg-red', '--mg-pink', '--chrome-accent', '--scrub-accent'];   /* never a green: the baseline is the paper's grey (ASKS #178) */
  function over(o) {
    var col = o.text, doc = col.ownerDocument, R = doc.documentElement, HL = !!(window.CSS && CSS.highlights && window.Highlight);
    var layer = 'book', data = null, asked = false, items = [], reg = {}, voiceSel = null, overrides = {}, queued = false, api = null;
    var slug = o.slug || ((new URLSearchParams(location.search).get('book') || '').split('/').filter(Boolean).pop() || '');
    var phone = function () { return R.hasAttribute('data-phone'); };
    var box = h('div', 'ly-over'); box.setAttribute('data-for', 'layers'); box.hidden = true;
    var list = h('div', 'ly-list'), head = h('div', 'ly-head'); box.appendChild(head); box.appendChild(list);
    var bar = h('div', 'ly-selbar'); bar.hidden = true; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Mark these words');
    var style = h('style'); style.setAttribute('data-for', 'layers');
    doc.head.appendChild(style); doc.body.appendChild(box); doc.body.appendChild(bar);
    ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(function (t) {
      box.addEventListener(t, function (e) { e.stopPropagation(); });
      bar.addEventListener(t, function (e) { e.stopPropagation(); if (t === 'mousedown' || t === 'pointerdown') e.preventDefault(); });   /* the selection stays while a colour is pressed */
    });
    var ranges = {};   /* record id -> Range, resolved once per text */
    function paras() { return Array.prototype.slice.call(col.querySelectorAll('p')); }
    function rangeIn(el, a, b) {
      var w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, pos = 0, r = doc.createRange(), started = false;
      while ((n = w.nextNode())) { var L = n.nodeValue.length;
        if (!started && a <= pos + L) { r.setStart(n, a - pos); started = true; }
        if (started && b <= pos + L) { r.setEnd(n, b - pos); return r; }
        pos += L; }
      return null;
    }
    function find(q, within) {
      if (!q || !q.exact) return null;
      var ps = within ? [within] : paras();
      for (var i = 0; i < ps.length; i++) {
        var t = ps[i].textContent, k = t.indexOf(q.exact);
        if (k >= 0 && q.prefix) { var k2 = t.indexOf(q.prefix + q.exact); if (k2 >= 0) k = k2 + q.prefix.length; }
        if (k >= 0) return rangeIn(ps[i], k, k + q.exact.length);
      }
      return null;
    }
    function live(r) { return r && r.startContainer && r.startContainer.isConnected && !r.collapsed; }
    function rangeOf(key, q) { var r = ranges[key]; if (!live(r)) { r = find(q); if (r) ranges[key] = r; } return r || null; }
    function add(name, r) { (reg[name] = reg[name] || []).push(r); }
    function flush() {
      if (!HL) return;
      var drop = []; CSS.highlights.forEach(function (v, k) { if (/^ly-/.test(k)) drop.push(k); }); drop.forEach(function (k) { CSS.highlights.delete(k); });
      Object.keys(reg).forEach(function (k) { var hl = new Highlight(); reg[k].forEach(function (r) { hl.add(r); }); CSS.highlights.set(k, hl); });
    }
    function ctx() { var B = (data && data.book) || {}; return { title: B.title || doc.title.replace(/ · Frank$/, ''), author: B.author, chapter: B.chapter ? chapName(B.chapter.title) : '', work: (data && data.pub && data.pub.work_id) || slug, slug: slug, origin: location.origin }; }
    function chapName(t) { return String(t || '').replace(/^CHAPTER\s+\d+\.\s*/i, '').replace(/\.$/, '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
    function note() { var n = o.note || doc.getElementById('layernote'); return n; }

    /* the items of the layer: a Range, and the card (or chip) that goes with it */
    function build() {
      items = []; reg = {}; list.innerHTML = ''; head.innerHTML = '';
      if (!data) return;
      if (layer === 'mine') buildMine(); else if (layer === 'everyone') buildEveryone(); else if (layer === 'voice') buildVoice();
      flush();
    }
    function item(r, el, key) { if (el) { el.setAttribute('data-key', key || ''); list.appendChild(el); } items.push({ r: r, el: el, key: key }); }
    function buildMine() {
      data.notes.forEach(function (n) {
        var r = rangeOf(n.id, n.anchor && n.anchor.quote); if (!r) return;
        add('ly-hl-' + (HLC.indexOf(n.colour) >= 0 ? n.colour : 'yellow'), r);
        if (!n.body && n.kind === 'highlight') { item(r, null, n.id); return; }
        add('ly-noted', r);
        var c = h('div', 'ly-card ly-mine kind-' + n.kind,
            '<div class="ly-who"><i class="ly-swatch" data-colour="' + esc(n.colour || 'yellow') + '"></i>' + (n.kind === 'question' ? 'Your question' : 'Your note') + '<span class="ly-when">' + esc(ago(n.made_at)) + '</span></div>'
          + '<div class="ly-body" contenteditable="true" spellcheck="false">' + esc(n.body || '') + '</div>'
          + '<div class="ly-foot"><button type="button" class="ly-verb ly-vis" data-vis="' + esc(n.visibility) + '">' + esc({ 'private': 'Only me', friends: 'Friends', group: 'Group', 'public': 'Everyone', 'on request': 'On request' }[n.visibility] || 'Only me') + '</button>'
          + '<button type="button" class="ly-verb ly-share-b" aria-label="Share">' + glyphShare() + 'Share</button></div>');
        c.querySelector('.ly-body').addEventListener('input', function (e) { n.body = e.currentTarget.textContent; wrote('note', n); });
        c.querySelector('.ly-body').addEventListener('keydown', function (e) { e.stopPropagation(); });
        press(c.querySelector('.ly-vis'), function () { shareNote(n); });
        press(c.querySelector('.ly-share-b'), function () { shareNote(n); });
        item(r, c, n.id);
      });
      var mine = items.length;
      head.innerHTML = mine ? '<b>Mine</b><span>' + data.notes.filter(function (n) { return n.body; }).length + ' notes · ' + data.notes.length + ' marks in this book</span>' : '';
    }
    function shareNote(n) {
      share(doc.body, { mine: true, visibility: n.visibility, quote: n.anchor.quote.exact, body: n.body }, Object.assign(ctx(), { onVis: function (v) {
        n.visibility = v; wrote('visibility', n);
        var pub = data.pub.contributions, at = pub.map(function (p) { return p.id; }).indexOf(n.id);
        if (v === 'public' && at < 0) pub.push({ id: n.id, kind: n.kind === 'highlight' ? 'note' : n.kind, author: 'you', made_at: n.made_at, body: n.body || '', anchor: n.anchor, replies: 0 });
        if (v !== 'public' && at >= 0) pub.splice(at, 1);
      }, onClose: paint }));
    }
    function buildEveryone() {
      var S = data.sentences || {}, readers = {};
      Object.keys(data.pub.counts || {}).forEach(function (sid) {
        var c = data.pub.counts[sid], r = rangeOf('s:' + sid, { exact: S[sid] }); if (!r) return;
        add('ly-pub', r);
        var chip = h('div', 'ly-count', '<b>' + c.highlights + '</b> readers marked this' + (c.notes ? ' · ' + c.notes + ' notes' : ''));
        item(r, chip, 'count:' + sid);
      });
      data.pub.contributions.forEach(function (p) {
        var own = p.author === 'you', r = rangeOf('p:' + p.id, p.anchor && p.anchor.quote); if (!r) return;
        readers[p.author] = 1;
        add(own ? 'ly-own' : 'ly-pubnote', r);
        var c = h('div', 'ly-card ly-pubcard kind-' + p.kind + (own ? ' ly-own' : ''),
            '<div class="ly-who"><i class="ly-av" aria-hidden="true">' + (own ? 'Y' : initial(p.author)) + '</i>' + (own ? 'You' : esc(p.author)) + '<span class="ly-when">' + esc(ago(p.made_at)) + '</span></div>'
          + '<div class="ly-body">' + esc(p.body) + '</div>'
          + '<div class="ly-replies">' + (p.thread || []).map(function (t) { return '<p><b>You</b> ' + esc(t) + '</p>'; }).join('') + '</div>'
          + '<div class="ly-foot"><button type="button" class="ly-verb ly-reply">Reply' + (p.replies ? ' <i>' + p.replies + '</i>' : '') + '</button>'
          + '<button type="button" class="ly-verb ly-share-b" aria-label="Share">' + glyphShare() + 'Share</button></div>');
        press(c.querySelector('.ly-reply'), function () { replyTo(c, p); });
        press(c.querySelector('.ly-share-b'), function () { share(doc.body, { mine: own, visibility: 'public', quote: p.anchor.quote.exact, body: p.body, author: own ? '' : p.author }, Object.assign(ctx(), { onClose: paint })); });
        item(r, c, 'p:' + p.id);
      });
      var n = Object.keys(readers).length;
      head.innerHTML = items.length ? '<b>Everyone</b><span>' + data.pub.contributions.length + ' public notes · ' + n + ' readers</span>' : '';
    }
    function replyTo(c, p) {
      var f = c.querySelector('.ly-replyf'); if (f) { f.querySelector('textarea').focus(); return; }
      f = h('div', 'ly-replyf', '<textarea rows="2" placeholder="Reply to ' + esc(p.author === 'you' ? 'your note' : p.author) + '"></textarea><div class="ly-foot"><button type="button" class="ly-verb ly-send">Reply</button><button type="button" class="ly-verb ly-cancel">Cancel</button></div>');
      c.insertBefore(f, c.querySelector('.ly-foot'));
      var ta = f.querySelector('textarea'); ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      function send() { var t = ta.value.trim(); if (!t) return; (p.thread = p.thread || []).push(t); p.replies = (p.replies || 0) + 1; wrote('reply', { to: p.id, body: t }); paint(); }
      press(f.querySelector('.ly-send'), send); press(f.querySelector('.ly-cancel'), function () { f.remove(); layout(); });
      setTimeout(function () { try { ta.focus({ preventScroll: true }); } catch (e) {} }, 0); layout();
    }
    function buildVoice() {
      var M = data.marks || {}, chap = null; for (var k in (M.chapters || {})) { chap = M.chapters[k]; break; }
      if (!chap) return;
      var ids = Object.keys(M.windows || {}), css = '';
      ids.forEach(function (id, i) { var tok = WINCOL[i % WINCOL.length]; css += '::highlight(ly-win-' + i + '){ background-color: color-mix(in srgb, var(' + tok + ') ' + (i ? 22 : 14) + '%, transparent); }\n'; });
      css += '::highlight(ly-win-sel){ background-color: color-mix(in srgb, currentColor 16%, transparent); text-decoration: underline 2px; text-underline-offset: 4px; }\n';
      style.textContent = css;
      var S = data.sentences || {}, homs = M.homographs || {};
      Object.keys(chap.chunks).forEach(function (sid) {
        var m = chap.chunks[sid], ov = overrides[sid] || {}, w = ov.window || m.window, i = ids.indexOf(w), r = rangeOf('s:' + sid, { exact: S[sid] }); if (!r || i < 0) return;
        add('ly-win-' + i, r);
        if (voiceSel === sid) add('ly-win-sel', r);
        var d = ov.direction || m.direction;
        if (d) item(r, h('div', 'ly-dir', 'direction · <i>' + esc(d) + '</i><span>noted · not yet heard</span>'), 'dir:' + sid);
        else item(r, null, 'v:' + sid);
        /* the homographs the layer knows, inside this sentence: a dotted line under the word */
        var p = r.startContainer.parentElement && r.startContainer.parentElement.closest('p'), txt = S[sid];
        Object.keys(homs).forEach(function (hw) { var re = new RegExp('\\b' + hw + '\\b', 'i'), mm = re.exec(txt); if (!mm || !p) return;
          var base = p.textContent.indexOf(txt); if (base < 0) return; var rr = rangeIn(p, base + mm.index, base + mm.index + hw.length); if (rr) add(ov.reading ? 'ly-rd-set' : 'ly-rd', rr); });
      });
      head.innerHTML = '<b>Voice</b><span>' + esc(ids.length ? (M.windows[ids[0]].voice || '') : '') + ' · ' + esc(chap.engine || '') + '</span>'
        + '<div class="ly-legend">' + ids.map(function (id, i) { return '<span class="ly-win"><i style="--win:var(' + WINCOL[i % WINCOL.length] + ')"></i>' + esc(M.windows[id].name) + '</span>'; }).join('') + '</div>'
        + (Object.keys(overrides).length ? '<button type="button" class="ly-act ly-rerun-open">Re-run · ' + Object.keys(overrides).length + ' changed</button>' : queued ? '<p class="ly-queued">Queued on ' + esc(chap.engine || '') + ' — the rest of the chapter keeps its audio.</p>' : '<p class="ly-hint">Press a sentence to change its window.</p>');
      var ro = head.querySelector('.ly-rerun-open'); if (ro) press(ro, rerun);
      if (voiceSel) runCard(voiceSel, chap, ids);
    }
    function runCard(sid, chap, ids) {
      var M = data.marks, m = chap.chunks[sid], ov = overrides[sid] || {}, cur = ov.window || m.window, d = ov.direction || m.direction || '';
      var txt = (data.sentences[sid] || ''), hw = Object.keys(M.homographs || {}).filter(function (w) { return new RegExp('\\b' + w + '\\b', 'i').test(txt); })[0];
      var c = h('div', 'ly-card ly-run',
          '<div class="ly-who">' + esc(txt.split(/\s+/).slice(0, 6).join(' ')) + '…<span class="ly-when">' + esc(sid.split('.').slice(1).join(' · ')) + '</span></div>'
        + '<div class="ly-mark"><label>Window</label><span class="ly-sws">' + ids.map(function (id, i) { return '<button type="button" class="ly-sw" data-win="' + esc(id) + '" style="--win:var(' + WINCOL[i % WINCOL.length] + ')" aria-label="' + esc(M.windows[id].name) + '" aria-pressed="' + (id === cur) + '"></button>'; }).join('') + '</span><em>' + esc(M.windows[cur].name) + '</em></div>'
        + '<div class="ly-mark"><label>Direction</label><select class="ly-dirsel" aria-label="Direction"><option value="">Inferred · ' + esc(m.inferred || '') + '</option>' + (M.directions || []).map(function (x) { return '<option' + (x === d ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>'
        + (hw ? '<div class="ly-mark"><label>Reading</label><span class="ly-sws">' + M.homographs[hw].map(function (x, i) { return '<button type="button" class="ly-verb ly-rdopt" data-i="' + i + '" aria-pressed="' + (!!ov.reading && ov.reading.ipa === x.ipa) + '">' + esc(hw) + ' /' + esc(x.ipa) + '/ <i>' + esc(x.sense) + '</i></button>'; }).join('') + '</span></div>' : '')
        + '<div class="ly-foot"><button type="button" class="ly-act ly-rerun-b"' + (Object.keys(overrides).length ? '' : ' disabled') + '>Re-run…</button><button type="button" class="ly-verb ly-done">Done</button></div>');
      function set(k, v) { var o2 = overrides[sid] = overrides[sid] || {}; if (!v || v === m[k]) delete o2[k]; else o2[k] = v; if (!Object.keys(o2).length) delete overrides[sid]; queued = false; wrote('mark', { chunk: sid, change: o2 }); paint(); }
      c.querySelectorAll('.ly-sw').forEach(function (b) { press(b, function () { set('window', b.getAttribute('data-win')); }); });
      c.querySelector('.ly-dirsel').addEventListener('change', function (e) { set('direction', e.target.value); });
      c.querySelectorAll('.ly-rdopt').forEach(function (b) { press(b, function () { var x = M.homographs[hw][+b.getAttribute('data-i')]; set('reading', ov.reading && ov.reading.ipa === x.ipa ? null : { word: hw, ipa: x.ipa }); }); });
      press(c.querySelector('.ly-rerun-b'), rerun);
      press(c.querySelector('.ly-done'), function () { voiceSel = null; paint(); });
      var r = ranges['s:' + sid]; if (r) item(r, c, 'run:' + sid);
    }
    function rerun() {
      var ids = Object.keys(overrides), M = data.marks, chap = null; for (var k in M.chapters) { chap = M.chapters[k]; break; }
      var scrim = h('div', 'ly-scrim'), sh = h('div', 'ly-share ly-rerun'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Re-run');
      sh.innerHTML = '<div class="ly-sh-head"><b>Re-run</b><button type="button" class="ly-x" aria-label="Close">×</button></div><ul>' + ids.map(function (sid) { var ov = overrides[sid];
          return '<li><span>' + esc((data.sentences[sid] || '').split(/\s+/).slice(0, 5).join(' ')) + '…</span><i>' + [ov.window ? 'window → ' + esc(M.windows[ov.window].name) : '', ov.direction ? 'direction → ' + esc(ov.direction) : '', ov.reading ? 'reading → /' + esc(ov.reading.ipa) + '/' : ''].filter(Boolean).join(' · ') + '</i></li>'; }).join('')
        + '</ul><p class="ly-sh-say">' + ids.length + ' sentence' + (ids.length > 1 ? 's' : '') + ' on ' + esc(chap.engine || '') + '. Only these are read again; the rest of the chapter keeps its audio.</p>'
        + '<div class="ly-sh-acts"><button type="button" class="ly-act ly-go">Re-run passage</button><button type="button" class="ly-verb ly-go">Re-run chapter</button></div>';
      function close() { scrim.remove(); sh.remove(); }
      ['pointerdown', 'pointerup', 'click'].forEach(function (t) { sh.addEventListener(t, function (e) { e.stopPropagation(); }); scrim.addEventListener(t, function (e) { e.stopPropagation(); }); });
      press(scrim, close); press(sh.querySelector('.ly-x'), close);
      sh.querySelectorAll('.ly-go').forEach(function (b) { press(b, function () { wrote('rerun', { chunks: overrides, scope: b.classList.contains('ly-act') ? 'passage' : 'chapter' });
        Object.keys(overrides).forEach(function (sid) { var ov = overrides[sid], ch = chap.chunks[sid]; if (ov.window) ch.window = ov.window; if (ov.direction) ch.direction = ov.direction; if (ov.reading) ch.reading = ov.reading; });
        overrides = {}; queued = true; voiceSel = null; close(); paint(); }); });
      doc.body.appendChild(scrim); doc.body.appendChild(sh);
    }

    /* ---- where each card goes: beside the column, or in the phone's sheet -- */
    function textRight() {
      var vh = innerHeight, best = null;
      paras().some(function (p) { var r = p.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh && r.width > 40) { best = r; return true; } return false; });
      return best ? best.right : col.getBoundingClientRect().right;
    }
    function yOf(r) { var rs = r.getClientRects(); return rs.length ? rs[0].top : null; }
    var tick = 0;
    function layout() {
      if (box.hidden) return;
      var vh = innerHeight, vw = innerWidth, right = textRight(), room = vw - right;
      var side = !phone() && room >= 240;
      box.setAttribute('data-mode', side ? 'side' : 'sheet');
      if (side) { var w = Math.min(300, room - 48); box.style.left = (right + 24) + 'px'; box.style.width = w + 'px'; }
      else { box.style.left = ''; box.style.width = ''; }
      var shown = 0, y = side ? head.getBoundingClientRect().bottom + 8 : 0;
      items.slice().sort(function (a, b) { return (yOf(a.r) || 1e9) - (yOf(b.r) || 1e9); }).forEach(function (it) {
        var t = yOf(it.r), on = t != null && t > (side ? -240 : 0) && t < vh - (side ? 40 : 120);
        if (!it.el) { if (on) shown++; return; }   /* a mark with no card (a bare highlight, a window) still counts as on screen */
        if (it.el.classList.contains('ly-run')) on = t != null;
        it.el.hidden = !on; if (!on) return; shown++;
        if (side) { var top = Math.max(t, y); it.el.style.top = top + 'px'; y = top + it.el.offsetHeight + 8; }
        else { it.el.style.top = ''; list.appendChild(it.el); }
      });
      /* nothing of this layer on screen: say where it is, and go there in one press */
      var go = box.querySelector('.ly-go-to');
      var any = items.filter(function (it) { return yOf(it.r) != null; });
      if (!shown && any.length) {
        if (!go) { go = h('button', 'ly-verb ly-go-to'); go.type = 'button'; press(go, function () {
          /* straight down the page's own scroller -- never scrollIntoView, which may move the reader's sideways axis too */
          var r = any[0].r, sc = col; while (sc && sc !== doc.body && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
          var y = yOf(r); if (sc && y != null) sc.scrollTop += y - innerHeight * 0.3; setTimeout(layout, 60); }); box.appendChild(go); }
        go.hidden = false; go.textContent = (layer === 'voice' ? 'The voice’s marks' : layer === 'everyone' ? data.pub.contributions.length + ' public notes' : data.notes.length + ' of your marks') + ' — ' + (ctx().chapter || 'go') + ' ›';
      } else if (go) go.hidden = true;
      box.toggleAttribute('data-empty', !shown);
    }
    function onScroll() { if (tick || box.hidden) return; tick = requestAnimationFrame(function () { tick = 0; layout(); }); }
    doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);

    /* ---- pressing the text: a mark's card, a voice sentence ---------------- */
    function at(r, x, y) { var rs = r.getClientRects(); for (var i = 0; i < rs.length; i++) { var q = rs[i]; if (x >= q.left && x <= q.right && y >= q.top && y <= q.bottom) return true; } return false; }
    col.addEventListener('click', function (e) {
      if (layer === 'book' || !data) return;
      var s = doc.getSelection && doc.getSelection(); if (s && !s.isCollapsed) return;
      if (layer === 'voice') {
        var hit = items.filter(function (it) { return /^(v|dir):/.test(it.key) && at(it.r, e.clientX, e.clientY); })[0];
        if (hit) { e.stopPropagation(); e.preventDefault(); voiceSel = hit.key.replace(/^(v|dir):/, ''); paint(); }   /* a press on a sentence is the Voice layer's, not the look-up's */
        return;
      }
      if (layer === 'mine') {
        var m = items.filter(function (it) { return at(it.r, e.clientX, e.clientY); })[0]; if (!m) return;
        var n = data.notes.filter(function (x) { return x.id === m.key; })[0]; if (!n) return;
        e.stopPropagation(); e.preventDefault();
        if (m.el) { m.el.classList.add('ly-lit'); setTimeout(function () { m.el.classList.remove('ly-lit'); }, 900); return; }
        showBar(m.r, n);
      }
    }, true);

    /* ---- MINE: select words, and they are yours ---------------------------- */
    function quoteOf(r) {
      var p = r.startContainer.parentElement && r.startContainer.parentElement.closest('p'); if (!p) return null;
      var pre = doc.createRange(); pre.setStart(p, 0); pre.setEnd(r.startContainer, r.startOffset);
      var a = pre.toString().length, t = p.textContent, ex = r.toString(), lead = ex.length - ex.replace(/^\s+/, '').length; ex = ex.trim(); a += lead;
      return { exact: ex, prefix: t.slice(Math.max(0, a - 16), a), suffix: t.slice(a + ex.length, a + ex.length + 16) };
    }
    function showBar(r, n) {
      var rect = r.getBoundingClientRect(); if (!rect.width) return;
      bar.innerHTML = dots(n ? n.colour : '') + '<button type="button" class="ly-verb ly-bnote">Note</button><button type="button" class="ly-verb ly-bshare" aria-label="Share">' + glyphShare() + '</button>' + (n ? '<button type="button" class="ly-verb ly-bdel" aria-label="Remove">Remove</button>' : '');
      bar.hidden = false;
      var bw = bar.offsetWidth, x = Math.max(8, Math.min(innerWidth - bw - 8, rect.left + rect.width / 2 - bw / 2)), y = rect.top - bar.offsetHeight - 10;
      if (y < 60) y = rect.bottom + 10;
      bar.style.left = x + 'px'; bar.style.top = y + 'px';
      var q = n ? n.anchor.quote : quoteOf(r), rr = r.cloneRange();
      function make(kind, colour) {
        if (n) { n.colour = colour || n.colour; if (kind === 'note' && !n.body) { n.kind = 'note'; n.body = ''; } wrote('note', n); return n; }
        var rec = { id: 'm' + Date.now().toString(36), kind: kind, colour: colour || 'yellow', visibility: 'private', made_at: new Date().toISOString(), body: kind === 'note' ? '' : undefined, anchor: { quote: q } };
        data.notes.push(rec); ranges[rec.id] = rr; wrote('note', rec); return rec;
      }
      function toMine() { var g = (api && api.goTo) || o.go; if (layer === 'book' && g) g('mine'); else paint(); }
      bar.querySelectorAll('.ly-dot').forEach(function (b) { press(b, function () { make('highlight', b.getAttribute('data-colour')); hideBar(true); toMine(); }); });
      press(bar.querySelector('.ly-bnote'), function () { var rec = make('note'); hideBar(true); toMine();
        var c = list.querySelector('[data-key="' + rec.id + '"] .ly-body'); if (c) setTimeout(function () { try { c.focus({ preventScroll: true }); } catch (e) {} }, 0); });
      press(bar.querySelector('.ly-bshare'), function () { var rec = n || null; hideBar(true);
        if (rec) shareNote(rec); else share(doc.body, { mine: false, quote: q.exact }, Object.assign(ctx(), { onClose: paint })); });
      var del = bar.querySelector('.ly-bdel'); if (del) press(del, function () { data.notes.splice(data.notes.indexOf(n), 1); wrote('remove', n); hideBar(true); paint(); });
    }
    function hideBar(clear) { bar.hidden = true; if (clear) { var s = doc.getSelection(); if (s) s.removeAllRanges(); } }
    var selT = 0;
    doc.addEventListener('selectionchange', function () {
      clearTimeout(selT);
      selT = setTimeout(function () {
        /* THE BOOK LAYER MARKS TOO (#187): plain reading is where a person selects a line; the bar there is the
           same Highlight · Note · Share, and a mark made from it goes to Mine (the layer switches, so it is seen). */
        if (layer !== 'mine' && layer !== 'everyone' && layer !== 'book') { hideBar(); return; }
        var s = doc.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) { if (!bar.contains(doc.activeElement)) hideBar(); return; }
        var r = s.getRangeAt(0); if (!col.contains(r.commonAncestorContainer) || r.toString().trim().length < 2) return;
        if (!data) { if (!asked) { asked = true; sourceOf(slug, function (d) { data = d; var s2 = doc.getSelection(); if (s2 && !s2.isCollapsed && s2.rangeCount) showBar(s2.getRangeAt(0), null); }); } return; }
        if (layer === 'everyone') { bar.innerHTML = '<button type="button" class="ly-verb ly-bshare">' + glyphShare() + 'Share this passage</button>'; bar.hidden = false;
          var rc = r.getBoundingClientRect(); bar.style.left = Math.max(8, rc.left) + 'px'; bar.style.top = Math.max(60, rc.top - bar.offsetHeight - 10) + 'px';
          var q = quoteOf(r); press(bar.querySelector('.ly-bshare'), function () { hideBar(true); share(doc.body, { mine: false, quote: q.exact }, Object.assign(ctx(), { onClose: paint })); }); return; }
        showBar(r, null);
      }, 220);
    });

    /* ---- the layer changes ---------------------------------------------------- */
    function paint() {
      if (layer === 'book' || !data) { reg = {}; items = []; flush(); box.hidden = true; hideBar(); R.removeAttribute('data-lylayer'); return; }
      R.setAttribute('data-lylayer', layer);
      box.hidden = false; box.setAttribute('data-layer', layer);
      build();
      var nt = note(); if (nt && items.length) nt.hidden = true;   /* the "none yet" card is for a truly empty book */
      layout();
    }
    function set(l) {
      layer = l; voiceSel = null;
      if (l === 'book') { paint(); return; }
      if (!asked) { asked = true; sourceOf(slug, function (d) { data = d; paint(); }); return; }
      paint();
    }
    return api = { text: col, set: set, refresh: function () { if (data && layer !== 'book') paint(); }, count: function () { return { layer: layer, items: items.length, cards: items.filter(function (it) { return it.el && !it.el.hidden; }).length }; }, data: function () { return data; }, layout: layout, box: box };
  }

  /* GET studio's /marks/<slug>/<cid>; cb(body) or cb(null, why). The shape is the
     fixture's (layers-samples.js MARKS), which the route's test asserts. */
  function marksOf(url, cb) {
    fetch(url).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); })
      .then(function (j) { cb(j); }).catch(function (e) { cb(null, String(e && e.message || e)); });
  }
  /* THE SWITCH ALONE (EXPORT, 28 Sep): a page that writes its own text -- the
     reader, whose words are page.js's and never this file's -- mounts only the
     control, in the band's right cluster, with the same glyphs, names and
     press; the page answers onLayer. One definition of the switch, two mounts. */
  function control(band, o) {
    o = o || {};
    var layer = o.layer || 'book';
    var g = h('div', 'layers'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Layer');
    var ov = null;
    function set(l) {
      layer = l;
      g.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-layer') === l ? 'true' : 'false'); });
      if (o.onLayer) o.onLayer(l);
      /* the page's own text gets the layer drawn over it (ASKS #178) -- the reader's column, found by its id */
      if (!ov && o.overlay !== false) { var t = o.text || document.getElementById('readercol'); if (t) ov = (LAST && LAST.text === t) ? LAST : (LAST = over({ text: t, note: o.note, go: function (l) { set(l); } })); }   /* one overlay per text, however often the band is re-mounted */
      if (ov) ov.set(l);
    }
    /* the overlay is made with the switch, not on its first press: selecting in plain reading needs it (#187) */
    if (!ov && o.overlay !== false) { var t0 = o.text || document.getElementById('readercol'); if (t0) ov = (LAST && LAST.text === t0) ? LAST : (LAST = over({ text: t0, note: o.note, go: function (l) { set(l); } })); }
    LAYERS.forEach(function (l) {
      var b = h('button', null, lglyph(l[0])); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-layer', l[0]); b.setAttribute('aria-label', l[1]);
      b.setAttribute('aria-checked', l[0] === layer ? 'true' : 'false');
      press(b, function () { set(l[0]); });
      g.appendChild(b);
    });
    if (ov) ov.goTo = set;   /* the switch on screen now is the one a mark made in plain reading turns to Mine */
    var right = band && band.querySelector('.band-right');
    if (right) right.insertBefore(g, right.firstChild);
    /* a re-mounted band (a book opened again) starts where its switch says: the overlay follows it */
    if (LAST && LAST.text === (o.text || document.getElementById('readercol'))) { ov = LAST; ov.set(layer); }
    return { el: g, set: set, get: function () { return layer; }, overlay: function () { return ov; } };
  }
  var LAST = null;
  window.Layers = { mount: mount, control: control, LAYERS: LAYERS, marks: marksOf, useSource: useSource, share: share, overlay: function () { return LAST; }, keep: keep, unkeep: unkeep };
})();
