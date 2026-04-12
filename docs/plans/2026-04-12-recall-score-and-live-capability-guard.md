# 2026-04-12 Recall Score + Live Capability Guard

## Scope
- Improve `contextdb recall:sessions` ranking stability and explainability.
- Add live execution safety gate for unknown capability surfaces.

## Plan
1. Add weighted scoring in `mcp-server/src/contextdb/core.ts`:
   - Keep lexical match as primary signal.
   - Add recency decay and project-match weight.
   - Expose optional score breakdown when requested.
2. Extend CLI in `mcp-server/src/contextdb/cli.ts`:
   - Add `--explain-score` flag for `recall:sessions`.
3. Add live capability guard in `scripts/lib/lifecycle/orchestrate.mjs`:
   - Block `--execute live` when capability summary has unknown `network/browser/sideEffect` by default.
   - Allow explicit override with `--force` or `AIOS_ALLOW_UNKNOWN_CAPABILITIES=1`.
4. Update help text in `scripts/lib/cli/help.mjs`.
5. Add/adjust tests:
   - `mcp-server/tests/contextdb.test.ts`
   - `scripts/tests/aios-orchestrator.test.mjs`
6. Run focused test commands and report results.
