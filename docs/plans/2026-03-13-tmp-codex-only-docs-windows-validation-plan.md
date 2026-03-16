# Codex-only Docs + Windows Wrapper Validation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync operator/user docs with the codex-only live subagent runtime policy, validate the Windows PowerShell wrapper behavior, then rerun a live dispatch once upstream is healthy and checkpoint the session.

**Architecture:** Keep runtime behavior unchanged. Update documentation that still claims `aios orchestrate --execute live` supports non-codex clients. Add a Windows validation checklist for wrapped `codex` interactive runs, and capture evidence from a live orchestrate rerun + `learn-eval`.

**Tech Stack:** Markdown docs (`README*`, `docs-site/*`), Node.js scripts (`scripts/aios.mjs`), ContextDB CLI (`mcp-server/src/contextdb`), Windows wrappers (`scripts/*.ps1`).

---

### Task 1: Sync docs to codex-only live runtime

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`
- Modify: `docs-site/architecture.md`
- Modify: `docs-site/getting-started.md`
- Modify: `docs-site/troubleshooting.md`
- Modify: `docs-site/ja/architecture.md`
- Modify: `docs-site/ja/getting-started.md`
- Modify: `docs-site/ja/troubleshooting.md`
- Modify: `docs-site/ko/architecture.md`
- Modify: `docs-site/ko/getting-started.md`
- Modify: `docs-site/ko/troubleshooting.md`
- Modify: `docs-site/zh/architecture.md`
- Modify: `docs-site/zh/getting-started.md`
- Modify: `docs-site/zh/troubleshooting.md`

- [x] Replace any live docs that list `claude-code`/`gemini-cli` as valid `AIOS_SUBAGENT_CLIENT` values.
- [x] Clarify that `AIOS_SUBAGENT_CLIENT=codex-cli` is required for live execution (other values are rejected).
- [x] Run: `rg "AIOS_SUBAGENT_CLIENT=codex-cli\\|claude-code\\|gemini-cli" -n README.md README-zh.md docs-site` (expected: no matches)

### Task 2: Validate Windows wrapped `codex` interactive launch

**Files:**
- Modify: `docs-site/troubleshooting.md`
- Modify: `docs-site/ja/troubleshooting.md`
- Modify: `docs-site/ko/troubleshooting.md`
- Modify: `docs-site/zh/troubleshooting.md`

- [x] Add a short Windows checklist for validating wrapped interactive `codex` runs in real PowerShell (expected: no `stdout is not a terminal` / TTY errors).
- [ ] Run (Windows): `powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1`
- [ ] Run (Windows): `codex --version` then `codex` (interactive) and confirm it attaches to the terminal correctly.

### Task 3: Rerun live dispatch + refresh learn-eval

**Files:**
- Update via CLI: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/*`

- [x] Run: `AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT=codex-cli node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --dispatch local --execute live --format json`
- [x] Run: `node scripts/aios.mjs learn-eval --session codex-cli-20260303T080437-065e16c0 --format json`

### Task 4: Verify and checkpoint

**Files:**
- Modify: `docs/plans/2026-03-13-tmp-codex-only-docs-windows-validation-plan.md`
- Update via CLI: `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/*`
- Update via CLI: `memory/context-db/exports/codex-cli-20260303T080437-065e16c0-context.md`

- [x] Run: `npm run test:scripts`
- [x] Run: `cd mcp-server && npm run typecheck && npm run build`
- [x] Write ContextDB checkpoint with updated next actions + evidence.
- [x] Refresh context export packet for this session (`contextdb context:pack`).
