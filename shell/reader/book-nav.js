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
   updateWordZoom() scales o.readerCol itself, transform-origin planted on
   that word's own on-screen box, driven straight off wordF (0 at the
   reader, 1 fully zoomed) every frame the zoom is live -- scrolling right
   zooms the page that was already there onto wherever the word actually
   is, "ON the page", rather than opening a second one elsewhere. The zoom
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
let OUT_SNAP=9;          // how hard that switch throws, either way
const WORD_COMMIT=0.5;   // past here on release, it commits to the word
const SPREAD_FROM=0.86;  // the zoom is done by here; only then do words part        // how much harder the pull home is, leaving one word

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
    pane:o.readerPane, column:o.readerCol,
    scrub:o.readerScrub, fill:o.readerFill, runhead:o.readerHead,
  }) : null;
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
    readerPage.wake();
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
    wordBox=null; wordBoxTried=false; wordSlideX=0;
    wordRect=null; wordTick=0; arrived=null;
    paintWordHighlight();
    // THE READER GOES TO THE ENDPOINT FIRST. The cursor may be a hundred
    // chapters from where you have been reading; zooming about a word that is
    // not on the screen means turning the page about a point outside it,
    // which puts the reader's own pane off the top of the screen and paints
    // nothing. So the book arrives at the word before the zoom starts.
    if(useCursor) seatOnWord();
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
        arrived = null; wordRect = null;      // measured again where it now is
        markPaint();                          // ...and applyDx has to be told
      }
      return Math.abs(d);
    };
    if(!host.scrollIntoView){                 // no browser here: the old sum
      const pr = pane.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      if(hr.top < pr.top + 8 || hr.bottom > pr.bottom - 8){
        const want = pane.scrollTop + (hr.top - pr.top) - pane.clientHeight*0.35;
        pane.scrollTop = want; programmaticTop = want; wordRect = null;
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
    wordIdx=next; wordBox=null; wordBoxTried=false; wordRect=null; arrived=null;
    subKey=null; markPaint();
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
    // THE ZOOM HAS NO MARGIN OF ITS OWN. Osca, 6 September: "the problem is
    // it's making this stupid margin, when in fact, zoomed in it whould have no
    // margin. It's just a zoom in. Allow me to cut them and keep them wide if
    // I'd like."
    //
    // It made one because only the TYPE grew. The paragraph kept the reading
    // column's own width -- 1000px on his window -- so 383px type re-wrapped
    // INSIDE it: two words to a line, and the measure's own empty sides left
    // standing on both sides of them. That is a re-set page, not a zoom.
    //
    // A zoom scales the box as well as the type. At wide=1 the paragraph's
    // width is multiplied by the same k as its font, so every line breaks
    // exactly where it broke on the page and what is on the screen is that
    // page, magnified -- and there is no margin, because the column is by then
    // wider than the view. At wide=0 it is released only as far as the view
    // itself and the lines re-wrap to fill it, with `edge` per cent of the view
    // kept back at the sides if a margin is wanted after all.
    wide:    1,      // 1 = the lines scale with the type (a true zoom, the
                     // breaks frozen); 0 = they re-wrap to fill the view
    edge:    0,      // % of the view kept as a margin when they re-wrap
    leverage: 3.2,   // the shape of the pull toward an off-screen word:
                     // 1 = a straight line, higher = harder away, softer in
    pulltime: 14,    // how long that pull takes (0 = never follow)
    carry:   0.55,   // how much of a push is kept as a tail (0 = none, as before)
    glide:   0.93,   // how long that tail lasts, per frame (higher = travels further)
    vmax:    240,    // the fastest that tail may run, in px of scroll a frame
    settle:  0.35    // how firmly the part-word left over settles onto a word
  };
  try{
    const saved = JSON.parse(localStorage.getItem("ttstv_word")||"null");
    if(saved) Object.keys(WORD).forEach(k=>{ if(typeof saved[k]==="number") WORD[k]=saved[k]; });
  }catch(_){}
  let wordBox = null;         // the real word's own rect + font, measured once per word
  let wordBoxTried = false;   // ...and attempted exactly once, never per frame
  let wordSlideX = 0;
  // The lifted-word overlay is gone (Osca: "NO LIFT"), and with it the
  // element it lived in and the highlight that hid the real word underneath
  // it. What you see zooming is the page's own word.


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

  // TWO DIFFERENT THINGS, KEPT APART.
  //   hostEl   -- the chapter the word is IN. True the whole time one word
  //               view is open, whatever position it is standing on.
  //   spreadEl -- the chapter that currently HAS the spacing on it, which is
  //               only ever true on the way to position +2.
  // They were one variable, and it cost the zoom outright: position +1 asks
  // for no spacing, spreadPage(0) called clearSpread(), clearSpread nulled the
  // element -- and computeArrived(), which needs the chapter to measure the
  // word in, found nothing and gave up. So position +1 rendered as no zoom at
  // all: the axis moved and the page sat still.
  let hostEl = null, spreadEl = null, spreadQ = -1;
  // THE HOST IS THE WORD'S OWN PARAGRAPH, NOT THE WHOLE CHAPTER.
  // Opening the spacing on a chapter re-wraps every line in it, and in a
  // chapter of any size that carries the word itself hundreds or thousands of
  // pixels down the page -- which the zoom then multiplies by k, and the view
  // lands somewhere the page is not. Scoped to the paragraph, only the lines
  // of that paragraph above the word can move it at all, and everything below
  // simply shifts down out of frame, where it was going anyway.
  function wordHost(){
    let el = null;
    const w = wordDomIndex[wordIdx];
    if(w && w.node){
      let p = w.node.parentNode;
      while(p && p.nodeType === 1){
        const d = p.ownerDocument && p.ownerDocument.defaultView;
        const disp = d && d.getComputedStyle ? d.getComputedStyle(p).display : "block";
        if(disp !== "inline") break;
        p = p.parentNode;
      }
      if(p && p.nodeType === 1) el = p;
    }
    if(!el) el = sections()[wordChapterIdx] || null;
    if(el !== hostEl){ clearSpread(); clearWordType(); hostEl = el; }
    return el;
  }
  function spreadPage(wordF){
    const el = wordHost();
    if(!el) return;
    // THE SPACING IS THE LAST THING THAT HAPPENS. Osca: "ALL I want is for
    // the page to zoom in completely, THEN continue the animation, just to
    // push the rest of the words out... I don't want to interfere with the
    // text formatting AT ALL, it's just a view thing" / "Just need to push
    // near words out, at the VERY LAST BIT."
    //
    // Opening it from the start of the gesture re-flowed the page while you
    // could still read it -- the text visibly re-set itself before the zoom
    // had gone anywhere, which is the formatting he does not want touched.
    // Held back to the last stretch, everything but the word is already off
    // the frame by the time it moves, so what it does is push the last
    // neighbours out of view and nothing else.
    const wc = wordF <= 0 ? 0 : (wordF >= 1 ? 1 : wordF);
    const e = wc<=0 ? 0 : (wc>=1 ? 1 : wc*wc*(3-2*wc));
    if(e <= 0){ clearSpread(); return; }   // spacing off -- the host stays
    spreadEl = el;
    el.classList.add("spreading");
    // HOW FAR IS NOT A TASTE SETTING. Position +2 means one word and nothing
    // else, so the gap is whatever actually clears the screen at the zoom
    // this word arrived at -- measured, not dialled. The sliders can only add
    // to it: his own were sitting at zero, which is why +2 did nothing at all.
    const g = spreadGaps();
    // in eighths: a re-flow per step of the gesture, not per frame. Nothing
    // visible is lost -- the zoom itself is continuous.
    const q = Math.round(e * 8) / 8;
    if(q !== spreadQ){
      spreadQ = q;
      el.style.setProperty("--wgap", (g.w * q).toFixed(2) + "px");
      el.style.setProperty("--lgap", (g.l * q).toFixed(3));
    }
  }
  // THE GAP THAT EMPTIES THE FRAME, in the frame the type is now IN. It used
  // to be divided by the scale, because a transform multiplied it after the
  // fact. Nothing multiplies it any more: word-spacing is an absolute length
  // on a paragraph whose own type has ALREADY grown, so the gap is simply the
  // distance the neighbour has to travel -- half a viewport, plus half the
  // grown word. The leading is a multiple of that same grown font, so it is
  // worked out against it, and page.css's own 1.5 is already part of the way
  // there (at 400px type, 1.5 leading is 600px of it).
  function spreadGaps(){
    const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    const k = (arrived && arrived.k) || 1;
    const w = ((arrived && arrived.w) || 20) * k;
    const h = ((arrived && arrived.h) || 20) * k;
    const f = Math.max(1, ((arrived && arrived.base) || 16) * k);
    return { w: Math.max(WORD.wordgap, vw/2 + w/2),
             l: Math.max(WORD.linegap, (vh/2 + h/2)/f - 1.5) };
  }
  function clearSpread(){
    if(!spreadEl) return;
    spreadEl.classList.remove("spreading");
    spreadEl.style.removeProperty("--wgap");
    spreadEl.style.removeProperty("--lgap");
    // --zoom is NOT cleared here. It belongs to the TYPE, and the type is
    // still grown at position +1 with the spacing off; clearWordType owns it.
    spreadEl = null; spreadQ = -1;
  }
  function clearWordZoom(){
    clearSpread(); clearWordType(); hostEl = null;
    if(o.readerPane && o.readerPane.classList) o.readerPane.classList.remove("zoomed");
    if(subEl){ subEl.style.opacity = "0"; subKey = null; }
    wordBox = null; wordBoxTried = false; wordSlideX = 0;
    clearZoomHost();
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

  // ONE WORD: A ZOOM AND A PUSH, AND NOTHING ELSE. Osca: "The zoom into page
  // / (NO LIFT) increase spacing, IS NOT WORKING PROPERLY, it doesn't look
  // like that, it's still lifting / fading things out - NO FADE, all it needs
  // to do is push spacing and zoom in."
  //
  // Everything else is gone: the word is no longer lifted into an overlay of
  // its own, the real word is no longer made transparent underneath one, and
  // the page no longer fades. The page zooms, and its words and lines are
  // driven apart as it does. That is the whole animation.
  //
  // HOW IT STAYS LOCKED ON THE WORD. Growing the leading moves the word down
  // the page while the zoom is running, so a transform worked out once from
  // the word's first position would drift off it. The word's own box is read
  // every frame instead, converted back through the transform that is
  // currently on it (origin 0 0, translate then scale, so the inverse is one
  // subtraction and one divide), and the next transform is built from where
  // the word IS. One rect read a frame, and only while the zoom is moving --
  // every other section on the page is skipped by content-visibility, so it
  // is one chapter's own layout, not the book's.
  // ARRIVED: THE STATE ONE WORD VIEW IS ALWAYS GOING TO.
  //
  // Osca: "there is still no defined END POINT, of the one word view. Make a
  // one word view - arrived. That should always be the same, the word centred,
  // ONE WORD, nothing else. You need that bit, so it knows what it's getting
  // to EVERY TIME, right now it doesn't know, so getting there confuses it."
  //
  // Exactly the fault. Every version so far worked the zoom out FROM WHATEVER
  // IT COULD SEE, frame by frame -- and the spacing was moving the word while
  // it looked, so the target moved too, and the transition chased it. Hence
  // the drift, the stalls at the wrong size, and the freezes (a read and a
  // write in the same frame, sixty times a second, on a chapter this size).
  //
  // ARRIVED is now computed ONCE, when the gesture begins, and it is a fixed
  // set of numbers:
  //
  //     the word's centre lands on the centre of the view
  //     at the scale that makes it WORD.fill of the width (or fillH of the
  //     height, whichever binds)
  //     with the spacing fully open around it
  //
  // It is measured with the spacing ALREADY APPLIED -- one reflow, one
  // measurement -- so the number is the truth about where the word will be,
  // not where it was before everything moved. The transition is then a plain
  // interpolation from nothing to that, with no measuring at all in between:
  // which is why it cannot drift, and cannot thrash layout.
  // ---- THE TYPE IS THE ZOOM, AND ONE WRITER OWNS IT.
  //
  // Nothing it writes is a transform. `font-size` goes on the word's own
  // paragraph -- page.css sets the reading sizes in rem, which is
  // root-relative and would ignore anything set on the chapter, so the
  // multiplier has to land on the paragraph itself (shell.css says exactly
  // this) -- and `position:relative` + left/top nudge that paragraph's own
  // box so the word lands in the middle of the view. A relative offset moves
  // the painted box and leaves the flow, the layer, and
  // getComputedStyle(...).transform alone, which is the whole point of it.
  let zoomHost = null, zoomBase = 0, zoomK = 1, zoomDx = 0, zoomDy = 0, zoomW = 0;
  // the type this word is actually set in, read off the cascade rather than
  // guessed at. Headless there is no cascade, and a range's own height is
  // page.css's 1.5 leading, so that is the fallback.
  function fontBase(el){
    let px = NaN;
    try{
      const d = el.ownerDocument && el.ownerDocument.defaultView;
      if(d && d.getComputedStyle) px = parseFloat(d.getComputedStyle(el).fontSize);
      else if(typeof getComputedStyle === "function") px = parseFloat(getComputedStyle(el).fontSize);
    }catch(_){}
    return px > 0 ? px : 0;
  }
  function clearWordType(){
    const el = zoomHost;
    zoomHost = null; zoomBase = 0; zoomK = 1; zoomDx = 0; zoomDy = 0; zoomW = 0;
    if(!el) return;
    el.style.removeProperty("font-size");
    el.style.removeProperty("--zoom");
    el.style.removeProperty("position");
    el.style.removeProperty("left");
    el.style.removeProperty("top");
    el.style.removeProperty("width");
    el.style.removeProperty("max-width");
    el.style.removeProperty("z-index");
    if(el.classList) el.classList.remove("wordzoom");
  }
  function writeWordType(el, base, k){
    if(!el) return;
    if(zoomHost && zoomHost !== el) clearWordType();
    zoomHost = el; zoomBase = base; zoomK = k;
    el.style.setProperty("--zoom", k.toFixed(4));
    el.style.setProperty("font-size", (base * k).toFixed(2) + "px");
    el.style.setProperty("position", "relative");
    // AND WHAT IS UNDER IT IS THE SAME PAGE, NOT A SECOND ONE. The zoom is one
    // paragraph's, so the rest of the page stays at reading size underneath --
    // and a word four hundred pixels tall standing over lines of 29px reads as
    // two pages at once, which is what "HUGELY messed up" was looking at as
    // much as the margin was. page.css gives this class the page's own ground,
    // so what is behind the zoom is the page's colour and nothing else; the
    // bench can hand back `--zoom-back: transparent` to see the lines again.
    // The z-index is paint order only -- every .unit is position:relative, so
    // without it the paragraphs after this one in the document paint over the
    // top of it. Nothing is lifted, nothing rasters: "LEAVE IT, ON THE PAGE."
    el.style.setProperty("z-index", "1");
    if(el.classList) el.classList.add("wordzoom");
  }
  function writeWordOffset(el, dx, dy){
    if(!el) return;
    zoomDx = dx; zoomDy = dy;
    el.style.setProperty("left", dx.toFixed(1) + "px");
    el.style.setProperty("top",  dy.toFixed(1) + "px");
  }
  // THE COLUMN IS PART OF THE ZOOM. page.css holds the paragraph to the
  // chapter's measure, which is right for reading and wrong for a zoom: type
  // that grows inside a width that does not is a page RE-SET, and it shows as
  // the margin Osca is looking at. So the width is written by the same hand
  // and on the same easing as the font, and `max-width` -- .chapter's own
  // calc(100% - 3rem) reaching the paragraph through the cascade -- is taken
  // off it for as long as the zoom is on.
  function writeWordWidth(el, px){
    if(!el || !(px > 0)) return;
    zoomW = px;
    el.style.setProperty("width", px.toFixed(1) + "px");
    el.style.setProperty("max-width", "none");
  }
  // WHAT THE WIDTH IS MULTIPLIED BY AT FULL ZOOM, against the width the
  // paragraph has on the page. `wide` chooses between the two honest answers:
  //   1  the same k as the type -- nothing re-wraps, the page is magnified
  //   0  whatever fills the view -- the lines re-set to the screen, with
  //      `edge` per cent of it kept back at the sides
  // and anything between is a mix of the two.
  function zoomWidthMul(){
    if(!arrived || !(arrived.cw > 0)) return 1;
    const vw = window.innerWidth || 1;
    const keep = 1 - 2 * clamp(WORD.edge, 0, 45) / 100;
    // and it MAY come in narrower than the page's own measure: a floor at 1
    // made the margin slider dead for its whole upper half, since a column
    // already 1000px wide inside 1710 is past the view the moment a third of
    // it is kept back. The only floor is one that stops it collapsing.
    const fit  = Math.max(0.2, (vw * keep) / arrived.cw);
    const w    = clamp(WORD.wide, 0, 1);
    return fit + w * (arrived.k - fit);
  }

  // ARRIVED: THE STATE ONE WORD VIEW IS ALWAYS GOING TO.
  //
  // Osca: "there is still no defined END POINT, of the one word view. Make a
  // one word view - arrived. That should always be the same, the word centred,
  // ONE WORD, nothing else. You need that bit, so it knows what it's getting
  // to EVERY TIME, right now it doesn't know, so getting there confuses it."
  //
  // It is four numbers, computed ONCE when the gesture begins, and every one
  // of them is measured with the type back at rest and the spacing off:
  //
  //     base   the px the word is really set in, off the cascade
  //     k      the multiplier that makes it WORD.fill of the width (or fillH
  //            of the height, whichever binds), capped at WORD.maxzoom
  //     w, h   the word's own untouched box
  //
  // The two the old transform needed -- where to translate to, and how far the
  // spacing then moved the word -- are gone with it. A re-flow cannot be
  // predicted by arithmetic, so where the word LANDS is read once a frame
  // instead (updateWordZoom), which is one rect on one paragraph and is
  // exact in a way the two-measurement guess never was.
  let arrived = null;    // {base, k, w, h} -- all of it pre-zoom
  function computeArrived(){
    const host = wordHost();
    if(!o.readerBox || !host) return null;
    // MEASURED WITH THE TYPE AT REST. The zoom is a layout now, so the word
    // has to be measured with the paragraph back at its own size -- otherwise
    // the multiplier is worked out against type that is already multiplied,
    // and it compounds. One reflow, at a moment when one is due anyway
    // (it happens when you STEP, never inside the frame loop).
    const had = {
      c: host.classList.contains("spreading"),
      w: host.style.getPropertyValue("--wgap"),
      l: host.style.getPropertyValue("--lgap"),
      f: host.style.getPropertyValue("font-size"),
      z: host.style.getPropertyValue("--zoom"),
      x: host.style.getPropertyValue("left"),
      y: host.style.getPropertyValue("top"),
      W: host.style.getPropertyValue("width"),
      M: host.style.getPropertyValue("max-width"),
    };
    const put = (k, v) => { if(v) host.style.setProperty(k, v); else host.style.removeProperty(k); };
    const putBack = () => {
      if(had.c) host.classList.add("spreading");
      else { host.classList.remove("spreading"); spreadEl = null; }
      put("--wgap", had.w); put("--lgap", had.l);
      put("font-size", had.f); put("--zoom", had.z);
      put("left", had.x); put("top", had.y);
      put("width", had.W); put("max-width", had.M);
      spreadQ = -1;                   // those writes bypassed the quantiser
    };
    const rectNow = () => {
      const r = currentWordRange();
      if(!r) return null;
      const rects = r.getClientRects();
      const b = rects.length ? rects[0] : r.getBoundingClientRect();
      return (b && b.width > 0) ? b : null;
    };

    // THE WORD AS IT SITS ON THE PAGE: no growth, no spacing, no offset.
    host.classList.remove("spreading");
    host.style.removeProperty("--wgap"); host.style.removeProperty("--lgap");
    host.style.removeProperty("font-size"); host.style.removeProperty("--zoom");
    host.style.removeProperty("left"); host.style.removeProperty("top");
    host.style.removeProperty("width"); host.style.removeProperty("max-width");
    const a = rectNow();
    if(!a){ putBack(); return null; }

    // THE WORD HAS TO BE ON THE SCREEN BEFORE THERE IS AN ARRIVAL. The cursor
    // can be a hundred chapters from where you were reading; an arrival about
    // a point that is not in the view centres the page on somewhere off
    // screen and everything visible goes blank. Caught exactly that in
    // Chrome: reader in chapter 36, cursor in 34, white page. So the reader is
    // brought to the word first and the arrival worked out on the next pass.
    const vh0 = window.innerHeight || 1;
    if(o.readerPane && (a.bottom < 8 || a.top > vh0 - 8)){
      // ...and while the seat above is still closing the gap, this waits: two
      // hands on the same scroller, one of them working from a skipped
      // section's placeholder numbers, is how the page used to walk away from
      // the word instead of arriving at it.
      if(!seating){
        const pr = o.readerPane.getBoundingClientRect();
        const want = o.readerPane.scrollTop + (a.top - pr.top) - o.readerPane.clientHeight*0.35;
        o.readerPane.scrollTop = want;
        programmaticTop = want;
      }
      putBack();
      return null;
    }

    const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    const w0 = a.width, h0 = a.height;        // untouched: the type is at rest
    const k = Math.max(1, Math.min(WORD.maxzoom,
                Math.min(WORD.fill*vw/Math.max(1,w0), WORD.fillH*vh/Math.max(1,h0))));
    // ...and the paragraph's own width at rest, which is what the zoom
    // multiplies. Read in the same breath as the word, with everything off.
    const cw = host.getBoundingClientRect ? (host.getBoundingClientRect().width || 0) : 0;
    const out = { base: fontBase(host) || h0/1.5, k, w: w0, h: h0, cw };
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
  let subEl = null;
  function wordSub(){
    if(subEl) return subEl;
    const host = o.bookEl || (o.readerBox && o.readerBox.parentNode) || null;
    if(!host || !host.appendChild) return null;
    subEl = document.createElement("div");
    subEl.classList.add("wordsub");
    subEl.setAttribute("aria-hidden", "true");
    const a = document.createElement("span"), b = document.createElement("b"),
          c = document.createElement("span");
    subEl.append(a, b, c);
    host.appendChild(subEl);
    return subEl;
  }
  let subKey = null;
  function paintWordSub(f){
    const el = wordSub();
    if(!el) return;
    const on = f > 0;
    const o1 = on ? String(Math.min(1, f * 1.6).toFixed(3)) : "0";
    if(el.style.opacity !== o1) el.style.opacity = o1;
    if(!on) return;
    const w = wordDomIndex[wordIdx];
    const key = wordChapterIdx + ":" + wordIdx;
    if(key === subKey) return;                 // one write per word, not per frame
    subKey = key;
    const line = w && w.p ? (w.p.textContent || "") : "";
    const kids = el.children || [];
    if(w && line){
      if(kids[0]) kids[0].textContent = line.slice(0, w.start);
      if(kids[1]) kids[1].textContent = line.slice(w.start, w.end);
      if(kids[2]) kids[2].textContent = line.slice(w.end);
    }else{
      if(kids[0]) kids[0].textContent = "";
      if(kids[1]) kids[1].textContent = wordTextAt(wordIdx) || "";
      if(kids[2]) kids[2].textContent = "";
    }
  }

  let spreadNow = 0;
  function updateWordZoom(wordF){
    if(!o.readerBox) return;
    if(wordF <= 0){ clearWordZoom(); return; }

    // THE ARRIVAL FIRST. The gap that empties the frame is worked out from the
    // scale this word arrived at, so spreading before there is an arrival
    // would write one frame of a gap computed against no zoom at all -- half a
    // viewport of word-spacing, and a re-flow to go with it.
    if(!arrived) arrived = computeArrived();
    if(!arrived) return;
    spreadPage(spreadNow);            // position +2's own progress, quantised

    const host = wordHost();
    if(!host) return;
    const wc = WORD.curve === 1 ? wordF : Math.pow(wordF, WORD.curve);
    const e  = wc<=0 ? 0 : (wc>=1 ? 1 : wc*wc*(3-2*wc));

    // THE TYPE GROWS, AND THEN THE WORD IS FOUND AGAIN. Growing the paragraph
    // moves the word inside it -- its line-mates before it push it along, its
    // own leading pushes it down -- and so does the spacing at +2. No
    // arithmetic predicts where a re-flow lands, so it is READ: one rect after
    // the write, and the paragraph's own box is nudged by the difference,
    // eased by the same e as the growth. Both ends are fixed points -- e=0 is
    // the word exactly where the page put it, e=1 is the centre of the view --
    // so the word cannot drift on the way, and stepping cannot move it off
    // centre once it is there.
    writeWordType(host, arrived.base, 1 + e*(arrived.k - 1));
    // the column opens with the type, so nothing re-wraps on the way in and
    // there is no measure left to leave a margin at the sides
    writeWordWidth(host, arrived.cw * (1 + e*(zoomWidthMul() - 1)));
    if(o.readerPane) o.readerPane.classList.add("zoomed");
    const r = currentWordRange();
    const rects = r ? r.getClientRects() : null;
    const b = rects && rects.length ? rects[0] : (r ? r.getBoundingClientRect() : null);
    if(b && b.width > 0){
      const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
      writeWordOffset(host,
        e * (vw/2 - (b.left + b.width/2  - zoomDx)),
        e * (vh/2 - (b.top  + b.height/2 - zoomDy)));
    }
  }

  function clearZoomHost(){ wordRect = null; wordTick = 0; arrived = null; }

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
    exitWord();
    chIndexById = new Map((book.chapters||[]).map((c,i)=>[c.id,i]));
    destroyPane(1); destroyPane(2);      // a previous book's own deeper panes, if any
    if(readerPage){ o.readerPane.scrollTop=0; readerPage.render(book); }
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
  function goPos(p){ setDx(p); dxVel = 0; dxInput = 0; detent = false; }

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
  // So the growth is a font-size on the word's own paragraph now
  // (writeWordType), and from the word up to #readerbox there is no transform
  // at all: sharp at 400px, and no layer for WebKit to allocate.
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
    const laid = (window.Panes ? window.Panes.measure({
      n, dx, vw: window.innerWidth || 0, first: marginW,
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

  let dxIdle=0;
  function stepDx(dt){
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
      dxVel *= Math.pow(T.decay, dt);
      if(dx<=-currentMaxLeft() || dx>=1) dxVel=0;
      dxIdle=0;
    } else {
      dxVel *= Math.pow(T.decay, dt);
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
      let goal = target, grip = T.snap;
      if(dx > 0 && dx < 1){
        goal = dx >= WORD_COMMIT ? 1 : 0;
        grip = T.snap * OUT_SNAP;
      }else if(dx > 1 && dx < 2){
        goal = (dx - 1) >= WORD_COMMIT ? 2 : 1;
        grip = T.snap * OUT_SNAP;
      }
      if(Math.abs(dx-goal) > DX_REST) setDx(dx + (goal-dx)*Math.min(1, grip*dt));
    }
  }

  let lastT=0;
  function tick(now){
    const dt = lastT ? Math.min(3,(now-lastT)/16.667) : 1;
    lastT=now;
    if(screen==="open") {
      stepDx(dt);
      if(levelOf(dx)==="word") coastWord(dt);
      stepPull(dt);                        // the travel toward an off-screen word
      applyDx(false);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // DOUBLE-CLICK A WORD, ANYWHERE IN THE BOOK. Osca: "Let me double click a
  // word, to bring one word view endpoint/origin AND the voice to there (just
  // connect it with the book."
  //
  // The browser's own double-click already selects the word under the pointer,
  // which is exactly the range wanted -- no hit-testing of our own, and it
  // agrees with what the reader saw highlighted for that instant. It is then
  // matched back to this chapter's word index so the cursor is a POSITION in
  // the book rather than a range that a re-render would invalidate.
  if(o.readerCol) o.readerCol.addEventListener("dblclick", e => {
    if(!book) return;
    const sel = window.getSelection && window.getSelection();
    if(!sel || !sel.rangeCount || sel.isCollapsed) return;
    const node = sel.anchorNode;
    const p = node && (node.nodeType===3 ? node.parentNode : node);
    const sec = p && p.closest && p.closest(".chapter");
    if(!sec || sec.classList.contains("titlepage")) return;
    const ch = +sec.getAttribute("data-ch");
    if(!(ch >= 0)) return;
    // build (or reuse) that chapter's own index and find the word by its own
    // text node and offset -- the same identity buildWordDomIndex uses.
    if(ch !== wordChapterIdx){
      wordChapterIdx = ch;
      wordWords = wordsOf(book.chapters[ch]);
      wordDomIndex = buildWordDomIndex(ch);
    }
    const start = sel.anchorOffset;
    let hit = -1;
    for(let i=0;i<wordDomIndex.length;i++){
      const w = wordDomIndex[i];
      if(w.node === node && start >= w.start && start < w.end){ hit = i; break; }
    }
    if(hit < 0){                       // a click between words: nearest in that <p>
      for(let i=0;i<wordDomIndex.length;i++)
        if(wordDomIndex[i].p === (p.closest && p.closest("p"))){ hit = i; break; }
    }
    if(hit < 0) return;
    wordIdx = hit;
    setCursor(ch, hit, "double-click");
    paintWordHighlight();
    if(sel.removeAllRanges) sel.removeAllRanges();   // leave the mark, not a selection
    markPaint();
  });

  // ---------------------------------------------------------------- INPUT
  addEventListener("wheel", e=>{
    inputTick++;
    if(screen!=="open") return;
    if(levelOf(dx)==="word"){
      // down/up reads on (the finest grain there is); left/right only
      // leaves the view -- same two rules as everywhere else, applied here.
      if(Math.abs(e.deltaY) >= Math.abs(e.deltaX)){
        if(Math.abs(e.deltaY)>0){ e.preventDefault(); bumpWord(e.deltaY); }
        return;
      }
      e.preventDefault();
      dxInput += e.deltaX*T.gain;
      return;
    }
    if(Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;   // vertical: the reader's own scroll
    e.preventDefault();
    if(dx<=-currentMaxLeft() && e.deltaX<0){
      // past the deepest pane this book's own trail actually has, a
      // deliberate push goes straight back to the library -- one gate,
      // however many panes were open along the way.
      exitAccum += -e.deltaX;
      if(exitAccum>EXIT_PUSH){ closeToLibrary(); exitAccum=0; }
      return;
    }
    exitAccum=0;
    dxInput += e.deltaX*T.gain;
  }, {passive:false});

  addEventListener("keydown", e=>{
    inputTick++;
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
    /* THE CONTENTS PANES THEMSELVES -- width, the white space between them,
       how far out they start and the shape of the way in. See PANE above. */
    pane:setPane, get paneNow(){return Object.assign({}, PANE);},
    /* THE CURSOR -- one word view's own endpoint, and the voice's place.
       Read it, or set it from outside (a voice engine following along). */
    get cursor(){ return cursor ? {chapter:cursor.ch, word:cursor.wi} : null; },
    goTo(ch, wi){
      if(!book || !book.chapters || !book.chapters[ch]) return null;
      if(ch !== wordChapterIdx){
        wordChapterIdx = ch;
        wordWords = wordsOf(book.chapters[ch]);
        wordDomIndex = buildWordDomIndex(ch);
      }
      wordIdx = clamp(+wi||0, 0, Math.max(0, wordTotal()-1));
      /* AND THE ZOOM GOES WITH IT. stepWord throws away the word's own
         measurements when it moves -- wordBox, wordRect and above all
         `arrived`, the fixed state one word view is travelling to -- so the
         next frame measures the new word. goTo did not, so the cursor and the
         highlight moved on while the zoom stayed on whatever word it had
         arrived at: reader 22c measured 0 transform changes over 54 advances,
         where stepping by hand goes scale(7.4874) -> scale(14.3622). A jump
         has no direction, so it takes no lateral slide -- that part of
         stepWord is about reading ON, not about arriving somewhere. */
      wordBox = null; wordBoxTried = false; wordRect = null; arrived = null;
      wordSlideX = 0; subKey = null;
      setCursor(ch, wordIdx, "goTo");
      paintWordHighlight(); markPaint();
      return {chapter:ch, word:wordIdx};
    },
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
