---
title: Superpowers
description: Reusable automation skills that make your CLI smarter.
---

# Superpowers

Superpowers are reusable skills that automate common workflows. They hook into Claude Code, Codex, Gemini CLI, and OpenCode to handle repetitive tasks automatically.

## What are Superpowers?

Instead of repeating the same commands or prompts, you invoke a skill that:
- Guides the AI through a proven workflow
- Enforces best practices automatically
- Validates results before completion

## Available Superpowers

### brainstorming

Before starting any creative work, use this to lock in your intent.

- Explore project context
- Ask clarifying questions one at a time
- Propose approaches with trade-offs
- Present design and get approval before coding

**Use when**: building new features, designing pages, or adding functionality.

### writing-plans

Turn requirements into executable plans.

- Analyze requirements
- Break into sequential steps
- Identify dependencies
- Output a detailed plan document

**Use when**: you have a spec or multi-step task and need a roadmap.

### verification-before-completion

Never claim work is done without evidence.

- Run verification commands
- Confirm output matches expectations
- Require concrete evidence before success claims

**Use when**: finishing features, fixing bugs, or before creating PRs.

### systematic-debugging

Fix bugs with evidence, not guesswork.

- Gather symptoms and error messages
- Form hypothesis
- Test systematically
- Verify fix works

**Use when**: encountering test failures, crashes, or unexpected behavior.

### dispatching-parallel-agents

Run multiple independent tasks at once.

- Identify independent workstreams
- Launch parallel agents
- Aggregate results
- Handle failures gracefully

**Use when**: 2+ tasks that don't share state and can run simultaneously.

### team-ops

Monitor and manage multi-agent collaborations with HUD and Team status tools.

- View real-time session status with HUD
- Track team-wide dispatch outcomes
- Discover skill improvement candidates
- Filter by quality-gate outcomes

**Use when**: Running long tasks, debugging failures, or improving skills.

See [Agent Team & HUD](team-ops.md) for details.

### security-scan

Check your config for security issues before automation.

- Scan skills, hooks, MCP settings
- Identify exposed secrets
- Suggest fixes

**Use when**: enabling automation or changing configs.

## How to Use

1. When you need a superpower, just ask naturally
2. The AI will invoke the skill and guide you through
3. Results are saved to your project memory

## Examples

```
帮我用 brainstorming 想想这个功能怎么做
用 writing-plans 把这个需求拆成步骤
完成前用 verification-before-completion 验证一下
```

## RL Training System

AIOS includes a multi-environment reinforcement learning system. It trains a shared student policy across shell, browser, and orchestrator tasks using a unified control plane.

See the [Architecture page](architecture.md#rl-training-layer-aios) for details.

## Read More

- [Case Library](case-library.md) - Real-world usage examples
- [ContextDB](contextdb.md) - How memory persists across sessions
