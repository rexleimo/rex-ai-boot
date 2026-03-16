import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runContextDbCli } from '../contextdb-cli.mjs';
import { withWorkItemArtifactRef } from './work-item-telemetry.mjs';

export const ORCHESTRATION_DISPATCH_EVENT_KIND = 'orchestration.dispatch-run';

function formatArtifactTimestamp(ts = new Date()) {
  return ts.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildArtifactPath(sessionId, stamp) {
  return path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', `dispatch-run-${stamp}.json`);
}

function normalizeDispatchMode(dispatchRun = {}) {
  const mode = String(dispatchRun?.mode || '').trim();
  return mode || 'dry-run';
}

function normalizeDispatchCost(raw = {}) {
  const inputTokens = Number.isFinite(raw?.inputTokens) ? Math.max(0, Math.floor(raw.inputTokens)) : 0;
  const outputTokens = Number.isFinite(raw?.outputTokens) ? Math.max(0, Math.floor(raw.outputTokens)) : 0;
  let totalTokens = Number.isFinite(raw?.totalTokens) ? Math.max(0, Math.floor(raw.totalTokens)) : 0;
  const usd = Number.isFinite(raw?.usd) ? Math.max(0, Number(raw.usd)) : 0;
  if (totalTokens === 0 && (inputTokens > 0 || outputTokens > 0)) {
    totalTokens = inputTokens + outputTokens;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    usd: Number(usd.toFixed(4)),
  };
}

function hasDispatchCost(raw = {}) {
  const cost = normalizeDispatchCost(raw);
  return cost.inputTokens > 0 || cost.outputTokens > 0 || cost.totalTokens > 0 || cost.usd > 0;
}

function formatDispatchCostForEvent(raw = {}) {
  const cost = normalizeDispatchCost(raw);
  const parts = [];
  if (cost.totalTokens > 0) parts.push(`tokens=${cost.totalTokens}`);
  if (cost.usd > 0) parts.push(`usd=${cost.usd}`);
  return parts.join(' ');
}

function buildDispatchHeadline(report) {
  const dispatchRun = report.dispatchRun || { ok: false, jobRuns: [], executorRegistry: [] };
  const mode = normalizeDispatchMode(dispatchRun);
  const blockedCount = dispatchRun.jobRuns.filter((jobRun) => jobRun.status === 'blocked').length;
  const executorSummary = dispatchRun.executorRegistry.length > 0
    ? dispatchRun.executorRegistry.join(',')
    : 'none';

  return dispatchRun.ok
    ? `orchestrate ${mode} ready: blueprint=${report.blueprint} jobs=${dispatchRun.jobRuns.length} executors=${executorSummary}`
    : `orchestrate ${mode} blocked: blueprint=${report.blueprint} jobs=${dispatchRun.jobRuns.length} blocked=${blockedCount} executors=${executorSummary}`;
}

function buildEventText(report, artifactPath) {
  const dispatchRun = report.dispatchRun || { ok: false, jobRuns: [] };
  const finalOutputs = Array.isArray(dispatchRun.finalOutputs) ? dispatchRun.finalOutputs.length : 0;
  const parts = [
    buildDispatchHeadline(report),
    `task=${report.taskTitle}`,
    `artifact=${artifactPath}`,
    `finalOutputs=${finalOutputs}`,
  ];
  if (hasDispatchCost(dispatchRun.cost)) {
    parts.push(`cost=${formatDispatchCostForEvent(dispatchRun.cost)}`);
  }
  return parts.join(' | ');
}

function buildCheckpointSummary(report) {
  const dispatchRun = report.dispatchRun || { ok: false, jobRuns: [] };
  const mode = normalizeDispatchMode(dispatchRun);
  const blockedCount = dispatchRun.jobRuns.filter((jobRun) => jobRun.status === 'blocked').length;
  const statusLabel = dispatchRun.ok ? 'ready' : 'blocked';
  return `Recorded orchestrate ${mode} ${statusLabel} for ${report.taskTitle}; jobs=${dispatchRun.jobRuns.length}; blocked=${blockedCount}.`;
}

function buildNextActions(report, artifactPath) {
  const dispatchRun = report.dispatchRun || { ok: false };
  const mode = normalizeDispatchMode(dispatchRun);
  if (dispatchRun.ok) {
    if (mode === 'live') {
      return [
        `Review live-dispatch artifact ${artifactPath}`,
        'Run learn-eval to inspect cost/token telemetry trends',
      ];
    }
    return [
      `Review dry-run artifact ${artifactPath}`,
      'Attach a real executor runtime when available',
    ];
  }

  return [
    `Inspect blocked handoffs in ${artifactPath}`,
    'Resolve merge-gate conflicts before rerunning orchestration',
  ];
}

async function writeArtifact(absPath, payload) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function persistDispatchEvidence({ rootDir, sessionId, report, elapsedMs } = {}) {
  if (!report?.dispatchRun) {
    return { persisted: false, reason: 'dispatch-run-missing' };
  }

  const mode = normalizeDispatchMode(report.dispatchRun);
  if (mode !== 'dry-run' && mode !== 'live') {
    return { persisted: false, reason: 'mode-unsupported', mode };
  }
  if (mode === 'live' && (!Array.isArray(report.dispatchRun.jobRuns) || report.dispatchRun.jobRuns.length === 0)) {
    return { persisted: false, reason: 'mode-unsupported', mode };
  }

  if (!sessionId) {
    return { persisted: false, reason: 'session-required', mode: 'contextdb' };
  }

  const stamp = formatArtifactTimestamp();
  const artifactPath = buildArtifactPath(sessionId, stamp);
  const artifactAbsPath = path.join(rootDir, artifactPath);
  const artifactPayload = {
    schemaVersion: 1,
    kind: ORCHESTRATION_DISPATCH_EVENT_KIND,
    sessionId,
    persistedAt: new Date().toISOString(),
    blueprint: report.blueprint,
    taskTitle: report.taskTitle,
    contextSummary: report.contextSummary,
    workItems: Array.isArray(report.workItems) ? report.workItems.map((item) => ({ ...item })) : [],
    learnEvalOverlay: report.learnEvalOverlay || null,
    dispatchPlan: report.dispatchPlan || null,
    dispatchRun: report.dispatchRun || null,
    workItemTelemetry: withWorkItemArtifactRef(report.workItemTelemetry || null, artifactPath),
  };

  await writeArtifact(artifactAbsPath, artifactPayload);

  try {
    const dispatchCost = normalizeDispatchCost(report.dispatchRun.cost);
    const event = runContextDbCli([
      'event:add',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--role',
      'assistant',
      '--kind',
      ORCHESTRATION_DISPATCH_EVENT_KIND,
      '--text',
      buildEventText(report, artifactPath),
      '--refs',
      artifactPath,
    ]);
    const eventId = `${sessionId}#${event.seq}`;

    const checkpointStatus = report.dispatchRun.ok ? 'running' : 'blocked';
    const checkpointArgs = [
      'checkpoint',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--summary',
      buildCheckpointSummary(report),
      '--status',
      checkpointStatus,
      '--artifacts',
      artifactPath,
      '--next',
      buildNextActions(report, artifactPath).join('|'),
      '--verify-result',
      report.dispatchRun.ok ? 'partial' : 'failed',
      '--verify-evidence',
      `event=${eventId}; artifact=${artifactPath}`,
      '--retry-count',
      '0',
      '--elapsed-ms',
      String(Math.max(0, Math.floor(elapsedMs || 0))),
      '--cost-input-tokens',
      String(dispatchCost.inputTokens),
      '--cost-output-tokens',
      String(dispatchCost.outputTokens),
      '--cost-total-tokens',
      String(dispatchCost.totalTokens),
      '--cost-usd',
      String(dispatchCost.usd),
    ];

    if (!report.dispatchRun.ok) {
      checkpointArgs.push('--failure-category', mode === 'live' ? 'dispatch-runtime-blocked' : 'merge-gate-blocked');
    }

    const checkpoint = runContextDbCli(checkpointArgs);
    const checkpointId = `${sessionId}#C${checkpoint.seq}`;
    const evidence = {
      persisted: true,
      mode: 'contextdb',
      artifactPath,
      eventKind: ORCHESTRATION_DISPATCH_EVENT_KIND,
      eventId,
      checkpointId,
      checkpointStatus,
    };

    await writeArtifact(artifactAbsPath, {
      ...artifactPayload,
      dispatchEvidence: evidence,
    });

    return evidence;
  } catch (error) {
    return {
      persisted: false,
      mode: 'contextdb',
      artifactPath,
      eventKind: ORCHESTRATION_DISPATCH_EVENT_KIND,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
