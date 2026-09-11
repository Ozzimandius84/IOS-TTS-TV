/* ENGINE · ONE WORD, ALONE -- the one-word view: one word, its red pivot letter held on one column
   · bench: bench-word.html · mounted by: book-nav.js (WordView.mount) */
/* ====================== THE ONE-WORD VIEW ================================
   Osca, 10 September, the design exactly: *"the one-word view is its own
   surface -- one word, the red ORP marker, the subtitle line at the foot, and
   instant word changes when stepping. It is not the page."*

   So this is a SURFACE and nothing else. It owns the whole screen, it draws
   one word on the page's own ground in the page's own ink, and there is no
   page underneath it to lose, clip, anchor or re-wrap. (The subtitle is
   wordpane.js's; it sits over this at the foot.)

   THE RED LETTER, AND WHY THE WORD IS NOT CENTRED. The approved prototype
   (`out/reader-oneword/proto.html`, carried into the old reader as
   `reader/_to_delete/oneword.js`) had the rule, and it is lifted here
   verbatim: the eye's optimal recognition point is a LETTER, left of the
   word's middle -- letter 0/1/2/3/4 for words of 1 / 2-5 / 6-9 / 10-13 / 14+
   letters, counted on letters only so "Tityre," pivots on its word and not
   on its comma. That letter is drawn in the pivot red, and the WHOLE WORD is
   placed so that letter's centre stands on one fixed column -- 42% of the
   frame, the prototype's own number. Centre the word instead and the eye
   moves on every word, which is the one thing this view exists to prevent.

   INSTANT. The next word is a different string in the same three spans and a
   new `left`, written and measured in the same task -- so it is on the very
   next frame, and nothing travels, fades or slides. Same text and size is no
   work at all.

   THE SIZE IS TOLD, NOT MEASURED. One em, named in pixels by book-nav from
   the height dial (Osca, 10 Sep: "no variation in height, of words, only
   length"). A longer word is a wider word and nothing else.

   AND IT CAN BE ASKED WHERE IT WILL BE BEFORE IT IS SHOWN. The zoom lands the
   page's own word exactly where this one stands, so the handover is a single
   invisible frame -- which needs this view laid out while it is still hidden
   (`visibility:hidden` keeps layout) and asked for its pivot's box. That is
   `pivotRect()`; book-nav aims the page at it.

   mount(o) -> a handle:
     set(text, px, font)  the word on screen, at that em, in that face
                          (font = {family, style, weight} off the page's own
                          paragraph, so the page's word and this one are the
                          same glyphs). Same arguments = no work at all.
     show()/hide()        the view is the screen, or it is not
     resize()             re-place it (the app calls this on a real resize)
     pivotRect()          the red letter's box, in viewport pixels
     wordRect()           the whole word's box (its text, not its div)
     el / word / pv       the elements, for a bench that wants to measure them
     orp(text)            which letter is the pivot, for anyone who asks
========================================================================== */
(function(root){
  "use strict";

  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

  const DEFAULTS = {
    min:   8,      // px -- below this it is not worth drawing
    max:   1400,   // px -- so a mis-set dial cannot ask for a metre of type
    pivot: 0.42,   // the column the red letter stands on, as a fraction of the width
    y:     0.5,    // ...and the height the word's middle stands at
  };

  /* OPTIMAL RECOGNITION POINT -- the prototype's table, unchanged. Letters only:
     "Tityre," pivots on its word, not on its comma. (The letter class is
     written in \u escapes, not as the prototype's literal range: a page that
     reaches this file without a charset reads those two bytes as Latin-1, and
     the class becomes "range out of order" -- the whole view fails to mount.) */
  const LETTER = /[A-Za-z\u00C0-\u024F0-9']/;
  function orp(w){
    w = String(w || "");
    const n = w.replace(/[^A-Za-z\u00C0-\u024F0-9']/g, "").length || w.length;
    if(n <= 1) return 0;
    if(n <= 5) return 1;
    if(n <= 9) return 2;
    if(n <= 13) return 3;
    return 4;
  }
  /* the pivot as an index into the STRING: the orp-th letter, skipping any
     punctuation in front of it, so "(and" and "'Tis" pivot on letters too. */
  function pivotIndex(w){
    w = String(w || "");
    if(!w) return 0;
    const k = orp(w);
    let seen = -1;
    for(let i = 0; i < w.length; i++){
      if(LETTER.test(w[i])){ seen++; if(seen === k) return i; }
    }
    return Math.min(k, w.length - 1);
  }

  function mount(o){
    o = o || {};
    const cfg = Object.assign({}, DEFAULTS, o.cfg || {});
    const doc = (o.parent && o.parent.ownerDocument) || (typeof document !== "undefined" ? document : null);
    const host = doc.createElement("div");
    host.className = "wordview";
    host.setAttribute("aria-hidden", "true");
    const box = doc.createElement("div");
    box.className = "wordview-word";
    const pre = doc.createElement("span"), pv = doc.createElement("span"), post = doc.createElement("span");
    pv.className = "pv";
    box.appendChild(pre); box.appendChild(pv); box.appendChild(post);
    host.appendChild(box);
    /* mounted before <body> exists is not an error -- the shell loads its
       modules in the head and hands them a parent later. */
    (o.parent || doc.body || doc.documentElement).appendChild(host);

    let cur = null, on = false, size = 0, face = "";

    /* ONE PLACEMENT, AND IT IS A MEASUREMENT OF THE LETTER, NOT THE WORD. The
       box goes to the pivot column with the letter's own offset taken off, so
       it is exact to the fraction of a pixel whatever the word -- `offsetLeft`
       rounds, and a pivot that wanders a pixel a word is the fault this view
       exists not to have (the prototype measured the same thing). */
    function place(){
      const win = doc.defaultView || {};
      const vw = win.innerWidth || 0, vh = win.innerHeight || 0;
      box.style.left = "0px"; box.style.top = "0px";
      if(!cur) return;
      const b = box.getBoundingClientRect ? box.getBoundingClientRect() : null;
      const p = pv.getBoundingClientRect ? pv.getBoundingClientRect() : null;
      if(!b || !p) return;
      const x = vw * cfg.pivot - ((p.left - b.left) + p.width / 2);
      const y = vh * cfg.y - b.height / 2;
      box.style.left = x.toFixed(2) + "px";
      box.style.top = y.toFixed(2) + "px";
    }
    function fit(px){
      size = clamp(+px > 0 ? +px : cfg.min, cfg.min, cfg.max);
      box.style.fontSize = size.toFixed(3) + "px";
      return size;
    }
    function set(text, px, font){
      text = text == null ? "" : String(text);
      const w = clamp(+px > 0 ? +px : cfg.min, cfg.min, cfg.max);
      const f = font ? [font.family || "", font.style || "", font.weight || ""].join("|") : "";
      if(text === cur && w === size && f === face) return;
      cur = text; face = f;
      const k = pivotIndex(text);
      pre.textContent = text.slice(0, k);
      pv.textContent = text.slice(k, k + 1);
      post.textContent = text.slice(k + 1);
      box.style.fontFamily = (font && font.family) || "";
      box.style.fontStyle = (font && font.style) || "";
      box.style.fontWeight = (font && font.weight) || "";
      fit(w);
      place();
    }
    function show(){ if(on) return; on = true; host.classList.add("on"); }
    function hide(){ if(!on) return; on = false; host.classList.remove("on"); }
    function pivotRect(){ return pv.getBoundingClientRect ? pv.getBoundingClientRect() : null; }
    function wordRect(){
      if(!doc.createRange || !cur) return null;
      const r = doc.createRange(); r.selectNodeContents(box);
      return r.getBoundingClientRect();
    }

    return {
      el: host, word: box, pv, set, show, hide, pivotRect, wordRect,
      resize: () => place(),
      get showing(){ return on; },
      get text(){ return cur; },
      get size(){ return size; },
      cfg, orp
    };
  }

  const api = { mount, DEFAULTS, orp, pivotIndex };
  if(typeof module === "object" && module.exports) module.exports = api;
  (root || this).WordView = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
