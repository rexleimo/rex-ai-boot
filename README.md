# RexCLI (AIOS)

This repository provides a local-first agent workflow for `Codex CLI`, `Claude Code`, and `Gemini CLI`.
It does not replace those clients. Instead, it adds three shared capabilities:

1. Unified browser automation via Playwright MCP (`browser_*` tools)
2. Cross-CLI filesystem Context DB for resumable task memory
3. Privacy Guard redaction before reading config/secret-like files (`~/.rexcil/privacy-guard.json`)

## Start Here (Use First, Read Later)

Key links:

- Project (GitHub): `https://github.com/rexleimo/rex-cli`
- Docs: `https://cli.rexai.top`
- Blog: `https://cli.rexai.top/blog/`
- Case Library: `https://cli.rexai.top/case-library/`
- Friend sites: `https://os.rexai.top` / `https://rexai.top` / `https://tool.rexai.top`

30-second install (recommended, GitHub Releases):

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

30-second install (Windows PowerShell):

```powershell
irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
. $PROFILE
aios
```

Recommended TUI walkthrough (best first run):

1. Launch `aios`
2. Choose `Setup` in the full-screen menu
3. Pick the component set that matches your goal:
   - `all` for the full stack
   - `shell,skills,superpowers` for memory + skills first
   - `browser` for Browser MCP only
4. Run `Doctor` before leaving the TUI

Alternative: git clone (dev-friendly):

Lifecycle note:

- `node scripts/aios.mjs` is now the canonical implementation path.
- `scripts/aios.sh` / `scripts/aios.ps1` and `setup-all/update-all/verify-aios` remain supported as thin compatibility wrappers.

macOS / Linux:

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/aios.sh
```

Windows PowerShell:

```powershell
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
```

## Why does `codex` load ContextDB automatically?

The mechanism is **transparent zsh wrapping**:

- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) defines shell functions for `codex()`, `claude()`, and `gemini()`
- Those functions delegate to [`scripts/contextdb-shell-bridge.mjs`](scripts/contextdb-shell-bridge.mjs), which decides wrap vs passthrough
- When wrapping is enabled, the bridge calls [`scripts/ctx-agent.mjs`](scripts/ctx-agent.mjs) with the current git root as `--workspace`, or the current directory when Git root detection is unavailable
- Outside git projects, the bridge can fall back to the current directory as workspace; management subcommands (for example `codex mcp`, `gemini hooks`) still pass through unchanged

So you keep using the same command names and normal interactive flow.

## Automatic First Task Bootstrap

On the first `codex`/`claude`/`gemini` run in a workspace, AIOS now auto-creates a lightweight bootstrap task when:

- `tasks/.current-task` is missing or empty
- `tasks/pending/` has no non-hidden entries

Generated files:

- `tasks/pending/task_<timestamp>_bootstrap_guidelines/task.json`
- `tasks/pending/task_<timestamp>_bootstrap_guidelines/prd.md`
- `tasks/.current-task`

Disable options:

- Global: `export AIOS_BOOTSTRAP_AUTO=0`
- Per invocation: `scripts/ctx-agent.mjs ... --no-bootstrap`

## Operator Toolkit (Quality Gate / Learn-Eval / Orchestrate)

These commands are designed to keep the workflow local-first and predictable before you plug in any real parallel model runtime.

### Quality Gate (repo health + ContextDB regression guard)

Run the full gate:

```bash
aios quality-gate full
```

Run a stricter pre-PR gate:

```bash
aios quality-gate pre-pr --profile strict
```

Disable a specific check (comma-separated):

```bash
AIOS_DISABLED_GATES=quality:contextdb aios quality-gate pre-pr
```

### Learn-Eval (turn checkpoint telemetry into recommendations)

```bash
aios learn-eval --limit 10
aios learn-eval --session <session-id> --format json
```

### Orchestrate (blueprints + local dispatch skeleton + token-free dry-run)

Preview a blueprint:

```bash
aios orchestrate feature --task "Ship X"
```

Build a local dispatch plan (no model calls, no execution):

```bash
aios orchestrate --session <session-id> --dispatch local --execute none --format json
```

Simulate execution locally (still no model calls):

```bash
aios orchestrate --session <session-id> --format json
# optional: run supported gate/runbook actions before final DAG selection
aios orchestrate --session <session-id> --preflight auto --format json
```

Execute live via CLI subagents (token cost, opt-in; currently codex-only):

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # required (codex-only live runtime)
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

Tip (codex-cli): Codex CLI v0.114+ supports structured exec outputs. AIOS will auto-use `codex exec` with `--output-schema` + `--output-last-message` + stdin when available, and fall back to stdout parsing for older versions.

### Context Pack Fail-Open (prevent wrapper hard failures)

By default, `ctx-agent` will **warn and continue** if `contextdb context:pack` fails (it will run the CLI without injected context rather than crashing).

If you want to make context packet failures fatal:

```bash
export CTXDB_PACK_STRICT=1
```

Shell wrappers (`codex`/`claude`/`gemini`) default to fail-open even if `CTXDB_PACK_STRICT=1` is set (so interactive sessions don't get bricked). To enforce strict packing for wrapped CLI runs too:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

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
- `scripts/privacy-guard.mjs`: Privacy guard config + redaction CLI (`init/status/set/redact`)
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
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
```

## Official Case Library

If you want concrete, reproducible examples of what this repo can do, start here:

- Docs site: `https://cli.rexai.top/case-library/`
- Repo doc: [`docs-site/case-library.md`](docs-site/case-library.md)

### 1) Recommended setup in the TUI

macOS / Linux:

```bash
scripts/aios.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
```

Inside the TUI:

1. Choose `Setup`
2. Pick `all`, `shell,skills,superpowers`, or `browser`
3. Let the install finish, then run `Doctor`
4. Reload your shell if wrappers were installed

This is the clearest path for first-time setup in this iteration. Direct script commands remain available below for automation and non-interactive use.

Privacy Guard is now initialized automatically during shell setup, with config stored at `~/.rexcil/privacy-guard.json`.
It is enabled by default and enforces redaction for sensitive config files:

```bash
# check status / strict policy
aios privacy status

# required read path for config-like files
aios privacy read --file <path>

# optional local ollama path (qwen3.5:4b)
aios privacy ollama-on
```

Need direct script control instead? Use these non-interactive examples:

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
# only enable in RexCLI itself
export CTXDB_WRAP_MODE=repo-only

# or: only enable in repos that contain .contextdb-enable
export CTXDB_WRAP_MODE=opt-in
```

For `opt-in`, create marker file in a project root:

```bash
touch .contextdb-enable
```

Latest behavior:
- In `opt-in` mode, wrapper startup auto-creates the marker by default.
- Disable auto-create when you want strict manual opt-in:

```bash
export CTXDB_AUTO_CREATE_MARKER=0
```

### 3.1.1 Common pitfall: Node ABI mismatch (`better-sqlite3`)

If startup fails with:

```text
contextdb init failed: ... better_sqlite3.node ...
... compiled against NODE_MODULE_VERSION 115 ...
... requires NODE_MODULE_VERSION 127 ...
```

Root cause:
- The wrapper runs ContextDB with your current shell Node runtime.
- `mcp-server/node_modules/better-sqlite3` is a native addon and must match that Node ABI.
- A common case is running `codex` in a Node 22 project while `aios/mcp-server` dependencies were installed under Node 20.

Current behavior:
- The wrapper auto-detects this mismatch and retries once after running `npm rebuild better-sqlite3`.
- Set `CTXDB_AUTO_REBUILD_NATIVE=0` if you want strict fail-fast behavior.

Manual fix (if auto-rebuild fails):

```bash
cd "$ROOTPATH/mcp-server"
npm rebuild better-sqlite3
# fallback if rebuild is not enough:
# npm install
```

Verify:

```bash
cd "$ROOTPATH/mcp-server"
npm run contextdb -- init --workspace <your-project-root>
```

Prevention:
- After switching Node major versions, rebuild native deps in `mcp-server`.
- If you do not want cross-project wrapping, keep `CTXDB_WRAP_MODE=repo-only` (or `off` temporarily).

### 3.2 Skill scope (important)

ContextDB wrapping and CLI skill loading are different layers:

- Wrapping scope is controlled by `CTXDB_WRAP_MODE` above.
- Use skill lifecycle scripts above for install/update/uninstall/doctor.
- Skill installers skip existing same-name targets by default; use `--force` / `-Force` only when you intentionally replace them.
- Skills installed in `~/.codex/skills`, `~/.claude/skills`, `~/.gemini/skills`, or `~/.config/opencode/skills` are global.
- Project-only skills should live in `<repo>/.codex/skills` or `<repo>/.claude/skills`.
- Do not place discoverable `SKILL.md` files inside parallel folders such as `.baoyu-skills/`; Codex/Claude will not treat them as repo-local skills. Use `.baoyu-skills/` only for extension config such as `EXTEND.md`.
- `CODEX_HOME` can be relative (wrappers resolve it against current working directory at runtime), but absolute paths are more predictable for global setups.

If you don't want cross-project skill reuse, keep custom skills in repo-local folders instead of global home directories.

### 3.3 Privacy Guard (strict by default)

Privacy Guard is controlled by `~/.rexcil/privacy-guard.json` and runs in strict mode by default.

```bash
# inspect current state
aios privacy status

# required read path for config/secret-like files
aios privacy read --file config/browser-profiles.json
```

Optional local model path:

```bash
aios privacy ollama-on
# equivalent mode: hybrid with qwen3.5:4b on local ollama
```

If you must disable temporarily:

```bash
aios privacy disable
```

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
- Note: in-CLI reset commands like `/new` (Codex) or `/clear` (Claude/Gemini) reset the conversation state. Exit and re-run the CLI to re-inject, or attach `memory/context-db/exports/latest-<agent>-context.md` as the first prompt.
- Limitation: does not auto-write checkpoint after every turn

### B) One-shot mode (full automation recommended)

```bash
scripts/ctx-agent.sh --agent codex-cli --project RexCLI --prompt "Continue from previous task and execute next step"
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
npm run contextdb -- session:new --agent claude-code --project RexCLI --goal "stabilize flow"
npm run contextdb -- event:add --session <id> --role user --text "need retry plan"
npm run contextdb -- checkpoint --session <id> --summary "blocked by auth" --status blocked --next "wait-login|resume"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
npm run contextdb -- search --query "auth race" --project RexCLI --kinds response --refs auth.ts
```

Optional semantic rerank (P2):

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project RexCLI --semantic
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
