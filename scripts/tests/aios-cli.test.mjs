import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { parseArgs } from '../lib/cli/parse-args.mjs';

test('parseArgs returns interactive mode when no args are provided', () => {
  const result = parseArgs([]);
  assert.equal(result.mode, 'interactive');
  assert.equal(result.command, 'tui');
});

test('parseArgs normalizes setup options', () => {
  const result = parseArgs(['setup', '--components', 'all', '--mode', 'opt-in', '--client', 'all']);
  assert.equal(result.mode, 'command');
  assert.equal(result.command, 'setup');
  assert.deepEqual(result.options.components, ['all']);
  assert.equal(result.options.wrapMode, 'opt-in');
  assert.equal(result.options.client, 'all');
});

test('parseArgs accepts doctor strict mode', () => {
  const result = parseArgs(['doctor', '--strict']);
  assert.equal(result.command, 'doctor');
  assert.equal(result.options.strict, true);
  assert.equal(result.options.globalSecurity, false);
});

test('parseArgs rejects invalid mode', () => {
  assert.throws(() => parseArgs(['setup', '--mode', 'bad-value']), /--mode must be one of/);
});

test('aios CLI prints help', () => {
  const result = spawnSync('node', ['scripts/aios.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /AIOS unified entry/i);
  assert.match(result.stdout, /setup/);
  assert.match(result.stdout, /doctor/);
});
