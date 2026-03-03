---
title: Overview
description: What rex-ai-boot is, why it exists, and how to use it with Codex, Claude, and Gemini.
---

# rex-ai-boot

`rex-ai-boot` is a local-first workflow layer for three CLI agents:

- Codex CLI
- Claude Code
- Gemini CLI

It adds two practical capabilities without replacing native CLIs:

1. **Filesystem ContextDB** for resumable memory across sessions.
2. **Unified wrapper flow** so you still run `codex`, `claude`, or `gemini` directly.

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

## Friend Links

- [os.rexai.top](https://os.rexai.top)
  - RexOS AI Agent OS: harness-first long-task execution, SQLite-backed memory, and sandboxed tool runtime for autonomous workflows.
- [rexai.top](https://rexai.top)
  - RexAI content hub: AI engineering articles, tutorials, tool analysis, and product updates for builders.
- [tool.rexai.top](https://tool.rexai.top)
  - RexAI tools portal: free no-ad online tools with fast global access and developer-friendly continuous updates.

## Read Next

- [Quick Start](getting-started.md)
- [Blog Site](https://cli.rexai.top/blog/)
- [Changelog](changelog.md)
- [CLI Workflows](use-cases.md)
- [Architecture](architecture.md)
- [ContextDB runtime details](contextdb.md)
