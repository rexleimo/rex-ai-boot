import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseArgs } from '../lib/cli/parse-args.mjs';
import { buildLearnEvalReport, renderLearnEvalReport } from '../lib/harness/learn-eval.mjs';
import { planLearnEval, runLearnEval } from '../lib/lifecycle/learn-eval.mjs';

async function makeRootDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'aios-learn-eval-'));
}

async function writeSession(rootDir, sessionId, metaOverrides = {}, checkpoints = []) {
  const sessionDir = path.join(rootDir, 'memory', 'context-db', 'sessions', sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const meta = {
    schemaVersion: 1,
    sessionId,
    agent: 'codex-cli',
    project: 'rex-ai-boot',
    goal: 'Ship orchestrator blueprints',
    tags: [],
    status: 'running',
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:10:00.000Z',
    ...metaOverrides,
  };

  await fs.writeFile(path.join(sessionDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(sessionDir, 'l2-events.jsonl'), '', 'utf8');
  await fs.writeFile(
    path.join(sessionDir, 'l1-checkpoints.jsonl'),
    checkpoints.map((item) => JSON.stringify(item)).join('\n') + (checkpoints.length > 0 ? '\n' : ''),
    'utf8'
  );
}

async function writeDispatchEvidence(rootDir, sessionId, {
  seq = 1,
  ts = '2026-03-09T01:06:00.000Z',
  ok = true,
  executors = ['local-phase', 'local-merge-gate'],
  blockedJobs = 0,
  finalOutputs = 2,
  artifactName = 'dispatch-run-20260309T010600Z.json',
  workItemTelemetry = null,
} = {}) {
  const artifactPath = path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', artifactName);
  const artifactAbsPath = path.join(rootDir, artifactPath);
  await fs.mkdir(path.dirname(artifactAbsPath), { recursive: true });
  await fs.writeFile(
    artifactAbsPath,
    `${JSON.stringify({
      schemaVersion: 1,
      kind: 'orchestration.dispatch-run',
      sessionId,
      persistedAt: ts,
      dispatchRun: {
        mode: 'dry-run',
        ok,
        executorRegistry: executors,
        jobRuns: [
          { jobId: 'phase.plan', status: 'simulated', output: { outputType: 'handoff' } },
          ...(blockedJobs > 0 ? [{ jobId: 'merge.final-checks', status: 'blocked', output: { outputType: 'merged-handoff' } }] : [{ jobId: 'merge.final-checks', status: 'simulated', output: { outputType: 'merged-handoff' } }]),
        ],
        finalOutputs: Array.from({ length: finalOutputs }, (_, index) => ({ jobId: `job-${index + 1}`, outputType: 'handoff' })),
      },
      ...(workItemTelemetry && typeof workItemTelemetry === 'object' ? { workItemTelemetry } : {}),
    }, null, 2)}\n`,
    'utf8'
  );

  const sessionDir = path.join(rootDir, 'memory', 'context-db', 'sessions', sessionId);
  const eventsPath = path.join(sessionDir, 'l2-events.jsonl');
  const event = {
    seq,
    ts,
    role: 'assistant',
    kind: 'orchestration.dispatch-run',
    text: `orchestrate dry-run ${ok ? 'ready' : 'blocked'} artifact=${artifactPath}`,
    refs: [artifactPath],
  };
  await fs.appendFile(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');

  return { artifactPath, eventId: `${sessionId}#${seq}` };
}

function assertRecommendationShape(item, { kind, targetType, targetId }) {
  assert.equal(item?.kind, kind);
  assert.equal(item?.targetType, targetType);
  assert.equal(item?.targetId, targetId);
  assert.equal(typeof item?.title, 'string');
  assert.equal(typeof item?.reason, 'string');
  assert.equal(typeof item?.evidence, 'string');
  assert.equal(Number.isInteger(item?.priority), true);
}

test('parseArgs accepts learn-eval options', () => {
  const result = parseArgs(['learn-eval', '--session', 'session-123', '--limit', '5', '--format', 'json']);
  assert.equal(result.command, 'learn-eval');
  assert.equal(result.options.sessionId, 'session-123');
  assert.equal(result.options.limit, 5);
  assert.equal(result.options.format, 'json');
});

test('planLearnEval emits stable preview', () => {
  const plan = planLearnEval({ sessionId: 'session-123', limit: 5, format: 'json' });
  assert.match(plan.preview, /learn-eval --session session-123 --limit 5 --format json/);
});

test('buildLearnEvalReport promotes stable workflows from telemetry', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'stable-session',
    { updatedAt: '2026-03-09T02:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T01:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 900,
          cost: { totalTokens: 100, usd: 0.1 },
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T01:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 1,
          elapsedMs: 1100,
          cost: { totalTokens: 120, usd: 0.12 },
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T01:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 1000,
          cost: { totalTokens: 140, usd: 0.14 },
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ limit: 5 }, { rootDir });
  assert.equal(report.session.sessionId, 'stable-session');
  assert.equal(report.signals.verification.passRate, 1);
  assert.equal(report.recommendations.promote.length >= 1, true);

  const blueprintPromotion = report.recommendations.promote.find((item) => item.title === 'promote workflow blueprint');
  assertRecommendationShape(blueprintPromotion, {
    kind: 'promote',
    targetType: 'blueprint',
    targetId: 'blueprint.feature',
  });
  assert.match(blueprintPromotion?.nextCommand ?? '', /orchestrate feature --task/);

  const checklistPromotion = report.recommendations.promote.find((item) => item.title === 'promote verification checklist');
  assertRecommendationShape(checklistPromotion, {
    kind: 'promote',
    targetType: 'checklist',
    targetId: 'checklist.verification-standard',
  });
  assert.match(checklistPromotion?.nextCommand ?? '', /quality-gate pre-pr/);
  assert.equal(report.recommendations.fix.length, 0);
  assert.deepEqual(
    report.recommendations.all.map((item) => item.targetId),
    ['blueprint.feature', 'checklist.verification-standard']
  );

  const rendered = renderLearnEvalReport(report);
  assert.match(rendered, /AIOS LEARN-EVAL/);
  assert.match(rendered, /blueprint\.feature/);
  assert.match(rendered, /orchestrate feature --task/);
});

test('buildLearnEvalReport routes stable security workflows to the security blueprint', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'security-stable',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId: 'security-stable', limit: 5 }, { rootDir });
  const blueprintPromotion = report.recommendations.promote.find((item) => item.title === 'promote workflow blueprint');
  assertRecommendationShape(blueprintPromotion, {
    kind: 'promote',
    targetType: 'blueprint',
    targetId: 'blueprint.security',
  });
  assert.match(blueprintPromotion?.nextCommand ?? '', /orchestrate security --task/);
});

test('buildLearnEvalReport normalizes recommendations and renders by priority order', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'needs-fix',
    { updatedAt: '2026-03-09T03:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 1',
        nextActions: ['Retry later'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate quick' },
          retryCount: 3,
          failureCategory: 'timeout',
          elapsedMs: 150000,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'running',
        summary: 'Checkpoint 2',
        nextActions: ['Retry later'],
        artifacts: [],
        telemetry: {
          verification: { result: 'unknown' },
          retryCount: 2,
          failureCategory: 'timeout',
          elapsedMs: 180000,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId: 'needs-fix', limit: 5 }, { rootDir });
  const timeoutGate = report.recommendations.fix.find((item) => item.title === 'timeout budget gate');
  assertRecommendationShape(timeoutGate, {
    kind: 'fix',
    targetType: 'gate',
    targetId: 'gate.timeout-budget',
  });
  assert.match(timeoutGate?.nextCommand ?? '', /quality-gate pre-pr/);
  assert.equal(report.recommendations.observe.some((item) => item.title === 'insufficient sample'), true);
  assert.equal(report.recommendations.fix.some((item) => item.title === 'wire real verification results'), true);
  assert.equal(report.recommendations.promote.length, 0);
  assert.equal(report.recommendations.all.every((item) => Number.isInteger(item.priority)), true);
  assert.equal(
    report.recommendations.all.every((item, index, items) => index === 0 || items[index - 1].priority >= item.priority),
    true
  );

  const rendered = renderLearnEvalReport(report);
  assert.match(rendered, /gate\.timeout-budget/);
  assert.match(rendered, /quality-gate pre-pr/);
  assert.equal(rendered.indexOf('Fix:'), rendered.lastIndexOf('Fix:'));
  assert.equal(rendered.indexOf('Observe:'), rendered.lastIndexOf('Observe:'));
  assert.equal(rendered.indexOf('Promote:'), rendered.lastIndexOf('Promote:'));
  assert.equal(rendered.indexOf('Fix:') < rendered.indexOf('Observe:'), true);
  assert.equal(rendered.indexOf('Observe:') < rendered.indexOf('Promote:'), true);
});

test('buildLearnEvalReport routes auth failures to a concrete gate target', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'auth-fix',
    { updatedAt: '2026-03-09T04:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 1',
        nextActions: ['Wait for login'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'manual auth wall' },
          retryCount: 1,
          failureCategory: 'auth',
          elapsedMs: 45000,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T03:05:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 2',
        nextActions: ['Wait for login'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'manual auth wall' },
          retryCount: 1,
          failureCategory: 'auth',
          elapsedMs: 48000,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T03:10:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 3',
        nextActions: ['Wait for login'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'manual auth wall' },
          retryCount: 1,
          failureCategory: 'auth',
          elapsedMs: 50000,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId: 'auth-fix', limit: 5 }, { rootDir });
  const authGate = report.recommendations.fix.find((item) => item.title === 'auth preflight gate');
  assertRecommendationShape(authGate, {
    kind: 'fix',
    targetType: 'gate',
    targetId: 'gate.auth-preflight',
  });
  assert.match(authGate?.nextCommand ?? '', /quality-gate pre-pr/);
});

test('buildLearnEvalReport routes tool failures to a concrete runbook target', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'tool-fix',
    { updatedAt: '2026-03-09T05:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T04:00:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 1',
        nextActions: ['Inspect tooling'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'tool crash' },
          retryCount: 4,
          failureCategory: 'tool',
          elapsedMs: 22000,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T04:05:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 2',
        nextActions: ['Inspect tooling'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'tool crash' },
          retryCount: 3,
          failureCategory: 'tool',
          elapsedMs: 24000,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T04:10:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 3',
        nextActions: ['Inspect tooling'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'tool crash' },
          retryCount: 2,
          failureCategory: 'tool',
          elapsedMs: 25000,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId: 'tool-fix', limit: 5 }, { rootDir });
  const repairRunbook = report.recommendations.fix.find((item) => item.title === 'tooling repair runbook');
  assertRecommendationShape(repairRunbook, {
    kind: 'fix',
    targetType: 'runbook',
    targetId: 'runbook.tool-repair',
  });
  assert.match(repairRunbook?.nextCommand ?? '', /node scripts\/aios\.mjs doctor/);
});

test('buildLearnEvalReport surfaces dispatch evidence signals from artifacts and events', async () => {
  const rootDir = await makeRootDir();
  const sessionId = 'dispatch-signal';
  const dispatch = await writeDispatchEvidence(rootDir, sessionId, {
    seq: 1,
    ts: '2026-03-09T01:06:00.000Z',
    ok: true,
    executors: ['local-phase', 'local-merge-gate'],
    blockedJobs: 0,
  });
  await writeSession(
    rootDir,
    sessionId,
    { updatedAt: '2026-03-09T02:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T01:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T01:06:30.000Z',
        status: 'running',
        summary: 'Recorded dry-run evidence',
        nextActions: [],
        artifacts: [dispatch.artifactPath],
        telemetry: {
          verification: { result: 'partial', evidence: `event=${dispatch.eventId}; artifact=${dispatch.artifactPath}` },
          retryCount: 0,
          elapsedMs: 50,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T01:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 1000,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId, limit: 5 }, { rootDir });
  assert.equal(report.signals.dispatch.runs, 1);
  assert.equal(report.signals.dispatch.successfulRuns, 1);
  assert.equal(report.signals.dispatch.blockedRuns, 0);
  assert.equal(report.signals.dispatch.executorUsage.some((item) => item.executor === "local-phase"), true);
  assert.equal(report.signals.dispatch.latestArtifactPath, dispatch.artifactPath);

  const observe = report.recommendations.observe.find((item) => item.targetId === 'sample.dispatch-evidence-present');
  assertRecommendationShape(observe, {
    kind: 'observe',
    targetType: 'sample',
    targetId: 'sample.dispatch-evidence-present',
  });
  assert.equal(observe?.nextArtifact, dispatch.artifactPath);

  const rendered = renderLearnEvalReport(report);
  assert.match(rendered, /dispatch runs=1 ok=1 blocked=0/);
  assert.match(rendered, /dispatch latestArtifact=/);
});

test('buildLearnEvalReport aggregates work-item blocked ratios by item type from dispatch telemetry', async () => {
  const rootDir = await makeRootDir();
  const sessionId = 'dispatch-work-items';
  const dispatch = await writeDispatchEvidence(rootDir, sessionId, {
    seq: 1,
    ts: '2026-03-09T01:06:00.000Z',
    ok: false,
    executors: ['local-phase', 'local-merge-gate'],
    blockedJobs: 2,
    workItemTelemetry: {
      schemaVersion: 1,
      generatedAt: '2026-03-09T01:06:00.000Z',
      totals: { total: 4, queued: 0, running: 0, blocked: 2, done: 2 },
      items: [
        { itemId: 'phase.plan', itemType: 'phase', role: 'planner', status: 'done', failureClass: 'none', retryClass: 'none' },
        { itemId: 'phase.implement', itemType: 'phase', role: 'implementer', status: 'blocked', failureClass: 'ownership-policy', retryClass: 'same-hypothesis' },
        { itemId: 'phase.review', itemType: 'phase', role: 'reviewer', status: 'blocked', failureClass: 'timeout', retryClass: 'none' },
        { itemId: 'merge.final-checks', itemType: 'merge-gate', role: 'merge-gate', status: 'done', failureClass: 'none', retryClass: 'none' },
      ],
    },
  });
  await writeSession(
    rootDir,
    sessionId,
    { updatedAt: '2026-03-09T02:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T01:00:00.000Z',
        status: 'blocked',
        summary: 'Dispatch blocked',
        nextActions: [],
        artifacts: [dispatch.artifactPath],
        telemetry: {
          verification: { result: 'failed', evidence: `event=${dispatch.eventId}; artifact=${dispatch.artifactPath}` },
          retryCount: 1,
          failureCategory: 'merge-gate-blocked',
          elapsedMs: 900,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId, limit: 5 }, { rootDir });
  assert.equal(report.signals.dispatch.workItems.total, 4);
  assert.equal(report.signals.dispatch.workItems.blocked, 2);
  assert.equal(report.signals.dispatch.workItems.done, 2);
  assert.equal(report.signals.dispatch.workItems.blockedRate, 0.5);
  assert.equal(report.signals.dispatch.workItems.byType.some((item) => item.itemType === 'phase' && item.total === 3 && item.blocked === 2), true);
  assert.equal(report.signals.dispatch.workItems.byType.some((item) => item.itemType === 'merge-gate' && item.total === 1 && item.blocked === 0), true);
  assert.equal(report.signals.dispatch.workItems.failureClasses.some((item) => item.failureClass === 'ownership-policy' && item.count === 1), true);
  assert.equal(report.signals.dispatch.workItems.failureClasses.some((item) => item.failureClass === 'timeout' && item.count === 1), true);
  assert.equal(report.signals.dispatch.workItems.retryClasses.some((item) => item.retryClass === 'same-hypothesis' && item.count === 1), true);

  const rendered = renderLearnEvalReport(report);
  assert.match(rendered, /dispatch workItems total=4 blocked=2 done=2 blockedRate=0\.5/);
  assert.match(rendered, /phase=2\/3\(0\.67\)/);
  assert.match(rendered, /dispatch workItemFailures .*ownership-policy=1/);
  assert.match(rendered, /dispatch workItemRetries .*same-hypothesis=1/);
});

test('buildLearnEvalReport routes blocked dispatch evidence to merge triage', async () => {
  const rootDir = await makeRootDir();
  const sessionId = 'dispatch-blocked';
  const dispatch = await writeDispatchEvidence(rootDir, sessionId, {
    seq: 1,
    ts: '2026-03-09T03:06:00.000Z',
    ok: false,
    executors: ['local-phase', 'local-merge-gate'],
    blockedJobs: 1,
  });
  await writeSession(
    rootDir,
    sessionId,
    { updatedAt: '2026-03-09T04:00:00.000Z', goal: 'Audit merge safety' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T03:06:30.000Z',
        status: 'blocked',
        summary: 'Merge gate blocked',
        nextActions: [],
        artifacts: [dispatch.artifactPath],
        telemetry: {
          verification: { result: 'failed', evidence: `event=${dispatch.eventId}; artifact=${dispatch.artifactPath}` },
          retryCount: 0,
          failureCategory: 'merge-gate-blocked',
          elapsedMs: 50,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T03:10:00.000Z',
        status: 'running',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1000,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId, limit: 5 }, { rootDir });
  assert.equal(report.signals.dispatch.runs, 1);
  assert.equal(report.signals.dispatch.blockedRuns, 1);
  assert.equal(report.signals.dispatch.blockedJobs, 1);

  const fix = report.recommendations.fix.find((item) => item.targetId === 'runbook.dispatch-merge-triage');
  assertRecommendationShape(fix, {
    kind: 'fix',
    targetType: 'runbook',
    targetId: 'runbook.dispatch-merge-triage',
  });
  assert.match(fix?.nextCommand ?? "", /--dispatch local --execute dry-run --format json/);
  assert.equal(fix?.nextArtifact, dispatch.artifactPath);

  const rendered = renderLearnEvalReport(report);
  assert.match(rendered, /runbook\.dispatch-merge-triage/);
  assert.match(rendered, /dispatch runs=1 ok=0 blocked=1/);
});
test('runLearnEval preserves json and text output modes', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'stable-json',
    { updatedAt: '2026-03-09T06:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T05:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1000,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T05:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1100,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T05:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
    ]
  );

  const jsonLogs = [];
  await runLearnEval(
    { sessionId: 'stable-json', format: 'json' },
    { rootDir, io: { log: (line) => jsonLogs.push(line) } }
  );
  const parsed = JSON.parse(jsonLogs.join('\n'));
  assert.equal(Array.isArray(parsed.recommendations.all), true);
  assertRecommendationShape(parsed.recommendations.all[0], {
    kind: 'promote',
    targetType: 'blueprint',
    targetId: 'blueprint.feature',
  });

  const textLogs = [];
  await runLearnEval(
    { sessionId: 'stable-json', format: 'text' },
    { rootDir, io: { log: (line) => textLogs.push(line) } }
  );
  const textOutput = textLogs.join('\n');
  assert.match(textOutput, /AIOS LEARN-EVAL/);
  assert.equal(textOutput.indexOf('Fix:') < textOutput.indexOf('Observe:'), true);
  assert.equal(textOutput.indexOf('Observe:') < textOutput.indexOf('Promote:'), true);
});

test('buildLearnEvalReport ignores non-dispatch verification artifacts', async () => {
  const rootDir = await makeRootDir();
  const sessionId = 'dispatch-ignore-quality-gate';
  const dispatch = await writeDispatchEvidence(rootDir, sessionId, {
    seq: 1,
    ts: '2026-03-09T01:06:00.000Z',
    ok: true,
    executors: ['local-phase', 'local-merge-gate'],
    blockedJobs: 0,
  });
  const qualityArtifactPath = path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', 'quality-gate-20260309T020000Z.json');
  const qualityArtifactAbsPath = path.join(rootDir, qualityArtifactPath);
  await fs.mkdir(path.dirname(qualityArtifactAbsPath), { recursive: true });
  await fs.writeFile(
    qualityArtifactAbsPath,
    `${JSON.stringify({ schemaVersion: 1, kind: 'verification.quality-gate', sessionId, ok: false }, null, 2)}\n`,
    'utf8'
  );

  await writeSession(
    rootDir,
    sessionId,
    { updatedAt: '2026-03-09T02:10:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T01:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T01:06:30.000Z',
        status: 'running',
        summary: 'Recorded dry-run evidence',
        nextActions: [],
        artifacts: [dispatch.artifactPath],
        telemetry: {
          verification: { result: 'partial', evidence: `event=${dispatch.eventId}; artifact=${dispatch.artifactPath}` },
          retryCount: 0,
          elapsedMs: 50,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'blocked',
        summary: 'Quality gate failed',
        nextActions: [],
        artifacts: [qualityArtifactPath],
        telemetry: {
          verification: { result: 'failed', evidence: `mode=full; profile=standard; artifact=${qualityArtifactPath}; checks=Git:FAIL` },
          retryCount: 0,
          elapsedMs: 100,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId, limit: 5 }, { rootDir });
  assert.equal(report.signals.dispatch.runs, 1);
  assert.equal(report.signals.dispatch.latestArtifactPath, dispatch.artifactPath);
});

test('buildLearnEvalReport routes quality log failures to a concrete gate target', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'quality-logs-fix',
    { updatedAt: '2026-03-09T06:00:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T05:00:00.000Z',
        status: 'blocked',
        summary: 'Quality gate failed',
        nextActions: ['Triage logs'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          failureCategory: 'quality-logs',
          elapsedMs: 100,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T05:05:00.000Z',
        status: 'blocked',
        summary: 'Quality gate failed',
        nextActions: ['Triage logs'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          failureCategory: 'quality-logs',
          elapsedMs: 120,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T05:10:00.000Z',
        status: 'blocked',
        summary: 'Quality gate failed',
        nextActions: ['Triage logs'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          failureCategory: 'quality-logs',
          elapsedMs: 140,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId: 'quality-logs-fix', limit: 5 }, { rootDir });
  const gate = report.recommendations.fix.find((item) => item.targetId === 'gate.quality-log-audit');
  assertRecommendationShape(gate, {
    kind: 'fix',
    targetType: 'gate',
    targetId: 'gate.quality-log-audit',
  });
  assert.equal(report.recommendations.fix.some((item) => item.targetId === 'gate.blocked-triage'), false);
});

test('buildLearnEvalReport routes ContextDB quality regressions to a concrete gate target', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'quality-contextdb-fix',
    { updatedAt: '2026-03-09T06:30:00.000Z' },
    [
      {
        seq: 1,
        ts: '2026-03-09T06:00:00.000Z',
        status: 'blocked',
        summary: 'Context pack regression',
        nextActions: ['Repair ContextDB pack'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          failureCategory: 'quality-contextdb',
          elapsedMs: 100,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T06:05:00.000Z',
        status: 'blocked',
        summary: 'Context pack regression',
        nextActions: ['Repair ContextDB pack'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          failureCategory: 'quality-contextdb',
          elapsedMs: 120,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T06:10:00.000Z',
        status: 'blocked',
        summary: 'Context pack regression',
        nextActions: ['Repair ContextDB pack'],
        artifacts: [],
        telemetry: {
          verification: { result: 'failed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          failureCategory: 'quality-contextdb',
          elapsedMs: 140,
        },
      },
    ]
  );

  const report = await buildLearnEvalReport({ sessionId: 'quality-contextdb-fix', limit: 5 }, { rootDir });
  const gate = report.recommendations.fix.find((item) => item.targetId === 'gate.quality-contextdb');
  assertRecommendationShape(gate, {
    kind: 'fix',
    targetType: 'gate',
    targetId: 'gate.quality-contextdb',
  });
});
