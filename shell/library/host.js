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
   * a page says them and no page writes its own version of them.
   * CLOUD-WORDS (27 Sep): a person is told about Frank's cloud, never a
   * provider. This file runs before any `/state` answers, so there is no
   * owner gate here -- and none is needed: the sentence is true for the
   * owner too (Frank's cloud is where his build tools run). */
  H.WHY_STUDIO = "Studio needs the Mac app or Frank\u2019s cloud";
  H.WHY_DRIVE = "Connect Drive to sync";

  /* THE GOOGLE CLIENTS, ONE PER HOST KIND (D5, W3 ACCOUNT). The SHAPE is this
   * file's and the VALUES are per kind, because a client id may live in
   * exactly one place and that place is different on each host:
   *
   *   studio  studio/google.py's loopback client. NOT HERE. The Mac signs in
   *           through the Python server (`POST /account/google`) and this
   *           file is not in that path -- the id is in account.json, at mode
   *           0600, and a page never sees it. Left null on purpose.
   *   phone   lib.rs's iOS client, carried in src-tauri/google.json and
   *           INJECTED onto the page by `google_js()`. NOT HERE EITHER: the
   *           phone repo's own test proves no second file carries the id.
   *           `injectedGoogle` below is how this file reaches it.
   *   web     THE SITE'S OWN CLIENT, and the one row a session fills in: a
   *           NEW Google OAuth client of type *Web application*, redirect
   *           `<origin>/library/oauth.html` -- the page `library/oauth.html`
   *           is. PKCE in JS, no secret. See `spec-w3-account.md` §3.
   *
   /* WHAT THE HOST INJECTED WINS. `lib.rs:3209` runs AFTER HOST_JS and sets
    * `TTSTVHost.google` before any page script; on the phone the injected
    * object is the only place the id exists, and a file that overwrote it
    * would take sign-in off the phone. Measured: before this rule,
    * `H.google` answered `null` on a phone whose `TTSTVHost.google` carried
    * a real client id, and `drive.js::googleSignInPhone` refused with "no
    * Google client on this device".
    *
    * THE SHAPE IS AN OBJECT, not a function. `drive.js::googleSignInPhone`
    * reads `host.google.clientId` directly -- every consumer expects
    * `{clientId, redirect}` or null, and a function that must be called
    * first is a shape mismatch that makes the sign-in refuse.  A getter
    * keeps resolution dynamic (late-filled `GOOGLE.web` is picked up), and
    * the setter lets lib.rs inject `TTSTVHost.google = {clientId, redirect}`
    * AFTER this file runs on the phone. */
   var injectedGoogle = H.google;      // lib.rs's {clientId, redirect}, or undefined
   H.GOOGLE = {
     studio: null,                     // studio/google.py's, and not this file's
     phone: null,                      // lib.rs's, injected -- see injectedGoogle
     web: null,                        // OSCA REGISTERS THIS (spec-w3-account.md §3):
                                       // {clientId: "<digits>-<hash>.apps.googleusercontent.com",
                                       //  redirect: "<origin>/library/oauth.html"}
   };
   Object.defineProperty(H, 'google', {
     get: function () {
       var given = injectedGoogle;
       if (typeof given === "function") { try { given = given(); } catch (e) { given = null; } }
       if (given && given.clientId && given.redirect) return given;
       return H.GOOGLE[kind] || null;
     },
     set: function (v) { injectedGoogle = v; },
     configurable: true,
     enumerable: true
   });

  /* AND THE PAGE'S OWN WAY OUT, for the one host that has no host object to
   * ask: the web. `drive.js::googleSignInPhone` requires a
   * `host.googleSignIn(url)` -- on the phone it is Rust's
   * `google_sign_in`, which opens the SYSTEM browser because Google refuses
   * its consent page inside a web view (RFC 8252 §8.12). A website has no
   * app to do that, so it opens a POP-UP OF ITS OWN ORIGIN -- and that is
   * load-bearing, not a convenience: `oauth.html` in a same-origin popup
   * writes the SAME `localStorage` the opener is polling, so the verifier
   * never has to leave the window that made it. A same-tab navigation would
   * destroy the opener and with it the verifier. */
  /* THE SITE'S CLIENT ID COMES FROM ONE PLACE (W-web, 26 Sep): `config.json`
   * AT THE SERVING ROOT -- beside `books/`, one above `shell/` -- written at
   * deploy time by `.github/workflows/pages.yml` (`desktop/tools/site.py`)
   * from the repository variable GOOGLE_WEB_CLIENT_ID and never committed
   * (`desktop/WEB.md`). Here it is `../config.json` (library/ -> the repo
   * root); ship.py re-aims it to `../../config.json` in shell/ exactly as it
   * does `../books/`, so the site root is where it lives. Resolved against
   * THIS file's own URL, so a page one folder deeper still finds it. The
   * redirect is `oauth.html` beside this file -- the exact authorised
   * redirect URL Osca registers is that URL on the site. Empty or absent ->
   * `H.GOOGLE.web` stays null, the Sign in button stays inert, and
   * `H.WHY_GOOGLE` is the one sentence a page prints. `H.configReady`
   * resolves when the answer is in. */
  H.WHY_GOOGLE = "This site has no Google client id yet \u2014 its owner sets GOOGLE_WEB_CLIENT_ID (desktop/WEB.md); Drive sign-in works once it is set.";
  H.config = null;
  H.configReady = Promise.resolve(null);
  if (kind === WEB && typeof global.fetch === "function" && global.document && global.location && /^https?:$/.test(global.location.protocol)) {
    var me = global.document.currentScript && global.document.currentScript.src;
    var here = new URL("./", me || global.location.href);
    H.configReady = global.fetch(new URL("../config.json", here).href, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (c) {
        H.config = (c && typeof c === "object") ? c : {};
        var id = String(H.config.google_web_client_id || "").trim();
        if (id) H.GOOGLE.web = { clientId: id, redirect: new URL("oauth.html", here).href };
        return H.config;
      }, function () { H.config = {}; return H.config; });
  }

  /* THE FLOAT ON THE WEB (LIBRARY-WEB, wave 9, 26 Sep). Osca: *"The float
   * isn't coming up / working."* It was not wired at all outside the app:
   * reader.html hides the Float button when `TTSTVHost.float` is not a
   * function, and the axis's commit past the one-word view resolved false
   * (floatdoor.js `mount` answers "no host"). Here is the web's half of the
   * eight-call float API desktop/src/host.js gives Frank -- the same names,
   * so reader.html, floatdoor.js and float.js change not one line:
   *
   *   float()        opens `../reader/float.html` (beside this file's
   *                  folder, so shell/library/ -> shell/reader/) as a sized
   *                  `window.open` POPUP -- a separate small window, the
   *                  nearest a browser has to the Mac's always-on-top card
   *                  -- and TOGGLES: open when closed, close when open.
   *                  Resolves to what the panel IS after the call, as Rust
   *                  does. A popup blocker answers null -> false, honestly.
   *   floatFeed(p)   dispatches the payload as a DOM CustomEvent on the
   *                  panel's window; false once the panel is gone, which is
   *                  what stops floatdoor's clock.
   *   floatListen    the SAME function on both windows: a CustomEvent
   *                  listener on `window`, the panel for the feed, the
   *                  reader for the commands (float.js and floatdoor.js
   *                  each call it on their own side).
   *   floatSend(cmd) the panel -> its opener, `{cmd, from: "float"}`, the
   *                  shape floatdoor's router expects.
   *   floatClose / floatIsOpen / floatResize  the popup's own verbs;
   *   floatCursor / floatDrag                 no-ops: a browser window has
   *                                           no click-through and drags
   *                                           itself.
   * float.html loads this file for the panel's side (reader/float.html).
   * Not a Tauri global anywhere: `kind === WEB` only, and only where there
   * is a document to open a window from (the node harness has none). */
  if (kind === WEB && global.document && global.location && typeof H.float !== "function") {
    var FEED = "ttstv:float", CMD = "ttstv:float-cmd";
    var panel = null;
    var alive = function () { return !!(panel && !panel.closed); };
    var fire = function (win, name, detail) {
      if (!win || win.closed) return false;
      try {
        var Ev = win.CustomEvent || global.CustomEvent;
        win.dispatchEvent(new Ev(name, { detail: detail }));
        return true;
      } catch (e) { return false; }
    };
    var me = global.document && global.document.currentScript && global.document.currentScript.src;
    var mine = new URL("./", me || global.location.href);
    H.FLOAT_URL = new URL("../reader/float.html", mine).href;
    H.float = function (rect) {
      if (alive()) { try { panel.close(); } catch (e) {} panel = null; return Promise.resolve(false); }
      var r = rect || {};
      var w = Math.max(240, Math.round(+r.w || 0) + 64) || 320, h = 132;
      var feats = "popup,width=" + (w > 240 ? w : 320) + ",height=" + h;
      if (r.x != null && r.y != null) feats += ",left=" + Math.round(global.screenX + (+r.x || 0)) + ",top=" + Math.round(global.screenY + (+r.y || 0));
      try { panel = global.open(H.FLOAT_URL, "frank-float", feats); } catch (e) { panel = null; }
      return Promise.resolve(alive());
    };
    H.floatClose = function () { if (alive()) { try { panel.close(); } catch (e) {} } panel = null; return Promise.resolve(false); };
    H.floatIsOpen = function () { return Promise.resolve(alive()); };
    H.floatFeed = function (payload) { return Promise.resolve(fire(panel, FEED, payload || {})); };
    H.floatListen = function (event, callback) {
      var on = function (e) { callback(e && e.detail); };
      global.addEventListener(event, on);
      return Promise.resolve(function () { global.removeEventListener(event, on); });
    };
    H.floatSend = function (cmd) {
      return Promise.resolve(fire(global.opener, CMD, { cmd: String(cmd || ""), from: "float" }));
    };
    H.floatCursor = function () { return Promise.resolve(false); };
    H.floatDrag = function () { return Promise.resolve(false); };
    H.floatResize = function (w, h) {
      try { if (global.opener && +w && +h) global.resizeTo(Math.round(+w), Math.round(+h)); } catch (e) {}
      return Promise.resolve(true);
    };
  }

  if (kind === WEB && typeof H.googleSignIn !== "function") {
    H.googleSignIn = function (url) {
      var w = global.open(url, "frank-google", "width=520,height=680");
      if (!w) throw new Error("allow pop-ups for this site, then press Sign in again");
      return w;
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
