p='SYNC.md'; s=open(p).read()
old = """Sign-in on the Mac: Studio opens the browser, listens on loopback, exchanges the code
(PKCE), keeps the refresh token in `TTS_DATA/studio/google.json` (0600). On the phone:
`ASWebAuthenticationSession` via the plugin, refresh token in the keychain. Neither ever
leaves the device; the Transfer row shows the account's email; Sign out revokes."""
new = """Sign-in on the Mac: Studio opens the browser, listens on loopback, exchanges the code
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
reverse in `tauri.conf.json`; `tests/test_google_link.py` fails until they agree."""
assert s.count(old)==1
open(p,'w').write(s.replace(old,new))
print('ok')
