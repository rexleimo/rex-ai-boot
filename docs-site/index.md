---
title: Overview
description: What rex-ai-boot is, why it exists, and how to use it with Codex, Claude, Gemini, and OpenCode.
---

# rex-ai-boot

Project URL: [https://github.com/rexleimo/rex-ai-boot](https://github.com/rexleimo/rex-ai-boot)

`rex-ai-boot` is a local-first workflow layer for four CLI agents:

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

It adds two practical capabilities without replacing native CLIs:

1. **Filesystem ContextDB** for resumable memory across sessions.
2. **Unified wrapper flow** so you still run `codex`, `claude`, or `gemini` directly.

## Start In 30 Seconds (Use First, Read Later)

```bash
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## What Problems It Solves

- You can resume work with context after terminal restarts.
- You can keep memory per project (git-root scoped).
- You can hand off work across different CLI tools using the same context packet.

## Quick Command Preview

```bash
# interactive mode (same commands, context injected automatically)
codex
claude
gemini

# one-shot mode (full 5-step pipeline)
scripts/ctx-agent.sh --agent codex-cli --prompt "Continue from latest checkpoint"
```

## Read Next

- [Project (GitHub)](https://github.com/rexleimo/rex-ai-boot)
- [Quick Start](getting-started.md)
- [Blog Site](https://cli.rexai.top/blog/)
- [Friends](friends.md)
- [Changelog](changelog.md)
- [CLI Workflows](use-cases.md)
- [Case Library](case-library.md)
- [Architecture](architecture.md)
- [ContextDB runtime details](contextdb.md)
