/* Which machine this page is running on -- the one helper `reader.html` and
 * `library/library.html` both ask, so the two pages can never disagree about
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
 *   hostInjected   `TTSTVHost.kind !== "web"` (W1 SHELL-WEB). `library/host.js`
 *                  always creates `window.TTSTVHost` and sets `.kind`, so the
 *                  old `!!window.TTSTVHost` test no longer means "an app
 *                  injected an API" -- the kind is the question. On the Mac
 *                  and the phone the host's bootstrap still runs before any
 *                  page script; on a website host.js defaults to `"web"` and
 *                  `hostInjected` is `false`.
 *   studioLive     `GET /state` has answered at least once. Both pages poll
 *                  it already; they hand the answer here (`observe`). False
 *                  on the phone forever (the published shell is static),
 *                  false inside an exported bundle and over file://.
 *   canHoldBooks   a store for books + a secure-context `crypto.subtle` +
 *                  `library/import.js` -- i.e. this page could actually
 *                  import and keep a book. The store is EITHER the Cache
 *                  API OR the host's door (`TTSTVHost.books`, Frank on the
 *                  phone), since G-PULL (11 Sep): on `frank://localhost/`
 *                  the Cache API is present and refuses every put, and the
 *                  book goes to the host instead (`library/import.js`,
 *                  "the store").
 *   hostBooks      the host offers that door -- `TTSTVHost.books` with its
 *                  four verbs. Only Frank on the phone does.
 *
 * **The questions the pages ask:**
 *   bench   -- is there a studio behind this page? On "studio"
 *              `(hostInjected && !phone)` is true immediately; on "web" only
 *              `studioLive` can make it true (the B2 case: a plain browser
 *              on Studio's own origin, where the injector has not spoken but
 *              `/state` has answered).
 *   device  -- is this a device that holds its own books? `canHoldBooks &&
 *              !studioLive && (!hostInjected || hostBooks)`. Gates the "On
 *              this device" panel. Deliberately not "is it a phone": a laptop
 *              browser opening the published shell with no studio behind it
 *              really does hold its books in a Cache, and the panel is right
 *              there. A host with no book door (the desktop app) is never a
 *              device -- Osca's bug below; a host WITH one is (G-PULL, 11
 *              Sep): Frank on the phone injects `TTSTVHost` too, so before
 *              the door existed the books a Sync pulled would have had no
 *              row to be on.
 *   phone   -- is this Frank on the phone? `hostInjected && hostBooks`: the
 *              one host that keeps books behind a door (G-COVERS, 11 Sep).
 *              A host with the door is a device AND a phone, and so it is
 *              NOT a bench: `bench` was `hostInjected || studioLive` until
 *              11 Sep, which made the phone -- a host -- draw the Mac's Sources rail,
 *              its toggle and the bench's actions (Osca's screenshot, 17:34:
 *              "a top bar with ≡ · ⚙ · ☾"). The desktop app has no door and
 *              is untouched: a bench always, a device never.
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

  /* Pure -- the whole rule in seven lines, so the node tests can drive every
   * combination without a DOM. */
  function decide(f) {
    f = f || {};
    var app = !!f.hostInjected;
    var live = !!f.studioLive;
    var phone = app && !!f.hostBooks;            // a host with the door: a device AND a phone
    var bench = (app && !phone) || live;
    return {
      app: app,
      phone: phone,
      studioLive: live,
      bench: bench,
      device: (!app || !!f.hostBooks) && !!f.canHoldBooks && !live,
      // one word for a data-attribute and a report, never for a decision
      // W1 SHELL-WEB: emit host.js's own three words; "browser"/"shell"/"static"
      // are sub-cases of "web" that paintContext still uses for the attribute.
      kind: phone ? "phone" : app ? "studio" : (live ? "browser" : (f.canHoldBooks ? "shell" : "static")),
      benchReason: bench ? null
        : (app && !phone ? "studio isn't answering on this Mac yet"
               : (phone ? "no studio behind this page — this is the app on the phone"
               : (global.TTSTVHost && global.TTSTVHost.WHY_STUDIO || "no studio behind this page"))),
    };
  }

  /* The host's book door, whole: all four verbs `library/import.js`'s
   * HostStore calls, or it is not a door. */
  function hostBookDoor(win) {
    var h = win && win.TTSTVHost, b = h && h.books;
    return !!(b && typeof b.put === "function" && typeof b.meta === "function"
      && typeof b.list === "function" && typeof b.remove === "function");
  }

  function detect(win) {
    win = win || global;
    var hostBooks = hostBookDoor(win);
    /* W1 SHELL-WEB: `library/host.js` always creates `window.TTSTVHost` and
     * sets `.kind`, so `!!win.TTSTVHost` is true on a website too. The
     * question is the kind, not the presence. */
    var hostKind = (win.TTSTVHost && win.TTSTVHost.kind) || "web";
    return {
      hostInjected: hostKind !== "web",
      hostBooks: hostBooks,
      canHoldBooks: (hostBooks || typeof win.caches !== "undefined")
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
