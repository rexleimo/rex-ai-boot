# AIOS Browser And Orchestrator RL Design

Date: 2026-03-23

## Summary

This spec extends the existing `aios` RL roadmap from:

- shared `RL Core`,
- migrated shell RL,

to a system-level mixed-environment RL program that adds:

- browser RL,
- orchestrator RL.

The resulting system uses:

- one shared `student` policy,
- one shared checkpoint lineage,
- one shared `RL Core` control plane,
- one mixed live-batch update path,
- one overall rollback decision.

Browser and orchestrator do not become separate RL systems. They become environment adapters plugged into the same learning loop already used by shell.

## Problem

`RL Core` now exists as a reusable shared layer, and shell RL has already been migrated onto it. The next system-level step is not more shell depth; it is extending the same learning loop to the other two high-value environments:

- browser execution,
- task orchestration and control decisions.

If browser and orchestrator are added as separate, environment-local RL stacks, the repository will immediately lose the reason `RL Core` was created:

1. update and rollback semantics will diverge,
2. comparison results will stop being comparable,
3. checkpoint lineage will fragment by environment,
4. replay pools will become incompatible,
5. teacher behavior and failure handling will fork,
6. later cross-environment learning will become a merge problem instead of a training problem.

The right next step is therefore to add browser and orchestrator as first-class `RL Core` adapters, even though that is more demanding than building them independently.

## Goals

1. Add a browser adapter that performs real online training.
2. Add an orchestrator adapter that performs real online training.
3. Keep one shared `student/checkpoint` across shell, browser, and orchestrator.
4. Allow one `live batch` to mix trajectories from any active environment, including shell, browser, and orchestrator.
5. Keep comparison normalization unified as:
   - `better`
   - `same`
   - `worse`
   - `comparison_failed`
6. Keep rollback as one overall decision based on mixed-environment monitoring, not per-environment hard rollback.
7. Restrict browser RL to controlled real business flows rather than open web exploration.
8. Restrict orchestrator RL to high-signal control decisions rather than long-form planning.
9. Use teacher calls for browser and orchestrator only on:
   - failed episodes,
   - near-success boundary episodes.
10. Preserve environment-specific evidence so that mixed-batch degradation remains diagnosable.

## Non-Goals

1. Training separate browser-only or orchestrator-only students.
2. Allowing browser RL to freely explore arbitrary websites.
3. Training orchestrator on unconstrained plan-writing or open-ended reasoning tasks.
4. Making rollback environment-specific in this phase.
5. Switching from the current PPO-style RL spine to a new trainer family.
6. Turning `RL Core` into a browser runner or orchestrator runtime.
7. Replacing human-sensitive protections around browser auth, challenges, or risky outbound actions.

## Position In The Roadmap

The current system-level RL roadmap becomes:

1. `RL Core`
2. `Shell RL`
3. `Browser + Orchestrator Mixed RL`

This spec covers item `3`.

It assumes:

- `RL Core` already exists under `scripts/lib/rl-core/`,
- shell already imports `RL Core`,
- shell remains part of the same shared policy universe.

## Core System Boundary

The system remains split into:

- environment adapters,
- `RL Core`,
- one shared policy/checkpoint layer.

### Environment Adapters

Each adapter remains responsible for:

- task sampling,
- environment execution,
- evidence collection,
- matched comparison setup,
- replay candidate construction,
- environment evidence summaries.

This applies to:

- shell,
- browser,
- orchestrator.

### RL Core

`RL Core` remains responsible only for:

- episode admission,
- live-batch sealing,
- online updates,
- comparison aggregation,
- degradation tracking,
- checkpoint promotion,
- rollback,
- replay routing,
- teacher normalization,
- campaign summaries.

It still does not own:

- DOM execution,
- browser action implementation,
- shell command execution,
- task dispatch internals.

### Shared Policy Layer

There is exactly one active student/checkpoint lineage:

- `active_checkpoint_id`
- `pre_update_ref_checkpoint_id`
- `last_stable_checkpoint_id`

Browser and orchestrator both update this shared lineage.

## Top-Level Architecture

The mixed-environment RL architecture is:

1. shell adapter produces shell episodes,
2. browser adapter produces browser episodes,
3. orchestrator adapter produces orchestrator episodes,
4. `RL Core` admits those episodes into one shared stream,
5. `RL Core` seals mixed live batches,
6. one shared online update modifies the shared student,
7. one shared monitoring epoch judges the post-update checkpoint,
8. one shared rollback decision governs promotion or restoration.

In effect:

- execution is environment-specific,
- learning control is centralized,
- parameters are shared.

## Component Responsibilities

The mixed-environment system must keep ownership explicit.

| Action | Owner |
|---|---|
| sample environment task | adapter |
| execute one environment episode | adapter |
| decide teacher trigger (`failure` / `boundary` / none) | adapter |
| normalize teacher response | `RL Core` |
| build replay candidate | adapter |
| seal live batch | `RL Core` |
| run online update | `RL Core` trainer |
| capture baseline freeze checkpoint id | campaign runner |
| request holdout validation from an environment | campaign runner |
| evaluate epoch-close decision | `RL Core` campaign controller |
| promote checkpoint | `RL Core` checkpoint registry |
| execute rollback state transition | `RL Core` campaign controller |
| produce environment-specific rollback evidence | adapter |

## Adapter Interface Contract

Browser and orchestrator must implement the same narrow adapter surface.

### `sampleTask({ environment, activeCheckpointId, controlState })`

Returns either:

- one task descriptor,
- or `null` when no admissible task is currently available.

It must be side-effect free with respect to training state.

### `runEpisode({ task, checkpointId })`

Executes one full environment episode and returns a normalized episode payload.

Environment failure must normally be returned in-band as episode evidence rather than thrown as a process error.

Throwing is reserved for:

- adapter infrastructure failure,
- unrecoverable runtime initialization failure.

If this method throws:

- `RL Core` does not automatically retry it,
- the attempt is recorded as infrastructure failure evidence,
- the resulting record is replay-routed to `diagnostic_only`,
- and the current episode is excluded from replay training.

### `compareAgainstReference({ task, activeCheckpointId, preUpdateRefCheckpointId })`

Runs matched comparison for the same task/control context and returns a normalized comparison payload.

If reproducibility fails after the allowed retry budget, this must return `comparison_failed` rather than silently coercing to `same` or throwing.

If this method throws instead of returning a normalized result:

- `RL Core` records the attempt as `comparison_failed`,
- routes the evidence to `diagnostic_only`,
- and blocks promotion eligibility for the current epoch.

### `buildReplayCandidate({ episode, comparison })`

Produces the replay contract expected by `RL Core`.

If an episode is not replay-trainable, this method must still produce a valid replay candidate and route it to `diagnostic_only`.

### `summarizeEnvironmentEvidence({ episode, comparison })`

Produces compact environment-specific evidence for:

- batch summaries,
- rollback diagnosis,
- ContextDB reporting,
- replay metadata.

This method must be side-effect free.

## Compatibility And Migration Rule

Mixed-environment rollout must preserve compatibility with existing shell RL data.

The migration rule for this phase is:

1. all newly written mixed-environment episodes use `schema_version: 1`,
2. existing shell episodes without `schema_version` are treated as legacy `v0`,
3. legacy `v0` shell episodes remain readable for diagnosis,
4. legacy `v0` shell episodes are replay-ineligible by default,
5. shell episode writers must be upgraded to emit `schema_version: 1` before mixed live campaigns are enabled.

This avoids ambiguous replay mixing between old shell data and new mixed-environment data.

## Shared Data Contract Extensions

To support mixed-environment RL, shared episode and batch records must explicitly carry environment metadata.

Every replay-admissible episode must carry:

- `environment`
  - `shell`
  - `browser`
  - `orchestrator`
- `task_family`
- `teacher_triggered`
- `terminal_reward`
- `comparison_status`
- `relative_outcome`
- `replay_route`

Every live batch summary must carry:

- total batch size,
- per-environment counts,
- per-environment reward summary,
- per-environment `better/same/worse/comparison_failed`,
- overall aggregated comparison signal.

The point is not only to mix environments, but to keep mixed updates debuggable.

## Normative Contracts

The first implementation must treat these contract fields as normative.

### Shared Episode Fields

Every replay-addressable episode must carry:

- `schema_version: 1`
- `environment: "shell" | "browser" | "orchestrator"`
- `task_family: string`
- `teacher_triggered: boolean`
- `teacher_trigger_reason: "failure" | "boundary" | null`
- `boundary_episode: boolean`
- `terminal_reward: number`
  - required
  - range `[-1, 1]`
- `comparison_status: "completed" | "comparison_failed"`
- `relative_outcome: "better" | "same" | "worse" | null`
  - must be `null` when `comparison_status = comparison_failed`
- `replay_route: "positive" | "neutral" | "negative" | "diagnostic_only"`

### Shared Live Batch Summary Fields

Every sealed mixed batch must carry:

- `schema_version: 1`
- `batch_id: string`
- `checkpoint_id: string`
- `environments_in_batch: string[]`
- `total_episode_count: integer`
- `environment_counts`
  - map of environment to admitted trajectory count
- `environment_reward_summary`
  - map of environment to aggregate reward stats
- `environment_comparison_summary`
  - map of environment to:
    - `better_count`
    - `same_count`
    - `worse_count`
    - `comparison_failed_count`

### Replay Admission Rules

Replay admission is deterministic:

1. `diagnostic_only` never enters replay training.
2. `comparison_status=comparison_failed` must use `replay_route=diagnostic_only`.
3. `boundary_episode=true` may enter replay only if:
   - the trajectory schema is complete,
   - environment evidence is present,
   - no unsafe side-effect violation occurred.
4. `relative_outcome=worse` routes to `negative`.
5. `relative_outcome=same` routes to `neutral`.
6. `relative_outcome=better` routes to `positive`.

## Mixed Live Batch Rules

One `live batch` may contain trajectories from:

- shell,
- browser,
- orchestrator.

Batch sealing does not require homogeneous environment membership.

However, the batch must preserve:

- environment labels,
- environment counts,
- environment-specific comparison outcomes,
- environment-specific replay routing evidence.

This means one update may be influenced by:

- a shell repair episode,
- a browser flow-completion episode,
- an orchestrator dispatch decision episode,

inside the same batch.

That is intentional.

## Comparison And Rollback Semantics

### Per-Environment Comparison

Each environment adapter performs its own matched comparison with environment-native evidence.

Examples:

- shell compares repository repair outcomes,
- browser compares flow completion and error incidence,
- orchestrator compares control-decision quality and downstream outcomes.

Each adapter must convert its comparison result into the shared normalized contract:

- `better`
- `same`
- `worse`
- `comparison_failed`

### Overall Rollback

Rollback is based on overall mixed-environment monitoring, not per-environment hard failure.

The first implementation must use one deterministic aggregate monitoring rule set:

- `better` resets degradation streak to `0`
- `same` leaves degradation streak unchanged
- `worse` increments degradation streak by `1`
- `comparison_failed` increments degradation streak by `1`

Rollback is triggered when:

- `degradation_streak >= 3`

This keeps mixed-environment rollback compatible with the existing shell online path while still using one overall cross-environment signal.

### Environment Coverage Sufficiency

Coverage sufficiency is defined against `active_environments`, a campaign-configured set.

For this project, the final mixed campaign target set is:

- shell
- browser
- orchestrator

Earlier delivery phases may use smaller active sets:

- Phase B may use `browser` only,
- Phase C may use `orchestrator` only,
- Phase D/E use the full mixed set.

An epoch is coverage-sufficient only when every environment in `active_environments` has produced either:

- one `comparison_status=completed` result in the current monitoring epoch,
- or one explicit holdout validation result for the candidate promoted checkpoint.

If coverage is insufficient at epoch close, the epoch cannot become promotion-eligible.

### Shell-Safety Gate

The shell-safety gate is a campaign-runner-owned holdout validation computed before final promotion.

Inputs:

- candidate promoted checkpoint,
- frozen shell baseline checkpoint id,
- fixed shell holdout validation set.

Shell-safety gate passes only when:

- shell holdout success rate is no worse than `5` percentage points below the frozen shell baseline,
- shell validation emits no schema failure,
- shell holdout comparison completes successfully.

If the shell-safety gate fails:

- epoch outcome becomes `replay_only`,
- promotion is blocked,
- rollout evidence is persisted for diagnosis.

### Epoch Aggregation Algorithm

The monitoring epoch is evaluated in two steps.

Step 1: sequential monitoring

- process comparison results in arrival order,
- update degradation streak per result:
  - `better` -> reset to `0`
  - `same` -> no change
  - `worse` -> `+1`
  - `comparison_failed` -> `+1`
- if streak reaches `3`, rollback triggers immediately and epoch evaluation stops.

Step 2: epoch-close aggregation

If rollback was not triggered, compute:

- `better_count`
- `same_count`
- `worse_count`
- `comparison_failed_count`
- coverage sufficiency
- shell-safety gate result

Then apply the decision matrix below.

### Decision Matrix

At epoch close, the controller must apply this precedence order:

1. evaluate monitoring results and compute:
   - degradation streak
   - coverage sufficiency
   - shell-safety gate
2. if `degradation_streak >= 3`:
   - execute rollback
   - on rollback success: enter `collection` with restored checkpoint
   - on rollback failure: enter `frozen_failure`
3. else if coverage is insufficient:
   - `replay_only`
4. else if shell-safety gate failed:
   - `replay_only`
5. else if any `comparison_failed` occurred in the epoch:
   - `replay_only`
6. else if aggregate completed comparisons contain at least one `better` and zero `worse`:
   - `promotion_eligible`
7. else:
   - continue monitoring until max monitoring budget, then `replay_only`

### Diagnostic Requirement

Even though rollback is overall, every monitoring summary must preserve per-environment evidence.

Otherwise the system would know that an update failed overall but not whether:

- browser poisoned orchestrator,
- orchestrator poisoned browser,
- shell stabilized the batch,
- one environment had no meaningful comparison coverage.

## Comparison Reproducibility Policy

Matched comparison is only valid if the adapter can reconstruct sufficiently similar initial conditions.

### Browser Reproducibility

Browser matched comparison must pin:

- target site,
- target path or flow id,
- authenticated state class,
- input payload,
- comparison start URL or equivalent start screen.

Browser retry budget:

- one automatic replay retry on transient navigation or challenge divergence,
- after that, mark `comparison_failed`.

Browser must mark `comparison_failed` when:

- start page cannot be reconstructed,
- required auth state is unavailable,
- the target flow diverges before comparable action execution begins,
- challenge or anti-bot state prevents a meaningful matched run twice.

If auth has expired or human re-auth is required:

- the adapter must emit `comparison_failed`,
- route the episode to `diagnostic_only`,
- set re-auth or challenge evidence in the environment summary,
- and trigger human handoff rather than automatic auth recovery.

### Orchestrator Reproducibility

Orchestrator matched comparison must pin:

- task context snapshot,
- available executors,
- available preflight actions,
- stop/handoff policy inputs,
- evidence packet seen by the controller.

Orchestrator retry budget:

- one automatic retry on transient infrastructure failure,
- after that, mark `comparison_failed`.

Orchestrator must mark `comparison_failed` when:

- the task context snapshot cannot be reconstructed,
- required upstream evidence is missing,
- the executor menu or policy inputs differ from the original control context,
- the replayed control round cannot be evaluated under the same decision surface twice.

## Browser Adapter Design

### Browser Task Scope

The browser adapter only trains on controlled, high-signal real flows.

Allowed task classes:

- known target-site, known target-path flow completion,
- authenticated form fill / submit / publish sequences,
- flows with explicit success pages or explicit success UI states,
- flows with explicit auth-wall, challenge, forbidden, or validation-error failure modes.

Disallowed in this phase:

- open-ended browsing,
- broad web exploration,
- unconstrained website search behavior,
- unsafe autonomous outbound behavior without explicit flow constraints.

### Browser Episode Shape

`runEpisode()` must return structured multi-step evidence rather than raw full-page dumps.

Required evidence categories:

- visited page kinds,
- key selector presence/absence,
- user-facing form state,
- action taken,
- navigation result,
- validation errors,
- auth/challenge detection,
- terminal UI state,
- sensitive action flags.

Recommended normalized step fields:

- `page_kind`
- `key_selectors_present`
- `action_taken`
- `navigation_result`
- `form_error`
- `sensitive_action_flag`
- `terminal_status`

### Browser Terminal Reward

Browser reward must remain hard and environment-grounded.

Examples:

- explicit success state reached: positive reward,
- blocked by auth or challenge: negative reward,
- validation error or terminal error page: zero or negative reward,
- timeout, dead-end, or repeated no-progress: negative reward.

### Browser Comparison

Matched comparison runs the same flow and initial conditions against:

- current active checkpoint,
- `pre_update_ref`.

Comparison dimensions:

- success-state reachability,
- challenge/auth avoidance,
- validation-error incidence,
- action efficiency,
- no-progress reduction.

The output is then normalized into the shared comparison contract.

### Browser Teacher Policy

Teacher is not called on every browser episode.

Teacher is called only for:

- failed browser episodes,
- near-success browser episodes that did not cross the success boundary.

Boundary examples:

- reached the final step but failed submission,
- passed auth but failed final validation,
- reached the right page but took the wrong final action order.

## Orchestrator Adapter Design

### Orchestrator Task Scope

The orchestrator adapter trains only on high-value control decisions.

Allowed decision classes:

- `dispatch`
- `retry`
- `stop`
- `handoff`
- `preflight`

Disallowed in this phase:

- unconstrained long-form planning generation,
- free-form strategy writing as the primary training target,
- control episodes with no hard downstream verification.

### Orchestrator Episode Shape

An orchestrator episode represents one control round rather than a page flow.

Required evidence categories:

- current task context,
- current blockers and risks,
- available evidence,
- decision type,
- decision payload,
- selected executor,
- preflight choice,
- verification result,
- handoff trigger,
- terminal task outcome.

Recommended normalized step fields:

- `context_state`
- `decision_type`
- `decision_payload`
- `executor_selected`
- `preflight_selected`
- `verification_result`
- `handoff_triggered`
- `terminal_outcome`

### Orchestrator Terminal Reward

Reward must stay hard and consequence-based.

Examples:

- correct dispatch that advances completion: positive reward,
- failure to trigger needed human handoff: negative reward,
- invalid or repeated retry loops: negative reward,
- over-conservative preflight that stalls work: zero or negative reward,
- correct blocking of risky actions: positive reward.

### Orchestrator Comparison

Matched comparison runs the same control context through:

- current active checkpoint,
- `pre_update_ref`.

Comparison dimensions:

- fewer invalid retries,
- faster arrival at the correct executor,
- fewer missed human gates,
- less unsafe automation under bad state,
- stronger task-completion progression.

Output is normalized into:

- `better`
- `same`
- `worse`
- `comparison_failed`

### Orchestrator Teacher Policy

Teacher is also sparse-triggered.

Teacher is called only for:

- clearly failed control decisions,
- near-success control episodes that missed the right final decision.

Typical cases:

- the system should have handed off but continued,
- the system should have run preflight but executed directly,
- the system almost completed but chose the wrong final retry/stop/dispatch action.

## Teacher Policy Across Browser And Orchestrator

Teacher policy for this phase is deliberately more conservative than shell’s stronger intervention path.

For browser and orchestrator:

- no teacher call on clearly successful episodes,
- teacher call on failed episodes,
- teacher call on near-success boundary episodes.

Teacher-trigger ownership is adapter-local:

- the adapter decides whether an episode is `failure`, `boundary`, or `no-teacher`,
- the adapter sets `teacher_triggered` and `teacher_trigger_reason`,
- `RL Core` only consumes the normalized trigger metadata and the normalized teacher response.

Teacher outputs remain the same normalized structure:

- critique,
- reference,
- shaping,
- confidence.

The difference is when teacher is invoked, not what the normalized teacher contract looks like.

## RL Core Changes Required

`RL Core` must be extended to support mixed-environment campaigns without becoming environment-aware in the execution sense.

Required changes:

1. episode and replay contracts must carry `environment`,
2. campaign summaries must track per-environment breakdowns,
3. mixed batches must preserve environment composition,
4. comparison aggregation must consume normalized environment-tagged comparison inputs,
5. rollback diagnostics must preserve environment and task-family evidence,
6. replay routing must remain shared while preserving environment metadata.

`RL Core` should not grow browser-specific or orchestrator-specific execution assumptions.

## Failure Semantics

The failure model remains shared.

Existing failure classes still apply:

- `update_failed`
- `comparison_failed`
- `rollback_failed`
- `frozen_failure`
- `diagnostic_only`

New environments do not get custom rollback semantics.

Important rules:

1. Browser and orchestrator failures still normalize into shared replay and comparison outcomes.
2. `comparison_failed` increments degradation streak by `1` and blocks promotion eligibility for the current epoch.
3. `rollback_failed` still drives `frozen_failure`.
4. Mixed campaigns must never lose environment attribution on failed evidence.

The adapter-level `comparison_failed` pass gates below are bring-up quality thresholds, not promotion thresholds.

Promotion eligibility still requires zero `comparison_failed` inside the final promotion window.

## Acceptance Criteria

Acceptance is split into three layers.

### 1. Adapter Correctness

Browser adapter must:

- produce structured browser episodes,
- produce normalized comparison results,
- produce replay candidates and evidence summaries.

Browser adapter pass gate:

- at least `20` controlled real browser episodes,
- `0` schema validation failures,
- `comparison_failed` rate at or below `20%`.

Orchestrator adapter must:

- produce structured control-decision episodes,
- produce normalized comparison results,
- produce replay candidates and evidence summaries.

Orchestrator adapter pass gate:

- at least `20` real control-decision episodes,
- `0` schema validation failures,
- `comparison_failed` rate at or below `20%`.

### 2. Mixed-Campaign Correctness

The system must prove:

- one live batch can contain browser and orchestrator trajectories together,
- online update works on mixed batches,
- mixed monitoring epochs aggregate normalized comparisons correctly,
- rollback triggers from overall mixed-environment performance rather than per-environment hard gates,
- rollback diagnostics preserve environment-level evidence.

Mixed-campaign pass gate:

- at least `3` mixed live batches,
- at least `1` mixed batch contains `browser + orchestrator`,
- at least `1` mixed batch contains `shell` plus one of the new environments,
- at least `1` successful rollback drill,
- at least `1` resume-from-snapshot drill with no duplicate event application.

Rollback drill pass evidence:

- one induced monitoring sequence that reaches `degradation_streak >= 3`,
- one `rollback-completed-*` event,
- post-rollback `active_checkpoint_id` equals the expected restored checkpoint,
- control mode returns to `collection`.

Resume drill pass evidence:

- one persisted snapshot read on restart,
- resumed `active_checkpoint_id` matches the last persisted snapshot,
- `duplicateEventApplications = 0`,
- no replayed control event mutates checkpoint lineage twice.

### 3. Behavioral Improvement

The mixed-environment system must show:

- browser task performance improves versus baseline,
- orchestrator control quality improves versus baseline,
- mixed training does not degrade overall behavior below the relevant single-environment baselines.

Behavioral pass gate:

- baseline freeze point = the `last_stable_checkpoint_id` captured immediately before mixed browser-orchestrator online training begins,
- validation window = fixed `30` episodes per environment on an operator-approved heldout task/flow set,
- all deltas are measured against that frozen baseline on the same validation window,
- no statistical significance test is required in v1; fixed threshold deltas are the source of truth,
- browser controlled-flow success rate improves by at least `10` percentage points versus the frozen pre-phase baseline,
- orchestrator decision success rate improves by at least `10` percentage points versus the frozen pre-phase baseline,
- missed-handoff rate does not increase,
- mixed-campaign overall `better_count - worse_count` is positive on the validation window,
- shell holdout validation does not regress by more than `5` percentage points,
- no environment regresses by more than `5` percentage points versus its own baseline.

## Implementation Order

This is one project, but not one giant code drop.

Recommended delivery order:

1. extend `RL Core` contracts and campaign summaries for mixed environments,
2. add browser adapter,
3. add orchestrator adapter,
4. add mixed-campaign entrypoints and aggregate rollback metrics,
5. run mixed-environment validation.

This keeps the shared semantics stable before the higher-risk adapters land.

## Delivery Phases

Even though this is one project, implementation planning must be phased.

### Phase A: Contracts And Compatibility

Exit criteria:

- mixed-environment contracts finalized,
- shell compatibility rule implemented,
- shell-safety promotion gate specified in code and tests.

### Phase B: Browser Adapter

Exit criteria:

- controlled-flow browser episodes run end-to-end,
- browser comparison reproducibility rules enforced,
- browser replay candidates and teacher triggers validated.

### Phase C: Orchestrator Adapter

Exit criteria:

- control-decision episodes run end-to-end,
- orchestrator matched comparison reproducibility enforced,
- orchestrator replay candidates and teacher triggers validated.

### Phase D: Mixed Campaign Control

Exit criteria:

- mixed live batches run with shared checkpoints,
- overall rollback state machine is tested,
- shell-safety gate is active.

### Phase E: Validation

Exit criteria:

- rollback drill passes,
- resume drill passes,
- browser, orchestrator, and shell holdout gates all pass.

## Risks

The main risks are:

1. shared-parameter interference between browser and orchestrator,
2. mixed-batch updates hiding which environment caused degradation,
3. overall rollback masking single-environment instability,
4. under-triggered teacher calls starving hard environments of guidance,
5. over-broad browser scope or over-broad orchestrator scope making reward too noisy.

The design addresses these risks by:

- constraining browser to controlled real flows,
- constraining orchestrator to hard control decisions,
- requiring per-environment batch and epoch breakdowns,
- keeping teacher sparse but targeted,
- keeping rollback overall while preserving environment evidence.

## Final Position

This phase does not create two more RL stacks.

It creates two more environment adapters on top of one shared system-level RL control plane.

That is the intended end-state for `aios`:

- shared learning core,
- shared checkpoint lineage,
- shared online updates,
- environment-specific execution,
- environment-specific evidence,
- system-level improvement and rollback.
