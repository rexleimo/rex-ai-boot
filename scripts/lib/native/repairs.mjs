import crypto from 'node:crypto';
import path from 'node:path';
import { cp, copyFile, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

import { buildNativeOutputPlan, loadNativeSyncManifest, resolveNativeClients } from './source-tree.mjs';

const REPAIRS_ROOT_REL = path.join('.aios', 'repairs');
const REPAIR_KIND = 'native-repair';
const MANIFEST_FILE = 'manifest.json';

function normalizeRelativePath(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    throw new Error('repair path cannot be empty');
  }
  if (path.isAbsolute(raw)) {
    throw new Error(`repair path must be relative: ${raw}`);
  }
  const normalized = raw.split(path.sep).join('/');
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`repair path escapes workspace: ${raw}`);
  }
  return normalized;
}

function formatRepairId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const random = crypto.randomBytes(3).toString('hex');
  return `${stamp}-${random}`;
}

function hashBuffer(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function toAbsolute(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

async function readState(absPath) {
  try {
    const details = await lstat(absPath);
    if (details.isDirectory()) {
      return { exists: true, type: 'dir' };
    }
    return { exists: true, type: 'file' };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { exists: false, type: 'missing' };
    }
    throw error;
  }
}

async function copyToBackup(sourceAbsPath, backupAbsPath, type) {
  if (type === 'dir') {
    await cp(sourceAbsPath, backupAbsPath, { recursive: true, force: true, errorOnExist: false });
    return;
  }
  await mkdir(path.dirname(backupAbsPath), { recursive: true });
  await copyFile(sourceAbsPath, backupAbsPath);
}

async function snapshotPath(rootDir, relativePath, output) {
  const normalized = normalizeRelativePath(relativePath);
  const absPath = toAbsolute(rootDir, normalized);

  let details;
  try {
    details = await stat(absPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  if (details.isDirectory()) {
    output.set(normalized, { type: 'dir' });
    const entries = await readdir(absPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      await snapshotPath(rootDir, path.join(normalized, entry.name), output);
    }
    return;
  }

  const buffer = await readFile(absPath);
  output.set(normalized, {
    type: 'file',
    hash: hashBuffer(buffer),
    sizeBytes: buffer.length,
  });
}

async function snapshotTargets(rootDir, targets = []) {
  const snapshot = new Map();
  for (const target of targets) {
    await snapshotPath(rootDir, target, snapshot);
  }
  return snapshot;
}

function diffSnapshots(before, after) {
  const allKeys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const entries = [];

  for (const key of allKeys) {
    const previous = before.get(key);
    const next = after.get(key);
    if (!previous && next) {
      entries.push({ path: key, change: 'added' });
      continue;
    }
    if (previous && !next) {
      entries.push({ path: key, change: 'removed' });
      continue;
    }
    if (!previous || !next) {
      continue;
    }
    if (previous.type !== next.type) {
      entries.push({ path: key, change: 'updated' });
      continue;
    }
    if (previous.type === 'file' && previous.hash !== next.hash) {
      entries.push({ path: key, change: 'updated' });
    }
  }

  return {
    entries,
    summary: {
      totalChanged: entries.length,
      added: entries.filter((item) => item.change === 'added').length,
      updated: entries.filter((item) => item.change === 'updated').length,
      removed: entries.filter((item) => item.change === 'removed').length,
    },
  };
}

function buildManagedTargetsForClients({ rootDir, clients }) {
  const manifest = loadNativeSyncManifest(rootDir);
  const selectedClients = resolveNativeClients('all')
    .filter((clientName) => clients.includes(clientName));
  const targets = new Set();

  for (const clientName of selectedClients) {
    const plan = buildNativeOutputPlan({ rootDir, manifest, client: clientName });
    for (const output of plan.outputs) {
      targets.add(normalizeRelativePath(output));
    }
    const metadataRelative = normalizeRelativePath(path.relative(rootDir, plan.metadataPath));
    targets.add(metadataRelative);
  }

  return [...targets].sort();
}

async function writeManifest(manifestAbsPath, payload) {
  await mkdir(path.dirname(manifestAbsPath), { recursive: true });
  await writeFile(manifestAbsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function createNativeRepairSession({
  rootDir,
  clients = [],
  reason = 'doctor-native-fix',
  dryRun = false,
} = {}) {
  if (!rootDir) {
    throw new Error('createNativeRepairSession requires rootDir');
  }

  const selectedClients = Array.isArray(clients)
    ? [...new Set(clients.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
    : [];
  if (selectedClients.length === 0) {
    throw new Error('createNativeRepairSession requires at least one client');
  }

  const targets = buildManagedTargetsForClients({ rootDir, clients: selectedClients });
  const repairId = formatRepairId();
  const repairDirRel = path.join(REPAIRS_ROOT_REL, repairId).split(path.sep).join('/');
  const repairDirAbs = toAbsolute(rootDir, repairDirRel);
  const backupDirAbs = path.join(repairDirAbs, 'backup');
  const manifestRelPath = path.join(repairDirRel, MANIFEST_FILE).split(path.sep).join('/');
  const manifestAbsPath = toAbsolute(rootDir, manifestRelPath);
  const createdAt = new Date().toISOString();
  const beforeSnapshot = await snapshotTargets(rootDir, targets);
  const targetsState = [];

  if (!dryRun) {
    await mkdir(backupDirAbs, { recursive: true });
  }

  for (const target of targets) {
    const absTargetPath = toAbsolute(rootDir, target);
    const state = await readState(absTargetPath);
    targetsState.push({
      path: target,
      existed: state.exists,
      type: state.type,
    });
    if (!dryRun && state.exists) {
      const backupTargetPath = path.join(backupDirAbs, target);
      await copyToBackup(absTargetPath, backupTargetPath, state.type);
    }
  }

  const manifest = {
    schemaVersion: 1,
    kind: REPAIR_KIND,
    repairId,
    createdAt,
    completedAt: '',
    status: 'running',
    reason: String(reason || 'doctor-native-fix'),
    dryRun: Boolean(dryRun),
    clients: selectedClients,
    targets: targetsState,
    summary: {
      totalChanged: 0,
      added: 0,
      updated: 0,
      removed: 0,
    },
    changedEntries: [],
    rollbackHistory: [],
  };

  await writeManifest(manifestAbsPath, manifest);

  return {
    repairId,
    repairDirRel,
    manifestRelPath,
    manifestAbsPath,
    targets,
    beforeSnapshot,
    dryRun: Boolean(dryRun),
  };
}

export async function finalizeNativeRepairSession({
  rootDir,
  session,
  status = 'completed',
  errorMessage = '',
} = {}) {
  if (!rootDir) {
    throw new Error('finalizeNativeRepairSession requires rootDir');
  }
  if (!session || typeof session !== 'object') {
    throw new Error('finalizeNativeRepairSession requires session');
  }

  const afterSnapshot = await snapshotTargets(rootDir, session.targets || []);
  const { entries, summary } = diffSnapshots(session.beforeSnapshot || new Map(), afterSnapshot);
  const payload = JSON.parse(await readFile(session.manifestAbsPath, 'utf8'));
  payload.completedAt = new Date().toISOString();
  payload.status = String(status || 'completed');
  payload.errorMessage = String(errorMessage || '');
  payload.summary = summary;
  payload.changedEntries = entries;

  await writeManifest(session.manifestAbsPath, payload);

  return {
    repairId: session.repairId,
    manifestRelPath: session.manifestRelPath,
    summary,
    changedEntries: entries,
  };
}

async function resolveRepairManifest(rootDir, repairId = 'latest') {
  const requested = String(repairId || 'latest').trim() || 'latest';
  const repairsRootAbs = path.join(rootDir, REPAIRS_ROOT_REL);

  if (requested !== 'latest') {
    const manifestRelPath = path.join(REPAIRS_ROOT_REL, requested, MANIFEST_FILE).split(path.sep).join('/');
    const manifestAbsPath = toAbsolute(rootDir, manifestRelPath);
    const payload = JSON.parse(await readFile(manifestAbsPath, 'utf8'));
    return {
      repairId: requested,
      manifestAbsPath,
      manifestRelPath,
      manifest: payload,
    };
  }

  let entries = [];
  try {
    entries = await readdir(repairsRootAbs, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error('[repair] no repair history found');
    }
    throw error;
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (candidates.length === 0) {
    throw new Error('[repair] no repair history found');
  }

  for (const candidate of candidates) {
    const manifestRelPath = path.join(REPAIRS_ROOT_REL, candidate, MANIFEST_FILE).split(path.sep).join('/');
    const manifestAbsPath = toAbsolute(rootDir, manifestRelPath);
    try {
      const payload = JSON.parse(await readFile(manifestAbsPath, 'utf8'));
      return {
        repairId: candidate,
        manifestAbsPath,
        manifestRelPath,
        manifest: payload,
      };
    } catch {
      // Try earlier entries
    }
  }

  throw new Error('[repair] no valid repair manifest found');
}

function coerceSummary(raw) {
  const summary = raw && typeof raw === 'object' ? raw : {};
  return {
    totalChanged: Number(summary.totalChanged || 0),
    added: Number(summary.added || 0),
    updated: Number(summary.updated || 0),
    removed: Number(summary.removed || 0),
  };
}

function coerceRollbackHistory(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      rolledBackAt: String(item.rolledBackAt || ''),
      mode: String(item.mode || ''),
      summary: {
        total: Number(item.summary?.total || 0),
        restored: Number(item.summary?.restored || 0),
        removed: Number(item.summary?.removed || 0),
      },
    }));
}

function coerceChangedEntries(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      path: String(item.path || ''),
      change: String(item.change || ''),
    }))
    .filter((item) => item.path.length > 0);
}

function mapRepairDetail({ repairId, manifestRelPath, manifest }) {
  const rollbackHistory = coerceRollbackHistory(manifest.rollbackHistory);
  return {
    ok: true,
    repairId: String(repairId || ''),
    manifestRelPath: String(manifestRelPath || ''),
    kind: String(manifest.kind || ''),
    status: String(manifest.status || ''),
    reason: String(manifest.reason || ''),
    dryRun: Boolean(manifest.dryRun),
    createdAt: String(manifest.createdAt || ''),
    completedAt: String(manifest.completedAt || ''),
    clients: Array.isArray(manifest.clients) ? manifest.clients.map((item) => String(item || '')) : [],
    targets: Array.isArray(manifest.targets) ? manifest.targets : [],
    summary: coerceSummary(manifest.summary),
    changedEntries: coerceChangedEntries(manifest.changedEntries),
    rollbackHistory,
    rollbackCount: rollbackHistory.length,
    lastRolledBackAt: rollbackHistory.length > 0 ? rollbackHistory[rollbackHistory.length - 1].rolledBackAt : '',
  };
}

export async function getNativeRepair({
  rootDir,
  repairId = 'latest',
} = {}) {
  if (!rootDir) {
    throw new Error('getNativeRepair requires rootDir');
  }
  const resolved = await resolveRepairManifest(rootDir, repairId);
  const manifest = resolved.manifest || {};
  if (manifest.kind !== REPAIR_KIND) {
    throw new Error(`[repair] unsupported manifest kind: ${String(manifest.kind || '(missing)')}`);
  }
  return mapRepairDetail({
    repairId: resolved.repairId,
    manifestRelPath: resolved.manifestRelPath,
    manifest,
  });
}

export async function listNativeRepairs({
  rootDir,
  limit = 20,
} = {}) {
  if (!rootDir) {
    throw new Error('listNativeRepairs requires rootDir');
  }
  const maxItems = Number.isFinite(limit) && Number(limit) > 0 ? Math.floor(Number(limit)) : 20;
  const repairsRootAbs = path.join(rootDir, REPAIRS_ROOT_REL);
  let entries = [];
  try {
    entries = await readdir(repairsRootAbs, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {
        ok: true,
        repairs: [],
      };
    }
    throw error;
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const repairs = [];
  for (const candidate of candidates) {
    const manifestRelPath = path.join(REPAIRS_ROOT_REL, candidate, MANIFEST_FILE).split(path.sep).join('/');
    const manifestAbsPath = toAbsolute(rootDir, manifestRelPath);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestAbsPath, 'utf8'));
    } catch {
      continue;
    }
    if (manifest.kind !== REPAIR_KIND) {
      continue;
    }
    repairs.push(mapRepairDetail({
      repairId: candidate,
      manifestRelPath,
      manifest,
    }));
    if (repairs.length >= maxItems) {
      break;
    }
  }

  return {
    ok: true,
    repairs,
  };
}

async function restoreTarget({ rootDir, repairId, target, dryRun = false }) {
  const normalizedPath = normalizeRelativePath(target.path);
  const destinationAbsPath = toAbsolute(rootDir, normalizedPath);
  const backupAbsPath = path.join(rootDir, REPAIRS_ROOT_REL, repairId, 'backup', normalizedPath);

  if (dryRun) {
    return {
      path: normalizedPath,
      action: target.existed ? 'restore' : 'remove',
    };
  }

  await rm(destinationAbsPath, { recursive: true, force: true });
  if (target.existed) {
    if (target.type === 'dir') {
      await cp(backupAbsPath, destinationAbsPath, { recursive: true, force: true, errorOnExist: false });
    } else {
      await mkdir(path.dirname(destinationAbsPath), { recursive: true });
      await copyFile(backupAbsPath, destinationAbsPath);
    }
  }

  return {
    path: normalizedPath,
    action: target.existed ? 'restored' : 'removed',
  };
}

export async function rollbackNativeRepair({
  rootDir,
  repairId = 'latest',
  dryRun = false,
} = {}) {
  if (!rootDir) {
    throw new Error('rollbackNativeRepair requires rootDir');
  }

  const resolved = await resolveRepairManifest(rootDir, repairId);
  const manifest = resolved.manifest || {};
  if (manifest.kind !== REPAIR_KIND) {
    throw new Error(`[repair] unsupported manifest kind: ${String(manifest.kind || '(missing)')}`);
  }
  if (manifest.dryRun) {
    throw new Error(`[repair] ${resolved.repairId} was dry-run only and has no rollback snapshot`);
  }

  const targets = Array.isArray(manifest.targets) ? [...manifest.targets] : [];
  const results = [];
  for (const target of targets) {
    results.push(await restoreTarget({
      rootDir,
      repairId: resolved.repairId,
      target,
      dryRun: Boolean(dryRun),
    }));
  }

  const summary = {
    total: results.length,
    restored: results.filter((item) => item.action === 'restored' || item.action === 'restore').length,
    removed: results.filter((item) => item.action === 'removed' || item.action === 'remove').length,
  };

  if (!dryRun) {
    const payload = {
      ...manifest,
      rollbackHistory: [
        ...(Array.isArray(manifest.rollbackHistory) ? manifest.rollbackHistory : []),
        {
          rolledBackAt: new Date().toISOString(),
          mode: 'apply',
          summary,
        },
      ],
    };
    await writeManifest(resolved.manifestAbsPath, payload);
  }

  return {
    ok: true,
    repairId: resolved.repairId,
    manifestRelPath: resolved.manifestRelPath,
    dryRun: Boolean(dryRun),
    summary,
    entries: results,
  };
}
