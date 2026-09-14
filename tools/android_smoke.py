"""Install the apk, launch it, and read the two numbers the app prints.

    python3 tools/android_smoke.py --apk <path>            # one device attached
    python3 tools/android_smoke.py --apk <path> --device emulator-5554

**What it proves, and why it is numbers and not a picture.** The one thing
nobody knows about Frank on Android is whether the shell survives the apk
(`PHONE.md` §5.2, "the Brotli story"): a built app embeds `shell/` compressed
and unpacks it on first launch, and the failure mode is a page of glyphs or a
blank Library -- both of which a screenshot shows and neither of which a
screenshot explains. The app says it in the log instead:

    frank: N embedded shell assets
    frank: unpacked N shell files -> <root>      (first launch only)
    frank: shell ready, N files

`N` is compared against `shell.manifest.json`'s own `count`, which is the
number `tools/import_shell.py` wrote when it imported the tree. Equal on all
three lines and equal to the manifest means every file crossed the archive.
That is the whole test, and it is one integer.

It is `--debug` apks only, because `tauri_plugin_log` is registered under
`cfg!(debug_assertions)` (`lib.rs`, `setup`) -- a release apk prints none of
these lines and this harness would (correctly) find nothing.

Exit 0 with the numbers printed; exit 1 with what was seen instead.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MANIFEST = REPO / "shell.manifest.json"
PACKAGE = "com.ttstv.frank"          # tauri.conf.json `identifier`
ACTIVITY = f"{PACKAGE}/.MainActivity"  # what `tauri android init` generates

READY = re.compile(r"frank: shell ready, (\d+) files")
EMBEDDED = re.compile(r"frank: (\d+) embedded shell assets")
UNPACKED = re.compile(r"frank: unpacked (\d+) shell files")


def adb(args: list[str], device: str | None, **kw) -> subprocess.CompletedProcess:
    cmd = ["adb"] + (["-s", device] if device else []) + args
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def one_device(device: str | None) -> str:
    if device:
        return device
    out = subprocess.run(["adb", "devices"], capture_output=True, text=True).stdout
    names = [l.split()[0] for l in out.splitlines()[1:] if l.strip().endswith("\tdevice")]
    if len(names) != 1:
        raise SystemExit(
            f"android_smoke: {len(names)} devices attached -- name one with --device\n{out}"
        )
    return names[0]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apk", type=Path, required=True)
    ap.add_argument("--device", default=None)
    ap.add_argument("--wait", type=float, default=30.0,
                    help="seconds to wait for the log lines (default 30)")
    a = ap.parse_args(argv)

    if not a.apk.is_file():
        print(f"android_smoke: no {a.apk}", file=sys.stderr)
        return 1
    want = json.loads(MANIFEST.read_text("utf-8"))["count"]
    device = one_device(a.device)

    # A fresh install every time: the unpack line is written once per shell
    # version, so an app already carrying this shell prints "already unpacked"
    # and the run would prove nothing about the archive.
    adb(["uninstall", PACKAGE], device)
    r = adb(["install", "-r", str(a.apk)], device)
    if r.returncode != 0 or "Success" not in (r.stdout + r.stderr):
        print(f"android_smoke: install failed\n{r.stdout}{r.stderr}", file=sys.stderr)
        return 1
    adb(["logcat", "-c"], device)
    # Ask the device which activity the launcher would start rather than
    # trusting the name: `.MainActivity` is what `tauri android init` writes
    # today, and a generated name is exactly the kind of thing that changes
    # under you. `resolve-activity --brief` prints `<package>/<activity>` on
    # its last line, or nothing if the install went wrong.
    r = adb(["shell", "cmd", "package", "resolve-activity", "--brief", PACKAGE], device)
    lines = [l.strip() for l in r.stdout.splitlines() if "/" in l]
    activity = lines[-1] if lines else ACTIVITY
    r = adb(["shell", "am", "start", "-n", activity], device)
    if "Error" in (r.stdout + r.stderr):
        print(f"android_smoke: launch failed ({activity})\n{r.stdout}{r.stderr}", file=sys.stderr)
        return 1

    deadline = time.time() + a.wait
    seen = ""
    ready = embedded = unpacked = None
    while time.time() < deadline:
        time.sleep(2)
        seen = adb(["logcat", "-d"], device).stdout
        m = READY.search(seen)
        if m:
            ready = int(m.group(1))
            break
    for pat, name in ((EMBEDDED, "embedded"), (UNPACKED, "unpacked")):
        m = pat.search(seen)
        if m:
            if name == "embedded":
                embedded = int(m.group(1))
            else:
                unpacked = int(m.group(1))

    print(f"android_smoke: device {device}")
    print(f"android_smoke: manifest says {want} files")
    print(f"android_smoke: embedded={embedded} unpacked={unpacked} ready={ready}")

    # Anything the app shouted, whether or not the numbers came out.
    for line in seen.splitlines():
        if "frank:" in line and ("E " in line[:40] or "error" in line.lower()):
            print(f"android_smoke: log> {line.strip()}")

    if ready is None:
        print("android_smoke: the app never printed `frank: shell ready` -- "
              "either it did not start, or this is a RELEASE apk (no log plugin).",
              file=sys.stderr)
        return 1
    bad = [f"{n}={v}" for n, v in (("embedded", embedded), ("unpacked", unpacked),
                                   ("ready", ready)) if v is not None and v != want]
    if bad:
        print(f"android_smoke: {', '.join(bad)} -- the manifest says {want}. "
              "Files were lost crossing the apk (PHONE.md §5.2).", file=sys.stderr)
        return 1
    print(f"android_smoke: OK -- {want} shell files reached the phone")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
