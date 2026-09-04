// library/import.js -- a bundle .zip, opened in the page, becomes a book the
// installed reader can read with no network and no change to reader.html.
//
// The shape of the thing being imported (reader/tools/export_bundle.py): a
// bundle folder is self-contained -- it carries a copy of reader.html, the
// nine voiceui scripts, sidebar/settings/manifest/sw and the icons, so that
// double-clicking it on a laptop opens a working reader -- and beside those
// it carries the BOOK: book.json, timings/*.json, audio/*.opus,
// dictionary.json, and align.json / render.json when the book has them. A
// pair bundle puts one such book in each of two subfolders.
//
// **Only the book half is imported.** The shell copy inside the zip is
// ignored by name (PAYLOAD below is an allowlist, never "everything under
// the folder"): the installed app already has a reader, it is newer than the
// one frozen into any bundle on disk, and importing that copy would give the
// phone two readers with no way to tell which one it is running. So a bundle
// exported before ⌘F existed still imports, and the book it carries is read
// by today's reader.
//
// Where it goes. One Cache per book, named `ttstv-book-<slug>-<hash>`, where
// <hash> is core.provenance's own book hash -- sha256 of every word id in
// order, first 16 hex -- computed here, in the page, from the book.json that
// just arrived, by the same rule core/provenance.py uses. Two versions of a
// book therefore have two different cache names, which is the point: an
// import can tell "this exact book is already here" from "a newer parse of
// it is here", and the reader can never end up serving half of each.
// Entries are keyed by the URL the reader will actually ask for --
// `<shell>/books/<slug>/book.json` and so on -- so reader/sw.js answers them
// with a plain cache-first match and `reader.html` needs no change at all.
//
// Nothing here trusts the zip's filename. The slug is `book.json`'s own
// `id`, the version is the hash of its word ids; a bundle renamed on the way
// through AirDrop imports as exactly the same book.
"use strict";

const TTSTVBundle = (() => {
  const Unzip = (typeof require === "function" && typeof module !== "undefined")
    ? require("./unzip.js") : self.TTSTVUnzip;

  const CACHE_PREFIX = "ttstv-book-";           // kept in step with reader/sw.js
  // The ceiling this shell will import, and it is **6 on purpose** -- not a
  // stale copy of `core.schema.SCHEMA_VERSION`, which is 7. Do not "fix" it.
  //
  //  * Nothing on the shelf needs 7. The stamp decision (29 Aug 2026,
  //    core/README.md "The v6 -> v7 stamp gap") is that **no save raises a
  //    file's stamp**: v7 is the first bump that only takes a key's contents
  //    away, and taking away cannot raise a stamp. So every `book.json` that
  //    exists today is stamped 5 or 6 and imports; `core/schema.py::to_dict`
  //    names this constant in its own docstring as the thing a re-stamp would
  //    have broken.
  //  * A file that really does say 7 should be refused *here*. v7 moves the
  //    spans out to `books/<slug>/spans.json` -- which is not in `PAYLOAD`
  //    below, and which nothing in `reader.html` merges. Importing one would
  //    put a book on the phone with its attribution silently gone. The stamp
  //    is the only honest signal that this shell is behind the parser, and
  //    "update the app" is the true remedy.
  //  * It moves to 7 **in the same change** that adds `spans.json` to
  //    `PAYLOAD` and a merge to the reader, never before and never alone.
  //
  // It is a ceiling, not a v5/v6 whitelist: a v1..v4 book still imports,
  // because the schema is additive and `core` itself still loads one.
  const SCHEMA_MAX = 6;
  const AUDIO_EXTS = ["opus", "mp3", "m4a", "wav", "ogg"];   // reader.html's AUDIO_EXTS
  const TYPES = {
    json: "application/json", opus: "audio/ogg", ogg: "audio/ogg",
    mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  };
  // The book half of a bundle, by name. Everything else in the zip -- the
  // shell copy, dictionary/links.json, library.json, .DS_Store -- is counted
  // and dropped, never stored.
  // `grammar.json` (dictionary/grammar.py, 30 Aug) rides beside dictionary.json
  // and is keyed the same way, so tap-to-look-up on the phone shows what the
  // word IS and not only what it means. +0.13 MB gzipped on eclogues-la
  // against dictionary.json's 0.78. SCHEMA_MAX is untouched by it: this is a
  // new file beside the others, not a book.json version bump.
  const PAYLOAD = new Set(["book.json", "align.json", "render.json", "dictionary.json", "names.json", "grammar.json"]);
  const META_FILE = ".bundle.json";             // this module's own, never fetched by the reader

  function isPayload(rel) {
    if (PAYLOAD.has(rel)) return true;
    if (/^timings\/[^/]+\.json$/.test(rel)) return true;
    if (new RegExp("^audio/[^/]+\\.(" + AUDIO_EXTS.join("|") + ")$").test(rel)) return true;
    return false;
  }

  function cacheName(slug, hash) { return CACHE_PREFIX + slug + "-" + hash; }
  function parseCacheName(name) {
    if (!name.startsWith(CACHE_PREFIX)) return null;
    const rest = name.slice(CACHE_PREFIX.length);
    const cut = rest.lastIndexOf("-");
    if (cut <= 0) return null;
    return { slug: rest.slice(0, cut), hash: rest.slice(cut + 1) };
  }

  /** Where an imported book lives, as an absolute URL ending in "/".
   *  `reader.html?book=books/<slug>` resolves to exactly this (reader.html's
   *  normalizeBookPath prefixes a bare path with "../", and both pages sit in
   *  reader/), which is why nothing in reader.html has to change. */
  function booksBase(href) {
    return new URL("../books/", href || (typeof location !== "undefined" ? location.href : "http://localhost/reader/"));
  }
  function bookUrl(slug, rel, href) { return new URL(slug + "/" + rel, booksBase(href)).href; }

  // ------------------------------------------------------------ book.json
  /** Every word id in the book, in document order -- the sequence
   *  core/provenance.py hashes, and the walk that validates the shape. */
  function walkWordIds(book, errors) {
    const ids = [];
    const chapters = book.chapters;
    for (let ci = 0; ci < chapters.length; ci++) {
      const c = chapters[ci];
      if (!c || typeof c.id !== "string" || !Array.isArray(c.paragraphs)) {
        errors.push(`chapter ${ci} has no id or no paragraphs`); return ids;
      }
      for (const p of c.paragraphs) {
        if (!p || typeof p.id !== "string" || !Array.isArray(p.sentences)) {
          errors.push(`${c.id}: a paragraph has no id or no sentences`); return ids;
        }
        for (const s of p.sentences) {
          if (!s || typeof s.id !== "string" || !Array.isArray(s.words)) {
            errors.push(`${p.id}: a sentence has no id or no words`); return ids;
          }
          for (const w of s.words) {
            if (!w || typeof w.id !== "string" || typeof w.text !== "string" || typeof w.raw !== "string") {
              errors.push(`${s.id}: a word is missing id, text or raw`); return ids;
            }
            ids.push(w.id);
          }
        }
      }
    }
    return ids;
  }

  /** core's rules, applied in the page. The schema is additive by contract
   *  (core/README.md: "a v1..v5 book.json still loads"), so the version test
   *  is a CEILING, not a v5/v6 whitelist -- refusing a v4 book would refuse
   *  a book core itself loads. A version above what this shell knows is the
   *  one that is refused, and it is refused by name so the message can say
   *  "update the app", which is the true remedy. */
  function validateBook(obj) {
    const errors = [];
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, errors: ["book.json is not a JSON object"] };
    for (const k of ["id", "title", "author", "lang", "source", "chapters"]) {
      if (!(k in obj)) errors.push(`book.json has no "${k}" (core/schema.py Book.from_dict requires it)`);
    }
    if (typeof obj.id === "string" && !/^[a-z0-9][a-z0-9-]*$/.test(obj.id)) {
      errors.push(`"${obj.id}" is not a usable slug (lower-case letters, digits and hyphens)`);
    }
    const v = obj.schema_version === undefined ? 1 : obj.schema_version;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) errors.push(`schema_version ${JSON.stringify(obj.schema_version)} is not a version number`);
    else if (v > SCHEMA_MAX) errors.push(`book.json is schema_version ${v}; this reader knows up to ${SCHEMA_MAX} — update the app`);
    if (!Array.isArray(obj.chapters)) errors.push("chapters is not a list");
    else if (!obj.chapters.length) errors.push("the book has no chapters");
    if (errors.length) return { ok: false, errors };
    const ids = walkWordIds(obj, errors);
    if (errors.length) return { ok: false, errors };
    if (!ids.length) return { ok: false, errors: ["the book has no words"] };
    return { ok: true, errors: [], wordIds: ids, words: ids.length, chapters: obj.chapters.length };
  }

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  /** core/provenance.py book_word_id_hash, in the page: sha256 of the word
   *  ids joined by "|", first 16 hex characters. */
  async function bookHash(wordIds) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wordIds.join("|")));
    return hex(digest).slice(0, 16);
  }

  // --------------------------------------------------------------- the zip
  /** Group a zip's entries into books. Every `book.json` in the archive is a
   *  book (root for a single-book bundle, one per subfolder for a pair), and
   *  a file belongs to the nearest book.json above it. Returns the plan
   *  without reading a byte of content, so the Library can refuse a zip that
   *  holds no book before it spends a second on it. */
  function planBundle(entries) {
    const prefixes = entries
      .filter(e => e.name === "book.json" || e.name.endsWith("/book.json"))
      .map(e => e.name.slice(0, e.name.length - "book.json".length))
      .sort((a, b) => b.length - a.length);          // deepest first
    const books = prefixes.map(p => ({ prefix: p, files: new Map(), bytes: 0 }));
    const ignored = [];
    for (const e of entries) {
      const home = books.find(b => e.name.startsWith(b.prefix));
      const rel = home ? e.name.slice(home.prefix.length) : null;
      if (!home || !isPayload(rel)) { ignored.push(e.name); continue; }
      home.files.set(rel, e);
      home.bytes += e.size;
    }
    return { books, ignored };
  }

  function contentType(rel) {
    const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
    return TYPES[ext] || "application/octet-stream";
  }

  /** Read a bundle zip and store every book it holds. `onProgress({done,
   *  total, label, slug})` is called per file, so the Library can show the
   *  same greyed row + bar the bench uses for an ingest. Returns one report
   *  per book; a book that fails validation is reported with its reasons and
   *  nothing of it is written -- book.json is validated BEFORE any of its
   *  files are put, so a refused book never leaves a half-cache behind. */
  async function importZip(buffer, opts) {
    const o = opts || {};
    const onProgress = o.onProgress || (() => {});
    const href = o.href;
    const entries = Unzip.entries(buffer);
    const plan = planBundle(entries);
    if (!plan.books.length) throw new Error("no book.json in that .zip — is it a bundle from the bench?");
    const total = plan.books.reduce((n, b) => n + b.files.size, 0);
    let done = 0;
    const reports = [];

    for (const b of plan.books) {
      const bookEntry = b.files.get("book.json");
      onProgress({ done, total, label: "reading book.json", slug: null });
      let book;
      try {
        book = JSON.parse(new TextDecoder("utf-8").decode(await Unzip.read(buffer, bookEntry)));
      } catch (e) {
        reports.push({ ok: false, prefix: b.prefix, slug: null, errors: ["book.json could not be read: " + e.message] });
        done += b.files.size; continue;
      }
      const check = validateBook(book);
      if (!check.ok) {
        reports.push({ ok: false, prefix: b.prefix, slug: book && book.id || null, title: book && book.title || null, errors: check.errors });
        done += b.files.size; continue;
      }
      const slug = book.id;
      const hash = await bookHash(check.wordIds);
      const name = cacheName(slug, hash);
      const already = (await caches.keys()).filter(k => {
        const p = parseCacheName(k); return p && p.slug === slug;
      });
      const replaced = already.filter(k => k !== name);

      const cache = await caches.open(name);
      let bytes = 0, chaptersTimed = 0, chaptersVoiced = 0;
      for (const [rel, entry] of b.files) {
        onProgress({ done, total, label: rel, slug });
        const data = await Unzip.read(buffer, entry);
        await cache.put(bookUrl(slug, rel, href), new Response(data, {
          headers: { "Content-Type": contentType(rel), "Content-Length": String(data.length) },
        }));
        bytes += data.length;
        if (rel.startsWith("timings/")) chaptersTimed++;
        if (rel.startsWith("audio/")) chaptersVoiced++;
        done++;
      }
      const meta = {
        slug, hash, title: book.title, author: book.author || null, lang: book.lang,
        chapters: check.chapters, words: check.words, bytes,
        has_timings: chaptersTimed > 0, has_audio: chaptersVoiced > 0,
        chapters_timed: chaptersTimed, chapters_voiced: chaptersVoiced,
        has_dictionary: b.files.has("dictionary.json"),
        files: b.files.size, imported: Date.now(), schema_version: book.schema_version || 1,
      };
      await cache.put(bookUrl(slug, META_FILE, href), new Response(JSON.stringify(meta), {
        headers: { "Content-Type": "application/json" },
      }));
      // Only once the new cache is complete: a power cut mid-import leaves the
      // old book whole and the new one partial-but-unreferenced, never a slug
      // with no book behind it.
      for (const old of replaced) await caches.delete(old);
      reports.push({ ok: true, prefix: b.prefix, replaced, reimported: already.includes(name), ...meta });
    }
    return { books: reports, ignored: plan.ignored };
  }

  // ------------------------------------------------------------- the shelf
  /** What is on the device: one row per book cache, read from the little
   *  meta entry written at import rather than by re-parsing a 2 MB
   *  book.json every time the Library paints. */
  async function listInstalled(href) {
    const out = [];
    for (const name of await caches.keys()) {
      const parsed = parseCacheName(name);
      if (!parsed) continue;
      const cache = await caches.open(name);
      const res = await cache.match(bookUrl(parsed.slug, META_FILE, href));
      if (!res) { out.push({ slug: parsed.slug, hash: parsed.hash, title: parsed.slug, broken: true, bytes: 0, chapters: 0 }); continue; }
      out.push(await res.json());
    }
    out.sort((a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug)));
    return out;
  }

  /** Delete one book's cache and nothing else -- not the shell, not another
   *  book. Returns how many caches went (0 if it was not installed). */
  async function removeBook(slug) {
    let gone = 0;
    for (const name of await caches.keys()) {
      const parsed = parseCacheName(name);
      if (parsed && parsed.slug === slug) { if (await caches.delete(name)) gone++; }
    }
    return gone;
  }

  async function estimate() {
    if (typeof navigator === "undefined" || !navigator.storage || !navigator.storage.estimate) return null;
    try { return await navigator.storage.estimate(); } catch (e) { return null; }
  }

  function fmtBytes(n) {
    if (!isFinite(n) || n < 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0) + " MB";
    return (n / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  return {
    CACHE_PREFIX, SCHEMA_MAX, META_FILE, PAYLOAD, AUDIO_EXTS,
    isPayload, cacheName, parseCacheName, booksBase, bookUrl,
    validateBook, walkWordIds, bookHash, planBundle, contentType,
    importZip, listInstalled, removeBook, estimate, fmtBytes,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TTSTVBundle;
if (typeof self !== "undefined") self.TTSTVBundle = TTSTVBundle;
