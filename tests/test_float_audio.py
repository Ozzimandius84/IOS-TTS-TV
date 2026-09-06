"""The float's first half: the audio that survives the app switcher, and the
lock-screen title that is a SENTENCE.

The spike (`scratch-float/ANSWER.md`) found two absences rather than a bug:
no `UIBackgroundModes` in `gen/apple/project.yml`, so iOS suspended Frank
seconds after it went to the background, and no `AVAudioSession` category
anywhere, so even with the key the sound would have been treated as decoration.
Both are fixed; **neither works without the other**, and that pairing is what
most of this file holds.

What is proved here and not in `src-tauri/src/lib.rs`'s own `#[cfg(test)]`:
the things that are FILES and the things that are LINK-TIME. Rust cannot check
that an Objective-C file two directories away exports the symbol its `extern
"C"` block names, and this repo has no cargo reachable from a Cowork session
anyway (STATUS.md, `ttstv-where-things-build`) -- so the agreements that a
compiler would otherwise be the first to notice are asserted here.

`NOW_PLAYING_JS` is run for real, under node, against a `mediaSession` stub,
and the rate limit is measured rather than read: the corpus is 3.56 words a
second and 25 at the floor, so a title written once a second is a sentence's
rate and never a word's.

Nothing here needs cargo, Xcode, a simulator or a network.

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
CAPS = REPO / "src-tauri" / "capabilities" / "default.json"
PROJECT_YML = REPO / "src-tauri" / "gen" / "apple" / "project.yml"
OBJC = REPO / "src-tauri" / "ios" / "FrankAudio.m"

NODE = shutil.which("node")


def _yml_without_comments() -> str:
    """`project.yml`'s live lines. Its comments name the things they forbid --
    `voip`, the second compiler of FrankAudio.m -- so a test that greps the raw
    file fails on the very sentence that keeps the rule."""
    return "\n".join(ln for ln in PROJECT_YML.read_text("utf-8").splitlines()
                      if not ln.lstrip().startswith("#"))


def _now_playing_js() -> str:
    """`NOW_PLAYING_JS`'s raw string, off lib.rs. Read, never restated."""
    m = re.search(r'pub const NOW_PLAYING_JS: &str = r#"(.*?)"#;', LIB_RS.read_text("utf-8"), re.S)
    assert m, "lib.rs has no NOW_PLAYING_JS raw string"
    return m.group(1)


# ------------------------------------------------- the key, and its other half

def test_the_background_mode_is_claimed():
    """Without it the process is suspended and the audio stops with it. This is
    the one line that makes "listen along, do another thing" possible at all."""
    y = PROJECT_YML.read_text("utf-8")
    assert re.search(r"^\s*UIBackgroundModes:\s*\[audio\]\s*$", y, re.M), \
        "gen/apple/project.yml claims no audio background mode"


def test_the_voip_background_mode_is_never_claimed():
    """`AVPictureInPictureVideoCallLayer` wants it and App Review rejects it for
    an app that is not a phone (`scratch-float/ANSWER.md` §3). The float's native
    road uses the plain sample-buffer content source, which needs only `audio`."""
    assert "voip" not in _yml_without_comments()


def test_the_key_never_ships_without_the_category():
    """The pairing, asserted as a pairing. A background mode over a SoloAmbient
    session still goes quiet, so a build that claims `audio` and sets no category
    is a build that looks fixed and is not."""
    y = PROJECT_YML.read_text("utf-8")
    if "UIBackgroundModes" in y:
        assert OBJC.exists(), "the background mode is claimed and nothing sets the category"
        m = OBJC.read_text("utf-8")
        assert "AVAudioSessionCategoryPlayback" in m
        assert "setActive" in m


def test_the_deployment_target_moved_for_the_float():
    """14.0 -> 15.0. `AVPictureInPictureController.ContentSource(
    sampleBufferDisplayLayer:playbackDelegate:)` -- road (b) -- is iOS 15."""
    m = re.search(r"^\s*iOS:\s*([\d.]+)\s*$", PROJECT_YML.read_text("utf-8"), re.M)
    assert m, "project.yml names no iOS deployment target"
    assert tuple(int(n) for n in m.group(1).split(".")) >= (15, 0), m.group(1)


# ------------------------------------------------------ the link-time agreement

def test_rust_and_the_objc_file_name_the_same_symbols():
    """The one a compiler cannot catch until the very last step of an iOS build,
    and then only as `Undefined symbols for architecture arm64`. Both sides are
    read off disk and compared."""
    rust = set(re.findall(r"fn (frank_audio_session_\w+)\(", LIB_RS.read_text("utf-8")))
    objc = set(re.findall(r"^int (frank_audio_session_\w+)\(void\)", OBJC.read_text("utf-8"), re.M))
    assert rust, "lib.rs declares no frank_audio_session_* symbol"
    assert rust == objc, f"rust declares {sorted(rust)}, FrankAudio.m defines {sorted(objc)}"


def test_exactly_one_thing_compiles_the_objc_file():
    """Two routes exist and only one may be taken. `build.rs` compiles it with
    the `cc` crate into the staticlib; `project.yml` could compile it again by
    naming `../../ios` in the target's sources. Both is `duplicate symbol
    _frank_audio_session_category` at the last step of a phone build."""
    by_cc = "ios/FrankAudio.m" in BUILD_RS.read_text("utf-8")
    by_xcode = "- path: ../../ios" in _yml_without_comments()
    assert by_cc != by_xcode, f"cc compiles it: {by_cc}; xcode compiles it: {by_xcode}"


def test_the_framework_is_linked_by_the_thing_that_runs_the_linker():
    """`cargo:rustc-link-lib=framework=AVFoundation` in build.rs is not enough:
    this crate is a `staticlib`, cargo never links, and that line reaches
    nothing. Xcode links the app, so `project.yml` must name the framework."""
    assert "AVFoundation.framework" in PROJECT_YML.read_text("utf-8")


def test_the_extern_block_is_ios_only():
    """`cargo test` on the Mac targets macOS, where those symbols do not exist.
    Guarded by `target_os`, not `mobile`: Android is mobile and has no
    AVAudioSession either."""
    src = LIB_RS.read_text("utf-8")
    i = src.index('extern "C" {')
    assert 'cfg(target_os = "ios")' in src[max(0, i - 200):i]


# --------------------------------------------------- the command, end to end

def test_the_command_is_declared_granted_and_handled():
    """Three files have to agree or the page's call fails at run time with a
    permission error that reads like a bug in the page."""
    assert '"audio_session_start"' in BUILD_RS.read_text("utf-8")
    assert "allow-audio-session-start" in json.loads(CAPS.read_text("utf-8"))["permissions"]
    src = LIB_RS.read_text("utf-8")
    assert re.search(r"generate_handler!\[[^\]]*audio_session_start", src, re.S)
    assert "#[tauri::command]\nfn audio_session_start" in src


def test_the_session_is_not_taken_at_launch():
    """Activating a Playback session stops whatever else the phone is playing.
    Opening Frank must not kill your music, so `setup` sets the CATEGORY and the
    activation waits for the reader's first `play`."""
    src = LIB_RS.read_text("utf-8")
    setup = src[src.index(".setup(|app|"):]
    assert "audio_session_category()" in setup
    assert "audio_session_activate()" not in setup


# ------------------------------------------------------------- the writer runs

def _run_now_playing(script: str, tauri: bool = True) -> dict:
    """Run `NOW_PLAYING_JS` under node with a mediaSession stub, then `script`.

    `tauri=False` omits `window.__TAURI__` BEFORE the script is evaluated, which
    is the only faithful shape of that case: the script reads it once, at load.
    """
    driver = """
const listeners = {};
const invokes = [];
globalThis.window = globalThis;
globalThis.document = {
  title: "Gerontion",
  addEventListener: (t, fn, capture) => { (listeners[t] = listeners[t] || []).push([fn, !!capture]); },
};
globalThis.MediaMetadata = class { constructor(o) { Object.assign(this, o); } };
const written = [];
/* node 21+ defines `navigator` itself, as a non-writable accessor -- a plain
   assignment is swallowed and the stub never arrives. */
Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true,
  value: { mediaSession: {
    set metadata(m) { written.push(m.title); this._m = m; },
    get metadata() { return this._m; },
    playbackState: "none",
  } } });
%s
const fire = (t) => (listeners[t] || []).forEach(([fn]) => fn());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
%s
(async () => {
%s
  process.stdout.write(JSON.stringify({
    written, invokes, stats: window.TTSTVHost.nowPlayingStats(),
    capture: (listeners.play || []).map(([, c]) => c),
  }));
})();
""" % (
        'globalThis.__TAURI__ = { core: { invoke: (c, a) => { invokes.push([c, a]); '
        'return Promise.resolve(); } } };' if tauri else '/* no Frank here */',
        _now_playing_js(), script)
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "d.js"
        p.write_text(driver, encoding="utf-8")
        out = subprocess.run([NODE, str(p)], capture_output=True, text=True, timeout=60)
        assert out.returncode == 0, out.stderr
        return json.loads(out.stdout)


pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")


def test_the_first_play_takes_the_session_and_fills_the_lock_screen():
    """A `play` listener in the CAPTURE phase -- media events do not bubble, so
    `false` would see nothing. The book's own title stands until the reader
    names a sentence, so the lock screen is never blank."""
    r = _run_now_playing("  fire('play');")
    assert r["capture"] == [True], "the play listener is not in the capture phase"
    assert r["written"] == ["Gerontion"]
    assert [c for c, _ in r["invokes"]] == ["audio_session_start"]
    assert r["stats"]["started"] is True


def test_the_session_is_taken_once_however_often_play_fires():
    r = _run_now_playing("  fire('play'); fire('play'); fire('play');")
    assert [c for c, _ in r["invokes"]] == ["audio_session_start"]


def test_a_hundred_sentences_in_a_burst_write_the_lock_screen_once():
    """The measurement, enforced. The corpus runs at 3.56 words a second and 25
    at the floor; a lock-screen title written at that rate shows 61.7% of
    nothing. So the seam coalesces to one write a second, TRAILING edge -- the
    newest sentence wins, and the lock screen is never behind the book."""
    r = _run_now_playing("""
  fire('play');
  for (let i = 0; i < 100; i++) window.TTSTVHost.nowPlaying('sentence ' + i, 'Gerontion');
  await sleep(1300);
""")
    assert r["written"] == ["Gerontion", "sentence 99"], r["written"]
    assert r["stats"]["wrote"] == 2 and r["stats"]["coalesced"] == 99, r["stats"]


def test_the_same_sentence_is_never_written_twice():
    r = _run_now_playing("""
  fire('play');
  window.TTSTVHost.nowPlaying('Here I am, an old man in a dry month');
  await sleep(1300);
  window.TTSTVHost.nowPlaying('Here I am, an old man in a dry month');
  await sleep(1300);
""")
    assert r["written"] == ["Gerontion", "Here I am, an old man in a dry month"]
    assert r["stats"]["wrote"] == 2


def test_an_empty_sentence_is_refused_and_changes_nothing():
    r = _run_now_playing("""
  fire('play');
  const a = window.TTSTVHost.nowPlaying('   ');
  const b = window.TTSTVHost.nowPlaying(null);
  await sleep(1300);
  if (a || b) throw new Error('an empty title was accepted');
""")
    assert r["written"] == ["Gerontion"]


def test_the_page_works_where_there_is_no_frank():
    """Injected unconditionally, like PAIR_JS: the `mediaSession` half needs no
    `__TAURI__`, so the same shell in Safari or on the Mac still names the
    sentence and simply takes no session."""
    r = _run_now_playing("""
  fire('play');
  window.TTSTVHost.nowPlaying('a sentence');
  await sleep(1300);
""", tauri=False)
    assert r["written"] == ["Gerontion", "a sentence"]
    assert r["invokes"] == []
