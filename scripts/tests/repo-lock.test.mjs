import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveRepoLockPath, withRepoLock } from '../lib/fs/repo-lock.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('withRepoLock serializes concurrent callers for the same repo lock', async () => {
  const rootDir = await makeTemp('aios-repo-lock-serialize-');
  const events = [];
  const io = { log() {} };

  const first = withRepoLock({ rootDir, timeoutMs: 2000, pollMs: 20, io }, async () => {
    events.push('first:start');
    await sleep(120);
    events.push('first:end');
  });
  await sleep(10);
  const second = withRepoLock({ rootDir, timeoutMs: 2000, pollMs: 20, io }, async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('withRepoLock removes stale lock files and continues', async () => {
  const rootDir = await makeTemp('aios-repo-lock-stale-');
  const lockPath = resolveRepoLockPath(rootDir);
  const lockDate = new Date(Date.now() - (5 * 60 * 1000));
  const logs = [];

  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, '{"pid":999}\n', 'utf8');
  await utimes(lockPath, lockDate, lockDate);

  await withRepoLock({
    rootDir,
    timeoutMs: 2000,
    pollMs: 20,
    staleMs: 1000,
    io: { log: (line) => logs.push(String(line)) },
  }, async () => {});

  assert.equal(existsSync(lockPath), false);
  assert.match(logs.join('\n'), /removed stale sync lock/);
});

test('withRepoLock times out while another active lock owner exists', async () => {
  const rootDir = await makeTemp('aios-repo-lock-timeout-');
  const lockPath = resolveRepoLockPath(rootDir);

  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, '{"pid":1234,"host":"test-host","startedAt":"2026-01-01T00:00:00.000Z"}\n', 'utf8');

  await assert.rejects(
    withRepoLock({
      rootDir,
      timeoutMs: 120,
      pollMs: 20,
      staleMs: 60 * 1000,
      io: { log() {} },
    }, async () => {}),
    /\[lock timeout\] sync lock busy/
  );

  await rm(lockPath, { force: true });
});
