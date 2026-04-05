# AIOS Native Enhancements v1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class repo-local `native` enhancement component that gives AIOS a coherent client-native surface across `codex`, `claude`, `gemini`, and `opencode`, with deeper v1 integration for `codex` and `claude`.

**Architecture:** Keep one shared source of truth under `client-sources/native-base/`, then materialize repo-local artifacts through a dedicated `scripts/lib/native/*` pipeline. `native` owns repo-local bootstrap/config surfaces plus managed metadata; existing `skills` keeps home/project installs, and existing `agents` stays as an advanced direct sync path rather than the default user story.

**Tech Stack:** Node.js ESM, JSON manifests, repo-local markdown/JSON templates, existing AIOS CLI/lifecycle modules, existing `skills` and `agents` sync helpers, Node test runner, Ink TUI

---

## File Structure

### New files

- `config/native-sync-manifest.json`
  - Canonical manifest for native enhancement targets, tiers, managed markers, and per-client project outputs.
- `client-sources/native-base/shared/partials/core-instructions.md`
  - Shared instruction fragment reused by all client emitters.
- `client-sources/native-base/shared/partials/contextdb.md`
  - Shared ContextDB/runtime instruction fragment.
- `client-sources/native-base/shared/partials/browser-mcp.md`
  - Shared browser MCP instruction fragment.
- `client-sources/native-base/codex/project/AGENTS.md`
  - Codex deep-tier managed block source for repo-root `AGENTS.md`.
- `client-sources/native-base/claude/project/CLAUDE.md`
  - Claude deep-tier managed block source for repo-root `CLAUDE.md`.
- `client-sources/native-base/claude/project/settings.local.json`
  - Claude deep-tier managed JSON fragment merged into `.claude/settings.local.json`.
- `client-sources/native-base/gemini/project/AIOS.md`
  - Gemini compatibility-tier repo-local bootstrap doc.
- `client-sources/native-base/opencode/project/AIOS.md`
  - Opencode compatibility-tier repo-local bootstrap doc.
- `scripts/lib/native/install-metadata.mjs`
  - Read/write `.aios-native-sync.json` sidecars and validate managed ownership.
- `scripts/lib/native/source-tree.mjs`
  - Load the native manifest, resolve source fragments, and compute client output plans.
- `scripts/lib/native/emitters/shared.mjs`
  - Shared marker constants plus helpers for markdown block replacement and JSON merge shaping.
- `scripts/lib/native/emitters/codex.mjs`
  - Render Codex repo-local targets.
- `scripts/lib/native/emitters/claude.mjs`
  - Render Claude repo-local targets.
- `scripts/lib/native/emitters/gemini.mjs`
  - Render Gemini compatibility-tier targets.
- `scripts/lib/native/emitters/opencode.mjs`
  - Render Opencode compatibility-tier targets.
- `scripts/lib/native/sync.mjs`
  - Main native sync engine with backup, rollback, unmanaged conflict detection, and per-client summaries.
- `scripts/lib/native/doctor.mjs`
  - Native-specific doctor checks and sync drift detection.
- `scripts/lib/components/native.mjs`
  - Lifecycle-facing install/update/uninstall/doctor wrapper for the native component.
- `scripts/sync-native.mjs`
  - Repo-local writer for native outputs.
- `scripts/check-native-sync.mjs`
  - Read-only verifier that generated native outputs match canonical sources.
- `scripts/tests/native-source-tree.test.mjs`
  - Unit coverage for manifest parsing, tier resolution, and expected output plans.
- `scripts/tests/native-sync.test.mjs`
  - Unit coverage for managed block updates, JSON fragment merges, rollback, and compatibility-tier outputs.
- `scripts/tests/native-doctor.test.mjs`
  - Unit coverage for metadata, conflict, drift, and recovery messaging.

### Modified files

- `scripts/aios.mjs`
  - Add `internal native <action>` dispatch and top-level lifecycle wiring.
- `scripts/lib/cli/parse-args.mjs`
  - Parse `native` as a component/internal target and support `doctor --native`.
- `scripts/lib/cli/help.mjs`
  - Document the new component and internal native commands.
- `scripts/lib/lifecycle/options.mjs`
  - Add `native` to component normalization and introduce `nativeOnly` doctor options.
- `scripts/lib/lifecycle/setup.mjs`
  - Include `native` in default setup components and call the native component installer.
- `scripts/lib/lifecycle/update.mjs`
  - Include `native` in default update components and call the native component updater.
- `scripts/lib/lifecycle/uninstall.mjs`
  - Support `--components native`.
- `scripts/lib/lifecycle/doctor.mjs`
  - Carry `nativeOnly` through planning and execution.
- `scripts/lib/doctor/aggregate.mjs`
  - Add a standard native gate and a native-only execution path.
- `scripts/lib/tui-ink/types.ts`
  - Extend component/doctor option types for `native` and `nativeOnly`.
- `scripts/lib/tui-ink/hooks/useSetupOptions.ts`
  - Add default selection and toggles for the native component.
- `scripts/lib/tui-ink/screens/SetupScreen.tsx`
  - Display `native` in the setup component checklist.
- `scripts/lib/tui-ink/screens/UpdateScreen.tsx`
  - Display `native` in the update component checklist.
- `scripts/lib/tui-ink/screens/UninstallScreen.tsx`
  - Display `native` in the uninstall component checklist.
- `scripts/lib/tui-ink/screens/DoctorScreen.tsx`
  - Add a `Native only` toggle.
- `scripts/lib/tui-ink/screens/ConfirmScreen.tsx`
  - Show native selections in the confirmation summary.
- `scripts/tests/aios-cli.test.mjs`
  - Cover `native` parsing and `doctor --native`.
- `scripts/tests/aios-lifecycle-plan.test.mjs`
  - Lock new defaults and preview strings.
- `scripts/tests/aios-components.test.mjs`
  - Cover the lifecycle-facing native component wrapper.
- `scripts/lib/tui-ink/tests/tui-ink.test.ts`
  - Keep TUI import/tests green after the new option fields.
- `scripts/package-release.sh`
  - Package `client-sources/native-base` and native sync scripts.
- `scripts/package-release.ps1`
  - Same on Windows.
- `scripts/release-preflight.sh`
  - Run `check-native-sync.mjs` and fail on native drift.
- `scripts/release-stable.sh`
  - Keep release flow aligned with the updated preflight.
- `scripts/tests/release-pipeline.test.mjs`
  - Cover packaged native source assets and native sync drift failures.
- `README.md`
  - Document `native` setup/update/doctor behavior and repo-local outputs.
- `README-zh.md`
  - Chinese version of the same behavior changes.

### Generated outputs updated by implementation

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/settings.local.json`
- `.codex/.aios-native-sync.json`
- `.claude/.aios-native-sync.json`
- `.gemini/.aios-native-sync.json`
- `.opencode/.aios-native-sync.json`
- `.gemini/AIOS.md`
- `.opencode/AIOS.md`
- `.codex/agents/**`
- `.claude/agents/**`
- `.codex/skills/**`
- `.claude/skills/**`
- `.gemini/skills/**`
- `.opencode/skills/**`

These are generated or managed outputs. Do not hand-edit them during implementation; regenerate them through the sync commands.

## Locked Decisions

- `native` is repo-local in v1. It may write repo-root files and repo-local client directories, but it must not mutate user home directories such as `~/.codex` or `~/.claude`.
- `skills` keeps owning home/project skill installs; `native` owns repo-local enhancement surfaces. Do not make both components fight over the same install target.
- `agents` remains available as a direct power-user sync, but default setup/update flows switch from `agents` to `native` because repo-local agent generation becomes part of the native story.
- Standard `doctor` includes a native gate. `doctor --native` runs only the native enhancement checks and skips unrelated shell/browser/security gates.
- Deep tier in v1:
  - `codex`: repo-root `AGENTS.md`, `.codex/agents`, `.codex/skills`
  - `claude`: repo-root `CLAUDE.md`, `.claude/settings.local.json`, `.claude/agents`, `.claude/skills`
- Compatibility tier in v1:
  - `gemini`: `.gemini/AIOS.md`, `.gemini/skills`
  - `opencode`: `.opencode/AIOS.md`, `.opencode/skills`
- Per-client managed ownership is recorded in `<client-root>/.aios-native-sync.json`, not inside user text blocks.
- Marker-bounded merges only. If AIOS cannot prove ownership of a file/block, it must stop with a conflict and tell the user how to recover.

## Chunk 1: CLI Surface And Scaffolding

### Task 1: Add the `native` component to CLI parsing, defaults, and help

**Files:**
- Create: `scripts/lib/components/native.mjs`
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/setup.mjs`
- Modify: `scripts/lib/lifecycle/update.mjs`
- Modify: `scripts/lib/lifecycle/uninstall.mjs`
- Modify: `scripts/lib/lifecycle/doctor.mjs`
- Modify: `scripts/aios.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`
- Test: `scripts/tests/aios-lifecycle-plan.test.mjs`
- Test: `scripts/tests/aios-components.test.mjs`

- [ ] **Step 1: Add failing CLI and lifecycle tests**

Add assertions like:

```js
test('parseArgs accepts native component and native-only doctor flag', () => {
  const setup = parseArgs(['setup', '--components', 'shell,native', '--client', 'claude']);
  assert.deepEqual(setup.options.components, ['shell', 'native']);

  const doctor = parseArgs(['doctor', '--native']);
  assert.equal(doctor.options.nativeOnly, true);
});

test('planSetup defaults include native and no longer default agents', () => {
  const plan = planSetup();
  assert.deepEqual(plan.options.components, ['browser', 'shell', 'skills', 'native', 'superpowers']);
  assert.match(plan.preview, /setup --components browser,shell,skills,native,superpowers/);
});
```

- [ ] **Step 2: Run the focused tests to confirm failure**

Run:

```bash
node --test scripts/tests/aios-cli.test.mjs scripts/tests/aios-lifecycle-plan.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: FAIL because `native` is not a valid component/internal target and doctor has no `nativeOnly` option.

- [ ] **Step 3: Implement the minimal CLI surface**

Make these exact changes:

- `scripts/lib/lifecycle/options.mjs`
  - add `native` to `COMPONENT_NAMES`
  - change setup/update defaults to `['browser', 'shell', 'skills', 'native', 'superpowers']`
  - keep uninstall defaults unchanged except allow `native` when requested
  - extend doctor defaults to `{ strict: false, globalSecurity: false, profile: 'standard', nativeOnly: false }`
- `scripts/lib/cli/parse-args.mjs`
  - allow `internal native <install|update|uninstall|doctor>`
  - allow `--native` only on the `doctor` command and map it to `nativeOnly: true`
- `scripts/lib/cli/help.mjs`
  - add `native` to component lists
  - document `doctor --native`
  - add internal native usage lines
- `scripts/lib/components/native.mjs`
  - export `installNativeEnhancements`, `updateNativeEnhancements`, `uninstallNativeEnhancements`, `doctorNativeEnhancements`
  - return no-op summaries for now so lifecycle wiring compiles before the real engine lands
- `scripts/aios.mjs` and lifecycle files
  - thread the new component/internal target through setup/update/uninstall/doctor without breaking existing flows

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
node --test scripts/tests/aios-cli.test.mjs scripts/tests/aios-lifecycle-plan.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: PASS. Native commands should parse, lifecycle previews should show the new defaults, and the no-op component wrapper should not crash.

- [ ] **Step 5: Commit the scaffolding**

```bash
git add scripts/aios.mjs \
  scripts/lib/components/native.mjs \
  scripts/lib/cli/parse-args.mjs \
  scripts/lib/cli/help.mjs \
  scripts/lib/lifecycle/options.mjs \
  scripts/lib/lifecycle/setup.mjs \
  scripts/lib/lifecycle/update.mjs \
  scripts/lib/lifecycle/uninstall.mjs \
  scripts/lib/lifecycle/doctor.mjs \
  scripts/tests/aios-cli.test.mjs \
  scripts/tests/aios-lifecycle-plan.test.mjs \
  scripts/tests/aios-components.test.mjs
git commit -m "feat(native): scaffold cli and lifecycle surface"
```

### Task 2: Align the Ink TUI with the new native surface

**Files:**
- Modify: `scripts/lib/tui-ink/types.ts`
- Modify: `scripts/lib/tui-ink/hooks/useSetupOptions.ts`
- Modify: `scripts/lib/tui-ink/screens/SetupScreen.tsx`
- Modify: `scripts/lib/tui-ink/screens/UpdateScreen.tsx`
- Modify: `scripts/lib/tui-ink/screens/UninstallScreen.tsx`
- Modify: `scripts/lib/tui-ink/screens/DoctorScreen.tsx`
- Modify: `scripts/lib/tui-ink/screens/ConfirmScreen.tsx`
- Test: `scripts/lib/tui-ink/tests/tui-ink.test.ts`

- [ ] **Step 1: Add a failing TUI import/option test**

Add a focused assertion that the hook/module can handle the new fields:

```ts
test('useSetupOptions exposes native component defaults', async () => {
  const mod = await import('../hooks/useSetupOptions.ts');
  assert.ok(mod.useSetupOptions);
});
```

Also update any direct type assertions so `DoctorOptions` expects `nativeOnly`.

- [ ] **Step 2: Run the TUI test file**

Run:

```bash
node --test scripts/lib/tui-ink/tests/tui-ink.test.ts
```

Expected: FAIL or type/import mismatch because the current option types and screens do not know about `native` or `nativeOnly`.

- [ ] **Step 3: Update the TUI option model**

Implement:

- `types.ts`
  - add `native: boolean` to `ComponentsConfig`
  - add `nativeOnly: boolean` to `DoctorOptions`
- `useSetupOptions.ts`
  - default `native: true` for setup/update
  - default `native: false` for uninstall
  - include `nativeOnly: false` under doctor options
  - update the “at least one component” guard so `native` counts as a valid selection
- `SetupScreen.tsx`, `UpdateScreen.tsx`, `UninstallScreen.tsx`
  - render a `Native enhancements` checkbox
- `DoctorScreen.tsx`
  - add a `Native only` checkbox above “Run doctor”
- `ConfirmScreen.tsx`
  - show the new field in the summary output

- [ ] **Step 4: Re-run the TUI tests**

Run:

```bash
node --test scripts/lib/tui-ink/tests/tui-ink.test.ts
```

Expected: PASS. The TUI modules should import cleanly with the new option shapes.

- [ ] **Step 5: Commit the TUI alignment**

```bash
git add scripts/lib/tui-ink/types.ts \
  scripts/lib/tui-ink/hooks/useSetupOptions.ts \
  scripts/lib/tui-ink/screens/SetupScreen.tsx \
  scripts/lib/tui-ink/screens/UpdateScreen.tsx \
  scripts/lib/tui-ink/screens/UninstallScreen.tsx \
  scripts/lib/tui-ink/screens/DoctorScreen.tsx \
  scripts/lib/tui-ink/screens/ConfirmScreen.tsx \
  scripts/lib/tui-ink/tests/tui-ink.test.ts
git commit -m "feat(native): expose native options in tui"
```

## Chunk 2: Native Source Contracts And Sync Engine

### Task 3: Add the canonical native manifest, source tree, and metadata contract

**Files:**
- Create: `config/native-sync-manifest.json`
- Create: `client-sources/native-base/shared/partials/core-instructions.md`
- Create: `client-sources/native-base/shared/partials/contextdb.md`
- Create: `client-sources/native-base/shared/partials/browser-mcp.md`
- Create: `client-sources/native-base/codex/project/AGENTS.md`
- Create: `client-sources/native-base/claude/project/CLAUDE.md`
- Create: `client-sources/native-base/claude/project/settings.local.json`
- Create: `client-sources/native-base/gemini/project/AIOS.md`
- Create: `client-sources/native-base/opencode/project/AIOS.md`
- Create: `scripts/lib/native/install-metadata.mjs`
- Create: `scripts/lib/native/source-tree.mjs`
- Test: `scripts/tests/native-source-tree.test.mjs`

- [ ] **Step 1: Write failing manifest/source-tree tests**

Add tests for:

```js
test('native manifest resolves deep and compatibility tiers by client', () => {
  // codex/claude => tier=deep
  // gemini/opencode => tier=compatibility
});

test('native output plan maps codex to AGENTS.md and claude to CLAUDE.md + settings.local.json', () => {
  // exact output targets are locked here
});

test('native metadata sidecar lives under the repo-local client root', () => {
  // .codex/.aios-native-sync.json etc.
});
```

- [ ] **Step 2: Run the new source-tree tests**

Run:

```bash
node --test scripts/tests/native-source-tree.test.mjs
```

Expected: FAIL because the native manifest and source-tree helpers do not exist yet.

- [ ] **Step 3: Create the canonical contracts**

Create `config/native-sync-manifest.json` with a schema like:

```json
{
  "schemaVersion": 1,
  "managedBy": "aios",
  "markers": {
    "markdownBegin": "<!-- AIOS NATIVE BEGIN -->",
    "markdownEnd": "<!-- AIOS NATIVE END -->"
  },
  "clients": {
    "codex": {
      "tier": "deep",
      "metadataRoot": ".codex",
      "outputs": ["AGENTS.md", ".codex/agents", ".codex/skills"]
    },
    "claude": {
      "tier": "deep",
      "metadataRoot": ".claude",
      "outputs": ["CLAUDE.md", ".claude/settings.local.json", ".claude/agents", ".claude/skills"]
    },
    "gemini": {
      "tier": "compatibility",
      "metadataRoot": ".gemini",
      "outputs": [".gemini/AIOS.md", ".gemini/skills"]
    },
    "opencode": {
      "tier": "compatibility",
      "metadataRoot": ".opencode",
      "outputs": [".opencode/AIOS.md", ".opencode/skills"]
    }
  }
}
```

Then implement `scripts/lib/native/install-metadata.mjs` to read/write:

```json
{
  "schemaVersion": 1,
  "managedBy": "aios",
  "kind": "native-sync",
  "client": "claude",
  "tier": "deep",
  "managedTargets": ["CLAUDE.md", ".claude/settings.local.json", ".claude/agents", ".claude/skills"],
  "generatedAt": "2026-04-05T00:00:00.000Z"
}
```

And implement `scripts/lib/native/source-tree.mjs` helpers that:

- load and validate the manifest
- resolve per-client source fragments
- return exact output plans for a selected client list
- compute sidecar metadata paths

- [ ] **Step 4: Re-run the source-tree tests**

Run:

```bash
node --test scripts/tests/native-source-tree.test.mjs
```

Expected: PASS. The manifest contract and output planning rules should now be locked.

- [ ] **Step 5: Commit the source contracts**

```bash
git add config/native-sync-manifest.json \
  client-sources/native-base \
  scripts/lib/native/install-metadata.mjs \
  scripts/lib/native/source-tree.mjs \
  scripts/tests/native-source-tree.test.mjs
git commit -m "feat(native): add canonical source contracts"
```

### Task 4: Implement native emitters and the real sync engine

**Files:**
- Create: `scripts/lib/native/emitters/shared.mjs`
- Create: `scripts/lib/native/emitters/codex.mjs`
- Create: `scripts/lib/native/emitters/claude.mjs`
- Create: `scripts/lib/native/emitters/gemini.mjs`
- Create: `scripts/lib/native/emitters/opencode.mjs`
- Create: `scripts/lib/native/sync.mjs`
- Modify: `scripts/lib/components/native.mjs`
- Test: `scripts/tests/native-sync.test.mjs`
- Test: `scripts/tests/aios-components.test.mjs`

- [ ] **Step 1: Add failing sync behavior tests**

Write tests that lock:

```js
test('native sync injects a managed block into AGENTS.md without deleting user text', async () => {
  // user preamble and epilogue must survive
});

test('native sync merges claude settings.local.json without clobbering non-AIOS keys', async () => {
  // preserve permissions.allow and unrelated hooks
});

test('native sync writes compatibility docs for gemini and opencode', async () => {
  // .gemini/AIOS.md and .opencode/AIOS.md exist
});

test('native sync rolls back managed writes when a later target write fails', async () => {
  // AGENTS.md should be restored on injected failure
});
```

- [ ] **Step 2: Run the sync tests to confirm failure**

Run:

```bash
node --test scripts/tests/native-sync.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: FAIL because the emitters and real sync engine do not exist yet.

- [ ] **Step 3: Implement the emitters and sync pipeline**

Implement the sync engine with these exact responsibilities:

- `emitters/shared.mjs`
  - export marker constants
  - export helpers for markdown block insertion/removal
  - export helpers for JSON object merge under an `aiosNative` key inside `.claude/settings.local.json`
- `emitters/codex.mjs`
  - render one managed markdown block for repo-root `AGENTS.md`
  - declare `.codex/agents` and `.codex/skills` as managed companion targets in metadata
- `emitters/claude.mjs`
  - render one managed markdown block for repo-root `CLAUDE.md`
  - render one JSON fragment for `.claude/settings.local.json`
  - declare `.claude/agents` and `.claude/skills` in metadata
- `emitters/gemini.mjs` and `emitters/opencode.mjs`
  - render compatibility docs only (`.gemini/AIOS.md`, `.opencode/AIOS.md`)
  - declare repo-local skills roots in metadata
- `scripts/lib/native/sync.mjs`
  - resolve selected clients
  - call `syncGeneratedSkills({ surfaces })` for all selected clients
  - call `syncCanonicalAgents({ targets })` only for `codex` and `claude`
  - back up all managed files before mutation
  - stop on unmanaged conflicts
  - write `<client-root>/.aios-native-sync.json`
  - return per-client summaries `{ client, tier, installed, updated, reused, skipped, removed }`
- `scripts/lib/components/native.mjs`
  - replace the no-op implementation with calls into `sync.mjs`
  - keep install/update semantics explicit: update forces rewrites of managed targets; uninstall removes only managed blocks/files

- [ ] **Step 4: Re-run the sync/component tests**

Run:

```bash
node --test scripts/tests/native-sync.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: PASS. Managed markdown/JSON merges, compatibility docs, metadata, and rollback should all be covered.

- [ ] **Step 5: Commit the sync engine**

```bash
git add scripts/lib/native/emitters/shared.mjs \
  scripts/lib/native/emitters/codex.mjs \
  scripts/lib/native/emitters/claude.mjs \
  scripts/lib/native/emitters/gemini.mjs \
  scripts/lib/native/emitters/opencode.mjs \
  scripts/lib/native/sync.mjs \
  scripts/lib/components/native.mjs \
  scripts/tests/native-sync.test.mjs \
  scripts/tests/aios-components.test.mjs
git commit -m "feat(native): implement repo-local sync engine"
```

## Chunk 3: Doctor, Release, Docs, And Verification

### Task 5: Implement native doctor and wire it into the aggregate suite

**Files:**
- Create: `scripts/lib/native/doctor.mjs`
- Modify: `scripts/lib/components/native.mjs`
- Modify: `scripts/lib/doctor/aggregate.mjs`
- Modify: `scripts/lib/lifecycle/doctor.mjs`
- Test: `scripts/tests/native-doctor.test.mjs`
- Test: `scripts/tests/aios-lifecycle-plan.test.mjs`

- [ ] **Step 1: Add failing doctor tests**

Write coverage for:

```js
test('doctor --native runs only native checks', async () => {
  // shell/browser gates should not execute
});

test('native doctor reports unmanaged conflicts with a concrete recovery command', async () => {
  // fix: node scripts/aios.mjs update --components native --client claude
});

test('native doctor reports sync drift when managed metadata and generated files disagree', async () => {
  // status=warn or error with clear note
});
```

- [ ] **Step 2: Run the doctor-focused tests**

Run:

```bash
node --test scripts/tests/native-doctor.test.mjs scripts/tests/aios-lifecycle-plan.test.mjs
```

Expected: FAIL because there is no native-specific doctor logic or native-only gate path.

- [ ] **Step 3: Implement native doctor behavior**

Implement:

- `scripts/lib/native/doctor.mjs`
  - read sidecar metadata
  - verify every listed target still exists and still matches managed markers
  - detect unmanaged blockers
  - detect drift between canonical sources and generated outputs
  - emit recovery commands
- `scripts/lib/components/native.mjs`
  - expose `doctorNativeEnhancements` and use the new module
- `scripts/lib/doctor/aggregate.mjs`
  - add `doctor:native`
  - include it in the standard suite
  - when `nativeOnly === true`, run only the native gate and print the same summary shape
- `scripts/lib/lifecycle/doctor.mjs`
  - preserve `nativeOnly` in `planDoctor` and `runDoctor`

- [ ] **Step 4: Re-run the doctor tests**

Run:

```bash
node --test scripts/tests/native-doctor.test.mjs scripts/tests/aios-lifecycle-plan.test.mjs
```

Expected: PASS. `doctor --native` should be stable and the aggregate suite should show a native gate in normal mode.

- [ ] **Step 5: Commit the doctor work**

```bash
git add scripts/lib/native/doctor.mjs \
  scripts/lib/components/native.mjs \
  scripts/lib/doctor/aggregate.mjs \
  scripts/lib/lifecycle/doctor.mjs \
  scripts/tests/native-doctor.test.mjs \
  scripts/tests/aios-lifecycle-plan.test.mjs
git commit -m "feat(native): add doctor and conflict reporting"
```

### Task 6: Add repo sync entrypoints and release/preflight coverage

**Files:**
- Create: `scripts/sync-native.mjs`
- Create: `scripts/check-native-sync.mjs`
- Modify: `scripts/package-release.sh`
- Modify: `scripts/package-release.ps1`
- Modify: `scripts/release-preflight.sh`
- Modify: `scripts/release-stable.sh`
- Test: `scripts/tests/release-pipeline.test.mjs`

- [ ] **Step 1: Add failing release-pipeline expectations**

Extend release tests to require:

```js
assert.match(stdout, /native sync clean/i);
assert.ok(extractDir.includes('client-sources/native-base'));
```

And add a failing case where `scripts/check-native-sync.mjs` exits non-zero.

- [ ] **Step 2: Run the release pipeline tests**

Run:

```bash
node --test scripts/tests/release-pipeline.test.mjs
```

Expected: FAIL because the package scripts do not include native assets and preflight does not check native drift.

- [ ] **Step 3: Implement sync/check entrypoints and release wiring**

Implement:

- `scripts/sync-native.mjs`
  - call `syncNativeEnhancements({ rootDir, io: console })`
- `scripts/check-native-sync.mjs`
  - call the read-only checker from `scripts/lib/native/doctor.mjs` or `sync.mjs`
  - exit non-zero on drift/conflict
- `package-release.sh` / `package-release.ps1`
  - include `client-sources/native-base`, `scripts/sync-native.mjs`, `scripts/check-native-sync.mjs`, and `scripts/lib/native/**`
- `release-preflight.sh`
  - run `node scripts/check-native-sync.mjs`
  - print a separate `NATIVE:` status line
- `release-stable.sh`
  - keep preflight invocation unchanged apart from the stronger checks

- [ ] **Step 4: Re-run the release pipeline tests**

Run:

```bash
node --test scripts/tests/release-pipeline.test.mjs
```

Expected: PASS. Release packaging should now carry the native source tree, and preflight should reject native drift.

- [ ] **Step 5: Commit the release wiring**

```bash
git add scripts/sync-native.mjs \
  scripts/check-native-sync.mjs \
  scripts/package-release.sh \
  scripts/package-release.ps1 \
  scripts/release-preflight.sh \
  scripts/release-stable.sh \
  scripts/tests/release-pipeline.test.mjs
git commit -m "feat(native): add sync commands and release checks"
```

### Task 7: Update public docs and operator guidance

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`

- [ ] **Step 1: Draft the documentation diff**

Add or update sections covering:

- what `native` means versus `skills` and `agents`
- repo-local outputs per client
- `setup`, `update`, `uninstall`, and `doctor --native` examples
- conflict policy and recovery commands
- compatibility-tier warning for `gemini` and `opencode`

Use exact command examples:

```bash
node scripts/aios.mjs setup --components native --client codex
node scripts/aios.mjs update --components native --client claude
node scripts/aios.mjs doctor --native
node scripts/sync-native.mjs
```

- [ ] **Step 2: Run a quick grep sanity check**

Run:

```bash
rg -n "native|doctor --native|sync-native" README.md README-zh.md
```

Expected: The docs mention the new component consistently in both languages.

- [ ] **Step 3: Commit the docs**

```bash
git add README.md README-zh.md
git commit -m "docs(native): document native enhancement workflows"
```

### Task 8: Run the full verification matrix and regenerate repo-local outputs

**Files:**
- Modify: generated repo-local outputs if sync rewrites them

- [ ] **Step 1: Regenerate repo-local managed outputs**

Run:

```bash
node scripts/sync-skills.mjs
node scripts/sync-native.mjs
```

Expected: `.codex/skills`, `.claude/skills`, `.gemini/skills`, `.opencode/skills`, root instruction files, and native sidecars all align with canonical sources.

- [ ] **Step 2: Run the script test suite**

Run:

```bash
npm run test:scripts
```

Expected: PASS.

- [ ] **Step 3: Run the MCP server validation**

Run:

```bash
cd mcp-server && npm run typecheck && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 4: Run native-specific smoke checks**

Run:

```bash
node scripts/aios.mjs setup --components native --client codex --skip-doctor
node scripts/aios.mjs setup --components native --client claude --skip-doctor
node scripts/aios.mjs setup --components native --client gemini --skip-doctor
node scripts/aios.mjs setup --components native --client opencode --skip-doctor
node scripts/aios.mjs doctor --native
```

Expected:

- codex: managed block appears in `AGENTS.md`, `.codex/.aios-native-sync.json` exists
- claude: managed block appears in `CLAUDE.md`, `.claude/settings.local.json` retains user keys plus AIOS-managed fragment
- gemini/opencode: compatibility docs and native sidecars exist
- doctor reports `status: ok` or precise actionable warnings only

- [ ] **Step 5: Create the final implementation commit**

```bash
git add -A
git commit -m "feat(native): ship native enhancements v1"
```

## Manual Review Notes

- The `writing-plans` skill expects a plan-document-reviewer subagent loop. If the current runtime still lacks subagent dispatch, do a manual chunk-by-chunk review before execution and record any deviations in the execution log.
- Before starting implementation, verify exact client-native file conventions again. If a client’s official bootstrap file has changed, update the canonical source tree and this plan together before touching runtime code.

Plan complete and saved to `docs/superpowers/plans/2026-04-05-aios-native-enhancements-v1-plan.md`. Ready to execute?
