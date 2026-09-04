/* ======================= THE READING PAGE — the column ====================
   A module, not a page. The bench and the app link this same file.

     Page.mount({ pane, column, scrub, fill, runhead }) -> handle
     handle: render(book) · relayout() · wake() · boxes() · book

   pane     the scroller
   column   where the chapters go
   scrub / fill / runhead   optional; omit them and the page is just text  */
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
   reader/design/palette.py and carried in as book.palette -- this file
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
  const pane=o.pane, col=o.column, scrub=o.scrub, fill=o.fill, runhead=o.runhead;
  let CUR=null, marks=[], hideT=null;

  function render(book){
    CUR=book; col.innerHTML="";
    if(scrub) scrub.querySelectorAll(".g").forEach(g=>g.remove());

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
    buildScrub(book); placeAxis(); placeMarks(); paint();
    return handle;
  }

  function buildScrub(book){
    if(!scrub){ marks=[]; return; }
    /* the title page is a stop on the rail too -- without it the book looks
       as though it begins off the end of the bar rather than at the top */
    const rows=(book.title?[{n:"", title:true}]:[]).concat(book.chapters||[]);
    marks = rows.map(ch=>{
      const g=document.createElement("div");
      g.className = ch.title ? "g title" : "g";
      g.innerHTML='<div class="m"></div><div class="l">'+esc(ch.n||"")+'</div>';
      scrub.appendChild(g); return g;
    });
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

  /* A MARK SITS WHERE ITS CHAPTER ACTUALLY IS. Spacing them evenly while the
     fill tracks real scroll is why the bar ran ahead of the marks and then
     caught up -- chapters are not the same length. */
  function placeMarks(){
    if(!scrub) return;
    const span=Math.max(1, pane.scrollHeight - pane.clientHeight);
    col.querySelectorAll(".chapter").forEach((c,i)=>{
      if(!marks[i]) return;
      const top=(14 + 72*Math.min(1, c.offsetTop/span))+"vh";
      marks[i].querySelector(".m").style.top=top;
      marks[i].querySelector(".l").style.top=top;
      marks[i].onclick=()=>c.scrollIntoView({behavior:"smooth"});
    });
  }

  function wake(){
    if(!scrub) return;
    scrub.classList.add("awake");
    clearTimeout(hideT);
    hideT=setTimeout(()=>scrub.classList.remove("awake"), 1100);
  }

  function paint(){
    const span=Math.max(1, pane.scrollHeight - pane.clientHeight);
    if(fill) fill.style.height=(72*(pane.scrollTop/span))+"vh";
    const all=[...col.querySelectorAll(".chapter")];
    const chs=all.filter(c=>!c.classList.contains("titlepage"));
    const off=all.length-chs.length;
    let cur=0;
    chs.forEach((c,i)=>{ if(c.offsetTop - pane.scrollTop <= pane.clientHeight*0.35) cur=i; });
    marks.forEach((g,i)=>g.classList.toggle("on", i===cur+off));
    if(runhead){
      const onTitle = pane.scrollTop < (chs[0]?chs[0].offsetTop:0) - pane.clientHeight*0.5;
      const ch=(CUR&&CUR.chapters&&CUR.chapters[cur])||{n:"",t:""};
      runhead.innerHTML='<b>'+esc(CUR?CUR.title:"")+'</b>'
        + (onTitle ? '<span>'+esc((CUR&&CUR.author)||"")+'</span>'
                   : '<span>'+esc(ch.n)+(ch.t?(ch.n?' · ':'')+esc(ch.t):'')+'</span>');
    }
  }

  function relayout(){ placeAxis(); placeMarks(); paint(); }

  pane.addEventListener("scroll", ()=>{ paint(); wake(); }, {passive:true});
  if(scrub) scrub.addEventListener("pointerenter", wake);
  addEventListener("resize", ()=>{ placeAxis(); placeMarks(); });
  /* the reading face lands after first layout and moves every offset with it */
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  addEventListener("load", relayout);

  const handle = { render, relayout, wake, paint, boxes: placeAxis,
                   get book(){ return CUR; } };
  return handle;
}
window.Page = {mount};
})();
