---
title: Find Commands By Scenario
description: Do not memorize concepts first. Pick the RexCLI command by what you want to do now.
---

# Find Commands By Scenario

This page answers one question: **which command should I run right now?**

<figure class="rex-visual">
  <img src="assets/visual-contextdb-memory-loop.svg" alt="ContextDB project memory loop: after .contextdb-enable, codex, claude, and gemini share local project memory">
  <figcaption>Most scenarios revolve around one core idea: enable ContextDB in the project root, then different CLIs can connect to the same local context.</figcaption>
</figure>

## I Want To Install And Check The Environment

```bash
aios
```

In the TUI, run these in order:

1. **Setup**: install shell wrappers, skills, browser components, and related pieces.
2. **Doctor**: check Node, MCP, skills, and native config.
3. **Update**: use this path for upgrades later.

Command-line path:

```bash
aios setup --components all --mode opt-in --client all
aios doctor --native --verbose
```

## I Want The Agent To Remember This Project

```bash
cd /path/to/project
touch .contextdb-enable
codex
```

After that, `codex`, `claude`, and `gemini` in the same project all connect to the same ContextDB.

## I Want Cross-CLI Handoff

```bash
claude   # analyze first
codex    # implement next
gemini   # review or compare last
```

As long as all three run in the same project directory, ContextDB saves events and checkpoints so switching tools is less likely to lose context.

## I Want To Start Agent Team

Good fit: independent modules, splittable work, and acceptable token cost.

```bash
aios team 3:codex "Implement X, run tests before finishing, and summarize changes"
aios team status --provider codex --watch
```

Bad fit: fuzzy requirements, one-off bugs, or multiple workers likely editing the same file. Use normal `codex` first in those cases.

## I Want To See Progress And History

```bash
aios hud --provider codex
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

To quickly see recent failures:

```bash
aios team history --provider codex --quality-failed-only
```

## I Want A Quality Gate

```bash
aios quality-gate pre-pr --profile strict
```

Use this before a PR or after a large change. It includes ContextDB, native/sync, and release-health checks.

## I Want RexCLI To Orchestrate Stages

Preview first, without model calls:

```bash
aios orchestrate feature --task "Ship X" --dispatch local --execute dry-run
```

Enable live execution explicitly only when you are ready:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli
aios orchestrate --session <session-id> --dispatch local --execute live
```

New users should prefer `aios team ...`. `orchestrate live` is for maintainers who already understand sessions, plans, and preflight gates.

## I Want To Diagnose Browser Automation

```bash
aios internal browser doctor --fix
aios internal browser cdp-status
```

If page actions fail, read [Troubleshooting](troubleshooting.md) before reinstalling everything.

## I Want To Protect Secrets And Config

```bash
aios privacy read --file .env
```

Do not paste `.env`, cookies, tokens, or browser profiles directly into a model. RexCLI Privacy Guard tries to redact before read output is shared.

## Selection Mnemonic

- **Daily development**: `codex` / `claude` / `gemini`
- **Install/update**: `aios`
- **Agent Team**: `aios team 3:codex "task"`
- **Progress**: `aios team status --watch`
- **Before delivery**: `aios quality-gate pre-pr --profile strict`
- **Browser issue**: `aios internal browser doctor --fix`
