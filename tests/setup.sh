#!/usr/bin/env bash
# Installs the test suite's only dependency.
#
# There is no fixture-staging step any more: tests resolve the app as
# ../index.html and their fixtures as siblings, both from __dirname.
#
# Usage:  bash tests/setup.sh   (from anywhere; resolves the repo itself)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ -f "$REPO/index.html" ] || { echo "ERROR: $REPO/index.html not found." >&2; exit 1; }

if [ -d "$REPO/tests/node_modules/jsdom" ]; then
  echo "jsdom already installed."
else
  echo "Installing jsdom..."
  (cd "$REPO/tests" && npm install --silent)
fi

echo "Setup complete."
echo "Run the suite with:  bash tests/run-all.sh"
