"""Google's link: one id, one scheme, and the key the shell polls.

Job 26b (Osca, 6 Sep). `studio/google.py` and `library/drive.js` (TTSTV) own
the flow; this repo owns the two things only the app can do -- opening
Google's consent page in the SYSTEM browser (Google refuses it in a web
view, RFC 8252 §8.12) and catching the redirect the OS hands back.

What is proved HERE and not in `src-tauri/src/lib.rs`'s own `#[cfg(test)]`:
the things that are FILES, for `test_pair_link.py`'s reason -- this repo has
no cargo reachable from a Cowork session, so the file-level agreements are
asserted where they can actually run. The id is pasted in ONE place
(`src-tauri/google.json`); the scheme in `tauri.conf.json` is what the
deep-link plugin's build script writes into `CFBundleURLTypes`, so it is the
same fact spelled twice and a test rather than a comment holds them in step.

Nothing here needs cargo, a phone, or a network.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GOOGLE_JSON = REPO / "src-tauri" / "google.json"
CONF = REPO / "src-tauri" / "tauri.conf.json"
LIB_RS = REPO / "src-tauri" / "src" / "lib.rs"
CARGO = REPO / "src-tauri" / "Cargo.toml"
CAPABILITY = REPO / "src-tauri" / "capabilities" / "default.json"
BUILD_RS = REPO / "src-tauri" / "build.rs"
DRIVE_JS = REPO / "shell" / "library" / "drive.js"

REDIRECT_KEY = "ttstv.sync.googleRedirect"


def client_id() -> str:
    return (json.loads(GOOGLE_JSON.read_text()).get("ios_client_id") or "").strip()


def reverse_scheme(cid: str) -> str:
    assert cid.endswith(".apps.googleusercontent.com"), \
        f"an iOS client id ends .apps.googleusercontent.com; google.json has {cid!r}"
    return "com.googleusercontent.apps." + cid[: -len(".apps.googleusercontent.com")]


def mobile_schemes() -> list:
    conf = json.loads(CONF.read_text())
    out = []
    for entry in conf["plugins"]["deep-link"]["mobile"]:
        out.extend(entry.get("scheme") or [])
    return out


def test_google_json_exists_and_is_the_one_place_the_id_is_pasted():
    d = json.loads(GOOGLE_JSON.read_text())
    assert list(d) == ["ios_client_id"], "one field, and it is the id"
    assert isinstance(d["ios_client_id"], str)
    # nothing else in the repo carries an id: one place to paste, one to change.
    # (`lib.rs` names the SUFFIX -- it derives the redirect from it -- and
    # `tauri.conf.json` carries the reverse SCHEME, which the test below holds
    # to this file's id. Neither is a second copy of the id.)
    an_id = re.compile(r"\b\d[\w-]*\.apps\.googleusercontent\.com")
    for p in (LIB_RS, CAPABILITY, BUILD_RS):
        found = [m.group(0) for m in an_id.finditer(p.read_text()) if not m.group(0).startswith("12-")]
        assert found == [], f"{p.name} carries a client id ({found}); google.json is the one place"


def test_the_scheme_is_the_reverse_of_the_id_and_frank_pair_still_stands():
    schemes = mobile_schemes()
    assert "frank-pair" in schemes, "the pairing scheme (job 23d) is still declared"
    cid = client_id()
    if not cid:
        # not pasted yet: then no reverse scheme may be declared either, or a
        # build would advertise a URL type nothing can answer
        assert [s for s in schemes if s.startswith("com.googleusercontent")] == [], \
            ("tauri.conf.json declares a Google URL scheme but google.json has no id -- "
             "paste the id, or drop the scheme")
        return
    want = reverse_scheme(cid)
    assert want in schemes, (
        f"google.json has {cid} but tauri.conf.json's plugins.deep-link.mobile does not declare "
        f"{want!r}. Add it there: iOS hands the redirect back on that scheme and nowhere else, "
        f"so without it a sign-in gets as far as Google and never comes home.")
    desktop = json.loads(CONF.read_text())["plugins"]["deep-link"].get("desktop", {}).get("schemes", [])
    assert "frank-pair" in desktop


def test_the_redirect_key_is_the_one_the_shell_polls():
    """The crate writes it; `library/drive.js` (imported into `shell/`) reads
    it. One string, two files, and the shell's copy is the imported one."""
    assert f'"{REDIRECT_KEY}"' in LIB_RS.read_text()
    if DRIVE_JS.exists():
        assert f'"{REDIRECT_KEY}"' in DRIVE_JS.read_text(), \
            "shell/library/drive.js polls a different key -- re-import the shell"


def test_the_command_is_declared_granted_and_narrow():
    """`google_sign_in` is a command (build.rs), granted on the page
    (capabilities), and refuses any address but Google's own."""
    assert '"google_sign_in"' in BUILD_RS.read_text()
    assert "allow-google-sign-in" in json.loads(CAPABILITY.read_text())["permissions"]
    rs = LIB_RS.read_text()
    assert 'const AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth?"' in rs
    assert "if !url.starts_with(AUTH)" in rs, "the command must refuse any other address"
    # the opener plugin is registered but never reachable from the page
    assert "tauri-plugin-opener" in CARGO.read_text()
    assert "tauri_plugin_opener::init()" in rs
    assert "opener:" not in json.dumps(json.loads(CAPABILITY.read_text())["permissions"]), \
        "the opener plugin gets no page permission -- google_sign_in is the only door"


def test_no_secret_is_anywhere_in_this_repos_google_half():
    """An iOS OAuth client has no secret, and PKCE needs none. If one ever
    appears here it is a mistake, not a feature."""
    for p in (LIB_RS, CONF, GOOGLE_JSON, CARGO, BUILD_RS, CAPABILITY):
        text = p.read_text()
        # the WORD may be written (lib.rs's own test asserts the injected JS
        # does not contain it); a FIELD or a value may not
        assert not re.search(r'client_secret\s*[:=]', text), f"{p.name} sends a client secret"
        assert not re.search(r"GOCSPX-[A-Za-z0-9_-]+", text), f"{p.name} carries a Google secret"
