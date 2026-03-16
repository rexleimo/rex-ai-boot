import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const MCP_DIR = path.join(REPO_ROOT, 'mcp-server');
const TSX_CLI = path.join(REPO_ROOT, 'mcp-server', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const CONTEXTDB_CLI = path.join(REPO_ROOT, 'mcp-server', 'src', 'contextdb', 'cli.ts');

function parseBoolEnv(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function shouldAutoRebuildNative(env = process.env) {
  return parseBoolEnv(env?.CTXDB_AUTO_REBUILD_NATIVE, true);
}

export function isBetterSqlite3AbiMismatch(detail) {
  if (!detail) return false;
  const normalized = String(detail).toLowerCase();
  const mentionsAddon = normalized.includes('better_sqlite3.node') || normalized.includes('better-sqlite3');
  const mentionsAbi = normalized.includes('node_module_version')
    || normalized.includes('compiled against a different node.js version');
  return mentionsAddon && mentionsAbi;
}

export function isBetterSqlite3MissingBindings(detail) {
  if (!detail) return false;
  const normalized = String(detail).toLowerCase();
  const mentionsAddon = normalized.includes('better_sqlite3.node') || normalized.includes('better-sqlite3');
  const mentionsBindings = normalized.includes('could not locate the bindings file')
    || normalized.includes('could not find module root given file');
  return mentionsAddon && mentionsBindings;
}

export function isBetterSqlite3RepairableFailure(detail) {
  return isBetterSqlite3AbiMismatch(detail) || isBetterSqlite3MissingBindings(detail);
}

function getCommandFailureDetail(result) {
  if (result?.error) {
    return result.error.message || String(result.error);
  }
  const stderr = String(result?.stderr || '').trim();
  const stdout = String(result?.stdout || '').trim();
  return stderr || stdout || `contextdb cli failed with exit code ${result?.status ?? 1}`;
}

export function runContextDbCli(args = [], { cwd = REPO_ROOT, env = process.env, spawnSyncImpl = spawnSync } = {}) {
  const commandArgs = [TSX_CLI, CONTEXTDB_CLI, ...args];
  const runCli = () => spawnSyncImpl(process.execPath, commandArgs, {
    cwd,
    env,
    encoding: 'utf8',
  });
  const result = runCli();

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = getCommandFailureDetail(result);
    const shouldRetryWithRepair = shouldAutoRebuildNative(env) && isBetterSqlite3RepairableFailure(details);
    if (!shouldRetryWithRepair) {
      throw new Error(details);
    }

    const rebuildResult = spawnSyncImpl('npm', ['rebuild', 'better-sqlite3'], {
      cwd: MCP_DIR,
      env,
      encoding: 'utf8',
    });
    if (rebuildResult.error || rebuildResult.status !== 0) {
      const rebuildFailure = getCommandFailureDetail(rebuildResult);
      throw new Error(`${details}\nauto-rebuild failed: ${rebuildFailure}`);
    }

    const retryResult = runCli();
    if (retryResult.error) {
      throw retryResult.error;
    }
    if (retryResult.status !== 0) {
      throw new Error(getCommandFailureDetail(retryResult));
    }

    const retryStdout = String(retryResult.stdout || '').trim();
    return retryStdout.length > 0 ? JSON.parse(retryStdout) : {};
  }

  const stdout = String(result.stdout || '').trim();
  return stdout.length > 0 ? JSON.parse(stdout) : {};
}
