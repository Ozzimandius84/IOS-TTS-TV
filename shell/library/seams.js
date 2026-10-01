/* design/library/seams.js -- THE LIBRARY'S FIVE SEAMS (ZERO-TO-ONE-FOR-DESIGN Z1 Z3 Z5 Z6 Z7 Z17, 1 Oct 2026).

   Osca, 1 Oct: "MAke the finished front end for version ONE ... full scope so the back can plug in when it's made."
   Every screen in design/library/zero.js asks ONE of these objects and nothing else, so the lane that wires a back
   end swaps the SOURCE and touches no drawing -- the same shape as Layers.useSource (design/reader/layers.js).

     FrankAccount  who is looking: a browser (no account), a trial, bought, expired      -> SERVER-3 + SERVER-4 /me
     FrankStuff    every highlight and note from every book, and what was done to each   -> the reader's own records
     FrankGroups  a shelf's group half: share (a code), join, leave, the owner's notes  -> CONTRIB-1 groups/members/
                                                                                            group_works, the join code
     FrankFirstRun the four answers to "What do you read?" and their shelves             -> SHELVES-1b's bundle
                                                                                            (tools/shelves/shelves.json)
     FrankLink     a creator's link: a public book, a named voice, a named person's notes -> RENDER-PUBLISH + CONTRIB-1

   EACH HAS A REAL DEFAULT where the page already holds the back end (the reader's marks ARE in this browser's
   localStorage; a private shelf IS the library record), and an honest refusal where it does not (nothing is shared,
   joined or signed in without Frank's server -- the refusal is a sentence a failure card can print). The design
   bench hands each a SAMPLE source (zero-samples.js, inside the BENCH fences, never shipped).

   source.useSource(src) replaces the whole source; a method the source does not give falls back to the default. */
(function () {
  "use strict";
  var W = window;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function json(k, d) { try { var v = JSON.parse(ls(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function keys(prefix) { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(prefix) === 0) out.push(k); } } catch (e) {} return out; }
  function isWeb() { return !!(W.TTSTVHost && W.TTSTVHost.isWeb); }
  var NO_SERVER = "Frank's server isn't up yet, so this can't reach anyone else.";
  function refuse(why) { return Promise.reject(new Error(why || NO_SERVER)); }
  function seam(name, defaults) {
    var src = null, subs = [];
    var api = { useSource: function (s) { src = s || null; api.changed(); return api; },
                source: function () { return src; },
                on: function (fn) { subs.push(fn); return api; },
                changed: function () { subs.forEach(function (f) { try { f(); } catch (e) {} }); } };
    Object.keys(defaults).forEach(function (k) {
      api[k] = function () { var f = src && typeof src[k] === "function" ? src[k] : defaults[k]; return f.apply(api, arguments); };
    });
    W[name] = api;
    return api;
  }

  /* ---------------------------------------------------------------- Z1 · who is looking
     THE SAME SEAM AS SETTINGS ▸ CLOUD (design/reader/settings-cloud.js, Z2, 7cf8d5e): one account, one back end
     (SERVER-4's GET /entitlement, 23f19be), one contract --
       FrankAccount.useSource(read, write)
         read(cb)   cb(null) = signed out (a BROWSER: on the web they browse, read, listen and search the public shelf),
                    else /entitlement as it is: { state: "trial" | "bought" | "expired", days_left, bought_via, ... }
         write(kind, detail)   "signin" (and Settings' "buy") -- the source signs in, then calls FrankAccount.changed()
     and this page adds what the Library needs on top of it, reading only that:
       now()            -> { state: "browser" | "trial" | "bought" | "expired", daysLeft, name }   (name: Settings ▸
                           Account's, frank.account -- even a guest has one, #183)
       needsAsk(act)    does this act ask "Sign in to keep this" AFTERWARDS? On the web every act beyond browsing does
                        (Osca, 30 Sep: "when a browser tries to do anything more than browse, Frank asks them to sign
                        in"). In the apps a person's marks and private shelves are theirs on the device, so only an act
                        that reaches other people or Frank's cloud asks (ZERO-TO-ONE 4.1): share, join, sync, publish.
       signIn()         -> Promise<now()>: write("signin"), resolved by the source's changed()
       searchScope()    the web's search before SERVER-3: the public shelf only (a line for the Surface)
     The default read is the first-run gate's own key (ttstv.sync.account, settings.js): a Google sign-in there is an
     account, with its days unknown until /entitlement answers; "Not now" or nothing is a browser. With no source there
     is no way to sign in from here, and signIn() says so in words a failure card prints. */
  /* INTEGRATION (1 Oct): the one definition is design/reader/account.js, which library.html loads before this file and
     Settings loads with its look -- the contract above, word for word, in one place. */
  if (!W.FrankAccount || !W.FrankAccount.one) console.warn("[seams] account.js did not load before seams.js: FrankAccount is missing");

  /* ---------------------------------------------------------------- Z5 · Z6 · your stuff from the books
     list() -> Promise<[{ slug, title, author, items: [{ id, kind: "highlight" | "note", colour, quote, note,
                         chapter, chapterTitle, at, review: { state: "again" | "later" | "done", at } | null }] }]>
     mark(slug, id, state | null) -> Promise   (Z6: the three marks; null takes a mark off)
     THE DEFAULT IS THE REAL RECORD. Two stores in this browser already hold a person's marks:
       frank.mine.<slug>               the Mine layer's record {id, kind, colour, made_at, body, anchor:{ids, quote}}
                                       (layers.js keep(); marginalia.js hands every mark made by hand to it, #191)
       ttstv.reader.marginalia.<slug>  the reader's own record {highlights, notes: {id, from, to, colour, text, at}}
     They share ids. The quote comes from Mine (the reader's record keeps word ids only); a reader entry with no Mine
     twin is still listed, by its chapter, so nothing a person made is ever missing here.
     WHERE review LIVES: the plan puts `review: {state, at}` on the highlight record. marginalia.js's normaliser keeps
     only the fields it knows, so until it learns `review` (a one-line request to the reader's lane) the mark lives
     beside the record, frank.review.<slug> = {id: {state, at}}, and is handed out ON each item as `review`. */
  var CH_RE = /^(c\d{3,})\./;
  function chapterOf(rec) {
    var ids = rec && rec.anchor && rec.anchor.ids; var from = rec && (rec.from || (ids && ids[0]));
    var m = CH_RE.exec(String(from || "")); return m ? m[1] : null;
  }
  function deviceList() {
    var bySlug = {};
    function book(slug) { return bySlug[slug] || (bySlug[slug] = { slug: slug, items: {}, order: [] }); }
    function put(slug, it) { var b = book(slug); var was = b.items[it.id]; if (!was) { b.items[it.id] = it; b.order.push(it.id); } else { for (var k in it) if (it[k] != null && (was[k] == null || was[k] === "")) was[k] = it[k]; } }
    keys("frank.mine.").forEach(function (k) {
      var slug = k.slice("frank.mine.".length), list = json(k, []);
      if (!Array.isArray(list)) return;
      list.forEach(function (r) {
        if (!r || !r.id || r.deleted) return;
        if (r.kind !== "highlight" && r.kind !== "note") return;
        var q = r.anchor && r.anchor.quote;
        put(slug, { id: r.id, kind: r.kind, colour: r.colour || null, quote: (q && q.exact) || "", note: r.kind === "note" ? (r.body || "") : "",
                    chapter: chapterOf(r), chapterTitle: r.chapterTitle || null, at: Date.parse(r.made_at || "") || 0, review: null });
      });
    });
    keys("ttstv.reader.marginalia.").forEach(function (k) {
      var slug = k.slice("ttstv.reader.marginalia.".length), rec = json(k, null);
      if (!rec || typeof rec !== "object") return;
      (rec.highlights || []).forEach(function (h) { if (h && h.id && !h.deleted) put(slug, { id: h.id, kind: "highlight", colour: h.colour || null, quote: "", note: "", chapter: chapterOf(h), at: Number(h.at) || 0, review: h.review || null }); });
      (rec.notes || []).forEach(function (n) { if (n && n.id && !n.deleted) put(slug, { id: n.id, kind: "note", colour: n.colour || null, quote: "", note: n.text || "", chapter: chapterOf(n), at: Number(n.at) || 0, review: n.review || null }); });
    });
    /* the books with the newest marks first (localStorage hands keys in no promised order -- WebKit's differs) */
    var out = Object.keys(bySlug).map(function (slug) {
      var b = bySlug[slug], rv = json("frank.review." + slug, {}) || {};
      var items = b.order.map(function (id) { var it = b.items[id]; it.review = rv[id] && rv[id].state ? rv[id] : (it.review && it.review.state ? it.review : null); return it; });   /* the mark this page made, else the one on the reader's record (marginalia.js keeps review since the integration) */
      return { slug: slug, title: null, author: null, items: items };
    }).filter(function (b) { return b.items.length; });
    var last = function (b) { return Math.max.apply(null, b.items.map(function (it) { return it.at || 0; })); };
    out.sort(function (a, b) { return last(b) - last(a) || String(a.slug).localeCompare(String(b.slug)); });
    return out;
  }
  seam("FrankStuff", {
    list: function () { try { return Promise.resolve(deviceList()); } catch (e) { return Promise.reject(e); } },
    mark: function (slug, id, state) {
      var k = "frank.review." + slug, rv = json(k, {}) || {};
      if (state) rv[id] = { state: state, at: Date.now() }; else delete rv[id];
      return lsSet(k, JSON.stringify(rv)) ? Promise.resolve(rv[id] || null) : Promise.reject(new Error("This browser won't keep it (its storage is full or switched off)."));
    }
  });

  /* ---------------------------------------------------------------- Z7 · a shelf's group half
     A PRIVATE shelf is the library record's own (`library.shelves` in library.html, ttstv.reader.library): make,
     name, add, remove, the companion -- all real, all on the device, no seam needed. Sharing makes it a CONTRIB-1
     group (`groups {id, name, owner_uid, code}`, `members`, `group_works {group_id, work_id, position}`):
       share(shelf)            -> Promise<{ group: { id, code, role: "owner" } }>
       unshare(shelf)          -> Promise
       join(code)              -> Promise<{ group: { id, code, name, role: "member", owner: { name } }, works: [slug],
                                            about: { slug: text } }>
       leave(shelf)            -> Promise
       ownerNotes(shelf, slug) -> Promise<[{ id, kind, colour, quote, note, by }]>   the owner's layer (the class shelf, D)
     With no server each refuses with the sentence a failure card prints. */
  seam("FrankGroups", {
    share: function () { return refuse("Sharing a shelf needs Frank's server, which isn't up yet. The shelf is still yours, here."); },
    unshare: function () { return Promise.resolve(); },
    join: function () { return refuse("Joining a shelf needs Frank's server, which isn't up yet."); },
    leave: function () { return Promise.resolve(); },
    ownerNotes: function () { return Promise.resolve([]); }
  });

  /* ---------------------------------------------------------------- Z3 · "What do you read?"
     shelves() -> Promise<{ order: [key], shelves: { key: { answer, line, opens, books: [{ slug, title, author,
                           first_content_chapter: { id, title } }] } } }>
     THE SHAPE IS tools/shelves/shelves.json's (SHELVES-1a v2), with the answer's words added. The default asks the
     bundle the app carries (SHELVES-1b decides where; `../shelves/shelves.json` beside the page is the guess), and
     with none answers null: the question is not asked, and the Library opens as it always did. */
  var ANSWERS = { language: "The original languages", listener: "Audiobooks", "self-educator": "Serious reading", demo: "Just show me" };
  seam("FrankFirstRun", {
    shelves: function () {
      return fetch("../shelves/shelves.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.shelves) return null;
        (d.order || Object.keys(d.shelves)).forEach(function (k) { var s = d.shelves[k]; if (s && !s.answer) s.answer = ANSWERS[k] || k; });
        return d;
      }).catch(function () { return null; });
    },
    answered: function () { return json("frank.firstread", null); },
    answer: function (key, slugs) { lsSet("frank.firstread", JSON.stringify({ key: key, at: Date.now(), books: slugs || [] })); }
  });
  W.FrankFirstRun.ANSWERS = ANSWERS;

  /* ---------------------------------------------------------------- Z17 · the creator's link
     ?read=<slug>&voice=<voice name>&notes=<person> on the Library's address (the web's: what a creator pastes).
     resolve({ read, voice, notes }) -> Promise<{ slug, title, author, voice: { name, chapters, of } | null,
                                                 notes: { by, count } | null, missing: [what] }>
     The default knows the book from the shelf and nothing else: a named voice's renders and a named person's public
     notes are RENDER-PUBLISH's and CONTRIB-1's, so with no server both are `missing`, and the page says so. */
  seam("FrankLink", {
    parse: function (search) {
      var q = new URLSearchParams(search == null ? location.search : search);
      return q.get("read") ? { read: q.get("read"), voice: q.get("voice") || "", notes: q.get("notes") || "" } : null;
    },
    resolve: function (l) {
      var b = null; try { b = (libraryBooks || []).filter(function (x) { return x.slug === l.read; })[0] || null; } catch (e) {}   /* library.html's own rows (a page-level let) */
      var miss = []; if (l.voice) miss.push("voice"); if (l.notes) miss.push("notes");
      return Promise.resolve(b ? { slug: b.slug, title: b.title || b.slug, author: b.author || "", voice: null, notes: null, missing: miss } : null);
    }
  });
})();
