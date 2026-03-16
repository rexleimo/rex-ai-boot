# Tmp Live Dispatch Resume Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resume the blocked `tmp` ContextDB session by revalidating live codex subagent execution, fixing only the current root cause if it still reproduces, and persisting a fresh checkpoint/export.

**Architecture:** Start with direct reproduction of the exact structured `codex exec` path and the full `aios orchestrate --execute live` path, because prior failures mixed transient `upstream_error` with a later planner timeout. Treat runtime behavior as suspect only if the issue reproduces under current conditions; otherwise avoid new code changes and move straight to verification plus checkpoint updates.

**Tech Stack:** Node.js CLI scripts, ContextDB artifacts/checkpoints, Codex CLI structured exec handoff, Markdown plan/checkpoint docs.

---

### Task 1: Reproduce current live runtime behavior

**Files:**
- Review: `scripts/lib/harness/subagent-runtime.mjs`
- Review: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260313T080142Z.json`
- Update via CLI: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/*`

- [x] Run: `codex --version`
- [x] Run: `node scripts/aios.mjs doctor`
- [x] Run a minimal `codex exec --output-schema --output-last-message` probe from repo root and capture whether it completes cleanly.
- [x] Run: `AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT=codex-cli node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute live --format json`
- [x] Record whether the failure class is still `upstream_error`, `timeout`, or something new.

### Task 2: Apply only the minimal remediation required

**Files:**
- Modify if needed: `scripts/lib/harness/subagent-runtime.mjs`
- Modify if needed: `scripts/lib/harness/orchestrator*.mjs`
- Modify if needed: `scripts/tests/aios-orchestrator.test.mjs`
- Modify if needed: `docs-site/troubleshooting.md`

- [ ] If live execution now passes, make no runtime code changes.
- [x] If live execution still blocks, isolate the exact failing boundary and add the smallest fix or runbook note that addresses that boundary.
- [x] Add or update regression coverage only for the reproduced root cause.

### Task 3: Verify, checkpoint, and export

**Files:**
- Modify: `docs/plans/2026-03-16-tmp-live-dispatch-resume-plan.md`
- Update via CLI: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/*`
- Update via CLI: `memory/context-db/exports/codex-cli-20260303T080437-065e16c0-context.md`

- [x] Run: `npm run test:scripts`
- [x] Run: `cd mcp-server && npm run typecheck && npm run build`
- [x] Run: `node scripts/aios.mjs learn-eval --session codex-cli-20260303T080437-065e16c0 --format json`
- [x] Write a fresh ContextDB event/checkpoint with current status, evidence, and next actions.
- [x] Refresh the exported context packet for this session.

## Outcome

- Fresh reproduction changed the failure shape: the planner phase no longer timed out, but `phase.implement` consumed the full 600000 ms budget on a no-op path.
- A second fresh rerun surfaced a separate environment failure: `context:pack` hit a missing `better-sqlite3` native binding before the helper rebuilt it.
- Runtime fix applied: `scripts/lib/harness/subagent-runtime.mjs` now tells the implementer to return a no-op or needs-input handoff instead of exploring indefinitely when upstream handoffs do not clearly require code changes.
- Helper hardening applied: `scripts/lib/contextdb-cli.mjs` now auto-rebuilds `better-sqlite3` for both ABI mismatch and missing-binding failures.
- Regression coverage added in `scripts/tests/aios-orchestrator.test.mjs` and `scripts/tests/aios-harness.test.mjs`.
- Verified outcome: live dispatch succeeded end-to-end and persisted ContextDB evidence at `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260316T025733Z.json`.
