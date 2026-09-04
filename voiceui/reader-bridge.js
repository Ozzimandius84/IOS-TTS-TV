// voiceui/reader-bridge.js -- the ONE seam between voiceui and reader/. Per
// this module's prompt: "reader/README.md and reader/reader.html for the
// functions you may call ... if a needed hook is missing, request it, don't
// patch reader.html yourself." This file states that request as a concrete
// interface instead of prose, and validates whatever reader/ eventually
// exposes against it.
//
// STATUS: reader/reader.html does not expose any of this today. It has no
// `type="module"` and its top-level `function`/`let` declarations (panes,
// seekSentence, otherPane, alignMap, ...) happen to be reachable as bare
// globals by a second classic <script> sharing the same page, but voiceui
// deliberately does NOT reach for those: they are reader.html's *internal*
// names (window.__READER_DEBUG__'s own comment calls the equivalent state
// peek "not a documented public API"), so a reader-side refactor could
// silently break voiceui with no error, in exactly the way core/README's
// module-boundary rule exists to prevent. Instead this module requests a
// small, explicitly-owned `window.ReaderControl` object -- see this
// module's README "Requests to core / other modules" entry.
//
// REQUIRED_METHODS is that request, typed as a contract createReaderBridge()
// can check code against today (with a fake) and reader/ can implement
// against tomorrow.
//
// Every method below takes a `role`, not a pane position: "ground" and
// "target" are LANGUAGE ROLES, never "left"/"right". `ground` is whichever
// pane's language matches the dictionary's gloss language (reader.html's
// `LANG_OUT`, hardcoded to "en" today); `target` is the other pane. For the
// Eclogues pair (la left / en right) that happens to put ground on the
// right, but voiceui never assumes that -- it only ever calls the bridge
// with `'ground'`/`'target'`. Resolving a role to an actual pane is
// `window.ReaderControl`'s job (see voiceui/README.md's convention note),
// so the same voiceui code keeps working if the panes are ever opened the
// other way round.
//
// UMD: module.exports under Node, or window.VoiceUI.readerBridge in the
// browser via a plain <script> tag -- see grammar.js's file header for why
// (no ES modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.readerBridge = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

const REQUIRED_METHODS = [
  "getPosition", // (role) -> {chapterId, sentenceId, wordId, atSentenceStart} | null
  "getSpeed", // (role) -> number
  "setSpeed", // (role, rate) -> void
  "isPaused", // (role) -> boolean
  "play", // (role) -> void
  "pause", // (role) -> void
  "seekSentenceDelta", // (role, delta) -> void -- reader.html has this internally as seekSentence(), just not exposed
  "seekWordDelta", // (role, delta) -> void -- NEW: reader.html has no word-granularity seek at all today
  "seekSeconds", // (role, deltaSeconds) -> void -- NEW: same gap, second-granularity
  "getAlignedSentenceId", // (fromSide, sentenceId) -> string | null -- wraps the align.json / nearestIndex logic already inside syncFollower()
  "playAlignedSegment", // (fromSide, sentenceId) -> Promise<void> -- resolves when the OTHER pane's aligned segment finishes; this is what "ground"/"what" actually needs
];

// Landed on ReaderControl after REQUIRED_METHODS was written (reader/
// 99b0cfe, c29d38d) and used only where voiceui can do without them, so
// they are passed through when present rather than demanded: an older
// reader.html still boots, and the "which word?" replay simply says it
// could not replay. `getSentenceWords`/`getPreviousSentenceId`/
// `getDictionaryEntry` stay out of this list on purpose -- app.js's boot
// wires those itself (OPTIONAL_DATA_HOOKS) because it has to degrade the
// whole answer, not one step of it.
const OPTIONAL_METHODS = [
  "playRange", // (role, {from: "sentenceStart"|wordId, to: "sentenceEnd"|wordId}) -> Promise<{sentenceId, wordId, time, aborted}|null>
  "seekToWord", // (role, wordId) -> boolean -- the one absolute seek
];

class MissingReaderControlError extends Error {
  constructor(missing) {
    super(
      `reader-bridge: the supplied control object is missing: ${missing.join(", ")}. ` +
        "voiceui cannot drive playback until reader/reader.html exposes window.ReaderControl " +
        "with this shape -- see voiceui/README.md 'Requests to core / other modules'."
    );
    this.name = "MissingReaderControlError";
    this.missing = missing;
  }
}

function createReaderBridge(control) {
  const missing = REQUIRED_METHODS.filter((name) => typeof control?.[name] !== "function");
  if (missing.length) throw new MissingReaderControlError(missing);

  return {
    getPosition: (side) => control.getPosition(side),
    getSpeed: (side) => control.getSpeed(side),
    setSpeed: (side, rate) => control.setSpeed(side, rate),
    isPaused: (side) => control.isPaused(side),
    play: (side) => control.play(side),
    pause: (side) => control.pause(side),
    seekSentenceDelta: (side, delta) => control.seekSentenceDelta(side, delta),
    seekWordDelta: (side, delta) => control.seekWordDelta(side, delta),
    seekSeconds: (side, delta) => control.seekSeconds(side, delta),
    getAlignedSentenceId: (fromSide, sentenceId) => control.getAlignedSentenceId(fromSide, sentenceId),
    playAlignedSegment: (fromSide, sentenceId) => control.playAlignedSegment(fromSide, sentenceId),
    // present only if the control has them; callers must check
    playRange: typeof control.playRange === "function" ? (side, range) => control.playRange(side, range) : undefined,
    seekToWord: typeof control.seekToWord === "function" ? (side, wordId) => control.seekToWord(side, wordId) : undefined,
  };
}

// Looks for window.ReaderControl (the requested hook) and wraps it, or
// throws MissingReaderControlError with a precise list of what's absent --
// never silently falls back to guessing at reader.html's internals.
function attachToWindow(win = typeof window !== "undefined" ? window : undefined) {
  if (!win || !win.ReaderControl) {
    throw new MissingReaderControlError(REQUIRED_METHODS);
  }
  return createReaderBridge(win.ReaderControl);
}

  return { createReaderBridge, attachToWindow, REQUIRED_METHODS, OPTIONAL_METHODS, MissingReaderControlError };
});
