---
title: Quick Start
description: One setup flow for macOS, Linux, and Windows with OS tabs.
---

# Quick Start

This page combines macOS, Linux, and Windows setup into one flow. Use the OS tabs when commands differ.

## Quick Answer (AI Search)

`rex-ai-boot` lets you keep using `codex`, `claude`, and `gemini` directly while adding project-scoped ContextDB memory and unified browser MCP setup.

## Prerequisites

- Node.js 18+ and `npm`
- At least one CLI installed: `codex`, `claude`, or `gemini`
- A git repository where you want project-scoped ContextDB memory

## 1) Install Browser MCP

=== "macOS / Linux"

    ```bash
    scripts/install-browser-mcp.sh
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
    ```

## 2) Build ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

## 3) Install command wrappers (recommended)

=== "macOS / Linux (zsh)"

    ```bash
    scripts/install-contextdb-shell.sh --mode opt-in
    scripts/doctor-contextdb-shell.sh
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-shell.ps1
    . $PROFILE
    ```

## 4) Enable current project

=== "macOS / Linux"

    ```bash
    touch .contextdb-enable
    ```

=== "Windows (PowerShell)"

    ```powershell
    New-Item -ItemType File -Path .contextdb-enable -Force
    ```

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

=== "macOS / Linux"

    ```bash
    ls memory/context-db
    ```

=== "Windows (PowerShell)"

    ```powershell
    Get-ChildItem memory/context-db
    ```

You should see `sessions/`, `index/`, and `exports/`.

## 7) Update / Uninstall wrappers

=== "macOS / Linux (zsh)"

    ```bash
    scripts/update-contextdb-shell.sh --mode opt-in
    scripts/uninstall-contextdb-shell.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
    ```

## 8) Optional: install project skills globally

Use this only when you want this repo's skills available in other projects.

=== "macOS / Linux"

    ```bash
    scripts/install-contextdb-skills.sh --client all
    scripts/doctor-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-skills.ps1 -Client all
    ```

Skill lifecycle:

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-skills.sh --client all
    scripts/uninstall-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-skills.ps1 -Client all
    ```

## FAQ

### Does this replace native CLI clients?

No. You still run native commands. The wrapper only injects context and keeps compatibility.

### How do I avoid cross-project memory contamination?

Use `CTXDB_WRAP_MODE=opt-in` and create `.contextdb-enable` only in the projects you want.

### Does wrapper install also install skills?

No. Wrappers and skills are separate on purpose. Use step 8 when you want global skills.

### Why do I see `CODEX_HOME points to ".codex"`?

`CODEX_HOME` was set to a relative path. Use an absolute path:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### Which command should I run first if browser tools fail?

Run `doctor-browser-mcp` first (`scripts/doctor-browser-mcp.sh` or `doctor-browser-mcp.ps1`).
