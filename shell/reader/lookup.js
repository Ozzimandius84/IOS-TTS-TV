/* ========================= LOOK UP — the word under the finger ===========
   Job 15b step 1, 6 September. Osca's own order of the second half: "lookup
   first. Learning languages is the product; this is the one that makes it."

   WHAT IT IS. One module, mounted by reader.html beside Listen:

     Lookup.mount({ nav, col, pane, slug, control }) -> control

   Double-click (or tap) a word in the reading column and this answers with
   what `books/<slug>/dictionary.json` holds for it. It also hangs
   `getDictionaryEntry` on `window.ReaderControl`, which is the third of
   voiceui's OPTIONAL_DATA_HOOKS and the only one job 15 step 3 left off --
   so with this file loaded voiceui/app.js's boot line stops reading
   "dictionary hooks missing" and the SPOKEN look-up answers.

   THREE THINGS IT DOES NOT DO, AND EACH IS DELIBERATE.

   1. It adds NO element to the reader. The panel below is created here, at
      mount, `position: fixed` and `hidden`; `#book` and everything inside it
      is untouched, so `reader/tests/browser/listen_shell.py`'s 74 boxes are
      the same 74 boxes. The old reader painted its panel into the pane's own
      box and had to measure `paneOnScreen` to know whether to draw it at all
      (3d2c7a9 lookup.js::positionPopup); the shell has one reading pane, so
      the panel is a sheet under it and there is nothing to decide.

   2. It wraps NOTHING around the word. The old reader's answer to "which
      word did he mean" was one `<span class="word" data-id>` per word;
      page.js emits one text node per `p.line` and pane.js, wheel.js and
      book-nav.js::buildWordDomIndex all measure against that shape. So the
      word under the pointer is found with `document.caretRangeFromPoint`
      and the whitespace run around the caret's offset -- the same split
      `Listen.tokenise` and `buildWordDomIndex` perform, so the token this
      file finds is the token those two number.

   3. It keeps NO second cursor. A double-click already moves the book's one
      cursor -- book-nav.js's own dblclick handler, `setCursor(ch, hit,
      "double-click")`, and the `word-target` highlight that follows it. This
      module answers that cursor; it does not mark the word again. Osca, 4
      Sep: "the one word view AND the voice highlight/cursor is the same
      thing."

   WHAT IT READS. `books/<slug>/dictionary.json` -- `dictionary/export.py`'s
   contract, keyed by the parser's own `Word.text`: {lemma, pos, gloss, phon,
   etymology, related, links, matched_form} and, for a word the dictionary
   could not resolve, `error` in the export's own words. The file is 6.9 MB
   on `poems`, so it is fetched on the FIRST ask and never at mount: an app
   that opens a book must not spend a phone's first six megabytes on a panel
   nobody has asked for. That is why `getDictionaryEntry` is documented to
   answer null the first time it is called and voiceui/app.js polls for a
   bounded stretch before believing a miss.

   `entry.links` is per-word and already resolved by the export, so this file
   fetches no `dictionary/links.json` and substitutes no URL template. The
   old reader did both because its export was older; the row it drew is the
   row `entry.links` now carries, and one resolver is better than two.

   ======================= JOB 15c, 6 September =============================
   Osca: *"make Safari just pop up so we still get the results in the app."*
   Two things under the entry, and they are the two halves of the same idea --
   the book's own dictionary is the answer for a word the book knows, and for
   everything else the web is one press away without leaving the reader.

   1. ONE LINE FROM WIKTIONARY. `en.wiktionary.org/api/rest_v1/page/
      definition/<word>` -- no key, no account, CORS open, and it answers with
      the definitions grouped BY LANGUAGE, which is the reason it is the right
      endpoint for this app: a French poem in an English reader wants the
      French sense, and `book.lang` picks it. **Absent means absent**: a 404, a
      timeout, no network, a language the page has no entry for, all render
      NOTHING -- no placeholder, no "not found", no row of its own. A line
      that says "no line" is worse than the silence it replaces.
      It is asked on the first open of a word and cached in memory for the
      session; nothing is written anywhere.

   2. ONE SEARCH CONTROL, and it is the only control this panel has besides
      its close. It leaves the app: `https://www.google.com/search?q=` and the
      query, with nothing else in the URL and nothing taken out of the query.
      **One call shape, three places it can land** -- and the ORDER is the
      contract, not a preference:

        frank_search        `window.__TAURI__`'s command. The phone repo
                            implements it as an SFSafariViewController sheet
                            (day-6-sep.md's phone line; this file consumes the
                            command and writes no Swift), and the Mac will
                            implement it as a 900x700 webview window. Tried
                            first everywhere, so the day it exists on either
                            platform nothing here changes.
        WebviewWindow       the same 900x700, made from the page through
                            Tauri's own JS API, for a Frank whose Rust does
                            not carry the command yet. Needs
                            `core:webview:allow-create-webview-window` in
                            `desktop/src-tauri/capabilities/default.json`; §6
                            asks the desktop lane for that one line rather
                            than this session editing another lane's folder in
                            installer week.
        window.open         a browser, and Frank today: `tabs.rs`'s
                            `on_new_window` files any non-loopback URL as a
                            TAB beside the reader. That is a real answer and
                            not the one asked for -- the window is Osca's
                            press once §6 lands.

      Nothing is stored. No key, no cost, no account, and no history of what
      was searched: `last` below is one record, in memory, for the driver.  */
(function () {
"use strict";

/* THE KEY IS THE PARSER'S WORD, NOT THE PAGE'S TOKEN. `dictionary.json` is
   keyed by `Word.text` -- the surface form, case kept, with no punctuation on
   either end -- and a token off the page is "night," or "(the". Strip the
   edges, then try the spelling as printed first, because the export keeps
   case on purpose: `Gerontion` and `POEMS` are its own keys. Measured on
   books/poems chapter two: 578 of 578 tokens resolve. */
const EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
function bare(s) { return String(s == null ? "" : s).replace(EDGE, ""); }
function keysFor(text) {
  const w = bare(text);
  if (!w) return [];
  const out = [w];
  const lower = w.toLowerCase(), upper = w.toUpperCase();
  const cap = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  for (const k of [lower, cap, upper]) if (out.indexOf(k) < 0) out.push(k);
  return out;
}

/* Chrome and WebKit have caretRangeFromPoint; Firefox has the standard
   caretPositionFromPoint. Both give the same two things -- a text node and an
   offset into it -- which is all this file wants. */
function caretAt(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (!p) return null;
    const r = document.createRange();
    try { r.setStart(p.offsetNode, p.offset); } catch (e) { return null; }
    r.collapse(true);
    return r;
  }
  return null;
}

/* the same whitespace split Listen.tokenise and buildWordDomIndex perform --
   borrowed rather than copied when listen.js is on the page, which it is in
   the app; the fallback is for a bench that loads this file alone. */
function tokenise(text) {
  if (window.Listen && Listen.tokenise) return Listen.tokenise(text, 0, text.length);
  const out = []; let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    const s = i;
    while (i < text.length && !/\s/.test(text[i])) i++;
    if (i > s) out.push({ s, e: i });
  }
  return out;
}

/* The word at a point, or null. Only the reading column's own paragraphs
   answer -- `p.line`, `p.sp`, `p.dir` are exactly what page.js emits and
   exactly what listen.js maps; a `.plate`'s caption and the contents panes
   are not text of the book and are left alone. */
function wordAtPoint(col, x, y) {
  const r = caretAt(x, y);
  if (!r) return null;
  const node = r.startContainer;
  if (!node || node.nodeType !== 3) return null;
  const el = node.parentNode;
  if (!el || !el.matches || !el.matches("p.line, p.sp, p.dir")) return null;
  if (col && !col.contains(el)) return null;
  const text = node.nodeValue || "";
  const toks = tokenise(text);
  if (!toks.length) return null;
  const off = Math.max(0, Math.min(r.startOffset, text.length));
  let hit = null;
  for (const t of toks) if (off >= t.s && off < t.e) { hit = t; break; }
  /* a caret between two words -- the browser puts it after the space it was
     clicked on, so the word MEANT is the one that starts next; failing that
     (a click past the end of the line) the one that just ended */
  if (!hit) for (const t of toks) if (t.s >= off) { hit = t; break; }
  if (!hit) hit = toks[toks.length - 1];
  return { node, el, s: hit.s, e: hit.e, text: text.slice(hit.s, hit.e) };
}

/* --------------------------------------------- THE FREE LINE (job 15c) */
const WIK = "https://en.wiktionary.org/api/rest_v1/page/definition/";
const WIK_MS = 4000;          // a dictionary line is not worth a hung panel
const WIK_CAP = 220;          // ONE line; the panel is not a Wiktionary page
const wikCache = new Map();   // "<lang>/<word>" -> string | null | undefined

/* HTML OUT, WITHOUT innerHTML. The REST endpoint's `definition` is a snippet
   of Wiktionary's own markup -- links and italics round the words. Tags are
   dropped and the five entities that survive them are spelled back; nothing
   here assigns to innerHTML, which is both the safe thing with a value off
   the network and the thing minidom cannot do (`innerHTML` is `textContent`
   under testkit's harness, so a page that leaned on it would read as empty). */
const ENTS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
               "#39": "'", "#8217": "\u2019", mdash: "\u2014", ndash: "\u2013" };
function plain(html) {
  return String(html == null ? "" : html)
    .replace(/<[^>]*>/g, "")
    .replace(/&(#?[a-zA-Z0-9]+);/g, (m, n) =>
      Object.prototype.hasOwnProperty.call(ENTS, n) ? ENTS[n] : m)
    .replace(/\s+/g, " ")
    .trim();
}

/* The first definition in the book's own language, or English, or whatever
   the page does have -- and null rather than an empty string, because null is
   what "render nothing" is asked with everywhere below. */
function wikLine(json, lang) {
  if (!json || typeof json !== "object") return null;
  const order = [];
  if (lang) order.push(String(lang).toLowerCase());
  if (order.indexOf("en") < 0) order.push("en");
  for (const k of Object.keys(json)) if (order.indexOf(k) < 0) order.push(k);
  for (const k of order) {
    const group = json[k];
    if (!Array.isArray(group)) continue;
    for (const sense of group) {
      const defs = sense && sense.definitions;
      if (!Array.isArray(defs)) continue;
      for (const d of defs) {
        const t = plain(d && d.definition);
        if (!t) continue;
        const pos = sense.partOfSpeech ? String(sense.partOfSpeech) + " · " : "";
        const line = pos + t;
        return line.length > WIK_CAP ? line.slice(0, WIK_CAP - 1).trim() + "\u2026" : line;
      }
    }
  }
  return null;
}

function wikAsk(word, lang, done) {
  const key = (lang || "") + "/" + word;
  if (wikCache.has(key)) { done(wikCache.get(key)); return; }
  wikCache.set(key, undefined);                 // in flight: render nothing
  let ctl = null, timer = 0;
  try {
    ctl = new AbortController();
    timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, WIK_MS);
  } catch (e) { ctl = null; }
  const opts = ctl ? { signal: ctl.signal } : undefined;
  Promise.resolve()
    .then(() => fetch(WIK + encodeURIComponent(word), opts))
    .then(r => (r && r.ok ? r.json() : null))
    .then(j => { const line = j ? wikLine(j, lang) : null;
                 wikCache.set(key, line); if (timer) clearTimeout(timer); done(line); })
    .catch(() => { wikCache.set(key, null); if (timer) clearTimeout(timer); done(null); });
}

/* ------------------------------------------- THE ONE THAT LEAVES (job 15c)
   Nothing else in the URL, and nothing taken out of the query. */
const SEARCH = "https://www.google.com/search?q=";
const SHEET_W = 900, SHEET_H = 700;
function searchUrl(q) { return SEARCH + encodeURIComponent(String(q == null ? "" : q)); }

function tauriInvoke() {
  const T = window.__TAURI__;
  if (!T) return null;
  const f = (T.core && T.core.invoke) || T.invoke;   // v2 global, then v1
  return typeof f === "function" ? f.bind(T.core || T) : null;
}
function tauriWebviewWindow() {
  const T = window.__TAURI__;
  const W = T && T.webviewWindow && T.webviewWindow.WebviewWindow;
  return typeof W === "function" ? W : null;
}

function mount(o) {
  o = o || {};
  const col = o.col, pane = o.pane;
  const slug = o.slug || (o.book && o.book.slug) || "";
  const base = "../books/" + encodeURIComponent(slug) + "/";
  /* THE BOOK'S OWN LANGUAGE, and it is the book's rather than the browser's:
     Wiktionary's definition endpoint groups its answer by language, and a
     French poem opened in an English reader wants the French sense. `lang`
     is core/bookdata.py's own field (`window.__LIB_BOOK.lang`). */
  const lang = String((o.book && o.book.lang) || "en").toLowerCase();

  let dict = null;            // the file, once it lands
  let asked = false;          // the fetch has been started
  let failed = null;          // why it did not land, in the browser's words
  let showing = null;         // the word the panel is currently about

  /* ------------------------------------------------------------ the file
     Started on the first ask and never at mount. Answers null until it
     lands, which is the contract voiceui/app.js::lookupEntry is written
     against and reader/README.md states. */
  function load() {
    if (asked) return;
    asked = true;
    fetch(base + "dictionary.json")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(j => { dict = j || {}; if (showing) render(showing); })
      .catch(e => { failed = String(e && e.message || e); dict = {};
                    if (showing) render(showing); });
  }

  /* SYNCHRONOUS, by contract. voiceui/app.js calls this straight out of a
     spoken command and cannot await; it polls instead. */
  function entry(text) {
    load();
    if (!dict) return null;
    for (const k of keysFor(text)) if (Object.prototype.hasOwnProperty.call(dict, k)) return dict[k];
    return null;
  }

  /* ------------------------------------------------ THE SEARCH (job 15c)
     One record of the last press, in memory, for a driver to read -- there is
     no history here and nothing is written anywhere. `how` names which of the
     three landings took it, which is the only thing a bench can see: the
     window itself belongs to the platform, not to this page. */
  let last = null;             // { query, url, how }
  let sheetWin = null, sheetN = 0;

  function openTab(url) {
    last.how = "window.open";
    try {
      window.open(url, "_blank",
                  "noopener,noreferrer,width=" + SHEET_W + ",height=" + SHEET_H);
      return true;
    } catch (e) { last.why = String(e && e.message || e); return false; }
  }

  /* The 900x700, made from the page. One at a time: the label carries a
     counter and the one before it is closed, so pressing Search twice leaves
     one window rather than a stack of them. */
  function sheet(url) {
    const W = tauriWebviewWindow();
    if (!W) return openTab(url);
    try {
      if (sheetWin && sheetWin.close) { try { sheetWin.close(); } catch (e) {} }
      sheetWin = new W("frank-search-" + (++sheetN), {
        url: url, title: "Search", width: SHEET_W, height: SHEET_H, focus: true,
      });
      last.how = "WebviewWindow";
      if (sheetWin && sheetWin.once) {
        sheetWin.once("tauri://error", () => { sheetWin = null; openTab(url); });
        sheetWin.once("tauri://destroyed", () => { sheetWin = null; });
      }
      return true;
    } catch (e) { sheetWin = null; return openTab(url); }
  }

  function search(word) {
    const q = String(word == null ? "" : word);
    if (!q) return false;
    const url = searchUrl(q);
    last = { query: q, url: url, how: null };
    const invoke = tauriInvoke();
    if (invoke) {
      let p = null;
      try { p = invoke("frank_search", { query: q }); } catch (e) { p = null; }
      if (p && typeof p.then === "function") {
        last.how = "frank_search";
        /* A HOST WITHOUT THE COMMAND REJECTS, and that is the one case the
           order above is built for: the press still lands, one step down. */
        p.catch(() => sheet(url));
        return true;
      }
    }
    return sheet(url);
  }

  /* Esc closes the panel; if the search window is ours and still open, it
     closes that first -- the reader has the focus, so this is the only Esc
     that can reach anything. The phone's sheet has its own Done and the Mac
     window has its own close; neither is this page's to bind. */
  function closeSearch() {
    if (!sheetWin) return false;
    try { sheetWin.close(); } catch (e) {}
    sheetWin = null;
    return true;
  }

  /* ----------------------------------------------------------- the panel */
  const panel = document.createElement("div");
  panel.id = "lookuppanel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "dictionary");
  document.body.appendChild(panel);

  function place() {
    /* the panel is a sheet under the reading pane, so it never covers the
       line being read and never takes part in the page's own layout */
    const r = pane && pane.getBoundingClientRect ? pane.getBoundingClientRect() : null;
    if (r && r.width > 0) {
      panel.style.left = r.left + "px";
      panel.style.width = r.width + "px";
    } else {
      panel.style.left = "0px";
      panel.style.width = "100%";
    }
    panel.style.bottom = "0px";
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(word) {
    const e = entry(word);
    panel.textContent = "";
    header(word, e);
    body(word, e);
    foot(word);
  }

  function header(word, e) {
    const head = el("div", "lu-head");
    head.appendChild(el("span", "lu-word", bare(word) || word));
    if (e && e.phon) head.appendChild(el("span", "lu-phon", e.phon));
    if (e && e.pos && !(e && e.cue)) head.appendChild(el("span", "lu-pos", e.pos));
    const x = el("button", "lu-close", "×");
    x.setAttribute("aria-label", "close");
    x.onclick = close;
    head.appendChild(x);
    panel.appendChild(head);
  }

  /* THE BOOK'S OWN ANSWER. Every path out of here is a `return`, which is why
     the foot is a call of its own in `render` above rather than the tail of
     this function: the Wiktionary line and the Search control are there for a
     word the book's dictionary does NOT have -- that is most of the reason
     they exist -- so they cannot sit behind any of these returns. */
  function body(word, e) {
    if (!dict) { panel.appendChild(el("p", "lu-note", "looking it up…")); return; }
    if (failed) { panel.appendChild(el("p", "lu-note",
      "this book has no dictionary here (" + failed + ")")); return; }

    if (!e) {
      panel.appendChild(el("p", "lu-note", "not in this book’s dictionary."));
      return;
    }

    /* A CUE IS NOT A WORD, and that rule came from the dictionary rather
       than from the page: `dictionary/cast.py` replaces a speaker name's
       entry with the book's own sentence and sets `cue`. HAMLET is not "a
       small settlement". Say what the book says and never offer a gloss --
       and never surface `suppressed`. */
    if (e.cue) {
      const said = (e.gloss && e.gloss.length) ? e.gloss[0] : null;
      panel.appendChild(el("p", "lu-note", said || "a speaker in this book."));
    } else if (e.error) {
      /* the export's own sentence -- "'Gerontion' not found in the en
         dictionary". It is an answer, not a failure: the links below still
         reach the word, which is the whole point of carrying them. */
      panel.appendChild(el("p", "lu-note", e.error));
    } else {
      if (e.lemma && bare(word).toLowerCase() !== String(e.lemma).toLowerCase()) {
        const tags = e.matched_form && e.matched_form.tags && e.matched_form.tags.length
          ? " · " + e.matched_form.tags.join(" ") : "";
        panel.appendChild(el("p", "lu-lemma", e.lemma + tags));
      }
      if (e.gloss && e.gloss.length) {
        const ol = el("ol", "lu-senses");
        for (const g of e.gloss.slice(0, 8)) ol.appendChild(el("li", null, g));
        panel.appendChild(ol);
      } else {
        panel.appendChild(el("p", "lu-note", "no recorded sense yet."));
      }
      if (e.etymology) panel.appendChild(el("p", "lu-ety", e.etymology));
      if (e.related && e.related.length)
        panel.appendChild(el("p", "lu-rel", e.related.slice(0, 8).join(", ")));
    }

    if (e.links && e.links.length) {
      const row = el("div", "lu-links");
      for (const l of e.links) {
        const label = Array.isArray(l) ? l[0] : (l && l.label);
        const url = Array.isArray(l) ? l[1] : (l && l.url);
        if (!label || !url) continue;
        const a = el("a", null, label);
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        row.appendChild(a);
      }
      if (row.childNodes.length) panel.appendChild(row);
    }
  }

  /* JOB 15c: one line from Wiktionary, and one control. Both belong to the
     WORD and not to the entry, so both are drawn for a word the dictionary
     answered, a word it did not, a cue, and a book with no dictionary file at
     all -- which is the whole point of them. */
  function foot(word) {
    const w = bare(word);
    if (!w) return;
    const key = lang + "/" + w;
    if (!wikCache.has(key)) {
      /* asked once, on the first open of this word; the answer re-renders
         the panel if it is still the panel about this word */
      wikAsk(w, lang, () => { if (showing === word) render(word); });
    } else {
      const line = wikCache.get(key);
      /* ABSENT IS ABSENT: undefined (still in flight) and null (404, offline,
         no entry in this language) both draw nothing at all. */
      if (line) {
        const p = el("p", "lu-wik", line);
        p.appendChild(el("span", "lu-src", "Wiktionary"));
        panel.appendChild(p);
      }
    }
    const acts = el("div", "lu-acts");
    const btn = el("button", "lu-search", "Search");
    btn.type = "button";
    btn.title = searchUrl(word);
    btn.onclick = () => search(word);
    acts.appendChild(btn);
    panel.appendChild(acts);
  }

  function open(word) {
    if (!bare(word)) return false;
    showing = word;
    place();
    render(word);
    panel.hidden = false;
    return true;
  }
  function close() { showing = null; panel.hidden = true; }

  /* ------------------------------------------------------------ the doors
     A double-click is the gesture, because it is already the gesture: it is
     what moves the cursor (book-nav.js), so the word the panel is about and
     the word the book's cursor is on are the same word by construction, not
     by two hit-tests agreeing. book-nav.js's handler is registered on this
     same element first and clears the selection when it is done;
     caretRangeFromPoint does not read the selection, so the order does not
     matter here. */
  if (col) col.addEventListener("dblclick", e => {
    const hit = wordAtPoint(col, e.clientX, e.clientY);
    if (hit) open(hit.text);
  });

  addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (closeSearch()) { e.preventDefault(); return; }
    if (!panel.hidden) { e.preventDefault(); close(); }
  });
  addEventListener("pointerdown", e => {
    if (!panel.hidden && !panel.contains(e.target)) close();
  }, true);
  addEventListener("resize", () => { if (!panel.hidden) place(); });

  /* THE HOOK voiceui HAS BEEN WAITING FOR. `control` is what reader.html
     puts on window.ReaderControl; hanging the method there rather than
     returning a second object is what lets voiceui/app.js's boot find it
     with no change of its own. It is synchronous and its first answer is
     null, both by contract (voiceui/app.js::lookupEntry). */
  if (o.control) o.control.getDictionaryEntry = (side, text) => entry(text);

  return {
    open, close, entry, place, search, closeSearch,
    at(x, y) { const h = wordAtPoint(col, x, y); return h ? open(h.text) : false; },
    get word() { return showing; },
    get loaded() { return !!dict; },
    get panel() { return panel; },
    get lang() { return lang; },
    /* job 15c, for a driver: the last press, and the line the panel has (or
       has not) for the word it is showing. Neither is stored anywhere. */
    get lastSearch() { return last; },
    get wiktionary() {
      const w = bare(showing);
      return w && wikCache.has(lang + "/" + w) ? (wikCache.get(lang + "/" + w) || null) : null;
    },
  };
}

window.Lookup = { mount, bare, keysFor, wordAtPoint, tokenise,
                  searchUrl, wikLine, plain, SHEET_W, SHEET_H };
})();
