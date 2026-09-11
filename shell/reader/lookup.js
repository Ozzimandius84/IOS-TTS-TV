/* ===================== THE DICTIONARY — no panel, no door ================
   Job 15b step 1 built this as a look-up PANEL: double-click a word in the
   reading column, and a sheet under the pane drew what
   `books/<slug>/dictionary.json` held for it, plus one Wiktionary line and
   one Search button.

   THE PANEL IS GONE, 7 September, and Osca's sentence is the whole reason:
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

   WHAT IS LEFT, AND WHY IT IS NOT NOTHING. `voiceui` still needs the
   dictionary, and it never wanted the panel: `voiceui/app.js` lists
   `getDictionaryEntry` in OPTIONAL_DATA_HOOKS and calls it straight out of a
   spoken command (app.js:426, and again at 434 after its own poll). That is
   the SPOKEN look-up -- "what does that mean" while the book is reading to
   you -- and it is a different product from the OS menu, not a duplicate of
   it: it is hands-free, it answers out loud, and it answers from the book's
   own gloss rather than from a general dictionary. So this file keeps exactly
   the machinery that hook needs and nothing else:

     Lookup.mount({ slug, book, control }) -> { entry, load, loaded, lang }

   and hangs `getDictionaryEntry` on `window.ReaderControl` as before.

   WHAT WENT, ITEM BY ITEM, so nobody has to diff to find out: the `#lookuppanel`
   element and every function that drew into it (`place`, `el`, `render`,
   `header`, `body`, `note`, `open`, `close`); the Escape / outside-pointerdown
   / resize handlers that managed it; the Wiktionary line (`wikAsk`, `wikLine`,
   `plain`, WIK_MS, WIK_CAP) and the one Search control (`search`,
   `hostSearch`, NO_HOST_NOTE) which existed only inside it; and the
   point-to-word hit test (`caretAt`, `wordAtPoint`, `tokenise`) which existed
   only to feed it. `reader/lookup.css` went with the panel it styled.
   `desktop/src/host.js::search` is NOT gone -- it is the desktop lane's, the
   Mac's own Search still uses it, and §6 says so.

   THE FILE IS STILL CALLED lookup.js and still ships in the shell
   (`reader/tools/publish_shell.py`, `export_bundle.py`, and a <script> tag in
   reader.html): renaming it would be four files and a cache version for a
   word. What it is now is the dictionary, and this comment is the sign on the
   door. */
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
   the ones that have to be tried. */
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

function mount(o) {
  o = o || {};
  const slug = o.slug || (o.book && o.book.slug) || "";
  const base = "../books/" + encodeURIComponent(slug) + "/";
  /* THE BOOK'S OWN LANGUAGE, kept because voiceui reads it to decide which
     language it is answering in -- it is core/bookdata.py's own field
     (`window.__LIB_BOOK.lang`), not the browser's. */
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
     for its own answer (app.js:434), so landing is silent. */
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

  /* THE HOOK voiceui HAS BEEN WAITING FOR, and now the only reason this file
     is mounted at all. `control` is what reader.html puts on
     window.ReaderControl; hanging the method there rather than returning a
     second object is what lets voiceui/app.js's boot find it with no change
     of its own. It is synchronous and its first answer is null, both by
     contract (voiceui/app.js::lookupEntry). */
  if (o.control) o.control.getDictionaryEntry = (side, text) => entry(text);

  return {
    entry, load,
    get loaded() { return !!dict || doorAnswered; },
    get viaPack() { return viaDoor; },
    get failed() { return failed; },
    get lang() { return lang; },
  };
}

window.Lookup = { mount, bare, keysFor };
})();
