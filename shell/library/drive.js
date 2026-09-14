/* ================== library/drive.js -- Google, and Google Drive, in the page
   Job 26b (Osca, 6 Sep 2026): *"Google IS the account"*; *"the folder protocol
   from the same manifest + merges studio/sync.py already has, in a 'Frank'
   folder in the customer's Drive … Sync = push ledger -> pull books whose
   hash the phone lacks -> pull ledger + settings.json -> merge, the same
   runSync with a second adapter."* This file is the phone's half, and it
   lives beside `import.js` because what it pulls lands in import.js's store
   (`TTSTVBundle.importFiles`, the same step a zip and the LAN take) --
   `studio/STATUS.md` job 26 §3 named this folder as the home for the day
   Drive landed.

     window.TTSTVDrive = { googleSignInPhone, googleSignOutPhone,
                           googleAccessToken, runDriveSync, driveClient,
                           driveFolder, syncMergeMarks, syncMergePositions,
                           syncMergeSettings, ... }

   TWO HALVES OF ONE ACCOUNT. On the Mac the account is STUDIO's
   (`studio/google.py`: the loopback PKCE flow in the shipped Python, the
   refresh token in `TTS_DATA/studio/account.json`) and the Settings page
   only presses it -- `POST /account/google`, then `GET /account` until the
   sign-in is over (settings/settings.js). On the phone the account is THIS
   FILE's: PKCE in JS (`crypto.subtle`), the consent page opened by the host
   (`TTSTVHost.googleSignIn(url)`, the system browser -- Google refuses its
   consent page inside a web view), the redirect handed back by the host into
   `localStorage[GOOGLE_REDIRECT_KEY]` (the hand-off `frank-pair://` uses),
   the code exchanged here with the verifier and no secret (an iOS client
   has none), the tokens in `ttstv.sync.google` -- the ONE key this file
   owns. The account record (`ttstv.sync.account`) and the reader's three
   ledgers are the Settings page's to read and write: it hands its own
   readers in (`o.store`), so nothing here names a key of the reader's.

   THE FOLDER is `studio/drive.py`'s, read here by the ids `library.json`
   carries: `Frank/library.json`, `positions.json`, `settings.json`,
   `marks/<slug>.json`, `books/<slug>@<hash>/<the bundle file set>`. The
   phone never writes a book -- Studio is the truth for books -- and writes
   only the three ledgers, each read-merge-put with the merge the Mac uses:
   marks by id newest-wins (`window.Marginalia.merge`, reader/marginalia.js,
   which settings.html loads for this), positions by time per book
   (`syncMergePositions` == `studio/sync.py::merge_positions`, held by
   `settings/tests/test_sync_drive.py`), settings by `saved`, whole.

   THE PRESS is `runDriveSync`: push marks -> push position -> read
   `library.json` -> pull every book whose hash this device lacks, file by
   file, by id -> settings. Every call goes through `fetch` with a bearer
   from `remote.token(force)`; a 401 refreshes once; anything else is a
   sentence in `why`, never a throw out of the press.

   THE BOOKS GO TO THE APP WHEN THERE IS ONE (G-SYNCBG, 11 Sep). Osca: *"the
   phone's pull is JavaScript inside the Settings page. Leave the page and it
   cancels"* -- and opening a book is leaving the page. On Frank the host has
   a door for the pull, `TTSTVHost.sync` {start, status, stop, auto}, and the
   press hands it a JOB instead of fetching: this file still decides WHAT
   (`syncJob`: library.json's rows or Studio's manifest, minus what
   `book_list` says is here, each row's file set and the shelf's row), and
   the app does the HOW on a thread of its own (the phone repo's
   `src-tauri/src/pull.rs`). The ledgers stay here -- small, merged both ways.
   The app also asks for a plan by itself, on launch and on every return to
   the foreground (`syncAuto`, called by the door in whatever page is
   showing). Where there is no such door -- the Mac's pages, the PWA -- the
   press below is exactly what it was.

   The word a credential's name uses appears here only as Google's own wire
   vocabulary (`refresh_token`, `/token`, `nextPageToken`) -- which is why
   this is its own file and not a block in settings.js, whose test
   (`settings/tests/test_cloud_gpu.py`) holds that page to `id` and `secret`. */
(function (global) {
"use strict";

var GOOGLE = {
  AUTH: "https://accounts.google.com/o/oauth2/v2/auth",
  TOKEN: "https://oauth2.googleapis.com/token",
  REVOKE: "https://oauth2.googleapis.com/revoke",
  USERINFO: "https://openidconnect.googleapis.com/v1/userinfo",
  SCOPES: "https://www.googleapis.com/auth/drive.file openid email",
};
var DRIVE = {
  API: "https://www.googleapis.com/drive/v3",
  UPLOAD: "https://www.googleapis.com/upload/drive/v3",
  FOLDER: "application/vnd.google-apps.folder",
  ROOT: "Frank", LIBRARY: "library.json", POSITIONS: "positions.json", SETTINGS: "settings.json",
  MARKS: "marks", BOOKS: "books",
};
var GOOGLE_TOKEN_KEY = "ttstv.sync.google";           // {access, refresh, expires, clientId} -- this file's only store
var GOOGLE_REDIRECT_KEY = "ttstv.sync.googleRedirect"; // the host writes the redirect URL here; this file takes it
var GOOGLE_SIGNIN_MS = 5 * 60 * 1000;
var GOOGLE_POLL_MS = 500;
var DRIVE_MULTIPART_MAX = 5 * 1024 * 1024;

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

function b64url(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return global.btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/* RFC 7636: 32 random bytes -> the verifier; sha256 of it -> the S256
 * challenge. Resolves {verifier, challenge}; a page with no
 * `crypto.subtle` (file://) resolves null and the caller says so. */
function googlePkce() {
  var c = global.crypto;
  if (!c || !c.getRandomValues || !c.subtle || !global.TextEncoder) return Promise.resolve(null);
  var raw = new Uint8Array(32);
  c.getRandomValues(raw);
  var verifier = b64url(raw);
  return c.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (d) {
    return { verifier: verifier, challenge: b64url(new Uint8Array(d)) };
  });
}
function formBody(o) {
  return Object.keys(o).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&");
}
/* Pure: Google's consent page, `studio/google.py::auth_url`'s shape --
 * offline + consent so a refresh token comes back. */
function googleAuthUrl(clientId, redirect, challenge, state) {
  return GOOGLE.AUTH + "?" + formBody({
    client_id: clientId, redirect_uri: redirect, response_type: "code", scope: GOOGLE.SCOPES,
    code_challenge: challenge, code_challenge_method: "S256", state: state,
    access_type: "offline", prompt: "consent",
  });
}
/* Pure: the redirect the host handed back -> {code, state} or {error}. */
function googleRedirectParams(url) {
  var s = String(url || "");
  var q = s.indexOf("?");
  var out = {};
  if (q < 0) return out;
  s.slice(q + 1).split("&").forEach(function (kv) {
    var i = kv.indexOf("=");
    var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
    out[k] = decodeURIComponent((i < 0 ? "" : kv.slice(i + 1)).replace(/\+/g, " "));
  });
  return out;
}
function googleFetchJSON(fetchFn, url, init) {
  return fetchFn(url, init).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (d) {
      var e = d && d.error;
      var why = res.ok ? null : ((e && (e.message || e.error_description || e)) || d.error_description || ("HTTP " + res.status));
      if (e && typeof e === "object" && e.message) why = e.message;
      if (!res.ok && d && d.error_description) why = String(d.error) + " -- " + d.error_description;
      return { ok: res.ok, status: res.status, body: d, why: why ? String(why) : null };
    });
  }).catch(function (e) {
    return { ok: false, status: 0, body: null, why: "Google not reachable (" + String((e && e.message) || e) + ")" };
  });
}
/* The code for the tokens (no secret: an iOS client has none). Resolves
 * {access, refresh, expires} or {why}. */
function googleExchange(fetchFn, code, verifier, redirect, clientId, now) {
  return googleFetchJSON(fetchFn, GOOGLE.TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({ code: code, client_id: clientId, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirect }),
  }).then(function (r) {
    if (!r.ok || !r.body || typeof r.body.access_token !== "string") return { why: "the code exchange was refused: " + (r.why || "no token") };
    return { access: r.body.access_token, refresh: r.body.refresh_token || null,
             expires: (now == null ? Date.now() : now) + 1000 * (Number(r.body.expires_in) || 3600) };
  });
}
function googleRefresh(fetchFn, tok, now) {
  if (!tok || !tok.refresh || !tok.clientId) return Promise.resolve({ why: "not signed in" });
  return googleFetchJSON(fetchFn, GOOGLE.TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({ client_id: tok.clientId, refresh_token: tok.refresh, grant_type: "refresh_token" }),
  }).then(function (r) {
    if (!r.ok || !r.body || typeof r.body.access_token !== "string") return { why: "the refresh was refused: " + (r.why || "no token") };
    var next = Object.assign({}, tok, { access: r.body.access_token,
      expires: (now == null ? Date.now() : now) + 1000 * (Number(r.body.expires_in) || 3600) });
    syncWrite(GOOGLE_TOKEN_KEY, next);
    return next;
  });
}
/* A live bearer token from this page's own store, refreshed within a
 * minute of expiry or when `force` says Drive refused the last one.
 * Resolves the string, or rejects with a sentence. */
function googleAccessToken(fetchFn, force, now) {
  var tok = syncRead(GOOGLE_TOKEN_KEY);
  var t = now == null ? Date.now() : now;
  if (!tok || !tok.access) return Promise.reject(new Error("not signed in"));
  if (!force && Number(tok.expires) - 60000 > t) return Promise.resolve(tok.access);
  return googleRefresh(fetchFn, tok, t).then(function (r) {
    if (r.why) throw new Error(r.why);
    return r.access;
  });
}
function googleUserinfo(fetchFn, access) {
  return googleFetchJSON(fetchFn, GOOGLE.USERINFO, { headers: { Authorization: "Bearer " + access } }).then(function (r) {
    return r.ok && r.body && typeof r.body.email === "string" ? { email: r.body.email } : { why: "who am I? -- userinfo refused: " + (r.why || "no email") };
  });
}

/* Wait for the host to hand the redirect back: `GOOGLE_REDIRECT_KEY`
 * polled (a same-page write fires no `storage` event), up to five
 * minutes. The key is taken as it is read so a stale redirect cannot
 * answer the next sign-in. */
function googleAwaitRedirect(o) {
  o = o || {};
  var poll = o.pollMs || GOOGLE_POLL_MS, limit = o.limitMs || GOOGLE_SIGNIN_MS;
  var started = Date.now();
  return new Promise(function (resolve) {
    function tick() {
      var url = null;
      try { url = global.localStorage.getItem(GOOGLE_REDIRECT_KEY); } catch (e) {}
      if (url) {
        try { global.localStorage.removeItem(GOOGLE_REDIRECT_KEY); } catch (e) {}
        resolve(url);
        return;
      }
      if (Date.now() - started > limit) { resolve(null); return; }
      global.setTimeout(tick, poll);
    }
    tick();
  });
}

/* The phone's sign-in, whole. `host.google` is {clientId, redirect} (the
 * iOS client, its reverse-id scheme) and `host.googleSignIn(url)` opens
 * the system browser. Resolves {who} or {why}; on success the tokens are
 * in `GOOGLE_TOKEN_KEY` and the account is `{kind: "google", who}`. */
function googleSignInPhone(host, o) {
  o = o || {};
  var fetchFn = o.fetch || global.fetch;
  var say = o.say || function () {};
  var g = host && host.google;
  if (!g || !g.clientId || !g.redirect || typeof host.googleSignIn !== "function") {
    return Promise.resolve({ why: "no Google client on this device -- sign in is built for Frank on the phone and Studio on the Mac" });
  }
  try { global.localStorage.removeItem(GOOGLE_REDIRECT_KEY); } catch (e) {}
  return googlePkce().then(function (p) {
    if (!p) return { why: "this page cannot make a PKCE challenge (no crypto.subtle)" };
    var state = b64url((function () { var r = new Uint8Array(12); global.crypto.getRandomValues(r); return r; })());
    var url = googleAuthUrl(g.clientId, g.redirect, p.challenge, state);
    say("Waiting for Google…");
    return Promise.resolve().then(function () { return host.googleSignIn(url); }).then(function () {
      return googleAwaitRedirect(o);
    }).then(function (back) {
      if (!back) return { why: "no answer from Google in five minutes" };
      var q = googleRedirectParams(back);
      if (q.error) return { why: String(q.error) };
      if (q.state !== state) return { why: "the redirect's state did not match" };
      if (!q.code) return { why: "no code in the redirect" };
      say("Signing in…");
      return googleExchange(fetchFn, q.code, p.verifier, g.redirect, g.clientId).then(function (tok) {
        if (tok.why) return tok;
        if (!tok.refresh) return { why: "Google sent no refresh token -- remove Frank at myaccount.google.com/permissions and try again" };
        return googleUserinfo(fetchFn, tok.access).then(function (me) {
          if (me.why) return me;
          syncWrite(GOOGLE_TOKEN_KEY, { access: tok.access, refresh: tok.refresh, expires: tok.expires, clientId: g.clientId });
          return { who: me.email };
        });
      });
    });
  });
}
function googleSignOutPhone(fetchFn) {
  var tok = syncRead(GOOGLE_TOKEN_KEY);
  var done = function () {
    syncWrite(GOOGLE_TOKEN_KEY, null);
    return { ok: true };
  };
  if (!tok || !(tok.refresh || tok.access) || !fetchFn) return Promise.resolve(done());
  return fetchFn(GOOGLE.REVOKE + "?token=" + encodeURIComponent(tok.refresh || tok.access), { method: "POST" })
    .then(done, done);
}

/* ------------------------------------------------ Drive v3, in JS
 * The four calls, over `fetchFn` with a bearer from `token(force)`. A
 * 401 refreshes once; everything else is a sentence. `put` is multipart
 * only -- the phone writes ledgers, never a book. */
function driveClient(token, fetchFn) {
  fetchFn = fetchFn || global.fetch;
  var calls = 0;
  function call(method, url, headers, body, raw) {
    var forced = false;
    function once() {
      return token(forced).then(function (t) {
        calls++;
        var h = Object.assign({}, headers || {}, { Authorization: "Bearer " + t });
        return fetchFn(url, { method: method, headers: h, body: body });
      }).then(function (res) {
        if (res.status === 401 && !forced) { forced = true; return once(); }
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            var e = d && d.error;
            var m = e && typeof e === "object" ? e.message : e;
            throw new Error("Drive: " + method + " " + url.split("?")[0].split("/v3")[1] + " -> HTTP " + res.status + (m ? " (" + m + ")" : ""));
          });
        }
        return raw ? res.arrayBuffer().then(function (b) { return new Uint8Array(b); }) : res.json().catch(function () { return {}; });
      });
    }
    return once();
  }
  function q(s) { return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
  function list(query) {
    var out = [];
    function page(tokenNext) {
      var params = { q: query, fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)", pageSize: "1000", spaces: "drive" };
      if (tokenNext) params.pageToken = tokenNext;
      return call("GET", DRIVE.API + "/files?" + formBody(params)).then(function (d) {
        (d.files || []).forEach(function (f) { out.push(f); });
        return d.nextPageToken ? page(d.nextPageToken) : out;
      });
    }
    return page(null);
  }
  function children(parent) {
    return list("'" + q(parent) + "' in parents and trashed=false").then(function (files) {
      var by = {};
      files.forEach(function (f) {
        var prev = by[f.name];
        if (!prev || String(f.modifiedTime || "") < String(prev.modifiedTime || "")) by[f.name] = f;
      });
      return by;
    });
  }
  function folder(name, parent) {
    return list("name='" + q(name) + "' and mimeType='" + DRIVE.FOLDER + "' and '" + q(parent) + "' in parents and trashed=false")
      .then(function (found) {
        if (found.length) return found.sort(function (a, b) { return String(a.modifiedTime || "") < String(b.modifiedTime || "") ? -1 : 1; })[0].id;
        return call("POST", DRIVE.API + "/files?fields=id", { "Content-Type": "application/json" },
                    JSON.stringify({ name: name, mimeType: DRIVE.FOLDER, parents: [parent] })).then(function (d) { return d.id; });
      });
  }
  function getBytes(id) { return call("GET", DRIVE.API + "/files/" + encodeURIComponent(id) + "?alt=media", null, undefined, true); }
  function getJSON(id) {
    return getBytes(id).then(function (bytes) {
      try { var d = JSON.parse(new TextDecoder().decode(bytes)); return d && typeof d === "object" ? d : null; } catch (e) { return null; }
    });
  }
  function put(name, parent, text, mime, id) {
    var boundary = "frank" + Math.random().toString(36).slice(2);
    var meta = id ? { name: name } : { name: name, parents: [parent] };
    var body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta)
      + "\r\n--" + boundary + "\r\nContent-Type: " + (mime || "application/json") + "\r\n\r\n" + text + "\r\n--" + boundary + "--";
    if (body.length > DRIVE_MULTIPART_MAX) return Promise.reject(new Error("Drive: " + name + " is over the 5 MB multipart cap"));
    var url = id ? DRIVE.UPLOAD + "/files/" + encodeURIComponent(id) + "?uploadType=multipart&fields=id"
                 : DRIVE.UPLOAD + "/files?uploadType=multipart&fields=id";
    return call(id ? "PATCH" : "POST", url, { "Content-Type": "multipart/related; boundary=" + boundary }, body)
      .then(function (d) { return d.id || id; });
  }
  return { list: list, children: children, folder: folder, getBytes: getBytes, getJSON: getJSON, put: put,
           get calls() { return calls; } };
}

/* `studio/drive.py::Folder`, in JS: `Frank/` found or made, its root
 * listed once, the ledgers read and written by name. */
function driveFolder(drive) {
  var root = null, names = {}, marksDir = null, marksNames = null;
  function open() {
    return drive.list("name='" + DRIVE.ROOT + "' and mimeType='" + DRIVE.FOLDER + "' and 'root' in parents and trashed=false")
      .then(function (found) {
        if (found.length) return found.sort(function (a, b) { return String(a.modifiedTime || "") < String(b.modifiedTime || "") ? -1 : 1; })[0].id;
        return drive.folder(DRIVE.ROOT, "root");
      }).then(function (id) {
        root = id;
        return drive.children(root);
      }).then(function (by) { names = by; return api; });
  }
  function dir(name) {
    var f = names[name];
    if (f && f.mimeType === DRIVE.FOLDER) return Promise.resolve(f.id);
    return drive.folder(name, root).then(function (id) { names[name] = { id: id, name: name, mimeType: DRIVE.FOLDER }; return id; });
  }
  function readJSON(name) { var f = names[name]; return f ? drive.getJSON(f.id) : Promise.resolve(null); }
  function writeJSON(name, obj, parent, into) {
    into = into || names;
    var prev = into[name];
    return drive.put(name, parent || root, JSON.stringify(obj), "application/json", prev ? prev.id : null)
      .then(function (id) { into[name] = { id: id, name: name, mimeType: "application/json" }; return id; });
  }
  function library() {
    return readJSON(DRIVE.LIBRARY).then(function (lib) {
      return lib && Array.isArray(lib.books) ? lib : { version: 1, saved: 0, books: [] };
    });
  }
  function marks() {
    return dir(DRIVE.MARKS).then(function (id) { marksDir = id; return drive.children(id); }).then(function (by) {
      marksNames = by;
      var slugs = Object.keys(by).filter(function (n) { return /\.json$/.test(n); });
      var out = {};
      var i = 0;
      function next() {
        if (i >= slugs.length) return out;
        var n = slugs[i++];
        return drive.getJSON(by[n].id).then(function (rec) { if (rec) out[n.slice(0, -5)] = rec; return next(); });
      }
      return next();
    });
  }
  function writeMarks(slug, rec) {
    return (marksNames ? Promise.resolve(marksDir) : dir(DRIVE.MARKS).then(function (id) { marksDir = id; return drive.children(id); })
      .then(function (by) { marksNames = by; return marksDir; }))
      .then(function (id) { return writeJSON(slug + ".json", rec, id, marksNames); });
  }
  var api = { open: open, readJSON: readJSON, writeJSON: writeJSON, library: library, marks: marks, writeMarks: writeMarks,
              get root() { return root; } };
  return api;
}

/* ------------------------------------------------------ the merges
 * Marks: `reader/marginalia.js::margMerge` when the page has it
 * (settings.html loads the file for exactly this), else the newer
 * `saved` wins whole -- said in words, never silent. Positions:
 * `studio/sync.py::merge_positions`, line for line. Settings: newer
 * `saved` wins whole (`prefs/prefs.js` stamps every write). */
function syncMergeMarks(a, b) {
  var M = global.Marginalia;
  if (M && typeof M.merge === "function") return M.merge(a, b);
  var sa = Number(a && a.saved) || 0, sb = Number(b && b.saved) || 0;
  return sb > sa ? b : a;
}
function syncPositionOk(p) {
  return !!p && typeof p === "object" && typeof p.chapter === "string" && (p.wordId == null || typeof p.wordId === "string");
}
function syncSlugOk(slug) { return /^[a-z0-9][a-z0-9-]*$/.test(String(slug)) && String(slug).length <= 64; }
function syncMergePositions(mine, theirs) {
  var out = {};
  Object.keys(mine || {}).forEach(function (k) { if (syncPositionOk(mine[k])) out[k] = mine[k]; });
  Object.keys(theirs || {}).forEach(function (slug) {
    var p = theirs[slug];
    if (!syncPositionOk(p) || !syncSlugOk(slug)) return;
    var prev = out[slug];
    if (!prev || (Number(p.at) || 0) >= (Number(prev.at) || 0)) out[slug] = p;
  });
  return out;
}
function syncSettingsOk(s) {
  return !!s && typeof s === "object" && s.version === 1 && typeof s.saved === "number" && s.settings && typeof s.settings === "object";
}
function syncMergeSettings(mine, theirs) {
  var a = syncSettingsOk(mine) ? mine : null, b = syncSettingsOk(theirs) ? theirs : null;
  if (!a) return b;
  if (!b) return a;
  return b.saved > a.saved ? b : a;
}
function sameJSON(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function countMarks(rec) {
  var n = 0;
  ["notes", "highlights", "bookmarks"].forEach(function (k) {
    (rec && Array.isArray(rec[k]) ? rec[k] : []).forEach(function (e) { if (e && !e.deleted) n++; });
  });
  return n;
}

/* The Drive press, on the phone: the loop in the file's head. `remote`
 * is {kind: "drive", token(force) -> Promise<string>, fetch?}; `o.store`
 * is the page's own readers and writers of the three ledgers --
 * {marginalia() -> {slug: rec}, writeMarginalia(slug, rec), positions()
 * -> map, writePositions(map), settings() -> rec | null,
 * writeSettings(rec), deviceId() -> string} -- so this file names no key of
 * the reader's (settings/settings.js hands its own in). Resolves the same
 * {ok, books, marks, pulled, why} the LAN loop resolves. */
function runDriveSync(remote, o) {
  o = o || {};
  var say = o.say || function () {};
  var bundle = o.bundle || null;
  var href = o.href;
  var fetchFn = remote.fetch || o.fetch || global.fetch;
  var store = o.store;
  if (!store || typeof store.marginalia !== "function") {
    return Promise.resolve({ ok: false, books: 0, marks: 0, pulled: 0, why: "no store handed to the Drive press (o.store)" });
  }
  var device = o.device || (store.deviceId && store.deviceId());
  var out = { ok: false, books: 0, marks: 0, pulled: 0, why: null };
  // G-SYNCBG: with the host's pull the books are PLANNED here and handed over
  // after the ledgers; without it (every host but the phone) nothing changes
  var pull = syncHostPull({ sync: o.pull });
  var pullRows = null;
  var drive = driveClient(remote.token, fetchFn);
  var folder = driveFolder(drive);
  say("Connecting to Drive…");
  return folder.open().then(function () {
    say("Pushing marks…");
    return folder.marks();
  }).then(function (theirs) {
    var mine = store.marginalia();
    var slugs = Object.keys(Object.assign({}, mine, theirs)).sort();
    var i = 0, n = 0;
    function next() {
      if (i >= slugs.length) return null;
      var slug = slugs[i++];
      if (!syncSlugOk(slug)) return next();
      var a = mine[slug], b = theirs[slug];
      var merged = syncMergeMarks(a || { version: 1, slug: slug, saved: 0, notes: [], highlights: [], bookmarks: [] },
                                  b || { version: 1, slug: slug, saved: 0, notes: [], highlights: [], bookmarks: [] });
      if (device && !merged.device) merged.device = device;
      n += countMarks(merged);
      var w = Promise.resolve();
      if (!a || !sameJSON(syncMergeMarks(a, a), merged)) store.writeMarginalia(slug, merged);
      if (!b || !sameJSON(syncMergeMarks(b, b), merged)) w = folder.writeMarks(slug, merged);
      return w.then(next);
    }
    return Promise.resolve(next()).then(function () { out.marks = n; });
  }).then(function () {
    say("Pushing position…");
    return folder.readJSON(DRIVE.POSITIONS).then(function (doc) {
      var theirs = doc && doc.positions && typeof doc.positions === "object" ? doc.positions : {};
      var mine = store.positions();
      var merged = syncMergePositions(mine, theirs);
      if (!sameJSON(merged, mine)) store.writePositions(merged);
      if (!sameJSON(merged, theirs)) return folder.writeJSON(DRIVE.POSITIONS, { version: 1, saved: Date.now(), positions: merged });
      return null;
    });
  }).then(function () {
    say("Asking what Drive has…");
    return folder.library();
  }).then(function (lib) {
    var rows = (lib.books || []).filter(function (b) { return b && typeof b.slug === "string" && typeof b.hash === "string" && !b.superseded; });
    out.books = rows.length;
    if (pull) { pullRows = rows; return null; }
    if (!rows.length) return null;
    if (!bundle || typeof bundle.importFiles !== "function") {
      throw new Error("this page cannot import books (library/import.js is not loaded)");
    }
    return bundle.listInstalled(href).then(function (have) {
      var got = {};
      have.forEach(function (b) { got[b.slug + "-" + b.hash] = true; });
      var wanted = rows.filter(function (b) { return !got[b.slug + "-" + b.hash] && Array.isArray(b.files); });
      var i = 0;
      function next() {
        if (i >= wanted.length) return Promise.resolve();
        var b = wanted[i++];
        say("Pulling " + i + " of " + wanted.length + " · " + (b.title || b.slug));
        var byRel = {};
        b.files.forEach(function (f) { byRel[f.rel] = f.id; });
        var fetchRel = function (rel) {
          if (!byRel[rel]) return Promise.reject(new Error(rel + ": not in library.json"));
          return drive.getBytes(byRel[rel]);
        };
        return bundle.importFiles(b.slug, b.files.map(function (f) { return f.rel; }), fetchRel, {
          href: href,
          onProgress: function (p) {
            say("Pulling " + i + " of " + wanted.length + " · " + (b.title || b.slug) + " · " + p.done + "/" + p.total);
          },
        }).then(function (rep) {
          if (!rep.ok) throw new Error((b.title || b.slug) + ": " + (rep.errors || []).join("; "));
          out.pulled++;
          return next();
        });
      }
      return next();
    });
  }).then(function () {
    say("Settings…");
    return folder.readJSON(DRIVE.SETTINGS).then(function (theirs) {
      var mine = store.settings ? store.settings() : null;
      var win = syncMergeSettings(mine, theirs);
      if (!win) return null;
      if (!sameJSON(win, mine) && store.writeSettings) store.writeSettings(win);
      if (!sameJSON(win, theirs)) return folder.writeJSON(DRIVE.SETTINGS, win);
      return null;
    });
  }).then(function () {
    if (!pull) return null;
    say("Handing the books to Frank…");
    return syncHandOff(pull, "drive", syncDriveAuth, pullRows || [], { bundle: bundle, href: href, trigger: "press" })
      .then(function (h) { out.handed = h.handed; out.refused = h.refused; out.status = h.status; });
  }).then(function () {
    out.ok = true;
    out.calls = drive.calls;
    return out;
  }, function (e) {
    out.why = String((e && e.message) || e);
    out.calls = drive.calls;
    return out;
  });
}

/* ============================================ THE PULL'S PLAN (G-SYNCBG)
 * The app downloads; this decides what. A JOB is what `TTSTVHost.sync.start`
 * takes and `src-tauri/src/pull.rs` (the phone repo) runs:
 *
 *   {transport: "drive" | "lan", trigger: "press" | "launch" | "foreground",
 *    auth: {access, refresh, expires, clientId} | {base, token},
 *    books: [{slug, hash, title, meta, files: [{rel, id | url, bytes}]}],
 *    why?}                       -- set when there was nothing to plan WITH
 *
 * `meta` is the row the shelf shows, key for key what `import.js::importBook`
 * writes -- built from Studio's row and the file list, because the app never
 * reads book.json (`syncBookMeta`). A row the device already holds at that
 * hash is not in the job; neither is a superseded one; a row import.js would
 * refuse (no book.json, a schema above its ceiling) is in `refused`, with
 * import.js's own sentence, and the rest go. The app commits each book's
 * row LAST, as `book_meta` does, so a half-pulled book is never on the
 * shelf and the next start resumes it by byte count. */
var SYNC_PAIR_KEY = "ttstv.sync.pair";   // settings.js's pairing {base, token, name} -- READ here, for the app's own ask
var SYNC_SCHEMA_MAX = 7;                  // import.js's SCHEMA_MAX, for a page that has not loaded import.js
var SYNC_LAN_MS = 4000;                   // how long the app's ask waits for the paired Studio before trying Drive

/* The host's pull, or null. Duck-typed on the two calls the press needs. */
function syncHostPull(host) {
  var s = host && host.sync;
  return s && typeof s.start === "function" && typeof s.status === "function" ? s : null;
}

/* Pure: import.js's meta row for a book nobody has read yet. The shelf's
 * facts come from Studio's row (title, author, lang, words, schema_version,
 * and first_words / form when the row carries them); the rest -- counts,
 * the has_* flags, bytes -- from its file list, which is what importBook
 * derives them from too. `chapters` is the row's when it says, else the
 * chapter texts (one per chapter, export_bundle's rule). */
function syncBookMeta(row, rels, now) {
  var has = function (rel) { return rels.indexOf(rel) >= 0; };
  var count = function (re) { return rels.filter(function (r) { return re.test(r); }).length; };
  var timed = count(/^timings\//), voiced = count(/^audio\//), texted = count(/^chapters\//);
  var bytes = 0;
  (row.files || []).forEach(function (f) { if (f && has(f.rel)) bytes += Number(f.bytes) || 0; });
  return {
    slug: row.slug, hash: row.hash, title: row.title || row.slug, author: row.author || null, lang: row.lang || null,
    chapters: typeof row.chapters === "number" ? row.chapters : Math.max(texted, timed),
    words: typeof row.words === "number" ? row.words : null, bytes: bytes,
    has_timings: timed > 0, has_audio: voiced > 0,
    chapters_timed: timed, chapters_voiced: voiced, chapters_texted: texted,
    has_book_data: has("book-data.js"), has_word_map: texted > 0 && timed > 0,
    has_spans: has("spans.json"), has_dictionary: has("dictionary.json"), has_cover: has("cover.jpg"),
    first_words: typeof row.first_words === "string" ? row.first_words : null,
    form: typeof row.form === "string" ? row.form : null,
    files: rels.length, imported: now == null ? Date.now() : now, schema_version: row.schema_version || 1,
  };
}

/* Pure: one row -> one book of the job, or {slug, why} when this device may
 * not take it. The payload allowlist and the ceiling are import.js's when the
 * page loaded it (`o.bundle`, else `window.TTSTVBundle`); the app refuses a
 * bad path on its own either way. */
function syncJobBook(row, transport, o) {
  o = o || {};
  var B = o.bundle !== undefined && o.bundle !== null ? o.bundle : global.TTSTVBundle;
  var isPayload = B && typeof B.isPayload === "function" ? B.isPayload : function () { return true; };
  var max = B && typeof B.SCHEMA_MAX === "number" ? B.SCHEMA_MAX : SYNC_SCHEMA_MAX;
  var files = row.files.filter(function (f) { return f && typeof f.rel === "string" && isPayload(f.rel); });
  var rels = files.map(function (f) { return f.rel; });
  // G-DIET, 13 Sep: the book file is `book.meta.json` now (a zip's is still
  // `book.json`), and which one is import.js's answer -- `bookFileOf` -- so
  // the planner never carries a second copy of the name. One line, and the
  // only one in this file that named book.json; the pull planner itself
  // (G-TOPUP's this round) is untouched.
  var bookFileOf = B && typeof B.bookFileOf === "function" ? B.bookFileOf
    : function (r) { return r.indexOf("book.meta.json") >= 0 ? "book.meta.json" : (r.indexOf("book.json") >= 0 ? "book.json" : null); };
  if (!bookFileOf(rels)) return { slug: row.slug, why: "Studio listed no book.meta.json for " + row.slug };
  var v = row.schema_version == null ? 1 : row.schema_version;
  if (typeof v === "number" && v > max) {
    return { slug: row.slug, why: "book.json is schema_version " + v + "; this reader knows up to " + max + " — update the app" };
  }
  return {
    slug: row.slug, hash: row.hash, title: row.title || row.slug,
    meta: syncBookMeta(row, rels, o.now),
    files: files.map(function (f) {
      var out = { rel: f.rel, bytes: typeof f.bytes === "number" ? f.bytes : null };
      if (transport === "drive") out.id = f.id; else out.url = f.url;
      return out;
    }),
  };
}

/* Pure: the job. `rows` are library.json's books (Drive) or the manifest's
 * (LAN), in their order -- the app pulls in this order; `have` is
 * `book_list`'s [{slug, hash}]. One book per slug (the last live row wins). */
function syncJob(transport, auth, rows, have, o) {
  o = o || {};
  var got = {};
  (have || []).forEach(function (b) { if (b && b.slug) got[b.slug + "@" + b.hash] = true; });
  var order = [], bySlug = {};
  (rows || []).forEach(function (r) {
    if (!r || typeof r.slug !== "string" || typeof r.hash !== "string" || r.superseded || !Array.isArray(r.files)) return;
    if (!(r.slug in bySlug)) order.push(r.slug);
    bySlug[r.slug] = r;
  });
  var books = [], refused = [];
  order.forEach(function (slug) {
    var r = bySlug[slug];
    if (got[r.slug + "@" + r.hash]) return;
    var b = syncJobBook(r, transport, o);
    if (b.why) refused.push(b); else books.push(b);
  });
  return { transport: transport, trigger: o.trigger || "press", auth: auth || {}, books: books, refused: refused };
}

/* The credentials, read when the job is handed over (a refresh a moment
 * ago is in them). Drive: this file's own token record, the four names the
 * app takes. LAN: the pairing. */
function syncDriveAuth() {
  var t = syncRead(GOOGLE_TOKEN_KEY) || {};
  return { access: t.access || null, refresh: t.refresh || null, expires: Number(t.expires) || null, clientId: t.clientId || null };
}

/* What this device holds: the door's own list -- the folder the app writes
 * into -- else import.js's (a page with no door has no app pull either). */
function syncHave(o, host) {
  o = o || {};
  if (Array.isArray(o.have)) return Promise.resolve(o.have);
  var door = host && host.books;
  if (door && typeof door.list === "function") return Promise.resolve(door.list()).then(function (r) { return Array.isArray(r) ? r : []; });
  var B = o.bundle || global.TTSTVBundle;
  if (B && typeof B.listInstalled === "function") return Promise.resolve(B.listInstalled(o.href));
  return Promise.resolve([]);
}

/* The press's last step on the phone: plan against what is here, hand the
 * job over. Resolves {handed, refused, status}. `auth` may be a function,
 * read at the moment of the hand-off. */
function syncHandOff(pull, transport, auth, rows, o) {
  o = o || {};
  return syncHave(o, o.host || global.TTSTVHost).then(function (have) {
    var job = syncJob(transport, typeof auth === "function" ? auth() : auth, rows, have, o);
    return Promise.resolve(pull.start(job)).then(function (st) {
      return { handed: job.books.length, refused: job.refused, status: st || null };
    });
  });
}

function whyOf(e) { return String((e && e.message) || e); }

/* The paired Studio's manifest -> a LAN job, or a job whose `why` says
 * Studio did not answer (in `SYNC_LAN_MS`). */
function syncPlanLan(pair, o) {
  var fetchFn = o.fetch || global.fetch;
  var ctl = typeof AbortController === "function" ? new AbortController() : null;
  var timer = ctl ? global.setTimeout(function () { ctl.abort(); }, o.lanMs || SYNC_LAN_MS) : null;
  var url = pair.base + "/sync/manifest?t=" + encodeURIComponent(pair.token);
  return Promise.resolve().then(function () {
    return fetchFn(url, { cache: "no-store", signal: ctl ? ctl.signal : undefined });
  }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }).then(function (man) {
    return syncHave(o, o.host).then(function (have) {
      return syncJob("lan", { base: pair.base, token: pair.token }, (man && man.books) || [], have, o);
    });
  }).catch(function (e) {
    return { transport: "lan", trigger: o.trigger || "press", auth: {}, books: [], why: "Studio not reachable (" + whyOf(e) + ")" };
  }).then(function (job) {
    if (timer) global.clearTimeout(timer);
    return job;
  });
}

/* Drive's library.json -> a Drive job, or a job whose `why` is Drive's refusal. */
function syncPlanDrive(o) {
  var fetchFn = o.fetch || global.fetch;
  var drive = driveClient(function (force) { return googleAccessToken(fetchFn, force); }, fetchFn);
  var folder = driveFolder(drive);
  return folder.open().then(function () { return folder.library(); }).then(function (lib) {
    return syncHave(o, o.host).then(function (have) {
      return syncJob("drive", syncDriveAuth(), lib.books, have, o);
    });
  }).catch(function (e) {
    return { transport: "drive", trigger: o.trigger || "press", auth: {}, books: [], why: whyOf(e) };
  });
}

/* The app's own ask (D2, D4 -- Osca, 11 Sep): nothing when this device is
 * neither signed in nor paired; the paired Studio when it answers, the
 * fastest way; Drive otherwise; and when neither could be read, a job that
 * carries the reason, so the app's status says what was tried. Resolves
 * the job or null. */
function syncPlan(host, o) {
  o = Object.assign({ host: host }, o || {});
  var tok = syncRead(GOOGLE_TOKEN_KEY);
  var signed = !!(tok && tok.refresh && tok.clientId);
  var pair = o.pair !== undefined ? o.pair : syncRead(SYNC_PAIR_KEY);
  var paired = !!(pair && pair.base && pair.token);
  if (!signed && !paired) return Promise.resolve(null);
  return (paired ? syncPlanLan(pair, o) : Promise.resolve(null)).then(function (lan) {
    if (lan && !lan.why) return lan;
    if (!signed) return lan;
    return syncPlanDrive(o);
  });
}

/* `TTSTVHost.sync.auto(trigger)` lands here: leave a running pull alone,
 * else plan and start. Resolves the app's status, or null when there was
 * nothing to ask. Never throws: the app asked, and a page has no one to
 * tell. */
function syncAuto(host, o) {
  o = o || {};
  var pull = syncHostPull(host);
  if (!pull) return Promise.resolve(null);
  return Promise.resolve(pull.status()).then(function (st) {
    if (st && st.running) return st;
    return syncPlan(host, o).then(function (job) {
      if (!job) return null;
      job.trigger = o.trigger || "foreground";
      return pull.start(job);
    });
  }).catch(function () { return null; });
}

global.TTSTVDrive = {
  GOOGLE: GOOGLE, DRIVE: DRIVE, GOOGLE_TOKEN_KEY: GOOGLE_TOKEN_KEY, GOOGLE_REDIRECT_KEY: GOOGLE_REDIRECT_KEY,
  googlePkce: googlePkce, googleAuthUrl: googleAuthUrl, googleRedirectParams: googleRedirectParams,
  googleExchange: googleExchange, googleRefresh: googleRefresh, googleAccessToken: googleAccessToken,
  googleSignInPhone: googleSignInPhone, googleSignOutPhone: googleSignOutPhone, googleAwaitRedirect: googleAwaitRedirect,
  driveClient: driveClient, driveFolder: driveFolder, runDriveSync: runDriveSync,
  syncMergeMarks: syncMergeMarks, syncMergePositions: syncMergePositions, syncMergeSettings: syncMergeSettings,
  // the pull's plan (G-SYNCBG): the job the app runs
  SYNC_PAIR_KEY: SYNC_PAIR_KEY, syncHostPull: syncHostPull, syncBookMeta: syncBookMeta, syncJobBook: syncJobBook,
  syncJob: syncJob, syncDriveAuth: syncDriveAuth, syncHave: syncHave, syncHandOff: syncHandOff,
  syncPlanLan: syncPlanLan, syncPlanDrive: syncPlanDrive, syncPlan: syncPlan, syncAuto: syncAuto,
};
})(typeof window !== "undefined" ? window : globalThis);
