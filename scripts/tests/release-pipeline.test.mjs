import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeFixtureFile(rootDir, relativePath, content) {
  const filePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
}

function assertOk(result, message = '') {
  assert.equal(result.status, 0, message || result.stderr || result.stdout);
}

async function seedFixtureRepo(rootDir, { checkSkillsSyncScript = 'process.exit(0);\n' } = {}) {
  const workspaceRoot = process.cwd();

  await writeFixtureFile(rootDir, 'AGENTS.md', '# fixture\n');
  await writeFixtureFile(rootDir, 'CHANGELOG.md', '## [1.2.3] - 2026-03-17\n');
  await writeFixtureFile(rootDir, 'VERSION', '1.2.3\n');
  await writeFixtureFile(rootDir, 'README.md', '# README\n');
  await writeFixtureFile(rootDir, 'README-zh.md', '# README-ZH\n');
  await writeFixtureFile(rootDir, 'skills-lock.json', '{}\n');
  await writeFixtureFile(rootDir, 'config/skills-catalog.json', '{"version":1,"skills":[]}\n');
  await writeFixtureFile(rootDir, 'mcp-server/package.json', '{"name":"fixture-mcp"}\n');
  await writeFixtureFile(rootDir, 'memory/README.md', '# memory\n');
  await writeFixtureFile(rootDir, 'skill-sources/sample-skill/SKILL.md', '# canonical\n');
  await writeFixtureFile(rootDir, '.codex/skills/sample-skill/SKILL.md', '# codex\n');
  await writeFixtureFile(rootDir, '.codex/agents/rex.md', '# codex agent\n');
  await writeFixtureFile(rootDir, '.claude/skills/sample-skill/SKILL.md', '# claude\n');
  await writeFixtureFile(rootDir, '.claude/agents/rex.md', '# claude agent\n');
  await writeFixtureFile(rootDir, '.agents/skills/sample-skill/SKILL.md', '# agents\n');

  await writeFixtureFile(rootDir, 'scripts/package-release.sh', await readFile(path.join(workspaceRoot, 'scripts', 'package-release.sh'), 'utf8'));
  await writeFixtureFile(rootDir, 'scripts/package-release.ps1', await readFile(path.join(workspaceRoot, 'scripts', 'package-release.ps1'), 'utf8'));
  await writeFixtureFile(rootDir, 'scripts/release-preflight.sh', await readFile(path.join(workspaceRoot, 'scripts', 'release-preflight.sh'), 'utf8'));
  await writeFixtureFile(rootDir, 'scripts/release-stable.sh', await readFile(path.join(workspaceRoot, 'scripts', 'release-stable.sh'), 'utf8'));
  await writeFixtureFile(rootDir, 'scripts/aios-install.sh', '#!/usr/bin/env bash\n');
  await writeFixtureFile(rootDir, 'scripts/aios-install.ps1', "Write-Host 'fixture'\n");
  await writeFixtureFile(rootDir, 'scripts/check-skills-sync.mjs', checkSkillsSyncScript);

  assertOk(run('git', ['init'], { cwd: rootDir }), 'git init failed');
  assertOk(run('git', ['config', 'user.email', 'fixture@example.com'], { cwd: rootDir }));
  assertOk(run('git', ['config', 'user.name', 'Fixture'], { cwd: rootDir }));
  assertOk(run('git', ['add', '-A'], { cwd: rootDir }));
  assertOk(run('git', ['commit', '-m', 'fixture'], { cwd: rootDir }));
}

test('package-release.sh emits stable assets that include skill-sources', async () => {
  const rootDir = await makeTemp('rex-release-assets-fixture-');
  await seedFixtureRepo(rootDir);

  const outDir = await makeTemp('rex-release-assets-out-');
  const result = run('bash', ['scripts/package-release.sh', '--out', outDir], {
    cwd: rootDir,
  });

  assertOk(result);

  for (const fileName of ['aios-install.sh', 'aios-install.ps1', 'rex-cli.tar.gz', 'rex-cli.zip']) {
    const filePath = path.join(outDir, fileName);
    assertOk(run('test', ['-f', filePath]), `${fileName} was not produced`);
  }

  const extractDir = await makeTemp('rex-release-assets-extract-');
  assertOk(run('tar', ['-xzf', path.join(outDir, 'rex-cli.tar.gz'), '-C', extractDir]));
  assertOk(
    run('test', ['-f', path.join(extractDir, 'rex-cli', 'skill-sources', 'sample-skill', 'SKILL.md')]),
    'rex-cli.tar.gz did not include skill-sources/sample-skill/SKILL.md'
  );
});

test('release-preflight.sh validates matching tag, VERSION, changelog, and skills sync state', async () => {
  const passingRoot = await makeTemp('rex-release-preflight-pass-');
  await seedFixtureRepo(passingRoot, {
    checkSkillsSyncScript: "console.log('[ok] skills sync clean');\nprocess.exit(0);\n",
  });

  const ok = run('bash', ['scripts/release-preflight.sh', '--tag', 'v1.2.3'], {
    cwd: passingRoot,
  });
  assertOk(ok);
  assert.match(ok.stdout, /SKILLS:\s+generated roots match skill-sources\//);

  const failingRoot = await makeTemp('rex-release-preflight-fail-');
  await seedFixtureRepo(failingRoot, {
    checkSkillsSyncScript: "console.error('[drift] .claude/skills/sample-skill');\nprocess.exit(1);\n",
  });

  const drift = run('bash', ['scripts/release-preflight.sh', '--tag', 'v1.2.3'], {
    cwd: failingRoot,
  });
  assert.notEqual(drift.status, 0);
  assert.match(`${drift.stderr}\n${drift.stdout}`, /skills sync drift detected/i);
});

test('release-stable.sh dry-run prints the exact tag from VERSION', () => {
  const result = run('bash', ['scripts/release-stable.sh', '--dry-run', '--allow-dirty'], {
    cwd: process.cwd(),
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Tag:\s+v\d+\.\d+\.\d+/);
  assert.match(result.stdout, /git tag v\d+\.\d+\.\d+/);
});
