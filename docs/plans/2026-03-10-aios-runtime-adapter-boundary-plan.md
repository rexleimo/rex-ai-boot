# AIOS Runtime Adapter Boundary Implementation Plan

I'm using the writing-plans skill to create the implementation plan.

**Goal:** Add the final plan-level runtime adapter boundary before any real runtime integration so orchestration stays runtime-agnostic while `dry-run` execution flows through a stable runtime contract.

**Architecture:** Introduce a new dispatch runtime registry above the existing local executor registry. Keep `dispatchPlan` unchanged and runtime-agnostic. Route `orchestrate --execute dry-run` through a `local-dry-run` runtime adapter that wraps the current local dispatch executor path. Add additive `dispatchRun.runtime` metadata and preserve existing evidence persistence.

**Tech Stack:** Node.js ESM, existing AIOS harness/lifecycle modules, Node test runner, ContextDB evidence persistence

---

### Task 1: Add failing runtime registry tests

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

**Steps:**
1. Add a test for listing and reading dispatch runtimes.
2. Add a test that `dry-run` selects the `local-dry-run` runtime.
3. Add a test that unknown runtime ids throw.
4. Add a test that unsupported execution modes throw.
5. Run `node --test scripts/tests/aios-orchestrator.test.mjs` and confirm the new tests fail for the expected reason.

### Task 2: Add the runtime registry module

**Files:**
- Add: `scripts/lib/harness/orchestrator-runtimes.mjs`

**Steps:**
1. Create a minimal runtime catalog for plan-level runtimes.
2. Define helpers: `listDispatchRuntimes`, `getDispatchRuntime`, `selectDispatchRuntime`, `createDispatchRuntimeRegistry`, and `resolveDispatchRuntime`.
3. Add the `local-dry-run` runtime definition with `requiresModel=false` and `executionModes=['dry-run']`.
4. Make the runtime adapter contract accept whole-plan execution input instead of per-job input.
5. Re-run the targeted tests and confirm the registry tests pass.

### Task 3: Route local dry-run execution through the runtime boundary

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/lib/harness/orchestrator-executors.mjs` only if helper exports need to move or be shared

**Steps:**
1. Extract any reusable local execution helper needed by the runtime layer without changing dispatch DAG behavior.
2. Add a runtime-facing execution helper that returns the existing `dispatchRun` shape plus runtime metadata.
3. Keep the local executor registry as an internal implementation detail of the local runtime path.
4. Ensure `dispatchRun.executorRegistry`, `dispatchRun.executorDetails`, `dispatchRun.jobRuns`, and `dispatchRun.finalOutputs` remain stable.
5. Re-run targeted orchestrator tests.

### Task 4: Wire lifecycle execution to the runtime registry

**Files:**
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`

**Steps:**
1. Replace direct local dispatch execution calls with runtime resolution by execution mode.
2. Ensure `executionMode=none` does not resolve or execute a runtime.
3. Ensure `executionMode=dry-run` resolves `local-dry-run`.
4. Preserve preflight behavior and effective policy derivation.
5. Ensure persisted evidence still uses the returned `dispatchRun` result without special-casing the local path.
6. Re-run targeted lifecycle tests.

### Task 5: Add integration and failure-path coverage

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

**Steps:**
1. Add a test that `runOrchestrate --execute dry-run` returns `dispatchRun.runtime`.
2. Add a test that blocked merge-gate runs still return `dispatchRun.ok=false` without throwing.
3. Add a test that invalid runtime resolution or invalid runtime output throws.
4. Add a test that evidence persistence artifacts include runtime metadata.
5. Run `node --test scripts/tests/aios-orchestrator.test.mjs` until all targeted tests pass.

### Task 6: Update design docs to reflect the new boundary

**Files:**
- Modify: `docs/plans/2026-03-09-aios-orchestrator-blueprints-design.md`
- Modify: `docs/plans/2026-03-10-aios-runtime-adapter-boundary-design.md` only if implementation details changed during delivery

**Steps:**
1. Add a short section noting that dry-run execution is now mediated by a plan-level runtime adapter.
2. Keep the wording explicit that `dispatchPlan` stays runtime-agnostic.
3. Mention that the current runtime catalog contains only `local-dry-run`.
4. Re-read the docs for consistency with the implemented contract.

### Task 7: Verify end-to-end behavior

**Verification:**
1. `node --test scripts/tests/aios-orchestrator.test.mjs`
2. `npm run test:scripts`
3. `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute dry-run --format json`
4. `node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --preflight auto --format json`
5. `cd mcp-server && npm run typecheck && npm run build`

**Expected outcomes:**
- `dry-run` output includes `dispatchRun.runtime.id=local-dry-run`
- existing executor/job run details remain present
- preflight behavior remains unchanged
- no real runtime is invoked
- evidence artifacts continue to persist successfully

### Task 8: Prepare closeout

**Steps:**
1. Inspect `git diff --stat` to confirm only the intended files changed.
2. Summarize the runtime boundary in the final handoff.
3. If requested, apply semantic versioning guidance after implementation based on actual impact.
