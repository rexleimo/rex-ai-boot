# Agent Self-Trigger Harness Iteration Plan

Goal: make AIOS visible to normal `codex` / `claude` / `gemini` / `opencode` usage without requiring users to manually remember `aios` commands, and correct the docs gap for the existing persona/user profile memory layer.

## Current State

- Interactive shell wrappers already inject ContextDB and a conservative auto-route startup prompt.
- The injected route prompt covers `single`, `subagent`, and `team`.
- Solo harness exists (`aios harness run/status/resume/stop`) and writes iteration journals under ContextDB session artifacts.
- Persona/user profile memory exists as global files managed by `aios memo persona ...` and `aios memo user ...`.
- `ctx-agent` injects persona and user profile content into the Memory prelude before workspace memo content.

## Gap

- Long-running / overnight / resumable work is not advertised to the agent as a first-class `harness` route.
- One-shot route shortcuts do not include `/harness <task>`.
- `harness run` has an internal `maxIterations` default but no CLI flag for operators or self-triggering agents to set an explicit iteration budget.
- README/docs mention manual harness commands but do not clearly state that wrapped coding agents can self-trigger AIOS commands.
- Official docs under-documented the existing persona/user profile memory layer, which made it look absent from the iteration even though runtime support already existed.

## Implementation

1. Add `harness` to ctx-agent route mode and explicit prompt shortcuts.
2. Inject a direct `aios harness run ... --worktree --max-iterations N` command into interactive auto prompts for long-running/overnight/resumable objectives.
3. Add `--max-iterations <n>` to `harness run` and `harness resume`, with parsing, runtime propagation, help text, and tests.
4. Update native bootstrap instructions so Codex/Claude/Gemini/OpenCode clients know when to self-trigger AIOS.
5. Update README and official docs in English first, then sync zh/ja/ko pages.
6. Document the existing persona/user profile memory in README, official ContextDB docs, getting-started snippets, use-cases pages, and native bootstrap docs as a 1.7.x patch-line documentation correction, not as a new 1.8.0 runtime feature.
7. Verify with focused tests plus docs build.

## Guardrails

- Keep default route conservative: single first, harness only for explicit long-running/overnight/resumable objectives.
- Do not auto-run harness for ordinary multi-step tasks.
- Preserve privacy guidance and deterministic AIOS checks.
- Treat persona/user profile as stable guidance only; project-specific facts still belong in ContextDB events, checkpoints, or workspace memo.
