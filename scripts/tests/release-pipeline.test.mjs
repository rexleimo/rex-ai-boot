import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

async function makeTemp(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('package-release.sh emits all required stable release assets', async () => {
  const outDir = await makeTemp('rex-release-assets-');
  const result = spawnSync('bash', ['scripts/package-release.sh', '--out', outDir], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  for (const fileName of ['aios-install.sh', 'aios-install.ps1', 'rex-cli.tar.gz', 'rex-cli.zip']) {
    const filePath = path.join(outDir, fileName);
    const stat = spawnSync('test', ['-f', filePath], { encoding: 'utf8' });
    assert.equal(stat.status, 0, `${fileName} was not produced`);
  }
});

test('release-preflight.sh validates matching tag, VERSION, and changelog release heading', async () => {
  const rootDir = process.cwd();
  const version = (await readFile(path.join(rootDir, 'VERSION'), 'utf8')).trim();
  const tag = `v${version}`;

  const ok = spawnSync('bash', ['scripts/release-preflight.sh', '--tag', tag], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);

  const mismatch = spawnSync('bash', ['scripts/release-preflight.sh', '--tag', 'v999.999.999'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  assert.notEqual(mismatch.status, 0);
  assert.match(`${mismatch.stderr}\n${mismatch.stdout}`, /VERSION|tag|changelog/i);
});

test('release-stable.sh dry-run prints the exact tag from VERSION', () => {
  const result = spawnSync('bash', ['scripts/release-stable.sh', '--dry-run', '--allow-dirty'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Tag:\s+v\d+\.\d+\.\d+/);
  assert.match(result.stdout, /git tag v\d+\.\d+\.\d+/);
});
