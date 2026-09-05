"""Put `RECORD_AUDIO` into the Android manifest `tauri android init` generates.

    python3 tools/android_permissions.py

**Why this is a script and not a committed file.** iOS's half of the same job
is a diff: `gen/apple/project.yml` is committed here, xcodegen rewrites
`Info.plist` FROM it, so the two usage-description keys live in the repo and
survive every regeneration. Android has no equivalent seam in Tauri 2 -- there
is no manifest fragment in `tauri.conf.json` to merge, and `gen/android/` is
written whole by `tauri android init` the first time and is not in this repo
until it has been run. A committed manifest would be a copy of a generated
file, which is the thing this repo is built not to do.

So the manifest is patched after `init`, by this, and the patch is idempotent:
run it twice and the second run says so and changes nothing. It is one line in
`PHONE.md`'s run sheet, immediately after `android init`, and it is the line to
re-run if `init` is ever run again.

Hands-free needs the permission on day one -- `voiceui/asr.js` asks for the
microphone the first time the trigger is armed, and on Android a `getUserMedia`
in a webview whose host app does not hold `RECORD_AUDIO` fails with
`NotAllowedError` before the user is ever asked, which reads exactly like a
declined prompt and is not one.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MANIFEST = REPO / "src-tauri" / "gen" / "android" / "app" / "src" / "main" / "AndroidManifest.xml"

PERMISSION = "android.permission.RECORD_AUDIO"
LINE = f'    <uses-permission android:name="{PERMISSION}" />\n'

_MANIFEST_OPEN = re.compile(r"<manifest\b[^>]*>\s*\n", re.S)


def patch(text: str) -> tuple[str, bool]:
    """Return the manifest with the permission in it, and whether it changed.

    Inserted straight after the `<manifest …>` open tag, which is where the
    Android build tools and every example put `uses-permission`; the schema
    requires it before `<application>` and this is the one place that is true
    whatever else `init` generated.
    """
    if PERMISSION in text:
        return text, False
    m = _MANIFEST_OPEN.search(text)
    if not m:
        raise SystemExit(
            "this file has no <manifest …> open tag -- it is not the manifest "
            "`tauri android init` writes, so nothing was changed"
        )
    return text[: m.end()] + LINE + text[m.end():], True


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    a = ap.parse_args(argv)
    if not a.manifest.is_file():
        print(
            f"no {a.manifest}\n"
            "Run `npx tauri android init` first -- gen/android/ is generated and is not in this repo "
            "until you have.",
            file=sys.stderr,
        )
        return 1
    text = a.manifest.read_text(encoding="utf-8")
    out, changed = patch(text)
    if changed:
        a.manifest.write_text(out, encoding="utf-8")
        print(f"added {PERMISSION} to {a.manifest}")
    else:
        print(f"{PERMISSION} already in {a.manifest} -- nothing to do")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
