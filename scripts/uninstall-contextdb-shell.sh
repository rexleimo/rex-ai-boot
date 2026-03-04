#!/usr/bin/env bash
set -euo pipefail

RC_FILE="${ZDOTDIR:-$HOME}/.zshrc"
BEGIN_MARK="# >>> contextdb-shell >>>"
END_MARK="# <<< contextdb-shell <<<"

usage() {
  cat <<EOF
Usage:
  scripts/uninstall-contextdb-shell.sh [--rc-file <path>]

Options:
  --rc-file <path>   Target shell rc file (default: ~/.zshrc)
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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

if [[ ! -f "$RC_FILE" ]]; then
  echo "Nothing to uninstall: $RC_FILE does not exist."
  exit 0
fi

tmp_file="$(mktemp)"
awk -v begin="$BEGIN_MARK" -v end="$END_MARK" '
  $0 == begin { skip=1; next }
  $0 == end { skip=0; next }
  skip != 1 { print }
' "$RC_FILE" | awk '
  !($0 ~ /^source ".*\/scripts\/contextdb-shell\.zsh"$/) &&
  !($0 ~ /^# ContextDB transparent CLI wrappers \(codex\/claude\/gemini\)$/)
' > "$tmp_file"
mv "$tmp_file" "$RC_FILE"

echo "Removed ContextDB managed block from $RC_FILE"
echo "Run: source \"$RC_FILE\""
