# AIOS Node Lifecycle Consolidation — Design

**Date:** 2026-03-08  
**Status:** Approved

## Goal

Consolidate AIOS lifecycle behavior into a single Node.js implementation so that:

- `install`
- `update`
- `uninstall`
- `verify`
- `aios` interactive TUI

all share one codepath across macOS, Linux, and Windows.

The target state is:

- Node.js **20+** is the only place where lifecycle business logic lives.
- `scripts/*.sh` and `scripts/*.ps1` remain only as thin bootstrap/wrapper layers.
- TUI state, option parsing, validation, command planning, execution, and verification are implemented once.

## Problem Statement

The current implementation duplicates lifecycle logic across Bash and PowerShell:

- `scripts/aios.sh` and `scripts/aios.ps1`
- `scripts/setup-all.sh` and `scripts/setup-all.ps1`
- `scripts/update-all.sh` and `scripts/update-all.ps1`
- `scripts/uninstall-all.sh` and `scripts/uninstall-all.ps1`
- `scripts/verify-aios.sh` and `scripts/verify-aios.ps1`

This creates three recurring problems:

1. **Behavior drift:** defaults and validations must be kept in sync in multiple languages.
2. **Interactive instability:** terminal key handling and redraw logic differ between shells; the current TUI already shows an `Enter` selection issue.
3. **Platform maintenance cost:** every change needs two implementations and two debugging workflows.

## Decision Summary

Adopt a **Node-first lifecycle architecture**.

### What moves to Node

Node becomes the source of truth for:

- interactive TUI state machine and keyboard handling,
- non-interactive CLI argument parsing,
- lifecycle option defaults and validation,
- install/update/uninstall orchestration,
- verification/doctor aggregation,
- user-facing logs, prompts, and exit codes,
- compatibility command wrappers.

### What remains in shell / PowerShell

Shell and PowerShell remain only for:

- detecting whether `node` exists,
- installing or suggesting installation of Node when missing,
- forwarding arguments to `node scripts/aios.mjs ...`,
- serving as compatibility entrypoints for users who still invoke `.sh` / `.ps1` files directly.

## User-Facing Contract

### Primary entrypoints

The canonical entry becomes:

- `node scripts/aios.mjs`
- `node scripts/aios.mjs setup ...`
- `node scripts/aios.mjs update ...`
- `node scripts/aios.mjs uninstall ...`
- `node scripts/aios.mjs doctor ...`

### Compatibility entrypoints

These remain supported, but only as wrappers:

- `scripts/aios.sh`
- `scripts/aios.ps1`
- `scripts/setup-all.sh`
- `scripts/setup-all.ps1`
- `scripts/update-all.sh`
- `scripts/update-all.ps1`
- `scripts/uninstall-all.sh`
- `scripts/uninstall-all.ps1`
- `scripts/verify-aios.sh`
- `scripts/verify-aios.ps1`

They will delegate to the Node implementation instead of containing business logic.

### Node requirement

AIOS already documents Node.js **20+** and `mcp-server/package.json` requires `>=20`, so the lifecycle system will standardize on:

- **minimum supported version:** Node.js 20
- **recommended version:** Node.js 22 LTS

## Architecture

## 1. Root script package

Add a root-level `package.json` for script-only tooling:

- `private: true`
- `type: module`
- `engines.node: >=20`
- npm scripts for running lifecycle tests and CLI smoke commands

This package is not meant to replace `mcp-server/package.json`; it only gives the repository a stable home for Node-based script tooling.

## 2. Single Node entrypoint

Create `scripts/aios.mjs` as the single public implementation entry.

Responsibilities:

- show help,
- enter TUI when no subcommand is passed,
- parse lifecycle subcommands,
- normalize platform-specific defaults,
- call lifecycle handlers,
- print stable exit codes and human-readable output.

## 3. Internal module layout

Recommended structure:

- `scripts/aios.mjs`
- `scripts/lib/cli/`
- `scripts/lib/tui/`
- `scripts/lib/lifecycle/`
- `scripts/lib/components/`
- `scripts/lib/doctor/`
- `scripts/lib/platform/`

### `scripts/lib/cli/`

Contains:

- argument parsing,
- usage/help text,
- validation of `components`, `mode`, `client`, and doctor flags.

### `scripts/lib/tui/`

Contains:

- a pure state reducer for menu transitions,
- keypress mapping (`up/down/left/right/enter/space/b/q`),
- rendering helpers,
- raw-mode management and cleanup.

The critical design choice is to keep the menu state machine pure and testable. Raw terminal I/O should be a thin adapter around a tested reducer.

### `scripts/lib/lifecycle/`

Contains top-level command handlers:

- `setup`
- `update`
- `uninstall`
- `doctor`

Each handler:

- receives validated options,
- builds a deterministic execution plan,
- calls component modules,
- returns structured result objects.

### `scripts/lib/components/`

Contains the real implementations for domain operations:

- `browser`
- `shell`
- `skills`
- `superpowers`
- `privacy-guard` (if kept separate from shell)

These modules are where current shell/PowerShell lifecycle behavior gets ported into Node.

### `scripts/lib/doctor/`

Contains:

- verification checks currently spread across `verify-aios.*` and `doctor-*` scripts,
- warning classification,
- strict-mode failure rules,
- repo verification summary.

### `scripts/lib/platform/`

Contains small platform adapters for:

- locating home/profile paths,
- reading and patching shell rc files / PowerShell profile files,
- symlink/copy behavior,
- spawning OS-native package managers,
- detecting/installing Node for wrappers.

## Lifecycle Flow

## Setup

`setup` becomes a Node handler that:

1. validates the selected components,
2. installs/configures browser MCP resources,
3. installs shell integration and privacy guard,
4. installs skills for target clients,
5. installs superpowers linkage,
6. optionally runs doctor checks,
7. prints the same “next steps” hints now emitted by shell scripts.

## Update

`update` becomes a Node handler that:

1. reuses the same option model as setup,
2. updates selected components,
3. optionally refreshes Playwright runtime,
4. optionally runs doctor checks.

## Uninstall

`uninstall` becomes a Node handler that:

1. removes selected integrations,
2. keeps idempotent behavior,
3. leaves unrelated files untouched,
4. returns clear “already absent” vs “removed” statuses.

## Doctor / Verify

`doctor` becomes a Node handler that:

1. runs all verification checks through one aggregator,
2. preserves the current `strict` semantics,
3. includes repo-level checks such as `mcp-server` typecheck/build,
4. emits a stable summary for both humans and tests.

## TUI Behavior

The TUI is implemented once in Node and reused on every platform.

Requirements:

- `Enter` must activate the selected row consistently.
- non-TTY usage falls back to help text and non-interactive examples.
- terminal state is always restored on exit, exceptions, and Ctrl+C.
- menu state and command preview are generated from the same lifecycle option model used by non-interactive CLI mode.

This removes the current Bash/PowerShell divergence that caused the broken `Enter` flow.

## Wrapper Strategy

## Thin wrappers only

After migration, each wrapper should do only this:

1. find `node`,
2. verify Node version is at least 20,
3. if Node is missing, offer platform-specific installation guidance,
4. exec `node scripts/aios.mjs <mapped-subcommand> ...`.

## Node installation behavior

Wrappers should be conservative:

- **macOS:** prefer `brew install node`
- **Windows:** prefer `winget install OpenJS.NodeJS.LTS`
- **Linux:** detect common package managers and otherwise print explicit manual instructions

Automatic installation should be opt-in or confirmation-based rather than silently modifying the machine.

## Backward Compatibility

Compatibility goals:

- existing README commands should continue to work,
- existing direct script invocation patterns should continue to work,
- users can keep using `scripts/setup-all.sh` or `scripts/verify-aios.ps1`,
- wrappers may print a small note that Node now owns the implementation.

We do **not** need to preserve internal duplication or internal file structure.

## Error Handling

All lifecycle handlers should return structured results rather than only printing side effects.

Principles:

- validation errors fail fast with actionable messages,
- execution errors preserve the failing command and exit code,
- strict verification mode upgrades warnings into failure only at the aggregation boundary,
- partial success is reported explicitly,
- wrappers surface Node bootstrap failures clearly and stop early.

## Testing Strategy

Use built-in Node testing (`node:test`) under `scripts/tests/`.

### Automated

Add tests for:

- CLI argument parsing,
- default option resolution,
- TUI reducer transitions (especially the `Enter` action),
- lifecycle plan generation,
- doctor warning aggregation,
- wrapper argument mapping and fallback rules where testable.

### Manual

Keep a small manual smoke checklist for:

- macOS/Linux wrapper execution,
- Windows PowerShell wrapper execution,
- TUI navigation,
- one end-to-end `doctor` run,
- one non-interactive `setup` dry/safe path.

## Migration Strategy

Implement in two phases.

### Phase 1: Public lifecycle consolidation

Move the public lifecycle commands to Node first:

- `aios`
- `setup-all`
- `update-all`
- `uninstall-all`
- `verify-aios`

This removes the biggest duplication immediately.

### Phase 2: Internal component consolidation

Port the per-component behavior that is still buried in shell/PowerShell scripts into Node modules and turn those scripts into wrappers or deprecate them.

This keeps the initial migration tractable while still aiming for a true Node-first end state.

## Non-Goals

- Do not add a large third-party TUI framework in the first pass.
- Do not change the meaning of existing user-facing flags unless necessary for consistency.
- Do not change `mcp-server` runtime architecture.
- Do not auto-install Node silently.

## Success Criteria

The migration is successful when all are true:

- one Node implementation powers TUI and lifecycle behavior,
- current wrapper commands still work,
- the `Enter` issue is gone in the TUI,
- verification logic is no longer duplicated across Bash and PowerShell,
- new lifecycle behavior is covered by Node tests,
- repo docs point users to the Node-first lifecycle path.
