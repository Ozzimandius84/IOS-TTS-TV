#!/bin/bash
# Island Test -- double-click (or open from Finder) to run island-test/run.sh in Terminal.
cd "$(dirname "$0")/.." || exit 1
exec bash island-test/run.sh "$@"
