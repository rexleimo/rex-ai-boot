import { listContextDbSessions, readHudState } from '../hud/state.mjs';
import { normalizeHudPreset, renderHud } from '../hud/render.mjs';
import { watchRenderLoop } from '../hud/watch.mjs';

function normalizeText(value) {
  return String(value ?? '').trim();
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

  const bits = [
    updatedAt ? `[${updatedAt}]` : '',
    sessionId ? `session=${sessionId}` : '',
    status ? `status=${status}` : '',
    dispatchLabel,
    goal ? `goal="${goal.length > 80 ? goal.slice(0, 79) + '…' : goal}"` : '',
  ].filter(Boolean);
  return `- ${bits.join(' | ')}`;
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
    });
  }

  if (json) {
    io.log(JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      provider,
      agent,
      limit: resolvedLimit,
      records,
    }, null, 2));
    return { exitCode: 0 };
  }

  const lines = [
    `AIOS Team History (provider=${provider} agent=${agent})`,
    ...(records.length > 0 ? records.map((record) => formatHistoryLine(record)) : ['- (none)']),
  ];
  io.log(lines.join('\n') + '\n');
  return { exitCode: 0 };
}

