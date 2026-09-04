/* ================================================ A TAB DROPPED ON THIS TAB
 * Osca (READER_FIRST.md, "Logged for later"): "Take a reader tab, drag it out,
 * drop it onto another reader tab -> the two books merge -- the same merge
 * record the shelf's *Merge with...* creates, made with a gesture instead of a
 * menu. The parallel view opens with the dragged book as the second pane."
 *
 * **The drop happens where this page cannot see it.** The tab strip is
 * `desktop/`'s, native, outside every webview -- so the host recognises the
 * drop and tells the tab it landed on. ONE event, and it is this session's
 * §6 request to desktop/:
 *
 *     window.dispatchEvent(new CustomEvent("ttstv:tab-drop", {
 *       detail: { url: "<the DRAGGED tab's current URL>" }
 *     }))
 *
 * dispatched into the webview of the tab that was dropped ON, and nowhere
 * else. Everything below is the reader's half of it, and it is complete: the
 * host needs to know nothing about books, slugs, merges or panes.
 *
 * THE SAME RULE AS THE MENU. The pairing rule and its sentence are
 * `mergeRefusal` in the LIBRARY STORE block -- the identical function the
 * shelf's *Merge with...* calls -- so "a merge is exactly two" is one
 * statement with two callers, not two statements that agree today. A drop on
 * a pair, or of a pair, does nothing except say why, in one line. */
function dropNote(text) {
  const el = document.getElementById("dropNote");
  if (!el) return text;
  el.textContent = text || "";
  return text;
}

/** Pure: the slugs a reader URL is showing, in order. `?left=&right=` is a
 *  pair and comes back as two; `?book=` as one; anything else as none. */
function slugsInReaderUrl(href) {
  let q;
  try { q = new URL(String(href), "https://x/").searchParams; } catch (e) { return []; }
  const one = v => String(v || "").split("/").filter(Boolean).pop() || null;
  const left = one(q.get("left")), right = one(q.get("right"));
  if (left && right) return [left, right];
  const book = one(q.get("book"));
  return book ? [book] : [];
}

/** This tab's own slugs, from the panes rather than from the URL -- a bare
 *  `reader.html` that resumed where he left off has panes and no query. */
function myReaderSlugs() {
  return panes.map(paneSlug).filter(Boolean);
}

function readerMergeFor(slug) {
  const d = libDocRead();
  const merges = Array.isArray(d.merges) ? d.merges : [];
  return merges.find(m => m && m.slug === slug) || null;
}

/** The whole decision, pure over two lists of slugs, so the refusals are
 *  testable without a host, a drag or a second window. Returns either
 *  `{refusal}` or `{a, b}` -- mine first, the dragged one second. */
function tabDropPlan(mine, dragged, isPair) {
  if (!dragged.length) {
    return { refusal: "That tab is not a book, so there is nothing to pair." };
  }
  if (mine.length > 1 || dragged.length > 1) {
    return { refusal: "A parallel view holds two books, and one of these tabs "
      + "already shows two. Split it first, or drag onto a single book." };
  }
  const a = mine[0], b = dragged[0];
  const no = mergeRefusal({ a, b, aIsPair: isPair(a), bIsPair: isPair(b),
                            aName: a, bName: b });
  return no ? { refusal: no } : { a, b };
}

/* `ev` is the `ttstv:tab-drop` event itself, and it is here for one line.
 *
 * `desktop/README.md`'s `## Status` §6, word for word: *"make `ttstv:tab-drop`
 * cancelable, and `preventDefault()` on a refusal ... Then desktop can do the
 * half of the gesture it currently cannot: close the dragged tab when the
 * merge is accepted and leave it alone when it is not."* Today a successful
 * drag-to-merge leaves the dragged book's window open beside the pair and
 * costs a ⌘W.
 *
 * So the answer is the EVENT, not a callback and not a second message: a
 * refusal is `preventDefault()`, an accepted merge is not, and desktop reads
 * the one bit it needs off the dispatch it already made. Nothing else in the
 * contract changes and the reader's rule stays the reader's -- `tabDropPlan`
 * still decides, and `mergeRefusal` is still the one statement the shelf's
 * *Merge with...* calls too.
 *
 * `ev` is optional: every existing caller (the drivers, and any host that
 * dispatched a plain event) passes nothing and gets exactly what it always
 * got. `cancelable: true` is desktop's half of it -- on an event dispatched
 * without it, `preventDefault()` is a no-op and the gesture behaves as it
 * does today. */
async function onTabDrop(detail, ev) {
  const plan = tabDropPlan(myReaderSlugs(), slugsInReaderUrl(detail && detail.url),
                           readerMergeFor);
  if (plan.refusal) {
    if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
    return dropNote(plan.refusal);
  }
  const at = Date.now();
  const mine = panes.find(p => paneSlug(p) === plan.a);
  const ha = (mine && bookHashes.get(plan.a)) || { hash: null, kind: "none" };
  // The dragged book's own hash is the one thing this page cannot compute --
  // it has never loaded that book. `none` is the record's honest word for it
  // and libNormalise already accepts it: the pair opens, and it is marked
  // stale rather than claiming a witness it does not have.
  const hb = { hash: null, kind: "none" };
  const rec = libMergeRecord(plan.a, plan.b, ha, hb, at, libDeviceId());
  libDocPatch(d => {
    if (!Array.isArray(d.merges)) d.merges = [];
    d.merges = d.merges.filter(m => !m || m.slug !== rec.slug).concat([rec]);
  });
  dropNote("Paired \u2014 opening both.");
  const url = "reader.html?left=books/" + encodeURIComponent(plan.a)
    + "&right=books/" + encodeURIComponent(plan.b);
  try { location.href = url; } catch (e) { /* the node harness has no navigation */ }
  return rec;
}

window.addEventListener("ttstv:tab-drop", (e) => { onTabDrop(e && e.detail, e); });

// The hash is computed once per book, off the boot path -- it is a witness,
// not something anything waits for.
const bookHashes = new Map();     // slug -> {hash, kind}
function ensureBookHash(pane) {
  const slug = paneSlug(pane);
  if (!slug || bookHashes.has(slug) || !pane.book) return null;
  bookHashes.set(slug, { hash: null, kind: "pending" });
  return libHash(libWordIds(pane.book).join("|")).then((h) => { bookHashes.set(slug, h); return h; });
}

/* Save is coalesced, because the active word changes several times a second
 * while audio plays and localStorage is synchronous. One write a few seconds,
 * plus one on the way out -- `pagehide` and `visibilitychange`, which are the
 * two events a phone actually fires when an app is put away (`unload` is not
 * one of them in WebKit). */
let saveTimer = null;

/* ...WITH ONE EXCEPTION, AND IT IS THE OPEN (Osca, 4 Sep: *"My library needs
 * to be sorted by most recently opened"*). The shelf orders books by this
 * record's `at`, so a book opened and shut inside four seconds -- looked at,
 * not wanted -- has to have been opened all the same. The FIRST save for a
 * book in this page's life is therefore immediate; every one after it is
 * coalesced as before. One extra write per book per load, against a record
 * that would otherwise be missing the very event the shelf sorts on. */
const savedOnce = new Set();
function rememberPositionSoon() {
  const fresh = (panes || []).some((p) => {
    const slug = paneSlug(p);
    return slug && p.currentChapterId && !savedOnce.has(slug);
  });
  if (fresh) {
    for (const p of (panes || [])) { const slug = paneSlug(p); if (slug) savedOnce.add(slug); }
    clearTimeout(saveTimer); saveTimer = null;
    rememberPosition();
    return;
  }
  if (saveTimer != null) return;
  saveTimer = setTimeout(() => { saveTimer = null; rememberPosition(); }, 4000);
}

function rememberPosition() {
  const now = Date.now();
  const device = libDeviceId();
  const seen = [];
  for (const pane of (panes || [])) {
    const slug = paneSlug(pane);
    if (!slug || !pane.currentChapterId) continue;
    const h = bookHashes.get(slug) || { hash: null, kind: "none" };
    seen.push({
      slug,
      rec: {
        chapter: pane.currentChapterId,
        wordId: (pane.activeWordEl && pane.activeWordEl.dataset.id) || pane.lastSeenWordId || null,
        hash: h.kind === "pending" ? null : h.hash,
        hashKind: h.kind === "pending" ? "none" : h.kind,
        at: now, device,
      },
    });
  }
  if (!seen.length) return false;
  return libDocPatch((d) => {
    for (const s of seen) d.positions[s.slug] = s.rec;
    d.last = {
      book: seen[0].slug,
      right: seen.length > 1 ? seen[1].slug : null,
      at: now, device,
    };
  });
}

// What the reader remembered for this book, or null. Used at boot for the
// chapter, and to say so when the book has changed underneath it.
function rememberedPosition(slug) {
  const d = libDocRead();
  const p = d && d.positions && d.positions[slug];
  return (p && typeof p === "object" && typeof p.chapter === "string") ? p : null;
}
function rememberedLast() {
  const d = libDocRead();
  const l = d && d.last;
  return (l && typeof l === "object" && typeof l.book === "string") ? l : null;
}

for (const ev of ["pagehide", "beforeunload"]) window.addEventListener(ev, () => rememberPosition());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") rememberPosition(); });

/* THE LAYOUT SWITCH (PROMPTS/reader-layout.md, 2 Sep). `?layout=2` puts
 * data-layout="2" on <html>; every rule of the new reading-page layout is
 * written under that attribute and nowhere else, so a URL without the
 * parameter renders the old page unchanged -- the flag is a true A/B on the
 * same text. Only the one known value is believed: any other `?layout=` is
 * nobody's layout and leaves the attribute off entirely. */
const LAYOUT2 = qs("layout", null) === "2";
if (LAYOUT2) document.documentElement.dataset.layout = "2";

/* BOOT WITH NO PARAMS AT ALL = RESUME. The reader is reached three ways: a
 * deep link (params), the Library (params), and the app or a bookmark opening
 * reader.html bare. Only the third has nothing to go on, and that is exactly
 * the case Osca means by "it must know where I last closed the reader" -- so
 * the remembered pair, or the remembered book, stands in for the
 * `../books/poems` dev default. A URL that names a book is never overridden. */
const lastOpen = (!qs("left", null) && !qs("right", null) && !qs("book", null)) ? rememberedLast() : null;
const leftPath = qs("left", lastOpen ? "books/" + lastOpen.book : null);
const rightPath = qs("right", (lastOpen && lastOpen.right) ? "books/" + lastOpen.right : null);
const requestedChapter = qs("ch", null);
// "Open at bookmark..." -- the Library's book menu passes the bookmark's
// id and the reader resolves it to a chapter and a word (margOpenAt).
const requestedBookmark = qs("bm", null);
const bookRequested = !!(leftPath || rightPath || qs("book", null));   // false = the ../books/poems default (dev convenience)

let panes;
if (leftPath && rightPath) {
  panes = [
    makePane("left", normalizeBookPath(leftPath), "left"),
    makePane("right", normalizeBookPath(rightPath), "right"),
  ];
} else if (leftPath || rightPath) {
  const side = leftPath ? "left" : "right";
  panes = [makePane(side, normalizeBookPath(leftPath || rightPath), side)];
} else {
  panes = [makePane("left", normalizeBookPath(qs("book", "../books/poems")), "book")];
}
document.getElementById("panes").className = "count-" + panes.length;
panes.forEach(wireControls);
panes.forEach(bootPane);
if (panes.length === 2) loadAlign();
// Each pane brings its own chapter list up when its own book has landed.
for (const p of panes) p.ready.then(() => mountSidebarFor(p));
// The marginalia mirror, once, after every book is on screen (margMirrorOnce).
Promise.all(panes.map(p => p.ready)).then(margMirrorOnce, () => {});
renderPaneSwitch();                                   // sides now, so the phone has a switch before any book loads
wireMasterBar();
applySync();                                          // and the bar the sides share
panes.forEach(p => p.ready.then(renderPaneSwitch));   // languages once each book is in
mountPopovers();                                      // Actions and Settings: no book needed to exist
/* ONCE AT LOAD (§6). `paintBookBar`, `paintSidebarBtn` and `paintViewBtn` have
 * each already pushed by now, but only if they ran -- a tab opened on no book
 * at all must still name itself in the strip. */
pushHostContext();
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && SHEET_OPEN) setSheet(false); });

// ------------------------------------------------------------- service worker
// Registered from reader.html itself (not the file:// fallback path -- a
// service worker needs a secure context, http(s)/localhost, which is exactly
// when fetch() already works here too). sw.js's scope defaults to "./" from
// its own location (reader/sw.js -> scope reader/), which is enough: once
// this page is a controlled client, every fetch it makes -- including
// relative requests that resolve outside that scope path, like
// ../voiceui/app.js or ../books/<slug>/book.json -- passes through the
// worker's fetch handler regardless (scope gates which *pages* get
// controlled, not which URLs a controlled page may fetch).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .catch((e) => console.warn("[sw] registration failed:", e));
  });
}

// -------------------------------------------------------------- install bar
// Chrome/Android fires beforeinstallprompt; caught and offered as a small,
// dismissible bar rather than the browser's own mini-infobar. iOS Safari
// never fires it and never will, so it gets a one-time "Share -> Add to
// Home Screen" line instead. Neither shows once already installed
// (display-mode: standalone, or navigator.standalone on iOS Safari), and a
// dismissal is remembered per browser via localStorage -- wrapped in
// try/catch since this code also runs over file:// and in Safari private
// browsing, where localStorage access can throw rather than just return null.
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}
function installDismissed() {
  try { return localStorage.getItem("readerInstallDismissed") === "1"; } catch (e) { return false; }
}
function dismissInstallBar() {
  try { localStorage.setItem("readerInstallDismissed", "1"); } catch (e) { /* ignore */ }
  document.getElementById("installBar").innerHTML = "";
}

if (!isStandalone() && !installDismissed()) {
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const bar = document.getElementById("installBar");
    bar.innerHTML = "";
    const msg = document.createElement("span");
    msg.textContent = "Install TTSTV Reader for the full-screen, offline-ready app.";
    const installBtn = document.createElement("button");
    installBtn.textContent = "Install";
    installBtn.addEventListener("click", async () => {
      bar.innerHTML = "";
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    });
    const dismissBtn = document.createElement("button");
    dismissBtn.className = "dismiss";
    dismissBtn.textContent = "Not now";
    dismissBtn.addEventListener("click", dismissInstallBar);
    bar.append(msg, installBtn, dismissBtn);
  });

  window.addEventListener("appinstalled", () => {
    document.getElementById("installBar").innerHTML = "";
  });

  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS 13+ UA
  if (isIOS) {
    const bar = document.getElementById("installBar");
    const msg = document.createElement("span");
    msg.textContent = "Install this app: tap Share, then \"Add to Home Screen\".";
    const dismissBtn = document.createElement("button");
    dismissBtn.className = "dismiss";
    dismissBtn.textContent = "Got it";
    dismissBtn.addEventListener("click", dismissInstallBar);
    bar.append(msg, dismissBtn);
  }
}

// ------------------------------------------------------------ ReaderControl
// The one seam voiceui/ is allowed to depend on (voiceui/reader-bridge.js's
// REQUIRED_METHODS; requested in voiceui/README.md "Requests to core / other
// modules"). Deliberately not the internal names above (panes, seekSentence,
// alignMap, syncFollower, ...) -- those stay free to change without notice,
// same reasoning window.__READER_DEBUG__'s own comment already gives.
//
// paneSide accepts reader's own "left"/"right" and also voiceui's abstract
// "target"/"ground" vocabulary (app.js tracks a `side` that starts as
// "target" and switches to "ground" mid-utterance) -- resolvePane() treats
// "target" as panes[0] and "ground" as panes[1], since panes[0] is already
// the anchor align.json and syncFollower are written against. Nothing else
// in this codebase defines that mapping, so it's owned here; see this
// session's report for why.
function resolvePane(side) {
  if (side === "left" || side === "target") return panes[0] || null;
  if (side === "right" || side === "ground") return panes[1] || null;
  return panes.find(p => p.side === side) || null;
}

function sentenceAndWordAt(pane, t) {
  if (!pane.currentTimings || !pane.currentTimings.sentences.length) return null;
  const sent = pane.currentTimings.sentences[findIndex(pane.currentTimings.sentences, t)];
  let wordId = null;
  if (sent.words.length) wordId = sent.words[findIndex(sent.words, t)].id;
  return { sent, wordId };
}

function rcGetPosition(side) {
  const pane = resolvePane(side);
  if (!pane || !pane.currentChapterId) return null;
  const hit = sentenceAndWordAt(pane, pane.clock.currentTime);
  if (!hit) return null;
  return {
    chapterId: pane.currentChapterId,
    sentenceId: hit.sent.id,
    wordId: hit.wordId,
    atSentenceStart: Math.abs(pane.clock.currentTime - hit.sent.start) < 0.05,
  };
}

function rcGetSpeed(side) {
  const pane = resolvePane(side);
  return pane ? pane.rate : 1;
}

function rcSetSpeed(side, rate) {
  const pane = resolvePane(side);
  if (!pane) return;
  pane.rate = rate;
  pane.clock.playbackRate = rate;
  // best-effort UI sync -- the <select> only has a few fixed options, so a
  // voiceui-set rate that doesn't match one just leaves the dropdown as-is
  const opt = Array.from(pane.els.speedSelect.options).find(o => parseFloat(o.value) === rate);
  if (opt) pane.els.speedSelect.value = opt.value;
}

function rcIsPaused(side) {
  const pane = resolvePane(side);
  return pane ? pane.clock.paused : true;
}

function rcPlay(side) {
  const pane = resolvePane(side);
  if (pane) pane.clock.play();
}

function rcPause(side) {
  const pane = resolvePane(side);
  if (pane) pane.clock.pause();
}

function rcSeekSentenceDelta(side, delta) {
  const pane = resolvePane(side);
  if (pane) seekSentence(pane, delta);
}

// NEW -- no word-granularity seek existed before this session. Flattens the
// chapter's *voiced* words in playback order (currentTimings.sentences is
// already sorted by start, same timeline seekSentence/tick use) and moves to
// the word `delta` positions away -- crossing sentence boundaries, skipping
// the same timing-less speaker cues findIndex() already skips.
function rcFlatWords(pane) {
  return pane.currentTimings ? pane.currentTimings.sentences.flatMap(s => s.words) : [];
}

function rcSeekWordDelta(side, delta) {
  const pane = resolvePane(side);
  if (!pane) return;
  const words = rcFlatWords(pane);
  if (!words.length) return;
  const idx = findIndex(words, pane.clock.currentTime);
  const target = Math.min(words.length - 1, Math.max(0, idx + delta));
  pane.clock.currentTime = words[target].start + 0.001;
  tick(pane);
}

// NEW -- same gap, second-granularity. Clamped to [0, chapter duration].
function rcSeekSeconds(side, deltaSeconds) {
  const pane = resolvePane(side);
  if (!pane) return;
  const duration = (pane.currentTimings && pane.currentTimings.duration) || pane.clock.duration || Infinity;
  pane.clock.currentTime = Math.min(duration, Math.max(0, pane.clock.currentTime + deltaSeconds));
  tick(pane);
}

// NEW -- the three data hooks voiceui asked for (voiceui/README.md step 1
// and step 2 "Requests to core / other modules"): the words of a sentence,
// the sentence before it, and this book's dictionary entry for a surface
// form. All three are synchronous reads of state the pane already holds --
// no fetch, no DOM, no await -- because voiceui calls them mid-utterance
// while deciding what to say.

// The book's own sentence object (paragraphs -> sentences), not the
// timings': `words` with text/raw/phon lives only in book.json. Sentence
// ids are `<chapterId>.pNNNN.sNN` (core/schema.py), so the chapter is
// readable off the id; the chapter it names is searched first and the rest
// only as a fallback, since a caller may hold an id from a chapter that
// has since been swapped off screen.
function rcFindSentence(pane, sentenceId) {
  if (!pane || !pane.book || !sentenceId) return null;
  const chapterId = String(sentenceId).split(".")[0];
  const chapters = pane.book.chapters.filter(c => c.id === chapterId)
    .concat(pane.book.chapters.filter(c => c.id !== chapterId));
  for (const ch of chapters) {
    for (const para of ch.paragraphs) {
      for (const sent of para.sentences) if (sent.id === sentenceId) return sent;
    }
  }
  return null;
}

// [{id, text, phon?}] -- the shape voiceui/resolve.js matches spoken words
// against. `text` is Word.text (normalised), not Word.raw (what is printed),
// because that is what dictionary.json is keyed by. [] when unknown.
function rcGetSentenceWords(side, sentenceId) {
  const sent = rcFindSentence(resolvePane(side), sentenceId);
  if (!sent) return [];
  return sent.words.map(w => (w.phon ? { id: w.id, text: w.text, phon: w.phon }
                                     : { id: w.id, text: w.text }));
}

// The entry before it in the chapter's document order, null at the chapter
// start (and null for an id that is not in the chapter on screen -- there is
// no order to be "before" in until that chapter is rendered).
function rcGetPreviousSentenceId(side, sentenceId) {
  const pane = resolvePane(side);
  if (!pane) return null;
  const idx = pane.chapterSentenceOrder.indexOf(sentenceId);
  return idx > 0 ? pane.chapterSentenceOrder[idx - 1] : null;
}

// books/<slug>/dictionary.json, keyed by surface text (dictionary/export.py).
// Synchronous by contract, so it answers null while the file is still
// unread -- but it also *starts* that read the first time it is asked, so a
// spoken lookup warms the same cache a tapped one does. Without this the
// dictionary would stay unloaded on a page nobody has tapped a word on,
// which is exactly the hands-free case voiceui exists for.
function rcGetDictionaryEntry(side, surfaceText) {
  const pane = resolvePane(side);
  if (!pane) return null;
  if (!pane.dictAttempted) loadBookDictionary(pane);   // fire and forget; next call sees it
  if (!pane.dictData) return null;
  return pane.dictData[surfaceText] || null;
}

// Shared by rcGetAlignedSentenceId and rcPlayAlignedSegment -- same
// align.json-then-proportional-index logic syncFollower() already runs,
// re-expressed to take an explicit sentenceId instead of reading
// master.activeDocIdx off the DOM. Duplicated rather than refactoring
// syncFollower() itself to call this: syncFollower is existing, live-verified
// cross-pane sync (reader/README.md's browser-check + Q4 sessions); this is
// new, ~10 lines, and low-risk to keep separate rather than risk that path.
function rcResolveAlignedId(fromPane, follower, sentenceId) {
  const idx = fromPane.chapterSentenceOrder.indexOf(sentenceId);
  if (idx < 0) return null;
  const targets = alignMap && alignMap[sentenceId];
  if (targets && targets.length) {
    const hit = targets.find(id => follower.sentenceEls.has(id));
    if (hit) return hit;
  }
  const mCount = fromPane.chapterSentenceOrder.length;
  const fCount = follower.chapterSentenceOrder.length;
  if (!mCount || !fCount) return null;
  return follower.chapterSentenceOrder[nearestIndex(idx, mCount, fCount)] || null;
}

function rcGetAlignedSentenceId(fromSide, sentenceId) {
  const fromPane = resolvePane(fromSide);
  const follower = fromPane && otherPane(fromPane);
  if (!fromPane || !follower) return null;
  // A pending chapter switch (rcPlayAlignedSegment mid-flight) means
  // follower.chapterSentenceOrder is still the OLD chapter's -- resolving
  // against it would return an id from the wrong chapter, so this returns
  // null rather than a wrong answer. rcPlayAlignedSegment doesn't hit this
  // path; it awaits chapterReady first and calls rcResolveAlignedId directly.
  if (follower.currentChapterId !== fromPane.currentChapterId) return null;
  return rcResolveAlignedId(fromPane, follower, sentenceId);
}

// NEW -- pause the source pane, resolve the aligned sentence (switching the
// follower's chapter first if needed, awaiting chapterReady so timings/audio
// are real before touching them), play that segment, resolve once playback
// reaches the segment's end. This is what "ground"/"what" actually needs
// (voiceui/reader-bridge.js's own comment) -- everything above it is either
// unexposing an internal or a small new seek; this one is genuinely new
// control-flow with no prior analogue in reader.html.
function rcPlayAlignedSegment(fromSide, sentenceId) {
  const fromPane = resolvePane(fromSide);
  if (!fromPane) return Promise.resolve();
  const follower = otherPane(fromPane);
  if (!follower) return Promise.resolve(); // nothing to ground into -- degrade silently
  fromPane.clock.pause();

  const chapterMatches = follower.currentChapterId === fromPane.currentChapterId;
  if (!chapterMatches) renderChapter(follower, fromPane.currentChapterId);
  const ready = chapterMatches ? Promise.resolve() : follower.chapterReady;

  return ready.then(() => {
    const targetId = rcResolveAlignedId(fromPane, follower, sentenceId);
    const seg = targetId && follower.currentTimings
      && follower.currentTimings.sentences.find(s => s.id === targetId);
    if (!seg) return;

    follower.clock.currentTime = seg.start + 0.001;
    setActiveSentence(follower, follower.sentenceEls.get(targetId) || null);
    // no chip here either -- same rule as syncFollower's
    follower.clock.play();

    // `started` used to be set by this poll's own first frame, which left
    // the promise pending forever if anything paused the pane before that
    // frame ran (voiceui/README.md step 2 §6). Both clocks -- <audio> and
    // VirtualClock -- flip `paused` synchronously inside play(), so the
    // flag is simply true from here on and a pause by anyone resolves.
    return new Promise((resolve) => {
      const poll = () => {
        if (follower.clock.currentTime >= seg.end || follower.clock.paused) {
          follower.clock.pause();
          resolve();
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
  });
}

// NEW -- the playback precision voiceui asked for (voiceui/README.md step 2
// §6). Until now voiceui expressed "play this much of that pane and stop"
// as a per-frame watcher of its own over getPosition() + pause(), which is
// up to one frame late and has to guess when a promise will settle. These
// two put the stop on the reader's own clock instead.

// The timings entry for a word id, with the sentence it belongs to. Scans
// the chapter on screen only -- timings exist per chapter, so a word from
// another chapter has no time to seek to.
function rcWordById(pane, wordId) {
  if (!pane || !pane.currentTimings) return null;
  for (const sent of pane.currentTimings.sentences) {
    const word = sent.words.find(w => w.id === wordId);
    if (word) return { sent, word };
  }
  return null;
}

// The one absolute seek. Everything else moves by a delta from wherever the
// clock is; `target 1` (return to where the reader was) needs a position it
// can name. Returns false when the word is not in the chapter on screen.
function rcSeekToWord(side, wordId) {
  const pane = resolvePane(side);
  const hit = rcWordById(pane, wordId);
  if (!hit) return false;
  pane.clock.currentTime = hit.word.start + 0.001;
  tick(pane);
  return true;
}

// from: "sentenceStart" (the start of the sentence the clock is in) or a
// word id. to: "sentenceEnd" (that sentence's end) or a word id, whose
// *start* is the stop -- "stopped at w004" means w004 has not been read.
// Both default to the whole current sentence.
function rcRangeBounds(pane, range) {
  let sent = null, from = null;
  if (range.from && range.from !== "sentenceStart") {
    const hit = rcWordById(pane, range.from);
    if (!hit) return null;
    sent = hit.sent; from = hit.word.start;
  } else {
    const here = sentenceAndWordAt(pane, pane.clock.currentTime);
    if (!here) return null;
    sent = here.sent; from = sent.start;
  }
  let to;
  if (range.to && range.to !== "sentenceEnd") {
    const hit = rcWordById(pane, range.to);
    if (!hit) return null;
    to = hit.word.start;
  } else {
    to = sent.end;
  }
  return { sent, from, to };
}

// Play [from, to) in one pane and stop there, on this page's own frame poll
// -- the same requestAnimationFrame the highlight already runs on, so the
// overshoot is the clock's granularity, not a second watcher's. Resolves
// with where it actually stopped; resolves early (aborted: true) if anyone
// else pauses the pane, so a "stop" said over a long sentence cannot leave
// the caller waiting. Never touches the other pane.
function rcPlayRange(side, range) {
  const pane = resolvePane(side);
  if (!pane || !pane.currentTimings) return Promise.resolve(null);
  const b = rcRangeBounds(pane, range || {});
  if (!b) return Promise.resolve(null);

  pane.clock.currentTime = b.from + 0.001;
  tick(pane);
  const stopped = (aborted) => {
    pane.clock.pause();
    const hit = sentenceAndWordAt(pane, pane.clock.currentTime);
    tick(pane);
    return { sentenceId: hit ? hit.sent.id : b.sent.id, wordId: hit ? hit.wordId : null,
             time: pane.clock.currentTime, aborted: !!aborted };
  };
  if (b.to <= b.from) return Promise.resolve(stopped(false));

  pane.clock.play();
  return new Promise((resolve) => {
    const poll = () => {
      if (pane.clock.currentTime >= b.to) { resolve(stopped(false)); return; }
      if (pane.clock.paused) { resolve(stopped(true)); return; }   // someone else stopped it
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

window.ReaderControl = {
  /* voiceui calls this when the mic layer arms and again when it goes quiet.
   * It is the ONLY way the reader learns that a microphone is on -- this page
   * reads no voiceui element and names no voiceui class, in JS as in CSS.
   * What it decides is one thing: the volume control is present on a chapter
   * with no rendered audio, because in chat audio is coming back anyway.
   * Requested of voiceui/ in reader/README.md §6; until it is called the flag
   * stays false, which is the same behaviour as before this existed. */
  setMicActive(on) { return setMicActive(on); },
  micActive() { return MIC_ON; },
  getPosition: rcGetPosition,
  getSpeed: rcGetSpeed,
  setSpeed: rcSetSpeed,
  isPaused: rcIsPaused,
  play: rcPlay,
  pause: rcPause,
  seekSentenceDelta: rcSeekSentenceDelta,
  seekWordDelta: rcSeekWordDelta,
  seekSeconds: rcSeekSeconds,
  getAlignedSentenceId: rcGetAlignedSentenceId,
  playAlignedSegment: rcPlayAlignedSegment,
  getSentenceWords: rcGetSentenceWords,
  getPreviousSentenceId: rcGetPreviousSentenceId,
  getDictionaryEntry: rcGetDictionaryEntry,
  seekToWord: rcSeekToWord,
  playRange: rcPlayRange,
};
