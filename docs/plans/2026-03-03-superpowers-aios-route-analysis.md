# Superpowers -> AIOS Route Analysis

## Scope
Analyze `https://github.com/obra/superpowers` and map its workflow into `aios` so future tasks default to:
- plan-first routing,
- long-running checkpointed execution,
- conditional parallel subagent dispatch.

## What Was Analyzed
- Clone target: `/tmp/obra-superpowers`
- Key files reviewed:
  - `README.md`
  - `docs/README.codex.md`
  - `.codex/INSTALL.md`
  - `skills/using-superpowers/SKILL.md`
  - `skills/writing-plans/SKILL.md`
  - `skills/subagent-driven-development/SKILL.md`
  - `skills/dispatching-parallel-agents/SKILL.md`
  - `hooks/session-start`
  - `lib/skills-core.js`

## Key Mechanisms in Superpowers
1. Process-first execution
   - Before coding, route through process skills (`brainstorming`, `writing-plans`, `systematic-debugging`).
2. Explicit plan artifacts
   - Plans are persisted in `docs/plans/*` and then executed.
3. Strong execution discipline
   - TDD and verification gates are modeled as mandatory workflow constraints.
4. Parallel dispatch policy
   - Use parallel subagents only when tasks are independent and non-interfering.
5. Session-level enforcement
   - Session startup injects skill-usage constraints (`using-superpowers`) to reduce ad-hoc execution.

## AIOS Mapping
AIOS already has two compatible primitives:
- Long-task stability: `aios-long-running-harness`
- Persistent state: ContextDB (`init -> session -> event -> checkpoint -> context:pack`)

Mapped route for AIOS:
1. Process routing via superpowers skill selection.
2. Plan artifact creation in `docs/plans`.
3. Harness controls (objective, budget, evidence, retry class).
4. ContextDB checkpoint persistence at each major transition.
5. Conditional parallel dispatch:
   - Independent domains -> `superpowers:dispatching-parallel-agents`
   - Coupled domains -> sequential execution
6. Completion verification gate with evidence.

## Runtime Constraint Handling
Some runtimes may not provide true subagent tools. In that case:
- keep the same routing decision model,
- emulate dispatch using explicit per-domain work queues,
- parallelize only safe independent read/check actions,
- merge and verify before completion.

## Repository Changes Applied
- `AGENTS.md`: added required default superpowers route integrated with long-running harness and dispatch policy.
- `CLAUDE.md`: added a default task route section with ContextDB + dispatch decisions.
- `.codex/skills/aios-project-system/SKILL.md`: added superpowers route bridge.
- `.claude/skills/aios-project-system/SKILL.md`: mirrored superpowers route bridge.
- `.codex/skills/aios-long-running-harness/SKILL.md`: added pairing rules with superpowers dispatch/verification.
- `.claude/skills/aios-long-running-harness/SKILL.md`: mirrored pairing rules.

## Outcome
AIOS now has a documented, default "superpowers-like" route that combines:
- planning discipline,
- long-running reliability,
- parallel dispatch strategy with safe fallback when subagents are unavailable.
