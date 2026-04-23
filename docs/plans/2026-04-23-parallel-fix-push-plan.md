## Goal

Run three parallel delivery lanes for the current branch:

1. fix the remaining `scripts/tests/aios-components.test.mjs` failures,
2. fix the `mcp-server` Node/`better-sqlite3` ABI mismatch workflow,
3. finish verification and push the resulting branch safely.

## Parallel Lanes

### Lane A — Shell Component Test Fixes

- inspect the three failing `aios-components` shell install assertions,
- align stale expectations with current runtime bootstrap behavior or patch the shell component if behavior is incorrect,
- verify the targeted test file.

### Lane B — `mcp-server` Runtime / ABI Fix

- make `mcp-server` use the repo’s intended Node 22 runtime when invoked from that subdirectory,
- eliminate the `better-sqlite3` ABI mismatch during `npm run test`,
- verify `npm run typecheck`, `npm run test`, and `npm run build` in `mcp-server`.

### Lane C — Push / Release Readiness

- inspect branch and remote state,
- keep unrelated dirty files out of commits,
- push only after the two technical lanes are integrated and verified.

## Integration Plan

1. dispatch the three lanes in parallel with isolated ownership,
2. integrate non-overlapping changes,
3. rerun repo-level verification,
4. push the final branch state.
