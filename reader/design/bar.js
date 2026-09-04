/* THE BAR — Studio, as a strip in the title bar. See bar.css for why it is
   fixed-scale and why the fade is copied rather than designed.

   WHAT WAKES IT, all of it lifted from how the traffic lights behave in full
   screen: the cursor reaching the top edge, the window being touched at all
   after a rest, and any attempt to type into it. WHAT PUTS IT TO SLEEP: one
   thing only, and it is the point -- READING. Scrolling text is the signal.
   Turning the index is not, because turning the index is looking for
   something, and that is when a search bar should still be there. */
(function(){
  const TOP_EDGE = 64;          // how near the top the cursor must come
  const SLEEP_AFTER = 1400;     // ms of reading before it goes

  function mount(opts){
    opts = opts || {};
    const bar = document.createElement("div");
    /* the traffic lights are a macOS window's, so they are drawn only where
       there is a macOS window. On the phone it is the same bar without them:
       same strip, same fade, same rule about reading -- just no cluster to
       leave room for. */
    const phone = opts.mobile !== undefined ? opts.mobile
                : (matchMedia("(pointer: coarse)").matches || innerWidth < 700);
    bar.className = "bar" + (phone ? " mobile" : "");
    bar.innerHTML =
      '<div class="lights"><i class="c"></i><i class="m"></i><i class="z"></i></div>'
    + '<div class="field"><span class="look"></span>'
    + '<input type="text" spellcheck="false" placeholder="'
    + (opts.placeholder || "Search your library") + '"></div>';
    document.body.appendChild(bar);
    const input = bar.querySelector("input");

    let t=null;
    const wake = ()=>{ bar.classList.remove("asleep"); bar.classList.add("awake");
                       clearTimeout(t); };
    const sleepSoon = ()=>{ clearTimeout(t); t=setTimeout(()=>{
                       if(document.activeElement===input) return;
                       bar.classList.remove("awake"); bar.classList.add("asleep");
                     }, SLEEP_AFTER); };

    addEventListener("pointermove", e=>{ if(e.clientY < TOP_EDGE) wake(); }, {passive:true});
    addEventListener("keydown", e=>{
      if((e.metaKey||e.ctrlKey) && (e.key==="f"||e.key==="k")){
        e.preventDefault(); wake(); input.focus(); input.select();
      }
    });
    input.addEventListener("focus", wake);
    input.addEventListener("blur", sleepSoon);
    addEventListener("blur", ()=>bar.classList.add("blur"));
    addEventListener("focus", ()=>bar.classList.remove("blur"));

    /* reading is what puts it away -- nothing else does */
    if(opts.readingPane){
      opts.readingPane.addEventListener("scroll", ()=>{
        if(document.activeElement===input) return;
        wake();            /* it is seen going, the way the lights are */
        sleepSoon();
      }, {passive:true});
    }

    /* drop a book, or a voice. Both land here; which it is, is decided by
       what was dropped, never by which target was aimed at. */
    ["dragenter","dragover"].forEach(n=>addEventListener(n, e=>{
      e.preventDefault(); wake(); bar.classList.add("drop"); }));
    ["dragleave","drop"].forEach(n=>addEventListener(n, e=>{
      if(n==="drop") e.preventDefault(); bar.classList.remove("drop"); }));
    addEventListener("drop", e=>{
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(f && opts.onDrop) opts.onDrop(f);
    });

    return {bar, input, wake, sleepSoon};
  }
  window.Bar = {mount};
})();
