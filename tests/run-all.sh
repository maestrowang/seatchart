#!/usr/bin/env bash
# Runs every asserting test and prints a one-line-per-file summary.
#
# Only 58 of the 87 test_*.js files assert anything -- the other 29 are
# investigation scripts kept for their measurements, which print numbers but no
# verdict. Those are reported as "diag" here, not as failures.
#
# Usage:  bash tests/run-all.sh [name-filter]
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILTER="${1:-}"

[ -d "$REPO/tests/node_modules/jsdom" ] || { echo "Run 'bash tests/setup.sh' first." >&2; exit 1; }

cd "$REPO/tests"
pass=0; fail=0; diag=0; failed_files=()

for f in test_*.js; do
  [ -n "$FILTER" ] && [[ "$f" != *"$FILTER"* ]] && continue
  # Diagnostic scripts have no RESULT line at all; classify by source, not output,
  # so a genuine crash in an asserting test can't be mistaken for a diag script.
  if grep -q "RESULT:" "$f"; then
    line=$(timeout 300 node "$f" 2>/dev/null | grep -E '^RESULT:' | tail -1)
    case "$line" in
      "RESULT: PASS") pass=$((pass+1)); printf 'PASS  %s\n' "$f" ;;
      *)              fail=$((fail+1)); failed_files+=("$f")
                      printf 'FAIL  %s  %s\n' "$f" "${line:-(no RESULT - crashed?)}" ;;
    esac
  else
    diag=$((diag+1)); printf 'diag  %s\n' "$f"
  fi
done

echo "-----"
echo "pass: $pass  fail: $fail  diag: $diag"
if [ "$fail" -gt 0 ]; then
  printf 'failed:\n'; printf '  %s\n' "${failed_files[@]}"
  exit 1
fi
