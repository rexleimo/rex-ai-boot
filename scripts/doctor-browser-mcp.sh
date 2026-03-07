#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_DIR="$ROOT_DIR/mcp-server"
DIST_ENTRY="$MCP_DIR/dist/index.js"
PROFILE_CONFIG="$ROOT_DIR/config/browser-profiles.json"

ERR_COUNT=0
WARN_COUNT=0

ok() {
  echo "OK   $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo "WARN $*"
}

err() {
  ERR_COUNT=$((ERR_COUNT + 1))
  echo "ERR  $*"
}

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "command exists: $cmd"
  else
    err "missing command: $cmd"
  fi
}

check_port_open() {
  local port="$1"
  if command -v nc >/dev/null 2>&1; then
    if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi

  if command -v lsof >/dev/null 2>&1; then
    if lsof -n -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi

  return 2
}

echo "Browser MCP Doctor"
echo "Repo: $ROOT_DIR"

echo
echo "[1/6] Command checks"
check_cmd node
check_cmd npm
check_cmd npx

# Advisory: Playwright + our build scripts expect a modern Node runtime.
NODE_VERSION=""
set +e
NODE_VERSION="$(node -p "process.versions.node" 2>/dev/null)"
NODE_STATUS=$?
set -e
if [[ $NODE_STATUS -eq 0 && -n "$NODE_VERSION" ]]; then
  NODE_MAJOR="${NODE_VERSION%%.*}"
  if [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && (( NODE_MAJOR < 20 )); then
    warn "node version is $NODE_VERSION (recommended: >= 20)"
  fi
fi

echo
echo "[2/6] mcp-server files"
if [[ -f "$MCP_DIR/package.json" ]]; then
  ok "mcp-server/package.json found"
else
  err "missing mcp-server/package.json"
fi

if [[ -d "$MCP_DIR/node_modules" ]]; then
  ok "mcp-server/node_modules found"
else
  err "node_modules missing. Run: (cd mcp-server && npm install)"
fi

if [[ -f "$DIST_ENTRY" ]]; then
  ok "build artifact found: mcp-server/dist/index.js"
else
  err "build artifact missing. Run: (cd mcp-server && npm run build)"
fi

echo
echo "[3/6] Playwright runtime"
PLAYWRIGHT_PATH=""
set +e
PLAYWRIGHT_PATH="$(cd "$MCP_DIR" && node -e "process.stdout.write(require('playwright').chromium.executablePath())" 2>/dev/null)"
PW_STATUS=$?
set -e

if [[ $PW_STATUS -ne 0 ]]; then
  err "cannot resolve Playwright chromium path. Run: (cd mcp-server && npm install)"
else
  if [[ -n "$PLAYWRIGHT_PATH" && -x "$PLAYWRIGHT_PATH" ]]; then
    ok "Playwright chromium executable found"
  else
    warn "Playwright chromium executable not installed. Run: (cd mcp-server && npx playwright install chromium)"
  fi
fi

echo
echo "[4/6] profile config"
if [[ -f "$PROFILE_CONFIG" ]]; then
  ok "profile config found: config/browser-profiles.json"
else
  err "profile config missing: config/browser-profiles.json"
fi

DEFAULT_HAS_CDP=""
DEFAULT_CDP_PORT=""
DEFAULT_CDP_URL=""
DEFAULT_EXEC_PATH=""
DEFAULT_USER_DATA_DIR=""

if [[ -f "$PROFILE_CONFIG" ]]; then
  set +e
  PROFILE_DATA="$(node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const p=(c.profiles&&c.profiles.default)||{}; const out=[(p.cdpPort?1:0), (p.cdpPort||''), (p.cdpUrl||''), (p.executablePath||''), (p.userDataDir||'')].join('\\n'); process.stdout.write(out);" "$PROFILE_CONFIG" 2>/dev/null)"
  PROFILE_STATUS=$?
  set -e

  if [[ $PROFILE_STATUS -ne 0 ]]; then
    err "profile config is not valid JSON"
  else
    DEFAULT_HAS_CDP="$(printf '%s' "$PROFILE_DATA" | sed -n '1p')"
    DEFAULT_CDP_PORT="$(printf '%s' "$PROFILE_DATA" | sed -n '2p')"
    DEFAULT_CDP_URL="$(printf '%s' "$PROFILE_DATA" | sed -n '3p')"
    DEFAULT_EXEC_PATH="$(printf '%s' "$PROFILE_DATA" | sed -n '4p')"
    DEFAULT_USER_DATA_DIR="$(printf '%s' "$PROFILE_DATA" | sed -n '5p')"

    if [[ -n "$DEFAULT_EXEC_PATH" ]]; then
      if [[ -x "$DEFAULT_EXEC_PATH" ]]; then
        ok "default executablePath is executable"
      else
        warn "default executablePath does not exist or is not executable: $DEFAULT_EXEC_PATH"
      fi
    fi

    if [[ -n "$DEFAULT_USER_DATA_DIR" ]]; then
      ok "default userDataDir set: $DEFAULT_USER_DATA_DIR"
    fi
  fi
fi

echo
echo "[5/6] default profile mode"
if [[ "$DEFAULT_HAS_CDP" == "1" ]]; then
  if [[ -n "$DEFAULT_CDP_URL" ]]; then
    ok "default profile uses cdpUrl: $DEFAULT_CDP_URL"
  elif [[ -n "$DEFAULT_CDP_PORT" ]]; then
    PORT_CHECK=2
    if [[ "$DEFAULT_CDP_PORT" =~ ^[0-9]+$ ]]; then
      set +e
      check_port_open "$DEFAULT_CDP_PORT"
      PORT_CHECK=$?
      set -e
      if [[ $PORT_CHECK -eq 0 ]]; then
        ok "default CDP port is reachable: $DEFAULT_CDP_PORT"
      elif [[ $PORT_CHECK -eq 1 ]]; then
        warn "default CDP port is not reachable: $DEFAULT_CDP_PORT (profile=default will auto-fallback to local launch)"
      else
        warn "cannot verify CDP port reachability (install nc or lsof to enable check)"
      fi
    else
      warn "default cdpPort is invalid: $DEFAULT_CDP_PORT"
    fi
  fi
else
  ok "default profile uses local launch mode (no CDP dependency)"
fi

echo
echo "[6/6] quick next steps"
echo "- If ERR exists: run install script first"
echo "  scripts/install-browser-mcp.sh"
echo "- Then smoke test in client chat: browser_launch -> browser_navigate -> browser_snapshot"
echo "  Read pageSummary/regions/elements first; use browser_screenshot(selector) only for visual fallback"
echo "  Finally browser_close"

echo
if [[ $ERR_COUNT -gt 0 ]]; then
  echo "Result: FAILED ($ERR_COUNT errors, $WARN_COUNT warnings)"
  exit 1
fi

echo "Result: OK ($WARN_COUNT warnings)"
exit 0
