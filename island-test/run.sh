#!/bin/bash
# Island Test -- build, install, run on the connected iPhone, pull the log,
# write the results into ISLAND-TEST.md and commit them (by paths).
#
#   bash "island-test/run.sh"        (from the IOS TTS TV folder; ~6 min)
#
# The phone must be plugged in (or paired over Wi-Fi) and UNLOCKED.
# When it says so, swipe up to the home screen and leave the phone alone.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
BID=com.ttstv.frank.islandtest
RES="$HERE/results"
mkdir -p "$RES"
exec > >(tee "$RES/run.log") 2>&1
say() { printf '\n== %s ==\n' "$*"; }

command -v xcodegen >/dev/null || { echo "no xcodegen -- brew install xcodegen"; exit 1; }

DEVICE="$(xcrun devicectl list devices 2>/dev/null \
  | awk '($0 ~ /connected/ || $0 ~ /available/) && $0 !~ /unavailable/ { for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/) print $i }' | head -1)"
[ -n "$DEVICE" ] || { echo "No phone found. Plug it in, unlock it, run again."; xcrun devicectl list devices; exit 1; }
echo "phone: $DEVICE"

say "1/5 xcodegen"
( cd "$HERE" && xcodegen generate ) || exit 1

say "2/5 build (signed with the same personal team as Frank)"
( cd "$HERE" && xcodebuild -project islandtest.xcodeproj -scheme IslandTest -configuration Debug \
    -destination "id=$DEVICE" -derivedDataPath build \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration build ) > "$RES/build.log" 2>&1
APP="$HERE/build/Build/Products/Debug-iphoneos/IslandTest.app"
if [ ! -d "$APP" ]; then echo "build failed -- last lines of results/build.log:"; grep -E "error:|BUILD FAILED" "$RES/build.log" | tail -20; exit 1; fi
echo "built"

say "3/5 install + open"
xcrun devicectl device install app --device "$DEVICE" "$APP" || exit 1
xcrun devicectl device process launch --device "$DEVICE" --terminate-existing "$BID" || exit 1

echo
echo "  >>> ON THE PHONE NOW: swipe up to the home screen and leave it alone for about 3 minutes. <<<"
echo "      (the test starts when the app goes to the background; watch the word beside the camera)"
echo

say "4/5 waiting for the run to finish"
TMP="$(mktemp -d)"
for i in $(seq 1 48); do       # up to 8 minutes
  sleep 10
  if xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
       --domain-identifier "$BID" --source Documents/island-done.txt --destination "$TMP/done" >/dev/null 2>&1; then
    echo "finished after ~$((i*10)) s"; break
  fi
  [ $((i % 3)) -eq 0 ] && echo "  ...$((i*10)) s"
done
xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier "$BID" --source Documents/island-log.csv --destination "$RES/island-log.csv" \
  || { echo "could not copy the log; the app's files:"; xcrun devicectl device info files --device "$DEVICE" \
         --domain-type appDataContainer --domain-identifier "$BID"; exit 1; }
[ -f "$TMP/done" ] || echo "WARNING: the run had not finished; results are partial"

say "5/5 results"
python3 "$HERE/analyze.py" "$RES/island-log.csv" > "$RES/summary.md" || exit 1
cat "$RES/summary.md"

{ echo; echo "### Run on the phone — $(date '+%d %b %Y %H:%M')"; echo; cat "$RES/summary.md"; } >> "$REPO/ISLAND-TEST.md"
cd "$REPO"
git add -- ISLAND-TEST.md island-test/results/island-log.csv island-test/results/summary.md island-test/results/run.log
git commit -q -m "Island test: measured on the phone ($(date '+%d %b %H:%M'))" -- \
  ISLAND-TEST.md island-test/results/island-log.csv island-test/results/summary.md island-test/results/run.log \
  && echo "committed: $(git rev-parse --short HEAD)"
