#!/usr/bin/env node
import path from 'node:path';

import { writeMixedSummary } from './lib/rl-mixed-v1/contextdb-summary.mjs';
import { runMixedCampaign, runMixedEvaluation } from './lib/rl-mixed-v1/run-orchestrator.mjs';

function parseArgs(argv) {
  const [command = '--help', ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    flags[key] = rest[index + 1] && !rest[index + 1].startsWith('--') ? rest[++index] : true;
  }
  return { command, flags };
}

function printHelp() {
  console.log([
    'Usage: node scripts/rl-mixed-v1.mjs <command> [flags]',
    '',
    'Commands:',
    '  browser-only',
    '  orchestrator-only',
    '  mixed',
    '  mixed-resume',
    '  mixed-eval',
    '',
    'Flags:',
    '  --dry-run',
    '  --window <n>',
    '  --json-output <path>',
    '  --batch-count <n>',
    '  --initial-checkpoint <id>',
  ].join('\n'));
}

function resolveEnvironments(command) {
  if (command === 'browser-only') return ['browser'];
  if (command === 'orchestrator-only') return ['orchestrator'];
  return ['shell', 'browser', 'orchestrator'];
}

async function runCampaignCommand({ command, flags, rootDir }) {
  const mode = command === 'mixed-resume' ? 'mixed' : command;
  const result = await runMixedCampaign({
    rootDir,
    activeEnvironments: resolveEnvironments(command),
    batchTargetCount: Number(flags['batch-count'] || (flags['dry-run'] ? 1 : 3)),
    initialCheckpointId: flags['initial-checkpoint'] || 'ckpt-mixed-a',
    resume: command === 'mixed-resume',
    mode,
  });
  const runId = `rl-mixed-v1-${Date.now()}`;
  const summary = await writeMixedSummary({
    rootDir,
    runId,
    mode,
    result,
  });

  console.log(`mode=${command}`);
  console.log(`status=${result.status}`);
  console.log(`mixed_batch_count=${result.summary.mixed_batch_count}`);
  console.log(`summary_path=${summary.summaryPath}`);
}

async function main() {
  const rootDir = process.cwd();
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === '--help' || command === 'help') {
    printHelp();
    return;
  }

  if (['browser-only', 'orchestrator-only', 'mixed', 'mixed-resume'].includes(command)) {
    await runCampaignCommand({ command, flags, rootDir });
    return;
  }

  if (command === 'mixed-eval') {
    const result = await runMixedEvaluation({
      rootDir,
      window: Number(flags.window || 30),
      jsonOutput: flags['json-output'] || '',
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});

