# Windows Shell Smoke Workflow Design

Date: 2026-03-16

## Goal

Add a minimal GitHub Actions workflow that validates the Windows PowerShell wrapper on a real Windows runner without requiring any model credentials.

## Scope

In scope:
- Run on GitHub Actions `windows-latest`.
- Trigger on every push to `main` (no path filters).
- Validate PowerShell wrapper install/uninstall and `aios doctor` execution.
- No model calls, no external credentials, no browser automation.

Out of scope:
- Live subagent dispatch on Windows.
- Any auth-required flows or browser login verification.
- CI gating based on code coverage or additional tests.

## Workflow Overview

Workflow file: `.github/workflows/windows-shell-smoke.yml`

Trigger:
- `on: push` to `main`.

Jobs:
- `windows-shell-smoke` running on `windows-latest`.

Steps:
1. Checkout repository.
2. Setup Node.js (version 22, consistent with release workflow).
3. Install `mcp-server` dependencies via `npm ci`.
4. Run `scripts/install-contextdb-shell.ps1 --mode repo-only --force` with PowerShell.
5. Run `node scripts/aios.mjs internal shell doctor` (minimal, shell-only scope).
6. Validate PowerShell profile(s) contain the managed block marker (`# >>> contextdb-shell >>>`).
7. Run `scripts/uninstall-contextdb-shell.ps1` (always, even on failure).
8. Validate PowerShell profile(s) no longer contain the managed block marker.

PowerShell invocation:
- Use `shell: pwsh` for all PowerShell steps.
- Call scripts via `pwsh -NoProfile -ExecutionPolicy Bypass -File <script> <args>`.

## Error Handling

- The uninstall step uses `if: always()` to ensure cleanup even if earlier steps fail.
- A failing `doctor` or install step should fail the workflow (non-zero exit).
- Profile block checks should fail the workflow if the marker is missing after install or still present after uninstall.

## Evidence

- GitHub Actions logs are the primary evidence.
- No additional artifacts are required for this smoke.

## Security Considerations

- No secrets are required.
- No credentials or tokens are used.
- No model calls are executed in the workflow.

## Testing & Verification

Local verification is not required for the GitHub Actions runner, but the workflow should be reviewed for:
- Correct paths and PowerShell invocation.
- Node version alignment with existing workflows.
- Proper cleanup on failure.
- Managed block insert/remove behavior in Windows PowerShell profiles.

## Rollback

Remove `.github/workflows/windows-shell-smoke.yml` if the workflow proves noisy or unstable.
