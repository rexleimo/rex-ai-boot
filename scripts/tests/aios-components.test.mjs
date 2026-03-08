import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  installContextDbShell,
  uninstallContextDbShell,
} from '../lib/components/shell.mjs';
import {
  installContextDbSkills,
  uninstallContextDbSkills,
} from '../lib/components/skills.mjs';
import {
  commandExists,
  getCommandSpawnSpec,
} from '../lib/platform/process.mjs';

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function makeFakeWindowsNodeInstall({ withNpxCli = true } = {}) {
  const rootDir = await makeTemp('aios-node-install-');
  const binDir = path.join(rootDir, 'bin');
  const npmBinDir = path.join(rootDir, 'lib', 'node_modules', 'npm', 'bin');
  const execPath = path.join(binDir, 'node.exe');
  const npmCli = path.join(npmBinDir, 'npm-cli.js');
  const npxCli = path.join(npmBinDir, 'npx-cli.js');

  await mkdir(npmBinDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(execPath, '', 'utf8');
  await writeFile(npmCli, '', 'utf8');
  if (withNpxCli) {
    await writeFile(npxCli, '', 'utf8');
  }

  return { execPath, npmCli, npxCli };
}

test('shell install writes managed block and uninstall removes it', async () => {
  const rootDir = await makeTemp('aios-shell-root-');
  const rcFile = path.join(rootDir, '.zshrc');
  await writeFile(rcFile, '# existing\n', 'utf8');

  await installContextDbShell({ rootDir, rcFile, mode: 'repo-only', platform: 'darwin' });
  const installed = await readFile(rcFile, 'utf8');
  assert.match(installed, /# >>> contextdb-shell >>>/);
  assert.match(installed, /CTXDB_WRAP_MODE:-repo-only/);

  await uninstallContextDbShell({ rcFile, platform: 'darwin' });
  const removed = await readFile(rcFile, 'utf8');
  assert.doesNotMatch(removed, /# >>> contextdb-shell >>>/);
});

test('skills install links repo-managed skills and uninstall removes them', async () => {
  const rootDir = await makeTemp('aios-skills-root-');
  const codexSkillDir = path.join(rootDir, '.codex', 'skills', 'sample-skill');
  await mkdir(codexSkillDir, { recursive: true });
  await writeFile(path.join(codexSkillDir, 'SKILL.md'), '# sample\n', 'utf8');

  const codexHome = await makeTemp('aios-skills-home-');
  await installContextDbSkills({
    rootDir,
    client: 'codex',
    homeMap: { codex: codexHome },
  });

  const linkPath = path.join(codexHome, 'skills', 'sample-skill');
  const stat = await readFile(path.join(linkPath, 'SKILL.md'), 'utf8');
  assert.match(stat, /sample/);

  await uninstallContextDbSkills({
    rootDir,
    client: 'codex',
    homeMap: { codex: codexHome },
  });

  let missing = false;
  try {
    await readFile(path.join(linkPath, 'SKILL.md'), 'utf8');
  } catch {
    missing = true;
  }
  assert.equal(missing, true);
});

test('windows npm resolves to the bundled npm cli script', async () => {
  const { execPath, npmCli } = await makeFakeWindowsNodeInstall();
  const spec = getCommandSpawnSpec('npm', ['install'], { platform: 'win32', execPath });

  assert.equal(commandExists('npm', { platform: 'win32', execPath }), true);
  assert.equal(spec.command, execPath);
  assert.deepEqual(spec.args, [npmCli, 'install']);
});

test('windows npx falls back to npm exec when npx cli is absent', async () => {
  const { execPath, npmCli } = await makeFakeWindowsNodeInstall({ withNpxCli: false });
  const spec = getCommandSpawnSpec('npx', ['playwright', 'install', 'chromium'], { platform: 'win32', execPath });

  assert.equal(commandExists('npx', { platform: 'win32', execPath }), true);
  assert.equal(spec.command, execPath);
  assert.deepEqual(spec.args, [npmCli, 'exec', '--', 'playwright', 'install', 'chromium']);
});
