import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('mixed context summary writer persists per-environment counts and drill evidence', async () => {
  const mod = await import('../lib/rl-mixed-v1/contextdb-summary.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-mixed-summary-'));
  const payload = {
    status: 'ok',
    summary: {
      active_environments: ['shell', 'browser', 'orchestrator'],
      environment_counts: { shell: 4, browser: 4, orchestrator: 4 },
      mixed_batch_count: 3,
      batch_combinations: ['browser+orchestrator', 'browser+shell'],
      updates_completed: 3,
      rollbacks_completed: 1,
      replay_only_epochs: 1,
      active_checkpoint_id: 'ckpt-a',
      pre_update_ref_checkpoint_id: null,
      last_stable_checkpoint_id: 'ckpt-stable',
      holdout_validation: { shell: { status: 'passed' } },
      drills: {
        rollback: { degradation_streak: 3 },
        resume: { duplicateEventApplications: 0 },
      },
      duplicateEventApplications: 0,
    },
  };

  const result = await mod.writeMixedSummary({
    rootDir,
    runId: 'mixed-run-001',
    mode: 'mixed',
    result: payload,
  });
  const saved = JSON.parse(await readFile(result.summaryPath, 'utf8'));

  assert.equal(saved.mixed_batch_count, 3);
  assert.equal(saved.environment_counts.browser, 4);
  assert.equal(saved.drills.rollback.degradation_streak, 3);
});

