/* ENGINE · THE SEARCH SURFACE — the query, the one list, and the works
   · bench: bench-surface.html · look: surface.css
   ====================================================================== */
/* Osca, 7 September: *"SEARCH IS THE SURFACE, AND STUDIO LIVES IN IT ...
   Search stops being a bar field and becomes a shell-level surface openable
   from the Library and the reader, over whatever you're on."*

   WHAT THIS FILE IS. A surface that MOUNTS, not a page you navigate to:

       SearchSurface.mount({...})   once, per window
       SearchSurface.open("q")      over whatever is already there
       SearchSurface.close()        and you are back on it, unmoved

   so the Library and the reader each get it with one script tag and one
   line, and neither becomes a place you leave. `search.html` -- the 1280x800
   window `tabs.rs::open_search` builds -- is NOT touched by this file and
   still works; this is the thing that replaces it, and Osca reacts to it
   before anything is unplugged.

   THE THREE PARTS, and they are one surface:

     1 FIELD     the query, typed once, at the top. The bar upstairs keeps
                 only the DOOR to here.
     2 RESULTS   your library AND out there, in ONE list. Told apart by the
                 spine (surface.css), never by a badge and never by being in
                 two different lanes.
     3 THE WORKS the pipeline, in the right-hand column, on the screen the
                 whole time. Pulling a result in is an ingest, and the row it
                 came from becomes the working row -- IN PLACE. It does not
                 jump to another surface, because there is no other surface.

   THE ONE MECHANIC WORTH THE NAME: a row has a STATE, not a lane.

       out  ──Add──▶  work  ──the pipeline──▶  shelf

   Same row, same position in the list until it is promoted to WORKING at the
   top. That is the whole of "pulling an external result in = ingest -> parse
   (it joins the library)": the row you pressed is the book you now have.

   WHERE THE DATA COMES FROM, and every one of them is a route studio
   already serves -- this file adds none:
     yours       GET /state  -> .books        (studio/bookinfo.py: shelf_of)
     one book    GET /book?slug=              (the other half of that split:
                 the chapter rows and their eight state cells. The step grid
                 is THOSE cells; nothing here invents one.)
     out there   GET /search?title=           (tools/search, through studio)
     the works   GET /state  -> .job, .pending, .ingests, .importing,
                 .reparsing, .reparses
     adding      POST /stage_for_ingest then POST /ingest, in that order
                 (library/library.html::parseSearchResult -> ingest)
     the door    TTSTVHost.openReader(slug), and `reader.html?book=books/<slug>`
                 where there is no host (bar/askbar.js::take's own two cases)
   With no server behind the page -- a file:// open, the design bench -- every
   one of those falls back to a MOCK, and the mock says so on the page. With
   one behind it NOTHING here is mocked, and the page says nothing about
   mocks: `S.live` is the whole of the difference and it is read from the
   protocol, once, at mount. */
(function () {
  "use strict";

  /* studio/state.py STEPS, in its order and its length. Not retyped as a
     display list: the coarse three are a FOLD of these eight, so a step the
     port adds cannot come out here as a blank. */
  var STEPS = ["parse", "interpret", "speak", "restitch",
               "align", "prosody", "dict", "export"];
  /* the coarse fold, for the row ribbon when eight cells is furniture:
     parse = getting the text, voice = making the sound, ready = a bundle */
  var COARSE = [["parse", "interpret"],
                ["speak", "restitch", "align", "prosody"],
                ["dict", "export"]];

  /* bar/lanes.js's eight hues, and its rule: a hash of the identity, so a
     book keeps its colour while the ones beside it come and go. One colour
     per book, everywhere in the application. */
  var HUES = ["#8c2f2f", "#2f6b8c", "#7a5c1e", "#3f7a4a", "#6b3f7a",
              "#2f7a76", "#a8532a", "#4a4a8c"];
  function hue(key) {
    var h = 0, s = String(key || "");
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return HUES[Math.abs(h) % HUES.length];
  }

  /* --------------------------------------------- COLOUR IS IDENTITY, HELD
     Osca, 8 Sep (Round 2 item 3): *"Colour is per-book identity, HELD for the
     job's life. Assign at enqueue, keyed to job/slug -- NEVER to queue
     position. When book 1 finishes and book 2 moves up, book 2 keeps its own
     colour. Same stable colour everywhere that book appears."*

     `hue()` was already a hash of an identity string and never of a position,
     so the second half of that sentence was already true. THE HALF THAT WAS
     NOT: a book has more than one identity over its life, and the hash of
     each is a different colour.

         out there   key `o:https://www.gutenberg.org/ebooks/3800…`
         staging     source `search/3800.epub`      (/stage_for_ingest's answer)
         importing   slug `the-ethics`              (/state's own field)
         on the shelf  slug `the-ethics`

     Measured before this change, for one book carried the whole way:
     `#3f7a4a` as a result row, `#2f6b8c` once it was on the shelf. It changed
     colour at the moment it arrived -- which is the moment a person is most
     likely to be watching it.

     So the colour is assigned ONCE, into `HELD`, and every later name for the
     same book is ALIASED to it. `hueFor` never recomputes a key it has seen;
     `holdAs` is what a work row calls when it learns its next name. Nothing
     is ever removed from `HELD`: a book that finishes and is searched for
     again an hour later is the same book, and comes back the same colour. */
  var HELD = {};
  function hueFor(key) {
    key = String(key || "");
    if (!key) return HUES[0];
    if (!HELD[key]) HELD[key] = hue(key);
    return HELD[key];
  }
  /* `from` already has a colour (or is about to get one); `to` is the same
     book under a new name. After this they are one colour, for good. */
  function holdAs(from, to) {
    if (!to || !from || from === to) return hueFor(to || from);
    var h = hueFor(from);
    HELD[String(to)] = h;
    return h;
  }

  var SOURCE = { gutenberg: "Gutenberg", archive: "Archive", librivox: "LibriVox",
                 youtube: "YouTube", dokumen: "Dokumen", fadedpage: "Faded Page" };
  /* every source the app already covers -- the -site: list is built from this
     and nowhere else (search.html's own COVERED, kept identical) */
  var COVERED = ["gutenberg.org", "archive.org", "youtube.com",
                 "wikipedia.org", "wiktionary.org"];

  /* ------------------------------------------------------- WHERE STUDIO IS
     ONE LINE, AND A LARGE CONSEQUENCE (PROMPTS/surface-search-studio.md §2.1).
     This used to be `location.origin`, assumed. That is right in Frank -- the
     shell loads `clean/...` off studio's own origin -- and it is why the
     design bench could never be anything but mocked: a bench is a page, and a
     page that can only ask its own origin can only ask whoever served it.

     So the base is read, in this order, and `S.base` is the answer:
       ?api=<origin>   the bench's LIVE switch, and a test's
       ?mock=1         force the mock even on studio's own origin, so the two
                       can be compared side by side on one machine
       <meta name="ttstv-api" content="...">    a page that is hosted apart
       location.origin the app, and every page studio serves -- unchanged
       the pairing    the phone, whose pages are not http(s) at all: the
                      Studio it paired with, and the token to talk to it.
                      13 Sep -- the section below this one is the whole of it

     WHAT IT DOES NOT BUY, and saying so is the point of writing it down: a
     base on ANOTHER origin is a cross-origin fetch, and studio's loopback
     listener sends no `Access-Control-Allow-Origin` (only the LAN sync
     listener does, and it answers `/sync/*` alone). So `?api=` pointing
     somewhere else is refused by the browser, not by this file. The bench's
     LIVE button therefore does the one thing that works: it RE-OPENS the
     bench from studio, at studio's own origin, with `?api=` pinned -- same
     page, same switches, same origin, and the fetches are ordinary.
     `?api=` is still what makes that possible, because the bench has to be
     able to say which studio it came back from. */
  /* ------------------------------------ AN ORIGIN THE PHONE CAN HAVE (13 Sep)
     G-STUDIOPHONE. Osca, 12 Sep: *"It will not ship on the 13th without
     studio on the phone."*

     THE BUG, IN ONE LINE. The `location.protocol` test below is the last
     step of the base, and on the phone it is false: Frank's pages are
     `frank://localhost` (iOS) and `tauri://localhost`, not http(s). So the
     base was "", `S.live` was false, and the whole surface -- the shelf, the
     search, the works, every control -- was the bench's mock on a device
     that had a Studio on the same Wi-Fi and a token to talk to it with.

     WHERE THE ANSWER ALREADY WAS. The phone pairs with a Studio in
     Settings -> Transfer: six digits typed once, and
     `settings/settings.js::pairFromPicker` writes ONE key --

         localStorage["ttstv.sync.pair"] = {base, token, name, paired}

     -- where `base` is `http://<lan>:<port>` of that Studio's SECOND
     listener (`studio/serve.py::SyncListener`, bound `0.0.0.0`) and `token`
     is what `studio/sync.py::Pairing.pair` handed back. That record is the
     origin and the pass, and until today nothing but the Sync button read
     it. This function is the second reader.

     A BASE WITHOUT A TOKEN IS NOT A STUDIO, and that is why both halves are
     required here. The LAN listener answers `/sync/hello` and `/sync/pair`
     to anyone and 404s everything else without a paired token
     (`sync_path_allowed`), so a page that took the base alone would come up
     `S.live` and then fail every single call -- which is precisely the
     "true or absent, never both" fault this lane exists to end. No token,
     no origin.

     `TTSTVHost.studioUrl` is honoured for the base when a host offers one
     (no host does today; `Frank/src-tauri/src/lib.rs` injects `syncDiscover`
     and not this), because the day one does, it is the better answer than a
     record a person could have left behind. The token still comes off the
     record: a host that knows the address does not thereby know the pass. */
  var PAIR_KEY = "ttstv.sync.pair";   /* settings/settings.js SYNC_PAIR_KEY */
  function pairBase(s) {
    s = String(s == null ? "" : s).trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(s) ? s : "";
  }
  function pairedStudio() {
    var rec = null, hostUrl = "";
    try { rec = JSON.parse(window.localStorage.getItem(PAIR_KEY) || "null"); } catch (e) { rec = null; }
    try {
      var h = window.TTSTVHost;
      if (h && typeof h.studioUrl === "string") hostUrl = h.studioUrl;
      else if (h && typeof h.studioUrl === "function") hostUrl = h.studioUrl();
    } catch (e) { hostUrl = ""; }
    var base = pairBase(hostUrl) || pairBase(rec && rec.base);
    var tok = (rec && typeof rec.token === "string" && rec.token) ? rec.token : "";
    if (!base || !tok) return null;
    return { base: base, token: tok, name: (rec && rec.name) || "" };
  }
  var PAIRED = null;   /* the record `api()` puts the pass on, or null       */

  /* Is this page inside Frank? `TTSTVHost` is injected into every page the
     app opens -- `desktop/src/host.js` on the Mac, `lib.rs::HOST_JS` on the
     phone -- and into no page a plain browser opens. It is the ONLY honest
     way to tell "Frank, with no studio" from "the design bench", and it is
     what `S.bench` is decided by (see `S.bench`). */
  function hostHere() {
    try { return !!window.TTSTVHost; } catch (e) { return false; }
  }
  /* THE SENTENCE, and there is one of it. A page with no studio says which
     of the two it is and, in Frank, what to do about it -- "Studio is not
     here" with no next step is the half-answer the phone was giving. */
  function noStudioLine() {
    return S.bench
      ? "No server behind this page — these rows are the mock."
      : (PAIRED
          ? "Can't reach Studio at " + PAIRED.base + " — same Wi-Fi?"
          : "Not paired with a Studio — pair in Settings ▸ Transfer, then this fills in.");
  }

  var BASE = (function () {
    var q = "";
    try { q = String(location.search || ""); } catch (e) { q = ""; }
    if (/[?&]mock=1\b/.test(q)) return "";
    var m = /[?&]api=([^&]*)/.exec(q);
    if (m) {
      try { return decodeURIComponent(m[1]).replace(/\/+$/, ""); } catch (e) { return ""; }
    }
    var tag = document.querySelector && document.querySelector('meta[name="ttstv-api"]');
    if (tag && tag.getAttribute("content"))
      return tag.getAttribute("content").replace(/\/+$/, "");
    if (/^https?:$/.test(location.protocol)) return location.origin;
    /* G-STUDIOPHONE, 13 Sep: and when it is not http(s), THE PAIRING. See
       `pairedStudio` above -- this is the phone, and this line is the whole
       of "an origin the phone can have". */
    PAIRED = pairedStudio();
    return PAIRED ? PAIRED.base : "";
  })();
  /* THE TOKEN RIDES ON EVERY CALL, and in exactly one place -- `api()` is
     what every fetch in this file goes through, so the pass is added once
     rather than at forty call sites. `t=` in the query string, never a
     header: `studio/serve.py::SyncHandler` reads `?t=`, and a simple request
     keeps a GET of a big payload to one round trip instead of a preflight
     (that server's own note, and `settings/settings.js::syncUrl` does the
     same thing for the same reason).

     `path` may already carry a query (`/search?title=...`), so the joiner is
     read off the path rather than assumed.

     ON THE MAC `PAIRED` IS NULL AND THIS RETURNS `BASE + path` -- the same
     string, character for character, that it returned before this change.
     That is not a hope: Studio's own page is http(s), so the IIFE above has
     already returned at `location.origin` and `pairedStudio()` was never
     called. */
  function api(path) {
    if (!BASE) return null;
    if (!PAIRED) return BASE + path;
    return BASE + path + (path.indexOf("?") >= 0 ? "&" : "?")
         + "t=" + encodeURIComponent(PAIRED.token);
  }

  /* EVERY FETCH IN THIS FILE HAS A CLOCK ON IT (8 Sep). "Couldn't reach the
     search" was the page's word for a `fetch()` that never resolved, and a
     promise with nothing watching it never resolves and never rejects: the
     row said "Searching..." for ever, or the catch fired minutes later with
     a message that named nothing. `/search` answers inside
     `sources.SEARCH_BUDGET` (25 s) by construction, so a wait past 40 s is
     not slowness, it is a route that is not coming back -- and that is a
     different sentence from "the search is down".

     `AbortController` where there is one; a plain race where there is not,
     which still gives the honest message even though the socket keeps
     going. The rejection carries the ROUTE and the WORD, never a bare
     "failed to fetch". */
  function ask_(url, ms, init) {
    init = init || {};
    var ctl = null;
    try { if (window.AbortController) { ctl = new AbortController(); init.signal = ctl.signal; } } catch (e) {}
    var timer = null;
    var timeout = new Promise(function (_ok, bad) {
      timer = setTimeout(function () {
        if (ctl) { try { ctl.abort(); } catch (e) {} }
        bad(new Error("no answer in " + Math.round(ms / 1000) + "s"));
      }, ms);
    });
    return Promise.race([fetch(url, init), timeout])
      .then(function (r) { clearTimeout(timer); return r; },
            function (e) { clearTimeout(timer); throw e; });
  }
  /* the route and the failure, in the words a person can act on -- never the
     browser's own "TypeError: Failed to fetch", which names nothing */
  function why(route, e) {
    var m = (e && e.message) || String(e || "");
    if (/failed to fetch|networkerror|load failed/i.test(m))
      m = "studio did not answer at all";
    return route + " — " + m;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* diacritic-blind: this library is half in French, Latin and Greek, and a
     person typing "eclogues" means Eclogues too (askbar.js's own norm) */
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s;
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------------------------------------------------------------- THE MOCK
     What a plain browser draws, with no server to ask. Four on the shelf,
     four out there -- enough that the mixing, the spine and the promotion
     can all be looked at and measured. */
  /* IN `/state`'s OWN SHAPE, field for field (studio/bookinfo.py::shelf_of),
     so the mock cannot teach this file to read a payload studio never sends
     -- which is precisely how the first version came to ask for `audio_s`. */
  var MOCK_SHELF = [
    /* G-SURF2: `source` in the shape `bookinfo.book_summary` sends it --
       `kind`, `file`, `path`, `origin` -- and the three cases a shelf really
       holds: a book dropped in by hand (no origin: there never was one), a
       book that came through Search (its origin, recorded at add time), and
       a book whose FILE named where it came from. The first path is a real
       book.json's own. */
    { slug: "eclogues-virgil", title: "Eclogues", author: "Virgil", lang: "la",
      chapters_n: 10, parsed: 10, voiced: 10, aligned: 10, dict_ok: true,
      has_audio: true, has_timings: true,
      source: { kind: "epub", file: "Eclogues Virgil.epub",
                path: "/Volumes/Ex_Repo/github/TTS_APP/TTS_APP/tts_data/sources/epubs/Eclogues Virgil.epub",
                origin: null } },
    { slug: "ethics-spinoza", title: "Ethics", author: "Benedictus de Spinoza", lang: "la",
      chapters_n: 5, parsed: 5, voiced: 0, aligned: 0, dict_ok: false,
      has_audio: false, has_timings: false,
      source: { kind: "epub", file: "gutenberg-ethics.epub",
                path: "/Volumes/Ex_Repo/github/TTS_APP/TTS_APP/tts_data/sources/search/gutenberg-ethics.epub",
                origin: { source: "gutenberg", id: "3800", from: "search",
                          url: "https://www.gutenberg.org/ebooks/3800.epub3.images" } } },
    { slug: "fictions-borges", title: "Ficciones", author: "Jorge Luis Borges", lang: "es",
      chapters_n: 17, parsed: 17, voiced: 9, aligned: 9, dict_ok: true,
      has_audio: true, has_timings: true,
      source: { kind: "epub", file: "ficciones.epub",
                path: "/Volumes/Ex_Repo/github/TTS_APP/TTS_APP/tts_data/sources/epubs/ficciones.epub",
                origin: { url: "https://example.org/ficciones", from: "file" } } }
  ];
  /* ITEM 9, AND ITEMS 4-6 ARE WHY. These rows carry the fields a real
     `Candidate` carries (`tools/search/candidate.py`) and the old mock did
     not -- `word_count`, `chapters`, `size_bytes`, `popularity`, `format`,
     `language`, `license`/`license_status`/`license_jurisdiction`, `note`,
     `linked_id`. Without them the bench drew four bare rows and none of item
     4's metadata, item 5's source-vs-author truncation or item 6's three
     states could be looked at at all.

     THE FOUR ROWS ARE FOUR CASES, on purpose:
       1  the ordinary Gutenberg text -- TEXT ONLY, and a `pg:` token whose
          partner IS in `MOCK_MEDIA`, so it draws TEXT + AUDIO
       2  a text with a deliberately ENORMOUS author string, which is item 5's
          whole test: the source must still be on the row
       3  a big archive scan -- size, downloads, a jurisdiction on the licence
       4  a text with a long `note`, which is item 4's "don't drop data
          because it's long" */
  var MOCK_OUT = [
    { title: "Ethics", author: "Benedictus de Spinoza", source: "gutenberg",
      url: "https://www.gutenberg.org/ebooks/3800.epub3.images", kind: "text",
      source_id: "3800", language: "en", format: "epub", direct_download: true,
      word_count: 121400, chapters: 5, size_bytes: 612000, popularity: 4120,
      license: "Public domain in the USA.", license_status: "clear",
      license_jurisdiction: "US", linked_id: "pg:3800",
      note: "from Project Gutenberg's own catalogue (offline)" },
    { title: "On the Improvement of the Understanding",
      author: "Benedictus de Spinoza, translated from the Latin by R. H. M. Elwes, with an introduction",
      source: "gutenberg", url: "https://www.gutenberg.org/ebooks/1016.epub3.images",
      kind: "text", source_id: "1016", language: "en", format: "epub",
      direct_download: true, word_count: 24800, size_bytes: 180000, popularity: 900,
      license_status: "clear", license_jurisdiction: "US" },
    { title: "The Ethics of Benedict de Spinoza", author: "Benedictus de Spinoza",
      source: "archive", url: "https://archive.org/details/ethicsofbenedict00spin",
      kind: "text", source_id: "ethicsofbenedict00spin", language: "en",
      size_bytes: 21000000, popularity: 3300, chapters: 5,
      license: "Public Domain Mark 1.0", license_status: "clear",
      license_jurisdiction: "US" },
    { title: "Ethic, demonstrated in geometrical order", author: "Benedictus de Spinoza",
      source: "archive", url: "https://archive.org/details/ethicdemonstrate00spin",
      kind: "text", source_id: "ethicdemonstrate00spin", size_bytes: 34000000,
      note: "a 1883 scan in five parts; the OCR is uneven in Part III and the "
          + "plates between pages 88 and 89 are bound out of order, which the "
          + "parser will read as two short chapters rather than one long one",
      /* the OTHER half of the guessed pair in MOCK_MEDIA. `pair.py`'s
         `suggest_pairs` puts the token on BOTH halves, so a bench that put it
         on one would be showing a pairing the real grouping never makes. */
      linked_id: "guess:ethica-latin-reading" }
  ];
  /* RECORDINGS, in the same shape a real candidate has -- a url that is a
     PARTICULAR item and never a query, because that is the thing the Video
     lane is for and a mock that cheated here would teach the wrong design. */
  var MOCK_MEDIA = [
    /* one video that IS both halves (`yt:`), one recording the source itself
       paired to a Gutenberg text (`pg:3800`, whose partner is MOCK_OUT[0]),
       and one recording paired only by a GUESS -- so all three strengths of
       item 6's "text + audio" can be told apart on the bench */
    { title: "The Ethics (Part I) — full audiobook", author: "LibriVox", source: "youtube",
      url: "https://www.youtube.com/watch?v=MOCKvideoid1", kind: "audio",
      duration_s: 9240, source_id: "MOCKvideoid1", linked_id: "yt:MOCKvideoid1",
      transcript: "Concerning God. Definitions. I. By that which is self-caused, "
                + "I mean that of which the essence involves existence, or that of "
                + "which the nature is only conceivable as existent." },
    { title: "Spinoza's Ethics, Part I", author: "LibriVox", source: "librivox",
      url: "https://librivox.org/the-ethics-by-baruch-spinoza/", kind: "audio",
      duration_s: 33000, chapters: 5, size_bytes: 240000000,
      linked_id: "pg:3800", reads_text: "https://www.gutenberg.org/ebooks/3800",
      license_status: "clear", license_jurisdiction: "US" },
    { title: "Ethica ordine geometrico demonstrata (read in Latin)", author: "anonymous",
      source: "archive", url: "https://archive.org/details/ethica-latin-reading",
      kind: "audio", duration_s: 27600, linked_id: "guess:ethica-latin-reading" },
    /* THE THIRD STATE, and the bench had no way to show it: every other
       recording here is paired, so `audio only` never rendered. Item 9's rule
       is that the bench is brought UP to the surface -- a state the surface
       can draw and the bench cannot is the bench being the ceiling, which is
       the one thing it must never be. An unpaired recording, which is what
       most of them are. */
    { title: "Spinoza — a lecture", author: "unattributed", source: "youtube",
      url: "https://www.youtube.com/watch?v=MOCKlecture", kind: "audio",
      duration_s: 3120, source_id: "MOCKlecture" }
  ];

  /* ------------------------------------------------ THE MOCK'S OWN STUDIO
     §5.9, Osca 8 Sep: *"design/reader/bench-surface.html must be updated with
     every surface change. The bench is drifting from the app ... it stays a
     faithful place to design and test surface."*

     THE DRIFT WAS ONE LINE, and it was mine: `drawWorks` drew the studio only
     `if (S.live)`, so §4's four choice rows -- the whole of that step -- could
     not be looked at on the bench AT ALL. A design surface that cannot show
     the thing being designed is not a bench.

     So the mock has a studio, and every row of it is LIFTED VERBATIM from the
     fixtures the real studio code generated (`surface-fixtures/voices.json`,
     `engines.json`, `kaggle-on.json`) -- trimmed to the fields the surface
     reads and nothing invented. That is the same rule `MOCK_SHELF` is under:
     the mock must not be able to teach this file to read a payload studio
     would never send. One voice PASSES refguard at 100 %, one is REFUSED at
     83 %; one lane runs and two are dashed with the server's own sentences;
     the local engine list is genuinely empty, which is what a Mac with no
     `voice/.venv` really answers.

     A MOCKED CONTROL STILL MOVES, AND STILL SAYS IT IS MOCKED. Pressing a
     pill on the bench changes the mock's own state and posts nothing -- that
     is what makes hover, selection and the dashed pills judgeable -- and the
     block carries one line saying so, the same way the list's mock does. */
  var MOCK_VOICES = [
    { name: "ashbery", seconds: 26.0, clip: "/voice-clip?name=ashbery",
      transcript: "The pool where the wave is broken, and the pattern of it holds.",
      reference: { ok: true, coverage: 1.0, stale: false, refusal: null },
      blocked: null, reimportable: true },
    { name: "merrill-intro", seconds: 31.0, clip: "/voice-clip?name=merrill-intro",
      transcript: "Admittedly I err by undertaking this in your presence.",
      reference: { ok: false, coverage: 0.83, stale: false,
        refusal: "the transcript describes 83 % of a 31.0 s clip; ICL reads the "
               + "untranscribed tail as noise. Re-cut it or fix the transcript." },
      blocked: { refusal: "the transcript describes 83 % of a 31.0 s clip; ICL reads the "
                        + "untranscribed tail as noise. Re-cut it or fix the transcript.",
                 from: "reference-check.json" },
      reimportable: true }
  ];
  var MOCK_ENGINE_ROWS = [
    { id: "qwen3", ok: true, why: null, sentence: "qwen3 is installed by the kernel at push time" },
    { id: "moss", ok: true, why: null, sentence: "moss is installed by the kernel at push time" },
    { id: "orpheus", ok: true, why: null, sentence: "orpheus is installed by the kernel at push time" },
    { id: "chatterbox", ok: true, why: null, sentence: "chatterbox is offered on Kaggle only" }
  ];
  var MOCK_ENGINES = {
    engines: [{ id: "qwen3", limits: [
      "no phoneme input -- Latin and Greek go through the dub path (MMS preset, then Seed-VC)",
      "no instruction control -- registers fall back to reference windows",
      "max context 655 s -- chunks are capped",
      "every reference clip needs its transcript -- a slice with none falls back to a speaker vector"] }],
    by_destination: { local: [], kaggle: MOCK_ENGINE_ROWS, modal: MOCK_ENGINE_ROWS },
    "default": "qwen3", error: null
  };
  var MOCK_KAGGLE = {
    connected: true, credentials_present: true, username: "osca",
    destinations: {
      where: "kaggle", "default": "kaggle", chosen: true, choice: true,
      installed_here: [], default_reason: null,
      local:  { id: "local", label: "Here, on this Mac", pill: "This Mac", ok: false,
                short: "Install a model in Settings to render here.",
                why: "qwen3 is not installed here: voice/.venv/ does not exist." },
      /* `destinations()` puts the free GPU's own numbers here and the bench
         has them too, or the Where row's second line cannot be looked at */
      kaggle: { id: "kaggle", label: "On Kaggle", pill: "Kaggle", ok: true,
                short: null, why: null, running: [], hours_left: 27.4, slots: 2 },
      modal:  { id: "modal", label: "Fast, on Modal", pill: "Fast", ok: false,
                short: "Modal is not connected on this Mac.",
                why: "no Modal credentials at ~/.modal.toml" }
    }
  };
  var MOCK_SETTINGS = { render: { where: "kaggle" }, chosen: true,
                        modal: { connected: false } };
  /* §5.9: THE WORKING QUEUE, so the bench shows the column BUSY -- which is
     the state the whole right-hand design is for and the one a still page
     cannot reach. `/state`'s own two fields, in its own shapes: a running
     `job`, and `pending` batches of rows. */
  var MOCK_JOB = { mode: "push", phase: "running", slug: "fictions-borges",
                   chapter: "c010", step: "speak", where: "kaggle",
                   elapsed: "4:12", queue_word: "Voicing" };
  var MOCK_PENDING = [
    { items: [{ id: 91, slug: "fictions-borges", unit: "c011", voice: "ashbery" },
              { id: 92, slug: "fictions-borges", unit: "c012", voice: "ashbery" },
              { id: 93, slug: "ethics-spinoza", unit: "c001", voice: "merrill-intro" }] }
  ];

  /* and a report with one of each state in it, so the bench can be looked at
     with a source down, a source off and a source that simply had nothing */
  var MOCK_SOURCES = {
    gutenberg: { count: 2, error: null, log: [], failures: [] },
    archive:   { count: 2, error: null, log: [], failures: [] },
    librivox:  { count: 1, error: null, log: [], failures: [] },
    youtube:   { count: 1, error: null, log: [], failures: [] },
    fadedpage: { count: 0, error: null, log: [], failures: [] },
    dokumen:   { count: 0, error: null, failures: [],
                 log: ["search.dokumen: not offered — the site was confirmed down"] }
  };

  /* ------------------------------------------- THE MOCK'S OWN WORKING QUEUE
     Round 2 item 9: *"wire the mock report to exercise every new state (four
     choice rows, WORKING queue, per-book colours, result metadata, the three
     text/audio states) so they render on the bench in the SAME placement as
     the app"* -- and *"the bench is NEVER the lowest common denominator for
     surface.js"*.

     So the bench gets a queue with FOUR books in it, which is the state the
     whole of items 1-3 exists for and the one a single running job could
     never show: one render running with a step and an elapsed, one import
     running mid-parse, one re-parse waiting, one render row waiting. Every
     field is a field `/state` really sends (studio/serve.py::_serve_state) --
     the mock must not be able to teach this file to read a payload studio
     would never send, which is `MOCK_SHELF`'s own rule.

     THE COLOURS ARE THE POINT. Four books, four identities, four held hues --
     and dropping the first with its × must leave the other three on exactly
     the colours they had. That is item 3, and on the bench it can be pressed. */
  var MOCK_JOB = { mode: "single", slug: "eclogues-virgil", chapter: "c004",
                   step: "speak", phase: "running", queue_word: "Speaking",
                   where: "local", elapsed: "3:20" };
  var MOCK_INGESTS = [{ id: 41, name: "pensees-pascal.epub",
                        source: "search/pensees-pascal.epub", slug: null }];
  var MOCK_REPARSES = [{ id: 52, name: "Ficciones", slug: "fictions-borges" }];
  var MOCK_PENDING = [{ items: [{ id: 63, slug: "ethics-spinoza", unit: "c002",
                                  chapter: "c002", voice: "ashbery" }] }];
  /* an import that is RUNNING, in `/state.importing`'s own shape */
  var MOCK_IMPORTING = [{ source: "search/pensees-pascal.epub", slug: null,
                          name: "Les Pensées", step: "parse", phase: "running" }];
  /* what a log looks like -- the ingest bar's own line shape
     (studio/serve.py::_INGEST_LINE_RE), so the pane is judgeable */
  /* THE BENCH'S OWN GROUPS, in `push.groups_all`'s exact shape -- one that
     finished and made a master, one that failed with a sentence and has no
     rows left (which is the case the whole list exists for), and one out on
     Kaggle with a queue name, so the seventh log shape has something to draw
     a button for on a page with no server. */
  /* THE DRIVE'S OWN FILES, in `bookinfo.sources`' exact five fields: one
     epub nobody has parsed, one pdf, and one that IS already a book on the
     shelf -- which is the twin the list must not draw twice. */
  var MOCK_DRIVE = [
    { name: "moby-dick.epub", kind: "epub", mb: 1.4, parsed_as: null,
      source: "epubs/moby-dick.epub" },
    { name: "blood-meridian.pdf", kind: "pdf", mb: 22.8, parsed_as: null,
      source: "pdfs/blood-meridian.pdf" },
    { name: "ethics.epub", kind: "epub", mb: 0.9, parsed_as: "ethics-spinoza",
      source: "epubs/ethics.epub" }
  ];
  var MOCK_GROUPS = [
    { group: "23", slugs: ["eclogues-virgil"], where: "kaggle", engine: "qwen3",
      state: "running", queue: "ttstv-q23", kernel_url: "https://www.kaggle.com/code/x/ttstv-q23",
      started: (Date.now() / 1000) - 240, ended: null, error: null,
      units: [{ slug: "eclogues-virgil", unit: "c002", state: "running" }],
      rows_binned: false, produced: [] },
    { group: "22", slugs: ["ethics-spinoza"], where: "local", engine: "qwen3",
      state: "voiced", queue: null, started: (Date.now() / 1000) - 5400,
      ended: (Date.now() / 1000) - 5100, error: null,
      units: [{ slug: "ethics-spinoza", unit: "c001", state: "voiced" }],
      rows_binned: false, produced: [{ slug: "ethics-spinoza", unit: "c001",
                                        master: "c001.wav", bytes: 8123456 }] },
    { group: "21", slugs: ["a-dolls-house-a-play"], where: "modal", engine: "qwen3",
      state: "failed", queue: null, started: (Date.now() / 1000) - 86400,
      ended: (Date.now() / 1000) - 86100,
      error: "modal.exception.ResourceExhaustedError: workspace billing cycle spend limit reached",
      units: [], rows_binned: true, produced: [] }
  ];
  var MOCK_LOG = [
    "[ 1/26] parse c001",
    "[ 2/26] parse c002",
    "[ 3/26] parse c003",
    "chapters: 26 found, 3 written",
    "[ 4/26] parse c004"
  ];

  /* ================================================================= state */
  var S = {
    q: "",
    shelf: [],          /* {slug,title,author,lang,chapters,audio_s}          */
    out: [],            /* raw /search candidates                             */
    work: {},           /* key -> {title,author,slug,cells:{step:mark},p}     */
    job: null, pending: [], ingests: [],
    reparsing: [], reparses: [],   /* the re-parse queue, `/state`'s other two */
    detail: {},         /* slug -> GET /book's chapter rows, fetched once     */
    sel: null,          /* the row whose grid the works column is showing     */
    live: false,        /* is there a server behind us                        */
    base: "",           /* ...and where it is (`?api=`, or this origin)       */
    /* ------------------------------------- TRUE OR ABSENT, NEVER BOTH (13 Sep)
       G-STUDIOPHONE item 4. Osca, on the phone: the WORKING band read
       "2 running, 2 queued" while the column above it read "No studio behind
       this page". Both at once, and the queue was `MOCK_JOB`.

       `live` and `bench` are NOT each other's opposite, and that is the whole
       fix. There are THREE states, not two:

         live          a studio answers -- nothing here is mocked
         bench         no studio, and no app either: `design/reader/bench-*`
                       in a plain browser, or `?mock=1`. The mock is what a
                       bench is FOR, and it says so on the page.
         neither       Frank, with no studio behind it -- an unpaired phone,
                       or a paired one off the Wi-Fi. NOTHING is invented
                       here: no shelf, no queue, no engines, no sample. The
                       page says it cannot see Studio and says how to fix it.

       The test for a bench is the HOST. `window.TTSTVHost` is injected into
       every page Frank opens, on the Mac (`desktop/src/host.js`) and on the
       phone (`Frank/src-tauri/src/lib.rs::HOST_JS`), and into no page a plain
       browser opens. So "an app with no studio" and "a bench" are told apart
       by the one thing that actually distinguishes them, never by the
       protocol and never by a guess.

       Every `!S.live` below that FABRICATED something is now `S.bench`. The
       ones that DISABLE something are still `!S.live`, because a control
       that cannot act must not be pressable in either of the two dead
       states. */
    bench: false,       /* ...and if not, is this the design bench            */
    stateErr: "",       /* ...and what it said when it would not answer       */
    videoOpen: false,
    /* --------------------------------------------------- 8 Sep, the honest half
       `media`   the candidates that are RECORDINGS, kept apart from the texts
                 so the Video lane can open a SPECIFIC one and Add is never
                 offered on something Add cannot take.
       `adapters` `/search`'s own per-adapter report, under the wire's own
                 name (it was `sources`, a hair from `drive`, which is FILES
                 on a disk -- Stage 2 renamed it), drawn as itself. Without
                 it every source that was DOWN read as a source that was
                 EMPTY -- the whole of Osca's 8 Sep complaint.
       `dropped` what the title/author filter took out, so "6 raw, 0 kept" is
                 a sentence the page can say rather than a mystery. */
    media: [], adapters: null, dropped: [],
    searchedFor: "",    /* the query `sources` actually describes             */
    /* ----------------------------------------- G-SURF2, 10 Sep: THE WAIT, SEEN
       `asking`  null, or {q, t0, names} while a `/search` is out -- a STATE,
                 not an argument to draw(). It was `draw(true)`, passed by
                 exactly one caller, and every other draw -- the shelf's own
                 `yours().then(draw)` a microtask later, each /state poll --
                 passed nothing and took the "Searching…" note off the screen
                 while the search was still out.
       `askedMs` how long the last answer took, said once it is in
       `srcNames` which sources there are -- the last report's own keys,
                 remembered (see `knownSources`) */
    asking: null, askedMs: 0, srcNames: null,
    /* the works column is the LIVE studio, not a display: these are what it
       is doing about it right now */
    hold: null,         /* studio/tasks.py::hold_state -- null, or the hold  */
    attached: {},       /* what /attach answered, per recording+book          */
    /* ITEM 2: ONE LOG PER RUNNING BOOK, keyed by the WORKING row's own key,
       several open at once. It was a single `S.log` hung off a card that
       could only ever describe one book, so a second running book had no log
       at all. */
    logs: {},           /* key -> {key,q,title,text,err,open,mock}           */
    acting: "",         /* a route this column has in flight                  */
    actErr: "",         /* ...and what it said if it refused                  */
    inBook: null,       /* the book underneath, when there is one             */
    /* ------------------------------------------------- 8 Sep, §4: THE STUDIO
       THE WORKS is the FULL studio now, not a reduced one. These are the four
       choices a render is made of, and every one of them is a field studio
       already sends: `voices` and `settings` ride on `/state` (there is no
       `GET /voices` and no `GET /reference` -- see the section head below),
       `ssd` is the drive the models and the clips are on, and `sample` is the
       one job `/state` carries, folded. `voice` is the pill this column has
       lit, which is not always the book's own -- exactly as studio.html keeps
       `S.voice` apart from `render.json`. */
    voices: [],         /* /state.voices[] -- studio/bookinfo.py::voices()     */
    voice: null,        /* the pill lit here; written with POST /render        */
    settings: null,     /* /state.settings -- render.where, chosen, modal      */
    ssd: null,          /* /state.ssd -- {mounted, root}                       */
    sample: null,       /* {phase, slug, chapter, numbers|err}                 */
    voiceErr: "", whereErr: "", engineErr: "", sampleErr: "", langErr: "",
    /* the two probes that may not ride the /state poll (`/engines` shells
       out to voice's python, `/kaggle` to the kaggle CLI) -- `probe()`'s
       own shape: what it said, whether it is being asked, what went wrong */
    engines: { value: null, asking: false, err: "" },
    kaggle:  { value: null, asking: false, err: "" },
    /* the addendum's two: a multi-file candidate waiting on a person, and the
       clone this surface has just asked the importer for */
    choose: null, cloning: null,
    /* §5.8: what was clicked on the left, when it is not a book -- and the
       chapter a click named, which is the unit the Sample spends its minutes
       on rather than "the first one, always". */
    cand: null, unit: null, unitSlug: null,
    /* ITEM 6: `linked_id` -> the candidates holding it, built once per search.
       A pairing is only real when BOTH halves came back (or the token is
       `yt:`, one item that is both), and this map is how a row knows. */
    pairs: {},
    /* ITEM 7: the audition, and only ever one of them */
    peek: null,
    /* EVERY RENDER, ALL BOOKS -- `GET /queue-all` (`studio/push.py::
       groups_all`). Its own route for `GET /kaggle`'s reason: `/state` is
       polled every four seconds by every open tab and this walks every group
       and stats a master per member, so it is asked when the band is opened
       and on its own Refresh, never on the poll. null = never asked. */
    /* EVERY FILE ALREADY IN `TTS_DATA/sources/` -- `/state`'s own `sources`
       (`studio/bookinfo.py::sources`), which this surface has been polling
       past for a week. NOT `S.adapters`, which is the SEARCH adapters' report
       and a name this file already had: these are files on a disk. */
    drive: [],
    all: null,          /* {groups,pending,hold,job,ssd} as the route sends it */
    allOpen: false, allAsking: false, allErr: "",
    paired: ""           /* the Studio this device paired with, when it did  */
  };
  /* what the bench dials, and nothing else does */
  var CFG = { mixed: true, bias: 1.0, coarse: false,
              /* G-SURF2: how long the MOCK takes to answer, so the searching
                 state can be looked at on the bench (`?mockdelay=1500`). 0 in
                 the app, where the wait is studio's and real. */
              mockDelay: (function () {
                try { var m = /[?&]mockdelay=(\d+)/.exec(location.search || "");
                      return m ? +m[1] : 0; } catch (e) { return 0; }
              })() };

  var root = null, scrim = null, sheet = null, input = null,
      listEl = null, worksEl = null, videoBox = null, opened = false;
  var token = 0;      /* an older in-flight search must not clobber a newer   */

  /* ================================================================= mount */
  function mount(opts) {
    if (root) return handle();
    opts = opts || {};
    root = document.createElement("div");
    scrim = el("div", "sf-scrim");
    sheet = el("div", "sf");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Search");
    sheet.innerHTML =
      '<div class="sf-field">'
      + '<span class="sf-look"></span>'
      + '<input type="text" spellcheck="false" autocomplete="off" placeholder="'
      + esc(opts.placeholder || "Search your library, and everywhere else") + '">'
      + '<button class="sf-esc" type="button">esc</button>'
      + '</div>'
      + '<div class="sf-cols"><div class="sf-list"></div><div class="sf-works"></div></div>';
    root.appendChild(scrim); root.appendChild(sheet);
    (opts.into || document.body).appendChild(root);

    input = sheet.querySelector("input");
    listEl = sheet.querySelector(".sf-list");
    worksEl = sheet.querySelector(".sf-works");

    scrim.addEventListener("click", close);
    sheet.querySelector(".sf-esc").addEventListener("click", close);
    input.addEventListener("input", function () { ask(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); ask(input.value, true); }
    });
    /* THE DOOR, and it is the only thing the bar upstairs has to carry.
       ⌘K ONLY, AND ⌘F IS NOT TAKEN. The first version answered both, because
       the bar did; desktop/src/host.js's rule is newer and it is the right
       one -- *"⌘F is NOT taken: that is Find in this book, it has a bar of
       its own and it stays exactly where it is"* (PROMPTS/search.md keeps the
       two names apart). A surface that opened on ⌘F would take Find away from
       the reader, in the app, on the one page where Find is the point.

       IN THE APP THIS LISTENER NEVER FIRES. host.js catches ⌘K first (its own
       capture listener, injected before any page script) and calls
       `SearchSurface.toggle()` there, then stops the event -- so there is one
       toggle and not two. This is the plain browser's and the phone's door. */
    addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault(); opened ? close() : open(S.q);
      } else if (e.key === "Escape" && opened) {
        e.preventDefault(); close();
      }
    });
    S.base = BASE;
    S.live = !!BASE;
    S.paired = PAIRED ? (PAIRED.name || PAIRED.base) : "";
    /* the three states, decided once, at mount -- see `bench` in `S` above */
    S.bench = !S.live && !hostHere();
    /* §5.9: with nothing to poll, the mock IS the payload -- the same three
       fields `/state` would have filled, so `drawWorks` takes one path.
       ON A BENCH ONLY (13 Sep): in Frank with no studio this block is
       skipped, and the queue it used to fill is the "2 running, 2 queued"
       the phone was showing under "No studio behind this page". */
    if (S.bench) {
      S.voices = MOCK_VOICES;
      S.settings = MOCK_SETTINGS;
      S.drive = MOCK_DRIVE;
      S.voice = MOCK_VOICES[0].name;
      S.ssd = { mounted: true, root: "(the bench)" };
      /* ITEM 9: THE BENCH GETS THE WHOLE QUEUE, not one job. A single running
         job could never show what items 1-3 are about -- several books at
         once, each with its own step, its own controls and its own held
         colour. Four of them, one of each kind studio can have. */
      S.job = MOCK_JOB;
      S.pending = MOCK_PENDING;
      S.ingests = MOCK_INGESTS;
      S.reparses = MOCK_REPARSES;
      /* the running import, folded exactly as `pollWorks` folds the real one,
         so the bench's WORKING row is built by the SAME code path the app's
         is and cannot drift from it */
      MOCK_IMPORTING.forEach(function (it) {
        var w = beginWork("i:" + (it.slug || it.source),
                          { title: it.name, author: "" });
        w.source = it.source;
        holdAs(w.key, it.source);
        var i = STEPS.indexOf(it.step);
        w.word = it.step;
        if (i >= 0) {
          for (var j = 0; j < i; j++) w.cells[STEPS[j]] = "ok";
          w.cells[STEPS[i]] = "running";
          w.p = (i + 0.5) / STEPS.length;
        }
      });
    }
    S.inBook = openBookHere();
    bar();
    /* THE DOOR ON THE URL (Stage 2). `?studio=<slug>&units=c003,c004` is
       the query `tabs.rs::url_for(Kind::Studio)` has always put on
       studio.html's URL. A page that mounts this surface answers the same
       query by opening over itself on that book -- so the shell's front door
       becomes ONE line, `clean/library/library.html?studio=…`, and Studio is
       a state of the page you were on rather than a page of its own. The
       book is selected once the shelf has answered, so the row is a real
       row; `units` names the chapter the Sample spends its minutes on. */
    var door = doorInUrl();
    if (door) {
      open("");
      (S.live ? askState() : Promise.resolve()).then(function () {
        if (!door.slug) return;
        selectSlug(door.slug);
        if (door.units.length) { S.unit = door.units[0]; S.unitSlug = door.slug; }
        draw();
      });
    }
    return handle();
  }
  function doorInUrl() {
    var q = "";
    try { q = String(location.search || ""); } catch (e) { return null; }
    var m = /[?&]studio=([^&]*)/.exec(q);
    if (!m) return null;
    var slug = "";
    try { slug = decodeURIComponent(m[1]); } catch (e) { slug = m[1]; }
    var u = /[?&]units=([^&]*)/.exec(q), units = [];
    if (u) { try { units = decodeURIComponent(u[1]).split(",").filter(Boolean); } catch (e) { units = []; } }
    return { slug: slug, units: units };
  }

  /* ============================================== THE TWO BARS, ONE SURFACE
     Osca, 7 September: *"THE MAC BAR opens it ... THE PHONE BAR opens it
     too. Two bars, one surface."*

     THE MAC. The field is in the tab strip's own webview, so what reaches
     this page is `TTSTVPage.ask(verb, query)` -- one eval per keystroke
     (desktop/src-tauri/src/tabs.rs::ask). `bar/askbar.js` owns that name on
     the pages that load it (the Library, studio) and its `everywhere()` is
     rerouted there, in its own file. THIS shim is for the page that has no
     askbar at all: the reader, which is where ⌘K is pressed most. It takes
     the one verb that means "search" -- ⏎ -- and opens the surface with the
     words already typed; the rest it leaves alone, because a bar with an
     editor behind it is askbar's job and never this file's.

     IT NEVER TAKES A HANDLER THAT IS ALREADY THERE. If askbar.js has loaded
     first, its `ask` stays; if it loads after, its own assignment wins. Two
     files, one name, and the order decides -- which is why library.html
     loads this one FIRST and askbar second, and the reader loads this one
     alone.

     THE PHONE has no strip and no eval: its bar is markup in reader.html and
     it calls `SearchSurface.open("")` directly. Same function, same surface,
     no second implementation of anything. */
  function bar() {
    var P = window.TTSTVPage;
    if (P && typeof P.ask === "function") return "askbar";   /* not ours to take */
    function ask(verb, query) {
      if (opened) {                       /* it is up: the strip types into it */
        if (verb === "type" || verb === "focus") { feed(query); return; }
        if (verb === "enter") { feed(query, true); return; }
        if (verb === "escape") { close(); return; }
        return;                            /* blur never shuts a whole surface */
      }
      if (verb === "enter") { open(String(query == null ? "" : query), true); return; }
    }
    ask.__surface = true;
    window.TTSTVPage = Object.assign(window.TTSTVPage || {}, { ask: ask });
    return "surface";
  }
  function handle() {
    return { open: open, close: close, toggle: toggle, ask: ask, draw: draw,
             measure: measure, cfg: CFG, state: S, sheet: sheet, input: input };
  }

  /* `now` is ⏎, and it is the difference between the two doors. A door that
     only opens (⌘K, the phone's ⌕) leaves the 320 ms pause in place, because
     the words are not finished. A door pressed WITH the words -- ⏎ in the
     bar -- has already waited for a person to stop typing, so the search of
     everywhere else leaves this Mac at once instead of after another pause. */
  function open(q, now) {
    if (!root) mount();
    opened = true;
    scrim.classList.add("on"); sheet.classList.add("on");
    if (q != null && q !== input.value) input.value = q;
    input.focus(); input.select();
    var prevInBook = S.inBook;
    S.inBook = openBookHere();      /* the reader may have moved since mount */
    /* G-AUTOSEL: the book underneath is pre-selected so the reader does not
       land on "Choose a book" for a book they are already in. A click
       (select()) outranks the page -- selAuto tracks which it was, and a
       re-open follows a changed book only when the previous selection was
       automatic, not clicked. */
    if (S.inBook && !S.sel) {
      selectSlug(S.inBook); S.selAuto = true;
    } else if (S.selAuto && S.inBook && S.inBook !== prevInBook) {
      selectSlug(S.inBook); /* S.selAuto stays true */
    }
    ask(input.value, !!now);
    pollWorks();
  }
  function close() {
    if (!root) return;
    opened = false;
    scrim.classList.remove("on"); sheet.classList.remove("on");
    S.videoOpen = false;
    stopTick();
  }
  function toggle() { opened ? close() : open(S.q); }

  /* THE STRIP GOES ON TYPING INTO IT (the Mac).
     The bar's field is in the tab strip's OWN webview and this surface is in
     the page's, so opening one from the other does not move the caret across
     the boundary -- `host_ask_focus` exists precisely because a page cannot
     put the caret in the strip, and there is no command for the reverse.
     Rather than add one, the surface takes the words instead of the caret:
     while it is open every `type` the strip sends is fed straight in here and
     the field mirrors it. It costs no Rust, it works on an older shell, and
     it makes the strip's field and this field the same field in the only
     sense that matters -- one query, typed once. `now` is ⏎: don't wait out
     the 320 ms pause before leaving this Mac. */
  function feed(q, now) {
    if (!root) mount();
    var v = String(q == null ? "" : q);
    if (input.value !== v) input.value = v;
    ask(v, !!now);
  }

  /* ================================================================== asking
     YOURS is answered off a shelf we already hold, so a keystroke costs
     nothing. OUT THERE leaves this Mac, so it waits for a pause (or Enter). */
  var outTimer = null;
  function ask(q, now) {
    S.q = String(q || "").trim();
    yours().then(function () { draw(); });
    clearTimeout(outTimer);
    /* AN EMPTIED FIELD CANCELS THE SEARCH THAT IS OUT. The token is what an
       answer checks before it lands; without the bump a slow answer for the
       old words filled the list after the field had been cleared. */
    if (!S.q) { token++; S.asking = null; stopTick(); S.out = []; draw(); return; }
    if (now) return elsewhere();
    outTimer = setTimeout(elsewhere, 320);
  }

  /* ONE MAPPER FOR `/state`'s BOOK ROW, and it is the SHELF row studio
     actually sends (studio/bookinfo.py::shelf_of), not the summary it used
     to inline. THIS IS THE FIRST THING THAT WAS MOCK-SHAPED: the old reader
     of this payload asked for `b.chapters.length` and `b.audio_s`, and a
     shelf row carries NEITHER -- so against a live studio every row on this
     surface said "0 ch" and no audio, whatever was on the disk. The fields
     that exist are `chapters_n` and the four counters `shelf_of` computes
     once so no page has to walk chapters again:
         chapters_n  parsed  voiced  aligned  dict_ok  has_audio  has_timings
     The two old names are kept as a fallback and nothing more -- a fixture
     or an older server that still sends `chapters[]` is read, not refused. */
  function shelfOf(b) {
    var n = b.chapters_n;
    if (n == null) n = (b.chapters && b.chapters.length) || b.n_chapters || 0;
    return { slug: b.slug, title: b.title, author: b.author, lang: b.lang,
             /* a mixed book's languages, most words first (G-LANGMIX);
                absent means one, and that is `lang` */
             langs: Array.isArray(b.langs) && b.langs.length > 1 ? b.langs.slice() : undefined,
             chapters: n,
             parsed: b.parsed || 0, voiced: b.voiced || 0, aligned: b.aligned || 0,
             dict_ok: !!b.dict_ok, audio: !!b.has_audio, timed: !!b.has_timings,
             /* THE TWO RENDER.JSON FACTS `/state` ALREADY SENDS (8 Sep, §4).
                Dropped here until today, which is why the studio block had to
                be told the engine twice. Both are on `bookinfo.shelf_of`'s own
                row; neither is derived. */
             voice: b.voice || null, engine: b.engine || null,
             /* G-SURF2: WHERE IT CAME FROM. `bookinfo.book_summary`'s own
                `source` -- the kind, the file's name, its whole path, and the
                origin when one is on record -- carried through untouched,
                so a row and its detail say what studio says and nothing
                derived. */
             source: b.source || null };
  }

  /* ------------------------------------------- ONE READER OF /state (Stage 2)
     `/state` is ONE answer -- the shelf, the drive, the queue, the voices, the
     settings -- and until Stage 2 this file fetched it down TWO paths that
     each read a different half: `yours()` (every keystroke, throttled) took
     the books and the drive and nothing else; `pollWorks()` (every few
     seconds while open) took everything, and folded the running import into
     a working row. So a poll that landed knew things a keystroke's answer did
     not, and the two disagreed for up to four seconds on `stateErr`. Now
     there is one fetch (`askState`), one reducer (`takeState`), and
     `yours()` is only the THROTTLE in front of them: a keystroke asks at most
     once in four seconds, and the poll asks on its own clock, but whichever
     asked, the answer lands whole. An ask already in flight is shared, not
     doubled. */
  var shelfAt = 0, stateAsking = null;
  function yours() {
    if (S.shelf.length && Date.now() - shelfAt < 4000) return Promise.resolve();
    if (!api("/state")) { S.shelf = MOCK_SHELF.slice().map(shelfOf); shelfAt = Date.now(); return Promise.resolve(); }
    return askState();
  }
  function askState() {
    if (stateAsking) return stateAsking;
    stateAsking = getJSON("/state", 20000)
      .then(takeState)
      .catch(function (e) {
        /* SAY WHAT HAPPENED, and never the mock's sentence: there IS a server
           behind this page, it did not answer, and those are different facts. */
        S.stateErr = why("/state", e);
        S.shelf = S.shelf || [];
      })
      .then(function () { stateAsking = null; });
    return stateAsking;
  }
  /* THE ONE REDUCER. Every field `/state` carries lands here and nowhere
     else, so a field studio adds is read in one place or not at all. */
  function takeState(d) {
    if (!d) { S.stateErr = "studio answered /state with nothing"; return; }
    S.stateErr = "";
    /* ONE REQUEST, NOT TWO: `/state` carries the shelf and the works in the
       same answer, so whoever asked refreshes both. */
    S.shelf = ((d.books) || []).map(shelfOf);
    shelfAt = Date.now();
    S.job = d.job || null; S.pending = d.pending || []; S.ingests = d.ingests || [];
    /* THE RE-PARSE QUEUE, its two fields, exactly as the import queue's
       two (studio/serve.py::_serve_state, 4 Sep): `reparsing` is running,
       `reparses` is waiting, both `[]` and never absent -- so this reads
       them straight and never has to guess that absent means empty. */
    S.reparsing = d.reparsing || []; S.reparses = d.reparses || [];
    /* the machine-wide hold, so `Hold all` / `Resume all` says which it
       is rather than toggling blind */
    S.hold = d.hold || null;
    /* §4, 8 Sep -- THE STUDIO'S OWN FOUR FIELDS, off the SAME answer. The
       voices and the settings are `/state`'s (there is no `GET /voices`);
       the sample is the one job, folded, so a finished sample survives the
       poll that follows it rather than vanishing. */
    S.voices = d.voices || [];
    /* ...and the FILES ALREADY ON THE DRIVE, which have ridden on this
       same payload since 30 Aug and which this surface polled past
       until Stage 1 (`studio/bookinfo.py::sources`, cached with the books
       and the voices -- it costs nothing here). */
    S.drive = d.sources || [];
    /* THE CLONE'S OWN LINE GOES WHEN THE VOICE ARRIVES -- or when the job
       it is waiting on says something, whichever comes first. A "cloning…"
       that outlived its job would be the silent blank in the other
       direction: a page saying work is happening when none is. */
    if (S.cloning && (S.voices.some(function (v) { return v.name === S.cloning.name; })
                      || (d.job && d.job.mode === "voice" && d.job.phase !== "running")))
      S.cloning = null;
    S.settings = d.settings || null;
    S.ssd = d.ssd || null;
    var sm = sampleFromJob(d);
    if (sm) S.sample = sm;
    /* THE PILL STARTS ON SOMETHING TRUE: the book's own voice when it has
       one, else the first voice on the drive -- studio.html's own two
       terms, in its order. Never overwritten once somebody has pressed a
       pill, because that press is a decision and this is a poll. */
    if (!S.voice) {
      var sb = subject();
      S.voice = (sb && sb.voice) || (S.voices[0] ? S.voices[0].name : null);
    }
    /* an import that studio is running is a working row, whether or not
       this surface started it -- the strip's own rule (bar/lanes.js).
       IT IS FOUND BY ITS SOURCE FIRST: a row this surface added already
       knows the source `/stage_for_ingest` answered with, and matching on
       it is what stops one Add becoming two rows. Only an import nobody
       here started opens a new one. */
    (d.importing || []).forEach(function (it) {
      var name = it.source || it.name || it.slug;
      var w = null;
      Object.keys(S.work).forEach(function (k) {
        var c = S.work[k];
        if (!w && (c.source === name || c.slug === it.slug ||
                   (c.title && norm(c.title) === norm(it.name || "")))) w = c;
      });
      if (!w) { w = beginWork("i:" + (it.slug || name), { title: it.name || it.slug, author: "" });
                w.source = name; holdAs(w.key, name); }
      /* ITEM 3, AND THIS IS THE LINE THAT WAS COSTING THE COLOUR. The
         moment an import learns its slug it has the name it will keep for
         the rest of its life -- shelf row, step grid, every later search.
         Alias it to the colour the row already has, rather than letting
         `hue(slug)` mint a second one. */
      if (it.slug && it.slug !== w.slug) holdAs(w.key, it.slug);
      w.slug = it.slug || w.slug;
      var i = STEPS.indexOf(it.step);
      w.word = it.step || it.phase || "importing";
      if (i >= 0) {
        for (var j = 0; j < i; j++) w.cells[STEPS[j]] = "ok";
        w.cells[STEPS[i]] = it.phase === "failed" ? "failed" : "running";
        w.p = Math.max(w.p, (i + 0.5) / STEPS.length);
      }
    });
    /* AND IT LEAVES WHEN IT ARRIVES. A working row whose book is now on
       the shelf is the book: drop the working row and the shelf row is
       already drawn in its place.
       WHICH BOOK IT BECAME IS FOUND BY SLUG, THEN BY FILE (G-SURF2). It
       was by TITLE, and a second edition of a title already on the shelf
       "arrived" the instant it was pressed -- the row vanished before its
       parse had begun, because the FIRST edition was already there. And
       an import that FAILED is said, on its row, in studio's own words:
       the finished ingest is parked on `/state`'s `job` once its lane is
       free (`JobManager._finish_lane`), with its `err`. */
    Object.keys(S.work).forEach(function (k) {
      var c = S.work[k];
      var here = (d.importing || []).some(function (it) {
        return (c.source && it.source === c.source) || (c.slug && it.slug === c.slug) ||
               (!c.source && norm(it.name || "") === norm(c.title || ""));
      });
      var fin = (!here && d.job && d.job.mode === "ingest" && c.source &&
                 d.job.source === c.source) ? d.job : null;
      if (fin && fin.phase === "failed" && !c.failed) {
        c.failed = true; c.word = "Couldn't add";
        c.err = String(fin.err || "the import failed");
        STEPS.forEach(function (s2) { if (c.cells[s2] === "running") c.cells[s2] = "failed"; });
      }
      if (fin && fin.slug && !c.slug) { holdAs(c.key, fin.slug); c.slug = fin.slug; }
      if (!here && !c.failed && landedBook(c)) {
        if (c.slug) delete S.detail[c.slug];     /* its steps changed; ask again */
        delete S.work[k];
        /* AND ITS CHAPTERS APPEAR, HERE (8 Sep addendum: *"then parsed via
           POST /ingest, and its chapters appear in the same panel"*). A
           book that has just finished parsing is the thing you were
           waiting for, so the works column opens it -- one `GET /book`,
           the same grid every other selection draws. Only when nothing
           else is selected: a person who moved on is not moved back. */
        var landed = (landedBook(c) || {}).slug || c.slug;
        /* the last name it takes, and the one the tile will carry */
        if (landed) holdAs(c.key, landed);
        if (landed && (!S.sel || !S.sel.slug)) selectSlug(landed);
      }
    });
  }

  /* ------------------------------------------------------------- ONE BOOK
     GET /book?slug= -- the other half of the shelf split. The step grid is
     this book's own chapter rows and their eight `state` cells, so the grid
     is studio's answer rather than a shape guessed from a counter. Fetched
     once per book and kept: a book is opened by hand, and `/state` is the
     thing that is polled. */
  function loadBook(slug) {
    if (!slug || S.detail[slug]) return Promise.resolve(S.detail[slug]);
    if (!S.live) return Promise.resolve(null);
    S.detail[slug] = { loading: true, chapters: [] };
    /* through the one GET, so a 404 is a sentence on the grid and never a
       book that silently has no chapters */
    return getJSON("/book?slug=" + encodeURIComponent(slug), 20000)
      .then(function (d) {
        S.detail[slug] = { loading: false,
                           chapters: (d && d.chapters) || [],
                           error: (d && d.error) || "" };
        drawWorks();
        return S.detail[slug];
      })
      .catch(function (e) {
        S.detail[slug] = { loading: false, chapters: [],
                           error: "could not read that book — " + (e && e.message || e) };
        drawWorks();
        return S.detail[slug];
      });
  }

  /* --------------------------------------------------------------- THE DOOR
     bar/askbar.js::take's own two cases, in its own order: the host where
     there is one, and the reader's URL where there is not. `books/<slug>` is
     the form reader.html's `slugFromUrl()` strips, so both halves open the
     same page. The relative path is resolved from where this file is mounted
     -- reader/reader.html or library/library.html -- exactly as askbar.js
     resolves "../library/library.html" from the same two pages. */
  function readerHref(slug) {
    var q = "?book=books/" + encodeURIComponent(slug);
    return (/\/reader\/[^\/]*$/.test(location.pathname) ? "reader.html"
                                                        : "../reader/reader.html") + q;
  }
  function openBook(b, chapter) {
    if (!b || !b.slug) return "none";
    var h = window.TTSTVHost;
    close();
    /* `?ch=` is the shell's own chapter parameter (TTSTVHost.setTarget, 7
       Sep). Given one, the door opens AT that chapter -- which is the whole
       of "find the chapter" being useful rather than interesting. */
    if (h && typeof h.openReader === "function") {
      h.openReader(b.slug, chapter || undefined);
      if (chapter && typeof h.setTarget === "function") {
        try { h.setTarget(b.slug, chapter); } catch (e) {}
      }
      return "host";
    }
    location.href = readerHref(b.slug) + (chapter ? "&ch=" + encodeURIComponent(chapter) : "");
    return "url";
  }

  /* ====================================== THE COLUMN ACTS, IT DOES NOT DISPLAY
     Osca, 8 Sep: *"the column is the live studio, not a display"*. Every verb
     below is a route studio already serves and studio.html already presses --
     nothing here invents an endpoint, and nothing here starts a GPU (a step
     that needs one shows its lane and waits; `CLAUDE.md`: no Kaggle, no
     Modal, no keys from this lane).

         POST /run       {slug, chapter, step}        one cell
         POST /run       {slug, queue:true, ...}      the rest of a book
         POST /stop      -- this job, nothing else
         POST /hold      {why} / POST /resume
         POST /queue-row {id|ingest, action:"remove"} -- take one out
         GET  /log       ?slug&chapter&step | ?ingest= | ?reparse=

     A BUTTON THAT CANNOT ACT IS WORSE THAN NO BUTTON (the old jobCard's own
     rule, and it is kept): every one of these is drawn only when `S.live`,
     and every one of them reports what the route actually said. */
  function act(path, body, btn, word) {
    if (btn) { btn.disabled = true; if (word) { btn.dataset.was = btn.textContent; btn.textContent = word + "…"; } }
    S.acting = path; S.actErr = "";
    if (!S.live) { S.acting = ""; S.actErr = path + " — no studio behind this page"; draw(); return Promise.resolve(null); }
    return postJSON(path, body || {})
      .then(function (j) {
        S.acting = "";
        if (j && j.error) S.actErr = path + " — " + j.error;
        if (btn) { btn.disabled = false; if (btn.dataset.was) btn.textContent = btn.dataset.was; }
        pollWorks();
        draw();
        return j;
      })
      .catch(function (e) {
        S.acting = ""; S.actErr = why(path, e);
        if (btn) { btn.disabled = false; if (btn.dataset.was) btn.textContent = btn.dataset.was; }
        draw();
        return null;
      });
  }
  /* §5.9: WITH NO STUDIO, RUNNING IS THE BENCH'S OWN. `/run` is what makes
     the column busy, and a bench where the queue could never start is a bench
     where the busy state -- the whole point of the right-hand column -- can
     only be described. So the mock takes the job, the card follows it, and
     nothing is posted. Named as a mock in the card's own word. */
  function run(body, btn, word) {
    if (S.bench) {
      S.job = { mode: body.queue ? "push" : "single", phase: "running",
                slug: body.slug, chapter: body.chapter || "the whole book",
                step: body.step || "speak", where: whereNow(),
                elapsed: "0:02", queue_word: (word || "Running") + " (mock)" };
      draw();
      return Promise.resolve({ job: S.job });
    }
    return act("/run", body, btn, word);
  }

  /* ATTACH A RECORDING TO A BOOK YOU HAVE. `POST /attach` is studio's own
     proxy into `tools/search/serve.py::run_attach`, and it is the heavier
     one: its alignment needs torch in the server's venv, so a machine
     without it answers a clean ModuleNotFoundError rather than crashing
     (studio/serve.py::_handle_search_attach says so in as many words). The
     row prints whatever came back -- including that -- and never a success
     it did not get. */
  function attach(c, to, btn) {
    var k = attachKey(c, to);
    return act("/attach", { candidate: c, slug: to.slug }, btn, "Attaching")
      .then(function (j) {
        /* THE ANSWER GOES IN THE STATE, NOT ON THE BUTTON. `act()` redraws
           when the route comes back -- the queue and the job card have both
           changed by then -- so the node this closure is holding is already
           off the page. Written on the button it survived until the next
           poll and then silently reverted to "Attach to ...", which reads as
           an attach that never happened. Measured 8 Sep. */
        S.attached[k] = !j ? "Attach failed"
                       : j.error ? "Attach failed — " + j.error
                       : "Attached";
        draw();
      });
  }
  function attachKey(c, to) { return (to && to.slug) + "|" + (c.url || c.title); }

  /* A NAME IS NOT TYPED, IT IS DERIVED -- `voiceNameFromFile`'s own fold,
     applied to the recording's title, because `TTS_DATA/voices/<name>/` is a
     folder and the route refuses anything that is not one path segment
     (`_handle_voice`: "never trust a client-supplied name as a bare path"). */
  function voiceNameFromTitle(t) {
    var n = String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
    return n || "voice";
  }
  function cloneVoiceFrom(c, btn) {
    var name = voiceNameFromTitle(c.title || shortHost(c.url));
    S.voiceErr = "";
    if (!S.live) {                        /* §5.9 -- see pickVoiceFile */
      S.voiceErr = (S.bench ? "the bench" : "this page") + " has no importer — cloning “" + (c.title || c.url)
                 + "” as " + name + " needs studio behind the page";
      drawWorks(); return Promise.resolve(null);
    }
    S.cloning = { name: name, url: c.url, title: c.title || c.url };
    return act("/voice", { name: name, url: c.url }, btn, "Cloning")
      .then(function (j) {
        if (!j || j.error) {
          S.voiceErr = "/voice — " + ((j && j.error) || "the route did not answer");
          S.cloning = null;
        } else {
          /* THE NEW VOICE IS THE CHOSEN ONE the moment the route takes it --
             the same rule the file picker is under. It arrives as a pill on
             the next `/state`, or as a refusal on the job. */
          silenceRef();
          S.voice = name;
        }
        pollWorks(); draw();
        return j;
      });
  }

  /* A RECORDING IS NOT A BOOK. `kind` is the candidate's own field
     (tools/search/candidate.py): "text" is something `/ingest` can parse,
     anything else is audio or video and belongs in the ELSEWHERE lanes,
     where it is a thing you PLAY or ATTACH. Splitting them here is what
     lets the Video row open a specific video instead of a search query,
     and it is why Add is never drawn on a row Add would refuse. */
  function isText(c) { return !c.kind || c.kind === "text"; }

  function elsewhere() {
    var my = ++token;
    var url = api("/search?title=" + encodeURIComponent(S.q));
    if (!url) {
      /* THE BENCH CAN SEE THE WAIT (G-SURF2). With `?mockdelay=` the mock
         answers late, through the SAME `asking` state the live wait uses --
         so the strip the bench shows during is the strip the app shows
         during, drawn by the same code. Without it the mock answers at once,
         as it always did. */
      if (CFG.mockDelay > 0) {
        beginAsking();
        draw();
        setTimeout(function () {
          if (my !== token) return;              /* a newer search owns it */
          endAsking(MOCK_SOURCES);
          mockAnswer();
        }, CFG.mockDelay);
        return Promise.resolve();
      }
      mockAnswer();
      return Promise.resolve();
    }
    beginAsking();
    S.out = []; S.media = []; S.adapters = null; S.outErr = ""; draw();
    /* 40 s: `sources.SEARCH_BUDGET` is 25 s and the route answers inside it
       by construction, so past 40 s the route is not coming back. */
    return ask_(url, 40000, { cache: "no-store" })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); }
          catch (e) {
            /* THE ONE CASE THAT USED TO READ AS "Couldn't reach the search":
               a route that answered, but not with JSON -- a 404 page, an
               HTML traceback, a proxy. It WAS reached, and it broke. */
            throw new Error("answered " + r.status + " but not JSON — "
                            + t.slice(0, 120).replace(/\s+/g, " "));
          }
          if (!r.ok && !(j && j.error)) throw new Error("answered " + r.status);
          return j;
        });
      })
      .then(function (j) {
        if (my !== token) return;                    /* a newer search owns it */
        endAsking(j && j.adapters);
        S.searchedFor = S.q;
        /* studio's own 500 shape: `{error: "Type: message"}` -- the search was
           REACHED and it broke, which is a different sentence again. */
        if (j && j.error) { S.outErr = "/search — " + String(j.error);
                            S.out = []; S.media = []; S.adapters = j.adapters || null;
                            draw(); return; }
        S.outErr = "";
        S.adapters = (j && j.adapters) || null;
        S.dropped = ((j && j.dropped) || []).map(function (c) { return (c && c.candidate) || c; });
        /* `sources/library.py` SEARCHES YOUR OWN SHELF, with no network, so
           `/search` answers with your books as candidates too -- and this
           list has already drawn them, from `/state`, WITH their spines.
           Dropping them here is bar/askbar.js::build's own rule, for its own
           reason: elsewhere means elsewhere, and a book that arrived twice
           under two identities is the twin this surface exists not to draw. */
        var all = ((j && j.candidates) || [])
          .map(function (c) { return (c && c.candidate) || c; })
          .filter(function (c) { return c && c.title && c.source !== "library"; });
        S.out = all.filter(isText);
        S.media = all.filter(function (c) { return !isText(c); });
        /* ITEM 6: WHO IS PAIRED WITH WHOM, built once from this answer.
           `tools/search/pair.py` puts the SAME `linked_id` on both halves of a
           pair, so grouping by it is the whole of the question -- a token held
           by two rows is a real pair, a token held by one is a half whose
           partner did not come back and must not be drawn as "text + audio".
           Built over ALL of them, texts and recordings together, because a
           pair is by definition one of each. */
        S.pairs = {};
        all.forEach(function (c) {
          if (!c.linked_id) return;
          var k = String(c.linked_id);
          (S.pairs[k] = S.pairs[k] || []).push(c);
        });
        draw();
      })
      .catch(function (e) {
        if (my !== token) return;
        endAsking(null);
        S.searchedFor = S.q;
        S.outErr = why("/search", e);
        S.out = []; S.media = []; draw();
      });
  }

  /* THE MOCK'S ANSWER, in one place -- the immediate bench and the delayed
     one both land here, so the two cannot answer differently. */
  function mockAnswer() {
    S.out = MOCK_OUT.slice(); S.media = MOCK_MEDIA.slice();
    S.adapters = MOCK_SOURCES; S.searchedFor = S.q;
    /* ITEM 9: the mock builds `S.pairs` THE SAME WAY the live answer does
       -- one pass over both lists, grouped by `linked_id` -- rather than
       being handed a ready-made map. A mock that took a shortcut here could
       show a pairing the real grouping would not, which is the one thing a
       bench must never do. */
    S.pairs = {};
    S.out.concat(S.media).forEach(function (c) {
      if (!c.linked_id) return;
      var k = String(c.linked_id);
      (S.pairs[k] = S.pairs[k] || []).push(c);
    });
    draw();
  }

  /* ==================================================== THE WAIT, IN THE OPEN
     G-SURF2, Osca 10 Sep: *"Searching is unmistakable ... visible at the top
     of RESULTS the whole time any source is still answering -- which sources
     are out, which have answered ... Osca must never wait not knowing."*

     WHAT CAN HONESTLY BE SAID DURING, AND WHAT CANNOT. `/search` is ONE
     request: `tools/search/sources/__init__.py::run_all_with_report` asks
     every adapter at once, on its own thread, and studio answers when the
     slowest has answered or `SEARCH_BUDGET` (25 s) has run out -- whichever
     is first -- with every source's report in the one body. So while it is
     out, EVERY source is out, and they all answer in the same instant. The
     strip says exactly that: each source by name, "asking", the seconds
     counting against the 25, and the moment the answer lands each chip turns
     into what that source did. A chip that turned on its own would be a
     chip claiming something studio never told this page -- a streamed
     `/search` is what would buy it, and that is studio's to build (the
     report's §6), not this file's to pretend.

     WHICH SOURCES, BEFORE ANY HAVE ANSWERED. The last report's own keys --
     studio's names, not a list typed here -- remembered across searches and
     across launches. The very first search on a machine has no report yet,
     so it names `SOURCE`'s table and the first answer corrects it. */
  var BUDGET_S = 25;       /* tools/search/sources/__init__.py SEARCH_BUDGET */
  var SRC_KEY = "ttstv.surface.sources";
  function knownSources() {
    if (S.srcNames && S.srcNames.length) return S.srcNames.slice();
    try {
      var kept = JSON.parse(localStorage.getItem(SRC_KEY) || "null");
      if (kept && kept.length) { S.srcNames = kept; return kept.slice(); }
    } catch (e) {}
    return Object.keys(SOURCE).sort();
  }
  function beginAsking() {
    S.asking = { q: S.q, t0: Date.now(), names: knownSources() };
    S.askedMs = 0;
    tick();
  }
  function endAsking(report) {
    if (S.asking) S.askedMs = Date.now() - S.asking.t0;
    S.asking = null;
    stopTick();
    if (report) {
      var names = Object.keys(report).filter(function (k) { return k !== "library"; }).sort();
      if (names.length) {
        S.srcNames = names;
        try { localStorage.setItem(SRC_KEY, JSON.stringify(names)); } catch (e) {}
      }
    }
  }
  /* THE SECONDS MOVE WITHOUT A REDRAW. One timer, half a second, and it
     touches only the strip's own clock and bar -- never the list, so a row
     you are pointing at does not flicker under you while you wait. Stopped
     the moment the answer lands, the field is cleared, or the sheet shuts. */
  var tickTimer = null;
  function tick() {
    clearTimeout(tickTimer);
    if (!S.asking || !opened) return;
    var n = listEl && listEl.querySelector(".sf-src.asking");
    if (n) paintAsking(n);
    tickTimer = setTimeout(tick, 500);
  }
  function stopTick() { clearTimeout(tickTimer); tickTimer = null; }
  function askingWords(a) {
    var sec = (Date.now() - a.t0) / 1000;
    var names = a.names.length;
    if (sec <= BUDGET_S)
      return { head: "Searching " + names + " source" + (names === 1 ? "" : "s")
                     + " for “" + a.q + "”",
               clock: Math.floor(sec) + " s",
               sub: "every source is asked at once; studio answers for all of them "
                  + "together, within " + BUDGET_S + " s",
               p: Math.min(1, sec / BUDGET_S) };
    return { head: "Still searching for “" + a.q + "”",
             clock: Math.floor(sec) + " s",
             sub: "past studio's " + BUDGET_S + " s — it answers with whatever came back; "
                + "this page stops waiting at 40 s and says so",
             p: 1 };
  }
  function paintAsking(n) {
    var w = askingWords(S.asking);
    var h = n.querySelector(".sf-srchead .hl"), c = n.querySelector(".sf-srchead .ck"),
        sub = n.querySelector(".sf-srcsub"), bar = n.querySelector(".sf-srcbar i");
    if (h) h.textContent = w.head;
    if (c) c.textContent = w.clock;
    if (sub) sub.textContent = w.sub;
    if (bar) bar.style.width = (w.p * 100).toFixed(1) + "%";
  }

  /* ------------------------------------------------ WHAT A SOURCE ACTUALLY DID
     `/search`'s report, read as data and never as prose. The four words are
     the four things that can be true, and `tools/search/sources/__init__.py`
     is where the fields come from:

       n        count > 0                       it worked
       down     count 0 AND failures[] non-empty  a host refused or would not
                                                answer -- the host and the
                                                reason are in `failures`
       off      count 0, no failures, and its log says it is not offered
                (dokumen: the site is down and its robots.txt gives no
                permission) -- the app did not look, and must not pretend it did
       nothing  count 0, nothing refused        it looked, there is nothing

     THE WHOLE POINT, and it is Osca's sentence of 8 September: a failed
     source must not read as an empty one. Before this the page had only
     `error`, which by the registry rule is null for every real source that
     is down -- adapters CATCH their own failures and return []. Measured on
     a machine with no network at all: seven adapters, every one of them
     `{count: 0, error: null, log: []}`. */
  function sourceState(rep) {
    if (!rep) return { word: "—", why: "" };
    if (rep.error) return { word: "failed", why: String(rep.error) };
    if (rep.count > 0) return { word: String(rep.count), why: "" };
    var fails = rep.failures || [];
    if (fails.length) return { word: "down", why: fails.join(" · ") };
    var log = rep.log || [];
    var off = log.filter(function (l) { return /not offered|not installed|no local catalogue/i.test(l); });
    if (off.length) return { word: "off", why: off.join(" · ") };
    return { word: "nothing", why: log.length ? log[log.length - 1] : "" };
  }
  /* how many sources actually looked -- so "nothing found" can be told from
     "nothing could be asked" in one number, on the page */
  function sourceTally() {
    var t = { worked: 0, down: 0, off: 0, nothing: 0, failed: 0, n: 0 };
    if (!S.adapters) return t;
    Object.keys(S.adapters).forEach(function (k) {
      if (k === "library") return;                 /* your own shelf is not "out there" */
      t.n++;
      var w = sourceState(S.adapters[k]).word;
      if (w === "down") t.down++;
      else if (w === "off") t.off++;
      else if (w === "failed") t.failed++;
      else if (w === "nothing") t.nothing++;
      else t.worked++;
    });
    return t;
  }

  /* ================================================================ ranking
     THE ONE NUMBER THAT DECIDES THE LIST'S SHAPE, and it is the bench's:
     `bias` is what a row you already own is worth over one you would have to
     fetch. At 0 the list is pure match quality; at 2 your library is always
     first and "mixed" stops meaning anything. It starts at 1, which puts an
     exact match out there above a loose match of yours. */
  function score(text, q) {
    var t = norm(text), n = norm(q);
    if (!n) return 0.5;
    if (t === n) return 3;
    if (t.indexOf(n) === 0) return 2.2;
    if (t.indexOf(n) >= 0) return 1.4;
    /* every word of the query somewhere in the text */
    var ws = n.split(/\s+/).filter(Boolean);
    if (ws.length && ws.every(function (w) { return t.indexOf(w) >= 0; })) return 1.0;
    return 0;
  }
  /* THE TITLE IS WORTH MORE THAN THE AUTHOR, and the two together are worth
     something on their own: "Spinoza Ethics" is a title and an author, and a
     row that fails both alone matches the pair. */
  function match(title, author, q) {
    return Math.max(score(title, q),
                    score(author || "", q) * 0.7,
                    score((title || "") + " " + (author || ""), q) * 0.95);
  }
  /* what a source is worth as a tie-break, and it is only a tie-break: a
     Gutenberg text is a parse away, an Archive scan may be a scan. */
  var SRCW = { gutenberg: 0.10, archive: 0.05, librivox: 0.02 };
  function rank() {
    var q = S.q, out = [];
    S.shelf.forEach(function (b) {
      var s = match(b.title, b.author, q);
      if (q && !s) return;
      out.push({ kind: "shelf", key: "b:" + b.slug, book: b, s: s + CFG.bias });
    });
    S.out.forEach(function (c, i) {
      var k = "o:" + (c.url || (c.source + ":" + c.title) || i);
      if (S.work[k] || onShelf(c)) return;    /* it is ours now; not twice */
      out.push({ kind: "out", key: k, cand: c,
                 s: match(c.title, c.author, q) + (SRCW[c.source] || 0) });
    });
    /* ON THE DRIVE, AND NOT PARSED -- `studio.html::panelSources`, which was
       a modal list of buttons that until studio-simplify had no handler at
       all. It is the THIRD state a row can be in, and it belongs in the one
       list for the same reason the other two do: *"your library AND out
       there, in ONE list. Told apart by the spine, never by a badge and
       never by being in two different lanes."* A file in TTS_DATA/sources/
       is neither yours (no book) nor out there (nothing to fetch): it is
       here, and one press parses it in place -- no upload, no copy.

       A SOURCE ALREADY PARSED IS NOT DRAWN. `sources()` cross-references
       every file against every book's own `source.path` and answers
       `parsed_as`, and the book is already a row above -- so drawing it
       again is the library-adapter twin this surface exists not to draw
       (`onShelf`'s own rule, one lane over). The count is kept and said in
       the head instead, because "12 files, 9 of them already books" is the
       useful sentence and twelve duplicate rows are not. */
    (S.drive || []).forEach(function (f) {
      if (f.parsed_as) return;
      var k = "d:" + f.source;
      if (S.work[k]) return;                  /* it is being parsed now */
      var sc = match(f.name, f.kind, q);
      if (q && !sc) return;
      out.push({ kind: "drive", key: k, file: f, s: sc });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out;
  }
  function onShelf(c) {
    var t = norm(c.title);
    return S.shelf.some(function (b) {
      var o = b.source && b.source.origin;
      if (o && o.from === "search") return sameOrigin(o, c);
      return norm(b.title) === t;
    });
  }

  /* ============================================================ PROVENANCE
     G-SURF2, Osca 10 Sep: *"For every shelf book -- on its row and in its
     detail -- show where it came from: the source file (book.source.path)
     and the origin (the candidate URL / archive id). When a book is added,
     say what file it was saved as."*

     Every word below is a field studio sends. `book.source` is
     `bookinfo.book_summary`'s: `file` (the name), `path` (the whole of
     `book.json`'s `source.path`), `kind`, and `origin` when one is on
     record, in one of two strengths:
       from "search"   written at add time from the candidate the book was
                       added from (`studio/add.py::record_origin`) -- the
                       candidate's url and its source's own id
       from "file"     no candidate was ever recorded, but the file's own
                       identifier is a url (a Gutenberg epub's dc:identifier)
     and nothing at all for a book dropped in by hand, which is said as such
     rather than left blank: a blank reads as "the page forgot". */
  function provOf(src) {
    src = src || {};
    var path = src.path || "";
    var file = src.file || (path ? String(path).split(/[\\/]/).pop() : "");
    var o = src.origin || null;
    var label = "", url = "";
    if (o) {
      url = o.url || "";
      label = url ? String(url).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "")
                  : [SOURCE[o.source] || o.source, o.id].filter(Boolean).join(" · ");
    }
    return { file: file, path: path, kind: src.kind || "", origin: o,
             label: label, url: url, from: o ? (o.from || "search") : "" };
  }
  /* the one line a row carries: FROM where, then the FILE -- lowercase and
     monospaced, because both are names a person may have to type or find,
     and letter case is part of a path */
  function provLine(from, file, fileTitle, fromTitle) {
    var n = el("span", "sf-prov");
    var o = el("span", "po"); o.textContent = from; if (fromTitle) o.title = fromTitle;
    n.appendChild(o);
    if (file) {
      n.appendChild(el("span", "sep", "·"));
      var f = el("span", "pf"); f.textContent = file; if (fileTitle) f.title = fileTitle;
      n.appendChild(f);
    }
    return n;
  }
  function shelfProv(b) {
    var p = provOf(b.source);
    if (!p.file && !p.origin) return null;
    var from = p.origin ? "from " + p.label : "no origin on record";
    return provLine(from, p.file, p.path || p.file,
                    p.origin ? (p.url || p.label) + (p.from === "file" ? " — the file's own identifier" : "")
                             : "added by hand, or before origins were kept");
  }
  /* the working row's line: what the file was SAVED AS, the moment staging
     answers -- `/stage_for_ingest`'s own `source`, relative to the depot's
     sources/ -- and where it was fetched from */
  function workProv(w) {
    var saved = w.source ? "saved as sources/" + String(w.source).replace(/^\/+/, "") : "";
    var from = w.origin ? provOf({ origin: w.origin }).label : "";
    if (!saved && !from) return null;
    return provLine(from ? "from " + from : "", saved, saved, w.origin && w.origin.url);
  }
  /* THE DETAIL: every provenance field, whole, and the two things you can do
     with them -- open the page it came from, and show the file in Finder
     (`POST /reveal`, the Library's own right-click, G-FINDER) */
  function provPane(b) {
    var p = provOf(b.source);
    var box = el("div", "sf-cand sf-provpane");
    box.appendChild(head("Where it came from"));
    var rows = [
      ["From", p.origin ? (p.origin.source ? (SOURCE[p.origin.source] || p.origin.source) : shortHost(p.url))
                        : "not on record — dropped in by hand, or added before origins were kept"],
      ["Id", p.origin && p.origin.id],
      ["Kind", p.kind],
      ["File", p.file],
      ["On record", p.from === "file" ? "the file's own identifier — no search candidate was recorded" : null]
    ];
    var dl = el("div", "sf-fields");
    rows.forEach(function (kv) {
      if (kv[1] == null || kv[1] === "") return;
      dl.appendChild(el("span", "k", esc(kv[0])));
      dl.appendChild(el("span", "v", esc(String(kv[1]))));
    });
    box.appendChild(dl);
    if (p.url) { var u = el("div", "sf-url sf-origin"); u.textContent = p.url; u.title = p.url; box.appendChild(u); }
    if (p.path) { var f = el("div", "sf-url sf-path"); f.textContent = p.path; f.title = p.path; box.appendChild(f); }
    var acts = el("div", "sf-acts");
    if (p.url && /^https?:/.test(p.url)) {
      var o = el("button", "sf-verb ghost");
      o.type = "button"; o.textContent = "Open the source page";
      o.addEventListener("click", function () { openOut(p.url); });
      acts.appendChild(o);
    }
    var r = el("button", "sf-verb ghost");
    r.type = "button"; r.textContent = "Show in Finder";
    r.title = p.path ? "POST /reveal — Finder, with " + p.file + " selected"
                     : "this book has no source file on record";
    if (!p.path || !S.live) r.disabled = true;
    r.addEventListener("click", function () {
      if (r.disabled) return;
      r.disabled = true;
      postJSON("/reveal", { slug: b.slug }).then(function (j) {
        r.textContent = j && j.error ? "Couldn't — " + j.error : "Shown in Finder";
        setTimeout(function () { r.textContent = "Show in Finder"; r.disabled = false; }, 2500);
      });
    });
    acts.appendChild(r);
    box.appendChild(acts);
    return box;
  }
  /* THE SAME BOOK, BY WHERE IT CAME FROM. A shelf book whose origin was
     recorded from a search is the same book as a result only when the
     result IS that origin -- so a second archive edition of a title you
     already have is a result you can add (G-SLUG's other half), where the
     title rule alone hid it. A book with no recorded origin keeps the title
     rule, which is the only thing there is to go on. */
  function sameUrl(a, b) {
    function n(u) { return String(u || "").toLowerCase().replace(/^https?:\/\//, "")
                      .replace(/^www\./, "").replace(/\/+$/, ""); }
    return !!a && !!b && n(a) === n(b);
  }
  function sameOrigin(o, c) {
    if (!o || !c) return false;
    if (o.url && c.url && sameUrl(o.url, c.url)) return true;
    return !!(o.id && c.source_id && o.source === c.source && String(o.id) === String(c.source_id));
  }
  /* the shelf book a working row became: its slug when studio has said it,
     else its FILE -- the staged name is the book's `source.file` (or the
     stem of it, when the parser read a converted copy such as `.ocr.pdf`) --
     and last, by title, but ONLY a book that was not on the shelf when the
     row began (`w.before`). That last clause is the whole difference from
     the rule this replaces: the first edition of "The Ethics" was already
     there when the second was pressed, so it can never be taken for it. */
  function landedBook(c) {
    var file = c.source ? String(c.source).split("/").pop() : "";
    var stem = file.replace(/\.[^.]+$/, "");
    var hit = null;
    S.shelf.forEach(function (b) {
      if (hit) return;
      var bf = (b.source && b.source.file) || "";
      if (c.slug && b.slug === c.slug) hit = b;
      else if (file && bf && (bf === file || bf.indexOf(stem + ".") === 0)) hit = b;
    });
    if (hit || c.slug) return hit;
    var before = c.before || [];
    return S.shelf.filter(function (b) {
      return before.indexOf(b.slug) < 0 && norm(b.title) === norm(c.title || "§");
    })[0] || null;
  }

  /* ================================================================ drawing */
  function draw() {
    if (!listEl) return;
    /* THE WAIT IS STATE (G-SURF2) -- see `S.asking`. Every caller of draw()
       now draws it, which is the whole of the fix for the note that vanished
       a microtask after it appeared. */
    var searching = !!S.asking;
    listEl.textContent = "";
    var rows = rank();
    /* ONE LIST, AND IT IS THE FOLD (item 1). This was `S.work`'s own rows
       alone -- what this surface had started -- while the queue lived in the
       other column. `workingRows()` folds studio's five queue fields in with
       them, in studio's order, so the band is the whole answer. */
    var working = workingRows();

    /* WORKING first, always, and pinned -- it is the only band that is about
       what the machine is doing rather than about what you asked. Since
       Round 2 it is ALSO the only place any of it appears: the right column
       stopped mirroring the running job, so this band has to be complete. */
    if (working.length) {
      listEl.appendChild(workingHead(working));
      working.forEach(function (w) {
        listEl.appendChild(workRow(w));
        /* ITEM 2: the log expands UNDER ITS OWN ROW, not at the foot of the
           other column. Two running books, two logs, each under the book it
           belongs to. */
        var lg = S.logs[w.key];
        if (lg && lg.open) listEl.appendChild(logPane(lg));
      });
    }

    /* WHAT EACH SOURCE IS DOING, AT THE TOP OF RESULTS -- during AND after
       (G-SURF2). It was a line under the list, drawn only once the answer
       was in; while the search was out the page said "Searching…" in the
       note's grey, at the foot, for one microtask. Now the one strip is the
       first thing under the Results head from the moment the search leaves
       to the moment it is replaced: every source by name while it is out,
       what each did once it has answered. Not a debug panel -- it is the
       difference between "nothing anywhere" and "the three places that
       would have it did not answer". */
    var strip = S.q && (searching || S.adapters) ? sourcesStrip() : null;
    if (CFG.mixed) {
      if (rows.length || strip) listEl.appendChild(head(S.q ? "Results" : "Your library"));
      if (strip) listEl.appendChild(strip);
      rows.forEach(function (r) { listEl.appendChild(rowFor(r)); });
    } else {
      if (strip) listEl.appendChild(strip);
      var mine = rows.filter(function (r) { return r.kind === "shelf"; });
      var here = rows.filter(function (r) { return r.kind === "drive"; });
      var them = rows.filter(function (r) { return r.kind === "out"; });
      if (mine.length) { listEl.appendChild(head("Your library"));
        mine.forEach(function (r) { listEl.appendChild(shelfRow(r.book)); }); }
      if (here.length) { listEl.appendChild(head(driveHead()));
        here.forEach(function (r) { listEl.appendChild(driveRow(r.file, r)); }); }
      if (them.length) { listEl.appendChild(head("Out there"));
        them.forEach(function (r) { listEl.appendChild(outRow(r)); }); }
    }
    /* THE FILES ALREADY PARSED ARE NOT ROWS, AND THEY ARE NOT NOTHING. The
       twin rule drops them from the list (the book is a row above); the
       count is the sentence that makes the drop legible. */
    if (!S.q && driveParsed() && rows.some(function (r) { return r.kind === "drive"; }))
      listEl.appendChild(note(driveHead()));

    if (S.q && !searching && S.outErr) listEl.appendChild(note(S.outErr));
    else if (S.q && !searching && !rows.length && !working.length && !S.media.length)
      listEl.appendChild(note(nothingLine()));
    /* THE MOCK SAYS SO, AND ONLY THE MOCK. With studio behind the page this
       line is not softened or reworded -- it is not there. What replaces it
       when the server is there but silent is `S.stateErr`, which names the
       route and the failure rather than calling live rows a mock. */
    if (!S.live) listEl.appendChild(note(noStudioLine()));
    else if (S.stateErr) listEl.appendChild(note(S.stateErr));

    /* the per-source strip that stood here moved to the TOP of Results --
       see `strip` above (G-SURF2) */

    /* the lanes that are not books, at the foot of the one list */
    if (S.q) {
      var here = inBookRow();
      if (here) { listEl.appendChild(head("In this book")); listEl.appendChild(here); }
      chapterRows().forEach(function (n, i) {
        if (!i) listEl.appendChild(head("Chapters"));
        listEl.appendChild(n);
      });
      listEl.appendChild(head("Elsewhere"));
      videoLane(listEl);
      webLane(listEl);
    }
    drawWorks();
  }

  /* "Nothing on the shelves for that." WAS A LIE WHENEVER A SOURCE WAS DOWN.
     Now the sentence is made of what actually happened. */
  function nothingLine() {
    if (!S.live || !S.adapters) return "Nothing on the shelves for that.";
    var t = sourceTally();
    if (t.down + t.failed >= t.n && t.n)
      return "Nothing found — and not one source answered. " + t.down + " down of " + t.n + ".";
    if (t.down + t.failed)
      return "Nothing found, but " + (t.down + t.failed) + " of " + t.n
           + " sources could not be reached — this is not the same as nothing being there.";
    return "Nothing on the shelves, and " + t.n + " sources looked and found nothing.";
  }

  /* THE STRIP, in its two states, and it is the same element in both so
     nothing jumps when the answer lands (G-SURF2):

       asking    "Searching 6 sources for “ethics”   4 s"
                 a bar filling against the 25 s studio gives a search
                 one chip per source, each ASKING, and one line saying that
                 studio answers for all of them together
       answered  "6 sources answered for “ethics” in 4.2 s — 2 found
                 something · 1 down · 1 off · 2 nothing"
                 one chip per source: its word, and its reason in the title
                 attribute and in a line under it when it is bad news */
  function sourcesStrip() {
    var a = S.asking;
    var box = el("div", "sf-src" + (a ? " asking" : ""));
    var hd = el("div", "sf-srchead");
    var hl = el("span", "hl"), ck = el("span", "ck");
    hd.appendChild(hl); hd.appendChild(ck);
    box.appendChild(hd);
    if (a) {
      var bar = el("span", "sf-srcbar"); bar.appendChild(el("i"));
      box.appendChild(bar);
      a.names.forEach(function (k) {
        var chip = el("span", "sf-chip s-ask");
        chip.appendChild(el("b", null, esc(SOURCE[k] || k)));
        chip.appendChild(el("i", null, "asking"));
        chip.title = (SOURCE[k] || k) + " has been asked and has not answered yet";
        box.appendChild(chip);
      });
      box.appendChild(el("span", "sf-srcsub"));
      paintAsking(box);
      return box;
    }
    var names = Object.keys(S.adapters).filter(function (k) { return k !== "library"; }).sort();
    var t = sourceTally();
    var parts = [];
    if (t.worked) parts.push(t.worked + " found something");
    if (t.down) parts.push(t.down + " down");
    if (t.failed) parts.push(t.failed + " failed");
    if (t.off) parts.push(t.off + " off");
    if (t.nothing) parts.push(t.nothing + " nothing");
    hl.textContent = names.length + " source" + (names.length === 1 ? "" : "s")
      + " answered for “" + (S.searchedFor || S.q) + "”"
      + (parts.length ? " — " + parts.join(" · ") : "");
    ck.textContent = S.askedMs ? (S.askedMs / 1000).toFixed(1) + " s" : "";
    names.forEach(function (k) {
      var st = sourceState(S.adapters[k]);
      var chip = el("span", "sf-chip s-" + (/^\d+$/.test(st.word) ? "n" : st.word));
      chip.appendChild(el("b", null, esc(SOURCE[k] || k)));
      chip.appendChild(el("i", null, esc(st.word)));
      if (st.why) chip.title = st.why;
      chip.addEventListener("click", function () {
        if (!st.why) return;
        var open = box.querySelector(".sf-srcwhy");
        if (open) box.removeChild(open);
        if (!open || open.dataset.k !== k) {
          var line = el("div", "sf-srcwhy");
          line.dataset.k = k;
          line.textContent = (SOURCE[k] || k) + " — " + st.why;
          box.appendChild(line);
        }
      });
      box.appendChild(chip);
    });
    if (S.dropped.length) {
      var d = el("span", "sf-chip s-drop");
      d.appendChild(el("b", null, "filtered"));
      d.appendChild(el("i", null, String(S.dropped.length)));
      d.title = S.dropped.length + " hit(s) came back and the title/author filter "
              + "dropped them as a different work";
      box.appendChild(d);
    }
    return box;
  }

  /* the IN THIS BOOK lane: one row, and it is only drawn when there is
     genuinely a Find to hand the query to */
  function inBookRow() {
    if (typeof window.TTSTVFind !== "function") return null;
    var r = rowShell("r-out sf-find", "find");
    r.querySelector(".t").textContent = "Find “" + S.q + "” on this page";
    r.querySelector(".s").textContent = "the reader's own Find — ⌘F";
    r.addEventListener("click", function () { findHere(S.q); });
    return r;
  }

  /* --------------------------------------------------------- FIND THE CHAPTER
     Osca's workflow, 8 Sep: *"open a book -> search -> find the book / find
     the chapter -> generate the audio (TTS)"*. The middle step had nowhere to
     happen. When a book is in context -- selected in the works column, or the
     one the reader underneath has open -- its own chapters are searched by
     the same query, in the same list, and each row carries the two verbs the
     workflow names: OPEN it, and VOICE it. */
  function chapterRows() {
    var b = subject();
    if (!b || !b.slug || !S.q) return [];
    var d = S.detail[b.slug];
    if (!d && S.live) { loadBook(b.slug); return []; }
    var chs = (d && d.chapters) || [];
    var hits = chs.map(function (ch) {
        return { ch: ch, s: Math.max(score(ch.title || "", S.q), score(ch.id || "", S.q)) };
      })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b2) { return b2.s - a.s; })
      .slice(0, 6);
    return hits.map(function (r) { return chapterRow(b, r.ch); });
  }
  function chapterRow(b, ch) {
    var r = rowShell("r-shelf sf-ch", "c:" + b.slug + ":" + ch.id);
    r.style.setProperty("--hue", hue(b.slug));
    r.querySelector(".spine").style.background = hue(b.slug);
    r.querySelector(".t").textContent = ch.title || ch.id;
    var voiced = ch.state && ch.state.speak === "ok";
    r.querySelector(".s").textContent =
      [b.title, ch.id, ch.words ? ch.words + " words" : "",
       voiced ? "voiced" : "no audio"].filter(Boolean).join(" · ");
    var end = r.querySelector(".end");
    end.appendChild(ribbon(ch.state || {}));
    /* GENERATE THE AUDIO. `POST /run {slug, chapter, step:"speak"}` is
       studio's own single-cell route, unchanged and unwrapped -- the same
       one studio.html presses. It is not drawn without a live studio. */
    if (S.live) {
      var v = el("button", "sf-verb");
      v.type = "button"; v.textContent = voiced ? "Re-voice" : "Voice";
      v.addEventListener("click", function (e) {
        e.stopPropagation();
        run({ slug: b.slug, chapter: ch.id, step: "speak" }, v, "Voicing");
      });
      end.appendChild(v);
    }
    /* §5.8 again, and here it answers §8's own open question. A chapter row
       used to open the book on a body click; it SELECTS now -- the book into
       THE WORKS, and this chapter as the unit the studio's Sample will spend
       its GPU minutes on. That is the chapter picker the last report asked
       about, and it costs no new control: the row you pressed is the thirty
       seconds you get. `Open` is the door, drawn beside `Voice`. */
    if (S.live) {
      var o = el("button", "sf-verb ghost");
      o.type = "button"; o.textContent = "Open";
      o.title = "open " + (b.title || b.slug) + " at " + ch.id;
      o.addEventListener("click", function (e) { e.stopPropagation(); openBook(b, ch.id); });
      end.appendChild(o);
    }
    r.addEventListener("click", function () {
      S.unit = ch.id; S.unitSlug = b.slug;
      selectSlug(b.slug);
      Array.prototype.forEach.call(listEl.querySelectorAll(".sf-row.sel"),
        function (n) { n.classList.remove("sel"); });
      r.classList.add("sel");
    });
    return r;
  }
  function head(t) { var h = el("span", "sf-h"); h.textContent = t; return h; }

  /* ================================================ EVERY RENDER, ALL BOOKS
     `studio.html::panelQueue`, which was a modal over the host's own front
     page, as a STATE of this surface -- opened from the WORKING header,
     closed from the same button, and nowhere you navigate to.

     WHY IT BELONGS HERE AND NOT IN A PANEL. `GET /queue-all` is the only
     view of a render that FAILED for a book nobody has open, or whose rows
     have been binned: *"Group 21 of 3 Sep (`a-dolls-house-a-play`, Modal,
     qwen3) carried `modal.exception.ResourceExhaustedError: workspace
     billing cycle spend limit reached` with no rows left at all, so the only
     place that sentence existed was a file nobody reads"* (`push.py::
     groups_all`). The WORKING band is where this surface says what the
     machine is doing; the whole queue is the same subject with the clock
     wound back, so it is the same band with one more control on its header
     -- not a second surface, and not a page of studio.html.

     ASKED ON OPEN AND ON REFRESH, NEVER ON THE POLL. That is the route's own
     instruction and the reason it is not on `/state`.

     THE ROW IS NOT THE RENDER. A group outlives its rows, so `rows_binned`
     is drawn as itself rather than as "no chapters", and a group with a
     `queue` gets the one log its whole push wrote. */
  function askAll() {
    S.allAsking = true; S.allErr = ""; draw();
    var url = api("/queue-all");
    if (!url) {
      /* the bench has no server, so it has the shape and says so */
      S.all = { groups: MOCK_GROUPS, pending: [], hold: null, mock: true };
      S.allAsking = false; draw(); return;
    }
    /* A STUDIO OLDER THAN THE ROUTE is the one failure with a CURE, and it
       is the likely one: `/queue-all` is newer than the rest of this door,
       and a running Frank that predates it answers 404 with a body. So the
       STATUS decides the sentence, not the exception -- a 404 read through
       `.json()` resolves perfectly well, which is how this said "no such
       route" (a phrase nobody can act on) in its first draft. Anything else
       says what studio said, and "couldn't reach it" is reserved for the
       case where studio did not answer at all, or the whole surface would
       send somebody to their Wi-Fi over a version mismatch. */
    var gone = false;
    ask_(url, 20000, { cache: "no-store" })
      .then(function (r) { gone = (r.status === 404 || r.status === 501); return r.json(); })
      .then(function (j) {
        S.allAsking = false;
        if (gone) {
          S.all = null;
          S.allErr = "This studio has no /queue-all — it may be older than the route. "
                   + "Quit Frank and open it again.";
        } else {
          S.all = j || { groups: [] };
          S.allErr = j && j.error ? "/queue-all — " + String(j.error) : "";
        }
        draw();
      })
      .catch(function (e) {
        S.allAsking = false; S.all = null;
        S.allErr = why("/queue-all", e);
        draw();
      });
  }
  /* WHERE IT RAN, in the words Settings uses for the same three. */
  function whereWord(w) {
    return w === "modal" ? "Modal" : w === "kaggle" ? "Kaggle" : "this Mac";
  }
  /* ONE GROUP, ONE ROW. Book(s) · lane · model · when, then its chapters,
     then ONE state word AND ITS REASON IN THE SAME BREATH -- a failed group
     with no sentence is the bug this list was built for, so where the group
     has none the row says that too. */
  function allRow(g) {
    var r = rowShell("r-all r-" + String(g.state || "").replace(/[^a-z]/g, ""), "g:" + g.group);
    var h = hueFor((g.slugs && g.slugs[0]) || ("g:" + g.group));
    r.style.setProperty("--hue", h);
    r.querySelector(".spine").style.background = h;
    var books = (g.slugs || []).map(function (sl) { return bookTitle(sl) || sl; });
    var when = g.ended ? mmss((Date.now() / 1000) - g.ended) + " ago"
             : g.started ? mmss((Date.now() / 1000) - g.started) + " in" : "";
    r.querySelector(".t").textContent =
      [books.join(" · ") || "unknown book", whereWord(g.where),
       g.engine || "no model named", when].filter(Boolean).join(" · ");
    var units = (g.units || []).map(function (u) { return u.unit; });
    r.querySelector(".s").textContent = units.length ? units.join(", ")
      : g.rows_binned ? "rows binned — the render is still what it was"
      : "no chapters";
    var why_ = (g.state === "failed" || g.state === "stopped")
      ? " — " + (g.error || "no cause was recorded")
      : (g.state === "held" && S.hold && S.hold.why) ? " — " + S.hold.why : "";
    var st = el("span", "sf-prov" + (why_ ? " err" : ""));
    st.textContent = String(g.state || "") + why_;
    r.querySelector(".body").appendChild(st);
    /* WHAT IT PRODUCED, off the disk (`groups_all` stats every master). A
       finished group that produced nothing says so rather than implying
       audio -- an unplugged drive answers nothing and this is where that
       shows. */
    if (g.produced && g.produced.length) {
      var pr = el("span", "sf-prov");
      pr.textContent = g.produced.length + " master" + (g.produced.length === 1 ? "" : "s")
        + " on the drive · " + g.produced.map(function (x) { return x.master; }).join(" · ");
      r.querySelector(".body").appendChild(pr);
    } else if (g.state === "voiced" || g.state === "pulled") {
      r.querySelector(".body").appendChild(note("nothing on the drive for it"));
    }
    var end = r.querySelector(".end");
    /* THE SEVENTH LOG SHAPE, and this row is the only place it can be asked
       for: the queue name is the group's own field. */
    var q = logQuery(g);
    if (q) {
      var key = "g:" + g.group, open_ = !!(S.logs[key] && S.logs[key].open);
      end.appendChild(rowBtn(open_ ? "hide log" : "log", "this push's own courier log",
        function () {
          if (S.logs[key] && S.logs[key].open) { S.logs[key].open = false; draw(); return; }
          openLog(key, q, books.join(" · ") || ("push " + g.group));
        }));
    }
    if (g.kernel_url)
      end.appendChild(rowBtn("kernel", "open the kernel this push ran on",
        function () { openOut(g.kernel_url); }));
    return r;
  }
  /* THE BAND, under the working list. Five states and each says which it is:
     asking, refused, empty, the rows, and the pending count above them. */
  /* WHERE IT SITS, AND WHY NOT ON THE WORKING HEADER. `Hold all` is on that
     header because it is about the MACHINE, and this is too -- but the
     header is only drawn when the band has rows ("an empty band draws no
     header", Round 2 item 1, and there is a test on it). A control you can
     only reach while something is running is the wrong control for a list
     whose whole purpose is the render that failed for a book nobody has
     open, which is most likely when NOTHING is running. So it lives at the
     top of THE WORKS, above the book-level rows, in the same order the
     column already reads: the machine first, then the book. One home. */
  function allBand() {
    var box = el("div", "sf-all");
    var h = el("div", "sf-h sf-allhead");
    var n = el("span", "wl");
    n.textContent = "Every render, all books";
    h.appendChild(n);
    var tb = el("button", "sf-verb ghost");
    tb.type = "button";
    tb.textContent = S.allOpen ? "Hide" : "Show";
    tb.title = "every render, every book — including the ones whose rows are gone";
    tb.addEventListener("click", function (e) {
      e.stopPropagation();
      S.allOpen = !S.allOpen;
      /* asked once, on the open that needs it; Refresh is the other ask */
      if (S.allOpen && !S.all && !S.allAsking) askAll(); else draw();
    });
    h.appendChild(tb);
    if (S.allOpen) {
      var rb = el("button", "sf-verb ghost");
      rb.type = "button"; rb.textContent = "Refresh";
      rb.addEventListener("click", function (e) { e.stopPropagation(); askAll(); });
      h.appendChild(rb);
    }
    box.appendChild(h);
    if (!S.allOpen) return box;
    if (S.allAsking) { box.appendChild(note("Asking the server for every group…")); return box; }
    if (S.allErr) { box.appendChild(note(S.allErr)); return box; }
    var d = S.all;
    if (!d) { box.appendChild(note("Nothing asked yet.")); return box; }
    if (d.mock) box.appendChild(note("mock groups — nothing was asked."));
    var waiting = (d.pending || []).reduce(function (a, b) { return a + (b.n || 0); }, 0);
    if (waiting)
      box.appendChild(note(waiting + " chapter" + (waiting === 1 ? "" : "s")
        + " queued and not yet pushed"
        + (S.hold ? " — and nothing leaves that list while renders are held" : "")));
    box.appendChild(note("One row per push — every book, every lane, newest first. "
      + "A render outlives its rows: binning a row does not bin the render, and this is "
      + "where the ones with no rows left are still readable."));
    var gs = d.groups || [];
    if (!gs.length) { box.appendChild(note("Nothing has been pushed yet.")); return box; }
    gs.forEach(function (g) {
      box.appendChild(allRow(g));
      var lg = S.logs["g:" + g.group];
      if (lg && lg.open) box.appendChild(logPane(lg));
    });
    return box;
  }

  /* THE BAND'S OWN HEADER, and `Hold all` lives on it (item 1: *"'Hold all'
     belongs on the WORKING header, not the right panel"*). It is the one
     control here that is about the MACHINE rather than about a row -- it
     holds every render until Resume -- so it belongs to the list and not to
     any book in it. The count beside it is what the list is for. */
  function workingHead(rows) {
    var h = el("div", "sf-h sf-workhead");
    var running = rows.filter(function (r) { return r.kind === "run"; }).length;
    var n = el("span", "wl");
    n.textContent = "Working" + (rows.length > 1
      ? " — " + running + " running, " + (rows.length - running) + " queued" : "");
    h.appendChild(n);
    if (S.live) {
      var held = !!S.hold;
      var b = el("button", "sf-verb ghost");
      b.type = "button";
      b.textContent = held ? "Resume all" : "Hold all";
      b.title = held ? "clear the hold on every render"
                     : "hold every render until Resume — the machine, not this row";
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        act(held ? "/resume" : "/hold",
            held ? {} : { why: "held from the search surface" }, b,
            held ? "…" : "…");
      });
      h.appendChild(b);
    }
    if (S.hold && S.hold.why) {
      var w = el("span", "sf-heldwhy");
      w.textContent = String(S.hold.why);
      h.appendChild(w);
    }
    return h;
  }
  function note(t) { var n = el("span", "sf-note"); n.textContent = t; return n; }

  function rowShell(cls, key) {
    var r = el("div", "sf-row " + cls);
    r.dataset.key = key;
    r.appendChild(el("span", "spine"));
    var b = el("span", "body");
    b.appendChild(el("span", "t")); b.appendChild(el("span", "s"));
    r.appendChild(b);
    r.appendChild(el("span", "end"));
    return r;
  }

  /* one row, whichever of the three states it is in */
  function rowFor(r) {
    return r.kind === "shelf" ? shelfRow(r.book)
         : r.kind === "drive" ? driveRow(r.file, r)
         : outRow(r);
  }
  function driveParsed() {
    return (S.drive || []).filter(function (f) { return !!f.parsed_as; }).length;
  }
  function driveHead() {
    var n = (S.drive || []).length, p = driveParsed();
    return n + " file" + (n === 1 ? "" : "s") + " on the drive"
         + (p ? ", " + p + " of them already " + (p === 1 ? "a book" : "books") : "");
  }

  /* --- ON THE DRIVE: the row is a parse ----------------------------------- */
  function driveRow(f, r0) {
    var r = rowShell("r-drive", r0.key);
    var h = hueFor(r0.key);
    r.style.setProperty("--hue", h);
    r.querySelector(".spine").style.background = h;
    r.querySelector(".t").textContent = f.name;
    r.querySelector(".s").textContent =
      [f.kind, f.mb != null ? f.mb + " MB" : null, "on the drive, not parsed"]
        .filter(Boolean).join(" · ");
    /* WHERE IT ACTUALLY IS, in the words `POST /ingest` takes back -- the
       same key `sources()` answers with, so the row names the thing it will
       send rather than a label for it. */
    var pv = el("span", "sf-prov");
    pv.textContent = "TTS_DATA/sources/" + f.source;
    r.querySelector(".body").appendChild(pv);
    var verb = el("button", "sf-verb");
    verb.type = "button"; verb.textContent = "Parse";
    /* NOT "ADD": nothing is being fetched and nothing is being copied. The
       file is here; the press is the parse. `POST /ingest {source}` and no
       staging -- `stage_for_ingest` exists to bring a candidate DOWN to the
       depot, and this is already in it (studio.html's own single call). */
    verb.title = "parse it in place — POST /ingest {source} — no upload, no copy";
    verb.addEventListener("click", function (e) { e.stopPropagation(); parseHere(r0, verb); });
    r.querySelector(".end").appendChild(verb);
    r.addEventListener("click", function () { selectCandidate(r, r0); });
    return r;
  }
  /* ONE PRESS, ONE ROUTE. The row becomes THE WORKING ROW in place, exactly
     as an Add does -- same `beginWork`, same `holdAs` on the source (which is
     the name `/state`'s `importing` will use for it), same poll. The only
     difference from `add` is the half that is missing: there is nothing to
     stage. */
  function parseHere(r0, verb) {
    if (verb && verb.disabled) return;
    var f = r0.file;
    var w = S.work[r0.key] || beginWork(r0.key, { title: f.name, author: "" });
    w.source = f.source;
    w.origin = { source: "drive", id: null, url: null };
    w.failed = false; w.err = "";
    w.word = "Parsing"; w.cells.parse = "running"; w.p = 0.06;
    holdAs(w.key, f.source);
    draw();
    if (S.bench) return simulate(w);
    postJSON("/ingest", { source: f.source })
      .then(function (ing) {
        if (ing && ing.error) throw new Error(ing.error);
        pollWorks();
      })
      .catch(function (e) {
        w.word = "Couldn't parse it";
        w.err = String(e && e.message || e);
        w.failed = true;
        draw();
      });
  }

  /* --- ON THE SHELF: the row is the door ---------------------------------- */
  function shelfRow(b) {
    var r = rowShell("r-shelf", "b:" + b.slug);
    /* THE HELD COLOUR, not a fresh hash (Round 2 item 3): a book that arrived
       through the WORKING band aliased its slug to the colour it already had,
       so it does not change colour at the moment it lands. */
    var bh = hueFor(b.slug);
    r.style.setProperty("--hue", bh);
    r.querySelector(".spine").style.background = bh;
    r.querySelector(".t").textContent = b.title;
    r.querySelector(".s").textContent =
      [b.author || "unknown author", (b.langs || [b.lang]).filter(Boolean).join(" · "), "on the shelf"].filter(Boolean).join(" · ");
    /* WHAT A SHELF ROW CAN HONESTLY SAY, and it is the counters `/state`
       carries -- not a duration, which that payload has never had. */
    var pv = shelfProv(b);
    if (pv) r.querySelector(".body").appendChild(pv);
    var end = r.querySelector(".end");
    var said = el("span", "cnt");
    said.textContent = (b.chapters ? b.chapters + " ch" : "")
      + (!b.chapters ? "" : b.voiced ? " · " + b.voiced + " voiced" : " · no audio");
    end.appendChild(said);
    /* ====================================== THE ROW SELECTS (§5.8, 8 Sep)
       Osca: *"clicking a result selects it (shows its detail/metadata, drives
       THE WORKS for that item) ... ADD stays its own button inside the row;
       the rest of the row is a click target with a real hover state."*

       So the rule is ONE rule and it is the same for every row on the left:
       THE BODY SELECTS, AND EVERY NAVIGATION IS A BUTTON. This row used to
       be the DOOR -- a body click opened the reader and left the surface --
       which made the shelf the only row you could not inspect without also
       leaving, and made the door the thing you hit by accident. The door is
       `Read` now, a control you can see, beside the counters it belongs
       with. The chevron stays and does what the body does: it is the visible
       affordance saying this row HAS a second question, and it is what
       `reader/tests/test_surface.py::test_the_chevron_asks_for_the_book…`
       presses. Two targets, one answer -- which is not two controls for one
       thing, it is a control and the row it is drawn on. */
    var read = el("button", "sf-verb");
    read.type = "button"; read.textContent = "Read";
    read.title = "open " + (b.title || b.slug) + " in the reader";
    read.addEventListener("click", function (e) { e.stopPropagation(); openBook(b); });
    end.appendChild(read);
    var peek = el("button", "sf-peek");
    peek.type = "button";
    peek.title = "its steps, in the works";
    peek.setAttribute("aria-label", "steps");
    peek.innerHTML = '<span class="chev"></span>';
    peek.addEventListener("click", function (e) {
      e.stopPropagation();
      select(r, b);
    });
    end.appendChild(peek);
    r.addEventListener("click", function () { select(r, b); });
    return r;
  }

  /* --- OUT THERE: no spine, one verb ------------------------------------- */
  /* ===================================== WHAT A RESULT ROW ACTUALLY KNOWS
     Round 2 items 4, 5 and 6. Every field below is one the candidate already
     carries (`tools/search/candidate.py`) and this row was throwing away:
     `word_count`, `chapters`, `duration_s`, `size_bytes`, `popularity`,
     `language`, `format`, `license`/`license_status`, `note`, `transcript`,
     `linked_id`, `reads_text`. Nothing here is fetched and nothing is
     invented -- it came back in the same `/search` answer that named the row.

     ITEM 5, AND IT IS A LAYOUT BUG NOT A TEXT ONE. The old line was
     `[author, source].join(" · ")` inside ONE `.s` span, and `.sf-row .s` is
     `white-space:nowrap; text-overflow:ellipsis` -- so a long author pushed
     the source off the end. MEASURED, 8 Sep, on the author "Benedictus de
     Spinoza, translated from the Latin by R. H. M. Elwes, with an
     introduction": the line overflowed its own box by 676 px, and the word
     "Gutenberg" was laid out at x 1345.6-1462.6 while the box ended at
     787.3 -- 558 px past the right edge, painted nowhere. It was in the DOM
     and it was not on the screen.

     The fix is structural, not a shorter string: the source is its OWN
     element with `flex:0 0 auto`, so it cannot be the thing that gets cut,
     and the author is the only `flex:1 1 auto` and truncates instead. Same
     row, same width, after: the source sits at x 344-466.4 inside a box
     ending at 693.6, the line overflows by 0, and the author's own span
     carries the 903 px of overflow. */
  function outRow(r0) {
    var c = r0.cand;
    var r = rowShell("r-out", r0.key);
    r.querySelector(".t").textContent = c.title;

    /* the second line: SOURCE first and unshrinkable, then the author */
    var s = r.querySelector(".s");
    s.textContent = "";
    var src = el("span", "sf-src-tag");
    src.textContent = SOURCE[c.source] || c.source || "out there";
    s.appendChild(src);
    var who = el("span", "sf-who");
    who.textContent = c.author || "unknown author";
    s.appendChild(who);
    if (c.language) { var lg = el("span", "sf-lang"); lg.textContent = c.language; s.appendChild(lg); }

    /* ITEM 6, THREE STATES, from the candidate's own fields. `linked_id` is
       `tools/search/pair.py`'s pairing token and both halves of a pair hold
       the same one; its prefix says how strong the pairing is -- `yt:` one
       item that IS both halves, `pg:` the source stated it, `guess:` worked
       out from language and length. A guess is drawn as a guess. */
    var st = textAudio(c);
    var mk = el("span", "sf-ta ta-" + st.kind);
    mk.textContent = st.word;
    mk.title = st.why;
    s.appendChild(mk);

    /* ITEM 4, and the rule is Osca's: *"Don't drop data because it's long."*
       The facts go on their own line under the row, wrapping, rather than
       being squeezed into the one that already truncates. */
    var facts = candFacts(c);
    if (facts.length) {
      var f = el("span", "sf-facts");
      facts.forEach(function (t) { f.appendChild(el("i", null, esc(t))); });
      r.querySelector(".body").appendChild(f);
    }
    var pv = previewOf(c);
    if (pv) {
      var p = el("span", "sf-preview");
      p.textContent = pv;
      r.querySelector(".body").appendChild(p);
    }

    var end = r.querySelector(".end");
    /* ITEM 7: AUDITION IT WITHOUT TAKING IT. `POST /peek` resolves a
       streamable/readable url without fetching a byte to disk (its own
       docstring: "no SSD write, no fetch.py cache entry, no parser"). It
       answers for archive, librivox, youtube and any `direct_download`
       candidate; a Gutenberg catalogue row it refuses in as many words --
       pressed live, 8 Sep: HTTP 500 in 0.02 s, "no preview available yet for
       source='gutenberg'". So the button is drawn only where the route can
       actually answer, and the refusal is never dressed as a player. */
    if (canPeek(c)) end.appendChild(rowBtn(st.kind === "text" ? "read" : "play",
      "hear it or read it without adding it — /peek, no download",
      function (b) { peek(c, r0, b); }));
    var verb = el("button", "sf-verb");
    verb.type = "button"; verb.textContent = "Add";
    verb.addEventListener("click", function (e) { e.stopPropagation(); add(r0, verb); });
    r.querySelector(".end").appendChild(verb);
    /* §5.8: THIS IS THE ROW OSCA MEANT. *"Right now hovering a book on the
       left does nothing -- only ADD is a target."* True: this row had no
       click handler at all, so four fifths of it was dead space above a
       button. It selects now, like every other row, and what it selects is a
       CANDIDATE -- which has no slug and no chapters, so THE WORKS answers
       with what it does have: its metadata, and the verbs that can act on it. */
    r.addEventListener("click", function () { selectCandidate(r, r0); });
    return r;
  }

  /* ------------------------------------------- THE ONE WORKING LIST (item 1)
     Osca, Round 2: *"Running/queued jobs and their controls live ONLY in the
     left WORKING list."* The duplicate was one line -- `jobCard(running,
     working[0])` in `drawWorks` -- and it was wrong twice over: it drew the
     running job a SECOND time, and `working[0]` meant it could only ever draw
     ONE book however many were running.

     So everything the machine is doing or is about to do folds into one
     ordered list, in studio's own order: what is RUNNING first, then what is
     queued as studio will take it (an import has the free slot ahead of a
     push -- `/state`'s own note on `ingests`), then re-parses, then pending
     render rows.

     Every row carries the same four things whatever kind it is: the BOOK, the
     STEP (`step N of 8 · phase`), PROGRESS, and its own controls. A queued row
     has no step yet and says so rather than inventing one.

     `S.work` stays what it was -- the rows this surface started and tracks
     through `/state` -- and the queue fields fold in beside them. A book in
     both is ONE row: `taken()` is `pollWorks`'s own twin rule applied a level
     up, so an import this surface started never appears again as a queue
     entry. */
  /* WHAT LANE A `/state` JOB IS IN, and what to call it. Pure, and the only
     place this surface turns a job's `mode` into words -- so the row, the log
     title and any test read one table rather than three guesses.

     Three modes are not about one book: a `voice` clone is about a VOICE, a
     `pair` is about TWO books at once, and a `realign` is about a book's
     audio rather than its text. The other seven (single, queue, sample,
     install, language, reparse, ingest) are either a render of one book or
     are already carried by their own list, and they keep the lane they had.
     An unknown mode is a render: a mode studio adds tomorrow must not make a
     running job vanish from the works, which is what a whitelist would do. */
  function jobLane(job) {
    if (!job) return "render";
    if (job.mode === "voice") return "voice";
    if (job.mode === "pair") return "pair";
    if (job.mode === "realign") return "re-align";
    if (job.mode === "reparse") return "re-parse";
    if (job.mode === "ingest") return "import";
    return "render";
  }
  /* ...and its name, for the modes that have one of their own. Null means
     "no name but the book's", and the caller then falls back to the book
     title exactly as it always did. */
  function jobName(job) {
    if (!job) return null;
    if (job.mode === "voice" && job.name)
      return (job.again ? "Re-importing " : "Importing ") + job.name;
    if (job.mode === "pair" && job.left && job.right)
      return job.left + " \u2194 " + job.right;
    if (job.mode === "realign" && job.slug)
      return "Re-aligning " + (bookTitle(job.slug) || job.slug);
    return null;
  }
  function workingRows() {
    var out = [], seen = {};
    function mark(w) {
      [w.key, w.slug, w.source, w.title && norm(w.title)].forEach(function (k) {
        if (k) seen[String(k)] = 1;
      });
    }
    function taken(it) {
      return [it.slug, it.source, it.name && norm(it.name)].some(function (k) {
        return k && seen[String(k)];
      });
    }
    Object.keys(S.work).forEach(function (k) {
      var w = S.work[k];
      out.push({ kind: "run", w: w, key: w.key, slug: w.slug, title: w.title,
                 author: w.author, hue: w.hue, cells: w.cells, p: w.p,
                 word: w.word, step: runningStep(w.cells), source: w.source,
                 lane: "import" });
      mark(w);
    });
    (S.reparsing || []).forEach(function (it) {
      if (taken(it)) return;
      var key = "rp:" + (it.slug || it.chapter || "x");
      out.push({ kind: "run", key: key, slug: it.slug,
                 title: it.name || it.chapter || it.slug || "re-parse",
                 hue: hueFor(it.slug || key), cells: {}, p: 0,
                 word: it.queue_word || "re-parsing", step: it.step,
                 elapsed: it.elapsed, job: it, lane: "re-parse" });
      mark({ key: key, slug: it.slug, title: it.name });
    });
    /* THE ONE JOB IS OFTEN A ROW WE ALREADY HAVE. `JobManager.snapshot()`
       returns the running lane job when there is one, so an import that is
       already in `S.work` comes back here as `job` too -- with `mode:
       "ingest"` and the same `source`. Matching on every name it could be
       known by (slug, source, name, chapter) is what stops one import being
       drawn as two rows, which is `pollWorks`'s own twin rule and the reason
       `taken()` exists. */
    if (S.job && !taken({ slug: S.job.slug, source: S.job.source,
                          name: S.job.name || S.job.chapter })) {
      var jk = "job:" + (S.job.slug || "") + ":" + (S.job.chapter || S.job.current_chapter || "");
      /* NOT EVERY JOB IS A RENDER, and this row said every one was. `/state`'s
         job carries a `mode` (`studio/serve.py`: single · queue · voice ·
         sample · install · language · reparse · realign · pair · ingest) and
         this branch read none of it -- so a voice clone, a pairing and a
         re-align each drew the row "a render", in the render lane, with no
         name of their own, because `bookTitle(null)` is null and the literal
         under it is the last `||`. The three that are NOT about one book get
         their own name and lane here; everything else is a render and keeps
         the line it always had. `jobLane` is the whole of the difference and
         it is pure, so the bench and a test can read it without a page. */
      var jn = jobName(S.job);
      out.push({ kind: "run", key: jk, slug: S.job.slug,
                 title: jn || bookTitle(S.job.slug) || S.job.slug || "a render",
                 hue: hueFor(S.job.slug || S.job.name || jk), cells: {}, p: 0,
                 word: S.job.queue_word || "running",
                 step: S.job.step || S.job.current_step,
                 unit: S.job.chapter || S.job.current_chapter,
                 where: S.job.where, elapsed: S.job.elapsed, job: S.job,
                 lane: jobLane(S.job) });
    }
    (S.ingests || []).forEach(function (it) {
      if (taken(it)) return;
      out.push({ kind: "queued", key: "iq:" + it.id, id: it.id, qkind: "ingest",
                 slug: it.slug, title: it.name || it.source, source: it.source,
                 hue: hueFor(it.slug || it.source || ("iq:" + it.id)),
                 lane: "import" });
    });
    (S.reparses || []).forEach(function (it) {
      if (taken(it)) return;
      out.push({ kind: "queued", key: "rq:" + it.id, id: it.id, qkind: "reparse",
                 slug: it.slug, title: it.name || it.slug,
                 hue: hueFor(it.slug || ("rq:" + it.id)), lane: "re-parse" });
    });
    [].concat.apply([], (S.pending || []).map(function (b) { return b.items || []; }))
      .forEach(function (it) {
        out.push({ kind: "queued", key: "pq:" + it.id, id: it.id, qkind: "pending",
                   slug: it.slug, title: bookTitle(it.slug) || it.slug || it.unit,
                   unit: it.unit || it.chapter, voice: it.voice,
                   hue: hueFor(it.slug || ("pq:" + it.id)), lane: "render" });
      });
    return out;
  }
  function bookTitle(slug) {
    var t = null;
    (S.shelf || []).forEach(function (b) { if (b.slug === slug) t = b.title; });
    return t;
  }
  /* which of the eight is going, read off the cells and never guessed */
  function runningStep(cells) {
    for (var i = 0; i < STEPS.length; i++)
      if ((cells || {})[STEPS[i]] === "running") return STEPS[i];
    return null;
  }
  /* `step N of 8 · phase` -- the line item 1 asks for by name */
  function stepLine(row) {
    if (row.kind === "queued")
      return row.lane === "render"
        ? "queued · " + (row.unit || "the book") + (row.voice ? " · " + row.voice : "")
        : "queued · " + row.lane;
    var i = STEPS.indexOf(row.step);
    var n = i >= 0 ? "step " + (i + 1) + " of " + STEPS.length + " · " + row.step
                   : (row.word || "running");
    if (row.unit) n += " · " + row.unit;
    if (row.where) n += " · " + row.where;
    return n;
  }

  /* ============================================ ITEM 7 · AUDITION IT IN HERE
     Osca: *"A play/sample affordance to audition a result/voice within the
     panel."* `POST /peek` is exactly the route for it and it already exists:
     it resolves WHERE the thing is on the source's own server and never
     fetches a byte to ours ("a read only or listen only view of it AS IT
     STANDS, before any parsing or ingestion" -- Osca, 3 Sep, in that route's
     own docstring). So auditioning costs one metadata round trip and writes
     nothing to the depot.

     THREE ANSWERS, and each gets its own honest landing:
       resolved + a url    an <audio> in the panel, or the text opened beside you
       resolved + text     youtube's captions, which /peek echoes for free
       choose              several files -- the picker this surface already has
                           (`choosePane`), because a scan with nine files is a
                           choice and not a failure
     A refusal is printed as the route's own sentence; it is never dressed up
     as a player that will not start.

     ONE CLIP AT A TIME, and only from a click: the reference player's rule
     (`REF_PLAY` is written in exactly two places and both are a gesture).
     Starting a result silences the voice clip and the other way round, so the
     panel can never be two sounds at once. */
  var PEEK_AUDIO = null;
  function silencePeek() {
    if (PEEK_AUDIO) { try { PEEK_AUDIO.pause(); } catch (e) {} }
    PEEK_AUDIO = null;
  }
  function peek(c, r0, btn) {
    silenceRef();
    /* pressing it again stops it -- the same toggle the voice pill has */
    if (S.peek && S.peek.key === r0.key) { silencePeek(); S.peek = null; draw(); return; }
    silencePeek();
    S.peek = { key: r0.key, title: c.title, kind: c.kind || "text", loading: true };
    S.cand = r0;                     /* the panel follows what you auditioned */
    draw();
    if (S.bench) {
      /* THE BENCH AUDITIONS TOO (item 9). There is no route to ask, so the
         mock answers in `/peek`'s own `{status, kind, url|text}` shape and
         says it is the mock. A silent, empty player would have made this
         state unjudgeable, which is the thing the bench is for. */
      S.peek = { key: r0.key, title: c.title, kind: c.kind || "text", mock: true,
                 text: previewOf(c, true) || "the mock has no text for this row.",
                 url: null };
      draw();
      return;
    }
    postJSON("/peek", { candidate: c })
      .then(function (j) {
        if (!S.peek || S.peek.key !== r0.key) return;
        if (!j || j.error) {
          S.peek.loading = false;
          S.peek.err = "/peek — " + ((j && j.error) || "no answer");
          draw(); return;
        }
        if (j.status === "choose") {
          /* the same picker Add uses; a choose is a choice, not a failure */
          S.peek = null;
          S.choose = { r0: r0, cand: c, files: j.files || [], forPeek: true };
          draw(); return;
        }
        S.peek.loading = false;
        S.peek.url = j.url || null;
        S.peek.text = j.text || "";
        S.peek.name = j.name || "";
        S.peek.kind = j.kind || S.peek.kind;
        draw();
      })
      .catch(function (e) {
        if (!S.peek || S.peek.key !== r0.key) return;
        S.peek.loading = false; S.peek.err = why("/peek", e); draw();
      });
  }
  /* the audition, drawn in THE WORKS beside whatever else that book has */
  function peekPane() {
    var p = S.peek;
    var box = el("div", "sf-peekpane");
    box.appendChild(head("Audition — " + (p.title || "")));
    if (p.mock) box.appendChild(note("the mock's own preview — /peek was not asked."));
    if (p.loading) { box.appendChild(note("asking /peek…")); return box; }
    if (p.err) { box.appendChild(note(p.err)); return box; }
    if (p.url && p.kind !== "text") {
      var slot = el("div", "sf-peekaudio");
      slot.id = "sfPeekSlot";
      box.appendChild(slot);
      box.appendChild(note("streamed from " + shortHost(p.url) + " — nothing was downloaded."));
    } else if (p.url) {
      box.appendChild(rowBtn("open the text", "opens it beside you, on the source's own server",
        function () { openOut(p.url); }));
      box.appendChild(note(shortHost(p.url)));
    }
    if (p.text) {
      var pre = el("pre", "sf-peektext");
      pre.textContent = String(p.text).slice(0, 4000);
      box.appendChild(pre);
    }
    if (!p.url && !p.text) box.appendChild(note("/peek answered, with nothing to show."));
    return box;
  }
  /* the same discipline `mountRefPlayer` has: put the one live <audio> back
     into the freshly-drawn panel inside this task, so the poll cannot restart
     it a second later */
  function mountPeekPlayer() {
    if (!S.peek || !S.peek.url || S.peek.kind === "text") return;
    var slot = worksEl && worksEl.querySelector("#sfPeekSlot");
    if (!slot) return;
    if (!PEEK_AUDIO || PEEK_AUDIO.dataset.url !== S.peek.url) {
      PEEK_AUDIO = document.createElement("audio");
      PEEK_AUDIO.dataset.url = S.peek.url;
      PEEK_AUDIO.controls = true;
      PEEK_AUDIO.preload = "none";
      PEEK_AUDIO.src = S.peek.url;
    }
    if (PEEK_AUDIO.parentNode !== slot) slot.appendChild(PEEK_AUDIO);
  }

  /* ------------------------------------- TEXT, AUDIO, OR BOTH (item 6)
     Replaces the bare "NO AUDIO". Three states and no fourth, read off the
     candidate and its partner:

       text+audio  the candidate is paired -- `linked_id` -- and the pairing
                   is STATED (`pg:` LibriVox's own url_text_source) or SELF
                   (`yt:` one video that is both halves). A `guess:` pairing
                   is still both, and says it is a guess.
       text-only   `kind === "text"` and nothing paired to it
       audio-only  anything else, unpaired

     `tools/search/pair.py` is the authority for every one of those prefixes
     and this file restates none of them. */
  function textAudio(c) {
    var id = c && c.linked_id ? String(c.linked_id) : "";
    var partner = id && S.pairs && S.pairs[id] && S.pairs[id].length > 1;
    if (id && (partner || id.indexOf("yt:") === 0)) {
      var guess = id.indexOf("guess:") === 0;
      return { kind: "both", word: guess ? "text + audio?" : "text + audio",
               why: guess
                 ? "paired by tools/search/pair.py from language and length — a suggestion, not a fact"
                 : (id.indexOf("yt:") === 0
                     ? "one item that is both halves: the video and its own captions"
                     : "the source itself named the text this recording was read from") };
    }
    if (!c || !c.kind || c.kind === "text")
      return { kind: "text", word: "text only",
               why: "no recording came back paired with this one" };
    return { kind: "audio", word: "audio only",
             why: "a recording; there is no text paired with it, so it cannot be parsed — attach it to a book you have" };
  }

  /* ITEM 4: LENGTH, SIZE, AND WHAT ELSE THE SOURCE SAID -- all of it already
     in the candidate, none of it fetched. Order is fixed so a column of rows
     reads down: how long, how big, how popular, what licence. */
  function candFacts(c) {
    var out = [];
    if (c.chapters) out.push(c.chapters + (c.chapters === 1 ? " part" : " parts"));
    if (c.word_count) out.push(words(c.word_count) + " words");
    if (c.duration_s) out.push(mmss(c.duration_s));
    if (c.size_bytes) out.push(bytes(c.size_bytes));
    if (c.format) out.push(String(c.format).toLowerCase());
    if (c.popularity) out.push(words(c.popularity) + " downloads");
    /* the licence as the SOURCE stated it, with its jurisdiction -- "clear"
       on its own is not a fact (candidate.py's own note: Camus is public
       domain in Canada and will not be in the UK until 2031) */
    if (c.license_status && c.license_status !== "needs-check")
      out.push(c.license_status + (c.license_jurisdiction ? " in " + c.license_jurisdiction : ""));
    return out;
  }
  function words(n) {
    n = +n || 0;
    return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
         : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k"
         : String(n);
  }
  /* the preview, and it is the source's own sentence -- `note` is what the
     adapter wrote about this row (gutenberg's "from Project Gutenberg's own
     catalogue (offline)"), `transcript` is a caption track youtube already
     pulled. Trimmed for the row, never dropped: the whole of it is in the
     card the row opens. */
  function previewOf(c, full) {
    var t = c.transcript || c.note || "";
    t = String(t).replace(/\s+/g, " ").trim();
    if (!t) return "";
    return full || t.length <= 150 ? t : t.slice(0, 150).replace(/\s\S*$/, "") + "…";
  }
  /* `POST /peek` answers for these and refuses everything else in its own
     words (`tools/search/serve.py::route_peek`) -- so the button is only
     drawn where the route can act. */
  function canPeek(c) {
    return !!(c && (c.direct_download || c.source === "archive" ||
                    c.source === "librivox" || c.source === "youtube"));
  }

  /* --- WORKING: the spine fills, the ribbon says which step --------------- */
  function workRow(row) {
    var w = row.w || row;
    var r = rowShell("r-work" + (row.kind === "queued" ? " r-queued" : ""), row.key);
    var h = row.hue || w.hue;
    var p = +(row.p != null ? row.p : (w.p || 0));
    r.style.setProperty("--hue", h);
    r.style.setProperty("--p", p.toFixed(3));
    r.querySelector(".spine").style.background = h;
    r.querySelector(".t").textContent = row.title || "(no title)";
    /* THE STEP LINE ITEM 1 ASKS FOR, in place of "author · word": what the
       machine is doing to THIS book, said the way studio says it. */
    r.querySelector(".s").textContent = stepLine(row);
    /* G-SURF2: WHAT IT WAS SAVED AS, from the moment staging answers, and --
       when the import failed -- studio's own sentence, whole, where the
       step line would only have cut it off */
    var wp = workProv({ source: w.source || row.source, origin: w.origin });
    if (wp) r.querySelector(".body").appendChild(wp);
    if (w.err) { var we = el("span", "sf-prov err"); we.textContent = w.err;
                 r.querySelector(".body").appendChild(we); }
    var end = r.querySelector(".end");
    if (row.elapsed) end.appendChild(el("span", "cnt", esc(row.elapsed)));
    if (row.kind !== "queued") end.appendChild(ribbon(w.cells || row.cells || {}));

    /* ITS OWN CONTROLS, ON THE ROW (item 1). They were on a card in the right
       column that could only ever describe ONE of these rows. `Stop` is
       `POST /stop`, and studio takes one job at a time -- so the button says
       it stops the job in studio's slot rather than pretending to be per-row.
       A queued row's control is the bin `POST /queue-row` can actually use;
       a re-parse gets none, because that route has no shape for one. */
    var acts = el("span", "sf-rowacts");
    if (row.kind === "queued" && typeof row.id === "number") {
      if (S.live && row.qkind !== "reparse")
        acts.appendChild(rowBtn("×", "take it out of the queue", function (b) {
          act("/queue-row", row.qkind === "ingest" ? { ingest: row.id, action: "remove" }
                                                   : { id: row.id, action: "remove" }, b, "…");
        }, "qx"));
      else if (S.bench)
        acts.appendChild(rowBtn("×", "the bench's own bin, same effect", function () {
          S.pending = (S.pending || []).map(function (b2) {
            return { items: (b2.items || []).filter(function (i2) { return i2.id !== row.id; }) };
          }).filter(function (b2) { return b2.items.length; });
          S.ingests = (S.ingests || []).filter(function (i2) { return i2.id !== row.id; });
          S.reparses = (S.reparses || []).filter(function (i2) { return i2.id !== row.id; });
          draw();
        }, "qx"));
    }
    if (row.kind === "run" && w.failed) {
      acts.appendChild(rowBtn("×", "it did not come in — take the row away", function () {
        delete S.work[w.key]; draw();
      }, "qx"));
    } else if (row.kind === "run") {
      if (S.live)
        acts.appendChild(rowBtn("stop", "stop the job in studio's one slot",
          function (b) { act("/stop", {}, b, "…"); }));
      /* ITEM 2: THIS ROW'S LOG, UNDER THIS ROW. `GET /log` is told which one
         by the row's own identity (`logQueryFor`), so two running books show
         two different logs and neither of them is "the" log. */
      var q = logQueryFor(row);
      if (q) {
        var open = !!(S.logs[row.key] && S.logs[row.key].open);
        acts.appendChild(rowBtn(open ? "hide log" : "log", "this book's own log",
          function () {
            if (open) { S.logs[row.key].open = false; draw(); return; }
            openLog(row.key, q, row.title);
          }));
      }
    }
    if (acts.children.length) end.appendChild(acts);

    r.appendChild(el("span", "under"));
    r.addEventListener("click", function () {
      if (row.slug) { selectSlug(row.slug); return; }
      select(r, w);
    });
    return r;
  }
  function rowBtn(text, title, fn, cls) {
    var b = el("button", cls || "sf-verb ghost");
    b.type = "button"; b.textContent = text; b.title = title;
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(b); });
    return b;
  }

  /* THE RIBBON. Eight cells in STEPS order, or the coarse three, which are a
     FOLD of the same eight and never a second list. */
  /* `ch` is optional and is the chapter the cells came from, when there is
     one: a ribbon that drew `align` as OK beside a row whose button said
     "align" would be two answers to one question, so `needsAlign` is asked
     here too and that one cell falls back to unfinished. */
  function ribbon(cells, ch) {
    var box = el("span", "sf-steps");
    var groups = CFG.coarse ? COARSE : STEPS.map(function (s) { return [s]; });
    var noTime = needsAlign(ch);
    groups.forEach(function (g) {
      var marks = g.map(function (s) {
        return (noTime && s === "align") ? "-" : (cells[s] || "-");
      });
      var v = marks.indexOf("failed") >= 0 ? "bad"
            : marks.indexOf("running") >= 0 ? "run"
            : marks.every(function (m) { return m === "ok"; }) ? "ok" : "";
      box.appendChild(el("i", v));
    });
    return box;
  }

  /* ----------------------------------------------------------- the second
     question about a row: not "open it" but "what has been done to it". The
     answer is the book's own chapter rows, so selecting one ASKS FOR THEM
     (GET /book?slug=) and the grid draws what came back. */
  function select(rowEl, subject) {
    Array.prototype.forEach.call(listEl.querySelectorAll(".sf-row.sel"),
      function (n) { n.classList.remove("sel"); });
    rowEl.classList.add("sel");
    S.sel = subject;
    S.selAuto = false;      /* a click outranks the page underneath */
    S.cand = null;          /* a book and a candidate are not both selected */
    if (!subject || S.unitSlug !== subject.slug) { S.unit = null; S.unitSlug = null; }
    if (S.live && subject && subject.slug) loadBook(subject.slug);
    if (S.live) { askEngines(false); askKaggle(false); }
    drawWorks();
  }

  /* ============================================ A RESULT THAT IS NOT A BOOK YET
     §5.8. Selecting a candidate cannot fill the step grid -- there are no
     steps, because there is no book: nothing has been fetched, parsed or
     given a slug. What it CAN do is answer the question the click asked,
     which is *what is this*. So THE WORKS draws the candidate's own metadata,
     out of the candidate itself and nothing derived: what `tools/search`'s
     `Candidate` dataclass actually carries. And the verbs that can act on it
     go with it, so the answer and the action are in one place. */
  function selectCandidate(rowEl, r0) {
    Array.prototype.forEach.call(listEl.querySelectorAll(".sf-row.sel"),
      function (n) { n.classList.remove("sel"); });
    rowEl.classList.add("sel");
    S.cand = r0;
    drawWorks();
    return r0;
  }

  function candPane() {
    var r0 = S.cand, c = r0.cand || {};
    var box = el("div", "sf-cand");
    box.appendChild(head(c.kind === "text" ? "This result" : "This recording"));
    box.appendChild(el("div", "ct", esc(c.title || "untitled")));
    /* EVERY LINE IS A FIELD THE CANDIDATE ACTUALLY HAS. A field it does not
       carry is not drawn -- never "unknown", never an empty row, because a
       blank labelled `Licence` reads as "no licence" and that is a different
       fact from "the adapter did not say". */
    /* ITEM 4, AND TWO OF THESE NEVER RENDERED. `Words` read `c.words` and
       `Language` read `c.lang`; the candidate's fields are `word_count` and
       `language` (`tools/search/candidate.py`), so both rows were silently
       absent on every candidate ever drawn -- which looks exactly like a
       source that did not state them. Read the real names, and add the four
       more the candidate carries and this pane was dropping: how many parts,
       how big, how many people have taken it, and what the source said about
       the licence AND where that holds. */
    var ta = textAudio(c);
    var rows = [
      ["Author", c.author],
      ["Source", SOURCE[c.source] || c.source],
      ["Has", ta.word],
      ["Parts", c.chapters ? String(c.chapters) : null],
      ["Length", c.duration_s ? mmss(c.duration_s) : null],
      ["Words", c.word_count ? words(c.word_count) : null],
      ["Size", c.size_bytes ? bytes(c.size_bytes) : null],
      ["Format", c.format],
      ["Downloads", c.popularity ? words(c.popularity) : null],
      ["Language", c.language || c.lang],
      ["Licence", c.license || c.licence],
      ["Holds in", c.license_jurisdiction],
      ["Id", c.source_id],
      ["Direct download", c.direct_download ? "yes" : null],
      ["Where", shortHost(c.url)]
    ];
    var dl = el("div", "sf-fields");
    rows.forEach(function (kv) {
      if (kv[1] == null || kv[1] === "") return;
      dl.appendChild(el("span", "k", esc(kv[0])));
      dl.appendChild(el("span", "v", esc(String(kv[1]))));
    });
    box.appendChild(dl);
    /* ITEM 4: *"Don't drop data because it's long."* The ROW trims the
       preview to fit one line; this pane is where the whole of it goes --
       the adapter's own note, or the caption track youtube already pulled. */
    var full = previewOf(c, true);
    if (full) {
      var pv = el("pre", "sf-candtext");
      pv.textContent = full.length > 4000 ? full.slice(0, 4000) + "…" : full;
      box.appendChild(pv);
    }
    if (c.linked_id) {
      var lk = el("div", "sf-pair");
      lk.textContent = textAudio(c).why;
      box.appendChild(lk);
    }
    if (c.url) {
      var u = el("div", "sf-url");
      u.textContent = c.url;
      u.title = c.url;
      box.appendChild(u);
    }
    var acts = el("div", "sf-acts");
    if (c.kind === "text") {
      var a = el("button", "sf-verb");
      a.type = "button"; a.textContent = "Add";
      a.title = "stage it, then parse it -- POST /stage_for_ingest then POST /ingest";
      a.addEventListener("click", function () { add(r0, a); });
      acts.appendChild(a);
    }
    if (c.url) {
      var o = el("button", "sf-verb ghost");
      o.type = "button"; o.textContent = c.kind === "text" ? "Open" : "Play";
      o.addEventListener("click", function () { openOut(c.url); });
      acts.appendChild(o);
      if (/^https?:/.test(c.url)) {
        var uv = el("button", "sf-verb ghost");
        uv.type = "button"; uv.textContent = "Use as voice";
        uv.title = "clone a reference voice from this recording";
        uv.addEventListener("click", function () { cloneVoiceFrom(c, uv); });
        acts.appendChild(uv);
      }
    }
    var to = subject();
    if (to && S.live && c.kind !== "text") {
      var at = el("button", "sf-verb ghost");
      at.type = "button";
      at.textContent = S.attached[attachKey(c, to)] || ("Attach to " + (to.title || to.slug));
      at.addEventListener("click", function () { attach(c, to, at); });
      acts.appendChild(at);
    }
    box.appendChild(acts);
    return box;
  }

  /* ============================================================ ADDING ONE
     "Add to Library" is the Library's own Parse, the same two routes in the
     same order (library/library.html::parseSearchResult -> ingest). What is
     NEW is only where the answer lands: the row becomes the working row,
     here, rather than a sentence on a button in a window you then close. */
  /* THROUGH `api()`, LIKE EVERY OTHER FETCH IN THIS FILE (8 Sep addendum).
     It posted to a RELATIVE path, which is right on studio's own origin and
     silently wrong the moment `?api=` points anywhere else -- the one thing
     §2.1 exists to make possible. Same call on studio, an honest one off it. */
  /* THE ONE POST. Resolves with what studio said -- `{error}` when it
     refused, whatever it sent when it did not -- and rejects only when
     studio did not answer at all, which `why()` turns into words. `act()`
     is this plus the button and the column's own bookkeeping. */
  function postJSON(path, body) {
    var url = api(path);
    if (!url) return Promise.resolve({ error: path + " — no studio behind this page" });
    return ask_(url, 30000, { method: "POST", cache: "no-store",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(body) })
      .then(function (r) { return jsonOf(r, path, false); });
  }
  function beginWork(key, c) {
    /* ENQUEUE IS WHERE THE COLOUR IS ASSIGNED (Round 2 item 3), and it is the
       row's own key -- the candidate's url, or the import's slug. From here
       every other name this book answers to is aliased to this one. */
    var w = { key: key, title: c.title, author: c.author, hue: hueFor(key),
              cells: {}, p: 0, word: "Fetching", slug: null,
              /* what was already on the shelf when this began -- a book in
                 here can never be the one this row becomes (`landedBook`) */
              before: (S.shelf || []).map(function (b) { return b.slug; }) };
    STEPS.forEach(function (s) { w.cells[s] = "-"; });
    S.work[key] = w;
    return w;
  }
  function add(r0, verb, pick) {
    if (verb && verb.disabled) return;
    var c = r0.cand;
    if (c.kind && c.kind !== "text") {
      if (verb) { verb.textContent = "A recording — use Attach"; verb.disabled = true; }
      return;
    }
    var w = S.work[r0.key] || beginWork(r0.key, c);
    /* where it came from, held on the row from the first press -- the working
       row says it at once, and `/ingest` is handed the whole candidate so
       studio can record it on the book (G-SURF2 + G-SLUG) */
    w.origin = { source: c.source, id: c.source_id || null, url: c.url || null };
    w.failed = false; w.err = "";
    S.choose = null;
    draw();
    if (S.bench) return simulate(w);          /* the bench: watch it arrive */
    /* A MULTI-FILE CANDIDATE IS ANSWERED HERE NOW, not sent somewhere else
       (8 Sep addendum). `stage_for_ingest` takes `file_url`/`file_name` for
       exactly this second call -- `_resolve_ia_files`' own "Osca already
       picked one file from a prior choose" branch -- so the picker belongs on
       this surface. It said *"several files — use the Library's search"*,
       which is a surface you then have to go to, and the whole point of this
       one is that you do not. */
    var body = { candidate: c };
    if (pick) { body.file_url = pick.url; body.file_name = pick.name; }
    postJSON("/stage_for_ingest", body)
      .then(function (st) {
        if (st.error) throw new Error(st.error);
        if (st.status === "choose") {
          /* NOT AN ERROR AND NOT A DEAD END: the archive item has more than
             one file and only a person can say which. The list is the
             server's own `files` -- name, url, size -- drawn in the works
             column, and pressing one calls this function again with it. */
          S.choose = { key: r0.key, r0: r0, title: c.title,
                       identifier: st.identifier || "",
                       files: (st.files || []).slice(0, 40) };
          w.word = "Which file?"; w.cells.parse = "-"; w.p = 0;
          draw();
          return null;
        }
        if (st.status !== "staged" || !st.source) throw new Error("staging answered " + (st.status || "nothing"));
        /* THE SOURCE IS THE ROW'S NAME FROM HERE ON. Without it `/state`'s
           `importing` is a second identity for the same book and the list
           grows a twin -- measured, 7 Sep: one Add, two working rows. */
        w.source = st.source;
        holdAs(w.key, st.source);   /* item 3: the staged name is the same book */
        w.word = "Parsing"; w.cells.parse = "running"; w.p = 0.06; draw();
        /* THE CANDIDATE RIDES WITH IT (G-SLUG): studio records where the
           book came from on the book, and a second edition of a title you
           already have gets a slug of its own from the candidate's id */
        return postJSON("/ingest", { source: st.source, candidate: c });
      })
      .then(function (ing) {
        if (ing === null) return;              /* a `choose` is waiting on a person */
        if (ing && ing.error) throw new Error(ing.error);
        pollWorks();
      })
      .catch(function (e) {
        w.word = "Couldn't add";
        w.err = String(e && e.message || e);
        w.failed = true;
        w.cells.parse = "failed"; draw();
      });
  }

  /* THE FILE PICKER, IN THE WORKS COLUMN. `stage_for_ingest` answered
     `{status:"choose", identifier, files:[{name, url, size}]}` -- IA's own
     metadata, forwarded whole -- and this draws it. Pressing a row is the
     SECOND `stage_for_ingest`, with `file_url`/`file_name`, which is the
     shape that route was built to take. */
  function choosePane() {
    var ch = S.choose;
    var box = el("div", "sf-choose");
    box.appendChild(head("Which file — " + (ch.title || ch.identifier
                          || (ch.cand && ch.cand.title) || "")));
    /* THE SAME PICKER, TWO ERRANDS (item 7). `/peek` and `/stage_for_ingest`
       both answer `choose` from the SAME `_resolve_ia_files` -- an archive
       item with nine files is a choice either way -- so the picker is one
       list and only the verb at the end of the row differs. Sending a peek's
       choose somewhere else would have been a second picker for one question. */
    box.appendChild(note(ch.files.length + " files in this item; "
      + (ch.forPeek ? "auditioning reads one. Pick it and it plays from the source's own server."
                    : "the parser reads one. Pick the text and it is staged and parsed.")));
    ch.files.forEach(function (f) {
      var row = el("div", "sf-q pick");
      row.appendChild(el("span", "qn", esc(f.name)));
      row.appendChild(el("span", "qv", "· " + esc(bytes(f.size))));
      row.addEventListener("click", function () {
        if (ch.forPeek) {
          S.choose = null;
          S.peek = { key: ch.r0.key, title: (ch.cand && ch.cand.title) || f.name,
                     kind: /\.(mp3|ogg|m4a|wav|flac|opus)$/i.test(f.name) ? "audio" : "text",
                     url: f.url || f.href || null, name: f.name, loading: false };
          draw();
          return;
        }
        add(ch.r0, null, f);
      });
      box.appendChild(row);
    });
    var acts = el("div", "sf-acts");
    var x = el("button", "sf-verb ghost");
    x.type = "button"; x.textContent = "Not this one";
    x.addEventListener("click", function () {
      delete S.work[ch.key]; S.choose = null; draw();
    });
    acts.appendChild(x);
    box.appendChild(acts);
    return box;
  }
  /* IA's `size` is a string of bytes, and it is absent on some rows. Said in
     the units a person reads, or not said at all -- never "undefined". */
  function bytes(n) {
    var v = Number(n);
    if (!isFinite(v) || v <= 0) return "size unknown";
    if (v >= 1e6) return (v / 1e6).toFixed(1) + " MB";
    if (v >= 1e3) return Math.round(v / 1e3) + " kB";
    return v + " B";
  }

  /* THE BENCH'S OWN INGEST. With no server there is nothing to press, and
     what Osca has to look at is exactly the thing a still page cannot show:
     a row arriving. So the bench advances the eight cells on a timer. It is
     a MOCK and it says so in the row's own line. */
  function simulate(w) {
    var i = 0;
    w.word = "Fetching (mock)";
    (function step() {
      if (!S.work[w.key]) return;
      if (i > 0) w.cells[STEPS[i - 1]] = "ok";
      if (i < STEPS.length) {
        w.cells[STEPS[i]] = "running";
        w.word = STEPS[i] + " (mock)";
        w.p = (i + 0.5) / STEPS.length;
        i++; draw();
        setTimeout(step, 900);
      } else {
        /* it joins the library, and the row it came from is the book */
        delete S.work[w.key];
        S.shelf.unshift(shelfOf({ slug: "mock-" + Date.now(), title: w.title,
                                  author: w.author, lang: "la", chapters_n: 12,
                                  parsed: 12, voiced: 0, has_audio: false }));
        draw();
      }
    })();
  }

  /* ============================================================ THE WORKS
     studio/studio.html's cockpit at this width: the running card, the one
     queue (imports first, because an import takes the free slot ahead of a
     push), and the step grid of whatever row is open. */
  function drawWorks() {
    if (!worksEl) return;
    worksEl.textContent = "";
    var working = Object.keys(S.work).map(function (k) { return S.work[k]; });
    var running = S.job || S.reparsing[0] || null;
    var busy = !!(running || S.pending.length || S.ingests.length ||
                  S.reparses.length || working.length);
    worksEl.classList.toggle("empty", !busy && !S.sel);

    worksEl.appendChild(head("The works"));
    /* THE MIRROR IS GONE (Round 2 item 1). `jobCard(running, working[0])`
       stood here: it drew the running job a SECOND time -- the left WORKING
       band already had it -- and `working[0]` meant it could only ever draw
       ONE of them however many were running, which is what made a multi-book
       queue illegible. Running and queued rows and their controls now live
       ONLY in that band, and this column is what Osca asked it to be: the
       studio controls for the SELECTED book, and that book's step grid.
       `Hold all` went with the card, onto the WORKING header, because it is
       about the machine and not about the selected book.

       WHAT REPLACES IT IS NOT A PLACEHOLDER. With nothing selected this column
       has genuinely nothing to say, and it says which of the two reasons it
       is -- no studio, a studio that would not answer, or nothing chosen. */
    if (!S.live) worksEl.appendChild(note(noStudioLine()));
    else if (S.stateErr) worksEl.appendChild(note(S.stateErr));
    else if (!S.sel && !S.cand && !S.choose)
      worksEl.appendChild(note(working.length
        ? "Choose a book — " + working.length + " in the WORKING list, and its controls are on its own row."
        : "Choose a book to set its voice, where it renders, and its model."));

    /* EVERY RENDER, ALL BOOKS -- the machine, above the book, and the one
       thing in this column that is not about what was clicked. `studio.html`
       had it as a modal panel (`panelQueue`); it is a state of this surface
       now, shut by default and asked for only when it is opened. */
    if (S.live) worksEl.appendChild(allBand());

    /* THE QUEUE MOVED LEFT (Round 2 item 1). Everything that stood here --
       the three halves of studio's queue, their bins, and the click that
       selected a book -- is `workingRows()` now, drawn as rows of the WORKING
       band beside the jobs that are running. It was the same information in a
       second, poorer shape: a name and a word, with no step, no progress and
       no log, in a column that also claimed to be about the SELECTED book. */

    /* THE FOUR CHOICES, above the steps -- studio.html's own order (voice,
       where, model, sample), and above the grid for its reason: they are what
       the steps will be run WITH. Only with a book in context; see the
       section head on `studioBlock`. */
    var st = studioBlock();
    if (st) {
      worksEl.appendChild(head("Studio"));
      /* §5.9: THE BENCH DRAWS IT TOO, and says which it is. A design surface
         that cannot show §4's four rows is not a bench -- and a bench that
         showed them without saying they were mocked would be worse. */
      if (S.bench) worksEl.appendChild(note("these four rows are the mock — "
        + "the fixtures the real studio code generated, so the shapes are studio's; "
        + "nothing is being asked and nothing is being written."));
      worksEl.appendChild(st);
    }

    /* WHAT WAS CLICKED, FIRST. A candidate has no steps and no studio, so
       its card is the whole of the answer and sits where the grid would. */
    if (S.cand) worksEl.appendChild(candPane());
    /* ITEM 7: the audition sits with the thing it is an audition OF */
    if (S.peek) worksEl.appendChild(peekPane());

    /* the file picker a `choose` is waiting on, above the steps: it is the
       thing blocking the book from having any */
    if (S.choose) worksEl.appendChild(choosePane());

    /* G-SURF2: a shelf book's provenance, whole, above its steps -- where
       it came from is the first thing to know about a book you did not add
       five minutes ago */
    if (S.sel && S.sel.slug && !S.sel.cells && "source" in S.sel)
      worksEl.appendChild(provPane(S.sel));
    if (S.sel) worksEl.appendChild(gridFor(S.sel));
    /* the log is no longer drawn here: it belongs under its own WORKING row
       (item 2), which `draw()` appends immediately after that row */
    /* IN THE SAME TASK AS THE CLEAR. `worksEl.textContent = ""` above detaches
       the one live reference <audio>; putting it back synchronously, before
       this task ends, is what stops the 4 s poll restarting the clip. */
    mountRefPlayer();
    mountPeekPlayer();     /* item 7, and for mountRefPlayer's exact reason */
  }

  /* selecting by slug, from anywhere -- the queue on the right, a test, the
     host. It picks the shelf row when there is one so the grid gets a title
     and a hue, and asks studio for the chapters either way. */
  function selectSlug(slug) {
    var b = null;
    S.shelf.forEach(function (x) { if (x.slug === slug) b = x; });
    S.sel = b || { slug: slug, title: slug };
    S.cand = null;
    if (listEl) {
      Array.prototype.forEach.call(listEl.querySelectorAll(".sf-row.sel"),
        function (n) { n.classList.remove("sel"); });
      var row = listEl.querySelector('.sf-row[data-key="b:' + slug + '"]');
      if (row) row.classList.add("sel");
    }
    /* THE BOOK'S OWN VOICE WINS ON SELECTION -- what `render.json` says is
       what go would use, so the pill starts there rather than on whatever the
       last book was set to. A book with none keeps the current pill. */
    if (S.sel && S.sel.voice) S.voice = S.sel.voice;
    /* a sample belongs to the book it was taken of */
    if (S.sample && S.sample.slug !== slug) S.sample = null;
    if (S.live) loadBook(slug);
    if (S.live) { askEngines(false); askKaggle(false); }
    drawWorks();
    return S.sel;
  }

  /* `jobCard` STOOD HERE, AND IT IS GONE (Round 2 item 1). It drew the
     running job in the right-hand column -- a second time, because the left
     WORKING band already had it -- and it took `working[0]`, so with three
     books going it described one of them and silently dropped the other two.
     Its four controls went where they belong: Stop and this-book's-log onto
     the WORKING row itself (`workRow`), `Hold all` onto the band's header
     (`workingHead`), because holding is about the machine and not about a
     book. Nothing it did is missing; all of it is per-row now. */


  /* WHICH LOG. `GET /log` serves SEVEN shapes -- `?remote=`, `?voice=`,
     `?ingest=`, `?pair=left--right`, `?reparse=`, `?realign=` and
     `?slug=&chapter=&step=` (`studio/serve.py::_serve_log`, and its own 400
     names all seven) -- and this file asked for THREE. The comment above
     this function said "its own four shapes" and was wrong twice over: the
     route had seven and the surface knew three of them.

     What that cost, and it is not a log button: `/state`'s job object has
     ten modes, and `voice`, `pair` and `realign` are three of them. A voice
     import running RIGHT NOW came through `workingRows`'s `S.job` branch,
     drew a row, and the row had no log -- because `logQueryFor` asks this
     function, this function answered null, and a row that cannot name a log
     draws no button for one (item 2's own rule: a control that cannot act is
     worse than no control). So the one place in the app where you watch a
     clone being made was the one place with nothing to read when it went red.

     `remote` is the seventh and it arrived with the queue: a GROUP carries
     its Kaggle queue name directly (`push.groups_all` -> `queue`), which is
     a shorter road than studio.html's (`jobQueue` looks the group up through
     `/state`'s push rows to reach `row.remote.queue`). It is asked FIRST
     here for studio.html's own reason -- *"the card decides which by whether
     this job has a kernel"* -- so one push's courier log beats the per-unit
     render log whenever there is one, and a group object and a job object go
     through the SAME function. Seven shapes, one place. */
  function logQuery(job) {
    if (!job) return null;
    /* A KAGGLE PUSH'S COURIER LOG: one file per push, not per unit, because
       one kernel serves them all (`studio/remote.py::log_path`). */
    if (job.remote || job.queue)
      return "?remote=" + encodeURIComponent(job.remote || job.queue);
    if (job.mode === "ingest" && (job.source || job.name))
      return "?ingest=" + encodeURIComponent(job.source || job.name);
    if (job.mode === "reparse" && job.slug)
      return "?reparse=" + encodeURIComponent(job.slug);
    /* A CLONE IN PROGRESS. `studio/serve.py:463` -- {mode:"voice", name, again} */
    if (job.mode === "voice" && job.name)
      return "?voice=" + encodeURIComponent(job.name);
    /* TWO BOOKS BEING PAIRED. `serve.py:813` -- {mode:"pair", left, right};
       the route splits on the first `--`, so both halves go in whole. */
    if (job.mode === "pair" && job.left && job.right)
      return "?pair=" + encodeURIComponent(job.left + "--" + job.right);
    /* A BOOK BEING RE-ALIGNED. `serve.py:769` -- {mode:"realign", slug}.
       Checked BEFORE the slug/chapter/step shape below, which a realign job
       would otherwise fall through to and fail: it carries a slug and no
       chapter, so that branch answers null and this one answers the truth. */
    if (job.mode === "realign" && job.slug)
      return "?realign=" + encodeURIComponent(job.slug);
    var ch = job.chapter || job.current_chapter, sp = job.step || job.current_step;
    if (job.slug && ch && sp)
      return "?slug=" + encodeURIComponent(job.slug)
           + "&chapter=" + encodeURIComponent(ch)
           + "&step=" + encodeURIComponent(sp);
    return null;
  }
  /* WHICH LOG, FOR A WORKING ROW (item 2). `logQuery` above answers for a
     `/state` job object; this answers for a row of the WORKING list, which
     may be an import this surface started (and therefore knows the `source`
     `/stage_for_ingest` gave it), a re-parse, or a render. `GET /log` refuses
     a request naming none of its four shapes with its own sentence, so this
     returns null rather than sending one it knows will 400 -- and the row
     then draws no log button, because a control that cannot act is worse than
     no control. */
  function logQueryFor(row) {
    if (!row) return null;
    if (row.job) { var q = logQuery(row.job); if (q) return q; }
    if (row.lane === "import" && (row.source || row.title))
      return "?ingest=" + encodeURIComponent(row.source || row.title);
    if (row.lane === "re-parse" && row.slug)
      return "?reparse=" + encodeURIComponent(row.slug);
    if (row.slug && row.unit && row.step)
      return "?slug=" + encodeURIComponent(row.slug)
           + "&chapter=" + encodeURIComponent(row.unit)
           + "&step=" + encodeURIComponent(row.step);
    return null;
  }
  /* ONE LOG PER ROW, KEYED BY THE ROW (item 2). It was one `S.log` for the
     whole surface, hung off a card that could only describe one book -- so a
     second running book had no log at all. `S.logs` is a map and several can
     be open at once, each under its own row. */
  function openLog(key, q, title) {
    S.logs[key] = { key: key, q: q, title: title, text: "", err: "", open: true };
    draw();
    var url = api("/log" + q);
    if (!url) {
      /* THE BENCH HAS A LOG TOO (item 9): it is not live, so there is nothing
         to ask -- but the pane is a state the design has to be judgeable in,
         so the mock answers with lines shaped like the real ones and says so. */
      var lg = S.logs[key];
      lg.text = MOCK_LOG.join("\n");
      lg.err = "";
      lg.mock = true;
      draw();
      return;
    }
    ask_(url, 20000, { cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var lg = S.logs[key];
        if (!lg || lg.q !== q) return;
        var j = null;
        try { j = JSON.parse(t); } catch (e) {}
        lg.text = (j && (j.text || j.log)) != null ? (j.text || j.log) : t;
        if (j && j.error) { lg.err = String(j.error); lg.text = ""; }
        draw();
      })
      .catch(function (e) {
        var lg = S.logs[key];
        if (!lg || lg.q !== q) return;
        lg.err = why("/log", e); draw();
      });
  }
  function logPane(lg) {
    var box = el("div", "sf-log");
    box.appendChild(head("Log — " + (lg.title || "")));
    if (lg.mock) box.appendChild(note("mock lines — nothing was asked."));
    if (lg.err) { box.appendChild(note(lg.err)); return box; }
    var pre = el("pre", "sf-logtext");
    /* the tail is what anybody reads; the whole file is what /log sends */
    var lines = String(lg.text || "").split("\n");
    pre.textContent = lines.slice(Math.max(0, lines.length - 60)).join("\n")
                    || "nothing in it yet.";
    box.appendChild(pre);
    return box;
  }

  /* the grid: one line per chapter, the eight cells at its right. Studio's
     own table has eight columns and a button in every cell; at 330px it is
     one ribbon a row, and pressing the ROW is what runs its remaining steps
     -- the same `POST /run {queue:true}` the column heading sends. */
  function gridFor(subject) {
    var box = el("div", "sf-grid");
    var tint = subject.hue || hue(subject.slug || subject.key || "");
    box.appendChild(head((subject.title || "This book") + " — steps"));

    /* A WORKING ROW HAS ONE SET OF CELLS, not one per chapter: it is an
       import, and an import is a whole book's parse. Draw the one ribbon. */
    if (subject.cells) {
      var only = el("div", "sf-gr");
      only.appendChild(el("span", "gid", "the import"));
      only.appendChild(el("span", "gt", subject.word || ""));
      only.appendChild(ribbon(subject.cells));
      only.style.setProperty("--hue", tint);
      box.appendChild(only);
      return box;
    }

    /* A SHELF BOOK'S CELLS ARE STUDIO'S (GET /book?slug=), one row per
       chapter, `state` read straight through. Nothing is derived from a
       counter and nothing is invented -- if the answer is not here yet the
       column says so and the fetch fills it in. */
    var d = S.live ? S.detail[subject.slug] : null;
    if (S.live && (!d || d.loading)) { box.appendChild(note("Reading its steps…")); return box; }
    if (d && d.error) { box.appendChild(note(d.error)); return box; }
    var rows = d ? d.chapters : benchChapters(subject);
    if (!rows.length) { box.appendChild(note("No chapters in that book yet.")); return box; }

    /* THE WHOLE BOOK, IN ONE PRESS -- `POST /run {slug, queue:true}`, which
       is studio's own "every remaining step of every chapter" (its handler's
       own docstring). This is the "generate the audio (TTS)" end of Osca's
       workflow when what you want is the book, not one chapter. */
    if (subject.slug) {
      var acts = el("div", "sf-acts");
      var all = el("button", "sf-verb");
      all.type = "button"; all.textContent = "Run what's left";
      all.title = "every remaining step of every chapter — one at a time, studio's own queue";
      all.addEventListener("click", function () {
        run({ slug: subject.slug, queue: true }, all, "Starting");
      });
      acts.appendChild(all);
      var vo = el("button", "sf-verb ghost");
      vo.type = "button"; vo.textContent = "Voice the book";
      vo.title = "the speak step, every chapter";
      vo.addEventListener("click", function () {
        run({ slug: subject.slug, step: "speak", queue: true }, vo, "Starting");
      });
      acts.appendChild(vo);
      box.appendChild(acts);
    }

    rows.slice(0, 12).forEach(function (ch) {
      var row = el("div", "sf-gr");
      row.appendChild(el("span", "gid", ch.id || ""));
      row.appendChild(el("span", "gt", ch.title || ""));
      row.appendChild(ribbon(ch.state || {}, ch));
      row.style.setProperty("--hue", tint);
      /* SAID ON THE ROW, not only in the button: "align" as a step name
         means nothing to a person; "no word timings" is the fact. */
      if (needsAlign(ch)) {
        var nt = el("span", "gt sf-notime");
        nt.textContent = "no word timings";
        nt.title = "this chapter has audio and no timings/" + (ch.id || "") + ".json — "
                 + "run align to build the word map";
        row.appendChild(nt);
      }
      /* ONE CHAPTER, ONE STEP. The row runs the FIRST step that is not `ok`,
         read off the cells studio itself sent -- so the button does the next
         thing rather than a step somebody guessed. Nothing here invents a
         step: `STEPS` is `studio/state.py`'s own list and the cells are its
         own marks. */
      if (subject.slug && ch.id) {
        var next = nextStepFor(ch);
        var b = el("button", "sf-verb");
        b.type = "button";
        b.textContent = next ? next : "done";
        b.disabled = !next;
        b.title = next ? "run " + next + " on " + ch.id : "every step of this chapter is done";
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          if (next) run({ slug: subject.slug, chapter: ch.id, step: next }, b, next);
        });
        row.appendChild(b);
        row.classList.add("pick");
        row.addEventListener("click", function () { openBook(subject, ch.id); });
      }
      box.appendChild(row);
    });
    if (rows.length > 12) box.appendChild(note((rows.length - 12) + " more chapters."));
    if (S.actErr) box.appendChild(note(S.actErr));
    return box;
  }
  /* the first step that is not done, in STEPS order. `null` when they all
     are -- which is what disables the button rather than running `export`
     again for the fourth time. */
  function nextStep(cells) {
    for (var i = 0; i < STEPS.length; i++) {
      var m = cells[STEPS[i]];
      if (m !== "ok") return STEPS[i];
    }
    return null;
  }
  /* A CHAPTER WITH AUDIO AND NO WORD TIMINGS, and it is the one cell in this
     grid the product is actually about. `GET /book` sends `timed` per
     chapter -- `state._exists(book_dir/"timings"/<cid>.json)`,
     `studio/bookinfo.py:585` -- beside the eight `state` marks, and this
     file read the marks and threw `timed` away. A book rendered before
     `align` ever ran shows `align: "ok"` and has no timings file, so
     `nextStep` walked straight past it and the row offered a LATER step:
     word-level highlighting, which is the whole of TTS TV, silently never
     built. studio.html has had the cell for this for days ("no word timings
     · run align", `needsAlign`); this surface had neither the field nor the
     question.

     `timed === false` and not `!timed`: `studio/add.py` sends `null` for a
     chapter it skipped, and null is "nobody looked", which is not the same
     answer and must not draw a warning. */
  function needsAlign(ch) {
    return !!ch && (ch.state || {}).speak === "ok" && ch.timed === false;
  }
  /* ...and what the ROW should therefore run. `nextStep` stays pure on the
     cells -- they are studio's own marks and nothing else -- and this is the
     one question that needs the chapter beside them. */
  function nextStepFor(ch) {
    if (needsAlign(ch)) return "align";
    return nextStep((ch && ch.state) || {});
  }
  /* THE BENCH ONLY, and it is named for what it is. With no server there is
     no `/book` to ask, so the bench draws the shape a shelf row implies: a
     book with audio reads as done, one without reads as parsed-only. This is
     never reached with studio behind the page -- `S.live` is the gate above. */
  function benchChapters(b) {
    var out = [], done = b.audio ? STEPS.length : 2;
    for (var i = 1; i <= (b.chapters || 8); i++) {
      var cells = {};
      STEPS.forEach(function (s, k) { cells[s] = k < done ? "ok" : "-"; });
      out.push({ id: "c" + String(i).padStart(3, "0"), title: "", state: cells });
    }
    return out;
  }

  /* ==================================================== THE STUDIO, INLINE
     §4, Osca 8 September: THE WORKS was a REDUCED studio -- steps, queue,
     Stop/Hold/log and nothing else. The four choices a render is actually
     made of lived only in `studio/studio.html`, a 1280px page you had to
     navigate to. They live here now, in the ⌘K panel, wired to the same
     routes that page speaks to. No modal, no navigation away.

     WHAT THE BRIEF SAID, AND WHAT THE SERVER ACTUALLY HAS (diagnosed first,
     §0). There is no `GET /voices` and no `GET /reference`: `studio/serve.py`'s
     route table (its ROUTES dict) has neither. `studio.html` reads BOTH out
     of `GET /state`:

       voices          `/state`.voices[]  -- studio/bookinfo.py::voices()
       the reference   that same row's `.reference` = refguard's
                       `reference-check.json` {ok, coverage, stale}
       where           `/state`.settings.render.where / .chosen / .modal.connected
       the lanes       `GET /kaggle`.destinations -- the MACHINE-WIDE block
                       (`_serve_kaggle` builds it with engine=None), each of
                       local/kaggle/modal carrying {id,pill,label,ok,short,why}
       kaggle creds    `GET /kaggle`.credentials_present / .connected
       the models      `GET /engines`.by_destination[<where>] + .engines[].limits
       persist voice   `POST /render {slug, voice}`   (studio.html::setBookVoice)
       persist engine  `POST /render {slug, engine, where}`
       persist where   `POST /settings {render:{where}}`
       import/re-cut   `POST /voice`, three shapes (serve.py::_handle_voice)
       the sample      `POST /sample` -> {job}; the NUMBERS arrive later on
                       `/state`.job.result, because the sample is a JOB now.

     `design/reader/older/studio.html` is a dead mock and was not read.

     THE ONE DIVERGENCE FROM studio.html, and it is Osca's word dated today.
     studio.html HIDES a lane it cannot use: `destinations().options` drops
     `modal` on a machine with no `~/.modal.toml`, drops `local` with nothing
     installed here, and `whereControl` draws no row at all when `!d.choice`.
     Osca, 8 Sep: *"A route that isn't usable is shown dashed with its reason,
     exactly like studio.html's disabled engines -- never hidden."* So this
     column reads `d.local` / `d.kaggle` / `d.modal` DIRECTLY, draws all three
     always, and an unusable one becomes the same `.off` span studio.html uses
     for a dead engine pill, carrying the server's own `short || why` verbatim.
     Nothing here composes a refusal sentence; every one of them is the
     server's, for the reason studio.html states: the route refuses with those
     words, so the control and the refusal cannot give two accounts of one rule.

     WHY THE BLOCK NEEDS A BOOK. Voice, model and sample are written into
     `books/<slug>/render.json`; with no book there is no file to write and no
     chapter to synthesize, and a choice about nothing is the control this
     file's own rule already forbids ("a button that cannot act is worse than
     no button"). WHERE alone is machine-wide, and it is drawn with them
     because it is the same kind of choice. */

  /* Two 300 s-ish caches, the shape studio.html gives ENGINES and KAGGLE and
     for its reason: `/engines` shells out to voice's python and `/kaggle`
     shells out to the kaggle CLI, so neither may ride the 4 s `/state` poll.
     A FETCH THAT FAILED IS REMEMBERED AS A FAILURE, never as "not asked yet"
     -- studio.html's own studio-simplify 0 bug, where a 404 put the cache
     back to its empty shape and the page re-asked for ever. */
  /* ...and they live IN THE STORE (Stage 2): `S.engines` and `S.kaggle`,
     one shape each, filled by the one `probe()` below. They were two
     variables outside `S` with two copies of the same asking rule. */

  /* THE ONE BODY READER (Stage 2). Every JSON route this file presses is
     read here: a body that is not JSON, and a status that is not 2xx, are
     turned into the same `{error}` sentence naming the route and the
     status -- kept whole when studio's own refusal carries more than a
     sentence (`held`, the push's own body). `strict` is the GET's rule:
     a refusal is a rejection, so a probe's `.catch` is the one place its
     failure lands. The POSTs resolve with it instead, because a refusal
     is an answer the column prints on its row. */
  function jsonOf(r, path, strict) {
    return r.text().then(function (t) {
      var j = null, broken = false;
      try { j = JSON.parse(t); }
      catch (e) { broken = true; j = { error: path + " answered " + r.status + " but not JSON" }; }
      if (!r.ok && !(j && j.error)) j = { error: path + " answered " + r.status };
      if (strict && (broken || !r.ok)) throw new Error(j.error);
      return j;
    });
  }
  /* THE ONE GET. `/state`, `/book`, `/engines`, `/kaggle` -- every JSON
     read of studio, with the clock on it and the words from `jsonOf`. */
  function getJSON(path, ms) {
    var url = api(path);
    if (!url) return Promise.reject(new Error("no studio behind this page"));
    return ask_(url, ms || 20000, { cache: "no-store" })
      .then(function (r) { return jsonOf(r, path, true); });
  }

  /* A FAILURE IS REMEMBERED, and this line is the whole of why (measured
     8 Sep, and it is studio.html's studio-simplify 0 bug in a worse form).
     `err` used not to count as "asked", so a draw re-fetched, the catch
     redrew, and the redraw re-fetched: an unbounded loop of 30 s requests
     against a studio that had answered once, honestly, that it could not. A
     probe that fails is remembered exactly like one that succeeds; `force` is
     the only thing that asks again. ONE FUNCTION for the two probes (Stage
     2): `probe(name, path, mock)` fills `S[name]`, and on the bench answers
     with the mock -- the bench has a studio too (§5.9). */
  function probe(name, path, mock, force) {
    if (S.bench) return mock;
    var c = S[name];
    if ((c.value || c.err) && !force) return c.value;
    if (c.asking) return c.value;
    c.asking = true; c.err = "";
    getJSON(path, 30000)
      .then(function (v) { S[name] = { value: v, asking: false, err: "" }; drawWorks(); })
      .catch(function (e) {
        S[name] = { value: null, asking: false, err: why(path.replace(/\?.*$/, ""), e) };
        drawWorks();
      });
    return c.value;
  }
  function askEngines(force) {
    return probe("engines", "/engines" + (force ? "?refresh=1" : ""), MOCK_ENGINES, force);
  }
  function askKaggle(force) {
    return probe("kaggle", "/kaggle" + (force ? "?force=1" : ""), MOCK_KAGGLE, force);
  }


  /* Where a render fired right now would go, as this column has drawn it --
     the server's `default` (which already answers "is there a choice", "did
     anybody choose" and "can it run"), never recomputed here. */
  /* HOURS AND MINUTES, and `studio.html::hoursLeftText`'s exact arithmetic
     so the two surfaces cannot give two accounts of one number. Pure: null
     in, null out -- an unasked quota is not a quota of zero. */
  function kaggleHours(hours) {
    if (hours == null) return null;
    var h = Math.floor(hours), m = Math.round((hours - h) * 60);
    return (h ? h + " h " : "") + m + " min";
  }
  function whereNow() {
    var d = (S.live ? S.kaggle.value : MOCK_KAGGLE) && (S.live ? S.kaggle.value : MOCK_KAGGLE).destinations;
    if (d && d.default) return d.default;
    var st = S.settings && S.settings.render;
    return (st && st.where) || "local";
  }

  /* THE ENGINE THIS BOOK WILL ACTUALLY RENDER WITH -- its own, or /engines'
     `default`. studio.html's `currentEngine`, same two terms and same order. */
  function currentEngine(b) {
    var cat = S.live ? S.engines.value : MOCK_ENGINES;      /* §5.9 -- the bench has one too */
    return (b && b.engine) || (cat && cat["default"]) || null;
  }

  /* ----------------------------------------------------------- the drawing */

  function prow(label, node, sub) {
    var r = el("div", "sf-prow");
    r.appendChild(el("span", "pl", esc(label)));
    var c = el("div", "pc");
    c.appendChild(node);
    if (sub) c.appendChild(sub);
    r.appendChild(c);
    return r;
  }
  function pills() { return el("div", "sf-pills"); }
  function offPill(text, title) {
    var s = el("span", "sf-pill off");
    s.textContent = text;
    if (title) s.title = title;
    return s;
  }
  function onPill(text, sel, disabled) {
    var b = el("button", "sf-pill");
    b.type = "button";
    b.textContent = text;
    if (sel) b.setAttribute("aria-selected", "true");
    if (disabled) b.disabled = true;
    return b;
  }
  function sub(html) { var s = el("span", "sf-sub"); s.innerHTML = html; return s; }

  /* 1 · THE CLONED-VOICE PICKER. `/state`.voices[] rendered as cards, the
     chosen one persisted the way studio.html persists it (`POST /render
     {slug, voice}`), the reference played off `/voice-clip?name=` -- which is
     a route studio already serves because TTS_DATA sits outside the published
     root and there is no relative URL to the clip. */
  /* THE LANGUAGE IT WAS READ AS -- `studio.html::langRow`, and the one verb
     in that whole panel that the LAN door already answers: `POST /lang` is
     in `_SYNC_STUDIO`'s twenty-two (G-DOOR4) and this surface has never
     called it. It decides the route a book's text takes (Latin and Greek go
     down the dub path on an engine with no phonemes; MOSS reads the IPA
     natively), and it was set once at parse time with no way to correct it
     from here.

     THE LIST IS MEASURED, NEVER TYPED. studio.html hardcodes seven codes;
     G-LANGADD replaced the typed list everywhere else with one read out of
     the dumps' own `lang_code` -- 4,566 of them -- so a typed seven is the
     thing that was just deleted. And this surface must NOT ask
     `GET /languages` for the real one: that route WRITES
     `languages/catalogue.json` (CLAUDE.md, learned three times), and a
     surface that is opened on every ⌘K would rewrite it on every open. So
     the options are the codes THE SHELF ITSELF USES -- every `lang` on
     `/state`'s own books -- plus this book's, which is always offered even
     if it is the only book in that language. It is a correction, not a
     catalogue: the language you want is almost always one you already have.

     `POST /lang` REWRITES Book.lang AND NOTHING ELSE ("re-parse to apply",
     its own docstring), so saying so is half the control. */
  function bookLangs(b) {
    var seen = {}, out = [];
    function add(c) { if (c && !seen[c]) { seen[c] = 1; out.push(c); } }
    add(b && b.lang);
    (S.shelf || []).forEach(function (x) { add(x.lang); });
    return out;
  }
  function langBlock(b) {
    var box = pills();
    var line = el("div", "sf-vsub");
    var on = (b && b.lang) || "";
    bookLangs(b).forEach(function (code) {
      var p = onPill(code, code === on, false);
      p.title = code === on ? "the language this book was parsed as"
                            : "re-read it as " + code + " — POST /lang, then Re-parse";
      p.addEventListener("click", function () { pickLang(b, code, p); });
      box.appendChild(p);
    });
    line.appendChild(sub("set at parse time; changing it rewrites the book's language and "
      + "nothing else — Re-parse is what applies it"));
    /* RE-PARSE IS NAMED AND NOT DRAWN. `POST /reparse` is NOT one of the
       twenty-two, so on a paired phone this button would 404 -- and a
       control that cannot act is worse than no control (item 2's rule). It
       is a Request to 91, who has serve.py open; until the door takes it,
       the sentence says where the press is. */
    if (S.langErr) line.appendChild(note(S.langErr));
    return prow("Language", box, line);
  }
  function pickLang(b, code, p) {
    if (!b || !b.slug || code === b.lang) return;
    S.langErr = "";
    act("/lang", { slug: b.slug, lang: code }, p, "…").then(function (j) {
      if (!j) return;
      if (j.error) { S.langErr = j.error; draw(); return; }
      /* THE SHELF IS STALE THE MOMENT THIS LANDS, and the answer is studio's
         own row -- so the pill follows the book rather than the press. */
      b.lang = (j && j.lang) || code;
      b.langs = (j && Array.isArray(j.langs) && j.langs.length > 1) ? j.langs.slice() : undefined;   // plural since G-LANGMIX
      S.shelf.forEach(function (x) { if (x.slug === b.slug) { x.lang = b.lang; x.langs = b.langs; } });
      draw();
    });
  }
  function voiceBlock(b) {
    var box = pills();
    var list = S.voices || [];
    if (!list.length) {
      box.appendChild(offPill("no voice yet", "TTS_DATA/voices/ is empty — import one"));
    } else {
      list.forEach(function (v) {
        var p = onPill(v.name, v.name === S.voice, false);
        /* THE PILL CARRIES ITS OWN PLAYBACK (studio.html, Osca 31 Aug): the
           glyph is a child of the SELECTED pill and nothing else on the row
           moves. Pressing it is not choosing a voice, so it stops the click
           from reaching the pill. */
        if (v.name === S.voice && v.clip) {
          var g = el("i", "pp");
          g.textContent = (REF_PLAY !== v.name || REF_PAUSED) ? "▸" : "❚❚";
          g.title = (REF_PLAY !== v.name || REF_PAUSED) ? "Play this reference"
                                                        : "Pause this reference";
          g.addEventListener("click", function (e) { e.stopPropagation(); toggleRef(v.name); });
          p.insertBefore(g, p.firstChild);
        }
        p.addEventListener("click", function () { pickVoice(v.name); });
        box.appendChild(p);
      });
    }
    /* IMPORT IS THE LAST PILL, DASHED -- studio.html's own shape. One file
       picker, `POST /voice?name=&filename=` with the raw bytes, and the new
       voice arrives as a pill on the next `/state`. */
    var imp = el("button", "sf-pill imp");
    imp.type = "button"; imp.textContent = "Import";
    imp.title = "An mp3 or wav to clone — 15–30 s of clean speech";
    imp.addEventListener("click", function () { pickVoiceFile(null, imp); });
    box.appendChild(imp);

    var v = list.filter(function (x) { return x.name === S.voice; })[0] || null;
    var line = el("div", "sf-vsub");
    line.appendChild(sub(voiceWords(v, list.length)));
    if (v) {
      /* "CHANGE REFERENCE" IS THE SAME ROUTE WITH THIS VOICE'S NAME.
         `voice.importvoice <file> --name <name>` finds the window, cuts it on
         silence, rewrites TTS_DATA/voices/<name>/reference.wav and derives the
         transcript from exactly those bytes -- and `voice/refguard.py` measures
         the pair before anything reaches that folder. So this button is the
         whole of "change the reference", and the guard is what makes it safe. */
      var acts = el("div", "sf-acts");
      var ch = el("button", "sf-verb ghost");
      ch.type = "button"; ch.textContent = "Change reference";
      ch.title = "a new clip for " + v.name + " — importvoice re-cuts it and refguard measures it";
      ch.addEventListener("click", function () { pickVoiceFile(v.name, ch); });
      acts.appendChild(ch);
      /* A REFUSED VOICE HAS ONE ACTION, and only when its own folder names a
         recording to re-cut FROM (`reimportable`). Otherwise the file picker
         above is the answer, which is what studio.html does too. */
      if (v.blocked && v.reimportable) {
        var ag = el("button", "sf-verb ghost");
        ag.type = "button"; ag.textContent = "Import it again";
        ag.title = "re-cut " + v.name + " from the recording its own source.json names";
        ag.addEventListener("click", function () {
          act("/voice", { name: v.name, reimport: true }, ag, "Re-cutting");
        });
        acts.appendChild(ag);
      }
      line.appendChild(acts);
      line.appendChild(refSlot());
    }
    /* THE IMPORTER, WHILE IT RUNS AND WHEN IT REFUSES (8 Sep addendum).
       A voice import takes the one job slot like everything else, so it is on
       `/state`'s job with `mode:"voice"`. yt-dlp plus two whisper passes is
       minutes; a page that said nothing for those minutes would be the silent
       blank Osca named. `j.err` is the importer's OWN sentence -- the missing
       yt-dlp and the four rungs it looked on, yt-dlp's own last line on a
       non-zero exit, or ffmpeg's -- printed, never paraphrased. */
    var vj = S.job && S.job.mode === "voice" ? S.job : null;
    if (vj) {
      line.appendChild(note(
        vj.phase === "running" ? "Adding “" + (vj.name || "") + "” — yt-dlp, then two whisper "
            + "passes. It keeps running if you close this."
        : vj.phase === "failed" ? "Couldn’t add “" + (vj.name || "") + "”. " + (vj.err || "")
        : "Added “" + (vj.name || "") + "”."));
    } else if (S.cloning) {
      line.appendChild(note("Cloning “" + S.cloning.title + "” as " + S.cloning.name + "…"));
    }
    /* THE GUARD'S FULL SENTENCE, where a person has just been stopped. The
       sub-line above says the number; `blocked.refusal` is refguard's whole
       account (the seconds, the floor, and what ICL does with an
       untranscribed tail), verbatim, out of `reference-check.json`. */
    if (v && v.blocked && v.blocked.refusal) line.appendChild(note(v.blocked.refusal));
    if (S.voiceErr) line.appendChild(note(S.voiceErr));
    return prow("Voice", box, line);
  }

  /* THE REFERENCE, IN THE WORDS ITS OWN RECORD USES. studio.html's
     `referenceWords`, ported whole: "transcript checked" used to mean
     "transcript.txt exists", which was true and useless -- five of seven
     voices carried a transcript describing about half their own clip. What
     this says is what refguard MEASURED, and a refusal is the guard's own
     sentence, never a paraphrase. */
  function voiceWords(v, n) {
    if (!v) {
      return n ? "No voice chosen yet — 15–30 s of clean speech is plenty."
               : "15–30 s of clean speech is plenty.";
    }
    var secs = v.seconds ? Math.round(v.seconds) + " s" : "reference clip";
    var r = v.reference, words;
    if (!r) {
      words = v.transcript
        ? "transcript <b>not measured yet</b> — the first render checks it"
        : "<b>no transcript</b> — the first render will refuse until there is one";
    } else if (r.stale) {
      words = "the clip changed since it was last checked";
    } else {
      var pct = r.coverage == null ? null : Math.round(r.coverage * 100);
      if (r.ok) words = pct == null ? "transcript checked"
                                    : "transcript describes <b>" + pct + " %</b> of the clip";
      else words = "transcript describes "
        + (pct == null ? "too little" : "<b>only " + pct + " %</b>") + " of the clip";
    }
    return esc(v.name) + " · " + esc(secs) + " · " + words;
  }

  /* THE PLAYING ELEMENT IS NEVER REBUILT (studio.html, Osca 31 Aug: *"the
     reference player restarts on every state poll"*). `drawWorks` clears the
     column and re-appends on every 4 s poll, and an <audio> built into that
     markup would be a NEW element each time: same src, playback back at zero.
     So the markup carries an empty SLOT and `mountRefPlayer()` moves the ONE
     live element into it, synchronously, in the same task as the clear -- the
     spec's pause-on-removal step runs at a stable state and finds it back in
     the document, which is exactly why this is a move and not a re-parse. */
  var REF_AUDIO = null, REF_PLAY = null, REF_PAUSED = false;
  function refSlot() { var s = el("span", "sf-refslot"); s.id = "sfRefSlot"; return s; }
  function silenceRef() {
    if (REF_AUDIO) { try { REF_AUDIO.pause(); } catch (e) {} }
    REF_AUDIO = null; REF_PLAY = null; REF_PAUSED = false;
  }
  /* AUDIO STARTS ONLY FROM A USER GESTURE, and this guard is where that rule
     is enforced -- studio.html's own, after a built app spoke on launch.
     `REF_PLAY` is written in exactly two places and both are a click, so
     REF_PLAY IS the record of a gesture and nothing else may start a clip.
     PAINTING A SELECTION IS NOT A GESTURE. */
  function mountRefPlayer() {
    if (!REF_PLAY) return;
    var slot = worksEl && worksEl.querySelector("#sfRefSlot");
    if (!slot) return;
    var v = (S.voices || []).filter(function (x) { return x.name === REF_PLAY; })[0];
    if (!v || !v.clip) return;
    if (!REF_AUDIO || REF_AUDIO.dataset.voiceName !== v.name) {
      REF_AUDIO = document.createElement("audio");
      REF_AUDIO.dataset.voiceName = v.name;
      REF_AUDIO.preload = "none";
      REF_AUDIO.src = api(v.clip) || v.clip;
      REF_AUDIO.addEventListener("ended", function () { REF_PAUSED = true; drawWorks(); });
    }
    if (REF_AUDIO.parentNode !== slot) slot.appendChild(REF_AUDIO);
    if (REF_PAUSED) { try { REF_AUDIO.pause(); } catch (e) {} }
    else { try { REF_AUDIO.play(); } catch (e) {} }
  }
  function toggleRef(name) {
    if (REF_PLAY !== name) { silenceRef(); REF_PLAY = name; REF_PAUSED = false; }
    else REF_PAUSED = !REF_PAUSED;
    drawWorks();
  }

  /* THE ONE FILE INPUT, made once. `POST /voice?name=&filename=` with the raw
     bytes is the same route the Ingest drop zone uses; the answer is a job,
     and the pill arrives on the next `/state`. */
  var VFILE = null;
  function pickVoiceFile(name, btn) {
    /* §5.9: the one pair of controls the bench cannot honestly mock. Importing
       a clip and cloning a URL both END in files under `TTS_DATA/voices/` that
       refguard has measured; a bench that pretended would be teaching a
       refusal that never happened. So they say what they are instead. */
    if (!S.live) { S.voiceErr = (S.bench ? "the bench" : "this page")
                     + " has no importer — this needs studio behind the page";
                   drawWorks(); return; }
    if (!VFILE) {
      VFILE = document.createElement("input");
      VFILE.type = "file"; VFILE.accept = "audio/*";
      VFILE.style.display = "none";
      (root || document.body).appendChild(VFILE);
    }
    VFILE.onchange = function () {
      var f = VFILE.files && VFILE.files[0];
      VFILE.value = "";
      if (!f) return;
      sendVoiceFile(f, name || voiceNameFromFile(f.name), btn);
    };
    VFILE.click();
  }
  function voiceNameFromFile(filename) {
    return String(filename || "").replace(/\.[^.]*$/, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function sendVoiceFile(f, name, btn) {
    S.voiceErr = "";
    if (!name) { S.voiceErr = "that file name has nothing to make a voice name out of"; drawWorks(); return; }
    var url = api("/voice?name=" + encodeURIComponent(name)
                  + "&filename=" + encodeURIComponent(f.name));
    if (!url) { S.voiceErr = "/voice — no studio behind this page"; drawWorks(); return; }
    if (btn) { btn.disabled = true; btn.dataset.was = btn.textContent; btn.textContent = "Importing…"; }
    /* AN IMPORTED VOICE IS THE CHOSEN ONE the moment the route takes it --
       studio.html's own rule, and it is what makes "the new voice appears as
       a pill and is already selected" true with a job in between. */
    ask_(url, 120000, { method: "POST", body: f, cache: "no-store" })
      .then(function (r) { return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok || (j && j.error)) throw new Error((j && j.error) || ("/voice answered " + r.status));
        return j; }); })
      .then(function () {
        silenceRef();
        S.voice = name;
        if (btn) { btn.disabled = false; if (btn.dataset.was) btn.textContent = btn.dataset.was; }
        pollWorks(); drawWorks();
      })
      .catch(function (e) {
        S.voiceErr = why("/voice", e);
        if (btn) { btn.disabled = false; if (btn.dataset.was) btn.textContent = btn.dataset.was; }
        drawWorks();
      });
  }

  /* Picking a voice is local AND persisted, in that order -- studio.html's
     `setBookVoice`: the pill lights from the click, and `POST /render` writes
     `books/<slug>/render.json`.voice, which is the field `studio/tasks.py`'s
     `_speak_argv` reads before every real Build. Without the write, picking a
     card would be cosmetic and every render would use whatever render.json
     already held. */
  function pickVoice(name) {
    if (REF_PLAY !== name) silenceRef();
    S.voice = name;
    var b = subject();
    drawWorks();
    if (b && b.slug && S.live) return act("/render", { slug: b.slug, voice: name }, null, null);
    return Promise.resolve(null);
  }

  /* 2 · WHERE. Three lanes, always all three (Osca 8 Sep -- see the head of
     this section). The block is `GET /kaggle`.destinations, which is
     `studio/remote.py::destinations()` asked with NO engine: the machine-wide
     answer -- is there a CLI, is this Mac signed in, is a session free, is
     there a ~/.modal.toml -- rather than a book's. */
  function whereBlock() {
    var k = (S.live ? S.kaggle.value : MOCK_KAGGLE) || askKaggle(false);
    var box = pills();
    var line = el("div", "sf-vsub");
    /* A CHOICE THAT WILL NOT SURVIVE A RESTART SAYS SO, AND SAYS IT FIRST.
       `/state`.settings carries `persisted` and `save_error` (`studio/
       bookinfo.py`) and this block ignored both -- so a studio that could
       not write its settings file took the press, lit the pill, and lost it
       on the next launch with nothing on the screen ever having said so.
       studio.html's Settings panel drew this warning; it is the one thing in
       that panel that is about a FAILURE.

       It goes on `line` before the three early returns below, deliberately.
       It is a fact about `POST /settings`, not about `GET /kaggle`, and the
       first draft put it at the bottom -- where a Kaggle that would not
       answer returned above it and swallowed it, which is precisely the
       moment somebody is choosing a different lane. There is a test with
       `/kaggle` dead that would go red if it moved back down. */
    var sp = S.settings;
    if (sp && sp.persisted === false)
      line.appendChild(note("This choice will not survive a restart — "
        + (sp.save_error || "studio could not write its settings file")
        + (sp.path ? " (" + sp.path + ")" : "")));
    if (S.live && S.kaggle.err) { box.appendChild(offPill("no answer", S.kaggle.err));
                             line.appendChild(note(S.kaggle.err));
                             return prow("Where", box, line); }
    if (!k) { box.appendChild(offPill("asking…", "GET /kaggle")); return prow("Where", box, line); }
    var d = k.destinations || {};
    var on = whereNow();
    /* Kaggle first because that is the standard route and where the free GPU
       is (CLAUDE.md: "Kaggle is the standard route"), Fast second because it
       is the other remote box, This Mac last -- `destinations()`' own order. */
    ["kaggle", "modal", "local"].forEach(function (id) {
      var o = d[id];
      if (!o) { box.appendChild(offPill(id + " — this studio did not answer for it")); return; }
      var label = o.pill || o.label || o.id;
      if (!o.ok) {
        /* DASHED, WITH THE REASON, NEVER HIDDEN -- and the sentence is the
           server's own `short`, falling back to its `why`. */
        box.appendChild(offPill(label + " — " + (o.short || o.why || "not available"),
                                o.why || ""));
        return;
      }
      var p = onPill(label, id === on, false);
      p.title = o.label || "";
      p.addEventListener("click", function () { pickWhere(id, p); });
      box.appendChild(p);
    });
    if (d.default_reason) line.appendChild(sub(esc(d.default_reason)));
    /* WHAT THE FREE GPU HAS LEFT, AND WHAT IS ON IT -- rows 5 and 6 of the
       twelve (`PROMPTS/reasoning/phone-studio.md` §4: *"This week (GPU
       hours) ... courier"*, *"Sessions ... courier"*), and both were already
       on this wire. `studio/remote.py::destinations` puts `hours_left`,
       `slots` and `running` on the kaggle destination, and this block read
       `pill`, `ok`, `short` and `why` and threw the rest away -- so the one
       number that decides whether to press Kaggle at all lived only in
       studio.html's Settings panel, on a Mac.

       It is DRAWN FROM THE SAME PAYLOAD, so it costs no second route and it
       works on a phone the moment `/kaggle` does (it is one of the
       twenty-two, G-DOOR4). `hours_left` null is not zero: it means nobody
       has asked yet, or this Mac is not signed in, and the line says
       nothing rather than "0 h left", which would read as a refusal. */
    var kg = d.kaggle || {};
    var bits = [];
    var hl = kaggleHours(kg.hours_left);
    if (hl) bits.push(hl + " of free GPU left this week");
    if (kg.running && kg.running.length)
      bits.push(kg.running.length + " session" + (kg.running.length === 1 ? "" : "s") + " running"
                + (kg.slots ? " of " + kg.slots : ""));
    else if (kg.slots) bits.push("no session running · " + kg.slots + " free");
    if (bits.length) line.appendChild(sub(esc(bits.join(" \u00b7 "))));
    /* CREDENTIALS AS A FACT, NEVER A VALUE. `credentials_present` is a
       Path.exists() on ~/.kaggle/kaggle.json; nothing on this wire is the
       file's contents, nothing is masked and nothing is logged. Modal is the
       same shape: `/state`.settings.modal.connected is `~/.modal.toml`
       existing (studio/remote.py::modal_connected). */
    var kc = k.credentials_present ? "Kaggle credentials on this Mac"
                                   : "no Kaggle credentials on this Mac";
    var mc = (S.settings && S.settings.modal && S.settings.modal.connected)
      ? "Modal connected" : "Modal not connected";
    line.appendChild(sub(esc(kc + " · " + mc)));
    if (S.whereErr) line.appendChild(note(S.whereErr));
    return prow("Where", box, line);
  }

  /* One press writes the SETTING -- `POST /settings {render:{where}}`, the
     same server-side setting studio.html's own control writes, so every
     studio surface agrees. A `kaggle` this machine cannot reach is refused
     THERE with the server's sentence, and the sentence lands on the control
     that caused it. Both caches are stale the moment it changes, so both are
     re-asked rather than patched here. */
  function pickWhere(id, btn) {
    S.whereErr = "";
    /* §5.9: ON THE BENCH THE PILL STILL MOVES. There is no `/settings` to
       write, and a control that did nothing would make the one thing this row
       exists to be judged on -- which lane is lit, and how the two dashed ones
       sit beside it -- impossible to look at. So the mock's own destination
       block is what changes, and nothing is posted. The block's mock line
       above already says nothing is being written. */
    if (S.bench) {
      MOCK_KAGGLE.destinations["default"] = id;
      MOCK_SETTINGS.render = { where: id };
      S.settings = MOCK_SETTINGS;
      drawWorks();
      return Promise.resolve({ render: { where: id } });
    }
    return act("/settings", { render: { where: id } }, btn, "…").then(function (j) {
      if (j && j.error) { S.whereErr = "/settings — " + j.error; }
      else if (S.settings) { S.settings.render = { where: id }; S.settings.chosen = true; }
      askKaggle(true); askEngines(false);
      pollWorks(); drawWorks();
      return j;
    });
  }

  /* 3 · THE MODEL. `GET /engines`.by_destination[<where>] and nothing else --
     the pills are computed on the SERVER from the port's own facts
     (studio/remote.py::engine_options), so an engine not installed here is
     simply not in the local list and the two that ship are always in the
     Kaggle one. The page computes none of it and can never show a second
     opinion of what the render will do. */
  function engineBlock(b) {
    var cat = (S.live ? S.engines.value : MOCK_ENGINES) || askEngines(false);
    var box = pills();
    var line = el("div", "sf-vsub");
    if (S.live && S.engines.err) { box.appendChild(offPill("no engine list", S.engines.err));
                   line.appendChild(note(S.engines.err)); return prow("Model", box, line); }
    if (!cat) { box.appendChild(offPill("asking…", "GET /engines"));
                return prow("Model", box, line); }
    if (cat.error) {
      /* A PROBE THAT FAILED DRAWS ITS SENTENCE. Nothing is guessed: until
         this answers, a render uses whatever render.json already names. */
      box.appendChild(offPill("no engine list", cat.error));
      line.appendChild(note(cat.error));
      return prow("Model", box, line);
    }
    var where = whereNow();
    var rows = (cat.by_destination && cat.by_destination[where]) || [];
    var cur = currentEngine(b);
    rows.forEach(function (e) {
      if (!e.ok) {
        /* A pill that cannot be picked is a span, not a button: the server
           would refuse to write it (`state.set_engine` through
           `remote.refuse_engine`), so it must not pretend to be a choice.
           Four words on the face, the port's whole sentence in the title. */
        box.appendChild(offPill(e.id + " — " + (e.why || "not available"), e.sentence || ""));
        return;
      }
      var p = onPill(e.id, e.id === cur, false);
      p.addEventListener("click", function () { pickEngine(b, e.id, p); });
      box.appendChild(p);
    });
    /* The book's own engine when this destination cannot offer it -- shown,
       because it is what render.json says and what go would try. */
    if (cur && !rows.some(function (e) { return e.id === cur; })) {
      box.insertBefore(offPill(cur + " — " + (where === "local" ? "not on this Mac"
                                                                : "not offered on " + where)),
                       box.firstChild);
    }
    if (!box.children.length) {
      box.appendChild(offPill(where === "local" ? "no model installed here"
                                                : "no model offered"));
    }
    /* THE SENTENCES SIT ABOVE THE GPU-MINUTES ON PURPOSE (studio.html):
       "Osca should read that before the GPU-minutes, not discover it in the
       output." `limits` is `voice/port.py::limits()` verbatim. */
    var row = (cat.engines || []).filter(function (e) { return e.id === cur; })[0];
    if (row && row.limits && row.limits.length) {
      var lim = el("div", "sf-limits");
      lim.appendChild(el("b", null, "What " + esc(cur) + " costs, before the minutes:"));
      row.limits.forEach(function (l) { lim.appendChild(el("span", null, "· " + esc(l))); });
      line.appendChild(lim);
    }
    if (S.engineErr) line.appendChild(note(S.engineErr));
    return prow("Model", box, line);
  }

  /* `POST /render {slug, engine, where}` -- and `where` is not optional:
     without it `state.set_engine`'s gate is this Mac's venvs (`port.refuse`),
     which refused MOSS for a render that was going to a T4. The destination
     the page drew the pill with is the destination the write is checked
     against. */
  function pickEngine(b, id, btn) {
    S.engineErr = "";
    if (S.bench) {                        /* §5.9 -- see pickWhere */
      if (b) b.engine = id;
      if (S.sel) S.sel.engine = id;
      drawWorks();
      return Promise.resolve({ engine: id });
    }
    if (!b || !b.slug) { S.engineErr = "no book selected — nothing to write an engine into"; drawWorks(); return Promise.resolve(null); }
    return act("/render", { slug: b.slug, engine: id, where: whereNow() }, btn, "…")
      .then(function (j) {
        if (j && j.error) S.engineErr = "/render — " + j.error;
        else { b.engine = id; if (S.sel && S.sel.slug === b.slug) S.sel.engine = id; }
        drawWorks();
        return j;
      });
  }

  /* 4 · THE SAMPLE. `POST /sample {slug, chapter, voice, engine, where}` --
     ~30 s really synthesized in the chosen voice, model and destination.
     IT IS A JOB, NOT A BLOCKING CALL (studio.html, 31 Aug): a cold model load
     here or a kernel launch there is minutes either way, so it takes the one
     job slot, the card above follows it, and the NUMBERS come back on
     `/state`.job.result -- which is why a reload no longer loses it. A
     destination that cannot take it is refused by the server with
     `destinations`' own sentence, and that sentence lands here. */
  function sampleBlock(b) {
    var box = el("div", "sf-sample");
    var s = S.sample;
    var unit = sampleUnit(b);
    if (s && s.phase === "sampling") {
      var bar = el("span", "sf-bar indeterminate", "<i></i>");
      box.appendChild(bar);
      box.appendChild(sub("Synthesizing " + esc(s.chapter || unit || "")
        + " in the real voice — the model has to load first, so a first sample "
        + "can take a couple of minutes."));
      return prow("Sample", box, null);
    }
    if (s && s.phase === "numbers" && s.numbers) {
      var m = s.numbers;
      var est = el("div", "sf-est");
      function cell(k, v, tail) {
        est.appendChild(el("div", null, '<span class="k">' + esc(k) + "</span> <b>"
          + esc(v) + "</b>" + (tail ? " " + esc(tail) : "")));
      }
      cell("Target", (m.target_seconds != null ? m.target_seconds : "?") + "s");
      cell("Actual", (m.actual_seconds != null ? m.actual_seconds.toFixed(1) : "?") + "s");
      cell("Chunks used", (m.chunks_used != null ? m.chunks_used : "?"),
           "of " + (m.total_chunks != null ? m.total_chunks : "?"));
      if (m.rtf != null) cell("Synth speed", m.rtf.toFixed(2) + "× real-time");
      box.appendChild(sub((s.mock ? "<b>The bench's own numbers (mock)</b> — "
                                   : "<b>It really synthesized</b> — ") + esc(String(m.chunks_used))
        + " of " + esc(String(m.total_chunks)) + " chunks, "
        + esc(m.actual_seconds != null ? m.actual_seconds.toFixed(1) : "?")
        + "s of audio in the real voice."));
      box.appendChild(est);
      if (m.audio) {
        var a = document.createElement("audio");
        a.controls = true; a.preload = "none";
        a.src = (api("/" + String(m.audio).replace(/^\/+/, "")) || m.audio);
        box.appendChild(a);
      }
      box.appendChild(sampleActs(b, unit, "Sample again"));
      return prow("Sample", box, null);
    }
    if (s && s.phase === "failed") {
      box.appendChild(note("Sample failed. " + (s.err || "")));
      box.appendChild(sampleActs(b, unit, "Try again"));
      return prow("Sample", box, null);
    }
    /* WHY IT CANNOT, BEFORE IT IS PRESSED -- the same three the server checks. */
    var blocked = !unit ? "no chapter to sample yet"
      : (S.ssd && S.ssd.mounted === false) ? "the SSD is unplugged — the model and the voice clip are on it"
      : !S.voice ? "no voice chosen yet" : null;
    box.appendChild(sampleActs(b, unit, "Sample 30 s of " + (unit || "…"), blocked));
    if (blocked) box.appendChild(sub("Can’t: " + esc(blocked) + "."));
    else box.appendChild(sub("Nothing long starts until you have heard this. It really "
      + "synthesizes, in the chosen voice, model and destination — real numbers back."));
    if (S.sampleErr) box.appendChild(note(S.sampleErr));
    return prow("Sample", box, null);
  }
  function sampleActs(b, unit, label, blocked) {
    var acts = el("div", "sf-acts");
    var go = el("button", "sf-verb");
    go.type = "button"; go.textContent = label;
    go.disabled = !!blocked || !S.live || !b || !b.slug;
    go.title = "~30 s, really synthesized in " + (S.voice || "the book's voice")
             + " on " + whereNow();
    go.addEventListener("click", function () { sample(b, unit, go); });
    acts.appendChild(go);
    return acts;
  }
  /* WHICH CHAPTER. The first row `GET /book` sent for this book -- named on
     the button, so what it is about to spend GPU minutes on is on the face of
     the control rather than inferred. Never invented: with no `/book` answer
     yet there is no unit and the button says so. */
  function sampleUnit(b) {
    if (!b || !b.slug) return null;
    var d = S.detail[b.slug];
    var rows = d && d.chapters;
    /* THE CHAPTER YOU PRESSED, when you pressed one (§5.8) -- and only while
       it is a chapter of THIS book, so a selection does not follow you across
       books. Otherwise the first row `GET /book` sent. */
    if (S.unit && S.unitSlug === b.slug
        && (rows || []).some(function (c) { return c.id === S.unit; })) return S.unit;
    return (rows && rows.length && rows[0].id) || null;
  }
  function sample(b, unit, btn) {
    S.sampleErr = "";
    if (!b || !b.slug || !unit) { S.sampleErr = "nothing to sample yet"; drawWorks(); return Promise.resolve(null); }
    S.sample = { phase: "sampling", slug: b.slug, chapter: unit };
    drawWorks();
    /* §5.9: THE BENCH'S OWN SAMPLE, and it is named for what it is -- the
       same shape `simulate()` gives an ingest, and for the same reason: the
       one thing a still page cannot show is a state ARRIVING, so the bench
       walks the three the real job has (sampling -> numbers) on a timer. The
       numbers carry `(mock)` in the row that draws them. */
    if (S.bench) {
      setTimeout(function () {
        if (!S.sample || S.sample.phase !== "sampling") return;
        S.sample = { phase: "numbers", slug: b.slug, chapter: unit, mock: true,
                     numbers: { target_seconds: 30, actual_seconds: 29.4,
                                chunks_used: 7, total_chunks: 41, rtf: 1.83, audio: null } };
        drawWorks();
      }, 1400);
      return Promise.resolve(null);
    }
    return act("/sample", { slug: b.slug, chapter: unit, voice: S.voice || b.voice || null,
                            engine: currentEngine(b), where: whereNow() }, btn, "Sampling")
      .then(function (j) {
        if (!j || j.error) {
          S.sample = { phase: "failed", slug: b.slug, chapter: unit,
                       err: (j && j.error) || "the route did not answer" };
        } else if (j.job) {
          S.job = j.job;
        }
        drawWorks();
        return j;
      });
  }
  /* The sample's own state, read off the ONE job `/state` carries -- the same
     fold studio.html's `sampleAudition` does, and for its reason: a finished
     sample must survive the poll that follows it. */
  function sampleFromJob(d) {
    var j = d && d.job;
    if (!j || j.mode !== "sample") return null;
    if (j.phase === "running") return { phase: "sampling", slug: j.slug, chapter: j.chapter };
    if (j.phase === "failed") return { phase: "failed", slug: j.slug, chapter: j.chapter, err: j.err || "" };
    if (j.phase === "done" && j.result)
      return { phase: "numbers", slug: j.slug, chapter: j.chapter, numbers: j.result };
    return null;
  }

  /* The whole block, in studio.html's own order: the voice, where it runs,
     the model, then the thirty seconds that proves all three. */
  function studioBlock() {
    var b = subject();
    if (!b) return null;
    var box = el("div", "sf-studio");
    box.appendChild(voiceBlock(b));
    box.appendChild(langBlock(b));
    box.appendChild(whereBlock());
    box.appendChild(engineBlock(b));
    box.appendChild(sampleBlock(b));
    return box;
  }

  /* ------------------------------------------------------- the works, live */
  var pollTimer = null;
  function pollWorks() {
    clearTimeout(pollTimer);
    if (!opened || !S.live) return;
    /* the same `askState` a keystroke uses -- this is only the CLOCK on it:
       two seconds while something is running, five while nothing is */
    askState().then(function () {
      draw();
      pollTimer = setTimeout(pollWorks,
        (S.job || S.ingests.length || S.reparsing.length) ? 2000 : 5000);
    });
  }

  /* ====================================================== VIDEO, AND THE WEB
     Both keep their place, at the foot of the one list rather than in panes
     of their own.

     THE HOLE WAS A CONTRACT THIS SURFACE CANNOT HOLD, and that is the second
     thing that only looked live. `youtube.com/results` sends X-Frame-Options
     and stays blank in an iframe, so search.html keeps a HOLE and reports its
     box with `TTSTVHost.searchRect`, and the shell puts a second webview over
     it. But `tabs.rs::host_search_rect` opens with

         if webview.label() != SEARCH_PAGE { return; }

     -- it hears the SEARCH WINDOW's page webview and nothing else. This file
     is never that webview: it mounts over the reader or the Library, in a
     content tab. So every report it could send is discarded, and a hole drawn
     on the strength of one is a box with nothing in it, for ever.

     What the app can actually do with a video is open it BESIDE you:
     `window.open` on a non-loopback URL reaches `tabs.rs::on_new_window` ->
     `open_url_beside`, which files it as a tab in this window (host.js's own
     third landing, proved live 6 Sep). So in the app the row is a door to a
     tab; in a plain browser it is the hole with the iframe in it, exactly as
     the bench draws it. One row, two honest landings, and no reserved box
     that nothing will ever fill. */
  var IN_APP = !!(window.TTSTVHost && typeof window.TTSTVHost.openReader === "function");

  /* THE ROW OPENS A PARTICULAR THING (Osca, 8 Sep: *"ELSEWHERE/Video opens a
     SPECIFIC result -- the best-matching video, and any web link a specific
     hit, not a bare query"*).

     What it was: `https://www.youtube.com/results?search_query=<q>` -- a
     search page, handed to you to search again. The app had already done the
     searching: the youtube adapter returns real hits with real watch urls
     (`tools/search/sources/youtube.py`: `url=hit["url"]`, `kind="audio"`),
     and this file was throwing them away, because everything non-text was
     dropped into the one out-there list where `Add` refused it.

     So the lanes read `S.media` -- the candidates that ARE recordings -- and
     rank them with the same `match()` the book rows use. The best one is the
     row; the rest are under it. The bare query survives in exactly one place
     and wearing its own name ("Search YouTube for ..."), for the case where
     the adapter found nothing at all -- and that row says WHY it is there,
     out of the same per-source report the list draws. */
  function best(list) {
    var out = list.map(function (c) {
      return { c: c, s: match(c.title, c.author, S.q) + (SRCW[c.source] || 0) };
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.map(function (r) { return r.c; });
  }
  function videos() {
    return best(S.media.filter(function (c) {
      return c.source === "youtube" || /youtube\.com|youtu\.be/.test(c.url || "");
    }));
  }
  /* everything else that is a page out there rather than a book to parse:
     an archive.org details page, a LibriVox recording page. Each one is a
     LINK TO ITSELF, which is what "a specific hit" means. */
  function webHits() {
    return best(S.media.filter(function (c) {
      return !(c.source === "youtube" || /youtube\.com|youtu\.be/.test(c.url || ""));
    }).concat(S.dropped.filter(function (c) {
      /* the filter dropped these as not-this-book, and it is often right --
         but they are real pages somebody may still want, so they are offered
         as LINKS and never as books. Two, at most: this is a footnote. */
      return c && c.url && /^https?:/.test(c.url);
    }).slice(0, 2)));
  }
  function mmss(sec) {
    if (!sec && sec !== 0) return "";
    var n = Math.round(sec), h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
    return h ? h + " h " + m + " m" : m ? m + " m" : n + " s";
  }
  function openOut(url) {
    /* `window.open` on a non-loopback url reaches `tabs.rs::on_new_window` ->
       `open_url_beside`, which files it as a tab in this window (host.js's
       own third landing, proved live 6 Sep). In a plain browser it is a new
       tab. Same call, both places. */
    try { window.open(url, "_blank", "noopener,noreferrer"); } catch (e) { location.href = url; }
  }

  /* the fallback, and it is labelled as the fallback */
  function videoQueryUrl() {
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(S.q);
  }
  /* kept for the tests and the bench that already name it: the url the row
     WOULD open. A specific watch url when there is one, the query when there
     is not -- so a caller can assert which of the two it got. */
  function videoUrl() {
    var v = videos()[0];
    return (v && v.url) || videoQueryUrl();
  }

  function mediaRow(c, lane) {
    var r = rowShell("r-out sf-hit", lane + ":" + (c.url || c.title));
    r.querySelector(".t").textContent = c.title;
    /* EVERY RESULT ROW, AND A RECORDING IS A RESULT (Round 2 items 4, 5, 6).
       This row was built before those existed and kept its own joined string,
       so an ELSEWHERE hit had no source tag that could not be truncated, no
       text/audio marker and no facts -- and the driver caught it: four
       markers on a list of six results. It is the same three helpers the
       book rows use, so there is one answer to "what does a result say" and
       not two. */
    var s = r.querySelector(".s");
    s.textContent = "";
    var src = el("span", "sf-src-tag");
    src.textContent = SOURCE[c.source] || c.source || "out there";
    s.appendChild(src);
    var who = el("span", "sf-who");
    who.textContent = [c.author || "", shortHost(c.url)].filter(Boolean).join(" · ");
    s.appendChild(who);
    var mst = textAudio(c);
    var mk = el("span", "sf-ta ta-" + mst.kind);
    mk.textContent = mst.word;
    mk.title = mst.why;
    s.appendChild(mk);
    var mf = candFacts(c);
    if (mf.length) {
      var mfb = el("span", "sf-facts");
      mf.forEach(function (t) { mfb.appendChild(el("i", null, esc(t))); });
      r.querySelector(".body").appendChild(mfb);
    }
    var mpv = previewOf(c);
    if (mpv) {
      var mp = el("span", "sf-preview");
      mp.textContent = mpv;
      r.querySelector(".body").appendChild(mp);
    }
    /* ITEM 7 on this row too: audition it here rather than leaving for
       YouTube. `Play`/`Open` below is still the door OUT; this is the one
       that stays. */
    if (canPeek(c))
      r.querySelector(".end").appendChild(rowBtn("audition",
        "hear it in the panel — /peek, nothing downloaded",
        function (b) { peek(c, { key: r.dataset.key, cand: c }, b); }));
    var go = el("button", "sf-verb");
    go.type = "button";
    go.textContent = lane === "video" ? "Play" : "Open";
    go.addEventListener("click", function (e) { e.stopPropagation(); openOut(c.url); });
    r.querySelector(".end").appendChild(go);
    /* AND THE OTHER THING YOU CAN DO WITH A RECORDING: attach it to a book
       you already have. `POST /attach` is studio's own route and it is the
       second half of "add a new book / new audio / attach audio". It is only
       offered when there IS a book to attach to -- the one selected in the
       works column, or the one open underneath. */
    var to = subject();
    if (to && S.live) {
      var said = S.attached[attachKey(c, to)];
      var at = el("button", "sf-verb ghost");
      at.type = "button";
      at.textContent = said || ("Attach to " + (to.title || to.slug));
      if (said) at.title = said;
      at.addEventListener("click", function (e) { e.stopPropagation(); attach(c, to, at); });
      r.querySelector(".end").appendChild(at);
    }
    /* ================================================ THE SEAM (8 Sep addendum)
       Osca: *"Today an ELSEWHERE web/YouTube result only opens the video.
       Give it a 'use this voice' action that hands its URL to POST /voice as
       the clone source."*

       IT IS THE ROUTE'S SECOND SHAPE AND NOTHING NEW. `_handle_voice` takes a
       JSON body `{name, url}` and hands the URL to `voice.importvoice` AS the
       link (2 Sep): `import_voice` sees `http(s)` (`voice/importvoice.py::
       _is_url`), spawns `yt-dlp` into its own work folder, decodes through
       ffmpeg, windows and cuts on silence, transcribes with whisper, and
       `voice/refguard.py` measures the pair before ANY of the four files
       reach `TTS_DATA/voices/<name>/`. So there is no new backend here: this
       button is the URL door, given a press.

       AND ITS REFUSALS ARE REAL AND ARE SHOWN. `no yt-dlp on this Mac` (with
       the four rungs it looked on, and `brew install yt-dlp`), a non-zero
       yt-dlp exit carrying yt-dlp's own last line, an exit 0 that wrote
       nothing, and ffmpeg missing -- every one of them is raised by the
       importer and arrives on `/state`'s job as `err`. The Voice row prints
       it verbatim. Never a silent blank. */
    if (c.url && /^https?:/.test(c.url)) {
      var uv = el("button", "sf-verb ghost");
      uv.type = "button";
      uv.textContent = "Use as voice";
      uv.title = "clone a reference voice from this recording — yt-dlp fetches it, "
               + "importvoice cuts and transcribes it, refguard measures it";
      uv.addEventListener("click", function (e) {
        e.stopPropagation(); cloneVoiceFrom(c, uv);
      });
      r.querySelector(".end").appendChild(uv);
    }
    /* §5.8, and the same rule: the BODY selects, the door is the button.
       This row used to open the video on a body click, which meant you could
       not look at what a recording actually IS -- its duration, its host, its
       source -- without leaving for YouTube. `Play`/`Open` above is the door
       and has not moved. */
    r.addEventListener("click", function () { selectCandidate(r, { key: r.dataset.key, cand: c }); });
    return r;
  }
  function shortHost(url) {
    try { return String(url).replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""); }
    catch (e) { return ""; }
  }

  /* the one row that is a QUERY, and it says so in its own words */
  function queryRow(label, url, note_) {
    var a = document.createElement("a");
    a.className = "sf-row r-out sf-query";
    /* SET THE ATTRIBUTE, not only the property. `a.href = ...` reflects into
       the attribute in a browser; a minimal DOM (testkit/minidom.js) has no
       reflection, so a test reading `getAttribute("href")` got null and the
       row's destination was unprovable. One call, both worlds. */
    a.setAttribute("href", url);
    a.href = url;
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    a.innerHTML = '<span class="spine"></span><span class="body">'
      + '<span class="t"></span><span class="q"></span></span><span class="end"></span>';
    a.querySelector(".t").textContent = label;
    a.querySelector(".q").textContent = note_ || "";
    return a;
  }

  function videoLane(box) {
    var vs = videos();
    if (!vs.length) {
      var t = sourceTally();
      var st = S.adapters && sourceState(S.adapters.youtube);
      box.appendChild(queryRow(
        "Search YouTube for “" + S.q + "”",
        videoQueryUrl(),
        st && st.word !== "nothing" && st.why ? "no video came back — YouTube " + st.word + ": " + st.why
          : "no video came back from the search — this opens YouTube's own results"));
      return;
    }
    box.appendChild(mediaRow(vs[0], "video"));
    vs.slice(1, 4).forEach(function (c) { box.appendChild(mediaRow(c, "video")); });
  }
  function webLane(box) {
    var hits = webHits();
    hits.slice(0, 4).forEach(function (c) { box.appendChild(mediaRow(c, "web")); });
    /* the web at large, LAST, and never instead of a hit */
    var a = queryRow("Search the web for “" + S.q + "”",
                     "x-web-search://?" + encodeURIComponent(webQuery()),
                     hits.length ? "everywhere the app does not already cover"
                                 : "nothing specific came back — this is the open web");
    /* the open web is not a new tab: `x-web-search://` is the OS's own
       handler and a target would strand a blank tab behind it */
    a.removeAttribute("target"); a.removeAttribute("rel");
    box.appendChild(a);
  }
  function webQuery() {
    return S.q + COVERED.map(function (d) { return " -site:" + d; }).join("");
  }

  /* ------------------------------------------------------- IN THIS BOOK
     §2.5 of the prompt: `bar/askbar.js` hands a query to `window.TTSTVFind`
     and that lane had no home here. It has one now, and it is the FIRST
     thing offered when there is a book underneath -- because "open a book ->
     search -> find the chapter" (Osca, 8 Sep) starts inside the book you are
     already in, not out on the internet. */
  function findHere(q) {
    var f = window.TTSTVFind;
    if (typeof f !== "function") return false;
    close();
    try { f(q); } catch (e) { return false; }
    return true;
  }
  /* what book, if any, this surface is mounted over. The reader puts the
     slug in its own url (`?book=books/<slug>`) and the host names it too. */
  function openBookHere() {
    try {
      // G-SLUGSIX, 14 Sep: `location.search` is ENCODED, and a slug outside
      // ASCII is `%CE%B9...` here (`%2B` for the `+` a stitched book
      // carries), so the segment is matched as written and decoded after.
      // Six books on the shelf answered `null` to this before today.
      var m = /[?&]book=books(?:%2F|\/)((?:[a-z0-9+-]|%[0-9A-Fa-f]{2})+)/i.exec(location.search || "");
      if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
      var h = window.TTSTVHost;
      if (h && typeof h.currentSlug === "function") return h.currentSlug() || null;
    } catch (e) {}
    return null;
  }
  /* THE SUBJECT: the book a recording would attach to, a chapter would be
     voiced in, and the studio block's choices are about -- what is selected
     in the works column first, the book underneath second. Never a guess:
     if neither is there, the verb is not drawn. It had three names
     (`attachTarget`, `contextBook`, `studioSubject`) for one answer. */
  function subject() {
    if (S.sel && S.sel.slug) return S.sel;
    if (S.inBook) {
      var b = null;
      S.shelf.forEach(function (x) { if (x.slug === S.inBook) b = x; });
      return b || { slug: S.inBook, title: S.inBook };
    }
    return null;
  }
  /* ================================================================ MEASURE
     THE PROOF IS A NUMBER (CLAUDE.md, 5 Sep). Everything the bench and the
     tests read comes out of here, in CSS px, off the live page. */
  function measure() {
    function box(sel) {
      var n = typeof sel === "string" ? sheet.querySelector(sel) : sel;
      if (!n) return null;
      var b = n.getBoundingClientRect();
      return { x: +b.left.toFixed(2), y: +b.top.toFixed(2),
               w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
    }
    var rows = Array.prototype.slice.call(listEl.querySelectorAll(".sf-row"));
    var kinds = { shelf: null, out: null, work: null };
    rows.forEach(function (r) {
      if (r.classList.contains("r-shelf") && !kinds.shelf) kinds.shelf = r;
      if (r.classList.contains("r-work") && !kinds.work) kinds.work = r;
      if (r.classList.contains("r-out") && !kinds.out) kinds.out = r;
    });
    function spine(r) { return r ? box(r.querySelector(".spine")) : null; }
    function title(r) { return r ? box(r.querySelector(".t")) : null; }
    return {
      sheet: box(sheet), field: box(".sf-field"),
      list: box(".sf-list"),
      /* NAMED APART, 8 Sep §4. This was `works:` and so was the works-column
         dict below it -- one object literal, two `works` keys, and JavaScript
         keeps the LAST: the rectangle had been silently dead since the column
         learned to act. Two different things, two names. */
      worksBox: box(".sf-works"),
      rows: rows.length,
      titleLefts: rows.map(function (r) {
        var t = r.querySelector(".t"); return t ? +t.getBoundingClientRect().left.toFixed(2) : null;
      }),
      shelf: { row: box(kinds.shelf), spine: spine(kinds.shelf), title: title(kinds.shelf) },
      out:   { row: box(kinds.out),   spine: spine(kinds.out),   title: title(kinds.out) },
      work:  { row: box(kinds.work),  spine: spine(kinds.work),  title: title(kinds.work) },
      video: videoBox ? box(videoBox) : null,
      /* 8 Sep, and every one of these is a NUMBER the driver asserts on:
         `elsewhere` is what the ELSEWHERE lanes actually drew, `specific`
         is how many of those rows point at a particular item rather than a
         query, and `bestVideo` is the url the Video row opens -- so
         "opens a SPECIFIC result" is checkable rather than describable. */
      elsewhere: (function () {
        var hits = Array.prototype.slice.call(listEl.querySelectorAll(".sf-hit"));
        var qs = Array.prototype.slice.call(listEl.querySelectorAll(".sf-query"));
        return { specific: hits.length, queries: qs.length,
                 bestVideo: videos().length ? videos()[0].url : null,
                 isQuery: /\/results\?search_query=/.test(videoUrl()),
                 webHits: webHits().length };
      })(),
      /* what each source said, folded to its word -- the whole of "a failed
         source must not read as an empty one", as data */
      sources: (function () {
        if (!S.adapters) return null;
        var o = {};
        Object.keys(S.adapters).forEach(function (k) { o[k] = sourceState(S.adapters[k]).word; });
        o.__tally = sourceTally();
        return o;
      })(),
      /* the works column as a live studio: what it drew, and what it can press */
      /* ROUND 2 ITEM 1: THE BAND IS ITS OWN MEASUREMENT NOW. The queue and
         the running job moved out of the right column into the left WORKING
         band, so `works.rows`/`works.bins` below honestly read 0 and this is
         where those numbers live. `works.*` still describes the right column
         -- it is not wrong, it is describing a column that no longer holds
         the queue -- and the tests read whichever they mean. */
      working: (function () {
        if (!listEl) return null;
        var rows = Array.prototype.slice.call(listEl.querySelectorAll(".sf-row.r-work"));
        return {
          rows: rows.length,
          queued: listEl.querySelectorAll(".sf-row.r-work.r-queued").length,
          running: rows.length - listEl.querySelectorAll(".sf-row.r-work.r-queued").length,
          bins: listEl.querySelectorAll(".sf-row.r-work .qx").length,
          logButtons: Array.prototype.filter.call(
            listEl.querySelectorAll(".sf-row.r-work button"),
            function (b) { return /^(log|hide log)$/.test(b.textContent); }).length,
          logsOpen: listEl.querySelectorAll(".sf-log").length,
          head: !!listEl.querySelector(".sf-workhead"),
          hold: (function () {
            var h = listEl.querySelector(".sf-workhead button");
            return h ? h.textContent : null;
          })(),
          steps: Array.prototype.map.call(listEl.querySelectorAll(".sf-row.r-work .s"),
                                          function (n) { return n.textContent; }),
          hues: (function () {
            var seen = {}, n = 0;
            workingRows().forEach(function (r) { if (!seen[r.hue]) { seen[r.hue] = 1; n++; } });
            return n;
          })()
        };
      })(),
      works: {
        /* REPOINTED, NOT LEFT TO READ ZERO (the stood-down lane's handoff,
           collision 2): *"these two counters in `measure()` are now counting
           an empty column and will read 0/0 while the queue is drawn
           perfectly well somewhere else. That is a measurement that has
           quietly stopped measuring."* Right. `rows` and `bins` are what the
           QUEUE is, and the queue is the WORKING band now -- so they count it
           where it lives. `rightQueue` and `cards` are the new numbers for
           "the right column keeps none of it", which is item 1's actual
           claim and is worth a counter of its own. */
        rows: listEl ? listEl.querySelectorAll(".sf-row.r-work").length : 0,
        bins: listEl ? listEl.querySelectorAll(".sf-row.r-work .qx").length : 0,
        rightQueue: worksEl ? worksEl.querySelectorAll(".sf-q").length : 0,
        cards: worksEl ? worksEl.querySelectorAll(".sf-card").length : 0,
        grid: worksEl ? worksEl.querySelectorAll(".sf-gr").length : 0,
        buttons: worksEl ? worksEl.querySelectorAll("button").length : 0,
        log: Object.keys(S.logs).length, sel: S.sel ? (S.sel.slug || S.sel.key || null) : null,
        /* the addendum, as numbers: the file picker's rows, and what the
           voice importer is doing right now */
        choose: S.choose ? { files: S.choose.files.length,
                             rows: worksEl.querySelectorAll(".sf-choose .sf-q").length,
                             title: S.choose.title } : null,
        cloning: S.cloning ? S.cloning.name : null,
        /* §5.8, as numbers: what a body click selected, and the card it drew */
        cand: S.cand ? { title: (S.cand.cand || {}).title,
                         fields: worksEl.querySelectorAll(".sf-cand .sf-fields .k").length,
                         verbs: Array.prototype.map.call(
                           worksEl.querySelectorAll(".sf-cand .sf-verb"),
                           function (n) { return n.textContent; }) } : null,
        unit: S.unit,
        voiceJob: (S.job && S.job.mode === "voice")
          ? { phase: S.job.phase, name: S.job.name, err: S.job.err || "" } : null,
        acting: S.acting, actErr: S.actErr
      },
      /* §4, 8 Sep -- THE STUDIO, AS NUMBERS. Every claim in the report is
         one of these: how many voice cards were drawn, which is lit, how many
         WHERE lanes are pickable and how many are DASHED (never hidden --
         `lanes` is always 3 once /kaggle has answered), the model pills and
         the limits line, and what the sample last said. */
      studio: (function () {
        var st = worksEl && worksEl.querySelector(".sf-studio");
        if (!st) return null;
        function rowOf(label) {
          var rows = st.querySelectorAll(".sf-prow");
          for (var i = 0; i < rows.length; i++) {
            var l = rows[i].querySelector(".pl");
            if (l && l.textContent === label) return rows[i];
          }
          return null;
        }
        function nameOf(n) { return n.textContent.replace(/^[\u25B8\u275A]+/, ""); }
        function counts(label) {
          var r = rowOf(label);
          if (!r) return null;
          return { on: r.querySelectorAll(".sf-pill:not(.off)").length,
                   off: r.querySelectorAll(".sf-pill.off").length,
                   /* THE GLYPH IS A CONTROL, NOT PART OF THE NAME. The
                      selected voice pill carries its own play/pause child, so
                      its textContent starts with one; a label is what the pill
                      SAYS. */
                   sel: (function () {
                     var s = r.querySelector('.sf-pill[aria-selected="true"]');
                     return s ? nameOf(s) : null;
                   })(),
                   labels: Array.prototype.map.call(r.querySelectorAll(".sf-pill"), nameOf) };
        }
        var wr = rowOf("Where");
        return {
          box: box(".sf-studio"),
          rows: st.querySelectorAll(".sf-prow").length,
          voice: counts("Voice"),
          where: counts("Where"),
          model: counts("Model"),
          /* the three lanes, and whether each is drawn at all -- the whole of
             "never hidden", as a number rather than a description */
          lanes: wr ? Array.prototype.map.call(wr.querySelectorAll(".sf-pill"),
                        function (n) { return n.textContent; }).length : 0,
          limits: st.querySelectorAll(".sf-limits span").length,
          refslot: !!st.querySelector("#sfRefSlot"),
          refPlaying: !!(REF_AUDIO && REF_AUDIO.parentNode) && !REF_PAUSED,
          sample: S.sample ? { phase: S.sample.phase, chapter: S.sample.chapter } : null,
          sampleBtn: (function () {
            var r = rowOf("Sample"), b = r && r.querySelector(".sf-verb");
            return b ? { text: b.textContent, disabled: !!b.disabled } : null;
          })(),
          chosenVoice: S.voice, where_now: whereNow(),
          engine: currentEngine(subject()),
          unit: sampleUnit(subject()),
          errs: { voice: S.voiceErr, where: S.whereErr,
                  engine: S.engineErr, sample: S.sampleErr,
                  engines: S.engines.err, kaggle: S.kaggle.err }
        };
      })(),
      chapters: listEl.querySelectorAll(".sf-ch").length,
      inBook: S.inBook,
      live: S.live, base: S.base, bench: S.bench, paired: S.paired || "",
      mockShown: !!(listEl.textContent || "").match(/these rows are the mock/),
      steps: (function () {
        var s = sheet.querySelector(".sf-steps");
        return s ? { cells: s.children.length, box: box(s) } : null;
      })(),
      cfg: { mixed: CFG.mixed, bias: CFG.bias, coarse: CFG.coarse },
      counts: { shelf: S.shelf.length, out: S.out.length,
                work: Object.keys(S.work).length }
    };
  }

  window.SearchSurface = { mount: mount, open: open, close: close, toggle: toggle,
                           ask: ask, draw: draw, measure: measure, cfg: CFG,
                           state: S, STEPS: STEPS, hue: hue, webQuery: webQuery,
                           openBook: openBook, readerHref: readerHref, bar: bar,
                           feed: feed,
                           /* 8 Sep -- the driver and the bench press these
                              rather than clicking pixels, and each one is a
                              thing the acceptance criteria name */
                           selectSlug: selectSlug, videos: videos, videoUrl: videoUrl,
                           videoQueryUrl: videoQueryUrl, webHits: webHits,
                           sourceState: sourceState, sourceTally: sourceTally,
                           nextStep: nextStep, logQuery: logQuery, run: run,
                           needsAlign: needsAlign, nextStepFor: nextStepFor,
                           /* §4, 8 Sep -- the studio's own verbs, so the
                              driver presses the THING rather than a pixel */
                           subject: subject, whereNow: whereNow,
                           currentEngine: currentEngine, sampleUnit: sampleUnit,
                           askEngines: askEngines, askKaggle: askKaggle,
                           pickVoice: pickVoice, pickWhere: pickWhere,
                           pickEngine: pickEngine, sample: sample,
                           toggleRef: toggleRef, voiceWords: voiceWords,
                           sampleFromJob: sampleFromJob,
                           /* the addendum's arc: add (with its file picker),
                              and the seam that clones a voice from a hit */
                           add: add, cloneVoiceFrom: cloneVoiceFrom,
                           /* §5.8 -- the row target, pressable by name */
                           selectCandidate: selectCandidate, select: select,
                           /* Round 2 -- each one is a thing an acceptance
                              criterion names, so the driver presses the
                              function rather than guessing at pixels */
                           workingRows: workingRows, stepLine: stepLine,
                           textAudio: textAudio, candFacts: candFacts,
                           previewOf: previewOf, canPeek: canPeek,
                           hueFor: hueFor, holdAs: holdAs, held: HELD,
                           peek: peek, logQueryFor: logQueryFor,
                           jobLane: jobLane, jobName: jobName,
                           /* Stage 1 step 1: studio.html's panelQueue, as a
                              state of this surface -- pressable by name */
                           askAll: askAll, whereWord: whereWord,
                           kaggleHours: kaggleHours,
                           /* panelSources, as the list's third row state */
                           driveHead: driveHead, driveParsed: driveParsed,
                           bookLangs: bookLangs, pickLang: pickLang,
                           parseHere: parseHere,
                           /* §5.9 -- THE BENCH'S ONE HANDLE ON THE MOCK. The
                              bench is a page, not a second implementation, so
                              it drives the states it wants to look at by
                              editing these and calling draw(). Nothing in the
                              app reads them: with a studio behind the page
                              every one of them is dead. */
                           mocks: { voices: MOCK_VOICES, engines: MOCK_ENGINES,
                                    kaggle: MOCK_KAGGLE, settings: MOCK_SETTINGS,
                                    job: MOCK_JOB, pending: MOCK_PENDING,
                                    groups: MOCK_GROUPS },
                           voiceNameFromTitle: voiceNameFromTitle,
                           elsewhere: elsewhere, api: api, base: BASE,
                           /* the field itself, so a test (and the bench) can
                              read what the bar typed rather than infer it */
                           get input() { return input; },
                           get opened() { return opened; } };

  /* ------------------------------------------------------------ MOUNTED, ONCE
     A surface that MOUNTS needs somebody to mount it, and on the three
     shipped pages that somebody is this line -- so landing it stays "one
     script tag", which is what it was promised to be. `mount()` is
     idempotent (it returns the handle the moment `root` exists), so the
     bench's own explicit `mount({placeholder})` still runs first and this
     finds it already there. */
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { mount(); });
  else mount();
})();
