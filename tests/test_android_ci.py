"""The Android workflow, the env script, and the door table -- held to the code.

None of this runs a build; a build needs an NDK and a runner. What it holds is
the three things that rot silently between runs:

* **the workflow's SHAPE** -- that CI still runs `tools/android.sh`, the same
  command a person runs, rather than a second Gradle line of its own; that
  `init` comes before the build; that the apk is actually uploaded.
* **the four triples**, named identically in the workflow and in
  `tools/android_env.sh` -- a triple in one and not the other is a check that
  passes by not running.
* **the door table** (`PHONE.md` §5.4): every `src-tauri/ios/*.m` has a row. A
  seventh native door added without a row is the exact thing the table exists
  to stop, and nothing else would notice.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

REPO = Path(__file__).resolve().parents[1]
WORKFLOW = REPO / ".github" / "workflows" / "android.yml"
ENV_SH = REPO / "tools" / "android_env.sh"
ANDROID_SH = REPO / "tools" / "android.sh"
PHONE = REPO / "PHONE.md"
LIB_RS = REPO / "src-tauri" / "src" / "lib.rs"

TRIPLES = [
    "aarch64-linux-android",
    "armv7-linux-androideabi",
    "i686-linux-android",
    "x86_64-linux-android",
]


@pytest.fixture(scope="module")
def wf():
    return yaml.safe_load(WORKFLOW.read_text("utf-8"))


def steps(wf, job):
    return wf["jobs"][job]["steps"]


def run_text(wf, job):
    return "\n".join(s.get("run", "") for s in steps(wf, job))


def test_the_three_jobs_are_the_three_gates(wf):
    assert list(wf["jobs"]) == ["check", "apk", "boot"]
    # the emulator cannot run before there is an apk to install
    assert wf["jobs"]["boot"]["needs"] == "apk"


def test_ci_runs_the_same_build_a_person_runs(wf):
    text = run_text(wf, "apk")
    assert "tools/android.sh --no-install" in text
    # ...and does NOT reimplement it
    assert "gradlew" not in text
    assert "tauri android build" not in text


def test_init_comes_before_the_build(wf):
    order = [s.get("run", "") for s in steps(wf, "apk")]
    init = next(i for i, r in enumerate(order) if "tauri android init" in r)
    build = next(i for i, r in enumerate(order) if "tools/android.sh" in r)
    assert init < build


def test_the_apk_is_uploaded_and_an_empty_upload_is_a_failure(wf):
    ups = [s for s in steps(wf, "apk") if str(s.get("uses", "")).startswith("actions/upload-artifact")]
    names = {s["with"]["name"] for s in ups}
    assert "frank-debug-apk" in names
    apk = next(s for s in ups if s["with"]["name"] == "frank-debug-apk")
    assert apk["with"]["if-no-files-found"] == "error"


def test_the_generated_manifest_is_kept_because_it_answers_the_open_rows(wf):
    ups = [s for s in steps(wf, "apk") if str(s.get("uses", "")).startswith("actions/upload-artifact")]
    gen = next(s for s in ups if s["with"]["name"] == "frank-android-generated")
    assert "AndroidManifest.xml" in gen["with"]["path"]


def test_the_apk_is_a_debug_apk_and_the_flag_is_in_the_script(wf):
    # `--debug` lives in android.sh, not in the workflow -- so the guard is
    # there. PHONE.md §5.2: a release apk cannot reach a plain-http Studio.
    assert "--apk --debug" in ANDROID_SH.read_text("utf-8")


def test_the_four_triples_are_named_in_both_places(wf):
    checked = run_text(wf, "check")
    env = ENV_SH.read_text("utf-8")
    for t in TRIPLES:
        assert t in checked, f"{t} is not checked in CI"
        assert t in env, f"{t} has no compiler in tools/android_env.sh"
    # the toolchain step must install what the loop then checks
    tgt = next(s for s in steps(wf, "check") if "rust-toolchain" in str(s.get("uses", "")))
    for t in TRIPLES:
        assert t in tgt["with"]["targets"]


def test_the_check_job_sources_the_env_or_it_dies_in_ring(wf):
    assert "source ../tools/android_env.sh" in run_text(wf, "check")


def test_the_one_letter_that_breaks_the_32_bit_arm_check():
    """Rust says `armv7-linux-androideabi`; the NDK's clang says `armv7a-`."""
    env = ENV_SH.read_text("utf-8")
    assert "armv7-linux-androideabi:armv7a-linux-androideabi" in env


def test_the_boot_job_counts_the_shell_rather_than_looking_at_it(wf):
    text = run_text(wf, "boot") + yaml.safe_dump(steps(wf, "boot"))
    assert "tools/android_smoke.py" in text
    assert "screenshot" not in text.lower()


def test_every_native_door_has_a_row_in_the_table():
    table = PHONE.read_text("utf-8").split("### 5.4")[1].split("### 5.5")[0]
    for m in sorted((REPO / "src-tauri" / "ios").glob("*.m")):
        assert m.name in table, f"{m.name} is a native door with no row in PHONE.md §5.4"


def test_the_audio_door_says_the_absence_on_android_and_only_there():
    src = LIB_RS.read_text("utf-8")
    # three arms, and they partition every platform: ios, android, the rest.
    for fn in ("frank_audio_session_category", "frank_audio_session_activate"):
        block = src.split(f"unsafe {{ {fn}() }}")[1][:400]
        assert '#[cfg(target_os = "android")]\n    let code = 3i32;' in block, fn
        assert '#[cfg(not(any(target_os = "ios", target_os = "android")))]' in block, fn
    assert re.search(r'3 => "no audio session on Android', src)
    # the Mac is untouched: still 0, still Ok.
    assert src.count("let code = 0i32;") == 2
