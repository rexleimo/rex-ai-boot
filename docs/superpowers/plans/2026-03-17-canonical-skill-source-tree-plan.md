# Canonical Skill Source Tree Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move repository skills to a canonical `skill-sources/` tree, generate repo-local client skill roots from that tree, and switch skills install/update flows from link-default to copy-default with explicit managed metadata and legacy-link migration support.

**Architecture:** Split responsibilities into two manifests and two execution paths. `config/skills-sync-manifest.json` plus `skill-sources/` define repo-local generation, while `config/skills-catalog.json` stays the installability manifest. `sync-skills` becomes the only writer for repo-local client roots, and installer flows materialize copy-based installs from canonical source trees with an explicit metadata file. `project` installs must refuse `projectRoot === rootDir` so repo-local generated roots and install targets never share ownership.

**Tech Stack:** Node.js ESM, JSON manifests, filesystem copy/symlink helpers, existing AIOS CLI/lifecycle modules, Node test runner, release shell/PowerShell scripts

---

## File Structure

### New files

- `config/skills-sync-manifest.json`
  - Repo-local generation manifest: canonical relative paths, repo target surfaces, install exposure, and unmanaged legacy exceptions.
- `scripts/lib/skills/source-tree.mjs`
  - Enumerate canonical skill paths, resolve client overlays, and build materialized skill trees.
- `scripts/lib/skills/sync.mjs`
  - Sync repo-local generated skill roots from `skill-sources/` using managed directory metadata.
- `scripts/lib/skills/install-metadata.mjs`
  - Read/write/validate `.aios-skill-install.json` metadata for copy installs and generated outputs.
- `scripts/sync-skills.mjs`
  - CLI entrypoint for repo-local generation.
- `scripts/check-skills-sync.mjs`
  - Read-only verification that generated repo-local skill roots match `skill-sources/`.
- `scripts/tests/skills-source-tree.test.mjs`
  - Unit coverage for canonical path resolution, namespaced paths, and base-plus-overlay behavior.
- `scripts/tests/skills-sync.test.mjs`
  - Unit coverage for repo-local generated tree ownership, unmanaged blockers, and drift detection.
- `skill-sources/find-skills/SKILL.md`
- `skill-sources/search-first/SKILL.md`
- `skill-sources/security-scan/SKILL.md`
- `skill-sources/verification-loop/SKILL.md`
- `skill-sources/versioning-by-impact/SKILL.md`
- `skill-sources/skill-constraints/SKILL.md`
- `skill-sources/aios-project-system/SKILL.md`
- `skill-sources/aios-long-running-harness/SKILL.md`
- `skill-sources/contextdb-autopilot/SKILL.md`
- `skill-sources/cap-commit-push/SKILL.md`
- `skill-sources/aios-jimeng-image-ops/SKILL.md`
- `skill-sources/seed2-manga-drama/SKILL.md`
- `skill-sources/seo-geo-page-optimization/SKILL.md`
- `skill-sources/xhs-ops-methods/SKILL.md`
- `skill-sources/.system/skill-creator/SKILL.md`
- `skill-sources/.system/skill-installer/SKILL.md`

### Modified files

- `config/skills-catalog.json`
  - Repoint installable skill sources to canonical `skill-sources/...` paths.
- `scripts/lib/components/skills.mjs`
  - Replace link-only install semantics with copy-default installs, legacy link recognition, sync-root guardrails, and metadata-aware doctor/uninstall.
- `scripts/lib/platform/fs.mjs`
  - Add managed directory helpers and allow `skill-sources/` as a canonical repo root without false warnings.
- `scripts/lib/cli/parse-args.mjs`
  - Parse `--install-mode <copy|link>` for setup/update/internal skills install/update.
- `scripts/lib/cli/help.mjs`
  - Document the new install mode and sync/check commands where appropriate.
- `scripts/aios.mjs`
  - Thread `installMode` through internal skills actions.
- `scripts/lib/lifecycle/options.mjs`
  - Normalize install mode defaults and validation.
- `scripts/lib/lifecycle/setup.mjs`
  - Pass install mode into skills install flow.
- `scripts/lib/lifecycle/update.mjs`
  - Pass install mode into skills update flow.
- `scripts/lib/tui/session.mjs`
  - Guard repo-root project installs and keep installed-marker logic aligned with metadata-aware installs.
- `scripts/tests/skills-component.test.mjs`
  - Update install/doctor/uninstall coverage from symlink-only behavior to copy-default + metadata.
- `scripts/tests/aios-components.test.mjs`
  - Replace symlink assumptions with copy-default expectations and add legacy-link migration coverage.
- `scripts/tests/aios-cli.test.mjs`
  - Add parser coverage for `--install-mode`.
- `scripts/package-release.sh`
  - Include `skill-sources/` and run sync-check expectations in packaged assets.
- `scripts/package-release.ps1`
  - Include `skill-sources/` in Windows package assets.
- `scripts/release-preflight.sh`
  - Run `check-skills-sync` before confirming a releasable tag.
- `scripts/release-stable.sh`
  - Ensure release flow calls the updated preflight.
- `scripts/tests/release-pipeline.test.mjs`
  - Verify packaged assets include `skill-sources/` and preflight fails on sync drift.
- `README.md`
  - Document canonical source authoring, sync command, and copy-default install behavior.
- `README-zh.md`
  - Chinese version of the same behavior changes.

### Generated outputs updated by implementation

- `.codex/skills/**`
- `.claude/skills/**`
- `.agents/skills/**`
- `.gemini/skills/**`
- `.opencode/skills/**`

These are not hand-edited during implementation; they are rewritten by `scripts/sync-skills.mjs`.

## Locked Decisions

- Canonical identity is the relative path under `skill-sources/`. Example: `.system/skill-creator`.
- CLI selection key remains catalog `name` for installable skills. Metadata stores both `skillName` and `relativeSkillPath`.
- `config/skills-sync-manifest.json` drives repo-local generation ownership. `config/skills-catalog.json` drives installer exposure.
- `.agents/skills` is sync-only compatibility output and is not part of `installContextDbSkills`.
- `project` installs must error when `projectRoot === rootDir`, with a message to use `node scripts/sync-skills.mjs` instead.

## Chunk 1: Canonical Source Contracts

### Task 1: Add the repo-local generation manifest

**Files:**
- Create: `config/skills-sync-manifest.json`
- Modify: `config/skills-catalog.json`
- Test: `scripts/tests/skills-source-tree.test.mjs`

- [ ] **Step 1: Write the failing manifest/resolution tests**

Add tests that lock:

```js
test('canonical relative path preserves namespaced skills', async () => {
  // .system/skill-creator stays namespaced in generated targets
});

test('sync manifest can mark repo-only compatibility targets', async () => {
  // .agents/skills is generated but never installable
});

test('catalog name and canonical relative path can differ', async () => {
  // skillName=skill-creator, relativeSkillPath=.system/skill-creator
});
```

- [ ] **Step 2: Run the new tests to verify failure**

Run:

```bash
node --test scripts/tests/skills-source-tree.test.mjs
```

Expected: FAIL because no canonical source manifest or resolver exists yet.

- [ ] **Step 3: Create `config/skills-sync-manifest.json`**

Use a checked-in schema like:

```json
{
  "schemaVersion": 1,
  "generatedRoots": {
    "codex": ".codex/skills",
    "claude": ".claude/skills",
    "gemini": ".gemini/skills",
    "opencode": ".opencode/skills",
    "agents": ".agents/skills"
  },
  "skills": [
    {
      "relativeSkillPath": "find-skills",
      "installCatalogName": "find-skills",
      "repoTargets": ["codex", "claude", "gemini", "opencode", "agents"],
      "installClients": ["codex", "claude", "gemini", "opencode"]
    },
    {
      "relativeSkillPath": ".system/skill-creator",
      "installCatalogName": null,
      "repoTargets": ["codex", "claude"],
      "installClients": []
    }
  ],
  "legacyUnmanaged": [
    ".claude/skills/baoyu-xhs-images"
  ]
}
```

- [ ] **Step 4: Repoint installable catalog entries to canonical paths**

Update `config/skills-catalog.json` so installable skills use:

```json
{
  "name": "find-skills",
  "source": "skill-sources/find-skills"
}
```

Do not add `.system/skill-creator` or `.system/skill-installer` to the install catalog in this phase.

- [ ] **Step 5: Re-run the tests**

Run:

```bash
node --test scripts/tests/skills-source-tree.test.mjs
```

Expected: still FAIL until resolver code exists, but manifest parsing assertions should now have fixtures to target.

### Task 2: Implement canonical source resolution helpers

**Files:**
- Create: `scripts/lib/skills/source-tree.mjs`
- Test: `scripts/tests/skills-source-tree.test.mjs`

- [ ] **Step 1: Add failing resolver expectations**

Extend tests for:

```js
test('materializeSkillTree copies base tree then overlays client-specific files', async () => {
  // base references/assets/scripts preserved
});

test('materializeSkillTree excludes the clients subtree from emitted output', async () => {
  // no emitted clients/ directory
});

test('resolveGeneratedTargetPath preserves relativeSkillPath', async () => {
  // .system/skill-creator -> .codex/skills/.system/skill-creator
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/skills-source-tree.test.mjs
```

Expected: FAIL with missing module/helper exports.

- [ ] **Step 3: Implement the source-tree module**

Export focused helpers:

```js
loadSkillsSyncManifest(rootDir)
listCanonicalSkills(rootDir, manifest)
materializeSkillTree({ rootDir, relativeSkillPath, client })
resolveGeneratedTargetPath({ rootDir, relativeSkillPath, targetRoot })
```

Implementation rules:

- canonical source root is `path.join(rootDir, 'skill-sources', relativeSkillPath)`
- copy the shared tree first
- overlay `clients/<client>/`
- never emit `clients/` itself

- [ ] **Step 4: Re-run tests to verify pass**

Run:

```bash
node --test scripts/tests/skills-source-tree.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add config/skills-sync-manifest.json config/skills-catalog.json scripts/lib/skills/source-tree.mjs scripts/tests/skills-source-tree.test.mjs
git commit -m "feat(skills): add canonical skill source manifest and resolver"
```

## Chunk 2: Canonical Content Migration and Repo-Local Sync

### Task 3: Seed the canonical `skill-sources/` tree

**Files:**
- Create: `skill-sources/find-skills/SKILL.md`
- Create: `skill-sources/search-first/SKILL.md`
- Create: `skill-sources/security-scan/SKILL.md`
- Create: `skill-sources/verification-loop/SKILL.md`
- Create: `skill-sources/versioning-by-impact/SKILL.md`
- Create: `skill-sources/skill-constraints/SKILL.md`
- Create: `skill-sources/aios-project-system/SKILL.md`
- Create: `skill-sources/aios-long-running-harness/SKILL.md`
- Create: `skill-sources/contextdb-autopilot/SKILL.md`
- Create: `skill-sources/cap-commit-push/SKILL.md`
- Create: `skill-sources/aios-jimeng-image-ops/SKILL.md`
- Create: `skill-sources/seed2-manga-drama/SKILL.md`
- Create: `skill-sources/seo-geo-page-optimization/SKILL.md`
- Create: `skill-sources/xhs-ops-methods/SKILL.md`
- Create: `skill-sources/.system/skill-creator/SKILL.md`
- Create: `skill-sources/.system/skill-installer/SKILL.md`

- [ ] **Step 1: Copy the current maintained skill bodies into canonical paths**

Copy content from the current repo roots into matching canonical sources:

```text
.codex/skills/find-skills/SKILL.md                  -> skill-sources/find-skills/SKILL.md
.codex/skills/search-first/SKILL.md                 -> skill-sources/search-first/SKILL.md
.codex/skills/security-scan/SKILL.md                -> skill-sources/security-scan/SKILL.md
.codex/skills/verification-loop/SKILL.md            -> skill-sources/verification-loop/SKILL.md
.codex/skills/versioning-by-impact/SKILL.md         -> skill-sources/versioning-by-impact/SKILL.md
.codex/skills/skill-constraints/SKILL.md            -> skill-sources/skill-constraints/SKILL.md
.codex/skills/aios-project-system/SKILL.md          -> skill-sources/aios-project-system/SKILL.md
.codex/skills/aios-long-running-harness/SKILL.md    -> skill-sources/aios-long-running-harness/SKILL.md
.codex/skills/contextdb-autopilot/SKILL.md          -> skill-sources/contextdb-autopilot/SKILL.md
.codex/skills/cap-commit-push/SKILL.md              -> skill-sources/cap-commit-push/SKILL.md
.codex/skills/aios-jimeng-image-ops/SKILL.md        -> skill-sources/aios-jimeng-image-ops/SKILL.md
.codex/skills/seed2-manga-drama/SKILL.md            -> skill-sources/seed2-manga-drama/SKILL.md
.codex/skills/seo-geo-page-optimization/SKILL.md    -> skill-sources/seo-geo-page-optimization/SKILL.md
.codex/skills/xhs-ops-methods/SKILL.md              -> skill-sources/xhs-ops-methods/SKILL.md
.codex/skills/.system/skill-creator/SKILL.md        -> skill-sources/.system/skill-creator/SKILL.md
.codex/skills/.system/skill-installer/SKILL.md      -> skill-sources/.system/skill-installer/SKILL.md
```

- [ ] **Step 2: Add client-specific overrides only where bodies genuinely differ**

If `.claude/skills/skill-creator/SKILL.md` must remain different from Codex’s `.system/skill-creator`, create:

```text
skill-sources/.system/skill-creator/clients/claude/SKILL.md
```

Do not duplicate entire skill trees unless the content actually diverges.

- [ ] **Step 3: Record the unmanaged legacy exception**

Keep `.claude/skills/baoyu-xhs-images/SKILL.md` out of `skill-sources/` in phase 1 and make sure it stays in `legacyUnmanaged`.

- [ ] **Step 4: Spot-check canonical content**

Run:

```bash
find skill-sources -name SKILL.md | sort
```

Expected: one `SKILL.md` for each managed canonical source path, plus any deliberate client override file.

- [ ] **Step 5: Commit**

```bash
git add skill-sources
git commit -m "refactor(skills): seed canonical skill source tree"
```

### Task 4: Implement repo-local sync and managed generated-tree metadata

**Files:**
- Create: `scripts/lib/skills/install-metadata.mjs`
- Create: `scripts/lib/skills/sync.mjs`
- Create: `scripts/sync-skills.mjs`
- Create: `scripts/check-skills-sync.mjs`
- Modify: `scripts/lib/platform/fs.mjs`
- Test: `scripts/tests/skills-sync.test.mjs`
- Test: `scripts/tests/aios-components.test.mjs`

- [ ] **Step 1: Write failing sync tests**

Add tests for:

```js
test('sync-skills writes managed repo-local skill trees with metadata', async () => {});
test('sync-skills skips unmanaged blockers and reports them', async () => {});
test('check-skills-sync reports stale generated outputs', async () => {});
test('collectUnexpectedSkillRootFindings does not warn on skill-sources', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/skills-sync.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: FAIL because sync and metadata helpers do not exist yet.

- [ ] **Step 3: Add directory-level metadata helpers**

In `scripts/lib/skills/install-metadata.mjs`, implement:

```js
const GENERATED_META = '.aios-skill-sync.json';
const INSTALL_META = '.aios-skill-install.json';

writeGeneratedSkillMetadata(...)
readGeneratedSkillMetadata(...)
writeInstalledSkillMetadata(...)
readInstalledSkillMetadata(...)
```

For generated repo-local roots, write metadata like:

```json
{
  "schemaVersion": 1,
  "managedBy": "aios",
  "kind": "generated-skill",
  "relativeSkillPath": ".system/skill-creator",
  "targetSurface": "codex",
  "source": "skill-sources/.system/skill-creator"
}
```

- [ ] **Step 4: Implement `sync-skills`**

`scripts/lib/skills/sync.mjs` should:

- enumerate canonical entries from `config/skills-sync-manifest.json`
- materialize source trees through `source-tree.mjs`
- write/rewrite generated repo-local roots for `codex`, `claude`, `gemini`, `opencode`, and `agents`
- skip unmanaged blockers
- remove stale managed outputs

`scripts/sync-skills.mjs` should print a per-target summary.

- [ ] **Step 5: Implement read-only drift checking**

`scripts/check-skills-sync.mjs` should:

- compare materialized canonical trees to repo-local generated roots
- exit `0` when clean
- exit non-zero when drift exists
- print the full mismatch summary before exiting

- [ ] **Step 6: Re-run tests to verify pass**

Run:

```bash
node --test scripts/tests/skills-sync.test.mjs scripts/tests/aios-components.test.mjs
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

Expected:

- test run PASS
- `sync-skills` prints installed/updated/skipped/removed summaries
- `check-skills-sync` exits `0`

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/skills/install-metadata.mjs scripts/lib/skills/sync.mjs scripts/sync-skills.mjs scripts/check-skills-sync.mjs scripts/lib/platform/fs.mjs scripts/tests/skills-sync.test.mjs scripts/tests/aios-components.test.mjs
git commit -m "feat(skills): generate repo-local skill roots from canonical sources"
```

## Chunk 3: Copy-Default Installer and Legacy Migration

### Task 5: Add install mode plumbing and repo-root guardrails

**Files:**
- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/aios.mjs`
- Modify: `scripts/lib/lifecycle/setup.mjs`
- Modify: `scripts/lib/lifecycle/update.mjs`
- Modify: `scripts/lib/tui/session.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`

- [ ] **Step 1: Add failing CLI and guardrail tests**

Add/extend tests for:

```js
test('parseArgs accepts --install-mode copy and --install-mode link', () => {});
test('project install into source repo root is rejected with sync-skills guidance', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/aios-cli.test.mjs scripts/tests/skills-component.test.mjs
```

Expected: FAIL because install mode and root guardrails do not exist.

- [ ] **Step 3: Implement install mode option**

Add `installMode` defaulting to `copy` for:

- `node scripts/aios.mjs setup`
- `node scripts/aios.mjs update`
- `node scripts/aios.mjs internal skills install`
- `node scripts/aios.mjs internal skills update`

Document:

```text
--install-mode <copy|link>     Skills install mode (default: copy)
```

- [ ] **Step 4: Reject source-repo project installs**

If `scope === 'project'` and `projectRoot === rootDir`, fail with:

```text
[err] project installs into the source repo are owned by sync-skills; run: node scripts/sync-skills.mjs
```

- [ ] **Step 5: Re-run tests**

Run:

```bash
node --test scripts/tests/aios-cli.test.mjs scripts/tests/skills-component.test.mjs
```

Expected: PASS for parser and guardrail coverage.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/lifecycle/options.mjs scripts/lib/cli/parse-args.mjs scripts/lib/cli/help.mjs scripts/aios.mjs scripts/lib/lifecycle/setup.mjs scripts/lib/lifecycle/update.mjs scripts/lib/tui/session.mjs scripts/tests/aios-cli.test.mjs
git commit -m "feat(skills): add install mode and source-repo guardrails"
```

### Task 6: Replace symlink-default install behavior with copy-default + metadata

**Files:**
- Modify: `scripts/lib/components/skills.mjs`
- Modify: `scripts/lib/platform/fs.mjs`
- Modify: `scripts/lib/skills/install-metadata.mjs`
- Test: `scripts/tests/skills-component.test.mjs`
- Test: `scripts/tests/aios-components.test.mjs`

- [ ] **Step 1: Add failing install/doctor/uninstall tests**

Cover:

```js
test('default install mode copies skill trees and writes install metadata', async () => {});
test('explicit link mode preserves current symlink behavior', async () => {});
test('doctor recognizes managed copy installs', async () => {});
test('uninstall removes managed copy installs only', async () => {});
test('legacy symlink installs under old repo-local roots are recognized as legacy-managed', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: FAIL because the code still assumes symlink identity.

- [ ] **Step 3: Add copy materialization helpers**

In `scripts/lib/platform/fs.mjs`, add focused helpers such as:

```js
copyDirRecursive(sourcePath, targetPath)
removeManagedDirectory(targetPath, metaReader)
isLegacyManagedSkillLink(targetPath, { rootDir, relativeSkillPath, clientName })
```

- [ ] **Step 4: Update `scripts/lib/components/skills.mjs`**

Implement:

- `installMode === 'copy'` as the default
- metadata-aware replace/skip behavior
- legacy-link recognition when old installs still point into repo-local generated roots
- `doctor` messages that distinguish:
  - managed copy install
  - managed link install
  - legacy managed link install
  - unmanaged existing directory

- [ ] **Step 5: Re-run tests**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: PASS

- [ ] **Step 6: Manual smoke test with temp homes**

Run:

```bash
TMP_HOME="$(mktemp -d)"
CODEX_HOME="$TMP_HOME/.codex" node scripts/aios.mjs internal skills install --client codex --scope global --skills find-skills
CODEX_HOME="$TMP_HOME/.codex" node scripts/aios.mjs internal skills doctor --client codex --scope global --skills find-skills
CODEX_HOME="$TMP_HOME/.codex" node scripts/aios.mjs internal skills uninstall --client codex --scope global --skills find-skills
```

Expected:

- install reports `installed=` with copy mode
- doctor reports managed install
- uninstall removes the copied tree cleanly

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/components/skills.mjs scripts/lib/platform/fs.mjs scripts/lib/skills/install-metadata.mjs scripts/tests/skills-component.test.mjs scripts/tests/aios-components.test.mjs
git commit -m "feat(skills): switch installs to copy mode with legacy migration"
```

## Chunk 4: Release, Doctor, and Docs Integration

### Task 7: Integrate canonical source tree with doctor and release packaging

**Files:**
- Modify: `scripts/lib/platform/fs.mjs`
- Modify: `scripts/package-release.sh`
- Modify: `scripts/package-release.ps1`
- Modify: `scripts/release-preflight.sh`
- Modify: `scripts/release-stable.sh`
- Test: `scripts/tests/release-pipeline.test.mjs`
- Test: `scripts/tests/aios-components.test.mjs`

- [ ] **Step 1: Add failing release/doctor integration tests**

Cover:

```js
test('doctor does not flag skill-sources as a rogue skill root', async () => {});
test('package-release includes skill-sources in stable artifacts', async () => {});
test('release-preflight fails when check-skills-sync reports drift', async () => {});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/release-pipeline.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: FAIL because release packaging and root validation are not yet updated.

- [ ] **Step 3: Allow canonical source root in repo validation**

`collectUnexpectedSkillRootFindings()` must treat `skill-sources` as a canonical source root, not a rogue discoverable client root.

- [ ] **Step 4: Update packaging and preflight**

Make release artifacts include:

- `skill-sources`
- generated repo-local skill roots

Run `node scripts/check-skills-sync.mjs` from `scripts/release-preflight.sh` before it prints success.

- [ ] **Step 5: Re-run tests**

Run:

```bash
node --test scripts/tests/release-pipeline.test.mjs scripts/tests/aios-components.test.mjs
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/platform/fs.mjs scripts/package-release.sh scripts/package-release.ps1 scripts/release-preflight.sh scripts/release-stable.sh scripts/tests/release-pipeline.test.mjs scripts/tests/aios-components.test.mjs
git commit -m "feat(release): package canonical skill sources and enforce sync checks"
```

### Task 8: Update docs for the new authoring and install workflow

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`

- [ ] **Step 1: Document the new source of truth**

Add a short “Skills authoring” section:

```text
Edit only skill-sources/.
Run node scripts/sync-skills.mjs after changing skills.
Do not manually edit .codex/skills, .claude/skills, .agents/skills, .gemini/skills, or .opencode/skills.
```

- [ ] **Step 2: Document install behavior**

Document:

- copy-default installs
- explicit `--install-mode link` for local development
- source-repo project installs are blocked in favor of `sync-skills`

- [ ] **Step 3: Document sync verification**

Add:

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

- [ ] **Step 4: Manual docs sanity check**

Run:

```bash
rg -n "skill-sources|sync-skills|install-mode" README.md README-zh.md
```

Expected: new workflow is documented in both files.

- [ ] **Step 5: Commit**

```bash
git add README.md README-zh.md
git commit -m "docs(skills): document canonical source and sync workflow"
```

## Chunk 5: Final Verification and Rollout Proof

### Task 9: Run focused verification

**Files:**
- Verify: `config/skills-sync-manifest.json`
- Verify: `config/skills-catalog.json`
- Verify: `skill-sources/**`
- Verify: `.codex/skills/**`
- Verify: `.claude/skills/**`
- Verify: `.agents/skills/**`
- Verify: `.gemini/skills/**`
- Verify: `.opencode/skills/**`

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
node --test \
  scripts/tests/skills-source-tree.test.mjs \
  scripts/tests/skills-sync.test.mjs \
  scripts/tests/skills-component.test.mjs \
  scripts/tests/aios-components.test.mjs \
  scripts/tests/aios-cli.test.mjs \
  scripts/tests/release-pipeline.test.mjs
```

Expected: PASS

- [ ] **Step 2: Regenerate repo-local skill roots**

Run:

```bash
node scripts/sync-skills.mjs
```

Expected: zero unmanaged blockers except known legacy exceptions.

- [ ] **Step 3: Verify repo-local drift is clean**

Run:

```bash
node scripts/check-skills-sync.mjs
```

Expected: exit `0`

- [ ] **Step 4: Run the existing script suite**

Run:

```bash
npm run test:scripts
```

Expected: PASS

- [ ] **Step 5: Final manual install smoke**

Run:

```bash
TMP_HOME="$(mktemp -d)"
CODEX_HOME="$TMP_HOME/.codex" node scripts/aios.mjs internal skills install --client codex --scope global --skills find-skills
CODEX_HOME="$TMP_HOME/.codex" node scripts/aios.mjs internal skills doctor --client codex --scope global --skills find-skills
CODEX_HOME="$TMP_HOME/.codex" node scripts/aios.mjs internal skills uninstall --client codex --scope global --skills find-skills
```

Expected:

- install succeeds in copy mode
- doctor recognizes the managed metadata file
- uninstall removes only the managed install

- [ ] **Step 6: Commit final verification state**

```bash
git add -A
git commit -m "chore(skills): verify canonical source tree migration"
```

## Acceptance Criteria

- `skill-sources/` is the only maintained skill source tree.
- Repo-local client skill roots are generated by `node scripts/sync-skills.mjs`.
- `node scripts/check-skills-sync.mjs` can detect repo-local drift.
- Installable skills in `config/skills-catalog.json` resolve from `skill-sources/...`.
- Skills install/update default to copy mode and write `.aios-skill-install.json`.
- Legacy symlink installs are recognized and can be migrated safely.
- `project` installs into the source repo are blocked in favor of `sync-skills`.
- Release packaging includes `skill-sources/` and enforces sync cleanliness.

## Execution Notes

- Implement chunks in order. Chunk 3 depends on Chunk 2 metadata helpers.
- Keep `.claude/skills/baoyu-xhs-images` unmanaged in this rollout unless the user explicitly requests migration.
- Do not hand-edit generated roots after Chunk 2 lands; always re-run `node scripts/sync-skills.mjs`.
