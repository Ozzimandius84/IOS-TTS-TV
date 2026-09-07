"""prebuild.py -- prove `shell/` is the tree the import wrote, and the app icon is Frank.

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

**THE SECOND CHECK: THE APP ICON (7 Sep).** For weeks the phone built with
`tauri ios init`'s yellow-and-cyan placeholder in
`src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/`, and nothing anywhere
said so -- because `src-tauri/icons/` beside it held the correct Frank mark, and
that is the folder a person checks. The catalogue had no generator and no guard.
It has both now: `tools/gen_icons.py` writes it, and this refuses to build
without it. **That is the whole reason this paragraph exists** -- a mark nobody
generates is a mark nobody notices is wrong.

`gen_icons.icon_problems()` re-opens all eighteen files and asks three things:
is each one square at the size `Contents.json` names, is each RGB with no alpha
band (an icon carrying one is rejected at submission), and does any of them hold
a saturated non-red pixel. The last is the placeholder test and it cannot be
fooled either way round: Tauri's ring is yellow and cyan, and the only saturated
colour anywhere in the Frank mark is #c8102e. The placeholder scores 118,152 such
pixels at 1024; the mark scores 0.

**It reads those PNGs with the standard library and nothing else** -- no Pillow,
no rasteriser, no TTSTV checkout on the disk. A guard that skips itself when an
import fails is the shape of the bug it is here to catch, so it must run
everywhere `python3` does. Pillow is still needed to WRITE the icons; it is not
needed to check them.

Every failure prints the one command that fixes it and exits 1, which stops
`tauri build` before it compiles anything.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_icons import icon_problems  # noqa: E402
from shell_manifest import MANIFEST, SHELL, check, is_dev_only, load, walk  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dev", action="store_true",
                    help="a dev run: allow shell/books/** and shell/library/library.json")
    a = ap.parse_args(argv)

    # BOTH CHECKS RUN, ALWAYS, AND BOTH REPORT.  Returning on the first failure
    # would let a broken shell hide a broken icon -- which is the exact shape of
    # the bug the icon check exists for: something wrong that nothing said.
    failed = False

    problems = check(dev=a.dev)
    if problems:
        failed = True
        print("prebuild: the shell in this repo is not the shell that was imported.\n",
              file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print("", file=sys.stderr)

    icons = icon_problems()
    if icons:
        failed = True
        print("prebuild: the app icon catalogue is not the Frank mark.\n", file=sys.stderr)
        for i in icons:
            print(f"  - {i}", file=sys.stderr)
        print("\n  python3 tools/gen_icons.py --ttstv <path to TTSTV> --verify\n",
              file=sys.stderr)

    if failed:
        return 1

    d = load()
    src = d.get("source", {})
    print(f"prebuild: shell/ verified -- {d['count']} files, {d['bytes']} bytes, "
          f"imported from {src.get('commit', '?')} @ {src.get('shell_cache', '?')}")
    print(f"prebuild: app icon verified -- 18 files, the Frank mark, no placeholder")
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
