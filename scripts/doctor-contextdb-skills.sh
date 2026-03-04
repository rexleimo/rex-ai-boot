#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT="all"

usage() {
  cat <<USAGE
Usage:
  scripts/doctor-contextdb-skills.sh [--client <all|codex|claude>]

Options:
  --client <value>   Check codex, claude, or both (default: all)
  -h, --help         Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --client)
      CLIENT="${2:-}"
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

case "$CLIENT" in
  all|codex|claude) ;;
  *)
    echo "--client must be one of: all, codex, claude" >&2
    exit 1
    ;;
esac

normalize_home_dir() {
  local raw="$1"
  local fallback="$2"
  if [[ -z "$raw" ]]; then
    printf '%s\n' "$fallback"
    return 0
  fi
  if [[ "$raw" != /* ]]; then
    printf '%s\n' "$fallback"
    return 0
  fi
  printf '%s\n' "$raw"
}

check_client() {
  local client="$1"
  local source_root="$2"
  local target_root="$3"

  echo "$client target root: $target_root"

  if [[ ! -d "$source_root" ]]; then
    echo "[warn] $client source skills directory not found: $source_root"
    return 0
  fi

  local ok=0
  local warn=0

  local skill_dir=""
  for skill_dir in "$source_root"/*; do
    [[ -d "$skill_dir" ]] || continue

    local skill_name
    skill_name="$(basename "$skill_dir")"
    [[ "$skill_name" == .* ]] && continue
    [[ -f "$skill_dir/SKILL.md" ]] || continue

    local source_abs target_path
    source_abs="$(cd "$skill_dir" && pwd -P)"
    target_path="$target_root/$skill_name"

    if [[ -L "$target_path" ]] && [[ "$(readlink "$target_path")" == "$source_abs" ]]; then
      echo "[ok] $client: $skill_name linked"
      ok=$((ok + 1))
    elif [[ -e "$target_path" || -L "$target_path" ]]; then
      echo "[warn] $client: $skill_name exists but not linked to this repo"
      warn=$((warn + 1))
    else
      echo "[warn] $client: $skill_name not installed"
      warn=$((warn + 1))
    fi
  done

  echo "[summary] $client ok=$ok warn=$warn"
}

codex_home="$(normalize_home_dir "${CODEX_HOME:-}" "$HOME/.codex")"
claude_home="$(normalize_home_dir "${CLAUDE_HOME:-}" "$HOME/.claude")"

echo "ContextDB Skills Doctor"
echo "-----------------------"

if [[ "$CLIENT" == "all" || "$CLIENT" == "codex" ]]; then
  check_client "codex" "$ROOT_DIR/.codex/skills" "$codex_home/skills"
fi

if [[ "$CLIENT" == "all" || "$CLIENT" == "claude" ]]; then
  check_client "claude" "$ROOT_DIR/.claude/skills" "$claude_home/skills"
fi
