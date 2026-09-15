// voiceui/tts.js -- speech out for the short spoken answers. Until 14 Sep
// this was "speechSynthesis ... a different voice from the narrator,
// deliberately"; Osca reversed that (chat 103, see THE BOOK'S VOICE below):
// the answer is in the BOOK'S voice wherever it can be. Answers are produced
// by answers.js as a single sentence; this module speaks one string -- from
// a rendered file, or the synth in the narrator's own system voice, or the
// synth plain -- and resolves when it finishes.
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

// Drop whatever the synth is saying or has queued. A question asked QUIETLY
// over a spoken answer ends the spoken one (voiceui/QUIET.md §4: "the new
// question interrupts it ... `tts.cancel()` on the synth, the old line is
// replaced by the new one in the same frame") -- and a cancelled utterance's
// own onend/onerror is what resolves speak()'s promise, so nothing is left
// awaiting. It is NOT called on the spoken path: a spoken question already
// interrupts a spoken answer through app.js's interrupt(), and cancelling
// there would only take the fake synth's recorded list away from the tests
// that read it. Never throws -- a synth with no cancel() is a synth that had
// nothing to stop.
function cancel(synth) {
  if (!synth || typeof synth.cancel !== "function") return false;
  try { synth.cancel(); return true; } catch (e) { return false; }
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
    utterances: [],   // the whole utterance, for a test that asks WHICH voice
    speak(utterance) {
      this.spoken.push(utterance.text);
      this.utterances.push(utterance);
      if (utterance.onend) utterance.onend();
    },
    cancel() {
      this.spoken.length = 0;
    },
    getVoices() {
      return this.voices || [];
    },
  };
}


// ============================================================ THE BOOK'S VOICE
// Osca, 14 Sep (chat 103): *"You LISTEN to a book, in a voice you like -- then
// the voice UI USES that voice, the book narrator's voice. That's what I
// want."* That reverses the line this file was born under ("a different
// voice from the narrator, deliberately", voiceui/README.md until today) and
// it is decided: BY DEFAULT the assistant answers in whatever voice is
// reading the book. It CAN be different -- ONE setting, "Assistant voice: the
// narrator's / choose...", default the narrator's -- and both values run the
// same code below: the assistant is a VOICE ID, and "the narrator's" is the
// id the book is playing in.
//
// Three kinds of answer, three roads, chosen per sentence by plan():
//   file   the sentence is one of TEMPLATES and the book's folder carries it
//          rendered in the assistant's voice (audio/ui/manifest.json says
//          so) -> the phone plays the file. No synthesis.
//   synth  the assistant is the SYSTEM voice (a book sysvoice.js reads) ->
//          speechSynthesis with the very voice the narrator uses, by name.
//          One setting, never two: the name comes from Transport.system's
//          own voice(), which pickVoice chose by the book's language.
//   synth  the fallback: no file, no system voice -> speechSynthesis as
//          before, and `why` says which door was shut.
// Answers that are the book's own words ("again", "ground", "where am I")
// never reach this file at all -- they are transport ops on timings/ spans,
// and app.js's runOps proves it (tests/assistant.test.js). The DYNAMIC
// sentence -- the gloss -- is Stage 2's, still spoken by the synth today.

// The fixed sentences. voiceui/templates.json is the source of truth and a
// test holds this table to it; the page cannot fetch a JSON over file://
// before its first answer, so the table is repeated here.
const TEMPLATES = Object.freeze({
  which_word: "Which word?",
  nothing_playing: "Nothing is playing yet.",
  no_dictionary: "The dictionary isn't connected to the reader yet.",
});
const TEMPLATE_LANG = "en";                       // the gloss language (LANG_OUT)
const NARRATOR = "narrator";                      // the setting's default value
const SETTING_KEY = "ttstv.voiceui.assistantVoice"; // localStorage, until prefs/ has the row
const UI_DIR = "audio/ui/";                       // beside timings/, inside audio/
const FILE_EXT = "wav";
// ROAD B / B' (chat 104, Osca's pick on 14 Sep). The DYNAMIC sentence -- the
// gloss -- is a file too now, rendered in the book's own voice by Studio and
// cached beside the book, one file per SENTENCE:
//     books/<slug>/assistant/<sha1(text)>.opus
// The reader computes that name itself (sha1 below) and asks for the FILE.
// That is the whole design: no manifest to fetch, no route to ask, nothing
// that has to be up -- so a book whose assistant was downloaded (B') answers
// offline, and the second press of any word is a file whoever rendered it.
// `POST /say` is only ever pressed on a MISS, it returns no audio, and
// nothing waits on it.
const GLOSS_DIR = "assistant/";
const GLOSS_EXT = "opus";
const WAIT_KEY = "ttstv.voiceui.assistantWait";  // "wait" | "now"
const WAIT = "wait", NOW = "now";
const GLOSS_POLL_MS = 2000;                      // while waiting for the narrator
const GLOSS_WAIT_MS = 5 * 60 * 1000;             // a cold model load is minutes

// sha1(text) in the page, byte-for-byte Python's `hashlib.sha1(text.strip()
// .encode("utf-8")).hexdigest()` -- `voiceui/gloss.py::key` is the same
// function on the other side, and a test holds the two together over the
// real sentences of a real book.
//
// WHY NOT `crypto.subtle`. It exists only in a SECURE context, and the
// reader is served to the phone over plain http on the LAN -- exactly the
// case this has to work in. Forty lines of arithmetic that always work beat
// a browser API that is undefined on the device this feature is for.
function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(i + 1);
      const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      i++;
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function sha1(text) {
  const msg = utf8Bytes(String(text == null ? "" : text).trim());
  const ml = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(Math.floor(ml / Math.pow(2, i * 8)) & 0xff);
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const rol = (n, b) => ((n << b) | (n >>> (32 - b))) >>> 0;
  const w = new Array(80);
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) |
              (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const t = (rol(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => ("0000000" + x.toString(16)).slice(-8)).join("");
}

// The answer's own URL, computable with nothing fetched and nothing running.
function glossUrl(bookBase, text) {
  return String(bookBase || "") + GLOSS_DIR + sha1(text) + "." + GLOSS_EXT;
}

function templateId(text) {
  const t = String(text || "");
  for (const id of Object.keys(TEMPLATES)) if (TEMPLATES[id] === t) return id;
  return null;
}

// A voice id is a string. "system:<name>" is a speechSynthesis voice by name;
// anything else is a rendered voice's folder name (render.json's `voice`,
// TTS_DATA/voices/<name>/ -- core/voicemeta.py). parseVoiceId is total.
function parseVoiceId(id) {
  const s = String(id || "").trim();
  if (!s || s === NARRATOR) return null;
  if (s.slice(0, 7) === "system:") return { kind: "system", id: s, name: s.slice(7) };
  return { kind: "rendered", id: s };
}

// THE NARRATOR'S VOICE, read off the page and never guessed. A rendered book
// is the `voice` in books/<slug>/render.json (the file Studio wrote when the
// voice was chosen); a system-voice book is Transport.system.voice() -- the
// engine sysvoice.js registered, asked for the voice it picked. `transport`
// is window.Transport; `renderJson` is the parsed file or null.
function narratorVoice({ transport, renderJson } = {}) {
  let st = null;
  try { st = transport && typeof transport.state === "function" ? transport.state() : null; } catch (e) { st = null; }
  const rendered = renderJson && typeof renderJson.voice === "string" && renderJson.voice.trim();
  if (rendered && (!st || st.voice || !st.system)) {
    return { kind: "rendered", id: renderJson.voice.trim(), engine: renderJson.engine || null };
  }
  let sys = null;
  try { sys = transport && transport.system && typeof transport.system.voice === "function" ? transport.system.voice() : null; } catch (e) { sys = null; }
  if (sys && sys.name) return { kind: "system", id: "system:" + sys.name, name: sys.name, lang: sys.lang || null };
  if (rendered) return { kind: "rendered", id: renderJson.voice.trim(), engine: renderJson.engine || null };
  return null;
}

// The setting -> the voice the assistant speaks in. Default (null, "", or
// "narrator") is the narrator's; anything else is that id, whatever book is
// open ("for every book, until changed").
function assistantVoice(setting, narrator) {
  const chosen = parseVoiceId(setting);
  if (chosen) return Object.assign({ chosen: true }, chosen);
  return narrator ? Object.assign({ chosen: false }, narrator) : null;
}

function templateUrl(bookBase, voiceId, lang, id, ext) {
  return String(bookBase || "") + UI_DIR + encodeURIComponent(voiceId) + "/" + encodeURIComponent(lang || TEMPLATE_LANG) +
    "/" + encodeURIComponent(id) + "." + (ext || FILE_EXT);
}
function manifestUrl(bookBase) { return String(bookBase || "") + UI_DIR + "manifest.json"; }

// manifest.json: { "<voiceId>": { "<lang>": ["which_word", ...] }, "ext": "wav" }
function manifestHas(manifest, voiceId, lang, id) {
  if (!manifest || !voiceId) return false;
  const v = manifest[voiceId];
  const list = v && v[lang || TEMPLATE_LANG];
  return Array.isArray(list) && list.indexOf(id) >= 0;
}

// plan(): one sentence -> which road, as data, before anything makes a sound.
//   { how: "file", url, id, voice }        play this file
//   { how: "synth", voiceName, id, why }   speechSynthesis; voiceName may be null
function plan(text, { assistant, manifest, bookBase, lang } = {}) {
  const id = templateId(text);
  const L = lang || TEMPLATE_LANG;
  if (!assistant) return { how: "synth", voiceName: null, id, why: "no narrator voice known" };
  if (assistant.kind === "system") return { how: "synth", voiceName: assistant.name, id, why: null };
  // THE DYNAMIC SENTENCE -- the gloss. Stage 2 left it to the synth; Road B
  // gives it the narrator's voice through a file whose name is the sentence.
  // The URL is returned whether or not the file exists: say() finds that out
  // by ASKING FOR IT, which is one request either way and needs no manifest.
  if (!id) {
    if (bookBase) return { how: "gloss", url: glossUrl(bookBase, text), key: sha1(text), id: null, voice: assistant.id, text: String(text) };
    return { how: "synth", voiceName: null, id, why: "no book base -- nowhere to look for an answer" };
  }
  if (manifestHas(manifest, assistant.id, L, id)) {
    return { how: "file", url: templateUrl(bookBase, assistant.id, L, id, manifest.ext), id, voice: assistant.id };
  }
  return { how: "synth", voiceName: null, id, why: "no rendered template for " + assistant.id + "/" + L + "/" + id };
}

// A file player over the DOM's own Audio. Resolves {played, error}; never
// rejects. Same deadline shape as speak(): a phone that never fires `ended`
// hands control back, and the answer that was cut short is one answer, not a
// wedged mic.
function createFilePlayer(AudioCtor, { setTimeoutFn, clearTimeoutFn, timeoutMs } = {}) {
  const setT = setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
  const clearT = clearTimeoutFn || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
  let current = null;
  function playFile(url) {
    if (typeof AudioCtor !== "function") return Promise.resolve({ played: false, error: "no Audio" });
    return new Promise((resolve) => {
      let done = false, timer = null;
      const finish = (r) => { if (done) return; done = true; if (timer !== null && clearT) clearT(timer); if (current === a) current = null; resolve(r); };
      let a;
      try { a = new AudioCtor(url); } catch (e) { resolve({ played: false, error: e }); return; }
      current = a;
      a.onended = () => finish({ played: true, error: null });
      a.onerror = (e) => finish({ played: false, error: e || "error" });
      if (setT) timer = setT(() => finish({ played: false, error: "timeout" }), timeoutMs === undefined ? MAX_TIMEOUT_MS : timeoutMs);
      try {
        const p = a.play();
        if (p && typeof p.catch === "function") p.catch((e) => finish({ played: false, error: e }));
      } catch (e) { finish({ played: false, error: e }); }
    });
  }
  function stop() {
    if (!current) return false;
    try { current.pause(); } catch (e) { /* nothing to stop */ }
    if (current.onended) current.onended();
    return true;
  }
  return { playFile, stop };
}

// say(): the ONE door app.js speaks through. `assistant` is a context (see
// createAssistant) or nothing -- with nothing, this is speak() exactly.
// Resolves speak()'s {spoken, timedOut, error} plus `how` ("file" | "synth")
// and the plan it followed, so a report and the pill can say which road.
async function say(text, opts = {}) {
  const ctx = opts.assistant || null;
  const p = ctx ? plan(text, ctx.planning()) : { how: "synth", voiceName: null, id: templateId(text), why: "no assistant context" };
  // ROAD B, and it is three steps in the order that costs the least: ask for
  // the file (a hit is the whole answer and nothing else runs); on a miss ask
  // Studio to render it; then do what the PERSON said to do while it renders
  // -- "wait for the narrator's voice" waits and plays it, "speak it now"
  // answers immediately with the system voice and leaves the render to land
  // for next time. Either way the render was started, so no press is wasted.
  if (p.how === "gloss" && ctx && typeof ctx.playFile === "function") {
    const hit = await ctx.playFile(p.url);
    if (hit && hit.played) return { spoken: true, timedOut: false, error: null, how: "gloss", plan: p };
    let asked = null;
    if (typeof ctx.askSay === "function") { try { asked = await ctx.askSay(text); } catch (e) { asked = { error: String(e && e.message || e) }; } }
    p.asked = asked;
    const rendering = !!(asked && (asked.rendering || asked.ready));
    if (rendering && ctx.wait && ctx.wait() === WAIT) {
      const r = await waitForGloss(ctx, p, opts);
      if (r) return r;
      p.fellBack = "the narrator's answer did not arrive in time";
    } else if (rendering) {
      p.fellBack = "rendering -- spoken now, a file next time";
    } else {
      p.fellBack = (asked && (asked.why || asked.error)) || "no answer file and nothing rendering";
    }
  }
  if (p.how === "file" && ctx && typeof ctx.playFile === "function") {
    const r = await ctx.playFile(p.url);
    if (r && r.played) return { spoken: true, timedOut: false, error: null, how: "file", plan: p };
    p.fellBack = r && r.error ? String(r.error && r.error.message || r.error) : "file did not play";
  }
  const spoken = await speak(text, Object.assign({}, opts, { voiceName: p.voiceName || opts.voiceName || null }));
  return Object.assign(spoken, { how: "synth", plan: p });
}

// The setting, read and written where prefs/prefs.js cannot yet hold it (its
// read() drops unknown keys) -- one key in localStorage, and the prefs store's
// own `assistantVoice` the day it has the row (README §6). A store that
// throws is a store that has nothing.
// "wait for the narrator's voice" -- poll for the file and play it when it
// lands. A deadline, not a loop: a render that never finishes hands control
// back and the sentence is spoken by the synth, the same shape every other
// wait in this file has (speak()'s timeout, createFilePlayer()'s).
async function waitForGloss(ctx, p, opts = {}) {
  const sleep = opts.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.nowFn || (() => Date.now());
  const deadline = now() + (opts.glossWaitMs === undefined ? GLOSS_WAIT_MS : opts.glossWaitMs);
  const every = opts.glossPollMs === undefined ? GLOSS_POLL_MS : opts.glossPollMs;
  while (now() < deadline) {
    await sleep(every);
    const r = await ctx.playFile(p.url);
    if (r && r.played) return { spoken: true, timedOut: false, error: null, how: "gloss", plan: Object.assign({ waited: true }, p) };
  }
  return null;
}

// THE SECOND SETTING, and the prompt names both halves of it: *"wait for the
// narrator's voice \u00b7 speak it now"*. Default is `now` -- an answer that
// arrives late is worse than an answer in the wrong voice, and the narrator's
// one lands for the next press regardless.
function readWait(storage, store) {
  try { const s = store && typeof store.read === "function" ? store.read() : null; if (s && (s.assistantWait === WAIT || s.assistantWait === NOW)) return s.assistantWait; } catch (e) { /* no store */ }
  try { const v = storage && storage.getItem(WAIT_KEY); return v === WAIT ? WAIT : NOW; } catch (e) { return NOW; }
}
function writeWait(storage, value, store) {
  const v = value === WAIT ? WAIT : NOW;
  try { if (store && typeof store.patch === "function") store.patch({ assistantWait: v }); } catch (e) { /* no store */ }
  try { if (storage) { if (v === NOW) storage.removeItem(WAIT_KEY); else storage.setItem(WAIT_KEY, v); } } catch (e) { /* no storage */ }
  return v;
}

function readSetting(storage, store) {
  try { const s = store && typeof store.read === "function" ? store.read() : null; if (s && typeof s.assistantVoice === "string" && s.assistantVoice) return s.assistantVoice; } catch (e) { /* no store */ }
  try { const v = storage && storage.getItem(SETTING_KEY); return typeof v === "string" && v ? v : NARRATOR; } catch (e) { return NARRATOR; }
}
function writeSetting(storage, value, store) {
  const v = parseVoiceId(value) ? String(value).trim() : NARRATOR;
  try { if (store && typeof store.patch === "function") store.patch({ assistantVoice: v }); } catch (e) { /* no store */ }
  try { if (storage) { if (v === NARRATOR) storage.removeItem(SETTING_KEY); else storage.setItem(SETTING_KEY, v); } } catch (e) { /* no storage */ }
  return v;
}

// createAssistant(): the page's context for say() and the PRESS. Everything
// is a door passed in so it runs under node --test with no DOM:
//   transport   window.Transport (state(), system.voice())
//   renderJson  () -> books/<slug>/render.json parsed, or null  (async ok)
//   manifest    () -> audio/ui/manifest.json parsed, or null    (async ok)
//   bookBase    () -> "../books/<slug>/"
//   storage     window.localStorage;  store: window.TTSTVSettings
//   playFile    (url) -> Promise<{played}>  (createFilePlayer(Audio).playFile)
// The two fetches are asked ONCE per book and remembered; until they answer,
// plan() sees null and the synth speaks -- an answer never waits on a fetch.
function createAssistant(doors = {}) {
  const d = doors;
  let cache = { base: null, renderJson: null, manifest: null };
  function base() { try { return typeof d.bookBase === "function" ? d.bookBase() : d.bookBase || null; } catch (e) { return null; } }
  function warm() {
    const b = base();
    if (!b || cache.base === b) return;
    cache = { base: b, renderJson: null, manifest: null };
    const mine = cache;
    const ask = (fn, key) => {
      if (typeof fn !== "function") return;
      try {
        Promise.resolve(fn(b)).then((v) => { if (cache === mine) mine[key] = v || null; }, () => {});
      } catch (e) { /* the door is shut */ }
    };
    ask(d.renderJson, "renderJson");
    ask(d.manifest, "manifest");
  }
  function narrator() { warm(); return narratorVoice({ transport: d.transport, renderJson: cache.renderJson }); }
  function setting() { return readSetting(d.storage, d.store); }
  function assistant() { return assistantVoice(setting(), narrator()); }
  function planning() { warm(); return { assistant: assistant(), manifest: cache.manifest, bookBase: cache.base, lang: d.lang || TEMPLATE_LANG }; }
  // THE PRESS (Osca, 14 Sep: "use this voice -- this is my voice UI"): any
  // voice the person can hear, one press, and the assistant speaks in it for
  // every book until changed. The reverse press is useNarrator().
  function useForAssistant(voiceId) { return writeSetting(d.storage, voiceId, d.store); }
  function useNarrator() { return writeSetting(d.storage, NARRATOR, d.store); }
  // The wait/now half, and the one door Road B needs: `askSay` is POST /say,
  // passed in like every other door so this module fetches nothing itself.
  function wait() { return readWait(d.storage, d.store); }
  function setWait(v) { return writeWait(d.storage, v, d.store); }
  // what Settings shows by name: {setting, assistant, narrator, usingNarrator}
  function describe() {
    const n = narrator(), a = assistantVoice(setting(), n);
    return { setting: setting(), assistant: a, narrator: n, usingNarrator: !(a && a.chosen),
             wait: wait() };
  }
  warm();   // ask now if the book is already known; a later book re-asks on its first answer
  return { planning, narrator, assistant, setting, describe, useForAssistant, useNarrator,
           wait, setWait, askSay: d.askSay || null,
           playFile: d.playFile || null, warm, _cache: () => cache };
}

// "book=<slug>" off the reader's own URL hash -- the same key reader.html
// opens a book by. Not a reader internal: it is the address bar.
function slugFromLocation(loc) {
  const m = /(?:^|[#&?])book=([^&]+)/.exec((loc && loc.hash) || "");
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

  return { speak, cancel, createFakeSynth, hasVoice, speakTimeoutMs,
           // the book's voice (chat 103)
           TEMPLATES, TEMPLATE_LANG, NARRATOR, SETTING_KEY, templateId, parseVoiceId, narratorVoice, assistantVoice,
           templateUrl, manifestUrl, manifestHas, plan, createFilePlayer, say, readSetting, writeSetting,
           createAssistant, slugFromLocation,
           // the gloss in the book's voice (chat 104, Road B/B')
           GLOSS_DIR, GLOSS_EXT, WAIT_KEY, WAIT, NOW, sha1, utf8Bytes, glossUrl,
           waitForGloss, readWait, writeWait };
});
