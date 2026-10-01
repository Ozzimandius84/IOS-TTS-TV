/* ENGINE · THE VOICE SEAMS — voices, renders, books, attach, account; one per back end (Z8 · Z9 · Z13)
   · bench: voicepage.html · look: none
   ====================================================================== */
/* design/reader/voicestore.js -- THE VOICE SEAMS (ZERO-TO-ONE-FOR-DESIGN Z8 · Z9 · Z13; DESIGN #197, 1 Oct 2026)

   Osca, 1 Oct: "Make the finished front end for version ONE ... so the back can plug in when it's made."
   Every screen of the voice page (voicepage.js) and the Surface's voice and LibriVox cards (surface.js) asks ONE
   object, window.FrankVoice, for its data. Each back end is ONE seam, and a wiring lane replaces exactly one:

       FrankVoice.useSource('voices',  impl)   the person's voices and the public ones
       FrankVoice.useSource('renders', impl)   what a voice has read; the voices that have read a book
       FrankVoice.useSource('books',   impl)   a book's own "On the web" decision (Z18 P1)
       FrankVoice.useSource('attach',  impl)   the LibriVox press: the offer, the job, its end
       FrankVoice.useSource('account', impl)   who is looking (signed in or not; the owner of a voice)

   Every verb returns a Promise. Until a lane plugs in, the DESIGN source answers from the samples below -- the
   shapes the landed back ends already write, trimmed to what a page reads -- and the sample's STATE is picked by
   `FrankVoice.pick(kind, state)` (band's ?state=, or the page's own ?state=). A page outside /design/ with no
   source plugged in gets EMPTY answers, never the samples: a shipped page with no back end shows "none yet".

   THE SHAPES, and where each comes from (so the wiring lane maps, never re-designs):

   Voice    { id, name, whose, mine, state: private|asking|shared|withdrawn, can_share, why, consent, source,
              sample, langs, made_at, withdrawn_at }
            ← tools/publish B2 `state().voices[]` {voice, public, can, why, consent{whose,agrees,words,at}, books,
              source{recording}} (02ccdeb) for the Mac's own voices; ← server ASSETS-0 `assets` kind=voice
              {hash, voice_id, owner_uid, visibility private|group:|public, consent_at, withdrawn_at} (7fe475e) for
              anyone's. state: visibility public → shared; withdrawn_at → withdrawn; else private. `mine` =
              owner_uid is the viewer (or, on the Mac, the voice is in the depot). can_share false + why = B1's
              voice_refusal, or "not yours to share" when source.recording is someone else's.
            routes: GET /publish (B3, PUBLISH-ROUTES -- not landed) · GET /assets?kind=voice&voice_id= (landed)
   share    POST /publish/voice {name, on:true, whose, agree:true} → (ok, words); the words are CONSENT_WORDS,
            verbatim: "This is my own voice, or I have the speaker's permission, and I agree to it being public."
   withdraw POST /publish/voice {name, on:false} -- takes the consent and every listed render with it (B2).
   make     the Surface's "Use as voice": POST /voice {name, url} (studio _handle_voice, landed) → /state job
            mode:"voice" {phase running|failed|done, err}.
   useFor   choosing the voice for a book: POST /render {slug, voice} (studio, landed) -- the voice is SET, nothing
            renders until Run; plus RENDER-PUBLISH's lookup "already made?" by (work_id, voice_id, engine,
            marks_hash) (voice/library.py, 258b192) so a made render plays with 0 GPU.

   Render   { hash, voice_id, voice, work_id, slug, title, author, cover, chapters, audio[], lit[], rights{us,uk,eu},
              listed, can_list, why, engine, made_at, src(chapter) }
            ← ASSETS-0 `assets` kind=render {hash, work_id, voice_id, engine, marks_hash, book_hash, rights,
              visibility} + B2 `render_row` {listed, can, why, chapters, audio, lit}. listed = visibility public.
            routes: GET /assets?voice_id= · GET /assets?work_id= (landed) · GET /assets/<hash> (the bytes, from the
            store, never Modal -- "plays instantly, no GPU") · POST /publish/render {voice, book, on} (B3, not landed)
            RENDER-PUBLISH (258b192) is what puts a public-domain render into `assets` when it is made.
   THE RIGHTS HOLD (ZERO-TO-ONE §9b, undecided): a render is shown public only when its book is public domain in
            us AND uk AND eu (ASSETS-0 HOST_RESTRICTED = False). Anything else is drawn "stays yours", with why.

   Book     { work_id, slug, title, author, cover, chapters, rights, web{public, can, why, own} }
            ← core Book.rights (426b222) + B2 `book_row` {public, own, can, why}; POST /publish/book {slug, on, own}.

   Offer    { id, book{slug,title,chapters}, recording{id, title, reader, url, seconds, sections}, map{sections,
              matched, chapters, unmatched[]}, estimate_s, where:"mac" }
            ← attach/sections.py (2268196): archive.org /metadata sections → the parsed book's chapters, scored by
              duration and title; `unmatched` are its named misses. estimate_s = recording seconds × the measured
              rtf (0.25 ASR + 0.39 align on 2 CPUs; a Mac is faster, the lane measures it).
            needs: a studio route that answers the map BEFORE the press -- GET /attach/offer?slug=&url= (not built).
   AttachJob{ id, state: aligning|done|failed, section, sections, chapters_done, words_timed, words, eta_s,
              error{what, why, fix} }
            ← POST /attach (studio → tools/search run_attach, landed but runs torch in studio's venv, which the
              shipped Frank does not have: "attach runs on the device" is the ✱ lane's); the job rides /state like
              every other (mode:"attach"). needs: /state job mode "attach" with section i of n and eta_s.

   Account  { signed_in, uid, name }  ← SERVER-3 sessions (23f19be); signed out still plays (Z1: play is free).
   BENCH: nothing here ships until EXPORT; the samples are design fixtures and say so. */
(function () {
  "use strict";
  if (window.FrankVoice) return;

  var DESIGN = /\/design\//.test(location.pathname);
  var SRC = {};                                   /* kind -> the plugged-in implementation */
  var PICK = { voice: "voice", book: "book", attach: "offered", use: "making", account: "in" };
  function pick(kind, state) { if (state) PICK[kind] = state; return PICK[kind]; }

  /* the samples live beside the books the canvas already serves: covers are the real jackets */
  var BOOKS = (function () {
    var here = (document.currentScript && document.currentScript.src) || location.href;
    try { return new URL("../books/", here).href; } catch (e) { return "../books/"; }
  })();
  function cover(slug) { return slug ? BOOKS + slug + "/cover.jpg" : ""; }
  function audioOf(slug, ch) { return BOOKS + slug + "/audio/" + ch + ".wav"; }
  function chs(a, b) { var o = []; for (var i = a; i <= b; i++) o.push("c" + ("00" + i).slice(-3)); return o; }

  var PD = { us: "public-domain", uk: "public-domain", eu: "public-domain" };
  var POEMS_RIGHTS = { us: "public-domain", uk: "restricted", eu: "restricted" };
  var CONSENT_WORDS = "This is my own voice, or I have the speaker's permission, and I agree to it being public.";

  /* THE BOOKS the samples use -- real slugs, titles, chapter counts and rights from books/<slug>/book.json */
  var SHELF = {
    "eclogues-en":  { work_id: "gutenberg:230",  slug: "eclogues-en", title: "The Bucolics and Eclogues", author: "Virgil", chapters: 10, rights: PD },
    "walden":       { work_id: "gutenberg:205",  slug: "walden-and-on-the-duty-of-civil-disobedience", title: "Walden", author: "Henry David Thoreau", chapters: 19, rights: PD },
    "moby-dick":    { work_id: "gutenberg:2701", slug: "moby-dick-or-the-whale", title: "Moby Dick", author: "Herman Melville", chapters: 140, rights: PD },
    "poems":        { work_id: "gutenberg:1567", slug: "poems", title: "Poems", author: "T. S. Eliot", chapters: 25, rights: POEMS_RIGHTS },
    "dolls-house":  { work_id: "gutenberg:2542", slug: "a-dolls-house-a-play", title: "A Doll's House", author: "Henrik Ibsen", chapters: 3, rights: PD }
  };
  function bookOf(k) { var b = SHELF[k]; return b ? Object.assign({ cover: cover(b.slug) }, b) : null; }

  /* THE VOICES. "osca" is the person's own reading (P6, the only road to a public voice today -- FIRST-VOICE found
     every clone on the drive cut from a poet's recording); "eliot-quartets" is one of those, so it is not his to
     share; "frank-ash" stands for a voice someone else shared, seen by a listener. */
  function voiceSample(id, st) {
    var acct = account();
    if (id === "eliot-quartets") return { id: id, name: "eliot-quartets", whose: "T. S. Eliot", mine: !!acct.signed_in, state: "private",
      can_share: false, why: "Cut from “T. S. Eliot reads Four Quartets”, a copy of someone else’s recording — not yours to share.",
      consent: null, source: { recording: "T. S. Eliot reads Four Quartets" }, sample: audioOf("poems", "c001"), langs: ["en"], made_at: "2026-08-30" };
    if (id === "frank-ash") return { id: id, name: "Ash", whose: "Marta R.", mine: false, state: "shared", can_share: false, why: "",
      consent: { whose: "Marta R.", agrees: true, words: CONSENT_WORDS, at: "2026-09-27" }, source: {}, sample: audioOf("poems", "c002"), langs: ["en"], made_at: "2026-09-27" };
    /* the person's own voice: its state is the picked one */
    var mine = st === "private" || st === "asking" || st === "shared" || st === "withdrawn";
    var state = st === "asking" ? "private" : mine ? st : "shared";
    return { id: "osca", name: "Osca", whose: "Osca", mine: mine && !!acct.signed_in, state: state, can_share: true, why: "",
      consent: state === "shared" ? { whose: "Osca", agrees: true, words: CONSENT_WORDS, at: "2026-10-01" } : null,
      source: { recording: "my own reading, recorded on this Mac" }, sample: audioOf("eclogues-en", "c001"), langs: ["en"],
      made_at: "2026-10-01", withdrawn_at: state === "withdrawn" ? "2026-10-01" : null };
  }
  /* WHAT A VOICE HAS READ. Poems is public domain in the US only, so under the stricter line it stays yours */
  function rendersSample(voiceId, st) {
    if (st === "none") return [];
    if (voiceId === "eliot-quartets") return [renderRow("eliot-quartets", "eliot-quartets", "poems", chs(1, 4).concat(["c018", "c021"]), chs(1, 4).concat(["c018", "c021"]), false)];
    if (voiceId === "frank-ash") return [renderRow("frank-ash", "Ash", "dolls-house", chs(1, 3), chs(1, 3), true), renderRow("frank-ash", "Ash", "eclogues-en", chs(1, 10), chs(1, 10), true)];
    var v = voiceSample("osca", st), shared = v.state === "shared";
    return [
      renderRow("osca", "Osca", "eclogues-en", chs(1, 10), chs(1, 10), shared),
      renderRow("osca", "Osca", "walden", chs(1, 4), chs(1, 4), shared),
      renderRow("osca", "Osca", "moby-dick", chs(1, 12), chs(1, 11), shared && st !== "withdrawn"),
      renderRow("osca", "Osca", "poems", chs(2, 5), chs(2, 5), false)
    ];
  }
  function allPD(r) { return !!r && r.us === "public-domain" && r.uk === "public-domain" && r.eu === "public-domain"; }
  function rightsWhy(r) {
    if (allPD(r)) return "";
    if (r && r.uk !== "public-domain") return "Not free in the UK — this reading stays yours.";
    return "Not public domain everywhere yet — this reading stays yours.";
  }
  function renderRow(vid, vname, key, audio, lit, listed) {
    var b = bookOf(key);
    var why = rightsWhy(b.rights);
    return { hash: (vid + ":" + b.work_id).replace(/[^a-z0-9]+/gi, "").slice(0, 16), voice_id: vid, voice: vname, work_id: b.work_id,
      slug: b.slug, title: b.title, author: b.author, cover: b.cover, chapters: b.chapters, audio: audio, lit: lit,
      rights: b.rights, listed: !why && listed, can_list: !why, why: why, engine: "qwen3", made_at: "2026-09-30",
      first: audio[0],
      /* the sample plays a real file the canvas serves (a render's own audio comes from GET /assets/<hash>) */
      src: function (ch) { return b.slug === "poems" ? audioOf("poems", ch && /c00[1-4]|c018|c021/.test(ch) ? ch : "c001") : audioOf("eclogues-en", "c001"); } };
  }
  /* the voices that have read a book */
  function bookVoicesSample(key, st) {
    if (st === "none") return [];
    if (!bookOf(key)) return [];   /* a book the samples do not hold has no reading yet (the Library's book view asks for any slug) */
    var v = voiceSample("osca", st === "owner" || st === "refused" ? "shared" : "voice");
    var mineToo = st === "owner" || st === "refused";
    var rows = [];
    if (key === "poems") {
      rows.push(Object.assign(renderRow("eliot-quartets", "eliot-quartets", "poems", chs(1, 4).concat(["c018", "c021"]), chs(1, 4), false), { mine: mineToo, whose: "T. S. Eliot" }));
      return rows;
    }
    rows.push(Object.assign(renderRow("osca", "Osca", key, key === "eclogues-en" ? chs(1, 10) : chs(1, 4), key === "eclogues-en" ? chs(1, 10) : chs(1, 4), true), { mine: mineToo, whose: "Osca" }));
    rows.push(Object.assign(renderRow("frank-ash", "Ash", key, chs(1, 10), chs(1, 10), true), { mine: false, whose: "Marta R." }));
    return rows;
  }
  function bookSample(key, st) {
    var b = bookOf(key) || bookOf("eclogues-en");
    var why = rightsWhy(b.rights);
    b.web = st === "refused" ? { public: false, can: false, own: false, why: "Not free in the UK. No author date — is this your own writing?" }
          : { public: !why, can: !why, own: false, why: why };
    return b;
  }

  /* THE LIBRIVOX PRESS. Walden, and a reading of it; the sections map is attach/sections.py's shape */
  function offerSample() {
    var b = bookOf("walden");
    return { id: "lv-walden", where: "mac",
      book: { slug: b.slug, title: b.title, author: b.author, chapters: b.chapters, cover: b.cover },
      recording: { id: "walden_librivox", title: "Walden", reader: "LibriVox volunteers", url: "https://archive.org/details/walden_librivox", seconds: 12 * 3600 + 28 * 60, sections: 18 },
      map: { sections: 18, matched: 18, chapters: 18, unmatched: ["On the Duty of Civil Disobedience — not in this reading"] },
      estimate_s: 3 * 3600 + 40 * 60 };
  }
  function jobSample(st) {
    if (st === "aligning") return { id: "att-1", state: "aligning", section: 5, sections: 18, chapters_done: 4, words_timed: 31840, words: 114630, eta_s: 2 * 3600 + 52 * 60 };
    if (st === "done") return { id: "att-1", state: "done", section: 18, sections: 18, chapters_done: 18, words_timed: 114102, words: 114630, eta_s: 0 };
    if (st === "failed") return { id: "att-1", state: "failed", section: 2, sections: 18, chapters_done: 0, words_timed: 0, words: 114630, eta_s: null,
      error: { what: "The reading couldn’t be joined to your Walden.", why: "Its sections match only 2 of your 19 chapters — it may be an abridged reading.", fix: "Try another reading" } };
    return null;
  }

  /* THE USE CARD -- a recording pressed "Use as voice", made, then given a book */
  function useSample(st) {
    var made = { id: "eliot-waste-land", name: "eliot-waste-land", whose: "", mine: true, state: "private", can_share: false,
      why: "Cut from someone else’s recording — not yours to share.", source: { recording: "T. S. Eliot reads The Waste Land" } };
    if (st === "making") return { phase: "running", name: made.name, from: made.source.recording, eta_s: 70 };
    if (st === "failed") return { phase: "failed", name: made.name, from: made.source.recording,
      error: { what: "Frank couldn’t make a voice from this recording.", why: "Music runs under the speech — a voice needs 15 to 30 seconds of one person talking.", fix: "Choose another recording" } };
    return { phase: "done", voice: made, chosen: st === "chosen" ? "eclogues-en" : null };
  }

  function account() {
    var s = PICK.account;
    return s === "out" ? { signed_in: false, uid: null, name: "" } : { signed_in: true, uid: "u-osca", name: "Osca" };
  }

  /* ------------------------------------------------------------------ the verbs (the seam's one face) */
  function sampleOk() { return DESIGN; }
  function P(v) { return Promise.resolve(v); }
  function call(kind, verb, args, fallback) {
    var s = SRC[kind];
    if (s && typeof s[verb] === "function") { try { return Promise.resolve(s[verb].apply(s, args)); } catch (e) { return Promise.reject(e); } }
    return P(sampleOk() ? fallback() : (Array.isArray(fallback()) ? [] : null));
  }
  var listeners = [];
  function changed() { listeners.slice().forEach(function (f) { try { f(); } catch (e) {} }); }

  var Voices = {
    get: function (id) { return call("voices", "get", [id], function () { return voiceSample(id, PICK.voice); }); },
    mine: function () { return call("voices", "mine", [], function () { return [voiceSample("osca", PICK.voice === "voice" ? "shared" : PICK.voice), voiceSample("eliot-quartets")]; }); },
    share: function (id, consent) {
      return call("voices", "share", [id, consent], function () {
        if (!consent || !String(consent.whose || "").trim() || consent.agree !== true) return { ok: false, words: "Say whose voice this is, and tick that they agree." };
        PICK.voice = "shared"; changed(); return { ok: true, words: "Shared. Anyone can hear it, and every reading of a free book in it is listed under it." };
      });
    },
    withdraw: function (id) { return call("voices", "withdraw", [id], function () { PICK.voice = "withdrawn"; changed(); return { ok: true, words: "Withdrawn. No one new can play it, and its readings are off the web." }; }); },
    make: function (recording) { return call("voices", "make", [recording], function () { return useSample(PICK.use); }); },
    useFor: function (voiceId, slugKey) { return call("voices", "useFor", [voiceId, slugKey], function () { PICK.use = "chosen"; changed(); return { ok: true }; }); }
  };
  var Renders = {
    byVoice: function (id) { return call("renders", "byVoice", [id], function () { return rendersSample(id, PICK.voice); }); },
    byWork: function (key) { return call("renders", "byWork", [key], function () { return bookVoicesSample(key, PICK.book); }); },
    setListed: function (hash, on) { return call("renders", "setListed", [hash, on], function () { return { ok: true }; }); },
    /* "already made?" -- RENDER-PUBLISH's lookup; answered before any GPU */
    made: function (voiceId, key) { return call("renders", "made", [voiceId, key], function () { return key === "eclogues-en" ? { hash: "x", chapters: 10, audio: 10 } : null; }); }
  };
  var Books = {
    get: function (key) { return call("books", "get", [key], function () { return bookSample(key, PICK.book); }); },
    shelf: function () { return call("books", "shelf", [], function () { return ["eclogues-en", "walden", "moby-dick", "dolls-house"].map(bookOf); }); },
    setWeb: function (key, on, own) { return call("books", "setWeb", [key, on, own], function () { return { ok: true }; }); }
  };
  var Attach = {
    /* is there a reading for this recording row, and a book on the shelf it joins? null = no press offered */
    offer: function (cand, book) { return call("attach", "offer", [cand, book], function () { return offerSample(); }); },
    start: function (offerId) { return call("attach", "start", [offerId], function () { PICK.attach = "aligning"; changed(); return jobSample("aligning"); }); },
    job: function () { return call("attach", "job", [], function () { return jobSample(PICK.attach); }); },
    stop: function (jobId) { return call("attach", "stop", [jobId], function () { PICK.attach = "offered"; changed(); return { ok: true }; }); },
    /* design only: the recordings a bench search turns up, so the LibriVox row exists without a studio */
    sampleHits: function (q) {
      if (!sampleOk() || SRC.attach) return [];
      var lv = /walden|thoreau|librivox|audiobook/i.test(q || ""), yt = /waste|eliot|voice/i.test(q || "");
      return [{ title: "Walden", author: "Henry David Thoreau", source: "librivox", kind: "audio", url: "https://archive.org/details/walden_librivox",
                duration_s: 12 * 3600 + 28 * 60, chapters: 18, language: "English", license: "Public domain", license_jurisdiction: "US",
                reader: "LibriVox volunteers" },
              { title: "T. S. Eliot reads The Waste Land", author: "T. S. Eliot", source: "youtube", kind: "audio", url: "https://www.youtube.com/watch?v=sample", duration_s: 1574 }]
        .filter(function (c) { return c.source === "librivox" ? lv : yt; });
    }
  };
  function useSource(kind, impl) { SRC[kind] = impl || null; changed(); }

  window.FrankVoice = {
    useSource: useSource, pick: pick, onChange: function (f) { listeners.push(f); }, changed: changed,
    Voices: Voices, Renders: Renders, Books: Books, Attach: Attach,
    account: function () { return SRC.account && SRC.account.now ? SRC.account.now() : (sampleOk() ? account() : { signed_in: false }); },
    allPD: allPD, rightsWhy: rightsWhy, CONSENT_WORDS: CONSENT_WORDS, design: DESIGN
  };
})();
