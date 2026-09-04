// ------------------------------------------------------------------ lookup
// No UI yet to choose a gloss language, so tabs always resolve toward "en"
// (matches dictionary/README.md's assumed audience); revisit once the
// reader has a per-user target-language setting.
async function loadDictionaryLinks() {
  if (linksAttempted) return linksData;
  linksAttempted = true;
  try {
    const res = await fetch("../dictionary/links.json");
    if (res.ok) linksData = await res.json();
  } catch (e) { /* dictionary/ hasn't produced links.json yet -- fine, skip online tabs */ }
  return linksData;
}
let linksData = null, linksAttempted = false;
// `currentLookup` used to live here, one variable for both panes. It is
// `pane.lookup` now (makePane): see the #popups comment in the markup.

// books/<slug>/dictionary.json (dictionary/export.py's contract: word.text ->
// {lemma, pos, gloss, phon, etymology, related, links, matched_form}) -- read
// per-pane via readJSON so it works in both fetch and file-picker mode and
// never touches the network. Only `gloss` is surfaced here; the popup's
// online-link row still comes from the global dictionary/links.json above.
async function loadBookDictionary(pane) {
  if (pane.dictAttempted) return pane.dictData;
  pane.dictAttempted = true;
  try {
    pane.dictData = await readJSON(pane, "dictionary.json");
  } catch (e) { /* dictionary/ hasn't exported dictionary.json for this book yet -- fine, skip gloss */ }
  return pane.dictData;
}

// dictionary/links.py's export_links_json() contract: {word}/{lang_out}/
// {sa_translit} placeholders substituted client-side; en_anchor appended
// as a "#" fragment only when lang_out is "en".
function saTranslit(word) {
  if (/[ऀ-ॿ]/.test(word)) return "deva";
  if (/^[\x00-\x7F]*$/.test(word)) return "hk";
  return "roman";
}

function resolveLinkUrl(template, word) {
  let url = template.url
    .replace(/\{word\}/g, encodeURIComponent(word))
    .replace(/\{lang_out\}/g, LANG_OUT)
    .replace(/\{sa_translit\}/g, saTranslit(word));
  if (template.en_anchor && LANG_OUT === "en") url += "#" + template.en_anchor;
  return url;
}

// ------------------------------------------------------------------ grammar
// books/<slug>/grammar.json (dictionary/grammar.py's contract, dictionary/
// README.md 30 Aug §6): word.text -> {readings: [{lemma, case?, number?,
// gender?: [..], person?, tense?, voice?, mood?, nonfinite?, degree?,
// marks?: [..], other?: [..]}], certain, headwords?: {<lemma>: [{pos, text,
// declension?, conjugation?, ...}]}}. The SAME key dictionary.json uses, so
// it merges in one lookup.
//
// Absent is fine and is the common case: every book but the two eclogues has
// no grammar.json at all, and 121 of eclogues-la's resolving words have no
// grammatical tags in the dump and so are not in the file. Both degrade to
// exactly today's panel -- no empty box, no "generating...", no error.
async function loadBookGrammar(pane) {
  if (pane.grammarAttempted) return pane.grammarData;
  pane.grammarAttempted = true;
  try {
    const g = await readJSON(pane, "grammar.json");
    pane.grammarData = (g && g.words) || null;
  } catch (e) { /* no grammar.json for this book -- fine, the panel just has no grammar section */ }
  return pane.grammarData;
}

// Wiktionary's tag values are already the words a grammar uses; the only
// choice here is the ORDER they are said in, and one order serves both the
// nominal and the verbal case:
//
//   person, case, number, gender, tense, mood, voice, nonfinite, degree
//
// which reads "third-person plural imperfect indicative active" for `vocabant`
// and "nominative plural feminine" for `patulae` -- in both cases the phrase
// dictionary/README.md's own §2 uses for them.
const GRAMMAR_DIMS = ["person", "case", "number", "gender", "tense", "mood", "voice", "nonfinite", "degree"];

// A gender LIST is agreement, not ambiguity -- dictionary/grammar.py's one
// deliberate non-split: a form that takes its gender from whatever it modifies
// is ONE reading and is said as one. "feminine, masculine or neuter", never
// three readings.
function grammarValue(reading, dim) {
  const v = reading[dim];
  if (v == null) return null;
  if (!Array.isArray(v)) return String(v);
  if (!v.length) return null;
  if (v.length === 1) return String(v[0]);
  return v.slice(0, -1).join(", ") + " or " + v[v.length - 1];
}

/** One reading as a phrase, in GRAMMAR_DIMS order. `omit` drops the
 *  dimensions that have already been said once above the list. */
function grammarPhrase(reading, omit) {
  const skip = omit || [];
  const out = [];
  for (const dim of GRAMMAR_DIMS) {
    if (skip.indexOf(dim) !== -1) continue;
    const v = grammarValue(reading, dim);
    if (v) out.push(v);
  }
  return out.join(" ");
}

// Two readings belong in the same block only if they are the same KIND of
// form under the same register: `nonfinite` and `degree` are grammar.py's own
// KIND dimensions (they say what kind of form this is, not how precisely it is
// described), `marks` must ride with the reading that carries them, and a
// different set of named dimensions is a different sort of statement.
function grammarKindKey(r) {
  const dims = GRAMMAR_DIMS.filter(d => grammarValue(r, d) != null);
  return JSON.stringify([
    r.nonfinite || null, r.degree || null,
    (r.marks || []).slice().sort(),
    (r.other || []).slice().sort(),
    dims,
  ]);
}

/** The whole layout decision, as data. 58.7 % of this book's Latin words have
 *  more than one reading and 29.3 % are ambiguous across more than one lemma,
 *  so ambiguity is the NORMAL case and a wall of near-identical lines is what
 *  has to be avoided: group by lemma (one headword line each), then by kind,
 *  then say once whatever the block shares and repeat only what differs.
 *  `patulae` becomes one lemma, one block, "feminine", and four short lines.
 *  Marked readings sort below unmarked ones and are never dropped. */
function grammarGroups(entry) {
  const readings = (entry && entry.readings) || [];
  const groups = [], atLemma = {};
  for (const r of readings) {
    const lem = String(r.lemma);
    if (!(lem in atLemma)) { atLemma[lem] = groups.length; groups.push({ lemma: lem, readings: [] }); }
    groups[atLemma[lem]].readings.push(r);
  }
  for (const g of groups) {
    const blocks = [], atKind = {};
    for (const r of g.readings) {
      const k = grammarKindKey(r);
      if (!(k in atKind)) {
        atKind[k] = blocks.length;
        blocks.push({ readings: [], marks: (r.marks || []).slice(), other: (r.other || []).slice() });
      }
      blocks[atKind[k]].readings.push(r);
    }
    for (const b of blocks) {
      const shared = [], varying = [];
      for (const dim of GRAMMAR_DIMS) {
        const vals = b.readings.map(r => grammarValue(r, dim));
        if (vals[0] == null) continue;
        if (vals.every(v => v === vals[0])) shared.push(vals[0]); else varying.push(dim);
      }
      b.varying = varying;
      b.sharedText = shared.join(" ");
      // One reading in the block is one flat line; more than one hoists what
      // they share and lists only the difference.
      b.phrases = (b.readings.length > 1 && varying.length)
        ? b.readings.map(r => grammarPhrase(r, GRAMMAR_DIMS.filter(d => varying.indexOf(d) === -1)))
        : [];
      b.marked = b.marks.length > 0;
    }
    blocks.sort((a, b) => (a.marked ? 1 : 0) - (b.marked ? 1 : 0));
    g.blocks = blocks;
    g.marked = blocks.length > 0 && blocks.every(b => b.marked);
  }
  groups.sort((a, b) => (a.marked ? 1 : 0) - (b.marked ? 1 : 0));
  return groups;
}

/** The headword lines for one lemma, kept in Wiktionary's own words.
 *  Two tidyings, and no more than two, because the line IS the answer:
 *   * a headword whose text is only the lemma again ("he", pos det) states
 *     nothing the lemma line above has not already said, so its part of
 *     speech is kept as a chip and the empty line is dropped;
 *   * an exactly repeated (text, pos) is shown once.
 *  Nothing is truncated, reworded, or ranked away: `he` really does have five
 *  headwords in the dump and the two that carry information are both shown. */
function grammarHeads(entry, lemma) {
  const heads = (entry && entry.headwords && entry.headwords[lemma]) || [];
  const lines = [], seen = {}, bare = [];
  for (const h of heads) {
    const text = (h && h.text) ? String(h.text).trim() : "";
    const pos = (h && h.pos) ? String(h.pos) : "";
    if (!text || text.toLowerCase() === String(lemma).toLowerCase()) {
      if (pos && bare.indexOf(pos) === -1) bare.push(pos);
      continue;
    }
    const key = text + "\u0000" + pos;
    if (key in seen) continue;
    seen[key] = 1;
    lines.push({ text: text, pos: pos });
  }
  const shown = lines.map(l => l.pos);
  return { lines: lines, bare: bare.filter(x => shown.indexOf(x) === -1) };
}

/** The count line, and the one sentence this whole module exists to keep
 *  honest: a word with four readings says four, never one. */
function grammarCountText(entry) {
  const n = (entry && entry.readings) ? entry.readings.length : 0;
  if (!n) return "";
  if (entry.certain && n === 1) return "one reading";
  const lemmas = grammarGroups(entry).length;
  return n + " readings" + (lemmas > 1 ? " of " + lemmas + " words" : "");
}

/* ======================================================== WHAT THE WORD IS
 * Osca, 31 Aug, from the built app, on `sepulchre`: "doesn't say it's a noun,
 * anywhere." The panel had a definition list and a grammar analysis and
 * nowhere the one fact a person looking a word up wants first.
 *
 * **The readings block is gone from this panel.** The "2 READINGS / lemma /
 * headword line" layout below `going` is the attribution grammar we build for
 * the voice and for voice UI -- it is not perfectly accurate, it is dense, and
 * it is not what a reader wants. It stays in `grammar.json` for its real
 * consumers, and `grammarGroups`, `grammarHeads` and `grammarPhrase` stay here
 * because the ONE useful fact in it -- what form this occurrence is -- is now
 * the last item on the top line. Nothing was deleted; it moved from a block to
 * four words. */

// Wiktionary's own abbreviations, in the words a person uses. Anything not in
// the table is passed through unchanged rather than guessed at: the export can
// grow a part of speech at any time, and "adposition" said plainly is better
// than a table that silently drops it.
const POS_WORDS = {
  adj: "adjective", adv: "adverb", conj: "conjunction", det: "determiner",
  intj: "interjection", num: "numeral", prep: "preposition", pron: "pronoun",
  propn: "proper noun", name: "name", particle: "particle", article: "article",
  prefix: "prefix", suffix: "suffix", infix: "infix", abbrev: "abbreviation",
  phrase: "phrase", proverb: "proverb", contraction: "contraction",
  punct: "punctuation", character: "character", romanization: "romanisation",
};
function posWord(p) {
  const k = String(p || "").trim().toLowerCase();
  if (!k) return "";
  return POS_WORDS[k] || k;
}

/* The senses, grouped by part of speech, in the order the export gives them.
 *
 * `remote` is nine numbered senses in one list today -- 1-4 the adjective,
 * 5-7 the noun, 8-9 the verb -- with nothing saying so, because
 * `dictionary.json` carries ONE `pos` for the whole entry and a flat `gloss`
 * array. The per-sense export is `dictionary/`'s work and had not landed when
 * this was built, so this function accepts three shapes and one of them is
 * today's:
 *
 *   1. `entry.senses = [{pos, gloss}, ...]`   <- the shape requested of
 *      dictionary/ (reader/README.md §6), one row per sense in export order;
 *   2. `entry.gloss = [{pos, text}, ...]`     <- the same fact carried on the
 *      existing key, accepted so either export lands without a reader change;
 *   3. `entry.gloss = ["...", ...]` with `entry.pos` <- what is on disk now,
 *      which yields exactly one group and therefore no headings at all.
 *
 * Order is the export's, never re-sorted: the dump's own order is the one
 * Wiktionary considers primary, and a reader who has seen an entry online
 * should see the same first sense here. */
function senseGroups(entry) {
  if (!entry) return [];
  const rows = [];
  if (Array.isArray(entry.senses)) {
    for (const x of entry.senses) {
      if (!x) continue;
      if (typeof x === "string") { rows.push({ pos: entry.pos || null, text: x }); continue; }
      const text = x.gloss != null ? x.gloss : x.text;
      if (text == null) continue;
      rows.push({ pos: x.pos || entry.pos || null, text: String(text) });
    }
  } else if (Array.isArray(entry.gloss)) {
    for (const x of entry.gloss) {
      if (x == null) continue;
      if (typeof x === "string") { rows.push({ pos: entry.pos || null, text: x }); continue; }
      const text = x.gloss != null ? x.gloss : x.text;
      if (text == null) continue;
      rows.push({ pos: x.pos || entry.pos || null, text: String(text) });
    }
  }
  const groups = [], at = {};
  for (const r of rows) {
    const key = String(r.pos || "");
    if (!(key in at)) { at[key] = groups.length; groups.push({ pos: r.pos || null, senses: [] }); }
    groups[at[key]].senses.push(r.text);
  }
  return groups;
}

/* THE GRAMMAR OF THIS OCCURRENCE, in four words or fewer.
 *
 * One reading is one phrase and there is nothing to decide. More than one is
 * the normal case -- `going` is two, gerund and participle -- and the panel
 * must not pick one by luck of array order, nor print both as a paragraph.
 *
 * **The word's own headword line is the tie-break**, and it is a real signal
 * rather than a heuristic: Wiktionary states the principal parts in it, and
 * for `go` the line is "go (third-person singular simple present goes,
 * PRESENT PARTICIPLE GOING, simple past went, ...)" -- it names this exact
 * surface form and says what it is called. So a reading whose phrase appears
 * in that line immediately before this word is the one the dictionary itself
 * says this form is. This only ever RANKS readings the analyser already
 * produced; it never invents one.
 *
 * When the headword line does not settle it the line does NOT pretend: it
 * gives the first reading's phrase and then says how many others there are,
 * with every one of them on the element's `title`. `patulae` really is four
 * forms of one adjective and the old block drew all four; four forms strung
 * across a top line is unreadable, and picking one silently is the lie this
 * module has always refused. "nominative plural feminine, or 3 other forms"
 * is short, true, and one hover from complete. */
function occurrenceGrammar(entry, word) {
  const readings = (entry && entry.readings) || [];
  if (!readings.length) return null;
  if (readings.length === 1) {
    return { phrase: grammarPhrase(readings[0]), lemma: readings[0].lemma,
             settled: true, alts: [] };
  }
  const w = String(word || "").toLowerCase();
  for (const r of readings) {
    const phrase = grammarPhrase(r);
    if (!phrase || !w) continue;
    const heads = (entry.headwords && entry.headwords[r.lemma]) || [];
    for (const h of heads) {
      const line = String((h && h.text) || "").toLowerCase();
      if (line.indexOf(phrase.toLowerCase() + " " + w) >= 0) {
        return { phrase, lemma: r.lemma, settled: true, by: "headword", alts: [] };
      }
    }
  }
  const alts = [];
  for (const r of readings) {
    const ph = grammarPhrase(r);
    if (ph && alts.indexOf(ph) === -1) alts.push(ph);
  }
  if (!alts.length) return null;
  if (alts.length === 1) {
    return { phrase: alts[0], lemma: readings[0].lemma, settled: true, alts };
  }
  const others = alts.length - 1;
  const phrase = alts[0] + (others === 1
    ? ", or " + alts[1]
    : ", or " + others + " other forms");
  return { phrase, lemma: readings[0].lemma, settled: false, alts };
}

/* The part of speech for the TOP line: the one that fits this occurrence when
 * grammar.json knows it, otherwise the entry's first.
 *
 * grammar.json does not carry a part of speech on a reading -- it carries a
 * lemma -- but it carries the headwords for that lemma, and those do. So the
 * occurrence's pos is the pos of the headword of the reading we settled on,
 * which for `going` reads through `go`'s verb headword to "verb". */
function occurrencePos(entry, grammar, groups) {
  if (grammar && grammar.lemma && entry && entry.headwords) {
    const heads = entry.headwords[grammar.lemma] || [];
    for (const h of heads) if (h && h.pos) return posWord(h.pos);
  }
  if (groups && groups.length && groups[0].pos) return posWord(groups[0].pos);
  return "";
}

/** The whole top line as data, so all four of its cases are testable without
 *  a browser: a word with everything, a word with no grammar record (word,
 *  language, pos, and it stops), a cue (a name the book declares), and a word
 *  the dictionary has never heard of. */
function topLineModel(lookup) {
  const l = lookup || {};
  const entry = l.entry || null;
  const groups = l.cue ? [] : senseGroups(entry);
  const gram = l.cue ? null : occurrenceGrammar(l.grammar, l.word);
  return {
    word: l.word || "",
    lang: String(l.lang || "").toUpperCase(),
    pos: l.cue ? "name" : occurrencePos(entry, gram, groups),
    grammar: gram ? gram.phrase : "",
    alts: gram ? (gram.alts || []) : [],
    settled: gram ? !!gram.settled : null,
    groups,
    etymology: (!l.cue && entry && entry.etymology) ? String(entry.etymology) : "",
  };
}

/** The top line's own text, exactly as the row reads it -- the string the
 *  report and the tests quote. */
function topLineText(model) {
  return [model.word, model.lang, model.pos, model.grammar].filter(Boolean).join(" · ");
}

function paintTopLine(pane, model) {
  const els = pane.els;
  els.popupWord.textContent = model.word;
  els.popupLang.textContent = model.lang;
  els.popupPos.textContent = model.pos;
  els.popupGram.textContent = model.grammar;
  // every reading, on the hover, when the line could only name one of them
  // setAttribute, not `.title`: the node harness reflects the attribute and
  // not the property, and the hover is only worth having if it is really there
  if (model.alts && model.alts.length > 1) els.popupGram.setAttribute("title", model.alts.join("; "));
  else els.popupGram.removeAttribute("title");
  // the middle dot goes BETWEEN two things that are both there, so a word
  // with no grammar record ends after its part of speech and a word with
  // neither ends after its language -- never with a trailing separator
  const top = els.popupTop;
  for (const old of Array.from(top.querySelectorAll(".sep"))) old.remove();
  const parts = [els.popupWord, els.popupLang, els.popupPos, els.popupGram]
    .filter(el => el.textContent);
  for (let i = 1; i < parts.length; i++) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = " · ";
    parts[i].parentNode.insertBefore(sep, parts[i]);
  }
  return topLineText(model);
}

/** The definitions, grouped, numbered from 1 inside each group. The heading
 *  is drawn only when there is more than one group: with one, it would repeat
 *  the part of speech the top line has just said. */
function paintSenses(pane, groups) {
  const el = pane.els.popupGloss;
  el.innerHTML = "";
  el.dataset.groups = String(groups.length);
  for (const g of groups) {
    const box = document.createElement("div");
    box.className = "posgroup";
    if (groups.length > 1 && g.pos) {
      const h = document.createElement("div");
      h.className = "poshead";
      h.textContent = posWord(g.pos);
      box.appendChild(h);
    }
    const ol = document.createElement("ol");
    for (const text of g.senses) {
      const li = document.createElement("li");
      li.textContent = text;
      ol.appendChild(li);
    }
    box.appendChild(ol);
    el.appendChild(box);
  }
  return groups.length;
}

/** Etymology, right there -- and absent when there is none: no heading, no
 *  "no etymology". Where it sits is a LAYOUT question and is answered in CSS
 *  off `data-cols`, which `renderPopup` sets from the number of panes. */
function paintEtymology(pane, text) {
  const el = pane.els.popupEtym;
  el.innerHTML = "";
  el.hidden = !text;
  if (!text) return "";
  const h = document.createElement("div");
  h.className = "etymhead";
  h.textContent = "Etymology";
  const body = document.createElement("p");
  body.textContent = text;
  el.appendChild(h);
  el.appendChild(body);
  return text;
}

// ------------------------------------------------------------------- lookup
function lookup(pane, word, sentenceId, lang, details) {
  details = details || {};
  pane.lookup = { word, sentenceId, lang, ...details };
  renderPopup(pane);
  loadDictionaryLinks().then(data => {
    if (!pane.lookup || pane.lookup.word !== word) return;
    pane.lookup.links = (data && data[lang]) || null;
    renderPopup(pane);
  });
  loadBookDictionary(pane).then(data => {
    if (!pane.lookup || pane.lookup.word !== word) return;
    const entry = data && data[word];
    // ------------------------------------------------ a cue is not a word
    // A speaker cue is a name (dictionary/cast.py, `e7d278c`): HAMLET is not
    // "a small settlement" and the eclogues' M. is not the letter M. The
    // export already replaces such an entry with the book's own -- `cue:
    // true`, the cast sentence, `cue_turns`/`cue_names`, and whatever the
    // dictionary would have said parked in `suppressed`. This is the render
    // half: state it, never offer it as a gloss, and never surface
    // `suppressed`.
    //
    // **The gate is the entry's own `cue` flag, not `role="speaker"`**
    // (TRIGGERS.md's reader line). 33 of Hamlet's cue occurrences are words
    // inside `role="speech"` paragraphs -- the parser leaves the name glued
    // to the speech -- so a role test would gloss those anyway; and it would
    // silence a genuine word that happens to sit in a cue paragraph. The
    // dictionary is keyed by text, so every occurrence of the spelling is
    // treated as the name: that collateral is measured and accepted upstream
    // (cast.py's `other_occurrences`; Hamlet's 42 are the cast list and five
    // cues the parser left inside a speech line -- all of them names).
    pane.lookup.cue = !!(entry && entry.cue);
    if (pane.lookup.cue) {
      // The book's own sentence, verbatim -- the wording lives in
      // dictionary/cast.py and is not restated here.
      pane.lookup.cast = (entry.gloss && entry.gloss.length) ? entry.gloss[0] : null;
      pane.lookup.cueTurns = entry.cue_turns == null ? null : entry.cue_turns;
      pane.lookup.cueNames = entry.cue_names || [];
      pane.lookup.entry = entry;
      pane.lookup.gloss = null;
    } else {
      pane.lookup.cast = null;
      // The WHOLE entry, not just its glosses: the panel now reads `pos` (per
      // sense when the export carries it) and `etymology` off it, and picking
      // three fields out here would put the export's shape in two places.
      pane.lookup.entry = entry || null;
      pane.lookup.gloss = (entry && entry.gloss && entry.gloss.length) ? entry.gloss : null;
    }
    renderPopup(pane);
  });
  loadBookGrammar(pane).then(words => {
    if (!pane.lookup || pane.lookup.word !== word) return;
    // A cue gets no grammar for the same reason it gets no gloss: HAMLET is a
    // name the book itself declares, and "nominative singular of hamlet, a
    // small settlement" would be the same lie in a different box. The cue flag
    // is set by the dictionary promise above; both promises call renderPopup,
    // and whichever lands second draws the settled state.
    pane.lookup.grammar = (words && !pane.lookup.cue) ? (words[word] || null) : null;
    renderPopup(pane);
  });
}

// Where the panel is drawn. A pane's panel belongs over ITS OWN column, so on
// a desktop the Latin panel sits under the Latin and the English under the
// English, and both can be open at once. Three cases, and no new state:
//   * the pane is on screen -> the panel takes exactly the pane's box;
//   * the pane is NOT on screen but one-word mode is (which hides #panes
//     wholesale) -> full width, because the stage is the whole window;
//   * the pane is not on screen otherwise -- the collapsed column on a phone
//     -> the panel is not painted at all. Nothing is discarded: it keeps its
//     word and its open state, so switching columns, or rotating back to two,
//     shows it exactly as it was left.
// Is this pane's column being painted at all? Asked of the page's own state
// rather than of a measurement, so it answers the same in a browser and in the
// node harness, which has no layout: one-word mode hides #panes and reads one
// pane; a phone showing two books paints only the `.active` column; everything
// else paints every pane it has.
function paneOnScreen(pane) {
  if (OW.on) return OW.pane === pane;
  if (panes.length < 2) return true;
  if (!isPhone()) return true;
  return pane.els.root.classList.contains("active");
}

function positionPopup(pane) {
  const el = pane.els.popup;
  if (!paneOnScreen(pane)) { el.classList.add("offstage"); return; }
  el.classList.remove("offstage");
  const r = pane.els.root.getBoundingClientRect();
  // Measured, so two columns of unequal width still each get their own; the
  // full window is the answer when the pane has no box to measure (one-word
  // mode, and the node harness).
  if (r && r.width > 0) { el.style.left = r.left + "px"; el.style.width = r.width + "px"; }
  else { el.style.left = "0px"; el.style.width = "100%"; }
}

function repositionPopups() {
  for (const p of panes) if (p.lookup) positionPopup(p);
}

function renderPopup(pane) {
  const popupEl = pane.els.popup;
  if (!pane.lookup) {
    popupEl.classList.remove("open");
    popupEl.setAttribute("aria-hidden", "true");
    return;
  }
  // WHAT THE WORD IS, first: word, language, part of speech, and the grammar
  // of this occurrence, on one line across the top.
  const model = topLineModel(pane.lookup);
  paintTopLine(pane, model);
  pane.els.popupPhon.textContent = pane.lookup.phon ? `/${pane.lookup.phon}/` : "";
  // The sentence the word sits in stays exactly where it was, under the
  // definitions (Osca called it clever).
  pane.els.popupContext.textContent = pane.lookup.sentenceText || "";
  /* Etymology to the RIGHT in a single-book view and BELOW in a parallel one:
   * one panel over one window has a column's worth of room, two panels over
   * half a window each do not, and squeezing the definitions to make space
   * for a paragraph is the worse of the two. The pane count is the question,
   * so it is the attribute; the phone falls back to one column in CSS, where
   * a half-window and a phone are the same problem. */
  popupEl.dataset.cols = panes.length === 2 ? "1" : "2";

  // The cast statement sits where a gloss would, and replaces it: a cue's
  // `gloss` is null by the rule at lookup(), so these two are exclusive.
  const castEl = pane.els.popupCast;
  castEl.innerHTML = "";
  castEl.hidden = !(pane.lookup.cue && pane.lookup.cast);
  if (pane.lookup.cue && pane.lookup.cast) castEl.textContent = pane.lookup.cast;

  paintSenses(pane, model.groups);
  paintEtymology(pane, model.etymology);

  const linksEl = pane.els.popupLinks;
  linksEl.innerHTML = "";
  if (pane.lookup.links && pane.lookup.links.length) {
    for (const link of pane.lookup.links) {
      const a = document.createElement("a");
      a.href = resolveLinkUrl(link, pane.lookup.word);
      a.textContent = link.label;
      a.target = "_blank";
      a.rel = "noopener";
      linksEl.appendChild(a);
    }
  } else if (linksAttempted && !pane.lookup.links) {
    const p = document.createElement("div");
    p.className = "none";
    p.textContent = "No online dictionary links configured yet.";
    linksEl.appendChild(p);
  }

  positionPopup(pane);
  popupEl.classList.add("open");
  popupEl.setAttribute("aria-hidden", "false");
}

function closePopup(pane) {
  if (!pane) return;
  const wasOpen = !!pane.lookup;
  pane.lookup = null;
  renderPopup(pane);
  // hold-to-look-up paused the one-word stage to open this; closing it
  // resumes where it stopped (owOnPopupClosed is a no-op otherwise)
  if (wasOpen) owOnPopupClosed();
}

/** Every pane with an open panel, left to right. Two is normal now. */
function openLookupPanes() {
  return panes.filter(p => p.lookup);
}

// Dismissal, and there is exactly ONE set of rules -- reader/popover.js's, as
// settled on 30 Aug: Esc, a click outside, and the same control again (the
// toggle in wireControls). `pointerdown` is bound as well as `click` for the
// reason popover.js binds both -- a panel that only listens for `click` stays
// open through the press that begins the click, which is the bug that rule
// fixed once already.
//
// What is exempt: the panel itself, any `.word` anywhere (tapping a word in
// the other column must open that column's panel, not close this one -- both
// open at once is the point), and #owStage (the press that opens a panel by
// holding the stage would otherwise close it on release).
function dismissPopupsOutside(e) {
  const open = openLookupPanes();
  if (!open.length) return;
  const t = e.target;
  if (!t || !t.closest) return;
  // #paneSwitch is exempt because it decides which COLUMN is on screen, not
  // whether a panel is open: a phone reader tapping LA to see the Latin of the
  // English word they just looked up must not lose the English panel by doing
  // it (dictionary/README.md 30 Aug §8).
  // A press inside ANY panel is inside a panel: the two are peers, and
  // scrolling the English gloss must not shut the Latin beside it.
  if (t.closest(".word") || t.closest("#owStage") || t.closest("#paneSwitch") || t.closest(".popup")) return;
  for (const p of open) closePopup(p);
}
document.addEventListener("pointerdown", dismissPopupsOutside);
document.addEventListener("click", dismissPopupsOutside);
