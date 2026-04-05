import os from 'node:os';
import path from 'node:path';
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';

function hasErrorCode(error, code) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePositiveInteger(rawValue, fallbackValue) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

async function removeIfStale(lockPath, staleMs, io) {
  let stats;
  try {
    stats = await stat(lockPath);
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false;
    }
    throw error;
  }

  if ((Date.now() - stats.mtimeMs) <= staleMs) {
    return false;
  }

  await rm(lockPath, { force: true });
  io?.log?.(`[warn] removed stale sync lock: ${lockPath}`);
  return true;
}

async function tryReadLockOwner(lockPath) {
  try {
    const content = await readFile(lockPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function acquireFileLock(lockPath) {
  const handle = await open(lockPath, 'wx');
  try {
    const payload = {
      schemaVersion: 1,
      pid: process.pid,
      host: os.hostname(),
      cwd: process.cwd(),
      argv: process.argv.slice(1),
      startedAt: new Date().toISOString(),
    };
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}

export function resolveRepoLockPath(rootDir, lockName = 'native-skills-sync') {
  return path.join(rootDir, '.aios', '.locks', `${lockName}.lock`);
}

export async function withRepoLock({
  rootDir,
  lockName = 'native-skills-sync',
  timeoutMs = 45000,
  pollMs = 150,
  staleMs = 10 * 60 * 1000,
  io = console,
} = {}, task) {
  if (!rootDir) {
    throw new Error('withRepoLock requires rootDir');
  }
  if (typeof task !== 'function') {
    throw new Error('withRepoLock requires a task callback');
  }

  const lockPath = resolveRepoLockPath(rootDir, lockName);
  const waitTimeout = normalizePositiveInteger(timeoutMs, 45000);
  const waitPoll = normalizePositiveInteger(pollMs, 150);
  const staleTimeout = normalizePositiveInteger(staleMs, 10 * 60 * 1000);
  const startMs = Date.now();
  let waitingLogged = false;

  await mkdir(path.dirname(lockPath), { recursive: true });

  // Retry until lock is available, stale, or timeout is reached.
  while (true) {
    try {
      await acquireFileLock(lockPath);
      break;
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) {
        throw error;
      }

      const staleRemoved = await removeIfStale(lockPath, staleTimeout, io);
      if (staleRemoved) {
        continue;
      }

      if ((Date.now() - startMs) >= waitTimeout) {
        const owner = await tryReadLockOwner(lockPath);
        const ownerSummary = owner
          ? `pid=${String(owner.pid || '?')} host=${String(owner.host || '?')} startedAt=${String(owner.startedAt || '?')}`
          : 'owner=unknown';
        throw new Error(`[lock timeout] sync lock busy: ${path.relative(rootDir, lockPath)} (${ownerSummary})`);
      }

      if (!waitingLogged) {
        io?.log?.(`[wait] sync lock busy: ${path.relative(rootDir, lockPath)}`);
        waitingLogged = true;
      }
      await sleep(waitPoll);
    }
  }

  try {
    return await task();
  } finally {
    await rm(lockPath, { force: true });
  }
}
