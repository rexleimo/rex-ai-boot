#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

STRICT="false"
GLOBAL_SECURITY="false"

usage() {
  cat <<USAGE
Usage:
  scripts/verify-aios.sh [--strict] [--global-security]

Options:
  --strict            Fail if actionable warnings are detected
  --global-security   Also scan small allowlisted global config files
  -h, --help          Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      STRICT="true"
      shift
      ;;
    --global-security)
      GLOBAL_SECURITY="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

run() {
  echo "+ $*"
  "$@"
}

effective_warns=0

count_effective_warns() {
  local text="$1"
  local warn_lines
  warn_lines="$(printf '%s\n' "$text" | grep -E '^\[warn\]' || true)"
  if [[ -z "$warn_lines" ]]; then
    printf '%s' "0"
    return 0
  fi

  # Missing clients are not actionable for everyone.
  local filtered
  filtered="$(printf '%s\n' "$warn_lines" | grep -Ev '^\[warn\] (codex|claude|gemini) not found in PATH$' || true)"
  if [[ -z "$filtered" ]]; then
    printf '%s' "0"
    return 0
  fi

  printf '%s\n' "$filtered" | wc -l | tr -d ' '
}

run_doctor() {
  local label="$1"
  shift

  echo ""
  echo "== $label =="

  local output=""
  set +e
  output="$("$@" 2>&1 | tee /dev/stderr)"
  local status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    echo "[fail] $label exited non-zero ($status)" >&2
    exit $status
  fi

  local eff
  eff="$(count_effective_warns "$output")"
  if [[ "$eff" != "0" ]]; then
    effective_warns=$((effective_warns + eff))
  fi
}

echo "AIOS Verify"
echo "-----------"
echo "Repo: $ROOT_DIR"
echo "Strict: $STRICT"

if [[ -x "$SCRIPT_DIR/doctor-contextdb-shell.sh" ]]; then
  run_doctor "doctor-contextdb-shell" "$SCRIPT_DIR/doctor-contextdb-shell.sh"
fi

if [[ -x "$SCRIPT_DIR/doctor-contextdb-skills.sh" ]]; then
  run_doctor "doctor-contextdb-skills" "$SCRIPT_DIR/doctor-contextdb-skills.sh" --client all
fi

if [[ -x "$SCRIPT_DIR/doctor-superpowers.sh" ]]; then
  run_doctor "doctor-superpowers" "$SCRIPT_DIR/doctor-superpowers.sh"
fi

if [[ -x "$SCRIPT_DIR/doctor-security-config.sh" ]]; then
  security_args=()
  if [[ "$GLOBAL_SECURITY" == "true" ]]; then
    security_args+=(--global)
  fi
  if [[ "$STRICT" == "true" ]]; then
    security_args+=(--strict)
  fi
  if [[ "${#security_args[@]}" -gt 0 ]]; then
    run_doctor "doctor-security-config" "$SCRIPT_DIR/doctor-security-config.sh" "${security_args[@]}"
  else
    run_doctor "doctor-security-config" "$SCRIPT_DIR/doctor-security-config.sh"
  fi
fi

if [[ -x "$SCRIPT_DIR/doctor-bootstrap-task.sh" ]]; then
  run_doctor "doctor-bootstrap-task" "$SCRIPT_DIR/doctor-bootstrap-task.sh" --workspace "$ROOT_DIR"
fi

if [[ -x "$SCRIPT_DIR/doctor-browser-mcp.sh" ]]; then
  echo ""
  echo "== doctor-browser-mcp =="
  run "$SCRIPT_DIR/doctor-browser-mcp.sh" || true
fi

echo ""
echo "== mcp-server build =="
if [[ -d "$ROOT_DIR/mcp-server" ]]; then
  if command -v npm >/dev/null 2>&1; then
    (cd "$ROOT_DIR/mcp-server" && run npm run typecheck && run npm run build)
  else
    echo "[warn] npm not found; skipping mcp-server build"
    effective_warns=$((effective_warns + 1))
  fi
else
  echo "[warn] missing mcp-server directory; skipping"
  effective_warns=$((effective_warns + 1))
fi

echo ""
echo "[summary] effective_warn=$effective_warns"
if [[ "$STRICT" == "true" && "$effective_warns" -gt 0 ]]; then
  echo "[fail] strict mode: warnings found" >&2
  exit 1
fi

echo "[ok] verify-aios complete"
