/* ENGINE · the last pane -- the line the word came from, the rail under it, and when it sleeps
   · bench: word.html · mounted by: book-nav.js (WordPane.mount) */
/* ====================== THE ONE-WORD PANE =================================
   Osca, 6 September: "THE LAST PANE IS ITS OWN ASSET: the one-word pane (far
   right, sleeps, scrubs, sideways) becomes its own file pair --
   design/reader/wordpane.css + wordpane.js -- mounted by book-nav.js, not
   written inside shell.css/book-nav.js; at +2 it is a separate layer over the
   zoomed column, not part of the zoom."

   WHAT THE PANE IS. Position +2 is one word and nothing else, and the one
   thing that costs you is where the word was standing. So this pane is the
   line it came out of, floating at the foot of the view, with the word itself
   in the page's ink and the rest of the line dimmed -- and a rail under it
   that is the whole book end to end, which moves the CURSOR rather than the
   scroll (in one word view the scroll is a consequence of the cursor, not the
   thing you are holding).

   IT IS A LAYER OVER THE ZOOM, NOT PART OF IT. Both elements are fixed to the
   viewport and appended beside the reading box, never inside #readercol, so
   the css `zoom` that grows the page by twelve leaves them exactly as they
   are: measured at 1710x951, the caption's rect at position +2 is the same
   rectangle it is at position 0, to the pixel. That is the point of it -- at a
   factor of fourteen anything laid out with the text would be a mile high.

   WHAT THIS FILE DOES NOT KNOW. It has never heard of a book, a chapter, a
   word index or a cursor. It is handed four questions and one instruction:
   where along the book you are (`fraction`), what the line says (`line`),
   whether that has changed (`key`), how long to wait before sleeping
   (`sleep`), and what to do when the rail is dragged (`seek`). Everything
   about WHICH word is book-nav.js's, as it has to be -- there is one cursor.

   mount(o) -> a handle:
     paint(f)      draw at f = 0..1, the last pane's own progress (dx 1 -> 2)
     wake()        any wheel, tap or key: awake now, asleep `sleep()` ms later
     playing(on)   the app's own door -- see wake() for why it matters
     clear()       the pane goes: opacity 0, presses back to the page
     el / rail     the two elements, for a bench that wants to measure them
========================================================================== */
(function(root){
  "use strict";

  function num(v, d){ v = +v; return isFinite(v) ? v : d; }
  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

  function mount(o){
    o = o || {};
    const host = o.host;
    const doc = (host && host.ownerDocument) || (typeof document !== "undefined" ? document : null);
    if(!host || !host.appendChild || !doc) return null;

    /* ---- THE LINE. Three children, always: what came before the word, the
       word, what came after. Rebuilt only when the word changes (`key`), not
       once a frame. */
    let el = null;
    function line(){
      if(el) return el;
      el = doc.createElement("div");
      el.classList.add("wordsub");
      el.setAttribute("aria-hidden", "true");
      const a = doc.createElement("span"), b = doc.createElement("b"),
            c = doc.createElement("span");
      el.append(a, b, c);
      host.appendChild(el);
      return el;
    }

    /* ---- AND THE RAIL UNDER IT. The book end to end: the filled part is how
       far in the cursor is, and dragging anywhere along it puts the cursor
       there. Its own element, not part of the caption -- the caption is
       `pointer-events:none` because a caption you can grab is a caption that
       eats double-clicks meant for the page. */
    let rail = null, fill = null, drag = null;
    function railEl(){
      if(rail) return rail;
      rail = doc.createElement("div");
      rail.classList.add("wordsubrail");
      rail.setAttribute("aria-hidden", "true");
      fill = doc.createElement("i");
      rail.appendChild(fill);
      host.appendChild(rail);
      if(rail.addEventListener){
        const at = e => {
          const r = rail.getBoundingClientRect();
          return clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
        };
        rail.addEventListener("pointerdown", e => {
          drag = e.pointerId; wake();
          try{ rail.setPointerCapture(e.pointerId); }catch(_){}
          if(o.seek) o.seek(at(e));
          if(e.preventDefault) e.preventDefault();
        });
        rail.addEventListener("pointermove", e => {
          wake();
          if(drag == null) return;
          if(o.seek) o.seek(at(e));
        });
        const up = () => {
          if(drag == null) return;
          try{ rail.releasePointerCapture(drag); }catch(_){}
          drag = null;
        };
        rail.addEventListener("pointerup", up);
        rail.addEventListener("pointercancel", up);
      }
      return rail;
    }

    /* ---- AND IT SLEEPS. Osca: "it disappears when you stop moving/tapping
       (just playing) after a second or so."

       A rule about WHEN, not a timer that always runs: awake on any wheel, tap
       or key, and asleep `sleep()` ms after the last one ONLY WHILE SOMETHING
       IS PLAYING. With nothing playing the line is the one thing on the screen
       that says where the word came from, and taking it away from a reader who
       has simply stopped moving is removing the answer to the question they
       stopped to ask. While narration is carrying them along it is a caption,
       and a caption that will not go is furniture.

       One timer, never a stack -- the shape is scrub.js's. */
    let awake = true, sleepT = null, playing = false;
    function repaint(){ if(o.repaint) o.repaint(); }
    function wake(){
      awake = true;
      if(sleepT){ clearTimeout(sleepT); sleepT = null; }
      const ms = num(o.sleep && o.sleep(), 0);
      if(!playing || !(ms > 0)){ repaint(); return; }
      sleepT = setTimeout(() => { sleepT = null; awake = false; repaint(); }, ms);
      repaint();
    }
    function setPlaying(on){
      playing = !!on;
      // going quiet wakes it and leaves it awake; starting to play arms the
      // sleep from that moment, so a person who pressed play and did not touch
      // anything still watches it go rather than waiting for a stray wheel.
      wake();
      return playing;
    }

    /* ---- ONE PAINT. `f` is the last pane's own progress, and asleep is not
       gone from the page -- it is at zero, the same opacity the line fades in
       on, so waking and sleeping are the one transition the stylesheet already
       describes and there is nothing to re-flow. */
    let seen = null;
    function paint(f){
      const l = line(), r = railEl();
      const on = f > 0;
      const op = (on && awake) ? String(Math.min(1, f * 1.6).toFixed(3)) : "0";
      if(l.style.opacity !== op) l.style.opacity = op;
      if(r){
        if(r.style.opacity !== op) r.style.opacity = op;
        // NEVER IN PAGE VIEW, and not merely invisible there: a rail across the
        // foot of the reading page would take every press aimed at the text.
        const pe = (on && awake) ? "auto" : "none";
        if(r.style.pointerEvents !== pe) r.style.pointerEvents = pe;
        if(fill && on){
          const w = (clamp(num(o.fraction && o.fraction(), 0), 0, 1) * 100).toFixed(3) + "%";
          if(fill.style.width !== w) fill.style.width = w;
        }
      }
      if(!on) return;
      const key = (o.key ? String(o.key()) : "") + "@" + (l.clientWidth || 0);
      if(key === seen) return;                 // one write per word (and per width), not per frame
      seen = key;
      const t = (o.line && o.line()) || null;
      const kids = l.children || [];
      const win = windowOf(t, l);
      if(kids[0]) kids[0].textContent = win.before;
      if(kids[1]) kids[1].textContent = win.word;
      if(kids[2]) kids[2].textContent = win.after;
      painted = l.clientWidth || 0;
    }

    /* ---- THE WINDOW (ASKS #204, Osca 9 Oct: "the subtext, under the one
       word view ... isn't following the top word, they're not the same").
       The line was the whole paragraph, clamped to one row of the measure, so
       the moment the word stood past the first ~100 characters it was behind
       the "..." and the row went on showing the paragraph's head -- on a
       front-matter block that is "XIII. XIV. CONTENTS ..." for every word on
       the page. The row is now a WINDOW cut around the word: as many
       characters as the measure holds at this type, the word a little left
       of the middle (0.42 -- the pivot column's share), the cut made at a
       space and marked with an ellipsis. The word moves, the window moves
       with it, and the word is always in it and marked. The measure is read
       off the element itself (clientWidth / one character of its own font),
       so the phone's shorter row and a bigger type both get their own count;
       a resize repaints (`painted` remembers the width the row was cut for). */
    let painted = 0;
    const BEFORE_SHARE = 0.42;
    function chPx(l){
      try{
        const cv = doc.createElement("canvas"), cx = cv.getContext && cv.getContext("2d");
        if(!cx) return 0;
        const cs = (doc.defaultView || root).getComputedStyle(l);
        cx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join(" ");
        return cx.measureText("abcdefghijklmnopqrstuvwxyz ").width / 27;
      }catch(_){ return 0; }
    }
    function windowOf(t, l){
      const before = (t && t.before) || "", word = (t && t.word) || "", after = (t && t.after) || "";
      const ch = chPx(l), w = l.clientWidth || 0;
      const cap = (ch > 0 && w > 0) ? Math.floor(w / ch) : 0;
      if(!cap || before.length + word.length + after.length <= cap) return { before, word, after };
      let nb = Math.max(0, Math.floor(cap * BEFORE_SHARE) - Math.floor(word.length / 2));
      let na = Math.max(0, cap - nb - word.length - 2);           // 2: the two ellipses
      if(before.length < nb){ na += nb - before.length; nb = before.length; }
      if(after.length < na){ nb = Math.min(before.length, nb + (na - after.length)); na = after.length; }
      let b = before.slice(before.length - nb), a = after.slice(0, na);
      if(nb < before.length){ const sp = b.indexOf(" "); if(sp > 0 && sp < b.length - 1) b = b.slice(sp + 1); b = "\u2026" + b; }
      if(na < after.length){ const sp = a.lastIndexOf(" "); if(sp > 0) a = a.slice(0, sp); a = a + "\u2026"; }
      return { before: b, word, after: a };
    }

    function clear(){
      if(el){ el.style.opacity = "0"; }
      if(rail){ rail.style.opacity = "0"; rail.style.pointerEvents = "none"; }
      seen = null;
    }
    function forget(){ seen = null; }        // the word moved: rewrite it next paint

    return {
      paint, wake, clear, forget,
      playing: setPlaying,
      get isPlaying(){ return playing; },
      get awake(){ return awake; },
      get el(){ return el; },
      get rail(){ return rail; },
    };
  }

  root.WordPane = { mount };
})(typeof window !== "undefined" ? window : this);
