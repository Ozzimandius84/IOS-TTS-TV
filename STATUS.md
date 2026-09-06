# IOS-TTS-TV — STATUS

Newest first. `REPORT_PROTOCOL.md` (TTSTV), nine headings. `README.md` says what the repo IS.

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
