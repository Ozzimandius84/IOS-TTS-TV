# G-LOOKUP — can one press give Apple's Look Up, with ours on top? (exploration) — 11 Sep

Lane 8, round 11 Sep evening. **Nothing lands**: the probe is untracked in the phone repo's
`scratch-lookup/`, and this file is its copy of the report. Pressed on the **iPhone 17 Pro
simulator, iOS 26.5** (Xcode ▶ on a hand-written project, taps through the Simulator window).
0 GPU-minutes, no Kaggle, no Modal, no server, no route pressed.

## 1. Built
- `scratch-lookup/Sources/main.m` (one Obj-C file, ~520 lines) — a WKWebView app shaped like
  Frank: the web view is a **runtime subclass** of WKWebView (as wry's `WryWebView` is), and the
  page reaches native through a message handler standing in for Tauri's `invoke`.
  - `lookup_apple(term, mode)` — the host command: `UIReferenceLibraryViewController(term:)`
    presented from the top view controller (FrankSearch.m's shape, one sheet never a stack) as
    `sheet` / `half` (medium detent) / `popover` (anchored on the word) / `ours` (option (c)).
  - `frank_lookup_menu_install(webview)` — option (a): adds `buildMenuWithBuilder:` to the web
    view's class at run time, calls WebKit's own first, logs the whole menu WebKit built, then
    inserts a **"Frank"** item as a sibling after `com.apple.menu.lookup`; pressing it reads the
    selection back and shows our entry in a half sheet.
  - `LPCombo` — option (c): our entry on top, Apple's controller as a **child** below, one sheet.
  - The eye: every presentation in the app is logged (swizzled present/dismiss + a 50 ms poll),
    each sheet's view tree is walked at +800 ms and +2500 ms (**text inside it counted, never
    logged**), and the page reports its load id, scroll, selection, rAF count and a tone's clock.
- `Resources/probe.html` — a mock of the four surfaces: the reading page (tap = cursor, tap the
  cursor's word = Look Up), the one-word view (red pivot, tap the word / a button), the float
  (a docked box), voice ("look up" button). "▶ Run all" = the measured sequence.
- `LookupProbe.xcodeproj` (hand-written, no script phase, no team), `RUN.md` (the presses).

## 2. Verified — and how
- **live, simulator** — every number in §3 is a line of `scratch-lookup/probe.log` (202 lines),
  written by the simulator process to the Mac's disk and read over the bridge.
- **eyeballed, simulator** (looked at, never cited as proof): the sheet for `fagi`, `Tityrus`,
  `patulae` (all "No Content Found · Search Web · Manage Dictionaries", a ✕ top right); the
  Settings ▸ General ▸ Dictionary page "Manage Dictionaries" opened; the (c) sheet with our two
  lines above Apple's panel; Safari on google.com after "Search Web".
- **web, cited**: see §8 Sources.
- **not verified**:
  - **the "Frank" item in the text menu (a)** — the simulator window was in another Space and the
    background tools have no press-and-hold; a double-click arrives as two taps (detail 1, 2)
    and selects nothing. Install ran (`menu install on LPWryWebView (super WKWebView): added`);
    whether WebKit calls it and where "Frank" lands is **Osca's press, RUN.md row 6**.
  - Apple's own Look Up from that menu (the class comparison) — same reason.
  - **Any definition text on screen**: the simulator had **no dictionary installed**
    (`dictionaryHasDefinition` = NO for all 15 words, `shepherd` included). I ticked English (UK)
    and French in the simulator's Settings; whether they downloaded was not checked.
  - Anything on the real iPhone.
- **invariants**: TTSTV HEAD `1783530`, `languages/catalogue.json` md5
  `304915f7c7f6ec6e6f3a38553d442e7c` (no server started, no route pressed). Phone repo HEAD moved
  under me once (`b60efba` → `dc6b728`, another lane's G-COVERS import); nothing of mine is in
  either repo's index.

## 3. Probe results (what appeared, in words and numbers)

**One press → Apple's Look Up, nothing selected: YES.** In iOS 26.5 `UIReferenceLibraryViewController`
is a thin host: 16 views in our process, 0 text views, **2 remote hosts**
(`_UISceneHostingView`, `_UIContextLayerHostView`), and the thing it dismisses through is
`DDParsecCollectionViewController` — the Look Up ("Parsec") UI, drawn by another process. What it
drew: the term as title, a ✕, and for a term with no dictionary entry **"No Content Found ·
Search Web · Manage Dictionaries"**.

| press (surface) | mode | init | on screen (present completion) | closed by | close took | page after |
|---|---|---|---|---|---|---|
| float box, `fagi` (first ever, cold) | sheet | 117.3 ms | **1369 ms** | ✕ | 568 ms | same doc |
| Run all: `shepherd` | sheet | 4.7 ms | 1151 ms (tone starting) | auto | 724 ms | same doc, scroll 0→0 |
| Run all: `fagus` | sheet | 3.7 ms | **541 ms** | auto | 615 ms | same doc |
| Run all: `shepherd` | half (medium detent: 469.7 of 874 pt) | 2.9 ms | 550 ms | auto | 579 ms | same doc |
| Run all: `shepherd` | popover 340×365 at the word | 3.3 ms | 1732 ms (first popover) | auto | 604 ms | same doc |
| Run all: `fagus`, `shepherd` | ours+Apple (c) | 1.0 / 2.8 ms | 551 / 537 ms | auto | 574 / 565 ms | same doc |
| page, 2nd tap on the cursor's word `Tityrus` | sheet | — | 664 ms | "Manage Dictionaries" | 588 ms → **Settings app in front** | same doc on return |
| page, `patulae` (after returning from Settings) | sheet | 622 ms | 1198 ms | ✕ | 637 ms | same doc |
| one-word view tap, `fagi` | ours+Apple | 23.7 / 55.2 ms | 615 / 598 ms | Apple's ✕ inside our sheet → **whole sheet** | 609 ms | same doc |
| same | ours+Apple | | | "Search Web" | 597 ms → **Safari in front** (google.com) | — |

- **Warm, a press is on screen in 537–664 ms** (that is the sheet's own animation; `init` is 1–5 ms);
  **cold 1.15–1.73 s**. Closing is 565–724 ms whichever way.
- **The page is untouched by every sheet**: same load id 12/12, scroll unchanged, selection 0 →
  0, cursor kept. **rAF kept running under the sheet** (+200…216 frames per 3.7–5.0 s, 42–58 fps),
  and the **tone never paused**: it advanced 3.79/3.76/4.98/3.76/3.74 s against 3.79/3.75/4.98/3.76/3.73 s wall.
- **Latin**: `fagi`, `fagus`, `patulae`, `Tityrus` → "No Content Found". (English too, here —
  no dictionary on the simulator.) `dictionaryHasDefinition`: 20.6 ms cold, **2.4–6.8 ms warm**,
  NO for 15/15 (en, fr, de, it, es, la, grc, el, nonsense).
- **Two of the panel's three buttons leave Frank**: "Manage Dictionaries" → Settings ▸ General ▸
  Dictionary (English US/UK, French, French-English, German, German-English, Greek,
  Greek-English… visible); "Search Web" → Safari. Coming back is the app switcher's job.

**Ours "on top" — the three shapes:**
- **(a) a "Frank" item beside Look Up — possible in principle, unpressed.** The public route is
  `buildMenu(with:)`: `UIMenuController` items are deprecated since iOS 16 (WWDC22 10071), and
  since iOS 18.2 WKWebView consumes `buildMenu` before the view controller sees it, so the
  override must be **on the WKWebView subclass** (Apple forum 770127). In Tauri that subclass is
  wry's, so the override is added at run time — exactly what the probe installed ("added").
  `UIMenu.Identifier.lookup` exists (iOS 13+) to put it next to. Press owed.
- **(b) our entry INSIDE Apple's panel — no.** The class has one initializer and one class
  method, no delegate, no content API (Apple docs); and the panel is another process's scene —
  the walk found 0 text views and 2 scene hosts, nothing in our process to add to. (On the
  **Mac only**, a user-installed `.dictionary` bundle in `~/Library/Dictionaries` does appear in
  Look Up; iOS has no such door.)
- **(c) one Frank sheet with both — yes, as two stacked things, never one text.** Apple's
  controller embeds as a child (slot 402×731.7 pt under our entry) and draws its full panel there.
  Our process holds exactly one text view in that sheet — **ours** (41–52 chars) — and none of
  Apple's. So (c) is *our card above Apple's hosted panel*; Frank can never read, merge, speak or
  re-order Apple's definition, and Apple's ✕ closes the whole sheet. What (c) *can* do honestly:
  ask `dictionaryHasDefinition` first (3–7 ms) and show **ours alone** when Apple has nothing
  (Latin, Greek), **ours + Apple's** when it has something.

**Judgment calls**
- *"Pressed on the SIMULATOR"* → a standalone app, not Frank: `lib.rs` is lanes 1 and 7's this
  round, and the question is UIKit's, not Tauri's. The runtime subclass and the top-view-controller
  walk are Frank's own shapes, so the answer carries.
- *"the float"* → the float is not built in the app yet (road (b), a native PiP, is still
  `scratch-float/probe-b`). I pressed an in-page docked box (the fallback route); the PiP window
  itself was not pressed.
- *"Apple's text … only by presenting Apple's controller inside our container view?"* → measured
  rather than argued: embedded, counted, 0.
- *The report goes to STATUS.md* (protocol) vs *"nothing lands"* (collision map) → the collision
  map wins; this copy is `scratch-lookup/ANSWER.md`, untracked.

## 4. Boundary check
- Touched (phone repo, **untracked, not committed**): `scratch-lookup/{RUN.md, ANSWER.md,
  Sources/main.m, Resources/probe.html, LookupProbe.xcodeproj/project.pbxproj, probe.log}` and
  Xcode's own `xcuserdata`/`project.xcworkspace` inside the `.xcodeproj`.
- TTSTV: nothing. `core/`: nothing. `src-tauri/`, `shell/`, `lib.rs`: nothing.
- One `.git/index.lock` in the phone repo, **made by my own `git status`** (the bridge cannot
  unlink it), moved to `_to_delete/index.lock.g-lookup.<epoch>` — for Osca to clear.
- Found dirty and left alone (phone): `shell/library/library.json` (deleted),
  `src-tauri/gen/apple/{frank.xcodeproj/project.pbxproj, …/frank_iOS.xcscheme,
  frank_iOS/Info.plist, frank_iOS/frank_iOS.entitlements}`, `scratch-float/`, `scratch-j13/`,
  `scratch26b/`.

## 5. Footprint
- `scratch-lookup/` 104 KB (Mac, internal). Xcode DerivedData for LookupProbe (Mac, not measured).
- Simulator: a second device, **iPhone 17 Pro (iOS 26.5)**, booted; LookupProbe installed; English
  (UK) and French ticked in its Settings ▸ Dictionary; Safari left on google.com's consent page
  (not accepted). Xcode: a **"Replace LookupProbe?" dialog** is up in its window — Cancel.
- Container: copies of the four source files. No SSD.

## 6. Requests to core / other modules
- **lane 7 (`lib.rs` lookup door)**: if Osca picks a one-press Look Up, it is one more command
  beside the pack's `dict_lookup` — `lookup_apple(term, mode)` + `lookup_has(term)`, a
  `FrankLookup.m` compiled by `build.rs` in its own archive (the house pattern), its line in
  `generate_handler!`, `build.rs`'s command list and `capabilities/default.json`, and
  `TTSTVHost.lookupApple(word)` in `HOST_JS`. The menu item (a) is `frank_lookup_menu_install`
  called once inside `with_webview`, beside `frank_webview_fill`.

## 7. Known gaps
- (a) unpressed; Apple's own menu Look Up unpressed; no definition seen (no dictionary on the
  simulator); no real-phone number.
- **The page's free gesture collides with the double-tap**: a double-click on the cursor's word
  fired `click detail=1` first and opened the sheet (measured, `patulae`). Only a ~300 ms wait for
  a second tap separates them, and that wait is added to every Look Up.
- The PiP float was not pressed (not built). AVKit's PiP window shows its own playback controls
  and a restore button; I found no API for a custom control in it — a tap can only bring Frank back.
- Coming back from "Manage Dictionaries"/"Search Web" left the probe's tone at 0.00 s — the probe
  has no audio background mode; Frank has one (job 8b), so this says nothing about Frank.

## 8. Next — recommendation, and the decisions that are Osca's

**Recommendation.** Osca's idea works in this shape: **one press opens Apple's own Look Up for
the word Frank already knows, in ~0.55 s, over the reader, and closes back to the same page with
the voice still going.** "Ours on top" cannot be *inside* Apple's panel; the honest versions are
(a) a **Frank** item beside Look Up in the text menu (for a selection), and (c) **one Frank
sheet: our entry on top, Apple's panel under it — and ours alone when Apple has nothing**
(`dictionaryHasDefinition`, 3–7 ms). Put the press where nothing is selectable: the **one-word
view** (tap the red word — today that only wakes the subtitle) and the **in-page float**. Leave
the reading page to the OS menu (+ Frank item), because its free tap fights the double-tap.

| surface | what its input does today | smallest change |
|---|---|---|
| reading page | tap = cursor (`book-nav.js:4356`); double-tap = cursor + origin; hold = OS menu with Look Up | (a) the Frank item; or 2nd tap on the cursor's word, with a ~300 ms double-tap wait |
| one-word view | a tap wakes the subtitle (`book-nav.js:4396`, pointerdown → `wakeSub`); no click handler; swipe = the axis | a `click` on the view when `viewHasTheScreen()` and no swipe `took` → `TTSTVHost.lookupApple(word)` |
| the float | PiP not built; in-page mini-word not built | in-page: same click → same call. PiP: tap = back to Frank only |
| voice | "what does X mean" / "what does this mean" → spoken answer from our data (`voiceui/app.js:63`); no "look up" | a "look up" clause → `lookupApple(current word)` — only useful with the phone in hand; Apple's panel cannot be spoken |

**Apple's terms, one paragraph.** `UIReferenceLibraryViewController` "should not be used to
display wordlists, create a standalone dictionary app, or republish the content in any form"; it
may be presented "modally or as part of another interface" — so embedding it in our sheet (c) is
inside the letter. What may be shown: Apple's panel, as Apple draws it, for a term the reader
asked about. What may not: reading, storing, caching, re-drawing or speaking its text (the probe
confirms it is not even in our process), or building a word list out of `dictionaryHasDefinition`.
The HIG asks that custom edit-menu commands come **after** the system's, be few, have short verb
names, and that an app "not implement other controls with the same functionality as the edit
menu" — a Look Up button is fine where there is no edit menu (the one-word view, the float), and
a duplicate where there is one (the reading page).

**Decisions (Osca's):**
- **Q1 — Where is the one press?** A: one-word view, tap the red word. B: A + a small button
  there. C: A + the in-page float. D: A + the reading page's 2nd tap (with the ~300 ms wait).
  E: A + voice "look up".
- **Q2 — What does the press show?** A: Apple's panel alone. B: (c) ours on top + Apple's below,
  always. C: (c) when Apple has an entry, ours alone when it has none (Latin, Greek).
  D: ours first, with an "Apple ▸" button that swaps to Apple's panel.
- **Q3 — How is it presented?** A: full sheet. B: half sheet (the reader stays half visible).
  C: popover at the word.
- **Q4 — The text-menu item?** A: add it, named "Frank". B: add it with a verb ("Define").
  C: no item — Look Up alone on the page.
- **Q5 — "Manage Dictionaries" and "Search Web" leave Frank** (Apple's buttons, not removable).
  A: accept. B: prefer Q2-D so Apple's panel is one press further away.

Blocks a build lane: Q1 and Q2. Owed before it: **Osca's presses, RUN.md rows 6 (the Frank
item, Look Up from the menu) and 2 on the phone** (a real definition, and which dictionaries
are ticked). Stop.

Sources: [UIReferenceLibraryViewController](https://developer.apple.com/documentation/uikit/uireferencelibraryviewcontroller) ·
[UIMenu.Identifier.lookup](https://developer.apple.com/documentation/uikit/uimenu/identifier-swift.struct/lookup) ·
[WKWebView consumes buildMenu in 18.2 (forum 770127)](https://developer.apple.com/forums/thread/770127) ·
[WWDC22 10071, UIMenuController deprecated](https://developer.apple.com/videos/play/wwdc2022/10071/) ·
[HIG Edit menus (mirror)](https://miniring.gitbook.io/hig/controls/edit-menus) ·
[Mac custom dictionaries in ~/Library/Dictionaries](https://github.com/tisfeng/Easydict/blob/dev/docs/en/How-to-use-macOS-system-dictionary-in-Easydict.md) ·
[AVPictureInPictureController](https://developer.apple.com/documentation/avkit/avpictureinpicturecontroller) ·
[PiP controls](https://artemnovichkov.com/blog/demystifying-picture-in-picture-on-ios)

## 8b. Commit check
No commit, in either repo — the collision map says nothing lands for lane 8. `git status` in the
phone repo shows `?? scratch-lookup/` and the six files that were dirty before me.

## 9. Status line
`dictionary · G-LOOKUP exploration done · 11 Sep · one press → Apple's Look Up works (0.54–0.66 s warm, page untouched, audio on); ours can't go inside Apple's panel — Frank menu item (unpressed) or our card above Apple's; 5 decisions for Osca`
