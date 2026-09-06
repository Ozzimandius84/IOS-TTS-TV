# IOS-TTS-TV — STATUS

Newest first. `REPORT_PROTOCOL.md` (TTSTV), nine headings. `README.md` says what the repo IS.

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
`git add -- SYNC.md STATUS.md` then `git commit -m … -- SYNC.md STATUS.md`; hash below.
HEAD did not move under me in this repo.

### 9. Status line
`IOS-TTS-TV · job 26 phone half 0/4 built, laid out · 6 Sep · waiting on a/b/c`
