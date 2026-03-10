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
  doctorContextDbSkills,
  installContextDbSkills,
  uninstallContextDbSkills,
} from '../lib/components/skills.mjs';
import {
  installOrchestratorAgents,
  uninstallOrchestratorAgents,
} from '../lib/components/agents.mjs';
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

async function makeFakeMcpServer(rootDir) {
  const mcpDir = path.join(rootDir, 'mcp-server');
  await mkdir(mcpDir, { recursive: true });
  await writeFile(path.join(mcpDir, 'package.json'), '{"name":"fake-mcp"}\n', 'utf8');
  return mcpDir;
}

test('shell install writes managed block and uninstall removes it', async () => {
  const rootDir = await makeTemp('aios-shell-root-');
  const rcFile = path.join(rootDir, '.zshrc');
  await writeFile(rcFile, '# existing\n', 'utf8');
  await makeFakeMcpServer(rootDir);

  const calls = [];
  const commandRunner = (command, args, options) => {
    calls.push({ command, args, options });
  };

  await installContextDbShell({ rootDir, rcFile, mode: 'repo-only', platform: 'darwin', commandRunner });
  const installed = await readFile(rcFile, 'utf8');
  assert.match(installed, /# >>> contextdb-shell >>>/);
  assert.match(installed, /CTXDB_WRAP_MODE:-repo-only/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'npm');
  assert.deepEqual(calls[0].args, ['install']);

  await uninstallContextDbShell({ rcFile, platform: 'darwin' });
  const removed = await readFile(rcFile, 'utf8');
  assert.doesNotMatch(removed, /# >>> contextdb-shell >>>/);
});

test('windows shell install writes managed block to both PowerShell profiles', async () => {
  const rootDir = await makeTemp('aios-shell-win-root-');
  const homeDir = await makeTemp('aios-shell-win-home-');
  await makeFakeMcpServer(rootDir);

  const calls = [];
  const commandRunner = (command, args, options) => {
    calls.push({ command, args, options });
  };

  await installContextDbShell({ rootDir, platform: 'win32', homeDir, commandRunner });

  const pwshProfile = path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  const winPsProfile = path.join(homeDir, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
  const pwshContent = await readFile(pwshProfile, 'utf8');
  const winPsContent = await readFile(winPsProfile, 'utf8');

  assert.match(pwshContent, /# >>> contextdb-shell >>>/);
  assert.match(winPsContent, /# >>> contextdb-shell >>>/);
  assert.equal(calls.length, 1);

  await uninstallContextDbShell({ platform: 'win32', homeDir });
  assert.doesNotMatch(await readFile(pwshProfile, 'utf8'), /# >>> contextdb-shell >>>/);
  assert.doesNotMatch(await readFile(winPsProfile, 'utf8'), /# >>> contextdb-shell >>>/);
});

test('shell install reuses existing ContextDB runtime without reinstall', async () => {
  const rootDir = await makeTemp('aios-shell-runtime-root-');
  const rcFile = path.join(rootDir, '.zshrc');
  const mcpDir = await makeFakeMcpServer(rootDir);
  const tsxPath = path.join(mcpDir, 'node_modules', '.bin', 'tsx');
  await mkdir(path.dirname(tsxPath), { recursive: true });
  await writeFile(tsxPath, '', 'utf8');

  let called = false;
  const commandRunner = () => {
    called = true;
  };

  await installContextDbShell({ rootDir, rcFile, platform: 'darwin', commandRunner });
  assert.equal(called, false);
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

test('windows codex uses shell execution for cmd-backed cli wrappers', () => {
  const spec = getCommandSpawnSpec('codex', ['--version'], { platform: 'win32' });

  assert.equal(spec.command, 'codex');
  assert.deepEqual(spec.args, ['--version']);
  assert.equal(spec.shell, true);
});

test('windows claude and gemini also use shell execution', () => {
  const claudeSpec = getCommandSpawnSpec('claude', ['--version'], { platform: 'win32' });
  const geminiSpec = getCommandSpawnSpec('gemini', ['--version'], { platform: 'win32' });

  assert.equal(claudeSpec.shell, true);
  assert.equal(geminiSpec.shell, true);
});


test('skills doctor warns on non-discoverable repo skill roots', async () => {
  const rootDir = await makeTemp('aios-skills-doctor-root-');
  const badSkillDir = path.join(rootDir, '.baoyu-skills', 'wrong-skill');
  await mkdir(badSkillDir, { recursive: true });
  await writeFile(path.join(badSkillDir, 'SKILL.md'), '# wrong\n', 'utf8');

  const logs = [];
  const io = { log: (line) => logs.push(String(line)) };
  const result = await doctorContextDbSkills({
    rootDir,
    client: 'codex',
    homeMap: { codex: await makeTemp('aios-skills-home-') },
    io,
  });

  assert.equal(result.warnings >= 1, true);
  assert.equal(logs.some((line) => line.includes('non-discoverable skill root .baoyu-skills')), true);
  assert.equal(logs.some((line) => line.includes('.baoyu-skills/wrong-skill/SKILL.md')), true);
});

test('agents install writes generated catalogs and uninstall removes managed files only', async () => {
  const rootDir = await makeTemp('aios-agents-root-');
  const claudeDir = path.join(rootDir, '.claude', 'agents');
  const codexDir = path.join(rootDir, '.codex', 'agents');
  await mkdir(claudeDir, { recursive: true });
  await mkdir(codexDir, { recursive: true });

  // A manual file (no marker) must never be overwritten or removed.
  await writeFile(path.join(claudeDir, 'rex-planner.md'), 'manual\n', 'utf8');

  const logs = [];
  const io = { log: (line) => logs.push(String(line)) };

  await installOrchestratorAgents({ rootDir, client: 'all', io });
  assert.equal(await readFile(path.join(claudeDir, 'rex-planner.md'), 'utf8'), 'manual\n');

  const generated = await readFile(path.join(codexDir, 'rex-planner.md'), 'utf8');
  assert.match(generated, /AIOS-GENERATED/);

  await uninstallOrchestratorAgents({ rootDir, client: 'all', io });
  assert.equal(await readFile(path.join(claudeDir, 'rex-planner.md'), 'utf8'), 'manual\n');

  let missing = false;
  try {
    await readFile(path.join(codexDir, 'rex-planner.md'), 'utf8');
  } catch {
    missing = true;
  }
  assert.equal(missing, true);
});
