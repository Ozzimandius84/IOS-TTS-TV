// voiceui/answers.js -- one-sentence spoken answers from dictionary.json.
// dictionary.json's real, documented shape (core/README.md): keyed by
// surface text, value is dictionary.lookup()'s dict verbatim (lemma, pos,
// gloss, phon, etymology, related, links) plus, when the surface matched an
// inflected form, a nested `matched_form: {form, tags}` -- there is no
// top-level `tags` key. voiceui/README.md's own worked example --
// "*ging* is the third-person singular preterite of *gehen* -- 'to go'." --
// is exactly `matched_form.tags` + lemma + gloss[0], so this module is
// written against the real on-disk shape, not the prompt's shorthand
// "dictionary.json (lemma, pos, tags, gloss)" (there is no bare `tags`
// field to read -- see this module's report for the request that follows
// from that).
//
// Deliberately renders only the FIRST gloss sense: "Answers are one
// sentence. No conjugation tables read aloud" (voiceui prompt, Rules).
//
// UMD: module.exports under Node, or window.VoiceUI.answers in the browser
// via a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.answers = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

// Two words are the same word *to the ear* when only case, accents or
// punctuation separate them. That matters here because the tags frame
// ("X is the T of Y") is nonsense when X and Y sound identical: the real
// eclogues-en export answers `neath` with matched_form {form: "'neath",
// tags: ["alternative"]} and `a` with {form: "a", tags: ["lowercase"]}, so
// the frame produced "neath is the alternative of neath" and "a is the
// lowercase of A" -- true on a page, useless in an earpiece, and 118 of the
// 562 matched_form entries in that one book are this shape. Same fold as
// resolve.js's normalizeForMatch, deliberately duplicated rather than
// imported: these two modules have no dependency on each other and gain
// nothing from one.
function sameWordAloud(a, b) {
  const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  return fold(a) === fold(b) && fold(a) !== "";
}

function formatAnswer(entry, surfaceWord) {
  if (!entry || entry.error || !entry.lemma) {
    return `No dictionary entry for ${surfaceWord}.`;
  }
  // Wiktionary gloss senses already end in their own '.' -- strip it before
  // wrapping in quotes + a sentence-final period, or every answer would end
  // in a stray double stop ("... song.'.").
  const rawSense = entry.gloss && entry.gloss.length ? entry.gloss[0] : null;
  const sense = rawSense ? rawSense.replace(/\.+$/, "") : null;
  const tagList = entry.matched_form && entry.matched_form.tags && entry.matched_form.tags.length
    ? entry.matched_form.tags
    : null;
  // ... and drop the frame entirely when the lemma is the same word as the
  // one that was asked about (see sameWordAloud): the base-form answer below
  // is what a listener wanted anyway.
  const tags = tagList && !sameWordAloud(entry.lemma, surfaceWord) ? tagList.join(" ") : null;

  if (tags) {
    return sense
      ? `${surfaceWord} is the ${tags} of ${entry.lemma} — '${sense}'.`
      : `${surfaceWord} is the ${tags} of ${entry.lemma}.`;
  }
  if (sense) {
    return `${surfaceWord} is '${sense}'.`;
  }
  return `${entry.lemma} has no recorded sense yet.`;
}

  return { formatAnswer, sameWordAloud };
});
