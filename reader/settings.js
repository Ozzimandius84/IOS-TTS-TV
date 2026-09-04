/* Reading settings -- the shared half of reader/settings.html and the
 * reader's own live application of them.  Loaded by both pages as a plain
 * script (no bundler, this repo's rule); everything hangs off
 * `window.TTSTVSettings`, and every page guards on its presence so an older
 * exported bundle that does not carry this file still reads.
 *
 * Three choices, and only three (PROMPTS/reader-app-fixes.md step 3):
 * the reading font's family, its size and its line height.  Nothing about a
 * book, nothing about a voice -- those live in books/<slug>/render.json and
 * in studio.  A place is left for `render.where` (studio-kaggle) on the page
 * itself, not here: that is studio's setting and studio owns its file.
 *
 * **Defaults are absent, not written.**  `apply()` *removes* a custom
 * property whose value is the default rather than setting it, so a reader
 * with untouched settings paints exactly the CSS reader.html already had --
 * including the two places where the phone's own values differ from the
 * desktop's (font-size 1.15rem vs 1.02rem, line-height 1.7 vs 1.75).  Size
 * is therefore a *multiplier* of whichever of those two the layout is
 * already using, not an absolute rem: one choice that is right on both
 * screens, which an absolute size cannot be.
 *
 * **Where it lives.**  `localStorage` is the store every page reads and
 * writes; it is per-origin, so the Library, the Settings page and every
 * Reader tab in the app share one copy.  It is mirrored to
 * `TTS_DATA/reader/settings.json` through studio so the Mac and the phone
 * share it too -- `GET`/`POST /reader-settings`, a route studio does not
 * have yet (reader/README.md, Requests to studio).  Until it does, `save()`
 * reports `mirrored: false` with studio's own words and the Settings page
 * says so in one line rather than drawing a saved-looking control.
 */
(function (global) {
  "use strict";

  // the fields whose value is a string rather than a number -- the form
  // reads every option out of a `data-value` attribute, which is text
  var TEXT_FIELDS = ["family", "uiFamily", "view", "theme", "sidebar"];
  /* The one kind of field this window had never had. Every control here is
   * made of `.opts button[data-value]`, and a `data-*` value is a STRING --
   * so a field's kind is what says how to read it back. `resume` is a
   * boolean because `DEFAULTS.resume` is one; `sidebar` is a word, so it
   * joins TEXT_FIELDS. `fieldValue` below is the one place that decides. */
  var BOOL_FIELDS = ["resume"];
  function fieldValue(field, raw) {
    if (BOOL_FIELDS.indexOf(field) >= 0) return raw === "true" || raw === true;
    if (TEXT_FIELDS.indexOf(field) >= 0) return raw;
    return Number(raw);
  }

  var KEY = "ttstv.reader.settings";
  var VERSION = 1;
  var CHANNEL = "ttstv-reader-settings";
  var ROUTE = "/reader-settings";

  /* The faces. Every one of them names real macOS/iOS faces first and ends in
   * a generic family, so nothing here depends on a downloaded font (this app
   * ships no font files, the shell is offline and the public IOS-TTS-TV repo
   * carries no asset it does not need).
   *
   * Three were added 31 Aug on Osca's ask -- "I want more fonts, especially
   * Times New Roman, Helvetica Neue and Baskerville" -- and they are the
   * three that carry a `probe`.
   *
   * **`probe` is what makes a face conditional.** The four original entries
   * are generic STACKS: something in each of them resolves on every device
   * this app runs on, so asking whether they are "there" is not a question.
   * The three new ones are single named faces, and a laptop without
   * Baskerville must not be offered Baskerville and then silently given
   * something else -- the reader would blame the app for a face they never
   * chose. So a face with a `probe` is offered only where
   * `document.fonts.check()` says the probe is present, and shown inert with
   * its reason where it is not (`facesNow()`).
   *
   * **And every stack falls back to the NEAREST thing, not to `serif`.**
   * Times falls to Liberation Serif and Nimbus Roman, which are
   * metric-compatible with it; Baskerville falls to Hoefler Text, the closest
   * transitional serif macOS has, before Times; Helvetica Neue falls to
   * Helvetica and then Nimbus Sans, its own metric twin. A device missing the
   * face lands somewhere close rather than somewhere arbitrary -- though on
   * that device the option is not offered at all, so the stack is the belt
   * under the braces. */
  var FAMILIES = [
    { id: "serif",  label: "Serif",  note: "Charter",        stack: '"Tiempos Text", Charter, "Iowan Old Style", "Source Serif 4", "Palatino Linotype", Georgia, serif' },
    { id: "times",  label: "Times",  note: "Times New Roman", probe: "Times New Roman",
      stack: '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", "Tinos", serif' },
    { id: "baskerville", label: "Baskerville", note: "Baskerville", probe: "Baskerville",
      stack: 'Baskerville, "Baskerville Old Face", "Libre Baskerville", "Hoefler Text", "Times New Roman", serif' },
    { id: "sans",   label: "Sans",   note: "Avenir Next",    stack: '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif' },
    { id: "helvetica", label: "Helvetica", note: "Helvetica Neue", probe: "Helvetica Neue",
      stack: '"Helvetica Neue", Helvetica, "Nimbus Sans", "Liberation Sans", Arial, sans-serif' },
    { id: "mono",   label: "Mono",   note: "SF Mono",        stack: '"SF Mono", "IBM Plex Mono", Menlo, Consolas, monospace' },
    { id: "system", label: "System", note: "San Francisco",  stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
  ];

  /* ------------------------------------------------------ IS IT ACTUALLY THERE
   * **Not `document.fonts.check()`, and this is worth writing down because it
   * is the obvious answer and it is wrong.** `check()` answers about the
   * FontFaceSet -- the faces a document has *declared* -- and a local system
   * font is not in it. Asked about one, every browser this app runs in
   * answers TRUE, whether or not the face exists: measured live in headless
   * Chromium, `document.fonts.check('12px "Baskerville"')` is true on a Linux
   * box that has no Baskerville at all. A gate built on it would never gate
   * anything, and the app would go on offering a face and quietly
   * substituting another -- the exact failure the gate exists to prevent,
   * with a test that looked like it passed.
   *
   * So the question is asked the way it can actually be answered: **measure
   * it.** A string is measured on a canvas in each of the three generic
   * families, then again in "<face>, <that generic>". If the face is present
   * the browser uses it and the width moves; if it is absent the browser
   * falls through to the same generic and the width is identical. Any one of
   * the three moving is a yes -- three baselines rather than one because a
   * face can happen to be metrically identical to a given generic.
   *
   * **What it costs at startup**: one 2d canvas that is never added to the
   * document, three baseline measurements and three more per probed face --
   * twelve `measureText` calls, once, cached in `FACE_OK` for the life of the
   * document. Nothing is fetched, nothing is painted, and it is synchronous,
   * so the form can be drawn from the answer rather than after it.
   *
   * A page with no canvas (the node harness, a browser that refuses one) is
   * told YES for everything rather than no: hiding three working faces on a
   * platform that cannot be asked is the worse failure, and a platform that
   * cannot be asked cannot be lied to either. */
  var FACE_OK = {};
  var faceCtx;
  var FACE_SAMPLE = "mmmmmmmmmmlliWWQ@1234567890";
  var FACE_GENERICS = ["serif", "sans-serif", "monospace"];
  function faceMeasure(stack) {
    faceCtx.font = '72px ' + stack;
    return faceCtx.measureText(FACE_SAMPLE).width;
  }
  function facePresent(name) {
    if (faceCtx === undefined) {
      try {
        var cv = global.document && global.document.createElement
          ? global.document.createElement("canvas") : null;
        faceCtx = (cv && cv.getContext) ? cv.getContext("2d") : null;
      } catch (e) { faceCtx = null; }
    }
    if (!faceCtx || typeof faceCtx.measureText !== "function") return true;
    for (var i = 0; i < FACE_GENERICS.length; i++) {
      var g = FACE_GENERICS[i];
      var base = faceMeasure(g);
      var with_ = faceMeasure('"' + name + '", ' + g);
      if (!isFinite(base) || !isFinite(with_)) return true;   // a stub canvas
      if (Math.abs(with_ - base) > 0.5) return true;
    }
    return false;
  }
  function faceAvailable(fam) {
    if (!fam || !fam.probe) return true;                 // a generic stack always resolves
    if (fam.id in FACE_OK) return FACE_OK[fam.id];
    var ok = true;
    try { ok = facePresent(fam.probe); } catch (e) { ok = true; }
    FACE_OK[fam.id] = ok;
    return ok;
  }

  /* The faces as this device can actually offer them: every entry, each with
   * `available` and, when it is not, the one sentence that says why. Nothing
   * is filtered out -- an absent face is drawn INERT with its reason, which is
   * this app's rule for a missing capability, rather than vanishing and
   * leaving a reader who has seen it on another Mac wondering. */
  function facesNow() {
    return FAMILIES.map(function (f) {
      var ok = faceAvailable(f);
      return { id: f.id, label: f.label, note: f.note, stack: f.stack,
               available: ok, why: ok ? null : "not installed on this device" };
    });
  }
  // Percentages of whatever size the layout is already using.
  var SIZES = [85, 92, 100, 115, 130, 150];
  // 0 = leave the layout's own line-height alone (1.75 desktop, 1.7 phone).
  var LINES = [
    { value: 0,    label: "Default" },
    { value: 1.45, label: "Tight" },
    { value: 1.6,  label: "Snug" },
    { value: 1.9,  label: "Roomy" },
    { value: 2.15, label: "Airy" }
  ];

  // The fourth control, added 30 Aug (PROMPTS/reader-one-word.md step 1).
  // A *view*, not a font: "page" is the reader as it has always been, and
  // "oneword" is the one-word stage -- one word held at a fixed pivot, with
  // its counterpart in the other language beneath it. It lives here for the
  // same reason the other three do: three homes (the Settings page and the
  // popovers in reader.html and library.html) and one store, so the choice
  // made on the Mac is the choice the phone reads.
  var VIEWS = [
    { value: "page",    label: "Page",     sub: "the whole chapter" },
    { value: "oneword", label: "One word", sub: "the eye never moves" }
  ];

  /* Three numbers the one-word stage owns, persisted here rather than in a
   * store of its own -- they are reading preferences in exactly the sense
   * the font is, and settings.js already mirrors to TTS_DATA so the Mac and
   * the phone share them. None of them is a form control: `wpm` is the up /
   * down arrows, `gap` is the drag on the lower rule (the difficulty dial,
   * step 5c) and `context` is the Context button. They are clamped, never
   * rejected, because they arrive from a gesture rather than a list.        */
  var WPM = { min: 80, max: 900, step: 25 };
  var GAP = { min: 0, max: 300 };

  /* ------------------------------------------- THE TWO GENERAL ROWS (§7)
   * `settings-design 86e5b20` §7 named both, and both were left out twice
   * because building either meant ADDING a setting, which that prompt's own
   * "Rules that bite" forbade. `reader-sweep` §4 lifts that: the picture
   * includes them, so they are built.
   *
   * **Where a book opens.** The reader has always resumed -- `rememberPosition`
   * writes the chapter and the word, `rememberedPosition` reads it, and there
   * was no off switch. `resume: false` is that switch, and it is a switch on
   * ONE thing: the position inside a book. Which book opens when the reader is
   * reached bare (`rememberedLast`) is not this row -- that is the app's own
   * "reopen what was open", and turning it off would leave the reader with
   * nothing to show at all.
   *
   * **The sidebar.** Its state lived in `readerSidebarHidden` /
   * `readerSidebarHiddenRight` in `localStorage`, per side and PER DEVICE.
   * That stays: this row is the INITIAL state, the one a device that has
   * never been told anything starts from, and the moment a reader toggles the
   * sidebar the per-side key wins on that device from then on. Two facts,
   * not one -- "how it should start" is a preference that travels, "how I
   * left it on this Mac" is not.                                            */
  var SIDEBARS = ["shown", "hidden"];

  /* ------------------------------------------------------------- the theme
   * Osca, 30 August: "The light/dark mode should be a universal button, and
   * persist through the entire application, and if I change it in one tab,
   * should change all other tabs. IS universal."
   *
   * So light/dark is a SETTING, in this file, beside the font -- not a page's
   * private `data-theme` attribute, which is what it had been: twelve
   * identical lines copied into reader.html, library.html and settings.html,
   * each writing the attribute on its own document, none of them storing
   * anything and none of them telling the others. Three copies of a value is
   * three values.
   *
   * THREE values, not two, and that is the load-bearing part. "system" is the
   * default and it is ABSENT from the document -- `themeAttrs` returns null,
   * the same "a default is not written" rule as the font -- so an untouched
   * reader carries no attribute and the page's own
   * `@media (prefers-color-scheme: dark)` block decides, which is how it
   * follows the Mac. Choosing light or dark is what pins it. A two-valued
   * theme cannot express "follow the system" and would have to guess one at
   * first paint, which is the flash this design exists to avoid.            */
  var THEMES = ["system", "light", "dark"];

  /* ------------------------------------------------ THE INTERFACE FONT
   * Osca, 30 Aug: "then like a general tab, in which UI font ... UI font,
   * across the board yes."
   *
   * TWO fonts, and the whole point of the General tab is that they are two:
   * the INTERFACE font is the shelf, the sidebar, the menus, the chrome and
   * this page itself; the READING font is the book's text and nothing else.
   * The reader can be Baskerville while the shelf stays a clean sans, or the
   * reverse. Neither ever leaks into the other, and the mechanism is what
   * guarantees it rather than a convention: `--read-family` is named
   * explicitly on `.paneReading`, `.ow-word`, `#owContext` and the Settings
   * preview, `--ui-font` on `body` -- two custom properties that no rule
   * reads for the other's job.
   *
   * `"system"` is the default and, like every other default in this file, it
   * is ABSENT: `cssVars` writes null for it, so an untouched app keeps each
   * page's own `--ui-font` stack exactly as it was.
   *
   * Per-book reading fonts are untouched by all of this: General's `family`
   * is what a book uses when it has no preference of its own.               */
  var DEFAULTS = { family: "serif", uiFamily: "system", size: 100, line: 0,
                   theme: "system", view: "page", wpm: 300, gap: 0, context: true,
                   /* THE TWO ROWS THE MOCK ALWAYS DREW (settings-design
                    * `86e5b20` §7, built here). Both were reported twice as
                    * "not a setting this app has" -- the reader always
                    * resumed, and the sidebar's state lived only in
                    * `readerSidebarHidden`, per side and per device. These
                    * are those two settings, and each is the DEFAULT that
                    * keeps today's behaviour: an untouched reader resumes and
                    * shows its sidebar exactly as it did. */
                   resume: true, sidebar: "shown",
                   /* THE ONE FIELD THAT IS NOT A SCALAR (31 Aug, the Hotkeys
                    * tab). An OVERRIDE MAP, not the keyboard: `{}` means every
                    * action is on the key `HOTKEYS` gives it, which is why a
                    * settings file written before this existed needs no
                    * migration and why an untouched reader stores nothing new.
                    * See `normaliseKeys`, below the form. */
                   keys: {} };

  function familyById(id) {
    for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].id === id) return FAMILIES[i];
    return null;
  }

  /* Pure. Anything unknown falls back to the default for that one field --
   * a settings file half-written by a future version still reads. */
  function normalise(raw) {
    var s = (raw && typeof raw === "object") ? raw : {};
    var f = familyById(s.family) ? s.family : DEFAULTS.family;
    var uf = familyById(s.uiFamily) ? s.uiFamily : DEFAULTS.uiFamily;
    var size = Number(s.size);
    if (!isFinite(size) || SIZES.indexOf(size) < 0) size = DEFAULTS.size;
    var line = Number(s.line);
    var known = false;
    for (var i = 0; i < LINES.length; i++) if (LINES[i].value === line) known = true;
    if (!known) line = DEFAULTS.line;
    var view = DEFAULTS.view;
    for (var j = 0; j < VIEWS.length; j++) if (VIEWS[j].value === s.view) view = s.view;
    var theme = THEMES.indexOf(s.theme) >= 0 ? s.theme : DEFAULTS.theme;
    return { family: f, uiFamily: uf, size: size, line: line, view: view, theme: theme,
             wpm: clamp(s.wpm, WPM.min, WPM.max, DEFAULTS.wpm),
             gap: clamp(s.gap, GAP.min, GAP.max, DEFAULTS.gap),
             context: s.context === undefined ? DEFAULTS.context : !!s.context,
             resume: s.resume === undefined ? DEFAULTS.resume : !!s.resume,
             sidebar: SIDEBARS.indexOf(s.sidebar) >= 0 ? s.sidebar : DEFAULTS.sidebar,
             keys: normaliseKeys(s.keys) };
  }

  /* A number that arrived from a drag or an arrow key: clamped into range,
   * and only a value that is no number at all falls back to the default. */
  function clamp(raw, lo, hi, dflt) {
    var n = Number(raw);
    if (!isFinite(n)) return dflt;
    return Math.round(Math.max(lo, Math.min(hi, n)));
  }

  function isDefault(s) {
    s = normalise(s);
    return s.family === DEFAULTS.family && s.uiFamily === DEFAULTS.uiFamily
      && s.size === DEFAULTS.size && s.line === DEFAULTS.line
      && s.view === DEFAULTS.view && s.theme === DEFAULTS.theme && s.wpm === DEFAULTS.wpm
      && s.gap === DEFAULTS.gap && s.context === DEFAULTS.context
      && s.resume === DEFAULTS.resume && s.sidebar === DEFAULTS.sidebar;
  }

  /* Pure. The custom properties a settings object stands for: a value for
   * each field the reader has changed, and `null` for each it has not --
   * null means *remove the property*, which is how a default leaves the
   * page's own CSS untouched. */
  function cssVars(s) {
    s = normalise(s);
    var fam = familyById(s.family);
    var ui = familyById(s.uiFamily);
    return {
      "--read-family": s.family === DEFAULTS.family ? null : fam.stack,
      // The chrome, everywhere we draw it -- and NEVER the reading pane, which
      // names `--read-family` explicitly in every rule that sets its type.
      "--ui-font": s.uiFamily === DEFAULTS.uiFamily ? null : ui.stack,
      "--read-scale": s.size === DEFAULTS.size ? null : String(s.size / 100),
      "--read-line": s.line === DEFAULTS.line ? null : String(s.line)
    };
  }

  /* Pure, and the same "a default is absent" rule as `cssVars`: the view is
   * an ATTRIBUTE rather than a custom property, because a page reacts to it
   * with rules of its own (`html[data-read-view="oneword"] …`) rather than
   * by interpolating a value, and because `reader.html` has to be able to
   * ask what the view is without parsing a style declaration. `null` means
   * remove it, so a reader in the ordinary page view carries no attribute at
   * all and every selector that mentions one is inert. */
  function viewAttrs(s) {
    s = normalise(s);
    return { "data-read-view": s.view === DEFAULTS.view ? null : s.view };
  }

  /* Pure, and the same rule as `viewAttrs`: an attribute rather than a custom
   * property, because every page answers it with rules of its own
   * (`[data-theme="dark"] { ... }`), and `null` -- the default, "system" --
   * means remove it so the media query is left in charge. */
  function themeAttrs(s) {
    s = normalise(s);
    return { "data-theme": s.theme === DEFAULTS.theme ? null : s.theme };
  }

  function apply(s, root) {
    root = root || (global.document && global.document.documentElement);
    if (!root || !root.style) return normalise(s);
    var attrs = viewAttrs(s);
    var th = themeAttrs(s);
    for (var t in th) if (Object.prototype.hasOwnProperty.call(th, t)) attrs[t] = th[t];
    for (var a in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, a)) continue;
      // the fake root in reader/tests/test_settings.py has a style and no
      // DOM: a settings object still normalises there, it just paints nothing
      if (!root.setAttribute || !root.removeAttribute) continue;
      if (attrs[a] === null) root.removeAttribute(a);
      else root.setAttribute(a, attrs[a]);
    }
    var vars = cssVars(s);
    for (var name in vars) {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) continue;
      if (vars[name] === null) root.style.removeProperty(name);
      else root.style.setProperty(name, vars[name]);
    }
    return normalise(s);
  }

  // ------------------------------------------------------------- the store

  function read() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      if (!raw) return normalise(null);
      var d = JSON.parse(raw);
      return normalise(d && d.version === VERSION ? d.settings : d);
    } catch (e) { return normalise(null); }
  }

  function stamp(s) {
    return { version: VERSION, saved: Date.now(), settings: normalise(s) };
  }

  function writeLocal(s) {
    try { global.localStorage.setItem(KEY, JSON.stringify(stamp(s))); return true; }
    catch (e) { return false; }
  }

  /* Subscribers in THIS document. Neither of the cross-document signals comes
   * home: `storage` fires in the *other* documents of an origin and a
   * BroadcastChannel never delivers to the context that posted. So a theme
   * changed from the Mac's menu bar, or by a page that is not the one holding
   * the button, would have reached every other surface at once and its own a
   * second later, on the poll -- the one place where "without a reload" would
   * have been visibly untrue. `save` fans out here as well. */
  var localListeners = [];
  function fanout(settings) {
    for (var i = 0; i < localListeners.length; i++) {
      try { localListeners[i](settings); } catch (e) { /* one bad listener is not the others' problem */ }
    }
  }

  var channel = null;
  function bus() {
    if (channel !== null) return channel;
    try {
      channel = new global.BroadcastChannel(CHANNEL);
      // node 18+ has BroadcastChannel too, and an open one holds its event
      // loop open; the suite loads this file directly and would never exit.
      // `unref` is node's own word for it and no browser has it.
      if (channel && typeof channel.unref === "function") channel.unref();
    } catch (e) { channel = false; }
    return channel;
  }

  function origin() {
    // studio serves the repo over http(s); a bundle or file:// has no server
    // and no mirror -- localStorage is the whole story there.
    if (!global.location || !/^https?:$/.test(global.location.protocol)) return null;
    return global.location.origin;
  }

  /* Save: localStorage first (it is what every page reads), then tell the
   * other pages, then try the mirror. Resolves with what actually happened,
   * never rejects -- a missing route is a fact to print, not an error. */
  function save(s) {
    var settings = normalise(s);
    var local = writeLocal(settings);
    apply(settings);
    var b = bus();
    if (b) { try { b.postMessage({ settings: settings }); } catch (e) { /* closed */ } }
    fanout(settings);
    var url = origin();
    if (!url || !global.fetch) {
      return Promise.resolve({ settings: settings, local: local, mirrored: false,
                               why: "no studio behind this page" });
    }
    return global.fetch(url + ROUTE, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stamp(settings))
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { settings: settings, local: local, mirrored: res.ok,
                 why: res.ok ? null : (body && body.error) || ("HTTP " + res.status),
                 path: body && body.path };
      });
    }).catch(function (e) {
      return { settings: settings, local: local, mirrored: false, why: String(e && e.message || e) };
    });
  }

  /* The mirror, if studio has one. Resolves to null when it has not. */
  function fetchMirror() {
    var url = origin();
    if (!url || !global.fetch) return Promise.resolve(null);
    return global.fetch(url + ROUTE, { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (d) { return d ? { settings: normalise(d.settings || d), saved: Number(d.saved) || 0 } : null; })
      .catch(function () { return null; });
  }

  /* Live in every open Reader tab. Three ways in, because no one of them is
   * certain in every place this page runs:
   *   - `storage`, which fires in the *other* documents of an origin (a
   *     plain browser with two tabs open);
   *   - a BroadcastChannel, which the same-process webviews of the desktop
   *     app get even when `storage` is not delivered between them;
   *   - and a poll of localStorage itself, the one that cannot fail: two
   *     WKWebViews in the app share the store but need not share an event.
   * Cost of the poll: one localStorage read and a string compare a second.
   */
  function subscribe(fn, opts) {
    var everyMs = (opts && opts.everyMs) || 1000;
    var last = JSON.stringify(read());
    function offer(next) {
      var s = JSON.stringify(normalise(next));
      if (s === last) return;
      last = s;
      fn(JSON.parse(s));
    }
    if (global.addEventListener) {
      global.addEventListener("storage", function (e) {
        if (e && e.key && e.key !== KEY) return;
        offer(read());
      });
    }
    var b = bus();
    if (b) b.onmessage = function (e) { offer(e && e.data && e.data.settings); };
    localListeners.push(offer);
    var timer = global.setInterval(function () { offer(read()); }, everyMs);
    /* The poll is what keeps two WKWebViews of the app in step when neither
     * `storage` nor a BroadcastChannel is delivered between them, so it stays.
     * But this file is also loaded straight into node by
     * `reader/tests/test_settings.py` and friends, and since the at-load
     * subscription below exists, a live interval there means the test process
     * never exits and the suite hangs. `unref` is node's own word for "do not
     * hold the loop open"; no browser has it, so no browser is affected. */
    if (timer && typeof timer.unref === "function") timer.unref();
    return function stop() {
      global.clearInterval(timer);
      var i = localListeners.indexOf(offer);
      if (i >= 0) localListeners.splice(i, 1);
    };
  }

  /* What a reading page calls, once: paint what is stored and keep painting
   * whatever it becomes. */
  function live(root, onChange) {
    var current = apply(read(), root);
    if (onChange) onChange(current);
    subscribe(function (s) { current = apply(s, root); if (onChange) onChange(current); });
    return current;
  }

  /* Save a change to SOME fields, keeping whatever the others are now. The
   * form always has every field in hand; a gesture (a drag on the rule, an
   * arrow key on the rate) has one, and reading-modifying-writing it by hand
   * at each call site is how a stale copy overwrites a font chosen in
   * another tab a second ago. */
  function patch(partial) {
    var next = normalise(read());
    for (var k in partial) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) next[k] = partial[k];
    }
    return save(next);
  }

  /* --------------------------------------------------- the theme, in public
   *
   * One owner. Nothing outside this section reads the store for a theme and
   * nothing outside it writes `data-theme`; a page asks `themeNow()` what is
   * on screen, calls `toggleTheme()` to change it, and `onTheme()` to be told.
   * Cross-tab comes free, because it is `subscribe()` -- the `storage` event
   * in a plain browser with two tabs, the BroadcastChannel between the
   * desktop app's webviews, and the one-second read of localStorage that
   * cannot fail. No reload anywhere.                                        */
  var darkQuery;
  function systemDark() {
    if (darkQuery === undefined) {
      try { darkQuery = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null; }
      catch (e) { darkQuery = null; }
    }
    return !!(darkQuery && darkQuery.matches);
  }

  /* What is ON SCREEN. It resolves the stored value; it never reads
   * `data-theme` back, because that attribute is this module's own output and
   * a reader of it would be the second source of truth this whole section
   * exists to remove. */
  function themeNow(s) {
    var t = normalise(s || read()).theme;
    return t === "system" ? (systemDark() ? "dark" : "light") : t;
  }
  function setTheme(t) {
    return patch({ theme: THEMES.indexOf(t) >= 0 ? t : DEFAULTS.theme });
  }
  /* The button's meaning: give me the other one. It always writes an explicit
   * light or dark -- pressing a switch is a choice, and a person who has
   * pressed it wants that answer on every window, not the Mac's. */
  function toggleTheme() { return setTheme(themeNow() === "dark" ? "light" : "dark"); }

  /* Paint now, and again on every change -- another tab's write, or the Mac
   * flipping under a reader who has chosen neither. Returns the painter, so a
   * caller can re-run it. */
  function onTheme(fn) {
    var last = null;
    function offer() {
      var now = themeNow();
      if (now === last) return now;
      last = now;
      fn(now);
      return now;
    }
    offer();
    subscribe(function () { offer(); });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", offer);
    return offer;
  }

  /* The moon/sun button, mounted by every page that has one. The icon is the
   * DESTINATION, not the state: in the dark you are offered the sun. It was
   * three identical copies with three click handlers each writing its own
   * document's attribute, which is exactly why changing it in one tab changed
   * nothing anywhere else. Inline SVG on currentColor, never a glyph. */
  var THEME_ICON = {
    moon: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">'
      + '<path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a7.8 7.8 0 1 0 11.3 11.3Z" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">'
      + '<circle cx="12" cy="12" r="4.1" fill="currentColor"/>'
      + '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2'
      + 'M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"'
      + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };
  function mountThemeButton(btn) {
    if (!btn || !btn.addEventListener) return null;
    var paint = onTheme(function (now) {
      var dark = now === "dark";
      btn.innerHTML = dark ? THEME_ICON.sun : THEME_ICON.moon;
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.title = dark ? "Light mode" : "Dark mode";
    });
    btn.addEventListener("click", function () { toggleTheme(); });
    return paint;
  }

  /* --------------------------------------------- the interface font, in public
   *
   * The same shape as `onTheme`, and for the same reason: `studio.html` is a
   * surface of this application that reader/ does not own, so it consumes the
   * setting rather than restating it. One call, fired once with what is set
   * now and again on every change, cross-tab for free because it is
   * `subscribe()`.
   *
   * `uiFontNow()` returns the STACK to put on `--ui-font`, or null for the
   * default -- and null means "leave your own stack alone", which is what
   * keeps an untouched studio byte-identical to what it was.               */
  function uiFontNow(s) {
    var v = normalise(s || read());
    if (v.uiFamily === DEFAULTS.uiFamily) return null;
    var f = familyById(v.uiFamily);
    return f ? f.stack : null;
  }
  function setUIFont(id) {
    return patch({ uiFamily: familyById(id) ? id : DEFAULTS.uiFamily });
  }
  function onUIFont(fn) {
    var last = false;   // not null: null is a real value here (the default)
    function offer() {
      var now = uiFontNow();
      if (now === last) return now;
      last = now;
      fn(now);
      return now;
    }
    offer();
    subscribe(function () { offer(); });
    return offer;
  }
  /* Both at once, for a page that wants one line rather than two. The theme
   * and the interface font are the two things every surface of this app
   * shares; a caller that takes `onPrefs` cannot forget the second. */
  function onPrefs(fn) {
    var paintTheme = onTheme(function (t) { fn({ theme: t, uiFont: uiFontNow() }); });
    var paintFont = onUIFont(function (f) { fn({ theme: themeNow(), uiFont: f }); });
    return function () { paintTheme(); paintFont(); };
  }

  /* =========================================== NO BROWSER MENU IN THIS APP
   * Osca, 31 Aug: "Suppress the WebKit menu everywhere in the app's pages --
   * no page of ours should ever show Back/Reload/AutoFill."
   *
   * Back, Reload and AutoFill are a browser's menu, and this is not a
   * browser: there is nowhere to go back to, reloading is the app's own
   * business, and there is no form to fill. It is the page showing the thing
   * it happens to be built out of.
   *
   * It lives HERE rather than three times in three pages for the same reason
   * the theme does: every page of this app already loads this file in its
   * <head>, so one listener installed at load covers reader.html,
   * library.html, settings.html and anything opened later, and there is no
   * fourth copy to drift. A page's own `contextmenu` handler still runs
   * first and can still open OUR menu -- this one only decides what happens
   * when nothing else did.
   *
   * **Text fields keep their menu**, and that exemption is load-bearing
   * rather than a nicety: the Kaggle tab's username and key fields are typed
   * into, and taking Paste away from a field a person pastes a key into is a
   * worse bug than the one this closes. `input`, `textarea` and anything
   * contenteditable are the browser's, as they are in every native app. */
  function nativeMenuAllowed(t) {
    if (!t || !t.closest) return false;
    if (t.closest("input, textarea")) return true;
    return !!t.closest('[contenteditable=""], [contenteditable="true"]');
  }
  function suppressNativeMenu(doc) {
    if (!doc || !doc.addEventListener) return false;
    doc.addEventListener("contextmenu", function (e) {
      if (e.defaultPrevented) return;                 // a page of ours already answered
      if (nativeMenuAllowed(e.target)) return;
      e.preventDefault();
    });
    return true;
  }

  /* --------------------------------------------------- THE SCROLLBAR'S ONE
   * PIECE OF BEHAVIOUR (Osca, 1 Sep: "I don't even need to see it always;
   * just a slider down the side, no bar, or a very faint one").
   *
   * `reader/chrome.css` draws it and says what it is. The only thing a
   * stylesheet cannot do is know that a box is BEING scrolled, so that one
   * fact is here: `.sb-live` goes on the element that scrolled and comes off
   * `SB_LINGER` ms after the last scroll on it. Nothing else. There is no
   * measuring, no thumb of ours, no rAF loop -- the browser still draws and
   * still drags its own scrollbar; this only decides when it is visible.
   *
   * IT LIVES IN settings.js for the same reason `suppressNativeMenu` does:
   * it is chrome for every page of the application, and this is the file
   * every page already loads in its <head>. A second file would be a second
   * thing for a new page to forget.
   *
   * ONE CAPTURING LISTENER, NOT ONE PER SCROLLER. `scroll` does not bubble,
   * so a listener per box would mean finding the boxes -- and the boxes are
   * built and rebuilt by four pages all day. In the capture phase the
   * document sees every one of them, including scrollers that did not exist
   * when this ran.
   *
   * THE READING COLUMN HOLDS ITS THUMB LONGER. It is the book's position,
   * not a hint that a list overflows, so the eye is allowed to come back to
   * it. `SB_READING` is the selector for "this is a book's column", and the
   * slower fade that goes with the longer wait is chrome.css's.         */
  var SB_LINGER = 600;          /* ms after the last scroll, everywhere else */
  var SB_LINGER_READING = 1400; /* ms for a book's own column */
  var SB_READING = ".paneReading, #panes, #owStage";

  function liveScrollbars(doc, opts) {
    if (!doc || !doc.addEventListener) return false;
    var linger = (opts && opts.linger) || SB_LINGER;
    var lingerReading = (opts && opts.lingerReading) || SB_LINGER_READING;
    /* the timer is kept ON the element, so two boxes scrolling at once do
       not cancel each other's fade (the reader has three) */
    var timers = new WeakMap();
    doc.addEventListener("scroll", function (e) {
      var el = e.target;
      /* a document-level scroll reports the document; the box that shows a
         scrollbar for it is <html> */
      if (el === doc) el = doc.documentElement;
      if (!el || !el.classList) return;
      el.classList.add("sb-live");
      var t = timers.get(el);
      if (t) clearTimeout(t);
      var wait = linger;
      try { if (el.matches && el.matches(SB_READING)) wait = lingerReading; } catch (err) { /* no matches */ }
      timers.set(el, setTimeout(function () {
        el.classList.remove("sb-live");
        timers.delete(el);
      }, wait));
    }, true);
    return true;
  }

  /* ------------------------------------------------- the Settings WINDOW
   *
   * Osca, 30 August: "Settings -- hotkey 'Command + ,' should OPEN IN A NEW
   * WINDOW." That supersedes the 30 Aug decision that made Settings a popover
   * beside Actions (READER_FIRST.md). The distinction Osca is drawing is
   * dwell time: **you visit Actions and you work in Settings**, so a short
   * list of verbs stays a popover and a place you sit becomes a window.
   *
   * TWICE NEVER OPENS A SECOND. In the desktop app the host focuses the
   * window it already has; in a plain browser `window.open` with a NAME
   * returns the existing window of that name and re-focuses it rather than
   * making another -- which is the whole reason the name is a constant here
   * rather than a per-call string.
   *
   * The door is one function so that the reader, the Library and the Mac's
   * own menu item all open the same window; `open` and `toggle` are aliases
   * of it because desktop/src-tauri/src/settings.js (the ⌘, menu item) calls
   * those names and an app built before today must keep working.            */
  var WIN_NAME = "ttstv-settings";
  var WIN_KEY = "ttstv.reader.settingsWindow";
  var WIN_DEFAULT = { w: 560, h: 620, x: null, y: null };

  function windowGeom() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(WIN_KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (!d || typeof d !== "object") return null;
      var g = { w: Number(d.w), h: Number(d.h), x: Number(d.x), y: Number(d.y) };
      // a size is only believed inside sane bounds; a position is optional and
      // is dropped whole rather than half, so a window never lands off-screen
      // with one good coordinate
      if (!isFinite(g.w) || !isFinite(g.h) || g.w < 360 || g.h < 320) return null;
      if (!isFinite(g.x) || !isFinite(g.y) || g.x < 0 || g.y < 0) { g.x = null; g.y = null; }
      return g;
    } catch (e) { return null; }
  }
  function saveWindowGeom(g) {
    try { global.localStorage.setItem(WIN_KEY, JSON.stringify(g)); return true; }
    catch (e) { return false; }
  }

  /* ABSOLUTE, and this is the second time the reader has been bitten by
   * assuming otherwise. `settings.html` sits beside this file under `reader/`,
   * so a bare relative URL is right in a reader tab and wrong everywhere else:
   * studio's pages are served from the origin root, where "settings.html"
   * resolves to `/settings.html` and 404s -- studio was carrying a 302 shim
   * for exactly this, and studio's own render-in-app report asked for the
   * shim to go.
   *
   * The script's own `src` is the honest answer, because it says where
   * `reader/` actually is on THIS origin -- behind studio, in an exported
   * bundle, or over `file://`, where an absolute path would be the disk root.
   * `/reader/settings.html` is the fallback for a document that no longer has
   * a currentScript and no script tag this can recognise. */
  var SELF_SRC = (function () {
    try {
      var d = global.document;
      if (!d) return null;
      if (d.currentScript && d.currentScript.src) return d.currentScript.src;
      var tags = d.getElementsByTagName ? d.getElementsByTagName("script") : [];
      for (var i = tags.length - 1; i >= 0; i--) {
        var src = tags[i] && tags[i].src;
        if (src && /(^|\/)settings\.js(\?|$)/.test(src)) return src;
      }
    } catch (e) { /* no document, or none of it is there yet */ }
    return null;
  })();

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

  function settingsUrl() {
    if (SELF_SRC) {
      try { return new global.URL("settings.html", SELF_SRC).href; }
      catch (e) { return SELF_SRC.replace(/settings\.js(\?.*)?$/, "settings.html"); }
    }
    return "/reader/settings.html";
  }

  function openWindow() {
    var host = global.TTSTVHost;
    if (host && typeof host.openSettings === "function") { host.openSettings(); return "host"; }
    if (!global.open) return "no-window";
    var g = windowGeom() || WIN_DEFAULT;
    var feat = "width=" + Math.round(g.w) + ",height=" + Math.round(g.h)
      + (g.x !== null && g.y !== null ? ",left=" + Math.round(g.x) + ",top=" + Math.round(g.y) : "")
      + ",menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
    var w;
    try { w = global.open(settingsUrl(), WIN_NAME, feat); } catch (e) { w = null; }
    if (!w) return "blocked";
    try { w.focus(); } catch (e) { /* a cross-origin or closed handle */ }
    return "window";
  }

  /* Called once by the page INSIDE the window. Only that page can know where
   * the window ended up -- an opener is told nothing about a popup it made --
   * and the guard is the window's own name, so `settings.html` opened as an
   * ordinary tab records nothing. Closing it hands focus back to whoever
   * asked for it, which `window.close()` does not do on its own. */
  function rememberWindow() {
    if (!global.addEventListener || global.name !== WIN_NAME) return null;
    var timer = null;
    function save() {
      saveWindowGeom({
        w: global.outerWidth || WIN_DEFAULT.w, h: global.outerHeight || WIN_DEFAULT.h,
        x: global.screenX, y: global.screenY,
      });
    }
    global.addEventListener("resize", function () {
      if (timer) global.clearTimeout(timer);
      timer = global.setTimeout(save, 250);
    });
    global.addEventListener("pagehide", function () {
      save();
      try { if (global.opener && !global.opener.closed) global.opener.focus(); } catch (e) { /* gone */ }
    });
    save();
    return save;
  }

  /* ==================================================== THE HOTKEYS
   * Osca, 31 Aug, after the mock: a fifth tab listing **every keyboard
   * shortcut the app has**, one row each -- the action on the left, the key on
   * the right as a key-cap; click the cap, press a key, and that is the
   * binding.
   *
   * The table below is the AUDIT, not a wish list. Every entry is a handler
   * that exists in `reader.html`, `library.html` or `sidebar.js`, found by
   * reading all three; the four that did NOT exist before this step -- V, C,
   * D and the theme key, which Osca's list named and the mock draws -- were
   * bound in the same commit, because a row for a key that does nothing is
   * the one thing a Hotkeys tab must never contain.
   *
   * And the reason it is a table rather than a list of `e.key ===` tests
   * scattered through two pages: **every handler asks this module which
   * action a press is**, so a remap is live on the next keystroke and nothing
   * reloads. There is no second place a key is decided.
   *
   * ------------------------------------------------------------ the combo
   * A combo is a STRING, because it has to survive JSON, and it is built in
   * one place (`comboOf`) and compared in one place, so the two cannot drift.
   * The order is fixed -- `Mod+Alt+Shift+KEY` -- so one binding has exactly
   * one spelling and a collision is a string comparison.
   *
   * `Mod` is Cmd **or** Ctrl -- one cap, one stored spelling, so the tab can
   * print "⌘ F" and mean the key an iPad's Bluetooth keyboard has too ("a Mac
   * keyboard sends ⌘; an iPad's Ctrl+F is the same request and there is no ⌘
   * to press", the ⌘F handler, 30 Aug).
   *
   * `cmdOnly` is the exception, and it exists so this step CHANGED NO
   * BEHAVIOUR. Three bindings were written platform-specific -- ⌘→ / ⌘←,
   * ⌘⇧S, ⌘⇧M all tested `IS_MAC ? e.metaKey : e.ctrlKey` -- and on a Mac
   * Ctrl+→ is Mission Control's, not ours; `test_reader_page.py`'s "ctrl is
   * not cmd on a Mac" pins it. So those three carry `cmdOnly` and, on a Mac,
   * refuse a Ctrl press; everywhere else Ctrl IS the Mod key and they answer
   * to it. ⌘F, ⌘. and ⌘, were always both and stay both.
   *
   * Everything else matches EXACTLY, on all four modifiers: `Space` is Space
   * and not Shift+Space, so a key held with a modifier can be given to a
   * different action without the plain key answering first. (This is
   * stricter than the code it replaces, which tested `e.key === " "` and
   * fired on Shift+Space too.)                                            */
  var MOD = "Mod";
  var KEYNAME = {
    " ": "Space", "Spacebar": "Space", "Esc": "Escape",
    "Left": "ArrowLeft", "Right": "ArrowRight", "Up": "ArrowUp", "Down": "ArrowDown",
  };
  // A press that is only a modifier is not a binding; the capture field waits
  // for a real key rather than recording "⇧".
  var BARE_MODIFIER = { Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1,
                        AltGraph: 1, Dead: 1, Unidentified: 1, Process: 1 };

  var IS_MAC = (function () {
    try {
      var n = (global.navigator || {});
      return /Mac|iPhone|iPad|iPod/.test(n.platform || n.userAgent || "");
    } catch (e) { return false; }
  })();

  function keyToken(k) {
    if (k == null) return null;
    var name = Object.prototype.hasOwnProperty.call(KEYNAME, k) ? KEYNAME[k] : k;
    if (typeof name !== "string" || !name) return null;
    if (BARE_MODIFIER[name]) return null;
    // one printable character is stored upper-case, so "v" and "V" are one
    // binding and the cap reads the way the keyboard is engraved
    if (name.length === 1) return name.toUpperCase();
    return name;
  }

  /* Pure. A KeyboardEvent -- or any {key, metaKey, ctrlKey, altKey, shiftKey}
   * -- to its combo, or null when the press is only a modifier. */
  function comboOf(e) {
    if (!e) return null;
    var tok = keyToken(e.key);
    if (!tok) return null;
    var out = "";
    if (e.metaKey || e.ctrlKey) out += MOD + "+";
    if (e.altKey) out += "Alt+";
    if (e.shiftKey) out += "Shift+";
    return out + tok;
  }

  /* Pure. A string to the canonical combo it spells, or null. REBUILT rather
   * than trusted, so `Shift+Mod+f` and `puce` both answer honestly. */
  function validCombo(s) {
    if (typeof s !== "string" || !s) return null;
    var parts = s.split("+");
    var tok = keyToken(parts.pop());
    if (!tok) return null;
    var mod = false, alt = false, shift = false;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === MOD) mod = true;
      else if (parts[i] === "Alt") alt = true;
      else if (parts[i] === "Shift") shift = true;
      else return null;
    }
    return (mod ? MOD + "+" : "") + (alt ? "Alt+" : "") + (shift ? "Shift+" : "") + tok;
  }

  /* Pure. A combo to what the tab prints on the cap. The glyphs are the ones
   * a Mac keyboard is engraved with; anywhere else ⌘ is Ctrl, because a cap
   * showing a key the keyboard does not have is worse than no cap at all. */
  var GLYPH = {
    ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
    Tab: "⇥", Enter: "↩", Escape: "esc", Backspace: "⌫",
  };
  function keyCap(combo, mac) {
    if (!combo) return "";
    var isMac = mac === undefined ? IS_MAC : !!mac;
    var parts = String(combo).split("+");
    var tok = parts.pop();
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === MOD) out.push(isMac ? "⌘" : "Ctrl");
      else if (parts[i] === "Alt") out.push(isMac ? "⌥" : "Alt");
      else if (parts[i] === "Shift") out.push("⇧");
    }
    out.push(Object.prototype.hasOwnProperty.call(GLYPH, tok) ? GLYPH[tok] : tok);
    return out.join(" ");
  }

  /* --------------------------------------------------------------- the table
   * `group` is the mock's two headings. `defs` is one combo per CAP in the
   * row -- two where the action is a pair, which the picture draws as one row
   * with two caps and this treats as two independently remappable bindings.
   * `fixed` is a key this app does not own: listed because somebody looking
   * for it has to find it, and greyed because it cannot be changed here. */
  var HOTKEYS = [
    { id: "view", group: "reader", label: "One word ↔ normal view", defs: ["V"] },
    { id: "sync", group: "reader", label: "Sync / unsync two books",
      sub: "Only when two books are open", defs: ["C"] },
    { id: "play", group: "reader", label: "Play / pause", defs: ["Space"] },
    { id: "unit", group: "reader", label: "Next / previous chapter",
      defs: [MOD + "+ArrowRight", MOD + "+ArrowLeft"], cmdOnly: true },
    /* THE ARROWS MOVE THE HIGHLIGHT (Osca, 1 Sep): "arrows move the
     * highlight -- ← → a word, ↑ ↓ a line -- in the reader and in one-word
     * view, which loses its speed bindings from the arrows (Slower/Faster
     * stay as buttons and keep their own keys if any)."
     *
     * Two rows replace two: `sentence` (which stepped the audio a sentence
     * at a time, and one frame at a time in one-word) and `pace` (which was
     * the one-word speed). `pace` has no row at all now, because it has no
     * key: the two buttons on the stage are the whole control, and a row for
     * a key the page does not handle is the one thing this table must never
     * contain. A remap anybody had made of either id is dropped by
     * `normaliseKeys` on the next read, which is what it does with every id
     * it does not know. */
    { id: "word", group: "reader", label: "Move the highlight — next / previous word",
      sub: "On the page, and on the one-word stage", defs: ["ArrowRight", "ArrowLeft"] },
    { id: "line", group: "reader", label: "Move the highlight — next / previous line",
      sub: "The lines the page is set in; the one-word stage has none",
      defs: ["ArrowDown", "ArrowUp"] },
    { id: "note", group: "reader", label: "Write a note at the highlight",
      sub: "⏎ saves it, esc throws it away", defs: ["N"] },
    { id: "sidebar", group: "reader", label: "Contents sidebar",
      defs: [",", MOD + "+Shift+S"], cmdOnly: true },
    { id: "manual", group: "reader", label: "Chapter list stops following you",
      defs: [MOD + "+Shift+M"], cmdOnly: true },
    { id: "find", group: "reader", label: "Find in book", defs: [MOD + "+F"] },
    { id: "lookup", group: "reader", label: "Look up the word under the cursor",
      defs: ["D"] },
    /* THE TWO PANE KEYS ARE `\\` AND `z`, NOT Tab AND Shift+Tab (Osca,
     * 1 Sep). They were the only bindings in this app that took a key the
     * APPLICATION wants: Tab is how a person walks the tab strip, and a
     * reader that swallows it -- on every press, whenever two books are open
     * -- makes the nav unreachable from the keyboard on the one page a
     * reader spends all day in. So the pair moved off Tab entirely.
     * `reader.html` no longer answers to Tab in any branch, and there is no
     * row for Tab here, because a row for a key the page does not handle is
     * the one thing this table must never contain (see the note at the top).
     *
     * `\\` is the split itself, a line drawn between two columns: unshifted,
     * unclaimed by the browser, and no reach at all. `z` sits under the left
     * hand beside the bare letters this page already binds -- V, C, D -- and
     * cycling is a key you press three times, which wants to be an easy one.
     * NEITHER IS `fixed`: somebody who wants Tab back can take it here, and
     * the cap on the row is then the honest answer to "which key promotes".
     *
     * `z` is taken only with two books open -- with one the branch never
     * fires -- which is the "one book open: neither key does anything" half
     * of the decision. `sub` says the three states in the order the key gives
     * them, because a cap reading "Z" says nothing about what the third press
     * does. */
    { id: "swap", group: "reader", label: "Swap the voice, or the column",
      sub: "Synced it swaps which book speaks; split, which column has the focus",
      defs: ["\\"] },
    { id: "promote", group: "reader", label: "Promote the selected book",
      sub: "Two books — equal, then wide, then alone",
      defs: ["Z"] },
    { id: "close", group: "reader", label: "Close the panel, the find bar or the menu",
      defs: ["Escape"], fixed: "esc closes whatever is on top, on every page" },
    { id: "settings", group: "app", label: "Settings", defs: [MOD + "+,"] },
    { id: "actions", group: "app", label: "Actions", defs: [MOD + "+."] },
    /* L, and ⌘⇧L as well (Osca, 1 Sep: "L light/dark"). Two caps on one row,
     * the same shape the Contents row has had since 31 Aug: the bare letter
     * is the one you press while reading, and the Mod one is the one that
     * still works with the find box focused, because `reader.html` tests cap
     * 1 above its field guard and cap 0 below it. A bare L tested above the
     * guard would type nothing and toggle the theme every time somebody
     * spelled a word into Find. */
    { id: "theme", group: "app", label: "Light / dark", defs: ["L", MOD + "+Shift+L"],
      cmdOnly: true },
    /* S -- THE STUDIO SIDEBAR, and it is the HOST's panel, not this page's.
     * `TTSTVHost.studioToggle()` (desktop's §6 for this session). On a page
     * with no host -- a plain browser tab, the phone, an exported bundle --
     * the branch finds no host and does nothing at all; it does not fall back
     * to some other panel, because there is no studio there to open. */
    { id: "studio", group: "app", label: "Studio sidebar",
      sub: "In the application; nothing to open without it", defs: ["S"] },
    { id: "openBook", group: "app", label: "Open the selected book",
      sub: "In the Library", defs: ["Enter"],
      fixed: "Enter opens what is selected, on every page" },
    { id: "nextTab", group: "app", label: "Next tab",
      sub: "macOS — not changeable here", defs: [MOD + "+Tab"],
      fixed: "macOS owns this one" },
  ];
  var HOTKEY_GROUPS = [{ id: "reader", label: "Reader" },
                       { id: "app", label: "Application" }];

  /* ------------------------------------------------------ THE APP SECTION
   * Osca, 1 Sep: *"Settings ▸ Hotkeys gains an **App** section drawing
   * `TTSTVHost.hotkeys()` when the host offers it ... remaps stored in the
   * same `keys` map the rest of the tab uses; no host → no section, built to
   * the shape either way."*
   *
   * The host's own keys -- the window's, the tab strip's, the menu bar's --
   * are not this page's to invent, and they are not the same on a Mac as in
   * a browser tab. So the reader does not list them: it ASKS, and draws
   * whatever comes back. `TTSTVHost.hotkeys()` answers
   * `[{ id, label, keys, remappable }]` (desktop's §6 from the hotkeys
   * session). No host, a host with no `hotkeys`, or one that throws: no App
   * section at all, and every other section is exactly as it was. That is
   * the "built to the shape either way" half -- the code path exists on
   * every page, and on a page with no host it produces nothing.
   *
   * THE SAME STORE, THE SAME EVERYTHING. A host row is a row like any other
   * once it is registered: `normaliseKeys`, `hotkeysNow`, `hotkeyCollisions`
   * and the tab's painter all read `allHotkeys()`, so a host key can be
   * remapped, can be Reset, is included in `Reset all`, and reports a clash
   * with a reader key in the row the way two reader keys do. There is no
   * second store and no second painter.
   *
   * A host row whose id is already a reader action's is DROPPED rather than
   * shadowing it -- an id is the key into one store, and two rows writing one
   * entry is the one shape that could lose a person's remap. */
  var HOST_GROUP = { id: "host", label: "App" };
  var HOST_HOTKEYS = [];

  function hostHotkeyDefs(host) {
    var h = host;
    if (h === undefined) { try { h = global.TTSTVHost; } catch (e) { h = null; } }
    var list = null;
    try { list = (h && typeof h.hotkeys === "function") ? h.hotkeys() : null; } catch (e) { list = null; }
    if (!list || !list.length || typeof list.length !== "number") return [];
    var out = [], seen = {};
    for (var i = 0; i < list.length; i++) {
      var r = list[i] || {};
      var id = typeof r.id === "string" ? r.id : "";
      if (!id || seen[id]) continue;
      // never shadow a reader action: one id, one entry in `keys`
      var clash = false;
      for (var k = 0; k < HOTKEYS.length; k++) if (HOTKEYS[k].id === id) clash = true;
      if (clash) continue;
      var keys = [];
      if (typeof r.keys === "string") keys = [r.keys];
      else if (r.keys && typeof r.keys.length === "number") {
        for (var j = 0; j < r.keys.length; j++) if (typeof r.keys[j] === "string") keys.push(r.keys[j]);
      }
      if (!keys.length) continue;
      seen[id] = true;
      out.push({ id: id, group: HOST_GROUP.id, label: String(r.label || id), defs: keys,
                 host: true,
                 fixed: r.remappable === false ? "the application owns this one" : null });
    }
    return out;
  }

  /* Registered rather than fetched on every read: `normaliseKeys` runs on
   * every read of the store and must not call into the host each time. */
  function setHostHotkeys(list) {
    HOST_HOTKEYS = Array.isArray(list) ? list.slice() : [];
    return HOST_HOTKEYS;
  }
  function allHotkeys() {
    return HOST_HOTKEYS.length ? HOTKEYS.concat(HOST_HOTKEYS) : HOTKEYS;
  }

  function hotkeyById(id) {
    var all = allHotkeys();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* Pure. Whatever was stored to only the overrides that are real: a known
   * id, not a fixed one, as many caps as the action has, and every cap a
   * combo this module could have produced. Anything else drops THAT ID and
   * not the map -- `normalise`'s "one field falls back, not all of them"
   * rule, applied one row down. An override equal to the default is not an
   * override and is not kept, so the stored object stays empty until somebody
   * actually changes a key. */
  function normaliseKeys(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    var all = allHotkeys();
    for (var i = 0; i < all.length; i++) {
      var h = all[i];
      if (h.fixed) continue;
      var got = raw[h.id];
      if (!Array.isArray(got) || got.length !== h.defs.length) continue;
      var combos = [], ok = true;
      for (var j = 0; j < got.length; j++) {
        var c = validCombo(got[j]);
        if (!c) { ok = false; break; }
        combos.push(c);
      }
      if (!ok) continue;
      if (combos.join(" ") === h.defs.join(" ")) continue;
      out[h.id] = combos;
    }
    return out;
  }

  /* Pure. Every action, resolved: the override where there is one, the
   * default where there is not. */
  function hotkeysNow(s) {
    var keys = normalise(s === undefined ? read() : s).keys;
    var out = {};
    var all = allHotkeys();
    for (var i = 0; i < all.length; i++) {
      var h = all[i];
      out[h.id] = (keys[h.id] || h.defs).slice();
    }
    return out;
  }

  /* Pure. combo -> the ids that answer to it, for every combo more than one
   * id answers to. The tab prints this IN THE ROW. Nothing refuses a
   * collision: a person who wants one key to mean two things is allowed one,
   * they are told, and the page's own handler order still decides -- which is
   * a deterministic answer, not a crash. */
  function hotkeyCollisions(map) {
    var m = map || hotkeysNow();
    var owner = {}, out = {};
    var all = allHotkeys();
    for (var i = 0; i < all.length; i++) {
      var id = all[i].id;
      var combos = m[id] || [];
      for (var j = 0; j < combos.length; j++) {
        var c = combos[j];
        if (Object.prototype.hasOwnProperty.call(owner, c) && owner[c] !== id) {
          out[c] = out[c] || [owner[c]];
          if (out[c].indexOf(id) < 0) out[c].push(id);
        } else if (!Object.prototype.hasOwnProperty.call(owner, c)) owner[c] = id;
      }
    }
    return out;
  }

  /* WHAT EVERY HANDLER CALLS, in place of a hand-written `e.metaKey &&
   * e.key === "f"`. The condition is the one the tab shows, so a remap takes
   * effect on the next keystroke with nothing reloaded. `s` is optional and
   * is there for the tests; a page passes nothing and gets the store. */
  function hotkeyIs(e, id, s) {
    return hotkeyWhich(e, id, s) >= 0;
  }

  /* ...and WHICH CAP it was, for the rows that are a pair: 0 is the first
   * (next, faster, the plain comma), 1 the second. -1 when the press is not
   * this binding at all. */
  function hotkeyWhich(e, id, s) {
    var h = hotkeyById(id);
    if (!h || !e) return -1;
    var c = comboOf(e);
    if (!c) return -1;
    // see `cmdOnly` above: on a Mac these three want ⌘ and not Ctrl
    if (h.cmdOnly && IS_MAC && !e.metaKey && c.indexOf(MOD + "+") === 0) return -1;
    var combos = h.fixed ? h.defs : (hotkeysNow(s)[id] || h.defs);
    return combos.indexOf(c);
  }

  /* The reverse, for the capture field: which action already owns this press. */
  function hotkeyFor(e, s) {
    var c = comboOf(e);
    if (!c) return null;
    var map = hotkeysNow(s);
    for (var i = 0; i < HOTKEYS.length; i++) {
      var h = HOTKEYS[i];
      if (h.cmdOnly && IS_MAC && !e.metaKey && c.indexOf(MOD + "+") === 0) continue;
      var combos = h.fixed ? h.defs : (map[h.id] || h.defs);
      if (combos.indexOf(c) >= 0) return h.id;
    }
    return null;
  }

  /* Written through `patch`, which is the same localStorage write plus the
   * same `/reader-settings` mirror every other setting takes, fanned out to
   * every open page by the same subscription. There is NO hotkey store. */
  function setHotkey(id, index, combo) {
    var h = hotkeyById(id);
    var c = validCombo(combo);
    if (!h || h.fixed || !c || !(index >= 0 && index < h.defs.length)) {
      return Promise.resolve({ ok: false, local: false, mirrored: false,
                               why: "not a binding this app has" });
    }
    var keys = normalise(read()).keys;
    var all = {};
    for (var k in keys) if (Object.prototype.hasOwnProperty.call(keys, k)) all[k] = keys[k].slice();
    var next = (all[id] || h.defs).slice();
    next[index] = c;
    all[id] = next;
    return patch({ keys: all });
  }

  function resetHotkey(id) {
    var keys = normalise(read()).keys;
    var all = {};
    for (var k in keys) {
      if (k !== id && Object.prototype.hasOwnProperty.call(keys, k)) all[k] = keys[k].slice();
    }
    return patch({ keys: all });
  }

  function resetHotkeys() { return patch({ keys: {} }); }

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
  function buildHotkeysPanel(panel, ctx, opts) {
    var doc = panel.ownerDocument;
    opts = opts || {};
    var rows = {};      // id -> { caps: [button], note, reset }
    var arming = null;  // { id, index, btn } while a cap is waiting
    var wrap = kEl(doc, "div", "hk");
    panel.appendChild(wrap);

    /* Ask the host once, here, and register what it says before a single row
     * is drawn -- everything below (`hotkeysNow`, the collisions, the store's
     * own `normaliseKeys`) reads `allHotkeys()`, and a host row that arrived
     * after the first read would be pruned out of the store as an unknown id.
     * `opts.host` is the tests' door; a page passes nothing. */
    setHostHotkeys(hostHotkeyDefs(opts.host));
    var GROUPS = HOST_HOTKEYS.length ? HOTKEY_GROUPS.concat([HOST_GROUP]) : HOTKEY_GROUPS;
    var ROWS = allHotkeys();

    GROUPS.forEach(function (g) {
      var head = kEl(doc, "div", "set-head", g.label);
      var card = kEl(doc, "div", "set-card");
      var any = false;
      ROWS.forEach(function (h) {
        if (h.group !== g.id) return;
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
      if (!any) return;
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
    wrap.appendChild(foot);

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
   * that fills in the file the tool was already reading. `reader/` writes
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
    '}',
    '[data-theme="dark"] .ttstv-settings, [data-theme="dark"] .set-titlebar { --fg-faint: #6f6e73; }',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]) .ttstv-settings,',
    '  :root:not([data-theme="light"]) .set-titlebar { --fg-faint: #6f6e73; }',
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
    '.ttstv-settings .set-rail {',
    '  position: absolute; left: 0; right: 0; height: 4px; border-radius: 2px;',
    '  background: var(--control-bg); display: block;',
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
    // the name beside a slider is a fixed column in the picture, so the three
    // tracks start at one x rather than each at the end of its own word
    '.ttstv-settings .set-row[data-field="size"] .set-l,',
    '.ttstv-settings .set-row[data-field="line"] .set-l,',
    '.ttstv-settings .set-row[data-field="wpm"] .set-l { flex: 0 0 90px; }',
    // ...and the control half grows to take what the name gives up. `.set-c`
    // is `flex: 0 0 auto` for every other row, where the control is a fixed
    // thing on the right; a ruler is the one control that is a LENGTH.
    '.ttstv-settings .set-row[data-field="size"] .set-c,',
    '.ttstv-settings .set-row[data-field="line"] .set-c,',
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
    '.ttstv-settings .kag-btn, .ttstv-settings .lang-btn {',
    '  min-height: 0; padding: 5px 13px; border-radius: var(--s-ctl);',
    '  border: 1px solid var(--border); background: var(--panel-bg);',
    '  color: var(--fg); font: inherit; font-size: var(--s-ctl-text); cursor: pointer;',
    '}',
    // Connect is the picture\'s one filled button -- the accent, and white on it
    '.ttstv-settings .kag-btn.kag-primary {',
    '  background: var(--accent); border-color: var(--accent); color: #fff;',
    '}',
    '.ttstv-settings .kag-btn:hover:not([disabled]), .ttstv-settings .lang-btn:hover:not([disabled]) { border-color: var(--fg-dim); }',
    '.ttstv-settings .kag-btn[disabled], .ttstv-settings .lang-btn[disabled] { opacity: 0.45; cursor: default; }',
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
      if (field === "view") return VIEWS.map(function (v) {
        return { value: v.value, label: v.label, sub: v.sub };
      });
      // The two General rows: a segment each, and the label says the answer
      // rather than repeating the question -- the row's own name asks it.
      if (field === "resume") return [
        { value: true,  label: "Where you left off" },
        { value: false, label: "At the start" },
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
    function valueWord(field, value) {
      if (field === "size") return value + "%";
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
        var sel = doc.createElement("select");
        sel.className = "set-menu";
        sel.dataset.field = field;
        sel.setAttribute("aria-label", spec.label);
        optionsFor(field).forEach(function (o) {
          var op = doc.createElement("option");
          op.value = String(o.value);
          op.textContent = o.label + (o.disabled ? " — " + o.disabled : "");
          if (o.disabled) op.disabled = true;
          sel.appendChild(op);
        });
        right.appendChild(sel);
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
      // the window's own size, measured and sent -- `reportHeight` returns
      // the number it sent (0 with no host), `tabHeight` only measures
      tabHeight: function () { return tabHeight(el, doc); },
      reportHeight: function () { return reportHeight(el, doc); },
      get tabs() { return tabs.map(function (t) { return t.id; }); },
      get tab() { return open; },
      destroy: function () { if (stop) stop(); },
    };
  }

  global.TTSTVSettings = {
    KEY: KEY, VERSION: VERSION, ROUTE: ROUTE, CHANNEL: CHANNEL,
    FAMILIES: FAMILIES, SIZES: SIZES, LINES: LINES, VIEWS: VIEWS, THEMES: THEMES,
    SIDEBARS: SIDEBARS,
    TABS: TABS, TAB_KEY: TAB_KEY, KAGGLE: KAGGLE, MODAL: MODAL,
    LANGUAGES: LANGUAGES,
    languageRows: languageRows, languageAnswer: languageAnswer,
    languageLine: languageLine, languageJob: languageJob,
    faceAvailable: faceAvailable, facePresent: facePresent, facesNow: facesNow,
    kaggleLines: kaggleLines, modalLines: modalLines,
    // the two lines that say what each lane IS, exported for the one test
    // that asserts the page carries them rather than re-typing them
    KAGGLE_LANE_LINE: KAGGLE_LANE_LINE, MODAL_LANE_LINE: MODAL_LANE_LINE,
    MODAL_WHERE_LINE: MODAL_WHERE_LINE,
    MODELS: MODELS, modelRows: modelRows, bytesWord: bytesWord,
    WPM: WPM, GAP: GAP, DEFAULTS: DEFAULTS,
    // the hotkeys -- the table, the pure combo half, and the three verbs.
    // Every key handler in reader.html and library.html goes through
    // `hotkeyIs` / `hotkeyWhich`; nothing tests `e.key` on its own any more.
    HOTKEYS: HOTKEYS, HOTKEY_GROUPS: HOTKEY_GROUPS, MOD: MOD, IS_MAC: IS_MAC,
    // the App section: the host's own keys, asked for rather than listed
    HOST_GROUP: HOST_GROUP, hostHotkeyDefs: hostHotkeyDefs,
    setHostHotkeys: setHostHotkeys, allHotkeys: allHotkeys,
    comboOf: comboOf, validCombo: validCombo, keyCap: keyCap,
    hotkeyById: hotkeyById, normaliseKeys: normaliseKeys, hotkeysNow: hotkeysNow,
    hotkeyCollisions: hotkeyCollisions, hotkeyIs: hotkeyIs, hotkeyWhich: hotkeyWhich,
    hotkeyFor: hotkeyFor, setHotkey: setHotkey, resetHotkey: resetHotkey,
    resetHotkeys: resetHotkeys,
    familyById: familyById, normalise: normalise, isDefault: isDefault, clamp: clamp,
    cssVars: cssVars, viewAttrs: viewAttrs, themeAttrs: themeAttrs, apply: apply, mount: mount,
    // the Settings window's height follows the open tab (1 Sep)
    tabHeight: tabHeight, reportHeight: reportHeight,
    read: read, save: save, patch: patch, fetchMirror: fetchMirror,
    subscribe: subscribe, live: live,
    // the theme, in public -- one owner for the whole application
    themeNow: themeNow, setTheme: setTheme, toggleTheme: toggleTheme,
    onTheme: onTheme, mountThemeButton: mountThemeButton, THEME_ICON: THEME_ICON,
    // the interface font, in public -- studio consumes it the same way
    uiFontNow: uiFontNow, setUIFont: setUIFont, onUIFont: onUIFont, onPrefs: onPrefs,
    // no Back / Reload / AutoFill on any page of this app
    NO_INSTALL_LINE: NO_INSTALL_LINE, BYO_WEIGHTS_LINE: BYO_WEIGHTS_LINE,
    nativeMenuAllowed: nativeMenuAllowed, suppressNativeMenu: suppressNativeMenu,
    liveScrollbars: liveScrollbars, SB_LINGER: SB_LINGER, SB_LINGER_READING: SB_LINGER_READING,
    // the Settings window. `open` / `toggle` are aliases so the Mac menu
    // item's own settings.js, which knocks on those names, opens the window
    // without desktop/ having to be rebuilt first.
    WIN_NAME: WIN_NAME, WIN_KEY: WIN_KEY,
    openWindow: openWindow, open: openWindow, toggle: openWindow,
    windowGeom: windowGeom, rememberWindow: rememberWindow
  };

  /* -------------------------------------------------------------- at load
   *
   * Painted here, not by each page, and the reason is the flash. Every page
   * now loads this file in its <head>, synchronously, so this line runs
   * BEFORE the body is parsed and before the first paint: a window opened
   * after someone chose dark opens dark, rather than opening light and
   * correcting itself in a DOMContentLoaded handler. It is the same `apply`
   * a page would have called, one step earlier.
   *
   * Then, and only when this origin has never been written to, the mirror.
   * `studio serve` takes a new port on every launch, so the desktop app's
   * localStorage is a fresh, empty store each time and the theme chosen
   * yesterday would otherwise be gone; `TTS_DATA/reader/settings.json` is
   * where it actually lives. It cannot flash anyone who has chosen in THIS
   * launch, because a store with a record in it is never asked.             */
  try { apply(read()); } catch (e) { /* no document (the node harness) */ }
  /* AND AGAIN ON EVERY CHANGE, on every page that loads this file.
   *
   * `apply` at load was enough while the only live consumer was a Reader tab,
   * which calls `live()` itself. The interface font is "across the board"
   * (Osca, 30 Aug), so the Library, the Settings window and every later
   * surface have to follow it too -- and none of them had any reason to call
   * `live()`, because none of them draws a book. Measured in a real browser
   * before this line existed: a font chosen in the Settings window reached
   * the reader's chrome and left the Library's alone until it was reloaded.
   *
   * `apply` is idempotent and writes only what is not a default, so a page
   * that also calls `live()` simply applies the same values twice. */
  try { subscribe(function (s) { apply(s); }); } catch (e) { /* no store, no timers */ }
  try { suppressNativeMenu(global.document); } catch (e) { /* no document */ }
  try { liveScrollbars(global.document); } catch (e) { /* no document */ }
  try {
    var seen = global.localStorage && global.localStorage.getItem(KEY);
    if (!seen && origin()) {
      fetchMirror().then(function (m) {
        if (!m) return;
        if (global.localStorage && global.localStorage.getItem(KEY)) return;  // chosen meanwhile
        writeLocal(m.settings);
        apply(m.settings);
      });
    }
  } catch (e) { /* no storage, no fetch, nothing owed */ }
})(typeof window !== "undefined" ? window : globalThis);
