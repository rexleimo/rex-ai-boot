# Agent Harness Optimization Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `dispatchInsights` into the first team-visible optimization primitive, then use it to drive a research + harness + parallel-agent workflow for the next durability slices.

**Architecture:** Start with source-backed research, then implement one vertical slice that consumes already-persisted dispatch evidence in HUD/team history. Keep the harness evidence-first: every worker step should leave a checkpoint, a test command, and a clear next action. Use parallel workers only where the work is independent enough to avoid shared-state thrash.

**Tech Stack:** TypeScript, `scripts/lib/harness/*`, `scripts/lib/hud/*`, `scripts/lib/lifecycle/*`, ContextDB, repo docs, Node test runner.

---

## Routing

- **Research:** extract lessons from external agent systems and compare them to the current AIOS harness model.
- **Harness:** treat the work as durable, checkpointed, and evidence-backed; do not rely on memory alone.
- **Parallel agent team:** split research, HUD/history wiring, and verification into separate workers when they can proceed independently.

## External Project Lessons

- **OpenAI Agents SDK / Codex harness:** keep agent workflows traceable, support tool use and handoffs, and preserve full traces/evals so operator feedback can be turned into improvements.
- **Anthropic multi-agent research:** use a lead planner plus parallel subagents; subagents act as filters/searchers, while reliability depends on careful prompt/tool design and strong testing.
- **LangGraph durable execution:** checkpoint graph state at execution boundaries, resume from thread/checkpoint identifiers, and treat history as a first-class debug and recovery tool.
- **Temporal durable execution / mcp-agent:** design for pause/resume, retries, human input, and persistent state; keep the workflow code stable while the runtime provides durability.

## Local Findings From 2026-04-23 Harness Intelligence Report

- `dispatchInsights` is already implemented and persisted into dispatch evidence artifacts.
- The report’s next recommended slice was to extend HUD/team history to read and display the latest `dispatchInsights` directly.
- Runtime identity and capability uncertainty should be surfaced more clearly in operator-facing summaries.
- Follow-up backlog also called out stall/auto-nudge, mission-board state, and learn-eval trend integration.
- The report recorded unrelated suite failures in shell install and release preflight; keep those out of this slice unless they block verification.

## First Implementation Slice

**Chosen slice:** surface `dispatchInsights` in HUD/team history first.

**Why this first:** it closes the shortest feedback loop, consumes an artifact that already exists, and proves the evidence path before adding new schema or auto-nudge behavior.

**Target outcome:** when an operator opens HUD or team history, the latest dispatch insight is visible without having to inspect raw evidence artifacts.

## Worker Ownership

- **Worker Research:** confirm external-source lessons and keep the lesson bullets aligned to official docs and repo notes.
- **Worker HUD-History:** implement `dispatchInsights` rendering in HUD/team history and preserve current text/json behavior.
- **Worker Verification:** run the verification commands, capture failures precisely, and stop the team if the slice regresses evidence or rendering.
- **Worker Follow-up:** queue the next slice candidates after the HUD/history path is proven.

## Task Breakdown

### Task 1: Finalize research notes

- [ ] Review the official OpenAI Agents SDK / Codex docs, Anthropic multi-agent article, LangGraph checkpointing docs, Temporal docs, and `mcp-agent` README.
- [ ] Reduce each source to one durable lesson that applies to AIOS.
- [ ] Keep the lessons focused on runtime structure, traceability, handoffs, checkpointing, and recovery.

### Task 2: Wire the first slice

- [ ] Extend the HUD/team history read path to include the most recent `dispatchInsights` from dispatch evidence.
- [ ] Render the insight summary in both text and JSON output paths without changing existing field names.
- [ ] Keep the UI concise: status, score, runtime identity, signals, and suggested actions.

### Task 3: Verify and record evidence

- [ ] Run `git diff --check`.
- [ ] Run the narrow tests for the HUD/history path that exercise `dispatchInsights` rendering.
- [ ] Run the broader repo script suite to make sure the new display path does not break existing harness behavior.
- [ ] Record the pass/fail result in the work log and ContextDB checkpoint before moving on.

## Verification Commands

- `git diff --check`
- `node --test scripts/tests/hud-state.test.mjs`
- `npm run test:scripts`
- `cd mcp-server && npm run typecheck && npm run test && npm run build`

## Stop Conditions

- Stop after the first slice is verified and evidence is recorded.
- Stop if the HUD/history path cannot read `dispatchInsights` without changing evidence schema unexpectedly.
- Stop if verification reveals a regression outside the slice; log it, do not widen scope mid-stream.
- Stop if any source lesson is still ambiguous enough to affect the plan; resolve the ambiguity before implementation.

## Follow-up Backlog

1. Add stall detection and auto-nudge recommendations when progress stops changing.
2. Add a mission-board schema for worker heartbeat, mailbox, and resume/stop state.
3. Feed `dispatchInsights` into learn-eval trend analysis so repeated failures become concrete policy recommendations.
4. Surface runtime identity and capability uncertainty more explicitly across status, history, and report views.
5. Track the unrelated shell install and release preflight failures as separate maintenance work.

