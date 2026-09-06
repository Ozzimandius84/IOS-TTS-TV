"""What is in `shell/`, recorded once so this repo can check it without TTSTV.

`shell/` is not this repo's code. It is TTSTV's app shell, written here by
`tools/import_shell.py` from `reader/sw.js`'s own `SHELL_FILES` -- the one
authoritative list (`reader/tools/shell_files.py` in TTSTV says why it is
authoritative and why nothing may restate it). This repo restates none of it
either. What it keeps instead is a RECORD of what actually arrived:
`shell.manifest.json`, written by the import, read by `tools/prebuild.py`
before every build and by `tests/`.

The difference matters. A list would drift -- that is the bug the manifest
machinery in TTSTV exists to stop, and copying the list here would be a fourth
copy of it. A record cannot drift: it is not an opinion about what the shell
should be, it is a fingerprint of what it was when it was imported. If the two
disagree, the answer is always the same one command.

The manifest lives at the repo root and NOT inside `shell/`, because
`tauri.conf.json`'s `frontendDist` is `../shell` and everything under it is
embedded in the app binary. The shell the phone gets is byte-for-byte what
`publish_shell.py` wrote, plus the one entry point this repo adds
(`index.html`, and it says so in `added_here`).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SHELL = REPO / "shell"
MANIFEST = REPO / "shell.manifest.json"

#: The page Frank's one window opens on (`src-tauri/src/lib.rs`'s `HOME_PAGE`).
#: Named here as well because a shell that arrives without it builds fine and
#: then paints a 404 on a phone, which is the failure of 5 Sep.
HOME_PAGE = "library/library.html"

#: The one name this repo adds to what `publish_shell.py` writes. It is a
#: redirect and not a copy of the Library page, so `library.html`'s relative
#: paths (`../reader/...`, `../prefs/...`) keep resolving as they do everywhere
#: else. Frank's window opens on `library/library.html` directly, so nothing in
#: the app reads it; it is here so the bundle has a root at all.
INDEX_HTML = "index.html"

INDEX = """<!doctype html>
<meta charset="utf-8">
<title>Frank</title>
<meta http-equiv="refresh" content="0; url=library/library.html">
<script>location.replace("library/library.html");</script>
"""

#: Never, on any phone, whatever a list says. `book-data.js` is a book (8.8 MB
#: of one) and books do not ship; `book.json` is the shape a book takes in
#: `books/<slug>/`. `publish_shell.py` refuses both at its end too -- this is
#: the same refusal at the other end of the wire, because the two ends are in
#: different repos and only one of them is here at build time.
NEVER = ("book-data.js", "book.json")

#: The two things a DEV run may have under `shell/` that an import did not
#: write, and a build still may not (`tools/dev_books.py`, 6 Sep).
#:
#: `shell/books/` is gitignored -- *a book is not part of the app* -- and that
#: has not changed: nothing commits one and `check()` without `dev=True` still
#: refuses them, so `beforeBuildCommand` stops a build carrying a book exactly
#: as it did before. What changed is only that `beforeDevCommand` no longer
#: refuses the thing that makes a simulator show a Library at all.
#:
#: `library/library.json` is here for the same reason and by the same rule: it
#: is the inventory `library.html` reads when no Studio answers, it is written
#: by `dev_books.py` beside the books it describes, and it is as much *not the
#: app* as they are.
DEV_ONLY = ("books/", "library/library.json")


def is_dev_only(rel: str) -> bool:
    """Is this site path one of the two a dev run may add? Prefix-matched on
    `books/` so every file of every dev book is covered by one rule, and exact
    for the inventory beside them."""
    return rel == "library/library.json" or rel.startswith("books/")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def walk(shell: Path = SHELL) -> dict[str, Path]:
    """Every regular file under `shell/`, keyed by its site path."""
    return {
        str(p.relative_to(shell)).replace("\\", "/"): p
        for p in sorted(shell.rglob("*"))
        if p.is_file()
    }


def describe(shell: Path = SHELL) -> dict:
    files = walk(shell)
    return {
        "count": len(files),
        "bytes": sum(p.stat().st_size for p in files.values()),
        "home_page": HOME_PAGE,
        "added_here": [INDEX_HTML],
        "files": {
            rel: {"bytes": p.stat().st_size, "sha256": sha256(p)}
            for rel, p in files.items()
        },
    }


def load(manifest: Path = MANIFEST) -> dict:
    return json.loads(manifest.read_text(encoding="utf-8"))


def save(data: dict, manifest: Path = MANIFEST) -> None:
    manifest.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def check(shell: Path = SHELL, manifest: Path = MANIFEST, dev: bool = False) -> list[str]:
    """Every way `shell/` can disagree with its record, as sentences.

    Returns an empty list when the tree on disk is exactly the tree the import
    wrote. Every sentence is addressed to a human and names the one command
    that fixes it, because the only correct response to any of them is to
    re-import: `shell/` is never edited by hand.

    `dev=True` allows the two paths [`DEV_ONLY`] names and **nothing else**:
    a dev book is extra, never missing and never edited, so the two checks it
    relaxes are the "not named by the manifest" list and the `NEVER` refusal.
    Every other sentence -- a file the manifest names and is gone, a file that
    was edited since it was imported, a missing home page -- is asked in both
    modes, because none of them is made true or false by a book being there.
    """
    fix = "run `python3 tools/import_shell.py --ttstv <path to TTSTV>`"
    if not manifest.exists():
        return [f"no {manifest.name}: the shell has never been imported into this repo -- {fix}"]
    if not shell.is_dir():
        return [f"no shell/ directory -- {fix}"]

    want = load(manifest)
    have = walk(shell)
    out: list[str] = []

    missing = sorted(set(want["files"]) - set(have))
    extra = sorted(rel for rel in set(have) - set(want["files"])
                   if not (dev and is_dev_only(rel)))
    if missing:
        out.append(f"{len(missing)} file(s) named by the manifest are not in shell/: {missing[:6]} -- {fix}")
    if extra:
        out.append(f"{len(extra)} file(s) in shell/ that the manifest does not name: {extra[:6]} -- {fix}")

    for rel in sorted(set(want["files"]) & set(have)):
        rec = want["files"][rel]
        p = have[rel]
        if p.stat().st_size != rec["bytes"] or sha256(p) != rec["sha256"]:
            out.append(f"shell/{rel} has been edited since it was imported -- shell/ is never edited by hand; {fix}")

    home = want.get("home_page", HOME_PAGE)
    if not (shell / home).is_file():
        out.append(f"shell/{home} is missing -- Frank's window opens on it and would paint a 404; {fix}")

    for rel in have:
        if Path(rel).name in NEVER and not (dev and is_dev_only(rel)):
            out.append(
                f"shell/{rel} must never ship: no book, in any form, enters the phone's shell"
                + ("" if dev else " (a DEV run may have one under shell/books/: "
                                 "`python3 tools/prebuild.py --dev`)")
            )

    return out
