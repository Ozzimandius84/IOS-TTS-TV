/* reader/sidebar.js -- the chapter sidebar, one component for reader and studio.
 *
 * READER_FIRST.md: "Sidebar = this book's chapters, grouped under a
 * collapsible drop-down per collection or act when the book has them
 * (Chapter.section); flat otherwise. Each row: title · state." Studio embeds
 * this same file by URL (core/README.md "The shared sidebar is a file, not an
 * import"): `<script src="/reader/sidebar.js">` + `<link href="/reader/sidebar.css">`.
 * No module syntax, no build step, no imports -- one global, `TTSTVSidebar`,
 * and a CommonJS export so the same file runs under node for the tests
 * (reader/tests/test_sidebar.py, a mini-DOM in reader/tests/minidom.js).
 *
 * Inputs (all pushed in by the host; the component never fetches):
 *   book    -- book.json (chapters: [{id, title, section?}]) -- setBook()
 *   states  -- {cid: {label, cls}} per unit -- setStates(); usually built by
 *              TTSTVSidebar.statesFrom(stateBook, job, localQueued) from
 *              studio's GET /state entry for the book (studio/bookinfo.py),
 *              which prefers each row's own server-side `unit` label -- see
 *              unitState() below
 *   current -- the unit on screen -- setCurrent()
 * Output: events, nothing else. No studio calls inside; the host wires them.
 *   select(ids)         selection changed (ids in book order)
 *   open(id)            a plain click / double-click / Enter on one row
 *   push(ids, mode)     the mic: ids = selection or [current]; mode "auto",
 *                       or "manual" when alt-clicked / push("manual") called
 *
 * Selection model: click = that row; shift-click = the range from the
 * anchor, or from the chapter being read when nothing is picked yet. THERE
 * IS NO CMD-CLICK ANYWHERE IN THIS APPLICATION (OSCA-1SEP-LIST C3, 1 Sep:
 * "shift-click only -- cmd-click is removed everywhere (it mis-toggles
 * anyway)"), so there is no toggle either: a range REPLACES what was picked.
 * A group header selects every unit in the group -- collapsed or not, the
 * header is the only handle a collapsed group has. The disclosure triangle
 * only folds.
 *
 * A PICK LIST -- `create(el, { picks: true })` -- is that model with one
 * change and one look (PROMPTS/studio-sidebar.md Part 2, and the picture
 * `PROMPTS/mock/studio-sidebar.html` draws): a plain click on a ROW clears
 * the selection instead of replacing it with that row, because there the
 * click is a turn of the page and the selection is what studio will render;
 * and the container carries `sb-picks`, which is the only hook the picked
 * row's inset block in `sidebar.css` hangs off. The reader's contents list
 * passes it. Studio's rail does not, and is unchanged by all of it.
 *
 * DOM is built with createElement only (never innerHTML) so the node
 * harness's mini-DOM can prove the rendered tree, not just the pure helpers.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TTSTVSidebar = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // ------------------------------------------------------------ pure helpers

  // Groups chapters by Chapter.section in first-appearance order. A book with
  // no sections at all -> one group, section null (rendered flat). A book
  // where only some chapters carry a section (Stevens: c001-c002 front matter
  // before HARMONIUM) -> those sit in a null group at their own position.
  function groupChapters(book) {
    const groups = [];
    let last = null;
    for (const ch of (book && book.chapters) || []) {
      const section = ch.section == null ? null : String(ch.section);
      if (!last || last.section !== section) {
        last = { section, chapters: [] };
        groups.push(last);
      }
      last.chapters.push(ch);
    }
    return groups;
  }

  function unitOrder(book) {
    return ((book && book.chapters) || []).map(c => c.id);
  }

  // A reader-first label -> its CSS class. One mapping for both sources of a
  // label: the server's own `unit` string (studio/state.py unit_label) and
  // the recompute below. Prefix-matched, because two of core/README.md's
  // "Unit states" carry a tail -- "rendering: <step>", "failed: <last log
  // line>" -- and the reader's own "voiced · aligning" is a "voiced".
  // Exported so studio.html reads the classes off this file rather than
  // keeping a second copy that can drift.
  /* THE ROW'S WORDS ARE THE CHAPTER'S NAME. Osca, 31 Aug, on a screenshot of
   * the contents list: the row read `failed: ValueError: word 'c002.p0001.s0...`
   * over "The Library of Babel", and the chapter played fine. "I DO NOT like
   * that." So, decided for the third time (READER_FIRST.md "Decided three
   * times" -- the page speaks to the reader, never to the developer), and this
   * time enforced where the label is BUILT rather than where it is painted:
   * every state -- queued, needs a voice, rendering, failed, voiced -- is the
   * row's `data-state` and the colour of its mark, and never a word. There is
   * then no path at all by which a step name, an exception or a log line
   * reaches a page that uses this component; `unitState` no longer even reads
   * a log.
   *
   * It started (30 Aug evening) with two of them: "The `dict` badge on every
   * contents row goes. Whether a chapter has a dictionary is not something the
   * reader needs told forty times." `text` and `dict` went then; the rest go
   * now, and the four that were "news" say it in colour instead.
   *
   * The CLASS is untouched, so `data-state` on the row and every colour rule
   * keyed on it -- here, in sidebar.css and in studio.html, which uses this
   * same component -- still say exactly what they said. Only the words go.
   * One line to undo: `return label`. */
  function quiet(label) {
    return "";
  }

  /* STUDIO'S OWN WORDS, ALL OF THEM (1 Sep). `unit_label` was rewritten on
   * 31 Aug -- "a job's verdict is the furthest step that succeeded, not the
   * first that failed" -- and its whole vocabulary changed with it:
   * `rendered`, `rendered · aligned`, `rendered · alignment failed`,
   * `rendered · opus not exported`, `planned`, and a bare `parsing failed` /
   * `the render failed` where nothing succeeded at all. This function still
   * only knew the words BEFORE that rewrite (`voiced`, `failed: <line>`), so
   * every row studio labelled came back `none` -- which is why a chapter with
   * finished audio carried no mark at all, in the reader's contents list and
   * in studio's own rail, both of which read their classes from here.
   *
   * The order is studio's ranking, and the reached prefix is checked BEFORE
   * the failure suffix on purpose: `rendered · alignment failed` is a chapter
   * that plays (sidebar.css "AUDIO BEATS failed"), so it is grey, not red. */
  function labelClass(label) {
    const s = String(label == null ? "" : label);
    if (s.startsWith("rendering")) return "rendering";
    if (s.startsWith("failed")) return "failed";          // the pre-31-Aug "failed: <log line>"
    if (s === "queued" || s === "needs a voice") return "queued";
    // `reached()`'s two audio words, and the old one, whatever suffix follows
    if (s.startsWith("voiced") || s.startsWith("rendered") || s === "aligned") return "voiced";
    if (/failed$/.test(s)) return "failed";               // `parsing failed`, `the render failed`, ...
    if (s === "text" || s === "dict" || s === "planned") return "text";
    return "none";
  }

  // The one place "which state wins the row" is decided (core/README.md
  // "Reader-first": states are not a partition; the reader picks). Priority:
  // failed > rendering > queued > needs a voice > voiced > text > (nothing).
  // `row` is one entry of /state books[].chapters[] ({id, state:{step: cell}})
  // -- cells are studio/state.py's: "ok" | "-" | "running" | "failed" | ...
  // `job` is /state.job; `queued` is a Set of ids the host pushed and has not
  // seen /state confirm yet (rf-studio's compute_state() `queued` wins once
  // it exists: row.queued === true is honoured the same way).
  //
  // AUDIO BEATS `failed` (Osca, 31 Aug): "a chapter whose audio exists and
  // plays is voiced, whatever a later step said". `speak: "ok"` is the audio
  // on disk (studio/state.py writes that cell when the wav is there), so it
  // pre-empts `failed` in BOTH sources of a label -- the server's own `unit`
  // string and the recompute below. What put the screenshot's row in red was
  // an `align` failure on a chapter that plays. `rendering` still outranks
  // it: a re-render in progress is newer news than the audio it replaces.
  //
  // PROMPTS/studio-owed.md step 4: when the payload carries `row.unit` --
  // studio's own reader-first label, on every chapter of GET /state -- that
  // label wins, and the block below is the fallback for a payload without
  // one (a bundle, an older studio). Two rankings over the same cells is
  // what made the sidebar read "failed: align" on a row studio's grid called
  // "rendering: speak": studio ranks rendering > queued > failed, this
  // function ranks failed > rendering > queued, and both were right about
  // their own ranking. One label, computed once, server-side -- and it is
  // the better one besides, since unit_label reads the failing step's log
  // and this function only knows the step's name.
  function unitState(row, opts) {
    opts = opts || {};
    const cells = (row && row.state) || {};
    const cid = row && row.id;
    const job = opts.job || null;
    const hostQueued = (row && row.queued === true) || !!(opts.queued && opts.queued.has(cid));
    // "-" is unit_label's nothing-yet (studio/state.py MISSING), not a label.
    const unit = row && typeof row.unit === "string" && row.unit !== "-" ? row.unit : "";
    const hasAudio = cells.speak === "ok";
    if (unit) {
      // The one fact the server cannot have yet: a unit this host pushed
      // since the payload was built. It only pre-empts a label meaning
      // nothing has started -- never `rendering` or `failed`, which are
      // newer news than our own optimism.
      if (hostQueued && (unit === "text" || unit === "dict"))
        return { label: quiet(opts.needsVoice ? "needs a voice" : "queued"), cls: "queued" };
      if (hasAudio && labelClass(unit) === "failed")
        return { label: quiet("voiced"), cls: "voiced" };
      return { label: quiet(unit), cls: labelClass(unit) };
    }
    const failedStep = hasAudio ? undefined : Object.keys(cells).find(k => cells[k] === "failed");
    if (failedStep) return { label: quiet("failed"), cls: "failed" };
    const runningStep = Object.keys(cells).find(k => cells[k] === "running");
    if (runningStep) return { label: quiet("rendering: " + runningStep), cls: "rendering" };
    if (job && job.phase === "running" && job.slug === opts.slug) {
      const jc = job.mode === "single" ? job.chapter : job.current_chapter;
      const js = job.mode === "single" ? job.step : job.current_step;
      if (jc === cid && js) return { label: quiet("rendering: " + js), cls: "rendering" };
    }
    if (hostQueued) {
      if (opts.needsVoice) return { label: quiet("needs a voice"), cls: "queued" };
      return { label: quiet("queued"), cls: "queued" };
    }
    if (cells.speak === "ok") {
      return cells.align === "ok"
        ? { label: quiet("voiced"), cls: "voiced" }
        : { label: quiet("voiced · aligning"), cls: "voiced" };
    }
    if (cells.parse === "ok") return { label: quiet("text"), cls: "text" };
    return { label: "", cls: "none" };
  }

  /* The same answer from the book's OWN `state.json`, which is the file
   * studio builds /state out of (studio/state.py `write_state`) and the only
   * source there is when no studio sits behind the origin -- the built Mac
   * app opening a book folder, a bundle, a phone. Shape differs and nothing
   * else does: `state.json` keys its chapters by id and puts the step cells
   * at the top level of each entry beside `unit`, `words`, `audio_s` and
   * `updated`, where /state nests them under `state` in a list. This is the
   * adapter, and it is here rather than in the reader so that studio's rail
   * and the reader's contents list cannot drift apart about what a file on
   * disk means.
   *
   * Pure: the host reads the file and passes it in (this component never
   * fetches -- see the header). */
  const _NOT_A_STEP = { unit: 1, words: 1, audio_s: 1, updated: 1 };
  function stateBookFromLocal(local, slug) {
    if (!local || !local.chapters || typeof local.chapters !== "object") return null;
    const chapters = [];
    for (const id of Object.keys(local.chapters)) {
      const entry = local.chapters[id] || {};
      const cells = {};
      for (const k of Object.keys(entry)) if (!_NOT_A_STEP[k]) cells[k] = entry[k];
      const row = { id: id, state: cells };
      if (typeof entry.unit === "string") row.unit = entry.unit;
      chapters.push(row);
    }
    return { slug: local.slug || slug || null, voice: local.voice || null,
             needs_voice: !!local.needs_voice, chapters: chapters };
  }

  // {cid: {label, cls}} from a book's own `state.json`. `needs a voice` comes
  // from the file's own `needs_voice`, which is the same question /state's
  // `book.voice` answers for the polling path.
  function statesFromLocal(local, slug, extra) {
    const stateBook = stateBookFromLocal(local, slug);
    if (!stateBook) return {};
    return statesFrom(stateBook, null, null,
      Object.assign({ needsVoice: stateBook.needs_voice && !stateBook.voice }, extra || {}));
  }

  // {cid: {label, cls}} for one book from GET /state -- stateBook is the
  // entry of /state.books[] whose slug matches; job is /state.job.
  function statesFrom(stateBook, job, queued, extra) {
    const out = {};
    if (!stateBook) return out;
    const opts = Object.assign({ slug: stateBook.slug, job, queued }, extra || {});
    for (const row of stateBook.chapters || []) out[row.id] = unitState(row, opts);
    return out;
  }

  /* THE WHOLE GESTURE, AND IT IS TWO THINGS. Click = that row (on a group
   * head, that whole act); shift-click = the range. **There is no cmd-click
   * anywhere in this application any more** -- OSCA-1SEP-LIST C3, 1 Sep:
   * *"shift-click only -- cmd-click is removed everywhere (it mis-toggles
   * anyway)."* This function is the LIVE half of that -- it is what runs in
   * the reader's contents list and in studio's rail whenever the component
   * loaded; `studio/studio.html::applySel` is the fallback for a machine
   * where it did not, and went first (`61e0223`).
   *
   * AND THE GESTURE HAS TO ANSWER WHAT CMD USED TO: a shift-click with
   * NOTHING picked. It folds in `current`, the chapter being read, so
   * shift-clicking Scene 3 while reading Scene 1 picks 1-3 rather than
   * picking Scene 3 alone and making a person click twice to say the obvious
   * thing. The anchor wins when there is one -- a plain click then a
   * shift-click still reads the range from where the click landed. With no
   * anchor and no current chapter there is one end and not two, so a
   * shift-click is a plain click.
   *
   * `prev` is gone from the signature with the toggle it served: a range
   * REPLACES the selection, which is what `if (!mods.meta) sel.clear()`
   * already did, so what was picked before is not an input to what is picked
   * now. `mods` is {shift, picks} and there is no modifier left for the host
   * to map, which is why no caller passes a platform any more.
   *
   * Returns {selection: [ids in book order], anchor}, or `null` for a click
   * this book cannot answer (an id that is not in `order`: a stale row left
   * by a `setBook` the DOM has not caught up with). Null is "nothing
   * changed", and `clickIds` below is the one caller that has to know it.
   *
  /* `picks` IS THE PLAIN CLICK'S ANSWER, AND ONLY THE PLAIN CLICK'S
   * (PROMPTS/studio-sidebar.md Part 2.1: "a plain click still navigates and
   * clears the picks"). In a PICK LIST -- the reader's contents list, where
   * the selection is what studio is about to render -- a bare click is a
   * turn of the page, not a choice of what to render, so it leaves NO pick
   * behind. The anchor still moves to the clicked row, which is what makes
   * click-then-shift-click read the range a reader means: from where I am.
   *
   * Without it there is no no-picks state at all -- every click would leave
   * one row selected -- and studio's card could never say "just where the
   * reader is" (studio/README.md studio-sidebar Part 1 §6.4).
   *
   * Studio's own rail does NOT pass it and is unchanged: there a click IS
   * the choice of what to render, and that page is not in this picture. */
  function applySelection(ids, mods, anchor, order, current) {
    const pos = new Map(order.map((id, i) => [id, i]));
    const at = x => (x != null && pos.has(x) ? pos.get(x) : -1);
    if (!ids || !ids.length || ids.some(id => !pos.has(id))) return null;
    const clickedFirst = ids[0], clickedLast = ids[ids.length - 1];
    const start = at(anchor) >= 0 ? anchor : at(current) >= 0 ? current : null;
    if (mods && mods.shift && start != null) {
      const a = at(start);
      const lo = Math.min(a, at(clickedFirst));
      const hi = Math.max(a, at(clickedLast));
      return { selection: order.slice(lo, hi + 1), anchor: start };
    }
    if (mods && mods.picks) return { selection: [], anchor: clickedFirst };
    const set = new Set(ids);
    return { selection: order.filter(id => set.has(id)), anchor: clickedFirst };
  }

  // ---------------------------------------------------------------- the DOM

  function el(doc, tag, cls, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function create(container, opts) {
    opts = opts || {};
    const doc = opts.document || container.ownerDocument || (typeof document !== "undefined" ? document : null);
    const handlers = { select: [], open: [], push: [] };
    const PICKS = opts.picks === true;
    const sb = {
      book: null, states: {}, current: null,
      selection: [], anchor: null,
      collapsed: new Set(),
      els: { root: container, top: null, list: null, note: null, mic: null },
    };

    function emit(name, ...args) { for (const fn of handlers[name]) fn(...args); }

    // top slot: the mic (READER_FIRST.md: "one flat single-colour button at
    // the top of the sidebar") + one line of note the host can set.
    container.className = (container.className ? container.className + " " : "") + "sb"
      + (PICKS ? " sb-picks" : "");
    sb.els.top = el(doc, "div", "sb-top");
    if (opts.mic !== false) {
      const mic = el(doc, "button", "sb-mic");
      mic.type = "button";
      mic.setAttribute("aria-label", opts.micLabel || "Push to studio");
      mic.title = opts.micTitle || "Push the selection to studio (⌥-click: open the bench)";
      mic.appendChild(el(doc, "span", "sb-mic-glyph", "🎤"));
      mic.appendChild(el(doc, "span", "sb-mic-text", opts.micLabel || "Push"));
      mic.addEventListener("click", ev => { sb.push(ev.altKey ? "manual" : "auto"); });
      sb.els.top.appendChild(mic);
      sb.els.mic = mic;
    }
    sb.els.note = el(doc, "div", "sb-note");
    sb.els.top.appendChild(sb.els.note);
    sb.els.list = el(doc, "div", "sb-list");
    sb.els.list.setAttribute("role", "listbox");
    sb.els.list.setAttribute("aria-multiselectable", "true");
    container.appendChild(sb.els.top);
    container.appendChild(sb.els.list);

    const rowEls = new Map();
    const groupEls = new Map();

    function order() { return unitOrder(sb.book); }
    function groupIds(section) {
      const g = groupChapters(sb.book).find(x => x.section === section);
      return g ? g.chapters.map(c => c.id) : [];
    }

    function setSel(next) {
      const changed = next.selection.join(" ") !== sb.selection.join(" ");
      sb.selection = next.selection;
      sb.anchor = next.anchor;
      paintSelection();
      if (changed) emit("select", sb.selection.slice());
    }

    /* `picks` is passed by the ROW's click and never by the group head's: a
     * head is not a place you can be reading, so a bare click on one is not a
     * navigation and has no page to turn -- it selects its act, which is the
     * one gesture that picks a whole act in a stroke. */
    function clickIds(ids, ev, picks) {
      const next = applySelection(ids, { shift: !!ev.shiftKey, picks: !!picks },
                                  sb.anchor, order(), sb.current);
      if (next) setSel(next);
    }

    function render() {
      const list = sb.els.list;
      while (list.firstChild) list.removeChild(list.firstChild);
      rowEls.clear(); groupEls.clear();
      const groups = groupChapters(sb.book);
      const flat = groups.length === 1 && groups[0].section === null;
      for (const g of groups) {
        let rowsParent = list;
        if (!flat && g.section !== null) {
          const grp = el(doc, "div", "sb-group");
          grp.dataset.section = g.section;
          const head = el(doc, "div", "sb-head");
          const disc = el(doc, "button", "sb-disclosure");
          disc.type = "button";
          disc.setAttribute("aria-label", "Fold " + g.section);
          disc.textContent = "▾";
          disc.addEventListener("click", ev => { ev.stopPropagation(); sb.toggle(g.section); });
          const name = el(doc, "span", "sb-section", g.section);
          const count = el(doc, "span", "sb-count", String(g.chapters.length));
          head.appendChild(disc); head.appendChild(name); head.appendChild(count);
          head.addEventListener("click", ev => clickIds(groupIds(g.section), ev));
          head.addEventListener("dblclick", ev => { ev.preventDefault(); sb.toggle(g.section); });
          const rows = el(doc, "div", "sb-rows");
          grp.appendChild(head); grp.appendChild(rows);
          list.appendChild(grp);
          groupEls.set(g.section, { grp, disc, head });
          rowsParent = rows;
        }
        for (const ch of g.chapters) {
          const row = el(doc, "div", "sb-row");
          row.dataset.id = ch.id;
          row.setAttribute("role", "option");
          row.tabIndex = -1;
          row.appendChild(el(doc, "span", "sb-title", ch.title || ch.id));
          row.appendChild(el(doc, "span", "sb-state", ""));
          row.addEventListener("click", ev => {
            clickIds([ch.id], ev, PICKS);
            if (!ev.shiftKey) emit("open", ch.id);
          });
          row.addEventListener("dblclick", ev => { ev.preventDefault(); emit("open", ch.id); });
          row.addEventListener("keydown", ev => {
            if (ev.key === "Enter") { ev.preventDefault(); emit("open", ch.id); }
          });
          rowsParent.appendChild(row);
          rowEls.set(ch.id, row);
        }
      }
      paintStates(); paintSelection(); paintCurrent(); paintCollapsed();
    }

    function paintStates() {
      for (const [id, row] of rowEls) {
        const st = sb.states[id] || { label: "", cls: "none" };
        const s = row.childNodes[1];
        s.textContent = st.label;
        s.className = "sb-state sb-state-" + st.cls;
        row.dataset.state = st.cls;
      }
    }
    function paintSelection() {
      const sel = new Set(sb.selection);
      for (const [id, row] of rowEls) row.setAttribute("aria-selected", sel.has(id) ? "true" : "false");
      for (const [section, g] of groupEls) {
        const ids = groupIds(section);
        const n = ids.filter(id => sel.has(id)).length;
        g.head.dataset.selected = n === 0 ? "none" : n === ids.length ? "all" : "some";
      }
    }
    function paintCurrent() {
      for (const [id, row] of rowEls) row.setAttribute("aria-current", id === sb.current ? "true" : "false");
    }
    function paintCollapsed() {
      for (const [section, g] of groupEls) {
        const c = sb.collapsed.has(section);
        g.grp.dataset.collapsed = c ? "true" : "false";
        g.disc.textContent = c ? "▸" : "▾";
        g.disc.setAttribute("aria-expanded", c ? "false" : "true");
      }
    }

    // ------------------------------------------------------------ public
    sb.setBook = function (book) {
      sb.book = book || null;
      const ids = new Set(order());
      sb.selection = sb.selection.filter(id => ids.has(id));
      if (sb.anchor != null && !ids.has(sb.anchor)) sb.anchor = null;
      render();
      return sb;
    };
    sb.setStates = function (states) { sb.states = states || {}; paintStates(); return sb; };
    sb.setCurrent = function (id) {
      sb.current = id == null ? null : id;
      paintCurrent();
      const row = rowEls.get(sb.current);
      if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
      return sb;
    };
    sb.getSelection = function () { return sb.selection.slice(); };
    sb.select = function (ids) {
      const set = new Set(ids || []);
      setSel({ selection: order().filter(id => set.has(id)), anchor: (ids && ids[0]) || null });
      return sb;
    };
    sb.clearSelection = function () { setSel({ selection: [], anchor: null }); return sb; };
    sb.toggle = function (section, collapsed) {
      const next = collapsed == null ? !sb.collapsed.has(section) : !!collapsed;
      if (next) sb.collapsed.add(section); else sb.collapsed.delete(section);
      paintCollapsed();
      return sb;
    };
    sb.units = function () { return sb.selection.length ? sb.selection.slice() : (sb.current ? [sb.current] : []); };
    sb.push = function (mode) {
      const ids = sb.units();
      if (!ids.length) return sb;
      emit("push", ids, mode === "manual" ? "manual" : "auto");
      return sb;
    };
    sb.note = function (text) { sb.els.note.textContent = text || ""; sb.els.note.hidden = !text; return sb; };
    sb.neighbour = function (delta) {
      const o = order();
      const i = o.indexOf(sb.current);
      if (i < 0) return o[0] || null;
      const j = Math.max(0, Math.min(o.length - 1, i + delta));
      return o[j];
    };
    sb.on = function (name, fn) { if (handlers[name]) handlers[name].push(fn); return sb; };
    sb.off = function (name, fn) { if (handlers[name]) handlers[name] = handlers[name].filter(f => f !== fn); return sb; };
    sb.rowEl = function (id) { return rowEls.get(id) || null; };
    sb.destroy = function () {
      while (container.firstChild) container.removeChild(container.firstChild);
      rowEls.clear(); groupEls.clear();
      for (const k of Object.keys(handlers)) handlers[k] = [];
    };

    sb.note("");
    if (opts.book) sb.setBook(opts.book);
    if (opts.states) sb.setStates(opts.states);
    if (opts.current) sb.setCurrent(opts.current);
    return sb;
  }

  return { create, groupChapters, unitOrder, unitState, statesFrom, stateBookFromLocal,
           statesFromLocal, labelClass, applySelection };
});
