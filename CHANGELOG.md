# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

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
