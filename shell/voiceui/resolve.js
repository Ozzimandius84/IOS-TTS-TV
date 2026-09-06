// voiceui/resolve.js -- map a recognised (likely mangled) word back to a
// real word id. voiceui/README.md: "Match the recognised string by edit
// distance against the words of the current and previous sentence only
// (plus their phon where present), never the whole book." core/README.md's
// Word.phon section names this exact use: disambiguating homographs that
// read alike but sound different, for dead languages that carry phon tags.
//
// Pure function: takes plain word arrays ({id, text, phon?}), no book.json
// parsing, no reader coupling. app.js is responsible for slicing "current
// sentence" / "previous sentence" out of real book/timings data before
// calling this.
//
// UMD: module.exports under Node, or window.VoiceUI.resolve in the browser
// via a plain <script> tag -- see grammar.js's file header for why (no ES
// modules, no bundler; reader.html must stay file://-capable).
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.resolve = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function normalizedDistance(a, b) {
  const maxLen = Math.max(a.length, b.length, 1);
  return levenshtein(a, b) / maxLen;
}

// Fold everything a recogniser is free to invent and a reader never says
// aloud: case, accents, and every separator. Web Speech has no idea what
// `quietus`, `beech-canopy` or `shepherd's` are, so it returns the nearest
// thing in its own language model -- and that is nearly always the same
// letters with an English word boundary pushed into the middle of them
// ("quiet us", "far dells", "vouch safe", "tit or us"). Comparing letters
// only turns that whole class of mishearing from a two- or three-edit miss
// into an exact match, and costs nothing on the rest: `Word.text` is
// already normalised by parser/ (core/schema.py), so the only characters
// this removes from the book side are hyphens and apostrophes -- which are
// exactly the characters a listener cannot pronounce either.
// Measured on tests/fixtures/asr-mishearings.json -- see tune-threshold.js.
const STRIP_RE = /[^a-z0-9]+/g;
function normalizeForMatch(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(STRIP_RE, "");
}

// resolveWord(heard, currentWords, previousWords, opts) -> {id,text,distance} | null
// `threshold` is a normalised edit distance (0 = identical, 1 = totally
// unrelated); above it we don't guess -- caller should ask "which word?"
// per README, rather than silently answering about the wrong word.
//
// 0.5, not the 0.4 this shipped with: 0.4 was a guess (README §7 said so),
// and on the 60-case ASR fixture it refuses 13 transcripts a listener meant
// (47/60) where 0.5 refuses 2 (57/60) at the cost of one wrong word and no
// false positives at all. The whole sweep is in tests/tune-threshold.js and
// the chosen row is asserted in tests/resolve-fixture.test.js, so moving
// this number without re-running the fixture fails the suite.
// `normalize: false` restores the old letter-for-letter comparison (what
// the sweep's "raw" column measures); nothing in the running app uses it.
function resolveWord(heard, currentWords, previousWords = [], { threshold = 0.5, normalize = true } = {}) {
  if (!heard || typeof heard !== "string") return null;
  const fold = normalize ? normalizeForMatch : (s) => String(s).toLowerCase();
  const spoken = fold(heard);
  if (!spoken) return null;

  let best = null;
  const consider = (w, pool) => {
    const targets = [w.text];
    if (w.phon) targets.push(String(w.phon).replace(/^\/|\/$/g, ""));
    for (const target of targets) {
      const distance = normalizedDistance(spoken, fold(target));
      if (!best || distance < best.distance) {
        best = { id: w.id, text: w.text, distance, pool };
      }
    }
  };

  for (const w of currentWords) consider(w, "current");
  for (const w of previousWords) consider(w, "previous");

  if (!best || best.distance > threshold) return null;
  return { id: best.id, text: best.text, distance: best.distance };
}

  return { resolveWord, levenshtein, normalizedDistance, normalizeForMatch, DEFAULT_THRESHOLD: 0.5 };
});
