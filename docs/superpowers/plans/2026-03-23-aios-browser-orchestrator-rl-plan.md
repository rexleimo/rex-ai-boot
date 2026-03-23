# AIOS Browser And Orchestrator RL Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser and orchestrator real online RL adapters on top of `RL Core`, keep one shared student/checkpoint lineage across shell/browser/orchestrator, and validate mixed-environment live-batch training plus overall rollback behavior.

**Architecture:** Extend `scripts/lib/rl-core/` so mixed-environment campaigns are first-class, then add two adapter trees, `rl-browser-v1` and `rl-orchestrator-v1`, that translate environment-native execution into normalized `RL Core` episodes. Finish by adding one mixed campaign runner and validation path that uses one shared checkpoint, mixed live batches, unified monitoring, and overall rollback while preserving per-environment evidence.

**Tech Stack:** Node 22 ESM, built-in `node:test`, existing `scripts/lib/rl-core/*`, existing shell RL harness, existing orchestrator harness modules under `scripts/lib/harness/`, MCP browser stack under `mcp-server/src/browser/*`, JSON validation, ContextDB summary writer, package scripts.

---

## Locked Assumptions

These assumptions are locked for planning so implementation can proceed despite the spec review loop not auto-approving yet:

1. `active_environments` is campaign-configured and phase-dependent:
   - browser-only in browser bring-up
   - orchestrator-only in orchestrator bring-up
   - shell/browser/orchestrator in final mixed validation
2. `shell-safety gate` is computed by the mixed campaign runner only when a checkpoint is otherwise promotion-eligible.
3. `sampleTask() -> null` means “no admissible work now”; the controller counts idle polls and ends the run as `no_work_available` after a fixed backoff budget instead of failing.
4. `comparison_status = comparison_failed` always forces `replay_route = diagnostic_only`.
5. `unsafe side-effect violation` will be represented explicitly as:
   - `safety_violation: boolean`
   - `safety_violation_reason: string | null`
6. Browser teacher and orchestrator teacher trigger ownership stays adapter-local.
7. Baseline freeze point is the `last_stable_checkpoint_id` captured immediately before a given mixed-environment campaign starts.

## File Structure

### New Files To Create

- `scripts/lib/rl-browser-v1/schema.mjs`
  - browser adapter-specific validation for normalized browser task, browser evidence, and browser holdout result payloads.
- `scripts/lib/rl-browser-v1/task-registry.mjs`
  - controlled browser flow registry, admission filters, and deterministic task sampling.
- `scripts/lib/rl-browser-v1/browser-runner.mjs`
  - browser step execution wrapper that records structured page/action evidence from controlled flows.
- `scripts/lib/rl-browser-v1/adapter.mjs`
  - adapter entry points: `sampleTask`, `runEpisode`, `compareAgainstReference`, `buildReplayCandidate`, `summarizeEnvironmentEvidence`.
- `scripts/lib/rl-browser-v1/eval-harness.mjs`
  - browser holdout and comparison helpers for success rate, comparison-failed rate, and shell-safety-compatible reporting.
- `scripts/lib/rl-orchestrator-v1/schema.mjs`
  - orchestrator adapter-specific validation for control-decision tasks, evidence, and holdout result payloads.
- `scripts/lib/rl-orchestrator-v1/task-registry.mjs`
  - high-signal orchestrator control-task sampler for dispatch/retry/stop/handoff/preflight episodes.
- `scripts/lib/rl-orchestrator-v1/decision-runner.mjs`
  - control-decision execution helper built on top of existing orchestrator harness modules.
- `scripts/lib/rl-orchestrator-v1/adapter.mjs`
  - adapter entry points mirroring the browser adapter but for orchestration decisions.
- `scripts/lib/rl-orchestrator-v1/eval-harness.mjs`
  - orchestrator holdout and comparison helpers for decision success rate and missed-handoff reporting.
- `scripts/lib/rl-mixed-v1/run-orchestrator.mjs`
  - mixed campaign runner that pulls from shell/browser/orchestrator adapters and feeds `RL Core`.
- `scripts/lib/rl-mixed-v1/contextdb-summary.mjs`
  - mixed-campaign summary builder and writer with per-environment breakdowns.
- `scripts/tests/rl-core-mixed-schema.test.mjs`
- `scripts/tests/rl-core-mixed-campaign-controller.test.mjs`
- `scripts/tests/rl-browser-v1-schema.test.mjs`
- `scripts/tests/rl-browser-v1-task-registry.test.mjs`
- `scripts/tests/rl-browser-v1-adapter.test.mjs`
- `scripts/tests/rl-browser-v1-eval-harness.test.mjs`
- `scripts/tests/rl-orchestrator-v1-schema.test.mjs`
- `scripts/tests/rl-orchestrator-v1-task-registry.test.mjs`
- `scripts/tests/rl-orchestrator-v1-adapter.test.mjs`
- `scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`
- `scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`
- `scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs`
- `scripts/tests/rl-mixed-v1-cli.test.mjs`
- `scripts/rl-mixed-v1.mjs`
  - CLI entrypoint for browser-only, orchestrator-only, and mixed campaign runs.

### Existing Files To Modify

- `scripts/lib/rl-core/contracts.mjs`
  - add mixed-environment constants, safety-violation enums, and holdout result status enums.
- `scripts/lib/rl-core/schema.mjs`
  - validate environment-tagged episodes, mixed live-batch summaries, holdout results, and safety-violation fields.
- `scripts/lib/rl-core/replay-pool.mjs`
  - enforce deterministic `comparison_failed -> diagnostic_only` routing and preserve environment metadata.
- `scripts/lib/rl-core/comparison-engine.mjs`
  - add deterministic epoch aggregation helpers and mixed-environment summary helpers.
- `scripts/lib/rl-core/campaign-controller.mjs`
  - support dynamic `active_environments`, idle/backoff policy, holdout-driven coverage checks, and shell-safety gate hooks.
- `scripts/lib/rl-shell-v1/schema.mjs`
  - emit/read `schema_version`, `environment`, and `safety_violation` fields compatible with mixed campaigns.
- `scripts/lib/rl-shell-v1/eval-harness.mjs`
  - expose shell holdout validation helpers reusable by mixed campaigns.
- `scripts/lib/harness/orchestrator.mjs`
  - expose stable hooks the orchestrator RL adapter can call for dispatch/retry/stop/handoff/preflight decision execution and evidence collection.
- `scripts/lib/harness/orchestrator-evidence.mjs`
  - add adapter-friendly compact evidence summaries.
- `mcp-server/src/browser/index.ts`
  - expose or stabilize browser runner hooks required by RL browser flows if current exports are insufficient.
- `mcp-server/src/browser/actions/snapshot.ts`
  - ensure structured snapshot output can be compacted into browser RL evidence without full DOM dumps.
- `mcp-server/src/browser/actions/auth-check.ts`
  - support browser RL auth-state and challenge-state normalization.
- `mcp-server/src/browser/actions/challenge-check.ts`
  - support browser RL challenge detection in matched comparison and teacher triggers.
- `README.md`
  - document `rl-mixed-v1`, browser/orchestrator adapters, and the new mixed-environment test script.
- `package.json`
  - add `test:rl-browser-v1`, `test:rl-orchestrator-v1`, and `test:rl-mixed-v1`.

## Chunk 1: Mixed RL Core Contracts And Controller

### Task 1: Extend `RL Core` contracts for mixed environments, safety, and holdouts

**Files:**
- Modify: `scripts/lib/rl-core/contracts.mjs`
- Modify: `scripts/lib/rl-core/schema.mjs`
- Create: `scripts/tests/rl-core-mixed-schema.test.mjs`
- Modify: `scripts/tests/rl-core-schema.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/schema.mjs`
- Modify: `scripts/tests/rl-shell-v1-schema.test.mjs`

- [ ] **Step 1: Write failing mixed-contract tests**

Add tests covering:

```js
assert.doesNotThrow(() => validateMixedEpisode({
  schema_version: 1,
  environment: 'browser',
  task_family: 'publish-flow',
  teacher_triggered: false,
  teacher_trigger_reason: null,
  boundary_episode: false,
  terminal_reward: 1,
  comparison_status: 'completed',
  relative_outcome: 'better',
  replay_route: 'positive',
  safety_violation: false,
  safety_violation_reason: null,
}));

assert.throws(
  () => validateMixedEpisode({
    schema_version: 1,
    environment: 'orchestrator',
    comparison_status: 'comparison_failed',
    relative_outcome: null,
    replay_route: 'neutral',
  }),
  /diagnostic_only/i
);

assert.deepEqual(
  readShellEpisodeForDiagnosis({
    task_id: 'legacy-shell-1',
    terminal_reward: 0,
    comparison_status: 'completed',
  }).legacyCompatibility,
  {
    schemaVersion: 'v0',
    replayEligible: false,
  }
);
```

Also add an explicit migration-rule test in `scripts/tests/rl-shell-v1-schema.test.mjs` proving a legacy shell episode without `schema_version` remains readable for diagnosis but is replay-ineligible by default.

- [ ] **Step 2: Run the new schema tests to verify failure**

Run: `node --test scripts/tests/rl-core-mixed-schema.test.mjs scripts/tests/rl-core-schema.test.mjs scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: FAIL because mixed-environment validators and new shell compatibility rules do not exist yet.

- [ ] **Step 3: Implement mixed-environment contract support**

Add to `rl-core/contracts.mjs`:

- environment enums,
- holdout result status enums,
- safety violation enums,
- mixed batch summary constants.

Add to `rl-core/schema.mjs` validators for:

- mixed episode metadata,
- mixed batch summaries,
- holdout validation results,
- safety violation fields,
- idle/no-work terminal summary fields.

Update `rl-shell-v1/schema.mjs` to:

- dual-read shell legacy episodes,
- require `schema_version: 1` for newly emitted shell episodes,
- preserve backward compatibility for diagnostic reads,
- surface a deterministic legacy compatibility marker consumed by replay admission so `v0` shell episodes cannot silently enter mixed replay.

- [ ] **Step 4: Re-run the schema suites**

Run: `node --test scripts/tests/rl-core-mixed-schema.test.mjs scripts/tests/rl-core-schema.test.mjs scripts/tests/rl-shell-v1-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-core/contracts.mjs scripts/lib/rl-core/schema.mjs scripts/tests/rl-core-mixed-schema.test.mjs scripts/tests/rl-core-schema.test.mjs scripts/lib/rl-shell-v1/schema.mjs scripts/tests/rl-shell-v1-schema.test.mjs
git commit -m "feat(rl-core): add mixed environment contracts"
```

### Task 2: Extend the campaign controller for dynamic environments, holdout coverage, and idle policy

**Files:**
- Modify: `scripts/lib/rl-core/comparison-engine.mjs`
- Modify: `scripts/lib/rl-core/campaign-controller.mjs`
- Modify: `scripts/lib/rl-core/replay-pool.mjs`
- Create: `scripts/tests/rl-core-mixed-campaign-controller.test.mjs`
- Modify: `scripts/tests/rl-core-campaign-controller.test.mjs`
- Modify: `scripts/tests/rl-core-replay-pool.test.mjs`

- [ ] **Step 1: Write failing controller tests for dynamic environment coverage and idle handling**

Add tests like:

```js
assert.equal(
  computeEpochOutcome({
    activeEnvironments: ['shell', 'browser', 'orchestrator'],
    betterCount: 1,
    worseCount: 0,
    comparisonFailedCount: 0,
    coverageSatisfied: false,
    shellSafetyGatePassed: true,
  }).outcome,
  'replay_only'
);

assert.equal(
  runOnlineCampaign({
    activeEnvironments: ['browser'],
    idleBackoffBudget: 2,
    sampleTask: () => null,
    holdoutValidator: () => ({ status: 'not_requested' }),
  }).status,
  'no_work_available'
);

assert.equal(
  reduceDegradationStreak([
    { relativeOutcome: 'worse' },
    { relativeOutcome: 'same' },
    { relativeOutcome: 'comparison_failed' },
    { relativeOutcome: 'worse' },
  ]).shouldRollback,
  true
);

assert.equal(
  computeEpochOutcome({
    activeEnvironments: ['shell', 'browser'],
    degradationStreak: 3,
    coverageSatisfied: false,
    shellSafetyGatePassed: false,
  }).outcome,
  'rollback'
);

assert.equal(
  evaluateShellSafetyGateCalls({
    candidateOutcome: 'replay_only',
    shellSafetyGate: () => { throw new Error('must not run'); },
  }).called,
  false
);
```

Also add one explicit replay-pool test asserting a legacy shell `v0` episode is retained as diagnostic evidence but is never admitted as a replay-training candidate.

- [ ] **Step 2: Run the controller tests to verify failure**

Run: `node --test scripts/tests/rl-core-mixed-campaign-controller.test.mjs scripts/tests/rl-core-campaign-controller.test.mjs scripts/tests/rl-core-replay-pool.test.mjs`
Expected: FAIL because dynamic active-environment logic, shell-safety gate hooks, and no-work terminal behavior do not exist yet.

- [ ] **Step 3: Implement deterministic mixed-controller behavior**

Update `rl-core/comparison-engine.mjs` to expose:

- epoch-close aggregation helpers,
- mixed-environment summary counters,
- deterministic precedence rules for `rollback`, `replay_only`, `promotion_eligible`, `no_work_available`,
- a sequential degradation-streak reducer that increments on `worse` and `comparison_failed`, leaves `same` unchanged, resets on `better`, and triggers rollback at streak `>= 3` in arrival order.

Update `rl-core/campaign-controller.mjs` to support:

- `activeEnvironments` config,
- idle poll counter and backoff budget,
- holdout result injection,
- shell-safety gate callback,
- consistent `no_work_available` terminal status,
- explicit decision-table fixtures for epoch close so every terminal state is reproducible in tests.

Update `rl-core/replay-pool.mjs` so `comparison_failed`, `safety_violation`, and legacy shell `v0` compatibility markers always route to `diagnostic_only`.

- [ ] **Step 4: Re-run controller and replay tests**

Run: `node --test scripts/tests/rl-core-mixed-campaign-controller.test.mjs scripts/tests/rl-core-campaign-controller.test.mjs scripts/tests/rl-core-replay-pool.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-core/comparison-engine.mjs scripts/lib/rl-core/campaign-controller.mjs scripts/lib/rl-core/replay-pool.mjs scripts/tests/rl-core-mixed-campaign-controller.test.mjs scripts/tests/rl-core-campaign-controller.test.mjs scripts/tests/rl-core-replay-pool.test.mjs
git commit -m "feat(rl-core): add mixed campaign control rules"
```

## Chunk 2: Browser RL Adapter

### Task 3: Add browser task registry and schema for controlled real flows

**Files:**
- Create: `scripts/lib/rl-browser-v1/schema.mjs`
- Create: `scripts/lib/rl-browser-v1/task-registry.mjs`
- Create: `scripts/tests/rl-browser-v1-schema.test.mjs`
- Create: `scripts/tests/rl-browser-v1-task-registry.test.mjs`
- Modify: `config/browser-profiles.json` only if test fixtures need a stable synthetic profile entry

- [ ] **Step 1: Write failing browser schema and task-registry tests**

Add tests covering:

```js
assert.doesNotThrow(() => validateBrowserTask({
  task_id: 'browser-publish-001',
  flow_id: 'publish-sequence',
  start_url: 'https://example.test/publish',
  success_selector: '[data-status=\"published\"]',
  challenge_selector: '#captcha',
}));

assert.equal(sampleBrowserTask({ seed: 17, tasks }).task_id, 'browser-publish-001');

assert.equal(
  sampleBrowserTask({
    seed: 17,
    tasks: [{ task_id: 'open-web', exploration_mode: 'open-ended' }],
  }),
  null
);

assert.equal(
  sampleBrowserTask({
    seed: 18,
    tasks: [{ task_id: 'unsafe-outbound', sensitive_action_flag: true, flow_constraints: null }],
  }),
  null
);

assert.doesNotThrow(() => validateBrowserEvidence({
  page_kind: 'publish-form',
  key_selectors_present: ['[data-form]'],
  form_state: 'dirty',
  action_taken: 'submit',
  navigation_result: 'same-page',
  form_error: 'title-required',
  auth_state: 'authenticated',
  challenge_state: 'none',
  sensitive_action_flag: false,
  terminal_status: 'validation_error',
}));

assert.doesNotThrow(() => validateBrowserHoldoutResult({
  episode_count: 20,
  success_rate: 0.65,
  comparison_failed_rate: 0.15,
  schema_validation_failures: 0,
}));
```

- [ ] **Step 2: Run browser schema/task tests to verify failure**

Run: `node --test scripts/tests/rl-browser-v1-schema.test.mjs scripts/tests/rl-browser-v1-task-registry.test.mjs`
Expected: FAIL because the browser adapter modules do not exist yet.

- [ ] **Step 3: Implement browser schema and deterministic task sampling**

`schema.mjs` should validate:

- controlled flow task shape,
- browser evidence shape,
- holdout validation result shape.

`task-registry.mjs` should:

- load controlled browser tasks,
- enforce high-signal flow constraints,
- reject open-ended browsing, broad exploration, unconstrained search, and unsafe outbound flow definitions,
- sample tasks deterministically by seed/attempt,
- surface `null` when no admissible browser task exists.

- [ ] **Step 4: Re-run browser schema/task tests**

Run: `node --test scripts/tests/rl-browser-v1-schema.test.mjs scripts/tests/rl-browser-v1-task-registry.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-browser-v1/schema.mjs scripts/lib/rl-browser-v1/task-registry.mjs scripts/tests/rl-browser-v1-schema.test.mjs scripts/tests/rl-browser-v1-task-registry.test.mjs
git commit -m "feat(rl-browser): add browser task contracts"
```

If `config/browser-profiles.json` was not changed for fixtures, leave it out of this commit.

### Task 4: Implement the browser adapter and browser holdout evaluation

**Files:**
- Create: `scripts/lib/rl-browser-v1/browser-runner.mjs`
- Create: `scripts/lib/rl-browser-v1/adapter.mjs`
- Create: `scripts/lib/rl-browser-v1/eval-harness.mjs`
- Create: `scripts/tests/rl-browser-v1-adapter.test.mjs`
- Create: `scripts/tests/rl-browser-v1-eval-harness.test.mjs`
- Modify: `mcp-server/src/browser/actions/snapshot.ts`
- Modify: `mcp-server/src/browser/actions/auth-check.ts`
- Modify: `mcp-server/src/browser/actions/challenge-check.ts`
- Modify: `mcp-server/src/browser/index.ts`

- [ ] **Step 1: Write failing browser adapter tests**

Add tests covering:

```js
const task = {
  task_id: 'browser-publish-001',
  target_site: 'example.test',
  flow_id: 'publish-sequence',
  start_url: 'https://example.test/publish',
  comparison_start_url: 'https://example.test/publish',
  auth_state_class: 'authenticated',
  input_payload: { title: 'Hello' },
};

const episode = await runBrowserEpisode({
  task,
  checkpointId: 'ckpt-browser-1',
  browserDriver: fixtureBrowserDriver,
});
assert.equal(episode.environment, 'browser');
assert.equal(episode.teacher_triggered, false);
assert.equal(episode.safety_violation, false);

const comparison = await compareBrowserAgainstReference({
  task,
  activeCheckpointId: 'ckpt-browser-2',
  preUpdateRefCheckpointId: 'ckpt-browser-1',
  browserDriver: fixtureBrowserDriver,
});
assert.equal(comparison.comparison_status, 'completed');
assert.equal(['better', 'same', 'worse'].includes(comparison.relative_outcome), true);

assert.equal(
  await compareBrowserAgainstReference({
    task: { ...task, forceChallengeDivergenceTwice: true },
    activeCheckpointId: 'ckpt-browser-2',
    preUpdateRefCheckpointId: 'ckpt-browser-1',
    browserDriver: fixtureBrowserDriver,
  }).then((result) => result.comparison_status),
  'comparison_failed'
);

assert.equal(
  await compareBrowserAgainstReference({
    task: { ...task, requireHumanReauth: true },
    activeCheckpointId: 'ckpt-browser-2',
    preUpdateRefCheckpointId: 'ckpt-browser-1',
    browserDriver: fixtureBrowserDriver,
  }).then((result) => ({
    replayRoute: result.replay_route,
    handoffTriggered: result.human_handoff_required,
  })),
  { replayRoute: 'diagnostic_only', handoffTriggered: true }
);

await assert.rejects(
  () => runBrowserEpisode({
    task,
    checkpointId: 'ckpt-browser-1',
    browserDriver: brokenBrowserDriver,
  }),
  /infrastructure/i
);
```

Also add explicit tests that:
- `runEpisode` returns in-band failure evidence for auth/challenge/validation failures instead of throwing,
- `compareAgainstReference` pins `target_site`, `flow_id`, `start_url`, `comparison_start_url`, `auth_state_class`, and `input_payload`,
- browser comparison gets only one automatic retry before returning `comparison_failed`.
- browser episode payloads include shared normative fields: `schema_version`, `environment`, `task_family`, `teacher_triggered`, `teacher_trigger_reason`, `boundary_episode`, `terminal_reward`, `comparison_status`, `relative_outcome`, and `replay_route`.
- adapter infrastructure failures throw and are later normalized into diagnostic evidence / replay-ineligible controller outcomes.

- [ ] **Step 2: Run browser adapter tests to verify failure**

Run: `node --test scripts/tests/rl-browser-v1-adapter.test.mjs scripts/tests/rl-browser-v1-eval-harness.test.mjs`
Expected: FAIL because the browser runner/adapter/eval modules do not exist yet.

- [ ] **Step 3: Implement browser runner and adapter**

`browser-runner.mjs` should:

- execute controlled browser flows only,
- record structured page/action evidence,
- detect auth/challenge/validation failure,
- emit `safety_violation` for unsafe outbound actions or policy violations.

`adapter.mjs` should implement:

- `sampleTask`
- `runEpisode`
- `compareAgainstReference`
- `buildReplayCandidate`
- `summarizeEnvironmentEvidence`
- full shared episode contract emission before replay admission,
- browser reproducibility rules that pin start URL, auth-state class, input payload, and one-retry comparison semantics,
- re-auth-required and irreproducible flows as `comparison_failed` with `diagnostic_only` replay routing.

Teacher policy in this adapter:

- `teacher_triggered = true` only for failed or near-success boundary episodes.

`eval-harness.mjs` should expose:

- episode count,
- browser holdout success rate,
- browser comparison-failed rate,
- schema validation failure count,
- holdout result payloads usable by the mixed campaign runner.

- [ ] **Step 4: Re-run browser adapter and eval tests**

Run: `node --test scripts/tests/rl-browser-v1-adapter.test.mjs scripts/tests/rl-browser-v1-eval-harness.test.mjs`
Expected: PASS, including fixture assertions for reproducibility rules, `comparison_failed` fallback behavior, and holdout payload fields.

Run: `cd mcp-server && npm run typecheck && npm run build`
Expected: PASS because Chunk 2 modifies browser-side TypeScript modules used by the adapter.

Run a browser action smoke sequence against the local MCP browser server:
- `browser_launch {"profile":"default","visible":true}`
- `browser_navigate` to a controlled test page
- `browser_snapshot`
- `browser_auth_check`
- `browser_challenge_check`
- `browser_close`
Expected: snapshot/auth/challenge payloads retain the compact structured fields consumed by the browser adapter.

Run a real browser holdout sweep:
`node --input-type=module -e \"import { runBrowserHoldout } from './scripts/lib/rl-browser-v1/eval-harness.mjs'; import { loadBrowserTasks } from './scripts/lib/rl-browser-v1/task-registry.mjs'; const tasks = loadBrowserTasks().slice(0, 20); const result = await runBrowserHoldout({ tasks, checkpointId: 'candidate', browserDriver: 'fixture-browser-driver' }); console.log(JSON.stringify(result));\"`
Expected: JSON output with `episode_count >= 20`, `schema_validation_failures === 0`, and `comparison_failed_rate <= 0.20`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-browser-v1/browser-runner.mjs scripts/lib/rl-browser-v1/adapter.mjs scripts/lib/rl-browser-v1/eval-harness.mjs scripts/tests/rl-browser-v1-adapter.test.mjs scripts/tests/rl-browser-v1-eval-harness.test.mjs mcp-server/src/browser/actions/snapshot.ts mcp-server/src/browser/actions/auth-check.ts mcp-server/src/browser/actions/challenge-check.ts mcp-server/src/browser/index.ts
git commit -m "feat(rl-browser): add browser rl adapter"
```

## Chunk 3: Orchestrator RL Adapter

### Task 5: Add orchestrator task registry and schema for high-signal control decisions

**Files:**
- Create: `scripts/lib/rl-orchestrator-v1/schema.mjs`
- Create: `scripts/lib/rl-orchestrator-v1/task-registry.mjs`
- Create: `scripts/tests/rl-orchestrator-v1-schema.test.mjs`
- Create: `scripts/tests/rl-orchestrator-v1-task-registry.test.mjs`
- Modify: `memory/specs/orchestrator-work-item-telemetry.schema.json` only if new evidence fields are required

- [ ] **Step 1: Write failing orchestrator schema and task-registry tests**

Add tests covering:

```js
assert.doesNotThrow(() => validateOrchestratorTask({
  task_id: 'orch-dispatch-001',
  decision_type: 'dispatch',
  context_snapshot_id: 'ctx-1',
  expected_executor: 'local-phase',
}));

assert.deepEqual(
  tasks.map((task) => task.decision_type).sort(),
  ['dispatch', 'handoff', 'preflight', 'retry', 'stop']
);

assert.equal(sampleOrchestratorTask({ seed: 29, attempt: 0, tasks }).decision_type, 'dispatch');
assert.equal(sampleOrchestratorTask({ seed: 29, attempt: 1, tasks }).decision_type, 'retry');
```

Also add explicit admissibility tests proving unconstrained plan-writing tasks are rejected and only `dispatch/retry/stop/handoff/preflight` are admitted.
Also add explicit admissibility tests proving tasks with no hard downstream verification evidence are rejected.

- [ ] **Step 2: Run orchestrator schema/task tests to verify failure**

Run: `node --test scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-task-registry.test.mjs`
Expected: FAIL because orchestrator adapter modules do not exist yet.

- [ ] **Step 3: Implement orchestrator schema and task registry**

`schema.mjs` should validate:

- control-decision task shape,
- orchestrator evidence shape,
- orchestrator holdout result shape.

`task-registry.mjs` should:

- build admissible tasks for `dispatch/retry/stop/handoff/preflight`,
- reject unconstrained plan-writing tasks,
- reject tasks that lack hard downstream verification evidence,
- sample deterministically by seed/attempt.

- [ ] **Step 4: Re-run orchestrator schema/task tests**

Run: `node --test scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-task-registry.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-orchestrator-v1/schema.mjs scripts/lib/rl-orchestrator-v1/task-registry.mjs scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-task-registry.test.mjs memory/specs/orchestrator-work-item-telemetry.schema.json
git commit -m "feat(rl-orchestrator): add orchestrator task contracts"
```

### Task 6: Implement the orchestrator adapter and control-decision holdout evaluation

**Files:**
- Create: `scripts/lib/rl-orchestrator-v1/decision-runner.mjs`
- Create: `scripts/lib/rl-orchestrator-v1/adapter.mjs`
- Create: `scripts/lib/rl-orchestrator-v1/eval-harness.mjs`
- Create: `scripts/tests/rl-orchestrator-v1-adapter.test.mjs`
- Create: `scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Modify: `scripts/lib/harness/orchestrator-evidence.mjs`

- [ ] **Step 1: Write failing orchestrator adapter tests**

Add tests covering:

```js
const task = {
  task_id: 'orch-dispatch-001',
  decision_type: 'dispatch',
  context_snapshot_id: 'ctx-1',
  expected_executor: 'local-phase',
};

const episode = await runOrchestratorEpisode({
  task,
  checkpointId: 'ckpt-orch-1',
  harness: fixtureOrchestratorHarness,
});
assert.equal(episode.environment, 'orchestrator');
assert.equal(['dispatch', 'retry', 'stop', 'handoff', 'preflight'].includes(episode.task_family), true);
assert.equal(typeof episode.teacher_triggered, 'boolean');
assert.equal(['failure', 'boundary', null].includes(episode.teacher_trigger_reason), true);
assert.equal(typeof episode.boundary_episode, 'boolean');
assert.equal(episode.terminal_reward >= -1 && episode.terminal_reward <= 1, true);
assert.equal(['completed', 'comparison_failed'].includes(episode.comparison_status), true);
assert.equal(['positive', 'negative', 'neutral', 'diagnostic_only'].includes(episode.replay_route), true);
assert.equal(typeof episode.context_state, 'object');
assert.equal(typeof episode.decision_type, 'string');
assert.equal(typeof episode.decision_payload, 'object');
assert.equal(typeof episode.executor_selected, 'string');
assert.equal(typeof episode.preflight_selected, 'boolean');
assert.equal(typeof episode.verification_result, 'string');
assert.equal(typeof episode.handoff_triggered, 'boolean');
assert.equal(typeof episode.terminal_outcome, 'string');

const comparison = await compareOrchestratorAgainstReference({
  task,
  activeCheckpointId: 'ckpt-orch-2',
  preUpdateRefCheckpointId: 'ckpt-orch-1',
  harness: fixtureOrchestratorHarness,
});
assert.equal(new Set(['better', 'same', 'worse', 'comparison_failed']).has(comparison.relative_outcome || comparison.comparison_status), true);

const replay = buildOrchestratorReplayCandidate({ episode, comparison });
assert.equal(typeof replay.replay_route, 'string');

const evidence = summarizeOrchestratorEnvironmentEvidence({ episode, comparison });
assert.equal(typeof evidence.decision_type, 'string');

const holdout = await runOrchestratorHoldout({
  tasks: fixtureHoldoutTasks,
  checkpointId: 'ckpt-orch-2',
  harness: fixtureOrchestratorHarness,
});
assert.equal(typeof holdout.decision_success_rate, 'number');
assert.equal(typeof holdout.missed_handoff_rate, 'number');
assert.equal(typeof holdout.comparison_failed_rate, 'number');
assert.equal(typeof holdout.schema_validation_failures, 'number');

assert.deepEqual(
  [
    classifyTeacherTrigger({ terminalOutcome: 'failed', boundaryEpisode: false }),
    classifyTeacherTrigger({ terminalOutcome: 'partial', boundaryEpisode: true }),
    classifyTeacherTrigger({ terminalOutcome: 'success', boundaryEpisode: false }),
  ],
  [
    { teacher_triggered: true, teacher_trigger_reason: 'failure' },
    { teacher_triggered: true, teacher_trigger_reason: 'boundary' },
    { teacher_triggered: false, teacher_trigger_reason: null },
  ]
);
```

Also add explicit tests that:
- `compareAgainstReference` marks irreproducible control contexts as `comparison_failed`,
- replay candidates from `comparison_failed` comparisons route to `diagnostic_only`,
- `runEpisode` returns control failures in-band and throws only on harness infrastructure faults.

- [ ] **Step 2: Run orchestrator adapter tests to verify failure**

Run: `node --test scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`
Expected: FAIL because the orchestrator runner/adapter/eval modules do not exist yet.

- [ ] **Step 3: Implement orchestrator runner and adapter**

`decision-runner.mjs` should wrap existing harness orchestration primitives and emit compact evidence.

Keep `scripts/lib/harness/orchestrator.mjs` changes minimal. New RL-specific decision logic should live in `decision-runner.mjs` rather than expanding the already-large harness file.

`adapter.mjs` should implement:

- `sampleTask`
- `runEpisode`
- `compareAgainstReference`
- `buildReplayCandidate`
- `summarizeEnvironmentEvidence`
- deterministic matched-comparison reproducibility rules that pin task context snapshot, available executors, available preflight actions, stop/handoff policy inputs, and the evidence packet,
- one transient retry budget before returning `comparison_failed` for irreproducible control contexts.
- normalized orchestrator evidence fields: `context_state`, `decision_type`, `decision_payload`, `executor_selected`, `preflight_selected`, `verification_result`, `handoff_triggered`, and `terminal_outcome`.

Teacher policy in this adapter:

- trigger only on failed or near-success boundary control decisions.

`eval-harness.mjs` should compute:

- decision success rate,
- missed-handoff rate,
- comparison-failed rate,
- schema validation failure count,
- holdout result payloads consumable by mixed campaigns.

- [ ] **Step 4: Re-run orchestrator adapter and eval tests**

Run: `node --test scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`
Expected: PASS, including fixture assertions for all five decision families, replay/evidence helpers, and `comparison_failed` fallback semantics.

Run: `node --test scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs --test-name-pattern \"gate fixture\"`
Expected: PASS with a returned payload containing `episode_count`, `decision_success_rate`, `missed_handoff_rate`, `comparison_failed_rate`, and `schema_validation_failures`, where `episode_count >= 20`, `schema_validation_failures === 0`, and `comparison_failed_rate <= 0.20`.

Run a real holdout sweep:
`node --input-type=module -e \"import { runOrchestratorHoldout } from './scripts/lib/rl-orchestrator-v1/eval-harness.mjs'; import { loadRealOrchestratorTasks } from './scripts/lib/rl-orchestrator-v1/task-registry.mjs'; import { createCiFixtureOrchestratorHarness } from './scripts/lib/rl-orchestrator-v1/decision-runner.mjs'; const tasks = loadRealOrchestratorTasks().slice(0, 20); const harness = createCiFixtureOrchestratorHarness(); const result = await runOrchestratorHoldout({ tasks, checkpointId: 'candidate', harness }); console.log(JSON.stringify(result));\"`
Expected: JSON output with `episode_count >= 20`, `schema_validation_failures === 0`, `comparison_failed_rate <= 0.20`, and the full gate metric set.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-orchestrator-v1/decision-runner.mjs scripts/lib/rl-orchestrator-v1/adapter.mjs scripts/lib/rl-orchestrator-v1/eval-harness.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs scripts/lib/harness/orchestrator.mjs scripts/lib/harness/orchestrator-evidence.mjs
git commit -m "feat(rl-orchestrator): add orchestrator rl adapter"
```

## Chunk 4: Mixed Campaign Runner, Validation, And Operator Surface

### Task 7: Add the mixed campaign runner and summary writer

**Files:**
- Create: `scripts/lib/rl-mixed-v1/run-orchestrator.mjs`
- Create: `scripts/lib/rl-mixed-v1/contextdb-summary.mjs`
- Create: `scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`
- Create: `scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs`
- Modify: `scripts/lib/rl-shell-v1/eval-harness.mjs`

- [ ] **Step 1: Write failing mixed-runner tests**

Add tests covering:

```js
const result = await runMixedCampaign({
  adapters: { shell, browser, orchestrator },
  activeEnvironments: ['shell', 'browser', 'orchestrator'],
});
assert.equal(result.status, 'ok');
assert.equal(result.summary.environment_counts.shell > 0, true);
assert.equal(result.summary.environment_counts.browser > 0, true);
assert.equal(result.summary.environment_counts.orchestrator > 0, true);
assert.equal(result.summary.mixed_batch_count >= 3, true);
assert.equal(result.summary.batch_combinations.includes('browser+orchestrator'), true);
assert.equal(result.summary.batch_combinations.some((combo) => combo.includes('shell+browser') || combo.includes('shell+orchestrator')), true);

assert.equal(
  computeMixedEpochOutcome({
    coverage_sufficient: false,
    shell_safety_gate_passed: true,
    comparison_failed_count: 0,
    degradation_streak: 0,
  }).epoch_outcome,
  'replay_only'
);

assert.equal(
  computeMixedEpochOutcome({
    coverage_sufficient: true,
    shell_safety_gate_passed: false,
    comparison_failed_count: 0,
    degradation_streak: 0,
  }).epoch_outcome,
  'replay_only'
);

assert.equal(
  computeMixedEpochOutcome({
    coverage_sufficient: true,
    shell_safety_gate_passed: true,
    comparison_failed_count: 1,
    degradation_streak: 0,
  }).epoch_outcome,
  'replay_only'
);

assert.equal(
  computeMixedEpochOutcome({
    coverage_sufficient: true,
    shell_safety_gate_passed: true,
    comparison_failed_count: 0,
    degradation_streak: 3,
  }).epoch_outcome,
  'rollback'
);
```

- [ ] **Step 2: Run mixed-runner tests to verify failure**

Run: `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs`
Expected: FAIL because the mixed runner and summary writer do not exist yet.

- [ ] **Step 3: Implement the mixed runner**

`run-orchestrator.mjs` should:

- compose shell, browser, and orchestrator adapters,
- respect dynamic `activeEnvironments`,
- drive mixed live batches through `RL Core`,
- request holdout validations,
- compute shell-safety gate,
- expose deterministic `no_work_available`, `replay_only`, `promotion_eligible`, and rollback results.

`contextdb-summary.mjs` should:

- output per-environment counts,
- output rollback/resume drill evidence,
- output baseline freeze checkpoint ids and holdout validation outcomes.

Update `rl-shell-v1/eval-harness.mjs` to export shell holdout helpers reusable by the mixed runner.

Implement explicit drill helpers in the mixed runner for:
- one induced rollback drill that reaches `degradation_streak >= 3`,
- one resume-from-snapshot drill that proves `duplicateEventApplications = 0`.

- [ ] **Step 4: Re-run mixed-runner tests**

Run: `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs`
Expected: PASS, including assertions for shell participation, `>= 3` mixed batches, required batch combinations, `coverage_sufficient`, `shell_safety_gate_passed`, `comparison_failed_count`, `epoch_outcome`, rollback drill evidence, resume drill evidence, and deterministic statuses `no_work_available`, `replay_only`, `promotion_eligible`, and `rollback`.

Run a rollback drill:
`node --input-type=module -e \"import { runMixedCampaign } from './scripts/lib/rl-mixed-v1/run-orchestrator.mjs'; const result = await runMixedCampaign({ mode: 'drill-rollback', activeEnvironments: ['shell','browser','orchestrator'] }); console.log(JSON.stringify(result.summary.drills.rollback));\"`
Expected: JSON output with `degradation_streak >= 3`, one `rollback-completed-*` event id, restored `active_checkpoint_id`, and `control_mode === 'collection'`.

Run a resume drill:
`node --input-type=module -e \"import { runMixedCampaign } from './scripts/lib/rl-mixed-v1/run-orchestrator.mjs'; const result = await runMixedCampaign({ mode: 'drill-resume', activeEnvironments: ['shell','browser','orchestrator'] }); console.log(JSON.stringify(result.summary.drills.resume));\"`
Expected: JSON output with `duplicateEventApplications === 0` and resumed checkpoint lineage matching the persisted snapshot.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rl-mixed-v1/run-orchestrator.mjs scripts/lib/rl-mixed-v1/contextdb-summary.mjs scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs scripts/lib/rl-shell-v1/eval-harness.mjs
git commit -m "feat(rl-mixed): add mixed campaign runner"
```

### Task 8: Add CLI/operator entrypoints, docs, and full validation

**Files:**
- Create: `scripts/rl-mixed-v1.mjs`
- Create: `scripts/tests/rl-mixed-v1-cli.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing CLI and package-script tests**

Add tests to `scripts/tests/rl-mixed-v1-cli.test.mjs` covering:

```js
const result = spawnSync('node', ['scripts/rl-mixed-v1.mjs', '--help'], ...);
assert.match(result.stdout.toString(), /browser/i);
assert.match(result.stdout.toString(), /orchestrator/i);
assert.match(result.stdout.toString(), /mixed/i);

for (const argv of [
  ['browser-only', '--dry-run'],
  ['orchestrator-only', '--dry-run'],
  ['mixed', '--dry-run'],
  ['mixed-resume', '--dry-run'],
  ['mixed-eval', '--dry-run'],
]) {
  const run = spawnSync('node', ['scripts/rl-mixed-v1.mjs', ...argv], ...);
  assert.equal(run.status, 0);
  assert.match(run.stdout.toString(), /status|summary|mode/i);
}
```

- [ ] **Step 2: Run entrypoint tests to verify failure**

Run: `node --test scripts/tests/rl-mixed-v1-cli.test.mjs`
Expected: FAIL because the CLI entrypoint does not exist yet.

- [ ] **Step 3: Implement CLI, scripts, and docs**

Add commands for:

- browser-only run,
- orchestrator-only run,
- full mixed campaign,
- mixed resume,
- mixed eval.

Update `package.json` with:

- `test:rl-browser-v1`
- `test:rl-orchestrator-v1`
- `test:rl-mixed-v1`

Update `README.md` with:

- browser/orchestrator adapter overview,
- mixed campaign commands,
- holdout and rollback drill expectations.

- [ ] **Step 4: Run focused validation**

Run:

```bash
npm run test:rl-core
npm run test:rl-shell-v1
node --test scripts/tests/rl-browser-v1-*.test.mjs
node --test scripts/tests/rl-orchestrator-v1-*.test.mjs
node --test scripts/tests/rl-mixed-v1-*.test.mjs
```

Expected: PASS

Run behavioral gate validation on the fixed 30-episode window:
`node scripts/rl-mixed-v1.mjs mixed-eval --window 30 --json-output experiments/rl-mixed-v1/validation/latest.json`
Expected in the JSON artifact:
- `browser.success_rate_delta_pp >= 10`
- `orchestrator.decision_success_rate_delta_pp >= 10`
- `orchestrator.missed_handoff_rate_delta_pp <= 0`
- `overall.better_count_minus_worse_count > 0`
- `shell.holdout_regression_pp <= 5`
- no environment regression exceeds `5` percentage points versus its frozen baseline

- [ ] **Step 5: Commit**

```bash
git add scripts/rl-mixed-v1.mjs scripts/tests/rl-mixed-v1-cli.test.mjs package.json README.md
git commit -m "feat(rl-mixed): add browser and orchestrator rl operator surface"
```

## Verification Checklist

- `node --test scripts/tests/rl-core-mixed-*.test.mjs`
- `node --test scripts/tests/rl-browser-v1-*.test.mjs`
- `node --test scripts/tests/rl-orchestrator-v1-*.test.mjs`
- `node --test scripts/tests/rl-mixed-v1-*.test.mjs`
- `node --test scripts/tests/rl-mixed-v1-cli.test.mjs`
- `npm run test:rl-core`
- `npm run test:rl-shell-v1`
- `node scripts/rl-mixed-v1.mjs mixed-eval --window 30 --json-output experiments/rl-mixed-v1/validation/latest.json`

## Expected Deliverable State

At the end of this plan:

- `RL Core` understands mixed-environment episodes and mixed campaign control,
- browser adapter performs controlled real online RL,
- orchestrator adapter performs control-decision real online RL,
- one mixed runner can train with one shared checkpoint across environments,
- rollback and resume drills are reproducible,
- README and package scripts expose the new operator surface.
