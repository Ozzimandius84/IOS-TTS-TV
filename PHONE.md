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

## 6b. Pairing — the square, the link, and the one key

The phone is told WHERE to send a book and WITH WHAT by a link it reads off the
Mac's screen with the system camera. Frank ships no scanner: the camera app
offers "Open in Frank" because the app declares a URL type, and that is the
whole of the mechanism.

**The link.** `frank-pair://v1?url=…&pass=…&workspace=…&app=…&made=…`, every
value percent-encoded. `url` and `pass` are required; `app` defaults to
`ttstv-cloud` and `workspace` to nothing; `made` may be left off and the phone
stamps it. **`fp` is never carried** — it is eight hex of `sha256(pass)`,
computed at the write, so a link cannot disagree with its own pass.

**The scheme is `frank-pair`, and it is deliberately not `frank`.** `frank://`
is the *asset* scheme this app answers with its own files. If the OS could hand
this app a `frank://` from outside, a square printed by a stranger would be a
request to open an arbitrary path of the served tree. Two words, two jobs.

**Where the scheme is declared — three files, and they must agree:**

| file | what it is for |
|---|---|
| `src-tauri/src/lib.rs` (`PAIR_SCHEME`) | parses the link |
| `src-tauri/tauri.conf.json` → `plugins.deep-link.mobile` | what `tauri-plugin-deep-link`'s **build script** writes `CFBundleURLTypes` from, into the generated `Info.plist` |
| `src-tauri/gen/apple/project.yml` → `CFBundleURLTypes` | what an **`xcodegen` regeneration** puts back into that same `Info.plist` afterwards |

`tests/test_pair_link.py` holds the three equal. The plugin's build script also
*removes* `com.apple.developer.associated-domains` from the entitlements when
no app link is configured, which is correct here (there are none) and is why
`frank_iOS.entitlements` may show as changed after a build.

**Where it lands: `localStorage["transfer.pairing"]`**, one object, seven
fields, in this order — `{v, url, pass, workspace, app, fp, made}`. That key is
the contract and it has **two writers**: this repo's link, and Settings →
Transfer's typed address-and-pass field (TTSTV, the shell's own page). It has
one reader, `library/transfer.js` (TTSTV), which is one client for the Mac and
the phone. Nothing in this repo makes the four HTTP calls.

**Try it without the field, and without a camera.** Until Settings → Transfer
lands, put a pairing in by hand from the webview console (Safari →
Develop → the simulator or the phone → the Frank window):

```js
await TTSTVHost.pairWrite({ url: "http://192.168.1.24:8099", pass: "<the pass>" })
TTSTVHost.pairRead()          // {v:1, url:…, pass:…, workspace:"", app:"ttstv-cloud", fp:"3e47e9d6", made:…}
```

and then drive the four calls in the same console — this is exactly what
`library/transfer.js` will do:

```js
const P = TTSTVHost.pairRead(), H = { Authorization: "Bearer " + P.pass };
const at = p => P.url.replace(/\/+$/, "") + p;
// 1 parse   2 render   3 job   4 pull
const tree = await (await fetch(at("/parse"), { method: "POST", headers: { ...H, "X-Filename": "book.epub" }, body: file })).arrayBuffer();
const row  = await (await fetch(at("/render"), { method: "POST", headers: { ...H, "X-Engine": "stub" }, body: packedZip })).json();
const st   = await (await fetch(at(`/job/${row.job_id}`), { headers: H })).json();
const wavs = await (await fetch(at(`/job/${row.job_id}?audio=1`), { headers: H })).arrayBuffer();
```

**Start the door on the Mac** (no Modal account, no spend) — from a TTSTV
checkout on the `installer` branch:

```bash
TTSTV_CLOUD_TOKEN=<the pass> python3 cloud/tools/serve_local.py \
    --host 0.0.0.0 --port 8099 --vol /tmp/ttstv-local-vol
```

`--host 0.0.0.0` is the one change from that file's own example, and it is what
makes it reachable from the phone rather than only from the Mac. The phone then
pairs against `http://<the Mac's LAN address>:8099`. The plist already allows
plain HTTP on the local network (`NSAllowsLocalNetworking`, §6 of job 26).

**The presses that are Osca's, in order.** Nothing below has been run — there
is no Xcode, no simulator and no camera in a Cowork session.

1. `cd src-tauri/gen/apple && xcodegen generate` — or just build; either way
   check `frank_iOS/Info.plist` afterwards for a `CFBundleURLTypes` naming
   `frank-pair` and **not** `frank`.
2. `cargo test -p frank --lib` in `src-tauri/` — the 10 pairing tests plus the
   7 that were already there. (They were proved by extraction in the container;
   this is the first time they run against the real crate.)
3. `npm run -- tauri ios dev` — then, in another terminal:
   `xcrun simctl openurl booted "frank-pair://v1?url=http%3A%2F%2F127.0.0.1%3A8099&pass=testpass"`.
   Frank should come to the front; `TTSTVHost.pairRead()` in the console should
   show the object with an `fp`.
4. **Cold start**, which is the half `openurl` on a running app does not test:
   kill Frank in the simulator, then run the same `openurl`. The link is read in
   `setup` via `get_current()` and written on the first page load.
5. On the **real phone**: show the square (Settings → Cloud GPU → the pairing
   image, TTSTV), point the camera at it, take the offer. Then the four calls
   from the console above against the Mac's LAN address.
6. Deleting the app clears `localStorage`, so a re-pair is a re-scan; there is
   no "forget" button in this repo.

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
- **`library/transfer.js` (TTSTV)** — the four HTTP calls, one client for the
  Mac and the phone, reading `localStorage["transfer.pairing"]`. The sync
  lane's file, not this repo's; §6b has the shapes and `STATUS.md` §6 has them
  with the measured status codes.
- **Settings → Transfer's Pair field (TTSTV)** — the second writer of that key.
  Until it lands, §6b's two console lines are the way in.
- **Nothing here has been on a phone.** Every press in §6b is unrun.
