#!/bin/bash
# Island Test -- build, install, run on the iPhone while the Mac records the
# phone's screen over the cable, pull the log, write the results into
# ISLAND-TEST.md and commit them (by paths).
#
#   bash island-test/run.sh          run 5: words shown by the island's own switches (~4 min)
#   bash island-test/run.sh clock    run 4: the island's own clock in the counting font (~6 min)
#   bash island-test/run.sh rates    runs 1-3: words sent at 1-4 a second (~7 min)
#
# The phone must be plugged in BY CABLE and UNLOCKED. When it says so, swipe
# up to the home screen and leave the phone alone; don't tap the island.
set -uo pipefail
MODE="${1:-words}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
BID=com.ttstv.frank.islandtest
RES="$HERE/results"
mkdir -p "$RES" "$HERE/build"
exec > >(tee "$RES/run.log") 2>&1
say() { printf '\n== %s ==\n' "$*"; }

command -v xcodegen >/dev/null || { echo "no xcodegen -- brew install xcodegen"; exit 1; }

DEVICE="$(xcrun devicectl list devices 2>/dev/null \
  | awk '($0 ~ /connected/ || $0 ~ /available/) && $0 !~ /unavailable/ { for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/) print $i }' | head -1)"
[ -n "$DEVICE" ] || { echo "No phone found. Plug it in, unlock it, run again."; xcrun devicectl list devices; exit 1; }
echo "phone: $DEVICE"

say "1/6 xcodegen"
( cd "$HERE" && xcodegen generate ) || exit 1

say "2/6 build the test app (signed with the same personal team as Frank)"
( cd "$HERE" && xcodebuild -project islandtest.xcodeproj -scheme IslandTest -configuration Debug \
    -destination "id=$DEVICE" -derivedDataPath build \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration build ) > "$RES/build.log" 2>&1
APP="$HERE/build/Build/Products/Debug-iphoneos/IslandTest.app"
if [ ! -d "$APP" ]; then echo "build failed -- last lines of results/build.log:"; grep -E "error:|BUILD FAILED" "$RES/build.log" | tail -20; exit 1; fi
echo "built"

say "3/6 build the Mac screen recorder"
xcrun swiftc -O -swift-version 5 "$HERE/recorder/record.swift" -o "$HERE/build/record" > "$RES/record-build.log" 2>&1 \
  || { echo "recorder did not build:"; grep -E "error" "$RES/record-build.log" | head -10; exit 1; }
echo "built"

say "4/6 install, start recording the phone's screen, open the app"
xcrun devicectl device install app --device "$DEVICE" "$APP" || exit 1
rm -rf "$RES/screen"; mkdir -p "$RES/screen"
"$HERE/build/record" "$RES/screen" 600 > "$RES/screen/record.log" 2>&1 &
REC=$!
echo "  (if the Mac asks whether Terminal may use the Camera, click Allow -- it is the phone's screen feed)"
for i in $(seq 1 90); do
  sleep 1
  grep -q "recording" "$RES/screen/record.log" 2>/dev/null && break
  kill -0 $REC 2>/dev/null || break
done
cat "$RES/screen/record.log"
grep -q "recording" "$RES/screen/record.log" || { echo "the screen recorder did not start -- stopping here (see the line above)"; kill $REC 2>/dev/null; exit 1; }
if [ "$MODE" != words ]; then
  xcrun devicectl device process launch --device "$DEVICE" --terminate-existing "$BID" "$MODE" || { kill $REC; exit 1; }
else
  xcrun devicectl device process launch --device "$DEVICE" --terminate-existing "$BID" || { kill $REC; exit 1; }
fi

echo
if [ "$MODE" = words ]; then
  echo "  >>> ON THE PHONE NOW: swipe up to the home screen STRAIGHT AWAY and watch the island for 1 minute. <<<"
  echo "      The words start 20 s after the app opened and run for 30 s."
else
  echo "  >>> ON THE PHONE NOW: swipe up to the home screen and leave it alone for about 3 minutes. <<<"
fi
echo "      Don't tap the island -- it opens the app."
echo

say "5/6 waiting for the run to finish"
TMP="$(mktemp -d)"
for i in $(seq 1 54); do       # up to 9 minutes
  sleep 10
  if xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
       --domain-identifier "$BID" --source Documents/island-done.txt --destination "$TMP/done" >/dev/null 2>&1; then
    echo "finished after ~$((i*10)) s"; break
  fi
  [ $((i % 3)) -eq 0 ] && echo "  ...$((i*10)) s"
done
kill $REC 2>/dev/null; wait $REC 2>/dev/null
xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier "$BID" --source Documents/island-log.csv --destination "$RES/island-log.csv" \
  || { echo "could not copy the log from the phone"; exit 1; }
[ -f "$TMP/done" ] || echo "WARNING: the run had not finished; results are partial"
echo "screen frames: $(($(wc -l < "$RES/screen/screen.csv") - 1)), island pictures: $(ls "$RES/screen/frames" | wc -l | tr -d ' ')"

say "6/6 results"
python3 "$HERE/analyze.py" "$RES/island-log.csv" "$RES/screen/screen.csv" > "$RES/summary.md" || exit 1
cat "$RES/summary.md"

{ echo; echo "### Run on the phone, screen recorded — $(date '+%d %b %Y %H:%M')"; echo; cat "$RES/summary.md"; } >> "$REPO/ISLAND-TEST.md"
cd "$REPO"
P="ISLAND-TEST.md island-test/results/island-log.csv island-test/results/summary.md island-test/results/run.log island-test/results/screen/screen.csv island-test/results/screen/info.txt island-test/results/screen/full-start.png"
for f in $P; do [ -e "$f" ] && git add -- "$f"; done
git commit -q -m "Island test: measured on the phone with the screen recorded ($(date '+%d %b %H:%M'))" -- $(for f in $P; do [ -e "$f" ] && echo "$f"; done) \
  && echo "committed: $(git rev-parse --short HEAD)"
