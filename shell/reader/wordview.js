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

   THE MARKER, AND WHAT NEVER ENTERS THE SLOT (D18, Osca, 28 Sep: *"I do NOT
   think the headings, markers etc should be in the one-word view AS IN, BE
   the one word -- they should be smaller, like a little mini header or
   something... it's like metadata stuff, not true reading."*). A heading, a
   unit number (XVII, Sonnet 18, Part Two), a running head, a section mark, a
   footnote number is APPARATUS: it never occupies the slot. It is drawn as a
   small marker ABOVE the word -- the chrome face, --ui-fine, the same size and
   the same place every time (centred on the pivot column, --gap x 2 above the
   word's top) -- showing the LABEL of the unit the word is in: Book.structure's
   own title for a unit below the chapter (the sonnet's number, the maxim's),
   the chapter's own label otherwise, with the part it sits in dimmer before
   it. It changes only on CROSSING into the next unit (`data-ev="unit"` is
   re-stamped, the editor's `unit` event) and the slot keeps flowing. The voice
   is untouched: it may read the number; the eye is not asked to.

   WHICH WORDS ARE APPARATUS is `apparatus(text, kind)` below, one rule for
   the reader (book-nav.js's DOM index) and the float (floatdoor.js's payload)
   alike, so the two can never disagree about a word:
     (1) the parser's own word -- `Paragraph.kind` heading | note | caption
         (book-data.js `k`, page.js `data-kind`);
     (2) a bare number -- roman or arabic, brackets or a full stop allowed:
         "II", "18", "(3)", "§ 4";
     (3) a conventional unit label -- CHAPTER 3, Sonnet XVIII, Part Two, ACT I,
         SCENE II, Book IV, Canto X, Psalm 23, Maxime 12;
     (4) a PROSE line at a unit's own start whose text is the unit's title
         (Hamlet's "Scene 1"). A VERSE line equal to the title is BODY: in the
         Vita Nuova and the Penguin book a poem's title IS its first line, 32
         and 234 times, and a first line is reading.
   Measured over the shelf, 28 Sep: 0 of 269,225 paragraphs carry `k`, so (1)
   costs nothing today and is right the day the bake writes it; (2) catches
   Blood Meridian's 92 chapter numerals, the 154 sonnet numbers and the 627
   maxim numbers; (4) the 20 scene labels in Hamlet.

   mount(o) -> a handle:
     set(text, px, font)  the word on screen, at that em, in that face
                          (font = {family, style, weight} off the page's own
                          paragraph, so the page's word and this one are the
                          same glyphs). Same arguments = no work at all.
     show()/hide()        the view is the screen, or it is not
     resize()             re-place it (the app calls this on a real resize)
     pivotRect()          the red letter's box, in viewport pixels
     wordRect()           the whole word's box (its text, not its div)
     setMark(label, of)   the marker's text: the unit's label, and the part it
                          sits in (dim, may be ""). Same text = no work, no
                          event; a change re-stamps data-ev="unit".
     markRect()           the marker's box, in viewport pixels
     el / word / pv / mark  the elements, for a bench that wants to measure them
     orp(text)            which letter is the pivot, for anyone who asks
   apparatus(text, kind)  true when this paragraph's text is apparatus (above)
   unitsIn(structure, chapterId) -> [{w, title}] the units below this chapter
                          that know their first word, sorted by w
   chapterLabel(ch)       "II" / "Chapter 1 · I Am Born" off book-data's n + t
========================================================================== */
(function(root){
  "use strict";

  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

  const DEFAULTS = {
    min:   8,      // px -- below this it is not worth drawing
    max:   1400,   // px -- so a mis-set dial cannot ask for a metre of type
    pivot: 0.5,    // the column the red letter stands on: the screen's dead centre (ASKS #143, Osca 29 Sep: "not 42%")
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

  /* ============ APPARATUS: the rule, once ============ (the head says why) */
  const AP_KIND = { heading: 1, note: 1, caption: 1 };
  const AP_NUMBER = /^[\(\[\u00A7\s]*(?:[IVXLCDM]+|[ivxlcdm]+|\d+)[\.\)\]]?$/;
  const AP_LABEL  = /^(?:chapter|chap|book|part|section|sonnet|canto|act|scene|psalm|maxime|maxim|letter|stanza|fragment|liber|caput)\s*[\.:]?\s*(?:[IVXLCDM]+|[ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|first|second|third|fourth|fifth)\s*[\.\):]?$/i;
  function norm(t){ return String(t || "").trim().replace(/\s+/g, " ").replace(/[\.\s]+$/, "").toLowerCase(); }
  /* text: the whole paragraph; kind: the parser's `kind` ("" when body);
     unit: the unit that STARTS on this paragraph, if one does ({title});
     verse: true when the paragraph is a line of verse (book-data `st`). */
  function apparatus(text, kind, unit, verse){
    const t = String(text || "").trim();
    if(!t) return false;
    if(kind && AP_KIND[kind]) return true;
    if(t.length <= 24 && AP_NUMBER.test(t)) return true;
    if(t.length <= 40 && AP_LABEL.test(t)) return true;
    if(unit && !verse && unit.title && norm(unit.title) === norm(t)) return true;
    return false;
  }
  /* AND THE UNIT'S NUMBER WRITTEN INTO ITS FIRST LINE -- "1. Disproportion de
     l'homme." (Pascal, Emerson, Spinoza): the first TOKEN of the paragraph a
     unit starts on, when it is a bare number, is apparatus on its own, and the
     rest of the paragraph is reading. */
  function apparatusToken(tok, first, unit){
    return !!(first && unit && AP_NUMBER.test(String(tok || "")));
  }
  function unitsIn(structure, chapterId){
    const out = [];
    (function walk(ns){
      (ns || []).forEach(n => {
        if(n && n.chapter === chapterId && typeof n.w === "number") out.push({ w: n.w, title: String(n.title || "").trim(), kind: n.kind || "" });
        if(n && n.children && n.children.length) walk(n.children);
      });
    })(structure || []);
    out.sort((a, b) => a.w - b.w);
    return out;
  }
  /* THE CHAPTER, SAID ONCE (Osca, 29 Sep; band.js chapterLabel is the same rule for the band): its name if it has
     one ("I Am Born", not "Chapter 1 · I Am Born"); a bare number in Roman ("XIV"); a chapter in a book or part as
     the part in Roman and the chapter in Arabic ("II.14"). The page, the one word and the float say it the same way. */
  function romanOf(v){
    v = +v; if(!(v > 0 && v < 4000)) return String(v);
    let r = ""; [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]
      .forEach(p => { while(v >= p[0]){ r += p[1]; v -= p[0]; } });
    return r;
  }
  function numOf(x){
    if(/^\d+$/.test(x)) return +x;
    const v = {i:1,v:5,x:10,l:50,c:100,d:500,m:1000}, a = String(x).toLowerCase(); let t = 0;
    for(let i = 0; i < a.length; i++){ const c = v[a[i]], nx = v[a[i+1]] || 0; if(!c) return null; t += c < nx ? -c : c; }
    return t;
  }
  function chapterLabel(ch){
    if(!ch) return "";
    if(root.Band && root.Band.chapterLabel){
      const t0 = String(ch.t || "").trim();
      return t0 ? root.Band.chapterLabel("Chapter 1. " + t0) : root.Band.chapterLabel(String(ch.n || ""));
    }
    const n = String(ch.n || "").trim().replace(/[\.\s]+$/, "").replace(/\s+/g, " ");
    const t = String(ch.t || "").trim().replace(/\.$/, "");
    if(t) return t;
    let m = n.match(/^(?:book|part|volume|vol\.?)\s+(\d+|[ivxlcdm]+)[\s.,:;]*(?:chapter|chap\.?|ch\.?)\s+(\d+|[ivxlcdm]+)$/i);
    if(m && numOf(m[1]) && numOf(m[2])) return romanOf(numOf(m[1])) + "." + numOf(m[2]);
    m = n.match(/^(?:(?:chapter|chap\.?|ch\.?)\s+)?(\d+|[ivxlcdm]+)$/i);
    if(m && numOf(m[1])) return romanOf(numOf(m[1]));
    return n;
  }
  /* THE MARKS OF A CHAPTER, walked the one way every word index is walked:
     every block but sp/dir/fig, tokens split on whitespace. Returns
     { ap: [bool per word], marks: [{i, label, of}] sorted by i } -- the float
     builds its payload off this, and book-nav.js's DOM walk applies the same
     three functions to the page's own paragraphs, so the two agree. */
  function chapterMarks(ch, structure){
    const ap = [], marks = [];
    if(!ch) return { ap, marks };
    const units = unitsIn(structure, ch.id), label = chapterLabel(ch);
    let u = 0, n = 0;
    marks.push({ i: 0, label: label, of: "" });
    (ch.blocks || []).forEach(b => {
      if(!b || b.r === "sp" || b.r === "dir" || b.r === "fig") return;
      const toks = String(b.t || "").split(/\s+/).filter(Boolean);
      if(!toks.length) return;
      while(u < units.length && units[u].w < n) u++;
      const unit = (u < units.length && units[u].w === n) ? units[u] : null;
      const verse = b.st !== undefined && b.st !== null;
      const whole = apparatus(b.t, b.k || "", unit, verse);
      if(unit){ marks.push({ i: n, label: unit.title || label, of: label }); }
      else if(b.k === "heading"){ marks.push({ i: n, label: String(b.t || "").trim(), of: label }); }
      for(let j = 0; j < toks.length; j++) ap.push(whole || apparatusToken(toks[j], j === 0, unit));
      n += toks.length;
    });
    /* one mark per index: a unit starting at 0 replaces the chapter's own */
    const byI = new Map(); marks.forEach(m => byI.set(m.i, m));
    return { ap, marks: Array.from(byI.values()).sort((a, b) => a.i - b.i) };
  }
  function markAt(marks, i){
    let m = null;
    for(let k = 0; k < (marks || []).length; k++){ if(marks[k].i <= i) m = marks[k]; else break; }
    return m;
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
    /* THE MARKER: above the word, in the chrome face, empty until told */
    const mark = doc.createElement("div");
    mark.className = "wordview-mark";
    const mOf = doc.createElement("span"), mLabel = doc.createElement("span");
    mOf.className = "of"; mLabel.className = "label";
    mark.appendChild(mOf); mark.appendChild(mLabel);
    host.appendChild(mark);
    let markText = "", markOf = "";
    /* mounted before <body> exists is not an error -- the shell loads its
       modules in the head and hands them a parent later. */
    (o.parent || doc.body || doc.documentElement).appendChild(host);

    let cur = null, on = false, size = 0, face = "", fitted = 0;

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
      if(size > 0) box.style.fontSize = size.toFixed(3) + "px";     // start from the told em every time (a resize may give it room back)
      /* THE GUTTERS, one number for the word and the marker: 32 px, or the safe inset + 16 where that is more */
      const cs0 = win.getComputedStyle ? win.getComputedStyle(doc.documentElement) : null;
      const side0 = cs0 ? Math.max(parseFloat(cs0.getPropertyValue("--safe-left")) || 0, parseFloat(cs0.getPropertyValue("--safe-right")) || 0) : 0;
      const gut = Math.max(32, side0 + 16);
      let b = box.getBoundingClientRect ? box.getBoundingClientRect() : null;
      let p = pv.getBoundingClientRect ? pv.getBoundingClientRect() : null;
      if(!b || !p) return;
      /* EVERY WORD FITS (ASKS #177, the phone Stranger: "Correspondance" ran off the right edge). A word wider than
         the space between the gutters is set smaller -- by exactly the ratio that makes it fit -- and one that
         fits keeps the told size. Only the too-long word changes height; it is never clipped. */
      const room = vw - 2 * gut;
      fitted = size;
      if(vw > 0 && room > 0 && b.width > room){
        fitted = Math.max(cfg.min, size * room / b.width * 0.995);
        box.style.fontSize = fitted.toFixed(3) + "px";
        b = box.getBoundingClientRect(); p = pv.getBoundingClientRect();
      }
      let x = vw * cfg.pivot - ((p.left - b.left) + p.width / 2);
      /* ...and the red letter stays on the dead centre whenever the word's two sides both fit there; when one side
         cannot, the word moves by just that much and no more (the letter is still the word's own) */
      if(vw > 0){
        if(x < gut) x = gut;
        else if(x + b.width > vw - gut) x = Math.max(gut, vw - gut - b.width);
      }
      const y = vh * cfg.y - b.height / 2;
      box.style.left = x.toFixed(2) + "px";
      box.style.top = y.toFixed(2) + "px";
      /* the marker: centred on the pivot column, its foot --gap x 2 above the
         word's top. Nothing about the WORD is in this: the column is a
         fraction of the frame and the word's top is the em and the frame, so
         the marker stands in one place for a whole chapter (D18, "the same
         size and place every time"). */
      /* ASKS #110 (the one-word Stranger: "the label clipped, off the column"): the marker keeps inside the page's
         margins on BOTH sides of the pivot -- the nearer side sets its width -- and a running head longer than that
         goes to a second centred line rather than off the glass or into "…". Its foot stays where it was. */
      const px = vw * cfg.pivot, edge = gut, half = Math.min(px, vw - px) - edge;
      if(half > 40) mark.style.maxWidth = Math.floor(2 * half) + "px";
      const mr = mark.getBoundingClientRect ? mark.getBoundingClientRect() : null;
      if(mr){
        const gap = markGap();
        mark.style.left = (vw * cfg.pivot - mr.width / 2).toFixed(2) + "px";
        mark.style.top = (y - gap - mr.height).toFixed(2) + "px";
      }
    }
    function markGap(){
      try{
        const g = parseFloat((doc.defaultView || window).getComputedStyle(mark).getPropertyValue("--mark-gap"));
        return g > 0 ? g : 16;
      }catch(_){ return 16; }
    }
    function setMark(label, of){
      label = label == null ? "" : String(label); of = of == null ? "" : String(of);
      if(label === markText && of === markOf) return false;
      markText = label; markOf = of;
      mLabel.textContent = label; mOf.textContent = of;
      mark.classList.toggle("on", !!label);
      /* THE CROSSING IS AN EVENT: re-stamping the attribute restarts the
         entrance the design gave it (the editor's `unit`); the word is not
         touched. */
      mark.removeAttribute("data-ev"); void mark.offsetWidth; mark.setAttribute("data-ev", "unit");
      place();
      return true;
    }
    function markRect(){ return mark.getBoundingClientRect ? mark.getBoundingClientRect() : null; }
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
      el: host, word: box, pv, mark, set, setMark, markRect, show, hide, pivotRect, wordRect,
      resize: () => place(),
      get markText(){ return markText; },
      get markOf(){ return markOf; },
      get showing(){ return on; },
      get text(){ return cur; },
      get size(){ return size; },
      get fitted(){ return fitted; },     // the em actually drawn: `size`, or less for a word too long to fit (#177)
      cfg, orp
    };
  }

  const api = { mount, DEFAULTS, orp, pivotIndex, apparatus, apparatusToken, unitsIn, chapterLabel, chapterMarks, markAt };
  if(typeof module === "object" && module.exports) module.exports = api;
  (root || this).WordView = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
