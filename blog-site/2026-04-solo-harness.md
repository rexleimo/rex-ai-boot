---
title: "Solo Harness: Let One Agent Work Overnight Without Losing Control"
description: "AIOS 1.7 adds `aios harness` for resumable single-agent runs with run journals, status/stop/resume controls, HUD visibility, and optional worktree isolation."
date: 2026-04-26
tags: ["AIOS", "Solo Harness", "Long-Running Agent", "ContextDB", "Automation"]
---

# Solo Harness: Let One Agent Work Overnight Without Losing Control

Most coding CLIs are great at one tight prompt, but awkward at "keep working on this one objective while I'm asleep." Once you leave the terminal, you usually lose visibility, clean stop control, and the ability to resume without rebuilding context by hand.

With AIOS 1.7, we shipped `aios harness`: a single-agent lane for overnight and other long-running work.

## The Problem With One-Shot CLI Loops

- They work well for short requests, but poorly for unattended objectives.
- After a few hours, it is hard to tell what the agent actually did.
- Stopping often means interrupting bluntly instead of waiting for a safe boundary.
- Restarting usually means rebuilding context and operator intent manually.
- Running inside your main checkout makes it easy to leave behind messy diffs.

## What Ships In `aios harness`

`aios harness` adds a resumable operator loop for one agent working on one objective:

- `run` starts the session and records the objective.
- `status` reports the latest structured state and artifacts.
- `stop` asks the run to halt at the next safe boundary.
- `resume` restarts the same session instead of creating a brand-new run.
- `hud` now auto-detects solo harness sessions and shows the latest summary.
- `--worktree` isolates overnight edits in a disposable git worktree.

## Quick Start

```bash
# Start an overnight run in an isolated worktree
aios harness run --objective "Draft tomorrow handoff" --session nightly-demo --worktree

# Check structured status
aios harness status --session nightly-demo --json

# Monitor the same session in HUD
aios hud --session nightly-demo --json

# Ask the run to stop cleanly
aios harness stop --session nightly-demo --reason "morning handoff"

# Continue later with the same session
aios harness resume --session nightly-demo
```

If you want to confirm the artifact contract before spending tokens, start with dry-run:

```bash
aios harness run --objective "Draft tomorrow handoff" --session nightly-demo --worktree --dry-run --json
```

## What The Run Writes

Every session writes its journal under:

```text
memory/context-db/sessions/<session-id>/artifacts/solo-harness/
```

Main files include:

- `objective.md` - normalized objective saved with the session.
- `run-summary.json` - current state, iteration counters, backoff state, and worktree metadata.
- `control.json` - operator stop requests and notes.
- `iteration-0001.json` - normalized per-iteration outcome.
- `iteration-0001.log.jsonl` - raw iteration log stream for debugging.

That gives you a readable handoff trail instead of a vague "the agent ran for a while" story.

## Why `--worktree` Matters

Overnight runs should not depend on blanket cleanup like `git reset --hard`.

With `--worktree`, AIOS creates an isolated git worktree for the harness session so the agent does not mutate your main checkout directly. If the run produces nothing useful, the temporary worktree can be cleaned up. If it produces valuable changes, the worktree metadata stays attached to the run summary for review and merge.

## Solo Harness vs Agent Team vs Orchestrate

| Need | Better fit |
|---|---|
| One objective, one provider, resumable overnight execution | `aios harness ...` |
| Parallel workers on a task that splits cleanly | `aios team ...` |
| Staged orchestration with preflight gates | `aios orchestrate ...` |

In short: use Solo Harness when the job should stay with one agent, not become a mini project manager.

## Read The Docs

- [Solo Harness docs](https://cli.rexai.top/solo-harness/)
- [HUD Guide](https://cli.rexai.top/hud-guide/)
- [Agent Team guide](https://cli.rexai.top/team-ops/)
- [Use cases](https://cli.rexai.top/use-cases/)
