# rex-ai-boot (AIOS)

This repository provides a local-first agent workflow for `Codex CLI`, `Claude Code`, and `Gemini CLI`.
It does not replace those clients. Instead, it adds two shared capabilities:

1. Unified browser automation via Playwright MCP (`browser_*` tools)
2. Cross-CLI filesystem Context DB for resumable task memory

## Why does `codex` load ContextDB automatically?

The mechanism is **transparent zsh wrapping**:

- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) defines shell functions for `codex()`, `claude()`, and `gemini()`
- In any git project, those functions call [`scripts/ctx-agent.sh`](scripts/ctx-agent.sh) (from `ROOTPATH`) and use the current git root as `--workspace`
- Outside git projects, or for management subcommands (for example `codex mcp`, `gemini hooks`), commands pass through unchanged

So you keep using the same command names and normal interactive flow.

## Architecture

```text
User -> codex/claude/gemini
     -> (zsh wrapper: contextdb-shell.zsh)
     -> ctx-agent.sh
        -> contextdb CLI (init/session/event/checkpoint/pack)
        -> start native codex/claude/gemini (with context packet)
     -> mcp-server/browser_* (optional browser automation)
```

## Repository Layout

- `mcp-server/`: Playwright MCP service and `contextdb` CLI implementation
- `scripts/ctx-agent.sh`: Unified runner that integrates ContextDB
- `scripts/contextdb-shell.zsh`: Transparent wrappers for `codex/claude/gemini`
- `memory/context-db/`: Runtime session artifacts for this repo (ignored by git)
- `config/browser-profiles.json`: Browser profile/CDP config

## Quick Start

### 1) One-command Browser MCP setup (for new developers)

macOS / Linux:

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

This installs browser runtime, builds `mcp-server`, and prints MCP config JSON to copy into your CLI client.

### 2) Build MCP server and ContextDB CLI (manual path)

```bash
cd mcp-server
npm install
npx playwright install chromium
npm run build
```

### 3) Install transparent shell integration (one-time)

Use installer scripts (recommended):

macOS / Linux:

```bash
scripts/install-contextdb-shell.sh --mode opt-in
scripts/doctor-contextdb-shell.sh
source ~/.zshrc
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1 -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-shell.ps1
. $PROFILE
```

Lifecycle commands:

```bash
scripts/update-contextdb-shell.sh --mode opt-in
scripts/uninstall-contextdb-shell.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
```

Manual block editing is still supported, but no longer the primary onboarding path.

### 3.1 Optional: install project skills globally

This is separate from wrapper install. Use it when you want this repo's skills available in other projects too.

macOS / Linux:

```bash
scripts/install-contextdb-skills.sh --client all
scripts/doctor-contextdb-skills.sh --client all
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-skills.ps1 -Client all
powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-skills.ps1 -Client all
```

Skill lifecycle commands:

```bash
scripts/update-contextdb-skills.sh --client all
scripts/uninstall-contextdb-skills.sh --client all
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-skills.ps1 -Client all
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-skills.ps1 -Client all
```

### 3.2 Scope control (avoid cross-project reuse)

By default, wrappers run only in the `ROOTPATH` repository (`CTXDB_WRAP_MODE=repo-only`).
If you want a different scope, set one of these in `~/.zshrc`:

```zsh
# only enable in rex-ai-boot itself
export CTXDB_WRAP_MODE=repo-only

# or: only enable in repos that contain .contextdb-enable
export CTXDB_WRAP_MODE=opt-in
```

For `opt-in`, create marker file in a project root:

```bash
touch .contextdb-enable
```

### 3.3 Skill scope (important)

ContextDB wrapping and CLI skill loading are different layers:

- Wrapping scope is controlled by `CTXDB_WRAP_MODE` above.
- Use skill lifecycle scripts above for install/update/uninstall/doctor.
- Skill installers skip existing same-name targets by default; use `--force` / `-Force` only when you intentionally replace them.
- Skills installed in `~/.codex/skills` or `~/.claude/skills` are global.
- Project-only skills should live in `<repo>/.codex/skills` or `<repo>/.claude/skills`.
- Keep `CODEX_HOME` as an absolute home path (recommended: `~/.codex`). Do not set `CODEX_HOME=.codex`.

If you don't want cross-project skill reuse, keep custom skills in repo-local folders instead of global home directories.

### 4) Use original commands directly

```bash
codex
claude
gemini
```

PowerShell wrappers source `scripts/contextdb-shell.ps1` and use cross-platform runner `scripts/ctx-agent.mjs`.

After setup, the same behavior works in other git repositories too (they write to each repo's own `memory/context-db/`).

## Two Runtime Modes

### A) Interactive mode (`codex` / `claude` / `gemini`)

- Automatically performs: `init`, `session:latest/new`, `context:pack`
- Scope: current git project root (`--workspace <git-root>`)
- Best for normal interactive work with startup context resume
- Limitation: does not auto-write checkpoint after every turn

### B) One-shot mode (full automation recommended)

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "Continue from previous task and execute next step"
```

In one-shot mode, all 5 steps run automatically:
`init -> session:new/latest -> event:add -> checkpoint -> context:pack`

## ContextDB Layout (L0/L1/L2)

```text
memory/context-db/
  manifest.json
  index/context.db
  index/sessions.jsonl
  index/events.jsonl
  index/checkpoints.jsonl
  sessions/<session_id>/
    meta.json
    l0-summary.md
    l1-checkpoints.jsonl
    l2-events.jsonl
    state.json
  exports/<session_id>-context.md
```

In global mode, this structure is created per project under that project's git root.

## Common Commands

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent claude-code --project rex-ai-boot --goal "stabilize flow"
npm run contextdb -- event:add --session <id> --role user --text "need retry plan"
npm run contextdb -- checkpoint --session <id> --summary "blocked by auth" --status blocked --next "wait-login|resume"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
npm run contextdb -- search --query "auth race" --project rex-ai-boot --kinds response --refs auth.ts
```

Optional semantic rerank (P2):

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project rex-ai-boot --semantic
```

Unknown or unavailable providers fall back to lexical search automatically.

## Versioning and Releases

This repository uses Semantic Versioning via root files:

- `VERSION`: current version
- `CHANGELOG.md`: release history

Bump with:

```bash
scripts/release-version.sh patch "fix: non-breaking runtime issue"
scripts/release-version.sh minor "feat: backward-compatible capability"
scripts/release-version.sh major "breaking: incompatible behavior change"
```

Preview without changing files:

```bash
scripts/release-version.sh --dry-run patch "example summary"
```

Versioning skill files:

- `.codex/skills/versioning-by-impact/SKILL.md`
- `.claude/skills/versioning-by-impact/SKILL.md`

## Verification

```bash
cd mcp-server
npm test
npm run typecheck
npm run build
```

## Uninstall Shell Integration

Preferred:

```bash
scripts/uninstall-contextdb-shell.sh
source ~/.zshrc
```

Manual fallback (only if needed): remove the managed `# >>> contextdb-shell >>>` block from `~/.zshrc`.
