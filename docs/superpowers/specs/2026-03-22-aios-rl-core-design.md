# AIOS RL Core Design

Date: 2026-03-22

## Summary

`RL Core` is the first sub-project in the system-level RL roadmap for `aios`.

It establishes a stable shared learning and control layer under `scripts/lib/rl-core/` that is imported by:

- shell RL,
- browser RL,
- orchestrator RL.

`RL Core` owns the common training-control plane:

- episode and batch contracts,
- reward aggregation,
- comparison and degradation tracking,
- checkpoint lineage and promotion,
- rollback and `frozen_failure`,
- replay routing,
- trainer entry points,
- teacher gateway contracts.

Environment-specific execution does not live in `RL Core`. Shell, browser, and orchestrator each remain responsible for sampling tasks, running episodes, collecting evidence, and producing environment-specific verification inputs.

## Problem

The current repository has a functioning shell RL path, but the system-level RL goal is larger than shell alone.

If browser RL and orchestrator RL are added by copying and modifying the shell control plane, the repository will drift into three similar but incompatible RL implementations. That would create several long-term problems:

1. update and rollback semantics would diverge by environment,
2. replay routing would stop being comparable,
3. checkpoint lineage would become environment-specific instead of system-wide,
4. teacher and judge outputs would require multiple incompatible integration layers,
5. later debugging would be dominated by control-plane inconsistencies rather than model or environment behavior.

The right next step is therefore not "add more RL environments directly", but "extract and stabilize the shared RL control plane first".

## Goals

1. Create a stable shared RL library at `scripts/lib/rl-core/`.
2. Move shared control-plane logic out of `rl-shell-v1` and into `rl-core`.
3. Keep environment execution outside `rl-core`.
4. Define one shared episode contract usable by shell, browser, and orchestrator adapters.
5. Define one shared batch, comparison, replay, and rollback contract.
6. Define one shared checkpoint lineage model:
   - `active`
   - `pre_update_ref`
   - `last_stable`
7. Define one shared teacher gateway contract for Codex CLI, Claude Code, Gemini CLI, and opencode.
8. Provide shared trainer entry points for:
   - online micro-batch updates,
   - offline replay updates,
   - structured update failure disposition.
9. Make shell RL the first environment migrated onto `rl-core` without regressing its current Phase 3 behavior.

## Non-Goals

1. Completing browser RL in this spec.
2. Completing orchestrator RL in this spec.
3. Introducing a long-running daemon or separate RL service.
4. Replacing environment adapters with one generic execution engine.
5. Making `RL Core` responsible for shell commands, DOM operations, or orchestrator dispatch internals.
6. Redesigning the underlying PPO-style student trainer beyond extracting shared entry points.
7. Freezing all interfaces forever; the target is a stable public layer for this repository, not an external package API.

## Position In The Roadmap

System-level RL is split into four sub-projects:

1. `RL Core`
2. `Shell RL Final`
3. `Browser RL`
4. `Orchestrator RL`

This spec covers only sub-project `1`.

The expected delivery order after this spec is:

1. extract and stabilize `rl-core`,
2. migrate shell onto `rl-core`,
3. make shell real-task online RL the default production path,
4. add browser adapter,
5. add orchestrator adapter.

## Core Boundary

`RL Core` is a library module tree under `scripts/lib/rl-core/`.

It is imported directly by environment adapters and higher-level operator commands.

`RL Core` is responsible only for shared learning and control behavior:

- how an episode is represented,
- how trajectories are admitted,
- how live batches are sealed,
- how updates are triggered,
- how checkpoints are promoted,
- how comparisons are recorded,
- how degradation is tracked,
- how rollback occurs,
- how replay lanes are assigned,
- how training entry points are invoked,
- how teacher responses are normalized.

`RL Core` is not responsible for:

- how shell commands run,
- how browser actions execute,
- how orchestrator tasks are dispatched,
- how raw environment evidence is collected.

In short:

- `rl-core` decides how the system learns, promotes, and rolls back,
- adapters decide how the environment executes work.

## Top-Level Architecture

The stable shared layer is split into focused modules with narrow responsibilities.

### `contracts.mjs`

Defines the public shared data contracts:

- `EpisodeRecord`
- `LiveBatch`
- `ComparisonResult`
- `ReplayCandidate`
- `CheckpointLineage`
- `TeacherResponse`
- `OnlineUpdateResult`
- `RollbackResult`
- `CampaignSummary`

This file is the semantic source of truth for shared object shapes.

### `schema.mjs`

Owns validation for all shared contracts.

It must validate:

- structural correctness,
- enum correctness,
- required lineage fields,
- reward/comparison invariants,
- replay-route invariants,
- rollback metadata invariants.

### `control-state-store.mjs`

Persists restart-safe control snapshots and applied event ids.

It owns:

- durable control snapshot reads,
- durable control snapshot writes,
- duplicate event suppression,
- `mode` recovery,
- restart-safe pointer reconstruction inputs.

### `checkpoint-registry.mjs`

Owns all checkpoint pointer transitions.

It defines the only valid transitions for:

- `update.completed`
- `update.failed`
- `epoch.closed`
- `rollback.completed`
- `rollback.failed`

No adapter may mutate active checkpoint pointers directly.

### `epoch-ledger.mjs`

Owns epoch state:

- `collection`
- `monitoring`
- close reason
- promotion eligibility
- degradation streak

It decides whether an epoch becomes:

- `promotion_eligible`
- `replay_only`
- `rolled_back`

### `comparison-engine.mjs`

Defines shared comparison semantics:

- `better`
- `same`
- `worse`
- `comparison_failed`

It does not collect environment evidence. It only evaluates normalized comparison inputs supplied by adapters.

### `reward-engine.mjs`

Owns shared reward aggregation:

- environment terminal reward
- teacher shaping term
- fused reward

Environment adapters may provide environment-specific terminal inputs, but the merge rules live in one place.

### `replay-pool.mjs`

Owns replay routing and replay admission.

Shared lanes:

- `positive`
- `neutral`
- `negative`
- `diagnostic_only`

`diagnostic_only` is persisted for diagnosis but excluded from replay training.

### `trainer.mjs`

Owns shared training entry points:

- online micro-batch update
- offline replay update
- structured update failure results
- reference-policy refresh decisions

The trainer remains a library import, not a separate service.

### `teacher-gateway.mjs`

Owns shared teacher normalization and backend selection contracts.

It standardizes:

- critique
- reference solution
- shaping score
- confidence
- backend used
- fallback status

### `campaign-controller.mjs`

Owns the serialized shared control loop:

- episode admission
- batch sealing
- update dispatch
- comparison recording
- epoch closure
- rollback
- replay routing

This becomes the common orchestrator for learning control logic across all environments.

## Adapter Contract

Each environment adapter is responsible only for environment-facing behavior.

Every adapter must implement five narrow entry points.

### `sampleTask()`

Returns the next environment task to run.

Examples:

- shell: failing test repair, typecheck repair, build repair
- browser: flow completion, publish sequence, auth-sensitive task
- orchestrator: retry/dispatch/stop/handoff decision tasks

### `runEpisode()`

Executes a single full environment episode and returns:

- step trace,
- artifacts,
- terminal verification result,
- environment-specific reward inputs,
- environment evidence summary.

### `compareAgainstReference()`

Runs matched comparison between the current active checkpoint and the frozen `pre_update_ref`.

Returns normalized comparison inputs or direct normalized comparison results.

### `buildReplayCandidate()`

Converts the episode into the replay contract expected by `rl-core`.

### `summarizeEnvironmentEvidence()`

Produces compact environment-specific evidence summaries for:

- rollback diagnosis,
- run summaries,
- ContextDB reporting,
- replay metadata.

## Shared Data Flow

The common data flow across all environments is:

1. adapter `sampleTask`
2. adapter `runEpisode`
3. `rl-core` validates the episode
4. `rl-core` decides admission and replay route
5. `rl-core` seals a live batch when batch size is reached
6. `trainer` performs online update
7. `checkpoint-registry` promotes the new active checkpoint
8. adapter `compareAgainstReference`
9. `comparison-engine` records `better/same/worse/comparison_failed`
10. `epoch-ledger` updates degradation state
11. if degradation threshold is reached, `checkpoint-registry` and `campaign-controller` roll back
12. `replay-pool` persists replay lanes and diagnostic-only evidence

## Checkpoint Lineage Model

The stable shared checkpoint lineage model is:

- `active_checkpoint_id`
- `pre_update_ref_checkpoint_id`
- `last_stable_checkpoint_id`

Rules:

1. `active` is the checkpoint currently serving environment work.
2. `pre_update_ref` is frozen immediately before an online update completes.
3. `last_stable` is updated only when a monitoring epoch closes cleanly as `promotion_eligible`.
4. rollback restores `active <- pre_update_ref` and then resets `last_stable <- restored`.
5. rollback failure enters `frozen_failure`.

This model must not differ by environment.

## Shared Failure Semantics

`RL Core` standardizes these failure classes:

- `update_failed`
- `comparison_failed`
- `rollback_failed`
- `frozen_failure`
- `diagnostic_only`

Behavioral rules:

1. `comparison_failed` does not by itself trigger rollback, but blocks promotion eligibility.
2. `update_failed` keeps the active checkpoint unchanged and returns the failed batch to diagnosis.
3. `rollback_failed` places the control plane into `frozen_failure`.
4. `frozen_failure` blocks further online updates until an operator intervenes.
5. `diagnostic_only` evidence is retained but excluded from replay training.

## Migration Strategy

Migration is intentionally staged.

### Stage 1: Extract shared control-plane units

Create `scripts/lib/rl-core/` and move shared shell-validated logic into it:

- contracts
- schema
- control-state
- checkpoint lineage
- epoch logic
- replay routing
- trainer entry points
- summary primitives

At this stage, shell behavior must remain unchanged.

### Stage 2: Convert shell into the first adapter

Create a shell adapter layer and move shell-specific logic out of the shell control plane:

- task sampling
- temp/worktree execution
- terminal verification
- shell evidence summarization
- shell matched comparison

After this step, shell no longer owns its own update or rollback control logic.

### Stage 3: Add browser and orchestrator adapters

Once shell is stable on `rl-core`, add:

- `rl-browser-adapter`
- `rl-orchestrator-adapter`

Neither of these may re-implement shared control-plane logic.

## Compatibility Requirements

`RL Core` must be introduced without regressing the current shell Phase 3 behavior.

That means:

1. current shell tests must keep passing,
2. current Phase 3 shell smoke must keep passing,
3. replay route semantics must remain compatible,
4. checkpoint lineage semantics must remain compatible,
5. rollback and `frozen_failure` semantics must remain compatible.

## Acceptance Criteria

This spec is successful when all of the following are true:

1. `scripts/lib/rl-core/` exists as a stable shared library layer.
2. Shared shell control-plane code has moved into `rl-core`.
3. Shell imports `rl-core` instead of owning duplicated control logic.
4. Shell smoke and tests still pass after migration.
5. `rl-core` exposes stable adapter-facing contracts for shell, browser, and orchestrator.
6. Browser and orchestrator can be designed as adapters rather than parallel control planes.

## Risks

### Risk 1: Fake modularity

If shell-specific assumptions leak into `rl-core`, browser and orchestrator will still need environment-specific forks.

Mitigation:

- keep adapter contracts narrow,
- reject shell-only concepts in core contracts,
- move only shared logic into `rl-core`.

### Risk 2: Giant manager anti-pattern

If `rl-core` becomes one oversized manager, it will be hard to reason about and harder to evolve safely.

Mitigation:

- split by responsibility,
- keep the campaign controller thin,
- keep state mutation in dedicated modules.

### Risk 3: Migration regressions

Moving shell onto `rl-core` may accidentally change replay, comparison, or rollback behavior.

Mitigation:

- preserve shell regression tests,
- add contract-level tests in `rl-core`,
- migrate in stages rather than with a full replacement.

## Recommended Next Step

The next concrete step after this spec is:

1. write the `RL Core` implementation plan,
2. execute extraction and shell migration in a dedicated worktree,
3. verify shell still passes before any browser or orchestrator work begins.
