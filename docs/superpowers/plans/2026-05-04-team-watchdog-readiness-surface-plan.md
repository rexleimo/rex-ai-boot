# Team Watchdog Readiness Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a shared `ready/warning/blocked` readiness verdict for watchdog-driven team status, while keeping the existing orchestrate preflight gate as the live-execution blocker.

**Architecture:** Reuse the readiness shape already established by `scripts/lib/lifecycle/preflight-contracts.mjs` instead of inventing a second schema. Convert watchdog recovery decisions into the same verdict vocabulary, thread that state through `team watchdog`, `team status --watch`, and HUD rendering, and leave `orchestrate --preflight auto` as the canonical live guard.

**Tech Stack:** Node.js 22 ESM, existing lifecycle/HUD modules, Node `--test`, filesystem-backed session artifacts.

---

## File Map

- Modify `scripts/lib/lifecycle/watchdog.mjs`: add a watchdog-to-readiness adapter and include the readiness object in watchdog JSON/text output.
- Modify `scripts/lib/lifecycle/team-ops.mjs`: thread watchdog readiness through `team status`, `team status --watch`, and the status summary line.
- Modify `scripts/lib/hud/render.mjs`: render a concise readiness line alongside the existing watch metadata and watchdog summary.
- Modify `scripts/tests/team-watchdog.test.mjs`: cover readiness mapping and watchdog output.
- Modify `scripts/tests/hud-state.test.mjs`: cover readiness propagation into HUD state/rendering.
- Modify `scripts/tests/aios-orchestrator.test.mjs`: keep the existing orchestrate readiness contract as a regression anchor.

## Task 1: Watchdog Readiness Contract

**Files:**
- Modify: `scripts/lib/lifecycle/watchdog.mjs`
- Modify: `scripts/tests/team-watchdog.test.mjs`

- [x] **Step 1: Write the failing tests**

Add tests that assert watchdog recovery decisions map into the shared readiness vocabulary:

```js
import { buildWatchdogReadiness, decideWatchdogRecovery } from '../lib/lifecycle/watchdog.mjs';

test('buildWatchdogReadiness maps observe to ready', () => {
  const readiness = buildWatchdogReadiness(decideWatchdogRecovery({
    commitAgeMinutes: 2,
    fileActivityAgeMinutes: 1,
    logAgeMinutes: 1,
    cpuState: 'active',
  }));

  assert.equal(readiness.verdict, 'ready');
  assert.deepEqual(readiness.nextActions, []);
});

test('buildWatchdogReadiness maps pause to blocked', () => {
  const readiness = buildWatchdogReadiness(decideWatchdogRecovery({
    paused: true,
  }));

  assert.equal(readiness.verdict, 'blocked');
  assert.match(readiness.blockedReasons[0], /pause/i);
});
```

Run:

```bash
node --test scripts/tests/team-watchdog.test.mjs
```

Expected before implementation: `buildWatchdogReadiness` is missing or the verdict assertions fail.

- [x] **Step 2: Implement the minimal adapter**

Add a helper that turns the existing recovery decision into the shared readiness shape:

```js
export function buildWatchdogReadiness(recovery = {}) {
  const decision = String(recovery?.decision || 'observe').trim();
  if (decision === 'observe') {
    return {
      verdict: 'ready',
      blockedReasons: [],
      warnings: [],
      nextActions: Array.isArray(recovery?.nextActions) ? recovery.nextActions : [],
      evidence: [],
    };
  }

  if (decision === 'retry' || decision === 'respawn') {
    return {
      verdict: 'warning',
      blockedReasons: [],
      warnings: [String(recovery?.reason || 'watchdog recovery is recommended')],
      nextActions: Array.isArray(recovery?.nextActions) ? recovery.nextActions : [],
      evidence: [],
    };
  }

  return {
    verdict: 'blocked',
    blockedReasons: [decision],
    warnings: [String(recovery?.reason || 'watchdog recovery is blocked')],
    nextActions: Array.isArray(recovery?.nextActions) ? recovery.nextActions : [],
    evidence: [],
  };
}
```

Then include the readiness object in the JSON/text payload returned by `runTeamWatchdog`.

- [x] **Step 3: Verify the watchdog contract**

Run:

```bash
node --test scripts/tests/team-watchdog.test.mjs
```

Expected: the new readiness tests pass and the existing watchdog recovery tests keep passing.

## Task 2: Team Status And HUD Propagation

**Files:**
- Modify: `scripts/lib/lifecycle/team-ops.mjs`
- Modify: `scripts/lib/hud/render.mjs`
- Modify: `scripts/tests/hud-state.test.mjs`

- [x] **Step 1: Write the failing integration tests**

Add assertions that the watch/status path exposes readiness and prints it in the rendered output:

```js
test('runTeamStatus exposes watchdog readiness in JSON', async () => {
  const result = await runTeamStatus({
    sessionId: 'watchdog-session',
    watchdog: true,
    json: true,
  }, { rootDir, io: fakeIo });

  assert.equal(result.exitCode, 0);
  assert.equal(result.result.watchdog.readiness.verdict, 'ready');
});

test('renderHud prints the watchdog readiness label', () => {
  const text = renderHud({
    generatedAt: new Date().toISOString(),
    selection: { sessionId: 'watchdog-session' },
    latestDispatch: null,
    watchdog: {
      decision: 'observe',
      reason: 'worker activity signals are fresh or inconclusive',
      readiness: { verdict: 'ready', nextActions: [] },
    },
  });

  assert.match(text, /Readiness:\s+ready/i);
});
```

Run:

```bash
node --test scripts/tests/hud-state.test.mjs scripts/tests/team-watchdog.test.mjs
```

Expected before implementation: the JSON output does not yet include `watchdog.readiness`, or the HUD output omits the readiness label.

- [x] **Step 2: Thread readiness through the status pipeline**

Update `runTeamStatus` so the watchdog state returned by `buildTeamWatchdogState` carries the readiness object, and make the non-JSON watch output print a compact line such as:

```js
Watchdog: decision=retry readiness=warning reason=blocked jobs detected without rollback artifacts
```

Keep the existing watch cadence, stall tracking, and skill-candidate output unchanged.

- [x] **Step 3: Render readiness in the HUD**

Extend `renderHud()` so the current session panel shows the same readiness label whenever `state.watchdog.readiness` exists. Keep the line short; the goal is to make the verdict scannable, not to duplicate the full recovery explanation.

- [x] **Step 4: Verify the status and HUD tests**

Run:

```bash
node --test scripts/tests/hud-state.test.mjs scripts/tests/team-watchdog.test.mjs
```

Expected: the watchdog readiness label appears in both the JSON state and the rendered HUD/watch output.

## Task 3: Orchestrate Regression Anchor

**Files:**
- Modify: `scripts/tests/aios-orchestrator.test.mjs`

- [x] **Step 1: Add a regression test for the existing orchestrate contract**

Add one focused assertion that `runOrchestrate({ preflightMode: 'auto', executionMode: 'dry-run' })` still returns the shared `readiness` object, and that blocked live runs still fail with `kind: 'guardrail.preflight-readiness'`.

```js
test('runOrchestrate keeps the shared readiness contract stable', async () => {
  const result = await runOrchestrate({
    rootDir,
    sessionId,
    blueprint: 'feature',
    taskTitle: 'Readiness contract regression',
    dispatchMode: 'local',
    executionMode: 'dry-run',
    preflightMode: 'auto',
  }, { io: fakeIo });

  assert.equal(result.readiness.verdict === 'ready' || result.readiness.verdict === 'blocked', true);
  assert.equal(typeof result.readiness.nextActions?.length, 'number');
});
```

Run:

```bash
node --test scripts/tests/aios-orchestrator.test.mjs scripts/tests/team-watchdog.test.mjs scripts/tests/hud-state.test.mjs
```

Expected before verification: the new assertions either fail or need to be aligned to the exact readiness shape already emitted by orchestrate.

- [x] **Step 2: Keep the orchestrate guard unchanged**

Do not add new CLI flags or a second readiness schema. If the regression test reveals a mismatch, align only the field names and labels so `team watchdog` and `orchestrate` share the same `ready/warning/blocked` vocabulary.

- [x] **Step 3: Final verification**

Run:

```bash
node --test scripts/tests/aios-orchestrator.test.mjs scripts/tests/team-watchdog.test.mjs scripts/tests/hud-state.test.mjs
```

Expected: the watchdog readiness path, HUD rendering, and orchestrate regression checks all pass together.

## Acceptance

- `team watchdog` returns a readiness object with `ready`, `warning`, or `blocked` plus next actions.
- `team status --watch --watchdog` shows the same readiness label in JSON and text output.
- HUD rendering surfaces the readiness label without obscuring the existing stall metadata.
- `orchestrate --preflight auto` keeps its current live-execution guard and shares the same readiness vocabulary.

## Progress

- [x] May 4 competitor refresh summary written to `docs/plans/2026-05-04-harness-agent-competitor-refresh-summary.md`.
- [x] Roadmap and competitor-analysis docs refreshed for the May 4 harness/agent signal.
- [ ] Watchdog readiness adapter implemented.
- [ ] Team status and HUD propagation implemented.
- [ ] Orchestrate regression anchor verified.

## Decision Log

- Reuse the readiness object already established by `preflight-contracts.mjs`; do not invent a second verdict schema.
- Map watchdog `observe` to `ready`, `retry`/`respawn` to `warning`, and `pause`/`rollback` to `blocked` so operators can distinguish “safe to continue” from “needs intervention”.
- Keep the live guard on orchestrate exactly where it already is; this plan is about visibility and consistency, not a new blocking policy.

## Acceptance Evidence

- `node --test scripts/tests/team-watchdog.test.mjs scripts/tests/hud-state.test.mjs scripts/tests/aios-orchestrator.test.mjs`
- `git diff --check`

## Next Actions

- Implement Task 1 first, then thread the same verdict through Task 2.
- Re-run the three focused test files after every step.
- If the orchestrate regression test reveals a naming mismatch, update the label only; do not change the live guard semantics.
