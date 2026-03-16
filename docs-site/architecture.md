---
title: Architecture
description: Runtime architecture for wrappers, runner, and filesystem ContextDB.
---

# Architecture

## Components

- `scripts/contextdb-shell.zsh`: shell wrappers for `codex/claude/gemini`
- `scripts/contextdb-shell-bridge.mjs`: wrap/passthrough decision bridge
- `scripts/ctx-agent.mjs`: unified runtime runner
- `mcp-server/src/contextdb/*`: ContextDB core and CLI commands

## Runtime Flow

```text
User command (codex/claude/gemini)
  -> zsh wrapper
  -> contextdb-shell-bridge.mjs
  -> ctx-agent.mjs
  -> contextdb CLI (init/session/pack/...)
  -> native CLI launch with packed context
```

## Storage Model

Each wrapped workspace has its own local store (git root if available, otherwise current directory):

```text
memory/context-db/
  manifest.json
  index/sessions.jsonl
  sessions/<session_id>/
  exports/<session_id>-context.md
```

## Isolation Controls

Set wrapper scope with `CTXDB_WRAP_MODE`:

- `all`: wrap in all workspaces, including non-git directories
- `repo-only`: only wrap in the `ROOTPATH` workspace
- `opt-in`: wrap only when marker exists (default marker: `.contextdb-enable`)
- `off`: disable wrapping

Use `opt-in` if you want strict project-by-project control.

## Harness Layer (AIOS)

AIOS adds an operator-facing harness on top of ContextDB:

- `aios orchestrate` builds a local dispatch DAG from blueprints.
- `dry-run` execution uses `local-dry-run` (token-free simulation).
- `live` execution uses `subagent-runtime` and runs phase jobs via Codex CLI (`codex`) (currently codex-only).
- When using `AIOS_SUBAGENT_CLIENT=codex-cli`, AIOS prefers `codex exec` structured outputs (`--output-schema`, `--output-last-message`, stdin) for stable JSON handoffs (falls back for older versions).

Live execution is opt-in and gated by:

- `AIOS_EXECUTE_LIVE=1`
- `AIOS_SUBAGENT_CLIENT=codex-cli`
