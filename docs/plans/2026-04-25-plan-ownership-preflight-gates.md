# Plan Ownership Preflight Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block risky multi-step/team runs when plan evidence or editable ownership evidence is missing.

**Architecture:** Add a small JSON-first readiness contract module that evaluates plan markdown and editable ownership scopes independently. `orchestrate --preflight auto` will include the readiness verdict in reports and block live execution unless forced; `team --dry-run` inherits the same report because team dispatch already routes through `runOrchestrate`.

**Tech Stack:** Node.js 22 ESM scripts, AIOS lifecycle orchestration modules, Node `--test`, filesystem-backed plan artifacts.

---

## File Map

- Create `scripts/lib/lifecycle/preflight-contracts.mjs`: pure readiness evaluators and merge helper.
- Modify `scripts/lib/lifecycle/orchestrate.mjs`: read plan candidate, evaluate plan/ownership readiness, add report field, and block live execution on hard blockers.
- Modify `scripts/lib/harness/orchestrator.mjs`: render readiness in text reports.
- Modify `scripts/lib/cli/parse-args.mjs`: accept optional `--plan <path>` for `orchestrate` and `team`.
- Modify `scripts/lib/cli/help.mjs`: document `--plan` for orchestrate/team.
- Modify `scripts/aios.mjs`: forward `planPath` from `team` to `runOrchestrate`.
- Create `scripts/tests/preflight-contracts.test.mjs`: direct contract tests.
- Modify `scripts/tests/aios-orchestrator.test.mjs`: orchestrate JSON/text/blocking tests.
- Modify `scripts/tests/aios-cli.test.mjs`: parse/help coverage for `--plan`.
- Modify `README.md`: short usage note for plan/ownership readiness.

## Task 1: Contract Module

- [x] **Step 1: Write failing tests**

Create `scripts/tests/preflight-contracts.test.mjs` with tests for missing plan file, missing headings, complete plan readiness, missing editable ownership, wildcard ownership, and merged verdict precedence.

Run:

```bash
node --test scripts/tests/preflight-contracts.test.mjs
```

Expected before implementation: module import failure.

- [x] **Step 2: Implement minimal contract helpers**

Create `scripts/lib/lifecycle/preflight-contracts.mjs` with:

```js
export const REQUIRED_PLAN_HEADINGS = ['Progress', 'Decision Log', 'Acceptance', 'Next Actions'];
export async function evaluatePlanEvidence(input = {}) {}
export function evaluateOwnershipEvidence(input = {}) {}
export function mergeReadinessVerdicts(...verdicts) {}
```

Readiness shape:

```json
{
  "verdict": "blocked",
  "blockedReasons": [],
  "warnings": [],
  "nextActions": [],
  "evidence": []
}
```

- [x] **Step 3: Verify contract tests pass**

Run:

```bash
node --test scripts/tests/preflight-contracts.test.mjs
```

Expected: all tests pass.

## Task 2: Orchestrate Integration

- [x] **Step 1: Write failing orchestrate tests**

Add tests in `scripts/tests/aios-orchestrator.test.mjs` that:

- `runOrchestrate({ preflightMode: 'auto', planPath, executionMode: 'dry-run' })` includes `readiness.verdict === 'ready'` for a complete plan.
- `runOrchestrate({ preflightMode: 'auto', planPath: missing, executionMode: 'dry-run' })` reports blockers without throwing.
- `runOrchestrate({ preflightMode: 'auto', planPath: missing, executionMode: 'live' })` returns `exitCode: 1` and `kind: 'guardrail.preflight-readiness'`.

Run:

```bash
node --test scripts/tests/preflight-contracts.test.mjs scripts/tests/aios-orchestrator.test.mjs
```

Expected before integration: assertions fail because reports do not include `readiness`.

- [x] **Step 2: Implement readiness collection and live block**

Modify `scripts/lib/lifecycle/orchestrate.mjs` to:

- Normalize optional `planPath`.
- Evaluate plan evidence only when `preflightMode === 'auto'`.
- Evaluate ownership after `basePlan` / `dispatchPlan` exists.
- Include merged `readiness` in JSON and text reports.
- Block live execution when readiness verdict is `blocked` unless `--force` is set.

- [x] **Step 3: Verify orchestrate tests pass**

Run:

```bash
node --test scripts/tests/preflight-contracts.test.mjs scripts/tests/aios-orchestrator.test.mjs
```

Expected: all tests pass.

## Task 3: CLI / Team Wiring / Docs

- [x] **Step 1: Write failing CLI tests**

Add tests in `scripts/tests/aios-cli.test.mjs` asserting:

- `parseArgs(['orchestrate', '--plan', 'docs/plans/example.md'])` sets `options.planPath`.
- `parseArgs(['team', '--plan', 'docs/plans/example.md', '--dry-run'])` sets `options.planPath`.
- orchestrate help mentions `--plan <path>`.

- [x] **Step 2: Wire CLI options**

Modify parse/help/aios entrypoint so `--plan` is accepted by `orchestrate` and team dispatch, and passed to `runOrchestrate`.

- [x] **Step 3: Add docs**

Update `README.md` near orchestration/team guidance with one short section showing:

```bash
node scripts/aios.mjs orchestrate --session <id> --preflight auto --plan docs/plans/<topic>.md --execute dry-run --format json
node scripts/aios.mjs team --session <id> --preflight auto --plan docs/plans/<topic>.md --dry-run --format json
```

- [x] **Step 4: Verify focused PR-4 suite**

Run:

```bash
node --test scripts/tests/preflight-contracts.test.mjs scripts/tests/aios-orchestrator.test.mjs scripts/tests/aios-cli.test.mjs
```

Expected: all tests pass.

## Acceptance

- `readiness` appears in orchestrate JSON/text output for `--preflight auto`.
- Dry-run reports plan/ownership blockers but does not throw.
- Live execution blocks on missing plan/ownership evidence unless `--force` is used.
- Team dry-run forwards plan readiness into the underlying orchestrate report.
- Existing local dry-run and preflight release guard behavior remains unchanged.

## Progress

- [x] PR-3 committed as `84f86b0 feat(contextdb): add compact continuity summaries`.
- [x] PR-4 worktree created at `.worktrees/plan-ownership-preflight-gates`.
- [x] Contract tests written.
- [x] Orchestrate integration complete.
- [x] CLI/team/docs complete.
- [x] Full verification complete.

## Decision Log

- Use `--plan <path>` as explicit plan input to avoid guessing unrelated docs.
- Gate only `--execute live` for this PR; dry-run remains reporting-only.
- Treat `ownedPathHints` as advisory work-item input and resolved job `ownedPathPrefixes` as authoritative execution ownership.

## Acceptance Evidence

- `node --test scripts/tests/preflight-contracts.test.mjs scripts/tests/aios-cli.test.mjs scripts/tests/aios-orchestrator.test.mjs` -> 145 pass / 0 fail.
- `npm run test:scripts` -> 353 pass / 0 fail after syncing local ignored native settings.
- `cd mcp-server && npm run typecheck && npm run test && npm run build` -> typecheck/build pass; 69 pass / 0 fail.
- `node scripts/aios.mjs doctor` -> completed with existing environment warnings for shell/skills/browser, no blocking errors.
- `git diff --check` -> pass.

## Next Actions

- Commit PR-4 changes.
- Keep local ignored `.claude/settings.local.json` generated for release preflight checks.
- Monitor future PR for HUD surfacing of readiness artifacts.
