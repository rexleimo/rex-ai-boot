# AIOS Shell RL Phase 2 Design

Date: 2026-03-22

## Summary

Phase 2 advances the shell RL experiment from a single-step synthetic proof-of-concept into a multi-step real-environment training and evaluation system.

The phase is intentionally split into three gated sub-phases:

1. `2A`: replace the v1 single-step synthetic runtime with a real multi-step episode loop driven by real `read / run / patch / stop` execution and real terminal verification.
2. `2B`: run the same multi-step runtime against real `aios` repository tasks in shadow-eval mode using isolated temporary worktrees, without allowing those tasks to drive online updates.
3. `2C`: mix high-quality synthetic trajectories and real shadow-eval trajectories into an offline replay pool, with higher priority for qualified real trajectories, and prove that replay improves later training.

Phase 2 is successful only if:

- `2A` is measurably stronger than v1 on held-out synthetic tasks,
- `2B` shows repeatable repair behavior on real `aios` tasks under multiple seeds and attempts,
- `2C` demonstrates that replay built from synthetic and real trajectories improves training outcomes beyond `2A` alone.

## Problem

V1 established the minimal shell RL loop, but it still stops short of the behavior required for a useful self-improving system:

- episodes are effectively single-step,
- the orchestrator still synthesizes parts of the episode outcome instead of deriving everything from a real multi-step environment loop,
- real repository tasks are not yet part of the evaluation story,
- replay is not yet using high-value real trajectories,
- the system cannot yet show that training improvements survive contact with the real `aios` repository.

Phase 2 exists to remove those remaining "demo" layers in a controlled order.

## Goals

1. Upgrade the shell RL runtime from single-step episodes to real multi-step episodes.
2. Keep the student action space fixed at `read / run / patch / stop` while making the environment fully real.
3. Preserve episode-level teacher critique, reference solution, and shaping, but defer step-level teacher intervention.
4. Introduce real `aios` repository tasks through isolated shadow evaluation before allowing them to influence training.
5. Build a replay pool that combines synthetic trajectories and real shadow-eval trajectories, with real trajectories prioritized only after quality gating.
6. Prove gains in three layers: synthetic superiority, repeatable real-task shadow repair, and replay-driven training improvement.

## Non-Goals

1. Expanding the action space beyond `read / run / patch / stop` in Phase 2.
2. Moving browser RL or orchestrator-policy RL into the same phase.
3. Allowing real repository tasks to drive online PPO updates in `2B`.
4. Step-level teacher shaping or step-level teacher reference targets.
5. Switching to external ML frameworks or distributed training.
6. Training hosted teacher weights or depending on teacher logits.

## Phase 2 Boundary

Phase 2 answers one layered question:

Can the shell RL experiment become a real multi-step environment learner, prove value on real `aios` repository tasks through shadow evaluation, and then use those real trajectories to improve later training through offline replay?

Everything in the phase serves that question. Any broader RL expansion remains out of scope.

## Sub-Phase Structure

### 2A: Multi-Step Real Rollout on Synthetic Tasks

`2A` removes the two largest remaining v1 shortcuts:

- single-step episodes,
- synthetic observation and reward generation inside the orchestrator.

In `2A`, every episode:

1. loads a synthetic benchmark task,
2. creates an isolated temporary workspace,
3. replays baseline verification before the student acts,
4. enters a multi-step action loop,
5. records real observations from the temp runner after every action,
6. exits only on explicit stop, pass, budget exhaustion, timeout, or repeated no-progress,
7. computes terminal reward only from the real final verification result,
8. calls the teacher once at the end of the episode,
9. updates the student from the full trajectory.

`2A` still trains only on synthetic tasks, but the runtime must be fully real.

### 2B: Real `aios` Repository Shadow Evaluation

`2B` introduces real repository tasks without letting them drive online updates.

The real task pool is defined by this priority order:

1. currently failing `aios` tasks with stable reproduction and objective verification,
2. historical replayable failures when current failures are too sparse.

The first real task classes are:

- failing test repair,
- typecheck repair,
- build repair.

Every real task episode runs in an isolated temporary git worktree by default and must never mutate the main working tree. A plain temporary directory is allowed only for replayable historical tasks that cannot be cleanly expressed as a worktree-backed checkout.

Real tasks in `2B` are used for:

- shadow evaluation,
- full trajectory capture,
- replay candidacy screening.

Real tasks in `2B` are not used for:

- direct online PPO updates,
- mainline workspace edits,
- success claims from single lucky repairs.

### 2C: Mixed Offline Replay With Real-Trajectory Priority

`2C` allows qualified real shadow-eval trajectories to enter replay.

The replay pool is split into:

- `synthetic_pool`,
- `real_shadow_pool`.

Real trajectories are prioritized only if they pass quality gates. Priority does not mean unconditional dominance. Synthetic trajectories remain necessary for coverage and stability.

`2C` must prove that:

- replay built from synthetic plus qualified real trajectories outperforms synthetic-only training,
- real-priority replay does not destabilize training,
- the gain is reproducible across seeds.

## Scope

In scope:

- real multi-step shell RL episodes,
- episode stop conditions and no-progress handling,
- per-step real observation traces,
- synthetic and real task pool separation,
- isolated real-task shadow execution,
- replay pool quality gating and mixed sampling,
- three-stage acceptance for `2A`, `2B`, and `2C`.

Out of scope:

- browser environments,
- orchestrator routing environments,
- human-reviewed real-task patch landing in the same phase,
- direct online training on real repository tasks,
- teacher ensembles inside a single run,
- action-space expansion in `2A`.

## Core Architecture

Phase 2 keeps the v1 units but changes their responsibilities substantially.

### 1. `rl-student-runner`

V1 behavior:

- emits one action per episode.

Phase 2 behavior:

- emits the next action for a live multi-step episode,
- reads the latest observation trace and recent task context,
- supports repeated-observation compression and bounded prompt windows,
- returns one action plus token ids and logprobs for that step.

Contract:

- one valid JSON action per decision step,
- no action types beyond `read / run / patch / stop`,
- deterministic evaluation mode remains available.

### 2. `rl-temp-runner`

V1 behavior:

- provides real execution for isolated single-step tests.

Phase 2 behavior:

- becomes the authoritative episode environment,
- tracks step budgets, wall-clock budgets, and repeated no-progress,
- emits every real observation event,
- records the canonical final verification result,
- supports synthetic task workspaces and real-task temporary worktrees.

Contract:

- no episode may execute outside its isolated workspace,
- unsafe commands remain rejected,
- real observations are the only source of environment truth.

### 3. `rl-run-orchestrator`

V1 behavior:

- stitches together a short synthetic episode with partially synthesized outcome handling.

Phase 2 behavior:

- owns the full multi-step episode loop,
- performs baseline replay before the student acts,
- alternates student action generation and temp-runner execution,
- enforces stop conditions,
- triggers final verification,
- calls the teacher once per episode,
- writes full trajectories,
- invokes training or shadow-eval-only handling depending on the task source.

Contract:

- the orchestrator does not invent environment results,
- the orchestrator must preserve the distinction between synthetic training episodes and real shadow-eval episodes,
- task-source metadata is carried through the entire episode record.

### 4. `rl-trajectory-store`

Phase 2 extensions:

- persist full multi-step traces rather than near-single-step traces,
- record stop condition, no-progress evidence, final verification evidence, and per-step runtime artifacts,
- keep synthetic and real-task trajectory pools logically separate even if they share layout conventions.

### 5. `rl-teacher-gateway`

Phase 2 behavior remains episode-level:

- one teacher call after the episode completes,
- full trace, final diff, and final verification are included,
- output remains `critique`, `reference_solution`, `shaping_score`, `confidence`, `backend_used`, and `call_status`.

Phase 2 does not add step-level teacher interventions.

### 6. `rl-reward-fusion`

Phase 2 keeps the v1 reward design:

- terminal environment reward remains authoritative,
- teacher shaping remains bounded and advisory,
- reward sign cannot be inverted by teacher shaping.

The difference is that terminal reward is now derived from a real multi-step trajectory rather than a thin synthetic wrapper.

### 7. `rl-trainer`

Phase 2 behavior:

- consumes full multi-step trajectories,
- computes PPO updates over the episode token stream,
- preserves episode-level distillation and KL behavior,
- records per-episode and per-run training metrics that can be compared against v1.

### 8. `rl-eval-harness`

Phase 2 behavior:

- compares v1 and `2A` directly on held-out synthetic tasks,
- evaluates real repository tasks in shadow mode without weight mutation,
- computes replay ablations for `2C`,
- reports both primary success metrics and process metrics such as invalid-step ratio and no-progress stop rate.

## Phase 2A Episode Model

### Episode Flow

Each `2A` episode follows this sequence:

1. select a synthetic task,
2. create an isolated workspace,
3. reproduce baseline failing verification,
4. enter a step loop:
   - build student context from the trace,
   - emit one action,
   - execute it in the temp runner,
   - append the real observation,
5. exit on a defined stop condition,
6. run canonical final verification,
7. compute terminal reward,
8. call the teacher,
9. persist the full trajectory,
10. update the trainer from the full episode.

### Stop Conditions

The phase-standard stop conditions are:

- `student_stop`,
- `verification_passed`,
- `max_steps_reached`,
- `episode_timeout`,
- `unsafe_runner_state`,
- `repeated_no_progress`.

`repeated_no_progress` means the recent action window has produced no meaningful state change, for example:

- repeated identical commands,
- repeated failed patch applications,
- repeated observations with no new actionable information.

### 2A Success Criteria

`2A` is accepted only if all of the following are true:

- held-out synthetic success rate is repeatably higher than v1,
- regression-free fix rate does not decline,
- invalid-step ratio declines relative to the untrained multi-step `2A` runtime baseline,
- repeated-no-progress termination declines relative to the untrained multi-step `2A` runtime baseline,
- at least two of three seeds outperform v1,
- gains are not explained only by a large increase in token cost or step count.

## Phase 2B Real Task Design

### Real Task Admission Gates

A real task is eligible for shadow evaluation only if:

- it has a canonical verification command,
- the baseline failure is reproducible,
- the failure is stable across repeated baseline checks,
- the task can run in an isolated worktree without special human-only state,
- the verification signal is objective.

The initial real task types are:

- failing test repair,
- typecheck repair,
- build repair.

### Real Task Execution Model

Every real task episode:

- uses a temporary git worktree or, for approved historical replay cases only, an equivalent isolated workspace,
- starts from a clean repository state,
- never writes to the main working tree,
- records the full diff, trace, and verification evidence,
- is evaluated across multiple seeds and attempts.

### Stability Requirement

A real task is considered stably repairable only if it is repaired repeatedly across multiple seeds and attempts. One-off success is not enough.

### 2B Success Criteria

`2B` is accepted only if:

- there is a stable real task pool with at least `3` admitted reproducible tasks for the acceptance campaign, or the phase explicitly records `limited-pool` status when fewer than `3` such tasks currently exist in the repository,
- the main working tree remains untouched throughout shadow evaluation,
- at least some tasks are repaired repeatedly across multiple seeds and attempts,
- the resulting trajectories are audit-ready and replay-ready.

## Phase 2C Replay Design

### Replay Pools

`2C` defines two replay pools:

- `synthetic_pool` from `2A`,
- `real_shadow_pool` from `2B`.

### Real-Trajectory Priority Rules

Real trajectories may receive higher replay priority only if they pass quality gates:

- baseline reproduced,
- final verification trustworthy,
- no unsafe runner state,
- no obvious environment contamination,
- no reward-hacking signature,
- trajectory and diff are interpretable.

Unqualified real trajectories are stored for analysis but not prioritized into replay.

### Sampling Policy

The initial replay policy is intentionally simple:

- every replay batch mixes synthetic and real trajectories,
- real trajectories receive the higher share,
- synthetic trajectories remain present for coverage and stability.

The initial target mix is:

- `60%` qualified real trajectories,
- `40%` synthetic trajectories,

with one exception:

- if the qualified real pool is too small to sustain that share without heavy duplication, the batch falls back toward synthetic until replay duplication returns below the configured threshold.

The phase does not begin with adaptive or learned replay scheduling.

### 2C Success Criteria

`2C` is accepted only if:

- mixed replay outperforms `2A`-only training,
- replay built from qualified real trajectories improves outcomes more than synthetic-only replay,
- the improvement remains stable across multiple seeds,
- there is no clear evidence of overfitting to the sparse real task pool.

## Data Model Changes

Phase 2 expands the episode model with:

- ordered step traces rather than effectively single-step traces,
- explicit stop condition,
- no-progress counters or evidence,
- task source classification: `synthetic` or `real_shadow`,
- replay eligibility and replay quality labels,
- repeated-attempt identity for real tasks.

Real task manifests must add:

- task source metadata,
- repository target scope,
- admission-gate state,
- baseline reproducibility metadata.

Replay metadata must add:

- pool identity,
- quality gate result,
- replay priority,
- source phase provenance (`2A`, `2B`, `2C`).

## Evaluation Model

Phase 2 evaluation is layered and cannot be collapsed into a single score.

### Primary Metrics

- held-out synthetic success rate,
- regression-free fix rate,
- real-task repeated repair rate,
- replay-driven post-training improvement.

### Process Metrics

- average step count,
- invalid-step ratio,
- repeated-no-progress stop rate,
- average token count,
- average runtime duration,
- teacher backend hit rate,
- fallback rate,
- teacher latency,
- policy loss,
- distillation loss,
- KL loss.

### Negative Monitoring Metrics

- reward hacking rate,
- degenerate action rate,
- unsafe-command rejection regressions,
- real-task contamination events,
- replay overfitting signals.

## Risks And Controls

### Risk 1: Multi-step rollout increases noise and instability

Control:

- keep the action space fixed,
- enforce stop conditions tightly,
- preserve bounded context windows,
- compare against v1 and untrained multi-step baselines.

### Risk 2: Real repository tasks are too sparse or unstable

Control:

- prefer current failures,
- fall back to historical replayable failures when current failures are insufficient,
- use strict admission gates,
- do not treat sparse real data as online training input in `2B`.

### Risk 3: Replay pool is polluted by low-quality real trajectories

Control:

- gate replay eligibility,
- keep real and synthetic pools separate,
- record replay provenance and priority explicitly,
- require `2C` ablations against `2A`-only training.

### Risk 4: Main working tree contamination

Control:

- require temporary worktrees or isolated directories for every real-task episode,
- preserve diff-based auditability,
- treat any main-worktree mutation as a phase blocker.

### Risk 5: Teacher cost and latency grow with longer episodes

Control:

- keep teacher evaluation at episode granularity only,
- avoid step-level teacher calls in Phase 2,
- persist enough evidence to debug teacher failures without rerunning the entire task pool.

## Delivery Order

Phase 2 must be delivered strictly in this order:

1. `2A`: multi-step real rollout on synthetic tasks,
2. `2B`: real-task shadow evaluation,
3. `2C`: mixed offline replay with real-sample priority.

Each sub-phase requires:

1. a written plan,
2. an isolated implementation cycle,
3. a phase-specific verification report,
4. explicit acceptance before the next sub-phase starts.

## Decision Summary

The user-approved Phase 2 decisions are:

- use the real-environment-first layered route,
- keep the shell action space fixed at `read / run / patch / stop`,
- go directly to real `aios` repository shadow evaluation after `2A`,
- prioritize current real failures first, then use historical replayable failures if needed,
- restrict real tasks to shadow evaluation plus trajectory capture before replay admission,
- run all real tasks in temporary worktrees or equivalent isolated workspaces,
- keep teacher intervention at episode level,
- require repeated repair across multiple seeds and attempts for real-task success,
- prioritize real replay samples only after quality gating,
- accept `2A`, `2B`, and `2C` sequentially.
