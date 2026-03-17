#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkGeneratedSkillsSync } from './lib/skills/sync.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await checkGeneratedSkillsSync({ rootDir, io: console });
if (!result.ok) {
  process.exitCode = 1;
}
