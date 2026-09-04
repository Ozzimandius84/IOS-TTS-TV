/* ================================================ WHERE HE LEFT OFF (memory)
 * PROMPTS/library-shelf.md §4c, decided in READER_FIRST.md "Library -- merges,
 * shelves and memory". Osca: "Main shelf -- memory, locally and eventually
 * shared with phone. It must know where I last closed the reader."
 *
 * **Only the reader knows.** library.html owns the record -- merges, shelves
 * and this -- but it cannot possibly write the position half: the page that
 * knows where you stopped is this one. So the reader is the record's second
 * writer, and it writes exactly two keys, `positions` and `last`, through a
 * read-modify-write so that a Library tab open at the same time cannot lose
 * its merges to this page's stale copy (and vice versa). Everything else in
 * `ttstv.reader.library` is left byte-for-byte as it was found.
 *
 * **A word id, not a scroll offset.** An offset is meaningless after a
 * re-parse; a word id survives one. The `_book_hash` beside it is
 * `core/provenance.py::book_word_id_hash` computed in the page -- sha256 over
 * every word id in order, joined by "|", first 16 hex -- so a re-parsed book
 * can say *"this position is from an older version"* instead of landing
 * somewhere quietly wrong. `libWordIds` and `libHash` are two of the five
 * functions in the LIBRARY STORE block below, which is byte-identical to
 * reader/library.html's copy and is held that way by
 * reader/tests/test_library_store.py -- the same anti-drift rule the shelf's
 * rail lives under. (There is no shared runtime file because one would be a
 * new SHELL file -- sw.js, publish_shell.py, export_bundle.py and a script
 * tag in every page -- for fifty lines.)
 *
 * **The phone is gated, and the record is shaped for it anyway**: a per-device
 * id and a timestamp on every position, so a later two-way merge has
 * something to merge on. Nothing here syncs; `READER_FIRST.md` has why. */
const LIB_KEY = "ttstv.reader.library";
const LIB_DEVICE_KEY = "ttstv.reader.deviceId";

function libDeviceId() {
  try {
    let id = localStorage.getItem(LIB_DEVICE_KEY);
    if (!id) {
      id = "d-" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem(LIB_DEVICE_KEY, id);
    }
    return id;
  } catch (e) { return null; }
}

// ---- LIBRARY STORE: SHARED, BYTE-IDENTICAL ----
// Five functions that reader/reader.html and reader/library.html must agree
// on exactly, kept as two copies rather than one file because a shared
// runtime file would be a new SHELL file -- sw.js, publish_shell.py,
// export_bundle.py and a <script> tag in every page -- for fifty lines.
// reader/tests/test_library_store.py extracts this block from both files and
// asserts they are byte-identical, the same anti-drift rule the shelf's rail
// already lives under (reader/tests/test_library_rail.py). Nothing in here
// touches the DOM, the network or localStorage: it is the record's shape and
// the pairing rule, and both pages wrap it in their own words.
//
// The witness hash is byte-for-byte `core/provenance.py::book_word_id_hash`:
// sha256 over every word id in order, joined by "|", first 16 hex.
function libWordIds(book) {
  const ids = [];
  for (const c of (book && book.chapters) || []) {
    for (const p of c.paragraphs || []) {
      for (const s of p.sentences || []) {
        for (const w of s.words || []) if (w && w.id) ids.push(w.id);
      }
    }
  }
  return ids;
}
async function libHash(text) {
  const sub = (typeof crypto !== "undefined" && crypto && crypto.subtle) ? crypto.subtle : null;
  if (sub) {
    try {
      const buf = await sub.digest("SHA-256", new TextEncoder().encode(text));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      return { hash: hex.slice(0, 16), kind: "word-ids" };
    } catch (e) { /* file://, or a browser that refuses outside a secure context */ }
  }
  // Not a weaker sha256 pretending to be one: a different function under a
  // different name, so a hash can never be compared across the two kinds.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i) & 0xff;
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return { hash: ("00000000" + h.toString(16)).slice(-8), kind: "fnv1a-word-ids" };
}

function libMergeSlug(a, b) { return String(a) + "+" + String(b); }

/* A MERGE IS EXACTLY TWO (Osca, confirmed 30 Aug; READER_FIRST.md "Logged for
 * later"). The parallel view holds two panes, so a pair of pairs is a view
 * that cannot be drawn -- and this is the one place that says so, for the
 * shelf's "Merge with..." and for a tab dropped on a tab alike. It returns
 * the SENTENCE, not a boolean, because every refusal in this app is a
 * refusal in words: a menu item that greys out silently is the bug this
 * project keeps naming.
 *
 * Pure, and every fact it needs is passed in -- whether each side is already
 * a pair, and what each is called -- so it is the same answer in a browser,
 * in the node harness and in a page that has no library loaded yet. */
function mergeRefusal(o) {
  o = o || {};
  if (!o.a || !o.b) return "A pair is two books, and this is one.";
  if (o.a === o.b) return "A book cannot be paired with itself.";
  if (o.aIsPair || o.bIsPair) {
    const which = o.aIsPair ? (o.aName || o.a) : (o.bName || o.b);
    return "\u201c" + which + "\u201d is already a pair, and a parallel view holds two. "
      + "Take its pairing off first, then pair one of its two books.";
  }
  return null;
}

/* The record, and nothing else: a name and two slugs. It copies no text,
 * moves no book and asserts nothing about language -- `members[0]` is the
 * target (the top lane in one-word mode) and `members[1]` the ground, and
 * that ORDER is the only claim it makes. `book_hash` is each member's hash as
 * at merge time, a witness: when a member is re-parsed the pair still opens
 * and marks itself stale rather than being quietly wrong. */
function libMergeRecord(a, b, ha, hb, at, device) {
  return {
    slug: libMergeSlug(a, b), kind: "merge",
    members: [{ slug: a, book_hash: ha.hash, hash_kind: ha.kind, at: at },
              { slug: b, book_hash: hb.hash, hash_kind: hb.kind, at: at }],
    // Where the word-alignment sidecar goes when align/ builds one
    // (PROMPTS/reader-one-word.md 5). A merge is the app's way of saying
    // "these two are a translation pair", which is that step's input -- so
    // the field exists, named, and stays null until something writes it.
    align: null,
    created: at, device: device,
  };
}
// ---- END LIBRARY STORE ----

// ---- MARGINALIA STORE: SHARED, BYTE-IDENTICAL ----
// Notes, highlights and bookmarks -- Osca, 31 August (READER_FIRST.md
// "Marginalia"): "the reader becomes a place you write in". Three things,
// ONE store, shared with the phone.
//
// This block is the record's SHAPE and its merge rule, and nothing else: no
// DOM, no network, no localStorage. It is kept as two byte-identical copies
// in reader/reader.html and reader/library.html for the LIBRARY STORE
// block's reason (a shared runtime file would be a new SHELL file -- sw.js,
// publish_shell.py, export_bundle.py and a <script> tag in every page -- for
// eighty lines), and reader/tests/test_marginalia.py extracts both and
// asserts they are identical, which is the only thing that keeps two copies
// honest. The reader is the writer; the Library reads bookmarks, for "Open
// at bookmark...".
//
// **Where it lives.** `ttstv.reader.marginalia.<slug>` in localStorage, one
// key per book, mirrored to `TTS_DATA/reader/marginalia/<slug>.json` through
// studio's `/marginalia/<slug>` -- a route that DOES NOT EXIST YET, exactly
// as `/phone-shelf` and `/reader-library` did not when their panels were
// written, so `save()` says `mirrored: false` in words until it lands
// (reader/README.md 6). ONE KEY PER BOOK, not one for the library, because
// the mirror is one file per book and because a note written while reading
// Blood Meridian must not rewrite Hamlet's file.
//
// **Nothing here ever goes into `books/` or a bundle.** It is personal data
// about a person, sitting beside the book and never inside it.
//
//   notes       {id, from: wordId, to: wordId, text, at, device, witness,
//                witnessKind}
//   highlights  {id, from: wordId, to: wordId, colour, at, device, witness,
//                witnessKind}
//   bookmarks   {id, at: wordId, made, device, witness, witnessKind}
//
// **Anchored to word ids** -- the ids the timings, the aligner and the
// library record's `positions` already use, so an anchor survives a re-parse
// the way the reading position does. `from`/`to` are INCLUSIVE and are
// resolved against the ids actually on the page at paint time: an anchor
// whose chapter is not rendered simply does not paint, and is not lost.
//
// **The witness hash is the library record's, byte for byte** --
// `libHash(libWordIds(book).join("|"))`, which is `core/provenance.py::
// book_word_id_hash`. It is on EVERY ENTRY and not only on the record,
// because a record accumulates across a re-parse: a single record-level hash
// would call this morning's note stale along with last week's. The record
// carries `hash`/`hashKind` too, as at its last save, so the Library can say
// "this book has moved on" without loading the book. A stale witness is
// SHOWN as such and NEVER re-anchored -- an anchor moved to whichever words
// now hold those ids is the quiet lie this project keeps refusing.
//
// **Two writers, and neither may lose the other.** The voice layer is a
// second writer to this same store (voiceui/: "note: ...", "highlight that",
// "bookmark here" -- reader/README.md 6), and a Library tab is a third
// reader. So: every write is a read-modify-write, and `margMerge` merges BY
// ID, newest timestamp winning. Which forces the next decision --
//
// **a delete is a tombstone**, `{id, deleted: <ms>}`, kept. With merge-by-id
// a plain removal is undone by the first writer that still holds the entry;
// a tombstone is an entry with a timestamp and wins the same way any other
// edit does. `margPrune` drops tombstones older than 30 days so the file
// cannot grow without bound -- long enough for any second writer to have
// caught up, and this is a mirror file, not a queue.
var MARG_VERSION = 1;
var MARG_PREFIX = "ttstv.reader.marginalia.";
var MARG_ROUTE = "/marginalia/";
// Osca's four, in his order. The list is here rather than in a stylesheet
// because it is the record's vocabulary: a colour that is not one of these
// is not stored (margNormalise drops to the first), and the CSS is keyed off
// it rather than the other way round.
var MARG_COLOURS = ["green", "yellow", "red", "pink"];
var MARG_TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000;

function margKey(slug) { return MARG_PREFIX + String(slug || ""); }

function margEmpty(slug) {
  return { version: MARG_VERSION, slug: String(slug || ""), saved: 0, device: null,
           hash: null, hashKind: "none", notes: [], highlights: [], bookmarks: [] };
}

// Unique enough that two writers on two devices cannot collide, and short
// enough to read in a file. Time first so an id sorts by when it was made.
function margId(kind, now, rand) {
  var t = Number(now) || 0;
  var r = (typeof rand === "function") ? rand : Math.random;
  // PADDED, and that is the whole point of the field: base 36 of a smaller
  // number is a SHORTER string, and a shorter string sorts before a longer
  // one whatever its value -- so an unpadded stamp sorts by digit count and
  // not by time. Eight places carries a millisecond epoch past the year
  // 5000; anything that overflows it simply keeps its own length.
  var stamp = ("00000000" + t.toString(36)).slice(-8);
  return String(kind || "m").slice(0, 1) + "-" + stamp
    + "-" + r().toString(36).slice(2, 8);
}

function margColour(c) {
  return MARG_COLOURS.indexOf(c) >= 0 ? c : MARG_COLOURS[0];
}

// Everything off disk, off another device or out of another writer comes
// through here, so a hand-edited file, an older version or a truncated write
// can only ever cost a field -- never throw on the page whose whole job is
// to show a person their own words.
function margNormaliseEntry(e, kind) {
  if (!e || typeof e !== "object" || typeof e.id !== "string" || !e.id) return null;
  var at = Number(e.at) || Number(e.made) || 0;
  var out = { id: e.id, at: at,
              device: (typeof e.device === "string" && e.device) ? e.device : null,
              witness: (typeof e.witness === "string" && e.witness) ? e.witness : null,
              witnessKind: (typeof e.witnessKind === "string" && e.witnessKind) ? e.witnessKind : "none" };
  if (e.deleted != null && Number(e.deleted) > 0) {
    // A tombstone carries its id and its time and nothing else -- keeping the
    // text of a deleted note in the file is the opposite of deleting it.
    out.deleted = Number(e.deleted);
    out.at = Math.max(out.at, out.deleted);
    return out;
  }
  if (kind === "bookmarks") {
    if (typeof e.at !== "string" && typeof e.wordId !== "string") return null;
    out.wordId = typeof e.wordId === "string" ? e.wordId : e.at;
    out.at = Number(e.made) || Number(e.stamp) || at || 0;
    out.made = out.at;
    // A LABEL, never a decision. The Library lists bookmarks in a book's
    // menu ("Open at bookmark...") and it has no book.json to resolve a word
    // id against -- stevens-collected-poems' is 4 MB, and loading one to
    // draw a menu of three rows is not a trade. So the reader, which does
    // have the book, writes the chapter beside the anchor. Where the reader
    // LANDS is still decided by `wordId` alone, so a stale label can only
    // ever be a stale label.
    out.chapter = (typeof e.chapter === "string" && e.chapter) ? e.chapter : null;
    out.chapterTitle = (typeof e.chapterTitle === "string" && e.chapterTitle) ? e.chapterTitle : null;
    return out;
  }
  if (typeof e.from !== "string" || !e.from) return null;
  out.from = e.from;
  out.to = (typeof e.to === "string" && e.to) ? e.to : e.from;
  if (kind === "notes") out.text = typeof e.text === "string" ? e.text : "";
  else out.colour = margColour(e.colour);
  return out;
}

function margNormalise(raw, slug) {
  var d = (raw && typeof raw === "object") ? raw : {};
  var out = margEmpty(slug || d.slug);
  out.saved = Number(d.saved) || 0;
  out.device = (typeof d.device === "string" && d.device) ? d.device : null;
  out.hash = (typeof d.hash === "string" && d.hash) ? d.hash : null;
  out.hashKind = (typeof d.hashKind === "string" && d.hashKind) ? d.hashKind : (out.hash ? "unknown" : "none");
  var kinds = ["notes", "highlights", "bookmarks"];
  for (var i = 0; i < kinds.length; i++) {
    var k = kinds[i];
    var list = Array.isArray(d[k]) ? d[k] : [];
    var seen = {};
    var kept = [];
    for (var j = 0; j < list.length; j++) {
      var e = margNormaliseEntry(list[j], k);
      if (!e) continue;
      // One id, one entry, even inside one file: the newer wins, which is
      // margMerge's rule applied to a file that has already been merged
      // badly by hand.
      if (Object.prototype.hasOwnProperty.call(seen, e.id)) {
        var prev = kept[seen[e.id]];
        if (e.at >= prev.at) kept[seen[e.id]] = e;
        continue;
      }
      seen[e.id] = kept.length;
      kept.push(e);
    }
    out[k] = kept;
  }
  return out;
}

// The merge, and the whole reason the record is shaped this way. BY ID,
// newest wins; a tombstone is an entry and wins the same way. Neither side
// is privileged -- `margMerge(mine, theirs)` and `margMerge(theirs, mine)`
// give the same set -- so it is the same answer whichever writer runs it.
function margMerge(a, b) {
  var base = margNormalise(a, (a && a.slug) || (b && b.slug));
  var other = margNormalise(b, base.slug);
  var kinds = ["notes", "highlights", "bookmarks"];
  for (var i = 0; i < kinds.length; i++) {
    var k = kinds[i];
    var byId = {};
    var order = [];
    var all = base[k].concat(other[k]);
    for (var j = 0; j < all.length; j++) {
      var e = all[j];
      if (!Object.prototype.hasOwnProperty.call(byId, e.id)) { byId[e.id] = e; order.push(e.id); continue; }
      var prev = byId[e.id];
      // A tie goes to the tombstone: two writers that disagree about whether
      // a note exists, at the same millisecond, resolve to gone -- the state
      // a person can undo by writing it again, rather than one they have to
      // notice and delete a second time.
      if (e.at > prev.at || (e.at === prev.at && e.deleted && !prev.deleted)) byId[e.id] = e;
    }
    var merged = [];
    for (var m = 0; m < order.length; m++) merged.push(byId[order[m]]);
    base[k] = merged;
  }
  base.saved = Math.max(base.saved, other.saved);
  if (other.saved >= base.saved && other.hash) { base.hash = other.hash; base.hashKind = other.hashKind; }
  return base;
}

// Tombstones older than 30 days go; live entries never do.
function margPrune(rec, now) {
  var t = Number(now) || 0;
  var kinds = ["notes", "highlights", "bookmarks"];
  for (var i = 0; i < kinds.length; i++) {
    var k = kinds[i];
    rec[k] = rec[k].filter(function (e) { return !e.deleted || (t - e.deleted) < MARG_TOMBSTONE_MS; });
  }
  return rec;
}

// What a page actually draws: the entries that are not tombstones.
function margLive(rec, kind) {
  var list = (rec && Array.isArray(rec[kind])) ? rec[kind] : [];
  return list.filter(function (e) { return !e.deleted; });
}

// "Made against an older parse" -- the entry's own witness against the
// book's hash NOW. Unknown either way is not stale: a record written before
// a hash could be computed (file://, no crypto.subtle) says nothing about
// the parse, and saying "stale" on no evidence is its own lie. The two
// KINDS must match as well as the values, because `libHash`'s fallback is a
// different function under a different name and comparing across them is
// meaningless.
function margStale(entry, hash, hashKind) {
  if (!entry || !entry.witness || !hash) return false;
  if (entry.witnessKind !== hashKind) return false;
  return entry.witness !== hash;
}

// Reading order for a list of anchored entries, given the page's own word
// order (`index` maps a word id to its position). An entry whose anchor is
// not on the page sorts last, in the order it was made -- it still has to
// appear somewhere, in the margin's "not on this page" line.
function margOrder(list, index) {
  var idx = index || {};
  function pos(e) {
    var k = e.wordId || e.from;
    var v = Object.prototype.hasOwnProperty.call(idx, k) ? idx[k] : -1;
    return v < 0 ? Infinity : v;
  }
  return list.slice().sort(function (x, y) {
    var a = pos(x), b = pos(y);
    if (a !== b) return a - b;
    return (x.at || 0) - (y.at || 0);
  });
}

// The words a span covers, given the page's ordered ids. Inclusive, and it
// answers `[]` rather than throwing when either end is missing -- the anchor
// is in a chapter that is not rendered, which is not an error.
function margSpanIds(from, to, ids) {
  var a = ids.indexOf(from);
  var b = ids.indexOf(to);
  if (a < 0 && b < 0) return [];
  if (a < 0) a = b;
  if (b < 0) b = a;
  if (b < a) { var t = a; a = b; b = t; }
  return ids.slice(a, b + 1);
}

// Which colour a word wears when several highlights cover it: the newest,
// because the last thing a person did to a word is what they meant. Returns
// null for a word no live highlight covers.
function margColourAt(wordId, highlights, ids) {
  var best = null;
  for (var i = 0; i < highlights.length; i++) {
    var h = highlights[i];
    if (h.deleted) continue;
    if (margSpanIds(h.from, h.to, ids).indexOf(wordId) < 0) continue;
    if (!best || (h.at || 0) >= (best.at || 0)) best = h;
  }
  return best ? best.colour : null;
}
// ---- END MARGINALIA STORE ----
