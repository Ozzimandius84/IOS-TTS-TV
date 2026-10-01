/* ENGINE · A VOICE, A BOOK’S VOICES, AND THE SURFACE’S VOICE AND LIBRIVOX CARDS (Z8 · Z9 · Z13)
   · bench: voicepage.html · look: voicepage.css
   ====================================================================== */
/* design/reader/voicepage.js -- A VOICE, A BOOK'S VOICES, AND THE TWO SURFACE CARDS (ZERO-TO-ONE-FOR-DESIGN Z8 · Z9 · Z13;
   DESIGN #197, 1 Oct 2026). Everything it shows it asks of window.FrankVoice (voicestore.js) -- one seam per back end.

   Z8  "Book, voice, render: three public things" -- a public VOICE page that lists every book the voice has read, and
       on a book THE VOICES THAT HAVE READ IT. Pressing one plays it at once (the render comes from the library, no GPU,
       no wait). Publishing a book, making a voice public and a render being listed are three separate controls, each
       in its own place (Z18 P1-P3): the book's "On the web" on the book; "Share this voice" on the voice; "Listed" on
       each reading. The rights are undecided (§9b), so only a reading of a book free in the US, the UK and the EU is
       ever drawn public; any other "stays yours", and says why.
   Z9  "Use this voice, share my voice" -- Use goes on to choosing the book the voice reads; Share asks whose voice it
       is and that they agree (the consent line, B1's words verbatim); Withdraw is always there.
   Z13 "The LibriVox press" -- the Surface's LibriVox row pressed: what joining the reading costs and that it runs on the
       Mac, not the cloud; then aligning; then the book with the reading attached; or the failure, with Tell Frank.

   API (all return an element or draw into one):
     VoicePage.mount(root, {voice: id} | {book: key})   the page (voicepage.html), full bleed, Photos rules
     VoicePage.bookVoices(key)                           "Read by": a book's voices -- for the book view's ⓘ facts
     VoicePage.shareBlock(voice, redraw)                 Share this voice · consent · shared · withdrawn · not yours
     VoicePage.attachCard(cand)                          Z13, inside the Surface's right-hand pane
     VoicePage.useCard(cand)                             Z9, "Use as voice" pressed, inside the same pane
     VoicePage.player                                    the one player (an <audio>, a glass capsule at the foot) */
(function () {
  "use strict";
  if (window.VoicePage) return;
  var R = document.documentElement;
  function F() { return window.FrankVoice; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(cls, text, fn, label) {
    var b = el("button", cls, text); b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    if (fn) b.addEventListener("click", function (e) { e.stopPropagation(); fn(b, e); });
    return b;
  }
  function svg(d, fill) { return '<svg viewBox="0 0 16 16" aria-hidden="true"' + (fill ? ' class="f"' : "") + ">" + d + "</svg>"; }
  var G = {
    back: svg('<path d="M9.5 3.5L5 8l4.5 4.5"/>'),
    more: svg('<circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/>', 1),
    play: svg('<path d="M5 3.2v9.6L12.8 8z"/>', 1),
    pause: svg('<rect x="4" y="3.2" width="2.8" height="9.6" rx=".6"/><rect x="9.2" y="3.2" width="2.8" height="9.6" rx=".6"/>', 1),
    wave: svg('<path d="M2.5 8h0M5 6v4M7.5 3.5v9M10 5.5v5M12.5 7v2"/>'),
    lit: svg('<path d="M3 12.5h10"/><path d="M5 10V4.5h6V10" />'),
    mac: svg('<rect x="2" y="3" width="12" height="8" rx="1"/><path d="M5.5 13.5h5M8 11v2.5"/>'),
    check: svg('<path d="M3.5 8.5l3 3 6-7"/>')
  };
  function gl(k) { var s = el("span", "vp-g"); s.innerHTML = G[k]; return s; }
  function mmss(s) {
    if (s == null) return ""; s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    if (m === 60) { h++; m = 0; }
    return h ? h + " h" + (m ? " " + m + " m" : "") : Math.max(1, m) + " m";
  }
  function clock(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }
  function day(iso) { try { return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch (e) { return iso; } }
  function phone() { return R.hasAttribute("data-phone"); }
  function web() { return R.hasAttribute("data-web"); }
  function fail(o) {
    if (window.TellFrank && TellFrank.failure) return TellFrank.failure(o);
    var c = el("div", "tf-fail"); c.appendChild(el("p", "tf-what", o.what)); if (o.why) c.appendChild(el("p", "tf-why", o.why)); return c;
  }
  /* a cover: the real jacket when there is one, else Frank's own drawn cover (title and author in the slot) */
  function coverEl(r, cls) {
    var c = el("span", "vp-cov " + (cls || ""));
    var t = el("span", "vp-covt"); t.appendChild(el("b", null, r.title)); t.appendChild(el("i", null, r.author || "")); c.appendChild(t);
    if (r.cover) { var im = new Image(); im.alt = ""; im.decoding = "async"; im.loading = "lazy"; im.onload = function () { c.classList.add("img"); }; im.src = r.cover; c.appendChild(im); }
    return c;
  }

  /* ================================================================= THE PLAYER -- one for the page, at the foot
     "Pressing plays instantly": the press sets the source and calls play() in the same task, and the capsule shows
     the reading at once; the clock is the audio's own. A reading that will not load turns into the failure card. */
  var player = (function () {
    var a = null, now = null, cap = null, onfail = null, ticker = 0;
    function audio() {
      if (a) return a;
      a = new Audio(); a.preload = "auto";
      a.addEventListener("error", function () { if (now) { var n = now; stop(); if (onfail) onfail(n); } });
      a.addEventListener("ended", function () { stop(); });
      return a;
    }
    function draw() {
      if (!cap) return;
      cap.hidden = !now;
      if (!now) return;
      cap.querySelector(".vp-pt b").textContent = now.title;
      cap.querySelector(".vp-pt i").textContent = (now.voice ? now.voice + " · " : "") + clock(a ? a.currentTime : 0);
      var p = cap.querySelector(".vp-pp"); p.innerHTML = a && !a.paused ? G.pause : G.play;
      p.setAttribute("aria-label", a && !a.paused ? "Pause" : "Play");
      document.querySelectorAll("[data-hash]").forEach(function (n) { n.toggleAttribute("data-playing", n.getAttribute("data-hash") === now.hash && a && !a.paused); });
    }
    function play(r, fromBtn) {
      var x = audio();
      now = { hash: r.hash, title: r.title, voice: r.voice || "", t0: performance.now() };
      x.src = typeof r.src === "function" ? r.src(r.first) : r.src;
      var pr = x.play(); if (pr && pr.catch) pr.catch(function () { /* autoplay refused: the capsule still offers ▶ */ draw(); });
      R.setAttribute("data-vp-playing", "");
      clearInterval(ticker); ticker = setInterval(draw, 250);
      draw();
      return now;
    }
    function toggle() { if (!a || !now) return; if (a.paused) a.play(); else a.pause(); draw(); }
    function stop() { if (a) { a.pause(); } now = null; clearInterval(ticker); R.removeAttribute("data-vp-playing"); draw(); }
    function capsule() {
      cap = el("div", "vp-player vp-glass"); cap.hidden = true;
      var pp = btn("vp-pp", "", function () { toggle(); }, "Pause"); pp.innerHTML = G.pause; cap.appendChild(pp);
      var t = el("span", "vp-pt"); t.appendChild(el("b")); t.appendChild(el("i")); cap.appendChild(t);
      return cap;
    }
    return { play: play, stop: stop, toggle: toggle, capsule: capsule, now: function () { return now; }, audio: function () { return a; }, onFail: function (f) { onfail = f; } };
  })();

  /* ================================================================= Z9 · SHARE THIS VOICE (P2's place: on the voice)
     private → asking (whose, and that they agree: the words are B1's CONSENT_WORDS, verbatim) → shared → withdrawn.
     A voice cut from someone else's recording shows that it is not yours to share, and no switch. */
  function shareBlock(v, redraw, opts) {
    opts = opts || {};
    var box = el("section", "vp-share"); box.setAttribute("data-share", v.can_share ? (opts.asking ? "asking" : v.state) : "notyours");
    redraw = redraw || function () {};
    if (!v.can_share) {
      box.appendChild(el("h3", "vp-h", "Not yours to share"));
      box.appendChild(el("p", "vp-p", v.why));
      return box;
    }
    if (opts.asking) {
      box.appendChild(el("h3", "vp-h", "Share this voice"));
      box.appendChild(el("p", "vp-p", "Anyone can then hear it, and play every free book it has read. You can withdraw it at any time."));
      var lab = el("label", "vp-field"); lab.appendChild(el("span", null, "Whose voice is this?"));
      var inp = el("input"); inp.type = "text"; inp.value = v.whose || ""; inp.setAttribute("autocomplete", "name"); lab.appendChild(inp); box.appendChild(lab);
      var tick = el("label", "vp-tick"); var cb = el("input"); cb.type = "checkbox"; tick.appendChild(cb);
      tick.appendChild(el("span", null, F().CONSENT_WORDS)); box.appendChild(tick);
      var row = el("div", "vp-acts");
      row.appendChild(btn("vp-btn ghost", "Not now", function () { redraw({ asking: false }); }));
      var go = btn("vp-btn", "Share this voice", function () {
        F().Voices.share(v.id, { whose: inp.value, agree: cb.checked }).then(function (r) {
          if (r && r.ok) redraw({ asking: false, said: r.words }); else { say.textContent = (r && r.words) || "Not shared."; }
        });
      });
      var say = el("p", "vp-say");
      function can() { go.disabled = !(cb.checked && inp.value.trim()); }
      cb.addEventListener("change", can); inp.addEventListener("input", can); can();
      row.appendChild(go); box.appendChild(row); box.appendChild(say);
      return box;
    }
    if (v.state === "shared") {
      var h = el("h3", "vp-h"); h.appendChild(gl("check")); h.appendChild(document.createTextNode(" Shared")); box.appendChild(h);
      box.appendChild(el("p", "vp-p", (v.consent && v.consent.whose === v.name ? v.consent.whose + "’s own voice" : (v.consent ? v.consent.whose + "’s voice" : "")) + (v.consent && v.consent.at ? " · since " + day(v.consent.at) : "")));
      if (v.consent) box.appendChild(el("blockquote", "vp-consent", "“" + v.consent.words + "”"));
      box.appendChild(btn("vp-btn ghost", "Withdraw", function () { F().Voices.withdraw(v.id).then(function () { redraw({ asking: false }); }); }));
      if (opts.said) box.appendChild(el("p", "vp-say", opts.said));
      return box;
    }
    if (v.state === "withdrawn") {
      box.appendChild(el("h3", "vp-h", "Withdrawn" + (v.withdrawn_at ? " " + day(v.withdrawn_at) : "")));
      box.appendChild(el("p", "vp-p", "No one new can play it, and its readings are off the web. It is still yours, here."));
      box.appendChild(btn("vp-btn ghost", "Share again…", function () { redraw({ asking: true }); }));
      return box;
    }
    box.appendChild(el("h3", "vp-h", "Only you can hear it"));
    box.appendChild(el("p", "vp-p", "Share it and anyone can hear it, and play every free book it has read."));
    box.appendChild(btn("vp-btn", "Share this voice…", function () { redraw({ asking: true }); }));
    return box;
  }

  /* ================================================================= A READING (one render) in two shapes
     the listener's tile (the cover; a press plays) and the owner's row (the cover small, how much plays, Listed) */
  function tile(r) {
    var t = btn("vp-tile", "", function () { player.play(r); }, "Play " + r.title + (r.voice ? ", read by " + r.voice : ""));
    t.setAttribute("data-hash", r.hash);
    t.appendChild(coverEl(r));
    var p = el("span", "vp-tp vp-glass"); p.innerHTML = G.play; t.appendChild(p);
    return t;
  }
  function amount(r) {
    var n = r.audio.length;
    return (n >= r.chapters ? "All " + r.chapters + " chapters" : n + " of " + r.chapters + " chapters") + (r.lit.length >= n ? " · every word lit" : r.lit.length ? " · words lit in " + r.lit.length : "");
  }
  /* P3 -- "Listed under <voice>": live only when the book AND the voice are public */
  function listedCtl(r, voicePublic) {
    var w = el("span", "vp-listed");
    if (!r.can_list) { w.appendChild(el("b", null, "Stays yours")); w.setAttribute("data-blocked", "rights"); return w; }
    var sw = btn("vp-sw", "", function () {
      var on = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", on ? "true" : "false"); F().Renders.setListed(r.hash, on);
    }, "Listed under " + r.voice);
    sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", r.listed && voicePublic ? "true" : "false");
    sw.appendChild(el("i"));
    if (!voicePublic) { sw.disabled = true; w.setAttribute("data-blocked", "voice"); }
    w.appendChild(el("b", null, "Listed")); w.appendChild(sw);
    return w;
  }
  function ownerRow(r, voicePublic) {
    var row = el("div", "vp-row"); row.setAttribute("data-hash", r.hash);
    var pb = btn("vp-rp", "", function () { player.play(r); }, "Play " + r.title); pb.appendChild(coverEl(r, "sm")); var g = el("span", "vp-tp vp-glass"); g.innerHTML = G.play; pb.appendChild(g);
    row.appendChild(pb);
    var t = el("div", "vp-rt"); t.appendChild(el("b", null, r.title)); t.appendChild(el("i", null, amount(r)));
    if (!r.can_list) t.appendChild(el("em", "vp-why", r.why));
    else if (!voicePublic) t.appendChild(el("em", "vp-why", "Listed once the voice is shared."));
    row.appendChild(t);
    row.appendChild(listedCtl(r, voicePublic));
    return row;
  }

  /* ================================================================= Z9 · USE THIS VOICE -- choose the book it reads */
  function useSheet(v, done, close) {
    var s = el("div", "vp-sheet vp-glass"); s.setAttribute("role", "dialog"); s.setAttribute("aria-label", "Read a book in " + v.name);
    s.appendChild(el("h3", "vp-h", "Read a book in " + v.name));
    var list = el("div", "vp-pick"), chosen = null, go = null;
    F().Books.shelf().then(function (books) {
      (books || []).forEach(function (b, i) {
        var r = btn("vp-pickrow", "", function () { chosen = b; list.querySelectorAll(".vp-pickrow").forEach(function (n) { n.setAttribute("aria-checked", n === r ? "true" : "false"); }); go.disabled = false; go.textContent = "Read " + b.title + " in " + v.name; });
        r.setAttribute("role", "radio"); r.setAttribute("aria-checked", "false");
        r.appendChild(coverEl(b, "xs")); var t = el("span", "vp-rt"); t.appendChild(el("b", null, b.title)); t.appendChild(el("i", null, b.author)); r.appendChild(t);
        list.appendChild(r);
      });
    });
    s.appendChild(list);
    var row = el("div", "vp-acts");
    row.appendChild(btn("vp-btn ghost", "Not now", function () { close(); }));
    go = btn("vp-btn", "Choose a book", function () { if (chosen) F().Voices.useFor(v.id, chosen.slug).then(function () { done(chosen); }); });
    go.disabled = true; row.appendChild(go); s.appendChild(row);
    return s;
  }
  /* after the choice: already made (plays now, 0 GPU) or not yet (the device voice reads it until a render exists) */
  function usedCard(v, b, signedIn) {
    var c = el("div", "vp-used");
    c.appendChild(el("h3", "vp-h", b.title + " will be read in " + v.name + "."));
    var made = el("p", "vp-p"); c.appendChild(made);
    var acts = el("div", "vp-acts"); c.appendChild(acts);
    F().Renders.made(v.id, b.slug).then(function (m) {
      if (m) {
        made.textContent = "Already read in this voice — it plays now, with nothing to make.";
        acts.appendChild(btn("vp-btn", "Play", function () { player.play({ hash: "used", title: b.title, voice: v.name, src: function () { return new URL("../books/eclogues-en/audio/c001.wav", document.baseURI).href; } }); }));
      } else {
        made.textContent = "Not read in this voice yet. Your device voice reads it until it is: making it takes about 4 h of your cloud hours.";
        acts.appendChild(btn("vp-btn", "Make the reading", function (bt) { bt.disabled = true; bt.textContent = "Queued"; }));
      }
      acts.appendChild(btn("vp-btn ghost", "Open the book", function () {}));
      if (!signedIn) { var k = el("p", "vp-keep"); k.appendChild(document.createTextNode("Sign in to keep this. ")); k.appendChild(btn("vp-link", "Sign in", function () {})); c.appendChild(k); }
    });
    return c;
  }

  /* ================================================================= Z8 · THE VOICE PAGE */
  function voiceView(root, id, st) {
    var acct = F().account();
    root.setAttribute("data-view", "voice");
    var top = topBar("", "a voice");
    root.appendChild(top);
    var sc = el("div", "vp-scroll"); root.appendChild(sc);
    var foot = el("div", "vp-foot"); root.appendChild(foot);
    var over = el("div", "vp-over"); root.appendChild(over);
    if (st === "failed") {
      top.querySelector(".vp-cap b").textContent = "A voice";
      over.appendChild(fail({ kind: "A voice", what: "This voice couldn’t be loaded.", why: "Frank’s library didn’t answer — this device is offline.", fix: "Try again" }));
      root.setAttribute("data-loaded", "failed");
      return;
    }
    Promise.all([F().Voices.get(id), F().Renders.byVoice(id)]).then(function (x) {
      var v = x[0], rs = x[1] || [];
      if (!v) { over.appendChild(fail({ kind: "A voice", what: "There is no voice here.", why: "It was withdrawn by the person it belongs to.", fix: "Back to the shelf" })); return; }
      top.querySelector(".vp-cap b").textContent = v.name;
      var owner = v.mine && acct.signed_in;
      var pub = v.state === "shared";
      /* the listener sees only what is listed; the owner sees every reading, and its control */
      var shown = owner ? rs : rs.filter(function (r) { return r.listed && r.can_list; });
      var head = el("header", "vp-head");
      head.appendChild(el("h1", "vp-name", v.name));
      var whose = owner ? (v.can_share ? "Your own voice" : "Cut from “" + (v.source.recording || "") + "”")
                        : (v.whose ? v.whose + "’s voice" : "") + (v.consent && v.consent.at ? " · shared " + day(v.consent.at) : "");
      head.appendChild(el("p", "vp-whose", whose));
      if (v.sample) {
        var hear = btn("vp-hear", "", function () { player.play({ hash: "sample:" + v.id, title: "The voice itself", voice: v.name, src: v.sample }); }, "Hear " + v.name);
        hear.setAttribute("data-hash", "sample:" + v.id); hear.innerHTML = G.play; hear.appendChild(el("span", null, "Hear it"));
        head.appendChild(hear);
      }
      sc.appendChild(head);
      function drawShare(o) {
        var old = sc.querySelector(".vp-share");
        F().Voices.get(id).then(function (v2) {
          var nb = shareBlock(v2, drawShare, o || {}); if (old) old.replaceWith(nb); else head.after(nb);
          root.setAttribute("data-share", nb.getAttribute("data-share"));
          if (o && o.asking === false && old) redrawRows(v2);
        });
      }
      if (owner) drawShare({ asking: st === "asking" });
      var body = el("section", "vp-read"); sc.appendChild(body);
      function redrawRows(v2) {
        body.textContent = "";
        F().Renders.byVoice(id).then(function (rs2) {
          var pub2 = v2.state === "shared";
          if (!rs2.length) return noneYet(body, v2);
          var list = el("div", "vp-rows"); rs2.forEach(function (r) { list.appendChild(ownerRow(r, pub2)); }); body.appendChild(list);
        });
      }
      if (!shown.length) noneYet(body, v);
      else if (owner) { var list = el("div", "vp-rows"); shown.forEach(function (r) { list.appendChild(ownerRow(r, pub)); }); body.appendChild(list); }
      else { var grid = el("div", "vp-grid"); shown.forEach(function (r) { grid.appendChild(tile(r)); }); body.appendChild(grid); }
      /* the foot: the player (once something plays), and Use this voice */
      foot.appendChild(player.capsule());
      var use = btn("vp-use vp-glass", "Use this voice", function () { openUse(); });
      foot.appendChild(use);
      function openUse() {
        over.textContent = ""; root.setAttribute("data-sheet", "use");
        over.appendChild(useSheet(v, function (b) {
          over.textContent = ""; var s = el("div", "vp-sheet vp-glass"); s.appendChild(usedCard(v, b, acct.signed_in));
          s.appendChild(btn("vp-x", "Done", function () { over.textContent = ""; root.removeAttribute("data-sheet"); }));
          over.appendChild(s); root.setAttribute("data-sheet", "used");
        }, function () { over.textContent = ""; root.removeAttribute("data-sheet"); }));
      }
      if (st === "use") openUse();
      player.onFail(function () {
        over.textContent = "";
        over.appendChild(fail({ kind: "Playing", what: "This reading couldn’t be played.", why: "Frank’s library didn’t send it — try again in a moment.", fix: "Try again" }));
      });
      headSeen(root);
      root.setAttribute("data-loaded", "1");
    });
  }
  function noneYet(box, v) {
    var n = el("div", "vp-none");
    n.appendChild(el("p", "vp-say", "Nothing read in " + v.name + " yet."));
    n.appendChild(el("p", "vp-p", "Choose a book and it reads it to you; once made, the reading is here for anyone who follows this voice."));
    box.appendChild(n);
  }

  /* ================================================================= Z8 · A BOOK'S VOICES ("Read by") */
  function bookVoices(key, st, opts) {
    opts = opts || {};
    var acct = F().account();
    var box = el("section", "vp-byvoices");
    F().Books.get(key).then(null, function () { return null; }).then(function (b) {
      /* a book the back end does not know yet is still this book: its own name, no readings, the device voice */
      b = b || { slug: key, work_id: key, title: opts.title || key, author: "", web: {} };
      Promise.resolve(F().Renders.byWork(key)).then(null, function () { return []; }).then(function (rs) {
        rs = rs || [];
        var owner = acct.signed_in && (st === "owner" || st === "refused");
        if (owner) box.appendChild(webCtl(b));
        box.appendChild(el("h3", "vp-sec", "Read by"));
        var shown = owner ? rs : rs.filter(function (r) { return r.listed && r.can_list; });
        var list = el("div", "vp-vrows"); box.appendChild(list);
        shown.forEach(function (r) {
          var row = el("div", "vp-vrow"); row.setAttribute("data-hash", r.hash);
          var pb = btn("vp-vp", "", function () { player.play(r); }, "Play " + b.title + ", read by " + r.voice); pb.innerHTML = G.play; row.appendChild(pb);
          var t = el("a", "vp-rt"); t.href = "?voice=" + encodeURIComponent(r.voice_id) + (opts.q || "");
          t.appendChild(el("b", null, r.voice)); t.appendChild(el("i", null, (r.whose ? r.whose + "’s voice · " : "") + amount(r)));
          if (owner && r.mine && !r.can_list) t.appendChild(el("em", "vp-why", r.why));
          row.appendChild(t);
          if (owner && r.mine) row.appendChild(listedCtl(r, true));
          list.appendChild(row);
        });
        /* the device's own voice is always there, free and at once -- so "none yet" is never a dead end */
        var dv = el("div", "vp-vrow vp-device");
        var dp = btn("vp-vp", "", function (bt) { deviceRead(b, bt); }, "Read " + b.title + " in this device’s voice"); dp.innerHTML = G.play; dv.appendChild(dp);
        var dt = el("span", "vp-rt"); dt.appendChild(el("b", null, phone() ? "This iPhone’s voice" : web() ? "This browser’s voice" : "This Mac’s voice"));
        dt.appendChild(el("i", null, "Reads it now, on this device — no wait")); dv.appendChild(dt);
        list.appendChild(dv);
        if (!shown.length) {
          var n = el("div", "vp-none"); n.appendChild(el("p", "vp-say", "No voice has read this book yet."));
          var mk = btn("vp-btn ghost", "Make a reading", function (bt) { bt.textContent = acct.signed_in ? "Choose a voice in the Surface" : "Sign in to keep this"; });
          n.appendChild(mk); list.before(n);
        }
        box.setAttribute("data-loaded", "1");
      });
    });
    return box;
  }
  function deviceRead(b, bt) {
    try { var u = new SpeechSynthesisUtterance(b.title + ". " + (b.author || "")); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
    bt.parentNode.setAttribute("data-playing", "");
  }
  /* P1 -- the book's own "On the web": On / Off / can't, the reason in words, and "my own writing" */
  function webCtl(b) {
    var w = el("section", "vp-web"); var web = b.web || {};
    w.setAttribute("data-web", web.can ? (web.public ? "on" : "off") : "cant");
    var h = el("div", "vp-webrow"); var t = el("span", "vp-rt"); t.appendChild(el("b", null, "On the web"));
    t.appendChild(el("i", null, web.can ? (web.public ? "Anyone can open it in Frank’s library" : "Only on your devices") : web.why));
    h.appendChild(t);
    if (web.can) {
      var sw = btn("vp-sw", "", function () { var on = sw.getAttribute("aria-checked") !== "true"; sw.setAttribute("aria-checked", on ? "true" : "false"); F().Books.setWeb(b.slug, on, false); }, "On the web");
      sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", web.public ? "true" : "false"); sw.appendChild(el("i")); h.appendChild(sw);
    } else {
      h.appendChild(btn("vp-btn ghost vp-own", "My own writing", function (bt) { bt.textContent = "Checked — on the web"; bt.disabled = true; }));
    }
    w.appendChild(h);
    return w;
  }
  function bookView(root, key, st, q) {
    root.setAttribute("data-view", "book");
    var top = topBar("", "read by"); root.appendChild(top);
    var sc = el("div", "vp-scroll"); root.appendChild(sc);
    var foot = el("div", "vp-foot"); root.appendChild(foot);
    var over = el("div", "vp-over"); root.appendChild(over);
    if (st === "failed") {
      top.querySelector(".vp-cap b").textContent = "Read by";
      over.appendChild(fail({ kind: "Voices", what: "The voices that read this book couldn’t be loaded.", why: "Frank’s library didn’t answer — this device is offline. Your device voice still reads it.", fix: "Try again" }));
      root.setAttribute("data-loaded", "failed"); return;
    }
    F().Books.get(key).then(function (b) {
      top.querySelector(".vp-cap b").textContent = b.title;
      var head = el("header", "vp-head vp-bhead");
      head.appendChild(coverEl(b, "md"));
      var ht = el("div", "vp-bht"); ht.appendChild(el("h1", "vp-name", b.title)); ht.appendChild(el("p", "vp-whose", b.author)); head.appendChild(ht);
      sc.appendChild(head);
      var bv = bookVoices(key, st, { q: q }); sc.appendChild(bv);
      foot.appendChild(player.capsule());
      player.onFail(function () { over.textContent = ""; over.appendChild(fail({ kind: "Playing", what: "This reading couldn’t be played.", why: "Frank’s library didn’t send it — try again in a moment.", fix: "Try again" })); });
      headSeen(root);
      var obs = new MutationObserver(function () { if (bv.getAttribute("data-loaded")) { root.setAttribute("data-loaded", "1"); obs.disconnect(); } });
      obs.observe(bv, { attributes: true });
    });
  }
  /* RULE 5 / 7: the name is said once. While the page's own big name is on screen the capsule says only what kind of
     thing this is; when it scrolls away the capsule takes the name (the band's data-headseen, ASKS #23) */
  function headSeen(root) {
    var nm = root.querySelector(".vp-name"), sc = root.querySelector(".vp-scroll"), top = root.querySelector(".vp-top");
    if (!nm || !sc || !top) return;
    function f() { var r = nm.getBoundingClientRect(), t = top.getBoundingClientRect(); root.toggleAttribute("data-headseen", r.bottom > t.bottom); }
    sc.addEventListener("scroll", f, { passive: true }); addEventListener("resize", f); f();
  }
  function topBar(name, kind) {
    var t = el("div", "vp-top");
    var b = btn("vp-c vp-glass vp-back", "", function () { if (history.length > 1) history.back(); }, "Back"); b.innerHTML = G.back; t.appendChild(b);
    var c = el("div", "vp-cap vp-glass"); c.appendChild(el("b", null, name)); c.appendChild(el("i", null, kind)); t.appendChild(c);
    var m = btn("vp-c vp-glass vp-more", "", function () {}, "More"); m.innerHTML = G.more; t.appendChild(m);
    return t;
  }

  /* ================================================================= Z13 · THE LIBRIVOX PRESS (in the Surface's pane)
     offered → aligning → done | failed. It runs on the Mac (attach/, CPU, no cloud); on the web and the phone the card
     says where it runs and offers nothing it cannot do. */
  function attachCard(cand, opts) {
    opts = opts || {};
    var card = el("div", "vp-card vp-attach");
    function draw() {
      Promise.all([F().Attach.offer(cand, opts.book), F().Attach.job()]).then(function (x) {
        var o = x[0], j = x[1];
        card.textContent = "";
        if (!o) { card.setAttribute("data-attach", "none"); return; }
        var st = j ? j.state : "offered";
        card.setAttribute("data-attach", st);
        var head = el("div", "vp-ah"); head.appendChild(coverEl(o.book, "xs"));
        /* the recording is already named above (the pane's own head); what is new is WHICH of your books it joins */
        var ht = el("span", "vp-rt"); ht.appendChild(el("b", null, "Your " + o.book.title));
        ht.appendChild(el("i", null, o.book.author + " · " + o.book.chapters + " chapters")); head.appendChild(ht);
        card.appendChild(head);
        if (st === "failed") {
          card.appendChild(fail({ kind: "Attach", what: j.error.what, why: j.error.why, fix: j.error.fix, onFix: function () { F().Attach.stop(j.id).then(draw); } }));
          return;
        }
        if (st === "offered") {
          card.appendChild(el("p", "vp-p", "A person reading the whole book, joined to your copy word by word — so the words light as they read."));
          var where = el("p", "vp-where"); where.appendChild(gl("mac"));
          var macHere = !phone() && !web();
          where.appendChild(el("span", null, macHere ? "It runs on this Mac, not the cloud — about " + mmss(o.estimate_s) + ". Nothing leaves the Mac, and you can read while it works."
                                                   : "It runs in Frank on your Mac, not the cloud — about " + mmss(o.estimate_s) + " there. Press it on the Mac; the reading comes here with the book."));
          card.appendChild(where);
          if (o.map && o.map.unmatched && o.map.unmatched.length) card.appendChild(el("p", "vp-why", o.map.unmatched.join(" · ")));
          var acts = el("div", "vp-acts");
          var go = btn("vp-btn", "Attach to " + o.book.title, function () { F().Attach.start(o.id).then(draw); });
          if (!macHere) { go.disabled = true; go.textContent = "On your Mac"; }
          acts.appendChild(go); card.appendChild(acts);
          return;
        }
        if (st === "aligning") {
          var p = el("p", "vp-say"); p.textContent = "Joining the reading to your copy — section " + j.section + " of " + j.sections + "."; card.appendChild(p);
          var bar = el("div", "vp-prog"); var fill = el("i"); fill.style.width = Math.round(100 * j.words_timed / j.words) + "%"; bar.appendChild(fill); card.appendChild(bar);
          var onMac = !phone() && !web();
          var w2 = el("p", "vp-where"); w2.appendChild(gl("mac")); w2.appendChild(el("span", null, (onMac ? "On this Mac" : "On your Mac") + ", not the cloud · about " + mmss(j.eta_s) + " left")); card.appendChild(w2);
          if (j.chapters_done) card.appendChild(el("p", "vp-p", "Chapters 1–" + j.chapters_done + " already play in the reading."));
          var a2 = el("div", "vp-acts");
          if (j.chapters_done) a2.appendChild(btn("vp-btn", "Play chapter 1", function () { player.play({ hash: "attach", title: o.book.title, voice: "LibriVox", src: new URL("../books/eclogues-en/audio/c001.wav", document.baseURI).href }); }));
          if (onMac) a2.appendChild(btn("vp-btn ghost", "Stop", function () { F().Attach.stop(j.id).then(draw); }));
          card.appendChild(a2);
          return;
        }
        /* done */
        var d = el("p", "vp-say"); d.textContent = o.book.title + " now plays in this reading, every word lit."; card.appendChild(d);
        card.appendChild(el("p", "vp-p", j.chapters_done + " of " + o.book.chapters + " chapters · " + Math.round(1000 * j.words_timed / j.words) / 10 + "% of the words timed"));
        if (o.map && o.map.unmatched && o.map.unmatched.length) card.appendChild(el("p", "vp-why", o.map.unmatched.join(" · ")));
        var a3 = el("div", "vp-acts");
        a3.appendChild(btn("vp-btn", "Open " + o.book.title, function () {}));
        a3.appendChild(btn("vp-btn ghost", "Play", function () { player.play({ hash: "attach", title: o.book.title, voice: "LibriVox", src: new URL("../books/eclogues-en/audio/c001.wav", document.baseURI).href }); }));
        card.appendChild(a3);
      });
    }
    draw();
    if (F().onChange) F().onChange(function () { if (card.isConnected) draw(); });
    return card;
  }

  /* ================================================================= Z9 · "USE AS VOICE" PRESSED (in the Surface's pane)
     making (on the Mac, from the recording) → made: choose the book it reads → chosen; or failed, with Tell Frank */
  function useCard(cand) {
    var card = el("div", "vp-card vp-usecard");
    function draw() {
      F().Voices.make(cand).then(function (u) {
        card.textContent = "";
        if (!u) return;
        var st = u.phase === "running" ? "making" : u.phase === "failed" ? "failed" : u.chosen ? "chosen" : "choose";
        card.setAttribute("data-use", st);
        if (st === "failed") { card.appendChild(fail({ kind: "A voice", what: u.error.what, why: u.error.why, fix: u.error.fix })); return; }
        if (st === "making") {
          card.appendChild(el("p", "vp-say", "Making a voice from “" + u.from + "”."));
          var bar = el("div", "vp-prog busy"); bar.appendChild(el("i")); card.appendChild(bar);
          var w = el("p", "vp-where"); w.appendChild(gl("mac")); w.appendChild(el("span", null, "On this Mac · about " + mmss(u.eta_s) + ". It keeps going if you close this.")); card.appendChild(w);
          return;
        }
        var v = u.voice;
        if (st === "choose") {
          var sh = useSheet(v, function () { draw(); }, function () {}); sh.classList.remove("vp-sheet", "vp-glass"); sh.classList.add("vp-inline");
          card.appendChild(el("p", "vp-say", v.name + " is ready."));
          card.appendChild(sh);
        } else {
          var slot = el("div"); card.appendChild(slot);   /* the chosen book first, the share block under it -- in that order whatever answers first */
          F().Books.shelf().then(function (bs) { var b = bs.filter(function (x) { return x.slug === u.chosen; })[0] || bs[0]; slot.appendChild(usedCard(v, b, F().account().signed_in)); });
        }
        card.appendChild(shareBlock(v, function () {}, {}));
      });
    }
    draw();
    if (F().onChange) F().onChange(function () { if (card.isConnected) draw(); });
    return card;
  }

  /* ================================================================= the page itself (voicepage.html) */
  function mount(root, o) {
    o = o || {};
    root.classList.add("vp");
    var q = o.q || "";
    if (o.book) bookView(root, o.book, o.state || F().pick("book"), q);
    else voiceView(root, o.voice || "osca", o.state || F().pick("voice"));
    return root;
  }

  window.VoicePage = { mount: mount, bookVoices: bookVoices, shareBlock: shareBlock, attachCard: attachCard, useCard: useCard, player: player };
})();
