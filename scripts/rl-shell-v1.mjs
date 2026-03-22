#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { generateBenchmark } from './lib/rl-shell-v1/task-registry.mjs';
import { runTrainingRun, runCampaign } from './lib/rl-shell-v1/run-orchestrator.mjs';
import { loadPolicyCheckpoint } from './lib/rl-shell-v1/student-policy.mjs';
import { loadTaskRegistry } from './lib/rl-shell-v1/task-registry.mjs';
import { runHeldOutEval } from './lib/rl-shell-v1/eval-harness.mjs';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    flags[key] = rest[index + 1] && !rest[index + 1].startsWith('--') ? rest[++index] : true;
  }
  return { command, flags };
}

async function loadConfig(rootDir, configPath, teacher, phase) {
  const absolutePath = path.join(rootDir, configPath);
  const raw = JSON.parse(await readFile(absolutePath, 'utf8'));
  return {
    ...raw,
    rootDir,
    configPath,
    phase: phase || raw.phase || 'v1',
    teacher_backend_requested: teacher || raw.teacher_backend_requested || '',
    fallback_order: raw.fallback_order || ['claude-code'],
  };
}

async function main() {
  const rootDir = process.cwd();
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === 'benchmark-generate') {
    const result = await generateBenchmark({
      rootDir,
      configPath: flags.config || 'experiments/rl-shell-v1/configs/benchmark-v1.json',
      seed: Number(flags.seed || 17),
    });
    console.log(`generated=${result.generatedTasks.length}`);
    console.log(`train=${result.trainTasks.length}`);
    console.log(`held_out=${result.heldOutTasks.length}`);
    return;
  }

  if (command === 'train') {
    const config = await loadConfig(rootDir, flags.config || 'experiments/rl-shell-v1/configs/benchmark-v1.json', flags.teacher, flags.phase);
    const result = await runTrainingRun({
      config,
      seed: Number(flags.seed || 17),
    });
    console.log(`phase=${config.phase}`);
    console.log(`run_id=${result.runId}`);
    console.log(`status=${result.status}`);
    console.log(`summary_path=${result.summaryPath}`);
    console.log(`best_checkpoint=${result.bestCheckpointPath}`);
    return;
  }

  if (command === 'eval') {
    const configPath = flags.config || 'experiments/rl-shell-v1/configs/benchmark-v1.json';
    const config = await loadConfig(rootDir, configPath, flags.teacher, flags.phase);
    const checkpoint = await loadPolicyCheckpoint(flags.checkpoint);
    const registry = await loadTaskRegistry({ rootDir, configPath });
    const result = await runHeldOutEval({
      checkpoint,
      registry,
      policyFactory: (policy) => policy,
      teacherMode: 'none',
    });
    console.log(JSON.stringify(result.summary, null, 2));
    return;
  }

  if (command === 'campaign') {
    const config = await loadConfig(rootDir, flags.config || 'experiments/rl-shell-v1/configs/benchmark-v1.json', flags.teacher, flags.phase);
    const result = await runCampaign({ config });
    console.log(`campaign_id=${result.campaignId}`);
    console.log(`status=${result.status}`);
    for (const seedResult of result.seedResults) {
      console.log(`seed=${seedResult.seed} held_out_success_rate=${seedResult.successRate}`);
    }
    if (result.bestRun) {
      console.log(`best_checkpoint=${result.bestRun.bestCheckpointPath}`);
    }
    console.log(`campaign_artifact=${result.campaignArtifactPath}`);
    return;
  }

  console.error('Usage: node scripts/rl-shell-v1.mjs <benchmark-generate|train|eval|campaign> [--config path] [--seed N] [--teacher backend] [--phase 2A]');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
