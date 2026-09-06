// voiceui/asr.js — Web Speech (SpeechRecognition) wrapper, plus a fake
// recogniser with the same shape so grammar/trigger wiring can be unit
// tested without a browser or microphone. voiceui/README.md: "Speech in:
// Web Speech API (SpeechRecognition; Siri's engine on iOS, needs network)."
// This module does no recognition itself -- it only adapts whichever
// recogniser object it is given to two callbacks: onTranscript(text) and
// onEnd().
//
// UMD: module.exports under Node, or window.VoiceUI.asr in the browser via
// a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.asr = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

function createSpeechInput({ recognizer, onTranscript = () => {}, onEnd = () => {}, onError = () => {} } = {}) {
  if (!recognizer) {
    throw new Error(
      "createSpeechInput requires opts.recognizer -- a real `new (window.SpeechRecognition || window.webkitSpeechRecognition)()` " +
        "in the browser, or asr.createFakeRecognizer() in tests."
    );
  }

  recognizer.onresult = (event) => {
    const results = event.results;
    const last = results[results.length - 1];
    const transcript = (last[0] && last[0].transcript ? last[0].transcript : "").trim();
    if (transcript) onTranscript(transcript);
  };
  recognizer.onend = () => onEnd();
  recognizer.onerror = (e) => onError(e);

  return {
    start: () => recognizer.start(),
    stop: () => recognizer.stop(),
  };
}

// A minimal stand-in for SpeechRecognition with the handful of members this
// module (and only this module) touches. Test code drives it with
// _emitResult(text) / _emitEnd() / _emitError(e); it does no real speech
// processing.
function createFakeRecognizer() {
  return {
    started: false,
    onresult: null,
    onend: null,
    onerror: null,
    start() {
      this.started = true;
    },
    stop() {
      this.started = false;
      if (this.onend) this.onend();
    },
    _emitResult(text) {
      if (this.onresult) this.onresult({ results: [[{ transcript: text }]] });
    },
    _emitEnd() {
      if (this.onend) this.onend();
    },
    _emitError(e) {
      if (this.onerror) this.onerror(e);
    },
  };
}

  return { createSpeechInput, createFakeRecognizer };
});
