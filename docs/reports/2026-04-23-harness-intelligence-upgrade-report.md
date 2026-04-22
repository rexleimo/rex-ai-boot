# Harness Intelligence Upgrade Report

Date: 2026-04-23
Session: `codex-cli-20260422T221359-c03838c4`
Implementation commit: `9dc5c10429dccf688a7275bbc59b92ff480ac3e7` (`feat(harness): add dispatch insights`)

## Objective

Update the referenced open-source agent projects, use a team review to identify harness-engine intelligence improvements, choose a practical optimization slice, implement it, and leave a verifiable record for follow-up review.

## Reference Repositories Updated

Local reference snapshots under `temp/vendor/` were refreshed to these commits:

- `oh-my-codex`: `d56148c`
- `oh-my-claudecode`: `0ac52cda`
- `hermes-agent`: `a1d57292`
- `superpowers`: `b557648`
- `OpenViking`: `5a8ed95a`

These directories are ignored vendor references and were not committed into this repository.

## Team Review Summary

Four explorer agents reviewed the updated references and local AIOS harness surface:

- `oh-my-codex` / `oh-my-claudecode`: mission-board style runtime state, heartbeat, mailbox, stall detection, auto-nudge, explicit stop and resume-safe cleanup.
- `hermes-agent` / `OpenViking`: session-aware retrieval, telemetry-first insights, capability and guardrail surfacing, atomic session recovery.
- `superpowers`: stronger process enforcement, plan review, chunked execution, implement/spec-review/code-review stages, verification-before-completion gates.
- Local AIOS harness: runtime identity should be surfaced more directly in operator-facing summaries and team status.

## Optimization Points Identified

1. Add a mission-board layer for worker status, heartbeat, mailbox, and event timeline.
2. Add proactive stall and auto-nudge recommendations when dispatch progress stops.
3. Add session-aware retrieval and reranking for better context selection before orchestration.
4. Convert dispatch telemetry into reusable insight objects instead of scattered report fields.
5. Add stricter stage gates for implement, review, security, and verification phases.
6. Surface runtime identity and capability uncertainty in reports and persisted artifacts.

## Implemented Slice

This iteration implemented item 4 and part of item 6: `dispatchInsights`.

New behavior:

- Builds a normalized insight object from dispatch run, dispatch plan, work-item telemetry, executor capability manifest, and clarity gate.
- Emits `schemaVersion`, `generatedAt`, `status`, `score`, `runtime`, `signals`, and `suggestedActions`.
- Detects blocked work, same-hypothesis retries, unknown capability surfaces, human clarity gates, high token usage, unexecuted plans, and clean dispatches.
- Renders a `Dispatch Insights:` block in text orchestration reports.
- Persists `dispatchInsights` into dispatch evidence artifacts for later HUD, history, or learn-eval consumption.

Changed files in implementation commit:

- `docs/plans/2026-04-23-harness-intelligence-upgrade.md`
- `scripts/lib/harness/dispatch-insights.mjs`
- `scripts/lib/harness/orchestrator-evidence.mjs`
- `scripts/lib/harness/orchestrator.mjs`
- `scripts/lib/lifecycle/orchestrate.mjs`
- `scripts/tests/aios-orchestrator.test.mjs`

## Verification Evidence

Passed:

```bash
git diff --check
node --test scripts/tests/aios-orchestrator.test.mjs
```

Targeted orchestrator result:

```text
# tests 90
# pass 90
# fail 0
```

Partial full-suite result:

```bash
npm run test:scripts
```

Full root script suite result:

```text
# tests 315
# pass 311
# fail 4
```

Observed failures were outside the changed harness dispatch-insights path:

- `scripts/tests/aios-components.test.mjs:114` shell install expected managed block count mismatch.
- `scripts/tests/aios-components.test.mjs:142` Windows shell install expected managed block count mismatch.
- `scripts/tests/aios-components.test.mjs:192` shell install existing ContextDB runtime reuse expectation mismatch.
- `scripts/tests/release-pipeline.test.mjs:145` release dry-run failed because skills sync drift was detected.

## Follow-Up Backlog

Recommended next implementation order:

1. Extend HUD/team history to read and display latest `dispatchInsights` directly.
2. Add stall and auto-nudge recommendations based on heartbeat or unchanged progress counters.
3. Add mission-board state schema for worker heartbeat, mailbox, and stop/resume status.
4. Feed `dispatchInsights` into learn-eval trend analysis so repeated failures become concrete policy recommendations.
5. Resolve or separately track the current shell install and release preflight full-suite failures.
