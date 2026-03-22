import assert from 'node:assert/strict';
import test from 'node:test';

function makeState() {
  return {
    active_checkpoint_id: 'ckpt-a',
    pre_update_ref_checkpoint_id: null,
    last_stable_checkpoint_id: 'ckpt-a',
  };
}

test('rl-core checkpoint registry applies update completion atomically', async () => {
  const mod = await import('../lib/rl-core/checkpoint-registry.mjs');
  const next = mod.applyPointerTransition(makeState(), {
    type: 'update.completed',
    previous_active_checkpoint_id: 'ckpt-a',
    new_active_checkpoint_id: 'ckpt-b',
  });

  assert.equal(next.active_checkpoint_id, 'ckpt-b');
  assert.equal(next.pre_update_ref_checkpoint_id, 'ckpt-a');
  assert.equal(next.last_stable_checkpoint_id, 'ckpt-a');
});

test('rl-core checkpoint registry covers epoch close, update failure, and rollback', async () => {
  const mod = await import('../lib/rl-core/checkpoint-registry.mjs');
  const monitoring = {
    active_checkpoint_id: 'ckpt-b',
    pre_update_ref_checkpoint_id: 'ckpt-a',
    last_stable_checkpoint_id: 'ckpt-a',
  };

  const closed = mod.applyPointerTransition(monitoring, {
    type: 'epoch.closed',
    promotion_eligible: true,
  });
  assert.equal(closed.last_stable_checkpoint_id, 'ckpt-b');
  assert.equal(closed.pre_update_ref_checkpoint_id, null);

  const failed = mod.applyPointerTransition(monitoring, {
    type: 'update.failed',
  });
  assert.equal(failed.active_checkpoint_id, 'ckpt-b');
  assert.equal(failed.last_stable_checkpoint_id, 'ckpt-a');

  const rolledBack = mod.applyPointerTransition(monitoring, {
    type: 'rollback.completed',
    restored_checkpoint_id: 'ckpt-a',
  });
  assert.equal(rolledBack.active_checkpoint_id, 'ckpt-a');
  assert.equal(rolledBack.last_stable_checkpoint_id, 'ckpt-a');
});
