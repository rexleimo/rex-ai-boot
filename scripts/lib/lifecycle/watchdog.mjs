import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_STALE_THRESHOLD_MINUTES = 30;
const MAX_SCAN_FILES = 2000;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.worktrees', 'dist', 'coverage']);

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function ageMinutesFromEpoch(epochMs, nowMs) {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;
  const ageMs = Math.max(0, nowMs - epochMs);
  return Math.floor(ageMs / 60000);
}

function buildTeamResumeCommand(sessionId, provider = 'codex', workers = 2) {
  const normalizedSessionId = normalizeText(sessionId) || '<session-id>';
  return `node scripts/aios.mjs team --resume ${normalizedSessionId} --retry-blocked --provider ${provider} --workers ${workers} --dry-run`;
}

function buildRollbackCommand(sessionId) {
  const normalizedSessionId = normalizeText(sessionId) || '<session-id>';
  return `node scripts/aios.mjs snapshot-rollback --session ${normalizedSessionId} --dry-run`;
}

export function decideWatchdogRecovery(signals = {}) {
  const staleThresholdMinutes = normalizeNumber(signals.staleThresholdMinutes, DEFAULT_STALE_THRESHOLD_MINUTES);
  const sessionId = normalizeText(signals.sessionId);
  const provider = normalizeText(signals.provider) || 'codex';
  const workers = normalizeNonNegativeInteger(signals.workers, 2) || 2;
  const normalizedSignals = {
    commitAgeMinutes: normalizeNumber(signals.commitAgeMinutes, null),
    fileActivityAgeMinutes: normalizeNumber(signals.fileActivityAgeMinutes, null),
    logAgeMinutes: normalizeNumber(signals.logAgeMinutes, null),
    cpuState: normalizeText(signals.cpuState) || 'unknown',
    blockedJobs: normalizeNonNegativeInteger(signals.blockedJobs, 0),
    rollbackArtifacts: normalizeNonNegativeInteger(signals.rollbackArtifacts, 0),
    paused: signals.paused === true,
  };

  if (normalizedSignals.paused) {
    return {
      decision: 'pause',
      reason: 'pause file is present; recovery actions are suspended',
      signals: normalizedSignals,
      nextActions: ['Remove the session .pause file to resume watchdog recovery.'],
    };
  }

  if (normalizedSignals.blockedJobs > 0 && normalizedSignals.rollbackArtifacts > 0) {
    return {
      decision: 'rollback',
      reason: 'blocked jobs have pre-mutation rollback artifacts available',
      signals: normalizedSignals,
      nextActions: [buildRollbackCommand(sessionId), buildTeamResumeCommand(sessionId, provider, workers)],
    };
  }

  if (normalizedSignals.blockedJobs > 0) {
    return {
      decision: 'retry',
      reason: 'blocked jobs detected without rollback artifacts',
      signals: normalizedSignals,
      nextActions: [buildTeamResumeCommand(sessionId, provider, workers)],
    };
  }

  const staleCommit = normalizedSignals.commitAgeMinutes === null || normalizedSignals.commitAgeMinutes >= staleThresholdMinutes;
  const staleFiles = normalizedSignals.fileActivityAgeMinutes === null || normalizedSignals.fileActivityAgeMinutes >= staleThresholdMinutes;
  const staleLogs = normalizedSignals.logAgeMinutes === null || normalizedSignals.logAgeMinutes >= staleThresholdMinutes;
  const deadProcess = normalizedSignals.cpuState === 'dead';

  if (staleCommit && staleFiles && staleLogs && deadProcess) {
    return {
      decision: 'respawn',
      reason: 'all worker activity signals are stale and the worker process is dead',
      signals: normalizedSignals,
      nextActions: [buildTeamResumeCommand(sessionId, provider, workers)],
    };
  }

  return {
    decision: 'observe',
    reason: 'worker activity signals are fresh or inconclusive',
    signals: normalizedSignals,
    nextActions: [],
  };
}

export async function collectWatchdogSignals({
  rootDir,
  sessionId = '',
  workspaceRoot = rootDir,
  nowMs = Date.now(),
  provider = 'codex',
  workers = 2,
} = {}) {
  const normalizedRootDir = path.resolve(rootDir || process.cwd());
  const normalizedSessionId = normalizeText(sessionId);
  const sessionDir = normalizedSessionId
    ? path.join(normalizedRootDir, 'memory', 'context-db', 'sessions', normalizedSessionId)
    : '';
  const artifactsDir = sessionDir ? path.join(sessionDir, 'artifacts') : '';
  const pausePath = sessionDir ? path.join(sessionDir, '.pause') : '';
  const dispatch = artifactsDir ? await readLatestDispatchArtifact(artifactsDir) : null;
  const latestWorkspaceMtime = await latestMtimeMs(path.resolve(workspaceRoot || normalizedRootDir), { maxFiles: MAX_SCAN_FILES });
  const latestLogMtime = sessionDir ? await latestMtimeMs(sessionDir, { maxFiles: MAX_SCAN_FILES }) : null;
  const rollbackArtifacts = artifactsDir ? await countRollbackManifests(artifactsDir) : 0;
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();

  return {
    sessionId: normalizedSessionId,
    provider: normalizeText(provider) || 'codex',
    workers: normalizeNonNegativeInteger(workers, 2) || 2,
    paused: pausePath ? await fileExists(pausePath) : false,
    commitAgeMinutes: readGitCommitAgeMinutes(path.resolve(workspaceRoot || normalizedRootDir), now),
    fileActivityAgeMinutes: ageMinutesFromEpoch(latestWorkspaceMtime, now),
    logAgeMinutes: ageMinutesFromEpoch(latestLogMtime, now),
    cpuState: 'unknown',
    blockedJobs: countBlockedJobs(dispatch),
    rollbackArtifacts,
  };
}

export async function buildTeamWatchdogState(options = {}, context = {}) {
  const rootDir = context.rootDir || process.cwd();
  const signals = await collectWatchdogSignals({
    rootDir,
    sessionId: options.sessionId || options.resumeSessionId,
    workspaceRoot: options.workspaceRoot || rootDir,
    nowMs: Number.isFinite(Number(context.nowMs)) ? Number(context.nowMs) : Number(context.nowFn?.() ?? Date.now()),
    provider: options.provider,
    workers: options.workers,
  });
  return {
    sessionId: signals.sessionId,
    ...decideWatchdogRecovery(signals),
  };
}

export async function runTeamWatchdog(options = {}, { rootDir, io = console, nowFn = () => Date.now() } = {}) {
  const state = await buildTeamWatchdogState(options, { rootDir, nowFn });
  if (options.json === true) {
    io.log(JSON.stringify(state, null, 2));
  } else {
    io.log(formatWatchdogText(state));
  }
  return { exitCode: state.sessionId ? 0 : 1 };
}

function formatWatchdogText(state) {
  const lines = [
    `AIOS Team Watchdog: ${state.sessionId || '(no session)'}`,
    `Decision: ${state.decision}`,
    `Reason: ${state.reason}`,
  ];
  if (Array.isArray(state.nextActions) && state.nextActions.length > 0) {
    lines.push('Next actions:');
    for (const action of state.nextActions) {
      lines.push(`- ${action}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readGitCommitAgeMinutes(workspaceRoot, nowMs) {
  try {
    const raw = execFileSync('git', ['log', '-1', '--format=%ct'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const seconds = Number.parseInt(raw, 10);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return ageMinutesFromEpoch(seconds * 1000, nowMs);
  } catch {
    return null;
  }
}

async function latestMtimeMs(rootPath, { maxFiles = MAX_SCAN_FILES } = {}) {
  let latest = null;
  let visited = 0;

  async function visit(currentPath) {
    if (visited >= maxFiles) return;
    let stat;
    try {
      stat = await fs.stat(currentPath);
    } catch {
      return;
    }
    visited += 1;
    if (latest === null || stat.mtimeMs > latest) latest = stat.mtimeMs;
    if (!stat.isDirectory()) return;
    const base = path.basename(currentPath);
    if (SKIP_DIRS.has(base)) return;
    let entries = [];
    try {
      entries = await fs.readdir(currentPath);
    } catch {
      return;
    }
    for (const entry of entries) {
      await visit(path.join(currentPath, entry));
      if (visited >= maxFiles) return;
    }
  }

  await visit(rootPath);
  return latest;
}

async function readLatestDispatchArtifact(artifactsDir) {
  let entries = [];
  try {
    entries = await fs.readdir(artifactsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const candidates = entries
    .filter((entry) => entry.isFile() && /^dispatch-run-.*\.json$/i.test(entry.name))
    .map((entry) => path.join(artifactsDir, entry.name))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf8'));
    } catch {
      continue;
    }
  }
  return null;
}

function countBlockedJobs(dispatchArtifact) {
  const jobRuns = Array.isArray(dispatchArtifact?.dispatchRun?.jobRuns)
    ? dispatchArtifact.dispatchRun.jobRuns
    : Array.isArray(dispatchArtifact?.jobRuns)
      ? dispatchArtifact.jobRuns
      : [];
  return jobRuns.filter((job) => normalizeText(job?.status).toLowerCase() === 'blocked').length;
}

async function countRollbackManifests(artifactsDir) {
  let count = 0;
  async function visit(currentPath) {
    let entries = [];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(childPath);
      } else if (entry.isFile() && entry.name === 'manifest.json' && /pre-mutation/i.test(childPath)) {
        count += 1;
      }
    }
  }
  await visit(artifactsDir);
  return count;
}
