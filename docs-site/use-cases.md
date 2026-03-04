---
title: CLI Workflows
description: Practical usage patterns for interactive and one-shot agent execution.
---

# CLI Workflows

## Quick Answer (AI Search)

Use interactive mode for daily coding with automatic resume, and one-shot mode for deterministic full-loop execution (`init -> session -> event -> checkpoint -> pack`).

Need concrete scenarios with command-level examples? See the [Official Case Library](case-library.md).

## Mode A: Interactive Resume (default)

Use native commands. Wrapper auto-runs:

`init -> session:latest/new -> context:pack -> start CLI`

```bash
codex
claude
gemini
```

Best for daily development with automatic startup context.

## Mode B: One-shot Automation

Use when you want a full closed loop in one command:

`init -> session:latest/new -> event:add -> checkpoint -> context:pack`

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "Summarize errors and propose next steps"
scripts/ctx-agent.sh --agent gemini-cli --prompt "Continue implementation from checkpoint"
scripts/ctx-agent.sh --agent codex-cli --prompt "Run tests and update task status"
```

## Cross-CLI Handoff

A common flow is:

1. Analyze with Claude.
2. Implement with Codex.
3. Verify/compare with Gemini.

Because all three read/write the same project ContextDB, handoff stays coherent.

## Pass-through Commands

Management commands are not wrapped and continue to work natively, for example:

```bash
codex mcp
claude doctor
gemini extensions
```

## FAQ

### When should I use one-shot mode?

Use one-shot when you need auditable, stage-complete execution in a single command.

### Can I switch between CLIs in one task?

Yes. The shared project ContextDB enables cross-CLI handoff without losing task state.
