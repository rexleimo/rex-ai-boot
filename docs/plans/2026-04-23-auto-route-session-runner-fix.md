## Goal

Repair AIOS auto-routed `team` / `subagent` execution so it works from non-AIOS workspaces and keeps ContextDB/session resolution bound to the target workspace.

## Root Cause

- `scripts/ctx-agent-core.mjs` originally built routed commands as `node scripts/aios.mjs ...` relative to the target workspace, so cross-repo runs failed with `MODULE_NOT_FOUND`.
- Switching to an absolute `scripts/aios.mjs` path plus `--session` still was not enough because `scripts/aios.mjs` anchors `rootDir` to the AIOS install repo, so ContextDB looked in the wrong `memory/context-db/sessions/...` tree for external workspaces.
- `scripts/contextdb-shell-bridge.mjs` injected matching hardcoded route guidance into interactive auto prompts, so wrapped agents were taught the same broken command shape.

## Plan

1. Add failing-first tests that exercise routed `team`/`subagent` dry-runs from a temporary non-AIOS workspace and assert the route command now succeeds.
2. Update routed execution to keep `rootDir` bound to the target workspace by calling `runOrchestrate(...)` directly inside `ctx-agent-core`, while exposing `ctx-agent` one-shot route commands as the stable external trigger shape.
3. Update bridge/router guidance strings to teach the new workspace-aware `ctx-agent` command shape instead of direct `aios.mjs` calls.
4. Run targeted route tests, bridge tests, and full `ctx-agent-core` verification.
