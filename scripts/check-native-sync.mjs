#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkNativeEnhancementsSync } from './lib/native/doctor.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await checkNativeEnhancementsSync({ rootDir, client: 'all' });

if (!result.ok) {
  for (const issue of result.issues) {
    console.error(issue);
  }
  process.exitCode = 1;
} else {
  console.log('[ok] native sync clean');
}
