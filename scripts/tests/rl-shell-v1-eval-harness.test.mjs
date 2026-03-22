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
