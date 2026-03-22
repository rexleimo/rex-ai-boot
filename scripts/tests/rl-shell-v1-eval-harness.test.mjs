import assert from 'node:assert/strict';
import test from 'node:test';

function makePolicyCheckpoint() {
  return {
    seed: 7,
    vocabulary: ['{', '}'],
    vocabularyIndex: { '{': 0, '}': 1 },
    weights: { feature: [1, 2] },
    rngState: 123,
    updateCount: 4,
  };
}

function makeHeldOutOnlyRegistry() {
  return {
    trainTasks: [],
    heldOutTasks: [
      { task_id: 'held-1', split: 'held_out' },
      { task_id: 'held-2', split: 'held_out' },
    ],
  };
}

test('eval harness selects best checkpoint deterministically', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const best = mod.pickBestCheckpoint([
    { step: 200, successRate: 0.5, regressionFreeFixRate: 0.6, invalidStepRatio: 0.2, repeatedNoProgressRate: 0.3, avgTokenCount: 100 },
    { step: 300, successRate: 0.5, regressionFreeFixRate: 0.6, invalidStepRatio: 0.1, repeatedNoProgressRate: 0.1, avgTokenCount: 130 },
  ]);

  assert.equal(best.step, 300);
});

test('eval harness summarizes 2A invalid-step and repeated-no-progress metrics', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const summary = mod.summarizeEvalResults([
    {
      success: 1,
      regressionFreeFix: 1,
      reward: 1,
      fusedReward: 1,
      episodeLength: 3,
      tokenCount: 10,
      runtimeDurationMs: 30,
      teacherBackend: null,
      fallbackUsed: false,
      teacherLatencyMs: 0,
      policyLoss: 0,
      distillLoss: 0,
      klLoss: 0,
      rewardHacking: false,
      degenerateAction: false,
      invalidStepCount: 1,
      stepCount: 4,
      stopCondition: 'student_stop',
    },
    {
      success: 0,
      regressionFreeFix: 0,
      reward: -1,
      fusedReward: -1,
      episodeLength: 4,
      tokenCount: 12,
      runtimeDurationMs: 33,
      teacherBackend: null,
      fallbackUsed: false,
      teacherLatencyMs: 0,
      policyLoss: 0,
      distillLoss: 0,
      klLoss: 0,
      rewardHacking: false,
      degenerateAction: false,
      invalidStepCount: 2,
      stepCount: 4,
      stopCondition: 'repeated_no_progress',
    },
  ]);

  assert.equal(summary.invalidStepRatio, 0.375);
  assert.equal(summary.repeatedNoProgressRate, 0.5);
});

test('eval harness compares 2A checkpoints against v1 and untrained multi-step baseline', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const comparison = mod.comparePhase2ABaseline({
    currentSummary: {
      successRate: 0.55,
      regressionFreeFixRate: 0.55,
      invalidStepRatio: 0.1,
      repeatedNoProgressRate: 0.05,
      avgTokenCount: 120,
    },
    multiStepBaselineSummary: {
      invalidStepRatio: 0.25,
      repeatedNoProgressRate: 0.2,
    },
    v1Summary: {
      successRate: 0.4,
      regressionFreeFixRate: 0.45,
    },
  });

  assert.equal(comparison.accepted, true);
  assert.equal(comparison.beatsV1Success, true);
  assert.equal(comparison.lowersInvalidStepRatio, true);
  assert.equal(comparison.lowersRepeatedNoProgressRate, true);
});

test('held-out evaluation never mutates student weights or trainer counters', async () => {
  const evalMod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const policy = makePolicyCheckpoint();
  const snapshot = JSON.stringify(policy);

  await evalMod.runHeldOutEval({
    checkpoint: policy,
    registry: makeHeldOutOnlyRegistry(),
    policyFactory: () => policy,
    teacherMode: 'none',
  });

  assert.equal(JSON.stringify(policy), snapshot);
});

test('eval harness summarizes real-task shadow repeatability metrics', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const summary = mod.summarizeRealShadowEval({
    pool_status: 'limited-pool',
    admitted_tasks: 2,
    attempt_results: [
      { task_id: 'task-a', repaired: true, contaminated_main_worktree: false },
      { task_id: 'task-a', repaired: true, contaminated_main_worktree: false },
      { task_id: 'task-b', repaired: false, contaminated_main_worktree: true },
    ],
  });

  assert.equal(summary.repeatedRepairRate, 0.5);
  assert.equal(summary.stableRepairCount, 1);
  assert.equal(summary.mainWorktreeContaminationFailures, 1);
});

test('eval harness summarizes phase 2 ablation deltas and warnings', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const summary = mod.summarizePhase2Ablation({
    phase2a: { successRate: 0.4, avgTokenCount: 100 },
    phase2b: { repeatedRepairRate: 0.2 },
    phase2c: { successRate: 0.55, repeatedRepairRate: 0.35, avgTokenCount: 108 },
  });

  assert.equal(summary.syntheticImprovement, 0.15);
  assert.equal(summary.realRepairImprovement, 0.15);
  assert.equal(summary.replayDrivenImprovement, 0.15);
  assert.equal(summary.overfittingWarning, false);
});

test('eval harness reports better/same/worse and comparison_failed counts', async () => {
  const mod = await import('../lib/rl-shell-v1/eval-harness.mjs');
  const summary = await mod.evaluatePhase3Run({
    episodeRecords: [
      { comparison_status: 'completed', relative_outcome: 'better', teacher_shaping_score: 0.7 },
      { comparison_status: 'completed', relative_outcome: 'better', teacher_shaping_score: 0.4 },
      { comparison_status: 'completed', relative_outcome: 'same', teacher_shaping_score: 0 },
      { comparison_status: 'completed', relative_outcome: 'worse', teacher_shaping_score: -0.5 },
      { comparison_status: 'comparison_failed', relative_outcome: null, teacher_shaping_score: 0.3 },
    ],
    runSummary: {
      updates_completed: 2,
      updates_failed: 1,
      rollbacks_completed: 1,
      replay_only_epochs: 1,
      active_checkpoint_id: 'ckpt-10',
      pre_update_ref_checkpoint_id: null,
      last_stable_checkpoint_id: 'ckpt-9',
    },
  });

  assert.equal(summary.better_count, 2);
  assert.equal(summary.same_count, 1);
  assert.equal(summary.worse_count, 1);
  assert.equal(summary.comparison_failed_count, 1);
  assert.equal(summary.rollbacks_completed, 1);
  assert.equal(summary.teacher_shaping_alignment_rate, 1);
  assert.equal(summary.last_stable_checkpoint_id, 'ckpt-9');
});

test('contextdb summary includes checkpoint lineage and rollback evidence', async () => {
  const mod = await import('../lib/rl-shell-v1/contextdb-summary.mjs');
  const payload = mod.buildRunSummaryPayload({
    run: {
      runId: 'run-003',
      studentModelId: 'tiny-json-policy-v1',
      bestCheckpointPath: 'experiments/rl-shell-v1/runs/run-003/checkpoints/best/policy.json',
      status: 'ok',
    },
    metrics: {
      successRate: 0.5,
      better_count: 3,
      same_count: 1,
      worse_count: 1,
      comparison_failed_count: 1,
      teacher_shaping_alignment_rate: 0.8,
    },
    config: {
      teacher_backend_requested: 'codex-cli',
      fallback_order: ['claude-code'],
      seed_results: [{ seed: 17, status: 'ok' }],
      phase: '3',
      updates_completed: 2,
      updates_failed: 1,
      rollbacks_completed: 1,
      replay_only_epochs: 1,
      comparison_failed_count: 1,
      active_checkpoint_id: 'ckpt-10',
      pre_update_ref_checkpoint_id: null,
      last_stable_checkpoint_id: 'ckpt-9',
    },
  });
  const contextSummary = mod.buildPhase3ContextSummary({ runSummary: payload });

  assert.equal(payload.better_count, 3);
  assert.equal(payload.teacher_shaping_alignment_rate, 0.8);
  assert.equal(contextSummary.last_stable_checkpoint_id, 'ckpt-9');
  assert.equal(contextSummary.rollbacks_completed, 1);
});
