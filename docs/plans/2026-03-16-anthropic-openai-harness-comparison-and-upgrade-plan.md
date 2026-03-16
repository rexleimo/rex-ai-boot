# Anthropic vs OpenAI Harness Comparison & AIOS Upgrade Plan

> Sources:
> - Anthropic: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
> - OpenAI (ZH): https://openai.com/zh-Hans-CN/index/harness-engineering/
>
> Date: 2026-03-16

## Goal

Build a practical upgrade path for `rex-ai-boot` by combining:
- Anthropic's reliability-first long-running harness loop
- OpenAI's high-throughput harness architecture for parallel coding agents

while preserving the current AIOS foundation (`ContextDB + orchestrate + dispatch runtimes + learn-eval`).

## 1) High-level Comparison Matrix

| Dimension | Anthropic article | OpenAI article | Combined implication for AIOS |
|---|---|---|---|
| Core definition of harness | Harness = model + deterministic scaffolding (prompting, tooling, control loops) for reliability | Harness = software system around coding agents, optimized for throughput and isolation | Keep deterministic control plane, but redesign scheduler around throughput and bounded parallelism |
| Primary optimization target | Stability over long horizons; recoverability under drift/failure | Massive throughput: many independent coding jobs and fast integration | Split control objective into two KPIs: `success rate` + `cycle throughput` |
| Control loop | Preflight -> Plan -> Execute -> Verify -> Checkpoint -> Recover | Initialization -> feature decomposition -> parallel coding -> merge/integration -> docs/gardening | Current loop exists; missing robust decomposition and queue-driven high-throughput dispatch |
| State management | Explicit checkpointing and evidence-based progress | Structured feature list + command logs + result logs + entropy cleanup | Keep ContextDB as canonical memory, add normalized feature/work-item layer |
| Failure handling | Failure classes + retries with changed hypothesis + human gates for risky decisions | Architectural constraints to prevent bad behavior; strict output/input contracts and workspace boundaries | AIOS should strengthen both: dynamic retry policy + stricter ownership enforcement |
| Parallelism model | Encourages decomposition and controlled retries | Strong emphasis on independent tasks, asynchronous workers, merge philosophy change | Move from mostly phase-serial to queue + bounded parallel workers for independent work-items |
| Quality gate | Verify from evidence, not assumptions | Automated checks + strict constraints + custom lint policies (including docs quality) | Extend quality gate to include docs/reference consistency and handoff contract checks |
| Entropy management | Keep state clear and resumable | Explicit entropy management / garbage collection to reduce context pollution | AIOS already has `entropy-gc`; should promote from optional cleanup to policy-driven hygiene |
| Human role | Human-in-the-loop for sensitive uncertainty | Humans focus on architecture and constraints; agents do repetitive coding/docs tasks | Keep clarity gate, but trigger by risk policy + uncertainty + blast radius, not only blocked counts |

## 2) What AIOS Already Has (Mapped)

1. Long-running checkpoint loop: `ContextDB` lifecycle (`init -> session -> event -> checkpoint -> context:pack`).
2. Structured orchestration: blueprints/roles/merge gate in `memory/specs/orchestrator-blueprints.json` and `scripts/lib/harness/orchestrator.mjs`.
3. Dispatch runtime abstraction with live mode and evidence persistence (`scripts/lib/lifecycle/orchestrate.mjs`).
4. Learn/eval feedback: `node scripts/aios.mjs learn-eval ...`.
5. Human gate and entropy controls:
   - `scripts/lib/harness/clarity-gate.mjs`
   - `scripts/lib/lifecycle/entropy-gc.mjs`

## 3) Gaps vs. Article Guidance

### Gap A: Work decomposition is still phase-centric, not work-item-centric

Current `feature/bugfix/refactor/security` blueprints are role-phase flows. There is no first-class "feature list" object that enumerates independently schedulable work items with explicit dependencies.

Impact:
- limited throughput gains,
- difficult to schedule many safe parallel jobs,
- harder per-item observability.

### Gap B: Ownership boundary is modeled but not strict enough by default

`mergeParallelHandoffs` enforces ownership rules, but the implementer role currently owns `""` (all paths). This weakens isolation and increases merge risk.

### Gap C: Retry strategy is mostly transport/error-aware, not hypothesis-aware

Current runtime handles upstream/transient retries. It lacks explicit policy: "same attempt vs changed hypothesis" with durable cause classification per work-item.

### Gap D: Docs/reference hygiene is not a first-class harness gate

OpenAI article emphasizes custom linting for docs and references. AIOS quality gate focuses build/types/tests/logs/security/git but does not treat docs consistency as required gate for harness-scale operations.

### Gap E: Clarity gate triggers are useful but coarse

Current clarity gate mainly keys off blocked checkpoint counts/conflicts/files touched thresholds. Missing richer risk signals (privileged action, unknown external side effects, policy-sensitive targets).

## 4) Upgrade Priorities (Recommended)

### P0 (High impact, low-medium effort): enforce safety and observability defaults

1. Tighten file ownership defaults
- Change implementer default ownership from global `""` to explicit assignment produced by planner/decomposer.
- Add hard fail when owned scopes are missing for parallel jobs.

2. Add work-item telemetry schema
- New spec for item-level status: `queued|running|blocked|done`, failureClass, retryClass (`same-hypothesis`/`new-hypothesis`), elapsedMs, artifactRefs.
- Persist per-item summaries to ContextDB artifacts.

3. Extend clarity gate policy signals
- Add risk triggers: sensitive command classes, external writes, auth/payment/policy boundary crossing.

Suggested files:
- `memory/specs/orchestrator-blueprints.json`
- `memory/specs/*` (new work-item schema)
- `scripts/lib/harness/orchestrator.mjs`
- `scripts/lib/harness/clarity-gate.mjs`
- `scripts/tests/aios-orchestrator.test.mjs`

### P1 (Highest medium-term impact): add decomposition + queue-based dispatch

1. Add `initializer/decomposer` phase that outputs feature/work-item list.
2. Introduce queue scheduler over work-items (bounded parallelism by risk profile).
3. Keep merge gate but make it item-graph-aware (not just phase-group-aware).

Suggested files:
- `scripts/lib/harness/orchestrator.mjs`
- `scripts/lib/lifecycle/orchestrate.mjs`
- `scripts/lib/harness/orchestrator-runtimes.mjs`
- `memory/specs/orchestrator-blueprints.json` (or new `work-item` spec)

### P2 (Medium impact, low effort): docs/reference harness hygiene

1. Add docs quality gate profile:
- broken internal refs,
- stale command examples,
- consistency of runbook command snippets.

2. Optional "doc-gardener" post-phase for changed command surfaces.

Suggested files:
- `scripts/lib/lifecycle/quality-gate.mjs`
- `scripts/lib/doctor/*` or a new docs-audit helper
- `scripts/tests/aios-harness.test.mjs`

### P3 (Medium impact, low-medium effort): formal retry doctrine

1. Define retry matrix by failure class:
- transient infra -> exponential backoff,
- deterministic contract failure -> no blind retry,
- uncertain reasoning failure -> retry only with changed hypothesis/prompt constraints.

2. Record retry doctrine evidence into checkpoint telemetry for learn-eval weighting.

Suggested files:
- `scripts/lib/harness/subagent-runtime.mjs`
- `scripts/lib/harness/learn-eval.mjs`
- `mcp-server/src/contextdb/core.ts` (telemetry extension if required)

## 5) Concrete Next Sprint Scope (Do first)

1. Ownership hardening + tests (P0-1)
2. Work-item schema + artifact persistence (P0-2)
3. Initializer/decomposer MVP that emits a small feature list from plan handoff (P1-1)

Success criteria for this sprint:
- At least one live orchestrate run executes >=2 independent work-items with explicit non-overlapping owned scopes.
- Merge gate blocks any overlap deterministically.
- Learn-eval can report blocked ratio per work-item category.

## 6) Non-goals (for this round)

1. Replacing ContextDB.
2. Rewriting all existing blueprints at once.
3. Adding new external runtime clients beyond current codex-cli path.

## 7) Quick Decision

For `rex-ai-boot`, the best path is:
- keep Anthropic-style reliability loop as control backbone,
- adopt OpenAI-style decomposition + throughput architecture incrementally,
- prioritize ownership hardening and item-level scheduling before adding more agent roles.

## 8) Checkpoint (2026-03-16)

### Completed

1. P0-1 ownership hardening
- editable roles/phases reject wildcard ownership (`""`);
- parallel editable phases require explicit `ownedPathPrefixes`;
- live subagent runtime blocks out-of-scope `filesTouched` with file-policy violation.

2. P0-2 work-item telemetry foundation
- added `memory/specs/orchestrator-work-item-telemetry.schema.json`;
- added `scripts/lib/harness/work-item-telemetry.mjs`;
- `orchestrate` report/artifact now persist `workItemTelemetry`.

3. P0-2 observability extension (this checkpoint)
- `renderOrchestrationReport` now prints `workItemTelemetry` totals, blocked-by-type, failure classes, retry classes;
- `learn-eval` now aggregates dispatch artifact `workItemTelemetry` into:
  - overall work-item blocked rate,
  - blocked ratio by item type,
  - work-item failure/retry distributions.

### Verification Evidence

- `node --test scripts/tests/aios-orchestrator.test.mjs` passed (66/66).
- `node --test scripts/tests/aios-learn-eval.test.mjs` passed (14/14).
- `npm run test:scripts` passed (157/157).

### Next Actions

1. P0-3: extend clarity gate risk triggers for sensitive command classes and external side effects.
2. P1-1: implement initializer/decomposer MVP that emits independent work-items with explicit ownership scopes.
3. Add live-run sampling to validate the new work-item blocked-ratio signal quality in real artifacts.

## 9) Checkpoint (2026-03-16, P0-3)

### Completed

1. Extended clarity gate risk triggers in `scripts/lib/harness/clarity-gate.mjs`:
- sensitive command class detection (for example `sudo`, `rm -rf`, `docker push`, `terraform apply`, cloud CLIs);
- external write detection for paths outside repo scope (absolute/home/parent traversal paths);
- auth/payment/policy boundary signal detection from handoff text.

2. Added structured metrics + evidence fields:
- `metrics.sensitiveCommandSignals`
- `metrics.externalWriteSignals`
- `metrics.boundaryCrossingSignals`
- `metrics.riskSignalCount`

3. Added regression tests:
- `evaluateClarityGate` triggers on sensitive command + boundary signals;
- `evaluateClarityGate` triggers on external write targets.

### Verification Evidence

- `node --test scripts/tests/aios-orchestrator.test.mjs` passed (68/68).
- `npm run test:scripts` passed (159/159).

### Updated Next Actions

1. P1-1: implement initializer/decomposer MVP that emits independent work-items with explicit ownership scopes.
2. Add live-run sampling to validate and calibrate new clarity-gate risk signals with real artifacts.
3. Tune risk-pattern allowlist/denylist after first batch of live samples to reduce false positives.

## 10) Checkpoint (2026-03-16, P1-1 MVP)

### Completed

1. Added deterministic decomposer MVP in `scripts/lib/harness/orchestrator.mjs`:
- `buildDecomposedWorkItems` generates a small work-item list from task/context handoff;
- work-items are typed (for example `auth`, `payment`, `testing`, `docs`, `security`, `general`) via lightweight keyword rules;
- `buildOrchestrationPlan` now includes `workItems` by default.

2. Threaded work-items through dispatch/report chain:
- phase job `launchSpec` now includes `workItemRefs`;
- local dispatch skeleton now persists `workItems`;
- text report now prints `Work-Item Plan` section;
- dispatch artifact now persists top-level `workItems`.

3. Prompt consumption:
- subagent runtime prompt now shows decomposed work items for each phase when `workItemRefs` are present.

4. Regression tests added/updated:
- decomposition extraction/type inference;
- dispatch skeleton carries work-items and refs;
- report renders work-item plan;
- runtime prompt includes `Decomposed Work Items`;
- artifact persistence includes `workItems`.

### Verification Evidence

- `node --test scripts/tests/aios-orchestrator.test.mjs` passed (70/70).
- `npm run test:scripts` passed (161/161).

### Updated Next Actions

1. P1-2: map work-items to bounded execution queue (from “only metadata” to schedulable units).
2. Add ownership-hint propagation from planner/decomposer into implementer writable scopes.
3. Run live samples and compare work-item telemetry (`blockedByType`, retry/failure class) against decomposed item types for calibration.

## 11) Checkpoint (2026-03-16, P1-2 Queue Scheduling + Policy Test Alignment)

### Completed

1. Landed bounded work-item queue scheduling as default dispatch topology in `scripts/lib/harness/orchestrator.mjs`:
- editable phases with multiple work-items now expand into per-item phase jobs (`phase.implement.wi.*`);
- queue dependencies are window-bounded (`maxParallel=2`) and persisted as `dispatchPlan.workItemQueue`.

2. Preserved policy semantics while adopting queue topology:
- blocked policy (`serial-only`) now emits ordered flow `plan -> implement work-items -> review -> security` without merge gate;
- ready policy (`parallel-with-merge-gate`) keeps review/security parallel group with merge gate, both depending on implement work-item jobs.

3. Completed failing test reconciliation in `scripts/tests/aios-orchestrator.test.mjs`:
- updated dispatch-policy assertions to accept both single implement job and expanded `phase.implement.*` queue jobs;
- added explicit dependency checks from review/security to resolved implement job ids.

### Verification Evidence

- `node --test scripts/tests/aios-orchestrator.test.mjs` passed (71/71).
- `npm run test:scripts` passed (162/162).

### Updated Next Actions

1. Add ownership-hint propagation from decomposer output to implementer writable scopes (close the loop between work-item queue and path ownership).
2. Validate Windows PowerShell wrapper behavior on a real Windows host.
3. Continue live sampling and monitor `sample.latency-watch` before reducing live subagent timeout budgets; then refresh `learn-eval` to dilute historical blocked runs.

## 12) Checkpoint (2026-03-16, P1-2 Ownership Hint Propagation)

### Completed

1. Added owned-path hint inference for work-items in `scripts/lib/harness/orchestrator.mjs`:
- extracts explicit path tokens from work-item summaries (for example `docs/README.md`);
- infers fallback hints from item type and keyword patterns (`docs/`, `scripts/tests/`, `mcp-server/src/`, `memory/specs/`);
- applies safe default hints (`scripts/`, `mcp-server/`) when no explicit hint is found.

2. Propagated work-item ownership hints into dispatch job scopes:
- `launchSpec.ownedPathPrefixes` now resolves from the referenced work-item(s), falling back to phase defaults when hints are missing.

3. Applied work-item ownership scopes during live runtime validation:
- subagent file policy resolution now honors `job.launchSpec.ownedPathPrefixes` (derived from work-item hints).

4. Updated tests to validate ownership propagation:
- `buildDecomposedWorkItems` now asserts inferred `ownedPathHints`;
- `buildLocalDispatchPlan` ensures implementer work-item jobs carry non-empty `ownedPathPrefixes`.
- subagent runtime test ensures work-item hints permit scoped file edits.

### Verification Evidence

- `node --test scripts/tests/aios-orchestrator.test.mjs` passed (72/72).
- `npm run test:scripts` passed (163/163).

### Updated Next Actions

1. Validate Windows PowerShell wrapper behavior on a real Windows host.
2. Continue live sampling and monitor `sample.latency-watch` before reducing live subagent timeout budgets.
3. Refresh `learn-eval` after more successful live samples to dilute historical blocked runs.
