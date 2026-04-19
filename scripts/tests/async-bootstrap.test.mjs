import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runAsyncBootstrap } from '../lib/contextdb/async-bootstrap.mjs';

test('async bootstrap writes .facade.json after pack', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'async-bootstrap-test-'));
  const exportsDir = path.join(dir, 'memory', 'context-db', 'exports');
  await mkdir(exportsDir, { recursive: true });

  await writeFile(
    path.join(exportsDir, 'latest-claude-code-context.md'),
    '# Context\n\nstale\n',
    'utf8'
  );

  const sessionsDir = path.join(dir, 'memory', 'context-db', 'sessions');
  const sessionId = 'claude-code-20260419T000000-abc123';
  await mkdir(path.join(sessionsDir, sessionId), { recursive: true });
  await writeFile(
    path.join(sessionsDir, sessionId, 'meta.json'),
    JSON.stringify({ goal: 'test', status: 'running', updated_at: new Date().toISOString() }),
    'utf8'
  );

  const mockPack = async () => ({
    ok: true,
    mode: 'fresh',
    packAbs: path.join(exportsDir, 'latest-claude-code-context.md'),
    contextText: '# Context\n\nfresh\n',
  });

  await runAsyncBootstrap(dir, {
    agent: 'claude-code',
    project: 'aios',
    safeContextPack: mockPack,
  });

  const facadePath = path.join(dir, 'memory', 'context-db', '.facade.json');
  const facadeText = await readFile(facadePath, 'utf8');
  const facade = JSON.parse(facadeText);
  assert.equal(facade.sessionId, sessionId);
  assert.equal(facade.hasStalePack, false);

  await rm(dir, { recursive: true });
});
