#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncGeneratedAgents } from './lib/harness/orchestrator-agents.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const result = await syncGeneratedAgents({ rootDir, io: console });
  const totals = result.results.reduce(
    (acc, item) => ({
      installed: acc.installed + item.installed,
      updated: acc.updated + item.updated,
      skipped: acc.skipped + item.skipped,
      removed: acc.removed + item.removed,
    }),
    { installed: 0, updated: 0, skipped: 0, removed: 0 }
  );

  console.log('[agents] sync complete');
  console.log(JSON.stringify({ ok: result.ok, targets: result.targets, totals, results: result.results }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

