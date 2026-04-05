import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runDoctorSuite } from '../lib/doctor/aggregate.mjs';
import { rollbackNativeRepair } from '../lib/native/repairs.mjs';
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

test('doctor --native --verbose prints native explainability details', async () => {
  const rootDir = await makeTemp('aios-native-doctor-verbose-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'codex' });

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    verbose: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  const rendered = logs.join('\n');
  assert.equal(result.exitCode, 0);
  assert.match(rendered, /metadata=\.codex\/\.aios-native-sync\.json present/);
  assert.match(rendered, /managedTargets\(expected\): AGENTS\.md, \.codex\/agents, \.codex\/skills/);
  assert.match(rendered, /operations: AGENTS\.md/);
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

test('doctor --native --fix repairs unmanaged compatibility docs and exits cleanly', async () => {
  const rootDir = await makeTemp('aios-native-doctor-fix-managed-file-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'gemini' });
  await writeFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'manual overwrite\n', 'utf8');

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    fix: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  assert.equal(result.exitCode, 0);
  assert.match(logs.join('\n'), /Native Auto-Fix/);
  assert.match(logs.join('\n'), /\[fix\] native gemini/);
  assert.match(logs.join('\n'), /\[repair\] changed total=\d+/);
  assert.match(logs.join('\n'), /\[repair\] changed file=\.gemini\/AIOS\.md \(updated\)/);
  assert.match(await readFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'utf8'), /AIOS NATIVE BEGIN/);
});

test('doctor --native --fix --dry-run only prints planned fixes without mutating files', async () => {
  const rootDir = await makeTemp('aios-native-doctor-fix-dry-run-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'gemini' });
  await writeFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'manual overwrite\n', 'utf8');

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    fix: true,
    dryRun: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  assert.equal(result.exitCode, 1);
  assert.match(logs.join('\n'), /\[plan\] native gemini/);
  assert.match(logs.join('\n'), /\[plan\] native files total=\d+/);
  assert.match(logs.join('\n'), /\[plan\] native files file=\.gemini\/AIOS\.md/);
  assert.equal(await readFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'utf8'), 'manual overwrite\n');
});

test('doctor --native --fix records repair manifest and supports rollback', async () => {
  const rootDir = await makeTemp('aios-native-doctor-fix-rollback-root-');
  await seedNativeRoot(rootDir);
  await syncNativeEnhancements({ rootDir, client: 'gemini' });
  await writeFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'manual overwrite\n', 'utf8');

  const logs = [];
  const result = await runDoctorSuite({
    rootDir,
    nativeOnly: true,
    fix: true,
    io: { log: (line) => logs.push(String(line)) },
    env: {},
  });

  const rendered = logs.join('\n');
  assert.equal(result.exitCode, 0);
  assert.match(rendered, /\[repair\] id=/);
  assert.match(rendered, /\[repair\] manifest=\.aios\/repairs\/.+\/manifest\.json/);
  assert.match(rendered, /\[repair\] rollback: node scripts\/aios\.mjs internal native rollback --repair-id /);
  assert.match(await readFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'utf8'), /AIOS NATIVE BEGIN/);

  const repairLine = logs.find((line) => line.startsWith('[repair] id='));
  assert.ok(repairLine);
  const repairId = repairLine.slice('[repair] id='.length).trim();
  assert.match(repairId, /\d{8}T\d{6}Z-[0-9a-f]{6}/);

  const manifestPath = path.join(rootDir, '.aios', 'repairs', repairId, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.kind, 'native-repair');
  assert.equal(manifest.status, 'completed');
  assert.equal(Array.isArray(manifest.changedEntries), true);
  assert.ok(manifest.summary.totalChanged > 0);

  const rollbackResult = await rollbackNativeRepair({ rootDir, repairId });
  assert.equal(rollbackResult.ok, true);
  assert.equal(rollbackResult.repairId, repairId);
  assert.equal(await readFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'utf8'), 'manual overwrite\n');
});
