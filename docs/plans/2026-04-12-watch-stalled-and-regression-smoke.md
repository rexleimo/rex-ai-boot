# 2026-04-12 Team Watch Stalled Alert + Regression Smoke

## Scope
- Add `stalled` alerting for `team status --watch` when job/tool progress does not change past a threshold.
- Add regression coverage for `recall -> orchestrate -> team status` workflow.
- Add watch-mode performance smoke check for team status rendering loop.

## Implementation
1. `scripts/lib/lifecycle/team-ops.mjs`
   - Add watch progress signature tracking and stall detection.
   - Surface stall metadata via `watchMeta`.
   - Keep threshold configurable via env (`AIOS_WATCH_STALLED_MS`).
2. `scripts/lib/hud/render.mjs`
   - Extend watch meta rendering to include stalled signal.
3. `scripts/tests/hud-state.test.mjs`
   - Add stalled rendering + team status watch stall smoke tests.
4. `scripts/tests/hud-state.test.mjs`
   - Add end-to-end regression test that checks recall + orchestrate + team status chain.
5. `scripts/perf-team-status-watch-smoke.mjs`
   - Add finite-loop watch perf smoke script with p95 guard.
6. `package.json`
   - Register perf smoke npm script.

## Verification
- `node --test scripts/tests/hud-state.test.mjs`
- `npm run perf:team-status-watch:smoke`
