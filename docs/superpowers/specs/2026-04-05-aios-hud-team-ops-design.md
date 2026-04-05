# AIOS HUD + Team Ops (Visibility v1) Design

## Goal

Ship a first-class visibility layer for AIOS that makes `orchestrate` / `team` runs easy to observe and operate:

- CLI HUD: `node scripts/aios.mjs hud` for fast status + watch mode.
- Team ops: `node scripts/aios.mjs team status|history` for operational workflows.
- TUI HUD screen: an Ink screen that uses the same HUD core.

This is inspired by:
- **OMX (oh-my-codex)**: CLI HUD with `--watch` + tmux friendliness.
- **OMC (oh-my-claudecode)**: always-on visibility via HUD/statusline and strong “team-first” operations.

## Non-Goals

- No new ContextDB schema or sqlite migrations in v1 (filesystem reads only).
- No tmux pane management or “shutdown workers” semantics (AIOS team is not a tmux worker manager today).
- No deep client-native statusline injection (Claude plugin-like statusline remains optional/future).
- No “interaction envelope” / hindsight learning work in this scope.

## User Experience (MVP)

### CLI HUD

`node scripts/aios.mjs hud [options]`

- Default behavior: pick a target session automatically and show a focused, human-readable summary.
- `--watch`: refresh every N ms with terminal-clear rendering (TTY-only).
- `--json`: output the raw HUD state as JSON (no ANSI).
- `--preset`: `minimal | focused | full`.

Session selection order:
1) `--session <id>` (explicit)
2) `--provider <codex|claude|gemini>` → map to agent id (`codex-cli|claude-code|gemini-cli`) and pick latest session
3) fallback: latest session across all known agents in the repo

Displayed signals (focused preset):
- session meta (goal/agent/status/updatedAt)
- latest checkpoint summary + verification/retry/failure/cost telemetry
- latest dispatch evidence (ok/blocked, job counts, work-item totals)
- “next command” suggestions (retry-blocked / rerun dry-run / learn-eval) based on the observed state

### Team ops

Add subcommands under `team`:

- `node scripts/aios.mjs team status [--session <id>|--resume <id>] [--provider ...] [--watch] [--json]`
  - Prints a team-oriented view of the latest dispatch run for the session.
  - `--watch` follows the same rendering loop as HUD.

- `node scripts/aios.mjs team history [--provider ...] [--limit N] [--json]`
  - Lists recent sessions and whether the latest dispatch run is ok/blocked.

The existing execution surface remains unchanged:
- `node scripts/aios.mjs team 3:codex "task..." ...` still routes to `orchestrate` live/dry-run.

### TUI HUD Screen

Add a `HUD` entry to the Ink TUI main menu.

The HUD screen supports:
- provider selection (codex/claude/gemini)
- session selection (latest-by-provider by default; optionally pick from recent list)
- preset selection
- watch toggle (auto refresh)

TUI should use the same HUD core module as the CLI (shared state builder + renderers).

## Architecture

### Shared HUD core (single source of truth)

Add `scripts/lib/hud/*`:

- `state.mjs`: read ContextDB session files + latest dispatch artifact and return a normalized `HudState`.
- `render.mjs`: render `HudState` in presets (`minimal|focused|full`) as plain text.
- `watch.mjs`: a resilient watch loop (TTY-only), with cursor hide/show and screen positioning.

Both `aios hud` and the Ink HUD screen call `state.mjs`, and can either:
- render via `render.mjs`, or
- consume structured JSON for richer UI.

### Data Sources

Filesystem-only (no ContextDB CLI dependency for v1):

- `memory/context-db/sessions/<sessionId>/meta.json`
- `memory/context-db/sessions/<sessionId>/state.json`
- `memory/context-db/sessions/<sessionId>/checkpoints.jsonl` (read last JSON line)
- `memory/context-db/sessions/<sessionId>/artifacts/dispatch-run-*.json` (pick latest)

Dispatch artifact interpretation:
- `dispatchRun.ok` + `jobRuns[]` + `executorRegistry[]` + `finalOutputs[]`
- `workItemTelemetry` totals (blocked/done/queued/etc) if present

### Stability rules

- Missing/invalid files must degrade gracefully (HUD prints “(none)” and suggests next command).
- Rendering must be stable enough for `--watch` loops (no random noise).
- All new CLI output should be intentional and testable (avoid ad-hoc debug logging).

## Testing & Verification

Minimum verification:
- New unit tests for HUD state selection and dispatch artifact parsing.
- CLI parse tests for `hud` and `team status/history`.
- `npm run test:scripts` (repo root).

Manual smoke checks (optional):
- `node scripts/aios.mjs hud --watch`
- `node scripts/aios.mjs team status --provider codex --watch`
- `node scripts/aios.mjs` → open TUI → HUD screen

## Rollout

v1 ships as additive commands and a new TUI screen; no breaking changes to existing `orchestrate` / `team` execution paths.

