import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  appendEvent,
  buildTimeline,
  buildContextPacket,
  createSession,
  ensureContextDb,
  getEventById,
  searchEvents,
  writeCheckpoint,
} from '../src/contextdb/core.js';
import { timelineCheckpointRows } from '../src/contextdb/sqlite.js';

async function makeWorkspace(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ctxdb-'));
  await fs.mkdir(path.join(workspace, 'config'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'config', 'browser-profiles.json'), '{"profiles":{}}', 'utf8');
  return workspace;
}

test('ensureContextDb initializes expected directory structure', async () => {
  const workspace = await makeWorkspace();
  const dbRoot = await ensureContextDb(workspace);

  const manifestPath = path.join(dbRoot, 'manifest.json');
  const sessionsPath = path.join(dbRoot, 'sessions');
  const indexPath = path.join(dbRoot, 'index', 'sessions.jsonl');
  const sqlitePath = path.join(dbRoot, 'index', 'context.db');

  const [manifestRaw, sessionsStat, indexStat, sqliteStat] = await Promise.all([
    fs.readFile(manifestPath, 'utf8'),
    fs.stat(sessionsPath),
    fs.stat(indexPath),
    fs.stat(sqlitePath),
  ]);

  const manifest = JSON.parse(manifestRaw) as { version: number; layout: string };
  assert.equal(manifest.version, 1);
  assert.equal(manifest.layout, 'l0-l1-l2');
  assert.equal(sessionsStat.isDirectory(), true);
  assert.equal(indexStat.isFile(), true);
  assert.equal(sqliteStat.isFile(), true);
});

test('contextdb cli supports index:rebuild', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'rebuild index smoke test',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'Need index rebuild command',
  });

  const result = spawnSync('npx', ['tsx', 'src/contextdb/cli.ts', 'index:rebuild', '--workspace', workspace], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse((result.stdout || '{}').trim()) as { ok?: boolean };
  assert.equal(payload.ok, true);
});

test('contextdb cli checkpoint accepts telemetry flags', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'checkpoint cli telemetry',
  });

  const result = spawnSync(
    'npx',
    [
      'tsx',
      'src/contextdb/cli.ts',
      'checkpoint',
      '--workspace',
      workspace,
      '--session',
      session.sessionId,
      '--summary',
      'CLI telemetry checkpoint',
      '--verify-result',
      'failed',
      '--verify-evidence',
      'quality-gate quick',
      '--retry-count',
      '3',
      '--failure-category',
      'timeout',
      '--elapsed-ms',
      '987',
      '--cost-input-tokens',
      '120',
      '--cost-output-tokens',
      '80',
      '--cost-usd',
      '0.45',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse((result.stdout || '{}').trim()) as {
    telemetry?: {
      verification?: { result?: string; evidence?: string };
      retryCount?: number;
      failureCategory?: string;
      elapsedMs?: number;
      cost?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; usd?: number };
    };
  };
  assert.deepEqual(payload.telemetry, {
    verification: { result: 'failed', evidence: 'quality-gate quick' },
    retryCount: 3,
    failureCategory: 'timeout',
    elapsedMs: 987,
    cost: {
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      usd: 0.45,
    },
  });
});

test('createSession writes metadata and index record', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'claude-code',
    project: 'rex-cli',
    goal: 'Diagnose flaky browser launch',
    tags: ['debug', 'browser'],
  });

  const metaPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'meta.json'
  );
  const indexPath = path.join(workspace, 'memory', 'context-db', 'index', 'sessions.jsonl');

  const [metaRaw, indexRaw] = await Promise.all([
    fs.readFile(metaPath, 'utf8'),
    fs.readFile(indexPath, 'utf8'),
  ]);

  const meta = JSON.parse(metaRaw) as { agent: string; project: string; goal: string };
  assert.equal(meta.agent, 'claude-code');
  assert.equal(meta.project, 'rex-cli');
  assert.equal(meta.goal, 'Diagnose flaky browser launch');
  assert.match(indexRaw, new RegExp(session.sessionId));
});

test('appendEvent and writeCheckpoint persist l2/l1 context', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'gemini-cli',
    project: 'rex-cli',
    goal: 'Publish xiaohongshu post safely',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    text: 'Need a safe posting flow.',
    kind: 'request',
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    text: 'Start with auth gate checks and pacing.',
    kind: 'plan',
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Auth gate is present; waiting for manual login.',
    status: 'blocked',
    nextActions: ['Wait for human login', 'Resume snapshot and publish draft'],
    artifacts: ['screenshots/auth-gate.png'],
  });

  const eventsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l2-events.jsonl'
  );
  const checkpointsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l1-checkpoints.jsonl'
  );
  const summaryPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l0-summary.md'
  );

  const [eventsRaw, checkpointsRaw, summaryRaw] = await Promise.all([
    fs.readFile(eventsPath, 'utf8'),
    fs.readFile(checkpointsPath, 'utf8'),
    fs.readFile(summaryPath, 'utf8'),
  ]);

  const eventLines = eventsRaw.trim().split('\n');
  const checkpointLines = checkpointsRaw.trim().split('\n');

  assert.equal(eventLines.length, 2);
  assert.equal(checkpointLines.length, 1);
  assert.match(summaryRaw, /Auth gate is present/);
});

test('writeCheckpoint normalizes telemetry and mirrors it to sidecar indexes', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'Capture checkpoint telemetry',
  });

  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Telemetry checkpoint.',
    status: 'running',
    telemetry: {
      verification: { result: 'passed', evidence: 'quality-gate quick' },
      retryCount: 2.9,
      failureCategory: ' Timeout ',
      elapsedMs: 1543.8,
      cost: {
        inputTokens: 120,
        outputTokens: 30,
        usd: 0.42,
      },
    },
  });

  const checkpointsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l1-checkpoints.jsonl'
  );
  const summaryPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l0-summary.md'
  );
  const sqlitePath = path.join(workspace, 'memory', 'context-db', 'index', 'context.db');

  const [checkpointsRaw, summaryRaw] = await Promise.all([
    fs.readFile(checkpointsPath, 'utf8'),
    fs.readFile(summaryPath, 'utf8'),
  ]);

  const checkpoint = JSON.parse(checkpointsRaw.trim()) as {
    telemetry?: {
      verification?: { result?: string; evidence?: string };
      retryCount?: number;
      failureCategory?: string;
      elapsedMs?: number;
      cost?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; usd?: number };
    };
  };
  assert.deepEqual(checkpoint.telemetry, {
    verification: { result: 'passed', evidence: 'quality-gate quick' },
    retryCount: 2,
    failureCategory: 'timeout',
    elapsedMs: 1543,
    cost: {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      usd: 0.42,
    },
  });
  assert.match(summaryRaw, /## Telemetry/);
  assert.match(summaryRaw, /Verification: passed \(quality-gate quick\)/);
  assert.match(summaryRaw, /Retry Count: 2/);
  assert.match(summaryRaw, /Elapsed: 1543 ms/);

  const checkpointRows = timelineCheckpointRows(sqlitePath, { sessionId: session.sessionId, limit: 5 });
  assert.equal(checkpointRows.length, 1);
  assert.deepEqual(checkpointRows[0].telemetry, checkpoint.telemetry);

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 5,
  });
  assert.match(packet.markdown, /Telemetry:/);
  assert.match(packet.markdown, /Failure Category: timeout/);
});

test('buildContextPacket composes markdown for agent handoff', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'claude-code',
    project: 'rex-cli',
    goal: 'Generate image workflow docs',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    text: 'Analyze OpenViking and simplify context DB flow.',
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Need filesystem-only context DB MVP.',
    nextActions: ['Create CLI commands', 'Write runbook'],
    status: 'running',
  });

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 10,
  });

  assert.match(packet.markdown, /Context Packet/);
  assert.match(packet.markdown, /filesystem-only context DB MVP/);
  assert.match(packet.markdown, /Analyze OpenViking/);
});

test('buildContextPacket tolerates legacy events missing text', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'Legacy event regression test',
  });

  const eventsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l2-events.jsonl'
  );

  // Simulate a legacy/corrupt event line where "text" is missing entirely.
  await fs.appendFile(eventsPath, `${JSON.stringify({
    ts: '2026-03-10T00:00:00.000Z',
    role: 'user',
    kind: 'prompt',
    refs: [],
  })}\n`);

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 5,
  });

  assert.match(packet.markdown, /Recent Events/);
  assert.match(packet.markdown, new RegExp(`${session.sessionId}#\\?`));
  assert.match(packet.markdown, /user\/prompt/);
});

test('buildContextPacket tolerates legacy events with non-array refs', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'Legacy refs regression test',
  });

  const eventsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l2-events.jsonl'
  );

  // Simulate a legacy/corrupt event line where "refs" is a string.
  await fs.appendFile(eventsPath, `${JSON.stringify({
    ts: '2026-03-10T00:00:00.000Z',
    role: 'user',
    kind: 'prompt',
    text: 'Legacy refs payload',
    refs: 'core.ts',
  })}\n`);

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 5,
    refs: ['core.ts'],
  });

  assert.match(packet.markdown, /Event Filters: kinds=\(all\) refs=core\.ts/);
  assert.match(packet.markdown, /Legacy refs payload/);
  assert.match(packet.markdown, /refs=\[core\.ts\]/);
});

test('buildContextPacket tolerates legacy checkpoints missing action/artifact arrays', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'Legacy checkpoint regression test',
  });

  const checkpointsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l1-checkpoints.jsonl'
  );

  // Simulate a legacy/corrupt checkpoint line where "nextActions" and "artifacts" are missing.
  await fs.appendFile(checkpointsPath, `${JSON.stringify({
    ts: '2026-03-10T00:00:00.000Z',
    status: 'running',
    summary: 'Legacy checkpoint',
  })}\n`);

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 5,
  });

  assert.match(packet.markdown, /## L1 Snapshot/);
  assert.match(packet.markdown, /Next Actions:/);
  assert.match(packet.markdown, /Artifacts:/);
  assert.match(packet.markdown, /- \(none\)/);
});

test('appendEvent deduplicates rapid duplicate events', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'Validate dedupe',
  });

  const first = await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Same response body',
    refs: ['core.ts'],
  });
  const second = await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Same response body',
    refs: ['core.ts'],
  });

  const eventsPath = path.join(
    workspace,
    'memory',
    'context-db',
    'sessions',
    session.sessionId,
    'l2-events.jsonl'
  );
  const eventsRaw = await fs.readFile(eventsPath, 'utf8');
  const lines = eventsRaw.trim().split('\n').filter(Boolean);

  assert.equal(lines.length, 1);
  assert.equal(first.seq, second.seq);
});

test('buildContextPacket supports kind/ref filtering and token budget', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'claude-code',
    project: 'rex-cli',
    goal: 'Filter packet events',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'First prompt should be excluded.',
    refs: ['task.md'],
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Long response for pack budget verification and downstream context handoff.',
    refs: ['core.ts', 'cli.ts'],
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Checkpoint summary for packet.',
    status: 'running',
    nextActions: ['Continue'],
  });

  const packet = await buildContextPacket({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    eventLimit: 50,
    tokenBudget: 18,
    kinds: ['response'],
    refs: ['core.ts'],
  });

  assert.match(packet.markdown, /Event Filters: kinds=response refs=core\.ts/);
  assert.match(packet.markdown, /response/);
  assert.doesNotMatch(packet.markdown, /First prompt should be excluded/);
});

test('searchEvents, getEventById, and buildTimeline use sidecar indexes', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'gemini-cli',
    project: 'rex-cli',
    goal: 'Exercise sidecar index APIs',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'Investigate auth race condition',
    refs: ['auth.ts'],
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'Auth race likely in refresh path',
    refs: ['auth.ts', 'token.ts'],
  });
  await writeCheckpoint({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    summary: 'Race condition isolated.',
    status: 'running',
    nextActions: ['Patch token refresh'],
    artifacts: ['logs/auth-race.log'],
  });

  const found = await searchEvents({
    workspaceRoot: workspace,
    query: 'auth race',
    project: 'rex-cli',
    kinds: ['response'],
    refs: ['auth.ts'],
    limit: 10,
  });

  assert.equal(found.results.length, 1);
  assert.match(found.results[0].eventId, new RegExp(`^${session.sessionId}#`));

  const byId = await getEventById({
    workspaceRoot: workspace,
    eventId: found.results[0].eventId,
  });
  assert.equal(byId.event?.kind, 'response');
  assert.match(byId.event?.text ?? '', /refresh path/);

  const timeline = await buildTimeline({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    limit: 5,
  });
  assert.ok(timeline.items.length >= 2);
  assert.ok(timeline.items.some((item) => item.itemType === 'checkpoint'));
});

test('searchEvents rebuilds sqlite sidecar when context.db is missing', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'recover from missing sqlite sidecar',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'sidecar rebuild should recover this event',
    refs: ['core.ts'],
  });

  const sqlitePath = path.join(workspace, 'memory', 'context-db', 'index', 'context.db');
  await fs.unlink(sqlitePath);
  const walPath = `${sqlitePath}-wal`;
  const shmPath = `${sqlitePath}-shm`;
  await fs.rm(walPath, { force: true });
  await fs.rm(shmPath, { force: true });

  const cli = spawnSync(
    'npx',
    [
      'tsx',
      'src/contextdb/cli.ts',
      'search',
      '--workspace',
      workspace,
      '--project',
      'rex-cli',
      '--query',
      'recover this event',
      '--limit',
      '5',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  const found = JSON.parse((cli.stdout || '{}').trim()) as { results?: Array<{ eventId: string }> };
  assert.equal(Array.isArray(found.results), true);
  assert.equal(found.results?.length, 1);
  assert.match(found.results?.[0]?.eventId ?? '', new RegExp(`^${session.sessionId}#`));

  const searchFromCore = await searchEvents({
    workspaceRoot: workspace,
    project: 'rex-cli',
    query: 'recover this event',
    limit: 5,
  });
  assert.equal(searchFromCore.results.length, 1);
});

test('searchEvents semantic mode reranks lexical candidates and falls back safely', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'semantic retrieval smoke test',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'auth issue found in login callback',
    refs: ['auth.ts'],
  });
  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'response',
    text: 'auth checklist draft for docs website',
    refs: ['docs.md'],
  });

  const previousSemantic = process.env.CONTEXTDB_SEMANTIC;
  const previousProvider = process.env.CONTEXTDB_SEMANTIC_PROVIDER;
  try {
    process.env.CONTEXTDB_SEMANTIC = '0';
    const lexicalFallback = await searchEvents({
      workspaceRoot: workspace,
      project: 'rex-cli',
      query: 'issue auth',
      kinds: ['response'],
      semantic: true,
      limit: 5,
    });
    assert.equal(lexicalFallback.results.length, 2);

    process.env.CONTEXTDB_SEMANTIC = '1';
    process.env.CONTEXTDB_SEMANTIC_PROVIDER = 'token';
    const semantic = await searchEvents({
      workspaceRoot: workspace,
      project: 'rex-cli',
      query: 'issue auth',
      kinds: ['response'],
      semantic: true,
      limit: 5,
    });
    assert.equal(semantic.results.length, 2);
    assert.match(semantic.results[0].text, /auth issue/i);
  } finally {
    if (previousSemantic === undefined) {
      delete process.env.CONTEXTDB_SEMANTIC;
    } else {
      process.env.CONTEXTDB_SEMANTIC = previousSemantic;
    }
    if (previousProvider === undefined) {
      delete process.env.CONTEXTDB_SEMANTIC_PROVIDER;
    } else {
      process.env.CONTEXTDB_SEMANTIC_PROVIDER = previousProvider;
    }
  }
});

test('searchEvents tokenized query matches punctuation-delimited terms', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'tokenized lexical retrieval',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'assistant',
    kind: 'orchestration.human-gate',
    text: 'Clarity gate requires human input: blocked checkpoints (5) reached threshold (2); auth/payment/policy boundary signals detected (3)',
  });

  const results = await searchEvents({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    query: 'blocked checkpoints threshold auth policy boundary',
    limit: 5,
  });

  assert.equal(results.results.length, 1);
  assert.match(results.results[0].text, /auth\/payment\/policy boundary/i);
});

test('searchEvents semantic mode keeps query-scoped candidates so older exact hits are not dropped', async () => {
  const workspace = await makeWorkspace();
  const session = await createSession({
    workspaceRoot: workspace,
    agent: 'codex-cli',
    project: 'rex-cli',
    goal: 'semantic candidate scope',
  });

  await appendEvent({
    workspaceRoot: workspace,
    sessionId: session.sessionId,
    role: 'user',
    kind: 'prompt',
    text: 'smoke two',
  });

  for (let i = 0; i < 40; i += 1) {
    await appendEvent({
      workspaceRoot: workspace,
      sessionId: session.sessionId,
      role: 'assistant',
      kind: 'response',
      text: `recent status update ${i}`,
    });
  }

  const previousSemantic = process.env.CONTEXTDB_SEMANTIC;
  const previousProvider = process.env.CONTEXTDB_SEMANTIC_PROVIDER;
  try {
    process.env.CONTEXTDB_SEMANTIC = '1';
    process.env.CONTEXTDB_SEMANTIC_PROVIDER = 'token';
    const semantic = await searchEvents({
      workspaceRoot: workspace,
      sessionId: session.sessionId,
      query: 'smoke two',
      semantic: true,
      limit: 5,
    });
    assert.equal(semantic.results.length > 0, true);
    assert.match(semantic.results[0].text, /^smoke two$/i);
  } finally {
    if (previousSemantic === undefined) {
      delete process.env.CONTEXTDB_SEMANTIC;
    } else {
      process.env.CONTEXTDB_SEMANTIC = previousSemantic;
    }
    if (previousProvider === undefined) {
      delete process.env.CONTEXTDB_SEMANTIC_PROVIDER;
    } else {
      process.env.CONTEXTDB_SEMANTIC_PROVIDER = previousProvider;
    }
  }
});
