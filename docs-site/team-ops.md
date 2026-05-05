---
title: Agent Team
description: When to use Agent Team, how to start, monitor, finish, and when not to use it.
---

# Agent Team

Agent Team is not “more agents is always better”. It is for tasks that are **splittable, clearly bounded, and safe to run in parallel**.

In live mode, Agent Team uses the **GroupChat Runtime**: agents run in rounds with a shared conversation thread. The planner analyzes the task, implementers work in parallel, and reviewers validate. If an agent gets blocked, a re-plan round is automatically triggered.

If you only remember one command:

```bash
aios team 3:codex "Implement X, run tests before finishing, and summarize changes"
aios team status --provider codex --watch
```

<figure class="rex-visual">
  <img src="assets/visual-agent-team-monitoring.svg" alt="Agent Team preflight checklist and HUD status monitoring illustration">
  <figcaption>Check whether the task is truly parallel-friendly before starting team. The monitoring window only shows progress; closing it does not stop the main task.</figcaption>
</figure>

## When To Use Team

Good fit:

- A requirement can be split into relatively independent frontend, backend, tests, or docs work.
- You already know the acceptance criteria, such as “tests must pass” or “docs must be updated”.
- You are willing to spend extra tokens and waiting time for parallel execution.
- You need HUD/history to track multiple workers.

Bad fit:

- The requirement is still unclear and you are exploring direction.
- Small bugs, single-file fixes, or one-off commands.
- Multiple workers are likely to edit the same files.
- You are debugging an issue that needs stable reproduction.

If unsure, start with normal interactive mode:

```bash
codex
```

Before starting team, confirm these 3 checks:

<div class="rex-checklist">
  <div class="rex-checklist__item">The task splits into 2+ independent modules</div>
  <div class="rex-checklist__item">Workers will not edit the same file set</div>
  <div class="rex-checklist__item">Acceptance criteria fit in one sentence</div>
</div>

## 10-Minute Flow

### 1) Write A Clear Task

A good task description includes goal, boundary, and acceptance criteria.

```bash
aios team 3:codex "Improve login form error messages; do not change the auth API; run related tests and update docs before finishing"
```

### 2) Start Monitoring

```bash
aios team status --provider codex --watch
```

Lightweight mode:

```bash
aios team status --provider codex --watch --preset minimal --fast
```

### 3) Read History And Failures

```bash
aios team history --provider codex --limit 20
aios team history --provider codex --quality-failed-only
```

### 4) Run A Quality Gate Before Finishing

```bash
aios quality-gate pre-pr --profile strict
```

If the quality gate fails, inspect the failure category first. Do not immediately start more workers.

## Choosing Worker Count

| Level | Command | Best for |
|---|---|---|
| Stable | `aios team 2:codex "task"` | First run, possible file overlap |
| Recommended | `aios team 3:codex "task"` | Most daily features |
| High throughput | `aios team 4:codex "task"` | Highly independent modules with clear tests |

If you see conflicts, duplicate edits, or long waits, reduce concurrency instead of adding workers.

## Choosing Provider

```bash
aios team 3:codex "task"
aios team 2:claude "task"
aios team 2:gemini "task" --dry-run
```

Suggestions:

- Prefer `codex` for daily implementation.
- Try `claude` for long-form analysis or plan comparison.
- Add `--dry-run` when you are unsure what a command will do.

## Resume And Retry

If a run is interrupted, inspect history first:

```bash
aios team history --provider codex --limit 5
```

Then retry only blocked jobs:

```bash
aios team --resume <session-id> --retry-blocked --provider codex --workers 2
```

Do not start a bigger team before understanding why the previous run failed.

## Team vs Orchestrate

| Capability | Better for |
|---|---|
| `aios team ...` | Quickly start multiple workers on one task |
| `aios orchestrate ... --execute dry-run` | Preview a staged DAG and gates |
| `aios orchestrate ... --execute live` | Maintainers who need strict staged execution |

New users should prefer `team`. `orchestrate live` requires explicit opt-in:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli
aios orchestrate --session <session-id> --dispatch local --execute live
```

## GroupChat Runtime (Round-Based Agent Team)

When `aios team` runs in live mode, it uses the **GroupChat Runtime**: a round-based execution model where agents share a single conversation thread instead of working in isolated one-shot dispatches.

### How It Differs From Classic Parallel Dispatch

| | Classic Parallel | GroupChat Runtime |
|---|---|---|
| Agent communication | Isolated; only dependency outputs | Shared conversation history |
| Execution order | Static DAG phases | Rounds (sequential) with parallel speakers per round |
| Blocked recovery | Manual retry | Automatic re-plan (planner re-evaluates) |
| Work item expansion | Fixed queue | Planner findings become parallel work items |
| Termination | All jobs complete | Consensus or max rounds |

### Round Flow

GroupChat maps blueprint phases to rounds. Within each round, speakers run concurrently (controlled by `AIOS_SUBAGENT_CONCURRENCY`). After a round finishes, all agents in the next round can see the full accumulated history.

```
Round 1 → planner (analyze, produce work items)
Round 2 → N × implementer (parallel, one per work item)
Round 3 → reviewer (+ security-reviewer in parallel)
```

If an implementer reports `blocked` or `needs-input`, a **re-plan round** is automatically inserted: a planner re-evaluates the situation with full history visibility and decides the next step.

### Blueprint Selection

| Blueprint | Rounds | Best for |
|---|---|---|
| `bugfix` | plan → implement → review | Single-focus fixes, small scope |
| `feature` | plan → implement → review + security | New features with quality gates |
| `refactor` | plan → implement → review | Pure refactoring, no feature changes |
| `security` | assess → plan → implement → review | Security-sensitive changes |

Choose the smallest blueprint that fits the task. A simple file creation needs `bugfix`, not `feature`.

### Configuration

```bash
# Required for live execution
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli   # or claude-code, gemini-cli, opencode-cli

# Concurrency (speakers per round)
export AIOS_SUBAGENT_CONCURRENCY=3      # default: 3

# Timeout per agent turn (ms)
export AIOS_SUBAGENT_TIMEOUT_MS=600000  # default: 10 min

# Allow live execution without capability preflight (use with caution)
export AIOS_ALLOW_UNKNOWN_CAPABILITIES=1
```

GroupChat live execution is gated behind `AIOS_EXECUTE_LIVE=1`. Without it, `aios team` falls back to a dry-run preview of the dispatch plan.

## Common Command Reference

```bash
# Start a team (dry-run preview by default)
aios team 3:codex "Ship X"

# Start a team with live GroupChat execution
AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT=codex-cli aios team 3:codex "Ship X"

# Watch current status
aios team status --provider codex --watch

# Recent history
aios team history --provider codex --limit 20

# Failures only
aios team history --provider codex --quality-failed-only

# Current session HUD
aios hud --provider codex

# Retry blocked jobs
aios team --resume <session-id> --retry-blocked --provider codex --workers 2

# Orchestrate with GroupChat runtime (full round-based execution)
AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT=codex-cli \
  aios orchestrate bugfix --task "Fix X" --execute live --preflight none
```

## Advanced Operations Reference

The commands below are useful after you are comfortable with the beginner flow.

### HUD presets

| Preset | Use case |
|---|---|
| `minimal` | Long watch sessions |
| `compact` | Terminal-friendly summaries |
| `focused` | Balanced default |
| `full` | Full diagnostics |

### Skill candidates

Skill candidates are improvement suggestions extracted from failed sessions. Review them during failure analysis, not as the first onboarding step.

```bash
aios team status --show-skill-candidates
aios team skill-candidates list --session <session-id>
aios team skill-candidates export --session <session-id> --output ./candidate.patch.md
```

Review patches manually before applying them, especially suggestions that change skills, hooks, or MCP configuration.


## Related Docs

- [Find Commands By Scenario](use-cases.md)
- [HUD Guide](hud-guide.md)
- [Skill Candidates](skill-candidates.md)
- [Route & Concurrency Profiles](route-concurrency-profiles.md)
- [Troubleshooting](troubleshooting.md)
