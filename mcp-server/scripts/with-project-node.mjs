#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const NVMRC_PATH = path.join(PROJECT_ROOT, '.nvmrc');
const ACTIVE_ENV = 'AIOS_PROJECT_NODE_ACTIVE';

function readDesiredNodeMajor() {
  const raw = fs.readFileSync(NVMRC_PATH, 'utf8').trim().replace(/^v/u, '');
  const major = Number.parseInt(raw.split('.')[0] || '', 10);
  if (!Number.isFinite(major) || major <= 0) {
    throw new Error(`Invalid .nvmrc version: ${raw}`);
  }
  return { raw, major };
}

function compareVersionDesc(left, right) {
  const toParts = (value) =>
    String(value)
      .replace(/^v/u, '')
      .split('.')
      .map((item) => Number.parseInt(item, 10) || 0);
  const a = toParts(left);
  const b = toParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (b[index] || 0) - (a[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function resolveNodeFromNvm(major) {
  const versionsDir = path.join(os.homedir(), '.nvm', 'versions', 'node');
  if (!fs.existsSync(versionsDir)) return '';

  const matches = fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`v${major}.`))
    .map((entry) => entry.name)
    .sort(compareVersionDesc);

  for (const version of matches) {
    const candidate = path.join(versionsDir, version, 'bin', 'node');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return '';
}

function resolveNodeFromCommonLocations(major) {
  const candidates = [
    path.join('/opt/homebrew/opt', `node@${major}`, 'bin', 'node'),
    path.join('/usr/local/opt', `node@${major}`, 'bin', 'node'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function resolveProjectNode() {
  const desired = readDesiredNodeMajor();
  const activeMajor = Number.parseInt(process.versions.node.split('.')[0] || '', 10);
  if (process.env[ACTIVE_ENV] === '1' || activeMajor === desired.major) {
    return process.execPath;
  }
  return resolveNodeFromNvm(desired.major)
    || resolveNodeFromCommonLocations(desired.major)
    || '';
}

function main() {
  const [target, ...args] = process.argv.slice(2);
  if (!target) {
    console.error('Usage: node scripts/with-project-node.mjs <script> [args...]');
    process.exit(2);
  }

  const nodeBinary = resolveProjectNode();
  if (!nodeBinary) {
    const { raw } = readDesiredNodeMajor();
    console.error(
      `Unable to resolve a Node runtime matching .nvmrc=${raw}. Install it (for example via nvm) and retry.`
    );
    process.exit(1);
  }

  const targetPath = path.isAbsolute(target) ? target : path.resolve(PROJECT_ROOT, target);
  const result = spawnSync(nodeBinary, [targetPath, ...args], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      [ACTIVE_ENV]: '1',
    },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message || String(result.error));
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main();
