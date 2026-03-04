# ContextDB transparent command wrappers for zsh.
# Source this file in ~/.zshrc to make codex/claude/gemini auto-load context packets
# in any git project, using a centralized ctx-agent runner.
#
# Optional overrides:
# - ROOTPATH: repo root where scripts/ctx-agent.sh lives
# - CTXDB_RUNNER: explicit runner path (highest priority)
# - CTXDB_REPO_NAME: explicit project name (optional)
# - CTXDB_WRAP_MODE: all|repo-only|opt-in|off (default: repo-only)
# - CTXDB_MARKER_FILE: marker filename for opt-in mode (default: .contextdb-enable)

typeset -g CTXDB_LAST_WORKSPACE=""

_ctxdb_normalize_codex_home() {
  local codex_home="${CODEX_HOME:-}"
  if [[ -z "$codex_home" ]]; then
    return 0
  fi

  # Avoid relative CODEX_HOME like ".codex" that breaks in other projects.
  if [[ "$codex_home" != /* ]]; then
    codex_home="$HOME/.codex"
    mkdir -p "$codex_home" >/dev/null 2>&1 || true
    export CODEX_HOME="$codex_home"
    return 0
  fi

  if [[ ! -d "$codex_home" ]]; then
    mkdir -p "$codex_home" >/dev/null 2>&1 || true
  fi
}

_ctxdb_detect_runner() {
  if [[ -n "${CTXDB_RUNNER:-}" ]] && [[ -x "${CTXDB_RUNNER}" ]]; then
    printf '%s\n' "${CTXDB_RUNNER}"
    return 0
  fi

  local rootpath="${ROOTPATH:-}"
  if [[ -n "$rootpath" ]] && [[ -x "$rootpath/scripts/ctx-agent.sh" ]]; then
    printf '%s\n' "$rootpath/scripts/ctx-agent.sh"
    return 0
  fi

  return 1
}

_ctxdb_detect_workspace_root() {
  local git_root=""
  git_root="$(command git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$git_root" ]]; then
    printf '%s\n' "$git_root"
    return 0
  fi

  return 1
}

_ctxdb_should_wrap_workspace() {
  local workspace="$1"
  local mode="${CTXDB_WRAP_MODE:-repo-only}"

  case "$mode" in
    all)
      return 0
      ;;
    repo-only)
      local rootpath="${ROOTPATH:-}"
      if [[ -z "$rootpath" ]]; then
        return 1
      fi
      rootpath="$(cd "$rootpath" 2>/dev/null && pwd || true)"
      [[ -n "$rootpath" ]] || return 1
      [[ "$workspace" == "$rootpath" ]]
      return $?
      ;;
    opt-in)
      local marker="${CTXDB_MARKER_FILE:-.contextdb-enable}"
      [[ -f "$workspace/$marker" ]]
      return $?
      ;;
    off|disabled|none)
      return 1
      ;;
    *)
      # Keep behavior predictable for unknown values.
      return 0
      ;;
  esac
}

_ctxdb_cmd_in_list() {
  local needle="$1"
  shift
  local item=""
  for item in "$@"; do
    if [[ "$needle" == "$item" ]]; then
      return 0
    fi
  done
  return 1
}

_ctxdb_should_wrap_codex() {
  local first="${1:-}"
  if [[ -z "$first" ]]; then
    return 0
  fi
  _ctxdb_cmd_in_list "$first" \
    exec review login logout mcp mcp-server app-server app completion sandbox debug apply resume fork cloud features help \
    -h --help -V --version && return 1
  return 0
}

_ctxdb_should_wrap_claude() {
  local first="${1:-}"
  if [[ -z "$first" ]]; then
    return 0
  fi
  _ctxdb_cmd_in_list "$first" \
    agents auth doctor install mcp plugin setup-token update upgrade \
    -h --help -v --version && return 1
  return 0
}

_ctxdb_should_wrap_gemini() {
  local first="${1:-}"
  if [[ -z "$first" ]]; then
    return 0
  fi
  _ctxdb_cmd_in_list "$first" \
    mcp extensions skills hooks \
    -h --help -v --version && return 1
  return 0
}

_ctxdb_run_or_passthrough() {
  local agent="$1"
  shift
  local passthrough="$1"
  shift

  local runner=""
  runner="$(_ctxdb_detect_runner || true)"
  if [[ -z "$runner" ]]; then
    command "$passthrough" "$@"
    return $?
  fi

  local workspace=""
  workspace="$(_ctxdb_detect_workspace_root || true)"
  if [[ -z "$workspace" ]]; then
    command "$passthrough" "$@"
    return $?
  fi

  if ! _ctxdb_should_wrap_workspace "$workspace"; then
    command "$passthrough" "$@"
    return $?
  fi

  local project="${CTXDB_REPO_NAME:-${workspace:t}}"
  CTXDB_LAST_WORKSPACE="$workspace"
  "$runner" --workspace "$workspace" --agent "$agent" --project "$project" -- "$@"
}

codex() {
  _ctxdb_normalize_codex_home
  if ! _ctxdb_should_wrap_codex "${1:-}"; then
    command codex "$@"
    return $?
  fi
  _ctxdb_run_or_passthrough codex-cli codex "$@"
}

claude() {
  if ! _ctxdb_should_wrap_claude "${1:-}"; then
    command claude "$@"
    return $?
  fi
  _ctxdb_run_or_passthrough claude-code claude "$@"
}

gemini() {
  if ! _ctxdb_should_wrap_gemini "${1:-}"; then
    command gemini "$@"
    return $?
  fi
  _ctxdb_run_or_passthrough gemini-cli gemini "$@"
}
