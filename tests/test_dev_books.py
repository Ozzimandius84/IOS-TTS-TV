"""The dev shelf: a Library the simulator can actually show, and the two
guards that still keep a book out of a shipped app.

`shell/books/` is gitignored -- *a book is not part of the app* -- and nothing
here changes that. What these tests hold in place is the seam added on 6 Sep:

* `tools/dev_books.py` copies books in and writes the inventory beside them;
* `prebuild.py --dev` (`beforeDevCommand`) allows exactly those two paths;
* `prebuild.py` (`beforeBuildCommand`) still refuses them, so a build carrying
  somebody's library cannot compile;
* `import_shell.py` carries them across a re-import, and the manifest -- the
  record of what TTSTV produced -- never names one.

Nothing here needs cargo, a phone, a network, or TTSTV on the disk.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "tools"))

import dev_books  # noqa: E402
import import_shell  # noqa: E402
import prebuild  # noqa: E402
from shell_manifest import (  # noqa: E402
    DEV_ONLY, HOME_PAGE, INDEX, INDEX_HTML, MANIFEST, NEVER,
    check, describe, is_dev_only, save,
)


# ---------------------------------------------------------------- a fixture shell

def _shell(tmp_path: Path) -> tuple[Path, Path]:
    """A three-file shell and its manifest, in a temp tree. Small on purpose:
    every assertion below is about which EXTRA paths are tolerated, and that
    question does not get truer with fifty files."""
    out = tmp_path / "shell"
    (out / "library").mkdir(parents=True)
    (out / "reader").mkdir(parents=True)
    (out / "library" / "library.html").write_text("<!doctype html>shelf", encoding="utf-8")
    (out / "reader" / "reader.html").write_text("<!doctype html>read", encoding="utf-8")
    (out / INDEX_HTML).write_text(INDEX, encoding="utf-8")
    man = tmp_path / "shell.manifest.json"
    save(describe(out), man)
    return out, man


def _put_dev_shelf(out: Path) -> None:
    (out / "books" / "euthyphro" / "chapters").mkdir(parents=True)
    (out / "books" / "euthyphro" / "book.json").write_text("{}", encoding="utf-8")
    (out / "books" / "euthyphro" / "book-data.js").write_text("//", encoding="utf-8")
    (out / "books" / "euthyphro" / "chapters" / "c001.txt").write_text("a", encoding="utf-8")
    (out / "library" / "library.json").write_text("[]", encoding="utf-8")


# ---------------------------------------------------------------- the two modes

def test_a_clean_shell_passes_both_modes(tmp_path):
    out, man = _shell(tmp_path)
    assert check(out, man) == []
    assert check(out, man, dev=True) == []


def test_a_dev_run_allows_the_shelf_and_a_build_refuses_it(tmp_path):
    out, man = _shell(tmp_path)
    _put_dev_shelf(out)

    assert check(out, man, dev=True) == [], "beforeDevCommand refused the dev shelf"

    problems = check(out, man)
    assert problems, "a build accepted a shell carrying a book"
    # And it refuses it for the right reason, naming the file, not merely
    # counting: `book.json` and `book-data.js` are the two NEVER names.
    joined = " ".join(problems)
    assert "book.json" in joined and "book-data.js" in joined, problems


def test_dev_relaxes_only_those_two_paths(tmp_path):
    """The relaxation is a list, not a mood. A stray file that is neither a
    book nor the inventory still stops a dev run."""
    out, man = _shell(tmp_path)
    _put_dev_shelf(out)
    (out / "library" / "notes.txt").write_text("hand-edited", encoding="utf-8")
    problems = check(out, man, dev=True)
    assert any("notes.txt" in p for p in problems), problems


def test_dev_never_excuses_a_missing_or_edited_shell_file(tmp_path):
    """`dev=True` relaxes the "not named by the manifest" list and the `NEVER`
    refusal. It does not make a hand-edited shell acceptable -- which is the
    whole reason `prebuild.py` exists."""
    out, man = _shell(tmp_path)
    _put_dev_shelf(out)
    (out / "reader" / "reader.html").write_text("<!doctype html>EDITED BY HAND", encoding="utf-8")
    assert any("reader/reader.html" in p for p in check(out, man, dev=True))

    (out / "reader" / "reader.html").unlink()
    assert any("reader/reader.html" in p for p in check(out, man, dev=True))


def test_is_dev_only_is_the_whole_list(tmp_path):
    assert DEV_ONLY == ("books/", "library/library.json")
    assert is_dev_only("books/euthyphro/book.json")
    assert is_dev_only("library/library.json")
    assert not is_dev_only("library/library.html")
    assert not is_dev_only("reader/book.json")


def test_prebuild_passes_its_flag_through(monkeypatch, capsys):
    """The flag is the only difference between the two before-commands, so the
    wiring from `--dev` to `check(dev=...)` is worth one test of its own."""
    seen = {}

    def fake_check(dev=False):
        seen["dev"] = dev
        return ["stop"]

    monkeypatch.setattr(prebuild, "check", fake_check)
    assert prebuild.main([]) == 1 and seen["dev"] is False
    assert prebuild.main(["--dev"]) == 1 and seen["dev"] is True


# ---------------------------------------------------------------- the inventory

INDEX_JSON = [
    {"slug": "hamlet", "title": "Hamlet", "author": "", "lang": "en", "chapters": 24},
    {"slug": "euthyphro", "title": "Euthyphro", "author": "Plato", "lang": "en", "chapters": 2},
    {"slug": "ethics", "title": "The Ethics", "author": "Spinoza", "lang": "en", "chapters": 7},
]


def test_rows_are_the_index_rows_in_the_order_asked_for():
    rows, missing = dev_books.rows_for(INDEX_JSON, ["euthyphro", "hamlet"])
    assert [r["slug"] for r in rows] == ["euthyphro", "hamlet"]
    assert missing == []
    assert rows[0]["title"] == "Euthyphro" and rows[0]["chapters"] == 2


def test_every_row_under_claims_audio_and_timings():
    """A tile that says **audio** is a promise this shelf has never been proved
    to keep. Both false, whatever is on disk."""
    rows, _ = dev_books.rows_for(INDEX_JSON, ["hamlet", "ethics"])
    assert all(r["has_audio"] is False and r["has_timings"] is False for r in rows)


def test_a_slug_the_index_does_not_know_is_not_invented():
    rows, missing = dev_books.rows_for(INDEX_JSON, ["euthyphro", "no-such-book"])
    assert [r["slug"] for r in rows] == ["euthyphro"]
    assert missing == ["no-such-book"]


def test_the_default_shelf_is_the_six_osca_named():
    assert dev_books.DEFAULT_SLUGS == (
        "euthyphro", "eclogues-virgil", "self-isolation-poems",
        "singapore-story-c1", "ethics", "hamlet",
    )


# ---------------------------------------------------------------- across a re-import

def test_the_shelf_survives_a_re_import_and_the_manifest_never_names_it(tmp_path):
    """`build_shell` clears the output directory, so before 6 Sep one
    re-import took the shelf with it and the simulator went back to SHELF - 0.
    `_hold` / `_restore` is that fix, and this is it without TTSTV: hold,
    clear, write a new shell, take the record, put the shelf back."""
    out, man = _shell(tmp_path)
    _put_dev_shelf(out)
    held_dir = tmp_path / "held"
    held_dir.mkdir()

    held = import_shell._hold(out, held_dir)
    assert sorted(held) == ["books/", "library/library.json"]
    assert not (out / "books").exists() and not (out / "library" / "library.json").exists()

    # ...the import's clear-and-rewrite, standing in for build_shell.
    import shutil
    shutil.rmtree(out)
    out2, man2 = _shell(tmp_path)

    data = describe(out2)            # the record, taken with only TTSTV's tree present
    import_shell._restore(held, held_dir, out2)

    assert (out2 / "books" / "euthyphro" / "book.json").is_file()
    assert (out2 / "library" / "library.json").is_file()
    assert not any(is_dev_only(rel) for rel in data["files"]), data["files"]
    assert not ({Path(p).name for p in data["files"]} & set(NEVER))

    save(data, man2)
    assert check(out2, man2, dev=True) == []


def test_the_import_does_not_let_a_held_file_shadow_a_real_one(tmp_path, capsys):
    """If the import wrote its own file at a held path, TTSTV's copy wins --
    `shell/` is TTSTV's tree, and a dev file shadowing a real one is the bug
    the hold exists to make impossible."""
    out, _ = _shell(tmp_path)
    (out / "library" / "library.json").write_text('["dev"]', encoding="utf-8")
    held_dir = tmp_path / "held2"
    held_dir.mkdir()
    held = import_shell._hold(out, held_dir)
    (out / "library" / "library.json").write_text('["ttstv"]', encoding="utf-8")
    import_shell._restore(held, held_dir, out)
    assert (out / "library" / "library.json").read_text(encoding="utf-8") == '["ttstv"]'
