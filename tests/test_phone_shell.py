"""The phone app ships the shell, whole, and serves every file in it.

Ported from TTSTV's `Frank/tests/test_frank_shell.py` (commit `83da179`), with
one substitution running through all of it: where that file asked
`reader/sw.js` what the shell is, this one asks `shell.manifest.json` -- the
record the import wrote. TTSTV is not on the disk when this repo is built, and
copying its list here would be the fourth copy of a list whose whole history is
drift (`tools/shell_manifest.py` says why a record is not a list).

Nothing here needs cargo, a phone, or a network.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
LIB_RS = REPO / "src-tauri" / "src" / "lib.rs"
CONF = REPO / "src-tauri" / "tauri.conf.json"

sys.path.insert(0, str(REPO / "tools"))
from shell_manifest import HOME_PAGE, INDEX_HTML, MANIFEST, NEVER, SHELL, check  # noqa: E402

needs_shell = pytest.mark.skipif(
    not MANIFEST.exists(),
    reason="shell/ has not been imported yet -- `python3 tools/import_shell.py --ttstv <TTSTV>`; "
           "blocked on TTSTV job 15 while reader/reader.html and the two icons are absent there",
)


def _conf() -> dict:
    return json.loads(CONF.read_text(encoding="utf-8"))


def _manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


# --------------------------------------------------------------- the app ---

def test_the_identity_and_name_are_the_ones_8b_asked_for():
    c = _conf()
    assert c["productName"] == "Frank"
    # Not `com.ttstv.desktop`, and not a second identifier for the phone: the
    # phone app and the desktop thin client are ONE app on two platforms, which
    # is the claim `src-tauri/src/lib.rs`'s single `run()` makes in code.
    assert c["identifier"] == "com.ttstv.frank"


def test_the_window_opens_on_the_library():
    text = LIB_RS.read_text(encoding="utf-8")
    assert f'HOME_PAGE: &str = "{HOME_PAGE}"' in text
    # One window. A second `WebviewWindowBuilder::new` is Studio's tab strip
    # creeping in, and Studio is a different app.
    assert text.count("WebviewWindowBuilder::new(") == 1


def test_the_frontend_is_the_committed_shell_and_the_before_command_only_checks_it():
    c = _conf()
    # `../shell`, not `../dist`: the shell is committed in this repo rather
    # than staged from TTSTV at build time, which is what lets the phone app
    # build with no TTSTV on the disk.
    assert c["build"]["frontendDist"] == "../shell"
    for key in ("beforeBuildCommand", "beforeDevCommand"):
        # One word per argument: Tauri runs this through `cmd /S /C` on
        # Windows, where a shell-grouped line is a syntax error before
        # anything compiles.
        assert c["build"][key] == "python3 tools/prebuild.py", c["build"][key]


def test_the_config_declares_no_window_so_setup_can_unpack_first():
    assert _conf()["app"]["windows"] == []


def test_there_is_no_python_and_no_server_in_the_app():
    """`desktop/SHIPPING.md` 8b: 'there is no Python to bundle and no local door
    to close'. The thing that would make this Studio again is a child process,
    so the check is on the crate, not on a comment."""
    src = REPO / "src-tauri" / "src"
    assert not (src / "server.rs").exists()
    for f in sorted(src.glob("*.rs")):
        code = "\n".join(
            l for l in f.read_text(encoding="utf-8").splitlines()
            if not l.lstrip().startswith("//")
        )
        for banned in ("std::process::Command", "Command::new", "python3", "sidecar"):
            assert banned not in code, f"{f.name} spawns things: {banned}"
    assert "tauri-plugin-shell" not in (REPO / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")


@needs_shell
def test_the_app_names_no_shell_file_of_its_own():
    """The list is TTSTV's and this repo restates no part of it. Checked on
    code, not on prose: the comments in `lib.rs` quote example URLs on purpose,
    and a comment cannot drift out of sync with anything because nothing reads
    it. The comparison set is the shell's real names, so a rust test fixture
    called `a.js` is not a false positive -- the question is whether this repo
    names a file of the SHELL, not whether it contains a string with a dot in
    it."""
    names = {Path(p).name for p in _manifest()["files"]}
    for f in sorted(REPO.rglob("*")):
        parts = set(f.parts)
        if not f.is_file() or {"shell", "target", "node_modules", "_to_delete", ".git", "gen"} & parts:
            continue
        if f.suffix not in {".py", ".rs"} or f.name.startswith("test_"):
            continue
        code = "\n".join(
            l for l in f.read_text(encoding="utf-8").splitlines()
            if not l.lstrip().startswith(("//", "#"))
        )
        # Whole path segments, so `book.json` is not read as `book.js` -- and
        # for eight days it WAS, because this pattern had no right-hand
        # boundary and `book.json` matched `book.js` inside itself. Found
        # 6 Sep: `tools/prebuild.py` says "no `book.json` or ..." in its own
        # docstring, and that sentence was failing the test that exists to keep
        # `book.json` out. The lookahead is the fix, and it is the reason the
        # comment above it now has a test of its own below.
        tokens = set(re.findall(r"[\w.-]+\.(?:js|css|html|png|webmanifest)(?![\w.-])", code))
        # `library/library.html` is the page the window opens on: a
        # destination, and the only shell name this repo is allowed to know.
        # `sw.js` is the third, and it is the opposite of a restatement:
        # `reader/sw.js` is where the LIST lives, so `import_shell.py` has to
        # name it to read the list off it and to refuse a directory that is not
        # a TTSTV checkout. A rule that forbade naming the source of the list
        # would forbid the one thing this repo is built to do (README, "The
        # list of what the shell is lives in TTSTV"). Found 6 Sep: this test had
        # been red since the Android lane, on exactly that name.
        hits = sorted((tokens & names) - {"library.html", "index.html", "sw.js"})
        assert not hits, f"{f.relative_to(REPO)} names shell files itself: {hits}"


def test_the_names_the_tools_are_allowed_to_know_are_these_three():
    """`library/library.html` is the page the window opens on -- a destination.
    `index.html` is the one name this repo adds. `reader/sw.js` is where the
    LIST lives, so naming it is how the list is read rather than copied.
    `book-data.js` and `book.json` are the two that must NEVER arrive. All of
    them are the opposite of a file list, and they are asserted here so the
    exemptions above are a statement rather than a hole."""
    assert HOME_PAGE == "library/library.html"
    assert INDEX_HTML == "index.html"
    assert set(NEVER) == {"book-data.js", "book.json"}
    # the exemption is for the LIST's source, and it is a read, not a copy
    src = (REPO / "tools" / "import_shell.py").read_text(encoding="utf-8")
    assert "reader" in src and "sw.js" in src, "import_shell reads the list off sw.js"
    assert "shell_files()" in src, "...by calling TTSTV's own reader, never by listing"


def test_a_json_name_is_not_read_as_a_js_name():
    """The scan above matches whole path segments. Asserted rather than
    commented, because it was commented and untrue for eight days: `book.json`
    matched `book.js` inside itself and put a permanent red on the suite."""
    pat = re.compile(r"[\w.-]+\.(?:js|css|html|png|webmanifest)(?![\w.-])")
    assert pat.findall("no book.json or state.json here") == []
    assert pat.findall("reader/sw.js and book.js") == ["sw.js", "book.js"]
    assert pat.findall("library.html, tokens.css, icon-192.png") == [
        "library.html", "tokens.css", "icon-192.png"]


# ------------------------------------------------------------- the shell ---

@needs_shell
def test_the_shell_on_disk_is_the_shell_that_was_imported():
    assert check() == []


@needs_shell
def test_the_app_serves_every_extension_the_shell_actually_has():
    """The content-type match in `lib.rs` covers the shell, with no silent
    `application/octet-stream` fallback for a real file. A shell that gains a
    `.svg` or a `.woff2` fails here rather than shipping as a blank page --
    a webview does not report the wrong type as an error, it just does not run
    the script."""
    served = set(re.findall(r'Some\("([a-z0-9]+)"\)\s*=>', LIB_RS.read_text(encoding="utf-8")))
    have = {Path(p).suffix.lstrip(".") for p in _manifest()["files"]}
    assert have, "the manifest names no files"
    missing = sorted(have - served)
    assert not missing, f"shell files the app would serve as octet-stream: {missing}"


@needs_shell
def test_no_book_reaches_the_phone_in_any_form():
    names = {Path(p).name for p in _manifest()["files"]}
    assert not (names & set(NEVER)), sorted(names & set(NEVER))


@needs_shell
def test_the_shell_adds_exactly_one_name_of_its_own():
    """`publish_shell.py` writes the shell; this repo adds the bundle's root
    and nothing else. Asserted rather than described, because "and nothing
    else" is the half that rots."""
    m = _manifest()
    assert m["added_here"] == [INDEX_HTML]
    assert INDEX_HTML in m["files"]
    assert (SHELL / HOME_PAGE).is_file()
