/* ENGINE · where a pane goes -- widths, gutter, gap, travel, overlap, colour, z-order. Pure maths + one apply()
   · bench: bench-panes.html · mounted by: see MAP.md (generated -- `python3 map.py`) */
/* ============================== THE PANES ==================================
   Osca: "now I want to work on the PANE themselves... lets design the panes
   individually, How they move, stack, just between themselves, not in
   relation to any main reader view. And let me play with their size" -- and
   then: "make sure the .shell calls on THAT asset, the one we are building."

   So this is the panes, and only the panes: how wide each one is, where it
   rests, how far it slides in from, how they overlap, and which of them are
   coloured. Two pages load it -- bench-panes.html, the bench where the numbers
   are dialled with nothing else on the screen, and shell.html, where the same
   stack sits beside a book. One implementation, not a bench and a copy of it,
   which is the trap PLAN.md already names.

   What is NOT here: anything about the reader. The stack does not know a book
   is open. It reports where its right-hand edge has got to (`right`), and
   whoever cares about the text underneath -- book-nav.js does -- decides what
   to do about it. That separation is the whole point of the file.

   measure() is a pure function: numbers in, numbers out, no DOM. apply()
   writes one pane's numbers onto one element. Splitting them that way is what
   lets the bench, the app and the headless checks all drive the same maths.
========================================================================== */
(function(root){
  "use strict";

  // Every one of these is a slider on bench-panes.html. The values are the ones
  // measured into the app over the last fortnight -- 17/13/10/8/7vw is the
  // ladder that came out of collection-page.html's own column.
  const DEFAULTS = {
    // OSCA'S OWN SETTING, 5 September -- the pass after the panes became two
    // slots and a pile, dialled on bench-panes.html and logged here as the mark
    // everything starts from: "this is EXACTLY what I want".
    scale:    1.23,   // everything at once
    base:     17.5,     // vw -- the innermost pane, the one nearest the reader
    falloff:  0.64,    // each pane further out is this much of the one before it
    // THE FIRST PANE HAS THE PAGE'S OWN MARGIN. Osca, 6 Sep: "the contents
    // pane (the first one) has the wrong margin... set its margin to the
    // reading column's." Measured in his shell at 1710x951: the entries stood
    // 15.4px from the screen edge while the book's text started at 355 -- the
    // contents glued to the edge beside a page with a wide margin. This is the
    // reading page's own rule, page.css's `.chapter{ max-width:calc(100% -
    // 3rem) }`: 1.5rem of margin at each side, never less. It is the FIRST
    // pane's alone -- that one is the reading column's own margin made visible,
    // so it is the one that has to keep the page's grid; the panes behind it
    // are narrower columns of their own and keep padL.
    firstPad: 1.5,    // rem -- pane 0's left margin: the reading page's own
    padL:     0.6,    // rem -- inside the pane, left: the room the live dot needs
    padR:     0.5,    // rem -- inside the pane, right: its own number, so the
                      //        column can be pushed off either edge separately
    gutter:   4.5,   // vw -- left of the whole stack, from the second pane out
    gap:      18,     // px between one pane and the next
    overlap:  0,    // px each pane sits OVER the one in front of it
    cap:      2,      // HOW MANY PANES WIDE THE STACK IS ALLOWED TO BE
    travel:   2,      // how far a closed pane waits off its own resting place
    ease:     2.15,   // the shape of its approach: 1 is a straight line
    hueStep:  66,     // degrees between one pane's colour and the next
    sat:      80,     // % -- the coloured panes
    light:    50,     // %
    minWidth: 90,     // px -- a pane narrower than this is not a pane
    // WHERE EACH BLOCK ITSELF STARTS. Osca: "CAN YOU please give me a slider
    // for where block collumns themselves start (on the left side) for each
    // 1?" One number per pane, in px, added to wherever the stack would have
    // put it -- so a single column can be nudged left or right on its own
    // without touching the ladder the others sit on. Index 0 is the pane
    // nearest the reader.
    starts:   [-2, -29, -59, -24, 0],
    narrow:   860,    // px -- under this the panes stop being a stack of
    narrowW:  88,     // columns and take the screen: %, first pane
    narrowStep: 8,    // % less for each one further out
    // ...AND UNDER IT THERE IS ONE SLOT, NOT TWO (job 24, the landscape pass).
    // `cap` is how many panes are side by side in the window at once, and two
    // is right on a desk: 17vw and 11vw of 1280 sit beside each other with the
    // reader still readable past them. On a phone each pane is already 88% and
    // 80% of the screen (`narrowW`/`narrowStep` above), so two slots ask for
    // 168% of a 390px screen and the pair can only be drawn by pushing the
    // first one most of the way off it -- which is the stack covering itself
    // rather than two panes you can read. Landscape does not rescue it: 844 is
    // still under `narrow`, and 88% of 844 is 743. So below the mark the cap is
    // ONE: the pane you pulled is the pane you see, and everything older piles
    // behind it exactly as the third pane already does on a desk.
    narrowCap: 1,
    // ...AND A PHONE IS A PHONE WHICHEVER WAY UP IT IS. `narrow` is a width,
    // and measured against a width alone the two landscape sizes disagree:
    // 844x390 is under the mark and behaves, 932x430 is OVER it and comes out
    // with a desk's ladder -- 218/146/100/90px columns on a phone held
    // sideways. The short side is what says whether this is a phone: 390 and
    // 430 both, either way up, against 800 on the smallest desk this is used
    // on. So the mark is EITHER: a narrow width, or a short side under this.
    // (Pass `vh` to measure()/widthOf()/capOf() for it to apply -- without one
    // they judge on width alone, exactly as they always did.)
    narrowH:  500,
  };



  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function defaults(){
    const c = Object.assign({}, DEFAULTS);
    c.starts = DEFAULTS.starts.slice();   // its own, or two benches share one
    return c;
  }

  // A COLOUR PER PANE, STEADY. Osca: "Just randomise colour for now, not
  // important" -- so it is a hue off the seed (the book's own name in the
  // app), not the clock: the same stack looks the same every time it opens
  // instead of reshuffling itself under you.
  // The seed decides where on the wheel this stack sits; each pane further out
  // is a fixed turn from the one before. Hashing (seed + level) instead looked
  // right and was not: FNV over a one-character difference barely moves after
  // the modulo, so every coloured pane came out the same green.
  function hue(seed, i, step){
    const s = String(seed == null ? "" : seed);
    let h = 2166136261;
    for(let k=0;k<s.length;k++){ h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
    const st = step == null ? DEFAULTS.hueStep : step;
    return (((h >>> 0) % 360) + i * st) % 360;
  }

  // HOW MANY SLOTS THERE ARE, at this width. One below the narrow mark (a
  // phone, either way up), `cap` above it. Exported because the bench draws
  // the number and the checks assert it.
  function isNarrow(c, vw, vh){
    return !!((vw && vw <= c.narrow) || (vh && vh <= c.narrowH));
  }
  function capOf(cfg, vw, vh){
    const c = Object.assign({}, DEFAULTS, cfg||{});
    return Math.max(1, isNarrow(c, vw, vh) ? (c.narrowCap|0 || 1) : (c.cap|0 || 1));
  }

  // How wide pane i is, in px, before anything is open.
  function widthOf(i, cfg, vw, vh){
    const c = Object.assign({}, DEFAULTS, cfg||{});
    // ON A PHONE THEY ARE NOT A STACK OF COLUMNS. 17vw of a 390px screen is
    // 66px, which holds no name at all, so under the narrow mark each pane
    // takes most of the width and they simply cover each other.
    if(isNarrow(c, vw, vh)){
      const pc = Math.max(30, c.narrowW - i * c.narrowStep);
      return Math.max(c.minWidth, Math.round(vw * pc/100));
    }
    const w = vw * (c.base/100) * Math.pow(c.falloff, i) * c.scale
            + (c.padL + c.padR) * 16;
    return Math.max(c.minWidth, Math.round(w));
  }

  /* WHERE EVERY PANE IS, AT THIS POINT OF THE AXIS.
       n     how many panes this stack has
       dx    the axis: 0 shut, -1 the first pane out, -2 two out, ...
       vw    the viewport's width
       first (optional) px width for pane 0 -- the app hands it the reading
             column's own margin, so the innermost pane comes out into space
             that was already blank; the bench leaves it out and pane 0 takes
             its own place in the ladder.
     Panes are laid out OUTERMOST FIRST, from the gutter inward, because that
     is the direction they arrive from. Each open one carries the next along
     by its own width. */
  function measure(o){
    const cfg = Object.assign({}, DEFAULTS, o.cfg||{});
    const n   = Math.max(0, o.n|0);
    const dx  = +o.dx || 0;
    const vw  = o.vw || (root.innerWidth || 0);
    const vh  = o.vh || 0;                    // optional: the short-side test
    const first = o.first;                    // px, or undefined
    if(!n) return { panes:[], right:0, limit:0, cfg };

    const w = [], f = [];
    for(let i=0;i<n;i++){
      const fr = clamp(-dx - i, 0, 1);
      f[i] = cfg.ease === 1 ? fr : Math.pow(fr, cfg.ease);
      w[i] = (i === 0 && first != null) ? Math.round(first) : widthOf(i, cfg, vw, vh);
    }

    /* ---------------------------------------------------------------- SLOTS
       Osca: "you open up two contents 4 and 3... and now you open up contents
       2, WHAT I want to see is contents 3 and 2 - I want 3 to go OVER 4, so
       that what I view are the selectors between 3 and 2, then if I go left
       again to 1, I want to see 2 and 1 side by side with the overlapping ones
       furthest to the right... maximum open at a time is two, any new pulled,
       just squeezes the stack on the right."

       So the stack is not a ladder that keeps growing. It is TWO SLOTS and a
       pile. The pane you just pulled takes the left slot; the one before it
       slides right into the right slot, over the top of whatever was there;
       and everything older parks at the right slot too, each one wider than
       the one in front of it, so they fan out to the left as a pile with the
       newest of them on top. Nothing beyond the two slots is ever in play,
       which is why the window -- and the text beside it -- stops moving.

       `newest` is continuous (it is just the axis), so a pane's slot is a
       fraction while the gesture is mid-way and everything slides rather than
       jumping. `cap` is how many slots there are; two is the setting. */
    const gutterPx = vw * (cfg.gutter/100);
    const fStack   = n > 1 ? clamp(-dx - 1, 0, 1) : 0;
    const anchorL  = gutterPx * fStack;       // the window's left edge
    const slots    = Math.max(1, Math.min(n, capOf(cfg, vw, vh)));
    const S        = Math.max(1, slots - 1);  // how many steps between slots

    // THE WINDOW'S RIGHT EDGE. It grows while the first `slots` panes are
    // opening and then stops for good: pane three and beyond are laid out
    // inside the room the first two already take.
    let R = anchorL + (w[0] || 0);
    for(let i=1;i<slots;i++) R += (w[i] + cfg.gap - cfg.overlap) * clamp(-dx - i, 0, 1);
    let limit = gutterPx + (w[0] || 0);
    for(let i=1;i<slots;i++) limit += (w[i] + cfg.gap - cfg.overlap);

    const newest = -dx - 1;                   // which pane is the last one out
    const panes = [];
    let right = 0;
    for(let i = n-1; i >= 0; i--){
      // 0 = the left slot, S = the right slot, and everything older than that
      // is held AT the right slot -- the pile.
      const u  = clamp(newest - i, 0, S) / S;
      const at = anchorL + u * ((R - w[i]) - anchorL);
      // the arrival, and then the pane's own nudge (see `starts`)
      const nudge = (cfg.starts && +cfg.starts[i]) || 0;
      const x = Math.round(at - w[i] * cfg.travel * (1 - f[i]) + nudge * f[i]);
      panes.push({
        i, f:f[i], left:x, width:w[i],
        slot:  clamp(newest - i, 0, S),       // 0 left, S right, S = piled
        piled: newest - i > S,                // behind the right slot
        open:  f[i] > 0,
        // the two sides of the column -- and pane 0 keeps the page's own margin
        pl: (i === 0 && cfg.firstPad != null) ? cfg.firstPad : cfg.padL,
        pr: cfg.padR,
        wash:  i % 2 === 1,                   // white, colour, white, colour
        hue:   hue(o.seed, i, cfg.hueStep),
        // THE ONE YOU JUST PULLED UP IS THE ONE IN FRONT. Osca: "when I bring
        // one contents UP, THAT one becomes the most forward one." Which is
        // also what makes 3 read as going OVER 4 when it slides right.
        z:     3 + i,
      });
      // THE EDGE EASES IN WITH THE PANE, so a pane a hair open does not move
      // the reader beside it by its whole width.
      if(f[i] > 0) right = Math.max(right, (x + w[i]) * f[i]);
    }
    panes.reverse();                          // innermost first, i ascending
    return { panes, right, limit, slots, cfg };
  }

  // one pane's numbers onto one element -- the only DOM this file touches
  function apply(el, p){
    if(!el || !el.style) return;
    if(el.style.width !== p.width + "px") el.style.width = p.width + "px";
    el.style.left = p.left + "px";
    // fades in as it slides rather than popping: with travel below 1 a shut
    // pane is already partly on screen, so a binary opacity made it appear
    // mid-air. Solid almost at once -- the block is the point -- but not
    // instantly.
    el.style.opacity = Math.min(1, p.f * 2.5);
    el.style.pointerEvents = p.open ? "auto" : "none";
    el.style.zIndex = String(p.z);
    // THE TWO SIDES OF THE COLUMN, SEPARATELY. Osca: "I want to adjust the
    // right and left sides of the column independently." The left was the only
    // one there was -- the room wheel.css's live-row marker needs at
    // left:-1.15rem -- and the right was hard zero, so the text ran to the
    // pane's own edge whatever was wanted.
    if(p.pl != null) el.style.setProperty("--pane-pl", p.pl + "rem");
    if(p.pr != null) el.style.setProperty("--pane-pr", p.pr + "rem");
    if(p.wash){
      el.style.setProperty("--pane-h", String(p.hue));
      if(el.setAttribute) el.setAttribute("data-wash", "");
    }else{
      if(el.removeAttribute) el.removeAttribute("data-wash");
      el.style.removeProperty("--pane-h");
    }
  }

  // the two colour numbers live on the root, so one rule serves every pane
  function paint(cfg, rootEl){
    const R = rootEl || (root.document && root.document.documentElement);
    if(!R || !R.style) return;
    const c = Object.assign({}, DEFAULTS, cfg||{});
    R.style.setProperty("--pane-s", c.sat + "%");
    R.style.setProperty("--pane-l", c.light + "%");
  }

  const Panes = { DEFAULTS, defaults, measure, apply, paint, hue, widthOf, capOf, isNarrow };
  if(typeof module === "object" && module.exports) module.exports = Panes;
  root.Panes = Panes;
})(typeof window !== "undefined" ? window : globalThis);
