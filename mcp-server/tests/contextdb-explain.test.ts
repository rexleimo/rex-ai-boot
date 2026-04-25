import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  appendEvent,
  createSession,
  searchEvents,
  searchMemory,
  writeCheckpoint,
} from '../src/contextdb/core.js';

async function makeWorkspace(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ctxdb-explain-'));
  await fs.mkdir(path.join(workspace, 'config'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'config', 'browser-profiles.json'), '{"profiles":{}}', 'utf8');
  return workspace;
}

function runContextDbCli(args: string[]) {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const contextDbCli = path.join(process.cwd(), 'src', 'contextdb', 'cli.ts');
  return spawnSync(process.execPath, [tsxCli, contextDbCli, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('searchEvents attaches retrieval explanation when requested', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'explain event search',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Browser smoke evidence report captured screenshots for checkout flow.',
    refs: ['docs/browser-smoke.md'],
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Unrelated release note about installer cleanup.',
  });

  const output = await searchEvents({
    workspaceRoot: workspace,
    query: 'browser smoke',
    limit: 5,
    explain: true,
  } as Parameters<typeof searchEvents>[0] & { explain: boolean });

  assert.equal(output.results.length, 1);
  const result = output.results[0] as typeof output.results[number] & { explain?: Record<string, unknown> };
  assert.equal(result.text.includes('Browser smoke evidence'), true);
  assert.equal(result.explain?.retrievalMode, 'lexical');
  assert.deepEqual(result.explain?.queryTokens, ['browser', 'smoke']);
  assert.deepEqual(result.explain?.matchedTokens, ['browser', 'smoke']);
  assert.deepEqual(result.explain?.suppressionReasons, []);
  assert.equal(typeof (result.explain?.scoreParts as { textMatch?: unknown } | undefined)?.textMatch, 'number');
});

test('searchMemory attaches explanations to mixed event and checkpoint results', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'explain mixed memory search',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'Need contextdb hygiene status for noisy memory rows.',
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    status: 'running',
    summary: 'ContextDB hygiene status command planned.',
    nextActions: ['Add hygiene status dry-run'],
    artifacts: ['docs/plans/contextdb-hygiene.md'],
  });

  const output = await searchMemory({
    workspaceRoot: workspace,
    query: 'contextdb hygiene',
    scope: 'all',
    limit: 5,
    explain: true,
  } as Parameters<typeof searchMemory>[0] & { explain: boolean });

  assert.equal(output.results.length >= 2, true);
  for (const result of output.results as Array<typeof output.results[number] & { explain?: Record<string, unknown> }>) {
    assert.ok(result.explain, `missing explain for ${result.itemType}`);
    assert.equal(result.explain.retrievalMode, 'lexical');
    assert.deepEqual(result.explain.suppressionReasons, []);
    assert.equal(Array.isArray(result.explain.queryTokens), true);
    assert.equal(Array.isArray(result.explain.matchedTokens), true);
  }
});

test('contextdb cli search supports --explain flag', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'explain cli search',
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'CLI explain output includes score parts for browser smoke search.',
  });

  const result = runContextDbCli([
    'search',
    '--workspace',
    workspace,
    '--query',
    'browser smoke',
    '--scope',
    'all',
    '--limit',
    '3',
    '--explain',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse((result.stdout || '{}').trim()) as {
    results?: Array<{ explain?: { retrievalMode?: string; scoreParts?: { textMatch?: number } } }>;
  };
  assert.equal(payload.results?.length, 1);
  assert.equal(payload.results?.[0]?.explain?.retrievalMode, 'lexical');
  assert.equal(typeof payload.results?.[0]?.explain?.scoreParts?.textMatch, 'number');
});
