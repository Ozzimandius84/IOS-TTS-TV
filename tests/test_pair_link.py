"""The pairing link: one scheme, one key, and the fingerprint the Mac shows.

`cloud/tools/deploy_to_my_modal.py::pairing` (TTSTV, job 23b) decides WHAT a
phone is given -- seven fields, one object, carried across the room. This repo
owns the CARRIAGE: a launch scheme of its own, the URL type that makes the
system camera offer Frank, and the write into the one key the shell reads.

What is proved here and not in `src-tauri/src/lib.rs`'s own `#[cfg(test)]`:
the things that are FILES. Rust's tests can `include_str!` them, but this repo
has no cargo reachable from a Cowork session, so the file-level agreements are
asserted here where they can actually run. `parse_pair_link`'s behaviour is
Rust's own tests' job (10 of them, proved by line-range extraction -- STATUS.md
§2).

`PAIR_JS` is run for real, under node, against a `localStorage` stub, and its
fingerprint is checked against python's `hashlib` -- the same cross-language
check `library/tests/test_import.py` makes of the book hash, and for the same
reason: two implementations of one rule that nobody ever compares is how the
Mac and the phone come to disagree about which pass they are holding.

Nothing here needs cargo, a phone, or a network.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
LIB_RS = REPO / "src-tauri" / "src" / "lib.rs"
CONF = REPO / "src-tauri" / "tauri.conf.json"
PROJECT_YML = REPO / "src-tauri" / "gen" / "apple" / "project.yml"
CAPABILITY = REPO / "src-tauri" / "capabilities" / "default.json"
CARGO = REPO / "src-tauri" / "Cargo.toml"
NODE = shutil.which("node")


def _rust_const(name: str) -> str:
    """A `pub const <name>: &str = "…";` from lib.rs. Read, never restated."""
    m = re.search(rf'(?:pub )?const {name}: &str = "([^"]*)";', LIB_RS.read_text(encoding="utf-8"))
    assert m, f"lib.rs has no const {name}"
    return m.group(1)


def _pair_js() -> str:
    """`PAIR_JS`'s raw string, off lib.rs."""
    src = LIB_RS.read_text(encoding="utf-8")
    m = re.search(r'pub const PAIR_JS: &str = r#"(.*?)"#;', src, re.S)
    assert m, "lib.rs has no PAIR_JS raw string"
    return m.group(1)


# ------------------------------------------------------- the scheme is one word

def test_the_launch_scheme_is_not_the_asset_scheme():
    """The one that would be a hole. `frank://` answers with the served tree;
    a launch scheme is handed to the app by the OS from a square somebody else
    printed, and the two must never be the same word."""
    assert _rust_const("PAIR_SCHEME") != _rust_const("SCHEME")
    assert _rust_const("SCHEME") == "frank"


def test_the_scheme_is_the_same_word_in_lib_rs_the_config_and_the_project():
    """Three files, and each is authoritative for a different moment:

    * `lib.rs` parses the link,
    * `tauri.conf.json` is what `tauri-plugin-deep-link`'s build script reads
      to write `CFBundleURLTypes` into the generated Info.plist,
    * `gen/apple/project.yml` is what an `xcodegen` regeneration puts back into
      that same Info.plist afterwards.

    Two of them disagreeing is an app that builds and never opens from a QR.
    """
    scheme = _rust_const("PAIR_SCHEME")
    conf = json.loads(CONF.read_text(encoding="utf-8"))
    dl = conf["plugins"]["deep-link"]
    assert [d["scheme"] for d in dl["mobile"]] == [[scheme]]
    assert dl["desktop"]["schemes"] == [scheme]
    yml = PROJECT_YML.read_text(encoding="utf-8")
    assert "CFBundleURLTypes:" in yml
    assert f"- CFBundleURLName: {scheme}" in yml
    assert re.search(rf"CFBundleURLSchemes:\s*\n\s*- {re.escape(scheme)}\b", yml), yml[-800:]


def test_the_asset_scheme_is_declared_as_a_url_type_nowhere():
    """The negative of the test above, and worth its own name: if `frank` ever
    appears in the URL types, the camera can ask this app to open a path of its
    own served tree."""
    yml = PROJECT_YML.read_text(encoding="utf-8")
    types = yml[yml.index("CFBundleURLTypes:"):]
    types = types[:types.index("CFBundleShortVersionString")]
    assert re.search(r"^\s+- frank$", types, re.M) is None, types


def test_the_plugin_is_pinned_and_the_page_is_granted_none_of_it():
    """The plugin is registered in Rust and reachable from nowhere else. A page
    that could call its `get_current` could read the pass straight out of the
    launch URL, so the capability grants it nothing -- see the capability's own
    description."""
    assert re.search(r'^tauri-plugin-deep-link = "2\.', CARGO.read_text(encoding="utf-8"), re.M)
    cap = json.loads(CAPABILITY.read_text(encoding="utf-8"))
    assert not [p for p in cap["permissions"] if "deep-link" in p], cap["permissions"]
    assert "deep-link" in cap["description"], "and it says so, so nobody adds it back by accident"


# --------------------------------------------------------------- the one key

def test_the_key_is_spelled_once_in_rust_and_once_in_the_page():
    """`transfer.pairing` is the contract between two writers -- this repo's
    link and Settings > Transfer's typed field -- and one reader,
    `library/transfer.js`."""
    key = _rust_const("PAIR_KEY")
    assert key == "transfer.pairing"
    assert f'var KEY = "{key}"' in _pair_js()


# ------------------------------------------------------------ the writer runs

def _run_pair_js(fields: dict) -> dict:
    """Run `PAIR_JS` under node with a localStorage stub and call pairWrite."""
    driver = """
const store = {};
globalThis.localStorage = {
  setItem: (k, v) => { store[k] = String(v); },
  getItem: (k) => (k in store ? store[k] : null),
};
globalThis.window = globalThis;
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
const events = [];
globalThis.dispatchEvent = (e) => { events.push([e.type, e.detail]); return true; };
%s
window.TTSTVHost.pairWrite(%s).then((fp) => {
  process.stdout.write(JSON.stringify({
    fp, stored: store, keys: Object.keys(store), events,
    read: window.TTSTVHost.pairRead(), pairKey: window.TTSTVHost.PAIR_KEY,
  }));
}).catch((e) => { process.stdout.write(JSON.stringify({ error: String(e && e.message || e) })); });
""" % (_pair_js(), json.dumps(fields))
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "d.js"
        p.write_text(driver, encoding="utf-8")
        out = subprocess.run([NODE, str(p)], capture_output=True, text=True, timeout=60)
        assert out.returncode == 0, out.stderr
        return json.loads(out.stdout)


pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")


def test_the_writer_writes_the_seven_fields_in_the_agreed_order():
    r = _run_pair_js({"v": 1, "url": "https://ozzi--ttstv-cloud-api.modal.run",
                      "pass": "s3cret-pass", "workspace": "ozzi",
                      "app": "ttstv-cloud", "made": 1788000000})
    assert r.get("error") is None, r
    assert r["keys"] == ["transfer.pairing"], "one key, and nothing else touched"
    row = json.loads(r["stored"]["transfer.pairing"])
    assert list(row) == ["v", "url", "pass", "workspace", "app", "fp", "made"]
    assert row["url"] == "https://ozzi--ttstv-cloud-api.modal.run"
    assert row["pass"] == "s3cret-pass"
    assert row["made"] == 1788000000
    assert r["read"] == row, "pairRead gives back what pairWrite put"
    assert r["pairKey"] == "transfer.pairing"


def test_the_fingerprint_is_the_macs_own_eight_hex():
    """`deploy_to_my_modal.py::fingerprint` is `sha256(pass).hexdigest()[:8]`.
    The page computes it with `crypto.subtle`; python computes it here. If these
    two ever disagree, the square on the Mac and the row on the phone show
    different eight-hex and a person cannot tell a good pairing from a bad one."""
    for pw in ["s3cret-pass", "", "a", "éèê", "x" * 200]:
        want = hashlib.sha256(pw.encode("utf-8")).hexdigest()[:8]
        if not pw:
            continue          # a pass-less pairing is refused, see below
        r = _run_pair_js({"url": "https://x.io", "pass": pw})
        row = json.loads(r["stored"]["transfer.pairing"])
        assert row["fp"] == want, pw


def test_the_writer_refuses_a_pairing_with_no_address_or_no_pass():
    for bad in [{"url": "https://x.io"}, {"pass": "p"}, {"url": "", "pass": ""}]:
        r = _run_pair_js(bad)
        assert r.get("error"), bad
        assert "address" in r["error"] and "pass" in r["error"]


def test_the_defaults_are_the_macs_defaults():
    r = _run_pair_js({"url": "https://x.io", "pass": "p"})
    row = json.loads(r["stored"]["transfer.pairing"])
    assert row["v"] == 1 and row["app"] == "ttstv-cloud" and row["workspace"] == ""
    assert row["made"] > 1_700_000_000, "an absent made is stamped at the write"


def test_an_open_transfer_tab_is_told():
    r = _run_pair_js({"url": "https://x.io", "pass": "p"})
    assert [t for t, _ in r["events"]] == ["ttstv:pairing"]
    detail = r["events"][0][1]
    assert detail["url"] == "https://x.io"
    assert detail["fp"] == json.loads(r["stored"]["transfer.pairing"])["fp"]
    assert "pass" not in detail, "the event is for redrawing a row, not for carrying the pass"
