/* ENGINE · ONE WORD, ALONE -- the whole of position +2
   · bench: bench-wordview.html · mounted by: book-nav.js (WordView.mount) */
/* ====================== THE ONE-WORD VIEW ================================
   Osca, 9 September, after filming both of them (IMG_0444, IMG_0445):

     *"ONE WORD VIEW is completely different. It is just one word at a time, no
     such thing as a line, every word individually. This is such that the reader
     doesn't have to move their eyes / view is very simple... one word view is a
     STABLE thing, in its own right. Words should not move inside it, just one,
     next one, reduce animation as much as possible inside this view. No
     box/highlight around the text should be present inside one word view."*

   WHAT THOSE TWO FILMS SHOWED, because it is the reason this file exists. The
   old +2 was not a view at all: it was the reading page, zoomed sixteen times,
   with the neighbours shoved sideways by a word-spacing. Every fault in the
   recordings falls straight out of that one fact --

     * whole frames are BLANK WHITE. At factor 16 the word is a small region of
       an enormous page, and any error in the anchor puts it off the screen.
       That is the stutter.
     * words come out CLIPPED -- "senile", "Wor", "muc", "min" all run off the
       edge, because the word is being positioned inside a giant page rather
       than laid out to fit a screen.
     * "out of" -- TWO words, the second dimmed. The parting was a word-spacing
       along a LINE, so a short word leaves its neighbour sitting right there.
       That is the "drag phenomena where words are on lines".
     * a pale BOX behind the word: ::highlight(word-target), the cursor mark,
       magnified sixteen times.
     * and stepping to the next word moved everything, because the next word
       meant re-anchoring a 16x page underneath you.

   None of that can be dialled out; the mechanism is the fault. So this is a
   VIEW. It owns the whole screen, it draws one word on the page's own paper,
   and there is no page underneath it to lose, clip, anchor or re-wrap. The
   next word is a different string in the same box: nothing moves, nothing
   fades, nothing slides -- "reduce animation as much as possible" is not a
   setting here, it is that there is no animation to reduce.

   THE SIZE IS MEASURED, NOT ZOOMED. The word is set at a reference size, its
   own box is read once, and the type is scaled so the word fills `fill` of the
   width and never more than `fillH` of the height. So "Wor" cannot be clipped
   and a one-letter word cannot be absurd: both are the same arithmetic on the
   word's own measured box, and it is redone on a resize and on nothing else.

   mount(o) -> a handle:
     set(text)     the word on screen. Same text = no work at all.
     show()/hide() the view is there, or it is not
     resize()      re-measure (the app calls this on a real resize)
     el            the element, for a bench that wants to measure it
========================================================================== */
(function(root){
  "use strict";

  function num(v, d){ v = +v; return isFinite(v) ? v : d; }
  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

  const DEFAULTS = {
    fill:  0.78,   // of the viewport's WIDTH the word is allowed to take
    fillH: 0.55,   // ...and never more than this much of its HEIGHT
    min:   18,     // px -- below this it is not worth drawing
    max:   1400,   // px -- the cap, so a one-letter word is not absurd
    ref:   200,    // px -- the size it is measured at, before scaling
  };

  function mount(o){
    o = o || {};
    const cfg = Object.assign({}, DEFAULTS, o.cfg || {});
    const host = document.createElement("div");
    host.className = "wordview";
    host.setAttribute("aria-hidden", "true");
    const box = document.createElement("div");
    box.className = "wordview-word";
    host.appendChild(box);
    /* mounted before <body> exists is not an error -- the shell loads its
       modules in the head and hands them a parent later. */
    (o.parent || document.body || document.documentElement).appendChild(host);

    let cur = null, on = false;

    /* ONE MEASURE, ONE WRITE. The word is set at `ref` px with the box's own
       face and its rect read once; the factor that makes it fill the frame is
       arithmetic on that rect. No loop, no binary search, and no second
       layout: `ref` is large enough that the ratio is stable and small enough
       that measuring it is cheap. */
    /* AND IT CAN BE TOLD EXACTLY HOW WIDE TO BE. Two independent sums for "how
       big is this word" do not agree, and a page and a view that disagree are
       a JUMP at the moment one hands over to the other: measured over fifty
       runs on the bench, the handover was out by x1.154 EVERY TIME -- a Range
       rect over real text and a div's own box are not the same measurement,
       and no amount of matching the fractions fixes that.

       So when book-nav hands over it says how wide the word is on the page at
       that instant, and the view simply becomes that. The fill fractions stay
       as the CEILING -- a word may never exceed the frame -- so this can make
       the handover seamless but cannot make the view wrong. */
    function fit(want){
      if(!cur) return 0;
      const vw = (o.width  ? o.width()  : 0) || window.innerWidth  || 1;
      const vh = (o.height ? o.height() : 0) || window.innerHeight || 1;
      box.style.fontSize = cfg.ref + "px";
      const r = box.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      const cap = Math.min(vw * cfg.fill / w, vh * cfg.fillH / h);
      const k = (want > 0) ? Math.min(want / w, cap) : cap;
      const size = clamp(cfg.ref * k, cfg.min, cfg.max);
      box.style.fontSize = size.toFixed(2) + "px";
      return size;
    }

    /* THE NEXT WORD IS A DIFFERENT STRING IN THE SAME BOX. Same text is not a
       repaint: a step that lands on the word already showing must cost
       nothing, or "words should not move inside it" is only true when the
       words happen to differ. */
    let wantW = 0;
    function set(text, want){
      text = text == null ? "" : String(text);
      const w = +want || 0;
      if(text === cur && w === wantW) return;
      cur = text; wantW = w;
      box.textContent = text;
      fit(wantW);
    }
    function show(){ if(on) return; on = true; host.classList.add("on"); fit(wantW); }
    function hide(){ if(!on) return; on = false; host.classList.remove("on"); }

    return {
      el: host, word: box, set, show, hide, resize: () => fit(wantW),
      get showing(){ return on; },
      get text(){ return cur; },
      get size(){ return parseFloat(box.style.fontSize) || 0; },
      cfg
    };
  }

  const api = { mount, DEFAULTS };
  if(typeof module === "object" && module.exports) module.exports = api;
  (root || this).WordView = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
