/* Which machine this page is running on -- the one helper `reader.html` and
 * `reader/library.html` both ask, so the two pages can never disagree about
 * it (PROMPTS reader-ui-decisions step 0; READER_FIRST.md "Osca's app
 * decisions -- 30 Aug").
 *
 * **The bug this exists for.** `library.html` is one file loaded by two very
 * different things: the desktop app on the Mac, and the installed shell on
 * the phone. Its "On this device" panel -- Import bundle…, "AirDrop a bundle
 * .zip to this phone", a storage estimate -- is the phone's half, and it was
 * showing on the Mac: "0 books · 19.2 GB free" against the Mac's own disk,
 * beside a shelf of nine books that live on the SSD. The mirror image is just
 * as wrong: the Sources rail, ingest and the push actions all need studio
 * behind the origin, and on a phone there is no studio and never will be.
 *
 * **The three facts, and nothing else.** No user agent sniffing, no screen
 * width -- a narrow window on the Mac is not a phone:
 *
 *   hostInjected   `window.TTSTVHost` exists. The desktop app injects it as
 *                  an `initialization_script` (desktop/src/host.js), before
 *                  a line of page script runs, so this is true from the
 *                  first frame -- which is what makes the Mac's panel
 *                  disappear with no flash. Nothing else ever sets it.
 *   studioLive     `GET /state` has answered at least once. Both pages poll
 *                  it already; they hand the answer here (`observe`). False
 *                  on the phone forever (the published shell is static),
 *                  false inside an exported bundle and over file://.
 *   canHoldBooks   the Cache API + a secure-context `crypto.subtle` +
 *                  `library/import.js` -- i.e. this page could actually
 *                  import and keep a book (`library.html`'s own CAN_IMPORT
 *                  rule, unchanged, just moved behind one name).
 *
 * **The two questions the pages ask:**
 *   bench   -- is there a studio behind this page? `hostInjected ||
 *              studioLive`. Gates the Sources rail, ingest, the phone shelf,
 *              and the Actions that push. In the app it is true immediately;
 *              in a plain browser at studio it turns true on the first poll.
 *   device  -- is this a device that holds its own books? `canHoldBooks &&
 *              !hostInjected && !studioLive`. Gates the "On this device"
 *              panel. Deliberately not "is it a phone": a laptop browser
 *              opening the published shell with no studio behind it really
 *              does hold its books in a Cache, and the panel is right there.
 *
 * A page whose bundle predates this file must still read, so every caller
 * guards on `window.TTSTVContext` and falls back to what it did before --
 * the same rule `settings.js` documents for itself.
 */
(function (global) {
  "use strict";

  var VERSION = 1;

  /* Observed, not detected: the pages own the polling and tell us. `null`
   * means "nobody has looked yet", which is not the same as false -- but it
   * is treated as false, because a page must draw something before the first
   * answer and "no bench yet" is the state that cannot be wrong on a phone. */
  var observed = { studioLive: null };

  function observe(facts) {
    if (facts && "studioLive" in facts) observed.studioLive = !!facts.studioLive;
    return read();
  }

  /* Pure -- the whole rule in six lines, so the node tests can drive every
   * combination without a DOM. */
  function decide(f) {
    f = f || {};
    var app = !!f.hostInjected;
    var live = !!f.studioLive;
    var bench = app || live;
    return {
      app: app,
      studioLive: live,
      bench: bench,
      device: !app && !!f.canHoldBooks && !live,
      // one word for a data-attribute and a report, never for a decision
      kind: app ? "app" : (live ? "browser" : (f.canHoldBooks ? "shell" : "static")),
      benchReason: bench ? null
        : (app ? "studio isn't answering on this Mac yet"
               : "no studio behind this page — this is the app on the phone"),
    };
  }

  function detect(win) {
    win = win || global;
    return {
      hostInjected: !!win.TTSTVHost,
      canHoldBooks: typeof win.caches !== "undefined"
        && typeof win.crypto !== "undefined" && !!(win.crypto && win.crypto.subtle)
        && typeof win.TTSTVBundle !== "undefined",
    };
  }

  function facts(win) {
    var d = detect(win);
    d.studioLive = !!observed.studioLive;
    return d;
  }

  function read(win) { return decide(facts(win)); }

  global.TTSTVContext = {
    VERSION: VERSION,
    decide: decide, detect: detect, facts: facts, read: read, observe: observe,
    // tests only: forget what was observed
    _reset: function () { observed.studioLive = null; },
  };
})(typeof window !== "undefined" ? window : globalThis);
