"""Put real books under `shell/books/` so a dev run has a Library to show.

    python3 tools/dev_books.py --ttstv ~/Documents/RUNNERS/TTSTV/TTSTV [slug ...]

**Why this exists, and why it is not a relaxation of the rule.** `shell/books/`
is gitignored and `.gitignore` says why in one line: *a book is not part of the
app*. That stays true — nothing here commits a book, nothing here ships one, and
`tools/prebuild.py` without `--dev` still refuses to let a BUILD past with a
`book.json` anywhere under `shell/`. What was wrong was only the consequence:
with no books and no Studio to ask, `library.html` fetches `library.json`,
finds none, and paints **SHELF · 0** — a working page that reads as a broken
one, and the only thing a simulator could ever show.

So: books arrive here the way a person's books arrive on a phone — copied in,
never committed — and the two guards that keep them out of a shipped app are
left exactly as they were.

**What it writes, and nothing else:**

* `shell/books/<slug>/…` — the book folder from the TTSTV checkout, whole.
  `--no-audio` drops `audio/` and about half the bytes, for a laptop that is
  short of them; the default copies what is there, because a dev shelf that is
  missing exactly the files playback needs is a dev shelf that cannot be used to
  find a playback bug.
* `shell/library/library.json` — the inventory `library.html` reads when there
  is no Studio behind it (its own line: *"else (a bundle, a static host)
  library.json is the exported inventory"*, and it fetches it **relative to
  `library/`**). The rows are `<TTSTV>/books/index.json`'s own, filtered to the
  slugs asked for, with `has_audio` and `has_timings` added because the page's
  tile line reads them and `index.json` does not carry them. **Both are
  `false`**, which is a deliberate under-claim: a tile that says **audio** is a
  promise this shelf has never been proved to keep, and a shelf that is quiet
  about what it has is better than one that is wrong about it. The files are
  there either way; the row is what the tile draws.

Both are removed by nothing and preserved by `tools/import_shell.py` across a
re-import, which is the other half of this change: before it, one re-import
took the dev shelf away again.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_shell import clear_tree  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
SHELL = REPO / "shell"
BOOKS = SHELL / "books"
LIBRARY_JSON = SHELL / "library" / "library.json"

#: Six books that between them exercise what the shelf has to draw: two
#: languages, a one-chapter piece and a 300-chapter one, a play with speakers,
#: and a scan. Small on purpose -- this is a dev shelf, not a corpus.
DEFAULT_SLUGS = (
    "euthyphro",
    "eclogues-virgil",
    "self-isolation-poems",
    "singapore-story-c1",
    "ethics",
    "hamlet",
)

#: Dropped by `--no-audio`, and by nothing else. See the module docstring.
HEAVY = ("audio",)


def rows_for(index: list, slugs: list) -> tuple[list, list]:
    """`index.json`'s rows for `slugs`, in the order asked for, plus the two
    fields the page's tile line wants and the index does not carry.

    Returns (rows, missing). A slug the index does not know is NOT invented:
    it comes back in `missing` and the caller says so."""
    by_slug = {r.get("slug"): r for r in index if isinstance(r, dict)}
    rows, missing = [], []
    for slug in slugs:
        r = by_slug.get(slug)
        if r is None:
            missing.append(slug)
            continue
        # Both false on purpose, whatever is on disk: the tile line turns
        # has_audio into a bold "audio", and this shelf has never been proved
        # to play anything. An under-claim is a row a person can trust.
        rows.append({**r, "has_audio": False, "has_timings": False})
    return rows, missing


def copy_book(src: Path, dst: Path, audio: bool) -> tuple[int, int]:
    """One book folder, into place. Returns (files, bytes)."""
    if dst.exists():
        # A rename, not a delete, wherever a delete is refused -- see
        # `import_shell.clear_tree`. A re-copy of a book is the same case as a
        # re-import of the shell: the old tree is about to be replaced whole.
        clear_tree(dst)
    ignore = None if audio else shutil.ignore_patterns(*HEAVY)
    shutil.copytree(src, dst, ignore=ignore)
    files = [p for p in dst.rglob("*") if p.is_file()]
    return len(files), sum(p.stat().st_size for p in files)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--ttstv", type=Path, required=True, help="path to the TTSTV checkout")
    ap.add_argument("slugs", nargs="*", default=None,
                    help=f"books to copy; default: {' '.join(DEFAULT_SLUGS)}")
    ap.add_argument("--no-audio", dest="audio", action="store_false", default=True,
                    help="drop audio/ (about half the bytes); the default copies the folder whole")
    ap.add_argument("--clear", action="store_true", help="remove shell/books/ and library.json, write nothing")
    a = ap.parse_args(argv)

    if a.clear:
        for p in (BOOKS, LIBRARY_JSON):
            if p.is_dir():
                clear_tree(p)
            elif p.is_file():
                try:
                    p.unlink()
                except OSError:
                    dest = REPO / "_to_delete"
                    dest.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(p), str(dest / f"{p.name}.{int(time.time())}"))
        print("dev_books: shell/books/ and shell/library/library.json removed")
        return 0

    ttstv = a.ttstv.expanduser().resolve()
    index_path = ttstv / "books" / "index.json"
    if not index_path.is_file():
        print(f"no {index_path} -- is {ttstv} a TTSTV checkout?", file=sys.stderr)
        return 1
    if not (SHELL / "library").is_dir():
        print("no shell/library/ -- import the shell first:\n"
              f"  python3 tools/import_shell.py --ttstv {ttstv}", file=sys.stderr)
        return 1

    slugs = list(a.slugs) or list(DEFAULT_SLUGS)
    index = json.loads(index_path.read_text(encoding="utf-8"))
    rows, missing = rows_for(index, slugs)
    if missing:
        print(f"dev_books: not in {index_path.name}, skipped: {', '.join(missing)}", file=sys.stderr)

    BOOKS.mkdir(parents=True, exist_ok=True)
    total_files = total_bytes = 0
    kept = []
    for row in rows:
        slug = row["slug"]
        src = ttstv / "books" / slug
        if not (src / "book.json").is_file():
            print(f"dev_books: {src} has no book.json, skipped", file=sys.stderr)
            continue
        n, b = copy_book(src, BOOKS / slug, a.audio)
        total_files += n
        total_bytes += b
        kept.append(row)
        print(f"  {slug:<26} {n:>4} files  {b / 1e6:>6.1f} MB")

    LIBRARY_JSON.write_text(json.dumps(kept, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"dev_books: {len(kept)} rows -> {LIBRARY_JSON.relative_to(REPO)}; "
          f"{total_files} files, {total_bytes / 1e6:.1f} MB under shell/books/"
          f"{'' if a.audio else ' (audio/ dropped by --no-audio)'}")
    if not kept:
        print("dev_books: nothing was copied, so the shelf will still read SHELF - 0", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
