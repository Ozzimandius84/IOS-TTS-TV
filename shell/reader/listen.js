/* ========================= LISTEN ALONG — the audio and the highlight =====
   Job 15 Step 3(a), 5 September. The design shell is the reader now; this is
   the one thing the picture does not show and the product cannot be without.
   Osca: the product is "reading / listening / hands-free".

   WHAT IT IS. One module, mounted by reader.html after book-nav.js:

     Listen.mount({ nav, col, pane, slug, book }) -> control

   It plays `books/<slug>/audio/<cid>.<ext>` for the chapter the reader is on
   and moves two highlights over the words as it goes. It also IS
   `window.ReaderControl`, which is the shape `voiceui/reader-bridge.js`
   demands before the hands-free layer will attach at all.

   NOTHING IS WRAPPED IN A SPAN, AND THAT IS THE WHOLE TRICK.
   The old reader (3d2c7a9 reader/reader.html, renderParagraph) built one
   `<span class="word" data-id>` per word -- four thousand spans a chapter --
   because a class was the only way it knew to tint one. page.js does not
   build those and must not start: it emits one `<p class="line">` per block
   with exactly ONE TEXT NODE inside, and every measurement in page.js,
   pane.js and book-nav.js is taken against that shape. So the highlight here
   is a CSS Custom Highlight over a Range -- the same mechanism book-nav.js
   already uses for `word-target` (its own comment: "no DOM rewritten, no
   words individually wrapped"), and the same one reader.html's own
   diagnostics box already probes for under the name "word highlight".
   The markup the shell renders is byte-identical whether this file is
   loaded or not.

   WHERE THE WORD IDS COME FROM, AND WHY THIS FILE HAS TO DO ANY MAPPING.
   `books/<slug>/timings/<cid>.json` is keyed by SENTENCE ID
   (`c001.p0004.s01`) with a word id per word (`...w003`) and no text at all.
   `book-data.js` -- what the shell actually draws from -- carries the text
   and no ids: `core/bookdata.py` projects a paragraph down to
   `{"r","t","st"}` and drops every id on the way. Neither file alone can
   say "this word, at this second, is those characters".

   So the map is rebuilt here, and since job 15b step 5 it is rebuilt PER
   CHAPTER, out of two small files, and `book.json` is never fetched:

     books/<slug>/chapters/<cid>.txt   the text, one paragraph per blank line
     books/<slug>/timings/<cid>.json   the ids, and no text at all

   WHY THAT MATTERS MORE THAN IT SOUNDS. `book.json` is 655 KB on `poems` and
   **96 MB on the Complete Works** -- the whole parse, every span anchor and
   every word of every chapter, fetched to light one word of one chapter. On
   a phone that is not a stall, it is a dead app. `chapters/<cid>.txt` is a
   few kilobytes and `core/schema.py` writes it at every parse:
   `Chapter.text`, which is `"\n\n".join(p.text)` over `Paragraph.text`,
   which is `" ".join(s.text)`. That is `core/bookdata.py::_text_of`'s own
   join with ONE known difference -- bookdata does `t.rstrip(".")` on a
   SPEAKER paragraph -- and measured across the whole shelf that is the only
   difference there is: 1,060 of 1,871 chapters identical, and every one of
   the other 811 differs in exactly that trailing full stop and nothing else.
   Nothing here compares the two strings anyway: the offsets come from the
   text node page.js rendered, and the .txt is used for the paragraph LIST.

   HOW A PARAGRAPH FINDS ITS IDS WITHOUT book.json. A sentence id carries its
   paragraph (`c001.p0004.s01`), and `p0004` is the paragraph's 1-based place
   in the chapter -- measured, on every book on the shelf. That is a HINT and
   it is used as one: it says which `<p>` a group of timings belongs to, and
   the pairing is then CHECKED by counting -- the paragraph's whitespace
   tokens against that group's words. Equal, and every word id gets exact
   characters; unequal, and that paragraph gets no word-level map at all
   rather than a wrong one. Measured across every chapter that has timings:
   **2,987 of 3,067 paragraphs pair exactly, and 20,064 of 20,438 word ids
   resolve** -- and the 2.6% that do not are the ones a wrong guess would
   have lit somewhere else.

   The chapter as a whole is still checked positionally (`paras.length ===
   els.length`) and refused whole when the two lists do not correspond,
   because half a map lights the wrong word, which is worse than no
   highlight.

   THE FALLBACK, AND ITS CAP. A book folder with no `chapters/` -- an older
   parse -- still falls back to `book.json`, but only if it is under 5 MB;
   over that the chapter gets no word highlight and the page SAYS SO in a
   line rather than hanging on a 96 MB fetch.

   THE FLAT INDEX IS BOOK-NAV'S, NOT A SECOND ONE. book-nav.js's
   `buildWordDomIndex` already numbers every word of a chapter for one-word
   view, by splitting each `p.line`'s text node on whitespace. This file
   numbers the same way over the same elements so that a word id resolves to
   the SAME integer, and `nav.goTo(chapter, i)` therefore moves the book's
   one cursor to the word being spoken -- which is Osca's own rule, 4 Sep:
   "the one word view AND the voice highlight/cursor is the same thing."

   WHAT IS NOT HERE, deliberately: no transport bar, no volume, no speed
   row, no chapter buttons. None of them is in the picture, and job 15 says
   nothing is redesigned. The keys and `window.ReaderControl` are the doors.  */
(function () {
"use strict";

/* the old reader's list, in the old reader's order (3d2c7a9 reader.html:443) */
const AUDIO_EXTS = ["mp3", "wav", "m4a", "opus", "ogg"];

/* The fallback's cap. `book.json` is 655 KB on `poems` and 96 MB on the
   Complete Works; five megabytes is well above every book on the shelf that
   has no `chapters/` and well below the one that would kill a phone. */
const BOOK_JSON_CAP = 5 * 1024 * 1024;

/* ---------------------------------------------------------- virtual clock
   Verbatim in behaviour from the old reader (3d2c7a9 reader.html:364-402):
   stands in for <audio> when a chapter has timings and no rendered audio, so
   the highlight still runs. currentTime is computed from wall clock, so
   there is no timer of its own.                                            */
class VirtualClock extends EventTarget {
  constructor() {
    super();
    this._base = 0; this._playing = false; this._playStart = 0;
    this._rate = 1; this.duration = Infinity; this.muted = false; this.volume = 1;
  }
  get currentTime() {
    if (!this._playing) return this._base;
    return this._base + ((performance.now() - this._playStart) / 1000) * this._rate;
  }
  set currentTime(v) {
    this._base = Math.max(0, v);
    if (this._playing) this._playStart = performance.now();
  }
  get paused() { return !this._playing; }
  get playbackRate() { return this._rate; }
  set playbackRate(v) {
    this._base = this.currentTime; this._rate = v;
    if (this._playing) this._playStart = performance.now();
  }
  play() {
    if (!this._playing) {
      this._playing = true; this._playStart = performance.now();
      this.dispatchEvent(new Event("play"));
    }
    return Promise.resolve();
  }
  pause() {
    if (this._playing) {
      this._base = this.currentTime; this._playing = false;
      this.dispatchEvent(new Event("pause"));
    }
  }
}

/* items sorted ascending by .start; the last one whose start <= t
   (3d2c7a9 reader.html:333) */
function findIndex(items, t) {
  if (!items.length) return -1;
  let lo = 0, hi = items.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].start <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

/* core/bookdata.py::_text_of, in JS. The sentences of a paragraph joined
   with a SPACE, empties dropped -- this exact string is what book-data.js
   carries and page.js prints, so the offsets below are offsets into the
   text node on the page. */
function sentenceTexts(para) {
  return (para.sentences || [])
    .map(s => String(s.text == null ? "" : s.text).trim())
    .map((t, i) => ({ t, sent: para.sentences[i] }))
    .filter(x => x.t !== "");
}
function textOf(para) { return sentenceTexts(para).map(x => x.t).join(" "); }

/* core/bookdata.py::chapters_of's role test, in JS: a paragraph becomes a
   `sp` block, a `dir` block, or a `l` block -- and page.js turns those into
   `p.sp`, `p.dir` and `p.line` in that same order. */
function blockRole(para) {
  const role = para.role || "line";
  if (role === "speaker" || para.kind === "speaker") return "sp";
  if (role === "direction") return "dir";
  return "l";
}

/* the same split book-nav.js::buildWordDomIndex performs, so a token here is
   a token there: whitespace-separated runs, with their character offsets */
function tokenise(text, from, to) {
  const out = [];
  let i = from;
  while (i < to) {
    while (i < to && /\s/.test(text[i])) i++;
    const s = i;
    while (i < to && !/\s/.test(text[i])) i++;
    if (i > s) out.push({ s, e: i });
  }
  return out;
}

function mount(o) {
  const nav = o.nav, col = o.col, pane = o.pane;
  const slug = o.slug || (o.book && o.book.slug) || "";
  const base = "../books/" + encodeURIComponent(slug) + "/";
  const book = o.book;

  /* the one <audio>. It is furniture, not chrome: no controls attribute, no
     place in the layout, nothing to see. */
  const audio = o.audioEl || (function () {
    const a = document.createElement("audio");
    a.className = "listen-audio"; a.preload = "none";
    document.body.appendChild(a);
    return a;
  })();

  let clock = audio;
  let listenersClock = null;
  let fallback = null;          // book.json's chapters, by id -- only if there is no chapters/
  let fallbackPromise = null;
  const paraCache = new Map();  // chapter id -> [paragraph text] | null
  const built = new Map();      // chapter index -> map (or null when unalignable)
  let cur = null;               // the chapter state currently loaded
  let curIdx = -1;
  let rate = 1;
  let hiOK = !!(window.CSS && CSS.highlights && window.Highlight);
  let lastPara = null;

  const chIndexById = new Map(((book && book.chapters) || []).map((c, i) => [c.id, i]));

  /* ------------------------------------------------------------ the map */

  /* ONE CHAPTER'S PARAGRAPHS. `core/schema.py` writes this file at every
     parse (`Chapter.write`, `chapters/<id>.txt`), one paragraph per blank
     line. Empty entries are dropped, which is what `core/bookdata.py` does
     to a paragraph with no sentence text -- so this list and the `<p>`s
     page.js rendered are the same list, in the same order. */
  function chapterParas(cid) {
    if (paraCache.has(cid)) return Promise.resolve(paraCache.get(cid));
    return fetch(base + "chapters/" + encodeURIComponent(cid) + ".txt")
      .then(r => (r.ok ? r.text() : null))
      .then(txt => {
        const out = txt == null ? null
          : txt.split("\n\n").filter(s => s.trim() !== "");
        paraCache.set(cid, out);
        return out;
      })
      .catch(() => { paraCache.set(cid, null); return null; });
  }

  /* THE FALLBACK, FOR A BOOK FOLDER WITH NO chapters/. It is capped, and the
     cap is the whole point: the file this replaces is 96 MB on the Complete
     Works and fetching it is how the phone dies. `HEAD` first -- studio's
     server and every static server answer it -- and over the cap the answer
     is a sentence on the page, not a hang. */
  function bookJsonFallback() {
    if (fallbackPromise) return fallbackPromise;
    fallbackPromise = fetch(base + "book.json", { method: "HEAD" })
      .then(r => {
        const n = +(r.headers.get("content-length") || 0);
        if (n > BOOK_JSON_CAP) {
          say("this book has no per-chapter text yet, and its book.json is "
              + Math.round(n / 1048576) + " MB — reading along is off for now");
          return null;
        }
        return fetch(base + "book.json").then(r2 => (r2.ok ? r2.json() : null));
      })
      .then(j => {
        fallback = new Map(((j && j.chapters) || []).map(c => [c.id, c]));
        return fallback;
      })
      .catch(() => { fallback = new Map(); return fallback; });
    return fallbackPromise;
  }

  /* ONE LINE ON THE PAGE, and it is created only if it is ever needed, so
     the page the shell lays out is the page it laid out before. */
  let whyEl = null;
  function say(text) {
    console.warn("[listen] " + text);
    try {
      if (!whyEl) {
        whyEl = document.createElement("div");
        whyEl.id = "listenwhy";
        document.body.appendChild(whyEl);
      }
      whyEl.textContent = text;
      whyEl.hidden = false;
    } catch (e) { /* no document to say it in */ }
  }

  /* the paragraph a sentence id names, as a 1-based place in the chapter.
     A HINT -- see the header -- verified by counting before it is used. */
  function paraIndexOf(sentenceId) {
    const parts = String(sentenceId || "").split(".");
    if (parts.length < 2 || parts[1].charAt(0) !== "p") return -1;
    const n = parseInt(parts[1].slice(1), 10);
    return isFinite(n) ? n - 1 : -1;
  }

  /* One chapter's word ids, sentence ids and character offsets, against the
     elements page.js actually rendered. `paras` is the chapter's paragraph
     TEXT in order (from `chapters/<cid>.txt`, or from the capped book.json
     fallback) and `timings` is where every id comes from. Returns null when
     the two lists do not correspond -- which is the only honest answer,
     because half a map highlights the wrong words rather than none. */
  function buildMap(chIdx, paras, timings) {
    const ch = book.chapters[chIdx];
    const sec = col && col.querySelector('.chapter[data-ch="' + chIdx + '"]');
    if (!paras || !sec) return null;

    const els = [...sec.querySelectorAll("p.line, p.sp, p.dir")];
    if (paras.length !== els.length) {
      console.warn("[listen] " + ch.id + ": " + paras.length + " paragraphs but "
        + els.length + " rendered -- no word highlight for this chapter");
      return null;
    }

    /* Each element's tokens, once, and where book-nav.js's flat numbering
       starts for it. `buildWordDomIndex` splits each `p.line`'s text node on
       whitespace and numbers the chapter's words in DOM order, counting only
       `p.line`; number the same way and a word id resolves to the SAME
       integer, so `nav.goTo(chapter, i)` moves the book's one cursor to the
       word being spoken. */
    const per = [];
    let flat = 0;
    for (const el of els) {
      const node = el.firstChild;
      const isLine = el.classList.contains("line");
      const text = (node && node.nodeType === 3) ? (node.nodeValue || "") : null;
      const toks = text == null ? [] : tokenise(text, 0, text.length);
      per.push({ el, node, isLine, toks, flat });
      if (isLine) flat += toks.length;
    }

    /* the timings, grouped by the paragraph their sentence ids name, in
       reading order inside each group */
    const groups = new Map();
    for (const s of timings.sentences) {
      const i = paraIndexOf(s.id);
      if (i < 0) continue;
      if (!groups.has(i)) groups.set(i, []);
      groups.get(i).push(s);
    }

    const byWordId = new Map(), bySentId = new Map(), sentWords = new Map();
    const ids = [];
    let exact = 0, refused = 0;
    for (const i of [...groups.keys()].sort((a, b) => a - b)) {
      const sents = groups.get(i);
      const P = per[i];
      /* a paragraph id from an OLDER parse than the text on disk: it names a
         paragraph this chapter does not have. Dropped, not guessed at. */
      if (!P || !P.node) { refused += sents.length; continue; }

      const total = sents.reduce((n, s) => n + s.words.length, 0);
      if (total !== P.toks.length) {
        /* THE COUNT IS THE CHECK, and this is where a wrong guess would go
           wrong. The paragraph still gets a sentence mark when it holds
           exactly one sentence -- then the sentence IS the paragraph and
           there is nothing to be wrong about -- and no word marks at all. */
        refused++;
        if (sents.length === 1 && P.toks.length) {
          bySentId.set(sents[0].id, { node: P.node, el: P.el,
            s: P.toks[0].s, e: P.toks[P.toks.length - 1].e });
        }
        continue;
      }

      let k = 0;
      for (const s of sents) {
        const n = s.words.length;
        if (!n) continue;
        const first = P.toks[k], last = P.toks[k + n - 1];
        bySentId.set(s.id, { node: P.node, el: P.el, s: first.s, e: last.e });
        const list = [];
        for (let w = 0; w < n; w++) {
          const tk = P.toks[k + w];
          byWordId.set(s.words[w].id, {
            node: P.node, el: P.el, s: tk.s, e: tk.e,
            flat: P.isLine ? P.flat + k + w : -1,
          });
          ids.push(s.words[w].id);
          list.push({ id: s.words[w].id, text: P.node.nodeValue.slice(tk.s, tk.e) });
        }
        sentWords.set(s.id, list);
        k += n;
      }
      exact++;
    }
    if (refused) {
      console.warn("[listen] " + ch.id + ": " + exact + " paragraphs mapped exactly, "
        + refused + " left unmapped rather than guessed at");
    }

    /* THE INVERSE, for the margin (job 15b step 2). A mark is a RUN of word
       ids and the cursor is a flat index, so a mark made at the cursor needs
       flat -> id; `ids` is the chapter's ids in reading order, which is what
       `margSpanIds` walks. Both are this map's by-products, not a second
       pass. */
    const byFlat = new Map();
    for (const [id, hit] of byWordId) {
      if (hit.flat >= 0 && !byFlat.has(hit.flat)) byFlat.set(hit.flat, id);
    }

    return { byWordId, bySentId, byFlat, sentWords, ids, id: ch.id,
             exact, refused };
  }

  /* The one door to a chapter's map, cached per chapter. Two small files --
     `chapters/<cid>.txt` and `timings/<cid>.json` -- and `book.json` only as
     a capped fallback for a book folder that has no `chapters/`. */
  function mapFor(chIdx) {
    if (built.has(chIdx)) return Promise.resolve(built.get(chIdx));
    const ch = book.chapters && book.chapters[chIdx];
    if (!ch) return Promise.resolve(null);
    return Promise.all([chapterParas(ch.id), timingsFor(ch.id)])
      .then(([paras, timings]) => {
        if (built.has(chIdx)) return built.get(chIdx);
        if (paras) {
          const m = buildMap(chIdx, paras, timings);
          built.set(chIdx, m);
          return m;
        }
        return bookJsonFallback().then(fb => {
          const rawCh = fb && fb.get(ch.id);
          const list = rawCh
            ? (rawCh.paragraphs || []).map(textOf).filter(s => s !== "")
            : null;
          const m = list ? buildMap(chIdx, list, timings) : null;
          built.set(chIdx, m);
          return m;
        });
      });
  }

  /* --------------------------------------------------------- the timings */
  const timingCache = new Map();
  function timingsFor(cid) {
    if (timingCache.has(cid)) return timingCache.get(cid);
    const p = loadTimings(cid);
    timingCache.set(cid, p);
    return p;
  }
  function loadTimings(cid) {
    return fetch(base + "timings/" + encodeURIComponent(cid) + ".json")
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j) return { sentences: [], duration: 0 };
        const sentences = Object.keys(j).map(id => ({
          id,
          start: +j[id].start || 0,
          end: +j[id].end || 0,
          words: (j[id].words || []).map(w => ({ id: w.id, start: +w.start || 0, end: +w.end || 0 })),
        })).sort((a, b) => a.start - b.start);
        const duration = sentences.length ? sentences[sentences.length - 1].end : 0;
        return { sentences, duration };
      })
      .catch(() => ({ sentences: [], duration: 0 }));
  }

  /* ----------------------------------------------------------- the audio
     The old reader's swap-in, unchanged in shape (3d2c7a9 reader.html:1449):
     try each extension in turn and fall back to a VirtualClock when the book
     has timings but voice/ has not rendered it yet. `preload="none"` will
     not probe a src on its own, so load() is forced to make onerror fire. */
  function loadAudio(cid) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    return new Promise(resolve => {
      let i = 0;
      const tryNext = () => {
        if (i >= AUDIO_EXTS.length) {
          audio.onerror = null; audio.oncanplay = null;
          resolve(new VirtualClock());
          return;
        }
        audio.src = base + "audio/" + cid + "." + AUDIO_EXTS[i++];
        audio.load();
      };
      audio.onerror = tryNext;
      audio.oncanplay = () => { audio.onerror = null; audio.oncanplay = null; resolve(audio); };
      tryNext();
    });
  }

  function useClock(next) {
    if (listenersClock !== next) {
      if (listenersClock) {
        listenersClock.removeEventListener("play", onPlay);
        listenersClock.removeEventListener("pause", onPause);
      }
      next.addEventListener("play", onPlay);
      next.addEventListener("pause", onPause);
      listenersClock = next;
    }
    clock = next;
    clock.currentTime = 0;
    clock.playbackRate = rate;
  }
  function onPlay() { paint(); }
  function onPause() { paint(); }

  /* ------------------------------------------------------- the highlight */
  function setHighlight(name, range) {
    if (!hiOK) return;
    try {
      if (range) CSS.highlights.set(name, new Highlight(range));
      else CSS.highlights.delete(name);
    } catch (e) { hiOK = false; }
  }
  function rangeOf(hit) {
    if (!hit) return null;
    try {
      const r = document.createRange();
      r.setStart(hit.node, hit.s); r.setEnd(hit.node, hit.e);
      return r;
    } catch (e) { return null; }
  }
  function clearHighlights() {
    setHighlight("listen-sentence", null);
    setHighlight("listen-word", null);
    lastPara = null;
  }

  /* one frame: where the clock is, and the two marks that say so */
  function paint() {
    if (!cur || !cur.timings.sentences.length) return;
    const t = clock.currentTime;
    const sIdx = findIndex(cur.timings.sentences, t);
    const sent = cur.timings.sentences[sIdx];
    if (!sent) return;

    const sHit = cur.map && cur.map.bySentId.get(sent.id);
    setHighlight("listen-sentence", rangeOf(sHit));
    /* THE PAGE IS FOLLOW'S NOW (13 Sep, FOLLOW). This used to end with
       `sHit.el.scrollIntoView({block:"nearest", behavior:"smooth"})` on every
       change of PARAGRAPH -- an unconditional, un-turn-off-able move of the
       smallest distance that put the paragraph on screen, which is a move per
       paragraph for ever and a reader who has scrolled away being dragged
       back. `reader/follow.js` owns the scroller instead: one decision per
       SENTENCE, on the sentence changing and at no other moment, and a button
       on the play bar that turns it off. Two things moving one scroller is the
       fight that reads as a jump, so this half is gone rather than gated.
       `lastPara` stays -- `clearHighlights` resets it -- because it is still
       what says a paragraph has changed. */
    if (sHit && sHit.el && sHit.el !== lastPara) lastPara = sHit.el;

    if (!clock.paused && sent.words.length) {
      const w = sent.words[findIndex(sent.words, t)];
      const hit = cur.map && cur.map.byWordId.get(w.id);
      setHighlight("listen-word", rangeOf(hit));
      /* ONE CURSOR. book-nav.js owns it; this moves it rather than keeping a
         second one, so one-word view opens on the word being spoken. */
      if (hit && hit.flat >= 0 && nav && nav.goTo) {
        const c = nav.cursor;
        if (!c || c.chapter !== curIdx || c.word !== hit.flat) nav.goTo(curIdx, hit.flat);
      }
    } else {
      setHighlight("listen-word", null);
    }
  }

  let frameOn = false;
  function frame() {
    if (!frameOn) return;
    paint();
    requestAnimationFrame(frame);
  }
  function startFrames() { if (!frameOn) { frameOn = true; requestAnimationFrame(frame); } }

  /* --------------------------------------------------- which chapter, then
     The cursor first -- "playback starts from the cursor" is the old
     reader's own rule (3d2c7a9 reader.html, wireMasterBar) -- and failing
     that, the chapter under the reading line, which is the same 0.35 line
     page.js paints the runhead from. */
  function chapterUnderLine() {
    if (!col) return 0;
    const secs = [...col.querySelectorAll(".chapter[data-ch]")];
    if (!secs.length) return 0;
    const line = pane ? pane.getBoundingClientRect().top + pane.clientHeight * 0.35 : 0;
    let idx = +secs[0].dataset.ch;
    for (const s of secs) {
      if (s.getBoundingClientRect().top <= line) idx = +s.dataset.ch; else break;
    }
    return idx;
  }
  function wantedChapter() {
    const c = nav && nav.cursor;
    if (c && book.chapters && book.chapters[c.chapter]) return c.chapter;
    return chapterUnderLine();
  }

  /* load a chapter's timings, map and audio. Idempotent per chapter. */
  function open(chIdx) {
    if (curIdx === chIdx && cur) return Promise.resolve(cur);
    const ch = book.chapters && book.chapters[chIdx];
    if (!ch) return Promise.resolve(null);
    curIdx = chIdx;
    clearHighlights();
    return Promise.all([timingsFor(ch.id), mapFor(chIdx), loadAudio(ch.id)])
      .then(([timings, map, c]) => {
        cur = { idx: chIdx, id: ch.id, timings, map };
        useClock(c);
        startFrames();
        return cur;
      });
  }

  /* the time a flat word index sits at, so pressing play at the cursor
     starts where the cursor is rather than at the top of the chapter */
  function timeOfFlat(flat) {
    if (!cur || !cur.map) return null;
    for (const s of cur.timings.sentences) {
      for (const w of s.words) {
        const hit = cur.map.byWordId.get(w.id);
        if (hit && hit.flat === flat) return w.start;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ the doors */
  function play() {
    return open(wantedChapter()).then(() => {
      if (!cur) return;
      const c = nav && nav.cursor;
      if (c && c.chapter === curIdx && clock.currentTime < 0.01) {
        const t = timeOfFlat(c.word);
        if (t != null) clock.currentTime = t + 0.001;
      }
      return clock.play();
    });
  }
  function pause() { clock.pause(); }
  function toggle() { return clock.paused ? play() : (pause(), Promise.resolve()); }

  function flatWords() {
    return cur ? cur.timings.sentences.flatMap(s => s.words) : [];
  }
  function sentenceAndWordAt(t) {
    if (!cur || !cur.timings.sentences.length) return null;
    const sent = cur.timings.sentences[findIndex(cur.timings.sentences, t)];
    let wordId = null;
    if (sent.words.length) wordId = sent.words[findIndex(sent.words, t)].id;
    return { sent, wordId };
  }

  const control = {
    /* ---- what voiceui/reader-bridge.js demands (REQUIRED_METHODS) ------- */
    getPosition() {
      if (!cur) return null;
      const hit = sentenceAndWordAt(clock.currentTime);
      if (!hit) return null;
      return {
        chapterId: cur.id, sentenceId: hit.sent.id, wordId: hit.wordId,
        atSentenceStart: Math.abs(clock.currentTime - hit.sent.start) < 0.05,
      };
    },
    getSpeed() { return rate; },
    setSpeed(side, r) { rate = +r || 1; clock.playbackRate = rate; },
    isPaused() { return clock.paused; },
    play() { play(); },
    pause() { pause(); },
    seekSentenceDelta(side, delta) {
      if (!cur || !cur.timings.sentences.length) return;
      const i = findIndex(cur.timings.sentences, clock.currentTime);
      const j = Math.min(cur.timings.sentences.length - 1, Math.max(0, i + delta));
      clock.currentTime = cur.timings.sentences[j].start + 0.001;
      paint();
    },
    seekWordDelta(side, delta) {
      const words = flatWords();
      if (!words.length) return;
      const i = findIndex(words, clock.currentTime);
      const j = Math.min(words.length - 1, Math.max(0, i + delta));
      clock.currentTime = words[j].start + 0.001;
      paint();
    },
    seekSeconds(side, d) {
      const dur = (cur && cur.timings.duration) || clock.duration || Infinity;
      clock.currentTime = Math.min(dur, Math.max(0, clock.currentTime + d));
      paint();
    },
    /* THE GROUND ROLE IS NOT HERE, AND IT IS LOGGED RATHER THAN FAKED.
       Both of these answer for the OTHER book of a pair, and the design
       shell has one reading pane and no `?left=&right=` grammar behind it
       yet. voiceui's "ground" side therefore has nothing to speak: the
       bridge attaches (which is what Step 3(c) asks for), the two aligned
       calls say plainly that there is no second book, and job 15's §6 asks
       Osca for the pair. Returning a wrong sentence id would be worse than
       returning none. */
    getAlignedSentenceId() { return null; },
    playAlignedSegment() { return Promise.resolve(); },

    /* ---- OPTIONAL_METHODS ---------------------------------------------- */
    seekToWord(side, wordId) {
      if (!cur) return false;
      for (const s of cur.timings.sentences) {
        for (const w of s.words) {
          if (w.id === wordId) { clock.currentTime = w.start + 0.001; paint(); return true; }
        }
      }
      return false;
    },
    playRange(side, r) {
      if (!cur) return Promise.resolve(null);
      const hit = sentenceAndWordAt(clock.currentTime);
      const from = r && r.from === "sentenceStart" && hit ? hit.sent.start : null;
      if (from != null) clock.currentTime = from + 0.001;
      const stopAt = r && r.to === "sentenceEnd" && hit ? hit.sent.end : null;
      return new Promise(resolve => {
        clock.play();
        const step = () => {
          if (stopAt != null && clock.currentTime >= stopAt) { clock.pause(); }
          if (clock.paused) {
            const h = sentenceAndWordAt(clock.currentTime);
            resolve(h ? { sentenceId: h.sent.id, wordId: h.wordId, time: clock.currentTime, aborted: false } : null);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },

    /* ---- two of voiceui's OPTIONAL_DATA_HOOKS. The third,
       getDictionaryEntry, wants books/<slug>/dictionary.json (6.9 MB on
       poems) and no part of the picture reads it -- §6. */
    /* OFF THE MAP, NOT OFF book.json (job 15b step 5). voiceui wants
       `[{id, text}]` for one sentence -- `resolve.js` matches `w.text` and
       `app.js` counts them -- and the map already holds exactly that, from
       the characters actually on the page. A sentence in a paragraph the
       count check refused has no answer, and null is the honest one:
       voiceui's `groundStopOrdinal` falls back to the same ordinal when a
       word list is unknown, which it is written to do. */
    getSentenceWords(side, sentenceId) {
      const map = cur && cur.map;
      if (!map || !map.sentWords) return null;
      const list = map.sentWords.get(sentenceId);
      return list ? list.slice() : null;
    },
    getPreviousSentenceId(side, sentenceId) {
      if (!cur) return null;
      const i = cur.timings.sentences.findIndex(s => s.id === sentenceId);
      return i > 0 ? cur.timings.sentences[i - 1].id : null;
    },

    /* ---- this page's own, for the keys and for a test to press ---------- */
    /* ONE CHAPTER'S MAP, WITHOUT OPENING IT. `open` loads the audio too,
       which is the wrong price for the margin: marginalia.js wants the
       chapter a MARK is in, which is usually not the chapter being read.
       The map is cached per chapter either way, so asking twice is free. */
    mapOf: mapFor,
    chapterIndexOf(cid) {
      return chIndexById.has(cid) ? chIndexById.get(cid) : -1;
    },
    chapterIdOf(chIdx) {
      const ch = book.chapters && book.chapters[chIdx];
      return ch ? ch.id : null;
    },
    toggle, open, paint,
    get chapterIndex() { return curIdx; },
    get clock() { return clock; },
    get timings() { return cur ? cur.timings : null; },
    get map() { return cur ? cur.map : null; },
    get audioEl() { return audio; },
  };

  return control;
}

window.Listen = { mount, VirtualClock, findIndex, tokenise, textOf, blockRole };
})();
