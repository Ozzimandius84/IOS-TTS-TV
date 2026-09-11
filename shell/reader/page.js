/* ENGINE · the reading page itself -- sections, the measured boxes, the running head
   · bench: bench-page.html · mounted by: see MAP.md (generated -- `python3 map.py`) */
/* ======================= THE READING PAGE — the column ====================
   A module, not a page. The bench and the app link this same file.

     Page.mount({ pane, column, runhead }) -> handle
     handle: render(book) · relayout() · wake() · boxes() · book

   pane     the scroller
   column   where the chapters go
   runhead                  optional; omit it and the page is just text.
   THE RAIL IS NOT HERE. It is scrub.js, mounted by book-nav.js -- see below. */
(function(){

const esc = s => String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* THE COLUMN: A ROUGH STANDARD, NOT A MEASUREMENT.
   A chapter gets the NARROWEST STANDARD BOX THAT HOLDS ITS 90th-PERCENTILE
   LINE. The boxes ARE the thresholds -- no separate table of character counts
   to keep in step, and no test anywhere for "is this poetry".
   Two passes, because a line only reports its true ink width when it has room
   not to wrap: pass 1 clears every width so each chapter sits at the full
   measure; pass 2 classifies. Prose falls through to the measure on its own --
   its lines wrap, so they report the measure, and no box is wide enough.
   The 90th percentile, not the max: a verse scene with two long prose
   speeches in it is a verse scene and should set as one. Not the median
   either -- that is 30 characters in Hamlet and would shred the prose.

   IT SAMPLES. Measuring every line of every chapter with a Range is what made
   long books expensive, and that cost -- not the DOM -- is why the reading
   bench capped at 40 chapters while the collection bench allowed 400. A
   chapter is classified from at most SAMPLE evenly-spaced lines, so the work
   is bounded per chapter however long the chapter is, and the classifier's
   cost stops scaling with the length of the book. A 90th percentile of 160
   evenly-spaced lines and of all 4,000 land in the same box; the boxes are
   ems apart, and no percentile estimate is going to fall between them. */
const BOXES = ["--box-lyric","--box-verse"];   // narrowest first; then --measure
const SAMPLE = 160;                            // lines measured per chapter

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
function tintOpeners(col, palette){
  const grounds = openerGrounds(palette);
  const openers = col.querySelectorAll(".opener");
  openers.forEach((el,i)=>{
    const g = grounds.length ? grounds[i % grounds.length] : null;
    if(g){
      el.classList.add("tinted");
      el.style.setProperty("--slide-ground", g);
      el.style.setProperty("--slide-ink", contrastInk(g));
    } else {
      el.classList.remove("tinted");
      el.style.removeProperty("--slide-ground");
      el.style.removeProperty("--slide-ink");
    }
  });
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

  /* where this book's own files sit, from whichever page is doing the
     drawing: books/<slug>/images/... is what a fig block carries, and every
     page that mounts this lives in design/reader/. */
  function baseFor(book){
    const slug = book && book.slug;
    return slug ? "../books/" + encodeURIComponent(slug) + "/" : "";
  }
  function render(book){
    const BASE = baseFor(book);
    CUR=book; col.innerHTML="";

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
    }
    (book.chapters||[]).forEach((ch,ci)=>{
      const sec=document.createElement("section");
      sec.className="chapter"; sec.dataset.ch=ci;
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
        if(b.r==="dir"){ h+='<p class="dir">'+esc(b.t)+'</p>'; return; }
        const brk = lastStanza!==null && b.st!==lastStanza;
        h+='<p class="line'+(brk?' stanza':'')+'">'+esc(b.t)+'</p>';
        lastStanza = b.st===undefined?null:b.st;
      });
      if(open) h+='</div>';
      h+='<snapend></snapend>';
      sec.innerHTML=h; col.appendChild(sec);
    });
    tintOpeners(col, book.palette);
    placeAxis(); paint();
    return handle;
  }

  function placeAxis(){
    const chapters=[...col.querySelectorAll(".chapter")];
    if(!chapters.length) return [];
    chapters.forEach(c=>c.style.removeProperty("--w"));            // pass 1
    const cs=getComputedStyle(document.documentElement);
    const rem=parseFloat(cs.fontSize)||16;
    const boxes=BOXES.map(n=>({n, px:parseFloat(cs.getPropertyValue(n))*rem}))
                     .filter(b=>b.px>0).sort((x,y)=>x.px-y.px);
    const r=document.createRange(), out=[];
    for(const c of chapters){
      const ps=c.querySelectorAll("p.line, p.dir");
      const step=Math.max(1, Math.ceil(ps.length/SAMPLE));
      const w=[];
      for(let i=0;i<ps.length;i+=step){
        const p=ps[i];
        if(!p.textContent.trim()) continue;
        r.selectNodeContents(p);
        let m=0; for(const rect of r.getClientRects()) if(rect.width>m) m=rect.width;
        if(m>1) w.push(m);
      }
      if(!w.length) continue;                       // an opener-only section
      w.sort((x,y)=>x-y);
      const p90=w[Math.min(w.length-1, Math.floor(w.length*0.9))];
      const box=boxes.find(b=>b.px>=p90);           // narrowest that holds it
      if(box) c.style.setProperty("--w", "var("+box.n+")");   // else: the measure
      out.push({ch:c.dataset.ch, p90:Math.round(p90), box:box?box.n.slice(6):"measure"});
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
    const all=[...col.querySelectorAll(".chapter")];
    const chs=all.filter(c=>!c.classList.contains("titlepage"));
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
    if(runhead){
      const onTitle = line < (chs[0]?chs[0].offsetTop:0);
      const ch=(CUR&&CUR.chapters&&CUR.chapters[cur])||{n:"",t:""};
      runhead.innerHTML='<b>'+esc(CUR?CUR.title:"")+'</b>'
        + (onTitle ? '<span>'+esc((CUR&&CUR.author)||"")+'</span>'
                   : '<span>'+esc(ch.n)+(ch.t?(ch.n?' · ':'')+esc(ch.t):'')+'</span>');
    }
  }

  function relayout(){ placeAxis(); paint(); }

  pane.addEventListener("scroll", paint, {passive:true});
  addEventListener("resize", placeAxis);
  /* the reading face lands after first layout and moves every offset with it */
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  addEventListener("load", relayout);

  /* `wake` is kept and does nothing. `pair.html` calls `page.wake()` and this
     file no longer has anything to wake -- the rail wakes itself, off the same
     scroll. A no-op with a reason beats an exception in a page nobody was
     asked to change today. */
  const handle = { render, relayout, paint, boxes: placeAxis,
                   wake(){},
                   get book(){ return CUR; } };
  return handle;
}
window.Page = {mount};
})();
