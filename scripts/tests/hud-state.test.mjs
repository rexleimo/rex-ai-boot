import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildHindsightEval } from '../lib/harness/hindsight-eval.mjs';
import { readHudDispatchSummary, readHudState, selectHudSessionId } from '../lib/hud/state.mjs';
import { renderHud } from '../lib/hud/render.mjs';
import { computeAdaptiveNextIntervalMs, createThrottledWatchRender, watchRenderLoop } from '../lib/hud/watch.mjs';
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

test('selectHudSessionId scales to many sessions', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-many-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');

  const writeMany = async (prefix, agent, count, startHour) => {
    for (let index = 0; index < count; index += 1) {
      const sessionId = `${prefix}-${String(index).padStart(2, '0')}`;
      const hour = startHour;
      const minute = index;
      await writeJson(
        path.join(sessionsRoot, sessionId, 'meta.json'),
        makeSessionMeta({ sessionId, agent, updatedAt: `2026-04-05T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z` })
      );
    }
  };

  await writeMany('codex', 'codex-cli', 25, 0);
  await writeMany('claude', 'claude-code', 25, 0);

  const selection = await selectHudSessionId({ rootDir, provider: 'codex' });
  assert.equal(selection.sessionId, 'codex-24');
  assert.equal(selection.agent, 'codex-cli');
  assert.equal(selection.source, 'provider-latest');
});

test('selectHudSessionId caches session directory listing until sessionsRoot changes', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-sessions-cache-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');

  for (let index = 0; index < 10; index += 1) {
    const sessionId = `session-${String(index).padStart(2, '0')}`;
    await writeJson(
      path.join(sessionsRoot, sessionId, 'meta.json'),
      makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: `2026-04-06T00:00:${String(index).padStart(2, '0')}.000Z` })
    );
  }

  const originalReaddir = fs.readdir;
  let readdirCount = 0;
  fs.readdir = async (dirPath, ...rest) => {
    if (String(dirPath) === sessionsRoot) {
      readdirCount += 1;
    }
    return await originalReaddir(dirPath, ...rest);
  };

  try {
    const first = await selectHudSessionId({ rootDir, provider: 'codex' });
    const second = await selectHudSessionId({ rootDir, provider: 'codex' });
    assert.equal(first.source, 'provider-latest');
    assert.equal(second.source, 'provider-latest');
    assert.equal(readdirCount, 1);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await writeJson(
      path.join(sessionsRoot, 'session-99', 'meta.json'),
      makeSessionMeta({ sessionId: 'session-99', agent: 'codex-cli', updatedAt: '2026-04-06T00:01:00.000Z' })
    );

    const third = await selectHudSessionId({ rootDir, provider: 'codex' });
    assert.equal(third.source, 'provider-latest');
    assert.equal(readdirCount, 2);
  } finally {
    fs.readdir = originalReaddir;
  }
});

test('buildHindsightEval caches artifact signatures to avoid redundant fs.stat', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-hindsight-sig-cache-'));
  const sessionId = 'hindsight-sig-cache-session';
  const artifactsDir = path.join(rootDir, 'memory', 'context-db', 'sessions', sessionId, 'artifacts');

  const olderPath = path.join(artifactsDir, 'dispatch-run-20260406T000000Z.json');
  const newerPath = path.join(artifactsDir, 'dispatch-run-20260406T000001Z.json');

  await writeJson(olderPath, {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-06T00:00:00.000Z',
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
          attempts: 1,
          output: { error: 'File policy violation' },
        },
      ],
      finalOutputs: [],
    },
  });
  await writeJson(newerPath, {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-06T00:00:01.000Z',
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
          attempts: 2,
          output: { error: 'File policy violation' },
        },
      ],
      finalOutputs: [],
    },
  });

  const dispatchEvidence = [
    {
      artifactPath: path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', path.basename(newerPath)),
    },
    {
      artifactPath: path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', path.basename(olderPath)),
    },
  ];

  const meta = makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T00:00:02.000Z' });

  const originalStat = fs.stat;
  let statCount = 0;
  fs.stat = async (...args) => {
    statCount += 1;
    return await originalStat(...args);
  };

  try {
    const first = await buildHindsightEval({ rootDir, meta, dispatchEvidence, maxArtifacts: 2, maxPairs: 1 });
    assert.equal(first.pairsAnalyzed, 1);
    assert.equal(statCount, 2);

    const second = await buildHindsightEval({ rootDir, meta, dispatchEvidence, maxArtifacts: 2, maxPairs: 1 });
    assert.equal(second.pairsAnalyzed, 1);
    assert.equal(statCount, 2);
  } finally {
    fs.stat = originalStat;
  }
});

test('watchRenderLoop skips redraw when output is unchanged', async () => {
  const stdoutWrites = [];
  const stderrWrites = [];
  let stopHandler = null;
  let callCount = 0;

  await watchRenderLoop(async () => {
    callCount += 1;
    if (callCount === 1) return 'hello';
    if (callCount === 2) return 'hello';
    if (callCount === 3) {
      if (typeof stopHandler === 'function') stopHandler();
      return 'world';
    }
    return 'world';
  }, {
    intervalMs: 5,
    isTTY: true,
    env: {},
    writeStdout: (text) => stdoutWrites.push(String(text)),
    writeStderr: (text) => stderrWrites.push(String(text)),
    registerSigint: (handler) => {
      stopHandler = handler;
    },
  });

  assert.equal(stderrWrites.length, 0);
  const stdout = stdoutWrites.join('');
  assert.equal(stdout.split('hello').length - 1, 1);
  assert.equal(stdout.split('world').length - 1, 1);
});

test('createThrottledWatchRender limits read cadence while reusing last output', async () => {
  let nowMs = 0;
  let callCount = 0;
  const throttledRender = createThrottledWatchRender(async () => {
    callCount += 1;
    return `frame-${callCount}`;
  }, {
    minIntervalMs: 1000,
    nowFn: () => nowMs,
  });

  assert.equal(await throttledRender(), 'frame-1');
  assert.equal(callCount, 1);

  nowMs = 100;
  assert.equal(await throttledRender(), 'frame-1');
  assert.equal(callCount, 1);

  nowMs = 999;
  assert.equal(await throttledRender(), 'frame-1');
  assert.equal(callCount, 1);

  nowMs = 1000;
  assert.equal(await throttledRender(), 'frame-2');
  assert.equal(callCount, 2);
});

test('computeAdaptiveNextIntervalMs backs off on idle and resets on change', () => {
  assert.equal(computeAdaptiveNextIntervalMs(250, {
    changed: false,
    minIntervalMs: 250,
    maxIntervalMs: 2000,
    backoffMultiplier: 2,
  }), 500);
  assert.equal(computeAdaptiveNextIntervalMs(500, {
    changed: false,
    minIntervalMs: 250,
    maxIntervalMs: 2000,
    backoffMultiplier: 2,
  }), 1000);
  assert.equal(computeAdaptiveNextIntervalMs(1000, {
    changed: false,
    minIntervalMs: 250,
    maxIntervalMs: 2000,
    backoffMultiplier: 2,
  }), 2000);
  assert.equal(computeAdaptiveNextIntervalMs(2000, {
    changed: false,
    minIntervalMs: 250,
    maxIntervalMs: 2000,
    backoffMultiplier: 2,
  }), 2000);
  assert.equal(computeAdaptiveNextIntervalMs(2000, {
    changed: true,
    minIntervalMs: 250,
    maxIntervalMs: 2000,
    backoffMultiplier: 2,
  }), 250);
});

test('renderHud minimal shows watch visibility and quality category labels', () => {
  const rendered = renderHud({
    selection: { sessionId: 's-1', provider: 'codex', agent: 'codex-cli' },
    latestDispatch: { ok: false, blockedJobs: 2 },
    latestQualityGate: {
      outcome: 'retry-needed',
      categoryRef: 'category:quality-logs',
    },
  }, {
    preset: 'minimal',
    watchMeta: {
      renderIntervalMs: 250,
      dataRefreshMs: 1000,
      fast: true,
      dataAgeMs: 20000,
    },
  });

  assert.match(rendered, /session=s-1/);
  assert.match(rendered, /dispatch=blocked\(2\)/);
  assert.match(rendered, /quality=failed\(category:quality-logs\)/);
  assert.match(rendered, /watch: render=250ms data-refresh=1000ms fast=on data-age=20000ms/);
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
  await writeJsonLines(path.join(sessionDir, 'l2-events.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-05T00:58:59.000Z',
      role: 'assistant',
      kind: 'orchestration.dispatch-run',
      text: 'dispatch run',
    },
    {
      seq: 2,
      ts: '2026-04-05T01:00:00.000Z',
      role: 'assistant',
      kind: 'verification.quality-gate',
      text: 'quality gate failed',
      turn: {
        turnId: 'quality-gate:20260405T010000Z:summary',
        turnType: 'verification',
        environment: 'quality-gate',
        hindsightStatus: 'evaluated',
        outcome: 'retry-needed',
        nextStateRefs: ['check:logs', 'category:quality-logs'],
      },
    },
  ]);

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
  assert.equal(state.latestQualityGate?.kind, 'verification.quality-gate');
  assert.equal(state.latestQualityGate?.turnId, 'quality-gate:20260405T010000Z:summary');
  assert.equal(state.latestQualityGate?.outcome, 'retry-needed');
  assert.equal(state.latestQualityGate?.categoryRef, 'category:quality-logs');
  assert.equal(state.latestQualityGate?.failureCategory, 'quality-logs');
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

test('readHudState caches latest checkpoint tail until file changes', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-checkpoint-cache-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'checkpoint-cache-session';
  const sessionDir = path.join(sessionsRoot, sessionId);
  const checkpointPath = path.join(sessionDir, 'l1-checkpoints.jsonl');

  await writeJson(
    path.join(sessionDir, 'meta.json'),
    makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T00:00:00.000Z' })
  );
  await writeJson(path.join(sessionDir, 'state.json'), { sessionId, status: 'running' });
  await writeJsonLines(checkpointPath, [
    {
      seq: 1,
      ts: '2026-04-06T00:00:00.000Z',
      status: 'running',
      summary: 'First checkpoint',
      nextActions: [],
      artifacts: [],
    },
  ]);

  const originalOpen = fs.open;
  let openCount = 0;
  fs.open = async (filePath, flags, ...rest) => {
    if (String(filePath) === checkpointPath && String(flags) === 'r') {
      openCount += 1;
    }
    return await originalOpen(filePath, flags, ...rest);
  };

  try {
    const first = await readHudState({ rootDir, sessionId });
    const second = await readHudState({ rootDir, sessionId });

    assert.equal(first.latestCheckpoint?.seq, 1);
    assert.equal(second.latestCheckpoint?.seq, 1);
    assert.equal(openCount, 1);

    await fs.appendFile(
      checkpointPath,
      `${JSON.stringify({
        seq: 2,
        ts: '2026-04-06T00:00:01.000Z',
        status: 'running',
        summary: 'Second checkpoint',
        nextActions: [],
        artifacts: [],
      })}\n`,
      'utf8'
    );

    const third = await readHudState({ rootDir, sessionId });
    assert.equal(third.latestCheckpoint?.seq, 2);
    assert.equal(openCount, 2);
  } finally {
    fs.open = originalOpen;
  }
});

test('readHudState fast mode skips non-minimal heavy reads', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-fast-state-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'fast-state-session';
  const sessionDir = path.join(sessionsRoot, sessionId);
  const statePath = path.join(sessionDir, 'state.json');
  const checkpointPath = path.join(sessionDir, 'l1-checkpoints.jsonl');

  await writeJson(
    path.join(sessionDir, 'meta.json'),
    makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T02:00:00.000Z' })
  );
  await writeJson(statePath, { sessionId, status: 'running', nextActions: ['inspect'] });
  await writeJsonLines(checkpointPath, [
    {
      seq: 1,
      ts: '2026-04-06T02:00:00.000Z',
      status: 'running',
      summary: 'checkpoint should be skipped in fast mode',
      nextActions: [],
      artifacts: [],
    },
  ]);
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260406T020000Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-06T02:00:00.000Z',
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
          attempts: 1,
          output: { error: 'File policy violation' },
        },
      ],
      finalOutputs: [],
    },
  });
  await writeJsonLines(path.join(sessionDir, 'l2-events.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-06T02:00:00.000Z',
      role: 'assistant',
      kind: 'verification.quality-gate',
      text: 'quality gate failed',
      turn: {
        turnId: 'quality-gate:20260406T020000Z:summary',
        turnType: 'verification',
        environment: 'quality-gate',
        hindsightStatus: 'evaluated',
        outcome: 'retry-needed',
        nextStateRefs: ['category:quality-logs'],
      },
    },
  ]);

  const originalReadFile = fs.readFile;
  const originalOpen = fs.open;
  const reads = { state: 0, checkpointOpen: 0 };
  fs.readFile = async (filePath, ...rest) => {
    if (String(filePath) === statePath) {
      reads.state += 1;
    }
    return await originalReadFile(filePath, ...rest);
  };
  fs.open = async (filePath, flags, ...rest) => {
    if (String(filePath) === checkpointPath && String(flags) === 'r') {
      reads.checkpointOpen += 1;
    }
    return await originalOpen(filePath, flags, ...rest);
  };

  try {
    const state = await readHudState({ rootDir, sessionId, fast: true });
    assert.equal(state.selection.sessionId, sessionId);
    assert.equal(state.session?.sessionId, sessionId);
    assert.equal(state.sessionState, null);
    assert.equal(state.latestCheckpoint, null);
    assert.equal(state.latestDispatch?.ok, false);
    assert.equal(state.latestDispatch?.blockedJobs, 1);
    assert.equal(state.latestQualityGate?.turnId, 'quality-gate:20260406T020000Z:summary');
    assert.equal(state.latestQualityGate?.categoryRef, 'category:quality-logs');
    assert.equal(state.dispatchHindsight, null);
    assert.equal(state.dispatchFixHint, null);
    assert.deepEqual(state.suggestedCommands, []);
    assert.deepEqual(reads, { state: 0, checkpointOpen: 0 });
  } finally {
    fs.readFile = originalReadFile;
    fs.open = originalOpen;
  }
});

test('readHudState caches meta/state JSON reads until files change', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-json-cache-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'json-cache-session';
  const sessionDir = path.join(sessionsRoot, sessionId);
  const metaPath = path.join(sessionDir, 'meta.json');
  const statePath = path.join(sessionDir, 'state.json');

  await writeJson(
    metaPath,
    makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T00:00:00.000Z' })
  );
  await writeJson(statePath, { sessionId, status: 'running', nextActions: ['A'] });
  await writeJsonLines(path.join(sessionDir, 'l1-checkpoints.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-06T00:00:00.000Z',
      status: 'running',
      summary: 'First checkpoint',
      nextActions: [],
      artifacts: [],
    },
  ]);

  const originalReadFile = fs.readFile;
  const reads = { meta: 0, state: 0 };
  fs.readFile = async (filePath, ...rest) => {
    if (String(filePath) === metaPath) reads.meta += 1;
    if (String(filePath) === statePath) reads.state += 1;
    return await originalReadFile(filePath, ...rest);
  };

  try {
    const first = await readHudState({ rootDir, sessionId });
    const second = await readHudState({ rootDir, sessionId });

    assert.equal(first.session?.sessionId, sessionId);
    assert.equal(first.sessionState?.nextActions?.[0], 'A');
    assert.equal(second.session?.sessionId, sessionId);
    assert.equal(second.sessionState?.nextActions?.[0], 'A');
    assert.deepEqual(reads, { meta: 1, state: 1 });

    await writeJson(statePath, { sessionId, status: 'running', nextActions: ['B'] });

    const third = await readHudState({ rootDir, sessionId });
    assert.equal(third.sessionState?.nextActions?.[0], 'B');
    assert.deepEqual(reads, { meta: 1, state: 2 });
  } finally {
    fs.readFile = originalReadFile;
  }
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
  await writeJsonLines(path.join(sessionDir, 'l2-events.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-05T03:00:00.000Z',
      role: 'assistant',
      kind: 'verification.quality-gate',
      text: 'quality gate failed',
      turn: {
        turnId: 'quality-gate:20260405T030000Z:summary',
        turnType: 'verification',
        environment: 'quality-gate',
        hindsightStatus: 'evaluated',
        outcome: 'retry-needed',
        nextStateRefs: ['category:quality-logs'],
      },
    },
  ]);

  const summary = await readHudDispatchSummary({ rootDir, sessionId, provider: 'codex', meta });
  assert.equal(summary.sessionId, sessionId);
  assert.equal(summary.provider, 'codex');
  assert.equal(summary.latestDispatch?.ok, false);
  assert.equal(summary.latestDispatch?.jobCount, 2);
  assert.equal(summary.latestDispatch?.blockedJobs, 1);
  assert.ok(String(summary.latestDispatch?.artifactPath || '').includes('dispatch-run-20260405T030000Z.json'));
  assert.equal(summary.dispatchHindsight?.pairsAnalyzed, 1);
  assert.equal(summary.dispatchHindsight?.repeatedBlockedTurns, 1);
  assert.equal(summary.latestQualityGate?.turnId, 'quality-gate:20260405T030000Z:summary');
  assert.equal(summary.latestQualityGate?.categoryRef, 'category:quality-logs');
  assert.equal(summary.latestQualityGate?.failureCategory, 'quality-logs');
  assert.equal(summary.dispatchFixHint?.targetId, 'runbook.dispatch-merge-triage');
  assert.match(
    summary.dispatchFixHint?.nextCommand ?? '',
    /orchestrate --session dispatch-summary-session --dispatch local --execute dry-run --format json/
  );
});

test('readHudDispatchSummary refreshes latest dispatch after new artifact is written', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-hud-dispatch-cache-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'dispatch-cache-session';
  const sessionDir = path.join(sessionsRoot, sessionId);
  const meta = makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T00:00:00.000Z' });

  await writeJson(path.join(sessionDir, 'meta.json'), meta);

  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260406T000000Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-06T00:00:00.000Z',
    dispatchRun: {
      ok: true,
      mode: 'dry-run',
      executorRegistry: ['local-dry-run'],
      jobRuns: [],
      finalOutputs: [],
    },
  });

  const first = await readHudDispatchSummary({ rootDir, sessionId, provider: 'codex', meta });
  assert.ok(String(first.latestDispatch?.artifactPath || '').includes('dispatch-run-20260406T000000Z.json'));

  await new Promise((resolve) => setTimeout(resolve, 10));
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260406T000001Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-06T00:00:01.000Z',
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
          attempts: 1,
          output: { error: 'File policy violation' },
        },
      ],
      finalOutputs: [],
    },
  });

  const second = await readHudDispatchSummary({ rootDir, sessionId, provider: 'codex', meta });
  assert.ok(String(second.latestDispatch?.artifactPath || '').includes('dispatch-run-20260406T000001Z.json'));
  assert.equal(second.latestDispatch?.ok, false);
  assert.equal(second.latestDispatch?.blockedJobs, 1);
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
  await writeJsonLines(path.join(sessionDir, 'l2-events.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-05T03:00:00.000Z',
      role: 'assistant',
      kind: 'verification.quality-gate',
      text: 'quality gate failed',
      turn: {
        turnId: 'quality-gate:20260405T030000Z:summary',
        turnType: 'verification',
        environment: 'quality-gate',
        hindsightStatus: 'evaluated',
        outcome: 'retry-needed',
        nextStateRefs: ['check:logs', 'category:quality-logs'],
      },
    },
  ]);

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
  assert.equal(report.summary.topQualityFailures?.[0]?.failureCategory, 'quality-logs');
  assert.equal(report.summary.topFixHints?.[0]?.targetId, 'runbook.dispatch-merge-triage');
  assert.equal(report.summary.topJobs?.[0]?.jobId, 'phase.implement.wi.1');
  const record = report.records.find((item) => item.sessionId === sessionId);
  assert.ok(record, 'expected history record');
  assert.equal(record.dispatchHindsight.pairsAnalyzed, 1);
  assert.equal(record.dispatchHindsight.repeatedBlockedTurns, 1);
  assert.equal(record.dispatchHindsight.topFailureClass, 'ownership-policy');
  assert.equal(record.dispatchHindsight.topRepeatedJobId, 'phase.implement.wi.1');
  assert.equal(record.qualityGate.outcome, 'retry-needed');
  assert.equal(record.qualityGate.failureCategory, 'quality-logs');
  assert.equal(record.dispatchFixHint.targetId, 'runbook.dispatch-merge-triage');
  assert.match(
    record.dispatchFixHint.nextCommand ?? '',
    /orchestrate --session history-session --dispatch local --execute dry-run --format json/
  );
});

test('runTeamHistory fast mode skips dispatch hindsight and fix hint', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-team-history-fast-'));
  const sessionsRoot = path.join(rootDir, 'memory', 'context-db', 'sessions');
  const sessionId = 'history-fast-session';
  const sessionDir = path.join(sessionsRoot, sessionId);

  await writeJson(
    path.join(sessionDir, 'meta.json'),
    makeSessionMeta({ sessionId, agent: 'codex-cli', updatedAt: '2026-04-06T03:00:00.000Z' })
  );
  await writeJson(path.join(sessionDir, 'artifacts', 'dispatch-run-20260406T030000Z.json'), {
    schemaVersion: 1,
    kind: 'orchestration.dispatch-run',
    sessionId,
    persistedAt: '2026-04-06T03:00:00.000Z',
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
          attempts: 1,
          output: { error: 'File policy violation' },
        },
      ],
      finalOutputs: [],
    },
  });
  await writeJsonLines(path.join(sessionDir, 'l2-events.jsonl'), [
    {
      seq: 1,
      ts: '2026-04-06T03:00:00.000Z',
      role: 'assistant',
      kind: 'verification.quality-gate',
      text: 'quality gate failed',
      turn: {
        turnId: 'quality-gate:20260406T030000Z:summary',
        turnType: 'verification',
        environment: 'quality-gate',
        hindsightStatus: 'evaluated',
        outcome: 'retry-needed',
        nextStateRefs: ['category:quality-logs'],
      },
    },
  ]);

  const logs = [];
  await runTeamHistory(
    { provider: 'codex', limit: 5, json: true, fast: true },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.at(-1));
  assert.equal(report.fast, true);
  assert.equal(report.records.length, 1);
  const record = report.records[0];
  assert.equal(record.sessionId, sessionId);
  assert.equal(record.dispatchHindsight, null);
  assert.equal(record.dispatchFixHint, null);
  assert.equal(record.qualityGate.outcome, 'retry-needed');
  assert.equal(record.qualityGate.failureCategory, 'quality-logs');
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
