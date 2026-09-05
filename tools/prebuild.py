"""prebuild.py -- prove `shell/` is the tree the import wrote, and nothing else.

`src-tauri/tauri.conf.json`'s `beforeBuildCommand` and `beforeDevCommand` run
THIS and nothing else, on every platform. One word per config line, because
Tauri hands the command to `sh -c` on Unix and `cmd /S /C` on Windows and a
shell-grouped line is a syntax error on the second one.

    python3 tools/prebuild.py

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

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shell_manifest import MANIFEST, SHELL, check, load  # noqa: E402


def main() -> int:
    problems = check()
    if problems:
        print("prebuild: the shell in this repo is not the shell that was imported.\n", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    d = load()
    src = d.get("source", {})
    print(f"prebuild: shell/ verified -- {d['count']} files, {d['bytes']} bytes, "
          f"imported from {src.get('commit', '?')} @ {src.get('shell_cache', '?')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
