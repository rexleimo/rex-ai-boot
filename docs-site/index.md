---
title: Overview
description: AI memory system docs for Codex/Claude/Gemini/OpenCode with Hermes workflow guidance, Agent Team runtime, and automatic subagent planning.
---

# RexCLI

> Keep your current CLI workflow. Add OpenClaw-style capabilities on top of `codex`, `claude`, `gemini`, and `opencode`.

[Star on GitHub](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=english_growth&utm_content=home_hero_star){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }
[Quick Start](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[Compare Workflows](cli-comparison.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="compare_workflows" }
[Superpowers](superpowers.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="superpowers" }

Project URL: <https://github.com/rexleimo/rex-cli>

## Quick Answer

RexCLI is an **AI memory system + orchestration layer** for coding agents.  
Use it when you want:

- **Memory system** behavior across CLI sessions (`ContextDB`)
- **Hermes engine style workflows** for automation and execution control
- **Agent Team** collaboration for multi-agent delivery
- **Automatic subagent planning** with preflight and merge gates

## Keyword-to-Feature Map

- `AI memory system` -> [ContextDB](contextdb.md)
- `memory system` -> [Case - Cross-CLI Handoff](case-cross-cli-handoff.md)
- `Hermes engine workflows` -> [CLI Workflows](use-cases.md)
- `Agent Team` -> [Agent Team & HUD](team-ops.md)
- `automatic subagent planning` -> [Architecture](architecture.md)

## Advanced Design Skills for Page Building

Need higher-quality page output from fuzzy prompts?

- Use [Advanced Design Skills](advanced-design-skills.md) to lock style with `DESIGN.md` and implement with `frontend-design`.
- Apply the `Patch/Restyle/Flow` pattern to keep delivery predictable.
- For product teams, ship the built-in system prompt from the guide as your default.

## Latest

- [Advanced Design Skills for Page Building: From Vague Prompts to Production UI](/blog/advanced-design-skills-page-building/)
- [AIOS RL Training System: Multi-Environment Reinforcement Learning](/blog/rl-training-system/)
- [ContextDB Search Upgrade: FTS5/BM25 by Default](/blog/contextdb-fts-bm25-search/)
- [Windows CLI Startup Stability Update](/blog/windows-cli-startup-stability/)
- [Orchestrate Live: Subagent Runtime](/blog/orchestrate-live/)

## What is this?

RexCLI is a thin layer on top of your existing CLI agents. It doesn't replace them—it makes them work better together.

Four things it adds:

1. **Memory that survives restarts** - Your project context comes back automatically after you close and reopen the terminal, and syncs across devices for the same project.
2. **Browser automation** - Control Chrome via MCP without manually clicking around.
3. **Superpowers** - Smart planning: auto-decompose requirements, parallel task distribution, automatic verification.
4. **Privacy Guard** - Automatically redacts secrets before they leak into prompts or logs.

## Who is this for?

- You already use `codex`, `claude`, `gemini`, or `opencode` regularly
- You want your workflows to survive terminal restarts
- You need browser automation without switching tools
- You want automation skills that enforce best practices

## Quick Start

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

The command above is the stable release install path. If you want unreleased `main` behavior, use the dev-friendly `git clone` flow from [Quick Start](getting-started.md) instead.

Launch `aios` to open the full-screen setup TUI, choose **Setup**, and run **Doctor** before you leave.
Windows PowerShell commands are listed on the [Quick Start](getting-started.md) page.

## What's Included

| Feature | What it does |
|---|---|
| ContextDB | Persistent memory across sessions |
| Playwright MCP | Browser automation |
| Superpowers | Smart planning (auto-decompose, parallel dispatch, auto-verify) |
| Privacy Guard | Redact secrets automatically |

## FAQ

### Is RexCLI a memory system for coding agents?
Yes. `ContextDB` persists and rehydrates project memory across CLI sessions and across agent clients in the same repository.

### Does RexCLI support Hermes-like orchestration workflows?
Yes. Use `team` and `orchestrate` flows for staged planning, execution routing, and verification gates.

### Can it auto-plan subagents for multi-step tasks?
Yes. RexCLI includes route-aware planning (`single/subagent/team`) and execution guardrails.

## Read More

- [Superpowers](superpowers.md) - Automation skills that make your CLI smarter
- [Quick Start](getting-started.md)
- [Raw CLI vs RexCLI](cli-comparison.md)
- [Case Library](case-library.md)
- [Architecture](architecture.md)
- [ContextDB](contextdb.md)
- [Changelog](changelog.md)
