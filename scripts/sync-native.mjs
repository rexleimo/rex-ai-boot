#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncNativeEnhancements } from './lib/native/sync.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = await syncNativeEnhancements({ rootDir, io: console });
for (const item of result.results) {
  console.log(`[done] native ${item.client} -> installed=${item.installed} updated=${item.updated} reused=${item.reused} removed=${item.removed}`);
}
