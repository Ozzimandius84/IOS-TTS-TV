// ------------------------------------------------------------------- ⌘F find
// The Reader's own find, in every Reader tab -- ⌘F where there is a ⌘ and
// Ctrl+F where there is not (an iPad's Bluetooth keyboard sends exactly
// that, and so does every non-Mac browser), the app's Edit › Find… routed
// to the same door (window.TTSTVFind, at the foot of this file).
//
// Why not leave it to the browser. Safari's ⌘F searches the *rendered*
// text -- here a run of <span class="word"> nodes whose textContent is
// `Word.raw`, punctuation and all -- so it can find "King," and outline it,
// and then know nothing whatever about where that is in the book. **A match
// here is a word id**: the id `timings/cNNN.json` is keyed on and the id
// `ReaderControl.seekToWord` takes. So landing on a match puts the audio
// clock on that word, and -- when the match is in another chapter --
// renderChapter() moves the sidebar with it. Sidebar, audio and text stay
// one position, which is the whole point of the reader.
//
// Scope: this chapter by default; the "Whole book" toggle searches every
// chapter of `book.json` and steps across chapters.
//
// The index is built once per book and cached on the book object: a chapter
// is a list of paragraphs, a paragraph a flat run of {id, key} words. A
// phrase may match across sentences inside one paragraph and never across a
// paragraph or a chapter -- "...at rest. Come away" is not a phrase anyone
// typed, it is two sentences meeting.
const FIND_DEBOUNCE_MS = 120;

// One comparable key for a word or a query token: case folded, with
// everything that is not a letter or a digit removed -- so a query typed
// without punctuation finds `King,` `don't` and `'Tis` alike, and the
// dictionary's own apostrophe problem never reaches the search box.
// Unicode-aware (\p{L}) because half of this project's books are Latin.
function findKey(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// A query -> the tokens a match must equal, in order. Punctuation-only
// input yields none, which is the same as an empty box.
function findTokens(query) {
  return String(query == null ? "" : query).split(/\s+/).map(findKey).filter(Boolean);
}

// chapters -> [{chapterId, title, paras: [[{id, key, sentenceId}, ...]]}].
// Pure, and the only walk of book.json find ever does: built once per book
// and reused for every keystroke, which is what lets type-ahead be a plain
// scan even over Wallace Stevens. Words whose key is empty (a paragraph's
// stray punctuation token) are dropped rather than left in to break a
// phrase that reads continuously on the page.
function buildFindIndex(chapters) {
  return (chapters || []).map(ch => ({
    chapterId: ch.id,
    title: ch.title || ch.id,
    paras: (ch.paragraphs || []).map(p => {
      const run = [];
      for (const sent of (p.sentences || [])) {
        for (const w of (sent.words || [])) {
          const key = findKey(w.text != null ? w.text : w.raw);
          if (key) run.push({ id: w.id, key, sentenceId: sent.id });
        }
      }
      return run;
    }),
  }));
}

// Every run of consecutive words whose keys are `tokens`, in document
// order. `chapterId` null searches the whole book. A match NAMES ITS FIRST
// WORD ID -- that id is the match, and the highlight, the seek and the
// chapter jump are all derived from it.
function findMatches(index, tokens, chapterId) {
  const out = [];
  if (!tokens.length) return out;
  for (const ch of (index || [])) {
    if (chapterId && ch.chapterId !== chapterId) continue;
    for (const words of ch.paras) {
      for (let i = 0; i + tokens.length <= words.length; i++) {
        let ok = true;
        for (let k = 0; k < tokens.length; k++) {
          if (words[i + k].key !== tokens[k]) { ok = false; break; }
        }
        if (!ok) continue;
        const run = words.slice(i, i + tokens.length);
        out.push({
          chapterId: ch.chapterId, chapterTitle: ch.title,
          id: run[0].id, sentenceId: run[0].sentenceId,
          wordIds: run.map(w => w.id),
        });
      }
    }
  }
  return out;
}

// Wrap-around stepping, Safari's rule: Enter past the last match returns to
// the first, ⇧Enter before the first goes to the last. No matches -> null.
function findStep(n, current, delta) {
  if (!n) return null;
  if (current == null) return delta < 0 ? n - 1 : 0;
  return ((current + delta) % n + n) % n;
}

// The one line beside the box. "" while nothing is typed; the honest "no
// matches"; otherwise the 1-based position of n -- with a chapter named
// only when the selected match is NOT in the chapter on screen, which is
// how a whole-book search says "press Enter and you will go there".
function findCountText(query, n, current, elsewhereTitle) {
  if (!String(query == null ? "" : query).trim()) return "";
  if (!n) return "no matches";
  const pos = current == null ? 0 : current + 1;
  return `${pos} / ${n}${elsewhereTitle ? ` · ${elsewhereTitle}` : ""}`;
}

// ---- the impure half: one bar, one pane, one selection ----
const find = {
  open: false, query: "", whole: false,
  matches: [], current: null, pane: null,
  painted: [], timer: null, revealing: false,
};
const findBarEl = document.getElementById("findBar");
const findInputEl = document.getElementById("findInput");
const findCountEl = document.getElementById("findCount");
const findWholeEl = document.getElementById("findWholeBook");

function findPane() { return focusedPane || (typeof panes !== "undefined" && panes ? panes[0] : null) || null; }

// Cached on the book, non-enumerable so nothing that walks or serialises
// book.json ever sees it.
function findIndexFor(book) {
  if (!book) return [];
  if (!book.__findIndex) {
    Object.defineProperty(book, "__findIndex", {
      value: buildFindIndex(book.chapters), writable: true, configurable: true,
    });
  }
  return book.__findIndex;
}

function findClearPaint() {
  for (const el of find.painted) el.classList.remove("find-hit", "find-current");
  find.painted = [];
}

function findPaint() {
  findClearPaint();
  const pane = find.pane;
  if (!pane || !pane.wordEls) return;
  find.matches.forEach((m, i) => {
    if (m.chapterId !== pane.currentChapterId) return;
    for (const id of m.wordIds) {
      const el = pane.wordEls.get(id);
      if (!el) continue;
      el.classList.add("find-hit");
      if (i === find.current) el.classList.add("find-current");
      find.painted.push(el);
    }
  });
}

function findRenderCount() {
  const m = find.matches[find.current];
  const pane = find.pane;
  const elsewhere = (m && pane && m.chapterId !== pane.currentChapterId) ? m.chapterTitle : null;
  findCountEl.textContent = findCountText(find.query, find.matches.length, find.current, elsewhere);
}

// Type-ahead. Recount, repaint, and select -- but NEVER change the chapter:
// switching tears down the reading pane, reloads timings and audio and moves
// the sidebar, and that is a navigation, not a side effect of typing the
// third letter of a word. So the selection lands on the first match in the
// chapter on screen when there is one, and otherwise on the first match
// anywhere, named in the counter and left for Enter to go to.
function findRun(query) {
  const pane = findPane();
  find.pane = pane;
  find.query = String(query == null ? "" : query);
  const tokens = findTokens(find.query);
  const index = (pane && pane.book) ? findIndexFor(pane.book) : [];
  const here = pane ? pane.currentChapterId : null;
  find.matches = findMatches(index, tokens, find.whole ? null : here);
  if (!find.matches.length) find.current = null;
  else {
    const local = find.matches.findIndex(m => m.chapterId === here);
    find.current = local >= 0 ? local : 0;
  }
  findPaint();
  findRenderCount();
  findScrollToCurrent();
}

function findScrollToCurrent() {
  const m = find.matches[find.current];
  const pane = find.pane;
  if (!m || !pane || !pane.wordEls || m.chapterId !== pane.currentChapterId) return;
  const el = pane.wordEls.get(m.id);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

// Audio in step. The match's own word id is the id timings/cNNN.json is
// keyed on, so this is rcSeekToWord's body with the pane already in hand --
// no second mechanism, and a chapter with no timings simply has no word to
// seek to and is left alone.
function findSeekToMatch(pane, m) {
  const hit = rcWordById(pane, m.id);
  if (!hit) return false;
  pane.clock.currentTime = hit.word.start + 0.001;
  tick(pane);
  return true;
}

// The one place a match becomes a position: render the chapter it is in if
// that is not the chapter on screen (which moves the sidebar for the left
// pane), paint, scroll, and put the clock on its first word once that
// chapter's timings have loaded.
function findReveal() {
  const m = find.matches[find.current];
  const pane = find.pane;
  if (!m || !pane) { findRenderCount(); return Promise.resolve(false); }
  let ready = Promise.resolve();
  if (m.chapterId !== pane.currentChapterId) {
    find.revealing = true;
    try { renderChapter(pane, m.chapterId); } finally { find.revealing = false; }
    ready = pane.chapterReady || Promise.resolve();
  }
  findPaint();
  findRenderCount();
  findScrollToCurrent();
  return Promise.resolve(ready).then(() => findSeekToMatch(pane, m)).catch(() => false);
}

function findGo(delta) {
  if (!find.matches.length) { findRenderCount(); return Promise.resolve(false); }
  find.current = findStep(find.matches.length, find.current, delta);
  return findReveal();
}

function findOpen() {
  find.open = true;
  find.pane = findPane();
  findBarEl.hidden = false;
  if (findInputEl.focus) findInputEl.focus();
  if (findInputEl.select) findInputEl.select();
  if (find.query) { findInputEl.value = find.query; findRun(find.query); }
  else findRenderCount();
  return true;
}

// The query survives a close, so ⌘F re-opens with it selected, which is the
// reason `find.matches` is cleared but `find.query` is not.
function findClose() {
  find.open = false;
  findBarEl.hidden = true;
  clearTimeout(find.timer);
  findClearPaint();
  find.matches = [];
  find.current = null;
  const pane = find.pane || findPane();
  if (pane && pane.els && pane.els.reading && pane.els.reading.focus) pane.els.reading.focus();
  return true;
}

// renderChapter calls this whenever the chapter changes underneath an open
// find (the swipe, the sidebar, ⌘←/→, the chapter <select>). A whole-book
// search keeps its matches and simply repaints for the new chapter; a
// chapter search follows the chapter it is scoped to.
// One key, one bar: ⌘F opens it and ⌘F closes it (Osca, 30 Aug). Esc is
// unchanged -- it still closes the popup first and the bar second.
function findToggle() { return find.open ? findClose() : findOpen(); }

function findOnChapterChange(pane) {
  if (!find.open || find.revealing) return;
  if (find.pane && pane !== find.pane) return;
  if (find.whole) { findPaint(); findRenderCount(); }
  else findRun(find.query);
}

function findSetWholeBook(on) {
  find.whole = !!on;
  if (findWholeEl) findWholeEl.checked = find.whole;
  findInputEl.placeholder = find.whole ? "Find in the whole book" : "Find in this chapter";
  findRun(findInputEl.value);
}

findInputEl.addEventListener("input", () => {
  clearTimeout(find.timer);
  find.timer = setTimeout(() => findRun(findInputEl.value), FIND_DEBOUNCE_MS);
});
// The bar's own keys. The document-level handler returns early for an
// INPUT (so a space typed here is not the play/pause key), which is exactly
// why Enter, ⇧Enter and Esc are bound on the field itself.
findInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(find.timer);
    if (findInputEl.value !== find.query) findRun(findInputEl.value);
    findGo(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); findClose(); }
});
document.getElementById("findNext").addEventListener("click", () => { findGo(1); if (findInputEl.focus) findInputEl.focus(); });
document.getElementById("findPrev").addEventListener("click", () => { findGo(-1); if (findInputEl.focus) findInputEl.focus(); });
document.getElementById("findClose").addEventListener("click", findClose);
if (findWholeEl) findWholeEl.addEventListener("change", () => findSetWholeBook(findWholeEl.checked));

// The door the app's Edit › Find… opens, and the one a headless check
// drives. A page global, not a key on TTSTVHost: TTSTVHost is *injected by*
// the host (desktop/src/host.js) and does not exist in a plain browser or
// on the phone, where ⌘F must work all the same. The desktop request in
// reader/README.md is one menu item evaluating `window.TTSTVFind.open()` in
// the focused tab, the same shape Send to Phone already uses.
window.TTSTVFind = {
  open: findOpen,
  close: findClose,
  // what the app's Edit > Find... should evaluate now that ⌘F toggles
  toggle: findToggle,
  isOpen: () => find.open,
  next: () => findGo(1),
  previous: () => findGo(-1),
  // Set the box and search, without moving anything: the host's "Find
  // Again", and the harness's way in.
  search(query, opts) {
    findOpen();
    if (opts && "whole" in opts) { find.whole = !!opts.whole; if (findWholeEl) findWholeEl.checked = find.whole; }
    findInputEl.value = String(query == null ? "" : query);
    clearTimeout(find.timer);
    findRun(findInputEl.value);
    return this.state();
  },
  setWholeBook: findSetWholeBook,
  state() {
    const m = find.matches[find.current] || null;
    return {
      open: find.open, query: find.query, whole: find.whole,
      count: find.matches.length, current: find.current,
      wordId: m ? m.id : null,
      wordIds: m ? m.wordIds.slice() : [],
      chapterId: m ? m.chapterId : null,
      onScreen: !!(m && find.pane && m.chapterId === find.pane.currentChapterId),
      count_text: findCountEl.textContent,
    };
  },
};
