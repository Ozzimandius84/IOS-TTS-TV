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

