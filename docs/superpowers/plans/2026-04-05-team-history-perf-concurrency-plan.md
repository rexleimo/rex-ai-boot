# Team History Perf + Concurrency Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speed up `node scripts/aios.mjs team history` by defaulting to concurrency=4, adding `--concurrency <n>`, and reusing parsed dispatch artifacts when computing dispatch hindsight (artifactCache).

**Architecture:** Keep `team status` unchanged. Extend `team history` CLI parsing + help text, then run history collection through a small promise pool that preserves session ordering. In `readHudDispatchSummary`, preload recent dispatch artifacts into an `artifactCache` (seeded with the already-parsed latest dispatch) and pass it into `buildHindsightEval` to avoid redundant JSON reads/parses.

**Tech Stack:** Node 22 ESM, built-in `node:test`.

---

## File Structure

### Existing Files To Modify

- `scripts/lib/cli/parse-args.mjs`
  - Parse `team history --concurrency <n>` and default to `4`.
- `scripts/lib/cli/help.mjs`
  - Document `--concurrency` under `team history`.
- `scripts/lib/lifecycle/team-ops.mjs`
  - Add a small concurrency pool to `runTeamHistory` (stable output order).
- `scripts/lib/hud/state.mjs`
  - Preload dispatch artifacts and pass `artifactCache` into `buildHindsightEval` inside `readHudDispatchSummary`.
- `scripts/tests/aios-cli.test.mjs`
  - Assert parsing + defaults for `--concurrency`.
- `scripts/tests/hud-state.test.mjs`
  - Add an ordering regression test for `runTeamHistory` under concurrency.

---

## Chunk 1: CLI + Behavior Wiring

### Task 1: Add `--concurrency` parsing for `team history`

**Files:**
- Modify: `scripts/lib/cli/parse-args.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`

- [ ] **Step 1: Write a failing parse test**

Add assertions in `scripts/tests/aios-cli.test.mjs`:
- `parseArgs(['team','history'])` defaults `options.concurrency === 4`
- `parseArgs(['team','history','--concurrency','8'])` sets `options.concurrency === 8`

- [ ] **Step 2: Run the focused test**

Run: `node --test scripts/tests/aios-cli.test.mjs`
Expected: FAIL (missing `concurrency` in options).

- [ ] **Step 3: Implement parsing + defaults**

Update `parseTeamHistoryArgs` / `createDefaultTeamHistoryOptions`:
- Default `concurrency: 4`
- Parse `--concurrency <n>` via `parsePositiveInteger`
- Clamp later at runtime (`1..16`) so programmatic callers are safe too.

- [ ] **Step 4: Re-run focused test**

Run: `node --test scripts/tests/aios-cli.test.mjs`
Expected: PASS.

### Task 2: Update help text for `team history`

**Files:**
- Modify: `scripts/lib/cli/help.mjs`

- [ ] **Step 1: Add `--concurrency <n>` to the `team` help**

Document:
- `(team history) Process sessions concurrently (default: 4)`

- [ ] **Step 2: Smoke help output**

Run: `node scripts/aios.mjs help team | rg -n \"--concurrency\"`
Expected: match found.

---

## Chunk 2: Runtime Performance Improvements

### Task 3: Make `runTeamHistory` concurrent by default (order-stable)

**Files:**
- Modify: `scripts/lib/lifecycle/team-ops.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Add an order regression test**

In `scripts/tests/hud-state.test.mjs`:
- Create 2 sessions with different `updatedAt`
- Add 2 dispatch artifacts per session so hindsight has pairs
- Run `runTeamHistory({ json: true, limit: 10, provider: 'codex' }, ...)`
- Assert `report.records.map(r => r.sessionId)` matches updatedAt-desc order.

- [ ] **Step 2: Implement a small promise pool**

In `scripts/lib/lifecycle/team-ops.mjs`:
- Normalize `concurrency` from raw options; default to `4`
- Clamp to `1..16`
- Use `mapWithConcurrency(sessions, concurrency, ...)` to compute each record
- Preserve index order in the returned `records`.

- [ ] **Step 3: Run focused hud-state tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS.

### Task 4: Reuse parsed dispatch artifacts for hindsight (`artifactCache`)

**Files:**
- Modify: `scripts/lib/hud/state.mjs`
- Test: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Seed + preload `artifactCache` in `readHudDispatchSummary`**

Implementation checklist:
- Seed `artifactCache[latestDispatch.artifactPath] = latestDispatch.raw` when available.
- Preload other `dispatchEvidence` artifacts with `safeReadJson` into the cache (best-effort).
- Pass `artifactCache` into `buildHindsightEval({ ..., artifactCache })`.

- [ ] **Step 2: Re-run focused hud-state tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS (no output shape regressions).

---

## Chunk 3: Full Verification + Ship

### Task 5: Run full scripts test suite

- [ ] **Step 1: Run full suite**

Run: `npm run test:scripts`
Expected: PASS.

### Task 6: Commit + push

- [ ] **Step 1: Commit**

Run:
`git status --short`
`git add -A`
`git commit -m "perf(ops): add team history concurrency and reuse dispatch artifacts"`

- [ ] **Step 2: Push**

Run: `git push`

