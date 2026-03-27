---
title: Changelog
description: Release history, upgrade notes, and links to detailed docs updates.
---

# Changelog

Use this page to track what changed in `RexCLI` and jump to release-related docs.

## Official Release History

- GitHub changelog file: [CHANGELOG.md](https://github.com/rexleimo/rex-cli/blob/main/CHANGELOG.md)
- GitHub releases: [releases](https://github.com/rexleimo/rex-cli/releases)

## Recent Versions

- `main` (Unreleased):
  - **Multi-environment RL training system**: shared `rl-core` control plane with shell, browser, and orchestrator adapters; three-pointer checkpoint lineage; four-lane replay pool; PPO + teacher distillation training
  - **Mixed-environment campaigns** (`rl-mixed-v1`): one live batch can span shell + browser + orchestrator episodes with unified rollback decision
  - ContextDB `search` now defaults to SQLite FTS5 + `bm25(...)` ranking, with automatic lexical fallback when FTS is unavailable
  - ContextDB semantic rerank now operates on query-scoped lexical candidates, reducing drops of older exact matches
  - `subagent-runtime` live execution for `aios orchestrate` (opt-in via `AIOS_EXECUTE_LIVE=1`)
  - bounded work-item queue scheduling with ownership hints
  - no-op fast path: auto-complete `reviewer` / `security-reviewer` when upstream handoffs touched no files
  - Windows PowerShell shell-smoke workflow on each push to `main` (`.github/workflows/windows-shell-smoke.yml`)
  - scope-aware `skills` install flow with `global` / `project` target selection
  - canonical skill authoring now lives in `skill-sources/`, with repo-local client roots generated via `node scripts/sync-skills.mjs`
  - default skills install mode is now portable `copy`; explicit `--install-mode link` remains available for local development
  - release packaging/preflight now validates generated skill roots with `check-skills-sync`
  - catalog-driven skill picker with core defaults, optional business skills, and uninstall showing installed items only
  - TUI skill picker groups entries into `Core` and `Optional` with truncated descriptions for terminal readability
  - `doctor` now warns when a project skill overrides a global install of the same name
  - Node runtime guidance is now explicitly aligned on Node 22 LTS
- `0.17.0` (2026-03-17):
  - TUI uninstall picker now scrolls in smaller terminals and keeps `Select all` / `Clear all` / `Done` anchored at the bottom
  - uninstall cursor selection now stays aligned with the rendered grouped list
  - setup/update skill pickers now label already-installed skills with `(installed)`
- `0.16.0` (2026-03-10): add orchestrator agent catalog and generators
- `0.15.0` (2026-03-10): gate live orchestrate execution behind `AIOS_EXECUTE_LIVE`
- `0.14.0` (2026-03-10): add `subagent-runtime` runtime adapter (stub)
- `0.13.0` (2026-03-10): externalize runtime manifest spec
- `0.11.0` (2026-03-10): expand local orchestrate preflight coverage
- `0.10.4` (2026-03-08): wrapper fallback for non-git workspaces and docs sync
- `0.10.3` (2026-03-08): fix Windows cmd-backed CLI launch
- `0.10.0` (2026-03-08): consolidate lifecycle flow into Node
- `0.8.0` (2026-03-05): add strict Privacy Guard with Ollama support and setup integration
- `0.5.0` (2026-03-03): ContextDB SQLite sidecar index (`index:rebuild`), optional `--semantic` search, unified `ctx-agent` core

## 2026-03-16 Operational Status

- Continuous live samples are succeeding (`dispatchRun.ok=true`) with latest artifact:
  - `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260316T111419Z.json`
- `learn-eval` still recommends:
  - `[fix] runbook.failure-triage` (`clarity-needs-input=5`)
  - `[observe] sample.latency-watch` (`avgElapsedMs=160678`)
- Timeout budgets remain unchanged while latency-watch observation continues.

## Related Reading

- [Blog: Skills install experience update](/blog/2026-03-rexcli-skills-install-experience/)
- [Quick Start](getting-started.md)
- [ContextDB](contextdb.md)
- [Troubleshooting](troubleshooting.md)

## Update Rule

When a release changes setup, runtime behavior, or compatibility, docs are updated in the same PR and reflected here.
