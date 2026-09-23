/* library/host.js -- WHICH MACHINE THIS PAGE IS RUNNING ON, IN ONE WORD.
 *
 * THE ONE PREDICATE (W1 SHELL-WEB, D3). Every Studio-only control in the
 * shell asks this file and nothing else. Before it there were four tests --
 * `!!window.TTSTVHost`, a `location.protocol` regex, `studioLive`, and
 * `TTSTVHost.books` -- and on a static host over `clean/` the second of them
 * says "Studio is here" about `python3 -m http.server`, so the whole surface
 * fired `/state`, `/search`, `/book`, `/engines`, `/kaggle` at a server that
 * has none of them and painted the 404s.
 *
 *   window.TTSTVHost.kind === "studio"   the Python server is behind this page
 *   window.TTSTVHost.kind === "phone"    a Tauri shell with the book door
 *   window.TTSTVHost.kind === "web"      neither: a plain website
 *
 * WHO SETS IT, AND HOW (D3's three):
 *   studio   THE PYTHON SERVER INJECTS IT. `studio/serve.py` answers
 *            `GET /library/host.js` with one line in front of this file --
 *            `window.__TTSTV_HOST_KIND__ = "studio";`. It is the only page
 *            asset the server rewrites, and it rewrites it because the
 *            server is the only thing that knows whether a server is there.
 *   phone    THE TAURI SHELL BOOTSTRAP SETS IT -- `src-tauri/src/lib.rs`
 *            sets `window.__TTSTV_HOST_KIND__ = "phone"` beside HOST_JS.
 *            THAT LINE IS NOT IN W1 (the phone repo is out of scope); the
 *            inference below covers the phone until it lands.
 *   web      THE DEFAULT, applied here, when neither has set it.
 *
 * AND THE INFERENCE, which is a declared compat shim and not a second
 * answer. It exists for exactly one reason: W1 may not touch the phone repo
 * or the Mac host, and without it a shell that ships to both would say
 * "web" on the phone and hide Studio's controls on a device that has a
 * Studio on the Wi-Fi. It reads what the host ALREADY put on the page --
 * the same duck-typing `reader/context.js::hostBookDoor` has used since
 * G-PULL -- and it is deleted the day both bootstraps set the kind
 * explicitly. It is never consulted when an injector has spoken.
 *
 * THIS FILE CREATES `window.TTSTVHost` WHEN IT IS ABSENT. That is deliberate
 * and it has a cost: `!!window.TTSTVHost` no longer means "an app injected
 * an API" -- it is true on a website too. Every such test in the shell is
 * migrated to `TTSTVHost.kind !== "web"` in the same commit.
 *
 * NO PAGE BRANCHES ON `location.protocol` OR ON A URL STRING. This file does
 * not either: it reads injected globals. That is the whole point of it.
 */
(function (global) {
  "use strict";

  var STUDIO = "studio", PHONE = "phone", WEB = "web";
  var KINDS = { studio: true, phone: true, web: true };

  /* The phone's book door, whole: all four verbs `library/import.js`'s
   * HostStore calls, or it is not a door. The same test `reader/context.js`
   * has used since G-PULL -- one rule, two readers. */
  function bookDoor(w) {
    var h = w && w.TTSTVHost, b = h && h.books;
    return !!(b && typeof b.put === "function" && typeof b.meta === "function"
      && typeof b.list === "function" && typeof b.remove === "function");
  }

  /* 1. THE INJECTOR'S OWN WORD, and it wins outright. */
  function injected(w) {
    var k = w && w.__TTSTV_HOST_KIND__;
    if (KINDS[k]) return k;
    var h = w && w.TTSTVHost;
    if (h && KINDS[h.kind]) return h.kind;
    return null;
  }

  /* 2. WHAT THE HOST ALREADY PUT ON THE PAGE (the shim -- see the head). */
  function inferred(w) {
    if (bookDoor(w)) return PHONE;                  // the phone, and only the phone
    if (w && w.TTSTVHost) return STUDIO;            // an app injected an API: the Mac
    if (w && w.__TAURI_INTERNALS__) return PHONE;   // a Tauri shell with no API yet
    return null;
  }

  /* THE ORDER HERE IS LOAD-BEARING: `kind` IS RESOLVED BEFORE THE OBJECT IS
   * CREATED. `var H = global.TTSTVHost = global.TTSTVHost || {}` on the line
   * above this one makes `inferred()` see a `TTSTVHost` on a page that has
   * none, and every website in the world is then told "studio". Measured:
   * with the two lines the other way round, `inferred({})` returns STUDIO and
   * the truth table's `nothing at all -> web` case fails. */
  var kind = injected(global) || inferred(global) || WEB;
  var H = global.TTSTVHost = (typeof global.TTSTVHost === "object" && global.TTSTVHost !== null) ? global.TTSTVHost : {};

  H.kind = kind;
  H.KINDS = KINDS;
  H.isStudio = kind === STUDIO;
  H.isPhone = kind === PHONE;
  H.isWeb = kind === WEB;

  /* THE TWO SENTENCES, ONCE. D3 gives the words; this is where they live, so
   * a page says them and no page writes its own version of them. */
  H.WHY_STUDIO = "Studio needs the Mac app or Kaggle";
  H.WHY_DRIVE = "Connect Drive to sync";

  /* THE GOOGLE CLIENTS, ONE PER HOST KIND (D5). The SHAPE is this file's --
   * `drive.js::googleSignInPhone` already takes `host.google = {clientId,
   * redirect}` and already refuses with a sentence when it is absent -- and
   * the VALUES are W3's to fill. They are `null` here on purpose: a client id
   * invented by a session is a client id that does not exist, and the two
   * that do exist (the Mac's loopback client, the phone's reverse-id client)
   * are `studio/google.py`'s and `lib.rs`'s, not this file's to restate.
   *
   *   studio  studio/google.py's loopback client (the Mac signs in through
   *           the Python server; this file is not in that path)
   *   phone   the iOS reverse-id client, redirect `<reverse-id>:/oauth2redirect`
   *   web     THE SITE'S OWN CLIENT -- redirect `<origin>/library/oauth.html`,
   *           the page §4 specs. PKCE in JS, no secret.
   */
  H.GOOGLE = { studio: null, phone: null, web: null };

  H.google = function () { return H.GOOGLE[kind] || null; };
})(typeof window !== "undefined" ? window : globalThis);
