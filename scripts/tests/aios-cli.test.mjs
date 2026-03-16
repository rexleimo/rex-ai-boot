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

test('parseArgs accepts memo passthrough args', () => {
  const result = parseArgs(['memo', 'add', 'hello', '#tag']);
  assert.equal(result.command, 'memo');
  assert.equal(result.mode, 'command');
  assert.deepEqual(result.options.argv, ['add', 'hello', '#tag']);
});

test('parseArgs accepts entropy-gc options', () => {
  const result = parseArgs([
    'entropy-gc',
    'auto',
    '--session',
    'codex-cli-20260303T080437-065e16c0',
    '--retain',
    '7',
    '--min-age-hours',
    '48',
    '--format',
    'json',
  ]);
  assert.equal(result.command, 'entropy-gc');
  assert.equal(result.mode, 'command');
  assert.equal(result.options.mode, 'auto');
  assert.equal(result.options.sessionId, 'codex-cli-20260303T080437-065e16c0');
  assert.equal(result.options.retain, 7);
  assert.equal(result.options.minAgeHours, 48);
  assert.equal(result.options.format, 'json');
});

test('parseArgs treats memo help as help mode', () => {
  const result = parseArgs(['memo', '--help']);
  assert.equal(result.command, 'memo');
  assert.equal(result.mode, 'help');
  assert.equal(result.help, true);
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

test('aios memo prints help', () => {
  const result = spawnSync('node', ['scripts/aios.mjs', 'memo', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /add <text>/i);
  assert.match(result.stdout, /pin show/i);
});
