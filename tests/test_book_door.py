"""The book door: where a book a Sync pulls is kept on the phone (G-PULL).

Osca, 11 Sep: Frank on the real iPhone read Drive's `library.json` (26 rows),
said `Pulling 1 of 26 · Les Pensées · 0/31`, and failed on the first byte of
the first file, every press. The shell kept books in the Cache API, and
`Cache.put` refuses a URL that is not http(s) -- WebKit's words, `Request url
is not HTTP/HTTPS` -- while this app's origin is `frank://localhost`. Nor
would a Cache have been read: no service worker runs on a custom scheme, and
`frank://localhost/books/...` is answered by lib.rs's own handler, off disk.

So `src-tauri/src/lib.rs` has four commands -- `book_put` (the bytes as the
RAW IPC body, the names as headers), `book_meta` (the row, LAST: the
commit), `book_list`, `book_remove` -- a door, `TTSTVHost.books`, injected as
`BOOKS_JS`, and `route()` serving `/books/<slug>/<rel>` from
`<app data>/books/`. TTSTV's `library/import.js` hands its store's four verbs
to that door when the host offers one.

What is proved HERE, for `test_google_link.py`'s reason (no cargo from a
Cowork session): the things that are FILES -- the four commands declared,
granted, handled and injected -- and the door itself, run under node with a
stand-in `__TAURI__` that records every call. The Rust half (the path rules,
the commit, the swap) is `lib.rs`'s own `mod book_tests`: `cargo test`.

run: python3 -m pytest tests -q
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
LIB_RS = REPO / "src-tauri" / "src" / "lib.rs"
BUILD_RS = REPO / "src-tauri" / "build.rs"
CAPABILITY = REPO / "src-tauri" / "capabilities" / "default.json"
IMPORT_JS = REPO / "shell" / "library" / "import.js"
CONTEXT_JS = REPO / "shell" / "reader" / "context.js"
NODE = shutil.which("node")

COMMANDS = ["book_put", "book_meta", "book_list", "book_remove"]


def _books_js() -> str:
    m = re.search(r'pub const BOOKS_JS: &str = r#"(.*?)"#;', LIB_RS.read_text("utf-8"), re.S)
    assert m, "lib.rs has no BOOKS_JS"
    return m.group(1)


def test_the_four_commands_are_declared_granted_handled_and_injected():
    lib = LIB_RS.read_text("utf-8")
    handler = re.search(r"generate_handler!\[(.*?)\]", lib, re.S).group(1)
    manifest = re.search(r"\.commands\(&\[(.*?)\]\)", BUILD_RS.read_text("utf-8"), re.S).group(1)
    granted = json.loads(CAPABILITY.read_text("utf-8"))["permissions"]
    for cmd in COMMANDS:
        assert re.search(rf"\b{cmd}\b", handler), f"generate_handler! does not handle {cmd}"
        assert f'"{cmd}"' in manifest, f"build.rs does not declare {cmd}"
        assert "allow-" + cmd.replace("_", "-") in granted, f"the capability does not grant {cmd}"
        assert re.search(rf"#\[tauri::command\]\nfn {cmd}<R: tauri::Runtime>\(", lib), f"{cmd} is not a command"
    # the door is its own script, after HOST_JS, before any page script
    assert lib.index(".initialization_script(HOST_JS)") < lib.index(".initialization_script(BOOKS_JS)")
    # and nothing else was granted on the way
    assert not [p for p in granted if p.startswith(("fs:", "opener:", "deep-link:"))], granted


def test_the_books_live_beside_the_shell_and_never_in_it():
    """`unpack_shell` clears SHELL_DIR on every update; a book must outlive
    every update, so its folder is a sibling under the app data dir."""
    lib = LIB_RS.read_text("utf-8")
    assert 'const BOOKS_DIR: &str = "books";' in lib and 'const SHELL_DIR: &str = "shell";' in lib
    body = re.search(r"fn books_root<R: tauri::Runtime>\(.*?\n\}", lib, re.S).group(0)
    assert ".app_data_dir()" in body and ".join(BOOKS_DIR)" in body and "SHELL_DIR" not in body
    # the handler answers a book from there, and the dev shelf second
    assert "let disk = route(&root, &books, &path);" in lib
    assert ".filter(|_| path.starts_with(BOOKS_PREFIX))" in lib


def test_put_is_a_raw_body_not_a_json_array():
    """`book_put` takes the invoke's `Request` and reads `InvokeBody::Raw` --
    tauri 2.11's own shape (`examples/api` `echo(request: tauri::ipc::Request)`);
    a JSON array is taken too (Tauri's postMessage fallback, Android), never
    asked for."""
    lib = LIB_RS.read_text("utf-8")
    body = re.search(r"fn book_put<R: tauri::Runtime>\(.*?\n\}", lib, re.S).group(0)
    assert "request: tauri::ipc::Request<'_>" in body
    assert "tauri::ipc::InvokeBody::Raw(bytes) => book_write(" in body
    assert "tauri::ipc::InvokeBody::Json(serde_json::Value::Array(items))" in body
    assert 'log::info!(\n        "frank: book_put {slug}@{hash}/{rel} -- {n} bytes in {} ms"' in body


@pytest.mark.skipif(NODE is None, reason="node is not installed")
def test_the_door_sends_the_bytes_as_the_body_and_the_names_as_headers():
    program = """
const calls = [];
globalThis.window = globalThis;
window.__TAURI__ = { core: { invoke: (cmd, args, options) => { calls.push({ cmd, args, options }); return Promise.resolve(cmd === "book_list" ? [] : 1); } } };
%s
const B = window.TTSTVHost.books;
const bytes = new Uint8Array([79, 103, 103, 83]);
(async () => {
  await B.put("les-pensees", "0123456789abcdef", "chapters/c 001 é.txt", bytes);
  await B.meta("les-pensees", "0123456789abcdef", { slug: "les-pensees", files: 31 });
  await B.list();
  await B.remove("les-pensees");
  const put = calls[0];
  console.log(JSON.stringify({
    verbs: Object.keys(B).sort(), cmds: calls.map(c => c.cmd),
    putIsView: ArrayBuffer.isView(put.args), putSame: put.args === bytes, headers: put.options.headers,
    meta: calls[1].args, list: calls[2].args === undefined, remove: calls[3].args,
  }));
})();
""" % _books_js()
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "door.cjs"
        p.write_text(program, encoding="utf-8")
        r = subprocess.run([NODE, str(p)], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    got = json.loads(r.stdout.strip().splitlines()[-1])
    assert got["verbs"] == ["list", "meta", "put", "remove"]
    assert got["cmds"] == COMMANDS
    # tauri's processIpcMessage sends an ArrayBuffer view as application/octet-stream
    assert got["putIsView"] is True and got["putSame"] is True
    assert got["headers"] == {"frank-book-slug": "les-pensees", "frank-book-hash": "0123456789abcdef",
                              "frank-book-rel": "chapters%2Fc%20001%20%C3%A9.txt"}
    assert got["meta"] == {"slug": "les-pensees", "hash": "0123456789abcdef", "meta": {"slug": "les-pensees", "files": 31}}
    assert got["list"] is True and got["remove"] == {"slug": "les-pensees"}


@pytest.mark.skipif(NODE is None, reason="node is not installed")
def test_a_page_outside_frank_gets_no_door():
    program = "globalThis.window = globalThis;\n%s\nconsole.log(JSON.stringify({ host: typeof window.TTSTVHost }));" % _books_js()
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "none.cjs"
        p.write_text(program, encoding="utf-8")
        r = subprocess.run([NODE, str(p)], capture_output=True, text=True, timeout=60)
    assert json.loads(r.stdout.strip())["host"] == "undefined"


def test_the_imported_shell_talks_to_this_door():
    """The other end, as imported into `shell/`: import.js's HostStore calls
    the same four verbs, and context.js counts the door as a store -- so the
    phone's Library shows the books a Sync pulled. Fails until the shell is
    re-imported from a TTSTV that has the seam."""
    js = IMPORT_JS.read_text("utf-8")
    assert "function HostStore(door)" in js, "shell/library/import.js has no store seam -- re-import the shell"
    for verb in ("door.put(slug, hash, rel, bytes)", "door.meta(slug, hash, meta)", "door.list()", "door.remove(slug)"):
        assert verb in js, verb
    ctx = CONTEXT_JS.read_text("utf-8")
    assert "hostBooks" in ctx and "b.put" in ctx, "shell/reader/context.js does not know the door"
