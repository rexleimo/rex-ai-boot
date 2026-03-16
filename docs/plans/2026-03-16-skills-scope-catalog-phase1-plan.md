# Skills Scope Catalog Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a catalog-driven skills lifecycle with explicit `global` vs `project` scope selection so business-specific skills stop being installed globally by default.

**Architecture:** Keep existing repo skill directories as phase-1 sources, add a new catalog and scope-aware resolver, then thread the new selection model through CLI, lifecycle code, and TUI. Avoid canonical source migration in this phase so the product-model correction lands without a larger filesystem refactor.

**Tech Stack:** Node.js ESM, JSON config, existing TUI state/render/session modules, filesystem link helpers, repo docs

---

## File Structure

### New files

- `config/skills-catalog.json`
  - Catalog of installable skills, their source paths, supported clients, allowed scopes, and default-selection policy.
- `docs/plans/2026-03-16-skills-scope-catalog-phase1-plan.md`
  - This implementation plan.

### Modified files

- `scripts/lib/components/skills.mjs`
  - Replace scan-first install logic with catalog-driven filtering and scope-aware target resolution.
- `scripts/lib/platform/paths.mjs`
  - Add or expose scope-aware skill target root helpers if needed.
- `scripts/lib/cli/parse-args.mjs`
  - Parse `--scope` and `--skills`.
- `scripts/lib/cli/help.mjs`
  - Document new skills options.
- `scripts/lib/lifecycle/options.mjs`
  - Normalize and validate new skills scope/selection options.
- `scripts/lib/lifecycle/setup.mjs`
  - Pass scope and selected skill list into skills install/doctor flow.
- `scripts/lib/lifecycle/update.mjs`
  - Pass scope and selected skill list into skills update/doctor flow.
- `scripts/lib/lifecycle/uninstall.mjs`
  - Pass scope and selected skill list into uninstall flow.
- `scripts/lib/tui/state.mjs`
  - Add state for skills scope and selected catalog entries.
- `scripts/lib/tui/render.mjs`
  - Render scope and selected skills in setup/update/uninstall/confirm screens.
- `scripts/lib/tui/session.mjs`
  - No expected logic changes unless navigation needs a helper hook.
- `scripts/tests/aios-tui-state.test.mjs`
  - Extend state reducer coverage for scope and selection behavior.
- `README.md`
  - Document global vs project skills installation behavior.
- `README-zh.md`
  - Document global vs project skills installation behavior in Chinese.

### Optional test/support files

- `scripts/tests/skills-component.test.mjs`
  - Focused unit coverage for catalog filtering and scope-aware target selection if current tests are too coarse.

## Chunk 1: Catalog and Resolver Foundations

### Task 1: Add the skills catalog

**Files:**
- Create: `config/skills-catalog.json`
- Reference: `docs/superpowers/specs/2026-03-16-skills-scope-catalog-design.md`

- [ ] **Step 1: Enumerate the initial phase-1 skill set**

List the skills that should be installable through `aios` in phase 1. Keep the list minimal and explicit. Mark Jimeng/Xiaohongshu/Douyin-related skills as `project` only unless there is a clear reason they belong in `global`.

- [ ] **Step 2: Write the catalog file**

Add entries with:

```json
{
  "name": "find-skills",
  "description": "Discover installable skills",
  "source": ".codex/skills/find-skills",
  "clients": ["codex", "claude"],
  "scopes": ["global", "project"],
  "defaultInstall": {
    "global": true,
    "project": false
  },
  "tags": ["general"]
}
```

Use existing repo paths as `source` during phase 1.

- [ ] **Step 3: Validate JSON formatting**

Run:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('config/skills-catalog.json','utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add config/skills-catalog.json
git commit -m "feat(skills): add scope-aware skills catalog"
```

### Task 2: Implement catalog loading and filtering

**Files:**
- Modify: `scripts/lib/components/skills.mjs`
- Modify: `scripts/lib/platform/paths.mjs`
- Test: `scripts/tests/skills-component.test.mjs`

- [ ] **Step 1: Write the failing resolver tests**

Add tests that cover:

```js
it('returns only global-eligible skills for global scope', async () => {
  // expect jimeng/xhs project-only skills to be absent
});

it('returns only selected skill names when an explicit list is provided', async () => {
  // expect install candidate set to match exact selection
});

it('resolves project scope targets under the repo root', async () => {
  // expect <repo>/.codex/skills/<name> instead of ~/.codex/skills/<name>
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs
```

Expected: FAIL because catalog resolver/scope support does not exist yet.

- [ ] **Step 3: Add catalog loader and filtering helpers**

Implement focused helpers in `scripts/lib/components/skills.mjs` for:

- loading `config/skills-catalog.json`
- filtering by client
- filtering by scope
- filtering by explicit selected skill names
- resolving target root based on scope and client

Keep `collectSkillEntries()` out of the primary install path for managed catalog installs.

- [ ] **Step 4: Update install/update/uninstall/doctor internals**

Change the exported skills lifecycle functions to accept:

```js
{
  rootDir,
  client,
  scope,
  selectedSkills,
  force,
  io
}
```

Behavior:

- install/update: only selected catalog entries
- uninstall: only selected catalog entries if provided, otherwise all catalog entries for the chosen scope
- doctor: report only relevant catalog entries for the chosen scope

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/components/skills.mjs scripts/lib/platform/paths.mjs scripts/tests/skills-component.test.mjs
git commit -m "feat(skills): add catalog-driven scope-aware resolver"
```

## Chunk 2: CLI and Lifecycle Wiring

### Task 3: Add CLI options for scope and skill selection

**Files:**
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/lib/lifecycle/options.mjs`

- [ ] **Step 1: Write failing argument parsing tests or extend existing coverage**

Add coverage for:

```js
--scope global
--scope project
--skills find-skills,verification-loop
```

Reject invalid scope values and normalize comma-separated skill names into an array.

- [ ] **Step 2: Run tests to verify failure**

Run the narrow parser test target used in this repo, or add one if missing.

Expected: FAIL before parser support is added.

- [ ] **Step 3: Implement parser and normalizer changes**

Support:

```bash
node scripts/aios.mjs setup --components skills --client codex --scope global --skills find-skills,verification-loop
node scripts/aios.mjs update --components skills --client codex --scope project --skills xhs-ops-methods
node scripts/aios.mjs uninstall --components skills --client codex --scope global
node scripts/aios.mjs internal skills doctor --client codex --scope project
```

Validation rules:

- `scope` must be one of `global|project`
- `skills` is optional
- skill names remain raw strings here; catalog validation happens in the skills component

- [ ] **Step 4: Update help text**

Document the new flags in root help and internal skills help.

- [ ] **Step 5: Run parser/help tests**

Run the relevant node test targets.

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/cli/parse-args.mjs scripts/lib/cli/help.mjs scripts/lib/lifecycle/options.mjs
git commit -m "feat(cli): add skills scope and selection flags"
```

### Task 4: Thread scope and selection through lifecycle commands

**Files:**
- Modify: `scripts/lib/lifecycle/setup.mjs`
- Modify: `scripts/lib/lifecycle/update.mjs`
- Modify: `scripts/lib/lifecycle/uninstall.mjs`

- [ ] **Step 1: Add failing lifecycle tests if coverage exists**

If lifecycle tests exist, add expectations that skills actions receive `scope` and `selectedSkills`. If not, add a focused test file instead of broad integration tests.

- [ ] **Step 2: Run tests to verify failure**

Run the relevant test target.

Expected: FAIL before lifecycle wiring is added.

- [ ] **Step 3: Update lifecycle calls**

Ensure setup/update/uninstall pass the new options into the skills component, and that doctor in setup/update uses the same scope.

- [ ] **Step 4: Run lifecycle tests**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/lifecycle/setup.mjs scripts/lib/lifecycle/update.mjs scripts/lib/lifecycle/uninstall.mjs
git commit -m "feat(lifecycle): pass skills scope through setup update uninstall"
```

## Chunk 3: TUI Skills Selection

### Task 5: Extend TUI state for scope and selected skills

**Files:**
- Modify: `scripts/lib/tui/state.mjs`
- Test: `scripts/tests/aios-tui-state.test.mjs`

- [ ] **Step 1: Write failing reducer tests**

Cover:

- default scope value for setup/update/uninstall
- switching scope from `global` to `project`
- storing selected skills
- preserving selections across navigation where appropriate

- [ ] **Step 2: Run TUI state tests to verify failure**

Run:

```bash
node --test scripts/tests/aios-tui-state.test.mjs
```

Expected: FAIL before new state fields/actions exist.

- [ ] **Step 3: Implement state changes**

Add:

- `scope`
- `selectedSkills`
- reducer actions for toggling or cycling scope
- reducer actions for toggling skill selection

Keep the interaction model simple. Phase 1 can represent selected skill names as an array and keep the skill list flat.

- [ ] **Step 4: Run TUI state tests**

Run:

```bash
node --test scripts/tests/aios-tui-state.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/tui/state.mjs scripts/tests/aios-tui-state.test.mjs
git commit -m "feat(tui): track skills scope and selected skills"
```

### Task 6: Render and confirm the skills selection flow

**Files:**
- Modify: `scripts/lib/tui/render.mjs`
- Modify: `scripts/lib/tui/session.mjs`

- [ ] **Step 1: Add a minimal render-first test or snapshot check if practical**

If there is no render test harness, document the render expectations and verify manually in the TUI smoke step later.

- [ ] **Step 2: Implement render updates**

Show in setup/update/uninstall:

- `Skills scope: global|project`
- `Selected skills: <count>` or a short joined label for small selections

In confirm screen, show:

- selected scope
- selected skill names
- target client

Phase 1 constraint:

- avoid a complex nested picker if it would balloon the reducer
- use a simple dedicated screen or inline cycle/list behavior consistent with the current TUI

- [ ] **Step 3: Adjust session navigation only if necessary**

Prefer keeping the current key model. Do not introduce new dependencies or a full-screen widget library.

- [ ] **Step 4: Manual TUI verification**

Run:

```bash
node scripts/aios.mjs
```

Verify:

- scope is editable
- skill selection is visible
- confirm screen reflects the selection

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/tui/render.mjs scripts/lib/tui/session.mjs
git commit -m "feat(tui): expose skills scope and selection flow"
```

## Chunk 4: Docs and Verification

### Task 7: Update user documentation

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`

- [ ] **Step 1: Document the new model**

Explain:

- the difference between global and project skills
- that business-specific skills should usually be project-scoped
- the new CLI flags

Add at least one example for each scope:

```bash
node scripts/aios.mjs setup --components skills --client codex --scope global --skills find-skills,verification-loop
node scripts/aios.mjs setup --components skills --client codex --scope project --skills xhs-ops-methods,aios-jimeng-image-ops
```

- [ ] **Step 2: Review docs for consistency**

Ensure README and README-zh describe the same behavior.

- [ ] **Step 3: Commit**

```bash
git add README.md README-zh.md
git commit -m "docs(skills): explain global vs project scope installation"
```

### Task 8: Run verification before completion

**Files:**
- Verify: `config/skills-catalog.json`
- Verify: `scripts/lib/components/skills.mjs`
- Verify: `scripts/lib/cli/parse-args.mjs`
- Verify: `scripts/lib/lifecycle/*.mjs`
- Verify: `scripts/lib/tui/*.mjs`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node --test scripts/tests/skills-component.test.mjs
node --test scripts/tests/aios-tui-state.test.mjs
```

Expected: PASS

- [ ] **Step 2: Run project verification**

Run:

```bash
cd mcp-server
npm run typecheck
npm run build
```

Expected: PASS

- [ ] **Step 3: Run manual CLI/TUI smoke**

Examples:

```bash
node scripts/aios.mjs setup --components skills --client codex --scope global --skills find-skills --skip-doctor
node scripts/aios.mjs setup --components skills --client codex --scope project --skills xhs-ops-methods --skip-doctor
node scripts/aios.mjs internal skills doctor --client codex --scope global
node scripts/aios.mjs
```

Verify:

- global install targets home directories
- project install targets repo-local directories
- project-only skills are excluded from global-only selection sets
- TUI summary matches the actual install behavior

- [ ] **Step 4: Record residual risks**

Call out any phase-1 limits, especially:

- duplicate source maintenance still exists
- gemini/opencode project-scope behavior may remain limited if intentionally deferred
- runtime precedence reporting depends on what each client actually resolves first

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(skills): add scope-aware catalog installation flow"
```

## Notes for the Implementer

- Do not mix phase-2 source unification into this plan.
- Prefer small helpers over expanding `scripts/lib/components/skills.mjs` into another monolith.
- If `project` scope for `gemini` or `opencode` is unclear, gate it explicitly and document the limitation instead of guessing.
- Preserve non-destructive defaults. Existing unmanaged skill directories must not be overwritten unless current force behavior already allows it.
