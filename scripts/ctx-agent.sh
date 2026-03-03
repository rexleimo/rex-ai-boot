#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_DIR="$ROOT_DIR/mcp-server"

AGENT=""
PROJECT=""
WORKSPACE_ROOT=""
GOAL=""
SESSION_ID=""
PROMPT=""
EVENT_LIMIT="30"
CHECKPOINT_STATUS="running"
AUTO_CHECKPOINT="true"
DRY_RUN="false"
MAX_LOG_CHARS="8000"
EXTRA_ARGS=()

usage() {
  cat <<'EOF'
Usage:
  scripts/ctx-agent.sh --agent <claude-code|gemini-cli|codex-cli> [options] [-- <extra agent args>]

Options:
  --agent <name>      Agent name: claude-code | gemini-cli | codex-cli
  --workspace <path>  Workspace root to store context-db (default: current git root, else current dir)
  --project <name>    Project name (default: current directory name)
  --goal <text>       Session goal (used when creating a new session)
  --session <id>      Reuse a specific session id
  --prompt <text>     Run one-shot mode and auto log request/response/checkpoint
  --limit <n>         Number of recent events in context packet (default: 30)
  --status <state>    Checkpoint status on success: running|blocked|done (default: running)
  --no-checkpoint     Disable automatic checkpoint write in one-shot mode
  --dry-run           Skip remote model call, write synthetic response for pipeline testing
  --max-log-chars <n> Max characters stored in event logs (default: 8000)
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)
      AGENT="${2:-}"; shift 2 ;;
    --workspace)
      WORKSPACE_ROOT="${2:-}"; shift 2 ;;
    --project)
      PROJECT="${2:-}"; shift 2 ;;
    --goal)
      GOAL="${2:-}"; shift 2 ;;
    --session)
      SESSION_ID="${2:-}"; shift 2 ;;
    --prompt)
      PROMPT="${2:-}"; shift 2 ;;
    --limit)
      EVENT_LIMIT="${2:-30}"; shift 2 ;;
    --status)
      CHECKPOINT_STATUS="${2:-running}"; shift 2 ;;
    --no-checkpoint)
      AUTO_CHECKPOINT="false"; shift ;;
    --dry-run)
      DRY_RUN="true"; shift ;;
    --max-log-chars)
      MAX_LOG_CHARS="${2:-8000}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    --)
      shift
      EXTRA_ARGS=("$@")
      break ;;
    *)
      EXTRA_ARGS+=("$1")
      shift ;;
  esac
done

if [[ -z "$AGENT" ]]; then
  echo "Missing required --agent"
  exit 1
fi

if [[ "$AGENT" != "claude-code" && "$AGENT" != "gemini-cli" && "$AGENT" != "codex-cli" ]]; then
  echo "--agent must be one of: claude-code, gemini-cli, codex-cli"
  exit 1
fi

if [[ "$CHECKPOINT_STATUS" != "running" && "$CHECKPOINT_STATUS" != "blocked" && "$CHECKPOINT_STATUS" != "done" ]]; then
  echo "--status must be one of: running, blocked, done"
  exit 1
fi

if ! [[ "$MAX_LOG_CHARS" =~ ^[0-9]+$ ]]; then
  echo "--max-log-chars must be a non-negative integer"
  exit 1
fi

if [[ -z "$WORKSPACE_ROOT" ]]; then
  WORKSPACE_ROOT="$(command git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || printf '%s\n' "$PWD")"
fi

if [[ ! -d "$WORKSPACE_ROOT" ]]; then
  echo "--workspace is not a directory: $WORKSPACE_ROOT"
  exit 1
fi

WORKSPACE_ROOT="$(cd "$WORKSPACE_ROOT" && pwd)"

if [[ -z "$PROJECT" ]]; then
  PROJECT="$(basename "$WORKSPACE_ROOT")"
fi

ctx() {
  local cmd="$1"
  shift
  (
    cd "$MCP_DIR"
    npm run -s contextdb -- "$cmd" --workspace "$WORKSPACE_ROOT" "$@"
  )
}

json_get() {
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const v=$1;process.stdout.write(v==null?'':String(v));"
}

# Step 1: ensure context DB exists
ctx init >/dev/null

if [[ -z "$SESSION_ID" ]]; then
  # Step 2a: try latest session for agent+project
  LATEST_JSON="$(ctx session:latest --agent "$AGENT" --project "$PROJECT")"
  SESSION_ID="$(printf '%s' "$LATEST_JSON" | json_get '(data.session && data.session.sessionId) || (session && session.sessionId)')"

  if [[ -z "$SESSION_ID" ]]; then
    # Step 2b: create session if absent
    if [[ -z "$GOAL" ]]; then
      GOAL="Shared context session for $AGENT on $PROJECT"
    fi
    CREATE_JSON="$(ctx session:new --agent "$AGENT" --project "$PROJECT" --goal "$GOAL")"
    SESSION_ID="$(printf '%s' "$CREATE_JSON" | json_get 'data.sessionId || sessionId')"
  fi
fi

if [[ -z "$SESSION_ID" ]]; then
  echo "Failed to resolve session id from contextdb output."
  exit 1
fi

PACK_PATH="memory/context-db/exports/${SESSION_ID}-context.md"
# Step 5 (pre-run): build context packet and feed into agent prompt
ctx context:pack --session "$SESSION_ID" --limit "$EVENT_LIMIT" --out "$PACK_PATH" >/dev/null
PACK_ABS="$WORKSPACE_ROOT/$PACK_PATH"
CONTEXT_TEXT="$(cat "$PACK_ABS")"

echo "Session: $SESSION_ID"
echo "Workspace: $WORKSPACE_ROOT"
echo "Context packet: $PACK_ABS"

if [[ -n "$PROMPT" ]]; then
  # Step 3a: write user prompt event
  ctx event:add --session "$SESSION_ID" --role user --kind prompt --text "$PROMPT" >/dev/null
fi

if [[ -n "$PROMPT" ]]; then
  RESPONSE_STATUS="$CHECKPOINT_STATUS"
  OUTPUT=""
  EXIT_CODE=0

  if [[ "$DRY_RUN" == "true" ]]; then
    OUTPUT="[dry-run] $AGENT would execute prompt with context packet: $PACK_ABS"$'\n'"Prompt: $PROMPT"
  else
    if [[ "$AGENT" == "claude-code" ]]; then
      set +e
      if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
        OUTPUT="$(claude --print --append-system-prompt "$CONTEXT_TEXT" "$PROMPT" "${EXTRA_ARGS[@]}" 2>&1)"
      else
        OUTPUT="$(claude --print --append-system-prompt "$CONTEXT_TEXT" "$PROMPT" 2>&1)"
      fi
      EXIT_CODE=$?
      set -e
    elif [[ "$AGENT" == "gemini-cli" ]]; then
      FULL_PROMPT="${CONTEXT_TEXT}"$'\n\n'"## New User Request"$'\n'"${PROMPT}"
      set +e
      if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
        OUTPUT="$(gemini -p "$FULL_PROMPT" "${EXTRA_ARGS[@]}" 2>&1)"
      else
        OUTPUT="$(gemini -p "$FULL_PROMPT" 2>&1)"
      fi
      EXIT_CODE=$?
      set -e
    elif [[ "$AGENT" == "codex-cli" ]]; then
      FULL_PROMPT="${CONTEXT_TEXT}"$'\n\n'"## New User Request"$'\n'"${PROMPT}"
      set +e
      if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
        OUTPUT="$(codex exec "$FULL_PROMPT" "${EXTRA_ARGS[@]}" 2>&1)"
      else
        OUTPUT="$(codex exec "$FULL_PROMPT" 2>&1)"
      fi
      EXIT_CODE=$?
      set -e
    fi
  fi

  printf '%s\n' "$OUTPUT"

  if [[ "$EXIT_CODE" -ne 0 ]]; then
    RESPONSE_STATUS="blocked"
  fi

  LOG_OUTPUT="$(printf '%s' "$OUTPUT" | head -c "$MAX_LOG_CHARS")"
  KIND="response"
  if [[ "$EXIT_CODE" -ne 0 ]]; then
    KIND="error"
  fi

  # Step 3b: write model response event
  ctx event:add --session "$SESSION_ID" --role assistant --kind "$KIND" --text "$LOG_OUTPUT" >/dev/null

  if [[ "$AUTO_CHECKPOINT" == "true" ]]; then
    PROMPT_SNIPPET="$(printf '%s' "$PROMPT" | tr '\n' ' ' | head -c 200)"
    RESPONSE_SNIPPET="$(printf '%s' "$OUTPUT" | tr '\n' ' ' | head -c 300)"
    SUMMARY="Auto checkpoint: $AGENT one-shot run completed. prompt=\"$PROMPT_SNIPPET\" response=\"$RESPONSE_SNIPPET\""

    NEXT_ACTIONS="Review response|Continue with next prompt"
    if [[ "$RESPONSE_STATUS" == "blocked" ]]; then
      NEXT_ACTIONS="Inspect error output|Retry with adjusted prompt"
    fi

    # Step 4: write checkpoint
    ctx checkpoint \
      --session "$SESSION_ID" \
      --summary "$SUMMARY" \
      --status "$RESPONSE_STATUS" \
      --next "$NEXT_ACTIONS" >/dev/null
  fi

  # Step 5 (post-run): refresh context packet for next CLI handoff
  ctx context:pack --session "$SESSION_ID" --limit "$EVENT_LIMIT" --out "$PACK_PATH" >/dev/null

  if [[ "$EXIT_CODE" -ne 0 ]]; then
    exit "$EXIT_CODE"
  fi
else
  if [[ "$AGENT" == "claude-code" ]]; then
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      exec claude --append-system-prompt "$CONTEXT_TEXT" "${EXTRA_ARGS[@]}"
    else
      exec claude --append-system-prompt "$CONTEXT_TEXT"
    fi
  elif [[ "$AGENT" == "gemini-cli" ]]; then
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      exec gemini -i "$CONTEXT_TEXT" "${EXTRA_ARGS[@]}"
    else
      exec gemini -i "$CONTEXT_TEXT"
    fi
  elif [[ "$AGENT" == "codex-cli" ]]; then
    if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
      exec codex "${EXTRA_ARGS[@]}" "$CONTEXT_TEXT"
    else
      exec codex "$CONTEXT_TEXT"
    fi
  else
    echo "Unsupported agent: $AGENT"
    exit 1
  fi
fi
