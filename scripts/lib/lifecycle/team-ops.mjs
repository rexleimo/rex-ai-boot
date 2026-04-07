import { listContextDbSessions, readHudDispatchSummary, readHudState } from '../hud/state.mjs';
import { normalizeHudPreset, renderHud } from '../hud/render.mjs';
import { buildWatchMeta } from '../hud/watch-meta.mjs';
import { resolveWatchCadence } from '../hud/watch-cadence.mjs';
import { createThrottledWatchRender, watchRenderLoop } from '../hud/watch.mjs';

const FAST_WATCH_DATA_REFRESH_MS = 1000;

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeCounter(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeConcurrency(value, fallback = 4) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(16, Math.max(1, Math.floor(parsed)));
}

function normalizeProvider(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'codex' || normalized === 'claude' || normalized === 'gemini') {
    return normalized;
  }
  return 'codex';
}

function normalizeQualityOutcome(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'retry-needed') return 'failed';
  if (normalized === 'success') return 'ok';
  return normalized;
}

function hasFailedQualityGate(record) {
  const qualityGate = record?.qualityGate && typeof record.qualityGate === 'object'
    ? record.qualityGate
    : null;
  return normalizeQualityOutcome(qualityGate?.outcome) === 'failed';
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const resolvedConcurrency = normalizeConcurrency(concurrency, 1);
  const results = new Array(items.length);
  let cursor = 0;

  const workerCount = Math.min(resolvedConcurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function runTeamStatus(rawOptions = {}, { rootDir, io = console, env = process.env } = {}) {
  const sessionId = normalizeText(rawOptions.sessionId || rawOptions.resumeSessionId);
  const provider = normalizeProvider(rawOptions.provider);
  const preset = normalizeHudPreset(rawOptions.preset || 'focused');
  const watch = rawOptions.watch === true;
  const fast = rawOptions.fast === true;
  const json = rawOptions.json === true;
  const watchCadence = resolveWatchCadence(rawOptions.intervalMs, { fallbackMs: 1000 });
  const intervalMs = watchCadence.renderIntervalMs;
  const fastWatchMinimal = fast && watch && !json && preset === 'minimal';
  const dataRefreshMs = fastWatchMinimal
    ? Math.max(intervalMs, FAST_WATCH_DATA_REFRESH_MS)
    : intervalMs;
  const dataRefreshLabel = watchCadence.adaptiveInterval
    ? fastWatchMinimal
      ? `auto(${dataRefreshMs}-${Math.max(dataRefreshMs, watchCadence.adaptiveInterval.maxIntervalMs)}ms)`
      : watchCadence.renderIntervalLabel
    : `${dataRefreshMs}ms`;

  const renderOnce = async () => {
    const state = await readHudState({ rootDir, sessionId, provider, fast: fastWatchMinimal });
    if (json) {
      io.log(JSON.stringify(state, null, 2));
      return { exitCode: state.selection?.sessionId ? 0 : 1 };
    }
    io.log(renderHud(state, {
      preset,
      watchMeta: watch
        ? buildWatchMeta(state, {
          renderIntervalMs: intervalMs,
          renderIntervalLabel: watchCadence.renderIntervalLabel,
          dataRefreshMs,
          dataRefreshLabel,
          fast: fastWatchMinimal,
        })
        : null,
    }));
    return { exitCode: state.selection?.sessionId ? 0 : 1 };
  };

  if (!watch || json) {
    if (watch && json) {
      io.log('[warn] team status --watch is ignored when --json is set.');
    }
    return await renderOnce();
  }

  const readAndRender = async () => {
    const state = await readHudState({ rootDir, sessionId, provider, fast: fastWatchMinimal });
    return renderHud(state, {
      preset,
      watchMeta: buildWatchMeta(state, {
        renderIntervalMs: intervalMs,
        renderIntervalLabel: watchCadence.renderIntervalLabel,
        dataRefreshMs,
        dataRefreshLabel,
        fast: fastWatchMinimal,
      }),
    });
  };

  const watchRender = fastWatchMinimal
    ? createThrottledWatchRender(readAndRender, {
      minIntervalMs: dataRefreshMs,
    })
    : readAndRender;

  await watchRenderLoop(watchRender, {
    intervalMs,
    adaptiveInterval: watchCadence.adaptiveInterval,
    env,
  });

  return { exitCode: process.exitCode ?? 0 };
}

function formatHistoryLine(record) {
  const updatedAt = normalizeText(record.updatedAt);
  const status = normalizeText(record.status);
  const sessionId = normalizeText(record.sessionId);
  const goal = normalizeText(record.goal);
  const dispatch = record.dispatch;
  const dispatchLabel = dispatch
    ? dispatch.ok === true
      ? `dispatch=ok jobs=${dispatch.jobCount}`
      : `dispatch=blocked blocked=${dispatch.blockedJobs} jobs=${dispatch.jobCount}`
    : 'dispatch=none';
  const qualityGate = record.qualityGate && typeof record.qualityGate === 'object'
    ? record.qualityGate
    : null;
  const qualityOutcome = normalizeQualityOutcome(qualityGate?.outcome);
  const qualityCategory = normalizeText(qualityGate?.failureCategory) || normalizeText(qualityGate?.categoryRef);
  const qualityLabel = qualityOutcome
    ? (qualityCategory ? `quality=${qualityOutcome}(${qualityCategory})` : `quality=${qualityOutcome}`)
    : '';
  const hindsight = record.dispatchHindsight && typeof record.dispatchHindsight === 'object'
    ? record.dispatchHindsight
    : null;
  const hindsightPairs = normalizeCounter(hindsight?.pairsAnalyzed);
  const hindsightRepeatBlocked = normalizeCounter(hindsight?.repeatedBlockedTurns);
  const hindsightRegressions = normalizeCounter(hindsight?.regressions);
  const hindsightTopFailure = normalizeText(hindsight?.topFailureClass);
  const hindsightTopJob = normalizeText(hindsight?.topRepeatedJobId);
  const hindsightLabel = hindsightPairs > 0
    ? [
      `hindsight pairs=${hindsightPairs}`,
      hindsightRepeatBlocked > 0 ? `repeatBlocked=${hindsightRepeatBlocked}` : '',
      hindsightRegressions > 0 ? `regressions=${hindsightRegressions}` : '',
      hindsightTopFailure ? `topFailure=${hindsightTopFailure}` : '',
      hindsightTopJob ? `topJob=${hindsightTopJob}` : '',
    ].filter(Boolean).join(' ')
    : '';
  const fixHint = record.dispatchFixHint && typeof record.dispatchFixHint === 'object'
    ? record.dispatchFixHint
    : null;
  const fixHintLabel = normalizeText(fixHint?.targetId) ? `fixHint=${normalizeText(fixHint.targetId)}` : '';

  const bits = [
    updatedAt ? `[${updatedAt}]` : '',
    sessionId ? `session=${sessionId}` : '',
    status ? `status=${status}` : '',
    dispatchLabel,
    qualityLabel,
    hindsightLabel,
    fixHintLabel,
    goal ? `goal="${goal.length > 80 ? goal.slice(0, 79) + '…' : goal}"` : '',
  ].filter(Boolean);
  return `- ${bits.join(' | ')}`;
}

function summarizeHistory(records = []) {
  const total = Array.isArray(records) ? records.length : 0;
  let dispatchBlocked = 0;
  let hindsightUnstable = 0;
  const topFailureCounts = new Map();
  const topQualityFailureCounts = new Map();
  const fixHintCounts = new Map();
  const topJobCounts = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    const dispatch = record?.dispatch && typeof record.dispatch === 'object' ? record.dispatch : null;
    if (dispatch && dispatch.ok === false) {
      dispatchBlocked += 1;
    }

    const hindsight = record?.dispatchHindsight && typeof record.dispatchHindsight === 'object'
      ? record.dispatchHindsight
      : null;
    const pairs = normalizeCounter(hindsight?.pairsAnalyzed);
    const repeatBlocked = normalizeCounter(hindsight?.repeatedBlockedTurns);
    const regressions = normalizeCounter(hindsight?.regressions);
    if (pairs > 0 && (repeatBlocked > 0 || regressions > 0)) {
      hindsightUnstable += 1;
    }

    const topFailure = normalizeText(hindsight?.topFailureClass);
    if (topFailure) {
      topFailureCounts.set(topFailure, (topFailureCounts.get(topFailure) || 0) + 1);
    }

    const topJob = normalizeText(hindsight?.topRepeatedJobId);
    if (topJob) {
      topJobCounts.set(topJob, (topJobCounts.get(topJob) || 0) + 1);
    }

    const fixHint = record?.dispatchFixHint && typeof record.dispatchFixHint === 'object'
      ? record.dispatchFixHint
      : null;
    const fixHintId = normalizeText(fixHint?.targetId);
    if (fixHintId) {
      fixHintCounts.set(fixHintId, (fixHintCounts.get(fixHintId) || 0) + 1);
    }

    const qualityGate = record?.qualityGate && typeof record.qualityGate === 'object'
      ? record.qualityGate
      : null;
    const qualityOutcome = normalizeQualityOutcome(qualityGate?.outcome);
    const qualityCategory = normalizeText(qualityGate?.failureCategory);
    if (qualityOutcome === 'failed' && qualityCategory) {
      topQualityFailureCounts.set(qualityCategory, (topQualityFailureCounts.get(qualityCategory) || 0) + 1);
    }
  }

  const topFailures = Array.from(topFailureCounts.entries())
    .map(([failureClass, count]) => ({ failureClass, count }))
    .sort((left, right) => right.count - left.count || left.failureClass.localeCompare(right.failureClass))
    .slice(0, 5);
  const topFixHints = Array.from(fixHintCounts.entries())
    .map(([targetId, count]) => ({ targetId, count }))
    .sort((left, right) => right.count - left.count || left.targetId.localeCompare(right.targetId))
    .slice(0, 5);
  const topJobs = Array.from(topJobCounts.entries())
    .map(([jobId, count]) => ({ jobId, count }))
    .sort((left, right) => right.count - left.count || left.jobId.localeCompare(right.jobId))
    .slice(0, 5);
  const topQualityFailures = Array.from(topQualityFailureCounts.entries())
    .map(([failureCategory, count]) => ({ failureCategory, count }))
    .sort((left, right) => right.count - left.count || left.failureCategory.localeCompare(right.failureCategory))
    .slice(0, 5);

  return {
    total,
    dispatchBlocked,
    hindsightUnstable,
    topFailures,
    topQualityFailures,
    topFixHints,
    topJobs,
  };
}

export async function runTeamHistory(rawOptions = {}, { rootDir, io = console } = {}) {
  const provider = normalizeProvider(rawOptions.provider);
  const limit = Number.isFinite(rawOptions.limit) ? Math.max(1, Math.floor(rawOptions.limit)) : Number.parseInt(String(rawOptions.limit ?? '').trim(), 10);
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  const json = rawOptions.json === true;
  const concurrency = normalizeConcurrency(rawOptions.concurrency, 4);
  const fast = rawOptions.fast === true;
  const qualityFailedOnly = rawOptions.qualityFailedOnly === true;
  const sinceIso = normalizeText(rawOptions.since);
  const statusFilter = normalizeText(rawOptions.status);

  const agent = provider === 'claude'
    ? 'claude-code'
    : provider === 'gemini'
      ? 'gemini-cli'
      : 'codex-cli';

  const scanLimit = (sinceIso || statusFilter || qualityFailedOnly)
    ? Math.max(resolvedLimit, resolvedLimit * 8)
    : resolvedLimit;
  const sessions = await listContextDbSessions(rootDir, { agent, limit: scanLimit });
  const sinceMs = sinceIso ? Date.parse(sinceIso) : NaN;

  const filteredSessions = sessions.filter((meta) => {
    if (statusFilter && normalizeText(meta?.status) !== statusFilter) return false;
    if (sinceIso) {
      const updatedAt = normalizeText(meta?.updatedAt) || normalizeText(meta?.createdAt);
      const updatedMs = updatedAt ? Date.parse(updatedAt) : NaN;
      if (!Number.isFinite(updatedMs) || !Number.isFinite(sinceMs) || updatedMs < sinceMs) return false;
    }
    return true;
  });
  const targetSessions = qualityFailedOnly
    ? filteredSessions
    : filteredSessions.slice(0, resolvedLimit);

  const records = await mapWithConcurrency(targetSessions, concurrency, async (meta) => {
    const sessionId = normalizeText(meta.sessionId);
    const state = await readHudDispatchSummary({ rootDir, sessionId, provider, meta, includeHindsight: !fast });
    const hindsight = state.dispatchHindsight && typeof state.dispatchHindsight === 'object'
      ? state.dispatchHindsight
      : null;
    const topFailure = Array.isArray(hindsight?.topRepeatedFailureClasses) && hindsight.topRepeatedFailureClasses.length > 0
      ? hindsight.topRepeatedFailureClasses[0]
      : null;
    const topJob = Array.isArray(hindsight?.topRepeatedJobs) && hindsight.topRepeatedJobs.length > 0
      ? hindsight.topRepeatedJobs[0]
      : null;
    const fixHint = state.dispatchFixHint && typeof state.dispatchFixHint === 'object'
      ? state.dispatchFixHint
      : null;
    const qualityGate = state.latestQualityGate && typeof state.latestQualityGate === 'object'
      ? state.latestQualityGate
      : null;
    return {
      sessionId,
      updatedAt: normalizeText(meta.updatedAt) || normalizeText(meta.createdAt),
      status: normalizeText(meta.status),
      goal: normalizeText(meta.goal),
      dispatch: state.latestDispatch
        ? {
          ok: state.latestDispatch.ok === true,
          jobCount: Number.isFinite(state.latestDispatch.jobCount) ? state.latestDispatch.jobCount : 0,
          blockedJobs: Number.isFinite(state.latestDispatch.blockedJobs) ? state.latestDispatch.blockedJobs : 0,
          artifactPath: normalizeText(state.latestDispatch.artifactPath),
        }
        : null,
      dispatchHindsight: hindsight
        ? {
          pairsAnalyzed: normalizeCounter(hindsight.pairsAnalyzed),
          comparedJobs: normalizeCounter(hindsight.comparedJobs),
          resolvedBlockedTurns: normalizeCounter(hindsight.resolvedBlockedTurns),
          repeatedBlockedTurns: normalizeCounter(hindsight.repeatedBlockedTurns),
          regressions: normalizeCounter(hindsight.regressions),
          topFailureClass: normalizeText(topFailure?.failureClass) || null,
          topRepeatedJobId: normalizeText(topJob?.jobId) || null,
        }
        : null,
      qualityGate: qualityGate
        ? {
          outcome: normalizeText(qualityGate.outcome) || null,
          categoryRef: normalizeText(qualityGate.categoryRef) || null,
          failureCategory: normalizeText(qualityGate.failureCategory) || null,
        }
        : null,
      dispatchFixHint: fixHint
        ? {
          targetId: normalizeText(fixHint.targetId) || null,
          evidence: normalizeText(fixHint.evidence) || null,
          nextCommand: normalizeText(fixHint.nextCommand) || null,
          nextArtifact: normalizeText(fixHint.nextArtifact) || null,
        }
        : null,
    };
  });

  const selectedRecords = qualityFailedOnly
    ? records.filter((record) => hasFailedQualityGate(record)).slice(0, resolvedLimit)
    : records;
  const summary = summarizeHistory(selectedRecords);
  if (json) {
    io.log(JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      provider,
      agent,
      limit: resolvedLimit,
      fast,
      qualityFailedOnly,
      since: sinceIso || null,
      status: statusFilter || null,
      summary,
      records: selectedRecords,
    }, null, 2));
    return { exitCode: 0 };
  }

  const lines = [
    `AIOS Team History (provider=${provider} agent=${agent})`,
    qualityFailedOnly ? 'Filter: quality-gate failed only' : '',
    `Summary: sessions=${summary.total} dispatchBlocked=${summary.dispatchBlocked} hindsightUnstable=${summary.hindsightUnstable} topFailures=${summary.topFailures.map((item) => `${item.failureClass}=${item.count}`).join(', ') || 'none'} topQualityFailures=${summary.topQualityFailures.map((item) => `${item.failureCategory}=${item.count}`).join(', ') || 'none'} topFixHints=${summary.topFixHints.map((item) => `${item.targetId}=${item.count}`).join(', ') || 'none'} topJobs=${summary.topJobs.map((item) => `${item.jobId}=${item.count}`).join(', ') || 'none'}`,
    ...(selectedRecords.length > 0 ? selectedRecords.map((record) => formatHistoryLine(record)) : ['- (none)']),
  ];
  io.log(lines.join('\n') + '\n');
  return { exitCode: 0 };
}
