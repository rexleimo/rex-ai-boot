#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "[warn] node not found; cannot run security config doctor"
  exit 0
fi

echo "+ node \"$SCRIPT_DIR/doctor-security-config.mjs\" $*"
node "$SCRIPT_DIR/doctor-security-config.mjs" "$@"

