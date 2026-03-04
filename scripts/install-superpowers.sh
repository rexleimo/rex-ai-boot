#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/obra/superpowers.git"
DO_UPDATE="false"
FORCE="false"

usage() {
  cat <<USAGE
Usage:
  scripts/install-superpowers.sh [--repo <url>] [--update] [--force]

Options:
  --repo <url>    Superpowers git repository URL (default: https://github.com/obra/superpowers.git)
  --update        If repo already exists, run git pull --ff-only
  --force         Replace conflicting existing directory/link targets
  -h, --help      Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --update)
      DO_UPDATE="true"
      shift
      ;;
    --force)
      FORCE="true"
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

warn_if_relative_env() {
  local env_name="$1"
  local fallback="$2"
  local raw="${!env_name:-}"
  if [[ -n "$raw" ]] && [[ "$raw" != /* ]]; then
    echo "[warn] $env_name is relative ($raw); using $fallback"
  fi
}

resolve_link_target() {
  local target_path="$1"
  local linked
  linked="$(readlink "$target_path" 2>/dev/null || true)"
  [[ -n "$linked" ]] || return 1
  if [[ "$linked" != /* ]]; then
    linked="$(cd "$(dirname "$target_path")" && cd "$linked" 2>/dev/null && pwd -P || true)"
  fi
  [[ -n "$linked" ]] || return 1
  printf '%s\n' "$linked"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd git

codex_home="$(normalize_home_dir "${CODEX_HOME:-}" "$HOME/.codex")"
agents_home="$(normalize_home_dir "${AGENTS_HOME:-}" "$HOME/.agents")"
warn_if_relative_env "CODEX_HOME" "$codex_home"
warn_if_relative_env "AGENTS_HOME" "$agents_home"

superpowers_dir="$codex_home/superpowers"
skills_source="$superpowers_dir/skills"
skills_target="$agents_home/skills/superpowers"

if [[ -d "$superpowers_dir/.git" ]]; then
  echo "[ok] superpowers repo found: $superpowers_dir"
  if [[ "$DO_UPDATE" == "true" ]]; then
    echo "+ git -C \"$superpowers_dir\" pull --ff-only"
    git -C "$superpowers_dir" pull --ff-only
  fi
elif [[ -e "$superpowers_dir" ]]; then
  if [[ "$FORCE" == "true" ]]; then
    echo "[warn] replacing non-repo path: $superpowers_dir"
    rm -rf "$superpowers_dir"
    mkdir -p "$(dirname "$superpowers_dir")"
    echo "+ git clone \"$REPO_URL\" \"$superpowers_dir\""
    git clone "$REPO_URL" "$superpowers_dir"
  else
    echo "[err] path exists but is not a git repo: $superpowers_dir" >&2
    echo "      rerun with --force to replace it." >&2
    exit 1
  fi
else
  mkdir -p "$(dirname "$superpowers_dir")"
  echo "+ git clone \"$REPO_URL\" \"$superpowers_dir\""
  git clone "$REPO_URL" "$superpowers_dir"
fi

if [[ ! -d "$skills_source" ]]; then
  echo "[err] missing skills directory in repo: $skills_source" >&2
  exit 1
fi

mkdir -p "$(dirname "$skills_target")"

if [[ -L "$skills_target" ]]; then
  linked="$(resolve_link_target "$skills_target" || true)"
  if [[ "$linked" == "$skills_source" ]]; then
    echo "[ok] superpowers link already configured: $skills_target"
  else
    if [[ "$FORCE" == "true" ]]; then
      rm -f "$skills_target"
      ln -s "$skills_source" "$skills_target"
      echo "[link] replaced superpowers link: $skills_target -> $skills_source"
    else
      echo "[err] superpowers link points elsewhere: $skills_target -> ${linked:-<unknown>}" >&2
      echo "      rerun with --force to replace it." >&2
      exit 1
    fi
  fi
elif [[ -e "$skills_target" ]]; then
  if [[ "$FORCE" == "true" ]]; then
    rm -rf "$skills_target"
    ln -s "$skills_source" "$skills_target"
    echo "[link] replaced existing path with superpowers link: $skills_target -> $skills_source"
  else
    echo "[err] existing path blocks superpowers link: $skills_target" >&2
    echo "      rerun with --force to replace it." >&2
    exit 1
  fi
else
  ln -s "$skills_source" "$skills_target"
  echo "[link] superpowers linked: $skills_target -> $skills_source"
fi

echo "[done] superpowers install complete"
