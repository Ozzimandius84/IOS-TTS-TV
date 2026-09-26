// voiceui/catalogue.js -- the capability query over the served catalogue.
// "which engine + voice can speak this book's language(s) and its companions'?"
// Pure: no fetch, no engine id, no voice id -- reads the catalogue and answers.
//
// spec-plugins.md §6 (the served catalogue) and §7 (the voice-UI surface).
// D9: voiceui is a CONSUMER, not a second opinion. It hard-codes no engine id
// and no voice list: it reads the catalogue to answer "which engine + voice
// can speak this", and a per-book / per-passage choice is written where the
// reader already writes choices (render.json's voice / voices / cast,
// through core/render.py).
//
// UMD: module.exports under Node, or window.VoiceUI.catalogue in the browser
// via a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.catalogue = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

// §7.1 — the companions, a CLOSED list of 8 paths, verified on disk 19 Sep 2026.
// Every companion is OPTIONAL; a missing one is an empty set, not an error.
// A ninth companion is a §9 item, not an improvisation.
var COMPANIONS = Object.freeze([
  "audio/ui/",                     // 1. the gloss set, in the book's voice
  "assistant/",                    // 2. the assistant's rendered answers
  "dictionary.json",               // 3. per-book offline lookups
  "timings/",                      // 4. word-level timing (transport spans)
  "spans.json",                    // 5. who speaks, in what mode, how
  "names.json",                    // 6. every proper noun, with its cast
  "reader/marginalia/",            // 7. notes, highlights, bookmarks (TTS_DATA)
  "reader/library.json",           // 8. the phone's Library record (TTS_DATA)
]);

// §7.3 — the render.json keys a passage-scoped change writes.
// "voice", "voices", "cast" — no new key, no new file added by this wave.
var RENDER_KEYS = Object.freeze(["voice", "voices", "cast"]);

// The languages whose only road is through phonemes (IPA) or the dub path
// (MMS + Seed-VC via convert/).  §7.2 rule 2: "phonemes covers what
// languages does not": la/grc/sa through IPA when phonemes: true, or the
// dub path when phonemes: false.
var PHONEME_LANGS = Object.freeze(["la", "grc", "sa"]);

// ----------------------------------------------------------------- readCatalogue
// Read the served catalogue (§6.4).  If absent or malformed, returns
// {ok: false, error: <one sentence>, plugins: []}.  A failure is an answer,
// not a guessed list (D8, §7.4: "No guessed engine, no fallback voice.").
function readCatalogue(json) {
  if (json === null || json === undefined || typeof json !== "object") {
    return { ok: false, error: "The catalogue is absent.", plugins: [] };
  }
  if (json.error && typeof json.error === "string") {
    return { ok: false, error: json.error, plugins: [] };
  }
  if (!Array.isArray(json.plugins)) {
    return { ok: false, error: "The catalogue carries no plugins list.", plugins: [] };
  }
  return { ok: true, error: null, plugins: json.plugins };
}

// ----------------------------------------------------------------- the query
// q(params, catalogue) -> result       (spec-plugins.md §7.2)
//
//   params.langs     [string]   the languages the book speaks
//   params.where     string     "local" | "kaggle" | "modal"  (rule 4)
//   params.need      [string]   capabilities the engine MUST have (rule 3)
//   params.packets   [string]   language codes with a packet on disk (rule 1;
//                               null = skip the packet check)
//
//   result.langs     [{lang, plugin, state, why, level}]
//     level: "native" | "phoneme" | "dub" | "no"
//   result.engines   [{id, kind, title, states, why}]
//   result.missing   [{lang, reason}]
//   result.unknown   [{lang, plugin}]
//
// Pure: no fetch, no engine id, no voice list.  Every element carries the
// plugin id that provides it (D3).
function q(params, catalogue) {
  var cat = readCatalogue(catalogue);
  var result = { langs: [], engines: [], missing: [], unknown: [] };

  if (!cat.ok) {
    var langs = params && params.langs || [];
    for (var i = 0; i < langs.length; i++) {
      result.missing.push({ lang: langs[i], reason: cat.error });
    }
    return result;
  }

  var where = params && params.where || null;
  var need = params && params.need || [];
  var packets = params && params.packets || null;
  var requestedLangs = params && params.langs || [];

  // filter to tts_engine plugins available at `where`
  var plugins = [];
  for (var pi = 0; pi < cat.plugins.length; pi++) {
    var p = cat.plugins[pi];
    if (p.kind !== "tts_engine") continue;
    if (where && Array.isArray(p.where) && p.where.indexOf(where) < 0) continue;
    plugins.push(p);
  }

  // filter by required capabilities (rule 3: clone decides whether a voice
  // can be chosen at all)
  var capable = [];
  for (var ci = 0; ci < plugins.length; ci++) {
    var pp = plugins[ci];
    var st = pp.states || {};
    var ok = true;
    for (var ni = 0; ni < need.length; ni++) {
      if (st[need[ni]] !== "yes") { ok = false; break; }
    }
    if (ok) capable.push(pp);
  }

  // for each requested language, find which capable plugins cover it
  var engineSet = {};

  for (var li = 0; li < requestedLangs.length; li++) {
    var lang = requestedLangs[li];

    // rule 1: a language with no packet is level "no"
    if (packets !== null && packets.indexOf(lang) < 0) {
      result.missing.push({ lang: lang, reason: "No language packet for " + lang + "." });
      continue;
    }

    var covered = false;
    var hasUnknown = false;

    for (var ei = 0; ei < capable.length; ei++) {
      var eng = capable[ei];
      var eLangs = Array.isArray(eng.languages) ? eng.languages : [];
      var eStates = eng.states || {};
      var eWhy = eng.capabilities_why || {};

      if (eLangs.indexOf(lang) >= 0) {
        // native coverage
        result.langs.push({
          lang: lang, plugin: eng.id, state: "yes", why: null,
          level: "native"
        });
        engineSet[eng.id] = eng;
        covered = true;
      } else if (PHONEME_LANGS.indexOf(lang) >= 0) {
        // rule 2: phonemes covers what languages does not
        var phonState = eStates.phonemes;
        if (phonState === "yes") {
          result.langs.push({
            lang: lang, plugin: eng.id, state: "yes", why: null,
            level: "phoneme"
          });
          engineSet[eng.id] = eng;
          covered = true;
        } else if (phonState === "no") {
          result.langs.push({
            lang: lang, plugin: eng.id, state: "yes",
            why: eWhy.phonemes || null,
            level: "dub"
          });
          engineSet[eng.id] = eng;
          covered = true;
        } else {
          // unknown or absent — rule 5: unknown is returned as unknown
          result.unknown.push({ lang: lang, plugin: eng.id });
          hasUnknown = true;
        }
      }
      // else: this engine does not cover this lang, nothing per-engine
    }

    if (!covered && !hasUnknown) {
      result.missing.push({
        lang: lang,
        reason: capable.length === 0
          ? "No engine available" + (where ? " at " + where : "") + "."
          : "No engine covers " + lang + "."
      });
    }
  }

  // build engines list — every plugin that covers >= 1 lang (rule 6: every
  // element carries the plugin id that provides it)
  var ids = Object.keys(engineSet);
  for (var ri = 0; ri < ids.length; ri++) {
    var ep = engineSet[ids[ri]];
    result.engines.push({
      id: ep.id,
      kind: ep.kind,
      title: ep.title || ep.id,
      states: ep.states || {},
      why: ep.capabilities_why || {}
    });
  }

  return result;
}

// ----------------------------------------------------------------- passageChoice
// The render.json keys a passage-scoped change writes (§7.3).
//   voice   the narrator voice name
//   voices  {<lang>: <voice name>}  per-language (a mixed book)
//   cast    {<speaker>: <voice name>}  (a play's cast)
// Returns an object with exactly those three keys.  The caller writes this
// through core/render.py — voiceui does not write the file.
function passageChoice(opts) {
  var o = opts || {};
  return {
    voice:  typeof o.voice === "string" && o.voice ? o.voice : null,
    voices: o.voices && typeof o.voices === "object" ? o.voices : {},
    cast:   o.cast && typeof o.cast === "object" ? o.cast : {}
  };
}

  return {
    COMPANIONS: COMPANIONS,
    RENDER_KEYS: RENDER_KEYS,
    PHONEME_LANGS: PHONEME_LANGS,
    readCatalogue: readCatalogue,
    q: q,
    passageChoice: passageChoice
  };
});
