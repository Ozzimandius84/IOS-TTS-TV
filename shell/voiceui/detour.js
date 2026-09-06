// voiceui/detour.js — the detour stack and a pure state reducer for the ops
// grammar.js produces. Main position vs. temporary detour is the load-
// bearing idea in TTS_TV_Hands_Free_Voice_Layer.md: "ground"/"what" must
// never move where the user actually is in the target-language material;
// "continue" (or the detour ending on its own) must return to exactly that
// position. No DOM, no reader, no network -- state is a plain object.
//
// applyOps() here is a SYNCHRONOUS simulator: it exists to prove the ops
// grammar.js emits have the right shape and the stack unwinds correctly,
// not to model real playback timing. In the browser a {op:"segment"} must
// actually play audio and wait for it to reach the stop word / sentence
// end (app.js's runOps polls ReaderControl.getPosition each frame and
// pauses the pane) -- here it just leaves `playing` false, which is the
// one thing every ground action guarantees: the reader stops and waits.
//
// UMD: module.exports under Node, or window.VoiceUI.detour in the browser
// via a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.detour = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

class DetourStack {
  constructor() {
    this._stack = [];
  }
  get depth() {
    return this._stack.length;
  }
  get inDetour() {
    return this._stack.length > 0;
  }
  push(frame) {
    this._stack.push(frame);
  }
  peek() {
    return this._stack.length ? this._stack[this._stack.length - 1] : null;
  }
  // Pop exactly one level (the "ground"/"what" one-shot return).
  pop() {
    return this._stack.length ? this._stack.pop() : null;
  }
  // Pop every level and return the bottom-most (original main) frame --
  // "continue" unwinds the whole stack regardless of how many detours deep
  // the user is, per README: "continue ... pops back to exactly where the
  // user was," not just one step back.
  popToBase() {
    let base = null;
    while (this._stack.length) base = this._stack.pop();
    return base;
  }
}

// applyOps(state, ops, detour) -> new state
// state shape: { pane, speed, playing, position, reselected?, lastSegment?, resumed? }
// `position` is opaque to this module (a sentence id, or whatever the real
// reader uses) -- detour.js never inspects it, only saves/restores it.
function applyOps(state, ops, detour) {
  let next = { ...state };
  for (const op of ops) {
    switch (op.op) {
      case "speed":
        next.speed = op.set !== undefined ? op.set : next.speed * op.factor;
        break;
      case "select":
        // Real runtime: re-seek the current pane to its active sentence's
        // start. Nothing in this opaque `position` model changes value --
        // "again" replays the same position, it doesn't move it.
        next.reselected = true;
        break;
      case "back":
        next.pendingBack = { amount: op.amount, unit: op.unit };
        break;
      case "startAt":
        next.pendingStartAt = op.phrase;
        break;
      case "pane":
        if (op.value !== next.pane) {
          if (op.value === "ground" && next.pane === "target") {
            detour.push({ pane: next.pane, position: next.position });
          } else if (op.value === "target") {
            // Bare "target": just switch -- the target pane, stopped at the
            // same word. The detour is over (the user is back on the main
            // position by their own choice) but nothing plays.
            const base = detour.popToBase();
            if (base) next.position = base.position;
            next.playing = false;
          }
          next.pane = op.value;
        }
        break;
      case "segment":
        // "play from A to B in this pane, then stop" -- after any ground
        // action the reader stops and waits; it never runs on by itself.
        next.lastSegment = { pane: next.pane, from: op.from, until: op.until };
        next.playing = false;
        break;
      case "play":
        next.playing = true;
        break;
      case "pause":
        next.playing = false;
        break;
      case "continue": {
        // Unwinds the whole stack to the original main position, then
        // resumes there: target_1 = the exact saved word, ground_1 = that
        // sentence's start, ground_2 = its end (the real seeks happen in
        // app.js; `position` is opaque here so only the choice is recorded).
        const base = detour.popToBase();
        if (base) {
          next.pane = base.pane;
          next.position = base.position;
        }
        next.resumed = op.resume || "target_1";
        next.playing = true;
        break;
      }
      case "pop": {
        // "what"'s one-shot return: back to the frame below, playing.
        const frame = detour.pop();
        if (frame) {
          next.pane = frame.pane;
          next.position = frame.position;
        }
        next.playing = true;
        break;
      }
      default:
        // Unknown op: ignored rather than throwing, so a future grammar
        // token doesn't crash an otherwise-working reducer mid-utterance.
        break;
    }
  }
  return next;
}

  return { DetourStack, applyOps };
});
