# Non-Git Workspace Context Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow `codex` / `claude` / `gemini` to enter the AIOS ContextDB/bootstrap flow even when launched from a directory that is not a Git repository.

**Architecture:** Keep `scripts/ctx-agent*.mjs` unchanged. Update only `scripts/contextdb-shell-bridge.mjs` so workspace detection falls back to `cwd`, then reuse existing wrap-mode gating.

**Tech Stack:** Node.js ESM, existing bridge tests under `scripts/tests/`.

---

### Task 1: Add a failing bridge test for non-Git fallback

**Files:**
- Modify: `scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`

**Step 1: Add a fake runner path**

- Create a temporary fake `ctx-agent` script that prints the forwarded `--workspace` value.
- Inject it through `CTXDB_RUNNER` so the bridge can be tested without launching real CLIs.

**Step 2: Cover non-Git fallback modes**

- Add a test for `CTXDB_WRAP_MODE=all` that expects fallback `cwd` to be used as `--workspace`.
- Add a test for `CTXDB_WRAP_MODE=repo-only` that expects wrapping only when `cwd === ROOTPATH`.
- Add a test for `CTXDB_WRAP_MODE=opt-in` that expects marker auto-creation and fallback wrapping.

**Step 3: Run the test and confirm RED**

Run:
- `node --test scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`

Confirm the new assertions fail because fallback workspace support does not exist yet.

---

### Task 2: Implement minimal bridge fallback

**Files:**
- Modify: `scripts/contextdb-shell-bridge.mjs`

**Step 1: Add fallback workspace resolution**

- Keep Git root detection first.
- When Git root detection fails, resolve to `cwd`.

**Step 2: Keep mode semantics intact**

- Reuse current `shouldWrapWorkspace()` behavior.
- Ensure opt-in marker creation also runs for fallback directories.

**Step 3: Keep passthrough safeguards**

- Do not change blocked subcommand handling.
- Do not change runner detection or native command spawning.

---

### Task 3: Verify GREEN and regressions

**Step 1: Run focused bridge tests**

Run:
- `node --test scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`

**Step 2: Run adjacent script tests**

Run:
- `npm run test:scripts`

If unrelated failures appear, stop and report them separately.

---

### Task 4: Explain impact to the user

**Step 1: Summarize behavior changes**

- Explain that non-Git directories now use `cwd` as workspace.
- Call out how `all`, `repo-only`, and `opt-in` behave after the patch.

**Step 2: Include verification evidence**

- Report the exact test commands that passed.
