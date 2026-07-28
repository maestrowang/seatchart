#!/usr/bin/env bash
# Prepares the fixture paths the test suite expects, then verifies they exist.
#
# The suite was written against a working directory of /home/claude and reads
# /home/claude/test.html plus a handful of /home/claude/*.json fixtures by
# absolute path. Those literals appear in 86 test files, so rather than rewrite
# them this script stages the files where the tests already look.
#
# Usage:  bash tests/setup.sh   (from anywhere; resolves the repo itself)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_HOME="${SEATCHART_FIXTURE_HOME:-/home/claude}"

if ! mkdir -p "$FIXTURE_HOME" 2>/dev/null; then
  echo "ERROR: cannot create $FIXTURE_HOME (permission denied)." >&2
  echo "Re-run with sudo, or point it somewhere writable:" >&2
  echo "  SEATCHART_FIXTURE_HOME=\$HOME/seatchart-fixtures bash tests/setup.sh" >&2
  echo "Note: the tests read /home/claude/... literally, so a custom location" >&2
  echo "only works if you also symlink /home/claude to it." >&2
  exit 1
fi

# The tests exercise the built app, so this must be a copy of index.html --
# not seating-chart-studio.html, which is the same file under its dev name.
cp "$REPO/index.html" "$FIXTURE_HOME/test.html"
cp "$REPO"/tests/*.json "$FIXTURE_HOME/"

if [ ! -d "$REPO/tests/node_modules" ]; then
  echo "Installing jsdom (the suite's only dependency)..."
  (cd "$REPO/tests" && npm install --silent)
fi

# Fail loudly here rather than as a confusing ENOENT inside every test.
missing=0
for f in test.html row6_bug2.json latest_upload.json string_orch.json \
         row6_bug.json bass_case.json Symphony_Orchestra_test__seatchart.json; do
  [ -f "$FIXTURE_HOME/$f" ] || { echo "MISSING: $FIXTURE_HOME/$f" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || { echo "Setup incomplete." >&2; exit 1; }

echo "Setup complete. Fixtures staged in $FIXTURE_HOME."
echo "Run the suite with:  bash tests/run-all.sh"
