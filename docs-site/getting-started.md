---
title: Quick Start
description: Install, enable wrappers, and run your first project-scoped session.
---

# Quick Start

If you are on Windows, start with [Windows Guide](windows-guide.md) for PowerShell wrappers and project opt-in setup.

## Prerequisites

- macOS/Linux shell with `zsh`
- `node` + `npm`
- One or more CLIs installed: `codex`, `claude`, `gemini`

## 1) Install Browser MCP (one command)

macOS / Linux:

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

## 2) Build ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

## 3) Enable shell wrappers

Add this block to `~/.zshrc`:

```zsh
# >>> contextdb-shell >>>
export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
export CTXDB_WRAP_MODE=opt-in
if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "$ROOTPATH/scripts/contextdb-shell.zsh"
fi
# <<< contextdb-shell <<<
```

Reload shell:

```bash
source ~/.zshrc
```

## 4) Enable current project

In each target project root:

```bash
touch .contextdb-enable
```

This prevents accidental cross-project wrapping.

## 5) Start working

```bash
cd /path/to/your/project
codex
# or
claude
# or
gemini
```

## 6) Verify data created

```bash
ls memory/context-db
```

You should see `sessions/`, `index/`, and `exports/`.
