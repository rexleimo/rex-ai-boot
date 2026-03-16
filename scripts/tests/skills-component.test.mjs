import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  doctorContextDbSkills,
  installContextDbSkills,
  uninstallContextDbSkills,
} from '../lib/components/skills.mjs';

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeSkill(rootDir, relativeDir, body = '# sample\n') {
  const skillDir = path.join(rootDir, relativeDir);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), body, 'utf8');
}

async function writeCatalog(rootDir) {
  const catalogDir = path.join(rootDir, 'config');
  await mkdir(catalogDir, { recursive: true });
  await writeFile(path.join(catalogDir, 'skills-catalog.json'), JSON.stringify({
    version: 1,
    skills: [
      {
        name: 'find-skills',
        description: 'general',
        source: '.codex/skills/find-skills',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
        tags: ['general'],
      },
      {
        name: 'xhs-ops-methods',
        description: 'project only',
        source: '.codex/skills/xhs-ops-methods',
        clients: ['codex'],
        scopes: ['project'],
        defaultInstall: { global: false, project: false },
        tags: ['xhs'],
      },
    ],
  }, null, 2), 'utf8');
}

test('global scope installs only global-eligible catalog skills', async () => {
  const rootDir = await makeTemp('aios-skills-catalog-root-');
  const codexHome = await makeTemp('aios-skills-catalog-home-');
  await writeSkill(rootDir, '.codex/skills/find-skills');
  await writeSkill(rootDir, '.codex/skills/xhs-ops-methods');
  await writeCatalog(rootDir);

  await installContextDbSkills({
    rootDir,
    client: 'codex',
    scope: 'global',
    homeMap: { codex: codexHome },
  });

  const globalSkillPath = path.join(codexHome, 'skills', 'find-skills', 'SKILL.md');
  const projectOnlyPath = path.join(codexHome, 'skills', 'xhs-ops-methods', 'SKILL.md');
  assert.match(await readFile(globalSkillPath, 'utf8'), /sample/);

  let missing = false;
  try {
    await readFile(projectOnlyPath, 'utf8');
  } catch {
    missing = true;
  }
  assert.equal(missing, true);
});

test('explicit selected skills limit installation candidates', async () => {
  const rootDir = await makeTemp('aios-skills-selected-root-');
  const codexHome = await makeTemp('aios-skills-selected-home-');
  await writeSkill(rootDir, 'skill-sources/find-skills');
  await writeSkill(rootDir, 'skill-sources/xhs-ops-methods');
  const catalogDir = path.join(rootDir, 'config');
  await mkdir(catalogDir, { recursive: true });
  await writeFile(path.join(catalogDir, 'skills-catalog.json'), JSON.stringify({
    version: 1,
    skills: [
      {
        name: 'find-skills',
        description: 'general',
        source: 'skill-sources/find-skills',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
        tags: ['general'],
      },
      {
        name: 'xhs-ops-methods',
        description: 'project only',
        source: 'skill-sources/xhs-ops-methods',
        clients: ['codex'],
        scopes: ['project'],
        defaultInstall: { global: false, project: false },
        tags: ['xhs'],
      },
    ],
  }, null, 2), 'utf8');

  await installContextDbSkills({
    rootDir,
    client: 'codex',
    scope: 'project',
    selectedSkills: ['xhs-ops-methods'],
    homeMap: { codex: codexHome },
  });

  const selectedPath = path.join(rootDir, '.codex', 'skills', 'xhs-ops-methods', 'SKILL.md');
  assert.match(await readFile(selectedPath, 'utf8'), /sample/);

  let installedUnexpectedly = true;
  try {
    await readFile(path.join(rootDir, '.codex', 'skills', 'find-skills', 'SKILL.md'), 'utf8');
  } catch {
    installedUnexpectedly = false;
  }
  assert.equal(installedUnexpectedly, false);
});

test('doctor and uninstall respect project scope targets', async () => {
  const rootDir = await makeTemp('aios-skills-project-root-');
  const codexHome = await makeTemp('aios-skills-project-home-');
  await writeSkill(rootDir, 'skill-sources/find-skills');
  await writeCatalog(rootDir);

  const catalog = {
    version: 1,
    skills: [
      {
        name: 'find-skills',
        description: 'general',
        source: 'skill-sources/find-skills',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
        tags: ['general'],
      },
    ],
  };
  await mkdir(path.join(rootDir, 'config'), { recursive: true });
  await writeFile(path.join(rootDir, 'config', 'skills-catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

  const logs = [];
  const io = { log: (line) => logs.push(String(line)) };

  await installContextDbSkills({
    rootDir,
    client: 'codex',
    scope: 'project',
    selectedSkills: ['find-skills'],
    homeMap: { codex: codexHome },
    io,
  });

  const projectInstalledPath = path.join(rootDir, '.codex', 'skills', 'find-skills', 'SKILL.md');
  assert.match(await readFile(projectInstalledPath, 'utf8'), /sample/);

  await doctorContextDbSkills({
    rootDir,
    client: 'codex',
    scope: 'project',
    selectedSkills: ['find-skills'],
    homeMap: { codex: codexHome },
    io,
  });
  assert.match(logs.join('\n'), /\.codex\/skills/);

  await uninstallContextDbSkills({
    rootDir,
    client: 'codex',
    scope: 'project',
    selectedSkills: ['find-skills'],
    homeMap: { codex: codexHome },
    io,
  });

  let missing = false;
  try {
    await readFile(projectInstalledPath, 'utf8');
  } catch {
    missing = true;
  }
  assert.equal(missing, true);
});

test('project scope can target a workspace that differs from the catalog source repo', async () => {
  const rootDir = await makeTemp('aios-skills-source-root-');
  const projectRoot = await makeTemp('aios-skills-workspace-root-');
  await writeSkill(rootDir, 'skill-sources/find-skills');

  const catalogDir = path.join(rootDir, 'config');
  await mkdir(catalogDir, { recursive: true });
  await writeFile(path.join(catalogDir, 'skills-catalog.json'), JSON.stringify({
    version: 1,
    skills: [
      {
        name: 'find-skills',
        description: 'general',
        source: 'skill-sources/find-skills',
        clients: ['codex'],
        scopes: ['project'],
        defaultInstall: { global: false, project: true },
        tags: ['general'],
      },
    ],
  }, null, 2), 'utf8');

  await installContextDbSkills({
    rootDir,
    projectRoot,
    client: 'codex',
    scope: 'project',
    selectedSkills: ['find-skills'],
  });

  assert.match(
    await readFile(path.join(projectRoot, '.codex', 'skills', 'find-skills', 'SKILL.md'), 'utf8'),
    /sample/
  );
});
