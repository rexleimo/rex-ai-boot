#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT="all"

usage() {
  cat <<USAGE
Usage:
  scripts/uninstall-contextdb-skills.sh [--client <all|codex|claude|gemini|opencode>]

Options:
  --client <value>   Uninstall skills for selected client(s) (default: all)
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
  all|codex|claude|gemini|opencode) ;;
  *)
    echo "--client must be one of: all, codex, claude, gemini, opencode" >&2
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

resolve_xdg_config_home() {
  local fallback="$HOME/.config"
  if [[ -n "${XDG_CONFIG_HOME:-}" ]] && [[ "$XDG_CONFIG_HOME" == /* ]]; then
    printf '%s\n' "$XDG_CONFIG_HOME"
    return 0
  fi
  printf '%s\n' "$fallback"
}

client_enabled() {
  local candidate="$1"
  [[ "$CLIENT" == "all" || "$CLIENT" == "$candidate" ]]
}

source_roots_for_client() {
  local client="$1"
  case "$client" in
    codex)
      printf '%s\n' "$ROOT_DIR/.codex/skills"
      ;;
    claude)
      printf '%s\n' "$ROOT_DIR/.claude/skills"
      ;;
    gemini)
      printf '%s\n' \
        "$ROOT_DIR/.gemini/skills" \
        "$ROOT_DIR/.agents/skills" \
        "$ROOT_DIR/.codex/skills" \
        "$ROOT_DIR/.claude/skills"
      ;;
    opencode)
      printf '%s\n' \
        "$ROOT_DIR/.opencode/skills" \
        "$ROOT_DIR/.agents/skills" \
        "$ROOT_DIR/.codex/skills" \
        "$ROOT_DIR/.claude/skills"
      ;;
  esac
}

collect_skill_entries() {
  local output_file="$1"
  local roots_text="$2"

  : > "$output_file"

  local root=""
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue
    [[ -d "$root" ]] || continue

    local skill_dir=""
    for skill_dir in "$root"/*; do
      [[ -d "$skill_dir" ]] || continue

      local skill_name
      skill_name="$(basename "$skill_dir")"
      [[ "$skill_name" == .* ]] && continue
      [[ -f "$skill_dir/SKILL.md" ]] || continue

      if awk -F'\t' -v name="$skill_name" '$1 == name { found = 1; exit } END { exit(found ? 0 : 1) }' "$output_file"; then
        continue
      fi

      local source_abs
      source_abs="$(cd "$skill_dir" && pwd -P)"
      printf '%s\t%s\n' "$skill_name" "$source_abs" >> "$output_file"
    done
  done <<< "$roots_text"
}

is_managed_link() {
  local target_path="$1"
  local source_abs="$2"

  if [[ ! -L "$target_path" ]]; then
    return 1
  fi

  local linked=""
  linked="$(readlink "$target_path" 2>/dev/null || true)"
  [[ -n "$linked" ]] || return 1

  if [[ "$linked" != /* ]]; then
    linked="$(cd "$(dirname "$target_path")" && cd "$linked" 2>/dev/null && pwd -P || true)"
  fi

  [[ "$linked" == "$source_abs" ]]
}

uninstall_for_client() {
  local client="$1"
  local target_root="$2"
  local roots_text="$3"

  local entries_file
  entries_file="$(mktemp)"
  collect_skill_entries "$entries_file" "$roots_text"

  local total_entries
  total_entries="$(wc -l < "$entries_file" | tr -d ' ')"
  if [[ "$total_entries" == "0" ]]; then
    echo "[warn] $client no skill sources found. Checked roots:"
    while IFS= read -r root; do
      [[ -n "$root" ]] || continue
      echo "  - $root"
    done <<< "$roots_text"
    rm -f "$entries_file"
    return 0
  fi

  local removed=0
  local skipped=0

  while IFS=$'\t' read -r skill_name source_abs; do
    [[ -n "$skill_name" ]] || continue

    local target_path="$target_root/$skill_name"

    if is_managed_link "$target_path" "$source_abs"; then
      rm -f "$target_path"
      echo "[remove] $client skill link removed: $skill_name"
      removed=$((removed + 1))
      continue
    fi

    if [[ -e "$target_path" || -L "$target_path" ]]; then
      echo "[skip] $client skill not managed by this repo: $skill_name"
      skipped=$((skipped + 1))
    fi
  done < "$entries_file"

  rm -f "$entries_file"
  echo "[done] $client skills -> removed=$removed skipped=$skipped"
}

xdg_config_home="$(resolve_xdg_config_home)"
codex_home="$(normalize_home_dir "${CODEX_HOME:-}" "$HOME/.codex")"
claude_home="$(normalize_home_dir "${CLAUDE_HOME:-}" "$HOME/.claude")"
gemini_home="$(normalize_home_dir "${GEMINI_HOME:-}" "$HOME/.gemini")"
opencode_home="$(normalize_home_dir "${OPENCODE_HOME:-}" "$xdg_config_home/opencode")"

if client_enabled "codex"; then
  uninstall_for_client "codex" "$codex_home/skills" "$(source_roots_for_client codex)"
fi

if client_enabled "claude"; then
  uninstall_for_client "claude" "$claude_home/skills" "$(source_roots_for_client claude)"
fi

if client_enabled "gemini"; then
  uninstall_for_client "gemini" "$gemini_home/skills" "$(source_roots_for_client gemini)"
fi

if client_enabled "opencode"; then
  uninstall_for_client "opencode" "$opencode_home/skills" "$(source_roots_for_client opencode)"
fi
