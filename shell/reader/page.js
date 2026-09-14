/* ENGINE · the reading page itself -- sections, the measured boxes, the running head
   · bench: bench-page.html · mounted by: see MAP.md (generated -- `python3 map.py`) */
/* ======================= THE READING PAGE — the column ====================
   A module, not a page. The bench and the app link this same file.

     Page.mount({ pane, column, runhead }) -> handle
     handle: render(book) · relayout() · wake() · boxes() · ensure(i) · book

   pane     the scroller
   column   where the chapters go
   runhead                  optional; omit it and the page is just text.
   THE RAIL IS NOT HERE. It is scrub.js, mounted by book-nav.js -- see below. */
(function(){

const esc = s => String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* THE COLUMN FOLLOWS THE PARSER, AND NO LONGER MEASURES THE PAINT.
   Osca, 13 September: *"The reader CANNOT be the LCD. It must just follow the
   parser."*

   WHAT STOOD HERE. A chapter got "the narrowest standard box that holds its
   90th-percentile line", found by running a Range over up to 160 painted
   lines per chapter and reading their widest client rect -- a pixel test for
   "is this poetry", and its own comment said so: "no test anywhere for 'is
   this poetry'". That is the LCD exactly. The parser has answered the
   question since schema_version 3: `Paragraph.kind` is one of body | heading |
   quote | verse | note | caption, and `Paragraph.stanza` is set on verse and
   None on everything else. Measured across the shelf, 13 Sep: 269,225
   paragraphs in 38 books, and `stanza is not None` agreed with `kind ==
   "verse"` on every one of them -- 0 mismatches. `book-data.js` carries
   `st` for exactly that reason (book.js: "null when the parser gives none,
   which is how prose is told from verse downstream"), and until today nothing
   downstream read it.

   So the fact arrives free, and the measuring is gone. What it cost, measured
   in Chromium on the Complete Works: `placeAxis` alone 5,260ms at 1440x900
   and 1,264ms at 393x852, on open and again on every resize -- and it ran in
   TWO passes, clearing every width and then setting them, which is a re-wrap
   the reader watches happen (A3.20, "no re-wrap on open, no jump"). Both
   passes are deleted, not sped up.

   AND THE MARGIN IS ONE NUMBER, END TO END. Osca, the same line: *"Margin set
   end to end like a book."* A per-chapter box is a per-chapter MARGIN:
   measured before this change, Hamlet at 1440 stood at three widths --
   589.98, 750.89, 865 -- and so at three left margins, 425, 344.55 and 287.5,
   stepping in and out as you read down one play. The reference this file was
   measured off does not do that and this file already said so eleven lines
   further down: at 1440 it puts 1,085 of its 1,085 paragraphs in ONE box,
   W865. One box is the default now.

   THE BOXES ARE KEPT AND RE-AIMED, not deleted: `html[data-verse-box]` turns
   centred verse back on, and it is then chosen from the PARSER's verse lines
   measured in CHARACTERS -- one advance-width probe for the whole book instead
   of 160 Ranges per chapter -- so even the opt-in never asks the paint what
   kind of writing it is looking at. */
const BOXES = ["--box-lyric","--box-verse"];   // narrowest first; then --measure
/* ~47ch and ~60ch, as tokens.css states them; the third box is --measure. */

/* ======================== THE WINDOW (13 September) ======================
   Osca: *"I want 30 books open at the same time. Or even just with very large
   books, it struggles."* K25 (design/reader/pixelcheck/K25-open-books.md)
   named the second half of that as its own bug, and it is this file's:

     render() mounted EVERY chapter -- 225,169 elements and 866 sections on the
     complete Shakespeare, of which 98.8% is text nobody can see. 16.7 s to
     open, 7.8 s more before the main thread went quiet, 2.55 GB of RSS for one
     book, and three of them were the ceiling on an 8 GB machine.

   (G-TYPO, the same day and the commit before this one, took the OTHER half of
   that cost out of `placeAxis` -- the Range over 160 painted lines per chapter.
   The two are independent: that one stopped MEASURING the whole book, this one
   stops MOUNTING it. Both were needed and neither is the other.)

   So the book in front of you is resident only AROUND THE CURSOR. Every
   chapter still gets its own <section class="chapter" data-ch="i"> at render,
   in order, for ever -- nothing outside this file may notice the difference,
   and the element list book-nav.js caches, scrub.js's rail segments and
   `scrollReaderTo`'s own section reference all keep working because no
   section is ever created or destroyed after render. What changes is what is
   INSIDE one: a section outside the window is empty and carries its height,
   and is filled in as the cursor comes near.

   THE SIZE OF THE WINDOW, and why. Not "the current chapter ± N" alone: a
   Shakespeare scene is a few hundred pixels and a chapter of Napoleon's
   letters is a few thousand, so a fixed N is a screenful in one book and
   forty in another. The window is therefore measured in SCREENS -- enough
   chapters that MARGIN viewports of real text stand above and below the
   reading line -- with NEAR as a floor so the neighbours either side are
   always there whatever the geometry says. MARGIN is 1.5 because the wheel
   flick K25 measures travels ~2,400 px in a second at 60 fps; 1.5 viewports
   (1,350 px at 1440x900) is what a reader can cross between two scroll
   events, and mounting is done ON the scroll event. MAXSIDE is a ceiling for
   a book of one-line chapters, never reached by any book we have.

   THE HEIGHT OF A SECTION THAT IS NOT MOUNTED. K25 said the placeholder
   heights "have to come from somewhere: a per-chapter height baked into
   book-data.js is a request to core/bookdata.py". They do not, and it is not:
   they come from THIS book, at THIS width, measured. A chapter's UNITS are a
   pure function of its own blocks (characters, plus a constant per block and
   per opener); every chapter that mounts is measured and its real height goes
   into the calibration, so px-per-unit is an average taken from the book
   being read rather than a constant anyone had to guess. The first window is
   mounted and measured BEFORE a single placeholder height is written, so even
   the first estimate is calibrated. A chapter that has been visited keeps its
   MEASURED height for ever after and is never estimated again -- so the axis
   and the rail firm up as you read, which is exactly what `contain-intrinsic-
   size: auto` was already doing for the skip, and for the same reason.

   POSITION IS SACRED. Every write that can change the geometry is bracketed:
   the section at the reading line has its `offsetTop` read before and after,
   and the scroller is moved by the difference, so a chapter mounting or an
   estimate being corrected 400 chapters below moves nothing on the screen.
   Two layout reads, not a pass. The one exception is while book-nav.js's own
   jump-settle owns the scroller (`<html data-nosnap>`, set by
   `scrollReaderTo`): that loop re-asserts the target's top every frame and a
   second hand on the same number would fight it. */
const NEAR    = 2;     // chapters either side, always, whatever the heights say
const MARGIN  = 1.5;   // ...and enough more that this many viewports are real
const MAXSIDE = 60;    // a ceiling per side, for a book of one-line chapters
const MINSTUB = 24;    // no section is worth less than this
/* the fallback px-per-unit, used only until the first chapter has been
   measured -- i.e. for no frame the reader ever sees. */
const BOOTPX  = 0.42;
const U_OPEN  = 1400;  // an opener slide, in units
const U_BLOCK = 24;    // a block's own margins
const U_FIG   = 900;   // a plate

/* THE OPENER IS A SLIDE (page.css), and #4b gives it the book's own
   colours: primary/secondary/tertiary, extracted once from the cover by
   design/reader/palette.py and carried in as book.palette -- this file
   does no colour science of its own, only the cycling and the contrast
   pick. UI-PLAN.md's "LCD" reading: fall back down the list. */
function openerGrounds(palette){
  if(!palette) return [];
  const cs = [palette.primary, palette.secondary, palette.tertiary].filter(Boolean);
  if(cs.length >= 2) return cs;              // 2 or 3 found -- alternate them
  if(cs.length === 1) return [cs[0], null];  // one colour and the default paper
  return [];                                 // none -- default paper throughout
}
// simple perceived-brightness split (ITU-R BT.601), not the cover's own ink --
// #4b: "ink is chosen for contrast against each ground, not taken from the cover".
function contrastInk(hex){
  const n = parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255;
  return (r*299 + g*587 + b*114)/1000 >= 140 ? "#17150f" : "#f6f3ea";
}
/* ONE opener, by its ORDINAL in the column. It was a pass over every
   `.opener` in the page (`openers.forEach((el,i)=>...)`), which is a list the
   window no longer has -- the openers of the chapters that are not mounted do
   not exist. The ordinal is arithmetic instead: the synthesised title slide is
   0 when there is one, and chapter `ci` is the one after it. Same cycle, same
   colour on the same chapter, and it survives a chapter being unmounted and
   mounted again. */
function tintOpener(el, ordinal, palette){
  if(!el) return;
  const grounds = openerGrounds(palette);
  const g = grounds.length ? grounds[ordinal % grounds.length] : null;
  if(g){
    el.classList.add("tinted");
    el.style.setProperty("--slide-ground", g);
    el.style.setProperty("--slide-ink", contrastInk(g));
  } else {
    el.classList.remove("tinted");
    el.style.removeProperty("--slide-ground");
    el.style.removeProperty("--slide-ink");
  }
}

function mount(o){
  const pane=o.pane, col=o.column, runhead=o.runhead;
  let CUR=null;
  /* THE RAIL LEFT THIS FILE, 9 September. It drew ticks and one whole-book fill
     into `#readerscrub`; `scrub.js` drew capsules for a bench nothing else
     loaded. Two rails, and the bench pointed at the one the app did not run --
     which is the whole of Osca's "the bench is behind, I can't edit it".
     `scrub.js` is the rail now, mounted by `book-nav.js` on the same host, and
     `Page.mount` no longer takes a `scrub` or a `fill`. What stays here is the
     page: the sections, the measured boxes, and the running head. */

  /* THE WINDOW'S OWN STATE. SECS is the chapter sections in order (the
     synthesised title slide is not one of them), and its indices ARE
     book.chapters' indices -- data-ch, everywhere. */
  let SECS=[];
  const MOUNTED = new Set();
  let HEIGHT=[];        // measured px, per chapter; null until it has mounted
  let BOX=[];           // placeAxis's answer per chapter; null = never asked
  let UNITS=[];         // the chapter's own size, in units, from its blocks
  let PIN=-1;           // one chapter that may not be unmounted (the word view's)
  let calPx=0, calUnits=0;   // the calibration: measured px against those units
  /* the window's own tally, for a bench or a check to read (windowNow) */
  const TALLY = {passes:0, moves:0, mounts:0, unmounts:0, fixes:0, fixPx:0};

  /* where this book's own files sit, from whichever page is doing the
     drawing: books/<slug>/images/... is what a fig block carries, and every
     page that mounts this lives in design/reader/. */
  function baseFor(book){
    const slug = book && book.slug;
    return slug ? "../books/" + encodeURIComponent(slug) + "/" : "";
  }
  /* ONE CHAPTER'S HTML. Lifted out of render()'s loop unchanged -- it is what
     a section gets when it mounts, which is now not always at render. */
  function chapterHTML(ch, BASE){
    let h='<div class="opener"><snap></snap><h1>'
         +(ch.n?'<small>'+esc(ch.n)+'</small>':'')+esc(ch.t||"")+'</h1></div>';
    let open=false, lastStanza=null;
    (ch.blocks||[]).forEach(b=>{
      /* A PICTURE IS A SLIDE, WHERE THE BOOK PRINTED IT. Osca: "if a
         picture APPEARS within a chapter, in the source, make a slide for it
         there, inside the chapter... The top/bottom slides NOT the side
         slides."

         The parse has always recorded these -- books/<slug>/images/ holds
         the real plates (38 in David Copperfield, 24 in Letters to a Young
         Creator) and the bake carries every one into book-data.js as a
         `fig` block anchored to the paragraph it follows. Nothing drew
         them: this loop knew `sp`, `dir` and a line, and silently dropped
         anything else. So they arrive here, in the reading flow, between
         the paragraph before and the paragraph after -- a slide you scroll
         onto, not a thumbnail in the text.

         width/height go on the element on purpose: the box is then correct
         before the file has loaded, which keeps `loading="lazy"` from
         moving the page under the reader and keeps the measured chapter
         heights the shell's own skipping depends on honest. */
      if(b.r==="fig" && b.src){
        if(open){ h+='</div>'; open=false; }
        const src = BASE + b.src;
        const cap = (b.t||"").trim();
        h+='<div class="plate"><snap></snap><figure>'
          +'<img src="'+esc(src)+'" alt="'+esc(cap)+'" loading="lazy" decoding="async"'
          +(b.w?' width="'+(+b.w)+'"':'')+(b.h?' height="'+(+b.h)+'"':'')+'>'
          /* the alt is often the source's own page number ("0041"); that is
             provenance, not a caption, so it is not printed as one. */
          +(cap && !/^\d+$/.test(cap) ? '<figcaption>'+esc(cap)+'</figcaption>' : '')
          +'</figure></div>';
        lastStanza=null;
        return;
      }
      if(b.r==="sp"){                     /* a speaker turn is a sub-chapter */
        if(open) h+='</div>';
        h+='<div class="unit"><snap></snap><p class="sp">'+esc(b.t)+'</p>';
        open=true; lastStanza=null; return;
      }
      if(!open){ h+='<div class="unit"><snap></snap>'; open=true; }
      if(b.r==="dir"){ h+='<p class="dir">'+esc(b.t)+'</p>'; lastStanza=null; return; }
      /* A PROSE PARAGRAPH IS NOT A LINE OF VERSE, and this loop used to set
         them as the same thing. Everything that was not a speaker cue, a
         stage direction or a picture came out as `<p class="line">`, and
         page.css gives consecutive lines `margin-top:0` and no indent --
         so Walden's 497 prose paragraphs arrived with NO gap and NO indent
         between them, measured: all 775 of its paragraphs reported
         text-indent 0px and margin-top 0px at both 393 and 1440. A wall.

         `st` is the parser's stanza number, written on verse and left null
         on prose (core/schema.py `Paragraph.stanza`; core/bookdata.py puts
         it on every `l` block). It is the whole discriminator and it has
         been in the file all along -- 0 disagreements with `kind` in
         269,225 paragraphs. A block with a stanza is a LINE; a block
         without one is a PARAGRAPH, and page.css sets each as its own
         thing. Nothing here decides which; it reads. */
      /* AND `line` STAYS ON BOTH, WHICH IS NOT COSMETIC. `p.line` is this
         product's WORD INDEX: every word id is positional over
         `sec.querySelectorAll("p.line")` in document order, and five live
         files walk it that way -- book-nav.js::buildWordDomIndex (1198),
         follow.js (189), listen.js (299, with p.sp and p.dir), sysvoice.js
         and marginalia.js, in design/reader/ AND in reader/. A prose
         paragraph that stopped being a `p.line` would drop out of that walk
         and shift every id after it: word-level highlighting, tap-to-look-up,
         the voice cursor and every margin note on every prose book, silently
         wrong. So `para` is ADDED, never substituted -- the index sees
         exactly what it saw yesterday, and only page.css reads the new
         class. */
      const verse = b.st !== undefined && b.st !== null;
      if(!verse){ h+='<p class="line para">'+esc(b.t)+'</p>'; lastStanza=null; return; }
      const brk = lastStanza!==null && b.st!==lastStanza;
      h+='<p class="line'+(brk?' stanza':'')+'">'+esc(b.t)+'</p>';
      lastStanza = b.st;
    });
    if(open) h+='</div>';
    h+='<snapend></snapend>';
    return h;
  }

  /* A CHAPTER'S SIZE BEFORE ANYONE HAS SEEN IT, in units -- characters, plus a
     constant for each block's own margins and one for the opener slide. Units
     are not pixels and are not meant to be: what turns them into pixels is
     measured, below, from the chapters of this same book that have mounted. */
  function unitsOf(ch){
    let u = U_OPEN;
    const bs = (ch && ch.blocks) || [];
    for(let i=0;i<bs.length;i++){
      const b = bs[i];
      if(b.r==="fig"){ u += U_FIG; continue; }
      u += U_BLOCK + ((b.t && b.t.length) || 0);
    }
    return u;
  }
  const pxPerUnit = () => (calUnits > 0 ? calPx/calUnits : BOOTPX);
  const estimate  = ci => Math.max(MINSTUB, Math.round(UNITS[ci] * pxPerUnit()));
  const heightOf  = ci => HEIGHT[ci] || estimate(ci);

  /* ---- mounting one section, and putting one back ---------------------- */
  function mountOne(ci, BASE){
    if(MOUNTED.has(ci)) return false;
    const sec = SECS[ci]; if(!sec) return false;
    sec.innerHTML = chapterHTML(CUR.chapters[ci], BASE);
    sec.classList.remove("stub");
    sec.style.minHeight = "";
    tintOpener(sec.querySelector(".opener"), (CUR.title?1:0)+ci, CUR.palette);
    if(BOX[ci]) sec.style.setProperty("--w", BOX[ci]);
    else sec.style.removeProperty("--w");
    MOUNTED.add(ci); TALLY.mounts++;
    return true;
  }
  /* A section is emptied down to its LAST MEASURED height, never back to an
     estimate: once you have read a chapter the book's geometry there is known,
     and it must not go soft again behind you. `--w` goes with the text (an
     empty box has no measure) but BOX keeps the answer, so remounting asks the
     parser nothing twice. */
  function unmountOne(ci, h){
    if(!MOUNTED.has(ci) || ci===PIN) return false;
    const sec = SECS[ci]; if(!sec) return false;
    if(h > 0) HEIGHT[ci] = h;
    sec.innerHTML = "";
    sec.classList.add("stub");
    sec.style.minHeight = heightOf(ci) + "px";
    sec.style.removeProperty("--w");
    MOUNTED.delete(ci); TALLY.unmounts++;
    return true;
  }

  /* WHERE THE READING LINE IS, by binary search over the LIVE tops -- the same
     question, and the same eleven reads rather than a pass, that paint() and
     book-nav.js's own `sectionAt` ask. A section that is not mounted answers
     honestly: its height is its own, written on it. */
  function indexAt(line){
    if(!SECS.length) return 0;
    let lo=0, hi=SECS.length-1, k=0;
    while(lo<=hi){
      const mid=(lo+hi)>>1;
      if(SECS[mid].offsetTop<=line){ k=mid; lo=mid+1; } else hi=mid-1;
    }
    return k;
  }
  function windowAround(cur){
    const n = SECS.length;
    const want = (pane.clientHeight||800) * MARGIN;
    let lo=cur, up=0;
    while(lo>0 && (up<want || cur-lo<NEAR) && cur-lo<MAXSIDE){ lo--; up += heightOf(lo); }
    let hi=cur, down=heightOf(cur);
    while(hi<n-1 && (down<want || hi-cur<NEAR) && hi-cur<MAXSIDE){ hi++; down += heightOf(hi); }
    return [lo,hi];
  }

  /* THE SETTLE OWNS THE SCROLLER, NOT US. book-nav.js's `scrollReaderTo` puts
     `data-nosnap` on <html> for the few frames it is re-asserting a jump's
     target; correcting the scroller underneath that loop is two hands on one
     number. The mounting still happens -- only the compensation is left to it,
     and it re-reads the target's own top every frame, which is the same
     correction by another route. */
  function settling(){
    try { return document.documentElement.hasAttribute("data-nosnap"); }
    catch(_) { return false; }
  }
  /* the scroller moved by exactly what the page grew above the reader, and
     never by a pixel more. Chromium's own scroll anchoring usually gets there
     first, in which case the residual is 0 and nothing is written -- but it is
     suppressed in more cases than it is documented for, and on this page the
     cost of being wrong is the reader losing their place. */
  function hold(anchor, s0, a0){
    const a1 = anchor ? anchor.offsetTop : 0;
    if(settling() || a1 === a0) return;
    const want = s0 + (a1 - a0);
    if(Math.abs(pane.scrollTop - want) >= 1){
      TALLY.fixes++; TALLY.fixPx += Math.abs(want - pane.scrollTop);
      pane.scrollTop = want;
    }
  }

  /* ---- THE ONE ENTRY: bring the window to where the reader is ---------- */
  function syncWindow(cur){
    if(!CUR || !SECS.length) return false;
    if(cur==null) cur = indexAt(pane.scrollTop + pane.clientHeight*0.5);
    const [lo,hi] = windowAround(cur);
    let need = false;
    for(let i=lo;i<=hi;i++) if(!MOUNTED.has(i)){ need=true; break; }
    const drop = [];
    for(const ci of MOUNTED) if((ci<lo || ci>hi) && ci!==PIN) drop.push(ci);
    TALLY.passes++;
    if(!need && !drop.length) return false;
    TALLY.moves++;

    const anchor = SECS[cur], s0 = pane.scrollTop;
    const a0 = anchor ? anchor.offsetTop : 0;
    /* every height this pass needs is read BEFORE the first write, so the
       drops cost one layout between them and not one each */
    const hs = drop.map(ci => SECS[ci].offsetHeight);
    const BASE = baseFor(CUR);
    for(let k=0;k<drop.length;k++) unmountOne(drop[k], hs[k]);
    for(let i=lo;i<=hi;i++) mountOne(i, BASE);
    placeAxis(unboxed());
    measureMounted();
    hold(anchor, s0, a0);
    return true;
  }

  /* WHAT THE MOUNTED CHAPTERS ACTUALLY MEASURE, and the calibration that comes
     off it. One `offsetHeight` per mounted chapter -- five reads, not 866. */
  function measureMounted(){
    for(const ci of MOUNTED){
      const h = SECS[ci].offsetHeight;
      if(h > 0 && HEIGHT[ci] !== h){
        if(HEIGHT[ci] == null && UNITS[ci] > 0){ calPx += h; calUnits += UNITS[ci]; }
        HEIGHT[ci] = h;
      }
    }
  }
  /* Re-price every section nobody has visited, at the current px-per-unit.
     Writes only -- no section is asked for its size here -- and bracketed by
     the caller when it can move the page. */
  function repriceStubs(){
    for(let i=0;i<SECS.length;i++){
      if(MOUNTED.has(i) || HEIGHT[i]) continue;
      SECS[i].style.minHeight = estimate(i) + "px";
    }
  }

  function render(book){
    const BASE = baseFor(book);
    CUR=book; col.innerHTML="";
    SECS=[]; MOUNTED.clear(); HEIGHT=[]; BOX=[]; UNITS=[]; PIN=-1;
    calPx=0; calUnits=0;

    /* THE TITULAR SLIDE IS SYNTHESISED, never taken from a chapter. Dropping
       it with the front matter left the book looking as though it started
       mid-way; it belongs to the book, so the book provides it. */
    if(book.title){
      const tp=document.createElement("section");
      tp.className="chapter titlepage";
      tp.innerHTML='<div class="opener"><snap></snap><h1 class="booktitle">'
        +esc(book.title)+'</h1>'
        +(book.author?'<p class="byline">'+esc(book.author)+'</p>':'')+'</div>';
      col.appendChild(tp);
      tintOpener(tp.querySelector(".opener"), 0, book.palette);
    }
    /* EVERY CHAPTER GETS ITS SECTION, IN ORDER, NOW -- and only the window
       gets its text. The element list is the book's whole shape from the first
       frame, so nothing outside this file has to learn that a chapter can be
       absent: book-nav.js's cached `sections()`, scrub.js's capsules and every
       `.chapter[data-ch="n"]` query answer exactly as they did. */
    const chs = book.chapters || [];
    for(let ci=0; ci<chs.length; ci++){
      const sec=document.createElement("section");
      sec.className="chapter stub"; sec.dataset.ch=ci;
      col.appendChild(sec);
      SECS.push(sec); HEIGHT.push(null); BOX.push(null); UNITS.push(unitsOf(chs[ci]));
    }
    /* the first window, measured BEFORE a single estimate is written, so the
       calibration the estimates use is this book's own from the first frame */
    const [lo,hi] = windowAround(0);
    for(let i=lo;i<=hi;i++) mountOne(i, BASE);
    placeAxis(unboxed());
    measureMounted();
    repriceStubs();
    paint();
    return handle;
  }

  /* ON DEMAND, FROM OUTSIDE. Anything that needs a chapter's own text present
     -- the word view's index, a jump to a contents row -- asks for it here and
     it is mounted with its neighbours, geometry bracketed. `pin` keeps it
     mounted while the reader is inside it, whatever the reading line then
     does: the one-word view scrolls the column out from under the reading
     line, and a chapter unmounted while its own Ranges are live is the word
     view losing its word. One chapter is pinned at a time -- the one being
     read into -- and the previous pin is released, so this cannot grow. */
  function ensure(idx, pin){
    if(!CUR || !SECS.length) return false;
    const i = +idx;
    if(!(i>=0) || i>=SECS.length) return false;
    if(pin !== false) PIN = i;
    const anchor = SECS[indexAt(pane.scrollTop + pane.clientHeight*0.5)];
    const s0 = pane.scrollTop, a0 = anchor ? anchor.offsetTop : 0;
    const BASE = baseFor(CUR);
    let did = false;
    const [lo,hi] = windowAround(i);
    for(let k=lo;k<=hi;k++) if(mountOne(k, BASE)) did = true;
    if(did){ placeAxis(unboxed()); measureMounted(); hold(anchor, s0, a0); }
    return did;
  }

  const mountedList = () => {
    const out=[];
    for(let i=0;i<SECS.length;i++) if(MOUNTED.has(i)) out.push(SECS[i]);
    return out;
  };
  /* THE SECTIONS placeAxis HAS NOT ANSWERED FOR YET. A chapter keeps its box in
     BOX for the life of the book, so remounting one costs no second reading of
     its lines -- which is what makes reading BACK through a book free. */
  const unboxed = () => mountedList().filter(c => BOX[+c.dataset.ch] == null);

  /* ONE ADVANCE WIDTH FOR THE WHOLE BOOK, and it is the only thing on this
     page that still asks the paint anything. A hidden probe, in the column so
     it inherits the reading face and the reading size, `white-space:pre` so it
     cannot wrap, carrying a sample of the book's OWN verse lines so the
     advance is this book's letters and not the alphabet's. One rect, once per
     relayout -- against the 160-Ranges-per-chapter that stood here. */
  function advanceWidth(chapters){
    let sample = "", host = null;
    for(const c of chapters){
      if(!host) host = c;
      for(const p of c.querySelectorAll("p.line:not(.para)")){
        sample += p.textContent.trim() + " ";
        if(sample.length > 400) break;
      }
      if(sample.length > 400) break;
    }
    sample = sample.trim();
    if(!host || sample.length < 20) return 0;
    const probe = document.createElement("p");
    probe.className = "line";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;"
      + "left:0;top:0;text-indent:0;width:auto;max-width:none;pointer-events:none";
    probe.textContent = sample;
    host.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w > 0 ? w / sample.length : 0;
  }

  /* THE AXIS, AND THE WIDTH STANDING ON IT.

     The default is ONE width, end to end -- `--w` is never written, every
     chapter stands at `--measure`, and the margin is the same number from the
     title page to the last line. `html[data-verse-box]` is the way back to
     centred verse, and it is then the PARSER that says which chapters are
     verse (a chapter whose verse lines outnumber its prose paragraphs) and
     the chapter's own CHARACTER counts that pick the box.

     `boxes()` keeps its name, its signature and its return shape: the bench
     calls it, and a row per chapter is still what it wants. `p90` is now a
     character count where it used to be a pixel count, and the row says so. */
  function placeAxis(list){
    /* ...AND ONLY OVER WHAT IS MOUNTED (13 Sep, THE WINDOW). A section that is
       not mounted has no lines to count, so there is nothing here for it to be
       asked -- and its answer is remembered in BOX from the last time it was,
       so a chapter read a second time costs nothing at all. */
    const chapters = list || mountedList();
    if(!chapters.length) return [];
    const boxed = document.documentElement.hasAttribute("data-verse-box");
    const cs=getComputedStyle(document.documentElement);
    const rem=parseFloat(cs.fontSize)||16;
    const boxes=BOXES.map(n=>({n, px:parseFloat(cs.getPropertyValue(n))*rem}))
                     .filter(b=>b.px>0).sort((x,y)=>x.px-y.px);
    /* the ONE read, and it happens before any write below -- so the loop that
       follows is writes only and cannot thrash layout. */
    const adv = boxed ? advanceWidth(chapters) : 0;
    const out=[];
    for(const c of chapters){
      /* `p.line:not(.para)` -- verse only. Every paragraph is a `p.line` (the
         word index above); `para` is what says it is prose. */
      const ci = +c.dataset.ch;
      const lines=c.querySelectorAll("p.line:not(.para)");
      const prose=c.querySelectorAll("p.para").length;
      if(!lines.length){ c.style.removeProperty("--w"); if(ci===ci) BOX[ci]=""; continue; }  // opener-only, or all prose
      const chars=[];
      for(const p of lines){ const n=p.textContent.trim().length; if(n) chars.push(n); }
      if(!chars.length){ c.style.removeProperty("--w"); if(ci===ci) BOX[ci]=""; continue; }
      chars.sort((x,y)=>x-y);
      const p90=chars[Math.min(chars.length-1, Math.floor(chars.length*0.9))];
      let box=null;
      if(boxed && adv>0 && lines.length>prose){
        box=boxes.find(b=>b.px>=p90*adv);          // narrowest that holds it
      }
      if(box) c.style.setProperty("--w", "var("+box.n+")");
      else    c.style.removeProperty("--w");
      if(ci===ci) BOX[ci] = box ? "var("+box.n+")" : "";
      out.push({ch:c.dataset.ch, p90, chars:p90, box:box?box.n.slice(6):"measure",
                verse:lines.length, prose:prose});
    }
    return out;
  }

  /* book-nav.js sets this on <html> for exactly the span the reading page is
     not the thing on screen; scrub.js reads the same flag. */
  function offPage(){
    try { return document.documentElement.getAttribute("data-axis") === "off-page"; }
    catch(_) { return false; }
  }
  function paint(){
    /* ============ NOT WHILE THE AXIS IS OFF THE PAGE ============
       Counted 10 September, inside one frame of the zoom on the complete
       Shakespeare: 221 `offsetTop` reads and 217 `clientHeight` reads. They are
       these two lines. The hold loop writes the scroller every frame to keep
       the word still, every write fires `scroll`, and every `scroll` came here
       and walked all 866 chapters -- each read forcing the layout the frame's
       own style writes had just dirtied. That thrash, not the zoom, is why the
       page painted one frame per second: a zoom write costs 75ms on this book
       and the frame cost 450.

       And the running head is not on screen off the page, so it is work for a
       thing nobody can see. The next real scroll paints it. */
    if(offPage()) return;
    const chs=SECS;
    let cur=0;
    /* THE READING LINE, and scrub.js has the same number (its `READ_LINE`).
       It was 0.35 here and the rail asked a different question entirely, so on
       an opener slide the two readouts named different chapters. Osca chose
       HALFWAY, 9 Sep. Move it in one file only and test-scrub.mjs fails. */
    /* ...AND IT IS FOUND BY BINARY SEARCH, not by walking the book. The scan
       was O(chapters) in forced layouts and re-read `pane.clientHeight` on
       every step of it. book-nav.js took the same medicine for the same reason
       (see its `sectionAt`: "about eleven offsetTop [reads]" against every
       one); this is that, here. The tops ascend, so the search is sound. */
    const top = pane.scrollTop, line = top + pane.clientHeight*0.5;
    if(chs.length){
      let lo = 0, hi = chs.length - 1;
      while(lo <= hi){
        const mid = (lo + hi) >> 1;
        if(chs[mid].offsetTop <= line){ cur = mid; lo = mid + 1; } else hi = mid - 1;
      }
    }
    /* THE WINDOW MOVES WITH THE READING LINE, off the same scroll and the same
       binary search that was already being paid for. It is done before the
       running head is written, so a chapter arriving cannot leave the head
       naming the one before it for a frame. */
    let LINE = line;
    if(syncWindow(cur)){ LINE = pane.scrollTop + pane.clientHeight*0.5; cur = indexAt(LINE); }
    if(runhead){
      const onTitle = LINE < (chs[0]?chs[0].offsetTop:0);
      const ch=(CUR&&CUR.chapters&&CUR.chapters[cur])||{n:"",t:""};
      runhead.innerHTML='<b>'+esc(CUR?CUR.title:"")+'</b>'
        + (onTitle ? '<span>'+esc((CUR&&CUR.author)||"")+'</span>'
                   : '<span>'+esc(ch.n)+(ch.t?(ch.n?' · ':'')+esc(ch.t):'')+'</span>');
    }
  }

  /* A RESIZE CHANGES THE MEASURE, SO EVERY HEIGHT IS WRONG AGAIN -- the ones
     that were measured most of all. Everything is dropped back to an estimate
     and the calibration is retaken from the window, which is the only thing
     that can be measured at the new width without laying out the book. */
  function relayout(){
    if(!SECS.length){ placeAxis(); paint(); return; }
    const anchor = SECS[indexAt(pane.scrollTop + pane.clientHeight*0.5)];
    const s0 = pane.scrollTop, a0 = anchor ? anchor.offsetTop : 0;
    HEIGHT = SECS.map(()=>null); BOX = SECS.map(()=>null);
    calPx=0; calUnits=0;
    placeAxis(unboxed());
    measureMounted();
    repriceStubs();
    hold(anchor, s0, a0);
    paint();
  }

  pane.addEventListener("scroll", paint, {passive:true});
  addEventListener("resize", relayout);   /* every height is a width's -- see relayout */
  /* the reading face lands after first layout and moves every offset with it */
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  addEventListener("load", relayout);

  /* `wake` is kept and does nothing. `pair.html` calls `page.wake()` and this
     file no longer has anything to wake -- the rail wakes itself, off the same
     scroll. A no-op with a reason beats an exception in a page nobody was
     asked to change today. */
  const handle = { render, relayout, paint, boxes: placeAxis, ensure,
                   wake(){},
                   /* the window, for a bench or a check to read -- never to set */
                   get windowNow(){
                     const m=[...MOUNTED].sort((a,b)=>a-b);
                     return { mounted:m.length, lo:m[0]??-1, hi:m[m.length-1]??-1,
                              pin:PIN, sections:SECS.length,
                              measured:HEIGHT.filter(h=>h).length,
                              passes:TALLY.passes, moves:TALLY.moves,
                              mounts:TALLY.mounts, unmounts:TALLY.unmounts,
                              fixes:TALLY.fixes, fixPx:Math.round(TALLY.fixPx),
                              pxPerUnit:+pxPerUnit().toFixed(4) };
                   },
                   get book(){ return CUR; } };
  return handle;
}
window.Page = {mount};
})();
