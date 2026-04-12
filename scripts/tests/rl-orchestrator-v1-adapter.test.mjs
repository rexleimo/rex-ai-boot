import assert from 'node:assert/strict';
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
  const task = adapter.sampleTask({ seed: 0, attempt: 0 });

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
  const task = adapter.sampleTask({ seed: 0, attempt: 0 });

  const episode = await adapter.runEpisode({
    task,
    checkpointId: 'ckpt-real-fallback',
    policy: { seed: 11 },
  });

  assert.equal(episode.environment, 'orchestrator');
  assert.equal(episode.decision_payload.harness_mode, 'real');
  assert.equal(episode.decision_payload.fallback_used, true);
});
