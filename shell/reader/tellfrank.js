/* TELL FRANK — the design master (ASKS #134-#137; Osca, 29 Sep: "Frank 1.0 ships with a way to report what went wrong,
   like the thumbs-down in Claude's apps"). One file every page loads; three things:

   TellFrank.open({about, kind})   the sheet: one text field; exactly what will be sent (the build, the page, where in
                                   the book, what it is about) and two ticks, off, for the recent log and a picture of
                                   the screen; SEND, then a quiet SENT and nothing else. Esc or a press outside closes.
   TellFrank.thumb(el, about)      a small thumbs-down at the end of something Frank made; a press opens the sheet
                                   already about it. Put on automatically: a search answer (.sf-row), a dictionary card
                                   (.lookupcard), a parse (the book view's card, #bkvInfo), a render (the Surface's
                                   studio card, .sf-card), a translation line (a paragraph in a book's second language).
   TellFrank.failure(o)            a failure card: what happened (the serif), why (one line), the one fix (a capsule),
                                   and TELL FRANK under it, already about the failure.

   Where it lives (every host): ⌥⌘T anywhere (Alt+Ctrl+T off a Mac); the Mac's Help menu, "Tell Frank…" (the native
   menu is the Mac lane's at EXPORT; this file answers the menu's event `frank:tell`); Settings ▸ General, a "Tell
   Frank" row on the web and the phone; on the phone, shake. Sent reports go to Frank's server at EXPORT; in band they
   are kept in this origin's localStorage `frank.reports`, which Osca's reports page (reports.html) reads. */
(function () {
  "use strict";
  if (window.TellFrank) return;
  var R = document.documentElement, KEY = "frank.reports", REPORT_URL = "/report";   /* Frank's server route (EXPORT: the back end's, ASKS #137) */
  /* the recent log: the last 60 console warnings and errors, and uncaught errors, kept from the moment the page loads */
  var LOG = [];
  function keep(level, args) {
    try { LOG.push(new Date().toISOString().slice(11, 19) + " " + level + " " + [].map.call(args, function (a) { return a && a.stack ? a.stack.split("\n")[0] : typeof a === "object" ? JSON.stringify(a) : String(a); }).join(" ")); } catch (e) {}
    if (LOG.length > 60) LOG.shift();
  }
  ["warn", "error"].forEach(function (l) { var o = console[l]; console[l] = function () { keep(l, arguments); return o.apply(console, arguments); }; });
  addEventListener("error", function (e) { keep("error", [e.message + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno]); });
  addEventListener("unhandledrejection", function (e) { keep("error", ["unhandled: " + (e.reason && e.reason.message || e.reason)]); });

  function host() { return R.hasAttribute("data-phone") ? "iPhone" : R.hasAttribute("data-web") || (window.TTSTVHost && TTSTVHost.isWeb) ? "the web" : "Mac"; }
  function build() {
    var s = document.getElementById("build-stamp");
    return (s && s.textContent.trim()) || (window.TTSTVHost && TTSTVHost.build) || "band (design)";
  }
  function page() {
    var p = location.pathname.split("/").pop().replace(/\.html$/, "") || "library";
    var names = { library: "the Library", reader: "a book", settings: "Settings", float: "the float", "settings-module": "Settings" };
    var sheet = document.querySelector(".sf.on") ? " · the search sheet" : "";
    var one = document.querySelector(".wordview.on") ? " · one word" : "";
    return (names[p] || p) + one + sheet + " · " + host();
  }
  function where() {
    var t = document.querySelector(".band-head b, .band-pill b, #bkvCap b");
    var title = t && t.textContent.trim();
    if (!title) { var m = /[?&]book=books%2F([^&]+)/.exec(location.search); title = m ? decodeURIComponent(m[1]).replace(/-/g, " ") : ""; }
    if (!title) return "";
    var ch = document.querySelector(".band-head i, .band-pill i, #readerhead");
    var c = ch ? ch.textContent.trim() : "";
    if (window.Band && Band.chapterLabel) c = Band.chapterLabel(c);
    return title + (c ? " · " + c : "");
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var open_ = null;
  function close() {
    if (!open_) return; var o = open_; open_ = null;
    o.sheet.classList.remove("on"); o.scrim.classList.remove("on"); R.removeAttribute("data-tf");
    setTimeout(function () { o.sheet.remove(); o.scrim.remove(); }, 180);
    document.removeEventListener("keydown", o.esc, true);
  }
  function open(o) {
    /* a sheet saying SENT is not wiped by another open (a page re-readied while it lingers): the confirmation stays */
    if (open_ && open_.hold) return open_.sheet;
    o = o || {}; close();
    var scrim = el("div", "tf-scrim"), sheet = el("div", "tf"); sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Tell Frank");
    sheet.appendChild(el("h2", null, "Tell Frank"));
    var ta = el("textarea"); ta.setAttribute("aria-label", "What happened"); ta.placeholder = o.about ? "What was wrong with it?" : "What happened?";
    sheet.appendChild(ta);
    sheet.appendChild(el("p", "tf-sent-h", "Sent with it"));
    var dl = el("dl"), facts = [["Build", build()], ["Page", page()]];
    var w = where(); if (w) facts.push(["Where", w]);
    if (o.about) facts.push(["About", o.about]);
    facts.forEach(function (f) { dl.appendChild(el("dt", null, f[0])); dl.appendChild(el("dd", null, f[1])); });
    sheet.appendChild(dl);
    function tick(label) { var l = el("label", "tf-opt"), c = el("input"); c.type = "checkbox"; l.appendChild(c); l.appendChild(document.createTextNode(label)); sheet.appendChild(l); return c; }
    var logBox = tick("Frank's recent log (" + LOG.length + (LOG.length === 1 ? " line)" : " lines)"));
    var picBox = tick("A picture of this screen");
    var acts = el("div", "tf-acts"), cancel = el("button", "tf-cancel", "Cancel"), send = el("button", "tf-send", "Send");
    cancel.type = send.type = "button"; send.disabled = true;
    acts.appendChild(cancel); acts.appendChild(send); sheet.appendChild(acts);
    ta.addEventListener("input", function () { send.disabled = !ta.value.trim(); });
    cancel.addEventListener("click", close); scrim.addEventListener("click", close);
    send.addEventListener("click", function () {
      var rep = { id: Date.now().toString(36), at: new Date().toISOString(), text: ta.value.trim(), kind: o.kind || (o.about ? "about" : "report"),
                  build: build(), page: page(), where: w, about: o.about || "", log: logBox.checked ? LOG.slice() : null,
                  picture: picBox.checked ? "(a picture of the screen, taken at send)" : null, replies: [] };
      try { document.dispatchEvent(new CustomEvent("frank:report", { detail: rep })); } catch (e) {}
      /* NEVER A SILENT PRESS (ASKS #187, the web Stranger: "Send makes 0 requests and says nothing"). The report goes to
         Frank's server (POST /report, 4 s at most); the sheet says SENT, large enough to be read, either way. It is
         kept in this browser too (Osca's reports page reads it); only when it truly could not be sent does one more
         line say so -- "Kept here until Frank is online." -- and the report is marked to go later. */
      while (sheet.firstChild) sheet.firstChild.remove();
      if (open_) open_.hold = true;
      var done = el("p", "tf-done", "Sending…"); done.setAttribute("role", "status"); sheet.appendChild(done);
      var keep = function (pending) { if (pending) rep.pending = true; try { var all = JSON.parse(localStorage.getItem(KEY) || "[]"); all.push(rep); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} };
      var finish = function (ok) {
        keep(!ok);
        done.textContent = "Sent"; sheet.setAttribute("data-sent", ok ? "sent" : "kept");
        if (!ok) sheet.appendChild(el("p", "tf-kept", "Kept here until Frank is online."));
        setTimeout(close, ok ? 1600 : 2600);
      };
      var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
      var p = window.fetch ? fetch(REPORT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rep), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.ok; }) : Promise.resolve(false);
      p.catch(function () { return false; }).then(function (ok) { clearTimeout(t); finish(!!ok); });
    });
    var esc = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", esc, true);
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    open_ = { sheet: sheet, scrim: scrim, esc: esc };
    R.setAttribute("data-tf", "");   /* the band steps aside while the sheet is up (band.css) -- nothing sits over Send */
    requestAnimationFrame(function () { scrim.classList.add("on"); sheet.classList.add("on"); try { ta.focus({ preventScroll: true }); } catch (e) {} });
    return sheet;
  }

  var THUMB = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 2.8h6.1c.6 0 1.1.4 1.2 1l.9 5.1c.1.7-.4 1.3-1.1 1.3H9.1l.5 2.4c.1.7-.4 1.4-1.1 1.4l-3.3-4.3V2.8zM2.4 2.8h2.8v6.9H2.4z"/></svg>';
  function thumb(target, about, kind) {
    if (!target || target.querySelector(":scope > .tf-thumb")) return null;
    var b = el("button", "tf-thumb"); b.type = "button"; b.innerHTML = THUMB;
    b.setAttribute("aria-label", "Something wrong with this — tell Frank"); b.title = "Tell Frank";
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); open({ about: typeof about === "function" ? about() : about, kind: kind || "about" }); });
    ["pointerdown", "mousedown"].forEach(function (k) { b.addEventListener(k, function (e) { e.stopPropagation(); }); });
    target.appendChild(b); return b;
  }
  function failure(o) {
    o = o || {};
    var c = el("div", "tf-fail"); c.setAttribute("role", "alert");
    if (o.kind) c.appendChild(el("div", "tf-k", o.kind));
    c.appendChild(el("p", "tf-what", o.what || "Something went wrong."));
    if (o.why) c.appendChild(el("p", "tf-why", o.why));
    var row = el("div", "tf-row"), tell = el("button", "tf-tell", "Tell Frank"); tell.type = "button";
    tell.addEventListener("click", function () { open({ about: (o.kind ? o.kind + ": " : "") + (o.what || "") + (o.why ? " — " + o.why : ""), kind: "failure" }); });
    row.appendChild(tell);
    if (o.fix) { var f = el("button", "tf-fix", o.fix); f.type = "button"; if (o.onFix) f.addEventListener("click", o.onFix); row.appendChild(f); }
    c.appendChild(row);
    return c;
  }

  /* the thumbs-down, put on what Frank made as it appears */
  function about(prefix, node, sel) { return function () { var t = sel ? node.querySelector(sel) : node; return prefix + (t ? " — " + t.textContent.trim().replace(/\s+/g, " ").slice(0, 120) : ""); }; }
  function scan(root) {
    (root || document).querySelectorAll(".sf-row .end").forEach(function (end) { var row = end.closest(".sf-row"); thumb(end, about("a search answer", row, ".t"), "search"); });
    (root || document).querySelectorAll(".lookupcard").forEach(function (c) { thumb(c, about("a dictionary card", c, ".lookupcard-word"), "dictionary"); });
    (root || document).querySelectorAll(".sf-card").forEach(function (c) { thumb(c, about("a render", c), "render"); });
    var info = document.getElementById("bkvInfo"); if (info) { var by = info.querySelector(".bkv-by"); if (by) thumb(by, about("how this book was read (the parse)", info, ".bkv-title"), "parse"); }
    roving();
  }
  /* THE TRANSLATION LINE'S THUMB ROVES (ASKS #135, looked at 29 Sep on the Eclogues): a line in the book's second
     language is `p.line[lang]` (page.js writes lang only where a line differs from its section -- the first guess here,
     "the first p[lang] is the book's", named the translation as the book and thumbed nothing). One thumb for the page,
     in the right margin beside the translation line under the pointer (on the phone: the line last touched, for four
     seconds) -- never inside the text (p.line is the word index) and never on every other line of a stitched book. */
  var rove = null, roveOn = null, roveT = 0;
  function roving() {
    var col = document.getElementById("readercol"); if (!col || col.__tfRove) return; col.__tfRove = 1;
    rove = el("button", "tf-thumb tf-rove"); rove.type = "button"; rove.innerHTML = THUMB; rove.hidden = true;
    rove.setAttribute("aria-label", "Something wrong with this translation line — tell Frank"); rove.title = "Tell Frank";
    ["pointerdown", "mousedown"].forEach(function (k) { rove.addEventListener(k, function (e) { e.stopPropagation(); }); });
    rove.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (roveOn) open({ about: about("a translation line", roveOn)(), kind: "translation" }); });
    document.body.appendChild(rove);
    function show(p) {
      clearTimeout(roveT); roveOn = p; var r = p.getBoundingClientRect(), c = col.getBoundingClientRect();
      rove.style.left = Math.round(Math.min(innerWidth - 36, r.right + 10)) + "px";   /* beside the line's own measure, not the window's edge */ rove.style.top = Math.round(r.top + Math.min(r.height, 28) / 2 - 14) + "px";
      rove.hidden = false;
    }
    function hide(later) { clearTimeout(roveT); roveT = setTimeout(function () { rove.hidden = true; roveOn = null; }, later || 0); }
    col.addEventListener("pointermove", function (e) { var p = e.target.closest && e.target.closest("p.line[lang]"); if (p) show(p); else if (roveOn) hide(600); });
    col.addEventListener("pointerleave", function () { hide(900); });
    rove.addEventListener("pointerenter", function () { clearTimeout(roveT); });
    rove.addEventListener("pointerleave", function () { hide(600); });
    col.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; var p = e.target.closest && e.target.closest("p.line[lang]"); if (p) { show(p); hide(4000); } });
    document.addEventListener("scroll", function () { if (roveOn) hide(0); }, { capture: true, passive: true });
  }
  var t = 0;
  function soon() { if (!t) t = setTimeout(function () { t = 0; scan(); }, 250); }
  if (window.MutationObserver) new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true });
  soon();

  /* the ways in: ⌥⌘T (Alt+Ctrl+T off a Mac), the Mac menu's event, a shake on the phone */
  document.addEventListener("keydown", function (e) {
    if ((e.code === "KeyT" || e.key === "t" || e.key === "†") && e.altKey && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); open(); }
  }, true);
  document.addEventListener("frank:tell", function (e) { open(e.detail || {}); });
  var last = 0;
  addEventListener("devicemotion", function (e) {
    var a = e.accelerationIncludingGravity; if (!a || !R.hasAttribute("data-phone")) return;
    var g = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    if (g > 24 && Date.now() - last > 2000) { last = Date.now(); if (!open_) open(); }
  });

  window.TellFrank = { open: open, close: close, thumb: thumb, failure: failure, log: function () { return LOG.slice(); }, KEY: KEY };
})();
