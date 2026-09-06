/* ================== MARGINALIA — the reader becomes a place you write in ==
   Job 15b step 2, 6 September. Osca, 31 August: "the reader becomes a place
   you write in." The record was built then (`4a39cb6`+); job 15 left it on
   the floor because the design shell mounts no page that draws it. This
   file is that record RE-ANCHORED on the shell -- on `listen.js`'s map, which
   is the only thing on this page that knows which characters a word id is.

     Marginalia.mount({ nav, col, pane, slug, control }) -> control

   WHAT DID NOT CHANGE, AND THAT IS THE POINT.
   `reader/routes.py` is untouched: `GET`+`POST /marginalia/<slug>` answer at
   exactly the URLs they answered at, and the body this file POSTs is the
   body `margPatch` has always POSTed. The two SHARED BLOCKS below are
   byte-identical to `library/library.html`'s copies -- the same anti-drift
   rule `reader/tests/test_marginalia.py` and `test_library_store.py` hold
   them under, moved from `reader/memory.js` to here with the bytes unchanged
   (both tests find whichever reader-side file carries the marker). The
   record's shape, its merge rule, its tombstones and its four colours are
   the ones already on disk in every `ttstv.reader.marginalia.<slug>` a
   reader has written, so nothing anyone has marked is lost.

   WHAT CHANGED, AND WHY IT HAD TO.

   * **The anchor resolves through `listen.js`, not through `book.json`.** An
     entry is a run of WORD IDS. `book-data.js` -- what the shell draws from
     -- carries no ids at all, so the old page's "find the span with this
     data-id" cannot be asked here. `Listen.mapOf(chIdx)` gives word id ->
     {text node, start, end} for one chapter, which is exactly what a Range
     wants, so a mark paints as a **CSS Custom Highlight** over the live text.
     NOTHING IS WRAPPED IN A SPAN: page.js emits one text node per `p.line`
     and pane.js, wheel.js and `book-nav.js::buildWordDomIndex` all measure
     against that shape.

   * **The witness is the CHAPTER's, not the book's.** The old entry carried
     `libHash(libWordIds(book).join("|"))` -- `core/provenance.py::
     book_word_id_hash` -- and that needs every word id of the book, which
     is `book.json` and 96 MB of it on the Complete Works. `core/provenance.py`
     already has the smaller one beside it, `chapter_word_id_hash`, and a
     chapter's ids are exactly what `timings/<cid>.json` holds. So the
     witness is computed per chapter from the ids the page actually has, and
     it is written under its OWN KIND -- `chapter-ids` -- because
     `margStale`'s own rule is that two kinds must match before two hashes
     may be compared. A book-hash witness written before today is therefore
     never called stale by a chapter-hash one, and never re-anchored; it is
     simply not compared. §6 has what it would take to have both.

   * **The margin itself is not here.** The old file drew notes in a MARGIN
     beside the passage, folding to a mark under 168 px, and bookmarks as
     marks on its own scroll track. The shell has no margin and its scrub is
     `book-nav.js`'s. Those are design, and design is not this lane's to
     invent (job 15: "nothing is redesigned"). So this file keeps the whole
     record -- notes, highlights and bookmarks all merge, mirror and survive
     -- and PAINTS the half the shell can already show honestly: the
     four-colour highlight. §6 names the other half.

   THE GESTURE IS THE CURSOR'S, and it is the one from the 5th.
   `PROMPTS/done/reader-cursor.md` step 2: **Shift is a mode, not a chord** --
   the same press with Shift taken off is handed to the hotkey table, so
   `word` is the SAME row in both modes and `prefs/prefs.js` gains no row.
   Hold Shift, move by words, and the run grows from where the cursor was;
   let Shift go and step 3's rule applies -- **a mark is marginalia**: one
   `highlights` entry per run, through the same merge-by-id path, no new
   store and no new field.  */
(function () {
"use strict";

// ---- LIBRARY STORE: SHARED, BYTE-IDENTICAL ----
// Five functions that reader/reader.html and library/library.html must agree
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
// in reader/reader.html and library/library.html for the LIBRARY STORE
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

/* ===================== THE PAGE'S HALF ==================================
   Everything above is the record. Everything below is this page: where it
   is kept, who else writes it, what it looks like, and the one gesture that
   makes one. */

var MARG_COLOUR_KEY = "ttstv.reader.highlightColour";
var MARG_WHY = null;             // why the last save did not reach TTS_DATA

/* The last colour used is the default, and it is a DEVICE key rather than a
   field of the mirrored record: it is this Mac's hand, like the Settings
   window's geometry, and sending it to the phone is the mistake that entry
   already names. */
function margLastColour() {
  try { return margColour(localStorage.getItem(MARG_COLOUR_KEY)); }
  catch (e) { return MARG_COLOURS[0]; }
}
function margSetLastColour(c) {
  try { localStorage.setItem(MARG_COLOUR_KEY, margColour(c)); } catch (e) {}
}

function margReadRec(slug) {
  var raw = null;
  try { raw = localStorage.getItem(margKey(slug)); } catch (e) { raw = null; }
  var d = null;
  try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
  return margPrune(margNormalise(d, slug), Date.now());
}
function margWriteRec(slug, rec) {
  try { localStorage.setItem(margKey(slug), JSON.stringify(rec)); return true; }
  catch (e) { return false; }
}

/* `TTS_DATA/reader/marginalia/<slug>.json`, through `reader/routes.py`'s own
   route -- unchanged by this job, which is why this function is the old
   one's shape line for line. Save locally FIRST and POST second, and keep
   the server's own words for the times the write does not land, so the page
   can say in one sentence that this Mac is the only copy. */
function margMirror(slug, rec) {
  if (!/^https?:$/.test(location.protocol)) {
    MARG_WHY = "no studio behind this page";
    return Promise.resolve({ mirrored: false, why: MARG_WHY });
  }
  return fetch(MARG_ROUTE + encodeURIComponent(slug), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec) })
    .then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        MARG_WHY = res.ok ? null : ((body && body.error) || ("HTTP " + res.status));
        return { mirrored: res.ok, why: MARG_WHY };
      });
    })
    .catch(function (e) {
      MARG_WHY = String(e && e.message || e);
      return { mirrored: false, why: MARG_WHY };
    });
}

/* WHAT THIS DEVICE IS CALLED. One id per browser profile, made once. It
   stamps every entry so a later two-way merge with the phone has something
   to merge on; it is this file's because this file is the record's writer,
   and reader/cursor.js asks for it rather than making a second one. */
var LIB_DEVICE_KEY = "ttstv.reader.deviceId";
function libDeviceId() {
  try {
    var id = localStorage.getItem(LIB_DEVICE_KEY);
    if (!id) {
      id = "d-" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem(LIB_DEVICE_KEY, id);
    }
    return id;
  } catch (e) { return null; }
}

/* THE WITNESS, computed from what the page has. `core/provenance.py::
   chapter_word_id_hash` is sha256 over the chapter's word ids joined by "|",
   first 16 hex -- and a chapter's ids in reading order are `map.ids`. The
   kind is named for what it IS so that `margStale` can refuse to compare it
   with a book-level hash: two different functions under one name is the
   quiet lie this store already refuses once. crypto.subtle is absent over
   file://, and then the entry carries no witness at all rather than a
   weaker hash wearing the same name. */
function margWitness(map) {
  if (!map || !map.ids || !map.ids.length) return Promise.resolve(null);
  var sub = (typeof crypto !== "undefined" && crypto && crypto.subtle) ? crypto.subtle : null;
  if (!sub) return Promise.resolve(null);
  var bytes = new TextEncoder().encode(map.ids.join("|"));
  return sub.digest("SHA-256", bytes).then(function (buf) {
    var out = "";
    var view = new Uint8Array(buf);
    for (var i = 0; i < 8; i++) out += ("0" + view[i].toString(16)).slice(-2);
    return out;
  }).catch(function () { return null; });
}

function mount(o) {
  o = o || {};
  var nav = o.nav, col = o.col;
  var control = o.control || null;
  var slug = o.slug || (o.book && o.book.slug) || "";

  var rec = margReadRec(slug);
  var maps = new Map();            // chapter index -> map, once resolved
  var hiOK = !!(window.CSS && CSS.highlights && window.Highlight);
  var run = null;                  // {ch, from, to} while Shift is held

  /* ------------------------------------------------------------- the paint
     One CSS Custom Highlight per colour, holding one Range per covered word.
     A chapter whose map has not been asked for yet is asked for HERE and
     repaints when it lands, so opening a book paints its marks without any
     page having to know which chapters carry them. */
  /* WHICH CHAPTER A MARK IS IN, AND WHY IT IS A HINT AND NOT AN ANSWER.
     `c003.p0001.s01.w001` does begin with its chapter today, and the old
     page refused to depend on that: it scanned `book.json` for the id
     instead (`margChapterOfWord`, and reader/tests/test_marginalia.py's
     "a word is found by scanning the book, not by splitting its id"). The
     shell has no `book.json` to scan -- that is the whole of job 15b step 5
     -- so the prefix comes back, as a HINT: it says which chapter's map to
     fetch, and the map is then asked whether it really holds the id. A hint
     that lies costs one timings fetch and paints NOTHING, which is what the
     store already promises for an anchor whose chapter is not on the page.
     It can never light the wrong word. */
  function chapterHint(wordId) {
    var s = String(wordId == null ? "" : wordId);
    var i = s.indexOf(".");
    return i > 0 ? s.slice(0, i) : null;
  }

  function chaptersWithMarks() {
    var out = new Set();
    var live = margLive(rec, "highlights");
    for (var i = 0; i < live.length; i++) {
      var cid = chapterHint(live[i].from);
      if (cid) out.add(cid);
    }
    return [...out];
  }

  function want(cid) {
    if (!control || !control.mapOf || !control.chapterIndexOf) return Promise.resolve(null);
    var idx = control.chapterIndexOf(cid);
    if (idx < 0) return Promise.resolve(null);
    if (maps.has(idx)) return Promise.resolve(maps.get(idx));
    return control.mapOf(idx).then(function (m) { maps.set(idx, m || null); return m || null; });
  }

  function rangeOf(hit) {
    try {
      var r = document.createRange();
      r.setStart(hit.node, hit.s); r.setEnd(hit.node, hit.e);
      return r;
    } catch (e) { return null; }
  }

  function paint() {
    if (!hiOK) return;
    var byColour = {};
    for (var c = 0; c < MARG_COLOURS.length; c++) byColour[MARG_COLOURS[c]] = [];
    var live = margLive(rec, "highlights");
    for (var i = 0; i < live.length; i++) {
      var h = live[i];
      var cid = chapterHint(h.from);
      var idx = control && control.chapterIndexOf ? control.chapterIndexOf(cid) : -1;
      var map = idx >= 0 ? maps.get(idx) : null;
      if (!map) continue;
      /* THE HINT IS VERIFIED HERE, and this line is the whole guarantee: a
         mark whose id the chapter does not actually hold is not painted. */
      if (!map.byWordId.has(h.from) && !map.byWordId.has(h.to)) continue;
      var words = margSpanIds(h.from, h.to, map.ids);
      for (var w = 0; w < words.length; w++) {
        /* the newest highlight wins a word it shares -- margColourAt is the
           record's own rule and this is its one caller on the page */
        if (margColourAt(words[w], live, map.ids) !== h.colour) continue;
        var hit = map.byWordId.get(words[w]);
        var r = hit && rangeOf(hit);
        if (r) byColour[h.colour].push(r);
      }
    }
    for (var k = 0; k < MARG_COLOURS.length; k++) {
      var name = "marg-" + MARG_COLOURS[k];
      var list = byColour[MARG_COLOURS[k]];
      try {
        if (list.length) CSS.highlights.set(name, new Highlight(...list));
        else CSS.highlights.delete(name);
      } catch (e) { hiOK = false; return; }
    }
  }

  function repaint() {
    var cids = chaptersWithMarks();
    if (!cids.length) { paint(); return Promise.resolve(); }
    return Promise.all(cids.map(want)).then(paint);
  }

  /* ------------------------------------------------------------- the write
     The ONLY writer. `fn` is handed the CURRENT record off disk merged with
     whatever this page holds, so nothing composed from this page's own state
     is ever written whole over another writer's work (a Library tab, the
     voice layer, a second reader). */
  function patch(fn) {
    if (!slug) return null;
    var next = margMerge(margReadRec(slug), rec);
    fn(next);
    next.saved = Date.now();
    next.device = libDeviceId();
    rec = next;
    margWriteRec(slug, next);
    repaint();
    margMirror(slug, next);
    return next;
  }

  /* ------------------------------------------- a mark is marginalia (step 3
     of reader-cursor.md, 5 Sep). One `highlights` entry per RUN, through the
     merge-by-id path, no new store and no new field. */
  function markRun(chIdx, fromFlat, toFlat, colour) {
    var cid = control && control.chapterIdOf ? control.chapterIdOf(chIdx) : null;
    if (!cid) return Promise.resolve(null);
    return want(cid).then(function (map) {
      if (!map || !map.byFlat) return null;
      var a = Math.min(fromFlat, toFlat), b = Math.max(fromFlat, toFlat);
      var from = map.byFlat.get(a), to = map.byFlat.get(b);
      if (!from || !to) return null;
      return margWitness(map).then(function (witness) {
        var now = Date.now();
        var entry = { id: margId("h", now), from: from, to: to,
                      colour: margColour(colour || margLastColour()), at: now,
                      device: libDeviceId(),
                      witness: witness, witnessKind: witness ? "chapter-ids" : "none" };
        patch(function (r) { r.highlights.push(entry); });
        return entry;
      });
    });
  }

  function removeMark(id) {
    patch(function (r) { r.highlights.push({ id: id, deleted: Date.now() }); });
  }

  /* --------------------------------------------------------- the keyboard
     SHIFT IS A MODE, NOT A CHORD. The press is handed to the hotkey table
     with Shift taken off, so `word` is the same row in both modes and
     prefs/prefs.js gains none. The cursor moves with the run's far end --
     which is the same one cursor, moved by nav.goTo, and not a second one. */
  function markEvent(e) {
    return { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey,
             altKey: e.altKey, shiftKey: false };
  }

  addEventListener("keydown", function (e) {
    if (window.TTSTVKeys && TTSTVKeys.typing()) return;
    if (!e.shiftKey || !nav || !nav.cursor) return;
    var S = window.TTSTVSettings;
    var which = S ? S.hotkeyWhich(markEvent(e), "word") : -1;
    if (which < 0) return;
    e.preventDefault();
    var c = nav.cursor;
    var next = Math.max(0, c.word + (which === 0 ? 1 : -1));
    if (!run || run.ch !== c.chapter) run = { ch: c.chapter, from: c.word, to: c.word };
    run.to = next;
    nav.goTo(c.chapter, next);
  });

  addEventListener("keyup", function (e) {
    if (e.key !== "Shift" || !run) return;
    var r = run; run = null;
    markRun(r.ch, r.from, r.to, margLastColour());
  });

  /* a book just opened: its marks are drawn as soon as their chapters'
     maps land, and a second tab's write repaints this one */
  repaint();
  addEventListener("storage", function (e) {
    if (!e || e.key !== margKey(slug)) return;
    rec = margReadRec(slug);
    repaint();
  });

  return {
    get record() { return rec; },
    get why() { return MARG_WHY; },
    marks: function () { return margLive(rec, "highlights"); },
    markRun: markRun, removeMark: removeMark, repaint: repaint, patch: patch,
    colour: margLastColour, setColour: margSetLastColour,
  };
}

window.Marginalia = {
  mount: mount, deviceId: libDeviceId, key: margKey, read: margReadRec,
  write: margWriteRec, empty: margEmpty, merge: margMerge, live: margLive,
  spanIds: margSpanIds, colourAt: margColourAt, colours: MARG_COLOURS,
  route: MARG_ROUTE,
  id: margId, stale: margStale, order: margOrder, witness: margWitness,
  /* the library record's shared block, exported because reader/cursor.js is
     the record's other writer and there is one copy of these five, here */
  libStore: { wordIds: libWordIds, hash: libHash, mergeSlug: libMergeSlug,
              refusal: mergeRefusal, mergeRecord: libMergeRecord },
};
})();
