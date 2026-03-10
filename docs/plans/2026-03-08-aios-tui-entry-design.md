# AIOS Unified TUI Entry (scripts/aios.*) — Design

**Date:** 2026-03-08  
**Status:** Approved (user OK)  

## Goal

Add a single, interactive, full-screen TUI entrypoint that lets users run **existing** AIOS lifecycle scripts from one menu:

- setup (install)
- update
- uninstall
- doctor (verify)

The TUI must be cross-platform:

- macOS/Linux: Bash/Zsh terminals
- Windows: PowerShell console

## Non-Goals

- Do not change the semantics of existing installers/doctors.
- Do not require external dependencies (`gum`, `fzf`, Node TUI libs, etc.).
- Do not add a new global `aios` command entry (user chose “scripts only”).

## User-Facing Entry

New scripts (single entry; no args opens TUI):

- `scripts/aios.sh`
- `scripts/aios.ps1`

Existing scripts remain supported and unchanged:

- `scripts/setup-all.*`
- `scripts/update-all.*`
- `scripts/uninstall-all.*`
- `scripts/verify-aios.*`

## Interaction Model

Full-screen menu interaction:

- `↑/↓` move cursor
- `Space` toggle checkbox / cycle options
- `Enter` confirm / continue
- `B` back
- `Q` quit

## Menu Structure

### Main Menu

- Setup
- Update
- Uninstall
- Doctor
- Exit

### Setup Config

Wraps `scripts/setup-all.sh|ps1` and reuses its default values:

- components: `browser,shell,skills,agents,superpowers` (checkboxes)
- mode: `opt-in` (cycle: `all|repo-only|opt-in|off`)
- client: `all` (cycle: `all|codex|claude|gemini|opencode`)
- skip-playwright-install: `false` (toggle)
- skip-doctor: `false` (toggle)

### Update Config

Wraps `scripts/update-all.sh|ps1` and reuses its default values:

- components: `browser,shell,skills,agents,superpowers` (checkboxes)
- mode: `opt-in`
- client: `all`
- with-playwright-install: `false` (toggle)
- skip-doctor: `false` (toggle)

### Uninstall Config

Wraps `scripts/uninstall-all.sh|ps1` and reuses its default values:

- components: `shell,skills` (checkboxes; browser/superpowers allowed but informational only)
- client: `all`

### Doctor Config

Wraps `scripts/verify-aios.sh|ps1` and reuses its default values:

- strict: `false` (toggle)
- global-security: `false` (toggle)

## Confirmation + Execution

Before running:

- Show the exact command that will be executed (platform-appropriate flags).
- `Enter` to run, `B` to return.

During execution:

- Leave full-screen mode and print command output normally.
- On completion, show exit code and prompt to return to TUI.

## Safety/Robustness

- Always restore terminal state on exit (including Ctrl+C) on Bash.
- On Windows, ensure cursor visibility restored.
- If non-interactive console/TTY is not detected, print help and exit.

## Minimal Documentation

Add a short README note (EN + ZH) pointing to:

- `scripts/aios.sh`
- `scripts/aios.ps1`
