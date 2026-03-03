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

### 1) Build MCP server and ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

### 2) Install transparent shell integration (one-time)

> Safety first: prefer manual `~/.zshrc` editing and back it up before changes.

Backup:

```bash
cp ~/.zshrc ~/.zshrc.bak.$(date +%Y%m%d-%H%M%S)
```

Add this block to `~/.zshrc`:

```zsh
# >>> contextdb-shell >>>
export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "$ROOTPATH/scripts/contextdb-shell.zsh"
fi
# <<< contextdb-shell <<<
```

Reload:

```bash
source ~/.zshrc
```

If your repo path is different, set `ROOTPATH` to your actual location.

Optional helper script: [`scripts/install-contextdb-shell.sh`](scripts/install-contextdb-shell.sh)

### 2.1 Scope control (avoid cross-project reuse)

By default, wrappers run in **all git repositories** (`CTXDB_WRAP_MODE=all`).
If you want isolation, set one of these in `~/.zshrc`:

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

### 2.2 Skill scope (important)

ContextDB wrapping and CLI skill loading are different layers:

- Wrapping scope is controlled by `CTXDB_WRAP_MODE` above.
- Skills installed in `~/.codex/skills` or `~/.claude/skills` are global.
- Project-only skills should live in `<repo>/.codex/skills` or `<repo>/.claude/skills`.

If you don't want cross-project skill reuse, keep custom skills in repo-local folders instead of global home directories.

### 3) Use original commands directly

```bash
codex
claude
gemini
```

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
  index/sessions.jsonl
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
```

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

Open `~/.zshrc`, remove this block, then reload shell:

```zsh
# >>> contextdb-shell >>>
...
# <<< contextdb-shell <<<
```

```bash
source ~/.zshrc
```

After removal, `codex/claude/gemini` return to native behavior.
