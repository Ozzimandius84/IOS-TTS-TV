/* THE SETTINGS FORM -- this surface's own half, and the only page that loads
 * it is `settings/settings.html`.
 *
 * The tab strip and the six tabs, every field in them, the Cloud GPU cards
 * (Kaggle and Modal), the Models section, the Languages tab, the Hotkeys
 * tab, this window's own CSS, and the measure that makes the window fit the
 * open tab.  Cut out of `reader/settings.js` by module-split Stage 4, 5 Sep,
 * which found 203 KB doing two jobs: this one, and the application-wide
 * preferences store four pages load before they paint.
 *
 * **It MOUNTS the root, and the contract runs one way.**  The store, the
 * theme, the interface font and the hotkey grammar are `prefs/prefs.js`'s --
 * a root with four consumers, of which this page is one -- and this file
 * reaches them through `window.TTSTVSettings`, never the other way round.
 * The alias block below is that contract written out: every name this file
 * takes from the root, in one place, so what the form depends on can be read
 * in twenty lines instead of grepped for.  `prefs/prefs.js` names nothing in
 * here and must not.
 *
 * **The same object.**  The form's half is added onto `window.TTSTVSettings`
 * rather than a second global, because `settings.html` and eight tests call
 * `TTSTVSettings.mount` / `.TABS` / `.kaggleLines` beside `TTSTVSettings.read`
 * and would otherwise have to know which half a name is in.  The page loads
 * `../prefs/prefs.js` first and this file second; loading this one alone is
 * an error and says so on the first line, rather than half-building a form
 * with no store under it.
 */
(function (global) {
  "use strict";

  /* THE ROOT, AND THE ONE DIRECTION. `prefs/prefs.js` has run already (the
   * page loads it first, in the <head>, before first paint) and owns the
   * store, the theme, the interface font and the hotkey grammar. Everything
   * this file borrows from it is named here and nowhere else, so the form's
   * whole dependency on the root is twenty lines rather than a grep -- and
   * so the day a name changes there, this list is what fails to resolve.
   *
   * Loud, not lenient: a form with no store under it would draw controls
   * that save nothing, which is worse than a page that says why it is
   * empty. */
  var ROOT = global.TTSTVSettings;
  if (!ROOT || typeof ROOT.read !== "function") {
    throw new Error("settings/settings.js needs prefs/prefs.js, which must load first");
  }

  // the vocabulary the fields are made of
  var DEFAULTS = ROOT.DEFAULTS, SIZES = ROOT.SIZES, LINES = ROOT.LINES,
      VIEWS = ROOT.VIEWS, SIDEBARS = ROOT.SIDEBARS, WARMTHS = ROOT.WARMTHS,
      WPM = ROOT.WPM, facesNow = ROOT.facesNow,
      // the hands-free four (5 Sep): the stops the window slider offers.
      // `LISTEN_WINDOWS` is the store's, like `SIZES` and `LINES` -- this
      // file names no number of its own.
      LISTEN_WINDOWS = ROOT.LISTEN_WINDOWS;
  // the store, and the two pure functions the form paints through
  var read = ROOT.read, save = ROOT.save, subscribe = ROOT.subscribe,
      apply = ROOT.apply, normalise = ROOT.normalise, clamp = ROOT.clamp,
      origin = ROOT.origin;
  // the hotkey grammar and table, for the Hotkeys tab
  var HOTKEY_GROUPS = ROOT.HOTKEY_GROUPS, HOST_GROUP = ROOT.HOST_GROUP,
      hostHotkeyDefs = ROOT.hostHotkeyDefs, setHostHotkeys = ROOT.setHostHotkeys,
      allHotkeys = ROOT.allHotkeys, hotkeyById = ROOT.hotkeyById,
      hotkeysNow = ROOT.hotkeysNow, hotkeyCollisions = ROOT.hotkeyCollisions,
      setHotkey = ROOT.setHotkey, resetHotkey = ROOT.resetHotkey,
      resetHotkeys = ROOT.resetHotkeys, comboOf = ROOT.comboOf, keyCap = ROOT.keyCap;

  // the fields whose value is a string rather than a number -- the form
  // reads every option out of a `data-value` attribute, which is text
  var TEXT_FIELDS = ["family", "uiFamily", "view", "theme", "sidebar", "micDevice"];
  /* The one kind of field this window had never had. Every control here is
   * made of `.opts button[data-value]`, and a `data-*` value is a STRING --
   * so a field's kind is what says how to read it back. `resume` is a
   * boolean because `DEFAULTS.resume` is one; `sidebar` is a word, so it
   * joins TEXT_FIELDS. `fieldValue` below is the one place that decides. */
  var BOOL_FIELDS = ["resume", "touchOff"];
  function fieldValue(field, raw) {
    if (BOOL_FIELDS.indexOf(field) >= 0) return raw === "true" || raw === true;
    if (TEXT_FIELDS.indexOf(field) >= 0) return raw;
    return Number(raw);
  }
  /* ================================== THE WINDOW FITS THE TAB (Osca, 1 Sep)
   * *"`settingswin.rs::host_settings_height` is built and resizes the window
   * to whatever the page reports, but `reader/settings.js` never called it,
   * so Settings stays 620 px and General floats in empty space. On mount and
   * every tab switch, measure the active tab panel's content height (its
   * `scrollHeight` plus the tab-row and padding) and call the host."*
   *
   * WHAT WAS ACTUALLY THERE, since it is not nothing: `settings.html` had a
   * `reportHeight()` of its own, wired to this form's `onTab`. It measured
   * `#status.getBoundingClientRect().bottom`, which is the wrong quantity in
   * two ways -- it is a VIEWPORT coordinate, so once `main` has scrolled it
   * reports where the end of the content currently *appears* rather than how
   * tall the content *is*; and `#status` is an empty `role="status"` div, so
   * on a tab that fits it reports the bottom of a zero-height box and on one
   * that does not it reports a number that shrinks as you scroll. The window
   * therefore never got a figure it could size itself by.
   *
   * The measure belongs here rather than in the page because this is where a
   * tab change happens (`showTab`), and because the panel is this file's
   * element: the page cannot ask "how tall is the open tab" without reaching
   * into a class it does not own.
   *
   * The route is unchanged and is the one `host.js` exposes:
   * `TTSTVHost.settingsHeight(h)` -> `invoke("host_settings_height", …)`.
   * Guarded on the method, so a plain browser tab, the phone and the load
   * harness are all a no-op that costs one property read. */
  function tabHeight(el, doc) {
    var root = el && el.querySelector ? el : null;
    if (!root) return 0;
    // `:not([hidden])` is deliberately NOT used: the node harness's mini-DOM
    // throws on a `:not(...)` selector rather than answering it, and a
    // measure that only works in a browser cannot be tested at all.
    var panels = root.querySelectorAll(".set-panel");
    var panel = null;
    for (var pi = 0; pi < panels.length; pi++) {
      if (!panels[pi].hidden) { panel = panels[pi]; break; }
    }
    if (!panel) return 0;
    var d = doc || root.ownerDocument || global.document;
    var view = (d && d.defaultView) || global;
    var css = view && view.getComputedStyle ? function (n) { return view.getComputedStyle(n); } : null;
    // the panel's own content, which is what changes from tab to tab
    var h = panel.scrollHeight || 0;
    // the tab row: in this window it is the title bar, and it is outside main
    var bar = d.querySelector ? (d.querySelector(".set-titlebar") || d.querySelector(".set-tabs")) : null;
    if (bar) h += bar.offsetHeight || 0;
    // main's padding, and whatever else the page keeps in there beside the
    // panels -- `settings.html`'s status line is the only one today, and it
    // is what says "saved" under a tab that has just been changed.
    //
    // ONLY WHAT IS BESIDE THE PANEL, never what CONTAINS it. `#fields` is a
    // child of main and the panels live inside it, so counting main's element
    // children naively adds the whole form on top of the one panel and every
    // tab comes back roughly twice its size (General reported 701 for 381 px
    // of content). The panel's own ancestors are walked first and skipped.
    var main = panel.parentNode;
    var inside = [];
    while (main && main.tagName && main.tagName.toLowerCase() !== "main") {
      inside.push(main);
      main = main.parentNode;
    }
    if (main) {
      if (css) {
        var cs = css(main);
        h += (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      }
      var kids = main.childNodes || [];
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (!k || k.nodeType !== 1 || k === panel || k.hidden) continue;
        if (k.classList && k.classList.contains("set-panel")) continue;
        if (inside.indexOf(k) >= 0) continue;   // an ancestor, not a neighbour
        h += k.offsetHeight || 0;
      }
    }
    return Math.ceil(h);
  }

  /* Measure and tell the host. Returns the number sent, or 0 when there is
   * no host to tell -- which is what the tests read, so the arithmetic can
   * be proven without a window to resize. */
  function reportHeight(el, doc) {
    var h = tabHeight(el, doc);
    if (!h) return 0;
    var host = global.TTSTVHost;
    if (!host || typeof host.settingsHeight !== "function") return 0;
    try { host.settingsHeight(h); } catch (e) { return 0; }
    return h;
  }

  /* AFTER A FRAME, always. A tab is shown by unhiding a panel, and a panel
   * that was hidden a microsecond ago has no laid-out height yet; measuring
   * in the same turn reports the tab you just LEFT. `settings.html`'s old
   * hook had this right and it is kept. */
  function reportHeightSoon(el, doc) {
    var raf = global.requestAnimationFrame;
    if (typeof raf !== "function") return reportHeight(el, doc);
    raf(function () { reportHeight(el, doc); });
    return -1;
  }
  /* ------------------------------------------------------------- the form
   *
   * The three controls, built into whatever element you hand it. Added
   * 30 Aug: Settings stopped being a tab (Osca, READER_FIRST.md "Neither
   * Actions nor Settings opens a tab") and became a popover in `reader.html`
   * and in `library.html`, so the same form now has three homes. It is built
   * here, once, rather than copied into each of them -- this module already
   * owns the vocabulary (FAMILIES / SIZES / LINES) the form is made of, and a
   * second copy of it would drift the first time the reader gains a font.
   *
   * `settings.html` keeps its own headings, hint and preview and calls this
   * for the fields; the popovers call it for everything. What it does not
   * own: the page's stylesheet. The class names are `settings.html`'s
   * existing ones (`.field`, `.label`, `.opts`), and `popover.js` supplies
   * rules for them where a popover is the host -- nothing here styles
   * anything itself.
   *
   * Persistence is unchanged and shared: `save()` above, i.e. localStorage
   * plus the `/reader-settings` mirror -- a choice made in the reader's
   * popover is the same choice the Settings page and the phone read. */
  /* ---------------------------------------------------------------- tabs
   * Osca, 30 Aug: "the settings window ... needs tabs inside it, model it
   * after the safari settings tab."
   *
   * A Safari settings sheet is a row of icon-over-label tabs across the top
   * and one panel below, and the reason it works is that the row is the whole
   * map: you can see every place a preference could be before you have opened
   * any of them. So the tabs are DECLARED here, one line per tab naming the
   * fields it holds, rather than being drawn by hand -- a new preference is a
   * field in this table and nothing else has to change.
   *
   * `sub` is the Safari touch that matters most and is easiest to skip: each
   * tab says what it is FOR, so the row reads as a sentence rather than as
   * four nouns. */
  /* ==================================================== THE HOTKEYS TAB
   * The picture: two grouped cards, Reader and Application, a row per action
   * -- name on the left, the key on the right as a key-cap. Click a cap and
   * it waits for a key; the next press is the binding. `Reset` appears in a
   * row only once that row is not the default, and `Reset all` under the
   * list only once something is.
   *
   * It is built out of the same `kEl` and the same `.set-row` the other tabs
   * use, so it inherits the card, the rule between rows and the two type
   * sizes without owning any of them. What it adds is the cap and the
   * capture, and that is all it adds.
   *
   * The capture listens on the DOCUMENT in the CAPTURE PHASE, and this is not
   * fussiness: `Mod+,` is a binding you may want to change, and if the press
   * reached the page normally the Settings window's own ⌘, handler would
   * answer it first. Every press while a cap is armed is swallowed --
   * `preventDefault` and `stopPropagation` -- so nothing else in the app can
   * see the key you are in the middle of assigning. Escape cancels; a press
   * that is only a modifier is ignored and the field keeps waiting.        */
  /* THE HOTKEYS TAB -- and, since 5 Sep, ONE ROW OF IT SOMEWHERE ELSE.
   *
   * `opts.only` is a list of ids to draw and `opts.bare` says the caller has
   * already made the card: together they let the Voice group's Trigger row be
   * THE `mic` row from this table rather than a second one drawn beside it.
   * That matters more than it looks. A cap is not markup -- it is a click that
   * arms a capture, a `keydown` that becomes a combo, `setHotkey`, the store,
   * the collision note naming the other action, and Reset. A second copy of
   * that in the Voice panel would be a second thing to keep in step with this
   * one, and the first remap made in the wrong one of them would be the bug.
   * So there is one builder, and the Voice group calls it with a list of one.
   *
   * `bare` also skips `setHostHotkeys`: the host's rows belong to the tab that
   * draws the App section, and registering them twice from two callers is a
   * race for no gain. `allHotkeys()` still answers with whatever the tab
   * registered, which is where `mic` -- a reader row -- comes from either way. */
  function buildHotkeysPanel(panel, ctx, opts) {
    var doc = panel.ownerDocument;
    opts = opts || {};
    var only = opts.only || null;
    var bare = !!opts.bare;
    var rows = {};      // id -> { caps: [button], note, reset }
    var arming = null;  // { id, index, btn } while a cap is waiting
    var wrap = bare ? panel : kEl(doc, "div", "hk");
    if (!bare) panel.appendChild(wrap);

    /* Ask the host once, here, and register what it says before a single row
     * is drawn -- everything below (`hotkeysNow`, the collisions, the store's
     * own `normaliseKeys`) reads `allHotkeys()`, and a host row that arrived
     * after the first read would be pruned out of the store as an unknown id.
     * `opts.host` is the tests' door; a page passes nothing.
     *
     * THE RETURN, not the variable (Stage 4). `setHostHotkeys` REASSIGNS the
     * root's own `HOST_HOTKEYS`, so a name aliased into this file at load
     * would still be the empty array it was before this call -- the one live
     * binding the cut could not carry across a file boundary. It returns what
     * it just registered, which is the same list and cannot go stale. */
    var HOST_ROWS = bare ? [] : setHostHotkeys(hostHotkeyDefs(opts.host));
    var GROUPS = HOST_ROWS.length ? HOTKEY_GROUPS.concat([HOST_GROUP]) : HOTKEY_GROUPS;
    var ROWS = allHotkeys();

    GROUPS.forEach(function (g) {
      var head = kEl(doc, "div", "set-head", g.label);
      // bare: the caller's card IS the container, and its rows go straight in
      var card = bare ? panel : kEl(doc, "div", "set-card");
      var any = false;
      ROWS.forEach(function (h) {
        if (h.group !== g.id) return;
        if (only && only.indexOf(h.id) < 0) return;
        any = true;
        var row = kEl(doc, "div", "set-row hk-row");
        row.dataset.hotkey = h.id;
        var left = kEl(doc, "div", "set-l");
        left.appendChild(kEl(doc, "div", "set-name", h.label));
        if (h.sub) left.appendChild(kEl(doc, "small", null, h.sub));
        var note = kEl(doc, "small", "hk-note", "");
        left.appendChild(note);
        row.appendChild(left);

        var right = kEl(doc, "div", "set-c hk-caps");
        var caps = h.defs.map(function (_, i) {
          var b = doc.createElement("button");
          b.type = "button";
          b.className = "hk-cap";
          b.dataset.hotkey = h.id;
          b.dataset.index = String(i);
          if (h.fixed) {
            b.disabled = true;
            b.title = h.fixed;
            b.className += " hk-fixed";
          }
          right.appendChild(b);
          return b;
        });
        var reset = doc.createElement("button");
        reset.type = "button";
        reset.className = "hk-reset";
        reset.textContent = "Reset";
        reset.dataset.reset = h.id;
        reset.hidden = true;
        right.appendChild(reset);
        row.appendChild(right);
        card.appendChild(row);
        rows[h.id] = { caps: caps, note: note, reset: reset };
      });
      if (!any || bare) return;   // bare: the rows are already in the card
      wrap.appendChild(head);
      wrap.appendChild(card);
    });

    var foot = kEl(doc, "div", "set-note hk-foot", "");
    var tell = kEl(doc, "span", null, "Click a key and press a new one to change it. ");
    var all = doc.createElement("button");
    all.type = "button";
    all.className = "hk-resetall";
    all.textContent = "Reset all";
    all.hidden = true;
    foot.appendChild(tell);
    foot.appendChild(all);
    // no foot on a card of one row: "Click a key and press a new one" belongs
    // under a list of keys, and Reset all under one row would reset the lot
    if (!bare) wrap.appendChild(foot);

    /* One painter, from the store, and it is the ONLY thing that writes a
     * cap: an assignment saves and the subscription paints, so a remap made
     * in another window lands here without this panel knowing it happened. */
    function paintKeys(s) {
      var map = hotkeysNow(s);
      var clash = hotkeyCollisions(map);
      var stored = normalise(s === undefined ? read() : s).keys;
      var anyChanged = false;
      ROWS.forEach(function (h) {
        var r = rows[h.id];
        if (!r) return;
        var combos = h.fixed ? h.defs : map[h.id];
        var changed = !h.fixed && Object.prototype.hasOwnProperty.call(stored, h.id);
        if (changed) anyChanged = true;
        r.caps.forEach(function (b, i) {
          if (arming && arming.id === h.id && arming.index === i) return;  // mid-capture
          b.textContent = keyCap(combos[i]);
          b.dataset.combo = combos[i];
          b.classList.toggle("hk-changed", changed);
        });
        r.reset.hidden = !changed;
        // the collision, IN THE ROW -- named, so it is a fact and not a
        // warning triangle
        var said = [];
        combos.forEach(function (c) {
          if (!clash[c]) return;
          var others = clash[c].filter(function (id) { return id !== h.id; })
            .map(function (id) { var o = hotkeyById(id); return o ? o.label : id; });
          if (others.length) said.push(keyCap(c) + " is also " + others.join(", "));
        });
        r.note.textContent = said.join("; ");
        r.note.hidden = !said.length;
      });
      all.hidden = !anyChanged;
      return map;
    }

    function stopArming(paint) {
      if (!arming) return;
      var was = arming;
      arming = null;
      if (doc.removeEventListener) doc.removeEventListener("keydown", onCapture, true);
      was.btn.classList.remove("hk-arming");
      if (paint !== false) paintKeys();
    }

    function onCapture(e) {
      if (!arming) return;
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      var combo = comboOf(e);
      if (!combo) return;                       // a bare modifier: keep waiting
      var id = arming.id, index = arming.index;
      if (combo === "Escape") { stopArming(); return; }
      stopArming(false);
      setHotkey(id, index, combo).then(function () { paintKeys(); });
    }

    wrap.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var cap = t.closest(".hk-cap");
      if (cap && !cap.disabled) {
        if (arming && arming.btn === cap) { stopArming(); return; }
        stopArming();
        arming = { id: cap.dataset.hotkey, index: Number(cap.dataset.index), btn: cap };
        cap.classList.add("hk-arming");
        cap.textContent = "Press a key…";
        if (doc.addEventListener) doc.addEventListener("keydown", onCapture, true);
        return;
      }
      var one = t.closest(".hk-reset");
      if (one) { stopArming(false); resetHotkey(one.dataset.reset).then(function () { paintKeys(); }); return; }
      if (t.closest(".hk-resetall")) { stopArming(false); resetHotkeys().then(function () { paintKeys(); }); }
    });

    paintKeys(opts.settings);
    return { paint: paintKeys, rows: rows, resetAll: all,
             get arming() { return arming ? arming.id : null; },
             cancel: function () { stopArming(); } };
  }

  /* THE SIX (Osca, 31 Aug, second sitting): **General · Reading · Cloud GPU ·
   * Models · Languages · Hotkeys.**
   *
   * The third one was called Kaggle until 2 Sep, when it stopped being about
   * one box (`PROMPTS/cloud-gpu-tab.md`): it is where a render's machine is
   * chosen, and there are two of them. Its ID changed with its name, which
   * matters in exactly one place -- `TAB_KEY` remembers the open tab across
   * visits, and `mount` already checks the remembered id against the list and
   * falls to the first tab when it is not one of them. So a person who left
   * Settings on `kaggle` opens on General once, and never again.
   *
   * General first because it is the app, Reading second because it is the
   * book, then the three things this Mac can reach, then the keyboard.
   *
   * **The shape changed on 31 Aug and the shape is the point** (the mock Osca
   * approved, `PROMPTS/mock/settings.html`): the icon tabs are Safari's, in
   * the title bar; under them **every setting is a ROW inside a grouped
   * card** -- its name, and a line of grey explanation where it earns one, on
   * the left; the control on the right -- with a small-caps heading above each
   * card. Nothing else on the page. The old layout stacked a bold label over a
   * wrapping wall of pills, which read as a form to fill in rather than a
   * list of choices to glance down.
   *
   * So a tab is now a list of CARDS and a card a list of ROWS, and `control`
   * says which of the five shapes a row's control takes -- `seg` (two or
   * three choices, a segmented pill), `menu` (more than three, a menu),
   * `faces` (the reading faces, each tile drawn in its own face), `slider`
   * (a discrete scale with the value beside it) and `range` (a continuous
   * one). A new preference is still one line in this table and nothing else.
   *
   * **One word stays folded into Reading**, as `reader-ui-final` decided and
   * the mock draws: it is a way of reading a page, which is what that tab is
   * about.
   *
   * Cloud GPU, Models and Languages are CONDITIONAL: all three are studio's
   * data, so on a phone, in an exported bundle or over file:// there is
   * nothing behind them and they are not drawn at all. Hotkeys is NOT
   * conditional -- the keys are the reader's own and work with no server
   * behind the page.
   *
   * NO THEME ROW (Osca, 31 Aug): "light/dark setting does not need to be
   * present at all in the settings window". It lives on the strip's toggle
   * and on Mod+Shift+L, which is where you reach for it. The `theme` FIELD
   * is untouched -- the store, `themeNow`, `setTheme`, `mountThemeButton`
   * and the Hotkeys row are all exactly as they were; only the control on
   * this window is gone, and with it the moon in the corner.               */
  /* ============================== THE VOICE GROUP'S ROWS (Osca, 5 Sep 21:15)
   * *"we need to add mic settings and the touch-off toggle."*
   *
   * **It is a GROUP, not an eighth tab, and that was arithmetic rather than
   * taste.** The strip is `width: 62px` a tab with a 2 px gap, and
   * `settings.html` reserves 80 px at each end of a 560 px window for the
   * traffic lights -- 400 px of room. Seven tabs are 7x62 + 6x2 = 446 already;
   * an eighth would be 510, and the only way to fit either is to make every
   * tab narrower than the picture draws it. So Voice is the TOP group of
   * General -- above Appearance, because a microphone is a thing about this
   * machine and a font is a thing about the page.
   *
   * The four rows are the four facts `voiceui/` has had since 5 Sep with no
   * row anywhere: the microphone, the trigger, the length of the listening
   * window, and pocket mode. None of it is new behaviour -- every default here
   * is what the layer already did -- it is the first place a person can see or
   * change any of it.
   *
   * `trigger` is the odd one. On a Mac the row is THE `mic` row from `prefs/`'s
   * hotkey table, drawn by `buildHotkeysPanel` with a list of one, so a remap
   * made here is the same click, the same store and the same collision note as
   * a remap made in the Hotkeys tab -- one row, in two places, not two rows.
   * On a phone there is no key to draw: the trigger is an AirPods double-tap,
   * a headset button no binding table could hold, so the row states it and is
   * not editable. That is `control: "fixed"`, and it is the only row in this
   * window whose right-hand side is a fact rather than a control. */
  var VOICE_ROWS = {
    mic: { field: "micDevice", label: "Microphone", control: "mic",
           sub: "What the hands-free layer listens through." },
    airpods: { field: "trigger", label: "Trigger", control: "fixed",
               text: "AirPods: double-tap",
               sub: "A double-tap opens the listening window. There is no key "
                  + "to change on a phone." },
    /* NO GREY LINE ON THIS ROW, and that is the picture's rule rather than an
     * omission: a slider row is a SHORT NAME AND A LONG RULER (`Size`, `Line
     * height` and `Pace` are the three that were here before it, and not one
     * of them carries a sub). The CSS gives those rows a fixed 90 px name
     * column so their three tracks start at one x; a two-line explanation in
     * that column would either push the ruler off the row or take the column
     * back and leave a 16 px stub where the ruler should be. What the row
     * gives up is the card's note below, which is where a sentence about the
     * whole group belongs anyway. */
    window: { field: "listenWindow", label: "Listening window", control: "slider" },
    // the one sentence the group needs and no single row owns
    note: "Test opens the listening window once and prints what it heard. "
        + "Silence in it is a plain \u201cWhat?\u201d",
    touch: { field: "touchOff", label: "Touch off", control: "seg",
             sub: "The screen goes black and every touch is swallowed, so the "
                + "phone can go in a pocket. Hold the bottom-left corner for "
                + "1.2 s to come back." },
  };

  var TABS = [
    { id: "general", label: "General", sub: "the app itself",
      cards: [
        { head: "Appearance", rows: [
          { field: "uiFamily", label: "Interface font", control: "menu",
            sub: "The app's own text — sidebars, menus, this window. Never the book." },
        ] },
        /* THE MOCK'S OTHER TWO ROWS (reader-sweep §4). Reported absent twice
         * because each needed a new stored field; both fields now exist, and
         * both default to what the reader already did. */
        { head: "Opening a book", rows: [
          { field: "resume", label: "Open books where you left them", control: "seg",
            sub: "The chapter and the word you stopped at, per book." },
          { field: "sidebar", label: "Sidebar", control: "seg",
            sub: "How the chapter list starts. Hiding it in a reader still sticks on that device." },
        ] },
      ],
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>'
        + '<path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2'
        + 'M6.6 6.6 5 5M19 19l-1.6-1.6M17.4 6.6 19 5M5 19l1.6-1.6"'
        + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { id: "reading", label: "Reading", sub: "the page's type",
      cards: [
        { head: "Type", bare: true, rows: [
          { field: "family", label: "Reading font", control: "faces",
            note: "A book can keep its own font; this is the default for the rest." },
        ] },
        { head: "Size & spacing", rows: [
          { field: "size", label: "Size", control: "slider" },
          { field: "line", label: "Line height", control: "slider" },
        ] },
        /* THE PAPER, AND THE LIGHT IT IS READ BY (Osca, 5 Sep: *"another
         * dropdown ... for warmth and toggle light/dark? Or in the settings
         * window, nice and easy? Probably in settings. So it goes to
         * everything else straight away?"* -- and it does: this store is the
         * one owner, and every surface follows it with no reload).
         *
         * Light/dark is BACK HERE, and that reverses a call made on 31 August
         * ("Light/dark is no longer in Settings; this icon and Cmd+Shift+L are
         * where it lives"). Reversed on the asking, and it costs nothing that
         * rule was protecting: the strip's toggle, the key and this row are
         * three doors onto ONE store, which was always the thing that
         * mattered. What that call was really against was a second COPY of
         * the value, and there still is not one. */
        { head: "The paper", rows: [
          { field: "warmth", label: "Warmth", control: "slider",
            sub: "Ground and ink together, so paper and ink never drift apart." },
          { field: "theme", label: "Light / dark", control: "seg",
            sub: "The whole application, every window. \u2318\u21e7L, and the \u25d0 in the bar." },
        ] },
        { head: "One word", rows: [
          { field: "view", label: "View", control: "seg" },
          { field: "wpm", label: "Pace", control: "range" },
        ] },
      ],
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<path d="M4 19.2a2.4 2.4 0 0 1 2.4-2.4H20" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M6.4 2.6H20v19.2H6.4A2.4 2.4 0 0 1 4 19.4V5A2.4 2.4 0 0 1 6.4 2.6z"'
        + ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
    /* ONE TAB, TWO CARDS (Osca, 2 Sep): *"once it's connected in the
     * settings/kaggle tab, which should be renamed, simply like cloud GPU
     * (settings tab) -- and we just add Modal, like we've added Kaggle, put
     * your key in etc."* `buildCloudPanel` is the two builders and nothing
     * else; the cards do not know about each other. */
    { id: "cloud", label: "Cloud GPU", sub: "where renders run",
      cards: [], build: buildCloudPanel, needsStudio: true,
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<path d="M17.4 19a4.5 4.5 0 0 0 .9-8.9A7 7 0 0 0 5 9.2 4 4 0 0 0 6 17h11.4z"'
        + ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
    /* DRAWN ON THE PHONE TOO (job 26, 6 Sep): the one tab whose contents
     * are not studio's data alone -- on a phone it is where the Sync button
     * lives and where a Studio is paired, so `needsStudio` is false here and
     * the builder asks `origin()` itself for which half it is. */
    { id: "transfer", label: "Transfer", sub: "moving books between your devices",
      cards: [], build: buildTransferPanel, needsStudio: false,
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<path d="M7 8h11m0 0-3.2-3.2M18 8l-3.2 3.2" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M17 16H6m0 0 3.2-3.2M6 16l3.2 3.2" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    { id: "models", label: "Models", sub: "the voices",
      cards: [], build: buildModelsSection, needsStudio: true,
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<path d="M12 3.6 20 8v8l-8 4.4L4 16V8Z" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linejoin="round"/>'
        + '<path d="M12 12.2 20 8M12 12.2 4 8M12 12.2v8.2" fill="none"'
        + ' stroke="currentColor" stroke-width="1.3" opacity=".6"/></svg>' },
    { id: "languages", label: "Languages", sub: "what a book is in",
      cards: [], build: buildLanguagesPanel, needsStudio: true,
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="1.6"/>'
        + '<path d="M2.6 12h18.8M12 2.6a15 15 0 0 1 0 18.8M12 2.6a15 15 0 0 0 0 18.8"'
        + ' fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' },
    { id: "hotkeys", label: "Hotkeys", sub: "every key",
      cards: [], build: buildHotkeysPanel,
      icon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
        + '<rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2.2" fill="none"'
        + ' stroke="currentColor" stroke-width="1.6"/>'
        + '<path d="M6.4 10.2h.01M10 10.2h.01M13.6 10.2h.01M17.4 10.2h.01M8.4 14h7.2"'
        + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
  ];

  /* ================================ THE CLOUD GPU TAB, CARD ONE: KAGGLE
   * Osca, 31 Aug: "One of the settings should be Kaggle settings -- where you
   * put your Kaggle key."
   *
   * Every fact on this panel is STUDIO'S, served by `GET /kaggle`
   * (studio/README.md, render-in-app 6.2): `connected`, `username`,
   * `credentials_present`, `quota {hours_left, hours_used, hours_total,
   * reset}`, `slots {limit, used, free, known, kernels[], unseen}`,
   * `settings {render:{where}, ...}` and `destinations`. The reader stores
   * none of it and computes none of it -- this file draws what studio says
   * and posts back the two things a person can change here.
   *
   * ------------------------------------------------------- AND THE KEY
   * studio's sign-in route runs the CLI's own login and "no route accepts a
   * token"; Osca's ask is a place to PUT the key. Those are reconcilable in
   * exactly one way that adds no new home for a secret:
   *
   *   a username and a key, typed once, POSTed once to studio, written by
   *   studio into `~/.kaggle/kaggle.json` at mode 0600 -- the file the
   *   `kaggle` CLI itself reads -- and never sent back, never displayed
   *   again, never logged, never stored anywhere else.
   *
   * So the app gains no store of its own for a credential: it gains a form
   * that fills in the file the tool was already reading. This file writes
   * nothing about a key anywhere; the page posts it once and forgets it, and
   * the field is cleared in the same statement that reads it (`take()`).
   * Nothing here ever puts a key in a status line, a title, a dataset
   * attribute or a report.
   *
   * The route is `POST /kaggle-credentials` and it does not exist yet -- it
   * is this session's §6 request to studio, with its exact shape. Until it
   * lands `GET /kaggle` does not say `accepts_credentials`, the form is not
   * drawn, and the tab offers Connect... -- the CLI flow that does exist.   */
  var KAGGLE = {
    GET: "/kaggle", CONNECT: "/kaggle-connect", REVOKE: "/kaggle-revoke",
    CREDS: "/kaggle-credentials", SETTINGS: "/settings",
  };
  var MODELS = { GET: "/models", INSTALL: "/models/install", ENGINES: "/engines" };

  /* THE OTHER BOX, and its three routes (studio/README.md `## Status`,
   * **cloud-gpu-tab Part 1**, landed `a62786f`). `GET /modal` is the WHOLE
   * source of truth for the Modal card and there is no second one:
   *
   *   { connected, workspace, installed, not_installed, credentials_file,
   *     accepts_credentials }
   *
   * -- a boolean, a NAME, a path, a sentence and two more booleans. **No
   * credential crosses it, ever, not even masked**: the id is a credential as
   * much as the secret is, so there is nothing on that route for this file to
   * put back on the page even by accident.
   *
   * `?force=1` skips studio's 30 s cache. The card asks for it after a
   * Connect and after a Disconnect and at no other time -- those are the two
   * moments the cached answer is known to be a second old and wrong. */
  var MODAL = { GET: "/modal", CREDS: "/modal-credentials", REVOKE: "/modal-revoke" };

  /* THE TWO LANES, one line each, beside the card that connects them. This is
   * the whole of what the tab is for: a person who has neither is choosing,
   * and a person who has both wants to remember which is which. Osca's own
   * facts (CLAUDE.md: "Kaggle is the standard route"; the Modal lane's L4,
   * its recurring free credit, and the stop that Kaggle's Cancel never was). */
  var KAGGLE_LANE_LINE = "free T4 \u00b7 about 10 hours of audio a week";
  var MODAL_LANE_LINE = "L4, faster \u00b7 ~$30 of free credit a month "
    + "\u00b7 a render can be stopped instantly";

  /* WHERE THE TWO STRINGS COME FROM -- and the line stops at the settings
   * page on purpose. `PROMPTS/cloud-gpu-tab.md`'s own rule is that the word
   * Modal files those strings under appears in no route body and **on no
   * page**; that page's sub-path IS that word, so naming the full URL here
   * would put it on the page in the one place a person reads aloud. The
   * settings page carries the link, one click away. studio/README.md's
   * cloud-gpu-tab Part 1 SS6 asked for exactly this and said it was a
   * constraint, not a nicety. */
  var MODAL_WHERE_LINE = "Where to find these: modal.com/settings.";

  /* What a page says when studio has no answer for Modal at all -- an older
   * studio, with no `/modal` route behind it. Distinct from *not connected*
   * on purpose: nothing here can be connected from this page, so no form is
   * drawn and none would work. */
  var NO_MODAL_ROUTE = "This studio does not answer for Modal, so there is "
    + "nothing to connect from here.";

  function kEl(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* Pure, and the reason the panel's wording is testable without a studio:
   * studio's `GET /kaggle` document in, the four lines the panel says out. */
  function kaggleLines(d) {
    d = d || {};
    var q = d.quota || {}, sl = d.slots || {};
    var who = d.connected
      ? ("Connected as " + (d.username || "an unnamed account") + ".")
      : (d.credentials_present
          ? "A key is on this Mac but Kaggle did not accept it."
          : "Not connected.");
    var quota = (q.hours_left == null)
      ? "Quota unknown."
      : (round1(q.hours_left) + " GPU-hours left this week"
         + (q.hours_total == null ? "" : " of " + round1(q.hours_total))
         + (q.reset ? ", resetting " + q.reset : "") + ".");
    var slots = (sl.free == null)
      ? "Sessions unknown."
      : (sl.free + " of " + (sl.limit == null ? "?" : sl.limit) + " GPU sessions free"
         + (sl.unseen ? " — one of them may be a notebook left open in a browser tab." : "."));
    /* `quotaShort` and `slotsShort` are the same two facts in the words the
     * mock prints BESIDE the bar -- "6.5 h of 30 left", "1 of 2 free". The
     * sentences above are unchanged and are still what the row says
     * underneath: a bar needs a number at its end, not a clause, and the
     * clause is where "resetting Saturday" lives. */
    var quotaShort = (q.hours_left == null) ? "unknown"
      : (round1(q.hours_left) + " h"
         + (q.hours_total == null ? "" : " of " + round1(q.hours_total)) + " left");
    var slotsShort = (sl.free == null) ? "unknown"
      : (sl.free + " of " + (sl.limit == null ? "?" : sl.limit) + " free");
    return { who: who, quota: quota, slots: slots,
             quotaShort: quotaShort, slotsShort: slotsShort,
             where: (d.settings && d.settings.render && d.settings.render.where) || "here",
             canType: !!d.accepts_credentials };
  }
  function round1(n) {
    var x = Number(n);
    if (!isFinite(x)) return String(n);
    return (Math.round(x * 10) / 10).toString();
  }

  /* Pure, and the Modal card's whole vocabulary: studio's `GET /modal`
   * document in, the words the card says out. `kaggleLines`' twin, and for
   * its reason -- the wording is decided in a function a test can call with
   * no server, and the builder below is only where it is put.
   *
   * Nothing here is derived from a credential, because the route carries
   * none. `workspace` is a NAME studio read out of the section header of a
   * file it never otherwise quotes. */
  function modalLines(d) {
    d = d || {};
    var connected = !!d.connected;
    /* `installed` absent means a studio old enough not to say. The safe
     * reading of that silence is *there is a client*: the other way round
     * replaces a form that would have worked with a sentence about a missing
     * tool, and a person cannot argue with a sentence. `canType` still gates
     * the form on `accepts_credentials`, which such a studio also lacks, so
     * the pessimistic case is covered by the field that actually means it. */
    var installed = d.installed === undefined ? true : !!d.installed;
    var who = connected
      ? (d.workspace ? ("Connected to " + d.workspace + ".") : "Connected.")
      : "Not connected.";
    return {
      who: who,
      connected: connected,
      installed: installed,
      /* studio's OWN sentence when there is no client -- it names the three
       * places it looked and the one command that ends it, and the reader
       * does not get to paraphrase that (`kaggle`'s `cli_missing` rule). The
       * fallback is one short line, for a studio that says `installed: false`
       * and nothing else. */
      missing: installed ? null : (d.not_installed || "No modal client on this Mac."),
      lane: MODAL_LANE_LINE,
      where: MODAL_WHERE_LINE,
      file: d.credentials_file || null,
      /* A form is drawn only where the route behind it exists: studio's own
       * `accepts_credentials`, exactly as `kaggleLines.canType` reads it, so
       * a Settings tab talking to an older studio draws nothing rather than a
       * field that would 404 -- and only where there is a client to run, so
       * the no-client state is a sentence and not a dead form. */
      canType: installed && !!d.accepts_credentials,
    };
  }

  /* ============================================== THE VOICES, AND THEIR SIZE
   * Osca, 31 Aug: "Connections holds Kaggle and Models: the four engines from
   * studio's GET /models -- the two shipping ones marked as shipped, Orpheus
   * and Breeze with their one-line purpose, size, and a Download button that
   * calls POST /models/install and shows its bar; installed ones say so."
   *
   * **This file decides nothing about which engine is which.** Which of the
   * four ships, what each is for, how big it is and whether it is here are
   * all facts about the machine and the licence, and they belong to `voice/`
   * and are served by `studio/`. So the section draws whatever `GET /models`
   * says, in the order it says it, and would draw a fifth or a second the
   * same way. Hard-coding "qwen3 and moss ship" here would be a fourth place
   * that has to be right about the licences.
   *
   * The shape it is built against, which is this session's §6 request:
   *
   *   GET /models -> { models: [ { id, label, purpose, size, size_bytes,
   *                                shipped, installed, installing: {pct,
   *                                stage} | null, why } ] }
   *   POST /models/install { id } -> { ok, error? }, progress read back from
   *   the next GET /models as `installing`.
   *
   * **It has not landed.** studio serves `GET /engines` today -- the same four
   * engines, with `offerable` and a `limits` sentence, and no size, no
   * shipped flag and no install route. So when `/models` is not there this
   * section falls back to `/engines`, says in one line that this studio
   * cannot install a voice yet, and draws no Download button -- there is
   * nothing to press it. Naming the gap beats an empty panel, and beats a
   * button that 404s. */
  /* The one sentence a Kaggle-only engine's row says instead of offering a
   * button. It is the reader's word for a fact studio states (`kaggle_only`),
   * the same way "on Kaggle" is the reader's word for `on_kaggle` -- no
   * engine is named here and none is decided here. */
  var KAGGLE_ONLY_LINE = "runs on Kaggle only";

  /* WHAT THE RIGHT COLUMN SAYS WHEN THERE IS NO BUTTON (Osca, 1 Sep: "the
   * right column tells the truth"). "Not added" was one phrase doing two
   * jobs, and it was wrong in both of them:
   *   - a KAGGLE-ONLY engine (chatterbox) is not a thing you failed to add.
   *     There is nothing to add: it runs, today, on Kaggle, and it cannot run
   *     on this Mac at all (its transformers pin cannot share `voice/.venv`).
   *     "Not added" reads as "press something"; there is nothing to press.
   *   - a BRING-YOUR-OWN-WEIGHTS engine (breeze) is not added *and can be* --
   *     by the person, not by us, because shipping those weights needs a
   *     commercial licence we do not have. "Not added" told them the state
   *     and not the door.
   * Neither string names an engine: which row gets which is studio's
   * `kaggle_only` / `installable`, exactly as before. */
  var NO_INSTALL_LINE = "No install \u00b7 runs on Kaggle";
  var BYO_WEIGHTS_LINE = "Not added \u00b7 bring your own weights";

  function modelRows(d, engines) {
    if (d && Array.isArray(d.models)) {
      return { rows: d.models.map(function (m) {
        /* KAGGLE-ONLY: an engine the port offers on Kaggle and cannot offer
         * here (chatterbox -- its pin cannot share this Mac's venv). It gets
         * NO Download button at all, because there is nothing a download
         * could produce; its line says so instead. `installable: false` is
         * the same door Breeze's licence uses, and for the same reason: the
         * page never draws a button it cannot honour. */
        var only = !!m.kaggle_only;
        return { id: m.id, label: m.label || m.id, purpose: m.purpose || "",
                 size: m.size || bytesWord(m.size_bytes),
                 /* WHAT THE TAG MEANS. The tag says "the port offers this on
                  * Kaggle", which is studio's `on_kaggle`. Until studio sends
                  * it, `shipped` is the same fact under its older name and is
                  * read instead -- a fallback to a field studio already
                  * sends, not a value invented here. The difference matters
                  * for exactly one engine: a Kaggle-only one is offered there
                  * and was never "shipped", so under the old name its tag is
                  * missing rather than wrong. §6 asks for the key. */
                 onKaggle: m.on_kaggle === undefined ? !!m.shipped : !!m.on_kaggle,
                 kaggleOnly: only,
                 // kept under its old name for callers that still read it
                 shipped: !!m.shipped,
                 installed: !!m.installed,
                 // A voice we may not fetch on the reader's behalf gets its
                 // INSTRUCTION instead of a button. Breeze is the one:
                 // running it is licensed and free, shipping it is not, so
                 // its weights are the person's to put there and a Download
                 // button would be an offer we cannot keep.
                 installable: only ? false : m.installable !== false,
                 instruction: only ? KAGGLE_ONLY_LINE : (m.instruction || null),
                 installing: only ? null : (m.installing || null),
                 why: m.why || null };
      }), canInstall: true };
    }
    if (engines && Array.isArray(engines.engines)) {
      return { rows: engines.engines.map(function (e) {
        return { id: e.id, label: e.label || e.id, purpose: e.why || e.limits || "",
                 size: "", onKaggle: false, kaggleOnly: false, shipped: false,
                 installed: !!e.offerable,
                 installable: true, instruction: null,
                 installing: null, why: null };
      }), canInstall: false };
    }
    return { rows: [], canInstall: false };
  }
  function bytesWord(n) {
    var x = Number(n);
    if (!isFinite(x) || x <= 0) return "";
    var gb = x / 1e9;
    return gb >= 1 ? (Math.round(gb * 10) / 10) + " GB" : Math.round(x / 1e6) + " MB";
  }

  function buildModelsSection(panel, ctx) {
    var doc = panel.ownerDocument;
    /* THE PICTURE (31 Aug): four rows in one grouped card -- the name, an
     * "on Kaggle" tag for the ones offered there by default, one line of
     * purpose with the size, and on the right EXACTLY ONE THING: *Installed
     * on this Mac* with a green dot, a Download button, or *Not added*. The
     * three states are exclusive by construction below, which is the point:
     * a row that showed a tag and a button at once would be asking a person
     * to work out which of the two is true. */
    panel.appendChild(kEl(doc, "div", "set-head", "Voice engines"));
    var list = kEl(doc, "div", "set-card kag-models");
    var note = kEl(doc, "div", "set-note kag-modelnote", "");
    panel.appendChild(list); panel.appendChild(note);
    var canInstall = false;

    function paint(state) {
      canInstall = state.canInstall;
      list.innerHTML = "";
      note.textContent = state.canInstall
        ? "Downloading a model lets you render on this Mac. Kaggle works without any of them."
        : (state.rows.length
            ? "This studio lists the voices but cannot install one yet, so there is nothing to download from here."
            : "No studio behind this page, so there is nothing to ask about the voices.");
      state.rows.forEach(function (m) {
        var row = kEl(doc, "div", "set-row kag-model");
        row.dataset.model = m.id;
        var left = kEl(doc, "div", "set-l");
        var top = kEl(doc, "div", "kag-modeltop");
        top.appendChild(kEl(doc, "span", "kag-modelname", m.label));
        // "on Kaggle" rather than "shipped": what a shipping engine means to
        // the person at the window is that it is there to choose on Kaggle
        // without installing anything (CLAUDE.md, the inversion) -- "shipped"
        // is our word for our decision, not a fact about their machine.
        if (m.onKaggle) top.appendChild(kEl(doc, "span", "kag-chip", "on Kaggle"));
        left.appendChild(top);
        var line = [];
        if (m.purpose) line.push(m.purpose);
        if (m.size) line.push(m.size);
        // a kaggle-only row's `instruction` IS `KAGGLE_ONLY_LINE`, and the
        // right column now carries that fact -- printing it twice on one row
        // is the thing "the right column tells the truth" was asked for
        if (!m.installed && !m.installable && m.instruction && !m.kaggleOnly) line.push(m.instruction);
        if (line.length) left.appendChild(kEl(doc, "small", "kag-modelline", line.join(" · ")));
        if (m.size) left.appendChild(kEl(doc, "span", "kag-modelsize hidden-size", m.size));
        row.appendChild(left);

        var right = kEl(doc, "div", "set-c");
        if (m.installing) {
          var bar = kEl(doc, "div", "kag-bar");
          var fill = kEl(doc, "i", null, null);
          fill.style.width = Math.max(0, Math.min(100, Number(m.installing.pct) || 0)) + "%";
          bar.appendChild(fill);
          var wrap = kEl(doc, "div", "kag-installing");
          wrap.appendChild(bar);
          wrap.appendChild(kEl(doc, "div", "kag-dim kag-stage",
            (m.installing.stage || "downloading") + " — " + (Math.round(Number(m.installing.pct) || 0)) + "%"));
          right.appendChild(wrap);
        } else if (m.installed) {
          // the mock's green dot and plain text, not a third outlined pill:
          // the dot is the state and the words are the sentence
          right.appendChild(kEl(doc, "span", "st kag-here", "Installed on this Mac"));
        } else if (!m.installable) {
          // the weights are the person's to supply: say so, and offer no
          // button we could not honour
          right.appendChild(kEl(doc, "span", "kag-notadded",
            m.kaggleOnly ? NO_INSTALL_LINE : BYO_WEIGHTS_LINE));
          if (m.kaggleOnly) {
            // its line already says why, and there is nothing to supply
          } else if (!m.instruction) {
            left.appendChild(kEl(doc, "small", "kag-instruction",
              "This voice's weights are yours to supply; studio has not said where they go."));
          } else {
            var ins = kEl(doc, "small", "kag-instruction", m.instruction);
            ins.hidden = true;      // already in the line above; kept for the drivers
            left.appendChild(ins);
          }
        } else if (state.canInstall) {
          var b = doc.createElement("button");
          b.type = "button"; b.className = "kag-btn"; b.dataset.install = m.id;
          b.textContent = "Download";
          if (m.why) { b.disabled = true; b.title = m.why; }
          right.appendChild(b);
          if (m.why) left.appendChild(kEl(doc, "small", "kag-why", m.why));
        }
        row.appendChild(right);
        list.appendChild(row);
      });
      return state;
    }

    function ask() {
      return ctx.getJSON(MODELS.GET).then(function (d) {
        if (d && Array.isArray(d.models)) return paint(modelRows(d, null));
        return ctx.getJSON(MODELS.ENGINES).then(function (e) {
          return paint(modelRows(null, e));
        });
      });
    }

    list.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-install]");
      if (!b || b.disabled || !canInstall) return;
      b.disabled = true;
      b.textContent = "Starting…";
      ctx.postJSON(MODELS.INSTALL, { id: b.dataset.install }).then(function (r) {
        if (!r.ok) { note.textContent = "Could not start the download: " + r.why + "."; }
        return poll(0);
      });
    });
    // The bar is studio's own progress, read back rather than animated here:
    // a bar this page invented would keep moving after the download died.
    function poll(n) {
      if (n > 600) return null;
      return ask().then(function (state) {
        var busy = state.rows.some(function (m) { return !!m.installing; });
        if (!busy) return state;
        return ctx.after(2000).then(function () { return poll(n + 1); });
      });
    }

    ask();
    return { paint: paint, ask: ask, rows: modelRows, els: { list: list, note: note } };
  }

  /* ==================================================== THE LANGUAGES TAB
   * The mock's sixth tab (Osca, 31 Aug), redrawn on 1 Sep against the thing
   * it is actually a picture of: **the catalogue**, not the packets.
   *
   * `PROMPTS/languages.md`, *The catalogue* (Osca, 1 Sep): *"see all
   * available languages in the tab, add one, and it works end to end"*. So a
   * row per language the app **could** be given -- 34 of them today -- and on
   * the right EXACTLY ONE THING, which is the picture's rule and now has a
   * third case:
   *
   *   added        a green dot and *Added*        (and Remove, in the row's ⋯)
   *   addable      an **Add** button, the size last in the left-hand line
   *   unavailable  the reason, in grey, and no button at all
   *
   * **This file decides nothing about which languages exist, what each
   * brings, how big it is, or why one is refused.** All of that is
   * `dictionary/`'s, `voice/`'s and `parser/`'s, measured by
   * `studio/languages.py` and served whole:
   *
   *   GET /languages[?force=1] -> { schema, built_at, source, error,
   *     languages: [ { code, name|null, name_from, native_name, state,
   *                    why, why_detail, dump: {available, bytes, ...},
   *                    size_bytes, speech: {native[], phonemes, dub_route},
   *                    dictionary: {entries}, grammar: {available},
   *                    preset, parser, installed, installed_at } ] }
   *   POST /languages/add    {code} -> { job, would_fetch } | { error }
   *   POST /languages/remove {code} -> { removed, ... }      | { error }
   *
   * The FALLBACK list that stood here is gone, and its own note said it
   * would: *"a stand-in for a route, not a decision about languages, and it
   * goes the moment `/languages` answers"*. It answers. Twenty-seven of the
   * thirty-four rows it sends are greyed *no dictionary dump*, and a
   * hard-coded seven would now be the page telling a comfortable lie about a
   * catalogue five times its size.
   *
   * **The bar is the Models tab's, and it has no fraction.** An add runs five
   * stages -- fetch the dump, export the dictionary, measure the speech
   * route, identify the language, write the packet -- and studio counts none
   * of them (`studio/progress.py`: "the install's branch, word for word").
   * So the row draws the running stage's own name over an indeterminate bar,
   * read back from `GET /state`'s one job rather than animated here: a bar
   * this page invented would keep moving after the add had died.           */
  var LANGUAGES = { GET: "/languages", ADD: "/languages/add",
                    REMOVE: "/languages/remove", STATE: "/state" };

  /* Pure. One row's *what it brings* line, in the mock's words and its order:
   * `dictionary · grammar · <engines> native · <size>`.
   *
   * The size is last and ONLY on a row that offers Add -- which is what the
   * picture draws (English and Latin carry no size; the five with a button
   * all end with one) and what "Add with the size" means.
   *
   * The speech clause is the one place the mock's words and the payload's
   * facts do not meet: the picture writes *moss via phonemes*, and nothing
   * studio sends says which engine reads `voice/phon_<code>.py`. Naming MOSS
   * here would be this file deciding an engine fact -- the exact defect that
   * had `port_qwen3.LANGS` sending Latin to the model as Italian -- so the
   * clause is *via phonemes*, and §6 asks for the engine's name. */
  function languageLine(l) {
    l = l || {};
    var sp = l.speech || {}, parts = [];
    if (l.dump && l.dump.available) parts.push("dictionary");
    if (l.grammar && l.grammar.available) parts.push("grammar");
    var native = Array.isArray(sp.native) ? sp.native : [];
    if (native.length) parts.push(native.join(", ") + " native");
    else if (sp.phonemes) parts.push("via phonemes");
    else if (sp.dub_route) parts.push("dubbed");
    if (l.state === "addable" && l.size_bytes) parts.push(bytesWord(l.size_bytes));
    return parts.join(" · ");
  }

  /* Pure. `GET /languages`'s answer -> the rows the panel draws.
   *
   * THE ORDER IS BY STATE, and it is the only rearranging this file does:
   * the catalogue arrives alphabetical by code, so `added` would be four rows
   * scattered through thirty-four greyed ones, and the picture puts the added
   * languages at the top and the addable under them. Within each group the
   * server's own order is kept, untouched. Nothing here sorts by language.
   *
   * `name` may be null -- studio says so, because the only tables of language
   * names in this repo are an adapter's and studio's bookinfo, and inventing
   * a third here is how the first two drifted. A null name draws the CODE. */
  var LANG_ORDER = { added: 0, addable: 1, unavailable: 2 };

  function languageRows(d) {
    var list = d && (Array.isArray(d.languages) ? d.languages : null);
    if (!list) return { rows: [], fromServer: false, error: null };
    var rows = list.map(function (l, i) {
      var state = l.state || (l.installed ? "added" : "addable");
      // THE OWN NAME ONLY WHEN IT IS ANOTHER NAME. studio sends
      // `native_name: "English"` for English, truthfully, and the picture
      // draws no grey name beside it -- "English English" is the row saying
      // one thing twice. This is a comparison of two strings the server
      // sent, not a table of which languages have one.
      var own = l.native_name || "";
      return { code: l.code, name: l.name || l.code,
               own: own === (l.name || l.code) ? "" : own,
               state: state, added: state === "added",
               line: languageLine({ dump: l.dump, grammar: l.grammar,
                                    speech: l.speech, state: state,
                                    size_bytes: l.size_bytes }),
               size: l.size_bytes ? bytesWord(l.size_bytes) : "",
               why: l.why || "", at: i };
    });
    rows.sort(function (a, b) {
      var d1 = (LANG_ORDER[a.state] == null ? 3 : LANG_ORDER[a.state])
             - (LANG_ORDER[b.state] == null ? 3 : LANG_ORDER[b.state]);
      return d1 || (a.at - b.at);
    });
    return { rows: rows, fromServer: true, error: (d && d.error) || null };
  }

  /* Pure. `postJSON`'s reply -> the words that go in the row's right-hand
   * side. Never a dialog, never a status code the reader has to decode: a
   * refusal studio wrote a sentence for says that sentence. */
  function languageAnswer(r) {
    if (!r) return "not yet";
    if (r.ok) return (r.body && r.body.say) || "Added";
    if (r.status === 404 || r.status === 0) return "not yet";
    return (r.body && r.body.error) || r.why || "not yet";
  }

  /* Pure. `GET /state`'s one job -> what this row should be showing, or null
   * when that job is not this language's add. `step` is the stage's own name
   * and there is no fraction anywhere in it. */
  function languageJob(d, code) {
    var job = d && d.job;
    if (!job || job.mode !== "language" || job.code !== code) return null;
    return { code: job.code, phase: job.phase || "running",
             stage: job.step || (job.progress && job.progress.detail) || "adding",
             err: job.err || null, running: job.phase === "running" || !job.phase };
  }

  function buildLanguagesPanel(panel, ctx) {
    var doc = panel.ownerDocument;
    panel.appendChild(kEl(doc, "div", "set-head", "Languages"));
    var list = kEl(doc, "div", "set-card lang-list");
    var note = kEl(doc, "div", "set-note lang-note", "");
    panel.appendChild(list); panel.appendChild(note);

    // The picture's sentence, and it is the note whenever there is a
    // catalogue to explain. The other two are the states the picture has no
    // room for: no studio behind the page, and a studio that could not build
    // the catalogue and said why.
    var NOTE = "A language is the book's language. Adding one brings its dictionary, its "
      + "grammar where one exists, and the voice route — with a preset reader, "
      + "or a voice you upload.";

    function paint(state) {
      list.innerHTML = "";
      note.textContent = state.error ? state.error
        : (state.fromServer ? NOTE
           : "No studio behind this page, so there is nothing to ask about the languages.");
      state.rows.forEach(function (l) {
        var row = kEl(doc, "div", "set-row lang-row");
        row.dataset.lang = l.code;
        row.dataset.state = l.state;
        // GREYED MEANS THE ROW, not only its right-hand words: twenty-seven
        // of thirty-four rows cannot be added today, and a tab where the
        // four that can are the same weight as the thirty that cannot is a
        // list nobody can read down. The name dims; nothing is hidden.
        if (l.state === "unavailable") row.classList.add("lang-off");
        var left = kEl(doc, "div", "set-l");
        var top = kEl(doc, "div", "lang-top");
        top.appendChild(kEl(doc, "span", "lang-name", l.name));
        if (l.own) top.appendChild(kEl(doc, "span", "lang-own", l.own));
        left.appendChild(top);
        if (l.line) left.appendChild(kEl(doc, "small", "lang-line", l.line));
        row.appendChild(left);

        var right = kEl(doc, "div", "set-c");
        if (l.state === "added") {
          right.appendChild(kEl(doc, "span", "lang-state", "Added"));
          // Remove lives in the ⋯ (PROMPTS/languages.md Part D) -- not on the
          // row, where it would be a second thing on the right and one slip
          // from a dictionary that took thirty-six seconds to export.
          var more = doc.createElement("button");
          more.type = "button"; more.className = "lang-more";
          more.dataset.more = l.code;
          more.setAttribute("aria-label", "More for " + l.name);
          more.setAttribute("aria-expanded", "false");
          more.textContent = "⋯";
          right.appendChild(more);
          var menu = kEl(doc, "div", "lang-menu");
          menu.hidden = true;
          var rm = doc.createElement("button");
          rm.type = "button"; rm.className = "lang-remove";
          rm.dataset.remove = l.code;
          rm.textContent = "Remove";
          menu.appendChild(rm);
          right.appendChild(menu);
        } else if (l.state === "addable") {
          var b = doc.createElement("button");
          b.type = "button"; b.className = "lang-btn"; b.dataset.add = l.code;
          b.textContent = "Add";
          right.appendChild(b);
        } else {
          // studio's own short reason, forwarded whole. This page has no
          // opinion about why a language cannot be added.
          right.appendChild(kEl(doc, "span", "lang-why", l.why || "not available"));
        }
        row.appendChild(right);
        list.appendChild(row);
      });
      return state;
    }

    /* `force` is what the tab uses after an add or a remove: studio caches
     * the catalogue for 300 s (three interpreter starts to build it), so a
     * plain re-ask would draw the state from before the button was pressed. */
    function ask(force) {
      return ctx.getJSON(force ? LANGUAGES.GET + "?force=1" : LANGUAGES.GET)
        .then(function (d) { return paint(languageRows(d)); });
    }

    function rightOf(code) {
      var row = list.querySelector('[data-lang="' + code + '"]');
      return row ? row.querySelector(".set-c") : null;
    }

    /* The answer lands where the button was, which is the row this person
     * just pressed -- and it is the whole of the feedback. */
    function say(code, text) {
      var right = rightOf(code);
      if (!right) return null;
      right.innerHTML = "";
      right.appendChild(kEl(doc, "span", "lang-said", text));
      return text;
    }

    /* The Models tab's bar, without its percentage: studio counts no stage of
     * an add, so the fill is indeterminate and the label is the stage's own
     * name. `.kag-bar`/`.kag-stage` are borrowed rather than copied -- one
     * bar in this window, not two that drift apart. */
    function bar(code, stage) {
      var right = rightOf(code);
      if (!right) return null;
      right.innerHTML = "";
      var wrap = kEl(doc, "div", "kag-installing lang-adding");
      var b = kEl(doc, "div", "kag-bar lang-bar");
      b.appendChild(kEl(doc, "i", null, null));
      wrap.appendChild(b);
      wrap.appendChild(kEl(doc, "div", "kag-dim kag-stage", stage));
      right.appendChild(wrap);
      return stage;
    }

    /* Poll `/state` for as long as the add is this window's running job, then
     * ask the catalogue again with `?force=1` -- the row's new state is
     * studio's answer, never a guess made here about what the add did. */
    function watch(code, n) {
      if (n > 900) return null;
      return ctx.getJSON(LANGUAGES.STATE).then(function (d) {
        var j = languageJob(d, code);
        if (j && j.running) {
          bar(code, j.stage);
          return ctx.after(2000).then(function () { return watch(code, n + 1); });
        }
        var why = j && j.phase !== "done" ? (j.err || j.phase) : null;
        return ask(true).then(function (state) {
          if (why) say(code, why);
          return state;
        });
      });
    }

    list.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var more = t.closest("[data-more]");
      if (more) {
        var menu = more.parentNode.querySelector(".lang-menu");
        var open = menu && menu.hidden;
        // one menu at a time, and pressing ⋯ again closes it
        Array.prototype.forEach.call(list.querySelectorAll(".lang-menu"),
          function (m) { m.hidden = true; });
        Array.prototype.forEach.call(list.querySelectorAll("[data-more]"),
          function (m) { m.setAttribute("aria-expanded", "false"); });
        if (menu && open) { menu.hidden = false; more.setAttribute("aria-expanded", "true"); }
        return;
      }

      var rm = t.closest("[data-remove]");
      if (rm && !rm.disabled) {
        var gone = rm.dataset.remove;
        rm.disabled = true;
        ctx.postJSON(LANGUAGES.REMOVE, { code: gone }).then(function (r) {
          if (r && r.ok) return ask(true);
          say(gone, languageAnswer(r));
          return null;
        });
        return;
      }

      var b = t.closest("[data-add]");
      if (!b || b.disabled) return;
      var code = b.dataset.add;
      b.disabled = true;
      b.textContent = "Adding…";
      ctx.postJSON(LANGUAGES.ADD, { code: code }).then(function (r) {
        if (!r || !r.ok) { say(code, languageAnswer(r)); return null; }
        // studio's own first stage, from the job it just started: the bar is
        // up before the first poll rather than a second later
        var j = languageJob({ job: r.body && r.body.job }, code);
        bar(code, (j && j.stage) || "adding");
        return watch(code, 0);
      });
    });

    ask();
    return { paint: paint, ask: ask, say: say, bar: bar, watch: watch,
             rows: languageRows, answer: languageAnswer, job: languageJob,
             line: languageLine, els: { list: list, note: note } };
  }

  function buildKagglePanel(panel, ctx) {
    var doc = panel.ownerDocument;
    /* THE PICTURE (31 Aug): an Account card whose first row is the green dot,
     * *Connected as name*, the sentence about where renders run, and
     * Disconnect on the right; then the week's quota as a bar with the hours
     * beside it; then the sessions. Under the card, the note about the key
     * file. Not connected, the same card carries one sentence and the three
     * controls that end it.
     *
     * Every fact is still studio's -- `kaggleLines` is untouched and is
     * where the wording is decided; this is only where it is put. */
    /* The head was *Account* while this tab was one box's. With two cards
     * on it, each card is named for the box it signs into -- otherwise the
     * page has two Accounts on it and a person has to read the buttons to
     * tell which is which. */
    panel.appendChild(kEl(doc, "div", "set-head", "Kaggle"));
    var card = kEl(doc, "div", "set-card");
    panel.appendChild(card);

    // ---- row 1: who, why, and the way out
    var whoRow = kEl(doc, "div", "set-row");
    var whoL = kEl(doc, "div", "set-l");
    var head = kEl(doc, "div", "kag-line kag-who st", "Asking studio…");
    whoL.appendChild(head);
    whoL.appendChild(kEl(doc, "small", "kag-why-here",
      "Renders run on Kaggle unless you install a model on this Mac."));
    // ...and what this lane IS, beside the card that connects it (2 Sep)
    whoL.appendChild(kEl(doc, "small", "kag-why-here kag-lane", KAGGLE_LANE_LINE));
    var acts = kEl(doc, "div", "set-c kag-row kag-acts");
    var connectBtn = doc.createElement("button");
    connectBtn.type = "button"; connectBtn.className = "kag-btn"; connectBtn.textContent = "Connect…";
    var revokeBtn = doc.createElement("button");
    revokeBtn.type = "button"; revokeBtn.className = "kag-btn danger"; revokeBtn.textContent = "Disconnect";
    acts.appendChild(connectBtn); acts.appendChild(revokeBtn);
    whoRow.appendChild(whoL); whoRow.appendChild(acts);
    card.appendChild(whoRow);

    // ---- row 2: the week, as a bar, with the hours beside it
    var quotaRow = kEl(doc, "div", "set-row");
    var quotaL = kEl(doc, "div", "set-l kag-quota-l");
    quotaL.appendChild(kEl(doc, "div", "set-name", "This week"));
    // studio's full sentence -- "…of 30, resetting Saturday." -- is the row's
    // TITLE and not a second line under the name: beside a bar reading
    // "6.5 h of 30 left" it would be the same fact twice, three centimetres
    // apart. It stays in the DOM, where a driver and a screen reader can
    // still reach it.
    var quotaLong = kEl(doc, "small", "kag-line kag-dim kag-long", "");
    quotaLong.hidden = true;
    quotaL.appendChild(quotaLong);
    quotaRow.appendChild(quotaL);
    var qBar = kEl(doc, "div", "kag-quota");
    var qFill = kEl(doc, "i", null, null);
    qBar.appendChild(qFill);
    var qC = kEl(doc, "div", "set-c");
    qC.appendChild(qBar);
    var quota = kEl(doc, "div", "kag-line kag-dim set-val kag-quotaword", "");
    qC.appendChild(quota);
    quotaRow.appendChild(qC);
    card.appendChild(quotaRow);

    // ---- row 3: the sessions
    var slotRow = kEl(doc, "div", "set-row");
    var slotL = kEl(doc, "div", "set-l");
    slotL.appendChild(kEl(doc, "div", "set-name", "Sessions"));
    var slotsLong = kEl(doc, "small", "kag-line kag-dim kag-long", "");
    slotsLong.hidden = true;
    slotL.appendChild(slotsLong);
    slotRow.appendChild(slotL);
    var slots = kEl(doc, "div", "set-c kag-line kag-dim set-val", "");
    slotRow.appendChild(slots);
    card.appendChild(slotRow);

    // ---- row 4: where a render runs by default. studio owns the value;
    //      this is its control, and it appears only once there is a choice.
    var whereRow = kEl(doc, "div", "set-row kag-whererow");
    var whereL = kEl(doc, "div", "set-l");
    whereL.appendChild(kEl(doc, "div", "set-name", "Where a render runs"));
    whereL.appendChild(kEl(doc, "small", null, "By default. A job can still say otherwise."));
    whereRow.appendChild(whereL);
    // NOT `.opts`: that class means "a TTSTVSettings field group", and
    // mount()'s painter walks every one of them and presses the button whose
    // value matches the stored settings. This control's value is studio's,
    // not the reader's, so it keeps its own class and its own painter.
    var whereOpts = kEl(doc, "div", "set-c kag-opts set-seg");
    whereOpts.setAttribute("role", "group");
    var whereBtns = {};
    [["here", "This Mac"], ["kaggle", "Kaggle"]].forEach(function (o) {
      var b = doc.createElement("button");
      b.type = "button"; b.dataset.where = o[0];
      b.setAttribute("aria-pressed", "false");
      b.appendChild(kEl(doc, "span", "opt-main", o[1]));
      whereOpts.appendChild(b); whereBtns[o[0]] = b;
    });
    whereRow.appendChild(whereOpts);
    card.appendChild(whereRow);

    /* ---- the key, when studio will take one: its own card, because it is a
     *      different question from "am I signed in".
     *
     * TWO STATES, NEVER BOTH (Osca, 31 Aug, on the screenshots: the page was
     * showing the account card AND the key form at once, which asks a person
     * to work out which of the two describes them). The mock draws:
     *
     *   connected     the account card, its quota and its sessions -- and NO
     *                 key form. *Reconnect…* is what reveals it, for the one
     *                 case a connected account needs it: a key that has been
     *                 rotated.
     *   disconnected  the key card. The quota and the sessions rows are
     *                 hidden, because with nothing connected they have
     *                 nothing behind them and said "unknown" twice.
     *
     * `credsOpen` is that reveal, and it is per-visit: it goes back to false
     * whenever studio says connected in a fresh answer, so the form does not
     * sit open behind a Saved. */
    var credsOpen = false;
    var creds = kEl(doc, "div", "kag-creds");
    creds.hidden = true;
    creds.appendChild(kEl(doc, "div", "set-head", "Your Kaggle key"));
    var credCard = kEl(doc, "div", "set-card");
    var credRow = kEl(doc, "div", "set-row kag-credrow");
    credRow.appendChild(kEl(doc, "div", "kag-dim kag-credsay",
      "Rendering runs on Kaggle. Paste the key from kaggle.com → Settings → API."));
    var userIn = doc.createElement("input");
    userIn.type = "text"; userIn.className = "kag-in"; userIn.placeholder = "username";
    userIn.setAttribute("aria-label", "Kaggle username");
    userIn.autocomplete = "off";
    var keyIn = doc.createElement("input");
    keyIn.type = "password"; keyIn.className = "kag-in kag-in-key"; keyIn.placeholder = "key";
    keyIn.setAttribute("aria-label", "Kaggle key");
    keyIn.autocomplete = "off";
    var saveBtn = doc.createElement("button");
    // the picture's one filled button, and the only one on any tab
    saveBtn.type = "button"; saveBtn.className = "kag-btn kag-primary"; saveBtn.textContent = "Connect";
    var row = kEl(doc, "div", "kag-row");
    row.appendChild(userIn); row.appendChild(keyIn); row.appendChild(saveBtn);
    credRow.appendChild(row);
    credCard.appendChild(credRow);
    creds.appendChild(credCard);
    panel.appendChild(creds);

    panel.appendChild(kEl(doc, "div", "set-note",
      "Your key is written once to ~/.kaggle/kaggle.json — the file the kaggle tool "
      + "reads — and is never kept anywhere else and never shown again."));

    var say = kEl(doc, "div", "set-note kag-line kag-say");
    say.setAttribute("role", "status");
    panel.appendChild(say);

    function paint(d) {
      var L = kaggleLines(d);
      head.textContent = L.who;
      // the dot is CSS's, off the row's own class -- green when studio says
      // connected, grey when it does not, and never a claim of its own
      head.classList.toggle("kag-on", !!(d && d.connected));
      quota.textContent = L.quotaShort;
      quotaLong.textContent = L.quota;
      quotaRow.title = L.quota;
      slots.textContent = L.slotsShort;
      slotsLong.textContent = L.slots;
      slotRow.title = L.slots;
      /* THE BAR IS THE HOURS USED, and it is drawn only when studio has given
       * both numbers: a bar with nothing behind it would be this page
       * inventing a quota. */
      var q = (d && d.quota) || {};
      var total = Number(q.hours_total), left = Number(q.hours_left);
      var known = isFinite(total) && total > 0 && isFinite(left);
      qBar.hidden = !known;
      qFill.style.width = known
        ? Math.max(0, Math.min(100, ((total - left) / total) * 100)) + "%" : "0%";
      for (var w in whereBtns) {
        if (Object.prototype.hasOwnProperty.call(whereBtns, w)) {
          whereBtns[w].setAttribute("aria-pressed", w === L.where ? "true" : "false");
        }
      }
      /* THE TWO STATES. The key form is drawn when studio will take a key
       * (`canType`) AND either nothing is connected -- where it is the whole
       * point of the tab -- or *Reconnect…* has been pressed. A connected
       * account that has not asked for it never sees it. */
      var connected = !!(d && d.connected);
      creds.hidden = !L.canType || (connected && !credsOpen);
      // and the two rows that are only facts about a connection
      quotaRow.hidden = !connected;
      slotRow.hidden = !connected;
      revokeBtn.disabled = !connected;
      revokeBtn.title = revokeBtn.disabled ? "Nothing is connected" : "";
      connectBtn.textContent = connected ? "Reconnect…" : "Connect…";
      if (!L.canType) {
        connectBtn.title = "This studio signs in with the kaggle tool itself; "
          + "it does not take a typed key yet.";
      } else { connectBtn.title = ""; }
    }

    function ask(keepForm) {
      return ctx.getJSON(KAGGLE.GET).then(function (d) {
        if (!d) { head.textContent = "No studio behind this page, so nothing to ask."; return null; }
        // a fresh answer closes the Reconnect… form again, so it does not sit
        // open under a "Saved" -- unless the caller is mid-flow and says so
        if (!keepForm) credsOpen = false;
        paint(d);
        return d;
      });
    }

    whereOpts.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("button[data-where]");
      if (!b) return;
      say.textContent = "Saving…";
      ctx.postJSON(KAGGLE.SETTINGS, { render: { where: b.dataset.where } }).then(function (r) {
        say.textContent = r.ok
          ? ("Renders start on " + (b.dataset.where === "kaggle" ? "Kaggle" : "this Mac") + ".")
          : ("studio would not take it: " + r.why + ".");
        return ask();
      });
    });

    /* READ AND CLEAR IN ONE STATEMENT. The value leaves the input and exists
     * only as the argument of the POST; nothing above this line holds it,
     * nothing below it can. */
    function take(input) { var v = input.value; input.value = ""; return v; }

    saveBtn.addEventListener("click", function () {
      var user = take(userIn), key = take(keyIn);
      if (!user || !key) { say.textContent = "A username and a key, both."; return; }
      say.textContent = "Saving…";
      ctx.postJSON(KAGGLE.CREDS, { username: user, key: key }).then(function (r) {
        user = null; key = null;
        say.textContent = r.ok
          ? "Saved into ~/.kaggle/kaggle.json. It is not kept anywhere else and is never shown again."
          : (r.status === 404
              ? "This studio does not take a typed key yet — use Connect…, which signs in with the kaggle tool."
              : ("Not saved: " + r.why + "."));
        // a saved key closes the form; a refused one leaves it open to fix
        return ask(!r.ok);
      });
    });

    connectBtn.addEventListener("click", function () {
      /* CONNECTED: this button is *Reconnect…*, and §5 says what it does --
       * it REVEALS the username · key · Connect card. Nothing is signed out
       * and nothing is posted; the person types a new key and presses
       * Connect, which is the same one route as before. */
      if (connectBtn.textContent === "Reconnect…") {
        credsOpen = true;
        creds.hidden = false;
        say.textContent = "Type the new key and press Connect.";
        if (userIn.focus) userIn.focus();
        return;
      }
      say.textContent = "Signing in — studio is running the kaggle tool…";
      ctx.postJSON(KAGGLE.CONNECT, {}).then(function (r) {
        if (!r.ok) { say.textContent = "Could not start: " + r.why + "."; return null; }
        return pollConnect(0);
      });
    });
    function pollConnect(n) {
      if (n > 60) { say.textContent = "Still signing in — leave this open, or try again."; return null; }
      return ctx.getJSON(KAGGLE.CONNECT).then(function (d) {
        if (d && d.done) { say.textContent = d.ok ? "Connected." : ("Kaggle refused: " + (d.error || "no reason given") + "."); return ask(); }
        return ctx.after(1000).then(function () { return pollConnect(n + 1); });
      });
    }

    revokeBtn.addEventListener("click", function () {
      say.textContent = "Disconnecting…";
      ctx.postJSON(KAGGLE.REVOKE, {}).then(function (r) {
        say.textContent = r.ok ? "Disconnected." : ("Not disconnected: " + r.why + ".");
        return ask();
      });
    });

    ask();
    return { paint: paint, ask: ask, lines: kaggleLines,
             get credsOpen() { return credsOpen; },
             els: { head: head, quota: quota, slots: slots, creds: creds,
                    quotaRow: quotaRow, slotRow: slotRow,
                    user: userIn, key: keyIn, say: say, connect: connectBtn,
                    revoke: revokeBtn, where: whereOpts } };
  }

  /* ================================= THE CLOUD GPU TAB, CARD TWO: MODAL
   * Osca, 2 Sep: *"we just add Modal, like we've added Kaggle, put your key
   * in etc, then it shows as an option in studio as to 'Where'."*
   *
   * Like Kaggle's, and one field shorter in what it knows: **every fact on
   * this card is studio's**, served by `GET /modal` (studio/README.md,
   * cloud-gpu-tab Part 1). The reader stores none of it, computes none of it,
   * and -- the rule this card exists under -- **never puts a credential back
   * into the DOM**, because the route it draws from carries none to put.
   *
   * THREE STATES, and each is one line of `paint`:
   *
   *   no client   `installed: false`. The card is studio's SENTENCE about
   *               what to run, and no form at all. A dead form here would ask
   *               a person to paste two strings into a page that has nothing
   *               to hand them to.
   *   absent      signed out, with a client. The two fields, the line saying
   *               where the strings live, and Connect. Disconnect is inert.
   *   connected   the workspace name and Disconnect. No form -- there is
   *               nothing left to type, and a filled-in form beside a green
   *               dot is the *never both* bug card one already fixed.
   *
   * The two fields are **id** and **secret**, here and on the wire, and that
   * is the prompt's own rule rather than a preference: the other word is the
   * one studio's credential guard refuses in a settings route's body.
   *
   * THE VALUES LIVE FOR ONE STATEMENT. `take()` reads and clears in the same
   * line, exactly as card one's does; the value exists as the argument of one
   * POST and nowhere else -- not in a status line, a title, a dataset
   * attribute, a closure that outlives the click, or this file's own state.  */
  function buildModalCard(panel, ctx) {
    var doc = panel.ownerDocument;
    panel.appendChild(kEl(doc, "div", "set-head", "Modal"));
    var card = kEl(doc, "div", "set-card");
    panel.appendChild(card);

    // ---- row 1: who, what this lane is, and the way out
    var whoRow = kEl(doc, "div", "set-row");
    var whoL = kEl(doc, "div", "set-l");
    var head = kEl(doc, "div", "kag-line kag-who st mod-who", "Asking studio…");
    whoL.appendChild(head);
    whoL.appendChild(kEl(doc, "small", "kag-why-here kag-lane", MODAL_LANE_LINE));
    var acts = kEl(doc, "div", "set-c kag-row kag-acts");
    var revokeBtn = doc.createElement("button");
    revokeBtn.type = "button";
    revokeBtn.className = "kag-btn danger";
    revokeBtn.textContent = "Disconnect";
    acts.appendChild(revokeBtn);
    whoRow.appendChild(whoL); whoRow.appendChild(acts);
    card.appendChild(whoRow);

    // ---- row 2: the one sentence a card with no client IS. studio's words,
    //      never a paraphrase -- it names three paths and one command.
    var missRow = kEl(doc, "div", "set-row mod-missrow");
    var missSay = kEl(doc, "div", "kag-dim mod-missing", "");
    missRow.appendChild(missSay);
    missRow.hidden = true;
    card.appendChild(missRow);

    /* ---- the two strings, in their own card, because "am I signed in" and
     *      "here is a sign-in" are two questions -- card one's own shape. */
    var creds = kEl(doc, "div", "kag-creds mod-creds");
    creds.hidden = true;
    var credCard = kEl(doc, "div", "set-card");
    var credRow = kEl(doc, "div", "set-row kag-credrow");
    var whereLine = kEl(doc, "div", "kag-dim kag-credsay mod-where", MODAL_WHERE_LINE);
    credRow.appendChild(whereLine);
    var idIn = doc.createElement("input");
    idIn.type = "text"; idIn.className = "kag-in mod-in-id"; idIn.placeholder = "id";
    idIn.setAttribute("aria-label", "Modal id");
    idIn.autocomplete = "off";
    var secretIn = doc.createElement("input");
    secretIn.type = "password"; secretIn.className = "kag-in kag-in-key mod-in-secret";
    secretIn.placeholder = "secret";
    secretIn.setAttribute("aria-label", "Modal secret");
    secretIn.autocomplete = "off";
    var saveBtn = doc.createElement("button");
    saveBtn.type = "button"; saveBtn.className = "kag-btn kag-primary";
    saveBtn.textContent = "Connect";
    var row = kEl(doc, "div", "kag-row");
    row.appendChild(idIn); row.appendChild(secretIn); row.appendChild(saveBtn);
    credRow.appendChild(row);
    credCard.appendChild(credRow);
    creds.appendChild(credCard);
    panel.appendChild(creds);

    // The file the sign-in lands in -- studio's path, not a spelling of it
    // kept here. Card one's note, about the other box's file.
    var note = kEl(doc, "div", "set-note mod-note", "");
    note.hidden = true;
    panel.appendChild(note);

    var say = kEl(doc, "div", "set-note kag-line kag-say mod-say");
    say.setAttribute("role", "status");
    panel.appendChild(say);

    function paint(d) {
      var L = modalLines(d);
      head.textContent = L.who;
      // the dot is CSS's, off the row's own class, and it is studio's
      // `connected` and never a claim this file makes
      head.classList.toggle("kag-on", L.connected);
      missRow.hidden = L.installed;
      missSay.textContent = L.missing || "";
      // THE THREE STATES, in one line: a form only where there is something
      // behind it (`canType`) and something left to do (not connected).
      creds.hidden = !L.canType || L.connected;
      revokeBtn.disabled = !L.connected;
      revokeBtn.title = revokeBtn.disabled ? "Nothing is connected" : "";
      note.hidden = !L.file;
      note.textContent = L.file
        ? ("Your id and secret are written once to " + L.file
           + " by Modal's own sign-in command — the file the renders already "
           + "read — and are never kept anywhere else and never shown again.")
        : "";
      return L;
    }

    /* `force` is `?force=1`, and it is asked in exactly two places: after a
     * Connect and after a Disconnect. studio caches this answer for 30 s
     * because the tab re-renders on a poll, and those are the two moments the
     * cached answer is known to be wrong. */
    function ask(force) {
      return ctx.getJSON(MODAL.GET + (force ? "?force=1" : "")).then(function (d) {
        if (!d) {
          // No route, or no studio at all. Draw the empty card -- no form,
          // nothing connected -- and say which of the two it is in the one
          // place the card has for a sentence.
          paint({ connected: false, accepts_credentials: false });
          head.textContent = NO_MODAL_ROUTE;
          return null;
        }
        paint(d);
        return d;
      });
    }

    /* READ AND CLEAR IN ONE STATEMENT -- card one's `take`, and its reason. */
    function take(input) { var v = input.value; input.value = ""; return v; }

    saveBtn.addEventListener("click", function () {
      var id = take(idIn), secret = take(secretIn);
      if (!id || !secret) { say.textContent = "An id and a secret, both."; return; }
      say.textContent = "Saving…";
      ctx.postJSON(MODAL.CREDS, { id: id, secret: secret }).then(function (r) {
        id = null; secret = null;
        var b = (r && r.body) || {};
        // studio's `note` is the one thing it says about the SHAPE of a paste
        // -- "those are not the two strings Modal's settings page usually
        // shows, in that order" -- and it is a note beside the answer, never
        // a refusal. Shown because it is the only clue a swapped pair gets.
        say.textContent = r.ok
          ? ((b.note ? b.note + " — " : "")
             + "Saved. It is not kept anywhere else and is never shown again.")
          : (r.status === 404
              ? "This studio does not take a Modal sign-in yet."
              : ("Not saved: " + r.why + "."));
        return ask(true);
      });
    });

    revokeBtn.addEventListener("click", function () {
      say.textContent = "Disconnecting…";
      ctx.postJSON(MODAL.REVOKE, {}).then(function (r) {
        var b = (r && r.body) || {};
        // studio MOVES that file rather than deleting it, on purpose (Modal's
        // two strings cannot be read back off its settings page once they are
        // rotated), so a misclick costs a rename. Said here, where the misclick
        // happens.
        say.textContent = r.ok
          ? ("Disconnected." + (b.moved ? " The file was moved aside, not deleted." : ""))
          : ("Not disconnected: " + r.why + ".");
        return ask(true);
      });
    });

    ask();
    return { paint: paint, ask: ask, lines: modalLines,
             els: { head: head, id: idIn, secret: secretIn, creds: creds,
                    missRow: missRow, missing: missSay, note: note, say: say,
                    where: whereLine, connect: saveBtn, revoke: revokeBtn } };
  }

  /* ============================================ AND THE TAB IS THE TWO OF THEM
   * One panel, two builders, in the order Osca named them -- Kaggle first
   * because it is the standard route (CLAUDE.md: *"Kaggle is the standard
   * route"*), Modal under it. Neither knows the other exists: they share a
   * panel and nothing else, each asks its own route, each owns its own status
   * line. Adding a third box is one more line here.
   *
   * The return value is the two BY NAME -- `panels.cloud.kaggle` and
   * `panels.cloud.modal`. Card one kept every member it had, so what moved
   * for its existing callers is one word in the path to it.                */
  function buildCloudPanel(panel, ctx, opts) {
    var kaggle = buildKagglePanel(panel, ctx, opts);
    var modal = buildModalCard(panel, ctx, opts);
    return {
      kaggle: kaggle, modal: modal,
      ask: function () { return Promise.all([kaggle.ask(), modal.ask()]); },
    };
  }

  /* A destination is one row: what it is called, whether it can be used, and
   * one sentence saying why it is or is not. The same shape the Kaggle and
   * Modal cards use, for the same reason -- `connected` is studio's word and
   * never a guess this file makes. */
  /* ================================================== THE TRANSFER TAB
   * Osca, 6 Sep 2026 (job 26): *"I just need a Sync button in both, in the
   * Settings. This will push/pull -- that's all."* And the same day's
   * addendum: *"Google IS the account ... Transfer tab: 'Connected as ...' +
   * the Sync button; This network stays as the no-account path."* The
   * picture is `design/reader/settings.html`'s Transfer panel (`92c1f58`),
   * and this builds to its classes: one card, one row, one verb.
   *
   * WHAT SYNC DOES, in the order it does it. PUSH first: every marginalia
   * record this browser holds (`ttstv.reader.marginalia.<slug>`,
   * reader/marginalia.js's records) and every reading position
   * (`ttstv.reader.library`.positions, reader/cursor.js's record) go to
   * Studio in two POSTs; Studio merges them by id -- both sides' marks
   * survive, the same mark edited on both -> newer wins -- and answers the
   * WHOLE merged set, which is written back here, so the push is also the
   * pull of marks. Then PULL: on a phone, Studio's manifest is compared with
   * what `library/import.js` says is installed (slug + word-id hash), and
   * every book the phone lacks is fetched file by file through
   * `TTSTVBundle.importFiles` -- import.js's own path, so a synced book and
   * a zip-imported book are the same bytes in the same cache. Nothing is
   * deleted by sync, ever. Progress is this row's own line.
   *
   * WHERE STUDIO IS. On the Mac this page is served BY Studio, so the
   * remote is `origin()` and there is nothing to pair: the press reconciles
   * this browser's store with the mirror (the Mac's reader repaints off the
   * `storage` event). On the phone the remote is the Studio this device
   * paired with -- `ttstv.sync.pair` -- found on the network through the
   * host (`TTSTVHost.syncDiscover`, Bonjour `_ttstv._tcp`) or typed as an
   * address, and the six-digit code typed once. Pairing lives INSIDE the
   * Sync button the first time: an unpaired phone that presses Sync is
   * shown the This network row's picker, and the press continues once the
   * code lands.
   *
   * OFF THE LAN the phone reads what it has: the push cannot land, the line
   * says so, and because the push always sends everything this browser
   * holds, the "queue" is the store itself -- the next press that reaches
   * Studio carries it. Nothing is written down twice.
   *
   * THE ACCOUNT. `Connected as ...` is the Sync card's first line and the
   * Sync-through card's first two rows are the cloud transports: Google
   * Drive (the account) and iCloud Drive. Neither is built yet -- their
   * rows are inert with the reason in words (this file's rule for a face
   * the device lacks), and `settings/STATUS.md` §6/§8 carry what each needs.
   * "This device only" is what the line reads until one of them exists.  */
  var SYNC = {
    GET: "/sync", HELLO: "/sync/hello", PAIR: "/sync/pair", MANIFEST: "/sync/manifest",
    MARGINALIA: "/sync/marginalia", POSITIONS: "/sync/positions",
  };
  var SYNC_PAIR_KEY = "ttstv.sync.pair";       // {base, token, name, paired}
  var SYNC_LAST_KEY = "ttstv.sync.last";       // {at, books, marks}
  var SYNC_ACCOUNT_KEY = "ttstv.sync.account"; // {kind: "device"|"google"|"icloud", who}
  var SYNC_MARG_PREFIX = "ttstv.reader.marginalia.";
  var SYNC_LIB_KEY = "ttstv.reader.library";
  var SYNC_DEVICE_KEY = "ttstv.reader.deviceId";
  var SYNC_DISCOVER_MS = 2500;

  /* ============================ THE DOOR'S PAIRING (23d; Osca, 6 Sep)
   * Not the sync pairing above (`ttstv.sync.pair`, a six-digit code, Studio's
   * marks listener -- job 26). THIS is the door: the address and the pass a
   * phone or a Mac uses to parse and render through `cloud/endpoint.py` on
   * Modal, `serve_local.py` on the LAN, or Studio itself. ONE KEY,
   * `localStorage["transfer.pairing"]`, two writers and one reader
   * (`library/transfer.js`, `IOS-TTS-TV/STATUS.md` 23d §6): the phone's
   * `frank-pair://` link is one writer, and this field is the other. The
   * object is `{v:1, url, pass, workspace, app, fp, made}` in that order,
   * `fp` = sha256(pass) hex sliced to 8 -- `deploy_to_my_modal.py::
   * fingerprint`'s rule -- and `ttstv:pairing` on `window` is the news.
   *
   * Inside Frank (the phone) and Frank Studio (the Mac) the host holds the
   * write: `TTSTVHost.pairWrite({url, pass})` -> the fp. The phone's is
   * `lib.rs::PAIR_JS`; Studio's is `desktop/src/host.js`, added with this
   * field as one re-wire. Outside both -- a plain browser -- this file does
   * the same `crypto.subtle` line itself, so the key is the same bytes from
   * every hand. The pass is READ once off the field, written once, and
   * never drawn: the row shows the fp and the address. */
  var TRANSFER_PAIR_KEY = "transfer.pairing";
  var TRANSFER_PAIR_EVENT = "ttstv:pairing";

  /* Pure-ish: sha256(pass) hex sliced to 8, through `crypto.subtle` (the
   * same line `library/import.js` hashes a book with). Rejects where there
   * is no subtle crypto (an http:// page on a phone) rather than inventing
   * a fingerprint. */
  function pairFingerprint(pass) {
    var c = global.crypto;
    if (!c || !c.subtle || typeof c.subtle.digest !== "function" || typeof TextEncoder === "undefined") {
      return Promise.reject(new Error("no subtle crypto here, so no fingerprint"));
    }
    return c.subtle.digest("SHA-256", new TextEncoder().encode(String(pass))).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return (b < 16 ? "0" : "") + b.toString(16);
      }).join("").slice(0, 8);
    });
  }

  /* Pure: the record the two writers agree on, in the order the phone lane
   * writes it. `fp` is passed in because computing it is async. */
  function pairRecord(f, fp, now) {
    return {
      v: (f && f.v) || 1,
      url: String((f && f.url) || ""),
      pass: String((f && f.pass) || ""),
      workspace: String((f && f.workspace) || ""),
      app: String((f && f.app) || "ttstv-cloud"),
      fp: fp,
      made: (f && f.made) || Math.floor((now == null ? Date.now() : now) / 1000),
    };
  }

  /* Pure: the address as typed, trimmed, `http://` assumed when no scheme
   * is given -- a person types `192.168.1.24:8099`, and the door on the LAN
   * is plain http. Anything that is not http(s) is "" -- a link is a string
   * a stranger prints on a wall (the phone lane's own rule). */
  function pairUrlOf(text) {
    var t = String(text || "").trim().replace(/\/+$/, "");
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    // another scheme -- file://, or the ones a wall would carry -- is not a door
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(javascript|data|blob|about|vbscript):/i.test(t)) return "";
    return "http://" + t;
  }

  /* Pure: the row's line. The fp and the address; never the pass. */
  function pairLine(rec) {
    if (!rec || !rec.url) return "Not paired · type the address and the pass from Studio's square";
    return "Paired · " + String(rec.url).replace(/^https?:\/\//, "")
      + (rec.fp ? " · pass " + rec.fp : "")
      + (rec.workspace ? " · " + rec.workspace : "");
  }

  function pairRead() {
    var host = global.TTSTVHost;
    if (host && typeof host.pairRead === "function") {
      try { return host.pairRead(); } catch (e) { /* fall through to the store */ }
    }
    return syncRead(TRANSFER_PAIR_KEY);
  }

  function pairFire(fp, url) {
    try {
      if (global.CustomEvent && typeof global.dispatchEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(TRANSFER_PAIR_EVENT, { detail: { fp: fp, url: url } }));
      }
    } catch (e) { /* a window that cannot dispatch is still a window */ }
  }

  /* The write. The host's when there is one (Frank, Frank Studio) -- so the
   * key is written by the same hand the deep link uses -- else this file's
   * own, the same bytes. Resolves to the fp. */
  function pairWrite(fields) {
    var host = global.TTSTVHost;
    if (host && typeof host.pairWrite === "function") return host.pairWrite(fields);
    if (!fields || !fields.url || !fields.pass) {
      return Promise.reject(new Error("a pairing needs an address and a pass"));
    }
    return pairFingerprint(fields.pass).then(function (fp) {
      var rec = pairRecord(fields, fp);
      syncWrite(TRANSFER_PAIR_KEY, rec);
      pairFire(fp, rec.url);
      return fp;
    });
  }

  /* Forgetting is this page's own, host or no host: one key, one event. */
  function pairForget() {
    syncWrite(TRANSFER_PAIR_KEY, null);
    pairFire(null, null);
    return true;
  }

  function syncRead(key) {
    try { return JSON.parse(global.localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function syncWrite(key, value) {
    try {
      if (value == null) global.localStorage.removeItem(key);
      else global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  /* One id per browser profile -- reader/marginalia.js's own key and
   * shape, read here and MADE here only when no page has made it yet, so
   * the device a phone pushes as is the device its marks are stamped with. */
  function syncDeviceId() {
    try {
      var id = global.localStorage.getItem(SYNC_DEVICE_KEY);
      if (!id) {
        id = "d-" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
        global.localStorage.setItem(SYNC_DEVICE_KEY, id);
      }
      return id;
    } catch (e) { return null; }
  }

  /* Pure: the row's line from the last record. "Last synced 09:41 · 31
   * books · 12 marks". `now` is for the date: a sync from another day says
   * the day rather than a time that would read as today's. */
  function syncStateLine(last, now) {
    if (!last || !last.at) return "Never synced";
    var d = new Date(last.at), n = new Date(now == null ? Date.now() : now);
    var sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    var pad = function (x) { return (x < 10 ? "0" : "") + x; };
    var when = sameDay ? pad(d.getHours()) + ":" + pad(d.getMinutes())
      : d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    var books = Number(last.books) || 0, marks = Number(last.marks) || 0;
    return "Last synced " + when + " · " + books + (books === 1 ? " book" : " books")
      + " · " + marks + (marks === 1 ? " mark" : " marks");
  }

  /* Pure: the Connected-as line. The account when there is one; the paired
   * Studio on a phone; "This device only" otherwise. */
  function syncWhoLine(account, pair, isStudio) {
    if (account && account.kind === "google" && account.who) return "Connected as " + account.who + " · Google";
    if (account && account.kind === "icloud") return "Connected as iCloud Drive";
    if (isStudio) return "Studio on this Mac · the library";
    if (pair && pair.name) return "Paired with " + pair.name + " · This network";
    return "This device only";
  }

  /* Pure: the code as the row prints it, "483 912". */
  function syncCodeText(code) {
    var s = String(code || "").replace(/\D/g, "");
    return s.length === 6 ? s.slice(0, 3) + " " + s.slice(3) : s;
  }

  /* Pure: which remote a press talks to. Studio's own page -> its origin,
   * no token. A phone -> the pairing it kept. Neither -> null. */
  function syncRemote(originUrl, pair) {
    if (originUrl) return { base: originUrl, token: null, lan: false };
    if (pair && pair.base && pair.token) return { base: pair.base, token: pair.token, lan: true, name: pair.name };
    return null;
  }
  function syncUrl(remote, path) {
    return remote.base + path + (remote.token ? "?t=" + encodeURIComponent(remote.token) : "");
  }

  /* Everything this browser holds that only it may know: every
   * `ttstv.reader.marginalia.<slug>` key. A storage with no `key(i)` (the
   * test harness's) is walked by the slugs the position map names instead,
   * which is every book this device has opened. */
  function syncLocalMarginalia() {
    var out = {};
    var ls = global.localStorage;
    var take = function (k) {
      if (!k || k.indexOf(SYNC_MARG_PREFIX) !== 0) return;
      var rec = syncRead(k);
      if (rec && typeof rec === "object") out[k.slice(SYNC_MARG_PREFIX.length)] = rec;
    };
    try {
      if (ls && typeof ls.key === "function") {
        for (var i = 0; i < ls.length; i++) take(ls.key(i));
      } else {
        Object.keys(syncLocalPositions()).forEach(function (slug) { take(SYNC_MARG_PREFIX + slug); });
      }
    } catch (e) {}
    return out;
  }
  function syncLocalPositions() {
    var lib = syncRead(SYNC_LIB_KEY);
    return (lib && lib.positions && typeof lib.positions === "object") ? lib.positions : {};
  }
  /* Studio's merged answer is written whole: it already holds what this
   * browser sent, merged by the same rule the page merges by
   * (`studio/marginalia.py::merge` == `margMerge`, studio/tests/test_sync.py).
   * The `storage` event this fires is what an open reader repaints on. */
  function syncWriteMarginalia(records) {
    var n = 0;
    Object.keys(records || {}).forEach(function (slug) {
      var rec = records[slug];
      if (!rec || typeof rec !== "object" || rec.error) return;
      if (syncWrite(SYNC_MARG_PREFIX + slug, rec)) n++;
    });
    return n;
  }
  /* A read-modify-write of the ONE key the position lives in: everything
   * else in `ttstv.reader.library` goes back as found (cursor.js's rule). */
  function syncWritePositions(positions) {
    var lib = syncRead(SYNC_LIB_KEY);
    if (!lib || typeof lib !== "object") lib = {};
    lib.positions = positions && typeof positions === "object" ? positions : {};
    return syncWrite(SYNC_LIB_KEY, lib);
  }
  function syncCountMarks(records) {
    var n = 0;
    Object.keys(records || {}).forEach(function (slug) {
      var r = records[slug];
      ["notes", "highlights", "bookmarks"].forEach(function (k) {
        (r && Array.isArray(r[k]) ? r[k] : []).forEach(function (e) { if (e && !e.deleted) n++; });
      });
    });
    return n;
  }

  /* -------------------------------------------------------- the wire
   * Plain fetch, never through `ctx.net` -- the remote is not this page's
   * origin on a phone. Every call resolves; a failure is a sentence. */
  function syncFetchJSON(url, body) {
    if (!global.fetch) return Promise.resolve({ ok: false, why: "no fetch on this page" });
    var init = body === undefined ? { cache: "no-store" }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return global.fetch(url, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        return { ok: res.ok, status: res.status, body: d,
                 why: res.ok ? null : ((d && d.error) || ("HTTP " + res.status)) };
      });
    }).catch(function (e) {
      return { ok: false, status: 0, why: "Studio not reachable (" + String((e && e.message) || e) + ")" };
    });
  }

  /* Push, then pull. `say(line)` is the row's line; `remote` is
   * `syncRemote`'s answer; `bundle` is `library/import.js`'s module when the
   * page has it (the phone's pull needs it; the Mac never pulls -- its
   * books ARE the library). Resolves to {ok, books, marks, why, pulled}. */
  function runSync(remote, o) {
    if (remote && remote.kind === "drive") return runDriveSync(remote, o);
    o = o || {};
    var say = o.say || function () {};
    var device = o.device || syncDeviceId();
    var bundle = o.bundle || null;
    var href = o.href;
    var out = { ok: false, books: 0, marks: 0, pulled: 0, why: null };

    say("Pushing marks…");
    var records = syncLocalMarginalia();
    return syncFetchJSON(syncUrl(remote, SYNC.MARGINALIA), { device: device, records: records })
      .then(function (r) {
        if (!r.ok) throw new Error(r.why);
        syncWriteMarginalia(r.body.records || {});
        out.marks = typeof r.body.marks === "number" ? r.body.marks : syncCountMarks(r.body.records);
        say("Pushing position…");
        return syncFetchJSON(syncUrl(remote, SYNC.POSITIONS), { device: device, positions: syncLocalPositions() });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(r.why);
        syncWritePositions(r.body.positions || {});
        if (!remote.lan) return null;                       // the Mac: its shelf is the library
        say("Asking what Studio has…");
        return syncFetchJSON(syncUrl(remote, SYNC.MANIFEST));
      })
      .then(function (r) {
        if (r === null) return null;
        if (!r.ok) throw new Error(r.why);
        var man = r.body;
        out.books = (man.books || []).length;
        if (!bundle || typeof bundle.importFiles !== "function") {
          throw new Error("this page cannot import books (library/import.js is not loaded)");
        }
        return bundle.listInstalled(href).then(function (have) {
          var got = {};
          have.forEach(function (b) { got[b.slug + "-" + b.hash] = true; });
          var wanted = (man.books || []).filter(function (b) { return !got[b.slug + "-" + b.hash]; });
          var i = 0;
          function next() {
            if (i >= wanted.length) return Promise.resolve();
            var b = wanted[i++];
            say("Pulling " + i + " of " + wanted.length + " · " + (b.title || b.slug));
            var byRel = {};
            b.files.forEach(function (f) { byRel[f.rel] = f.url; });
            var fetchRel = function (rel) {
              return global.fetch(syncUrl(remote, byRel[rel]), { cache: "no-store" }).then(function (res) {
                if (!res.ok) throw new Error(rel + ": HTTP " + res.status);
                return res.arrayBuffer();
              }).then(function (buf) { return new Uint8Array(buf); });
            };
            return bundle.importFiles(b.slug, b.files.map(function (f) { return f.rel; }), fetchRel, {
              href: href,
              onProgress: function (p) {
                say("Pulling " + i + " of " + wanted.length + " · " + (b.title || b.slug)
                    + " · " + p.done + "/" + p.total);
              },
            }).then(function (rep) {
              if (!rep.ok) throw new Error((b.title || b.slug) + ": " + (rep.errors || []).join("; "));
              out.pulled++;
              return next();
            });
          }
          return next();
        });
      })
      .then(function () {
        out.ok = true;
        return out;
      }, function (e) {
        out.why = String((e && e.message) || e);
        return out;
      });
  }

  /* The phone's half of pairing: find Studios (through the host, Bonjour),
   * or take an address, then the code. Resolves to the pairing record or
   * {why}. `hello` and `pair` are the two open routes. */
  function syncDiscover(host) {
    if (!host || typeof host.syncDiscover !== "function") return Promise.resolve([]);
    var timer = new Promise(function (res) { global.setTimeout(function () { res([]); }, SYNC_DISCOVER_MS + 1500); });
    return Promise.race([Promise.resolve().then(function () { return host.syncDiscover(SYNC_DISCOVER_MS); }), timer])
      .then(function (list) { return Array.isArray(list) ? list : []; }, function () { return []; });
  }
  function syncBaseOf(hostOrAddress, port) {
    var s = String(hostOrAddress || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!s) return null;
    if (port && s.indexOf(":") < 0) s += ":" + port;
    return "http://" + s;
  }
  function syncPair(base, code, device, name) {
    return syncFetchJSON(base + SYNC.HELLO).then(function (h) {
      if (!h.ok) return { why: h.why };
      return syncFetchJSON(base + SYNC.PAIR, { code: String(code || "").replace(/\D/g, ""), device: device, name: name || "" })
        .then(function (r) {
          if (!r.ok) return { why: r.why };
          return { base: base, token: r.body.token, name: r.body.name || h.body.name || base, paired: Date.now() };
        });
    });
  }

  /* ================================ THE ACCOUNT, AND GOOGLE DRIVE (26b)
   * Osca, 6 Sep 2026: *"Google IS the account"*, and job 26b: *"… the same
   * runSync with a second adapter."* The adapter -- Google's PKCE on the
   * phone, the Drive v3 client, the `Frank/` folder, the three merges and
   * the press itself -- is `library/drive.js` (`window.TTSTVDrive`), loaded
   * by settings.html beside import.js; it lives there because what it pulls
   * lands in import.js's store, and because Google's wire vocabulary is not
   * a word this page may say (`test_cloud_gpu.py`). What stays HERE is the
   * page's: the routes on the Mac, where the press's transport is kept, the
   * three lines the rows print, and the store the adapter is handed --
   * this file's own readers and writers of the reader's records, so
   * drive.js names no key of the reader's.
   *
   * TWO HALVES OF ONE ACCOUNT. On the Mac the account is STUDIO's
   * (`studio/google.py`: the loopback PKCE flow in the shipped Python, the
   * refresh token in `TTS_DATA/studio/account.json`) and this page presses
   * it -- `POST /account/google`, then `GET /account` until the sign-in is
   * over -- and reads `who` off it. On the phone the account is the page's
   * (`TTSTVDrive.googleSignInPhone` through `TTSTVHost.googleSignIn`). The
   * Mac's press is Studio's own loop (`POST /sync/drive`, `GET /sync/drive`
   * polled for the line) after the LAN loop has put this browser's marks
   * into Studio's mirror; the phone's is `runSync` with `kind: "drive"`. */
  var ACCOUNT = { GET: "/account", GOOGLE: "/account/google", SIGNOUT: "/account/signout", DRIVE: "/sync/drive" };
  var SYNC_THROUGH_KEY = "ttstv.sync.through";          // "gdrive" | "lan"
  var SYNC_DRIVE_LAST_KEY = "ttstv.sync.driveLast";     // {at, books, marks, pushed}
  var SYNC_SETTINGS_KEY = "ttstv.reader.settings";      // prefs.js's record {version, saved, settings}
  var ACCOUNT_POLL_MS = 1000;

  function driveModule() { return global.TTSTVDrive || null; }
  /* The store the adapter is handed: this page's own readers and writers. */
  function syncStore() {
    return {
      marginalia: syncLocalMarginalia,
      writeMarginalia: function (slug, rec) { return syncWrite(SYNC_MARG_PREFIX + slug, rec); },
      positions: syncLocalPositions,
      writePositions: syncWritePositions,
      settings: function () { return syncRead(SYNC_SETTINGS_KEY); },
      writeSettings: function (rec) { return syncWrite(SYNC_SETTINGS_KEY, rec); },
      deviceId: syncDeviceId,
    };
  }
  function runDriveSync(remote, o) {
    var D = driveModule();
    if (!D) return Promise.resolve({ ok: false, books: 0, marks: 0, pulled: 0, why: "this page cannot reach Drive (library/drive.js is not loaded)" });
    return D.runDriveSync(remote, Object.assign({ store: syncStore() }, o || {}));
  }
  function googleAccessToken(force) {
    var D = driveModule();
    if (!D) return Promise.reject(new Error("library/drive.js is not loaded"));
    return D.googleAccessToken(global.fetch, force);
  }
  function googleSignInPhone(host, o) {
    var D = driveModule();
    if (!D) return Promise.resolve({ why: "this page cannot sign in (library/drive.js is not loaded)" });
    return D.googleSignInPhone(host, o).then(function (r) {
      if (r && r.who) syncWrite(SYNC_ACCOUNT_KEY, { kind: "google", who: r.who, at: Date.now() });
      return r;
    });
  }
  function googleSignOutPhone() {
    var D = driveModule();
    return (D ? D.googleSignOutPhone(global.fetch) : Promise.resolve({ ok: true })).then(function (r) {
      syncWrite(SYNC_ACCOUNT_KEY, { kind: "device", who: null, at: Date.now() });
      return r;
    });
  }

  /* Pure: which transport a press takes. Google signed in and the Drive
   * row in use (the default once signed in) -> "gdrive"; else "lan". */
  function syncThrough(account, through) {
    var signed = !!(account && account.kind === "google" && account.who);
    if (!signed) return "lan";
    return through === "lan" ? "lan" : "gdrive";
  }
  /* Pure: the Drive row's own line. */
  function driveStateLine(account, last) {
    if (!(account && account.kind === "google" && account.who)) return "Not signed in · the account's folder, Drive/Frank";
    var parts = ["Drive/Frank · " + account.who];
    if (last && last.at) {
      parts.push(syncStateLine({ at: last.at, books: last.books, marks: last.marks }).replace(/^Last synced /, "synced "));
    }
    return parts.join(" · ");
  }
  /* Pure: the Mac's Drive press as the row's line, from `GET /sync/drive`. */
  function driveProgressLine(s) {
    if (!s) return "";
    if (s.phase === "failed") return s.error || "Drive sync failed";
    if (s.phase !== "running") return "";
    var step = { connecting: "Connecting to Drive…", reading: "Reading Drive/Frank…", books: "Pushing books…",
                 marks: "Merging marks…", positions: "Merging positions…", settings: "Settings…" }[s.step] || "Syncing…";
    if (s.step === "books" && s.total) {
      step = "Pushing " + Math.min(s.done + 1, s.total) + " of " + s.total + (s.book ? " · " + s.book : "") + (s.file ? " · " + s.file : "");
    }
    return step;
  }

  /* ================================================== FIRST RUN
   * Osca, 6 Sep: *"Google IS the account. First run (both apps): Sign in
   * with Google · Use iCloud · Skip — this device only."* The picture is
   * `design/reader/settings.html`'s FIRST RUN block (b452bcd): a lead row and
   * three rows, "drawn in the page's own rows so it can be lifted whole" --
   * and it is lifted whole, by ONE builder, into two places: the Transfer
   * tab's card (below, where a person can come back to it) and the GATE the
   * Library opens on before there is an account to have settings about
   * (`firstRun`, the same day's second `go`). One drawing, two doors, and
   * the choice lands in ONE place: `ttstv.sync.account`, which the Transfer
   * tab already reads -- so the card folds away in Settings the moment the
   * gate is answered in the Library, and the gate never shows again once
   * the card has been answered in Settings.
   *
   * Three choices and no fourth. Google and iCloud are not built -- their
   * buttons are inert with the reason (this file's rule for a face the
   * device lacks) -- so today the choice a person CAN make is Skip, which is
   * a real answer and not a dismissal: the reader works entirely on this
   * device, and the Sync row reads "This device only" from then on. */
  var NOT_BUILT_GOOGLE = "not built yet -- needs the Google client ids (settings/STATUS.md §6, §8)";
  var NOT_BUILT_ICLOUD = "not built yet -- the iCloud transport is after Google Drive (settings/STATUS.md §8)";

  /* Pure: has first run been answered? By a choice recorded in the store,
   * or by a phone that paired -- a choice made with the network rather than
   * a button. `pair` is read from the same store; both are passed in so the
   * rule is testable without one. */
  function firstRunChosen(account, pair) {
    return !!account || !!(pair && pair.token);
  }

  /* The card: a `set-head` and a `set-card tr-first` with the lead row and
   * the three rows. `onSkip` is the one live verb. Returns the two elements
   * and the three buttons by name. */
  function buildFirstRunCard(doc, onSkip) {
    var head = kEl(doc, "div", "set-head", "First run");
    var card = kEl(doc, "div", "set-card tr-first");
    var buttons = {};
    function row(key, name, note, label, primary, onPress, why) {
      var r = kEl(doc, "div", "set-row");
      r.dataset.choice = key;
      var rl = kEl(doc, "div", "set-l");
      rl.appendChild(kEl(doc, "div", "kag-line tr-name", name));
      rl.appendChild(kEl(doc, "small", "kag-why-here", note));
      var rc = kEl(doc, "div", "set-c kag-row");
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "kag-btn" + (primary ? " kag-primary" : "");
      b.dataset.choice = key;
      b.textContent = label;
      if (why) { b.disabled = true; b.title = why; }
      else b.addEventListener("click", onPress);
      rc.appendChild(b);
      r.appendChild(rl); r.appendChild(rc);
      card.appendChild(r);
      buttons[key] = b;
      return b;
    }
    var lead = kEl(doc, "div", "set-row tr-lead");
    var leadL = kEl(doc, "div", "set-l");
    leadL.appendChild(kEl(doc, "div", "set-name", "Your books, wherever you read them"));
    leadL.appendChild(kEl(doc, "small", "kag-why-here", "The shelf, where you are in each book, and every mark you have made."));
    lead.appendChild(leadL); card.appendChild(lead);
    row("google", "Sign in with Google", "The account — and the first place to sync through. Not built yet.", "Sign in", true, null, NOT_BUILT_GOOGLE);
    row("icloud", "Use iCloud", "Apple devices, nothing to type. No account — this device stays signed out. Not built yet.", "Use iCloud", false, null, NOT_BUILT_ICLOUD);
    row("device", "Skip — this device only", "Nothing leaves this device. You can sign in later, here.", "Skip", false, onSkip);
    return { head: head, card: card, buttons: buttons };
  }

  /* The one write a choice is. `kind` is the store's word ("device",
   * "google", "icloud"); the record is the shape the Transfer tab reads. */
  function firstRunChoose(kind, who) {
    var account = { kind: kind, who: who || null, at: Date.now() };
    syncWrite(SYNC_ACCOUNT_KEY, account);
    return account;
  }

  /* THE GATE. `firstRun(document)` is the Library's one line: if first run
   * has been answered it does nothing and returns null; otherwise it draws
   * the card full-window, over the page, as the body's first child, and
   * returns a handle. Skip records the choice and takes the gate down -- the
   * Library under it was loading all along, so nothing is waited for. A
   * `ttstv:firstrun` event goes out on the document with the record, for a
   * page that wants to know. No Escape and no scrim-click: the three rows
   * are the ways out, and Skip is the honest one.
   *
   * The style is this file's own sheet, scoped to `.ttstv-settings`: the
   * gate wears that class, so the rows are the Settings window's rows to the
   * pixel, and the Library's stylesheet is not asked to know them. */
  /* The gate's own seven rules, in a sheet of their own rather than in
   * `CSS` above: that array is copied byte for byte into the design mock
   * (`test_mock_settings.py`), and the gate is not the Settings window's
   * picture -- it is the card, placed. `position: fixed; inset: 0` is the
   * whole of the gating; the sheet is the Settings window's own 560 and
   * sits high rather than centred, the way a first screen does; the ground
   * is the page's own `--bg`, so the theme is whichever the page is. */
  var GATE_STYLE_ID = "ttstv-firstrun-style";
  var GATE_CSS = [
    '.ttstv-settings.fr-gate {',
    '  position: fixed; inset: 0; z-index: 60; overflow: auto;',
    '  background: var(--bg); color: var(--fg);',
    '  display: flex; justify-content: center; align-items: flex-start;',
    '  padding: max(24px, 8vh) 16px 24px; box-sizing: border-box;',
    '}',
    '.ttstv-settings.fr-gate .fr-sheet { width: 100%; max-width: 560px; }',
  ].join("\n");
  function injectGateStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(GATE_STYLE_ID)) return;
    var st = doc.createElement("style");
    st.id = GATE_STYLE_ID;
    st.textContent = GATE_CSS;
    doc.head.appendChild(st);
  }

  function firstRun(doc, opts) {
    opts = opts || {};
    doc = doc || global.document;
    if (!doc || !doc.body) return null;
    if (firstRunChosen(syncRead(SYNC_ACCOUNT_KEY), syncRead(SYNC_PAIR_KEY))) return null;
    injectStyle(doc);
    injectGateStyle(doc);
    var gate = kEl(doc, "div", "ttstv-settings fr-gate");
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-label", "First run");
    var sheet = kEl(doc, "div", "fr-sheet");
    var handle = { el: gate, account: null };
    var built = buildFirstRunCard(doc, function () { handle.choose("device"); });
    sheet.appendChild(built.head); sheet.appendChild(built.card);
    gate.appendChild(sheet);
    handle.buttons = built.buttons;
    handle.choose = function (kind, who) {
      handle.account = firstRunChoose(kind, who);
      handle.remove();
      try {
        if (doc.dispatchEvent && global.CustomEvent) {
          doc.dispatchEvent(new global.CustomEvent("ttstv:firstrun", { detail: handle.account }));
        }
      } catch (e) { /* a document that cannot dispatch is still a document */ }
      if (typeof opts.onChoose === "function") opts.onChoose(handle.account);
      return handle.account;
    };
    handle.remove = function () {
      if (gate.parentNode) gate.parentNode.removeChild(gate);
    };
    if (doc.body.firstChild) doc.body.insertBefore(gate, doc.body.firstChild);
    else doc.body.appendChild(gate);
    if (built.buttons.device.focus) { try { built.buttons.device.focus(); } catch (e) { /* no focus in a harness */ } }
    return handle;
  }

  function buildTransferPanel(panel, ctx) {
    var doc = panel.ownerDocument;
    var isStudio = !!origin();
    var host = global.TTSTVHost;

    /* ---- First run: the card, lifted whole (`buildFirstRunCard`), drawn
     * until a choice is made -- here or at the Library's gate, which writes
     * the same key. Signing in later happens in the Account row. */
    var account = syncRead(SYNC_ACCOUNT_KEY);
    var firstBuilt = buildFirstRunCard(doc, function () {
      account = firstRunChoose("device");
      paint();
    });
    var firstHead = firstBuilt.head, first = firstBuilt.card;
    panel.appendChild(firstHead); panel.appendChild(first);

    /* ---- the Sync card: the line and the verb (who is the Account row's) */
    panel.appendChild(kEl(doc, "div", "set-head", "Sync"));
    var card = kEl(doc, "div", "set-card");
    panel.appendChild(card);
    var row = kEl(doc, "div", "set-row tr-acts");
    var l = kEl(doc, "div", "set-l");
    l.appendChild(kEl(doc, "div", "set-name", "Sync"));
    var stateLine = kEl(doc, "small", "kag-line tr-state", "");
    l.appendChild(stateLine);
    var c = kEl(doc, "div", "set-c kag-row kag-acts");
    var syncBtn = doc.createElement("button");
    syncBtn.type = "button";
    syncBtn.className = "kag-btn tr-sync kag-primary";
    syncBtn.textContent = "Sync";
    c.appendChild(syncBtn);
    row.appendChild(l); row.appendChild(c);
    card.appendChild(row);

    /* ---- Account: one row, one fact -- who. Sign out when there is an
     * account; the Google button, inert with its reason, when there is not. */
    panel.appendChild(kEl(doc, "div", "set-head", "Account"));
    var acctCard = kEl(doc, "div", "set-card");
    panel.appendChild(acctCard);
    var acct = kEl(doc, "div", "set-row tr-acct");
    var acctL = kEl(doc, "div", "set-l");
    var who = kEl(doc, "div", "kag-line kag-who st", "");
    var whoWhy = kEl(doc, "small", "kag-why-here", "");
    acctL.appendChild(who); acctL.appendChild(whoWhy);
    var acctC = kEl(doc, "div", "set-c kag-row");
    var acctBtn = doc.createElement("button");
    acctBtn.type = "button";
    acctBtn.className = "kag-btn tr-google";
    acctC.appendChild(acctBtn);
    acct.appendChild(acctL); acct.appendChild(acctC);
    acctCard.appendChild(acct);

    /* ---- Sync through: the transports, one in use at a time */
    panel.appendChild(kEl(doc, "div", "set-head", "Sync through"));
    var dests = kEl(doc, "div", "set-card tr-destcard");
    panel.appendChild(dests);

    function destRow(id, label, note, on) {
      var r = kEl(doc, "div", "set-row tr-dest");
      r.dataset.dest = id;
      var rl = kEl(doc, "div", "set-l");
      var name = kEl(doc, "div", "kag-line tr-name kag-who st", label);
      name.classList.toggle("kag-on", !!on);
      rl.appendChild(name);
      var why = kEl(doc, "small", "kag-why-here", note || "");
      rl.appendChild(why);
      var rc = kEl(doc, "div", "set-c kag-row");
      r.appendChild(rl); r.appendChild(rc);
      dests.appendChild(r);
      return { row: r, name: name, why: why, c: rc };
    }
    function pick(label, id, on) {
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "kag-btn tr-pick" + (on ? " kag-primary" : "");
      b.dataset.dest = id;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? "In use" : label;
      return b;
    }

    // Google Drive -- the account (addendum, 6 Sep; built 26b). In use by
    // default once signed in; "Use" on This network hands the press back
    // to the LAN without signing out.
    var gd = destRow("gdrive", "Google Drive", "Not signed in · the account's folder, Drive/Frank", false);
    var gdPick = gd.c.appendChild(pick("Use", "gdrive", false));

    var ic = destRow("icloud", "iCloud Drive", "iCloud Drive/Frank · Apple devices, nothing to type · not built yet", false);
    ic.c.appendChild(pick("Use", "icloud", false)).disabled = true;

    // This network -- the no-account path, and the one that works today.
    var lanRow = destRow("lan", "This network", "", false);
    var codeEl = kEl(doc, "span", "kag-line kag-dim set-val tr-code", "");
    var lanPick = pick("Use", "lan", false);
    var studioSel = null, addrIn = null, codeIn = null;
    if (isStudio) {
      lanRow.c.appendChild(codeEl);
      lanRow.c.appendChild(lanPick);
      lanPick.disabled = true;
    } else {
      studioSel = doc.createElement("select");
      studioSel.className = "set-menu"; studioSel.setAttribute("aria-label", "Studio"); studioSel.hidden = true;
      addrIn = doc.createElement("input");
      addrIn.type = "text"; addrIn.className = "kag-in tr-addr"; addrIn.placeholder = "192.168.1.5:41499";
      addrIn.setAttribute("aria-label", "Studio address"); addrIn.autocomplete = "off"; addrIn.hidden = true;
      codeIn = doc.createElement("input");
      codeIn.type = "text"; codeIn.className = "kag-in tr-codein"; codeIn.inputMode = "numeric";
      codeIn.maxLength = 7; codeIn.placeholder = "code"; codeIn.setAttribute("aria-label", "Pairing code");
      codeIn.autocomplete = "off"; codeIn.hidden = true;
      lanRow.c.appendChild(studioSel); lanRow.c.appendChild(addrIn); lanRow.c.appendChild(codeIn);
      lanRow.c.appendChild(lanPick);
    }

    var kg = destRow("kaggle", "Kaggle", "the key Cloud GPU uses · not a transport yet", false);
    kg.c.appendChild(pick("Use", "kaggle", false)).disabled = true;

    /* ---- Your door (23d; Osca, 6 Sep): the Pair field, the second writer
     * of `transfer.pairing`. One row: the dot and the line on the left, the
     * address, the pass and Pair on the right -- or Forget once paired. */
    panel.appendChild(kEl(doc, "div", "set-head", "Your door"));
    var doorCard = kEl(doc, "div", "set-card tr-doorcard");
    panel.appendChild(doorCard);
    var doorRow = kEl(doc, "div", "set-row tr-pair");
    var doorL = kEl(doc, "div", "set-l");
    var doorName = kEl(doc, "div", "kag-line tr-name kag-who st", "Your door");
    var doorWhy = kEl(doc, "small", "kag-why-here tr-pairline", "");
    doorL.appendChild(doorName); doorL.appendChild(doorWhy);
    var doorC = kEl(doc, "div", "set-c kag-row");
    var pairUrlIn = doc.createElement("input");
    pairUrlIn.type = "text"; pairUrlIn.className = "kag-in tr-pair-url"; pairUrlIn.placeholder = "192.168.1.24:8099";
    pairUrlIn.setAttribute("aria-label", "Door address"); pairUrlIn.autocomplete = "off";
    var pairPassIn = doc.createElement("input");
    pairPassIn.type = "password"; pairPassIn.className = "kag-in kag-in-key tr-pair-pass"; pairPassIn.placeholder = "pass";
    pairPassIn.setAttribute("aria-label", "Door pass"); pairPassIn.autocomplete = "off";
    var pairBtn = doc.createElement("button");
    pairBtn.type = "button"; pairBtn.className = "kag-btn kag-primary tr-pair-go"; pairBtn.textContent = "Pair";
    var pairForgetBtn = doc.createElement("button");
    pairForgetBtn.type = "button"; pairForgetBtn.className = "kag-btn danger tr-pair-forget"; pairForgetBtn.textContent = "Forget";
    doorC.appendChild(pairUrlIn); doorC.appendChild(pairPassIn); doorC.appendChild(pairBtn); doorC.appendChild(pairForgetBtn);
    doorRow.appendChild(doorL); doorRow.appendChild(doorC);
    doorCard.appendChild(doorRow);

    var say = kEl(doc, "div", "set-note kag-line kag-say tr-say");
    say.setAttribute("role", "status");
    panel.appendChild(say);

    function paintPair() {
      var rec = pairRead();
      var on = !!(rec && rec.url);
      doorName.classList.toggle("kag-on", on);
      doorWhy.textContent = pairLine(rec);
      pairUrlIn.hidden = on; pairPassIn.hidden = on; pairBtn.hidden = on;
      pairForgetBtn.hidden = !on;
      return rec;
    }
    /* READ AND CLEAR IN ONE STATEMENT -- the Cloud GPU cards' `take`: the
     * pass leaves the field and exists as the argument of one write. */
    function takePair(input) { var v = input.value; input.value = ""; return v; }
    pairBtn.addEventListener("click", function () {
      var url = pairUrlOf(takePair(pairUrlIn)), pass = takePair(pairPassIn);
      if (!url || !pass) { say.textContent = url ? "The pass, from Studio's square." : "An http address and a pass, both."; return; }
      say.textContent = "Pairing…";
      pairWrite({ url: url, pass: pass }).then(function (fp) {
        pass = null;
        say.textContent = "Paired · pass " + fp + " — compare it with Studio's.";
        paintPair();
      }, function (e) {
        pass = null;
        say.textContent = "Not paired: " + String((e && e.message) || e) + ".";
        paintPair();
      });
    });
    pairForgetBtn.addEventListener("click", function () {
      pairForget();
      say.textContent = "Forgotten. The door is still up; this device just no longer knows it.";
      paintPair();
    });
    // the other writer -- the phone's link -- lands while this tab is open
    if (typeof global.addEventListener === "function") {
      global.addEventListener(TRANSFER_PAIR_EVENT, function () { paintPair(); });
      global.addEventListener("storage", function (e) { if (!e || !e.key || e.key === TRANSFER_PAIR_KEY) paintPair(); });
    }
    paintPair();

    /* ---- state */
    var pair = syncRead(SYNC_PAIR_KEY);
    var last = syncRead(SYNC_LAST_KEY);
    var studio = null;            // GET /sync, on the Mac
    var studioAcct = null;        // GET /account, on the Mac -- the account is Studio's there (26b)
    var driveLast = syncRead(SYNC_DRIVE_LAST_KEY);
    var through = syncRead(SYNC_THROUGH_KEY);
    var busy = false;
    var found = [];
    /* Google is built (26b): on the Mac the press is Studio's loopback
     * flow, on the phone the host's browser + this page's PKCE. A page with
     * neither (the PWA on the web, a file:// open) says so and stays inert. */
    var canGoogle = isStudio || !!(host && host.google && host.google.clientId && typeof host.googleSignIn === "function");
    var NO_GOOGLE_HERE = "no Google client on this device -- sign in is built for Frank on the phone and Studio on the Mac";

    /* The account this page acts on: Studio's on the Mac (`GET /account`),
     * this page's on the phone. `account` (localStorage) still records the
     * first-run choice on both. */
    function acctNow() {
      if (isStudio && studioAcct) {
        if (studioAcct.google && studioAcct.google.email) {
          return { kind: "google", who: studioAcct.google.email, at: studioAcct.google.since };
        }
        if (account && account.kind === "google") return { kind: "device", who: null, at: account.at };   // Studio signed out
      }
      return account;
    }

    function paintLine(text) { stateLine.textContent = text; }

    function paint() {
      // first run is over once any choice is recorded -- or once a phone has
      // paired, which is a choice made with the network rather than a button
      var a = acctNow();
      var chosen = firstRunChosen(a || account, pair);
      firstHead.hidden = chosen;
      first.hidden = chosen;
      var signed = !!(a && a.kind !== "device" && a.who);
      who.textContent = signed ? syncWhoLine(a, null, false) : "Not signed in";
      who.classList.toggle("kag-on", signed);
      whoWhy.textContent = signed ? "Google · the account every device signs in to"
        : syncWhoLine(null, pair, isStudio) + (canGoogle ? " · Google is the account" : " · " + NO_GOOGLE_HERE);
      acctBtn.textContent = signed ? "Sign out" : "Sign in with Google";
      acctBtn.classList.toggle("danger", signed);
      acctBtn.classList.toggle("kag-primary", !signed);
      acctBtn.disabled = !signed && !canGoogle;
      acctBtn.title = signed || canGoogle ? "" : NO_GOOGLE_HERE;
      if (isStudio && studioAcct && studioAcct.ids && !studioAcct.ids.desktop && !signed) {
        acctBtn.title = "no desktop client id yet -- paste it into " + (studioAcct.path || "TTS_DATA/studio/account.json");
      }
      // the Drive row (26b): on when it is the press's transport
      var useDrive = signed && syncThrough(a, through) === "gdrive";
      gd.name.classList.toggle("kag-on", useDrive);
      gd.why.textContent = driveStateLine(a, driveLast);
      gdPick.textContent = useDrive ? "In use" : "Use";
      gdPick.classList.toggle("kag-primary", useDrive);
      gdPick.setAttribute("aria-pressed", useDrive ? "true" : "false");
      gdPick.disabled = !signed;
      gdPick.title = signed ? "" : "sign in with Google first";
      if (!busy) paintLine(syncStateLine(last));
      if (isStudio) {
        var s = studio || {};
        var on = !!s.port;
        lanRow.name.classList.toggle("kag-on", on);
        codeEl.textContent = syncCodeText(s.code);
        var where = s.address && s.port ? s.address + ":" + s.port : (s.port ? "port " + s.port : "");
        var parts = ["Studio on this Mac · no account"];
        if (where) parts.push(where);
        if (s.paired) parts.push(s.paired + (s.paired === 1 ? " phone paired" : " phones paired"));
        if (s.port && !s.bonjour && s.bonjour_why) parts.push(s.bonjour_why);
        if (s.depot === false) parts.push("depot not found -- nothing can be merged");
        lanRow.why.textContent = parts.join(" · ");
        var lanUsed = on && !useDrive;
        lanPick.textContent = lanUsed ? "In use" : "Use";
        lanPick.classList.toggle("kag-primary", lanUsed);
        lanPick.setAttribute("aria-pressed", lanUsed ? "true" : "false");
        lanPick.disabled = !on || !signed;          // a way back to the LAN, only when Drive is the other choice
      } else {
        var paired = !!(pair && pair.token);
        lanRow.name.classList.toggle("kag-on", paired);
        lanRow.why.textContent = paired ? "Paired with " + pair.name + " · " + pair.base.replace(/^http:\/\//, "")
          : "No Studio paired yet · press Sync to find one";
        lanPick.textContent = paired ? "Forget" : "Use";
        lanPick.classList.toggle("kag-primary", false);
        lanPick.setAttribute("aria-pressed", paired ? "true" : "false");
        lanPick.disabled = !paired && studioSel.hidden;
      }
    }

    /* the phone's picker, shown inside the row until the code lands */
    function showPicker(list) {
      found = list || [];
      while (studioSel.firstChild) studioSel.removeChild(studioSel.firstChild);
      found.forEach(function (s, i) {
        var opt = doc.createElement("option");
        opt.value = String(i);
        opt.textContent = s.name || (s.host + ":" + s.port);
        studioSel.appendChild(opt);
      });
      studioSel.hidden = found.length === 0;
      addrIn.hidden = found.length > 0;
      codeIn.hidden = false;
      lanPick.textContent = "Use";
      lanPick.disabled = false;
      lanRow.why.textContent = found.length
        ? found.length + (found.length === 1 ? " Studio found" : " Studios found") + " · type the code Studio's row shows"
        : "No Studio found on this network · type the address and code Studio's row shows";
      try { (found.length ? codeIn : addrIn).focus(); } catch (e) {}
    }
    function hidePicker() {
      studioSel.hidden = true; addrIn.hidden = true; codeIn.hidden = true;
    }

    function pairFromPicker() {
      var base;
      if (!studioSel.hidden && found.length) {
        var s = found[Number(studioSel.value) || 0];
        base = syncBaseOf(s.host, s.port);
      } else {
        base = syncBaseOf(addrIn.value);
      }
      if (!base) { say.textContent = "Which Studio? Type its address."; return Promise.resolve(null); }
      var code = String(codeIn.value || "").replace(/\D/g, "");
      if (code.length !== 6) { say.textContent = "The code is six digits."; return Promise.resolve(null); }
      say.textContent = "Pairing…";
      return syncPair(base, code, syncDeviceId(), (host && host.deviceName) || "").then(function (p) {
        if (!p || p.why) { say.textContent = (p && p.why) || "could not pair"; return null; }
        pair = p;
        syncWrite(SYNC_PAIR_KEY, pair);
        hidePicker();
        say.textContent = "Paired with " + p.name;
        paint();
        return p;
      });
    }

    function finish(res) {
      busy = false;
      syncBtn.disabled = false;
      if (res.ok) {
        last = { at: Date.now(), books: res.books, marks: res.marks };
        if (isStudio) last.books = (studio && studio.books) != null ? studio.books : last.books;
        syncWrite(SYNC_LAST_KEY, last);
        say.textContent = res.pulled ? "Pulled " + res.pulled + (res.pulled === 1 ? " book" : " books") : "";
      } else {
        say.textContent = res.why || "";
      }
      if (isStudio) return ask().then(paint);
      paint();
    }

    /* The Mac's Drive press (26b): Studio's own loop, this row's line. */
    function driveMac() {
      return ctx.postJSON(ACCOUNT.DRIVE, {}).then(function (r) {
        if (!r.ok) return { ok: false, why: r.why };
        return new Promise(function (resolve) {
          function poll() {
            ctx.getJSON(ACCOUNT.DRIVE).then(function (s) {
              if (!s) { resolve({ ok: false, why: "Studio not reachable" }); return; }
              if (s.live) { paintLine(driveProgressLine(s)); global.setTimeout(poll, ACCOUNT_POLL_MS); return; }
              if (s.phase === "failed") { resolve({ ok: false, why: s.error || "Drive sync failed" }); return; }
              var l = s.last || {};
              resolve({ ok: true, books: l.books || 0, marks: l.marks || 0, pushed: l.pushed || 0, pulled: 0 });
            });
          }
          poll();
        });
      });
    }
    function finishDrive(res) {
      if (res.ok) {
        driveLast = { at: Date.now(), books: res.books, marks: res.marks, pushed: res.pushed || 0 };
        syncWrite(SYNC_DRIVE_LAST_KEY, driveLast);
      }
      return res;
    }

    function press() {
      if (busy) return Promise.resolve();
      var a = acctNow();
      if (syncThrough(a, through) === "gdrive") {
        busy = true;
        syncBtn.disabled = true;
        if (isStudio) {
          // this browser's marks into Studio's mirror first, then Studio to Drive
          return runSync(syncRemote(origin(), null), { say: paintLine })
            .then(function (lan) { return lan.ok ? driveMac() : lan; })
            .then(finishDrive).then(function (res) {
              finish(res);
              if (res.ok) say.textContent = res.pushed ? "Pushed " + res.pushed + (res.pushed === 1 ? " book" : " books") + " to Drive" : "Drive is up to date";
            });
        }
        return runSync({ kind: "drive", token: googleAccessToken }, {
          say: paintLine, bundle: global.TTSTVBundle || null, href: global.location && global.location.href,
        }).then(finishDrive).then(finish);
      }
      var remote = syncRemote(origin(), pair);
      if (!remote) {
        // the first press on a phone: find a Studio, right here in the row
        say.textContent = "Looking for Studio on this network…";
        return syncDiscover(host).then(function (list) {
          showPicker(list);
          say.textContent = "";
        });
      }
      busy = true;
      syncBtn.disabled = true;
      return runSync(remote, {
        say: paintLine, bundle: global.TTSTVBundle || null,
        href: global.location && global.location.href,
      }).then(finish);
    }

    /* Sign in (26b). Mac: `POST /account/google`, then `GET /account` until
     * the loopback flow is over. Phone: `googleSignInPhone` through the
     * host. Either way the Drive row becomes the press's transport. */
    function signIn() {
      if (busy) return Promise.resolve(null);
      if (isStudio) {
        say.textContent = "Opening Google in your browser…";
        return ctx.postJSON(ACCOUNT.GOOGLE, {}).then(function (r) {
          if (!r.ok) { say.textContent = r.why || "could not start the sign-in"; return null; }
          return new Promise(function (resolve) {
            function poll() {
              ctx.getJSON(ACCOUNT.GET).then(function (d) {
                if (!d) { resolve(null); return; }
                studioAcct = d;
                var si = d.signin || {};
                if (si.live) { global.setTimeout(poll, ACCOUNT_POLL_MS); return; }
                say.textContent = si.phase === "done" ? "Signed in as " + (si.who || (d.google && d.google.email) || "")
                  : (si.error || "");
                if (si.phase === "done") { through = "gdrive"; syncWrite(SYNC_THROUGH_KEY, through); }
                paint();
                resolve(d);
              });
            }
            poll();
          });
        });
      }
      return googleSignInPhone(host, { say: function (l) { say.textContent = l; } }).then(function (r) {
        if (r.why) { say.textContent = r.why; }
        else { account = syncRead(SYNC_ACCOUNT_KEY); through = "gdrive"; syncWrite(SYNC_THROUGH_KEY, through); say.textContent = "Signed in as " + r.who; }
        paint();
        return r;
      });
    }
    function signOut() {
      if (busy) return Promise.resolve(null);
      if (isStudio) {
        return ctx.postJSON(ACCOUNT.SIGNOUT, {}).then(function () {
          account = firstRunChoose("device");
          say.textContent = "Signed out.";
          return ask().then(paint);
        });
      }
      return googleSignOutPhone().then(function () {
        account = syncRead(SYNC_ACCOUNT_KEY);
        say.textContent = "Signed out.";
        paint();
      });
    }

    function ask() {
      if (!isStudio) return Promise.resolve(null);
      var acctAsk = ctx.getJSON(ACCOUNT.GET).then(function (d) { studioAcct = d; return d; });
      return acctAsk.then(function () { return ctx.getJSON(SYNC.GET); }).then(function (d) {
        studio = d;
        if (d && d.books == null) {
          return ctx.getJSON(SYNC.MANIFEST).then(function (m) {
            if (m && Array.isArray(m.books)) studio.books = m.books.length;
            if (m && typeof m.marks === "number") studio.marks = m.marks;
            return studio;
          });
        }
        return studio;
      }, function () { studio = null; return null; });
    }

    syncBtn.addEventListener("click", press);
    acctBtn.addEventListener("click", function () {
      var a = acctNow();
      return (a && a.kind === "google" && a.who) ? signOut() : signIn();
    });
    gdPick.addEventListener("click", function () {
      if (gdPick.disabled) return;
      through = "gdrive"; syncWrite(SYNC_THROUGH_KEY, through); paint();
    });
    lanPick.addEventListener("click", function () {
      if (isStudio) {
        if (lanPick.disabled) return;
        through = "lan"; syncWrite(SYNC_THROUGH_KEY, through); paint();
        return;
      }
      if (!codeIn.hidden) { pairFromPicker().then(function (p) { if (p) press(); }); return; }
      if (pair && pair.token) {
        var a2 = acctNow();
        if (a2 && a2.kind === "google" && a2.who && syncThrough(a2, through) === "gdrive") {
          through = "lan"; syncWrite(SYNC_THROUGH_KEY, through); paint();   // back to the LAN, still signed in
          return;
        }
        pair = null;
        syncWrite(SYNC_PAIR_KEY, null);
        say.textContent = "Forgotten. Press Sync to pair again.";
        paint();
      }
    });
    if (codeIn) codeIn.addEventListener("keydown", function (e) { if (e.key === "Enter") lanPick.click(); });

    paint();
    ask().then(paint);

    return { ask: ask, paint: paint, press: press, signIn: signIn, signOut: signOut,
             get pair() { return pair; }, get last() { return last; }, get account() { return acctNow(); },
             get through() { return syncThrough(acctNow(), through); }, get driveLast() { return driveLast; } };
  }

  var TAB_KEY = "ttstv.reader.settingsTab";

  /* The form's own stylesheet, injected once, the way popover.js injects its
   * own. It lived in settings.html and NOWHERE ELSE, which is why the same
   * form was styled on the Settings page and bare inside the reader's
   * popover -- one form, two looks, and the popover got the worse one. */
  var STYLE_ID = "ttstv-settings-style";
  var CSS = [
    /* ================= THE PICTURE'S OWN SCALE (Osca, 1 Sep, job 6)
       *"The LOOK of the settings -- the buttons, the drop-downs, the sliders,
       the hotkey key-caps -- looks nothing like the html version."*

       It did not, and the reason was not that the controls were wrong in
       KIND: the cards, rows, segments, face tiles, ticked sliders and key
       caps were all here and all in the right places. Every NUMBER was
       different. The page was built to the application's radius scale
       (`--r-1: 11px`, `--r-2: 15px`) and to `rem` type off the reader's own
       body size, and the picture is drawn at 13px with 10/8/7/6px corners --
       so every box was a step rounder and every control a size larger than
       the thing Osca was holding it against, and a window full of that reads
       as a different design however well the parts are arranged.

       So the mock's numbers are written down here, once, and the rules below
       use them. Radii, sizes and spacing are the PICTURE's, exactly as drawn
       (`PROMPTS/mock/settings.html`); colours stay the application's tokens,
       which is the one difference `PROMPTS/mock/README.md` rule 4 permits and
       the one this window cannot do without -- the mock is drawn in light
       only, and its greys are within two or three points of ours anyway
       (`--line #e5e4e0` against our `#e4e3e0`, `--acc #8c2f2f` against
       `#832f2b`). `--fg-faint` is the one token the application lacked: the
       picture greys headings, notes and "Not added" a step lighter than its
       body grey, and one grey could not do both jobs.

       Nothing here is a new vocabulary. Change a number in this block and the
       whole window follows, which is the only way a page stays equal to a
       picture that will be redrawn. */
    '.ttstv-settings, .set-titlebar {',
    '  --s-card: 10px;',       // .grp
    '  --s-tile: 8px;',        // .face
    '  --s-ctl: 7px;',         // .seg tray, .btn, .tab
    '  --s-in: 6px;',          // select, input, .key
    '  --s-segon: 5px;',       // the raised half of a segment
    '  --s-row-y: 11px; --s-row-x: 14px; --s-row-h: 44px; --s-row-gap: 12px;',
    '  --s-text: 13px; --s-small: 12px; --s-ctl-text: 12.5px; --s-tiny: 11px;',
    '  --s-lift: 0 1px 2px rgba(0, 0, 0, 0.12);',
    '  --fg-faint: #a3a19b;',
    /* the two ends of the warmth scale, so the Warmth slider's track can BE
       the scale. The same two literals library.css and reader.css mix
       towards; here rather than in settings.css because the only rule that
       wants them is in this stylesheet. */
    '  --warm-cold: #fcfcfb; --warm-hot: #f4e6cb;',
    '}',
    '[data-theme="dark"] .ttstv-settings, [data-theme="dark"] .set-titlebar { --fg-faint: #6f6e73; }',
    '[data-theme="dark"] .ttstv-settings { --warm-cold: #131316; --warm-hot: #1b1610; }',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]) .ttstv-settings,',
    '  :root:not([data-theme="light"]) .set-titlebar { --fg-faint: #6f6e73; }',
    '  :root:not([data-theme="light"]) .ttstv-settings { --warm-cold: #131316; --warm-hot: #1b1610; }',
    '}',
    // 13px/1.45 is the picture's body, and the window's type is sized off it
    // rather than off the reader's own (a `rem` here is the READER's text
    // size, which a person changes on the next tab along -- so the Settings
    // window grew and shrank with the book, which no window should).
    '.ttstv-settings { font-size: var(--s-text); line-height: 1.45; }',
    '.ttstv-settings .set-tabs, .set-tabs {',
    '  display: flex; gap: 2px; margin: -4px -4px 12px; padding-bottom: 10px;',
    '  border-bottom: 1px solid var(--border);',
    '}',
    // ...and in a title bar it is the bar: no rule of its own, centred, and
    // no negative margin pulling it into a panel it is no longer inside
    '.set-titlebar .set-tabs { margin: 0 auto; padding: 0; border-bottom: 0; gap: 2px; }',
    // in the bar the tabs are a fixed-width row, centred, and the tab's
    // one-line `sub` is dropped: a title bar is five names, not five
    // sentences, and every one of those sentences is now the grey line
    // under the row it describes
    // Six tabs now, and the traffic lights own the first 80 px of the row
    // (settings.html reserves it): 6 x 62 + 5 x 2 = 382, which clears the
    // lights at 560 and stays centred in the window, as the picture draws it.
    '.set-titlebar .set-tab { flex: 0 0 auto; width: 62px; padding: 5px 2px 4px; }',
    '.set-titlebar .set-tab .set-sub { display: none; }',
    '.ttstv-settings .set-tab, .set-titlebar .set-tab {',
    '  flex: 1 1 0; min-width: 0; display: flex; flex-direction: column;',
    '  align-items: center; gap: 3px; padding: 6px 0 4px;',
    '  border: 0; border-radius: var(--s-ctl); background: transparent;',
    '  color: var(--fg-dim); font: inherit; font-size: var(--s-tiny); cursor: pointer;',
    '  transition: background 0.14s, color 0.14s;',
    '}',
    '.ttstv-settings .set-tab:hover, .set-titlebar .set-tab:hover { background: var(--control-bg); color: var(--fg); }',
    '.ttstv-settings .set-tab[aria-selected="true"], .set-titlebar .set-tab[aria-selected="true"] { background: var(--control-bg); color: var(--fg); }',
    // 22px, drawn as a line and not filled -- the picture's own stroke
    '.ttstv-settings .set-tab svg, .set-titlebar .set-tab svg {',
    '  display: block; width: 22px; height: 22px; margin: 0 auto 3px;',
    '}',
    // AFTER the shared rule, not before it: the two selectors weigh the same,
    // so the later one wins and an earlier `font-size` here was silently
    // overruled. Six labels in the row instead of five, and "Languages" is
    // the longest of them: at 0.68rem it sits inside its own 62 px and the
    // words stop touching.
    '.set-titlebar .set-tab { font-size: var(--s-tiny); }',
    '.ttstv-settings .set-tab .set-sub, .set-titlebar .set-tab .set-sub { font-size: 0.68rem; opacity: 0.7; }',
    '@media (max-width: 420px) { .ttstv-settings .set-tab .set-sub { display: none; } }',
    '.ttstv-settings .set-panel[hidden] { display: none; }',
    '.ttstv-settings .set-hint {',
    '  font-size: 0.82rem; color: var(--fg-dim); line-height: 1.45; margin: 0 0 12px;',
    '}',
    /* ---- THE ROW, THE CARD AND THE HEADING (31 Aug, the mock)
       Every setting is a row in a grouped card: name (and a grey line where
       it earns one) on the left, the control on the right, a hairline
       between rows and a small-caps heading above each card. Three rules and
       the whole window is laid out; nothing below this point invents a
       spacing of its own. */
    '.ttstv-settings .set-head {',
    '  font-size: var(--s-tiny); font-weight: 600; line-height: 1;',
    '  letter-spacing: 0.06em;',
    '  text-transform: uppercase; color: var(--fg-faint);',
    '  margin: 18px 0 8px;',
    '}',
    '.ttstv-settings .set-head:first-child { margin-top: 0; }',
    '.ttstv-settings .set-card {',
    '  border: 1px solid var(--border); border-radius: var(--s-card);',
    '  background: var(--panel-bg); overflow: hidden;',
    '}',
    '.ttstv-settings .set-row {',
    '  display: flex; align-items: center; gap: var(--s-row-gap);',
    '  padding: var(--s-row-y) var(--s-row-x); min-height: var(--s-row-h);',
    '  border-top: 1px solid var(--border);',
    '}',
    // `display: flex` above beats the UA's own `[hidden]` rule, so a hidden
    // row would still be laid out -- the same trap the pages' headers hit.
    // The Kaggle tab hides its quota and sessions rows when nothing is
    // connected, and this is what makes that true.
    '.ttstv-settings .set-row[hidden] { display: none !important; }',
    '.ttstv-settings .set-card > .set-row:first-child { border-top: 0; }',
    '.ttstv-settings .set-l { flex: 1 1 auto; min-width: 0; }',
    '.ttstv-settings .set-name { font-size: var(--s-text); }',
    '.ttstv-settings .set-l small {',
    '  display: block; color: var(--fg-dim); font-size: var(--s-small);',
    '  line-height: 1.4; margin-top: 1px;',
    '}',
    '.ttstv-settings .set-l small[hidden] { display: none; }',
    '.ttstv-settings .set-c { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; }',
    '.ttstv-settings .set-note {',
    '  color: var(--fg-faint); font-size: var(--s-small); line-height: 1.45;',
    '  margin: 8px 2px 0;',
    '}',
    // ---- the option groups: three treatments of one control
    '.ttstv-settings .opts { display: flex; flex-wrap: wrap; gap: 6px; }',
    '.ttstv-settings .opts button {',
    '  display: inline-flex; align-items: baseline; gap: 6px;',
    '  min-height: 28px; padding: 5px 13px; border-radius: var(--s-ctl);',
    '  border: 1px solid var(--border); background: var(--panel-bg);',
    '  color: var(--fg); font: inherit; font-size: var(--s-ctl-text); cursor: pointer;',
    '}',
    '.ttstv-settings .opts button:hover:not([disabled]) { border-color: var(--fg-dim); }',
    '.ttstv-settings .opts button .sub { font-size: var(--s-tiny); color: var(--fg-dim); }',
    '.ttstv-settings .opts button[aria-pressed="true"] {',
    '  border-color: var(--accent); color: var(--accent);',
    '}',
    '.ttstv-settings .opts button[aria-pressed="true"] .sub { color: var(--accent); }',
    // a face this device does not have: inert, and it says so
    '.ttstv-settings .opts button[disabled] {',
    '  opacity: 0.5; cursor: default; border-style: dashed;',
    '}',
    '.ttstv-settings .opts button[disabled]:hover { border-color: var(--border); }',
    '.ttstv-settings .opts button .why { font-size: 0.64rem; color: var(--fg-dim); }',
    // -- the segment: one tray, the chosen one raised out of it
    '.ttstv-settings .opts.set-seg {',
    '  gap: 0; flex-wrap: nowrap; background: var(--control-bg);',
    '  border-radius: var(--s-ctl); padding: 2px;',
    '}',
    // no border on either half, as drawn: a transparent 1px edge still takes
    // 2px of the tray and made the raised half a size bigger than the picture's
    '.ttstv-settings .opts.set-seg button {',
    '  border: 0; background: transparent; color: var(--fg-dim);',
    '  min-height: 0; padding: 4px 12px; border-radius: var(--s-segon);',
    '  font-size: var(--s-ctl-text);',
    '}',
    '.ttstv-settings .opts.set-seg button:hover:not([disabled]) { border-color: transparent; color: var(--fg); }',
    // the chosen half is LIFTED OUT of the tray -- white, and a shadow, and
    // no border: an outline round it as well makes two boxes of one control
    '.ttstv-settings .opts.set-seg button[aria-pressed="true"] {',
    '  background: var(--panel-bg); color: var(--fg); border-color: transparent;',
    '  box-shadow: var(--s-lift);',
    '}',
    // -- the faces: a tile per face, each drawn IN ITS OWN FACE, the family
    //    below it in grey, the chosen one outlined in the accent
    '.ttstv-settings .set-faces-row { display: block; padding: 0; border-top: 0; }',
    '.ttstv-settings .opts.set-faces { gap: 8px; }',
    '.ttstv-settings .opts.set-faces button {',
    '  flex-direction: column; align-items: flex-start; gap: 0;',
    '  min-width: 96px; min-height: 0; padding: 8px 12px;',
    '  border-radius: var(--s-tile); background: var(--panel-bg);',
    '}',
    // the face's own name is drawn IN the face, at the picture's 15/500
    '.ttstv-settings .opts.set-faces .opt-main { font-size: 15px; font-weight: 500; line-height: 1.2; }',
    '.ttstv-settings .opts.set-faces button { font-size: var(--s-text); }',
    '.ttstv-settings .opts.set-faces button .sub { font-size: var(--s-tiny); }',
    // the chosen tile colours its NAME and nothing else: the family under it
    // stays grey in the picture, and an accent-coloured "serif" reads as a
    // second selected thing
    '.ttstv-settings .opts.set-faces button[aria-pressed="true"] .sub { color: var(--fg-dim); }',
    '.ttstv-settings .opts.set-faces button[aria-pressed="true"] {',
    '  border-color: var(--accent);',
    '}',
    '.ttstv-settings .opts.set-faces button[aria-pressed="true"] .opt-main { color: var(--accent); }',
    // -- the slider: the options themselves, laid along a rail, with the
    //    chosen one wearing the thumb and the value beside the track
    // the track FILLS the row between the name and the read-out, as drawn --
    // a fixed 216px left the picture's long ruler sitting short of the value
    '.ttstv-settings .set-slider {',
    '  position: relative; flex: 1 1 auto; width: auto; height: 16px;',
    '  display: flex; align-items: center;',
    '}',
    /* THE RAIL HAS TO BE VISIBLE, and it was not. `--control-bg` on a
       `--panel-bg` card is #f5f5f3 on #ffffff -- two per cent apart -- so on
       EVERY slider in this window the track could not be seen and all that
       was left was the white thumb floating on its shadow. Osca, 5 Sep, of
       the Warmth row: "this doesn't do anything" ... "I need a bar". A border
       is what makes it a bar. */
    '.ttstv-settings .set-rail {',
    '  position: absolute; left: 0; right: 0; height: 6px; border-radius: 3px;',
    '  box-sizing: border-box; background: var(--control-bg);',
    '  border: 1px solid var(--border); display: block;',
    '}',
    /* AND THE WARMTH ROW'S TRACK IS THE SCALE ITSELF -- the bench's own
       treatment (design/reader/shell.css builds `--track-grad` out of the
       warmths it chooses between). A slider whose bar shows you the thing it
       sets needs no legend beside it. */
    '.ttstv-settings .set-row[data-field="warmth"] .set-rail {',
    '  background: linear-gradient(to right, var(--warm-cold), var(--warm-hot));',
    '}',
    '.ttstv-settings .opts.set-ticks {',
    '  position: absolute; left: 0; right: 0; top: 0; bottom: 0; gap: 0; flex-wrap: nowrap;',
    '}',
    '.ttstv-settings .opts.set-ticks button {',
    '  position: absolute; top: 50%; width: 13px; height: 13px; min-height: 0;',
    '  padding: 0; border-radius: 50%; transform: translate(-50%, -50%);',
    '  background: var(--control-bg); border: 1px solid var(--border);',
    '  overflow: hidden; text-indent: -999px; white-space: nowrap;',
    '}',
    '.ttstv-settings .opts.set-ticks button:hover:not([disabled]) { background: var(--border); }',
    // the thumb: the picture draws it 16px, white, and floating on a shadow,
    // with no outline -- a ring round it puts it back in the track
    '.ttstv-settings .opts.set-ticks button[aria-pressed="true"] {',
    '  width: 16px; height: 16px; background: #fff;',
    '  border: 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);',
    '}',
    '.ttstv-settings .set-val {',
    '  min-width: 40px; text-align: right; color: var(--fg-dim);',
    '  font-size: var(--s-text); font-variant-numeric: tabular-nums;',
    '}',
    // "260 wpm" needs the room the picture gives it; "100%" and "1.75" do not
    '.ttstv-settings .set-row[data-field="wpm"] .set-val { min-width: 64px; }',
    '.ttstv-settings .set-row[data-field="listenWindow"] .set-val { min-width: 48px; }',
    // the name beside a slider is a fixed column in the picture, so the three
    // tracks start at one x rather than each at the end of its own word
    '.ttstv-settings .set-row[data-field="size"] .set-l,',
    '.ttstv-settings .set-row[data-field="line"] .set-l,',
    // Listening window joined them on 5 Sep. A slider row that is NOT in this
    // list keeps `.set-l { flex: 1 1 auto }` and `.set-c { flex: 0 0 auto }`,
    // which for a control that is a LENGTH means a 16 px stub where the ruler
    // should be -- drawn once, in the bench, before it was in either list.
    '.ttstv-settings .set-row[data-field="wpm"] .set-l { flex: 0 0 90px; }',
    // ...at 120 rather than 90, because "Listening window" is two words and
    // 90 wraps it. The three above share an x on purpose (one tab, three
    // rulers under each other); this one is the only ruler on its card, so
    // there is nothing for it to line up with and a wrapped name is the only
    // cost the 90 would buy.
    '.ttstv-settings .set-row[data-field="listenWindow"] .set-l { flex: 0 0 120px; }',
    // ...and the control half grows to take what the name gives up. `.set-c`
    // is `flex: 0 0 auto` for every other row, where the control is a fixed
    // thing on the right; a ruler is the one control that is a LENGTH.
    '.ttstv-settings .set-row[data-field="size"] .set-c,',
    '.ttstv-settings .set-row[data-field="line"] .set-c,',
    '.ttstv-settings .set-row[data-field="listenWindow"] .set-c,',
    '.ttstv-settings .set-row[data-field="wpm"] .set-c { flex: 1 1 auto; }',
    // -- the range: the one continuous control
    /* PACE IS DRAWN AS THE OTHER TWO ARE. The picture puts one ruler on all
       three rows; this one is a continuous `input[type=range]` rather than a
       stepped tick group, because a pace is a number and not a choice of six
       -- so it keeps its behaviour and borrows the picture's clothes: the
       same 4px track in the tray grey, the same 16px white thumb on the same
       shadow, and no filled portion, which is the platform's idea and not
       the mock's. */
    '.ttstv-settings .set-range {',
    '  flex: 1 1 auto; width: auto; height: 16px; margin: 0;',
    '  appearance: none; -webkit-appearance: none; background: transparent;',
    '  cursor: pointer;',
    '}',
    '.ttstv-settings .set-range::-webkit-slider-runnable-track {',
    '  height: 4px; border-radius: 2px; background: var(--control-bg);',
    '}',
    '.ttstv-settings .set-range::-moz-range-track {',
    '  height: 4px; border-radius: 2px; background: var(--control-bg);',
    '}',
    '.ttstv-settings .set-range::-webkit-slider-thumb {',
    '  appearance: none; -webkit-appearance: none; margin-top: -6px;',
    '  width: 16px; height: 16px; border-radius: 50%; background: #fff;',
    '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);',
    '}',
    '.ttstv-settings .set-range::-moz-range-thumb {',
    '  width: 16px; height: 16px; border: 0; border-radius: 50%; background: #fff;',
    '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);',
    '}',
    '.ttstv-settings .set-range:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }',
    // -- the menu
    // The picture's drop-down is a small white chip with a hairline and its
    // own tiny chevron -- not the platform's full-height control with a
    // 20px arrow, which is what made General's one row look borrowed.
    '.ttstv-settings .set-menu {',
    '  appearance: none; -webkit-appearance: none;',
    '  min-height: 0; padding: 4px 26px 4px 10px; border-radius: var(--s-in);',
    '  border: 1px solid var(--border); background: var(--panel-bg);',
    '  color: var(--fg); font: inherit; font-size: var(--s-ctl-text);',
    '  max-width: 170px; cursor: pointer;',
    "  background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"9\" height=\"12\" viewBox=\"0 0 9 12\"><path d=\"M4.5 1.2 7 4H2z\" fill=\"%23a3a19b\"/><path d=\"M4.5 10.8 7 8H2z\" fill=\"%23a3a19b\"/></svg>');",
    '  background-repeat: no-repeat; background-position: right 8px center;',
    '}',
    // ---- the Hotkeys tab
    '.ttstv-settings .hk-caps { gap: 6px; }',
    '.ttstv-settings .hk-foot, .ttstv-settings .hk-foot * { font-size: var(--s-small); }',
    // The picture's cap: 28px wide, a 2px bottom edge for the key's own
    // depth, and a 6px corner -- not the 11px control radius, which rounded
    // a key-cap into a pill and lost the one thing that says "this is a key".
    '.ttstv-settings .hk-cap {',
    '  min-width: 28px; min-height: 0; padding: 3px 8px;',
    '  border: 1px solid var(--border); border-bottom-width: 2px;',
    '  border-radius: var(--s-in); background: var(--panel-bg);',
    '  color: var(--fg); font: inherit; font-size: var(--s-small);',
    '  line-height: normal; text-align: center;',
    '  cursor: pointer; white-space: nowrap;',
    '}',
    '.ttstv-settings .hk-cap:hover:not([disabled]) { border-color: var(--fg-dim); }',
    '.ttstv-settings .hk-cap.hk-changed { border-color: var(--accent); color: var(--accent); }',
    '.ttstv-settings .hk-cap.hk-arming {',
    '  border-color: var(--accent); color: var(--accent); border-style: dashed;',
    '  min-width: 96px; font-size: var(--s-tiny);',
    '}',
    // the system's own key: shown, because somebody looking for it has to
    // find it, and greyed, because this window cannot change it
    '.ttstv-settings .hk-cap.hk-fixed {',
    '  color: var(--fg-dim); cursor: default; border-bottom-width: 1px; opacity: 0.75;',
    '}',
    // "Reset all" is a word at the end of the foot sentence in the picture,
    // not a button beside it: the same grey line, and the words underlined by
    // being the only dark thing in it.
    '.ttstv-settings .hk-reset, .ttstv-settings .hk-resetall {',
    '  border: 0; background: transparent; color: var(--fg);',
    '  font: inherit; font-size: var(--s-small); cursor: pointer; padding: 0 2px;',
    '}',
    '.ttstv-settings .hk-reset:hover, .ttstv-settings .hk-resetall:hover { color: var(--link); }',
    '.ttstv-settings .hk-reset[hidden], .ttstv-settings .hk-resetall[hidden] { display: none; }',
    '.ttstv-settings .hk-note { color: var(--bad) !important; }',
    '.ttstv-settings .hk-foot { margin-top: 10px; }',
    '.ttstv-settings .hk-row .set-name { font-size: var(--s-text); }',
    // ---- the Kaggle and Models panels: rows in a card, like everything else
    // the picture's quota bar fills the row and is 6px on a 3px corner
    '.ttstv-settings .kag-quota {',
    '  flex: 1 1 auto; width: auto; height: 6px; border-radius: 3px;',
    '  background: var(--control-bg); overflow: hidden;',
    '}',
    '.ttstv-settings .kag-quota[hidden] { display: none; }',
    '.ttstv-settings .kag-quota i { display: block; height: 100%; background: var(--accent); }',
    '.ttstv-settings .kag-quotaword {',
    '  min-width: 110px; text-align: right; color: var(--fg-dim);',
    '  font-size: var(--s-ctl-text);',
    '}',
    '.ttstv-settings .kag-quota-l { flex: 0 0 90px; }',
    // "This week" and "Sessions" are names, not sentences: they do not wrap
    // the destination segment is studio's value, so it is NOT a `.opts` group
    // (mount's painter walks those); it wears the segment's clothes and
    // nothing else
    '.ttstv-settings .kag-opts.set-seg {',
    '  gap: 0; flex-wrap: nowrap; background: var(--control-bg);',
    '  border-radius: var(--s-ctl); padding: 2px;',
    '}',
    '.ttstv-settings .kag-opts.set-seg button {',
    '  border: 0; background: transparent; color: var(--fg-dim);',
    '  min-height: 0; padding: 4px 12px; border-radius: var(--s-segon);',
    '  font: inherit; font-size: var(--s-ctl-text); cursor: pointer;',
    '}',
    '.ttstv-settings .kag-opts.set-seg button[aria-pressed="true"] {',
    '  background: var(--panel-bg); color: var(--fg); border-color: transparent;',
    '  box-shadow: var(--s-lift);',
    '}',
    '.ttstv-settings .kag-who.st { display: inline-flex; align-items: center; gap: 6px; font-size: var(--s-ctl-text); }',
    '.ttstv-settings .kag-who.st::before {',
    '  content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--fg-dim);',
    '}',
    '.ttstv-settings .kag-who.kag-on::before { background: var(--ok); }',
    '.ttstv-settings .kag-modeltop { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }',
    '.ttstv-settings .kag-modelline { display: block; }',
    '.ttstv-settings .hidden-size { display: none; }',
    '.ttstv-settings .kag-notadded { color: var(--fg-faint); font-size: var(--s-ctl-text); }',
    '.ttstv-settings .kag-installing { min-width: 150px; }',
    '.ttstv-settings .kag-credrow { display: block; }',
    '.ttstv-settings .kag-credsay { margin-bottom: 8px; }',
    // ---- the Kaggle panel
    '.ttstv-settings .kag-line { font-size: var(--s-small); margin: 0 0 4px; }',
    '.ttstv-settings .kag-who { font-weight: 400; color: var(--fg-dim); }',
    '.ttstv-settings .kag-dim { color: var(--fg-dim); font-size: var(--s-small); line-height: 1.45; }',
    '.ttstv-settings .kag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }',
    '.ttstv-settings .kag-acts { margin-top: 14px; }',
    '.ttstv-settings .kag-in {',
    '  flex: 1 1 150px; min-width: 0; min-height: 0; padding: 6px 9px;',
    '  border: 1px solid var(--border); border-radius: var(--s-in);',
    '  background: var(--panel-bg); color: var(--fg); font: inherit;',
    '  font-size: var(--s-text);',
    '}',
    '.ttstv-settings .kag-btn, .ttstv-settings .lang-btn, .ttstv-settings .vc-btn {',
    '  min-height: 0; padding: 5px 13px; border-radius: var(--s-ctl);',
    '  border: 1px solid var(--border); background: var(--panel-bg);',
    '  color: var(--fg); font: inherit; font-size: var(--s-ctl-text); cursor: pointer;',
    '}',
    // Connect is the picture\'s one filled button -- the accent, and white on it
    '.ttstv-settings .kag-btn.kag-primary {',
    '  background: var(--accent); border-color: var(--accent); color: #fff;',
    '}',
    '.ttstv-settings .kag-btn:hover:not([disabled]), .ttstv-settings .lang-btn:hover:not([disabled]),',
    '.ttstv-settings .vc-btn:hover:not([disabled]) { border-color: var(--fg-dim); }',
    '.ttstv-settings .kag-btn[disabled], .ttstv-settings .lang-btn[disabled],',
    '.ttstv-settings .vc-btn[disabled] { opacity: 0.45; cursor: default; }',
    '.ttstv-settings .kag-btn.danger { color: var(--bad); }',
    '.ttstv-settings .kag-say { margin-top: 10px; color: var(--fg-faint); font-size: var(--s-small); min-height: 1.3em; }',
    '.ttstv-settings .kag-creds[hidden] { display: none; }',
    '.ttstv-settings .kag-instruction { margin-top: 6px; }',
    '.ttstv-settings .kag-opts { display: flex; flex-wrap: wrap; gap: 6px; }',
    '.ttstv-settings .kag-opts button {',
    '  display: inline-flex; align-items: baseline; gap: 6px;',
    '  min-height: 0; padding: 5px 13px; border-radius: var(--s-ctl);',
    '  border: 1px solid var(--border); background: var(--panel-bg);',
    '  color: var(--fg); font: inherit; font-size: var(--s-ctl-text); cursor: pointer;',
    '}',
    '.ttstv-settings .kag-opts button:hover { border-color: var(--fg-dim); }',
    '.ttstv-settings .kag-opts button .sub { font-size: var(--s-tiny); color: var(--fg-dim); }',
    '.ttstv-settings .kag-opts button[aria-pressed="true"] {',
    '  border-color: var(--accent); color: var(--accent);',
    '}',
    '.ttstv-settings .kag-opts button[aria-pressed="true"] .sub { color: var(--accent); }',
    '.ttstv-settings .kag-model { margin-top: 12px; }',
    '.ttstv-settings .kag-modeltop {',
    '  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;',
    '}',
    '.ttstv-settings .kag-modelname { font-weight: 500; font-size: var(--s-text); }',
    '.ttstv-settings .kag-modelsize { font-size: var(--s-small); color: var(--fg-dim); }',
    // the picture's tag reads "on Kaggle" in sentence case at 11px -- not a
    // 10px upper-case letter-spaced label, which is a badge and says louder
    '.ttstv-settings .kag-chip {',
    '  font-size: var(--s-tiny); text-transform: none; letter-spacing: 0;',
    '  border: 1px solid var(--border); border-radius: var(--r-pill);',
    '  padding: 2px 8px; color: var(--fg-dim);',
    '}',
    '.ttstv-settings .kag-chip.kag-ok { color: var(--ok); border-color: var(--ok); }',
    // *Installed on this Mac* is the mock's GREEN DOT AND PLAIN TEXT -- the
    // same dot the Account row wears, and deliberately not a pill: two
    // outlined pills on one row (the tag and the state) read as two tags
    // rather than as a fact and a state.
    '.ttstv-settings .kag-here {',
    '  display: inline-flex; align-items: center; gap: 6px;',
    '  font-size: var(--s-ctl-text); color: var(--fg-dim);',
    '}',
    '.ttstv-settings .kag-here::before {',
    '  content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ok);',
    '}',
    '.ttstv-settings .kag-model .kag-btn { margin-top: 6px; }',
    '.ttstv-settings .kag-bar {',
    '  margin-top: 7px; height: 4px; border-radius: var(--r-pill);',
    '  background: var(--control-bg); overflow: hidden;',
    '}',
    '.ttstv-settings .kag-bar i { display: block; height: 100%; background: var(--accent); }',
    '.ttstv-settings .kag-stage { margin-top: 3px; }',
    '.ttstv-settings .kag-modelnote:empty { display: none; }',
    // ---- the Languages rows. `.lang-btn` borrows the form's one button
    // style rather than growing a third copy of the same six lines.
    '.ttstv-settings .lang-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }',
    '.ttstv-settings .lang-name { font-weight: 500; font-size: var(--s-text); }',
    '.ttstv-settings .lang-own { color: var(--fg-faint); font-size: var(--s-text); opacity: 1; }',
    '.ttstv-settings .lang-line { display: block; }',
    '.ttstv-settings .lang-state, .ttstv-settings .lang-said {',
    '  display: inline-flex; align-items: center; gap: 6px;',
    '  color: var(--fg-dim); font-size: var(--s-ctl-text);',
    '}',
    '.ttstv-settings .lang-state::before {',
    '  content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ok);',
    '}',
    // A GREYED ROW IS GREY ALL THE WAY ACROSS. `state: "unavailable"` is
    // twenty-seven of the catalogue's thirty-four rows, so the tab's job is
    // to make the handful that can be acted on findable at a glance -- the
    // name dims to the same grey the row's own explanation is in, and the
    // reason sits where the button would have been. Nothing is hidden and
    // nothing is removed: the picture's rule is one thing on the right, and
    // for these rows that one thing is the sentence.
    '.ttstv-settings .lang-row.lang-off .lang-name { color: var(--fg-dim); font-weight: 400; }',
    '.ttstv-settings .lang-why {',
    '  color: var(--fg-faint); font-size: var(--s-ctl-text); text-align: right;',
    '  max-width: 190px;',
    '}',
    // the ⋯ is the row's own quiet control: no border until it is under the
    // pointer, like every icon button in the title bar
    '.ttstv-settings .lang-more {',
    '  min-width: 24px; min-height: 24px; padding: 0 4px; line-height: 1;',
    '  border: 1px solid transparent; border-radius: var(--s-ctl);',
    '  background: transparent; color: var(--fg-faint); font: inherit;',
    '  font-size: var(--s-text); cursor: pointer;',
    '}',
    '.ttstv-settings .lang-more:hover { background: var(--control-bg); color: var(--fg); }',
    '.ttstv-settings .lang-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }',
    // one item, so it is a small sheet on the row rather than a menu system
    '.ttstv-settings .set-c { position: relative; }',
    '.ttstv-settings .lang-menu {',
    '  position: absolute; right: 0; top: calc(100% + 4px); z-index: 3;',
    '  background: var(--panel-bg); border: 1px solid var(--border);',
    '  border-radius: var(--s-card); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);',
    // `--s-card`, not the application's `--r-3`: this window is drawn to the
    // mock's own numbers (10 / 8 / 7 / 6), and 22px on a 33px-tall box of one
    // word is a lozenge, not a menu.
    '  padding: 4px;',
    '}',
    '.ttstv-settings .lang-menu[hidden] { display: none; }',
    '.ttstv-settings .lang-remove {',
    '  min-height: 0; padding: 5px 13px; border: 0; border-radius: var(--s-ctl);',
    '  background: transparent; color: var(--bad); font: inherit;',
    '  font-size: var(--s-ctl-text); cursor: pointer; white-space: nowrap;',
    '}',
    '.ttstv-settings .lang-remove:hover { background: var(--control-bg); }',
    // THE BAR HAS NO FRACTION, so it has no width to draw: studio counts no
    // stage of an add (studio/progress.py, the language branch), and a fill
    // at some percentage would be the invented number that module exists to
    // refuse. It is the Models tab's own bar with an indeterminate fill.
    '.ttstv-settings .lang-adding { min-width: 150px; }',
    '.ttstv-settings .lang-bar i { width: 40%; animation: lang-slide 1.4s ease-in-out infinite; }',
    '@keyframes lang-slide {',
    '  0% { margin-left: -40%; } 100% { margin-left: 100%; }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  .ttstv-settings .lang-bar i { width: 100%; animation: none; opacity: 0.5; }',
    '}',
    /* ---- THE VOICE GROUP (5 Sep). Four rules, and not one of them invents a
       number: `.vc-btn` was added to the form's single button rule above
       rather than growing a fourth copy of the same six lines, `.vc-mark` is
       the 7 px dot the Account row and every language row already wear, and
       `.vc-fixed` and `.vc-said` are the two greys this window already has
       (`--fg-dim` for a fact, `--fg-faint` for a note). */
    '.ttstv-settings .set-c.vc-mic { display: flex; align-items: center; gap: 8px; }',
    '.ttstv-settings .set-c.vc-mic select.set-menu { min-width: 0; }',
    '.ttstv-settings .vc-mark {',
    '  flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%;',
    '  background: var(--fg-faint);',
    '}',
    '.ttstv-settings .vc-mark.vc-on { background: var(--ok); }',
    '.ttstv-settings .vc-mark.vc-off { background: var(--bad); }',
    '.ttstv-settings .vc-said { color: var(--fg-faint); }',
    '.ttstv-settings .vc-said[hidden] { display: none; }',
    '.ttstv-settings .vc-fixed { color: var(--fg-dim); font-size: var(--s-ctl-text); }',
  ].join("\n");

  function injectStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    var doc = el && (el.ownerDocument || global.document);
    if (!el || !doc) return null;
    injectStyle(doc);
    if (el.classList) el.classList.add("ttstv-settings");
    var current = normalise(opts.settings || read());
    /* THE ONE LIST THIS WINDOW CANNOT WRITE DOWN. Every other set of options
     * in this file is a constant -- the faces, the sizes, the papers -- and
     * this one is whatever `enumerateDevices()` says a moment from now, and
     * says differently once permission is granted (a browser withholds device
     * LABELS until then, which is why Test refreshes it). So it starts as the
     * one answer that is always true and is replaced in place. */
    var micOptions = [{ value: "", label: "System default" }];

    /* Everything a panel needs to talk to studio, in one object, so a test
     * hands it three stubs instead of a server. Every call RESOLVES -- a
     * missing route is a fact to print, exactly as `save()` treats it. */
    var netCtx = opts.net || {
      getJSON: function (path) {
        var url = origin();
        if (!url || !global.fetch) return Promise.resolve(null);
        return global.fetch(url + path, { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      },
      postJSON: function (path, body) {
        var url = origin();
        if (!url || !global.fetch) return Promise.resolve({ ok: false, status: 0, why: "no studio behind this page" });
        return global.fetch(url + path, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            return { ok: res.ok, status: res.status, body: d,
                     why: res.ok ? null : ((d && d.error) || ("HTTP " + res.status)) };
          });
        }).catch(function (e) {
          return { ok: false, status: 0, why: String((e && e.message) || e) };
        });
      },
      after: function (ms) {
        return new Promise(function (res) { global.setTimeout(res, ms); });
      },
    };

    function optionsFor(field) {
      // Both font fields draw the same faces, and both honour the same
      // availability answer -- a face this device does not have is inert with
      // its reason in either place, never offered and then substituted.
      if (field === "family" || field === "uiFamily") return facesNow().map(function (f) {
        return { value: f.id, label: f.label, sub: f.note, stack: f.stack,
                 disabled: f.available ? null : f.why };
      });
      if (field === "size") return SIZES.map(function (n) {
        return { value: n, label: n + "%", sub: n === DEFAULTS.size ? "default" : "" };
      });
      if (field === "warmth") return WARMTHS.map(function (w) { return w; });
      if (field === "view") return VIEWS.map(function (v) {
        return { value: v.value, label: v.label, sub: v.sub };
      });
      // The two General rows: a segment each, and the label says the answer
      // rather than repeating the question -- the row's own name asks it.
      if (field === "resume") return [
        { value: true,  label: "Where you left off" },
        { value: false, label: "At the start" },
      ];
      // the hands-free four. `micDevice` is a live list (see `micOptions`);
      // the window is the store's own stops; touch off is a plain two-way.
      if (field === "micDevice") return micOptions;
      if (field === "listenWindow") return LISTEN_WINDOWS.map(function (n) {
        return { value: n, label: secondsWord(n),
                 sub: n === DEFAULTS.listenWindow ? "default" : "" };
      });
      if (field === "touchOff") return [
        { value: false, label: "Off" },
        { value: true,  label: "On" },
      ];
      if (field === "sidebar") return SIDEBARS.map(function (v) {
        return { value: v, label: v.charAt(0).toUpperCase() + v.slice(1) };
      });
      // Light · Dark · System, which is the mock's order and macOS's, not
      // THEMES' -- that array is led by the default because `normalise` reads
      // it that way, and the two orders answer different questions.
      if (field === "theme") return ["light", "dark", "system"].map(function (t) {
        return { value: t, label: t.charAt(0).toUpperCase() + t.slice(1) };
      });
      return LINES.map(function (l) {
        return { value: l.value, label: l.label, sub: l.value ? String(l.value) : "1.75" };
      });
    }

    /* THE VALUE, BESIDE THE CONTROL. A slider without its number is a guess;
     * the mock prints "100%", "1.75", "260 wpm" to the right of every one of
     * them, and this is the one function that decides what those read. */
    /* "2.5 s", not "2.500 s" and not "2500 ms": the row is in the unit a
     * person says it in, and `prefs/`'s `listenMs` is the one place it turns
     * into the unit a timer takes. */
    function secondsWord(n) { return n + " s"; }

    function valueWord(field, value) {
      if (field === "size") return value + "%";
      if (field === "listenWindow") return secondsWord(value);
      if (field === "line") return value ? String(value) : "1.75";
      if (field === "wpm") return value + " wpm";
      return String(value);
    }

    /* ONE OPTION BUTTON -- and every control that offers a fixed set of
     * choices is still made of these, whatever it looks like. A segment, a
     * face tile and a slider tick are three CSS treatments of the same
     * `.opts[data-field] button[data-value]` group, which is what lets
     * `paint()` stay one loop and what keeps every driver that reaches for a
     * value by name reaching for the same thing. */
    function optButton(field, o) {
      var b = doc.createElement("button");
      b.type = "button";
      b.dataset.field = field;
      b.dataset.value = String(o.value);
      b.setAttribute("aria-pressed", "false");
      var main = doc.createElement("span");
      main.className = "opt-main";
      main.textContent = o.label;
      // each option previews its own choice: a face tile is set in its own
      // face, which is the whole reason the tiles are tiles
      if (o.stack && main.style) main.style.fontFamily = o.stack;
      b.appendChild(main);
      if (o.sub) {
        var sub = doc.createElement("span");
        sub.className = "sub";
        sub.textContent = o.sub;
        b.appendChild(sub);
      }
      // A face this device does not have: inert, and saying so where the
      // hand is. Never removed, because a reader who has seen Baskerville on
      // another Mac should be told it is missing here, not left to wonder;
      // never merely un-pressed, because a control that looks pressable and
      // then substitutes a different face is the failure this check exists
      // to prevent.
      if (o.disabled) {
        b.disabled = true;
        b.setAttribute("aria-disabled", "true");
        b.title = o.disabled;
        var why = doc.createElement("span");
        why.className = "why";
        why.textContent = o.disabled;
        b.appendChild(why);
      }
      return b;
    }

    /* THE MENU AND FILLING IT ARE TWO THINGS since 5 Sep, because for one row
     * the filling happens twice: the Microphone row's options are not known
     * when the row is built, and change again once permission is granted. The
     * Interface font row calls both once and reads exactly as it did. */
    function menuEl(field, label) {
      var sel = doc.createElement("select");
      sel.className = "set-menu";
      sel.dataset.field = field;
      sel.setAttribute("aria-label", label);
      return sel;
    }

    function fillMenu(sel, field) {
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      optionsFor(field).forEach(function (o) {
        var op = doc.createElement("option");
        op.value = String(o.value);
        op.textContent = o.label + (o.disabled ? " — " + o.disabled : "");
        if (o.disabled) op.disabled = true;
        sel.appendChild(op);
      });
      return sel;
    }

    function optGroup(field, cls) {
      var group = doc.createElement("div");
      group.className = "opts " + cls;
      group.setAttribute("role", "group");
      group.dataset.field = field;
      optionsFor(field).forEach(function (o) { group.appendChild(optButton(field, o)); });
      return group;
    }

    /* ONE ROW: the name (and its grey line) on the left, the control on the
     * right, exactly as the picture draws it. */
    function rowEl(spec) {
      var field = spec.field;
      var row = doc.createElement("div");
      row.className = "set-row";
      row.dataset.field = field;
      var left = kEl(doc, "div", "set-l");
      left.appendChild(kEl(doc, "div", "set-name", spec.label));
      if (spec.sub) left.appendChild(kEl(doc, "small", null, spec.sub));
      var right = kEl(doc, "div", "set-c");

      if (spec.control === "faces") {
        // the tiles are the whole row -- a label above five faces would be
        // the third time the word "font" appeared on one screen
        row.className = "set-faces-row";
        row.appendChild(optGroup(field, "set-faces"));
        if (spec.note) row.appendChild(kEl(doc, "div", "set-note", spec.note));
        return row;
      }

      if (spec.control === "menu") {
        right.appendChild(fillMenu(menuEl(field, spec.label), field));
      } else if (spec.control === "fixed") {
        /* A FACT, NOT A CONTROL -- the only row in this window whose right
         * side cannot be pressed. Drawn in the same grey a greyed language
         * row's reason is in, because it is the same thing: the answer to
         * "what changes this?" is "nothing here". */
        right.appendChild(kEl(doc, "span", "vc-fixed", spec.text || ""));
      } else if (spec.control === "mic") {
        /* THE DOT IS THE PERMISSION, AND IT IS A DOT -- this window's own rule,
         * the one the Account row and every language row already keep: a 7 px
         * circle, its state in the `title` for anyone who cannot see a colour,
         * and never the words "granted"/"denied" sitting in the row eating the
         * width the device menu needs. Grey is "not asked yet", green allowed,
         * red refused.
         *
         * Three things on the right, in the order they are used: the state,
         * the choice, then the button that proves both. `.vc-said` -- what the
         * microphone actually heard -- goes in the LEFT column under the row's
         * own grey line, because it is a sentence and sentences live there. */
        var saidEl = kEl(doc, "small", "vc-said", "");
        saidEl.hidden = true;      // nothing has been heard yet, so no gap for it
        left.appendChild(saidEl);
        right.className = "set-c vc-mic";
        var mark = kEl(doc, "span", "vc-mark", "");
        mark.title = "Microphone: not asked for yet";
        right.appendChild(mark);
        right.appendChild(fillMenu(menuEl(field, spec.label), field));
        var testBtn = doc.createElement("button");
        testBtn.type = "button";
        testBtn.className = "vc-btn";
        testBtn.textContent = "Test";
        right.appendChild(testBtn);
      } else if (spec.control === "slider") {
        /* A DISCRETE SCALE, and the ticks are the options themselves: the
         * same `.opts` buttons, laid along a track, with the pressed one
         * wearing the thumb. It reads and behaves as the slider the mock
         * draws -- click anywhere along it, and the value is beside it --
         * without inventing a second way for a choice to be made, which is
         * what a `range` over an index would have been. */
        var track = kEl(doc, "div", "set-slider");
        var group = optGroup(field, "set-ticks");
        var kids = group.children ? group.children.length : optionsFor(field).length;
        for (var i = 0; i < kids; i++) {
          var tick = group.children[i];
          tick.style.left = (kids > 1 ? (i / (kids - 1)) * 100 : 50) + "%";
        }
        track.appendChild(kEl(doc, "i", "set-rail"));
        track.appendChild(group);
        right.appendChild(track);
        right.appendChild(kEl(doc, "div", "set-val", ""));
      } else if (spec.control === "range") {
        /* CONTINUOUS, and the only control in this window that is not made of
         * options: 80 to 900 wpm in 25s is thirty-three stops, and thirty-three
         * ticks is not a slider, it is a comb. */
        var rng = doc.createElement("input");
        rng.type = "range";
        rng.className = "set-range";
        rng.dataset.field = field;
        rng.min = String(WPM.min); rng.max = String(WPM.max); rng.step = String(WPM.step);
        rng.setAttribute("aria-label", spec.label);
        right.appendChild(rng);
        right.appendChild(kEl(doc, "div", "set-val", ""));
      } else {
        right.appendChild(optGroup(field, "set-seg"));
      }
      row.appendChild(left);
      row.appendChild(right);
      return row;
    }

    function cardEl(card) {
      var out = [];
      if (card.head) out.push(kEl(doc, "div", "set-head", card.head));
      if (card.bare) {
        card.rows.forEach(function (r) { out.push(rowEl(r)); });
        return out;
      }
      var box = kEl(doc, "div", "set-card");
      card.rows.forEach(function (r) { box.appendChild(rowEl(r)); });
      out.push(box);
      return out;
    }

    /* The row, then one panel per tab. Which tab is open is remembered --
     * a person who is adjusting type size opens Settings four times in a row
     * and should not have to find Reading again each time. */
    var tabsEl = doc.createElement("div");
    tabsEl.className = "set-tabs";
    tabsEl.setAttribute("role", "tablist");
    var panels = {};
    var built = {};
    // A tab whose contents are another module's data is drawn only where that
    // module is: `opts.studio` overrides for a test, `origin()` decides
    // otherwise -- the same question `save()` asks before it tries the mirror.
    var hasStudio = opts.studio === undefined ? !!origin() : !!opts.studio;
    var tabs = TABS.filter(function (t) { return !t.needsStudio || hasStudio; });
    var open = null;
    try { open = global.localStorage && global.localStorage.getItem(TAB_KEY); } catch (e) { open = null; }
    if (!tabs.some(function (t) { return t.id === open; })) open = tabs[0].id;

    tabs.forEach(function (t) {
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "set-tab";
      b.dataset.tab = t.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", t.id === open ? "true" : "false");
      b.innerHTML = t.icon;
      var lab = doc.createElement("span");
      lab.textContent = t.label;
      b.appendChild(lab);
      if (t.sub) {
        var sub = doc.createElement("span");
        sub.className = "set-sub";
        sub.textContent = t.sub;
        b.appendChild(sub);
      }
      tabsEl.appendChild(b);

      var panel = doc.createElement("div");
      panel.className = "set-panel";
      panel.dataset.tab = t.id;
      panel.setAttribute("role", "tabpanel");
      panel.hidden = t.id !== open;
      // THE HINT IS GONE, and its going is the layout (the mock): "nothing
      // else on the page -- no paragraphs". The sentence it carried -- which
      // font this tab is about -- is now the grey line under the row's own
      // name, where it sits beside the control it describes instead of above
      // a panel.
      (t.cards || []).forEach(function (c) {
        cardEl(c).forEach(function (n) { panel.appendChild(n); });
      });
      if (t.build) built[t.id] = t.build(panel, netCtx, opts);
      panels[t.id] = panel;
    });

    /* ========================= THE VOICE GROUP, WIRED (Osca, 5 Sep 21:15)
     * The rows themselves are `VOICE_ROWS` at the head of this file, drawn by
     * the same `rowEl` every other row goes through. What is here is the only
     * part that could not be declarative: a device list that does not exist
     * until the browser answers, a permission that is not a stored setting at
     * all, and a button that opens a real microphone.
     *
     * Nothing in this block stores anything of its own. The menu writes
     * `micDevice` through the form's own `change` handler, the slider and the
     * segment through its `click` handler, and the cap through `setHotkey` --
     * four controls, one store, no second path. The only state kept here is
     * whether a test is running.
     *
     * It runs on any page that mounts the form, and every reach for the
     * browser is guarded: with no `navigator.mediaDevices` (a node harness,
     * an old browser, an insecure origin) the row still draws, the menu says
     * so, and Test answers in words instead of throwing. */
    function isTouchOnly() {
      if (opts.touchOnly !== undefined) return !!opts.touchOnly;
      try {
        // a phone, and not merely a Mac with a trackpad: coarse AND no hover.
        // The question this asks is "is there a keyboard to bind a key on".
        return !!(global.matchMedia
                  && global.matchMedia("(pointer: coarse)").matches
                  && global.matchMedia("(hover: none)").matches);
      } catch (e) { return false; }
    }

    function buildVoice(panel) {
      if (!panel) return null;
      var head = kEl(doc, "div", "set-head", "Voice");
      var box = kEl(doc, "div", "set-card");
      var micRow = rowEl(VOICE_ROWS.mic);
      box.appendChild(micRow);
      // the trigger: the real `mic` hotkey row where there is a keyboard, the
      // AirPods sentence where there is not
      var hk = null;
      if (isTouchOnly()) box.appendChild(rowEl(VOICE_ROWS.airpods));
      else hk = buildHotkeysPanel(box, netCtx, { only: ["mic"], bare: true, settings: current });
      box.appendChild(rowEl(VOICE_ROWS.window));
      box.appendChild(rowEl(VOICE_ROWS.touch));
      var note = kEl(doc, "div", "set-note", VOICE_ROWS.note);
      panel.insertBefore(box, panel.firstChild);
      panel.insertBefore(head, box);
      if (box.nextSibling) panel.insertBefore(note, box.nextSibling);
      else panel.appendChild(note);

      var mark = micRow.querySelector(".vc-mark");
      var sel = micRow.querySelector("select.set-menu");
      var testBtn = micRow.querySelector(".vc-btn");
      var said = micRow.querySelector(".vc-said");
      var testing = false;
      var media = global.navigator && global.navigator.mediaDevices;

      /* The line grows and shrinks the General tab, so the window is told --
       * but ONLY when it actually changed. `reportHeight`'s own test counts
       * the reports ("once on mount and once per switch, never twice for one
       * tab"), and a line that reports on being set to the empty string it
       * already held would be exactly that second report. */
      function say(t) {
        if (!said) return;
        t = t || "";
        if (said.textContent === t) return;
        said.textContent = t;
        said.hidden = !t;
        reportHeightSoon(el, doc);
      }

      /* "" not asked | granted | denied | prompt -- the browser's own words,
       * and the only place they are ever spelled out is the title. */
      function setMark(state) {
        if (!mark) return;
        mark.className = "vc-mark"
          + (state === "granted" ? " vc-on" : state === "denied" ? " vc-off" : "");
        mark.title = state === "granted" ? "Microphone: allowed"
          : state === "denied" ? "Microphone: refused \u2014 allow it in this browser's site settings"
          : "Microphone: not asked for yet";
      }

      /* THE PLATFORM MAY OFFER NO CHOICE, and where it does not the row says
       * so instead of pretending to one -- the same treatment a face this Mac
       * does not have gets, for the same reason. A `deviceId` stored on
       * another machine names nothing here: the menu falls back to the system
       * default WITHOUT writing over the stored choice, so the Mac that was
       * unplugged from its interface gets its choice back when it returns. */
      function refreshDevices() {
        if (!sel) return Promise.resolve();
        if (!media || typeof media.enumerateDevices !== "function") {
          micOptions = [{ value: "", label: "System default",
                          disabled: "this browser lists no inputs" }];
          fillMenu(sel, "micDevice");
          sel.disabled = true;
          return Promise.resolve();
        }
        return media.enumerateDevices().then(function (list) {
          var ins = [];
          for (var i = 0; i < (list || []).length; i++) {
            var d = list[i] || {};
            if (d.kind !== "audioinput" || !d.deviceId) continue;
            // the two ids that are not devices but aliases for whatever the OS
            // is using -- which is what "System default" already means here
            if (d.deviceId === "default" || d.deviceId === "communications") continue;
            ins.push({ value: d.deviceId, label: d.label || ("Microphone " + (ins.length + 1)) });
          }
          micOptions = [{ value: "", label: "System default" }].concat(ins);
          if (!ins.length) micOptions[0].disabled = "the only input this browser offers";
          fillMenu(sel, "micDevice");
          sel.disabled = !ins.length;
          sel.value = String(current.micDevice);
          return null;
        }).catch(function () { return null; });
      }

      function refreshPermission() {
        var perms = global.navigator && global.navigator.permissions;
        if (!perms || typeof perms.query !== "function") { setMark(""); return Promise.resolve(); }
        return perms.query({ name: "microphone" }).then(function (st) {
          setMark(st && st.state);
          // a permission granted in another tab lands here without a reload,
          // and the device LABELS arrive with it
          if (st && st.onchange === null) {
            st.onchange = function () { setMark(st.state); refreshDevices(); };
          }
          return null;
        }).catch(function () { setMark(""); return null; });
      }

      /* ONE WINDOW, THE LENGTH THE ROW ABOVE SAYS, THROUGH voiceui's OWN
       * RECOGNISER ADAPTER. `voiceui/asr.js` is loaded by `settings.html`
       * for this and nothing else: a second wrapper around
       * `SpeechRecognition` written here would be a second thing to keep
       * true, and this button exists to prove the layer, not to be it.
       * Resolves the transcript, "" for silence, or null where this browser
       * has no recogniser at all -- which is a different answer and gets a
       * different sentence. */
      function listenOnce() {
        var VU = global.VoiceUI;
        var R = global.SpeechRecognition || global.webkitSpeechRecognition;
        var ms = ROOT.listenMs(current);
        if (!VU || !VU.asr || !R) {
          return new Promise(function (res) { global.setTimeout(res, ms); })
            .then(function () { return null; });
        }
        return new Promise(function (res) {
          var rec = new R();
          rec.continuous = false;
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          var done = false, timer = null, speech = null;
          function finish(text) {
            if (done) return;
            done = true;
            if (timer) global.clearTimeout(timer);
            try { if (speech) speech.stop(); } catch (e) { /* already stopped */ }
            res(text || "");
          }
          speech = VU.asr.createSpeechInput({
            recognizer: rec,
            onTranscript: function (t) { finish(t); },
            onEnd: function () { finish(""); },
            onError: function () { finish(""); },
          });
          timer = global.setTimeout(function () { finish(""); }, ms);
          try { speech.start(); } catch (e) { finish(""); }
        });
      }

      function runTest() {
        if (testing) return Promise.resolve();
        if (!media || typeof media.getUserMedia !== "function") {
          say("This page cannot open a microphone.");
          return Promise.resolve();
        }
        testing = true;
        if (testBtn) testBtn.disabled = true;
        say("Listening\u2026");
        var want = current.micDevice
          ? { audio: { deviceId: { exact: current.micDevice } } }
          : { audio: true };
        return media.getUserMedia(want).then(function (stream) {
          // the stream is dropped at once -- the point of taking it is the
          // permission and the labels that come with it, not the audio; the
          // recogniser opens its own
          var tr = (stream && stream.getTracks && stream.getTracks()) || [];
          for (var i = 0; i < tr.length; i++) { try { tr[i].stop(); } catch (e) { /* gone */ } }
          setMark("granted");
          refreshDevices();
          return listenOnce();
        }).then(function (heard) {
          if (heard === null) {
            say("The microphone opened for " + secondsWord(current.listenWindow)
                + ". This browser has no speech recognition, so there is nothing to print.");
          } else if (heard) {
            say("Heard: \u201c" + heard + "\u201d");
          } else {
            say("Nothing heard.");
          }
          return null;
        }).catch(function (e) {
          var name = (e && e.name) || "";
          if (name === "NotAllowedError" || name === "SecurityError") setMark("denied");
          say(name === "NotAllowedError" || name === "SecurityError"
              ? "The microphone was refused."
              : "Could not listen: " + ((e && e.message) || e) + ".");
          return null;
        }).then(function (r) {
          testing = false;
          if (testBtn) testBtn.disabled = false;
          return r;
        });
      }

      if (testBtn && testBtn.addEventListener) testBtn.addEventListener("click", runTest);
      refreshDevices();
      refreshPermission();

      return {
        el: box,
        // the menu, the slider and the segment are painted by the form's own
        // loops (they are a `select.set-menu` and two `.opts` groups); the cap
        // is the hotkey panel's, so this hands it on and does nothing else
        paint: function (s) { if (hk) hk.paint(s); },
        hotkeys: hk,
        test: runTest,
        refreshDevices: refreshDevices,
      };
    }

    var voice = buildVoice(panels.general);

    /* THE TABS GO IN THE TITLE BAR, which is Safari's way and the mock's, so
     * the host page may name where the row belongs: `settings.html` hands
     * over its own bar and the strip lands there rather than at the top of
     * the panel. Nothing else changes -- the row is the same element, built
     * once, and the panels still live where the form was mounted. */
    if (opts.tabsInto && opts.tabsInto.appendChild) opts.tabsInto.appendChild(tabsEl);
    else el.appendChild(tabsEl);
    tabs.forEach(function (t) { el.appendChild(panels[t.id]); });

    function showTab(id) {
      if (!panels[id]) return;
      open = id;
      tabs.forEach(function (t) {
        panels[t.id].hidden = t.id !== id;
        var b = tabsEl.querySelector('[data-tab="' + t.id + '"]');
        if (b) b.setAttribute("aria-selected", t.id === id ? "true" : "false");
      });
      try { global.localStorage && global.localStorage.setItem(TAB_KEY, id); } catch (e) { /* ignore */ }
      // the page around the form may have furniture that belongs to one tab
      // -- settings.html's reading preview is the only one today
      if (opts.onTab) opts.onTab(id);
      // ...and the window is resized to the tab now on screen
      reportHeightSoon(el, doc);
    }

    tabsEl.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest(".set-tab");
      if (b) showTab(b.dataset.tab);
    });

    var statusEl = opts.status || null;
    if (!statusEl) {
      statusEl = doc.createElement("div");
      statusEl.className = "settings-status ttstv-pop-note";
      statusEl.setAttribute("role", "status");
      el.appendChild(statusEl);
    }

    function status(text, bad) {
      statusEl.textContent = text || "";
      if (statusEl.classList) statusEl.classList.toggle("bad", !!bad);
      return statusEl.textContent;
    }

    /* ONE PAINTER, and it paints every shape a control takes: the option
     * buttons (segment, face tile, slider tick), the menu, the range, the
     * number beside a slider, and the Hotkeys tab's caps. A panel a tab built
     * for itself is offered the settings too, so a remap made in another
     * window lands on this one's caps without either reloading. */
    function paint(s) {
      current = normalise(s);
      apply(current);
      var buttons = el.querySelectorAll(".opts button");
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var v = fieldValue(b.dataset.field, b.dataset.value);
        b.setAttribute("aria-pressed", current[b.dataset.field] === v ? "true" : "false");
      }
      var menus = el.querySelectorAll("select.set-menu");
      for (var m = 0; m < menus.length; m++) menus[m].value = String(current[menus[m].dataset.field]);
      var ranges = el.querySelectorAll("input.set-range");
      for (var r = 0; r < ranges.length; r++) ranges[r].value = String(current[ranges[r].dataset.field]);
      // the number beside every slider and every range, from the row down
      var rowsWithVal = el.querySelectorAll(".set-row[data-field]");
      for (var k = 0; k < rowsWithVal.length; k++) {
        var row = rowsWithVal[k];
        var val = row.querySelector(".set-val");
        if (val) val.textContent = valueWord(row.dataset.field, current[row.dataset.field]);
      }
      for (var id in built) {
        if (!Object.prototype.hasOwnProperty.call(built, id)) continue;
        if (built[id] && typeof built[id].paint === "function" && id === "hotkeys") built[id].paint(current);
      }
      // the Voice group is a group and not a tab, so it is not in `built` --
      // it hands the settings to the one cap it draws
      if (voice) voice.paint(current);
      if (opts.onChange) opts.onChange(current);
      return current;
    }

    /* One save path, whichever control was used. `commit` is what the click
     * handler, the menu and the range all end in: every field, not the one
     * that changed, so a click on Sans cannot silently reset the one-word
     * stage's rate or its difficulty dial. */
    function commit(field, value) {
      var next = normalise(current);
      next[field] = value;
      paint(next);
      status("Saving…");
      return save(current).then(function (r) {
        if (r.mirrored) status("Saved — on this device and in " + (r.path || "TTS_DATA/reader/settings.json") + ".");
        else if (r.local) status("Saved on this device. Not mirrored to the SSD: " + r.why + ".");
        else status("Could not save: this browser refused local storage.", true);
        return r;
      });
    }

    /* THE BAR IS THE CONTROL, not just the dots on it. The comment over the
       slider says "click anywhere along it", and it was not true: the rail is
       an <i> with no handler, so only the five 13px ticks answered -- and
       with the track invisible there was nothing to aim at. This finds the
       nearest tick and CLICKS IT, so the choice still goes through the one
       path every other control uses and there is no second way for a value to
       be set. A click that lands on a tick is left to the handler below. */
    el.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var track = t.closest(".set-slider");
      if (!track || t.closest(".opts button")) return;
      var ticks = track.querySelectorAll(".set-ticks button");
      if (!ticks.length) return;
      var best = null, bestGap = Infinity;
      for (var i = 0; i < ticks.length; i++) {
        var r = ticks[i].getBoundingClientRect();
        var gap = Math.abs((r.left + r.right) / 2 - e.clientX);
        if (gap < bestGap) { bestGap = gap; best = ticks[i]; }
      }
      if (best && !best.disabled && best.getAttribute("aria-disabled") !== "true") best.click();
    });

    el.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest(".opts button");
      if (!b) return;   // a tab is a .set-tab and is handled on the row itself
      // a real browser will not fire a click on a disabled button; the node
      // harness will, and an unavailable face must not become the setting in
      // either of them
      if (b.disabled || b.getAttribute("aria-disabled") === "true") return;
      var field = b.dataset.field;
      commit(field, fieldValue(field, b.dataset.value));
    });

    el.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.dataset || !t.dataset.field) return;
      if (t.tagName === "SELECT" && t.classList && t.classList.contains("set-menu")) {
        commit(t.dataset.field, fieldValue(t.dataset.field, t.value));
      }
    });

    /* A range fires `input` on every pixel of the drag and `change` when the
     * finger comes off. The NUMBER follows the finger; the SAVE waits for it
     * to lift, because a drag from 300 to 260 wpm is one choice and not
     * forty POSTs to studio. */
    el.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains("set-range")) return;
      var row = t.closest && t.closest(".set-row");
      var val = row && row.querySelector(".set-val");
      if (val) val.textContent = valueWord(t.dataset.field, Number(t.value));
    });
    el.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains("set-range")) return;
      commit(t.dataset.field, clamp(t.value, WPM.min, WPM.max, DEFAULTS.wpm));
    });

    // another page (a Reader tab, the Library, the Settings page) may change
    // these too; a popover left open repaints without being reopened
    var stop = subscribe(paint);
    paint(current);
    if (opts.onTab) opts.onTab(open);
    // The opening tab, which is what sizes the window as it appears. A frame
    // later than this line: the host page still has furniture to place (the
    // reading preview is moved into its panel after `mount` returns), and a
    // height measured before that is a height of a page half built.
    reportHeightSoon(el, doc);

    return {
      el: el, statusEl: statusEl, status: status, paint: paint,
      get current() { return current; },
      refresh: function () { return paint(read()); },
      showTab: showTab,
      panels: built,
      // the Voice group: `test()` is the Test button's own path, `hotkeys` the
      // one `mic` cap it borrows from the Hotkeys tab's builder
      voice: voice,
      // the window's own size, measured and sent -- `reportHeight` returns
      // the number it sent (0 with no host), `tabHeight` only measures
      tabHeight: function () { return tabHeight(el, doc); },
      reportHeight: function () { return reportHeight(el, doc); },
      get tabs() { return tabs.map(function (t) { return t.id; }); },
      get tab() { return open; },
      destroy: function () { if (stop) stop(); },
    };
  }
  /* THE FORM'S HALF, ADDED ONTO THE ROOT'S OWN OBJECT -- see the head of
   * this file for why it is one namespace and not two. Every name below was
   * on `window.TTSTVSettings` before Stage 4 and is on it still; the only
   * difference is which file put it there, and that this page is the only
   * one that loads the file. */
  Object.assign(ROOT, {
    TABS: TABS, TAB_KEY: TAB_KEY, KAGGLE: KAGGLE, MODAL: MODAL,
    SYNC: SYNC, SYNC_PAIR_KEY: SYNC_PAIR_KEY, SYNC_LAST_KEY: SYNC_LAST_KEY, SYNC_ACCOUNT_KEY: SYNC_ACCOUNT_KEY,
    syncStateLine: syncStateLine, syncWhoLine: syncWhoLine, syncCodeText: syncCodeText,
    syncRemote: syncRemote, syncUrl: syncUrl, syncBaseOf: syncBaseOf, syncDeviceId: syncDeviceId,
    syncLocalMarginalia: syncLocalMarginalia, syncLocalPositions: syncLocalPositions,
    syncWriteMarginalia: syncWriteMarginalia, syncWritePositions: syncWritePositions,
    syncCountMarks: syncCountMarks, runSync: runSync, syncPair: syncPair, syncDiscover: syncDiscover,
    // first run (6 Sep): the rule, the card, the write and the gate
    firstRunChosen: firstRunChosen, buildFirstRunCard: buildFirstRunCard,
    firstRunChoose: firstRunChoose, firstRun: firstRun,
    // the door's pairing (23d): the key, the event, the record, the write
    TRANSFER_PAIR_KEY: TRANSFER_PAIR_KEY, TRANSFER_PAIR_EVENT: TRANSFER_PAIR_EVENT,
    pairFingerprint: pairFingerprint, pairRecord: pairRecord, pairUrlOf: pairUrlOf, pairLine: pairLine,
    pairRead: pairRead, pairWrite: pairWrite, pairForget: pairForget,
    NOT_BUILT_GOOGLE: NOT_BUILT_GOOGLE, NOT_BUILT_ICLOUD: NOT_BUILT_ICLOUD,
    // the account and Drive (26b): the page's half; the adapter is library/drive.js
    ACCOUNT: ACCOUNT, SYNC_THROUGH_KEY: SYNC_THROUGH_KEY, SYNC_DRIVE_LAST_KEY: SYNC_DRIVE_LAST_KEY, SYNC_SETTINGS_KEY: SYNC_SETTINGS_KEY,
    syncStore: syncStore, runDriveSync: runDriveSync, googleAccessToken: googleAccessToken,
    googleSignInPhone: googleSignInPhone, googleSignOutPhone: googleSignOutPhone,
    syncThrough: syncThrough, driveStateLine: driveStateLine, driveProgressLine: driveProgressLine,
    LANGUAGES: LANGUAGES,
    languageRows: languageRows, languageAnswer: languageAnswer,
    languageLine: languageLine, languageJob: languageJob,
    kaggleLines: kaggleLines, modalLines: modalLines,
    // the two lines that say what each lane IS, exported for the one test
    // that asserts the page carries them rather than re-typing them
    KAGGLE_LANE_LINE: KAGGLE_LANE_LINE, MODAL_LANE_LINE: MODAL_LANE_LINE,
    MODAL_WHERE_LINE: MODAL_WHERE_LINE,
    MODELS: MODELS, modelRows: modelRows, bytesWord: bytesWord,
    NO_INSTALL_LINE: NO_INSTALL_LINE, BYO_WEIGHTS_LINE: BYO_WEIGHTS_LINE,
    mount: mount,
    // the Settings window's height follows the open tab (1 Sep). The measure
    // is the form's: it counts `.set-panel`, which `mount` builds.
    tabHeight: tabHeight, reportHeight: reportHeight
  });
})(typeof window !== "undefined" ? window : globalThis);
