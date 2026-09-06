"""THE ONE COMMAND. Re-import the app shell from TTSTV into `shell/`.

    python3 tools/import_shell.py --ttstv ~/Documents/RUNNERS/TTSTV/TTSTV

`shell/` is never edited by hand and nothing is ever hand-copied into it. It is
written, whole, by TTSTV's `reader/tools/publish_shell.py::build_shell`, whose
list is `reader/sw.js`'s own `SHELL_FILES` -- the route Osca named on 5 Sep is
`design/reader/` -> (job 15) -> `reader/` -> `publish_shell.py` -> here, and
this file is the last arrow. It restates no part of that list: it imports the
copier and calls it.

Three things it does that `publish_shell.py --out` alone does not, each of them
this repo's business and not the reader's:

1. `--no-bump` by DEFAULT. `publish_shell.py` bumps `reader/sw.js`'s
   `SHELL_CACHE` version on every run, because a published PWA that does not
   bump keeps serving the old files forever. That is the phone SHELL's publish,
   which is held at v33 until the tree is quiet -- and it is a WRITE into
   TTSTV. Re-importing into this repo is not a publish, so it does not write
   into the other repo at all. `--bump` is there for the day the two happen
   together, and it is the only thing here that touches TTSTV.
2. It writes `index.html`, the bundle's root. `frontendDist` needs one; the
   PWA does not have one (its manifest launches `library/library.html`
   directly). A redirect, never a copy of that page -- a copy would resolve
   `../reader/...` from the wrong depth.
3. It writes `shell.manifest.json`, so every later build can check this tree
   without TTSTV on the disk at all. See `tools/shell_manifest.py`.
4. **It carries the dev shelf across.** `build_shell` clears the output
   directory, so before 6 Sep one re-import took `shell/books/` and
   `shell/library/library.json` with it and the simulator went back to
   **SHELF - 0**. They are moved aside, the import runs exactly as it did, and
   they are moved back -- **after** the manifest is written, so the record still
   names only what TTSTV produced plus `index.html`. A book is not part of the
   app, and the manifest is the file that says so.

It refuses to write anything if TTSTV cannot produce the whole shell. That is
not a nicety: `publish_shell.py::build_shell` clears the output directory
before it copies, so a half-import would leave the phone repo with a broken
shell and no way back to the old one.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shell_manifest import DEV_ONLY, INDEX, INDEX_HTML, MANIFEST, SHELL, describe, save  # noqa: E402


def _ttstv(path: Path) -> Path:
    root = path.expanduser().resolve()
    sw = root / "reader" / "sw.js"
    if not sw.is_file():
        raise SystemExit(
            f"{root} is not a TTSTV checkout: no reader/sw.js, which is the shell's "
            f"authoritative list and the only thing this import reads it from"
        )
    return root


def _head(root: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except Exception:
        return "unknown"


def _cache_version(root: Path) -> str:
    import re
    m = re.search(r'const SHELL_CACHE = "([^"]+)"', (root / "reader" / "sw.js").read_text())
    return m.group(1) if m else "unknown"


def clear_tree(out: Path) -> str:
    """Empty `out`, and say how.

    `build_shell` clears its own output directory, and on a Mac so does this.
    Through the Cowork bridge it cannot: every `unlink` inside the repo comes
    back `Operation not permitted`, including on files the same shell wrote a
    second earlier, so a re-import from a Cowork session used to die here with
    `shell/` half-held and no way back. A RENAME needs no delete, and
    `_to_delete/` is this repo's named place for what a session could not
    remove -- `.gitignore` says so, and Osca empties it.

    Public because `tools/dev_books.py` replaces a book folder the same way
    and for the same reason.

    Nothing is lost either way: the delete is refused on the FIRST file, so a
    refused `rmtree` has removed nothing, and what moves aside is a tree the
    import is about to rewrite from TTSTV in full."""
    if not out.exists():
        return "nothing to clear"
    try:
        shutil.rmtree(out)
        return "removed"
    except OSError as e:
        dest = out.parent / "_to_delete" / f"{out.name}.{int(time.time())}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(out), str(dest))
        return f"could not delete ({e.strerror or e}); moved to {dest.parent.name}/{dest.name}"


def _hold(out: Path, tmp: Path) -> list:
    """Move the dev shelf out of `out` and into `tmp`. Returns what was moved,
    by its site path, so `_restore` puts each back exactly where it was."""
    held = []
    for rel in DEV_ONLY:
        src = out / rel.rstrip("/")
        if not src.exists():
            continue
        dst = tmp / rel.rstrip("/").replace("/", "__")
        shutil.move(str(src), str(dst))
        held.append(rel)
    return held


def _restore(held: list, tmp: Path, out: Path) -> None:
    """...and back. A path whose parent the import did not recreate gets one --
    `library/` always comes back, but this does not depend on it."""
    for rel in held:
        dst = out / rel.rstrip("/")
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists():
            # The import produced something at this path itself. TTSTV's copy
            # wins and the held one is dropped: `shell/` is TTSTV's tree, and a
            # dev file shadowing a real one is the bug this whole file exists
            # to make impossible.
            print(f"NOT restored: the import wrote its own {rel}", file=sys.stderr)
            continue
        shutil.move(str(tmp / rel.rstrip("/").replace("/", "__")), str(dst))


def import_shell(ttstv: Path, out: Path = SHELL, bump: bool = False) -> dict:
    root = _ttstv(ttstv)
    sys.path.insert(0, str(root))
    sys.path.insert(0, str(root / "reader" / "tools"))
    import publish_shell as ps                      # noqa: E402
    from shell_files import SW_SELF, shell_files    # noqa: E402

    # Re-read the list off the working `sw.js` rather than trusting the
    # constant `publish_shell` computed at import time -- the same two lines,
    # and the same reason, as TTSTV's own `Frank/tools/prebuild.py`. The
    # duplication is of the GUARD, not of the list.
    ps.SHELL_FILES = shell_files() + [SW_SELF]

    # Every name, before a single byte moves. `build_shell` does this too, but
    # it does it AFTER clearing the output directory, and clearing this repo's
    # shell on the strength of a TTSTV tree that cannot fill it again is the
    # one outcome worth an extra ten lines.
    missing = [rel for rel in ps.SHELL_FILES if not (root / rel).is_file()]
    if missing:
        raise SystemExit(
            "TTSTV cannot produce the shell yet -- reader/sw.js names "
            f"{len(ps.SHELL_FILES)} files and {len(missing)} of them are not on disk:\n  "
            + "\n  ".join(missing)
            + "\n\nNothing was written here; shell/ is untouched. This is a TTSTV state, "
              "not a fault in this repo."
        )

    if bump:
        print("bumped TTSTV reader/sw.js SHELL_CACHE ->", ps.bump_shell_cache_version(root / "reader" / "sw.js"))
        ps.SHELL_FILES = shell_files() + [SW_SELF]

    out = out.resolve()
    # The dev shelf, out of the way of `build_shell`'s clear and back afterwards.
    # A temp directory OUTSIDE `out` -- moving it under `out` would put it back
    # in the path of the very rmtree it is being saved from -- and INSIDE the
    # repo, beside `shell/`, which is not a surprise but the only place the
    # move is a rename. `/tmp` is a different filesystem from a bridged
    # checkout, so `shutil.move` there is a copy-then-unlink and the unlink is
    # the thing this repo cannot do (`clear_tree`); it also puts a dev shelf on
    # a 10 GB VM disk that CLAUDE.md says to keep the tree off.
    tmp = out.parent / f".devshelf-{int(time.time())}"
    tmp.mkdir(parents=True)
    try:
        held = _hold(out, tmp)
        if held:
            print(f"holding the dev shelf: {', '.join(held)}")
        print("clearing shell/:", clear_tree(out))
        ps.build_shell(out_dir=out, repo_root=root)
        (out / INDEX_HTML).write_text(INDEX, encoding="utf-8")

        # The manifest is taken HERE, with the shell exactly as TTSTV produced
        # it and nothing else in the tree. Restoring first would put every dev
        # book into the record, and `prebuild.py` would then require them to be
        # present on a machine that has never run `dev_books.py`.
        data = describe(out)
        _restore(held, tmp, out)
    finally:
        if tmp.exists():
            clear_tree(tmp)
    data["source"] = {
        "repo": str(root),
        "commit": _head(root),
        "shell_cache": _cache_version(root),
    }
    save(data)
    return data


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--ttstv", type=Path, required=True, help="path to the TTSTV checkout")
    ap.add_argument("--out", type=Path, default=SHELL)
    ap.add_argument("--bump", action="store_true",
                    help="also bump TTSTV's reader/sw.js SHELL_CACHE (a PWA publish; off by default)")
    a = ap.parse_args(argv)
    d = import_shell(a.ttstv, a.out, a.bump)
    print(f"shell imported: {a.out} -- {d['count']} files, {d['bytes']} bytes "
          f"({d['bytes']/1024:.1f} KB), from {d['source']['commit']} @ {d['source']['shell_cache']}")
    print(f"manifest: {MANIFEST.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
