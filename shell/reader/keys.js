/* ====================== TYPING IS NOT A HOTKEY ===========================
 * While the caret is in a field, the keyboard belongs to the field. Nothing
 * else may act on a bare key -- not "l" for light and dark, not "s", not an
 * arrow, not the space bar.
 *
 * There was no guard anywhere in this application. Fifteen places bind a
 * keydown on document or window and every one of them fires while you type,
 * which is survivable only while nothing on the page takes text. The moment
 * a search bar exists it is unusable: typing "look" toggles the theme twice
 * and turns two pages.
 *
 * WHY IT ATTACHES TO THE FIELD AND NOT TO document. A capture listener on
 * document runs BEFORE the field's own listeners, so stopping propagation
 * there would kill the field too -- Enter in the find bar, Escape in a note.
 * Attaching on focus to the focused element instead means the element's own
 * listeners still run (listeners on the same node are never skipped by
 * stopPropagation), and the event simply never reaches document or window.
 * One rule, no cooperation required, and nothing else in the app has to know
 * this file exists.
 *
 * WHAT STILL GETS THROUGH, deliberately:
 *   Cmd/Ctrl combos     -- Cmd-F, Cmd-Tab, Cmd-, and the rest are commands,
 *                          not typing, and they are what you reach for WHILE
 *                          typing to get out again
 *   Escape              -- the way out of every field, and it must reach the
 *                          thing that opened it
 *   Tab and Shift-Tab   -- focus is the browser's, not ours
 * Everything else stops at the field.
 */
(function () {
  "use strict";

  function editable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    var t = el.tagName;
    if (t === "TEXTAREA" || t === "SELECT") return true;
    if (t !== "INPUT") return false;
    /* a checkbox or a button is not typing: a bare key over one of those is
       still a hotkey, which is what makes the space bar work on a toggle */
    return !/^(button|checkbox|radio|range|submit|reset|file|image|color)$/i
             .test(el.type || "text");
  }

  function passes(e) {
    if (e.key === "Escape" || e.key === "Tab") return true;
    if ((e.metaKey || e.ctrlKey) && !e.altKey) return true;
    return false;
  }

  function stop(e) { if (!passes(e)) e.stopPropagation(); }

  function watch(el) {
    if (!el || el.__keysGuarded) return;
    el.__keysGuarded = true;
    el.addEventListener("keydown", stop);
    el.addEventListener("keypress", stop);
    el.addEventListener("keyup", stop);
    el.addEventListener("focusout", function once() {
      el.removeEventListener("keydown", stop);
      el.removeEventListener("keypress", stop);
      el.removeEventListener("keyup", stop);
      el.removeEventListener("focusout", once);
      el.__keysGuarded = false;
    });
  }

  addEventListener("focusin", function (e) { if (editable(e.target)) watch(e.target); }, true);
  /* a field already focused when this loads -- autofocus, or a restored one */
  if (editable(document.activeElement)) watch(document.activeElement);

  window.TTSTVKeys = { editable: editable, typing: function () {
    return editable(document.activeElement);
  } };
})();
