# Multi-Client Skills Sync (Codex/Claude/Gemini/OpenCode) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single skills lifecycle that can install/update/uninstall/doctor skills across Codex, Claude, Gemini CLI, and OpenCode with one command and optional client selection.

**Architecture:** Keep filesystem skills as source-of-truth, add a client adapter matrix, and generate/install per-client artifacts by target format. Reuse existing shell/PowerShell lifecycle model (`install/update/uninstall/doctor`) and integrate it into `setup-all/update-all/uninstall-all`.

**Tech Stack:** Bash, PowerShell, JSON manifest, Markdown skills, symlink/junction install strategy, MkDocs docs.

---

### Task 1 (P0): Define client adapter matrix and manifest

**Files:**
- Create: `config/skills-clients.json`
- Modify: `scripts/install-contextdb-skills.sh`
- Modify: `scripts/install-contextdb-skills.ps1`
- Modify: `scripts/update-contextdb-skills.sh`
- Modify: `scripts/update-contextdb-skills.ps1`
- Modify: `scripts/uninstall-contextdb-skills.sh`
- Modify: `scripts/uninstall-contextdb-skills.ps1`
- Modify: `scripts/doctor-contextdb-skills.sh`
- Modify: `scripts/doctor-contextdb-skills.ps1`

**Step 1: Add manifest schema for clients**
- Define clients: `codex`, `claude`, `gemini`, `opencode`.
- Define for each client: `source_dir`, `global_dir`, `install_mode` (`symlink_dir` / `render_file`), and optional `format`.

**Step 2: Expand CLI flags**
- Change `--client <all|codex|claude>` to `--client <all|codex|claude|gemini|opencode>`.

**Step 3: Implement adapter dispatch**
- Preserve existing codex/claude behavior.
- Add gemini/opencode branches from manifest-driven install targets.

**Step 4: Add validation tests (script-level smoke)**
- Use temporary HOME and validate install/update/uninstall/doctor each returns success.

**Step 5: Commit**
- `feat(skills): add client adapter matrix for codex claude gemini opencode`

### Task 2 (P0): Add Gemini skills target (native extension format)

**Files:**
- Create: `.gemini/extensions/rex-ai-boot-skills/gemini-extension.json`
- Create: `.gemini/extensions/rex-ai-boot-skills/SKILL.md`
- Create: `scripts/skills/generate-gemini-extension.sh`
- Create: `scripts/skills/generate-gemini-extension.ps1`
- Modify: `scripts/install-contextdb-skills.sh`
- Modify: `scripts/install-contextdb-skills.ps1`

**Step 1: Build minimal extension template**
- Include `gemini-extension.json` identifier and generated `SKILL.md` index.

**Step 2: Generate SKILL index from repo skill set**
- Aggregate selected skills into extension `SKILL.md` with links and short descriptions.

**Step 3: Install to Gemini global directory**
- Target default global dirs: `~/.gemini/extensions` and fallback `~/.config/google-gemini/extensions`.

**Step 4: Verification**
- `doctor-contextdb-skills` should report gemini adapter status and target path.

**Step 5: Commit**
- `feat(gemini): add extension-based skills sync`

### Task 3 (P0): Add OpenCode skills target (agent markdown format)

**Files:**
- Create: `.opencode/agent/README.md`
- Create: `scripts/skills/render-opencode-agent.sh`
- Create: `scripts/skills/render-opencode-agent.ps1`
- Modify: `scripts/install-contextdb-skills.sh`
- Modify: `scripts/install-contextdb-skills.ps1`

**Step 1: Define rendering rule**
- Convert each `SKILL.md` to `opencode` agent markdown (`<skill>.md`) with preserved instruction body.

**Step 2: Install to OpenCode global directory**
- Target `~/.config/opencode/agent`.

**Step 3: Doctor support**
- Validate rendered files exist and report stale/missing cases.

**Step 4: Backward compatibility**
- Keep codex/claude install unaffected.

**Step 5: Commit**
- `feat(opencode): add agent-format skills sync`

### Task 4 (P1): One-command lifecycle integration

**Files:**
- Modify: `scripts/setup-all.sh`
- Modify: `scripts/setup-all.ps1`
- Modify: `scripts/update-all.sh`
- Modify: `scripts/update-all.ps1`
- Modify: `scripts/uninstall-all.sh`
- Modify: `scripts/uninstall-all.ps1`

**Step 1: Extend `--client` values**
- Allow `all|codex|claude|gemini|opencode`.

**Step 2: Ensure default behavior remains safe**
- Default should still be non-destructive and skip existing same-name targets unless forced.

**Step 3: Add doctor chaining by selected clients**
- Report per-client summary in one output.

**Step 4: Verification**
- Run setup/update/uninstall with component subsets and client subsets.

**Step 5: Commit**
- `feat(onboarding): integrate gemini/opencode skills into setup-all lifecycle`

### Task 5 (P1): Release and newcomer UX hardening

**Files:**
- Modify: `scripts/release-version.sh`
- Create: `scripts/check-skills-sync.sh`
- Create: `scripts/check-skills-sync.ps1`
- Modify: `README.md`
- Modify: `README-zh.md`
- Modify: `docs-site/getting-started.md`
- Modify: `docs-site/zh/getting-started.md`
- Modify: `docs-site/ja/getting-started.md`
- Modify: `docs-site/ko/getting-started.md`
- Modify: `docs-site/troubleshooting.md`
- Modify: `docs-site/zh/troubleshooting.md`
- Modify: `docs-site/ja/troubleshooting.md`
- Modify: `docs-site/ko/troubleshooting.md`

**Step 1: Add pre-release consistency check**
- Verify skill source set and generated client artifacts are in sync.

**Step 2: Document version upgrade workflow**
- New one-liner for users: `git pull + update-all`.

**Step 3: Add “new skill” newcomer workflow**
- Show required files and one command to fan out to clients.

**Step 4: Verification**
- Build docs site and run script syntax checks.

**Step 5: Commit**
- `docs(onboarding): add multi-client skills lifecycle and upgrade guide`

### Task 6 (P2): Skill source unification and dedupe

**Files:**
- Create: `skills/source/<skill>/SKILL.md` (new canonical tree)
- Modify: `.codex/skills/*` (generated links/files)
- Modify: `.claude/skills/*` (generated links/files)
- Modify: generation scripts from Tasks 2/3

**Step 1: Introduce canonical skills source tree**
- Stop editing `.codex/skills` and `.claude/skills` manually.

**Step 2: Generate all client-specific artifacts from canonical source**
- Avoid drift and duplicate maintenance.

**Step 3: Add drift-check command to CI**
- Fail if generated outputs are stale.

**Step 4: Verification**
- Run full install/update/uninstall/doctor and docs build after migration.

**Step 5: Commit**
- `refactor(skills): unify canonical source and generated client targets`

## Acceptance Criteria

- `setup-all/update-all/uninstall-all` can manage skills for codex/claude/gemini/opencode via one `--client` selector.
- New user can complete install with one command and verify with one doctor command.
- Upgrade path is one command and documented clearly.
- Existing codex/claude users are not broken.

## References (official docs to follow during implementation)

- Gemini CLI extensions and skills (`gemini-extension.json`, `SKILL.md`, global/local extension dirs):
  https://cloud.google.com/gemini/docs/codeassist/gemini-cli-extensions
- OpenCode skills and supported paths (`.opencode/agent/*.md`, `~/.config/opencode/agent/*.md`, import compatibility):
  https://opencode.ai/docs/agent/skills
