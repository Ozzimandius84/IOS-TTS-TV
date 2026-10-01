/* design/reader/pair.js -- TWO TRANSLATIONS, SIDE BY SIDE (Z11, 1 Oct 2026)

   ZERO-TO-ONE §0b B ("compare translations", in 1.0 -- Osca, 29 Sep); ZERO-TO-ONE-FOR-DESIGN Z11: "a same-language
   pair (Odyssey, Butler <-> Butcher & Lang) side by side, with a heading that names the two translators. The
   two-languages face (#119) stays for a stitched pair." So this is the face of a pair whose two sides share a
   language -- told apart by their translators, not by `lang` (stitch/build.py: meta.stitch.same_lang, labels). A
   stitched pair in two languages keeps #119's face (the second language's lines in the italic) and never comes here.

   THE PAGE. The heading names both translators. On a window: two columns, each headed by its translator, a passage
   and its partner side by side on one row, so the eye goes across; pressing a passage lights its partner. Where one
   translation has a passage the other lacks (a translator's own note, a line one of them left out), the other
   column says so in one quiet line and the row stays. On the phone upright there is no room for two columns: each
   passage is followed by its partner in the second translation, in the italic at 80 % ink (#119's face, the same
   reason: the eye knows which is which without reading a label); on its side, the two columns come back.

   THE ONE SEAM. Pair.useSource(read): read(slug, cb) -> cb(doc) with
     { same_lang: true, labels: { a, b }, book: { title, author, lang },
       chapters: [{ id, title, units: [{ id, side: "a"|"b", text, pair: [ids], note? }] }] }
   which is a same-language stitched book as the reader holds it: book-data.js's paragraphs in their order, each
   joined with stitch.json's paragraphs[id] = {side, pair} (PAIR-SAME 0c1e6aa). The bench hands pair-samples.js. */
(function () {
  "use strict";
  var R = document.documentElement, SRC = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function surname(label) { return String(label || "").split(/\s*&\s*|\s+and\s+/).map(function (n) { return n.trim().split(/\s+/).pop(); }).join(" & "); }
  /* the rows: a run of side-a units then the side-b units they pair with is one row; a unit with no partner is a
     row of its own, its other side empty */
  function rows(units) {
    var out = [], i = 0;
    while (i < units.length) {
      var u = units[i];
      if (!u.pair || !u.pair.length) { out.push(u.side === "a" ? { a: [u], b: [] } : { a: [], b: [u] }); i++; continue; }
      var row = { a: [], b: [] }, want = {};
      var take = function (x) { row[x.side].push(x); (x.pair || []).forEach(function (p) { want[p] = 1; }); i++; };
      take(u);
      while (i < units.length && (want[units[i].id] || (units[i].side === u.side && (units[i].pair || []).some(function (p) { return want[p]; })))) take(units[i]);
      out.push(row);
    }
    return out;
  }
  function mount(el, o) {
    o = o || {};
    el.classList.add("pr");
    el.innerHTML = '<div class="pr-wait"></div>';
    var read = SRC || function (slug, cb) { cb(window.PAIR_SAMPLE || null); };
    read(o.slug || "", function (doc) {
      if (!doc) { el.innerHTML = ""; if (window.TellFrank) el.appendChild(TellFrank.failure({ kind: "Two translations", what: "The pair couldn’t be opened.", why: "One of its two books is missing from this device.", fix: "Open the books" })); return; }
      var L = doc.labels || {}, ch = (doc.chapters || [])[o.chapter || 0] || { units: [] };
      var rs = rows(ch.units || []), sa = surname(L.a), sb = surname(L.b);
      el.innerHTML = '<header class="pr-head"><h1>' + esc(ch.title || "") + '</h1>'
        + '<p class="pr-by"><span class="pr-ta">' + esc(L.a) + '</span><span class="pr-and" aria-hidden="true"> · </span><span class="pr-tb">' + esc(L.b) + '</span></p></header>'
        + '<div class="pr-cols" role="presentation"><div class="pr-colhead pr-ca">' + esc(sa) + '</div><div class="pr-colhead pr-cb">' + esc(sb) + '</div></div>'
        + '<div class="pr-rows">' + rs.map(function (r, k) {
            function cell(side, list, other) {
              if (!list.length) return '<div class="pr-cell pr-' + side + ' pr-lack"><p class="pr-none">Not in ' + esc(side === "a" ? sa : sb) + (other[0] && other[0].note ? ' — a note of ' + esc(side === "a" ? sb : sa) + '’s own' : '') + '</p></div>';
              return '<div class="pr-cell pr-' + side + (list[0].note ? ' pr-isnote' : '') + '" data-row="' + k + '">' + list.map(function (u) { return '<p data-id="' + esc(u.id) + '"' + (doc.book && doc.book.lang ? ' lang="' + esc(doc.book.lang) + '"' : '') + '>' + (u.note ? '<span class="pr-notek">' + esc(side === "a" ? sa : sb) + '’s note</span>' : '') + esc(u.text) + '</p>'; }).join("") + '</div>';
            }
            return '<div class="pr-row" data-row="' + k + '">' + cell("a", r.a, r.b) + cell("b", r.b, r.a) + '</div>';
          }).join("") + '</div>';
      el.querySelectorAll(".pr-cell:not(.pr-lack)").forEach(function (c) {
        c.addEventListener("click", function () { var row = c.parentNode, on = !row.hasAttribute("data-lit"); el.querySelectorAll(".pr-row[data-lit]").forEach(function (x) { x.removeAttribute("data-lit"); }); if (on) row.setAttribute("data-lit", ""); });
      });
      if (o.ready) o.ready(el, doc);
    });
  }
  window.Pair = { useSource: function (read) { SRC = read || null; }, mount: mount, rows: rows };
})();
