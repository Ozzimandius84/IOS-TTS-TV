// voiceui/context.js -- THE CONTEXT PACKET (chat 106, Stage 2.1): what the
// assistant knows when an open question is asked. "I could say 'what is the
// good?' inside a dialogue and it could tell me what it might mean, pretty
// hands off." Whatever model answers that (Stage 2.2 -- Osca's pick) gets
// THIS and nothing else: the sentence the reader is on and its neighbours,
// in both languages of a pair; the word under the cursor with its gloss and
// grammar; the chapter's title and the book's meta; the last two questions.
// A few kB, built from the records on disk, no network.
//
// Two functions. `build(doors)` gathers, and returns a plain object a test
// can measure (`JSON.stringify(packet).length`). `render(packet, question,
// lang)` turns it into the one prompt string a model is given, with the
// rules the answer must keep: answer in the packet's language, from the
// passage, in the book's own voice, one paragraph, and say "I don't know"
// rather than invent. Neither function knows which model, if any, exists.
//
// UMD: module.exports under Node, or window.VoiceUI.context in the browser.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.context = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

const MAX_SENTENCE_CHARS = 600;   // a neighbour longer than this is cut, with an ellipsis
const MAX_GLOSSES = 2;
const MAX_READINGS = 3;
const KEEP_QUESTIONS = 2;
const TARGET_BYTES = 4096;        // "small (a few kB)" -- the test measures against this

function clip(s, n = MAX_SENTENCE_CHARS) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
function textOfWords(words) {
  return Array.isArray(words) ? words.map((w) => (w && w.text) || "").filter(Boolean).join(" ") : "";
}

// the dictionary entry, cut to what a model needs: lemma, pos, the first
// two senses, the matched form's tags
function glossOf(entry) {
  if (!entry || entry.error || !entry.lemma) return null;
  const out = { lemma: entry.lemma };
  if (entry.pos) out.pos = entry.pos;
  if (Array.isArray(entry.gloss) && entry.gloss.length) out.senses = entry.gloss.slice(0, MAX_GLOSSES).map((g) => clip(g, 160));
  if (entry.matched_form && Array.isArray(entry.matched_form.tags) && entry.matched_form.tags.length) out.form = entry.matched_form.tags.join(" ");
  return out;
}
// the grammar row, cut to its readings
function grammarOf(entry) {
  if (!entry || !Array.isArray(entry.readings) || !entry.readings.length) return null;
  const rows = entry.readings.slice(0, MAX_READINGS).map((r) => {
    const o = {};
    for (const k of ["lemma", "person", "number", "gender", "case", "tense", "voice", "mood", "nonfinite", "degree"]) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== "") o[k] = Array.isArray(r[k]) ? r[k].join("/") : r[k];
    }
    return o;
  });
  return { certain: !!entry.certain, readings: rows };
}

// build(doors) -> packet
// doors (every one optional; a missing door leaves its field out):
//   book           {slug, title, author, lang, form}
//   chapter        {index, count, title}
//   position       {wordId, sentenceId, text, fraction, lang}
//   sentences      {words(id) -> [{id,text}], prev(id) -> id|null, next(id) -> id|null}
//   paired         {lang, text}  the same passage in the pair's other language
//   dictionary     (text) -> entry|null      (getDictionaryEntry)
//   grammar        (text) -> row|null        (grammarEntry over grammar.json)
//   history        [{q, a}]                  the last questions, newest last
async function build(doors = {}) {
  const p = {};
  if (doors.book) {
    const b = doors.book;
    p.book = {};
    for (const k of ["title", "author", "lang", "form", "slug"]) if (b[k]) p.book[k] = b[k];
  }
  if (doors.chapter && doors.chapter.count > 0) {
    p.chapter = { n: (doors.chapter.index | 0) + 1, of: doors.chapter.count };
    if (doors.chapter.title) p.chapter.title = clip(doors.chapter.title, 120);
  }
  const pos = doors.position || null;
  if (pos) {
    p.position = {};
    if (pos.wordId) p.position.wordId = pos.wordId;
    if (pos.text) p.position.word = pos.text;
    if (typeof pos.fraction === "number" && isFinite(pos.fraction)) p.position.fraction = Math.round(pos.fraction * 100) / 100;
    if (pos.lang) p.position.lang = pos.lang;
  }
  const S = doors.sentences;
  if (S && pos && pos.sentenceId && typeof S.words === "function") {
    const here = textOfWords(S.words(pos.sentenceId));
    const prevId = typeof S.prev === "function" ? S.prev(pos.sentenceId) : null;
    const nextId = typeof S.next === "function" ? S.next(pos.sentenceId) : null;
    p.passage = {};
    if (prevId) p.passage.before = clip(textOfWords(S.words(prevId)));
    if (here) p.passage.here = clip(here);
    if (nextId) p.passage.after = clip(textOfWords(S.words(nextId)));
    if (!Object.keys(p.passage).length) delete p.passage;
  }
  if (doors.paired && doors.paired.text) {
    p.paired = { lang: doors.paired.lang || null, text: clip(doors.paired.text, MAX_SENTENCE_CHARS * 2) };
  }
  if (pos && pos.text) {
    const w = { text: pos.text };
    try { const g = doors.dictionary ? glossOf(await doors.dictionary(pos.text)) : null; if (g) w.gloss = g; } catch (e) { /* no gloss */ }
    try { const r = doors.grammar ? grammarOf(await doors.grammar(pos.text)) : null; if (r) w.grammar = r; } catch (e) { /* no grammar */ }
    p.word = w;
  }
  if (Array.isArray(doors.history) && doors.history.length) {
    p.history = doors.history.slice(-KEEP_QUESTIONS).map((h) => ({ q: clip(h.q, 200), a: clip(h.a, 300) }));
  }
  return p;
}

function bytes(packet) {
  const s = JSON.stringify(packet);
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : Buffer.byteLength(s, "utf8");
}

// the language the answer must come back in: the question's, which is the
// recogniser's, which is the book's (position.lang on a pair, else the book)
function answerLang(packet, lang) {
  return lang || (packet.position && packet.position.lang) || (packet.book && packet.book.lang) || "en";
}

const LANG_LABEL = { en: "English", fr: "French", de: "German", la: "Latin", grc: "Ancient Greek", el: "Greek", sa: "Sanskrit", zh: "Chinese", it: "Italian", es: "Spanish" };

// render(packet, question, lang) -> the prompt. One string, plain text,
// sections in a fixed order, the rules last so a small model sees them
// closest to the question.
function render(packet, question, lang) {
  const L = answerLang(packet, lang);
  const lines = [];
  if (packet.book) {
    const b = packet.book;
    lines.push("BOOK: " + [b.title, b.author ? "by " + b.author : null, b.form || null, b.lang ? "(" + (LANG_LABEL[b.lang] || b.lang) + ")" : null].filter(Boolean).join(", "));
  }
  if (packet.chapter) lines.push("CHAPTER: " + packet.chapter.n + " of " + packet.chapter.of + (packet.chapter.title ? " — " + packet.chapter.title : ""));
  if (packet.passage) {
    lines.push("PASSAGE (the reader is in the middle sentence):");
    if (packet.passage.before) lines.push("  " + packet.passage.before);
    if (packet.passage.here) lines.push("> " + packet.passage.here);
    if (packet.passage.after) lines.push("  " + packet.passage.after);
  }
  if (packet.paired) lines.push("THE SAME PASSAGE IN " + (LANG_LABEL[packet.paired.lang] || packet.paired.lang || "the other language").toUpperCase() + ":\n  " + packet.paired.text);
  if (packet.word) {
    const w = packet.word;
    let s = "WORD UNDER THE CURSOR: " + w.text;
    if (w.gloss) s += " — " + [w.gloss.lemma, w.gloss.pos, w.gloss.form, w.gloss.senses ? "'" + w.gloss.senses.join("'; '") + "'" : null].filter(Boolean).join(", ");
    if (w.grammar) s += " — " + w.grammar.readings.map((r) => Object.keys(r).filter((k) => k !== "lemma").map((k) => r[k]).join(" ") + (r.lemma ? " of " + r.lemma : "")).join("; or ") + (w.grammar.certain ? "" : " (uncertain)");
    lines.push(s);
  }
  if (packet.history && packet.history.length) {
    lines.push("EARLIER:");
    for (const h of packet.history) lines.push("  Q: " + h.q + "\n  A: " + h.a);
  }
  lines.push("");
  lines.push("QUESTION: " + String(question || "").trim());
  lines.push("");
  lines.push("Answer in " + (LANG_LABEL[L] || L) + ", in one short paragraph, as this book would answer — from the passage above and what it says, not from outside it. If the passage does not say, say that you do not know. Do not describe the book; speak from it. No lists, no headings.");
  return lines.join("\n");
}

  return { build, render, bytes, answerLang, glossOf, grammarOf, clip, TARGET_BYTES, MAX_SENTENCE_CHARS, KEEP_QUESTIONS, LANG_LABEL };
});
