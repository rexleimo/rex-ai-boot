# Clarity Gate Threshold and Signal Analysis (session codex-cli-20260303T080437-065e16c0)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain why `clarity-needs-input` keeps recurring for this session and define safe, minimal tuning options for human-gate behavior.

**Architecture:** Evidence-only analysis from existing ContextDB/session artifacts and harness code. No behavior changes are made in this checkpoint.

**Tech Stack:** AIOS CLI (`scripts/aios.mjs`), harness modules (`scripts/lib/harness/*`), ContextDB index/session JSONL.

---

## Findings (Evidence)

1. `learn-eval` still reports recurring clarity failures in the latest 30-sample window.
   - Command: `node scripts/aios.mjs learn-eval --session codex-cli-20260303T080437-065e16c0 --limit 30 --format json`
   - Result: `clarity-needs-input=11`, `dispatch-runtime-blocked=6`, status counts `blocked=19 running=11`.

2. Human-gate reasons are dominated by two triggers:
   - blocked checkpoints threshold reached
   - auth/payment/policy boundary signals detected
   - Evidence: `memory/context-db/index/events.jsonl` human-gate seq `34,43,47,50,52,57,60,63,65,67,69,71`.

3. Gate logic currently uses broad text-pattern matching over planner/implementer narrative snippets.
   - Source: `scripts/lib/harness/clarity-gate.mjs`
   - `collectPayloadSnippets()` includes `contextSummary`, `findings`, `openQuestions`, `recommendations`, and errors.
   - `BOUNDARY_PATTERNS` matches general terms like `auth`, `payment`, `policy`, `privacy`, `legal`.

4. Gate logic compares blocked history using `learn-eval` status counts, which includes prior clarity blocks.
   - Source: `scripts/lib/harness/clarity-gate.mjs`
   - `blockedCheckpoints = learnEvalReport.status.counts.blocked`
   - Default threshold is `2` (from `AIOS_HUMAN_GATE_BLOCKED_THRESHOLD`, fallback `2`).

5. In this session, blocked history remained above threshold in repeated runs (`5-8`), so gate stayed latched.
   - Evidence: clarity checkpoint summaries at seq `73,76,78,83,86,89,91,93,95,97`.

## Root Cause

Two coupled conditions created persistent re-triggering:
- Historical blocked counts (including earlier clarity blocks) keep `blockedCheckpoints >= 2`.
- Boundary keyword matching fires on operational/planning prose that references prior auth/payment/policy incidents, even when the run is otherwise `live ready`.

This produces a high false-positive rate for sessions doing telemetry/planning follow-up rather than risky live actions.

## Tuning Options

### Option A: Runtime env-only tuning (fast, no code change)
- Raise threshold for this session/workflow:
  - `AIOS_HUMAN_GATE_BLOCKED_THRESHOLD=6` (or higher, based on tolerance)
- Optional temporary loosen for broad text scans:
  - Keep boundary trigger active, but rely on threshold + operator review.

Pros: immediate, reversible, no code diff.
Cons: coarse control; can hide genuinely risky blocked patterns if set too high.

### Option B: Narrow boundary signal extraction (code change)
- Restrict boundary scan inputs to `openQuestions` + explicit action fields.
- Exclude historical narrative strings in `findings/recommendations` from boundary matching.

Pros: reduces false positives from retrospective prose.
Cons: requires code/test updates.

### Option C: Decouple clarity blocks from blocked-threshold input (code change)
- Compute threshold from non-clarity blocked checkpoints, or apply recency/decay.
- Example: only count `dispatch-runtime-blocked` in threshold metric.

Pros: avoids self-reinforcing feedback loop.
Cons: needs policy decision and regression tests.

## Recommended Next Step

1. Apply Option A first for controlled live sampling (`AIOS_HUMAN_GATE_BLOCKED_THRESHOLD=6`).
2. If false positives persist, implement Option B + C together with tests in `scripts/tests/aios-orchestrator.test.mjs`.
3. Re-run one controlled live dispatch and compare resulting human-gate reason payload against seq `71` baseline.

