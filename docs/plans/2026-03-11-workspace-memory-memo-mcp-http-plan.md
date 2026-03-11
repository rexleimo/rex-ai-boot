# Workspace Memory Overlay + `aios memo` + MCP HTTP Token Implementation Plan

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-pinned memory + memos-like quick capture on top of ContextDB, and harden Browser MCP with optional HTTP + Bearer token.

**Architecture:** Implement a `workspace-memory` overlay session per “space” (default `default`) stored in the existing ContextDB tree. Add `aios memo` commands to manage spaces/pins/memos. Update `ctx-agent` to inject pinned memory + recent memos ahead of the current session context packet. Add opt-in Streamable HTTP transport for the MCP server with localhost-first defaults and Bearer token auth.

**Tech Stack:** Node.js (ESM) for AIOS CLI (`scripts/*.mjs`), ContextDB via `mcp-server/src/contextdb/cli.ts` (tsx runner), TypeScript `mcp-server` with `@modelcontextprotocol/sdk` Streamable HTTP transport.

---

## Chunk 1: `aios memo` command surface

### Task 1: Add `memo` to CLI parsing + help

**Files:**
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/aios.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`

- [ ] **Step 1: Extend `parseArgs()` to accept `memo`**
- [ ] **Step 2: Add `memo` to root help + per-command help**
- [ ] **Step 3: Dispatch `memo` from `scripts/aios.mjs`**
- [ ] **Step 4: Update CLI tests to cover `memo` parsing**

### Task 2: Implement `scripts/lib/memo/memo.mjs`

**Files:**
- Create: `scripts/lib/memo/memo.mjs`
- Modify: `scripts/lib/contextdb-cli.mjs` (only if needed for ergonomics)

- [ ] **Step 1: Implement workspace root detection**
  - Use `git rev-parse --show-toplevel` when available; fallback to `process.cwd()`.

- [ ] **Step 2: Implement space state storage**
  - Read/write `memory/context-db/.workspace-memory.json` with `{ activeSpace: string }`.
  - Env override: `WORKSPACE_MEMORY_SPACE` (highest priority).

- [ ] **Step 3: Implement session ID mapping**
  - `workspace-memory--${slug(space)}` (stable, filesystem-safe).
  - Ensure session exists by creating it once with `contextdb session:new --session-id ...`.

- [ ] **Step 4: Implement pinned memory file ops**
  - `pinned.md` under the session directory.
  - Support `pin show|set|add`.

- [ ] **Step 5: Implement memo events**
  - `memo add`: `contextdb event:add --kind memo --role user --refs <tags>`
  - `memo list`: `contextdb search --session <id> --kinds memo --limit N`
  - `memo search`: same + `--query` + optional `--semantic`

### Task 3: Make shell `aios` wrapper forward unknown subcommands

**Files:**
- Modify: `scripts/contextdb-shell.zsh`
- Modify: `scripts/contextdb-shell.ps1`

- [ ] **Step 1: Update zsh wrapper default case to exec `scripts/aios.sh <sub> ...`**
- [ ] **Step 2: Update PowerShell wrapper default case to exec `node scripts/aios.mjs <args...>`**

---

## Chunk 2: Workspace Memory Overlay in `ctx-agent`

### Task 4: Inject workspace memory overlay in `scripts/ctx-agent-core.mjs`

**Files:**
- Modify: `scripts/ctx-agent-core.mjs`
- Test: `scripts/tests/ctx-agent-core.test.mjs` (add focused assertions if feasible)

- [ ] **Step 1: Add env flags**
  - `CTXDB_WORKSPACE_MEMORY=0|1` (default on)
  - `WORKSPACE_MEMORY_SPACE` (override active space)
  - `WORKSPACE_MEMORY_RECENT_LIMIT` (default 10)
  - `WORKSPACE_MEMORY_MAX_CHARS` (default ~4000)

- [ ] **Step 2: Build overlay text**
  - Resolve active space.
  - Read `pinned.md` (optional).
  - Read last N `kind=memo` events from the space session’s `l2-events.jsonl` (best-effort).
  - Omit overlay when empty; cap length strictly.

- [ ] **Step 3: Prepend overlay to existing context packet**
  - Ensure `injectContext` becomes true when overlay is non-empty (even if pack failed).

---

## Chunk 3: MCP HTTP transport + token hardening

### Task 5: Add opt-in Streamable HTTP server

**Files:**
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

- [ ] **Step 1: Add env-configured HTTP mode**
  - `MCP_HTTP=1` enables
  - `MCP_HTTP_HOST` default `127.0.0.1`
  - `MCP_HTTP_PORT` default `43110`
  - `MCP_HTTP_TOKEN` required

- [ ] **Step 2: Implement `/mcp` handler**
  - Use `createMcpExpressApp({ host })`
  - Require `Authorization: Bearer <token>`
  - Use `StreamableHTTPServerTransport` with session map + TTL cleanup

- [ ] **Step 3: Document usage**
  - Example curl + Claude/Codex “MCP http transport” config snippet.

---

## Verification

- [ ] Run: `npm run test:scripts`
- [ ] Run: `cd mcp-server && npm run typecheck`
- [ ] Run: `cd mcp-server && npm run build`
- [ ] Manual: MCP smoke test (stdio): `browser_launch` → `browser_navigate` → `browser_snapshot` → `browser_close`
- [ ] Manual: MCP smoke test (http): start with `MCP_HTTP=1 MCP_HTTP_TOKEN=...` then call `/mcp` initialize + tool call

