---
title: Agent Team
description: When to use Agent Team, how to start, monitor, finish, and when not to use it.
---

# Agent Team

Agent Team is not “more agents is always better”. It is for tasks that are **splittable, clearly bounded, and safe to run in parallel**.

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

## Common Command Reference

```bash
# Start a team
aios team 3:codex "Ship X"

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
