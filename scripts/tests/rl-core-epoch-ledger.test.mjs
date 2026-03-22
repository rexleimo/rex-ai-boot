import assert from 'node:assert/strict';
import test from 'node:test';

test('rl-core epoch closes as replay_only when any comparison fails', async () => {
  const mod = await import('../lib/rl-core/epoch-ledger.mjs');
  const epoch = mod.recordComparisonResults(mod.seedEpoch(), [
    { comparison_status: 'completed', relative_outcome: 'better' },
    { comparison_status: 'comparison_failed', relative_outcome: null },
    { comparison_status: 'completed', relative_outcome: 'same' },
  ]);

  assert.equal(epoch.close_reason, 'replay_only');
  assert.equal(epoch.promotion_eligible, false);
});

test('rl-core epoch transitions to collection after update_failed and monitoring after replay_only', async () => {
  const mod = await import('../lib/rl-core/epoch-ledger.mjs');
  const epoch = mod.seedEpoch({
    update_epoch_id: 'epoch-002',
    phase: 'monitoring',
    active_checkpoint_id: 'ckpt-b',
    pre_update_ref_checkpoint_id: 'ckpt-a',
  });

  assert.equal(mod.reopenEpoch(epoch, 'update_failed').phase, 'collection');
  assert.equal(mod.reopenEpoch(epoch, 'replay_only').phase, 'monitoring');
});
