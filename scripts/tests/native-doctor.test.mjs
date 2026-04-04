import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runDoctorSuite } from '../lib/doctor/aggregate.mjs';
import { syncNativeEnhancements } from '../lib/native/sync.mjs';

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

async function writeNativeManifest(rootDir) {
  await writeJson(path.join(rootDir, 'config', 'native-sync-manifest.json'), {
    schemaVersion: 1,
    managedBy: 'aios',
    markers: {
      markdownBegin: '<!-- AIOS NATIVE BEGIN -->',
      markdownEnd: '<!-- AIOS NATIVE END -->',
    },
    clients: {
      codex: { tier: 'deep', metadataRoot: '.codex', outputs: ['AGENTS.md', '.codex/agents', '.codex/skills'] },
      claude: { tier: 'deep', metadataRoot: '.claude', outputs: ['CLAUDE.md', '.claude/settings.local.json', '.claude/agents', '.claude/skills'] },
      gemini: { tier: 'compatibility', metadataRoot: '.gemini', outputs: ['.gemini/AIOS.md', '.gemini/skills'] },
      opencode: { tier: 'compatibility', metadataRoot: '.opencode', outputs: ['.opencode/AIOS.md', '.opencode/skills'] },
    },
  });
}

async function writeNativeSources(rootDir) {
  await mkdir(path.join(rootDir, 'client-sources', 'native-base', 'shared', 'partials'), { recursive: true });
  await mkdir(path.join(rootDir, 'client-sources', 'native-base', 'codex', 'project'), { recursive: true });
  await mkdir(path.join(rootDir, 'client-sources', 'native-base', 'claude', 'project'), { recursive: true });
  await mkdir(path.join(rootDir, 'client-sources', 'native-base', 'gemini', 'project'), { recursive: true });
  await mkdir(path.join(rootDir, 'client-sources', 'native-base', 'opencode', 'project'), { recursive: true });

  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'shared', 'partials', 'core-instructions.md'), 'Shared native instructions.\n', 'utf8');
  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'shared', 'partials', 'contextdb.md'), 'ContextDB bridge enabled.\n', 'utf8');
  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'shared', 'partials', 'browser-mcp.md'), 'Browser MCP available.\n', 'utf8');
  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'codex', 'project', 'AGENTS.md'), 'Codex native block.\n', 'utf8');
  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'claude', 'project', 'CLAUDE.md'), 'Claude native block.\n', 'utf8');
  await writeJson(path.join(rootDir, 'client-sources', 'native-base', 'claude', 'project', 'settings.local.json'), {
    hooks: {
      SessionStart: ['node omc-hook.mjs'],
    },
  });
  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'gemini', 'project', 'AIOS.md'), 'Gemini compatibility instructions.\n', 'utf8');
  await writeFile(path.join(rootDir, 'client-sources', 'native-base', 'opencode', 'project', 'AIOS.md'), 'Opencode compatibility instructions.\n', 'utf8');
}

async function writeSkillSources(rootDir) {
  await writeJson(path.join(rootDir, 'config', 'skills-sync-manifest.json'), {
    schemaVersion: 1,
    generatedRoots: {
      codex: '.codex/skills',
      claude: '.claude/skills',
      gemini: '.gemini/skills',
      opencode: '.opencode/skills',
    },
    skills: [
      { relativeSkillPath: 'find-skills', installCatalogName: 'find-skills', repoTargets: ['codex', 'claude', 'gemini', 'opencode'] },
    ],
    legacyUnmanaged: [],
  });
  await mkdir(path.join(rootDir, 'skill-sources', 'find-skills'), { recursive: true });
  await writeFile(path.join(rootDir, 'skill-sources', 'find-skills', 'SKILL.md'), '# native skill\n', 'utf8');
}

async function writeAgentSources(rootDir) {
  await writeJson(path.join(rootDir, 'agent-sources', 'manifest.json'), {
    schemaVersion: 1,
    generatedTargets: ['claude', 'codex'],
  });

  const roles = [
    ['rex-planner', 'planner'],
    ['rex-implementer', 'implementer'],
    ['rex-reviewer', 'reviewer'],
    ['rex-security-reviewer', 'security-reviewer'],
  ];

  for (const [id, role] of roles) {
    await writeJson(path.join(rootDir, 'agent-sources', 'roles', `${id}.json`), {
      schemaVersion: 1,
      id,
      role,
      name: id,
      description: `${role} role`,
      tools: ['Read'],
      model: 'sonnet',
      handoffTarget: role === 'reviewer' || role === 'security-reviewer' ? 'merge-gate' : 'next-phase',
      systemPrompt: `${role} prompt`,
    });
  }
}

async function seedNativeRoot(rootDir) {
  await writeNativeManifest(rootDir);
  await writeNativeSources(rootDir);
  await writeSkillSources(rootDir);
  await writeAgentSources(rootDir);
  await writeFile(path.join(rootDir, 'AGENTS.md'), 'Seed AGENTS\n', 'utf8');
  await writeFile(path.join(rootDir, 'CLAUDE.md'), 'Seed CLAUDE\n', 'utf8');
}

test('doctor --native runs only native checks', async () => {
  const rootDir = await makeTemp('aios-native-doctor-only-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'codex' });

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  assert.equal(result.exitCode, 0);
  assert.match(logs.join('\n'), /doctor-native/);
  assert.doesNotMatch(logs.join('\n'), /doctor-contextdb-shell/);
  assert.doesNotMatch(logs.join('\n'), /doctor-browser-mcp/);
});

test('native doctor reports unmanaged conflicts with a concrete recovery command', async () => {
  const rootDir = await makeTemp('aios-native-doctor-conflict-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'codex' });
  await writeFile(path.join(rootDir, 'AGENTS.md'), 'manual overwrite\n', 'utf8');

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  assert.equal(result.exitCode, 1);
  assert.match(logs.join('\n'), /unmanaged conflict/i);
  assert.match(logs.join('\n'), /node scripts\/aios\.mjs update --components native --client codex/);
});

test('native doctor reports sync drift when repo-local generated skills change', async () => {
  const rootDir = await makeTemp('aios-native-doctor-drift-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'gemini' });
  await writeFile(path.join(rootDir, '.gemini', 'skills', 'find-skills', 'SKILL.md'), 'drifted\n', 'utf8');

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  assert.equal(result.exitCode, 1);
  assert.match(logs.join('\n'), /\[drift\]/);
  assert.match(await readFile(path.join(rootDir, '.gemini', 'skills', 'find-skills', 'SKILL.md'), 'utf8'), /drifted/);
});
