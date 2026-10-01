/* design/reader/account.js -- ONE window.FrankAccount (ASKS #197, integration, 1 Oct 2026).

   Two pages asked the same question -- who is looking? -- and each had written the answer: the Library's seams.js
   (Z1 Z3 Z7 Z17: the shop window's "Sign in to keep this", the creator's link) and Settings ▸ Cloud
   (settings-cloud.js, Z2: the trial line, Buy, your cloud voice). This is the one definition both load, with both
   contracts kept.

     FrankAccount.useSource(read, write)        the back end plugs in here, and nowhere else
       read(cb)   cb(null) = signed out (on the web a BROWSER: they browse, read, listen and search the public shelf),
                  else SERVER-4's GET /entitlement as it is (23f19be, server/entitlement.py):
                  { state: "trial" | "bought" | "expired", days_left, bought_via: "apple" | "paddle" | null,
                    bought_at, trial_ends }   (times in seconds)
       write(kind, detail)   "signin" · "buy" {via: "apple" | "paddle"} -- the source does it, then calls changed()
     FrankAccount.changed()   the truth moved: read again, tell every page that listens
     FrankAccount.on(fn)      -> off()   fn() after every read
     FrankAccount.read(cb) / write(kind, detail)   what a page draws from (Settings ▸ Cloud)
     FrankAccount.fallback(read, write)   a page's own stand-in while no source is plugged in -- Settings' samples on a
                                          /design/ page; a useSource always wins over it
   and what the Library needs on top, reading only the above:
     now()            -> { state: "browser" | "trial" | "bought" | "expired", daysLeft, name }   (name: Settings ▸
                         Account's frank.account -- even a guest has one, #183)
     needsAsk(act)    does this act ask "Sign in to keep this" AFTERWARDS? On the web every act beyond browsing does
                      (Osca, 30 Sep). In the apps a person's marks and shelves are theirs on the device, so only an act
                      that reaches other people or Frank's cloud asks (ZERO-TO-ONE 4.1): share, join, sync, publish,
                      render, follow.
     signIn()         -> Promise<now()>: write("signin"), resolved by the source's changed()
     searchScope()    the web's search before SERVER-3: the public shelf only, and the Surface's line for it

   With no source and no fallback the answer is the first-run gate's own key (ttstv.sync.account, settings.js): a
   Google sign-in there is an account whose days are unknown until /entitlement answers; "Not now" or nothing is
   signed out. */
(function () {
  "use strict";
  var W = window;
  if (W.FrankAccount && W.FrankAccount.one) return;
  function json(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function isWeb() { return !!(W.TTSTVHost && W.TTSTVHost.isWeb); }
  var CLOUD_ACTS = { share: 1, join: 1, sync: 1, publish: 1, render: 1, follow: 1 };
  var S = { read: null, write: null }, FB = { read: null, write: null }, val, subs = [];
  function gate(cb) { var a = json("ttstv.sync.account", null); cb(a && a.kind === "google" ? { state: "trial", days_left: null } : null); }
  function reader() { return S.read || FB.read || gate; }
  function pull() {
    try { reader()(function (v) { val = v || null; subs.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }); }
    catch (e) { val = null; }
  }
  var A = {
    one: true,
    useSource: function (read, write) { S.read = read || null; S.write = write || null; pull(); return A; },
    source: function () { return S.read || S.write ? { read: S.read, write: S.write } : null; },
    fallback: function (read, write) { FB.read = read || null; FB.write = write || null; if (!S.read) pull(); return A; },
    changed: function () { pull(); },
    on: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
    read: function (cb) { reader()(function (v) { val = v || null; cb(v || null); }); },
    write: function (kind, detail) { var w = S.write || FB.write; return w ? w(kind, detail) : undefined; },
    canWrite: function () { return !!(S.write || FB.write); },
    now: function () {
      if (val === undefined) pull();
      var v = val, g = json("frank.account", null), name = (g && g.name) || "";
      return v ? { state: v.state || "trial", daysLeft: v.days_left == null ? null : v.days_left, name: name }
               : { state: "browser", daysLeft: null, name: name };
    },
    needsAsk: function (act) {
      var s = A.now().state;
      if (s === "trial" || s === "bought") return false;
      if (isWeb()) return true;
      return !!CLOUD_ACTS[act];
    },
    signIn: function () {
      return new Promise(function (ok, no) {
        if (!A.canWrite()) { no(new Error("Signing in needs Frank's server, which isn't up yet. Everything you did stays on this page until you close it.")); return; }
        var done = false, off = A.on(function () { if (!done && val) { done = true; off(); ok(A.now()); } });
        function bad(e) { if (done) return; done = true; off(); no(e instanceof Error ? e : new Error(String(e || "Google didn't answer."))); }
        try { var r = A.write("signin", {}); if (r && typeof r.then === "function") r.then(null, bad); } catch (e) { bad(e); }
        setTimeout(function () { bad(new Error("Google didn't answer in time.")); }, 90000);
      });
    },
    searchScope: function () {
      return isWeb() && A.now().state === "browser" ? { scope: "public-shelf", line: "Searching Frank's public shelf.", none: "Nothing on Frank's public shelf for that." }
                                                    : { scope: "all", line: "", none: "" };
    }
  };
  W.FrankAccount = A;
})();
