import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('mixed campaign reports multi-environment batches and deterministic epoch outcomes', async () => {
  const mod = await import('../lib/rl-mixed-v1/run-orchestrator.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-mixed-'));

  const result = await mod.runMixedCampaign({
    rootDir,
    activeEnvironments: ['shell', 'browser', 'orchestrator'],
    batchTargetCount: 3,
    onlineBatchSize: 4,
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.summary.environment_counts.shell > 0, true);
  assert.equal(result.summary.environment_counts.browser > 0, true);
  assert.equal(result.summary.environment_counts.orchestrator > 0, true);
  assert.equal(result.summary.mixed_batch_count >= 3, true);
  assert.equal(result.summary.bandit_policy_state.update_count > 0, true);
  assert.equal(result.summary.bandit_policy_state.context_count > 0, true);
  assert.equal(result.summary.batch_combinations.includes('browser+orchestrator'), true);
  assert.equal(
    result.summary.batch_combinations.some((combo) => combo === 'browser+shell' || combo === 'orchestrator+shell'),
    true
  );

  assert.equal(
    mod.computeMixedEpochOutcome({
      coverage_sufficient: false,
      shell_safety_gate_passed: true,
      comparison_failed_count: 0,
      degradation_streak: 0,
    }).epoch_outcome,
    'replay_only'
  );
  assert.equal(
    mod.computeMixedEpochOutcome({
      coverage_sufficient: true,
      shell_safety_gate_passed: false,
      comparison_failed_count: 0,
      degradation_streak: 0,
    }).epoch_outcome,
    'replay_only'
  );
  assert.equal(
    mod.computeMixedEpochOutcome({
      coverage_sufficient: true,
      shell_safety_gate_passed: true,
      comparison_failed_count: 1,
      degradation_streak: 0,
    }).epoch_outcome,
    'replay_only'
  );
  assert.equal(
    mod.computeMixedEpochOutcome({
      coverage_sufficient: true,
      shell_safety_gate_passed: true,
      comparison_failed_count: 0,
      degradation_streak: 3,
    }).epoch_outcome,
    'rollback'
  );
});

test('mixed campaign computes orchestrator bandit reward from success, rollback, and human handoff rates', async () => {
  const mod = await import('../lib/rl-mixed-v1/run-orchestrator.mjs');
  const reward = mod.computeOrchestratorBanditReward({
    episode: {
      environment: 'orchestrator',
      decision_type: 'dispatch',
      verification_result: 'passed',
      handoff_triggered: false,
      terminal_outcome: 'success',
      terminal_reward: 1,
    },
    batchOrchestratorEpisodes: [
      { terminal_outcome: 'success', handoff_triggered: false },
      { terminal_outcome: 'failed', handoff_triggered: true },
    ],
    historical: {
      updatesCompleted: 4,
      rollbacksCompleted: 1,
    },
  });

  assert.equal(Number(reward.signals.success_rate.toFixed(3)), 0.5);
  assert.equal(Number(reward.signals.rollback_rate.toFixed(3)), 0.25);
  assert.equal(Number(reward.signals.human_handoff_rate.toFixed(3)), 0.5);
  assert.equal(Number(reward.reward.toFixed(3)), 0.5);
});

test('mixed campaign exposes rollback and resume drills', async () => {
  const mod = await import('../lib/rl-mixed-v1/run-orchestrator.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-mixed-'));

  const rollback = await mod.runMixedCampaign({
    rootDir,
    mode: 'drill-rollback',
    activeEnvironments: ['shell', 'browser', 'orchestrator'],
    batchTargetCount: 1,
  });
  assert.equal(rollback.summary.drills.rollback.degradation_streak >= 3, true);
  assert.equal(rollback.summary.drills.rollback.rollback_event_ids[0].startsWith('rollback-completed-'), true);
  assert.equal(typeof rollback.summary.drills.rollback.active_checkpoint_id, 'string');
  assert.equal(rollback.summary.drills.rollback.control_mode, 'collection');

  const resume = await mod.runMixedCampaign({
    rootDir,
    mode: 'drill-resume',
    activeEnvironments: ['shell', 'browser', 'orchestrator'],
    resume: true,
  });
  assert.equal(resume.summary.drills.resume.duplicateEventApplications, 0);
  assert.equal(typeof resume.summary.drills.resume.active_checkpoint_id, 'string');
});

test('mixed campaign persists and reloads contextual bandit policy checkpoints', async () => {
  const mod = await import('../lib/rl-mixed-v1/run-orchestrator.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-mixed-'));

  const first = await mod.runMixedCampaign({
    rootDir,
    activeEnvironments: ['orchestrator'],
    batchTargetCount: 2,
    onlineBatchSize: 2,
  });
  assert.equal(first.status, 'ok');
  assert.equal(first.summary.policy_checkpoint.save_status, 'written');
  assert.equal(first.summary.policy_checkpoint.path.endsWith('.json'), true);

  const checkpointPath = first.summary.policy_checkpoint.path;
  const payload = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(typeof payload.active_policy, 'object');
  assert.equal(Number(payload.update_count) > 0, true);

  const resumed = await mod.runMixedCampaign({
    rootDir,
    activeEnvironments: ['orchestrator'],
    batchTargetCount: 2,
    onlineBatchSize: 2,
    resume: true,
  });
  assert.equal(resumed.summary.policy_checkpoint.load_status, 'loaded');
  assert.equal(
    resumed.summary.bandit_policy_state.update_count > first.summary.bandit_policy_state.update_count,
    true
  );
});

test('mixed campaign safely cold-starts when policy checkpoint is corrupted', async () => {
  const mod = await import('../lib/rl-mixed-v1/run-orchestrator.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-mixed-'));

  const first = await mod.runMixedCampaign({
    rootDir,
    activeEnvironments: ['orchestrator'],
    batchTargetCount: 2,
    onlineBatchSize: 2,
  });
  const checkpointPath = first.summary.policy_checkpoint.path;
  await writeFile(checkpointPath, '{broken-json', 'utf8');

  const resumed = await mod.runMixedCampaign({
    rootDir,
    activeEnvironments: ['orchestrator'],
    batchTargetCount: 2,
    onlineBatchSize: 2,
    resume: true,
  });
  assert.equal(resumed.status, 'ok');
  assert.equal(resumed.summary.policy_checkpoint.load_status, 'corrupt');
  assert.equal(resumed.summary.bandit_policy_state.update_count > 0, true);
});

test('mixed campaign accepts real orchestrator harness mode for trajectory collection', async () => {
  const mod = await import('../lib/rl-mixed-v1/run-orchestrator.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-mixed-'));

  const result = await mod.runMixedCampaign({
    rootDir,
    activeEnvironments: ['orchestrator'],
    batchTargetCount: 2,
    onlineBatchSize: 1,
    orchestratorHarnessMode: 'real',
    orchestratorHarnessOptions: {
      rootDir,
      executionMode: 'dry-run',
      dispatchMode: 'local',
    },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.summary.environment_counts.orchestrator > 0, true);
  assert.equal(result.summary.bandit_policy_state.update_count > 0, true);
});
