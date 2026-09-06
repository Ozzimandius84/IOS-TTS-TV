"""prebuild.py -- prove `shell/` is the tree the import wrote, and nothing else.

`src-tauri/tauri.conf.json`'s `beforeBuildCommand` and `beforeDevCommand` run
THIS and nothing else, on every platform. One word per config line, because
Tauri hands the command to `sh -c` on Unix and `cmd /S /C` on Windows and a
shell-grouped line is a syntax error on the second one.

    python3 tools/prebuild.py          # a BUILD: no book may be under shell/
    python3 tools/prebuild.py --dev    # a DEV run: shell/books/ is allowed

**The two are the same check with one difference, and the difference is the
point.** `beforeBuildCommand` runs the first: a build that shipped a book would
put somebody else's library inside the app binary, so a `book.json` anywhere
under `shell/` exits 1 and the compile never starts. `beforeDevCommand` runs
the second, because a dev run is the one place a book under `shell/` is not a
mistake -- it is `tools/dev_books.py`'s doing, it is gitignored, and without it
the simulator can only ever paint **SHELF - 0**. `--dev` allows exactly
`shell/books/**` and `shell/library/library.json` (`shell_manifest.DEV_ONLY`)
and relaxes nothing else: an edited or missing shell file still stops both.

**It writes nothing, and that is the difference from TTSTV's Frank.** There,
`Frank/dist/` was staged from the repo at build time, because the shell and the
app lived in one tree. Here the shell is COMMITTED -- it is `shell/`, imported
by `tools/import_shell.py` and carried in git -- so the phone app builds with
no TTSTV on the disk at all, which is the whole point of the repo having its
own folder. What a build must still not do is ship a shell that has been
hand-edited, half-imported, or is carrying a book. So the before-command is a
check, and it is a hard one: every file's size and sha256 against
`shell.manifest.json`, the home page on disk, and no `book.json` or
`book-data.js` anywhere under it.

Every failure prints the one command that fixes it and exits 1, which stops
`tauri build` before it compiles anything.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shell_manifest import MANIFEST, SHELL, check, is_dev_only, load, walk  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dev", action="store_true",
                    help="a dev run: allow shell/books/** and shell/library/library.json")
    a = ap.parse_args(argv)

    problems = check(dev=a.dev)
    if problems:
        print("prebuild: the shell in this repo is not the shell that was imported.\n", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    d = load()
    src = d.get("source", {})
    print(f"prebuild: shell/ verified -- {d['count']} files, {d['bytes']} bytes, "
          f"imported from {src.get('commit', '?')} @ {src.get('shell_cache', '?')}")
    if a.dev:
        # Say what the dev shelf is, every time. A run that shows no books is
        # the failure this whole change is about, and the line above cannot
        # tell it from a run that shows six -- the manifest does not name them.
        extra = [rel for rel in walk() if is_dev_only(rel)]
        slugs = sorted({rel.split("/")[1] for rel in extra if rel.startswith("books/") and "/" in rel[6:]})
        if slugs:
            print(f"prebuild: dev shelf -- {len(slugs)} book(s): {', '.join(slugs)}")
        else:
            print("prebuild: dev shelf EMPTY -- the Library will read SHELF - 0.\n"
                  "          python3 tools/dev_books.py --ttstv <path to TTSTV>", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
