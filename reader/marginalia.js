/* ============================================ MARGINALIA: THE READER'S HALF
 * The store above is the shape; this is the page. Osca, 31 August: "the
 * reader becomes a place you write in" -- highlights in four colours, notes
 * in the MARGIN beside the passage rather than in a modal, and bookmarks
 * drawn with the iOS/Safari glyph and repeated as marks on the scroll track.
 *
 * Every write goes through `margPatch`, which re-reads localStorage, merges,
 * writes, repaints and mirrors -- so a Library tab, a second reader and the
 * voice layer cannot lose each other's entries (MARGINALIA STORE, above).
 *
 * The mirror is studio's `/marginalia/<slug>`, which DOES NOT EXIST YET
 * (reader/README.md §6): until it lands `margWhy` holds studio's own words
 * and the margin says, in one line, that this Mac is the only copy. */
const MARG_COLOUR_KEY = "ttstv.reader.highlightColour";
const MARG_NOTE_MIN = 168;      // px of margin a note needs before it collapses to a mark
let MARG_WHY = null;            // why the last save did not reach the SSD

/* The last colour used is the default, and it is a DEVICE key rather than a
 * field of the mirrored record: it is this Mac's hand, like the Settings
 * window's geometry, and sending it to the phone is the mistake the settings
 * window's own entry already names. */
function margLastColour() {
  try { return margColour(localStorage.getItem(MARG_COLOUR_KEY)); }
  catch (e) { return MARG_COLOURS[0]; }
}
function margSetLastColour(c) {
  try { localStorage.setItem(MARG_COLOUR_KEY, margColour(c)); } catch (e) { /* storage off */ }
}

function margReadRec(slug) {
  let raw = null;
  try { raw = localStorage.getItem(margKey(slug)); } catch (e) { raw = null; }
  let d = null;
  try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
  return margPrune(margNormalise(d, slug), Date.now());
}

function margWriteRec(slug, rec) {
  try { localStorage.setItem(margKey(slug), JSON.stringify(rec)); return true; }
  catch (e) { return false; }
}

/* The only writer. `fn` is handed the CURRENT record off disk merged with
 * whatever this page holds, so nothing composed from this page's own state
 * is ever written whole over another writer's work. */
function margPatch(pane, fn) {
  const slug = paneSlug(pane);
  if (!slug) return null;
  const rec = margMerge(margReadRec(slug), pane.marg || margEmpty(slug));
  fn(rec);
  rec.saved = Date.now();
  rec.device = libDeviceId();
  const h = bookHashes.get(slug);
  if (h && h.hash) { rec.hash = h.hash; rec.hashKind = h.kind; }
  pane.marg = rec;
  margWriteRec(slug, rec);
  margPaint(pane);
  margMirror(slug, rec);
  return rec;
}

/* `TTS_DATA/reader/marginalia/<slug>.json`, through a route that does not
 * exist yet -- the third time this page has written a client before its
 * server (`/reader-settings`, `/phone-shelf`, `/reader-library`), and the
 * same shape each time: save locally first, POST second, keep the server's
 * own words so the page can say what happened in a sentence. */
async function margMirror(slug, rec) {
  const url = stateUrl(MARG_ROUTE + encodeURIComponent(slug));
  if (!url) { MARG_WHY = "no studio behind this page"; margPaintWhy(); return { mirrored: false, why: MARG_WHY }; }
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
                                   body: JSON.stringify(rec) });
    const body = await res.json().catch(() => ({}));
    MARG_WHY = res.ok ? null : ((body && body.error) || ("HTTP " + res.status));
    margPaintWhy();
    return { mirrored: res.ok, why: MARG_WHY, path: body && body.path };
  } catch (e) {
    MARG_WHY = "no studio behind this page";
    margPaintWhy();
    return { mirrored: false, why: MARG_WHY };
  }
}

/* The mirror is MERGED, not adopted. `libFetchMirror`'s rule is
 * newer-record-wins because the library record is one document; this one is
 * a set of entries with ids, so taking the newer whole file would drop
 * whatever the phone wrote while this Mac was writing something else. */
async function margFetchMirror(pane) {
  const slug = paneSlug(pane);
  const url = slug ? stateUrl(MARG_ROUTE + encodeURIComponent(slug)) : null;
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    const merged = margPrune(margMerge(pane.marg || margEmpty(slug), d), Date.now());
    pane.marg = merged;
    margWriteRec(slug, merged);
    margPaint(pane);
    return merged;
  } catch (e) { return null; }
}

/* Another tab wrote this book's key -- the Library adding a bookmark, a
 * second reader window, the voice layer. Take it and repaint; never write
 * back from here, which is how two tabs ping-pong. */
window.addEventListener("storage", (e) => {
  if (!e || !e.key || e.key.indexOf(MARG_PREFIX) !== 0) return;
  const slug = e.key.slice(MARG_PREFIX.length);
  for (const pane of panes) {
    if (paneSlug(pane) !== slug) continue;
    pane.marg = margMerge(pane.marg || margEmpty(slug), margReadRec(slug));
    margPaint(pane);
  }
});

/* The store every page reads is localStorage, and it is synchronous, so the
 * marks land WITH the words rather than a repaint later. The mirror is
 * reconciliation and is asked for AFTER the book is on screen -- never in
 * front of book.json and the timings, which are what a reader is waiting
 * for. (The same ordering rule the Library's `libMirrorOnce` follows, and
 * `reader/tests/test_reader_page.py` pins the first three requests.) */
function margLoad(pane) {
  const slug = paneSlug(pane);
  if (!slug) { pane.marg = margEmpty(""); return null; }
  pane.marg = margReadRec(slug);
  return pane.marg;
}

let margMirrorAsked = false;
function margMirrorOnce() {
  if (margMirrorAsked) return null;
  margMirrorAsked = true;
  return Promise.all(panes.map(p => margFetchMirror(p)));
}

// ------------------------------------------------------- anchors on the page
/* The chapter's word ids in document order. `pane.wordEls` is a Map filled by
 * renderParagraph in exactly that order, so this is the page's own answer and
 * not a second walk of book.json that could disagree with it. */
function margPageIds(pane) {
  if (!pane || !pane.wordEls) return [];
  return Array.from(pane.wordEls.keys());
}
function margPageIndex(pane) {
  const idx = {};
  const ids = margPageIds(pane);
  for (let i = 0; i < ids.length; i++) idx[ids[i]] = i;
  return idx;
}

/* The word ids inside the current selection, in document order, or [] when
 * the selection is empty or holds no words. `containsNode(el, true)` is the
 * partial-containment form: a selection that clips a word still counts it,
 * because a person dragging across a line means the words they touched. */
function margSelectedIds(pane) {
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
  const out = [];
  for (const [id, el] of pane.wordEls) {
    try { if (sel.containsNode(el, true)) out.push(id); }
    catch (e) { /* a DOM without containsNode: no selection anchoring here */ }
  }
  return out;
}

/* What the menu is about: a selection if there is one, otherwise the word
 * under the pointer. Returns {from, to, ids, word} or null. */
function margTargetFrom(pane, wordEl) {
  const picked = margSelectedIds(pane);
  if (picked.length) return { from: picked[0], to: picked[picked.length - 1], ids: picked, word: null };
  if (!wordEl || !wordEl.dataset || !wordEl.dataset.id) return null;
  const id = wordEl.dataset.id;
  return { from: id, to: id, ids: [id], word: wordEl.dataset.text || wordEl.textContent.trim() };
}

// -------------------------------------------------------------- the writes
function margAddHighlight(pane, target, colour) {
  const c = margColour(colour);
  margSetLastColour(c);
  const now = Date.now();
  const h = bookHashes.get(paneSlug(pane)) || { hash: null, kind: "none" };
  margPatch(pane, (rec) => {
    rec.highlights.push({ id: margId("h", now), from: target.from, to: target.to, colour: c,
                          at: now, device: libDeviceId(), witness: h.hash, witnessKind: h.kind });
  });
  margClearSelection();
  return c;
}

function margRecolour(pane, id, colour) {
  const c = margColour(colour);
  margSetLastColour(c);
  const now = Date.now();
  margPatch(pane, (rec) => {
    const h = rec.highlights.find(x => x.id === id);
    if (h && !h.deleted) { h.colour = c; h.at = now; h.device = libDeviceId(); }
  });
  return c;
}

/* A delete is a TOMBSTONE, and the entry's text goes with the entry: keeping
 * the words of a deleted note in the file is the opposite of deleting it. */
function margRemove(pane, kind, id) {
  const now = Date.now();
  margPatch(pane, (rec) => {
    const i = rec[kind].findIndex(x => x.id === id);
    if (i < 0) return;
    rec[kind][i] = { id: id, at: now, deleted: now, device: libDeviceId(),
                     witness: null, witnessKind: "none" };
  });
}

function margAddNote(pane, target, text) {
  const now = Date.now();
  const h = bookHashes.get(paneSlug(pane)) || { hash: null, kind: "none" };
  const id = margId("n", now);
  margPatch(pane, (rec) => {
    rec.notes.push({ id: id, from: target.from, to: target.to, text: String(text || ""),
                     at: now, device: libDeviceId(), witness: h.hash, witnessKind: h.kind });
  });
  margClearSelection();
  return id;
}

function margEditNote(pane, id, text) {
  const now = Date.now();
  margPatch(pane, (rec) => {
    const n = rec.notes.find(x => x.id === id);
    if (n && !n.deleted) { n.text = String(text || ""); n.at = now; n.device = libDeviceId(); }
  });
}

function margBookmarkAt(pane, wordId) {
  return margLive(pane.marg, "bookmarks").find(b => b.wordId === wordId) || null;
}

function margAddBookmark(pane, wordId) {
  const now = Date.now();
  const h = bookHashes.get(paneSlug(pane)) || { hash: null, kind: "none" };
  const chap = (pane.book.chapters || []).find(c => c.id === pane.currentChapterId) || null;
  margPatch(pane, (rec) => {
    rec.bookmarks.push({ id: margId("b", now), wordId: wordId, at: now, made: now,
                         chapter: chap ? chap.id : null, chapterTitle: chap ? chap.title : null,
                         device: libDeviceId(), witness: h.hash, witnessKind: h.kind });
  });
}

function margClearSelection() {
  const sel = window.getSelection && window.getSelection();
  try { if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (e) { /* no selection API */ }
}

// ------------------------------------------------------------- the painting
/* Three layers over one chapter, repainted whole rather than diffed: a
 * chapter is a few thousand spans and this runs on a write, a chapter turn or
 * a resize -- never on the clock. */
function margPaint(pane) {
  if (!pane || !pane.els || !pane.els.reading || !pane.marg) return;
  margPaintHighlights(pane);
  margPaintMargin(pane);
  margPaintTrack(pane);
  margPaintWhy();
  if (OW.on && OW.pane === pane) owPaint(true);
}

function margPaintHighlights(pane) {
  const ids = margPageIds(pane);
  const hs = margLive(pane.marg, "highlights");
  for (const [, el] of pane.wordEls) {
    if (el.dataset.hl) { el.classList.remove("hl", "hl-" + el.dataset.hl); delete el.dataset.hl; }
    if (el.dataset.hlId) delete el.dataset.hlId;
  }
  if (!hs.length) return;
  // Newest last, so the newest write is the one that lands on a shared word
  // -- margColourAt's rule, applied by painting in the same order.
  const sorted = hs.slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  for (const h of sorted) {
    for (const id of margSpanIds(h.from, h.to, ids)) {
      const el = pane.wordEls.get(id);
      if (!el) continue;
      if (el.dataset.hl) el.classList.remove("hl-" + el.dataset.hl);
      el.classList.add("hl", "hl-" + h.colour);
      el.dataset.hl = h.colour;
      el.dataset.hlId = h.id;
    }
  }
}

/* The block element a word sits in -- a note is aligned to the FIRST LINE of
 * its anchor, and a line is not an element, so the paragraph is what can be
 * measured. */
function margAnchorEl(pane, wordId) {
  const w = pane.wordEls.get(wordId);
  if (!w) return null;
  return w.closest("p, h3, blockquote, .argument") || w.parentElement;
}

function margMarginBox(pane, anchorEl) {
  const reading = pane.els.reading;
  if (!anchorEl || !reading) return null;
  const top = anchorEl.offsetTop;
  const left = anchorEl.offsetLeft;
  const width = anchorEl.offsetWidth;
  const right = reading.clientWidth - (left + width);
  return { top, left, width, right };
}

/* PRESENT OR ABSENT, NEVER MERELY EMPTY -- the rule this page adopted for the
 * sync control and the play bar (reader/README.md, 31 Aug), applied here for
 * the same reason and one more: `.paneReading`'s children are the book, and a
 * reader with no marginalia must have exactly the DOM it had before this
 * existed, down to the child count. So the layer is created on the first mark
 * and removed with the last. */
function margLayerFor(pane, need) {
  const reading = pane.els.reading;
  let layer = reading.querySelector(".margLayer");
  if (!need) { if (layer) layer.remove(); return null; }
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "margLayer";
    reading.appendChild(layer);
  }
  return layer;
}

function margPaintMargin(pane) {
  const idx = margPageIndex(pane);
  const notes = margOrder(margLive(pane.marg, "notes"), idx);
  const bookmarks = margOrder(margLive(pane.marg, "bookmarks"), idx);
  const layer = margLayerFor(pane, notes.length + bookmarks.length > 0);
  if (!layer) return;
  layer.innerHTML = "";
  const h = bookHashes.get(paneSlug(pane)) || { hash: null, kind: "none" };
  const offstage = [];

  for (const n of notes) {
    const anchor = margAnchorEl(pane, n.from);
    if (!anchor) { offstage.push(n); continue; }
    const box = margMarginBox(pane, anchor);
    const stale = margStale(n, h.hash, h.kind);
    const wide = box.right >= MARG_NOTE_MIN;
    const el = document.createElement("div");
    el.className = "margNote" + (wide ? "" : " collapsed") + (stale ? " stale" : "");
    el.dataset.noteId = n.id;
    el.style.top = box.top + "px";
    if (wide) {
      el.style.left = (box.left + box.width + 10) + "px";
      el.style.width = Math.min(box.right - 18, 260) + "px";
      el.innerHTML = '<div class="margNoteText"></div>'
        + (stale ? '<div class="margWhen">made against an older parse</div>' : "");
      el.querySelector(".margNoteText").textContent = n.text;
    } else {
      // Too narrow to write in (a parallel view, a phone): the note becomes a
      // small mark at the anchor that opens on tap. Nothing is hidden -- the
      // mark is the note, folded.
      el.style.left = Math.max(0, box.left - 16) + "px";
      el.title = n.text;
      el.textContent = "✎";
    }
    layer.appendChild(el);
  }

  for (const b of bookmarks) {
    const anchor = margAnchorEl(pane, b.wordId);
    if (!anchor) { offstage.push(b); continue; }
    const box = margMarginBox(pane, anchor);
    const el = document.createElement("div");
    el.className = "margBm" + (margStale(b, h.hash, h.kind) ? " stale" : "");
    el.dataset.bookmarkId = b.id;
    el.dataset.wordId = b.wordId;
    el.style.top = box.top + "px";
    el.style.left = Math.max(2, box.left - 22) + "px";
    el.title = "Bookmark";
    el.innerHTML = MARG_GLYPH;
    layer.appendChild(el);
  }

  // An anchor whose chapter is not on screen is not lost and is not silently
  // dropped: it is one line at the end of the margin, and it says so.
  if (offstage.length) {
    const line = document.createElement("div");
    line.className = "margOff";
    // Under the last paragraph, not at the top of a layer that is only as
    // tall as the window: the layer scrolls with the text but `inset: 0`
    // sizes it to the visible box, so "at the end" has to be measured.
    const blocks = pane.els.reading.querySelectorAll("p, h3, blockquote, .argument");
    const last = blocks.length ? blocks[blocks.length - 1] : null;
    line.style.top = (last ? last.offsetTop + last.offsetHeight + 18 : 0) + "px";
    line.textContent = offstage.length === 1
      ? "1 mark is anchored in another chapter of this book."
      : offstage.length + " marks are anchored in other chapters of this book.";
    layer.appendChild(line);
  }
}

/* The iOS/Safari bookmark glyph -- a ribbon with a notch cut out of its foot.
 * Drawn rather than fetched: it is eleven numbers, and a reader that has to
 * load a file to draw a bookmark cannot draw one offline. */
const MARG_GLYPH = '<svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true">'
  + '<path d="M1 1.6A.6.6 0 0 1 1.6 1h8.8a.6.6 0 0 1 .6.6V15l-5-3.2L1 15Z" '
  + 'fill="currentColor"/></svg>';

/* THE SCROLL BAR CARRIES A MARK FOR EACH BOOKMARK (Osca, 31 Aug), at its
 * proportional position on the track, and clicking a mark scrolls exactly to
 * that bookmark. It is our own track beside the native scrollbar rather than
 * a restyled one: a scrollbar cannot hold children in any browser this app
 * runs in, and a scrollbar that is ours everywhere is the same in the app, in
 * Safari and on the phone. */
function margScroller(pane) {
  // Synced, `#panes` is the scroller and the panes scroll as one
  // (html[data-panes="synced"] in the stylesheet); otherwise each pane's own
  // reading column is. The track has to hang off whichever one moves.
  const panesEl = document.getElementById("panes");
  if (document.documentElement.getAttribute("data-panes") === "synced" && panesEl) return panesEl;
  return pane.els.reading;
}

function margPaintTrack(pane) {
  const host = pane.els.root;
  const existing = host.querySelector(".bmTrack");
  const scroller = margScroller(pane);
  const bookmarks = margLive(pane.marg, "bookmarks");
  const total = scroller ? scroller.scrollHeight : 0;
  // Absent, not hidden -- a track with no marks on it is a 10-px strip of
  // nothing sitting over the last word of every line.
  if (!bookmarks.length || !total) { if (existing) existing.remove(); return; }
  const track = existing || document.createElement("div");
  track.className = "bmTrack";
  track.innerHTML = "";
  if (!existing) host.appendChild(track);
  for (const b of bookmarks) {
    const anchor = margAnchorEl(pane, b.wordId);
    if (!anchor) continue;
    const y = anchor.offsetTop;
    const el = document.createElement("button");
    el.className = "bmMark";
    el.type = "button";
    el.dataset.bookmarkId = b.id;
    el.dataset.wordId = b.wordId;
    el.style.top = (100 * Math.max(0, Math.min(1, y / total))) + "%";
    el.setAttribute("aria-label", "Go to bookmark");
    el.title = "Go to bookmark";
    track.appendChild(el);
  }
}

/* One line, in words, when the mirror did not take -- the phone-shelf panel's
 * sentence and for its reason: a person who has just written a note is owed
 * the fact that it is on this Mac only. */
function margPaintWhy() {
  const el = document.getElementById("margWhy");
  if (!el) return;
  const any = panes.some(p => p.marg && (margLive(p.marg, "notes").length
    || margLive(p.marg, "highlights").length || margLive(p.marg, "bookmarks").length));
  if (!MARG_WHY || !any) { el.textContent = ""; el.hidden = true; return; }
  el.hidden = false;
  el.textContent = "Notes, highlights and bookmarks are on this Mac only — not mirrored to "
    + "TTS_DATA/reader/marginalia: " + MARG_WHY + ".";
}

function margScrollToWord(pane, wordId) {
  const el = pane.wordEls.get(wordId);
  if (!el) return false;
  el.scrollIntoView({ block: "center" });
  el.classList.add("bmLanded");
  setTimeout(() => el.classList.remove("bmLanded"), 1400);
  return true;
}

/* Repaint on anything that moves the text under the marks: a resize, the
 * reading font or size changing, the sidebar opening. A ResizeObserver where
 * there is one, and `resize` everywhere, because the node harness has neither
 * and must still be able to call margPaint directly. */
function margRelayout() {
  // Guarded: `panes` is declared in readercontrol.js, a later `<script src>`
  // (reader-split step 3, 3 Sep). The ResizeObserver below fires once on its
  // own `.observe()` call, asynchronously, with no ordering promise against
  // the rest of the script chain still fetching -- so on a slow enough load
  // this can and does run before readercontrol.js has assigned `panes`,
  // where the bare name falls through to the DOM's own `<div id="panes">`
  // (auto-exposed by id on the global object, since it is no longer TDZ
  // across separate script chunks) and `for...of` on that throws "panes is
  // not iterable". Reader-split found this live via `pane_sync.py`'s "no
  // page errors" check going red on roughly one run in four; reproduced
  // identically against the already-committed cut 3/4/5 code (this bug
  // predates find.js and is not caused by it), so it is fixed here rather
  // than carried forward. Same shape as reader.html's own `frame()` guard
  // a few hundred lines below (`if (!Array.isArray(panes)) { ...; return; }`).
  if (!Array.isArray(panes)) return;
  for (const pane of panes) if (pane.marg) margPaint(pane);
}

// ------------------------------------------------------------------ the menu
/* ONE context menu, and it is the shelf's -- `#menu`, `menuRowHTML`,
 * `showMenu`/`hideMenu` are library.html's, brought over unchanged in shape
 * so the two pages open the same object with the same keys and the same
 * "every disabled row says why" rule. What is new is the colour row: four
 * swatches inline, the last one used FIRST, because Osca's sentence is "the
 * choice is in the menu" and a submenu is a second click for four items.
 *
 * The list is PURE. Everything it needs -- the word, what the anchor already
 * carries, which colour was last used -- is passed in, so the node harness
 * can drive every state with no DOM and no store. */
function readerMenuItems(ctx) {
  ctx = ctx || {};
  const items = [];
  items.push(ctx.word
    ? { id: "lookup", label: "Look up “" + ctx.word + "”" }
    : { id: "lookup", label: "Look up", disabled: "look-up is one word at a time" });
  items.push({ id: "colours", colours: readerColourOrder(ctx.last), current: ctx.hlColour || null,
               label: ctx.hlId ? "Change colour" : "Highlight" });
  items.push(ctx.noteId
    ? { id: "editnote", label: "Edit note…" }
    : { id: "note", label: "Add note…" });
  items.push(ctx.bookmarkId
    ? { id: "unbookmark", label: "Remove bookmark" }
    : { id: "bookmark", label: "Add bookmark" });
  const rest = [];
  if (ctx.hlId) rest.push({ id: "unhighlight", label: "Remove highlight" });
  if (ctx.noteId) rest.push({ id: "delnote", label: "Delete note", danger: true });
  if (rest.length) { items.push({ id: "sep" }); for (const r of rest) items.push(r); }
  return items;
}

/* The last colour used is the default and the menu shows it first; the other
 * three keep Osca's order behind it, so the row never reshuffles into
 * something a hand has to read. */
function readerColourOrder(last) {
  const first = margColour(last);
  return [first].concat(MARG_COLOURS.filter(c => c !== first));
}

function readerMenuRowHTML(it) {
  if (it.id === "sep") return "<hr>";
  if (it.id === "colours") {
    const swatches = it.colours.map(c =>
      '<button role="menuitemradio" class="swatch sw-' + c + (it.current === c ? " on" : "")
      + '" data-act="colour:' + c + '" aria-label="' + esc(c) + '"'
      + (it.current === c ? ' aria-checked="true"' : ' aria-checked="false"') + "></button>").join("");
    return '<div class="menucolours"><span class="menulabel">' + esc(it.label) + "</span>"
      + '<span class="swatches">' + swatches + "</span></div>";
  }
  const cls = [it.danger ? "danger" : "", it.disabled ? "off" : ""].filter(Boolean).join(" ");
  const why = it.disabled ? '<span class="menuwhy">' + esc(it.disabled) + "</span>" : "";
  return '<button role="menuitem" data-act="' + esc(it.id) + '"' + (cls ? ' class="' + cls + '"' : "")
    + (it.disabled ? ' disabled aria-disabled="true"' : "") + ">"
    + '<span class="menulabel">' + esc(it.label) + "</span>" + why + "</button>";
}

let readerMenuCtx = null;

function readerShowMenu(x, y, ctx) {
  const el = document.getElementById("menu");
  if (!el) return null;
  const items = readerMenuItems(ctx);
  el.innerHTML = items.map(readerMenuRowHTML).join("");
  readerMenuCtx = ctx;
  el.hidden = false;
  if (isPhone()) { el.style.left = ""; el.style.top = ""; }
  else {
    el.style.left = Math.max(4, Math.min(x, window.innerWidth - 220)) + "px";
    el.style.top = Math.max(4, Math.min(y, window.innerHeight - 200)) + "px";
  }
  const buttons = Array.from(el.querySelectorAll("button"));
  const first = buttons.find(b => !b.disabled) || buttons[0];
  if (first && first.focus) first.focus();
  return items;
}

function readerHideMenu() {
  const el = document.getElementById("menu");
  if (el) el.hidden = true;
  readerMenuCtx = null;
}

/* What the menu is opened ON, resolved once so every item reads the same
 * answer: the target span, and whatever already sits on its first word. */
function readerMenuContext(pane, wordEl) {
  const target = margTargetFrom(pane, wordEl);
  if (!target) return null;
  const ids = margPageIds(pane);
  const hs = margLive(pane.marg, "highlights");
  let hl = null;
  for (const h of hs) {
    if (margSpanIds(h.from, h.to, ids).indexOf(target.from) < 0) continue;
    if (!hl || (h.at || 0) >= (hl.at || 0)) hl = h;
  }
  let note = null;
  for (const n of margLive(pane.marg, "notes")) {
    if (margSpanIds(n.from, n.to, ids).indexOf(target.from) < 0) continue;
    if (!note || (n.at || 0) >= (note.at || 0)) note = n;
  }
  const bm = margBookmarkAt(pane, target.from);
  return { pane, target, word: target.word, last: margLastColour(),
           hlId: hl ? hl.id : null, hlColour: hl ? hl.colour : null,
           noteId: note ? note.id : null, bookmarkId: bm ? bm.id : null };
}

function readerMenuAct(act) {
  const ctx = readerMenuCtx;
  readerHideMenu();
  if (!ctx || !act) return null;
  const pane = ctx.pane;
  if (act.indexOf("colour:") === 0) {
    const c = act.slice(7);
    return ctx.hlId ? margRecolour(pane, ctx.hlId, c) : margAddHighlight(pane, ctx.target, c);
  }
  switch (act) {
    case "lookup": {
      const el = pane.wordEls.get(ctx.target.from);
      if (el) el.click();
      return "lookup";
    }
    case "note": margOpenNoteEditor(pane, ctx.target, null); return "note";
    case "editnote": margOpenNoteEditor(pane, ctx.target, ctx.noteId); return "editnote";
    case "delnote": margRemove(pane, "notes", ctx.noteId); return "delnote";
    case "unhighlight": margRemove(pane, "highlights", ctx.hlId); return "unhighlight";
    case "bookmark": margAddBookmark(pane, ctx.target.from); return "bookmark";
    case "unbookmark": margRemove(pane, "bookmarks", ctx.bookmarkId); return "unbookmark";
    default: return null;
  }
}

/* THE NOTE IS WRITTEN IN THE MARGIN, not in a modal (Osca: "an inline field
 * in the margin beside the passage"). The editor is the note's own box with a
 * textarea in it, so writing one and reading one happen in the same place at
 * the same width -- and when the margin is too narrow the editor opens over
 * the column instead, which is the only honest fallback: a 60-px margin is
 * not somewhere to write. */
function margOpenNoteEditor(pane, target, noteId) {
  // Draw what is already there, then make sure there is a layer to write in
  // even when this is the book's first note.
  margPaintMargin(pane);
  const layer2 = margLayerFor(pane, true);
  if (!layer2) return null;
  const existing = noteId ? margLive(pane.marg, "notes").find(n => n.id === noteId) : null;
  const anchorId = existing ? existing.from : target.from;
  const anchor = margAnchorEl(pane, anchorId);
  if (!anchor) return null;
  const box = margMarginBox(pane, anchor);
  const wide = box.right >= MARG_NOTE_MIN;
  const old = layer2.querySelector(".margNote.editing");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "margNote editing" + (wide ? "" : " narrow");
  el.style.top = box.top + "px";
  el.style.left = (wide ? box.left + box.width + 10 : box.left) + "px";
  el.style.width = (wide ? Math.min(box.right - 18, 260) : Math.min(box.width, 320)) + "px";
  const ta = document.createElement("textarea");
  ta.className = "margNoteInput";
  ta.rows = 3;
  ta.value = existing ? existing.text : "";
  ta.setAttribute("aria-label", "Note");
  el.appendChild(ta);
  const hint = document.createElement("div");
  hint.className = "margWhen";
  hint.textContent = "⏎ to save · esc to cancel";
  el.appendChild(hint);
  layer2.appendChild(el);
  if (ta.focus) ta.focus();

  let done = false;
  const save = () => {
    if (done) return; done = true;
    const text = ta.value.trim();
    if (!text) { if (existing) margRemove(pane, "notes", existing.id); else margPaint(pane); return; }
    if (existing) margEditNote(pane, existing.id, text);
    else margAddNote(pane, { from: target.from, to: target.to }, text);
  };
  const cancel = () => { if (done) return; done = true; margPaint(pane); };
  /* AND THE FOCUS COMES BACK TO THE PAGE. `done` already stops the field
   * being saved twice; what was missing is that after ⏎ or esc the textarea
   * was still the focused element, so the very next keystroke hit the global
   * handler's field guard and did nothing -- press N, write a note, press N
   * again and the second note never opened. Blurring is the whole fix, and
   * it belongs to whichever of the two ends the editing. */
  const release = () => { try { ta.blur(); } catch (e) { /* no focus model */ } };
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); release(); return; }
    // Enter saves; shift-Enter is a second line, because a note is prose.
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); release(); }
  });
  ta.addEventListener("blur", () => setTimeout(save, 0));
  return el;
}

/* OPENING AT A BOOKMARK. The Library's book menu offers "Open at bookmark…"
 * and passes `?bm=<id>`; the reader resolves the id to a word, the word to a
 * chapter, and lands there. The chapter is found by SCANNING the book rather
 * than by splitting the id on its first dot: `c003.p0001.s01.w001` does begin
 * with its chapter today, and a reader that quietly depends on that is a
 * reader that breaks the day core/schema.py renumbers anything. */
function margChapterOfWord(book, wordId) {
  if (!book || !wordId) return null;
  for (const c of book.chapters || []) {
    for (const p of c.paragraphs || []) {
      for (const s of p.sentences || []) {
        for (const w of s.words || []) if (w && w.id === wordId) return c.id;
      }
    }
  }
  return null;
}

/* Where a book opens: the bookmark the Library named, else the URL's chapter,
 * else where he left off, else the first chapter. Pure, and it returns the
 * REASON as well as the answer so the status line can say "opened at a
 * bookmark" rather than the reader silently landing somewhere unexplained. */
function margOpenAt(opts) {
  const o = opts || {};
  if (o.bookmarkChapter) return { chapter: o.bookmarkChapter, wordId: o.bookmarkWordId, why: "bookmark" };
  if (o.requestedChapter) return { chapter: o.requestedChapter, wordId: null, why: "url" };
  if (o.rememberedChapter) return { chapter: o.rememberedChapter, wordId: null, why: "memory" };
  return { chapter: o.firstChapter || null, wordId: null, why: "first" };
}

// ----------------------------------------------------------------- wiring
function margWirePane(pane) {
  const reading = pane.els.reading;

  /* The right-click. `preventDefault` here is what stops the browser's own
   * menu: settings.js's document-level suppressor returns early when the page
   * has already answered (`e.defaultPrevented`), and this listener is on a
   * descendant, so it runs first. A right-click on empty space between
   * paragraphs opens nothing rather than opening a menu about no word. */
  reading.addEventListener("contextmenu", (e) => {
    const wEl = e.target.closest(".word");
    const inNote = e.target.closest(".margNote, .margBm");
    if (inNote) return;                      // the margin has its own menu below
    const ctx = readerMenuContext(pane, wEl);
    if (!ctx) return;
    e.preventDefault();
    focusedPane = pane;
    readerShowMenu(e.clientX, e.clientY, ctx);
  });

  /* A note, a folded note or a bookmark glyph in the margin. A click on a
   * note opens it for editing (Osca: "click to edit"); a right-click on
   * either gets the same menu the word does, so Delete note and Remove
   * bookmark are where a hand looks for them. */
  reading.addEventListener("click", (e) => {
    const bm = e.target.closest(".margBm");
    if (bm) { margScrollToWord(pane, bm.dataset.wordId); return; }
    const note = e.target.closest(".margNote");
    if (!note || note.classList.contains("editing")) return;
    const id = note.dataset.noteId;
    const n = margLive(pane.marg, "notes").find(x => x.id === id);
    if (n) margOpenNoteEditor(pane, { from: n.from, to: n.to }, id);
  });
  reading.addEventListener("contextmenu", (e) => {
    const el = e.target.closest(".margNote, .margBm");
    if (!el) return;
    const id = el.dataset.noteId
      ? (margLive(pane.marg, "notes").find(x => x.id === el.dataset.noteId) || {}).from
      : el.dataset.wordId;
    const ctx = readerMenuContext(pane, pane.wordEls.get(id));
    if (!ctx) return;
    e.preventDefault();
    focusedPane = pane;
    readerShowMenu(e.clientX, e.clientY, ctx);
  });

  /* THE PHONE HAS NO RIGHT-CLICK. A finger held still on a word for 500 ms
   * opens the same menu, and the click that follows the release is swallowed
   * so a held press never also looks the word up. `reader/library.html`'s
   * `makeLongPress` is the same behaviour on the shelf; this is the reader's,
   * written here rather than shared because the shared block may not touch
   * the DOM (MARGINALIA STORE, above) and a fourth shell file for eighteen
   * lines is the trade `test_library_store.py` already refuses.
   * Movement past 10 px, a second finger or lifting early cancels. */
  let hold = null, holdAt = null, held = false;
  const cancelHold = () => { if (hold != null) { clearTimeout(hold); hold = null; } };
  reading.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    const wEl = e.target.closest(".word");
    if (!wEl) return;
    held = false;
    holdAt = { x: e.clientX, y: e.clientY };
    cancelHold();
    hold = setTimeout(() => {
      hold = null; held = true;
      const ctx = readerMenuContext(pane, wEl);
      if (!ctx) return;
      focusedPane = pane;
      readerShowMenu(holdAt.x, holdAt.y, ctx);
    }, 500);
  });
  reading.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "touch" || hold == null || !holdAt) return;
    if (Math.abs(e.clientX - holdAt.x) > 10 || Math.abs(e.clientY - holdAt.y) > 10) cancelHold();
  });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) reading.addEventListener(t, cancelHold);
  reading.addEventListener("click", (e) => {
    if (!held) return;
    held = false;
    e.stopPropagation(); e.preventDefault();     // capture phase: the look-up below never hears it
  }, { capture: true });

  // The scroll track's marks: click one and land exactly on its bookmark.
  pane.els.root.addEventListener("click", (e) => {
    const mark = e.target.closest(".bmMark");
    if (!mark) return;
    e.preventDefault();
    focusedPane = pane;
    margScrollToWord(pane, mark.dataset.wordId);
  });

  // The marks are placed against the scroller's own height, so they move when
  // it does.
  const scroller = margScroller(pane);
  if (scroller && scroller.addEventListener) {
    scroller.addEventListener("scroll", () => { /* the track is proportional; nothing to move */ }, { passive: true });
  }
}

// One menu, one set of dismissals -- the shelf's, and popover.js's third rule:
// a click outside, Esc, or acting on it.
document.addEventListener("click", (e) => {
  const el = document.getElementById("menu");
  if (!el || el.hidden) return;
  const b = e.target.closest ? e.target.closest("#menu button") : null;
  if (b) { e.preventDefault(); readerMenuAct(b.dataset.act); return; }
  if (!e.target.closest || !e.target.closest("#menu")) readerHideMenu();
});
document.addEventListener("keydown", (e) => {
  const el = document.getElementById("menu");
  if (el && !el.hidden && e.key === "Escape") { e.preventDefault(); readerHideMenu(); }
});

window.addEventListener("resize", () => margRelayout());
if (typeof ResizeObserver !== "undefined") {
  try {
    const ro = new ResizeObserver(() => margRelayout());
    ro.observe(document.documentElement);
  } catch (e) { /* older WebKit: the resize listener above is the whole story */ }
}
// The reading font, its size and its line height all move every anchor's box.
if (window.TTSTVSettings && TTSTVSettings.subscribe) {
  try { TTSTVSettings.subscribe(() => setTimeout(margRelayout, 0)); } catch (e) { /* no store */ }
}

// A door for the tests and for voiceui, the same shape as TTSTVView and
// TTSTVFind: the three verbs the voice layer asked for, and nothing else.
window.TTSTVMarginalia = {
  record(pane) { return (pane || panes[0]).marg; },
  note(text, pane) {
    const p = pane || focusedPane || panes[0];
    const t = margTargetFrom(p, p.activeWordEl);
    return t ? margAddNote(p, t, text) : null;
  },
  highlight(colour, pane) {
    const p = pane || focusedPane || panes[0];
    const t = margTargetFrom(p, p.activeWordEl);
    return t ? margAddHighlight(p, t, colour) : null;
  },
  bookmark(pane) {
    const p = pane || focusedPane || panes[0];
    const t = margTargetFrom(p, p.activeWordEl);
    return t ? (margAddBookmark(p, t.from), t.from) : null;
  },
  menuItems: readerMenuItems, menuAct: readerMenuAct, showMenu: readerShowMenu,
  context: readerMenuContext, paint: margPaint, load: margLoad, patch: margPatch,
  openAt: margOpenAt, chapterOfWord: margChapterOfWord, colourOrder: readerColourOrder,
  scrollToWord: margScrollToWord, openNoteEditor: margOpenNoteEditor,
  read: margReadRec, key: margKey, colours: MARG_COLOURS,
  lastColour: margLastColour, get why() { return MARG_WHY; },
};

function libDocRead() {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    const d = raw ? JSON.parse(raw) : null;
    return (d && typeof d === "object") ? d : {};
  } catch (e) { return {}; }
}
// The only writer here. Re-reads, hands the CURRENT document to `fn`, writes
// it back -- never a whole document composed from this page's own state.
function libDocPatch(fn) {
  const d = libDocRead();
  if (!d.version) d.version = 1;
  if (!d.positions || typeof d.positions !== "object") d.positions = {};
  fn(d);
  d.saved = Date.now();
  try { localStorage.setItem(LIB_KEY, JSON.stringify(d)); return true; }
  catch (e) { return false; }
}

function paneSlug(pane) {
  return String((pane && pane.bookPath) || "").split("/").filter(Boolean).pop() || null;
}
