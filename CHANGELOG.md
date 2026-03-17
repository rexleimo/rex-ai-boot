# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

- feat(aios): wire orchestrator agents into lifecycle components
- feat(orchestrate): derive blueprint phases from orchestrator-blueprints spec
- feat(harness): implement `subagent-runtime` live execution via CLI subagents (`AIOS_SUBAGENT_CLIENT=codex-cli|claude-code|gemini-cli`)
- feat(harness): prefer codex-cli v0.114+ structured exec outputs (`--output-schema`, `--output-last-message`, stdin) for stable JSON handoffs (falls back for older versions)
- feat(skills): add scope-aware catalog-driven installation flow for `global` and `project`
- feat(skills): expose project-oriented skills in both scope pickers without default selection
- feat(skills): include `skill-constraints`, `aios-project-system`, `aios-long-running-harness`, and `contextdb-autopilot` in the default core set
- feat(tui): show skill descriptions, group skills into `Core` / `Optional`, and show only installed skills during uninstall
- fix(skills): warn when project installs override global installs during doctor checks
- fix(learn-eval): route ContextDB quality failures to a concrete gate target
- fix(ctx-agent): fail-open when context:pack fails (set CTXDB_PACK_STRICT=1 to make it fatal)
- fix(ctx-agent): honor cmd-backed CLI wrappers by using shell-aware spawn specs (prevents Windows wrapper regressions)
- fix(contextdb): tolerate legacy context records (missing text/refs/actions) in context packs
- test(contextdb): add ContextDB quality gate to prevent context:pack regressions
- docs: document orchestrate live execution + subagent runtime env controls
- docs(blog): add a release note post for subagent runtime
- docs(blog): add a release note post for scope-aware skills install UX

## [0.16.0] - 2026-03-10

- feat(aios): add orchestrator agent catalog and generators

## [0.15.0] - 2026-03-10

- feat(aios): gate live orchestrate execution behind AIOS_EXECUTE_LIVE

## [0.14.0] - 2026-03-10

- feat(aios): add subagent runtime stub adapter

## [0.13.0] - 2026-03-10

- feat(aios): externalize runtime manifest spec

## [0.12.0] - 2026-03-10

- feat(aios): add runtime adapter boundary

## [0.11.0] - 2026-03-10

- feat(aios): expand local orchestrate preflight coverage

## [0.10.4] - 2026-03-08

- fix wrapper fallback for non-git workspaces and sync docs

## [0.10.3] - 2026-03-08

- fix(windows): support cmd-backed cli launch

## [0.10.2] - 2026-03-08

- fix(windows): route contextdb npm calls through node cli

## [0.10.1] - 2026-03-08

- fix(windows): resolve npm cli launch in node lifecycle

## [0.10.0] - 2026-03-08

- feat(onboarding): consolidate lifecycle flow into node

## [0.9.0] - 2026-03-07

- feat: add hybrid browser snapshot and visible-first launch defaults

## [0.8.1] - 2026-03-05

- docs: add contextdb Node ABI mismatch troubleshooting

## [0.8.0] - 2026-03-05

- add strict privacy guard with ollama-backed redaction

## [0.7.0] - 2026-03-05

- feat: add browser challenge detection and handoff signals

## [0.6.2] - 2026-03-04

- fix: auto-create .contextdb-enable for opt-in wrapper mode

## [0.6.1] - 2026-03-04

- fix(windows): harden browser doctor and clarify Node 20+ prerequisites

## [0.6.0] - 2026-03-04

- feat: add cross-CLI doctor + security scan skill pack

## [0.5.3] - 2026-03-04

- docs(site): wire docs/blog nav both ways and simplify blog home footer sections

## [0.5.2] - 2026-03-03

- docs(site): move rexai links to global footer navigation

## [0.5.1] - 2026-03-03

- docs: align superpowers workflow route and add RexAI friend links

## [0.5.0] - 2026-03-03

- feat(contextdb): add SQLite sidecar index (`memory/context-db/index/context.db`) with `index:rebuild`
- feat(contextdb): switch `search`/`timeline`/`event:get` to SQLite-backed retrieval with rebuild fallback
- feat(contextdb): add optional semantic rerank path (`--semantic`, `CONTEXTDB_SEMANTIC=1`)
- refactor(scripts): unify `ctx-agent.sh` and `ctx-agent.mjs` through `ctx-agent-core.mjs`

## [0.4.3] - 2026-03-03

- docs: improve functional page SEO/GEO with AI-search answers and changelog nav

## [0.4.2] - 2026-03-03

- docs: merge windows guide into quick start with os tabs

## [0.4.1] - 2026-03-03

- docs: add dedicated windows guide pages and quick-start cross-links

## [0.4.0] - 2026-03-03

- feat: add Windows PowerShell support for browser/contextdb setup

## [0.3.1] - 2026-03-03

- chore: bump version after browser mcp onboarding rollout

## [0.3.0] - 2026-03-03

- feat: add one-command browser mcp install/doctor and default cdp fallback

## [0.2.0] - 2026-03-03

- feat: add semver governance and versioning-by-impact skill

## [0.1.0] - 2026-03-03

- Initialize project versioning (`VERSION`, `CHANGELOG.md`) and release tooling baseline.
