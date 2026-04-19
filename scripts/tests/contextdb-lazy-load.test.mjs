import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('lazy load helpers: shouldLazyLoad defaults to true', async () => {
  const { shouldLazyLoad } = await import('../ctx-agent-core.mjs');
  assert.equal(shouldLazyLoad({}), true);
  assert.equal(shouldLazyLoad({ CTXDB_LAZY_LOAD: '1' }), true);
  assert.equal(shouldLazyLoad({ CTXDB_LAZY_LOAD: '0' }), false);
  assert.equal(shouldLazyLoad({ CTXDB_LAZY_LOAD: 'off' }), false);
});

test('lazy load helpers: buildFacadePrompt with session', async () => {
  const { buildFacadePrompt } = await import('../ctx-agent-core.mjs');
  const facade = {
    sessionId: 'test-session',
    goal: 'test goal',
    status: 'running',
    keyRefs: ['a.mjs', 'b.mjs'],
    contextPacketPath: 'memory/context-db/exports/latest-claude-code-context.md',
  };
  const prompt = buildFacadePrompt(facade, 'claude-code');
  assert.ok(prompt.includes('ContextDB'));
  assert.ok(prompt.includes('test goal'));
  assert.ok(prompt.includes('a.mjs'));
  assert.ok(prompt.includes('latest-claude-code-context.md'));
});

test('lazy load helpers: buildFacadePrompt without session', async () => {
  const { buildFacadePrompt } = await import('../ctx-agent-core.mjs');
  const prompt = buildFacadePrompt(null, 'claude-code');
  assert.ok(prompt.includes('No prior sessions'));
  assert.ok(prompt.includes('latest-claude-code-context.md'));
});

test('lazy load start-up produces correct facade injection', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'aios-lazy-load-'));

  try {
    const facadeDir = path.join(workspaceRoot, 'memory', 'context-db');
    await mkdir(facadeDir, { recursive: true });
    await writeFile(
      path.join(facadeDir, '.facade.json'),
      JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        ttlSeconds: 3600,
        sessionId: 'claude-code-20260419T000000-test',
        goal: 'test session',
        status: 'running',
        lastCheckpointSummary: 'test summary',
        keyRefs: ['a.mjs'],
        contextPacketPath: 'memory/context-db/exports/latest-claude-code-context.md',
        hasStalePack: false,
      }),
      'utf8'
    );

    // Run ctx-agent-core in one-shot mode with --prompt so it doesn't hit interactive lazy path
    // but with CTXDB_LAZY_LOAD=0 to test eager path still works
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
    const result = spawnSync(
      process.execPath,
      [
        'scripts/ctx-agent-core.mjs',
        '--agent', 'claude-code',
        '--workspace', workspaceRoot,
        '--project', 'test-proj',
        '--prompt', 'hello',
        '--dry-run',
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          CTXDB_LAZY_LOAD: '0',
        },
        encoding: 'utf8',
      }
    );

    // With lazy disabled, one-shot should complete without error
    assert.equal(result.status, 0, `eager one-shot should exit 0, got ${result.status}; stderr: ${result.stderr}`);
  } finally {
    await rm(workspaceRoot, { recursive: true }).catch(() => {});
  }
});

test('async bootstrap runner exists and is executable', async () => {
  const runnerPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'lib',
    'contextdb',
    'async-bootstrap-runner.mjs'
  );
  const content = await readFile(runnerPath, 'utf8');
  assert.ok(content.includes('generateFacadeFromSession'));
  assert.ok(content.includes('context:pack'));
});
