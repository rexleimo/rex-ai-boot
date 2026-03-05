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

- `0.8.0` (2026-03-05): add strict Privacy Guard (`~/.rexcil`) with required redacted read path, Ollama (`qwen3.5:4b`) support, and setup integration
- `0.7.0` (2026-03-05): add browser anti-bot challenge detection (`browser_challenge_check`) and explicit human-handoff signals
- `0.6.2` (2026-03-04): fix auto-create `.contextdb-enable` for opt-in wrapper mode
- `0.6.1` (2026-03-04): harden browser doctor on Windows and clarify Node 20+ prerequisite
- `0.6.0` (2026-03-04): add cross-CLI doctor + security scan skill pack
- `0.5.3` (2026-03-04): docs-site navigation updates and blog-home footer simplification
- `0.5.2` (2026-03-03): docs-site footer moved to shared RexAI links
- `0.5.1` (2026-03-03): docs and superpowers route alignment
- `0.5.0` (2026-03-03): ContextDB SQLite sidecar index, `index:rebuild`, optional `--semantic` search path, unified `ctx-agent` runtime core
- `0.4.2` (2026-03-03): merged Windows setup into tabbed Quick Start
- `0.4.1` (2026-03-03): added dedicated Windows guide pages and cross-links
- `0.4.0` (2026-03-03): added Windows PowerShell setup scripts

## Related Reading

- [Quick Start](getting-started.md)
- [ContextDB](contextdb.md)
- [Troubleshooting](troubleshooting.md)

## Update Rule

When a release changes setup, runtime behavior, or compatibility, docs are updated in the same PR and reflected here.
