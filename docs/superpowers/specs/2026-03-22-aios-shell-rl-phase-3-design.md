# AIOS Shell RL Phase 3 Design

Date: 2026-03-22

## Summary

Phase 3 upgrades the shell RL experiment from "real-task shadow evaluation plus offline replay" into controlled real-repository online RL.

The phase keeps the Phase 2 multi-step runtime and teacher interface, but changes the training boundary:

1. real `aios` repository tasks can now drive online student updates,
2. updates happen in micro-batches of `4` real trajectories,
3. the updated checkpoint takes over the next real tasks immediately,
4. the system continuously compares the updated checkpoint against the checkpoint that existed immediately before the update,
5. continuous relative degradation triggers automatic rollback,
6. rollback-causing trajectories are preserved as negative replay assets rather than discarded.

Phase 3 is successful only if real-task online updates produce a net positive effect on matched real-task outcomes while automatic rollback prevents sustained degradation.

## Problem

Phase 2 proved three things:

- the shell RL runtime can operate as a real multi-step environment learner,
- real `aios` tasks can be evaluated safely in isolated worktrees,
- qualified real trajectories can improve later training through offline replay.

What Phase 2 still does not prove is whether the system can learn online from real repository work without human gating between updates.

Phase 3 exists to answer that question directly:

Can real `aios` repository tasks train the student online, with immediate checkpoint promotion, while automatic rollback keeps the system from drifting into sustained regression?

## Goals

1. Allow real `aios` repository tasks to drive online student updates.
2. Keep all real task execution isolated to temporary git worktrees.
3. Preserve multi-step `read / patch / run / stop` trajectories for every real task episode.
4. Require teacher `critique + reference + shaping` on every real trajectory.
5. Update the student only after accumulating `4` real trajectories into a live batch.
6. Promote the updated checkpoint immediately to active status for subsequent real tasks.
7. Detect relative degradation by comparing new real-task performance against the checkpoint that existed immediately before the update.
8. Roll back automatically after `3` consecutive relative degradations.
9. Preserve rollback-causing batches as negative replay evidence for later offline correction.

## Non-Goals

1. Introducing browser RL or orchestrator-policy RL in the same phase.
2. Expanding the shell action space beyond `read / patch / run / stop`.
3. Allowing direct edits to the main working tree.
4. Adding a human approval gate before newly updated checkpoints become active.
5. Replacing real terminal verification with teacher judgement.
6. Training hosted teacher models or depending on teacher logits.
7. Changing the existing teacher backend selection policy established in earlier phases.

## Phase 3 Boundary

Phase 3 covers only three classes of real repository tasks:

- failing test repair,
- typecheck repair,
- build repair.

Every real task episode must:

1. run in an isolated temporary git worktree,
2. record a full multi-step trajectory,
3. perform objective terminal verification,
4. invoke the teacher once at the episode boundary,
5. enter either the online update path, the replay path, or both.

Phase 3 does not yet attempt to generalize beyond these task classes.

## Core Decisions

The following design decisions are fixed for Phase 3:

1. Real trajectories are allowed to drive online RL updates.
2. Online updates happen after every `4` admitted real trajectories.
3. The new checkpoint takes over immediately after the update.
4. Rollback is automatic rather than human-triggered.
5. Rollback is triggered by `3` consecutive relative degradations.
6. Relative degradation is measured against the checkpoint that existed immediately before the latest online update.
7. Every real trajectory receives episode-level teacher `critique + reference + shaping`.
8. Rollback-causing trajectories are retained in offline replay as negative evidence.

## Core Architecture

Phase 3 adds five control-layer units on top of the Phase 2 runtime.

### 1. `active-checkpoint-registry`

Maintains three checkpoint pointers:

- `active_checkpoint_id`: the student currently serving real tasks,
- `pre_update_ref_checkpoint_id`: the checkpoint captured immediately before the latest online update,
- `last_stable_checkpoint_id`: the most recent checkpoint that did not require rollback.

Responsibilities:

- publish the active checkpoint for new real tasks,
- freeze the comparison baseline before each online update,
- restore the correct checkpoint on rollback,
- write checkpoint lineage metadata into every real trajectory and live batch.

### 2. `live-batch-buffer`

Collects admitted real trajectories until the batch reaches size `4`.

Responsibilities:

- store full real-task episode records,
- reject incomplete or invalid trajectories from the live update path,
- seal the batch deterministically once `4` admitted trajectories are present,
- carry batch metadata into online training and rollback diagnostics.

Each admitted trajectory in the live batch must include:

- task family,
- target repository snapshot metadata,
- full step trace,
- terminal verification result,
- teacher outputs,
- active checkpoint id,
- future comparison linkage fields.

### Live-Batch Admission Rules

A real trajectory is admitted to the live update path only if all of the following are true:

- the task definition is reproducible,
- the episode completed terminal verification,
- the trajectory structure is valid and parseable,
- worktree isolation succeeded without main-workspace contamination,
- required teacher outputs are present.

If any of these checks fail, the trajectory is still persisted, but it is excluded from the live batch and marked with a non-admitted `admission_status`.

### 3. `online-update-engine`

Performs one online PPO update cycle from a sealed live batch.

Responsibilities:

- copy the current active checkpoint into `pre_update_ref_checkpoint_id`,
- update the student using only the `4` admitted real trajectories in the live batch,
- publish the new checkpoint as active immediately after the update,
- persist update metadata needed for later matched comparison and rollback analysis.

This unit may reuse the Phase 2 trainer internals, but the update trigger and checkpoint promotion semantics change in Phase 3.

### 4. `degradation-monitor`

Computes relative outcome comparisons between the current active checkpoint and `pre_update_ref_checkpoint_id`.

Responsibilities:

- run matched shadow comparisons for each real task handled by the active checkpoint,
- classify the outcome as `better`, `same`, or `worse`,
- maintain the current consecutive-degradation streak,
- emit a rollback signal when the streak reaches `3`.

The degradation monitor is the only component allowed to decide whether a rollback is necessary.

### 5. `rollback-and-replay-sink`

Handles rollback and preserves the evidence that caused it.

Responsibilities:

- restore `active_checkpoint_id <- pre_update_ref_checkpoint_id`,
- mark the triggering live batch and its trajectories with rollback metadata,
- route rollback-causing trajectories into the negative replay lane,
- write a rollback diagnosis artifact describing why the rollback happened.

Rollback removes the bad promotion from active service, but it never deletes the underlying trajectories.

## State Machine

Phase 3 runs the following checkpoint lifecycle:

1. `stable-active`
   The current active checkpoint serves real tasks.
2. `collecting-live-batch`
   Real trajectories are collected until `4` admitted trajectories are available.
3. `online-update`
   The live batch triggers one online PPO update and captures `pre_update_ref_checkpoint_id`.
4. `active-post-update`
   The newly updated checkpoint immediately serves the next real tasks.
5. `degradation-tracking`
   The system runs matched comparisons between the post-update active checkpoint and `pre_update_ref_checkpoint_id`.
6. `rollback`
   If `3` consecutive relative degradations occur, the system restores `pre_update_ref_checkpoint_id` as active and preserves the failed batch for replay and diagnosis.

The state machine is fully automatic. Phase 3 introduces no manual approval gate between update and promotion.

## Real Task Episode Flow

Each real repository episode follows the same end-to-end flow:

1. select a real task from the active real-task pool,
2. create an isolated temporary git worktree for that task,
3. record `verification_before`,
4. execute the multi-step student loop using `read / patch / run / stop`,
5. record the full step trace and all runtime artifacts,
6. run objective terminal verification for the task family,
7. invoke the teacher once for episode-level `critique + reference + shaping`,
8. write the trajectory to the trajectory store,
9. admit or reject the trajectory for live-batch collection,
10. once `4` admitted trajectories are present, trigger an online update,
11. after promotion, compare future active-task performance against `pre_update_ref_checkpoint_id`,
12. if the degradation streak reaches `3`, roll back automatically.

No episode may execute outside its temporary worktree. No Phase 3 success claim is valid without terminal verification evidence.

## Relative Degradation Model

Relative degradation is measured by matched comparison, not by absolute failure alone.

For every real task served after an online update:

1. the active checkpoint runs the task in its normal temporary worktree,
2. the system then runs `pre_update_ref_checkpoint_id` against the same task in a separate comparison worktree,
3. both runs are evaluated against the same task-family verification target,
4. the degradation monitor compares the two results and assigns one of:
   - `better`
   - `same`
   - `worse`

### Primary Comparison Rules

Primary comparison is task-family specific and always takes priority over step-count heuristics.

For `failing_tests`:

- fewer unresolved target failures is better,
- fewer newly introduced failures is better,
- introducing more regressions than `pre_update_ref_checkpoint_id` is worse.

For `typecheck`:

- `pass` beats `fail`,
- if both fail, lower normalized error count is better,
- if counts are unavailable, stable parseable terminal summaries must be used instead.

For `build`:

- `pass` beats `fail`,
- if both fail, lower normalized error count or fewer blocking build-stage failures is better.

### Secondary Comparison Rules

Secondary rules are used only when primary task-family outcomes tie:

- fewer no-progress steps is better,
- fewer unrelated file modifications is better,
- shorter convergence path is better.

Secondary rules may upgrade `same` to `better`, but they may not override a primary `worse` classification.

### Rollback Trigger

- `worse` increments the degradation streak by `1`,
- `better` resets the streak,
- `same` leaves the streak unchanged,
- `3` consecutive `worse` outcomes trigger automatic rollback.

The rollback comparison baseline remains fixed to `pre_update_ref_checkpoint_id` for the entire post-update monitoring window. It does not drift with each task.

## Teacher Integration

Every real trajectory receives teacher processing once per episode.

Teacher outputs remain episode-level:

- `teacher_critique`,
- `teacher_reference`,
- `teacher_shaping`,
- teacher metadata such as backend id, fallback status, and latency.

Teacher outputs are used for:

- online update inputs,
- replay enrichment,
- rollback diagnosis,
- later offline correction and analysis.

Teacher outputs do not replace real terminal verification, and teacher judgement alone can never suppress a rollback that is justified by matched real-task comparison.

## Real Trajectory Schema

Phase 3 real trajectories must be persisted as full episode records. At minimum, each record contains:

- `trajectory_id`
- `task_id`
- `task_family`
- `repo_target`
- `repo_commit`
- `worktree_path`
- `student_checkpoint_id`
- `pre_update_ref_checkpoint_id`
- `teacher_backend`
- `teacher_fallback_backend`
- `trajectory_steps`
- `files_read`
- `files_modified`
- `patch_summary`
- `verification_before`
- `verification_after`
- `teacher_critique`
- `teacher_reference`
- `teacher_shaping`
- `terminal_result`
- `relative_outcome`
- `batch_id`
- `rollback_batch`
- `admission_status`
- `admission_reason`

The schema must allow downstream consumers to answer all of the following:

- what task was attempted,
- which checkpoint attempted it,
- what the student actually did,
- what verification proved,
- what the teacher said,
- whether the trajectory was admitted to online update,
- whether the trajectory later contributed to rollback.

## Replay Lanes

Phase 3 keeps real trajectories available for offline replay, but splits them into three explicit lanes.

### 1. `positive lane`

Contains trajectories that are clearly better than `pre_update_ref_checkpoint_id`.

Purpose:

- prioritize reuse of strong real-task evidence,
- reinforce successful real behavior patterns.

### 2. `neutral lane`

Contains trajectories whose primary outcome ties the comparison baseline and whose verification is clean.

Purpose:

- stabilize replay distribution,
- preserve realistic but non-improving traces for analysis and later sampling.

### 3. `negative lane`

Contains relative degradations, especially trajectories from rollback-causing live batches.

Purpose:

- preserve failure patterns,
- support later correction replay,
- serve as rollback diagnosis evidence,
- prevent loss of high-value negative examples.

### Replay Admission

Not every real trajectory automatically becomes replay training data.

All trajectories first enter the trajectory store, then pass replay-lane assignment based on:

- complete terminal verification,
- complete teacher outputs,
- reproducible task definition,
- valid trajectory structure,
- rollback metadata when applicable.

This separation prevents low-quality online traces from contaminating later replay training.

## Failure Handling

Phase 3 must handle the following failure classes explicitly:

### 1. Real task execution failure

Examples:

- command timeout,
- malformed patch,
- rejected unsafe command,
- toolchain crash.

Handling:

- record the full trajectory as failed,
- keep terminal verification evidence,
- still run teacher episode processing when possible,
- mark admission status appropriately.

### 2. Teacher failure

Examples:

- primary backend unavailable,
- fallback backend unavailable,
- malformed teacher output.

Handling:

- preserve the real trajectory,
- mark teacher call status and fallback behavior,
- allow trajectory persistence even if teacher output is incomplete,
- do not silently fabricate teacher fields,
- reject the trajectory from online-update admission if required fields are missing.

### 3. Online update failure

Examples:

- trainer numerical instability,
- checkpoint write failure,
- corrupted live batch.

Handling:

- leave `active_checkpoint_id` unchanged,
- preserve the failed live batch as a diagnostic artifact,
- do not partially promote a broken checkpoint,
- emit a run-level error artifact.

### 4. Comparison-run failure

Examples:

- `pre_update_ref_checkpoint_id` cannot complete the matched shadow run,
- comparison worktree setup fails.

Handling:

- record comparison failure explicitly,
- do not classify the outcome as `better`,
- allow exactly one immediate clean rerun in a fresh comparison worktree,
- if the rerun also fails, classify the result as `comparison_failed`,
- exclude `comparison_failed` from degradation streak mutation.

### 5. Rollback failure

Examples:

- checkpoint restore failure,
- rollback artifact write failure.

Handling:

- escalate immediately as a critical run failure,
- freeze further online updates,
- preserve all currently known batch and trajectory evidence for manual diagnosis.

## Metrics and Success Criteria

Phase 3 is successful only if all of the following are true over a repeated evaluation campaign:

1. post-update active checkpoints show a net-positive `better / same / worse` distribution against `pre_update_ref_checkpoint_id`,
2. automatic rollback prevents sustained regression and recovers service after bad updates,
3. no main-workspace contamination occurs,
4. replay lanes remain populated with valid, reusable real trajectories,
5. teacher shaping remains directionally aligned with real terminal verification often enough to be operationally useful.

### Required Monitoring Metrics

- number of real tasks served per checkpoint
- live batch count
- online update count
- `better / same / worse` counts
- current and historical degradation streaks
- rollback count
- rollback recovery latency
- task-family verification pass rates
- teacher backend and fallback rates
- replay-lane population counts
- rollback-batch reuse counts in later offline replay

### Acceptance Conditions

Phase 3 should be considered ready for implementation planning only if the design can support all of the following:

1. no direct main-workspace mutation path,
2. deterministic live-batch boundary at `4` admitted trajectories,
3. deterministic rollback trigger at `3` consecutive relative degradations,
4. explicit preservation of rollback-causing trajectories,
5. checkpoint lineage sufficient to reconstruct any promotion and rollback decision.

## Out-of-Scope Follow-Ons

The following may become later phases, but are intentionally excluded from Phase 3:

- human-reviewed patch landing into the main workspace,
- browser-environment online RL,
- orchestrator-policy online RL,
- step-level teacher intervention during the episode,
- multi-teacher ensemble scoring inside a single real-task run,
- changing checkpoint promotion to a gated or canary model.
