#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { generateBenchmark } from './lib/rl-shell-v1/task-registry.mjs';
import { runTrainingRun, runCampaign, runPhase3Campaign, runRealShadowEval } from './lib/rl-shell-v1/run-orchestrator.mjs';
import { loadPolicyCheckpoint } from './lib/rl-shell-v1/student-policy.mjs';
import { loadTaskRegistry } from './lib/rl-shell-v1/task-registry.mjs';
import { evaluatePhase3Run, runHeldOutEval } from './lib/rl-shell-v1/eval-harness.mjs';
import { buildRunSummaryPayload, writeRunSummary } from './lib/rl-shell-v1/contextdb-summary.mjs';

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

function createPhase3EpisodeSource({ monitorPattern }) {
  const outcomes = Array.isArray(monitorPattern) && monitorPattern.length > 0
    ? monitorPattern
    : ['better', 'same', 'better', 'same'];
  return async function nextEpisode({ taskIndex, currentEpoch }) {
    if (currentEpoch.phase === 'collection') {
      return {
        episode_id: `collect-${taskIndex + 1}`,
        admission_status: 'admitted',
      };
    }
    return {
      episode_id: `monitor-${taskIndex + 1}`,
      admission_status: 'admitted',
      comparison_status: 'completed',
      relative_outcome: outcomes[taskIndex % outcomes.length],
    };
  };
}

function printUsage() {
  console.error([
    'Usage: node scripts/rl-shell-v1.mjs <command> [flags]',
    '',
    'Commands:',
    '  benchmark-generate',
    '  train',
    '  eval',
    '  campaign',
    '  phase3-train',
    '  phase3-eval',
    '  phase3-resume',
    '',
    'Common flags:',
    '  --config <path>',
    '  --seed <n>',
    '  --teacher <backend>',
    '  --phase <name>',
    '  --resume',
    '  --max-tasks <n>',
    '  --initial-checkpoint <id>',
  ].join('\n'));
}

async function runPhase3OperatorCommand({ rootDir, config, flags, resume = false }) {
  const maxTasks = Number(flags['max-tasks'] || config.maxTasks || 5);
  const initialCheckpointId = flags['initial-checkpoint'] || config.initial_checkpoint_id || 'ckpt-a';
  const monitorPattern = String(flags['monitor-pattern'] || config.phase3_monitor_pattern || 'better,same,better,same')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const result = await runPhase3Campaign({
    config: {
      rootDir,
      maxTasks,
      initialCheckpointId,
      onlineBatchSize: Number(flags['online-batch-size'] || config.onlineBatchSize || 4),
      rollbackThreshold: Number(flags['rollback-threshold'] || config.rollbackThreshold || 3),
      resume,
    },
    deps: {
      nextEpisode: createPhase3EpisodeSource({ monitorPattern }),
      runOnlineUpdateBatch: async ({ checkpointId }) => ({
        status: 'ok',
        checkpointId,
        nextCheckpointId: `${checkpointId}-u1`,
      }),
    },
  });

  const phase3Metrics = {
    better_count: result.betterCount,
    same_count: result.sameCount,
    worse_count: result.worseCount,
    comparison_failed_count: result.comparisonFailedCount,
    teacher_shaping_alignment_rate: 0,
  };
  const summary = buildRunSummaryPayload({
    run: {
      runId: `phase3-${Date.now()}`,
      studentModelId: 'tiny-json-policy-v1',
      bestCheckpointPath: `experiments/rl-shell-v1/checkpoints/${result.activeCheckpointId}.json`,
      status: result.controlState.mode === 'frozen_failure' ? 'blocked' : 'ok',
    },
    metrics: phase3Metrics,
    config: {
      teacher_backend_requested: config.teacher_backend_requested,
      fallback_order: config.fallback_order || [],
      seed_results: [{ seed: Number(flags.seed || 17), status: result.status }],
      phase: '3',
      updates_completed: result.updatesCompleted,
      updates_failed: result.updatesFailed,
      rollbacks_completed: result.rollbacksCompleted,
      replay_only_epochs: result.replayOnlyEpochs,
      comparison_failed_count: result.comparisonFailedCount,
      active_checkpoint_id: result.activeCheckpointId,
      pre_update_ref_checkpoint_id: result.preUpdateRefCheckpointId,
      last_stable_checkpoint_id: result.lastStableCheckpointId,
    },
  });
  const summaryResult = await writeRunSummary({
    rootDir,
    summary,
    sessionId: config.sessionId || '',
  });

  console.log('phase=3');
  console.log(`mode=${resume ? 'resume' : 'train'}`);
  console.log(`status=${result.controlState.mode === 'frozen_failure' ? 'frozen_failure' : result.status}`);
  console.log(`updates_completed=${result.updatesCompleted}`);
  console.log(`updates_failed=${result.updatesFailed}`);
  console.log(`rollbacks_completed=${result.rollbacksCompleted}`);
  console.log(`replay_only_epochs=${result.replayOnlyEpochs}`);
  console.log(`better_count=${result.betterCount}`);
  console.log(`same_count=${result.sameCount}`);
  console.log(`worse_count=${result.worseCount}`);
  console.log(`comparison_failed_count=${result.comparisonFailedCount}`);
  console.log(`active_checkpoint=${result.activeCheckpointId}`);
  console.log(`last_stable_checkpoint=${result.lastStableCheckpointId}`);
  console.log(`summary_path=${summaryResult.summaryPath}`);
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
    if (config.phase === '2B') {
      const result = await runRealShadowEval({ config });
      console.log(`pool_status=${result.pool_status}`);
      console.log(`admitted_tasks=${result.admitted_tasks}`);
      console.log(`repeated_repair_rate=${result.repeatability.repeatedRepairRate}`);
      console.log(`stable_repair_count=${result.repeatability.stableRepairCount}`);
      console.log(`main_worktree_contamination_failures=${result.repeatability.mainWorktreeContaminationFailures}`);
      console.log(`shadow_artifact=${result.shadowArtifactPath}`);
      return;
    }
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
    console.log(`phase=${config.phase}`);
    console.log(`campaign_id=${result.campaignId}`);
    console.log(`status=${result.status}`);
    for (const seedResult of result.seedResults) {
      console.log(`seed=${seedResult.seed} held_out_success_rate=${seedResult.successRate}`);
    }
    if (result.realRepeatedRepairRate !== undefined) {
      console.log(`real_repeated_repair_rate=${result.realRepeatedRepairRate}`);
    }
    if (result.replayPoolStatus !== undefined) {
      console.log(`replay_pool_status=${result.replayPoolStatus}`);
    }
    if (result.replayMix) {
      console.log(`replay_mix_real=${result.replayMix.realShadow}`);
      console.log(`replay_mix_synthetic=${result.replayMix.synthetic}`);
    }
    if (result.bestRun) {
      console.log(`best_checkpoint=${result.bestRun.bestCheckpointPath}`);
    }
    console.log(`campaign_artifact=${result.campaignArtifactPath}`);
    return;
  }

  if (command === 'phase3-train' || command === 'phase3-resume') {
    const config = await loadConfig(rootDir, flags.config || 'experiments/rl-shell-v1/configs/benchmark-v1.json', flags.teacher, '3');
    await runPhase3OperatorCommand({
      rootDir,
      config,
      flags,
      resume: command === 'phase3-resume' || Boolean(flags.resume),
    });
    return;
  }

  if (command === 'phase3-eval') {
    const summaryPath = flags.summary ? path.join(rootDir, flags.summary) : null;
    const runSummary = summaryPath ? JSON.parse(await readFile(summaryPath, 'utf8')) : {};
    const runDir = flags['run-dir'] ? path.join(rootDir, flags['run-dir']) : undefined;
    const result = await evaluatePhase3Run({ runDir, runSummary });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
