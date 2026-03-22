import assert from 'node:assert/strict';
import test from 'node:test';

function makeState() {
  return {
    active_checkpoint_id: 'ckpt-a',
    pre_update_ref_checkpoint_id: null,
    last_stable_checkpoint_id: 'ckpt-a',
  };
}

test('checkpoint registry applies update.completed atomically', async () => {
  const mod = await import('../lib/rl-shell-v1/active-checkpoint-registry.mjs');
  const next = mod.applyPointerTransition(makeState(), {
    type: 'update.completed',
    new_active_checkpoint_id: 'ckpt-b',
    previous_active_checkpoint_id: 'ckpt-a',
  });

  assert.equal(next.active_checkpoint_id, 'ckpt-b');
  assert.equal(next.pre_update_ref_checkpoint_id, 'ckpt-a');
  assert.equal(next.last_stable_checkpoint_id, 'ckpt-a');
});

test('checkpoint registry covers promotion close, update failure, and rollback completion', async () => {
  const mod = await import('../lib/rl-shell-v1/active-checkpoint-registry.mjs');
  const monitoring = {
    active_checkpoint_id: 'ckpt-b',
    pre_update_ref_checkpoint_id: 'ckpt-a',
    last_stable_checkpoint_id: 'ckpt-a',
  };

  const closed = mod.applyPointerTransition(monitoring, {
    type: 'epoch.closed',
    promotion_eligible: true,
  });
  assert.equal(closed.active_checkpoint_id, 'ckpt-b');
  assert.equal(closed.pre_update_ref_checkpoint_id, null);
  assert.equal(closed.last_stable_checkpoint_id, 'ckpt-b');

  const failed = mod.applyPointerTransition(monitoring, {
    type: 'update.failed',
  });
  assert.equal(failed.active_checkpoint_id, 'ckpt-b');
  assert.equal(failed.pre_update_ref_checkpoint_id, null);
  assert.equal(failed.last_stable_checkpoint_id, 'ckpt-a');

  const rolledBack = mod.applyPointerTransition(monitoring, {
    type: 'rollback.completed',
    restored_checkpoint_id: 'ckpt-a',
  });
  assert.equal(rolledBack.active_checkpoint_id, 'ckpt-a');
  assert.equal(rolledBack.pre_update_ref_checkpoint_id, null);
  assert.equal(rolledBack.last_stable_checkpoint_id, 'ckpt-a');
});

test('checkpoint registry rejects invalid transitions', async () => {
  const mod = await import('../lib/rl-shell-v1/active-checkpoint-registry.mjs');

  assert.throws(
    () =>
      mod.applyPointerTransition(makeState(), {
        type: 'update.completed',
        new_active_checkpoint_id: 'ckpt-b',
        previous_active_checkpoint_id: 'wrong',
      }),
    /previous_active_checkpoint_id/i
  );

  assert.throws(
    () =>
      mod.applyPointerTransition(makeState(), {
        type: 'rollback.completed',
      }),
    /restored_checkpoint_id/i
  );
});
