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
  - **ContextDB Shell startup optimization** (2026-04-22): `ctx()` now prefers compiled `mcp-server/dist/contextdb/cli.js` over `npm run -s contextdb`, cutting per-call overhead from ~0.3s to ~0.06s; one-shot agent launch improved from ~2.2s to ~0.5s (~78% faster); shell-bridge `detectRunner` no longer requires `tsx`; install flow auto-builds `dist/` when missing and gracefully falls back to npm-run mode on build failure
  - **Default core skills update** (2026-04-19): `awesome-design-md`, `frontend-design`, and `cap-commit-push` promoted to default core skills
  - **ContextDB lazy load** (2026-04-18 to 2026-04-19): interactive sessions now default to lazy context loading (`CTXDB_LAZY_LOAD=on`); agents self-discover memory via facade prompt instead of receiving a full context pack upfront; added [lazy-load documentation](contextdb.md#lazy-load) and multilingual blog posts
  - **AIOS workflow router skill** (2026-04-18): added `.claude/skills/aios-workflow-router` for reliable task-to-skill routing and discovery
  - **Route/concurrency docs refresh + default concurrency = 3** (2026-04-20): documented a compact profile for interactive routing and parallel settings (`CTXDB_INTERACTIVE_AUTO_ROUTE`, `CTXDB_CODEX_DISABLE_MCP`, `CTXDB_TEAM_WORKERS`, `AIOS_SUBAGENT_CONCURRENCY`); added core-overview links to the selection guide; changed live subagent runtime default concurrency from `2` to `3`
  - **Documentation: Agent Team & HUD** (2026-04-11): Added comprehensive documentation for Team Operations - new pages [Agent Team & HUD](team-ops.md), [HUD Guide](hud-guide.md), and [Skill Candidates](skill-candidates.md); updated [Superpowers](superpowers.md) and [Architecture](architecture.md) with Team Ops references
  - **Browser MCP migration to browser-use CDP** (2026-04-10): default browser runtime switched from Playwright to browser-use MCP over CDP; new launcher `scripts/run-browser-use-mcp.sh`; migration command `aios internal browser mcp-migrate`; screenshot timeout guard with configurable `BROWSER_USE_SCREENSHOT_TIMEOUT_MS`
  - **HUD/Team skill-candidate enhancements** (2026-04-09 to 2026-04-10): `--show-skill-candidates` flag for detailed view; `--skill-candidate-limit <N>` configurable limit; fast-watch mode defaults to 3 candidates (down from 6); artifact reads cached for performance; HUD suggests `skill-candidate apply` commands; team status surfaces skill-candidate artifacts and drafts
  - **Quality-gate visibility** (2026-04-08 to 2026-04-09): quality-gate category surfaced in HUD minimal status and team history summaries; quality-failed-only filter; quality prefix filters with multi-value support
  - **Learn-eval draft recommendations** (2026-04-07 to 2026-04-09): hindsight lesson drafts; skill patch draft candidates; draft recommendation apply flow; persist skill-candidate draft artifacts
  - **Turn-envelope v0** (2026-04-07): event linkage for turn-based telemetry; clarity entropy memo coverage in harness
  - **Browser doctor auto-heal** (2026-04-06 to 2026-04-08): `doctor --fix` auto-heals CDP service; setup/update lifecycle auto-heals browser doctor; CDP quick commands in docs
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
  - **Ink TUI refactor** (v1.1.0): full TypeScript + Ink-based TUI with React components; startup banner with REXCLI ASCII art; adaptive watch intervals; left-right option cycling; native enhancement visibility panel
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
