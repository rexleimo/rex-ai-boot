# rex-ai-boot (AIOS)

This repository provides a local-first agent workflow for `Codex CLI`, `Claude Code`, and `Gemini CLI`.
It does not replace those clients. Instead, it adds two shared capabilities:

1. Unified browser automation via Playwright MCP (`browser_*` tools)
2. Cross-CLI filesystem Context DB for resumable task memory

## Why does `codex` load ContextDB automatically?

The mechanism is **transparent zsh wrapping**:

- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) defines shell functions for `codex()`, `claude()`, and `gemini()`
- Those functions delegate to [`scripts/contextdb-shell-bridge.mjs`](scripts/contextdb-shell-bridge.mjs), which decides wrap vs passthrough
- When wrapping is enabled, the bridge calls [`scripts/ctx-agent.mjs`](scripts/ctx-agent.mjs) with current git root as `--workspace`
- Outside git projects, or for management subcommands (for example `codex mcp`, `gemini hooks`), commands pass through unchanged

So you keep using the same command names and normal interactive flow.

## Architecture

```text
User -> codex/claude/gemini
     -> (zsh wrapper: contextdb-shell.zsh)
     -> contextdb-shell-bridge.mjs
     -> ctx-agent.mjs
        -> contextdb CLI (init/session/event/checkpoint/pack)
        -> start native codex/claude/gemini (with context packet)
     -> mcp-server/browser_* (optional browser automation)
```

## Repository Layout

- `mcp-server/`: Playwright MCP service and `contextdb` CLI implementation
- `scripts/contextdb-shell-bridge.mjs`: Cross-platform wrap/passthrough decision bridge
- `scripts/ctx-agent.mjs`: Unified runner that integrates ContextDB
- `scripts/contextdb-shell.zsh`: Transparent wrappers for `codex/claude/gemini`
- `memory/context-db/`: Runtime session artifacts for this repo (ignored by git)
- `config/browser-profiles.json`: Browser profile/CDP config

## Prerequisites

- Git
- Node.js **20+** (recommended: **22 LTS**) with `npm`
- Windows: PowerShell (Windows PowerShell 5.x or PowerShell 7)
- Optional (docs only): Python 3.10+ for MkDocs (`pip install -r docs-requirements.txt`)

## Quick Start

Before running any `scripts/*.sh` or `scripts/*.ps1` commands, clone and enter this repository:

```bash
git clone https://github.com/rexq57/rex-ai-boot.git
cd rex-ai-boot
```

## Official Case Library

If you want concrete, reproducible examples of what this repo can do, start here:

- Docs site: `https://cli.rexai.top/case-library/`
- Repo doc: [`docs-site/case-library.md`](docs-site/case-library.md)

### 1) One command setup (recommended)

macOS / Linux:

```bash
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components all -Mode opt-in
. $PROFILE
```

This installs Browser MCP, shell wrappers, optional global skills, and superpowers in one flow.

Component selection examples:

```bash
# only shell + skills + superpowers
scripts/setup-all.sh --components shell,skills,superpowers --mode opt-in

# only browser MCP
scripts/setup-all.sh --components browser
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills,superpowers -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
```

### 2) One command update / uninstall

```bash
scripts/update-all.sh --components all --mode opt-in
scripts/uninstall-all.sh --components shell,skills
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
```

### 3) Advanced: component-specific scripts

If you prefer explicit per-component lifecycle, use the individual scripts in `scripts/`:

- Browser MCP: `install-browser-mcp.*`, `doctor-browser-mcp.*`
- Shell wrappers: `install/update/uninstall/doctor-contextdb-shell.*`
- Global skills: `install/update/uninstall/doctor-contextdb-skills.*`
- Superpowers: `install/update/doctor-superpowers.*`

### 3.1 Scope control (avoid cross-project reuse)

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

### 3.2 Skill scope (important)

ContextDB wrapping and CLI skill loading are different layers:

- Wrapping scope is controlled by `CTXDB_WRAP_MODE` above.
- Use skill lifecycle scripts above for install/update/uninstall/doctor.
- Skill installers skip existing same-name targets by default; use `--force` / `-Force` only when you intentionally replace them.
- Skills installed in `~/.codex/skills`, `~/.claude/skills`, `~/.gemini/skills`, or `~/.config/opencode/skills` are global.
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
