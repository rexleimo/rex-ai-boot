# AIOS Shell RL Phase 3 Design

Date: 2026-03-22

## Summary

Phase 3 upgrades the shell RL experiment from "real-task shadow evaluation plus offline replay" into controlled real-repository online RL.

The phase keeps the Phase 2 multi-step runtime and teacher interface, but changes the training boundary:

1. real `aios` repository tasks can now drive online student updates,
2. updates happen in micro-batches of `4` real trajectories,
3. the updated checkpoint takes over the next real tasks immediately,
4. the system continuously compares the updated checkpoint against the checkpoint that existed immediately before the update,
5. three `worse` outcomes without an intervening `better` trigger automatic rollback,
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
8. Roll back automatically after `3` `worse` outcomes without an intervening `better`.
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

## Initial State

At Phase 3 startup:

- `active_checkpoint_id` is set to the operator-selected starting student checkpoint,
- `last_stable_checkpoint_id <- active_checkpoint_id`,
- `pre_update_ref_checkpoint_id <- null`,
- `degradation_streak <- 0`,
- the first open epoch is a `collection` epoch under `active_checkpoint_id`.

The initial `collection` epoch gathers the first `4` admitted real trajectories to form the first sealed live batch. Matched comparison begins only after the first successful online update produces a distinct post-update checkpoint and freezes `pre_update_ref_checkpoint_id`.

## Core Decisions

The following design decisions are fixed for Phase 3:

1. Real trajectories are allowed to drive online RL updates.
2. Online updates happen after every `4` admitted real trajectories.
3. The new checkpoint takes over immediately after the update.
4. Rollback is automatic rather than human-triggered.
5. Rollback is triggered by `3` `worse` outcomes without an intervening `better`.
6. Relative degradation is measured against the checkpoint that existed immediately before the latest online update.
7. Every real trajectory receives episode-level teacher `critique + reference + shaping`.
8. Rollback-causing trajectories are retained in offline replay as negative evidence.

## Core Architecture

Phase 3 adds six control-layer units on top of the Phase 2 runtime.

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

### Checkpoint Pointer Lifecycle

The three checkpoint pointers change only on explicit control events:

- on `update.completed`:
  - `active_checkpoint_id <- new_active_checkpoint_id`
  - `pre_update_ref_checkpoint_id <- previous active checkpoint`
  - `last_stable_checkpoint_id` remains unchanged until the new epoch closes as `promotion_eligible`
- on `epoch.closed` with `promotion_eligible=true`:
  - `last_stable_checkpoint_id <- active_checkpoint_id`
  - `pre_update_ref_checkpoint_id <- null`
- on `update.failed`:
  - `active_checkpoint_id` remains unchanged
  - `last_stable_checkpoint_id` remains unchanged
  - `pre_update_ref_checkpoint_id <- null`
- on `rollback.completed`:
  - `active_checkpoint_id <- restored_checkpoint_id`
  - `last_stable_checkpoint_id <- restored_checkpoint_id`
  - `pre_update_ref_checkpoint_id <- null`

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
- `verification_executed=true`,
- terminal verification produced a structured parseable result,
- the trajectory structure is valid and parseable,
- worktree isolation succeeded without main-workspace contamination,
- `teacher_call_status=complete` and all required teacher payload fields are non-null.

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
- record `comparison_status` and, when completed, `relative_outcome`,
- maintain the current degradation streak,
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

### 6. `epoch-ledger`

Owns epoch state and promotion eligibility.

Responsibilities:

- track `update_epoch_id`, epoch phase, and admitted trajectory membership,
- record comparison completion state for each post-update trajectory,
- compute epoch-close status as `promotion_eligible`, `replay_only`, or `rolled_back`,
- gate whether a sealed batch may feed the next online update,
- publish deterministic epoch snapshots for metrics and diagnosis.

The `epoch-ledger` is the only owner of epoch-close decisions.

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
   If `3` `worse` outcomes occur without an intervening `better`, the system restores `pre_update_ref_checkpoint_id` as active and preserves the failed batch for replay and diagnosis.

The state machine is fully automatic. Phase 3 introduces no manual approval gate between update and promotion.

## Update Epoch Model

Phase 3 uses explicit update epochs so that the comparison baseline cannot be overwritten while a post-update checkpoint is still being evaluated.

An `update_epoch` is defined as:

1. one sealed live batch of `4` admitted real trajectories submitted for one online update attempt,
2. if that update succeeds, the next `4` admitted real trajectories served by the new checkpoint,
3. with matched comparison against the frozen `pre_update_ref_checkpoint_id` for those post-update trajectories.

Rules:

- `pre_update_ref_checkpoint_id` is frozen for the entire update epoch,
- the next online update may not overwrite `pre_update_ref_checkpoint_id` until the current epoch closes,
- an epoch closes only when either:
  - rollback has occurred, or
  - all `4` post-update trajectories have completed matched comparison or been marked `comparison_failed`,
- if the epoch closes without rollback and all `4` post-update trajectories have `comparison_status=completed`, the epoch closes as `promotion_eligible` and the `4` admitted post-update trajectories become the next sealed live batch,
- if any post-update trajectory has `comparison_status=comparison_failed`, the epoch may close as `replay_only`, but it is not eligible for automatic promotion into the next online update.

Recovery rules:

- when an epoch closes as `replay_only`, the current `active_checkpoint_id` remains in service, `pre_update_ref_checkpoint_id` remains frozen, and a fresh monitoring epoch opens under the same checkpoint pair so the system can regain update eligibility with a new set of `4` trajectories,
- when an update attempt fails before promotion, the epoch closes as `update_failed`; the failed batch is preserved, `pre_update_ref_checkpoint_id` is cleared, and the system reopens a fresh `collection` epoch under the unchanged `active_checkpoint_id`.

This makes the monitoring window finite, deterministic, and aligned with the `4`-trajectory update cadence.

## Concurrency Policy

Phase 3 uses a single-writer control plane.

Rules:

- only one `update_epoch` may be open at a time,
- only one online update may execute at a time,
- only one rollback may execute at a time,
- checkpoint pointer mutation is serialized,
- epoch admission, batch sealing, comparison result recording, update completion, and rollback completion are all committed in order.

Real task execution may use isolated worktrees, but Phase 3 does not allow parallel mutation of control state. A real task episode must acquire the current active checkpoint id at start and publish its terminal control events through the serialized control plane before any later episode may mutate epoch or checkpoint state.

## Control Events and Interfaces

Each control-layer unit communicates through explicit events with deterministic required fields.

### `trajectory.persisted`

- producer: `rl-trajectory-store`
- required fields: `trajectory_id`, `task_id`, `task_family`, `student_checkpoint_id`, `terminal_result`, `teacher_call_status`
- consumer: `live-batch-buffer`, replay admission logic
- effect: trajectory is durably stored and becomes eligible for admission checks

### `trajectory.admitted`

- producer: `live-batch-buffer`
- required fields: `trajectory_id`, `update_epoch_id`, `admission_status`, `admission_reason`
- consumer: epoch ledger, batch sealing logic
- effect: admitted trajectory is attached to the current epoch; non-admitted trajectories remain stored but do not count toward sealing

### `comparison.recorded`

- producer: `degradation-monitor`
- required fields: `trajectory_id`, `update_epoch_id`, `comparison_status`, `relative_outcome`, `pre_update_ref_checkpoint_id`
- consumer: epoch ledger, rollback logic, metrics
- effect: comparison result becomes part of streak tracking and epoch-close eligibility

### `epoch.closed`

- producer: `epoch-ledger`
- required fields: `update_epoch_id`, `close_reason`, `completed_comparison_count`, `comparison_failed_count`, `promotion_eligible`
- consumer: `live-batch-buffer`, `online-update-engine`, `active-checkpoint-registry`
- effect: the epoch is finalized either as `promotion_eligible`, `replay_only`, or `rolled_back`

### `batch.sealed`

- producer: `live-batch-buffer`
- required fields: `batch_id`, `update_epoch_id`, `trajectory_ids[4]`, `source_checkpoint_id`
- consumer: `online-update-engine`
- effect: one deterministic batch of `4` admitted trajectories is frozen for update

### `update.completed`

- producer: `online-update-engine`
- required fields: `batch_id`, `update_epoch_id`, `pre_update_ref_checkpoint_id`, `new_active_checkpoint_id`
- consumer: `active-checkpoint-registry`, epoch ledger
- effect: new checkpoint becomes active and a new monitoring epoch opens

### `update.failed`

- producer: `online-update-engine`
- required fields: `batch_id`, `update_epoch_id`, `failure_reason`
- consumer: `active-checkpoint-registry`, replay sink, metrics
- effect: active checkpoint remains unchanged, the failed batch is preserved as `update_failed`, and a fresh epoch is reopened under the unchanged active checkpoint

### `rollback.triggered`

- producer: `degradation-monitor`
- required fields: `update_epoch_id`, `pre_update_ref_checkpoint_id`, `trigger_trajectory_ids`
- consumer: `rollback-and-replay-sink`
- effect: rollback begins with deterministic input evidence

### `rollback.completed`

- producer: `rollback-and-replay-sink`
- required fields: `update_epoch_id`, `restored_checkpoint_id`, `rollback_batch_ids`
- consumer: `active-checkpoint-registry`, replay lanes, metrics
- effect: active checkpoint is restored and rollback evidence is preserved

### `rollback.failed`

- producer: `rollback-and-replay-sink`
- required fields: `update_epoch_id`, `last_stable_checkpoint_id`, `failure_reason`
- consumer: `active-checkpoint-registry`, metrics, safety controls
- effect: control plane enters frozen failure mode and stops further online updates

## State Transition Table

| Event | Preconditions | Pointer Mutations | Next State |
|------|---------------|------------------|-----------|
| `batch.sealed` | open `collection` epoch has `4` admitted trajectories | none | `online-update` |
| `update.completed` | sealed batch update succeeds | `active <- new_active`, `pre_update_ref <- previous active`, `last_stable` unchanged | `monitoring` |
| `epoch.closed` with `promotion_eligible=true` | monitoring epoch has `4` completed comparisons and no rollback | `last_stable <- active`, `pre_update_ref <- null` | new `collection` epoch |
| `epoch.closed` with `replay_only` | monitoring epoch has `>=1 comparison_failed`, no rollback | pointers unchanged | new `monitoring` epoch under same checkpoint pair |
| `update.failed` | update attempt fails before promotion | `pre_update_ref <- null`, `active` unchanged, `last_stable` unchanged | new `collection` epoch |
| `rollback.completed` | degradation threshold reached and restore succeeds | `active <- restored`, `last_stable <- restored`, `pre_update_ref <- null` | new `collection` epoch |
| `rollback.failed` | degradation threshold reached and restore fails | pointers remain unchanged on disk; serving falls back to `last_stable_checkpoint_id` if loadable | `frozen_failure` |

`frozen_failure` is a terminal safety mode for the running campaign. In this mode, no new online updates or promotions are allowed.

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
10. if the current epoch is in post-update monitoring, run matched comparison against `pre_update_ref_checkpoint_id`,
11. when the current epoch closes as `promotion_eligible`, seal its `4` admitted post-update trajectories as the next live batch,
12. trigger the next online update only from a sealed batch created at epoch close,
13. if the degradation streak reaches `3`, roll back automatically.

No episode may execute outside its temporary worktree. No Phase 3 success claim is valid without terminal verification evidence.

## Relative Degradation Model

Relative degradation is measured by matched comparison, not by absolute failure alone.

For every real task served after an online update:

1. the active checkpoint runs the task in its normal temporary worktree,
2. the system then runs `pre_update_ref_checkpoint_id` against the same task in a separate comparison worktree,
3. both runs are evaluated against the same task-family verification target,
4. if the comparison run completes, the degradation monitor records:
   - `comparison_status=completed`
   - `relative_outcome=better | same | worse`
5. if the comparison run fails twice, the degradation monitor records:
   - `comparison_status=comparison_failed`
   - `relative_outcome=null`

### Primary Comparison Rules

Primary comparison is task-family specific and always takes priority over step-count heuristics.

For `failing_tests`:

- fewer unresolved target failures from the structured verification result is better,
- fewer newly introduced failures from the structured verification result is better,
- introducing more regressions than `pre_update_ref_checkpoint_id` is worse.

For `typecheck`:

- `pass` beats `fail`,
- if both fail and the verification wrapper emits a numeric `error_count`, lower `error_count` is better,
- if both fail and no numeric `error_count` is available, the primary outcome is a tie.

For `build`:

- `pass` beats `fail`,
- if both fail and the verification wrapper emits a numeric `blocking_error_count`, lower `blocking_error_count` is better,
- if both fail and no numeric `blocking_error_count` is available, the primary outcome is a tie.

### Secondary Comparison Rules

Secondary rules are used only when primary task-family outcomes tie:

- lower `no_progress_step_count` is better,
- lower `unrelated_file_modification_count` is better,
- lower `convergence_step_count` is better.

Definitions:

- `no_progress_step_count`: the number of steps whose post-step verification snapshot and file diff are both unchanged from the immediately preceding step,
- `unrelated_file_modification_count`: the number of modified files outside the task manifest target set; if the task manifest has no target set, this metric is disabled for the comparison,
- `convergence_step_count`: the number of action steps before the first strictly better primary verification result; if no primary improvement occurs, use the total action-step count.

Secondary rules may upgrade `same` to `better`, but they may not override a primary `worse` classification.

### Rollback Trigger

- `worse` increments the degradation streak by `1`,
- `better` resets the streak,
- `same` leaves the streak unchanged and does not break the streak,
- `comparison_failed` leaves the streak unchanged and does not break the streak,
- `3` `worse` outcomes without an intervening `better` trigger automatic rollback.

The rollback comparison baseline remains fixed to `pre_update_ref_checkpoint_id` for the entire post-update monitoring window. It does not drift with each task.

## Teacher Integration

Every real trajectory receives teacher processing once per episode.

Teacher outputs remain episode-level:

- `teacher_call_status`,
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
- `teacher_call_status`
- `trajectory_steps`
- `files_read`
- `files_modified`
- `patch_summary`
- `verification_executed`
- `verification_passed`
- `verification_before`
- `verification_after`
- `teacher_critique` (nullable)
- `teacher_reference` (nullable)
- `teacher_shaping` (nullable)
- `terminal_result`
- `comparison_status`
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

Deterministic routing rules:

- `relative_outcome=better` -> `positive lane`
- `relative_outcome=same` with `comparison_status=completed` -> `neutral lane`
- `relative_outcome=worse` or `rollback_batch=true` -> `negative lane`
- `comparison_status=comparison_failed` and non-rollback trajectories stay in diagnostic storage only and do not enter replay lanes
- `update_failed` batches stay in diagnostic storage only unless a later manual or offline process explicitly re-admits them

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
- store missing teacher payloads as explicit nulls,
- reject the trajectory from online-update admission if `teacher_call_status != complete`.

### 3. Online update failure

Examples:

- trainer numerical instability,
- checkpoint write failure,
- corrupted live batch.

Handling:

- leave `active_checkpoint_id` unchanged,
- preserve the failed live batch as a diagnostic artifact,
- mark the sealed batch as `update_failed` and remove it from automatic online retry inside the current campaign,
- reopen a fresh epoch under the unchanged active checkpoint after recording the failure,
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
- keep checkpoint pointers unchanged on disk,
- switch serving mode to `shadow-only` on `last_stable_checkpoint_id` if that checkpoint is loadable,
- otherwise stop Phase 3 real-task serving entirely for the active campaign,
- preserve all currently known batch and trajectory evidence for manual diagnosis.

## Metrics and Success Criteria

Phase 3 is successful only if all of the following are true over an evaluation campaign of at least `3` update epochs and at least `12` total comparisons, where `total_comparisons = completed_comparisons + comparison_failed_count`:

1. `better_count > worse_count`,
2. automatic rollback prevents sustained regression and recovers service after bad updates,
3. no main-workspace contamination occurs,
4. replay lanes remain populated with valid, reusable real trajectories,
5. `comparison_failed_count / total_comparisons <= 0.10`,
6. teacher shaping remains directionally aligned with real terminal verification for at least `70%` of trajectories whose teacher output is complete.

For metric purposes:

- `completed_comparisons` counts trajectories with `comparison_status=completed`,
- `comparison_failed_count` counts trajectories with `comparison_status=comparison_failed`,
- teacher shaping is directionally aligned when the sign of numeric `teacher_shaping` matches the sign of the primary comparison result:
  - positive for `better`,
  - zero for `same`,
  - negative for `worse`.

### Required Monitoring Metrics

- number of real tasks served per checkpoint
- live batch count
- online update count
- `better / same / worse` counts
- `comparison_failed` count
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
3. deterministic rollback trigger at `3` `worse` outcomes without an intervening `better`,
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
