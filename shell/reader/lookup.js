/* ===================== THE DICTIONARY — one press, and it is ours ==========
   Job 15b step 1 built this as a look-up PANEL: double-click a word in the
   reading column, and a sheet under the pane drew what
   `books/<slug>/dictionary.json` held for it, plus one Wiktionary line and
   one Search button.

   THE PANEL WENT ON 7 SEPTEMBER, and Osca's sentence is the whole reason:
   *"THE READER'S TEXT IS NORMAL TEXT. Highlight, Look Up, Translate, Copy,
   Speech must work on the reading column the OS way -- right-click /
   three-finger on the Mac, press-and-hold on iPhone -- same as Apple
   Books."*

   A custom panel cannot be that and cannot be made into it. The OS menu is
   five verbs, not one: Look Up is the one this file had, and Translate, Copy,
   Speech and Share were never on offer here at all. It is the menu the reader
   already knows, in their own language, with their own dictionaries and their
   own Siri voice behind it, and it comes for free the moment the page stops
   getting in its way. Ours was one verb, in English, out of one JSON file, in
   a sheet nobody could copy out of. Keeping both would have meant a
   double-click that did two different things depending on where the pointer
   was -- which is the state that made Osca write the sentence.

   So the door went with it: `col.addEventListener("dblclick", ...)` is gone
   from this file, and `book-nav.js`'s own double-click handler no longer ends
   with `sel.removeAllRanges()`. Between them those two lines were what took a
   reader's selection away at the instant they made it. The OS menu needs a
   selection to act on; the page was deleting it.

   ============================================================ 13 SEPTEMBER
   AND NOW A CARD COMES BACK -- BUT NOT TO THE READING PAGE, AND NOT AS A
   BLEND. G-LOOKUP-2 (`dictionary/STATUS.md`, 9e37f00) measured what "search
   the OS dictionary" can honestly mean on iOS, and the three numbers decide
   the whole shape of this file:

     * Apple's `dictionaryHasDefinitionForTerm:` is **a Bool and nothing
       else** and costs **31-95 ms a word** -- 10,000x too slow to be a
       filter, and it hands the app no text at all (0 of the panel's text is
       in our process, counted twice).
     * Apple covers **1.9%** of our Latin lemmas and **0.1%** of our Ancient
       Greek. iOS ships no Latin, no Ancient Greek and no Sanskrit, in any
       version. The packs are therefore not optional.
     * Our own answer, through the pack, is **8-18 us** -- ~2,000-10,000x
       faster, and it is the entry rather than a yes/no.

   Osca accepted the recommendation on the 13th, and it is three sentences:
   **one press for ours; a second, named press for Apple's; and the reading
   page gains nothing.** So:

     ONE PRESS on the word in the one-word view (and in the float, which is
     the same `.wordview` surface shrunk) draws OUR card -- from the pack,
     offline, in microseconds, in the book's own language, headed with whose
     it is. That is 1 press where press-and-hold -> menu -> Look Up was 3.

     A SECOND PRESS, and only if the reader wants it, is the one control at
     the card's foot: `Apple >`, which opens Apple's own panel for the same
     term (`TTSTVHost.lookupApple`, the phone's `src/lookup.rs`). Two clean
     states, never a blend: our text is ours and drawn by us, Apple's picture
     is Apple's and drawn by Apple, and each says whose it is. It is not even
     possible to merge them dishonestly -- none of Apple's text crosses into
     this process -- and the labelling is what answers Osca's complaint that
     "lookup is merged with dictionary, so you don't always get what you
     want".

     THE APPLE CONTROL IS DECIDED ONCE PER BOOK, FROM THE BOOK'S LANGUAGE,
     AND COSTS ZERO CALLS (K-L1, the recommendation's answer). It is asked of
     the host once at mount -- `TTSTVHost.lookupAppleOffered(lang)`, which
     answers from iOS's list of 32 definition languages in Rust -- so a Latin
     or an Ancient Greek book never shows a control that leads to "No Content
     Found", and no press ever pays 31-95 ms for a Bool. A per-word check
     would cost 23 s on a median chapter and 112 s on a long one.

     THE READING PAGE IS UNCHANGED AND GAINS NO ITEM (the recommendation's
     §8.4). Everything above hangs off `.wordview`, which does not exist on
     the reading page; the OS menu still owns the reading column, and the
     free tap there still fights a double-tap, which is exactly why the press
     is kept off it.

     NO SEARCH BOX (K-L3, the recommendation's answer). Apple's dictionaries
     cannot be listed, prefix-matched or enumerated, so the only searchable
     thing on the device is our pack -- and G-STUDIOPHONE is the ship
     blocker, so the box is after the 13th, not before it.

   WHERE APPLE'S SIDE IS ABSENT -- the Mac, a browser, the design bench --
   there is no `TTSTVHost.lookupApple`, so there is no Apple control and this
   file asks nothing of anybody. `UIReferenceLibraryViewController` is iOS's;
   the Mac has its own Look Up on the reading column already.

   WHAT WAS ALREADY HERE AND HAS NOT CHANGED. `voiceui` still needs the
   dictionary and never wanted a panel: `voiceui/app.js` lists
   `getDictionaryEntry` in OPTIONAL_DATA_HOOKS and calls it straight out of a
   spoken command (app.js:426, and again at 434 after its own poll). That is
   the SPOKEN look-up -- "what does that mean" while the book is reading to
   you -- and it is a different product from both of the above. Its contract
   is untouched, to the character: synchronous, null until the answer lands,
   and the caller polls.

     Lookup.mount({ slug, book, control })
       -> { entry, load, loaded, viaPack, failed, lang,
            open, close, showing, card, appleOffered }

   WHAT WENT ON 7 SEP AND HAS NOT COME BACK, so nobody has to diff to find
   out: the `#lookuppanel` element and its `place`/`el`/`render`/`header`/
   `body`/`note`/`open`/`close`; the Wiktionary line (`wikAsk`, `wikLine`,
   `plain`, WIK_MS, WIK_CAP); the one Search control (`search`, `hostSearch`,
   NO_HOST_NOTE); and the point-to-word hit test (`caretAt`, `wordAtPoint`,
   `tokenise`) which existed only to feed a panel on the READING PAGE. None
   of them is needed here: the one-word view has exactly one word on it, so
   there is nothing to hit-test, and the card below is a different element in
   a different surface with a different rule about when it may exist.
   `desktop/src/host.js::search` is NOT gone -- it is the desktop lane's.

   `reader/lookup.css` is still gone and is not coming back: this file's card
   injects its own rule set once (`popover.js`'s pattern, and its reason --
   two page stylesheets that would drift), written entirely in tokens.css's
   own custom properties, so the card is right in light, dark and system by
   construction and has no opinion of its own to go wrong. That also keeps
   `sw.js`'s SHELL_FILES and the cache version untouched: nothing new ships.

   THE FILE IS STILL CALLED lookup.js and still ships in the shell
   (`reader/tools/publish_shell.py`, `export_bundle.py`, and a <script> tag in
   reader.html). What it is now is the dictionary AND its one card, and this
   comment is the sign on the door. */
(function () {
"use strict";

/* THE KEY IS THE PARSER'S WORD, NOT THE PAGE'S TOKEN. `dictionary.json` is
   keyed by `Word.text` -- the surface form, case kept, with no punctuation on
   either end -- and a token off the page is "night," or "(the". Strip the
   edges, then try the spelling as printed first, because the export keeps
   case on purpose: `Gerontion` and `POEMS` are its own keys. Measured on
   books/poems chapter two: 578 of 578 tokens resolve.

   This still earns its place with no panel in front of it: voiceui hands over
   whatever the ASR heard as a surface form, and the same four spellings are
   the ones that have to be tried -- and the card below looks a word up by the
   very same call, so the word the reader presses and the word voiceui speaks
   are resolved once, here, and cannot come to disagree. */
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

/* ------------------------------------------------------------- the card's
   ONE RULE SET, INJECTED ONCE. popover.js's pattern and popover.js's reason:
   the alternative is the same declarations in two page stylesheets, drifting.
   Every colour is tokens.css's own custom property -- `--ground`, `--ink`,
   `--dim`, `--rule`, `--serif`, `--ui` -- and `--pivot` is wordview.css's, so
   the card wears the view's own red on the word it is about and answers
   light, dark and system in all three places tokens.css answers them.

   z-index 14: over the view (8) and over the caption and its rail (12). The
   caption is what says where the word came from and the card is the answer to
   the question the reader stopped to ask, so for the length of the card the
   card is on top -- and it is anchored to the FOOT, so the word itself, which
   stands at the middle of the frame, is never covered. */
const STYLE_ID = "ttstv-lookupcard-style";
const CSS = [
  '.lookupcard{',
  '  position:fixed; left:50%; transform:translateX(-50%);',
  '  bottom:var(--card-bottom, 9vh);',
  '  width:min(var(--card-w, 44rem), 92vw);',
  '  max-height:min(var(--card-h, 46vh), 30rem); overflow:auto;',
  '  z-index:14; box-sizing:border-box;',
  '  padding:14px 16px 12px; border-radius:14px;',
  '  border:1px solid var(--rule); background:var(--ground); color:var(--ink);',
  '  box-shadow:0 10px 34px rgba(0,0,0,0.24);',
  '  font-family:var(--ui); font-size:15px; line-height:1.45;',
  '  text-align:left; -webkit-overflow-scrolling:touch;',
  '}',
  '.lookupcard[hidden]{ display:none; }',
  /* THE HEAD SAYS WHOSE IT IS, and that is not decoration: it is the half of
     "two clean states" that the reader can see. */
  '.lookupcard-whose{',
  '  display:block; font-size:11px; letter-spacing:.09em; text-transform:uppercase;',
  '  color:var(--dim); margin:0 0 6px;',
  '}',
  '.lookupcard-word{',
  '  font-family:var(--serif); font-size:26px; line-height:1.1; font-weight:normal;',
  '  color:var(--ink); margin:0 8px 0 0;',
  '}',
  '.lookupcard-word .pv{ color:var(--pivot, var(--ink)); }',
  '.lookupcard-pos, .lookupcard-phon{ color:var(--dim); font-size:13px; margin-right:8px; }',
  '.lookupcard-pos{ font-style:italic; }',
  '.lookupcard-form{ color:var(--dim); font-size:13px; margin:4px 0 0; }',
  '.lookupcard-gloss{ margin:8px 0 0; padding:0 0 0 1.2em; }',
  '.lookupcard-gloss li{ margin:0 0 3px; }',
  '.lookupcard-gloss li::marker{ color:var(--dim); font-size:12px; }',
  '.lookupcard-etym, .lookupcard-related, .lookupcard-note{',
  '  margin:8px 0 0; font-size:13px; color:var(--dim);',
  '}',
  /* THE SECOND PRESS, AND THE ONLY CONTROL IN THE WHOLE CARD. It is at the
     foot, it is named, and it is absent -- not dimmed, absent -- for a book
     in a language iOS has no dictionary for. */
  '.lookupcard-foot{ margin:12px -16px -12px; padding:0; border-top:1px solid var(--rule); }',
  '.lookupcard-apple{',
  '  display:block; width:100%; text-align:left; font:inherit; color:var(--ink);',
  '  background:transparent; border:0; border-radius:0 0 13px 13px;',
  '  padding:11px 16px; min-height:44px; cursor:pointer;',
  '}',
  '.lookupcard-apple:hover, .lookupcard-apple:focus-visible{ background:var(--rule); outline:none; }',
  '.lookupcard-apple[disabled]{ color:var(--dim); cursor:default; background:transparent; }',
  '.lookupcard-apple .mark{ color:var(--dim); margin-left:6px; }',
  /* A PHONE ON ITS SIDE has 390px of height and the word takes most of it, so
     the card gets the strip and the scroll, the same decision wordpane.css
     takes for the caption at the same breakpoint. */
  '@media (max-height: 500px) and (orientation: landscape){',
  '  .lookupcard{ bottom:var(--card-bottom-land, 2vh); max-height:74vh; width:min(var(--card-w, 44rem), 96vw); }',
  '}',
].join("\n");

function injectStyle(doc) {
  if (!doc || !doc.createElement) return;
  if (doc.getElementById && doc.getElementById(STYLE_ID)) return;
  const s = doc.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (doc.head || doc.documentElement || doc.body).appendChild(s);
}

/* The book's language as a person reads it -- "Latin", "Ancient Greek" --
   asked of the platform rather than kept in a table here, because a table of
   language names in the reader is a table that goes out of date in a language
   this file does not speak. `Intl.DisplayNames` is in every engine this app
   runs in (WKWebView, iOS Safari, Chromium); where it is not, the code itself
   is the honest label. */
function langName(code) {
  const c = String(code || "").trim();
  if (!c) return "";
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "language" });
    const n = dn.of(c);
    if (n && n !== c) return n;
  } catch (_) {}
  return c;
}

/* ONE PRESS ON THE VIEW, AND THE VIEW IS THE ONLY PLACE IT LANDS.

   The listener is on the DOCUMENT, once, and it is delegated: `.wordview` is
   mounted lazily by book-nav.js (on the first travel into the word half), so
   a listener bound at mount time would bind to nothing on most opens. It is
   also the one shape that will still be right when the float lands -- the
   float is the same `.wordview` surface at another size, so it inherits this
   press without a line being written for it.

   `current` is the live mount. `Lookup.mount` runs again on every openBook
   (reader.html wraps `nav.openBook`), so the handler must reach the mount
   that belongs to the book on screen rather than the first one ever made. */
let current = null;
const armed = new WeakSet();
function arm(doc) {
  if (!doc || !doc.addEventListener || armed.has(doc)) return;
  armed.add(doc);
  doc.addEventListener("click", (ev) => {
    if (current && current.press) current.press(ev);
  }, false);
  doc.addEventListener("keydown", (ev) => {
    if (ev && ev.key === "Escape" && current && current.close) current.close();
  }, false);
}

function mount(o) {
  o = o || {};
  const slug = o.slug || (o.book && o.book.slug) || "";
  const base = "../books/" + encodeURIComponent(slug) + "/";
  /* THE BOOK'S OWN LANGUAGE, kept because voiceui reads it to decide which
     language it is answering in -- it is core/bookdata.py's own field
     (`window.__LIB_BOOK.lang`), not the browser's. Since 13 Sep it is also
     the ONE question Apple's side is ever asked, and it is asked once, here. */
  const lang = String((o.book && o.book.lang) || "en").toLowerCase();

  let dict = null;            // the file, once it lands
  let asked = false;          // the fetch has been started
  let failed = null;          // why it did not land, in the browser's words

  /* ------------------------------------------------------------ the pack
     G-LANG (Osca, 11 Sep): on the phone a dictionary is its LANGUAGE's, one
     pack added once in Settings > Languages, and `dictionary.json` no longer
     travels with a book. So where the app offers the pack door --
     `TTSTVHost.dict.lookup(term, lang) -> {entries: [entry]}`, answered in
     Rust from the language's one SQLite file (the phone repo's `dict.rs`, a
     port of `dictionary/pack.py`, which answers what `lookup.py` answers) --
     a word is asked THERE. The contract to voiceui is unchanged: synchronous,
     null until the answer lands, and voiceui polls (app.js::lookupEntry). A
     language with no pack on this phone falls back to the book's own file,
     which a book pulled before 11 Sep still carries. `links` is not in a
     pack's entry; nothing here reads it. */
  const door = (window.TTSTVHost && window.TTSTVHost.dict
                && typeof window.TTSTVHost.dict.lookup === "function") ? window.TTSTVHost.dict : null;
  let viaDoor = !!door;
  let doorAnswered = false;
  const answered = new Map();  // bare word -> the entry, or null for a miss
  const waiting = new Set();   // asked of the door, not answered yet
  function askDoor(k) {
    waiting.add(k);
    Promise.resolve(door.lookup(k, lang)).then(r => {
      waiting.delete(k);
      doorAnswered = true;
      answered.set(k, (r && Array.isArray(r.entries) && r.entries[0]) || null);
      /* THE CARD'S OWN CALLBACK, and it is not the re-render hook that went on
         7 Sep: it redraws THIS card if it is up and is about THIS word, and it
         is nobody else's. voiceui still polls (app.js:434) and is untouched.
         Without it the card would wear "Looking it up…" for up to one tick of
         the poll below -- 16 ms for an answer that took 8-18 us. */
      if (showing === k) draw();
    }, e => {
      // no pack for this language here (or one this app cannot read): the book's file
      waiting.delete(k);
      failed = String((e && e.message) || e);
      viaDoor = false;
      load();
    });
  }

  /* ------------------------------------------------------------ the file
     Started on the first ask and never at mount. Answers null until it
     lands, which is the contract voiceui/app.js::lookupEntry is written
     against and reader/README.md states.

     NOTHING RE-RENDERS WHEN IT ARRIVES ANY MORE. Both `.then` arms used to
     call `render(showing)` to fill in a panel that was already open on
     "looking it up…"; there is no panel and no `showing`, and voiceui polls
     for its own answer (app.js:434), so landing is silent. The card below
     polls for its own answer too, for the same reason and by the same means:
     one contract, two callers, and neither of them is a re-render hook. */
  function load() {
    if (asked) return;
    asked = true;
    fetch(base + "dictionary.json")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(j => { dict = j || {}; })
      .catch(e => { failed = String(e && e.message || e); dict = {}; });
  }

  /* SYNCHRONOUS, by contract. voiceui/app.js calls this straight out of a
     spoken command and cannot await; it polls instead. */
  function entry(text) {
    if (viaDoor) {
      const k = bare(text);
      if (!k) return null;
      if (answered.has(k)) return answered.get(k);
      if (!waiting.has(k)) askDoor(k);
      return null;
    }
    load();
    if (!dict) return null;
    for (const k of keysFor(text)) if (Object.prototype.hasOwnProperty.call(dict, k)) return dict[k];
    return null;
  }
  /* ...and "has it answered yet" as a question of its own, which is the only
     thing the card needs that voiceui does not: a null from `entry` means
     EITHER a miss OR not yet, and a card that cannot tell them apart writes
     "no entry" over an answer that is 4 ms away. */
  function settled(text) {
    const k = bare(text);
    if (!k) return true;
    if (viaDoor) return answered.has(k);
    return !!dict;
  }

  /* ==================================================== APPLE'S SIDE, ONCE
     K-L1, and the recommendation's own answer to it: **by book language
     alone, decided at open, zero calls per word.** The question goes to the
     host, not to a table in this file, because "which languages does iOS
     define" is an iOS fact and the phone is where iOS facts belong
     (`src/lookup.rs`, the 32 definition languages, one list). Off the phone
     there is no door and there is no control -- Apple's panel is
     `UIReferenceLibraryViewController`, which is iOS's, and the Mac's reading
     column has had the OS's own Look Up since 7 Sep.

     `appleOK` is a tri-state on purpose: null = not answered, and the foot is
     not drawn at all until it is. A control that appears a tenth of a second
     late is a control that moves under a finger already on its way down. */
  let appleWhy = null;         // why Apple's side said no, in its own words
  const host = (window.TTSTVHost && typeof window.TTSTVHost.lookupApple === "function")
    ? window.TTSTVHost : null;
  let appleOK = host ? null : false;
  if (host && typeof host.lookupAppleOffered === "function") {
    try {
      Promise.resolve(host.lookupAppleOffered(lang)).then(
        v => { appleOK = !!v; if (showing) draw(); },
        e => { appleOK = false; appleWhy = String((e && e.message) || e); }
      );
    } catch (e) { appleOK = false; }
  } else if (host) {
    appleOK = false;            // a Frank whose Rust is older than this door
  }

  /* ======================================================== THE CARD ITSELF */
  const doc = (typeof document !== "undefined") ? document : null;
  let card = null, wordEl = null, whoseEl = null, posEl = null, phonEl = null,
      formEl = null, glossEl = null, etymEl = null, relEl = null, noteEl = null,
      footEl = null, appleBtn = null;
  let showing = null;           // the word the card is about, or null
  let poll = null;              // the one timer, never a stack
  let watching = null;          // the MutationObserver on the view

  function build() {
    if (card || !doc) return card;
    injectStyle(doc);
    card = doc.createElement("div");
    card.className = "lookupcard";
    card.setAttribute("role", "dialog");
    card.hidden = true;
    whoseEl = doc.createElement("span"); whoseEl.className = "lookupcard-whose";
    const head = doc.createElement("div");
    wordEl = doc.createElement("b"); wordEl.className = "lookupcard-word";
    posEl = doc.createElement("span"); posEl.className = "lookupcard-pos";
    phonEl = doc.createElement("span"); phonEl.className = "lookupcard-phon";
    head.append(wordEl, posEl, phonEl);
    formEl = doc.createElement("div"); formEl.className = "lookupcard-form";
    glossEl = doc.createElement("ol"); glossEl.className = "lookupcard-gloss";
    etymEl = doc.createElement("p"); etymEl.className = "lookupcard-etym";
    relEl = doc.createElement("p"); relEl.className = "lookupcard-related";
    noteEl = doc.createElement("p"); noteEl.className = "lookupcard-note";
    footEl = doc.createElement("div"); footEl.className = "lookupcard-foot";
    appleBtn = doc.createElement("button");
    appleBtn.type = "button";
    appleBtn.className = "lookupcard-apple";
    footEl.appendChild(appleBtn);
    card.append(whoseEl, head, formEl, glossEl, etymEl, relEl, noteEl, footEl);
    /* THE PRESS ON THE CONTROL IS THE SECOND PRESS AND THE LAST ONE. It is
       bound here, on the button, rather than read out of the document
       handler: a press inside the card must never be read as a press on the
       view, which would close the card the reader is aiming at. */
    appleBtn.addEventListener("click", (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      askApple();
    });
    /* the mount is where the view is, so the two share one stacking context
       (`div.open` is `position:fixed; z-index:3` -- a stacking context, which
       is why wordpane.js's 12 means 12 within a 3; see book-nav.js) */
    const view = doc.querySelector && doc.querySelector(".wordview");
    const parent = (view && view.parentNode) || doc.body || doc.documentElement;
    parent.appendChild(card);
    return card;
  }

  /* THE WORD WEARS THE VIEW'S OWN RED LETTER. `WordView.pivotIndex` is the
     one table (wordview.js) and it is not copied here -- where the view is
     not loaded, the word is drawn plain, which is what a bench sees. */
  function drawWord(text) {
    wordEl.textContent = "";
    const WV = window.WordView;
    const k = (WV && typeof WV.pivotIndex === "function") ? WV.pivotIndex(text) : -1;
    if (k < 0 || k >= text.length) { wordEl.textContent = text; return; }
    const a = doc.createElement("span"), b = doc.createElement("span"), c = doc.createElement("span");
    b.className = "pv";
    a.textContent = text.slice(0, k);
    b.textContent = text.slice(k, k + 1);
    c.textContent = text.slice(k + 1);
    wordEl.append(a, b, c);
  }

  function setText(el, s) {
    const t = s == null ? "" : String(s);
    el.textContent = t;
    el.hidden = !t;
  }

  /* ONE DRAW, AND IT IS THE WHOLE CARD EVERY TIME. There is no partial
     update: the card is about one word and a word does not change under it
     (the observer closes the card when the cursor moves), so a full write of
     seven small nodes is cheaper to read than a diff and cannot leave last
     word's etymology under this word's gloss. */
  function draw() {
    if (!showing) return;
    build();
    const text = showing;
    drawWord(text);
    const e = entry(text);
    const done = settled(text);
    const name = langName(lang);
    /* WHOSE IT IS, IN WORDS, AT THE TOP. Osca's "merged" complaint is
       answered by this line and by the named control at the foot; nothing in
       between them is ever Apple's. */
    whoseEl.textContent = name ? ("Frank · " + name) : "Frank";

    if (e) {
      setText(posEl, e.pos || "");
      setText(phonEl, e.phon || "");
      const m = e.matched_form;
      const tags = (m && Array.isArray(m.tags) && m.tags.length) ? m.tags.join(", ") : "";
      const lemma = e.lemma && bare(e.lemma) !== bare(text) ? e.lemma : "";
      setText(formEl, m && m.form
        ? (m.form + (lemma ? " — " + lemma : "") + (tags ? " · " + tags : ""))
        : (lemma ? lemma : ""));
      glossEl.textContent = "";
      const gs = Array.isArray(e.gloss) ? e.gloss : (e.gloss ? [e.gloss] : []);
      for (const g of gs) {
        const li = doc.createElement("li");
        li.textContent = String(g);
        glossEl.appendChild(li);
      }
      glossEl.hidden = !gs.length;
      setText(etymEl, e.etymology || "");
      const rel = Array.isArray(e.related) ? e.related : [];
      setText(relEl, rel.length ? ("Related: " + rel.join(", ")) : "");
      setText(noteEl, gs.length ? "" : "This entry has no definition in the pack.");
    } else {
      setText(posEl, ""); setText(phonEl, ""); setText(formEl, "");
      glossEl.textContent = ""; glossEl.hidden = true;
      setText(etymEl, ""); setText(relEl, "");
      /* A WORD NEITHER HAS IS A SENTENCE, and it is a different sentence from
         "not yet". Both are ours and neither pretends to be an answer. */
      setText(noteEl, done
        ? (appleOK
            ? ("No entry for “" + text + "” in Frank's " + (name || lang) + " dictionary.")
            : ("No entry for “" + text + "” in Frank's " + (name || lang) +
               " dictionary, and iOS has no dictionary for " + (name || lang) + "."))
        : "Looking it up…");
    }

    /* THE FOOT. Absent until the host has answered, absent for good where the
       answer is no -- never a dimmed control that leads to "No Content
       Found", which is the dead press the whole shape exists to remove. */
    footEl.hidden = (appleOK !== true);
    if (appleOK === true) {
      appleBtn.textContent = "";
      appleBtn.append(doc.createTextNode("Apple"), (() => {
        const s = doc.createElement("span"); s.className = "mark"; s.textContent = "▸"; return s;
      })());
      appleBtn.disabled = false;
      appleBtn.setAttribute("aria-label", "Open Apple’s dictionary for " + text);
    }
    if (appleWhy) setText(noteEl, appleWhy);
  }

  /* THE SECOND PRESS. `TTSTVHost.lookupApple(word)` presents Apple's own
     panel (a half sheet -- K-L2's answer, and the reason it is a half sheet
     and not a full one is that the reader stays visible behind it). Nothing
     of Apple's comes back: the promise says the sheet was handed over, and
     0 of its text is in this process by construction. Our card is left
     exactly as it is underneath -- two states, side by side, neither
     redrawn as the other. */
  function askApple() {
    if (!host || !showing) return;
    const text = showing;
    try {
      Promise.resolve(host.lookupApple(text)).then(
        () => {},
        e => { appleWhy = String((e && e.message) || e); draw(); }
      );
    } catch (e) {
      appleWhy = String((e && e.message) || e);
      draw();
    }
  }

  /* ---- the one timer. The pack answers in microseconds and the door in a
     promise, so this exists only to cross that promise: it stops the moment
     the word is settled, and it stops itself after a second either way. */
  function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }
  function startPoll(text) {
    stopPoll();
    if (settled(text)) return;
    let n = 0;
    poll = setInterval(() => {
      n++;
      if (!showing || showing !== text) { stopPoll(); return; }
      if (settled(text) || n > 60) { stopPoll(); draw(); return; }
    }, 16);
  }

  /* ---- and the watch. The card is about ONE word: when the view puts up
     another word (stepping, or the voice reading on) or stops being the
     screen at all, the card goes. One observer, on the view, for the length
     of the card -- not a poll, and not a hook into book-nav.js, which owns
     the cursor and must not learn that a dictionary exists. */
  function watch() {
    const view = doc && doc.querySelector && doc.querySelector(".wordview");
    if (!view || typeof MutationObserver !== "function") return;
    if (watching) watching.disconnect();
    watching = new MutationObserver(() => {
      if (!showing) return;
      if (!view.classList.contains("on")) { close(); return; }
      if (wordOf(view) !== showing) close();
    });
    watching.observe(view, { attributes: true, attributeFilter: ["class"],
                             childList: true, characterData: true, subtree: true });
  }

  function wordOf(view) {
    const w = view && view.querySelector && view.querySelector(".wordview-word");
    return bare((w && w.textContent) || "");
  }

  /* ---- open / close. Two clean states and the second one is "not there". */
  function open(text) {
    const w = bare(text);
    if (!w) return null;
    build();
    showing = w;
    card.hidden = false;
    draw();
    startPoll(w);
    watch();
    return w;
  }
  function close() {
    stopPoll();
    if (watching) { watching.disconnect(); watching = null; }
    appleWhy = null;
    showing = null;
    if (card) card.hidden = true;
    return null;
  }

  /* ---- THE PRESS, and the whole of the gesture. One press on the view opens
     the card for the word on it; a press on the view with the card already up
     closes it (the same finger, the same place -- a toggle, not a second
     control). A press inside the card is the card's own and is left alone.
     Nothing here touches the reading page: `.wordview` does not exist there. */
  function press(ev) {
    if (!ev || ev.button > 0 || !doc) return;
    const t = ev.target;
    if (!t || !t.closest) return;
    if (card && t.closest(".lookupcard")) return;      // the card's own presses
    const view = t.closest(".wordview");
    if (!view || !view.classList.contains("on")) {
      if (showing) close();          // a press outside the view
      return;
    }
    const w = wordOf(view);
    if (showing) { close(); return; }   // the same finger, the same place
    if (w) open(w);
  }

  /* THE HOOK voiceui HAS BEEN WAITING FOR, and the reason this file was
     mounted at all between 7 and 13 September. `control` is what reader.html
     puts on window.ReaderControl; hanging the method there rather than
     returning a second object is what lets voiceui/app.js's boot find it with
     no change of its own. It is synchronous and its first answer is null,
     both by contract (voiceui/app.js::lookupEntry). */
  if (o.control) o.control.getDictionaryEntry = (side, text) => entry(text);

  /* the live mount, for the one delegated listener (see `arm`) */
  if (current && current.close) current.close();
  if (doc) arm(doc);

  const handle = {
    entry, load, settled, open, close, press, draw,
    get loaded() { return !!dict || doorAnswered; },
    get viaPack() { return viaDoor; },
    get failed() { return failed; },
    get lang() { return lang; },
    get showing() { return showing; },
    get card() { return card; },
    get appleOffered() { return appleOK; },
  };
  current = handle;
  return handle;
}

window.Lookup = { mount, bare, keysFor, langName, CSS, STYLE_ID,
                  get current() { return current; } };
})();
