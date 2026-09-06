/* THE APPLICATION'S PREFERENCES -- the store every page of this app reads
 * before it paints, and the four things that hang off it: the theme, the
 * interface font, the hotkey grammar, and the door to the Settings window.
 *
 * A ROOT, and that is why it is here rather than in a crown. The plan's own
 * definition (`PROMPTS/module-split.md`, "deep roots, separate crowns") is a
 * library with more than one consumer and no page of its own, and this file
 * has four consumers plus the shell: `reader/reader.html`,
 * `library/library.html`, `settings/settings.html` and `studio/studio.html`
 * all load it in their <head> BEFORE FIRST PAINT, and `desktop/src/host.js`
 * and `desktop/src-tauri/src/tabs.rs` follow the theme it stores without
 * loading it at all. A crown reaching sideways into another crown for its
 * theme is the thing the split exists to end, so it lives in a folder of its
 * own -- `voiceui/` and `testkit/` are the precedents. Cut out of
 * `reader/settings.js` by module-split Stage 4, 5 Sep.
 *
 * **The one direction.** The Settings SURFACE's form -- the tabs, the fields,
 * the Cloud GPU / Models / Languages panels, the CSS, `mount` -- is
 * `settings/settings.js`, and it MOUNTS this file: it reads what it needs off
 * `window.TTSTVSettings` and adds its own half to the same object. Nothing
 * here knows the form exists, and nothing here may ever call into it.
 *
 * **The global keeps its name.** `window.TTSTVSettings` is what four pages,
 * the Mac's menu item and about a hundred asserts already say; renaming it is
 * a re-wire this step is not, and Stage 4 is a cut and nothing else.
 *
 * Three reading choices, and only three (PROMPTS/reader-app-fixes.md step 3):
 * the reading font's family, its size and its line height.  Nothing about a
 * book, nothing about a voice -- those live in books/<slug>/render.json and
 * in studio.
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
 * writes; it is per-origin, so the Library, the Settings window and every
 * Reader tab in the app share one copy.  It is mirrored to
 * `TTS_DATA/reader/settings.json` through studio so the Mac and the phone
 * share it too -- `GET`/`POST /reader-settings`.  The key, the channel and
 * the mirror's shape are unchanged by the cut: `desktop/` follows them by
 * name, and a rename here is a shell change, not a file move.
 */
(function (global) {
  "use strict";


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

  /* THE FIVE PAPERS. Warmth is one number and it moves ground and ink
   * TOGETHER -- paper and ink never drift apart in temperature, which is the
   * rule `reader/design/tokens.css` set when the bench first had a warmth
   * slider on it. Named, because "3" is not something anybody can ask for
   * back, and because these are the words for what they are. */
  var WARMTHS = [
    { value: 0, label: "Paper",  sub: "as it has always been" },
    { value: 1, label: "Ivory",  sub: "" },
    { value: 2, label: "Cream",  sub: "" },
    { value: 3, label: "Amber",  sub: "" },
    { value: 4, label: "Candle", sub: "warmest" }
  ];
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
   * the font is, and this store already mirrors to TTS_DATA so the Mac and
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

  /* ------------------------------------------- THE HANDS-FREE LAYER (5 Sep)
   * Osca, 5 Sep 21:15: *"we need to add mic settings and the touch-off
   * toggle."* `voiceui/` has had four user-facing facts and a row for none of
   * them -- the microphone, the trigger, how long the listening window stays
   * open, and pocket mode. They are stored HERE, beside the reading
   * preferences, for the reason every other field is: one store, one owner,
   * and the choice made on the Mac is the choice the phone reads.
   * `voiceui/app.js` reads them through `TTSTVSettings.read()` and never
   * through the settings page's DOM -- which is on the other side of a window
   * boundary anyway, so there is no DOM there to read.
   *
   * `micDevice` is a `deviceId` from `enumerateDevices()`, or "" for whatever
   * the system is using. "" is the default because a device id is NOT
   * portable: the same store is read on the phone, where that id names
   * nothing. An id this device does not have falls back at USE, not here -- a
   * Mac unplugged from its interface should get its choice back when the
   * interface comes back, and a value scrubbed on read could not do that.
   *
   * `listenWindow` is SECONDS, and a named list rather than a free number,
   * because every slider in that window is a set of discrete stops (`SIZES`,
   * `LINES`, `WARMTHS`) and a comb of thirty is not a slider. 2.5 is the
   * default because it is the one voiceui has actually been measured at --
   * 2517 ms on the real page (`voiceui/README.md`, 5 Sep).
   *
   * `touchOff` is pocket mode in the words Osca used for it: the screen goes
   * black, every touch is swallowed, the wake lock is held, and a 1.2 s hold
   * on the bottom-left corner is the way out. It is a STORED setting and not
   * only a button on the reader because it is the one thing about the
   * hands-free layer somebody would want set before the phone is in a pocket
   * and the screen is already black. `voiceui/app.js::createPocket` follows
   * it both ways -- it enters when this turns true, and it writes it back
   * false when the hold lets somebody out, so the toggle can never say
   * "on" over a screen that is not.                                         */
  var LISTEN_WINDOWS = [1.5, 2, 2.5, 3, 4, 5];

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
                   /* HOW WARM THE PAPER IS (Osca, 5 Sep). An INDEX into
                    * `WARMTHS`, not a colour and not a percentage: the five
                    * papers are named things a person chooses between, the
                    * way the reading faces are, and a number nobody can name
                    * is a number nobody can ask for back. 0 is the paper the
                    * reader has always had, so an untouched reader stores
                    * nothing new and looks like it always did. */
                   warmth: 0,
                   /* THE TWO ROWS THE MOCK ALWAYS DREW (settings-design
                    * `86e5b20` §7, built here). Both were reported twice as
                    * "not a setting this app has" -- the reader always
                    * resumed, and the sidebar's state lived only in
                    * `readerSidebarHidden`, per side and per device. These
                    * are those two settings, and each is the DEFAULT that
                    * keeps today's behaviour: an untouched reader resumes and
                    * shows its sidebar exactly as it did. */
                   resume: true, sidebar: "shown",
                   /* THE FOUR HANDS-FREE FIELDS (5 Sep, Settings > General >
                    * Voice). See the block above `LISTEN_WINDOWS` for what
                    * each one is; every default here is what voiceui already
                    * did before it had a row, so an untouched reader stores
                    * nothing new and behaves exactly as it did tonight. */
                   micDevice: "", listenWindow: 2.5, touchOff: false,
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
    // an index, and only one this build actually has -- a file written by a
    // later version with a sixth paper in it falls back to the first
    // seconds, and one of the stops the slider actually offers -- a window
    // typed into a settings file by hand is not a reason to listen for 40 s
    var lw = Number(s.listenWindow);
    if (LISTEN_WINDOWS.indexOf(lw) < 0) lw = DEFAULTS.listenWindow;
    var warmth = Number(s.warmth);
    if (!isFinite(warmth) || warmth < 0 || warmth >= WARMTHS.length
        || warmth !== Math.round(warmth)) warmth = DEFAULTS.warmth;
    return { family: f, uiFamily: uf, size: size, line: line, view: view, theme: theme,
             warmth: warmth,
             // the hands-free four. `micDevice` is kept verbatim even when
             // this device has no such input: see the block above.
             micDevice: typeof s.micDevice === "string" ? s.micDevice : DEFAULTS.micDevice,
             listenWindow: lw,
             touchOff: s.touchOff === undefined ? DEFAULTS.touchOff : !!s.touchOff,
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

  /* THE ONE PLACE SECONDS BECOME MILLISECONDS. The row is in seconds because
   * that is what a person says; every timer in `voiceui/` is in milliseconds
   * because that is what `setTimeout` takes. A conversion written twice is a
   * conversion that will disagree with itself, so it is written here, beside
   * the field, and `voiceui/app.js` asks for it rather than multiplying. */
  function listenMs(s) {
    return Math.round(normalise(s === undefined ? read() : s).listenWindow * 1000);
  }

  function isDefault(s) {
    s = normalise(s);
    return s.family === DEFAULTS.family && s.uiFamily === DEFAULTS.uiFamily
      && s.size === DEFAULTS.size && s.line === DEFAULTS.line
      && s.view === DEFAULTS.view && s.theme === DEFAULTS.theme && s.wpm === DEFAULTS.wpm
      && s.gap === DEFAULTS.gap && s.context === DEFAULTS.context
      && s.resume === DEFAULTS.resume && s.sidebar === DEFAULTS.sidebar
      && s.micDevice === DEFAULTS.micDevice && s.listenWindow === DEFAULTS.listenWindow
      && s.touchOff === DEFAULTS.touchOff;
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
      "--read-line": s.line === DEFAULTS.line ? null : String(s.line),
      /* THE SCALE IS tokens.css'S, AND THIS IS THE ONE PLACE THAT KNOWS IT
       * (6 Sep). It used to be `warmth / (WARMTHS.length - 1)` -- 0..1, "a
       * straight percentage" -- and the only consumer of `--warm` in this
       * product is `design/reader/tokens.css`, which is calibrated 0..18 and
       * always has been: --ground and --ink mix off `var(--warm) * 9%` and
       * `* 0.6%` in light, `* 10.667` of hue in dark. On the old scale
       * Candle -- the warmest of the five papers -- arrived as 1, which is
       * one eighteenth of the warmth it names, and Paper to Candle moved the
       * ground by half a percent of lightness: measurably on, visibly off.
       * 4.5 is 18/(WARMTHS.length - 1), so Paper is 0 and Candle is 18, the
       * ends the CSS was solved for. WHY IT LIVES HERE and not on the page:
       * "what the five papers mean" is this file's -- WARMTHS is the list and
       * DEFAULTS.warmth is an index into it; a page that scaled the value on
       * arrival would be a second owner of the meaning, which is the thing
       * this store exists to prevent. Absent at the default, like every other
       * one here -- an untouched reader carries no warmth at all and
       * tokens.css's own `--warm: 0` stands. */
      "--warm": s.warmth === DEFAULTS.warmth ? null : String(s.warmth * 4.5)
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
      // the fake root in settings/tests/test_settings.py has a style and no
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
     * `settings/tests/test_settings.py` and friends, and since the at-load
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
   * IT LIVES IN prefs.js for the same reason `suppressNativeMenu` does:
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
   * assuming otherwise. `settings.html` once sat beside this file under
   * `reader/`; it is `settings/settings.html` now (module-split Stage 2b step
   * 4) and this file is `prefs/prefs.js` (Stage 4), so a bare relative URL is
   * right nowhere: studio's pages are served from the origin root, where
   * "settings.html" resolves to `/settings.html` and 404s -- studio was
   * carrying a 302 shim for exactly this, and studio's own render-in-app
   * report asked for the shim to go.
   *
   * The script's own `src` is the honest answer, because it says where
   * `prefs/` actually is on THIS origin -- behind studio, in an exported
   * bundle, or over `file://`, where an absolute path would be the disk root.
   * `../settings/settings.html` resolved against it is the Settings page from
   * any of those, because `prefs/` and `settings/` are siblings in the repo,
   * in a published shell and in a bundle alike.
   * `/settings/settings.html` is the fallback for a document that no longer has
   * a currentScript and no script tag this can recognise.
   *
   * THE PROBE IS THIS FILE'S OWN NAME (Stage 4). It was `settings.js` and the
   * pattern matched that; a file renamed with the pattern left alone would
   * have found no tag, fallen through to the absolute path, and opened the
   * disk root in an export -- silently, because a fallback that works on a
   * server is the hardest kind of break to see. */
  var SELF_SRC = (function () {
    try {
      var d = global.document;
      if (!d) return null;
      if (d.currentScript && d.currentScript.src) return d.currentScript.src;
      var tags = d.getElementsByTagName ? d.getElementsByTagName("script") : [];
      for (var i = tags.length - 1; i >= 0; i--) {
        var src = tags[i] && tags[i].src;
        if (src && /(^|\/)prefs\.js(\?|$)/.test(src)) return src;
      }
    } catch (e) { /* no document, or none of it is there yet */ }
    return null;
  })();

  function settingsUrl() {
    if (SELF_SRC) {
      try { return new global.URL("../settings/settings.html", SELF_SRC).href; }
      catch (e) { return SELF_SRC.replace(/prefs\.js(\?.*)?$/, "../settings/settings.html"); }
    }
    return "/settings/settings.html";
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
    /* M -- THE MICROPHONE, and the row `voiceui/README.md`'s 5 Sep sec. 6 asked
     * for in these words. `voiceui/app.js` has called
     * `TTSTVSettings.hotkeyIs(e, "mic")` since that session and fell back to
     * the literal `m` because no row answered; the row is all that was
     * needed for the trigger to become remappable, and nothing in `voiceui/`
     * changes because of it. Bare, like V, C and D beside it: the key is
     * pressed while reading, it is refused with any modifier, and it is dead
     * while the caret is in a field (`reader/keys.js`'s rule, asked through
     * `TTSTVKeys.typing()`). The full argument for M rather than another
     * letter is in `voiceui/PRESS.md`'s Run C, in one place rather than two.
     *
     * On a phone there is no key and there is no row: the trigger there is an
     * AirPods double-tap, which is a headset button and not a binding this
     * table could hold. Settings says so in words on that device. */
    { id: "mic", group: "reader", label: "Open the listening window",
      sub: "Same as an AirPods double-tap", defs: ["M"] },
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
  global.TTSTVSettings = {
    KEY: KEY, VERSION: VERSION, ROUTE: ROUTE, CHANNEL: CHANNEL,
    FAMILIES: FAMILIES, SIZES: SIZES, LINES: LINES, VIEWS: VIEWS, THEMES: THEMES,
    SIDEBARS: SIDEBARS, WARMTHS: WARMTHS,
    // the hands-free four (5 Sep): the stops the window offers, and the one
    // conversion from the seconds a person picks to the milliseconds a timer
    // takes -- `voiceui/app.js` asks for both rather than carrying either
    LISTEN_WINDOWS: LISTEN_WINDOWS, listenMs: listenMs,
    faceAvailable: faceAvailable, facePresent: facePresent, facesNow: facesNow,
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
    cssVars: cssVars, viewAttrs: viewAttrs, themeAttrs: themeAttrs, apply: apply,
    read: read, save: save, patch: patch, fetchMirror: fetchMirror,
    subscribe: subscribe, live: live,
    // WHERE STUDIO IS, or "" -- exported because the form is another file
    // since Stage 4 and asks whether there is a studio behind this page
    // before it draws a tab that needs one. Internal until then.
    origin: origin,
    // the theme, in public -- one owner for the whole application
    themeNow: themeNow, setTheme: setTheme, toggleTheme: toggleTheme,
    onTheme: onTheme, mountThemeButton: mountThemeButton, THEME_ICON: THEME_ICON,
    // the interface font, in public -- studio consumes it the same way
    uiFontNow: uiFontNow, setUIFont: setUIFont, onUIFont: onUIFont, onPrefs: onPrefs,
    // no Back / Reload / AutoFill on any page of this app
    nativeMenuAllowed: nativeMenuAllowed, suppressNativeMenu: suppressNativeMenu,
    liveScrollbars: liveScrollbars, SB_LINGER: SB_LINGER, SB_LINGER_READING: SB_LINGER_READING,
    // THE SETTINGS WINDOW: the door and the geometry it opens at are one
    // mechanism and stay together here (Stage 4 -- `openWindow` reads
    // `windowGeom`, and it is called from pages that never load the form, so
    // a geometry left behind in the form would be a window that forgets its
    // size everywhere except the page that cannot open it). `open` / `toggle`
    // are aliases because the Mac menu item's own settings.js knocks on those
    // names, and an app built before today must keep working.
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
