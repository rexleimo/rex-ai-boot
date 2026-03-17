#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncGeneratedSkills } from './lib/skills/sync.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = await syncGeneratedSkills({ rootDir, io: console });
for (const item of result.results) {
  console.log(`[done] skills ${item.surface} -> installed=${item.installed} updated=${item.updated} reused=${item.reused} skipped=${item.skipped} removed=${item.removed}`);
}
