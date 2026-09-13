# IOS-TTS-TV — STATUS

Newest first. `REPORT_PROTOCOL.md` (TTSTV), nine headings. `README.md` says what the repo IS.

---

## K25-PHONE — the phone was already the shape the Mac just changed into; nothing ported · 13 Sep (Cowork, bridge VM only — no simulator, no press, no GPU, 0 GPU-minutes), phone HEAD `5ced2da`

**Status line:** `phone · K25-PHONE measured, NOTHING PORTED, and the real bug is next door · 13 Sep · COST B NEVER EXISTED HERE: one webview at every N (1 builder, label "main", 0 add_child, 0 WKWebView allocs in six .m files, every door location.assign — 10 opens → 11 navigations, 0 surfaces), and an open book is ALREADY a record (ttstv.openBooks 78/236/635 bytes at N=1/3/10) beside wordcursor:<slug>, which is what K25(b) has just built for the Mac. BUT COST A IS ON THE PHONE AND UNFIXED: the shipped shell is 7addad4, 18 of 61 files behind, and shell/reader/page.js is 264 lines against out/shell's 681 with NO G-TYPO and NO K25-a window — so a phone opening the complete Shakespeare mounts 380,382 nodes where the fixed tree mounts 10,195. No Rust changed, one 211-line probe, 3 red controls. The simulator cell is Osca's.`

### 1. Built

**Nothing in the app, on purpose — the second half of the prompt does not fire.** The prompt
said: *"if the phone holds one webview per open book, the same record-not-renderer fix in the
phone's Rust; if it already holds one webview, say so and STOP."* It already holds one webview.
This report is the saying-so, and the phone's Rust is byte-identical to HEAD.

One file was added, and it is the measurement the gate asked for in the currency the phone
actually spends:

- **`tests/open_books_shape.mjs` (new, 211 lines)** — WHAT AN OPEN BOOK COSTS ON THE PHONE. Four
  sections, one JSON line last, exit 1 on any miss, no browser and no pixel. (1) **surfaces**: every
  construct in `src-tauri/src/*.rs` that could make a webview, counted, with the window labels the
  crate names. (2) **doors**: `HOST_JS` read verbatim out of `lib.rs` by the house `rustConst`
  extractor (`doors_are_navigations.mjs`'s, never retyped) and **executed** against a stand-in
  window that records every navigation and every attempt at a surface, then `openReader` called
  once per real slug. (3) **records**: the open-books block of the SHIPPED
  `shell/reader/pbar.js`, lifted by brace-matched line range — found, not numbered by hand — and
  **run** over the same slugs with stub storage, reporting the list length and its bytes at
  1 / 3 / N and what a slide does. (4) **native**: allocations of a webview class in
  `src-tauri/ios/*.m`. Real slugs come off the disk (`../../TTSTV/TTSTV/books` on Osca's Mac, the
  bridge's mount otherwise, `--books` overrides).

### 2. Verified — and how

**Home, said first.** No simulator and no Xcode reach this shell, and CLAUDE.md has no browser
here either, so this is the sanctioned method for the bridge: *extract the function verbatim and
run it against real files on disk — the logic, not the pixels.* **Nothing ran on the Mac, nothing
was pressed, and no number below came off a phone or a simulator.**

`node tests/open_books_shape.mjs` — 10 real slugs from `books/`, **all ok**:

| what | the phone | the Mac before K25(b) |
|---|---|---|
| webview builders in the whole crate | **1** (`lib.rs:2601`) | one per tab, built in `restore` and `activate` |
| `add_child` / `add_content` / `create_webview` | **0** | the tab policy's own |
| window labels the crate names | **`["main"]`**, and it is the only one | one per tab |
| 10 book opens → navigations | **11** (10 books + the library door), all `assign` | 10 webviews |
| 10 book opens → surfaces asked for | **0** | 10 |
| 10 book opens → commands sent | **0** — a door is not a command | — |
| a slide between open books | **1 `location.replace`**, `?book=` decoding to the neighbour | a tab switch |
| webview allocations in `src-tauri/ios/*.m` (6 files) | **0** | n/a |
| **renderers at N = 1 / 3 / 10** | **1 / 1 / 1** | 6 / 8 / 35 procs, 458 / 812 / 2,034 MB |
| **what an open book costs instead** | `ttstv.openBooks` at **78 / 236 / 635 bytes** for N = 1 / 3 / 10 — **63.5 bytes a book** | 94.7 MB a webview (`floor`) |

- **The record already exists on the phone, and it is the same record.**
  `shell/reader/pbar.js`'s own comment: *"Open books: an ordered list kept across launches …
  Frontend state only — no Rust."* One `localStorage` key, `[{slug, title}]`, front first —
  **the same key, the same shape and the same order K25(b) taught `tabs.rs` to write**
  (`ttstv.openBooks`, `library/library.html:2495`). Run: 10 opens → 10 records, front is the
  newest, re-opening a book already open **moves** it and does not add one (still 10), and the
  slide marks `ttstv.openBooks.slid` so the order stands.
- **And the other half of the record is there too.** `shell/reader/book-nav.js:1322`
  `cursorKey() { return "wordcursor:" + slug; }` and `shell/reader/cursor.js`'s `^wordcursor:` —
  the per-book ledger K25(b) discovered it did not need to build. So the phone has held
  BOTH halves of the Mac's new design since before the Mac had either.
- **Three red controls, each pinning a different rule** (a copy of the crate, the six `.m` files
  and `pbar.js` in the VM's own scratch, never in the repo). **A**: a second
  `WebviewWindowBuilder::new` and an `add_child` appended to `lib.rs` → 2 MISS and the verdict
  flips to `one-webview-per-book`. **B**: `go`'s `window.location.assign` swapped for
  `window.open` → 5 MISS, `doorNavigations` 11 → 0 and `doorSurfaces` 0 → **11**. **C**: the two
  lines that keep the record deleted from `pbar.js` → 5 MISS, `recordsAt` `{1,3,10}` → `{0,0,0}`.
  So none of the three claims is asserted by accident.
- **AND THE COST THE PHONE *DOES* HAVE, found while checking the prompt's own read-first note.**
  That note says *"the window is in the shared reader and already on the phone via the shell"*.
  **It is not.** `shell/reader/page.js` on the phone is **264 lines** against `out/shell/reader/page.js`'s
  **681**, and `grep -c` on it gives **0** for `G-TYPO` and **0** for `const NEAR` — neither half of
  Cost A's fix (`4d4526b` G-TYPO, `26b65ee` K25-a's window, `f64c83b`) is in the shipped shell,
  because the shell was imported at `7addad4` and both landed after. So on the phone as it would
  build today, the book **you are reading** still mounts whole: K25-a's own `shape` numbers for the
  complete Shakespeare at N=1 are **380,382 DOM nodes / 1,643 MB / 7,322 ms to open** without the
  window and **10,195 / 556 MB / 1,066 ms** with it. That is the cost K25-a called *"already broken
  at N=1"*, it is the one cost a single-webview device cannot dodge, and the fix is not a port —
  it is `tools/import_shell.py`. §6.
- **not verified** — the simulator cell (`npm run -- tauri ios dev "iPhone 17"`, memory and
  renderer count at 393×852), `cargo test`, and any press. §8 is Osca's. There is no "after" to
  measure because nothing changed.

### 3. Judgment calls

- **STOP, and no port.** The prompt's own gate. Porting `LIVE_READERS` here would mean inventing
  the disease first: there is no second surface to discard, so `keep_live` / `to_discard` /
  `discard` / `revive` would each be a function over a set that is always empty, and
  `enforce_live` a no-op with a comment. The right size of this lane is a measurement and a
  sentence.
- **Measured by running, not by grepping.** A grep for `window.open` is what
  `cargo test` already does (three assertions in `lib.rs`, §2 of G-LOOKUP3). What it cannot do is
  say what happens when a door is *pressed*: the probe executes `HOST_JS` against a stand-in
  window and counts what the window was asked for. That is why control B is worth having — it
  changes behaviour without changing any count a grep makes.
- **The SHIPPED shell, not the module tree.** The record block was lifted from
  `shell/reader/pbar.js`, the copy that goes into the `.ipa`, not from TTSTV's `reader/pbar.js`.
  The two differ (§6) — but only from line 465 down, so the lifted block (113–159) is
  byte-identical in both and the finding is not affected by the drift.
- **The probe lives in `tests/`, next to `doors_are_navigations.mjs`,** and reuses that file's
  `rustConst` verbatim rather than inventing a fourth extractor. It is not wired into
  `prebuild.py` or any suite: it answers a question that has now been answered, and it is here so
  the answer can be re-taken in one command if the crate ever grows a second builder.

### 4. Boundary check

This lane's module is the phone repo (`TTSTV_IOS`). **One file written: `tests/open_books_shape.mjs`
(new), plus this `STATUS.md` entry.** No second folder. `src-tauri/` is untouched — `git diff` over
`src-tauri/src/` is empty and the two `git add` paths do not name it.

**Not mine and not touched:** `desktop/src-tauri/src/tabs.rs` (the Mac's), the shared reader
(`shell/**`, and TTSTV's `reader/**`) — read and lifted from, never written. TTSTV is written to in
exactly one place, the one line under `## Inbox` in `PROMPTS/INTENT.md` the standing rules ask for.

**Other lanes were dirty throughout, and the set GREW under this session** — a speech lane's
`src-tauri/src/{lib.rs,speech.rs}`, `src-tauri/build.rs`, `src-tauri/ios/FrankSpeech.m` and
`capabilities/default.json` appeared between the census and the commit, on top of
`shell/reader/{reader.html,surface.js,sw.js,transport.js}`, `shell/reader/sysvoice.js`,
`shell.manifest.json`, `src-tauri/gen/apple/**` and the whole of `scratch-lookup/` — **21 paths,
all left unstaged**. That matters because `lib.rs` is where the census counts builders, so **the
whole probe was re-run against `HEAD` alone** (every `src-tauri/src/*.rs` and `src-tauri/ios/*.m`
written out with `git show HEAD:<path> >` into the VM's scratch, 7 `.rs` and 5 `.m`, no
`speech.rs` and no `FrankSpeech.m`): **identical JSON line, all ok, verdict `one-webview`**. So no
number here rests on another lane's uncommitted work. The shell-drift count in §6 is the one
figure that is a working-tree count, and it is a working-tree count on purpose — it describes what
would be built today.

**The loop does not apply.** Nothing this lane wrote has a master in `design/`, nothing is in
`reader/sw.js`'s `SHELL_FILES`, and `export.py --shell` / `publish_shell` were **not run** — which
would have been a mistake anyway with four shell files dirty in this repo and more in TTSTV
(CLAUDE.md, 7 Sep). `clean/` is unchanged by this lane.

### 5. Footprint

| file | lines | what |
|---|---|---|
| `tests/open_books_shape.mjs` | +211 (new) | the four-section probe and its JSON line |
| `STATUS.md` | +this entry | the report |

No source file changed. No file deleted, no file moved, no dependency added — the probe is
`node:fs/promises`, `node:path` and `node:url`, nothing installed.

### 6. Requests to other modules — and one for Osca

- **THE ONE THAT MATTERS, and it is bigger than the question this lane was asked: the phone is
  shipping a stale shell, and Cost A's fix is in the part that is stale.**
  `shell.manifest.json` says `source.commit` **`7addad4`**, and against TTSTV's `out/shell/` as it
  stands **18 of the 61 shell files differ**: `reader/{book-nav,page,transport,listen,pbar,sysvoice,scrub,sw}.js`,
  `reader/{reader.html,shell.css,page.css,pbar.css,listen.css}`, `settings/settings.js`,
  `library/{library.html,library.css}`, `voiceui/{tts,app}.js`. The two that matter, measured:
  **`page.js` 264 lines against 681**, with no G-TYPO and no K25-a window (§2) — the reading book
  mounts whole, 380,382 nodes on the complete Shakespeare; and **`pbar.js` 60 lines behind in two
  hunks**, missing the 11 Sep light/dark long-press, so a long press on the ⚙ does nothing on the
  phone. Four of the eighteen are dirty in the working tree right now, so an import looks
  half-done. `tools/import_shell.py`, then `tools/prebuild.py`, then re-stamp the manifest, before
  anything is built for the 13th. **Not done here** because the shared reader is explicitly not
  this lane's, and because rewriting 18 shell files while four of them are another lane's
  uncommitted work is the exact sweep the pathspec rule exists to prevent.
- **And the read-first note in `PROMPTS/lanes/wave-4.md` chat 60 should be corrected when someone
  next edits it** (not by me — INTENT.md's rule is one Inbox line and nothing else). It says the
  window *"is already on the phone via the shell"*; it is not, and that is the finding, not a
  quibble: had it been true, this lane would have had nothing to report at all.
- **For chat 34 (K25 fix (a)):** the Mac's remaining cost — two large books live at once
  contending on `page.js::render()` and `placeAxis()` — **cannot arise on the phone**, because two
  are never live. But the single-book half of (a) is the phone's whole story, and it is the fix
  that has not reached it (above). Nothing for that lane to build; everything for whoever runs the
  import.
- **For chat 17 / G-MEMORY, the mirror of K25(b) §6's finding.** K25(b) found the Mac's ledger
  cannot survive a launch: the studio port changes every launch, an origin includes its port, and
  `localStorage` belongs to the origin. **The phone's origin is `frank://localhost`
  (`lib.rs::shell_origin`) — a custom scheme with a fixed host and no port** — so on the phone
  `wordcursor:<slug>` and `ttstv.openBooks` DO survive a launch, which is what `pbar.js`'s "kept
  across launches" is relying on. The phone is therefore the platform where C4 already works, and
  the Mac's mirror to `TTS_DATA` is the Mac's problem alone.
- **Nothing asked of `core/`.**

### 7. Known gaps

- **No simulator number, and none is claimed. The reason is on file, in this same STATUS.md,
  from today.** T-SIM (13 Sep, three entries below) established two things at first hand: the
  simulator CAN be driven from this shell, and **the only Frank installed on any simulator is a
  pre-11-Sep build** — it has no `sysvoice.js`, no `668142a`, an empty shelf — because
  `npm run -- tauri ios dev "iPhone 17"` must be typed into a macOS terminal and Terminal resolves
  at `click` tier here. So a run today would have measured a build older than the shell it ships,
  and reported it as the phone. What is claimed instead is the count of things that could make a
  renderer, which is 1 at every N and cannot be otherwise. And if the simulator ever shows memory
  climbing with N, it will not be renderers — it will be the one document's own growth, which is
  §6's stale `page.js`.
- **The probe stands in for the engine, not for the phone.** It runs `HOST_JS` in node against a
  stand-in window; WKWebView's real refusal of `window.open` is what makes the doors necessary in
  the first place, and `tests/doors_are_navigations.mjs --engine webkit` on the Mac is where that
  is proved end to end. This adds the N-deep half that file does not do.
- **`?book=books/<slug>` has two spellings.** The door builds `?book=books/<slug>`; the slide
  builds it through `URLSearchParams`, which percent-encodes the separator —
  `?book=books%2F<slug>`. Both decode to the one value the reader reads, and the probe asserts the
  DECODED value so neither can drift into meaning something else. Nobody has asked for one
  spelling.
- **Audio across a book change is untouched.** K25(b) §7 booked the Mac's version of this (a
  discarded book's playback stops). On the phone a book change is a navigation, so the document
  goes and its audio with it — which is what `FrankAudio.m`'s background session is for, and it is
  G-FLOAT's question, not this one. Not measured here.
- **The 43 shell files that match `out/shell/` were compared by bytes, not by meaning**, and
  `out/shell/` itself is TTSTV's working tree, not its HEAD.

### 8. Next

**Osca — there is nothing to build and nothing to press for THIS lane, and one thing to do about
the lane next to it (§6: `tools/import_shell.py`).** If you want the cell in your own hand, it is
the run the prompt named — but note T-SIM's finding first: the Frank sitting on the simulator is
pre-11-Sep, so the command below is what makes the measurement mean anything, not an extra:

    npm run -- tauri ios dev "iPhone 17"
    # then, in the simulator: open a book, back to the Library, open another, ten times.
    # Xcode ▸ Debug navigator (or Instruments ▸ Activity Monitor) on the frank process.

What to look for, in order:

1. **One process and one WebContent renderer, at one book and at ten.** The number that would be
   a bug is a second WebContent appearing as you open books.
2. **Memory roughly flat** across the ten — the tenth book costs what the first did, because the
   ninth is gone with its document.
3. **The Library's first band** lists the ten, newest first (that is `ttstv.openBooks`, the
   63.5 bytes a book above).
4. **The bar's slide** walks them without reordering them, and lands on the word you left.

And in this shell, any time: `node tests/open_books_shape.mjs` — one JSON line, exit 0.

The real question this lane leaves you is §6's first bullet: **the shell on the phone is
`7addad4`, 18 files behind.** That is a bigger deal for the 13th than anything about renderers.

### 8b. Commit check

**`4ae2cd1`**, one pathspec commit, `-F` from a message file in the session home, **two paths named
on the line**: `tests/open_books_shape.mjs` and `STATUS.md` (and a second, **this section's own**,
for the hashes and the Inbox line). `git add --` for the one new file first — a pathspec refuses an
untracked path. `git show --stat HEAD` confirmed **exactly those two**: STATUS.md +206,
open_books_shape.mjs +211 new — 417 insertions, 0 deletions, and **no `src-tauri/` path in the
commit at all**, which is the whole claim of this lane. No `git add -A`, no `-a`, no `--amend`;
`GIT_OPTIONAL_LOCKS=0` on every git call. Nine other paths were dirty from other lanes (§4) and
every one was left unstaged.

**Locks — two moved to `_to_delete/`, and Osca clears them** (`rm _to_delete/*.lock.*`). Git
printed *"unable to unlink"* for `.git/HEAD.lock` (0 bytes) and `.git/next-index-9.lock` (21,265
bytes) after the commit took — the bridge refusing a delete inside the repo — and `HEAD.lock` left
in place breaks every later git command in the tree, so both were moved on CLAUDE.md's rule, both
over 3 s untouched, as `*.<epoch>`. Also refused and LEFT where they are, because they are git's
own temporaries and not locks: five `.git/objects/*/tmp_obj_*`. `_to_delete/` already held 22 from
earlier lanes.

**The co-edited-file trap, and how it was dodged.** `STATUS.md` is this repo's `design/ship.py`:
G-INBOX's own §8b records another lane's commit taking its whole entry from the working tree, and
its advice was *"when your entry is long, commit it FIRST and by itself"*. This entry is 206 lines,
so `git status --short STATUS.md` was read immediately before each of the two commits and the file
was clean of any other lane's edit both times.

**The controls were built in the VM's own scratch (`$HOME/ctl`), never in the repo** — a copy of
the six `.rs`, the six `.m` and `pbar.js`, ~300 KB, outside every mounted folder, deleted at the
end. Nothing was written to `~/Desktop`, nothing to `books/`; no server was started and no route
pressed, so `languages/catalogue.json` was never at risk.

**HEAD was `5ced2da` at the gate and did not move under this session** — `git log 5ced2da..HEAD`
was empty until this lane's own commit.

### 9. Status line

`phone · K25-PHONE: the phone was ALREADY the shape K25(b) just gave the Mac — one webview at every N (1 builder, label "main", 0 add_child, 0 WKWebView allocs in six .m files, 10 opens → 11 navigations and 0 surfaces), an open book already a record in ttstv.openBooks (78 / 236 / 635 bytes at 1 / 3 / 10) beside wordcursor:<slug> · NOTHING PORTED, no Rust changed, one 211-line probe and 3 red controls · and the finding that matters is next door: the shipped shell is 7addad4, 18 of 61 files behind, shell/reader/page.js 264 lines against 681 with NO G-TYPO and NO K25-a window, so the book you are reading still mounts whole (380,382 nodes vs 10,195 on the complete Shakespeare) — Cost A is live on the phone and the fix is an import, not a port · the simulator cell is Osca's`

---

## G-INBOX — the inbox is a row, and the row finishes · 13 Sep (Cowork, bridge VM + container), phone `6f0f199` (no GPU, 0 GPU-minutes)

**Status line:** `phone · G-INBOX built · 13 Sep · road one SHIPS: a PDF copied into Frank is a row on the shelf that says "Awaiting a parse", a tap sends it to the paired Studio's own POST /upload, and the row goes. Road two is OUT of project.yml and behind gen/apple/FrankShare/road-two.yml, which xcodegen never reads; nothing the 13th signs carries an App Group. THE ONE THING THAT BLOCKS THE LAST PRESS: /upload is not in studio/serve.py::_SYNC_STUDIO, so a paired phone gets a 404 today — and the row says exactly that in words. Owed: xcodegen, cargo test, the build, Osca's Safari press.`

### 1. Built
`src-tauri/src/inbox.rs` (473 → 976 lines): the hand-off. `UPLOAD`, `kind_for` (pdf/epub, and a sentence for a third), `upload_url` (`<base>/upload?name=&kind=&t=`, every value through `pull::enc`, an address that is not http(s) refused before any fetch), `sent` (Studio's answer as the row's state and sentence, one per code), the `Post` trait and `Net` (ureq, the crate's one client shape with the write timeout widened), `payload_in` (lifted out of `rows_nested`, so the row and the send can never disagree about which file an item IS), `item_file`, `send_file`, `drop_item`, and the two commands `inbox_send` / `inbox_drop`. Ten new tests; the group-id test now reads five files.
`src-tauri/src/lib.rs`: `INBOX_JS` (+~230 lines) — `window.TTSTVHost.inbox` (`list`/`send`/`drop`/`refresh`) on every page in Frank, and on `/library/library.html` **the row**: its own `<section id="frankInbox">` inserted ABOVE `.shell`, its own `<style>`, three states on `data-state` (`waiting`, `sending`, `stuck`), a tap that reads `ttstv.sync.pair` and never writes it, a drop after a 200 and one line left where the row was, and a re-list on `visibilitychange`/`pageshow` — the case that matters, because a person arrives here from Safari's share sheet. Registered (`generate_handler!`), injected after `HOST_JS`. Two tests.
`src-tauri/build.rs` + `capabilities/default.json`: the two commands declared and granted (`allow-inbox-send`, `allow-inbox-drop`), and the capability's description says what each can reach and what it cannot.
`src-tauri/gen/apple/project.yml`: **road two cut out whole** — the `- target: FrankShare` dependency and the `FrankShare` target, replaced by a note saying where they went. Road one (three `CFBundleDocumentTypes`, `LSSupportsOpeningDocumentsInPlace: false`, `UIFileSharingEnabled: true`) is untouched and is now the whole of what this spec generates.
`src-tauri/gen/apple/FrankShare/road-two.yml` (new, 130): the two blocks verbatim, the App Group it would need, and the four edits that turn it back on.
`src-tauri/gen/apple/{frank_iOS/frank_iOS,FrankShare/FrankShare}.share.entitlements` (new): the group, in the two files nothing signs today. The two real `.entitlements` are committed `<dict/>`.
`tests/test_inbox.py` (new, 11 tests) and `tests/inbox_row.mjs` (new, 286 lines).

### 2. Verified — and how
**unit, container** — `src/inbox.rs` lifted whole into a scratch crate (real `serde_json`, `log` and **`ureq 2.12.1`**, so the `Post for Net` impl really compiles; the three `#[tauri::command]` attributes stripped; `pull::enc` extracted by regex from `pull.rs` and used verbatim): **18 passed, 0 failed, 0 warnings** (was 9 at C2/K8). **8 RED controls, each one red, and green again after:** a `.txt` allowed through · the file name not percent-encoded in the URL · the 404 sentence made vague · a kind Studio cannot parse sent anyway · a `.part` counted as a payload · the id guard removed · a 200 not reported as ok · a typo in one of the `.share.entitlements`.
**the row, container, Chromium** — `tests/inbox_row.mjs` serves the REAL `shell/` and injects `INBOX_JS` read out of `lib.rs` (never retyped) over a stand-in `invoke`: **all passed, 38 assertions, 7 blocks, 0 page errors, 0 pages opened.** The rectangles, since a proof is a number: the strip is `top 0, bottom 182, height 182` and `.shell`'s top is `182` — **0 px of overlap**, and it is not a descendant of `#shelf` (`shelf.contains(box)` false, `compareDocumentPosition` says it precedes `.shell`). `#shelf.innerHTML = ""` and the row is **still connected with both rows** — which is the whole reason it is not in the rail. Unpaired: `data-state` `stuck`, the sentence names Settings ▸ Transfer, and **0 `inbox_send` calls**. Paired with a 404: `stuck`, the sentence carries `/upload`, both rows still there, **0 `inbox_drop` calls**, and send was given exactly `{id, via, base, token}`. Paired with a 200: `sending` while it runs, then `drop({id, via})`, the row gone, and the line `Walden.pdf is with Osca's Studio — it will arrive with the next Sync.` Two waiting and one sent: the other keeps its row and the caption reads `Inbox · 1 waiting`. No `__TAURI__`: no door and no row.
**unit, bridge VM** — `python3 -m pytest tests`: **106 passed, 4 failed, 1 skipped**. 95 + my 11 = 106, and **the four failures are the same four names C2/K8's entry records** (`test_pair_link`'s scheme one, two `test_phone_loop` PATH ones, `test_phone_shell`'s `scratch26b` one); `test_pair_link`'s is a Google redirect scheme in `tauri.conf.json` and touches nothing of mine.
**schema** — `project.yml` parses under `yaml.safe_load` and holds **one** target, with `libapp.a`, AVFoundation and SafariServices all still on it; `road-two.yml`'s two blocks each parse into XcodeGen's own shape (`[{target, embed, codeSign}]` and `{FrankShare: {type: app-extension, …}}`); all four entitlements parse as plists; `capabilities/default.json` re-parses as JSON.
**A MEASUREMENT, AND IT IS NOT MINE** — `gen/apple` was found dirty from Osca's generate-and-build, and two things in it are facts: `frank_iOS/Info.plist` **came out of `xcodegen generate` with `CFBundleDocumentTypes` in it**, so road one survives the round trip (C2/K8's gate 1, answered); and **both** `frank_iOS.entitlements` and `FrankShare.entitlements` came back `<dict/>` — the App Group string gone from each, which C2/K8 §7 predicted for the app's file (`tauri-plugin-deep-link`'s build script) and did not predict for the extension's. I did not watch it happen and I do not claim the cause. What it means is the same either way: an entitlement that a build removes by itself is not one to ship a date on.
**NOT VERIFIED, and none of it should read as verified:** `cargo check`/`cargo test` on the real crate, `xcodegen generate` after MY edit to `project.yml`, any build, and **anything at all on a phone or a simulator**. The bridge shell is a Linux VM with no Xcode, no `xcodegen`, no `cargo`. `inbox_row.mjs` ran on **Chromium only** — `--engine webkit` is the phone's engine and is Osca's Mac. Nothing was sent to a real Studio: every send in every test went to a recorder.

### 3. Judgment calls
- *Which Studio route parses an inbox item* → **`POST /upload`, and not `/run`.** `/run {slug, chapter, step}` parses a book the Mac ALREADY has; an inbox item is a file the Mac has never seen. `library/routes.py::handle_upload` takes `?name=&kind=epub|pdf` with the file as the raw body, writes it to a sibling `.part` and `os.replace`s it, then starts the whole ingest (parse, attrib, dictionary, grammar) on the one job slot. So one call is the entire hand-off, and it is the only route that is.
- *Road two behind a flag* → **a file XcodeGen never reads, not an `include:` spec.** The tempting shape was `project-share.yml` with `include: [project.yml]`, and I cannot run XcodeGen here to prove how its include merges an ARRAY: if `dependencies` replaces rather than appends, the app loses `libapp.a`, AVFoundation and SafariServices, and it loses them on ship day twenty minutes into a build. `road-two.yml` costs a paste and cannot cost that.
- *Where the row lives* → **an init script, above `.shell`.** `shell/` is imported byte for byte from TTSTV and is never edited by hand, and TTSTV is not this lane's; a row typed into either would be wrong in a different way. And it hangs ABOVE the rail rather than inside it because the page re-renders `#shelf` — proved by emptying it in the test.
- *The bytes go up from Rust, not from the page* → the file never crosses into JavaScript (a 40 MB epub through `invoke` twice is nothing anybody needs), there is no ATS or CORS question to answer, and `ureq` is already the crate's client.
- *When the row goes* → **after a 200 and not before.** On a 200 the bytes are on the Mac in `TTS_DATA/sources`, which is a write-once landing spot, so the phone's copy is then the second copy of a file that is already kept. On anything else nothing is dropped, and the test holds that at 0.
- *A `.txt` lands and cannot be parsed* → **it still gets a row, and the row says so.** Road one declares three document types on purpose (a phone that refuses a share at the sheet teaches nobody anything); Studio takes two. F10 is a sentence, never silence, and "Studio parses a PDF or an EPUB, and notes.txt is neither — it is waiting here and nothing has been lost" is the sentence.

### 4. Boundary check
`src-tauri/src/inbox.rs`, `src-tauri/src/lib.rs`, `src-tauri/build.rs`, `src-tauri/capabilities/default.json`, `src-tauri/gen/apple/project.yml`, `src-tauri/gen/apple/FrankShare/road-two.yml`, the two `*.share.entitlements`, the two `*.entitlements`, `tests/test_inbox.py`, `tests/inbox_row.mjs`, and this file. **Not a move and not a re-wire — the single-folder confirmation stands** (`gen/apple` is `src-tauri`'s own generated project, not a second module). `src/lib.rs` is named here because **G-TOPUP owns that file when it runs**: the change to it is one `pub const`, one `.initialization_script` line, two handler lines and two tests. `pull.rs` was READ (`enc`, `Net`'s timeouts) and not touched. TTSTV was read and **not written** — `studio/serve.py`, `library/routes.py`, `studio/sync.py`; the one thing I want there is §6, in words, for its own lane.
**Found dirty and left alone:** `shell/reader/{reader.html,surface.js,sw.js,transport.js}` + `shell/reader/sysvoice.js` (another lane's import), `shell.manifest.json`, `scratch-lookup/*`, and — the ones that matter — `src-tauri/gen/apple/{frank.xcodeproj/project.pbxproj,frank_iOS/Info.plist,frank.xcodeproj/…/frank_iOS.xcscheme}` and the untracked `FrankShare/Info.plist`, all **generated output from Osca's own `xcodegen generate`**. They are stale against my `project.yml` by design and the next generate is what settles them; committing another actor's generated tree from this shell is not mine to do.

### 5. Footprint
Nothing on the SSD; the depot was not read. In the container: a scratch crate (`scratchpad/inboxcrate`, ~180 MB with `target/` and ureq's tree), a served copy of `shell/` and one `npm i playwright`, all gone with the session. On the bridge VM: `pip install --user pytest pyyaml`. In the repo: nothing new outside the files in §4; no `_to_delete/` this session. No models, no downloads, no venv. **Nothing was sent to any Studio, and no server was started** — `paths.LANGUAGES`/`TTSTVDATA_HOME` never came up because nothing here imports `studio.serve`.

### 6. Requests to core / other modules
**ONE, and it is the last press of B3.19.** `studio/serve.py::_SYNC_STUDIO` is six routes; **`("POST", "/upload")` is the seventh this needs**, and the block above that set already names it: *"POST /upload (library) WANTED eventually — a file off the phone. Cost: an unbounded multipart body on the LAN listener, which nothing here is shaped for yet."* Two things about that cost, from having read `handle_upload`: **it is not multipart** — it is `?name=&kind=` in the query and the raw body with a `Content-Length`; and it already refuses an empty body (400), writes to a sibling `.part`, `os.replace`s only when the last byte is down, and answers "the file on disk was not touched" on a short one. What is genuinely missing is a CEILING on `Content-Length`, and that is a line in `handle_upload`, not a shape. Until somebody types that route into the set, a paired phone gets a 404 — the phone is finished, says so in words, and waits.
For whoever drains the inbox next: the row shape is unchanged (`{id, via, title, url, kind, at, file, bytes}`), and `inbox_send`/`inbox_drop` take `(id, via)` from it. Please take a row by `id`.

### 7. Known gaps
- **`/upload` is shut, so the last step of B3.19 cannot pass today** whatever Osca presses. Everything up to it can: the share, the row, the sentence, the tap, and a 404 that says why in English.
- **Road two is unverified as a paste.** `road-two.yml`'s blocks parse, and that is all that is proved; nobody has run `xcodegen generate` with them back in. It also still does not answer whether a free personal team signs the App Group — and on 13 Sep something in the generate-and-build removed that key from both entitlements files by itself (§2), which is a second reason not to ship on it.
- **No progress on a big file.** `inbox_send` is one blocking POST; the row says "Sending to <Studio>…" and nothing more until it answers. A 40 MB epub over a phone's Wi-Fi will sit on that sentence for a while.
- **Nothing tells the row the parse finished.** Studio answers as soon as the ingest STARTS; the book arrives by Sync later. The line left behind says that in words, and the phone never polls.
- `inbox_row.mjs` has run on Chromium and not on WebKit. `cargo check` has still never been run on this crate here, and the `extern "C"` block and the two iOS roots have still never been compiled by anything.
- A `.txt` in the inbox can never leave it by this road. It says so; it is still a row that stays.

### 8. Next
**Osca, and the first two are the gates:**
1. `cd src-tauri/gen/apple && xcodegen generate` — the `FrankShare` target should **disappear** from `frank.xcodeproj/project.pbxproj`, and `frank_iOS/Info.plist` should still come out with `CFBundleDocumentTypes` in it. (Both files are dirty right now with the PREVIOUS generate's output; this is what settles them.)
2. `cd src-tauri && cargo test` — 18 inbox tests plus the two in `lib.rs`.
3. Build to the phone. The log line to read is still `frank: inbox documents = … -- N waiting`; the group line should now say *the entitlement is absent or unsigned*, and that is expected and correct.
4. Safari → a PDF → share sheet → **Copy to Frank** (road one; there is no "Frank" row of its own and there should not be). Open Frank: the Library should carry a strip above the shelf reading **Inbox · 1 waiting** and **Walden.pdf — Awaiting a parse**. Tap it. Unpaired it names Settings ▸ Transfer; paired it will say the `/upload` sentence until §6 lands.
5. `node tests/inbox_row.mjs --engine webkit` on the Mac, which is the only place the phone's engine runs.

Then stop.

### 8b. Commit check
`6f0f199` (12 files) — every path on the commit line, `GIT_OPTIONAL_LOCKS=0` on every git call, `git add --` for the five new paths, no `-a`, no `-A`, no `--amend`. `git show --stat HEAD` lists exactly the twelve meant: `inbox.rs`, `lib.rs`, `build.rs`, `capabilities/default.json`, `project.yml`, `road-two.yml`, the two `*.share.entitlements`, the two `*.entitlements`, and the two tests. The first attempt died on `HEAD.lock` + `index.lock`; the lock-retry loop's second pass landed it, and **20** lock files are named in this repo's `_to_delete/` (every entry stamped 1789331905 or later: `HEAD.lock` ×6, `index.lock` ×4, `next-index-*.lock` ×10) plus **2** in TTSTV's (`HEAD.lock.1789332058`, `next-index-48.lock.1789332058`), for Osca to clear — along with the standing `.git/objects/*/tmp_obj_*` residue this shell cannot unlink. **No lock was left behind in either repo:** `.git/*.lock` counts 0 in both as of the last check, and one lock that was under 3 s old was left where it was rather than moved.
**AND THE CO-EDITED-FILE TRAP FIRED AGAINST THIS ENTRY, THE OTHER WAY ROUND.** I wrote this report into `STATUS.md` and, before I committed anything, another lane's pathspec commit — **`c89b734` "FLOAT: the Inbox line, and the two hashes into §8b"** — took `STATUS.md` whole from the working tree and carried this entire G-INBOX entry under its message. Nothing was lost or changed; `git diff -- STATUS.md` was empty because HEAD already held it. That is exactly the `design/ship.py` case `CLAUDE.md` names, and C2/K8's own §8b reported it firing in the other direction eight hours earlier. **The rule that catches it is still `git status --short <the co-edited file>` immediately before the commit, not before the edit** — and for a file this size the honest addition is: when your entry is long, commit it FIRST and by itself.
`STATUS.md` was therefore committed separately (`987f61e`, 1 file), with only §8b and the commit hash filled in; `G-LOOKUP3`'s `83f6bd2` landed between my two commits and swept nothing of mine either way. TTSTV: one line under `## Inbox` in `PROMPTS/INTENT.md`, `dea4552`, 1 file, and nothing else in that repo.

### 9. Status line
`phone · G-INBOX built · 13 Sep · the inbox is a row that says "Awaiting a parse" and a tap that sends it to Studio's POST /upload; road two out of project.yml and behind road-two.yml; /upload is not in the phone's allow-list yet and the row says so; owed: xcodegen, cargo test, the build, Osca's Safari press`

---

## F0 + F1 — the float: the iOS spike and the Mac panel's shape · 13 Sep (Cowork, bridge VM + container Chromium), no GPU, 0 GPU-minutes

**Status line:** `float · F0 built + F1 designed · 13 Sep · road (a) drew 794/794 words of a real chapter in a desktop engine and the probe is built to answer the three questions only a phone can; K27 answered NO; no Float button landed.`

### 1. Built
- `IOS TTS TV/scratch-float/probe-c/float.html` — the road (a) spike: a canvas painting one word → `captureStream` → `<video>` → PiP, fed by the word clock. **Four clocks counted separately** (`rAF`, a 60 Hz `setInterval`, `timeupdate`, and an **AudioWorklet tick on the audio thread**), in the foreground and while backgrounded, so "it froze" can never be the finding. `?mode=manual` swaps `captureStream(30)`'s pull for `captureStream(0)` + `track.requestFrame()`. Writes the reader's own `wordcursor:<slug>` on leaving PiP; registers and logs twelve `mediaSession` actions (K27).
- `…/probe-c/build-timeline.mjs` — builds `timeline.json` by lifting `tokenise` and `paraIndexOf` **verbatim out of `reader/listen.js` at run time**, with listen.js's own count check.
- `…/probe-c/timeline.json` — `eclogues-en/c001`, 794 words, 263.3 s, 101 paragraphs exact / 0 refused.
- `…/probe-c/drops.mjs` — the rate table, plus the number the 6 Sep table did not print: how long the WRONG word stands on the float.
- `…/probe-c/test-probe-c.cjs` — 16 assertions, no browser, no phone.
- `…/probe-c/wordclock.js` (the parent's, byte for byte), `F0.md`, `RUN.md`, `README.md`, `.gitignore`.
- `TTSTV/design/reader/FLOAT.md` — F1: the platform truth table, the Mac always-on-top panel (window, type, drag, tap→strip, dismiss), the one door to the reader's state, what "return to the reader" restores, and five questions left to Osca. **No code.**

### 2. Verified — and how
- **live (container Chromium 141, real time, whole chapter):** `float.html` over `eclogues-en/c001` end to end, 265 s, **794 words the clock passed / 794 drawn / 0 NEVER DRAWN**; counters `raf 15906, timer 16566, worklet 15215, paint 47687`. The AudioWorklet clock ticks at **57 Hz** (one message per 6 quanta).
- **live:** canvas cost **0.0416 ms per full 480×270 repaint** (9,041 repaints in 300 ms) — **1.3% of a 30 Hz frame budget**.
- **live, the honest scare:** an earlier run dropped exactly **1** word — word 54, `god`, gap to the next **120 ms** — because the driver had blocked the main thread for 300 ms to time the canvas. A 300 ms main-thread stall costs a word; road (a)'s painter lives on that thread.
- **unit:** `node test-probe-c.cjs` — **16 passed, 0 failed**: `probe-c/wordclock.js` is `scratch-float/`'s byte for byte (probe-b and probe-c count the same word); `timeline.json` rebuilds word-for-word from `listen.js`'s own `tokenise`; the chapter is really aligned, not the 350 ms divider; 60 Hz and 30 Hz miss 0, 4 Hz misses 125, 1 Hz misses 534; `indexAt`'s four edges.
- **unit:** `node drops.mjs` over all five genuinely-aligned chapters (1,739 words): **0 never-drawn at 60 and 30 Hz on every one**; staleness on c001 — 60 Hz late p95 **15.7 ms** (9.9% of a word's life), 30 Hz **31.7 ms** (20.6%), 10 Hz 95 ms (58.8%), 4 Hz 235 ms (89.2%), 1 Hz 667 ms (96.7%). Real-aligned gaps n=1,734: min 40 ms, p01 61, p05 100, median 281 → 3.56 words/s typical, 16.4/s at p01.
- **unit (the corpus, for FLOAT.md's measure):** 3,729 chapter files, **5,210,789 words** — character length median 4, p90 8, p99 12, **p99.9 16**, max 77 (a hyphen-welded OCR run in *Les Misérables*, not a word). 16ch holds 99.9% of the book at full size.
- **not verified, and it is the point:** K26b (audio away), K28 (ten minutes), and road (a)'s painter while backgrounded. **No phone, no simulator, no WebKit in this session.** `RUN.md` is the three presses and the ten-minute wait.
- **Invariant:** nothing of the app was read at run time and nothing of it changed. `md5sum languages/catalogue.json` not applicable — no server started, no route pressed.

### 3. Judgment calls
- *Which chapter the probe plays* → `eclogues-en/c001`, not the 6 Sep `poems/c002`. The corpus has **five** real alignments now, not one, and c001 is the only **whole chapter** among them (794 words, 263 s). The other 40 timings files are still the 350 ms divider and flatter every road.
- *Whether to rebuild the word list in the probe* → no: lift `tokenise`/`paraIndexOf` out of `listen.js` verbatim. A probe that re-cut the chapter would be a second word index disagreeing with the page's, and every drop count would be about a different book.
- *The 6 Sep table counted drops only* → added **staleness**. A road can score 0 drops and still be a bad float, because the eye is on it; 30 Hz spends a fifth of every word's life showing the last one, 60 Hz a tenth.
- *A fourth clock nobody asked for* → the AudioWorklet tick. iOS keeps the audio graph alive for a backgrounded app that is playing; it cannot draw, but `worklet` climbing while `paint` does not is **a live page with a stopped compositor**, which is a different and much better answer than a dead page — and it is what `?mode=manual` exists to rescue.
- *Osca's Define/Ask/Explain/Translate vs the ring's what/ground/again* → mapped Ask→`what`, Explain→`ground`, Define→`lookup.js`, Translate→`align/`'s pair, and **flagged Explain=ground as Osca's to confirm** (FLOAT.md §6.1) rather than deciding it.
- *Transport on the float* → QUIET.md forbids transport on the ring ("a second, worse copy"). Reversed on the float, and the reason written down so it cannot spread: **on a float there is no transport to be a copy of** — the capsule is behind whatever the user is working in.
- *Where the report goes* → this lane spans two repos, so the same nine headings sit at the top of `IOS TTS TV/STATUS.md` and `design/reader/STATUS.md`.

### 4. Boundary check
Touched, and nothing else:
- `TTSTV`: **`design/reader/FLOAT.md`** (new), `design/reader/STATUS.md` (this report).
- `IOS TTS TV`: **`scratch-float/probe-c/`** (new folder, 9 files), `STATUS.md` (this report).

`core/` untouched. No module's code touched in either repo — `reader/listen.js`, `reader/sysvoice.js`, `reader/cursor.js`, `reader/book-nav.js`, `voiceui/`, `desktop/src-tauri/src/settingswin.rs` and `tabs.rs` were **read only**. Not a MOVE or a RE-WIRE; the two repos are two deliverables the prompt named, not a second folder taken.

**Found dirty and LEFT ALONE (another session's, unstaged, uncommitted by me):**
`TTSTV` — `parser/README.md`, `parser/cli.py`, `parser/facts.py`, `parser/langid.py`, `parser/readers.py`, `parser/tests/test_facts.py`, `parser/tools/p0_audit.py`, `parser/triage.py`, `reader/lookup.js`, `reader/tests/test_lookup_search.py`, `settings/routes.py`, `settings/settings.js`, `studio/kaggle.py`, `studio/modal.py`, and untracked `cloud/tools/deploy_to_my_modal.py`, `parser/check.py`, `parser/form.py`, `parser/forms-hand.json`, `parser/measures.py`, `parser/tests/test_form.py`, `parser/tests/test_reparse_cost.py`, `parser/tools/form_score.py`, `parser/tools/relang.py`, `parser/tools/reparse_cost.py`, `parser/tools/reparse_migrate.py`, `reader/tests/test_lookup_card.py`.
`IOS TTS TV` — `shell.manifest.json`, `shell/reader/{reader.html,surface.js,sw.js,transport.js}`, `src-tauri/build.rs`, `src-tauri/capabilities/default.json`, `src-tauri/gen/apple/**` (5 files), `src-tauri/src/{inbox.rs,lib.rs}`, `scratch-lookup/**` (3), and an Xcode `xcuserstate`.

### 5. Footprint
`IOS TTS TV/scratch-float/probe-c/` — **86 KB committed** (45 KB of it `timeline.json`). `audio.wav` is a **symlink, gitignored, never committed** (the wav is 12.6 MB and already in `TTSTV/books/`). In the cloud container: `/tmp/pc` (a copy of three probe files + a Playwright driver), ephemeral, nothing installed. No env, no model, no download, no cache. Nothing written to `~/Desktop`; nothing on the SSD; no server started, so nothing was written into the checkout by an unguarded `paths.py`.

### 6. Requests to core / other modules
- **`reader/`** — when the Mac float is built it needs the chapter's `{words, starts}` **read off `listen.js`'s existing per-chapter map** (its `sentWords`/`bySentId` by-products), published once per chapter. No new file, no new cut, no per-word message. Proposal only; not made.
- **`voiceui/`** — the float's four labels enter at `handleUtterance`, exactly where a heard utterance and QUIET.md's flick already do. Nothing in `grammar.js`/`detour.js`/`resolve.js`/`answers.js` changes.
- **`desktop/`** — the panel is `settingswin.rs` with four builder differences (`always_on_top`, `decorations(false)`, no Dock tile, `resizable(false)`). Proposal only.

### 7. Known gaps
- **`reader/oneword.js` does not exist** — the prompt named it as read-first. The one-word view is a **POSITION on book-nav.js's axis** (`nav.go(1)`, `levelOf(dx)>=0.5`), and the word's size is `WORD.height = 0.12` of the reference height, with `fill`/`fillH` deliberately deleted so height is never a function of word length. FLOAT.md inherits that rule and not the number.
- `float.html`'s painter **shrinks a long word to fit the canvas.** That is a probe convenience and is **wrong for the product** — it is exactly what `WORD.height` forbids. FLOAT.md sizes the panel to 16ch instead.
- K26b, K28 and road (a)'s backgrounded painter are **unanswered**. So is whether wry's `WKWebViewConfiguration` allows PiP inside Frank; `RUN.md` step 2 answers it by difference.
- Android's `RemoteAction`s — the one platform whose system float could take our buttons — is in the truth table as **unmeasured**.
- `probe-b/`'s Swift has still never seen a compiler.

### 8. Next
**Osca picks the road.** `RUN.md`: step 0 (one `ln -sf`), step 1 (Safari, three presses + a ten-minute wait), step 2 (the same page inside Frank), step 3 only if `paints while away` was 0. The single question that blocks everything after: **does anything paint while the app is away?** Then FLOAT.md §6's five. **Stopping here — no Float button, no code in `reader/`, `voiceui/` or `desktop/`.**

### 8b. Commit check
Pathspec commits only, `GIT_OPTIONAL_LOCKS=0` on every git call, `-F` with the message in the session home. `git add -- <the new paths>` first (a pathspec refuses an untracked path, and a pathspec commit **silently drops** a new untracked file — the `follow.js` trap, 19 of 20). Two repos, two commits:

- `TTSTV` **`f7aeb54`** — `git show --stat HEAD`: `design/reader/FLOAT.md` (new, 243), `design/reader/STATUS.md` (69). Exactly the two meant.
- `IOS TTS TV` **`7afd971`** — 11 files, 4,943 insertions: `STATUS.md` (69) + the ten of `scratch-float/probe-c/`. Exactly the eleven meant.
- `TTSTV` **INTENT.md + the two hashes into both reports** — the follow-up commit named below. `git commit --amend` is forbidden on the shared tree, so the two placeholder lines were corrected by a new commit, not amended.

No other lane's file was staged in either repo (§4 lists what was found dirty and left). **HEAD did not move under the session in either repo** (TTSTV `9f20311` at the gate, `f7aeb54` mine; IOS `e32b316` at the gate, `7afd971` mine) — 0 moves, so nothing taken at the gate is stale. No `.git/*.lock` had to be moved aside; the bridge's "Operation not permitted" warnings on `.git/objects/*/tmp_obj_*` are the known unlink refusal and left **6 stray tmp_obj files in TTSTV and 14 in IOS TTS TV** for Osca to sweep — they are loose-object temporaries, not locks, and no git command fails on them.
- **Miss, stated:** `f7aeb54` went in **without** the `Co-Authored-By` / `Claude-Session` trailers this repo uses. `7afd971` carries them. It cannot be amended and is not worth a rewrite.
- **Second miss, the co-edit trap, stated:** between `7afd971` and `c89b734` the G-INBOX lane prepended its own report to this same `STATUS.md`, and `c89b734`'s pathspec **carried 74 of their lines in under my message** — `CLAUDE.md`'s own warning that *the pathspec rule guards against OTHER files; it cannot split ONE co-edited file* (`12d2068`, `4d4526b`). Nothing of theirs was lost or altered; only the attribution is wrong, and it is not worth a rewrite. `git status --short STATUS.md` was clean before this correction commit.

### 9. Status line
`float · F0 built + F1 designed · 13 Sep · 794/794 in a desktop engine, K27 no, three presses and a ten-minute wait owed`

---

## T-SIM — the simulator, pressed from Cowork · 13 Sep (Cowork, bridge VM + computer-use, background tier), no commit to the phone tree (no GPU, 0 GPU-minutes)

**Status line:** `phone · T-SIM run B attempted · 13 Sep · the simulator CAN be driven from this shell end to end — Frank launched on iPhone 17 and answered — but the only Frank on any simulator is a PRE-11-SEP build with an empty shelf, so B1.2/1.3/1.7a/1.7c/B3.18/system-voice could not run at all. What did run: B1.1 partial (no mic in the bottom bar), B2.8 FAILED — Sync found no Studio on the network with Studio running on the same Mac, and the Sync line still read "Never synced". Osca must press ONE command: npm run -- tauri ios dev "iPhone 17".`

### 1. Built
Nothing built. This is a tester lane; no file in either repo changed except the three logs named in §4.

### 2. Verified — and how
**live, simulator** throughout. Every line below is a **simulator** result; Osca's press on the real phone stays the release.

*The shell can drive the simulator.* Granted Simulator + Frank (Studio) at `full` tier, Terminal at `click`. `app_menu` **works** on Simulator (`File ▸ Open Simulator ▸ iPhone 17` booted the 7-Sep device) — that reverses nothing in [[the_simulator_is_pressed_from_cowork]] but adds it. Taps by coordinate and by `element_index` **both** landed (AXPress named the real element: `AXLink 'Settings'`, `AXRadioButton 'Sync'`) — the 7-Sep note that `element_index` is refused on the device screen no longer holds on iOS 26.5. **`app_scroll` does NOT move the webview** (it sets a scrollbar AXValue the webview does not expose; two presses, no movement); a **vertical `app_drag` does** — that is the scroll gesture from this shell. Horizontal `app_drag` also landed (home-screen page 2). Drags were **not** refused: both simulator windows were on the current Space.

*The app is alive and the eye works.* `scratch-probe/probe.log` grew while I pressed — `17:18:06`, `frank: page /library/library.html`, `k=viewport … cssW=402&cssH=874&band=0&phone=1&safeTop=62&safeBottom=34`, `frank: webview fills the screen -- window was 402x874, root now 402x874`. So the installed build serves its embedded assets through the `frank://` handler with **no dev server running**, and `probe.log` is still the whole feedback channel.

*The build is stale, and here is the proof rather than the guess.* Settings ▸ Sync ▸ ACCOUNT reads **"Not signed in · This device only — no Google client on this device"** — that is verbatim the empty `ios_client_id` symptom fixed by `668142a` on 11 Sep ([[sync-landed-11-sep]] cause 1), so the build predates it. It also has no `sysvoice.js` behaviour and the old "No Studio paired yet — press Sync to find one" copy, not chat 1's `pairedStudio()`. **not verified:** the exact commit — *there is no shell-commit stamp anywhere in Settings on this build* (I read General and Sync to their bottoms). `TESTING.md` Run B's line 3 ("on the phone it is the shell commit in Settings") is therefore not satisfiable here.

*B1.1 — partial.* Opens to Library; **no top bar** (pass). Bottom bar is **⚙ · pill only — no mic** (fail). Tiles-two-across not judgeable: the shelf is empty. The empty-shelf sentence is the Mac's copy — *"No ingested books yet. Double-click a source, or drag one here."* — and a phone has neither a double-click nor a drag-in.

*B2.8 — FAILED, and this is the one worth acting on.* Frank Studio was **running on the same Mac** (`com.ttstv.desktop` pid 28830, window "Library — Frank"). Pressed Sync. "This network" answered **"No Studio found on this network — type the address and code Studio's row shows"** and revealed manual fields (`192.168.1.5:41499` placeholder, `code`). The **SYNC line above still read "Never synced"** — no count, no "what it used"; on this build the outcome is still painted into the transport row, which is 11-Sep cause 3(a) and predates the `finish()` fix. Twice out of two.

*B2.8 layout — FAILED.* With that message and the two pairing inputs painted, the whole Settings page **overflowed horizontally**: the tab strip lost "Languages" off the right edge and the "This network" label wrapped one word per line. Reproducible whenever the row is in that state.

*Invariant checked:* nothing in either working tree changed as a result of pressing the app. `md5sum` gate not applicable — no server started here and no route pressed from a shell; the presses were the app's own UI on the simulator.

### 3. Judgment calls
- *The prompt assumes a current Frank on a simulator; there is none* → I booted the 7-Sep `iPhone 17` device from Simulator's own File menu and ran what that build could still answer, marking every line stale → because "cannot be driven from this shell" would have been the wrong report: the shell drives the simulator fine; the **build** is what is missing.
- *Could I install today's build?* → No, and I did not try to route around it → `tauri ios dev` must be typed into a macOS terminal; Terminal and VS Code resolve at `click` tier, which forbids typing, and the grant text forbids reaching them by any other means. Xcode's ▶ cannot start a Debug build anyway ([[the-phone-loop-is-one-press]] §0), and there is no `aarch64-apple-ios-sim` target in `src-tauri/target` — the first `ios dev` will be a cold Rust build, not a quick one.
- *Studio was mid-search on a live "Shelley poems" surface (an Archive 403 on screen), which is another lane's work* → I read Studio only by screenshot and pressed nothing in it → B3.18 needs the works pane, and navigating Studio away from that search would have destroyed a concurrent session's state.
- *The manual pairing fields were on screen and I could have typed an address and code* → did not → it would mean opening Studio's Settings to read the code (same interference), and a pre-11-Sep pairing protocol against today's Studio proves nothing either way.
- *Which STATUS.md* → this one (the phone repo) → the lane's subject is the phone; the two logs it must also write live in TTSTV and are named in §4.

### 4. Boundary check
Files touched, all three logs, no code:
- `IOS TTS TV/STATUS.md` (this entry) — phone repo.
- `TTSTV/TESTING.md` — five log lines, each marked `· simulator`.
- `TTSTV/PROMPTS/INTENT.md` — one line under `## Inbox`, nothing else.

`core/` untouched. No module folder touched in either repo. Not a move and not a re-wire, so the two-folder exception does not apply; the two repos are the tester's own logs, not a second piece of work.

**Dirty and left alone (another session's, unstageable by me):** TTSTV — `design/reader/book-nav.js`, `design/reader/page.js`, `design/reader/transport.js`, `reader/book-nav.js`, `reader/reader.html`, `reader/transport.js`, `voiceui/app.js`, `voiceui/tts.js`, `?? design/reader/follow.js`. Phone repo — `shell/reader/reader.html`, `shell/reader/surface.js`, `shell/reader/sw.js`, `shell/reader/transport.js`, `shell.manifest.json`, `src-tauri/gen/apple/*` (Info.plist, pbxproj, xcscheme, both entitlements), `?? shell/reader/sysvoice.js`, `?? src-tauri/gen/apple/FrankShare/Info.plist`, and the whole of `scratch-lookup/`.

### 5. Footprint
Nothing added to disk by this lane. No env, no model, no download, no cache, no scratch file. One extra simulator device was **booted** (`iPhone 17`, iOS 26.5) alongside the `iPhone 17 Pro` another lane is using for SweepProbe — it is left running with Frank open on the Library; shut it from Simulator ▸ File ▸ Close Window if it is in the way. Ran with the SSD irrelevant (no depot access). `scratch-probe/probe.log` grew by ~150 bytes as the app logged its own load — the app wrote that, not me.

### 6. Requests to core / other modules
- **To whoever owns Settings on the phone:** put the **shell commit in Settings**, visibly. `TESTING.md` Run B tells every tester to note it before starting and this build shows it nowhere, so every phone line in the log is unattributable to a build.
- **To the sync lane:** the Sync line must carry the outcome (count + which transport) even when the outcome is "found nothing" — on this build the failure is only legible in the transport row, which is the same disease `finish()` was written to cure.
- **To the settings lane:** the pairing row's message + two inputs overflow the 402 px page horizontally. Numbers are in §2; a rectangle can be taken on request.

### 7. Known gaps
- **Nothing in the assignment's main body actually ran.** B1.2, B1.3, B1.7a, B1.7c, B3.18 and the space-bar/system-voice item are all untouched, and B2.9–B2.13 had nothing to leave running.
- Every line here is a **stale build**, so any of these may already be fixed in today's tree; none of it should be treated as a regression report.
- No Studio-side observation at all beyond "it is running with a search open" — deliberately, per §3.
- The empty shelf means B1.1's "tiles two across" is still unpressed.

### 8. Next
**One command from Osca, and the whole of Run B becomes available to this shell:**

```
cd "<phone repo>" && npm run -- tauri ios dev "iPhone 17"
```

No `--host` (a simulator shares localhost with the Mac). Expect a **cold** build — there is no `aarch64-apple-ios-sim` target yet. Before it, `cd src-tauri/gen/apple && xcodegen generate` if `project.yml` has moved since the last generate (§1 of [[the-phone-loop-is-one-press]]); `gen/apple` is dirty with the FrankShare work, so that is a judgement for the C2/K8 lane, not for me.

Once it is up, this shell can press the rest unattended: the simulator answers taps, drags and the menu bar in the background, and `probe.log` reports. **The single question that blocks it:** is the `iPhone 17` simulator free for the loop, or is the FrankShare/SweepProbe lane going to want it?

Stopping here, as instructed.

### 8b. Commit check
Two repos, both by pathspec, `GIT_OPTIONAL_LOCKS=0` on every call, no `-a`, no `-A`, no `--amend`. Hashes and `git show --stat HEAD` for each are in the chat reply. No lock was moved. Other sessions' dirty files listed in §4 were left unstaged.

---

## C2/K8 — the share target · 13 Sep (Cowork, bridge VM + container), phone `9b7fbaf` `a6e72e5` (no GPU, 0 GPU-minutes)

**Status line:** `phone · C2/K8 spike built · 13 Sep · TWO roads into Frank, and they cost differently: "Copy to Frank" is three plist keys and no entitlement, the share extension is a second target + an App Group; both read by src/inbox.rs, which says which one a row came in by. Owed: xcodegen, cargo test, the build, and Osca's Safari press.`

### 1. Built
`src-tauri/src/inbox.rs` (new, 473 lines): `rows_flat` (the OS's flat `<Documents>/Inbox`), `rows_nested` (`<group>/inbox/<id>/` + `source.json`), `documents_inbox` / `group_inbox` / `root_why`, the `inbox_list` command (read-only — it moves, parses and deletes nothing), `log_at_start`, `GROUP_ID`/`GROUP_INBOX`/`DOCUMENTS_INBOX`/`SOURCE_JSON`.
`src-tauri/ios/FrankInbox.m` (new, 101): `frank_inbox_documents`, `frank_inbox_group` — neither root is computable in Rust (a container is a per-install UUID), so both are asked of Foundation; a nil group container is a **result** (code 2), not a crash.
`gen/apple/project.yml`: **road one** — `CFBundleDocumentTypes` (PDF / EPUB / plain text, `LSHandlerRank: Alternate`), `LSSupportsOpeningDocumentsInPlace: false`, `UIFileSharingEnabled: true`; **road two** — the `FrankShare` `app-extension` target (`com.apple.share-services`, one file / one web URL / one text selection) and `- target: FrankShare, embed: true, codeSign: true` on the app.
`gen/apple/FrankShare/ShareViewController.swift` (new, 168): no UI; payload written `.part` then renamed, `source.json` (`url`, `title`, `time`, `kind`) written last.
`gen/apple/FrankShare/FrankShare.entitlements` + `gen/apple/frank_iOS/frank_iOS.entitlements`: `com.apple.security.application-groups` = `group.com.ttstv.frank`.
`build.rs` (the `frankinbox` archive + `"inbox_list"`), `capabilities/default.json` (`allow-inbox-list`), `src/lib.rs` (`mod inbox;`, one `generate_handler!` line, `inbox::log_at_start()` in `setup`).

### 2. Verified — and how
**unit, container** — `src/inbox.rs` lifted whole into a scratch crate (real `serde_json`, real `log`, the one `#[tauri::command]` attribute stripped; the extraction route of [[the-pairing-is-one-key]]): **9 passed, 0 failed, 0 warnings**. **5 RED controls, each one red:** dot files no longer skipped · a `.part` counted as a payload · rows unsorted · the title fallback removed · an off-iOS root pretending to exist. Two more on the group-id wiring test: a typo in one of the three files goes red; the pre-extension `<dict/>` state stays green.
**unit, bridge VM** — `python3 -m pytest tests`: **95 passed, 4 failed, 1 skipped** — byte-identical to the count in the G-LANG entry, and all four fail at `HEAD` as well (checked by putting `HEAD`'s `project.yml` back and re-running: the same three `test_pair_link`/`test_phone_loop` failures, plus `test_phone_shell`'s `scratch26b` one, which is not mine). `capabilities/default.json` re-parses as JSON.
**eyeballed / schema** — `project.yml` parses under `yaml.safe_load`; both targets and the dependency come back in the expected shape; every key used (`type: app-extension`, a per-target `deploymentTarget` string, `dependencies` `target`/`embed`/`codeSign`, `info.path` + `properties`, `entitlements.path`, `settings.base`) is XcodeGen's documented form, and the path-only `entitlements` has precedent in this very file.
**NOT VERIFIED, and none of it should read as verified:** `xcodegen generate` (the round-trip gate), `cargo check` / `cargo test` on this crate, any build, and **anything at all on a phone or a simulator**. The bridge shell is a **Linux** VM — no Xcode, no `xcodegen`, no `swift`, no `cargo` (`uname -a`, `command -v` on all five). The Swift file has never been compiled by anything.

### 3. Judgment calls
- *The prompt says "build a share extension"; `plan-12-sep.md`'s own K8 row says "Info.plist document/URL types, a receiving handler"* → **both, in two commits.** Road one is three plist keys and **no entitlement** — it is the thing that can ship on the 13th under a free personal team, and it is what C2 means by *cheapest*. Road two is the row a person actually presses. Building only road two would have made the answer to K8 depend entirely on a signing question nobody has answered yet.
- *An App Group on the app target could break a working build on ship day* → **the entire extension half is one commit (`a6e72e5`), revertable alone.** `git revert a6e72e5` puts `frank_iOS.entitlements` back to `<dict/>` and removes the target; road one and `inbox.rs` survive untouched. This is why `project.yml` was written twice rather than once.
- *Where to get the two roots* → **Objective-C, not Rust.** `app_data_dir()`-relative guessing would have worked until it didn't; `NSSearchPathForDirectoriesInDomains` and `containerURLForSecurityApplicationGroupIdentifier:` are the answers, and the second one **answering nil is the measurement**.
- *`inbox_list` with no page to call it* → registered properly (`build.rs`, capability, handler) but given **no init script**. A spike gets a log line; a `TTSTVHost.inbox` is a door someone else should design.
- *`LSSupportsOpeningDocumentsInPlace`* → **`false`.** `true` hands Frank a security-scoped URL into another app's container that stops working when the sheet closes; an inbox has to be a copy.

### 4. Boundary check
`src-tauri/src/inbox.rs`, `src-tauri/ios/FrankInbox.m`, `src-tauri/src/lib.rs`, `src-tauri/build.rs`, `src-tauri/capabilities/default.json`, `src-tauri/gen/apple/project.yml`, `src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`, `src-tauri/gen/apple/FrankShare/{ShareViewController.swift,FrankShare.entitlements}`, and this file. This is the phone repo only; `TTSTV` is untouched apart from the one `PROMPTS/BOARD.md` Inbox line. `pull.rs`, the web shell and `TTSTV` proper were not opened. **Not a move or a re-wire — the single-folder confirmation stands.** `src/lib.rs` is named here because **G-TOPUP owns that file when it runs**: the change to it is three lines (`mod inbox;`, `inbox::inbox_list` in `generate_handler!`, `inbox::log_at_start();` in `setup`).
**Found dirty and left alone:** `scratch-lookup/Resources/words.json`, `scratch-lookup/Sources/sweep.m`, `scratch-lookup/SweepProbe.xcodeproj/` (untracked, another session's).

### 5. Footprint
Nothing on the SSD; the SSD was not touched and the depot was not read. In the container: one scratch crate (`~/scratchpad/inboxcrate`, ~30 MB with `target/`), gone with the session. On the bridge VM: `pip install pytest` into the session's own `~/.local`. In the repo: `_to_delete/HEAD.lock.*` and `_to_delete/next-index-38.lock.*` — two locks the bridge could not unlink, moved after the commit they belonged to had landed; **`.git/objects/*/tmp_obj_*` residue the bridge also cannot unlink is still there and only Osca can clear it.** No models, no downloads, no venv.

### 6. Requests to core / other modules
None that block. For whoever drains the inbox (G-STUDIOPHONE, or C1/P8): the row shape is `{id, via, title, url, kind, at, file, bytes}` and `via` is `"share-extension"` or `"open-in"` — please take a row by `id` and leave the shape alone, or say so here first.

### 7. Known gaps
- **The signing question is not answered and this spike cannot answer it.** Whether a *free personal team* can carry `com.apple.security.application-groups` is the one fact road two stands on; nothing on the bridge can test it, and the web did not settle it either way. `frank_inbox_group` returning code 2 with `-- the entitlement is absent or unsigned` in the log is the designed way for Osca's first build to answer it in one line.
- No UI, deliberately. Nothing drains the inbox; nothing parses a PDF; an item sits there forever.
- `Cargo.lock` untouched (no new crate), but `cargo check` has never been run on this crate here — `inbox.rs`'s non-iOS half is what the container compiled, and the `extern "C"` block and the two `cfg(target_os = "ios")` roots have never been compiled by anything.
- The share extension takes **one** attachment type per provider (the first match of pdf → epub → file-url → url → text), because Safari offers a PDF as both a file and an address and taking both writes the same bytes twice.
- `tauri-plugin-deep-link`'s build script also rewrites `frank_iOS.entitlements`; it has only ever removed `associated-domains`, but it has not been watched with an App Group in that file.

### 8. Next
**Osca, four presses, in this order — and the first two are the gates:**
1. `cd src-tauri/gen/apple && xcodegen generate` — does the `FrankShare` target survive, and does `frank_iOS/Info.plist` come out with `CFBundleDocumentTypes` in it? (`xcodegen` is the step nothing else runs.)
2. `cd src-tauri && cargo test` (and the build).
3. Build to the phone. **Read the log for the two `frank: inbox …` lines** — they say which roads exist on that build. If the group line says *the entitlement is absent or unsigned*, that is K8's answer and road two should be reverted (`git revert a6e72e5`); road one is unaffected.
4. Safari → a PDF → share sheet. Look for **Frank** as a row (road two) and under *Copy to…* (road one). Then Files ▸ On My iPhone ▸ Frank ▸ Inbox.

The single question that blocks K12: **does the personal team sign the App Group?** Then stop.

### 8b. Commit check
`9b7fbaf` (road one, 6 files) and `a6e72e5` (road two, 4 files) — every path on the commit line, `GIT_OPTIONAL_LOCKS=0` on every git call, `git add --` for the four new paths, no `-a`, no `-A`, no `--amend`. `a6e72e5` needed the lock-retry loop (first attempt died on `HEAD.lock`); the loop's second pass landed it, and the two stale locks are named in §5. `git show --stat HEAD` listed exactly the four files meant.
**And the co-edited-file trap fired once, in the OTHER repo:** `TTSTV a3eb959` was meant to be my one `PROMPTS/BOARD.md` Inbox line and carried **two** — another lane appended the G-QUIET line between my read and my commit, and a pathspec commit takes the whole working-tree file, which is exactly the `design/ship.py` case `CLAUDE.md` names. Nothing was lost or changed; their line is in my commit under my message. The rule that would have caught it is `git status --short PROMPTS/BOARD.md` immediately before the commit, not before the edit.

### 9. Status line
`phone · C2/K8 spike built · 13 Sep · two roads in (plist types, no entitlement · share extension, App Group), both read by src/inbox.rs; owed: xcodegen, cargo test, the build, Osca's Safari press`

---

## G-LANG — languages are packs the phone adds · 11 Sep (Cowork, bridge VM + container), phone `c525c0a` `aa9eea2` · TTSTV `07433d6`…`b7e9518` (no GPU, 0 GPU-minutes)

**Status line:** `dictionary · G-LANG built · 11 Sep · a whole language per SQLite file, looked up in Rust (dict.rs), added from Settings > Languages as one more pull job; owed: cargo test, the build, Osca's Add Latin press`

The full nine-heading report is TTSTV `dictionary/STATUS.md` (G-LANG); this is the phone's half.

### 1. Built
`src-tauri/src/dict.rs` (new): a pack (TTSTV `dictionary/pack.py`, schema 1) opened read-only with rusqlite (bundled); `resolve`/`entry` = `pack.py::resolve` step for step; `dict_langs` / `dict_lookup(term, lang)` → `{lang, term, entries, us}` / `dict_remove`; `DICT_JS` = `TTSTVHost.dict`; `Packs`, the pull's door into `<app data>/languages/` (gz → `.part/`, inflated at the commit, checked, row last). `pull.rs`: `Door` + `BookDoor`, `Job.kind` (`"language"`), `Status.kind/queued`, a language pressed during a pull queued and run next on the same thread. `lib.rs`: `mod dict;`, three handlers, `DictState`, the init script. `build.rs`, capability, `Cargo.toml` (`rusqlite 0.37` bundled, `flate2 1`). Shell import v54 from TTSTV b7e9518.

### 2. Verified — and how
**unit, container** — `cargo test --offline` (real serde/serde_json/log, rusqlite 0.37.0 with bundled SQLite, flate2 1.1.10 from source; tauri/ureq mocked): **23 passed** (lane 1's 12 unchanged + 3 language pull tests + 8 dict: hit, miss, accent-insensitive Latin, apostrophe terms, wrong schema, door, refusals, wiring); 6 RED controls each fail ≥ 1. **live, container** — the real la/en/fr gz through the real door, then 8,887 keys held to `pack.py`: 0 differ; lookup mean 28–47 µs, p99 ≤ 172 µs (container). `tests/`: 95 passed, 4 failed before and after (pre-existing). **Not verified:** `cargo test` on this crate, the build, anything on the iPhone.

### 3. Judgment calls
One downloader: a `Door` seam in lane 1's `pull.rs` rather than a pack downloader; a pack is a job of `kind: "language"`. Unicode keys by the pack's own `fold` table (exact parity with Python's `norm`), not a new crate.

### 4. Boundary check
`src-tauri/src/{dict.rs,pull.rs,lib.rs}`, `src-tauri/{build.rs,Cargo.toml,capabilities/default.json}`, the shell import, this file. Left alone: `shell/library/library.json` (deleted before this session), `src-tauri/gen/apple/*` (4), `scratch-float/`, `scratch-j13/`, `scratch-lookup/`, `scratch26b/`.

### 5. Footprint
`_to_delete/shell.1789151958` (2.1 MB, the import's old shell) and 4 git locks the bridge could not unlink. The app's own on the phone: `<app data>/languages/` — la 266 MB, en 293, fr 85, grc 108 once added.

### 6. Requests
Lane 5's dot: `running || TTSTVLangs.dot()` (TTSTV report §6).

### 7. Known gaps
Cargo.lock not regenerated here (crates.io unreachable) — the first Mac build writes it. No byte progress in the status (files only).

### 8. Next
Osca: `cd src-tauri && cargo test`, the build, then Settings ▸ Languages ▸ Add Latin (71 MB), and the Eclogues by voice. Stop.

### 8b. Commit check
`c525c0a` (Rust), `aa9eea2` (shell import), this entry — pathspec, `GIT_OPTIONAL_LOCKS=0`.

### 9. Status line
Above.

---

## G-SYNCBG — the phone syncs while you use it · 11 Sep (Cowork, bridge VM + container), TTSTV `70f5fc5` `5dd1411` · phone `62590f6` `019d1fe` (no GPU, no Kaggle, no Modal, 0 GPU-minutes)

**Status line:** `library · G-SYNCBG code done · 11 Sep · a Sync's books are pulled by the app (pull.rs) and the page only plans them; auto on launch + foreground; owed: cargo test + Osca's three presses`

### 1. Built
**Phone repo (`main`)**
- `src-tauri/src/pull.rs` (new): the job types (`Job {transport, trigger, auth, books, why}`, `Auth` = drive.js's token names incl. `clientId` / the LAN `base`+`token`, `Book {slug, hash, title, meta, files}`, `File {rel, id|url, bytes}`), `Status` (`running, transport, trigger, book, slug, i, n, file, done, total, pulled, skipped, why, since, ended, google`), `Pull` (status + stop flag; `begin`, `request_stop`), `Wire` (the network + clock, faked in tests), `check_job` (the whole job refused in words before a byte is fetched), `run` (one book at a time in the page's order; a book installed at that hash skipped; each file skipped when `.part/` holds it at the listed size — the resume; `book_commit` LAST; stop after the current file), `fetch_file` (retry ×4 at 1/3/8 s on a lost network, a 5xx, a 429 or a short body; a Drive 401 refreshes once; any other status a sentence), `refresh` (POST `oauth2.googleapis.com/token` with client id + refresh token, no secret — `drive.js::googleRefresh`'s request), `start` (claims the runner, spawns `frank-pull`; a second start returns the running status untouched), `auto_js`, `Net` (ureq, blocking, rustls; timeouts 15/30/30 s).
- `src-tauri/src/lib.rs`: `book_dest` (the name checks + folder, now shared by `book_write` and the new `book_write_from`, which streams), `book_have`, `book_installed`; `meta_text` (the row arrives as an object, is kept as text); commands `sync_start(job)`, `sync_status()`, `sync_stop()`; `PullState`; `sync_auto` (evaluates `TTSTVHost.sync.auto(trigger)` unless a pull runs), `sync_on_load` (the first finished page load = launch), `sync_on_window` (`WindowEvent::Resumed`, mobile = foreground); `SYNC_JS` = `TTSTVHost.sync {start, status, stop, auto}` — writes a refreshed token back into `ttstv.sync.google` (only into a signed-in record) and strips it, dispatches `ttstv:sync` on a start, and loads `/library/drive.js` into whatever page is showing for `auto`. `run()`: the three commands, `.manage(PullState)`, the init script after `BOOKS_JS`, the page-load and window-event hooks. `mod pull_door_tests` (2).
- `build.rs`, `capabilities/default.json` (+ the three, the description says what they reach), `Cargo.toml` (`ureq = "2.12"`, with why). `tests/test_sync_pull.py` (new, 6). `SYNC.md` §2 and `PHONE.md` §7 corrected (see §3). `shell/` re-imported (`019d1fe`).

**TTSTV (`FRANK`)**
- `library/drive.js`: `syncBookMeta` (import.js's row from Studio's row + the file list), `syncJobBook`, `syncJob` (superseded never; already here at that hash never; one book per slug; import.js's allowlist and refusals, its words), `syncDriveAuth`, `syncHave` (the door's list, else import.js's), `syncHandOff`, `syncPlanLan` (4 s), `syncPlanDrive`, `syncPlan` (D4: paired Studio first, Drive otherwise, nothing when neither), `syncAuto`; `runDriveSync` with `o.pull`: marks → position → library.json → settings, THEN the books handed over; without `o.pull`, unchanged.
- `settings/settings.js`: `syncWhen` (out of `syncStateLine`, same words), `syncPullLine`, `syncHostPull`; `runSync` (LAN) hands off with `o.pull`; the Transfer panel passes `pull` on the phone, follows `TTSTVHost.sync.status()` (1 s while running; on build; on `ttstv:sync`) and paints it on `.tr-state`.
- `library/tests/test_sync_job.py` (5) + `samples/sync/drive-library.json`; `settings/tests/test_sync_pull.py` (3).

### 2. Verified — and how
- **unit, Rust — 21 passed, 0 failed**: `pull_tests` 12 (order + bearer on every GET; half-way failure has no row and the next start fetches only the missing/short files; 8 bad `rel`s + 14 other refusals each a sentence with nothing fetched or written; refresh inside the minute = exactly `client_id=…&refresh_token=…&grant_type=refresh_token`, then the new token, handed back as `google`; 401 mid-run refreshes once; a refused refresh is `HTTP 400 (invalid_grant)`; `sync_stop` during the 2nd GET → file 2 whole, file 3 never asked, `why: stopped`, restart fetches only the rest; retry waits `[1000, 3000]`; short body tried 4× then a sentence; 404 said at once; LAN `?t=a%2Fb%20c` and no bearer; installed hash skipped; `why` recorded; `start` runs on its thread and a second start is refused), `pull_door_tests` 2 (the page's JSON job parses — `clientId`, `bytes: null`, meta object→text, a non-object meta refused; the wiring inside `run()`), `book_tests` 7 (G-PULL's, unchanged, over the refactored `book_write`). **How:** `cargo test --offline` in the Cowork container on a crate whose lib is lib.rs's items extracted VERBATIM by brace-matching (+ the real `pull.rs`), built against **real** serde 1.0.229 / serde_derive / serde_json 1.0.151 / log 0.4.34 cloned from GitHub (crates.io is 403 here) and hand mocks of the tauri 2.11.3 and ureq 2.12.1 surfaces, signature for signature from their sources at the tags. `RUSTFLAGS="--cfg mobile"` also compiles (the `Resumed` arm). **RED controls:** 5 mutations (resume off, stop off, a `client_secret` added, the rel check off, the 401 refresh off) → each fails ≥1 test. Not `cargo test` on the real crate — owed (§8).
- **unit, node/pytest:** `library/tests` **247 + 1 xfailed → 261 + 1 xfailed**: 5 are `test_sync_job.py`; 9 are another lane's dirty/untracked tests (`test_library_phone_shelf.py` etc.) — without my file **256**. `settings/tests` **129 → 132** (+3, `test_sync_pull.py`); every pre-existing Sync test (LAN, Drive, pairing, the Mac press, the G-PULL failure line) passes unchanged = **the Mac/PWA path is untouched**. Phone `tests/` **89 passed, 4 failed → 95 passed, 4 failed** (+6; the same 4 pre-existing failures: `test_pair_link`, `test_phone_loop` ×2, `test_phone_shell`). **RED:** the 8 new TTSTV tests all fail on the pre-change `drive.js`/`settings.js`.
- **the job for the fixture** (`samples/sync/drive-library.json`, 7 rows, device holds `eclogues-la@2c2c…` and `les-pensees-fr@5e5e…`): exactly `les-pensees-fr@6f6f…` (3 files) and `hamlet@1b1b…` (11 files; `notes.md` out, `cover.jpg` in because import.js's working-tree allowlist has it), refused `aeneid-la` (schema 8, import.js's sentence) and `odyssey-en` (no book.json). **Row parity:** for the same book, `importBook`'s row and `syncBookMeta`'s agree on every key import.js writes (incl. the uncommitted G-COVERS keys) bar `imported`.
- **the loop:** phone shell imported from a `git archive` of TTSTV `5dd1411` — exactly 2 files differ from the last import, byte-identical to TTSTV's; `tools/prebuild.py`: 59 files, 2,004,443 bytes verified. No server started, no route pressed.
- **not verified:** anything on the phone or the simulator; ureq/rustls/ring compiling for `aarch64-apple-ios`; a real Drive or LAN download.

### 3. Judgment calls
- **How Rust gets the plan** → the app evaluates `TTSTVHost.sync.auto(trigger)` and the door lazy-loads `/library/drive.js` into any page → at launch the page is the Library, which does not load drive.js, and `library.html` is not mine; a registered builder would exist only after Settings had been opened.
- **Foreground** = the window's `WindowEvent::Resumed` (tao: `applicationWillEnterForeground`), NOT `RunEvent::Resumed` → the latter is the event loop's `StartCause::Poll` and fires constantly. **Launch** = the first page load that finishes.
- **D4 in the auto path**: LAN when paired and it answers in 4 s, else Drive → the press still uses the row's "In use" transport (unchanged behaviour; the plan's D4 wording is about sync generally).
- **Auto pulls books only**; marks/positions/settings merge on a press → they are the page's ledgers and the reader may have them open.
- **The row the app commits is built from Studio's row**, not book.json (the app never reads it): `chapters` = the chapter texts' count (no chapter count in the row), `words` = the row's, the hash is Studio's (the page path recomputed it from book.json); `first_words`/`form` only when the row carries them → §6.
- **Press order on the phone**: ledgers first, books handed LAST (the page path did books before settings).
- **A new dependency, `ureq 2.12`** → tauri's own `reqwest` is on mobile with no TLS feature; ureq is blocking (one thread), rustls/ring, no OpenSSL, same client for iOS/Android/desktop. First Mac build needs crates.io.
- **A listed size is held**: a body of another size is a failure (retried) rather than committed; an unlisted size (un-transcoded LAN audio) is taken and always re-fetched on resume.
- **A second `sync_start` while running** returns the running status (not queued, not replaced).
- **A page that could not plan** sends a job with `why`, so `sync_status` is the one record of "what ran and why".
- **The token key now appears in lib.rs** (`ttstv.sync.google`, the second shared name after the redirect key) → held equal to drive.js's by `test_sync_pull.py`.
- **Row words**: "Synced over LAN · 2 books · 17:41 · on opening", "Drive · up to date · 17:41 · on return", short: "Drive · 2 of 26 pulled · stopped".
- **The prompt named `library/transfer.js` as "the LAN pull"** → it is the Modal/door client; the LAN pull is `settings.js::runSync`. transfer.js untouched.
- **Tests "the way G-PULL did" (plain rustc)** → cargo `--offline` with serde/serde_json built from source instead, so the real derives and the JSON parse are checked; the tauri/ureq surfaces are still mocks.
- **The shell import's source**: other lanes' shell files are dirty in TTSTV's tree (G-COVERS), so the phone shell was imported from a `git archive` of HEAD `5dd1411`, in the container; `shell.manifest.json` names `5dd1411` and Osca's path.
- **Reversed and deleted**: `SYNC.md` §2 "`lib.rs` changes **nothing** for it" (the LAN half) → rewritten, quoting Osca's line of 11 Sep.

### 4. Boundary check
TTSTV: `library/drive.js`, `library/tests/test_sync_job.py`, `library/tests/samples/sync/drive-library.json`, `settings/settings.js`, `settings/tests/test_sync_pull.py`, this report. Two modules because the prompt names both files; not a move. `core/` untouched. Phone repo: `src-tauri/src/{lib.rs,pull.rs}`, `src-tauri/{build.rs,Cargo.toml,capabilities/default.json}`, `tests/test_sync_pull.py`, `SYNC.md`, `PHONE.md`, `shell/library/drive.js`, `shell/settings/settings.js`, `shell.manifest.json`, `STATUS.md`. Not touched: `import.js`, `library.html/css`, `book-nav.js`, `surface.js`, `transport.js`, `reader.html`, `transfer.js`.
**Left alone, dirty (another session's):** TTSTV `library/import.js`, `library/library.css`, `library/library.html`, `library/tests/{test_import.py,test_import_store.py,test_library_context.py,test_library_view.py}`, `reader/context.js`, `studio/drive.py`, `studio/sync.py`, `studio/tests/{test_drive.py,test_sync.py}`, untracked `library/tests/test_library_phone_shelf.py`, `PROMPTS/{phone-pull,round-11-sep-evening,sync-phone-plan}.md`. Phone: `shell/library/library.json` (deleted), `gen/apple/…` ×4, `scratch-float/`, `scratch-j13/`, `scratch26b/`. `shell.manifest.json` was dirty with Osca's own re-import from `8903c12` (same files, source line only); the import rewrote it whole and it is committed in `019d1fe`.

### 5. Footprint
Container only: `/tmp/claude-0/src` (shallow GitHub clones: tauri `tauri-v2.11.3`, ureq `2.12.1`, serde, serde_json, syn, quote, proc-macro2, unicode-ident, itoa, ryu, memchr, zmij, log), `/tmp/claude-0/t` (the test crate + its target), `/tmp/claude-0/imp` (the 47 MB HEAD archive, extracted). VM: `$HOME/drive.js.orig`, `$HOME/settings.js.orig` (RED controls). **TTSTV `_to_delete/syncbg-tars.1789147337`** (49 MB: the two tars staged for the import) — Osca empties it. No SSD, no depot write, no GPU: 0 GPU-minutes.

### 6. Requests to core / other modules
- **G-COVERS lane (`studio/sync.py::manifest`, `studio/drive.py` rows):** carry `first_words`, `form` (and `chapters`) on each book row. The app never reads book.json, so a book it pulls gets them only from the row; without them the phone's tile falls back to the Range read of book.json that G-COVERS is removing. `syncBookMeta` already copies them when present.
- **Covers topped up at the same hash (TOPUP)** are pulled by neither path (a book installed at that hash is skipped, as the page always did) — the covers lane's to decide.
- **Lane 5 (`transport.js`)**: the dot = `TTSTVHost.sync.status().running`; `ttstv:sync` fires when a pull starts.
- **`library.html` owner**: "Pulling 3 of 26" in the Library's own words, from the same status.
- **clean/**: `export.py --shell` owed once the other lane's shell files are committed; mine are, so any later build carries them.

### 7. Known gaps
- `cargo test` and a real iOS build not run; ureq/rustls/ring on `aarch64-apple-ios` unproven here.
- Nothing pressed. No `beginBackgroundTask`: a lock suspends the thread after iOS's grace; on unlock the socket times out → retried, or the foreground ask restarts it once the run has ended; an app iOS kills while suspended resumes on relaunch.
- Auto does not merge the ledgers. No Stop button (the command exists). The Library shows no progress.
- The row's `bytes` sums listed sizes (an un-transcoded chapter counts 0); `imported` is plan time.
- The plan itself (Drive listing + library.json, seconds) still runs in the page; a navigation during it drops that ask (the next foreground asks again).

### 8. Next — Osca's press
1. `cd "IOS TTS TV/src-tauri" && cargo test` — the first build fetches ureq/rustls/ring. Expect the old tests + `pull::pull_tests` 12 + `pull_door_tests` 2.
2. Build to the phone (`tools/phone.sh`; the shell is already imported at `5dd1411` — a re-import from TTSTV's working tree now would also carry the covers lane's uncommitted files).
3. Settings ▸ Sync ▸ **Sync** → "Pulling 1 of N · … · k/n". Open a book, read two pages, come back → the count moved. Lock 1 min, unlock → it continues (or "· on return" once it ended). Kill mid-book, relaunch → the half book is not on the shelf and the line says "Pulling …" again, then "Synced over … · on opening". Xcode console filter: `frank: pull`, `sync_start`, `sync auto`.
The question that blocks nothing: none.

### 8b. Commit check
Pathspec commits only, `GIT_OPTIONAL_LOCKS=0`, `git show --stat HEAD` = the files meant: TTSTV `70f5fc5` (3) · `5dd1411` (2) · this report; phone `62590f6` (8) · `019d1fe` (3) · this report. TTSTV HEAD moved once before my first commit (`39e4597`, G-DICT docs; my "before" counts were taken on the tree just before it and it touches no file tested here). No `--amend`, no `-a`. Locks the bridge could not unlink, moved: TTSTV `_to_delete/HEAD.lock.*`, `next-index-13.lock.*`, `next-index-10.lock.*` (the last was there before my commit — not necessarily mine); phone `_to_delete/HEAD.lock.*`, `next-index-9.lock.*`, `next-index-14.lock.*`.

### 9. Status line
`library · G-SYNCBG code done · 11 Sep · the pull runs in the app (pull.rs), the page plans (drive.js); owed: cargo test + Osca's three presses`


---

## G-PULL — the phone can read Drive but cannot take a book · 11 Sep (Cowork, bridge VM + container), TTSTV `4e995d3` `2a1c1eb` `194bbd0` · phone `0a8240a` `f6f6554` (no GPU, no Kaggle, no Modal, 0 GPU-minutes)

**Status line:** `library · G-PULL code done · 11 Sep · Cache.put refuses frank:// proved; the phone stores books through TTSTVHost.books; owed: cargo test + Osca's Sync press`

### 1. What was asked
`PROMPTS/phone-pull.md` (`> go`, 11 Sep). The phone's Sync read Drive's `library.json` (26 rows) and died at `Pulling 1 of 26 · Les Pensées · 0/31`, every press, and the reason was invisible. Two fixes: (small) a failed press leaves its reason on the Sync row's own line; (real) prove the hypothesis — `Cache.put` refuses `frank://` — then give the phone a host door for books and `import.js` a store seam, so the same `importFiles` writes to the Cache API on the web/Mac and to disk on the phone.

### 2. What was done
**TTSTV (`FRANK`)** — `4e995d3` settings · `2a1c1eb` store seam · `194bbd0` clean/
- `settings/settings.js`: `var failed` (memory only — `last`, the last GOOD sync, is never overwritten); `finish()` sets it (`res.why || "Sync failed"`) and clears `say`; `paint()` puts it on `.tr-state` until the next press finishes. Nothing else in the file touched.
- `library/import.js`: **the store** — `put / meta / list / remove`, two implementations. `CacheStore(href)` is the code that stood in `importBook`/`listInstalled`/`removeBook`, moved; `HostStore(TTSTVHost.books)` hands the same four calls to the phone's door. Chosen **once, at load** (`DOOR`), by whether the host offers a whole door; `useStore()` for tests. `importBook` calls `store.list()` (for `reimported`), one `store.put` per file, then `store.meta()` LAST — the commit, which answers what it replaced. Nothing outside the store names `caches`. `importFiles` alone ends a book at n/n (the Sync line); the zip door still ends at n-1 (`test_import.py` pins that).
- `reader/context.js`: new fact `hostBooks`; `canHoldBooks` = (door **or** Cache API) + `crypto.subtle` + import.js; `device` = `(!app || hostBooks) && canHoldBooks && !studioLive`. **This was needed and the prompt did not name it:** Frank on the phone injects `TTSTVHost` like the desktop app, so by the old rule it was never a device and `library.html`'s "On this device" section — the only place `listInstalled` rows are drawn — would have stayed empty after a perfect pull.
- `design/reader/settings-bench.js`: `drive: ok | fails`. `library/README.md`: the tree line for import.js.
- Tests: `library/tests/test_import_store.py` (new, 6), `test_library_context.py` (+2, and its facts assertion gains `hostBooks: False`), `settings/tests/test_sync_drive.py` (+1).

**Phone repo (`main`)** — `0a8240a` import shell · `f6f6554` the door
- `src-tauri/src/lib.rs` "the books": `book_put` (raw IPC body, `frank-book-slug/-hash/-rel` headers percent-encoded; a JSON array from Tauri's postMessage fallback is taken, never asked for; logs its bytes and ms), `book_meta` (writes `.meta.json` + `.hash` into `.part/<slug>@<hash>/` and swaps it into `books/<slug>`, old version aside then gone, put back if the swap fails; answers what it replaced), `book_list`, `book_remove`. Books root `<app_data_dir>/books/`, beside `shell/`. `route()` serves `/books/<slug>/<rel>` from there with `resolve()`'s rules plus "no dot-named segment", then falls back to the dev shelf in `shell/books/`. `content_type` gains `txt`, `ogg`, `m4a`. `BOOKS_JS` injects `window.TTSTVHost.books` on its own. `build.rs` and `capabilities/default.json`: the four, nothing else. Module-head paragraph and `SHELL_DIR`'s doc corrected.
- `tests/test_book_door.py` (new, 6). `SYNC.md` §2/§7 and `PHONE.md` §7 said the phone keeps books in the Cache API — reversed, corrected in the same commit.

**Boundary.** TTSTV: `settings/` (settings.js, one test), `library/` (import.js, README line, two tests), `reader/context.js`, `design/reader/settings-bench.js`, and `clean/` by `export.py --shell`. `core/` untouched. Three module folders, one job: the prompt names each file (import.js + context.js + settings.js); it is not a move. Phone repo: `src-tauri/src/lib.rs`, `build.rs`, `capabilities/default.json`, `tests/test_book_door.py`, `SYNC.md`, `PHONE.md`, and `shell/` + `shell.manifest.json` by `import_shell.py`.
**Left alone, dirty before this session:** TTSTV `PROMPTS/phone-pull.md` (untracked); phone repo `shell/library/library.json` (deleted), `gen/apple/frank.xcodeproj/project.pbxproj`, `…/frank_iOS.xcscheme`, `frank_iOS/Info.plist`, `frank_iOS.entitlements`, `scratch-float/`, `scratch-j13/`, `scratch26b/`.
**Commit check.** Every commit pathspec-only, `GIT_OPTIONAL_LOCKS=0`, message file in the session home, `git show --stat HEAD` = exactly the files meant. TTSTV `4e995d3` (3 files) · `2a1c1eb` (5) · `194bbd0` (4); phone `0a8240a` (4) · `f6f6554` (6). HEAD did not move under me in either repo. No `--amend`, no `-a`.
**Footprint.** Container only: Chromium harness + `/tmp` copies of 6 shell files; shallow GitHub clones of tauri 2.11.5, wry 0.55.1, WebKit's DOMCache.cpp and w3c/ServiceWorker (to cite, not to build). VM: a symlink shadow of TTSTV in the session home for the HEAD counts. No SSD, no GPU, no Kaggle, no Modal — 0 GPU-minutes.

### 3. What the numbers are
**Stage 0 — reproduced** (container Chromium 141 headless, from `http://localhost:<port>/`, a secure context):
- `caches.open("t").then(c => c.put("frank://localhost/books/x/book.json", new Response("{}")))` → **`TypeError: Failed to execute 'put' on 'Cache': Request scheme 'frank' is unsupported`**
- the same call on `http://localhost/books/x/book.json` → **ok**, and `match` finds it. `cache.add(frank://…)` → the same TypeError. `caches.keys()` → `["t"]`; `cache.match("frank://…")` → `undefined`, no throw.
- WebKit, the phone's engine (WebKit main `52ff189c`, `Source/WebCore/Modules/cache/DOMCache.cpp`, `requestFromInfo`): `if (!request->url().protocolIsInHTTPFamily()) … return Exception { ExceptionCode::TypeError, "Request url is not HTTP/HTTPS"_s };` — and `doMatch` passes `&requestValidationFailed`, so a bad-scheme **match resolves "no match" instead of throwing**. That is exactly why `listInstalled` passed and the first `put` died.
- Spec (w3c/ServiceWorker `index.bs`, `92aba3b`): Cache `put(request, response)` — "If innerRequest's url's scheme is not one of "http" and "https" … return a promise rejected with a TypeError" (line 2167; `addAll` line 2106). Start Register — script URL and scope URL "not one of http and https → reject with a TypeError" (lines 2730, 2741), and `ServiceWorkerContainer` is `[SecureContext]`: no worker can answer `frank://`.
- wry's rule for the scheme: phone repo `src-tauri/src/lib.rs` `shell_origin()` — `frank://localhost` on iOS/macOS, `http://frank.localhost` on Windows/Android (wry maps a custom scheme to http there).
- The line Osca could not see, as the bench now prints it: `Request url is not HTTP/HTTPS`.

**Stage 1 — the failure is seen** (`settings/settings.js`, `finish()`/`paint()` + one state variable):
- node (minidom, phone page `frank://localhost/settings/settings.html`, stubbed `runDriveSync` → `{ok:false, why:"X"}`): `.tr-state` = `"X"` after the press **and after `paint()`**; `why: ""` → `"Sync failed"`; a good press → `Last synced … · 26 books · 3 marks`, `.tr-say` `Pulled 26 books`. **RED at HEAD**: `.tr-state` `Never synced`, `.tr-say` `X`.
- `design/reader/settings.html` (the real settings.js), new bench switch `drive press: fails`, Chromium 393×852 mobile: the line walks `Connecting to Drive… → Pushing marks… → Pushing position… → Asking what Drive has… → Pulling 1 of 26 · Les Pensées → … · 0/31 → Request url is not HTTP/HTTPS`; after `paint()` unchanged; `.tr-state` top **154 px**. HEAD's settings.js on the same bench: `Never synced`, the reason in `.tr-say` at top **988 px — below the 852 px viewport**. `drive press: pulls` still ends `Last synced 12:15 · 3 books · 12 marks` / `Pulled 1 book`, 0 page errors.

**Tests, before → after** (VM, pytest 9.1.1 from `scratch/_studio_chrome/pylibs`; "before" = HEAD's files in a symlink shadow):
- `library/tests` + `settings/tests`: **367 passed + 1 xfailed → 376 passed + 1 xfailed** (+6 `test_import_store.py`, +2 `test_library_context.py`, +1 `test_sync_drive.py`). `library/tests` alone 247 + 1 xfailed; `settings/tests` 129.
- `test_import.py`, `test_library_import.py`, `test_store.py`, `reader/tests/test_library_store.py`, `test_sw_books.py`: **unchanged, pass** (59) — the Cache store is the old code moved.
- `reader/tests`: 207 passed, 3 skipped (unchanged).
- Phone repo `tests/`: **89 passed, 1 skipped, 4 failed** — `test_book_door.py` 6/6 (the last one failed before the shell import, as written); the 4 failures read files this job did not touch and fail at HEAD: `test_pair_link` (tauri.conf.json's scheme list gained Google's in 668142a), `test_phone_loop` ×2 (project.yml's PATH line), `test_phone_shell` (untracked `scratch26b/sync_md_patch.py`).
- Rust: cargo unreachable from the bridge. The std-only half of the door + `mod book_tests` (7 tests) extracted and compiled with **rustc 1.95 `--test`: 7 passed, 0 warnings**; the four `#[tauri::command]` wrappers type-checked (rustc, exit 0) against a mock of `tauri::ipc::{Request, InvokeBody}` / `http::HeaderMap` with tauri 2.11.5's signatures.

**The loop:** `git status --short` over the shell files before the build — only this lane's, committed. `python3 design/export.py --shell` → 61 files, 4 changed (`clean/library/import.js`, `clean/reader/context.js`, `clean/settings/settings.js`, `MANIFEST.json`). `--shell --verify` → **`VERIFY 56 identical, 5 known-and-named, 0 DRIFT`**, `ROUTES 159 … 0 land somewhere else`, exit 0. `python3 -m reader.tools.publish_shell --no-bump` → **exit 0**, 58 files, 1940.7 KB (after moving the old `out/shell` aside — see §5). Phone: `python3 tools/import_shell.py --ttstv <TTSTV>` → 59 files, 1,987,466 bytes, from `194bbd0` @ `ttstv-shell-v54`, and **`google: not carried -- no google.ios_client_id in …/TTSTV/depot/studio/account.json`** (the bridge's depot; google.json, tauri.conf.json, project.yml md5-identical before and after — 668142a's id stands). `md5sum languages/catalogue.json` `304915f7…` at the gate and at the last commit.

### 4. What was NOT done
- **`cargo test` / a build.** No cargo from the bridge (crates.io 403). The Rust is compiled only in the two partial ways in §2.
- **Nothing pressed on a phone or the simulator.** Every claim about WKWebView is from WebKit's source, not a run: no WebKit engine in the container (Playwright's is not installed; `tests/webkit_smoke.mjs` needs `npx playwright install webkit` on the Mac).
- **The time of one 5 MB `put`** — cannot be measured here. Osca reads it (§7).
- `SHELL_CACHE` not bumped (`--no-bump`, as asked): the phone reads its shell embedded, but an installed PWA keeps v54's files until the next bump.
- `library.html` untouched: its storage line still quotes `navigator.storage.estimate()` — on the phone that is WebKit's origin quota, not the books folder.
- Not touched: `book-nav.js`, `surface.js`, `wordview.js`, the pinch, `settings.js` outside `finish()`/`paint()` (plus the one `var`), anything under the other lanes.

### 5. What broke and how it was found
- **The phone's shelf would have shown nothing** even with the door (context.js, §3) — found by reading `library.html`'s `deviceSection()` against `TTSTVContext.decide()`, then pinned by `test_on_frank_the_books_a_sync_pulled_are_on_the_shelf_and_open`.
- **`publish_shell --no-bump` exited 1 first time**: `build_shell` `rmtree`s `out/shell`, and the bridge cannot unlink (`PermissionError … 'lookup.js'`). Nothing was removed (refused on the first file). Moved aside: **`_to_delete/out-shell.1789130260`** (TTSTV), then exit 0. `import_shell.py` did the same itself: **`_to_delete/shell.1789130268`** (phone repo).
- Locks moved after each commit (the bridge cannot unlink them): TTSTV `_to_delete/HEAD.lock.*`, `next-index-*.lock.*` (3 commits); phone repo the same (2 commits). For Osca to clear.
- `test_import.py::test_progress_counts_every_file_and_ends_at_one` pins the zip door's last progress at n-1, which conflicts with "onProgress reaching 31/31" if both doors share it — resolved by giving only `importFiles` the final n/n (§6).
- My own first context test passed a row it should have failed: node's `globalThis.crypto` ignores plain assignment, so "no crypto.subtle" was never set up. It overrides with `Object.defineProperty` now and the row fails the way it should.

### 6. Decisions made on Osca's behalf
- **Books root** `<app_data_dir>/books/`, beside `shell/`; a version lands in `.part/<slug>@<hash>/` and `book_meta` swaps it in, so a half-pulled book has no row and the installed version is untouched (the promise the Cache store already made). Folder = slug, not slug@hash, because the reader asks `books/<slug>/…`.
- **Meta shape** = import.js's own meta object, stored verbatim as `.meta.json`; the hash also as plain `.hash` so a commit can name what it replaced without a JSON parser.
- **IPC** = raw body + headers (tauri 2.11.5: `ipc::Request`/`InvokeBody::Raw`, the shape of Tauri's own `examples/api` `echo`; `ipc-protocol.js` sends an `ArrayBuffer` view as `application/octet-stream` over `ipc://` on iOS; wry 0.55.1 reads `HTTPBody` or `HTTPBodyStream`). Android never uses the custom-protocol IPC ("does not have support to reading the request body"), so there the bytes arrive as a JSON array — accepted, slowly; Tauri's own doc suggests base64 for Android, owed if Android matters.
- `book_put` is a **synchronous** command (main thread, one `fs::write`) — Tauri's documented raw-request shape; an async variant is a later measurement, not a guess.
- `BOOKS_JS` is its **own** init script, not inside `HOST_JS` (the prompt said HOST_JS): HOST_JS's tests pin "two commands, two invokes", and google_js/PAIR_JS already set the one-script-per-concern pattern.
- **`device` for a host with a door** (context.js) — see §3/§5.
- Only `importFiles` reports n/n at the end of a book.
- `/books/…` falls back to `shell/books/` so `tools/dev_books.py`'s simulator shelf keeps opening.

### 7. What Osca must press
1. `cd "IOS TTS TV/src-tauri" && cargo test` — first. Expect the old tests plus `book_tests` (7).
2. `tools/phone.sh --shell --ttstv ~/Documents/RUNNERS/TTSTV/TTSTV` (on the Mac the import also carries the Google id — its `google:` line should say `already in place`).
3. On the phone: Settings ▸ Sync ▸ **Sync**. Expected: the line walks to `Pulling 26 of 26 · … · n/n`, then `Last synced HH:MM · 26 books · …`, and the note `Pulled 26 books`. If it fails, the reason is now on that line — send it.
4. Library: **On this device** lists the books; tap **Les Pensées** (`blaise-pascal`) — the book must open and a chapter must read.
5. The cost of one put: Xcode's console for the debug build, filter `book_put` — lines like `frank: book_put blaise-pascal@<hash>/audio/c001.opus -- 5242880 bytes in NN ms`. The biggest `audio/` line is the 5 MB answer.

### 8. What is owed
- `cargo test` and the phone press (§7) — nothing here is "done" until then.
- Audio from `frank://localhost/books/…/audio/*.opus` through a handler that ignores `Range`: the dev shelf played through the same handler before (PROBE_JS measured it), so it is expected to work; if a long chapter will not seek, Range support in the handler is the fix.
- Android: base64 or the custom protocol for `book_put` (JSON array today).
- The storage line on the phone's Library measures the wrong store (§4).
- Clear the `_to_delete/` items in §5.

### 9. Questions
- Should `book_put` move off the main thread (`#[tauri::command(async)]`) if the per-file ms in §7 shows jank during a 26-book pull?
- Should the phone's Library stop being a "bench" (`kind: app`, the Sources rail) now that it is a device? Not this job's; the flag is one line in `context.js`.

---

## THE SHELL RE-IMPORTS WITH TWO REGRESSIONS FIXED — 2 across again, and the reader's header out from under the island · 7 Sep

**Osca, 7 Sep:** *"two phone regressions found in the simulator, log both as lost/broken functionality. Repo TTSTV (FRANK), fix in design/ where the loop puts it … Prove both via the phone lane's probe loop."*

The fixes are TTSTV's (`7c41ac9`, and `design/phone/STATUS.md` there carries the
full report, the provenance and the judgment calls). This repo's part is the
proof — the loop that made both measurable — and the re-import.

### 1. Built
Nothing of this repo's own. `tools/import_shell.py --ttstv …` re-imported
`shell/` whole from TTSTV `f8df4c6` + the uncommitted fix, **52 files,
1 402 845 B, `ttstv-shell-v36`** (was v35 at `2b365cd`). The only files that
moved are the two the fixes are in, plus `shell.manifest.json`.

### 2. Verified — and how
Live, on the iPhone 17 simulator (iOS 26.5), through the probe loop: a
`fetch("/__probe?…")` added to `shell/library/library.html` and
`shell/reader/reader.html`, read out of `scratch-probe/probe.log` by the bridge,
each page reloaded by pressing a door. **Both probes were removed before the
import and `shell/` carries none of them.**

- **shelf**, before → after: tile **546×820 → 150×225**, jacket **564×769 →
  149×203**, in a grid that was `150px 150px` / 314 wide both times.
- **reader header**, inset 62: `.head` top **16 → 78**, `.runhead` **10 → 72**,
  `.barrow` 62 throughout. The before column was measured with
  `HEAD:reader/shell.css` put back on the phone, not read off the diff.
- **after the whole import**, both again by eye: the shelf draws two books
  across with their captions, and the reader's title, credit and `<book> r N`
  sit clear of the status bar.
- **The doors keep working across all of it** — `frank: page /library/library.html`
  and `frank: page /reader/reader.html?book=books/<slug>` for `hamlet`, `ethics`
  and `eclogues-virgil`, and the Library door (`.barrow`) pressed by tap.

### 3. Judgment calls
- **The import was run rather than the two files copied.** `shell/` is TTSTV's
  tree written whole, and a hand-copied pair would have been a second source of
  truth. It was safe to run because the tree was already at TTSTV's shell
  (`git status` showed only the two fixed files afterwards).
- **The probes were reverted from a copy kept outside the repo**, so `shell/`
  never carried a measurement into a commit.

### 4. Boundary check
Touched: `shell/library/library.css`, `shell/reader/shell.css`,
`shell.manifest.json`, `STATUS.md`. Still dirty and not mine:
`gen/apple/project.pbxproj`, `frank_iOS/Info.plist`, `frank_iOS.entitlements`,
`xcschemes/frank_iOS.xcscheme`, and untracked `tools/gen_icons.py`,
`scratch-float/`, `scratch-j13/`, `scratch26b/`.

### 5. Footprint
`_to_delete/shell.1788794523` — the previous `shell/`, moved there because this
shell cannot delete inside the repo. Osca empties it.

### 6. Requests to core / other modules
`design/ship.py`'s lane: re-ship root `clean/`, which the desktop Frank loads and
which still has both regressions.

### 7. Known gaps
`test-phone.mjs --pages` not run (no browser on the bridge); landscape (3 across)
unproved; the float still unpressed though its plist key is in the build.

### 8. Next
Rotate the simulator for landscape; then the float — play a chapter and switch away.

### 8b. Commit check
`git add --` then a pathspec commit of exactly `shell/library/library.css`,
`shell/reader/shell.css`, `shell.manifest.json`, `STATUS.md`. No `--amend`.
Gate: `94eea4c`.

### 9. Status line
`IOS-TTS-TV · shell v36, two regressions fixed · 7 Sep · tile 546→150 in its 150px column, header 16→78 over a 62 inset, both measured on the simulator and re-proved after the whole import`

---

## THE SIMULATOR LOOP IS BACK — ▶ needed a wider PATH, `ios dev` is what starts it, and the three doors landed on the first press ever · 7 Sep

**Osca, 7 Sep:** *"take over for phone / IOS, we need to get it running / establish the loop again — I don't want to use my phone right now. Just the simulator."*

The lane ran from Cowork with **no macOS shell**: Terminal and Xcode resolve at
computer-use's `click` tier (see and left-click, never type), the bridge VM is
Linux, and full-screen control was declined. So ▶ is a click, the Simulator is
tap-and-screenshot, and every file edit is the bridge's.

### 1. Built
- **`src-tauri/gen/apple/project.yml`, the `Build Rust Code` phase** — one line
  widened, `export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"`,
  with the comment that says why the 6 Sep note was wrong. The same string is
  patched into `frank.xcodeproj/project.pbxproj`'s `shellScript` by hand, because
  **`xcodegen` cannot be run from here** and the generated file is what ▶ executes.
- **`src-tauri/gen/apple/frank_iOS/Info.plist`** — `UIBackgroundModes: [audio]`
  written in with `plistlib`. It has been in `project.yml` since 6 Sep 15:20 and
  had never reached a build: xcodegen last ran at 14:21 that day (`pbxproj` mtime),
  so job 8b's key was 6½ hours younger than the project it was supposed to be in.
  Xcode now shows **Background Modes ▸ Audio, AirPlay, and Picture in Picture**
  ticked, and this is the first build the float's plist half has ever been inside.
- **No `.rs` and no `shell/` change.** `library/library.html` was instrumented for
  one measurement and restored byte-for-byte from a copy outside the repo.

### 2. Verified — and how
- **live, Xcode build log, 15:42**: with only the cargo line, the phase dies in
  **0.1 s** at `Script-41C9B6A4A06D8F2870160E52.sh: line 3: npm: command not found`.
  The 6 Sep claim that "npm is found because Xcode inherits `/usr/local/bin`" is
  **measured false on this Mac**: `/usr/local/bin` does not exist (the bridge
  refuses the path outright), `/opt/homebrew/bin` does — this is an arm64 Mac and
  node is Homebrew's.
- **live, Xcode build log, 15:44**, after the PATH fix: the phase gets as far as
  `> frank@0.1.0 tauri` and `tauri ios xcode-script`, then panics —
  `crates/tauri-cli/src/mobile/mod.rs:386:59: failed to read missing addr file
  /var/folders/…/T/com.ttstv.frank-server-addr`. **▶ alone cannot do a debug
  build**: in a Debug configuration the phase assumes a dev build and looks for
  the address file `tauri ios dev` writes. ▶ is a participant in the loop, not
  the start of it.
- **live, the simulator, 15:59** (Osca ran `npm run -- tauri ios dev "iPhone 17"`,
  no `--host` — the simulator shares localhost with the Mac): Frank installs,
  launches, and draws the Library. `scratch-probe/probe.log`, this run:
  `cssW=402 cssH=874 cssScreenW=402 cssScreenH=874 band=0 phone=1 fills=1
  safeTop=62 safeBottom=34` — a3ce862's frame still holds at iOS 26.5.
- **THE DOORS' FIRST PRESS.** A tap on a book on the shelf, and the two lines the
  7 Sep run sheet asked for, in order, in `probe.log`:

      frank: page /library/library.html
      frank: page /reader/reader.html?book=books/hamlet

  and the reader drew Hamlet's title pane (Folger credit, `Hamlet r 1` in the
  header). `92efd6e` was proved in Chromium and in cargo and pressed on nothing;
  it is pressed now.
- **The page's own probe reaches Rust in dev.** `PROBE_JS` fetches a RELATIVE
  `/__probe`, and the lines arrive, so `ios dev` is serving this webview through
  the `frank://` scheme handler and not from an http origin — which is also why
  `is_document`'s line fires at all. The dev server's watcher is live: a save in
  `shell/` reloads the phone with nothing rebuilt.
- **not verified**: the library door (a horizontal gesture; the Simulator window
  moved to another Space mid-session and background drags are refused there),
  the float's audio now that the key is in, WebKit outside the simulator.

### 3. Judgment calls
- **The plist key by hand rather than a Release build.** Flipping the scheme to
  Release would have dodged the addr-file panic without a CLI, and it would have
  taken `debug_assertions` — and with it every probe line — out of the binary.
  The probe log is the only eye this lane has; Debug plus one typed command is
  the cheaper trade.
- **`xcodegen` not run, and not worked around.** Its two other outputs are the
  `AVFoundation`/`SafariServices` `sdk:` lines, and those turn out **not to be
  load-bearing**: all three `.m` files use `#import <Framework/…>` and `build.rs`
  compiles them with `-fmodules`, so clang autolinks both frameworks. That is why
  the 6 Sep 20:20 build linked with neither named in the `pbxproj`.
- **The instrumentation was reverted before it proved anything**, because the
  doors answered first. It is worth keeping as a technique: a `fetch("/__probe?…")`
  added to a handler in `shell/` is a measurement the bridge can read, and the
  watcher delivers it without a build.

### 4. Boundary check
- Touched: `src-tauri/gen/apple/project.yml`, `STATUS.md`. Patched but LEFT
  UNCOMMITTED because they were already dirty before this session (Osca's Xcode):
  `frank.xcodeproj/project.pbxproj`, `frank_iOS/Info.plist`. Untouched:
  `frank_iOS.entitlements` (dirty, not mine), all of `src-tauri/src/`, all of
  `shell/`, TTSTV.
- `xcodegen generate` regenerates both patched files from the committed
  `project.yml`, so the fix survives the next run; the plist key does too.

### 5. Footprint
Nothing added to the repo. One copy of `library/library.html` under the bridge's
own `$HOME` for the revert; nothing written to the SSD.

### 6. Requests to core / other modules
None. `tools/phone.sh` and `PHONE.md` §0 still describe the real-device loop and
are unchanged by this.

### 7. Known gaps
- **The reader's header is drawn under the Dynamic Island.** `safeTop=62` is
  reported by the probe and the Library's header respects it; the reader's does
  not — "Hamlet", the Folger line and `Hamlet r 1` all sit in the status bar's
  band. First sighting; nobody has looked at the reader's phone header on a
  device before today.
- **The shelf is one book per row at 402 px.** `library.css` line 287,
  `@container shelf (max-width: 620px) { #shelf[data-zoom="4"] .shelfgrid
  { --cols: 1 } }`, and the phone has no zoom bar to change it — so the phone is
  pinned to the widest tile the grid can draw. Not a fight between two grids
  (that one is fixed); a decision that reads wrong on a phone.
- The library door, `openStudio`/`openSettings`/`openPair`/`reveal` (still absent),
  and the float's audio are all still unpressed.

### 8. Next
1. The library door and a second book, once the Simulator window is on the
   current Space (a horizontal swipe cannot be delivered off-Space in the
   background).
2. The reader's phone header against `safeTop` — the fix belongs in TTSTV's
   `design/`, not in `shell/`.
3. The float: the key is in the build now, so play a chapter and switch away.

### 8b. Commit check
`git add -- src-tauri/gen/apple/project.yml STATUS.md` then a pathspec commit of
exactly those two. No `--amend`. HEAD at the gate: `4c49fb1`.

### 9. Status line
`IOS-TTS-TV · the loop is back · 7 Sep · ▶ needed /opt/homebrew/bin, the debug build needs `ios dev` running, and the three doors landed on the simulator on their first press — library.html → reader.html?book=books/hamlet in probe.log`

---

## THE THREE DOORS — `openReader` / `openLibrary` / `openWindow` were absent, so a tap on a book did nothing · 7 Sep

**Osca, 7 Sep:** *"Checked disk 7 Sep: none are present (count 0), so a tap on a book on the phone does nothing (`window.open` is inert in a WKWebView). Add them as same-webview navigations … No `window.open` anywhere on the phone."*

Confirmed at the gate, `HEAD` = `2b365cd`: in `src-tauri/src/` the count of `openReader`, `openLibrary` and `openWindow` was **0, 0, 0**; in `shell/` it was **13, 2, 12**. `shell/library/library.html::openReader` asks the host first and falls through to `window.open`, and on the phone **both ends were dead** — the shelf reached for a call a WKWebView ignores silently, and nothing moved.

### 1. Built
- **`src-tauri/src/lib.rs`, `HOST_JS`** — three doors, all navigations of THIS webview (`go(url)` → `window.location.assign(url)`), and one place that builds a URL:
  - `urlFor(kind, slug, unit)` — `desktop/src-tauri/src/tabs.rs::url_for`'s shape, absolute because `frank://localhost/`'s paths are the site's paths: `/library/library.html` · `/settings/settings.html` · `/reader/reader.html[?book=books/<slug>[&ch=<unit>]]` · studio = the base (`/` or `/?slug=<slug>`).
  - `TTSTVHost.openReader(slug, unit?) -> Promise<string>`, `TTSTVHost.openLibrary()`, `TTSTVHost.openWindow(kind, slug)` — the last keeping `desktop/src/host.js`'s rule that a first argument which is not a kind (`reader`/`studio`/`library`) is a reader slug, because `library.html` calls `openWindow(slug)`.
  - `enc = encodeURIComponent` on the slug and the unit only, exactly as `url_for` percent-encodes them and not the `books/` prefix.
  - **No door is a command**: `invoke(` is still 2 in the whole object (`sync_discover`, `frank_search`).
- **`src-tauri/src/lib.rs`, the scheme handler** — a debug-only probe line for every DOCUMENT request: `frank: page /reader/reader.html?book=books/<slug>`. Recorded in the handler and not from the page, because a page that is navigating away is being torn down and a `fetch` it started is not owed a delivery. `fn is_document(path)` — the index or `.html`, so it is one line per page and not one per asset.
- **`tests/doors_are_navigations.mjs`** (new, 241 lines) — six cases, `HOST_JS` read out of `lib.rs` verbatim and never retyped, `shell/` served as `search_lands_once.mjs` serves it.
- **`src-tauri/src/lib.rs` tests** — `the_three_doors_are_navigations_of_this_webview` and `a_document_is_what_the_doors_probe_line_counts` added; 25 → 27 `#[test]` in the file.

### 2. Verified — and how
Numbers, `HEAD` → now:

| | `HEAD` (`2b365cd`) | now |
|---|---|---|
| `lib.rs` | 2 171 lines, 102 891 B | 2 305 lines, 110 956 B |
| `HOST_JS` | 21 lines, 1 180 B | 64 lines, 3 794 B |
| `openReader` / `openLibrary` / `openWindow` in `HOST_JS` | 0 / 0 / 0 | 2 / 2 / 3 |
| `window.open` in `HOST_JS` | 0 | **0** |
| `location.` in `HOST_JS` | 0 | **1** (`go`) |
| `invoke(` in `HOST_JS` | 2 | 2 |

- **live, Chromium in the cloud container** (`node tests/doors_are_navigations.mjs`, the real `shell/`, book `eclogues-virgil`) — **all six cases pass**:
  1. `HOST_JS` absent: a `dblclick` on the tile makes the shelf reach for `window.open` — *that is the bug, reproduced*;
  2. `HOST_JS` present, desktop viewport, double-click: **navigations requested to the reader = 1**, the URL `= /reader/reader.html?book=books/eclogues-virgil`, the webview ends there, **popups = 0, `window.open` calls = 0, page errors = 0**;
  3. phone viewport (393×852), one tap (`isPhone()` — "ON A PHONE A TAP OPENS"): the same one URL, popups 0;
  4. the doors called against `url_for`'s own table, `HOST_JS` run as `new Function("window", HOST_JS)` over a stand-in window (a real page will not let `window.location` be redefined) — 8 of 8 exact:
     `openReader("poems")` → `/reader/reader.html?book=books/poems` · `openReader("poems","c018")` → `…&ch=c018` · `openReader("a b/c")` → `…?book=books/a%20b%2Fc` · `openLibrary()` → `/library/library.html` · `openWindow("poems")` and `openWindow("reader","poems")` → the reader URL · `openWindow("library")` → the Library · `openWindow("studio","poems")` → `/?slug=poems`;
  5. `window.open` calls from the host object = 0, and the literal string is absent from `HOST_JS`;
  6. from the reader: `#librarydoor` is still `href="../library/library.html"` (a plain link, which a WKWebView follows), and `TTSTVHost.openLibrary()` lands on `/library/library.html`, popups 0. **The Library door returns.**
- **unit, cargo in the cloud container** — `lib.rs` and `search.rs` items extracted **by regex, verbatim** into a dependency-free crate (`HOST_JS`, `PROBE_PATH`, `is_document`, `search::CMD`, `search::DOOR` + the four tests); the extractor asserts every non-comment line it emitted is present verbatim in the sources (0 missing), then `cargo test --offline`: **4 pass, 0 fail**.
- **unit, python** — `python3 -m pytest tests` on the tree in the container: **82 pass, 2 skip, 1 fail**. The failure is `test_phone_shell.py::test_the_app_names_no_shell_file_of_its_own`, on `scratch26b/sync_md_patch.py` naming `drive.js` — **another session's untracked scratch folder, red before this step and untouched by it**.
- **live, the bridge VM** — `python3 tools/prebuild.py --dev`: `shell/` verified, 51 files, 1 395 469 B, `ttstv-shell-v35`; 6 dev books. Unchanged by this step.
- **not verified: the phone.** No cargo, no Xcode and no simulator is reachable from Cowork (`ttstv-where-things-build`), so `cargo test` on the real crate, the rebuild and the simulator press are Osca's — the run sheet is §8.
- **Invariant**: `shell/` untouched (prebuild's byte count and manifest identical); `invoke(` still 2, so no new command and no capability needed; `build.rs` and `capabilities/default.json` unchanged.

### 3. Judgment calls
- **The prompt says "Add them … No `window.open` anywhere on the phone", and `lib.rs` carried a test asserting `!HOST_JS.contains("location.")`.** Those cannot both stand. `CLAUDE.md`: *the newer dated line wins, and a `> go` from Osca is dated today.* So the blanket form (written 6 Sep, when `search` was the whole object) is **deleted in this commit** and replaced by the half that still holds: `window.open` is still banned outright, and `location.` is pinned to **exactly one** occurrence, `go`'s. The old line is quoted in the new test's comment rather than left on disk beside its reversal.
- **A comment cannot name the banned string.** The ban is a dumb literal check and its value is that it is dumb, so `HOST_JS`'s own comment says "the `open()` a page calls on `window`" instead — and says why.
- **The probe line is the crate's, not the page's.** Osca asked for a probe.log line on the tap. A `fetch` fired from a page that is navigating away can be cancelled, so the line is written where the navigation must arrive anyway: the `frank://` scheme handler, on any document request, debug only.
- **Studio, on a phone with no Studio page.** `url_for`'s Studio is the base itself; here `/` is `index.html`, which redirects to the Library. Kept `url_for`'s shape (Osca: *"per the desktop `url_for` shape"*) rather than inventing a phone-only answer, and said so in the code. No caller reaches it today.
- **`openStudio` and `openSettings` were not added.** Osca named three; `library.html`'s Studio button still falls through to `window.open` and is therefore still dead on the phone. Named in §7, not fixed silently.
- **Absolute paths, not relative.** `frank://localhost/` is a real origin whose paths are the site's paths (the `lib.rs` module header), so one string works from `/library/` and from `/reader/` both, and behind a dev server too.

### 4. Boundary check
Touched, all inside this repo: `src-tauri/src/lib.rs`, `tests/doors_are_navigations.mjs` (new), `STATUS.md`. TTSTV untouched by the code change (`desktop/src/host.js` and `tabs.rs` were **read only**, as the source of the URL shape). `shell/` untouched. Not a move and not a re-wire — one folder, so the standard confirmation stands.

**Found dirty and LEFT ALONE** (another session's; not staged, not read for content): `src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`, `src-tauri/gen/apple/frank_iOS/Info.plist`, `src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`, and the untracked `scratch-float/`, `scratch-j13/`, `scratch26b/`.

### 5. Footprint
Nothing added to the repo but the one new test file (11 KB). In `_to_delete/`: `doors-repo.tgz` **12.3 MB** (the tree minus `node_modules`, `target`, `gen/apple/build`, `gen/apple/Externals`, staged so the container could run pytest and Chromium) and two now-empty files, `doors-proof.tgz` and `doors-tools.tgz` — **this shell cannot delete inside the repo**, so they were truncated to 0 B instead; Osca empties the folder. Cloud container only: `/root/doors`, `/root/repo`, and a scratch crate `rscheck` — none of it on the Mac. No venv, no model, no download onto the Mac. The SSD was not touched and is not needed.

### 6. Requests to core / other modules
None. If TTSTV's `desktop/src-tauri/src/tabs.rs::url_for` ever changes shape, `HOST_JS`'s `urlFor` is the one place here that must follow — a comment says so at both ends of the copy, but nothing tests across the two repos and nothing can.

### 7. Known gaps
- **`openStudio`, `openSettings`, `openPair`, `reveal`, `setContext`, `setTarget`, `studioToggle`, `themeToggle` are still absent.** `desktop/src/host.js` has them; the shell guards on each by name and falls back to `window.open` or its own `location.href`. The `location.href` fallbacks work on the phone; the `window.open` ones (the Studio button, `openPair`, `openReader`'s cmd-click branch) do not, and stay dead until asked for.
- **The probe line fires for the Library and every other page too**, not only the reader — one line per document, by design. It is debug-only and simulator-only for the file half.
- **The reader may still refuse the book it is handed** for reasons that are not this door's: a `book-data.js` that will not load leaves the reader on its "nothing to read" path back to the Library. Case 2 above proves the URL and that the page loaded with **0 page errors** on `eclogues-virgil`, not that every book opens.
- **Not proved in WebKit.** `--engine webkit` needs a Mac; only Chromium ran. The doors touch nothing engine-specific (`location.assign`), but that is an argument, not a measurement.

### 8. Next — the run sheet, and it is Osca's
In `~/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV`:

```
cd src-tauri && cargo test          # 27 tests; the 2 new ones are string asserts
cd .. && npm run -- tauri ios dev "iPhone 17"
```

Then, in the simulator: **double-tap a book on the shelf** → the reader opens on that book; **scroll left past the last pane / the library door** → the Library returns. Both lines land in `scratch-probe/probe.log` where the bridge can read them:

```
frank: page /library/library.html
frank: page /reader/reader.html?book=books/<slug>
frank: page /library/library.html
```

The single question that blocks anything after this: **do you want `openStudio` and `openSettings` too** (§7)? Then stop.

### 8b. Commit check
`92efd6e`, pathspec, three paths, one commit — `git show --stat HEAD` lists exactly `STATUS.md` (+92), `src-tauri/src/lib.rs` (+144 −5), `tests/doors_are_navigations.mjs` (new, 240). `git add -- tests/doors_are_navigations.mjs` first, because a pathspec refuses an untracked path. No `--amend`. **`HEAD` did not move under me**: gate `2b365cd`, still `2b365cd` when the commit was made, so every control in §2 was taken on this side of it.

**Locks — four moved into `_to_delete/`, and Osca clears them.** `.git/index.lock` was already there at the gate, **52 498 s old** (6 Sep 21:49, the minute of `2b365cd`) and it made the first `git add` fail outright; it went to `_to_delete/index.lock.1788783858`. After the commit git could not unlink its own three: `_to_delete/HEAD.lock.1788783879`, `index.lock.1788783879`, `next-index-7.lock.1788783879`. This shell cannot delete inside the repo, so a `.lock` git leaves behind is moved, never removed — and it is recreated by the next read command, so the last thing this session did was move it out of the way again.

Left unstaged, another session's, not read for content: `src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`, `src-tauri/gen/apple/frank_iOS/Info.plist`, `src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`; untracked `scratch-float/`, `scratch-j13/`, `scratch26b/`.

### 9. Status line
`IOS-TTS-TV · the three doors done · 7 Sep · openReader/openLibrary/openWindow are same-webview navigations, proved in Chromium and cargo, unpressed on the simulator`


## THE WEBVIEW FRAME — the window was 1100×800 because `inner_size` said so; now the screen's, proved 402×874 on the iPhone 17 simulator · 6 Sep (`a3ce862`)

**Osca, 6 Sep:** *"The WKWebView is 1024×768 and never resizes to the screen … a 560px card centred at x≈262 … an 84pt black band at the bottom."*

### 1. Built
- **`src-tauri/src/lib.rs`** — `desktop_size(builder)`: `.inner_size(1100, 800).min_inner_size(400, 400)` on every platform but iOS, and on iOS **nothing**, because `tao` builds the UIWindow from `inner_size` when one is given (`tao-0.35.3/src/platform_impl/ios/window.rs`: `Some(dim) => CGRect { origin: screen_bounds.origin, size: dim }`, `None => screen_bounds`). That was the bug: the Mac's 1100×800 was the phone's window, root view and webview, and job 2's `frank_webview_fill` filled that box faithfully. `FILL_OUT = 8`; `webview_fill_why` gains code 4. `probe_note(line)`: the process log always, and on a **simulator debug build** (`cfg(all(debug_assertions, target_os = "ios", target_abi = "sim"))`) appended to `PROBE_FILE = <CARGO_MANIFEST_DIR>/../scratch-probe/probe.log`, so a session with no macOS shell reads the numbers off the connected folder. The `/__probe` route and `fill_root_view` both write through it. `PROBE_JS`'s `viewport()` now also reports **`cssW`/`cssH`** (`innerWidth`/`innerHeight`), `cssScreenW/H`, **`band`** (`screen.height − innerHeight`), **`phone`** (`matchMedia("(max-width: 600px)").matches`), and the first-run sheet's rect **`cardL`/`cardR`/`cardW`/`cardIn`** (`.ttstv-settings.fr-gate .fr-sheet`, `getBoundingClientRect`, in ⟺ `left ≥ 0 && right ≤ innerWidth`).
- **`src-tauri/ios/FrankWebView.m`** — `frank_webview_fill` now also walks to `view.window`, sets `window.frame = window.screen.bounds` when they differ, the root-view-controller's view to `window.bounds` with a flexible mask, then the webview to the root's bounds as before; paints window, controller view, root and webview with the shell's `--bg`; writes eight doubles (root after; webview before ×4; **window before** ×2). A size that ever sneaks back into the builder is corrected, and the log says by how much.
- **`.gitignore`** — `scratch-probe/`.
- **`gen/apple/project.yml`, `LaunchScreen.storyboard`** — read, **not changed**: no fixed 1024×768 anywhere. The storyboard is 414×896 with `widthSizable/heightSizable` and safe-area guides — the launch screen only, not the app's view.

### 2. Verified — and how
- **live, the iPhone 17 simulator** (Osca's `npm run -- tauri ios dev "iPhone 17"`, three launches, read off `scratch-probe/probe.log` from the bridge — 12 lines, each launch identical):

  | line | window was | root now | webview | `cssW×cssH` | `screen` | `band` | `phone` | card L..R (W) | `cardIn` | safe T/B |
  |---|---|---|---|---|---|---|---|---|---|---|
  | native fill | 402×874 (first launch: 0×0) | 402×874 | (0,0) 402×874 → (0,0) 402×874 | | | | | | | |
  | `why=load` | | | | 402×778 | 402×874 | 96 | 1 | 16..386 (370) | 1 | 0/0 |
  | `why=resize` | | | | **402×874** | 402×874 | **0** | **1** | **16..386 (370)** | **1** | 62/34 |
  | `why=settled` (1500 ms) | | | | **402×874** | 402×874 | **0** | **1** | **16..386 (370)** | **1** | 62/34 |

  So: `innerWidth === 402`, `innerHeight === 874` (`fills=1`, 2622 = 2622 device px), `matchMedia('(max-width: 600px)').matches === true`, the first-run sheet's rect is inside `0..402` (16 to 386, 370 wide = 402 − 2×16 margin — the phone block's `--ph-margin: 14px` + the sheet's own padding, no longer the 560 px max), and the band is **0** — no black, and what UIKit lays out before the first `resize` is painted in `--bg`, not black. `why=load` is the instant before UIKit's first layout (778 = 874 − 96, the status bar + home indicator region not yet claimed; `safeTop 0`); the `resize` that follows within the same second is the frame settling, and it stays settled. **The prompt's 393×852 is the iPhone 16's screen; the iPhone 17 simulator reports 402×874 and the app fills exactly that** — the invariant is `innerWidth === screen.width && innerHeight === screen.height`, which holds.
- **unit** — `rustfmt --edition 2021 --check` parses the new `lib.rs` (formatting diffs only, 0 errors); a scratch crate in the container compiles the exact `desktop_size` shape (generic `WebviewWindowBuilder<'a, R, M>` + the two `cfg` tail blocks), `cargo check` exit 0; `clang -fsyntax-only -x objective-c -fobjc-arc -fblocks -fobjc-runtime=ios-15.0 -Wall` against stub UIKit headers carrying the real shapes (`window`, `screen`, `rootViewController`, `CGRectEqualToRect`) type-checks `FrankWebView.m`, exit 0. The **real** link and compile is the simulator run above (`aarch64-apple-ios-sim`, the app launched and the fill line came out of it).
- **unit, python** — 81 pass, 4 fail, and the four are **older than this job** and touch nothing it changed: `test_search_sheet.py` ×3 (`lib.rs must not name the command` — `HOST_JS` has named `frank_search` since `2b6582a`; `lookup.js has no SEARCH constant` and `the_shim_runs` — the `5fbb23c` shell moved it) and `test_phone_shell.py::test_the_app_names_no_shell_file_of_its_own` (`scratch26b/`, another lane's untracked folder).
- Invariants: `git show --stat a3ce862` = exactly `.gitignore`, `FrankWebView.m`, `lib.rs`; `HOST_JS`, `PAIR_JS`, `NOW_PLAYING_JS`, `SEARCH_JS`, `build.rs`, `project.yml` untouched; off iOS the window is still 1100×800 / min 400×400 (same two calls, moved into a function).

### 3. Judgment calls
- *"fix in `with_webview` → set the WKWebView frame to its superview's bounds, autoresizingMask …"* → **that was already there (job 2, `3c1137b`) and it was right; the wrong box was the window.** Fixed the cause (no `inner_size` on iOS) and kept the belt: the native fill now sizes the window against its screen too, so the fix is not one `cfg` away from regressing.
- *"root view background = page ground not black"* → was already `--bg` dynamic; extended to the UIWindow and the controller's view, the two layers above it that can show.
- *"prove … 393 × 852"* → proved the screen's own numbers (402×874) and the equality, not the literal; said so above.
- *the numbers need to reach a session without a macOS shell* → a **simulator-debug-only file sink**, baked path from `CARGO_MANIFEST_DIR`, gitignored. Not a device build (no host disk), not a release build (no probe).
- *`min_inner_size` on iOS* → dropped with `inner_size`: tao logs "ignored on iOS" for it and nothing else.

### 4. Boundary check
IOS-TTS-TV only: `src-tauri/src/lib.rs`, `src-tauri/ios/FrankWebView.m`, `.gitignore` (`a3ce862`); this `STATUS.md`. Not a move, not a re-wire. Nothing in TTSTV. **Dirty and left alone** (another session's): `src-tauri/gen/apple/{frank.xcodeproj/project.pbxproj, frank_iOS/Info.plist, frank_iOS/frank_iOS.entitlements}`, untracked `scratch-float/`, `scratch-j13/`, `scratch26b/`.

### 5. Footprint
Mac: `scratch-probe/probe.log` (2.4 KB, written by the app, gitignored); `~/.local` pytest in the bridge VM (~4 MB). Container: `/tmp/crates` (tao, wry, tauri-runtime-wry sources, ~6 MB — **`static.crates.io` answered today**, contrary to the 5 Sep note), `/tmp/chk` (~1 MB). No env, model, SSD, GPU.

### 6. Requests to core / other modules
none. (For the shell lane, one observation, no ask: at 402 wide the first-run sheet is 370 — `--ph-card: 560px` never binds on a phone; fine.)

### 7. Known gaps
- Rotation not measured (the mask covers it; `why=resize` lines will say).
- The four stale python tests above are left failing — `test_search_sheet.py` describes the phone before `2b6582a`/`5fbb23c` and belongs to the search lane's next commit.
- A **device** debug build has no probe file; its numbers are `xcrun devicectl`/Console's.

### 8. Next
The search window job, on the phone: the reader's Search press → the SFSafariViewController sheet, proved on this same simulator — its two log lines (`search.rs:371-372`) want routing through `probe_note` so the URL lands in `scratch-probe/probe.log`, then a rebuild and the press. Blocking question: none.

### 8b. Commit check
`git commit -m … -- src-tauri/src/lib.rs src-tauri/ios/FrankWebView.m .gitignore` → `a3ce862` (3 files, +144 −19); `git show --stat HEAD` listed exactly those. This entry: pathspec, one path. HEAD did not move under me (`42c0c28` → mine). Locks: a stale `index.lock` (another session's, > 3 s) moved to `_to_delete/` on the retry loop's second pass; my own `HEAD.lock` and `next-index-20.lock` moved after (the bridge cannot unlink); 272 `.git/objects/*/tmp_obj_*` git could not unlink either — harmless, Osca to clear `_to_delete/`.

### 9. Status line
`IOS-TTS-TV · the webview frame 1/1 done · 6 Sep · inner_size was the phone's window; 402×874 = screen, band 0, card 16..386, phone media query true — read off scratch-probe/probe.log`

---

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

## job 13 — the search sheet: `frank_search` is a sheet over the reader, and the reader never navigates · 6 Sep

**Osca, 6 Sep:** *"`frank_search` opens an SFSafariViewController from the app, per
`design/reader/search.html`."*

### 1. Built

- **`src-tauri/src/search.rs`** (555 lines) — a Tauri plugin, `search`, with **no command**
  and therefore no ACL entry. `DOOR` (`x-web-search:`), `SEARCH`
  (`https://www.google.com/search?q=`, `reader/lookup.js:251`'s constant), `CMD`
  (`frank_search`) · `encode`/`decode` (`encodeURIComponent` and its inverse, written out so
  the file extracts) · `door_query` · `sheet_url` — the whole routing decision, a pure
  function of a string · `SEARCH_JS` · `present`/`present_why` · `init()`.
- **`src-tauri/ios/FrankSearch.m`** (159 lines) — `frank_search_present(const char *)`,
  `frank_search_top()` (foreground scene → key window → deepest presented VC), and a
  three-line `SFSafariViewControllerDelegate` so Done is heard. One sheet, never a stack.
- **`src-tauri/build.rs`** (+11) — compiles it into its own archive, `franksearch`.
- **`src-tauri/gen/apple/project.yml`** (+5) — `SafariServices.framework`, because a
  `staticlib` crate never runs a linker.
- **`src-tauri/src/lib.rs`** (+2, and exactly two) — `mod search;` · `.plugin(search::init())`.
- **`tests/test_search_sheet.py`** — 10 tests over the four-file wiring cargo cannot see.
- `scratch-j13/` — untracked: `proof.mjs` (18 checks) and the recipe for the Rust extraction.

**One door, two knocks.** The mock's WEB row is already an anchor to
`x-web-search://?<encodeURIComponent(query)>`; the plugin's `on_navigation` sees it,
**cancels the navigation**, and presents the sheet. `reader/lookup.js` invokes
`frank_search`, and `SEARCH_JS` turns that one command name — and no other — into the same
navigation. A second door passes a bare `https://www.google.com/search?q=…` through, so the
sheet still opens if the shim never installs.

**Why not a real command.** `tauri`'s router sends any `cmd` without a `plugin:` prefix to
the app's `generate_handler!` and nowhere else (`webview/mod.rs`, `strip_prefix("plugin:")`),
and with an app ACL manifest present — this crate has one — an unknown command is refused
before dispatch. `frank_search` as a command is three lines in three files (`lib.rs`,
`build.rs`, `capabilities/default.json`), and `lib.rs` was another session's open file today.

**Why cancelling is the proof that back returns to the same reader position.** Nothing
restores the chapter, the word, the scroll or the audio, and nothing needs to:
`WKNavigationActionPolicyCancel` means the load never starts, `didCommitNavigation` never
fires, the document is never torn down. Every road into the sheet is a navigation this
plugin returns `false` for.

### 2. Verified — and how

- **unit, Rust — 12 tests pass.** `search.rs` extracted into a dependency-free crate:
  **525 of 554 lines, 0 not verbatim**, only `use tauri::{…}` (5) and `pub fn init()` (24)
  dropped. Asserted: the five `-site:` domains and their order are the mock's; `SEARCH` is
  `lookup.js`'s; all four spellings of door one; an empty query opens nothing; door two is
  byte-for-byte; `frank://…`, `youtube.com/results?…`, `<lan>:8000/state`,
  `accounts.google.com/o/oauth2/…` and `about:blank` all come back `None`.
- **live — `encode` is `encodeURIComponent`.** A sweep of the first **768 codepoints**
  against node: **byte-identical**, including the ten (`-_.!~*'()`) where
  `NON_ALPHANUMERIC` and Python's `quote(safe="")` each disagree. That is what makes the
  shim's road and `lookup.js`'s own `window.open` road the same URL.
- **live — the real `url` crate.** The anchor's href survives `Url::parse(…).as_str()`
  unchanged; `sheet_url` turns it into
  `https://www.google.com/search?q=Spinoza%20Ethics%20-site%3Agutenberg.org%20…` with all
  five exclusions intact.
- **live, node — `scratch-j13/proof.mjs`, 18 checks, 0 failed**, run on the bridge VM.
  `SEARCH_JS` is sliced out of `search.rs` and `reader/lookup.js`'s own
  `SEARCH`/`searchUrl`/`tauriInvoke`/`last`/`openTab`/`sheet`/`search` are sliced out of that
  file, both verbatim, and RUN. `lookup.js`'s `search("Gerontion")` returns `true`, reports
  `how === "frank_search"`, starts exactly **one** navigation, to door one, and calls neither
  `WebviewWindow` nor `window.open`. With no `__TAURI__` at all it falls to `window.open`
  untouched. `sync_discover`, `audio_session_start` and `google_sign_in` pass through with
  their arguments and start no navigation.
- **live — the injection order, read out of tauri 2.11.3.** `manager/webview.rs`
  `prepare_webview` pushes plugin init scripts at **line 202** and the global API
  (`withGlobalTauri`'s `window.__TAURI__`) at **line 216**. A shim that patched at install
  time would patch nothing, silently. Hence `install()` at document start, at
  `DOMContentLoaded` and at `load` — proved in case B above, where `__TAURI__` is created
  *after* the script runs.
- **live — wry 0.55.1 on iOS.** `wkwebview/navigation.rs::navigation_policy` hands the
  handler the absolute URL of **every** navigation action, whatever the scheme, and `false`
  → `WKNavigationActionPolicy::Cancel`. `x-web-search:` reaches Rust.
- **unit, Objective-C — 0 diagnostics.** `clang -fsyntax-only -fblocks -Wall -Wextra
  -x objective-c -fobjc-arc` against hand-written stub headers for the API surface used.
  Worth exactly what it says: syntax, ARC legality and the shape of every message sent —
  **not** that the selectors are Apple's.
- **unit, python — `python3 -m pytest tests -q`: 84 pass, 1 fails.** The failure is
  `test_phone_shell.py::test_the_app_names_no_shell_file_of_its_own`, and it names
  `scratch26b/sync_md_patch.py` (another session's untracked scratch, `drive.js`). Nothing of
  mine is in it. `tests/test_search_sheet.py` alone: **10 pass**.
- **not verified:** the real crate under cargo on an iOS target (the Cowork container has
  cargo — CLAUDE.md's "no cargo reachable from Cowork" is out of date — but no iOS SDK);
  Xcode; the simulator; the phone; that the sheet actually comes up over the reader.
- **invariant.** No file was written in TTSTV. No server was started and no route was
  pressed, so `languages/catalogue.json` was never at risk and needs no gate.

### 3. Judgment calls

- *`frank_search` must be a command, but a plugin cannot serve a bare name and the three
  files that would register it are another lane's* → shipped `SEARCH_JS`, which intercepts
  that one name and forwards everything else with `apply`. Delete it the day `lib.rs` carries
  the command; the `on_navigation` door stays either way, because the mock's anchor stays.
- *`x-web-search:` means "the default engine" to Safari and to no API* → the sheet opens
  `reader/lookup.js`'s already-decided `https://www.google.com/search?q=`. One constant here,
  one there. **This is the one thing in the job that is a preference, and §8 asks it.**
- *`build.rs` and `project.yml` were not named as mine* → touched anyway, 16 lines, because
  the alternative is an undefined `_frank_search_present` twenty minutes into a phone build.
  Both were clean at 15:20 and the diff is only mine. `lib.rs`'s two lines carry no comment,
  deliberately: it is another lane's file and the why is in `search.rs`.
- *`tests/` was not named as mine* → one new file, additive. The wiring that breaks is in
  four files no compiler reads together.
- *a new `frank-search://` scheme would have been cleaner in the abstract* → kept the mock's
  `x-web-search://`, because it is already written, needs no `CFBundleURLTypes`, and still
  means the right thing in a browser where Frank is not the host.

### 4. Boundary check

Touched: `src-tauri/src/search.rs` (new) · `src-tauri/ios/FrankSearch.m` (new) ·
`src-tauri/build.rs` (+11) · `src-tauri/gen/apple/project.yml` (+5) ·
`src-tauri/src/lib.rs` (+2, named in the prompt) · `tests/test_search_sheet.py` (new) ·
`scratch-j13/` (untracked). TTSTV untouched — nothing was written there; `bar/` untouched,
and the shell needed no new call. Not a move and not a re-wire.

**Found dirty and left alone:** `src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`,
`src-tauri/gen/apple/frank_iOS/Info.plist`, `src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`
(xcodegen output, another session's), and earlier in the session `src-tauri/build.rs`,
`src-tauri/src/lib.rs`, `Cargo.lock`, `STATUS.md`, `tauri.conf.json`, `tools/*.py`,
`tests/test_phone_shell.py`, `shell/` — all of which that session has since committed.

### 5. Footprint

`scratch-j13/` — 14 KB, untracked, internal. `pytest` installed `--user` in the bridge VM
(~5 MB, outside the repo) because it was not there. In the Cowork container, ephemeral:
the `tauri` and `wry` crate sources from crates.io and a throwaway crate, ~40 MB, in `/tmp`.
No env, no model, no download in the repo. Nothing on the SSD; the SSD was not used.

### 6. Requests to other modules

1. **`bar/` — the VIDEOS lane cannot be an iframe.** `design/reader/search.html` frames
   `youtube.com/results?search_query=…`, and `bar/askbar.js`'s own `NO_FRAME` list already
   names `youtube.com` among "hosts that have been SEEN to send `X-Frame-Options`". The two
   files contradict each other. The lane wants either the search tool's own thumbnails with
   a tap into this sheet, or `youtube.com/embed/<id>`, which is frameable.
2. **Whoever next owns `lib.rs`/`build.rs`/`capabilities/default.json`:** if `frank_search`
   becomes a real command (`generate_handler!` + the manifest list + `allow-frank-search`),
   delete `SEARCH_JS` from `search.rs` in the same commit. `test_search_sheet.py` will fail
   loudly until you do.
3. **`lib.rs` carries one stale line** and it is not mine to delete: `audio_session_category`'s
   SAFETY note says `FrankAudio.m` is "linked into the same binary by the Xcode target
   (`gen/apple/project.yml` → sources: `../../ios`)". `project.yml` says the opposite in
   writing ("there is deliberately no `- path: ../../ios`") and `build.rs` is what compiles it.
   `tests/test_float_audio.py` already enforces the correct half.

### 7. Known gaps

- Nobody has pressed it. No Xcode, no simulator, no phone in a Cowork session.
- The engine is Google. `x-web-search:` cannot be honoured by `SFSafariViewController`.
- `SEARCH_JS` wraps a global (`__TAURI__.core.invoke`). It is idempotent, blind to every
  name but one, and has an expiry date written into its own doc comment — but it is a shim.
- `frank_search` on the **Mac** is still unimplemented; `lookup.js`'s second landing (a
  900×700 `WebviewWindow`) still wants one capability line there, as `lookup.js` §6 says.
- The BOOKS lane and the VIDEOS lane are `bar/`'s work, not this one's.

### 8. Next

Osca presses it on the simulator: open the search pane, tap **Search the web**, expect a
Safari sheet over the reader carrying the words and five `-site:` terms, and **Done** back to
the same word. `project.yml` changed, so `xcodegen generate` is not optional (PHONE.md §6e).

**The one question that blocks nothing but should be answered before the 13th:** the sheet
names an engine because it must — **Google, or DuckDuckGo?** Two constants either way.

### 8b. Commit check

Three pathspec commits, each confirmed with `git show --stat HEAD`:

| hash | files |
|---|---|
| `65617f7` | `src-tauri/src/search.rs` · `src-tauri/ios/FrankSearch.m` · `src-tauri/build.rs` · `src-tauri/gen/apple/project.yml` — 4 files, 730 insertions |
| `07140ee` | `src-tauri/src/lib.rs` — 1 file, 2 insertions |
| `57168bd` | `tests/test_search_sheet.py` — 1 file, 180 insertions |

No `git add -A`, no `--amend`. **HEAD moved under me at least four times**
(`acc4b4d`, `3c1137b`, `1a01daf`, `76d577d`) — every number in §2 was taken *after* the last
of them, on the tree that `65617f7` was committed from. `git fetch origin` then
`git rev-list --left-right --count origin/main...HEAD` = **0 behind, 25 ahead**, so
`git pull --rebase` had nothing to do and was not run: it would have refused anyway on
another session's three dirty files. **Locks:** the bridge cannot unlink, so `.git/HEAD.lock`,
`.git/index.lock` and three `next-index-N.lock` were moved into `_to_delete/` after each
commit, per CLAUDE.md's loop. `.git/objects/*/tmp_obj_*` residue from the same cause is
git's own and harmless. `.git/*.lock` is empty now.

### 9. Status line

`src-tauri · job 13 done · 6 Sep · the search sheet is wired and proved without a phone; nobody has pressed it`

---

## job 29 — WebKit first, then dev books: **there is no error, and that IS the error** · 6 Sep

**Osca, 6 Sep:** *"The Library page draws nothing in WebKit (the phone app, and
Safari on the phone), but draws in Chrome."*

**The first error, verbatim, is that there is no first error.** Driven headless
through WebKitWebDriver against real WebKit — **WebKitGTK 2.36**, which is
Safari 15's JavaScriptCore and StyleResolver, and **WebKitGTK 2.52**, which is
Safari 26's — the Library page raises **0 pageerrors, 0 unhandled rejections
and 0 console errors**, in both, at 393×852, over plain `http://` from a
non-secure LAN origin as well as from localhost. It also drew: 6 `.railrow`,
6 `.tile`, `SHELF` in the DOM. Every JS hypothesis was **tested and killed**,
not argued away: the shell parses at ES2020 with acorn and uses nothing newer
(no lookbehind, no `Object.groupBy`, no `Promise.withResolvers`, no modules);
with **every** `localStorage` access rewritten to throw `SecurityError` — the
`frank://` opaque-origin case, and Safari's Block-All-Cookies case — the shelf
still drew 6 rows; with `library.json` and `books/` absent it drew 0 rows and
**still raised nothing**, which is `SHELF · 0`, not a blank page.

**What is actually wrong is a colour, and it cannot raise an error by
construction.** `library/library.css` defined `--bg` and `--fg` twice: the
plain values (`#fcfcfb` / `#0b0b0b`, and the dark pair) and then, in the
warmth block, `color-mix(in oklab, …)`. **A custom property accepts any token
stream**, so the second declaration parses in every engine ever written and
overrides the first — and then, in an engine that cannot COMPUTE `color-mix`
(**Safari before 16.2**), it fails at computed-value time instead:
`background: var(--bg)` and `color: var(--fg)` both become `unset`, and the
page paints on whatever is behind the webview. The plain fallback four lines
above was dead in every engine. Measured, same page, same server:

| | `CSS.supports(color-mix)` | `--bg` computed | `body` background |
|---|---|---|---|
| WebKit 2.36, before | `false` | `color-mix(in oklab, #fcfcfb, …)` | **`rgba(0, 0, 0, 0)`** |
| WebKit 2.36, after | `false` | `#fcfcfb` | **`rgb(252, 252, 251)`** |
| WebKit 2.52, before → after | `true` | `color-mix(…)` | `oklab(0.990791 −0.000372 0.001263)` → unchanged |
| Chromium, before → after | `true` | `color-mix(…)` | `oklab(0.990761 −0.00032863 0.0012874)` → unchanged |

The fix is `@supports (color: color-mix(in oklab, #000, #fff 50%))` around the
three blocks that set `--bg`/`--fg`. A plain declaration placed *after* them
would not work — the same "any tokens are valid" rule keeps the later one.
It lands in TTSTV: **`library/library.css`, FRANK `2df080e`**, and came across
by re-import. `library/library.css` is the **only** file in the whole shell
that defines `--bg` or `--fg` through `color-mix`; `reader/chrome.css` and the
rest already carry `var(--fg, #0b0b0b)` fallbacks inside theirs.

**And the honest limit, said once:** this is the only WebKit-only defect on the
page that a machine in Cowork can find. Whether it is the whole of what Osca
sees depends on the phone's iOS — it bites Safari < 16.2 and nothing newer. If
the phone is on 16.2 or later, the blank is not the page: it is §6c's transport
(`--host`, the ATS key that `xcodegen` has not written yet, Local Network
permission), which PHONE.md already says looks exactly like *"a blank page and
no error"*. §7 says how to tell the two apart in one minute.

### 1. Built
- **`tests/webkit_smoke.mjs`** (new, 239 lines) — serves `shell/` statically
  with correct MIME, opens `/library/library.html` in Playwright's **WebKit**
  under the **iPhone 15** device descriptor, and prints every `pageerror`,
  `console.error` and `requestfailed` **with file:line**, the first one
  verbatim. `--engine webkit|chromium|both` (default both, and it prints the
  per-field diff). Asserts: 0 hard errors · `SHELF` in the DOM · **body
  background is not transparent** — the last one is the guard for the bug
  above, which no console anywhere reports. Then the flow, because a page that
  draws and cannot be used is the same bug one step later: the first-run card
  is present on a first open, gone after **Skip**, and a double-tap on the
  first tile opens `reader.html?book=books%2F<slug>` with > 0 paragraphs
  (`--no-flow` to skip). A 404 is printed as `resource` and never counted —
  Chromium logs one on the console and WebKit does not, so counting it would
  make the two incomparable and would fail the page for asking Studio a
  question no static host answers.
- **TTSTV `library/library.css`** (`2df080e`, the other repo) — the `@supports`
  guard. `--warm`, `--paper-warm`, `--ink-warm` stay outside it; nothing else
  moved, and on an engine WITH `color-mix` every computed value is unchanged.
- **`tools/dev_books.py`** — copies `<TTSTV>/books/<slug>` into `shell/books/`
  and writes `shell/library/library.json` from `<TTSTV>/books/index.json`'s own
  rows plus `has_audio:false, has_timings:false`. Six default slugs. `--clear`,
  `--no-audio`. (Written earlier today in this lane; committed here with its
  tests.)
- **`tools/prebuild.py --dev`** — allows exactly `shell/books/**` and
  `shell/library/library.json` and relaxes nothing else, and names the books it
  found so a run that shows none says so. `beforeDevCommand` is now
  `python3 tools/prebuild.py --dev`; `beforeBuildCommand` is untouched.
- **`tools/shell_manifest.py`** — `DEV_ONLY`, `is_dev_only()`, `check(dev=…)`.
- **`tools/import_shell.py`** — holds the dev shelf across a re-import and takes
  the manifest before restoring it, so the record still names only what TTSTV
  produced. New: **`clear_tree()`** — `rmtree`, and on `Operation not permitted`
  a RENAME into `_to_delete/`, which is the only way a Cowork session can empty
  `shell/` at all; and the hold directory moved from `/tmp` to a sibling of
  `shell/` inside the repo, because `/tmp` is a different filesystem and
  `shutil.move` there is a copy-then-unlink — the unlink being the thing this
  shell cannot do.
- **`shell/` + `shell.manifest.json`** — **in git for the first time**
  (`0e799ec`, 53 files): 51 shell files, 1 366 671 bytes, from FRANK `2df080e`
  @ `ttstv-shell-v35`. `prebuild.py`'s whole design is that the shell is
  carried here so a fresh clone builds with no TTSTV on the disk; it was
  untracked only because the import could not run from this shell until today.
- **`tests/test_dev_books.py`** (new, 12 tests) and 1 new test in
  `tests/test_phone_shell.py`.

### 2. Verified — and how
- **live, container** · **WebKitGTK 2.36 (Safari 15) and 2.52 (Safari 26)**,
  headless via `WebKitWebDriver` + `xvfb`, on the freshly imported shell:
  **0 hard errors** in both. 2.36: `railrow 6`, `tile 6`, `shelfInDom true`,
  `firstRunCard true`, `supportsColorMix false`, `--bg #fcfcfb`, body
  background `rgb(252, 252, 251)`. 2.52: `railrow 6`, `tile 6`, `--bg
  color-mix(…)`, body background `oklab(0.990791 −0.000372 0.001263)`. The one
  non-error in both: `books/ethics/cover.jpg` 404 — **`ethics` has a
  `cover.json` and no `cover.jpg` in TTSTV**, which is book data, not the shell.
- **live, container** · `node tests/webkit_smoke.mjs --engine chromium` on the
  same tree: `ERRORS: 0 hard, 13 other`; `railrow 6`, `tile 6`; UA
  `…(iPhone; CPU iPhone OS 17_5…)` — the iPhone 15 descriptor is really applied;
  **FLOW**: `firstRunCardOnOpen true` → Skip → `firstRunCardAfterSkip false`;
  double-tap → `reader/reader.html?book=books%2Feclogues-virgil`, **885
  paragraphs**. `webkit_smoke: OK`.
- **live, bridge VM** · the re-import: *holding the dev shelf: books/,
  library/library.json* → *clearing shell/: could not delete (Operation not
  permitted); moved to `_to_delete/shell.1788707662`* → **51 files, 1 366 671
  bytes, from 2df080e @ ttstv-shell-v35**. Afterwards `sed -n 51p
  shell/library/library.html` is exactly
  `<script>window.TTSTVSettings.firstRun(document);</script>` — **the gate is in
  the copy**, which the 5 Sep shell did not have. Six books and a 61-line
  `library.json` survived it.
- **live, bridge VM** · `python3 tools/prebuild.py --dev` → **exit 0**,
  *"dev shelf — 6 book(s): eclogues-virgil, ethics, euthyphro, hamlet,
  self-isolation-poems, singapore-story-c1"*. `python3 tools/prebuild.py` →
  **exit 1**, 14 sentences, each naming a `book.json` or `book-data.js`.
- **unit** · `python3 -m pytest tests -q` → **75 passed**, 0 failed (62 at
  HEAD, 2 of which were failing on the dev shelf and are now asked in the right
  mode; 13 added).
- **unit** · acorn at ES2017…ES2022 over every `.js` and every inline
  `<script>` in the shell: nothing needs more than **ES2020**, and the two
  ES2018 hits are object spread. No lookbehind anywhere.
- **not verified**: the simulator, any phone, `cargo`, `xcodegen`. None is
  reachable from Cowork. **Playwright's own WebKit could not be downloaded at
  all** — `cdn.playwright.dev` and `playwright.download.prss.microsoft.com` both
  answer *"request blocked: no rule or allowlist entry allows host"* from the
  container AND from the bridge VM, which is why the WebKit numbers above come
  from distribution WebKitGTK instead. `tests/webkit_smoke.mjs`'s WebKit half
  has therefore **never been run**; its Chromium half has, on the real tree.
- **invariant** · TTSTV's `reader/sw.js` is untouched (`ttstv-shell-v35`, no
  `--bump`), `git status` in TTSTV shows only another session's
  `PROMPTS/day-6-sep.md`; no server was started and no route pressed, so
  `languages/catalogue.json` was never opened.

### 3. Judgment calls
- *"Find the error … paste the first error verbatim"* → **there is no console
  error, and I say so rather than manufacturing one.** Reporting a fabricated
  first line would have been the worse answer; the measured 0s, in two WebKit
  versions, are the finding.
- *`npx playwright install webkit`* → **blocked by egress in both shells.** I
  did not stop: `apt` reaches `archive.ubuntu.com`, so the diagnosis ran on
  `webkit2gtk-driver` 2.52 (noble) and 2.36 (jammy, extracted from the .deb and
  run against its own libs). 2.36 is the important one — it is the only engine
  on the machine old enough to be the phone.
- *"the fix lands in TTSTV … name the file"* → `library/library.css`, and I
  edited **only** the library crown there. The same class of bug is not present
  in any other module's CSS; I checked rather than assumed.
- Step 5's *"double-tap a tile → reader.html?book=…"* → the page does this with
  `window.open(url, "_blank")`, so the proof captures a **popup**, not a
  navigation. That is also §7's warning about the app.
- The dev shelf's tests were written against **fixture trees**, not against the
  real `shell/`, so they pass on a machine that has never run `dev_books.py`;
  the one test that needs a real shelf skips itself when there is none.
- `shell/` was untracked. Committing it is not scope creep — `prebuild.py`'s
  docstring says the shell is carried in git and `.gitignore` already excludes
  every book — but it is a 53-file commit and is named here for that reason.

### 4. Boundary check
This repo, and only these files:
`tests/webkit_smoke.mjs` · `tests/test_dev_books.py` · `tests/test_phone_shell.py` ·
`tools/dev_books.py` · `tools/prebuild.py` · `tools/shell_manifest.py` ·
`tools/import_shell.py` · `src-tauri/tauri.conf.json` · `shell/**` (51, written
by the import) · `shell.manifest.json` · this file.
In TTSTV: `library/library.css` and `library/STATUS.md` — **one module**, the
library crown, and nothing else. `core/` untouched in both repos. **Not** a move
or a re-wire; no second folder was needed.

**Dirty and left alone, because they are another session's** (job 15c, the
SFSafariViewController search, and job 8b's generated Apple tree):
`src-tauri/build.rs`, `src-tauri/gen/apple/project.yml`,
`src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`,
`src-tauri/gen/apple/frank_iOS/Info.plist`,
`src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`,
`src-tauri/ios/FrankSearch.m`, `src-tauri/src/search.rs`, `scratch-float/`,
`scratch26b/`. In TTSTV: `PROMPTS/day-6-sep.md`. `src-tauri/src/lib.rs` was
modified by that session mid-job and was **never touched here** — the prompt
forbids it and so does the boundary.

### 5. Footprint
- **Cowork container** (nothing on the Mac): `webkit2gtk-driver` 2.52 + `xvfb`
  via apt (~120 MB), jammy `webkit2gtk` 2.36 .debs extracted under
  `~/wk/j22/root` (~90 MB), `npm i playwright` + `acorn`, and the staged shell
  copies under `~/wk*`. All ephemeral; the container is thrown away.
- **Bridge VM**: `playwright` and `pytest` installed into the repo's gitignored
  `node_modules/` (`--no-save`, so `package.json` and the lock are untouched)
  and `~/.local` respectively.
- **The repo**: `_to_delete/` gained `shell.1788707662` (the pre-import shell,
  50 MB with its dev books), four staging tarballs, a scratch copy of
  `webkit_smoke.mjs`, `__rmtest`, and **five `.git/*.lock` files this shell
  could not unlink** — three from TTSTV, two from here. Osca empties it.
- No SSD, no depot, no models, no GPU. Kaggle/Modal: not used, no quota spent.

### 6. Requests to core / other modules
- **reader/ (or whoever owns `openReader`)** — `library.html`'s `openReader`
  falls back to `window.open(url, "_blank")` when no host offers
  `TTSTVHost.openReader`. **A WKWebView does not open a `_blank` window unless
  the app implements `WKUIDelegate.createWebViewWith`**, so on the simulator and
  on the phone a double-tap is likely to do *nothing at all*. The fix is one
  method — `TTSTVHost.openReader(slug)` setting `location.href` — and it lives
  in `lib.rs`'s `HOST_JS`, which this job was told not to touch. It is the next
  thing after the Library draws.
- **parser/ or the book owner** — `books/ethics/` has `cover.json` and no
  `cover.jpg`; every load of the shelf 404s on it in every engine.

### 7. Known gaps
- **`tests/webkit_smoke.mjs` has never been run against Playwright's WebKit** —
  that download is not on the egress allowlist from anywhere in Cowork. Its
  Chromium half ran; the WebKit assertions are the same code path.
- **How to tell the colour bug from §6c's transport, in one minute**, on the
  phone: Safari → Develop → *iPhone 2* → Frank, and type
  `getComputedStyle(document.body).backgroundColor`. `rgba(0, 0, 0, 0)` on a
  build from before `2df080e` is this bug and this fix ends it. A page that is
  not there at all — no console, no Frank in the Develop menu — is §6c: `--host`,
  the ATS key `xcodegen` has not written yet, or Local Network permission.
- The dark-theme half of the fix is proved by the same mechanism but was
  measured light-only; the guard covers all three blocks.
- `dev_books.py` copies whole book folders — `hamlet` alone is 22 MB and the six
  are ~49 MB under `shell/books/`. Gitignored, never shipped, but it is real
  disk on the Mac.

### 8. Next
Step 4's run, which is Osca's: the simulator. The one command is at the end of
this entry. Nothing else is started.
**The single question that blocks nothing but would sharpen §7: which iOS is
the phone on?** Below 16.2 and this fix is the whole answer; 16.2 or above and
the blank is the transport.

### 8b. Commit check
Two commits here, both by pathspec, both `git show --stat`-confirmed:
`1a01daf` (8 files: the tools, the tests, `tauri.conf.json`) and `0e799ec`
(53 files, every one under `shell/` plus `shell.manifest.json`). One in TTSTV:
`2df080e` (2 files: `library/library.css`, `library/STATUS.md`). No `--amend`,
no `git add -A`, no directory pathspec. New files were `git add`ed by their own
single path first.
**Locks moved to `_to_delete/` for Osca to clear**: TTSTV `HEAD.lock`,
`next-index-16.lock`, `index.lock`; here `HEAD.lock`, `next-index-8.lock`,
`next-index-16.lock`. Each was a `File exists` failure the retry loop then got
past; nothing was lost.

### 9. The one command
```bash
cd "/Users/oscarwilson-brown/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV" && npm run -- tauri ios dev "$(xcrun simctl list devices available | sed -n 's/^ *\(iPhone [^(]*[^ (]\) *(.*/\1/p' | tail -1)"
```
It picks the newest **simulator** `xcrun` actually lists, so it can never
select *iPhone 2* — the physical phone this job was told not to touch — and
`beforeDevCommand` prints the six books before Xcode starts.

---

## jobs 1, 2, 3 — the black bar was wry's frame; the audio is owed a simulator · 6 Sep

### 1. Built
- `src-tauri/ios/FrankWebView.m` (new, 95 lines) — `frank_webview_fill(void *webview, double *out)`.
  frame = superview **bounds**, `autoresizingMask = flexibleWidth|flexibleHeight`, and both views
  painted with the shell's own `--bg` (#fcfcfb / #131316, `colorWithDynamicProvider:`). Writes six
  doubles back for the caller's log. `0 ok · 1 no pointer · 2 not a UIView · 3 no superview`.
- `src-tauri/build.rs` — a second `cc::Build` compiling it into its own archive (`frankwebview`),
  plus `rerun-if-changed` and a `UIKit` link line; and a sentence saying the `rustc-link-lib`
  lines reach no linker, because a `staticlib` crate never runs one.
- `src-tauri/src/lib.rs` — `webview_fill_why`, `fill_root_view` (the `with_webview` call, iOS only),
  `PROBE_PATH` + `PROBE_JS`, the `/__probe` branch in the scheme handler, the window bound so it can
  be filled, and the corrected SAFETY note over `audio_session_category`.
- `src-tauri/Cargo.lock` — committed at last (job 1).

### 2. Verified — and how
- **unit** — 74 of 75 python tests pass. The one failure,
  `test_phone_shell.py::test_the_app_names_no_shell_file_of_its_own` naming
  `scratch26b/sync_md_patch.py`, is another lane's untracked scratch folder and fails identically
  before and after this work.
- **unit** — `rustfmt --edition 2021` parses `lib.rs` and `build.rs` (exit 0); `clang -fsyntax-only
  -x objective-c -fobjc-arc -fblocks -fobjc-runtime=ios-15.0` type-checks `FrankWebView.m` against
  stub headers carrying UIKit's real shapes (`frame`, `bounds`, `superview`, `autoresizingMask`,
  `colorWithDynamicProvider:`), exit 0.
- **unit** — `PROBE_JS` extracted verbatim and run under node against a stub DOM at dpr 3:

  | webview | innerH | screenH | fills | safeBottom |
  |---|---|---|---|---|
  | fills the screen (852 CSS px) | 2556 | 2556 | **1** | 34 |
  | 60 pt short (792 CSS px) | 2376 | 2556 | **0** | 0 |

  180 device pixels, and a bottom inset that goes to zero with them — which is why the shell's
  `--safe-*` vars were right and describing the wrong box. With a reader element playing and the
  app hidden at t+4 s: `e=tick t=34.00 hidden=1 bg=30`. The tone decodes to a valid **30.0-second,
  8 kHz, mono, 8-bit WAV measuring 220.0 Hz** by zero-crossing count.
- **not verified — everything with Xcode in it.** No `xcodegen generate`, no
  `npm run -- tauri ios build --debug`, no simulator, no `innerHeight` off a real WKWebView, no
  seconds-after-Home. This session's shell is the Cowork bridge VM: **Linux, aarch64, no cargo, no
  clang for arm64-apple-ios, no xcodegen, no simctl.** Terminal on the Mac can only be granted in
  click mode (no typing), so there was no route to a macOS shell from here either.
- **the plist, stated exactly.** `gen/apple/project.yml:73` has `UIBackgroundModes: [audio]`.
  `gen/apple/frank_iOS/Info.plist` does **not** — it was last generated at 14:19 and the key went
  into project.yml at 14:29. The claim "xcodegen applies it" is therefore **untested**; §8 has the
  one-line grep that settles it.

### 3. Judgment calls
- *job 1 names four files that are already in HEAD (`4b776e5`, 14:32) → committed what was actually
  uncommitted of that work: `Cargo.lock`* — `cc`, `serde_json` and `tauri-plugin-opener` were
  resolved on disk and never committed, so a clean checkout would have re-resolved them.
- *"fix it via `with_webview`" → the fix itself is Objective-C, called through `with_webview`* —
  `PlatformWebview::inner()` hands back a `*mut c_void`, and doing UIKit from Rust would mean
  adding `objc2`/`objc2-ui-kit` and keeping their versions in step with wry's. `ios/` already had
  the C-symbol door open.
- *"non-black root background" → the shell's own `--bg`, dynamic, not white* — a white strip under
  a dark page is the same mistake the other way round. #131316 is not black.
- *the numbers need a log line and a WKWebView console reaches no process log → a debug-only probe
  in the host* — `PROBE_JS` is not injected and `/__probe` is not answered in a release binary. It
  is in `lib.rs` and not in `shell/` because `shell/` is another lane's and because a diagnostic
  that measures the host belongs to the host.
- *the reader has no rendered audio, so job 3 has nothing to keep playing → the probe carries a
  real 30 s WAV media element behind one button* — a WebAudio oscillator is not a media element,
  raises no `play`, and owns no now-playing session, so it would have proved nothing. The
  listeners adopt whatever plays first, so the day `listen.js` has an `<audio>` they describe the
  reader instead.
- *`lib.rs` said `FrankAudio.m` is linked by the Xcode target "sources: ../../ios" → deleted* —
  it is not and must not be (`project.yml` says so in its own comment); prose against code, and
  CLAUDE.md says the code is right.

### 4. Boundary check
Touched, and nothing else: `src-tauri/Cargo.lock`, `src-tauri/ios/FrankWebView.m` (new),
`src-tauri/build.rs`, `src-tauri/src/lib.rs`, and this file. Not a move and not a re-wire, so the
two-folder exception is not claimed. `core/` does not exist in this repo. `tools/`, `shell/`,
`tests/`, `tauri.conf.json`, `capabilities/` and `permissions/` untouched.

Found dirty and **left alone** — another session's, and it cannot be known whose:
`src-tauri/build.rs` (a `FrankSearch.m` block that appeared after my commit),
`src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`, `src-tauri/gen/apple/frank_iOS/Info.plist`,
`src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`, and untracked
`src-tauri/ios/FrankSearch.m`, `src-tauri/src/search.rs`, `scratch-float/`, `scratch26b/`.
The whole of `shell/` was staged in the shared index by another session while this one ran; the
pathspec form is what kept it out of these three commits.

### 5. Footprint
Nothing on disk beyond the four files. `pip install pytest` into the bridge VM's user site
(~4 MB) to run the suite. No env, no model, no download, no SSD, no scratch tree. Ran with no
external drive.

### 6. Requests to core / other modules
- **`build.rs` has two owners today.** `ios/FrankSearch.m` and `src/search.rs` want a `cc::Build`
  in the same `if target_os == "ios"` block this job edited. It merged cleanly; a third
  simultaneous editor will not. Worth one lane owning `build.rs` for the rest of the 13th.
- **`shell/`**: when `reader/listen.js` gets a real `<audio>`, nothing needs to change here — the
  probe's listeners adopt it. Job 3's number can then be taken off a chapter instead of a tone.

### 7. Known gaps
- The three numbers the prompt asks for are **not taken**: the build, `innerHeight*dpr ===
  screen.height*dpr` off a real WKWebView, and seconds-still-playing after Home. §8 is the recipe.
- **The link is unproven.** `frank_webview_fill` is declared in Rust and defined in C and nothing
  has linked them; the same class of error as the `_frank_audio_session_*` one found at 14:24
  yesterday. The syntax checks above are not a link.
- `with_webview` is dispatched, so the fill lands after the first layout but before nothing in
  particular. The autoresizing mask is what covers a later relayout; if a bar survives on a cold
  launch, that is where to look, and `why=settled` at 1500 ms is the line that will show it.
- The probe's button sits over the page in debug builds. Deliberate, and it is the only way to
  raise a `play` without a chapter, but it is one more thing to remember to be unsurprised by.

### 8. Next
Four commands on the Mac, in order, from `IOS TTS TV/`:

```
xcodegen generate --spec src-tauri/gen/apple/project.yml --project src-tauri/gen/apple
/usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" src-tauri/gen/apple/frank_iOS/Info.plist
npm run -- tauri ios build --debug
xcrun simctl launch --console-pty booted com.ttstv.frank
```

The second answers job 3's first half (`Array { audio }` or a failure). The third answers job 1
(no undefined `_frank_audio_session_*`, and now no undefined `_frank_webview_fill`). In the fourth:
read `frank: webview fills the root -- …`, then `frank: probe k=viewport … fills=1`; tap **probe**
bottom-right, then ⌘⇧H, wait, and the last `frank: probe k=audio … hidden=1 bg=N` is job 3's
number. Then the regenerated `Info.plist` and `project.pbxproj` want committing.

**The single question that blocks it:** none — it needs a macOS shell, which this session cannot
have. Stopping here.

### 8b. Commit check
Three commits, every path on the commit line, no `--amend`, no `git add -A`:
- `acc4b4d` — `src-tauri/Cargo.lock` (job 1)
- `3c1137b` — `src-tauri/ios/FrankWebView.m` (`git add`ed first, as a pathspec refuses an untracked
  path), `src-tauri/build.rs`, `src-tauri/src/lib.rs`
- `3ca5b34` — `src-tauri/src/lib.rs`

`git show --stat HEAD` after each listed exactly those files and nothing else. **HEAD moved under
me three times** — `1a01daf` and `0e799ec` (job 29) and the `build.rs` edit still dirty behind
them; every control in §2 was taken on the far side of all three, on the tree as it stands. The
bridge cannot delete inside the repo, so **seven stale git locks were moved to `_to_delete/`**
(`index.lock` ×3, `HEAD.lock` ×2, `next-index-{10,23,152}.lock`), each after the 3-second check —
`git` itself created them and could not unlink them. Osca to clear that folder.

### 9. Status line
`ios · jobs 1-3 · 6 Sep · black bar fixed and unproven; the simulator is owed three numbers`

---

## job 8b — the float, half one: the audio that survives the app switcher · 6 Sep

**Frank's sound stopped the moment you left the app, and it was two absences
rather than a bug.** Osca, 6 Sep, off the float spike (`scratch-float/ANSWER.md`):
*"UIBackgroundModes is absent and no AVAudioSession is set."* Both were true.
iOS suspends a process seconds after it goes to the background unless the
Info.plist claims a background mode; and a background mode over a `SoloAmbient`
session — the default, which WKWebView does not change — is still silenced.
**Neither half works without the other**, and that pairing is now a test rather
than a sentence. The lock screen gets the **sentence** the reader is in, never
the word: the spike measured the corpus at 3.56 words a second and 25 at the
floor, so a title written once a second would show 61.7% of nothing.

### 1. Built
- **`src-tauri/ios/FrankAudio.m`** (new, 63 lines) — two C symbols.
  `frank_audio_session_category()` sets `Playback`/`SpokenAudio`;
  `frank_audio_session_activate()` takes the session. Objective-C and not Swift
  because the caller is Rust: a Swift function is only callable across that
  boundary through `@_cdecl`, an underscored attribute with no stability
  promise, and a `.m` exports plain C symbols `extern "C"` links against —
  the same door `gen/apple/Sources/frank/main.mm` already uses in reverse.
- **`lib.rs`** — the `extern "C"` block under `cfg(target_os = "ios")`,
  `audio_session_why/category/activate` (no-ops that say so off iOS), the
  `audio_session_start` command, and `NOW_PLAYING_JS`.
- **`NOW_PLAYING_JS`** — injected unconditionally beside `PAIR_JS`. A `play`
  listener in the **capture** phase (media events do not bubble) takes the
  session on the first play and puts the book's title up so the lock screen is
  never blank; `TTSTVHost.nowPlaying(sentence, book)` writes the title **at
  most once a second, trailing edge**, and `TTSTVHost.nowPlayingStats()` says
  what it wrote, coalesced and refused.
- **`gen/apple/project.yml`** — `UIBackgroundModes: [audio]`, deployment target
  **14.0 → 15.0** (road (b)'s `ContentSource(sampleBufferDisplayLayer:)` is
  iOS 15), `AVFoundation.framework`.
- **`build.rs` / `capabilities/default.json`** — `audio_session_start`
  declared, so `allow-audio-session-start` is generated and granted.
- **`tests/test_float_audio.py`** (new) — 15 tests.

### 2. Verified — and how
- **unit** · `python3 -m pytest tests -q` → **62 passed**, 0 failed (was 47
  before this job; the 15 are new). `NOW_PLAYING_JS` is run for real under node
  against a `mediaSession` stub: 100 sentences in a burst produce **exactly two
  writes** — the book title and `sentence 99` — with 99 coalesced; the same
  sentence twice writes once; an empty title is refused; with no `__TAURI__` the
  metadata still lands and no command is called.
- **unit** · the two link-time agreements a compiler only reports as
  `Undefined symbols for architecture arm64`: Rust's `frank_audio_session_*`
  names are read off `lib.rs` and compared with the `int …(void)` definitions in
  `FrankAudio.m` (equal sets), and exactly one of `build.rs`/`project.yml` is
  allowed to compile that file.
- **unit** · the pairing: if `UIBackgroundModes` is claimed, `FrankAudio.m` must
  exist and must name `AVAudioSessionCategoryPlayback` and `setActive`.
- **unit, in the container** · the Rust was extracted **by line range**
  (`scratch-float/rust-extract/`, never retyped) into a scratch crate with an
  empty `[dependencies]` and built with `cargo build --offline`: **0 errors**,
  and again with `target_os = "ios"` rewritten to the host so the `extern`
  block, the `unsafe` calls and the `#[cfg]` `let code` both compile on **both**
  sides of the cfg. That covers everything in the block except the
  `#[tauri::command]` shim and the `run()` wiring.
- **not verified, and this is the whole of what is owed**: nothing has been
  compiled by Xcode, `xcodegen generate` has not been run, `FrankAudio.m` has
  never seen a compiler (no Xcode, no `xcrun`, no `swiftc`, no clang with an
  iOS SDK in a Cowork session), and **the proof Osca asked for — chapter one,
  Home, the audio continues, the lock screen shows the sentence — has not been
  taken.** §8 is the four presses that take it.
- Invariant: the other 47 tests are unchanged and green; no shell file touched;
  `SCHEME`, `PAIR_SCHEME` and the Google id assertions still hold.

### 3. Judgment calls
- *Where the title comes from → `navigator.mediaSession`, not
  `MPNowPlayingInfoCenter`.* The audio is WebKit's — the media element playing
  the chapter owns the system's now-playing session, and metadata set beside it
  from the app is the copy the system may ignore. This is the writer WebKit
  itself forwards. Named as a risk in §7 because only a phone settles it.
- *Category at launch, activation at first play.* Activating a `Playback`
  session stops whatever else the phone is playing. Opening Frank must not kill
  your music, so `setup` sets the category (which interrupts nothing) and the
  page's first `play` takes the session. A test asserts `setup` does **not**
  activate.
- *The 1 Hz limit is enforced at the seam, not documented.* A caller that
  pushes a word per word gets one word a second and costs nothing; a caller that
  pushes sentences gets every sentence. The rule cannot be forgotten by the
  reader lane because it is not the reader lane's to keep.
- *Who compiles `FrankAudio.m` → `build.rs`, not the Xcode target.* Both routes
  were live in the tree at once (see §8b) and both is a duplicate symbol. The
  `cc` route won because someone has a real build behind it; `project.yml` still
  names `AVFoundation.framework` because a `staticlib` crate never runs a
  linker, so `cargo:rustc-link-lib=framework=` reaches nothing and Xcode has to
  be told.
- *`voip` is refused, permanently.* It is what `AVPictureInPictureVideoCallLayer`
  wants and App Review rejects it for an app that is not a phone. A test greps
  for it.

### 4. Boundary check
Touched, all in this repo: `src-tauri/src/lib.rs`, `src-tauri/ios/FrankAudio.m`
(new), `src-tauri/build.rs`, `src-tauri/Cargo.toml`,
`src-tauri/capabilities/default.json`, `src-tauri/gen/apple/project.yml`,
`tests/test_float_audio.py` (new), `STATUS.md`. TTSTV untouched — read only.
No shell file touched. `core/` does not exist here.

Found dirty and **left alone**, another session's:
`src-tauri/Cargo.lock` (+488 lines, a resolve from a build this session did not
run — `cc` was already locked at HEAD, so `Cargo.toml`'s new build-dependency
needs no network and no lock change),
`src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`,
`gen/apple/frank_iOS/Info.plist`, `gen/apple/frank_iOS/frank_iOS.entitlements`,
and the untracked `shell/`, `shell.manifest.json`, `scratch26b/`.

### 5. Footprint
One new file of 3.1 KB and one new test file. No env, no model, no download, no
cache, nothing on the SSD. `cc` is a **build**-dependency and was already in
`Cargo.lock` at HEAD as a transitive one, so nothing new is fetched.
`scratch-float/` (92 KB, untracked) gained `rust-extract/extract.rs`, the
line-range slice §2's container build used.

### 6. Requests to other modules
- **`reader/` (TTSTV)** — one line, and the lock screen is finished:
  `window.TTSTVHost && TTSTVHost.nowPlaying(<the sentence the cursor is in>,
  <the book's title>)` wherever `listen.js` already knows the sentence changed.
  Call it as often as you like — the seam limits it. Absent, the lock screen
  shows the book's title and nothing is broken.
- **`design/reader/` (TTSTV)** — the float's look, still owed
  (`scratch-float/ANSWER.md` §5). Not this repo's.

### 7. Known gaps
- **`mediaSession` may not be the winner.** If WebKit does not forward the
  metadata for a WKWebView's media, the lock screen shows the page's own idea
  of a title and `nowPlayingStats()` will say `wrote` climbing with nothing to
  show for it. The fallback is a native `MPNowPlayingInfoCenter` writer behind
  the same command; it is not written, on purpose, because writing both would
  make the diagnosis harder rather than easier.
- **No lock-screen controls are wired.** Play/pause from the lock screen is
  whatever WebKit gives the media element; `setActionHandler` is not called.
- **The session is never deactivated.** Frank holds it until the app is killed,
  which is right for a reader and wrong for an app that should give the phone
  back after an hour of silence.
- `frank_audio_session_activate` is called once. A route change or an
  interruption (a phone call) is not handled and the audio will not resume
  itself afterwards.

### 8. Next
Four presses, Osca's Mac, ~10 minutes — and they are the proof this entry does
not have:

1. `cd src-tauri/gen/apple && xcodegen generate` — **§6e, the step nothing else
   runs.** Then `grep -A2 UIBackgroundModes frank_iOS/Info.plist`. If it is not
   there, nothing below can work and the rest is noise.
2. Close and reopen Xcode (it caches the project), then `npm run -- tauri ios
   dev "iPhone 2" --host`.
3. Open a book, play chapter one, **press Home**. The audio should keep going.
   The log line to look for is `frank: audio session active`; if it says
   `NOT active`, paste it — the sentence after it is the AVAudioSession error.
4. Lock the phone. The lock screen should show the book's title (the reader does
   not name sentences yet — §6). To see a sentence, in Safari → Develop →
   Simulator → Frank: `TTSTVHost.nowPlaying("Here I am, an old man in a dry
   month", "Gerontion")`, then `TTSTVHost.nowPlayingStats()`.

The single question that blocks the rest: **does step 4 put the text on the lock
screen at all?** If it does, §6's one line finishes the road. If it does not,
§7's native writer is a day and the float's own build (road (b), due 10 Sep)
carries it instead.

### 8b. Commit check
`git commit -m "…" -- <eight paths>`, no bare commit, no `git add -A`.

**HEAD moved twice during this session** (`c58d9ea` → `a391bf2` → `0d598b7`,
job 28's Android work). Every file fact in §2 was re-taken at `0d598b7`, on the
far side of both.

**And another hand was in these exact files while this ran, on this same job.**
Said plainly, because a pathspec commit carries whatever is in the working tree:
between 14:22 and 14:26 `src-tauri/build.rs` gained a `cc::Build` block that
was not written here, `src-tauri/Cargo.toml` gained `cc = "1"`, and
`gen/apple/project.yml` gained `DEVELOPMENT_TEAM` and `CODE_SIGN_STYLE`.
**Those four hunks are in this commit and are not this session's work.** They
were kept rather than reverted because together with this session's half they
are one coherent change and splitting them would leave a HEAD that does not
build; the one thing that had to be decided — two compilers for one `.m` — was
decided in favour of theirs (§3), and `- path: ../../ios` was removed from
`project.yml` accordingly. `Cargo.lock` was left unstaged.

### 9. Status line
`ios-tts-tv · job 8b done, unpressed · 6 Sep · background audio + the sentence on the lock screen; xcodegen and four presses owed`

---

## job 26b — Google, and the two doors a web page has no key to · 6 Sep

**The flow is TTSTV's; this repo owns the two halves only an app can do.** Osca,
6 Sep: *"Sign in with Google on the Mac (loopback PKCE flow in the shipped
Python) … Drive v3 client in Python (Studio) and JS (phone, through the same
`window.TTSTVHost` seam)."* The PKCE, the exchange and everything the tokens
touch are `library/drive.js` in the shell (TTSTV, `3523c54`). Here: opening
Google's consent page in the **system browser**, and catching the redirect the
OS hands back.

### 1. Built
- **`google_sign_in` (command)** — opens the URL the page hands over, and
  **refuses anything that is not `https://accounts.google.com/o/oauth2/v2/auth?`**.
  Why a command at all: Google refuses its consent page inside an embedded web
  view (`disallowed_useragent`), and RFC 8252 §8.12 says the same from the other
  side — a person cannot see what they are typing a password into if the app
  drew the window. `tauri-plugin-opener` (new dep) does the opening;
  it is registered in `lib.rs` and granted **no page permission**, so this
  command is the only door to it.
- **The redirect, caught in Rust.** `com.googleusercontent.apps.<n>:/oauth?code=…`
  arrives through the deep-link plugin already registered for `frank-pair://`;
  `is_google_redirect` sorts it, `PendingGoogle` holds it, and `flush_google`
  writes it into `localStorage["ttstv.sync.googleRedirect"]` — the same
  read-in-Rust/write-to-the-page shape §23d chose, for the same reason: a page
  that could call `get_current()` could read another flow's code out of a launch
  URL, and no page needs to.
- **`google_js()`** injects `TTSTVHost.google = {clientId, redirect}` and
  `.googleSignIn(url)` **only when an id is pasted** — absent, not inert. With
  no id the Settings page reads the absence and says "no Google client on this
  device", which is the truthful state and not a stub.
- **`src-tauri/google.json`** — the ONE place the iOS client id is pasted, empty
  until Osca's clicks (§5, `studio/STATUS.md` job 26 §6.3). `include_str!` at
  compile time; one field, scanned by hand (`parse_pair_link` reads its own URL
  the same way, and a JSON crate for one string in one file is a dependency to
  keep in step forever).

### 2. Verified — and how
`tests/test_google_link.py`, 5 tests, and Rust's own two — file-level here for
`test_pair_link.py`'s reason (no cargo in a Cowork session). The id is in ONE
file (a regex proves no other carries one); `tauri.conf.json`'s scheme must be
**exactly the reverse of it**, or — while the id is empty — absent, so a build
cannot advertise a URL type nothing answers; the redirect key is the one
`shell/library/drive.js` polls; the command is declared in `build.rs`, granted
`allow-google-sign-in`, and narrowed to Google's endpoint; `opener` has no page
permission; and no `client_secret` is sent anywhere — an iOS client has none and
PKCE needs none. 28 of the repo's tests pass; the one failure
(`test_the_app_names_no_shell_file_of_its_own`, `asr.js`) is at HEAD.

### 3. Judgment calls
- **A new dependency, said plainly.** `tauri-plugin-opener` is the official v2
  plugin (UIApplication `openURL` on iOS). There is no stdlib way to open a URL
  from an iOS app, and the alternative — letting the page `window.open` — is the
  thing Google refuses. First build needs a network to put it in `Cargo.lock`.
- **The scheme is in two files and a test holds them together**, rather than one
  file and a generator: `tauri.conf.json` is what the deep-link plugin's build
  script writes `CFBundleURLTypes` from, and `prebuild.py` writes nothing (its
  own docstring). So: two places, one fact, one failing test until they agree.

### 7. Known gaps
- **Unbuilt.** No cargo in the bridge VM: the Rust is proved by the file-level
  tests only and its own `#[cfg(test)]` cases have not run. One `cargo test` on
  Osca's Mac.
- **No id yet**, so nothing has met Google from a phone.
- `ASWebAuthenticationSession` (SYNC.md §5) is the nicer sheet; the system
  browser is what ships, and it is what Google's own native-app guidance names.

### 8. Next
1. Osca: the iOS client id into `google.json`, its reverse into
   `tauri.conf.json`'s `plugins.deep-link.mobile` — the test names the exact
   string. Then `cargo test`, `npx tauri ios dev`, Settings ▸ Transfer ▸ Sign in.
2. iCloud after Drive (§4: not free-team; the Files picker plugin).

---

## job 28 · Android on the emulator — and the loop needs no network at all · 6 Sep

**Android is the easier of the two platforms, and the go's own framing had the
mechanism wrong in a way worth correcting before anyone types `10.0.2.2`.**

### 1. Built
- **`PHONE.md` §5, rewritten** into §5.0 the one export, §5.1 the three lines,
  §5.2 the apk and why `--debug` is load-bearing, §5.3 `chrome://inspect`.
- **`tools/android.sh`** (new, executable) — the apk built and installed in one
  command: optional shell import → `android_permissions.py` → `tauri android
  build --apk --debug` → `adb install -r`. Sets `JAVA_HOME` to Android Studio's
  JBR **only when it is not already that**, and says so when it overrides. Finds
  the apk rather than assuming its path. Refuses rather than guesses on two
  devices.
- **`tools/android_permissions.py`** — one docstring line: it named
  `voiceui/asr.js`, and this repo may not name a file of the shell (§2).
- **`tests/test_phone_loop.py`** — 6 new Android tests (14 in the file).
- **`tests/test_phone_shell.py`** — a defect fixed, see §2.

### 2. Verified — and how
Everything below is **read off the sources that decide it**, in the cloud
container: `tauri-cli` 2.11.4's own crate, which carries the Android templates.
Nothing was run — see the end of this section.

| claim | where it is decided | what it says |
|---|---|---|
| **`10.0.2.2` is the wrong answer** | `src/mobile/android/android_studio_script.rs:275` | dev runs **`adb reverse tcp:P tcp:P`**, and loops on `adb reverse --list` until the forward is really there. So **`localhost:P` on the device is the Mac** — no LAN, no firewall, no `--host`, and the same command works over USB on a real phone. `10.0.2.2` is what you would need *without* the reverse, and an app pointed at it only ever works on an emulator |
| the one export, and why it is needed at all | `src/mobile/android/mod.rs:472` `ensure_java` | Tauri substitutes `/Applications/Android Studio.app/Contents/jbr/Contents/Home` **only `if std::env::var_os("JAVA_HOME").is_none()`**. So a JDK 25 exported in a shell profile is used in preference and Gradle refuses; the fix has to *name* the JBR, not merely be absent |
| `INTERNET` needs no patch | `templates/mobile/android/app/src/main/AndroidManifest.xml:3` | it is in the template Tauri generates. `RECORD_AUDIO` is not — which is why `android_permissions.py` exists and why it is re-run after every `init` |
| `--debug` is load-bearing | `templates/mobile/android/app/build.gradle.kts:22,34` | `manifestPlaceholders["usesCleartextTraffic"]` is `"false"` in `defaultConfig` and `"true"` in the **debug** build type, and the manifest reads that placeholder — so a debug apk may reach a plain-http Studio on the LAN (§6b's pairing) and a release apk may not |
| the console | `tauri` 2.11.3 `src/webview/mod.rs:1115` | *"Android: Open `chrome://inspect/#devices` in Chrome to get the devtools window"*, devtools on by default in debug — the same rule as iOS, with no device-side toggle to find |
| the asset story is iOS's | this repo's `lib.rs` | a built apk embeds the shell compressed exactly as an `.ipa` does, so addendum 2's `iter()`/`get()` fix and the read-back guard are what stand between a built Android app and the same page of glyphs |

**A red that had been on this suite all session turned out to be a real defect
in the guard, not in the code it guards.**
`test_the_app_names_no_shell_file_of_its_own` scans this repo's `.py`/`.rs` for
names of shell files. Its token pattern had **no right-hand boundary**, so
`book.json` matched `book.js` *inside itself* — and `tools/prebuild.py`'s
docstring says *"no `book.json` or …"*, which is the sentence that was failing
the test whose whole purpose is keeping `book.json` out. The comment directly
above the pattern said "Whole path segments, so `book.json` is not read as
`book.js`", and it had been untrue since the file was written. Fixed with a
lookahead, and the comment now has **a test of its own** so it cannot go back to
being a claim. Two other names it caught were genuine and are handled honestly:
`sw.js` is **exempted** — `reader/sw.js` is where the LIST lives and
`import_shell.py` must name it to read the list off it, which is the opposite of
restating it (the exemption is asserted alongside `shell_files()` being what is
actually called); `asr.js` was prose in `android_permissions.py` and is now the
module's name instead.

**`tests` is 45 passed, 1 skipped, 0 failed** — green for the first time this
session. The skip is job 27's plist drift, still waiting on `xcodegen`.

**Not verified — everything with Android in it.** No `android init`, no
`android dev`, no emulator, no `adb`, no apk, no `chrome://inspect`. There is no
Android SDK, no JDK, no emulator and no macOS in a Cowork session
(`tools/android.sh` has never been executed; `bash -n` is all this shell can say
about it). The three proofs the go asks for — the Library's
`getBoundingClientRect`, a bundle importing, and Sync finding Studio — are
**Osca's**, in §8, and none of them is claimed here.

### 3. Judgment calls
- *the go says "10.0.2.2 is the host"* → **true of the emulator and not what
  this loop uses.** `adb reverse` is better on every axis (works on a USB phone
  too, needs no network permission, survives the Mac's firewall), and telling
  someone to hard-code `10.0.2.2` would produce an app that cannot leave an
  emulator. §5 names it as the thing *not* to set, with the reason, rather than
  omitting it and leaving the question open.
- *the go asks for dev first, then the apk* → kept exactly, and §8 is in that
  order. The apk is where the Brotli guard finally gets a second platform to
  prove itself on, which is a reason to do it second rather than skip it.
- *`android.sh` overriding a set `JAVA_HOME`* → **it overrides, and says so on
  stdout.** Silence would be wrong (it is someone's deliberate export) and
  obeying would be wrong (Gradle refuses); a line naming what it did is the only
  option that leaves the person in charge.
- *fixing a test that was red before I arrived* → **fixed**, because the
  evidence arrived in this job: chasing the Android red led to `prebuild.py`,
  and the pattern's own comment was the giveaway. I had named it "pre-existing"
  three times, which was true and was not the same as harmless.
- *a committed AndroidManifest* → **still no**, and `android_permissions.py`'s
  own docstring already argues it: `gen/android/` is generated whole and a
  committed manifest would be a copy of a generated file.

### 4. Boundary check
Touched, all in this repo: `PHONE.md`, `tools/android.sh` (new),
`tools/android_permissions.py`, `tests/test_phone_loop.py`,
`tests/test_phone_shell.py`, `STATUS.md`. TTSTV not read and not written.
`src-tauri/` **not touched at all** this job — no Rust, no config.

**Left alone**: the four generated Apple files Osca's build and Xcode keep dirty
(`project.pbxproj`, the xcscheme, `Info.plist`, `frank_iOS.entitlements`), and
untracked `shell/`, `shell.manifest.json`, `scratch26b/` (the Google lane's).

### 5. Footprint
Nothing added but source. In the cloud container, `tauri-cli` 2.11.4's crate
source, downloaded to read the Android templates; it dies with the session.
`_to_delete/` is unchanged from job 27 and one `rm _to_delete/*` still clears it.

### 6. Requests to core / other modules
None.

### 7. Known gaps
- **Nothing here has run on Android.** Six file-level tests and a run sheet.
- **`android.sh` has never been executed.** Its `adb devices` parsing and its
  apk `find` are written against documented output, not observed output — the
  same caveat `phone.sh` carries, and the same first-run risk.
- **The apk has never embedded a shell on Android**, so the Brotli guard is
  unproved on this platform. If the Library comes up garbled the log says so;
  if the guard fires, its sentence names the first eight bytes.
- **Bonjour on Android is untested.** The go is right that Android has no
  multicast entitlement problem, but `mdns-sd`'s browse has been run on nothing.
  `NSBonjourServices` has no Android equivalent to forget; what it does need is
  `INTERNET`, which the template already has.
- **`tauri android init` has not been run**, so `gen/android/` does not exist in
  this repo and `android_permissions.py` cannot be exercised end to end — its
  patch function has unit tests, its target does not exist yet.
- The JDK version Android Studio bundles is not asserted anywhere: §5.0 says
  "the JDK Android Studio ships with" rather than naming 17 or 21, because the
  bundled version moves and a number would rot.

### 8. Every command Osca types, one line each

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```
```bash
npx tauri android init
```
```bash
python3 tools/android_permissions.py
```
```bash
npx tauri android dev
```
```bash
npx tauri android build --apk --debug
```
```bash
tools/android.sh
```

The first goes in `~/.zshrc` and is typed once. The next three are the loop:
`init` once, the permission after every `init`, then `dev` — which builds,
installs and launches on the running AVD and then serves the shell from the Mac,
so edits to `shell/` appear without a rebuild. The fifth is the apk when the Mac
must be out of it; the sixth is the fifth plus `adb install -r`, and is the one
to use.

**The three numbers to send back**, all from Chrome → `chrome://inspect/#devices`
→ inspect (§5.3):

```js
document.querySelectorAll('#readercol p.line, #readercol p.sp, #readercol p.dir').length
```
```js
(await TTSTVBundle.importZip(await (await fetch('/…/bundle.zip')).arrayBuffer(), {})).books[0]
```
```js
await TTSTVHost.syncDiscover(2500)
```

The first is the Library rendering (job 15c's poems chapter one was 1,007 boxes
in Chromium; anything non-zero is the shell alive). The second is a bundle
importing — `{ok: true, hash, has_book_data, has_word_map}`. The third is
Settings → Transfer → Sync finding the Mac's Studio, and it is the one Android
should be *better* at than iOS.

### 8b. Commit check
**`a391bf2`**, 6 files, +467/-21; `git show --stat --name-only HEAD` lists
exactly `PHONE.md`, `STATUS.md`, `tests/test_phone_loop.py`,
`tests/test_phone_shell.py`, `tools/android.sh`, `tools/android_permissions.py`
and nothing else. Pathspec, on `main`; `tools/android.sh` `git add`ed by its own
single path first, on the first try. This line is a later commit.

**HEAD did not move under me**: `c58d9ea` at the gate and as this commit's
parent — the Google lane has been quiet since `c4b9f92`, though it has left a
new untracked `scratch-float/` beside its `scratch26b/`, both left alone.

Locks moved into `_to_delete/`, epoch range **1788697100 – 1788702600**,
including a **`HEAD.lock` and a `next-index-25.lock` 4,809 s old** — an hour and
a half, so long-crashed and from earlier in this session rather than anyone
mid-write — plus the usual pair at 4 s on the retry. `_to_delete/` now holds
four staging tarballs and every lock this session moved; **one `rm _to_delete/*`
clears the lot**, and it is worth doing before the pile stops being ordinary
residue and starts hiding a real one.

### 9. Status line
`IOS-TTS-TV · job 28 · 6 Sep · Android dev needs no network (adb reverse, not 10.0.2.2), JAVA_HOME must NAME the JBR, --debug is what allows cleartext — 45 tests green, and the suite's long-standing red was the guard's own unanchored regex`

---

## job 27 · the phone loop is one press — dev over the LAN, ▶, and one script · 6 Sep

**Osca, 6 Sep: *"simpler than the terminal, minutes, and my password three
times."*** Three separate faults were making it three; none of them was in the
app, and one of them explains the blank phone.

### 1. Built
- **`src-tauri/gen/apple/project.yml`** — the "Build Rust Code" phase becomes a
  block script beginning `export PATH="$HOME/.cargo/bin:$PATH"`. Prepended, not
  appended, so a Homebrew rust cannot win and build against a different
  toolchain than the terminal does; `$HOME` and not `/Users/…` so the file is
  not about one Mac.
- **`tools/phone.sh`** (new, executable) — the rare real build as one command
  and no prompts: `xcodegen` → shell import (only with `--shell`) →
  `tauri ios build --debug` → `devicectl install`. Finds the udid itself,
  refuses rather than guesses on two phones, never builds release, and
  deliberately does **not** run the keychain line.
- **`PHONE.md`** — **§0** the keychain, once (the `security
  set-key-partition-list` line, what it actually grants, and the Always-Allow
  click as the alternative); **§6c** the daily loop; **§6d** the Safari
  inspector and its two toggles; **§6e** `xcodegen`, the step nothing else
  does; **§6f** Xcode's ▶ and the PATH that stopped it; **§6g** `phone.sh`.
  The old unnumbered preamble stops being "§0" so that step 0 is step 0.
- **`tests/test_phone_loop.py`** (new, 8) — the two file-level fixes, held.

### 2. Verified — and how
**The finding that explains the blank phone, and it is measured, not reasoned:**
`src-tauri/gen/apple/frank_iOS/Info.plist` carries **none** of
`NSAppTransportSecurity`, `NSLocalNetworkUsageDescription` or
`NSBonjourServices` — `grep -c` says **0** — while all three have been in
`project.yml` since this morning. `CFBundleURLTypes` *is* in the plist, because
the deep-link plugin's build script writes that one directly at build time
rather than through xcodegen. So **`project.yml` is a source file that only
`xcodegen` applies, `tauri ios build` does not regenerate, and nobody has run
it**: the ATS exception the LAN dev server needs, and the local-network
permission job 26's Bonjour browse needs, have both been written and neither
has ever been inside a build. That is one command away and it is §8's first.

| claim | how | what |
|---|---|---|
| the CLI has the flag, and what it does | **read**, `@tauri-apps/cli` 2.11.4's own binary | `--host`: *"Use the public network address for the development server… When this is set or when running on an iOS device the CLI sets `TAURI_DEV_HOST`"*; `--force-ip-prompt` to be asked again |
| a static `frontendDist` really does live-reload | **read**, same binary | the built-in dev server for static files (`--no-dev-server` turns it off, `TAURI_CLI_PORT`, **default port 1430**) injects an autoreload script — `{"reload": true}` over a WebSocket, `window.location.reload()`, adapted from trunk's `autoreload.js`. So an edit to `shell/library/library.html` reloads the phone with nothing built |
| the ATS exception covers it | **read**, Apple's rule for `NSAllowsLocalNetworking` | http **and ws** to private literals and `.local`, and to nothing else — so it covers the page load and the reload socket both |
| the plist is behind its source | **live**, `grep` on the generated file | 0 of 3 keys, above |
| the ▶ fault | **read**, and it matches the symptom exactly | the phase runs under Xcode's environment: a login shell's PATH, no `~/.zshrc`, so no `~/.cargo/bin`. `npm` resolves (Xcode inherits `/usr/local/bin`), `cargo` does not (rustup installs into `$HOME`) — which is why the same line worked in Terminal |
| the inspector needs no code | **read**, `tauri` 2.11.3 `src/webview/mod.rs:1108` | *"Whether web inspector… is enabled or not. **Enabled by default**… works in **debug** builds, but requires `devtools` feature flag in release"*, and `— iOS: Open Safari > Develop > [Your Device Name]`. `ios dev` and `ios build --debug` are both debug builds |
| the files hold | **unit** | `tests` **37 passed, 1 skipped, 1 failed** — the skip is the plist drift, reported with its remedy rather than as a red; the fail is the same pre-existing `asr.js` one named in the entries below |
| `phone.sh` is syntactically a program | **live** | `bash -n` clean, and a test that keeps it so |

**Not verified — everything with a Mac or a phone in it.** No `xcodegen` run, no
`tauri ios dev`, no ▶, no `phone.sh` executed, no simulator build, no
`simctl install`, no Safari inspector opened. There is no Xcode, no simulator,
no cargo and no macOS in a Cowork session. §8 is the run sheet, and the
`--host` loop is a claim about a flag's documented behaviour until it is pressed.

### 3. Judgment calls
- *"`build.devUrl` / the CLI's `--host`" — which* → **`--host`, and `devUrl`
  stays unset.** A LAN address pinned in `tauri.conf.json` is right until the
  DHCP lease moves, and then it is a blank screen with a config file that looks
  correct. `--host` resolves it per run. It also keeps the file honest: a set
  `devUrl` makes tauri-codegen embed no assets at all, which this repo's own
  `lib.rs` head already has a paragraph about.
- *the blank `ios dev` screen — one cause or two* → **at least two, and both are
  fixed here**: nothing was listening on an address the phone could reach
  (`--host`), and iOS would have refused the load anyway (no ATS key in the
  plist). I cannot say which bit first without pressing it, and §2 says so
  rather than picking the tidier story.
- *the "one System Settings toggle"* → **there are two on a current macOS**, and
  saying one would waste an afternoon: Network → Firewall (allow incoming for
  the process, or off), and — Sequoia and later — Privacy & Security → **Local
  Network** → Terminal/Xcode. A denied Local Network permission looks exactly
  like a firewall block.
- *the inspector's `isInspectable` / `devtools(true)`* → **not written**, and
  this is the one place I did less than the go asked. It is already on for debug
  builds by Tauri's own default (§2), so the line would be a no-op that reads
  like a fix — **and `src-tauri/src/lib.rs` was being written by another lane
  seven minutes before I started** (+253 lines of Google OAuth, `11:23:12`).
  Adding a probably-redundant line to a hot file is the wrong trade. If Frank
  still does not appear under Develop **after** §6d's two toggles, that is when
  it is worth an explicit `.devtools(true)` — §7.
- *the simulator reproduction of the blank built app* → **not attempted**, for
  the same reason it could not be attempted last time: no simulator here. What
  changed is that it is no longer a silent failure — addendum 2's read-back
  guard turns a bad unpack into one log line, and §6d is how to read it.
- *`phone.sh` and the keychain* → the script does not run `set-key-partition-list`.
  It changes a keychain ACL; that is a thing to type once, having read it.

### 4. Boundary check
Touched, all in this repo: `src-tauri/gen/apple/project.yml`, `tools/phone.sh`
(new), `PHONE.md`, `tests/test_phone_loop.py` (new), `STATUS.md`. TTSTV not
read and not written.

**Left alone, and this matters more than usual today — another lane was live in
`src-tauri/` while I worked**: `src-tauri/src/lib.rs`, `build.rs`, `Cargo.toml`,
`capabilities/default.json` (+253 lines of a Google sign-in deep link, last
written `11:23:32`), plus `google.json`, `tests/test_google_link.py`,
`SYNC.md`. They **landed as `c4b9f92` at ~12:16, while this entry was being
written**, so HEAD moved under me once — see §8b. My STATUS.md entry was
prepended to the file as it stood *after* their commit, so job 26b's entry is
intact beneath it and my diff deletes no line. Untracked `scratch26b/` is
theirs too. Also the four generated Apple files
Osca's build and Xcode keep dirty: `frank.xcodeproj/project.pbxproj`, the
xcscheme, `frank_iOS/Info.plist`, `frank_iOS.entitlements`. **Nothing of mine
touches any of them** — note that the plist finding in §2 is a *read*.

### 5. Footprint
Nothing added but source. `_to_delete/` still holds this session's four staging
tarballs and its git locks; one `rm _to_delete/*` clears the lot.

### 6. Requests to core / other modules
None. Everything here is this repo's.

### 7. Known gaps
- **Nothing in this entry has been run.** It is three file changes and a run
  sheet; the loop is proved when Osca presses it.
- **`.devtools(true)` is not written** (§3). If §6d's toggles are not enough,
  that line is the next thing, and it wants a quiet `lib.rs`.
- **The blank built-app Library is diagnosed, not fixed.** Addendum 2 made it
  speak; §6d is how to hear it. If the line says `does not begin with '<'` the
  Brotli fix did not take; anything else is a new fault.
- `phone.sh`'s device detection parses `devicectl list devices` column-wise. It
  refuses on two phones rather than guessing, but it has never been run against
  real output — the shape of that table is the one thing in the script I could
  not check.
- **Xcode caches the project.** After `xcodegen generate`, close and reopen it
  or ▶ builds the old one. Said in §6e and §6f; not enforceable from here.
- The daily loop does not cover Rust changes (those rebuild, which is minutes)
  or plist changes (those need §6e then a build).

### 8. The three commands Osca ever types again, in order

**Once, today** — press the keys that have been written and never applied
(§6e), and then §0's keychain line if codesign is still asking:

```bash
cd "$HOME/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV/src-tauri/gen/apple" && xcodegen generate
```

**Every day after that** — the loop. Edit a shell file, watch it change on the
phone; nothing is built, nothing is installed, nothing asks for a password:

```bash
npm run -- tauri ios dev "iPhone 2" --host
```

**Rarely** — a Rust change, a plist change, or an app to hand to somebody:

```bash
tools/phone.sh            # add --shell to take a new shell from TTSTV first
```

And the fourth thing, which is not a command: **▶ in Xcode**, when you want the
debugger attached. It works once `xcodegen generate` has run and the project has
been closed and reopened.

### 8b. Commit check
**`13f1023`**, 5 files, +608/-2; `git show --stat --name-only HEAD` lists
exactly `PHONE.md`, `STATUS.md`, `src-tauri/gen/apple/project.yml`,
`tests/test_phone_loop.py`, `tools/phone.sh` and nothing else. Pathspec, on
`main`; the two new files `git add`ed by their own single paths first (that add
took on the first try, no lock). This line is a later commit and cannot be in
the one it names.

**HEAD moved under me once**: `94e7580` at the gate, and job 26b's Google work
landed as **`c4b9f92`** at ~12:16 — while §2's numbers were being written, not
before them. It changed `src-tauri/src/lib.rs`, `build.rs`, `Cargo.toml`,
`capabilities/default.json`, `SYNC.md`, `STATUS.md` and two new files, and
**none of the five files in this commit**. My `STATUS.md` entry was prepended to
the file as it stood after their commit, so their entry sits intact beneath mine
and `git diff -- STATUS.md | grep -c '^-[^-]'` was **0** before I committed.

Locks moved into `_to_delete/`, epoch range **1788694560 – 1788697100**: the
commit's own `HEAD.lock` and `next-index-11.lock`. `_to_delete/` now holds this
session's four staging tarballs and every lock it moved; **one `rm _to_delete/*`
clears the lot.**

### 9. Status line
`IOS-TTS-TV · job 27 · 6 Sep · dev over the LAN with --host, ▶ fixed by one PATH line, phone.sh for the rare build — and the plist has been behind project.yml all day: 0 of 3 keys, xcodegen is the step nothing else does`

---

## job 23d · addendum 2 — the Library was Brotli, and the guard that says so · 6 Sep

**Osca's first `ios build --debug` drew the Library as a page of glyphs.** He
found it: `tauri build` embeds the shell **Brotli-compressed**, and the two ways
out of the embedded map are not the same bytes —

- `iter()` walks the map and yields **what is stored**: the compressed stream;
- `get()` goes through `EmbeddedAssets::get`, which runs
  `brotli::BrotliDecompress` (`tauri-utils/src/assets.rs:175`).

`unpack_shell` wrote what `iter()` yielded, so every unpacked file was a `.br`
blob and `library.html` was served as `text/html`. **`tauri dev` could never
show it**: dev embeds nothing, so the handler's `#[cfg(dev)]` fallback was
already going through `get()`.

### 1. Built
**The `iter()`-for-keys / `get()`-for-bytes change was already in the working
tree when I got there** — written at 11:04:09, ninety seconds before I read the
file. It is not mine and I did not touch it; what follows is what it was
missing, added around it.

- **`looks_like_html(&[u8])`** — after a BOM and any leading whitespace, an
  HTML file's first byte is `<`. Written that way round on purpose: a Brotli
  stream has no magic number (a real `brotli.compress("<!doctype html>…", 11)`
  starts `1b d1 02 40`, and the first byte is a window-size header that varies),
  so the answerable question is *is this HTML*, never *is this not Brotli*.
- **The read-back.** After the unpack, `library.html` is read **off disk** and
  put through it; a failure is a sentence naming the first eight bytes and
  pointing at this file's head. In memory would not have done: the bug put the
  right number of files in the right places, and every one was a Brotli stream.
- **A dropped key is now a stop.** The `filter_map` in the fix drops any key
  `get()` cannot resolve, so a shell quietly one file short would have been the
  same class of fault again. `assets.len()` is now held equal to
  `resolver.iter().count()`. The comment also records something not obvious from
  the name: on a miss `AppManager::get_asset` does **not** return `None` — it
  tries `<key>.html`, then `<key>/index.html`, then **`index.html`**, so a
  hand-built key comes back as the home page under the wrong name. Nothing
  builds a key; that is what keeps the chain unreachable.
- The module head gains the `iter()`/`get()` paragraph, beside the one about
  dev embedding nothing that has been there since the move.

### 2. Verified — and how
- **unit, rust — 1 new (11 in the pairing set).** `looks_like_html` extracted by
  line range (`lib.rs` 626–643 plus its test) into a scratch crate with an empty
  `[dependencies]`, `cargo test --offline` in the cloud container: **pass**. The
  Brotli bytes in the assertion are **real** — the first eight of
  `brotli.compress(b"<!doctype html>…", quality=11)`, generated in the container,
  not invented. It also rejects an empty file, whitespace, a zip's `PK\x03\x04`,
  and `doctype html>` with the bracket gone.
- **unit, python — 25 pass, 1 fail**, the same pre-existing `asr.js` red named
  in the entry below.
- **the cause, read rather than inferred**: `tauri-utils` 2.9.3's `assets.rs:175`
  for the decompress, `tauri` 2.11.3's `AppManager::get_asset` for the fallback
  chain and the key normalisation.
- **not verified**: the crate still has not been compiled here, and none of this
  has run on a phone. **The proof is Osca's next build**, and it is now a loud
  one either way — if a `.br` ever reaches the data dir again the app says so
  instead of drawing it.

### 3. Judgment calls
- *another writer was in `lib.rs` 90 seconds before I read it* → **I did not
  rewrite their lines.** Their `filter_map` expression and its comment are
  untouched; the count check is additive and sits below it. Every edit was an
  anchored replacement that fails rather than clobbers, and the file's mtime was
  checked immediately before the write (`1788692649`, unchanged through six
  10-second polls) and after (`1788692796`).
- *check in memory or read back off disk* → **off disk**, for the reason above.
- *`get()` per asset costs a decompress of the whole shell on every launch*
  → kept: the fingerprint cannot decide to skip the write until it has the bytes
  to hash, and a stamp over compressed bytes would be a fact about the encoder.
  If it ever shows in a launch profile, the answer is a cheaper stamp, not
  compressed bytes on disk.
- *`serde_json` + the `Cargo.lock`* → **already committed**, in `f0af183`, with
  the measured cause in the comment. Both files are clean in the working tree;
  there was nothing left to take.

### 4. Boundary check
Touched: `src-tauri/src/lib.rs` (this repo), `STATUS.md`. Nothing else in this
repo; TTSTV not read for this addendum and not written to at all.
**Dirty and left alone**, all four generated by Osca's build or Xcode:
`gen/apple/frank_iOS/Info.plist`, `…/frank_iOS.entitlements`,
`…/frank.xcodeproj/project.pbxproj`, `…/xcshareddata/xcschemes/frank_iOS.xcscheme`;
untracked `shell/`, `shell.manifest.json`.

### 5. Footprint
`_to_delete/brx.tgz` (1.2 KB), the extraction crate. Nothing else new.

### 6. Requests
None. Nothing outside this repo is implicated.

### 7. Known gaps
- **The fix is unproved on hardware.** Everything above is a guard and a test;
  the thing that says the Library is a page again is Osca's next build.
- `looks_like_html` checks **one** file. A `.css` or `.js` that arrived
  compressed would still be silent — but they cannot arrive by a different route
  than `library.html` did, so one sentinel is the honest amount of check.
- The `.shell` stamp from the broken build is still on the phone. It will not
  match the new fingerprint (the bytes it hashes have changed from compressed to
  decompressed), so the first launch re-unpacks — no manual delete needed. That
  is a claim from reading the code, not from a device.

### 8. Next — the two lines, and they are Osca's

```bash
cd "$HOME/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV"
npm run -- tauri ios build --debug
xcrun devicectl device install app --device <udid> \
    src-tauri/gen/apple/build/arm64/Frank.ipa
```

`xcrun devicectl list devices` gives the udid. Then open Frank: the Library
should be a **page**, not glyphs. If it is glyphs again, the log now says so in
one line beginning `frank: unpacked N files … does not begin with '<'` — send
that line rather than the screen. After that, `PHONE.md` §6b's six presses.

### 8b. Commit check
Pathspec, two files, on `main`; `git show --stat HEAD` checked after.

### 9. Status line
`IOS-TTS-TV · job 23d addendum 2 · 6 Sep · iter() was Brotli and get() is not; the unpack now reads library.html back and refuses anything that does not start '<' — 1 new rust test, 25 python, unproved on hardware until the next build`

---

## job 23d · addendum — the first real build, and what it proved · 6 Sep

Osca ran the first `tauri ios build --debug` against `ec3155c`. It died on
**E0433**, he fixed it, and the fix plus the `Cargo.lock` the build wrote are
committed here. Two things it settled that no shell in Cowork could.

**1. `serde_json` — and it is MY change that needed it, not a latent gap.**
`generate_context!()` embeds `tauri.conf.json`; the `plugins` block is a
`HashMap<String, serde_json::Value>` whose `ToTokens`
(`tauri-utils::config::PluginConfig`, `config.rs:4391`) maps every value
through `tokens::json_value_lit`, which writes `::serde_json::Value` / `::Map`
/ `::Number` **into the calling crate**. `map_lit` (`tokens.rs:115`) emits
`::std::collections::HashMap::new()` and nothing else for an EMPTY map — so
this crate needed no `serde_json` until `tauri.conf.json` grew its first
`plugins` block, which was `deep-link`, in `ec3155c`. Read off
`tauri-utils` 2.9.3's own source, not inferred from the error.

So the note in the diff — *"under `tauri/custom-protocol` (every `tauri ios
build`, never `ios dev`)"* — is right about **when** it shows and wrong about
**why**: the trigger is the `plugins` block, not the feature. Both sentences are
now in `Cargo.toml`'s comment, and
`tests/test_pair_link.py::test_a_plugins_block_in_the_config_means_serde_json_in_the_crate`
is the guard, in both directions: a config with plugins and no `serde_json` line
fails here rather than on somebody's Mac twenty minutes into a build.

**2. The three-file agreement held, on a real Mac.** The plugin's build script
ran and wrote into the generated Info.plist exactly what `project.yml` says:

```xml
<key>CFBundleURLTypes</key><array><dict>
  <key>CFBundleURLSchemes</key><array><string>frank-pair</string></array>
  <key>CFBundleURLName</key><string>frank-pair</string>
</dict></array>
```

`frank` appears in it nowhere. That is the one thing `tests/test_pair_link.py`
could only assert about *files* and never about a *build*, and it is now
observed. The predicted entitlements side effect also happened and is
**smaller than predicted**: `update_entitlements` rewrote
`frank_iOS.entitlements` to remove a `com.apple.developer.associated-domains`
that was never there, so the whole diff is a **dropped trailing newline** —
no semantic change at all.

**Still not verified**: the build had not finished when this was written, so
the crate is **not yet known to compile**, nothing has run on a simulator or a
phone, and no `frank-pair://` has been opened by an OS. §2 of the entry below
stands unchanged except that "the plugin's build script has never run" is no
longer true.

**Touched**: `src-tauri/Cargo.toml` (Osca's line, comment rewritten to the
measured cause), `src-tauri/Cargo.lock` (the build's, taken as written),
`tests/test_pair_link.py` (+1, now 12), `STATUS.md`. **Left alone**, and all
four are the build's or Osca's own generated Apple files:
`gen/apple/frank_iOS/Info.plist`, `…/frank_iOS.entitlements`,
`…/frank.xcodeproj/project.pbxproj`, `…/xcshareddata/xcschemes/frank_iOS.xcscheme`.
`tests` is **25 pass, 1 fail** (the same pre-existing `asr.js` red, §2 below).

**Commit check**: **`f0af183`**, 4 files (`src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock`, `tests/test_pair_link.py`, `STATUS.md`), pathspec, and
`git show --stat --name-only HEAD` lists those and nothing else; this line is a
later commit, so it cannot be in the one it names. HEAD did not move under me
(`5baa406` → `f0af183`). Locks moved into `_to_delete/`, epoch range
**1788692030 – 1788694560**: a `HEAD.lock` and a `next-index-29.lock` **606 s
old** — long-crashed, from this session's own earlier commits — plus an
`index.lock`/`next-index-9.lock` pair at 4 s on the retry. `_to_delete/` also
still holds this session's two staging tarballs; **one `rm _to_delete/*` clears
the lot.**

**Next**: `PHONE.md` §6b's six presses are Osca's, starting with the build he
is running now.

---

## job 23d · the phone's half of pairing — the deep link, and the one key · 6 Sep

### 1. Built
The link, and only the link. `src-tauri/src/lib.rs`:
- `PAIR_SCHEME = "frank-pair"` — a launch scheme of its own, **deliberately not
  `SCHEME`** (`frank`, the asset scheme, `lib.rs:102`).
- `parse_pair_link(&str) -> Result<Pairing, String>` — `frank-pair://v1?url=…&pass=…
  &workspace=…&app=…&made=…`. Hand-parsed on the string with this file's own
  `percent_decode`, not through `url::Url`, so the whole decision is
  dependency-free and provable in a shell with no Xcode (§2). Refuses a version
  above 1 in `library/import.js`'s own words, and refuses a `url` that is not
  plain http(s) — a link is a string a stranger prints on a wall.
- `json_string()`, `pair_write_js()` — the write, as JavaScript, every value
  JSON-quoted (`<`, `>`, `&`, `/` escaped too).
- `PAIR_JS` — the writer, injected **separately from `HOST_JS` and
  unconditionally**: `HOST_JS` returns early with no `__TAURI__` because
  everything in it is a command; this is not a command, and Settings → Transfer
  writes the same key in a browser where there is no host object.
  `TTSTVHost.pairWrite(fields)` computes `fp` and writes;
  `TTSTVHost.pairRead()` gives it back; a `ttstv:pairing` event redraws an open
  tab. `fp` is `sha256(pass)` sliced to 8 hex — `deploy_to_my_modal.py::
  fingerprint`'s rule, through the `crypto.subtle` `library/import.js` already
  hashes a book with.
- `PendingPair`, `take_pair_links()`, `flush_pair()` — cold open
  (`deep_link().get_current()` in `setup`, before there is a window) and warm
  open (`on_open_url`) both leave the pairing pending; `on_page_load` drains it.
  The take is what makes the double write harmless.
- `tauri_plugin_deep_link::init()` registered; `PendingPair` managed.

`src-tauri/Cargo.toml` — `tauri-plugin-deep-link = "2.4.10"`.
`src-tauri/tauri.conf.json` — `plugins.deep-link.mobile[0].scheme` +
`desktop.schemes`. `src-tauri/gen/apple/project.yml` — `CFBundleURLTypes`.
`src-tauri/capabilities/default.json` — description only: **the plugin is
granted nothing**, so the page cannot call `get_current` and read the pass out
of the launch URL.
`tests/test_pair_link.py` (new, 11) · `PHONE.md` §6b (the link, the three
files, the console drive, the six presses) · this entry.

### 2. Verified — and how

**unit, rust — 10 pass.** No cargo is reachable from a Cowork session, so the
pure half was proved the way the move proved `lib.rs` before it: extracted **by
line range** (`PAIR_JS` 257–307, the pairing block 309–518, `percent_decode`
549–567, the tests) into a scratch crate with an empty `[dependencies]`, and
`cargo test --offline` in the cloud container — **10 passed**. The two
assertions that `include_str!` files cannot run there and are the python
suite's instead, named rather than dropped.

**unit, python — 11 pass** (`tests/test_pair_link.py`), of which the ones that
matter:
- the three files name the same scheme, and `frank` appears in the URL types
  **nowhere**;
- the capability grants the plugin nothing, and says so;
- `PAIR_JS` **actually runs**, under node against a `localStorage` stub: one key
  written and nothing else touched, the seven fields in the agreed order,
  `pairRead` gives back what `pairWrite` put, an absent `made` is stamped, a
  pairing with no address or no pass is refused;
- **the fingerprint is checked against python's `hashlib`** for four passes
  including non-ASCII — the same cross-language check `library/tests/
  test_import.py` makes of the book hash, and for the same reason: two
  implementations of one rule that nobody compares is how the square on the Mac
  and the row on the phone come to show different eight-hex.

**live — the four calls, against a real `cloud/tools/serve_local.py`.** Not read
off the source: the door was started in the cloud container (`installer`
branch's `cloud/`, `core/`, `parser/`, `voice/remote/`, parser's five pins from
PyPI) and driven from node holding **nothing but a `transfer.pairing` object** —
the shape this repo's link writes. Measured:

| call | status | measured |
|---|---|---|
| `GET /` (no bearer) | **200** | `{"app":"ttstv-cloud (local)","routes":["POST /parse","POST /render","GET /job/{id}"]}` — the route list is open, everything else is not |
| any call, wrong pass | **401** | |
| `POST /parse` | **200** | a 2,808 B epub → a **6,286 B** tree zip, `X-Slug: the-pairing-proof`, `X-Parse-Seconds: 0.20` |
| `POST /parse`, empty body | **400** | |
| `POST /parse`, not a book | **422** | `{"ok":false,"why":…}` — the parser's own sentence, no traceback |
| `POST /render`, a parse tree | **422** | *"this body is not a packed job folder (no job.json)"* |
| `POST /render`, `X-Where: kaggle` | **501** | *"pair with Frank Studio's own door"* — job 23c, and the client must draw it as a place to go, not an error |
| `GET /job/<unknown>` | **404** | |
| `GET /job/<id>` | **200** | `{job_id, engine, where, call_id, state:"queued", started}` |
| `GET /job/<id>?audio=1`, not done | **409** | the pull is the same route with one parameter |

**not verified — anything with a phone in it.** No simulator, no device, no
camera, no `xcrun`, no Xcode and no cargo in either shell here, so: the crate
has **never been compiled** with the plugin in it, `xcodegen` has never
regenerated the Info.plist, no `frank-pair://` has ever been opened by an OS,
and no book has been parsed or rendered *from a phone*. `PHONE.md` §6b is the
six presses that close it. The proof Osca asked for — pair from the simulator
and the real phone, parse, render one chapter, play it, and open Frank from the
camera — is **not done and is not claimed**.

**the invariant**: `shell/` and `shell.manifest.json` untouched (both still
untracked, and `tools/` is unmodified); TTSTV read only, and the `installer`
worktree read only — nothing was written into either.

**found already failing and left alone**: `tests/test_phone_shell.py::
test_the_app_names_no_shell_file_of_its_own` — `tools/android_permissions.py`
names `asr.js`, and that file is `HEAD`'s byte-for-byte (`diff` against
`git show HEAD:` is empty) with the test file untouched by me. It goes red now
because `shell/` has been imported and the skip-gate opens; it is another lane's.
`tests` is **24 pass, 1 fail** with this work and would be 13 pass, 1 fail
without it.

### 3. Judgment calls
- *the go says "its own scheme"; which word* → **`frank-pair`**, because
  `cloud/STATUS.md` 23b §2 already sized the square against *"a 92-character
  `frank-pair://` payload"*. Taking the word the other lane had already
  measured beats inventing a second one. My grammar is longer than 92 characters
  (it carries names, not positions) — §7.
- *`url::Url` is handed over by the plugin; parse with it?* → **no.** A
  dependency-free parser is one that can be proved in this shell, and
  `url::Url` normalises a non-special scheme's authority in ways that would make
  `v1`, `V1` and `v1.` one thing when the version segment is the one part that
  must be read exactly as sent.
- *who computes `fp`* → **the page**, not Rust. Rust would need `sha2`, a
  dependency I cannot compile here to check; the page already has the exact
  primitive `import.js` uses. It also means the Settings field and the link
  reach the key by the same line of code.
- *carry `fp` in the link?* → **no.** A link that carried both could disagree
  with itself, and the fingerprint's whole job is to say that two things match.
- *Rust writes `localStorage` by `eval`* → yes, and no IPC is granted for it.
  The alternative — a command the page calls to fetch the pending link — puts
  the pass behind a door any page in the webview could open.
- *the plugin's `deep-link:default` permission* → **not granted.** It allows
  `get_current`, which answers with the launch URL, which contains the pass.
- *`Info.plist` is dirty (Osca's Xcode)* → **not touched.** The scheme goes in
  `project.yml`, which is tracked, clean and mine to edit; the plugin's own
  build script writes the same key into the plist at build time, and
  `xcodegen` puts `project.yml`'s copy back. Two writers of one plist key, so
  the test holds them equal.
- *a 500 from `/render`* → recorded as a client rule, not as a door bug. A zip
  whose `job.json` is not the shape `voice/remote/spec.py` expects answered
  **500 with the job row already written** (the following poll returned 200
  `queued`), so a client must not retry a 500 blindly. My fixture was a
  hand-made `job.json`, not one packed by `voice`; 23b proved 202 → `done` →
  pull with a real one. Named in §6 as a rule and in §7 as a thing I provoked.

### 4. Boundary check
Touched, all in this repo: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`,
`src-tauri/gen/apple/project.yml`, `tests/test_pair_link.py` (new), `PHONE.md`,
`STATUS.md`. **TTSTV was read only** — `cloud/STATUS.md` and
`Frank/FRANK.md` on `FRANK`, and `cloud/endpoint.py`, `cloud/tools/serve_local.py`,
`cloud/tools/local_client.py`, `cloud/tools/deploy_to_my_modal.py` and
`cloud/STATUS.md` on the **`installer` branch, in another session's worktree**
(`scratch/wt-installer`, locked). Nothing was written to either, and no branch
of TTSTV was checked out or moved.

Not the move/re-wire exception — one repo, one folder tree.

**Dirty and left alone** (Osca's Xcode/import, and they were dirty at the gate):
`src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`,
`…/xcshareddata/xcschemes/frank_iOS.xcscheme`,
`src-tauri/gen/apple/frank_iOS/Info.plist`, untracked `shell/` and
`shell.manifest.json`.

### 5. Footprint
Nothing added to the repo but source. `_to_delete/pairx.tgz` (7 KB) and
`_to_delete/cloudstage.tgz` (782 KB) are this session's staging tarballs and
are **deletable** — this shell cannot delete inside the mount, so they join
what is already there for Osca to empty. In the bridge VM outside `mnt/`:
`~/work` (~1 MB). In the cloud container: the extracted crate, the staged
`cloud/`+`parser/`, `fastapi[standard]` and parser's five pins, a 2.8 KB epub —
all of it dies with the session. No GPU, no Kaggle contact, no Modal contact,
nothing deployed, £0.

### 6. Requests to core / other modules

**To the sync lane, for `library/transfer.js` (TTSTV) — the four calls, with
the status codes measured above.** One client, and it must not be able to tell
a Modal door from Frank Studio on the LAN (job 23c): read `url` for nothing but
its bytes, and never branch on it.

```js
const P = JSON.parse(localStorage.getItem("transfer.pairing"));   // the one key
const H = { Authorization: "Bearer " + P.pass };
const at = p => P.url.replace(/\/+$/, "") + p;
```

| verb | request | answers to draw |
|---|---|---|
| **parse** | `POST /parse`, the epub/pdf **bytes as the body**; `X-Filename` (defaults `upload.epub`), optional `X-Lang`, `X-Slug`, `X-Max-Chapters` | **200** → `application/zip`, the `books/<slug>/` tree; read the slug off **`X-Slug`** and the seconds off `X-Parse-Seconds`. **400** empty body · **413** over the cap · **422** `{ok:false, why}` — *show `why`, it is the parser's own sentence* · **401** |
| **render** | `POST /render`, a **packed job folder, zipped**; `X-Engine`, `X-Job-Id` (optional, one is made), `X-Where` (`modal` default) | **202** → the job row, `{job_id, engine, where, call_id, state, started}` · **422** not packed / no engine · **400** bad `where` or zip-slip · **501** on `X-Where: kaggle` — *not an error: it is the sentence that sends the person to Studio's own door* |
| **job** | `GET /job/<id>` | **200** → `{state: queued\|running\|done\|failed, …, audio: [names]}` · **404** no such job |
| **pull** | `GET /job/<id>?audio=1` — **the same route, one parameter** | **200** → `application/zip` of the wavs · **409** while the job is not `done`/`running` · **404** |

Three rules the measurements put on the client, and none is obvious from the
source:
1. **`GET /` needs no bearer and every other route does.** A reachability check
   is free and proves nothing about the pass; the first 401 is the real answer.
2. **Do not retry a 500 from `/render`.** The job row is written before the
   render is attempted, so a retry makes a second job.
3. **The pull is the poll.** One route, and `?audio=1` before `done` is a
   **409**, not an empty zip.

**To the settings/design lane — Settings → Transfer's Pair field.** It is the
second writer of `localStorage["transfer.pairing"]`, and the object is
`{v:1, url, pass, workspace, app, fp, made}` in that order, `fp` =
`sha256(pass)` hex sliced to 8. Inside Frank the field can just call
`TTSTVHost.pairWrite({url, pass})` and get the `fp` back; outside Frank
(the Mac, a browser) it must do the same `crypto.subtle` line itself. Listening
for the `ttstv:pairing` event is what makes the row redraw when a link arrives
while the tab is open.

**To the installer lane (`cloud/`)** — the square must encode
`frank-pair://v1?url=…&pass=…&workspace=…&app=…&made=…`, percent-encoded, `fp`
**not** carried. That is longer than the 92 characters 23b measured (it carries
key names rather than positions): a `https://ozzi--ttstv-cloud-api.modal.run`
door with a 43-character pass comes to ~120 characters, still inside `segno`'s
version-6 byte mode at ECC M. ~~If the square's size ever matters more than the
link's readability, say so and I will make the grammar positional.~~
**ANSWERED (Osca, 6 Sep): keep it named. Density is not the constraint at
version 6, and the installer lane encodes exactly the grammar above.** The link
is settled on both sides; nothing about it is open.

**To nobody, but worth writing down:** `serve_local.py`'s own example binds
`127.0.0.1`, which a phone cannot reach. `--host 0.0.0.0` is in `PHONE.md` §6b.

### 7. Known gaps
- **Nothing has been compiled.** `tauri-plugin-deep-link` is a new dependency
  and `Cargo.lock` is not updated — no cargo on the bridge, and the real crate
  cannot be built in the container either. The first `cargo build` on the Mac
  is where an API mistake would show. Everything I could check without it, I
  checked: the plugin's own source was read (2.4.10, wants `tauri ^2.10`, which
  the `2.11.3` pin satisfies), and `on_page_load` / `eval` were read off
  `tauri` 2.11.3's own source rather than assumed.
- **No `frank-pair://` has ever been opened by an operating system**, so the
  half of this that is Apple's — the URL type reaching the camera, the app
  coming to the front, `get_current()` on a cold start — is unrun.
- **The link grammar is mine.** Nothing on the Mac encodes it yet, so the two
  halves have never met. §6 is the specification; a mismatch is one edit either
  side.
- **`made` is not checked for staleness.** A link photographed weeks ago pairs
  exactly like a fresh one. `made` is carried so a future `pairWrite` can refuse
  an old square, and today nothing does.
- **A second link overwrites the first without asking.** One key, last write
  wins. Right while there is one door; wrong the day someone has a LAN door and
  a cloud door and wants both.
- **`spans.json`-style question, unresolved:** deleting the app clears
  `localStorage`, so a re-pair is a re-scan. There is no export and no forget.
- The `/render` 500 above was provoked by **my** hand-made `job.json`; I did not
  prove the door 500s on a job `voice` packed, and I do not claim it.

### 8. Next — in days, and each is a different lane

| | days | where |
|---|---|---|
| the six presses in `PHONE.md` §6b — build, `xcodegen`, simulator, cold start, the real phone, the camera | **0.5** | Osca's Mac |
| `library/transfer.js` — the four calls against §6's table | **1** | TTSTV, the sync lane |
| Settings → Transfer's Pair field, the second writer of the key | **0.5** | TTSTV, settings/design |
| **then** the proof this go asked for, end to end: pair → parse → render one chapter → play it | **0.5** | Osca's Mac + the phone |

**Two days to a phone that renders against the Mac**, of which half a day is
already sitting in `PHONE.md` and needs only a Mac. The link half is done and
cannot be shown to work until one of the other two lands — that is the honest
shape of it, and it is why §2 says "not verified: anything with a phone in it"
rather than dressing the extraction up as a proof.

~~**The single question that changes nothing but the order:** should the square
encode a *positional* link?~~ **Closed the same day — named, see §6.**

### 8b. Commit check
**`ec3155c`**, 8 files, +1,105/-1; `git show --stat --name-only HEAD` lists
exactly `PHONE.md`, `STATUS.md`, `src-tauri/Cargo.toml`,
`src-tauri/capabilities/default.json`, `src-tauri/gen/apple/project.yml`,
`src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`,
`tests/test_pair_link.py` and nothing else. Pathspec, on `main`, in this repo;
the one new file `git add`ed by its own single path first. No `git add -A`, no
bare `git commit`. This §8b line is a second, later commit — the hash cannot be
in the commit it names.

**HEAD did not move under me**: `93d9cfc` at the gate (10:33) and `93d9cfc` as
this commit's parent. The lane that wrote `f667ef8` and `93d9cfc` (job 26,
Bonjour) had stopped ~40 minutes before I started, and its three dirty Xcode
files are untouched — §4.

**The locks moved, as an epoch range rather than a count that moves** (the
lesson `50ffa0b` cost the sync lane an hour ago): everything in `_to_delete/`
stamped **1788691782 – 1788692030** is this session's — `index.lock` ×3,
`HEAD.lock` and `next-index-17.lock`, across the `git add` and the two commits.
The retry loop found each 7–20 s old, over the 3 s bar, so they were crashed
locks and not a session mid-write. The loop was run with
**`GD=$(git rev-parse --git-dir)`** — the fix
the installer lane proposed to `CLAUDE.md` on 6 Sep for worktrees; it costs
nothing in a normal checkout like this one and means one loop works in both.
`_to_delete/` also now holds this session's two staging tarballs (§5).
git's `unable to unlink '.git/objects/**/tmp_obj_*'` warnings are the ordinary
bridge noise and were not chased.

TTSTV: not committed to, not staged, not checked out — and the `installer`
worktree, which is another session's and locked, was read and nothing else.

### 9. Status line
`IOS-TTS-TV · job 23d done (the link half) · 6 Sep · frank-pair:// parses, writes transfer.pairing, and the four call shapes are measured against a real serve_local.py; 21 tests green, nothing on a phone`

---

## job 26 · the phone half, laid out — `SYNC.md` · 6 Sep

### 1. Built
`SYNC.md` — the folder model; where the phone keeps books/marks/positions (Cache API,
localStorage) and why the LAN half is shell JS, not Rust; the four-verb adapter with the
LAN row mapped and Drive/iCloud/Kaggle rows sketched; the iCloud free-team finding and the
Files-picker route; the Google OAuth clicks (§5); days per transport (§6); the presses (§7).
No code.

### 2. Verified — and how
- **live**: the Mac half's contract read off the working tree at 09:22 — `studio/sync.py`
  (`/sync/hello`, `/sync/pair`, `/sync/manifest`, `/sync/audio/<slug>/<cid>.opus`, the
  word-id hash, `PAYLOAD`), `reader/routes.py` (`POST /sync/marginalia`, `/sync/positions`),
  `settings/routes.py` (`GET /sync`), `studio/serve.py` (CORS `*` on the LAN listener) —
  uncommitted, another session's.
- **live**: the phone's stores read off `library/import.js`, `reader/marginalia.js`,
  `reader/cursor.js`; `lib.rs` grants no IPC and serves one root.
- **web**: Personal Team = no iCloud/CloudKit capability, 7-day profiles (Apple's account
  page; zudo-tauri's free-team page); Google native-app OAuth (iOS + Desktop client types,
  loopback / reverse-client-id redirects, PKCE, no secret needed) — sources in `SYNC.md`.
- **not verified**: any phone, any simulator, any Drive call.

### 3. Judgment calls
- Two `go`s to one session and the Mac half already in another session's hands → the Mac
  half is NOT started here; the phone half is laid out, not built, until Osca answers a/b/c.
- "iCloud entitlement free-team-allowed" → checked, false; the Files picker replaces it.
- LAN half in shell JS rather than `lib.rs` → the stores are the shell's and `fetch` reaches
  the Mac; Rust would be a second copy of import.js.
- Studio picker on the phone → pair by code + address today; a Swift Bonjour plugin later.

### 4. Boundary check
- Touched: `SYNC.md`, `STATUS.md` (both new, this repo). `README.md`, `PHONE.md`, `src-tauri/`,
  `shell/`: untouched. TTSTV: read only.
- Dirty and left alone (Osca's Xcode / import): `src-tauri/gen/apple/frank.xcodeproj/project.pbxproj`,
  `…/xcshareddata/xcschemes/frank_iOS.xcscheme`, `src-tauri/gen/apple/frank_iOS/Info.plist`,
  untracked `shell/`, `shell.manifest.json`.

### 5. Footprint
Nothing beyond the two files.

### 6. Requests
- **Osca**: the Google clicks, `SYNC.md` §5 (two clients; the `drive.file` scope).
- **TTSTV settings lane**: the Transfer panel to the mock; **studio/serve.py**: CORS is
  there; the LAN row should print `address:port` beside the code (pairing by address).
- **Info.plist / project.yml** (Osca's dirty file, so not mine today): `NSAllowsLocalNetworking`,
  `NSLocalNetworkUsageDescription`, `NSBonjourServices [_ttstv._tcp]`, later `CFBundleURLTypes`.

### 7. Known gaps
No sync code on the phone; no proof on any device; the Mac half's shapes may move.

### 8. Next
Osca's a/b/c. Then `library/sync.js` (TTSTV) + the plist keys, LAN on the simulator.

### 8b. Commit check
`git add -- SYNC.md STATUS.md` then `git commit -m … -- SYNC.md STATUS.md` → `6e46eb9` (2 files, +217); this line `a`-follows it.
HEAD did not move under me in this repo. Locks moved to `_to_delete/`: `index.lock` ×2, `HEAD.lock`, `next-index-11.lock`, `objects/maintenance.lock`.

### 9. Status line
`IOS-TTS-TV · job 26 phone half 0/4 built, laid out · 6 Sep · waiting on a/b/c`
