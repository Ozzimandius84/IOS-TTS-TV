"""The search sheet: `frank_search` is an SFSafariViewController over the app.

`design/reader/search.html`'s WEB lane and `reader/lookup.js`'s Search button
mean the same thing -- these words, to the web, WITHOUT leaving the book. The
whole of the why is in `src-tauri/src/search.rs`; what is proved here is what
Rust cannot see and what `cargo test` cannot reach from a Cowork session
(STATUS.md, `ttstv-where-things-build`):

  * the four-file wiring -- `search.rs` <-> `FrankSearch.m` <-> `build.rs` <->
    `project.yml` -- where a disagreement is a link error twenty minutes into a
    phone build rather than a compile error in a second;
  * that `lib.rs` carries the two lines and NOT a fourth command, because a
    command would need an ACL entry nobody has written;
  * that the `-site:` exclusions in the shipped URL are the mock's, run out of
    `design/reader/search.html` itself rather than restated here;
  * `SEARCH_JS` run for real, under node, in the order Tauri actually injects
    scripts -- `window.__TAURI__` arrives AFTER a plugin's init script, so a
    shim that patches at install time patches nothing.

Nothing here needs cargo, Xcode, a simulator or a network. The TTSTV checkout
is optional: the two tests that want it skip without it.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
LIB_RS = REPO / "src-tauri" / "src" / "lib.rs"
SEARCH_RS = REPO / "src-tauri" / "src" / "search.rs"
BUILD_RS = REPO / "src-tauri" / "build.rs"
CAPS = REPO / "src-tauri" / "capabilities" / "default.json"
PROJECT_YML = REPO / "src-tauri" / "gen" / "apple" / "project.yml"
OBJC = REPO / "src-tauri" / "ios" / "FrankSearch.m"


#: `design/reader/search.html` and `reader/lookup.js` live in TTSTV, which is a
#: different checkout. The Mac's layout first, then the Cowork bridge's mount.
def _ttstv() -> Path | None:
    for p in (Path(os.environ["TTSTV"]) if os.environ.get("TTSTV") else None,
              REPO.parent.parent / "TTSTV" / "TTSTV",
              Path(os.path.expanduser("~/mnt/TTSTV"))):
        if p and (p / "reader" / "lookup.js").is_file():
            return p
    return None


def _yml_without_comments() -> str:
    """`project.yml`'s live lines -- its comments name what they forbid."""
    return "\n".join(ln for ln in PROJECT_YML.read_text("utf-8").splitlines()
                     if not ln.lstrip().startswith("#"))


def _const(name: str) -> str:
    """A `pub const NAME: &str = "…";` off search.rs. Read, never restated."""
    m = re.search(r'pub const %s: &str = "(.*?)";' % name, SEARCH_RS.read_text("utf-8"))
    assert m, f"search.rs has no {name}"
    return m.group(1)


# --------------------------------------------------------------- the wiring

def test_rust_and_objc_name_the_same_symbol():
    """An `extern "C"` block cannot check that a .m two directories away
    exports what it names; that is a link error at the last minute."""
    rust = set(re.findall(r"fn (frank_search_\w+)\(", SEARCH_RS.read_text("utf-8")))
    objc = set(re.findall(r"^int (frank_search_\w+)\(", OBJC.read_text("utf-8"), re.M))
    assert rust, "search.rs declares no frank_search_* symbol"
    assert rust == objc, f"rust declares {sorted(rust)}, FrankSearch.m defines {sorted(objc)}"


def test_exactly_one_thing_compiles_the_objc_file():
    """`build.rs` compiles it with `cc`; `project.yml` would compile it again by
    naming it (or `../../ios`) in the target's sources. Both is `duplicate
    symbol _frank_search_present` -- the lesson FrankAudio.m learned at 14:24
    on 6 Sep."""
    by_cc = "ios/FrankSearch.m" in BUILD_RS.read_text("utf-8")
    yml = _yml_without_comments()
    by_xcode = "- path: ../../ios" in yml or "FrankSearch.m" in yml
    assert by_cc != by_xcode, f"cc compiles it: {by_cc}; xcode compiles it: {by_xcode}"


def test_its_own_archive_and_not_frankaudios():
    """`compile()` names the archive. One archive called `frankaudio` holding
    the search sheet is the lie that costs an hour the next time a symbol goes
    missing -- build.rs's own note."""
    assert 'compile("franksearch")' in BUILD_RS.read_text("utf-8")


def test_safariservices_is_linked_by_the_thing_that_runs_the_linker():
    """This crate is a `staticlib`: cargo never links, so
    `cargo:rustc-link-lib=framework=SafariServices` reaches nothing. Xcode links
    the app, so `project.yml` must name the framework."""
    assert "SafariServices.framework" in _yml_without_comments()


def test_lib_rs_carries_two_lines_and_no_fourth_command():
    """The plugin is registered; `frank_search` is deliberately NOT a command.
    A command would be a name in `generate_handler!`, a name in build.rs's
    manifest and `allow-frank-search` in the capability -- and until all three
    exist an invoke is refused by the ACL before it is dispatched.

    Since `2b6582a` (6 Sep) lib.rs DOES spell the name: `HOST_JS`'s
    `TTSTVHost.search(q)` invokes it at the press, which is exactly what the
    plugin's wrapper answers. So the claim is no longer "the string is absent
    from lib.rs" -- it is "the string is absent from `generate_handler!`"."""
    lib = LIB_RS.read_text("utf-8")
    assert "mod search;" in lib
    assert ".plugin(search::init())" in lib
    m = re.search(r"generate_handler!\[(.*?)\]", lib, re.S)
    assert m, "lib.rs has no generate_handler!"
    assert "frank_search" not in m.group(1), "frank_search must not be a real command"
    assert 'invoke("frank_search"' in lib, "HOST_JS no longer invokes the wrapper's name"
    # build.rs's MANIFEST -- its comments may name the .m file and the symbol.
    m = re.search(r"\.commands\(&\[(.*?)\]\)", BUILD_RS.read_text("utf-8"), re.S)
    assert m, "build.rs declares no command list"
    assert "frank_search" not in m.group(1), m.group(1)
    assert "frank-search" not in CAPS.read_text("utf-8")


def test_the_plugin_grants_the_page_nothing():
    """`Builder::new("search")` with no `invoke_handler`: there is no
    `plugin:search|…` command, so there is nothing for a capability to allow and
    nothing a page gains beyond asking for a navigation."""
    rs = SEARCH_RS.read_text("utf-8")
    assert "invoke_handler" not in rs
    assert "#[tauri::command]" not in rs


# ------------------------------------------------------------ the exclusions

def test_the_url_carries_the_mocks_exclusions():
    """`design/reader/search.html`'s `COVERED` is the only source of the
    `-site:` list. Run out of the mock; never restated here."""
    ttstv = _ttstv()
    if ttstv is None:
        pytest.skip("no TTSTV checkout beside this one")
    mock = (ttstv / "design" / "reader" / "search.html").read_text("utf-8")
    m = re.search(r"const COVERED = \[(.*?)\];", mock, re.S)
    assert m, "search.html has no COVERED list"
    covered = re.findall(r'"([^"]+)"', m.group(1))
    assert covered == ["gutenberg.org", "archive.org", "youtube.com",
                       "wikipedia.org", "wiktionary.org"], covered
    # the page builds `QUERY + " -site:<d>"` per domain; the sheet's URL is the
    # engine prefix and that query, percent-encoded and otherwise untouched.
    assert 'COVERED.map(d => " -site:" + d)' in mock
    assert _const("SEARCH") == "https://www.google.com/search?q="


def test_the_engine_is_the_one_the_desktop_host_already_named():
    """One press, one URL, whichever of the three landings takes it. Since
    TTSTV `5fbb23c` `reader/lookup.js` carries no engine at all (it calls
    `TTSTVHost.search(q)` with the bare word); the desktop's copy of the
    address is `desktop/src/host.js`'s `TAB_DOOR`, and it must be this one."""
    ttstv = _ttstv()
    if ttstv is None:
        pytest.skip("no TTSTV checkout beside this one")
    lookup = (ttstv / "reader" / "lookup.js").read_text("utf-8")
    assert "google.com/search" not in lookup, "lookup.js names an engine again"
    host = (ttstv / "desktop" / "src" / "host.js").read_text("utf-8")
    m = re.search(r'const TAB_DOOR = "([^"]+)";', host)
    assert m, "desktop/src/host.js has no TAB_DOOR"
    assert m.group(1) == _const("SEARCH")


def test_door_one_is_the_scheme_the_mock_writes():
    assert _const("DOOR") == "x-web-search:"
    assert 'DOOR = "x-web-search://?"' in SEARCH_RS.read_text("utf-8")


# ------------------------------------------------------------------ the shim

def test_the_press_is_proved_out_of_the_rust_files():
    """`scratch-j13/proof.mjs` (untracked) sliced the search control out of
    lookup.js -- a control that left with TTSTV `5fbb23c`. Its successor is
    `tests/search_lands_once.mjs` (`42c0c28`): Playwright, so not run here,
    but the two things that make it a proof of THIS code are static -- it reads
    SEARCH_JS and HOST_JS out of the .rs files by name, never retyped."""
    proof = REPO / "tests" / "search_lands_once.mjs"
    assert proof.is_file()
    src = proof.read_text("utf-8")
    assert 'rustConst("lib.rs", "HOST_JS")' in src
    assert 'rustConst("search.rs", "SEARCH_JS")' in src
