# Non-Git Workspace Context Bootstrap Design

## Problem

After the shell wrapper moved behind `scripts/contextdb-shell-bridge.mjs`, auto bootstrap / `contextdb init` / session restore / context packet injection only run when the bridge decides to wrap the native CLI.

Today the bridge only treats a Git root as a valid workspace. In directories without `git init`, the bridge falls through to passthrough mode, so the user sees no bootstrap task, no shared memory context, and no default injected prompt template.

## Goal

Restore the expected AIOS behavior for plain directories that are not Git repositories, while keeping existing passthrough behavior for management subcommands and preserving wrap-mode semantics.

## Chosen Approach

Use the current working directory as a fallback workspace when Git root detection fails.

### Rules

- Keep blocked/management subcommands as passthrough.
- Preserve `CTXDB_WRAP_MODE` semantics:
  - `all`: wrap any directory, including non-Git directories.
  - `repo-only`: only wrap the AIOS repo root itself for non-Git fallback.
  - `opt-in`: require the marker file in the fallback directory; auto-create it if enabled.
  - `off`: never wrap.
- Reuse the existing `ctx-agent` flow so bootstrap, `init`, session handling, context packing, and prompt injection continue unchanged.

## Why This Option

- Minimal surface area: only the bridge decision changes.
- No new configuration mode to document or support.
- Keeps the current `ctx-agent` implementation authoritative.
- Matches the user's expectation that an initialized Git repo should not be required for basic memory/bootstrap behavior.

## Risks

- Non-Git directories may start receiving `.contextdb-enable` in `opt-in` mode when the wrapper is invoked.
- Some users may expect plain directories to remain untouched.

## Mitigations

- Keep `CTXDB_WRAP_MODE=off` behavior unchanged.
- Keep debug output and marker-creation behavior consistent with current opt-in flow.
- Add focused bridge tests for non-Git directories under `all`, `repo-only`, and `opt-in`.
