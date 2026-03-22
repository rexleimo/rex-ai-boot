import assert from 'node:assert/strict';
import test from 'node:test';

test('trainer computes total_loss with rl, distill, and kl components', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const result = mod.computeLosses({
    rlLoss: 0.6,
    distillLoss: 0.5,
    klLoss: 0.1,
    distillationStatus: 'applied',
  });

  assert.equal(result.totalLoss, 0.6 + 0.2 * 0.5 + 0.01 * 0.1);
});

test('trainer zeros distillation weight when distillation was skipped', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const result = mod.computeLosses({
    rlLoss: 0.6,
    distillLoss: 99,
    klLoss: 0.1,
    distillationStatus: 'skipped',
  });

  assert.equal(result.distillLossWeight, 0);
});

test('trainer refreshes the frozen reference policy every 100 updates', async () => {
  const mod = await import('../lib/rl-shell-v1/trainer.mjs');
  const policy = { weights: { feature: [1, 2, 3] } };
  const reference = { weights: { feature: [0, 0, 0] } };

  const refreshed = mod.maybeRefreshReferencePolicy({
    policy,
    referencePolicy: reference,
    updateCount: 100,
    config: mod.createTrainerConfig(),
  });

  assert.notEqual(refreshed, reference);
  assert.deepEqual(refreshed.weights, policy.weights);
});
