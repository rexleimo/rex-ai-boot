import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { readContinuitySummary } from './continuity.mjs';

export const FACADE_FILENAME = '.facade.json';
export const DEFAULT_TTL_SECONDS = 3600;

async function overlayContinuity(workspaceRoot, facade) {
  const continuity = await readContinuitySummary({ workspaceRoot, sessionId: facade?.sessionId });
  if (!continuity) return facade;
  return {
    ...facade,
    continuitySummary: continuity.summary,
    continuityNextActions: continuity.nextActions,
    continuityUpdatedAt: continuity.updatedAt,
  };
}

export async function loadFacade(workspaceRoot) {
  const facadePath = path.join(workspaceRoot, 'memory', 'context-db', FACADE_FILENAME);
  try {
    const text = await readFile(facadePath, 'utf8');
    const facade = JSON.parse(text);
    if (!isValidFacade(facade)) {
      return { ok: false, facade: null, reason: 'invalid schema' };
    }
    const generatedAt = new Date(facade.generatedAt).getTime();
    const ttlMs = (facade.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
    if (Date.now() - generatedAt > ttlMs) {
      return { ok: false, facade: null, reason: 'expired' };
    }
    return { ok: true, facade: await overlayContinuity(workspaceRoot, facade) };
  } catch {
    return { ok: false, facade: null, reason: 'missing' };
  }
}

export async function generateFacadeFromSession(workspaceRoot, agent, project) {
  const sessionsDir = path.join(workspaceRoot, 'memory', 'context-db', 'sessions');
  let latestSessionId = '';
  let latestMtime = 0;

  try {
    const entries = await readdir(sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(sessionsDir, entry.name, 'meta.json');
      try {
        const metaText = await readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaText);
        const mtime = new Date(meta.updated_at || meta.created_at || 0).getTime();
        if (mtime > latestMtime) {
          latestMtime = mtime;
          latestSessionId = entry.name;
        }
      } catch {
        // ignore unreadable session dirs
      }
    }
  } catch {
    // no sessions dir yet
  }

  if (!latestSessionId) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      ttlSeconds: DEFAULT_TTL_SECONDS,
      sessionId: '',
      goal: `Shared context session for ${agent} on ${project}`,
      status: 'new',
      lastCheckpointSummary: 'No prior sessions',
      keyRefs: [],
      contextPacketPath: `memory/context-db/exports/latest-${agent}-context.md`,
      hasStalePack: false,
    };
  }

  const metaPath = path.join(sessionsDir, latestSessionId, 'meta.json');
  let meta = {};
  try {
    meta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    // use defaults
  }

  const continuity = await readContinuitySummary({ workspaceRoot, sessionId: latestSessionId });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    ttlSeconds: DEFAULT_TTL_SECONDS,
    sessionId: latestSessionId,
    goal: meta.goal || `Shared context session for ${agent} on ${project}`,
    status: meta.status || 'running',
    lastCheckpointSummary: meta.lastCheckpoint?.summary || '',
    keyRefs: meta.lastCheckpoint?.refs || [],
    contextPacketPath: `memory/context-db/exports/latest-${agent}-context.md`,
    hasStalePack: false,
    continuitySummary: continuity?.summary || '',
    continuityNextActions: continuity?.nextActions || [],
    continuityUpdatedAt: continuity?.updatedAt || '',
  };
}

function isValidFacade(f) {
  return (
    f &&
    typeof f === 'object' &&
    typeof f.version === 'number' &&
    typeof f.generatedAt === 'string' &&
    typeof f.sessionId === 'string' &&
    typeof f.goal === 'string'
  );
}
