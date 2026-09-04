/* A popover: a small floating panel, rounded corners, no window chrome --
 * "the way a Mac app behaves" (Osca, 30 Aug; READER_FIRST.md "Osca's app
 * decisions"). Settings used to open `reader/settings.html` as a whole tab
 * (`f6cd316`) and Actions did not exist; both are popovers now, and neither
 * takes a tab.
 *
 * Three ways out, all of them the same way out:
 *   - **Esc**;
 *   - **a click outside** the panel (pointerdown, so it closes on the press
 *     that starts the click, before that click lands on whatever is under
 *     it);
 *   - **the keystroke that opened it** -- ⌘. for Actions, ⌘, for Settings.
 *     That one is the caller's: it binds the key to `toggle()`, not `open()`.
 *
 * What this component does NOT do: fetch, know what is inside it, or decide
 * whether an item is allowed. It owns a box and how it is dismissed. The
 * Settings body is `TTSTVSettings.mount()`'s; the Actions body is
 * `reader.html`'s.
 *
 * The CSS is injected once, from here, rather than living in two page
 * stylesheets that would drift -- and it is written entirely in the custom
 * properties both pages already define (`--panel-bg`, `--border`, `--fg`,
 * `--fg-dim`, `--accent`, `--control-bg`), with a literal fallback only for
 * `--bad`, which `reader.html` does not define.
 *
 * Not `<dialog>` and not the HTML popover attribute: a `<dialog>` is modal
 * furniture with its own backdrop and focus trap (wrong -- the reader keeps
 * playing behind this), and `popover=""` is too new to rely on in the
 * WKWebView the app ships and on the iOS Safari the phone shell runs in,
 * where there is no fallback to fall back to.
 */
(function (global) {
  "use strict";

  var STYLE_ID = "ttstv-popover-style";
  var CSS = [
    '.ttstv-pop {',
    '  position: fixed; z-index: 60; min-width: 240px; max-width: min(92vw, 420px);',
    '  max-height: min(78vh, 620px); overflow: auto; padding: 12px 14px 14px;',
    '  border-radius: 14px; border: 1px solid var(--border); background: var(--panel-bg);',
    '  color: var(--fg); box-shadow: 0 10px 34px rgba(0,0,0,0.24);',
    '  font-family: inherit; font-size: 0.9rem;',
    '}',
    '.ttstv-pop[hidden] { display: none; }',
    '.ttstv-pop-title {',
    '  margin: 0 0 8px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.09em;',
    '  text-transform: uppercase; color: var(--fg-dim);',
    '}',
    '.ttstv-pop-item {',
    '  display: flex; align-items: baseline; gap: 10px; width: 100%; text-align: left;',
    '  font: inherit; color: var(--fg); background: transparent; border: none;',
    '  border-radius: 9px; padding: 9px 10px; min-height: 38px; cursor: pointer;',
    '}',
    '.ttstv-pop-item:hover:not([disabled]), .ttstv-pop-item:focus-visible { background: var(--control-bg); outline: none; }',
    '.ttstv-pop-item[disabled] { color: var(--fg-dim); cursor: default; }',
    '.ttstv-pop-item .ttstv-pop-key { margin-left: auto; color: var(--fg-dim); font-size: 0.8rem; }',
    '.ttstv-pop-why { margin: -4px 0 6px 10px; font-size: 0.78rem; color: var(--fg-dim); }',
    '.ttstv-pop-note { margin: 8px 0 0; font-size: 0.78rem; color: var(--fg-dim); }',
    '.ttstv-pop-note.bad { color: var(--bad, #9c3b2e); }',
    // TTSTVSettings.mount()'s three fields, when a popover is their host.
    // settings.html has its own copy of these rules for the page it is; the
    // reader and the Library have no settings CSS at all, and this is where
    // the form gets it in both -- one place, not two.
    '.ttstv-pop .field { margin: 10px 0 0; }',
    '.ttstv-pop .field:first-child { margin-top: 0; }',
    '.ttstv-pop .field > .label { font-size: 0.8rem; font-weight: 600; margin-bottom: 5px; }',
    '.ttstv-pop .opts { display: flex; flex-wrap: wrap; gap: 5px; }',
    '.ttstv-pop .opts button {',
    '  font: inherit; font-size: 0.85rem; min-height: 36px; padding: 3px 10px; line-height: 1.15;',
    '  border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--fg);',
    '  cursor: pointer; display: inline-flex; flex-direction: column; align-items: center; justify-content: center;',
    '}',
    '.ttstv-pop .opts button .sub { font-size: 0.66rem; color: var(--fg-dim); }',
    '.ttstv-pop .opts button[aria-pressed="true"] {',
    '  border-color: var(--accent); background: var(--control-bg); color: var(--accent); font-weight: 600;',
    '}',
    '.ttstv-pop .opts button[aria-pressed="true"] .sub { color: var(--accent); }',
    '@media (max-width: 640px), (max-height: 500px) {',
    '  .ttstv-pop {',
    '    left: calc(10px + env(safe-area-inset-left, 0px)) !important;',
    '    right: calc(10px + env(safe-area-inset-right, 0px)) !important;',
    '    top: auto !important; bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;',
    '    max-width: none; border-radius: 16px;',
    '  }',
    '  .ttstv-pop-item { min-height: 46px; font-size: 1.02rem; }',
    '}',
  ].join("\n");

  function injectStyle(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent = CSS;
    (doc.head || doc.body || doc.documentElement).appendChild(st);
  }

  /* Pure. Where a panel of `size` goes for an `anchor` rect inside a
   * `viewport`, in the order a Mac menu tries: under the anchor and aligned
   * to its right edge, flipped above when there is no room below, and always
   * pulled back inside the window. Exported so the placement can be tested
   * without a layout engine (minidom has none). */
  function place(anchor, size, viewport, gap) {
    gap = gap == null ? 6 : gap;
    var vw = viewport.width, vh = viewport.height;
    var w = Math.min(size.width, vw - 2 * gap);
    var h = Math.min(size.height, vh - 2 * gap);
    if (!anchor) return { left: Math.max(gap, vw - w - gap), top: gap, width: w, height: h, flipped: false };
    var below = vh - anchor.bottom - gap;
    var above = anchor.top - gap;
    var flipped = below < h && above > below;
    var top = flipped ? anchor.top - gap - h : anchor.bottom + gap;
    var left = anchor.right - w;                       // right edges line up
    left = Math.max(gap, Math.min(left, vw - w - gap));
    top = Math.max(gap, Math.min(top, vh - h - gap));
    return { left: left, top: top, width: w, height: h, flipped: flipped };
  }

  function create(opts) {
    opts = opts || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;
    injectStyle(doc);

    var el = doc.createElement("div");
    el.className = "ttstv-pop" + (opts.className ? " " + opts.className : "");
    if (opts.id) el.id = opts.id;
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", opts.label || opts.title || "Panel");
    var titleEl = null;
    if (opts.title) {
      titleEl = doc.createElement("div");
      titleEl.className = "ttstv-pop-title";
      titleEl.textContent = opts.title;
      el.appendChild(titleEl);
    }
    var body = doc.createElement("div");
    body.className = "ttstv-pop-body";
    el.appendChild(body);
    (doc.body || doc.documentElement).appendChild(el);

    var open = false;

    function anchorEl() {
      return typeof opts.anchor === "function" ? opts.anchor() : (opts.anchor || null);
    }

    function anchorRect() {
      var a = anchorEl();
      if (!a || typeof a.getBoundingClientRect !== "function") return null;
      var r = a.getBoundingClientRect();
      // minidom answers zeroes; a zero rect is no rect, not the top-left corner
      if (!r || (!r.width && !r.height && !r.top && !r.left)) return null;
      return r;
    }

    function position() {
      var win = doc.defaultView || global;
      var vp = { width: win.innerWidth || 1024, height: win.innerHeight || 768 };
      var size = { width: el.offsetWidth || 300, height: el.offsetHeight || 240 };
      var p = place(anchorRect(), size, vp);
      el.style.left = p.left + "px";
      el.style.top = p.top + "px";
      return p;
    }

    var pop = {
      el: el, body: body,
      isOpen: function () { return open; },
      open: function () {
        if (open) { position(); return pop; }
        open = true;
        el.hidden = false;
        position();
        if (opts.onOpen) opts.onOpen(pop);
        var focusable = el.querySelectorAll("button, input, select, textarea, [href]");
        for (var i = 0; i < focusable.length; i++) {
          if (!focusable[i].disabled) { if (focusable[i].focus) focusable[i].focus(); break; }
        }
        return pop;
      },
      close: function () {
        if (!open) return pop;
        open = false;
        el.hidden = true;
        if (opts.onClose) opts.onClose(pop);
        if (opts.returnFocus) {
          var a = typeof opts.anchor === "function" ? opts.anchor() : opts.anchor;
          if (a && a.focus) a.focus();
        }
        return pop;
      },
      toggle: function () { return open ? pop.close() : pop.open(); },
      reposition: position,
      setTitle: function (t) { if (titleEl) titleEl.textContent = t; return pop; },
      destroy: function () {
        doc.removeEventListener("keydown", onKey, true);
        doc.removeEventListener("pointerdown", onDown, true);
        doc.removeEventListener("click", onDown, true);
        if (el.parentNode) el.parentNode.removeChild(el);
      },
    };

    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pop.close(); }
    }
    /* Capture phase, and on pointerdown as well as click: the press that
     * starts a click outside must close the panel *before* that click reaches
     * whatever is under it, so dismissing never also opens a book. `click` is
     * bound too because a keyboard-driven click sends no pointer event.
     *
     * The anchor is exempt, and has to be: its own handler calls `toggle()`,
     * so a click-outside that closed first would be followed by a toggle that
     * opened again -- the button would look dead. Closing on the anchor is
     * `toggle()`'s job, once. */
    function onDown(e) {
      if (!open) return;
      var t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (t.closest(".ttstv-pop") === el) return;
      var a = anchorEl();
      if (a && typeof a.contains === "function" && (a === t || a.contains(t))) return;
      if (opts.ignore && t.closest(opts.ignore)) return;
      pop.close();
    }
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("pointerdown", onDown, true);
    doc.addEventListener("click", onDown, true);

    return pop;
  }

  /* One row of an Actions-style list. `why` is the whole point of the
   * disabled state: a greyed item that does not say why it is grey is a bug
   * report waiting to be filed. */
  function item(doc, spec) {
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "ttstv-pop-item";
    b.dataset.act = spec.id;
    var label = doc.createElement("span");
    label.textContent = spec.label;
    b.appendChild(label);
    if (spec.key) {
      var k = doc.createElement("span");
      k.className = "ttstv-pop-key";
      k.textContent = spec.key;
      b.appendChild(k);
    }
    if (spec.why) {
      b.disabled = true;
      b.title = spec.why;
      b.setAttribute("aria-disabled", "true");
    }
    return b;
  }

  global.TTSTVPopover = { create: create, place: place, item: item, CSS: CSS, STYLE_ID: STYLE_ID };
})(typeof window !== "undefined" ? window : globalThis);
