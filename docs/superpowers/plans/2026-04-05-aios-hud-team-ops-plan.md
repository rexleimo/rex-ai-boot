# AIOS HUD + Team Ops (Visibility v1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared HUD core with both CLI and Ink TUI surfaces, plus operational `team status/history` commands for fast visibility and run triage.

**Architecture:** Implement a filesystem-only HUD core under `scripts/lib/hud/*` that reads ContextDB session files and the latest dispatch artifact. Expose it via `aios hud` (CLI) and a new Ink TUI HUD screen, and reuse the same core for `team status/history`.

**Tech Stack:** Node.js ESM (`.mjs`), Ink TUI (React), existing ContextDB session layout under `memory/context-db/`.

---

## File Structure

### New files

- `scripts/lib/hud/state.mjs`
  - Session selection (latest by provider / fallback).
  - Read meta/state/checkpoint tail and latest dispatch artifact.
  - Normalize into one `HudState` JSON.
- `scripts/lib/hud/render.mjs`
  - Text renderers for `minimal|focused|full` presets.
  - “next command suggestions” heuristic.
- `scripts/lib/hud/watch.mjs`
  - `--watch` loop shared by `aios hud` and `team status`.
- `scripts/lib/lifecycle/hud.mjs`
  - CLI entry: parse options, compute state, render or JSON.
- `scripts/lib/lifecycle/team-ops.mjs`
  - `team status` and `team history` runners, powered by HUD core.
- `scripts/lib/tui-ink/screens/HudScreen.tsx`
  - Ink HUD screen using the HUD core.
- `scripts/tests/hud-state.test.mjs`
  - State builder and session selection tests.

### Modified files

- `scripts/lib/cli/help.mjs`
  - Add `hud` command and `team status/history` docs.
- `scripts/lib/cli/parse-args.mjs`
  - Parse `hud` command options.
  - Extend `team` parsing to support subcommands: `status`, `history`.
- `scripts/aios.mjs`
  - Route `hud` command to lifecycle runner.
  - Route `team status/history` to lifecycle runner (keep existing execution path).
- `scripts/lib/tui-ink/App.tsx`
  - Add `/hud` route.
- `scripts/lib/tui-ink/screens/MainScreen.tsx`
  - Add `HUD` entry.

---

## Chunk 1: HUD Core (State + Render + Watch)

### Task 1: Add HUD state builder

**Files:**
- Create: `scripts/lib/hud/state.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Write failing test for “latest session selection by provider”**

Create a temporary ContextDB session tree in a temp dir:
- sessions for `codex-cli` and `claude-code`
- ensure the latest `updatedAt` wins

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement `selectHudSessionId()`**

Inputs:
- `rootDir`, `sessionId?`, `provider?`, `clientId?`

Output:
- selected `sessionId` or `''` when none exists

- [ ] **Step 3: Implement `readHudState()`**

Reads (best-effort):
- `meta.json`
- `state.json`
- last JSON line in `checkpoints.jsonl`
- newest `artifacts/dispatch-run-*.json`

Normalizes:
- `session`, `latestCheckpoint`, `latestDispatch`, `suggestedCommands`

- [ ] **Step 4: Run test**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS.

### Task 2: Add HUD renderer + watch loop

**Files:**
- Create: `scripts/lib/hud/render.mjs`
- Create: `scripts/lib/hud/watch.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Write a renderer snapshot-style test**

Test: render `focused` preset for a state fixture; assert key substrings:
- session goal
- checkpoint verification
- dispatch ok/blocked

- [ ] **Step 2: Implement renderers**

`renderHud(state, { preset }) -> string`

Presets:
- minimal: 1–3 lines
- focused: concise sections
- full: include blocked job ids and work-item breakdown

- [ ] **Step 3: Implement `watchRenderLoop()`**

Constraints:
- TTY-only unless `CI=1`
- hide cursor, render with `\x1b[H`, restore cursor on exit
- interval default: 1000ms

- [ ] **Step 4: Run tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS.

---

## Chunk 2: CLI HUD command

### Task 3: Add `aios hud` parsing + help + runner

**Files:**
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/aios.mjs`
- Create: `scripts/lib/lifecycle/hud.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`

- [ ] **Step 1: Add failing CLI parse test**

Add cases:
- `hud --provider codex --json`
- `hud --session <id> --preset full`
- `hud --watch --interval-ms 500`

- [ ] **Step 2: Implement parsing**

Options:
- `--session <id>`
- `--provider <codex|claude|gemini>`
- `--preset <minimal|focused|full>`
- `--watch`
- `--json`
- `--interval-ms <n>`

- [ ] **Step 3: Implement `runHud()`**

Behavior:
- compute hud state
- `--json` prints JSON
- otherwise render preset text
- `--watch` uses watch loop

- [ ] **Step 4: Run focused tests**

Run: `node --test scripts/tests/aios-cli.test.mjs scripts/tests/hud-state.test.mjs`
Expected: PASS.

---

## Chunk 3: Team ops (`status` + `history`)

### Task 4: Parse `team status/history`

**Files:**
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/aios.mjs`
- Create: `scripts/lib/lifecycle/team-ops.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`

- [ ] **Step 1: Add failing parse tests**

- `team status --provider codex --json`
- `team history --provider claude --limit 5`

- [ ] **Step 2: Implement `team status` runner**

Uses HUD core:
- selects session (same precedence as HUD)
- renders `focused` by default
- supports `--watch` and `--json`

- [ ] **Step 3: Implement `team history` runner**

Uses sessions scan:
- list N recent sessions for provider’s agent id
- include last dispatch ok/blocked when artifact exists

- [ ] **Step 4: Run focused tests**

Run: `node --test scripts/tests/aios-cli.test.mjs scripts/tests/hud-state.test.mjs`
Expected: PASS.

---

## Chunk 4: Ink TUI HUD screen

### Task 5: Add HUD menu + screen

**Files:**
- Modify: `scripts/lib/tui-ink/screens/MainScreen.tsx`
- Modify: `scripts/lib/tui-ink/App.tsx`
- Create: `scripts/lib/tui-ink/screens/HudScreen.tsx`

- [ ] **Step 1: Add HUD entry and route**

Main menu adds “HUD”.
Router adds `/hud`.

- [ ] **Step 2: Implement `HudScreen`**

UI:
- provider selector
- preset selector
- watch toggle
- session summary + dispatch summary

Data:
- call HUD core `readHudState()` on an interval when watch is enabled

- [ ] **Step 3: Manual smoke**

Run: `node scripts/aios.mjs` → HUD screen
Expected: refreshes cleanly and exits via ESC/back.

---

## Chunk 5: Final verification

### Task 6: Run repo test suite

Run: `npm run test:scripts`
Expected: PASS.

### Task 7: Manual CLI smoke

- `node scripts/aios.mjs hud`
- `node scripts/aios.mjs hud --watch`
- `node scripts/aios.mjs team status --provider codex`

