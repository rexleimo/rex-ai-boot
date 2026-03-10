# AIOS Runtime Adapter Boundary — Design

**Date:** 2026-03-10  
**Status:** Approved for implementation

## Goal

Add the final runtime abstraction layer between AIOS orchestration and any future real execution runtime.

This layer should let AIOS keep its existing local-only orchestration intelligence while making future runtime integration additive instead of invasive.

## Problem

AIOS already has:

- blueprint-driven orchestration plans,
- dispatch policy derivation,
- local executor manifests and registry,
- local `dry-run` dispatch execution,
- preflight and evidence persistence.

What it still lacks is one stable boundary between:

- orchestration logic that decides what should run, and
- runtime logic that decides how a dispatch plan is executed.

Right now the local execution path is still effectively coupled to `executeLocalDispatchPlan()`. That is fine for the current slice, but it means any future real runtime would need to plug directly into orchestrator internals instead of implementing a clear adapter contract.

## Scope

This slice adds:

- a plan-level runtime adapter contract,
- a runtime registry and selection layer,
- one local runtime implementation for `dry-run`,
- additive `dispatchRun.runtime` metadata,
- lifecycle wiring so `orchestrate` executes through the runtime layer.

This slice does not:

- add any real model or remote runtime,
- add client-specific runtime adapters for Codex, Claude, Gemini, or OpenCode,
- expose provider/model/runtime details inside `dispatchPlan`,
- change existing blueprints, handoff schema, merge rules, or ContextDB schema.

## Why The Boundary Belongs Here

The current architecture already has the right lower-level primitive for local execution: job-level executors.
Those executors are useful, but they are too low-level to serve as the public runtime boundary.

The missing layer is above executors and below lifecycle:

- lifecycle should choose whether to execute,
- a runtime should execute the whole plan,
- local executors should remain an implementation detail of the local runtime.

This keeps `dispatchPlan` runtime-agnostic and prevents future real runtime integration from leaking into DAG construction.

## Recommended Approach

Use a plan-level runtime adapter abstraction.

### Option A: Plan-Level Runtime Adapter

Add a runtime registry that owns execution of the full `dispatchPlan`.
The current `local-dry-run` path becomes one runtime adapter that internally reuses the existing local executor registry.

Pros:

- clean separation between planning and execution,
- additive future integration point,
- no client-specific leakage into DAG/job schemas,
- preserves current local-only behavior.

Cons:

- adds one extra abstraction layer,
- requires some wiring refactor in lifecycle and orchestrator modules.

### Option B: Job-Level Runtime Adapter

Let each job choose its own runtime directly.

Pros:

- more granular,
- superficially flexible.

Cons:

- pushes execution concerns into DAG shape too early,
- likely wrong for real runtimes that may execute more than one job per session,
- would make future refactors more disruptive.

### Option C: Put Runtime Details Into `launchSpec`

Write future runtime selection into each job now.

Pros:

- looks explicit.

Cons:

- overfits the local-only stage,
- bloats `dispatchPlan` with premature provider/client details,
- makes the plan contract harder to change later.

### Recommendation

Choose Option A.

It gives AIOS one stable boundary before real runtime integration and keeps the current local orchestration model intact.

## Architecture

The runtime abstraction should create four layers:

1. `orchestrate` lifecycle
2. dispatch runtime layer
3. local executor registry
4. job-level local execution logic

### 1. Lifecycle Layer

`orchestrate` remains responsible for:

- option normalization,
- learn-eval overlay selection,
- dispatch policy derivation,
- optional preflight,
- dispatch plan generation,
- evidence persistence.

It should stop owning direct execution details for local dry-run mode.

### 2. Runtime Layer

Add a new module:

- `scripts/lib/harness/orchestrator-runtimes.mjs`

This module becomes the plan-level runtime boundary.
It should:

- expose the runtime catalog,
- select a runtime from execution context,
- validate runtime compatibility,
- execute the full dispatch plan,
- return normalized `dispatchRun` payloads.

### 3. Local Executor Registry

Keep the existing local executor registry in:

- `scripts/lib/harness/orchestrator-executors.mjs`

This stays job-level and local-only.
It should not become the public contract for future real runtimes.

### 4. Job Logic

Keep existing phase and merge-gate dry-run logic in orchestrator helpers.
That logic continues to power the local runtime implementation.

## Runtime Contract

The runtime contract is intentionally small.
Each runtime definition should provide:

- `id`
- `label`
- `requiresModel`
- `executionModes`
- `execute({ plan, dispatchPlan, dispatchPolicy, io, env })`

Suggested exported helpers:

- `listDispatchRuntimes()`
- `getDispatchRuntime(id)`
- `selectDispatchRuntime({ executionMode })`
- `createDispatchRuntimeRegistry(...)`
- `resolveDispatchRuntime(...)`

## Initial Runtime Catalog

This slice defines exactly one runtime:

- `local-dry-run`

Properties:

- `requiresModel=false`
- supports `executionMode=dry-run`
- internally delegates to the existing local dispatch execution path

This is intentionally narrow.
The purpose of the slice is to freeze the boundary, not to introduce additional runtime choices yet.

## Dispatch Plan Rules

`dispatchPlan` must remain runtime-agnostic.

This slice should not add fields such as:

- `launchSpec.runtime`
- `launchSpec.client`
- provider/model placeholders

`dispatchPlan` should continue to express only:

- jobs,
- dependencies,
- merge-gate structure,
- executor metadata,
- policy context.

That keeps planning independent from any future runtime implementation details.

## Dispatch Run Rules

`dispatchRun` should gain additive runtime metadata.

Suggested shape:

```json
{
  "runtime": {
    "id": "local-dry-run",
    "label": "Local Dry Run Runtime",
    "requiresModel": false,
    "executionMode": "dry-run"
  }
}
```

Existing fields such as these stay intact:

- `executorRegistry`
- `executorDetails`
- `jobRuns`
- `finalOutputs`
- `ok`

This lets downstream consumers distinguish:

- the runtime that executed the plan, and
- the executors that handled individual jobs.

## Execution Flow

### `executionMode=none`

- build orchestration plan,
- derive dispatch policy,
- optionally run preflight,
- build dispatch plan,
- do not resolve a runtime,
- do not produce `dispatchRun`.

### `executionMode=dry-run`

- build orchestration plan,
- derive dispatch policy,
- optionally run preflight,
- build dispatch plan,
- resolve runtime `local-dry-run`,
- execute the plan through the runtime layer,
- return `dispatchRun` with runtime metadata,
- persist dispatch evidence when session-backed.

## Failure Semantics

Three different signals must remain distinct.

### 1. Policy Blocked

`dispatchPolicy.status=blocked` means the workflow is not yet ready for a future real runtime.
This is a planning/policy signal.
It is not a runtime failure.

### 2. Runtime Result Blocked

`dispatchRun.ok=false` means the runtime executed successfully enough to produce a valid run result, but some job ended in a blocked state.
This is expected workflow behavior for cases such as merge-gate failure.
It should not throw.

### 3. Harness/Runtime Error

Unknown runtimes, unsupported execution modes, invalid runtime output, or adapter crashes should throw.
These represent contract or infrastructure failures, not workflow blockage.

The rule is:

- blocked workflow => structured result,
- broken harness/runtime => exception.

## Evidence And Artifact Behavior

This slice should keep the current evidence persistence model.
The only artifact-level change should be additive runtime metadata inside `dispatchRun`.

That means:

- existing dry-run evidence still persists through ContextDB,
- learn-eval can continue consuming dispatch evidence,
- old consumers are not broken because schema changes are additive.

## Testing Strategy

### Runtime Registry Tests

Add tests for:

- runtime catalog listing,
- lookup by runtime id,
- default runtime selection for `dry-run`,
- unsupported runtime resolution failures,
- unsupported execution mode failures.

### Runtime Delegation Tests

Add tests proving that the `local-dry-run` runtime delegates to the existing local dispatch execution path and preserves executor/job output fields.

### Lifecycle Integration Tests

Update orchestrator lifecycle tests to verify:

- `--execute dry-run` produces `dispatchRun.runtime`,
- `executionMode=none` does not resolve a runtime,
- preflight behavior remains unchanged,
- evidence persistence still works with runtime metadata present.

### Failure Path Tests

Add tests proving that:

- merge-gate blockage produces `dispatchRun.ok=false` without throwing,
- unknown runtime ids throw,
- unsupported execution modes throw,
- invalid runtime results throw.

## Risks

### Over-Abstraction

If the runtime interface tries to model future client/provider details now, the abstraction will calcify too early.
The interface must stay generic and plan-level.

### Blurred Failure Signals

If runtime exceptions are converted into blocked results, AIOS will stop distinguishing real harness bugs from expected workflow blockage.
That would weaken future operator decisions.

### Contract Drift

If `dispatchRun.runtime` is added inconsistently between live output and persisted artifacts, downstream consumers will receive ambiguous evidence.
The runtime metadata must be normalized once and reused everywhere.

## Success Criteria

This slice succeeds when:

- `orchestrate --execute dry-run` runs through a runtime adapter instead of calling local execution directly,
- `dispatchPlan` remains runtime-agnostic,
- `dispatchRun` carries stable runtime metadata,
- local dry-run behavior remains unchanged from an operator perspective,
- future real runtimes can be added without rewriting DAG or policy logic.

## Non-Goals

This slice does not:

- add real runtime adapters,
- launch real subagents,
- spend tokens,
- add client/provider routing flags,
- redesign the executor manifest,
- change ContextDB checkpoint schema.
