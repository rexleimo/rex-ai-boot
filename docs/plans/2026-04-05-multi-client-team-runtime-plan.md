# 2026-04-05 Multi-Client Team Runtime Plan

## Goal

Ship one-click `aios team` live runtime with multi-client support (`codex` / `claude` / `gemini`) and keep `orchestrate` as the low-level fallback.

## Scope

1. Runtime
- expand subagent live client allowlist from codex-only to:
  - `codex-cli`
  - `claude-code`
  - `gemini-cli`
- keep unsupported clients hard-failing with actionable error text.

2. CLI
- add top-level `team` command:
  - shorthand: `<workers:provider>` (example: `3:codex`)
  - map provider to runtime client id
  - auto-wire env:
    - `AIOS_EXECUTE_LIVE=1` (live mode)
    - `AIOS_SUBAGENT_CLIENT=<mapped-client>`
    - `AIOS_SUBAGENT_CONCURRENCY=<workers>`
  - call `orchestrate` with `--dispatch local` and `--execute live|dry-run`.

3. Tests and Docs
- update orchestrator runtime test from codex-only assertion to unsupported-client assertion.
- add CLI parse coverage for `team` shorthand and flag overrides.
- update `README.md`, `README-zh.md`, and CLI help examples.

4. Reliability Follow-up (resume/retry)
- add `team --resume <session-id> --retry-blocked`.
- load latest blocked dispatch artifact in the target session and replay only blocked jobs.
- seed dependency handoffs from the prior artifact so replay jobs can run without full DAG re-execution.

## Verification

- `node --test scripts/tests/aios-cli.test.mjs scripts/tests/aios-orchestrator.test.mjs`
