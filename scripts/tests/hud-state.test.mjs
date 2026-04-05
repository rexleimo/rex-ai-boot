import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readHudState, selectHudSessionId } from '../lib/hud/state.mjs';
import { renderHud } from '../lib/hud/render.mjs';

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonLines(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
  await fs.writeFile(filePath, content, 'utf8');
}

function makeSessionMeta({ sessionId, agent, updatedAt }) {
  return {
    schemaVersion: 1,
    sessionId,
    agent,
    project: 'aios',
    goal: `Goal for ${sessionId}`,
    tags: [],
    status: 'running',
    createdAt: updatedAt,
    updatedAt,
  };
}

test('selectHudSessionId respects explicit session id', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-'));
  const selection = await selectHudSessionId({ rootDir, sessionId: 'session-explicit', provider: 'codex' });
  assert.equal(selection.sessionId, 'session-explicit');
  assert.equal(selection.source, 'explicit');
});

test('selectHudSessionId picks latest provider session by updatedAt', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');

  await writeJson(
    path.join(sessionsRoot, 'session-1', 'meta.json'),
    makeSessionMeta({ sessionId: 'session-1', agent: 'codex-cli', updatedAt: '2026-04-05T00:00:00.000Z' })
  );
  await writeJson(
    path.join(sessionsRoot, 'session-2', 'meta.json'),
    makeSessionMeta({ sessionId: 'session-2', agent: 'codex-cli', updatedAt: '2026-04-05T01:00:00.000Z' })
  );
  await writeJson(
    path.join(sessionsRoot, 'session-3', 'meta.json'),
    makeSessionMeta({ sessionId: 'session-3', agent: 'claude-code', updatedAt: '2026-04-05T02:00:00.000Z' })
  );

  const selection = await selectHudSessionId({ rootDir, provider: 'codex' });
  assert.equal(selection.sessionId, 'session-2');
  assert.equal(selection.agent, 'codex-cli');
  assert.equal(selection.source, 'provider-latest');
});

test('readHudState includes latest checkpoint and dispatch evidence', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'session-2';
  const sessionDir = path.join(sessionsRoot, sessionId);

  await writeJson(
    path.join(sessionDir, 'meta.json'),
    makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-05T01:00:00.000Z' })
  );
  await writeJson(path.join(sessionDir, 'state.json'), {
    sessionId,
    status: 'running',
    nextActions: ['Do X'],
  });
  await writeJsonLines(path.join(sessionDir, 'l1-checkpoints.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-05T00:30:00.000Z',
      status: 'running',
      summary: 'First checkpoint',
      nextActions: [],
      artifacts: [],
    },
    {
      seq: 2,
      ts: '2026-04-05T00:59:00.000Z',
      status: 'running',
      summary: 'Second checkpoint',
      nextActions: ['Next'],
      artifacts: ['memory/context-db/sessions/session-2/artifacts/dispatch-run-20260405T010000Z.json'],
      telemetry: {
        verification: { result: 'passed', evidence: 'unit-test' },
        retryCount: 1,
        failureCategory: 'none',
        elapsedMs: 123,
        cost: { totalTokens: 42, usd: 0.001 },
      },
    },
  ]);
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260405T005900Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-05T00:59:00.000Z',
    dispatchRun: {
      ok: false,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: [
        {
          jobId: 'phase.implement.wi.1',
          jobType: 'phase',
          role: 'implementer',
          status: 'blocked',
          turnId: '20260405T005900Z:phase.implement.wi.1:a1',
          workItemRefs: ['wi.1'],
          attempts: 1,
          output: { error: 'File policy violation' },
        },
        {
          jobId: 'phase.plan',
          jobType: 'phase',
          role: 'planner',
          status: 'simulated',
          output: { payload: { status: 'completed' } },
        },
      ],
      finalOutputs: [],
    },
  });
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260405T010000Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-05T01:00:00.000Z',
    dispatchRun: {
      ok: false,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: [
        {
          jobId: 'phase.implement.wi.1',
          jobType: 'phase',
          role: 'implementer',
          status: 'blocked',
          turnId: '20260405T010000Z:phase.implement.wi.1:a2',
          workItemRefs: ['wi.1'],
          attempts: 2,
          output: { error: 'File policy violation' },
        },
        {
          jobId: 'phase.plan',
          jobType: 'phase',
          role: 'planner',
          status: 'simulated',
          output: { payload: { status: 'completed' } },
        },
      ],
      finalOutputs: [],
    },
    workItemTelemetry: {
      schemaVersion: 1,
      generatedAt: '2026-04-05T01:00:00.000Z',
      totals: { total: 2, queued: 0, running: 0, blocked: 1, done: 1 },
      items: [],
    },
  });

  const state = await readHudState({ rootDir, sessionId });
  assert.equal(state.selection.sessionId, sessionId);
  assert.equal(state.session?.agent, 'codex-cli');
  assert.equal(state.latestCheckpoint?.seq, 2);
  assert.equal(state.latestCheckpoint?.telemetry?.verification?.result, 'passed');
  assert.equal(state.latestDispatch?.ok, false);
  assert.equal(state.latestDispatch?.blockedJobs, 1);
  assert.equal(state.latestDispatch?.blocked?.[0]?.turnId, '20260405T010000Z:phase.implement.wi.1:a2');
  assert.deepEqual(state.latestDispatch?.blocked?.[0]?.workItemRefs, ['wi.1']);
  assert.equal(state.latestDispatch?.blocked?.[0]?.attempts, 2);
  assert.equal(state.dispatchHindsight?.pairsAnalyzed, 1);
  assert.equal(state.dispatchHindsight?.repeatedBlockedTurns, 1);
  assert.equal(state.dispatchHindsight?.topRepeatedFailureClasses?.[0]?.failureClass, 'ownership-policy');
  assert.equal(state.dispatchFixHint?.targetId, 'runbook.dispatch-merge-triage');
  assert.ok(Array.isArray(state.suggestedCommands));
  assert.ok(state.suggestedCommands.some((cmd) => cmd.includes('orchestrate') && cmd.includes(sessionId)));
  assert.ok(state.suggestedCommands.some((cmd) => cmd.includes('doctor')));

  const rendered = renderHud(state, { preset: 'focused' });
  assert.match(rendered, /Dispatch Hindsight: pairs=1/);
  assert.match(rendered, /FixHint: \[runbook\.dispatch-merge-triage\]/);
});
