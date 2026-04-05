import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildHindsightEval } from '../harness/hindsight-eval.mjs';
import { getHarnessTarget } from '../harness/targets.mjs';

export const HUD_PROVIDER_AGENT_MAP = Object.freeze({
  codex: 'codex-cli',
  claude: 'claude-code',
  gemini: 'gemini-cli',
});

const AGENT_PROVIDER_MAP = Object.freeze(
  Object.fromEntries(Object.entries(HUD_PROVIDER_AGENT_MAP).map(([provider, agent]) => [agent, provider]))
);

const DEFAULT_SESSION_SCAN_LIMIT = 200;
const DEFAULT_CHECKPOINT_TAIL_BYTES = 1_000_000;
const DISPATCH_HINDSIGHT_FIX_HINT_ACTIONS = Object.freeze({
  'ownership-policy': 'runbook.dispatch-merge-triage',
  contract: 'runbook.dispatch-merge-triage',
  timeout: 'gate.timeout-budget',
  'dependency-blocked': 'runbook.failure-triage',
  'unsupported-job': 'runbook.tool-repair',
  'runtime-error': 'runbook.tool-repair',
  default: 'runbook.failure-triage',
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function toPosixPath(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/');
}

function clipText(value, maxLen = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function normalizeProvider(raw = '') {
  const value = normalizeText(raw).toLowerCase();
  if (!value) return '';
  if (value === 'codex' || value === 'claude' || value === 'gemini') return value;
  return '';
}

function getSessionsRoot(rootDir) {
  return path.join(rootDir, 'memory', 'context-db', 'sessions');
}

async function safeReadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readTailText(filePath, maxBytes) {
  try {
    const stats = await fs.stat(filePath);
    const size = Number(stats.size) || 0;
    if (size <= 0) return '';
    const readSize = Math.min(size, maxBytes);
    const start = size - readSize;

    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, start);
      let text = buffer.toString('utf8');
      if (start > 0) {
        const newline = text.indexOf(os.EOL) >= 0 ? text.indexOf(os.EOL) : text.indexOf('\n');
        text = newline >= 0 ? text.slice(newline + 1) : '';
      }
      return text;
    } finally {
      await handle.close();
    }
  } catch {
    return '';
  }
}

async function readLastJsonLine(filePath, { maxBytes = DEFAULT_CHECKPOINT_TAIL_BYTES } = {}) {
  const tail = await readTailText(filePath, maxBytes);
  if (!tail.trim()) return null;

  const lines = tail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // ignore malformed tail rows
    }
  }

  return null;
}

function compareIsoDesc(left = '', right = '') {
  return String(right || '').localeCompare(String(left || ''));
}

export async function listContextDbSessions(rootDir, { agent = '', limit = DEFAULT_SESSION_SCAN_LIMIT } = {}) {
  const sessionsRoot = getSessionsRoot(rootDir);
  if (!existsSync(sessionsRoot)) return [];

  const requestedAgent = normalizeText(agent);
  let entries = [];
  try {
    entries = await fs.readdir(sessionsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const metas = [];
  const max = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_SESSION_SCAN_LIMIT;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sessionId = entry.name;
    const meta = await safeReadJson(path.join(sessionsRoot, sessionId, 'meta.json'));
    if (!meta || typeof meta !== 'object') continue;
    if (requestedAgent && normalizeText(meta.agent) !== requestedAgent) continue;
    const updatedAt = normalizeText(meta.updatedAt) || normalizeText(meta.createdAt);
    metas.push({
      ...meta,
      sessionId: normalizeText(meta.sessionId) || sessionId,
      updatedAt,
    });
    if (metas.length >= max * 4) {
      // Avoid unbounded scans on very large session trees.
      break;
    }
  }

  metas.sort((left, right) => compareIsoDesc(left.updatedAt, right.updatedAt));
  return metas.slice(0, max);
}

export async function selectHudSessionId({ rootDir, sessionId = '', provider = '' } = {}) {
  const explicit = normalizeText(sessionId);
  const normalizedProvider = normalizeProvider(provider);

  if (explicit) {
    return {
      sessionId: explicit,
      provider: normalizedProvider || '',
      agent: '',
      source: 'explicit',
    };
  }

  if (normalizedProvider) {
    const agent = HUD_PROVIDER_AGENT_MAP[normalizedProvider];
    const sessions = await listContextDbSessions(rootDir, { agent, limit: 1 });
    const selected = sessions[0];
    if (selected?.sessionId) {
      return {
        sessionId: selected.sessionId,
        provider: normalizedProvider,
        agent,
        source: 'provider-latest',
      };
    }
  }

  const sessions = await listContextDbSessions(rootDir, { limit: 1 });
  const selected = sessions[0];
  if (selected?.sessionId) {
    const agent = normalizeText(selected.agent);
    return {
      sessionId: selected.sessionId,
      provider: AGENT_PROVIDER_MAP[agent] || '',
      agent,
      source: 'any-latest',
    };
  }

  return {
    sessionId: '',
    provider: normalizedProvider || '',
    agent: normalizedProvider ? HUD_PROVIDER_AGENT_MAP[normalizedProvider] : '',
    source: 'none',
  };
}

async function findLatestDispatchArtifact(rootDir, sessionId) {
  const sessionDir = path.join(getSessionsRoot(rootDir), sessionId);
  const artifactsDir = path.join(sessionDir, 'artifacts');
  if (!existsSync(artifactsDir)) return null;

  let files = [];
  try {
    files = await fs.readdir(artifactsDir);
  } catch {
    return null;
  }

  const candidates = files
    .filter((name) => /^dispatch-run-.*\.json$/i.test(String(name || '').trim()))
    .sort((left, right) => String(right).localeCompare(String(left)));
  const latest = candidates[0];
  if (!latest) return null;

  const absPath = path.join(artifactsDir, latest);
  const artifact = await safeReadJson(absPath);
  if (!artifact || typeof artifact !== 'object') {
    return {
      artifactPath: toPosixPath(path.relative(rootDir, absPath)),
      persistedAt: '',
      ok: false,
      mode: '',
      jobCount: 0,
      blockedJobs: 0,
      blockedJobIds: [],
      blocked: [],
      executors: [],
      finalOutputs: 0,
      workItems: null,
      raw: null,
      parseError: 'invalid-json',
    };
  }

  const dispatchRun = artifact.dispatchRun && typeof artifact.dispatchRun === 'object'
    ? artifact.dispatchRun
    : null;
  const jobRuns = Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : [];
  const workItemTelemetryItems = Array.isArray(artifact?.workItemTelemetry?.items)
    ? artifact.workItemTelemetry.items
    : [];
  const workItemTelemetryById = new Map(
    workItemTelemetryItems
      .map((item) => [normalizeText(item?.itemId), item])
      .filter(([itemId]) => itemId)
  );
  const blocked = jobRuns
    .filter((jobRun) => normalizeText(jobRun?.status).toLowerCase() === 'blocked')
    .map((jobRun) => ({
      jobId: normalizeText(jobRun?.jobId),
      jobType: normalizeText(jobRun?.jobType) || 'unknown',
      role: normalizeText(jobRun?.role) || 'unknown',
      turnId: normalizeText(jobRun?.turnId),
      workItemRefs: Array.isArray(jobRun?.workItemRefs)
        ? jobRun.workItemRefs.map((ref) => normalizeText(ref)).filter(Boolean)
        : [],
      attempts: Number.isFinite(jobRun?.attempts) ? Math.max(0, Math.floor(jobRun.attempts)) : 0,
      failureClass: normalizeText(workItemTelemetryById.get(normalizeText(jobRun?.jobId))?.failureClass),
      retryClass: normalizeText(workItemTelemetryById.get(normalizeText(jobRun?.jobId))?.retryClass),
      error: clipText(jobRun?.output?.error || jobRun?.output?.rawOutput || ''),
    }))
    .filter((row) => row.jobId);
  const blockedJobIds = blocked.map((row) => row.jobId);

  const workItemTelemetry = artifact.workItemTelemetry && typeof artifact.workItemTelemetry === 'object'
    ? artifact.workItemTelemetry
    : null;
  const totals = workItemTelemetry?.totals && typeof workItemTelemetry.totals === 'object'
    ? workItemTelemetry.totals
    : null;
  const workItems = totals
    ? {
      total: Number.isFinite(totals.total) ? Math.max(0, Math.floor(totals.total)) : null,
      queued: Number.isFinite(totals.queued) ? Math.max(0, Math.floor(totals.queued)) : null,
      running: Number.isFinite(totals.running) ? Math.max(0, Math.floor(totals.running)) : null,
      blocked: Number.isFinite(totals.blocked) ? Math.max(0, Math.floor(totals.blocked)) : null,
      done: Number.isFinite(totals.done) ? Math.max(0, Math.floor(totals.done)) : null,
    }
    : null;

  return {
    artifactPath: toPosixPath(path.relative(rootDir, absPath)),
    persistedAt: normalizeText(artifact.persistedAt) || normalizeText(artifact.dispatchEvidence?.persistedAt) || '',
    ok: dispatchRun?.ok === true,
    mode: normalizeText(dispatchRun?.mode) || normalizeText(dispatchRun?.executionMode) || '',
    jobCount: jobRuns.length,
    blockedJobs: blocked.length,
    blockedJobIds,
    blocked,
    executors: Array.isArray(dispatchRun?.executorRegistry)
      ? dispatchRun.executorRegistry.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    finalOutputs: Array.isArray(dispatchRun?.finalOutputs) ? dispatchRun.finalOutputs.length : 0,
    workItems,
    raw: artifact,
  };
}

function inferProviderFromAgent(agent = '') {
  return AGENT_PROVIDER_MAP[normalizeText(agent)] || '';
}

async function collectRecentDispatchEvidence(rootDir, sessionId, { limit = 6 } = {}) {
  const normalizedSessionId = normalizeText(sessionId);
  if (!normalizedSessionId) return [];

  const artifactsDir = path.join(getSessionsRoot(rootDir), normalizedSessionId, 'artifacts');
  if (!existsSync(artifactsDir)) return [];

  let files = [];
  try {
    files = await fs.readdir(artifactsDir);
  } catch {
    return [];
  }

  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 6;
  const candidates = files
    .filter((name) => /^dispatch-run-.*\.json$/i.test(String(name || '').trim()))
    .sort((left, right) => String(right).localeCompare(String(left)))
    .slice(0, max);

  return candidates.map((name) => ({
    artifactPath: toPosixPath(path.join('memory', 'context-db', 'sessions', normalizedSessionId, 'artifacts', name)),
  }));
}

function formatErrorMessage(error) {
  if (!error) return '';
  if (error instanceof Error) return error.message || error.stack || String(error);
  return String(error);
}

function buildDispatchFixHint({ sessionId, dispatchHindsight, latestDispatchArtifactPath }) {
  if (!dispatchHindsight || typeof dispatchHindsight !== 'object') return null;

  const pairsAnalyzed = Number.isFinite(dispatchHindsight.pairsAnalyzed) ? Math.max(0, Math.floor(dispatchHindsight.pairsAnalyzed)) : 0;
  if (pairsAnalyzed <= 0) return null;

  const regressions = Number.isFinite(dispatchHindsight.regressions) ? Math.max(0, Math.floor(dispatchHindsight.regressions)) : 0;
  const repeatBlockedTurns = Number.isFinite(dispatchHindsight.repeatedBlockedTurns) ? Math.max(0, Math.floor(dispatchHindsight.repeatedBlockedTurns)) : 0;
  if (regressions === 0 && repeatBlockedTurns === 0) return null;

  const topRepeatedFailure = repeatBlockedTurns > 0 && Array.isArray(dispatchHindsight.topRepeatedFailureClasses)
    ? dispatchHindsight.topRepeatedFailureClasses[0]
    : null;
  const topFailureClass = normalizeText(topRepeatedFailure?.failureClass);
  const targetId = normalizeText(
    (repeatBlockedTurns > 0 && topFailureClass && DISPATCH_HINDSIGHT_FIX_HINT_ACTIONS[topFailureClass])
      ? DISPATCH_HINDSIGHT_FIX_HINT_ACTIONS[topFailureClass]
      : DISPATCH_HINDSIGHT_FIX_HINT_ACTIONS.default
  );
  if (!targetId) return null;

  const target = getHarnessTarget(targetId);
  const evidenceParts = [];
  evidenceParts.push(`pairs=${pairsAnalyzed}`);
  if (repeatBlockedTurns > 0) evidenceParts.push(`repeatBlocked=${repeatBlockedTurns}`);
  if (regressions > 0) evidenceParts.push(`regressions=${regressions}`);
  if (topFailureClass) evidenceParts.push(`topFailure=${topFailureClass}`);

  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    sessionId: normalizeText(sessionId) || null,
    targetId,
    targetType: target?.targetType || null,
    title: target?.title || targetId,
    evidence: evidenceParts.join(' '),
    nextCommand: sessionId
      ? `node scripts/aios.mjs orchestrate --session ${normalizeText(sessionId)} --dispatch local --execute dry-run --format json`
      : target?.nextCommand || null,
    nextArtifact: normalizeText(latestDispatchArtifactPath) || null,
  };
}

function buildSuggestedCommands({ sessionId, provider, latestDispatch, dispatchHindsight = null }) {
  const commands = [];
  if (!sessionId) return commands;

  commands.push(`node scripts/aios.mjs orchestrate --session ${sessionId} --dispatch local --execute dry-run`);
  commands.push(`node scripts/aios.mjs learn-eval --session ${sessionId}`);

  const regressions = Number.isFinite(dispatchHindsight?.regressions) ? Math.max(0, Math.floor(dispatchHindsight.regressions)) : 0;
  const repeatBlockedTurns = Number.isFinite(dispatchHindsight?.repeatedBlockedTurns) ? Math.max(0, Math.floor(dispatchHindsight.repeatedBlockedTurns)) : 0;
  if (regressions > 0 || repeatBlockedTurns > 0) {
    commands.push('node scripts/aios.mjs doctor');
  }

  const effectiveProvider = provider || inferProviderFromAgent(latestDispatch?.raw?.dispatchEvidence?.agent) || '';
  if (latestDispatch?.blockedJobs > 0 && (effectiveProvider === 'codex' || effectiveProvider === 'claude' || effectiveProvider === 'gemini')) {
    commands.push(
      `node scripts/aios.mjs team --resume ${sessionId} --retry-blocked --provider ${effectiveProvider} --workers 2 --dry-run`
    );
  }

  return commands;
}

export async function readHudState({ rootDir, sessionId = '', provider = '' } = {}) {
  const selection = await selectHudSessionId({ rootDir, sessionId, provider });
  const generatedAt = nowIso();

  if (!selection.sessionId) {
    return {
      schemaVersion: 1,
      generatedAt,
      selection,
      session: null,
      sessionState: null,
      latestCheckpoint: null,
      latestDispatch: null,
      suggestedCommands: [],
      warnings: ['No ContextDB sessions found in this repo.'],
    };
  }

  const sessionsRoot = getSessionsRoot(rootDir);
  const sessionDir = path.join(sessionsRoot, selection.sessionId);

  const [meta, state, checkpoint, dispatch, dispatchEvidence] = await Promise.all([
    safeReadJson(path.join(sessionDir, 'meta.json')),
    safeReadJson(path.join(sessionDir, 'state.json')),
    readLastJsonLine(path.join(sessionDir, 'l1-checkpoints.jsonl')),
    findLatestDispatchArtifact(rootDir, selection.sessionId),
    collectRecentDispatchEvidence(rootDir, selection.sessionId),
  ]);

  const agent = normalizeText(meta?.agent) || normalizeText(selection.agent);
  const providerInferred = selection.provider || inferProviderFromAgent(agent);
  const effectiveSelection = {
    ...selection,
    agent,
    provider: providerInferred,
  };

  const warnings = [];
  if (!meta) warnings.push('Session meta.json missing or unreadable.');
  if (!checkpoint) warnings.push('No checkpoints found for this session yet.');
  if (!dispatch) warnings.push('No dispatch artifact found for this session yet.');

  const latestDispatch = dispatch
    ? {
      ...dispatch,
      provider: providerInferred,
    }
    : null;

  let dispatchHindsight = null;
  try {
    dispatchHindsight = await buildHindsightEval({
      rootDir,
      meta,
      dispatchEvidence,
    });
  } catch (error) {
    warnings.push(`Dispatch hindsight eval failed: ${clipText(formatErrorMessage(error), 160)}`);
    dispatchHindsight = null;
  }

  const suggestedCommands = buildSuggestedCommands({
    sessionId: effectiveSelection.sessionId,
    provider: providerInferred,
    latestDispatch,
    dispatchHindsight,
  });
  const dispatchFixHint = buildDispatchFixHint({
    sessionId: effectiveSelection.sessionId,
    dispatchHindsight,
    latestDispatchArtifactPath: latestDispatch?.artifactPath,
  });

  return {
    schemaVersion: 1,
    generatedAt,
    selection: effectiveSelection,
    session: meta,
    sessionState: state,
    latestCheckpoint: checkpoint,
    latestDispatch,
    dispatchHindsight,
    dispatchFixHint,
    suggestedCommands,
    warnings,
  };
}

export async function readHudDispatchSummary({ rootDir, sessionId = '', provider = '', meta = null, limit = 6 } = {}) {
  const normalizedSessionId = normalizeText(sessionId || meta?.sessionId);
  const warnings = [];
  if (!normalizedSessionId) {
    return {
      schemaVersion: 1,
      generatedAt: nowIso(),
      sessionId: null,
      provider: normalizeProvider(provider) || null,
      latestDispatch: null,
      dispatchHindsight: null,
      dispatchFixHint: null,
      warnings: ['Missing sessionId for dispatch summary.'],
    };
  }

  const sessionMeta = meta && typeof meta === 'object'
    ? meta
    : await safeReadJson(path.join(getSessionsRoot(rootDir), normalizedSessionId, 'meta.json'));
  if (!sessionMeta) {
    warnings.push('Session meta.json missing or unreadable.');
  }

  const providerInferred = normalizeProvider(provider) || inferProviderFromAgent(sessionMeta?.agent || '');

  const [dispatch, dispatchEvidence] = await Promise.all([
    findLatestDispatchArtifact(rootDir, normalizedSessionId),
    collectRecentDispatchEvidence(rootDir, normalizedSessionId, { limit }),
  ]);

  const latestDispatch = dispatch
    ? {
      ...dispatch,
      provider: providerInferred,
    }
    : null;

  let dispatchHindsight = null;
  try {
    dispatchHindsight = await buildHindsightEval({
      rootDir,
      meta: sessionMeta,
      dispatchEvidence,
    });
  } catch (error) {
    warnings.push(`Dispatch hindsight eval failed: ${clipText(formatErrorMessage(error), 160)}`);
    dispatchHindsight = null;
  }

  const dispatchFixHint = buildDispatchFixHint({
    sessionId: normalizedSessionId,
    dispatchHindsight,
    latestDispatchArtifactPath: latestDispatch?.artifactPath,
  });

  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    sessionId: normalizedSessionId,
    provider: providerInferred || null,
    latestDispatch,
    dispatchHindsight,
    dispatchFixHint,
    warnings,
  };
}
