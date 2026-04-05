import { listContextDbSessions, readHudState } from '../hud/state.mjs';
import { normalizeHudPreset, renderHud } from '../hud/render.mjs';
import { watchRenderLoop } from '../hud/watch.mjs';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeCounter(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeIntervalMs(value, fallback = 1000) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(250, parsed) : fallback;
}

function normalizeProvider(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'codex' || normalized === 'claude' || normalized === 'gemini') {
    return normalized;
  }
  return 'codex';
}

export async function runTeamStatus(rawOptions = {}, { rootDir, io = console, env = process.env } = {}) {
  const sessionId = normalizeText(rawOptions.sessionId || rawOptions.resumeSessionId);
  const provider = normalizeProvider(rawOptions.provider);
  const preset = normalizeHudPreset(rawOptions.preset || 'focused');
  const watch = rawOptions.watch === true;
  const json = rawOptions.json === true;
  const intervalMs = normalizeIntervalMs(rawOptions.intervalMs, 1000);

  const renderOnce = async () => {
    const state = await readHudState({ rootDir, sessionId, provider });
    if (json) {
      io.log(JSON.stringify(state, null, 2));
      return { exitCode: state.selection?.sessionId ? 0 : 1 };
    }
    io.log(renderHud(state, { preset }));
    return { exitCode: state.selection?.sessionId ? 0 : 1 };
  };

  if (!watch || json) {
    if (watch && json) {
      io.log('[warn] team status --watch is ignored when --json is set.');
    }
    return await renderOnce();
  }

  await watchRenderLoop(async () => {
    const state = await readHudState({ rootDir, sessionId, provider });
    return renderHud(state, { preset });
  }, { intervalMs, env });

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

  return {
    total,
    dispatchBlocked,
    hindsightUnstable,
    topFailures,
    topFixHints,
    topJobs,
  };
}

export async function runTeamHistory(rawOptions = {}, { rootDir, io = console } = {}) {
  const provider = normalizeProvider(rawOptions.provider);
  const limit = Number.isFinite(rawOptions.limit) ? Math.max(1, Math.floor(rawOptions.limit)) : Number.parseInt(String(rawOptions.limit ?? '').trim(), 10);
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  const json = rawOptions.json === true;

  const agent = provider === 'claude'
    ? 'claude-code'
    : provider === 'gemini'
      ? 'gemini-cli'
      : 'codex-cli';
  const sessions = await listContextDbSessions(rootDir, { agent, limit: resolvedLimit });

  const records = [];
  for (const meta of sessions) {
    const sessionId = normalizeText(meta.sessionId);
    const state = await readHudState({ rootDir, sessionId, provider });
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
    records.push({
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
      dispatchFixHint: fixHint
        ? {
          targetId: normalizeText(fixHint.targetId) || null,
          evidence: normalizeText(fixHint.evidence) || null,
          nextCommand: normalizeText(fixHint.nextCommand) || null,
          nextArtifact: normalizeText(fixHint.nextArtifact) || null,
        }
        : null,
    });
  }

  const summary = summarizeHistory(records);
  if (json) {
    io.log(JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      provider,
      agent,
      limit: resolvedLimit,
      summary,
      records,
    }, null, 2));
    return { exitCode: 0 };
  }

  const lines = [
    `AIOS Team History (provider=${provider} agent=${agent})`,
    `Summary: sessions=${summary.total} dispatchBlocked=${summary.dispatchBlocked} hindsightUnstable=${summary.hindsightUnstable} topFailures=${summary.topFailures.map((item) => `${item.failureClass}=${item.count}`).join(', ') || 'none'} topFixHints=${summary.topFixHints.map((item) => `${item.targetId}=${item.count}`).join(', ') || 'none'} topJobs=${summary.topJobs.map((item) => `${item.jobId}=${item.count}`).join(', ') || 'none'}`,
    ...(records.length > 0 ? records.map((record) => formatHistoryLine(record)) : ['- (none)']),
  ];
  io.log(lines.join('\n') + '\n');
  return { exitCode: 0 };
}
