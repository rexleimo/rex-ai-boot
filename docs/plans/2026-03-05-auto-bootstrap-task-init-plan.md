# Auto Bootstrap First Task Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically create a lightweight first-run bootstrap task in each workspace so users can start with a concrete next step immediately.

**Architecture:** Keep ContextDB/harness as execution truth and add a separate bootstrap guidance layer. Implement bootstrap generation in a dedicated helper module and invoke it from `scripts/ctx-agent-core.mjs` before ContextDB session flow. Make behavior idempotent and skippable.

**Tech Stack:** Node.js ESM (`.mjs`), built-in `node:test`, existing `scripts/ctx-agent-core.mjs` CLI flow.

---

### Task 1: Add failing tests for bootstrap generator

**Files:**
- Create: `scripts/tests/ctx-bootstrap.test.mjs`
- Test: `scripts/tests/ctx-bootstrap.test.mjs`

**Step 1: Write failing test**

Add tests for:
- creates bootstrap files when no current task and no pending tasks
- skips when `tasks/.current-task` exists
- skips when `tasks/pending` already has tasks

Expected bootstrap artifacts:
- `tasks/pending/<task-id>/task.json`
- `tasks/pending/<task-id>/prd.md`
- `tasks/.current-task`

**Step 2: Run test to verify it fails**

Run:
```bash
node --test scripts/tests/ctx-bootstrap.test.mjs
```

Expected:
- FAIL because `scripts/ctx-bootstrap.mjs` does not exist yet.

**Step 3: Commit checkpoint**

```bash
git add scripts/tests/ctx-bootstrap.test.mjs docs/plans/2026-03-05-auto-bootstrap-task-init-plan.md
git commit -m "test(bootstrap): add failing tests for first-task bootstrap"
```

### Task 2: Implement bootstrap helper (minimal)

**Files:**
- Create: `scripts/ctx-bootstrap.mjs`
- Modify: `scripts/tests/ctx-bootstrap.test.mjs`

**Step 1: Write minimal implementation**

Implement `ensureBootstrapTask(workspaceRoot, options)`:
- create `tasks/pending` when missing
- idempotent skip rules:
  - skip if `tasks/.current-task` has content
  - skip if `tasks/pending` already contains non-hidden entries
- create bootstrap folder task and files on first run
- return structured result `{ created, reason?, taskId?, taskPath? }`

Implement `isBootstrapEnabled(env)`:
- default enabled
- disable when `AIOS_BOOTSTRAP_AUTO` is `0`, `false`, or `off` (case-insensitive)

**Step 2: Run test to verify it passes**

Run:
```bash
node --test scripts/tests/ctx-bootstrap.test.mjs
```

Expected:
- PASS all tests.

**Step 3: Commit checkpoint**

```bash
git add scripts/ctx-bootstrap.mjs scripts/tests/ctx-bootstrap.test.mjs
git commit -m "feat(bootstrap): add idempotent first-task bootstrap helper"
```

### Task 3: Wire bootstrap into ctx-agent startup

**Files:**
- Modify: `scripts/ctx-agent-core.mjs`
- Test: `scripts/tests/ctx-bootstrap.test.mjs`

**Step 1: Add CLI and env control**

Add `--no-bootstrap` flag to usage + arg parsing:
- default: bootstrap enabled
- `--no-bootstrap`: disable for this invocation

Add startup gate:
- if CLI flag enables and env enables, call `ensureBootstrapTask`
- call before `contextdb init`
- non-fatal: bootstrap errors should warn and continue

**Step 2: Verify behavior (non-destructive)**

Run:
```bash
node --check scripts/ctx-agent-core.mjs
node --check scripts/ctx-bootstrap.mjs
node --test scripts/tests/ctx-bootstrap.test.mjs
node scripts/ctx-agent.mjs --help
```

Expected:
- syntax checks pass
- tests pass
- help output includes `--no-bootstrap`

**Step 3: Commit checkpoint**

```bash
git add scripts/ctx-agent-core.mjs scripts/ctx-bootstrap.mjs scripts/tests/ctx-bootstrap.test.mjs
git commit -m "feat(ctx-agent): auto-create bootstrap task on first run"
```

### Task 4: Update user docs for auto bootstrap and opt-out

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`

**Step 1: Add concise section**

Document:
- first-run bootstrap behavior
- generated files under `tasks/`
- opt-out via `AIOS_BOOTSTRAP_AUTO=0` or `--no-bootstrap`

**Step 2: Validate docs references**

Run:
```bash
rg -n "bootstrap|AIOS_BOOTSTRAP_AUTO|--no-bootstrap" README.md README-zh.md
```

Expected:
- both docs include the new controls.

**Step 3: Commit checkpoint**

```bash
git add README.md README-zh.md
git commit -m "docs: describe automatic bootstrap task and opt-out controls"
```

### Task 5: Final verification before completion

**Files:**
- Modify: `docs/plans/2026-03-05-auto-bootstrap-task-init-plan.md` (if verification notes needed)

**Step 1: Run verification suite**

Run:
```bash
node --check scripts/ctx-agent-core.mjs
node --check scripts/ctx-bootstrap.mjs
node --test scripts/tests/ctx-bootstrap.test.mjs
```

**Step 2: Manual smoke checks**

- In a temporary workspace with empty `tasks/`, run helper and confirm files are created once.
- Re-run and confirm no duplicate bootstrap task is created.

**Step 3: Summarize evidence**

Capture:
- commands run
- pass/fail outcomes
- created file paths
