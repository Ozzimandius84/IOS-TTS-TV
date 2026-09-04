// voiceui/trigger.js — Media Session double-tap trigger. AirPods buttons
// reach a web page only through the Media Session API's play/pause/
// nexttrack/previoustrack handlers (voiceui/README.md "Trigger, not a wake
// word"). Double-tapping the same button within `doubleTapWindowMs` opens a
// `listenWindowMs` listening window; silence in that window means plain
// "what" (README: "Silence in that window = plain 'What?'").
//
// Everything here is injected (mediaSession, clock, timers) so it runs and
// is tested under plain Node with no browser: pass a fake mediaSession
// object in tests, `navigator.mediaSession` in the real page.
//
// UMD: module.exports under Node, or window.VoiceUI.trigger in the browser
// via a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.trigger = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

function createTrigger({
  mediaSession,
  action = "nexttrack",
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  doubleTapWindowMs = 500,
  listenWindowMs = 2500,
  onListenStart = () => {},
  onSilence = () => {},
} = {}) {
  // null, not 0 -- a real/fake clock can legitimately report 0 for the
  // first tap, which must not look like "there was a previous tap at t=0".
  let lastTapAt = null;
  let listenTimer = null;
  let listening = false;

  function openListeningWindow() {
    if (listening) return; // a window is already open; a second tap-pair inside it is noise
    listening = true;
    onListenStart();
    listenTimer = setTimeoutFn(() => {
      listenTimer = null;
      listening = false;
      onSilence();
    }, listenWindowMs);
  }

  function handleTap() {
    const t = now();
    if (lastTapAt !== null && t - lastTapAt <= doubleTapWindowMs) {
      lastTapAt = null;
      openListeningWindow();
    } else {
      lastTapAt = t;
    }
  }

  // Call when the ASR layer reports real speech before the silence timer
  // fires, so "what" (silence) and a spoken command don't both trigger.
  function noteUtteranceReceived() {
    if (listenTimer) {
      clearTimeoutFn(listenTimer);
      listenTimer = null;
    }
    listening = false;
  }

  function attach() {
    if (mediaSession && typeof mediaSession.setActionHandler === "function") {
      mediaSession.setActionHandler(action, handleTap);
    }
  }

  function detach() {
    if (mediaSession && typeof mediaSession.setActionHandler === "function") {
      mediaSession.setActionHandler(action, null);
    }
    if (listenTimer) clearTimeoutFn(listenTimer);
  }

  return {
    attach,
    detach,
    // Open the listening window without a double-tap -- the on-screen
    // "Listen" affordance (app.js boot) and desktop testing use this; the
    // AirPods path still goes through the mediaSession handler.
    listen: openListeningWindow,
    noteUtteranceReceived,
    isListening: () => listening,
    // exposed for tests only -- production code should never call the
    // handler directly, only via a real/fake mediaSession action.
    _simulateTap: handleTap,
  };
}

  return { createTrigger };
});
