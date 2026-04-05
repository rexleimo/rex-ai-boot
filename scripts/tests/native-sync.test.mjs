import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readNativeSyncMetadata } from '../lib/native/install-metadata.mjs';
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
}

test('native sync injects a managed block into AGENTS.md without deleting user text', async () => {
  const rootDir = await makeTemp('aios-native-sync-codex-root-');
  await seedNativeRoot(rootDir);
  await writeFile(path.join(rootDir, 'AGENTS.md'), 'User preface.\n\nUser tail.\n', 'utf8');

  const result = await syncNativeEnhancements({ rootDir, client: 'codex' });
  const agentsDoc = await readFile(path.join(rootDir, 'AGENTS.md'), 'utf8');

  assert.equal(result.ok, true);
  assert.match(agentsDoc, /User preface/);
  assert.match(agentsDoc, /User tail/);
  assert.match(agentsDoc, /AIOS NATIVE BEGIN/);
  assert.match(agentsDoc, /Codex native block/);
  assert.equal(readNativeSyncMetadata(path.join(rootDir, '.codex')).client, 'codex');
});

test('native sync merges claude settings.local.json without clobbering non-AIOS keys', async () => {
  const rootDir = await makeTemp('aios-native-sync-claude-root-');
  await seedNativeRoot(rootDir);
  await writeFile(path.join(rootDir, 'CLAUDE.md'), 'Local intro.\n', 'utf8');
  await writeJson(path.join(rootDir, '.claude', 'settings.local.json'), {
    permissions: {
      allow: ['Bash(git:*)'],
    },
    hooks: {
      PreToolUse: ['existing-hook'],
    },
  });

  await syncNativeEnhancements({ rootDir, client: 'claude' });
  const settings = JSON.parse(await readFile(path.join(rootDir, '.claude', 'settings.local.json'), 'utf8'));
  const claudeDoc = await readFile(path.join(rootDir, 'CLAUDE.md'), 'utf8');

  assert.deepEqual(settings.permissions.allow, ['Bash(git:*)']);
  assert.deepEqual(settings.hooks.PreToolUse, ['existing-hook']);
  assert.equal(Array.isArray(settings.aiosNative.hooks.SessionStart), true);
  assert.match(claudeDoc, /Local intro/);
  assert.match(claudeDoc, /AIOS NATIVE BEGIN/);
});

test('native sync writes compatibility docs for gemini and opencode', async () => {
  const rootDir = await makeTemp('aios-native-sync-compat-root-');
  await seedNativeRoot(rootDir);

  await syncNativeEnhancements({ rootDir, client: 'all' });

  assert.match(await readFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'utf8'), /Gemini compatibility/);
  assert.match(await readFile(path.join(rootDir, '.opencode', 'AIOS.md'), 'utf8'), /Opencode compatibility/);
  assert.equal(readNativeSyncMetadata(path.join(rootDir, '.gemini')).tier, 'compatibility');
  assert.equal(readNativeSyncMetadata(path.join(rootDir, '.opencode')).tier, 'compatibility');
});

test('native sync repair mode can replace unmanaged compatibility docs', async () => {
  const rootDir = await makeTemp('aios-native-sync-repair-managed-file-root-');
  await seedNativeRoot(rootDir);
  await mkdir(path.join(rootDir, '.gemini'), { recursive: true });
  await writeFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'manual compatibility doc\n', 'utf8');

  await assert.rejects(
    syncNativeEnhancements({ rootDir, client: 'gemini' }),
    /unmanaged conflict/
  );

  await syncNativeEnhancements({
    rootDir,
    client: 'gemini',
    repair: { force: true },
  });

  const repaired = await readFile(path.join(rootDir, '.gemini', 'AIOS.md'), 'utf8');
  assert.match(repaired, /AIOS NATIVE BEGIN/);
  assert.match(repaired, /Gemini compatibility/);
});

test('native sync repair mode can recover invalid claude settings.local.json', async () => {
  const rootDir = await makeTemp('aios-native-sync-repair-json-root-');
  await seedNativeRoot(rootDir);
  await mkdir(path.join(rootDir, '.claude'), { recursive: true });
  await writeFile(path.join(rootDir, '.claude', 'settings.local.json'), '{invalid-json', 'utf8');

  await assert.rejects(
    syncNativeEnhancements({ rootDir, client: 'claude' }),
    /invalid json/
  );

  await syncNativeEnhancements({
    rootDir,
    client: 'claude',
    repair: { force: true },
  });

  const repaired = JSON.parse(await readFile(path.join(rootDir, '.claude', 'settings.local.json'), 'utf8'));
  assert.equal(typeof repaired.aiosNative, 'object');
  assert.equal(Array.isArray(repaired.aiosNative.hooks.SessionStart), true);
});

test('native sync rolls back managed writes when a later target write fails', async () => {
  const rootDir = await makeTemp('aios-native-sync-rollback-root-');
  await seedNativeRoot(rootDir);
  await writeFile(path.join(rootDir, 'AGENTS.md'), 'Keep me.\n', 'utf8');

  await assert.rejects(
    syncNativeEnhancements({
      rootDir,
      client: 'codex',
      fsOps: {
        async writeTextTarget(targetPath, content) {
          if (targetPath === path.join(rootDir, 'AGENTS.md')) {
            await writeFile(targetPath, content, 'utf8');
            return;
          }
          throw new Error('boom');
        },
      },
    }),
    /boom/
  );

  assert.equal(await readFile(path.join(rootDir, 'AGENTS.md'), 'utf8'), 'Keep me.\n');
});
