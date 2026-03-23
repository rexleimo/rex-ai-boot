import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
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

