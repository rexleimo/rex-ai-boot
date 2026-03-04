#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENTS="shell,skills"
SKILL_CLIENT="all"

usage() {
  cat <<USAGE
Usage:
  scripts/uninstall-all.sh [options]

Options:
  --components <list>          Comma list: shell,skills,browser (default: shell,skills)
  --client <all|codex|claude|gemini|opencode>
                               Skills target clients (default: all)
  -h, --help                   Show this help

Notes:
  browser component has no destructive auto-uninstall by default.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --components)
      COMPONENTS="${2:-}"
      shift 2
      ;;
    --client)
      SKILL_CLIENT="${2:-}"
      shift 2
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

echo "Uninstall components: $COMPONENTS"

if has_component shell; then
  run_script "$SCRIPT_DIR/uninstall-contextdb-shell.sh"
fi

if has_component skills; then
  run_script "$SCRIPT_DIR/uninstall-contextdb-skills.sh" --client "$SKILL_CLIENT"
fi

if has_component browser; then
  echo "[info] Browser MCP has no destructive auto-uninstall script."
  echo "[info] It is safe to keep mcp-server build/runtime artifacts."
  echo "[info] For manual cleanup, remove mcp-server/node_modules and mcp-server/dist if needed."
fi

if has_component shell; then
  echo ""
  echo "Run: source ~/.zshrc"
fi

echo "Done."
