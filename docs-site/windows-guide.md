---
title: Windows Guide
description: End-to-end setup on Windows PowerShell for Browser MCP and ContextDB wrappers.
---

# Windows Guide

This guide is for Windows users who use PowerShell (no bash/zsh required).

## Prerequisites

- Windows 10/11
- PowerShell 7+ (or Windows PowerShell 5.1)
- Node.js 18+
- At least one CLI installed: `codex`, `claude`, or `gemini`

## 1) Install Browser MCP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
```

The installer prints MCP JSON config with absolute `dist/index.js` path. Copy that block into your client MCP config and restart the client.

## 2) Enable ContextDB wrappers in PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
. $PROFILE
```

This loads wrappers from `scripts/contextdb-shell.ps1`.

## 3) Enable repo-level opt-in

In the target project root:

```powershell
New-Item -ItemType File -Path .contextdb-enable -Force
```

Recommended scope:

```powershell
$env:CTXDB_WRAP_MODE = "opt-in"
```

## 4) Use native commands as usual

```powershell
codex
claude
gemini
```

## 5) Smoke test browser tools

Run these in your client chat:

1. `browser_launch` `{"profile":"default"}`
2. `browser_navigate` `{"url":"https://example.com"}`
3. `browser_snapshot` `{}`
4. `browser_close` `{}`

## Notes

- If default CDP port `9222` is unavailable, server auto-falls back to local launch for `profile=default`.
- Use `scripts/doctor-browser-mcp.ps1` first when browser tools are unavailable.
