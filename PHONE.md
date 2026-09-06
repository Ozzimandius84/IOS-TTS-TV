# PHONE.md — the one page

Frank on a phone. Everything Osca types is one line, in order, run from this
folder (`~/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV`). Nothing here needs a
paid Apple Developer Program (Q1, answered 5 Sep: no) — the iPhone route is
Xcode's free personal team, and the friend gets the Android `.apk`.

---

## The one rule — where the shell comes from

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

## 0. Once, and never again — the keychain

**codesign asks for the login password on every build until you tell the
keychain to stop asking.** Three prompts a build is what makes a one-click loop
feel like a chore, and it is one line:

```bash
security set-key-partition-list -S apple-tool:,apple:,codesign: \
    -s -k "$(read -rsp 'login keychain password: ' p; echo "$p")" \
    ~/Library/Keychains/login.keychain-db
```

What it does, because it deserves a sentence before you type it: every private
key in the login keychain carries an access-control list of the tools allowed
to use it without asking. `codesign` is not on that list by default for keys
Xcode imported, so it prompts. This adds `codesign` (and the two Apple tool
identifiers it delegates to) to the list **for every key in that keychain**.
It grants nothing to anything else and no key leaves the Mac.

The click-instead-of-type version, if you would rather see what you are
allowing: build once, and at the prompt press **Always Allow** rather than
Allow. Same effect, one key at a time.

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

## 6c. THE DAILY LOOP — the phone loads the Mac, and nothing is built

This is the loop. One command, and then edits appear on the phone with no
build, no install and no password.

```bash
npm run -- tauri ios dev "iPhone 2" --host
```

**`--host` is the whole of the fix.** Without it the built-in dev server binds
`127.0.0.1`, which on the Mac is the Mac and on the phone is the phone — so the
phone loads nothing and shows a blank Library, which is exactly what
`tauri ios dev "iPhone 2"` did on 6 Sep. With it the CLI takes the Mac's LAN
address (prompting the first time, `--force-ip-prompt` to be asked again),
binds there, and points the app at it.

Three things have to be true for it, and two of them are one-offs:

1. **The ATS exception.** iOS refuses plain `http://` by default and says
   nothing about it. `project.yml` carries `NSAppTransportSecurity ›
   NSAllowsLocalNetworking: true`, which permits http and ws to private
   addresses — `192.168.x.x`, `10.x.x.x`, `.local` — and to nothing else.
   **It is written and it is not yet in the app** (see §6e): nothing has run
   `xcodegen` since it was added.
2. **macOS must let the phone in.** System Settings → Network → **Firewall**.
   If it is on, use **Options…** and allow incoming connections for the
   process that binds the port (`node`, or Xcode when ▶ is what started it) —
   or turn the firewall off while you work, which is the one toggle and is what
   most people do. On Sequoia there is a second, newer one that catches people
   out: System Settings → Privacy & Security → **Local Network** → Terminal (or
   Xcode) **on**. A refused Local Network permission looks exactly like a
   firewall block: a blank page and no error.
3. **Both on the same Wi-Fi**, and not a guest network that isolates clients.

**The proof, and it is worth doing once so you trust the loop:** with the app
running on the phone, edit `shell/library/library.html` on the Mac — put a `.`
in the title — and save. The page reloads **on the phone**, by itself, within a
second. The dev server serves `shell/` straight off disk and injects a
WebSocket that tells the page to reload; nothing is compiled and nothing is
installed. That is the loop, and it is why `tools/phone.sh` is for the rare day
and not the daily one.

Two things it does **not** cover, and both need §6e's real build: a change to
Rust (the dev server only serves the web half — Rust changes do rebuild and
relaunch, which takes the minutes a build takes), and a change to `project.yml`
or a plist key.

---

## 6d. Seeing the console — Safari's inspector

When something is blank or garbled, the app says why in its log, and this is
how you read it. Two toggles, once each:

* **On the Mac** — Safari → Settings → Advanced → **Show features for web
  developers**.
* **On the phone** — Settings → Safari → Advanced → **Web Inspector** on.

Then **Safari → Develop → `iPhone 2` → Frank** while the app is running.
`console.log`, the network tab, and `TTSTVHost.pairRead()` at a prompt all work
from there — §6b's console drive is typed into exactly that window.

**No code change was needed for this.** Tauri enables the web inspector on
`debug_assertions` builds by default (`WebviewWindowBuilder::devtools`, "Enabled
by default… works in debug builds"), and `tauri ios dev` and
`tauri ios build --debug` are both debug builds. If Frank is not listed under
Develop, it is one of the two toggles above, not the app. A **release** build is
a different matter: it needs tauri's `devtools` feature, and it is deliberately
not enabled.

On the simulator the same menu says **Simulator** instead of the phone's name.

---

## 6e. `xcodegen` — the step nothing else does

**`project.yml` is a source file, and only `xcodegen` applies it.**
`tauri ios build` and `tauri ios dev` do not regenerate the Xcode project, so
every key added to `project.yml` sits there doing nothing until:

```bash
cd src-tauri/gen/apple && xcodegen generate
```

Measured on 6 Sep, and it is not a hypothetical: `frank_iOS/Info.plist` carried
**none** of `NSLocalNetworkUsageDescription`, `NSBonjourServices` or
`NSAppTransportSecurity` — all three added to `project.yml` that morning — while
`CFBundleURLTypes` *was* there, because the deep-link plugin's own build script
writes that one into the plist directly at build time rather than through
xcodegen. So the ATS exception §6c needs, and the local-network permission
job 26's Bonjour browse needs, have both been written and neither has ever been
in a build.

`tools/phone.sh` runs `xcodegen` first, before anything else, for this reason.
If you build by hand or press ▶, run it yourself after touching `project.yml`.
**Xcode caches the project**: close and reopen it after a regeneration, or ▶
builds the old one.

---

## 6f. Xcode's ▶ — one click, and the PATH that stopped it

Open `src-tauri/gen/apple/frank.xcodeproj`, pick the phone in the toolbar, press
▶. It builds the Rust, signs, installs and launches, and the debugger is
attached — which is the one thing the terminal loop does not give you.

**Why it died on 6 Sep, and it was not a Rust fault.** The "Build Rust Code"
phase runs under Xcode's own environment, which is a login shell's PATH and not
yours: no `~/.zshrc`, so no `~/.cargo/bin`, so no `cargo` and no `rustup`. `npm`
was found (Xcode inherits `/usr/local/bin`) and `cargo` was not, so the phase
failed on the first command that needed it while the identical line in Terminal
worked. `project.yml`'s script phase now begins

```
export PATH="$HOME/.cargo/bin:$PATH"
```

and it prepends rather than appends deliberately, so a Homebrew rust cannot win
and build against a different toolchain than the terminal does.

**It reaches Xcode only through §6e.** Run `xcodegen generate`, then close and
reopen the project, then ▶.

---

## 6g. `tools/phone.sh` — the rare real build, as one command

```bash
tools/phone.sh              # xcodegen, build --debug, install on the phone
tools/phone.sh --shell      # ...and re-import the shell from TTSTV first
```

Four steps in the order that makes each true: `xcodegen` (§6e — first, because
it is the one everybody forgets), the shell import only when asked (it replaces
`shell/` whole and needs TTSTV on the disk), `tauri ios build --debug` (always
debug: a release build is not inspectable and a free team cannot install one),
then `devicectl install` onto the one connected phone. It finds the udid itself,
refuses rather than guesses when two phones are plugged in, and asks nothing.

It does **not** run §0's keychain line for you. That changes a keychain ACL, and
that is a thing to type once, yourself, having read what it does.

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
