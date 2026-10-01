/* design/reader/wordsbefore.js -- THE WORDS BEFORE A CHAPTER (Z10, 1 Oct 2026)

   ZERO-TO-ONE §0b F, Osca 29 Sep ("a chapter's hard words ahead"); ZERO-TO-ONE-FOR-DESIGN Z10: "at a chapter's head,
   a card of that chapter's twenty rarest words, each with its gloss in the reader's language. Quiet, and away with
   one press." The list is dictionary/wordsbefore.py's (WORDS-BEFORE a0c4250): books/<slug>/words/<cid>.json, a BOOK
   FILE, so the card needs no pack, no server and no network once the list is made.

   WHERE IT SITS. Inside the chapter's opener slide, under its title (page.js's `.opener`, 100vh, so the card
   costs the chapter's measured height nothing -- page.js, book-nav.js and the scrub keep their numbers). It is
   added when an opener mounts (a MutationObserver on the column: page.js mounts and unmounts chapters as the
   reader moves) and goes with it.

   THE ONE SEAM. WordsBefore.useSource(read): read(slug, cid, cb) -> cb(doc) where doc is the file's own shape
     {schema, slug, chapter, title, lang, n, rarity, pack, counted, words: [{lemma, pos, gloss, forms, count,
      sentence, word, zipf | corpus_count}]}
   or cb(null) for "no list for this chapter" (nothing is drawn), or cb({state: "nopack", lang}) for a language
   Frank has no dictionary for (one quiet line), or cb({state: "error", why}) (a failure card with Tell Frank).
   Until a lane plugs in, the source is the book file itself, fetched beside book-data.js.

   THE STATES, each reachable in band: list · away (one press; a quiet "Words before" stays to bring it back) ·
   no pack · failure. The reader's language is English today (every pack's senses are English); a gloss in another
   reader language is a dictionary request, written in the ASKS row. */
(function () {
  "use strict";
  var R = document.documentElement;
  var SRC = null, LANGS = { la: "Latin", grc: "Ancient Greek", fr: "French", de: "German", it: "Italian", es: "Spanish", ru: "Russian", sa: "Sanskrit", en: "English", el: "Greek" };
  var KEY = "frank.wordsbefore.away.";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function langName(c) { try { if (window.Lookup && Lookup.langName) { var n = Lookup.langName(c); if (n && n !== c) return n; } } catch (e) {} return LANGS[c] || c || "this language"; }
  function fileSource(slug, cid, cb) {
    fetch("../books/" + encodeURIComponent(slug) + "/words/" + encodeURIComponent(cid) + ".json", { cache: "no-store" })
      .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { cb(j); }, function (e) { cb({ state: "error", why: String(e && e.message || e) }); });
  }
  function away(slug) { try { return JSON.parse(localStorage.getItem(KEY + slug) || "{}") || {}; } catch (e) { return {}; } }
  function setAway(slug, cid, on) { var a = away(slug); if (on) a[cid] = 1; else delete a[cid]; try { localStorage.setItem(KEY + slug, JSON.stringify(a)); } catch (e) {} }
  function press(el, fn) {
    var t = 0;
    el.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (e.button === 0) t = Date.now(); });
    el.addEventListener("pointerup", function (e) { e.stopPropagation(); if (e.button !== 0 || !t) return; t = 0; el.__acted = Date.now(); fn(e); });
    el.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); if (Date.now() - (el.__acted || 0) < 600) return; el.__acted = Date.now(); fn(e); });
  }

  function mount(o) {
    var col = o.col, book = o.book || {}, slug = o.slug || book.slug || "";
    var docs = {};   /* cid -> the answer, asked once per book */
    var chs = book.chapters || [];
    function cidOf(sec) { var ci = +sec.getAttribute("data-ch"), ch = chs[ci]; return ch && ch.id; }
    function ask(cid, cb) { if (docs[cid] !== undefined) return cb(docs[cid]); (SRC || fileSource)(slug, cid, function (d) { docs[cid] = d; cb(d); }); }
    function card(sec) {
      var op = sec.querySelector(":scope > .opener"); if (!op || op.querySelector(".wb, .wb-back")) return;
      var cid = cidOf(sec); if (!cid) return;
      ask(cid, function (d) { if (!op.isConnected || op.querySelector(".wb, .wb-back")) return; draw(op, cid, d); });
    }
    function draw(op, cid, d) {
      var old = op.querySelector(".wb, .wb-back"); if (old) old.remove();
      if (!d) return;   /* no list for this chapter: nothing at all */
      var el = document.createElement("aside"); el.className = "wb"; el.setAttribute("aria-label", "Words before this chapter");
      if (d.state === "nopack") {
        el.className = "wb wb-quiet";
        el.innerHTML = '<p>No words before for ' + esc(langName(d.lang)) + ' yet — Frank has no ' + esc(langName(d.lang)) + ' dictionary.</p>';
        op.appendChild(el); return;
      }
      if (d.state === "error") {
        el.className = "wb wb-fail";
        if (window.TellFrank && TellFrank.failure) el.appendChild(TellFrank.failure({ kind: "Words before", what: "This chapter’s words couldn’t be read.", why: "The list Frank made for it is damaged.", fix: "Try again", onFix: function () { delete docs[cid]; el.remove(); card(op.parentNode); } }));
        else el.innerHTML = "<p>This chapter’s words couldn’t be read.</p>";
        op.appendChild(el); return;
      }
      var words = (d.words || []).filter(function (w) { return w && (w.gloss || w.lemma); });
      if (!words.length) return;
      if (away(slug)[cid]) {
        var back = document.createElement("button"); back.type = "button"; back.className = "wb-back"; back.textContent = "Words before";
        press(back, function () { setAway(slug, cid, false); draw(op, cid, d); });
        op.appendChild(back); return;
      }
      var lg = d.lang || book.lang || "";
      el.innerHTML = '<div class="wb-head"><span>Words before</span><button type="button" class="wb-x" aria-label="Put the words away">×</button></div>'
        + '<ol class="wb-list">' + words.map(function (w) {
            var form = (w.forms && w.forms[0]) || w.lemma, same = !w.lemma || form.toLowerCase() === String(w.lemma).toLowerCase();
            return '<li><span class="wb-w"' + (lg ? ' lang="' + esc(lg) + '"' : '') + '><b>' + esc(form) + '</b>' + (same ? '' : ' <i>' + esc(w.lemma) + '</i>') + '</span><span class="wb-g">' + esc(w.gloss || '—') + '</span></li>';
          }).join('') + '</ol>';
      press(el.querySelector(".wb-x"), function () { setAway(slug, cid, true); draw(op, cid, d); });
      /* a word pressed is the dictionary card, as a word pressed on the page is (ASKS #144) */
      el.querySelectorAll(".wb-w").forEach(function (w, i) { press(w, function () { try { if (window.Lookup && Lookup.current && Lookup.current.open) Lookup.current.open((words[i].forms && words[i].forms[0]) || words[i].lemma, lg || undefined, { page: true }); } catch (e) {} }); });
      ["pointerdown", "touchstart", "mousedown", "wheel"].forEach(function (t) { el.addEventListener(t, function (e) { if (t !== "wheel") e.stopPropagation(); }, { passive: true }); });
      op.appendChild(el);
    }
    function scan() { col.querySelectorAll(".chapter").forEach(function (sec) { if (!sec.classList.contains("stub")) card(sec); }); }
    var t = 0;
    var mo = new MutationObserver(function () { if (!t) t = setTimeout(function () { t = 0; scan(); }, 60); });
    mo.observe(col, { childList: true, subtree: true });
    scan();
    return { scan: scan, redraw: function () { docs = {}; col.querySelectorAll(".wb, .wb-back").forEach(function (e) { e.remove(); }); scan(); }, stop: function () { mo.disconnect(); } };
  }
  var LAST = null;
  window.WordsBefore = {
    useSource: function (read) { SRC = read || null; if (LAST) LAST.redraw(); },
    mount: function (o) { if (LAST) LAST.stop(); LAST = mount(o); return LAST; },
    current: function () { return LAST; }
  };
})();
