// voiceui/tts.js -- speechSynthesis wrapper for the short spoken answers
// (voiceui/README.md: "Speech out: speechSynthesis for the short template
// answers; a different voice from the narrator, deliberately."). Answers are
// produced by answers.js as a single sentence; this module's only job is to
// speak one string and resolve when it finishes.
//
// UMD: module.exports under Node, or window.VoiceUI.tts in the browser via
// a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.tts = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

// How long to wait for `onend` before handing control back. speechSynthesis
// is allowed to never call it, and does: a headless Chrome has the whole API
// and no voices, so speak() is accepted and neither `onend` nor `onerror`
// ever fires; iOS Safari drops `onend` if the page is backgrounded mid-
// utterance, which for a phone in a pocket is the normal case, not the edge
// one. Without a deadline the awaiting utterance never finishes and the pill
// stays on "Voice: working…" forever -- the mic layer wedged by its own
// answer. So the deadline is generous (long enough that a real voice reading
// a one-sentence answer finishes first) and its expiry is NOT an error and
// NOT a cancel: the browser goes on speaking, voiceui just stops waiting.
const MS_PER_CHAR = 90;      // ~11 characters a second, slower than any real voice
const MIN_TIMEOUT_MS = 2500;
const MAX_TIMEOUT_MS = 20000;
function speakTimeoutMs(text, rate) {
  const chars = String(text || "").length;
  const est = (chars * MS_PER_CHAR) / (rate > 0 ? rate : 1) + 1500;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(est)));
}

// Resolves {spoken, timedOut, error} -- never rejects once a synth is
// present. A voice that fails is one answer the listener did not hear; it
// is not a failed lookup, and turning it into a thrown error would have the
// pill say "error" about a word it resolved correctly.
function speak(text, { synth, rate = 1, voiceName = null, timeoutMs, setTimeoutFn, clearTimeoutFn } = {}) {
  if (!synth || typeof synth.speak !== "function") {
    throw new Error(
      "speak() requires opts.synth -- window.speechSynthesis in the browser, or tts.createFakeSynth() in tests."
    );
  }
  const setT = setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
  const clearT = clearTimeoutFn || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
  const hasRealUtterance = typeof SpeechSynthesisUtterance !== "undefined";
  const utterance = hasRealUtterance ? new SpeechSynthesisUtterance(text) : { text };
  utterance.rate = rate;
  if (voiceName && typeof synth.getVoices === "function") {
    const match = synth.getVoices().find((v) => v.name === voiceName);
    if (match) utterance.voice = match;
  }
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (timer !== null && clearT) clearT(timer);
      resolve(result);
    };
    utterance.onend = () => finish({ spoken: true, timedOut: false, error: null });
    utterance.onerror = (e) => finish({ spoken: false, timedOut: false, error: e });
    if (setT) {
      timer = setT(() => finish({ spoken: false, timedOut: true, error: null }),
        timeoutMs === undefined ? speakTimeoutMs(text, rate) : timeoutMs);
    }
    try {
      synth.speak(utterance);
    } catch (e) {
      finish({ spoken: false, timedOut: false, error: e });
    }
  });
}

// True when this synth has no voice to speak with -- a headless Chrome, or a
// browser whose voice list has not arrived yet. Only ever used to say so in
// a report or a pill tooltip: speak() is called either way, because an empty
// list is not proof (real browsers populate voices asynchronously and fire
// `voiceschanged` afterwards), and the deadline above covers the case where
// it really is silent.
function hasVoice(synth) {
  if (!synth || typeof synth.getVoices !== "function") return false;
  try { return synth.getVoices().length > 0; } catch (e) { return false; }
}

// A minimal stand-in for window.speechSynthesis. speak() resolves the
// utterance synchronously (records the text spoken, calls onend) -- no
// audio, no timers, so tests stay fast and deterministic.
function createFakeSynth() {
  return {
    spoken: [],
    speak(utterance) {
      this.spoken.push(utterance.text);
      if (utterance.onend) utterance.onend();
    },
    cancel() {
      this.spoken.length = 0;
    },
    getVoices() {
      return [];
    },
  };
}

  return { speak, createFakeSynth, hasVoice, speakTimeoutMs };
});
