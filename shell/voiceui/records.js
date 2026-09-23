// voiceui/records.js -- the book's own records, read once and read lazily.
// The assistant is the book speaking back (chat 106), so what it may say
// comes from `books/<slug>/`: `book.meta.json` (title, author, lang, the
// chapters and their titles, the word counts -- 4-20 KB), `names.json`
// (the cast), `grammar.json` (the per-word readings -- 0.25-2 MB, fetched on
// the first `grammar` and never before), `stitch.json` (how a mixed-language
// book pairs its paragraphs), and `book.json` ONLY when it is small: it is
// 96 MB on the Complete Works and 655 KB on `poems`, so it is read for its
// `form`/`meta.subjects`/`meta.contributors` only when `book.meta.json`
// says the book is under BOOK_JSON_MAX_WORDS (about 5 MB, the cap
// reader/listen.js uses for the same fallback).
//
// The slug is read the way reader.html reads it -- `book=` in the hash or
// the query -- and overridden by the `ttstv:cursor` event's own `slug` the
// moment book-nav.js announces one, so a book opened by the host after load
// is still the book the records are for. Nothing here reaches into
// reader.html's internals (`OPEN_BOOK` is that file's `let`; voiceui/
// reader-bridge.js says why not).
//
// `fetchJson` is injected (node tests hand it `fs`), and a fetch that fails
// -- a `file://` bundle has no fetch(), a record the parse never wrote --
// resolves null, once, and is not retried: a missing record is an answer
// ("I have no grammar for this book"), not an error.
//
// UMD: module.exports under Node, or window.VoiceUI.records in the browser.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.records = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

const BOOK_JSON_MAX_WORDS = 60000; // ~5 MB of book.json; listen.js caps at 5 MB

function slugFromLocation(loc) {
  if (!loc) return null;
  let m = /(?:^|[#&?])book=([^&]+)/.exec(loc.hash || "");
  if (!m) m = /(?:^|[?&])book=([^&]+)/.exec(loc.search || "");
  if (!m) return null;
  let v;
  try { v = decodeURIComponent(m[1]); } catch (e) { v = m[1]; }
  // the library and the app hand `books/<slug>` -- strip the prefix so the
  // base path (`../../books/`) is not doubled into `books/books%2F<slug>/`
  if (v && v.indexOf("books/") === 0) v = v.slice(6);
  return v || null;
}

function browserFetchJson(win) {
  return function (url) {
    if (!win || typeof win.fetch !== "function") return Promise.resolve(null);
    return win.fetch(url).then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
  };
}

// createRecords({slug, base, fetchJson}) -> the record doors
//   base      "../books/" by default (reader.html's own relative root)
//   slug      the book; may be changed later with setSlug()
function createRecords({ slug = null, base = "../books/", fetchJson, win, doc } = {}) {
  const get = fetchJson || browserFetchJson(win);
  let cur = slug;
  const cache = new Map(); // "<slug>/<file>" -> Promise<record|null>

  function url(s, file) { return base + encodeURIComponent(s) + "/" + file; }
  function load(s, file) {
    if (!s) return Promise.resolve(null);
    const key = s + "/" + file;
    if (!cache.has(key)) {
      cache.set(key, Promise.resolve().then(() => get(url(s, file))).catch(() => null).then((v) => (v && typeof v === "object" ? v : null)));
    }
    return cache.get(key);
  }

  function setSlug(s) { if (s && s !== cur) cur = s; return cur; }
  function slugNow() { return cur; }

  // the merged meta: book.meta.json, plus book.json's form/meta when small
  function meta(s = cur) {
    return load(s, "book.meta.json").then((m) => {
      if (!m) return null;
      const words = +m.words || 0;
      if (words && words > BOOK_JSON_MAX_WORDS) return Object.assign({ _bookJson: "skipped: " + words + " words" }, m);
      return load(s, "book.json").then((b) => {
        if (!b) return Object.assign({ _bookJson: "absent" }, m);
        const out = Object.assign({}, m);
        if (b.form && !out.form) out.form = b.form;
        if (b.meta && typeof b.meta === "object") out.meta = b.meta;
        if (!out.author && b.author) out.author = b.author;
        if (!out.title && b.title) out.title = b.title;
        out._bookJson = "read";
        return out;
      });
    });
  }
  function names(s = cur) { return load(s, "names.json"); }
  function grammar(s = cur) { return load(s, "grammar.json"); }
  function stitch(s = cur) { return load(s, "stitch.json"); }
  function spans(s = cur) { return load(s, "spans.json"); }

  // the language of a slug, from ITS book.meta.json (a stitched book names
  // its halves by slug in stitch.json a/b)
  const langs = new Map();
  function langOf(s) {
    if (!s) return null;
    return langs.has(s) ? langs.get(s) : null;
  }
  function learnLang(s) {
    if (!s || langs.has(s)) return Promise.resolve(langOf(s));
    return load(s, "book.meta.json").then((m) => { langs.set(s, (m && m.lang) || null); return langs.get(s); });
  }
  // the languages a book carries: its own, plus a stitched book's two halves
  function bookLangs(s = cur) {
    return Promise.all([meta(s), stitch(s)]).then(([m, st]) => {
      const set = [];
      const add = (l) => { if (l && !set.includes(l)) set.push(l); };
      if (m && m.lang) add(m.lang);
      if (st && st.a && st.b) {
        return Promise.all([learnLang(st.a), learnLang(st.b)]).then(([la, lb]) => { add(la); add(lb); return set; });
      }
      return set;
    });
  }
  // the language of the paragraph a word is in (stitched: by its half;
  // otherwise the book's)
  function langAt(wordId, s = cur) {
    return Promise.all([meta(s), stitch(s)]).then(([m, st]) => {
      if (st && st.paragraphs && wordId) {
        const pid = String(wordId).split(".").slice(0, 2).join(".");
        const row = st.paragraphs[pid];
        if (row && row.from) return learnLang(row.from);
      }
      return (m && m.lang) || null;
    });
  }
  // a stitched book has no grammar.json / names.json of its own: the word's
  // half has them. grammarAt(wordId) reads the record of the half the word
  // is in; namesAt() the first half that has one.
  function halfOf(wordId, s = cur) {
    return stitch(s).then((st) => {
      if (!st || !st.paragraphs) return null;
      if (wordId) {
        const pid = String(wordId).split(".").slice(0, 2).join(".");
        const row = st.paragraphs[pid];
        if (row && row.from) return row.from;
      }
      return st.a || null;
    });
  }
  function grammarAt(wordId, s = cur) {
    return grammar(s).then((g) => g || halfOf(wordId, s).then((h) => (h ? grammar(h) : null)));
  }
  function namesAt(s = cur) {
    return names(s).then((n) => n || stitch(s).then((st) => {
      if (!st) return null;
      return names(st.a).then((na) => na || (st.b ? names(st.b) : null));
    }));
  }
  function chapterOf(chapterId, s = cur) {
    return meta(s).then((m) => {
      const list = (m && Array.isArray(m.chapters)) ? m.chapters : [];
      const i = list.findIndex((c) => c && c.id === chapterId);
      return { index: i, count: list.length, chapter: i >= 0 ? list[i] : null };
    });
  }

  return { setSlug, slugNow, meta, names, grammar, stitch, spans, langOf, learnLang, bookLangs, langAt, chapterOf,
           halfOf, grammarAt, namesAt, load, _cache: cache };
}

// a fetchJson over the filesystem, for node tests and the CLI
function fsFetchJson(fs, pathMod, root) {
  return function (url) {
    // url is "<base><slug>/<file>" -- take the tail two segments
    const parts = String(url).split("/").filter(Boolean);
    const file = parts.pop();
    let slug = parts.pop() || "";
    try { slug = decodeURIComponent(slug); } catch (e) { /* as is */ }
    const p = pathMod.join(root, slug, file);
    try { return Promise.resolve(JSON.parse(fs.readFileSync(p, "utf8"))); } catch (e) { return Promise.resolve(null); }
  };
}

  return { createRecords, slugFromLocation, fsFetchJson, BOOK_JSON_MAX_WORDS };
});
