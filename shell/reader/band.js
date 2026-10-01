/* ENGINE · THE BAND -- the mount: the mark, the three doors, the head, the theme
   · picture: band.css (design/reader/band.css is the master)
   · mounted by: every page (library, reader, settings, the surface), one
     <script src> and one call -- Band.mount(host, {page, book, hrefs})
   · drawn 26 Sep 2026 (wave 10 BAND). On the phone this IS the bar pbar.js
     mounted (10-11 Sep): the same three elements at the foot. pbar.js's
     gestures (the pill's tap / slide / drag up, the hide-as-you-read, the
     long press for the theme) move under this file when Osca says yes;
     until then this is the picture's hand only: it draws, marks the current
     page, and flips the theme.

   ONE CALL, FOUR STATES. Which state is not an argument: the band reads
   `html[data-phone]` and `html[data-web]` the way every page already sets
   them, and "on a book" is `opts.book` being given. So a page calls
   exactly the same line on every host. */
(function () {
  var R = document.documentElement;

  /* the glyphs -- one 16 x 16 grid, one stroke weight (chrome.html's rule:
     drawn, never characters, so they share an optical line) */
  function ink(d, extra) {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  }
  var G = {
    library:  ink('<path d="M2 13.5h12"/><rect x="3" y="4" width="2.5" height="9.5" rx=".5"/><rect x="6.5" y="2.5" width="2.5" height="11" rx=".5"/><path d="M10.3 4.6l2.3-.6 2 8.9-2.3.6z"/>'),   /* books on a shelf (band Stranger: the old box of columns read as "sidebar") */
    surface:  ink('<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>'),
    settings: ink('<path d="M6.45 3.24L6.76 1.11L9.24 1.11L9.55 3.24L11.35 4.28L13.35 3.48L14.59 5.63L12.89 6.96L12.89 9.04L14.59 10.37L13.35 12.52L11.35 11.72L9.55 12.76L9.24 14.89L6.76 14.89L6.45 12.76L4.65 11.72L2.65 12.52L1.41 10.37L3.11 9.04L3.11 6.96L1.41 5.63L2.65 3.48L4.65 4.28z"/><circle cx="8" cy="8" r="2.25"/>'),
    back:     ink('<path d="M9.5 3.5L5 8l4.5 4.5"/>', ' class="band-back"'),
    mic:      ink('<rect x="5.5" y="2" width="5" height="8" rx="2.5"/><path d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14M6 14h4"/>'),
    /* the theme disc: the outline, and one of two half-fills */
    theme:    ink('<circle cx="8" cy="8" r="5.5"/>'
                + '<path class="half half-light" d="M8 2.5v11a5.5 5.5 0 0 1 0-11z"/>'
                + '<path class="half half-dark" d="M8 2.5v11a5.5 5.5 0 0 0 0-11z"/>')
  };

  function themeNow() {
    var t = R.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function setTheme(t) {
    R.setAttribute('data-theme', t);
    document.querySelectorAll('.band-theme').forEach(function (b) {
      b.setAttribute('aria-label', 'Theme: ' + t);
    });
    /* prefs/ writes the same attribute; when it is loaded, tell it */
    try { if (window.Prefs && Prefs.set) Prefs.set('theme', t); } catch (e) {}
  }

  function mount(host, opts) {
    opts = opts || {};
    var page  = opts.page || 'library';
    var book  = opts.book || null;
    var hrefs = opts.hrefs || { library: 'library.html', settings: '../settings/settings.html' };
    var phone = R.hasAttribute('data-phone');
    var glyphs = getComputedStyle(host).getPropertyValue('--band-glyph').trim() === '1' || opts.glyphs;

    var band = document.createElement('nav');
    band.className = 'band';
    band.setAttribute('aria-label', 'Frank');
    band.setAttribute('data-page', page);
    if (book) band.setAttribute('data-book', '');

    function door(id, word, tag, attrs) {
      var cur = page === id ? ' aria-current="page"' : '';
      var g = '';
      if (id === 'library') g += G.back;                       /* shown on a book only (css) */
      if (glyphs || (phone && id === 'settings')) g += G[id];  /* the ⚙ is always a glyph on the phone */
      return '<' + tag + ' class="band-door" data-door="' + id + '" aria-label="' + word + '"' + attrs + cur + '>'   /* the name a glyph-only door is heard by (Stranger, 28 Sep) */
           + g + '<span>' + word + '</span>'
           + (id === 'surface' && !phone ? '<kbd>⌘K</kbd>' : '')
           + (id === 'settings' && phone ? '<i class="band-dot"></i>' : '')
           + '</' + tag + '>';
    }

    /* THE CENTRE (Osca, 28 Sep): on a book, the book; on the shelf, SEARCH --
       "search, when in the library, should take centre stage in the band, like
       the book cover does". A press opens the Surface (the same verb as ⌘K). */
    /* a field you can type in (band Stranger 4: "the Search box doesn't take
       typing"): the first key -- or Return -- opens the Surface with what was
       typed; ⌘K puts the caret here */
    /* ONE SEARCH, AND IT SEARCHES WHERE YOU ARE (ASKS #159): on Settings the band's field and the phone's pill search Settings */
    var inSet = page === 'settings', sword = inSet ? 'Search Settings' : 'Search';
    var find = '<label class="band-search" data-el="search">' + G.surface + '<input type="search" placeholder="' + sword + '" aria-label="' + sword + '" autocomplete="off" spellcheck="false">' + (phone ? '' : '<kbd>⌘K</kbd>') + '</label>';
    var head = book
      ? '<div class="band-head"><b>' + esc(book.title) + '</b><i>' + esc(book.chapter || '') + '</i></div>'
      : '<div class="band-head">' + ((page === 'library' || inSet) && !phone ? find : '') + '</div>';

    /* the phone's centre is the same idea: on a book the book (title, chapter),
       drag it up for the shelf; elsewhere a search field */
    var pill = phone
      ? (book
        ? '<button class="band-pill" type="button" data-book aria-label="' + esc(book.title) + ' — tap to search, drag up for the Library">'
          + '<b>' + esc(book.title) + '</b><i>' + esc(book.chapter || '') + '</i>'
          + '<u class="band-pagekey" aria-hidden="true">' + G.back + '<span>Page</span></u></button>'
        : '<button class="band-pill" type="button" aria-label="' + sword + '">' + G.surface + '<span>' + sword + '</span></button>')
      : '';
    /* THE MIC IS A BUTTON (ASKS #181, Osca 30 Sep: "when the mic is on and working, it should go red ofc, like
       the settings toggle"): role button, aria-pressed is whether it listens; while it does it wears the accent,
       the ⚙'s own "you are here" treatment. It drives voiceui's real toggle when the page has one (and follows
       voiceui's data-state: armed, listening, busy = on); a page without it (the canvas) toggles a stand-in and
       says so with a band:mic event. The state rides html[data-listening], so a redrawn band keeps it. */
    var listening = R.hasAttribute('data-listening');
    var mic = phone ? '<button type="button" class="band-mic" aria-pressed="' + listening + '" aria-label="' + (listening ? 'Stop listening' : 'Listen') + '">' + G.mic + '</button>' : '';

    band.innerHTML =
        '<div class="band-in">'
      +   '<div class="band-left">'
      +     '<a class="band-mark" href="' + hrefs.library + '" aria-label="' + (book ? 'Library' : 'Frank') + '"><b>W</b><b>B</b></a>'   /* on a book the mark IS the way back */
      +     '<a class="band-name" href="' + hrefs.library + '">Frank</a>'
      +     door('settings', 'Settings', 'a', ' href="' + hrefs.settings + '"')   /* first in DOM: the phone's left */
      +     door('library', 'Library', 'a', ' href="' + hrefs.library + '"')
      +     door('surface', 'Surface', 'button', ' type="button"')
      +   '</div>'
      +   pill
      +   head
      +   '<div class="band-right">'
      /* NO THEME BUTTON, anywhere (Osca, 6 Sep and again 28 Sep: "GET RID OF THE FUCKING THING IN THE MAC
         APP") -- Settings drives light and dark; the phone's long press on ⚙ stays the one shortcut */
      +     mic
      +   '</div>'
      + '</div>';

    /* the Mac's row is a grid of three -- the left cluster, the head, the
       right cluster -- so the head is centred on the WINDOW, not on what the
       doors leave. The Mac's order is mark · name · Library · Surface ·
       Settings; the phone's is ⚙ · pill · mic. One DOM, two orders: the
       Settings door is written first and band.css gives it `order` on the Mac. */
    var sd = band.querySelector('[data-door="settings"]');


    /* the phone: a long press on the ⚙ is the theme (pbar.js, 11 Sep) */
    if (phone) {
      var t = 0;
      var longed = false;
      sd.addEventListener('pointerdown', function () { longed = false; t = setTimeout(function () { t = 0; longed = true; sd.setAttribute('data-dragged', ''); setTheme(themeNow() === 'dark' ? 'light' : 'dark'); }, 500); });
      sd.addEventListener('pointerup', function () { if (t) clearTimeout(t); t = 0; });
      sd.addEventListener('click', function (e) { if (longed) { e.preventDefault(); e.stopImmediatePropagation(); longed = false; setTimeout(function () { sd.removeAttribute('data-dragged'); }, 0); } }, true);   /* a long press is the theme, not also Settings (band Stranger 3) */
    }
    var sf = band.querySelector('.band-search input');
    if (sf) {
      var go = function () {
        var q = sf.value;
        if (inSet) { findSettings(q); sf.value = ''; sf.blur(); return; }
        if (window.SearchSurface && SearchSurface.open) { SearchSurface.open(q); sf.value = ''; sf.blur(); }
        band.dispatchEvent(new CustomEvent('band:surface', { bubbles: true, detail: { q: q } }));
      };
      sf.addEventListener('input', function () { if (sf.value) go(); });
      sf.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } if (e.key === 'Escape') { sf.value = ''; sf.blur(); } });
      document.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && sf.isConnected && sf.offsetParent) { e.preventDefault(); e.stopImmediatePropagation(); sf.focus(); } }, true);
    }
    /* on Settings: the one search opens Settings' own find (settings-look.js SettingsFind; on the canvas the frame's),
       and the ⚙ pressed again closes Settings -- back to where you were, the shelf if there is nowhere */
    function findSettings(q) {
      var ev = new CustomEvent('band:settingsfind', { bubbles: true, cancelable: true, detail: { q: q || '' } });
      if (band.dispatchEvent(ev) && window.SettingsFind) SettingsFind.open(q || '');
    }
    if (inSet) sd.addEventListener('click', function (e) {
      if (sd.hasAttribute('data-dragged') || !band.isConnected) return;   /* a band already taken down (the canvas redrew it) has nothing to close */
      e.preventDefault();
      var ev = new CustomEvent('band:closesettings', { bubbles: true, cancelable: true });
      if (band.dispatchEvent(ev)) { if (history.length > 1) history.back(); else location.href = hrefs.library; }
    });
    band.querySelector('[data-door="surface"]').addEventListener('click', function () {
      if (inSet) { findSettings(''); return; }
      if (window.SearchSurface && SearchSurface.open) SearchSurface.open('');
      band.dispatchEvent(new CustomEvent('band:surface', { bubbles: true }));
    });
    /* the phone's pill: a tap is the Surface; a drag UP (past a --tap) is the shelf --
       Osca 10 Sep, "no library button, the gesture is the door" (pbar.js's hand,
       drawn here until the export re-wires pbar under the band) */
    if (phone) (function (pill) {
      var y0 = null;
      pill.addEventListener('pointerdown', function (e) { if (e.target.tagName === 'INPUT') return; y0 = e.clientY; try { pill.setPointerCapture(e.pointerId); } catch (x) {} });
      pill.addEventListener('pointermove', function (e) { if (y0 != null) band.style.setProperty('--band-lift', Math.max(0, Math.min(44, y0 - e.clientY)) + 'px'); });
      pill.addEventListener('pointerup', function (e) {
        var dy = y0 == null ? 0 : y0 - e.clientY; y0 = null; band.style.removeProperty('--band-lift');
        /* a short flick is neither a tap nor the shelf (the first-time Stranger, 29 Sep: a 41 px flick up counted as a
           tap and opened search): any travel past a few px springs back and opens nothing; a tap is a finger that
           did not move */
        if (Math.abs(dy) > 8 && dy <= 44) { pill.setAttribute('data-dragged', ''); setTimeout(function () { pill.removeAttribute('data-dragged'); }, 0); }
        if (dy > 44) {
          pill.setAttribute('data-dragged', '');
          setTimeout(function () { pill.removeAttribute('data-dragged'); }, 0);
          var ev = new CustomEvent('band:library', { bubbles: true, cancelable: true });
          if (band.dispatchEvent(ev)) location.href = hrefs.library;
        }
      });
    })(band.querySelector('.band-pill'));
    if (phone) band.querySelector('.band-pill').addEventListener('click', function (e) {
      if (this.hasAttribute('data-dragged') || e.target.tagName === 'INPUT') return;   /* a press in the pill's own field is typing (PHONE-PASS) */
      if (inSet) { findSettings(''); return; }
      if (window.SearchSurface && SearchSurface.open) SearchSurface.open('');
      band.dispatchEvent(new CustomEvent('band:surface', { bubbles: true }));
    });

    if (phone) (function (mic) {
      if (!mic) return;
      function pill() { return document.querySelector('.voiceui-pill'); }
      function on(v) { mic.setAttribute('aria-pressed', v ? 'true' : 'false'); mic.setAttribute('aria-label', v ? 'Stop listening' : 'Listen'); if (v) R.setAttribute('data-listening', ''); else R.removeAttribute('data-listening'); }
      var seen = null;
      function follow() {
        var p = pill(); if (!p || seen === p) return; seen = p;
        var read = function () { var st = p.getAttribute('data-state'); on(st === 'armed' || st === 'listening' || st === 'busy'); };
        new MutationObserver(read).observe(p, { attributes: true, attributeFilter: ['data-state'] }); read();
      }
      follow();
      mic.addEventListener('click', function (e) {
        e.preventDefault();
        var p = pill(), t = p && p.querySelector('.voiceui-toggle');
        if (t) { follow(); t.click(); return; }                     /* the real mic: voiceui says whether it listens */
        var v = mic.getAttribute('aria-pressed') !== 'true'; on(v);   /* the design stand-in: no live mic here */
        band.dispatchEvent(new CustomEvent('band:mic', { bubbles: true, detail: { listening: v } }));
      });
    })(band.querySelector('.band-mic'));

    host.appendChild(band);
    R.setAttribute('data-band', page);
    if (book && !phone && opts.hide) autoHide(band);
    if (book && phone) { awayAsYouRead(band); oneWordExit(band); }
    /* THE ▶ IN THE PILL (Osca, 29 Sep: one row at the phone's foot, not a player stacked on the band). On a book the
       band carries the reader's Play at the pill's left; a press is the reader's own ▶ (#pplaygo). While it plays the
       player capsule rises (shell.css) and this one steps aside. Shown only when the book has a voice to play
       (html[data-voice], written by the reader's player). */
    if (book && phone) {
      var play = document.createElement('button');
      play.type = 'button'; play.className = 'band-play'; play.setAttribute('aria-label', 'Play');
      /* ONE ▶ (ASKS #103, the Stranger: "the play control is two different objects on the Mac and the phone"): the
         reader's own glyph, drawn at the reader's proportion (glyph 0.44 of the disc), so the phone's pill, its player
         and the Mac's capsule show one ▶. */
      play.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 4.2 15.6 10 6.4 15.8z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      play.addEventListener('click', function (e) {
        e.stopPropagation();
        var ev = new CustomEvent('band:play', { bubbles: true, cancelable: true });
        if (band.dispatchEvent(ev)) { var go = document.getElementById('pplaygo'); if (go) go.click(); }
      });
      band.querySelector('.band-in').appendChild(play);
    }
    return band;
  }

  /* THE BOOK BAND GOES WITH THE PAGE (Osca, 28 Sep, DESIGN session, after the
     band Stranger): "as you scroll down, the page moves up, so it NEVER
     jumps". On a book on the Mac and the web the band is sticky at the top and
     is carried up by exactly the distance the text scrolls down -- it leaves
     with the page, never on a timer, and leaves no empty strip. Scrolling up
     brings it down by the same distance; the pointer near the top of the
     window brings it all the way back. Esc is NOT a reveal (it leaves the
     book, S3). The phone's bar hides by its own hand (pbar.js). */
  function autoHide(band) { return ride(band); }
  /* ON THE PHONE THE BARS GO AS YOU READ (Osca, 29 Sep: "the bars AND the scroll bar should disappear on the phone as
     you read"). Reading forward (a scroll down of more than 12 px) takes the band, the player and the book's scroll
     bar away together; any scroll back, reaching the end, or a press on the band's edge brings them back. One flag on
     <html>, data-away, and each piece's own css answers it (band.css, shell.css), so nothing counts pixels twice.
     Photos does the same with its capsules. */
  function awayAsYouRead(band) {
    var R = document.documentElement, last = {}, acc = 0, hand = 0;
    /* a page restoring its place is not reading -- and nor is a press on the chrome: ▶ pressed in the pill made the
       voice's first page turn count as a hand and took the bars (and the player just asked for) away (ASKS #195) */
    var CHROME = '.band, .pplay, .mplay, .phlayers, .sf, .marghand';
    ['touchmove', 'wheel', 'keydown', 'pointerdown'].forEach(function (t) { addEventListener(t, function (e) { var g = e.target; if (g && g.closest && g.closest(CHROME)) return; hand = Date.now(); }, { capture: true, passive: true }); });
    function set(away) { if (away === R.hasAttribute('data-away')) return; if (away) R.setAttribute('data-away', ''); else R.removeAttribute('data-away'); }
    document.addEventListener('scroll', function (e) {
      var el = e.target === document ? document.scrollingElement : e.target; if (!el || el.contains(band)) return;
      var k = el === document.scrollingElement ? 'doc' : (el.id || el.className || 'x'), y = el.scrollTop;
      if (last[k] == null) { last[k] = y; return; }
      var dy = y - last[k]; last[k] = y;
      acc = (dy > 0) === (acc > 0) ? acc + dy : dy;
      if (acc > 12) { if (Date.now() - hand < 1000) set(true); }
      else if (acc < -12 || y + el.clientHeight >= el.scrollHeight - 2) set(false);
    }, { capture: true, passive: true });
    band.addEventListener('focusin', function () { set(false); });
    band.addEventListener('ride:show', function () { set(false); });
  }
  /* ONE PRESS OUT OF ONE WORD (ASKS #188). On the phone, while the book is in One word, the pill's centre is a
     "‹ Page" key and a press on it is the view key: back to the page, at the word you were on. Why the pill and not
     the word's own label (Photos, FROM FIRST PRINCIPLES 2 and 4): Photos never leaves you in an opened thing without
     its way back in one fixed place, the same place every time, named for where it goes -- and the pill is where the
     thumb already is on every phone page. The label over the word says where you are in the book (a label); making
     it the exit would make a label do a door's job (rule 7) and it moves with the word's size. Drag up stays the
     shelf. The one-word view is the reader's `.wordview.on` -- in this document (the reader), or in the canvas's
     same-origin frame that draws the reader under band.html's band. A press asks `band:page` first (cancelable),
     then presses the reader's own view key (V: nav.go(0)). */
  function wordDoc() {
    if (document.querySelector('.wordview')) return document;
    var fs = document.querySelectorAll('iframe');
    for (var i = 0; i < fs.length; i++) { try { var d = fs[i].contentDocument; if (d && d.querySelector('.wordview')) return d; } catch (e) {} }
    return null;
  }
  function toPage(band) {
    var ev = new CustomEvent('band:page', { bubbles: true, cancelable: true });
    if (!band.dispatchEvent(ev)) return;
    var d = wordDoc(), w = d && d.defaultView; if (!w || !d.querySelector('.wordview.on')) return;
    try { w.focus(); } catch (e) {}
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true, cancelable: true }));
  }
  function oneWordExit(band) {
    var pill = band.querySelector('.band-pill'), label = pill && pill.getAttribute('aria-label');
    function read() {
      if (!band.isConnected) { clearInterval(t); return; }
      var d = wordDoc(), on = !!(d && d.querySelector('.wordview.on'));
      if (on === band.hasAttribute('data-word')) return;
      if (on) { band.setAttribute('data-word', ''); R.removeAttribute('data-away'); pill.setAttribute('aria-label', 'Page — back to the page'); }   /* the way out is always shown */
      else { band.removeAttribute('data-word'); pill.setAttribute('aria-label', label); }
    }
    var t = setInterval(read, 200); read();
    /* taken at the WINDOW's capture, ahead of anyone's document-level click (the canvas's own press map opens the
       sheet for a pill press): in One word a press on the pill is the page and nothing else */
    addEventListener('click', function (e) {
      if (!band.hasAttribute('data-word') || !pill.contains(e.target) || pill.hasAttribute('data-dragged')) return;
      e.preventDefault(); e.stopImmediatePropagation(); toPage(band);
    }, true);
  }
  /* any element that rides the page the same way (the phone's layer strip too) */
  function ride(band) {
    var off = 0, lastY = {}, H = function () { return band.offsetHeight; };
    function put(v, glide) {
      off = Math.max(0, Math.min(H(), v));
      band.style.transition = glide ? 'transform .18s ease' : 'none';
      band.style.setProperty('--band-off', off + 'px');
      if (off >= H()) band.setAttribute('data-shown', 'off'); else band.removeAttribute('data-shown');
    }
    document.addEventListener('scroll', function (e) {
      var el = e.target === document ? document.scrollingElement : e.target;
      if (el !== document.scrollingElement && !el.contains(band)) return;   /* only the scroller the band rides in */
      var k = el === document.scrollingElement ? 'doc' : (el.id || el.className), y = el.scrollTop;
      if (lastY[k] != null) put(off + (y - lastY[k]), false);
      lastY[k] = y;
    }, { capture: true, passive: true });
    /* the window's top is the top of the scroller the band rides in (band Stranger 2:
       the band's parent can be a 0 x 0 box), or the viewport's */
    function scroller() { for (var n = band.parentElement; n; n = n.parentElement) { var o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n; } return null; }
    function topOf() { var sc = scroller(); return sc ? sc.getBoundingClientRect().top : 0; }
    document.addEventListener('pointermove', function (e) {
      if (off && e.clientY - topOf() < H()) put(0, true);
    }, { passive: true });
    /* seed where the scroller is now, so the first wheel tick after arriving counts */
    setTimeout(function () { var sc = scroller(); if (sc) lastY[sc.id || sc.className] = sc.scrollTop; else lastY.doc = (document.scrollingElement || {}).scrollTop || 0; }, 0);
    band.addEventListener('focusin', function () { put(0, true); });
    put(0, false);
    band.addEventListener('ride:show', function () { put(0, true); });   /* anyone can call it back: el.dispatchEvent(new Event('ride:show')) */
    return { show: function () { put(0, true); } };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* THE CHAPTER, SAID ONCE (Osca, 29 Sep: "You don't need to say chapter 1. AND I am born ... the name of the chapter,
     OR JUST the names, nothing else ... if you do number a chapter roman numerals work very well ... sometimes there
     are LOADS more chapters, in which case a combination of roman and arabic numerals"). A chapter with a name is its
     name: "Chapter 1. I Am Born" -> "I Am Born". A chapter that is only a number is that number in Roman: "Chapter
     14" -> "XIV". A chapter inside a book or part is the part in Roman and the chapter in Arabic: "Book II, Chapter
     14" -> "II.14". Anything else (a play's "Act 2", a named section) is left as the book has it. */
  function roman(n) {
    n = +n; if (!(n > 0 && n < 4000)) return String(n);
    var r = '', t = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    t.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }
  function arabic(s) {
    if (/^\d+$/.test(s)) return +s;
    var v = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }, t = 0, a = String(s).toLowerCase();
    for (var i = 0; i < a.length; i++) { var c = v[a[i]], nx = v[a[i + 1]] || 0; if (!c) return null; t += c < nx ? -c : c; }
    return t;
  }
  var NUM = '(\\d+|[ivxlcdm]+)';
  /* a name set in capitals by the book's source reads as shouting in a pill: "A LAST RETROSPECT" -> "A Last Retrospect" */
  function unshout(t) {
    if (!t || /[a-z]/.test(t) || !/[A-Z]{3}/.test(t)) return t;
    var small = /^(a|an|and|as|at|but|by|for|in|of|on|or|the|to|with)$/;
    return t.toLowerCase().replace(/[a-z\u00e0-\u00ff']+/g, function (w, i) { return i > 0 && small.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1); });
  }
  function chapterLabel(raw) { return unshout(label(raw)); }
  function label(raw) {
    var s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().replace(/\.$/, ''), m;
    if (!s) return '';
    m = s.match(new RegExp('^(?:book|part|volume|vol\\.?)\\s+' + NUM + '[\\s.,:;\\-\u2013\u2014\u00b7]*(?:chapter|chap\\.?|ch\\.?)\\s+' + NUM + '\\b[\\s.:;\\-\u2013\u2014\u00b7]*(.*)$', 'i'));
    if (m) { var p = arabic(m[1]), c = arabic(m[2]); return m[3] ? m[3] : (p && c ? roman(p) + '.' + c : s); }
    m = s.match(new RegExp('^(?:chapter|chap\\.?|ch\\.?)\\s+' + NUM + '\\b[\\s.:;\\-\u2013\u2014\u00b7]*(.*)$', 'i'));
    if (m) { var n = arabic(m[1]); return m[2] ? m[2] : (n ? roman(n) : s); }
    m = s.match(new RegExp('^' + NUM + '$', 'i'));
    if (m) { var k = arabic(m[1]); return k ? roman(k) : s; }
    return s;
  }

  window.Band = { mount: mount, setTheme: setTheme, themeNow: themeNow, glyphs: G, ride: ride, chapterLabel: chapterLabel, roman: roman };
})();
