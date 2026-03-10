# Orchestrator Agent Catalog (P1) — Design

**Date:** 2026-03-10  
**Status:** Approved

## Goal

Add a role-based agent catalog that can be reused across clients (Claude Code, Codex, Gemini, OpenCode) and referenced by the orchestrator dispatch plan, so future real runtimes can spawn subagents without re-inventing role cards each run.

## Scope

- Define a canonical spec: `memory/specs/orchestrator-agents.json`
  - `agents`: reusable agent cards (prompt + metadata)
  - `roleMap`: orchestrator role id -> agent id
- Generate client-discoverable agent files:
  - `.claude/agents/*.md`
  - `.codex/agents/*.md` (repo-local convention; used by future runtimes and for cross-client symmetry)
- Inject `agentRefId` into `dispatchPlan.jobs[].launchSpec` for phase jobs.

## Non-Goals

- No real model/runtime execution (still local-only).
- No pool/concurrency implementation yet (that comes after agent refs exist and are stable).
- No global installation into `~/.claude/agents` (repo-local only).

## Spec

`memory/specs/orchestrator-agents.json` is the single source of truth.

Constraints:

- Agent ids are kebab-case and stable (for example `rex-planner`).
- `roleMap` must cover all orchestrator roles that appear in blueprints.
- Each agent defines:
  - `name`, `description`, `tools`, `model` (for Claude Code YAML frontmatter compatibility)
  - `role`, `handoffTarget`, `systemPrompt` (used to render the agent markdown body)

## Generated Files

Generator writes files with a managed marker:

- Files containing the marker may be overwritten on subsequent runs.
- Files without the marker are never modified.
- Stale generated files (marker present but agent missing from spec) are removed.

## Dispatch Plan Injection

For phase jobs (`jobType=phase`), `launchSpec` is extended with:

- `agentRefId`: stable agent id

This is additive and does not alter dry-run execution semantics.

## Safety

- `--execute live` remains opt-in gated (`AIOS_EXECUTE_LIVE=1`) and the runtime is still a stub.
- Live-mode dispatch evidence is not persisted into ContextDB.

