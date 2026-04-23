---
title: Quick Start
description: One setup flow for macOS, Linux, and Windows with OS tabs.
---

# Quick Start

This page combines macOS, Linux, and Windows setup into one flow. Use the OS tabs when commands differ.

## Quick Answer (AI Search)

`RexCLI` lets you keep using `codex`, `claude`, and `gemini` directly while adding project-scoped ContextDB memory and unified browser MCP setup.

## Prerequisites

- Node.js **22 LTS** and `npm`
- At least one CLI installed: `codex`, `claude`, or `gemini`
- A project/workspace directory where you want project-scoped ContextDB memory

## 0) Install (recommended)

This repo installs to `~/.rexcil/rex-cli`. The unified entry is `aios`:

- `aios` (no args) opens the interactive full-screen TUI
- `aios doctor|update|privacy ...` keeps working as before

### Option C: One-liner installer (GitHub Releases)

This is the stable installation path and depends on published GitHub Release assets.

=== "macOS / Linux"

    ```bash
    curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
    source ~/.zshrc
    aios
    ```

=== "Windows (PowerShell)"

    ```powershell
    irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
    . $PROFILE
    aios
    ```

### Option A: git clone (dev-friendly)

Use this only when you explicitly want unreleased `main` branch behavior. This is the supported development install path, not the stable release path.

=== "macOS / Linux"

    ```bash
    git clone https://github.com/rexleimo/rex-cli.git ~/.rexcil/rex-cli
    cd ~/.rexcil/rex-cli
    scripts/aios.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    git clone https://github.com/rexleimo/rex-cli.git $HOME\.rexcil\rex-cli
    cd $HOME\.rexcil\rex-cli
    powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
    ```

### Option B: Download from GitHub Releases (offline-friendly)

Download `rex-cli.tar.gz` (macOS/Linux) or `rex-cli.zip` (Windows) from Releases and extract to `~/.rexcil/`.
Then run `scripts/aios.sh` / `scripts/aios.ps1`.

### TUI Welcome Banner

When you start the TUI with `aios`, you'll see a cyan ASCII art banner:

```
  ╔══════════════════════════════════════════╗
  ║   ██████╗ ██╗  ██╗██╗██████╗  ██████╗    ║
  ║   ██╔══██╗██║ ██╔╝██║██╔══██╗██╔════╝    ║
  ║   ██████╔╝█████╔╝ ██║██████╔╝██║         ║
  ║   ██╔══██╗██╔═██╗ ██║██╔══██╗██║         ║
  ║   ██║  ██║██║  ██╗██║██║  ██║╚██████╗    ║
  ║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝    ║
  ║          Hello, Rex CLI!                 ║
  ╚══════════════════════════════════════════╝
```

This confirms the TUI is ready and shows the repository location below the banner.

### Recommended: finish setup in the TUI

After install, use the TUI as the main onboarding path for this release:

1. Run `aios`
2. Select **Setup**
3. Choose your component set:
   - `all` for the full stack
   - `shell,skills,superpowers` for shared memory + skills first
   - `browser` for Browser MCP only
4. If you enable **Skills**, the picker now helps distinguish states:
   - setup/update mark already-installed skills with `(installed)`
   - uninstall shows only installed skills, supports scrolling, and offers **Select all** / **Clear all**
   - installs default to portable `copy` mode; use `--install-mode link` only when you intentionally want a local-dev link back to this repo
5. When setup finishes, run **Doctor** in the same TUI
6. Reload your shell if you installed shell wrappers:
   - macOS / Linux: `source ~/.zshrc`
   - Windows PowerShell: `. $PROFILE`

### Repo contributors: skills now come from `skill-sources/`

If you are editing this repo itself rather than just installing it:

- canonical skill source files live under `skill-sources/`
- repo-local `.codex/skills`, `.claude/skills`, `.agents/skills`, `.gemini/skills`, and `.opencode/skills` are generated compatibility outputs
- regenerate them with:

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

### 0.1 Privacy Guard Strict Read (enabled by default)

Shell setup now initializes Privacy Guard config at `~/.rexcil/privacy-guard.json` and enables strict redaction policy by default.
For config or secret-like files, use the strict read path:

=== "macOS / Linux"

    ```bash
    aios privacy read --file <path>
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy read --file <path>
    ```

Optional local model path (Ollama + `qwen3.5:4b`):

=== "macOS / Linux"

    ```bash
    aios privacy ollama-on
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy ollama-on
    ```

Component selection examples:

Tip: if you installed via the one-liner, the repo lives at `~/.rexcil/rex-cli`.
Run the scripts from that directory, or just run `aios` and pick **Setup** in the TUI.

=== "macOS / Linux"

    ```bash
    # only shell wrappers + skills
    scripts/setup-all.sh --components shell,skills --mode opt-in

    # only browser MCP
    scripts/setup-all.sh --components browser
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
    ```

One-command update/uninstall:

=== "macOS / Linux"

    ```bash
    scripts/update-all.sh --components all --mode opt-in
    scripts/uninstall-all.sh --components shell,skills
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
    ```

If you prefer component-by-component setup, continue with steps 1-8 below.

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

Notes:

- `mcp-server` package scripts now resolve the project runtime from `.nvmrc` automatically and are expected to run on Node 22 LTS.
- If you see `Unable to resolve a Node runtime matching .nvmrc=22`, install Node 22 first (for example `nvm install 22 && nvm use 22`) and rerun the command.

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

## 5.1) Optional: operator tools (quality gate + learn-eval + orchestrate)

Repo health gate (includes ContextDB regression checks):

```bash
aios quality-gate pre-pr --profile strict
```

Analyze the latest session telemetry:

```bash
aios learn-eval --limit 10
```

Build a local orchestration skeleton (no model calls):

```bash
aios orchestrate --session <session-id> --preflight auto --format json
```

Execute live via CLI subagents (token cost, opt-in):

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # required (codex-only live runtime)
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

Tip (codex-cli): Codex CLI v0.114+ supports `codex exec` structured outputs (`--output-schema`, `--output-last-message`, stdin). AIOS uses them when available and falls back to stdout parsing on older versions.

Optional controls:

- `AIOS_SUBAGENT_CONCURRENCY` (default: `3`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)

### 5.1.1) Route + concurrency profile (recommended)

If you want parallel work but do not want to memorize many env vars, use this compact profile:

Need a standalone reference page? See [Route & Concurrency Profiles](route-concurrency-profiles.md).

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=3
export AIOS_SUBAGENT_CONCURRENCY=3
```

What each variable controls:

- `CTXDB_INTERACTIVE_AUTO_ROUTE`: whether interactive wrapper injects auto-route policy (`single/subagent/team`)
- `CTXDB_CODEX_DISABLE_MCP`: whether wrapped `codex` skips MCP startup (use `1` to avoid MCP cold-start stalls)
- `CTXDB_TEAM_WORKERS`: parallel worker count for `aios team ...`
- `AIOS_SUBAGENT_CONCURRENCY`: parallel executor count for `aios orchestrate --execute live`

Recommended presets:

- Balanced default (recommended): `3 + 3`
- Higher throughput: `4 + 4`
- Debug stability mode: `1 + 1`

## 5.2) Optional: HUD and Team Ops visibility

View session status with HUD:

```bash
aios hud --provider codex
aios hud --watch --preset full
aios hud --session <session-id> --json
```

Team Ops status and history:

```bash
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

Skill-candidate detail view (2026-04-09+):

```bash
# Show skill candidates with default limit (6 in normal mode, 3 in fast-watch minimal)
aios team status --show-skill-candidates

# Configure candidate limit (1-20)
aios team status --show-skill-candidates --skill-candidate-limit 10

# Fast-watch mode auto-uses minimal limit (3 candidates)
aios team status --watch --fast

# HUD also supports skill-candidate view
aios hud --show-skill-candidates --skill-candidate-limit 5
```

Quality-gate category filters (2026-04-08+):

```bash
# Show only quality-gate failed sessions
aios team history --quality-failed-only

# Filter by quality category prefix
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch
```

Dispatch hindsight and draft recommendations (2026-04-07+):

```bash
# Learn-eval shows draft skill-candidate patches
aios learn-eval --limit 10

# HUD suggests skill-candidate apply commands when available
aios hud --session <session-id>
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
`--client all` installs for `codex`, `claude`, `gemini`, and `opencode`.

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
