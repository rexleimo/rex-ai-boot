# Skills Scope Catalog Design

**Date:** 2026-03-16  
**Status:** Draft for user review

## Goal

Introduce a two-scope skills installation model in `aios` so users can explicitly choose whether skills should be installed globally or only into the current project.

This is intended to stop business-specific skills such as Jimeng or Xiaohongshu workflows from leaking into unrelated projects, while keeping general-purpose skills globally reusable.

## Problem

Current `aios` skills install behavior is effectively source-scan driven:

- it scans repo skill roots,
- links discovered skills into client home directories,
- and treats the repo skill set as a single installable bundle.

That behavior creates two issues:

1. Skills with strong project or workflow coupling are exposed globally by default.
2. Users cannot clearly choose between "install for all projects" and "install only for this repo".

## Decision

Adopt **Option B: dual installation model with a global catalog and project scope**.

The product model becomes:

- `global` scope: install reusable, general-purpose skills into client home directories.
- `project` scope: install project-specific or workflow-specific skills into the current repository only.

## Design Summary

### 1. Catalog-Driven Skill Selection

Create a canonical skill catalog:

- `config/skills-catalog.json`

The catalog becomes the source of truth for install eligibility and defaults. Skills are no longer installed by scanning every repo skill directory and linking everything found.

Each catalog entry should include:

- `name`
- `description`
- `source`
- `clients`
- `scopes`
- `defaultInstall`
- `tags`

Example shape:

```json
{
  "version": 1,
  "skills": [
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
  ]
}
```

Rules:

- A skill must be present in the catalog to be installable through `aios`.
- `scopes` defines where the skill is allowed to be installed.
- `defaultInstall` controls TUI default selection per scope.

### 2. Scope Model

Installation must ask for `scope` before skill selection:

- `global`
- `project`

Target roots:

- `global`:
  - `~/.codex/skills`
  - `~/.claude/skills`
  - other supported client home roots as applicable
- `project`:
  - `<repo>/.codex/skills`
  - `<repo>/.claude/skills`
  - other supported repo-local client roots as applicable

Behavioral intent:

- `global` is for portable, reusable methods.
- `project` is for repo-specific knowledge and workflow skills.

### 3. TUI Flow

When `Skills` is enabled in setup or update, the TUI should expose a dedicated skills configuration flow:

1. Choose `scope`
2. Choose `client`
3. Choose skills from the filtered catalog list
4. Review execution summary
5. Run install/update

Filtering rules:

- Only show skills whose `scopes` include the selected scope.
- Only show skills compatible with the selected client.
- Preselect skills using `defaultInstall[scope]`.

Execution summary must show:

- selected scope
- selected client(s)
- target install root(s)
- selected skill names

### 4. Classification Guidance

The default taxonomy should be:

- `global` candidates:
  - generic discovery, verification, versioning, or security skills
- `project` candidates:
  - repo architecture skills
  - long-running harness workflow skills
  - Jimeng, Xiaohongshu, Douyin, and other business-specific operation skills

Initial recommendation:

- keep Jimeng and Xiaohongshu related skills out of global defaults
- mark them as `project` scope only unless there is a strong cross-project need

### 5. Install Logic Changes

Replace current "scan all source roots" install behavior with catalog-driven resolution.

New install behavior:

1. Load catalog
2. Filter entries by `scope`, `client`, and explicit selection
3. Resolve source path for each selected skill
4. Install only selected skills into the correct target root

This means skill installation becomes an explicit product surface instead of a side effect of repo layout.

### 6. Conflict Rules

If the same skill name exists in both global and project scope:

- project scope should take precedence at runtime
- doctor output should surface that the project copy overrides the global copy

Uninstall behavior:

- uninstalling `project` scope removes only repo-local installed skills
- uninstalling `global` scope removes only global installed skills

No uninstall action should remove the other scope implicitly.

### 7. State Tracking

Retain `skills-lock.json`, but narrow its role to installation state rather than catalog definition.

Recommended split:

- `config/skills-catalog.json`
  - maintained by repo authors
  - defines installable skills and policy
- `skills-lock.json`
  - maintained by installer flows
  - records installed scope/client/target state

Suggested future shape:

```json
{
  "version": 2,
  "installed": {
    "find-skills": {
      "source": "repo-catalog",
      "scope": "global",
      "clients": ["codex", "claude"],
      "targetPaths": [
        "~/.codex/skills/find-skills",
        "~/.claude/skills/find-skills"
      ]
    }
  }
}
```

### 8. Migration Strategy

Implement in two phases.

Phase 1:

- add `config/skills-catalog.json`
- add `scope` to CLI and TUI skills flows
- switch skills install/update/uninstall/doctor to catalog-driven filtering
- keep existing skill source directories as-is

Phase 2:

- introduce a canonical skill source tree if needed
- reduce duplicated maintenance across `.codex/skills` and `.claude/skills`
- harden doctor and sync checks around generated artifacts

This sequencing reduces risk and avoids mixing product-model changes with a full source-layout refactor.

## Non-Goals

- Do not redesign superpowers installation in this change.
- Do not immediately migrate all skill sources to a new canonical directory in phase 1.
- Do not change runtime client skill discovery semantics beyond clearer install placement.

## Open Questions

1. Whether `project` scope should support `gemini` and `opencode` on day one, or only `codex` and `claude` first.
2. Whether `source` in the catalog should point to canonical source roots immediately, or continue to reference existing repo-local skill paths for phase 1.
3. Whether some skills should be allowed in both scopes but default to `project`.

## Recommendation

Proceed with phase 1 first.

That delivers the important product correction:

- users choose global vs project explicitly,
- users choose exact skills explicitly,
- and business-specific skills stop being globally installed by default.
