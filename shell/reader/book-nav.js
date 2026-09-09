/* ENGINE · the axis, the reader, the one-word view -- the thing that drives the rest
   · bench: word.html · mounted by: see MAP.md (generated -- `python3 map.py`) */
/* ========================= THE BOOK NAVIGATOR ==============================
   Tenth pass, 4 September, Osca's own words, fixing two real bugs the
   ninth pass's recording caught rather than changing the shape again:

     "the ONE word view, it scroll left to right to forward and backwards
     in the text IT SHOULD NOT, it should scroll up and down to move
     through the text, side to side to change the view / enter and exit
     that view."
     "when I move left, in the main reader page... I SHOULD not be
     scrolling to ANOTHER reader page, I should ONLY scroll into the
     collection-page LEFT PANE, should become MY left pane. Then when there
     are multiple contents pages, that is directories, with smaller items,
     I should see MULTIPLE collection-page LEFT PANES, as I scroll left."

   ONE WORD was still using the sixth pass's own axis (horizontal steps a
   word) without reconciling it against the two rules every pass since the
   eighth has actually meant: down is ALWAYS reading on, even here -- moving
   to the next word IS reading on, at the finest grain there is. Horizontal
   goes back to meaning only "enter/exit this view", same as everywhere
   else.

   CONTENTS was wrong in a bigger way: it was rendering a SECOND, separate
   continuous piece of the book's own real text (collection-page.html's
   full two-pane shape, ported whole) that covered the reader entirely --
   which looked like, and functionally WAS, "another reader page". What was
   actually wanted is only that page's LEFT PANE -- the Column, the
   directory -- as a real sidebar that slides in over the reader's own left
   edge while the reader stays exactly where it was, live, underneath.
   There is no second copy of the text any more; the sidebar just watches
   and drives the one reader that was already there. It was built as a
   STACK of such sidebars even then, though only ever one long, because
   nested contents -- an anthology's own contents inside a play's own
   contents -- was still the one piece of real future work every pass kept
   correctly declining to start early. That work is this pass (see below).

   Eleventh pass, 4 September, same day, Osca's own words watching the
   tenth pass actually run:

     "scrolling left, SHOULD bring up the contents, BUT further INTO the
     page - ESSENTIALLY, I should be able to bring it out, and it make MY
     working page, RIGHT PANE, slightly smaller, like that goes over -
     currently the contents the (page asset) - is too far to the left of
     the screen."
     "The single word thing now works - scrolling the right way, but it
     has an artifact behind it"

   CONTENTS was still only an overlay -- floating at the viewport's own
   left edge, on top of a reader that never responded to it, which is
   exactly what read as "too far to the left": nothing about the reader
   acknowledged the sidebar was there, so there was a dead gap between
   them rather than one page really making room for the other. Fixed by
   pushing, not just covering: the reader's own left edge now moves over
   by exactly the sidebar's own width times how open it is (read straight
   off the sidebar's real rendered width, so this never has to know it
   itself) -- "make MY working page, right pane, slightly smaller". Because
   the sidebar's own reveal-transform already lands its visible right edge
   at that exact same offset, the two stay snug against each other,
   properly one page, at every point of the slide -- "I should be able to
   bring it out" -- rather than a panel dropped on top of a page that
   never moved.

   ONE WORD's own axis was already right; what was left behind was
   page.css's own `.runhead`/`.scrub` -- the reader's persistent running
   head and scrub bar, "you should always be able to see which book you
   are in" by that file's OWN design, `position:fixed` at a higher
   z-index than one word's own box, never told by any of this file's
   depth logic that one word is a different, more immersive kind of
   screen. Hidden now for exactly that one level, restored for both
   reader and contents where the reader is still genuinely what is on
   screen.

   Twelfth pass, 4 September, same day again, from real screenshots this
   time (a screen recording isn't something this build's own tools can
   open, only stills) -- Osca's own words:

     "you see the WHITE 'A minor collection' page - that page, get rid of
     it - THAT page SHOULD be the purple one, right? The purple one is
     essentially the cover / titular page, you've added another one to it,
     which is making the book worse (the UI worse)."
     "Then look at how I can't see multiple things in a page - like it IS
     not ONE PANE, the whole - all these views, essentially should be one
     PAGE, ONE scroll, fluid from side to side. They shouldn't be so far
     apart."
     "ALSO as you can see, the one word view still has this artifact
     inside it, of a PAGE asset, the collection-page left pane asset. It
     shouldn't be there, that's the smallest view, furthest from
     contents."

   THE TITLE SCREEN WAS REMOVED that pass -- it was genuinely redundant,
   not merely unwanted: page.js already renders chapter zero as a
   full-screen tinted `.opener` slide (book title, author, the book's own
   palette colour) -- that IS the cover, and always was, "the purple one".
   A book opens straight onto the reader, at dx=0, scrolled to the very
   top, ever since. dx was also given its own scroll-snap that pass, so it
   can never rest stranded part-way between two levels again.

   Thirteenth pass, 4 September, same day again, watched LIVE this time --
   Claude in Chrome, driving the actual page over a local server, the
   first time any of this had been seen running rather than reasoned about
   from stills. Two things confirmed working (the white title screen is
   gone; one word opens clean, no stray artifact behind it), one real bug
   found live that no still had ever shown (book-nav's own `.hint`, top
   right, sits directly on top of page.css's own `.runhead`, also top
   right -- fixed in shell.css, not here: `.hint` moves to the bottom
   right, `.runhead` keeps the corner it already had everywhere else in
   this app). Then Osca's own words, the biggest single ask of any pass so
   far:

     "So essentially, The left most PANE, will not be A PAGE asset - it
     will look like LIBRARY in the app, ALMOST, it will be 4 books left to
     right, and maybe 2-3 down, per whole screen, and you just scroll down
     and select a book. It will not be a collect-page left pane page asset
     (contents), it will be as I say, more like a dashboard."
     "Once you're in the book, you can scroll left, to get to contents and
     continue scrolling left to get back to dashboard - it will not be a
     page asset. HOWEVER, when you scroll left, you will se contents, SOME
     BOOKS WILL have multiple contents directories, working like branches,
     so THEN, you will scroll left to right, through these collection-page
     left-pane page assets (contents), up the branch, by scrolling left.
     Say you are in act 2 scene 2 of hamlet, scroll left, you will see the
     scenes of that play (whole ACT) in a collection-page asset (left-pane),
     then continue scrolling left, you will see ALL the ACTS, then continue
     scrolling you will see ALL THE PLAYS, THEN, continue and you will see
     the MAIN contents of the book - understand? THIS UI bit, doesn't have
     to know all that, but it NEEDS to be able to express the parsed book
     structure, if it is large, succinctly, naturally and visually. -- TO
     be sure, MULTIPLE, collection PANES, should be visible at once, if you
     keep scrolling left, in a large book, should have about max three in
     a screen) AND the collection panes just scroll up and down."

   TWO SEPARATE THINGS, both built this pass:

   (a) THE DASHBOARD -- was a Wheel, the same barrel-column component the
   contents sidebar and one word both use, because it was the only Column
   this file had. That was exactly the confusion: "it will NOT be a
   collect-page left pane page asset" -- a book, opened, and the shelf of
   ALL books were reading as the same kind of object. The dashboard is now
   its own thing, a real CSS grid of cards, several per row, scrolling only
   vertically -- nothing here turns or rides a barrel; a book is picked by
   looking at a small shelf of covers, not by dialling through a list one
   name at a time. Wheel is still exactly what every CONTENTS pane is, at
   every depth -- that distinction (dashboard vs. contents) is the one this
   pass draws in code, not merely in this file's own head.

   (b) THE CONTENTS STACK -- was hard-coded to exactly one pane, "today
   only ever one long" as the tenth pass's own comment put it, naming the
   very thing this pass builds. bookshape.py now bakes `structure` (the
   parser's own `Book.structure`, hierarchy.py's tree of work/act/scene/
   part/etc. over the flat chapter list -- see that file's own long
   comment) into every book-data.js that has one; book.js passes it
   through unpruned. What follows here is generic on purpose, exactly as
   asked -- "THIS UI bit, doesn't have to know all that": nothing below
   knows what an act or a scene IS, only that a chapter belongs to some
   node, that node has siblings, and those siblings' own parent has
   siblings too, all the way up. Scrolling left keeps revealing the next
   level UP the tree from wherever the reader currently sits -- Hamlet's
   own act 2 scene 2 example is exactly this: scene's siblings (the other
   scenes in that act), then act's siblings (the other acts in that play),
   then play's siblings (the other plays in the book) -- capped at three
   panes on screen at once, "about max three in a screen", because a
   fourth would stop being succinct. A book with no `structure` at all
   (still most of this library) gets exactly the one flat pane every pass
   before this one already gave it -- this is additive, not a rewrite of
   the ordinary case, the same promise the tenth pass's own comment made
   before there was any code to keep it.

   THE MECHANICS, so the shape doesn't have to be re-derived from the code
   later: `dx` no longer clamps to a fixed [-1,1] -- its left edge is now
   -(however many levels the CURRENT chapter's own trail actually has, up
   to three), read fresh every time the reader moves. Each pane opens in
   its own full unit of dx, innermost (closest to the reader) first,
   exactly the way the ONE pane always has; a new, farther-out pane only
   ever starts sliding in once the one before it has finished, which falls
   straight out of the same clamped-fraction arithmetic rather than being
   asserted separately. Every already-open pane gets pushed further right
   by exactly the new pane's own width, the same real "make MY working
   page, right pane, slightly smaller" push the eleventh pass gave the
   reader, just applied once per pane instead of once total -- so the
   whole stack, reader included, always stays snug, at every depth, never
   gapped. Levels are computed off the chapter the reader is ACTUALLY
   showing (not off dx), the same live-follow the one pane always did, so
   turning a page while contents happens to be open can change which
   scenes level one shows without anyone having touched dx at all -- "up
   the branch, by scrolling left" describes the branch as SEEN, and the
   branch the reader is inside changes as the reader does.

   Flagged, same honesty as every pass: this thirteenth pass's own new
   work (the grid, the stack) is reasoned from the code and checked
   headlessly, exactly like the ones before the live session started
   today -- there has not yet been time in this same pass to drive THIS
   code live the way the fixes above were. The next pass should.

   Fourteenth pass, continued, same day -- three fixes (word-wheel spillage,
   the dx scroll-snap's own firmness, the contents/collpane widths matched to
   collection-page.html's own scale) landed and are written up in UI-PLAN.md
   rather than here; none of them touched this file's own mechanic.

   Fifteenth pass, 4 September, watching real Safari, a real trackpad, not
   the synthetic scroll this file's own test harness (and every live check
   before this pass) had exclusively used -- Osca's own words:

     "turning the reader, whilst contents page is out, is NOT, turning the
     contents page - it should, as it does in collection-page."
     "Something is really not working with the contents, and the scroll
     generally between the panes, it keeps snapping at the wrong times...
     Right now, contents still pulls out like that, that's the max, then
     straight to library, it's not right. Doesn't pull out fully."
     "It's also very jittery, like you begin scrolling, and it cuts to
     somewhere else, rather than smoothly starting from where you are, it
     jumps"
     "get rid of all the stuff around [ONE WORD] - that right scroll, for
     the one word view, I want it to zoom into the word it's on ON the
     page, that's the animation."

   THE TURNING BUG WAS REAL AND SPECIFIC: collection-page.html's own track()
   calls wheel.follow(i+f) on every scroll of the reading pane -- a
   fraction, because "the wheel must sit BETWEEN two names exactly when the
   text sits between two chapters" (wheel.js's own comment on follow()).
   This file's own syncContentsLive() was calling wheel.live(liveIdx)
   instead -- an integer that only marks which row is current, and never
   moves the barrel at all (confirmed reading wheel.js itself: live() never
   touches `off`, only follow() does, via `driver="text"`). Turning the
   reader was genuinely never turning the pane; it could only ever SNAP the
   marked row the instant a chapter boundary was crossed. continuousReaderPos()
   is currentReaderChapter()'s own anchor line turned into the same kind of
   fraction collection-page.html's track() already computes; itemFraction()
   carries that fraction through a level whose own items each span a RANGE
   of chapters, not one apiece, which collection-page.html's own flat piece
   never had to do. ensurePane() now calls .follow() with it, at every open
   level, every frame -- the flat-book case degenerates to exactly
   collection-page.html's own mechanic, ported rather than reinvented.

   THE JITTER AND THE WRONG-TIME SNAPPING WERE THE SAME BUG, and it only
   ever showed on a real trackpad because this file's own test harness (and
   every live check before this pass, all through the Chrome extension's
   synthetic scroll) fires a short burst of wheel events and then stops
   completely -- nothing like how Safari's own momentum scrolling actually
   arrives, which is many small events trailing off over the better part of
   a second, often with real gaps between them. stepDx()'s own rest-easing
   branch fired the instant dxVel decayed under DX_REST with no dxInput
   that frame -- which T.decay's own fast falloff can reach inside a single
   one of those real gaps, mid-gesture, and once it did, T.snap (raised to
   0.32 earlier this same day) hauled the pane visibly toward whichever
   target was nearest RIGHT THEN -- not where the gesture was actually
   headed. The next real event in the same momentum tail then resumed from
   THAT position, not from where the pane had been a frame before -- "you
   begin scrolling and it cuts to somewhere else... it jumps", and, because
   which target counted as "nearest" could flip mid-gesture, "keeps
   snapping at the wrong times". Synthetic scroll never has a gap that
   size inside one push, so nothing before this pass had ever seen it.
   Fixed with a real idle gate: dxIdle only accumulates while genuinely
   neither driven nor coasting, in the same dt-units the whole file's
   physics already run in (so it needs no wall clock and no change to the
   test harness's own simulated one), and the rest-easing branch does
   nothing at all until dxIdle clears T.grace -- long enough to bridge
   a real momentum tail's own gaps, short enough that a genuine stop still
   settles quickly. "Doesn't pull out fully" reads as the same bug from the
   other side: a long momentum tail could keep dxInput technically nonzero
   for the better part of a second, which is long enough that the pane
   never reached the rest-easing branch AT ALL before the tail finally
   died out wherever it happened to -- not because the width or the
   position was ever wrong (both were already re-measured and confirmed
   against collection-page.html's own numbers earlier this same day), but
   because dx itself had never actually finished travelling to -1.

   ONE WORD LOST ITS OWN SCREEN. It used to be a real full-screen panel --
   a big isolated word, a counter, a second word-wheel -- sliding in from
   the right exactly the way contents slides in from the left, which reads
   as "another page" the moment you actually watch it happen, the same
   complaint the tenth pass already settled for contents and never
   revisited here. There is no second page any more: wordDomIndex walks
   the same word order wordsOf() already builds and lands each one on a
   real Range inside the READER'S OWN rendered chapter (page.js gives every
   non-speaker, non-direction block exactly one <p class="line"> with
   exactly one text-node child, so a word's own character offset is all a
   Range needs -- nothing rewritten, no word individually wrapped).
   updateWordZoom() grows o.readerCol itself -- a css `zoom`, a LAYOUT zoom
   the browser lays out rather than a layer it rasters (writePageZoom; the
   scale()/transform-origin this paragraph described until 8 September was
   retired on the 6th, and WHY is written at writeReaderTransform: at
   scale(16) WebKit never re-rasters and the one word you are reading is
   pixelated). It is driven straight off wordF (0 at the reader, 1 fully
   zoomed) every frame the zoom is live, and the word is held still by
   measurement, not by an origin -- one rect a frame, the gap closed on the
   column's own `left` and on the scroller. Since 8 September the axis above
   0 is the PINCH's alone: a sideways push cannot enter it (axisPush). The zoom
   itself now starts the instant dx leaves 0 (not only once lvl flips to
   "word" at the 0.5 boundary further in) so the early part of a rightward
   push already has something real to aim at rather than nothing happening
   until the boundary is crossed. A CSS Custom Highlight (feature-detected,
   never assumed) marks the exact word without touching the paragraph's own
   text node -- where a browser lacks it, the zoom still lands on the right
   word, only the tint is missing.

     BookNav.mount({
       dashboardEl, libraryColEl, books, onOpenBook,
       bookEl, contentsBox, contentsColEl, leftMoreEl,
       readerBox, readerPane, readerCol, readerScrub, readerFill, readerHead,
       big, small,
     }) -> handle: openBook(book) · closeToLibrary() · dx · screen · maxLeft */
(function(){

const esc = s => String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

const DX_REST=0.0001;
let OUT_SNAP=6;          // how hard that switch throws, either way -- a
                         // DURATION since 8 Sep (see THE SWITCH IS A TRAVEL,
                         // by stepDx): higher = shorter. 9 was the old
                         // fraction's number and lands on 50ms, which is a cut
                         // with one frame in the middle of it.
const WORD_COMMIT=0.5;   // past here on release, it commits to the word
/* SPREAD_FROM is GONE (8 Sep). It said "the zoom is done by here; only then do
   words part" and NOTHING in this file read it -- the rule it names is spelled
   by the axis itself (`spreadF = clamp(dx - 1, 0, 1)` in applyDx) and by the
   second lock in updateWordZoom. A constant that states a rule it does not
   enforce is the older half of a reversed rule still written down, so it goes
   in the commit that finds it (CLAUDE.md, "Precedence"). Its trailing comment
   belonged to OUT_SNAP two lines up and had drifted off it. */

/* ---- HOW FAST THE WHOLE THING MOVES -------------------------------------
   Osca: "WE need to reduce the animations now, it's too slow, can't move
   about." / "I need you to give me options, so I can see what's fastest."

   So these are not baked in any more -- they are four presets, switchable
   live from the bench, no reload, and the choice is remembered. Every one of
   them is a real handle on the same feel:

     gain   how much dx one pixel of trackpad buys. THE big one for "I have
            to scroll so far" -- at 0.0011 a level costs ~900px of swipe.
     vmax   ceiling on dx per dt, i.e. the top speed of a throw.
     coast  how much of that velocity is actually spent per frame.
     decay  how fast a throw dies. Lower = less drift after your fingers stop.
     snap   fraction of the remaining distance closed per frame once at rest.
     grace  dt-units of genuine idle before the snap may fire at all -- the
            fifteenth pass added it to stop the snap firing inside a real
            trackpad's own momentum-tail gaps. Shorter = less dead time
            before it settles, but too short and the tail-gap bug returns.
     anim   the CSS side (the dashboard's own fade), kept in step.

   Defaults stay at "as-is" deliberately, so the headless suite keeps
   measuring the behaviour it was written against. Once you pick one, it
   becomes the default and the suite moves with it.                        */
const SPEEDS = {
  "as-is":   { gain:0.0011, vmax:0.09, coast:0.55, decay:0.86, couple:0.90, snap:0.576, grace:8, anim:"0.35s" },
  "quick":   { gain:0.0020, vmax:0.16, coast:0.70, decay:0.84, couple:0.90, snap:0.81, grace:5, anim:"0.20s" },
  "quicker": { gain:0.0032, vmax:0.26, coast:0.85, decay:0.80, couple:1.00, snap:1, grace:3, anim:"0.12s" },
  "instant": { gain:0.0050, vmax:0.45, coast:1.00, decay:0.74, couple:1.00, snap:1, grace:2, anim:"0.06s" },
};
let speedName = "as-is";
let T = SPEEDS[speedName];
/* The two snap numbers are reachable on their own, because "snap controls"
   is a different question from "which preset". Overriding copies the preset
   first, so the presets themselves stay exactly as documented. */
function setSnap(k, v){
  if(k !== "snap" && k !== "grace") return null;
  T = Object.assign({}, T); T[k] = v;
  try{ localStorage.setItem("ttstv_snap", JSON.stringify({snap:T.snap, grace:T.grace})); }catch(_){}
  return T[k];
}
function setSpeed(name){
  if(!SPEEDS[name]) return speedName;
  speedName = name; T = Object.assign({}, SPEEDS[name]);
  try{ const sv = JSON.parse(localStorage.getItem("ttstv_snap")||"null");
       if(sv){ if(typeof sv.snap==="number") T.snap=sv.snap;
               if(typeof sv.grace==="number") T.grace=sv.grace; } }catch(_){}
  try{ localStorage.setItem("ttstv_speed", name); }catch(_){}
  try{ if(document.documentElement) document.documentElement.style.setProperty("--anim", T.anim); }catch(_){}
  return speedName;
}
try{
  const saved = localStorage.getItem("ttstv_speed");
  if(saved && SPEEDS[saved]) setSpeed(saved);
}catch(_){}

const WORD_PX=42;        // px of accumulated VERTICAL delta per word now, not horizontal
const EXIT_PUSH=320;     // a deliberate push, not one wheel tick
const MAX_LEFT_LEVELS=5; // How far UP THE BRANCH you can travel -- NOT how many panes fit on a
                          // screen. Those two got conflated at 3 ("about max three in a screen",
                          // Osca's own words, thirteenth pass), and on a book whose trail runs
                          // deeper than three that silently truncated the trail itself: the top of
                          // the tree was never built, so scrolling left could never reach it and a
                          // push at the deepest built pane dropped you at the library instead.
                          // The complete Shakespeare is exactly that book -- group > play > act >
                          // scene is FOUR -- so from a scene you could reach scenes, acts and
                          // plays, and never "THE SONNETS / Plays / Poems" above them. Osca's own
                          // words, looking straight at it: "if I scroll back from there, I NEED to
                          // get back to the original SONNETS/POEMS/PLAYS - I cannot get back there
                          // right now." Five is a ceiling against a pathological tree, not a view
                          // budget; the widths in shell.css are what keep them all on the screen.
// a structure node's own title ("SCENE I. Rossillon...") splits the same
// way a chapter's does (book.js's own NUMBERED) -- this copy is only a
// fallback for wherever window.Book isn't loaded (this file's own tests).
const NUMBERED_FALLBACK = /^\s*((?:[IVXLCDM]+|\d+)\s*[.)])\s*(.*)$/i;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function splitTitleNode(title){
  const re = (window.Book && window.Book.NUMBERED) || NUMBERED_FALLBACK;
  const m=(title||"").match(re);
  if(m) return {n:m[1].trim(), t:m[2].trim()};
  return {n:"", t:title||""};
}

function mount(o){
  // ---------------------------------------------------------------- THE
  // DASHBOARD -- thirteenth pass: a real grid of cards, not a Column. "it
  // will NOT be a collect-page left pane page asset... more like a
  // dashboard" -- several books per row, scrolling only up and down, never
  // turning. libraryCards maps slug -> its own card, so the currently open
  // book can stay marked when the person is back looking at the shelf.
  const libraryCards = new Map();
  function buildDashboardGrid(){
    if(!o.libraryColEl || !o.books) return;
    o.libraryColEl.innerHTML = "";
    o.libraryColEl.classList.add("libgrid");
    libraryCards.clear();
    o.books.forEach(b=>{
      const card=document.createElement("button");
      card.type="button";
      card.classList.add("libcard");
      if(b.unavailable) card.classList.add("unavailable");
      card.disabled=!!b.unavailable;
      card.innerHTML='<b>'+esc(b.title||b.slug)+'</b>'
        +'<span>'+esc(b.unavailable?"not built yet":(b.author||""))+'</span>';
      card.onclick=()=>{
        if(!o.onOpenBook) return;
        Promise.resolve(o.onOpenBook(b.slug)).then(nb=>{ if(nb) openBook(nb); });
      };
      o.libraryColEl.appendChild(card);
      libraryCards.set(b.slug, card);
    });
  }
  function markLiveCard(slug){
    libraryCards.forEach((card,s)=>card.classList.toggle("live", s===slug));
  }
  buildDashboardGrid();

  // ---------------------------------------------------------------- BOOK
  // STATE
  let book=null, screen="dashboard";
  let dx=0, dxVel=0, dxInput=0, wordWasOn=false;
  // THE PINCH'S OWN THREE FLAGS, beside the axis they drive. `pinching` is a
  // gesture on the glass right now; `pinchHold` is the page left standing
  // zoomed inside the band, which is the one thing on this axis that rests
  // between two positions; `pinchEntering` is the one sentence enterWord needs
  // to hear -- do not travel to the cursor, the fingers are already on it.
  let pinching=false, pinchHold=false, pinchEntering=false;
  // the factor the page stood at when the gesture began. Every engine reports
  // a pinch as a RATIO against its own start, so this is what that ratio is a
  // ratio OF, and it is read once, before anything moves.
  let pinchFrom=1;
  // where the zoom left the page sideways -- the pan's own nought point.
  let panBase=0;
  let exitAccum=0;
  let chIndexById=new Map();

  // -------- THE LEFT STACK -- a book's own structure, walked generically.
  // levelsCache[0] is always the pane closest to the reader (today, for
  // every book without `structure`, the only one there will ever be: the
  // book's own flat chapter list -- exactly what the one contents pane
  // has always shown). A book WITH `structure` gets one level per step up
  // the tree from wherever the reader currently is, capped at
  // MAX_LEFT_LEVELS. Recomputed off the chapter the reader is actually
  // showing, in syncContentsLive below -- never off dx.
  let levelsCache=[{key:"flat:", liveIdx:-1, items:[]}];
  // THE STACK DOES NOT COLLAPSE UNDER YOU. Osca: "if for example I select
  // poems, whilst i'm In a scene of a play, It JITTERS and then comes out with
  // the first poem... getting rid of the main contents. I don't want it to
  // move about like that. It should keep the main one open, show the poems
  // contents, and reader on the side."
  //
  // A play stands four deep (Plays > play > act > scene); Poems stands two.
  // Selecting Poems therefore halved the number of panes, dx was clamped in
  // to match, and the whole stack -- reader included -- slid across. Nothing
  // about that was a decision the reader made. So the DEPTH you had open is
  // held: the branch you chose fills as many panes as it has, and the rest
  // stand empty rather than closing, exactly as a column view leaves an empty
  // column. Reading again (or coming back to the reader) releases it.
  let heldDepth = 0;
  function currentMaxLeft(){
    const have = Math.max(levelsCache.length, heldDepth);
    return Math.max(1, Math.min(have, MAX_LEFT_LEVELS));
  }

  // How DEEP a node's own branch still runs below it. Only branches that
  // actually reach a surviving chapter count -- a node whose whole subtree
  // was dropped is not depth, it is nothing.
  function depthBelow(node){
    const kids = (node.children||[]).filter(c=>firstChapterIdx(c)!=null);
    if(!kids.length) return 0;
    let best = 0;
    for(const c of kids){ const d = depthBelow(c); if(d>best) best = d; }
    return best + 1;
  }
  // Where selecting a directory row should actually put the reader. Osca's
  // own words: "when I press play - it should OPEN the ENTIRE directory from
  // PLAYS - FIRST PLAY - FIRST ACT - FIRST SCENE then reader is in the side.
  // I shouldn't be SHOVED into a full sized reader straight away."
  //
  // firstChapterIdx() answers a different question -- the first chapter in
  // DOCUMENT order -- and for a play that is its "Dramatis Personæ", which
  // hangs straight off the play with no act or scene under it. Landing there
  // makes the trail from the reader's new position SHALLOWER than the stack
  // currently standing open, so dx has nowhere to rest and eases inward by a
  // pane: the shove, and the panes rebuilding under it, the buzz. Following
  // the branch that stays deepest instead lands on the first scene of the
  // first act, keeps every pane that was open open, and leaves the reader
  // exactly where it was -- at the side, showing where you now are.
  function landingChapter(node){
    let n = node;
    for(let guard=0; guard<32; guard++){
      const kids = (n.children||[]).filter(c=>firstChapterIdx(c)!=null);
      if(!kids.length) break;
      let best = kids[0], bestD = depthBelow(kids[0]);
      for(let i=1;i<kids.length;i++){          // document order breaks ties
        const d = depthBelow(kids[i]);
        if(d > bestD){ bestD = d; best = kids[i]; }
      }
      n = best;
    }
    return firstChapterIdx(n);
  }
  function firstChapterIdx(node){
    if(node.chapters && node.chapters.length){
      for(const cid of node.chapters){ const idx=chIndexById.get(cid); if(idx!=null) return idx; }
    }
    if(node.children && node.children.length){
      for(const c of node.children){ const r=firstChapterIdx(c); if(r!=null) return r; }
    }
    return null;
  }
  function findOwnerPath(nodes, chapterId, trail){
    for(const n of (nodes||[])){
      if(n.chapters && n.chapters.indexOf(chapterId)!==-1) return trail.concat([n]);
      if(n.children && n.children.length){
        const r=findOwnerPath(n.children, chapterId, trail.concat([n]));
        if(r) return r;
      }
    }
    return null;
  }
  /* THE PANES ARE A DIRECTORY, NOT A READOUT. Osca: "start in sonnets, with
     shakespeare, scroll left, see plays, click on plays -- immediately I come
     to the not the PLAY category contents, but a random play, all the way in
     a scene... It's like a file directory."

     It wasn't one. Every level was derived from WHERE THE READER IS, so a
     click had no way to change the panes except by moving the reader first
     and letting them fall out of its new position -- which is why clicking
     "Plays" landed you inside some particular scene, and why which play you
     got felt arbitrary (it was whichever branch ran deepest, not the first).

     So there are two sources of truth now. focusPath, when set, is what the
     panes show -- the directory you have navigated to by clicking. When it is
     null the panes follow the reader, exactly as before. Scrolling the reader
     clears it, so reading always takes the panes back; clicking sets it, and
     nothing about the reader decides what the panes show while it stands. */
  let levelsPath = null;
  function levelsFromPath(path){
    const levels=[];
    for(let i=0;i<path.length && levels.length<MAX_LEFT_LEVELS;i++){
      const node=path[path.length-1-i];
      const parent=path[path.length-2-i];
      const siblings = parent ? (parent.children||[]) : (book.structure||[]);
      const items=[];
      siblings.forEach(n=>{
        const fc=firstChapterIdx(n);
        if(fc==null) return;                     // nothing this node reaches survived
        const sp=splitTitleNode(n.title);
        items.push({n:sp.n, t:sp.t, chapterIdx:fc, nodeId:n.id, node:n});
      });
      levels.push({
        key: siblings.map(n=>n.id).join("|"),
        liveIdx: items.findIndex(it=>it.nodeId===node.id),
        items,
        /* WHAT THIS PANE IS A LIST OF -- the thing whose children these are.
           bench-panes.html gives every pane a head ("scenes", "acts", "plays")
           and the shell's had none, which is the whole of the difference
           between the two. The book's own words are better than a category:
           the scenes of ALL'S WELL are headed ALL'S WELL. */
        head: parent ? splitTitleNode(parent.title).t : (book && book.title) || "",
      });
    }
    levelsPath = path;
    return levels;
  }
  // A book WITH structure has one or two chapters the structure does not
  // own -- a title page, a colophon, whatever the parser left outside the
  // tree. Falling through to the flat list for those collapsed the entire
  // stack to one pane and threw the reader back to full width for as long as
  // the reading line was on one, which is a whole-screen lurch caused by
  // nothing the reader did. On a structured book the trail simply stands
  // still until the text is back under something the structure knows.
  let lastGoodLevels = null, lastGoodPath = null;
  function computeLevels(chIdx){
    const ch = book && book.chapters && book.chapters[chIdx];
    const path = ch ? findOwnerPath(book.structure||[], ch.id, []) : null;
    if((!path || !path.length) && book && (book.structure||[]).length && lastGoodLevels){
      levelsPath = lastGoodPath;      // the trail these levels were built from
      return lastGoodLevels;
    }
    if(!path || !path.length){
      // flat: no structure reaches this chapter (most books, still) -- one
      // pane, the book's own chapter list, exactly as every pass before
      // this one already gave it.
      levelsPath = null;
      return [{
        key:"flat:"+(book?book.slug:""),
        liveIdx: chIdx,
        items:(book?book.chapters:[]).map((c,i)=>({n:c.n, t:c.t, chapterIdx:i})),
        head:(book && book.title) || "",
      }];
    }
    const lv = levelsFromPath(path);
    lastGoodLevels = lv; lastGoodPath = path;
    return lv;
  }
  /* Opening a directory row goes to ITS OWN BEGINNING: its first child, then
     that child's first child, all the way down. Not the deepest branch, which
     is what "a random play" was -- the first, every time, which is what
     "the beginning of that play" means. */
  // WHAT OPENING A ROW OPENS. Osca: "when I press play - it should OPEN the
  // ENTIRE directory from PLAYS - FIRST PLAY - FIRST ACT - FIRST SCENE".
  //
  // Plain "first child" does not give that on the real Shakespeare: a play's
  // first child in document order is its Dramatis Personae, which owns one
  // chapter and has nothing under it, so the chain stops dead there and the
  // stack you had open collapses by a pane -- everything slides, which is
  // being pushed about for no reason. So at each step take the first child
  // that is itself a directory, and only fall back to the first child of any
  // kind when none of them is. Plays -> first play -> first ACT -> first
  // SCENE, which is what he asked for, and the depth stands still.
  function firstChainFrom(node){
    const chain=[]; let n=node;
    for(let guard=0; guard<32; guard++){
      const kids = (n.children||[]).filter(c=>firstChapterIdx(c)!=null);
      if(!kids.length) break;
      const kid = kids.find(c=>(c.children||[]).some(g=>firstChapterIdx(g)!=null)) || kids[0];
      chain.push(kid); n = kid;
    }
    return chain;
  }

  // -------- EACH PANE -- lvl 0 reuses shell.html's own static contentsBox/
  // contentsColEl (same elements every pass since the tenth has used, same
  // CSS), because that pane is not new. Levels 1 and 2 are created lazily,
  // appended to o.leftMoreEl, only the first time a book's own trail
  // actually reaches that deep -- most books never will. onOpen jumps the
  // ONE reader straight to that item's chapter; there is still only ever
  // one reader, at every depth, same as the tenth pass's own argument for
  // why contents is a pane and not a second page.
  let focusPath = null;          // the directory you clicked to, or null = follow the reader
  // A jump of our own fires MORE than one scroll event (the set itself, then
  // the browser settling), so a single boolean was eaten by the first and the
  // next one cleared the directory the click had just set -- the panes fell
  // back to following the reader and you were "taken somewhere else".
  // Keyed on WHERE rather than when: a scroll that lands where we put it is
  // ours, however many events it takes; anything else is you, and hands the
  // panes back immediately. No clock, so nothing to tune and nothing to race.
  let programmaticTop = null;
  // bumped by every real input; scrollReaderTo's settle uses it to know when
  // to get out of the way.
  let inputTick = 0;
  let detent = false;        // stopped at the page, coming out of one word
  let lastDeepLeft = 0;      // when ArrowLeft last arrived at the deepest pane
  let curChapterIdx=0;
  // applyDx() runs on every single frame forever, whether or not anything
  // has moved. Everything it writes is a function of dx, the open levels and
  // the reader's own chapter -- so when none of those has changed there is
  // nothing to write, and the whole body can be skipped. markPaint() is how
  // the event-driven things (a scroll, a resize, a new book, a new word) say
  // that something did.
  let lastPaintDx=null, needsPaint=true;
  function markPaint(){ needsPaint=true; }
  let leftPanes=new Array(MAX_LEFT_LEVELS).fill(null);
  let paneWidthsStale=true;
  addEventListener("resize", ()=>{ paneWidthsStale=true; readerFloor=0; invalidateSections(); applyOffscreenSkip(); markPaint(); });
  function makePaneEl(i){
    if(i===0) return {el:o.contentsBox, col:o.contentsColEl};
    const wrap=document.createElement("div");
    wrap.classList.add("cpane","collpane","lvl"+i);
    const col=document.createElement("div");
    wrap.appendChild(col);
    if(o.leftMoreEl) o.leftMoreEl.appendChild(wrap);
    return {el:wrap, col};
  }
  /* THE PANE'S OWN HEAD. pane.css styles .cpane > .panehead; bench-panes.html
     writes one into every pane it builds, and this is the shell doing the
     same, so a pane is the same object on both pages. The element is made once
     and kept on the pane's own record -- no querying, and nothing to go stale.
     (It is absolutely positioned, so where it sits among the pane's children
     does not matter.) */
  function setPaneHead(rec, text){
    if(!rec || !rec.el) return;
    if(!rec.head){
      const h = document.createElement("div");
      h.classList.add("panehead");
      rec.el.appendChild(h);
      rec.head = h;
    }
    const t = String(text || "");
    if(rec.head.textContent !== t) rec.head.textContent = t;
  }
  function ensurePane(i, level, pos, sync){
    if(!level) return null;
    let p=leftPanes[i];
    let fresh=false;
    if(!p){ const made=makePaneEl(i); p=leftPanes[i]={el:made.el, col:made.col, wheel:null, key:null}; }
    if(p.el && p.el.classList) p.el.classList.remove("empty");
    setPaneHead(p, level.head);
    if(p.key!==level.key && p.col && window.Wheel){
      if(p.wheel) p.wheel.destroy();
      fresh=true;
      p.wheel=window.Wheel.mount({
        el:p.col,
        items: level.items.map(it=>({ t: it.t||it.n||"—", s:(it.n&&it.t)?it.n:"" })),
        onOpen: k=>{
          const it=level.items[k];
          if(!it) return;
          if(!it.node || !levelsPath){          // a flat chapter list: it IS the answer
            if(it.chapterIdx!=null) scrollReaderTo(it.chapterIdx);
            return;
          }
          // Everything ABOVE this row stays exactly as it is; this row becomes
          // the selection; everything BELOW it is that row's own beginning.
          // The panes are rebuilt from that, and the reader is sent to the
          // leaf -- which is the beginning of what you clicked, not a scene
          // somewhere inside it.
          const above = levelsPath.slice(0, Math.max(0, levelsPath.length-1-i));
          const chain = firstChainFrom(it.node);
          focusPath = above.concat([it.node], chain);
          levelsCache = levelsFromPath(focusPath);
          markPaint();
          // ANCHOR THE DIRECTORY TO WHERE THE READER ACTUALLY IS. Osca: "It
          // just does VERY random things when I click still."
          //
          // syncContentsLive() hands the panes back to the reader on a scroll
          // event -- which is right when you scroll, and wrong when the
          // browser fires one for its own reasons. Opening panes changes the
          // reader column's width, and a relayout of a 1,000,000px column
          // emits scroll events with the position UNCHANGED. Anchoring to the
          // position rather than to "did an event arrive" means only an
          // actual move takes the directory back.
          programmaticTop = o.readerPane ? o.readerPane.scrollTop : 0;
          // hold whatever depth was standing open, so a shallower branch
          // does not drag the stack (and the reader with it) inwards
          heldDepth = Math.min(MAX_LEFT_LEVELS,
                               Math.max(levelsCache.length, Math.ceil(-dx - 0.02)));
          // A DIRECTORY ROW DOES NOT MOVE THE READER. Osca: "if I select a
          // book in plays yes, KEEP me in the 4 directory view, select first
          // scene DON'T jump me into the reader - I haven't selected YET...
          // when I don't DON'T jump to it."
          //
          // Opening a play only opens the play: the panes below fill with its
          // acts and their scenes, and the reader stays exactly where it was.
          // The first scene showing in the next pane is the directory saying
          // what is in there, not a choice you have made -- so it must not
          // drag the text with it. Only clicking a LEAF, something that owns
          // chapters itself and has nothing under it, is actually choosing a
          // place to read, and only that sends the reader anywhere.
          const isLeaf = !(it.node.children||[]).some(c=>firstChapterIdx(c)!=null);
          if(isLeaf){
            const idx = firstChapterIdx(it.node);
            if(idx!=null) scrollReaderTo(idx);
          }
          // repaint every open pane against the directory we just moved to
          for(let L=0; L<currentMaxLeft(); L++)
            if(levelsCache[L]) ensurePane(L, levelsCache[L], null, true);
        },
      });
      p.key=level.key;
    }
    // Osca's own words: "turning the reader, whilst contents page is out,
    // is NOT, turning the contents page - it should, as it does in
    // collection-page." wheel.follow(fraction) is the one call that
    // actually turns the barrel (.live() only ever marked which row was
    // current, never moved it) -- collection-page.html's own track() calls
    // it on every scroll of the reading pane for exactly this reason.
    // pos is undefined only from call sites that haven't been threaded
    // through yet (there are none left); level.liveIdx is kept as the
    // fallback so a caller that genuinely has no fraction still lands on
    // the right row instead of drifting to 0.
    // ONLY when the reader itself moved, or the pane is brand new. Osca's
    // own words: "right now I can basically only click in the contents,
    // because it snaps back when I stop scrolling to where the reader is,
    // it shouldn't, it is independent, until I click on an item in the
    // contents, or start scrolling in the reader."
    //
    // applyDx() runs every frame, and driving follow() from there meant the
    // barrel was hauled back onto the reader's own position sixty times a
    // second -- so wheel.js's own scrolling of it could never survive past
    // the next frame, and letting go snapped it straight back.
    // collection-page.html never had this: its own track() is bound to the
    // reading pane's SCROLL EVENT and nothing else, which is the whole of
    // why its column can be browsed away from where the text is. Same rule
    // here now -- syncContentsLive() (that same scroll event) passes
    // sync:true, applyDx passes false, and clicking a row moves the reader,
    // which fires that scroll event, which re-syncs. Independent until you
    // do one of exactly the two things that should re-couple it.
    if(p.wheel && (sync || fresh)){
      if(level.items && level.items.length && pos!=null){
        // A DEAD BAND, so the barrel does not shiver. pos is read off the
        // reader's own LIVE geometry, and under content-visibility that
        // geometry keeps firming up by a pixel here and there as sections
        // render -- which moved the fraction, and turned the wheel, when
        // nobody had scrolled anything. Below a hundredth of a row it is
        // not a turn, it is noise.
        const fr = itemFraction(level.items, pos);
        if(fresh || p.frac == null || Math.abs(fr - p.frac) > 0.01){
          p.frac = fr;
          p.wheel.follow(fr);
        }
        // .follow()'s own live(Math.round(fraction)) is a fair guess when
        // every item is one chapter wide -- exactly collection-page.html's
        // own case -- but a structural node's own children can span very
        // UNEVEN chapter-counts (Hamlet's three chapters against Macbeth's
        // one, say). Linearly interpolating across the whole a-to-b span
        // and rounding at its midpoint then bolds the next sibling well
        // before the reader has actually left the true one -- past 1.5 of
        // Hamlet's 3 chapters, still solidly inside Hamlet, "Macbeth"
        // would already be lit. computeLevels() already worked out which
        // sibling structurally OWNS the reader's exact chapter (liveIdx,
        // via findOwnerPath) -- live() only ever touches the CSS class,
        // never the wheel's own rotation (see this file's own header
        // comment on wheel.js), so calling it right after follow()
        // corrects the bolding back to the one truly containing the
        // reader without disturbing the smooth turn follow() just set.
        if(level.liveIdx>=0) p.wheel.live(level.liveIdx);
      }
      else if(level.liveIdx>=0) p.wheel.live(level.liveIdx);
    }
    return p.el;
  }
  // A pane standing open with nothing in it: the branch you selected is
  // shallower than the stack you had open, and the space it left is kept
  // rather than closed. Its wheel, if it had one, goes -- an empty pane must
  // not still be showing the last branch's rows.
  function emptyPane(i){
    if(i === 0) return null;                    // level 0 always has a list
    let p = leftPanes[i];
    if(!p){ const made = makePaneEl(i); p = leftPanes[i] = {el:made.el, col:made.col, wheel:null, key:null}; }
    if(p.wheel){ p.wheel.destroy(); p.wheel = null; p.key = null; }
    // it holds space, not a colour: an empty pane still wearing the wash
    // reads as a column with something in it that failed to draw.
    if(p.el && p.el.classList) p.el.classList.add("empty");
    setPaneHead(p, "");
    return p.el;
  }
  function destroyPane(i){
    const p=leftPanes[i];
    if(!p) return;
    if(p.wheel) p.wheel.destroy();
    if(i===0){ p.wheel=null; p.key=null; }         // shell.html's own elements -- keep, just empty
    else if(p.el && p.el.remove){ p.el.remove(); leftPanes[i]=null; }
    else { leftPanes[i]=null; }
  }
  function syncContentsLive(){
    if(!book) return;
    curChapterIdx = currentReaderChapter();
    markPaint();
    // Scrolling the reader hands the panes back to it -- but a scroll WE
    // caused (a click on a row) must not undo the directory that click
    // just set.
    const at = o.readerPane ? o.readerPane.scrollTop : 0;
    if(programmaticTop != null && Math.abs(at - programmaticTop) <= 4){
      /* ours -- the directory the click set stands */
    }else{
      programmaticTop = null;
      focusPath = null;
      heldDepth = 0;                 // reading again releases the held depth
    }
    levelsCache = focusPath ? levelsFromPath(focusPath) : computeLevels(curChapterIdx);
    const pos = continuousReaderPos();
    // every pane that is actually open, not only level 0 -- the deeper ones
    // track the reader exactly as much as the nearest one does.
    for(let i=0;i<currentMaxLeft();i++){
      if(levelsCache[i]) ensurePane(i, levelsCache[i], pos, true);
    }
  }

  // -------- FULL PAGE / READER -- genuinely page.js, mounted once. dx's
  // own centre (dx=0), chapter zero's own tinted `.opener` slide (page.css)
  // IS the book's cover now -- there is no separate title screen any more
  // for it to sit behind.
  const readerPage = (o.readerPane && o.readerCol && window.Page) ? window.Page.mount({
    pane:o.readerPane, column:o.readerCol, runhead:o.readerHead,
  }) : null;

  /* THE RAIL IS `scrub.js`, AND IT IS THE ONLY ONE (9 Sep). Until today there
     were two: `page.js` drew ticks and one whole-book fill into `#readerscrub`
     for the app and the shell, while `scrub.js` -- the capsule rail, with a
     bench and a slider for every number of it -- was mounted by
     `bench-page.html` and `pair.html` and by nothing the reader ever loaded.
     So every number Osca dialled on that bench adjusted a rail the app does not
     run, which is his "the bench is behind... I can't edit it", and the app's
     rail was never dialled at all. `page.js` no longer takes a `scrub` or a
     `fill`; its half is gone from that file. See design/reader/STATUS.md. */
  const readerRail = (o.readerPane && o.readerCol && o.readerScrub && window.Scrub)
    ? window.Scrub.mount({ pane:o.readerPane, column:o.readerCol, host:o.readerScrub })
    : null;
  /* one word hides the rail; `wakeSub`/`goTo` still ask the PAGE to wake, so the
     page keeps a `wake` that now reaches the rail rather than its own ticks. */
  function railWake(){ if(readerRail) readerRail.wake(); }
  function scrollReaderTo(idx){
    if(!readerPage || !o.readerCol) return;
    const sec = o.readerCol.querySelector('.chapter[data-ch="'+idx+'"]');
    if(sec){
      // page.css puts `scroll-snap-type:y proximity` on the pane and
      // `scroll-snap-stop:always` on every opener. Set scrollTop and the
      // browser is free to RE-SNAP it onto whichever marker is nearest --
      // which is how you ask for one item and arrive at another. Snapping is
      // switched off for the jump itself and restored a frame later, and the
      // position is re-asserted in case it was pulled while we were away.
      const R = document.documentElement;
      const hadNo = R && R.hasAttribute("data-nosnap");
      if(R && !hadNo) R.setAttribute("data-nosnap","");
      programmaticTop = sec.offsetTop;
      o.readerPane.scrollTop = programmaticTop;
      // AND THEN STAY THERE WHILE THE PAGE SETTLES. content-visibility means
      // the sections you jumped PAST are still estimates: as the browser
      // renders what is now on screen and replaces those estimates with real
      // heights, everything below shifts, and a scrollTop set one frame ago
      // is left pointing at the wrong text -- you land on the scene you asked
      // for and then watch it slide away. So the target is re-read, not
      // remembered: for a few frames the pane is put back on wherever that
      // section has moved to, until it stops moving.
      //
      // Any real input abandons it immediately -- being dragged back to a
      // place you have just scrolled away from would be worse than the drift.
      const mine = inputTick;
      let tries = 0;
      const settle = () => {
        if(!o.readerPane || inputTick !== mine || sec.isConnected === false){
          if(R && !hadNo) R.removeAttribute("data-nosnap");
          return;
        }
        const want = sec.offsetTop;
        if(Math.abs(o.readerPane.scrollTop - want) > 1) o.readerPane.scrollTop = want;
        programmaticTop = want;
        if(++tries < 8) requestAnimationFrame(settle);
        else if(R && !hadNo) R.removeAttribute("data-nosnap");
      };
      requestAnimationFrame(settle);
    }
    railWake();
  }
  // THE CHAPTER LIST, MEASURED ONCE. Osca: "it is still too slow... Can you
  // think of other things that are impacting the speed?"
  //
  // This is what was doing it. currentReaderChapter() ran a
  // querySelectorAll(".chapter") and then read offsetTop off EVERY section
  // it found -- and applyDx() calls it once per frame, for the running-head
  // label. On the complete Shakespeare that is 866 elements queried and 865
  // forced layout reads, sixty times a second: about fifty-two thousand
  // synchronous layout flushes per second against an 8.8MB DOM. The earlier
  // pass took this cost out of continuousReaderPos() and left it standing
  // here, which is why the presets made no difference -- none of it was ever
  // the physics.
  //
  // NOBODY GETS A SNAPSHOT OF THE GEOMETRY. Osca: "still when I click on a
  // contents item, I'm not taken to that item exactly, it takes me somewhere
  // else" / "It just does VERY random things when I click."
  //
  // Both passes before this one measured every chapter's offsetTop ONCE and
  // then answered from that snapshot. It does not survive: content-visibility
  // is already on when a book opens, so the pass measured sections the
  // browser had SKIPPED, each standing at a placeholder height rather than
  // its own -- in Chrome, live, the reading line was inside ALL'S WELL scene
  // one while the panes stood on PERICLES act three, and a click computed off
  // that snapshot could land anywhere. Measuring honestly instead means
  // laying out all ~221,500 elements at open, which is the very cost
  // content-visibility exists to avoid, and it wedged the page for minutes.
  //
  // So no snapshot. The browser's own current layout is the only authority,
  // and it is asked directly -- by BINARY SEARCH, about eleven offsetTop
  // reads to find a chapter among 865 rather than 865 reads, and never a
  // whole pass. The answer then agrees with what is actually on the screen by
  // construction, whatever the browser is currently estimating for the parts
  // of the book it has not rendered: where the panes think you are, where the
  // scrub thinks you are, and where a click sends you are all read off the
  // same live geometry, so they cannot disagree with each other.
  //
  // The ELEMENT LIST is still cached -- that is a DOM query, not a
  // measurement, and it costs no layout.
  let secsCache=null;
  function invalidateSections(){ secsCache=null; }
  function sections(){
    if(!secsCache && o.readerCol)
      secsCache = [...o.readerCol.querySelectorAll(".chapter")].filter(c=>!c.classList.contains("titlepage"));
    return secsCache || [];
  }
  // SKIPPING WHAT IS OFF SCREEN. Osca, after turning every animation off and
  // finding it made no difference: "even with no animation, setting things to
  // instant and 0 flutter, it doesn't improve shakespeare - obviously, that's
  // not the answer." It isn't. The complete Shakespeare builds ~221,500
  // elements up front, and the browser lays out and paints all of them.
  //
  // content-visibility:auto tells it not to: a section that is off screen
  // skips layout and paint of its whole subtree, which is what made this book
  // snappy. What it costs is exactness -- until the browser has rendered a
  // section once it only ESTIMATES its height, so the geometry of the parts
  // you have not visited is approximate, and it firms up as you read.
  //
  // The earlier passes tried to buy that exactness back by measuring every
  // chapter and handing it its own true height. That is where the wrong
  // clicks came from: see sections() above. Nothing here measures anything
  // now. Everything that needs to know where something is asks the browser
  // for its CURRENT position, so being approximate about the far end of the
  // book costs nothing that shows -- the scrub is a little elastic until you
  // have been there, and that is the whole of it.
  //
  // Where content-visibility isn't supported the rule is simply ignored: no
  // worse than before, just not faster.
  let skipOffscreen = true;
  try{ const v = localStorage.getItem("skipoff"); if(v !== null) skipOffscreen = v === "1"; }catch(_){}
  function applyOffscreenSkip(){
    const secs = sections();
    if(!secs.length) return;
    // Writes only, never a read. The placeholder height for a section that
    // has not been rendered yet is left to the stylesheet's own
    // `contain-intrinsic-size: auto <fallback>`: `auto` means the browser
    // remembers each section's REAL size once it has rendered it once, so the
    // estimate corrects itself as you read, without anything here measuring
    // anything. Any per-section height written by an earlier build is cleared
    // -- those were the fictions, and they are what made the lie permanent.
    for(let i=0;i<secs.length;i++)
      if(secs[i].style.containIntrinsicSize) secs[i].style.containIntrinsicSize = "";
    try{
      if(document.documentElement)
        document.documentElement.toggleAttribute("data-skipoff", skipOffscreen);
    }catch(_){}
  }
  function setSkipOffscreen(on){
    skipOffscreen = !!on;
    try{ localStorage.setItem("skipoff", skipOffscreen ? "1" : "0"); }catch(_){}
    invalidateSections(); applyOffscreenSkip(); markPaint();
    return skipOffscreen;
  }

  function readingLine(){
    return o.readerPane ? o.readerPane.scrollTop + o.readerPane.clientHeight*0.35 : 0;
  }
  // binary search over the LIVE tops -- about eleven reads for 865 chapters,
  // and never a stale answer. See sections() above for why nothing is cached.
  function sectionAt(line){
    const secs = sections();
    if(!secs.length) return 0;
    let lo=0, hi=secs.length-1, k=0;
    while(lo<=hi){
      const mid=(lo+hi)>>1;
      if(secs[mid].offsetTop<=line){ k=mid; lo=mid+1; } else hi=mid-1;
    }
    return k;
  }
  function currentReaderChapter(){
    if(!o.readerCol || !o.readerPane) return 0;
    sections();
    return sectionAt(readingLine());
  }
  // collection-page.html's own track() reads the SAME line -- scroll.scrollTop
  // + readingLine() -- against every section's own offsetTop, and calls
  // wheel.follow(i+f), a fraction, "because the wheel must sit BETWEEN two
  // names exactly when the text sits between two chapters". currentReaderChapter
  // above only ever gives the nearest whole chapter, which is all `structure`
  // needs -- but it is also all `.live()` ever gave the contents wheel itself,
  // which is why turning the READER never turned the pane: nothing here was
  // ever computing the fraction collection-page.html's own glide depends on.
  // Same anchor line (clientHeight*0.35) currentReaderChapter already uses,
  // so the two never disagree about which chapter is "current".
  function continuousReaderPos(){
    if(!o.readerCol || !o.readerPane) return 0;
    const secs = sections();
    if(!secs.length) return 0;
    const line = readingLine();
    const i = sectionAt(line);
    const a = secs[i].offsetTop;
    const b = (i+1<secs.length) ? secs[i+1].offsetTop : a + (secs[i].offsetHeight||0);
    const f = b>a ? Math.min(1,Math.max(0,(line-a)/(b-a))) : 0;
    return i+f;
  }
  // Maps that same continuous chapter-space position onto a continuous
  // ITEM index for one pane's own list -- items[k].chapterIdx values are
  // each item's own first chapter, in the same rising order the structure
  // tree already puts its siblings in, so this is exactly the flat book's
  // own identity fraction (chapterIdx===i) generalised to a level whose
  // items each span a RANGE of chapters rather than exactly one.
  function itemFraction(items, pos){
    if(!items || !items.length) return 0;
    let k=0;
    while(k+1<items.length && items[k+1].chapterIdx<=pos) k++;
    const a=items[k].chapterIdx;
    // The last item's own span has no next sibling to bound it -- it runs to
    // the end of the book, not to a+1. Falling back to a+1 badly undercounts
    // a last item spanning several chapters (its fraction blows past 1.0 and
    // rounds off the end of the list); book.chapters.length is its real far
    // edge, same as collection-page.html's own TOPS/SECS reach the bottom of
    // the actual scroll range rather than one chapter past the last opener.
    const b=(k+1<items.length) ? items[k+1].chapterIdx
           : (book && book.chapters ? Math.max(a+1, book.chapters.length) : a+1);
    const f = b>a ? Math.min(1,Math.max(0,(pos-a)/(b-a))) : 0;
    return k+f;
  }
  if(o.readerPane) o.readerPane.addEventListener("scroll", syncContentsLive, {passive:true});

  // -------- ONE WORD -- down/up steps a word (reading on, at the finest
  // grain there is), left/right only ever enters or leaves the view.
  // Running off either end now just stops -- there is nowhere deeper to
  // hand a vertical push on TO, so it no longer tries to.
  //
  // Fourteenth pass, continued -- Osca's own words: "get rid of all the
  // stuff around it... I want it to zoom into the word it's on ON the
  // page, that's the animation." This used to be its own full-screen
  // panel (a big isolated word, a counter, a second word-wheel) sliding
  // in from the right, a second small page of its own -- exactly the
  // "another reader page" the tenth pass already ruled out once for
  // contents, just never revisited here. There is no second page any
  // more: wordDomIndex walks the SAME word order wordsOf() already
  // builds and lands each one on a real Range inside the reader's own
  // rendered chapter (page.js gives every non-speaker, non-direction
  // block exactly one <p class="line"> with exactly one text-node child,
  // so a word's character offset inside that node is all a Range needs --
  // no DOM rewritten, no words individually wrapped). o.readerCol itself
  // is what scales, transform-origin planted on that word's own on-screen
  // box, so scrolling right doesn't open a second screen, it zooms the one
  // that was already there, straight onto wherever the word actually is --
  // "ON the page".
  const WORD_ZOOM=7;             // scale at dx=1, fully zoomed on the word
  let wordChapterIdx=-1, wordWords=[], wordDomIndex=[], wordIdx=0, wordAccum=0;
  let wordHiOK = !!(window.CSS && CSS.highlights && window.Highlight);
  function wordsOf(ch){
    const words=[];
    (ch.blocks||[]).forEach(b=>{
      if(b.r==="sp"||b.r==="dir") return;
      (b.t||"").split(/\s+/).filter(Boolean).forEach(w=>words.push(w));
    });
    return words;
  }
  // Same order wordsOf() walks (every block except sp/dir), because
  // page.js gives every one of those blocks the class "line", in the same
  // order, and nothing else that class -- the two lists line up index for
  // index without either file needing to know about the other's own book.
  function buildWordDomIndex(idx){
    const sec = o.readerCol && o.readerCol.querySelector('.chapter[data-ch="'+idx+'"]');
    if(!sec) return [];
    const out=[];
    sec.querySelectorAll("p.line").forEach(p=>{
      const tn=p.firstChild;
      if(!tn || tn.nodeType!==3) return;         // an empty line -- nothing to index
      const text=tn.nodeValue||"";
      let pos=0;
      text.split(/(\s+)/).forEach(tok=>{
        if(tok && !/^\s+$/.test(tok)) out.push({node:tn, start:pos, end:pos+tok.length, p});
        pos+=tok.length;
      });
    });
    return out;
  }
  // Osca's own words: "I want it to zoom into the word it's on ON the
  // page". A chapter can run long, and the reader is routinely scrolled
  // well past its opener by the time a rightward push actually reaches
  // dx=1 -- entering ONE WORD always at word 0 (the chapter's own first
  // word, up on the opener slide) would then zoom toward a point that
  // isn't even in view, wrecking the "it's zooming into what I'm already
  // looking at" illusion this pass exists for. Same anchor line
  // currentReaderChapter()/continuousReaderPos() already use, walked
  // against each word's own paragraph's offsetTop -- the last one at or
  // above that line is nearest the word actually under the reader's eye.
  function wordIdxNearLine(idx){
    if(!wordDomIndex.length || !o.readerPane) return 0;
    // Paragraph-level, deliberately. Indexing every WORD's own top and
    // taking the last one at or above the reading line returns the last word
    // of whichever paragraph STARTS above that line -- and a long paragraph
    // runs a long way past it, so the word picked could sit well below the
    // fold. That put the zoom's own transform-origin at "122.37%" of the
    // viewport, anchoring the magnification on a point not even on screen.
    // The paragraph CONTAINING the line is the right unit, and its first
    // word is always within a line or two of where the eye actually is.
    //
    // p.offsetTop is no use here: page.css makes both .chapter and .unit
    // position:relative, so a <p class="line">'s own offsetParent is
    // whichever of those it sits inside, never o.readerPane, and comparing
    // that against a pane-scroll-space line read every paragraph as "above"
    // it. getBoundingClientRect() sidesteps the offsetParent chain entirely.
    const paras = [];
    let lastP = null;
    for(let i=0;i<wordDomIndex.length;i++){
      if(wordDomIndex[i].p !== lastP){ lastP = wordDomIndex[i].p; paras.push({p:lastP, first:i}); }
    }
    if(!paras.length) return 0;
    const paneTop = o.readerPane.getBoundingClientRect().top;
    const line = o.readerPane.scrollTop + o.readerPane.clientHeight*0.35;
    const topOf = k => paras[k].p.getBoundingClientRect().top - paneTop + o.readerPane.scrollTop;
    // paragraphs are in document order, so their tops only rise -- a binary
    // search rather than one layout read per paragraph on the way in.
    let lo=0, hi=paras.length-1, k=0;
    while(lo<=hi){
      const mid=(lo+hi)>>1;
      if(topOf(mid)<=line){ k=mid; lo=mid+1; } else hi=mid-1;
    }
    return paras[k].first;
  }
  // ONE list is authoritative, and it is the one we actually navigate.
  // Osca, asking what this was doing with his Shakespeare: "parsing it
  // yourself, in your script > outside the scope of parser? You're doing
  // something funny aren't you?" -- and he was right to ask. Two separate
  // splitters had grown here: wordsOf() over book.chapters[].blocks, and
  // buildWordDomIndex() over page.js's own rendered <p class="line">. Both
  // tokenise the book's text, independently, and the word view is only
  // correct while they agree COUNT FOR COUNT AND ORDER FOR ORDER -- which
  // held by nothing sturdier than page.js happening to emit exactly one
  // p.line per non-sp/non-dir block. The complete Shakespeare is the worst
  // case for that: more speaker and stage-direction blocks than any other
  // book here, and those are precisely what the two have to skip
  // identically. When they disagree, wordIdx is in range for one list and
  // past the end of the other, currentWordRange() returns null, and the
  // screen keeps showing the previous word while the index walks on --
  // which is the freeze seen earlier and not explained at the time.
  //
  // So: the DOM index wins wherever it exists, because it is the thing
  // being pointed AT. wordsOf() survives only as the fallback for when
  // there is no rendered DOM to index (the headless harness, a chapter
  // page.js hasn't laid out), where nothing can be zoomed anyway.
  function wordTotal(){ return wordDomIndex.length || wordWords.length; }
  function wordTextAt(i){
    const w = wordDomIndex[i];
    if(w && w.node) return (w.node.nodeValue||"").slice(w.start, w.end);
    return wordWords[i] || "";
  }
  function currentWordRange(){
    const w=wordDomIndex[wordIdx];
    if(!w) return null;
    try{
      const r=document.createRange();
      r.setStart(w.node, w.start); r.setEnd(w.node, w.end);
      return r;
    }catch(_){ return null; }
  }
  // A CSS Custom Highlight, not a wrapped <span> -- the word gets marked
  // without touching the paragraph's own text node (still one text node
  // per line, still what buildWordDomIndex's own offsets assume). Where
  // the browser doesn't have it, the zoom itself still lands on the right
  // word; only the tint is missing.
  // KEPT, BUT IT NO LONGER HIDES ANYTHING. The highlight used to make the real
  // word transparent so a lifted copy could sit on top of it. Nothing is
  // lifted now, so shell.css's rule for it is gone and this only marks which
  // word is current -- useful to anything that wants to know, invisible here.
  function paintWordHighlight(){
    if(!wordHiOK) return;
    try{
      const r=currentWordRange();
      if(r) CSS.highlights.set("word-target", new Highlight(r));
      else CSS.highlights.delete("word-target");
    }catch(_){ wordHiOK=false; }
  }
  // ---------------------------------------------------------------- THE
  // CURSOR -- one place in the book, and two things use it.
  //
  // Osca: "it is not anywhere, it is where it last was, where you last left
  // one word view, that's where the endpoint/origin is... the one word view
  // AND the voice highlight/cursor is the same thing. Let me double click a
  // word, to bring one word view endpoint/origin AND the voice to there."
  //
  // So the book has a cursor: a chapter and a word inside it. One word view
  // opens AT it rather than at whatever happens to be under the reading line,
  // and comes back to it however far you have read in between. Double-clicking
  // any word moves it. It is remembered per book, so closing and reopening
  // finds it again, and every move is announced (`ttstv:cursor`) so the voice
  // can follow the same point rather than keeping a second one of its own.
  let cursor = null;                       // {ch, wi} or null
  function cursorKey(){ return "wordcursor:" + ((book && book.slug) || "?"); }
  function loadCursor(){
    cursor = null;
    try{
      const raw = localStorage.getItem(cursorKey());
      if(raw){ const c = JSON.parse(raw); if(c && c.ch != null) cursor = {ch:+c.ch, wi:+c.wi||0}; }
    }catch(_){}
  }
  function setCursor(ch, wi, why){
    cursor = {ch: ch, wi: wi};
    try{ localStorage.setItem(cursorKey(), JSON.stringify(cursor)); }catch(_){}
    try{
      (o.bookEl || document).dispatchEvent(new CustomEvent("ttstv:cursor", {
        bubbles: true,
        detail: { slug: book && book.slug, chapter: ch, word: wi,
                  text: (wordChapterIdx===ch ? wordTextAt(wi) : ""), why: why||"" }
      }));
    }catch(_){}
  }
  function enterWord(idx){
    // the cursor wins: one word view is an ENDPOINT, and the endpoint is
    // where you last left it, not where the page happens to be sitting.
    const useCursor = cursor && book && book.chapters && book.chapters[cursor.ch];
    const ch = useCursor ? cursor.ch : idx;
    wordChapterIdx=ch; wordAccum=0; wordVel=0;
    wordWords=wordsOf(book.chapters[ch]);
    wordDomIndex=buildWordDomIndex(ch);
    wordIdx = useCursor ? clamp(cursor.wi, 0, Math.max(0, wordTotal()-1))
                        : wordIdxNearLine(ch);
    if(!useCursor) setCursor(ch, wordIdx, "entered");
    wordSlideX=0; arrived=null;
    paintWordHighlight();
    // THE READER GOES TO THE ENDPOINT FIRST. The cursor may be a hundred
    // chapters from where you have been reading; zooming about a word that is
    // not on the screen means turning the page about a point outside it,
    // which puts the reader's own pane off the top of the screen and paints
    // nothing. So the book arrives at the word before the zoom starts.
    // ...UNLESS THE FINGERS ARE ALREADY ON IT. A pinch NAMES its word -- the
    // one under the point the gesture started at -- so travelling to the cursor
    // would move the page out from under the hand that is pointing at it, which
    // is the one thing a pinch must never do. The anchor is planted where that
    // word already is instead (computeArrived reads its live rect), and the
    // push's own behaviour is untouched: it still seats, exactly as before.
    if(useCursor && !pinchEntering) seatOnWord();
  }
  // ...AND ARRIVING AT IT IS NOT ARITHMETIC. Measured live, 6 September, at
  // position +1 on Blood Meridian: the cursor sat in chapter I (section 2, its
  // own offsetTop 2,218) while the reader was 57,996px down in chapter IV
  // (section 5). One arrow right, and the page showed the ordinary reading
  // text with no zoom on it anywhere -- because the section the cursor is in
  // had never been visited, content-visibility had SKIPPED it, and every
  // number measured through it was the placeholder's and not the page's: the
  // paragraph reported a box 55,000px above the screen, `scrollTop + (top -
  // paneTop)` aimed at a place the word was not, and the arrival was computed
  // about a point outside the view. (This is the same lie the scrub was taught
  // to stop believing on the 5th -- "clicked chapter IX and the rail said VI".)
  //
  // So it is done the scrub's way: scrollIntoView, which reveals the skipped
  // section and then scrolls against the live layout, and then the gap between
  // the word and the middle of the pane is closed AGAIN, on each of the next
  // frames, because revealing one section re-measures every one after it and
  // the target moves while you are arriving at it. It converges because the
  // thing being measured is the thing being fixed, and it gives up the moment
  // there is a scroll of the reader's own.
  let seating = false;
  function seatOnWord(){
    const pane = o.readerPane;
    const w = wordDomIndex[wordIdx];
    const host = w && w.p;
    if(!pane || !host) return;
    // where the WORD is, not where its paragraph is -- a paragraph of any
    // length centred by its own box does not put the word anywhere in
    // particular. The paragraph is the fallback for a range that will not
    // measure (headless, mostly).
    const spot = () => {
      const r = currentWordRange();
      const rc = r && r.getClientRects ? r.getClientRects()[0] : null;
      return (rc && rc.width > 0) ? rc : host.getBoundingClientRect();
    };
    const close = () => {
      const pr = pane.getBoundingClientRect();
      const b  = spot();
      const d  = (b.top + b.height/2) - (pr.top + (pane.clientHeight||0)/2);
      if(Math.abs(d) > 2){
        // ...and never past the ends of the book. Closing a gap against a
        // measurement that does not answer is how the scrub used to walk the
        // page to the title slide; a scroll position outside the column is
        // also the one the browser clamps to zero, which is the lurch.
        const max = (pane.scrollHeight || 0) - (pane.clientHeight || 0);
        let to = pane.scrollTop + d;
        if(to < 0) to = 0;
        if(max > 0 && to > max) to = max;
        pane.scrollTop = to;
        programmaticTop = pane.scrollTop;
        arrived = null;                       // measured again where it now is
        markPaint();                          // ...and applyDx has to be told
      }
      return Math.abs(d);
    };
    // ...AND ONLY WHEN IT IS NOT ALREADY THERE. Osca, 6 September: "no
    // transition that moves text up". Seating a cursor that is already on the
    // screen is exactly that -- the page slides to centre a word you were
    // looking at before the zoom has even begun, and the zoom then grows about
    // a place the word was not. The seat is for a cursor in a chapter you have
    // not been reading; if the word is in the view, the view is right.
    const here = spot();
    const pr0 = pane.getBoundingClientRect();
    const off = !here || here.bottom < pr0.top + 8 ||
                here.top > pr0.top + (pane.clientHeight || 0) - 8;
    if(!off) return;                          // it is in the view: the view is right

    if(!host.scrollIntoView){                 // no browser here: the old sum
      const pr = pane.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      if(hr.top < pr.top + 8 || hr.bottom > pr.bottom - 8){
        const want = pane.scrollTop + (hr.top - pr.top) - pane.clientHeight*0.35;
        pane.scrollTop = want; programmaticTop = want; arrived = null;
      }
      return;
    }
    host.scrollIntoView({ block: "center" });
    programmaticTop = pane.scrollTop;
    close();
    seating = true;
    const mine = inputTick;
    let tries = 0, lastD = Infinity, stuck = 0;
    const settle = () => {
      if(inputTick !== mine){ seating = false; return; }   // your own scroll wins
      const d = close();
      if(d <= 2){ seating = false; return; }               // arrived
      // AND IT GIVES UP RATHER THAN CHASING. If the gap stops shrinking, the
      // thing being measured is not answering -- a chapter still skipped, a
      // word whose rect is a placeholder's -- and another twenty corrections
      // would only carry the page further from the book. Three frames of no
      // progress is enough to know.
      if(d >= lastD - 1){ if(++stuck >= 3){ seating = false; return; } }
      else stuck = 0;
      lastD = d;
      if(++tries < 24) requestAnimationFrame(settle);
      else seating = false;
    };
    if(typeof requestAnimationFrame === "function") requestAnimationFrame(settle);
    else seating = false;
  }
  function exitWord(){
    // the highlight STAYS. It is not a zoom artefact any more, it is the
    // cursor -- where the voice is, and where one word view will open next
    // time. The index behind it is kept too, so re-entering costs no rebuild.
    clearWordZoom();
  }
  function stepWord(dir){
    const next=clamp(wordIdx+dir, 0, wordTotal()-1);
    if(next===wordIdx) return;      // at either end -- stop, don't hand off
    // A new word means a new measurement, and -- once the view is actually
    // zoomed -- a short lateral slide in the direction of travel, so reading
    // on reads as the words moving sideways past a fixed centre rather than
    // the one word blinking into something else. "just side to side, whilst
    // I scroll up and down."
    wordIdx=next; arrived=null;
    if(wordPane) wordPane.forget();
    markPaint();
    wordSlideX = dir>0 ? WORD.slide : -WORD.slide;
    setCursor(wordChapterIdx, wordIdx, "stepped");
    paintWordHighlight();
  }
  // SCROLLING INSIDE ONE WORD, WITH A TAIL. Osca: "I want to add a scroll
  // inside the in words which carries on a little after you scroll (scrolling
  // down the page) as you read it. So you can scroll every two seconds or so,
  // dictating your own pace."
  //
  // A push does two things now: it moves words immediately, as it always did,
  // and it leaves behind a velocity that keeps feeding words afterwards --
  // one push, then reading, then another push when you want it. carry is how
  // much of the push is kept, glide how long the tail lasts, and settle what
  // becomes of the part-word left over when it stops: pulled on to the next
  // word, or let fall back to the one you are on.
  let wordVel = 0;
  function wordStepPx(){ return WORD.step > 4 ? WORD.step : 4; }
  function drainWord(){
    const px = wordStepPx();
    while(wordAccum>=px){ stepWord(1); wordAccum-=px; }
    while(wordAccum<=-px){ stepWord(-1); wordAccum+=px; }
  }
  function bumpWord(delta){
    wordAccum += delta;
    wordVel = wordVel*0.55 + delta*WORD.carry;
    const cap = WORD.vmax > 0 ? WORD.vmax : 0;
    if(wordVel > cap) wordVel = cap; else if(wordVel < -cap) wordVel = -cap;
    drainWord();
  }
  // called every frame while ONE WORD is the level -- the tail, and the way
  // the leftover part-word settles once the tail has died.
  function coastWord(dt){
    if(!wordVel && !wordAccum) return;
    if(wordVel > 0.4 || wordVel < -0.4){
      wordAccum += wordVel*dt;
      wordVel *= Math.pow(WORD.glide, dt);
      drainWord();
      markPaint();
      return;
    }
    wordVel = 0;
    if(!wordAccum) return;
    const px = wordStepPx();
    // more than half way to the next word: finish the step. Less: fall back.
    const toward = (wordAccum > px*0.5) ? px : (wordAccum < -px*0.5 ? -px : 0);
    wordAccum += (toward - wordAccum) * Math.min(1, WORD.settle*dt);
    if(Math.abs(toward - wordAccum) < 0.4){ wordAccum = toward; drainWord(); wordAccum = 0; }
    markPaint();
  }
  // THE ZOOM. Two things about this were badly wrong until Osca ran it in
  // Safari over file:// -- his own browser, not the Chrome-over-localhost
  // this bench had been checked in -- and the whole page died: "scrolling
  // about literally crashes the entire page and it automatically reloads",
  // WebKit's own web content process going down and being restarted.
  //
  // WHAT IT SCALES -- AND IT IS NOT A LAYER AT ALL ANY MORE (reader 25, 6 Sep).
  // The transform went from #readercol (the whole book: 1,086,906px tall on
  // the French poetry book, and scale(7) on that took WebKit's web content
  // process down) to #readerbox (one viewport, bounded). That fixed the crash
  // and left the real fault standing: a transform MAGNIFIES A RASTER. Measured
  // on the live page, at scale(16) the zoomed paragraph was still set in
  // 26.818px of type, and WebKit does not re-raster the layer -- so the one
  // word Osca is looking at is a pixelated 26.818px word sixteen times too
  // big. Chromium re-rasters and hides it, which is why the bench never saw it.
  //
  // shell.css has said what this is supposed to be all along: "THE ZOOM IS THE
  // PAGE'S OWN TYPE... the chapter's type grows -- a zoom the browser LAYS OUT
  // rather than a layer it has to raster, which is why it has no size limit
  // and why the text stays sharp at any size." So the growth is a font-size on
  // the word's own paragraph, the centring is that paragraph's own relative
  // box offset, and there is no transform anywhere between the word and
  // #readerbox. Laid out, not rastered: sharp at 400px and at 4,000.
  //
  // HOW OFTEN IT TOUCHES IT. The previous pass cleared and re-set the
  // transform EVERY FRAME to measure from clean geometry. On a layer that
  // size that is a full teardown and rebuild sixty times a second -- the
  // likeliest single cause both of the crash and of the jumping, since a
  // compositor re-tiling under a moving transform is exactly what "it jumps
  // about" looks like. The origin only actually moves when the WORD moves,
  // and in one word the reader itself never scrolls (vertical steps a word;
  // it doesn't scroll the pane) -- so it is measured once per word and
  // cached, and per frame this now writes one scale value and nothing else.
  // Osca's own words, watching the page-scaling version run: "the view HAS
  // to be one word, like we ZOOM into the page, but I want line spacing to
  // increase and spaces between words, so 1 WORD, fills the whole screen,
  // NOT fully, but such that nothing ELSE IS seen. Then, when scrolling in
  // ONE WORD VIEW, the text, the ONE WORD, should stay centred. Shouldn't
  // move about up and down, just side to side, whilst I scroll up and down."
  //
  // GROWING THE TYPE CANNOT LEAVE ONE WORD ALONE BY ITSELF, and neither could
  // scaling: either one multiplies the word and the gap beside it equally, so
  // the neighbour stays exactly as many word-widths away as it ever was. That
  // is what the push-out is for, and it is the OTHER half of the mechanism --
  // word-spacing and leading, held back to the last stretch (spreadPage), on
  // the word's own paragraph and no wider. Between them: the type grows until
  // the word fills the frame, then the neighbours are driven off it.
  //
  // NOTHING IS LIFTED. Osca: "NOTHING, lifts from the page, it is a ZOOM...
  // LEAVE IT, ON THE PAGE." There is no overlay span, no fade, and no
  // ::highlight rule hiding the real word under a copy of itself. What you
  // watch grow is the page's own word.
  //
  // AND IT IS PINNED. Where the growth and the spacing put the word is read
  // once a frame and cancelled by the paragraph's own relative offset, eased
  // by the same progress -- so at full zoom the word sits dead centre no
  // matter WHICH word it is, and stepping to the next one cannot move it up or
  // down. What moves instead is the page around it, and a short lateral slide
  // as each new word comes in -- "just side to side, whilst I scroll up and
  // down".
  const COLL_GUTTER = 0.055;  // of the viewport's own width, left of the whole stack
  // THE READER STOPS WHERE IT IS. Osca: "I need the main reader, to NOT move
  // any further left than where it is, centred in the page, according to it's
  // margin."
  //
  // The panes used to keep pushing until the reader was a 300px ribbon with
  // one word to a line. It stops now at its own measure -- the reading
  // column's real width plus its margin -- and past that point the panes
  // slide OVER it instead of shoving it, which is what blocks sliding over
  // each other should do to everything, the reader included.
  const READER_EDGE_PAD = 48;   // the margin either side of the column
  let readerFloor = 0;          // measured from the column itself, once
  function readerColumnWidth(){
    if(!readerFloor && o.readerCol){
      const ch = o.readerCol.querySelector(".chapter");
      if(ch) readerFloor = ch.offsetWidth + READER_EDGE_PAD*2;
    }
    return Math.max(0, (readerFloor || 620) - READER_EDGE_PAD*2);
  }
  function readerMinWidth(){
    if(!readerFloor && o.readerCol){
      const ch = o.readerCol.querySelector(".chapter");
      if(ch) readerFloor = ch.offsetWidth + READER_EDGE_PAD*2;
    }
    const vw = window.innerWidth || 0;
    // AND IT MAY NARROW TO MAKE ROOM. This floor was the column's own natural
    // width, which meant the reader could never be pushed further than the
    // margin it started with -- and on a book with a wide measure (Moby Dick
    // sets 1000px of it on a 1710px window) two panes need more room than that
    // margin has, so the reader stopped short and the panes still sat over the
    // first words. It gives ground now: the column re-wraps narrower rather
    // than staying wide and half-covered. The floor is what is still a column
    // rather than a ribbon -- the collapse this guard exists for (a reader
    // squeezed to nothing loses its scroll height, and the book jumps to page
    // one) needs a fraction of this.
    return Math.min(readerFloor || 620, Math.max(360, vw * 0.34));
  }
  // HOW THE PANES THEMSELVES MOVE. Osca: "I want to control the animations of
  // the contents assets, like how they slide together. I don't want them to be
  // one pane, Each a different pane, moving like slides, much wider than they
  // are now, but come together... can have them farther away, when you scroll,
  // they close in."
  //
  //   scale   how wide each pane is, against the widths shell.css measures
  //   gap     white space left BETWEEN two open panes -- what stops the stack
  //           reading as one continuous column
  //   travel  how far out a closed pane sits, as a multiple of its own width:
  //           1 is where it used to start (exactly its own width out, so it
  //           arrives just as it clears), more than 1 starts it further away
  //           and brings it in faster
  //   ease    the shape of that approach: 1 is linear, above 1 hangs back and
  //           then closes, below 1 comes in early and settles
  // THE APP'S OWN SETTING OF pane.js. Everything the stack does is one of
  // these numbers; bench-panes.html is where they are dialled, and these are the
  // ones this reader ships with over the module's own defaults.
  // pane.js's own DEFAULTS, unaltered: the settings logged there on
  // 5 September are the setting, here as much as on the bench. Anything this
  // file overrode would be a second place to tune the panes, which is the one
  // thing making them their own asset was meant to end.
  const PANE = (window.Panes && window.Panes.defaults()) || {};
  function setPaneVar(){
    try{
      if(document.documentElement)
        document.documentElement.style.setProperty("--panescale", String(PANE.scale));
    }catch(_){}
    paneWidthsStale = true; markPaint();
  }
  function setPane(k, v){
    if(!(k in PANE)) return PANE[k];
    PANE[k] = +v;
    if(k === "scale") setPaneVar(); else markPaint();
    return PANE[k];
  }
  setPaneVar();                     // the width scale is CSS's to apply
  /* ONE WORD's own numbers, live-adjustable from the tuner rather than baked
     in -- Osca: "the speed on the animation of one word view". The zoom is
     driven by dx, so its "speed" is the CURVE: how much of the push has to
     happen before the word is fully out. curve<1 arrives early, >1 late. */
  const WORD = {
    fill:    0.78,   // of the viewport's own width, at full zoom
    fillH:   0.55,   // ...but never taller than this much of it
    pageZ:   7,      // the page's own zoom behind
    // THE FADE COMES LAST. Osca: "I want to be ZOOMING into the page, AND
    // pushing away the ext beside / below". It used to start at 0.45 and be
    // over by 0.92, so by the time the words had begun to spread there was
    // nothing left on screen to watch spread -- it read as a crossfade, and
    // the push it was hiding was the thing he asked for. Now the page holds
    // its full strength through the whole zoom and only gives up the last
    // tenth, by which point the frame is already empty of everything but the
    // word.
    fadeIn:  0.88,   // page holds full strength until here...
    fadeOut: 1.0,    // ...and is gone by here
    slide:   110,    // px a new word slides in from
    decay:   0.80,   // how fast that slide dies, per frame
    curve:   1.0,    // <1 = the zoom arrives sooner, >1 = later
    step:    42,     // px of vertical scroll per word, inside one word view
    maxzoom: 16,     // the most the page may be zoomed, whatever the word
    wordgap: 120,    // px the words are driven apart by, at full zoom
    linegap: 2.4,    // extra leading at full zoom, added to page.css's own 1.5
    // `wide` and `edge` are GONE with the one-paragraph zoom they belonged to
    // (6 Sep, second pass). They were the answer to a margin that only existed
    // because a paragraph's type grew inside a column that did not: how far to
    // release the column, and how much of the view to keep back when it was
    // released. A page zoomed as a page has neither question -- the column is
    // scaled by the same factor as everything else in it, nothing re-wraps at
    // any zoom, and there is no measure left to leave a margin.
    leverage: 3.2,   // the shape of the pull toward an off-screen word:
                     // 1 = a straight line, higher = harder away, softer in
    pulltime: 14,    // how long that pull takes (0 = never follow)
    carry:   0.55,   // how much of a push is kept as a tail (0 = none, as before)
    glide:   0.93,   // how long that tail lasts, per frame (higher = travels further)
    vmax:    240,    // the fastest that tail may run, in px of scroll a frame
    settle:  0.35,   // how firmly the part-word left over settles onto a word
    // THE SUBTITLE SLEEPS (job 24; Osca, 6 Sep: "it disappears when you stop
    // moving/tapping (just playing) after a second or so"). ms after the last
    // wheel, tap or key before the line goes -- and only while something is
    // PLAYING: with nothing playing there is nothing carrying you along, so the
    // one thing on the screen that says where you are stays put.
    subsleep: 1000,
    // ONE WORD IS THE SAME SIZE WHICHEVER WAY THE PHONE IS HELD (job 24: "the
    // one-word type size scales with the SHORT side, not the long"). The
    // arrival's k is worked out against the view -- fill of its width, fillH of
    // its height -- and on a phone that makes rotating it re-set the type:
    // 0.55 of 844 is a 464px word in portrait and 0.55 of 390 is 214 in
    // landscape, the same word, twice the size, for turning the thing over. So
    // on a screen whose SHORT side is at or under this mark, both terms are
    // measured against that short side, and k comes out identical either way
    // up. Above it -- every desk -- nothing changes: 1280x800's short side is
    // 800. Same mark as pane.js's `narrowH`, and the same idea: this is a
    // phone.
    shortside: 500,
    // WHICH LAW THE FACTOR FOLLOWS between the page and the word. See THE
    // PINCH below: "power" is z = k^dx, a constant zoom RATE per unit of the
    // axis, which is what a zoom control is and what the pinch needs; "smooth"
    // is the smoothstep this file ran on until 7 September, kept dialable
    // rather than deleted so the two can be watched against each other. Both
    // land on exactly the same two ends -- 1 at dx 0, k at dx +1.
    law:     "power",
  };
  try{
    const saved = JSON.parse(localStorage.getItem("ttstv_word")||"null");
    if(saved) Object.keys(WORD).forEach(k=>{
      if(typeof saved[k]==="number") WORD[k]=saved[k];
      else if(k==="law" && (saved[k]==="power"||saved[k]==="smooth")) WORD[k]=saved[k];
    });
  }catch(_){}
  /* ================= THE PINCH IS THE WHOLE CONTINUUM =====================
     Osca, 7 September: "the pinch zoom should zoom into the page, then past a
     certain point, opens in one word view."

     ONE GESTURE, AND THERE IS ONLY ONE FACTOR TO DRIVE. Nothing new is opened
     here and nothing is replaced: the axis already grows the reading page from
     its reading size (dx 0) to one word (dx +1) by writing ONE css `zoom` on
     ONE element, and a pinch is simply a second driver of that same dx -- the
     first one that is a zoom control rather than a push. What the pinch brings
     with it is three things the push never needed:

       WHERE IT GROWS FROM. The push has to choose a word for you (the cursor,
       or the one nearest the reading line). A pinch is POINTING at something,
       so the word under the point the fingers started at becomes the cursor,
       and the anchor is planted where that word already is -- the page grows
       about your own hand, and does not travel to a word somewhere else first.

       A PLACE TO REST INSIDE THE STRETCH. 0 < dx < 1 has never been somewhere
       you could stop: "between the word and the reader there is nothing to
       look at" (the fifteenth pass), so the snap has always thrown it to one
       end or the other. A page held at three or four times reading size IS
       something to look at -- it is the first half of what was asked for -- so
       while the pinch holds it, it rests exactly where the fingers left it.

       A PAN. "you drag to pan around it, exactly like zooming a photo."

     THE THRESHOLD IS THE ONE THE FILE ALREADY HAD, and that is the point of
     putting it there: `PINCH.gate` is 0.5, which is levelOf()'s own word
     boundary and WORD_COMMIT's own release rule, both of them written long
     before this. Below it the page is a page you are zooming and looking
     around -- the running head and the scrub are still up, the reader still
     takes a pointer, nothing about the screen says "one word". At it, one word
     begins, and on release past it the same hard snap that has always carried
     the second half of that push carries this one. Half the axis, and a
     quadrupling of the page, is not something you cross by accident; pinching
     back out is the same gesture backwards, and it clamps at 1x -- there is no
     zooming out of a page.

     THE FACTOR LAW CHANGED, AND IT IS LOGGED (the only change to what one word
     view does, and nothing is lost). The zoom ran 1 -> k over dx 0 -> 1 through
     a smoothstep, which puts EIGHT AND A HALF times reading size at the
     half-way mark on a k of 16 -- so with the threshold there, "zoom into the
     page" would have meant a page already far too big to read before one word
     ever opened. The law is now z = k^dx: the same two ends (1 at dx 0, k at
     dx +1), a constant zoom rate in between, and sqrt(k) at the gate -- four
     times reading size at k=16, which is a page you can still read and look
     around. WORD.curve bends it exactly as before, and WORD.law = "smooth" is
     the old curve, dialable from the tuner rather than deleted.                */
  const PINCH = {
    gate:   0.5,   // the dx at which one word begins -- levelOf's own boundary
    spread: 2.0,   // a further doubling of the pinch past the arrival opens +2
    assume: 16,    // the factor to reckon with before a word has been measured
    pan:    1,     // 1 = a drag pans the page held zoomed, 0 = it never does
    wheel:  0.01,  // ctrl+wheel (Chromium's own pinch): factor per px of deltaY
  };
  try{
    const saved = JSON.parse(localStorage.getItem("ttstv_pinch")||"null");
    if(saved) Object.keys(PINCH).forEach(k=>{ if(typeof saved[k]==="number") PINCH[k]=saved[k]; });
  }catch(_){}
  function setPinch(k, v){
    if(!(k in PINCH)) return PINCH[k];
    v = +v;
    // the gate may not be pushed past the level boundary: above 0.5 it would
    // hold the page at rest inside the band levelOf() already calls "word",
    // with one word's own chrome on and a whole page still on the screen.
    if(k === "gate") v = clamp(v, 0.05, 0.5);
    PINCH[k] = v;
    try{ localStorage.setItem("ttstv_pinch", JSON.stringify(PINCH)); }catch(_){}
    markPaint();
    return PINCH[k];
  }

  // ---- THE LAW, AND THE SAME LAW BACKWARDS. One function says what factor
  // the page is at for a place on the axis; the other says which place on the
  // axis a factor is. The pinch needs both -- it is handed a factor by the
  // fingers and has to put the axis where that factor lives -- and they must
  // be each other's inverse or a pinch would drift away from itself over a
  // long gesture. `arrivalFactor` is the k the arrival measured for THIS word,
  // held still for the length of one gesture so a measurement landing mid-pinch
  // cannot move the ground under it.
  let pinchK = 0;
  function arrivalFactor(){
    if(pinching && pinchK > 1) return pinchK;
    return (arrived && arrived.k > 1) ? arrived.k : PINCH.assume;
  }
  function factorAtDx(f, k){
    const K = (k > 1) ? k : arrivalFactor();
    const t = f <= 0 ? 0 : (f >= 1 ? 1 : (WORD.curve === 1 ? f : Math.pow(f, WORD.curve)));
    if(WORD.law === "smooth") return 1 + (t*t*(3-2*t))*(K - 1);
    return Math.pow(K, t);
  }
  function dxAtFactor(Z){
    const K = arrivalFactor();
    if(!(Z > 1) || !(K > 1)) return 0;
    if(Z >= K){
      // PAST THE ARRIVAL THE FACTOR STOPS MEANING MAGNIFICATION. +1 to +2 is
      // the SPACING opening -- the neighbours driven off the screen -- not more
      // zoom, and spreadPage is what draws it. So the last stretch is bought
      // with a further doubling of the pinch rather than measured in factors
      // the page never actually reaches.
      const t = Math.log(Z / K) / Math.log(Math.max(1.0001, PINCH.spread));
      return 1 + clamp(t, 0, 1);
    }
    let t;
    if(WORD.law === "smooth"){
      // smoothstep, inverted: e = 3t^2 - 2t^3  ->  t = 1/2 - sin(asin(1-2e)/3)
      const e = clamp((Z - 1) / (K - 1), 0, 1);
      t = 0.5 - Math.sin(Math.asin(clamp(1 - 2*e, -1, 1)) / 3);
    } else {
      t = Math.log(Z) / Math.log(K);
    }
    t = clamp(t, 0, 1);
    return WORD.curve === 1 ? t : Math.pow(t, 1 / WORD.curve);
  }
  // where the page actually is now, as a factor -- the number a pinch grows
  // from and the one the bench prints.
  function pinchLevel(){
    if(dx <= 0) return 1;
    if(dx <= 1) return factorAtDx(dx, arrivalFactor());
    return arrivalFactor() * Math.pow(Math.max(1.0001, PINCH.spread), clamp(dx - 1, 0, 1));
  }

  let wordSlideX = 0;         // a step's own lateral push, decayed per frame
  // The lifted-word overlay is gone (Osca: "NO LIFT"), and with it the element
  // it lived in, the highlight that hid the real word underneath it, and the
  // per-word measurements the transform needed. What you see zooming is the
  // page itself.

  // ---- the pull toward an off-screen word
  let pullFrom = 0, pullTo = null, pullT = 0, pullDur = 0, pullTick = 0;
  function startPull(to){
    if(!o.readerPane || WORD.pulltime <= 0) return;
    const from = o.readerPane.scrollTop;
    const d = Math.abs(to - from);
    if(d < 2) return;
    pullFrom = from; pullTo = to; pullT = 0; pullTick = inputTick;
    // root-of-distance: a word just off the edge arrives almost at once, one
    // half a book away takes noticeably longer but never minutes.
    pullDur = Math.max(6, Math.min(90, WORD.pulltime * Math.sqrt(d) / 12));
  }
  function stepPull(dt){
    if(pullTo == null || !o.readerPane) return;
    if(inputTick !== pullTick){ pullTo = null; return; }   // your own scroll wins
    pullT += (dt || 1);
    const t = Math.min(1, pullT / pullDur);
    // leverage: 1 is a straight line, higher takes more of the distance in
    // the first few frames and lands softer.
    const e = 1 - Math.pow(1 - t, Math.max(1, WORD.leverage));
    o.readerPane.scrollTop = pullFrom + (pullTo - pullFrom) * e;
    programmaticTop = o.readerPane.scrollTop;
    if(t >= 1){ o.readerPane.scrollTop = pullTo; programmaticTop = pullTo; pullTo = null; }
    markPaint();
  }

  // ====================== THE ZOOM IS THE WHOLE PAGE ========================
  // Osca, 6 September, having said it many times: "at +1 the ENTIRE reading
  // view -- every paragraph in view, the page as a whole -- scales by one
  // factor about the cursor word, no rewrap, no paragraph moves relative to
  // any other, nothing is lifted off the page, no transition that moves text
  // up; the word stays where it was on screen (scroll compensates) and the
  // page grows around it until the word reaches 'the most it may zoom'."
  //
  // What stood here until now grew the FONT of the word's own paragraph and
  // left every other paragraph at reading size. That is not a zoom of a page,
  // it is one paragraph re-set inside a page -- a word four hundred pixels
  // tall standing over lines of twenty-nine -- and it re-wrapped, which is how
  // it came to have a margin of its own at all.
  //
  // ONE FACTOR, ON ONE ELEMENT: css `zoom` on the reading column.
  //   * it is a LAYOUT zoom, not a layer: every used length in the subtree is
  //     multiplied, so the glyphs are laid out at their real size and stay
  //     sharp at any factor. That is also the answer to the Mac -- a scaled
  //     layer is what WebKit would not re-raster.
  //   * the column's own WIDTH is one of those lengths, so nothing re-wraps:
  //     measured in his Chrome, zoom:4 on #readercol with the percentage
  //     max-width out of the way gave chapter widths x4.0000, x4.0000,
  //     x4.0000 -- px, vw and rem alike -- and a paragraph's line count
  //     unchanged. (With max-width left in, the same test gave x1.3624 and
  //     heights of x10.7, x12.5, x14.0: the re-wrap, in numbers.)
  //   * nothing is written per paragraph. Not a font-size, not a width, not a
  //     transform, not an opacity. Every paragraph is carried by the one
  //     factor, which is exactly "no paragraph moves relative to any other".
  //
  // Two things do not scale, and they are the whole of the rest of this:
  // a percentage measured against something outside the zoom (page.css takes
  // .chapter's max-width off while it is on), and the scroller's own
  // scrollTop. The second one IS the compensation -- "the word stays where it
  // was on screen (scroll compensates)".
  let pageZ = 1;              // the factor now on the column
  let shiftX = 0;             // ...and the sideways offset that holds the word
  let anchor = null;          // where on the screen the word stays
  let spreadQ = -1, lastWgap = "", lastLgap = "";
  /* ============ THE MEASURE IS FROZEN FOR THE LENGTH OF THE ZOOM ==========
     Osca, 8 September: *"the +1 zoom is the whole page, nothing re-wraps."*

     `zoom` multiplies every LENGTH in the subtree, which is exactly why
     nothing re-wraps -- but the column's own width does not come from a
     length in the subtree. tokens.css: `--measure: calc(145px + 50vw)`, and a
     viewport unit is measured against the WINDOW, outside the zoom. Blink
     resolves it once at computed-value time and holds it: MEASURED here,
     headless Chromium at 402x874, chapter rect 346 -> 3642.88 at zoom
     10.5286, ratio 10.5286 exactly, and every paragraph's line count
     unchanged. That is the right answer -- but it is ONE engine's answer to a
     question this page should not be asking, and the book is read in
     WKWebView on the Mac and on the phone. "Nothing re-wraps" must not depend
     on which engine resolved a vw.

     So the three lengths `.chapter`'s width can come from are read ONCE,
     unzoomed, in px, and written on the column for exactly as long as the
     zoom is on. Inside the zoomed subtree they are then plain px -- the one
     kind of length every engine multiplies -- and the chapter is k times the
     width it had, by construction, in any browser. Three custom properties,
     one probe, once a visit; removed with the zoom.

     (It freezes the measure against a resize DURING the zoom, which is the
     right trade: a window resized mid-pinch re-wrapping the page under the
     word is the fault, not the fix.) */
  const MEASURED = ["--measure", "--box-lyric", "--box-verse"];
  let measureFrozen = false;
  function freezeMeasure(){
    const col = o.readerCol;
    if(measureFrozen || !col) return;
    measureFrozen = true;              // once a visit, whether or not it lands
    try{
      const doc = col.ownerDocument;
      if(!doc || !doc.createElement) return;
      const probe = doc.createElement("div");
      probe.style.cssText = "position:absolute;left:-99999px;top:0;height:0;"
        + "padding:0;border:0;visibility:hidden;pointer-events:none";
      col.appendChild(probe);
      const px = {};
      MEASURED.forEach(k => {
        probe.style.width = "var(" + k + ")";
        const w = probe.offsetWidth;
        if(w > 0) px[k] = w;
      });
      if(probe.remove) probe.remove();
      else if(probe.parentNode) probe.parentNode.removeChild(probe);
      Object.keys(px).forEach(k => col.style.setProperty(k, px[k].toFixed(2) + "px"));
    }catch(_){}
  }
  function thawMeasure(){
    const col = o.readerCol;
    measureFrozen = false;
    if(!col || !col.style) return;
    try{ MEASURED.forEach(k => col.style.removeProperty(k)); }catch(_){}
  }
  function writePageZoom(z, dx){
    const col = o.readerCol;
    if(!col) return;
    // BEFORE the first factor goes on, while the page is still its own size.
    freezeMeasure();
    pageZ = z; shiftX = dx;
    // `left` is a length INSIDE the zoomed subtree, so the browser multiplies
    // it by the same factor: to move the page dx on the screen, write dx/z.
    // (The gap is closed by measurement every frame in any case; getting this
    // right only means the correction lands in one frame instead of three.)
    col.style.setProperty("zoom", z.toFixed(5));
    col.style.setProperty("position", "relative");
    col.style.setProperty("left", (dx / z).toFixed(2) + "px");
    if(col.classList) col.classList.add("zoomed");
    if(o.readerPane && o.readerPane.classList) o.readerPane.classList.add("zoomed");
    markZoomedChapter();
  }
  // AND THE CHAPTER THE WORD IS IN STAYS RENDERED. content-visibility:auto
  // skips a section the browser decides is off screen -- and the zoom grows
  // this one until its own box is tens of thousands of pixels tall and mostly
  // is, whereupon every rect read off it comes back from
  // contain-intrinsic-size's placeholder instead of from the type. That is the
  // same lie the seat was built to survive, and here it would feed the closing
  // loop nonsense sixty times a second. One class, on one section, for exactly
  // as long as the zoom is on (page.css does the rest): it costs that
  // section's layout, never the book's, and it changes nothing you can see.
  let zoomedCh = null;
  function markZoomedChapter(){
    const el = sections()[wordChapterIdx] || null;
    if(el === zoomedCh) return;
    if(zoomedCh && zoomedCh.classList) zoomedCh.classList.remove("wordzoom");
    zoomedCh = el;
    if(el && el.classList) el.classList.add("wordzoom");
  }
  function clearZoomedChapter(){
    if(zoomedCh && zoomedCh.classList) zoomedCh.classList.remove("wordzoom");
    zoomedCh = null;
  }
  function clearPageZoom(){
    const col = o.readerCol, pane = o.readerPane;
    // COMING OUT IS A SCROLL TOO, and it has to be done BEFORE the factor
    // goes. The scroller's range is the zoomed one -- twelve times the book --
    // and the position it is holding is a position in that range; take the
    // zoom away and the same number is twelve times too far down, so the
    // browser clamps it to the end. Measured live on Blood Meridian: leaving
    // +1 put the reader on "Back matter." So the content the word was standing
    // on is put back under it, in the page's own units, first.
    if(col && pane && pageZ > 1.0001){
      const py = pane.getBoundingClientRect ? pane.getBoundingClientRect().top : 0;
      // THE POINT THE PAGE IS PUT BACK ABOUT HAS TO BE ON THE PAGE. It is a
      // viewport coordinate by construction, so anything outside the view is a
      // rect that lied (a section content-visibility had stopped rendering, a
      // word panned off the edge) and the middle of the pane is the honest
      // answer. Without this the subtraction below can go negative and the
      // reader is clamped to the top of the book.
      const mid = py + (pane.clientHeight || 0)/2;
      let at = anchor ? anchor.y : mid;
      if(!(at >= py - 2 && at <= py + (pane.clientHeight || 0) + 2)) at = mid;
      const content = pane.scrollTop + (at - py);
      const max = (pane.scrollHeight || 0)/pageZ - (pane.clientHeight || 0);
      let to = content/pageZ - (at - py);
      if(to < 0) to = 0;
      if(max > 0 && to > max) to = max;
      pane.scrollTop = to;
      programmaticTop = to;
      leaving = to;
    }
    pageZ = 1; shiftX = 0;
    clearZoomedChapter();
    thawMeasure();
    if(col){
      col.style.removeProperty("zoom");
      col.style.removeProperty("left");
      col.style.removeProperty("position");
      if(col.classList) col.classList.remove("zoomed");
    }
    if(o.readerPane && o.readerPane.classList) o.readerPane.classList.remove("zoomed");
    // ...AND THE PLACE HAS TO BE HELD WHILE THE BROWSER RELEARNS THE PAGE.
    // Taking the factor off is a size change of the whole column, and under
    // content-visibility a size change makes the browser throw away every
    // height it had learned: the column's total height collapses for a moment
    // and the scroll position is clamped against it. The same lie
    // commitReaderEdge already has holdOn() for, from the other direction --
    // and measured here, coming out of a pinch at 2.88x on the complete
    // Shakespeare, the reader went from 94,195 to 0. The cover. The number
    // above is right; it just has to be re-asserted until the heights are back.
    if(leaving != null){ holdTop(leaving); leaving = null; }
  }
  // Pin the scroller to one place for a few frames, abandoning the moment
  // there is any input of the reader's own. holdOn()'s own shape, against an
  // absolute position rather than a section -- there is no section to hold to
  // here, because what moved is every height in the column at once.
  let leaving = null;
  function holdTop(want){
    const pane = o.readerPane;
    if(!pane) return;
    const mine = inputTick;
    let tries = 0, stable = 0;
    const step = () => {
      if(!o.readerPane || inputTick !== mine) return;
      if(Math.abs(pane.scrollTop - want) > 1){ pane.scrollTop = want; stable = 0; }
      else stable++;
      programmaticTop = pane.scrollTop;
      if(stable < 4 && ++tries < 45) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // ---- WHERE THE WORD IS, RIGHT NOW. One rect, off the live page.
  function wordRectNow(){
    const r = currentWordRange();
    if(!r) return null;
    const rects = r.getClientRects ? r.getClientRects() : null;
    const b = rects && rects.length ? rects[0] : r.getBoundingClientRect();
    return (b && b.width > 0) ? b : null;
  }
  // ---- +2: THE SPACING, ON THAT ZOOMED PAGE. Osca: "+2 is spacing on that
  // zoomed page: words driven apart, lines driven apart, the line it came from
  // at the foot -- no other change." So it goes on the COLUMN, like the zoom:
  // one declaration, every paragraph in view, nothing singled out.
  //
  // It is still held back to the last stretch -- "ALL I want is for the page to
  // zoom in completely, THEN continue the animation" -- so the page is already
  // empty of everything but the word by the time anything moves.
  function spreadPage(f){
    const col = o.readerCol;
    if(!col) return;
    const e = f <= 0 ? 0 : (f >= 1 ? 1 : f*f*(3-2*f));
    if(e <= 0){ clearSpread(); return; }
    if(col.classList) col.classList.add("spreading");
    const g = spreadGaps();
    // in eighths: a re-flow per step of the gesture, not per frame. The
    // QUANTISER IS ON THE GESTURE, NOT ON THE NUMBERS -- gating the write on q
    // alone meant a slider moved while position +2 was open changed nothing at
    // all, because q had not moved, which is the sort of dead control this
    // bench exists to catch.
    const q = Math.round(e * 8) / 8;
    spreadQ = q;
    const wv = (g.w * q).toFixed(2) + "px", lv = (g.l * q).toFixed(3);
    if(wv !== lastWgap || lv !== lastLgap){
      lastWgap = wv; lastLgap = lv;
      col.style.setProperty("--wgap", wv);
      col.style.setProperty("--lgap", lv);
    }
  }
  // HOW FAR IS NOT A TASTE SETTING -- position +2 means one word and nothing
  // else, so the gap is whatever actually clears the screen at the zoom this
  // word arrived at. Both numbers are lengths INSIDE the zoomed page, so what
  // has to clear the screen is divided by the factor that will multiply it.
  // The sliders are what they say: the gap GROWS BY them.
  function spreadGaps(){
    const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    const z = Math.max(1, pageZ);
    const w = ((arrived && arrived.w) || 20) * z;      // the word, on the screen
    const h = ((arrived && arrived.h) || 20) * z;
    const f = Math.max(1, (arrived && arrived.base) || 16);   // the page's own type
    return { w: (vw/2 + w/2)/z + WORD.wordgap,
             l: (vh/2 + h/2)/z/f - 1.5 + WORD.linegap };
  }
  function clearSpread(){
    const col = o.readerCol;
    spreadQ = -1; lastWgap = ""; lastLgap = "";
    if(!col) return;
    if(col.classList) col.classList.remove("spreading");
    col.style.removeProperty("--wgap");
    col.style.removeProperty("--lgap");
  }
  function clearWordZoom(){
    clearSpread(); clearPageZoom();
    anchor = null; arrived = null; wordSlideX = 0;
    // the last pane goes with it -- the line to zero and the rail's presses
    // back to the page: a strip across the foot of the reading page that still
    // took a pointer would be a control nobody can see swallowing every press
    // aimed at a word. (wordpane.js's own clear(); this file does not know how
    // it is drawn.)
    if(wordPane) wordPane.clear();
    if(o.readerBox){
      o.readerBox.style.transformOrigin = "";
      writeReaderTransform();
      if(o.readerBox.style.opacity) o.readerBox.style.opacity = "";
    }
    if(o.readerCol && o.readerCol.style.transform){   // anything an older build left behind
      o.readerCol.style.transform = "";
      o.readerCol.style.transformOrigin = "";
    }
  }

  // ---- THE ARRIVAL: the state one word view is always going to.
  //
  // Osca: "there is still no defined END POINT... Make a one word view -
  // arrived. That should always be the same." It is three measured numbers and
  // a place:
  //     k     the factor that makes the word WORD.fill of the width (or fillH
  //           of the height, whichever binds), capped at WORD.maxzoom -- "the
  //           most it may zoom"
  //     w, h  the word's own untouched box, which is what the +2 gaps are
  //           worked out against
  //     base  the page's own type, off the cascade, for the leading
  // and `anchor`, set once per visit: the point on the screen the word stays
  // at while the page grows around it.
  //
  // All of it is measured with the zoom and the spacing OFF -- otherwise the
  // factor is worked out against a page that is already multiplied, and it
  // compounds.
  // the type the page is actually set in, read off the cascade rather than
  // guessed at -- the leading at +2 is a multiple of it. Headless there is no
  // cascade, and a range's own height is page.css's 1.5 leading, so that is
  // the fallback.
  function fontBase(el){
    let px = NaN;
    try{
      const d = el && el.ownerDocument && el.ownerDocument.defaultView;
      if(d && d.getComputedStyle) px = parseFloat(d.getComputedStyle(el).fontSize);
      else if(typeof getComputedStyle === "function") px = parseFloat(getComputedStyle(el).fontSize);
    }catch(_){}
    return px > 0 ? px : 0;
  }
  let arrived = null;
  function computeArrived(){
    const col = o.readerCol;
    if(!col || !o.readerPane) return null;
    // NOT WHILE THE SEAT IS STILL WORKING. Two hands on the same scroller --
    // one bringing the reader to the word, one holding the word still -- is
    // how the page ran 253,000px away from it, measured live: the seat had not
    // finished, the arrival was taken about a point that was still moving, and
    // the closing loop then chased a rect that never answered.
    if(seating) return null;
    const had = {
      z: col.style.getPropertyValue("zoom"),
      l: col.style.getPropertyValue("left"),
      w: col.style.getPropertyValue("--wgap"),
      g: col.style.getPropertyValue("--lgap"),
      s: col.classList ? col.classList.contains("spreading") : false,
    };
    const put = (k, v) => { if(v) col.style.setProperty(k, v); else col.style.removeProperty(k); };
    const putBack = () => {
      put("zoom", had.z); put("left", had.l);
      put("--wgap", had.w); put("--lgap", had.g);
      if(col.classList){
        if(had.s) col.classList.add("spreading"); else col.classList.remove("spreading");
      }
      spreadQ = -1; lastWgap = ""; lastLgap = "";   // those writes bypassed the quantiser
    };
    col.style.removeProperty("zoom"); col.style.removeProperty("left");
    col.style.removeProperty("--wgap"); col.style.removeProperty("--lgap");
    if(col.classList) col.classList.remove("spreading");
    const a = wordRectNow();
    if(!a){ putBack(); return null; }

    // THE WORD HAS TO BE ON THE SCREEN BEFORE THERE IS AN ARRIVAL. A page
    // grown about a point that is not in the view puts everything visible off
    // the edge of it. The seat brings the reader to the word (scrollIntoView
    // and then the gap closed frame by frame, because a chapter nobody has
    // visited reports the placeholder's numbers and not its own), and the
    // arrival is worked out on a later pass.
    const vh0 = window.innerHeight || 1;
    if(a.bottom < 8 || a.top > vh0 - 8){
      if(!seating) seatOnWord();
      putBack();
      return null;
    }

    const vw = window.innerWidth || 1;
    const w0 = a.width, h0 = a.height;        // untouched: the page is at rest
    // WHAT THE WORD IS MEASURED AGAINST. The view, on a desk; the SHORT side of
    // it on a phone, so that turning the phone over does not re-set the type
    // (WORD.shortside, above). In portrait the short side IS the width, so the
    // first term is unchanged there and only the height cap tightens.
    const S = Math.min(vw, vh0);
    const phone = S <= WORD.shortside;
    const wRef = phone ? S : vw, hRef = phone ? S : vh0;
    const k = Math.max(1, Math.min(WORD.maxzoom,
                Math.min(WORD.fill*wRef/Math.max(1,w0), WORD.fillH*hRef/Math.max(1,h0))));
    // WHERE THE WORD STAYS. The first word of a visit sets it -- "the word
    // stays where it was on screen" -- and every word after it arrives at that
    // same place, which is what reading on inside the zoom looks like.
    if(!anchor) anchor = { x: a.left + a.width/2, y: a.top + a.height/2 };
    const out = { k, w: w0, h: h0, base: fontBase(col) || h0/1.5 };
    putBack();
    return out;
  }

  /* ============ THE LINE THE WORD CAME OUT OF ==============================
     Osca: "I need a small subtitle in the final pane of the one word view, so
     give me the lines floating in the page, larger than the one view."

     The last pane is the word and nothing else, which is the whole point of it
     -- and the one thing it costs you is where the word was standing. So the
     line it came out of floats over the page underneath it: small type, wide
     measure (wider than the word by a long way, which is the "larger"), the
     word itself in the ink colour and the rest of the line dimmed.

     FLOATING, NOT LIFTED. It is not a copy of the paragraph pulled off the
     page -- the page below is untouched, still zoomed, still the real thing.
     This is a caption fixed to the viewport at its own size, so it stays
     legible at any zoom and does not grow with the type.

     It belongs to the LAST pane alone: it fades in with that pane's own
     progress (dx 1 -> 2) and is not there at all before it. */
  /* ONE DOOR TO THE CURSOR, and now two things come through it. `goTo` was
     the only way to put the cursor somewhere it had not walked to; the
     subtitle's rail is the second, and it must not be a second copy of what
     goTo does -- that is exactly how the zoom came to be left behind by goTo
     in the first place (22c ss6.2: the cursor moved, the zoom stayed on the
     word it had arrived at, 0 transform changes over 54 advances). So the body
     is here, once, and both call it.

     `seat` is the one difference between them: a rail is a place you are
     DRAGGING to and the page has to follow under your thumb, so it seats;
     goTo is a call from outside (a voice engine following along) and seating
     the reader under it would fight whatever else that engine is doing.  */
  function jumpTo(ch, wi, why, seat){
    if(!book || !book.chapters || !book.chapters[ch]) return null;
    if(ch !== wordChapterIdx){
      wordChapterIdx = ch;
      wordWords = wordsOf(book.chapters[ch]);
      wordDomIndex = buildWordDomIndex(ch);
    }
    wordIdx = clamp(+wi||0, 0, Math.max(0, wordTotal()-1));
    /* AND THE ZOOM GOES WITH IT. stepWord throws away the word's own
       measurement when it moves -- `arrived`, the fixed state one word view
       is travelling to -- so the next frame measures the new word. goTo did not, so the cursor and the highlight
       moved on while the zoom stayed on whatever word it had arrived at:
       reader 22c measured 0 transform changes over 54 advances, where stepping
       by hand goes scale(7.4874) -> scale(14.3622). A jump has no direction,
       so it takes no lateral slide -- that part of stepWord is about reading
       ON, not about arriving somewhere. */
    arrived = null; wordSlideX = 0;
    if(wordPane) wordPane.forget();
    setCursor(ch, wordIdx, why || "goTo");
    paintWordHighlight(); markPaint();
    if(seat) seatOnWord();
    return {chapter:ch, word:wordIdx};
  }

  /* ============ THE LAST PANE IS ITS OWN ASSET ==========================
     Osca, 6 September: "THE LAST PANE IS ITS OWN ASSET: the one-word pane (far
     right, sleeps, scrubs, sideways) becomes its own file pair --
     design/reader/wordpane.css + wordpane.js -- mounted by book-nav.js, not
     written inside shell.css/book-nav.js."

     So the line the word came out of, the rail under it, and the rule about
     when it sleeps are all wordpane.js's now, and its look is wordpane.css's.
     What stays here is the only thing that cannot leave: WHICH word. There is
     one cursor in this file and the pane is handed four questions about it --
     where along the book it is, what its line says, whether that has changed,
     and how long to wait before sleeping -- plus one instruction, what to do
     when the rail is dragged. It never learns what a book is.

     It is mounted on `o.bookEl`, beside the reading box and never inside
     #readercol, so the zoom (a css `zoom` on the column) cannot touch it: at
     +2 it is a separate layer over the zoomed page, which is what Osca asked
     for and what the pane's own rect proves. */
  let wordPane = null;
  function pane(){
    if(wordPane) return wordPane;
    if(!(typeof window !== "undefined" && window.WordPane)) return null;
    const host = o.bookEl || (o.readerBox && o.readerBox.parentNode) || null;
    if(!host) return null;
    wordPane = window.WordPane.mount({
      host,
      repaint: markPaint,
      sleep: () => WORD.subsleep,
      fraction: subFraction,
      seek: subSeek,
      key: () => wordChapterIdx + ":" + wordIdx,
      line(){
        const w = wordDomIndex[wordIdx];
        const text = w && w.p ? (w.p.textContent || "") : "";
        if(w && text) return { before: text.slice(0, w.start),
                               word: text.slice(w.start, w.end),
                               after: text.slice(w.end) };
        return { before: "", word: wordTextAt(wordIdx) || "", after: "" };
      },
    });
    return wordPane;
  }
  /* where along the book the cursor is, 0..1 -- chapters, then the word's own
     place inside its chapter, which is what makes the rail move smoothly while
     you read on rather than in 865 jumps */
  function subFraction(){
    const n = (book && book.chapters && book.chapters.length) || 0;
    if(!n) return 0;
    const total = Math.max(1, wordTotal());
    const within = total > 1 ? clamp(wordIdx/(total-1), 0, 1) : 0;
    return clamp((wordChapterIdx + within) / n, 0, 1);
  }
  /* ...and the same arithmetic backwards. One chapter's share of the rail is
     one chapter, however long it is -- the reader's own scrub places its marks
     by height instead, and that is right for a page you are scrolling and
     wrong for a cursor you are placing: on the complete Shakespeare a chapter
     is 1/865th of this rail whether it is a sonnet or Hamlet, so every play is
     reachable with the same flick. */
  function subSeek(f){
    const n = (book && book.chapters && book.chapters.length) || 0;
    if(!n) return null;
    const t = clamp(f, 0, 1) * n;
    const ch = Math.min(n - 1, Math.max(0, Math.floor(t)));
    const u = clamp(t - ch, 0, 1);
    if(ch !== wordChapterIdx){
      wordChapterIdx = ch;
      wordWords = wordsOf(book.chapters[ch]);
      wordDomIndex = buildWordDomIndex(ch);
    }
    const total = Math.max(1, wordTotal());
    return jumpTo(ch, Math.round(u * (total - 1)), "subscrub", true);
  }
  function wakeSub(){ const p = pane(); if(p) p.wake(); else markPaint(); }
  function setPlaying(on){ const p = pane(); return p ? p.playing(on) : !!on; }
  function paintWordSub(f){ const p = pane(); if(p) p.paint(f); }

  let spreadNow = 0;
  let lastDy = Infinity, stuckY = 0;   // the closing loop's own progress
  function updateWordZoom(wordF){
    if(!o.readerCol) return;
    if(wordF <= 0){ clearWordZoom(); return; }

    // ---- INSIDE THE PINCH'S OWN BAND THE PAGE IS FREE, AND THE ANCHOR
    // FOLLOWS. Below the gate the page is a page you are looking around --
    // scrolled, panned, read -- and the loop at the foot of this function
    // exists to hold ONE word perfectly still, which is the opposite thing. So
    // while the factor is not actually changing, the anchor is moved to
    // wherever the word now IS: every correction below then comes out zero,
    // the scroller and the pan are yours, and the instant the pinch moves
    // again the hold is back with the word exactly where the pan left it.
    //
    // ONLY A RECTANGLE THAT IS ON THE SCREEN, though. `anchor` is a point on
    // the VIEWPORT, and a word panned out of the view -- or one whose section
    // content-visibility has stopped rendering -- answers with a box that is
    // nothing of the kind: measured after a pan of -450px, anchor.y 177,984,
    // which clearPageZoom then subtracted from the position it was putting the
    // reader back at, sending the reader to 0. The cover.
    //
    // AND WHAT YOU HAVE PANNED TO IS WHAT YOU ARE LOOKING AT. When the word
    // really has gone off the screen, the page is not pointing at anything you
    // can see -- the next pinch would haul it back, and one word view would
    // open on a word from before the pan. The word in the middle of what is on
    // the screen NOW takes over. It is done HERE, once a frame, and not inside
    // panBy: a burst of drags between two frames would otherwise re-choose a
    // word per drag, against rects from before the drag before it (measured:
    // a 200-drag burst moved the reader 61,626px, because one of those choices
    // landed on a word already off screen and the arrival SEATED to it).
    if(pinchHold && !pinching){
      const f = wordRectNow(), vh = window.innerHeight || 0, vw = window.innerWidth || 0;
      const on = f && f.width > 0 && f.bottom > 0 && f.top < vh && f.right > 0 && f.left < vw;
      // A RECT THAT IS MERELY JUST OFF THE SCREEN IS STILL A RECT. Within a
      // couple of viewports it is the word's real box and the anchor may
      // follow it out of view, which is what stops the hold hauling the page
      // back while you are still panning; beyond that it is a lie (a section
      // content-visibility has stopped rendering answers in the tens of
      // thousands) and nothing is written from it.
      const sane = f && f.width > 0 && Math.abs(f.top) < vh*3 && Math.abs(f.left) < vw*3;
      if(on || (sane && pinchHold)) anchor = { x: f.left + f.width/2, y: f.top + f.height/2 };
      if(!on){
        const hit = wordUnder(Math.round(vw/2), Math.round(vh/2));
        if(hit && (hit.ch !== wordChapterIdx || hit.wi !== wordIdx)){
          wordIdx = hit.wi;
          setCursor(hit.ch, hit.wi, "pan");
          paintWordHighlight();
          // ONLY THE ANCHOR MOVES. `arrived` is NOT thrown away, and that is
          // the whole of what stops this being a page that bolts: computeArrived
          // measures the word with the zoom taken OFF, which only tells the
          // truth while the scroller is in the page's own units -- at rest. Ask
          // it in the middle of a zoom and the browser clamps the scroll to the
          // unzoomed height for the length of the measurement, the word reads
          // as off the screen, and the arrival answers by SEATING to it.
          // Measured on the complete Shakespeare, one drag: seating true and
          // stuck, k 0, and the reader 271,760 -> 94,030. The factor on the
          // page is a function of the k already in hand, so keeping it is also
          // what makes the re-anchor invisible; the new word's own arrival is
          // measured the next time the page is genuinely at rest.
          const nb = wordRectNow();
          if(nb && nb.width > 0) anchor = { x: nb.left + nb.width/2, y: nb.top + nb.height/2 };
        }
      }
    }

    if(!arrived){ arrived = computeArrived(); lastDy = Infinity; stuckY = 0; }
    // AND THE GESTURE ADOPTS THE MEASUREMENT THE MOMENT THERE IS ONE. beginPinch
    // measures the word it is starting on, but there are states where it cannot
    // -- the reader still settling from a chapter jump, a section the browser
    // has not laid out yet -- and it falls back to PINCH.assume. Left there for
    // the length of the gesture, the fingers and the page would be reckoning in
    // two different k's: measured on a 393x852 phone, where the arrival is
    // 10.935 and the assumption 16, a pinch to 1.25x wrote 1.21 and the first
    // two steps of the gesture wrote nothing at all. What is on the screen is
    // factorAtDx(dx, arrived.k) either way, so adopting it moves nothing --
    // only the mapping from how far apart the fingers are, and only once.
    if(pinching && arrived && arrived.k > 1) pinchK = arrived.k;
    if(!arrived || !anchor) return;

    // ONE LAW, AND IT IS NOT WRITTEN TWICE. factorAtDx is what the pinch
    // inverts to find its place on the axis, so the number it returns is the
    // number this writes -- the two can never disagree about where the page is.
    const z  = factorAtDx(wordF, arrived.k);
    writePageZoom(z, shiftX);
    // POSITION +2'S OWN PROGRESS, QUANTISED -- AND IT MAY NOT START UNTIL +1
    // IS ACTUALLY ARRIVED AT. Osca, 8 September: *"the word-parting/spacing
    // must be strictly the +2 step and must NEVER reflow the +1 zoom."*
    // `spreadF` is clamp(dx - 1, 0, 1) already, so this is a second lock on
    // the same door rather than a new rule -- but the spacing is a
    // word-spacing on the COLUMN and it re-wraps every line it touches, so it
    // is the one thing on this page that must never be able to leak below the
    // arrival by a rounding, a stale frame or a driver yet to be written.
    spreadPage(wordF >= 1 ? spreadNow : 0);

    // ---- AND THE WORD DOES NOT MOVE. One rect a frame, and the gap between
    // where the word IS and where it stays is closed: sideways on the column's
    // own offset, vertically on the scroller -- which is the "scroll
    // compensates" of the definition, and the reason no text ever travels up
    // the screen while the page grows. Nothing is predicted: a page this size
    // under content-visibility is not something arithmetic gets right twice,
    // and both ends are fixed points (e=0 the page exactly as it was, e=1 the
    // word at the same place k times bigger), so it cannot drift.
    // ---- AND INSIDE THE PINCH'S OWN BAND THE PAGE IS FREE. Below the gate
    // the page is a page you are looking around -- scrolled, panned, read --
    // and the loop below exists to hold ONE word perfectly still, which is the
    // opposite thing. So while the factor is not actually changing, the anchor
    // FOLLOWS the word rather than holding it: every correction below then
    // comes out zero, the scroller and the pan are yours, and the instant the
    // pinch moves again the hold is back, with the word exactly where the pan
    // left it. (The anchor is a point on the SCREEN, so this is the whole of
    // what "let go of it" means -- nothing is cleared and nothing re-measured.)
    const b = wordRectNow();
    let moved = false, heldSide = false;
    if(b && b.width > 0 && !seating){
      // a step's own lateral push, so reading on reads as the words moving
      // sideways past a fixed point rather than one word blinking into another
      const dx = (anchor.x + wordSlideX) - (b.left + b.width/2);
      if(Math.abs(dx) > 0.5){ writePageZoom(z, shiftX + dx); moved = true; heldSide = true; }
      const dy = (b.top + b.height/2) - anchor.y;
      // AND IT GIVES UP RATHER THAN CHASING. If the gap stops shrinking, the
      // thing being measured is not answering -- a section still skipped, a
      // rect that is contain-intrinsic-size's and not the type's -- and a
      // correction applied every frame to a number that never moves is a
      // runaway: 253,000px of one, live, before this went in.
      if(Math.abs(dy) >= Math.abs(lastDy) - 0.5){ if(++stuckY > 3) stuckY = 99; }
      else stuckY = 0;
      lastDy = dy;
      if(Math.abs(dy) > 0.5 && stuckY < 99 && o.readerPane){
        const max = (o.readerPane.scrollHeight || 0) - (o.readerPane.clientHeight || 0);
        let to = o.readerPane.scrollTop + dy;
        if(to < 0) to = 0;
        if(max > 0 && to > max) to = max;
        o.readerPane.scrollTop = to;
        programmaticTop = to;
        moved = true;
      }
    }
    // THE PAN'S NOUGHT POINT IS WHEREVER THE HOLD IS STANDING. Not zero: the
    // offset that keeps an off-centre word under the anchor is routinely
    // further across than the whole pan budget (measured: shiftX -1475 against
    // a budget of 317), and clamping a pan against zero then yanks the page
    // back the moment you touch it. So it tracks every write the HOLD makes --
    // while the fingers are pinching, and on any frame the closing loop moved
    // the page sideways itself -- and freezes for the pans, which are the only
    // other thing that writes it. Panning is then a budget either way from
    // wherever the zoom actually left the page, which is what it means.
    if(pinching || heldSide) panBase = shiftX;
    if(wordSlideX){
      wordSlideX *= WORD.decay;
      if(Math.abs(wordSlideX) < 0.5) wordSlideX = 0;
      moved = true;
    }
    // ...and the closing loop needs another frame to close in. It asks for one
    // only while something is still moving, so a page at rest costs nothing.
    if(moved) markPaint();
  }

  // ---------------------------------------------------------------- THE
  // TWO SCREENS -- dashboard, or an open book. No title screen any more:
  // chapter zero's own tinted opener slide, inside the reader, is the
  // cover ("that page SHOULD be the purple one").
  function showScreen(next){
    screen=next;
    if(o.dashboardEl) o.dashboardEl.classList.toggle("open", screen==="dashboard");
    if(o.bookEl) o.bookEl.classList.toggle("open", screen==="open");
  }

  function openBook(bk){
    focusPath=null; programmaticTop=null; lastGoodLevels=null; lastGoodPath=null; heldDepth=0;
    book=bk; dx=0; dxVel=0; dxInput=0; dxIdle=0; wordWasOn=false; exitAccum=0;
    pinching=false; pinchHold=false; pinchEntering=false; pinchK=0; pinchFrom=1;
    wheelPinch=false; tp=null; panFrom=null; panBase=0;
    exitWord();
    chIndexById = new Map((book.chapters||[]).map((c,i)=>[c.id,i]));
    destroyPane(1); destroyPane(2);      // a previous book's own deeper panes, if any
    if(readerPage){ o.readerPane.scrollTop=0; readerPage.render(book); }
    /* AFTER the page, never before: the rail measures the chapters the page has
       just laid out, and a rail built against the previous book's DOM is the
       "wrong chapter names on the bar" bug in its purest form. */
    if(readerRail) readerRail.render(book);
    invalidateSections(); applyOffscreenSkip(); curChapterIdx=0; readerFloor=0;
    loadCursor();                    // where this book was last left
    if(cursor && book.chapters && book.chapters[cursor.ch]){
      wordChapterIdx = cursor.ch;
      wordWords = wordsOf(book.chapters[cursor.ch]);
      wordDomIndex = buildWordDomIndex(cursor.ch);
      wordIdx = clamp(cursor.wi, 0, Math.max(0, wordTotal()-1));
      paintWordHighlight();
    }
    markPaint();
    levelsCache = computeLevels(0);
    markLiveCard(book.slug);
    if(o.big) o.big.textContent = book.title||"";
    if(o.small) o.small.textContent = book.author||"";
    showScreen("open");
    applyDx(true);
  }
  // Everything applyDx() writes as an inline style or a class, put back.
  // applyDx early-returns on `!book || screen!=="open"`, so the moment
  // closeToLibrary() sets book=null nothing can ever clean up after it, and
  // the last frame the book was open leaves its own state behind for good.
  // What that cost: #readerbox keeps `pointer-events:auto`, and although
  // #book itself is opacity:0 with pointer-events:none, a DESCENDANT that
  // re-enables hit-testing overrides an ancestor's `none` -- so an invisible
  // reader at z-index 3 sat on top of the library at z-index 1 and swallowed
  // every click on a book card. Confirmed by elementFromPoint at a card's own
  // centre returning the reader's `.opener`, and by a real mouse click on a
  // card doing nothing at all. Osca's own words: "once I get to library, I
  // have to reload to get back to the book" -- the library was never broken,
  // it was covered.
  function resetReaderChrome(){
    clearWordZoom();
    if(o.readerBox){
      o.readerBox.style.left=""; o.readerBox.style.pointerEvents="";
      readerShift=0; readerScale=1; readerRestLeft=0; lastPush=-1;
      o.readerBox.style.transform="";
    }
    if(o.readerHead) o.readerHead.style.opacity="";
    if(o.readerScrub) o.readerScrub.style.opacity="";
    for(let i=0;i<MAX_LEFT_LEVELS;i++){
      const p=leftPanes[i];
      if(p && p.el){ p.el.style.left=""; p.el.style.opacity=""; p.el.style.pointerEvents=""; }
    }
  }
  // LEAVING THE BOOK. Osca: "Can you please link this to the new library
  // .html please, reload the page if I come out" -- and then: "get rid of the
  // old library."
  //
  // The library used to be a screen inside this page, sitting behind the
  // reader with a whole shelf's worth of cards built at mount. It is its own
  // page now (bench-library.html), so coming out of a book LEAVES: the reader is
  // torn down first, then the host takes over and navigates. That is also
  // what makes it fresh every time -- a real load, reading a manifest that
  // may have gained books since you last looked. Without an onLibrary the
  // old behaviour stands, so nothing else that mounts this is broken by it.
  function closeToLibrary(){
    exitWord();
    for(let i=1;i<MAX_LEFT_LEVELS;i++) destroyPane(i);   // every deeper pane, not just two
    resetReaderChrome();
    book=null;
    dx=0; dxVel=0; dxInput=0; dxIdle=0; exitAccum=0;
    pinching=false; pinchHold=false; pinchEntering=false; pinchK=0; pinchFrom=1;
    wheelPinch=false; tp=null; panFrom=null; panBase=0;
    swipeDrop();
    lastGoodLevels=null; lastGoodPath=null; heldDepth=0; focusPath=null;
    showScreen("dashboard");
    if(o.onLibrary) o.onLibrary();
  }

  // ---------------------------------------------------------------- THE
  // DEPTH ITSELF
  // THREE SLIDES TO THE RIGHT OF NOTHING. Osca: "main slide is main book
  // reader, second slide is word zoomed in on page, centred, third (also
  // going right in the arrows) is JUST that word, no other words, JUST one
  // word, centred, same thing, just nothing else."
  //
  //     dx  0 : the book
  //     dx +1 : that word, zoomed, ON the page -- the page still around it
  //     dx +2 : that word, and nothing else -- the neighbours pushed out
  //
  // The two halves are the two things the view does, one to a slide: the zoom
  // between 0 and 1, the spacing between 1 and 2. Nothing re-flows before you
  // ask for it, and each slide is a place you can stop.
  const DX_MAX = 2;
  function setDx(v){ dx=clamp(v,-currentMaxLeft(),DX_MAX); }
  function levelOf(v){ return v<=-0.5?"contents":(v>=0.5?"word":"reader"); }
  function dxTargets(){ return positions(); }

  // POSITIONS. Osca: "NOT three slides - but POSITIONS - - RIGHT now, I can
  // use the arrow keys to switch 'positions' it is actually the best way to
  // build."
  //
  // So the axis is not a scroll with stops sprinkled on it; it is a short
  // list of PLACES, and everything -- the arrows, the snap, the trackpad's
  // rest -- moves between them. Written out, deepest pane on the left:
  //
  //     -n .. -1  the contents panes, one position each
  //          0    the book
  //         +1    that word, zoomed, on the page
  //         +2    that word alone
  //
  // positions() is the whole list, in order, and it is the single source of
  // truth: how many panes this book's trail actually has decides the left
  // end, DX_MAX decides the right.
  function positions(){
    const m = currentMaxLeft(), t = [];
    for(let i = m; i >= 1; i--) t.push(-i);
    for(let i = 0; i <= DX_MAX; i++) t.push(i);
    return t;
  }
  // where we are now, as a position: the nearest one to the axis
  function posNow(){
    const t = positions();
    let best = t[0];
    for(const p of t) if(Math.abs(p - dx) < Math.abs(best - dx)) best = p;
    return best;
  }
  // the next position along, in the given direction, from wherever the axis
  // is standing -- a half-open move (dx = 0.4, pressing right) lands on 1,
  // not back on 0, so a key never feels like it did nothing.
  function posStep(dir){
    const t = positions();
    if(dir > 0){ for(const p of t) if(p > dx + 1e-6) return p; return t[t.length-1]; }
    for(let i = t.length-1; i >= 0; i--) if(t[i] < dx - 1e-6) return t[i];
    return t[0];
  }
  // move to a position: the axis goes there and the gesture state is cleared,
  // so the spring is carrying it and nothing is still pushing.
  function goPos(p){ setDx(p); dxVel = 0; dxInput = 0; detent = false; pinchHold = false; snapCancel(); }

  /* ================== ONE PUSH ON THE AXIS, AND ONE ONLY ==================
     Osca, 8 September: *"the phone reader navigates panes the SAME way the
     Mac does ... Reuse the Mac's logic; do not reinvent a gesture."*

     Everything the sideways wheel did to dx used to live inside the wheel
     handler, so a second driver could only ever be a COPY of it -- and a copy
     is where "the same, except" comes from. It is one function now, in dx's
     own units, and the wheel is its first caller rather than its owner. What
     it holds is the whole of the axis's grammar and nothing else:

       * the pinch's rest point is over the moment the axis is pushed;
       * inside one word view a push only LEAVES the view (the reading is on
         the other axis), so there is no exit gate to consider;
       * past the deepest pane this book's own trail actually has, a
         DELIBERATE push -- EXIT_PUSH's worth, not one tick -- goes back to
         the library, and anything short of it is not an exit and re-arms.

     THE GATE IS MEASURED IN dx, NOT IN PIXELS, and that is the only change to
     the wheel: `EXIT_PUSH * T.gain` is exactly what `EXIT_PUSH` px of wheel
     becomes after `deltaX * T.gain`, so for the wheel the threshold is the
     same number it always was, at any T.gain (both sides scale together, so
     the comparison is the identical one). A driver whose input is not px of
     wheel -- a finger on glass -- can then mean the same thing by it: "as far
     as the axis would have travelled", not "as many pixels as a trackpad
     would have sent".

     Returns what it did, so a driver can tell a push that landed from one the
     gate swallowed. */
  function axisPush(d){
    pinchHold = false;
    /* ============ ONE WORD IS THE PINCH'S, AND ONLY THE PINCH'S ===========
       Osca, 8 September: *"one-word is PINCH ONLY ... a drag from the right
       must do nothing toward one-word."*

       The push and the pinch had both been driving the same dx, so a sideways
       swipe ran the whole word axis -- and because a push carries momentum it
       did not stop at +1 either. MEASURED, this file, headless Chromium at
       402x874: ONE sixty-tick sideways wheel took dx 0 -> 2, which puts
       word-spacing 143.73px on the column and re-wraps every paragraph in the
       book (line counts 8,4,4,4,... -> 33,16,11,17,...) WHILE the page is
       still visibly zooming. That is the re-wrap in the screen recording, and
       this is the half of it that is a gesture rather than a stylesheet.

       So the axis is cut in two at 0. Everything at and below it -- the panes,
       the book, the library, the deliberate push out -- is the push's, exactly
       as it was and untouched. Everything above it is the pinch's. A push may
       still travel DOWN out of the word (that is the way home, and it has to
       stay) and it may still close a pane back toward the book; what it may
       never do is cross 0 upward. stepDx holds the same line against the
       momentum of a push already made, which is the other half of this rule. */
    if(d > 0 && dx >= -DX_REST){ exitAccum = 0; return "held"; }
    if(levelOf(dx) === "word"){ dxInput += d; return "word"; }
    if(dx <= -currentMaxLeft() && d < 0){
      exitAccum += -d;
      if(exitAccum > EXIT_PUSH * T.gain){ closeToLibrary(); exitAccum = 0; return "library"; }
      return "gate";
    }
    exitAccum = 0;
    dxInput += d;
    return "push";
  }

  // ONE WRITER FOR THE READER'S OWN TRANSFORM -- and since 6 Sep the panes'
  // push is the only thing left on it.
  //
  // The word zoom used to add scale() here, and reader 25 measured what that
  // actually is: at scale(16) the zoomed paragraph is STILL SET IN 26.818px,
  // blown up sixteen times by the compositor. WebKit does not re-raster that
  // layer, so on the Mac the one word you are looking at is pixelated
  // (Chromium re-rasters, which is why the bench never saw it). It is also not
  // the mechanism this page is documented to have -- shell.css: "THE ZOOM IS
  // THE PAGE'S OWN TYPE... the chapter's type grows -- a zoom the browser LAYS
  // OUT rather than a layer it has to raster, which is why it has no size
  // limit and why the text stays sharp at any size."
  //
  // So the growth is css `zoom` on the reading column now (writePageZoom) --
  // a layout zoom of the whole page, laid out at its real size rather than
  // rastered and stretched -- and from the word up to #readerbox there is no
  // transform at all: sharp at any factor, and no layer for WebKit to
  // allocate.
  let readerShift = 0, readerRestLeft = 0, lastPush = -1, edgePending = false;
  function writeReaderTransform(){
    if(!o.readerBox) return;
    const t = readerShift ? "translate(" + Math.round(readerShift) + "px,0px)" : "";
    if(o.readerBox.style.transform !== t) o.readerBox.style.transform = t;
  }
  // The one re-wrap, with the reading line pinned across it.
  function commitReaderEdge(px){
    const pane = o.readerPane;
    let anchor = null, into = 0;
    if(pane && o.readerCol){
      const secs = sections();
      const i = sectionAt(pane.scrollTop + pane.clientHeight*0.35);
      anchor = secs[i] || null;
      if(anchor) into = pane.scrollTop - anchor.offsetTop;
    }
    readerRestLeft = px;
    readerShift = 0;
    o.readerBox.style.left = px + "px";
    writeReaderTransform();
    if(anchor && pane){
      const want = anchor.offsetTop + into;      // forces the one layout, on purpose
      if(Math.abs(pane.scrollTop - want) > 1){
        programmaticTop = want;                  // ours, not the reader's own move
        pane.scrollTop = want;
      }
      // ...and keep it there while the re-wrap lands. A width change makes
      // the browser forget every height it had learned under
      // content-visibility, the column's height collapses for a moment, and
      // the scroll position is clamped against it -- measured in Chrome, the
      // reader went from 471,372 to 0. Setting it once is not enough; the
      // anchor is re-read until it stops moving.
      holdOn(anchor, into);
    }
  }
  // Pin the reading line to a section for a few frames, abandoning the
  // moment there is any input of the reader's own.
  function holdOn(sec, into){
    if(!sec || !o.readerPane) return;
    const mine = inputTick;
    let tries = 0, stable = 0;
    const step = () => {
      if(!o.readerPane || inputTick !== mine || sec.isConnected === false) return;
      const want = sec.offsetTop + into;
      if(Math.abs(o.readerPane.scrollTop - want) > 1){ o.readerPane.scrollTop = want; stable = 0; }
      else stable++;
      programmaticTop = want;
      // a re-wrap can take a good many frames to land on a book this size,
      // so this keeps at it until the place has actually held for a few.
      if(stable < 4 && ++tries < 45) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function applyDx(snap){
    if(!book || screen!=="open") return;
    // ...unless the reader is still standing on a translate that has not
    // been turned into its real edge yet: that last frame is the one that
    // re-wraps the lines to the space left, and skipping it would leave the
    // text hanging off the side until something else happened to repaint.
    if(!snap && !needsPaint && lastPaintDx === dx && !wordSlideX && !edgePending) return;
    needsPaint=false; lastPaintDx=dx;
    const lvl = levelOf(dx);
    const wordF   = clamp(dx, 0, 1);      // slide 2: the zoom
    const spreadF = clamp(dx - 1, 0, 1);  // slide 3: the rest pushed out
    // The zoom starts moving the instant dx leaves 0, well before lvl
    // itself flips to "word" at the 0.5 boundary -- the word being zoomed
    // toward has to exist from the first pixel of that push, not only
    // once the push is already half-committed, or the early part of the
    // zoom would have nothing real to aim at.
    const wordOn = dx>0;
    if(wordOn !== wordWasOn){
      if(wordOn) enterWord(currentReaderChapter()); else exitWord();
      wordWasOn = wordOn;
    }

    // -------- THE LEFT STACK, outermost pane first. Each pane still
    // fully open (f=1) before the next-farther-out one starts is not
    // asserted separately -- it falls straight out of `f=clamp(-dx-i,0,1)`
    // the same way it always has for the one pane this used to be, just
    // looped once per level now. pushFromOutside accumulates left to
    // right (outer to inner) exactly the way the eleventh pass's own
    // single push did, generalised: whatever is further OUT always pushes
    // whatever is further IN, reader included, over by its own open width.
    const n = currentMaxLeft();
    // The stack's own gutter against the screen edge -- collection-page.html
    // sets its column 20vw in, and none of that had ever come across, which
    // is what "STILL it is TOO far over on the left" was. It has to scale
    // with how open the OUTERMOST pane is: seeded flat, a fully closed pane
    // would sit peeking out by exactly this much instead of off-screen.
    // THE GUTTER BELONGS TO THE STACK, AND THE STACK BEGINS AT THE SECOND
    // PANE. It exists to hold the outermost pane off the screen edge -- but
    // the first pane is not a pane in that sense, it is the margin the reading
    // column already leaves empty, and its right edge has to land exactly on
    // the column's own left edge. Held off the edge by a gutter it does not
    // land there: it overhangs the text by exactly that much, and covers a
    // strip of every line. (Both ways round have now been seen on screen --
    // charged to the reader, the reader moved when he had said it must not;
    // charged to nobody, the pane sat over the words.) So it eases in with the
    // SECOND pane, the first one that really is a pane, and from then on it
    // moves the reader along with everything else it shifts.
    // ---- WHERE THE PANES GO IS pane.js's OWN QUESTION NOW. Osca: "lets
    // design the panes individually... make sure the .shell calls on THAT
    // asset, the one we are building." So the stack's geometry -- widths,
    // the gutter, the gap, how far a shut pane waits off its place, which of
    // them are coloured, which sits on top -- lives in pane.js and is dialled
    // on bench-panes.html, with no reader on the screen to confuse it. This file
    // asks for the numbers and hangs the panes on them.
    //
    // The one thing the app tells the stack that the bench cannot: the first
    // pane's width. It is the reading column's own margin, so that pane comes
    // out into space that was already blank and moves nothing.
    const marginW = Math.max(120, Math.round(((window.innerWidth||0) - readerColumnWidth()) / 2));
    // AND THE HEIGHT GOES WITH THE WIDTH. pane.js decides "is this a phone"
    // off the SHORT side as of job 24 -- 932x430 is a phone held sideways and
    // is over the width mark -- and it can only do that if it is told both.
    // Left out, it judges on width alone exactly as it always did.
    const laid = (window.Panes ? window.Panes.measure({
      n, dx, vw: window.innerWidth || 0, vh: window.innerHeight || 0,
      first: marginW,
      seed: (book && book.slug) || "", cfg: PANE
    }) : { panes: [], right: 0 });
    let stackRight = laid.right;
    let pushFromOutside = 0;
    for(let i=n-1;i>=0;i--){
      const p = laid.panes[i];
      if(!p) continue;
      // A level this branch does not reach still keeps its place in the
      // stack -- an empty pane, not a closed one, so nothing slides.
      const el = ensurePane(i, levelsCache[i], null, false) || emptyPane(i);
      const rec = leftPanes[i];
      if(!el) continue;
      window.Panes.apply(el, p);
      if(rec) rec.w = p.width;
      // (nothing accumulated per pane any more: the stack is two slots and a
      // pile now, so what the reader has to clear is the WINDOW's own right
      // edge, once, below -- adding each pane's edge on top of that counted
      // the same room twice and pushed the reader again for a third pane that
      // had not widened anything.)
    }
    paneWidthsStale = false;
    // THE READER IS NEVER PUSHED OFF THE SCREEN. Measured in Chrome: widen
    // the panes enough and the push (1621px) passed the viewport (1512px),
    // the reader's own box had no width left, its scrollable height went with
    // it, and the browser clamped the reading position to ZERO -- the book
    // jumped back to its first page, and with it the panes collapsed to one.
    // Past this point the panes slide over each other instead, which is what
    // a deep stack should do anyway.
    // whole pixels here too: a reader edge resting on a fraction of one is
    // the same shimmer the panes were rounded to avoid.
    // THE TEXT MOVES OUT FROM UNDER THE PANES. Osca, two panes out: "I'd like
    // the text to be repositioned to the side please. so it's still visible."
    //
    // Pushing the reader by the width of the stack is not enough, and the
    // arithmetic says why: the reading column is centred in whatever is left
    // of the window, so pushing the box by P moves the COLUMN by only P/2 --
    // half the push is eaten by the re-centring. Two panes out, the stack
    // reached 640 and the text still started at 465, which is a strip of every
    // line covered. So the push is worked out from where the text has to
    // start, not from how wide the panes are: colLeft = marginW + P/2, and it
    // has to reach the stack's own right edge.
    if(stackRight > 0){
      const need = 2 * (stackRight - marginW);
      if(need > pushFromOutside) pushFromOutside = need;
    }
    pushFromOutside = Math.round(Math.max(0, pushFromOutside));
    const room = (window.innerWidth || 0) - readerMinWidth();
    if(room > 0 && pushFromOutside > room) pushFromOutside = room;
    for(let i=n;i<MAX_LEFT_LEVELS;i++) destroyPane(i);

    spreadNow = spreadF;
    paintWordSub(spreadF);            // the last pane's own caption
    updateWordZoom(wordF);
    // THE READER SLIDES; IT DOES NOT RE-WRAP SIXTY TIMES A SECOND. Osca:
    // "Also general jittering."
    //
    // Setting the reader's own left edge every frame changed its WIDTH every
    // frame, and a width change re-wraps the whole reading column -- 221,500
    // elements on the complete Shakespeare -- while the panes are still
    // moving. Worse, under content-visibility a width change throws away
    // every height the browser had learned, the column's total height
    // collapses, and the scroll position is clamped: measured live in Chrome,
    // the reader sat at 471,372 and came back at 0. That is the lurch.
    //
    // So while anything is moving the reader is TRANSLATED -- no reflow, no
    // re-wrap, nothing thrown away -- and only when the movement stops does
    // its real edge move, once, with the reading line pinned across the
    // re-wrap so the same words stay under it. Lines still break to fit the
    // view, which was the ask; they just stop doing it mid-slide.
    if(o.readerBox){
      if(pushFromOutside === lastPush && readerRestLeft !== pushFromOutside){
        commitReaderEdge(pushFromOutside);
        edgePending = false;
      }else{
        readerShift = pushFromOutside - readerRestLeft;
        writeReaderTransform();
        edgePending = readerShift !== 0;
      }
      lastPush = pushFromOutside;
      // live under the sidebar for the whole contents range -- only one
      // word actually covers and stops it.
      o.readerBox.style.pointerEvents = lvl==="word" ? "none" : "auto";
    }
    // Fourteenth pass: "the space here is too large, between the text and
    // the pull out contents" -- page.css's own .chapter centres on the
    // true axis (margin-inline:auto), which is exactly right at dx=0 (the
    // reference this was measured off always shows the reader at the
    // whole window's own width) but doubles up once a pane has actually
    // pushed .readerbox over: the open pane already reads as that side's
    // own space, so a column still centred INSIDE the narrower box that's
    // left puts a second, nearly-as-wide gap between the pane and the
    // text before it starts. #book.pushed (shell.css) drops the column
    // back toward the pushed reader's own left edge instead, once any
    // pane is actually open -- reader-only and one word (pushFromOutside
    // is 0 for both) never set this class, so the true centred axis is
    // untouched there, and every other page here never has #book at all.
    // THE COLUMN NEVER RE-WRAPS. Measured off Osca's own screen recording,
    // frame by frame: while the first pane was dragged out, the reading
    // text's left edge went 300 -> 340 -> 306 -> 338 -> 300, swinging thirty
    // pixels back and forth, and sat rock-steady at 300 the moment the
    // gesture stopped. It was a class -- #book.pushed -- narrowing the column
    // (max-width: 100% - 6rem) the instant any push existed, which re-wraps
    // the text. The reader SLIDES and keeps its measure; it does not narrow.
    // So the class is gone, and with it the last thing that could re-wrap a
    // page while it moves.
    if(o.readerHead){
      // the reader's OWN running head (page.css's .runhead, always-on by
      // that file's own design, "you should always be able to see which
      // book you are in") floats at a higher z-index than one word's own
      // box -- fine while the reader is still what's on screen, but an
      // artifact once one word is meant to be the whole show. Hidden only
      // there; still on for both reader and contents.
      o.readerHead.style.opacity = lvl==="word" ? "0" : "";
    }
    if(o.readerScrub){
      o.readerScrub.style.opacity = lvl==="word" ? "0" : "";
    }
    if(o.small && book){
      if(lvl==="word"){
        const label = chapterLabel(wordChapterIdx)+"  ·  one word";
        if(o.small.textContent !== label) o.small.textContent = label;
      }
      else {
        // curChapterIdx is maintained by the reader's own scroll event, not
        // recomputed here -- see currentReaderChapter's own comment for what
        // doing it per frame actually cost.
        const label = chapterLabel(curChapterIdx);
        if(o.small.textContent !== label) o.small.textContent = label;
      }
    }
  }
  function chapterLabel(i){
    const ch = book && book.chapters && book.chapters[i];
    if(!ch) return "";
    return (ch.n?ch.n+" ":"")+(ch.t||"chapter "+(i+1));
  }

  /* ================= THE SWITCH IS A TRAVEL, NOT A CUT ==================
     Osca, 8 September: *"works both ways but isn't smooth"*.

     The stretch between the page and the word was closed by a fraction of the
     remaining distance per frame, `Math.min(1, T.snap * OUT_SNAP * dt)`. With
     the shipped numbers that product is 0.576 x 9 = 5.184, so at any ordinary
     frame the min() saturates at 1 and the WHOLE remaining distance is closed
     in a SINGLE FRAME. There was no arrival to be smooth: releasing a pinch at
     the gate cut straight to one word and leaving it cut straight back. A
     spring that always saturates is not a spring, which is also why the
     bench's own "snap back to the page" slider could not be felt at any value
     -- even 1 x 0.576 saturates at dt >= 1.74.

     So the two word stretches TRAVEL: a smoothstep from wherever the gesture
     left the axis to whichever end the release committed to, over a duration
     taken from the distance and from OUT_SNAP -- which keeps its meaning
     ("how hard that switch throws": higher = shorter) and becomes a control
     that can be felt, ~750ms at 1 down to ~72ms at 14. Zero velocity at both
     ends, which is the whole of "smooth both ways". It is abandoned the
     instant there is a hand on the axis again -- any push, any pinch --
     exactly as startPull is. */
  let snapFrom = 0, snapTo = null, snapT = 0, snapDur = 0;
  function snapStart(goal){
    const d = Math.abs(goal - dx);
    if(d <= DX_REST){ setDx(goal); snapTo = null; return; }
    snapFrom = dx; snapTo = goal; snapT = 0;
    // root-of-distance, startPull's own shape and for the same reason: a
    // release close to the end must not crawl and a long one must not race.
    // At OUT_SNAP 6, half the stretch is 10 frames (167ms) and a third of it
    // 7.8 (130ms); at 14 it is 4.3 (72ms), at 1 it clamps at 45 (750ms) -- the
    // whole range is reachable from the bench and every part of it is felt.
    snapDur = clamp(85 / Math.max(0.25, OUT_SNAP) * Math.sqrt(d), 3, 45);
  }
  function snapStep(dt){
    if(snapTo == null) return false;
    snapT += (dt || 1);
    const t = Math.min(1, snapT / snapDur);
    setDx(snapFrom + (snapTo - snapFrom) * (t*t*(3-2*t)));
    if(t >= 1){ setDx(snapTo); snapTo = null; }
    markPaint();
    return true;
  }
  function snapCancel(){ snapTo = null; }

  let dxIdle=0;
  function stepDx(dt){
    if(dxInput || pinching) snapCancel();
    if(dxInput){
      // THE DETENT AT THE READER. Coming home from the word, the same gesture
      // used to carry straight through the page and open the contents --
      // Osca: "doesn't stick to the main reader tab - opens contents pane
      // immediately." It stops at the page, and going further needs a gesture
      // of its own. The flag holds until your hand actually stops, or the
      // rest of the same push would simply carry on through.
      if(detent){
        if(dxInput < 0){ dxInput = 0; dxIdle += dt; if(dxIdle > T.grace) detent = false; return; }
        detent = false;
      }
      const wasIn = dx;
      setDx(dx+dxInput);
      if(wasIn > 0 && dx < 0){
        setDx(0); dxVel = 0; dxInput = 0; dxIdle = 0; detent = true;
        markPaint();
        return;
      }
      // ...AND THE MIRROR OF IT, 8 Sep. axisPush refuses a push that would
      // cross 0 upward; this is the same line held against what is left over
      // of one already made, so a pane closed with a flick stops at the book
      // rather than carrying on into a zoom nobody pinched.
      if(wasIn <= 0 && dx > 0){
        setDx(0); dxVel = 0; dxInput = 0; dxIdle = 0;
        markPaint();
        return;
      }
      dxVel = dxVel*Math.pow(T.decay,dt) + dxInput*T.couple;
      if(dxVel>T.vmax) dxVel=T.vmax; else if(dxVel<-T.vmax) dxVel=-T.vmax;
      dxInput=0;
      dxIdle=0;
    } else if(dxVel>DX_REST || dxVel<-DX_REST){
      const was = dx;
      setDx(dx + dxVel*dt*T.coast);
      // THE READER IS A DETENT. Osca: "snap coming out isn't strong enough,
      // doesn't stick to the main reader tab - opens contents pane
      // immediately." Coming home from the word, the momentum that got you
      // there ran straight through the page and out the other side into the
      // contents. It stops at the page: crossing zero from the word's side
      // lands ON zero, with nothing left over. Going the other way needs its
      // own push, which is what "sticks to the main reader tab" means.
      if(was > 0 && dx < 0){ setDx(0); dxVel = 0; dxInput = 0; dxIdle = 0; detent = true; }
      if(was <= 0 && dx > 0){ setDx(0); dxVel = 0; dxInput = 0; dxIdle = 0; }
      dxVel *= Math.pow(T.decay, dt);
      if(dx<=-currentMaxLeft() || dx>=1) dxVel=0;
      dxIdle=0;
    } else {
      dxVel *= Math.pow(T.decay, dt);
      // A TRAVEL ALREADY UNDER WAY IS NOT WAITING FOR ANYTHING. T.grace below
      // exists to bridge the gaps inside a real trackpad's momentum TAIL; a
      // switch that has already been thrown has no tail to bridge, and making
      // it sit out the grace put ~130ms of nothing between the release and the
      // page moving -- dead time, which is half of what "isn't smooth" is.
      if(snapTo != null){ snapStep(dt); return; }
      // Coasting has genuinely stopped -- but a REAL wheel gesture (a
      // trackpad's own momentum tail, not this file's own synthetic test
      // events) keeps sending small events with real gaps between them,
      // and dxVel can decay under DX_REST inside one of those gaps well
      // before the gesture is actually over. Fifteenth pass: only start
      // easing toward a rest point once genuinely idle for T.grace --
      // "it keeps snapping at the wrong times... it jumps" was this
      // branch firing inside a gap, then a real event resuming from
      // wherever that snap had already moved dx to.
      dxIdle += dt;
      if(dxIdle < T.grace) return;
      // Real wheel gestures routinely die out somewhere like 0.7, not a
      // clean 1 -- past WORD's own threshold functionally, but visually
      // still short of fully open, which is exactly the kind of gap a
      // reader's own tinted opener (or a pane one level out) can show
      // through. Ease the rest of the way to whichever rest point --
      // reader/word, or however many left-stack stops this book's own
      // trail currently has -- was already closest.
      const targets = dxTargets();
      const target = targets.reduce((a,b)=>Math.abs(b-dx)<Math.abs(a-dx)?b:a);
      // COMING OUT OF ONE WORD SNAPS HARD. Osca: "I need snap stronger,
      // coming OUT of one word view." Between the word and the reader there
      // is nothing to look at -- a half-zoomed page is not a place to be --
      // so that one stretch is not left to the same gentle ease every other
      // rest point gets. Anywhere in 0 < dx < 1, the pull home is multiplied.
      // SNAP AT BOTH ENDS OF THAT STRETCH. Osca: "I also want SNAP going in
      // ASWELL as snap going out of one word view."
      //
      // Between the page and the word there is nothing to look at, so it is
      // not a place to rest either way. Which end it runs to is decided ON
      // RELEASE, by where the gesture got to: past halfway it commits to the
      // word, short of halfway it falls back to the page. (Gripping toward
      // the nearest end regardless was what once made the word impossible to
      // leave -- fourteen pushes and dx never moved off 1. A switch has a
      // direction; this one takes it from you, once, when you let go.)
      // A PAGE HELD ZOOMED IS A PLACE TO BE, and it is the only one this axis
      // has between two positions. Everywhere else in 0 < dx < 1 there is
      // genuinely nothing to look at, which is why the switch below exists --
      // but the pinch's own band IS the thing that was asked for ("zoom into
      // the page... you drag to pan around it"), so while the hold stands the
      // page stays exactly where the fingers left it. Any push of the axis
      // itself -- a wheel, an arrow -- drops the hold and the switch is back.
      //
      // AND FINGERS ON THE GLASS OWN THE AXIS (8 Sep). A live pinch writes dx
      // straight and resets dxIdle every time it moves -- but a gesture that
      // PAUSES past the gate for T.grace frames used to have this branch throw
      // the page to one word out from under the hand still holding it. Nothing
      // eases while the gesture is still running.
      if(pinching) return;
      if(pinchHold && dx > 0 && dx < PINCH.gate) return;
      if(dx > 0 && dx < 1){
        if(snapTo == null) snapStart(dx >= WORD_COMMIT ? 1 : 0);
        snapStep(dt); return;
      }
      if(dx > 1 && dx < 2){
        if(snapTo == null) snapStart((dx - 1) >= WORD_COMMIT ? 2 : 1);
        snapStep(dt); return;
      }
      const goal = target;
      if(Math.abs(dx-goal) > DX_REST) setDx(dx + (goal-dx)*Math.min(1, T.snap*dt));
    }
  }

  let lastT=0;
  function tick(now){
    const dt = lastT ? Math.min(3,(now-lastT)/16.667) : 1;
    lastT=now;
    if(screen==="open") {
      // A CTRL+WHEEL PINCH HAS NO END EVENT -- Chromium sends a stream of
      // wheels and then simply stops -- so the gesture ends when the stream
      // does, counted in the same dt-units the whole of this file's physics
      // already run in rather than off a wall clock the harness would have to
      // learn about.
      if(wheelPinch){
        wheelPinchIdle += dt;
        if(wheelPinchIdle > 8){ wheelPinch = false; endPinch(); }
      }
      stepDx(dt);
      if(levelOf(dx)==="word") coastWord(dt);
      stepPull(dt);                        // the travel toward an off-screen word
      applyDx(false);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ================= THE CURSOR IS PLACED BY A PLAIN CLICK =================
  // Osca, 7 September: *"the app's own single click still places the reading
  // cursor, but it must be non-blocking: a plain click sets the cursor and
  // yields instantly to a drag or a right-click/hold, never cancelling
  // selection or the OS menu."*
  //
  // WHAT WAS HERE, AND WHY IT HAD TO GO. The cursor was placed by a
  // DOUBLE-click, and the handler ended with `sel.removeAllRanges()` -- "leave
  // the mark, not a selection". A double-click is the OS's own select-a-word
  // gesture and the first half of select-by-word-dragging, so this page was
  // taking the reader's selection away at the exact instant they made it:
  // double-click a word, and the highlight vanished before Look Up, Translate,
  // Copy or Speech could be reached. One line, and it made the reading column
  // feel like a picture of text.
  //
  // So: a SINGLE click places the cursor, the double-click keeps working (it
  // is still a click, and Osca asked for it on 4 Sep -- "let me double click a
  // word, to bring one word view endpoint/origin AND the voice to there"), and
  // NEITHER touches the selection. Nothing here calls preventDefault, and
  // nothing here calls removeAllRanges.
  //
  // THE FOUR WAYS IT YIELDS, all of them measured off the event rather than
  // guessed at from a timer:
  //   1. a drag. `pointerdown` records where the press started; if the pointer
  //      travelled more than SEL_SLOP px the gesture was a selection, not a
  //      click, and the cursor is left alone. 4px is one hair of hand-shake at
  //      a trackpad's resolution and a tenth of a word's width at reading size.
  //   2. a selection by any route -- word-drag, triple-click, Shift-click,
  //      Select All. If the selection is not collapsed when the click lands,
  //      the reader is selecting, so this stands aside.
  //   3. a right-click, a ctrl-click, a two-finger or three-finger tap. Any
  //      button but the primary is the OS menu's, and `contextmenu` is never
  //      prevented anywhere in this file.
  //   4. a press-and-hold on iPhone, which raises the callout menu and either
  //      leaves a selection behind (case 2) or never fires `click` at all.
  const SEL_SLOP = 4;
  let downAt = null;
  // WHICH WORD IS UNDER A POINT. `caretRangeFromPoint` is WebKit's and
  // Chromium's; `caretPositionFromPoint` is the standard one Firefox has. Both
  // answer with a text node and an offset inside it, which is the same
  // identity `buildWordDomIndex` files every word under -- so the point is
  // matched to a word by the index, never by hit-testing a box of our own.
  function caretAt(x, y){
    const d = document;
    if(d.caretRangeFromPoint){
      const r = d.caretRangeFromPoint(x, y);
      return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    if(d.caretPositionFromPoint){
      const c = d.caretPositionFromPoint(x, y);
      return c ? { node: c.offsetNode, offset: c.offset } : null;
    }
    return null;
  }
  // ...AND WHICH WORD THAT IS, IN THE BOOK. Shared by the click and the
  // double-click so the two can never disagree about what a point means.
  // Returns the chapter and the word index, and leaves the chapter's index
  // built as a side effect exactly as it was built before.
  function wordAt(node, offset){
    if(!book || !node) return null;
    const el = node.nodeType === 3 ? node.parentNode : node;
    const sec = el && el.closest && el.closest(".chapter");
    if(!sec || sec.classList.contains("titlepage")) return null;
    const ch = +sec.getAttribute("data-ch");
    if(!(ch >= 0)) return null;
    if(ch !== wordChapterIdx){
      wordChapterIdx = ch;
      wordWords = wordsOf(book.chapters[ch]);
      wordDomIndex = buildWordDomIndex(ch);
    }
    for(let i=0;i<wordDomIndex.length;i++){
      const w = wordDomIndex[i];
      if(w.node === node && offset >= w.start && offset < w.end) return { ch: ch, wi: i };
    }
    // between two words, or on the punctuation after one: the first word of
    // the paragraph that was actually hit, which is what the double-click has
    // always done and is never wrong by more than a line.
    const par = el.closest && el.closest("p");
    for(let i=0;i<wordDomIndex.length;i++)
      if(wordDomIndex[i].p === par) return { ch: ch, wi: i };
    return null;
  }
  function placeCursorAt(hit, why){
    if(!hit) return false;
    wordIdx = hit.wi;
    setCursor(hit.ch, hit.wi, why);
    paintWordHighlight();
    markPaint();
    return true;
  }
  if(o.readerCol){
    // passive: this listener exists to REMEMBER, never to prevent
    o.readerCol.addEventListener("pointerdown", e => {
      downAt = { x: e.clientX, y: e.clientY, button: e.button };
    }, {passive:true});

    o.readerCol.addEventListener("click", e => {
      if(!book) return;
      if(e.button !== 0) return;                       // yield: not the primary button
      if(e.detail > 1) return;                         // the double-click's own handler owns this
      if(downAt && (Math.abs(e.clientX - downAt.x) > SEL_SLOP ||
                    Math.abs(e.clientY - downAt.y) > SEL_SLOP)) return;   // yield: a drag
      const sel = window.getSelection && window.getSelection();
      if(sel && sel.rangeCount && !sel.isCollapsed) return;               // yield: a selection
      placeCursorAt(wordAt2(e), "click");
    });

    // DOUBLE-CLICK A WORD, ANYWHERE IN THE BOOK. Osca, 4 Sep: "Let me double
    // click a word, to bring one word view endpoint/origin AND the voice to
    // there (just connect it with the book."
    //
    // The browser's own double-click has already selected the word under the
    // pointer, and that selection is now LEFT WHERE IT IS -- it is what Look
    // Up, Translate, Copy and Speech act on. The cursor is read from the same
    // point the reader pressed, so the word the book moves to and the word the
    // OS menu is about are the same word by construction.
    o.readerCol.addEventListener("dblclick", e => {
      if(!book) return;
      placeCursorAt(wordAt2(e), "double-click");
    });
  }
  // the point a mouse event happened at, resolved to a word. Falls back to the
  // live selection's own anchor when the engine has no caret-from-point at all
  // (which is the case the double-click used to rely on exclusively).
  function wordAt2(e){
    const c = caretAt(e.clientX, e.clientY);
    if(c) return wordAt(c.node, c.offset);
    const sel = window.getSelection && window.getSelection();
    if(sel && sel.rangeCount) return wordAt(sel.anchorNode, sel.anchorOffset);
    return null;
  }

  // ...AND ANY TAP. The third of the three doors job 24 names, and the only
  // one this file did not already have a listener for: it does nothing but
  // wake, it is passive, and it is on the window rather than on the subtitle
  // so that touching the PAGE wakes the line that says where you are.
  addEventListener("pointerdown", () => { wakeSub(); }, {passive:true});

  // ============================ THE PINCH ==================================
  // The gesture in three calls -- start, scale, end -- and three engines'
  // worth of events funnelled into them below. Everything the pinch does to
  // the page it does by moving `dx`; there is no second zoom, no second mode
  // and no second painter. See THE PINCH IS THE WHOLE CONTINUUM above.

  // WHICH WORD IS UNDER THE FINGERS. The same caret-from-a-point the click has
  // used since 7 Sep, asked the same way -- not a second route to a word.
  function wordUnder(x, y){
    if(x == null || y == null) return null;
    const c = caretAt(x, y);
    const hit = c ? wordAt(c.node, c.offset) : null;
    if(hit) return hit;
    // ...AND A POINT THAT IS NOT ON A WORD IS STILL ON A PAGE. The gap between
    // two lines, the gutter beside the measure, a point that lands on a
    // speaker or a stage direction (neither is in the word index) -- all of
    // them answer nothing, and the cost of nothing is high: with no word
    // named, enterWord falls back to the one nearest the reading line, and if
    // THAT one is off the screen the arrival SEATS to it, which is the page
    // bolting out from under two fingers that were only pinching. So the point
    // is asked again a little way around itself -- the paragraph the fingers
    // are over is never wrong by more than a line, and it is on the screen,
    // which is the whole requirement.
    const el = (typeof document !== "undefined" && document.elementFromPoint)
             ? document.elementFromPoint(x, y) : null;
    const par = el && el.closest ? el.closest("p.line") : null;
    const tn = par && par.firstChild;
    if(tn && tn.nodeType === 3){
      const near = wordAt(tn, 0);
      if(near) return near;
    }
    // A SMALL GRID AND NOT THE WHOLE PAGE. The complete Shakespeare lays out
    // 115,032 line boxes; asking every one of them for a rectangle to find the
    // nearest is a layout of the entire book, sixty times a second away from a
    // gesture that has to start NOW. Nine caret reads cost nothing and answer
    // the same question about the only part of the page that is on the screen.
    const vh = window.innerHeight || 0, vw = window.innerWidth || 0;
    for(const dy of [-14, 14, -28, 28, -44, 44]){
      for(const ax of [x, Math.round(vw*0.5), Math.round(vw*0.35)]){
        const py = y + dy;
        if(py < 4 || py > vh - 4) continue;
        const c2 = caretAt(ax, py);
        const h2 = c2 ? wordAt(c2.node, c2.offset) : null;
        if(h2) return h2;
      }
    }
    // ...AND LAST, THE WORD THE READER IS ALREADY LOOKING AT -- if it is on the
    // screen. Not every point on a page of text is on a word this book counts:
    // a speaker's name and a stage direction are neither in wordsOf() nor
    // rendered as `p.line`, and on the complete Shakespeare a good half of the
    // view can be one or the other, so a pinch aimed squarely at the page could
    // resolve nothing at all and refuse. The word nearest the reading line is
    // what the eye is on in that case. It is measured, not assumed: off the
    // screen it is refused, because zooming about a point outside the view is
    // the seat, and the seat is the page bolting from under two fingers.
    const ch = currentReaderChapter();
    if(book && book.chapters && book.chapters[ch] && o.readerPane){
      const keep = { c: wordChapterIdx, i: wordIdx, d: wordDomIndex, w: wordWords };
      wordChapterIdx = ch;
      wordWords = wordsOf(book.chapters[ch]);
      wordDomIndex = buildWordDomIndex(ch);
      wordIdx = clamp(wordIdxNearLine(ch), 0, Math.max(0, wordTotal()-1));
      const r = wordRectNow(), vh = window.innerHeight || 0;
      if(r && r.width > 0 && r.bottom > 8 && r.top < vh - 8) return { ch: ch, wi: wordIdx };
      wordChapterIdx = keep.c; wordIdx = keep.i; wordDomIndex = keep.d; wordWords = keep.w;
    }
    return null;
  }
  function beginPinch(x, y){
    if(screen !== "open" || !book) return false;
    inputTick++;
    wakeSub();
    pinchFrom = pinchLevel();
    pinching = true;
    // AT REST THE GESTURE NAMES ITS OWN WORD, and only at rest: a pinch that
    // carries on from a page already zoomed is the same gesture continuing,
    // and re-choosing the word half way through it would move the ground.
    // A GESTURE THAT NAMES NO POINT IS A GESTURE AT THE MIDDLE OF THE SCREEN.
    // Every engine here sends one, but a handle called from a bench (or from
    // this file's own checks) need not, and refusing it would make the gesture
    // untestable without a pair of fingers.
    if(x == null || y == null){
      x = (window.innerWidth || 0) / 2;
      y = (window.innerHeight || 0) / 2;
    }
    if(dx <= DX_REST){
      // THE WHOLE GESTURE IS AN ENTERING, whether or not a word was named. It
      // is the flag that stops enterWord travelling to the cursor, and a pinch
      // that could not resolve a word needs that MORE than one that could, not
      // less: the fallback word is the one nearest the reading line, and
      // seating to it is the page moving under two fingers that only pinched.
      pinchEntering = true;
      const hit = wordUnder(x, y);
      // A PINCH ANCHORS ON A WORD, AND WHERE THERE IS NONE IT DOES NOT START.
      // The reader opens on chapter zero's own tinted opener -- the cover, the
      // book's title and its author, and NO running text on the screen at all:
      // measured on the complete Shakespeare at scrollTop 0, 0 of 115,032
      // p.line boxes intersect the view. There is nothing there to zoom INTO,
      // and the nearest word in the book is thousands of pixels below, so
      // taking it would seat the reader to it -- a cover that answers a pinch
      // by bolting into chapter one. It answers by doing nothing instead, and
      // the page underneath is left exactly as it was.
      if(!hit){ pinching = false; pinchEntering = false; return false; }
      wordIdx = hit.wi;
      setCursor(hit.ch, hit.wi, "pinch");
      paintWordHighlight();
      anchor = null; arrived = null;
      // measured NOW, once, off the word the fingers are on -- so the factor
      // the whole gesture is reckoned against cannot change under it when the
      // arrival would otherwise land a frame or two later.
      const a = computeArrived();
      if(a) arrived = a;
    }
    pinchK = (arrived && arrived.k > 1) ? arrived.k : PINCH.assume;
    return true;
  }
  function pinchTo(Z){
    if(!pinching) return dx;
    // CLAMPED AT 1x. There is no zooming OUT of a page, and a pinch must never
    // be a way into the contents: the left half of the axis is the left hand's,
    // and this gesture stops dead at the page it started on.
    const to = dxAtFactor(Z < 1 ? 1 : Z);
    snapCancel();
    setDx(to < 0 ? 0 : to);
    dxVel = 0; dxInput = 0; dxIdle = 0; detent = false;
    pinchHold = dx > DX_REST && dx < PINCH.gate;
    markPaint();
    return dx;
  }
  function endPinch(){
    if(!pinching) return dx;
    pinching = false; pinchEntering = false; pinchK = 0;
    // WHAT THE RELEASE DECIDES, and it is the rule this file already had: past
    // the gate the snap commits to the word (stepDx, WORD_COMMIT), short of it
    // the page simply stays where you left it, which is what the hold is.
    pinchHold = dx > DX_REST && dx < PINCH.gate;
    // AND THE TRAVEL BEGINS AT THE RELEASE (8 Sep). Left to stepDx's own rest
    // branch it could not start until dxIdle had cleared T.grace -- eight
    // dt-units, ~130ms of the page doing nothing at all while your fingers are
    // already off the glass. The grace is for a momentum tail; a lifted pinch
    // has none.
    if(!pinchHold){
      if(dx > 0 && dx < 1) snapStart(dx >= WORD_COMMIT ? 1 : 0);
      else if(dx > 1 && dx < 2) snapStart((dx - 1) >= WORD_COMMIT ? 2 : 1);
    }
    markPaint();
    return dx;
  }
  // ---- THE PAN. Osca: "you drag to pan around it, exactly like zooming a
  // photo or a webpage." Sideways is the column's own offset -- the same
  // `left` the zoom writes, so there is still only ONE thing moving the page
  // across the screen -- and up and down is the scroller, which is what it has
  // always been. Both are clamped to the page itself: a zoomed column overhangs
  // the window by exactly (its width x the factor - the window), half each
  // side, and you may reach either edge of that and no further.
  function panBy(px, py){
    if(!PINCH.pan || !pinchHold) return false;
    let moved = false;
    if(px){
      // THE BUDGET IS THE OVERHANG THE FACTOR MADE, AND IT IS MEASURED FROM
      // WHERE THE ZOOM LEFT THE PAGE -- not from the middle of the window.
      // The offset the zoom itself is standing on is not a pan: it is what
      // keeps the word where it was standing while the page grew around it,
      // and on a word near one edge of the measure that offset is large and
      // entirely correct. Counting it against the pan clamped a page that had
      // never been panned, and yanked it back the moment you touched it
      // (measured: shiftX -582 against a budget of 317, so the first drag
      // LEFT moved the page RIGHT by 265px). So `panBase` is that resting
      // offset, and the pan may travel the overhang either way from it.
      const vw = window.innerWidth || 0;
      const over = Math.max(0, readerColumnWidth()*pageZ - vw) / 2;
      let to = shiftX + px;
      if(to > panBase + over) to = panBase + over;
      else if(to < panBase - over) to = panBase - over;
      // half a pixel, not a hundredth: a drag that has reached the edge of the
      // page must SAY it has reached it, because the wheel above reads this
      // answer to decide whether there is any page left to pan -- and a hair
      // of movement per event would keep the hold alive for ever.
      if(Math.abs(to - shiftX) > 0.5){ writePageZoom(pageZ, to); moved = true; }
    }
    if(py && o.readerPane){
      const max = (o.readerPane.scrollHeight || 0) - (o.readerPane.clientHeight || 0);
      let to = o.readerPane.scrollTop - py;
      if(to < 0) to = 0; else if(max > 0 && to > max) to = max;
      if(to !== o.readerPane.scrollTop){
        o.readerPane.scrollTop = to; programmaticTop = to; moved = true;
      }
    }
    if(moved) markPaint();
    return moved;
  }

  // ---- THE THREE WAYS A PINCH ARRIVES. The phone sends touches. Safari and
  // every WKWebView -- which is what Frank's window and the whole of iOS are --
  // send GestureEvents for the same two fingers, on glass or on a trackpad, and
  // they arrive ALONGSIDE the touches, so where they exist they win and the
  // touch route stands down. Chromium's own pinch is a wheel with ctrl held,
  // and so is ctrl+scroll on a mouse, which is the same intention said another
  // way. Three engines, one pair of calls.
  let sawGesture = false, tp = null, panFrom = null;
  let wheelPinch = false, wheelPinchIdle = 0;

  /* ====================== THE SWIPE IS THE WHEEL ===========================
     Osca, 8 September: *"the phone reader navigates panes the SAME way the Mac
     does: touch drives the wheel/dx pane scroll, continuously through to the
     library ... reading -> scroll reveals the contents panes (scroll up/down
     through the chapters) -> keep scrolling past the deepest pane -> back to
     the library. One continuous touch scroll, mirroring the Mac's wheel
     exactly. Reuse the Mac's logic; do not reinvent a gesture."*

     WHAT WAS HERE BEFORE, AND WHY IT WAS THE WRONG SHAPE. A drag that armed
     only inside 26px of the left edge, only on a page at rest, and only
     rightwards. It could open pane 0 and it could open nothing else: the
     moment a pane was under your finger the gesture was disarmed, so the way
     from the contents to the library was not a scroll at all -- it was a
     button in the pane's foot ("leave the book"), and a button is not what the
     Mac does. The Mac has ONE continuous axis and one gesture that rides it
     the whole way. So has this now.

     IT IS NOT A SECOND WAY OF OPENING THE CONTENTS. It opens nothing, animates
     nothing, and knows nothing about a pane: it calls `axisPush`, which is the
     sideways wheel's own function. Every behaviour along the axis therefore
     arrives for free and IDENTICALLY -- the panes come out under the finger,
     the detent at the reading page still holds, however many panes this book's
     trail has are each a position, the release still eases to whichever rest
     point `dxTargets()` says is nearest, a flick still carries (dxVel), and
     past the deepest pane the same EXIT_PUSH gate hands you to
     `closeToLibrary()`. There is no phone copy of any of that to drift.

     THE FINGER'S SIGN. The panes come out as dx goes NEGATIVE and the finger
     travels the other way, so a rightward drag pushes dx down and a leftward
     drag pushes it up -- one inversion, here and nowhere else. In wheel terms
     a rightward finger IS a negative deltaX, which is exactly the Mac's own
     two-finger swipe toward the contents.

     THE THREE GESTURES CANNOT COLLIDE, and it is decided by COUNT and by
     AXIS, never by a timer or a zone:
       * TWO fingers is the pinch, anywhere on the glass. The second finger's
         own touchstart drops the swipe before beginPinch runs, the same way a
         `gesturestart` (Safari, and every WKWebView, which is what iOS is)
         drops it.
       * ONE finger, held mostly SIDEWAYS, is this.
       * ONE finger, held mostly UP AND DOWN, is reading: the reader's own
         scroll on the page, wheel.js's own drag inside a contents pane. It is
         never taken -- exactly wheel.js's `if(dx > dy) return`, which is how
         the Mac has always partitioned these two, said for a finger.
     A page held zoomed by the pinch is panned by one finger (`panFrom`), and
     that still wins: while `pinchHold` stands the swipe does not arm at all.

     IT IS NOT CLAIMED UNTIL IT IS HORIZONTAL. Nothing is preventDefault-ed and
     nothing is pushed until the finger has travelled `SWIPE.slop` and travelled
     it mostly sideways, so an ordinary read is never interrupted to find out
     what it was. Once claimed it stays claimed for that touch, and a swipe
     that starts vertical never becomes one.

     PHONE ONLY. `html[data-phone]` is read once, at mount: the Mac's window is
     a WKWebView too, and "Mac untouched" means untouched. */
  const SWIPE = {
    slop: 10,     // px of travel before the gesture is claimed at all
    gain: 1.15,   // positions per screen-width of travel: one full sweep is one
                  //    pane and a sixth, so a pane is open before the finger
                  //    reaches the far side and the last of the push is a flick
  };
  const PHONE = (() => { try{ return !!(document.documentElement
    && document.documentElement.hasAttribute("data-phone")); }catch(_){ return false; } })();
  let swipe = null;
  function swipeArm(x, y){
    if(!PHONE) return false;
    if(screen !== "open" || !book) return false;
    if(tp || pinching || pinchHold || panFrom) return false;
    swipe = { x0:x, y0:y, x:x, y:y, live:false, took:false, axis:null };
    return true;
  }
  // returns true when it has taken the event
  function swipeMove(x, y){
    if(!swipe) return false;
    if(!swipe.live){
      const ax = Math.abs(x - swipe.x0), ay = Math.abs(y - swipe.y0);
      if(ax < SWIPE.slop && ay < SWIPE.slop) return false;   // still undecided
      if(ax > ay) swipe.axis = "dx";
      // UP AND DOWN READS ON, BUT ONLY INSIDE ONE WORD VIEW -- which is the
      // wheel's own rule at this level, said for a finger: there, deltaY is
      // the finest grain there is and the page has nothing left to scroll.
      // Anywhere else up and down is the reader's own scroll (and, inside a
      // contents pane, wheel.js's own drag) and is never taken.
      else if(levelOf(dx) === "word") swipe.axis = "word";
      else { swipe = null; return false; }
      swipe.live = true; swipe.x = x; swipe.y = y;
      inputTick++;
      wakeSub();
    }
    const px = x - swipe.x, py = y - swipe.y;
    swipe.x = x; swipe.y = y;
    if(swipe.axis === "word"){
      // a finger travelling UP carries the reading forward, which is what a
      // positive wheel deltaY means -- one inversion, and bumpWord's own
      // WORD_PX decides how far a word is.
      if(py){ swipe.took = true; bumpWord(-py); markPaint(); }
      return true;
    }
    if(px){
      swipe.took = true;
      // the panes come out as dx goes NEGATIVE and the finger travels the
      // other way, so the sign is inverted here and nowhere else.
      axisPush(-(px / Math.max(1, window.innerWidth || 1)) * SWIPE.gain);
      markPaint();
    }
    return true;
  }
  function swipeDrop(){ swipe = null; }
  /* A LIVE SWIPE IS NOT A TAP ON A CHAPTER. wheel.js's Column measures its own
     drag on Y ALONE (`drag.moved += Math.abs(dy)`) and calls anything under
     5px of it a tap that opens the row let go over. A sideways sweep across an
     open contents pane is precisely that: nearly no Y at all. On the Mac the
     two never met -- the axis was a wheel and the Column a pointer drag -- but
     one finger is both event streams at once, so the swipe has to say so.

     It stops exactly one event, `pointerup`, and only on the touch it actually
     took: a capture listener on the window runs before the pane's own, and
     stopping the dispatch there means the Column never sees the release and
     never opens a chapter. Its `drag` is left standing, which costs nothing --
     the next `pointerdown` replaces it, and a finger that is not down sends no
     pointermove. A tap that was only ever a tap is untouched: `took` is set
     only once the axis has actually been pushed. */
  addEventListener("pointerup", e => {
    if(swipe && swipe.live && swipe.took){ e.stopPropagation(); }
  }, true);
  const twoAway = (a, b) => Math.sqrt((a.clientX-b.clientX)*(a.clientX-b.clientX)
                                    + (a.clientY-b.clientY)*(a.clientY-b.clientY));
  addEventListener("touchstart", e=>{
    const t = e.touches || [];
    if(t.length === 2 && !sawGesture){
      const d = twoAway(t[0], t[1]);
      if(!(d > 0)) return;
      // TWO FINGERS IS A PINCH, and it takes the gesture off the swipe
      // before beginPinch runs -- one place, one line, and neither gesture
      // has to test for the other anywhere else.
      swipeDrop();
      panFrom = null;
      if(beginPinch((t[0].clientX+t[1].clientX)/2, (t[0].clientY+t[1].clientY)/2)){
        tp = { d0: d, z0: pinchFrom };
        if(e.preventDefault) e.preventDefault();
      }
      return;
    }
    // one finger on a page already held zoomed is a pan -- that reading of
    // one finger is older than this one and still wins.
    if(t.length === 1 && pinchHold){ panFrom = { x:t[0].clientX, y:t[0].clientY }; return; }
    // ...and one finger anywhere else is the axis, IF it turns out to be
    // sideways. Nothing is preventDefault-ed here: until it has proved itself
    // horizontal this is still an ordinary touch on an ordinary page, and a
    // page that scrolls under it.
    if(t.length === 1) swipeArm(t[0].clientX, t[0].clientY);
  }, {passive:false});
  addEventListener("touchmove", e=>{
    const t = e.touches || [];
    if(tp && t.length === 2){
      if(e.preventDefault) e.preventDefault();
      const d = twoAway(t[0], t[1]);
      if(d > 0) pinchTo(tp.z0 * d / tp.d0);
      return;
    }
    if(panFrom && t.length === 1 && pinchHold){
      const px = t[0].clientX - panFrom.x, py = t[0].clientY - panFrom.y;
      panFrom = { x:t[0].clientX, y:t[0].clientY };
      if(e.preventDefault) e.preventDefault();
      panBy(px, py);
      return;
    }
    if(swipe && t.length === 1 && swipeMove(t[0].clientX, t[0].clientY)){
      // only once the swipe is LIVE, which is the whole of why swipeMove
      // answers a boolean: an undecided touch must still be able to scroll.
      if(e.preventDefault) e.preventDefault();
    }
  }, {passive:false});
  function dropTouch(){ if(tp){ tp = null; endPinch(); } panFrom = null; swipeDrop(); }
  addEventListener("touchend", dropTouch);
  addEventListener("touchcancel", dropTouch);

  addEventListener("gesturestart", e=>{
    sawGesture = true;                      // ...and the touch route stands down
    tp = null; panFrom = null;
    swipeDrop();                            // a pinch is never a swipe
    if(!beginPinch(e.clientX, e.clientY)) return;
    if(e.preventDefault) e.preventDefault();
  }, {passive:false});
  addEventListener("gesturechange", e=>{
    if(!pinching) return;
    if(e.preventDefault) e.preventDefault();
    pinchTo(pinchFrom * (e.scale || 1));
  }, {passive:false});
  addEventListener("gestureend", e=>{
    if(!pinching) return;
    if(e.preventDefault) e.preventDefault();
    endPinch();
  }, {passive:false});

  // ---------------------------------------------------------------- INPUT
  addEventListener("wheel", e=>{
    inputTick++;
    wakeSub();                       // any wheel wakes the subtitle (job 24)
    if(screen!=="open") return;
    // A CHROMIUM PINCH IS A WHEEL WITH CTRL HELD, and so is ctrl+scroll on a
    // mouse -- the same intention said another way. It is the one wheel on this
    // page that is never the axis and never the reader's own scroll, so it is
    // taken first, at every level: pinching back OUT of one word is this too.
    if(e.ctrlKey){
      if(e.preventDefault) e.preventDefault();
      if(!pinching){ wheelPinch = beginPinch(e.clientX, e.clientY); }
      wheelPinchIdle = 0;
      pinchTo(pinchLevel() * Math.exp(-(e.deltaY || 0) * PINCH.wheel));
      return;
    }
    // ...AND WHILE THE PAGE IS HELD ZOOMED, SIDEWAYS PANS IT. It would
    // otherwise be the axis, which would throw a page you are in the middle of
    // looking around straight out into the contents. Up and down is the
    // scroller's own and is left exactly alone, at every zoom.
    if(pinchHold && Math.abs(e.deltaX) > Math.abs(e.deltaY)){
      if(e.preventDefault) e.preventDefault();
      // ...UNTIL THE PAGE'S OWN EDGE, AND THEN IT LETS GO. A wheel with
      // nothing left to pan is a wheel pushing the axis, which is what a
      // sideways wheel has always been -- so the hold drops and this falls
      // straight through to it, rather than leaving a page that answers
      // nothing. Same shape as the deliberate push at the deepest pane.
      if(panBy(-e.deltaX, 0)) return;
      pinchHold = false;
    }
    if(levelOf(dx)==="word"){
      // down/up reads on (the finest grain there is); left/right only
      // leaves the view -- same two rules as everywhere else, applied here.
      if(Math.abs(e.deltaY) >= Math.abs(e.deltaX)){
        if(Math.abs(e.deltaY)>0){ e.preventDefault(); bumpWord(e.deltaY); }
        return;
      }
      e.preventDefault();
      axisPush(e.deltaX*T.gain);
      return;
    }
    if(Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;   // vertical: the reader's own scroll
    // THE AXIS IS BEING PUSHED. What that means -- the pinch's rest point
    // ending, the deliberate push past the deepest pane, the exit -- is
    // axisPush's, and this handler no longer holds a second copy of it: the
    // finger on the glass makes the same call (THE SWIPE below).
    e.preventDefault();
    axisPush(e.deltaX*T.gain);
  }, {passive:false});

  addEventListener("keydown", e=>{
    inputTick++;
    wakeSub();                       // ...and any key
    if(screen!=="open") return;
    const lvl=levelOf(dx);
    if(lvl==="word"){
      if(e.key==="ArrowDown"||e.key==="ArrowUp"){
        e.preventDefault(); stepWord(e.key==="ArrowDown"?1:-1); return;
      }
      // one position back: +2 to +1, +1 to the book. Never a fraction.
      if(e.key==="ArrowLeft"){ goPos(posStep(-1)); e.preventDefault(); }
      else if(e.key==="ArrowRight"){ goPos(posStep(1)); e.preventDefault(); }
      return;
    }
    // ONE ARROW, ONE POSITION. The keys are how you move along the axis, so
    // they move it a whole place at a time, in both directions.
    if(e.key==="ArrowRight"){ goPos(posStep(1)); lastDeepLeft = 0; e.preventDefault(); }
    else if(e.key==="ArrowLeft"){
      if(dx > 0){ goPos(posStep(-1)); e.preventDefault(); return; }
      if(dx<=-currentMaxLeft()){
        // ONE MORE PRESS SHOULD NOT THROW YOU OUT OF THE BOOK. The trackpad
        // has always had a gate here -- a deliberate push past the last pane,
        // measured against EXIT_PUSH -- and the arrow key had none: whichever
        // press happened to be the one that reached the end took you straight
        // to the library, which from the inside looks like the book closing
        // itself at random. The key gets the same gate: the press that
        // arrives at the deepest pane stops there, and only a SECOND one,
        // soon after, leaves.
        const now = Date.now(), dt = now - lastDeepLeft;
        if(lastDeepLeft && dt > 400 && dt < 3000){ lastDeepLeft = 0; closeToLibrary(); }
        else if(!lastDeepLeft || dt >= 3000) lastDeepLeft = now;
        // a press within 400ms of arriving is part of the same run of
        // presses that got you here -- it is ignored, and does not re-arm.
      } else { goPos(posStep(-1)); lastDeepLeft = 0; }
      e.preventDefault();
    }
    else if(e.key==="ArrowDown"||e.key==="ArrowUp"){
      if(lvl==="reader" && o.readerPane){
        o.readerPane.scrollTop += (e.key==="ArrowDown"?80:-80); e.preventDefault();
      }
    }
    else if(e.key==="Escape"){ closeToLibrary(); }
  });

  return { openBook, closeToLibrary, speed:setSpeed,
    word: WORD,
    setWord(k,v){ if(k in WORD){ WORD[k]=v; markPaint();
      try{ localStorage.setItem("ttstv_word", JSON.stringify(WORD)); }catch(_){} } return WORD[k]; },
    /* kick every open wheel so a changed --pitch/--radius is picked up now
       rather than on the next scroll -- wheel.js re-reads both off :root
       inside its own layout(), so it only needs a frame to run. */
    kickWheels(){ leftPanes.forEach(p=>{ if(p&&p.wheel&&p.wheel.mode) p.wheel.mode(p.wheel.mode()); }); },
    snap:setSnap, get snapNow(){return {snap:T.snap, grace:T.grace};},
    /* THE RAIL, for the bench and for the headless checks -- `rail.set(k,v)` is
       the same call bench-page.html makes, so a number proved on the bench is
       the number the app runs. */
    get rail(){ return readerRail; },
    /* THE CONTENTS PANES THEMSELVES -- width, the white space between them,
       how far out they start and the shape of the way in. See PANE above. */
    pane:setPane, get paneNow(){return Object.assign({}, PANE);},
    /* THE PINCH -- its numbers, where the page has got to, and the gesture
       itself, so a bench (and this file's own checks) can drive it without a
       pair of fingers. `zoomFactor` is the one number that says how big the
       page is right now, at any point on the whole continuum. */
    pinch:setPinch, get pinchNow(){return Object.assign({}, PINCH);},
    get zoomFactor(){ return pinchLevel(); },
    get zoomArrival(){ return arrivalFactor(); },
    get pinchHeld(){ return pinchHold; },
    get pinchOn(){ return pinching; },
    /* THE ZOOM'S OWN STATE, read-only and in one place -- what factor is on the
       column, how far across it is standing, the point the word is being held
       at, the arrival it is travelling to, and whether the reader is still
       being brought to the word. A bench prints it; a check reads it; nothing
       here can be set from outside. */
    get zoomState(){
      return { z: pageZ, shift: shiftX, base: panBase,
               anchor: anchor ? { x: anchor.x, y: anchor.y } : null,
               k: arrived ? arrived.k : 0, seating: seating,
               chapter: wordChapterIdx, word: wordIdx };
    },
    pinchStart(x, y){ return beginPinch(x, y); },
    pinchScale(z){ return pinchTo(z); },
    pinchEnd(){ return endPinch(); },
    pan(px, py){ return panBy(px, py); },
    /* THE CURSOR -- one word view's own endpoint, and the voice's place.
       Read it, or set it from outside (a voice engine following along). */
    get cursor(){ return cursor ? {chapter:cursor.ch, word:cursor.wi} : null; },
    goTo(ch, wi){ return jumpTo(ch, wi, "goTo", false); },
    /* WHERE THE READER IS BY CHAPTER, AND HOW TO SEND IT TO ONE (7 Sep).
       Read-only over state this file already keeps: `curChapterIdx` is set by
       the reader's own scroll event (syncContentsLive), and `chIndexById` is
       built in openBook. Nothing is recomputed here -- the reading-line rule
       lives in readingLine()/sectionAt() and page.js has the only other copy
       of it; a page that merely wants to NAME the chapter must not add a
       third.
       `openChapter` is `?ch=` on open and nothing else. It takes a chapter id
       ("c018") or an index, and seats the reader with the same settle a
       contents row gets, because it is the same function. curChapterIdx is
       moved with it rather than waited for: the scroll event is a task away,
       and a caller that asks for a chapter and then reads chapterIdNow must
       not be told the old one. */
    get chapterNow(){ return curChapterIdx; },
    get chapterIdNow(){
      const c = book && book.chapters && book.chapters[curChapterIdx];
      return (c && c.id != null) ? c.id : null;
    },
    openChapter(k){
      let i = -1;
      if(typeof k === "number" && k === k) i = k;
      else if(k != null && chIndexById.has(String(k))) i = chIndexById.get(String(k));
      if(!(i >= 0) || !book || !book.chapters || !book.chapters[i]) return null;
      scrollReaderTo(i);
      curChapterIdx = i;
      return i;
    },
    /* THE SUBTITLE'S OWN TWO DOORS (job 24). `playing` is the app's -- set it
       from listen.js's play/pause and the line sleeps a second after the last
       wheel, tap or key while narration runs, and stays up when it does not.
       `subScrub(f)` is the rail's, exposed so a check (and a bench) can drag
       it without a pointer; the rail itself calls the same function. */
    get playing(){ return !!(wordPane && wordPane.isPlaying); },
    set playing(v){ setPlaying(v); },
    get subAwake(){ const p = pane(); return p ? p.awake : true; },
    subWake(){ wakeSub(); const p = pane(); return p ? p.awake : true; },
    subScrub(f){ return subSeek(f); },
    get subAt(){ return subFraction(); },
    /* the pane itself, for a bench that wants to measure its two elements --
       and the proof that the zoom is not on it: its rect is the same at +2 as
       it is at 0. */
    get wordPane(){ return pane(); },
    /* how much harder the axis pulls home from inside one word */
    get outSnap(){ return OUT_SNAP; }, set outSnap(v){ OUT_SNAP = +v || 1; },
    skip:setSkipOffscreen, get skipping(){return skipOffscreen;},
    /* THE ACTUAL ANIMATION. Osca: "YOU DID NOT FIX the animations, I CAN'T
       change the animation... that's just speed." Correct -- setSpeed only
       governs how fast dx TRAVELS. What actually animates on screen is
       wheel.js's own ribbon: a spring PER ROW, integrated every frame, with
       layout() writing a fresh transform, opacity and class to every row
       twice per frame, and the loop staying awake while any spring is still
       `restless` -- which is exactly the motion that carries on after your
       fingers stop. wheel.js has exposed mode()/amp() for this the whole
       time, including a "none" that turns the springs off outright; nothing
       here had ever called either. These drive every open pane at once, and
       write the same localStorage keys wheel.js reads on mount, so panes
       opened later come up the same way. */
    turns:["silk","ribbon","paper","leaf","none"],   // mirrors wheel.js's own RIB
    turn(name){
      try{ localStorage.setItem("turn", name); }catch(_){}
      leftPanes.forEach(p=>{ if(p && p.wheel && p.wheel.mode) p.wheel.mode(name); });
      return name;
    },
    amps:[0,1,2],
    amp(n){
      try{ localStorage.setItem("amp", String(n)); }catch(_){}
      leftPanes.forEach(p=>{ if(p && p.wheel && p.wheel.amp) p.wheel.amp(n); });
      return n;
    },
    get turnName(){ try{ return localStorage.getItem("turn")||"paper"; }catch(_){ return "paper"; } },
    get ampLevel(){ try{ return +(localStorage.getItem("amp")??1); }catch(_){ return 1; } }, get speedName(){return speedName;}, speeds:Object.keys(SPEEDS), get dx(){return dx;}, get screen(){return screen;},
           get maxLeft(){return currentMaxLeft();},
           // read-only, for this file's own tests: ONE WORD no longer mounts
           // a Wheel of its own to introspect (see the fifteenth pass's own
           // comment above), so wordIndex/wordCount are what stand in for it.
           get wordIndex(){return wordIdx;}, get wordCount(){return wordTotal();},
           // THE POSITIONS, out loud: which place the axis is standing on,
           // the whole list of them, and which band that place is in.
           get level(){return levelOf(dx);},
           get position(){return posNow();},
           get positions(){return positions();},
           go(p){ goPos(p); } };
}
window.BookNav = {mount};
})();
