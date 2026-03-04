#!/usr/bin/env bash
set -euo pipefail

echo "ContextDB Shell Doctor"
echo "----------------------"

rc_file="${ZDOTDIR:-$HOME}/.zshrc"
echo "RC file: $rc_file"

if [[ -f "$rc_file" ]]; then
  if rg -q '^# >>> contextdb-shell >>>$' "$rc_file"; then
    echo "[ok] contextdb managed block found in $rc_file"
  else
    echo "[warn] contextdb managed block not found in $rc_file"
  fi
else
  echo "[warn] rc file not found: $rc_file"
fi

echo "ROOTPATH: ${ROOTPATH:-<unset>}"
echo "CTXDB_WRAP_MODE: ${CTXDB_WRAP_MODE:-<unset>}"
echo "CODEX_HOME: ${CODEX_HOME:-<unset>}"

if [[ -n "${CODEX_HOME:-}" ]]; then
  if [[ "${CODEX_HOME}" != /* ]]; then
    echo "[warn] CODEX_HOME is relative (${CODEX_HOME}); recommend: export CODEX_HOME=\"\$HOME/.codex\""
  elif [[ ! -d "${CODEX_HOME}" ]]; then
    echo "[warn] CODEX_HOME directory does not exist (${CODEX_HOME})"
  else
    echo "[ok] CODEX_HOME looks valid"
  fi
fi

if command -v codex >/dev/null 2>&1; then
  echo "[ok] codex found: $(command -v codex)"
else
  echo "[warn] codex not found in PATH"
fi

if command -v claude >/dev/null 2>&1; then
  echo "[ok] claude found: $(command -v claude)"
else
  echo "[warn] claude not found in PATH"
fi

if command -v gemini >/dev/null 2>&1; then
  echo "[ok] gemini found: $(command -v gemini)"
else
  echo "[warn] gemini not found in PATH"
fi
