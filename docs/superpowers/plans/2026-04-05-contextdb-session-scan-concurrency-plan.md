# ContextDB Session Scan Concurrency Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speed up `listContextDbSessions()` by reading `meta.json` concurrently (default concurrency=8, clamped), without changing output semantics.

**Architecture:** Keep `listContextDbSessions()`’s public contract and sorting the same. Replace sequential per-directory `safeReadJson(meta.json)` reads with a small promise pool that reads and normalizes metas in parallel, then filters/sorts/slices as before.

**Tech Stack:** Node 22 ESM, built-in `node:test`.

---

## File Structure

### Existing Files To Modify

- `scripts/lib/hud/state.mjs`
  - Implement bounded concurrency in `listContextDbSessions()`.
- `scripts/tests/hud-state.test.mjs`
  - Add regression test for provider-latest selection across a larger session set.

---

## Chunk 1: Tests First (TDD)

### Task 1: Add regression test for large session scans

**Files:**
- Modify: `scripts/tests/hud-state.test.mjs`

- [ ] **Step 1: Write a failing test**

Add a test that:
- Creates ~40 session directories under `memory/context-db/sessions`
- Writes valid `meta.json` for all (mix codex/claude agents)
- Ensures `selectHudSessionId({ provider: 'codex' })` still picks the newest codex session

- [ ] **Step 2: Run focused tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS initially (test should validate current behavior), but it will become a guardrail for the refactor.

---

## Chunk 2: Implementation

### Task 2: Implement bounded concurrency in `listContextDbSessions()`

**Files:**
- Modify: `scripts/lib/hud/state.mjs`

- [ ] **Step 1: Add a local `mapWithConcurrency` helper**

Add near other local helpers:
- `normalizeConcurrency(value, fallback)`
- `mapWithConcurrency(items, concurrency, mapper)`

Defaults:
- `fallback=8`, clamp `1..32`

- [ ] **Step 2: Refactor session meta reading to use the pool**

Implementation outline:
- Keep the existing early returns (`existsSync`, `readdir` try/catch).
- Build a bounded list of candidate directories (preserve the existing `max * 4` guard).
- Use `mapWithConcurrency` to read `meta.json` and normalize results.
- Filter by requested agent after parse.
- Compute `updatedAt`, sort desc, slice to `limit`.

- [ ] **Step 3: Run focused tests**

Run: `node --test scripts/tests/hud-state.test.mjs`
Expected: PASS.

---

## Chunk 3: Full Verification + Ship

### Task 3: Run scripts test suite

- [ ] **Step 1: Run full suite**

Run: `npm run test:scripts`
Expected: PASS.

### Task 4: Commit + push

- [ ] **Step 1: Commit**

Run:
`git status --short`
`git add -A`
`git commit -m "perf(hud): read session metas concurrently"`

- [ ] **Step 2: Push**

Run: `git push`

