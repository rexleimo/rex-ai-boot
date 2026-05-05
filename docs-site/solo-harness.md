---
title: Solo Harness
description: Run one coding agent overnight with ContextDB memory, run journals, resume and stop controls, and optional git worktree isolation.
---

# Solo Harness

Solo Harness is the single-agent lane for long-running work in RexCLI.

Use it when one provider should keep pushing on one objective overnight, while you keep a readable run journal, explicit stop/resume controls, and optional git worktree isolation.

## When To Use Solo Harness

Good fit:

- One clear objective, such as “draft tomorrow handoff” or “finish the release checklist”.
- The task is not worth splitting into multiple parallel workers.
- You want a resumable operator loop instead of a one-shot command.
- You want overnight changes isolated from the main checkout.
- You want optional lifecycle hook evidence (`--hooks` / `--no-hooks`) for each run.

Not a good fit:

- The work should be split across independent modules -> use [Agent Team](team-ops.md).
- You need a staged DAG with preflight gates -> use `aios orchestrate ...`.
- The requirement is still unclear -> start with normal interactive `codex` or `claude` first.

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

## Dry-Run First

If you want to verify the artifact contract before spending tokens, start with dry-run:

```bash
aios harness run --objective "Draft tomorrow handoff" --session nightly-demo --worktree --dry-run --json
```

Dry-run creates the session journal but does not invoke the provider.

## Hook Controls

`run` and `resume` accept explicit hook toggles:

```bash
aios harness run --objective "Draft tomorrow handoff" --session nightly-demo --hooks
aios harness resume --session nightly-demo --no-hooks
```

- Default is `--hooks` (enabled), which records lifecycle hook evidence.
- Use `--no-hooks` when you want a lower-noise run without hook traces.

## What Solo Harness Writes

Artifacts live under:

```text
memory/context-db/sessions/<session-id>/artifacts/solo-harness/
```

Main files:

- `objective.md` - normalized objective stored with the session.
- `run-summary.json` - current state, iteration counters, backoff state, and worktree metadata.
- `control.json` - stop requests and operator notes.
- `hook-events.jsonl` - lifecycle hook evidence (when hooks are enabled).
- `iteration-0001.json` - normalized per-iteration outcome.
- `iteration-0001.log.jsonl` - raw iteration log stream for debugging.

## Operator Loop

A practical overnight loop looks like this:

1. Start with `aios harness run --worktree`.
2. Check `aios harness status --session <id> --json` before leaving it alone.
3. Use `aios hud --session <id>` when you want a human-readable session snapshot.
4. Use `aios harness stop --session <id>` when you want the run to stop at the next safe boundary.
5. Use `aios harness resume --session <id>` the next morning or after a manual fix.

## Worktree Behavior

`--worktree` is recommended for overnight runs.

It creates an isolated git worktree for the harness session so the agent does not mutate your main checkout directly. If the run produces no meaningful output, the temporary worktree can be cleaned up automatically. If it produces useful changes, the worktree metadata is preserved in the run summary for operator review.

RexCLI does **not** rely on blanket recovery like `git reset --hard` for this workflow.

## Provider And Runtime Notes

Live execution reuses the existing one-shot `scripts/ctx-agent.mjs` provider path.

That means the matching local CLI still needs to exist and be runnable:

- `codex`
- `claude`
- `gemini`
- `opencode`

If the provider CLI is missing, use dry-run first and fix provider readiness before starting a live overnight run.

## Solo Harness vs Agent Team

| Need | Better fit |
|---|---|
| One objective, one provider, resumable overnight execution | `aios harness ...` |
| Parallel workers on a splittable task | `aios team ...` |
| Staged orchestration with preflight gates | `aios orchestrate ...` |

## Related Docs

- [HUD Guide](hud-guide.md)
- [Agent Team](team-ops.md)
- [Find Commands By Scenario](use-cases.md)
- [Troubleshooting](troubleshooting.md)
