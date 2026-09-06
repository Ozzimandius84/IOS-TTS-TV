// voiceui/grammar.js — tokenise a spoken utterance into an ordered list of
// playback ops. Pure text -> ops; no DOM, no reader, no network. See
// voiceui/README.md "The grammar" for the token vocabulary this implements.
//
// Design note (judgment call, see report): the grammar is COMPOSABLE, not
// positional — "again, slower, ground" and "ground, slower, again" produce
// the identical op list, because the ops are executed in a fixed canonical
// order (SPEED, then SELECT, then BACK/START-AT, then PANE, then the
// transport op, then an auto-POP), not the order the user happened to speak
// them in. That canonical order is exactly what the prompt's own worked
// example requires: "again, slower, ground" -> [speed 0.8, pane=ground,
// segment start..end] — "slower" (spoken second) outputs before "again"
// (spoken first, folded into the segment's `until`).
//
// Osca's two decisions (PROMPTS/voiceui.md, 28 Aug evening) fix what the
// two pane words do, and they are NOT symmetrical:
//   ground   -> switch to the ground (L1) pane and play the aligned sentence
//               from its start up to the word where "ground" was said, then
//               STOP and wait. Nothing auto-pops. "again ... ground" plays the
//               whole sentence instead of stopping at the word, then stops.
//   what     -> the whole aligned sentence in L1, then straight back to the
//               target pane at the exact word (this one still auto-pops:
//               "double-tap + silence plays the L1 sentence and returns").
//   target   -> just switch: the target pane, stopped at the same word.
// From a ground stop the listener has four ways on, each one utterance:
//   finish sentence            -> {op:"segment", from:"here",  until:"end"}
//   continue  (= target one)   -> {op:"continue", resume:"target_1"}  the word where "ground" was said
//   continue from start (= ground one) -> {op:"continue", resume:"ground_1"}  that sentence's start
//   continue from end   (= ground two) -> {op:"continue", resume:"ground_2"}  that sentence's end
// The rule under all of it: after any ground action the reader stops and
// waits; it never runs on by itself. So a bare "ground" emits no "play" and
// no "pop" -- the {op:"segment"} it emits is "play A..B in this pane, then
// stop", and app.js's runOps is what actually stops it.
//
// UMD: module.exports under Node (voiceui/tests/*.test.js), or
// window.VoiceUI.grammar in the browser via a plain <script> tag --
// reader.html must stay openable over file://, which Chrome blocks for
// `type="module"` scripts, so this repo has no ES modules and no bundler
// anywhere. See voiceui/README.md "Loading in the browser".
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.grammar = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

const SPEED_FASTER_FACTOR = 1.25;
const SPEED_SLOWER_FACTOR = 0.8;

// Execution order is fixed regardless of speech order (see module doc above).
const OP_PRIORITY = { speed: 1, select: 2, back: 3, startAt: 3, pane: 4, segment: 5, transport: 6, continue: 7, pop: 8 };

function splitClauses(text) {
  return text
    .toLowerCase()
    .trim()
    .split(/\s*(?:,|\bthen\b|\band\b)\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
}

// A RECOGNISER MAY HAND BACK EITHER "back 5 words" OR "back five words"
// (5 Sep, writing PRESS.md: every other token in this grammar is a word, and
// this was the one that demanded a digit -- so the one command most likely to
// be spoken on a walk was the one most likely not to parse). Web Speech is
// free to spell a small number out and iOS often does. Twenty is as far as
// anyone counts back by ear.
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  a: 1, an: 1, // "back a word", "back a second"
};
function parseCount(token) {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token) ? NUMBER_WORDS[token] : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// tokenize(utterance) -> Op[]
// Op shapes:
//   {op:"speed", factor:N}   relative multiply (faster/slower, stacks)
//   {op:"speed", set:N}      absolute (normal)
//   {op:"select", target:"current"}   "again" on the pane you're on
//   {op:"back", amount:N, unit:"words"|"seconds"}
//   {op:"startAt", phrase:string}
//   {op:"pane", value:"ground"|"target"}
//   {op:"segment", from:"start"|"here", until:"word"|"end"}
//        play the current pane's sentence from `from` up to `until`, then stop
//        from:"start" is the aligned ground sentence (always follows a pane
//        op); from:"here" is wherever the pane's clock is now ("finish sentence")
//   {op:"play"} | {op:"pause"}
//   {op:"continue", resume:"target_1"|"ground_1"|"ground_2"}
//   {op:"pop"}   auto-appended for "what" only (one-shot: play L1, come back)
function tokenize(utterance) {
  if (typeof utterance !== "string") return [];
  const clauses = splitClauses(utterance);

  let speedFactor = 1;
  let speedSet = null;
  let select = false;
  const backOps = [];
  const startAtOps = [];
  let pane = null;
  let transport = null; // "play" | "pause"
  let resume = null; // "target_1" | "ground_1" | "ground_2"
  let finish = false; // "finish sentence"
  let ground = false; // a ground detour is being opened in this utterance
  let what = false; // ... and it's the one-shot "what" kind (auto-pop)

  for (const clause of clauses) {
    let m;
    if (/^(again|repeat)$/.test(clause)) {
      select = true;
    } else if (/^faster$/.test(clause)) {
      speedFactor *= SPEED_FASTER_FACTOR;
    } else if (/^slower$/.test(clause)) {
      speedFactor *= SPEED_SLOWER_FACTOR;
    } else if (/^normal( speed)?$/.test(clause)) {
      speedSet = 1;
    } else if (/^(play|start)$/.test(clause)) {
      transport = "play";
    } else if (/^(pause|stop)$/.test(clause)) {
      transport = "pause";
    } else if (/^finish( the)?( sentence)?$/.test(clause)) {
      finish = true;
    } else if (/^(continue|resume)( from)?( the)? (start|beginning)$/.test(clause) || /^ground (one|1)$/.test(clause)) {
      resume = "ground_1";
    } else if (/^(continue|resume)( from)?( the)? end$/.test(clause) || /^ground (two|2)$/.test(clause)) {
      resume = "ground_2";
    } else if (/^(continue|resume)$/.test(clause) || /^target (one|1)$/.test(clause)) {
      resume = "target_1";
    } else if (/^ground$/.test(clause)) {
      pane = "ground";
      ground = true;
    } else if (/^target$/.test(clause)) {
      pane = "target";
    } else if (/^what$/.test(clause)) {
      pane = "ground";
      ground = true;
      what = true;
    } else if ((m = clause.match(/^(?:back|go back)\s+([a-z0-9]+)\s+(words?|seconds?)$/))) {
      const amount = parseCount(m[1]);
      if (amount !== null) backOps.push({ amount, unit: m[2].startsWith("word") ? "words" : "seconds" });
    } else if ((m = clause.match(/^start at (.+)$/))) {
      startAtOps.push(m[1].trim());
    }
    // Anything else is not this grammar's vocabulary -- left unrecognised
    // rather than guessed at. A language-tool query ("what does X mean")
    // is parsed separately; see resolve.js/answers.js and app.js.
  }

  const ops = [];
  if (speedSet !== null) ops.push({ op: "speed", set: speedSet });
  else if (speedFactor !== 1) ops.push({ op: "speed", factor: round2(speedFactor) });
  // "again" on the pane you're on re-seeks that sentence; with "ground" in
  // the same utterance it instead widens the ground segment to the whole
  // sentence -- the target pane's own position is never touched (the
  // detour must return to the exact word).
  if (select && !ground) ops.push({ op: "select", target: "current" });
  for (const b of backOps) ops.push({ op: "back", amount: b.amount, unit: b.unit });
  for (const phrase of startAtOps) ops.push({ op: "startAt", phrase });
  if (pane) ops.push({ op: "pane", value: pane });
  if (ground) ops.push({ op: "segment", from: "start", until: select || what ? "end" : "word" });
  if (finish) ops.push({ op: "segment", from: "here", until: "end" });
  if (transport) ops.push({ op: transport });
  if (resume) ops.push({ op: "continue", resume });
  if (what && !resume) ops.push({ op: "pop" });

  return ops;
}

  return { tokenize, OP_PRIORITY, SPEED_FASTER_FACTOR, SPEED_SLOWER_FACTOR, NUMBER_WORDS, parseCount };
});
