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

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
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
