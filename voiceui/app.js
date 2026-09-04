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
      case "startAt":
        // No reader hook for phrase search yet -- documented gap, see README.
        break;
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

function createVoiceUI({ bridge, getSentenceWords, getPreviousSentenceId, getDictionaryEntry, synth, schedule, wait, settleMs, dictWaitMs, clarifyRate }) {
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
  async function clarify(pos, ctx) {
    const text = "Which word?";
    await tts.speak(text, { synth });
    const out = { type: "answer", text, clarify: true, replayed: false };
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

  async function answerLookup(query, ctx) {
    const pos = bridge.getPosition(side);
    if (!pos) return { type: "answer", text: "Nothing is playing yet." };

    let wordId = pos.wordId;
    let surfaceText = null;

    if (query.word) {
      const current = getSentenceWords(side, pos.sentenceId) || [];
      const prevId = getPreviousSentenceId(side, pos.sentenceId);
      const previous = prevId ? getSentenceWords(side, prevId) || [] : [];
      const match = resolve.resolveWord(query.word, current, previous);
      if (!match) return clarify(pos, ctx);
      wordId = match.id;
      surfaceText = match.text;
    } else {
      const current = getSentenceWords(side, pos.sentenceId) || [];
      const w = current.find((x) => x.id === wordId);
      surfaceText = w ? w.text : null;
    }

    if (!surfaceText) return clarify(pos, ctx);

    const entry = await lookupEntry(side, surfaceText);
    const text = answers.formatAnswer(entry, surfaceText);
    await tts.speak(text, { synth });
    return { type: "answer", text, wordId, word: surfaceText };
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

  async function handleUtterance(text) {
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
      run.promise = answerLookup(query, lookupCtx);
      inflight = run;
      try {
        return await run.promise;
      } finally {
        if (inflight === run) inflight = null;
      }
    }

    const ops = grammar.tokenize(text);
    if (!ops.length) return { type: "unrecognized", text };

    await interrupt();
    const ctx = { bridge, side, detour, getSentenceWords, schedule, wait, settleMs, active: null, aborted: false };
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
    return { type: "ops", ops, side, stoppedAt: result.stoppedAt, aborted: result.aborted, note: result.note, interrupted: false };
  }

  return { handleUtterance, _detour: detour, side: () => side, _dictionaryWarm: () => dictionaryWarm };
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
  ".voiceui-pill .voiceui-last{max-width:32vw;overflow:hidden;text-overflow:ellipsis;" +
  "white-space:nowrap;opacity:.75;color:var(--fg-dim,#777)}";

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

function boot(opts = {}) {
  const win = opts.win || (typeof window !== "undefined" ? window : undefined);
  const doc = opts.doc || (win && win.document);
  const root = win && (win.VoiceUI = win.VoiceUI || {});
  if (root && root.instance && !opts.force) return root.instance; // once per page

  const mods = Object.assign(
    {
      trigger: root && root.trigger,
      asr: root && root.asr,
      readerBridge: root && root.readerBridge,
    },
    opts.modules || {}
  );
  if (typeof module === "object" && module.exports) {
    mods.trigger = mods.trigger || require("./trigger");
    mods.asr = mods.asr || require("./asr");
    mods.readerBridge = mods.readerBridge || require("./reader-bridge");
  }

  const log = opts.log || ((...a) => { if (typeof console !== "undefined") console.info("[voiceui]", ...a); });
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

  // ---- pill (the visible on/off affordance)
  let pill = null, toggleBtn = null, listenBtn = null, lastEl = null;
  if (doc && typeof doc.createElement === "function") {
    if (!opts.noStyle) {
      const style = doc.createElement("style");
      style.textContent = PILL_CSS;
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
    lastEl = doc.createElement("span");
    lastEl.className = "voiceui-last";
    pill.appendChild(toggleBtn);
    pill.appendChild(listenBtn);
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
  const app = createVoiceUI({
    bridge,
    synth,
    schedule: opts.schedule,
    wait: opts.wait,
    settleMs: opts.settleMs,
    dictWaitMs: opts.dictWaitMs,
    clarifyRate: opts.clarifyRate,
    getSentenceWords: hooksReady ? (side, id) => control.getSentenceWords(side, id) : () => [],
    getPreviousSentenceId: hooksReady ? (side, id) => control.getPreviousSentenceId(side, id) : () => null,
    getDictionaryEntry: hooksReady ? (side, text) => control.getDictionaryEntry(side, text) : () => null,
  });
  if (!hooksReady) log("boot: ReaderControl lacks", missingHooks.join(", "), "-- spoken dictionary answers are off until reader/ adds them");

  // ---- one utterance, end to end
  async function handleUtterance(text) {
    showLast("“" + text + "”");
    const wasArmed = state !== "off" && state !== "unavailable";
    if (wasArmed) setState("busy");
    let result;
    try {
      if (!hooksReady && synth && parseLookupQuery(text)) {
        const msg = "The dictionary isn't connected to the reader yet.";
        await tts.speak(msg, { synth });
        result = { type: "answer", text: msg, unavailable: missingHooks };
      } else if (!synth && parseLookupQuery(text)) {
        result = { type: "answer", text: "No speechSynthesis in this browser.", unavailable: ["speechSynthesis"] };
      } else {
        result = await app.handleUtterance(text);
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
    log("utterance:", text, "->", result.type);
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
    listenWindowMs: opts.listenWindowMs,
    onListenStart() {
      heard = false;
      setState("listening");
      if (!recognizerFactory) {
        showLast("no SpeechRecognition in this browser — window will close as silence");
        return;
      }
      try {
        recognizer = recognizerFactory();
        speech = mods.asr.createSpeechInput({
          recognizer,
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

  function arm() {
    if (state === "unavailable" || state !== "off") return;
    trigger.attach();
    setState("armed", mediaSession ? "" : "Armed, but this browser has no Media Session API -- use the Listen button");
    log("armed", mediaSession ? "(Media Session double-tap on " + (opts.action || "nexttrack") + ")" : "(no mediaSession; Listen button only)");
  }
  function disarm() {
    if (state === "off" || state === "unavailable") return;
    trigger.detach();
    stopRecognizer();
    setState("off", "");
    showLast("");
    log("off");
  }
  function listen() {
    if (state === "off") arm();
    if (state !== "unavailable") trigger.listen();
  }

  if (toggleBtn) toggleBtn.addEventListener("click", () => (state === "off" ? arm() : disarm()));
  if (listenBtn) listenBtn.addEventListener("click", listen);
  setState("off", "");
  if (opts.autoArm) arm();

  const instance = {
    ok: true,
    arm,
    disarm,
    listen,
    handleUtterance,
    state: () => state,
    isArmed: () => state !== "off" && state !== "unavailable",
    missingHooks,
    destroy() {
      disarm();
      if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
      if (root && root.instance === instance) delete root.instance;
    },
    _trigger: trigger,
    _app: app,
    _bridge: bridge,
  };
  if (root) root.instance = instance;
  log("booted;", hooksReady ? "dictionary hooks present" : "dictionary hooks missing: " + missingHooks.join(", "));
  return instance;
}

  return { createVoiceUI, parseLookupQuery, runOps, watchUntil, wordOrdinal, groundStopOrdinal, boot, OPTIONAL_DATA_HOOKS };
});
