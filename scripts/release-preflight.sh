#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/VERSION"
CHANGELOG_FILE="$ROOT_DIR/CHANGELOG.md"

usage() {
  cat <<'EOF'
Usage:
  scripts/release-preflight.sh --tag vX.Y.Z

Validates:
  - tag format is vX.Y.Z
  - VERSION matches X.Y.Z
  - CHANGELOG.md contains ## [X.Y.Z] - YYYY-MM-DD
EOF
}

TAG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "--tag is required" >&2
  usage >&2
  exit 1
fi

if [[ ! "$TAG" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "tag must match vX.Y.Z: $TAG" >&2
  exit 1
fi

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "missing VERSION file: $VERSION_FILE" >&2
  exit 1
fi
if [[ ! -f "$CHANGELOG_FILE" ]]; then
  echo "missing CHANGELOG file: $CHANGELOG_FILE" >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
EXPECTED_VERSION="${TAG#v}"

if [[ "$VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "VERSION mismatch: tag=$TAG VERSION=$VERSION" >&2
  exit 1
fi

if ! grep -Eq "^## \\[$EXPECTED_VERSION\\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$" "$CHANGELOG_FILE"; then
  echo "changelog missing matching release heading for $EXPECTED_VERSION" >&2
  exit 1
fi

echo "[ok] release preflight passed for $TAG"
echo "  VERSION:   $VERSION"
echo "  CHANGELOG: has ## [$EXPECTED_VERSION] - YYYY-MM-DD"
