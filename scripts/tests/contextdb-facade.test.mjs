import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadFacade, FACADE_FILENAME, generateFacadeFromSession } from '../lib/contextdb/facade.mjs';

test('loadFacade returns facade when file exists and is fresh', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'facade-test-'));
  const facadeDir = path.join(dir, 'memory', 'context-db');
  await mkdir(facadeDir, { recursive: true });
  const facadePath = path.join(facadeDir, FACADE_FILENAME);
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    ttlSeconds: 3600,
    sessionId: 'claude-code-20260419T000000-abc123',
    goal: 'test goal',
    status: 'running',
    lastCheckpointSummary: 'test summary',
    keyRefs: ['a.mjs'],
    contextPacketPath: 'memory/context-db/exports/latest-claude-code-context.md',
    hasStalePack: false,
  };
  await writeFile(facadePath, JSON.stringify(payload), 'utf8');

  const result = await loadFacade(dir);
  assert.equal(result.ok, true);
  assert.equal(result.facade.sessionId, payload.sessionId);

  await rm(dir, { recursive: true });
});

test('loadFacade returns ok=false when facade is expired', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'facade-test-'));
  const facadePath = path.join(dir, FACADE_FILENAME);
  const payload = {
    version: 1,
    generatedAt: new Date(Date.now() - 7200_000).toISOString(),
    ttlSeconds: 3600,
    sessionId: 'old',
    goal: 'old goal',
    status: 'running',
    lastCheckpointSummary: '',
    keyRefs: [],
    contextPacketPath: '',
    hasStalePack: false,
  };
  await writeFile(facadePath, JSON.stringify(payload), 'utf8');

  const result = await loadFacade(dir);
  assert.equal(result.ok, false);

  await rm(dir, { recursive: true });
});

test('loadFacade returns ok=false when file missing', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'facade-test-'));
  const result = await loadFacade(dir);
  assert.equal(result.ok, false);
  await rm(dir, { recursive: true });
});

test('generateFacadeFromSession extracts header from latest session', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'facade-test-'));
  const sessionsDir = path.join(dir, 'memory', 'context-db', 'sessions');
  const sessionId = 'claude-code-20260419T000000-abc123';
  await mkdir(path.join(sessionsDir, sessionId), { recursive: true });
  const meta = {
    goal: 'shared session',
    status: 'running',
    updated_at: new Date().toISOString(),
    lastCheckpoint: { summary: 'checkpoint summary' },
  };
  await writeFile(
    path.join(sessionsDir, sessionId, 'meta.json'),
    JSON.stringify(meta),
    'utf8'
  );

  const facade = await generateFacadeFromSession(dir, 'claude-code', 'aios');
  assert.equal(facade.sessionId, sessionId);
  assert.equal(facade.goal, 'shared session');
  assert.equal(facade.status, 'running');
  assert.equal(facade.lastCheckpointSummary, 'checkpoint summary');

  await rm(dir, { recursive: true });
});
