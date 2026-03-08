import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRIDGE = path.join(ROOT, 'scripts', 'contextdb-shell-bridge.mjs');

async function createFakeCodexCommand() {
  const binDir = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-bin-'));
  if (process.platform === 'win32') {
    const file = path.join(binDir, 'codex.cmd');
    await writeFile(file, '@echo off\r\necho CODEX_HOME=%CODEX_HOME%\r\n', 'utf8');
    return binDir;
  }

  const file = path.join(binDir, 'codex');
  await writeFile(file, '#!/usr/bin/env bash\necho "CODEX_HOME=${CODEX_HOME:-<unset>}"\n', 'utf8');
  await chmod(file, 0o755);
  return binDir;
}

async function createFakeRunner() {
  const binDir = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-runner-'));
  const runnerScript = path.join(binDir, 'runner-script.mjs');
  await writeFile(runnerScript, [
    'const args = process.argv.slice(2);',
    "const index = args.indexOf('--workspace');",
    "const workspace = index >= 0 ? (args[index + 1] || '') : '';",
    "console.log(`RUNNER_WORKSPACE=${workspace}`);",
    "console.log(`RUNNER_ARGS=${JSON.stringify(args)}`);",
  ].join('\n'), 'utf8');

  if (process.platform === 'win32') {
    const file = path.join(binDir, 'ctx-runner.cmd');
    await writeFile(file, `@echo off\r\nnode "${runnerScript}" %*\r\n`, 'utf8');
    return file;
  }

  const file = path.join(binDir, 'ctx-runner');
  await writeFile(file, `#!/usr/bin/env bash\nnode "${runnerScript}" "$@"\n`, 'utf8');
  await chmod(file, 0o755);
  return file;
}

function runBridge({ cwd, codeHome, pathPrefix, env: envOverrides = {}, args = ['--help'] }) {
  const env = { ...process.env, ...envOverrides };
  env.PATH = `${pathPrefix}${path.delimiter}${env.PATH || ''}`;

  if (codeHome !== undefined) {
    env.CODEX_HOME = codeHome;
  }

  const result = spawnSync('node', [
    BRIDGE,
    '--agent', 'codex-cli',
    '--command', 'codex',
    '--cwd', cwd,
    '--',
    ...args,
  ], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });

  return result;
}

function parseReportedCodeHome(stdout) {
  const line = (stdout || '').trim().split(/\r?\n/).find((x) => x.startsWith('CODEX_HOME='));
  return line ? line.slice('CODEX_HOME='.length) : '';
}

function parseRunnerWorkspace(stdout) {
  const line = (stdout || '').trim().split(/\r?\n/).find((x) => x.startsWith('RUNNER_WORKSPACE='));
  return line ? line.slice('RUNNER_WORKSPACE='.length) : '';
}

test('relative CODEX_HOME is resolved against invocation cwd', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-cwd-'));
  await mkdir(path.join(cwd, 'rel-home'), { recursive: true });
  const fakeBin = await createFakeCodexCommand();

  const result = runBridge({
    cwd,
    codeHome: './rel-home',
    pathPrefix: fakeBin,
  });

  assert.equal(result.status, 0);
  assert.equal(parseReportedCodeHome(result.stdout), path.resolve(cwd, 'rel-home'));
});

test('absolute CODEX_HOME is preserved', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-cwd-'));
  const absoluteHome = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-codex-home-'));
  const fakeBin = await createFakeCodexCommand();

  const result = runBridge({
    cwd,
    codeHome: absoluteHome,
    pathPrefix: fakeBin,
  });

  assert.equal(result.status, 0);
  assert.equal(parseReportedCodeHome(result.stdout), absoluteHome);
});

test('all mode wraps a non-git cwd using fallback workspace', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-fallback-all-'));
  const fakeBin = await createFakeCodexCommand();
  const fakeRunner = await createFakeRunner();

  const result = runBridge({
    cwd,
    pathPrefix: fakeBin,
    args: ['hello'],
    env: {
      CTXDB_RUNNER: fakeRunner,
      CTXDB_WRAP_MODE: 'all',
    },
  });

  assert.equal(result.status, 0);
  assert.equal(parseRunnerWorkspace(result.stdout), cwd);
});

test('repo-only mode wraps a non-git cwd when it matches ROOTPATH', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-fallback-root-'));
  const fakeBin = await createFakeCodexCommand();
  const fakeRunner = await createFakeRunner();

  const result = runBridge({
    cwd,
    pathPrefix: fakeBin,
    args: ['hello'],
    env: {
      CTXDB_RUNNER: fakeRunner,
      CTXDB_WRAP_MODE: 'repo-only',
      ROOTPATH: cwd,
    },
  });

  assert.equal(result.status, 0);
  assert.equal(parseRunnerWorkspace(result.stdout), cwd);
});

test('repo-only mode still passes through when fallback cwd does not match ROOTPATH', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-fallback-other-'));
  const rootpath = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-rootpath-'));
  const fakeBin = await createFakeCodexCommand();
  const fakeRunner = await createFakeRunner();

  const result = runBridge({
    cwd,
    pathPrefix: fakeBin,
    args: ['hello'],
    env: {
      CTXDB_RUNNER: fakeRunner,
      CTXDB_WRAP_MODE: 'repo-only',
      ROOTPATH: rootpath,
    },
  });

  assert.equal(result.status, 0);
  assert.equal(parseRunnerWorkspace(result.stdout), '');
  assert.match(result.stdout, /CODEX_HOME=/);
});

test('opt-in mode auto-creates marker and wraps a non-git cwd', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aios-bridge-fallback-optin-'));
  const fakeBin = await createFakeCodexCommand();
  const fakeRunner = await createFakeRunner();
  const markerPath = path.join(cwd, '.contextdb-enable');

  const result = runBridge({
    cwd,
    pathPrefix: fakeBin,
    args: ['hello'],
    env: {
      CTXDB_RUNNER: fakeRunner,
      CTXDB_WRAP_MODE: 'opt-in',
      CTXDB_AUTO_CREATE_MARKER: '1',
    },
  });

  assert.equal(result.status, 0);
  assert.equal(parseRunnerWorkspace(result.stdout), cwd);
  assert.equal(existsSync(markerPath), true);
});
