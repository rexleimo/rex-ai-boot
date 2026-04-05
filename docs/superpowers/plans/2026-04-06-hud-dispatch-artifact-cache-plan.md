# HUD Dispatch Artifact Cache Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speed up HUD/team ops by caching dispatch artifact directory listings + parsed latest dispatch artifact, and by seeding `artifactCache` (latest only) when calling `buildHindsightEval`.

**Architecture:** Add a bounded LRU cache in `scripts/lib/hud/state.mjs` keyed by `{rootDir, sessionId}` that memoizes dispatch-run filenames (validated by artifacts dir mtime + TTL). Use it in `findLatestDispatchArtifact()` and `collectRecentDispatchEvidence()` to avoid duplicate `readdir()` calls. Cache the parsed latest dispatch summary object to avoid repeated JSON parsing during `--watch`. Update `readHudState()` and `readHudDispatchSummary()` to pass `artifactCache` seeded only with the already-parsed latest dispatch artifact into `buildHindsightEval`.

**Tech Stack:** Node 22 ESM, built-in `node:test`.

---

## File Structure

### Existing Files To Modify

- `scripts/lib/hud/state.mjs`
  - Add dispatch index cache + parsed latest cache.
  - Update HUD readers to seed `artifactCache` (latest only).
- `scripts/tests/hud-state.test.mjs`
  - Add invalidation regression test.

---

## Chunk 1: Tests First

### Task 1: Add cache invalidation regression test

**Files:**
- Modify: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Write a failing test**

Create a session with:
- `meta.json`
- `dispatch-run-<older>.json`
- Call `readHudDispatchSummary()` and assert latest artifact path is `<older>`.
- Write `dispatch-run-<newer>.json`.
- Call again and assert latest artifact path is `<newer>`.

- [ ] **Step 2: Run focused tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: FAIL once caching is introduced incorrectly (guardrail for invalidation).

---

## Chunk 2: Implementation

### Task 2: Implement cached dispatch artifact index + latest dispatch cache

**Files:**
- Modify: `scripts/lib/hud/state.mjs`

- [ ] **Step 1: Add cache constants + helpers**

Add:
- `DISPATCH_INDEX_CACHE_TTL_MS = 2000`
- `DISPATCH_INDEX_CACHE_MAX_ENTRIES = 32`
- `DISPATCH_INDEX_CACHE` (LRU Map)
- Optional `DISPATCH_INDEX_IN_FLIGHT` Map for dedupe

Helper:
- `getDispatchIndexKey(rootDir, sessionId)`
- `getCachedDispatchIndex(...)` / `setCachedDispatchIndex(...)`
- `loadDispatchRunNames(...)` (stat + conditional readdir + filter + sort)

- [ ] **Step 2: Refactor `findLatestDispatchArtifact()`**

Use cached index:
- Determine latest filename from cached `names`.
- Reuse cached `latestDispatch` when valid.
- Otherwise read/parse JSON once and store `latestDispatch` in the cache entry.

- [ ] **Step 3: Refactor `collectRecentDispatchEvidence()`**

Use cached index `names` and slice to `limit`.

- [ ] **Step 4: Run focused tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS.

### Task 3: Seed `artifactCache` (latest only) for `buildHindsightEval`

**Files:**
- Modify: `scripts/lib/hud/state.mjs`

- [ ] **Step 1: Update `readHudDispatchSummary()`**

- Create `artifactCache` and seed it only with `latestDispatch.raw`.
- Pass `artifactCache` to `buildHindsightEval`.
- Remove any eager preloading of other artifacts.

- [ ] **Step 2: Update `readHudState()` similarly**

Seed `artifactCache` with `latestDispatch.raw` and pass to `buildHindsightEval`.

- [ ] **Step 3: Run focused tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS.

---

## Chunk 3: Full Verification + Ship

### Task 4: Run full scripts test suite

- [ ] **Step 1: Run full suite**

Run: `npm run test:scripts`
Expected: PASS.

### Task 5: Commit + push

- [ ] **Step 1: Commit**

Run:
`git status --short`
`git add -A`
`git commit -m "perf(hud): cache dispatch artifacts for watch"`

- [ ] **Step 2: Push**

Run: `git push`

