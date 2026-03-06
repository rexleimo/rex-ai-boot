---
title: Overview
description: Upgrade your existing Codex/Claude/Gemini/OpenCode workflow with OpenClaw-style capabilities.
---

# RexCLI

> Keep your current CLI workflow. Add OpenClaw-style capabilities on top of `codex`, `claude`, `gemini`, and `opencode`.

[Star on GitHub](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=english_growth&utm_content=home_hero_star){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }
[Quick Start](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[Compare Workflows](cli-comparison.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="compare_workflows" }
[Superpowers](superpowers.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="superpowers" }

Project URL: <https://github.com/rexleimo/rex-cli>

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
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## What's Included

| Feature | What it does |
|---|---|
| ContextDB | Persistent memory across sessions |
| Playwright MCP | Browser automation |
| Superpowers | Smart planning (auto-decompose, parallel dispatch, auto-verify) |
| Privacy Guard | Redact secrets automatically |

## Read More

- [Superpowers](superpowers.md) - Automation skills that make your CLI smarter
- [Quick Start](getting-started.md)
- [Raw CLI vs RexCLI](cli-comparison.md)
- [Case Library](case-library.md)
- [Architecture](architecture.md)
- [ContextDB](contextdb.md)
- [Changelog](changelog.md)
