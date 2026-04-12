# 2026-04-12 CI Perf Gate Extension (Team Status Watch)

## Goal
- Wire `team status --watch` performance smoke into `ci-main` so regressions are caught before merge.

## Changes
1. `.github/workflows/ci-main.yml`
   - Keep existing orchestrate/learn-eval perf smoke gate.
   - Add `npm run perf:team-status-watch:smoke -- --json-out test-results/perf-team-status-watch-smoke.json`.
   - Upload both perf reports via `test-results/perf-*.json`.
2. `scripts/tests/README.md`
   - Update CI mapping to include the new perf gate.
   - Update troubleshooting artifact path for orchestrate/learn-eval smoke.
   - Document team status watch perf smoke CI artifact path.

## Verification
- `npm run perf:orchestrate-learn-eval:smoke -- --json-out test-results/perf-orchestrate-learn-eval-smoke.local.json`
- `npm run perf:team-status-watch:smoke -- --json-out test-results/perf-team-status-watch-smoke.local.json`
