# Canonical Skill Source Tree Design

## Summary

Introduce a repository-level `skill-sources/` directory as the only canonical source of truth for project skills.

After this change:

- `skill-sources/<skill>/` holds the maintained source files,
- `config/skills-catalog.json` points only to `skill-sources/...`,
- `.codex/skills`, `.claude/skills`, and `.agents/skills` become generated compatibility targets,
- cross-project and cross-machine installation copies skill content from `skill-sources/` by default instead of linking to repo-local absolute paths.

This corrects the current ambiguity where `.codex/skills` looks like both editable source and install output.

## Problem

The current repository structure mixes two different responsibilities into the same directories:

- source authoring,
- client discovery / install targets.

Today the install flow resolves skill sources from paths such as `.codex/skills/<skill>`. That creates several problems:

1. The source of truth is unclear.
2. Editing `.codex/skills` risks drifting from `.claude/skills`.
3. Cross-machine portability is weak because the current install behavior is link-oriented and depends on local absolute paths.
4. It is hard to reason about which directories are safe to edit manually and which should be generated.

The repository already moved to a catalog-driven selection model, but the source layout still reflects an earlier phase where client-facing directories doubled as authoring locations.

## Goals

1. Make one directory tree the explicit canonical source of repository skills.
2. Separate maintained source files from generated client-facing directories.
3. Make skill installation portable across projects and machines by default.
4. Keep existing client discovery semantics intact for Codex, Claude, and compatible consumers.
5. Add a predictable sync/check workflow so generated skill targets cannot silently drift.

## Non-Goals

1. Redesign superpowers installation.
2. Change the user-facing semantics of `global` vs `project` scope.
3. Remove repo-local client skill directories entirely.
4. Introduce packaging/distribution through npm, registries, or release bundles in this phase.
5. Force every client-specific variant into one shared markdown file when client-specific wording is genuinely needed.

## Current State

### Current layout

- `config/skills-catalog.json` defines installable skills.
- Most catalog `source` entries point at `.codex/skills/<skill>`.
- `.claude/skills/<skill>` duplicates many of the same skills.
- `.agents/skills/` exists as an additional compatibility directory for supported clients.
- install/update/uninstall/doctor operate from the catalog and currently use link-based install behavior.

### Current behavior mismatch

The repo now has a product model that distinguishes:

- install policy (`config/skills-catalog.json`),
- target scope (`global` / `project`),
- target client (`codex` / `claude` / others).

But it does not yet have a clean source model. As a result, the authoring story and the distribution story remain coupled.

## Options Considered

### Option 1: Keep `.codex/skills` as the source tree

Pros:

- minimal code churn,
- no migration needed.

Cons:

- source vs generated boundary stays ambiguous,
- `.claude/skills` duplication remains a maintenance trap,
- copy-based installation still has no clean canonical input tree.

### Option 2: Add `skill-sources/` as the canonical source tree

Pros:

- clear ownership model,
- installers and sync tools can read from one stable source,
- client-facing directories can become generated artifacts,
- cross-project and cross-machine copy flows become straightforward.

Cons:

- requires a migration,
- requires a sync/generation step for repo-local client directories.

### Option 3: Skip source-tree cleanup and move directly to packaged distribution

Pros:

- best long-term portability story.

Cons:

- too much change at once,
- does not solve the immediate authoring ambiguity cleanly,
- raises release/distribution concerns before source layout is stabilized.

## Recommended Approach

Adopt Option 2.

Introduce `skill-sources/` as the only maintained source tree. Treat `.codex/skills`, `.claude/skills`, and `.agents/skills` as generated compatibility targets. Change installer semantics so default installation uses recursive copy from `skill-sources/`, while link-based install is preserved only as an explicit development option.

## Canonical Layout

### Source tree

The repository should add:

```text
skill-sources/
  find-skills/
    SKILL.md
    references/
    assets/
    scripts/
  xhs-ops-methods/
    SKILL.md
  skill-creator/
    clients/
      codex/SKILL.md
      claude/SKILL.md
```

Rules:

- `skill-sources/<skill>/SKILL.md` is the default source for a skill.
- Optional subdirectories such as `references/`, `assets/`, and `scripts/` live under the same skill directory.
- If a skill needs client-specific content, it may provide `clients/<client>/...` overrides.
- Authoring happens only under `skill-sources/`.

### Generated compatibility targets

These directories remain in the repository because clients discover them there:

- `.codex/skills`
- `.claude/skills`
- `.agents/skills`

But after migration they are generated outputs, not hand-edited source locations.

## Source Resolution Rules

For each catalog entry:

1. Resolve the canonical base path from `config/skills-catalog.json`.
2. If a client-specific override exists for the requested client, render/copy from that override.
3. Otherwise use the shared `skill-sources/<skill>/` content.

Recommended precedence:

1. `skill-sources/<skill>/clients/<client>/`
2. `skill-sources/<skill>/`

The first pass can keep this simple:

- shared skills use the base directory,
- only known client-specific skills opt into per-client overrides.

## Sync Model

Add an explicit repository sync tool, for example:

- `scripts/sync-skills.mjs`

Its job is to fan out from `skill-sources/` into repo-local compatibility targets.

### Inputs

- `skill-sources/`
- `config/skills-catalog.json`
- optional client override directories

### Outputs

- `.codex/skills/...`
- `.claude/skills/...`
- `.agents/skills/...`

### Generated artifact rules

Generated files and directories should use a managed marker strategy similar to the existing orchestrator-agent sync flow:

- managed outputs can be updated in place,
- managed outputs that are no longer expected can be removed,
- unmanaged files must never be overwritten silently,
- doctor/sync output should warn when unmanaged files block generation.

This allows safe regeneration without clobbering manual local files.

## Installation Model

### Repository-local compatibility sync

Inside this repo, compatibility targets should be produced by the sync tool.

That means:

- developers edit `skill-sources/`,
- they run `sync-skills`,
- generated client-facing directories update accordingly.

### Cross-project and cross-machine installs

`installContextDbSkills` should change its default install mode from link to copy.

New default behavior:

1. Load catalog entries.
2. Resolve canonical source from `skill-sources/...`.
3. Recursively copy the skill directory into the selected target root.

Example targets:

- global:
  - `~/.codex/skills/<skill>`
  - `~/.claude/skills/<skill>`
- project:
  - `<repo>/.codex/skills/<skill>`
  - `<repo>/.claude/skills/<skill>`

### Optional development mode

Link-based install may still be useful for local authoring, but it should become explicit, for example:

- `--install-mode link`

That keeps development convenience without making portability-dependent behavior the default.

## Catalog Changes

`config/skills-catalog.json` should continue to define install policy, but all `source` paths should point to `skill-sources/...`.

After migration the role split becomes:

- `skill-sources/`: canonical source tree
- `config/skills-catalog.json`: installable skill manifest and policy
- `.codex/skills`, `.claude/skills`, `.agents/skills`: generated compatibility outputs

This is the boundary the current repository is missing.

## Migration Plan

### Phase 1: Add canonical source tree

1. Create `skill-sources/`.
2. Copy existing maintained skills from `.codex/skills/...` into `skill-sources/...`.
3. Identify client-specific variants that should remain divergent.

### Phase 2: Add sync/generation

1. Implement `scripts/sync-skills.mjs`.
2. Generate `.codex/skills`, `.claude/skills`, and `.agents/skills` from `skill-sources/`.
3. Add managed markers and non-destructive update rules.

### Phase 3: Repoint install catalog

1. Update `config/skills-catalog.json` so `source` points to `skill-sources/...`.
2. Update tests to use canonical source-tree fixtures where appropriate.

### Phase 4: Switch installer default to copy

1. Add recursive copy behavior for skill installs.
2. Preserve link mode only behind an explicit option.
3. Ensure uninstall and doctor still work against managed installs.

### Phase 5: Add drift checks and docs

1. Add `check-skills-sync` verification.
2. Document that `skill-sources/` is the only manual editing surface.
3. Document that client-facing skill roots are generated outputs.

## Error Handling and Safety Rules

### Unmanaged files in generated targets

If sync sees an unmanaged file where it wants to generate output:

- do not overwrite it,
- emit a warning,
- continue with other files,
- keep doctor output actionable.

### Existing installs

If install targets already exist:

- copy mode should skip by default unless forced,
- force mode may replace only the selected managed target,
- doctor should report mismatches between expected source and installed target state.

### Client-specific divergence

If a skill legitimately needs client-specific wording:

- keep the override local to that skill,
- do not duplicate the whole tree unnecessarily,
- default to shared source unless divergence is justified.

## Testing and Verification

Minimum verification should cover:

1. Sync from `skill-sources/` creates expected repo-local compatibility outputs.
2. Sync updates managed outputs and skips unmanaged outputs.
3. Catalog entries resolve canonical source paths under `skill-sources/`.
4. Default install mode copies skill directories instead of linking them.
5. Explicit link mode still works for local development.
6. Doctor reports drift, unmanaged blockers, and generated-target mismatches clearly.

Recommended automated coverage:

- unit tests for source resolution precedence,
- unit tests for managed-output sync behavior,
- unit tests for copy vs link install modes,
- regression tests for `global` and `project` scope behavior.

## Operational Guidance

After this change, the day-to-day rule should be simple:

- edit `skill-sources/`,
- sync generated targets,
- verify no drift,
- then install or publish.

Repository docs should explicitly state:

- do not manually edit `.codex/skills`,
- do not manually edit `.claude/skills`,
- do not manually edit `.agents/skills`,
- these are generated compatibility directories.

## Open Questions

1. Whether `.gemini/skills` or `.opencode/skills` should join the repo-local generated target set now or in a later phase.
2. Whether copy installs should carry a small metadata marker file to improve doctor/uninstall precision.
3. Whether `cap` should hard-fail when `skill-sources/` and generated outputs are out of sync, or warn first during rollout.

## Recommendation

Proceed with the canonical-source migration in the following order:

1. `skill-sources/`
2. repo-local sync generation
3. catalog repoint
4. copy-default installer
5. drift checks and docs

That sequence fixes the core structural problem first: one clear source of truth for skills.
