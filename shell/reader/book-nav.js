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
/* LEAVING THE BOOK HAS ITS OWN SPEED. Osca, 9 Sep, on the old cut: *"rn it
   just shoots out, little too fast, and no animation."* The animation is the
   travel `closeToLibrary` now runs; this is its DURATION, in the same units as
   OUT_SNAP -- higher is shorter. 6 (the word's own value) came out at 15 frames
   / ~250ms and is the "little too fast" he named before he had even seen it;
   3 is ~28 frames / ~470ms. `nav.leaveSnap` reads and writes it, and the value
   is remembered, so it is dialled once from the console or a bench and stays. */
let LEAVE_SNAP=3;
/* HOW FAR OUT OF THE BOOK COUNTS AS LEAVING IT, decided on release exactly as
   WORD_COMMIT decides the word. Half of the rung past the last pane. */
const LEAVE_COMMIT=0.5;
/* ...and how far ONE event may carry you into it. The zone has resistance: a
   single push -- however big -- moves you a step of it, so getting out of a
   book is always a TRAVEL of several, never one flick that happened to be hard.
   That is the other half of "do not push me": momentum cannot spend the whole
   zone, and neither can one clumsy swipe. */
const LEAVE_STEP=0.12;
/* HOW FAR INTO A RUNG A PUSH MUST GET FOR THE RELEASE TO COMMIT TO IT.
   0.5 is the old rule (ease to whichever rung is nearest). Lower is stickier:
   at 0.2, a fifth of a pane's worth of scroll takes you to the next pane. */
let STICK=0.5;
/* ============ THE RUNG IS CHOSEN BEFORE THE ANIMATION ============
   Osca, 9 September: *"it should round up or down a movement, depending on how
   much it is -- calculate BEFORE the animation and move accordingly. Because
   right now it's impossible to move through it smoothly: everything involves
   pushing too far, or pushing too little, nothing actually hits the mark to a
   particular pane arrangement."*

   The pane ladder was the last stretch of this axis that still moved WITH the
   hand and only rounded once the hand stopped (the rest branch of stepDx). So
   every gesture overshot a real arrangement and then crawled back out of it,
   and it was the visible correction that felt inexact. Both word stretches and
   the way out of the book already work the other way round -- decide on the
   push, then TRAVEL (snapStart) -- and the ladder now joins them.

   Dialled on design/reader/bench-panes.html, 9 Sep, and these are his numbers:

     STICK      where the rounding line sits. 0.5 is round-up/round-down.
     OPEN       how much a rung resists being opened PAST. Directional: Osca,
                *"a PANE shouldn't hold you, i.e. stop you from scrolling out of
                it. It should only hold from moving PAST it... leaving is VERY
                easy, no controls on that."* It is SPENT, not held, so the
                travel starts where the resistance ended.
     OPENS      how many panes one gesture may OPEN. The ceiling is on DEPTH
                only -- a gesture may always come all the way home in one move.
     PAST_AT    ...unless you scroll very very fast, when the ceiling lifts.
     PANE_SNAP  how fast the ladder runs to the rung it chose, in OUT_SNAP's own
                units (higher = shorter). 7 is ~12 frames / ~200ms; the bench's
                equivalent fraction was 0.26. */
let OPEN=0.18, OPENS=1, PAST_AT=0.075, PANE_SNAP=7;
/* HOW LONG THE ZOOM TAKES, in OUT_SNAP's units (higher is shorter). 6 is the
   word SWITCH's speed and far too quick for the zoom itself -- four frames,
   measured. 2 is ~600ms and is a zoom you can watch. */
let WORD_SNAP=2;
let OUT_SNAP_=6;         // how hard that switch throws, either way -- a
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
  /* the contents wait while the axis is on the word side (syncContentsLive) */
  let contentsOwed = false;
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
  addEventListener("resize", ()=>{ paneWidthsStale=true; readerFloor=0; invalidateSections(); applyOffscreenSkip();
    if(wordView && wordView.resize) wordView.resize(); markPaint(); });
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
    /* ON THE WORD SIDE THE CONTENTS WAIT (10 Sep). The only scrolls of the page
       while the axis is off it are the transition's own -- seating a cursor
       from another chapter before the zoom, putting the page back at the word
       under the view before the zoom out -- and each one re-lit the contents
       wheel for a chapter change nobody can see: wheel.js then restyled its
       rows every frame while its springs settled (4,300 elements, 60-256ms a
       frame, measured in the trace) -- DURING the zoom, 41 frames of it once.
       The panes are shut from 0 up, so they catch up once, when you are home. */
    if(dx > DX_REST){ contentsOwed = true; return; }
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
    /* THE INDEX IS KEPT WHILE IT IS STILL THE PAGE'S. Rebuilding it is a walk of
       every line of the chapter -- on the complete Shakespeare a whole play, on
       the first frame of the zoom -- and the cursor's own click has usually just
       built it. Same chapter, and its first node still in the document, is the
       same index. */
    const kept = ch === wordChapterIdx && wordDomIndex.length
              && wordDomIndex[0].node && wordDomIndex[0].node.isConnected !== false;
    wordChapterIdx=ch; wordAccum=0; wordVel=0;
    if(!kept){
      wordWords=wordsOf(book.chapters[ch]);
      wordDomIndex=buildWordDomIndex(ch);
    }
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
  /* ============ WHEN THE VIEW HAS THE SCREEN, THE PAGE IS FURNITURE ============
     Osca: *"one word view is a STABLE thing, in its own right... Words should
     not move inside it, just one, next one, reduce animation as much as
     possible inside this view."*

     Everything below that keeps the PAGE honest -- holding the word under the
     anchor by scrolling, the reading momentum and its tail -- is about a page
     you can see. Past +1 you cannot: the view is opaque and inset:0. Left
     running behind it, those loops were measured stepping twelve words and
     carrying the page 22,419 -> 374,562px, because each step re-seats the
     cursor, the page follows the cursor, and the page's own position then
     re-derives the cursor again. That is the runaway, and it is exactly the
     *"2 separate positions in the text"* of 9 September: twelve steps in the
     view came back out on a word next to the one it went in on, having read
     twelve unrelated words on the way ("addition", "life,", "shirts",
     "races"...) taken off wherever the page had been flung to.

     So they stop at the view's door. The page is left exactly as the view came
     up and `putBackWord` takes it to the word on the way out -- one move,
     under control, instead of hundreds nobody can see. */
  function viewHasTheScreen(){ return !!(wordView && wordView.showing); }

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
    if(viewHasTheScreen()){
      /* ONE DETENT, ONE WORD, AND NO TAIL. The carry and the glide are the
         reading pace on the PAGE (Osca: "carries on a little after you
         scroll... dictating your own pace"), and they are right there. In the
         view they are the animation he asked to have taken out, and worse: a
         tail that keeps feeding words after the hand has stopped is a cursor
         still travelling when you come out, so you leave from somewhere you
         never chose. */
      wordVel = 0;
      wordAccum += delta;
      const px = wordStepPx();
      if(wordAccum >= px){ stepWord(1); wordAccum = 0; }
      else if(wordAccum <= -px){ stepWord(-1); wordAccum = 0; }
      return;
    }
    wordAccum += delta;
    wordVel = wordVel*0.55 + delta*WORD.carry;
    const cap = WORD.vmax > 0 ? WORD.vmax : 0;
    if(wordVel > cap) wordVel = cap; else if(wordVel < -cap) wordVel = -cap;
    drainWord();
  }
  // called every frame while ONE WORD is the level -- the tail, and the way
  // the leftover part-word settles once the tail has died.
  function coastWord(dt){
    if(viewHasTheScreen()){ wordVel = 0; wordAccum = 0; return; }
    if(!wzReads()){ wordVel = 0; wordAccum = 0; return; }   // mid-zoom: nothing reads on
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
    /* ============ ONE HEIGHT, AND EVERY WORD IS IT ============
       Osca, 10 September: *"there IS no variation in height, of words, only
       length, in the one word view"* -- and, on what that height should be:
       *"I want a dial... it's just a question as to what that height should
       be, which does not need to be answered now."*

       So this is the dial, and it is the ONLY answer to how big a word is:
       one em, as a fraction of the reference height. Every word is drawn at
       it, whatever it says. `fill`/`fillH` are gone with the rule they served
       -- fitting each word to the frame made height a function of word LENGTH,
       which is exactly the inconsistency measured in pixels on 10 September
       (three-letter "You" at 22.3% of the frame against three-letter "and" at
       38.8%, same window, same file). There is nothing left to measure, so
       there is nothing left for the bench, the shell and the app to disagree
       about.

       This is also what the ZOOM aims at -- see wordFontPx and computeArrived.
       The page magnifies until the cursor word IS this size and then hands
       over, so the two pictures already match and the handover is not an
       animation at all. */
    height:  0.12,   // the word's em, as a fraction of the reference height
    pageZ:   7,      // the page's own zoom behind
    /* THE MOST THE VERTICAL HOLD MAY MOVE THE PAGE IN ONE FRAME, in screen px.
       The hold closes the gap between where the word IS and where it should
       be; unbounded, a target that is itself moving turns that into a runaway
       (see AND THE CORRECTION IS BOUNDED, in updateWordZoom). 60px a frame is
       3,600 a second -- four screens -- so nothing legitimate is slowed, and
       nothing illegitimate gets off the screen before the next measurement. */
    holdMax: 60,
    /* HOW FAR TOWARD THE VIEW A SCROLL ZOOMS, as a fraction of the factor the
       word would arrive at. 1 would put the page at the size the view draws it
       and leave nothing to cut to; low numbers are Osca's "too far apart"
       (3.5x flat, then 0.5 -- which still left the word at 23% of the width
       against the view's 78%). */
    /* (zoomFill/zoomFillH are gone, 9 Sep: the scroll's cap IS `fill`/`fillH`
       now, so the page and the view can never disagree about how big a word
       is. A second pair of numbers for the same question is a drift waiting
       to happen, and it drifted -- 28% against 78%, measured.) */
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
    // arrival used to be worked out against the view -- a fraction of its width
    // or its height -- and on a phone that made rotating it re-set the type:
    // 0.55 of 844 was a 464px word in portrait and 0.55 of 390 was 214 in
    // landscape, the same word, twice the size, for turning the thing over.
    // (The fractions are gone; `wordFontPx` keeps this rule, reading the dial
    // against the SHORT side on a phone for exactly the same reason.) So
    // on a screen whose SHORT side is at or under this mark, both terms are
    // measured against that short side, and k comes out identical either way
    // up. Above it -- every desk -- nothing changes: 1280x800's short side is
    // 800. Same mark as pane.js's `narrowH`, and the same idea: this is a
    // phone.
    shortside: 500,
    // WHICH LAW THE FACTOR FOLLOWS between the page and the word, for the css
    // zoom the pinch's band ran on (gone, 11 Sep -- nothing reads this now):
    // "power" is z = k^dx, a constant zoom RATE per unit of the axis; "smooth"
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
  function forgetPageZoomWrites(){
    lastZoomS = null; lastLeftS = null; lastPosSet = false;
    lastZoomN = 0; lastTransS = ""; zoomOriginS = null;
  }
  function thawMeasure(){
    const col = o.readerCol;
    measureFrozen = false;
    if(!col || !col.style) return;
    try{ MEASURED.forEach(k => col.style.removeProperty(k)); }catch(_){}
  }
  let lastZoomS = null, lastLeftS = null, lastPosSet = false;
  let lastZoomN = 0, lastTransS = "", zoomOriginS = null;
  /* HOW FAR A TRANSFORM MAY CARRY THE FACTOR before a real zoom is written
     again. 1.18 is about a sixth: on a 3.3x travel that is seven crisp steps
     and seven 75ms recalcs instead of sixty. Raise it for fewer, softer steps;
     lower it for more, sharper, slower ones. */
  const ZQ = { step: 1.18 };
  let atZoomRest = false;      // set by applyDx when the axis has stopped
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
    /* ============ NOTHING IS WRITTEN THAT HAS NOT CHANGED ============
       Counted 10 September, per frame of the zoom on the complete Shakespeare:
       `zoom` was being written 1.92 times a frame, and a zoom write on that
       column costs 85ms of layout on its own. The second write is the sideways
       hold (below) re-writing the SAME factor with a new `left` -- it wants the
       offset, not the factor, and it was paying for both.

       So each of the three is compared with the last value actually written and
       skipped when it matches. Same picture, a third of the layouts. */
    /* ============ CRISP IN STEPS, COMPOSITED IN BETWEEN ============
       Measured 10 September with Chromium's own counters, over one 0 -> 1
       travel on the complete Shakespeare:

           RecalcStyleDuration   4.276 s      <-- of 7.9s wall
           LayoutDuration        0.913 s
           ScriptDuration        0.063 s

       The script is nothing. The layout is not much. It is STYLE RECALC, and
       `zoom` is why: Chromium carries an effective zoom on every descendant's
       computed style, so one write on the reading column invalidates all
       152,374 paragraphs of it. Timed alone, one zoom write here costs 75ms --
       a twelve-frames-a-second ceiling before a single other thing happens --
       and the same magnification written as a TRANSFORM costs 0ms, because a
       transform is composited and touches no style at all.

       So the factor is written as `zoom` only in STEPS, and the travel between
       two steps is carried by a transform. The type is real type at every step
       (the whole point of `zoom` here: WebKit will not re-raster a scaled layer
       and Osca's Mac showed a 26.818px word blown up sixteen times), and a step
       is close enough -- QSTEP -- that what the transform carries is never more
       than a sixth, which is inside what raster gives you for free.

       The origin is the word itself, taken once when the step is written, so
       everything between two steps grows about the word and it does not move.
       At rest the transform is gone and the page is layout again: scenario 31's
       "nothing on the chain carries a transform" is a claim about the resting
       page and it stays exactly true. */
    const zs = z.toFixed(5), ls = (dx / z).toFixed(2) + "px";
    const need = (lastZoomN === 0) || atZoomRest
              || z / lastZoomN > ZQ.step || lastZoomN / z > ZQ.step;
    if(need){
      if(lastTransS !== ""){ lastTransS = ""; col.style.removeProperty("transform");
        col.style.removeProperty("transform-origin"); }
      if(lastZoomS !== zs){ lastZoomS = zs; lastZoomN = z; col.style.setProperty("zoom", zs); }
      if(!lastPosSet){ lastPosSet = true; col.style.setProperty("position", "relative"); }
      if(lastLeftS !== ls){ lastLeftS = ls; col.style.setProperty("left", ls); }
      zoomOriginS = null;                 // the next transform takes a fresh one
    }else{
      /* THE ORIGIN IS TAKEN ONCE PER STEP, not per frame: re-reading the word's
         rect while a transform is already on it would chase its own tail. */
      if(zoomOriginS === null){
        const b = wordRectNow(), cr = col.getBoundingClientRect ? col.getBoundingClientRect() : null;
        if(b && cr && b.width > 0){
          zoomOriginS = ((b.left + b.width/2 - cr.left) / lastZoomN).toFixed(1) + "px "
                      + ((b.top + b.height/2 - cr.top) / lastZoomN).toFixed(1) + "px";
        } else zoomOriginS = "50% 50%";
        col.style.setProperty("transform-origin", zoomOriginS);
      }
      const ts = "scale(" + (z / lastZoomN).toFixed(5) + ")";
      if(lastTransS !== ts){ lastTransS = ts; col.style.setProperty("transform", ts); }
      if(lastLeftS !== ls){ lastLeftS = ls; col.style.setProperty("left", ls); }
    }
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
  let lastMarkHost = null;
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
      forgetPageZoomWrites();          // or the next write of the same value is skipped
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
    spreadOnCol = true;
    if(col.classList) col.classList.add("spreading");
    /* AND THE PARTING MAKES NO NEW LINES. Osca, 9 September, twice and in
       capitals: *"DO NOT rearrange the text during the animation -- during the
       movement to one word -- DO NOT REARRANGE!"*

       The spacing below is a `word-spacing` on the column, and with the
       paragraph wrapping normally that RE-WRAPS it: measured in Chromium at
       1440x900, four pinned paragraphs went 1,5,22,21 lines -> 1,18,83,78 the
       moment the gap arrived, and on the phone 1,8,39,36 -> 2,35,159,141. That
       is the rearrangement, and it is the last of it on this axis -- the zoom
       itself never had any (a css `zoom` is a LAYOUT zoom; the same four
       paragraphs hold 1,5,22,21 at factor 1 and at factor 16).

       So while it spreads, the paragraph does not wrap. The neighbours part
       along the line they are already on and travel off the edges, and no word
       is ever moved to a different line by the parting. Measured with it on,
       the picture at +2 is the same picture to the pixel: one word, centred,
       the caption underneath. `white-space` inherits, so the column is the one
       place to write it -- and it belongs here rather than in a stylesheet
       because it is half of what `--wgap` means, not a look. */
    col.style.whiteSpace = "nowrap";
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
  /* AND CLEARING NOTHING IS NOT FREE. `spreadPage(0)` runs every frame of every
     travel and came straight here, where three removeProperty calls and a class
     remove dirtied the reading column's style whether or not any of them was
     set. A dirty column means the next rect read re-lays it out -- 85ms on the
     complete Shakespeare -- so this was buying a full layout a frame to remove
     properties that have not been set since the parting was deleted (10 Sep).
     One flag: if nothing was ever put on, there is nothing to take off. */
  let spreadOnCol = false;
  function clearSpread(){
    const col = o.readerCol;
    spreadQ = -1; lastWgap = ""; lastLgap = "";
    if(!col || !spreadOnCol) return;
    spreadOnCol = false;
    if(col.classList) col.classList.remove("spreading");
    col.style.removeProperty("white-space");
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
  //     k     the factor that brings the word to WORD.height -- the dial, and
  //           nothing else. It may be BELOW 1: a word already bigger than the
  //           dial arrives by shrinking. Bounded either way by WORD.maxzoom.
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
  /* THE ONE SIZE, IN PIXELS. Measured against the same reference computeArrived
     uses -- the view on a desk, the SHORT side on a phone -- so turning a phone
     over does not re-set the type. */
  function wordFontPx(){
    const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    const S = Math.min(vw, vh);
    const hRef = (S <= WORD.shortside) ? S : vh;
    return Math.max(1, WORD.height * hRef);
  }
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
      forgetPageZoomWrites();                       // ...and so did these two
    };
    col.style.removeProperty("zoom"); col.style.removeProperty("left");
    forgetPageZoomWrites();
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
    /* ============ THE ARRIVAL IS DERIVED FROM THE DIAL ============
       Osca, 10 September: *"zoom arrival IS derived from fixed height dial. No
       matter what it is."*

       So there is one sum: magnify the page until the cursor word's own type is
       the size the view draws it at. Not a fill fraction, not a measurement of
       the word's box -- the page's em against the view's em, which are the same
       face, so they cannot disagree by a rounding or a Range rect.

       AND IT MAY BE LESS THAN ONE. Osca, same message: *"some words WILL be
       larger, NOT smaller, from the point you start zooming... a zoom shouldn't
       exist, in fact, it should zoom out in such a situation."* A heading, or a
       page already magnified, is bigger than the dial before you start; the
       old `Math.max(1, ...)` forced the answer upward and the push then had
       nowhere to go. The factor is simply what it takes to arrive, either way,
       and the same push does it -- the page shrinks instead of growing. The cap
       is symmetrical for the same reason. */
    const pageEm = Math.max(1, fontBase(col) || h0 / 1.5);
    const lim = Math.max(1.0001, WORD.maxzoom);
    const k = clamp(wordFontPx() / pageEm, 1 / lim, lim);
    // WHERE THE WORD STAYS. The first word of a visit sets it -- "the word
    // stays where it was on screen" -- and every word after it arrives at that
    // same place, which is what reading on inside the zoom looks like.
    if(!anchor){
      anchor = { x: a.left + a.width/2, y: a.top + a.height/2 };
      anchorFrom = { x: anchor.x, y: anchor.y };   // where the travel begins
    }
    const out = { k, w: w0, h: h0, base: pageEm };
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
  /* ONE WORD, ALONE -- position +2 is wordview.js's now, not the page's.
     See wordview.js's own head for what the two films showed and why the old
     mechanism (the page zoomed sixteen times, neighbours shoved sideways)
     could not be dialled into what he asked for. */
  let wordView = null;
  /* IT MOUNTS WHERE THE SUBTITLE LIVES, and that is not a detail. Osca, 9 Sep:
     *"where is the subtitle we made, as a part of one word view? So you can see
     the whole line/sentence? We made that to be present in one word view
     BECAUSE it's a separate view."*

     On document.body the view could never be got under it. wordpane's caption
     sits at z-index 12 inside `div.open`, which is `position:fixed; z-index:3`
     -- a STACKING CONTEXT, so that 12 is 12 within a 3 and cannot rise above a
     sibling of `.open` at any number. Measured live in Chrome: the caption was
     awake, opaque and at the right rect the whole time, and simply painted
     underneath. In the same parent the two numbers mean the same thing again. */
  function mountWordView(){
    if(wordView || !window.WordView) return;
    const host = o.bookEl || (o.readerBox && o.readerBox.parentNode) || document.body;
    wordView = window.WordView.mount({ parent: host });
  }
  function pane(){
    if(wordPane) return wordPane;
    if(!(typeof window !== "undefined" && window.WordPane)) return null;
    const host = o.bookEl || (o.readerBox && o.readerBox.parentNode) || null;
    if(!host) return null;
    mountWordView();
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

  /* ================ THE ZOOM IS THE WAY IN AND OUT, AND NOTHING ELSE ================
     Osca, 10 September, the design exactly:

       *"the one-word view is SEPARATE; the zoom is only the way in and out.
       The zoom is the transition: going in, the page scales uniformly toward
       the target word -- column width constant, nothing re-wraps, nothing
       parts, no stripe, no blank frame -- and at the end the one-word view
       takes over seamlessly: its word drawn at the exact size and position the
       zoomed word landed at, so the swap is a single invisible frame. Coming
       out is the reverse. Exactly one surface is painted in any frame -- never
       both, never neither."*

     WHAT WAS HERE, AND WHY NONE OF IT COULD BE DIALLED OUT. The page was grown
     by a css `zoom` on the reading column, written in steps with a transform
     carrying the gaps, while a closing loop scrolled the page every frame to
     hold the word under a travelling anchor, and a view waited for the page to
     be "ready" before letting go. Every fault in IMG_0453 falls out of that:
     a `zoom` write re-lays the column and, under content-visibility, forgets
     every learned height -- so the scroller is clamped, the loop chases a rect
     that is not answering, and the screen is blank for frames at a time; two
     writers on one scroller is the page "moving like crazy"; and two surfaces
     that each measure the word are two answers and a visible step.

     WHAT IS HERE. One map, computed ONCE, before the first frame moves:

         P   the word's pivot letter on the page, at rest       (measured)
         T   the same letter in the view, laid out but hidden   (measured)
         s   the view's em over the page's em -- F / f           (arithmetic)

     and every frame of the zoom is the page, untouched, under one transform on
     #readerbox:   x  ->  c(e) + z(e)·(x - P),   z = s^e,   c = P + u·(T - P),
     u = (z-1)/(s-1). That is a uniform scale about ONE fixed point: the word
     travels a straight line from where it sits to where the view will draw it,
     and arrives at exactly the view's size. Nothing is laid out, nothing is
     scrolled, nothing is measured per frame -- so nothing can re-wrap, part,
     be clamped, lag or be lost, and the column's width in its own pixels is
     the width it had at rest because it is the SAME LAYOUT.

     THE LAST FRAME OF THE PAGE IS THE VIEW'S PICTURE. Over the second half of
     the travel the rest of the page goes under a veil of its own ground (a
     layer inside the page, with a hole cut exactly round the word, so the
     neighbours fade -- they do not part, move or re-wrap), and the pivot
     letter warms to the view's red. At e = 1 the page shows one word, red
     letter and all, at the view's size and place; the next frame the view is
     up and the page is not. Coming out, the page is put back at the word
     UNDER the view (the cursor may have moved while you read), measured, set
     to that same picture, and only then shown -- the view goes in the same
     frame. One surface, every frame. */
  const WZ = {
    eps:      0.0002,  // the ends of the axis: within this of 0 or 1 is AT it
    veilFrom: 0.40,    // the neighbours start to go at this much of the travel...
    veilTo:   0.95,    // ...and are gone, and the letter fully red, by this much
    pad:      0.06,    // the hole round the word, in ems of the page's type
    waitMax:  45,      // frames the axis will wait for the page to be measurable
  };
  let wz = { state: "page", map: null, hold: null, goal: 0, wait: 0,
             exact: false, veil: null, veilKey: "", veilA: "", pvOn: false, pvKey: "",
             pvHost: null, pvQ: -1, keep: null, lastTop: null };
  function wzSmooth(x){ x = clamp(x, 0, 1); return x*x*(3 - 2*x); }
  function wzFirstRect(r){
    if(!r) return null;
    const rs = r.getClientRects ? r.getClientRects() : null;
    const b = (rs && rs.length) ? rs[0] : (r.getBoundingClientRect ? r.getBoundingClientRect() : null);
    return (b && b.width > 0 && b.height > 0) ? b : null;
  }
  function wzPivotRange(){
    const w = wordDomIndex[wordIdx];
    if(!w || !w.node) return null;
    const text = (w.node.nodeValue || "").slice(w.start, w.end);
    const k = (window.WordView && window.WordView.pivotIndex) ? window.WordView.pivotIndex(text) : 0;
    try{
      const r = document.createRange();
      r.setStart(w.node, w.start + k); r.setEnd(w.node, Math.min(w.end, w.start + k + 1));
      return r;
    }catch(_){ return null; }
  }
  function wzFontOf(el){
    try{
      const cs = getComputedStyle(el);
      return { px: parseFloat(cs.fontSize) || 0,
               font: { family: cs.fontFamily, style: cs.fontStyle, weight: cs.fontWeight } };
    }catch(_){ return { px: 0, font: null }; }
  }
  /* THE PAGE'S WORD, AT REST -- measured with nothing on the page but the page.
     `off` means it is not on the screen, which is not a map: a zoom about a
     point outside the view is a zoom into nothing. */
  function wzMeasure(){
    const w = wordDomIndex[wordIdx];
    const pane = o.readerPane;
    if(!w || !w.p || !pane) return null;
    const wr = wzFirstRect(currentWordRange()), pr = wzFirstRect(wzPivotRange());
    if(!wr || !pr) return { off: true };
    const pb = pane.getBoundingClientRect();
    const vw = window.innerWidth || 0;
    const on = wr.top >= pb.top - 0.5 && wr.bottom <= pb.top + (pane.clientHeight || 0) + 0.5
            && wr.left >= -1 && wr.right <= vw + 1;
    if(!on) return { off: true, W: wr };
    const f = wzFontOf(w.p);
    return { W: wr, P: { x: pr.left + pr.width/2, y: pr.top + pr.height/2 }, Ph: pr.height,
             f: f.px, font: f.font, text: wordTextAt(wordIdx) };
  }
  /* THE MAP: where the view will draw this word, and the one scale that takes
     the page's word there. The view is laid out while hidden and ASKED -- the
     arithmetic never guesses where the red letter will fall. */
  function wzMakeMap(pg){
    if(!pg || pg.off) return null;
    if(!wordView) mountWordView();
    if(!wordView || !o.readerBox) return null;
    const F = wordFontPx();
    wordView.set(pg.text, F, pg.font);
    const tr = wordView.pivotRect ? wordView.pivotRect() : null;
    if(!tr || !(tr.width > 0)) return null;
    const s = pg.f > 0 ? F / pg.f : (tr.height / pg.Ph);
    if(!(s > 0) || !isFinite(s)) return null;
    // the box's own origin, with nothing on it -- its local pixels are the
    // viewport's less this, and the transform below is written in them.
    const had = o.readerBox.style.transform;
    if(had) o.readerBox.style.transform = "";
    const bx = o.readerBox.getBoundingClientRect();
    if(had) o.readerBox.style.transform = had;
    return { P: pg.P, T: { x: tr.left + tr.width/2, y: tr.top + tr.height/2 }, s,
             O: { x: bx.left, y: bx.top }, W: pg.W, f: pg.f, F,
             /* the WORD AND WHERE IT STANDS: the same word on a page scrolled
                elsewhere is a different hole. Keyed on the word alone, the
                veil kept the last visit's hole and covered the word -- two
                frames with nothing on them before the view, measured. */
             key: wordChapterIdx + ":" + wordIdx + "@" + Math.round(pg.W.left) + "," + Math.round(pg.W.top),
             text: pg.text };
  }
  /* ONE FRAME OF THE ZOOM. e is the axis, 0 the page and 1 the view. */
  function wzApply(e){
    const m = wz.map;
    if(!m) return;
    e = clamp(e, 0, 1);
    const z = Math.pow(m.s, e);
    const u = Math.abs(m.s - 1) < 1e-6 ? e : (z - 1) / (m.s - 1);
    const cx = m.P.x + u * (m.T.x - m.P.x), cy = m.P.y + u * (m.T.y - m.P.y);
    const tx = cx - m.O.x + z * (m.O.x - m.P.x), ty = cy - m.O.y + z * (m.O.y - m.P.y);
    /* translate3d, and it is not a hint: a 3D transform puts the page on its
       own compositor layer, so a frame of the zoom is a new transform on that
       layer and a re-raster of it at the new scale -- not a re-paint and
       re-layerize of every chunk in the book on the main thread. Measured
       (Chromium, the complete Shakespeare, a 4x travel): 18ms a frame against
       25-28, and the text exactly as sharp at 4x (edge p99.7 208 both ways).
       `will-change: transform` was measured too and REFUSED: it rasters once
       and stretches, 208 -> 60 at 4x -- a blurred word handed to a sharp one
       is a swap you can see. */
    wzTfS = e <= 0 ? "" : ("translate3d(" + tx.toFixed(3) + "px," + ty.toFixed(3) + "px,0px) scale(" + z.toFixed(6) + ")");
    writeReaderTransform();
    const v = wzSmooth((e - WZ.veilFrom) / Math.max(0.01, WZ.veilTo - WZ.veilFrom));
    wzVeil(v);
    wzVeilOn(e > 0);
    wzPivot(v);
  }
  /* THE VEIL: the page's own ground, over the page, with a hole exactly round
     the word. It is INSIDE #readerbox, so the transform carries it and the hole
     with the word -- nothing is re-measured. Opacity only: composited, no
     style, no layout, and the text under it is never touched. */
  /* ...AND WHILE THE PAGE IS TRAVELLING THE VEIL TAKES THE POINTER. The pointer
     is over the page, so the browser re-hit-tests the whole scaled column for
     hover on every frame of the zoom -- 4-11ms of HitTest in the long frames of
     the trace. A layer on top that answers the hit stops that walk at itself,
     and a press mid-zoom lands on nothing. `wzVeilOn` is the only writer. */
  function wzVeilOn(on){
    if(on && !wz.veil) wzVeil(0, true);
    if(!wz.veil) return;
    const pe = on ? "auto" : "none";
    if(wz.veil.style.pointerEvents !== pe) wz.veil.style.pointerEvents = pe;
  }
  function wzVeil(v, make){
    if(!o.readerBox) return;
    if(!wz.veil){
      if(v <= 0 && !make) return;
      const d = document.createElement("div");
      d.className = "wz-veil";
      d.setAttribute("aria-hidden", "true");
      o.readerBox.appendChild(d);
      wz.veil = d;
    }
    const m = wz.map;
    if(v > 0 && m && wz.veilKey !== m.key){
      wz.veilKey = m.key;
      const pad = WZ.pad * (m.f || 16);
      const x0 = m.W.left - m.O.x - pad, x1 = m.W.right - m.O.x + pad;
      const y0 = m.W.top - m.O.y - pad * 0.5, y1 = m.W.bottom - m.O.y + pad * 0.5;
      const P = (x, y) => x.toFixed(2) + "px " + y.toFixed(2) + "px";
      wz.veil.style.clipPath = "polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, "
        + P(x0, y0) + ", " + P(x0, y1) + ", " + P(x1, y1) + ", " + P(x1, y0) + ", " + P(x0, y0) + ")";
    }
    const a = v <= 0.001 ? "0" : (v >= 0.999 ? "1" : v.toFixed(3));
    if(wz.veilA !== a){ wz.veilA = a; wz.veil.style.opacity = a; }
  }
  /* THE RED LETTER, ON THE PAGE. A custom highlight on the one pivot letter,
     its colour a mix toward --pivot written on the word's OWN PARAGRAPH (one
     element's style, never the column's), in tenths. */
  function wzPivot(v){
    if(!wordHiOK) return;
    const w = wordDomIndex[wordIdx], host = w && w.p;
    if(v <= 0 || !host){
      if(wz.pvOn){ try{ CSS.highlights.delete("word-pivot"); }catch(_){} wz.pvOn = false; wz.pvKey = ""; }
      if(wz.pvHost){ wz.pvHost.style.removeProperty("--wz-pv"); wz.pvHost = null; }
      wz.pvQ = -1;
      return;
    }
    const key = wordChapterIdx + ":" + wordIdx;
    if(!wz.pvOn || wz.pvKey !== key){
      const r = wzPivotRange();
      try{ if(r) CSS.highlights.set("word-pivot", new Highlight(r)); }catch(_){ wordHiOK = false; return; }
      wz.pvOn = true; wz.pvKey = key; wz.pvQ = -1;
    }
    if(wz.pvHost && wz.pvHost !== host) wz.pvHost.style.removeProperty("--wz-pv");
    wz.pvHost = host;
    const q = v >= 0.999 ? 10 : Math.round(v * 10);
    if(q !== wz.pvQ){
      wz.pvQ = q;
      host.style.setProperty("--wz-pv", "color-mix(in srgb, var(--pivot) " + (q * 10) + "%, var(--ink))");
    }
  }
  function wzClear(){
    wzTfS = ""; writeReaderTransform();
    wzVeil(0); wzVeilOn(false); wzPivot(0);
    if(o.readerBox && o.readerBox.style.opacity === "0") o.readerBox.style.opacity = "";
  }
  /* THE PAGE LETS GO BY OPACITY, NOT VISIBILITY. `visibility` is INHERITED, so
     hiding #readerbox restyles every element the column has rendered: measured
     on the complete Shakespeare, 381ms to hide and 68ms to show -- a frame of
     nothing, which is the one thing this handover must not have. `opacity` is
     not inherited and is the compositor's: 0.4ms either way. Hit-testing is
     already off (`pointer-events:none` at the word level). */
  function wzPage(on){
    if(!o.readerBox) return;
    const v = on ? "" : "0";
    if(o.readerBox.style.opacity !== v) o.readerBox.style.opacity = v;
  }
  /* THE AXIS WAITS FOR THE MAP. A word that is not on the screen yet (a cursor
     in a chapter you have not been reading) is seated first; until the page can
     be measured the axis stands at its end and the gesture's intention is kept.
     It is one small number either side -- a zoom of 1.0003 -- never a frame of
     travel spent on a map that does not exist. */
  function wzHoldAt(which, goal){
    if(wz.hold !== which){ wz.hold = which; wz.goal = goal; wz.wait = 0; }
    wz.wait++;
    snapCancel(); dxVel = 0; dxInput = 0;
    setDx(which === "in" ? WZ.eps : 1 - WZ.eps);
    markPaint();
  }
  function wzRelease(){
    if(!wz.hold) return;
    const g = wz.goal;
    wz.hold = null; wz.wait = 0;
    // the hand's reach is where it was going, so the rest of the same flick
    // cannot talk the axis back out of it (wordRung would round a small tail
    // from the pinned place down to where it started).
    wordReach = g; wordGoal = g;
    snapStart(g, WORD_SNAP);
  }
  /* PUTTING THE PAGE BACK, UNDER THE VIEW. If the word is on the screen the page
     is where it should be -- the view never moved it. If you read on, the page
     is scrolled to the new word's reading line, and re-measured until it is
     still (content-visibility re-lays a revealed chapter over a frame or two). */
  function wzPlaceForExit(){
    const k = wz.keep;
    if(k && (wordChapterIdx !== k.c || wordIdx !== k.i)){
      wordChapterIdx = k.c; wordIdx = k.i; wordDomIndex = k.d; wordWords = k.w;
    }
    const pane = o.readerPane;
    const pg = wzMeasure();
    const top = pane ? pane.scrollTop : 0;
    const still = wz.lastTop !== null && Math.abs(top - wz.lastTop) <= 1;
    wz.lastTop = top;
    if(pg && !pg.off && (wz.wait === 0 || still)) return pg;
    if(wz.wait >= WZ.waitMax) return (pg && !pg.off) ? pg : null;
    if(!pane) return null;
    const rg = currentWordRange();
    const r = wzFirstRect(rg);
    if(r){
      const pb = pane.getBoundingClientRect();
      const want = pane.scrollTop + (r.top - pb.top) - (pane.clientHeight || 0) * 0.35;
      if(Math.abs(want - pane.scrollTop) > 1){ pane.scrollTop = want; programmaticTop = pane.scrollTop; }
    } else {
      const w = wordDomIndex[wordIdx];
      if(w && w.p && w.p.scrollIntoView){ w.p.scrollIntoView({ block: "center" }); programmaticTop = pane.scrollTop; }
    }
    wz.lastTop = null;
    return null;
  }
  /* ONCE A FRAME, from applyDx. */
  function wzFrame(){
    const e = clamp(dx, 0, 1);
    if(wz.state === "page"){
      if(e <= 0){ if(wz.hold === "in"){ wz.hold = null; } return; }
      const pg = seating ? null : wzMeasure();
      if(pg && !pg.off) wz.map = wzMakeMap(pg);
      else wz.map = null;
      /* NOTHING TO WAIT FOR is not the same as not ready. With no view surface
         mounted (a page that never loaded wordview.js) or no word indexed at
         all, no amount of waiting makes a map -- so the axis simply travels,
         the page is left as it is, and the hold is kept for the one case that
         resolves: a word being seated onto the screen. */
      /* ...and a wait that runs out goes on WITHOUT a map rather than home: the
         view needs nothing from the page, so the worst case is a cut into it --
         never a gesture that bounced. */
      const hopeless = !seating && (!pg || !window.WordView || !o.readerBox);
      if(!wz.map && (hopeless || wz.wait >= WZ.waitMax)){
        if(wz.hold) wzRelease();
        wz.state = "zoom"; wz.exact = false;
      }
      else if(!wz.map){
        if(pg && pg.off && !seating) seatOnWord();
        wzHoldAt("in", wordGoal > 0 ? wordGoal : 1);
        return;
      }
      else {
        wzRelease();
        wz.state = "zoom"; wz.exact = false;
        wzPage(true);
        if(wordView) wordView.hide();
        paintWordSub(0);
      }
    }
    if(wz.state === "zoom"){
      if(e >= 1 - WZ.eps){
        /* ARRIVED. First the page is drawn at exactly the view's picture -- e=1,
           which the travel's last frame may have stopped a hair short of -- and
           on the next frame the view takes the screen and the page lets go. */
        if(!wz.exact){ wz.exact = true; wzApply(1); markPaint(); return; }
        // no view surface on this page: the page stays -- never a frame of nothing
        if(wordView){ wordView.show(); wzPage(false); }
        wzTfS = ""; writeReaderTransform(); wzVeil(0); wzVeilOn(false); wzPivot(0);
        wz.state = "view"; wz.exact = false;
        paintWordSub(1);
        return;
      }
      wz.exact = false;
      if(e <= WZ.eps){ wz.state = "page"; wz.map = null; wzClear(); paintWordSub(0); return; }
      wzApply(e);
      return;
    }
    if(wz.state === "view"){
      // the word you are reading, drawn at the one size, in its own face
      const w = wordDomIndex[wordIdx];
      const face = w && w.p ? wzFontOf(w.p).font : null;
      if(wordView) wordView.set(wordTextAt(wordIdx) || "", wordFontPx(), face);
      paintWordSub(1);
      if(e >= 1 - WZ.eps && wz.hold !== "out"){ wz.keep = null; return; }
      /* LEAVING. The page goes back under the view first, at the word. */
      if(!wz.keep) wz.keep = { c: wordChapterIdx, i: wordIdx, d: wordDomIndex, w: wordWords };
      const pg = wordView ? wzPlaceForExit() : null;
      const map = pg ? wzMakeMap(pg) : null;
      if(!map && wordView && wz.wait < WZ.waitMax){ wzHoldAt("out", 0); return; }
      wz.map = map;          // (null: no view, or a page that never answered -- a cut back)
      wzRelease();
      // the first page frame is the view's own picture, whatever the axis says
      wzApply(1);
      wzPage(true);
      if(wordView) wordView.hide();
      paintWordSub(0);
      wz.state = "zoom"; wz.keep = null; wz.lastTop = null;
      markPaint();
    }
  }
  /* WHERE READING ON IS ALLOWED: in the view (or, on a page with no view
     surface mounted, at the same end of the axis). Never mid-zoom: the word
     being flown to is the map's. */
  function wzReads(){ return wz.state === "view"; }
  /* the running head and the rail: off for one word, and on the transition's
     path off for the whole of the zoom too */
  function wzChromeOff(lvl){ return lvl === "word" || wz.state !== "page"; }
  function wzProbe(){
    const m = wz.map;
    return { state: wz.state, hold: wz.hold, wait: wz.wait,
             s: m ? +m.s.toFixed(5) : null, P: m ? m.P : null, T: m ? m.T : null, tf: wzTfS };
  }

  let spreadNow = 0;

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
    book=bk; dx=0; dxVel=0; dxInput=0; dxIdle=0; wordWasOn=false; exitArmed=false;
    wz.state="page"; wz.map=null; wz.hold=null; wz.wait=0; wzTfS=""; wzClear();
    if(wordView) wordView.hide();
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
  /* ============ LEAVING IS A SLIDE, NOT A CUT (9 September) ==============
     Osca's third symptom on the ladder: past the deepest pane the app LEAVES
     THE PAGE. Proved rather than read -- a headless probe's own execution
     context was destroyed mid-gesture, twice, "most likely because of a
     navigation". `closeToLibrary` reset the axis to 0, swapped the screen and
     set `location.href` in the same tick, so the book vanished on one frame
     and the library arrived on another: a cut, where every other move on this
     axis is a travel.

     Asked which shelf a library PANE should show, Osca chose to keep the page:
     *"keep the page load, make it slide."* That is the right call and it is the
     morning's lesson again -- `library/library.html` owns the shelf, its store,
     its imported books, its pairing and its reading positions, and a second
     grid inside `book-nav.js` (the dormant `buildDashboardGrid`, still in this
     file) would be a second implementation of one thing, which is the bug we
     have spent today removing twice.

     So the LEAVING is what changes, and only that. The axis travels one rung
     past the deepest pane -- the stack keeps coming, the reader keeps sliding
     right, at the same speed and easing every other rung uses -- and the
     navigation happens when that travel lands. Nothing is reset until then, so
     there is no frame with no book on it. `T.anim` is the speed the panes
     already move at, so the exit cannot feel like a different mechanism. */
  try{ const v = localStorage.getItem("leavesnap");
       if(v != null && +v > 0) LEAVE_SNAP = +v; }catch(_){}
  let leavingBook = false;
  /* THE EXIT ANIMATION IS ITS OWN, NOT THE GESTURE'S LEFTOVERS. First version
     re-used the axis: commit, then travel dx to one rung past the last pane.
     But the HAND has usually already spent that rung getting to the commit
     point -- measured, a sustained push left dx at -2.96 of a -3, so the
     "slide" was three frames and a page load. `leaveT` is a travel of its own,
     0 -> 1 over a fixed number of frames whatever the gesture did, and it is
     what carries the book AND its contents off the right edge. */
  let leaveT = 0, leaveDur = 28, leaveFrom = 0;
  /* HOW FAR OUT OF THE BOOK THE HAND HAS TRAVELLED, 0..1 of the leaving zone.
     THIS IS THE FEEDBACK, and it was missing: the axis moved through the zone
     while nothing on screen did, because at dx past the deepest pane every
     pane is already fully open and the layout has nothing left to say. So the
     gesture showed you nothing and the animation only began once you let go --
     Osca: *"the animation essentially is queued, until I lift my fingers, SO
     actually I don't know what I'm doing/done until I lift my fingers. The
     animation should be there straight away, without any delay. Because that's
     the user feedback loop."* Right, and it is the difference between a gesture
     you can steer and one you can only submit. The book and its contents now
     leave WITH the hand, and come back with it. */
  function handOver(){ return clamp(-dx - currentMaxLeft(), 0, 1); }
  function closeToLibrary(){
    if(leavingBook) return;
    if(!book || screen !== "open" || !o.onLibrary){ leaveNow(); return; }
    leavingBook = true;
    leaveT = 0;
    /* the exit travel picks up exactly where the hand left off, so committing
       is a continuation and not a jump back to the start of the movement. */
    leaveFrom = handOver();
    leaveDur = clamp(85 / Math.max(0.25, LEAVE_SNAP), 6, 90);
    snapCancel();
    dxInput = 0; dxVel = 0;
    setDx(-(currentMaxLeft() + 1));      // the axis is out; the travel is leaveT's
    markPaint();
  }
  /* stepped from tick(), beside stepDx, so it runs on the same clock as every
     other movement on this page. */
  function stepLeave(dt){
    if(!leavingBook) return;
    leaveT += (dt || 1) / leaveDur;
    if(leaveT >= 1){ leaveT = 1; markPaint(); applyDx(true); leaveNow(); return; }
    markPaint();
  }
  function leaveEase(){ const x = clamp(leaveT, 0, 1); return x*x*(3-2*x); }
  /* one number for both halves of the movement: the hand's while a hand is on
     it, and the hand's plus what the travel has added once it has let go. */
  function leaveShift(){
    return leavingBook ? leaveFrom + (1 - leaveFrom) * leaveEase() : handOver();
  }

  function leaveNow(){
    leavingBook = false; leaveT = 0; leaveFrom = 0;
    exitWord();
    for(let i=1;i<MAX_LEFT_LEVELS;i++) destroyPane(i);   // every deeper pane, not just two
    resetReaderChrome();
    book=null;
    dx=0; dxVel=0; dxInput=0; dxIdle=0;
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
  /* TWO PLACES ON THE WORD SIDE, NOT THREE (10 Sep). 0 is the book and +1 is
     the one-word view; everything between is the zoom, which is the way in
     and out and never a place to stop (Osca: "the zoom is only the way in and
     out"). +1 used to be a page held zoomed and +2 the view, which is why one
     flick landed on a magnified page and a second was needed to read. */
  const DX_MAX = 1;
  /* THE AXIS STOPS AT THE DEEPEST PANE -- except on the way out. The exit
     slide (see closeToLibrary) travels one rung further, and without this the
     clamp swallowed it: `snapStart(-(maxLeft+1))` set a goal the axis could
     never reach, `snapStep` wrote it and `setDx` put it straight back, so the
     "slide" was 14 frames of standing still followed by a page load. Measured
     exactly that: 58 frames, deepest dx -2, 0 frames past the last pane. */
  /* THE LEAVING ZONE. One rung past the deepest pane, and the axis may stand
     anywhere in it while your hand is still on the glass -- Osca, 9 Sep:
     *"do NOT push me, do NOT stop me from scrolling very slowly, scrolling out
     then scrolling back. Right now, past a certain point, even if I don't lift
     my fingers, it just snaps me back to library. I don't want to be snapped
     before I lift my fingers."*

     The floor is therefore open whenever the axis is ALREADY in the zone, or a
     gesture is running, or the exit travel is under way -- and closed at rest,
     so nothing can be left standing in it. */
  function inLeavingZone(){ return dx < -currentMaxLeft() - DX_REST; }

  /* YOU HAVE TO ARRIVE BEFORE YOU CAN LEAVE. The zone opens only once the axis
     has come to REST on the deepest pane -- which is the rule the arrow key has
     always had here ("the press that arrives at the deepest pane stops there,
     and only a SECOND one...") and the trackpad never did. Without it one hard
     flick runs the whole ladder and straight out of the book, which is the
     overshoot Osca asked to be rid of; with it, a flick lands on the last pane
     and stops, and going further is a gesture of its own. Disarmed the moment
     the axis leaves that rest, so it cannot be spent twice. */
  let exitArmed = false, armedAt = 0;
  function dxFloor(){
    const m = currentMaxLeft();
    const open = leavingBook || exitArmed || inLeavingZone();
    return -(m + (open ? 1 : 0));
  }
  function setDx(v){
    dx = clamp(v, dxFloor(), DX_MAX);
    if(dx > -currentMaxLeft() + DX_REST) exitArmed = false;   // moved back in
  }
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
  function goPos(p){
    /* THERE IS NO +2 (10 Sep): a caller still asking for it -- reader.html's
       Settings "one word" view says nav.go(2) -- is asking for the view, which
       is +1 now. Past the end of the axis is the end of the axis. */
    if(p > DX_MAX) p = DX_MAX;
    /* ON THE WORD SIDE A POSITION IS REACHED BY THE ZOOM, never cut to (10 Sep):
       the arrow, the bench's buttons and nav.go() travel exactly as a flick
       does, so there is one way into the view and it is the transition. */
    if(p >= 0 && p <= DX_MAX && dx >= -DX_REST && Math.abs(p - dx) > DX_REST && !wz.hold){
      dxVel = 0; dxInput = 0; detent = false; paneEnd(); wordEnd();
      wordGoal = p; wordReach = p; snapStart(p, WORD_SNAP); markPaint();
      return;
    }
    setDx(p); dxVel = 0; dxInput = 0; detent = false; snapCancel(); paneEnd(); wordEnd(); wordGoal = p > 0 ? p : 0; }

  /* ================== ONE PUSH ON THE AXIS, AND ONE ONLY ==================
     Osca, 8 September: *"the phone reader navigates panes the SAME way the
     Mac does ... Reuse the Mac's logic; do not reinvent a gesture."*

     Everything the sideways wheel did to dx used to live inside the wheel
     handler, so a second driver could only ever be a COPY of it -- and a copy
     is where "the same, except" comes from. It is one function now, in dx's
     own units, and the wheel is its first caller rather than its owner. What
     it holds is the whole of the axis's grammar and nothing else:

       * inside one word view a push only LEAVES the view (the reading is on
         the other axis), so there is no exit gate to consider;
       * past the deepest pane the axis simply keeps travelling, into the
         LEAVING ZONE, under the hand -- and whether that was an exit is
         decided on RELEASE (LEAVE_COMMIT), like everything else here.

     THE OLD GATE WAS AN ACCUMULATOR AND IT FIRED MID-GESTURE. `exitAccum`
     counted the push past the last pane and called `closeToLibrary()` the
     moment it crossed `EXIT_PUSH * T.gain` -- with the fingers still moving.
     Osca, 9 Sep: *"past a certain point, even if I don't lift my fingers, it
     just snaps me back to library. I don't want to be snapped before I lift my
     fingers."* He is right, and it was the one commitment on this axis taken
     while a hand was still on it. Both the accumulator and the constant are
     gone. A driver whose input is not px of wheel -- a finger on glass -- means
     as the axis would have travelled", not "as many pixels as a trackpad
     would have sent".

     Returns what it did, so a driver can tell a push that landed from one the
     gate swallowed. */
  /* THE HAND'S REACH, ON THE PANE SIDE. `paneReach` is what the hand has asked
     for -- a real number of rungs, never drawn. `paneRung` rounds it to a WHOLE
     rung, and that is the only thing the ladder is ever told to be: a half-open
     stack is passed THROUGH, on the way to a whole one chosen before the
     movement started. Null between gestures. */
  let paneReach = null, paneFrom = 0, panePress = 0, paneLast = 0;
  function paneRung(v, floor){
    const deep  = -clamp(v, floor, 0);
    const whole = Math.floor(deep + 1e-9);
    return -Math.min(-floor, whole + ((deep - whole) >= STICK ? 1 : 0));
  }
  /* the gesture is over: its ceiling and its unspent pressure go with it. */
  function paneEnd(){ paneReach = null; panePress = 0; paneLast = 0; }

  /* ============ A SCROLL GOES INTO THE WORD, NOT ONLY A PINCH ============
     Osca, 9 September: *"the scroll into one word, as opposed to the pinch.
     Text shouldn't move or be re-organised, or different lines made etc,
     NOTHING bar zoom into one word, then continue to scroll = proper one word
     view, which we have made. Then we are back in."* And, in the same breath:
     *"DO NOT rearrange the text during the animation -- during the movement to
     one word -- DO NOT REARRANGE!"*

     WHY THIS WAS REFUSED UNTIL NOW, and why it can be allowed today. On 8 Sep
     a sideways swipe ran dx 0 -> 2 in one push, and 1 -> 2 is `spreadPage` --
     a word-spacing on the column, which RE-WRAPS every paragraph it touches.
     Measured then: line counts 8,4,4,4 -> 33,16,11,17 WHILE the page was still
     visibly zooming. So the axis was cut at 0 and one word was made the
     pinch's alone.

     What has changed is that this axis no longer moves with the hand: since
     the ladder went over to reach/round/travel, a push CHOOSES a rung and the
     axis TRAVELS to it. That is exactly the tool this needs. The gesture may
     reach +2 in one movement -- he asked for that -- but the travel is taken
     in LEGS, one rung at a time, and the second leg does not start until the
     first has ARRIVED. So the zoom is complete before the spacing exists, and
     the two can never overlap however hard the swipe. `spreadPage`'s own
     `wordF >= 1` lock is the second door on the same rule and stays.

     0 -> +1 is the zoom, and it is a css `zoom` -- a LAYOUT zoom, not a
     raster: measured in Chromium at both widths, the line counts of six pinned
     paragraphs are identical at factor 16 and at factor 1. Nothing re-wraps in
     that stretch, which is the "NOTHING bar zoom into one word". */
  let wordReach = null, wordGoal = 0, wordFrom = 0;
  /* where the reading page was standing when the zoom began -- see the fixed
     point in applyDx. A section and how far into it, never a raw scrollTop. */
  let placeSec = null, placeInto = 0, placeWord = -1;
  let anchorFrom = null;   // where the word was when the zoom began
  let blankWait = 0;       // frames spent waiting for the page to be ready
  let steadyTop = null;    // where the page was last frame, while handing back
  let steadyFor = 0;       // ...and how many frames it has been there
  let lastMarkA = null;
  let lastOnAxis = false;
  function wordRung(v){
    const x = clamp(v, 0, DX_MAX);
    const whole = Math.floor(x + 1e-9);
    return Math.min(DX_MAX, whole + ((x - whole) >= STICK ? 1 : 0));
  }
  /* ONE LEG AT A TIME. Never `snapStart(2)` from 0: that would put the spacing
     on the page while the zoom was still growing, which is the whole of what
     went wrong on 8 Sep. */
  function wordLeg(){
    const leg = wordGoal > dx ? Math.min(wordGoal, Math.floor(dx + 1e-6) + 1)
                              : Math.max(wordGoal, Math.ceil(dx - 1e-6) - 1);
    /* AND ONLY WHEN THE MARK ACTUALLY CHANGES. snapStart resets snapT, so
       calling it every frame restarts the travel every frame and the axis
       stands still: measured live in Chrome, one gesture parked at dx 0.791
       and stayed there -- the zoom half-done, the word half-sized, and nothing
       moving. A spring that is re-sprung every frame is not a spring. */
    /* AND IT IS A TRAVEL, AT ITS OWN SPEED. OUT_SNAP_ (6) is the WORD SWITCH's
       number -- the stretch between the page and the word where there is
       nothing to look at and you want it over. This is the opposite: it is the
       zoom itself, the thing Osca is watching, and at 6 it was 14 dt-units,
       which in a browser running dt near its cap is FOUR FRAMES. Measured on
       this bench: dx 0 -> 0.286 -> 0.596 -> 0.872 -> 1.000, the word 74px to
       1124px, in four. That is not a zoom, it is a jump with three frames in
       the middle of it, and it is what "it's not smooth, it still jumps, it's
       not zoom coming out" is. WORD_SNAP is its own dial. */
    if(Math.abs(leg - dx) > DX_REST && (snapTo == null || Math.abs(snapTo - leg) > DX_REST))
      snapStart(leg, WORD_SNAP);
  }
  function wordEnd(){ wordReach = null; }

  function axisPush(d){
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
    /* THE WORD SIDE OF THE AXIS. A push at or above the book -- either way --
       is the word's, and it works the way the ladder does: the reach is what
       the hand asked for, `wordRung` rounds it, and the travel runs there a leg
       at a time. Coming DOWN out of the word is the same call, so the way home
       is the way out and neither is a special case. */
    if(dx >= -DX_REST && (d > 0 || dx > DX_REST)){
      if(wz.hold){ dxIdle = 0; return "hold"; }
      if(wordReach === null){ wordReach = Math.max(0, dx); wordFrom = Math.round(wordReach); }
      wordReach = clamp(wordReach + d, 0, DX_MAX);
      const g = wordRung(wordReach);
      if(g !== wordGoal || snapTo == null){ wordGoal = g; wordLeg(); }
      dxVel = 0; dxIdle = 0;
      return g > dx ? "word" : "home";
    }
    /* PAST THE DEEPEST PANE THE AXIS FOLLOWS YOUR HAND (9 Sep). It used to
       count the push into `exitAccum` and, the moment that crossed EXIT_PUSH,
       call `closeToLibrary()` -- MID-GESTURE, with the fingers still moving.
       That is Osca's "it just snaps me back to library" and it is the one thing
       this axis does nowhere else: every other commitment on it is taken on
       RELEASE, by where the gesture got to (see WORD_COMMIT below). The exit
       takes it the same way now, in `stepDx`'s rest branch, so scrolling slowly
       out and back again is just a move. `exitAccum` is gone with the rule it
       served. */
    if(dx <= -currentMaxLeft() + DX_REST && d < 0 && !leavingBook){
      /* ARRIVE FIRST; THIS PUSH STOPS AT THE PANE. And the refusal keeps the
         GESTURE alive -- the hand is still on the axis, so it must not be
         counted as idle. Before 9 Sep it was: the ladder took long enough to
         travel that the tail of one hard swipe was still arriving after the
         axis had stood at the deepest pane for T.grace, which armed the exit
         and let that SAME swipe carry on out of the book. Measured, real
         Chromium at 1440x900: one 14-tick swipe at 160 opened both panes and
         then closed the book. */
      if(!exitArmed){ dxIdle = 0; return "gate"; }
      dxInput += Math.max(d, -LEAVE_STEP);   // a step of the zone, not all of it
      return "leaving";
    }
    /* THE PANE LADDER. Not `dxInput += d` any more: the push moves the hand's
       REACH, the reach is rounded to a rung, and the axis TRAVELS there. */
    if(dx <= DX_REST && !leavingBook){
      const floor = -currentMaxLeft();
      if(paneReach === null){ paneReach = dx; paneFrom = Math.round(dx); }
      paneLast = Math.abs(d);
      /* LEAVING IS FREE: a push toward the reader passes straight through and
         drops any pressure built against the rung, so a hand that changes its
         mind is not still paying for the push it abandoned. */
      if(d > 0){ panePress = 0; }
      else if(OPEN > 0 && Math.abs(paneReach - Math.round(paneReach)) < 0.02
              && Math.abs(panePress) < OPEN){
        panePress += d;
        if(Math.abs(panePress) < OPEN){ dxIdle = 0; return "hold"; }
        d = panePress + OPEN;            // what is left of it (both negative)
      }
      paneReach = clamp(paneReach + d, floor, 0);
      /* THE CEILING IS ON DEPTH ONLY, and it lifts above PAST_AT. */
      if(paneLast <= PAST_AT) paneReach = Math.max(paneReach, paneFrom - OPENS);
      const goal = paneRung(paneReach, floor);
      if(snapTo == null || Math.abs(snapTo - goal) > DX_REST) snapStart(goal, PANE_SNAP);
      /* NO SYNTHETIC TAIL HERE, and that is deliberate. bench-panes.html adds
         one because nothing else in that page supplies it; a real trackpad and
         a real phone send their OWN momentum, as further wheel events after the
         fingers lift, and every one of them arrives HERE and extends the reach
         exactly as a push does. Synthesising a second tail on top of the real
         one made the axis run past its own ceiling and cost 19 checks across
         the leaving zone, the word detent and the margin -- measured, this
         file, 9 Sep. The dials are the same; only the source of the tail is. */
      dxVel = 0; dxIdle = 0;
      return "push";
    }
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
  /* THE ZOOM'S TRANSFORM (10 Sep) -- the one thing besides the panes' push that
     is ever written here, and only for the length of a travel between the page
     and the one-word view (see THE ZOOM IS THE WAY IN AND OUT). At rest, and in
     the view, it is "" and this is the panes' writer exactly as it was. The
     objection above -- WebKit will not re-raster a scaled layer -- was about a
     page LEFT at scale(16) to be read; nothing is read at scale any more: the
     view draws its own type and the page is only ever scaled in passing. */
  let wzTfS = "";
  function writeReaderTransform(){
    if(!o.readerBox) return;
    const t = wzTfS || (readerShift ? "translate(" + Math.round(readerShift) + "px,0px)" : "");
    if(o.readerBox.style.transform !== t) o.readerBox.style.transform = t;
    const og = wzTfS ? "0px 0px" : "";
    if(o.readerBox.style.transformOrigin !== og) o.readerBox.style.transformOrigin = og;
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
  /* PUTTING THE READING PLACE BACK, and why this is not `holdOn`. holdOn
     abandons the moment `inputTick` moves -- "your own scroll wins" -- and
     EVERY WHEEL EVENT bumps inputTick, the sideways ones on this axis
     included. So the gesture that leaves the word cancelled its own restore:
     measured on bench-word.html, the page came out at 585,973 instead of
     40,000 and simply stayed there, holdOn having aborted on the second event
     of the very swipe that asked to leave.

     A sideways push on the axis is not the reader scrolling the page, so this
     loop does not treat it as one. It stops for the two things that really do
     end it: the axis going back up into the zoom (the place is not ours to
     restore any more), and the section leaving the document. */
  /* THE WORD ITSELF ON THE READING LINE. Same loop as putBack, but the target
     is re-measured from the live range every frame instead of being arithmetic
     on an offsetTop taken once. */
  function putBackWord(){
    const pane = o.readerPane;
    if(!pane) return;
    /* AND THE WORD YOU WERE ON STAYS THE WORD YOU ARE ON. The reading page
       re-derives the cursor from where it is scrolled to, which is right when
       YOU scroll and wrong when this loop does: measured, coming out on word
       7,752 ("parts") landed on 7,766 ("the") because the loop's own scroll
       moved the cursor and the loop then chased the new one. Fourteen words is
       not far, but it is not the word he was looking at. */
    /* AND IT IS THE WHOLE CURSOR THAT IS PINNED, not just the index. `wordIdx`
       is a position INSIDE `wordChapterIdx`'s word list, so holding the number
       while the chapter moves under it names a different word entirely --
       which is how Osca ended up with *"2 separate positions in the text"*:
       the one-word view reading word 136 of 17,697 in chapter 1 while the page
       stood at word 2,328 of 2,328 in chapter 8. Both readouts were honest;
       they were describing two different cursors, and this loop had made the
       second one. The four fields travel together, exactly as the seat's own
       `keep` does. */
    const keep = { c: wordChapterIdx, i: wordIdx, d: wordDomIndex, w: wordWords };
    let tries = 0, stable = 0;
    const step = () => {
      /* IT WAITS FOR THE ZOOM TO BE OFF, and this is not timidity -- it is
         arithmetic. The target is `r.top - line` off the word's LIVE rect, and
         while the page is zoomed that rect is in zoomed pixels: at the
         arrival's ~16x it asks for a correction sixteen times the real gap.
         Tried the other way on 10 September, running it from dx 1 down: the
         first frame threw the complete Shakespeare 83,802 -> 822,756 and the
         next two hundred walked it back, 1,004 jumps over fifty runs and the
         same word coming out four different sizes. So it starts when the zoom
         is off and the page is in its own pixels again. */
      if(!o.readerPane || dx > DX_REST) return;
      if(wordChapterIdx !== keep.c || wordIdx !== keep.i){
        wordChapterIdx = keep.c; wordIdx = keep.i;
        wordDomIndex = keep.d; wordWords = keep.w;
      }
      const rg = currentWordRange();
      const r = rg && rg.getBoundingClientRect ? rg.getBoundingClientRect() : null;
      if(!r || (!r.width && !r.height)){
        if(++tries < 90) requestAnimationFrame(step);
        return;
      }
      const line = pane.clientHeight * 0.35;
      const want = pane.scrollTop + (r.top - line);
      if(Math.abs(want - pane.scrollTop) > 1){
        programmaticTop = want; pane.scrollTop = want; stable = 0;
      } else stable++;
      if(stable < 6 && ++tries < 90) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function putBack(sec, into){
    if(!sec || !o.readerPane) return;
    let tries = 0, stable = 0;
    const step = () => {
      const pane = o.readerPane;
      if(!pane || sec.isConnected === false) return;
      if(dx > DX_REST) return;                 // back into the zoom; not ours
      const want = sec.offsetTop + into;
      if(Math.abs(pane.scrollTop - want) > 1){
        programmaticTop = want; pane.scrollTop = want; stable = 0;
      } else stable++;
      // a re-layout under content-visibility takes a good many frames to
      // settle on a book this size, exactly as it does for the re-wrap.
      if(stable < 6 && ++tries < 90) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
      /* ============ YOU COME BACK OUT WHERE YOU WENT IN ============
         Osca, 9 September, on bench-word.html: *"When I zoom in on a word,
         enter one word view -- I land up, when I zoom back out, AT A DIFFERENT
         PLACE. I should come out still viewing the same word, in the page.
         Same place. Right now it moves me, in Shakespeare, by over 50 sonnets
         when I zoom out. Mess."*

         MEASURED, this bench, Chromium at 1440x900, the Complete Works: in at
         scrollTop 40,000 in chapter c001, out again at 586,281 in c422. The
         cursor was never lost -- word 7224 both ways -- so it is the PAGE that
         moves, and nothing was ever putting it back. While the zoom is on, the
         scroller is the zoomed page's (1,606,556px at the word), and the
         anchor loop writes it every frame to hold the word still; when the
         zoom goes, whatever number happened to be in it is simply kept.

         So the reading place is a FIXED POINT, taken the moment the zoom
         begins and restored the moment it ends -- and it is kept as a section
         plus an offset into it, not as a raw scrollTop, because the page the
         number has to be valid against is laid out again on the way back.
         `holdOn` is the same re-read loop `commitReaderEdge` already uses for
         exactly this hazard: under content-visibility a re-layout collapses
         every learned height for a few frames and a scrollTop set once is
         clamped to nothing. */
      if(wordOn){
        const pane = o.readerPane;
        if(pane){
          const secs = sections();
          const i = sectionAt(pane.scrollTop + pane.clientHeight * 0.35);
          const sec = secs[i] || null;
          placeSec = sec;
          placeInto = sec ? (pane.scrollTop - sec.offsetTop) : 0;
          placeWord = wordIdx;      // which word this snapshot belongs to
        }
        wz.state = "page"; wz.map = null; wz.hold = null; wz.wait = 0;
        enterWord(currentReaderChapter());
      } else {
        const wasView = wz.state === "view";
        wz.state = "page"; wz.map = null; wz.hold = null; wz.wait = 0; wz.keep = null;
        wzTfS = ""; wzClear();
        if(wordView) wordView.hide();
        paintWordSub(0);
        exitWord();
        if(contentsOwed){ contentsOwed = false; syncContentsLive(); }
        /* ...AND YOU COME OUT AT THE WORD YOU ARE ON, not the one you went in
           with. Osca, 9 September: *"I start position A page, it goes in =
           position A one word, I follow it, come out to position B one word,
           come out, and I'm back to A page -- not B page. I should be in B
           page, as in WHERE the one word view was exited."*

           The first version of this restored the ENTRY snapshot, which is only
           right when the cursor never moved -- and moving the cursor is what
           the view is for. So the place is read off the CURRENT word: its own
           paragraph, at the reading line. The entry snapshot stays as the
           fallback for the one case it is still the answer to -- the word
           cannot be found in the DOM, because its chapter has not been laid
           out. */
        const moved = wordIdx !== placeWord;
        /* THE TRANSITION PUT THE PAGE BACK ITSELF, under the view, before it
           handed back -- so there is nothing left to restore, and restoring
           anyway would move a page that is already right. Only a CUT out of the
           view (a book closed, a position set directly) still needs this. */
        if(!wasView){ /* already where it belongs */ }
        else if(moved && o.readerPane){
          /* THE CURSOR MOVED, so the page follows it -- to the WORD, not to
             its paragraph. Putting the paragraph's top on the reading line is
             not the same thing: measured on this bench, following 568 words
             into a long paragraph and coming out left the word 2,318px down a
             900px screen, because the paragraph it lives in is 22 lines tall.
             So the word's own rect is what is measured, live, and the scroller
             is corrected by the difference until it stops moving -- which also
             rides out content-visibility, where the offsetTop of a chapter
             that has not been laid out is a stylesheet placeholder and a lie. */
          putBackWord();
        }
        else if(placeSec && o.readerPane){
          /* IT DID NOT, so nothing may move at all. Landing "near" the word you
             went in with is not the same page you left, and the difference is
             visible: the snapshot is exact and the word's-own-place is not. */
          putBack(placeSec, placeInto);
        }
        placeSec = null; placeInto = 0; placeWord = -1;
      }
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
    /* ON THE WAY OUT, THE WHOLE BOOK LEAVES -- ITS CONTENTS INCLUDED. Osca,
       9 Sep: *"the text slides, as it should, and the contents pane should
       slide too, because THE WHOLE book, I'm leaving."* Right: the panes are
       this book's own directory, not furniture that belongs to the app, so
       they go with it. Every pane is carried to the right edge in the same
       proportion the reader is, off the same `over`, so the stack and the text
       leave together and the library arrives on an empty stage. */
    const leaveOver = leaveShift();
    for(let i=n-1;i>=0;i--){
      let p = laid.panes[i];
      if(!p) continue;
      if(leaveOver > 0){
        const vw = window.innerWidth || 0;
        p = Object.assign({}, p, { left: p.left + leaveOver * Math.max(0, vw - p.left) });
      }
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
    /* THE PUSH IS NO LONGER DOUBLED, because nothing is being narrowed any
       more (9 Sep -- see THE READER SLIDES below). The doubling was correct
       while the reader's own LEFT was being moved: that took width out of its
       box, the reading column is centred in what is left, so the column moved
       by only half the push. A TRANSLATE moves the box whole -- the column
       goes exactly as far as the box does -- so the shift the column needs is
       simply the distance from where it starts to where the stack ends. */
    /* THE PUSH IS MEASURED FROM WHERE THE TEXT REALLY STARTS, not from
       `marginW` (9 Sep). `marginW` is the FIRST PANE'S WIDTH and carries a floor
       of 120px so that pane is usable; on a 402px phone the reading column's
       own margin is 28px, so the two are different numbers and the push came
       out 92px short -- the text stayed under the panes at every rung.
       Measured: at the second rung on the phone the text started at 219 while
       the stack reached 311.

       `textLeft` is the column's true left at rest, unfloored, and the rule is
       one line: THE TEXT CLEARS THE STACK. On the desk that reproduces the
       step-1 hard stop as a CONSEQUENCE rather than as an exception -- at
       1440x900 the margin pane reaches 286 and the text already starts at
       287.5, so the push is zero and the book does not move, which is exactly
       what UI-PLAN §3 asks for and what the old code special-cased. */
    const textLeft = Math.round(Math.max(0,
      ((window.innerWidth || 0) - readerColumnWidth()) / 2));
    if(stackRight > 0){
      const need = stackRight - textLeft;
      if(need > pushFromOutside) pushFromOutside = need;
    }
    /* ...AND ON THE WAY OUT THE BOOK KEEPS GOING. There is no pane past the
       deepest one to push it -- the stack is as deep as the branch is -- so on
       the exit rung the reader is carried the rest of the way off the right
       edge itself, in proportion to how far past the last pane the axis has
       travelled. At the end of it the book is gone and the library arrives, so
       the page change lands on an empty stage instead of cutting across a
       full one. */
    {
      const lv = leaveShift();
      if(lv > 0){
        const vw = window.innerWidth || 0;
        pushFromOutside += lv * Math.max(0, vw - pushFromOutside);
      }
    }
    pushFromOutside = Math.round(Math.max(0, pushFromOutside));
    /* THE CONTENTS PUSH THE TEXT OFF THE SCREEN, AND THAT IS ALLOWED (9 Sep).
       Osca, asked what a phone should do -- where there is no empty margin for
       a pane to appear in: *"slide the text off-screen. DRAG columns/panes ONTO
       screen, pushes text off screen. MEANS that text doesn't have to change
       AND be visible. Contents pull PUSHES text off screen."*

       There WAS a clamp here -- `readerMinWidth()` of the column had to stay in
       view -- and its reason is written a few lines up: widen the panes enough
       and the push passed the viewport, "the reader's own box had no width
       left, its scrollable height went with it, and the browser clamped the
       reading position to ZERO -- the book jumped back to its first page".
       **Every word of that belonged to moving the reader's own `left`.** A
       translate takes no width out of the box, so the box keeps its width and
       its scroll height, nothing collapses, and there is nothing to clamp
       against. The reader can travel as far as the stack needs and comes back
       to the same word, which is the whole point of not re-wrapping.

       On a 402px phone this is the difference between the pane covering the
       words (measured 9 Sep: text at 28, the first pane reaching 118) and the
       words moving out from under it. */
    for(let i=n;i<MAX_LEFT_LEVELS;i++) destroyPane(i);

    /* ============ +2 IS THE VIEW, AND IT IS A CUT ============
       Osca: *"one word view is a STABLE thing, in its own right. Words should
       not move inside it, just one, next one, reduce animation as much as
       possible inside this view."* So it does not fade or slide in: past the
       zoom, the view IS the screen. The page behind it is not drawn at all
       while it is up, which is what takes the anchor, the clipping and the
       blank frames with it -- there is no longer a page to lose.

       AND THE PARTING IS GONE WITH IT. `spreadPage` existed to drive the
       neighbours off a LINE, which is the "drag phenomena where words are on
       lines" and the one thing on this page that re-wrapped. With the view
       there are no neighbours to drive off, so the spacing is never asked for
       above the zoom and the re-wrap cannot happen at all. */
    /* THE CURSOR MARK IS NOT A SLAB. ::highlight(word-target) is a small tint
       behind the word at 1x and the right thing there -- it is how you see
       where the cursor is. Multiplied by the page zoom it is a block of colour
       the size of a paragraph, which is the "box/highlight" Osca saw in
       IMG_0445 and the yellow rectangle behind "and" in Chrome at +1. So it
       goes as the zoom comes: full strength on the page, nothing by the time
       the word fills the frame. The view has none at all -- it draws its own
       word and the page's highlight cannot reach it. */
    /* ============ THE PAGE HAS ONE OWNER AT A TIME ============
       Osca, 10 September: *"the page is moving like crazy... it launched out of
       the title page."*

       scrub.js -- the rail -- moves the reading page in three places, and one
       of them is `scrollTop = f * (scrollHeight - clientHeight)`: a fraction of
       the WHOLE BOOK. While the word zoom is on, scrollHeight is the zoomed
       page's, tens of times what the rail's fraction was measured against, so
       a seek that means "a third of the way in" lands anywhere at all --
       including 0, which is the title page. The other two go through
       `offsetTop`, which under content-visibility is a stylesheet placeholder
       for any chapter not laid out.

       None of this is the rail's fault: it is for the reading page, and while
       you are inside one word there is no reading page to seek. So the axis
       says so, on the root element, the way this shell already says `data-dark`
       and `data-catch` -- and the rail reads it and keeps its hands off. One
       owner of the scroller at a time.

       AND THIS IS WHY THE BENCH NEVER SAW IT: bench-word.html did not mount
       scrub.js until today. */
    const onAxis = dx > DX_REST || dx < -DX_REST;
    if(onAxis !== lastOnAxis){
      lastOnAxis = onAxis;
      if(onAxis) document.documentElement.setAttribute("data-axis", "off-page");
      else document.documentElement.removeAttribute("data-axis");
    }
    /* ============ THE MARK'S ALPHA IS NOT THE ROOT'S BUSINESS ============
       Measured 10 September, by skipping this one line and re-running the same
       travel: 401ms a frame with it, 190ms without. Half the cost of the whole
       zoom was here.

       A custom property written on <html> is inherited by every element in the
       document, so Chromium has to walk all 152,374 paragraphs of the complete
       Shakespeare to find out who cares -- sixty times a second, to fade one
       highlight. `::highlight(word-target)` resolves `--wt-a` against the
       element the range sits in, and that element is inside the chapter the
       cursor is in, so the chapter is where the number belongs: the walk is one
       chapter instead of the book. The root keeps the default (.18) for every
       other chapter, which is what they should have anyway.

       And it is quantised. The eye cannot see 0.001 of an alpha; sixty writes
       of it and six look the same and cost a tenth. */
    if(o.readerCol){
      const raw = 0.18 * (1 - clamp(dx, 0, 1));
      const a = (Math.round(raw * 50) / 50).toFixed(2);      // 0.02 steps
      /* ...AND ON THE TRANSITION'S PATH IT IS THE WORD'S OWN PARAGRAPH, and at
         rest it is NOTHING: .18 is the root's default already, so writing it
         anywhere is a write to undo later -- and undoing it on the column cost
         45ms on the first frame of every zoom (a custom property is inherited;
         measured on the complete Shakespeare). */
      const wp = wordDomIndex[wordIdx] ? wordDomIndex[wordIdx].p : null;
      const host = a === "0.18" ? null : (wp || zoomedCh || o.readerCol);
      if(lastMarkA !== a || lastMarkHost !== host){
        if(lastMarkHost && lastMarkHost !== host && lastMarkHost.style)
          lastMarkHost.style.removeProperty("--wt-a");
        lastMarkA = a; lastMarkHost = host;
        if(host && host.style) host.style.setProperty("--wt-a", a);
      }
    }
    /* ============ THE VIEW, AND THE ZOOM THAT IS THE WAY TO IT ============
       All of it is wzFrame's now (THE ZOOM IS THE WAY IN AND OUT): which
       surface is up, the transform, the veil, the red letter, the handover in
       both directions, the subtitle. What stood here held the view open until a
       scrolled, css-zoomed page said it was "ready" -- up to thirty frames of
       two surfaces, or of none. */
    if(dx >= -DX_REST) wzFrame();
    /* ============ THERE IS NO SECOND WAY TO MAKE THE TEXT BIGGER ============
       Osca, 10 September: *"one just zooms, the other rearranges the page."*

       This line was the reason. `spreadNow` fell back to `spreadF` whenever
       `viewOn` was false, and `viewOn` is false on any surface where
       `wordview.js` was not loaded -- which `design/reader/shell.html` was
       not. So the app zoomed and the bench re-wrapped, from the same
       book-nav.js, and no amount of diffing the two files would ever have
       shown it: the difference was a missing script tag in a third file.

       A behaviour that depends on whether an unrelated file got mounted is not
       a behaviour, it is a coin toss. The parting is gone (see +2 above), so
       the spacing is never wanted at any dx, on any surface, ever -- and the
       one thing on this page that re-wraps now cannot be asked for at all.
       Osca: *"Text shouldn't move or be re-organised, or different lines made
       etc, NOTHING bar zoom into one word."* */
    spreadNow = 0;
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
    /* IT SLIDES, AND IT NEVER NARROWS -- Osca, 9 September, asked directly:
       *"slide, don't narrow -- as §3 says."* `UI-PLAN.md` §3 has said so since
       it was written: *"From step 2 the reader slides, it does not narrow. It
       keeps its measure and moves right; its right-hand side leaves the screen.
       No re-wrap, no reflow, nothing thrown away."*

       What the code did instead: it translated WHILE moving (good) and then, on
       the frame the movement stopped, moved the reader's real `left` -- which
       takes width out of the box and re-wraps the column once. Measured on
       Walden at 1440x900, going to the second rung:

           column width   1440 -> 846      a line's width   865 -> 765.5
           scrollTop     78387 -> 87878    (a 9,491px jump)

       The jump is the re-wrap's: a width change makes the browser throw away
       every height it had learned under `content-visibility`, and the scroll
       position is clamped against a column that has momentarily collapsed.
       `commitReaderEdge` carried a whole apparatus for surviving that --
       an anchor section, a reading-line offset, `holdOn` re-pinning the scroll
       for as many frames as the re-wrap took. **None of it is needed once
       nothing re-wraps.** The translate that was the mid-slide behaviour is now
       the resting behaviour too, so there is one state instead of two and no
       frame on which the text moves under the reader's eye. */
    if(o.readerBox){
      readerShift = pushFromOutside - readerRestLeft;
      writeReaderTransform();
      edgePending = false;
      lastPush = pushFromOutside;
      // live under the sidebar for the whole contents range -- only one
      // word actually covers and stops it.
      /* ...EXCEPT ON THE TRANSITION'S PATH (10 Sep). `pointer-events` is
         INHERITED, so writing it on #readerbox restyles every element the
         column has rendered -- 66-68ms, measured on the complete Shakespeare,
         on the frame the zoom crosses the middle each way: the largest stall
         left in the travel. The view takes the pointer itself instead
         (wordview.css, `.wordview.on`), so nothing reaches the page under it,
         and mid-zoom a press on the page is a press on the page. */
      o.readerBox.style.pointerEvents = "auto";
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
      /* ...and on the transition's path it goes when the ZOOM starts, not half
         way through it: a running head and a rail riding along at the page's
         scale for half the travel and then vanishing is a stripe that blinks.
         (Both are their own compositor layers -- wordview.css -- so this costs
         no repaint.) */
      o.readerHead.style.opacity = wzChromeOff(lvl) ? "0" : "";
    }
    if(o.readerScrub){
      o.readerScrub.style.opacity = wzChromeOff(lvl) ? "0" : "";
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
  /* `power` is OUT_SNAP unless a caller has its own: the exit out of the book
     travels the same SHAPE as every other rung and at its own SPEED, so tuning
     the way out cannot change the way home from one word. */
  function snapStart(goal, power){
    const d = Math.abs(goal - dx);
    if(d <= DX_REST){ setDx(goal); snapTo = null; return; }
    snapFrom = dx; snapTo = goal; snapT = 0;
    const OUT_SNAP = (power == null ? OUT_SNAP_ : power);
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

  let dxIdle=0, dxWent=0;    // which way the last push was going
  function stepDx(dt){
    /* ONCE THE BOOK IS LEAVING, THE AXIS IS NOT DRIVING ANY MORE -- `leaveT`
       is. Without this the rest-easing pulls dx back toward the nearest rung
       under the exit, which is movement nobody asked for on the way out. */
    if(leavingBook){ dxInput = 0; dxVel = 0; return; }
    /* THE AXIS IS WAITING FOR THE MAP (wzHoldAt): nothing drives it until the
       page can be measured, and then wzRelease sends it where it was going. */
    if(wz.hold){ dxInput = 0; dxVel = 0; return; }
    if(dxInput) snapCancel();
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
      if(dxInput) dxWent = dxInput;      // remembered for the release (STICK)
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
      /* MOMENTUM STOPS AT THE LAST PANE. Only a hand may enter the leaving
         zone -- a flick's tail must not spend it. */
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
      /* THE LEG THAT LANDED WAS NOT THE WHOLE JOURNEY. The zoom has arrived;
         only now may the spacing begin. */
      if(wordReach !== null && Math.abs(wordGoal - dx) > DX_REST){ wordLeg(); snapStep(dt); return; }
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
      paneEnd(); wordEnd();      // the hand is off; its ceiling goes with it
      // Real wheel gestures routinely die out somewhere like 0.7, not a
      // clean 1 -- past WORD's own threshold functionally, but visually
      // still short of fully open, which is exactly the kind of gap a
      // reader's own tinted opener (or a pane one level out) can show
      // through. Ease the rest of the way to whichever rest point --
      // reader/word, or however many left-stack stops this book's own
      // trail currently has -- was already closest.
      const targets = dxTargets();
      /* WHICH REST POINT A RELEASE RUNS TO. It was always the NEAREST, which is
         why "a small scroll moves them halfway and then gives up": a push that
         got 0.4 of the way to the next pane fell back to the one behind it, so
         the ladder only answered gestures big enough to pass the midpoint.
         With STICK above 0 the axis commits in the DIRECTION IT WAS TRAVELLING
         once it is that far into the rung -- a small scroll from pane one still
         drags pane two out. STICK 0.5 is the old behaviour exactly. */
      let target = targets.reduce((a,b)=>Math.abs(b-dx)<Math.abs(a-dx)?b:a);
      if(STICK > 0 && STICK < 0.5){
        const dir = dxWent < 0 ? -1 : (dxWent > 0 ? 1 : 0);
        if(dir){
          let ahead = null;
          for(const p of targets){
            if(dir < 0 ? p < dx - 1e-6 : p > dx + 1e-6){
              if(ahead == null || Math.abs(p - dx) < Math.abs(ahead - dx)) ahead = p;
            }
          }
          if(ahead != null){
            const behind = dir < 0 ? Math.ceil(dx - 1e-6) : Math.floor(dx + 1e-6);
            const into = Math.abs(dx - behind);
            if(into >= STICK) target = ahead;
          }
        }
      }
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
      /* AND THE SAME RULE AT THE OTHER END OF THE AXIS. Past the deepest pane
         there is nothing to rest on either -- you are either in the book or out
         of it -- so the stretch is decided on release, by where the gesture
         got to. Past LEAVE_COMMIT of the way out it goes; short of it, it comes
         back to the last pane and no book was closed. Nothing fires while a
         hand is still moving. */
      /* arming: the axis is idle and standing on the deepest pane */
      /* ...AND NOTHING ARMS WHILE A GESTURE IS STILL RUNNING. `paneReach` is
         non-null for exactly as long as the ladder has a hand on it, so this
         is the same rule as above from the other end: you arrive, you let go,
         and THEN going further is a gesture of its own. */
      if(!leavingBook && paneReach === null
         && Math.abs(dx + currentMaxLeft()) <= DX_REST){
        exitArmed = true; armedAt = currentMaxLeft();
      }
      if(!leavingBook && inLeavingZone()){
        /* ...AND ONLY IF YOU PUT IT THERE. `currentMaxLeft()` is not a
           constant -- opening a row rebuilds the trail, and a shallower one
           leaves the axis standing past a deepest pane that no longer exists.
           Without `exitArmed` that reads as a leaving gesture and closes the
           book on its own: measured in the harness, selecting a play inside a
           four-deep directory shut the book. The arm is only ever set by the
           axis coming to REST on the deepest pane, so a trail that moved under
           it eases back instead. */
        const over = clamp(-dx - currentMaxLeft(), 0, 1);
        /* the arm belongs to the trail it was taken on: if the directory has
           been rebuilt shallower underneath the axis, this is not a gesture. */
        if(exitArmed && armedAt === currentMaxLeft() && over >= LEAVE_COMMIT){
          closeToLibrary(); return;
        }
        if(snapTo == null) snapStart(-currentMaxLeft(), LEAVE_SNAP);
        snapStep(dt); return;
      }
      /* ...AND THE WAY THERE IS THE ZOOM, AT THE ZOOM'S OWN SPEED. This used
         OUT_SNAP_ -- four frames -- because the stretch between the page and
         the word used to be "nothing to look at". It is the transition now,
         the thing being watched, so it travels at WORD_SNAP like every leg. */
      if(dx > 0 && dx < 1){
        if(snapTo == null) snapStart(dx >= WORD_COMMIT ? 1 : 0, WORD_SNAP);
        snapStep(dt); return;
      }
      const goal = target;
      if(Math.abs(dx-goal) > DX_REST) setDx(dx + (goal-dx)*Math.min(1, T.snap*dt));
    }
  }

  let lastT=0;
  let lastDxSeen = null, dxStill = 0;
  function tick(now){
    const dt = lastT ? Math.min(3,(now-lastT)/16.667) : 1;
    lastT=now;
    if(screen==="open") {
      stepDx(dt);
      stepLeave(dt);
      if(levelOf(dx)==="word") coastWord(dt);
      stepPull(dt);                        // the travel toward an off-screen word
      /* IS THE AXIS STILL? The zoom is written as real type only in steps while
         it is moving (writePageZoom); the moment it stops, the page has to be
         type again and not a composited scale -- that is the frame you sit and
         read at. Two frames unchanged, and nothing holding a gesture open. */
      if(dx === lastDxSeen){ if(dxStill < 3) dxStill++; } else { dxStill = 0; lastDxSeen = dx; }
      atZoomRest = dxStill >= 2 && snapTo == null;
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

     SUPERSEDED IN PART, 11 Sep (G-STOPS, ONE FINGER, ONE POSITION below): the
     finger no longer feeds `axisPush`'s reach, except inside the LEAVING ZONE.
     It chooses one of three positions and the axis travels there by the
     wheel's own travel. What follows is the 8 Sep shape, kept as history.

     IT IS NOT A SECOND WAY OF OPENING THE CONTENTS. It opens nothing, animates
     nothing, and knows nothing about a pane: it calls `axisPush`, which is the
     sideways wheel's own function. Every behaviour along the axis therefore
     arrives for free and IDENTICALLY -- the panes come out under the finger,
     the detent at the reading page still holds, however many panes this book's
     trail has are each a position, the release still eases to whichever rest
     point `dxTargets()` says is nearest, a flick still carries (dxVel), and
     past the deepest pane the same LEAVING ZONE takes the finger and the same
     release decides it. There is no phone copy of any of that to drift.

     THE FINGER'S SIGN. The panes come out as dx goes NEGATIVE and the finger
     travels the other way, so a rightward drag pushes dx down and a leftward
     drag pushes it up -- one inversion, here and nowhere else. In wheel terms
     a rightward finger IS a negative deltaX, which is exactly the Mac's own
     two-finger swipe toward the contents.

     THE THREE GESTURES CANNOT COLLIDE, and it is decided by COUNT and by
     AXIS, never by a timer or a zone:
       * TWO fingers is nothing: the reader has no pinch (A PINCH DOES
         NOTHING, below). The second finger's own touchstart drops the swipe,
         the same way a `gesturestart` (Safari, and every WKWebView, which is
         what iOS is) drops it.
       * ONE finger, held mostly SIDEWAYS, is this.
       * ONE finger, held mostly UP AND DOWN, is reading: the reader's own
         scroll on the page, wheel.js's own drag inside a contents pane. It is
         never taken -- exactly wheel.js's `if(dx > dy) return`, which is how
         the Mac has always partitioned these two, said for a finger.

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
  /* ================ ONE FINGER, ONE POSITION (G-STOPS, 11 Sep) ================
     Osca, 11 Sep, 17:40: *"in the phone reader, there is no kind of CANNOT
     scroll past slides -- you just go straight through them."* The go: a touch
     fling behaves as the wheel does on the Mac -- at most ONE resting position
     per gesture, and it settles on a position when the finger lifts; no
     free-scrolling between positions.

     WHY THE WHEEL'S REACH WAS THE WRONG THING FOR A FINGER TO FEED. A trackpad
     gesture is one push and a momentum tail, and the axis rounds the reach the
     push built. A finger is not: it keeps going after the axis has arrived
     (the travel it started is 200-700 ms, a thumb is on the glass for as long
     as it likes), and every px it sends after arriving is a NEW push from the
     new place -- the book is reached and the same finger carries on into the
     next pane, or the one-word view is left and the same finger opens the
     contents. Nothing on the Mac can do that: its tail dies. And the reach
     has no velocity in it, so a quick short flick -- the phone's commonest
     gesture -- rounded to nothing (measured in Chromium, trusted touches: a
     189 px thumb flick from the first pane lost its first 27 px to the claim
     and moved nothing).

     So the finger CHOOSES A POSITION, one of three -- the one the gesture
     started on (p0), or the one either side of it -- and the axis TRAVELS
     there by the Mac's own travel: `snapStart` at WORD_SNAP (the zoom, as the
     wheel runs it) or PANE_SNAP. A fourth cannot be named by any finger.

       commit    px of finger travel, from where it touched down, that commits
                 the next position. Decided while the finger is still down, so
                 the travel starts under it; the finger back under
                 (commit - back) undoes it. 40 is Osca's own number for the
                 pull-out on a hand (PROMPTS/round-11-sep-evening.md, lane 5:
                 "a drag of 40 px commits").
       flickV    px/ms. A finger LIFTED moving at least this fast toward the
                 next position commits it however short the drag... (0.3 is the
                 phone bar's own flick, reader.html's lift.)
       flickMin  px ...once it has travelled at least this far from touch-down.
       flickWin  ms the lift's velocity is read over.
       ...and a finger lifted moving BACK at flickV undoes a committed drag,
       so a hand that changes its mind is not made to finish.

     THE SETTLE is the Mac's travel, unchanged: smoothstep over
     clamp(85 / power * sqrt(distance), 3, 45) frames -- one position of zoom
     (WORD_SNAP 2) is 42.5 frames, ~708 ms; one pane (PANE_SNAP 7) 12.1 frames,
     ~202 ms. Nothing coasts: the finger never writes dxInput/dxVel here.

     THE PULL-OUT IS AN EDGE GESTURE (D19, Osca, 11 Sep, PROMPTS/sync-phone-
     plan.md: *"edge zone, but wide: 24 px, and a drag of 40 px commits"*).
     From the book, a finger travelling RIGHT -- toward the contents -- is only
     the axis when it went down within `edge` px of the left edge (plus the
     safe-area inset, in landscape). From anywhere else on the page it is not
     taken and dropped: nothing moves. Every other direction from every other
     position is anywhere on the glass: into the view, home from it, deeper
     into an open trail, back out of it. The numbers are G-CHROME2's gate's
     (design/phone/test-pullout.mjs), which is written against this file.

     THE ONE STRETCH STILL DRIVEN BY HAND is the LEAVING ZONE past the deepest
     pane -- axisPush's, a LEAVE_STEP at a time, decided on release by
     LEAVE_COMMIT exactly as on the Mac -- and it is open only to a gesture that
     STARTED on the deepest pane after the axis came to rest there (exitArmed):
     the library is that gesture's one position. */
  const TOUCH = {
    edge: 24,         // px from the left edge: where a pull-out from the book may start (D19)
    commit: 40,       // px from touch-down: the next position is committed
    back: 12,         // px: a committed drag is undone under (commit - back)
    flickV: 0.3,      // px/ms at the lift, toward the next position: commits it
    flickMin: 16,     // px from touch-down before a flick counts at all
    flickWin: 80,     // ms of samples the lift's velocity is read over
  };
  const PHONE = (() => { try{ return !!(document.documentElement
    && document.documentElement.hasAttribute("data-phone")); }catch(_){ return false; } })();
  let swipe = null, lastTouch = null;
  const tnow = t => (typeof t === "number" && t > 0) ? t
    : ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
  let safeL = null, safeW = -1;
  function safeLeft(){
    const w = window.innerWidth || 0;
    if(safeL !== null && safeW === w) return safeL;
    safeW = w; safeL = 0;
    try{
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;"
        + "padding-left:env(safe-area-inset-left,0px)";
      document.body.appendChild(d);
      safeL = parseFloat(getComputedStyle(d).paddingLeft) || 0;
      d.remove();
    }catch(_){ safeL = 0; }
    return safeL;
  }
  function swipeArm(x, y, t){
    if(!PHONE) return false;
    if(screen !== "open" || !book || leavingBook) return false;
    swipe = { x0:x, y0:y, x:x, y:y, live:false, took:false, axis:null,
              p0:0, goal:0, leave:0, leaving:false, samples:[{t:tnow(t), x:x}] };
    return true;
  }
  /* the position a gesture starts from: where the axis stands, or -- if a
     travel is already under way -- where it was already going. A second flick
     during the first one's travel is therefore one position past the FIRST
     one's choice, never two past where the axis happens to be. */
  function touchFrom(){
    const m = currentMaxLeft();
    let p = wz.hold ? wz.goal : (snapTo != null ? Math.round(snapTo) : posNow());
    return clamp(p, -m, DX_MAX);
  }
  /* a position the axis may be sent to: on the axis, and never across the
     book from where it stands -- a finger that reverses through its own
     touch-down comes home first, one leg at a time, as the wheel does. */
  function touchLegal(p){
    p = clamp(p, -currentMaxLeft(), DX_MAX);
    if(dx > DX_REST && p < 0) return 0;
    if(dx < -DX_REST && p > 0) return 0;
    return p;
  }
  /* SEND THE AXIS TO A POSITION, by the travel the wheel itself uses -- and
     only when the mark actually changes (snapStart restarts its clock). */
  function touchGo(g){
    dxVel = 0; dxInput = 0; detent = false; dxIdle = 0;
    if(wz.hold){ wz.goal = Math.max(0, g); return; }   // wzRelease sends it there
    const going = snapTo != null ? snapTo : dx;
    if(g >= 0 && dx >= -DX_REST){
      wordGoal = g; wordReach = g;
      if(Math.abs(going - g) > DX_REST) snapStart(g, WORD_SNAP);
    } else {
      paneReach = g;           // a hand is on the ladder: nothing arms until it lifts
      if(Math.abs(going - g) > DX_REST) snapStart(g, PANE_SNAP);
    }
    markPaint();
  }
  function touchV(s, tEnd){
    /* px/ms over the last flickWin, ending at the lift -- a finger that stopped
       and then lifted has a velocity of nothing, however fast it once was */
    const S = s.samples, last = S[S.length - 1];
    const end = Math.max(tEnd, last.t);
    let old = null;
    for(let i = S.length - 1; i >= 0; i--){ if(end - S[i].t <= TOUCH.flickWin) old = S[i]; else break; }
    if(!old || old === last) return 0;
    const dt = end - old.t;
    return dt > 0 ? (last.x - old.x) / dt : 0;
  }
  // returns true when it has taken the event
  function swipeMove(x, y, t){
    if(!swipe) return false;
    if(!swipe.live){
      const ax = Math.abs(x - swipe.x0), ay = Math.abs(y - swipe.y0);
      if(ax < SWIPE.slop && ay < SWIPE.slop){ swipe.samples.push({t:tnow(t), x:x}); return false; }   // still undecided
      if(ax > ay){
        swipe.axis = "dx"; swipe.p0 = swipe.goal = touchFrom();
        /* D19: from the book, toward the contents, only from the edge. From
           anywhere else the finger is TAKEN and dropped, as a pinch is: left
           alone a sideways sweep is not nothing -- measured in Chromium, trusted
           touches at 402x874, it is the browser's own back-swipe and the page
           navigated away. */
        if(swipe.p0 === 0 && x > swipe.x0 && swipe.x0 > TOUCH.edge + safeLeft()) swipe.axis = "none";
      }
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
      if(swipe.axis === "word" || swipe.axis === "none") return true;
    }
    if(swipe.axis === "none") return true;              // taken, and nothing follows
    const px = x - swipe.x, py = y - swipe.y;
    swipe.x = x; swipe.y = y;
    if(swipe.axis === "word"){
      // a finger travelling UP carries the reading forward, which is what a
      // positive wheel deltaY means -- one inversion, and bumpWord's own
      // WORD_PX decides how far a word is.
      if(py){ swipe.took = true; bumpWord(-py); markPaint(); }
      return true;
    }
    const s = swipe;
    s.samples.push({t:tnow(t), x:x});
    if(s.samples.length > 24) s.samples.shift();
    s.took = true;
    dxIdle = 0;
    /* the panes come out as dx goes NEGATIVE and the finger travels the other
       way: a finger travelling RIGHT (dist > 0) asks for the position LEFT. */
    const dist = x - s.x0, dir = dist > 0 ? -1 : 1, a = Math.abs(dist);
    const m = currentMaxLeft();
    /* PAST THE DEEPEST PANE: the leaving zone, by hand, the Mac's way -- and the
       zone is the whole of this gesture's one position, so a hand that turns
       round in it stops at the pane it came from. */
    if(s.p0 === -m && dir < 0){
      s.leaving = true;
      const d = -(px / Math.max(1, window.innerWidth || 1)) * SWIPE.gain;
      const was = s.leave;
      s.leave = clamp(s.leave + d, -1, 0);
      if(s.leave !== was) axisPush(s.leave - was);
      markPaint();
      return true;
    }
    if(s.leaving){ s.leaving = false; s.leave = 0; }
    const next = touchLegal(s.p0 + dir);
    let g;
    if(a >= TOUCH.commit) g = next;
    else if(s.goal === next && s.goal !== s.p0 && a >= TOUCH.commit - TOUCH.back) g = next;
    else g = touchLegal(s.p0);
    if(g !== s.goal){ s.goal = g; touchGo(g); }
    else if(dx !== g && snapTo == null) touchGo(g);   // a travel something else stopped goes on
    return true;
  }
  /* THE FINGER IS OFF: the one decision that is taken on the lift. */
  function swipeLift(t, cancelled){
    const s = swipe; swipe = null;
    if(!s || !s.live || s.axis !== "dx" || !s.took) return;
    if(s.leaving){ paneEnd(); return; }     // LEAVE_COMMIT decides, in stepDx, as on the Mac
    const dist = s.x - s.x0, a = Math.abs(dist), dir = dist > 0 ? -1 : 1;
    const v = cancelled ? 0 : touchV(s, tnow(t));
    const toward = dist > 0 ? v : -v;       // + = still travelling the drag's way
    const next = touchLegal(s.p0 + dir);
    let g = s.goal;
    if(a >= TOUCH.flickMin && toward >= TOUCH.flickV) g = next;          // a flick commits
    else if(g !== s.p0 && toward <= -TOUCH.flickV) g = touchLegal(s.p0); // thrown back: undone
    s.lift = { dist: dist, v: v, goal: g, p0: s.p0 };
    lastTouch = s.lift;
    if(g !== s.goal){ s.goal = g; touchGo(g); }
    paneEnd();                               // the hand is off: arming may follow the rest
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
  /* ================ A PINCH DOES NOTHING IN THE READER ===================
     Osca, 11 September: *"REMOVE THE READER'S PINCH ... The scroll is the way
     in and out, it is perfect, and it must not change by one pixel ... the
     pinch fights it (two drivers on one dx)."* So there is one driver of dx on
     the word side, and it is the scroll.

     What is left here is what makes "nothing" true, and it drives nothing:
     each of the three engines a pinch arrives by is TAKEN and dropped. Left
     alone they are not nothing -- Chromium's ctrl+wheel would fall through to
     the axis, or step the word inside the view, or zoom the browser; Safari's
     GestureEvents and two fingers on iOS glass would zoom the WebView. The
     same events were already taken here, by the pinch, with a book open; now
     they are taken and nothing follows. A second finger also drops the swipe,
     as it always has: two fingers are never the axis. */
  function refusePinch(e){
    swipeDrop();
    if(screen === "open" && book && e && e.preventDefault) e.preventDefault();
  }
  addEventListener("touchstart", e=>{
    const t = e.touches || [];
    if(t.length === 2){ refusePinch(e); return; }
    // one finger is the axis, IF it turns out to be sideways. Nothing is
    // preventDefault-ed here: until it has proved itself horizontal this is
    // still an ordinary touch on an ordinary page, and a page that scrolls
    // under it.
    if(t.length === 1) swipeArm(t[0].clientX, t[0].clientY, e.timeStamp);
  }, {passive:false});
  addEventListener("touchmove", e=>{
    const t = e.touches || [];
    if(swipe && t.length === 1 && swipeMove(t[0].clientX, t[0].clientY, e.timeStamp)){
      // only once the swipe is LIVE, which is the whole of why swipeMove
      // answers a boolean: an undecided touch must still be able to scroll.
      if(e.preventDefault) e.preventDefault();
    }
  }, {passive:false});
  addEventListener("touchend", e => swipeLift(e && e.timeStamp, false));
  addEventListener("touchcancel", e => swipeLift(e && e.timeStamp, true));

  addEventListener("gesturestart", refusePinch, {passive:false});
  addEventListener("gesturechange", refusePinch, {passive:false});

  // ---------------------------------------------------------------- INPUT
  addEventListener("wheel", e=>{
    inputTick++;
    wakeSub();                       // any wheel wakes the subtitle (job 24)
    if(screen!=="open") return;
    // A CHROMIUM PINCH IS A WHEEL WITH CTRL HELD, and so is ctrl+scroll on a
    // mouse. It is taken first, at every level, and does nothing (A PINCH DOES
    // NOTHING, above): never the axis, never a word step, never the browser's
    // own zoom.
    if(e.ctrlKey){ if(e.preventDefault) e.preventDefault(); return; }
    if(levelOf(dx)==="word"){
      // down/up reads on (the finest grain there is); left/right only
      // leaves the view -- same two rules as everywhere else, applied here.
      // ...AND ONLY IN THE VIEW. Mid-zoom the word being flown to is fixed:
      // a step there would change the target under a map already made.
      if(Math.abs(e.deltaY) >= Math.abs(e.deltaX)){
        if(Math.abs(e.deltaY)>0){ e.preventDefault(); if(wzReads()) bumpWord(e.deltaY); }
        return;
      }
      e.preventDefault();
      axisPush(e.deltaX*T.gain);
      return;
    }
    if(Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;   // vertical: the reader's own scroll
    // THE AXIS IS BEING PUSHED. What that means -- the deliberate push past
    // the deepest pane, the exit -- is
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
        e.preventDefault();
        if(wzReads()) stepWord(e.key==="ArrowDown"?1:-1);
        return;
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
        // has always had a gate here -- past the last pane it travels into the
        // leaving zone and the release decides -- and the arrow key had none: whichever
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
    /* ================= THE MOVEMENT, AS NUMBERS ==========================
       Osca, 9 Sep, after driving the panes on his phone: *"the first contents
       pane doesn't exist RIGHT AT THE EDGE of the screen... it feels 2 inches
       further out, so it's not responsive to small movements. Then there is
       jitter, the panes aren't sticky enough, a small scroll moves them /
       doesn't move them / moves them halfway... I believe the movement should
       be PUSHED to bench-panes, then give me controls over the scroll and the
       animations."*

       Right, and bench-panes.html had its OWN toy physics -- `dx += (dxTarget
       - dx) * snap` and a pointer drag that rounded on release -- so nothing
       dialled there had ever described what the app does. That is the same
       fault as the two rails, in the panes. The bench mounts THIS file now,
       and these are the numbers it moves.

         gain     how much dx one px of wheel is worth
         vmax     the ceiling on coasting speed
         coast    how much of a push becomes momentum
         decay    how fast that momentum dies
         couple   how much of it the panes take
         snap     how hard the rest-easing pulls
         grace    dt-units of idle before that easing may start at all
         swipeGain  POSITIONS PER SCREEN-WIDTH of finger travel. 1.15 means a
                    full sweep of the phone is one pane and a sixth -- which is
                    the "2 inches further out" above, in one number.
         swipeSlop  px of travel before a finger gesture is claimed
         stick    how far into a rung a push must get for the RELEASE to commit
                  to it. 0 is the old rule -- ease to whichever rung is
                  NEAREST, so a push of 0.4 falls back and "a small scroll
                  doesn't move them". Above 0 the axis commits in the direction
                  you were travelling. */
    tune(k, v){
      if(k === "swipeGain"){ SWIPE.gain = +v || SWIPE.gain; return SWIPE.gain; }
      if(k === "swipeSlop"){ SWIPE.slop = +v; return SWIPE.slop; }
      if(k === "touchEdge"){ TOUCH.edge = +v; return TOUCH.edge; }
      if(k === "touchCommit"){ TOUCH.commit = +v; return TOUCH.commit; }
      if(k === "touchBack"){ TOUCH.back = +v; return TOUCH.back; }
      if(k === "flickV"){ TOUCH.flickV = +v; return TOUCH.flickV; }
      if(k === "flickMin"){ TOUCH.flickMin = +v; return TOUCH.flickMin; }
      if(k === "stick"){ STICK = clamp(+v || 0, 0, 0.99); return STICK; }
      if(k in T){ T[k] = +v; return T[k]; }
      return null;
    },
    /* the last finger's decision, for the harness: where it started, how far
       and how fast it lifted, and the position it chose (G-STOPS) */
    get touchLast(){ return lastTouch ? Object.assign({}, lastTouch) : null; },
    get tuneNow(){
      return { gain:T.gain, vmax:T.vmax, coast:T.coast, decay:T.decay,
               couple:T.couple, snap:T.snap, grace:T.grace,
               swipeGain:SWIPE.gain, swipeSlop:SWIPE.slop, stick:STICK,
               touchEdge:TOUCH.edge, touchCommit:TOUCH.commit, touchBack:TOUCH.back,
               flickV:TOUCH.flickV, flickMin:TOUCH.flickMin,
               outSnap:OUT_SNAP_, leaveSnap:LEAVE_SNAP,
               stick:STICK, open:OPEN, opens:OPENS, pastAt:PAST_AT,
               paneSnap:PANE_SNAP };
    },
    /* THE RAIL, for the bench and for the headless checks -- `rail.set(k,v)` is
       the same call bench-page.html makes, so a number proved on the bench is
       the number the app runs. */
    get rail(){ return readerRail; },
    /* THE CONTENTS PANES THEMSELVES -- width, the white space between them,
       how far out they start and the shape of the way in. See PANE above. */
    pane:setPane, get paneNow(){return Object.assign({}, PANE);},
    /* THE ZOOM'S OWN STATE, read-only and in one place -- what factor is on the
       column, how far across it is standing, the point the word is being held
       at, the arrival it is travelling to, and whether the reader is still
       being brought to the word. A bench prints it; a check reads it; nothing
       here can be set from outside. */
    get zoomState(){
      return { z: pageZ, shift: shiftX,
               anchor: anchor ? { x: anchor.x, y: anchor.y } : null,
               k: arrived ? arrived.k : 0, seating: seating,
               chapter: wordChapterIdx, word: wordIdx };
    },
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
    get outSnap(){ return OUT_SNAP_; }, set outSnap(v){ OUT_SNAP_ = +v || 1; },
    /* HOW LONG LEAVING THE BOOK TAKES -- its own number, so tuning the way out
       cannot change the way home from one word. Higher is shorter: 6 is ~250ms,
       3 is ~470ms, 1.5 is ~940ms. */
    get leaveSnap(){ return LEAVE_SNAP; },
    set leaveSnap(v){ LEAVE_SNAP = Math.max(0.25, +v || 3);
      try{ localStorage.setItem("leavesnap", String(LEAVE_SNAP)); }catch(_){}
      return LEAVE_SNAP; },
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
    get ampLevel(){ try{ return +(localStorage.getItem("amp")??1); }catch(_){ return 1; } }, get speedName(){return speedName;}, speeds:Object.keys(SPEEDS), get dx(){return dx;}, /* THE MARK, BEFORE THE MOVEMENT. Where the axis has DECIDED to be, as against `dx`, where it currently is. Null when nothing is travelling. */ get snapGoal(){return snapTo;}, get screen(){return screen;},
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
           go(p){ goPos(p); },
           /* THE TRANSITION'S OWN STATE, read-only, for design/reader/pixelcheck/gate.mjs */
           zoomProbe(){ return wzProbe(); },
           /* the one size every word is drawn at, in px -- WORD.height of the
              reference (the short side on a phone), for the view and the zoom */
           get wordPx(){ return wordFontPx(); },
           get wordText(){ return wordTextAt(wordIdx) || ""; } };
}
window.BookNav = {mount};
})();
