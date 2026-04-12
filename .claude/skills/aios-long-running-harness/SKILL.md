---
name: aios-long-running-harness
description: Use when running multi-step or long-running agent jobs in aios that require checkpointing, retries, evidence capture, and safe human handoff.
---

# AIOS Long-Running Harness

## Overview
Use this harness to keep long tasks stable under UI drift, model variability, and partial failures. It maps Anthropic's long-running-agent harness ideas into this repository's file-based workflow.

## Harness Loop
1. Preflight: lock objective, stop conditions, budgets, and required artifacts.
2. Plan: split into idempotent steps with explicit success/failure evidence.
3. Execute: run one step at a time with tool output capture.
4. Verify: assert completion from page evidence, not assumptions.
5. Checkpoint: persist current state, artifacts, and next action.
6. Recover: on failure, classify and retry only with a changed hypothesis.
7. Complete: run final verification and write summary doc.

## Pairing with Superpowers Skills
- Plan step should be produced through `superpowers:writing-plans` (or `superpowers:brainstorming` first when scope is unclear).
- For 2+ independent domains, use `superpowers:dispatching-parallel-agents`; for coupled domains, run sequentially.
- If the runtime has no true subagent tool, emulate dispatch with explicit per-domain task queues and only parallelize safe independent reads/checks.
- Always finish with `superpowers:verification-before-completion` before claiming run success.

## Orchestrate Live Notes
- `aios orchestrate --execute live` currently supports `AIOS_SUBAGENT_CLIENT=codex-cli` only.
- Codex CLI v0.114+ structured exec outputs (`--output-schema`, `--output-last-message`, stdin) are required for handoff parsing; schema fallback to raw stdout is rejected.
- Transient `upstream_error`/`server_error` failures are retried with exponential backoff via `AIOS_SUBAGENT_UPSTREAM_MAX_ATTEMPTS` and `AIOS_SUBAGENT_UPSTREAM_BACKOFF_MS`.
- Local dispatch reports now include an `Executor Capability Manifest` summary (read/write/network/browser/sideEffect) for preflight visibility before live execution.
- Live execution now blocks by default when capability manifest surfaces are `unknown` (`network` / `browser` / `sideEffect`) via `guardrail.capability-unknown`.
- Override unknown-capability blocking only when intended: `--force` or `AIOS_ALLOW_UNKNOWN_CAPABILITIES=1` (or `AIOS_ALLOW_UNKNOWN_LIVE_CAPABILITIES=1`).
- `team status --watch` / `hud --watch` now surface job-level and tool-level progress so blocked tools are visible without opening artifacts.

Watch examples:
```bash
node scripts/aios.mjs team status --session <session_id> --watch --preset minimal --interval-ms auto
node scripts/aios.mjs hud --session <session_id> --watch --preset minimal --interval-ms auto
```

## Required Controls
- Time budget per step and per run.
- Retry budget per failure class.
- Human-gate checkpoints for login, payment, or policy-sensitive actions.
- Structured logs for every major transition.

## Failure Classes
- Selector/UI drift.
- Authentication/session loss.
- Policy rejection/content moderation.
- Network/transient failures.
- Tool/runtime errors.

## Completion Gate
Declare success only when all are true:
- Target action succeeded.
- Expected artifact exists.
- Evidence snapshot/log exists.
- Updated runbook reflects newly observed drift.

## Resources
- `references/harness-checklist.md`: operational checklist template.
- `references/anthropic-mapping.md`: principle-to-project mapping.
