/* SETTINGS ▸ CLOUD -- FRANK'S CLOUD, REDRAWN (ZERO-TO-ONE-FOR-DESIGN Z2, DESIGN 1 Oct; PAY §7.2, §7.4 (5), §7.7;
   ZERO-TO-ONE §4.2-§4.4). Replaces the old Cloud tab (Kaggle, a Modal id field, Frank's card): none of them is here.
   One tab, on every host (the Mac's Cloud tab is redrawn in place; the web and the phone get the tab after Account):
     FRANK            the trial line, in the plan's words -- "19 days of your four weeks left" · "Frank is yours" ·
                      "Your four weeks are over — everything you made is still here" -- and Buy: £29 once, handed to
                      Apple's sheet on the iPhone and Paddle's overlay on the Mac and the web (the button and the
                      hand-off are drawn, never a payment form: Frank never sees the number)
     YOUR CLOUD VOICE "Get your free cloud voice": Continue with Google -> the cloud's own card page in a sheet -> done;
                      then the card "Your cloud account · owner: you · Frank: manager", this month's hours against the
                      free allotment (about 12 h), Open and Take over; used up (what still works), taken over, failure
   THE TWO SEAMS (the Layers.useSource pattern, design/reader/layers.js). Nothing here knows a route:
     FrankAccount.useSource(read, write)
       read(cb)   cb(null) = signed out, else SERVER-4's GET /entitlement as it is (23f19be, server/entitlement.py):
                  { state: "trial" | "bought" | "expired", days_left, bought_via: "apple" | "paddle" | null,
                    bought_at, trial_ends }   (times in seconds)
       write(kind, detail)   "buy" {via: "apple" | "paddle"} · "signin"
     FrankCloud.useSource(read, write)
       read(cb)   cb({ state: "none" | "making" | "ready" | "usedup" | "takenover" | "failed",
                       step: "google" | "card",                     (making)
                       month: { audio_s, month: "2026-10" },         (GET /usage's shape, SERVER-4)
                       allot_s: 43200, resets_at,                    (the free allotment, PAY §7.5: ~12 h)
                       error: { what, why } })                       (failed)
       write(kind, detail)   "connect" · "card" (the sheet came back done) · "open" · "takeover" · "handback" ·
                             "retry" · "cancel"
     After a write, or whenever the truth moves, the source calls FrankAccount.changed() / FrankCloud.changed().
   Until SERVER-4 (landed) and CLOUD-PERUSER (not landed) plug in, a page under /design/ reads SAMPLES (below), picked
   by the URL (?state=… on the frame, or the canvas's own ?view&page=settings&state=…) or by the bench strip at the foot
   of the tab; a shipped page with no source draws "signed out" and "no cloud yet", which are true for a stranger.
   EXPORT: settings/settings.js builds this panel (buildCloudPanel), the sources become the app's /me + /usage and
   CLOUD-PERUSER's workspace route; the bench strip and the samples stay behind (they are /design/ only). */
(function () {
  "use strict";
  if (window.FrankCloud) return;
  var R = document.documentElement;
  var DESIGN = /\/design\//.test(location.pathname);
  var DAY = 86400, ALLOT = 12 * 3600;
  function host() { return R.hasAttribute("data-phone") ? "phone" : R.hasAttribute("data-mac-window") ? "mac" : "web"; }
  function via() { return host() === "phone" ? "apple" : "paddle"; }

  /* ------------------------------------------------------------ THE SAMPLES (design only) */
  var NOW = Date.UTC(2026, 9, 1, 12) / 1000;   /* 1 Oct 2026, the day this was drawn */
  var ACCTS = {
    signedout: null,
    trial:     { state: "trial", days_left: 19, bought_via: null, bought_at: null, trial_ends: NOW + 19 * DAY },
    trial6:    { state: "trial", days_left: 6, bought_via: null, bought_at: null, trial_ends: NOW + 6 * DAY },
    trial1:    { state: "trial", days_left: 1, bought_via: null, bought_at: null, trial_ends: NOW + 1 * DAY },
    bought:    { state: "bought", days_left: null, bought_via: "apple", bought_at: NOW - 2 * DAY, trial_ends: NOW + 17 * DAY },
    expired:   { state: "expired", days_left: 0, bought_via: null, bought_at: null, trial_ends: NOW - 3 * DAY }
  };
  var RESETS = Date.UTC(2026, 10, 1) / 1000;
  var CLOUDS = {
    none:      { state: "none" },
    making:    { state: "making", step: "card" },
    ready:     { state: "ready", month: { audio_s: 3 * 3600 + 12 * 60, month: "2026-10" }, allot_s: ALLOT, resets_at: RESETS },
    usedup:    { state: "usedup", month: { audio_s: ALLOT, month: "2026-10" }, allot_s: ALLOT, resets_at: RESETS },
    takenover: { state: "takenover", month: null, allot_s: ALLOT, resets_at: RESETS },
    failed:    { state: "failed", error: { what: "Your cloud account wasn't made.", why: "The cloud's page closed before a card was added." } }
  };
  /* one word in the URL is a whole situation a person can meet; acct= and cloud= pick the two halves apart */
  var STATES = {
    signedout: ["signedout", "none"], trial: ["trial", "none"], trial6: ["trial6", "none"], trial1: ["trial1", "none"],
    bought: ["bought", "none"], expired: ["expired", "none"], none: ["bought", "none"],
    buy: ["trial", "none", "buy"], making: ["bought", "making", "sheet"], ready: ["bought", "ready"], usedup: ["bought", "usedup"],
    takeover: ["bought", "ready", "confirm"], takenover: ["bought", "takenover"], failed: ["bought", "failed"]
  };
  function param(k) {
    var v = new URLSearchParams(location.search).get(k);
    if (v == null) { try { if (window.parent !== window && /[?&]page=settings\b/.test(parent.location.search)) v = new URLSearchParams(parent.location.search).get(k); } catch (e) {} }
    return v;
  }
  var pick = STATES[param("state")] || null;
  var SAMPLE = { acct: (pick && pick[0]) || param("acct") || "trial", cloud: (pick && pick[1]) || param("cloud") || "none" };
  var OPEN = (pick && pick[2]) || null;   /* a sheet the state opens with: buy · sheet · confirm */
  if (!(SAMPLE.acct in ACCTS)) SAMPLE.acct = "trial";
  if (!(SAMPLE.cloud in CLOUDS)) SAMPLE.cloud = "none";
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  var sampleAcct = {
    read: function (cb) { cb(clone(ACCTS[SAMPLE.acct])); },
    write: function (kind, d) {
      if (kind === "buy") SAMPLE.acct = "bought";
      if (kind === "signin") SAMPLE.acct = "trial";
      if (kind === "buy" || kind === "signin") ACCTS.bought.bought_via = (d && d.via) || via();
      FA.changed();
    }
  };
  var sampleCloud = {
    read: function (cb) { cb(clone(CLOUDS[SAMPLE.cloud])); },
    write: function (kind) {
      var to = { connect: "making", card: "ready", takeover: "takenover", handback: "ready", retry: "making", cancel: "none" }[kind];
      if (kind === "card" && SAMPLE.cloud !== "making") to = null;
      if (to) SAMPLE.cloud = to;
      Cloud.changed();
    }
  };

  /* ------------------------------------------------------------ THE SEAMS */
  function seam(sample) {
    var S = { read: null, write: null };
    var api = {
      useSource: function (read, write) { S.read = read || null; S.write = write || null; api.changed(); },
      read: function (cb) { if (S.read) S.read(cb); else if (DESIGN) sample.read(cb); else cb(api.empty); },
      write: function (kind, d) { if (S.write) S.write(kind, d); else if (DESIGN) sample.write(kind, d); },
      changed: function () { draw(); }
    };
    return api;
  }
  /* THE ACCOUNT IS THE ONE FrankAccount (design/reader/account.js, loaded before this file by settings-look.js): the
     Library asks the same seam. On a /design/ page the samples stand in until a source is plugged in. */
  var FA = window.FrankAccount;
  if (!FA || !FA.one) { console.warn("[settings-cloud] account.js did not load first"); return; }
  if (DESIGN) FA.fallback(sampleAcct.read, sampleAcct.write);
  var Account = { read: function (cb) { FA.read(cb); }, write: function (kind, d) { FA.write(kind, d); } };
  FA.on(function () { draw(); });
  var Cloud = seam(sampleCloud); Cloud.empty = { state: "none" };

  /* ------------------------------------------------------------ WORDS */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function day(t) { var d = new Date(t * 1000); return d.getUTCDate() + " " + MON[d.getUTCMonth()]; }
  function hm(s) { s = Math.max(0, Math.round(s / 60)); var h = Math.floor(s / 60), m = s % 60; return h ? (m ? h + " h " + m + " m" : h + " h") : m + " m"; }
  function daysLine(n) { return n == null ? "Your four weeks have started" : n + (n === 1 ? " day" : " days") + " of your four weeks left"; }
  var PRICE = "£29";

  /* ------------------------------------------------------------ THE TAB */
  var CLOUD_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7.2 18.5h10.1a3.9 3.9 0 0 0 .5-7.8 5.6 5.6 0 0 0-10.8-1.2A4.5 4.5 0 0 0 7.2 18.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var panel = null, body = null, own = false;
  function mount() {
    var strip = document.querySelector(".set-tabs"), gen = document.querySelector('.set-panel[data-tab="general"]');
    if (!strip || !gen) return false;
    var tab = strip.querySelector('.set-tab[data-tab="cloud"]');
    if (!tab) {
      /* the web and the phone: a tab of ours, after Account (settings-look.js draws Account; wait for it) */
      var acct = strip.querySelector('.set-tab[data-tab="account"]'); if (!acct) return false;
      tab = document.createElement("button"); tab.type = "button"; tab.className = "set-tab"; tab.setAttribute("data-tab", "cloud");
      tab.setAttribute("role", "tab"); tab.setAttribute("aria-selected", "false");
      tab.innerHTML = CLOUD_ICON + "<span>Cloud</span><span class=\"set-sub\">Frank's cloud</span>";
      strip.insertBefore(tab, acct.nextSibling); own = true;
    }
    panel = document.querySelector('.set-panel[data-tab="cloud"]');
    if (!panel) {
      panel = document.createElement("div"); panel.className = "set-panel"; panel.setAttribute("data-tab", "cloud");
      panel.setAttribute("role", "tabpanel"); panel.hidden = true; gen.parentNode.appendChild(panel); own = true;
    }
    /* the Mac's Cloud panel is settings.js's (Kaggle, Modal, Frank's card): every child of it steps aside for ours */
    panel.classList.add("zc-on");
    body = panel.querySelector(":scope > .zc");
    if (!body) { body = document.createElement("div"); body.className = "zc"; panel.appendChild(body); }
    draw();
    return true;
  }
  function showOurs(on) {
    if (!own || !panel) return;
    var tab = document.querySelector('.set-tab[data-tab="cloud"]');
    if (on) {
      [].forEach.call(document.querySelectorAll(".set-panel[data-tab]"), function (x) { x.hidden = x !== panel; });
      [].forEach.call(document.querySelectorAll(".set-tab[data-tab]"), function (x) { x.setAttribute("aria-selected", x === tab ? "true" : "false"); });
      var m = document.querySelector("main"); if (m) m.scrollTop = 0;
    } else { panel.hidden = true; if (tab) tab.setAttribute("aria-selected", "false"); }
  }
  /* a press on a tab: Cloud is ours on the web and the phone (settings.js has no panel by that name), every other
     tab is settings.js's (or Account's) and ours steps aside -- the same handshake Account makes */
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".set-tab[data-tab]"); if (!t || !own) return;
    if (t.getAttribute("data-tab") === "cloud") { e.stopPropagation(); showOurs(true); }
    else showOurs(false);
  }, true);
  function goTab(id) { var t = document.querySelector('.set-tab[data-tab="' + id + '"]'); if (t) t.click(); }

  /* ------------------------------------------------------------ THE DRAWING */
  var A = null, C = null, drawing = false, again = false;
  function draw() {
    if (!body) return;
    if (drawing) { again = true; return; }
    drawing = true;
    Account.read(function (a) {
      Cloud.read(function (c) {
        A = a; C = c || { state: "none" }; drawing = false;
        if (again) { again = false; return draw(); }
        body.innerHTML = frank(A) + cloud(A, C) + bench();
        wire();
        if (C.state === "failed") failure();
        if (OPEN) { var o = OPEN; OPEN = null; if (o === "buy") buy(); else if (o === "sheet") sheet(); else if (o === "confirm") confirmTakeover(); }
      });
    });
  }
  function row(name, small, ctl, cls) {
    return '<div class="set-row' + (cls ? " " + cls : "") + '"><div class="set-l"><div class="set-name">' + name + "</div>"
      + (small ? "<small>" + small + "</small>" : "") + "</div>" + (ctl ? '<div class="set-c">' + ctl + "</div>" : "") + "</div>";
  }
  function btn(act, label, primary) { return '<button type="button" class="kag-btn' + (primary ? " kag-primary" : "") + '" data-zc="' + act + '">' + label + "</button>"; }
  function frank(a) {
    var s = '<div class="set-head">Frank</div><div class="set-card zc-frank" data-zc-acct="' + (a ? a.state : "signedout") + '">';
    if (!a) s += row("Your four weeks start when you sign in", "Reading, listening with the device voice and the shared library need no account.", btn("signin", "Sign in", true), "zc-line");
    else if (a.state === "trial") s += row(esc(daysLine(a.days_left)), (a.days_left != null && a.days_left <= 7
        ? "When they end, your books, notes and the device voice keep working. Buying Frank keeps your cloud voice."
        : "Everything works while you try it.") + " Buy Frank once and it's yours on every Mac and iPhone you own — no subscription, updates free.",
        btn("buy", "Buy Frank · " + PRICE, true), "zc-line");
    else if (a.state === "bought") s += row("Frank is yours", "Bought " + day(a.bought_at) + (a.bought_via === "apple" ? " through the App Store" : a.bought_via === "paddle" ? " on Frank's site" : "")
        + ". It's yours on every Mac and iPhone you sign in to. Updates are free.", "", "zc-line");
    else s += row("Your four weeks are over — everything you made is still here", "Your books, notes, your place and the device voice all keep working. Buy Frank once to use your cloud voice again.",
        btn("buy", "Buy Frank · " + PRICE, true), "zc-line");
    return s + "</div>";
  }
  function meter(c) {
    var used = (c.month && c.month.audio_s) || 0, of = c.allot_s || ALLOT, pc = Math.min(100, Math.round(used / of * 100));
    var line = c.state === "usedup" ? hm(of) + " of about " + hm(of) + " — this month's free hours are used" : hm(used) + " of about " + hm(of) + " free";
    return row("This month", esc(line) + '<i class="zc-bar" role="meter" aria-valuemin="0" aria-valuemax="' + of + '" aria-valuenow="' + Math.min(used, of) + '" aria-label="Cloud voice used this month"><b style="width:' + pc + '%"></b></i>'
      + "<span class=\"zc-sub\">Free hours start again on " + day(c.resets_at || RESETS) + ".</span>", "", "zc-meter");
  }
  function cloud(a, c) {
    var s = '<div class="set-head">Your cloud voice</div><div class="set-card zc-cloud" data-zc-cloud="' + esc(c.state) + '">';
    var can = a && a.state !== "expired";
    if (c.state === "none") {
      if (!a) s += row("Get your free cloud voice", "Frank's own voice, reading any book, about 12 hours a month, free. Sign in first: it comes with your account.", "", "zc-get");
      else if (!can) s += row("Get your free cloud voice", "It comes with Frank once you buy it: about 12 hours a month of Frank's own voice, free, every month.", "", "zc-get");
      else s += row("Get your free cloud voice", "About 12 hours a month of Frank's own voice, free, every month, in a cloud account that is yours. You add a card on the cloud's own page — it's capped at the free hours, so it never charges you unless you raise the limit.",
        btn("connect", "Continue with Google", a.state === "bought"), "zc-get");
    } else if (c.state === "making") {
      var card = c.step !== "google";
      s += row("Making your cloud account", "Frank never sees your card number.", "", "zc-making")
        + '<ol class="zc-steps"><li class="' + (card ? "done" : "now") + '"><b>Google</b><span>' + (card ? "Signed in" : "Signing in…") + "</span></li>"
        + '<li class="' + (card ? "now" : "") + '"><b>A card, on the cloud\'s page</b><span>Capped at the free hours</span></li>'
        + "<li><b>Ready</b><span>Frank sets the voice up for you</span></li></ol>"
        + row("", "", btn("sheet", "Open the cloud's page", true) + btn("cancel", "Not now"), "zc-acts");
    } else if (c.state === "ready" || c.state === "usedup") {
      s += row("Your cloud account", "owner: you · Frank: manager", "", "zc-acct") + meter(c);
      if (c.state === "usedup") s += row("Until " + day(c.resets_at || RESETS), "The device voice reads every book, and the render library plays every voice already made. Want more this month? Raise the limit in your cloud account: the cloud charges you at its own rate, and Frank takes nothing.", "", "zc-still");
      s += row("", "", btn("open", c.state === "usedup" ? "Open · raise the limit" : "Open") + btn("takeover", "Take over"), "zc-acts");
    } else if (c.state === "takenover") {
      s += row("Your cloud account", "owner: you · Frank no longer manages it", "", "zc-acct")
        + row("You run it now", "Frank still sends your renders there, but it can't update the voice or read your hours. Hand it back any time.", "", "zc-still")
        + row("", "", btn("open", "Open") + btn("handback", "Let Frank manage it"), "zc-acts");
    } else if (c.state === "failed") {
      s += '<div class="zc-fail"></div>';
    }
    return s + "</div>";
  }
  function failure() {
    var slot = body.querySelector(".zc-fail"); if (!slot) return;
    var e = (C && C.error) || {};
    var o = { kind: "Your cloud voice", what: e.what || "Your cloud account wasn't made.", why: e.why || "", fix: "Try again", onFix: function () { act("retry"); } };
    var n = 0;
    (function t() {
      if (window.TellFrank && TellFrank.failure) { slot.innerHTML = ""; slot.appendChild(TellFrank.failure(o)); return; }
      if (n++ < 15) return setTimeout(t, 100);
      /* no Tell Frank on this page: the same card, by hand (the line is never missing) */
      slot.innerHTML = '<div class="tf-fail" role="alert"><div class="tf-k">' + esc(o.kind) + '</div><p class="tf-what">' + esc(o.what) + '</p><p class="tf-why">' + esc(o.why)
        + '</p><div class="tf-row"><button type="button" class="tf-tell">Tell Frank</button><button type="button" class="tf-fix" data-zc="retry">Try again</button></div></div>';
      wire();
      var tell = slot.querySelector(".tf-tell");
      tell.addEventListener("click", function () { if (window.TellFrank) TellFrank.open({ about: o.kind + ": " + o.what + (o.why ? " — " + o.why : ""), kind: "failure" }); });
    })();
  }

  /* the bench: a person never sees it -- only a /design/ page, to walk every state without a server */
  function bench() {
    if (!DESIGN) return "";
    function chips(k, list) {
      return list.map(function (x) { return '<button type="button" data-zc-bench="' + k + ":" + x[0] + '" aria-pressed="' + (SAMPLE[k] === x[0]) + '">' + x[1] + "</button>"; }).join("");
    }
    return '<div class="zc-bench" aria-label="Sample states (design only)"><div class="zc-bench-k">Sample · design only</div>'
      + '<div class="zc-bench-r"><span>Account</span>' + chips("acct", [["signedout", "signed out"], ["trial", "trial 19"], ["trial6", "trial 6"], ["trial1", "trial 1"], ["bought", "bought"], ["expired", "expired"]]) + "</div>"
      + '<div class="zc-bench-r"><span>Cloud</span>' + chips("cloud", [["none", "no cloud"], ["making", "making it"], ["ready", "ready"], ["usedup", "used up"], ["takenover", "taken over"], ["failed", "failure"]]) + "</div></div>";
  }

  /* ------------------------------------------------------------ THE PRESSES */
  function act(kind) {
    if (kind === "signin") { Account.write("signin"); goTab("account"); return; }
    if (kind === "buy") { buy(); return; }
    if (kind === "connect") { Cloud.write("connect"); sheet(); return; }
    if (kind === "sheet") { sheet(); return; }
    if (kind === "takeover") { confirmTakeover(); return; }
    if (kind === "open") { Cloud.write("open"); handoff("open"); return; }
    Cloud.write(kind);
  }
  function wire() {
    [].forEach.call(body.querySelectorAll("[data-zc]"), function (b) {
      if (b.__zc) return; b.__zc = 1;
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); act(b.getAttribute("data-zc")); });
    });
    [].forEach.call(body.querySelectorAll("[data-zc-bench]"), function (b) {
      if (b.__zc) return; b.__zc = 1;
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var kv = b.getAttribute("data-zc-bench").split(":"); SAMPLE[kv[0]] = kv[1]; draw();
      });
    });
  }

  /* THE HAND-OFFS: the place a press leaves Frank. Each is a sheet over Settings holding the other party's page,
     drawn as its frame and an empty room -- never a form. What Frank says sits under it. */
  var sheetEl = null;
  /* while a sheet is up on the phone the band steps aside (html[data-sheet], as the Surface and Settings' find do --
     band.css; the canvas mirrors the flag), so the sheet's foot is not under the foot row */
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; R.removeAttribute("data-zc-sheet"); if (host() === "phone") R.removeAttribute("data-sheet"); } }
  function up(kind) { R.setAttribute("data-zc-sheet", kind); if (host() === "phone") R.setAttribute("data-sheet", ""); }
  function handoff(kind) {
    closeSheet();
    var ph = host() === "phone";
    var K = {
      apple:  { addr: "App Store", room: "Apple's purchase sheet", what: "Frank · " + PRICE + " · one purchase", say: "Apple asks you to confirm. Frank is yours on every Mac and iPhone you sign in to.", ok: "Bought", no: "Closed without buying" },
      paddle: { addr: "checkout.paddle.com", room: "The checkout, over this page", what: "Frank · " + PRICE + " once", say: "The checkout takes the card and the VAT. Frank never sees the number.", ok: "Paid", no: "Closed without paying" },
      cloud:  { addr: "modal.com", room: "The cloud's own page", what: "Continue with Google, then add a card", say: "Your card is capped at the free hours, so it never charges you unless you raise the limit. Frank never sees the number.", ok: "Card added", no: "Closed before the card" },
      open:   { addr: "modal.com", room: "Your cloud account, on the cloud's own page", what: "You are its owner", say: "Usage, the limit and your card live there.", ok: "", no: "" }
    }[kind];
    sheetEl = document.createElement("div"); sheetEl.className = "zc-sheet" + (ph ? " zc-sheet-ph" : "") + " zc-" + kind;
    sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true"); sheetEl.setAttribute("aria-label", K.room);
    sheetEl.innerHTML = '<div class="zc-scrim" data-zcs="close"></div><div class="zc-frame">'
      + '<div class="zc-addr"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></svg><span>' + esc(K.addr) + "</span>"
      + '<button type="button" class="zc-x" data-zcs="close" aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>'
      + '<div class="zc-room"><b>' + esc(K.room) + "</b><span>" + esc(K.what) + "</span></div>"
      + '<p class="zc-say">' + esc(K.say) + "</p>"
      + (DESIGN && K.ok ? '<div class="zc-bench zc-bench-in"><div class="zc-bench-k">Sample · design only</div><div class="zc-bench-r"><button type="button" data-zcs="ok">' + esc(K.ok) + '</button><button type="button" data-zcs="close">' + esc(K.no) + "</button></div></div>" : "")
      + "</div>";
    document.body.appendChild(sheetEl); up(kind);
    sheetEl.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-zcs]"); if (!t) return;
      e.preventDefault(); e.stopPropagation();
      var w = t.getAttribute("data-zcs"); closeSheet();
      if (w === "ok" && (kind === "apple" || kind === "paddle")) Account.write("buy", { via: kind });
      if (w === "ok" && kind === "cloud") Cloud.write("card");
    });
    var x = sheetEl.querySelector(".zc-x"); setTimeout(function () { try { x.focus(); } catch (e) {} }, 0);
  }
  function buy() { handoff(via()); }
  function sheet() { handoff("cloud"); }
  /* TAKE OVER asks once, in words: what changes and what does not */
  function confirmTakeover() {
    closeSheet();
    sheetEl = document.createElement("div"); sheetEl.className = "zc-sheet zc-confirm" + (host() === "phone" ? " zc-sheet-ph" : "");
    sheetEl.setAttribute("role", "alertdialog"); sheetEl.setAttribute("aria-modal", "true"); sheetEl.setAttribute("aria-label", "Take over your cloud account?");
    sheetEl.innerHTML = '<div class="zc-scrim" data-zcs="close"></div><div class="zc-frame">'
      + "<h2>Take over your cloud account?</h2>"
      + '<p class="zc-say">Frank stops managing it: it won\'t update the voice or watch your hours. Your renders keep working, and you can hand it back any time.</p>'
      + '<div class="zc-two"><button type="button" class="kag-btn" data-zcs="close">Cancel</button><button type="button" class="kag-btn kag-primary" data-zcs="ok">Take over</button></div></div>';
    document.body.appendChild(sheetEl); up("confirm");
    sheetEl.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-zcs]"); if (!t) return;
      e.preventDefault(); e.stopPropagation();
      var ok = t.getAttribute("data-zcs") === "ok"; closeSheet(); if (ok) Cloud.write("takeover");
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetEl) { e.preventDefault(); e.stopImmediatePropagation(); closeSheet(); } }, true);

  window.FrankCloud = { useSource: Cloud.useSource, changed: Cloud.changed, open: function () { goTab("cloud"); },
    now: function () { return { account: clone(A), cloud: clone(C), sample: DESIGN ? clone(SAMPLE) : null }; } };

  /* mounted, and the look has laid General out (it opens General itself) -- then a state in the address opens Cloud */
  var n = 0; (function wait() {
    var ok = mount() && (!window.SettingsLook || document.querySelector(".look-appear"));
    if (!ok && n++ < 100) return setTimeout(wait, 100);
    if (pick || param("tab") === "cloud") setTimeout(function () { goTab("cloud"); }, 0);
  })();
  /* the Mac's settings.js redraws its strip after load: our tab comes back if a redraw drops it */
  new MutationObserver(function () {
    var s = document.querySelector(".set-tabs");
    if (s && panel && !s.querySelector('.set-tab[data-tab="cloud"]') && s.querySelector('.set-tab[data-tab="account"]')) { own = false; mount(); }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
