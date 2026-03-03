---
title: Troubleshooting
description: Common setup/runtime issues and direct fixes.
---

# Troubleshooting

## Browser MCP tools unavailable

Run (macOS / Linux):

```bash
scripts/doctor-browser-mcp.sh
```

Run (Windows PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

If doctor reports missing dependencies, run installer:

```bash
scripts/install-browser-mcp.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
```

## `EXTRA_ARGS[@]: unbound variable`

Cause: old `ctx-agent.sh` with `bash set -u` empty-array expansion edge case.

Fix:

1. Pull latest `main`.
2. Re-open shell and retry `claude`/`codex`/`gemini`.

## Commands not wrapped

Check these conditions:

- You are inside a git repo (`git rev-parse --show-toplevel` works).
- `ROOTPATH/scripts/contextdb-shell.zsh` exists and is sourced.
- `CTXDB_WRAP_MODE` allows current repo (`opt-in` requires `.contextdb-enable`).

## Wrapper loaded but should be disabled

Set in shell config:

```zsh
export CTXDB_WRAP_MODE=off
```

## Skills unexpectedly shared across projects

Skill loading scope is separate from ContextDB wrapping:

- Global skills: `~/.codex/skills`, `~/.claude/skills`
- Project-only skills: `<repo>/.codex/skills`, `<repo>/.claude/skills`

If you need isolation, keep custom skills in repo-local folders.

## GitHub Pages `configure-pages` Not Found

This usually means Pages source is not fully enabled.

Fix in GitHub settings:

1. `Settings -> Pages -> Source: GitHub Actions`
2. Re-run `docs-pages` workflow.
