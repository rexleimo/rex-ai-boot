import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { writeFileAtomic } from '../lib/fs/atomic-write.mjs';

test('writeFileAtomic replaces content without leaving temp files behind', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-atomic-write-'));
  const filePath = path.join(rootDir, 'memory', 'specs', 'orchestrator-agents.json');

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, '{"before":true}\n', 'utf8');
  await writeFileAtomic(filePath, '{"after":true}\n');

  assert.equal(await readFile(filePath, 'utf8'), '{"after":true}\n');
});
