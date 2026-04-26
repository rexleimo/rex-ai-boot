import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

import {
  detectSoloWorktreeChanges,
  finalizeSoloWorktree,
  prepareSoloWorktree,
} from '../lib/harness/solo-worktree.mjs';

async function makeGitRepo() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-solo-worktree-'));
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'index.txt'), 'hello\n', 'utf8');
  spawnSync('git init', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git config user.email "aios@example.com"', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git config user.name "AIOS Tests"', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git add -A', { cwd: rootDir, shell: true, encoding: 'utf8' });
  spawnSync('git commit -m "init"', { cwd: rootDir, shell: true, encoding: 'utf8' });
  return rootDir;
}

test('prepareSoloWorktree creates an isolated git worktree', async () => {
  const rootDir = await makeGitRepo();
  const state = await prepareSoloWorktree({
    rootDir,
    sessionId: 's1',
    objective: 'Ship X',
    enabled: true,
    baseRef: 'HEAD',
  });

  assert.equal(state.enabled, true);
  assert.equal(state.path.includes('.git'), false);
  await access(path.join(state.path, 'src', 'index.txt'));

  await finalizeSoloWorktree({ rootDir, worktree: state });
});

test('finalizeSoloWorktree removes clean no-output worktrees', async () => {
  const rootDir = await makeGitRepo();
  const state = await prepareSoloWorktree({
    rootDir,
    sessionId: 's2',
    objective: 'Ship Y',
    enabled: true,
    baseRef: 'HEAD',
  });

  const cleanup = await finalizeSoloWorktree({
    rootDir,
    worktree: state,
    preserveOnChange: true,
  });
  assert.equal(cleanup.preserved, false);
  await assert.rejects(() => access(state.path));
});

test('finalizeSoloWorktree preserves changed worktrees for operator review', async () => {
  const rootDir = await makeGitRepo();
  const state = await prepareSoloWorktree({
    rootDir,
    sessionId: 's3',
    objective: 'Ship Z',
    enabled: true,
    baseRef: 'HEAD',
  });

  await writeFile(path.join(state.path, 'src', 'index.txt'), 'changed\n', 'utf8');
  const changes = await detectSoloWorktreeChanges({ worktree: state });
  assert.equal(changes.changed, true);

  const keep = await finalizeSoloWorktree({
    rootDir,
    worktree: state,
    preserveOnChange: true,
  });
  assert.equal(keep.preserved, true);

  await access(path.join(state.path, 'src', 'index.txt'));
  await finalizeSoloWorktree({ rootDir, worktree: { ...state, preserved: false }, forceCleanup: true });
});
