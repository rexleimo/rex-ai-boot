---
name: aios-project-system
description: Use when operating in the aios repository and needing the canonical architecture, memory schema, MCP browser tool behavior, and execution constraints before changing workflows.
---

# AIOS Project System

## Overview
Use this skill as the repository map for `aios`. It explains where state lives, how automation actually runs, and which files are authoritative before you edit tasks, workflows, or browser operations.

## Core Topology
- `CLAUDE.md`: project-level behavior contract and architecture overview.
- `memory/skills/*.json`: operational playbooks for recurring tasks (not deterministic executors).
- `memory/specs/*.json`: safety constraints and limits.
- `tasks/{pending,done,failed}`: task queue and outcomes.
- `mcp-server/`: local browser MCP implementation.
- `docs/plans/`: design, implementation, and postmortem documents.

## Runtime Truths (Do Not Skip)
- MCP server label may say `puppeteer-stealth`, but current implementation exposes Playwright-style `browser_*` tools from `mcp-server/src/index.ts`.
- `memory/skills/*.json` can drift from site UI; treat them as runbooks that require live verification.
- Prefer `browser_snapshot`/DOM evidence before using screenshots.
- Keep safety constraints aligned with `memory/specs` and `memory/skills/技能使用约束.json`.

## Default Operating Order
1. Read task context and matching `memory/skills` + `memory/specs` files.
2. Confirm available MCP tools and selector strategy.
3. Execute with evidence checkpoints (snapshot/log per key step).
4. Write outcome to docs/history and patch skills if drift is found.

## Resources
- `references/system-map.md`: concise architecture and data flow map.
- `references/file-index.md`: fast file lookup by change intent.
