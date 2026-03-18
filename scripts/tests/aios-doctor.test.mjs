import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { countEffectiveWarnLines } from '../lib/doctor/aggregate.mjs';

test('countEffectiveWarnLines ignores missing codex/claude/gemini path warnings', () => {
  const count = countEffectiveWarnLines([
    '[warn] codex not found in PATH',
    '[warn] claude not found in PATH',
    '[warn] gemini not found in PATH',
  ]);
  assert.equal(count, 0);
});

test('countEffectiveWarnLines counts actionable warnings', () => {
  const count = countEffectiveWarnLines([
    '[warn] rc file not found: /tmp/.zshrc',
    '[warn] CODEX_HOME directory does not exist (/tmp/.codex)',
  ]);
  assert.equal(count, 2);
});

test('doctor-security-config scans agent-sources JSON files', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-doctor-agents-'));
  const roleDir = path.join(rootDir, 'agent-sources', 'roles');
  await mkdir(roleDir, { recursive: true });
  await writeFile(
    path.join(roleDir, 'rex-planner.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'rex-planner',
      role: 'planner',
      name: 'rex-planner',
      description: 'planner',
      tools: ['Read'],
      model: 'sonnet',
      handoffTarget: 'next-phase',
      systemPrompt: '-----BEGIN PRIVATE KEY-----',
    }, null, 2),
    'utf8'
  );

  const result = spawnSync(process.execPath, ['scripts/doctor-security-config.mjs', '--workspace', rootDir, '--strict'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /agent-sources\/roles\/rex-planner\.json/);
  assert.match(`${result.stdout}\n${result.stderr}`, /private_key/);
});
