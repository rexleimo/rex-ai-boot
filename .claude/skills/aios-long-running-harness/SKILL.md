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
