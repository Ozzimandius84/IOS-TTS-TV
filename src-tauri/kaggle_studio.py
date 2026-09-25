"""
voice/remote/kaggle_studio.py -- `ttstv-studio`, the CPU kernel that is the
phone's Studio.

Pushed as the *whole* kernel (`kernel_type: script`, **GPU OFF**, internet on
for pip and nothing else). Deliberately thin and deliberately stable, for the
same reason `kaggle_render.py` is: the code that has to match the Mac travels
in the job dataset (`voice/remote/studio_pack.py`), so a phone-parsed book is
parsed by the repo's own `parser/`, not by a version frozen in a notebook.

WHY IT EXISTS. The parser is Python and there is ONE parser (F7). A phone has
no CPython, and rewriting `parser/` in Rust is the standing refusal
(`[[parsing-on-the-device]]`: not a port, a fork of the intelligence of the
product). So a phone-only person parses on a machine they own, with no deploy
step: their own Kaggle kernel, five HTTP verbs, no CLI.

WHAT IT DOES, in order:

 1. Finds `job.json` by walking the WHOLE `/kaggle/input` tree. This image
    nests attached datasets under `/kaggle/input/datasets/<owner>/<slug>/`,
    not the flat `/kaggle/input/<slug>` older docs describe, and the mount can
    still be settling when line one runs (both learned live on 28 Aug by the
    render kernel; this one inherits the lesson rather than paying for it).
 2. Rebuilds the tree from `studio-manifest.json` -- flat names back to
    `parser/…`, `core/…` -- into a writable working root, and puts that root
    on `sys.path`.
 3. Installs the parse pins with `cloud/endpoint.py::parse_pins`, which READS
    `parser/requirements.txt` rather than repeating it. ~102 MB installed,
    ~38 MB of wheels, and it is the floor under the cold start.
 4. Runs `parser.cli` through `cloud/endpoint.py::parse_argv` -- the same
    command spelling Modal's `/parse` uses and `studio/add.py` runs, slug read
    off the same `SLUG=` line -- then `attrib.cli`, as `add()` does.
 5. Computes the book's hash with `studio/sync.py`'s OWN `word_ids` and
    `hash_of`, carried in the job. **That is F7 ★**: the number the Mac would
    print for the same file, from the same code, not from a similar function.
 6. Writes `/kaggle/working/out/` -- `book.json`, the phone's payload
    (`book.meta.json`, `book-data.js`, `chapters/*.txt`) and `hash` -- and
    `done.json`, INCREMENTALLY, and exits **0** at its deadline.

IT IS A CPU KERNEL. No GPU, no `ttstv-zoo`, no engine install (K-D: two
slugs, `ttstv-studio` here and `ttstv-render` there -- different machines,
different installs, different quotas, and the account's two concurrent GPU
sessions never block a parse).

THE THREE BUDGETS, from `[[kernel-budgets]]`, on day one rather than after a
nine-hour runaway -- which is the whole lesson of
`[[the-render-kernel-has-no-deadline]]`, the kernel that never got any of them:

  * a per-item SIGALRM (a parse is one item, so this is the parse's ceiling);
  * a whole-kernel deadline, checked BEFORE an item starts, asking "does this
    item's own budget still fit?" and not "is there time left?";
  * a pack-time refusal -- `studio_pack.pack` will not build a job whose item
    budget does not fit inside its deadline.

Kaggle has no stop verb and a CANCELLED kernel saves no output at all, so a
kernel that exits 0 at its deadline with a partial `done.json` is the only
shape that loses nothing.

NOTHING HERE DECIDES A PIN, A COMMAND OR A SLUG. If this file needs editing to
make a parse work, the job is wrong.
"""
import json
import os
import signal
import subprocess
import sys
import time
import traceback
from pathlib import Path

INPUT_ROOT = Path("/kaggle/input")
WORKING = Path("/kaggle/working")
OUT = WORKING / "out"
DONE = WORKING / "done.json"
#: Where the flat job is rebuilt into a real tree. Under /kaggle/working
#: because /kaggle/input is read-only and `parser.cli` writes beside its code.
CODE = WORKING / "code"
BOOKS = WORKING / "books"

MANIFEST = "studio-manifest.json"
JOB = "job.json"

#: How long the mount is given to appear. The render kernel found this the
#: hard way: two runs died in under a second with "job.json not found" while
#: `datasets files` showed the upload had landed.
MOUNT_WAIT_S = 120
MOUNT_POLL_S = 3

T0 = time.time()


def say(*a):
    print(*a, flush=True)


def elapsed():
    return time.time() - T0


# ------------------------------------------------------------- the job

def find_job(root=None, wait_s=None):
    """The directory holding `job.json`, anywhere under `/kaggle/input`.

    Walked rather than named: the path is `/kaggle/input/datasets/<owner>/
    <slug>/` on this image and was `/kaggle/input/<slug>` on the last one, and
    a kernel that hard-codes either is a kernel that breaks on an image bump
    nobody announced.

    `root` and `wait_s` default to the module's own constants AT CALL TIME, not
    in the signature: a default is bound when `def` runs, so `root=INPUT_ROOT`
    would pin `/kaggle/input` into this function forever and no test could ever
    point it anywhere -- which is one of the two ways a kernel becomes a thing
    only Kaggle can run."""
    root = INPUT_ROOT if root is None else root
    wait_s = MOUNT_WAIT_S if wait_s is None else wait_s
    deadline = time.time() + wait_s
    while True:
        try:
            for p in Path(root).rglob(JOB):
                if p.is_file():
                    return p.parent
        except OSError:
            pass
        if time.time() >= deadline:
            return None
        time.sleep(MOUNT_POLL_S)


def rebuild(job_dir: Path, code=None) -> int:
    """Flat names back into a tree, from the manifest. Answers the file count.

    Copied, not symlinked: `/kaggle/input` is read-only and `parser.cli`
    writes `__pycache__` beside its own modules. The tree is small -- source
    files, not a 3.87 GB model zoo, which is the case symlinks exist for."""
    man = json.loads((job_dir / MANIFEST).read_text())
    code = Path(CODE if code is None else code)
    n = 0
    for row in man.get("files") or []:
        rel, flat = row.get("path"), row.get("flat")
        if not rel or not flat:
            continue
        src = job_dir / flat
        if not src.is_file():
            raise SystemExit(f"the job names {rel} as {flat}, which is not in the dataset")
        dst = code / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
        got = dst.stat().st_size
        if row.get("bytes") is not None and got != row["bytes"]:
            # Size, always; sha256 never. A truncated or missing file is the
            # real failure and `stat` catches it free.
            raise SystemExit(f"{rel} arrived {got} bytes, manifest says {row['bytes']}")
        n += 1
    return n


# ------------------------------------------------------------ the budget

class Budget:
    """The two halves that live in the kernel. The third -- the pack-time
    refusal -- is `studio_pack.pack`'s, because a job that cannot fit should
    never have been uploaded."""

    def __init__(self, item_s: int, deadline_s: int):
        self.item_s = max(1, int(item_s))
        self.ends_at = T0 + max(1, int(deadline_s))
        self.armed = False

    def fits(self) -> bool:
        """Does this item's OWN budget still fit before the deadline? The
        question is not "is there time left" -- then an item that starts can
        always finish or be abandoned inside the deadline, and the deadline is
        a promise rather than a hope."""
        return time.time() + self.item_s <= self.ends_at

    def __enter__(self):
        try:
            signal.signal(signal.SIGALRM, self._ring)
            signal.setitimer(signal.ITIMER_REAL, self.item_s)
            self.armed = True
        except (ValueError, AttributeError):
            # Not the main thread, or no SIGALRM. Say so in done.json rather
            # than claiming a budget that was never enforced.
            self.armed = False
        return self

    def __exit__(self, *exc):
        if self.armed:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, signal.SIG_DFL)
        return False

    @staticmethod
    def _ring(signum, frame):
        raise TimeoutError("the item's budget ran out")


# -------------------------------------------------------------- the work

def pip_install(code: Path) -> list:
    """The pins `cloud/endpoint.py::parse_pins` reads out of
    `parser/requirements.txt`, installed. Answers the list, for the record."""
    sys.path.insert(0, str(code))
    from cloud.endpoint import parse_pins           # noqa: E402 -- after sys.path
    pins = parse_pins(code / "parser" / "requirements.txt")
    if pins:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *pins],
                       check=True)
    return pins


def do_parse(code: Path, job: dict, job_dir: Path) -> dict:
    """One parse, and the hash that proves it. Everything here is somebody
    else's function called by its own name."""
    from cloud.endpoint import parse_argv, slug_from   # noqa: E402

    # THE DATA HOME IS SAID ONCE, IN THE ENVIRONMENT. `core/paths.py` resolves
    # `TTSTV_DATA_HOME` -> `DATA_HOME` -> `books/`, and `attrib.cli` takes a
    # slug and reads `paths.BOOKS` for itself -- it has no `--books` flag. So
    # the two children are given the same home rather than one being handed a
    # path and the other guessing, and with no env set at all `paths` falls
    # back to RUNNER and would write `books/`, `cache/`, `out/`, `scratch/`
    # into the code tree (the trap CLAUDE.md names for any session that starts
    # a server).
    env = dict(os.environ, TTSTV_DATA_HOME=str(WORKING),
               TTS_DATA=str(WORKING / "depot"), PYTHONPATH=str(code))

    src = job_dir / job["source"]
    # The source keeps its real name: `parser.cli` reads the suffix to choose
    # a reader, and a flat name has none.
    staged = WORKING / "source" / (job.get("source_name") or src.name)
    staged.parent.mkdir(parents=True, exist_ok=True)
    staged.write_bytes(src.read_bytes())

    BOOKS.mkdir(parents=True, exist_ok=True)
    argv = parse_argv(staged, BOOKS, lang=job.get("lang"), slug=job.get("slug"),
                      max_chapters=job.get("max_chapters"), python=sys.executable)
    say("ARGV", " ".join(argv))
    proc = subprocess.run(argv, cwd=str(code), capture_output=True, text=True, env=env)
    if proc.returncode != 0:
        return {"ok": False, "stage": "parse", "why": (proc.stderr or proc.stdout)[-4000:]}
    slug = slug_from(proc.stdout)
    if not slug:
        return {"ok": False, "stage": "parse",
                "why": "parser.cli printed no SLUG= line"}

    # `studio/add.py` runs attrib.cli after parser.cli and the book is not a
    # book without names.json. A failure here is NOT a failed parse: the book
    # exists, and the report says the names are missing.
    names = subprocess.run([sys.executable, "-m", "attrib.cli", slug, "--no-page"],
                           cwd=str(code), capture_output=True, text=True, env=env)

    book_path = BOOKS / slug / "book.json"
    book = json.loads(book_path.read_text())

    # F7 ★ -- the Mac's own two functions, carried in the job.
    from studio.sync import word_ids, hash_of        # noqa: E402
    ids = word_ids(book)
    book_hash = hash_of(ids) if ids else None

    OUT.mkdir(parents=True, exist_ok=True)
    kept = []
    for p in sorted((BOOKS / slug).rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(BOOKS / slug).as_posix()
        dst = OUT / slug / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(p.read_bytes())
        kept.append({"rel": rel, "bytes": p.stat().st_size})
    (OUT / "hash").write_text((book_hash or "") + "\n")

    return {"ok": True, "stage": "parse", "slug": slug, "hash": book_hash,
            "words": len(ids), "files": kept,
            "chapters": len(book.get("chapters") or []),
            "names_ok": names.returncode == 0,
            "names_why": None if names.returncode == 0 else (names.stderr or "")[-1000:]}


def write_done(data: dict) -> None:
    """Incrementally, every time anything is known. A kernel that is killed
    between two writes still leaves the earlier one."""
    WORKING.mkdir(parents=True, exist_ok=True)
    tmp = DONE.with_name(DONE.name + ".tmp")
    tmp.write_text(json.dumps(data, indent=1) + "\n")
    os.replace(tmp, DONE)


def main() -> int:
    done = {"kernel": "ttstv-studio", "started": T0, "ok": False,
            "stage": "start", "elapsed": 0.0}
    write_done(done)

    job_dir = find_job()
    if job_dir is None:
        done.update(stage="mount", why=f"no {JOB} under {INPUT_ROOT} in {MOUNT_WAIT_S}s",
                    elapsed=elapsed())
        write_done(done)
        return 0                       # exit 0: a failed exit is output Kaggle marks failed
    job = json.loads((job_dir / JOB).read_text())
    done.update(verb=job.get("verb"), stage="rebuild")
    write_done(done)

    b = job.get("budget") or {}
    budget = Budget(b.get("item_s", 1800), b.get("deadline_s", 3600))

    try:
        n = rebuild(job_dir)
        say(f"rebuilt {n} files into {CODE} at {elapsed():.1f}s")
        done.update(stage="pip", files=n, elapsed=elapsed())
        write_done(done)

        pins = pip_install(CODE)
        say(f"installed {len(pins)} pins at {elapsed():.1f}s")
        done.update(stage="ready", pins=pins, pip_done=elapsed())
        write_done(done)

        if job.get("verb") != "parse":
            done.update(stage="verb", why=f"this kernel does {', '.join(['parse'])}, "
                                          f"not {job.get('verb')!r}", elapsed=elapsed())
            write_done(done)
            return 0
        if not budget.fits():
            done.update(stage="deadline", why="the parse's own budget no longer fits "
                                              "before the kernel's deadline",
                        unattempted=["parse"], elapsed=elapsed())
            write_done(done)
            return 0

        with budget:
            got = do_parse(CODE, job, job_dir)
        done.update(got)
        done.update(budget={"item_s": budget.item_s, "armed": budget.armed},
                    elapsed=elapsed())
    except TimeoutError as e:
        done.update(ok=False, stage="timeout", why=str(e),
                    budget={"item_s": budget.item_s, "armed": budget.armed},
                    elapsed=elapsed())
    except SystemExit as e:
        done.update(ok=False, stage=done.get("stage"), why=str(e), elapsed=elapsed())
    except Exception:                            # noqa: BLE001 -- a done.json, never a traceback alone
        done.update(ok=False, stage=done.get("stage"),
                    why=traceback.format_exc()[-4000:], elapsed=elapsed())
    write_done(done)
    say("DONE", json.dumps({k: v for k, v in done.items() if k != "files"}))
    return 0                                     # always 0; see the head


if __name__ == "__main__":
    sys.exit(main())
