# Dispatch Hindsight Eval + Lesson Distiller Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a token-free hindsight layer on top of `learn-eval` that compares recent `dispatch-run-*.json` artifacts and highlights repeat-blocked / regression / resolved transitions with actionable next steps.

**Architecture:** Load the most recent dispatch evidence artifacts for a session, compare consecutive runs by `jobId`, classify transitions (`blocked->blocked`, `blocked->done`, `done->blocked`), then distill compact “lessons” with hints + suggested commands. Persist only in the learn-eval report JSON/text output (no ContextDB schema migrations).

**Tech Stack:** Node.js ESM (`.mjs`), filesystem ContextDB artifacts under `memory/context-db/sessions/<session>/artifacts`.

---

### Task 1: Add hindsight evaluator module

**Files:**
- Create: `scripts/lib/harness/hindsight-eval.mjs`

- [ ] **Step 1: Build artifact-only evaluator**
  - Input: `rootDir`, `meta`, `dispatchEvidence[]`
  - Output: counts (`repeatedBlockedTurns`, `regressions`, `resolvedBlockedTurns`) + `lessons[]`

- [ ] **Step 2: Keep the module token-free**
  - No model calls; purely heuristic extraction from dispatch artifacts.

### Task 2: Wire hindsight into learn-eval JSON

**Files:**
- Modify: `scripts/lib/harness/learn-eval.mjs`
- Test: `scripts/tests/aios-learn-eval.test.mjs`

- [ ] **Step 1: Import `buildHindsightEval`**
- [ ] **Step 2: Attach to report**
  - Add `report.signals.dispatch.hindsight` (additive; avoid breaking existing consumers).

### Task 3: Render hindsight summary in text output

**Files:**
- Modify: `scripts/lib/harness/learn-eval.mjs`

- [ ] **Step 1: Add a compact summary line**
  - Include pairs analyzed + key counters.
- [ ] **Step 2: Print a few lesson hints (bounded)**
  - Keep output short (e.g. top 2–3).

### Task 4: Add unit tests for repeat-blocked / regression / resolved

**Files:**
- Modify: `scripts/tests/aios-learn-eval.test.mjs`

- [ ] **Step 1: Extend fixtures to write 2+ dispatch artifacts**
  - Same `jobId` across runs, varying `status`.
- [ ] **Step 2: Assert new fields**
  - `report.signals.dispatch.hindsight.*` counters and lessons.
- [ ] **Step 3: Assert rendering includes hindsight summary**

### Task 5: Verify + checkpoint

- [ ] **Step 1: Run targeted tests**
  - `node --test scripts/tests/aios-learn-eval.test.mjs`
- [ ] **Step 2: Run full script tests**
  - `npm run test:scripts`
- [ ] **Step 3: Write ContextDB checkpoint + context pack**
  - `cd mcp-server && npm run contextdb -- checkpoint ...`
  - `cd mcp-server && npm run contextdb -- context:pack ...`

