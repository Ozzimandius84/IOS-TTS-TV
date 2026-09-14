/* ENGINE · FOLLOW -- the page follows the voice, one decision per sentence
   · master: design/reader/follow.js · copied byte-identical to reader/follow.js
   · mounted by: reader/reader.html, one <script src>, after book-nav.js and
     listen.js; the button is the play bar's (reader.html's own mount)
   · node test: design/reader/test-follow.mjs

   Osca, 13 September: *"Follow along the voice, you need to be able to track
   this, simple button in the playback bar, doesn't need to highlight text much
   at all in the main reader, just the page should follow nicely, between
   panes/slides too."* `plan-12-sep.md` §8.2 is the same thing written down, and
   it retires the assumption behind TESTING.md A2.13 (the word highlight tracks
   the voice) in favour of the thing actually wanted: THE PAGE IS ALWAYS SHOWING
   THE SENTENCE BEING SPOKEN.

   WHAT WAS THERE BEFORE, AND WHY IT IS NOT THIS. `listen.js::paint` ended with
   `sHit.el.scrollIntoView({block:"nearest", behavior:"smooth"})` -- the
   PARAGRAPH of the sentence, scrolled to the NEAREST edge, on every frame the
   paragraph changed. Three things are wrong with it as a feature and all three
   are the ones Osca named:
     * `block:"nearest"` moves the page the SMALLEST distance that puts the
       paragraph on screen -- so the paragraph lands against the bottom edge and
       the very next paragraph has to move the page again. A move per paragraph,
       for ever, is the page never sitting still;
     * it cannot be turned off, so a reader who has scrolled somewhere to look
       at something is dragged back by the voice;
     * it is the paragraph, so a long paragraph read from its middle scrolls
       once at the top and then lets the voice walk off the bottom of the screen.
   That line is gone from listen.js in the same commit as this file. FOLLOW OWNS
   THE PAGE now -- one thing moving it, which is the whole of "never jumps".

   THE RULE, AND IT IS ONE SENTENCE: **at the moment the spoken sentence
   changes, and at no other moment, the page is moved if that sentence is not
   already whole on the screen.** Every clause of Osca's ask falls out of it:
     never mid-sentence -- the only trigger is a sentence CHANGING;
     never a sentence late -- the trigger is the change itself, not the voice
       reaching the bottom of the screen;
     exactly once -- one decision per sentence id, so a sentence that straddles
       the fold turns the page one time and then the page stands still for the
       rest of it;
     nicely -- when it does move it moves GENEROUSLY, putting the sentence's top
       on the reading line (0.35, page.js's own line, the one the runhead and
       both chapter-under-line copies already use), so two thirds of a screen of
       book sits ahead of the voice and the next several sentences need no move
       at all. A page turn, not a crawl.

   TWO ENGINES, ONE DOOR. A sentence is `{key, rect}` and nothing else, so the
   rendered master and the system voice are the same case:
     * rendered -- `listen.js`'s own map, `control.map.bySentId.get(id)` ->
       `{node, s, e}`, and `getPosition().sentenceId` is the key. The map is
       already public (voiceui reads it) and this adds nothing to it;
     * the system voice -- `sysvoice.js`'s sentences are flat word spans
       (`{from, words}`), and `state().sentence` is the span of the one being
       spoken. `spanRange` turns a flat span into a Range by walking the
       chapter's `p.line` elements exactly as `book-nav.js::buildWordDomIndex`
       walks them. That is the SAME numbering, reproduced, not a second one
       (project memory `the_word_map_is_rebuilt_not_stored`): same elements,
       same order, same whitespace split. Nothing is wrapped, marked or
       measured onto the page -- a Range is made, read and dropped.

   THE HIGHLIGHT IS OSCA'S CALL AND IT IS ONE CONSTANT. `MARK` below is
   `"sentence"` (the sentence, a fifth of the wash it used to be, and no word
   mark at all) or `"none"` (nothing in the main reader). It is written onto
   `<html>` as `data-follow-mark` and `reader/listen.css` is what draws it; the
   marks themselves are still `listen.js`'s two CSS Custom Highlights, untouched.
   Changing the constant is changing one word in this file.

   WHAT IT NEVER DOES. It never moves the AXIS -- the panes, the slides, one
   word view are one finger's decision and taking them from the reader would be
   the biggest jump this could make. It stands down entirely while the page is
   zoomed (the `.pane.zoomed, .column.zoomed` pair the play bar already asks),
   because there `book-nav.js`'s own cursor seat owns the page and two things
   seating one scroller is the fight this file exists to end; coming out of the
   zoom `kick()`s it, so the next sentence is followed rather than skipped. §6
   asks Osca whether FOLLOW should also pull the axis home.

   AND A HAND ON THE PAGE STOPS IT. Scrolling by hand HOLDS follow -- the button
   stays on and dims -- until the next press of play. A hold is a scroll that
   moved the scroller within 700 ms of a wheel or a finger, which is how a hand
   is told from this file's own move without either guessing at `scrollTop`
   (the move is smooth, so it is many scroll events) or fighting the swipe
   engine (a sideways swipe changes no scrollTop, so it holds nothing).

   UMD, like every other file the page loads by <script src>: no ES modules, no
   bundler, `reader.html` stays file://-capable. `module.exports` under Node for
   the test, which is where the decision and the span arithmetic are proved. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Follow = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ★ THE ONE CONSTANT (Osca's call): what the MAIN READER shows while the
     voice reads it. "sentence" -- the sentence, faintly, and no word mark.
     "none" -- nothing at all; the page just follows. reader/listen.css draws
     both; nothing else in the app reads this. */
  var MARK = "sentence";

  var LINE = 0.35;        /* where a followed sentence's top is put, 0..1 of the pane */
  var PAD = 8;            /* px of the pane's own edge that does not count as "on screen" */
  var HAND_MS = 700;      /* a scroll this soon after a wheel or a finger is a hand */
  var KEY = "ttstv_follow";

  /* ====================================================== THE DECISION =====
     Pure: three boxes in, a delta or nothing out. `sent` and `view` are in the
     same coordinates -- client coordinates on the page, plain numbers in the
     test.

       sent  {top, bottom}   the sentence being spoken
       view  {top, height}   the scroller
       ->    null            it is already whole on the screen: do not move
             {dy, why}       scroll the scroller BY dy (positive = forward)

     A sentence taller than the pane cannot be shown whole; it gets the same
     treatment as any other -- its top on the line -- and then the page stands
     still for the rest of it, which is the promise. */
  function decide(sent, view, opt) {
    if (!sent || !view) return null;
    var o = opt || {};
    var line = o.line == null ? LINE : +o.line;
    var pad = o.pad == null ? PAD : +o.pad;
    var h = +view.height, top = +view.top;
    var sTop = +sent.top, sBot = +sent.bottom;
    if (!isFinite(h) || h <= 0 || !isFinite(top)) return null;
    if (!isFinite(sTop) || !isFinite(sBot)) return null;
    var whole = sTop >= top + pad && sBot <= top + h - pad;
    if (whole) return null;
    var dy = sTop - (top + h * line);
    if (Math.abs(dy) < 1) return null;                 /* already there, near enough */
    return { dy: dy, why: sTop < top + pad ? "back" : "on" };
  }

  /* ======================================================== THE TRACKER ====
     The "exactly once" half, and it is pure as well, so the gate is a number
     rather than a browser. One decision per sentence KEY: the same key asked
     twice answers null the second time, whatever has happened to the geometry
     in between. That is what stops a page turning twice for one sentence, and
     it is why a long sentence straddling the fold turns the page at its start
     and never again.

       step({key, sent, view, playing, held, still})
         playing false -> nothing moves, and the key is NOT taken, so the
                          sentence you paused inside is followed on resume;
         held    true  -> a hand is on the page: nothing moves, and the key IS
                          taken, so releasing the hold does not fire a stale
                          turn for a sentence the reader has since read;
         still   true  -> the page is zoomed (or otherwise not ours): same. */
  function tracker() {
    var last = null, wasPlaying = false;
    return {
      get key() { return last; },
      kick: function () { last = null; },
      step: function (s) {
        var q = s || {};
        var playing = !!q.playing;
        if (playing && !wasPlaying) last = null;   /* a fresh press catches up at once */
        wasPlaying = playing;
        if (!playing || !q.key) return null;
        if (q.key === last) return null;
        if (q.held || q.still) { last = q.key; return null; }
        /* A SENTENCE THAT WILL NOT MEASURE IS NOT A SENTENCE WE HAVE SEEN. A
           chapter mid-render, a Range over a node that has just been replaced:
           the rect comes back null, and taking the key there would spend the
           one decision this sentence gets on a frame that knew nothing. So the
           key is taken only when a real answer is possible, and the next tick
           asks again. */
        if (!q.sent || !q.view) return null;
        last = q.key;
        return decide(q.sent, q.view, q);
      },
    };
  }

  /* ============================================ A FLAT SPAN, AS A RANGE ====
     `book-nav.js::buildWordDomIndex`'s walk, reproduced exactly: `p.line` in
     document order, each one's FIRST CHILD text node, split on whitespace,
     counting only `p.line`. A paragraph with no text node contributes nothing,
     there as here. So the flat index this arithmetic lands on is the index
     `nav.goTo` takes, by construction.

     `from`/`to` are flat word indices, inclusive. Returns a Range over the
     characters of those words, or null if the span is not on this chapter's
     page (a chapter still rendering, a span past its end). Nothing is written
     to the DOM. */
  function spanRange(sec, from, to, doc) {
    if (!sec || !sec.querySelectorAll) return null;
    var a = from | 0, b = to | 0;
    if (b < a) b = a;
    var lines = sec.querySelectorAll("p.line");
    var flat = 0, start = null, end = null;
    for (var i = 0; i < lines.length && end === null; i++) {
      var tn = lines[i].firstChild;
      if (!tn || tn.nodeType !== 3) continue;
      var text = tn.nodeValue || "";
      var toks = tokens(text);
      if (!toks.length) continue;
      if (a < flat + toks.length && start === null) start = { node: tn, at: toks[a - flat].s };
      if (b < flat + toks.length) end = { node: tn, at: toks[b - flat].e };
      flat += toks.length;
    }
    if (!start) return null;
    if (!end) {
      /* the span runs off the end of what is rendered: take what there is */
      var lastTok = null, lastNode = null;
      for (var j = lines.length - 1; j >= 0 && !lastTok; j--) {
        var t2 = lines[j].firstChild;
        if (!t2 || t2.nodeType !== 3) continue;
        var k2 = tokens(t2.nodeValue || "");
        if (k2.length) { lastTok = k2[k2.length - 1]; lastNode = t2; }
      }
      if (!lastTok) return null;
      end = { node: lastNode, at: lastTok.e };
    }
    var d = doc || (sec.ownerDocument || (typeof document !== "undefined" ? document : null));
    if (!d || !d.createRange) return null;
    try {
      var r = d.createRange();
      r.setStart(start.node, start.at);
      r.setEnd(end.node, end.at);
      return r;
    } catch (e) { return null; }
  }
  /* the whitespace split, as offsets into the node's own text */
  function tokens(text) {
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(text))) out.push({ s: m.index, e: m.index + m[0].length });
    return out;
  }
  /* the union of a Range's line boxes, top and bottom. `getBoundingClientRect`
     is that union already; the guard is for a Range that will not measure
     (headless, a node detached under it), where the answer is "do not know"
     and NOT a box of zeroes at the top of the screen. */
  function rectOf(range) {
    if (!range || !range.getBoundingClientRect) return null;
    var r;
    try { r = range.getBoundingClientRect(); } catch (e) { return null; }
    if (!r || (!r.height && !r.width && !r.top && !r.bottom)) return null;
    return { top: r.top, bottom: r.bottom };
  }

  /* ========================================================== THE MOUNT ====
     The page hands it four doors and keeps none of this file's state:

       pane()      -> the scroller (#readerpane)
       sentence()  -> {key, range} | null -- the sentence being spoken, NOW
       playing()   -> is a voice actually speaking
       still()     -> is the page somebody else's this frame (the zoom)
       onState(s)  -> repaint the button

     It subscribes to nothing and is TICKED from outside -- the play bar's
     transport subscription is already running at animation rate while a voice
     plays and at 250 ms otherwise, and a second loop over the same clock would
     be a second answer to "where is the voice". */
  var live = null;

  function mount(o) {
    var opt = o || {};
    var tr = tracker();
    var on = stored();
    var held = false, handAt = 0;

    function pane() { try { return opt.pane ? opt.pane() : null; } catch (e) { return null; } }

    /* A HAND ON THE PAGE. A wheel or a finger only ARMS it; the hold is taken
       when the scroller actually moves, so a sideways swipe (which changes no
       scrollTop) and a tap hold nothing. */
    var p = pane();
    if (p && p.addEventListener) {
      var arm = function () { handAt = now(); };
      p.addEventListener("wheel", arm, { passive: true });
      p.addEventListener("touchmove", arm, { passive: true });
      p.addEventListener("scroll", function () {
        if (!on || held) return;
        if (now() - handAt < HAND_MS) { held = true; tell(); }
      }, { passive: true });
    }

    function tell() { try { if (opt.onState) opt.onState(state()); } catch (e) {} }
    function state() { return { on: on, held: held, following: on && !held }; }

    function tick() {
      if (!on) return null;
      var s = null;
      try { s = opt.sentence ? opt.sentence() : null; } catch (e) { s = null; }
      var v = pane(), playing = false, stillNow = false;
      try { playing = !!(opt.playing && opt.playing()); } catch (e) {}
      try { stillNow = !!(opt.still && opt.still()); } catch (e) {}
      var move = tr.step({
        key: s && s.key, sent: s && rectOf(s.range),
        view: v ? { top: v.getBoundingClientRect().top, height: v.clientHeight || 0 } : null,
        playing: playing, held: held, still: stillNow,
      });
      if (!move || !v) return null;
      var max = (v.scrollHeight || 0) - (v.clientHeight || 0);
      var to = v.scrollTop + move.dy;
      if (to < 0) to = 0;
      if (max > 0 && to > max) to = max;
      if (Math.abs(to - v.scrollTop) < 1) return null;
      try { v.scrollTo({ top: to, behavior: "smooth" }); }
      catch (e) { v.scrollTop = to; }
      handAt = 0;                      /* our own move never arms the hand */
      return { dy: move.dy, to: to, why: move.why };
    }

    /* THE PRESS OF PLAY IS WHAT RELEASES A HOLD, and the tracker sees the same
       edge: `step` clears its key when `playing` goes true, so the release and
       the catch-up are one thing and cannot disagree. */
    function resume() { if (held) { held = false; tr.kick(); tell(); } }

    var h = {
      tick: tick, resume: resume, kick: function () { tr.kick(); },
      get on() { return on; }, get held() { return held; },
      state: state,
      set: function (v) {
        var want = !!v;
        if (want === on) return on;
        on = want; held = false; tr.kick(); store(on); tell();
        return on;
      },
      toggle: function () { return h.set(!on); },
      /* read-only, for a driver and the report */
      get key() { return tr.key; },
    };
    live = h;
    tell();
    return h;
  }

  function now() { return typeof Date !== "undefined" ? Date.now() : 0; }
  function stored() {
    try {
      var v = root().localStorage.getItem(KEY);
      return v === null ? true : v !== "0";          /* ON by default */
    } catch (e) { return true; }
  }
  function store(v) {
    try { root().localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {}
  }
  function root() { return typeof self !== "undefined" ? self : {}; }

  /* THE DOORS THE PLAY BAR USES, and they are the module's own rather than the
     handle's, because the bar is built at parse time and this is mounted once
     a book is open -- a button that held a handle would hold null for ever.
     With nothing mounted every one of them is a no-op that answers `off`. */
  return {
    MARK: MARK, LINE: LINE, PAD: PAD, HAND_MS: HAND_MS, KEY: KEY,
    decide: decide, tracker: tracker, spanRange: spanRange, tokens: tokens,
    rectOf: rectOf, mount: mount,
    get live() { return live; },
    state: function () { return live ? live.state() : { on: false, held: false, following: false }; },
    toggle: function () { return live ? live.toggle() : false; },
    set: function (v) { return live ? live.set(v) : false; },
    resume: function () { if (live) live.resume(); },
    kick: function () { if (live) live.kick(); },
    tick: function () { return live ? live.tick() : null; },
  };
});
