"""The pull: a Sync's books downloaded by the APP, not the page (G-SYNCBG).

Osca, 11 Sep: *"the phone's pull is JavaScript inside the Settings page.
Leave the page and it cancels; background keeps it; lock pauses it. It must
survive using the app."* `src-tauri/src/pull.rs` runs a job on its own
thread and writes through the book door's own functions; three commands --
`sync_start`, `sync_status`, `sync_stop` -- and a door, `TTSTVHost.sync`
(`SYNC_JS`), which also carries the app's ask on launch and on return to the
foreground to the page's planner (TTSTV `library/drive.js::syncAuto`).

What is proved HERE, for `test_book_door.py`'s reason (no cargo from a
Cowork session): the FILES -- the three commands declared, granted, handled
and injected, the client crate named -- and the door itself, run under node
with a stand-in `__TAURI__`. The runner (order, resume by bytes, a refused
`rel`, the token refresh, `sync_stop`) is `pull.rs`'s own `mod pull_tests`
and the parse of the page's job is lib.rs's `mod pull_door_tests`:
`cargo test`.

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
PULL_RS = REPO / "src-tauri" / "src" / "pull.rs"
BUILD_RS = REPO / "src-tauri" / "build.rs"
CARGO = REPO / "src-tauri" / "Cargo.toml"
CAPABILITY = REPO / "src-tauri" / "capabilities" / "default.json"
DRIVE_JS = REPO / "shell" / "library" / "drive.js"
NODE = shutil.which("node")

COMMANDS = ["sync_start", "sync_status", "sync_stop"]


def _sync_js() -> str:
    m = re.search(r'pub const SYNC_JS: &str = r#"(.*?)"#;', LIB_RS.read_text("utf-8"), re.S)
    assert m, "lib.rs has no SYNC_JS"
    return m.group(1)


def _node(program: str) -> dict:
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "door.cjs"
        p.write_text(program, encoding="utf-8")
        r = subprocess.run([NODE, str(p)], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_three_commands_are_declared_granted_handled_and_injected():
    lib = LIB_RS.read_text("utf-8")
    handler = re.search(r"generate_handler!\[(.*?)\]", lib, re.S).group(1)
    manifest = re.search(r"\.commands\(&\[(.*?)\]\)", BUILD_RS.read_text("utf-8"), re.S).group(1)
    granted = json.loads(CAPABILITY.read_text("utf-8"))["permissions"]
    for cmd in COMMANDS:
        assert re.search(rf"\b{cmd}\b", handler), f"generate_handler! does not handle {cmd}"
        assert f'"{cmd}"' in manifest, f"build.rs does not declare {cmd}"
        assert "allow-" + cmd.replace("_", "-") in granted, f"the capability does not grant {cmd}"
        assert re.search(rf"#\[tauri::command\]\nfn {cmd}\b", lib), f"{cmd} is not a command"
    assert "mod pull;" in lib and PULL_RS.is_file()
    assert lib.index(".initialization_script(BOOKS_JS)") < lib.index(".initialization_script(SYNC_JS)")
    assert ".manage(PullState::default())" in lib
    # the app's two askings
    assert "payload.event() == tauri::webview::PageLoadEvent::Finished" in lib
    assert "window.on_window_event(move |event| sync_on_window(&handle, event));" in lib
    assert re.search(r"#\[cfg\(mobile\)\]\n    if let tauri::WindowEvent::Resumed = event \{\n        sync_auto\(app, \"foreground\"\);", lib)
    # the one HTTP client, blocking, rustls -- and nothing granted on the way
    assert re.search(r'^ureq = "2\.\d+"$', CARGO.read_text("utf-8"), re.M)
    assert not [p for p in granted if p.startswith(("fs:", "http:", "opener:", "deep-link:"))], granted


def test_the_runner_writes_only_through_the_book_doors_own_functions():
    """`pull.rs` never names a path of its own: every file goes to
    `book_write_from` (which shares `book_dest` with `book_put`), every
    commit is `book_commit`, the resume asks `book_have`. G-TOPUP's door
    (14 Sep) is the same rule with four more names -- `book_topup_*`, in
    lib.rs beside them, because the books folder is the book door's."""
    pull = PULL_RS.read_text("utf-8")
    body = pull.split("#[cfg(test)]")[0]
    imported = re.search(r"use crate::\{(.*?)\};", body, re.S)
    assert imported, "pull.rs takes the book door's functions by name"
    names = sorted(n.strip() for n in imported.group(1).replace("\n", " ").split(",") if n.strip())
    assert names == ["book_commit", "book_hash_ok", "book_have", "book_installed", "book_rel",
                     "book_slug_ok", "book_topup_commit", "book_topup_flag", "book_topup_have",
                     "book_topup_names", "book_topup_write", "book_write_from", "json_field"], names
    for banned in ("fs::write", "File::create", "create_dir", "remove_dir", "fs::rename"):
        assert banned not in body, f"pull.rs writes on its own: {banned}"
    lib = LIB_RS.read_text("utf-8")
    assert re.search(r"fn book_write\(.*?\n    let dst = book_dest\(books, slug, hash, rel\)\?;", lib, re.S)
    assert re.search(r"fn book_write_from\(.*?\n    let dst = book_dest\(books, slug, hash, rel\)\?;", lib, re.S)
    # the top-up writes INTO the installed folder and never opens a `.part/`
    topup = re.search(r"fn book_topup_write\(.*?\n\}", lib, re.S).group(0)
    assert "book_topup_dest(books, slug, hash, rel)?" in topup and "book_part" not in topup
    assert re.search(r"fn book_topup_dest\(.*?book_live\(books, slug, hash\)\?;", lib, re.S)
    assert 'const BOOK_TOPUP: [(&str, &str); 1] = [("cover.jpg", "has_cover")];' in lib, \
        "import.js's TOPUP map, rel for rel"
    assert 'Some("jpg") => "image/jpeg",' in lib, "and a cover is served as a picture"
    # the only hosts it reaches
    assert 'pub const DRIVE_FILES: &str = "https://www.googleapis.com/drive/v3/files/";' in body
    assert 'pub const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";' in body
    assert "client_secret" not in body, "a PKCE public client: no secret"


@pytest.mark.skipif(NODE is None, reason="node is not installed")
def test_the_door_invokes_three_commands_keeps_a_refreshed_token_and_says_a_pull_began():
    r = _node("""
const calls = [], events = [];
const store = { "ttstv.sync.google": JSON.stringify({ access: "old", refresh: "1//r", expires: 1, clientId: "1-x" }) };
globalThis.window = globalThis;
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
globalThis.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } };
window.dispatchEvent = e => events.push([e.type, e.detail.running]);
const refreshed = { access: "ya29.new", expires: 99 };
window.__TAURI__ = { core: { invoke: (cmd, args) => { calls.push({ cmd, args });
  return Promise.resolve(cmd === "sync_stop" ? true : { running: cmd === "sync_start", n: 1, google: Object.assign({}, refreshed) }); } } };
%s
const S = window.TTSTVHost.sync;
(async () => {
  const st = await S.start({ transport: "drive", books: [] });
  const tok1 = JSON.parse(store["ttstv.sync.google"]);
  const st2 = await S.status();
  const stopped = await S.stop();
  // a signed-out page (no record) is not signed back in by a status
  delete store["ttstv.sync.google"];
  await S.status();
  console.log(JSON.stringify({ verbs: Object.keys(S).sort(), cmds: calls.map(c => c.cmd), startArgs: calls[0].args,
    statusArgs: calls[1].args === undefined, stopped, st, st2, tok1, events, after: store["ttstv.sync.google"] || null }));
})();
""" % _sync_js())
    assert r["verbs"] == ["auto", "start", "status", "stop"]
    assert r["cmds"] == ["sync_start", "sync_status", "sync_stop", "sync_status"]
    assert r["startArgs"] == {"job": {"transport": "drive", "books": []}} and r["statusArgs"] is True
    assert r["stopped"] is True
    assert "google" not in r["st"] and "google" not in r["st2"], "the token never reaches a page's status"
    assert r["tok1"] == {"access": "ya29.new", "refresh": "1//r", "expires": 99, "clientId": "1-x"}, "drive.js's record, the refresh kept"
    assert r["events"] == [["ttstv:sync", True]]
    assert r["after"] is None


@pytest.mark.skipif(NODE is None, reason="node is not installed")
def test_auto_loads_the_planner_into_any_page_and_hands_it_the_host():
    r = _node("""
globalThis.window = globalThis;
const added = [];
globalThis.document = { head: { appendChild: s => { added.push(s.src); window.TTSTVDrive = { syncAuto: (host, o) => Promise.resolve(["planned", typeof host.sync.start, o.trigger]) }; s.onload(); } },
  createElement: () => ({}) };
window.__TAURI__ = { core: { invoke: () => Promise.resolve({}) } };
%s
(async () => {
  const first = await window.TTSTVHost.sync.auto("launch");
  const second = await window.TTSTVHost.sync.auto("foreground");
  window.TTSTVDrive = undefined;
  document.head.appendChild = s => { added.push(s.src); s.onerror(); };
  const none = await window.TTSTVHost.sync.auto("foreground");
  console.log(JSON.stringify({ added, first, second, none }));
})();
""" % _sync_js())
    assert r["first"] == ["planned", "function", "launch"] and r["second"] == ["planned", "function", "foreground"]
    assert r["added"] == ["/library/drive.js", "/library/drive.js"], "loaded once while it stays loaded"
    assert r["none"] is None, "no planner: nothing, and no throw"


@pytest.mark.skipif(NODE is None, reason="node is not installed")
def test_a_page_outside_frank_gets_no_sync_door():
    r = _node("globalThis.window = globalThis;\n%s\nconsole.log(JSON.stringify({ host: typeof window.TTSTVHost }));" % _sync_js())
    assert r["host"] == "undefined"


def test_the_imported_shell_plans_for_this_door():
    """The other end, as imported into `shell/`: drive.js has the planner the
    door calls, and keeps its token in the key the door writes back to.
    Fails until the shell is re-imported from a TTSTV that has G-SYNCBG."""
    js = DRIVE_JS.read_text("utf-8")
    assert "function syncAuto(host, o)" in js, "shell/library/drive.js has no planner -- re-import the shell"
    assert 'var GOOGLE_TOKEN_KEY = "ttstv.sync.google";' in js
    assert 'var TOKEN_KEY = "ttstv.sync.google";' in _sync_js()
    auth = re.search(r"function syncDriveAuth\(\) \{\n(.*?)\n\}", js, re.S).group(1)
    for name in ("clientId:", "refresh:", "access:", "expires:"):
        assert name in auth, name
