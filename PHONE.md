# PHONE.md — the one page

Frank on a phone. Everything Osca types is one line, in order, run from this
folder (`~/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV`). Nothing here needs a
paid Apple Developer Program (Q1, answered 5 Sep: no) — the iPhone route is
Xcode's free personal team, and the friend gets the Android `.apk`.

---

## 0. Where the shell comes from, and why that is the only rule here

`shell/` is not this repo's code. It is TTSTV's app shell, arriving by script:

```
design/reader/  →  (TTSTV job 15)  →  reader/  →  publish_shell.py  →  shell/
```

Nothing is hand-copied and the app never loads from `design/`. The list of what
the shell *is* lives in one file — TTSTV's `reader/sw.js`, its `SHELL_FILES`
array — and this repo restates no part of it. What it keeps instead is
`shell.manifest.json`: a record, written by the import, of what actually
arrived and its sha256s. `tools/prebuild.py` checks the tree against that
record before every build, so a hand-edited or half-imported shell fails before
anything compiles.

`book-data.js` never ships. Neither does any `book.json`. Both are refused at
the import end (TTSTV's `publish_shell.py`) and again at this end
(`tools/shell_manifest.py`'s `NEVER`), because the two ends live in different
repos and only one of them is on the disk at build time.

---

## 1. Re-import the shell — the one command

```
python3 tools/import_shell.py --ttstv ~/Documents/RUNNERS/TTSTV/TTSTV
```

Run it whenever the reader changes in TTSTV. It prints the file count and
bytes, rewrites `shell/` whole, and rewrites `shell.manifest.json`. It does
**not** bump TTSTV's `SHELL_CACHE` (that is the PWA's publish, held at v33
until the tree is quiet) — pass `--bump` on the day the two happen together,
and note that `--bump` is the only thing in this repo that writes into TTSTV.

If TTSTV cannot produce the whole shell it names every missing file and writes
nothing at all — `shell/` is left exactly as it was, because the copier clears
its output directory before it copies and a half-import would leave this repo
with no way back.

**As of 5 Sep 23:00 that is what it does.** TTSTV's `reader/sw.js` names 46
files and four of them are not on disk there: `reader/reader.html`,
`reader/probe.html`, `reader/icon-192.png`, `reader/icon-512.png`. Job 15 is
what puts them back (it writes the new `reader.html` from
`design/reader/shell.html` and restores the two icons from `3d2c7a9`). Until it
lands, `shell/` is empty and every step below that needs it is blocked. Nothing
else in this repo is.

---

## 2. Once — the toolchain

```
npm install
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Xcode must be installed and its command line tools selected
(`xcode-select -p` should print a path inside `Xcode.app`). Android needs
`ANDROID_HOME` and `NDK_HOME` exported — Android Studio's SDK Manager installs
both; `tauri android init` says so if they are missing.

## 3. The checks that need no phone

```
python3 -m pytest tests -q
```
```
cd src-tauri && cargo test && cd ..
```

The first is 15 python tests (5 of them skip until the shell is imported). The
second is the 7 rust tests in `src-tauri/src/lib.rs` — the path resolver, the
shell fingerprint, and the two sentences that tell an empty `tauri dev` build
from a missing build step.

## 4. iPhone — the simulator, then Osca's own phone

```
npx tauri ios init
```
```
npx tauri ios dev
```

`ios init` writes `src-tauri/gen/apple/`. It is **tracked in this repo** —
`project.yml` is the file xcodegen rewrites `Info.plist` and the Xcode project
FROM, and it is where the bundle id (`com.ttstv.frank`), the signing team and
the two microphone strings live. A tree nobody can diff is a tree nobody
notices changing. If `init` overwrites something, `git diff` is the answer.

For Osca's own iPhone, plugged in, on the free personal team:

```
open src-tauri/gen/apple/frank.xcodeproj
```

In Xcode: target **frank_iOS** → Signing & Capabilities → **Team** → your
personal team → Run with the phone selected. On the phone, Settings → General →
VPN & Device Management → trust the profile. The profile lasts **7 days**;
re-running Xcode renews it. No TestFlight, no second iPhone.

**Expect one line in the log and do not chase it.** `tauri ios dev` starts its
own static dev server and sets `devUrl`, and tauri-codegen then embeds *no*
assets at all — so `frank: 0 embedded shell assets` is correct in dev, and the
handler falls back to reading `frontendDist` off disk (`#[cfg(dev)]` in
`lib.rs`). A *built* app embeds the shell and unpacks it once. If a built app
ever says 0, that is the real bug and the 404 page names which of the two it is.

## 5. Android — the friend's phone

```
npx tauri android init
```
```
python3 tools/android_permissions.py
```
```
npx tauri android build --apk
```

The second line is not optional and is not a one-off: `gen/android/` is
generated whole and is **not** tracked here, so the `RECORD_AUDIO` permission
has to be put back after every `init`. Running it twice is safe — it says so
and changes nothing. Without it, hands-free fails on Android with a
`NotAllowedError` that looks exactly like a declined prompt and is not one.

The `.apk` lands in
`src-tauri/gen/android/app/build/outputs/apk/universal/release/`.

---

## 6. What the phone is, and what it is not

**A window size, not a second design.** There is no phone stylesheet in this
repo and there must not be one. The shell's own `pane.js` already has a phone
branch — under `narrow: 860px` the panes stop being a stack of columns and each
takes most of the screen — and `Panes.measure` is what decides the columns at
every width. A change to any of that is a `design/reader/` question for Osca,
not a patch here.

Measured 5 Sep, from `design/reader/pane.js` at `DEFAULTS`
(`cap: 2`, `narrowW: 88%`, `narrowStep: 8%`, `gutter: 4.5vw`, `gap: 18px`):

| width | pane widths (i = 0…4) | n=2, dx=-1 | n=2, dx=-2 (both out) |
|---|---|---|---|
| **390** (iPhone 14/15/16) | 343 312 281 250 218 | pane 0 at −2, right edge **341** | pane 1 at −11, pane 0 at **346**, right edge **689** |
| **430** (Pro Max) | 378 344 310 275 241 | pane 0 at −2, right edge **376** | pane 1 at −10, pane 0 at **379**, right edge **757** |
| **412** (Pixel) | 363 330 297 264 231 | pane 0 at −2, right edge **361** | pane 1 at −10, pane 0 at **365**, right edge **728** |

One pane out is right on all three: it sits at x ≈ −2 and covers 88% of the
screen, which is what the phone branch is for.

**Two panes out is not.** The widths go narrow but the *slot* arithmetic does
not: the second slot is still laid out beside the first, so at 390 wide pane 0
lands at x = 346 on a 390 px screen and the window's right edge reports 689 —
299 px past the edge of the phone. The prose in `pane.js` says the panes
"simply cover each other" under the narrow mark; the maths still stacks them.
**Owed to `design/reader/`: `cap` should be 1 under `narrow`** (one slot, each
pane replacing the last) — that is one line in `DEFAULTS` and it is Osca's, not
this repo's. Until then, keep the phone to one pane out.

---

## 7. What is owed

- **The shell itself** — blocked on TTSTV job 15 (§1). One command after it lands.
- **`bookload.js` reading books from the Cache API over `frank://`** — job 15
  step 2 writes `bookload.js`; it does not exist yet, so "one book imported,
  opened, read to chapter 2" has not been done and is not claimed.
- **`cap` under `narrow`** — §6, a `design/reader/` question.
- **`gen/android/`** — does not exist until someone with Android Studio runs
  `init`. Nothing in this repo has been built for Android.
- **A note in TTSTV's `Frank/FRANK.md`** that `Frank/` stays the *desktop*
  thin client and the phone moved here — owed to the installer lane.
