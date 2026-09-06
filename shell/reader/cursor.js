/* ================== THE CURSOR — one place in the book, written once ======
   Job 15b step 3, 6 September. Osca's own words for this step: "memory --
   merged into the cursor, not beside it."

   THERE IS NO SECOND POSITION ANY MORE. `reader/memory.js` kept one: it
   wrote `positions` and `last` into `ttstv.reader.library` from a word id it
   worked out for itself, beside book-nav.js's own `wordcursor:<slug>`, and
   the two could disagree about where a person had got to. book-nav.js's
   cursor is the position -- one word view opens at it, the voice moves it,
   a double-click sets it, and it is announced (`ttstv:cursor`) so nothing
   has to keep a copy. So this file does not track anything. It takes that
   one cursor and does the two things memory.js was for:

     1. writes it to disk at a sane rate, and
     2. tells the LIBRARY where he left off, from the same value.

   WHY THE RATE MATTERS, AND WHY THE FIX IS NOT IN book-nav.js.
   `setCursor` writes localStorage on every move, and while the voice is
   reading it moves ONCE PER WORD -- two or three times a second, for as long
   as the book is playing. That is a synchronous disk write per word on a
   phone. It cannot be fixed where it happens: `reader/book-nav.js` is the
   design shell's own file, byte-identical to `design/reader/book-nav.js`,
   and job 15's whole point is that there is ONE implementation of it rather
   than a copy that drifts. So the coalescing is done here, on the one key,
   by wrapping `Storage.prototype.setItem` for keys that match
   `^wordcursor:` and NOTHING else: every other key in the application --
   `ttstv_snap`, `ttstv_speed`, `skipoff`, `turn`, `amp`, `ttstv_word`, the
   marginalia record, prefs -- goes straight through untouched, on the
   original function.

   THE RULE IS OSCA'S: once per SENTENCE, or 500 ms, never per word.
   A write happens when the sentence the voice is in has changed AND at least
   500 ms have passed since the last one; and a cursor moved by hand and then
   left alone is written 500 ms later, so nothing waits on a sentence that
   never comes. Both ends are covered: `pagehide`, a hidden tab and a pause
   flush immediately, so closing the window never loses the last word.
   Measured over ten seconds of real playback in
   `reader/tests/browser/lookup_marks.py`.

   WHAT THE LIBRARY GETS, AND WHAT IT NO LONGER GETS.
   `library/library.html` reads `positions[slug]` for two things: "Open where
   you left off", and `openedAt()`, which is the shelf's own order
   ("most recently opened first", Osca, 4 Sep). It normalises the record
   itself and already tolerates `wordId: null` and `hashKind: "none"`, so
   nothing in that file changes for this. What it no longer gets is the
   `_book_hash` witness: memory.js computed `libHash(libWordIds(book))` --
   `core/provenance.py::book_word_id_hash` -- and that needs every word id of
   the book, which is `book.json`, which is 96 MB on the Complete Works and
   is exactly what job 15b step 5 exists to stop fetching. A position with no
   witness cannot say "this is from an older parse"; it also cannot lie about
   it, which is the trade this project keeps making. §6 has what would fix
   it, and it is small: one field in `book-data.js`.

   The library record is NOT written while reading. It is the goodbye note,
   not the position: it is written when the CHAPTER changes and when the page
   is left (`pagehide`, a hidden tab, a `leaving()` from the host), and that
   is every moment the Library could be painted next. Writing it per sentence
   would double the write count -- and it is measurable: with it on a ten
   second clock the count over ten seconds of playback was 21, one over the
   twenty Osca asked for, for a value nothing reads until the shelf is drawn
   again.  */
(function () {
"use strict";

var CURSOR_RE = /^wordcursor:/;
var LIB_KEY = "ttstv.reader.library";
var FLOOR_MS = 500;              // never more often than this
var IDLE_MS = 2000;              // the safety net, while the voice is reading

var proto = window.Storage && Storage.prototype;
var setItem0 = proto && proto.setItem;
var getItem0 = proto && proto.getItem;
if (!setItem0) return;           // no storage at all: nothing to coalesce

var pending = null;              // {key, value} not yet on disk
var timer = null;
var lastWrite = 0;
var lastSentence = null;
var lastChapter = null;
var writes = 0;                  // for a driver to count

function put(key, value) {
  writes++;
  setItem0.call(localStorage, key, value);
}

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!pending) return false;
  var p = pending; pending = null;
  lastWrite = Date.now();
  try { put(p.key, p.value); } catch (e) { /* storage full or off */ }
  return true;
}

/* THE TRAILING WRITE IS A SAFETY NET, NOT THE RULE. While the voice is
   reading, the SENTENCE is what writes: a trailing timer at the 500 ms floor
   would fire every 500 ms whatever the sentence did, which on a chapter whose
   sentences are one word long (a contents list) is twenty writes in ten
   seconds -- the floor doing all the work and "once per sentence" doing none.
   So while it is playing the timer is set long, and every move resets it, so
   it only ever fires if the voice STOPS between sentences: nothing is lost,
   and nothing is written for the sake of a clock. Paused -- a cursor being
   moved by hand -- the 500 ms floor is the whole rule, which is what it is
   for. */
function playing() {
  var c = window.ReaderControl;
  try { return !!(c && typeof c.isPaused === "function" && !c.isPaused()); }
  catch (e) { return false; }
}

function schedule() {
  if (timer) clearTimeout(timer);
  var wait = playing() ? IDLE_MS : Math.max(0, FLOOR_MS - (Date.now() - lastWrite));
  timer = setTimeout(function () { timer = null; flush(); }, wait);
}

/* WHICH SENTENCE THE VOICE IS IN. Asked of listen.js rather than tracked,
   because listen.js is the only thing on this page that knows -- and asking
   costs one map lookup. A page with no book open answers null, and then the
   500 ms floor is the whole rule, which is the right answer for a cursor
   being moved by hand. */
function sentenceNow() {
  var c = window.ReaderControl;
  if (!c || typeof c.getPosition !== "function") return null;
  try { var p = c.getPosition(); return p ? p.sentenceId : null; }
  catch (e) { return null; }
}

proto.setItem = function (key, value) {
  if (this !== localStorage || !CURSOR_RE.test(String(key))) {
    return setItem0.call(this, key, value);
  }
  pending = { key: String(key), value: String(value) };
  var s = sentenceNow();
  var moved = s !== null && s !== lastSentence;
  if (moved) lastSentence = s;
  if (moved && Date.now() - lastWrite >= FLOOR_MS) { flush(); return; }
  schedule();
};

/* A read must never see the past. `loadCursor` reads this key at mount,
   before anything has been written, so nothing depends on it -- but a second
   reader appearing later would otherwise get the value from before the last
   move, which is a bug that would take a week to find. */
proto.getItem = function (key) {
  if (this === localStorage && pending && String(key) === pending.key) return pending.value;
  return getItem0.call(this, key);
};

/* ---------------------------------------------------- where he left off
   The record's other writer is library/library.html, and neither may lose
   the other: this is a read-modify-write of the two keys the reader owns,
   `positions` and `last`, and everything else in `ttstv.reader.library` is
   put back byte for byte as it was found. That rule is memory.js's own and
   it is the only part of that file worth keeping. */
function libWrite(slug, chapterId, wordId) {
  if (!slug) return;
  var d = null;
  try { d = JSON.parse(getItem0.call(localStorage, LIB_KEY) || "null"); } catch (e) { d = null; }
  if (!d || typeof d !== "object") d = {};
  if (!d.positions || typeof d.positions !== "object") d.positions = {};
  var now = Date.now();
  var device = (window.Marginalia && Marginalia.deviceId) ? Marginalia.deviceId() : null;
  d.positions[slug] = { chapter: String(chapterId || ""), wordId: wordId || null,
                        hash: null, hashKind: "none", at: now, device: device };
  d.last = { book: slug, right: null, at: now, device: device };
  try { put(LIB_KEY, JSON.stringify(d)); } catch (e) {}
}

function mount(o) {
  o = o || {};
  var nav = o.nav;
  var slug = o.slug || (o.book && o.book.slug) || "";
  var control = o.control || null;

  /* the cursor announces every move (`ttstv:cursor`, book-nav.js), which is
     the only signal this file needs: it says which chapter and which word,
     and the write itself has already been queued by the wrapper above. */
  var target = o.bookEl || document;
  function onCursor(e) {
    var d = e && e.detail;
    if (!d) return;
    /* the chapter, and only the chapter: reading on inside one chapter does
       not change the answer to "which book was he last in, and where" by
       anything the shelf can show, and `leaving()` writes the word. */
    if (d.chapter === lastChapter) return;
    lastChapter = d.chapter;
    remember(d.chapter, d.word);
  }
  function remember(chIdx, wordIdx) {
    var cid = control && control.chapterIdOf ? control.chapterIdOf(chIdx) : null;
    if (!cid) return;
    var wordId = null;
    var map = control && control.map;
    if (map && map.byFlat && map.id === cid) wordId = map.byFlat.get(wordIdx) || null;
    libWrite(slug, cid, wordId);
  }
  target.addEventListener("ttstv:cursor", onCursor);

  function leaving() {
    flush();
    var c = nav && nav.cursor;
    if (c) remember(c.chapter, c.word);
  }
  addEventListener("pagehide", leaving);
  addEventListener("beforeunload", leaving);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") leaving();
  });

  return {
    flush: flush, leaving: leaving,
    get writes() { return writes; },
    get pending() { return pending ? pending.value : null; },
  };
}

window.Cursor = {
  mount: mount, flush: flush,
  get writes() { return writes; },
  resetCount: function () { writes = 0; },
  FLOOR_MS: FLOOR_MS, IDLE_MS: IDLE_MS, LIB_KEY: LIB_KEY,
};
})();
