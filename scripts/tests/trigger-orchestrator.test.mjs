import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldLoadMemory } from '../lib/contextdb/trigger/orchestrator.mjs';

test('intent fires before complexity', async () => {
  const r = await shouldLoadMemory('remember what we did');
  assert.equal(r.shouldLoad, true);
  assert.equal(r.reason, 'intent:recall');
});

test('negative intent suppresses even high complexity', async () => {
  const r = await shouldLoadMemory('Start from scratch, ignore history, but orchestrate a team');
  assert.equal(r.shouldLoad, false);
  assert.equal(r.reason, 'intent:negative');
});

test('complexity fires when intent is neutral', async () => {
  const r = await shouldLoadMemory('First do X then Y across frontend and backend');
  assert.equal(r.shouldLoad, true);
  assert.equal(r.reason, 'complexity:high');
});

test('no trigger returns false', async () => {
  const r = await shouldLoadMemory('hello world');
  assert.equal(r.shouldLoad, false);
  assert.equal(r.reason, 'orchestrator:no-trigger');
});
