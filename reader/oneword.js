// ====================================================================
// ONE-WORD MODE  (PROMPTS/reader-one-word.md; READER_FIRST.md, Osca 30 Aug)
//
// "Rather than seeing the full chapter or the poems, you only see one word,
// so you never have to move your eye." The behaviour below is a port of the
// approved prototype `out/reader-oneword/proto.html` -- its pivot table, its
// dwell multipliers, its verse beat, its frame model and its restraint are
// the specification, not a starting point.
//
// WHY IT IS CHEAP: this reader already knows which word is current -- that
// is how the highlight and tap-to-look-up work (`tick()` above). One-word
// mode is the same data with a different presentation, so nothing here
// parses, fetches or times anything the reader was not already doing.
//
// THE FOUR LOAD-BEARING PARTS, in the order they matter:
//
//  1. THE PIVOT IS HELD AT A FIXED X, and it is not the middle of the word.
//     `owOrp()` picks the optimal recognition point -- letter 0/1/2/3/4 for
//     words of 1/2-5/6-9/10-13/14+ letters -- and `owPlaceWord()` positions
//     the whole word so that letter's centre lands on the pivot column, at
//     42% of the lane. Centre the word instead and the eye moves on every
//     word, which is the one thing this mode exists to prevent.
//
//  2. THE FRAME IS THE UNIT. The target language is always exactly one word
//     and it sets the clock; where its counterpart in the other language is
//     two or three words, they do not appear together -- they change, one
//     after another, under a target word that is still standing there. So a
//     frame is (target word, one of its ground words), and playback, the
//     arrow keys and the progress bar all count frames, never words.
//
//  3. TIMING. With the reader's clock running -- real audio or the silent
//     VirtualClock -- the wpm clock is WRONG and is not used: the stage
//     follows the same word timing the highlighter follows, so the word on
//     screen is the word being spoken. The wpm clock with its multipliers
//     (`owDwell()`) is the fallback for a chapter that has no timings at all.
//
//  4. VERSE IS THE THING THAT CAN RUIN THIS. Most RSVP readers flatten
//     poetry into prose and this corpus is poetry. `owTokenise()` keeps the
//     verse line as a real boundary (a line ends where its paragraph does,
//     and `Paragraph.stanza` says whether the next line is still the same
//     stanza), and the beat fires on a word's LAST frame so the pause
//     happens once the ground line has finished catching up.
//
// The alignment map this needs -- one entry per target word, giving the
// ground words that MEAN it -- does not exist yet; it is its own session
// (§6 of this module's Status says what shape it should arrive in). Until
// it does, `owLoadPairs()` reads `align-words.json` beside `book.json` if a
// book pair has one and otherwise shows one lane, which is also the honest
// state for a single-language book.
// ====================================================================

// A sub-word never flickers past the eye: below this a ground word goes by
// faster than it can register, so the target word simply holds longer.
const OW_MIN_FRAME_MS = 150;
// Ten TARGET words, the one jump that is not a frame -- "a reader cannot
// glance back, and glancing back is how people actually understand".
const OW_REWIND_WORDS = 10;
// A press this long on the stage is a look-up, not a tap.
const OW_HOLD_MS = 450;
// A drag this far across the stage is a skip, not a tap.
const OW_SWIPE_PX = 60;
// Where the pivot column sits across the lane. Left of centre, deliberately:
// the eye's optimal recognition point is not the middle of the lane any more
// than it is the middle of the word.
const OW_PIVOT_FRACTION = 0.42;

/* Optimal recognition point -- left of centre, never the middle. Pure;
 * lifted verbatim from the prototype. Letters only: "Tityre," pivots on
 * its word, not on its comma. */
function owOrp(w) {
  const n = w.replace(/[^A-Za-zÀ-ɏ0-9']/g, "").length || w.length;
  if (n <= 1) return 0;
  if (n <= 5) return 1;
  if (n <= 9) return 2;
  if (n <= 13) return 3;
  return 4;
}

/* How long one target word is worth at `wpm`, in ms. A constant rate reads
 * badly: long words need longer, punctuation is a rest, and a verse line
 * end is a rest of its own. Pure; the numbers are the prototype's and are
 * tuned -- change one only with a reason in a report. */
function owDwell(tok, wpm) {
  const base = 60000 / wpm;
  let m = 1;
  const w = tok.w, bare = w.replace(/[^A-Za-zÀ-ɏ0-9']/g, "");
  if (bare.length <= 3) m *= 0.90;
  else if (bare.length >= 9) m *= 1.28;
  else if (bare.length >= 7) m *= 1.12;
  if (/[,;:]$/.test(w)) m *= 1.85;
  if (/[.!?]["')\]]?$/.test(w)) m *= 2.55;
  if (/[—–]$/.test(w)) m *= 1.7;
  if (tok.lineEnd) m *= 2.15;
  if (tok.paraEnd) m *= 3.10;
  return base * m;
}

/* Paragraphs -> the reading order, with the two verse beats marked. Pure,
 * and deliberately takes plain objects rather than a DOM so the verse rule
 * can be tested under node against real books (reader/tests/test_oneword.py).
 *
 * A line ends where its paragraph ends -- `parser/` gives each verse line a
 * paragraph of its own -- and it is a LINE end rather than a STANZA end only
 * while the next paragraph is verse in the same `Paragraph.stanza`. So the
 * white line between stanzas gets the bigger beat, a speaker cue between two
 * stanzas ends the one before it, and prose gets paragraph beats and no line
 * beats at all: whitespace is never collapsed into a rate. */
/* ================= EVERYTHING THAT IS NOT THE TEXT, LIFTED OUT (1 Sep)
 * Osca: *"enter/exeunt/speaker etc should all be OUTSIDE the one-word view --
 * like the floating watermark; just above the ledger, show the stuff that
 * isn't main body."*
 *
 * The ledger streams the BOOK, one word at a time. A speaker's cue and a
 * stage direction are not the book being read aloud -- they are the printed
 * apparatus that tells you who is speaking and what is happening -- and
 * spelling `E`, `n`, `t`, `e`, `r` through the stage one word at a time is
 * both slower than reading it and less clear. So they come out of the stream
 * and go into ONE LINE above it, which reads like the running head it is: the
 * speaker stays up while their speech runs, a direction takes the line for as
 * long as it lasts, and then the speaker comes back.
 *
 * NOTHING OF IT IS SPOKEN OR STEPPED. There are no frames for these words, so
 * the arrows never land on one, the progress bar does not count them, and the
 * beat never fires on one. The context strip UNDER the ledger is unchanged
 * and still shows them in their place in the text, which is the one place
 * seeing them in line is what you want.
 *
 * WHAT COUNTS AS NOT-BODY: the `role` core's parser puts on the paragraph --
 * `speaker`, `direction`, `heading` -- plus an <h3>, plus the two `kind`s an
 * older book may carry instead. `speech` is the text itself and is body. */
const ASIDE_KINDS = { speaker: 1, direction: 1, heading: 1, stage: 1 };
const ASIDE_ROLE = { speaker: "speaker", direction: "direction", stage: "direction",
                     heading: "heading" };

function owIsAside(para) {
  const role = (para && para.role) || "body";
  return role !== "body" && role !== "speech" && !!ASIDE_ROLE[role];
}

/* Pure. The asides of a chapter, each pinned to the number of BODY words that
 * came before it -- which is exactly its index into `OW.toks`, because the
 * ledger is the body words and nothing else.
 *
 * `hold` is how long a direction keeps the line, counted in the body words
 * that follow it, and it is TWO numbers taken together:
 *
 *   - ITS OWN LENGTH IN WORDS. A three-word direction is gone again in three
 *     words, a fifteen-word one stays while you read fifteen. It is a proxy
 *     for its own reading time and it is the only measure there is in wpm
 *     mode, where a direction gets no clock time because nothing steps it.
 *     (With real audio the clock DOES cross its words while the ledger waits
 *     on the last body word before it; following the clock there instead
 *     would be exact rather than a proxy. §6 asks.)
 *
 *   - AND NEVER MORE THAN HALF THE WAY TO THE NEXT ASIDE, so the speaker
 *     always gets the rest of their turn. Without the cap the first thing
 *     that happens in Hamlet swallows the first thing anyone says: `Enter
 *     Barnardo and Francisco, two sentinels.` is six words and `Who's there?`
 *     is three, so a six-word hold means BARNARDO's cue is never once on
 *     screen. Half, and he has the line for the rest of his line.
 *
 * A SPEAKER HAS NO HOLD: a cue stands until the next one, which is what "the
 * current speaker stays up while their speech runs" means. */
function owAsides(paras) {
  const out = [];
  let at = 0;
  (paras || []).forEach(function (para) {
    const words = (para && para.words) || [];
    if (!owIsAside(para)) { at += words.length; return; }
    const text = String((para && para.text) || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    out.push({ at: at, role: ASIDE_ROLE[para.role], text: text, own: Math.max(1, words.length) });
  });
  // the cap needs the NEXT aside's position, so it is a second pass
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    if (a.role === "speaker") { a.hold = 0; continue; }
    let next = at;                                   // the end of the chapter
    for (let j = i + 1; j < out.length; j++) if (out[j].at > a.at) { next = out[j].at; break; }
    const span = Math.max(0, next - a.at);
    a.hold = Math.max(1, Math.min(a.own, Math.ceil(span / 2)));
  }
  return out;
}

/* Pure. What the line says at body-word `t`: the direction or heading whose
 * hold covers `t`, and otherwise the speaker whose turn `t` is inside.
 * `null` when neither -- a book with no apparatus at all draws no line, and
 * the box is out of the layout rather than an empty gap over the stage. */
function owAsideAt(t, asides) {
  let speaker = null, over = null;
  const list = asides || [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.at > t) break;
    if (a.role === "speaker") { speaker = a; continue; }
    over = a;                       // the most recent direction or heading
  }
  /* THE DIRECTION WINS WHILE IT IS HOLDING, EVEN THOUGH A CUE FOLLOWS IT.
   * In a play `Enter Horatio and Marcellus.` is immediately followed by
   * `HORATIO`, with no body word between them, so both asides are pinned to
   * the same body word. Clearing the direction when the cue arrives -- the
   * obvious way to write this -- means the direction is never once on
   * screen: the line goes straight from one speaker to the next and the
   * entrance is silently dropped. So the cue is REMEMBERED and shown after,
   * which is what "a direction shows for its duration, THEN the speaker
   * returns" says. */
  if (over && t < over.at + over.hold) return { text: over.text, role: over.role };
  return speaker ? { text: speaker.text, role: speaker.role } : null;
}

function owPaintAside(t) {
  const el = owEl("owAside");
  if (!el) return null;
  const m = owAsideAt(t, OW.asides);
  el.textContent = m ? m.text : "";
  if (m) el.dataset.role = m.role; else delete el.dataset.role;
  el.hidden = !m;
  return m;
}

function owTokenise(paras) {
  const out = [];
  (paras || []).forEach(function (para, pi) {
    const next = paras[pi + 1] || null;
    const sameStanza = !!next && para.kind === "verse" && next.kind === "verse"
      && para.stanza != null && next.stanza === para.stanza;
    (para.words || []).forEach(function (w, wi) {
      const last = wi === para.words.length - 1;
      out.push({
        id: w.id, w: w.raw, text: w.text, sentenceId: w.sentenceId,
        lang: w.lang, sentEnd: !!w.sentEnd, kind: para.kind || "body",
        lineEnd: last && sameStanza,
        paraEnd: last && !sameStanza,
      });
    });
  });
  if (out.length) { out[out.length - 1].paraEnd = true; out[out.length - 1].lineEnd = false; }
  return out;
}

/* The frames of a chapter. One target word with three counterparts is three
 * frames; one with none (or with no map at all) is a single frame whose
 * ground line is empty. Pure. */
function owBuildFrames(toks, pairs) {
  const F = [];
  (toks || []).forEach(function (tok, t) {
    const ids = pairs && pairs[tok.id];
    if (!ids || !ids.length) { F.push({ t: t, g: null, k: 0, n: 1 }); return; }
    ids.forEach(function (g, k) { F.push({ t: t, g: g, k: k, n: ids.length }); });
  });
  return F;
}

/* Which frame of a target word the reader's clock is inside. Pure.
 *
 * The one place the frame model meets a clock it cannot slow down. In wpm
 * mode a word whose share falls under the floor simply holds longer; audio
 * cannot hold, so when the spoken word is too short to sequence its ground
 * words the frames COLLAPSE and the counterpart is shown as the phrase it
 * is, for exactly as long as the word is spoken. That is a smaller lie than
 * flashing three words in 90 ms, and it is visible here rather than hidden
 * in a paint routine. */
function owFrameOfWord(t, start, end, n, minMs) {
  const span = (Math.max(0, end - start) * 1000) / Math.max(1, n);
  if (n <= 1) return { k: 0, collapsed: false };
  if (span < minMs) return { k: 0, collapsed: true };
  const k = Math.floor(((t - start) * 1000) / span);
  return { k: Math.max(0, Math.min(n - 1, k)), collapsed: false };
}

const OW = {
  on: false,          // the setting
  pane: null,         // the target pane -- panes[0], the one that sets the clock
  ground: null,       // the ground pane, or null
  toks: [], F: [], f: 0,
  asides: [],         // what the line above the ledger says, and where (owAsides)
  pairs: null,        // word id -> [ground word id], from align-words.json
  chapterId: null,
  playing: false, timer: null,
  wpm: 300, gap: 0, context: true,
  painted: null,      // the last frame identity painted, so the rAF loop is cheap
  resumeAfterLookup: false,
  resumeVoiceAfterLookup: false,
};

const owEl = (id) => document.getElementById(id);

/* The clock the stage follows, or null when this chapter has no timings and
 * the wpm clock is the only one there is. */
function owClockPane() {
  const p = OW.pane;
  if (!p || !p.currentTimings || !p.currentTimings.sentences.length) return null;
  return p;
}
function owOnClock() { const p = owClockPane(); return !!p && !p.clock.paused; }

/* ============================================ THE VOICE, SEPARATELY (1 Sep)
 * Osca, on one-word view with a voice present: *"Play conflates the
 * word-stepping and the audio -- play both or neither -- and there's no
 * volume. Add a dedicated voice play/pause and a volume control ... distinct
 * from the word-stepping controls, so the voice can be played and its level
 * set independently."*
 *
 * So the stage now has two clocks a reader can start, and they are two
 * controls:
 *   `#owPlay`      the WORDS. With a voice present it drives the frame timer
 *                  and nothing else -- it no longer reaches for the audio.
 *   `#owVoicePlay` the VOICE, and `#owVoiceMute`/`#owVoiceVol` its level.
 *
 * They are not independent of each other in what the eye sees, and they must
 * not be: rule 3 of the stage's own docblock is that while the audio runs the
 * word on screen is the word being SPOKEN, not a word on a wpm clock. That is
 * unchanged -- `owStepTimer` still stands down while `owOnClock()`, and
 * `owFollowClock` still drives the frame. What changes is only that pressing
 * Play no longer starts a voice, and stopping the voice no longer stops the
 * words.
 *
 * WITH NO VOICE NOTHING HERE EXISTS and nothing here runs: `owVoicePane()` is
 * null, the row comes out of the DOM, and `#owPlay` drives whatever clock the
 * chapter has exactly as it did before -- which is READER_FIRST.md's one-word
 * exception ("the wpm clock IS the playback"), untouched. */
function owVoicePane() {
  const p = OW.pane;
  if (!p || !p.clock || (p.clock instanceof VirtualClock)) return null;
  return p;
}

/* HELD EAGERLY, for the same reason `masterBarEls()` is: the whole row comes
 * OUT of the document when a chapter has no master, and a detached element
 * cannot be found by `getElementById` -- so a second ask would answer null,
 * the paint would return early, and the row could never come back. Captured
 * on the first ask, while it is still in the tree. */
let owVoiceEls = null;
function owVoiceBarEls() {
  if (owVoiceEls) return owVoiceEls;
  const row = owEl("owVoice");
  if (!row) return null;
  owVoiceEls = { row: row, play: owEl("owVoicePlay"), mute: owEl("owVoiceMute"),
                 vol: owEl("owVoiceVol") };
  return owVoiceEls;
}

/* Present, or not present -- the same rule and the same helper as the reading
 * pane's own transport (`keepInDom`), so a chapter with no master has no voice
 * control in either place. */
function owPaintVoice() {
  const els = owVoiceBarEls();
  if (!els) return null;
  const row = els.row;
  const pane = owVoicePane();
  keepInDom(row, !!pane);
  if (!pane) return null;
  const play = els.play, mute = els.mute, vol = els.vol;
  const playing = !pane.clock.paused;
  play.textContent = playing ? "Pause voice" : "Voice";
  play.classList.toggle("on", playing);
  play.setAttribute("aria-label", playing ? "Pause the voice" : "Play the voice");
  mute.innerHTML = pane.muted ? BAR.muted : BAR.speaker;
  mute.classList.toggle("active", !!pane.muted);
  mute.setAttribute("aria-pressed", pane.muted ? "true" : "false");
  mute.setAttribute("aria-label", pane.muted ? "Unmute" : "Mute");
  vol.value = String(Math.round((pane.volume == null ? 1 : pane.volume) * 100));
  return pane;
}

function owVoiceToggle() {
  const pane = owVoicePane();
  if (!pane) return;
  if (pane.clock.paused) pane.clock.play(); else pane.clock.pause();
  owPaintVoice();
}

/* The pane's clock moved. WHICH BUTTON that is news for depends on whether
 * this chapter has a voice: with one, the audio is the voice control's
 * business and `#owPlay` keeps saying what the WORDS are doing; without one,
 * the pane's clock IS what `#owPlay` started, exactly as before. */
function owOnPaneClock(playing) {
  if (owVoicePane()) { owPaintVoice(); return; }
  owPaintPlayButton(playing);
}

// ------------------------------------------------------- reading the page
// The tokens come from the DOM the reader has already built, not from
// book.json: renderChapter() has already dropped a title echo and the next
// chapter's heading, and one-word mode must read exactly what the page
// shows. `data-kind`/`data-stanza` are written by renderParagraph() for this.
function owReadParagraphs(pane) {
  if (!pane || !pane.els || !pane.els.reading) return [];
  const out = [];
  const blocks = pane.els.reading.querySelectorAll("p, h3, blockquote, .argument");
  for (const block of blocks) {
    const words = [];
    for (const wEl of block.querySelectorAll(".word")) {
      const sEl = wEl.closest(".sentence");
      const sentence = sEl ? sEl.dataset.id : null;
      const siblings = sEl ? sEl.querySelectorAll(".word") : [];
      words.push({
        id: wEl.dataset.id, raw: wEl.textContent.trim(), text: wEl.dataset.text,
        sentenceId: sentence, lang: sEl ? sEl.dataset.lang : (pane.book && pane.book.lang),
        sentEnd: siblings.length ? siblings[siblings.length - 1] === wEl : false,
      });
    }
    /* THE ROLE, not only the kind (1 Sep, job 3). `role` is what tells a
     * speaker's cue and a stage direction from the speech between them --
     * `renderParagraph` puts core's `Paragraph.role` on the block, and an
     * <h3> is a heading whether or not anything wrote a role on it. Anything
     * that is not "body" is lifted OUT of the ledger and into the line above
     * it; `owAsides` is where that happens. */
    const role = block.dataset.role
      || (block.tagName === "H3" ? "heading" : null)
      || (ASIDE_KINDS[block.dataset.kind] ? block.dataset.kind : null)
      || "body";
    const aside = role !== "body" && role !== "speech";
    // A derived speaker label has no word ids -- it is furniture, printed
    // from `Paragraph.speaker` because the edition wrote "NAME:" inline. It
    // has no place in the ledger either way, and now that the line above
    // exists it DOES have a place there, so it is kept as text.
    if (!words.length && !aside) continue;
    if (!words.length && !String(block.textContent || "").trim()) continue;
    out.push({
      kind: block.dataset.kind || "body",
      role: role,
      stanza: block.dataset.stanza == null || block.dataset.stanza === "" ? null : Number(block.dataset.stanza),
      words: words,
      text: words.length ? words.map(function (w) { return w.raw; }).join(" ")
                         : String(block.textContent || "").trim(),
    });
  }
  return out;
}

/* The word-alignment sidecar, if this pair has one. Absent is the normal
 * case today and is not an error: one lane, no layout shift. */
async function owLoadPairs(pane, ground) {
  if (!pane || !ground) return null;
  try {
    const raw = await readJSON(pane, "align-words.json");
    const pairs = (raw && raw.pairs) || null;
    return (pairs && typeof pairs === "object") ? pairs : null;
  } catch (e) { return null; }
}

// ------------------------------------------------------------- the layout
// One pivot column, shared by both languages, at 42% of the lane.
function owPivotX() {
  const f = owEl("owFrame");
  return f ? f.getBoundingClientRect().width * OW_PIVOT_FRACTION : 0;
}

/* Put `text` on the row with its pivot letter centred on the pivot column.
 * The word is positioned AROUND the pivot; it is never centred. */
function owPlaceWord(wordEl, text) {
  if (!wordEl) return;
  if (!text) { wordEl.textContent = ""; return; }
  const p = Math.min(owOrp(text), text.length - 1);
  wordEl.innerHTML = esc(text.slice(0, p)) + '<span class="pv">' + esc(text[p] || "") + "</span>" + esc(text.slice(p + 1));
  const pv = wordEl.querySelector(".pv");
  // MEASURED, not computed from offsetLeft: `offsetLeft` and `offsetWidth`
  // are rounded to whole pixels and round a different way for each word,
  // which is a pivot column that wanders by about a pixel per word -- the
  // very thing this mode exists to prevent, just small enough to argue
  // about. `getBoundingClientRect()` is fractional, and because the row is
  // absolutely positioned this correction is exact in one step: moving the
  // row left by d moves the pivot letter by exactly d.
  const frame = owEl("owFrame").getBoundingClientRect();
  const want = frame.left + frame.width * OW_PIVOT_FRACTION;
  const now = pv.getBoundingClientRect();
  const left = parseFloat(wordEl.style.left) || 0;
  wordEl.style.left = (left + (want - (now.left + now.width / 2))) + "px";
}

/* One word, one colour: `margColourAt`'s rule (the newest highlight covering
 * this word) asked of the pane the stage is reading. */
function owPaintHighlight(el, wordId) {
  if (!el) return null;
  for (const c of MARG_COLOURS) el.classList.remove("hl-" + c);
  const pane = OW.pane;
  if (!pane || !pane.marg || !wordId) return null;
  const colour = margColourAt(wordId, margLive(pane.marg, "highlights"), margPageIds(pane));
  if (colour) el.classList.add("hl-" + colour);
  return colour;
}

function owPaintTicks() {
  // WHOLE PIXELS, unlike the word. A 3px-wide bar at x = 695.688 is drawn
  // across four columns of which two are half-lit, so the one mark on the
  // stage whose whole job is to be a hard edge came out as a grey smudge.
  // The word keeps its fractional position -- there the fraction IS the
  // guarantee (owPlaceWord) -- but a 3px rectangle owes nothing to it, and
  // half a pixel of tick is well inside the 0.75px the pivot proof allows.
  // The -1.5 is the bar's half-width: this sets its left edge, because
  // `.ow-tick` has no translateX(-50%) to undo the rounding (see the rule).
  const x = Math.round(owPivotX() - 1.5) + "px";
  owEl("owTickTop").style.left = x;
  owEl("owTickBot").style.left = x;
}

function owApplyGap() {
  const y = "translateY(" + OW.gap + "px)";
  owEl("owB").style.transform = y;
  owEl("owLower").style.transform = y;
  owEl("owTagB").style.transform = y;
  owEl("owGrip").textContent = OW.gap <= 2 ? "close" : Math.round(OW.gap) + " px";
}

function owGroundText(f) {
  if (!OW.ground || !f || !f.g) return "";
  const el = OW.ground.wordEls.get(f.g);
  return el ? el.textContent.trim() : "";
}

/* Every ground word of one target word, joined -- what the ground line shows
 * when the spoken word is too short to sequence them (owFrameOfWord). */
function owGroundPhrase(t) {
  if (!OW.ground || !OW.pairs) return "";
  const ids = OW.pairs[OW.toks[t] && OW.toks[t].id] || [];
  return ids.map(function (id) {
    const el = OW.ground.wordEls.get(id);
    return el ? el.textContent.trim() : "";
  }).filter(Boolean).join(" ");
}

function owContextStrip(t) {
  const el = owEl("owContext");
  if (!OW.context) { el.innerHTML = ""; return; }
  let h = "";
  for (let k = Math.max(0, t - 6); k < Math.min(OW.toks.length, t + 7); k++) {
    h += (k === t ? "<b>" + esc(OW.toks[k].w) + "</b>" : esc(OW.toks[k].w)) + " ";
  }
  el.innerHTML = h;
}

/* Paint one frame. `force` repaints geometry that did not change identity
 * (a resize, a font change, a drag). */
function owPaint(force) {
  if (!OW.on || !OW.F.length) return;
  OW.f = Math.max(0, Math.min(OW.F.length - 1, OW.f));
  const f = OW.F[OW.f];
  const tok = OW.toks[f.t];
  if (!tok) return;
  const collapsed = !!OW.collapsed;
  const id = f.t + ":" + f.k + ":" + (collapsed ? "c" : "") + ":" + OW.toks.length;
  if (!force && id === OW.painted) return;
  OW.painted = id;

  owPlaceWord(owEl("owA"), tok.w);
  // The highlight in the view where there is no page for a wash to sit on:
  // the word's own underline, in its colour (Osca, 31 Aug).
  owPaintHighlight(owEl("owA"), tok.id);
  if (OW.ground) owPlaceWord(owEl("owB"), collapsed ? owGroundPhrase(f.t) : owGroundText(f));
  owPaintTicks();

  // the verse beat belongs to the WORD, so it fires on its last frame --
  // once the ground line has finished catching up
  const beat = owEl("owBeat");
  const last = collapsed || f.k === f.n - 1;
  // a stanza is a verse thing; the same beat at the end of a speaker cue or
  // a paragraph of prose is a break, and saying "stanza" there would be wrong
  if (last && tok.paraEnd) {
    beat.textContent = tok.kind === "verse" ? "stanza" : "break";
    beat.classList.add("on");
  } else if (last && tok.lineEnd) { beat.textContent = "line"; beat.classList.add("on"); }
  else beat.classList.remove("on");

  owContextStrip(f.t);
  owPaintAside(f.t);
  owEl("owProgFill").style.width =
    (OW.F.length > 1 ? (100 * OW.f) / (OW.F.length - 1) : 0) + "%";
}

// ------------------------------------------------------------ the two clocks
// Called from the page's own requestAnimationFrame loop (`frame()`), the same
// one the highlight runs on -- so the word on the stage and the word lit in
// the text behind it are decided by one clock, once.
function owFollowClock() {
  const pane = owClockPane();
  if (!pane) return;
  const hit = sentenceAndWordAt(pane, pane.clock.currentTime);
  if (!hit || !hit.wordId) return;
  const t = OW.index.get(hit.wordId);
  if (t === undefined) return;
  const first = OW.firstFrame[t];
  const n = OW.F[first].n;
  const w = rcWordById(pane, hit.wordId);
  const at = w ? owFrameOfWord(pane.clock.currentTime, w.word.start, w.word.end, n, OW_MIN_FRAME_MS)
               : { k: 0, collapsed: false };
  OW.collapsed = at.collapsed;
  OW.f = first + at.k;
  owPaint(false);
}

function owStepTimer() {
  if (!OW.playing || owOnClock()) return;
  const f = OW.F[OW.f];
  if (!f) { owPause(); return; }
  const tok = OW.toks[f.t];
  // the word's own dwell, divided between its frames, with the floor
  const share = Math.max(OW_MIN_FRAME_MS, owDwell(tok, OW.wpm) / f.n);
  OW.timer = setTimeout(function () {
    if (OW.f >= OW.F.length - 1) { owPause(); return; }
    OW.f++;
    owPaint(false);
    owStepTimer();
  }, share);
}

/* The one place the Play button's face is decided. The pane's own play
 * button, a voice command through ReaderControl and the sidebar all reach
 * the same clock, so the stage cannot own "playing" -- it reflects it
 * (`onClockPlay`/`onClockPause` above call this). */
function owPaintPlayButton(playing) {
  OW.playing = !!playing;
  const b = owEl("owPlay");
  b.textContent = playing ? "Pause" : "Play";
  b.classList.toggle("on", !!playing);
}

function owPlay() {
  if (!OW.on || !OW.F.length) return;
  const pane = owClockPane();
  owPaintPlayButton(true);
  // With a voice, Play is the WORDS and only the words -- the voice has its
  // own button beside it (`owVoicePane`). Without one, the reader's clock (a
  // VirtualClock over this chapter's timings) is still what Play starts, and
  // the stage follows it, exactly as before.
  if (pane && !owVoicePane()) { pane.clock.play(); return; }
  if (OW.f >= OW.F.length - 1) OW.f = 0;
  owPaint(false);
  // While the voice is running `owStepTimer` stands down and `owFollowClock`
  // drives the frame -- the word on screen is the word being spoken (rule 3),
  // which is why this is safe to start either way.
  owStepTimer();
}

function owPause() {
  clearTimeout(OW.timer); OW.timer = null;
  owPaintPlayButton(false);
  const pane = owClockPane();
  // and it stops the words, not the voice: pausing the voice is the voice
  // control's job, and stopping one has never meant stopping the other since
  // the two became two controls
  if (pane && !owVoicePane() && !pane.clock.paused) pane.clock.pause();
}

function owToggle() {
  if (OW.playing || (!owVoicePane() && owOnClock())) owPause(); else owPlay();
}

// --------------------------------------------------------------- movement
// Every movement is ONE FRAME -- the smallest change on screen. Back from
// the second ground word returns to the first with the target unmoved; back
// again steps to the previous target word and lands on its LAST ground word,
// because that is the state the reader was most recently in. That falls out
// of the frame list; it is not a special case.
function owSeekFrame(i) {
  OW.f = Math.max(0, Math.min(OW.F.length - 1, i));
  OW.collapsed = false;
  const pane = owClockPane();
  if (pane) {
    const f = OW.F[OW.f];
    const hit = rcWordById(pane, OW.toks[f.t].id);
    if (hit) {
      const span = Math.max(0, hit.word.end - hit.word.start) / Math.max(1, f.n);
      pane.clock.currentTime = hit.word.start + span * f.k + 0.001;
      tick(pane);
    }
  }
  owPaint(true);
}

function owNudge(n) { owSeekFrame(OW.f + n); }

/* Ten TARGET words back, landing on the first frame of one. */
function owBackWords(n) {
  const f = OW.F[OW.f];
  if (!f) return;
  owSeekFrame(OW.firstFrame[Math.max(0, f.t - n)]);
}
function owForwardWords(n) {
  const f = OW.F[OW.f];
  if (!f) return;
  owSeekFrame(OW.firstFrame[Math.min(OW.toks.length - 1, f.t + n)]);
}

/* Up/down. With the reader's clock running that is the pane's playback rate
 * -- the wpm clock is not in use and pretending to change it would be a lie
 * on the face of the control. Without timings it is the wpm itself. */
function owSpeed(delta) {
  const pane = owClockPane();
  if (pane) {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    let i = rates.indexOf(pane.rate);
    if (i < 0) i = 1;
    i = Math.max(0, Math.min(rates.length - 1, i + (delta > 0 ? 1 : -1)));
    pane.rate = rates[i];
    pane.clock.playbackRate = pane.rate;
    pane.els.speedSelect.value = String(pane.rate);
    owPaintRate();
    return;
  }
  const S = window.TTSTVSettings;
  const step = (S && S.WPM ? S.WPM.step : 25) * (delta > 0 ? 1 : -1);
  OW.wpm = S ? S.clamp(OW.wpm + step, S.WPM.min, S.WPM.max, 300) : OW.wpm + step;
  owPaintRate();
  if (S) S.patch({ wpm: OW.wpm });
}

function owPaintRate() {
  const pane = owClockPane();
  owEl("owRate").textContent = pane ? pane.rate + "×  audio" : OW.wpm + " wpm";
}

// ----------------------------------------------------- hold to look a word up
// You cannot tap a word that is gone. Hold the stage: it pauses and opens the
// dictionary on the word standing there, and closing it resumes where it
// stopped. The dictionary path is untouched -- this is a new way to reach
// `lookup()`, not new machinery.
function owLookUp() {
  const f = OW.F[OW.f];
  const tok = f && OW.toks[f.t];
  if (!tok || !OW.pane) return;
  // The hold pauses everything that is running and puts it all back: two
  // controls, two answers remembered.
  const vp = owVoicePane();
  OW.resumeVoiceAfterLookup = !!(vp && !vp.clock.paused);
  OW.resumeAfterLookup = OW.playing || (!vp && owOnClock());
  if (vp && !vp.clock.paused) { vp.clock.pause(); owPaintVoice(); }
  owPause();
  const wEl = OW.pane.wordEls.get(tok.id);
  lookup(OW.pane, tok.text, tok.sentenceId, tok.lang, {
    raw: tok.w,
    wordId: tok.id,
    phon: (wEl && wEl.dataset.phon) || null,
    sentenceText: (OW.pane.sentenceEls.get(tok.sentenceId) || { dataset: {} }).dataset.text,
    side: OW.pane.side,
  });
}

function owOnPopupClosed() {
  if (!OW.on) return;
  if (OW.resumeVoiceAfterLookup) {
    OW.resumeVoiceAfterLookup = false;
    const vp = owVoicePane();
    if (vp && vp.clock.paused) { vp.clock.play(); owPaintVoice(); }
  }
  if (!OW.resumeAfterLookup) return;
  OW.resumeAfterLookup = false;
  owPlay();
}

// ------------------------------------------------------------- building it
function owLanes() { return OW.ground && OW.pairs ? 2 : 1; }

function owRebuild() {
  if (!OW.on) return;
  const pane = OW.pane;
  if (!pane || !pane.book || !pane.els.reading.querySelector(".word")) return;
  const keptId = (OW.F[OW.f] && OW.toks[OW.F[OW.f].t]) ? OW.toks[OW.F[OW.f].t].id : null;

  // The ledger is the BODY words; everything else goes to the line above it
  // (`owAsides`, 1 Sep). Two passes over one read of the page, so the two
  // can never disagree about which paragraph was which.
  const paras = owReadParagraphs(pane);
  OW.asides = owAsides(paras);
  OW.toks = owTokenise(paras.filter(function (p) { return !owIsAside(p); }));
  OW.F = owBuildFrames(OW.toks, owLanes() === 2 ? OW.pairs : null);
  OW.index = new Map(OW.toks.map(function (t, i) { return [t.id, i]; }));
  OW.firstFrame = [];
  OW.F.forEach(function (f, i) { if (OW.firstFrame[f.t] === undefined) OW.firstFrame[f.t] = i; });
  OW.chapterId = pane.currentChapterId;
  OW.collapsed = false;
  OW.f = keptId != null && OW.index.has(keptId) ? OW.firstFrame[OW.index.get(keptId)] : 0;

  document.documentElement.setAttribute("data-oneword-lanes", String(owLanes()));
  owEl("owTagA").textContent = owLanes() === 2 ? String(pane.book.lang || "").toUpperCase() + " — target" : "";
  owEl("owTagB").textContent = owLanes() === 2 && OW.ground.book
    ? String(OW.ground.book.lang || "").toUpperCase() + " — ground" : "";
  owApplyGap();
  owPaintRate();
  owPaintVoice();
  owPaint(true);
}

/* The ground pane must be showing the chapter the ground words are in, or
 * the map resolves to nothing. Word ids carry their chapter (`c001.p…`). */
function owAlignGroundChapter() {
  if (!OW.ground || !OW.pairs || !OW.toks.length) return;
  const ids = OW.pairs[OW.toks[0].id];
  const chapter = ids && ids.length ? String(ids[0]).split(".")[0] : null;
  if (chapter && OW.ground.book && OW.ground.currentChapterId !== chapter
      && OW.ground.book.chapters.some(function (c) { return c.id === chapter; })) {
    renderChapter(OW.ground, chapter);
  }
}

function owOnChapterChange(pane) {
  if (!OW.on || pane !== OW.pane) return;
  owRebuild();
}

/* This chapter's AUDIO landed (or did not) -- `useClock` calls this the way
 * it calls `paintPlayable` for the reading pane, so the two bars answer the
 * same question at the same moment. */
function owOnClockChanged(pane) {
  if (!OW.on || pane !== OW.pane) return;
  owPaintVoice();
  owPaintRate();
}

/* This chapter's timings landed (or did not). The stage does not rebuild --
 * the words are the same -- but which clock it is about to follow has just
 * been decided, and the rate control has to stop claiming otherwise. */
function owOnTimings(pane) {
  if (!OW.on || pane !== OW.pane) return;
  owPaintRate();
  owPaintVoice();
}

/* The setting arrived (from this page, another Reader tab, the Settings page
 * or the phone). Everything one-word mode owns is switched here and nowhere
 * else, so "inert when off" is one branch rather than a promise. */
function owApplySettings(s) {
  if (!s) return;
  const wasOn = OW.on;
  OW.wpm = s.wpm; OW.gap = s.gap; OW.context = s.context;
  OW.on = s.view === "oneword";
  owEl("owCtx").classList.toggle("on", OW.context);
  owEl("oneword").hidden = !OW.on;
  if (!OW.on) {
    if (wasOn) owPause();
    document.documentElement.removeAttribute("data-oneword-lanes");
    OW.toks = []; OW.F = []; OW.painted = null;
    // the panes are on screen again, so an open panel goes back over its own
    // column instead of the full window
    if (wasOn) repositionPopups();
    return;
  }
  OW.pane = panes[0] || null;
  OW.ground = panes.length === 2 ? panes[1] : null;
  if (!wasOn) {
    owLoadPairs(OW.pane, OW.ground).then(function (pairs) {
      OW.pairs = pairs;
      owRebuild();
      owAlignGroundChapter();
    });
  }
  owRebuild();
  owApplyGap();
  // #panes is hidden now: an open panel belongs to the whole window (the
  // stage's pane) or to no window at all (the other column's).
  repositionPopups();
}

// ------------------------------------------------------------------ wiring
owEl("owPlay").addEventListener("click", owToggle);
/* Wired ONCE, on the elements themselves and through the held handles, so a
 * control the paint takes out of the document keeps its handler and works the
 * moment it goes back in (`wireMasterBar` says the same thing about the same
 * problem). */
owVoiceBarEls().play.addEventListener("click", owVoiceToggle);
owVoiceBarEls().mute.addEventListener("click", function () {
  const pane = owVoicePane();
  if (!pane) return;
  setMuted(pane, !pane.muted);   // the pane's own mute, so the two bars agree
  owPaintVoice();
});
owVoiceBarEls().vol.addEventListener("input", function () {
  const pane = owVoicePane();
  if (!pane) return;
  const v = Number(owVoiceBarEls().vol.value) / 100;
  pane.volume = v;
  if (pane.clock) pane.clock.volume = v;
  if (pane.els.audioEl) pane.els.audioEl.volume = v;
  if (pane.els.volume) pane.els.volume.value = String(Math.round(v * 100));
  if (v > 0 && pane.muted) setMuted(pane, false);   // asking to be heard
  owPaintVoice();
});
owEl("owBack").addEventListener("click", function () { owBackWords(OW_REWIND_WORDS); });
owEl("owFaster").addEventListener("click", function () { owSpeed(1); });
owEl("owSlower").addEventListener("click", function () { owSpeed(-1); });
owEl("owCtx").addEventListener("click", function () {
  OW.context = !OW.context;
  owEl("owCtx").classList.toggle("on", OW.context);
  owPaint(true);
  if (window.TTSTVSettings) window.TTSTVSettings.patch({ context: OW.context });
});

/* The gap between the languages is a difficulty dial (step 5c): close, and
 * the ground language is inside the same glance; far, and the reader must
 * commit to the target before allowing themselves to look. Vertical, on the
 * lower rule alone, so it never fights the stage's horizontal swipe. */
(function owDrag() {
  const L = owEl("owLower");
  let y0 = 0, g0 = 0, on = false, pid = null;
  L.addEventListener("pointerdown", function (e) {
    if (owLanes() === 1) return;
    on = true; pid = e.pointerId; y0 = e.clientY; g0 = OW.gap;
    L.setPointerCapture(pid); L.classList.add("dragging"); e.preventDefault();
  });
  L.addEventListener("pointermove", function (e) {
    if (!on || e.pointerId !== pid) return;
    const S = window.TTSTVSettings;
    const lo = S ? S.GAP.min : 0, hi = S ? S.GAP.max : 300;
    OW.gap = Math.max(lo, Math.min(hi, g0 + (e.clientY - y0)));
    owApplyGap();
  });
  const end = function () {
    if (!on) return;
    on = false; L.classList.remove("dragging");
    try { L.releasePointerCapture(pid); } catch (err) { /* already gone */ }
    if (window.TTSTVSettings) window.TTSTVSettings.patch({ gap: Math.round(OW.gap) });
  };
  L.addEventListener("pointerup", end);
  L.addEventListener("pointercancel", end);
  L.addEventListener("dblclick", function () {
    OW.gap = 0; owApplyGap();
    if (window.TTSTVSettings) window.TTSTVSettings.patch({ gap: 0 });
  });
})();

/* The stage, one-handed: tap to play/pause, swipe left/right to skip or
 * rewind, hold to look the current word up. No hover anywhere -- there is
 * nothing on a phone to hover with, and the desktop keeps its keys. */
(function owStageGestures() {
  const stage = owEl("owStage");
  let down = null, hold = null;
  stage.addEventListener("pointerdown", function (e) {
    if (!OW.on) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, held: false };
    hold = setTimeout(function () {
      if (!down || down.moved) return;
      down.held = true;
      owLookUp();
    }, OW_HOLD_MS);
  });
  stage.addEventListener("pointermove", function (e) {
    if (!down) return;
    if (Math.abs(e.clientX - down.x) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
  });
  const finish = function (e) {
    if (!down) return;
    clearTimeout(hold);
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    const held = down.held;
    down = null;
    if (held) return;
    if (Math.abs(dx) > OW_SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      // a finger moving LEFT is forward, the same direction as the reader's
      // two-finger page turn
      if (dx < 0) owForwardWords(OW_REWIND_WORDS); else owBackWords(OW_REWIND_WORDS);
      return;
    }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) return;
    // a tap while the dictionary is open closes it and resumes where it
    // paused -- the other half of hold-to-look-up. It is the stage's own
    // pane's panel: one-word mode reads one pane, and the other column's
    // panel (if the reader left one open) is not on screen to be tapped.
    if (OW.pane && OW.pane.lookup) { closePopup(OW.pane); return; }
    owToggle();
  };
  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", function () { clearTimeout(hold); down = null; });
})();

window.addEventListener("resize", function () {
  if (OW.on) owPaint(true);
  // a rotation changes which columns are on screen and how wide they are
  repositionPopups();
});

// The reading settings reach every page by three routes (settings.js); this
// is the one listener that turns the mode on and off, so nothing else in the
// reader has to know the mode exists.
settingsListeners.push(owApplySettings);
settingsListeners.push(function (s) { paintViewBtn(s && s.view); });
if (readingSettings) { owApplySettings(readingSettings); paintViewBtn(readingSettings.view); }

// A door for the desktop app's View menu and for headless checks -- the same
// shape as window.TTSTVFind/TTSTVActions above, and the same rule: the menu
// binds toggle(), because a native accelerator never reaches the page.
window.TTSTVView = {
  get: function () { return OW.on ? "oneword" : "page"; },
  set: function (view) {
    if (!window.TTSTVSettings) return null;
    window.TTSTVSettings.patch({ view: view === "oneword" ? "oneword" : "page" });
    // `patch` writes localStorage synchronously and the subscription would
    // deliver this back within a second anyway -- but a control must not
    // look dead for that second, so this page applies its own click at once
    // and lets the poll reach the other tabs.
    owApplySettings(window.TTSTVSettings.read());
    return view;
  },
  toggle: function () { return window.TTSTVView.set(OW.on ? "page" : "oneword"); },
  isOneWord: function () { return OW.on; },
};

/* The same shape as TTSTVView/TTSTVFind: a door the Mac menu bar and a
 * headless check can both use, because a native accelerator never reaches
 * the page. */
window.TTSTVPanes = {
  get synced() { return SYNCED; },
  set: function (on) { setSynced(on); return SYNCED; },
  toggle: function () { setSynced(!SYNCED); return SYNCED; },
  get voice() { return voiceSide; },
  swapVoice: function () { swapVoice(); return voiceSide; },
  get focused() { return focusedPane ? focusedPane.side : null; },
  // the shape, through the same door: a native accelerator never reaches the
  // page, so a menu-bar item for the layout has to arrive here
  get selected() { const p = selectedPane(); return p ? p.side : null; },
  get layout() { return paneLayoutModel().layout; },
  setLayout: function (name) { return setPaneLayout(name); },
  cycleLayout: function () { return cyclePaneLayout(); },
};

window.__ONEWORD_DEBUG__ = {
  OW: OW,
  // the line above the ledger (1 Sep, job 3)
  asides: owAsides, asideAt: owAsideAt, paintAside: owPaintAside,
  isAside: owIsAside, readParagraphs: owReadParagraphs, tokenise: owTokenise,
  pivotX: owPivotX,
  nudge: owNudge,
  back: owBackWords,
  lookUp: owLookUp,
  rebuild: owRebuild,
  setPairs: function (p) { OW.pairs = p; owRebuild(); },
  frameId: function () { const f = OW.F[OW.f]; return f ? { t: f.t, k: f.k, n: f.n, word: OW.toks[f.t].w } : null; },
};
