#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RC_FILE="${ZDOTDIR:-$HOME}/.zshrc"
BEGIN_MARK="# >>> contextdb-shell >>>"
END_MARK="# <<< contextdb-shell <<<"
WRAP_MODE="opt-in"
FORCE="false"

usage() {
  cat <<EOF
Usage:
  scripts/install-contextdb-shell.sh [--force] [--mode <all|repo-only|opt-in|off>] [--rc-file <path>]

Options:
  --force            Replace existing managed block if present
  --mode <value>     Default CTXDB_WRAP_MODE in block (default: opt-in)
  --rc-file <path>   Target shell rc file (default: ~/.zshrc)
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE="true"
      shift
      ;;
    --mode)
      WRAP_MODE="${2:-}"
      shift 2
      ;;
    --rc-file)
      RC_FILE="${2:-}"
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

case "$WRAP_MODE" in
  all|repo-only|opt-in|off) ;;
  *)
    echo "--mode must be one of: all, repo-only, opt-in, off" >&2
    exit 1
    ;;
esac

if [[ ! -f "$RC_FILE" ]]; then
  touch "$RC_FILE"
fi

remove_managed_block() {
  local input_file="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  awk -v begin="$BEGIN_MARK" -v end="$END_MARK" '
    $0 == begin { skip=1; next }
    $0 == end { skip=0; next }
    skip != 1 { print }
  ' "$input_file" > "$tmp_file"
  mv "$tmp_file" "$input_file"
}

remove_legacy_source_line() {
  local input_file="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  awk '
    !($0 ~ /^source ".*\/scripts\/contextdb-shell\.zsh"$/) &&
    !($0 ~ /^# ContextDB transparent CLI wrappers \(codex\/claude\/gemini\)$/)
  ' "$input_file" > "$tmp_file"
  mv "$tmp_file" "$input_file"
}

if grep -Fq "$BEGIN_MARK" "$RC_FILE"; then
  if [[ "$FORCE" == "true" ]]; then
    remove_managed_block "$RC_FILE"
  else
    echo "Already installed ($BEGIN_MARK). Use --force to update."
    echo "Run: source \"$RC_FILE\""
    exit 0
  fi
fi

remove_legacy_source_line "$RC_FILE"

cat >> "$RC_FILE" <<EOF

$BEGIN_MARK
# ContextDB transparent CLI wrappers (codex/claude/gemini)
export ROOTPATH="\${ROOTPATH:-$ROOT_DIR}"
export CTXDB_WRAP_MODE="\${CTXDB_WRAP_MODE:-$WRAP_MODE}"
if [[ -n "\${CODEX_HOME:-}" ]] && [[ "\$CODEX_HOME" != /* ]]; then
  export CODEX_HOME="\$HOME/.codex"
fi
if [[ -f "\$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "\$ROOTPATH/scripts/contextdb-shell.zsh"
fi
$END_MARK
EOF

echo "Installed into $RC_FILE"
echo "Default wrap mode: $WRAP_MODE"
echo "Run: source \"$RC_FILE\""
echo "Uninstall: scripts/uninstall-contextdb-shell.sh --rc-file \"$RC_FILE\""
