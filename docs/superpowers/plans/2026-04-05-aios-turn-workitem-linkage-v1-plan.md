# Turn/Work-Item Linkage (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `orchestrate` dispatch artifacts and ContextDB refs carry stable `turnId` + `workItemRefs` so HUD/team ops can show “what is blocked, for which work-item” without any ContextDB schema migrations.

**Architecture:** Treat each `dispatchRun.jobRuns[]` entry as a “turn”. Persist a deterministic `turnId` derived from the dispatch artifact stamp + jobId (+ attempts when present). Attach `workItemRefs` by joining with `dispatchPlan.jobs[].launchSpec.workItemRefs`. Add `env:`/`turn:` refs for searchability via ContextDB events, and surface linkage in HUD rendering.

**Tech Stack:** Node.js (ESM), JSON artifacts under `memory/context-db/sessions/<id>/artifacts`, ContextDB CLI (`mcp-server/src/contextdb/cli.ts`), HUD core (`scripts/lib/hud/*`).

---

## Chunk 1: Persist linkage in dispatch artifacts

### Task 1: Enrich `dispatch-run-*.json` with turn/work-item linkage

**Files:**
- Modify: `scripts/lib/harness/orchestrator-evidence.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Update `persistDispatchEvidence` to compute a dispatch stamp**
  - Reuse the existing `stamp` used in `dispatch-run-${stamp}.json`.
  - Define a stable `dispatchId` (example: `dispatch:${stamp}`) used for turn ids.

- [ ] **Step 2: Build a `jobId -> workItemRefs[]` map from `report.dispatchPlan.jobs`**
  - Read `job.launchSpec.workItemRefs` when present.
  - Normalize to a string array with non-empty ids.

- [ ] **Step 3: Enrich `dispatchRun.jobRuns[]` before writing the artifact**
  - For each jobRun, add:
    - `turnId`: `${stamp}:${jobRun.jobId}:a${attempt}` where `attempt = max(1, floor(jobRun.attempts ?? 1))`
    - `workItemRefs`: from the map (default `[]`)
    - `refs`: include `env:orchestrate`, `dispatch:${stamp}`, `turn:${turnId}`, `job:${jobId}`, plus `work-item:<id>` for each work item
  - Keep existing fields unchanged.

- [ ] **Step 4: Add structured refs to the ContextDB event emitted for dispatch evidence**
  - In `event:add --refs`, include `artifactPath` plus `env:orchestrate` and `dispatch:${stamp}`.

- [ ] **Step 5: Extend `scripts/tests/hud-state.test.mjs` to assert linkage is present**
  - Update the fixture dispatch artifact to include `turnId/workItemRefs`.
  - Assert `readHudState(...).latestDispatch.blocked[0]` carries `turnId` and `workItemRefs`.

- [ ] **Step 6: Run focused tests**
  - Run: `node --test scripts/tests/hud-state.test.mjs`
  - Expected: PASS

---

## Chunk 2: Surface linkage in HUD/team ops

### Task 2: Show `workItemRefs`/`turnId` for blocked jobs in HUD full preset

**Files:**
- Modify: `scripts/lib/hud/state.mjs`
- Modify: `scripts/lib/hud/render.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Extend HUD blocked-job extraction to capture linkage**
  - In `findLatestDispatchArtifact`, when building `blocked[]`, capture:
    - `turnId` (if present)
    - `workItemRefs` (if present)
    - `attempts` (if present)

- [ ] **Step 2: Update `renderHud` full preset blocked lines**
  - Append `wi=<ids>` when `workItemRefs.length > 0`.
  - Append `turn=<turnId>` when present.
  - Keep output compact (single line per blocked job).

- [ ] **Step 3: Run focused tests**
  - Run: `node --test scripts/tests/hud-state.test.mjs`
  - Expected: PASS

---

## Chunk 3: Verification + checkpoint

### Task 3: Full verification and ContextDB checkpoint

**Files:**
- (no code changes)

- [ ] **Step 1: Run full scripts suite**
  - Run: `npm run test:scripts`
  - Expected: PASS

- [ ] **Step 2: Write ContextDB checkpoint with evidence**
  - Use the active `aios` session id (via HUD) and write a `done` checkpoint referencing:
    - `scripts/lib/harness/orchestrator-evidence.mjs`
    - `scripts/lib/hud/state.mjs`
    - `scripts/lib/hud/render.mjs`
    - verification evidence (`npm run test:scripts`)

- [ ] **Step 3: Commit + push**
  - Commit message: `feat: add turn/work-item linkage to dispatch evidence`
  - Push to `main`.

