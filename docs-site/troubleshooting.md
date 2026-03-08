---
title: Troubleshooting
description: Common setup/runtime issues and direct fixes.
---

# Troubleshooting

## Quick Answer (AI Search)

Most failures are setup-scope issues (missing MCP runtime, wrapper not loaded, or wrong wrap mode). Start with doctor scripts, then check wrapper scope.

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

Latest versions use a unified runtime core (`ctx-agent-core.mjs`) for both shell and Node wrappers to avoid this drift.

## `search` returns empty after sidecar loss

If `memory/context-db/index/context.db` is missing or stale:

1. Run `cd mcp-server && npm run contextdb -- index:rebuild`
2. Retry `search` / `timeline` / `event:get`

## Commands not wrapped

Check these conditions:

- You are inside a git repo (`git rev-parse --show-toplevel` works).
- `ROOTPATH/scripts/contextdb-shell.zsh` exists and is sourced.
- `CTXDB_WRAP_MODE` allows current repo (`opt-in` requires `.contextdb-enable`).

Run wrapper doctor first:

```bash
scripts/doctor-contextdb-shell.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
```

## `CODEX_HOME points to ".codex"` error

Cause: `CODEX_HOME` is set to a relative path.

Fix:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

Latest wrapper scripts also auto-normalize relative `CODEX_HOME` during command execution.

## Wrapper loaded but should be disabled

Set in shell config:

```zsh
export CTXDB_WRAP_MODE=off
```

## Skills unexpectedly shared across projects

Skill loading scope is separate from ContextDB wrapping:

- Global skills: `~/.codex/skills`, `~/.claude/skills`, `~/.gemini/skills`, `~/.config/opencode/skills`
- Project-only skills: `<repo>/.codex/skills`, `<repo>/.claude/skills`

If you need isolation, keep custom skills in repo-local folders.

## Repo skills are not available globally

Wrappers and skills are separate by design. Install skills explicitly:
`--client all` installs for `codex`, `claude`, `gemini`, and `opencode`.

```bash
scripts/install-contextdb-skills.sh --client all
scripts/doctor-contextdb-skills.sh --client all
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-contextdb-skills.ps1 -Client all
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-skills.ps1 -Client all
```

## GitHub Pages `configure-pages` Not Found

This usually means Pages source is not fully enabled.

Fix in GitHub settings:

1. `Settings -> Pages -> Source: GitHub Actions`
2. Re-run `docs-pages` workflow.

## FAQ

### What is the first command to run when browser tools fail?

Run `scripts/doctor-browser-mcp.sh` (or PowerShell variant) before reinstalling.

### Why is context not injected after I type `codex`?

Usually because the wrapper is not loaded, wrapper scope (`CTXDB_WRAP_MODE`) excludes the current workspace, or the command is a passthrough management subcommand.


## Skills were saved into the wrong repo directory

Repo-local discoverable skills should only live in:

- `<repo>/.codex/skills`
- `<repo>/.claude/skills`

If you save a `SKILL.md` under a parallel directory such as `.baoyu-skills/`, Codex / Claude will not discover it as a repo-local skill.

- Use `.baoyu-skills/` only for extension config such as `EXTEND.md`
- Move real skills to `.codex/skills/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md`
- Run `scripts/doctor-contextdb-skills.sh --client all` to detect unsupported repo skill roots
