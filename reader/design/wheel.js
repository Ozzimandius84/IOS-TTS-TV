/* ======================= THE WHEEL — the collection barrel =================
   A module, not a page. The bench and the app link this same file, so the
   bench cannot drift from the app: they are the same code.

     Wheel.mount({ el, items, onOpen, onLive }) -> handle

   el      an empty element; it becomes the wheel
   items   [{ t: name, s: sub-label }]
   onOpen  (i) => {}   a click, or Enter. THE ONLY WAY ANYTHING OPENS.
   onLive  (i) => {}   the live row changed (usually because the text moved)

   handle: setItems(items) · follow(fraction) · live(i) · mode(name) ·
           amp(0..2) · shove() · destroy()

   WHY IT TURNS RATHER THAN SCROLLS. Measured off letters.stevejobsarchive.com
   at 1440x900: 34 names in ONE column, all centred on 720, at a row pitch of
   exactly 120px, spanning T-1626 to T+2334 -- far past the viewport both
   ways. document.scrollHeight is 900 and there is no scroller anywhere on
   that page. The column is not scrolled; it is MOVED. Its whole state is one
   number: how far it has been moved, in pixels.

   ONE requestAnimationFrame LOOP OWNS THE MOTION. Events add to an input
   accumulator and nothing else. Wheel events arrive faster than frames, so
   laying out inside the handler meant several full layouts per painted frame,
   each fighting the last -- that was the jutter. Nothing here forces reflow,
   changes a class while moving, or starts a CSS animation.

   EVERY RATE IS PER 1/60s, NOT PER FRAME. On a 120Hz screen a frame-counted
   decay runs twice as fast and a frame-counted spring twice as stiff, so the
   feel changed with the display. dt is measured and every decay raised to its
   power.                                                                   */
(function(){

/* THE RIBBON IS A PHYSICAL OBJECT, not an animation with a trigger: a chain
   of torsional springs, one per name, driven by how fast the string moves.
     INERTIA  each name has its own angular velocity, so it starts late
     ENTROPY  every angle is damped toward flat, so it always settles
     GRAVITY  the drive IS the speed; stop and nothing holds it up
     HANGING  each name is sprung toward the one BEFORE IT along the ribbon,
              not toward the target -- that coupling is the travel
   Interrupting mid-settle cannot cancel anything because there is nothing to
   cancel; the energy already in the springs is still there.
   zeta = (1-d)/(2*sqrt(k)); these sit at 0.59-0.82, so one soft overshoot at
   most and no ring. Damping does not cost the travel -- travel is c. */
const RIB = {                     /* k stiffness · d damping · c coupling */
  silk:   {k:0.030, d:0.715, c:0.80, axis:"y"},
  ribbon: {k:0.060, d:0.650, c:0.68, axis:"y"},
  paper:  {k:0.120, d:0.590, c:0.48, axis:"y"},
  leaf:   {k:0.070, d:0.630, c:0.66, axis:"x"},
  none:   null
};
const AMPS = [0.018, 0.032, 0.055];
const GRAV = 0.20,   /* how hard it centres                                */
      GRAV_V = 7,    /* the speed at which gravity gives up, px per 1/60s  */
      VMAX = 240,
      COAST = 0.55;

function mount(opts){
  const el = opts.el;
  const onOpen = opts.onOpen || function(){};
  const onLive = opts.onLive || function(){};

  el.classList.add("wheel");
  el.innerHTML = '<div class="stack"></div><div class="centreline"></div>';
  const stack = el.querySelector(".stack");
  const centre = el.querySelector(".centreline");

  let ROWS=[], AT=-1;
  let off=0, vel=0, input=0, snapping=false, snapTo=0, raf=null;
  let caught=false, drag=null, kick=0, restless=false;
  let driver="wheel", wantOff=null, prevOff=0, lastT=0;
  let lastInput=0, lastMag=0;
  const ORDER=[];

  let TURN="paper", AMP=1;
  try{ TURN=localStorage.getItem("turn")||"paper";
       AMP=+(localStorage.getItem("amp")??1); }catch(_){}
  if(!(TURN in RIB)) TURN="paper";

  const css = n => parseFloat(getComputedStyle(document.documentElement)
                              .getPropertyValue(n));
  const PITCH  = () => css("--pitch")  || 168;
  const RADIUS = () => PITCH() * (css("--radius") || 2.6);
  const N      = () => ROWS.length;
  const SPAN   = () => N()*PITCH();
  function wrap(y){ const sp=SPAN(); if(!sp) return y;
    y=((y%sp)+sp)%sp; return y>sp/2 ? y-sp : y; }
  const idx  = k => { const n=N(); return n ? ((k%n)+n)%n : 0; };
  const slot = () => Math.round(off/PITCH());

  /* THE DETENT, WITH THE SLIDES' OWN RULE. scroll-snap-stop:always does not
     mean "hard to pass" -- it means THE GESTURE ENDS THERE, and a NEW gesture
     carries you out. The string stops dead on the first page and swallows the
     rest of that gesture; lift off and the next push is free. */
  function seamBetween(from, to){
    const p=PITCH(), n=N(); if(!n) return null;
    const a=from/p, b=to/p;
    if(b>a){ const k=Math.ceil(a/n)*n;  return (k>a && k<=b) ? k*p : null; }
    else   { const k=Math.floor(a/n)*n; return (k<a && k>=b) ? k*p : null; }
  }
  function move(d){
    if(caught) return;
    const hit=seamBetween(off, off+d);
    if(hit!==null){ off=hit; vel=0; snapping=false; caught=true; kick=34; return; }
    off += d;
  }

  function physics(dt){
    const m=RIB[TURN]; restless=false;
    if(!m){ for(const r of ROWS){ r._a=0; r._v=0; } return; }
    let drive=(vel+kick)*(AMPS[AMP]||0.032);
    if(drive>2.8) drive=2.8; else if(drive<-2.8) drive=-2.8;
    kick*=Math.pow(0.86,dt);
    const damp=Math.pow(m.d, dt);
    /* in the order they HANG, not array order -- the loop breaks that every
       time a name recycles across the seam, and that reshuffle is the slip */
    ORDER.sort((A,B)=>A.y-B.y);
    let prev=drive;
    for(let j=0;j<ORDER.length;j++){
      const r=ORDER[j].r;
      const ref = m.c*prev + (1-m.c)*drive;
      r._v = (r._v + (ref - r._a)*m.k*dt) * damp;
      r._a += r._v*dt;
      prev = r._a;
      if(r._v>0.0015||r._v<-0.0015||r._a>0.0015||r._a<-0.0015) restless=true;
    }
  }

  /* THE BARREL. An even step in wheel-space lands at R*sin(theta) on screen,
     pushed back by R*(cos-1) and tilted by -theta so it faces the eye. R/pitch
     is the convexity AND the number in view, so scaling both leaves the curve
     and the count and only changes the size. */
  function layout(){
    const p=PITCH(), R=RADIUS(), EDGE=1.45, half=p/2;
    const m=RIB[TURN], ax = m ? m.axis : "y";
    ORDER.length=0;
    for(let i=0;i<ROWS.length;i++){
      const r=ROWS[i], y=wrap(i*p-off), th=y/R;
      if(th>EDGE||th<-EDGE){
        if(r.style.visibility!=="hidden") r.style.visibility="hidden";
        r._a=0; r._v=0; continue;
      }
      if(r.style.visibility==="hidden") r.style.visibility="";
      ORDER.push({r, y});
      const c=Math.cos(th), a=r._a||0;
      r.style.transform="translate3d(0,"+(R*Math.sin(th)-half)+"px,"+(R*(c-1))+"px)"
                      + "rotateX("+((ax==="x"? a:0) - th)+"rad)"
                      + (ax==="y" && a ? "rotateY("+a+"rad)" : "");
      r.style.opacity = c>0?Math.pow(c,2.2):0;
      const on = y<half && y>-half;
      if(on !== r.classList.contains("on")) r.classList.toggle("on", on);
    }
  }

  function frame(now){
    const dt = lastT ? Math.min(3, (now-lastT)/16.667) : 1;
    lastT = now;
    if(caught && now-lastInput > 130){ caught=false; lastMag=0; }

    /* MOMENTUM THAT ACCUMULATES. A flick moves the string immediately, so it
       stays 1:1 under the hand, AND deposits speed it coasts on. A second
       flick the same way ADDS to that speed; the other way subtracts; a
       finger down kills it. Before, off moved 1:1 with the raw delta and vel
       was a smoothed AVERAGE -- so a second flick had nothing to add to. */
    if(input){
      if(caught){ input=0; }
      else{
        move(input);
        vel = vel*Math.pow(0.72,dt) + input*0.9;
        if(vel>VMAX) vel=VMAX; else if(vel<-VMAX) vel=-VMAX;
        input=0; snapping=false; driver="wheel";
      }
    }else if(!snapping && !drag && driver==="wheel" && (vel>0.4||vel<-0.4)){
      move(vel*dt*COAST);
    }

    const P=PITCH();
    /* WHEN THE TEXT DRIVES, the wheel is not steered -- it is TOWED. No
       gravity, no coasting, no snapping. Its speed for the ribbon is read
       back out of how far it moved, so the ribbon answers reading exactly as
       it answers turning. */
    if(driver==="text" && wantOff!==null){
      let d=wantOff-off;
      const sp=SPAN(); if(sp){ if(d>sp/2) d-=sp; else if(d<-sp/2) d+=sp; }
      off += d*(1-Math.pow(0.42,dt));
      if(sp) off=((off%sp)+sp)%sp;
      let mv=off-prevOff; if(sp){ if(mv>sp/2) mv-=sp; else if(mv<-sp/2) mv+=sp; }
      vel = mv/(dt||1); prevOff=off;
      layout();
      const st=Math.ceil(dt); for(let q=0;q<st;q++) physics(dt/st);
      layout();
      raf = (d>0.2||d<-0.2||restless||kick>0.01||kick<-0.01)
          ? requestAnimationFrame(frame) : null;
      return;
    }
    prevOff=off;

    if(snapping){                       /* a goto: a click, or an arrow key */
      const d=snapTo-off;
      off += d*(1-Math.pow(0.62,dt)); vel *= Math.pow(0.70,dt);
      if(d<0.4 && d>-0.4){ off=snapTo; vel=0; snapping=false; }
    }else{
      vel *= Math.pow(0.86,dt);
      /* GRAVITY, NOT A SNAP. The old centring waited four idle frames, chose
         a target and ran to it -- and every part of that is a ledge. A pull
         toward the nearest name is ALWAYS acting and its strength is simply
         how slow you are going: full at rest, nothing at speed. So a small
         scroll is centred from the first frame by the force already moving
         it, and cannot bump, because nothing switches on. */
      if(!drag && !caught && driver==="wheel"){
        const av = vel<0?-vel:vel;
        const s = av>=GRAV_V ? 0 : 1-av/GRAV_V;
        if(s>0){ const d=Math.round(off/P)*P - off;
                 off += d*(1-Math.pow(1-GRAV*s, dt)); }
      }
    }
    { const sp=SPAN(); if(sp && (off<0||off>=sp)) off=((off%sp)+sp)%sp; }

    layout();                              /* fills ORDER for the chain */
    const steps=Math.ceil(dt); for(let q=0;q<steps;q++) physics(dt/steps);
    layout();
    const dd = Math.round(off/P)*P - off;
    raf = (vel>0.02||vel<-0.02||snapping||restless||dd>0.25||dd<-0.25||
           kick>0.01||kick<-0.01) ? requestAnimationFrame(frame) : null;
  }
  function run(){ if(!raf){ lastT=0; raf=requestAnimationFrame(frame); } }

  /* WHICH NAME IS UNDER THE POINTER, BY MATHS. The bands are a full pitch
     tall but the barrel compresses them -- R*sin(theta) is less than the even
     step -- so once transformed they OVERLAP and the browser hands the click
     to whichever paints on top. Inverting the barrel is exact and depends on
     no hit area, stacking order or 3D sorting. */
  function slotAtY(clientY){
    const R=RADIUS(), axis=centre.getBoundingClientRect().top;
    let sn=(clientY-axis)/R;
    if(sn>1) sn=1; else if(sn<-1) sn=-1;
    return Math.round((off + Math.asin(sn)*R)/PITCH());
  }

  /* LETTING GO OF THE STOP WITHOUT MOVING THE HAND. A trackpad keeps sending
     wheel events for most of a second after the fingers lift, so "quiet for
     130ms" alone held the stop shut through the whole momentum tail. Momentum
     only DECAYS, so a delta that grows is a new push, not a tail. */
  /* VERTICAL IS THE COLUMN'S, HORIZONTAL IS NOT. A trackpad sends both axes
     in one event, and preventDefault()ing every wheel event made the Column a
     dead zone for any sideways gesture over it -- which matters the moment
     the Column sits inside something that scrolls left to right. So it takes
     the event only when the movement is mostly up-and-down, and lets a
     sideways one through to whatever is behind it. */
  const onWheel = e=>{
    const dy=Math.abs(e.deltaY), dx=Math.abs(e.deltaX);
    if(dx > dy) return;                       // sideways: not ours
    e.preventDefault();
    const m=dy;
    if(caught && m > lastMag*1.12 + 1.5) caught=false;
    lastMag=m; lastInput=performance.now();
    input+=e.deltaY; run();
  };
  const onDown = e=>{ drag={y:e.clientY, moved:0}; vel=0; driver="wheel";
                      el.setPointerCapture(e.pointerId); run(); };
  const onMove = e=>{
    if(!drag){ if(caught){ caught=false; lastMag=0; } return; }
    const d=drag.y-e.clientY; drag.y=e.clientY;
    drag.moved+=Math.abs(d); input+=d; lastInput=performance.now(); run();
  };
  const onUp = e=>{
    if(!drag) return;
    const tap=drag.moved<5; drag=null; caught=false;
    if(tap){ const k=slotAtY(e.clientY);
             snapTo=k*PITCH(); snapping=true; run(); onOpen(idx(k)); }
    run();
  };
  // KEYS IS OPT-OUT, NOT OPT-IN -- collection-page.html is the Column alone
  // on its page and every existing key it owns (Enter, S, all four arrows)
  // is exactly what a person on that page expects. A Column mounted INSIDE
  // something else that already owns left/right (shell.html's hx travel,
  // 3 Sep sixth pass) passes {keys:false} to give those two back -- Enter
  // and S still work either way, and the mouse/wheel/drag axis-partition
  // below was already built to nest (see the note above onWheel).
  const wantKeys = opts.keys!==false;
  const onKey = e=>{
    if(e.key==="Enter"){ e.preventDefault(); onOpen(idx(slot())); return; }
    if(e.key==="s"||e.key==="S"){ kick=90; run(); return; }
    if(!wantKeys) return;
    if(e.key==="ArrowDown"||e.key==="ArrowRight"){ e.preventDefault();
      snapTo=(slot()+1)*PITCH(); snapping=true; caught=false; run(); }
    else if(e.key==="ArrowUp"||e.key==="ArrowLeft"){ e.preventDefault();
      snapTo=(slot()-1)*PITCH(); snapping=true; caught=false; run(); }
  };
  const onResize = ()=>{ layout(); };

  el.addEventListener("wheel", onWheel, {passive:false});
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  addEventListener("keydown", onKey);
  addEventListener("resize", onResize);

  const esc = s => String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function setItems(items){
    stack.innerHTML=""; ROWS=[]; AT=-1;
    off=0; vel=0; input=0; snapping=false; caught=false; kick=0;
    driver="wheel"; wantOff=null;
    (items||[]).forEach((it,i)=>{
      const b=document.createElement("button");
      b.className="row"; b.dataset.i=i;
      b.innerHTML='<span class="rt">' + esc(it.t || "—")
        + (it.s ? '<span class="s">'+esc(it.s)+'</span>' : '') + '</span>';
      b._a=0; b._v=0;
      stack.appendChild(b); ROWS.push(b);
    });
    layout(); run();
  }
  function live(i){
    if(i===AT) return; AT=i;
    ROWS.forEach(r=>{ const on=+r.dataset.i===i;
      r.setAttribute("aria-current",on); r.classList.toggle("live",on); });
    onLive(i);
  }
  /* THE TEXT TOWS THE WHEEL. A fraction, not an index, because the wheel must
     sit BETWEEN two names exactly when the text sits between two chapters --
     that is what makes it glide instead of clicking over. */
  function follow(fraction){
    wantOff = fraction*PITCH(); driver="text";
    live(Math.round(fraction)); run();
  }
  function destroy(){
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    removeEventListener("keydown", onKey);
    removeEventListener("resize", onResize);
    if(raf) cancelAnimationFrame(raf);
    el.innerHTML="";
  }

  if(opts.items) setItems(opts.items);

  return {
    el, setItems, follow, live, destroy,
    goTo(i){ const n=N(); let step=i-idx(slot());
             if(step>n/2) step-=n; if(step<-n/2) step+=n;
             snapTo=(slot()+step)*PITCH(); snapping=true; caught=false; run(); },
    mode(name){ if(name in RIB){ TURN=name;
                  try{localStorage.setItem("turn",name);}catch(_){}
                  kick=48; run(); } return TURN; },
    amp(n){ if(n>=0&&n<AMPS.length){ AMP=n;
              try{localStorage.setItem("amp",n);}catch(_){}
              kick=48; run(); } return AMP; },
    shove(){ kick=90; run(); },
    modes: Object.keys(RIB), amps: AMPS.length
  };
}
window.Wheel = {mount};
})();
