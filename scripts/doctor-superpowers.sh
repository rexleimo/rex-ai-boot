#!/usr/bin/env bash
set -euo pipefail

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

echo "Superpowers Doctor"
echo "------------------"

if command -v git >/dev/null 2>&1; then
  ok "command exists: git"
else
  err "missing command: git"
fi

codex_home="$(normalize_home_dir "${CODEX_HOME:-}" "$HOME/.codex")"
agents_home="$(normalize_home_dir "${AGENTS_HOME:-}" "$HOME/.agents")"

superpowers_dir="$codex_home/superpowers"
skills_source="$superpowers_dir/skills"
skills_target="$agents_home/skills/superpowers"

echo "codex_home: $codex_home"
echo "agents_home: $agents_home"
echo "superpowers_dir: $superpowers_dir"

if [[ -d "$superpowers_dir/.git" ]]; then
  ok "superpowers git repo found"
  remote_url="$(git -C "$superpowers_dir" config --get remote.origin.url 2>/dev/null || true)"
  [[ -n "$remote_url" ]] && ok "origin: $remote_url" || warn "origin URL is not configured"
  head_sha="$(git -C "$superpowers_dir" rev-parse --short HEAD 2>/dev/null || true)"
  [[ -n "$head_sha" ]] && ok "HEAD: $head_sha" || warn "cannot read HEAD"
else
  err "missing superpowers git repo: $superpowers_dir"
fi

if [[ -d "$skills_source" ]]; then
  ok "skills source found: $skills_source"
else
  err "missing skills source directory: $skills_source"
fi

if [[ -L "$skills_target" ]]; then
  linked="$(resolve_link_target "$skills_target" || true)"
  if [[ "$linked" == "$skills_source" ]]; then
    ok "skills link valid: $skills_target -> $skills_source"
  else
    err "skills link points elsewhere: $skills_target -> ${linked:-<unknown>}"
  fi
elif [[ -e "$skills_target" ]]; then
  err "skills target exists but is not a symlink: $skills_target"
else
  err "skills link missing: $skills_target"
fi

if [[ $ERR_COUNT -gt 0 ]]; then
  echo "Result: FAILED ($ERR_COUNT errors, $WARN_COUNT warnings)"
  exit 1
fi

echo "Result: OK ($WARN_COUNT warnings)"
exit 0
