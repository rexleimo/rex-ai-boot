import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readHudDispatchSummary, readHudState, selectHudSessionId } from '../lib/hud/state.mjs';
import { renderHud } from '../lib/hud/render.mjs';
import { runTeamHistory } from '../lib/lifecycle/team-ops.mjs';

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
      items: [
        {
          itemId: 'phase.implement.wi.1',
          itemType: 'phase',
          role: 'implementer',
          status: 'blocked',
          failureClass: 'ownership-policy',
          retryClass: 'same-hypothesis',
        },
      ],
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
  assert.equal(state.latestDispatch?.blocked?.[0]?.failureClass, 'ownership-policy');
  assert.equal(state.latestDispatch?.blocked?.[0]?.retryClass, 'same-hypothesis');
  assert.equal(state.dispatchHindsight?.pairsAnalyzed, 1);
  assert.equal(state.dispatchHindsight?.repeatedBlockedTurns, 1);
  assert.equal(state.dispatchHindsight?.topRepeatedFailureClasses?.[0]?.failureClass, 'ownership-policy');
  assert.equal(state.dispatchFixHint?.targetId, 'runbook.dispatch-merge-triage');
  assert.match(
    state.dispatchFixHint?.nextCommand ?? '',
    /orchestrate --session session-2 --dispatch local --execute dry-run --format json/
  );
  assert.ok(Array.isArray(state.suggestedCommands));
  assert.ok(state.suggestedCommands.some((cmd) => cmd.includes('orchestrate') && cmd.includes(sessionId)));
  assert.ok(state.suggestedCommands.some((cmd) => cmd.includes('doctor')));

  const rendered = renderHud(state, { preset: 'focused' });
  assert.match(rendered, /Dispatch Hindsight: pairs=1/);
  assert.match(rendered, /FixHint: \[runbook\.dispatch-merge-triage\]/);
});

test('readHudDispatchSummary includes latest dispatch, hindsight, and fix hint', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-summary-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'dispatch-summary-session';
  const sessionDir = path.join(sessionsRoot, sessionId);
  const meta = makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-05T03:00:00.000Z' });

  await writeJson(path.join(sessionDir, 'meta.json'), meta);

  const jobRuns = (attempts) => [
    {
      jobId: 'phase.implement.wi.1',
      jobType: 'phase',
      role: 'implementer',
      status: 'blocked',
      attempts,
      output: { error: 'File policy violation' },
    },
    {
      jobId: 'phase.plan',
      jobType: 'phase',
      role: 'planner',
      status: 'simulated',
      output: { outputType: 'handoff' },
    },
  ];

  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260405T025900Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-05T02:59:00.000Z',
    dispatchRun: {
      ok: false,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: jobRuns(1),
      finalOutputs: [],
    },
  });
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260405T030000Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-05T03:00:00.000Z',
    dispatchRun: {
      ok: false,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: jobRuns(2),
      finalOutputs: [],
    },
  });

  const summary = await readHudDispatchSummary({ rootDir, sessionId, provider: 'codex', meta });
  assert.equal(summary.sessionId, sessionId);
  assert.equal(summary.provider, 'codex');
  assert.equal(summary.latestDispatch?.ok, false);
  assert.equal(summary.latestDispatch?.jobCount, 2);
  assert.equal(summary.latestDispatch?.blockedJobs, 1);
  assert.ok(String(summary.latestDispatch?.artifactPath || '').includes('dispatch-run-20260405T030000Z.json'));
  assert.equal(summary.dispatchHindsight?.pairsAnalyzed, 1);
  assert.equal(summary.dispatchHindsight?.repeatedBlockedTurns, 1);
  assert.equal(summary.dispatchFixHint?.targetId, 'runbook.dispatch-merge-triage');
  assert.match(
    summary.dispatchFixHint?.nextCommand ?? '',
    /orchestrate --session dispatch-summary-session --dispatch local --execute dry-run --format json/
  );
});

test('runTeamHistory includes dispatch hindsight summary and fix hint', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-team-history-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'history-session';
  const sessionDir = path.join(sessionsRoot, sessionId);

  await writeJson(
    path.join(sessionDir, 'meta.json'),
    makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-05T03:00:00.000Z' })
  );

  const jobRuns = (attempts) => [
    {
      jobId: 'phase.implement.wi.1',
      jobType: 'phase',
      role: 'implementer',
      status: 'blocked',
      attempts,
      output: { error: 'File policy violation' },
    },
    {
      jobId: 'phase.plan',
      jobType: 'phase',
      role: 'planner',
      status: 'simulated',
      output: { outputType: 'handoff' },
    },
  ];

  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260405T025900Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-05T02:59:00.000Z',
    dispatchRun: {
      ok: false,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: jobRuns(1),
      finalOutputs: [],
    },
  });
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260405T030000Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-05T03:00:00.000Z',
    dispatchRun: {
      ok: false,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: jobRuns(2),
      finalOutputs: [],
    },
  });

  const logs = [];
  await runTeamHistory(
    { provider: 'codex', limit: 5, json: true },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.at(-1));
  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.dispatchBlocked, 1);
  assert.equal(report.summary.hindsightUnstable, 1);
  assert.equal(report.summary.topFailures?.[0]?.failureClass, 'ownership-policy');
  assert.equal(report.summary.topFixHints?.[0]?.targetId, 'runbook.dispatch-merge-triage');
  assert.equal(report.summary.topJobs?.[0]?.jobId, 'phase.implement.wi.1');
  const record = report.records.find((item) => item.sessionId === sessionId);
  assert.ok(record, 'expected history record');
  assert.equal(record.dispatchHindsight.pairsAnalyzed, 1);
  assert.equal(record.dispatchHindsight.repeatedBlockedTurns, 1);
  assert.equal(record.dispatchHindsight.topFailureClass, 'ownership-policy');
  assert.equal(record.dispatchHindsight.topRepeatedJobId, 'phase.implement.wi.1');
  assert.equal(record.dispatchFixHint.targetId, 'runbook.dispatch-merge-triage');
  assert.match(
    record.dispatchFixHint.nextCommand ?? '',
    /orchestrate --session history-session --dispatch local --execute dry-run --format json/
  );
});

test('runTeamHistory preserves session ordering under concurrency', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-team-history-order-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');

  const firstSessionId = 'history-order-session-a';
  const secondSessionId = 'history-order-session-b';

  await writeJson(
    path.join(sessionsRoot, firstSessionId, 'meta.json'),
    makeSessionMeta({ sessionId: firstSessionId, agent: 'codex-cli', updatedAt: '2026-04-05T05:00:00.000Z' })
  );
  await writeJson(
    path.join(sessionsRoot, secondSessionId, 'meta.json'),
    makeSessionMeta({ sessionId: secondSessionId, agent: 'codex-cli', updatedAt: '2026-04-05T04:00:00.000Z' })
  );

  const jobRuns = (attempts) => [
    {
      jobId: 'phase.implement.wi.1',
      jobType: 'phase',
      role: 'implementer',
      status: 'blocked',
      attempts,
      output: { error: 'File policy violation' },
    },
    {
      jobId: 'phase.plan',
      jobType: 'phase',
      role: 'planner',
      status: 'simulated',
      output: { outputType: 'handoff' },
    },
  ];

  const writePair = async (sessionId, olderName, olderTs, newerName, newerTs) => {
    const artifactsDir = path.join(sessionsRoot, sessionId, 'artifacts');
    await writeJson(path.join(artifactsDir, olderName), {
      schemaVersion: 1,
      kind: 'orchestration.dispatch-run',
      sessionId,
      persistedAt: olderTs,
      dispatchRun: {
        ok: false,
        mode: 'dry-run',
        executorRegistry: ['local-dry-run'],
        jobRuns: jobRuns(1),
        finalOutputs: [],
      },
    });
    await writeJson(path.join(artifactsDir, newerName), {
      schemaVersion: 1,
      kind: 'orchestration.dispatch-run',
      sessionId,
      persistedAt: newerTs,
      dispatchRun: {
        ok: false,
        mode: 'dry-run',
        executorRegistry: ['local-dry-run'],
        jobRuns: jobRuns(2),
        finalOutputs: [],
      },
    });
  };

  await writePair(
    firstSessionId,
    'dispatch-run-20260405T045900Z.json',
    '2026-04-05T04:59:00.000Z',
    'dispatch-run-20260405T050000Z.json',
    '2026-04-05T05:00:00.000Z'
  );
  await writePair(
    secondSessionId,
    'dispatch-run-20260405T035900Z.json',
    '2026-04-05T03:59:00.000Z',
    'dispatch-run-20260405T040000Z.json',
    '2026-04-05T04:00:00.000Z'
  );

  const logs = [];
  await runTeamHistory(
    { provider: 'codex', limit: 10, json: true },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );

  const report = JSON.parse(logs.at(-1));
  assert.equal(report.records.length, 2);
  assert.deepEqual(report.records.map((record) => record.sessionId), [firstSessionId, secondSessionId]);
});
