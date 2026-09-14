/* ENGINE · the rail as a control -- build, paint, wake, seek, go to a chapter
   · bench: bench-page.html · mounted by: see MAP.md (generated -- `python3 map.py`) */
/* ============================== THE SCRUB ==================================
   Osca: "MAKE SOMETHING WONDERFUL - here is the scroll bar, that's what we
   want ours to be like, just give me settings to adjust how it works and
   looks", with a screen recording of the one he means.

   WHAT IS IN THE RECORDING, read off the frames rather than guessed at:

     * the rail is the book, in order, down the right edge -- not a thumb in a
       trough. Every chapter is its own capsule and its height is that
       chapter's own share of the book, so a long chapter is a long capsule
       and the rail is a map of the thing you are holding;
     * a small gap between capsules, so they read as separate places;
     * WHERE YOU HAVE BEEN IS FILLED IN. The chapters behind you are solid
       colour, the ones ahead are pale, and the chapter you are in is filled
       exactly as far as you have read into it -- which is what makes the
       colour stop between two marks rather than at one of them;
     * at rest it is a hairline and says nothing. Woken -- by a scroll, or by
       the pointer coming near -- it widens into capsules and every chapter
       puts its name beside it, the ones behind you in the read colour;
     * and it is a control: a capsule takes you to its chapter.

   Everything above is a number in DEFAULTS, and every one of them is a slider
   on bench-page.html. Two files, no copy: the bench and the shell mount the
   same Scrub.

   It draws itself from the DOM -- the chapters as they were actually laid out
   -- rather than from the book's data, so a chapter's share of the rail is its
   share of the page, images and openers and all.
========================================================================== */
(function(root){
  "use strict";

  /* ============================ OSCA'S OWN VALUES ==========================
     Dialled on bench-page.html and pasted here 9 September, judged on THE
     COMPLETE WORKS OF WILLIAM SHAKESPEARE -- 865 chapters, 0 pictures, at
     1710x951 -- which is the hardest book on the shelf for this rail and the
     right one to settle it on. His words: "This is what I want, save it like
     that."

     Twelve moved: the rail sits closer to the top and bottom (10vh), is thinner
     awake (3px), reads BLACK rather than blue, is fainter at rest (0.24), sleeps
     after 100ms, and the names are smaller and further off the rail (9.5 / 16),
     with a lower bar for getting one at all (18) and their own phone pair
     (6 / 94). `fillWidth` 1 is the "one unbroken bar" shape's width; the shape
     itself stays "capsules", which is what he judged.

     The way back is the bench: move a slider, press the log, paste the block. */
  const DEFAULTS = {
    // where it stands
    inset:      26,    // px in from the right edge
    top:        10,    // vh of empty above the rail
    bottom:     10,    // vh below it
    // the capsules
    width:      2,     // px at rest
    awakeWidth: 3,     // px once it is awake
    gap:        6,     // px between one chapter and the next
    radius:     6,     // px -- the ends of a capsule
    minSeg:     10,    // px -- a very short chapter is still worth touching
    // colour
    read:       "#000000",
    unread:     "#d9d6d0",
    dim:        0.24,  // how faint the unread capsules are at rest
    /* THE FILL, AND IT IS ONE (Osca, 9 Sep: "capsules, but keep the single
       fill"). Two shapes, because the sentence has two readings and the
       difference is only whether the GAPS are filled -- so it is a knob on the
       bench and not an argument:
         "capsules"  the read part of each capsule is filled, the gaps stay
                     gaps. The recording's look.
         "bar"       ONE unbroken track down the rail, filled to where you are,
                     with the chapter boundaries drawn over it as notches. The
                     app's present look, made proportional.
       Both are driven by the SAME single number -- how far through the book
       you are, in the capsules' own units -- so they can never disagree. */
    fillStyle:  "capsules",   // "capsules" | "bar"
    fillWidth:  1,     // px -- the bar's own width in "bar" mode
    fillColour: "",    // "" = use `read`; set it to give the bar its own colour
    // the names
    labels:     true,
    labelSize:  9.5,    // px
    labelGap:   16,    // px between the name and the rail
    labelWidth: 190,   // px
    labelMin:   18,    // px -- the shortest capsule that gets a name of its own
    /* A PHONE IS NOT A NARROW DESK. Osca, 8 Sep: "the text is FAR too large for
       the phone, takes up half the screen" -- the rail's chapter names, at the
       desk's 12px, on a 402px screen. One number of their own, applied under
       `phoneAt`, so the desk keeps its size and the phone gets a readable one
       without either being a compromise. */
    labelSizePhone: 6,   // px -- the names, at or below `phoneAt`
    labelWidthPhone: 94,// px -- and how much width they may take there
    phoneAt:    640,   // px of viewport width at or below which the phone sizes apply
    // how it behaves
    wake:       "scroll",  // "scroll" | "always" | "never"
    hold:       100,      // ms it stays up after a scroll
    jump:       true,      // a capsule takes you to its chapter
    drag:       true,      // and dragging the rail scrubs the book
  };

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function px(n){ return Math.round(n) + "px"; }

  function mount(o){
    const pane = o.pane, col = o.column, host = o.host;
    if(!pane || !col || !host) return null;
    const cfg = Object.assign({}, DEFAULTS, o.cfg || {});
    let segs = [], hideT = null, dragging = false, track = null;
    /* the book's own chapter list, kept from build() for chapterName(), and
       which capsule the last paint filled (-1 = nothing written yet, which is
       how a fresh build gets its one full pass -- see paint) */
    let data = [], lastCur = -1;
    /* when the PAGE last actually moved, which is what `hold` is measured from
       -- see wake(). `lastTop` is a number this file already had to read. */
    const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
    let lastTop = -1, lastMoved = 0;

    host.classList.add("scrub2");

    /* ---- THE SHAPE OF THE BOOK. One capsule per chapter, and its height is
       that chapter's own share of the scroll -- measured off the laid-out
       page, so a chapter with ten plates in it is as long on the rail as it is
       under your thumb. */
    function build(){
      host.textContent = "";
      segs = []; lastCur = -1;
      /* THE ONE TRACK. It is created whatever the fill style is and costs
         nothing in "capsules" mode (css hides it), so the two shapes are one
         DOM and switching between them on the bench is a class, not a rebuild. */
      track = document.createElement("b");
      track.className = "track";
      host.appendChild(track);
      /* THE TITLE PAGE IS NOT A CHAPTER, AND SINCE 9 Sep IT IS NOT A CAPSULE
         (Osca: "look at the radius AT THE START -- it's different to all
         others... the blue radius BEGINNING is wrong").

         It was on the rail because `page.js`'s old rail put it there, and a
         TICK for the cover is harmless -- a tick is a point. A proportional
         CAPSULE for it is not: `page.js` synthesises the title slide, so it is
         in the DOM but NOT in `book.chapters`, and `weigh()` therefore fell to
         its floor of 80 characters. On Walden that is 0.013% of the book -- a
         capsule 0.09px tall, forced to `min-height` 10px, sitting at the very
         top with a 4px-tall bar whose 6px radius CSS scales down to about 2px.
         A different curve from every other capsule, exactly where the eye
         starts. And because the segments are positioned as absolute
         percentages, a forced minimum does not push the next one down: measured
         on Walden, the stub's capsule stood at y 126.00 and Economy's at
         126.08. IT OVERLAPPED CHAPTER ONE.

         The book's own cover is `page.js`'s tinted opener slide, which the
         reader scrolls through; the rail is a map of the CHAPTERS. */
      const chapters = [...col.querySelectorAll(".chapter")]
                        .filter(c => !c.classList.contains("titlepage"));
      if(!chapters.length) return;

      /* A CHAPTER'S SHARE OF THE RAIL IS ITS SHARE OF THE BOOK, and that is
         taken from the TEXT, not from the laid-out page. Measuring the page
         looks like the obvious thing and is wrong here: with
         content-visibility on -- which is what makes a book of this size
         scroll at all -- a chapter nobody has visited reports the
         stylesheet's placeholder height rather than its own, so every
         chapter measures the same and the rail comes out as sixty-seven
         identical capsules. (Seen exactly that: 1.49% each, all the way
         down.) Characters do not lie, do not need the chapter to have been
         drawn, and do not shift under you as you read.

         A picture is worth a paragraph or so, which is what PLATE is: a
         chapter of plates should not be a hairline. */
      const PLATE = 700;
      const weigh = ch => {
        let n = 0;
        (ch && ch.blocks || []).forEach(b => {
          n += b.r === "fig" ? PLATE : String(b.t || "").length;
        });
        return Math.max(80, n);          // even an empty chapter is a place
      };
      data = (o.book && o.book.chapters) || [];
      // page.js draws a title slide of its own before the chapters, so the
      // DOM has one section more than the book has chapters
      /* the two lists now line up: `chapters` is the real chapters and `data` is
         `book.chapters`. The `offset` this used to carry existed only to skip
         the title page, and it is gone with it. */
      const w = chapters.map((_, i) => data.length ? weigh(data[i]) : 1);
      let total = w.reduce((a, b) => a + b, 0) || 1;

      /* A SHORT CHAPTER IS STILL WORTH TOUCHING -- AND THE FLOOR BELONGS HERE,
         NOT IN THE CSS. `minSeg` used to be a `min-height` on the segment. A
         segment is positioned `top: <cumulative>%`, so a minimum applied in CSS
         makes that one taller WITHOUT moving the ones below it: it overlaps its
         neighbour and the rail stops being as long as the book. Applied to the
         SHARES instead -- floor, then renormalise, twice, which is enough for
         any real book -- the rail keeps its length, nothing overlaps, and a
         two-page chapter is still a target for a thumb. */
      const H = host.getBoundingClientRect().height || 1;
      /* `minSeg` is the CAPSULE's minimum, and a segment is the capsule PLUS the
         gap under it -- so the floor is both. (At 10px alone the shortest
         capsule came out 4.8px on a 402x874 phone, which is `minSeg` minus the
         gap, and a 6px radius on 4.8px is scaled down: the same wrong curve
         this round is about, just further down the rail.) */
      const floor = clamp((cfg.minSeg + cfg.gap) / H, 0, 1 / Math.max(1, w.length));
      let share = w.map(x => x / total);
      for(let pass = 0; pass < 2; pass++){
        const under = share.map(s => s < floor);
        const slack = 1 - under.reduce((a, u, i) => a + (u ? floor : 0), 0);
        const rest  = share.reduce((a, s, i) => a + (under[i] ? 0 : s), 0) || 1;
        share = share.map((s, i) => under[i] ? floor : s * slack / rest);
      }

      let at = 0;
      chapters.forEach((ch, i) => {
        const shareOf = share[i];
        const g = document.createElement("div");
        g.className = "seg";
        /* THE GAP IS THE SEGMENT'S, NOT THE RAIL'S (9 Sep). It is
           `padding-bottom` on the segment, and the capsule is `top:0;
           bottom:<gap>` inside it -- so on a book deep enough that a segment is
           thinner than the gap, the capsule comes out at zero and the rail
           DISAPPEARS. Measured on the Complete Works in bench-page.html: 865
           chapters, a 792px rail, segments 6px, **864 of 865 capsules 0px
           tall.** (The old `min-height:10px` hid this by forcing every segment
           to 10px -- 8650px of stubs overlapping inside 792px of rail, which is
           why the rail was never a map of that book either.)

           So a gap may never take more than a third of its own segment. A
           thirty-chapter book keeps the full gap and reads as capsules; the
           Complete Works closes up into a continuous bar, which is the honest
           picture of a book with 865 chapters in it. */
        const segPx = shareOf * H;
        g.style.setProperty("--sc-gap", Math.min(cfg.gap, segPx * 0.35).toFixed(2) + "px");
        g.style.top = (100 * at) + "%";
        g.style.height = (100 * shareOf) + "%";
        /* THE FILL GOES INSIDE THE CAPSULE. It was a sibling, and a sibling's
           height is a percentage of the whole slot -- capsule AND the gap under
           it -- so a read chapter's blue ran on through the gap and into the
           next one. Four read chapters came out as one unbroken bar, which is
           what "the blue starts BEFORE the bar itself" was. Inside it, the
           percentage is of the capsule, and the gaps stay gaps whichever
           colour the rail is. */
        /* ONE ELEMENT, NOT TWO (9 Sep -- Osca: "it has STARTED outside of the
           capsule... the corners are blue, not the centre"). The fill used to be
           a `u` INSIDE the capsule, relying on the capsule's `overflow:hidden`
           to cut it to the rounded corners. The capsule also carries an
           `opacity` and a `transition`, which makes it a COMPOSITED layer -- and
           a composited layer's rounded clip is honoured by Chromium and not
           reliably by WebKit, which is every surface this app actually ships on
           (the Mac app is a WKWebView; iOS is nothing else). So the square top
           corners of a short fill hung outside the capsule's 6px curve: blue at
           the corners, grey in the middle. Every headless check here passed,
           because this container is Chromium.

           A BACKGROUND CANNOT ESCAPE ITS OWN BORDER-RADIUS, in any engine, with
           no clip and no compositing question -- so the capsule paints both
           colours itself, out of one custom property. There is nothing left to
           clip. */
        const bar = document.createElement("i");      // the capsule, and the fill
        const lab = document.createElement("span");
        lab.textContent = chapterName(ch, i);
        g.append(bar, lab);
        g.onclick = e => {
          if(!cfg.jump || dragging) return;
          e.stopPropagation();
          goTo(ch);
        };
        host.appendChild(g);
        /* `before` is this chapter's share of the book that lies ABOVE it --
           the cumulative sum. It is what turns "which chapter, and how far in"
           into ONE number for the whole book, which is what the single fill
           needs and what `seek` needs to run backwards. */
        segs.push({ el:g, bar, lab, ch, share:shareOf, before:at });
        at += shareOf;
      });
      fitLabels();
      paint();
    }

    /* ---- A NAME NEEDS ROOM. The recording is a book of seven chapters and
       every one of them is named on the rail; David Copperfield is sixty-seven
       and they came out on top of each other, which is a wall of type rather
       than a map. So a capsule carries its name only if it is taller than the
       name is -- and the chapter you are in always carries its own, whatever
       size it is, because that is the one you are asking about. */
    function fitLabels(){
      const H = host.getBoundingClientRect().height || 1;
      segs.forEach(s => s.el.classList.toggle("tiny", s.share * H < cfg.labelMin));
    }

    /* THE NAME COMES OFF THE BOOK, NOT OFF THE PAGE (13 Sep). It was read out
       of `ch.querySelector(".opener h1")` -- the heading page.js had written
       into that chapter's own opener. page.js keeps only a window of chapters
       mounted now (see its THE WINDOW), so on the complete Shakespeare 862 of
       866 sections are empty and that query answers `null`: the rail would
       have come up with four names and 862 blanks.

       `book.chapters[i]` has both halves of the heading -- `n` the number, `t`
       the title -- in the same order and the same list `weigh()` above already
       takes the segment's own share from, and for the same reason: the data
       does not need the chapter to have been drawn. The opener is still read
       when there is no data at all (the file-drop bench mounts a column with
       no `book`), which is the one case that path was ever the only one. */
    function chapterName(ch, i){
      const d = data[i];
      if(d){
        const t = String(d.t || "").trim(), n = String(d.n || "").trim();
        if(t) return t;
        if(n) return n;
        return "chapter " + (i+1);
      }
      const h1 = ch.querySelector(".opener h1");
      if(!h1) return "";
      const small = h1.querySelector("small");
      const t = h1.textContent.replace(small ? small.textContent : "", "").trim();
      return t || (small ? small.textContent.trim() : "") || ("chapter " + (i+1));
    }

    /* ---- WHERE YOU HAVE BEEN. A chapter behind the reading line is full, one
       ahead is empty, and the one you are in is filled by exactly how far into
       it you have read. That last part is the whole look of it. */
    /* ---- WHERE YOU HAVE BEEN. Which chapter you are in is asked of the page
       -- the one you are reading is rendered, so its own top and height are
       honest even while the ones below it are still estimates. Everything
       above it is full, everything below is empty, and the one you are in is
       filled by exactly how far into it you have read. */
    /* ---- WHERE YOU ARE, AS ONE NUMBER, AND IT IS NOT `scrollTop / span`.
       9 Sep, measured on Walden at 1440x900: `scrollTop / span` is a fraction of
       the LAID-OUT page, and under `content-visibility` every chapter you have
       not visited is reporting the stylesheet's placeholder height (1098px
       each, seen exactly). So Economy -- 22.12% of the book by its own
       characters -- occupied 67% of that scale, the other eighteen chapters
       were squeezed into what was left, and every one of those positions moved
       as you read and the placeholders became real. That is Osca's "it's made a
       mess" and his "it starts sometimes in the middle of the scroll bar, the
       same chapter", and it is one cause.

       The rail is built in CHARACTERS (see `build`), so the reader's place must
       be expressed in characters too: WHICH chapter (asked of the page, which
       is honest about the chapter you are actually in, because that one is
       rendered) plus HOW FAR INTO IT (honest for the same reason), read out
       through that chapter's own share. One number, and both fill shapes and
       the drag all run off it, so they cannot disagree with the capsules. */
    /* WHICH CHAPTER YOU ARE IN IS ONE QUESTION AND MUST HAVE ONE ANSWER.
       9 Sep, Osca on a chapter-three opener: *"it shows that I'm still at the
       end of chapter 2, NOT 3 -- I am actually at the beginning of 3."* The
       running head beside it said "Reading." So the rail and the running head
       were answering the same question two different ways:

         page.js::paint()   a chapter is current once its top has come up past
                            a READING LINE down the viewport
         scrub.js (was)     a chapter is current once its top passes the very
                            top of the pane -- `offsetTop <= scrollTop`

       On an opener slide -- a full screen of nothing but the chapter's name --
       the two are a whole screen apart, and the rail lags by a chapter for the
       length of every opener in the book.

       The rail takes the running head's rule, because that is the one Osca
       reads and it is the one that is right: you are in the chapter whose name
       you can see. **The line is HALFWAY DOWN THE SCREEN** -- Osca's choice,
       9 Sep, asked directly: a chapter becomes current when its opener reaches
       the middle, so you finish the previous chapter's capsule before the next
       one lights. `page.js::paint()` was moved from 0.35 to the same number in
       the same commit, and `test-scrub.mjs` asserts the two files still agree:
       one question, one number, in two files that must never drift apart.

       `into` is still measured from the TOP of the pane, not from the reading
       line, and that is deliberate: it keeps the fill continuous across the
       switch. Just before the change the previous chapter's `into` has been
       clamped to 1, so the fill stands at `before + share` -- which is exactly
       the next chapter's `before`, where it resumes at `into` 0. No jump. */
    const READ_LINE = 0.5;                  // page.js::paint() uses this number

    /* THE RAIL DOES NOT MOVE A PAGE THAT IS NOT THERE. book-nav.js puts
     `data-axis="off-page"` on <html> whenever the axis has left the reader --
     a pane, the zoom, one word. Every seek below is a fraction or an offsetTop
     measured against the READING page, and neither means anything while the
     page is zoomed thirty times or slid aside: `f * (scrollHeight -
     clientHeight)` against a zoomed scrollHeight lands anywhere, 0 included,
     and 0 is the title page. Osca, 10 Sep: "the page is moving like crazy...
     it launched out of the title page." */
  function offPage(){
    try { return document.documentElement.getAttribute("data-axis") === "off-page"; }
    catch(_) { return false; }
  }
  function progress(){
      const line = pane.scrollTop;
      const mark = line + pane.clientHeight * READ_LINE;
      /* BY BINARY SEARCH, NOT BY WALKING THE BOOK (13 Sep) -- the same
         medicine page.js::paint() and book-nav.js::sectionAt took, for the
         same reason and against the same list. This walked from chapter 0 and
         read `offsetTop` off every segment up to the one you are in: eleven
         reads instead of eight hundred, four hundred chapters into the
         complete Shakespeare, on every scroll event. The tops ascend, so the
         search is sound, and it is still the LIVE geometry -- nothing is
         cached and nothing is a snapshot. */
      let cur = 0, lo = 0, hi = segs.length - 1;
      while(lo <= hi){
        const mid = (lo + hi) >> 1;
        if(segs[mid].ch.offsetTop <= mark){ cur = mid; lo = mid + 1; } else hi = mid - 1;
      }
      const s = segs[cur];
      if(!s) return { cur:0, into:0, at:0 };
      const into = clamp((line - s.ch.offsetTop) / Math.max(1, s.ch.offsetHeight), 0, 1);
      return { cur, into, at: s.before + s.share * into };
    }

    function paint(){
      /* ============ NOT WHILE THE AXIS IS OFF THE PAGE ============
         Measured 10 September, counting every layout-forcing call in a frame:
         during the zoom this ran 216 times a frame -- `progress()` reads
         `offsetTop` on every segment and `paint()` then writes `--f` and
         toggles two classes on every one of them. On the complete Shakespeare
         that is 866 segments, and it is the whole reason the page painted ONE
         FRAME PER SECOND while dx climbed 0 -> 1 (median 470ms a frame against
         85ms for the zoom write itself).

         And it is work for nothing: past the page the rail is not on screen at
         all. The hold loop moves the scroller every frame to keep the word
         still, each move fires `scroll`, and each `scroll` repainted a rail
         nobody could see. Home again, the next real scroll paints it. */
      if(offPage()) return;
      const { cur, into, at } = progress();
      /* the ONE fill, in "bar" shape: an unbroken track down the rail, filled
         to exactly `at`. The capsule boundaries are notched over it by css. */
      if(track) track.style.setProperty("--f", (at * 100).toFixed(4) + "%");
      /* ONLY THE CAPSULES THAT CHANGED, and on a scroll that is one of them.
         13 Sep, measured: this wrote a custom property and toggled two classes
         on EVERY segment on EVERY scroll event -- 866 of them on the complete
         Shakespeare -- and Chromium spent 4,712 ms of style recalc inside a
         one-second wheel flick doing it, 47 ms a frame, against 6.5 ms with
         the rail's host display:none. It was the largest single cost left in
         the reading scroll once page.js stopped mounting the whole book
         (K25-a), and it was hidden behind that one before.

         And nearly all of it was writing numbers that had not moved. The
         comment below is the proof the pass was never needed: `f` is 1 for
         every capsule before the one you are in and 0 for every one after,
         BY ARITHMETIC -- so only the capsule you are IN carries a fraction
         that changes as you read, and the others change only when `cur`
         itself moves past them. So: the current capsule always; the ones
         between the old `cur` and the new one when it moves; nothing else.
         The first paint has no previous `cur`, so it writes them all once. */
      const f = s => clamp((at - s.before) / Math.max(1e-9, s.share), 0, 1);
      const write = i => {
        const s = segs[i]; if(!s) return;
        s.bar.style.setProperty("--f", (f(s) * 100).toFixed(4) + "%");
        s.el.classList.toggle("here", i === cur);
        s.el.classList.toggle("done", i < cur);
      };
      if(lastCur < 0){ for(let i = 0; i < segs.length; i++) write(i); }
      else if(lastCur !== cur){
        const a = Math.min(lastCur, cur), b = Math.max(lastCur, cur);
        for(let i = a; i <= b; i++) write(i);
      } else write(cur);
      lastCur = cur;
    }

    /* AND IT STAYS UP WHILE YOU ARE ON IT. Osca, 9 Sep: *"if I rest ON TOP of
       it, it shouldn't be disappearing... IF I am hovering over the bar, it
       should stay."* `wake()` armed the hide on every call, and a pointer that
       has arrived and stopped sends no more events -- so the rail woke, the
       hand arrived, and 100ms later it went out from under the cursor. The
       hover is a STATE, not an event: while the pointer is over the rail (and
       that includes the invisible strip out to the screen's edge, which is part
       of the host) nothing is scheduled at all, and the timer starts when the
       pointer leaves. A drag holds it up the same way. */
    let hovering = false;

    /* ...AND IT DOES NOT GO DOWN WHILE THE PAGE IS STILL MOVING (13 Sep).
       Measured on the complete Shakespeare, inside one second of wheel: the
       `awake` class went on and off the host 26 times, and EACH write is a
       style recalc of every capsule on the rail -- 866 of them -- at ~47 ms.
       That is a feedback loop, not a cost: one write blows the frame budget,
       the next scroll event lands more than `hold` ms later, the hide timer
       has therefore already fired, the scroll puts the class back, and the
       page stops moving at all (0 px travelled under a full second of wheel,
       against 2,355 px with the class pinned up). It is only visible now
       because page.js stopped mounting the whole book in front of it (K25-a);
       the loop was always there, waiting for a frame budget to be tight.

       `clearTimeout` on every wake cannot prevent it: the timer fires in the
       GAP between two scroll events, and a jammed main thread is exactly a
       page whose gaps are longer than `hold`. So the hide is measured from
       when the PAGE last moved rather than from the last event that reached
       this file, and re-checks rather than firing blind. `hold` keeps its
       meaning -- "ms it stays up after a scroll" -- and now keeps it on a
       slow frame too.

       THE RAIL'S REAL SIZE PROBLEM IS NOT FIXED HERE and is not this lane's:
       one class on the host restyling 866 capsules is the rail mounting the
       whole book, which is the same shape of fault page.js just stopped
       making. See reader/STATUS.md 6. */
    function wake(){
      if(cfg.wake === "never") return;
      host.classList.add("awake");
      /* THE NAMES ARE THE POINTER'S, NOT THE SCROLL'S (9 Sep). Osca: "when I
         scroll EVERYTHING comes up... only when hovering over. Otherwise it's
         just a second floating header." A scroll widens the bar and brings the
         colours up; only a hand on the rail -- resting on it or dragging it --
         puts the chapter names beside it. `scrub.css` hangs them on `.named`. */
      host.classList.toggle("named", hovering || dragging);
      clearTimeout(hideT);
      if(cfg.wake === "always" || hovering || dragging) return;
      const tick = () => {
        if(hovering || dragging) return;                     // a hand holds it up
        const since = now() - lastMoved;
        if(since < cfg.hold){ hideT = setTimeout(tick, cfg.hold - since); return; }
        host.classList.remove("awake");
      };
      hideT = setTimeout(tick, cfg.hold);
    }

    /* ---- AND IT IS A CONTROL. Dragging anywhere on the rail scrubs the book:
       the y you are holding maps straight onto the scroll, which is the one
       thing a hairline down the edge of a screen is naturally good at. */
    /* THE DRAG RUNS `progress()` BACKWARDS. It used to map the rail's y straight
       onto `scrollTop / span` -- the same laid-out-page scale the fill has just
       stopped trusting -- so dragging to the middle of a capsule landed
       somewhere else entirely, and on a book of placeholders it landed nowhere
       near. Now the y is read as a fraction OF THE BOOK, the capsule holding
       that fraction is found, and the scroll goes to that far into that
       chapter. Same units in both directions; the thumb lands where it looks. */
    function seek(clientY){
      const r = host.getBoundingClientRect();
      const f = clamp((clientY - r.top) / Math.max(1, r.height), 0, 1);
      if(!segs.length){
        if(offPage()) return;
        pane.scrollTop = f * Math.max(1, pane.scrollHeight - pane.clientHeight);
        return;
      }
      let i = 0;
      for(let k = 0; k < segs.length; k++){ if(segs[k].before <= f) i = k; else break; }
      const s = segs[i];
      const into = clamp((f - s.before) / Math.max(1e-9, s.share), 0, 1);
      if(offPage()) return;
      pane.scrollTop = s.ch.offsetTop + into * s.ch.offsetHeight;
    }
    /* ---- GOING TO A CHAPTER, AND ARRIVING AT IT. A chapter that has not been
       drawn yet reports the placeholder height, not its own -- so the first
       scroll lands NEAR where it will be, and by the time it has rendered the
       target has moved. (Clicked chapter IX and the rail said VI: the jump was
       honest, the number was not.) So the number is taken again once the page
       has caught up, and again, until it stops moving. */
    function goTo(ch){
      /* scrollIntoView, not a number: the browser works out where the chapter
         is at the moment of the call, against the live layout, rather than
         against an offsetTop that a skipped chapter has only estimated. */
      if(offPage()) return;
      ch.scrollIntoView({ behavior:"smooth", block:"start" });
      /* ...and then RELATIVELY, not to a number. Chasing ch.offsetTop walks
         the page: every correction renders more of the book, every render
         moves the number, and with the chapters above it shrinking from their
         placeholder heights the target runs away upwards -- clicked IX and
         ended up on the title page. Measuring where the chapter IS on screen
         and closing that gap converges, because the thing being measured is
         the thing being fixed. */
      let tries = 0;
      const settle = () => {
        const d = ch.getBoundingClientRect().top - pane.getBoundingClientRect().top;
        if(Math.abs(d) > 2) pane.scrollTop += d;
        if(++tries < 24) requestAnimationFrame(settle);
      };
      requestAnimationFrame(settle);
    }

    /* ---- A PRESS IS A CLICK UNTIL IT MOVES. Seeking on pointerdown made
       every click on a capsule a seek to wherever the finger landed, and
       capturing the pointer on the host meant the capsule never saw the click
       at all -- so "clicking on the bar isn't working". The press is now held:
       nothing happens until the pointer has moved far enough to mean it, and
       if it never does, the capsule's own click takes you to its chapter. */
    const DRAG_SLOP = 4;                 // px before a press becomes a drag
    let downY = null, downId = null;
    host.addEventListener("pointerdown", e => {
      if(!cfg.drag){ wake(); return; }
      downY = e.clientY; downId = e.pointerId; dragging = false; wake();
    });
    host.addEventListener("pointermove", e => {
      wake();
      if(downY == null) return;
      if(!dragging && Math.abs(e.clientY - downY) > DRAG_SLOP){
        dragging = true;
        try{ host.setPointerCapture(downId); }catch(_){}
      }
      if(dragging) seek(e.clientY);
    });
    const release = e => {
      if(dragging){ try{ host.releasePointerCapture(downId); }catch(_){} }
      downY = null; downId = null;
      // let the click through only if this was a click
      setTimeout(() => { dragging = false; wake(); }, 0);
    };
    host.addEventListener("pointerup", release);
    host.addEventListener("pointercancel", release);
    host.addEventListener("pointerenter", () => { hovering = true; wake(); });
    host.addEventListener("pointerleave", () => { hovering = false; wake(); });

    pane.addEventListener("scroll", () => {
      const t = pane.scrollTop;
      if(t !== lastTop){ lastTop = t; lastMoved = now(); }
      paint(); wake();
    }, { passive:true });
    /* ...AND THE HAND, NOT ONLY THE PAGE (13 Sep). `scroll` is the only thing
       that woke the rail, and a scroll event only exists if the page actually
       MOVED. On a book heavy enough to drop frames it does not: the wheel is
       still turning, the page is still gated behind the main thread, no
       `scroll` arrives for 100ms, `hold` expires, the class comes off -- and
       taking it off costs 75ms of style recalc across the capsules (measured,
       complete Shakespeare, 865 of them), which guarantees the next gap too.
       Twenty-six times a second, and the page ends up travelling 0px under a
       full second of wheel.

       The gesture is the truth here, not the scroller's answer to it: the rail
       is up because a hand is moving, so the hand is what it listens to. Both
       are passive -- nothing here may sit in front of the reading scroll -- and
       neither reads or writes layout. */
    const handMoved = () => { lastMoved = now(); wake(); };
    addEventListener("wheel", handMoved, { passive:true });
    addEventListener("touchmove", handMoved, { passive:true });
    addEventListener("resize", () => { build(); apply(); });

    /* ---- THE SETTINGS, as custom properties on the host, so a bench moves one
       number and nothing here has to know a bench exists. */
    function apply(){
      const s = host.style;
      s.setProperty("--sc-inset",  px(cfg.inset));
      s.setProperty("--sc-top",    cfg.top + "vh");
      s.setProperty("--sc-bottom", cfg.bottom + "vh");
      s.setProperty("--sc-w",      px(cfg.width));
      s.setProperty("--sc-w-awake",px(cfg.awakeWidth));
      s.setProperty("--sc-gap",    px(cfg.gap));
      s.setProperty("--sc-r",      px(cfg.radius));
      s.setProperty("--sc-min",    px(cfg.minSeg));
      s.setProperty("--sc-read",   cfg.read);
      s.setProperty("--sc-unread", cfg.unread);
      s.setProperty("--sc-dim",    String(cfg.dim));
      s.setProperty("--sc-fill-w", px(cfg.fillWidth));
      s.setProperty("--sc-fill",   cfg.fillColour || cfg.read);
      /* THE PHONE'S OWN LABEL SIZE. Decided by the viewport, not by the host's
         width -- the rail is `position:fixed` and is as tall as the window on
         every device, so its own box says nothing about which device it is.
         `html[data-phone]` wins outright where the app has set it; otherwise
         the width decides, so the bench answers the same way at 402 as a phone
         does. Re-read on every `resize`, because a Mac window is dragged
         across `phoneAt` and a phone is not. */
      const phone = document.documentElement.hasAttribute("data-phone")
                 || innerWidth <= cfg.phoneAt;
      s.setProperty("--sc-lab",    px(phone ? cfg.labelSizePhone  : cfg.labelSize));
      s.setProperty("--sc-lab-w",  px(phone ? cfg.labelWidthPhone : cfg.labelWidth));
      s.setProperty("--sc-lab-gap",px(cfg.labelGap));
      host.classList.toggle("barfill", cfg.fillStyle === "bar");
      host.classList.toggle("nolabels", !cfg.labels);
      host.classList.toggle("awake", cfg.wake === "always");
      if(cfg.wake === "never") host.classList.remove("awake");
    }
    apply();

    return {
      render(book){ if(book) o.book = book; build(); apply(); },
      paint, wake, apply, progress,
      set(k, v){ cfg[k] = v; apply();
        if(k === "gap" || k === "minSeg") build();
        if(k === "fillStyle" || k === "fillWidth" || k === "fillColour") paint();
        if(k === "labelMin" || k === "labelSize" || k === "labelSizePhone"
           || k === "phoneAt" || k === "top" || k === "bottom") fitLabels();
        return cfg[k]; },
      get cfg(){ return cfg; },
      get count(){ return segs.length; },
    };
  }

  const Scrub = { DEFAULTS, defaults(){ return Object.assign({}, DEFAULTS); }, mount };
  if(typeof module === "object" && module.exports) module.exports = Scrub;
  root.Scrub = Scrub;
})(typeof window !== "undefined" ? window : globalThis);
