# SYNC.md — the phone half of job 26, laid out before it is built

Osca, 6 Sep: *"a Sync button in both, in Settings — push/pull, that's all. LAN today,
then Kaggle, iCloud, Google Drive."* Addendum, same day: *"Google IS the account …
Google Drive is now the FIRST cloud transport to build, iCloud second."*

The Mac half is TTSTV's — `studio/sync.py`, `studio/serve.py`'s LAN listener,
`reader/routes.py`'s two merges, `settings/routes.py`'s `GET /sync` — and on 6 Sep it
was **in flight in another session, uncommitted**. Everything below reads that contract
as it stood at 09:22 and names it; where it moves, this page is wrong and the code is
right. The mock is `design/reader/settings.html`'s Transfer tab (`92c1f58`).

## 1. What a sync is — the folder model, in one paragraph

One folder both apps can reach. Per book, the bundle's file set exactly as
`reader/tools/export_bundle.py` stages it and `library/import.js`'s `PAYLOAD` admits it —
`book.json`, `book-data.js`, `chapters/*.txt`, `timings/*.json`, `audio/*.opus`,
`dictionary.json`, `grammar.json`, `spans.json`, `align.json`, `render.json` — so a synced
book is byte-identical to a zip import and lands in the same place with the same name.
Beside the books, **the ledgers**: marks (the reader's marginalia records, merged by id,
newest `at` wins, tombstones kept) and positions (per book, newest `at` wins), and — from
the addendum — `settings.json`, merged newest-wins per key. **Nothing is deleted, ever.**
A book's version is its word-id hash (`core/provenance.py` = `library/import.js::bookHash`
= `studio/sync.py::hash_of`): "does the phone have this book?" is one string compare.

One code path, on both apps:

    sync = push my ledgers → pull the books whose hash I lack → pull the ledgers → merge

and the transport is one adapter behind four verbs.

## 2. Where the phone keeps things — and why the LAN half is JS, not Rust

The shell (`shell/`, imported from TTSTV, never edited here) owns every store the phone
has but one. **Books are NOT in the Cache API on the phone** (G-PULL, 11 Sep — this
paragraph said they were, and that was the bug): `Cache.put` refuses `frank://` (WebKit:
`Request url is not HTTP/HTTPS`), so `library/import.js` hands a book to the host's door,
`TTSTVHost.books` → `book_put`/`book_meta`/`book_list`/`book_remove` in `lib.rs`, which
writes `<app data>/books/<slug>/<rel>` and serves it back at `frank://localhost/books/…`.
The PWA and the Mac's pages keep the Cache (`ttstv-book-<slug>-<hash>`). The rest is the
page's own:
marks in `localStorage` `ttstv.reader.marginalia.<slug>` (`reader/marginalia.js`);
positions in `localStorage` `ttstv.reader.library`'s `positions` (`reader/cursor.js`).
A `fetch()` from the page to `http://<mac>:<port>/sync/manifest`, and the store step of
what comes back, IS the phone's LAN half. So the LAN transport is one file in the shell
(TTSTV `library/sync.js`, loaded by settings and the Library), and `lib.rs` changes
**nothing** for it. What the phone side does need, and where:

| need | where | why |
|---|---|---|
| `NSAppTransportSecurity` → `NSAllowsLocalNetworking = true` | `gen/apple/frank_iOS/Info.plist` (+ `project.yml`) | a `frank://` page fetching plain `http://192.168.x.x` is refused by ATS otherwise |
| `NSLocalNetworkUsageDescription` + `NSBonjourServices = [_ttstv._tcp]` | same | iOS 14+ asks once; without the service listed, `.local` names and mDNS browse are refused |
| `Access-Control-Allow-Origin` on the LAN listener | TTSTV `studio/serve.py` (in flight: `*`, OPTIONS answered) | the page's origin is `frank://localhost`, not the Mac's |
| the Studio picker | shell JS | WKWebView cannot browse Bonjour. Two honest ways: the code carries the address (the Mac's row shows "483 912 · 192.168.1.20:8766"; the phone types the code, the app reads `GET /sync/hello` at the address) — **today**; or a 40-line Swift `NetServiceBrowser` in a Tauri plugin that answers `frank://localhost/sync/studios` — **later**, when a picker is worth a plugin |
| token | shell JS, `localStorage` `ttstv.sync.lan` `{address, port, token, name}` | "remembered after once" |

Airplane mode: `fetch` fails → the button's line reads what `tr-state` says offline
("Not reachable · 31 books here"); the push is queued by the fact that the ledgers are
the phone's own stores — there is nothing to queue, the next sync pushes them.

## 3. The adapter — four verbs, the LAN mapped, the folders to follow

```js
// library/sync.js (TTSTV) — one adapter per "Sync through" row
Adapter = {
  list()            -> [{path, bytes, hash?}]      // every file in the folder
  get(path)         -> Response                    // one file, bytes
  put(path, bytes)  -> void                        // write/replace one file (books, settings.json)
  append(path, lines) -> void                      // add lines to a ledger; never rewrite it
}
```

| row | list | get | put | append |
|---|---|---|---|---|
| This network | `GET /sync/manifest` (token) | `GET /books/<slug>/<rel>`, `GET /sync/audio/<slug>/<cid>.opus` | — (Studio is the truth for books; the phone never puts a book at Studio in v1) | `POST /sync/marginalia`, `POST /sync/positions` — Studio merges and answers whole |
| Google Drive | `files.list q='<Frank folder> in parents'` | `files.get?alt=media` | `files.create/update` (multipart) | `files.update` on `marks.jsonl` with the whole file re-put (Drive has no append: read, concat, put — the ledger is small) |
| iCloud Drive | folder listing | file read | file write | file append |
| Kaggle | dataset files list | dataset file download | dataset version create | same as Drive |

The sync loop is written once against these four; a transport is only its table row.
`marks.jsonl`: one JSON object per line `{id, slug, kind, at, device, …}` in the
folder transports; on the LAN the same records travel in `studio/marginalia.py`'s record
shape because Studio already merges them — the ledger is the folder form of the record.

## 4. iCloud on a free team — checked, and the answer is no

Osca's note said *"an iCloud entitlement is free-team-allowed for Documents, check and say."*
It is not. A Personal Team cannot sign an app with the iCloud/CloudKit capability (or push,
App Groups, Associated Domains, Sign in with Apple, IAP); enabling it in the entitlements
makes the build fail at sign time, and the profile expires every 7 days regardless.
Sources: Apple, [About your developer account](https://developer.apple.com/help/account/basics/about-your-developer-account)
(App IDs/devices/profiles 7-day, App Store Connect members-only);
[Signing With a Free Personal Team](https://zudo-tauri-wisdom.takazudomodular.com/docs/mobile/ios-signing-free-team)
("iCloud / CloudKit — No").

What IS free: the **Files picker**. `UIDocumentPickerViewController` with a folder, the
person picks `iCloud Drive/Frank` once, the app keeps a security-scoped bookmark, and
reads/writes the folder through it with no ubiquity container and no entitlement. In
Tauri 2 that is a small Swift plugin (`pickFolder`, `readFile`, `writeFile`,
`listFolder`, ~150 lines) exposed at `frank://localhost/fs/...` — the same door a Drive
adapter would not need. So the iCloud row on the phone is "Choose folder…" (one tap,
once), not "nothing to type"; on the Mac it is `~/Library/Mobile Documents/com~apple~CloudDocs/Frank`,
as `studio/phone.py::icloud_dir` already finds it. The entitlement route comes back
with the paid Program (Q1).

## 5. Google — the account, and the clicks that are Osca's (§6)

Two OAuth clients, registered once, no server of ours, tokens on the device
(PKCE; no client secret is needed for either type):

1. console.cloud.google.com → a project ("Frank") → **APIs & Services ▸ Library** → enable
   **Google Drive API**.
2. **APIs & Services ▸ OAuth consent screen** (now "Google Auth Platform ▸ Branding /
   Audience"): External · app name Frank · your email · scope **`…/auth/drive.file`**
   only (non-sensitive: files the app created — the `Frank` folder — and nothing else of
   the person's Drive; no verification review needed). Add yourself as a test user while
   the app is in Testing.
3. **Clients** (`https://console.developers.google.com/auth/clients`) → **Create client**
   → **Desktop app** → name "Frank Studio (Mac)" → Create. Copy the client ID into
   `studio/sync.py`'s Google adapter. Redirect: `http://127.0.0.1:<port>` (loopback,
   the port chosen at run time).
4. **Create client** → **iOS** → name "Frank (iPhone)" → bundle ID `com.ttstv.frank`
   (Team ID optional) → Create. Copy the client ID into the shell's Google adapter.
   Redirect: `com.googleusercontent.apps.<client-number>:/oauth` — and that reverse
   client ID goes in `Info.plist` `CFBundleURLTypes` so iOS hands the redirect back to
   Frank (Tauri: `tauri-plugin-deep-link`, or the Swift plugin above catching the URL).
5. Windows and Android reuse the Desktop and an **Android** client respectively (later).

Source: [OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app),
[Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Sign-in on the Mac: Studio opens the browser, listens on loopback, exchanges the code
(PKCE), keeps the refresh token in `TTS_DATA/studio/google.json` (0600). On the phone:
`ASWebAuthenticationSession` via the plugin, refresh token in the keychain. Neither ever
leaves the device; the Transfer row shows the account's email; Sign out revokes.

**BUILT, 6 Sep (job 26b) — and three details of the paragraph above changed in the
building.** (1) The Mac's file is `account.json`, not `google.json`: the ids live
beside the token and `settings.py`/`sync.py` already own that folder. (2) The
phone's tokens are in `localStorage` (`ttstv.sync.google`), not the keychain --
the exchange happens in the page (`library/drive.js`), and a Rust round trip to
store what the page must read back on every press buys nothing; the keychain is
worth doing the day the phone has a Rust half of the flow at all. (3) The sheet
is the **system browser** through `tauri-plugin-opener`, not
`ASWebAuthenticationSession`: no Swift plugin, and it is what Google's own
native-app guidance names. The id is pasted in `src-tauri/google.json` and its
reverse in `tauri.conf.json`; `tests/test_google_link.py` fails until they agree.

## 6. Days, honestly, per transport (phone half; the Mac half is TTSTV's count)

| transport | what | days |
|---|---|---|
| This network | `library/sync.js` (loop + LAN adapter, ~250 lines), the Transfer panel wired (settings lane), two plist keys, `hello`-by-address pairing | **1** to press on the simulator; **+½** on the phone (ATS, local-network prompt) |
| Google Drive | Drive adapter + OAuth on both apps, the deep link on iOS, `settings.json` merge | **2–3**, after Osca's clicks |
| iCloud Drive | the Swift folder plugin, bookmark, adapter | **1½–2** |
| Kaggle | dataset adapter (versioned datasets are not a folder; every put is a new version) | **1½**, after the 13th |

## 7. What proves it (Osca's presses, `PHONE.md` order)

- LAN: Studio's row shows a code; the phone types it once; **Sync** → the line reads
  "Pulled 31 books · 12 marks"; `TTSTVHost.books.list()` in the phone's console lists
  the rows with the hashes `GET /sync/manifest` gave — one string compare per book,
  printed. A mark made on the phone → Sync → it is in
  `TTS_DATA/reader/marginalia/<slug>.json` on the Mac and the Mac's open reader repaints.
- Airplane mode: the button's line says not reachable; a mark made offline syncs on the
  next press, count printed before and after.
- Drive: a book exported by Studio into `Drive/Frank` appears on the phone after one press
  with the Mac's Wi-Fi off; the same `settings.json` key set on both, the newer wins.
