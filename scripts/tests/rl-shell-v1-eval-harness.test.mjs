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
    { step: 200, successRate: 0.5, regressionFreeFixRate: 0.5, avgTokenCount: 100 },
    { step: 300, successRate: 0.5, regressionFreeFixRate: 0.6, avgTokenCount: 130 },
  ]);

  assert.equal(best.step, 300);
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
