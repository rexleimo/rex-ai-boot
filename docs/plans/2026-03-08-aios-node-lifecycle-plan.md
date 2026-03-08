# AIOS Node Lifecycle Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace duplicated Bash/PowerShell lifecycle logic with one Node.js implementation for `aios`, `setup`, `update`, `uninstall`, and `verify`, while keeping shell and PowerShell files as thin compatibility wrappers.

**Architecture:** Add a root Node script package and build `scripts/aios.mjs` as the single source of truth for TUI, CLI parsing, lifecycle orchestration, and verification. Move domain behavior into Node modules under `scripts/lib/`, then reduce `.sh` and `.ps1` files to bootstrap-and-forward adapters.

**Tech Stack:** Node.js 20+ ESM, built-in `node:test`, existing repository scripts/layout, child-process spawning for external tools, minimal shell/PowerShell bootstrap wrappers.

---

### Task 1: Establish root Node script tooling

**Files:**
- Create: `package.json`
- Modify: `README.md`
- Modify: `README-zh.md`

**Step 1: Add root script package metadata**

Create `package.json` with:
- `private: true`
- `type: module`
- `engines.node: >=20`
- npm scripts for `aios`, script tests, and basic smoke helpers

**Step 2: Document Node 20+ as the lifecycle runtime**

Update `README.md` and `README-zh.md` so the lifecycle section states:
- Node now owns lifecycle execution
- `.sh` / `.ps1` files are compatibility wrappers
- recommended Node version remains 22 LTS

**Step 3: Verify metadata reads cleanly**

Run:
- `node -p "require('./package.json').engines.node"`

Expected:
- prints `>=20`

---

### Task 2: Add the shared Node CLI contract

**Files:**
- Create: `scripts/aios.mjs`
- Create: `scripts/lib/cli/help.mjs`
- Create: `scripts/lib/cli/parse-args.mjs`
- Create: `scripts/lib/lifecycle/options.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`

**Step 1: Write the failing CLI contract test**

Cover:
- `node scripts/aios.mjs --help`
- `node scripts/aios.mjs setup --components all --mode opt-in --client all`
- `node scripts/aios.mjs doctor --strict`
- invalid `--mode` / invalid `--client` rejection

**Step 2: Run the CLI test to confirm it fails**

Run:
- `node --test scripts/tests/aios-cli.test.mjs`

Expected:
- FAIL because `scripts/aios.mjs` and parser modules do not exist yet

**Step 3: Implement minimal CLI parsing and help output**

Implement:
- no-subcommand => interactive mode marker
- `setup|update|uninstall|doctor` subcommands
- shared option normalization for `components`, `mode`, `client`, `strict`, `global-security`

**Step 4: Re-run the CLI test**

Run:
- `node --test scripts/tests/aios-cli.test.mjs`

Expected:
- PASS

---

### Task 3: Add a testable Node TUI state machine

**Files:**
- Create: `scripts/lib/tui/state.mjs`
- Create: `scripts/lib/tui/render.mjs`
- Create: `scripts/lib/tui/session.mjs`
- Test: `scripts/tests/aios-tui-state.test.mjs`

**Step 1: Write the failing reducer test for the current bug**

Cover:
- moving selection up/down
- toggling with `space`
- activating the highlighted action with `enter`
- `b` returning to previous screen
- `q` requesting exit

**Step 2: Run the reducer test to confirm it fails**

Run:
- `node --test scripts/tests/aios-tui-state.test.mjs`

Expected:
- FAIL because TUI reducer/session files do not exist yet

**Step 3: Implement a pure reducer first**

Implement screen state as plain objects so `enter` behavior is unit-testable without a real terminal.

**Step 4: Add raw terminal adapter second**

Use:
- `readline.emitKeypressEvents`
- `process.stdin.setRawMode(true)` when available
- cleanup handlers for `SIGINT`, exceptions, and normal exit

**Step 5: Re-run the TUI reducer test**

Run:
- `node --test scripts/tests/aios-tui-state.test.mjs`

Expected:
- PASS

---

### Task 4: Port lifecycle option planning into Node

**Files:**
- Create: `scripts/lib/lifecycle/setup.mjs`
- Create: `scripts/lib/lifecycle/update.mjs`
- Create: `scripts/lib/lifecycle/uninstall.mjs`
- Create: `scripts/lib/lifecycle/doctor.mjs`
- Test: `scripts/tests/aios-lifecycle-plan.test.mjs`

**Step 1: Write failing tests for execution-plan generation**

Cover:
- default setup selects `browser,shell,skills,superpowers`
- uninstall defaults match current behavior
- doctor strict/global-security flags map correctly
- preview command strings are stable across TUI and CLI flows

**Step 2: Run the lifecycle plan test to confirm it fails**

Run:
- `node --test scripts/tests/aios-lifecycle-plan.test.mjs`

Expected:
- FAIL because lifecycle handlers do not exist yet

**Step 3: Implement deterministic lifecycle planners**

Each handler should return:
- normalized options
- step list
- preview command text
- execution callback or structured action list

**Step 4: Re-run the lifecycle plan test**

Run:
- `node --test scripts/tests/aios-lifecycle-plan.test.mjs`

Expected:
- PASS

---

### Task 5: Port component installation/update/uninstall behavior into Node

**Files:**
- Create: `scripts/lib/components/browser.mjs`
- Create: `scripts/lib/components/shell.mjs`
- Create: `scripts/lib/components/privacy-guard.mjs`
- Create: `scripts/lib/components/skills.mjs`
- Create: `scripts/lib/components/superpowers.mjs`
- Create: `scripts/lib/platform/paths.mjs`
- Create: `scripts/lib/platform/fs.mjs`
- Create: `scripts/lib/platform/process.mjs`
- Test: `scripts/tests/aios-components.test.mjs`

**Step 1: Write failing component behavior tests**

Use temporary directories to cover:
- path resolution
- idempotent file writes/symlink creation
- selected-client skill installation planning
- uninstalling only selected integrations

**Step 2: Run the component test to confirm it fails**

Run:
- `node --test scripts/tests/aios-components.test.mjs`

Expected:
- FAIL because the Node component modules do not exist yet

**Step 3: Port `shell` and `privacy-guard` first**

Prefer pure Node file operations for:
- shell/profile patching
- marker/config creation
- removable install markers where needed

**Step 4: Port `skills` and `superpowers` next**

Implement file copy/symlink behavior in Node and spawn `git` only where repo sync is necessary.

**Step 5: Port `browser` component last**

Implement the Node orchestration for:
- `mcp-server` dependency install/update checks
- Playwright install toggles
- browser MCP doctor hooks

**Step 6: Re-run the component test**

Run:
- `node --test scripts/tests/aios-components.test.mjs`

Expected:
- PASS

---

### Task 6: Port verification and doctor aggregation into Node

**Files:**
- Create: `scripts/lib/doctor/checks.mjs`
- Create: `scripts/lib/doctor/aggregate.mjs`
- Test: `scripts/tests/aios-doctor.test.mjs`
- Modify: `scripts/doctor-bootstrap-task.mjs`
- Modify: `scripts/doctor-security-config.mjs`

**Step 1: Write the failing doctor aggregation test**

Cover:
- warn counting
- ignored warn classes
- strict mode turning warnings into exit 1
- `mcp-server` typecheck/build summary wiring

**Step 2: Run the doctor test to confirm it fails**

Run:
- `node --test scripts/tests/aios-doctor.test.mjs`

Expected:
- FAIL because the new doctor aggregator does not exist yet

**Step 3: Implement the shared doctor aggregator**

Move logic out of `verify-aios.sh` / `verify-aios.ps1` into Node, while reusing existing `.mjs` doctor helpers where practical.

**Step 4: Re-run the doctor test**

Run:
- `node --test scripts/tests/aios-doctor.test.mjs`

Expected:
- PASS

---

### Task 7: Convert public lifecycle scripts into thin wrappers

**Files:**
- Modify: `scripts/aios.sh`
- Modify: `scripts/aios.ps1`
- Modify: `scripts/setup-all.sh`
- Modify: `scripts/setup-all.ps1`
- Modify: `scripts/update-all.sh`
- Modify: `scripts/update-all.ps1`
- Modify: `scripts/uninstall-all.sh`
- Modify: `scripts/uninstall-all.ps1`
- Modify: `scripts/verify-aios.sh`
- Modify: `scripts/verify-aios.ps1`
- Test: `scripts/tests/aios-wrappers.test.mjs`

**Step 1: Write failing wrapper mapping tests**

Cover:
- wrapper subcommand maps to correct Node subcommand
- `--` passthrough remains intact
- missing Node prints actionable install guidance
- unsupported old arguments fail clearly

**Step 2: Run the wrapper test to confirm it fails**

Run:
- `node --test scripts/tests/aios-wrappers.test.mjs`

Expected:
- FAIL because wrappers still contain duplicated lifecycle logic

**Step 3: Reduce wrappers to bootstrap-only logic**

Implement only:
- locate Node
- enforce Node >= 20
- optionally suggest/install Node
- exec `node scripts/aios.mjs ...`

**Step 4: Re-run the wrapper test**

Run:
- `node --test scripts/tests/aios-wrappers.test.mjs`

Expected:
- PASS for Node-call planning logic; platform-manual parts remain documented as smoke tests

---

### Task 8: Update docs for the Node-first lifecycle flow

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`
- Modify: `docs/plans/2026-03-08-aios-node-lifecycle-design.md`

**Step 1: Update quick-start wording**

Clarify that:
- Node owns lifecycle behavior
- shell/PowerShell entrypoints are wrappers
- direct Node usage is the canonical implementation path

**Step 2: Add troubleshooting note**

Document:
- Node missing
- Node too old
- wrapper forwarded command examples

**Step 3: Keep user-facing commands backward compatible**

Do not remove the existing shell/PowerShell examples; relabel them as compatibility entrypoints.

---

### Task 9: Verify the migration end-to-end

**Files:**
- Test: `scripts/tests/aios-cli.test.mjs`
- Test: `scripts/tests/aios-tui-state.test.mjs`
- Test: `scripts/tests/aios-lifecycle-plan.test.mjs`
- Test: `scripts/tests/aios-components.test.mjs`
- Test: `scripts/tests/aios-doctor.test.mjs`
- Test: `scripts/tests/aios-wrappers.test.mjs`

**Step 1: Run focused script tests**

Run:
- `node --test scripts/tests/aios-cli.test.mjs scripts/tests/aios-tui-state.test.mjs scripts/tests/aios-lifecycle-plan.test.mjs scripts/tests/aios-components.test.mjs scripts/tests/aios-doctor.test.mjs scripts/tests/aios-wrappers.test.mjs`

Expected:
- all pass

**Step 2: Run Node CLI smoke commands**

Run:
- `node scripts/aios.mjs --help`
- `node scripts/aios.mjs setup --help`
- `node scripts/aios.mjs doctor --help`

Expected:
- help output is stable and non-interactive

**Step 3: Run repo verification**

Run:
- `node scripts/aios.mjs doctor`
- `cd mcp-server && npm run typecheck && npm run build`

Expected:
- doctor completes
- typecheck passes
- build passes

**Step 4: Perform manual wrapper smoke**

Run:
- `scripts/aios.sh --help`
- `scripts/setup-all.sh --help`
- `scripts/verify-aios.sh --help`

On Windows:
- `powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1 --help`
- `powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Help`
- `powershell -ExecutionPolicy Bypass -File .\scripts\verify-aios.ps1 -Help`

Expected:
- wrappers forward correctly
- no duplicated lifecycle behavior remains in wrappers

---

### Task 10: Optional commit

If user requests a commit:

- `git add package.json scripts docs/plans README.md README-zh.md`
- `git commit -m "feat(onboarding): consolidate lifecycle flow into node"`
