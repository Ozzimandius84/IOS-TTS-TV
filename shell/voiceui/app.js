// voiceui/app.js -- orchestrates grammar -> detour -> reader-bridge for
// playback commands, and resolve -> answers -> tts for language-tool
// queries ("what does X mean", "what form is X", ...). This is the
// TTS_TV_Hands_Free_Voice_Layer.md "intent router" + "context resolver" in
// one small module.
//
// Fully testable without a browser or reader/: give createVoiceUI() a fake
// bridge (voiceui/reader-bridge.js's REQUIRED_METHODS shape), a fake synth
// (tts.createFakeSynth()), and plain-object sentence/dictionary lookups
// backed by real book.json/dictionary.json fixtures read with `fs`.
//
// boot() (bottom of this file) is the one entry point reader.html calls:
// it wires window.ReaderControl -> reader-bridge -> createVoiceUI, the
// Media Session double-tap trigger, Web Speech in/out, and paints a small
// on/off pill so a person can see whether the mic layer is armed. It lives
// here rather than in a tenth file because a new <script src> would also
// need a reader/sw.js precache entry and an export_bundle.py copy -- three
// reader/ edits where the prompt permits one line. boot() reads
// VoiceUI.trigger/.asr/.readerBridge lazily, at call time, so the factory
// signature and the <script> order in voiceui/README.md are unchanged.
//
// UMD: module.exports under Node (requires its sibling voiceui/*.js files
// directly), or window.VoiceUI.app in the browser via a plain <script> tag
// loaded AFTER grammar.js/detour.js/resolve.js/answers.js/tts.js have each
// attached themselves to window.VoiceUI -- see grammar.js's file header for
// why there's no ES modules/bundler, and voiceui/README.md "Loading in the
// browser" for the required <script> order.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./grammar"),
      require("./detour"),
      require("./resolve"),
      require("./answers"),
      require("./tts")
    );
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.app = factory(
      root.VoiceUI.grammar,
      root.VoiceUI.detour,
      root.VoiceUI.resolve,
      root.VoiceUI.answers,
      root.VoiceUI.tts
    );
    // The one name reader.html calls: `VoiceUI.boot()` (PROMPTS/voiceui.md step 1).
    root.VoiceUI.boot = root.VoiceUI.app.boot;
  }
})(typeof self !== "undefined" ? self : this, function (grammar, detourModule, resolve, answers, tts) {
  "use strict";
  const { DetourStack } = detourModule;

// "what does X mean" / "what form is X" / "why is this dative" / "what's
// the conjugation here" -- voiceui/README.md "Language tools by voice".
// A null `word` means the query didn't name one; app.js falls back to
// whatever word the reader currently has highlighted (bridge.getPosition's
// wordId), per TTS_TV_Hands_Free_Voice_Layer.md's context-resolver idea:
// "the system should infer the relevant context automatically."
// Order matters: "what does this mean" must be checked before the general
// "what does X mean" pattern, or (.+) greedily captures "this" as if it were
// a named word instead of the no-word-named case.
const LOOKUP_PATTERNS = [
  { re: /^what does this mean$/, word: () => null },
  { re: /^what does (.+) mean$/, word: (m) => m[1] },
  { re: /^what form is (.+)$/, word: (m) => m[1] },
  { re: /^why is this (.+)$/, word: () => null },
  { re: /^what'?s the conjugation( here)?$/, word: () => null },
];

function parseLookupQuery(text) {
  const t = text.toLowerCase().trim().replace(/[.?!]+$/, "");
  for (const { re, word } of LOOKUP_PATTERNS) {
    const m = t.match(re);
    if (m) return { word: word(m) };
  }
  return null;
}

// ---------------------------------------------------------------- the ring
// QUIET.md, 13 Sep: the same brain, a second input and a second output. A
// quiet question enters at exactly the point a heard utterance does --
// handleUtterance -- and the only new thing is that the answer is WRITTEN
// instead of spoken. So there is no second grammar and no second command
// set here: the ring is a MAP FROM A DIRECTION TO AN UTTERANCE, and
// grammar.js/detour.js/resolve.js/answers.js are byte-unchanged.
//
// Four positions, two faces; the second face exists only while a ground
// stop is standing (detour.inDetour), and asking and coming back are both a
// flick to the RIGHT:
//
//        reading                     stopped in the ground (L1)
//           ^  what                       ^  finish sentence
//    again  <   >  ground      from start <   >  continue  (target 1)
//           v  again, slower                v  continue from end
//
// THE ONE THING THE PAGE LEFT TO THE BUILD, AND WHAT IT IS (13 Sep). `what`
// is on the ring under two readings: the grammar's `what` (the ground pane
// replays the aligned sentence ALOUD and comes straight back -- what silence
// in the listening window has always meant) and the lookup of the word you
// are on. §1 of QUIET.md splits the two itself -- questions "produce an
// answer OR a re-hearing" -- and the gate Osca wrote is "read in the
// one-word view, flick for 'what', THE ANSWER APPEARS SILENTLY". An answer
// can only appear if a lookup ran, so `^` on the reading face is the lookup,
// spelled as the utterance `what does this mean` (parseLookupQuery's
// no-word-named case, the word the reader is on). `ground` and `again` stay
// the re-hearings they are and still play the book aloud -- quiet is about
// the APP not talking, never about the book going silent.
//
// Nothing else joins the ring. The controls -- play/pause/faster/slower/
// normal/back N/start at -- each have a press already (QUIET.md §1), and a
// second worse copy of the transport is not a feature.
const QUIET_RING = {
  reading: { up: "what does this mean", right: "ground", left: "again", down: "again, slower" },
  ground: { up: "finish sentence", right: "continue", left: "continue from start", down: "continue from end" },
  // THE BOOK'S FACE (chat 106, 14 Sep -- "every command here must also be a
  // press"). The assistant's four questions of the book, reached by pressing
  // the TRIGGER a second time while the window is open (M M on the Mac, a
  // two-finger TAP on the phone -- a tap, which the flick lifted-without-
  // moving used to throw away). `define` is not here because it already is:
  // the reading face's own ^. `slower` is not here because it has a press
  // (the pace button on both bars). The face lasts one press or one window.
  book: { up: "grammar", right: "switch", left: "about", down: "where" },
};

const QUIET_DIRECTIONS = ["up", "down", "left", "right"];

// Which face the ring is showing. A ground stop is standing exactly when the
// detour stack has a frame on it: `ground` pushes one and nothing pops it
// until a `continue` (or `target`); `what`'s one-shot pushes and pops inside
// one utterance, so it never leaves the ring on the second face.
function quietFace(inGround, bookFace) {
  if (bookFace) return "book";
  return inGround ? "ground" : "reading";
}

// direction + face -> the utterance a heard command would have been, or null
function quietCommand(direction, inGround, bookFace) {
  const face = QUIET_RING[quietFace(inGround, bookFace)];
  return (face && face[direction]) || null;
}

// THE MAC: M, THEN AN ARROW (QUIET.md §2). The arrows are taken three times
// over -- prefs/prefs.js's `word`/`line` rows, marginalia.js's Shift+arrow
// highlight run, and book-nav.js's axis keydown, which tests `e.key` and NO
// modifier at all -- so every <modifier>+arrow map is taken before it
// starts. What is free is a BOUNDED CLAIM on the bare arrows inside the
// 2.5 s window `M` already opens. Every modifier disqualifies, Shift
// included: ⇧→ is a mark being extended and must stay one even mid-window.
const ARROW_DIR = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  // the pre-2016 WebKit spellings, which an old WKWebView can still send
  Up: "up", Down: "down", Left: "left", Right: "right",
};
function arrowDirection(e) {
  if (!e || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  return ARROW_DIR[e.key] || null;
}

// THE PHONE: A TWO-FINGER FLICK (QUIET.md §3). One finger is spoken for in
// every direction in one-word view -- sideways is the three positions of
// book-nav.js's swipe, up and down is bumpWord -- and TWO fingers are
// `refusePinch`: taken, preventDefault-ed and thrown away. So this is the
// only free gesture, and it cannot collide, because book-nav.js decides by
// COUNT before axis or timer.
//
// The numbers are book-nav.js's own TOUCH constants, deliberately: a hand
// that has learned one flick should not have to learn a second.
const FLICK = { win: 80, v: 0.3, min: 16 };

// samples: [{t, x, y}] of the two-finger CENTROID, oldest first, the last
// one being the lift. -> "up"|"down"|"left"|"right"|null.
//
// Displacement from the touch-down decides the axis and the direction (>=
// `min` px on that axis); velocity over the last `win` ms decides that it
// was a flick and not a slow drag that happened to end somewhere. A finger
// that travelled fast and then STOPPED before lifting has no velocity, which
// is the property book-nav.js's touchV was written for and the reason the
// window ends at the lift rather than spanning the whole gesture.
function flickDirection(samples, opts) {
  const o = opts || {};
  const win = o.win === undefined ? FLICK.win : o.win;
  const minV = o.v === undefined ? FLICK.v : o.v;
  const minPx = o.min === undefined ? FLICK.min : o.min;
  const S = (Array.isArray(samples) ? samples : []).filter(Boolean);
  if (S.length < 2) return null;
  const first = S[0], last = S[S.length - 1];
  const dx = last.x - first.x, dy = last.y - first.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const travel = horizontal ? Math.abs(dx) : Math.abs(dy);
  if (travel < minPx) return null;
  let old = null;
  for (let i = S.length - 1; i >= 0; i--) {
    if (last.t - S[i].t <= win) old = S[i]; else break;
  }
  if (!old || old === last) return null;
  const dt = last.t - old.t;
  if (dt <= 0) return null;
  const v = Math.abs((horizontal ? last.x - old.x : last.y - old.y) / dt);
  if (v < minV) return null;
  if (horizontal) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";   // a screen's y grows downward
}

// The centroid of every finger currently down -- what a two-finger flick
// travels by, so a hand whose two fingers are not quite parallel still
// flicks in the direction the hand went.
function touchCentroid(touches) {
  const n = touches ? touches.length : 0;
  if (!n) return null;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += touches[i].clientX; y += touches[i].clientY; }
  return { x: x / n, y: y / n };
}

// ------------------------------------------------------------- segments
// Word ids are `<sentence id>.wNNN` (core/schema.py; e.g. c001.p0004.s02.w007),
// so the ordinal of a word within its sentence is readable off the id
// itself. That is what "the word where I said ground" is carried as across
// the two panes: getPosition() returns ids, never times, and REQUIRED_METHODS
// has no seek-to-word, so the ground stop point is expressed as an ordinal
// (proportional to the ground sentence's length when getSentenceWords is
// wired, same-ordinal when it is not -- see groundStopOrdinal).
const WORD_ORDINAL_RE = /\.w(\d+)$/;
function wordOrdinal(wordId) {
  const m = WORD_ORDINAL_RE.exec(wordId || "");
  return m ? parseInt(m[1], 10) : null;
}

// The ground-side word to stop at, given that "ground" was said at word `k`
// (1-based) of a target sentence with `targetWords` words, and the aligned
// ground sentence has `groundWords` words. Same proportional shape as
// reader.html's nearestIndex(): position within the sentence, not a
// word-level alignment (none exists -- align.json is sentence-level).
// With either word list unknown (ReaderControl has no getSentenceWords
// yet, README §6) it falls back to the same ordinal, which is exact when
// both panes show the same book and merely approximate across languages.
function groundStopOrdinal(k, targetWords, groundWords) {
  if (!k || k < 1) return 1;
  const nt = targetWords ? targetWords.length : 0;
  const ng = groundWords ? groundWords.length : 0;
  if (nt > 1 && ng > 1) return 1 + Math.round(((k - 1) * (ng - 1)) / (nt - 1));
  return k;
}

// ------------------------------------------------------ "start at <phrase>"
// The listener says "start at the woods" about something they have just
// heard and half-lost, so the search runs BACKWARDS from the sentence the
// reader is in, over a bounded window of sentences, and takes the LAST
// occurrence at or before where they are. Forward search, and search across
// the whole book, are reader/find.js's job (it has an index; this does not)
// -- see this module's README §6 for the hook that would replace this.
//
// The only seam used is ReaderControl's own: getSentenceWords +
// getPreviousSentenceId to read, seekToWord to move. voiceui never touches
// window.TTSTVFind, which is reader.html's internal door, not a contract.
//
// The fold is reader/find.js's findKey, four lines, duplicated rather than
// imported for the same reason answers.js duplicates resolve.js's: every
// voiceui file is a standalone UMD script and one import would put a
// load-order constraint into reader.html for four lines of regex.
function phraseKey(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
function phraseTokens(phrase) {
  return String(phrase == null ? "" : phrase).split(/\s+/).map(phraseKey).filter(Boolean);
}

// -> {wordId, sentenceId, hops} | null. `hops` is how many sentences back it
// had to look, which is what the pill reports and what a test asserts on.
function findPhraseBackwards(phrase, side, { getSentenceWords, getPreviousSentenceId, sentenceId, maxSentences = 12 } = {}) {
  const tokens = phraseTokens(phrase);
  if (!tokens.length || !sentenceId || typeof getSentenceWords !== "function") return null;
  const prev = typeof getPreviousSentenceId === "function" ? getPreviousSentenceId : () => null;
  let id = sentenceId;
  let hops = 0;
  const seen = new Set();
  while (id && hops <= maxSentences && !seen.has(id)) {
    seen.add(id);
    const words = getSentenceWords(side, id) || [];
    const keys = words.map((w) => phraseKey(w && w.text));
    for (let i = keys.length - tokens.length; i >= 0; i--) {
      let hit = true;
      for (let j = 0; j < tokens.length; j++) if (keys[i + j] !== tokens[j]) { hit = false; break; }
      if (hit) return { wordId: words[i].id, sentenceId: id, hops };
    }
    id = prev(side, id);
    hops++;
  }
  return null;
}

function defaultSchedule(fn) {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(fn);
  return setTimeout(fn, 20);
}
function defaultWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// watchUntil(bridge, side, shouldStop, schedule) -> { done, cancel }
// Polls the pane once per `schedule` tick (a frame in the browser) and
// pauses it the first time shouldStop(position) holds; `done` resolves with
// {reason: "stopped"|"ended"|"cancelled"|"never-started", position}.
// "ended" = the pane paused by itself (segment/chapter end) after we saw it
// play; "never-started" = it never began within maxIdlePolls ticks.
//
// The pause is deliberately not allowed on the very first tick the pane is
// seen playing: ReaderControl.playAlignedSegment resolves its promise on
// "started && paused", where `started` is set by its own per-frame poll --
// pausing before that poll has run once would leave its promise pending
// forever. Waiting one tick after first seeing it play guarantees the
// reader's poll (which runs every frame) has observed the playing state.
function watchUntil(bridge, side, shouldStop, schedule, { maxIdlePolls = 60 } = {}) {
  let cancelled = false;
  let seenPlaying = false;
  let idle = 0;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  function poll() {
    if (cancelled) return resolveDone({ reason: "cancelled", position: null });
    const paused = bridge.isPaused(side);
    if (!paused) {
      const pos = bridge.getPosition(side);
      if (seenPlaying && shouldStop(pos)) {
        bridge.pause(side);
        return resolveDone({ reason: "stopped", position: pos });
      }
      seenPlaying = true;
    } else if (seenPlaying) {
      return resolveDone({ reason: "ended", position: bridge.getPosition(side) });
    } else if (++idle >= maxIdlePolls) {
      return resolveDone({ reason: "never-started", position: null });
    }
    schedule(poll);
  }
  schedule(poll);
  return {
    done,
    cancel() { cancelled = true; },
  };
}

// Drives the reader-bridge for one utterance's ops. `side` starts as
// whichever pane the user is actually listening to ("target" by
// convention -- README: the user is normally listening to L2).
//
// {op:"pane", value:"ground"} pushes the pre-switch position (chapter,
// sentence, exact word) onto `detour` and resolves the aligned sentence on
// the ground side; the {op:"segment", from:"start"} that follows it plays
// that aligned segment via bridge.playAlignedSegment and -- for
// until:"word" -- watches getPosition('ground') each frame and pauses the
// pane when it reaches the stop word. Either way the ground pane is
// stopped when the op completes; nothing here plays the target again
// except an explicit "continue" (resume point of the user's choosing) or
// "what"'s trailing pop.
//
// `ctx.active` is the in-flight segment, so a later utterance can interrupt
// it (createVoiceUI's handleUtterance aborts the previous run first --
// "stop" said over a long ground sentence must stop it, not queue behind
// it). After an abort the remaining ops of the aborted utterance are
// skipped.
//
// Returns { side, stoppedAt, aborted, note }.
async function runOps(ops, ctx) {
  const { bridge, detour } = ctx;
  const schedule = ctx.schedule || defaultSchedule;
  const wait = ctx.wait || defaultWait;
  const getSentenceWords = ctx.getSentenceWords || (() => []);
  let currentSide = ctx.side;
  let entering = null; // {fromSide, sentenceId, wordId, alignedId} set by the last ground pane op
  let stoppedAt = null;
  let note = null;

  // A speed change in an utterance that also switches pane applies to the
  // pane being switched to: "again, slower, ground" is "replay it in L1 at
  // 0.8x", not "make L2 slower for when I come back". Each pane keeps its
  // own rate in the reader, so the two never bleed into each other.
  const paneOp = ops.find((o) => o.op === "pane");
  const speedSide = paneOp ? paneOp.value : currentSide;

  function leaveSide(side) {
    if (side !== "target" && !bridge.isPaused(side)) bridge.pause(side);
  }

  async function playSegment(side, startPlaying, shouldStop, opts) {
    // startPlaying() returns the promise the reader gives us for the
    // segment (playAlignedSegment) or null (plain play); the watcher is
    // what enforces the stop point either way.
    const segment = startPlaying();
    const watcher = shouldStop ? watchUntil(bridge, side, shouldStop, schedule, opts) : null;
    ctx.active = { side, watcher };
    let outcome;
    if (segment && watcher) {
      outcome = await Promise.race([segment.then(() => ({ reason: "segment-ended", position: bridge.getPosition(side) })), watcher.done]);
      watcher.cancel();
      // We paused (or were cancelled) before the reader's own poll saw the
      // end: it resolves on its next frame -- bounded, so a reader whose
      // promise never settles cannot wedge the whole voice layer.
      if (outcome.reason !== "segment-ended") await Promise.race([segment, wait(ctx.settleMs || 300)]);
    } else if (segment) {
      await segment;
      outcome = { reason: "segment-ended", position: bridge.getPosition(side) };
    } else {
      outcome = await watcher.done;
    }
    if (ctx.active && ctx.active.watcher === watcher) ctx.active = null;
    return outcome;
  }

  for (const op of ops) {
    if (ctx.aborted) return { side: currentSide, stoppedAt, aborted: true, note };
    switch (op.op) {
      case "speed": {
        const cur = bridge.getSpeed(speedSide);
        bridge.setSpeed(speedSide, op.set !== undefined ? op.set : cur * op.factor);
        break;
      }
      case "select":
        bridge.seekSentenceDelta(currentSide, 0);
        break;
      case "back":
        if (op.unit === "words") bridge.seekWordDelta(currentSide, -op.amount);
        else bridge.seekSeconds(currentSide, -op.amount);
        break;
      case "startAt": {
        // Seek only -- no implied play, exactly like "back 5 words". A
        // reader that was playing carries on from the new word; a paused
        // one stays paused and "play" starts it. (README, and the same
        // rule the transport ops keep.)
        const pos = bridge.getPosition(currentSide);
        if (!pos) { note = "no position on " + currentSide; break; }
        if (typeof bridge.seekToWord !== "function") { note = "no seekToWord on this ReaderControl"; break; }
        const hit = findPhraseBackwards(op.phrase, currentSide, {
          getSentenceWords,
          getPreviousSentenceId: ctx.getPreviousSentenceId,
          sentenceId: pos.sentenceId,
          maxSentences: ctx.startAtSentences,
        });
        if (!hit) { note = 'no "' + op.phrase + '" in the last ' + ((ctx.startAtSentences === undefined ? 12 : ctx.startAtSentences) + 1) + " sentences"; break; }
        if (!bridge.seekToWord(currentSide, hit.wordId)) { note = "could not seek to " + hit.wordId; break; }
        stoppedAt = bridge.getPosition(currentSide);
        break;
      }
      case "pane": {
        if (op.value === "ground" && currentSide !== "ground") {
          const pos = bridge.getPosition(currentSide);
          if (!pos) {
            // Nothing is loaded/positioned on the target: no frame, no
            // segment -- the segment op that follows will find `entering`
            // unset and do nothing. Never move to ground on a guess.
            note = "no position on " + currentSide;
            break;
          }
          detour.push({ side: currentSide, position: pos });
          const alignedId = bridge.getAlignedSentenceId(currentSide, pos.sentenceId);
          entering = { fromSide: currentSide, sentenceId: pos.sentenceId, wordId: pos.wordId, alignedId };
          currentSide = "ground";
        } else if (op.value === "target" && currentSide !== "target") {
          // Bare "target": just switch. The target pane is already stopped
          // at the word the detour saved (playAlignedSegment paused it and
          // nothing since has moved its clock); the ground pane stops; the
          // detour is over. No play.
          leaveSide(currentSide);
          detour.popToBase();
          currentSide = "target";
        }
        break;
      }
      case "segment": {
        if (op.from === "start") {
          if (!entering) break; // no ground switch preceded it this utterance
          const { fromSide, sentenceId, wordId, alignedId } = entering;
          entering = null;
          let shouldStop = null;
          if (op.until === "word") {
            const k = wordOrdinal(wordId);
            const stop = groundStopOrdinal(
              k,
              getSentenceWords(fromSide, sentenceId),
              alignedId ? getSentenceWords(currentSide, alignedId) : null
            );
            shouldStop = (pos) =>
              !!pos && (!alignedId || pos.sentenceId === alignedId) && (wordOrdinal(pos.wordId) || 0) >= stop;
          }
          // A chapter switch on the ground pane (timings + audio probe)
          // can take a while before it starts playing: allow it ~10 s of
          // idle frames rather than the default 1 s -- the reader's own
          // promise bounds the wait anyway.
          const outcome = await playSegment(currentSide, () => bridge.playAlignedSegment(fromSide, sentenceId), shouldStop, { maxIdlePolls: 600 });
          stoppedAt = outcome.position;
          // Whatever happened, the ground pane is stopped now (segment end,
          // our stop word, or an abort) -- the reader waits.
          if (!bridge.isPaused(currentSide)) bridge.pause(currentSide);
        } else {
          // from:"here" -- "finish sentence": from wherever this pane's
          // clock is to the end of the sentence it is in, then stop.
          const pos = bridge.getPosition(currentSide);
          if (!pos) { note = "no position on " + currentSide; break; }
          const sentenceId = pos.sentenceId;
          const outcome = await playSegment(currentSide, () => { bridge.play(currentSide); return null; }, (p) => !p || p.sentenceId !== sentenceId);
          stoppedAt = outcome.position;
          if (!bridge.isPaused(currentSide)) bridge.pause(currentSide);
        }
        break;
      }
      case "play":
        bridge.play(currentSide);
        break;
      case "pause":
        bridge.pause(currentSide);
        break;
      case "continue": {
        // Back to the main position, then resume from the point chosen:
        //   target_1  the exact word "ground" was said at -- the target's
        //             clock never moved during the detour, so play resumes
        //             there (browser-verified against getPosition, step 2)
        //   ground_1  that sentence's start (seekSentenceDelta 0)
        //   ground_2  that sentence's end = the next sentence's start
        //             (seekSentenceDelta +1; on the chapter's last sentence
        //             the reader clamps to its own start -- README §7)
        leaveSide(currentSide);
        const base = detour.popToBase();
        if (base) currentSide = base.side;
        if (op.resume === "ground_1") bridge.seekSentenceDelta(currentSide, 0);
        else if (op.resume === "ground_2") bridge.seekSentenceDelta(currentSide, 1);
        bridge.play(currentSide);
        break;
      }
      case "pop": {
        // "what"'s one-shot return: one level down, playing from the exact word.
        leaveSide(currentSide);
        const frame = detour.pop();
        if (frame) currentSide = frame.side;
        bridge.play(currentSide);
        break;
      }
      default:
        break;
    }
  }
  return { side: currentSide, stoppedAt, aborted: !!ctx.aborted, note };
}

function createVoiceUI({ bridge, getSentenceWords, getPreviousSentenceId, getDictionaryEntry, synth, schedule, wait, settleMs, dictWaitMs, clarifyRate, startAtSentences, assistant, cursorPosition }) {
  const detour = new DetourStack();
  let side = "target";
  let inflight = null; // { ctx, promise } for the utterance currently executing
  const waitFor = wait || defaultWait;
  // ReaderControl.getDictionaryEntry is synchronous by contract and starts
  // the fetch of books/<slug>/dictionary.json the first time it is asked, so
  // its first answer is ALWAYS null and there is no "loaded" signal to watch
  // (reader/README.md says so in as many words, and leaves the handling
  // here). A page nobody has tapped a word on is exactly the hands-free
  // case, so the first spoken lookup of a session would otherwise always be
  // "No dictionary entry for <word>." -- for a word that is in the file.
  // So: poll for a bounded stretch, but only until the dictionary has
  // answered once. After that a null is a real miss and is answered at once.
  const dictionaryWait = dictWaitMs === undefined ? 3000 : dictWaitMs;
  let dictionaryWarm = false;
  const sayOut = (text) => tts.say(text, { synth, assistant });
  async function lookupEntry(role, surfaceText) {
    let entry = getDictionaryEntry(role, surfaceText);
    if (entry || dictionaryWarm || dictionaryWait <= 0) {
      if (entry) dictionaryWarm = true;
      return entry;
    }
    const step = Math.max(50, Math.min(150, Math.round(dictionaryWait / 20)));
    for (let waited = 0; waited < dictionaryWait; waited += step) {
      await waitFor(step);
      entry = getDictionaryEntry(role, surfaceText);
      if (entry) { dictionaryWarm = true; return entry; }
    }
    return null;
  }

  // "No confident match -> 'which word?' and replay the sentence slowly"
  // (voiceui/README.md, Language tools by voice). The replay is the half
  // that was never built: without it the listener is asked a question with
  // nothing to answer it from, since the sentence they were half-hearing has
  // by then gone past. It is a detour like any other, so the rule holds --
  // the main position is put back exactly where it was, at the same speed,
  // playing or paused as it was found. Needs playRange + seekToWord
  // (reader/ c29d38d); without them the question is still asked and
  // `replayed: false` says why.
  async function clarify(pos, ctx, quiet) {
    const text = "Which word?";
    // PRESSED IS WRITTEN, SPOKEN IS SAID (QUIET.md §5). The input decided the
    // output two frames ago; this is the only place the decision is spent.
    if (!quiet) await sayOut(text);
    const out = { type: "answer", text, clarify: true, replayed: false, quiet: !!quiet };
    if (!pos || !bridge.playRange || !bridge.seekToWord) {
      out.note = "no playRange/seekToWord on this ReaderControl";
      return out;
    }
    const wasPlaying = !bridge.isPaused(side);
    const speed = bridge.getSpeed(side);
    try {
      if (wasPlaying) bridge.pause(side);
      bridge.setSpeed(side, clarifyRate === undefined ? 0.8 : clarifyRate);
      if (ctx) ctx.active = { side, watcher: null };
      const stop = await bridge.playRange(side, { from: "sentenceStart", to: "sentenceEnd" });
      out.replayed = !!stop;
      if (stop && stop.aborted) out.note = "replay interrupted";
    } catch (e) {
      out.note = "replay failed: " + (e && e.message);
    } finally {
      if (ctx) ctx.active = null;
      bridge.setSpeed(side, speed);
      // back to the exact word, whatever the replay did to the clock
      if (!bridge.seekToWord(side, pos.wordId)) out.note = (out.note ? out.note + "; " : "") + "could not seek back to " + pos.wordId;
      if (wasPlaying) bridge.play(side); else if (!bridge.isPaused(side)) bridge.pause(side);
    }
    return out;
  }

  async function answerLookup(query, ctx, quiet) {
    let pos = bridge.getPosition(side);
    // DEFINE WITHOUT PLAYBACK (wave 8, 26 Sep). 37 of 41 books have no
    // audio, so the clock's position is null on most of the shelf -- but
    // the book still has a cursor (K24: the word the reader is on, announced
    // by `ttstv:cursor`). `cursorPosition` is that cursor with its sentence's
    // words already read off the chapter map, so nothing here needs the
    // audio chapter open.
    let atCursor = null;
    if (!pos && typeof cursorPosition === "function") {
      try { atCursor = await cursorPosition(); } catch (e) { atCursor = null; }
      if (atCursor && atCursor.wordId) pos = atCursor;
    }
    if (!pos) return { type: "answer", text: "Nothing is playing yet.", quiet: !!quiet };
    const wordsOf = (id) => {
      if (atCursor && id === atCursor.sentenceId && Array.isArray(atCursor.words)) return atCursor.words;
      if (atCursor && id && id === atCursor.prevId && Array.isArray(atCursor.prevWords)) return atCursor.prevWords;
      return getSentenceWords(side, id) || [];
    };
    const prevOf = (id) => (atCursor && id === atCursor.sentenceId ? atCursor.prevId || null : getPreviousSentenceId(side, id));

    let wordId = pos.wordId;
    let surfaceText = null;

    if (query.word) {
      const current = wordsOf(pos.sentenceId);
      const prevId = prevOf(pos.sentenceId);
      const previous = prevId ? wordsOf(prevId) : [];
      const match = resolve.resolveWord(query.word, current, previous);
      if (!match) return clarify(pos, ctx, quiet);
      wordId = match.id;
      surfaceText = match.text;
    } else {
      const current = wordsOf(pos.sentenceId);
      const w = current.find((x) => x.id === wordId);
      surfaceText = w ? w.text : (atCursor && atCursor.text) || null;
    }

    if (!surfaceText) return clarify(pos, ctx, quiet);

    const entry = await lookupEntry(side, surfaceText);
    const text = answers.formatAnswer(entry, surfaceText);
    if (!quiet) await sayOut(text);
    return { type: "answer", text, wordId, word: surfaceText, quiet: !!quiet, atCursor: !!atCursor };
  }

  // Interrupt whatever segment is still playing from the previous
  // utterance: pause its pane, cancel its watcher, let its runOps unwind
  // (it skips its remaining ops once `aborted` is set) and only then run
  // the new ops from wherever that left `side`.
  async function interrupt() {
    if (!inflight) return;
    const prev = inflight;
    prev.ctx.aborted = true;
    if (prev.ctx.active) {
      const { side: s, watcher } = prev.ctx.active;
      if (watcher) watcher.cancel();
      if (!bridge.isPaused(s)) bridge.pause(s);
    }
    try { await prev.promise; } catch (e) { /* reported by its own caller */ }
  }

  async function handleUtterance(text, opts) {
    // `quiet` is carried as an ARGUMENT the whole way down, never as a flag on
    // the closure: interrupt() awaits the previous run, so a shared flag
    // would be the NEXT utterance's while the PREVIOUS one was still
    // unwinding, and the bug that makes is a phone speaking on a train.
    const quiet = !!(opts && opts.quiet);
    // A quiet question arriving over a spoken answer ends the spoken one in
    // the same frame (QUIET.md §4). Only quiet cancels: a spoken question
    // already interrupts through interrupt() below.
    if (quiet) tts.cancel(synth);
    const query = parseLookupQuery(text);
    if (query) {
      // A question asked over a ground replay stops the replay first, the
      // same as a command does -- otherwise the answer is spoken underneath
      // the narrator, which on AirPods is two voices at once. The lookup
      // then registers itself as the in-flight utterance so its own "which
      // word?" replay can be interrupted in turn.
      await interrupt();
      const lookupCtx = { active: null, aborted: false };
      const run = { ctx: lookupCtx, promise: null };
      run.promise = answerLookup(query, lookupCtx, quiet);
      inflight = run;
      try {
        return await run.promise;
      } finally {
        if (inflight === run) inflight = null;
      }
    }

    const ops = grammar.tokenize(text);
    if (!ops.length) return { type: "unrecognized", text, quiet };

    await interrupt();
    const ctx = { bridge, side, detour, getSentenceWords, getPreviousSentenceId, startAtSentences, schedule, wait, settleMs, active: null, aborted: false };
    const run = { ctx, promise: null };
    run.promise = runOps(ops, ctx);
    inflight = run;
    let result;
    try {
      result = await run.promise;
    } finally {
      if (inflight === run) inflight = null;
    }
    side = result.side;
    return { type: "ops", ops, side, stoppedAt: result.stoppedAt, aborted: result.aborted, note: result.note, interrupted: false, quiet };
  }

  // `inGround` is the ring's face: a ground stop is standing exactly when
  // the detour stack has a frame on it (see quietFace).
  return { handleUtterance, interrupt, _detour: detour, side: () => side, inGround: () => detour.inDetour,
           _dictionaryWarm: () => dictionaryWarm };
}

// ------------------------------------------------------------------ boot
// The bootstrap reader.html calls once (`VoiceUI.boot()`), after
// window.ReaderControl and the nine voiceui scripts exist. Never throws:
// anything missing (ReaderControl, SpeechRecognition, speechSynthesis)
// shows up in the pill's state/title instead of as a page error.
//
// Everything a browser would supply is injectable so the whole thing runs
// under `node --test` with fakes: win (window), doc (document), the
// recogniser factory, the synth, mediaSession, clock/timers, and the three
// sibling modules. The pill is plain DOM built through doc.createElement so
// a ~20-line fake document is enough to test it.
//
// States the pill can show (data-state attribute, also the visible label):
//   off          loaded, not armed -- nothing listens, no handler registered
//   armed        Media Session handler registered; double-tap opens a window
//   listening    the ~2.5 s window is open, recogniser running
//   busy         an utterance is being executed / an answer spoken
//   unavailable  boot could not attach (title says why); click does nothing

// A MIC, NOT A CAPSULE (Osca, 30 Aug: "the voice ICON REALLY doesn't need to
// be its own popup like that, I'd actually prefer a very simple icon, like the
// mac keyboard mic icon").
//
// The label is still in the button -- `toggleBtn.textContent` is unchanged, so
// a screen reader still hears "Voice: armed" and boot.test.js's fake document
// still reads it. It is simply not DRAWN: `font-size: 0` folds the text away
// and the mic arrives as a CSS mask, which is the one way to get a single
// glyph that takes `background-color` and can therefore be recoloured per
// state without four copies of the artwork. Nothing about the DOM changed, so
// nothing that drives this pill had to.
//
// It also stops being a floating dark capsule. On a phone it sits above the
// reader's own bar and on a desktop inside it (reader.html sets
// `--voiceui-pill-bottom`, this module's one documented hook); either way a
// black lozenge in the corner of a near-white page was the loudest thing on
// the screen and it was the quietest control on it.
const MIC_MASK =
  "url(\"data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
  "<path d='M12 3.4a2.9 2.9 0 0 1 2.9 2.9v5.2a2.9 2.9 0 0 1-5.8 0V6.3A2.9 2.9 0 0 1 12 3.4z' fill='black'/>" +
  "<path d='M6.2 11.1a5.8 5.8 0 0 0 11.6 0M12 17v3.4M8.7 20.4h6.6' fill='none' stroke='black'" +
  " stroke-width='1.7' stroke-linecap='round'/></svg>\") center / 21px 21px no-repeat";

// The hold ring around the thumb: four labels, slide to one, lift to fire.
// It is ink and a target for nothing -- `pointer-events:none` throughout, so
// the pointer stream stays the play button's and the ring never eats a move.
const RING_CSS =
  ".voiceui-ring{position:fixed;z-index:9998;width:0;height:0;pointer-events:none;" +
  "font:12px/1 system-ui,sans-serif;opacity:0;transition:opacity .12s ease}" +
  '.voiceui-ring[data-up="1"]{opacity:1}' +
  ".voiceui-ring i{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;" +
  "font-style:normal;padding:5px 9px;border-radius:999px;" +
  "background:var(--control-bg,#eee);color:var(--fg,#222);opacity:.85}" +
  '.voiceui-ring i[data-on="1"]{background:var(--pivot,#c1121f);color:#fff;opacity:1}';

const PILL_CSS =
  ".voiceui-pill{position:fixed;right:10px;bottom:var(--voiceui-pill-bottom, 12px);z-index:9999;" +
  "display:flex;gap:6px;align-items:center;font:12px/1.2 system-ui,sans-serif;color:inherit}" +
  ".voiceui-pill button{font:inherit;border:0;cursor:pointer;background:transparent;color:inherit}" +
  ".voiceui-pill button[disabled]{cursor:default}" +
  ".voiceui-pill .voiceui-toggle{font-size:0;width:34px;height:34px;border-radius:11px;" +
  "background-color:var(--fg-dim,#8a8a8a);-webkit-mask:" + MIC_MASK + ";mask:" + MIC_MASK + "}" +
  ".voiceui-pill .voiceui-toggle:hover{background-color:var(--fg,#222)}" +
  '.voiceui-pill[data-state="armed"] .voiceui-toggle{background-color:#3f8f47}' +
  // listening is the one state that must be unmistakable across the room:
  // the reader's own pivot red, which is the only saturated colour it uses
  '.voiceui-pill[data-state="listening"] .voiceui-toggle{background-color:var(--pivot,#c1121f)}' +
  '.voiceui-pill[data-state="busy"] .voiceui-toggle{background-color:#c9791f}' +
  '.voiceui-pill[data-state="unavailable"] .voiceui-toggle{opacity:.35}' +
  ".voiceui-pill .voiceui-listen{display:none;border-radius:999px;padding:4px 10px;" +
  "background:var(--control-bg,#eee);color:var(--fg,#222)}" +
  '.voiceui-pill[data-state="armed"] .voiceui-listen,.voiceui-pill[data-state="listening"] .voiceui-listen{display:inline-block}' +
  ".voiceui-pill .voiceui-pocket-btn{display:none;border-radius:999px;padding:4px 10px;" +
  "background:var(--control-bg,#eee);color:var(--fg,#222)}" +
  '.voiceui-pill[data-state="armed"] .voiceui-pocket-btn,.voiceui-pill[data-state="listening"] .voiceui-pocket-btn{display:inline-block}' +
  ".voiceui-pill .voiceui-last{max-width:32vw;overflow:hidden;text-overflow:ellipsis;" +
  "white-space:nowrap;opacity:.75;color:var(--fg-dim,#777)}";

// ------------------------------------------------------- the quiet OUTPUT
// QUIET.md §4: the answer goes to a voiceui-owned line at `.wordsub`'s own
// rect -- the caption's four custom properties, read off the same page, so
// at position +2 it lands exactly where the caption was and at every other
// position it is the only thing there (outside one-word view there IS no
// caption, and a quiet answer still needs somewhere to go).
//
// ONE ELEMENT, EVERY POSITION, ONE RECT -- and the caption is suppressed for
// its duration rather than drawn under it, because two texts at one rect is
// unreadable. That suppression is the one declaration in this module that
// names a `reader/` class; it is CSS, not a call, it is scoped to an
// attribute only this module ever sets, and `reader/` is asked in the module
// README §6 for a `--sub-hide` door so it can stop being a foreign selector.
const PROPOSAL_CSS =
  ".voiceui-proposal{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;max-width:46ch;" +
  "font:11px/1.3 system-ui,sans-serif;opacity:.85}" +
  ".voiceui-proposal[hidden]{display:none}" +
  ".voiceui-proposal .voiceui-proposal-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:30ch}" +
  ".voiceui-proposal button{font:inherit;border:0;cursor:pointer;background:transparent;color:inherit;" +
  "text-decoration:underline;text-underline-offset:2px;padding:0}" +
  ".voiceui-proposal .voiceui-proposal-why{display:none;flex-basis:100%;margin:0;white-space:pre-wrap;font:inherit;opacity:.8}" +
  ".voiceui-proposal.open .voiceui-proposal-why{display:block}";
const SAY_CSS =
  ".voiceui-say{position:fixed;left:50%;transform:translateX(-50%);" +
  "bottom:var(--sub-bottom, 4.5vh);width:min(var(--sub-w, 104ch), 92vw);" +
  "z-index:13;pointer-events:none;text-align:center;" +
  "font-family:var(--serif);font-size:var(--sub-size, 13px);line-height:1.5;" +
  "letter-spacing:-.01em;color:var(--ink, inherit);" +
  "opacity:0;transition:opacity .16s ease;" +
  "display:-webkit-box;-webkit-box-orient:vertical;" +
  "-webkit-line-clamp:var(--voiceui-say-lines, 1);overflow:hidden;" +
  "white-space:normal;text-overflow:ellipsis}" +
  '.voiceui-say[data-up="1"]{opacity:1}' +
  'body[data-voiceui-say="1"] .wordsub{opacity:0}';

// A ONE-SENTENCE ANSWER IS ONE LINE; TWO WHEN THE SENSE NEEDS IT, NEVER
// THREE. The box is min(104ch, 92vw) and `--sub-lines` exists precisely so
// this is one declaration -- ours is `--voiceui-say-lines`, a sibling
// element's own variable, so the caption's is never written to.
const SAY_ONE_LINE_CHARS = 104;
function sayLines(text) {
  return String(text || "").length > SAY_ONE_LINE_CHARS ? 2 : 1;
}

// HOW LONG IT STAYS: a reading speed, not a fixed timer (QUIET.md §4) --
// 1 s per six words, floor 3 s, ceiling 9 s. "broad is 'wide'" and a thirty-
// word Wiktionary sense are not the same thing to read.
function sayHoldMs(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.min(9000, Math.max(3000, Math.ceil(words / 6) * 1000));
}

// While the reader is STOPPED the line never sleeps: a ground stop is a stop
// to think, and an answer that vanishes while you are thinking is the
// caption's own bug in a new coat. So the hold expiring asks the reader
// whether it is playing, and if it is not, waits and asks again.
const SAY_RECHECK_MS = 250;

function createSayLine({ doc, noStyle, setTimeoutFn, clearTimeoutFn, isPaused, holdMs, recheckMs } = {}) {
  const setT = setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
  const clearT = clearTimeoutFn || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
  const recheck = recheckMs === undefined ? SAY_RECHECK_MS : recheckMs;
  let el = null, timer = null, up = "";

  if (doc && typeof doc.createElement === "function") {
    if (!noStyle) {
      const style = doc.createElement("style");
      style.textContent = SAY_CSS;
      (doc.head || doc.body).appendChild(style);
    }
    el = doc.createElement("div");
    el.className = "voiceui-say";
    // it is read out by a screen reader because it is the ANSWER; the pill's
    // own readout stays a log and is not announced.
    el.setAttribute("aria-live", "polite");
    doc.body.appendChild(el);
  }

  function stopTimer() {
    if (timer !== null && clearT) clearT(timer);
    timer = null;
  }
  function arm(ms) {
    stopTimer();
    if (setT) timer = setT(tick, ms);
  }
  function tick() {
    timer = null;
    let paused = false;
    try { paused = !!(isPaused && isPaused()); } catch (e) { paused = false; }
    if (paused) { arm(recheck); return; }
    clear();
  }
  function show(text) {
    const t = String(text == null ? "" : text);
    if (!t) return clear();
    up = t;
    if (el) {
      el.textContent = t;
      if (el.style && typeof el.style.setProperty === "function") {
        el.style.setProperty("--voiceui-say-lines", String(sayLines(t)));
      }
      el.setAttribute("data-up", "1");
    }
    if (doc && doc.body && typeof doc.body.setAttribute === "function") {
      doc.body.setAttribute("data-voiceui-say", "1");
    }
    arm(holdMs === undefined ? sayHoldMs(t) : holdMs);
    return t;
  }
  function clear() {
    stopTimer();
    up = "";
    if (el) { el.textContent = ""; el.setAttribute("data-up", "0"); }
    if (doc && doc.body && typeof doc.body.removeAttribute === "function") {
      doc.body.removeAttribute("data-voiceui-say");
    }
    return "";
  }
  function destroy() {
    clear();
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }
  return { show, clear, destroy, text: () => up, isUp: () => !!up, _el: () => el, lines: () => sayLines(up) };
}

// What a quiet command puts on the line. An ANSWER is its own text. A
// re-hearing (`ground`, `again`, `again, slower`, `finish sentence`) is the
// ring's own word, so a press in a pocket is still visibly a press. A
// `continue` is the way back to the book and clears the line at once
// (QUIET.md §4) -- writing "continue" there would leave the answer's
// replacement standing over the caption you just went back to reading.
function quietLine(result, command) {
  if (!result) return null;
  if (result.type === "answer") return result.text;
  if (result.type === "ops") {
    if (result.ops.some((o) => o.op === "continue" || o.op === "pop")) return null;
    return command;
  }
  return command;
}

// One short phrase for the pill's readout after a playback utterance:
// which ops ran, on which pane it ended, and where a ground stop landed.
function describeOps(result) {
  const names = result.ops.map((o) => (o.op === "segment" ? "segment " + o.from + "→" + o.until : o.op === "continue" ? "continue " + o.resume : o.op === "pane" ? "pane " + o.value : o.op));
  let s = names.join(", ") + " · on " + result.side;
  if (result.stoppedAt && result.stoppedAt.wordId) s += " · stopped at " + result.stoppedAt.wordId;
  if (result.aborted) s += " · interrupted";
  if (result.note) s += " · " + result.note;
  return s;
}

const STATE_LABEL = {
  off: "Voice: off",
  armed: "Voice: armed",
  listening: "Listening…",
  busy: "Voice: working…",
  unavailable: "Voice: unavailable",
};

// The three data hooks app.js's createVoiceUI needs beyond REQUIRED_METHODS.
// Not in reader-bridge.js's contract yet -- requested from reader/ in this
// module's README §6. Until they exist, spoken dictionary answers degrade
// to one sentence saying so; playback commands are unaffected.
const OPTIONAL_DATA_HOOKS = ["getSentenceWords", "getPreviousSentenceId", "getDictionaryEntry"];

// ---------------------------------------------------------------- pocket
// PROMPTS/voiceui.md step 4. The phone goes in a pocket with the screen
// still on -- that is the whole trick, because a web page cannot hear a
// microphone from a locked phone (Safari suspends JS and the mic) and this
// layer is a web page. So: paint the screen black, swallow every touch the
// fabric makes, and hold a screen wake lock so the phone does not sleep and
// drop the page. iOS Guided Access (triple-click the side button) pins the
// tab on top of that, which is what stops a stray press reaching the home
// bar; voiceui/README.md documents the setup and PRESS.md is the script.
//
// The way out is a LONG PRESS on the bottom-left corner, not a tap: a tap is
// what a pocket does by accident, a 1.2 s hold on one named corner is not.
//
// Everything a browser supplies is injected (doc, win, timers, the wake lock
// API) so the whole thing runs under node --test against the same ~20-line
// fake document boot.test.js already has. It uses CLASSES and no inline
// styles for exactly that reason -- the fake elements have no `style`.
const POCKET_CSS =
  ".voiceui-pocket{position:fixed;inset:0;width:100%;height:100%;z-index:2147483000;" +
  "background:#000;touch-action:none;-webkit-user-select:none;user-select:none;" +
  "-webkit-tap-highlight-color:transparent;overscroll-behavior:none;" +
  "display:flex;align-items:flex-end;justify-content:center}" +
  // Dim enough to be invisible in daylight through denim and readable at
  // 3am when you are wondering whether the thing is still running.
  ".voiceui-pocket .voiceui-pocket-hint{color:#242424;font:12px/1.4 system-ui,sans-serif;" +
  "padding:0 0 30px;pointer-events:none;text-align:center}" +
  ".voiceui-pocket .voiceui-pocket-corner{position:absolute;left:0;bottom:0;" +
  "width:24vmin;height:24vmin;min-width:96px;min-height:96px;background:transparent}";

function createPocket({
  doc,
  win,
  holdMs = 1200,
  noStyle = false,
  setTimeoutFn,
  clearTimeoutFn,
  onEnter = () => {},
  onExit = () => {},
  log = () => {},
} = {}) {
  const setT = setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
  const clearT = clearTimeoutFn || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
  let on = false;
  let overlay = null, corner = null, hint = null;
  let sentinel = null;
  let wake = "none";          // none | held | released | unsupported | failed
  let holdTimer = null;
  let swallowed = 0;
  let styled = false;

  const canDom = !!(doc && typeof doc.createElement === "function" && doc.body);

  function swallow(e) {
    // The corner is the one live thing on this screen; everything else the
    // fabric does is not a gesture.
    if (e && e.target === corner) return;
    swallowed++;
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  }
  function startHold() {
    if (holdTimer !== null && clearT) clearT(holdTimer);
    holdTimer = setT ? setT(() => { holdTimer = null; exit("long-press"); }, holdMs) : null;
  }
  function cancelHold() {
    if (holdTimer !== null && clearT) clearT(holdTimer);
    holdTimer = null;
  }

  function build() {
    if (overlay || !canDom) return;
    if (!noStyle && !styled) {
      const style = doc.createElement("style");
      style.textContent = POCKET_CSS;
      (doc.head || doc.body).appendChild(style);
      styled = true;
    }
    overlay = doc.createElement("div");
    overlay.className = "voiceui-pocket";
    overlay.setAttribute("role", "presentation");
    overlay.setAttribute("aria-label", "Pocket mode — hold the bottom-left corner to come back");
    hint = doc.createElement("div");
    hint.className = "voiceui-pocket-hint";
    hint.textContent = "hold the bottom-left corner to come back";
    corner = doc.createElement("div");
    corner.className = "voiceui-pocket-corner";
    corner.setAttribute("aria-label", "Hold to leave pocket mode");
    overlay.appendChild(hint);
    overlay.appendChild(corner);
    for (const ev of ["touchstart", "touchmove", "touchend", "touchcancel", "click", "dblclick", "contextmenu", "wheel", "gesturestart"]) {
      overlay.addEventListener(ev, swallow, { passive: false });
    }
    for (const ev of ["pointerdown", "touchstart", "mousedown"]) corner.addEventListener(ev, startHold);
    for (const ev of ["pointerup", "pointercancel", "pointerleave", "touchend", "touchcancel", "mouseup", "mouseleave"]) {
      corner.addEventListener(ev, cancelHold);
    }
  }

  // A screen wake lock is released by the browser whenever the page is
  // hidden, and iOS hides a page for every notification banner -- so
  // re-taking it on visibilitychange is not belt and braces, it is the
  // normal path back.
  function onVisible() {
    if (!on) return;
    const hidden = doc && doc.visibilityState ? doc.visibilityState !== "visible" : false;
    if (!hidden && wake !== "held") requestWake();
  }

  function requestWake() {
    const nav = win && win.navigator;
    if (!nav || !nav.wakeLock || typeof nav.wakeLock.request !== "function") { wake = "unsupported"; return Promise.resolve(wake); }
    return Promise.resolve()
      .then(() => nav.wakeLock.request("screen"))
      .then((s) => {
        sentinel = s;
        wake = "held";
        if (s && typeof s.addEventListener === "function") {
          s.addEventListener("release", () => { if (sentinel === s) { wake = "released"; sentinel = null; } });
        }
        return wake;
      })
      .catch((e) => { wake = "failed"; log("pocket: wake lock refused --", (e && e.message) || e); return wake; });
  }

  function releaseWake() {
    const s = sentinel;
    sentinel = null;
    if (wake === "held") wake = "released";
    if (s && typeof s.release === "function") { try { s.release(); } catch (e) { /* already gone */ } }
  }

  function enter() {
    if (on) return { on, wake, promise: Promise.resolve(wake) };
    build();
    if (overlay && doc.body) doc.body.appendChild(overlay);
    if (doc && typeof doc.addEventListener === "function") doc.addEventListener("visibilitychange", onVisible);
    on = true;
    const promise = requestWake();
    log("pocket: on");
    try { onEnter(); } catch (e) { log("pocket: onEnter threw", e); }
    return { on, wake, promise };
  }

  function exit(reason = "api") {
    if (!on) return { on, wake };
    cancelHold();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (doc && typeof doc.removeEventListener === "function") doc.removeEventListener("visibilitychange", onVisible);
    releaseWake();
    on = false;
    log("pocket: off (" + reason + ")");
    try { onExit(reason); } catch (e) { log("pocket: onExit threw", e); }
    return { on, wake, reason };
  }

  return {
    enter,
    exit,
    toggle: () => (on ? exit("toggle") : enter()),
    isOn: () => on,
    state: () => ({ on, wake, holdMs, swallowed, inDom: !!(overlay && overlay.parentNode) }),
    // tests and the browser driver drive the corner through these rather
    // than synthesising a pointer event on a node they do not own
    _corner: () => corner,
    _overlay: () => overlay,
    _startHold: startHold,
    _cancelHold: cancelHold,
    _swallow: swallow,
  };
}

function boot(opts = {}) {
  const win = opts.win || (typeof window !== "undefined" ? window : undefined);
  const doc = opts.doc || (win && win.document);
  const root = win && (win.VoiceUI = win.VoiceUI || {});
  if (root && root.instance && !opts.force) return root.instance; // once per page

  const mods = Object.assign(
    {
      trigger: root && root.trigger,
      asr: root && root.asr,
      sttNative: root && root.sttNative,   // stt-native.js, when the page loaded it
      readerBridge: root && root.readerBridge,
    },
    opts.modules || {}
  );
  mods.commands = mods.commands || (root && root.commands);
  mods.records = mods.records || (root && root.records);
  mods.context = mods.context || (root && root.context);
  if (typeof module === "object" && module.exports) {
    mods.trigger = mods.trigger || require("./trigger");
    mods.asr = mods.asr || require("./asr");
    mods.sttNative = mods.sttNative || require("./stt-native");
    mods.readerBridge = mods.readerBridge || require("./reader-bridge");
    mods.commands = mods.commands || require("./commands");
    mods.records = mods.records || require("./records");
    mods.context = mods.context || require("./context");
  }

  const log = opts.log || ((...a) => { if (typeof console !== "undefined") console.info("[voiceui]", ...a); });

  /* ===================== THE ONE STORE (Settings > General > Voice, 5 Sep)
   * Osca, 5 Sep 21:15: *"we need to add mic settings and the touch-off
   * toggle."* Three of the four rows that landed are read HERE, and read
   * from `TTSTVSettings` -- never from the settings page's DOM, which is in
   * another window on the Mac and does not exist at all on the phone.
   *
   * `prefs/prefs.js` owns the values, this asks for them, and it asks at the
   * moment each one is used rather than at boot: a window length changed
   * while the reader is open applies to the NEXT window, and touch off
   * applies the moment it is switched, because the store is subscribed to.
   *
   * With no store on the page (a bare `file://` bundle, a test) every one of
   * these falls back to exactly what this file did before the rows existed --
   * a 2.5 s window, no pocket mode until something asks for it -- so nothing
   * here depends on prefs/ being loaded. */
  const store = opts.settings !== undefined ? opts.settings : (win && win.TTSTVSettings) || null;
  const prefsNow = () => {
    try { return store && typeof store.read === "function" ? store.read() : null; } catch (e) { return null; }
  };
  function listenWindowMs() {
    if (opts.listenWindowMs !== undefined) return opts.listenWindowMs;
    try {
      if (store && typeof store.listenMs === "function") return store.listenMs();
    } catch (e) { /* an older prefs/ */ }
    return 2500;
  }

  const synth = opts.synth || (win && win.speechSynthesis) || null;
  const mediaSession = opts.mediaSession !== undefined ? opts.mediaSession : (win && win.navigator && win.navigator.mediaSession) || null;
  const Recognition = win && (win.SpeechRecognition || win.webkitSpeechRecognition);
  const recognizerFactory =
    opts.recognizerFactory ||
    (Recognition
      ? () => {
          const r = new Recognition();
          r.continuous = false;
          r.interimResults = false;
          r.maxAlternatives = 1;
          if (opts.lang) r.lang = opts.lang;
          return r;
        }
      : null);

  /* THE NATIVE DOOR FIRST (D-hands, 26 Sep). Inside Frank `window.__TAURI__`
   * is on the page and stt.rs's four commands stand behind it -- Apple's
   * on-device recogniser, no network, the shape that works in a tunnel.
   * `voiceui/stt-native.js` has `asr.createSpeechInput`'s shape, so the only
   * question at window-open is which one to build; Web Speech stays the
   * fallback on every page without the bridge (Safari, the phone bundle, a
   * bench). `opts.native: false` turns the door off (tests use it to pin the
   * Web Speech road); `opts.native` with the module's shape substitutes a
   * fake. Its `authorized` is read once, on the first arm (`nativeReady`):
   * 0 = notDetermined is the ONE time macOS shows its Speech Recognition
   * dialog, and stt_start refuses until it is answered. */
  const native = opts.native === false ? null
    : (opts.native && typeof opts.native === "object") ? opts.native
    : (mods.sttNative && typeof mods.sttNative.hasTauri === "function" && mods.sttNative.hasTauri(win) ? mods.sttNative : null);
  let nativeInfo = null;      // the last stt_check answer, for state()/the pill tooltip
  let nativeAsked = false;    // authorize() pressed this page
  async function nativeReady() {
    if (!native) return null;
    try {
      nativeInfo = await native.check(win);
      if (nativeInfo && nativeInfo.authorized === 0 && !nativeAsked) {
        nativeAsked = true;
        showLast("macOS is asking for Speech Recognition -- answer the dialog once");
        nativeInfo = (await native.authorize(win)) || nativeInfo;
      }
      if (nativeInfo && nativeInfo.available === false) log("native recogniser unavailable:", nativeInfo);
      if (nativeInfo && nativeInfo.authorized === 1) showLast("Speech Recognition denied -- System Settings > Privacy & Security > Speech Recognition");
    } catch (e) { log("stt_check failed:", e); }
    return nativeInfo;
  }
  // One door for the window: the native recogniser when Frank offers it,
  // Web Speech otherwise. Both answer { start, stop }.
  function openSpeechInput(handlers) {
    if (native) return native.createNativeSpeechInput(Object.assign({ win }, handlers));
    recognizer = recognizerFactory();
    return mods.asr.createSpeechInput(Object.assign({ recognizer }, handlers));
  }

  // ---- pill (the visible on/off affordance)
  let pill = null, toggleBtn = null, listenBtn = null, pocketBtn = null, lastEl = null;
  if (doc && typeof doc.createElement === "function") {
    if (!opts.noStyle) {
      const style = doc.createElement("style");
      style.textContent = PILL_CSS + PROPOSAL_CSS;
      (doc.head || doc.body).appendChild(style);
    }
    pill = doc.createElement("div");
    pill.className = "voiceui-pill";
    toggleBtn = doc.createElement("button");
    toggleBtn.className = "voiceui-toggle";
    toggleBtn.type = "button";
    listenBtn = doc.createElement("button");
    listenBtn.className = "voiceui-listen";
    listenBtn.type = "button";
    listenBtn.textContent = "Listen";
    listenBtn.title = "Open the listening window now (same as an AirPods double-tap)";
    pocketBtn = doc.createElement("button");
    pocketBtn.className = "voiceui-pocket-btn";
    pocketBtn.type = "button";
    pocketBtn.textContent = "Pocket";
    pocketBtn.title = "Black the screen and keep listening — hold the bottom-left corner to come back";
    lastEl = doc.createElement("span");
    lastEl.className = "voiceui-last";
    pill.appendChild(toggleBtn);
    pill.appendChild(listenBtn);
    pill.appendChild(pocketBtn);
    pill.appendChild(lastEl);
    doc.body.appendChild(pill);
  }

  let state = "off";
  let note = "";
  function setState(next, why) {
    state = next;
    if (why !== undefined) note = why;
    if (!pill) return;
    pill.setAttribute("data-state", state);
    toggleBtn.textContent = STATE_LABEL[state] || state;
    toggleBtn.title = note || (state === "off" ? "Click to arm the mic layer" : "Click to switch the mic layer off");
    toggleBtn.setAttribute("aria-pressed", String(state === "armed" || state === "listening" || state === "busy"));
    toggleBtn.disabled = state === "unavailable";
  }
  function showLast(text) {
    if (lastEl) lastEl.textContent = text || "";
  }

  // ---- reader bridge
  let bridge = null;
  try {
    bridge = mods.readerBridge.attachToWindow(win);
  } catch (e) {
    setState("unavailable", e.message);
    log("boot: unavailable --", e.message);
    const dead = { ok: false, error: e, state: () => state, arm() {}, disarm() {}, listen() {}, destroy() {}, handleUtterance: async () => ({ type: "unavailable" }) };
    if (root) root.instance = dead;
    return dead;
  }

  const control = win.ReaderControl;
  const missingHooks = OPTIONAL_DATA_HOOKS.filter((n) => typeof control[n] !== "function");
  const hooksReady = missingHooks.length === 0;
  const assistant = opts.assistant !== undefined ? opts.assistant : tts.createAssistant({
    transport: opts.transport !== undefined ? opts.transport : (win && win.Transport) || null,
    bookBase: () => { const s = tts.slugFromLocation(win && win.location); return s ? "../books/" + encodeURIComponent(s) + "/" : null; },
    renderJson: (b) => (win && typeof win.fetch === "function" ? win.fetch(b + "render.json").then((r) => (r.ok ? r.json() : null)) : null),
    manifest: (b) => (win && typeof win.fetch === "function" ? win.fetch(b + tts.manifestUrl("")).then((r) => (r.ok ? r.json() : null)) : null),
    storage: win && win.localStorage, store,
    playFile: win && typeof win.Audio === "function" ? tts.createFilePlayer(win.Audio).playFile : null,
  });
  const app = createVoiceUI({
    bridge,
    synth,
    assistant,
    schedule: opts.schedule,
    wait: opts.wait,
    settleMs: opts.settleMs,
    dictWaitMs: opts.dictWaitMs,
    clarifyRate: opts.clarifyRate,
    getSentenceWords: hooksReady ? (side, id) => control.getSentenceWords(side, id) : () => [],
    getPreviousSentenceId: hooksReady ? (side, id) => control.getPreviousSentenceId(side, id) : () => null,
    getDictionaryEntry: hooksReady ? (side, text) => control.getDictionaryEntry(side, text) : () => null,
    // the cursor, for a lookup with nothing playing (wave 8); the sentence's
    // words come off the chapter map, which needs no audio chapter open
    cursorPosition: async () => {
      const p = await positionNow();
      if (!p || !p.wordId) return null;
      const map = typeof p.chapterIndex === "number" && p.chapterIndex >= 0 ? await chapterMap(p.chapterIndex) : null;
      const sw = map && map.sentWords && typeof map.sentWords.get === "function" ? map.sentWords : null;
      const ids = sw ? [...sw.keys()] : [];
      const i = ids.indexOf(p.sentenceId);
      return { wordId: p.wordId, sentenceId: p.sentenceId, chapterId: p.chapterId, text: p.text || "",
               words: sw ? sw.get(p.sentenceId) || null : null,
               prevId: i > 0 ? ids[i - 1] : null, prevWords: i > 0 && sw ? sw.get(ids[i - 1]) || null : null, atCursor: true };
    },
  });
  if (!hooksReady) log("boot: ReaderControl lacks", missingHooks.join(", "), "-- spoken dictionary answers are off until reader/ adds them");

  // the quiet OUTPUT: one element, the caption's own rect, every position
  const sayLine = createSayLine({
    doc,
    noStyle: opts.noStyle,
    setTimeoutFn: opts.setTimeoutFn,
    clearTimeoutFn: opts.clearTimeoutFn,
    holdMs: opts.sayHoldMs,
    recheckMs: opts.sayRecheckMs,
    // the reader STOPPED is the one state the line must outlive
    isPaused() {
      try { return bridge.isPaused(app.side()); } catch (e) { return false; }
    },
  });

  /* ================= THE ASSISTANT IS THE BOOK SPEAKING BACK (chat 106) ====
   * Six deterministic commands (voiceui/commands.js) and the context packet
   * (voiceui/context.js), fed by the book's own records (voiceui/records.js)
   * and by ONE view of where the reader is -- `positionNow()` -- which is the
   * audio clock when a chapter has timings and book-nav.js's announced
   * cursor (`ttstv:cursor`) when it has not, so a system-voice book answers
   * `grammar` and `where` too. Nothing here reaches into reader.html: the
   * slug comes off the URL and the cursor event, the chapter map off
   * ReaderControl.mapOf, the pace off window.Transport (registered by the
   * page, like the store). */
  const records = opts.records || (mods.records ? mods.records.createRecords({
    slug: opts.slug || (mods.records.slugFromLocation && win && win.location ? mods.records.slugFromLocation(win.location) : null),
    win,
    fetchJson: opts.fetchJson,
    fetchText: opts.fetchText,
  }) : null);
  let lastCursor = null;   // {chapter, word, text, slug} from ttstv:cursor
  function onCursor(e) {
    const d = e && e.detail;
    if (!d) return;
    lastCursor = { chapter: d.chapter | 0, word: d.word | 0, text: d.text || "", slug: d.slug || null };
    if (d.slug && records && records.slugNow() !== d.slug && records.setSlug(d.slug) === d.slug) { refreshLangs(); if (typeof drawProposal === "function") drawProposal().catch(() => null); }
  }
  const cursorTarget = opts.cursorTarget !== undefined ? opts.cursorTarget : doc;
  if (cursorTarget && typeof cursorTarget.addEventListener === "function") cursorTarget.addEventListener("ttstv:cursor", onCursor);
  const transport = opts.transport !== undefined ? opts.transport : (win && win.Transport) || null;
  // the pace door: the ONE stored rate (G-WPM). Transport first (it applies
  // the rate to the master and the store both); the store alone as the
  // fallback; nothing at all -> commands.js answers "no pace to change".
  function paceDoor() {
    if (opts.pace !== undefined) return opts.pace;
    try {
      if (transport && typeof transport.paceNow === "function" && transport.paceNow() > 0) {
        return { now: () => transport.paceNow(), set: (w) => transport.setPace(w), paces: transport.PACES,
                 defaultWpm: store && store.DEFAULTS && store.DEFAULTS.wpm };
      }
      const st = prefsNow();
      if (st && +st.wpm > 0 && store && typeof store.patch === "function") {
        return { now: () => +prefsNow().wpm || 0, set: (w) => { store.patch({ wpm: w }); return +prefsNow().wpm || w; },
                 defaultWpm: store.DEFAULTS && store.DEFAULTS.wpm };
      }
    } catch (e) { /* no pace */ }
    return null;
  }
  function chapterMap(idx) {
    if (control && typeof control.mapOf === "function") {
      try { return Promise.resolve(control.mapOf(idx)).catch(() => null); } catch (e) { return Promise.resolve(null); }
    }
    return Promise.resolve(null);
  }
  function fractionNow() {
    try { if (transport && typeof transport.fraction === "function") { const f = transport.fraction(); if (isFinite(f) && f >= 0) return f; } } catch (e) { /* none */ }
    return null;
  }
  // -> {wordId, sentenceId, chapterId, chapterIndex, chapterCount, chapterTitle, fraction, text, lang} | null
  async function positionNow() {
    if (opts.position) return opts.position();
    const side = app.side();
    let pos = null;
    try { pos = bridge.getPosition(side); } catch (e) { pos = null; }
    let out = null;
    if (pos && pos.wordId) {
      const words = control && typeof control.getSentenceWords === "function" ? control.getSentenceWords(side, pos.sentenceId) : null;
      const w = Array.isArray(words) ? words.find((x) => x.id === pos.wordId) : null;
      out = { wordId: pos.wordId, sentenceId: pos.sentenceId, chapterId: pos.chapterId, text: w ? w.text : "", fraction: fractionNow() };
    } else if (lastCursor) {
      const map = await chapterMap(lastCursor.chapter);
      const wordId = map && map.byFlat && typeof map.byFlat.get === "function" ? map.byFlat.get(lastCursor.word) || null : null;
      out = { wordId, sentenceId: wordId ? wordId.replace(/\.w\d+$/, "") : null, chapterId: map && map.id ? map.id : null,
              chapterIndex: lastCursor.chapter, flat: lastCursor.word, text: lastCursor.text || "", fraction: fractionNow() };
    }
    if (!out || !records) return out;
    try {
      const m = await records.meta();
      const list = (m && Array.isArray(m.chapters)) ? m.chapters : [];
      let i = out.chapterId ? list.findIndex((c) => c && c.id === out.chapterId) : -1;
      if (i < 0 && typeof out.chapterIndex === "number") i = out.chapterIndex;
      out.chapterIndex = i;
      out.chapterCount = list.length;
      out.chapterTitle = i >= 0 && list[i] ? list[i].title : "";
      if (!out.chapterId && i >= 0 && list[i]) out.chapterId = list[i].id;
      if (out.fraction === null && typeof out.flat === "number" && i >= 0 && list[i] && +list[i].words > 0) out.fraction = out.flat / +list[i].words;
      out.lang = await records.langAt(out.wordId);
    } catch (e) { /* the position stands without the meta */ }
    return out;
  }
  // words of a paragraph, in order, off the chapter map (for the switch's
  // proportional word): the map's sentence lists, filtered to the paragraph
  async function paragraphWords(pid) {
    const cid = String(pid).split(".")[0];
    const idx = control && typeof control.chapterIndexOf === "function" ? control.chapterIndexOf(cid) : -1;
    const map = idx >= 0 ? await chapterMap(idx) : null;
    if (!map || !map.sentWords || typeof map.sentWords.forEach !== "function") return null;
    const out = [];
    map.sentWords.forEach((list, sid) => { if (String(sid).startsWith(pid + ".")) for (const w of list) out.push(w); });
    return out.length ? out : null;
  }
  // THE DOOR TO THE OTHER BOOK (wave 8, 26 Sep -- two books, two renders,
  // `switch` between them). commands.js plans the move (pairedBook: the
  // partner off the records, the aligned sentence, its flat word index in the
  // other book); this door makes it, with what the shell already has and
  // nothing new: the other book's OWN reader memory (`wordcursor:<slug>`,
  // K24 -- book-nav.js loadCursor reads it on open), then the host's
  // openReader (a new tab in Frank) or the page's own `#book=` hash (the
  // hashchange opens a book in place). cursor.js coalesces wordcursor writes
  // at a 500 ms floor while paused, so the pane is paused first and the open
  // waits CURSOR_FLUSH_MS -- a tab that loaded before the flush would sit at
  // the book's OLD place. The tab that spoke stays where it was.
  const CURSOR_FLUSH_MS = 600;
  const pairDoor = opts.pair !== undefined ? opts.pair : {
    async open(plan) {
      const L = plan && plan.landing;
      const st = win && win.localStorage;
      if (!L || !st || !plan.other) return false;
      try { bridge.pause(app.side()); } catch (e) { /* no clock */ }
      try { st.setItem("wordcursor:" + plan.other, JSON.stringify({ ch: L.ch, wi: L.wi })); } catch (e) { return false; }
      const sleep = (ms) => new Promise((r) => ((win && win.setTimeout) || setTimeout)(r, ms));
      await sleep(CURSOR_FLUSH_MS);
      const host = win && win.TTSTVHost;
      if (host && typeof host.openReader === "function") { host.openReader(plan.other); return true; }
      if (win && win.location) { win.location.hash = "#book=books/" + encodeURIComponent(plan.other); return true; }
      return false;
    },
  };
  let bookLangsNow = [];
  function refreshLangs() {
    if (!records) return;
    records.bookLangs().then((l) => { bookLangsNow = l || []; }).catch(() => {});
  }
  refreshLangs();
  const history = [];
  function remember(q, a) { history.push({ q, a }); while (history.length > 8) history.shift(); }
  async function runCommand(parsed, text, quietAsked) {
    const pos0 = await positionNow();
    const langs = records ? await records.bookLangs().catch(() => []) : [];
    const askLang = opts.lang || (pos0 && pos0.lang) || null;
    const doors = {
      lang: askLang, bridge, side: app.side(), position: () => Promise.resolve(pos0), records, pace: paceDoor(),
      paragraphWords, bookLangs: langs, pair: pairDoor,
      handleUtterance: (t) => app.handleUtterance(t, { quiet: quietAsked }),
    };
    // a spoken answer over a running ground replay is two voices at once --
    // the same interrupt a lookup takes
    if (!quietAsked && app.interrupt && parsed.cmd !== "switch") await app.interrupt();
    const result = await mods.commands.execute(parsed, doors);
    result.quiet = quietAsked;
    result.command = parsed.cmd;
    if (result.type === "answer" && result.text) {
      remember(text, result.text);
      // PRESSED IS WRITTEN, SPOKEN IS SAID -- the book's voice (chat 103/125)
      if (!quietAsked && synth) await tts.say(result.text, { synth, assistant });
    }
    return result;
  }
  // the packet: what an open question would be answered from
  async function context() {
    const pos = await positionNow();
    const meta = records ? await records.meta().catch(() => null) : null;
    const map = pos && typeof pos.chapterIndex === "number" && pos.chapterIndex >= 0 ? await chapterMap(pos.chapterIndex) : null;
    const ids = map && map.sentWords ? [...map.sentWords.keys()] : [];
    const sentences = {
      words: (id) => (map && map.sentWords ? map.sentWords.get(id) : null) || (control && typeof control.getSentenceWords === "function" ? control.getSentenceWords(app.side(), id) : null),
      prev: (id) => { const i = ids.indexOf(id); return i > 0 ? ids[i - 1] : (control && typeof control.getPreviousSentenceId === "function" ? control.getPreviousSentenceId(app.side(), id) : null); },
      next: (id) => { const i = ids.indexOf(id); return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null; },
    };
    let paired = null;
    if (records && pos && pos.wordId) {
      const st = await records.stitch().catch(() => null);
      if (st && st.paragraphs) {
        const pid = pos.wordId.split(".").slice(0, 2).join(".");
        const row = st.paragraphs[pid];
        const other = row && Array.isArray(row.pair) ? row.pair[0] : null;
        if (other) {
          const words = await paragraphWords(other);
          if (words) paired = { lang: records.langOf(st.paragraphs[other] && st.paragraphs[other].from), text: words.map((w) => w.text).join(" ") };
        }
      }
    }
    const grammarDoor = records ? async (t) => mods.commands.grammarEntry(await records.grammarAt(pos && pos.wordId), t) : null;
    const dictDoor = hooksReady ? (t) => control.getDictionaryEntry(app.side(), t) : null;
    return mods.context.build({
      book: meta ? { slug: records.slugNow(), title: meta.title, author: meta.author, lang: meta.lang, form: meta.form } : null,
      chapter: pos ? { index: pos.chapterIndex, count: pos.chapterCount, title: pos.chapterTitle } : null,
      position: pos, sentences, paired, dictionary: dictDoor, grammar: grammarDoor, history,
    });
  }
  // the open question, as far as this lane goes: the prompt a model would be
  // handed. No model is wired -- Stage 2.2 stops for Osca's pick.
  async function ask(question) {
    const packet = await context();
    return { packet, bytes: mods.context.bytes(packet), prompt: mods.context.render(packet, question, opts.lang) };
  }

  // ---- THE VOICE PROPOSAL, DRAWN (wave 8, 26 Sep). `GET /book?slug=` has
  // served `proposal` since G-VOICEPICK (core/voicepick.propose: narrator,
  // cast, why, refused, uncast, chosen) and no page drew it. It is drawn
  // here, under the pill, because the pill is the one element this module
  // owns on the page: one line -- the narrator the book proposes, or the
  // sentence that refuses one -- with the cast and the reasons in the
  // tooltip and behind a press, and two presses: ACCEPT (the studio's own
  // route, `POST /render {slug, voice, cast}`, the body serve.py names for
  // "accepting a proposal") and USE FOR THE ASSISTANT (tts.useForAssistant).
  // Off a studio origin (file://, a bundle) the fetch fails and nothing is
  // drawn: an absent proposal is an answer, not an error.
  let proposalEl = null, proposalLast = null;
  const fetchBook = opts.fetchBook !== undefined ? opts.fetchBook : (slug) => {
    if (!win || typeof win.fetch !== "function") return Promise.resolve(null);
    return win.fetch("/book?slug=" + encodeURIComponent(slug)).then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
  };
  const postRender = opts.postRender !== undefined ? opts.postRender : (body) => {
    if (!win || typeof win.fetch !== "function") return Promise.resolve(false);
    return win.fetch("/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => !!(r && r.ok)).catch(() => false);
  };
  function proposalLine(p) {
    if (!p) return null;
    const cast = p.cast && typeof p.cast === "object" ? Object.keys(p.cast) : [];
    if (!p.narrator) return { text: "No voice proposed" + (p.refused && p.refused.length ? ": " + p.refused[0] : "."), detail: (p.why || []).join("\n"), cast, accept: false };
    const text = (p.chosen ? "Voice: " : "Proposes: ") + p.narrator + (cast.length ? " · cast " + cast.length : "");
    const detail = cast.map((k) => k + " → " + p.cast[k]).concat(p.uncast && p.uncast.length ? ["(narrator) " + p.uncast.join(", ")] : [], p.why || []).join("\n");
    return { text, detail, cast, accept: !p.chosen };
  }
  function paintProposal(p) {
    proposalLast = p || null;
    if (!proposalEl) return;
    const line = proposalLine(p);
    proposalEl.textContent = "";
    proposalEl.hidden = !line;
    if (!line) return;
    const span = doc.createElement("span");
    span.className = "voiceui-proposal-text";
    span.textContent = line.text;
    span.title = line.detail;
    proposalEl.appendChild(span);
    if (line.detail) {
      const more = doc.createElement("button"); more.type = "button"; more.className = "voiceui-proposal-more"; more.textContent = "why";
      more.title = line.detail;
      more.addEventListener("click", () => { proposalEl.classList.toggle("open"); });
      proposalEl.appendChild(more);
      const pre = doc.createElement("pre"); pre.className = "voiceui-proposal-why"; pre.textContent = line.detail;
      proposalEl.appendChild(pre);
    }
    if (p && p.narrator) {
      const use = doc.createElement("button"); use.type = "button"; use.className = "voiceui-proposal-use"; use.textContent = "Use for the assistant";
      use.addEventListener("click", () => { try { assistant.useForAssistant(p.narrator); } catch (e) { /* no store */ } showLast("assistant → " + p.narrator); });
      proposalEl.appendChild(use);
    }
    if (line.accept) {
      const ok = doc.createElement("button"); ok.type = "button"; ok.className = "voiceui-proposal-accept"; ok.textContent = "Accept";
      ok.addEventListener("click", () => { acceptProposal().then((done) => showLast(done ? "voice → " + p.narrator : "the studio refused the voice")); });
      proposalEl.appendChild(ok);
    }
  }
  async function drawProposal() {
    const slug = records ? records.slugNow() : null;
    if (!slug) { paintProposal(null); return null; }
    const book = await fetchBook(slug);
    const p = book && book.proposal && typeof book.proposal === "object" ? book.proposal : null;
    if (records && records.slugNow() !== slug) return proposalLast;  // the book changed under the fetch
    paintProposal(p);
    return p;
  }
  async function acceptProposal() {
    const p = proposalLast, slug = records ? records.slugNow() : null;
    if (!p || !p.narrator || !slug) return false;
    const ok = await postRender({ slug, voice: p.narrator, cast: p.cast || {} });
    if (ok) await drawProposal();
    return !!ok;
  }
  if (pill && doc) {
    proposalEl = doc.createElement("div");
    proposalEl.className = "voiceui-proposal";
    proposalEl.hidden = true;
    pill.appendChild(proposalEl);
    drawProposal().catch(() => null);
  }

  // ---- one utterance, end to end
  // `opts.quiet` says the command arrived by PRESS -- a key, a flick, the
  // ring, the headset -- and is the whole of what decides the medium of the
  // answer. There is no toggle and nothing is sensed: pressing is already
  // the declaration (QUIET.md §5).
  async function handleUtterance(text, opts) {
    const quietAsked = !!(opts && opts.quiet);
    showLast("“" + text + "”");
    const wasArmed = state !== "off" && state !== "unavailable";
    if (wasArmed) setState("busy");
    let result;
    // THE ASSISTANT'S COMMANDS FIRST (commands.js). `define` is the lookup
    // by another name and is handed on as one; a bare speed word goes to
    // the pace store when the page has one and to the grammar's speed op
    // when it has not (a bare bundle, a test); everything else is answered
    // here from the records. "again, slower" and "what does X mean" never
    // reach this: every phrase set is anchored to the whole utterance.
    const parsed = mods.commands ? mods.commands.parse(text, { bookLangs: bookLangsNow }) : null;
    if (parsed && parsed.cmd === "define") text = "what does this mean";
    const viaCommand = parsed && parsed.cmd !== "define" && !((parsed.cmd === "slower" || parsed.cmd === "faster" || parsed.cmd === "normal") && !paceDoor());
    try {
      if (viaCommand) {
        result = await runCommand(parsed, text, quietAsked);
      } else if (!hooksReady && synth && parseLookupQuery(text)) {
        const msg = "The dictionary isn't connected to the reader yet.";
        if (!quietAsked) await tts.say(msg, { synth, assistant });
        result = { type: "answer", text: msg, unavailable: missingHooks, quiet: quietAsked };
      } else if (!synth && parseLookupQuery(text)) {
        result = { type: "answer", text: "No speechSynthesis in this browser.", unavailable: ["speechSynthesis"], quiet: quietAsked };
      } else {
        result = await app.handleUtterance(text, opts);
      }
    } catch (e) {
      log("utterance failed:", text, e);
      result = { type: "error", text, error: e };
    }
    if (result.type === "answer") showLast("“" + text + "” → " + result.text);
    else if (result.type === "ops") showLast("“" + text + "” → " + describeOps(result));
    else if (result.type === "unrecognized") showLast("“" + text + "” → not a command");
    else if (result.type === "error") showLast("“" + text + "” → error: " + (result.error && result.error.message));
    if (wasArmed && state === "busy") setState("armed");
    // THE SECOND OUTPUT, and it is used whenever the command arrived by press
    const line = quietAsked ? quietLine(result, text) : undefined;
    if (quietAsked) { if (line === null) sayLine.clear(); else sayLine.show(line); }
    log("utterance:", text, quietAsked ? "(quiet) ->" : "->", result.type);
    return result;
  }

  // ---- trigger + speech in
  let speech = null;
  let recognizer = null;
  let heard = false;

  function stopRecognizer() {
    if (speech) {
      try { speech.stop(); } catch (e) { /* already stopped */ }
    }
    speech = null;
    recognizer = null;
  }

  const trigger = mods.trigger.createTrigger({
    mediaSession,
    action: opts.action || "nexttrack",
    now: opts.now,
    setTimeoutFn: opts.setTimeoutFn,
    clearTimeoutFn: opts.clearTimeoutFn,
    doubleTapWindowMs: opts.doubleTapWindowMs,
    // the FUNCTION, not the number: the window is a setting, and a setting
    // changed while the reader is open reaches the next window
    listenWindowMs: listenWindowMs,
    onListenStart() {
      heard = false;
      setState("listening");
      if (!recognizerFactory && !native) {
        showLast("no SpeechRecognition in this browser — window will close as silence");
        return;
      }
      try {
        speech = openSpeechInput({
          onTranscript(text) {
            heard = true;
            trigger.noteUtteranceReceived();
            stopRecognizer();
            handleUtterance(text);
          },
          onEnd() {
            // recogniser gave up before the window closed and said nothing:
            // leave the trigger's silence timer to decide (= plain "what")
          },
          onError(e) {
            const why = (e && (e.error || e.message)) || "speech error";
            log("recogniser error:", why);
            trigger.noteUtteranceReceived(); // an error is not silence; don't fire "what"
            stopRecognizer();
            showLast("mic error: " + why);
            setState("armed");
          },
        });
        speech.start();
      } catch (e) {
        log("could not start recogniser:", e);
        showLast("mic error: " + e.message);
      }
    },
    onSilence() {
      stopRecognizer();
      if (!heard) handleUtterance("what"); // README: silence in the window = plain "What?"
    },
  });

  // ---- the trigger on a machine with no AirPods buttons
  // A Mac has no Media Session double-tap to give: nothing dispatches
  // `nexttrack` unless a headset does. So one key opens the same ~2.5 s
  // window the double-tap opens -- ONE key, `M` for mic (PRESS.md says why
  // that one), bare, no modifier, and only while the mic layer is armed.
  //
  // It asks prefs/ first: if `TTSTVSettings.hotkeyIs(e, "mic")` knows the id
  // it wins, so the day prefs/ grows a remappable Mic row (this module's
  // README §6) a remap takes effect with no change here. Until then the id
  // is unknown, hotkeyIs answers false, and the literal key below is it.
  //
  // reader/keys.js's rule holds: a bare key is not a hotkey while the caret
  // is in a field, and `TTSTVKeys.typing()` is how that is asked.
  const TRIGGER_KEY = String(opts.triggerKey || "m").toLowerCase();
  const keyTarget = opts.keyTarget || doc;
  function typingNow() {
    const K = win && win.TTSTVKeys;
    try { return !!(K && typeof K.typing === "function" && K.typing()); } catch (e) { return false; }
  }
  /* THE ROW EXISTS NOW, AND THAT CHANGES THE FALLBACK (5 Sep). Until tonight
   * `prefs/` had no `mic` row, `hotkeyIs` answered false for an id it did not
   * know, and the literal `m` below was the whole trigger. With the row in
   * place the literal key stops being an answer and becomes a BUG: a person
   * who moves the binding to K and finds M still opening the microphone has
   * been told a lie by the settings window, which is the one thing the row was
   * asked for to prevent. So the literal is the fallback for a page whose
   * store does not know the id -- an old bundle, an export, a page with no
   * `prefs/` at all -- and nothing else. */
  function isTriggerKey(e) {
    if (!e || e.metaKey || e.ctrlKey || e.altKey) return false;
    const st = store;
    if (st && typeof st.hotkeyIs === "function") {
      let known = false;
      try { known = !!(typeof st.hotkeyById === "function" && st.hotkeyById("mic")); } catch (e2) { known = false; }
      try { if (st.hotkeyIs(e, "mic")) return true; } catch (e2) { known = false; }
      if (known) return false;
    }
    return String(e.key || "").toLowerCase() === TRIGGER_KEY;
  }

  // what to CALL that key in the pill's own words -- the cap the store gives
  // it, so a remap renames the hint too
  function triggerWord() {
    try {
      if (store && typeof store.hotkeysNow === "function" && typeof store.keyCap === "function") {
        const c = store.hotkeysNow().mic;
        if (c && c[0]) return store.keyCap(c[0]);
      }
    } catch (e) { /* older prefs */ }
    return TRIGGER_KEY.toUpperCase();
  }
  function onKeyDown(e) {
    if (state === "off" || state === "unavailable") return;
    if (typingNow() || !isTriggerKey(e)) return;
    if (typeof e.preventDefault === "function") e.preventDefault();
    // M while the window is open is the ring's third face (chat 106), not a
    // second microphone: the mic closes and the arrows become the book's
    if (trigger.isListening() || quietWindowOpen()) { flipToBook(); return; }
    listen();
  }

  /* ================= THE SECOND INPUT (QUIET.md, 13 Sep) ==================
   * Four directions, two faces, one command brain. Every route below ends in
   * the SAME call -- `quiet(direction)` -> `handleUtterance(cmd, {quiet:true})`
   * -- so there is exactly one place a quiet question can be produced and
   * exactly one place its medium is decided.
   *
   * It only works while the mic layer is ARMED, the same rule the M key has
   * had since 5 Sep: nobody who has never turned the voice layer on can trip
   * over a flick. */
  function quietReady() {
    return state !== "off" && state !== "unavailable";
  }
  let bookFace = false;   // the ring's third face, for one press or one window
  function quiet(direction) {
    if (!quietReady()) return null;
    const cmd = quietCommand(direction, app.inGround(), bookFace);
    const face = quietFace(app.inGround(), bookFace);
    bookFace = false;
    if (!cmd) return null;
    log("quiet:", direction, "->", cmd, face !== "reading" ? "(" + face + " face)" : "");
    return handleUtterance(cmd, { quiet: true });
  }
  // the second press of the trigger inside the window: the book's face
  function flipToBook() {
    bookFace = true;
    takeWindowForQuiet();
    openQuietWindow();
    if (ring) ringPaint(ring.picked);
    log("quiet: book face");
  }

  /* ---- THE MAC: M, then an arrow, each arrow re-opening the window.
   * The arrows are contested by three separate handlers (prefs' word/line
   * rows, marginalia's Shift+arrow, book-nav's unguarded axis keydown), so
   * the claim is BOUNDED BY A WINDOW that already exists and is given back
   * the moment it closes. Capture phase on the document runs before every
   * one of those, which are target/bubble, and stopImmediatePropagation ends
   * the press there -- no edit outside voiceui/.
   *
   * The window the ARROWS run in is voiceui's OWN, not the trigger's: the
   * first arrow takes the listening window off the recogniser (the mic
   * closes, and no silence-"what" fires) and opens a quiet window of the
   * same length instead. A ring that re-opened the microphone each press
   * would be a quiet interface that keeps switching a microphone on. */
  let quietTimer = null;
  const setT = opts.setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
  const clearT = opts.clearTimeoutFn || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
  function quietWindowOpen() { return quietTimer !== null; }
  function openQuietWindow() {
    if (quietTimer !== null && clearT) clearT(quietTimer);
    quietTimer = setT ? setT(() => { quietTimer = null; bookFace = false; }, listenWindowMs()) : null;
  }
  function closeQuietWindow() {
    if (quietTimer !== null && clearT) clearT(quietTimer);
    quietTimer = null;
    bookFace = false;
  }
  // the first of {an arrow, an utterance} takes the window and closes it to
  // the other -- this is the arrow taking it.
  function takeWindowForQuiet() {
    trigger.noteUtteranceReceived();
    stopRecognizer();
    if (state === "listening") setState("armed");
  }
  function eat(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    else if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  }
  // Escape closes the window and gives the arrows straight back -- the whole
  // stated cost of this map, undone in one press.
  function escapeQuiet() {
    closeQuietWindow();
    takeWindowForQuiet();
    sayLine.clear();
  }
  function onKeyDownQuiet(e) {
    if (!quietReady()) return;
    if (!(trigger.isListening() || quietWindowOpen())) return;
    if (typingNow()) return;
    if (e && e.key === "Escape") { eat(e); escapeQuiet(); return; }
    const dir = arrowDirection(e);
    if (!dir) return;
    eat(e);
    takeWindowForQuiet();
    openQuietWindow();
    quiet(dir);
  }

  /* ---- THE PHONE: a two-finger flick, the same four directions.
   * It cannot collide with the axis: book-nav.js decides by COUNT before
   * axis or timer, and a second finger drops the swipe and is
   * preventDefault-ed by `refusePinch`. Nothing here preventDefaults or
   * stops anything -- the reader has already thrown the gesture away, and
   * this listens to what it threw. The thresholds are book-nav.js's own
   * TOUCH numbers so a hand does not learn two flicks. */
  const touchTarget = opts.touchTarget !== undefined ? opts.touchTarget : win;
  const FLICK_TAP_PX = 12, FLICK_TAP_MS = 350;
  const flickOpts = opts.flick || undefined;
  let two = null;
  function sampleTwo(e) {
    const c = touchCentroid(e.touches);
    if (!c) return null;
    return { t: e.timeStamp === undefined ? Date.now() : e.timeStamp, x: c.x, y: c.y };
  }
  function onTouchStartQuiet(e) {
    if (!quietReady()) return;
    const n = (e.touches && e.touches.length) || 0;
    if (n !== 2) { if (n > 2) two = null; return; }
    const p = sampleTwo(e);
    two = p ? { samples: [p] } : null;
  }
  function onTouchMoveQuiet(e) {
    if (!two) return;
    const n = (e.touches && e.touches.length) || 0;
    if (n !== 2) { two = null; return; }   // a third finger is not this gesture
    const p = sampleTwo(e);
    if (!p) return;
    two.samples.push(p);
    if (two.samples.length > 24) two.samples.shift();
  }
  function onTouchEndQuiet(e) {
    if (!two) return;
    const g = two;
    two = null;                             // a finger has left: the gesture is over
    if (e && e.type === "touchcancel") return;
    const dir = flickDirection(g.samples, flickOpts);
    if (dir) quiet(dir);
    else if (g.samples.length && isTap(g.samples)) flipToBook();   // two fingers down and up, still: the book's face
  }
  function isTap(samples) {
    const a = samples[0], b = samples[samples.length - 1];
    return Math.abs(b.x - a.x) < FLICK_TAP_PX && Math.abs(b.y - a.y) < FLICK_TAP_PX && (b.t - a.t) < FLICK_TAP_MS;
  }

  /* ---- THE HEADSET: the triple-press, and nothing else.
   * A press-and-hold on an AirPod is the system's -- Siri, or noise control
   * -- and iOS never forwards it; the Media Session API has no hold event at
   * all. The one unclaimed headset gesture is the triple-press
   * (`previoustrack`), and the one question worth having with the screen
   * black is the repair: the ring's own DOWN. A four-way ring you cannot
   * see is not a ring, so nothing else goes here. */
  function onTriplePress() { quiet("down"); }
  function attachHeadset(on) {
    if (!mediaSession || typeof mediaSession.setActionHandler !== "function") return;
    try { mediaSession.setActionHandler("previoustrack", on ? onTriplePress : null); } catch (e) { log("previoustrack:", e && e.message); }
  }

  /* ---- THE ON-SCREEN PLAY BUTTON: hold, slide, lift.
   * `#pplaygo` is bound on `click` alone, so a hold is free. It is the
   * SECOND door and not the map, because `.pplay` is hidden in one-word view
   * (shell.css: "HIDDEN WHILE ZOOMED") -- the very view Osca's note was
   * about -- so it is the page-view route and the flick is the phone's.
   * Lift without moving fires nothing, and either way the drag's trailing
   * click is eaten, the trick pbar.js already uses for exactly this. */
  const RING_HOLD_MS = opts.ringHoldMs === undefined ? 400 : opts.ringHoldMs;
  const RING_PICK_PX = opts.ringPickPx === undefined ? 24 : opts.ringPickPx;
  const RING_AT = { up: [0, -54], down: [0, 54], left: [-78, 0], right: [78, 0] };
  let ring = null, ringEl = null, ringLabels = null, ringTimer = null, eatClickUntil = 0;
  function ringBuild() {
    if (ringEl || !doc || typeof doc.createElement !== "function") return;
    if (!opts.noStyle) {
      const st = doc.createElement("style");
      st.textContent = RING_CSS;
      (doc.head || doc.body).appendChild(st);
    }
    ringEl = doc.createElement("div");
    ringEl.className = "voiceui-ring";
    ringLabels = {};
    for (const d of QUIET_DIRECTIONS) {
      const i = doc.createElement("i");
      i.style.left = RING_AT[d][0] + "px";
      i.style.top = RING_AT[d][1] + "px";
      ringLabels[d] = i;
      ringEl.appendChild(i);
    }
    doc.body.appendChild(ringEl);
  }
  function ringPaint(picked) {
    if (!ringEl) return;
    const face = QUIET_RING[quietFace(app.inGround(), bookFace)];
    for (const d of QUIET_DIRECTIONS) {
      ringLabels[d].textContent = face[d];
      ringLabels[d].setAttribute("data-on", picked === d ? "1" : "0");
    }
  }
  function ringOpen(x, y) {
    ringBuild();
    ring = { x, y, picked: null };
    if (ringEl) {
      ringEl.style.left = x + "px";
      ringEl.style.top = y + "px";
      ringEl.setAttribute("data-up", "1");
    }
    ringPaint(null);
  }
  function ringClose() {
    ring = null;
    if (ringEl) ringEl.setAttribute("data-up", "0");
  }
  function ringPick(x, y) {
    if (!ring) return;
    const dx = x - ring.x, dy = y - ring.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const travel = horizontal ? Math.abs(dx) : Math.abs(dy);
    ring.picked = travel < RING_PICK_PX ? null : horizontal ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    ringPaint(ring.picked);
  }
  function onPlayDown(e) {
    if (!quietReady() || ring || ringTimer !== null) return;
    const x = e.clientX, y = e.clientY;
    ringTimer = setT ? setT(() => { ringTimer = null; ringOpen(x, y); }, RING_HOLD_MS) : null;
  }
  function onPlayMove(e) {
    if (ring) ringPick(e.clientX, e.clientY);
  }
  function onPlayUp() {
    if (ringTimer !== null) { if (clearT) clearT(ringTimer); ringTimer = null; return; }  // a tap: the click decides
    if (!ring) return;
    const picked = ring.picked;
    ringClose();
    // the hold's own trailing click is not a tap, whether or not it fired
    eatClickUntil = (opts.now || Date.now)() + 400;
    if (picked) quiet(picked);
  }
  function onClickCapture(e) {
    if (!eatClickUntil || (opts.now || Date.now)() > eatClickUntil) return;
    eatClickUntil = 0;
    eat(e);
  }
  const playEl = opts.playEl !== undefined ? opts.playEl : (doc && typeof doc.querySelector === "function" ? doc.querySelector("#pplaygo") : null);

  function attachQuiet(on) {
    const add = on ? "addEventListener" : "removeEventListener";
    if (keyTarget && typeof keyTarget[add] === "function") keyTarget[add]("keydown", onKeyDownQuiet, true);
    if (touchTarget && typeof touchTarget[add] === "function") {
      touchTarget[add]("touchstart", onTouchStartQuiet, true);
      touchTarget[add]("touchmove", onTouchMoveQuiet, true);
      touchTarget[add]("touchend", onTouchEndQuiet, true);
      touchTarget[add]("touchcancel", onTouchEndQuiet, true);
    }
    if (playEl && typeof playEl[add] === "function") {
      playEl[add]("pointerdown", onPlayDown);
      playEl[add]("pointermove", onPlayMove);
      playEl[add]("pointerup", onPlayUp);
      playEl[add]("pointercancel", onPlayUp);
    }
    if (win && typeof win[add] === "function") win[add]("click", onClickCapture, true);
    attachHeadset(on);
    if (!on) { closeQuietWindow(); ringClose(); two = null; if (ringTimer !== null && clearT) { clearT(ringTimer); ringTimer = null; } }
  }

  // reader/README.md §6 asked voiceui to say when the mic is live -- it is
  // the only way that page learns a microphone is on, and what it decides
  // with it is one thing (the volume control stays on a chapter with no
  // rendered audio, because in chat audio is coming back anyway).
  function tellReader(on) {
    if (control && typeof control.setMicActive === "function") {
      try { control.setMicActive(on); } catch (e) { log("setMicActive threw", e); }
    }
  }

  function arm() {
    if (state === "unavailable" || state !== "off") return;
    trigger.attach();
    if (native) nativeReady();   // the Speech dialog, once, on the first arm -- never at load
    if (keyTarget && typeof keyTarget.addEventListener === "function") keyTarget.addEventListener("keydown", onKeyDown);
    attachQuiet(true);
    tellReader(true);
    setState("armed", mediaSession ? "" : "Armed, but this browser has no Media Session API -- use the Listen button or " + triggerWord());
    log("armed", mediaSession ? "(Media Session double-tap on " + (opts.action || "nexttrack") + ")" : "(no mediaSession; Listen button / " + triggerWord() + " only)");
  }
  function disarm() {
    if (state === "off" || state === "unavailable") return;
    trigger.detach();
    if (keyTarget && typeof keyTarget.removeEventListener === "function") keyTarget.removeEventListener("keydown", onKeyDown);
    attachQuiet(false);
    sayLine.clear();
    stopRecognizer();
    if (pocket && pocket.isOn()) pocket.exit("disarm");
    tellReader(false);
    setState("off", "");
    showLast("");
    log("off");
  }
  function listen() {
    if (state === "off") arm();
    if (state !== "unavailable") trigger.listen();
  }

  // Pocket mode arms the mic on the way in: a black screen with nothing
  // listening is just a black screen.
  /* TOUCH OFF IS A SETTING, AND THE SETTING IS THE TRUTH (5 Sep). The toggle
   * in Settings and the Pocket button on the pill are two doors on one stored
   * value, the same shape light/dark has had since 31 Aug -- so entering by
   * either writes `touchOff: true`, and every way OUT that a person can take
   * writes it back false. Without that, the toggle would sit at "on" over a
   * screen somebody had already held their way out of, which is the one state
   * a setting must never be able to reach.
   *
   * `settings` is the reason used when the STORE is what turned it off, and
   * it writes nothing back -- the value is already false and a second write
   * would be a loop. `destroy` writes nothing either: the page is going away,
   * and a teardown is not a person's decision about tomorrow. */
  const WROTE_BY_HAND = { "long-press": 1, toggle: 1, disarm: 1, api: 1 };
  function setTouchOff(on) {
    if (!store || typeof store.patch !== "function") return;
    try { store.patch({ touchOff: !!on }); } catch (e) { log("touch off: could not store", e); }
  }

  const pocket = createPocket({
    doc, win, log,
    holdMs: opts.pocketHoldMs,
    noStyle: opts.noStyle,
    setTimeoutFn: opts.setTimeoutFn,
    clearTimeoutFn: opts.clearTimeoutFn,
    onEnter() {
      if (state === "off") arm();
      if (pocketBtn) pocketBtn.textContent = "In pocket";
      setTouchOff(true);
    },
    onExit(reason) {
      if (pocketBtn) pocketBtn.textContent = "Pocket";
      if (WROTE_BY_HAND[reason]) setTouchOff(false);
    },
  });

  // the store, followed both ways. The guard is what stops the write in
  // `onEnter`/`onExit` from coming back round through the subscription.
  function applyTouchOff(s) {
    const want = !!(s && s.touchOff);
    if (want === pocket.isOn()) return;
    if (want) pocket.enter(); else pocket.exit("settings");
  }
  let stopPrefs = null;
  if (store && typeof store.subscribe === "function") {
    try { stopPrefs = store.subscribe(applyTouchOff); } catch (e) { stopPrefs = null; }
  }

  if (toggleBtn) toggleBtn.addEventListener("click", () => (state === "off" ? arm() : disarm()));
  if (listenBtn) listenBtn.addEventListener("click", listen);
  if (pocketBtn) pocketBtn.addEventListener("click", () => pocket.toggle());
  setState("off", "");
  if (opts.autoArm) arm();
  // a reader opened with the toggle already on goes straight into a pocket
  applyTouchOff(prefsNow());

  const instance = {
    ok: true,
    arm,
    disarm,
    listen,
    handleUtterance,
    // the second input, one door: a direction, the face the ring is on, and
    // the same command brain a heard utterance goes through
    quiet,
    quietFace: () => quietFace(app.inGround(), bookFace),
    quietRing: () => QUIET_RING[quietFace(app.inGround(), bookFace)],
    bookFace: () => bookFace,
    flipToBook,
    // the assistant (chat 103/106/125): where the reader is, the packet, the prompt
    assistant: () => assistant,
    position: positionNow,
    context,
    ask,
    records,
    // the voice proposal /book serves, drawn under the pill (wave 8)
    proposal: () => proposalLast,
    drawProposal,
    acceptProposal,
    pair: pairDoor,
    history: () => history.slice(),
    quietWindowOpen,
    said: () => sayLine.text(),
    state: () => state,
    // the speech-in road this page will take, and what stt_check last said
    speechIn: () => ({ road: native ? "native" : (recognizerFactory ? "webspeech" : "none"), info: nativeInfo }),
    nativeReady,
    isArmed: () => state !== "off" && state !== "unavailable",
    missingHooks,
    pocket: () => pocket.enter(),
    unpocket: () => pocket.exit("api"),
    pocketState: () => pocket.state(),
    destroy() {
      disarm();
      if (cursorTarget && typeof cursorTarget.removeEventListener === "function") cursorTarget.removeEventListener("ttstv:cursor", onCursor);
      sayLine.destroy();
      if (ringEl && ringEl.parentNode) ringEl.parentNode.removeChild(ringEl);
      if (stopPrefs) { try { stopPrefs(); } catch (e) { /* already gone */ } }
      pocket.exit("destroy");
      if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
      if (root && root.instance === instance) delete root.instance;
    },
    // what the store says right now, and the window length it implies --
    // exposed so a test can prove these come from the store and not from a
    // number written down in this file
    prefs: prefsNow,
    listenWindowMs,
    _trigger: trigger,
    _say: sayLine,
    _ring: () => (ring ? { x: ring.x, y: ring.y, picked: ring.picked } : null),
    _pocket: pocket,
    _app: app,
    _bridge: bridge,
  };
  if (root) root.instance = instance;
  log("booted;", hooksReady ? "dictionary hooks present" : "dictionary hooks missing: " + missingHooks.join(", "));
  return instance;
}

  return { createVoiceUI, parseLookupQuery, runOps, watchUntil, wordOrdinal, groundStopOrdinal, boot, OPTIONAL_DATA_HOOKS,
           phraseKey, phraseTokens, findPhraseBackwards, createPocket,
           // the quiet layer (QUIET.md): a ring, two inputs, one line
           QUIET_RING, QUIET_DIRECTIONS, quietFace, quietCommand, arrowDirection,
           flickDirection, touchCentroid, FLICK, createSayLine, sayLines, sayHoldMs, quietLine };
});
