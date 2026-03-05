---
title: Overview
description: Upgrade your existing Codex/Claude/Gemini/OpenCode workflow with OpenClaw-style capabilities.
---

# RexCLI

> Keep your current CLI workflow. Add OpenClaw-style capabilities on top of `codex`, `claude`, `gemini`, and `opencode`.

[Quick Start](getting-started.md){ .md-button .md-button--primary }
[Capability Cases](case-library.md){ .md-button }

Project URL: <https://github.com/rexleimo/rex-cli>

## What is this?

RexCLI is a thin layer on top of your existing CLI agents. It doesn't replace them—it makes them work better together.

Four things it adds:

1. **Memory that survives restarts** - Your project context comes back automatically after you close and reopen the terminal.
2. **Browser automation** - Control Chrome via MCP without manually clicking around.
3. **Skills you can reuse** - Turn one-time conversations into repeatable workflows.
4. **Privacy Guard** - Automatically redacts secrets before they leak into prompts or logs.

## Who is this for?

- You already use `codex`, `claude`, `gemini`, or `opencode` regularly
- You want your workflows to survive terminal restarts
- You need browser automation without switching tools
- You care about keeping API keys out of chat history

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
| Skills | Reusable workflow snippets |
| Privacy Guard | Redact secrets automatically |

## Read More

- [Quick Start](getting-started.md)
- [Case Library](case-library.md)
- [Architecture](architecture.md)
- [ContextDB](contextdb.md)
- [Changelog](changelog.md)
