# Cross-CLI Capability Pack (Search-First + Security Scan + Local Verify)

**Goal:** Ship a small, high-leverage capability pack that improves day-to-day reliability and safety across `codex`, `claude`, `gemini`, and `opencode` by adding:

- A consistent "local CI" verifier command (typecheck/build + doctors)
- A lightweight agent-config security scan (secrets + risky config heuristics)
- A research-before-coding skill (`search-first`) and a verification discipline skill
- Global convenience commands so any repo can run the checks (via existing `ROOTPATH` wrappers)

**Non-Goals (for this iteration):**
- Full AgentShield parity (deep MCP risk profiling, advanced permission modeling)
- Full write-time lint/format enforcement (Plankton-style hooks) shipped by default
- A full docs translation governance overhaul (can be a follow-up)

---

## Task 1 (P0): Add a single local verifier entrypoint

**Deliverable:** `scripts/verify-aios.(sh|ps1)` that runs:
- `mcp-server` typecheck + build
- `doctor-contextdb-shell`
- `doctor-contextdb-skills`
- optional `doctor-browser-mcp` (best-effort)
- optional `doctor-security-config` (Task 2)

**Acceptance:**
- Returns non-zero on hard failures (typecheck/build/script error).
- Supports `--strict` to fail on doctor warnings.

**Files:**
- Create: `scripts/verify-aios.sh`
- Create: `scripts/verify-aios.ps1`
- Modify: `scripts/setup-all.sh` (print hint after install)
- Modify: `scripts/setup-all.ps1` (print hint after install)

---

## Task 2 (P0): Add lightweight security scan for agent configs

**Deliverable:** `scripts/doctor-security-config.mjs` + thin wrappers that scan:
- repo-local config folders (`.claude/`, `.codex/`, `.gemini/`, `.opencode/`) when present
- known global config locations via env (`CODEX_HOME`, `CLAUDE_HOME`, `GEMINI_HOME`, `OPENCODE_HOME`) but only for small allowlisted config files

**Checks (initial heuristics):**
- Obvious secret patterns in config-like files (token prefixes, `BEGIN PRIVATE KEY`, `Authorization: Bearer`, etc.)
- Suspiciously broad allowlists (when detectable in JSON settings) with actionable guidance
- Unsafe hook commands patterns (shell interpolation + network egress) reported as warnings, not auto-blocks

**Acceptance:**
- Never prints detected secret values (redact in output).
- Exit codes: `0` clean, `1` findings in `--strict`, `2` hard errors (unreadable / invalid JSON where required).

**Files:**
- Create: `scripts/doctor-security-config.mjs`
- Create: `scripts/doctor-security-config.sh`
- Create: `scripts/doctor-security-config.ps1`

---

## Task 3 (P1): Ship cross-CLI skills that invoke these capabilities

**Deliverables (minimum set):**
- `search-first` (research-before-implementation workflow)
- `security-scan` (run the security doctor + review checklist)
- `verification-loop` (run `verify-aios` + evidence discipline)

**Acceptance:**
- Same skill names and near-identical content under `.codex/skills` and `.claude/skills`.
- Gemini/OpenCode inherit via installer roots (no special casing).

**Files:**
- Create: `.codex/skills/search-first/SKILL.md`
- Create: `.claude/skills/search-first/SKILL.md`
- Create: `.codex/skills/security-scan/SKILL.md`
- Create: `.claude/skills/security-scan/SKILL.md`
- Create: `.codex/skills/verification-loop/SKILL.md`
- Create: `.claude/skills/verification-loop/SKILL.md`

---

## Task 4 (P1): Global convenience commands (shell + PowerShell)

**Deliverable:** Add `aios` helper commands to wrappers so users can run checks from any repo.

**Commands:**
- `aios doctor` -> runs `scripts/verify-aios.*` (best-effort, prints next steps)
- `aios update` -> runs `scripts/update-all.*` for shell+skills

**Files:**
- Modify: `scripts/contextdb-shell.zsh`
- Modify: `scripts/contextdb-shell.ps1`

---

## Task 5 (P0): Version bump + global update

**Deliverables:**
- Version bump via `scripts/release-version.sh` (expected: `minor`)
- Run `scripts/update-all.(sh|ps1)` to refresh global wrappers + skills

**Evidence to capture:**
- `VERSION` updated
- `CHANGELOG.md` has a new entry
- `scripts/verify-aios.sh` passes locally
- `doctor-contextdb-skills` shows the new skills are linked in global dirs

