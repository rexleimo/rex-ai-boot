import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function makeConfig(overrides = {}) {
  return {
    rootDir: REPO_ROOT,
    teacher_backend_requested: 'codex-cli',
    fallback_order: ['claude-code'],
    maxEpisodesPerRun: 1,
    maxUpdatesPerRun: 1,
    acceptanceSeeds: [17, 29, 41],
    ...overrides,
  };
}

test('run orchestrator marks campaign as insufficient-valid-tasks when registry gates fail', async () => {
  const mod = await import('../lib/rl-shell-v1/run-orchestrator.mjs');
  const result = await mod.runCampaign({
    config: makeConfig(),
    deps: {
      registryLoader: async () => ({ valid: false, reason: 'insufficient-valid-tasks' }),
    },
  });

  assert.equal(result.status, 'insufficient-valid-tasks');
});

test('entrypoint train command prints run summary path', async () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/rl-shell-v1.mjs', 'train', '--config', 'experiments/rl-shell-v1/configs/benchmark-v1.json', '--seed', '17', '--teacher', 'codex-cli'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /run_id/i);
  assert.match(result.stdout, /summary_path/i);
});

test('contextdb summary writer validates required fields and keeps write failures non-fatal', async () => {
  const mod = await import('../lib/rl-shell-v1/contextdb-summary.mjs');
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-rl-shell-v1-summary-'));
  const summary = {
    run_id: 'run-001',
    spec_path: 'docs/superpowers/specs/2026-03-22-aios-shell-rl-v1-design.md',
    student_model_id: 'tiny-json-policy-v1',
    primary_teacher: 'codex-cli',
    fallback_order: ['claude-code'],
    train_split: 'benchmark-v1-train',
    held_out_split: 'benchmark-v1-held-out',
    best_checkpoint_path: 'experiments/rl-shell-v1/runs/run-001/checkpoints/best/policy.json',
    best_metrics: { success_rate: 0.4 },
    seed_results: [{ seed: 17, status: 'ok' }],
    status: 'ok',
  };

  await assert.doesNotReject(() =>
    mod.writeRunSummary({
      rootDir,
      summary,
      sessionId: 'session-123',
      writer: async () => {
        throw new Error('ctxdb unavailable');
      },
    })
  );
});
