import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { classifyOneShotFailure, isBetterSqlite3AbiMismatch, shouldAutoRebuildNative } from '../ctx-agent-core.mjs';
import { runContextDbCli } from '../lib/contextdb-cli.mjs';

async function createFakeCodexCommand(marker = 'FAKE_CODEX_OK') {
  const binDir = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-bin-'));
  const jsTextLiteral = JSON.stringify(`${marker}\n`);

  if (process.platform === 'win32') {
    const script = path.join(binDir, 'codex-fake.mjs');
    await writeFile(script, `process.stdout.write(${jsTextLiteral});\n`, 'utf8');
    const shim = path.join(binDir, 'codex.cmd');
    await writeFile(shim, `@echo off\r\nnode "${script}" %*\r\n`, 'utf8');
    return binDir;
  }

  const file = path.join(binDir, 'codex');
  await writeFile(file, `#!/usr/bin/env node\nprocess.stdout.write(${jsTextLiteral});\n`, 'utf8');
  await chmod(file, 0o755);
  return binDir;
}

test('detects better-sqlite3 Node ABI mismatch errors', () => {
  const detail = [
    'contextdb init failed: dlopen(/tmp/better_sqlite3.node, 0x0001):',
    'The module was compiled against a different Node.js version using',
    'NODE_MODULE_VERSION 115.',
    'This version of Node.js requires NODE_MODULE_VERSION 127.',
  ].join('\n');

  assert.equal(isBetterSqlite3AbiMismatch(detail), true);
});

test('does not treat unrelated native addon errors as better-sqlite3 ABI mismatch', () => {
  const detail = 'Error: Cannot find module "playwright"';
  assert.equal(isBetterSqlite3AbiMismatch(detail), false);
});

test('auto-rebuild env defaults to enabled', () => {
  assert.equal(shouldAutoRebuildNative({}), true);
});

test('auto-rebuild env accepts explicit off values', () => {
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: '0' }), false);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'false' }), false);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'off' }), false);
});

test('auto-rebuild env accepts explicit on values', () => {
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: '1' }), true);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'true' }), true);
  assert.equal(shouldAutoRebuildNative({ CTXDB_AUTO_REBUILD_NATIVE: 'on' }), true);
});

test('classifyOneShotFailure recognizes timeout-like failures', () => {
  assert.equal(classifyOneShotFailure('Request timed out after 30s'), 'timeout');
});

test('classifyOneShotFailure falls back to tool for generic failures', () => {
  assert.equal(classifyOneShotFailure('Unhandled exit=1'), 'tool');
});

test('ctx-agent tolerates context:pack failures by running without a context packet', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-pack-fail-'));
  const sessionId = 'ctx-pack-failure';

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'codex-cli',
      '--project',
      'tmp-project',
      '--goal',
      'Verify ctx-agent pack fail-open',
      '--session-id',
      sessionId,
    ]);

    // Remove the L0 summary so context:pack fails on the first attempt.
    await rm(
      path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId, 'l0-summary.md'),
      { force: true }
    );

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'codex-cli',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--prompt',
        'smoke',
        '--dry-run',
        '--no-bootstrap',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          CTXDB_PACK_STRICT: '0',
        },
      }
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[dry-run\]/);
    assert.match(result.stderr, /contextdb context:pack failed/i);

    // The checkpoint path recreates the summary, so a later pack should succeed and write the export.
    await stat(path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId, 'l0-summary.md'));
    await stat(path.join(workspaceRoot, 'memory', 'context-db', 'exports', `${sessionId}-context.md`));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('ctx-agent tolerates context:pack failures in interactive mode by still invoking the CLI', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-ctx-agent-pack-interactive-'));
  const sessionId = 'ctx-pack-failure-interactive';
  const fakeBin = await createFakeCodexCommand();

  try {
    runContextDbCli([
      'session:new',
      '--workspace',
      workspaceRoot,
      '--agent',
      'codex-cli',
      '--project',
      'tmp-project',
      '--goal',
      'Verify ctx-agent interactive pack fail-open',
      '--session-id',
      sessionId,
    ]);

    // Remove the L0 summary so context:pack fails on the first attempt.
    await rm(
      path.join(workspaceRoot, 'memory', 'context-db', 'sessions', sessionId, 'l0-summary.md'),
      { force: true }
    );

    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent.mjs',
        '--agent',
        'codex-cli',
        '--workspace',
        workspaceRoot,
        '--project',
        'tmp-project',
        '--session',
        sessionId,
        '--no-bootstrap',
        '--',
        '--version',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          CTXDB_PACK_STRICT: '0',
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      }
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /FAKE_CODEX_OK/);
    assert.match(result.stderr, /contextdb context:pack failed/i);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
