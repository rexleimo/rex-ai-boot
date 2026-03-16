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
4. Run `scripts/install-contextdb-shell.ps1` with PowerShell.
5. Run `node scripts/aios.mjs doctor` (non-strict, standard profile).
6. Run `scripts/uninstall-contextdb-shell.ps1` (always, even on failure).

## Error Handling

- The uninstall step uses `if: always()` to ensure cleanup even if earlier steps fail.
- A failing `doctor` or install step should fail the workflow (non-zero exit).

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

## Rollback

Remove `.github/workflows/windows-shell-smoke.yml` if the workflow proves noisy or unstable.
