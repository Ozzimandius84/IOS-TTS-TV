#!/bin/bash
# Pull the phone's own system log for the last N minutes (needs the Mac password
# once, for sudo) and keep only the lines about the island test: memory kills,
# crashes, and what Live Activities said about our widget.
#   bash island-test/phone-log.sh [minutes, default 15]
HERE="$(cd "$(dirname "$0")" && pwd)"
MIN="${1:-15}"
OUT="$HERE/results/phone-$(date +%H%M).logarchive"
echo "collecting the phone's log for the last $MIN min (asks for your Mac password once)..."
sudo log collect --device --last "${MIN}m" --output "$OUT" || { echo "log collect failed -- is the phone plugged in and unlocked?"; exit 1; }
sudo chown -R "$(id -un)" "$OUT"
log show "$OUT" --info --style compact \
  --predicate '(process CONTAINS "IslandWidget") OR (process CONTAINS "IslandTest") OR (eventMessage CONTAINS "islandtest") OR (eventMessage CONTAINS "IslandWidget") OR (eventMessage CONTAINS[c] "jetsam") OR (process == "liveactivitiesd") OR (process == "chronod" AND eventMessage CONTAINS[c] "activity")' \
  > "$HERE/results/phone-log.txt" 2>&1
echo "wrote results/phone-log.txt ($(wc -l < "$HERE/results/phone-log.txt") lines). The lines that matter:"
grep -iE "jetsam|memory|killed|crash|exceed|budget|dismiss|invalidat|terminat|too (large|many)|timeout|timed out" "$HERE/results/phone-log.txt" | tail -40
