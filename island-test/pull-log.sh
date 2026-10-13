#!/bin/bash
# Copy the phone's island-log.csv to results/ (after a cancelled run, for instance).
#   bash island-test/pull-log.sh [name]      -> results/island-log[-name].csv
HERE="$(cd "$(dirname "$0")" && pwd)"
DEVICE="$(xcrun devicectl list devices 2>/dev/null \
  | awk '($0 ~ /connected/ || $0 ~ /available/) && $0 !~ /unavailable/ { for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/) print $i }' | head -1)"
[ -n "$DEVICE" ] || { echo "No phone found."; exit 1; }
OUT="$HERE/results/island-log${1:+-$1}.csv"
xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier com.ttstv.frank.islandtest --source Documents/island-log.csv --destination "$OUT" >/dev/null && echo "copied to $OUT" && grep -vE "^[0-9]+,alive" "$OUT" | tail -30
