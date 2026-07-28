#!/usr/bin/env bash
# Runs the DOM-free design suites and turns their printed verdict into an exit
# code.
#
# properties.test.js and fuzz.test.js print "RESULT: PASS" or "RESULT: FAIL"
# but never call process.exit, so they exit 0 even when they fail. Invoking
# them directly from CI would be a gate that cannot go red -- hence this
# wrapper. Kept out of the suites themselves so they stay as handed off.
#
# Usage:  bash design/run-all.sh
set -uo pipefail

DESIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DESIGN"

fail=0
for f in properties.test.js fuzz.test.js; do
  echo "--- $f"
  out=$(node "$f" 2>&1) || { echo "$out"; echo "FAIL  $f (crashed)"; fail=1; continue; }
  # Echo the measurements; they're the point of these suites.
  echo "$out" | grep -E '^(Total:|Scenario|Style)' || true
  verdict=$(echo "$out" | grep -E '^RESULT:' | tail -1)
  case "$verdict" in
    "RESULT: PASS") echo "PASS  $f" ;;
    *)              echo "FAIL  $f  ${verdict:-(no RESULT printed)}"; fail=1 ;;
  esac
done

echo "-----"
if [ "$fail" -ne 0 ]; then echo "design suites: FAIL"; exit 1; fi
echo "design suites: PASS"
