## HOST_JS gains `TTSTVHost.search(q)` — the reader's Search lands once, on the `-site:` form · 6 Sep (`2b6582a` lib.rs · `3d18d51` shell re-import · this commit: the test + this entry)

**Osca, 6 Sep:** *"Add to HOST_JS, this name and shape exactly, so the reader's Search lands once ... The sheet takes the -site: form (host.js passes {query, web}; use web)."*

### 1. Built
- **`src-tauri/src/lib.rs` `HOST_JS`** — `window.TTSTVHost.search(q)`, the name and shape given (`TTSTVHost.search(q: string) -> Promise<string | null>`: `String(q).trim()`, empty → `Promise.resolve(null)`, else `TAURI.invoke("frank_search", …).then(() => "sheet")`), with one line inside it that the go asked for in words: the sheet takes the `-site:` form, so `COVERED` (the mock's five domains, in its order) and `webQuery()` are carried here — `desktop/src/host.js`'s own two lines — and `frank_search` is invoked on **`{ query: web }`**, the one argument its door reads (`search.rs` `SEARCH_JS`: `open(args && args.query)`; and that file says the exclusions "arrive already in it ... this file never builds, adds to, or trims that list"). The doc comment above the const says why. `TAURI.invoke` is read at the press, so the plugin's wrapper (installed at `load`, after this script) is what answers.
- **Two Rust tests** (`lib.rs` `mod tests`): `the_host_object_calls_its_two_commands_and_nothing_else` (was `…the_one_command…`: `invoke(` count 1 → **2**, both names asserted, `search::CMD` spelled from the constant) and `search_is_the_desktop_hosts_shape_and_the_sheet_takes_the_site_form` (the comment line and the three shape lines verbatim; `COVERED` verbatim; `" -site:" + d`; `const web = webQuery(query)`; **not** `{ query }` / `{ query: query }`; no `location.`, no `window.open`, no `x-web-search:` in HOST_JS — door one is search.rs's).
- **`shell/`** re-imported from TTSTV **`5fbb23c`** (`ttstv-shell-v35`, 51 files, 1,382,490 B): that is the commit where `reader/lookup.js` lost its own `__TAURI__` call and became the one host call this method answers — the "once". It also carried `book-nav.js` + `page.css` (the page zoom) and `settings.js` (Skip is never dead), all committed in TTSTV (its tree was clean but `PROMPTS/`).
- **`tests/search_lands_once.mjs`** — the press, end to end, where cargo cannot reach: serves `shell/` as `webkit_smoke.mjs` does, opens `reader/reader.html` on the first dev book, injects `SEARCH_JS` then `HOST_JS` **read out of the two `.rs` files** (never retyped) over a stand-in `__TAURI__.core.invoke` that records, presses through `window.lookup.search("Tityre")`, and asserts four ways round (below). `--engine webkit` for the Mac.

### 2. Verified — and how
- **unit, Rust** — the two `HOST_JS` tests, extracted by line range (`lib.rs` 266–287 + the two tests, `search.rs`'s `CMD`/`DOOR`/`SEARCH`) into a dependency-free scratch crate in the Cowork container, `cargo test --offline`: **2 passed**. `cargo test` on the crate itself is the Mac's (§4 run sheet).
- **live, Chromium** (Playwright 1.55, container; the shell = TTSTV at `5fbb23c` + the dev book `eclogues-la`) — `node tests/search_lands_once.mjs` → **`search_lands_once: OK`**, 0 page errors in every case:

| case | `typeof TTSTVHost.search` | press | `lastSearch.how` | `#note` | real `invoke` asked | door one (CDP `Page.frameRequestedNavigation`) |
|---|---|---|---|---|---|---|
| 1. no `__TAURI__` (a browser) | absent | `false` | `none` | **"Search needs Frank — this page has no host to open it."** | — | — |
| 2. `__TAURI__` + `SEARCH_JS`, no `HOST_JS` (the shell before `2b6582a`) | absent | `false` | `none` | the sentence, **never a blank** | nothing | nothing |
| 3. `__TAURI__` + `SEARCH_JS` + `HOST_JS` (the phone) | function | `true` | `host` | none | **never `frank_search`** | **once per press**, `x-web-search://?Tityre%20-site%3Agutenberg.org%20-site%3Aarchive.org%20-site%3Ayoutube.com%20-site%3Awikipedia.org%20-site%3Awiktionary.org` |
| 4. `__TAURI__` + `HOST_JS`, no wrapper (the day `frank_search` is a real command) | function | `true` | `host` | none | `frank_search { query: "Tityre -site:gutenberg.org -site:archive.org -site:youtube.com -site:wikipedia.org -site:wiktionary.org" }`, once per press | — |

  In 3 and 4, `TTSTVHost.search("Tityre")` resolves **`"sheet"`** and `TTSTVHost.search("   ")` resolves **`null`**. The door-one URL decodes to exactly `webQuery("Tityre")`; `search.rs::sheet_url` turns that into `SEARCH` + its own `encode` (its existing tests, job 13).
- **live, the Mac VM** — `tools/import_shell.py`: old `shell/` → `_to_delete/shell.1788725067`, 51 files, `prebuild.py --dev` verified, 6 dev books; `shell/reader/lookup.js` md5 = TTSTV's (`9ba053a5…`), `hostSearch` in it ×2 (the old copy: 0).
- Invariants: `HOST_JS` still returns early without `__TAURI__` (case 1: no host object); `PAIR_JS`, `NOW_PLAYING_JS`, `SEARCH_JS` untouched; `git show --stat` = exactly `lib.rs` (`2b6582a`), exactly the manifest + four shell files (`3d18d51`).
- **not verified**: the sheet itself opening on a device — `SFSafariViewController` is iOS-only code and a real press. **The simulator number is Osca's** (§8).

### 3. Judgment calls
- **"this name and shape exactly" vs "use web"** → the shape is his to the character (the comment line, the three lines), and the invoke argument is `web`, built two lines above from `COVERED` — the mock's list, host.js's spelling — because `search.rs` refuses to build it and `lookup.js` sends the bare word. `{ query: web }` rather than `{ query, web }`: the phone's command has one argument (`open(args.query)`), and a second key would be carried and never read.
- **`const` inside a `var`/`"use strict"` IIFE** — kept as given; block-scoped inside the function, fine in every WKWebView the app targets.
- **Re-imported the shell in this job** — "lands once" is two files: the method here and `5fbb23c`'s `lookup.js`; a shell without the second still calls `invoke("frank_search")` itself on the bare word. The re-import is a separate commit so the seam is readable.
- The Rust test that said "one command, one call" now says two; its name changed with it rather than lying.

### 4. Boundary check
IOS-TTS-TV only: `src-tauri/src/lib.rs` (`2b6582a`); `shell.manifest.json`, `shell/reader/book-nav.js`, `shell/reader/lookup.js`, `shell/reader/page.css`, `shell/settings/settings.js` (`3d18d51`, the import's own writes); `tests/search_lands_once.mjs` + this `STATUS.md` (this commit). Nothing in TTSTV; `search.rs`, `build.rs`, `capabilities/default.json` untouched (no new command — `frank_search` is still the wrapper's). Dirty and left alone: `src-tauri/gen/apple/{project.pbxproj, Info.plist, frank_iOS.entitlements}`, `scratch-float/`, `scratch-j13/` (mine: `hostjs_scratch_lib.rs`, the extract), `scratch26b/`.

### 5. Footprint
Container: `/tmp/hostjs` (scratch crate, ~1 MB target), `/tmp/hs` (the harness + a shell copy, ~40 MB) — gone with the session. Mac: `_to_delete/shell.1788725067` (1.3 MB, the previous shell), `scratch-j13/hostjs_scratch_lib.rs` (4 KB). No env, model, SSD, GPU.

### 6. Requests to core / other modules
none — the reader's side landed in TTSTV `5fbb23c` before this and needs nothing more.

### 7. Known gaps
- WebKit not run (no browser in the VM, no WebKit download in the container); `--engine webkit` on the Mac runs cases 1–4 but does not count door one (no CDP there).
- The sheet's own opening is unproved off a device; what is proved ends at the navigation the wrapper asks for.
- `COVERED` now lives in three places (`design/reader/search.html`, `desktop/src/host.js`, `HOST_JS`); a change to the mock's list is three edits. The Rust test pins this copy to the mock's five in order.

### 8. Next
Osca, the simulator: `cargo test` (2 new green), `npx tauri ios dev`, open a book, tap a word, press **Search** → the Safari sheet opens on Google with the `-site:` query; Done returns to the same word. Then, in Safari → Develop → the simulator → Frank: `typeof TTSTVHost.search` → `"function"`. Delete `HOST_JS`'s method? No — delete `SEARCH_JS` the day `frank_search` is a real command (search.rs says so); `HOST_JS` stays as is. Stopping here.

### 8b. Commit check
`git commit -m … -- src-tauri/src/lib.rs` → `2b6582a` (1 file, +65 −6). `-- shell.manifest.json shell/reader/book-nav.js shell/reader/lookup.js shell/reader/page.css shell/settings/settings.js` → `3d18d51` (5 files). This entry + the test: pathspec, two paths. HEAD did not move under me (`dfe7ec8` → mine). Locks: a **319-second-old `index.lock`** (another session's, crashed) moved to `_to_delete/` before the first commit; my own `HEAD.lock` + `next-index-12/-28.lock` moved after each.

### 9. Status line
`IOS-TTS-TV · HOST_JS search 1/1 done · 6 Sep · TTSTVHost.search lands on the sheet with the -site: form, once; 2 rust + 4 live cases; the simulator press is Osca's`

---
