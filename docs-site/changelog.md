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

- `main` (Unreleased): ship `subagent-runtime` live execution for `aios orchestrate` (opt-in via `AIOS_EXECUTE_LIVE=1`); prefer Codex CLI v0.114+ structured exec outputs for stable JSON handoffs
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

## Related Reading

- [Quick Start](getting-started.md)
- [ContextDB](contextdb.md)
- [Troubleshooting](troubleshooting.md)

## Update Rule

When a release changes setup, runtime behavior, or compatibility, docs are updated in the same PR and reflected here.
