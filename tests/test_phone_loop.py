"""The one-press loop: the dev server, Xcode's ▶, and the build script.

Three faults cost Osca an afternoon on 6 Sep and none of them was in the app:

* `tauri ios dev "iPhone 2"` bound `127.0.0.1`, so the phone had nothing to
  load and drew a blank Library;
* Xcode's ▶ ran "Build Rust Code" with a login shell's PATH, so there was no
  cargo;
* and `project.yml` had been carrying plist keys for hours that were in no
  build, because **nothing but `xcodegen` applies that file** and nothing had
  run it.

The first is a flag and lives in `PHONE.md`. The other two are files, and this
holds them. Nothing here needs cargo, Xcode, a phone or a network.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import os
import re
import stat
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
PROJECT_YML = REPO / "src-tauri" / "gen" / "apple" / "project.yml"
INFO_PLIST = REPO / "src-tauri" / "gen" / "apple" / "frank_iOS" / "Info.plist"
PHONE_SH = REPO / "tools" / "phone.sh"
PHONE_MD = REPO / "PHONE.md"

yaml = pytest.importorskip("yaml", reason="pyyaml is not installed")


def _project() -> dict:
    return yaml.safe_load(PROJECT_YML.read_text(encoding="utf-8"))


def _rust_phase() -> str:
    for s in _project()["targets"]["frank_iOS"]["preBuildScripts"]:
        if s.get("name") == "Build Rust Code":
            return s["script"]
    raise AssertionError("project.yml has no 'Build Rust Code' script phase")


# ------------------------------------------------------------------ Xcode's ▶

def test_the_rust_phase_puts_cargo_on_the_path_before_it_needs_it():
    """Xcode's ▶ runs this with a login shell's PATH: no ~/.zshrc, so no
    ~/.cargo/bin. `npm` is found because Xcode inherits /usr/local/bin; cargo
    is not, because rustup installs into $HOME."""
    script = _rust_phase()
    lines = [l.strip() for l in script.splitlines() if l.strip()]
    assert lines, "the phase is empty"
    assert lines[0] == 'export PATH="$HOME/.cargo/bin:$PATH"', lines[:2]
    # ...and BEFORE the command, not after it
    cmd = next(i for i, l in enumerate(lines) if "xcode-script" in l)
    assert cmd > 0, "the export must come before the command that needs cargo"


def test_the_path_is_prepended_and_names_no_particular_mac():
    script = _rust_phase()
    assert "$HOME/.cargo/bin:$PATH" in script, "prepend, or a Homebrew rust wins"
    assert "/Users/" not in script, "no hard-coded home -- this file is not about one Mac"


# --------------------------------------------------------- the ATS exception

def test_the_lan_dev_server_is_allowed_by_the_plist_source():
    """`tauri ios dev --host` serves plain http (and a ws for the reload) from a
    private address. iOS refuses that by default and says nothing about it."""
    info = _project()["targets"]["frank_iOS"]["info"]["properties"]
    ats = info.get("NSAppTransportSecurity") or {}
    assert ats.get("NSAllowsLocalNetworking") is True, info.keys()


# ------------------------------------------------- and the step nothing does

PROJECT_YML_ONLY_KEYS = (
    "NSAppTransportSecurity",
    "NSLocalNetworkUsageDescription",
    "NSBonjourServices",
)


def test_the_generated_plist_is_regenerated_or_the_gap_is_named():
    """**`project.yml` is a source file and only `xcodegen` applies it.**
    `tauri ios build` does not regenerate, so a key added here reaches no build
    until somebody runs it -- which on 6 Sep was true of all three keys below.

    This does not fail on the drift, because the drift is a state of Osca's
    working tree and not of the committed source: `Info.plist` is generated and
    the repo cannot make him run a command. It fails if PHONE.md ever stops
    telling him to, which is the part this repo controls."""
    for key in PROJECT_YML_ONLY_KEYS:
        assert key in PROJECT_YML.read_text(encoding="utf-8"), key
    md = PHONE_MD.read_text(encoding="utf-8")
    assert "xcodegen generate" in md
    assert re.search(r"only\s+`?xcodegen`?\s+applies it", md, re.I), \
        "PHONE.md must say that nothing else applies project.yml"

    if INFO_PLIST.exists():
        stale = [k for k in PROJECT_YML_ONLY_KEYS
                 if k not in INFO_PLIST.read_text(encoding="utf-8")]
        if stale:
            pytest.skip(
                "the generated Info.plist is behind project.yml -- missing "
                + ", ".join(stale)
                + ". Run `cd src-tauri/gen/apple && xcodegen generate` (PHONE.md §6e). "
                  "This is a working-tree state, not a fault in the source."
            )


# ------------------------------------------------------------- tools/phone.sh

def test_phone_sh_is_one_command_with_no_prompts():
    assert PHONE_SH.is_file()
    src = PHONE_SH.read_text(encoding="utf-8")
    assert src.startswith("#!/usr/bin/env bash")
    assert "set -euo pipefail" in src
    # the four steps, in the order that makes each one true
    for i, needle in enumerate(["xcodegen generate", "import_shell.py",
                                "tauri ios build --debug", "devicectl device install"]):
        assert needle in src, needle
        if i:
            assert src.index(needle) > src.index(prev), f"{needle} must come after {prev}"
        prev = needle
    # never a release build: not inspectable, and a free team cannot install one
    assert "--release" not in src
    # it asks nothing, and it does not silently pick between two phones
    assert "read -" not in src.replace('read -rsp', ''), "no prompts"
    assert "more than one device" in src


def test_phone_sh_does_not_run_the_keychain_line_for_you():
    """§0 changes a keychain ACL. That is a thing a person types once, having
    read what it does -- not something a build script does behind them."""
    assert "set-key-partition-list" not in PHONE_SH.read_text(encoding="utf-8")
    assert "set-key-partition-list" in PHONE_MD.read_text(encoding="utf-8"), \
        "but PHONE.md must carry it, as step 0"


def test_phone_sh_runs_under_shellcheck_free_bash_n():
    assert subprocess.run(["bash", "-n", str(PHONE_SH)]).returncode == 0


# ------------------------------------------------------------- the daily loop

def test_phone_md_names_the_flag_the_blank_screen_needed():
    md = PHONE_MD.read_text(encoding="utf-8")
    assert "--host" in md
    assert "127.0.0.1" in md, "and says what it binds without it"
    for toggle in ["Firewall", "Local Network", "Web Inspector"]:
        assert toggle in md, toggle
