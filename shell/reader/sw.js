// reader/sw.js -- the app shell's cache, and now the books imported into it.
//
// Two kinds of cache, and the difference matters:
//   ttstv-shell-vN        one, versioned, swept on every activate. reader.html,
//                         library/library.html, settings/settings.html, the
//                         sidebar, settings.js, library/unzip+import, the
//                         manifest, the icons, probe.html, voiceui/*.
//   ttstv-book-<slug>-<h> one per imported book, <h> being core.provenance's
//                         book hash. Written by library/import.js in the page;
//                         answered here. NEVER swept by a shell update -- a
//                         reader who updates the app on a train must not lose
//                         the book they are reading, and that is the single
//                         most important line in this file.
//   ttstv-share           the one-entry hand-off for a shared-in .zip (below).
//
// Books are answered cache-first at `<shell>/books/<slug>/...`, which is the
// URL `reader.html?book=books/<slug>` already resolves to, so reader.html and
// sidebar.js are untouched by any of this: they fetch what they always
// fetched and the answer arrives from disk instead of from a server that is
// not there. `.opus` is served through a Range-aware path because a media
// element asks for bytes, not for files.
// v37, 7 Sep: THE SHELL MOVED HOUSE, so the old cache has to be evicted and not
// merely out-voted. Frank loads `clean/` now (`tabs::SHELL`), and on any origin
// that survives a restart -- the PWA, a static host, the bundle -- the worker
// registered at the OLD scope is still installed with `ttstv-shell-v36` full of
// module-tree bytes. Network-first hides that while the network is quick and
// stops hiding it in exactly the case this file exists for: past TIMEOUT_MS the
// fetch loses the race and `shellNetworkFirst` returns `hit`, which would be a
// page out of a tree the app no longer ships. `activate` deletes every cache
// that is not the current SHELL_CACHE, so changing this string IS the eviction
// -- and changing it changes sw.js's own bytes, which is the only thing that
// makes a browser run `install` and `activate` at all.
const SHELL_CACHE = "ttstv-shell-v40";   // 7 Sep: transport.js joins the shell -- a NEW name in
                                         // SHELL_FILES is only fetched by an install, so the
                                         // string has to move or an installed app never caches
                                         // it (v37: the shell moved to clean/)
const BOOK_PREFIX = "ttstv-book-";        // kept in step with library/import.js
const SHARE_CACHE = "ttstv-share";
const SHARE_KEY = "share-bundle";         // one entry, replaced each share

// ---------------------------------------------------------------------------
// SHELL_FILES IS THE APP SHELL, AND IT IS NOW THE ONLY LIST OF IT (4 Sep).
//
// Three lists named the shell and all three disagreed (PROMPTS/
// module-split-manifest.md F.3): this one cached 24 reader files,
// reader/tools/publish_shell.py shipped 30 + 11 design/*, and
// export_bundle.py bundled 19. What that cost: publish_shell.py shipped
// frank.css, frank.js, frank-column.js, keys.js, ../bar/askbar.js/.css and every design/* file to
// the phone, and this worker had never heard of any of them -- so the
// installed app fetched its own face, its column, its wheel and its typing
// guard from a network it may not have, and degraded silently offline.
//
// This list is the authority and the other two READ IT
// (reader/tools/shell_files.py parses this array; publish_shell.py and
// export_bundle.py take their lists from that and restate nothing). The
// reason authority sits here rather than in the Python: a service worker's
// install cannot go and fetch a manifest first -- the fetch that would tell
// it what to cache is the very fetch that fails on the train -- so this list
// has to be a literal in this file, while every other list can be derived.
// Derivation runs one way, so authority sits at the end it runs from.
//
// Paths are relative to this file, which sits in reader/: "./x" is reader/x,
// "../voiceui/x" is voiceui/x, "../library/x" is library/x, "../settings/x"
// is settings/x and "../prefs/x" is prefs/x. sw.js is deliberately NOT here -- a worker
// that cached itself would keep serving the old worker, which is how a PWA
// gets stuck on a version it can never update out of; the browser fetches it
// fresh anyway. publish_shell.py adds that one name back, in one place, and
// says why. Every name here must exist on disk: reader/tests/
// test_publish_shell.py asserts it, which is the test that would have caught
// all of this.
const SHELL_FILES = [
  // ===================== THE PAGE, AND WHAT DRAWS IT ======================
  // 5 Sep, job 15: reader.html IS design/reader/shell.html now, and the six
  // files under it are the design's own -- not a bench copy of them. That is
  // the whole reason this list changed shape: the app used to draw itself
  // from reader.css + frank.css + sidebar.js + oneword.js and now draws
  // itself from tokens/page/pane/shell + book/page/pane/book-nav, which is
  // one implementation shared with design/reader/ rather than two that drift.
  "./reader.html",
  "./tokens.css",            // the palette and the boxes; everything below reads it
  "./wheel.css",
  "./page.css",              // the reading column
  "./pane.css",              // a contents pane, as a solid column
  "./shell.css",             // the shell around them
  "./listen.css",            // ...and the two marks the audio moves (job 15 step 3a)
  "./marginalia.css",       // ...and the four colours a mark wears (job 15b step 2)
  /* JOB 24 LANDED THESE AND NEVER LISTED THEM. reader.html has asked for
     both since the one-word subtitle and its scrub rail arrived; the shell
     did not carry them, so an exported bundle and the phone shell shipped a
     reader.html with two 404s in its head -- one word view with no caption
     and no rail, offline. Found by reader/tests/test_shell_files.py and
     test_export_bundle.py, both of which were already red on it before this
     job touched anything; fixed here because it is one line each and this
     turn is already in this file. */
  "./wordpane.css",         // the one-word caption and its scrub rail (job 24)
  "./scrub.css",            // ...and the rail's own look (9 Sep, with scrub.js)
  "./surface.css",           // THE SEARCH SURFACE: reader.html and library.html
                             // both link it, and the phone opens it from its
                             // own bar -- so it is shell, not a bench prop
  "./chrome.css",            // library.html and settings.html both link it
  "./keys.js",               // typing is not a hotkey -- all three pages load it (3 Sep)
  "./book.js",               // Book.open / Book.normalise
  "./wheel.js",
  "./page.js",               // Page.mount -- the column, the measured boxes, the runhead
  "./scrub.js",              // THE RAIL, 9 Sep. It was never in this list, because
                             // until today the app drew its own rail inside page.js
                             // and scrub.js -- the capsule rail with the bench and a
                             // slider for every number of it -- was mounted by
                             // bench-page.html and by nothing the reader loaded. One
                             // rail now; page.js's half is deleted.
  "./pane.js",               // Panes.measure/apply -- where a pane goes
  "./book-nav.js",           // the axis, the reader, one word
  "./wordpane.js",           // ...and the caption under it (job 24)
  "./listen.js",             // the audio, the highlight, and window.ReaderControl
  "./transport.js",          // ...and THE ONE TRANSPORT over it (7 Sep): the
                             // play/pause/seek/speed both playback bars say,
                             // guarded, so neither bar guesses at listen.js.
                             // reader.html loads it, so an installed app
                             // without it has two bars that do nothing offline.
  "./lookup.js",             // the word under the finger, and voiceui's getDictionaryEntry
  "./marginalia.js",         // the record, re-anchored on listen.js's map
  "./cursor.js",             // one position, written once a sentence (job 15b step 3)
  "./surface.js",            // ...and the surface itself: the query, the one
                             // list, and the works. Both pages load it and the
                             // phone bar's search door calls into it, so an
                             // installed app that had not cached it would open
                             // its own search into nothing, offline.
  // ============================ THE BAR ===================================
  "../bar/askbar.js",        // the bar's answers; the field itself is the shell's (4 Sep)
  "../bar/askbar.css",       // ...and since 5 Sep they are `bar/`'s own, not the reader's:
                             // the bar is on every surface, so it is nobody's page's part
  "../bar/lanes.js",         // the lane strip: one thin band per parse or render,
  "../bar/lanes.css",        // which replaced a banner that could only ever say one
  // ====================== THE OTHER TWO SURFACES ==========================
  "../library/library.html",  // the Library is a surface of its own since 4 Sep (module-split Stage 2b step 1; its page moved there in step 4, 5 Sep)
  "../library/library.css",
  "../library/unzip.js",
  "../library/import.js",
  "../library/transfer.js",   // the door's one client (8cd74ba, 6 Sep) -- the phone needs it offline, beside the two above
  "../library/drive.js",      // Google + the Drive folder (job 26b, 6 Sep): the phone's sign-in and its Sync-through-Drive
  "../settings/settings.html",  // the Settings surface likewise (step 3; its page in step 4)
  "../settings/settings.css",
  "../settings/settings.js",   // and its FORM, cut out of reader/settings.js in Stage 4 (5 Sep) -- only settings.html loads it
  "../prefs/prefs.js",         // THE PREFERENCES STORE: the theme, the interface font, the hotkey grammar and the store itself. A root of its own since Stage 4, loaded in the <head> of all three pages here (and by studio, which the shell does not carry). Every page in this list is broken without it, so it is the one entry no future move may drop.
  "./context.js",              // library.html loads both of these
  "./popover.js",
  // ======================== THE APP'S OWN FURNITURE =======================
  "./manifest.webmanifest",
  "./probe.html",
  "./icon-192.png",            // restored in this commit -- 3e64b7e deleted both
  "./icon-512.png",            // while manifest.webmanifest still named them
  // ========================== HANDS FREE ==================================
  // reader.html loads all nine and boots them once a book is open.
  "../voiceui/app.js",
  "../voiceui/reader-bridge.js",
  "../voiceui/grammar.js",
  "../voiceui/detour.js",
  "../voiceui/resolve.js",
  "../voiceui/answers.js",
  "../voiceui/tts.js",
  "../voiceui/asr.js",
  "../voiceui/trigger.js",
];

// WHAT LEFT THE SHELL IN JOB 15, AND WHY IT IS A SUBTRACTION AND NOT A LOSS.
// Twelve files came out: sidebar.js/.css, oneword.js, memory.js,
// marginalia.js, readercontrol.js, lookup.js, find.js, reader.css, frank.css,
// frank.js and frank-column.js. Not one of them is loaded by any page in this
// list any more -- the new reader.html mounts none of them (job 15 step 3's
// table says which are re-mounted and which are not), and library.html and
// settings.html never did. They were being cached onto every phone for a page
// that no longer exists. They are still on disk and still in git; what this
// list says is only that the SHELL does not ship them. If job 15b re-mounts
// any of them, its own commit adds the name back here, which is the one place
// it has to be added.

// The books/ root, resolved from this script's own URL: sw.js sits in
// reader/, so "../books/" is the same folder reader.html's own
// normalizeBookPath("books/<slug>") lands in. Absolute, so a match is a
// string compare and never a guess about the page that asked.
const BOOKS_BASE = new URL("../books/", self.location.href).href;

function isBookRequest(url) { return url.href.startsWith(BOOKS_BASE); }

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Per-file try/catch, not cache.addAll(): addAll is all-or-nothing, and
    // voiceui/app.js's own require() problem (reader/README.md) or a bundle
    // deployment that never shipped voiceui/* at all must not sink the whole
    // install over one missing file.
    await Promise.all(SHELL_FILES.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) await cache.put(url, res);
      } catch (e) {
        console.warn("[sw] shell file not cached:", url, e);
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k !== SHELL_CACHE && k !== SHARE_CACHE && !k.startsWith(BOOK_PREFIX))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// A book cache is named ttstv-book-<slug>-<hash> and only one may exist per
// slug (library/import.js deletes the others when it finishes writing the new one),
// so "which cache answers this URL" is a scan of the names, not an index
// that could disagree with the caches themselves.
async function bookMatch(request) {
  for (const name of await caches.keys()) {
    if (!name.startsWith(BOOK_PREFIX)) continue;
    const hit = await (await caches.open(name)).match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return null;
}

// A media element asks for a byte range, and a Cache hit is a whole file.
// Safari in particular will not play an <audio> whose server answered 200 to
// a Range request, so the range is served from the cached bytes here. Every
// other request gets the cached response untouched.
async function rangeSlice(res, rangeHeader) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start = m[1] === "" ? size - Number(m[2]) : Number(m[1]);
  let end = (m[1] === "" || m[2] === "") ? size - 1 : Number(m[2]);
  if (!isFinite(start) || start < 0) start = 0;
  if (!isFinite(end) || end >= size) end = size - 1;
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const headers = new Headers(res.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers });
}

/* THE SHELL IS NETWORK-FIRST, NOT CACHE-FIRST (30 Aug).
 *
 * It was cache-first, and the shell cache is only ever refilled by `install`,
 * which only runs when THIS FILE's bytes change. So every edit to
 * reader.html was invisible to anyone who had ever loaded the app once --
 * closing the tab did not help, quitting the app did not help, quitting the
 * host did not help, because none of those clear a Cache Storage entry. Osca
 * lost an afternoon to it (30 Aug: "It's still looking the exact same, why
 * isn't it updated. I closed everything, reopened the app etc"), and the only
 * cure was to bump SHELL_CACHE by hand on every UI change -- a version bump as
 * a build step nobody would remember, in a repo with no build step.
 *
 * Network-first costs nothing where a server is reachable and keeps every
 * offline guarantee: a fetch that fails falls back to the cached copy, which
 * is the whole of what cache-first was buying. `TIMEOUT_MS` is the third case
 * -- a network that is present but crawling (a train, a lift) -- where waiting
 * on the wire is worse than painting yesterday's shell; the fetch is left
 * running and still refreshes the cache when it lands.
 *
 * The cache is keyed on `key` rather than on the request, because a
 * navigation may carry ?left=&right=&ch= that reader.html reads client-side
 * and the shell HTML is the same file whatever they say. */
const TIMEOUT_MS = 2500;

async function shellNetworkFirst(key, request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(key);
  const live = fetch(request).then((res) => {
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  });
  if (!hit) return live;                       // nothing to fall back to: wait
  try {
    const raced = await Promise.race([
      live,
      new Promise((r) => setTimeout(() => r(null), TIMEOUT_MS)),
    ]);
    return raced || hit;                       // null = the timer won
  } catch (e) {
    return hit;                                // offline
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ---- share_target: Files -> Share -> TTS TV posts the .zip here.
  // The POST is answered with a redirect rather than a page, so the browser
  // lands on the Library by a normal navigation (which the shell cache can
  // answer offline) and the Library picks the file up out of SHARE_CACHE.
  // See reader/manifest.webmanifest and reader/PHONE.md for what iOS does
  // and does not do with this.
  //
  // SINCE 5 Sep (module-split Stage 2b step 4) the Library is
  // /library/library.html, OUTSIDE this worker's scope (a worker's scope is
  // its own folder unless the host sends Service-Worker-Allowed, which a
  // static host does not). So this branch names the right page but does not
  // fire on a phone until the worker's home moves -- manifest D1, the decision
  // this file has been waiting on since Stage 1. The strings are kept true
  // so that day is a one-line change here, not a hunt.
  if (request.method === "POST" && url.pathname.endsWith("/library.html")) {
    event.respondWith((async () => {
      try {
        const form = await request.formData();
        const file = form.get("bundle") || form.get("file") || form.get("files");
        if (!file || typeof file.arrayBuffer !== "function") throw new Error("no file in the share");
        const cache = await caches.open(SHARE_CACHE);
        await cache.put(new URL(SHARE_KEY, self.location.href).href, new Response(await file.arrayBuffer(), {
          headers: { "Content-Type": "application/zip", "X-Bundle-Name": (file.name || "bundle.zip").replace(/[^\x20-\x7e]/g, "") },
        }));
        return Response.redirect(new URL("../library/library.html?shared=1", self.location.href).href, 303);
      } catch (e) {
        return Response.redirect(new URL("../library/library.html?shared=failed", self.location.href).href, 303);
      }
    })());
    return;
  }

  // A HEAD for a shell file (reader.html's libraryOnThisHost() asks one, to
  // decide whether to offer "Open the library") must answer offline too, or
  // the installed app hides its own Library the moment it loses the network.
  if (request.method === "HEAD") {
    event.respondWith((async () => {
      const shell = await caches.open(SHELL_CACHE);
      const hit = await shell.match(url.pathname);
      if (hit) return new Response(null, { status: 200, headers: hit.headers });
      try { return await fetch(request); } catch (e) { return new Response(null, { status: 504 }); }
    })());
    return;
  }

  if (request.method !== "GET") return;

  // ---- an imported book: cache-first, and offline it is the only answer.
  if (isBookRequest(url)) {
    event.respondWith((async () => {
      const hit = await bookMatch(request);
      if (hit) {
        const range = request.headers.get("range");
        return range ? rangeSlice(hit.clone(), range) : hit;
      }
      try { return await fetch(request); } catch (e) { return new Response(null, { status: 504, statusText: "not on this device" }); }
    })());
    return;
  }

  // Navigations (reload, typed URL, "Add to Home Screen" launch) may carry
  // ?left=/&right=/&ch= query params reader.html reads client-side, so the
  // fallback copy is matched by PATH only -- a reload with a different query
  // string still finds it rather than going blank, which is exactly the case
  // the offline reload test exercises.
  if (request.mode === "navigate") {
    event.respondWith(shellNetworkFirst(url.pathname, request).catch(() => Response.error()));
    return;
  }

  // Everything else: cache-first, but only against the shell cache -- a
  // shell asset (voiceui/*.js, icons, manifest) requested directly rather
  // than via a navigation. Anything not in the shell cache and not under
  // books/ (dictionary/links.json, a studio endpoint) falls straight
  // through to the network.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Not in the shell at all (dictionary/links.json, a studio endpoint):
    // straight to the network, exactly as before.
    if (!(await cache.match(request))) return fetch(request);
    return shellNetworkFirst(request, request);
  })());
});
