"""The inbox: the wiring of it, and the road that is deliberately not in it.

G-INBOX, 13 September. `src/inbox.rs` reads two roads, sends ONE item to the
paired Studio's own `POST /upload`, and takes it off the phone; `INBOX_JS` is
the door the page comes through and the row a person taps. This holds the
parts of that which are FILES -- declared, granted, handled, injected -- and
the shape of road two, which is out of `project.yml` and behind
`gen/apple/FrankShare/road-two.yml`, a file xcodegen never reads.

What is NOT here, and deliberately: the logic. `cargo test` holds `inbox.rs`'s
own sentences (18 tests) and `tests/inbox_row.mjs` presses the row in a real
browser. Nothing here needs cargo, Xcode, a phone or a network.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[1]
TAURI = REPO / "src-tauri"
APPLE = TAURI / "gen" / "apple"
INBOX_RS = TAURI / "src" / "inbox.rs"
LIB_RS = TAURI / "src" / "lib.rs"
PROJECT_YML = APPLE / "project.yml"
ROAD_TWO = APPLE / "FrankShare" / "road-two.yml"

COMMANDS = ("inbox_list", "inbox_send", "inbox_drop")
GROUP_ID = "group.com.ttstv.frank"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# --------------------------------------------------------------- the wiring


@pytest.mark.parametrize("cmd", COMMANDS)
def test_every_inbox_command_is_declared_granted_and_handled(cmd: str) -> None:
    """A command missing any one of the three is reachable from nothing, and
    the failure is silent: `invoke` rejects and a row sits there forever."""
    assert f'"{cmd}"' in read(TAURI / "build.rs"), f"build.rs does not declare {cmd}"
    cap = json.loads(read(TAURI / "capabilities" / "default.json"))
    perm = "allow-" + cmd.replace("_", "-")
    assert perm in cap["permissions"], f"the capability does not grant {perm}"
    lib = read(LIB_RS)
    run = lib[lib.index("pub fn run() {"):]
    assert f"inbox::{cmd}" in run[: run.index("])")], f"generate_handler! does not handle {cmd}"


def test_the_door_is_injected_and_calls_those_three_and_no_others() -> None:
    lib = read(LIB_RS)
    m = re.search(r'pub const INBOX_JS: &str = r#"([\s\S]*?)"#;', lib)
    assert m, "lib.rs has no INBOX_JS"
    js = m.group(1)
    assert ".initialization_script(INBOX_JS)" in lib
    assert len(re.findall(r"TAURI\.invoke\(", js)) == len(COMMANDS)
    for cmd in COMMANDS:
        assert f'invoke("{cmd}"' in js, f"the door never calls {cmd}"
    # A page that is not in Frank gets no door at all.
    assert "if (!TAURI" in js
    # The row is the Library page's, and it hangs off `.shell` -- never inside
    # `#shelf`, which the page re-renders.
    assert r"/\/library\/library\.html$/" in js
    assert 'querySelector(".shell")' in js
    assert 'getElementById("shelf")' not in js
    # F10: three states, and every one of them is a sentence.
    for state in ("waiting", "sending", "stuck"):
        assert state in js
    assert "Awaiting a parse" in js
    assert "Settings ▸ Transfer" in js
    # The pairing record is settings.js's: read, never written.
    assert '"ttstv.sync.pair"' in js
    assert "setItem" not in js


def test_the_door_studio_is_upload_and_not_run() -> None:
    """`POST /run` parses a book the Mac already has; an inbox item is a file
    the Mac has never seen. `POST /upload?name=&kind=` is the one route that
    takes bytes AND starts the ingest, and `handle_upload` does both."""
    rs = read(INBOX_RS)
    assert 'pub const UPLOAD: &str = "/upload";' in rs
    assert "{base}{UPLOAD}?name={}&kind={kind}&t={}" in rs
    # ...and it is not in the phone's allow-list yet, so 404 says exactly that
    # rather than going red with nothing in it.
    assert "this Studio has not opened /upload to a phone yet" in rs
    assert 'Err(format!("{base} is not an address Frank can post to"))' in rs


# ------------------------------------------------------- road two, and off


def test_the_share_extension_is_not_in_the_project_xcodegen_reads() -> None:
    spec = yaml.safe_load(read(PROJECT_YML))
    assert list(spec["targets"]) == ["frank_iOS"], "project.yml declares a second target"
    deps = spec["targets"]["frank_iOS"]["dependencies"]
    assert not any(d.get("target") == "FrankShare" for d in deps), "the app still embeds it"
    # ...and the app keeps everything it needs to link at all.
    assert any(d.get("framework") == "libapp.a" for d in deps)
    assert {"AVFoundation.framework", "SafariServices.framework"} <= {
        d.get("sdk") for d in deps if "sdk" in d
    }


def test_road_one_is_what_the_spec_ships() -> None:
    props = yaml.safe_load(read(PROJECT_YML))["targets"]["frank_iOS"]["info"]["properties"]
    names = [t["CFBundleTypeName"] for t in props["CFBundleDocumentTypes"]]
    assert names == ["PDF", "EPUB", "Text"]
    # A copy in our own container is the only thing an inbox can be.
    assert props["LSSupportsOpeningDocumentsInPlace"] is False
    assert props["UIFileSharingEnabled"] is True
    assert all(t["LSHandlerRank"] == "Alternate" for t in props["CFBundleDocumentTypes"])


def test_nothing_the_ship_build_signs_carries_an_app_group() -> None:
    for rel in ("frank_iOS/frank_iOS.entitlements", "FrankShare/FrankShare.entitlements"):
        text = read(APPLE / rel)
        assert "application-groups" not in text, f"{rel} would have to be signed"


def test_road_two_is_whole_behind_a_file_xcodegen_never_reads() -> None:
    """Both blocks parse in the shape XcodeGen wants, and the group is named
    once so nobody has to re-derive it."""
    t = read(ROAD_TWO)
    assert GROUP_ID in t, "it does not say what App Group it would need"
    a, b = t.split("# ============================================================ BLOCK B", 1)
    a = a.split("# ============================================================ BLOCK A", 1)[1]
    clean = lambda x: textwrap.dedent(
        "\n".join(l for l in x.split("\n") if not l.strip().startswith("# goes under"))
    )
    dep = yaml.safe_load(clean(a))
    assert dep == [{"target": "FrankShare", "embed": True, "codeSign": True}]
    tgt = yaml.safe_load(clean(b))
    assert list(tgt) == ["FrankShare"]
    assert tgt["FrankShare"]["type"] == "app-extension"
    # It points at the entitlements nothing signs today, not at the empty one
    # the app actually builds with.
    assert tgt["FrankShare"]["entitlements"]["path"].endswith("FrankShare.share.entitlements")


@pytest.mark.parametrize(
    "rel", ("frank_iOS/frank_iOS.share.entitlements", "FrankShare/FrankShare.share.entitlements")
)
def test_road_twos_own_entitlements_name_the_one_group(rel: str) -> None:
    import plistlib

    d = plistlib.loads((APPLE / rel).read_bytes())
    assert d["com.apple.security.application-groups"] == [GROUP_ID]
    assert f'pub const GROUP_ID: &str = "{GROUP_ID}";' in read(INBOX_RS), "inbox.rs disagrees"
