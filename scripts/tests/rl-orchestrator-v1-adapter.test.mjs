import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function makeTask(overrides = {}) {
  return {
    task_id: 'orch-dispatch-001',
    decision_type: 'dispatch',
    context_snapshot_id: 'ctx-1',
    expected_executor: 'local-phase',
    hard_verification_evidence: ['verify:dispatch'],
    available_executors: ['local-phase', 'local-control'],
    available_preflight_actions: ['auth-check', 'doctor'],
    context_state: { blockers: 0 },
    ...overrides,
  };
}

test('orchestrator adapter returns normalized episode, comparison, replay, and evidence payloads', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const runnerMod = await import('../lib/rl-orchestrator-v1/decision-runner.mjs');
  const task = makeTask();
  const harness = runnerMod.createCiFixtureOrchestratorHarness();
  const policy = { seed: 13 };

  const episode = await mod.runOrchestratorEpisode({
    task,
    checkpointId: 'ckpt-orch-1',
    harness,
    policy,
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
  assert.equal(episode.bandit_trace?.algorithm, 'contextual_bandit');
  assert.equal(Array.isArray(episode.bandit_trace?.action_space), true);
  assert.equal(
    episode.bandit_trace?.action_space.includes(episode.bandit_trace?.selected_action),
    true
  );

  const comparison = await mod.compareOrchestratorAgainstReference({
    task,
    activeCheckpointId: 'ckpt-orch-2',
    preUpdateRefCheckpointId: 'ckpt-orch-1',
    harness,
  });
  assert.equal(new Set(['better', 'same', 'worse', 'comparison_failed']).has(comparison.relative_outcome || comparison.comparison_status), true);

  const replay = mod.buildOrchestratorReplayCandidate({ episode, comparison });
  assert.equal(typeof replay.replay_route, 'string');

  const evidence = mod.summarizeOrchestratorEnvironmentEvidence({ episode, comparison });
  assert.equal(typeof evidence.decision_type, 'string');
});

test('orchestrator adapter handles comparison_failed and teacher trigger classification', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const runnerMod = await import('../lib/rl-orchestrator-v1/decision-runner.mjs');
  const harness = runnerMod.createCiFixtureOrchestratorHarness();

  const comparison = await mod.compareOrchestratorAgainstReference({
    task: makeTask({ forceComparisonFailure: true }),
    activeCheckpointId: 'ckpt-orch-2',
    preUpdateRefCheckpointId: 'ckpt-orch-1',
    harness,
  });
  assert.equal(comparison.comparison_status, 'comparison_failed');
  assert.equal(comparison.replay_route, 'diagnostic_only');

  assert.deepEqual(
    [
      mod.classifyTeacherTrigger({ terminalOutcome: 'failed', boundaryEpisode: false }),
      mod.classifyTeacherTrigger({ terminalOutcome: 'partial', boundaryEpisode: true }),
      mod.classifyTeacherTrigger({ terminalOutcome: 'success', boundaryEpisode: false }),
    ],
    [
      { teacher_triggered: true, teacher_trigger_reason: 'failure' },
      { teacher_triggered: true, teacher_trigger_reason: 'boundary' },
      { teacher_triggered: false, teacher_trigger_reason: null },
    ]
  );
});

test('orchestrator adapter throws only on harness infrastructure faults', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');

  await assert.rejects(
    () => mod.runOrchestratorEpisode({
      task: makeTask(),
      checkpointId: 'ckpt-orch-1',
      harness: {
        async executeDecision() {
          throw new Error('transport offline');
        },
      },
    }),
    /infrastructure/i
  );
});

test('orchestrator adapter supports real harness mode with dry-run trajectories', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const adapter = mod.createOrchestratorAdapter({
    tasks: [makeTask({ task_id: 'orch-real-001' })],
    harnessMode: 'real',
    harnessOptions: {
      rootDir: process.cwd(),
      executionMode: 'dry-run',
      dispatchMode: 'local',
    },
  });
  const policy = { seed: 7 };
  const task = await adapter.sampleTask({ seed: 0, attempt: 0 });

  const episode = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-real-1',
    policy,
  });

  assert.equal(episode.environment, 'orchestrator');
  assert.equal(['success', 'partial', 'failed'].includes(episode.terminal_outcome), true);
  assert.equal(episode.decision_payload.harness_mode, 'real');
  assert.equal(Array.isArray(episode.bandit_trace?.action_space), true);
});

test('orchestrator adapter can sample tasks from live collector for real traffic integration', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const samples = [];
  const adapter = mod.createOrchestratorAdapter({
    harnessMode: 'fixture',
    liveTaskCollector: async ({ attempt, harnessMode, environment }) => {
      samples.push({ attempt, harnessMode, environment });
      if (attempt > 0) {
        return null;
      }
      return makeTask({
        task_id: 'orch-live-collector-001',
        context_snapshot_id: 'ctx-live-1',
      });
    },
  });

  const first = await adapter.sampleTask({ seed: 0, attempt: 0 });
  const second = await adapter.sampleTask({ seed: 0, attempt: 1 });
  assert.equal(first.task_id, 'orch-live-collector-001');
  assert.equal(second, null);
  assert.deepEqual(samples[0], {
    attempt: 0,
    harnessMode: 'fixture',
    environment: 'orchestrator',
  });

  const episode = await adapter.runEpisode({
    task: first,
    checkpointId: 'ckpt-live-collector',
    policy: { seed: 3 },
  });
  assert.equal(episode.environment, 'orchestrator');
  assert.equal(typeof episode.executor_selected, 'string');
});

test('real orchestrator harness policy release canary holdout routes non-sampled traffic to baseline mode', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-release-canary-'));
  const statePath = path.join(rootDir, 'orchestrator-policy-release.state.json');
  const executionModes = [];
  const adapter = mod.createOrchestratorAdapter({
    tasks: [makeTask({ task_id: 'orch-release-canary-001' })],
    harnessMode: 'real',
    harnessOptions: {
      rootDir,
      executionMode: 'live',
      fallbackExecutionMode: 'dry-run',
      fallbackOnMissingDispatchRun: false,
      policyRelease: {
        mode: 'canary',
        rolloutRate: 0,
        baselineExecutionMode: 'dry-run',
        autoDowngrade: false,
        statePath,
      },
      executeOrchestrate: async (options) => {
        executionModes.push(options.executionMode);
        return {
          exitCode: 0,
          report: {
            dispatchRun: {
              mode: options.executionMode,
              ok: true,
              runtime: { id: `runtime-${options.executionMode}` },
              executorRegistry: ['local-phase'],
              jobRuns: [{ status: 'simulated' }],
            },
            dispatchPreflight: { results: [] },
          },
        };
      },
    },
  });
  const task = await adapter.sampleTask({ seed: 0, attempt: 0 });

  const episode = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-release-canary',
    policy: { seed: 29 },
  });

  assert.deepEqual(executionModes, ['dry-run']);
  assert.equal(episode.decision_payload.requested_execution_mode, 'live');
  assert.equal(episode.decision_payload.effective_execution_mode, 'dry-run');
  assert.equal(episode.decision_payload.policy_release_mode, 'canary');
  assert.equal(episode.decision_payload.policy_release_applied, false);
});

test('real orchestrator harness binds routed policy executor into orchestrate dispatch options', async () => {
  const runnerMod = await import('../lib/rl-orchestrator-v1/decision-runner.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-release-routing-'));
  const statePath = path.join(rootDir, 'orchestrator-policy-release.state.json');
  const orchestrateCalls = [];
  const harness = runnerMod.createRealOrchestratorHarness({
    rootDir,
    executionMode: 'dry-run',
    dispatchMode: 'local',
    fallbackOnMissingDispatchRun: false,
    policyRelease: {
      mode: 'full',
      autoDowngrade: false,
      statePath,
    },
    executeOrchestrate: async (options) => {
      orchestrateCalls.push(options);
      return {
        exitCode: 0,
        report: {
          dispatchPlan: {
            phaseExecutor: {
              requested_executor: options.phaseExecutor || null,
              applied_executor: options.phaseExecutor || 'local-phase',
              reason: options.phaseExecutor ? 'requested_phase_executor_override' : 'default_phase_executor',
            },
          },
          dispatchRun: {
            mode: options.executionMode,
            ok: true,
            runtime: { id: `runtime-${options.executionMode}` },
            executorRegistry: [options.phaseExecutor || 'local-phase'],
            jobRuns: [{ status: 'simulated' }],
          },
          dispatchPreflight: { results: [] },
        },
      };
    },
  });

  const evidence = await harness.executeDecision({
    task: makeTask({ task_id: 'orch-release-routing-001' }),
    checkpointId: 'ckpt-release-routing',
    selectedExecutor: 'local-control',
  });

  assert.equal(orchestrateCalls.length, 1);
  assert.equal(orchestrateCalls[0].phaseExecutor, 'local-control');
  assert.equal(evidence.decision_payload.policy_release_applied, true);
  assert.equal(evidence.decision_payload.dispatch_phase_executor_applied, 'local-control');
  assert.equal(evidence.executor_selected, 'local-control');
});

test('real orchestrator harness treats policy executor fallback as baseline route for release state', async () => {
  const runnerMod = await import('../lib/rl-orchestrator-v1/decision-runner.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-release-fallback-'));
  const statePath = path.join(rootDir, 'orchestrator-policy-release.state.json');
  const harness = runnerMod.createRealOrchestratorHarness({
    rootDir,
    executionMode: 'dry-run',
    dispatchMode: 'local',
    fallbackOnMissingDispatchRun: false,
    policyRelease: {
      mode: 'full',
      autoDowngrade: true,
      downgradeConsecutiveFailures: 1,
      downgradeMinSamples: 1,
      statePath,
    },
    executeOrchestrate: async () => ({
      exitCode: 0,
      report: {
        dispatchPlan: {
          phaseExecutor: {
            requested_executor: 'local-control',
            applied_executor: 'local-phase',
            reason: 'unsupported_phase_executor:local-control',
            fallback_applied: true,
          },
        },
        dispatchRun: {
          mode: 'dry-run',
          ok: false,
          runtime: { id: 'runtime-dry-run' },
          executorRegistry: ['local-phase'],
          jobRuns: [{ status: 'blocked' }],
        },
        dispatchPreflight: { results: [] },
      },
    }),
  });

  const evidence = await harness.executeDecision({
    task: makeTask({ task_id: 'orch-release-fallback-001' }),
    checkpointId: 'ckpt-release-fallback',
    selectedExecutor: 'local-control',
  });

  assert.equal(evidence.decision_payload.policy_release_applied, true);
  assert.equal(evidence.decision_payload.policy_release_effective_applied, false);
  assert.equal(evidence.decision_payload.policy_release_executor_fallback, true);
  assert.equal(evidence.decision_payload.dispatch_phase_executor_applied, 'local-phase');

  const persistedState = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(Number(persistedState.counters.policy_applied || 0), 0);
  assert.equal(Number(persistedState.counters.baseline_routed || 0), 1);
  assert.equal(Number(persistedState.counters.policy_fallback || 0), 1);
  assert.equal(Number(persistedState.counters.downgrades || 0), 0);
  assert.equal(persistedState.effective_mode, 'full');
});

test('real orchestrator harness policy release auto-downgrades after policy-routed failures', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-release-gate-'));
  const statePath = path.join(rootDir, 'orchestrator-policy-release.state.json');
  const executionModes = [];
  const adapter = mod.createOrchestratorAdapter({
    tasks: [makeTask({ task_id: 'orch-release-downgrade-001' })],
    harnessMode: 'real',
    harnessOptions: {
      rootDir,
      executionMode: 'live',
      fallbackExecutionMode: 'dry-run',
      fallbackOnMissingDispatchRun: false,
      policyRelease: {
        mode: 'full',
        rolloutRate: 0,
        baselineExecutionMode: 'dry-run',
        autoDowngrade: true,
        downgradeConsecutiveFailures: 1,
        downgradeMinSamples: 1,
        downgradeMinRolloutRate: 0,
        statePath,
      },
      executeOrchestrate: async (options) => {
        executionModes.push(options.executionMode);
        return {
          exitCode: 0,
          report: {
            dispatchRun: {
              mode: options.executionMode,
              ok: false,
              runtime: { id: `runtime-${options.executionMode}` },
              executorRegistry: ['local-phase'],
              jobRuns: [{ status: 'blocked' }],
            },
            dispatchPreflight: { results: [] },
          },
        };
      },
    },
  });
  const task = await adapter.sampleTask({ seed: 0, attempt: 0 });

  const first = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-release-downgrade-1',
    policy: { seed: 31 },
  });
  const second = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-release-downgrade-2',
    policy: { seed: 31 },
  });

  assert.equal(first.decision_payload.policy_release_applied, true);
  assert.equal(first.decision_payload.policy_release_downgraded, true);
  assert.equal(second.decision_payload.policy_release_applied, false);
  assert.equal(second.decision_payload.effective_execution_mode, 'dry-run');
  assert.deepEqual(executionModes, ['live', 'dry-run']);

  const persistedState = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(persistedState.effective_mode, 'canary');
  assert.equal(Number(persistedState.effective_rollout_rate), 0);
});

test('real orchestrator harness retries live with dry-run fallback when live dispatch evidence is unavailable', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const executionModes = [];
  const adapter = mod.createOrchestratorAdapter({
    tasks: [makeTask({ task_id: 'orch-real-live-fallback-001' })],
    harnessMode: 'real',
    harnessOptions: {
      rootDir: process.cwd(),
      executionMode: 'live',
      executeOrchestrate: async (options) => {
        executionModes.push(options.executionMode);
        if (options.executionMode === 'live') {
          return {
            exitCode: 1,
            report: { kind: 'guardrail.capability-unknown' },
          };
        }
        return {
          exitCode: 0,
          report: {
            dispatchRun: {
              mode: 'dry-run',
              ok: true,
              runtime: { id: 'local-dry-run' },
              executorRegistry: ['local-phase'],
              jobRuns: [{ status: 'simulated' }],
            },
            dispatchPreflight: { results: [] },
          },
        };
      },
    },
  });
  const task = await adapter.sampleTask({ seed: 0, attempt: 0 });

  const episode = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-live-fallback',
    policy: { seed: 19 },
  });

  assert.deepEqual(executionModes, ['live', 'dry-run']);
  assert.equal(episode.decision_payload.harness_mode, 'real');
  assert.equal(episode.decision_payload.requested_execution_mode, 'live');
  assert.equal(episode.decision_payload.effective_execution_mode, 'dry-run');
  assert.deepEqual(episode.decision_payload.attempted_execution_modes, ['live', 'dry-run']);
  assert.equal(typeof episode.decision_payload.fallback_reason, 'string');
  assert.equal(episode.terminal_outcome, 'success');
});

test('real orchestrator harness falls back to fixture evidence on orchestration faults', async () => {
  const mod = await import('../lib/rl-orchestrator-v1/adapter.mjs');
  const runnerMod = await import('../lib/rl-orchestrator-v1/decision-runner.mjs');
  const adapter = mod.createOrchestratorAdapter({
    tasks: [makeTask({ task_id: 'orch-real-fallback-001' })],
    harnessMode: 'real',
    harnessOptions: {
      rootDir: process.cwd(),
      executionMode: 'dry-run',
      dispatchMode: 'local',
      executeOrchestrate: async () => {
        throw new Error('dispatch runtime offline');
      },
      fallbackHarness: runnerMod.createCiFixtureOrchestratorHarness(),
      fallbackOnError: true,
    },
  });
  const task = await adapter.sampleTask({ seed: 0, attempt: 0 });

  const episode = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-real-fallback',
    policy: { seed: 11 },
  });

  assert.equal(episode.environment, 'orchestrator');
  assert.equal(episode.decision_payload.harness_mode, 'real');
  assert.equal(episode.decision_payload.fallback_used, true);
});
