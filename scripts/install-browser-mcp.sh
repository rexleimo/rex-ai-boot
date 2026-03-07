#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_DIR="$ROOT_DIR/mcp-server"
DIST_ENTRY="$MCP_DIR/dist/index.js"

DRY_RUN="false"
SKIP_PLAYWRIGHT_INSTALL="false"

usage() {
  cat <<'USAGE'
Usage:
  scripts/install-browser-mcp.sh [--dry-run] [--skip-playwright-install]

What it does:
  1) Install mcp-server dependencies
  2) Install Playwright Chromium runtime
  3) Build mcp-server
  4) Print MCP config snippet with absolute dist/index.js path
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --skip-playwright-install)
      SKIP_PLAYWRIGHT_INSTALL="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      usage
      exit 1
      ;;
  esac
done

run_in_mcp() {
  local cmd=("$@")
  echo "+ (cd $MCP_DIR && ${cmd[*]})"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  (
    cd "$MCP_DIR"
    "${cmd[@]}"
  )
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
}

if [[ ! -d "$MCP_DIR" ]]; then
  echo "mcp-server directory not found: $MCP_DIR"
  exit 1
fi

require_cmd node
require_cmd npm
require_cmd npx

run_in_mcp npm install

if [[ "$SKIP_PLAYWRIGHT_INSTALL" != "true" ]]; then
  run_in_mcp npx playwright install chromium
fi

run_in_mcp npm run build

if [[ "$DRY_RUN" == "true" ]]; then
  DIST_PATH="<ABSOLUTE_PATH_TO_REPO>/mcp-server/dist/index.js"
else
  if [[ ! -f "$DIST_ENTRY" ]]; then
    echo "Build completed but dist entry missing: $DIST_ENTRY"
    exit 1
  fi
  DIST_PATH="$(cd "$(dirname "$DIST_ENTRY")" && pwd)/$(basename "$DIST_ENTRY")"
fi

cat <<SNIPPET

Done. Add this MCP server block to your client config:

{
  "mcpServers": {
    "playwright-browser-mcp": {
      "command": "node",
      "args": ["$DIST_PATH"]
    }
  }
}

Next:
1) Restart your CLI client.
2) Run: scripts/doctor-browser-mcp.sh
3) In chat, smoke test:
   - browser_launch {"profile":"default","visible":true}
   - browser_navigate {"url":"https://example.com"}
   - browser_snapshot {"profile":"default"}
   - Read pageSummary/regions/elements first
   - Only if visualHints.needsVisualFallback=true: browser_screenshot {"profile":"default","selector":"<target>"}
   - browser_close {}
SNIPPET
