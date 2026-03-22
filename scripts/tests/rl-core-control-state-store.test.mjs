import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('rl-core control state ignores duplicate event ids', async () => {
  const mod = await import('../lib/rl-core/control-state-store.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-control-store-'));
  const store = await mod.createControlStateStore({ rootDir, namespace: 'rl-core-tests' });
  const event = {
    event_id: 'evt-001',
    snapshot_patch: {
      mode: 'collection',
      active_checkpoint_id: 'ckpt-a',
    },
  };

  await mod.applyControlEvent(store, event);
  await mod.applyControlEvent(store, event);

  const snapshot = await mod.readControlSnapshot(store);
  assert.equal(snapshot.applied_event_ids.length, 1);
  assert.equal(snapshot.last_event_id, 'evt-001');
  assert.equal(snapshot.mode, 'collection');
});

test('rl-core control state persists frozen_failure snapshots for restart recovery', async () => {
  const mod = await import('../lib/rl-core/control-state-store.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-core-control-store-'));
  const store = await mod.createControlStateStore({ rootDir, namespace: 'rl-core-tests' });

  await mod.writeControlSnapshot(store, {
    active_checkpoint_id: 'ckpt-b',
    pre_update_ref_checkpoint_id: 'ckpt-a',
    last_stable_checkpoint_id: 'ckpt-a',
    mode: 'frozen_failure',
    applied_event_ids: ['evt-001'],
    last_event_id: 'evt-001',
  });

  const snapshot = await mod.readControlSnapshot(store);
  assert.equal(snapshot.mode, 'frozen_failure');
  assert.equal(snapshot.active_checkpoint_id, 'ckpt-b');
});
