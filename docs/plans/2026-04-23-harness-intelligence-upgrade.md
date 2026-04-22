# Harness Intelligence Upgrade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AIOS harness engine smarter by converting dispatch telemetry into actionable runtime insights.

**Architecture:** Keep the first implementation additive and evidence-driven. Add a small harness insights module that reads existing dispatch run, work-item telemetry, capability manifest, and clarity-gate data, then emits normalized status, score, signals, and next actions into orchestration reports and persisted dispatch artifacts.

**Tech Stack:** Node.js ESM, existing AIOS harness modules, ContextDB-backed dispatch artifacts, `node --test`.

---

## Reference Update Evidence

Updated local reference snapshots:

- `temp/vendor/oh-my-codex` -> `d56148c`
- `temp/vendor/oh-my-claudecode` -> `0ac52cda`
- `temp/vendor/hermes-agent` -> `a1d57292`
- `temp/vendor/superpowers` -> `b557648`
- `temp/vendor/OpenViking` -> `5a8ed95a`

## Team Findings

The team review produced five higher-level optimization tracks:

1. Mission-board style runtime state from `oh-my-claudecode`: worker state, heartbeat, mailbox, and event timeline should eventually feed a richer AIOS team status view.
2. Auto-nudge and stall tracking from `oh-my-codex`: idle leader/worker thresholds can become proactive recovery hints.
3. Session-aware retrieval from `OpenViking`: query-time session search and rerank is a larger missing capability.
4. Telemetry-first insights from `OpenViking` and `hermes-agent`: aggregate cost, tool, model, and runtime telemetry should become reusable insights, not one-off report fields.
5. Stronger execution enforcement from `superpowers`: staged implement/spec-review/code-review and hard verification gates are good follow-up phases.

## This Iteration

Ship the smallest high-impact slice:

- Add `dispatchInsights` to orchestration output and dispatch artifacts.
- Include runtime identity in the insight summary.
- Detect blocked work, same-hypothesis retries, unknown capability surfaces, clarity human gate, and high cost.
- Emit deterministic next actions that operators can follow.
- Render the insight block in text reports.

## Implementation Tasks

### Task 1: Add dispatch insights module

**Files:**
- Create: `scripts/lib/harness/dispatch-insights.mjs`
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

- [ ] Build `buildDispatchInsights({ dispatchRun, dispatchPlan, workItemTelemetry, executorCapabilityManifest, clarityGate })`.
- [ ] Normalize output as `schemaVersion`, `status`, `score`, `runtime`, `signals`, and `suggestedActions`.
- [ ] Add unit tests for blocked jobs, same-hypothesis retries, unknown capabilities, clarity gate, and successful dispatch.

### Task 2: Wire insights into orchestrate and artifacts

**Files:**
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

- [ ] Build insights after `workItemTelemetry`.
- [ ] Include `dispatchInsights` in report objects and persisted dispatch artifacts.
- [ ] Render `Dispatch Insights:` in text reports.
- [ ] Add tests for JSON output, artifact persistence, and text rendering.

### Task 3: Document outcome

**Files:**
- Create: `docs/reports/2026-04-23-harness-intelligence-upgrade-report.md`

- [ ] Record updated reference commits.
- [ ] Summarize team recommendations and selected implementation.
- [ ] Include verification commands and git commits.

## Verification

Focused verification:

```bash
node --test scripts/tests/aios-orchestrator.test.mjs
```

Full root verification if time permits:

```bash
npm run test:scripts
```
