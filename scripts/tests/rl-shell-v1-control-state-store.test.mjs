import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('applyControlEvent ignores duplicate event ids', async () => {
  const mod = await import('../lib/rl-shell-v1/control-state-store.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-shell-v1-control-store-'));
  const store = await mod.createControlStateStore({ rootDir });
  const event = {
    event_id: 'evt-001',
    type: 'trajectory.persisted',
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

test('writeControlSnapshot persists and reloads the latest checkpoint snapshot', async () => {
  const mod = await import('../lib/rl-shell-v1/control-state-store.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-shell-v1-control-store-'));
  const store = await mod.createControlStateStore({ rootDir });

  await mod.writeControlSnapshot(store, {
    active_checkpoint_id: 'ckpt-a',
    pre_update_ref_checkpoint_id: null,
    last_stable_checkpoint_id: 'ckpt-a',
    mode: 'collection',
    applied_event_ids: [],
    last_event_id: null,
  });

  const snapshot = await mod.readControlSnapshot(store);
  assert.equal(snapshot.active_checkpoint_id, 'ckpt-a');
  assert.equal(snapshot.last_stable_checkpoint_id, 'ckpt-a');
  assert.equal(snapshot.mode, 'collection');
});
