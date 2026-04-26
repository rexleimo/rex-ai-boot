import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { writeFileAtomic } from '../fs/atomic-write.mjs';

const RUN_SUMMARY_FILENAME = 'run-summary.json';
const CONTROL_FILENAME = 'control.json';
const OBJECTIVE_FILENAME = 'objective.md';
const OPERATOR_NOTES_FILENAME = 'operator-notes.md';
const SOLO_HARNESS_DIRNAME = 'solo-harness';

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeStringArray(value) {
  const raw = Array.isArray(value) ? value : [];
  return Array.from(new Set(raw.map((item) => String(item ?? '').trim()).filter(Boolean)));
}

function toPosixPath(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/');
}

function formatRelativePath(rootDir, absolutePath) {
  const root = path.resolve(rootDir || process.cwd());
  const absolute = path.resolve(absolutePath || '');
  if (absolute.startsWith(root)) {
    return toPosixPath(path.relative(root, absolute));
  }
  return toPosixPath(absolute);
}

function sessionDir(rootDir, sessionId) {
  return path.join(
    path.resolve(rootDir || process.cwd()),
    'memory',
    'context-db',
    'sessions',
    normalizeText(sessionId)
  );
}

function soloHarnessDir(rootDir, sessionId) {
  return path.join(sessionDir(rootDir, sessionId), 'artifacts', SOLO_HARNESS_DIRNAME);
}

function iterationFileName(iteration) {
  const value = Number.isFinite(iteration) ? Math.max(1, Math.floor(iteration)) : 1;
  return `iteration-${String(value).padStart(4, '0')}.json`;
}

function iterationLogFileName(iteration) {
  const value = Number.isFinite(iteration) ? Math.max(1, Math.floor(iteration)) : 1;
  return `iteration-${String(value).padStart(4, '0')}.log.jsonl`;
}

function defaultBackoff() {
  return {
    consecutiveInfraFailures: 0,
    nextDelayMs: 0,
    until: null,
  };
}

function defaultWorktreeState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    enabled: source.enabled === true,
    baseRef: normalizeText(source.baseRef, 'HEAD'),
    path: normalizeText(source.path),
    workspacePath: normalizeText(source.workspacePath),
    initialHead: normalizeText(source.initialHead),
    preserved: source.preserved === true,
    cleanupReason: normalizeText(source.cleanupReason),
  };
}

function defaultControl(sessionId, overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'solo-harness.control',
    sessionId: normalizeText(sessionId),
    stopRequested: overrides.stopRequested === true,
    reason: normalizeText(overrides.reason),
    requestedAt: overrides.stopRequested === true
      ? normalizeText(overrides.requestedAt, new Date().toISOString())
      : null,
    updatedAt: normalizeText(overrides.updatedAt, new Date().toISOString()),
  };
}

function normalizeRunSummary(input = {}) {
  const sessionId = normalizeText(input.sessionId);
  if (!sessionId) {
    throw new Error('solo run summary requires sessionId');
  }

  return {
    schemaVersion: 1,
    kind: 'solo-harness.run-summary',
    sessionId,
    objective: normalizeText(input.objective),
    status: normalizeText(input.status, 'running'),
    provider: normalizeText(input.provider, 'codex'),
    clientId: normalizeText(input.clientId, 'codex-cli'),
    profile: normalizeText(input.profile, 'standard'),
    iterationCount: Number.isFinite(input.iterationCount) ? Math.max(0, Math.floor(input.iterationCount)) : 0,
    lastIteration: Number.isFinite(input.lastIteration) ? Math.max(0, Math.floor(input.lastIteration)) : 0,
    lastOutcome: normalizeText(input.lastOutcome),
    lastFailureClass: normalizeText(input.lastFailureClass, 'none'),
    stopRequested: input.stopRequested === true,
    backoff: {
      ...defaultBackoff(),
      ...(input.backoff && typeof input.backoff === 'object' ? input.backoff : {}),
    },
    worktree: defaultWorktreeState(input.worktree),
    continuity: {
      markdownPath: normalizeText(input.continuity?.markdownPath),
      jsonPath: normalizeText(input.continuity?.jsonPath),
    },
    createdAt: normalizeText(input.createdAt, new Date().toISOString()),
    updatedAt: normalizeText(input.updatedAt, new Date().toISOString()),
  };
}

function normalizeIterationOutcome(input = {}) {
  const sessionId = normalizeText(input.sessionId);
  if (!sessionId) {
    throw new Error('solo iteration outcome requires sessionId');
  }

  const iteration = Number.isFinite(input.iteration) ? Math.max(1, Math.floor(input.iteration)) : 1;
  return {
    schemaVersion: 1,
    kind: 'solo-harness.iteration',
    sessionId,
    iteration,
    outcome: normalizeText(input.outcome, 'failed'),
    summary: normalizeText(input.summary, 'No summary recorded.'),
    keyChanges: normalizeStringArray(input.keyChanges),
    keyLearnings: normalizeStringArray(input.keyLearnings),
    nextAction: normalizeText(input.nextAction),
    shouldStop: input.shouldStop === true,
    failureClass: normalizeText(input.failureClass, 'none'),
    backoffAction: normalizeText(input.backoffAction, 'none'),
    checkpointStatus: normalizeText(input.checkpointStatus, 'running'),
    createdAt: normalizeText(input.createdAt, new Date().toISOString()),
  };
}

async function safeReadJson(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function renderObjectiveMarkdown({ objective = '', provider = '', profile = '' } = {}) {
  return [
    '# Solo Harness Objective',
    '',
    `- Objective: ${normalizeText(objective) || '(empty)'}`,
    `- Provider: ${normalizeText(provider) || '(unknown)'}`,
    `- Profile: ${normalizeText(profile) || '(unknown)'}`,
    '',
  ].join('\n');
}

export function getSoloHarnessPaths({ rootDir, sessionId } = {}) {
  const dir = soloHarnessDir(rootDir, sessionId);
  const iterationDir = dir;
  return {
    dir,
    objectivePath: path.join(dir, OBJECTIVE_FILENAME),
    operatorNotesPath: path.join(dir, OPERATOR_NOTES_FILENAME),
    summaryPath: path.join(dir, RUN_SUMMARY_FILENAME),
    controlPath: path.join(dir, CONTROL_FILENAME),
    iterationDir,
  };
}

export async function writeSoloRunSummary(input = {}) {
  const summary = normalizeRunSummary(input);
  const paths = getSoloHarnessPaths(input);
  await writeFileAtomic(paths.summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return {
    ...summary,
    summaryPath: paths.summaryPath,
  };
}

export async function readSoloRunSummary({ rootDir, sessionId } = {}) {
  const normalizedSessionId = normalizeText(sessionId);
  if (!normalizedSessionId) return null;
  const paths = getSoloHarnessPaths({ rootDir, sessionId: normalizedSessionId });
  const raw = await safeReadJson(paths.summaryPath);
  return raw ? normalizeRunSummary(raw) : null;
}

export async function writeSoloControl(input = {}) {
  const sessionId = normalizeText(input.sessionId);
  if (!sessionId) {
    throw new Error('solo control requires sessionId');
  }
  const control = defaultControl(sessionId, input);
  const paths = getSoloHarnessPaths(input);
  await writeFileAtomic(paths.controlPath, `${JSON.stringify(control, null, 2)}\n`);
  return {
    ...control,
    controlPath: paths.controlPath,
  };
}

export async function readSoloControl({ rootDir, sessionId } = {}) {
  const normalizedSessionId = normalizeText(sessionId);
  if (!normalizedSessionId) return null;
  const paths = getSoloHarnessPaths({ rootDir, sessionId: normalizedSessionId });
  const raw = await safeReadJson(paths.controlPath);
  return raw ? defaultControl(normalizedSessionId, raw) : defaultControl(normalizedSessionId);
}

export async function initSoloRunJournal(input = {}) {
  const sessionId = normalizeText(input.sessionId);
  if (!sessionId) {
    throw new Error('solo run journal requires sessionId');
  }
  const paths = getSoloHarnessPaths(input);
  await mkdir(paths.dir, { recursive: true });

  const existingSummary = await readSoloRunSummary(input);
  const summary = await writeSoloRunSummary({
    rootDir: input.rootDir,
    ...(existingSummary || {}),
    sessionId,
    objective: normalizeText(input.objective, existingSummary?.objective || ''),
    provider: normalizeText(input.provider, existingSummary?.provider || 'codex'),
    clientId: normalizeText(input.clientId, existingSummary?.clientId || 'codex-cli'),
    profile: normalizeText(input.profile, existingSummary?.profile || 'standard'),
    status: normalizeText(existingSummary?.status, 'running'),
    stopRequested: existingSummary?.stopRequested === true,
    worktree: {
      ...(existingSummary?.worktree || defaultWorktreeState(input.worktree)),
      ...defaultWorktreeState(input.worktree),
    },
    continuity: {
      markdownPath: formatRelativePath(input.rootDir, path.join(sessionDir(input.rootDir, sessionId), 'continuity-summary.md')),
      jsonPath: formatRelativePath(input.rootDir, path.join(sessionDir(input.rootDir, sessionId), 'continuity.json')),
    },
    createdAt: normalizeText(existingSummary?.createdAt, new Date().toISOString()),
    updatedAt: new Date().toISOString(),
  });

  const existingControl = await readSoloControl(input);
  const control = await writeSoloControl({
    rootDir: input.rootDir,
    ...(existingControl || {}),
    sessionId,
    stopRequested: existingControl?.stopRequested === true,
    reason: existingControl?.reason || '',
    requestedAt: existingControl?.requestedAt || null,
    updatedAt: new Date().toISOString(),
  });

  await writeFileAtomic(
    paths.objectivePath,
    `${renderObjectiveMarkdown({
      objective: summary.objective,
      provider: summary.provider,
      profile: summary.profile,
    })}\n`
  );
  try {
    await readFile(paths.operatorNotesPath, 'utf8');
  } catch {
    await writeFileAtomic(paths.operatorNotesPath, '');
  }

  return {
    sessionId,
    dir: paths.dir,
    summaryPath: paths.summaryPath,
    controlPath: paths.controlPath,
    objectivePath: paths.objectivePath,
    operatorNotesPath: paths.operatorNotesPath,
    summary,
    control,
  };
}

export async function appendSoloIteration({ rootDir, sessionId, iteration, outcome, logEntries = [] } = {}) {
  const normalizedOutcome = normalizeIterationOutcome({ ...outcome, sessionId, iteration });
  const paths = getSoloHarnessPaths({ rootDir, sessionId });
  await mkdir(paths.iterationDir, { recursive: true });

  const iterationPath = path.join(paths.iterationDir, iterationFileName(normalizedOutcome.iteration));
  const logPath = path.join(paths.iterationDir, iterationLogFileName(normalizedOutcome.iteration));
  await writeFileAtomic(iterationPath, `${JSON.stringify(normalizedOutcome, null, 2)}\n`);

  if (Array.isArray(logEntries) && logEntries.length > 0) {
    await appendFile(
      logPath,
      `${logEntries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
      'utf8'
    );
  } else {
    await writeFile(logPath, '', { encoding: 'utf8' });
  }

  const existingSummary = await readSoloRunSummary({ rootDir, sessionId });
  if (existingSummary) {
    await writeSoloRunSummary({
      rootDir,
      ...existingSummary,
      iterationCount: Math.max(existingSummary.iterationCount, normalizedOutcome.iteration),
      lastIteration: normalizedOutcome.iteration,
      lastOutcome: normalizedOutcome.outcome,
      lastFailureClass: normalizedOutcome.failureClass,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    outcome: normalizedOutcome,
    iterationPath,
    logPath,
  };
}

export async function requestSoloHarnessStop({ rootDir, sessionId, reason = 'operator-request' } = {}) {
  return await writeSoloControl({
    rootDir,
    sessionId,
    stopRequested: true,
    reason,
    requestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function clearSoloHarnessStop({ rootDir, sessionId } = {}) {
  return await writeSoloControl({
    rootDir,
    sessionId,
    stopRequested: false,
    reason: '',
    requestedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function readSoloRunStatus({ rootDir, sessionId } = {}) {
  const summary = await readSoloRunSummary({ rootDir, sessionId });
  if (!summary) return null;

  const control = await readSoloControl({ rootDir, sessionId });
  return {
    sessionId: summary.sessionId,
    objective: summary.objective,
    status: summary.status,
    provider: summary.provider,
    profile: summary.profile,
    iterationCount: summary.iterationCount,
    lastIteration: summary.lastIteration,
    lastOutcome: summary.lastOutcome,
    lastFailureClass: summary.lastFailureClass,
    nextDelayMs: Number.isFinite(summary.backoff?.nextDelayMs) ? summary.backoff.nextDelayMs : 0,
    stopRequested: control?.stopRequested === true || summary.stopRequested === true,
    worktree: defaultWorktreeState(summary.worktree),
    continuitySummaryPath: normalizeText(summary.continuity?.markdownPath),
    continuityJsonPath: normalizeText(summary.continuity?.jsonPath),
    updatedAt: summary.updatedAt,
  };
}
