# Workspace Memory Overlay + `aios memo` + MCP HTTP Token — Design

**Date:** 2026-03-11  
**Status:** Approved for implementation

## Goal

1) Provide a memos-like “instant capture” workflow (`aios memo ...`) backed by the existing workspace ContextDB.

2) Add a **workspace-pinned memory overlay** so stable, operator-maintained rules/persona/constraints are automatically injected into every `codex`/`claude`/`gemini` run (when wrapped by ContextDB).

3) Add an optional Streamable HTTP transport for `mcp-server` with **Bearer token** protection and localhost-first safety defaults.

## Non-Goals

- Replace ContextDB, change its on-disk schema, or introduce a second database.
- Auto-summarize or auto-edit pinned memory (manual pin/unpin only for stability).
- Build a UI for notes (CLI-first).
- Expose MCP HTTP on public interfaces by default.

## Concepts

### Workspace memory space

A **space** is a simple string namespace (default `default`). It supports multi-account workflows without forcing an “account” concept on other users:

- Typical developer: uses `default` and never thinks about spaces.
- Multi-account operator: uses `acc-xxx` spaces and switches explicitly.

### Workspace memory session mapping

Each space maps to a stable ContextDB session ID:

- `workspace-memory--default`
- `workspace-memory--acc-xhs-a`

This is still stored under the workspace’s `memory/context-db/sessions/...` tree and uses the existing ContextDB index/SQLite sidecar as-is.

### Pinned memory vs memo events

- **Pinned memory**: stored as `pinned.md` under the mapped session directory.
  - Rationale: stable, reviewable, separate from checkpoints (avoid accidental overwrite).
- **Memo events**: appended to the mapped session’s L2 events (`kind=memo`) via ContextDB CLI.
  - Tags are extracted from `#tag` syntax into `refs` for filtering/search.

### Active space selection

Active space is stored locally in `memory/context-db/.workspace-memory.json` (gitignored in this repo; best-effort local artifact elsewhere).

Resolution priority:
1) env override (temporary)
2) `.workspace-memory.json`
3) `default`

## CLI Surface: `aios memo`

- `aios memo use <space>`: set active space.
- `aios memo space list`: list spaces found under `memory/context-db/sessions/`.
- `aios memo add "<text>"`: append a memo event (`kind=memo`) in active space.
- `aios memo list [--limit N]`: show recent memo events in active space.
- `aios memo search "<query>" [--limit N] [--semantic]`: search memo events in active space.
- `aios memo pin show`: print pinned memory for active space.
- `aios memo pin set "<text>"`: replace pinned memory for active space.
- `aios memo pin add "<text>"`: append to pinned memory for active space.

## Workspace Memory Overlay (Context Injection)

When `scripts/ctx-agent-core.mjs` wraps `codex`/`claude`/`gemini`, it already generates and injects a ContextDB `context:pack`.

This design adds an additional lightweight “Workspace Memory” prefix:

- `Active space`
- `Pinned` (from `pinned.md`, length-capped)
- `Recent memos` (last N memo events, length-capped)

Safety/quality constraints:

- Omit the overlay entirely when pinned + memo list is empty.
- Hard cap overlay size (approx tokens/characters) to prevent context pollution.
- Provide env kill-switch to disable overlay injection.
- No automatic summarization/mutation.

## MCP HTTP Transport + Token Hardening

`mcp-server` remains stdio-first. HTTP transport is opt-in:

- Enable via env flag (e.g. `MCP_HTTP=1`).
- Bind to `127.0.0.1` by default.
- Expose Streamable HTTP endpoint at `GET|POST|DELETE /mcp`.
- Require `Authorization: Bearer <token>` for all requests.

Additional guardrails:

- DNS rebinding protection (localhost defaults) and Host validation.
- Session tracking in-memory with TTL cleanup (restart clears sessions).
- Optional rate limiting if needed later.

## Compatibility Notes

- Default behavior is unchanged unless users opt into `aios memo` usage and/or enable overlay/HTTP flags.
- Shell wrappers (`aios` function) should forward unknown subcommands to `node scripts/aios.mjs ...` so `aios memo` works after setup.

