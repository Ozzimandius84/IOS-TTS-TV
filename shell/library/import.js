// library/import.js -- a bundle .zip, opened in the page, becomes a book the
// installed reader can read with no network and no change to reader.html.
//
// The shape of the thing being imported (reader/tools/export_bundle.py): a
// bundle folder is self-contained -- it carries a copy of reader.html, the
// nine voiceui scripts, sidebar/settings/manifest/sw and the icons, so that
// double-clicking it on a laptop opens a working reader -- and beside those
// it carries the BOOK: book-data.js, chapters/*.txt, book.json,
// timings/*.json, audio/*.opus, dictionary.json, and align.json /
// render.json / spans.json when the book has them. A pair bundle puts one
// such book in each of two subfolders.
//
// **book-data.js and chapters/*.txt are the two that make the book OPEN**
// (6 Sep, with the export side of the same change). reader.html opens a book
// by injecting `<script src="../books/<slug>/book-data.js">` -- `file://`
// has no `fetch()` -- and `listen.js` rebuilds the word map per chapter from
// `chapters/<cid>.txt` (the text, no ids) and `timings/<cid>.json` (the ids,
// no text), never from book.json. So the cache written here has to answer
// both, or the phone gets a Library row that opens on nothing. book.json is
// still imported and is still the thing HASHED below: it is the only file
// that carries every word id, which is what a version is here, and it is
// listen.js's capped fallback for a book with no chapters/.
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
// **That is the Cache store, and since 11 Sep it is one of two** (G-PULL,
// "the store", below). On the phone the shell is `frank://localhost/`, the
// Cache API refuses every non-http(s) URL, and the book goes to the host's
// door instead -- files on disk under the app's data folder, answered at the
// very same `frank://localhost/books/<slug>/...` URLs by Frank's own handler.
// Which store is decided by the host, once; every other line here is the
// same for both.
//
// Nothing here trusts the zip's filename. The slug is `book.json`'s own
// `id`, the version is the hash of its word ids; a bundle renamed on the way
// through AirDrop imports as exactly the same book.
"use strict";

const TTSTVBundle = (() => {
  const Unzip = (typeof require === "function" && typeof module !== "undefined")
    ? require("./unzip.js") : self.TTSTVUnzip;

  const CACHE_PREFIX = "ttstv-book-";           // kept in step with reader/sw.js
  // The ceiling this shell will import. **7 since 6 September 2026**, and the
  // sentence that used to stand here is the one it replaces.
  //
  // It said: 7 arrives "in the same change that adds `spans.json` to PAYLOAD
  // and a merge to the reader, never before and never alone" -- because v7
  // moves the word-level attribution OUT of `book.json` into
  // `books/<slug>/spans.json`, and importing a v7 book without it would put a
  // book on the phone with its attribution silently gone.
  //
  // **That was wrong about who reads the spans.** Osca, 6 Sep 2026:
  // *"spans.json is attrib/'s output for voice/'s render -- the reading page
  // never reads it, so 7 is additive for the phone."* Measured against the
  // tree on the day: no file in `reader/` or `library/` fetches it,
  // `core/bookdata.py` does not project it into `book-data.js` (which is what
  // the page actually draws from), and `core/schema.py::to_dict` writes
  // `"spans": []` on every paragraph at v7 -- so a reader expecting the field
  // finds it, empty. There is no merge to write. There was nothing for the
  // bump to wait for.
  //
  // What it was really holding up was the shelf. A reparse raised **29 of the
  // 31 books in `books/` to 7**, and at 6 this shell refused every one of them
  // by name -- "update the app", said about books the app reads perfectly.
  //
  // `spans.json` rides in `PAYLOAD` on grammar.json's terms and one more:
  // **OPTIONAL, and nothing merges it.** Bundled when the book folder has one,
  // absent when it does not, cached beside the rest, reported as `has_spans`
  // on the row -- carried so a phone can hand a whole book back to a bench or
  // to `voice/` without a round trip to the parse, never because the page
  // wants it. If a future reader ever DOES read a span, that is the change
  // that writes the merge, and it is not this one.
  //
  // Still a ceiling, not a whitelist: a v1..v6 book imports, because the
  // schema is additive by contract and `core` itself still loads one. A book
  // stamped 8 is refused by name and told "update the app", which is the true
  // remedy -- and that bump gets this comment's question again first: does the
  // READING PAGE need what it moved?
  const SCHEMA_MAX = 7;
  const AUDIO_EXTS = ["opus", "mp3", "m4a", "wav", "ogg"];   // reader.html's AUDIO_EXTS
  // Every payload extension gets a real type. `js` and `txt` arrived with
  // book-data.js and chapters/*.txt: the first is loaded by a `<script src>`
  // and the second read with `.text()`, and "application/octet-stream" is
  // the answer that would break both -- a script served as a byte stream is
  // refused outright under `nosniff`, and a chapter of the Greek Iliad
  // decoded without a stated charset is mojibake. The reader never sees a
  // network hop for these; sw.js hands back exactly the Response put here.
  const TYPES = {
    json: "application/json", js: "text/javascript",
    txt: "text/plain; charset=utf-8",
    opus: "audio/ogg", ogg: "audio/ogg",
    mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
    jpg: "image/jpeg",
  };
  // The book half of a bundle, by name. Everything else in the zip -- the
  // shell copy, dictionary/links.json, library.json, .DS_Store -- is counted
  // and dropped, never stored.
  // `grammar.json` (dictionary/grammar.py, 30 Aug) rides beside dictionary.json
  // and is keyed the same way, so tap-to-look-up on the phone shows what the
  // word IS and not only what it means. +0.13 MB gzipped on eclogues-la
  // against dictionary.json's 0.78. SCHEMA_MAX is untouched by it: this is a
  // new file beside the others, not a book.json version bump.
  // `book-data.js` (6 Sep) is the same kind of arrival as grammar.json --
  // a new file beside the others, not a book.json version bump, so
  // SCHEMA_MAX does not move with it. It is the one file whose absence is
  // fatal rather than degrading: without grammar.json a word has no parse,
  // without dictionary.json it has no gloss, without book-data.js there is
  // no page at all.
  // `spans.json` (6 Sep) is the one entry here that NOTHING READS. It is
  // `attrib/`'s output, an input to `voice/`'s render, and the reading page
  // has never fetched it; it is in the allowlist so a book on a phone is a
  // whole book -- see SCHEMA_MAX above for the decision and its date.
  // `cover.jpg` (G-COVERS, 11 Sep) is the picture the source carried --
  // `parser/cover.py` writes it FROM THE FILE OR NOT AT ALL, so its absence is
  // the signal the Library draws the typeset cover by, and it is OPTIONAL here
  // on exactly those terms: stored when the book has one, reported as
  // `has_cover` on the row, never asked for when it has not. It is not a
  // version of the book: the hash below is the word ids' and a cover changes
  // none of them, so a cover arriving later is the same book at the same
  // hash. Osca's screenshot (17:34) is why it is here -- every book on the
  // phone a white slab, because no picture had ever been sent.
  // `dictionary.json` LEFT this list on 11 Sep (G-LANG, Osca: dictionaries on
  // the phone are per LANGUAGE, never per book -- "that will only land up with
  // duplications"). It was 438 MB of Drive/Frank's ~900 for 28 books, the
  // same words again in every book of a language. The phone now adds a whole
  // language once (Settings > Languages, `library/langs.js`) and looks a word
  // up through the app (`TTSTVHost.dict`, reader/lookup.js). A zip that still
  // carries one has it counted and dropped like any other stranger.
  // `book.meta.json` (G-DIET, 13 Sep) is the SLIM META -- `studio/sync.py::
  // meta_of` writes it off book.json: title, author, lang, source, hash,
  // words, the chapter list, first_words, form, structure, and not one
  // paragraph. It is what a SYNCED book validates and shelves by; `book.json`
  // itself left Studio's manifest with this line (425.8 MB across 37 books,
  // and the reader never read a byte of it -- `book-data.js` is the page,
  // `chapters/*.txt` + `timings/*.json` are the word map). book.json STAYS on
  // this list because a bundle ZIP still carries it: `importBook` takes
  // whichever of the two a door hands it, meta first.
  const PAYLOAD = new Set(["book.meta.json", "book.json", "book-data.js", "align.json", "render.json",
                           "names.json", "grammar.json", "spans.json",
                           "cover.jpg"]);
  const BOOK_FILE = "book.json";
  const META_BOOK_FILE = "book.meta.json";
  // The slim meta's shape version, the same kind of ceiling SCHEMA_MAX is:
  // a meta written by a newer Studio than this shell knows is refused by
  // name, so the message can say "update the app".
  const META_MAX = 1;
  const META_FILE = ".bundle.json";             // this module's own, never fetched by the reader

  /** Which of the two book files a door has handed us, meta first. `null`
   *  when neither is there -- the one refusal that costs no request. */
  function bookFileOf(files) {
    if (files && typeof files.has === "function") {
      if (files.has(META_BOOK_FILE)) return META_BOOK_FILE;
      if (files.has(BOOK_FILE)) return BOOK_FILE;
      return null;
    }
    var rels = files || [];
    if (rels.indexOf(META_BOOK_FILE) >= 0) return META_BOOK_FILE;
    if (rels.indexOf(BOOK_FILE) >= 0) return BOOK_FILE;
    return null;
  }

  function isPayload(rel) {
    if (PAYLOAD.has(rel)) return true;
    if (/^timings\/[^/]+\.json$/.test(rel)) return true;
    // chapters/<cid>.txt -- half the word map, and it travels by the same
    // one-level-deep rule as timings/, for the same reason: the reader asks
    // for exactly `books/<slug>/chapters/<cid>.txt` and nothing nested.
    if (/^chapters\/[^/]+\.txt$/.test(rel)) return true;
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

  // ------------------------------------------------------------ the store
  /** WHERE A BOOK IS KEPT: one seam, two stores (G-PULL, Osca, 11 Sep 2026).
   *
   *  The Cache API was the only store until the phone's first real pull. On
   *  the real iPhone the Sync press read Drive's `library.json` (26 rows),
   *  said `Pulling 1 of 26 · Les Pensées · 0/31`, and failed on the first
   *  byte of the first file, every press. Frank serves the shell at
   *  `frank://localhost/` (wry's custom scheme on WKWebView), and `Cache.put`
   *  refuses any request whose scheme is not http or https -- the Service
   *  Workers spec's own put() step ("return a promise rejected with a
   *  TypeError"), in WebKit's words `Request url is not HTTP/HTTPS`
   *  (DOMCache.cpp, requestFromInfo). `caches.keys()` and `match()` do NOT
   *  throw -- WebKit answers a bad-scheme match with "no match" -- which is
   *  exactly why `listInstalled` passed and the first `put` did not. And a
   *  Cache there would be useless even if it took the bytes: nothing reads
   *  it. A service worker needs http(s) as well, and on the phone
   *  `frank://localhost/books/...` is answered by the crate's own handler,
   *  off disk (the phone repo's `src-tauri/src/lib.rs`).
   *
   *  So there are two stores behind four verbs, and `importBook`,
   *  `listInstalled` and `removeBook` call the store and nothing else --
   *  nothing outside this block names `caches`:
   *
   *    put(slug, hash, rel, bytes, contentType)   one file of one version
   *    meta(slug, hash, metaObj) -> [replaced]    the row the shelf shows,
   *                                               written LAST: it is the
   *                                               commit, and an older
   *                                               version goes only now
   *    list()   -> [row]                          what is on this device
   *    remove(slug) -> n                          every version of the slug
   *
   *  `CacheStore` is the code that stood in importBook/listInstalled/
   *  removeBook until today, moved and not rewritten: one Cache per version,
   *  entries under the URLs the reader asks for, the meta entry, the older
   *  caches of the slug dropped once the new one is complete. `HostStore`
   *  hands the same four calls to `TTSTVHost.books` -- the phone's door,
   *  which writes `<app data>/books/<slug>/<rel>` and serves it back at the
   *  same URL. Which one is decided ONCE, when this file loads, by whether
   *  the host offers a door (the phone injects it before any page script
   *  runs); the PWA and the Mac's pages have none and keep the Cache. */
  function hostDoor() {
    const h = typeof globalThis !== "undefined" ? globalThis.TTSTVHost : undefined;
    const d = h && h.books;
    return (d && typeof d.put === "function" && typeof d.meta === "function"
      && typeof d.list === "function" && typeof d.remove === "function") ? d : null;
  }
  const DOOR = hostDoor();
  let forced = null;              // a test's store (useStore), else the host decides

  function CacheStore(href) {
    return {
      kind: "cache",
      async put(slug, hash, rel, bytes, type) {
        const cache = await caches.open(cacheName(slug, hash));
        await cache.put(bookUrl(slug, rel, href), new Response(bytes, {
          headers: { "Content-Type": type, "Content-Length": String(bytes.length) },
        }));
      },
      async meta(slug, hash, meta) {
        const name = cacheName(slug, hash);
        const cache = await caches.open(name);
        await cache.put(bookUrl(slug, META_FILE, href), new Response(JSON.stringify(meta), {
          headers: { "Content-Type": "application/json" },
        }));
        // Only once the new cache is complete: a power cut mid-import leaves
        // the old book whole and the new one partial-but-unreferenced, never
        // a slug with no book behind it.
        const replaced = [];
        for (const k of await caches.keys()) {
          const p = parseCacheName(k);
          if (!p || p.slug !== slug || k === name) continue;
          await caches.delete(k);
          replaced.push(k);
        }
        return replaced;
      },
      async list() {
        const out = [];
        for (const name of await caches.keys()) {
          const parsed = parseCacheName(name);
          if (!parsed) continue;
          const cache = await caches.open(name);
          const res = await cache.match(bookUrl(parsed.slug, META_FILE, href));
          if (!res) { out.push({ slug: parsed.slug, hash: parsed.hash, title: parsed.slug, broken: true, bytes: 0, chapters: 0 }); continue; }
          out.push(await res.json());
        }
        return out;
      },
      async remove(slug) {
        let gone = 0;
        for (const name of await caches.keys()) {
          const parsed = parseCacheName(name);
          if (parsed && parsed.slug === slug) { if (await caches.delete(name)) gone++; }
        }
        return gone;
      },
    };
  }

  /** The phone's door (`TTSTVHost.books`, lib.rs `BOOKS_JS`): `put` sends
   *  the bytes as the raw IPC body, `meta` commits the version (the host
   *  swaps the finished folder in and says which older version it took
   *  out), `list` reads every `.meta.json`, `remove` takes the slug's folder.
   *  The content type is not sent: the handler that serves the file back
   *  types it by its extension, as it types every file of the shell. */
  function HostStore(door) {
    return {
      kind: "host",
      put: (slug, hash, rel, bytes) => Promise.resolve(door.put(slug, hash, rel, bytes)),
      meta: (slug, hash, meta) => Promise.resolve(door.meta(slug, hash, meta))
        .then(r => (Array.isArray(r) ? r : [])),
      list: () => Promise.resolve(door.list()).then(rows => (Array.isArray(rows) ? rows : [])),
      remove: slug => Promise.resolve(door.remove(slug)).then(n => Number(n) || 0),
    };
  }

  /** The store for one call. A CacheStore is bound to the page's href
   *  because its keys are URLs; the host's is not. */
  function storeFor(href) {
    if (forced) return forced;
    return DOOR ? HostStore(DOOR) : CacheStore(href);
  }
  /** Tests only: put a store in front of the host's choice, or `null` to go
   *  back to it. */
  function useStore(s) { forced = s || null; return forced; }

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

  /** THE SLIM META'S OWN VALIDATION (G-DIET, 13 Sep). `validateBook` proves a
   *  parse tree; there is no tree here, so what is proved is different and
   *  smaller: the same six core keys, the same schema ceiling, plus the two
   *  facts the tree used to yield -- `hash` (the sixteen hex characters
   *  `core/provenance.py::book_word_id_hash` computes and `bookHash`
   *  recomputed in the page) and `words`. The hash is now Studio's answer
   *  rather than the page's, and that is the trade this file is making: the
   *  page cannot re-derive a number from a tree it no longer receives. It is
   *  the same number by construction -- `studio/sync.py::book_hash` is
   *  provenance's own walk -- and a wrong one costs a cache under the wrong
   *  name, never a wrong book: the bytes stored are the bytes sent.
   *
   *  `chapters` is the chapter list's length, which is what the row shows. */
  function validateMeta(obj) {
    const errors = [];
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, errors: ["book.meta.json is not a JSON object"] };
    const mv = obj.meta_version === undefined ? 1 : obj.meta_version;
    if (typeof mv !== "number" || !Number.isInteger(mv) || mv < 1) errors.push(`meta_version ${JSON.stringify(obj.meta_version)} is not a version number`);
    else if (mv > META_MAX) errors.push(`book.meta.json is meta_version ${mv}; this reader knows up to ${META_MAX} — update the app`);
    for (const k of ["id", "title", "author", "lang", "source", "chapters"]) {
      if (!(k in obj)) errors.push(`book.meta.json has no "${k}" (studio/sync.py meta_of writes it)`);
    }
    if (typeof obj.id === "string" && !/^[a-z0-9][a-z0-9-]*$/.test(obj.id)) {
      errors.push(`"${obj.id}" is not a usable slug (lower-case letters, digits and hyphens)`);
    }
    const v = obj.schema_version === undefined ? 1 : obj.schema_version;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) errors.push(`schema_version ${JSON.stringify(obj.schema_version)} is not a version number`);
    else if (v > SCHEMA_MAX) errors.push(`book.json is schema_version ${v}; this reader knows up to ${SCHEMA_MAX} — update the app`);
    if (!Array.isArray(obj.chapters)) errors.push("chapters is not a list");
    else if (!obj.chapters.length) errors.push("the book has no chapters");
    if (typeof obj.hash !== "string" || !/^[0-9a-f]{16}$/.test(obj.hash)) errors.push("book.meta.json has no usable hash");
    if (typeof obj.words !== "number" || !Number.isInteger(obj.words) || obj.words < 1) errors.push("the book has no words");
    if (errors.length) return { ok: false, errors };
    return { ok: true, errors: [], hash: obj.hash, words: obj.words, chapters: obj.chapters.length };
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

  /** ONE STORE STEP, TWO DOORS (job 26, 6 Sep). `importBook` is what puts a
   *  book in its cache: validate book.json BEFORE a byte is stored, hash the
   *  word ids, open `ttstv-book-<slug>-<hash>`, put every payload file under
   *  the URL the reader will ask for, write the meta entry, then and only
   *  then drop the older caches of the same slug. `importZip` reaches it
   *  with a zip's entries and `Unzip.read`; `importFiles` -- the Sync
   *  button's pull -- reaches it with a list of rels and a fetch. Same
   *  function, same cache names, same headers, same meta: a synced book and
   *  a zip-imported book are the same bytes in the same place, and the
   *  Library cannot tell which door a book came through.
   *
   *  `files` is a Map of rel -> entry (whatever `read(entry)` needs);
   *  `read(entry)` resolves to a Uint8Array. `prefix` is only for the
   *  report. `count` is {done, total} shared across the books of one call
   *  so the progress line counts files, not books. */
  async function importBook(prefix, files, read, o, count) {
    const onProgress = o.onProgress || (() => {});
    const href = o.href;
    // WHICH BOOK FILE (G-DIET, 13 Sep). A synced book arrives with
    // `book.meta.json` and no parse tree; a zip from the bench still carries
    // `book.json`. Both doors land here, and the difference is exactly two
    // lines: which file is read, and where the hash comes from -- the meta's
    // own (Studio computed it with `core/provenance.py`'s walk) or this
    // page's, off the tree it was handed. Everything after is identical.
    const bookName = bookFileOf(files);
    if (!bookName) {
      count.done += files.size;
      return { ok: false, prefix, slug: null, errors: ["no book.meta.json and no book.json"] };
    }
    const bookEntry = files.get(bookName);
    onProgress({ done: count.done, total: count.total, label: "reading " + bookName, slug: null });
    let book, bookBytes;
    try {
      bookBytes = await read(bookEntry);
      book = JSON.parse(new TextDecoder("utf-8").decode(bookBytes));
    } catch (e) {
      count.done += files.size;
      return { ok: false, prefix, slug: null, errors: [bookName + " could not be read: " + e.message] };
    }
    const slim = bookName === META_BOOK_FILE;
    const check = slim ? validateMeta(book) : validateBook(book);
    if (!check.ok) {
      count.done += files.size;
      return { ok: false, prefix, slug: book && book.id || null, title: book && book.title || null, errors: check.errors };
    }
    const slug = book.id;
    const hash = slim ? check.hash : await bookHash(check.wordIds);
    const store = storeFor(href);
    // "this exact book is already here" -- a version of the slug with this
    // hash, finished or not (a Cache with no meta entry is listed, broken)
    const reimported = (await store.list()).some(b => b && b.slug === slug && b.hash === hash);

    let bytes = 0, chaptersTimed = 0, chaptersVoiced = 0, chaptersTexted = 0;
    for (const [rel, entry] of files) {
      onProgress({ done: count.done, total: count.total, label: rel, slug });
      // book.json was read once already, to validate: the same bytes are
      // stored, not a second read of them (one request fewer over the wire)
      const data = entry === bookEntry ? bookBytes : await read(entry);
      await store.put(slug, hash, rel, data, contentType(rel));
      bytes += data.length;
      if (rel.startsWith("timings/")) chaptersTimed++;
      if (rel.startsWith("audio/")) chaptersVoiced++;
      if (rel.startsWith("chapters/")) chaptersTexted++;
      count.done++;
    }
    const meta = {
      slug, hash, title: book.title, author: book.author || null, lang: book.lang,
      chapters: check.chapters, words: check.words, bytes,
      has_timings: chaptersTimed > 0, has_audio: chaptersVoiced > 0,
      chapters_timed: chaptersTimed, chapters_voiced: chaptersVoiced,
      chapters_texted: chaptersTexted,
      // The row's own honesty. `has_book_data` false means this book is on
      // the device and will not open -- an old bundle, exported before
      // 6 Sep -- and that is worth a row saying so rather than a tap that
      // goes nowhere. `has_word_map` needs both halves: the .txt AND the
      // timings, per chapter, or listen.js refuses the chapter whole.
      has_book_data: files.has("book-data.js"),
      has_word_map: chaptersTexted > 0 && chaptersTimed > 0,
      // Carried, not read. A false here changes nothing about the reading
      // page; it says the round trip back to a bench would be lossy.
      has_spans: files.has("spans.json"),
      has_dictionary: files.has("dictionary.json"),
      // THE SHELF'S OWN FACTS, off the book.json already parsed above (G-COVERS,
      // 11 Sep). The Library draws a coverless book in type -- its title, its
      // author, its first words -- and on the Mac it reads `first_words` and
      // `form` off the tail of book.json with a Range request. A host that
      // keeps books on disk answers the whole file to a Range (Frank's handler
      // reads it and sends it, 200, no Range), which is 354 MB of book.json
      // across the 28 books on Drive, on every paint. So the two strings ride
      // on the row, where `listInstalled` already reads them for free.
      // `has_cover` lets the tile skip the <img> for a book that has none.
      has_cover: files.has("cover.jpg"),
      first_words: typeof book.first_words === "string" ? book.first_words : null,
      form: typeof book.form === "string" ? book.form : null,
      files: files.size, imported: Date.now(), schema_version: book.schema_version || 1,
    };
    // The meta row LAST: it is the commit. In a Cache it is the entry the
    // shelf reads; on the host it swaps the finished folder in. Either way a
    // half-stored book has no row and is not on the shelf, and the older
    // version of the slug goes only now (the store says which went).
    const replaced = await store.meta(slug, hash, meta);
    return { ok: true, prefix, replaced, reimported, ...meta };
  }

  /** Read a bundle zip and store every book it holds. `onProgress({done,
   *  total, label, slug})` is called per file, so the Library can show the
   *  same greyed row + bar the bench uses for an ingest. Returns one report
   *  per book; a book that fails validation is reported with its reasons and
   *  nothing of it is written -- book.json is validated BEFORE any of its
   *  files are put, so a refused book never leaves a half-cache behind. */
  async function importZip(buffer, opts) {
    const o = opts || {};
    const entries = Unzip.entries(buffer);
    const plan = planBundle(entries);
    if (!plan.books.length) throw new Error("no book.json in that .zip — is it a bundle from the bench?");
    const count = { done: 0, total: plan.books.reduce((n, b) => n + b.files.size, 0) };
    const read = entry => Unzip.read(buffer, entry);
    const reports = [];
    for (const b of plan.books) reports.push(await importBook(b.prefix, b.files, read, o, count));
    return { books: reports, ignored: plan.ignored };
  }

  /** The Sync button's door (job 26): one book, named by Studio's manifest
   *  as a list of rels, fetched one file at a time through `fetchRel(rel)`
   *  (-> Uint8Array) and stored by `importBook` exactly as a zip's entries
   *  are. Rels outside the payload allowlist are ignored by name, as a
   *  zip's shell copy is. book.json is fetched FIRST and validated before
   *  any other file is asked for, so a refused book costs one request. */
  async function importFiles(slug, rels, fetchRel, opts) {
    const o = opts || {};
    const files = new Map();
    const ignored = [];
    for (const rel of rels) {
      if (isPayload(rel)) files.set(rel, rel); else ignored.push(rel);
    }
    // the book file FIRST, whatever order the manifest listed: a Map iterates
    // by insertion and `importBook` validates before it stores, so a refused
    // book must cost one request and not the whole set.
    const first = bookFileOf(files);
    if (first) {
      const v = files.get(first);
      files.delete(first);
      const rest = Array.from(files.entries());
      files.clear();
      files.set(first, v);
      for (const [k, x] of rest) files.set(k, x);
    }
    const bookName = bookFileOf(files);
    if (!bookName) return { ok: false, prefix: slug + "/", slug, errors: ["Studio listed no book.meta.json for " + slug], ignored };
    const count = { done: 0, total: files.size };
    const report = await importBook(slug + "/", files, rel => fetchRel(rel), o, count);
    report.ignored = ignored;
    // The Sync line ends a book at n/n (`Pulling 1 of 26 · Les Pensées ·
    // 31/31`), once its row is written. Only this door: the zip door's
    // progress ends at n-1 and its row replaces the bar, as it always has
    // (library/tests/test_import.py pins that).
    if (report.ok && o.onProgress) o.onProgress({ done: count.done, total: count.total, label: META_FILE, slug });
    return report;
  }

  // ------------------------------------------------------- the top-up
  /** WHAT A ROW HAS GAINED AT THE SAME HASH (G-COVERS, 11 Sep). A book is its
   *  word ids' hash, and a file that changes no word -- the cover -- can
   *  arrive after the book did: the Mac's Sync press adds `cover.jpg` INTO the
   *  folder Drive's row already names and appends it to the row's `files`
   *  (studio/drive.py TOPUP), and Studio's LAN manifest lists it the moment
   *  the folder has one. The hash does not move, so "pull the books whose hash
   *  this device lacks" never sees it. THIS is the signal, and all of it:
   *
   *    the row (Drive's library.json, or the manifest) lists a TOPUP name in
   *    `files`, at the (slug, hash) this device has installed, and the
   *    installed row does not say it has that file (`has_cover !== true`).
   *
   *  Pure: `rows` are the Mac's rows, `installed` is `listInstalled()`'s (or
   *  book_list's) rows; the answer is one entry per book, `{slug, hash,
   *  files: [the row's own file entries]}` -- the same shape as a book of
   *  the pull's job, so the host writes those files into the INSTALLED
   *  version (not a `.part/`: nothing else of the book changes) and sets
   *  `has_cover` on its row. A superseded row is never topped up. */
  const TOPUP = { "cover.jpg": "has_cover" };
  function topUps(rows, installed) {
    const have = new Map();
    for (const b of installed || []) if (b && b.slug) have.set(b.slug + "@" + b.hash, b);
    const out = [];
    for (const r of rows || []) {
      if (!r || !r.slug || !r.hash || r.superseded || !Array.isArray(r.files)) continue;
      const mine = have.get(r.slug + "@" + r.hash);
      if (!mine) continue;
      const files = r.files.filter(f => f && TOPUP[f.rel] && mine[TOPUP[f.rel]] !== true);
      if (files.length) out.push({ slug: r.slug, hash: r.hash, files });
    }
    return out;
  }

  /* ===================================== A BOOK THAT HAS GONE (G-DELETE)
   *  Osca, 14 Sep: *"Deleted on the Mac -> deleted on the phone at its next
   *  sync. Deleted on the phone -> the phone frees its copy and the book
   *  stays pullable ('Not on this device'); the Mac is never touched."*
   *  Two verbs, and the difference between them is one local file.
   *
   *  `removals` is the Mac's half: a row that carries `removed` is a
   *  TOMBSTONE, and a book installed here whose row is a tombstone goes.
   *  Pure, so the planner and the test can ask it the same question. A slug
   *  that ALSO has a live row is a book that came back (`studio/drive.py`
   *  drops the tombstone when it re-pushes, but a phone may read a
   *  `library.json` written between the two): the live row wins, and
   *  nothing is deleted on the strength of a row that has been answered.
   *
   *  `freeBook` is the phone's half: the copy goes and the slug is written
   *  into the FREED list, which is this device's own and reaches nothing
   *  else. The pull skips a freed slug -- otherwise the next sync, two
   *  seconds later, would put the book straight back -- and `unfreeBook`
   *  is the press that asks for it again. The Mac is never told. */
  const FREED_KEY = "ttstv.reader.freed";          // {slug: {at, hash}} -- this device only

  function freedRead() {
    try {
      const ls = typeof globalThis !== "undefined" && globalThis.localStorage;
      const rec = ls && JSON.parse(ls.getItem(FREED_KEY) || "null");
      return rec && typeof rec === "object" && !Array.isArray(rec) ? rec : {};
    } catch (e) { return {}; }
  }

  function freedWrite(rec) {
    try {
      const ls = typeof globalThis !== "undefined" && globalThis.localStorage;
      if (ls) ls.setItem(FREED_KEY, JSON.stringify(rec));
    } catch (e) { /* a page with no storage frees the copy and remembers nothing */ }
    return rec;
  }

  /** What this device freed, `{slug: {at, hash}}`. */
  function freed() { return freedRead(); }

  /** Free this device's copy: the files go, the book stays pullable. */
  async function freeBook(slug, hash) {
    const gone = await removeBook(slug);
    const rec = freedRead();
    rec[slug] = { at: Date.now(), hash: hash || null };
    freedWrite(rec);
    return gone;
  }

  /** Ask for it again: the slug leaves the freed list and the next sync
   *  pulls it like any book this device lacks. */
  function unfreeBook(slug) {
    const rec = freedRead();
    if (!(slug in rec)) return false;
    delete rec[slug];
    freedWrite(rec);
    return true;
  }

  /** Pure: the books installed here that the Mac has deleted --
   *  `[{slug, hash, by, at}]`, in the rows' order. */
  function removals(rows, installed) {
    const mine = new Map();
    for (const b of installed || []) if (b && b.slug) mine.set(b.slug, b);
    const live = new Set();
    for (const r of rows || []) if (r && r.slug && !r.removed && !r.superseded) live.add(r.slug);
    const out = [], seen = new Set();
    for (const r of rows || []) {
      if (!r || typeof r.slug !== "string" || !r.removed || live.has(r.slug) || seen.has(r.slug)) continue;
      if (!mine.has(r.slug)) continue;
      seen.add(r.slug);
      out.push({ slug: r.slug, hash: mine.get(r.slug).hash || null,
                 by: r.removed.by || null, at: Number(r.removed.at) || null });
    }
    return out;
  }

  // ------------------------------------------------------------- the shelf
  /** What is on the device: one row per book cache, read from the little
   *  meta entry written at import rather than by re-parsing a 2 MB
   *  book.json every time the Library paints. */
  async function listInstalled(href) {
    const out = (await storeFor(href).list()).slice();
    out.sort((a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug)));
    return out;
  }

  /** Delete one book's cache and nothing else -- not the shell, not another
   *  book. Returns how many caches went (0 if it was not installed). */
  async function removeBook(slug) {
    return storeFor().remove(slug);
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
    META_MAX, BOOK_FILE, META_BOOK_FILE, bookFileOf,
    isPayload, cacheName, parseCacheName, booksBase, bookUrl,
    validateBook, validateMeta, walkWordIds, bookHash, planBundle, contentType,
    importBook, importZip, importFiles, listInstalled, removeBook, estimate, fmtBytes, topUps, TOPUP,
    FREED_KEY, freed, freeBook, unfreeBook, removals,
    CacheStore, HostStore, storeFor, useStore,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TTSTVBundle;
if (typeof self !== "undefined") self.TTSTVBundle = TTSTVBundle;
