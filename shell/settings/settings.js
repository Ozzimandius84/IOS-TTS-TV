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
  var DEFAULTS = ROOT.DEFAULTS, SIZES = ROOT.SIZES, GUTTERS = ROOT.GUTTERS,
      LINES = ROOT.LINES,
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
   * data, so on a website ("web"), on a phone, in an exported bundle or over
   * file:// there is nothing behind them and they are not drawn at all.
   * The question is now asked of `TTSTVHost.kind` (W1 SHELL-WEB), not of
   * `origin()`. Hotkeys is NOT
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
           sub: "Hands-free listens through this device's default input. "
              + "Test opens it once." },
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
    assistantVoice: { field: "assistantVoice", label: "Assistant voice",
                      control: "fixed", text: "the narrator's",
                      sub: "The voice the assistant speaks back in. "
                         + "Press a voice in the reader to choose a different one." },
  };

  /* THE FOLD, one table. General and Reading as they are; Transfer becomes
   * Sync and Cloud GPU's two cards are drawn under its own; Models becomes
   * Voices. Hotkeys (a keyboard's) is not the phone's. LANGUAGES IS, since
   * 11 Sep -- Osca, after G-DICT: "the iOS app gets a Languages tab in
   * Settings -- add a language you don't have, exactly as Studio's Languages
   * tab adds one on the Mac" -- which reverses the 6 Sep line that called it
   * studio's alone; its phone panel is `buildPhoneLanguagesPanel` (the
   * phone's packs and the Mac's catalogue, never `GET /languages`).
   * `needsStudio` is dropped on the folded panels: on a phone
   * nothing is behind them and their builders say so in one line each
   * ("No studio behind this page ..."), which is the truth, where an absent
   * tab would be a hole. `by.transfer.build` is not called through `t.build`
   * so the panel handle Sync returns is still Transfer's own. */
  function phoneTabs() {
    var by = {};
    TABS.forEach(function (t) { by[t.id] = t; });
    return [
      by.general,
      by.reading,
      /* CLOUD GPU IS NOT FOLDED IN ANY MORE, AND VOICES IS NOT A TAB
       * (G-SETTINGS2, 13 Sep; Osca's `go`: *"the ten Mac-only rows are
       * HIDDEN on a phone, never drawn as apology"*). The wiring audit
       * (`2a0240a`) measured what the fold actually drew on a 393 px phone:
       * two cards and a tab that ask `/kaggle`, `/modal`, `/models` and
       * `/engines`, get null, and print a sentence apologising -- 64 px of
       * it on Voices, 298 px of it under Sync.
       *
       * AND IT IS NOT THE ORIGIN BUG. `doorUrl` (above) now gives every ask
       * in this file the paired Studio's base, and those four routes are
       * STILL 404 on a paired phone: the LAN listener answers `/sync/*`, a
       * book's payload and `_SYNC_STUDIO`'s seven, and nothing else
       * whatever the token (`studio/serve.py::sync_path_allowed`). So there
       * is no pairing that makes these cards work, and a card that cannot
       * work is not drawn -- the treatment `Where a render runs` has had
       * since 6 Sep (`if (!phone)`), applied to the rest of its own card.
       *
       * THE TEN ROWS, named, in the order the audit measured them: Kaggle's
       * account row, its Connect door (two links), its paste box, its
       * typed-key row (username · key · Connect), This week, Sessions;
       * Modal's account row, its key row (id · secret · Connect), its
       * *Set up my phone* row; and the Voices tab's engine list. What is
       * NOT here: `Where a render runs`, already hidden, and the Languages
       * tab, which has the phone's OWN panel and asks the door, not
       * `/languages`.
       *
       * The Mac is untouched: `TABS` still carries `cloud` and `models`,
       * and this function is only what a phone mounts. */
      Object.assign({}, by.transfer, {
        label: "Sync", sub: "your devices", needsStudio: false,
        build: function (panel, ctx, o) { return buildTransferPanel(panel, ctx, o); },
      }),
      Object.assign({}, by.languages, { needsStudio: false, build: buildPhoneLanguagesPanel }),
    ];
  }


  /* =================== EXTENSION CARD (General tab, 15 Sep) ==============
   * "Send articles from your browser" — a card on General that tells a Mac
   * user about the Chrome extension and lets them reveal the folder.  Not
   * drawn on phone (`opts.phone`).  Not a stored setting, so it is a
   * custom `build`, not a declarative card.  The three loading steps are
   * quoted verbatim from `extension/README.md` so a test can hold them. */

  var EXTENSION_STEPS = [
    "Chrome / Edge — chrome://extensions → Developer mode → Load unpacked → this folder.",
    "Firefox — about:debugging#/runtime/this-firefox → Load Temporary Add-on… → this folder’s manifest.json."
  ];

  function buildExtensionCard(panel, netCtx, opts) {
    if (opts.phone) return;
    var doc = panel.ownerDocument;

    var head = kEl(doc, "div", "set-head", "Send articles from your browser");
    panel.appendChild(head);

    var box = kEl(doc, "div", "set-card");

    /* explanation */
    var explain = kEl(doc, "div", "set-note",
      "One press in Chrome on an article, and the article is in your library.");
    explain.style.marginBottom = "12px";
    box.appendChild(explain);

    /* loading steps */
    var stepsHead = kEl(doc, "div", null, "Load the extension unpacked:");
    stepsHead.style.fontWeight = "600";
    stepsHead.style.marginBottom = "6px";
    box.appendChild(stepsHead);

    var ol = doc.createElement("ol");
    ol.style.margin = "0 0 12px 1.2em";
    ol.style.padding = "0";
    EXTENSION_STEPS.forEach(function (s) {
      var li = doc.createElement("li");
      li.textContent = s;
      li.style.marginBottom = "4px";
      ol.appendChild(li);
    });
    box.appendChild(ol);

    /* port line */
    var portLine = kEl(doc, "div", "set-note",
      "Frank is listening on port " + location.port + ".");
    box.appendChild(portLine);

    /* reveal button */
    var revealBtn = doc.createElement("button");
    revealBtn.className = "set-btn";
    revealBtn.textContent = "Reveal in Finder";
    revealBtn.style.marginTop = "10px";
    revealBtn.addEventListener("click", function () {
      netCtx.getJSON("/extension-path").then(function (r) {
        if (r && r.path && typeof TTSTVHost !== "undefined" && TTSTVHost.reveal) {
          TTSTVHost.reveal(r.path);
        }
      });
    });
    box.appendChild(revealBtn);

    panel.appendChild(box);
  }

  var TABS = [
    { id: "general", label: "General", sub: "the app itself",
      build: buildExtensionCard,
      cards: [
        /* WARMTH IS HERE NOW (Osca, 7 Sep: "MOVE WARMTH TO GENERAL"). The
         * field, the store and the gradient rail moved unchanged -- one line
         * out of one table and into another -- so `--warm`, `cssVars`, the
         * reader and every other surface see exactly what they saw when the
         * row was drawn on Reading. Which TAB it is drawn on was only ever a
         * question of where a person looks for it, and a ground that repaints
         * the WHOLE application is a thing about the app.
         *
         * TWO THINGS CHANGED WITH IT, BOTH MEASURED, and both are in
         * settings/STATUS.md under "Warmth → General" rather than only here:
         *
         * 1. **Its grey line became the card's note.** `warmth` is a SLIDER,
         *    and the rule this file already wrote down for slider rows (see
         *    `VOICE_ROWS.window`) is a SHORT NAME AND A LONG RULER, no `sub`:
         *    the name column is fixed so the rulers share an x, and a
         *    two-line explanation in that column is not two lines. Measured
         *    in the bench, on this card: keeping the `sub` costs 75.4 px of
         *    row at a 190 px name column and 125.8 px at 90 px, against the
         *    44 px that Size and Line stand at. The sentence is not lost --
         *    it is the card's note, under the row it explains, which is what
         *    that rule says to do with it.
         * 2. **It is second, under the font.** So the note lands directly
         *    beneath the row it belongs to rather than under a menu.        */
        { head: "Appearance", rows: [
          { field: "uiFamily", label: "Interface font", control: "menu",
            sub: "The app's own text — sidebars, menus, this window. Never the book." },
          { field: "warmth", label: "Warmth", control: "slider" },
        ], note: "Ground and ink together, so paper and ink never drift apart." },
        /* "OPENING A BOOK" IS GONE, AND IT WAS TWO ROWS THAT WROTE TO
         * NOBODY (G-SETTINGS2, 13 Sep). Added in the reader-sweep as the
         * mock's last two rows; the wiring audit (`2a0240a`) then grepped
         * `reader/ library/ voiceui/ bar/ prefs/ desktop/src studio/` for
         * both field names and found, outside `prefs.js`'s own
         * `normalise`/`isDefault`/`DEFAULTS` and this file, ZERO consumers:
         *
         *   `resume`  -- "Open books where you left them". The reader does
         *                what it does; this switch never reached it, so the
         *                row was a promise nothing kept.
         *   `sidebar` -- "Sidebar". `reader/README.md`: *"the sidebar is
         *                retired from the reader"* -- the contents panes ARE
         *                the chapter list. The row named a thing that is not
         *                there, and on a phone never was.
         *
         * WIRED OR REMOVED, and removed is the honest half: wiring either
         * one is a `reader/` diff, not a `settings/` one. The FIELDS stay in
         * `prefs/prefs.js` (`DEFAULTS`, `normalise`, `isDefault`) untouched,
         * so a device that stored a value keeps it and nothing migrates; the
         * day `reader/` reads one, the row comes back in one line. */
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
          { field: "gutter", label: "Gutter", control: "slider" },
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
        /* WARMTH LEFT THIS CARD FOR GENERAL ▸ Appearance (Osca, 7 Sep:
         * "MOVE WARMTH TO GENERAL"). The reason it can go without anything
         * following it is the one already written above: the store is the one
         * owner and every surface follows it, so which TAB the row is drawn on
         * was only ever a question of where a person would look for it -- and
         * a ground that repaints the whole application is a thing about the
         * app, which is what General is. Light/dark stays, and the head stays
         * with it: dark IS the other paper. */
        { head: "The paper", rows: [
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
  var MODAL = { GET: "/modal", CREDS: "/modal-credentials", REVOKE: "/modal-revoke",
                // the one button (13 Sep). Named here beside its three
                // siblings so the tab has one place its URLs live.
                DEPLOY: "/modal-deploy" };

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

  /* ---- THE ONE BUTTON, and the words round it (Osca, 11-12 Sep).
   *
   * *"Frank Studio carries the one button that puts `cloud/endpoint.py` into
   * the user's own workspace, mints a random pass, and syncs the address and
   * the pass to their phone. The user never sees a terminal or the word
   * deploy."* So the button says what it is FOR, and the word the CLI calls it
   * appears on no page -- the same rule the other credential already lives
   * under, applied to a verb instead of a noun.
   *
   * On a PHONE the button is not drawn and the card says so honestly, because
   * it is true: putting a door up needs the Modal client, and the client needs
   * a Mac. Saying "not available" would leave a person waiting for a version
   * that does it; saying this tells them what to go and do, once, ever. */
  var MODAL_DOOR_BUTTON = "Set up my phone";
  var MODAL_DOOR_LINE = "Puts your own cloud door up, in your own Modal account, "
    + "and gives you an address and a pass to type into Frank on your phone. "
    + "Nothing of ours touches it afterwards.";
  var MODAL_DOOR_PHONE = "Setting this up needs a Mac, once. Do it in Frank Studio "
    + "and this phone gets the address and the pass to type in.";
  var MODAL_DOOR_WORKING = "Putting your door up — this takes a few minutes the "
    + "first time, and you can leave this page open.";

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
    /* THE LINK FLOW'S OWN WORDS, and every one of them is studio's (`GET
     * /kaggle`'s `door`, studio/kaggle.py::door). Connecting is a LINK, never
     * "go and find your kaggle.json" (Osca, 11-12 Sep): one press opens the
     * SYSTEM browser at the page this person needs -- Settings > API for
     * someone who has an account, sign-up for someone who does not -- and the
     * row says which, because a single button that guesses is wrong for one of
     * the two and the free tier exists for the second one.
     *
     * `free` is the invitation, and it is the second half of the decision:
     * every user brings their own account, so the allowance is THEIRS. It is
     * said where there is no live number to say instead -- a connected account
     * has `quota` above, which is the same fact measured rather than quoted. */
    var door = d.door || null;
    return { who: who, quota: quota, slots: slots,
             quotaShort: quotaShort, slotsShort: slotsShort,
             where: (d.settings && d.settings.render && d.settings.render.where) || "here",
             canType: !!d.accepts_credentials,
             door: door,
             settingsUrl: door && door.settings_url ? door.settings_url : null,
             signupUrl: door && door.signup_url ? door.signup_url : null,
             free: door && door.free_tier ? door.free_tier : "",
             doorSay: door && door.lines ? (door.lines.settings || "") : "",
             signupSay: door && door.lines ? (door.lines.signup || "") : "",
             pasteSay: door && door.lines ? (door.lines.paste || "") : "" };
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
      /* Whether THIS studio can put a door up (`GET /modal`'s `can_deploy`),
       * read exactly as `canType` reads `accepts_credentials` and for the same
       * reason: a button is drawn only where the route behind it answers. The
       * second half is a fact about the machine -- there is nothing to put a
       * door up WITH until Modal is signed in here, and nothing to put one up
       * FROM without the client. */
      canDeploy: installed && connected && !!d.can_deploy,
      doorLine: MODAL_DOOR_LINE,
      phoneLine: MODAL_DOOR_PHONE,
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
            : TTSTVHost.WHY_STUDIO);
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
    /* J4: the pack's size and date, when one has been built. The phone tab
     * has its own line (`packLine`); THIS is the Mac tab's, where the size
     * is the raw SQLite and the date is when `dictionary/pack.py` built it.
     * An added language with no pack yet says nothing rather than lying. */
    var pk = l.pack || {};
    if (pk.built && pk.bytes) parts.push("pack " + bytesWord(pk.bytes));
    if (pk.built && pk.built_at) parts.push(packDate(pk.built_at));
    return parts.join(" · ");
  }

  /* Pure. A pack's `built_at` ISO string -> the short date the Languages
   * row prints: "11 Sep 2026". No time, because the tab is a list and a
   * timestamp in every row is noise. */
  function packDate(iso) {
    if (!iso) return "";
    var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
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
                                    size_bytes: l.size_bytes,
                                    pack: l.pack }),
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
    // THE FIELD IS HOW THE LONG TAIL IS REACHED (chat 101, from 93's table):
    // the listing carries the rows that are about something, and the other
    // ~4,500 that `dictionary/langindex.py` measured out of the dumps answer
    // only to `GET /languages?q=<text>` (`settings/routes.py`, `&limit=`,
    // 50 by default). Typing narrows the list to the route's `matches`;
    // an emptied field asks for the listing again. Debounced, and a late
    // answer to an older keystroke never paints over a newer one.
    var find = doc.createElement("input");
    find.type = "search"; find.className = "kag-in lang-find";  // the window's own field
    find.placeholder = "Find a language by name or code";
    find.setAttribute("aria-label", "Find a language by name or code");
    var list = kEl(doc, "div", "set-card lang-list");
    var note = kEl(doc, "div", "set-note lang-note", "");
    panel.appendChild(find); panel.appendChild(list); panel.appendChild(note);

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
           : TTSTVHost.WHY_STUDIO);
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
      var q = (find.value || "").trim();
      if (q) return search(q);
      return ctx.getJSON(force ? LANGUAGES.GET + "?force=1" : LANGUAGES.GET)
        .then(function (d) { return paint(languageRows(d)); });
    }

    /* `?q=` -- the route's `{q, count, matches, limit}`, and `matches` is
     * drawn exactly as a listing is (a full row where the code has one, the
     * thin `{code, name, state, why}` otherwise; `languageRows` reads both). */
    var LANG_FIND_MS = 250, findSeq = 0, findTimer = null;
    function search(q) {
      var seq = ++findSeq;
      return ctx.getJSON(LANGUAGES.GET + "?q=" + encodeURIComponent(q) + "&limit=50")
        .then(function (d) {
          if (seq !== findSeq) return null;
          return paint(languageRows({ languages: (d && d.matches) || [],
                                      error: d && d.error }));
        });
    }
    find.addEventListener("input", function () {
      if (findTimer) clearTimeout(findTimer);
      findTimer = setTimeout(function () {
        findTimer = null;
        var q = (find.value || "").trim();
        if (q) search(q); else { findSeq++; ask(); }
      }, LANG_FIND_MS);
    });

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
             line: languageLine, search: search,
             els: { list: list, note: note, find: find } };
  }

  /* ================================ THE PHONE'S LANGUAGES (G-LANG, 11 Sep)
   * Osca, 11 Sep, after G-DICT: *dictionaries on the phone are per LANGUAGE,
   * never per book; the phone gets the whole language; the iOS app gets a
   * Languages tab in Settings -- add a language you don't have, exactly as
   * Studio's Languages tab adds one on the Mac; when a book arrives in a
   * language with no pack, the phone notifies and prompts you to add it.*
   *
   * The Mac builds the packs (`dictionary/pack.py`, one SQLite file per
   * language, gzipped) and sends them by the roads books take: the paired
   * Studio's `GET /sync/manifest` carries `languages` (each row with the
   * `url` it serves the gz at), Drive carries `Frank/languages.json` (each row
   * with the gz's file `id`). THIS PAGE DECIDES NOTHING ABOUT WHICH
   * LANGUAGES HAVE A PACK: it draws what the Mac's catalogue says, beside
   * what the phone has (`TTSTVHost.dict.langs()`, the app's `dict.rs`).
   *
   * The rows are the Mac tab's rows, the same three states and the same
   * one-thing-on-the-right (`buildLanguagesPanel` above):
   *
   *   added        on this phone: *Added*, and Remove in the row's ⋯
   *   addable      in the Mac's catalogue: **Add**, the SIZE LAST in the line
   *                -- the download and what it takes on the phone, so a 70 MB
   *                Latin is a press you see, not a surprise
   *   unavailable  a language a book here is in, with no pack on the Mac:
   *                the reason, and no button
   *
   * ADD IS A DOWNLOAD, SO IT IS A JOB FOR THE APP'S PULL -- `TTSTVHost.sync.
   * start({kind: "language", ...})`, the runner `pull.rs` already is (G-SYNCBG):
   * the same fetch, retries, token refresh and resume, the same status the
   * settings dot reads. Pressed while the auto-sync runs, it waits its turn in
   * the app, not in this page. The pack lands in `<app data>/languages/`.
   *
   * The catalogue is remembered (`ttstv.lang.catalogue`), so the tab and the
   * shelf's tile line draw with no network; opening the tab asks again, the
   * paired Studio first (the fastest way, D4) and Drive otherwise (D13). */
  var LANG_CATALOGUE_KEY = "ttstv.lang.catalogue";   // {at, from: "lan"|"drive", packs: [row]}
  var LANG_NUDGE_KEY = "ttstv.lang.nudge";           // {codes: [code], seen: bool}
  var LANG_EVENT = "ttstv:langs";
  var LANG_PACK_KIND = "language";
  var LANG_TAB = "languages";
  var PACK_META = ["code", "name", "native_name", "entries", "words", "forms", "bytes", "gz_bytes",
                   "sha256", "hash", "built_at", "schema", "source"];

  function packHost(h) {
    h = h === undefined ? global.TTSTVHost : h;
    return h && h.dict && typeof h.dict.langs === "function" ? h : null;
  }

  /* Pure. The languages a book is in -- `langs` where the row carries them (a
   * MIXED book, G-LANGMIX: "a book with two languages wants two packs"; the
   * Penguin Book of French Poetry is `["en", "fr"]`), else its one `lang`.
   * Every reader of a shelf row's language in this file goes through here, so
   * a mixed book asks for BOTH its packs and its tile names the one missing. */
  function bookLangs(b) {
    var l = b && Array.isArray(b.langs) && b.langs.length ? b.langs : (b && typeof b.lang === "string" ? [b.lang] : []);
    return l.map(function (c) { return String(c || "").trim(); }).filter(Boolean);
  }

  /* A language's name: the Mac catalogue's own when it lists the language,
   * else the browser's (`Intl.DisplayNames`), else the code. Never a table in
   * this file -- two tables of language names already drifted once. */
  function packName(code, catalogue) {
    var row = (catalogue || []).filter(function (r) { return r && r.code === code; })[0];
    if (row && row.name) return row.name;
    try {
      var n = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
      if (n && n !== code) return n;
    } catch (e) { /* no Intl.DisplayNames: the code */ }
    return code;
  }

  function packCount(n) {
    return typeof n === "number" ? n.toLocaleString("en-GB") : "";
  }

  /* Pure. One row's line -- its source, its size in entries, what it takes
   * on this phone; an addable row ends with the download, LAST (the Mac
   * tab's rule: the size is the last thing on a row that offers Add). */
  function packLine(r, state) {
    r = r || {};
    var parts = [];
    var src = Array.isArray(r.source) ? r.source.map(function (s) {
      return s && (s.id === "wiktionary" ? "Wiktionary" : (s.name || s.id));
    }).filter(Boolean) : [];
    if (src.length) parts.push(src.join(" + "));
    if (typeof r.entries === "number") parts.push(packCount(r.entries) + " entries");
    if (state === "added") {
      if (r.installed_bytes || r.bytes) parts.push(bytesWord(r.installed_bytes || r.bytes) + " on this phone");
    } else if (state === "addable") {
      if (r.bytes) parts.push(bytesWord(r.bytes) + " on this phone");
      if (r.gz_bytes) parts.push(bytesWord(r.gz_bytes) + " download");
    }
    return parts.join(" · ");
  }

  /* Pure. What the tab draws: the phone's packs, the Mac's catalogue, the
   * languages of the books on this phone, and the app's pull status ->
   * `{rows, note}`. Order by state (added, addable, unavailable) and, within
   * a state, the order the phone and the Mac gave them. */
  function packRows(o) {
    o = o || {};
    var cat = Array.isArray(o.catalogue) ? o.catalogue.filter(function (r) { return r && r.code; }) : [];
    var inst = Array.isArray(o.installed) ? o.installed.filter(function (r) { return r && r.code; }) : [];
    var have = {}, offered = {}, rows = [];
    inst.forEach(function (r) { have[r.code] = r; });
    cat.forEach(function (r) { offered[r.code] = r; });
    var st = o.status && o.status.kind === LANG_PACK_KIND && o.status.running ? o.status : null;
    var waiting = o.waiting || {};
    function row(code, state, r) {
      var own = (r && r.native_name) || "";
      var name = packName(code, cat.concat(inst));
      var out = { code: code, name: name, own: own === name ? "" : own, state: state,
                  line: packLine(r, state), size: "", why: "", busy: null };
      if (state === "addable" && r.gz_bytes) out.size = bytesWord(r.gz_bytes);
      if (st && st.slug === code) out.busy = st.file === "installing" ? "installing" : "downloading";
      else if (waiting[code]) out.busy = "waiting for the sync";
      return out;
    }
    inst.forEach(function (r) {
      var x = row(r.code, "added", r);
      var newer = offered[r.code];
      if (newer && newer.hash && r.hash && newer.hash !== r.hash) x.newer = true;
      rows.push(x);
    });
    cat.forEach(function (r) { if (!have[r.code]) rows.push(row(r.code, "addable", r)); });
    var seen = {};
    (o.shelf || []).forEach(function (b) { bookLangs(b).forEach(function (code) {
      if (!code || have[code] || offered[code] || seen[code]) return;
      seen[code] = true;
      var x = row(code, "unavailable", null);
      /* THE TRUTH, AND THE GATE IS `cat`, NOT `reached` (Osca, 13 Sep).
         "no dictionary for it on the Mac" claims the Mac's list was READ and
         did not hold this language. It is only that when the list actually
         came back (`reached === true`). An EMPTY catalogue means the list is
         unknown -- never asked (`reached === null`, the first paint, and a
         phone that is neither paired nor signed in, which is where Osca saw
         this) or asked and refused (`false`). Both say the same true thing. */
      x.why = cat.length || o.reached === true
            ? "no dictionary for it on the Mac"
            : "the Mac's list not read -- pair or sign in";
      rows.push(x);
    }); });
    /* The same fact as the rows above, said once under the card -- and said
       as an INSTRUCTION, because a phone that has never reached the Mac can
       do something about it (Osca, 13 Sep: "make the note under the card say
       what to do in one sentence"). */
    var unread = !cat.length && o.reached !== true;
    var note = !packHost(o.host)
      ? "Languages are added in the Frank app: this page has no door to keep one."
      : (unread
          ? "This phone hasn't read the Mac's list of dictionaries"
            + (o.why ? " (" + String(o.why).replace(/\.\s*$/, "") + ")" : "")
            + " -- pair with Studio under Transfer, or sign in to Drive, then open this tab again."
          : (o.why ? o.why : (cat.length || inst.length
                ? "A language is added once and every book in it uses it."
                : "No languages yet: pair with Studio or sign in, then open this tab.")));
    return { rows: rows, note: note };
  }

  /* Pure. The job the app's pull runs for one pack -- `pull.rs::Job` with
   * `kind: "language"`: the "book" is the language, its one file
   * `<code>.sqlite.gz`, its row the catalogue's (written beside the pack at
   * the commit). `reach` is how the catalogue was read: the paired Studio
   * (`{transport: "lan", auth: {base, token}}`, the row's `url`) or Drive
   * (`{transport: "drive", auth}`, the row's `id`). */
  function packJob(r, reach) {
    if (!r || !r.code || !r.hash) return { why: "no pack to add" };
    if (!reach || !reach.transport) return { why: "not paired and not signed in" };
    var file = { rel: r.code + ".sqlite.gz", bytes: typeof r.gz_bytes === "number" ? r.gz_bytes : null };
    if (reach.transport === "lan") {
      if (!r.url) return { why: "Studio listed no file for " + r.code };
      file.url = r.url;
    } else {
      if (!r.id) return { why: "Drive has no file for " + r.code };
      file.id = r.id;
    }
    var meta = {};
    PACK_META.forEach(function (k) { if (r[k] !== undefined) meta[k] = r[k]; });
    return { kind: LANG_PACK_KIND, transport: reach.transport, trigger: "press", auth: reach.auth || {},
             books: [{ slug: r.code, hash: r.hash, title: r.name || r.code, meta: meta, files: [file] }] };
  }

  /* The Mac's catalogue, asked: the paired Studio first, Drive otherwise;
   * remembered on success. Resolves `{from, packs}` or `{why}`. */
  function packCatalogueFetch(o) {
    o = o || {};
    var f = o.fetch || global.fetch;
    var D = o.drive || global.TTSTVDrive;
    function save(from, packs) {
      var doc = { at: Date.now(), from: from, packs: Array.isArray(packs) ? packs : [] };
      syncWrite(LANG_CATALOGUE_KEY, doc);
      return doc;
    }
    function lan() {
      /* THE THIRD COPY OF ONE STRING, and now there is one (G-SETTINGS2,
       * 13 Sep): `doorUrl` is this line, `netCtx`'s fall-through and
       * `reader/surface.js::api()` all at once. */
      var url = doorUrl(SYNC.MANIFEST);
      if (!url || typeof f !== "function") return Promise.reject(new Error("not paired"));
      return Promise.race([
        f(url, { cache: "no-store" }),
        new Promise(function (_, no) { global.setTimeout(function () { no(new Error("Studio did not answer")); }, o.lanMs || 5000); }),
      ]).then(function (res) {
        if (!res.ok) throw new Error("Studio: HTTP " + res.status);
        return res.json();
      }).then(function (man) { return save("lan", man && man.languages); });
    }
    function drive() {
      var tok = D ? syncRead(D.GOOGLE_TOKEN_KEY) : null;
      if (!D || !tok || !tok.refresh) return Promise.reject(new Error("not signed in"));
      var client = D.driveClient(function (force) { return D.googleAccessToken(f, force); }, f);
      var folder = D.driveFolder(client);
      return folder.open().then(function () { return folder.readJSON("languages.json"); })
        .then(function (doc) { return save("drive", doc && doc.packs); });
    }
    return lan().catch(function (e1) {
      return drive().catch(function (e2) {
        var a = String((e1 && e1.message) || e1), b = String((e2 && e2.message) || e2);
        return { why: a === "not paired" ? (b === "not signed in" ? "Not paired and not signed in." : b) : a };
      });
    });
  }

  /* How a press reaches the pack: the road its catalogue came by. */
  function packReach(from, o) {
    o = o || {};
    var D = o.drive || global.TTSTVDrive;
    if (from === "lan") {
      var pair = syncRead(SYNC_PAIR_KEY);
      return pair && pair.base && pair.token ? { transport: "lan", auth: { base: pair.base, token: pair.token } } : null;
    }
    if (from === "drive" && D && typeof D.syncDriveAuth === "function") return { transport: "drive", auth: D.syncDriveAuth() };
    return null;
  }

  /* Pure. The languages of the books here that have no pack on the phone:
   * `[{code, titles}]`, each code once, in the books' order. */
  function packMissing(books, installed) {
    var have = {}, out = [], at = {};
    (installed || []).forEach(function (r) { if (r && r.code) have[r.code] = true; });
    (books || []).forEach(function (b) { bookLangs(b).forEach(function (code) {
      if (!code || have[code]) return;
      if (!(code in at)) { at[code] = out.length; out.push({ code: code, titles: [] }); }
      out[at[code]].titles.push(b.title || b.slug || "");
    }); });
    return out;
  }

  /* THE PROMPT (Osca: "notifies and prompts you to add that language").
   * A language newly missing -- a book arrived in it and no pack is here --
   * sets the Settings dot ONCE: `ttstv.lang.nudge` keeps the codes already
   * told about and whether the Languages tab has been opened since. Answers
   * whether the dot is wanted. Never a modal: the shelf's tile says the one
   * sentence, the dot says where. */
  function packNudge(missing) {
    var codes = (missing || []).map(function (m) { return m.code; });
    var was = syncRead(LANG_NUDGE_KEY) || { codes: [], seen: true };
    var known = Array.isArray(was.codes) ? was.codes : [];
    var fresh = codes.filter(function (c) { return known.indexOf(c) < 0; });
    var now = { codes: known.filter(function (c) { return codes.indexOf(c) >= 0; }).concat(fresh),
                seen: fresh.length ? false : !!was.seen };
    if (JSON.stringify(now) !== JSON.stringify(was)) {
      syncWrite(LANG_NUDGE_KEY, now);
      try { global.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { dot: packDot() } })); } catch (e) { /* no window */ }
    }
    return packDot();
  }
  /* Lane 5's dot on the settings icon reads this (and `sync.status().running`). */
  function packDot() {
    var n = syncRead(LANG_NUDGE_KEY);
    return !!(n && !n.seen && Array.isArray(n.codes) && n.codes.length);
  }
  function packNudgeSeen() {
    var n = syncRead(LANG_NUDGE_KEY);
    if (n && !n.seen) {
      n.seen = true;
      syncWrite(LANG_NUDGE_KEY, n);
      try { global.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { dot: false } })); } catch (e) { /* no window */ }
    }
  }

  /* ---- THE SHELF'S ONE LINE (the Library, on the phone). A device tile
   * whose book's language has no pack here says so under its title --
   * "Latin dictionary not on this phone · Add" -- and Add opens Settings on
   * the Languages tab. `tileLineHTML` answers at once from what is known;
   * the first call starts the one read of the phone's packs, and when it
   * lands the lines already drawn are filled in place (no re-render). */
  var packShelf = { installed: null, asked: false, wired: false };

  /* `lang` is one code, or a mixed book's codes joined by "," (the tile's
   * `data-lang`, G-LANGMIX): the line names EVERY language of the book with
   * no pack here, and offers Add when any of them is in the Mac's catalogue. */
  function packTileText(lang) {
    if (!lang || !packShelf.installed) return null;
    var codes = (Array.isArray(lang) ? lang : String(lang).split(",")).map(function (c) { return c.trim(); }).filter(Boolean);
    var missing = codes.filter(function (c) {
      return !packShelf.installed.some(function (r) { return r.code === c; });
    });
    if (!missing.length) return null;
    var cat = (syncRead(LANG_CATALOGUE_KEY) || {}).packs || [];
    var offered = missing.some(function (c) { return cat.some(function (r) { return r && r.code === c; }); });
    var names = missing.map(function (c) { return packName(c, cat); });
    return { text: names.join(" and ") + (missing.length > 1 ? " dictionaries" : " dictionary") + " not on this phone",
             add: offered };
  }

  function packTileFill(el) {
    var t = packTileText(el.getAttribute("data-lang"));
    el.hidden = !t;
    el.innerHTML = "";
    if (!t) return;
    el.appendChild(el.ownerDocument.createTextNode(t.text));
    if (t.add) {
      el.appendChild(el.ownerDocument.createTextNode(" · "));
      var b = el.ownerDocument.createElement("b");
      b.textContent = "Add";
      el.appendChild(b);
    }
  }

  function packShelfRefresh(doc) {
    var h = packHost();
    if (!h || packShelf.asked) return Promise.resolve(packShelf.installed);
    packShelf.asked = true;
    return Promise.resolve(h.dict.langs()).then(function (rows) {
      packShelf.installed = Array.isArray(rows) ? rows : [];
    }, function () { packShelf.installed = []; }).then(function () {
      doc = doc || global.document;
      var els = doc ? Array.prototype.slice.call(doc.querySelectorAll(".tile-lang[data-lang]")) : [];
      els.forEach(packTileFill);
      packNudge(packMissing(els.map(function (el) { return { lang: el.getAttribute("data-lang") }; }),
                            packShelf.installed));
      return packShelf.installed;
    });
  }

  function packOpenTab() {
    try { global.localStorage.setItem(TAB_KEY, LANG_TAB); } catch (e) { /* the tab opens first */ }
    var S = global.TTSTVSettings;
    if (S && typeof S.openWindow === "function") S.openWindow();
    else if (global.location) global.location.href = "../settings/settings.html";
  }

  function tileLineHTML(b) {
    if (!b || !b.device || !b.lang || !packHost()) return "";
    var doc = global.document;
    if (doc && !packShelf.wired) {
      packShelf.wired = true;
      // a tap on the line is Settings > Languages, not the book: captured
      // before the tile's own click opens it
      doc.addEventListener("click", function (e) {
        var t = e.target && e.target.closest ? e.target.closest(".tile-lang[data-lang]") : null;
        if (!t || t.hidden) return;
        e.preventDefault();
        e.stopPropagation();
        packOpenTab();
      }, true);
    }
    if (!packShelf.asked) packShelfRefresh(doc);
    var codes = bookLangs(b);
    var t = packTileText(codes);
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var inner = t ? esc(t.text) + (t.add ? " · <b>Add</b>" : "") : "";
    /* ITS OWN ROW, NOT THE BYLINE'S (Osca, 13 Sep, the screenshot). This span
       carried `railrow-by` as well as `tile-lang`, and at the 1 ¶ rung
       `library.css` places EVERY `.railrow-by` at `grid-row: 3` -- so the
       byline ("ARVID PAULSON") and this line ("...DICTIONARY NOT ON THIS
       PHONE") were placed in the same cell and drawn on top of each other.
       The class is `railrow-lang` now; library.css gives it the byline's
       type and a row of its own. */
    return '<span class="railrow-lang tile-lang" data-lang="' + esc(codes.join(",")) + '"' + (t ? "" : " hidden") + ">" + inner + "</span>";
  }

  /* ---- THE TAB, on the phone. */
  function buildPhoneLanguagesPanel(panel, ctx, opts) {
    var doc = panel.ownerDocument;
    var host = packHost();
    panel.appendChild(kEl(doc, "div", "set-head", "Languages"));
    var list = kEl(doc, "div", "set-card lang-list");
    var note = kEl(doc, "div", "set-note lang-note", "");
    panel.appendChild(list); panel.appendChild(note);
    var remembered = syncRead(LANG_CATALOGUE_KEY) || {};
    var state = { catalogue: remembered.packs || [], from: remembered.from || null, installed: [], shelf: [],
                  status: null, reached: null, why: null, waiting: {}, said: {} };
    var timer = null;

    function paint() {
      var model = packRows({ catalogue: state.catalogue, installed: state.installed, shelf: state.shelf,
                             status: state.status, reached: state.reached, why: state.why,
                             waiting: state.waiting, host: host });
      list.innerHTML = "";
      note.textContent = model.note;
      model.rows.forEach(function (l) {
        var r = kEl(doc, "div", "set-row lang-row");
        r.dataset.lang = l.code;
        r.dataset.state = l.state;
        if (l.state === "unavailable") r.classList.add("lang-off");
        var left = kEl(doc, "div", "set-l");
        var top = kEl(doc, "div", "lang-top");
        top.appendChild(kEl(doc, "span", "lang-name", l.name));
        if (l.own) top.appendChild(kEl(doc, "span", "lang-own", l.own));
        left.appendChild(top);
        if (l.line) left.appendChild(kEl(doc, "small", "lang-line", l.line));
        r.appendChild(left);
        var right = kEl(doc, "div", "set-c");
        if (state.said[l.code]) {
          right.appendChild(kEl(doc, "span", "lang-said", state.said[l.code]));
        } else if (l.busy) {
          var wrap = kEl(doc, "div", "kag-installing lang-adding");
          var bar = kEl(doc, "div", "kag-bar lang-bar");
          bar.appendChild(kEl(doc, "i", null, null));
          wrap.appendChild(bar);
          wrap.appendChild(kEl(doc, "div", "kag-dim kag-stage", l.busy));
          right.appendChild(wrap);
        } else if (l.state === "added") {
          right.appendChild(kEl(doc, "span", "lang-state", l.newer ? "Newer on the Mac" : "Added"));
          var more = doc.createElement("button");
          more.type = "button"; more.className = "lang-more"; more.dataset.more = l.code;
          more.setAttribute("aria-label", "More for " + l.name);
          more.textContent = "⋯";
          right.appendChild(more);
          var menu = kEl(doc, "div", "lang-menu");
          menu.hidden = true;
          if (l.newer) {
            var up = doc.createElement("button");
            up.type = "button"; up.className = "lang-remove"; up.dataset.add = l.code;
            up.textContent = "Update";
            menu.appendChild(up);
          }
          var rm = doc.createElement("button");
          rm.type = "button"; rm.className = "lang-remove"; rm.dataset.remove = l.code;
          rm.textContent = "Remove";
          menu.appendChild(rm);
          right.appendChild(menu);
        } else if (l.state === "addable") {
          var b = doc.createElement("button");
          b.type = "button"; b.className = "lang-btn"; b.dataset.add = l.code;
          b.textContent = "Add";
          right.appendChild(b);
        } else {
          right.appendChild(kEl(doc, "span", "lang-why", l.why || "not available"));
        }
        r.appendChild(right);
        list.appendChild(r);
      });
      return model;
    }

    /* What the phone has: its packs, its books' languages, the app's pull. */
    function refresh() {
      if (!host) return Promise.resolve(paint());
      var books = host.books && typeof host.books.list === "function" ? host.books.list() : [];
      var st = host.sync && typeof host.sync.status === "function" ? host.sync.status() : null;
      return Promise.all([Promise.resolve(host.dict.langs()).catch(function () { return []; }),
                          Promise.resolve(books).catch(function () { return []; }),
                          Promise.resolve(st).catch(function () { return null; })])
        .then(function (got) {
          state.installed = Array.isArray(got[0]) ? got[0] : [];
          state.shelf = Array.isArray(got[1]) ? got[1] : [];
          state.status = got[2];
          if (!(state.status && state.status.running)) state.waiting = {};
          packShelf.installed = state.installed;
          packNudge(packMissing(state.shelf, state.installed));
          paint();
          watchIfRunning();
          return state;
        });
    }

    /* While a pack is coming, ask the app how it is going -- every second,
     * only while it runs and this page is showing. */
    function watchIfRunning() {
      var st = state.status;
      var busy = st && st.running && (st.kind === LANG_PACK_KIND || Object.keys(state.waiting).length);
      if (!busy || timer) return;
      timer = ctx.after(opts && opts.langPollMs != null ? opts.langPollMs : 1000).then(function () {
        timer = null;
        return refresh();
      });
    }

    function ask() {
      return packCatalogueFetch(opts && opts.langFetch).then(function (r) {
        if (r && r.packs) { state.catalogue = r.packs; state.from = r.from; state.reached = true; state.why = null; }
        else { state.reached = false; state.why = state.catalogue.length ? null : (r && r.why) || null; }
        return paint();
      });
    }

    function row(code) {
      return state.catalogue.filter(function (r) { return r && r.code === code; })[0] || null;
    }

    list.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest || !host) return;
      var more = t.closest("[data-more]");
      if (more) {
        var menu = more.parentNode.querySelector(".lang-menu");
        var open = menu && menu.hidden;
        Array.prototype.forEach.call(list.querySelectorAll(".lang-menu"), function (m) { m.hidden = true; });
        if (menu && open) menu.hidden = false;
        return;
      }
      var rm = t.closest("[data-remove]");
      if (rm && !rm.disabled) {
        var gone = rm.dataset.remove;
        rm.disabled = true;
        Promise.resolve(host.dict.remove(gone)).then(function () { delete state.said[gone]; return refresh(); },
          function (err) { state.said[gone] = String((err && err.message) || err); paint(); });
        return;
      }
      var b = t.closest("[data-add]");
      if (!b || b.disabled) return;
      var code = b.dataset.add;
      b.disabled = true;
      var job = packJob(row(code), packReach(state.from, opts && opts.langFetch));
      if (job.why || !(host.sync && typeof host.sync.start === "function")) {
        state.said[code] = job.why || "this app cannot pull";
        paint();
        return;
      }
      delete state.said[code];
      Promise.resolve(host.sync.start(job)).then(function (st) {
        state.status = st || null;
        // pressed during a pull: the app keeps it and runs it next
        if (st && st.running && st.kind !== LANG_PACK_KIND) state.waiting[code] = true;
        paint();
        watchIfRunning();
      }, function (err) { state.said[code] = String((err && err.message) || err); paint(); });
    });

    // THE DOT IS SEEN when this tab is: open now, or its tab pressed later
    if (!panel.hidden) packNudgeSeen();
    doc.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.set-tab[data-tab="' + LANG_TAB + '"]') : null;
      if (t) packNudgeSeen();
    });
    paint();
    var ready = refresh().then(function () { return ask(); });
    return { paint: paint, refresh: refresh, ask: ask, ready: ready, state: state, els: { list: list, note: note } };
  }

  global.TTSTVLangs = {
    CATALOGUE_KEY: LANG_CATALOGUE_KEY, NUDGE_KEY: LANG_NUDGE_KEY, EVENT: LANG_EVENT, KIND: LANG_PACK_KIND,
    name: packName, line: packLine, rows: packRows, job: packJob, missing: packMissing,
    catalogue: packCatalogueFetch, reach: packReach, nudge: packNudge, dot: packDot, nudgeSeen: packNudgeSeen,
    tileLineHTML: tileLineHTML, openTab: packOpenTab, bookLangs: bookLangs,
    // the shelf's own state, for a test to reset between pages
    _shelf: packShelf,
  };

  function buildKagglePanel(panel, ctx, opts) {
    // a phone renders nowhere but the cloud: no "This Mac" to choose, no
    // model to install (6 Sep, THE PHONE WHOLE -- no "on this Mac" notes)
    var phone = !!(opts && opts.phone);
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
    /* THE ALLOWANCE, AND WHOSE IT IS (Osca, 11-12 Sep). Every user brings
     * their own account, so the free tier is theirs and not a share of
     * anyone's -- which is the whole reason the app asks for an account at
     * all. studio's sentence, beside the name, wherever there is not a LIVE
     * number to say instead: a connected account has its measured hours two
     * rows down, and quoting the published allowance under them would be the
     * same fact twice, once measured and once from a brochure. */
    var free = kEl(doc, "small", "kag-why-here kag-free", "");
    free.hidden = true;
    whoL.appendChild(free);
    whoL.appendChild(kEl(doc, "small", "kag-why-here",
      phone ? "Renders run on Kaggle." : "Renders run on Kaggle unless you install a model on this Mac."));
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
    // the row exists either way (paint() writes to it); on a phone it is
    // never on the card, because there is no "here" for a render to run
    if (!phone) card.appendChild(whereRow);

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
    creds.appendChild(kEl(doc, "div", "set-head", "Connect Kaggle"));

    /* ---- THE DOOR. Two links and a sentence each, and both URLs are
     *      studio's: no address of Kaggle's is spelled in this file at all, so
     *      the day one of them moves it moves in `studio/kaggle.py` and this
     *      page follows. `settings/tests/test_byok.py` asserts that.
     *
     *      `<a>` and not `<button class="kag-btn">`, deliberately: a person
     *      may want to copy the address, open it in another profile, or send
     *      it to the laptop the account is on, and a link does all three for
     *      free. (It also keeps `.kag-creds .kag-btn` meaning the one button
     *      it has always meant.) `target`/`rel` because Frank's shell is a web
     *      view, and a door that replaced the settings page with Kaggle's own
     *      would lose the box the person is about to paste into. */
    var doorBlock = kEl(doc, "div", "kag-door");
    doorBlock.hidden = true;
    var doorSay = kEl(doc, "div", "kag-dim kag-doorsay", "");
    var doorLinks = kEl(doc, "div", "kag-row kag-doorlinks");
    function doorLink(cls) {
      var a = doc.createElement("a");
      a.className = "kag-link " + cls;
      a.target = "_blank"; a.rel = "noopener noreferrer";
      return a;
    }
    var settingsLink = doorLink("kag-door-settings");
    var signupLink = doorLink("kag-door-signup");
    doorLinks.appendChild(settingsLink); doorLinks.appendChild(signupLink);
    doorBlock.appendChild(doorSay); doorBlock.appendChild(doorLinks);
    creds.appendChild(doorBlock);

    /* ---- THE RETURN LEG: one paste of the WHOLE file, or the same file
     *      chosen from Files. There is no OAuth for a Kaggle API key, so this
     *      is what a link flow's other half has to be -- and what Kaggle hands
     *      a person is a downloaded `kaggle.json`, not two fields. Asking them
     *      to open it and pick the two out is asking them to do the app's job;
     *      studio's `parse_pasted_credentials` does it instead.
     *
     *      ONE ROUTE, TWO WAYS IN. The picker reads the file in the page and
     *      puts its text in the same box, so what is POSTed is identical and
     *      `POST /kaggle-credentials` has one writer behind it, not two. */
    var pasteBlock = kEl(doc, "div", "kag-pastebox");
    var pasteSay = kEl(doc, "div", "kag-dim kag-pastesay", "");
    var pasteIn = doc.createElement("textarea");
    pasteIn.className = "kag-in kag-paste";
    pasteIn.rows = 3;
    pasteIn.setAttribute("aria-label", "Your kaggle.json");
    pasteIn.placeholder = '{"username": …}';
    pasteIn.autocomplete = "off"; pasteIn.spellcheck = false;
    var fileIn = doc.createElement("input");
    fileIn.type = "file"; fileIn.className = "kag-file";
    fileIn.accept = ".json,application/json";
    fileIn.setAttribute("aria-label", "Choose kaggle.json from Files");
    pasteBlock.appendChild(pasteSay);
    pasteBlock.appendChild(pasteIn);
    pasteBlock.appendChild(fileIn);
    creds.appendChild(pasteBlock);
    var credCard = kEl(doc, "div", "set-card");
    var credRow = kEl(doc, "div", "set-row kag-credrow");
    credRow.appendChild(kEl(doc, "div", "kag-dim kag-credsay",
      "Or type the two lines out of that file by hand."));
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

    /* What the last answer said about whether studio takes a credential at
     * all. The Connect button reads it rather than re-deriving it: a studio
     * that says `accepts_credentials: false` has no route behind this card,
     * and revealing a box over one would be a form that 404s. */
    var lastCanType = false;

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
      /* THE DOOR IS DRAWN FROM STUDIO'S ANSWER OR NOT AT ALL. A studio old
       * enough to send no `door` gets the card it always had -- two typed
       * fields -- rather than two links with nothing behind them. */
      doorBlock.hidden = !L.settingsUrl;
      doorSay.textContent = L.doorSay;
      settingsLink.setAttribute("href", L.settingsUrl || "#");
      settingsLink.textContent = connected ? "Open Kaggle again" : "Open Kaggle";
      signupLink.setAttribute("href", L.signupUrl || "#");
      signupLink.hidden = !L.signupUrl;
      signupLink.textContent = L.signupSay || "";
      pasteSay.textContent = L.pasteSay;
      pasteBlock.hidden = !L.settingsUrl;
      /* The allowance is the INVITATION, so it is said where there is nothing
       * connected and nothing measured. `L.free` is studio's line; an empty
       * one hides the row rather than leaving a blank under the name. */
      free.textContent = L.free;
      free.hidden = connected || !L.free;
      lastCanType = L.canType;
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

    /* The paste is read and cleared by the same `take`, for the same reason:
     * a whole `kaggle.json` is a credential with a username wrapped round it,
     * and it exists as the argument of one POST and nowhere else -- not in the
     * box it was pasted into, not in a closure that outlives the click. */
    saveBtn.addEventListener("click", function () {
      var pasted = take(pasteIn);
      if (pasted && pasted.trim()) {
        say.textContent = "Reading that file…";
        ctx.postJSON(KAGGLE.CREDS, { paste: pasted }).then(function (r) {
          pasted = null;
          var b = (r && r.body) || {};
          say.textContent = r.ok
            ? ("Connected" + (b.username ? " as " + b.username : "")
               + ". The file is written to ~/.kaggle/kaggle.json and is never shown again.")
            : (r.status === 404
                ? "This studio does not take a pasted file yet — type the two fields instead."
                : ("Not connected: " + r.why + "."));
          return ask(!r.ok);
        });
        return;
      }
      var user = take(userIn), key = take(keyIn);
      if (!user || !key) {
        say.textContent = "Paste the whole kaggle.json — or fill in both fields below it.";
        return;
      }
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

    /* THE FILES PICKER IS THE PASTE BOX, filled in by the browser instead of
     * by a person. The file's text goes into the same box and the same button
     * sends it, so there is one route, one writer and one thing to get right.
     * Nothing is uploaded by the picker itself: `accept` is a hint, the read
     * is local, and a browser without `File.text()` falls back to the reader
     * every browser has had for a decade. */
    fileIn.addEventListener("change", function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      fileIn.value = "";                       // the same read-and-clear rule
      function landed(text) {
        pasteIn.value = text || "";
        say.textContent = text
          ? "Read. Press Connect."
          : "That file was empty.";
      }
      try {
        if (f.text) { f.text().then(landed, function () { landed(""); }); return; }
        var fr = new (doc.defaultView || window).FileReader();
        fr.onload = function () { landed(String(fr.result || "")); };
        fr.onerror = function () { landed(""); };
        fr.readAsText(f);
      } catch (e) { landed(""); }
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
      /* NOT CONNECTED: *Connect…* is the LINK (Osca, 11-12 Sep). It opens
       * the system browser at the page studio named and reveals the box the
       * downloaded file comes back into. It does NOT run `kaggle auth login`
       * any more, and the reason is not taste: that flow needs the CLI on
       * this Mac, which is exactly what a fresh machine does not have, and it
       * writes a different file (`credentials_path`'s own note). A door that
       * only works once the tool is installed is no door for the person the
       * free tier is for.
       *
       * `pollConnect` and the CONNECT route are still here and still work --
       * a Mac that has signed in that way stays signed in, and nothing about
       * this press un-signs it. What changed is which door the button is. */
      if (!lastCanType) {
        say.textContent = "This studio cannot take a Kaggle sign-in yet.";
        return;
      }
      credsOpen = true;
      creds.hidden = false;
      openDoor(settingsLink);
      say.textContent = "Kaggle is open in your browser. Make a new one under API, "
        + "then paste the file it downloads into the box.";
    });

    /* Open the door, and never fail loudly if the shell will not. A web view
     * can refuse `window.open`; the link is in the page either way, and a
     * person can press it themselves -- which is the fallback, rather than an
     * error about a popup. */
    function openDoor(link) {
      /* `getAttribute` and not `.href`: the property is the RESOLVED address
       * in a browser and is not there at all in a document that was never
       * given a base, and what we want either way is the string studio sent. */
      var href = link && link.getAttribute ? link.getAttribute("href") : null;
      if (!href || href === "#") return false;
      try {
        /* `defaultView` in a browser; the global in a shell that has a window
         * and no view on the document (the page harness, and any document
         * built rather than loaded). Whichever answers first. */
        var w = doc.defaultView || (typeof window !== "undefined" ? window : null);
        if (w && w.open) { w.open(href, "_blank", "noopener"); return true; }
      } catch (e) { /* the link is still there */ }
      return false;
    }
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
                    revoke: revokeBtn, where: whereOpts,
                    // the link flow (13 Sep): the two doors, the one box the
                    // downloaded file comes back into, the picker that fills
                    // it in, and the allowance said beside the name
                    door: doorBlock, doorSay: doorSay, settingsLink: settingsLink,
                    signupLink: signupLink, paste: pasteIn, pasteSay: pasteSay,
                    pasteBox: pasteBlock, file: fileIn, free: free } };
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
  function buildModalCard(panel, ctx, opts) {
    // a phone can hold a pairing and cannot make one: the client that puts a
    // door up is a Mac's (see MODAL_DOOR_PHONE)
    var phone = !!(opts && opts.phone);
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

    /* ---- THE ONE BUTTON, and what comes back from it.
     *
     * Its own card under the sign-in, because they are two different
     * questions: *is this Mac signed in to Modal* and *is there a door up for
     * my phone*. A person can be the first without the second, which is the
     * normal state before this button has ever been pressed.
     *
     * WHAT COMES BACK IS SHOWN ONCE AND IS NOT KEPT. The pass was minted a
     * second ago by studio, nothing on this page stores it, and a re-render
     * clears it: the person copies it into Frank on their phone (Settings >
     * Transfer takes an address and a pass) or presses the button again and
     * gets a new one. This page has no second home for it, which is the rule
     * both cards above are built on -- and it is why the address and the pass
     * are TEXT a person can select, and not a field with a value the DOM keeps
     * across a paint. */
    var doorCard = kEl(doc, "div", "kag-creds mod-door");
    doorCard.hidden = true;
    doorCard.appendChild(kEl(doc, "div", "set-head", "Your phone"));
    var doorBox = kEl(doc, "div", "set-card");
    var doorRow = kEl(doc, "div", "set-row mod-doorrow");
    var doorL = kEl(doc, "div", "set-l");
    var doorSayEl = kEl(doc, "div", "kag-dim mod-doorsay", MODAL_DOOR_LINE);
    doorL.appendChild(doorSayEl);
    var doorBtn = doc.createElement("button");
    doorBtn.type = "button"; doorBtn.className = "kag-btn kag-primary mod-doorbtn";
    doorBtn.textContent = MODAL_DOOR_BUTTON;
    var doorActs = kEl(doc, "div", "set-c kag-row");
    doorActs.appendChild(doorBtn);
    doorRow.appendChild(doorL); doorRow.appendChild(doorActs);
    doorBox.appendChild(doorRow);
    // what the phone is told: an address, a pass, and the eight characters
    // that say the two belong together (`fingerprint`, computed at both ends)
    var pairRow = kEl(doc, "div", "set-row mod-pairrow");
    pairRow.hidden = true;
    var pairOut = kEl(doc, "div", "mod-pair st", "");
    pairRow.appendChild(pairOut);
    doorBox.appendChild(pairRow);
    doorCard.appendChild(doorBox);
    panel.appendChild(doorCard);

    var say = kEl(doc, "div", "set-note kag-line kag-say mod-say");
    say.setAttribute("role", "status");
    panel.appendChild(say);

    /* One line per fact, in the order a person reads them out to a phone.
     * Built by hand rather than by innerHTML: every one of these is a string
     * studio made, and two of them are about a credential. */
    function drawPairing(b) {
      while (pairOut.firstChild) pairOut.removeChild(pairOut.firstChild);
      [["Address", b.url], ["Pass", b.pass], ["Check", b.fp]].forEach(function (o) {
        if (!o[1]) return;
        var line = kEl(doc, "div", "mod-pairline");
        line.appendChild(kEl(doc, "span", "mod-pairname", o[0]));
        line.appendChild(kEl(doc, "span", "mod-pairval", o[1]));
        pairOut.appendChild(line);
      });
      pairOut.appendChild(kEl(doc, "small", "kag-dim mod-pairsay",
        "Type these into Frank on your phone, under Settings ▸ Transfer. The pass "
        + "is shown once and is not kept here; press again for a new one."));
      pairRow.hidden = !pairOut.firstChild;
    }

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
      /* THE DOOR CARD. On a phone it is a sentence and never a button; on a
       * Mac it appears once Modal is signed in here, because there is nothing
       * to put a door up with before that. A studio that does not answer
       * `can_deploy` draws nothing at all -- the older-studio rule the two
       * cards above already follow. */
      doorCard.hidden = phone ? !L.connected : !L.canDeploy;
      doorBtn.hidden = phone;
      doorSayEl.textContent = phone ? L.phoneLine : L.doorLine;
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

    /* THE PRESS. One POST with an EMPTY BODY: there is nothing a page may
     * send to this route, because a route that accepted a pass could be asked
     * to put a chosen one on a door. It can only be asked to make a new one.
     *
     * The button is disabled while it runs -- a deploy takes minutes the first
     * time, and a second press would mint a second pass and leave the person
     * holding the one the door no longer has. */
    doorBtn.addEventListener("click", function () {
      doorBtn.disabled = true;
      pairRow.hidden = true;
      say.textContent = MODAL_DOOR_WORKING;
      ctx.postJSON(MODAL.DEPLOY, {}).then(function (r) {
        doorBtn.disabled = false;
        var b = (r && r.body) || {};
        /* A 409 with a url means the door IS up but the render lane failed:
         * draw the pairing (the pass is still good) and name which half. */
        if (!r.ok && !(r.status === 409 && b.url)) {
          say.textContent = r.status === 404
            ? "This studio cannot put a door up yet."
            : ("Not set up: " + (b.error || r.why) + ".");
          return ask(true);
        }
        drawPairing(b);
        var doorLine = "Your door is up"
          + (b.workspace ? " in " + b.workspace : "") + ".";
        var renderLine = (b.render && b.render.ok)
          ? "  Render lane deployed."
          : "  Render lane failed"
            + (b.render && b.render.error ? ": " + b.render.error : "") + ".";
        say.textContent = doorLine + "\n" + renderLine;
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
                    where: whereLine, connect: saveBtn, revoke: revokeBtn,
                    // the one button (13 Sep) and what it hands the phone
                    doorCard: doorCard, doorBtn: doorBtn, doorSay: doorSayEl,
                    pairRow: pairRow, pair: pairOut } };
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
    // G-PAIRMAIL (14 Sep): the Mac's own press, the one consent screen road 1
    // needs, and the square. Loopback only -- `studio/serve.py::
    // sync_path_allowed` answers no path it has not named.
    PAIR_START: "/sync/pair/start", PAIR_SCOPE: "/sync/pair/scope", PAIR_QR: "/sync/pair/qr",
    MARGINALIA: "/sync/marginalia", POSITIONS: "/sync/positions",
    // studio's own settings file, the same POST the Cloud GPU tab's WHERE
    // uses (`KAGGLE.SETTINGS`): one file, one endpoint, and each row sends
    // the key it owns.
    SETTINGS: "/settings",
  };
  var SYNC_PAIR_KEY = "ttstv.sync.pair";       // {base, token, name, paired}
  var SYNC_LAST_KEY = "ttstv.sync.last";       // {at, books, marks}
  var SYNC_ACCOUNT_KEY = "ttstv.sync.account"; // {kind: "device"|"google"|"icloud", who}
  var SYNC_MARG_PREFIX = "ttstv.reader.marginalia.";
  var SYNC_LIB_KEY = "ttstv.reader.library";
  var SYNC_DEVICE_KEY = "ttstv.reader.deviceId";
  var SYNC_DISCOVER_MS = 2500;

  /* ============== THE PHONE'S ORIGIN IS NOT AN ORIGIN (G-SETTINGS2, 13 Sep)
   *
   * `prefs.js::origin()` answers null unless the protocol is http(s), and
   * Frank's phone webview is `frank://localhost`
   * (`TTSTV_IOS/src-tauri/src/lib.rs`). So every studio ask this file made
   * resolved to null on a phone that had a Studio on the Wi-Fi -- the same
   * bug `reader/surface.js` carried until G-STUDIOPHONE gave its base the
   * PAIRING as the fall-through (the wiring audit, `2a0240a` §6b, asked for
   * this by name). This is that fall-through, in this file, ONCE:
   * `ttstv.sync.pair`'s {base, token} -- the record the Transfer tab itself
   * writes -- with the pass as `?t=`, which is what
   * `studio/serve.py::SyncHandler` reads. Never a header: a simple request
   * is one round trip rather than a preflight, and that is `surface.js`'s
   * own reason as well as `syncUrl`'s.
   *
   * ON THE MAC `askUrl` RETURNS `origin() + path`, character for character,
   * and the pairing is never read -- Studio's own page is http(s), so the
   * first line answers. That is not a hope, it is the order of two returns.
   *
   * AND IT IS NOT A KEY TO THE WHOLE SERVER, which is the half of this that
   * decides what the phone draws. The LAN listener answers `/sync/*`, a
   * book's payload files and `_SYNC_STUDIO`'s seven routes, and 404s
   * everything else WHATEVER THE TOKEN
   * (`studio/serve.py::sync_path_allowed`). So this makes `/sync/manifest`
   * answer on a paired phone and does NOT make `/models`, `/engines`,
   * `/kaggle`, `/modal`, `/settings` or `/account` answer. That is why the
   * cards which ask those are not built on a phone at all (`phoneTabs`)
   * rather than built and apologising: the apology was never about the
   * origin. */
  function doorUrl(path) {
    var rec = syncRead(SYNC_PAIR_KEY);
    var base = (rec && typeof rec.base === "string") ? rec.base.replace(/\/+$/, "") : "";
    var tok = (rec && typeof rec.token === "string") ? rec.token : "";
    if (!/^https?:\/\//i.test(base) || !tok) return null;
    return base + path + (path.indexOf("?") >= 0 ? "&" : "?")
         + "t=" + encodeURIComponent(tok);
  }
  /* The one address a studio ask in this file goes to: this origin where
   * there is one, else the door this device is paired with, else nowhere.  */
  function askUrl(path) {
    // W1 SHELL-WEB: on a website neither studio nor the door is reachable.
    if (global.TTSTVHost && global.TTSTVHost.isWeb) return null;
    var o = origin();
    return o ? o + path : doorUrl(path);
  }

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
  function syncWhen(at, now) {
    var d = new Date(at), n = new Date(now == null ? Date.now() : now);
    var sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    var pad = function (x) { return (x < 10 ? "0" : "") + x; };
    return sameDay ? pad(d.getHours()) + ":" + pad(d.getMinutes())
      : d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  }
  function syncStateLine(last, now) {
    if (!last || !last.at) return "Never synced";
    var when = syncWhen(last.at, now);
    var books = Number(last.books) || 0, marks = Number(last.marks) || 0;
    return "Last synced " + when + " · " + books + (books === 1 ? " book" : " books")
      + " · " + marks + (marks === 1 ? " mark" : " marks");
  }

  /* Pure: the row's line from the APP's pull (G-SYNCBG, 11 Sep) --
   * `TTSTVHost.sync.status()`, on the phone. What ran and why: running, the
   * words the page's own pull used ("Pulling 3 of 26 · Hamlet · 12/31");
   * over, "Synced over LAN · 2 books · 17:41", "Drive · up to date · 17:41",
   * with "on opening" / "on return" when the app asked by itself; short,
   * how far it got and the reason. "" when this launch has run nothing. */
  var PULL_WHO = { drive: "Drive", lan: "LAN" };
  var PULL_WHY = { launch: "on opening", foreground: "on return" };
  function syncPullLine(st, now) {
    if (!st || !st.since) return "";
    var who = PULL_WHO[st.transport] || "Sync";
    if (st.running) {
      if (!st.i) return "Pulling · " + who + "…";
      return "Pulling " + st.i + " of " + st.n + " · " + (st.book || st.slug || "") + " · " + st.done + "/" + st.total;
    }
    if (st.why) return who + " · " + (st.pulled ? st.pulled + " of " + st.n + " pulled · " : "") + st.why;
    var tail = " · " + syncWhen(st.ended || st.since, now) + (PULL_WHY[st.trigger] ? " · " + PULL_WHY[st.trigger] : "");
    if (st.pulled) return "Synced over " + who + " · " + st.pulled + (st.pulled === 1 ? " book" : " books") + tail;
    return who + " · up to date" + tail;
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

  /* THE DEAD GRANT (B-phone, 26 Sep). Osca's phone: "Connected as ..." and
   * every Sync refused with `invalid_grant -- Token has been expired or
   * revoked` -- the grant of 11 Sep died with the reinstall, and the row
   * offered nothing but Sign out. The account IS still the account, so the
   * who-line stays; what changes is the button: Sign out becomes SIGN IN
   * AGAIN, which is the one existing sign-in flow (`signIn()`), whose
   * success writes a fresh grant over the dead one and then presses Sync.
   * Pure: is this refusal the dead grant -- drive.js's sentence or
   * pull.rs's ("the refresh was refused: HTTP 400 (invalid_grant)")? */
  function syncNeedsSignIn(why) {
    return /\binvalid_grant\b/.test(String((why && why.message) || why || ""));
  }
  /* Pure: the row's line while the grant is dead. */
  function syncSignInAgainLine(account) {
    return "Drive refused the saved sign-in" + (account && account.who ? " for " + account.who : "")
      + " \u2014 it expired or was revoked. Sign in again to sync.";
  }

  /* Pure: the code as the row prints it, "483 912". */
  /* TEN digits since 14 September (Osca: *"It's just got to be a 10-digit
   * number or a QR code"*), grouped the way a phone number is, because that
   * is the grouping a person reads across a room without losing their place.
   * `studio/sync.py::CODE_DIGITS` is the same number and the only source of
   * it; anything of another length is printed as it came, which is what a
   * Studio older than today looks like. */
  var SYNC_CODE_DIGITS = 10;
  function syncCodeText(code) {
    var s = String(code || "").replace(/\D/g, "");
    if (s.length !== SYNC_CODE_DIGITS) return s;
    return s.slice(0, 3) + " " + s.slice(3, 6) + " " + s.slice(6);
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
        // G-SYNCBG: on the phone the books go to the app, which pulls them
        // outside this page; this press only plans them (library/drive.js)
        var D = driveModule();
        if (o.pull && D && typeof D.syncHandOff === "function") {
          say("Handing the books to Frank…");
          return D.syncHandOff(o.pull, "lan", { base: remote.base, token: remote.token }, man.books || [],
                               { bundle: bundle, href: href, trigger: "press" })
            .then(function (h) { out.handed = h.handed; out.refused = h.refused; out.status = h.status; });
        }
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
   * {why}. `hello` and `pair` are the two open routes.
   *
   * ================= TWO STATES, AND WHY THERE WERE NOT TWO BEFORE (14 Sep)
   *
   * The browse used to answer a bare array, so an empty one carried two
   * different facts under one word: there is no Mac on this Wi-Fi (ordinary;
   * the typed address is the answer), and this build is not ALLOWED to look
   * (`com.apple.developer.networking.multicast`, or the local-network prompt
   * declined). The card drew "No Studio found on this network" for both,
   * which in the second case sends a person hunting a router fault they do
   * not have.
   *
   * `lib.rs::Discovery` answers `{studios, allowed, why}` now, and this is
   * the one place the shape is normalised, because THE SHELL SHIPS TO PHONE
   * BUILDS OLDER THAN ITSELF: `import_shell.py` carries these pages into an
   * app that was built whenever it was built, so a bare array is still a
   * legal answer here and means "an older Frank, which could only look".
   *
   * A host without the method at all is not a phone -- a browser, or the Mac
   * -- and `allowed` is false with no sentence: there is nothing to explain
   * and nothing went wrong. */
  function syncDiscoverShape(r) {
    if (Array.isArray(r)) return { studios: r, allowed: true, why: null };     // an older Frank
    if (r && Array.isArray(r.studios)) {
      return { studios: r.studios, allowed: r.allowed !== false, why: r.why || null };
    }
    return { studios: [], allowed: true, why: null };
  }
  /* The one line above the card, and the only place the three states are
   * turned into words. Pure, so the test reads it without a page. */
  function syncFoundLine(d, offer) {
    d = syncDiscoverShape(d);
    var n = d.studios.length;
    /* THE FOURTH SHAPE (G-PAIRMAIL, 14 Sep) -- and it is FIRST because it is
     * the only one where nothing has to be typed. An offer is a secret this
     * phone was handed out of band: out of the Drive folder both devices sign
     * in to (`library/drive.js::syncPairingOffer`) or out of a mail, through
     * the link (`lib.rs::parse_studio_link`). Discovery is then beside the
     * point -- the offer carries its own address. */
    if (offer && offer.secret) {
      return (offer.name || "A Studio") + " wants to pair \u00b7 via " +
        (offer.via === "mail" ? "your email" : "this Drive");
    }
    /* ONE TAP IS GONE (Osca, same day). It stood on the advert carrying `fp`,
     * which the phone walked back to the six digits in 74 ms -- so the advert
     * WAS the code. The Mac broadcasts a name and a version now, and a found
     * Studio is a found Studio: it still has to be unlocked. */
    if (n) return n + (n === 1 ? " Studio found" : " Studios found") + " \u00b7 type the code Studio's row shows";
    // NOT FOUND, and the two reasons are not the same reason. A REFUSAL has
    // a sentence and prints it. A browse that looked and saw nothing -- and a
    // page with no host at all, which is the Mac and every browser -- has
    // none, and gets the line this card has always drawn: nothing went wrong,
    // so nothing is explained.
    if (!d.allowed && d.why) return d.why;
    return "No Studio found on this network \u00b7 type the address and code Studio's row shows";
  }

  /* Which road paired, in the words the card says it in. Pure, so the test
   * reads it without a page -- and one function, so the three roads cannot
   * drift into three vocabularies. `road` is what `POST /sync/pair` answers
   * (`studio/sync.py::Pairing.road`): "offer" for a secret, "code" for the
   * ten digits. `via` is how the offer reached this phone. */
  /* The Mac's half of the same vocabulary: which road the live offer went
   * out by. Pure, and one place, for `syncPairedLine`'s reason. */
  function syncOfferSent(road) {
    if (road === "drive") return "Offer left in your Drive";
    if (road === "mail") return "Pairing link sent to your email";
    return "Pairing open · scan the square or type the code";
  }

  /* ======================= THE MAC'S TRANSFER ROW, IN SENTENCES (14 Sep)
   *
   * Osca's first screenshot of the wave-A build: the row was laid out ONE
   * WORD PER LINE beside the square, it said *"zeroconf is not installed"*,
   * and its three buttons -- Start again, Leave in Drive, Use -- explained
   * nothing. The layout is the sheet's (`.tr-dest` is a grid now, and the
   * sentence gets the width); these three functions are the words.
   *
   * ONE SENTENCE PER STATE, and the states are the three a person is ever in:
   * a link is out, a phone is paired, or neither. **A LIVE OFFER WINS OVER A
   * PAIRED PHONE**, which is the one place this departs from the order Osca
   * wrote the three states down in: the press that just happened is the thing
   * the person is waiting on an answer about, and a Mac that already has one
   * phone and is pairing a second would otherwise answer the press with a
   * sentence about the first phone -- which reads as "nothing happened".
   *
   * Pure, and no page: `settings/tests/test_transfer_row.py` reads all three
   * the way `syncFoundLine`'s test reads that one. `now` is passed in rather
   * than taken, so a minute count is a fixture and not a race. */
  function transferStateLine(s, now) {
    s = s || {};
    var o = s.offer && s.offer.expires > now ? s.offer : null;
    if (o) {
      var m = Math.max(0, Math.round((o.expires - now) / 60000));
      return syncOfferSent(o.road) + " \u00b7 " + m + (m === 1 ? " minute left" : " minutes left");
    }
    var n = s.paired || 0;
    if (n) return "Paired with " + n + (n === 1 ? " phone" : " phones");
    return "No phone paired yet";
  }

  /* THE ROAD THE NEXT PRESS WILL TAKE, before it is pressed (Osca, point 4).
   * Two roads, and which one it is depends on one fact this page already
   * holds: an account has an address to mail to, and no account has none.
   * The two faults that stop any road at all are said here instead, because
   * a road named while nothing can travel it is worse than no line. */
  function transferRoadLine(signed, s) {
    s = s || {};
    if (!s.port) return "Studio is not listening yet \u00b7 nothing can pair";
    if (s.depot === false) return "depot not found \u00b7 nothing can be merged";
    return signed ? "will pair by mail" : "will pair over this Wi-Fi";
  }

  /* WHERE THE CODE IS TYPED, shown with the code and nowhere else. It was in
   * the row's one sentence and is the reason that sentence was five facts. */
  function transferWhereLine(s) {
    s = s || {};
    var where = s.address && s.port ? s.address + ":" + s.port : (s.port ? "port " + s.port : "");
    return where ? "type these on the phone, with " + where : "type these on the phone";
  }

  function syncPairedLine(name, road, via) {
    var who = name || "Studio";
    if (road !== "offer") return "Paired with " + who + " \u00b7 by the code you typed";
    if (via === "mail") return "Paired with " + who + " \u00b7 from the mail, nothing typed";
    if (via === "drive") return "Paired with " + who + " \u00b7 through the Drive you share";
    return "Paired with " + who + " \u00b7 nothing typed";
  }

  function syncDiscover(host) {
    var none = { studios: [], allowed: false, why: null };
    if (!host || typeof host.syncDiscover !== "function") return Promise.resolve(none);
    var timer = new Promise(function (res) { global.setTimeout(function () { res(none); }, SYNC_DISCOVER_MS + 1500); });
    return Promise.race([Promise.resolve().then(function () { return host.syncDiscover(SYNC_DISCOVER_MS); }), timer])
      .then(syncDiscoverShape, function () { return none; });
  }
  function syncBaseOf(hostOrAddress, port) {
    var s = String(hostOrAddress || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!s) return null;
    if (port && s.indexOf(":") < 0) s += ":" + port;
    return "http://" + s;
  }
  /* ONE DOOR, TWO KEYS (G-PAIRMAIL, 14 Sep). `key` is either the ten digits
   * Studio's row shows or the 32-byte secret an offer carried; the digits are
   * stripped of anything that is not one, a secret is sent as it came. There
   * is no second route and no second token shape -- `studio/sync.py::
   * Pairing.pair` takes both and answers which one was used, so the card can
   * say the true sentence without inferring it from what it sent. */
  function syncPair(base, key, device, name) {
    var k = String(key || "");
    var digits = k.replace(/\D/g, "");
    var send = digits.length === k.length ? digits : k;
    return syncFetchJSON(base + SYNC.HELLO).then(function (h) {
      if (!h.ok) return { why: h.why };
      return syncFetchJSON(base + SYNC.PAIR, { code: send, device: device, name: name || "" })
        .then(function (r) {
          if (!r.ok) return { why: r.why };
          return { base: base, token: r.body.token, name: r.body.name || h.body.name || base,
                   road: r.body.road || null, paired: Date.now() };
        });
    });
  }

  /* THE OFFER THIS PHONE HAS BEEN HANDED, from either out-of-band road.
   * `ttstv.sync.offer` is written by the crate when a `frank-pair://studio`
   * link is opened (the mail's button, or the QR through the system camera --
   * `lib.rs::STUDIO_OFFER_KEY`) and by this page when a Drive sync brings one
   * back. One key, two writers, exactly like `transfer.pairing`.
   *
   * An expired offer is not an offer: it is dropped on read rather than drawn
   * and refused, because "this expired ten minutes ago" is a sentence about a
   * thing the person never saw. */
  var SYNC_OFFER_KEY = "ttstv.sync.offer";
  function syncOfferRead(now) {
    var o = syncRead(SYNC_OFFER_KEY);
    if (!o || typeof o.secret !== "string" || !o.secret) return null;
    if (o.expires && Number(o.expires) <= (now || Date.now())) { syncWrite(SYNC_OFFER_KEY, null); return null; }
    return o;
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
  var PULL_POLL_MS = 1000;                              // the app's pull, polled while it runs (G-SYNCBG)

  function driveModule() { return global.TTSTVDrive || null; }
  /* The app's pull (G-SYNCBG): `TTSTVHost.sync` on the phone, with drive.js
   * here to plan for it -- else null, and every press is the page's own. */
  function syncHostPull() {
    var h = global.TTSTVHost, D = driveModule();
    var s = h && h.sync;
    return s && typeof s.start === "function" && typeof s.status === "function"
      && D && typeof D.syncHandOff === "function" ? s : null;
  }
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
   * with Google · Skip — this device only."* The picture is
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
   * Two choices (W3 ACCOUNT, D5 — iCloud removed, D9 out of scope). Google
   * is the account, Drive is the depot. Skip is a real answer, not a
   * dismissal: the reader works entirely on this device, and the Sync row
   * reads "This device only" from then on. The Google button is live where a
   * client exists and inert with a sentence where it is not. */

  /* Pure: has first run been answered? By a choice recorded in the store,
   * or by a phone that paired -- a choice made with the network rather than
   * a button. `pair` is read from the same store; both are passed in so the
   * rule is testable without one. */
  function firstRunChosen(account, pair) {
    return !!account || !!(pair && pair.token);
  }

  /* Pure: may the first-run Google button be pressed, and what does it say when
   * it may not. The rule is "is there a client on THIS device" and it is asked
   * of the host, never of a URL. Returns null (live) or a sentence (inert). */
  function firstRunGoogleWhy(host, isStudio) {
    if (isStudio) return null;                       // the Mac: studio/google.py holds the ids
    var g = host && host.google;
    if (g && g.clientId && g.redirect && typeof host.googleSignIn === "function") return null;
    return "no Google client on this device yet \u2014 it is registered once, then this button works";
  }

  /* The Google press, for a page with no panel under it: the Library's gate.
   * Resolves {who} | {why}, never throws. Reused by the Transfer panel's own
   * `signIn()` so there is ONE Google press in the file. */
  function firstRunGoogle(o) {
    o = o || {};
    var host = o.host !== undefined ? o.host : global.TTSTVHost;
    var say = o.say || function () {};
    var isStudio = o.studio !== undefined ? !!o.studio : !!origin();
    if (isStudio) {
      /* POST /account/google, then poll GET /account -- the panel's own two calls.
       * The gate has no network context; use fetch through askUrl directly. */
      var base = askUrl("");
      if (!base) return Promise.resolve({ why: "no server to sign in through" });
      say("Opening Google in your browser\u2026");
      return global.fetch(base + ACCOUNT.GOOGLE, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (!r || !r.ok) return { why: (r && r.why) || "could not start the sign-in" };
          return new Promise(function (resolve) {
            function poll() {
              global.fetch(base + ACCOUNT.GET).then(function (r) { return r.json(); }).then(function (d) {
                if (!d) { resolve({ why: "lost the server" }); return; }
                var si = d.signin || {};
                if (si.live) { global.setTimeout(poll, ACCOUNT_POLL_MS); return; }
                if (si.phase === "done") {
                  say("Signed in as " + (si.who || (d.google && d.google.email) || ""));
                  resolve({ who: si.who || (d.google && d.google.email) || null });
                } else {
                  resolve({ why: si.error || "the sign-in did not finish" });
                }
              });
            }
            poll();
          });
        }).catch(function (e) { return { why: String((e && e.message) || e) }; });
    }
    return googleSignInPhone(host, { say: say });        // web + phone, one path
  }

  /* The card: a `set-head` and a `set-card tr-first` with the lead row and
   * the two rows (W3 ACCOUNT: iCloud removed, D9 out of scope). `onGoogle`
   * is the sign-in press, `onSkip` is Skip. Returns the two elements and
   * the buttons by name. */
  function buildFirstRunCard(doc, onSkip, onGoogle) {
    var host = global.TTSTVHost;
    var isStudio = host && host.isStudio;
    var googleWhy = firstRunGoogleWhy(host, isStudio);
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
    row("google", "Sign in with Google", "The account \u2014 and the first place to sync through.", "Sign in", true, onGoogle, googleWhy);
    row("device", "Skip \u2014 this device only", "Nothing leaves this device. You can sign in later, here.", "Skip", false, onSkip);
    return { head: head, card: card, buttons: buttons };
  }

  /* The one write a choice is. `kind` is the store's word ("device",
   * "google", "icloud"); the record is the shape the Transfer tab reads.
   * Returns the record whether or not the store took it -- the choice was
   * made either way; `firstRunWritten` says whether it LANDED. */
  function firstRunChoose(kind, who) {
    var account = { kind: kind, who: who || null, at: Date.now() };
    syncWrite(SYNC_ACCOUNT_KEY, account);
    return account;
  }

  /* Pure, given the store: did the choice land? Read back rather than
   * trusted -- `syncWrite` answers false on a store that throws, and a
   * store that swallows a write silently answers nothing at all. */
  function firstRunWritten(account) {
    var back = syncRead(SYNC_ACCOUNT_KEY);
    return !!(account && back && back.kind === account.kind && back.at === account.at);
  }

  /* The one sentence a failed write gets, in the page's own `#note` (the
   * Library has one; a page without one is told nothing, and the gate is
   * down regardless). Never a modal, never a second gate. */
  var FIRST_RUN_UNSAVED = "Your choice was not saved on this device, so this screen will ask again next time.";
  function firstRunNote(doc, text) {
    var el = doc && doc.getElementById ? doc.getElementById("note") : null;
    if (!el) return false;
    el.textContent = text;
    return true;
  }

  /* THE GATE. `firstRun(document)` is the Library's one line: if first run
   * has been answered it does nothing and returns null; otherwise it draws
   * the card full-window, over the page, as the body's first child, and
   * returns a handle. Skip takes the gate down and THEN records the choice
   * (Osca, 6 Sep: "SKIP IS DEAD ... syncWrite BEFORE handle.remove()") --
   * the Library under it was loading all along, so nothing is waited for,
   * and nothing a store can do -- throw, refuse, swallow -- can leave a
   * person behind a gate whose one live button did nothing. A write that
   * did not land is one sentence in the page's `#note`, and the gate will
   * ask again next time, which is the truth. A `ttstv:firstrun` event goes
   * out on the document with the record, for a page that wants to know. No
   * Escape and no scrim-click: the three rows are the ways out, and Skip is
   * the honest one.
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
    '  padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px 24px; box-sizing: border-box;',
    '}',
    '.ttstv-settings.fr-gate .fr-sheet { width: 100%; max-width: 560px; }',
    '/* D2: hide the phone bar while the first-run gate is up (pbar.js creates',
    '   the element after firstRun, so CSS is the only reliable path). */',
    '.fr-gate ~ .pbar { display: none !important; }',
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
    var handle = { el: gate, account: null, written: null };
    var onGoogle = function () {
      /* The Google press from the gate. On success: write the account, take
       * the gate down, and run one Drive sync (the "initial sync" D5 asks for). */
      var say = built.buttons.google.parentNode.parentNode.querySelector(".kag-why-here");
      built.buttons.google.disabled = true;
      firstRunGoogle({
        say: function (line) { if (say) say.textContent = line; },
      }).then(function (r) {
        if (r.why) {
          if (say) say.textContent = r.why;
          built.buttons.google.disabled = false;
          return;
        }
        handle.choose("google", r.who);
        /* One Drive sync after a successful sign-in (N-5: press only, not
         * periodic). `runDriveSync` is settings.js's own, loaded from drive.js. */
        var D = driveModule();
        if (D && D.runDriveSync) {
          var store = D.syncDefaultStore ? D.syncDefaultStore() : null;
          if (store) {
            var tok = D ? syncRead(D.GOOGLE_TOKEN_KEY) : null;
            if (tok && tok.refresh && tok.clientId) {
              D.runDriveSync({ kind: "drive", token: function (force) { return D.googleAccessToken(global.fetch, force); } }, {
                store: store, bundle: global.TTSTVBundle || null,
                href: global.location && global.location.href,
              });
            }
          }
        }
      });
    };
    var built = buildFirstRunCard(doc, function () { handle.choose("device"); }, onGoogle);
    sheet.appendChild(built.head); sheet.appendChild(built.card);
    gate.appendChild(sheet);
    handle.buttons = built.buttons;
    handle.choose = function (kind, who) {
      /* THE GATE COMES DOWN FIRST. The store is asked second, and the answer
       * is read back rather than believed. */
      try { handle.remove(); } catch (e) { /* a gate already gone is gone */ }
      handle.account = firstRunChoose(kind, who);
      handle.written = firstRunWritten(handle.account);
      if (!handle.written) firstRunNote(doc, FIRST_RUN_UNSAVED);
      try {
        if (doc.dispatchEvent && global.CustomEvent) {
          doc.dispatchEvent(new global.CustomEvent("ttstv:firstrun", { detail: handle.account }));
        }
      } catch (e) { /* a document that cannot dispatch is still a document */ }
      try { if (typeof opts.onChoose === "function") opts.onChoose(handle.account); }
      catch (e) { /* the page's own listener failing is the page's, not the gate's */ }
      return handle.account;
    };
    handle.remove = function () {
      if (gate.parentNode) gate.parentNode.removeChild(gate);
      /* D2: restore the phone bar when the gate comes down */
      var pb = doc.getElementById("pbar");
      if (pb) pb.style.display = "";
    };
    if (doc.body.firstChild) doc.body.insertBefore(gate, doc.body.firstChild);
    else doc.body.appendChild(gate);
    /* D2: hide the phone bar while the first-run gate is up */
    var pbarHide = doc.getElementById("pbar");
    if (pbarHide) pbarHide.style.display = "none";
    if (built.buttons.device.focus) { try { built.buttons.device.focus(); } catch (e) { /* no focus in a harness */ } }
    return handle;
  }

  function buildTransferPanel(panel, ctx, opts) {
    var doc = panel.ownerDocument;
    // the same override `mount` honours for `hasStudio`: a test, or the
    // design bench's `?phone`, says what is behind the page (6 Sep)
    var isStudio = (opts && opts.studio !== undefined) ? !!opts.studio : !!origin();
    var host = global.TTSTVHost;

    /* ---- First run: the card, lifted whole (`buildFirstRunCard`), drawn
     * until a choice is made -- here or at the Library's gate, which writes
     * the same key. Signing in later happens in the Account row. */
    var account = syncRead(SYNC_ACCOUNT_KEY);
    var firstBuilt = buildFirstRunCard(doc, function () {
      account = firstRunChoose("device");
      paint();
    }, function () {
      /* The Google press from the Transfer tab's card. Use `signIn()` -- the
       * panel's own function -- which has `ctx` and handles both the Studio
       * and phone/web paths already. */
      signIn().then(function () { paint(); });
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

    /* ---- Push when a job finishes (Osca, 12 Sep): *"when auto is ON,
     * Studio pushes after every finished job. When auto is OFF, the work
     * goes up on the next manual Sync -- of course."*
     *
     * ONE ROW, AND IT IS THE MAC'S. The value is studio's own
     * (`studio/settings.py`'s `sync.auto`, read back on `GET /sync` as
     * `auto`), the thing it switches runs on the Mac (`studio/tasks.py` ->
     * `studio/pending.py`), and the two routes behind it -- `GET /sync` and
     * `POST /settings` -- both 404 on the LAN door whatever the token
     * (`studio/serve.py::sync_path_allowed`). A phone drawing this row
     * would be a switch for a machine it cannot reach, so on a phone the
     * row is not on the card at all.
     *
     * OFF IS NOT "DO NOTHING": the chapter's two files are queued either
     * way and the next press of Sync sends them, which is what the
     * sub-line says rather than leaving a person to find out. */
    var autoRow = kEl(doc, "div", "set-row tr-autorow");
    var autoL = kEl(doc, "div", "set-l");
    autoL.appendChild(kEl(doc, "div", "set-name", "Push when a job finishes"));
    var autoWhy = kEl(doc, "small", "kag-why-here tr-autoline", "");
    autoL.appendChild(autoWhy);
    autoRow.appendChild(autoL);
    // NOT `.opts` -- the value is studio's, not the reader's, and mount()'s
    // painter must not walk it (the WHERE control's own comment, verbatim).
    var autoOpts = kEl(doc, "div", "set-c kag-opts set-seg");
    autoOpts.setAttribute("role", "group");
    var autoBtns = {};
    [["on", "On"], ["off", "Off"]].forEach(function (o) {
      var b = doc.createElement("button");
      b.type = "button"; b.dataset.auto = o[0];
      b.setAttribute("aria-pressed", "false");
      b.appendChild(kEl(doc, "span", "opt-main", o[1]));
      autoOpts.appendChild(b); autoBtns[o[0]] = b;
    });
    autoRow.appendChild(autoOpts);
    if (isStudio) card.appendChild(autoRow);

    /* Pure: the sub-line, from what studio answered. `null` is a studio that
     * has not answered yet -- never a claim in either direction. */
    function autoLine(auto) {
      if (auto == null) return "Studio has not said yet";
      return auto
        ? "A finished chapter's audio and timings go up at once \u00b7 the book itself only on a press"
        : "Queued \u00b7 the next press of Sync sends them";
    }

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
      return { row: r, l: rl, name: name, why: why, c: rc };
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
    /* THE ROAD, NAMED BEFORE THE PRESS (Osca, 14 Sep, point 4). A person
     * about to press a button is entitled to know what it will do, and the
     * answer here is not the same on two Macs: signed in to Google, the link
     * goes to that address; signed in to nothing, there is no address and the
     * only road is eyes on this screen. One short line, under the sentence,
     * and it is the same on the phone's half (which road brought the offer). */
    var lanRoad = kEl(doc, "small", "kag-why-here tr-road", "");
    lanRow.l.appendChild(lanRoad);
    var lanPick = pick("Use", "lan", false);
    var studioSel = null, addrIn = null, codeIn = null;
    /* START PAIRING, and the square (G-PAIRMAIL, 14 Sep). The Mac's half of
     * the three roads: one press mails the link to the account this Mac is
     * signed in to, or leaves it in the Drive both devices share, or -- with
     * no account anywhere -- simply mints the offer and draws it. The square
     * and the ten digits are ALWAYS available once an offer is live, because
     * road 2 is the one road that needs nothing but eyes.
     *
     * The QR is an `<svg>` (`studio/qr.py`), fetched as text and set as
     * markup: **no PNG enters this repo** (CLAUDE.md, Osca 5 Sep), and a
     * `<path>` in `currentColor` is right in light and dark with no second
     * drawing. */
    var startBtn = null, codeBtn = null, qrBox = null, openBox = null, whereEl = null;
    var showCode = false;
    if (isStudio) {
      /* TWO VERBS, AND A STRANGER CAN READ BOTH (Osca, 14 Sep, on the first
       * screenshot of the wave-A build: *"press a button, it sends you an
       * email, you press something in the email, done"*).
       *
       * `Start again` / `Leave in Drive` / `Use` were three buttons that
       * explained nothing: two of them named a mechanism (a road, a folder)
       * and the third named a noun. These name what happens when they are
       * pressed, and there are two because there are two things a person can
       * want here -- send it to the phone, or put it on the screen. */
      startBtn = doc.createElement("button");
      startBtn.type = "button";
      startBtn.className = "kag-btn tr-startpair kag-primary";
      startBtn.textContent = "Send pairing link";
      codeBtn = doc.createElement("button");
      codeBtn.type = "button";
      codeBtn.className = "kag-btn tr-showcode";
      codeBtn.textContent = "Show code";
      /* THE THIRD VERB IS NOT DRAWN, and that is deliberate. Osca named
       * *Forget this phone* as the third button; the Mac has no route that
       * un-pairs one (`studio/sync.py` holds the tokens and is another lane's
       * file today), so drawing it would be drawing a button that does
       * nothing. The phone's own half of the row carries it -- `lanPick`
       * below, whose verb is now those three words. The Mac's is a §6
       * Request in this lane's report, not a lie on the screen. */
      qrBox = kEl(doc, "div", "tr-qr");
      qrBox.hidden = true;
      /* THE CODE, AND WHERE TO TYPE IT, on a line of their own under the
       * sentence -- not jammed into the controls column, which is what took
       * the sentence's width away and laid it out one word per line. */
      openBox = kEl(doc, "div", "tr-open");
      whereEl = kEl(doc, "small", "kag-why-here tr-where", "");
      openBox.appendChild(codeEl);
      openBox.appendChild(whereEl);
      openBox.hidden = true;
      lanRow.c.appendChild(startBtn);
      lanRow.c.appendChild(codeBtn);
      lanRow.c.appendChild(lanPick);
      lanRow.row.appendChild(openBox);
      lanRow.row.appendChild(qrBox);
      lanPick.disabled = true;
    } else {
      studioSel = doc.createElement("select");
      // `tr-studio` so a test can ask whether the picker is drawn (14 Sep);
      // `set-menu` is the look and is unchanged.
      studioSel.className = "set-menu tr-studio"; studioSel.setAttribute("aria-label", "Studio"); studioSel.hidden = true;
      addrIn = doc.createElement("input");
      addrIn.type = "text"; addrIn.className = "kag-in tr-addr"; addrIn.placeholder = "192.168.1.5:41499";
      addrIn.setAttribute("aria-label", "Studio address"); addrIn.autocomplete = "off"; addrIn.hidden = true;
      codeIn = doc.createElement("input");
      codeIn.type = "text"; codeIn.className = "kag-in tr-codein"; codeIn.inputMode = "numeric";
      // ten digits and room for the two spaces the Mac prints them with, so a
      // code read off the row and typed back in as "278 949 1234" fits
      codeIn.maxLength = SYNC_CODE_DIGITS + 2;
      codeIn.placeholder = "code"; codeIn.setAttribute("aria-label", "Pairing code");
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
    /* CHECK -- and it is here because `transfer.pairing` had no reader on
     * any page that loads (the wiring audit's fourth row that writes to
     * nobody). `library/transfer.js` is the door's ONE client and was in
     * nobody's `<script src>`; `settings/settings.html` loads it now, and
     * this button is what reads what this card writes: `TTSTVTransfer.reach()`
     * -- `GET /` on the door, the one route that needs no bearer -- and it
     * prints the door's own `app`. WIRED, not removed: the card is where
     * G-BYOK's *Set up my phone* hands its address and pass, so deleting it
     * would delete the customer's half of the Modal door.
     *
     * AND IT PROVES NOTHING ABOUT THE PASS, which is `transfer.js`'s own
     * rule 1 said out loud on the page rather than only in its source: a
     * reachable door is not a paired one, and the first real route is the
     * only answer about the pass there is. */
    var pairCheckBtn = doc.createElement("button");
    pairCheckBtn.type = "button"; pairCheckBtn.className = "kag-btn tr-pair-check";
    pairCheckBtn.textContent = "Check";
    doorC.appendChild(pairUrlIn); doorC.appendChild(pairPassIn); doorC.appendChild(pairBtn); doorC.appendChild(pairForgetBtn); doorC.appendChild(pairCheckBtn);
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
      pairCheckBtn.hidden = !on;
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
    pairCheckBtn.addEventListener("click", function () {
      var T = global.TTSTVTransfer;
      if (!T || typeof T.reach !== "function") {
        say.textContent = "The door's client is not on this page.";
        return;
      }
      var rec = T.describe();
      if (!rec) { say.textContent = "Nothing paired to check."; return; }
      say.textContent = "Asking " + rec.url + "\u2026";
      pairCheckBtn.disabled = true;
      T.reach().then(function (d) {
        pairCheckBtn.disabled = false;
        var n = (d && d.routes && d.routes.length) || 0;
        say.textContent = (d && d.app)
          ? "Your door answers: " + d.app + " \u00b7 " + n + (n === 1 ? " route" : " routes")
            + ". The pass is not proved until a book goes through it."
          : "Something answered at " + rec.url + " but did not name itself \u2014 check the address.";
      }, function (e) {
        pairCheckBtn.disabled = false;
        say.textContent = "No answer from " + rec.url + ": " + String((e && e.message) || e) + ".";
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
    /* The last press's failure, in words, or null. It is the Sync row's own
     * line until the next press finishes (G-PULL, 11 Sep): a failure written
     * only into `say` -- the note at the foot of the whole tab, under "Your
     * door" -- was off-screen on a phone, and `paint()` then put
     * "Never synced" back on the line the progress had just been on. Osca
     * pressed four times and saw nothing. Memory only: a reload is a fresh
     * look, and `last` (the last GOOD sync) is never overwritten by a bad one. */
    var failed = null;
    /* The dead grant (B-phone, 26 Sep): true while the last refusal -- the
     * press's or the app's pull's -- was `invalid_grant`. Read by paint()
     * for the button and the line; cleared by a sign-in that succeeded. */
    function grantDead() {
      if (isStudio || !signedNow()) return false;
      if (syncNeedsSignIn(failed) || syncNeedsSignIn(pullSt && pullSt.why)) return true;
      // the mark drive.js left on the stored grant -- an earlier ask's
      // refusal (the app's pull on launch, the Languages tab's catalogue
      // ask), so the row says so on opening, before any press here
      var D = driveModule();
      var tok = D ? syncRead(D.GOOGLE_TOKEN_KEY) : null;
      return !!(tok && tok.revoked);
    }
    /* THE APP'S PULL (G-SYNCBG, 11 Sep). On the phone a press plans the books
     * and hands them to the app, which pulls them outside this page; the
     * row paints the app's status -- polled while it runs, whoever started
     * it (a press, or the app's own ask on opening and on return, which says
     * so with `ttstv:sync`). A reload of this page reads the same status
     * back. `pullHost` is null on the Mac and in a browser, and there the
     * row is exactly what it was. */
    var pullHost = isStudio ? null : syncHostPull();
    var pullSt = null;
    var watching = false;
    function watchPull(st) {
      if (!pullHost) return;
      if (st) { pullSt = st; paint(); }
      if (watching) return;
      watching = true;
      (function tick() {
        Promise.resolve().then(function () { return pullHost.status(); }).then(function (s2) {
          if (s2) pullSt = s2;
          paint();
          if (s2 && s2.running) global.setTimeout(tick, PULL_POLL_MS); else watching = false;
        }, function () { watching = false; });
      })();
    }
    var found = [], picking = false;
    /* The offer this phone has been handed, if any -- from the crate (a
     * `frank-pair://studio` link opened out of the mail or off the square) or
     * from the Drive press. `via` is which, and it is only ever a word for the
     * sentence: both end at the same `/sync/pair` with the same secret. */
    var offer = isStudio ? null : syncOfferRead();
    /* Google is built (26b): on the Mac the press is Studio's loopback
     * flow, on the phone the host's browser + this page's PKCE. A page with
     * neither (the PWA on the web, a file:// open) says so and stays inert. */
    var canGoogle = isStudio || !!(host && host.google && host.google.clientId && typeof host.googleSignIn === "function");
    var NO_GOOGLE_HERE = "no Google client on this device -- sign in is built into Frank and into Studio";

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

    /* "is there an account to mail from", asked in one place because three
       readers want it: the sentence, the road line and road 1b's fallback. */
    function signedNow() { var a = acctNow(); return !!(a && a.kind !== "device" && a.who); }

    function paintLine(text) { stateLine.textContent = text; }

    function paint() {
      // first run is over once any choice is recorded -- or once a phone has
      // paired, which is a choice made with the network rather than a button
      var a = acctNow();
      var chosen = firstRunChosen(a || account, pair);
      firstHead.hidden = chosen;
      first.hidden = chosen;
      var signed = signedNow();
      var dead = grantDead();
      who.textContent = signed ? syncWhoLine(a, null, false) : "Not signed in";
      who.classList.toggle("kag-on", signed && !dead);
      whoWhy.textContent = dead ? "Google · the saved sign-in expired or was revoked \u2014 sign in again"
        : signed ? "Google · the account every device signs in to"
        : syncWhoLine(null, pair, isStudio) + (canGoogle ? " · Google is the account" : " · " + NO_GOOGLE_HERE);
      acctBtn.textContent = dead ? "Sign in again" : signed ? "Sign out" : "Sign in with Google";
      acctBtn.dataset.state = dead ? "signin-again" : signed ? "signout" : "signin";
      acctBtn.classList.toggle("danger", signed && !dead);
      acctBtn.classList.toggle("kag-primary", !signed || dead);
      acctBtn.disabled = (!signed || dead) && !canGoogle;
      acctBtn.title = signed && !dead ? "" : canGoogle ? "" : NO_GOOGLE_HERE;
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
      if (!busy) paintLine(dead ? syncSignInAgainLine(a) : failed != null ? failed : (pullSt && pullSt.since ? syncPullLine(pullSt) : syncStateLine(last)));
      if (isStudio) {
        var s = studio || {};
        var on = !!s.port;
        lanRow.name.classList.toggle("kag-on", on);
        codeEl.textContent = syncCodeText(s.code);
        /* ONE SENTENCE, AND THE REST WHERE IT BELONGS (Osca, 14 Sep, point 2).
         * This line used to be five facts joined with dots -- the address, the
         * port, the phones, `zeroconf is not installed`, the depot -- inside a
         * label column the controls had squeezed to nothing, which is how a
         * sentence comes out one word per line. The address is with the code
         * it is typed beside; the venv's missing pin is `server.rs`'s to fix
         * and not a sentence to print; what is left is the state. */
        var nowMs = Date.now();
        lanRow.why.textContent = transferStateLine(s, nowMs);
        lanRoad.textContent = transferRoadLine(signed, s);
        var liveOffer = !!(s.offer && s.offer.expires > nowMs);
        startBtn.disabled = !on;
        codeBtn.disabled = !on;
        codeBtn.textContent = showCode || liveOffer ? "Hide code" : "Show code";
        codeBtn.setAttribute("aria-pressed", showCode || liveOffer ? "true" : "false");
        var open = on && (showCode || liveOffer);
        openBox.hidden = !open;
        whereEl.textContent = open ? transferWhereLine(s) : "";
        qrBox.hidden = !liveOffer;
        var lanUsed = on && !useDrive;
        lanPick.textContent = lanUsed ? "In use" : "Use";
        lanPick.classList.toggle("kag-primary", lanUsed);
        lanPick.setAttribute("aria-pressed", lanUsed ? "true" : "false");
        lanPick.disabled = !on || !signed;          // a way back to the LAN, only when Drive is the other choice
        var auto = typeof s.auto === "boolean" ? s.auto : null;
        autoWhy.textContent = autoLine(auto);
        autoBtns.on.setAttribute("aria-pressed", auto === true ? "true" : "false");
        autoBtns.off.setAttribute("aria-pressed", auto === false ? "true" : "false");
      } else {
        var paired = !!(pair && pair.token);
        lanRow.name.classList.toggle("kag-on", paired);
        lanRow.why.textContent = paired
          ? syncPairedLine(pair.name, pair.road, pair.via) + " · " + pair.base.replace(/^http:\/\//, "")
          : (offer ? syncFoundLine({ studios: [], allowed: true, why: null }, offer)
                   : "No Studio paired yet · press Sync to find one");
        lanPick.textContent = paired ? "Forget" : (offer ? "Pair" : "Use");
        lanPick.classList.toggle("kag-primary", !paired && !!offer);
        lanPick.setAttribute("aria-pressed", paired ? "true" : "false");
        lanPick.disabled = !paired && !offer && !picking && studioSel.hidden;
      }
    }

    /* the phone's picker, shown inside the row until the code lands */
    /* ================================ THE TWO STATES (G-DISCOVER, 14 Sep)
     *
     * Osca: *"present -> 'Found <Mac name> -- Pair'; absent -> the typed
     * card, unchanged"*, and **typed stays as the fallback forever**. So this
     * draws exactly three shapes and never a fourth:
     *
     *   FOUND              a Studio answered. The picker, and the TEN digits
     *                      its row is showing.
     *   NOT FOUND          the address field and the code. UNCHANGED, and the
     *                      only difference is the sentence above it, which now
     *                      says whether we looked and saw nothing or were not
     *                      allowed to look at all (`syncDiscover`).
     *
     * THE ONE-TAP SHAPE IS GONE (Osca, 14 Sep, later the same day). It existed
     * because the Mac's advert carried `fp` and this phone walked it back to
     * the six digits in 74 ms -- which is to say the advert was the code. The
     * roads that need nothing typed are the two that do not go over the Wi-Fi
     * at all: the mail and the shared Drive, both of which arrive as an
     * `offer` and are drawn on the row itself, not in this picker.
     *
     * `d` is `syncDiscover`'s shape. A bare array is still accepted there for
     * an older Frank, so this function never sees one. */
    function showPicker(d) {
      d = syncDiscoverShape(d);
      found = d.studios;
      // THE PICKER IS OPEN, said out loud. It used to be inferred from the
      // code field being visible (`!codeIn.hidden`), which was true for as
      // long as the only way to pair was to type six digits. The one tap
      // hides that field -- there is nothing to type -- so the inference
      // became "the picker is shut" and the press fell through to Forget and
      // did nothing at all. A state a button depends on is a variable.
      picking = true;
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
      lanRow.why.textContent = syncFoundLine(d, offer);
      try { (found.length ? codeIn : addrIn).focus(); } catch (e) {}
    }
    function hidePicker() {
      picking = false;
      studioSel.hidden = true; addrIn.hidden = true; codeIn.hidden = true;
    }

    function pairFromPicker() {
      var base, code, via = null;
      /* THE OFFER, AND IT COMES FIRST. A secret handed to this phone out of
       * band -- out of the mail, off the square through the system camera, or
       * out of the Drive folder both devices sign in to. Nothing was typed and
       * nothing crossed the Wi-Fi, and it still goes to the same
       * `/sync/pair`, still refused in words if it is stale: a shortcut
       * through the one door and never a second one. */
      if (offer && offer.secret) {
        base = syncBaseOf(offer.host, offer.port);
        code = offer.secret;
        via = offer.via || "mail";
      } else if (!studioSel.hidden && found.length) {
        base = syncBaseOf(found[Number(studioSel.value) || 0].host, found[Number(studioSel.value) || 0].port);
      } else {
        base = syncBaseOf(addrIn.value);
      }
      if (!base) { say.textContent = "Which Studio? Type its address."; return Promise.resolve(null); }
      if (!code) {
        code = String(codeIn.value || "").replace(/\D/g, "");
        if (code.length !== SYNC_CODE_DIGITS) {
          say.textContent = "The code is ten digits.";
          return Promise.resolve(null);
        }
      }
      say.textContent = "Pairing…";
      return syncPair(base, code, syncDeviceId(), (host && host.deviceName) || "").then(function (p) {
        if (!p || p.why) { say.textContent = (p && p.why) || "could not pair"; return null; }
        p.via = via;
        pair = p;
        syncWrite(SYNC_PAIR_KEY, pair);
        // AN OFFER IS SPENT. The Mac drops the secret the moment it is used;
        // this drops its copy, so a key is not left lying in `localStorage`
        // or in a shared folder. A trash that fails is not a failed pairing.
        if (offer) {
          syncWrite(SYNC_OFFER_KEY, null);
          if (offer.via === "drive" && global.TTSTVDrive) syncClearDriveOffer();
          offer = null;
        }
        // THE REVERSE (14 Sep): now that this phone is paired, say so on the
        // LAN so a Mac can push to it without going round by Drive
        // (`studio/sync.py::find_phones`). Only the name and the code's PUBLIC
        // half travel -- never the token. Best effort: a phone that cannot
        // advertise is still perfectly paired.
        if (host && typeof host.syncAdvertise === "function") {
          try {
            // NO `fp` (14 Sep). It was the fingerprint of the code this phone
            // paired with, which is the Mac's own mistake in miniature: a
            // phone broadcasting it is broadcasting the code. The device id
            // is a NAME -- it opens nothing, and it is what the Mac matches
            // (`studio/sync.py::find_phones`).
            host.syncAdvertise({ name: host.deviceName || "", device: syncDeviceId() });
          } catch (e) {}
        }
        hidePicker();
        say.textContent = syncPairedLine(p.name, p.road, via);
        paint();
        return p;
      });
    }

    /* Road 1b's last step: the offer file out of the shared folder, once it
     * has been spent. Best effort and silent -- the secret is already dead on
     * the Mac, so a file left behind is litter and not a key. */
    function syncClearDriveOffer() {
      try {
        var D = global.TTSTVDrive;
        if (!D || typeof D.driveClient !== "function") return;
        var drive = D.driveClient(googleAccessToken, global.fetch);
        var folder = D.driveFolder(drive);
        folder.open().then(function () { return D.syncClearPairingOffer(folder); }).catch(function () {});
      } catch (e) { /* a page without the adapter simply leaves it */ }
    }

    /* ROAD 1b ARRIVING, and it is its own function because it is the seam:
     * the Drive press reads `Frank/pairing.json` on the sync that was going to
     * run anyway (`library/drive.js::syncPairingOffer`), so an offer the Mac
     * left costs this phone no extra round trip and no extra press. Nothing is
     * paired here -- the card draws the fourth shape and the person presses
     * Pair; an offer is an offer until somebody takes it. Returned on the
     * panel's handle beside `press`, which is what
     * `settings/tests/test_pairing_roads.py` presses. */
    function takeOffer(res) {
      if (isStudio || !res || !res.offer || !res.offer.secret) return null;
      if (pair && pair.token) return null;
      offer = { secret: res.offer.secret, host: res.offer.host, port: res.offer.port,
                name: res.offer.name, expires: res.offer.expires, via: "drive" };
      syncWrite(SYNC_OFFER_KEY, offer);
      paint();
      return offer;
    }

    function finish(res) {
      busy = false;
      syncBtn.disabled = false;
      if (res.ok) {
        last = { at: Date.now(), books: res.books, marks: res.marks };
        if (isStudio) last.books = (studio && studio.books) != null ? studio.books : last.books;
        syncWrite(SYNC_LAST_KEY, last);
        failed = null;
        say.textContent = res.pulled ? "Pulled " + res.pulled + (res.pulled === 1 ? " book" : " books") : "";
      } else {
        // on the row's own line, where the progress was -- never an empty
        // line -- and not in `say`, which a phone cannot see (G-PULL)
        failed = String(res.why || "") || "Sync failed";
        say.textContent = "";
      }
      /* ROAD 1b ARRIVING. The Drive press reads `Frank/pairing.json` on the
       * sync that was going to run anyway (`library/drive.js::
       * syncPairingOffer`), so an offer the Mac left costs this phone no
       * extra round trip and no extra press. Nothing is paired here: the card
       * draws the fourth shape and the person presses Pair. */
      takeOffer(res);
      if (res.ok && res.handed != null) {
        // the books are the app's now: the row follows its pull
        var refused = res.refused || [];
        if (refused.length) say.textContent = refused.length + (refused.length === 1 ? " book" : " books") + " not taken: " + refused[0].why;
        watchPull(res.status);
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
          pull: pullHost,
        }).then(finishDrive).then(finish);
      }
      var remote = syncRemote(origin(), pair);
      if (!remote) {
        // the first press on a phone: find a Studio, right here in the row
        say.textContent = "Looking for Studio on this network…";
        return syncDiscover(host).then(function (d) {
          showPicker(d);
          say.textContent = "";
        });
      }
      busy = true;
      syncBtn.disabled = true;
      return runSync(remote, {
        say: paintLine, bundle: global.TTSTVBundle || null,
        href: global.location && global.location.href, pull: pullHost,
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
      var again = grantDead();
      return googleSignInPhone(host, { say: function (l) { say.textContent = l; } }).then(function (r) {
        if (r.why) { say.textContent = r.why; }
        else {
          account = syncRead(SYNC_ACCOUNT_KEY); through = "gdrive"; syncWrite(SYNC_THROUGH_KEY, through); say.textContent = "Signed in as " + r.who;
          // the fresh grant replaced the dead one: the refusal it earned is over
          if (syncNeedsSignIn(failed)) failed = null;
          if (pullSt && syncNeedsSignIn(pullSt.why)) pullSt = null;
        }
        paint();
        // SIGN IN AGAIN, then Sync -- the press the dead grant refused
        if (again && !r.why) return press().then(function () { return r; });
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
    autoOpts.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("button[data-auto]") : null;
      if (!b || !isStudio) return;
      var want = b.dataset.auto === "on";
      if (studio && studio.auto === want) return;
      // paint the press at once, then let studio's answer be the truth --
      // a refused write must not leave the row claiming the new value
      studio = studio || {};
      studio.auto = want;
      paint();
      ctx.postJSON(SYNC.SETTINGS, { sync: { auto: want } }).then(function (r) {
        if (r && r.sync && typeof r.sync.auto === "boolean") studio.auto = r.sync.auto;
        say.textContent = studio.auto
          ? "Finished jobs go up as they finish."
          : "Finished jobs wait for the next Sync.";
        paint();
      }, function (err) {
        say.textContent = "Studio did not take that: " + String((err && err.message) || err) + ".";
        return ask().then(paint);
      });
    });
    acctBtn.addEventListener("click", function () {
      var a = acctNow();
      if (grantDead()) return signIn();          // Sign in again: the same flow, a fresh grant
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
      // AN OFFER IS A PRESS OF ITS OWN (G-PAIRMAIL): the row is not in the
      // picker -- there is nothing to pick and nothing to type -- so the
      // button is "Pair" and it takes the secret straight to the one door.
      if (offer || picking) { pairFromPicker().then(function (p) { if (p) press(); }); return; }
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

    /* ================================ START PAIRING (G-PAIRMAIL, 14 Sep)
     * The Mac's press. One button, and the road it takes is the best one
     * available rather than a choice the person has to understand:
     *
     *   signed in, mail allowed   -> road 1: one message to that address
     *   signed in, not allowed    -> one consent screen, then road 1
     *   not signed in             -> road 2: the offer, the square, the digits
     *
     * "Leave in Drive" is road 1b beside it, shown only when signed in,
     * because it is the road for a phone whose mail is not on it.
     *
     * THE OFFER IS MINTED WHATEVER HAPPENS on the two roads that mint one, so
     * a mail that could not be sent still leaves a square on the screen. That
     * is the point of having three. */
    function pairStart(road) {
      if (!isStudio || !startBtn) return Promise.resolve(null);
      startBtn.disabled = true;
      say.textContent = road === "drive" ? "Leaving the offer in Drive…" : "Starting…";
      return ctx.postJSON(SYNC.PAIR_START, { road: road }).then(function (r) {
        var d = (r && r.body) || {};
        if (r && r.ok === false && !d.road) { say.textContent = r.why || "could not start pairing"; return null; }
        if (d.needs === "mail-scope") {
          say.textContent = d.why || "";
          return d.can_signin ? pairScope() : signIn();
        }
        say.textContent = d.ok ? syncOfferSent(d.road) : (d.why || "");
        // a mail Google refused: the offer is live all the same, and Mail.app
        // is the road that needs no scope at all -- opened, not sent
        if (!d.ok && d.mailto && global.open) { try { global.open(d.mailto); } catch (e) {} }
        // ROAD 1b IS STILL HERE, as the fallback it always was rather than as
        // the button called "Leave in Drive", which named a folder and told a
        // stranger nothing. A mail that failed with no `mailto` to fall back
        // on, on a Mac that has the Drive both devices share: leave it there
        // and say so. One retry, never a loop -- `road` is "drive" by then.
        if (!d.ok && !d.mailto && road === "mail" && signedNow()) return pairStart("drive");
        return ask().then(paint).then(paintQR);
      }, function (e) {
        say.textContent = String((e && e.message) || e);
        return null;
      }).then(function (v) { startBtn.disabled = false; return v; });
    }

    /* The one consent screen road 1 needs -- `drive.file` again plus
     * `gmail.send`, with `include_granted_scopes` so Drive survives it. Polled
     * exactly like the ordinary sign-in, because it IS the ordinary sign-in
     * with one more box on it. */
    function pairScope() {
      say.textContent = "Opening Google in your browser…";
      return ctx.postJSON(SYNC.PAIR_SCOPE, {}).then(function (r) {
        if (!r.ok) { say.textContent = r.why || "could not ask Google"; return null; }
        return new Promise(function (resolve) {
          function poll() {
            ctx.getJSON(ACCOUNT.GET).then(function (d) {
              if (!d) { resolve(null); return; }
              studioAcct = d;
              var si = d.signin || {};
              if (si.live) { global.setTimeout(poll, ACCOUNT_POLL_MS); return; }
              paint();
              resolve(si.phase === "done" ? pairStart("mail") : null);
              if (si.phase !== "done") say.textContent = si.error || "";
            });
          }
          poll();
        });
      });
    }

    /* The square, fetched as TEXT and set as markup. It is an `<svg>` -- one
     * `<path>` in `currentColor` -- and it is built by `studio/qr.py`, which
     * exists because **no PNG enters this repo** and because a picture nobody
     * can read back is not proof of anything. 404 is the ordinary answer when
     * no offer is live, and it empties the box rather than saying anything. */
    function paintQR() {
      if (!isStudio || !qrBox) return null;
      if (qrBox.hidden) { qrBox.innerHTML = ""; return null; }
      return ctx.getText(SYNC.PAIR_QR).then(function (svg) {
        qrBox.innerHTML = svg && svg.indexOf("<svg") === 0 ? svg : "";
      }, function () { qrBox.innerHTML = ""; });
    }

    if (startBtn) startBtn.addEventListener("click", function () { pairStart("mail"); });
    /* SHOW CODE is road 2 and nothing is sent anywhere: the offer is minted
     * so the square has something to draw (`/sync/pair/qr` is 404 without
     * one), and the ten digits were on this Mac all along. A second press
     * puts it away; the offer stays live until it expires, because hiding a
     * square is not cancelling a pairing. */
    if (codeBtn) codeBtn.addEventListener("click", function () {
      var live = !!(studio && studio.offer && studio.offer.expires > Date.now());
      if (live || showCode) { showCode = false; studio = studio || {}; }
      else { showCode = true; }
      if (!live && showCode) { pairStart("code"); return; }
      paint(); paintQR();
    });

    /* THE MAIL'S BUTTON, ARRIVING (road 1). The crate writes the offer into
     * `ttstv.sync.offer` and fires this when a `frank-pair://studio` link is
     * opened -- out of the mail, or off the square through the phone's own
     * Camera. `PAIR_JS`'s `ttstv:pairing` is the shape this copies.
     *
     * **The press IS the pairing**: the person pressed a button in their own
     * mail, on their own phone, and there is nothing further to ask them. */
    if (!isStudio && typeof global.addEventListener === "function") {
      global.addEventListener("ttstv:studiooffer", function () {
        offer = syncOfferRead();
        if (!offer) return;
        offer.via = "mail";
        paint();
        pairFromPicker().then(function (p) { if (p) press(); });
      });
    }

    paint();
    ask().then(paint);
    if (pullHost) {
      watchPull();
      if (typeof global.addEventListener === "function") {
        global.addEventListener("ttstv:sync", function (e) { watchPull(e && e.detail); });
      }
    }
    // the dead grant, marked by an ask that was not this row's (the app's
    // pull on launch, the Languages tab's catalogue): repaint, so the row
    // offers Sign in again without waiting for a press here (B-phone, 26 Sep)
    if (!isStudio && typeof global.addEventListener === "function") {
      global.addEventListener("ttstv:grant", function () { paint(); });
    }

    return { ask: ask, paint: paint, press: press, signIn: signIn, signOut: signOut,
             takeOffer: takeOffer,
             get pull() { return pullSt; },
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
    '.ttstv-settings .set-row[data-field="gutter"] .set-l,',
    /* WARMTH WAS NEVER IN THIS LIST, and that is what the comment below
       predicted: measured in the bench on 7 September, its rail was **2 px**
       wide where Size's and Line's are 350, with all five ticks stacked
       inside those 2 px. It read as a gradient chip with a thumb on it. It
       measured the same 2 px on the Reading tab it has just left, so this is
       a defect the move UNCOVERED and did not cause -- said plainly because
       the brief that moved it said the row already worked. 90 px, with the
       other two, because "Warmth" is one short word and this card's ruler
       still wants to start where a ruler starts. */
    '.ttstv-settings .set-row[data-field="warmth"] .set-l,',
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
    '.ttstv-settings .set-row[data-field="gutter"] .set-c,',
    '.ttstv-settings .set-row[data-field="warmth"] .set-c,',
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
        var url = askUrl(path);
        if (!url || !global.fetch) return Promise.resolve(null);
        return global.fetch(url, { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      },
      postJSON: function (path, body) {
        var url = askUrl(path);
        if (!url || !global.fetch) return Promise.resolve({ ok: false, status: 0, why: "no studio behind this page" });
        return global.fetch(url, {
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
      /* One route answers something that is not JSON: `GET /sync/pair/qr`,
       * an `<svg>` (G-PAIRMAIL, 14 Sep). `""` for anything that is not a 200,
       * so a 404 -- the ordinary answer when no offer is live -- empties the
       * box instead of drawing a sentence nobody asked for. */
      getText: function (path) {
        var url = askUrl(path);
        if (!url || !global.fetch) return Promise.resolve("");
        return global.fetch(url, { cache: "no-store" })
          .then(function (r) { return r.ok ? r.text() : ""; })
          .catch(function () { return ""; });
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
      if (field === "gutter") return GUTTERS.map(function (n) {
        return { value: n, label: n === 0 ? "Default" : n + "%",
                 sub: n === DEFAULTS.gutter ? "7.5%" : "" };
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
      if (field === "gutter") return value === 0 ? "7.5%" : value + "%";
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
        /* THE DEVICE MENU IS GONE (G-SETTINGS2, 13 Sep), and with it the
         * only writer of `micDevice` -- the third of the four rows the
         * wiring audit found writing to nobody. Web Speech has no device
         * selection at all: `voiceui/asr.js` is a `SpeechRecognition`
         * wrapper, there is no `getUserMedia` anywhere in `voiceui/`, and no
         * code path has ever passed a `deviceId` to anything. So the menu
         * offered a choice that only its own Test button honoured, and a
         * choice nothing downstream obeys is worse than no choice.
         *
         * WHAT STAYS IS THE HALF THAT WORKS: the dot (the permission, in a
         * `title`) and Test, which opens the microphone once, prints what it
         * heard, and is the only door to the permission hands-free needs.
         * `micDevice` stays in `prefs.js` untouched, and `buildVoice`'s
         * `sel` is simply null -- `refreshDevices()` already returned early
         * on that, from the day it was written. */
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
      /* A CARD MAY CARRY A NOTE (7 Sep). `rowEl` has honoured `spec.note`
       * since the faces row, but only on that one control -- it returns
       * early -- so a sentence about a card had nowhere to be put and the
       * Voice group appended its own by hand. This is the same `.set-note`
       * in the same place, declared instead of built: the one sentence a
       * card needs and no single row owns. */
      if (card.note) out.push(kEl(doc, "div", "set-note", card.note));
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
    // module is: `opts.studio` overrides for a test; on "web" there is never
    // a Studio (W1 SHELL-WEB); otherwise `origin()` decides.
    var hasStudio = opts.studio === undefined ? (TTSTVHost.kind !== "web" && !!origin()) : !!opts.studio;
    var tabs = TABS.filter(function (t) { return !t.needsStudio || hasStudio; });
    /* THE PHONE'S OWN FOUR (Osca, 6 Sep, THE PHONE WHOLE: "Settings is one
     * column with the phone's own tabs (General, Reading, Sync, Voices --
     * Cloud GPU and Models fold under Sync/Voices)"). The JS half of
     * design/phone/settings.html's contract; settings.css carries the rest.
     * A phone is `isTouchOnly()` -- the same question the Voice group asks
     * (a coarse pointer and no hover) -- or `opts.phone`, the design bench's
     * word (`settings.html?phone`). The Mac's seven are untouched: this runs
     * on nothing that has a keyboard. */
    if (opts.phone || isTouchOnly()) {
      tabs = phoneTabs();
      // ...and every builder sees the one flag, so a card can leave out the
      // row that is the Mac's (the Kaggle card's "where a render runs")
      opts = Object.assign({}, opts, { phone: true });
    }
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
      box.appendChild(rowEl(VOICE_ROWS.assistantVoice));
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
        /* THE DEFAULT INPUT, and there is no other ask (G-SETTINGS2,
         * 13 Sep). With the menu gone `current.micDevice` is whatever an
         * older build of this page stored, and asking for a `deviceId`
         * `exact`ly matching a device this machine may not have is an
         * `OverconstrainedError` where `{audio:true}` would have opened the
         * microphone. Test proves the permission the recogniser needs; the
         * recogniser opens its own stream and never took a device. */
        return media.getUserMedia({ audio: true }).then(function (stream) {
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
    syncStateLine: syncStateLine, syncPullLine: syncPullLine, syncHostPull: syncHostPull, syncWhoLine: syncWhoLine, syncCodeText: syncCodeText,
    syncNeedsSignIn: syncNeedsSignIn, syncSignInAgainLine: syncSignInAgainLine,   // the dead grant (B-phone, 26 Sep)
    syncRemote: syncRemote, syncUrl: syncUrl, syncBaseOf: syncBaseOf, syncDeviceId: syncDeviceId,
    // where a studio ask GOES (G-SETTINGS2, 13 Sep): this origin, else the
    // paired door with the pass on it. Exported because it is pure and
    // because a test should be able to read the URL rather than a fetch.
    doorUrl: doorUrl, askUrl: askUrl,
    syncLocalMarginalia: syncLocalMarginalia, syncLocalPositions: syncLocalPositions,
    syncWriteMarginalia: syncWriteMarginalia, syncWritePositions: syncWritePositions,
    syncCountMarks: syncCountMarks, runSync: runSync, syncPair: syncPair, syncDiscover: syncDiscover,
    syncDiscoverShape: syncDiscoverShape, syncFoundLine: syncFoundLine,
    transferStateLine: transferStateLine, transferRoadLine: transferRoadLine,
    transferWhereLine: transferWhereLine,
    // G-PAIRMAIL (14 Sep): the three roads' own vocabulary, pure, so the test
    // reads the sentences without a page
    syncPairedLine: syncPairedLine, syncOfferSent: syncOfferSent,
    syncOfferRead: syncOfferRead, SYNC_CODE_DIGITS: SYNC_CODE_DIGITS,
    // first run (6 Sep): the rule, the card, the write and the gate
    firstRunChosen: firstRunChosen, firstRunGoogleWhy: firstRunGoogleWhy,
    firstRunGoogle: firstRunGoogle, buildFirstRunCard: buildFirstRunCard,
    firstRunChoose: firstRunChoose, firstRunWritten: firstRunWritten, firstRunNote: firstRunNote,
    FIRST_RUN_UNSAVED: FIRST_RUN_UNSAVED, firstRun: firstRun,
    // the door's pairing (23d): the key, the event, the record, the write
    TRANSFER_PAIR_KEY: TRANSFER_PAIR_KEY, TRANSFER_PAIR_EVENT: TRANSFER_PAIR_EVENT,
    pairFingerprint: pairFingerprint, pairRecord: pairRecord, pairUrlOf: pairUrlOf, pairLine: pairLine,
    pairRead: pairRead, pairWrite: pairWrite, pairForget: pairForget,
    NOT_BUILT_GOOGLE: null, // W3: removed (iCloud D9 out-of-scope; Google now live per host)
    // the account and Drive (26b): the page's half; the adapter is library/drive.js
    ACCOUNT: ACCOUNT, SYNC_THROUGH_KEY: SYNC_THROUGH_KEY, SYNC_DRIVE_LAST_KEY: SYNC_DRIVE_LAST_KEY, SYNC_SETTINGS_KEY: SYNC_SETTINGS_KEY,
    syncStore: syncStore, runDriveSync: runDriveSync, googleAccessToken: googleAccessToken,
    googleSignInPhone: googleSignInPhone, googleSignOutPhone: googleSignOutPhone,
    syncThrough: syncThrough, driveStateLine: driveStateLine, driveProgressLine: driveProgressLine,
    LANGUAGES: LANGUAGES,
    languageRows: languageRows, languageAnswer: languageAnswer,
    languageLine: languageLine, languageJob: languageJob, packDate: packDate,
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
