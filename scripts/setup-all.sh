#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENTS="browser,shell,skills"
WRAP_MODE="opt-in"
SKILL_CLIENT="all"
SKIP_PLAYWRIGHT_INSTALL="false"
SKIP_DOCTOR="false"

usage() {
  cat <<USAGE
Usage:
  scripts/setup-all.sh [options]

Options:
  --components <list>            Comma list: browser,shell,skills (default: all)
  --mode <all|repo-only|opt-in|off>
                                 Wrapper mode passed to install-contextdb-shell.sh
  --client <all|codex|claude|gemini|opencode>
                                 Skills target clients (default: all)
  --skip-playwright-install      Skip playwright runtime install for browser MCP
  --skip-doctor                  Skip doctor scripts
  -h, --help                     Show this help

Examples:
  scripts/setup-all.sh
  scripts/setup-all.sh --components shell,skills --mode opt-in
  scripts/setup-all.sh --components browser --skip-playwright-install
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --components)
      COMPONENTS="${2:-}"
      shift 2
      ;;
    --mode)
      WRAP_MODE="${2:-}"
      shift 2
      ;;
    --client)
      SKILL_CLIENT="${2:-}"
      shift 2
      ;;
    --skip-playwright-install)
      SKIP_PLAYWRIGHT_INSTALL="true"
      shift
      ;;
    --skip-doctor)
      SKIP_DOCTOR="true"
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

case "$WRAP_MODE" in
  all|repo-only|opt-in|off) ;;
  *)
    echo "--mode must be one of: all, repo-only, opt-in, off" >&2
    exit 1
    ;;
esac

case "$SKILL_CLIENT" in
  all|codex|claude|gemini|opencode) ;;
  *)
    echo "--client must be one of: all, codex, claude, gemini, opencode" >&2
    exit 1
    ;;
esac

COMPONENTS="$(printf '%s' "$COMPONENTS" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
IFS=',' read -r -a COMPONENT_LIST <<< "$COMPONENTS"

has_component() {
  local needle="$1"
  local item
  for item in "${COMPONENT_LIST[@]}"; do
    [[ -n "$item" ]] || continue
    if [[ "$item" == "$needle" || "$item" == "all" ]]; then
      return 0
    fi
  done
  return 1
}

validate_components() {
  local item
  for item in "${COMPONENT_LIST[@]}"; do
    [[ -n "$item" ]] || continue
    case "$item" in
      all|browser|shell|skills) ;;
      *)
        echo "Unsupported component: $item" >&2
        echo "Allowed: browser,shell,skills (or all)" >&2
        exit 1
        ;;
    esac
  done
}

run_script() {
  echo "+ $*"
  "$@"
}

validate_components

echo "Setup components: $COMPONENTS"

if has_component browser; then
  browser_args=()
  if [[ "$SKIP_PLAYWRIGHT_INSTALL" == "true" ]]; then
    browser_args+=(--skip-playwright-install)
  fi
  run_script "$SCRIPT_DIR/install-browser-mcp.sh" "${browser_args[@]}"
  if [[ "$SKIP_DOCTOR" != "true" ]]; then
    run_script "$SCRIPT_DIR/doctor-browser-mcp.sh"
  fi
fi

if has_component shell; then
  run_script "$SCRIPT_DIR/install-contextdb-shell.sh" --mode "$WRAP_MODE"
  if [[ "$SKIP_DOCTOR" != "true" ]]; then
    run_script "$SCRIPT_DIR/doctor-contextdb-shell.sh"
  fi
fi

if has_component skills; then
  run_script "$SCRIPT_DIR/install-contextdb-skills.sh" --client "$SKILL_CLIENT"
  if [[ "$SKIP_DOCTOR" != "true" ]]; then
    run_script "$SCRIPT_DIR/doctor-contextdb-skills.sh" --client "$SKILL_CLIENT"
  fi
fi

if has_component shell; then
  echo ""
  echo "Run: source ~/.zshrc"
  echo "Then: aios doctor"
fi

echo "Done."
