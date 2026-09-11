#!/usr/bin/env bash
# tools/phone.sh -- the rare REAL build, as one command and no prompts.
#
# The daily loop is not this file. The daily loop is `tauri ios dev` over the
# LAN (PHONE.md §6c): the phone loads the Mac's dev server, and a change to a
# shell file appears on the phone with no build at all. This is for the times
# that is not enough -- a Rust change, a plist change, a build to hand to
# somebody, or proving the app works with the Mac switched off.
#
# Four steps, in the order that makes each one true:
#
#   1. xcodegen        project.yml -> Info.plist + the Xcode project.
#                      NOTHING ELSE DOES THIS. `tauri ios build` does not
#                      regenerate, so every plist key ever added to project.yml
#                      sits there unpressed until this runs -- which on 6 Sep
#                      was all three of job 26's local-network keys AND the ATS
#                      exception the dev loop needs. It is first here because
#                      it is the step everyone forgets.
#   2. import_shell    only with --shell: it needs TTSTV on the disk, and it
#                      REPLACES shell/ whole. A Rust-only change does not want
#                      to re-import a shell it is not changing.
#   3. ios build       --debug, always: a release build is not inspectable in
#                      Safari and cannot be installed on a phone with a free
#                      team's profile.
#   4. devicectl       install onto the one connected phone, by udid.
#
# usage:  tools/phone.sh [--shell] [--ttstv PATH] [--device UDID] [--no-install]
#
# Nothing here signs anything: codesign uses the identity Xcode already has.
# If it asks for the login password, PHONE.md step 0 is the one line that stops
# it asking again -- this script deliberately does NOT run that for you, because
# it changes a keychain ACL and that is a thing a person should type once,
# themselves, having read what it does.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLE="$REPO/src-tauri/gen/apple"
IPA="$APPLE/build/arm64/Frank.ipa"

WITH_SHELL=0
TTSTV="${TTSTV:-$HOME/Documents/RUNNERS/TTSTV/TTSTV}"
DEVICE=""
INSTALL=1
while [ $# -gt 0 ]; do
  case "$1" in
    --shell)      WITH_SHELL=1; shift ;;
    --ttstv)      TTSTV="$2"; shift 2 ;;
    --device)     DEVICE="$2"; shift 2 ;;
    --no-install) INSTALL=0; shift ;;
    -h|--help)    sed -n '2,32p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)            echo "phone.sh: unknown argument $1 (try --help)" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

# Xcode's ▶ gets this from project.yml's script phase; a terminal run gets it
# from the shell -- except under `env -i`, cron, or an editor's task runner.
export PATH="$HOME/.cargo/bin:$PATH"
command -v cargo    >/dev/null || { echo "phone.sh: no cargo on PATH (rustup?)" >&2; exit 1; }
command -v xcodegen >/dev/null || { echo "phone.sh: no xcodegen -- brew install xcodegen" >&2; exit 1; }

say "1/4  xcodegen -- project.yml into the Xcode project and Info.plist"
( cd "$APPLE" && xcodegen generate )

if [ "$WITH_SHELL" = 1 ]; then
  say "2/4  import the shell from $TTSTV"
  python3 "$REPO/tools/import_shell.py" --ttstv "$TTSTV"
else
  say "2/4  shell: not re-imported (pass --shell to take a new one from TTSTV)"
fi

say "3/4  tauri ios build --debug"
( cd "$REPO" && npm run --silent -- tauri ios build --debug )
[ -f "$IPA" ] || { echo "phone.sh: no $IPA -- the build did not produce one" >&2; exit 1; }
printf 'built: %s (%s)\n' "$IPA" "$(du -h "$IPA" | cut -f1)"

if [ "$INSTALL" = 0 ]; then
  say "4/4  install: skipped (--no-install)"
  exit 0
fi

if [ -z "$DEVICE" ]; then
  # One connected phone is the normal case; more than one is a question, not a
  # guess. `devicectl` prints a table whose Name and Model columns both carry
  # spaces ("iPhone 2", "iPhone 17 Pro"), so a column index is a guess -- on
  # 11 Sep $(NF-1) handed devicectl the string "17". The identifier is the one
  # token shaped like a UUID; take that.
  DEVICE="$(xcrun devicectl list devices 2>/dev/null \
            | awk '$0 ~ /connected/ { for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/) print $i }' | head -2)"
  n="$(printf '%s\n' "$DEVICE" | grep -c . || true)"
  if [ "$n" -eq 0 ]; then
    echo "phone.sh: no connected device. Plug the phone in and unlock it, or pass --device <udid>." >&2
    echo "          xcrun devicectl list devices" >&2
    exit 1
  fi
  if [ "$n" -gt 1 ]; then
    echo "phone.sh: more than one device connected -- name the one you mean:" >&2
    xcrun devicectl list devices >&2
    exit 1
  fi
fi

say "4/4  install onto $DEVICE"
xcrun devicectl device install app --device "$DEVICE" "$IPA"
echo
echo "Open Frank on the phone. If the Library is blank or garbled, the log says which:"
echo "  Safari > Develop > <the phone> > Frank  (both toggles: PHONE.md §6d)"
