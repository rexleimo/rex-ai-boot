import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('replay pool keeps synthetic and real-shadow pools separate', async () => {
  const mod = await import('../lib/rl-shell-v1/replay-pool.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-replay-pool-'));
  const pool = await mod.createReplayPool({ rootDir });
  await mod.addReplayEpisode({
    pool,
    episode: { task_source: 'synthetic', replay_eligible: true, replay_priority: 0.4, episode_id: 'synthetic-1' },
  });
  await mod.addReplayEpisode({
    pool,
    episode: { task_source: 'real_shadow', replay_eligible: true, replay_priority: 0.6, episode_id: 'real-1' },
  });

  assert.equal(pool.synthetic.count, 1);
  assert.equal(pool.realShadow.count, 1);
});

test('replay pool ignores ineligible episodes', async () => {
  const mod = await import('../lib/rl-shell-v1/replay-pool.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-replay-pool-'));
  const pool = await mod.createReplayPool({ rootDir });
  await mod.addReplayEpisode({
    pool,
    episode: { task_source: 'synthetic', replay_eligible: false, replay_priority: 0.9, episode_id: 'skip-1' },
  });

  assert.equal(pool.synthetic.count, 0);
  assert.equal(pool.realShadow.count, 0);
});

test('replay pool keeps comparison_failed and update_failed trajectories out of training lanes', async () => {
  const mod = await import('../lib/rl-shell-v1/replay-pool.mjs');

  assert.equal(
    mod.classifyReplayRoute({
      comparison_status: 'comparison_failed',
      rollback_batch: false,
      admission_status: 'rejected',
    }),
    'diagnostic_only'
  );

  assert.equal(
    mod.classifyReplayRoute({
      comparison_status: 'completed',
      relative_outcome: 'same',
      rollback_batch: false,
      admission_status: 'admitted',
    }),
    'neutral'
  );
});
