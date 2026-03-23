import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('mixed CLI help and dry-run commands expose browser/orchestrator/mixed surfaces', async () => {
  const help = spawnSync(process.execPath, ['scripts/rl-mixed-v1.mjs', '--help'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /browser/i);
  assert.match(help.stdout, /orchestrator/i);
  assert.match(help.stdout, /mixed/i);

  for (const argv of [
    ['browser-only', '--dry-run'],
    ['orchestrator-only', '--dry-run'],
    ['mixed', '--dry-run'],
    ['mixed-resume', '--dry-run'],
    ['mixed-eval', '--dry-run'],
  ]) {
    const run = spawnSync(process.execPath, ['scripts/rl-mixed-v1.mjs', ...argv], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /status|summary|mode|window/i);
  }
});

