import assert from 'node:assert/strict';
import test from 'node:test';

test('epoch closes as replay_only when any comparison fails', async () => {
  const mod = await import('../lib/rl-shell-v1/epoch-ledger.mjs');
  const epoch = mod.recordComparisonResults(mod.seedEpoch(), [
    { comparison_status: 'completed', relative_outcome: 'better' },
    { comparison_status: 'comparison_failed', relative_outcome: null },
    { comparison_status: 'completed', relative_outcome: 'same' },
    { comparison_status: 'completed', relative_outcome: 'better' },
  ]);

  assert.equal(epoch.close_reason, 'replay_only');
  assert.equal(epoch.promotion_eligible, false);
});

test('epoch transitions to collection after update_failed and to monitoring after replay_only', async () => {
  const mod = await import('../lib/rl-shell-v1/epoch-ledger.mjs');
  const updateFailed = mod.reopenEpoch(mod.seedEpoch({ phase: 'online-update' }), 'update_failed');
  assert.equal(updateFailed.phase, 'collection');

  const replayOnly = mod.reopenEpoch(mod.seedEpoch({ phase: 'monitoring' }), 'replay_only');
  assert.equal(replayOnly.phase, 'monitoring');
});
