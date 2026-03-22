import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadTaskRegistry, sampleTrainingTask } from './task-registry.mjs';
import { createStudentPolicy } from './student-policy.mjs';
import { buildStudentFeatureKey, requestStudentAction } from './student-runner.mjs';
import { computeTerminalReward, fuseReward } from './reward-fusion.mjs';
import { applyPpoUpdate, buildMixedReplayBatch, createReferencePolicyFrom, createTrainerConfig, maybeRefreshReferencePolicy, runOnlineUpdateBatch } from './trainer.mjs';
import { appendMetrics, createRunLayout, persistEpisode, writeCheckpointMetadata } from './trajectory-store.mjs';
import { runHeldOutEval, pickBestCheckpoint, summarizeRealShadowEval } from './eval-harness.mjs';
import { buildRunSummaryPayload, writeRunSummary } from './contextdb-summary.mjs';
import {
  createDefaultExecutionPolicy,
  createEpisodeWorkspace,
  destroyEpisodeWorkspace,
  executeAction,
  getStopConditionCandidate,
  runBaselineFailureCheck,
  runVerification,
} from './temp-runner.mjs';
import { collectRealTasks } from './real-task-registry.mjs';
import { createEpisodeWorktree, destroyEpisodeWorktree } from './worktree-runner.mjs';
import { loadReplayPool } from './replay-pool.mjs';
import { createControlStateStore, applyControlEvent, readControlSnapshot, writeControlSnapshot } from './control-state-store.mjs';
import { applyPointerTransition } from './active-checkpoint-registry.mjs';
import { recordComparisonResults, reopenEpoch, seedEpoch } from './epoch-ledger.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createTeacherFailureResponse(backend) {
  return {
    backend_used: backend,
    call_status: 'failed_all_backends',
    latency_ms: 0,
    critique: null,
    reference_solution: null,
    shaping_score: 0,
    confidence: 0,
  };
}

function dedupe(items) {
  return [...new Set(items.filter(Boolean))];
}

function formatSequenceId(prefix, value) {
  return `${prefix}-${String(value).padStart(3, '0')}`;
}

function buildPhase3PointerState(controlState, initialCheckpointId) {
  return {
    active_checkpoint_id: controlState.active_checkpoint_id || initialCheckpointId,
    pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id ?? null,
    last_stable_checkpoint_id: controlState.last_stable_checkpoint_id || initialCheckpointId,
  };
}

function buildPhase3Epoch({ epochNumber, phase, controlState, initialCheckpointId }) {
  return seedEpoch({
    update_epoch_id: formatSequenceId('epoch', epochNumber),
    phase,
    active_checkpoint_id: controlState.active_checkpoint_id || initialCheckpointId,
    pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id ?? null,
    admitted_trajectory_ids: [],
    comparison_results: [],
    completed_comparison_count: 0,
    comparison_failed_count: 0,
    degradation_streak: 0,
    close_reason: null,
    promotion_eligible: false,
  });
}

function getRelativeOutcomeStreak(results) {
  let streak = 0;
  for (const result of results) {
    if (result.comparison_status !== 'completed') {
      continue;
    }
    if (result.relative_outcome === 'better') {
      streak = 0;
      continue;
    }
    if (result.relative_outcome === 'worse') {
      streak += 1;
    }
  }
  return streak;
}

function buildEpisodeRecord({
  runId,
  task,
  seed,
  startedAt,
  endedAt,
  studentSteps,
  baseline,
  verification,
  rewardParts,
  teacherResponse,
  trainerMetrics = {},
  stopCondition,
  stopReason,
  executionPolicy,
}) {
  const success = rewardParts.terminalReward > 0;
  const commandsExecuted = [];
  const filesRead = [];
  const filesTouched = [];
  const patchApplyResults = [];
  const runtimeFailures = [];
  let timeoutFlag = false;

  for (const step of studentSteps) {
    const action = step.parsed_action;
    const observation = step.observation_event;
    if (action?.action === 'run' && action.command) {
      commandsExecuted.push(action.command);
    }
    if (action?.action === 'read' && action.path) {
      filesRead.push(action.path);
    }
    if (Array.isArray(observation?.payload?.files_touched)) {
      filesTouched.push(...observation.payload.files_touched);
    }
    if (action?.action === 'patch') {
      patchApplyResults.push({
        applied: observation?.payload?.applied === true,
        reject_reason: observation?.payload?.reject_reason ?? null,
      });
      if (Array.isArray(observation?.payload?.files_touched)) {
        filesTouched.push(...observation.payload.files_touched);
      }
    }
    if (observation?.status === 'timeout') {
      timeoutFlag = true;
      runtimeFailures.push('command_timeout');
    } else if (observation?.status === 'error' && observation?.error_code) {
      runtimeFailures.push(observation.error_code);
    } else if (observation?.status === 'rejected' && observation?.error_code) {
      runtimeFailures.push(observation.error_code);
    }
  }

  const finalDiff = studentSteps
    .filter((step) => step.parsed_action?.action === 'patch')
    .map((step) => step.parsed_action.diff || '')
    .join('\n');

  const finalObservation = verification.observation;
  const replayPriority = success ? 0.7 : verification.tests_after.length < baseline.failingTests.length ? 0.5 : 0.3;
  return {
    episode_id: `${runId}-episode-001`,
    run_id: runId,
    task_id: task.task_id,
    task_source: 'synthetic',
    split: task.split,
    repo_snapshot_id: task.repo_snapshot_id,
    student_model_id: 'tiny-json-policy-v1',
    teacher_backend_requested: teacherResponse.backend_used,
    teacher_backend_used: teacherResponse.backend_used,
    attempt_id: null,
    update_epoch_id: formatSequenceId('epoch', 1),
    batch_id: formatSequenceId('batch', 1),
    pre_update_ref_checkpoint_id: null,
    seed,
    start_ts: startedAt.toISOString(),
    end_ts: endedAt.toISOString(),
    status: timeoutFlag ? 'timeout' : success ? 'success' : 'failed',
    task_prompt: task.task_prompt,
    constraints: task.constraints,
    baseline_failing_tests: baseline.failingTests,
    baseline_reproduced: baseline.reproduced,
    student_steps: studentSteps,
    commands_executed: dedupe(commandsExecuted),
    files_read: dedupe(filesRead),
    files_touched: dedupe(filesTouched),
    patch_apply_results: patchApplyResults,
    verification_executed: true,
    verification_passed: verification.verification_status === 'ok',
    stdout_summary: finalObservation.payload?.stdout_excerpt || '',
    stderr_summary: finalObservation.payload?.stderr_excerpt || '',
    final_diff: finalDiff,
    tests_before: baseline.failingTests,
    tests_after: verification.tests_after,
    runtime_failures: dedupe(runtimeFailures),
    timeout_flag: timeoutFlag,
    stop_reason: stopReason,
    stop_condition: stopCondition,
    no_progress_window: Number(executionPolicy.no_progress_window || 3),
    teacher_call_status: teacherResponse.call_status,
    teacher_latency_ms: teacherResponse.latency_ms,
    teacher_confidence: teacherResponse.confidence,
    teacher_critique: teacherResponse.critique,
    teacher_reference_solution: teacherResponse.reference_solution,
    teacher_shaping_score: teacherResponse.shaping_score,
    distillation_status: teacherResponse.reference_solution ? 'applied' : 'skipped',
    distillation_skip_reason: teacherResponse.reference_solution ? null : 'teacher_unavailable',
    terminal_reward: rewardParts.terminalReward,
    teacher_term: rewardParts.teacherTerm,
    fused_reward: rewardParts.fusedReward,
    advantage: Number(trainerMetrics.advantage || 0),
    return: Number(trainerMetrics.return || 0),
    comparison_status: 'completed',
    relative_outcome: success ? 'better' : 'same',
    rollback_batch: false,
    admission_status: 'admitted',
    admission_reason: null,
    replay_eligible: baseline.reproduced && stopCondition !== 'unsafe_runner_state',
    replay_priority: replayPriority,
    replay_route: success ? 'positive' : 'neutral',
    policy_loss: Number(trainerMetrics.policy_loss || 0),
    distill_loss: Number(trainerMetrics.distill_loss || 0),
    kl_loss: Number(trainerMetrics.kl_loss || 0),
    stdout_artifact_path: 'artifacts/stdout.log',
    stderr_artifact_path: 'artifacts/stderr.log',
    final_diff_artifact_path: 'artifacts/final.patch',
    observation_trace_artifact_path: 'artifacts/trace.json',
  };
}

export function createRunId({ seed }) {
  return `rl-shell-v1-s${seed}-${Date.now()}`;
}

export function shouldStopRun({ episodesCompleted, updatesCompleted, config }) {
  return episodesCompleted >= Number(config.maxEpisodesPerRun || 1) || updatesCompleted >= Number(config.maxUpdatesPerRun || 1);
}

export async function runTrainingRun({ config, seed, deps = {} }) {
  if (!config.teacher_backend_requested) {
    throw new Error('teacher_backend_requested is required');
  }

  const rootDir = config.rootDir || process.cwd();
  const requestAction = deps.requestStudentAction || requestStudentAction;
  const trainerUpdater = deps.trainerUpdater || applyPpoUpdate;
  const heldOutEvaluator = deps.heldOutEvaluator || runHeldOutEval;
  const summaryWriter = deps.summaryWriter || writeRunSummary;
  const taskSampler = deps.taskSampler || sampleTrainingTask;
  const persistEpisodeFn = deps.persistEpisode || persistEpisode;
  const appendMetricsFn = deps.appendMetrics || appendMetrics;
  const createWorkspace = deps.createWorkspace || createEpisodeWorkspace;
  const destroyWorkspace = deps.destroyWorkspace || destroyEpisodeWorkspace;
  const executeEpisodeAction = deps.executeAction || executeAction;
  const runBaselineCheck = deps.runBaselineCheck || runBaselineFailureCheck;
  const runFinalVerification = deps.runVerification || runVerification;
  const stopConditionResolver = deps.getStopConditionCandidate || getStopConditionCandidate;
  const registryLoader = deps.registryLoader || (async () => await loadTaskRegistry({
    rootDir,
    configPath: config.configPath || 'experiments/rl-shell-v1/configs/benchmark-v1.json',
  }));
  const registry = await registryLoader({ seed, rootDir, config });
  if (registry?.valid === false) {
    return { status: registry.reason || 'invalid-registry', seed };
  }

  const runId = createRunId({ seed });
  const runDir = await createRunLayout({
    rootDir: path.join(rootDir, 'experiments', 'rl-shell-v1'),
    runId,
  });

  const task = taskSampler(registry, { seed, attempt: 0 });
  const policy = deps.policyFactory ? await deps.policyFactory({ seed, config }) : createStudentPolicy({ seed });
  let referencePolicy = createReferencePolicyFrom(policy);
  const executionPolicy = {
    ...createDefaultExecutionPolicy(),
    ...Object.fromEntries(
      Object.entries(config).filter(([key]) =>
        ['max_steps_per_episode', 'max_command_seconds', 'max_episode_seconds', 'max_output_bytes_per_stream', 'no_progress_window'].includes(key)
      )
    ),
  };

  const startedAt = new Date();
  const workspace = await createWorkspace({ taskManifest: task, rootDir });
  let baseline;
  let verification;
  let studentSteps = [];
  let stopCondition = 'unsafe_runner_state';
  let stopReason = 'unsafe_runner_state';

  try {
    baseline = await runBaselineCheck({
      workspace,
      verificationCommand: task.verification_command,
      policy: executionPolicy,
    });

    const trace = [{
      task_prompt: task.task_prompt,
      baseline_failing_tests: baseline.failingTests,
    }];
    const maxSteps = Number(config.max_steps_per_episode || executionPolicy.max_steps_per_episode);

    while (studentSteps.length < maxSteps) {
      const studentAction = await requestAction({
        policy,
        trace,
        budget: { remainingSteps: maxSteps - studentSteps.length },
      });
      const parsedAction = studentAction.parsedAction || { action: 'stop', message: 'parse_failed' };
      const observationEvent = await executeEpisodeAction({
        workspace,
        action: parsedAction,
        policy: executionPolicy,
      });

      studentSteps.push({
        step_index: studentSteps.length + 1,
        prompt_excerpt: studentAction.promptExcerpt || task.task_prompt,
        raw_output_text: studentAction.rawOutputText,
        token_ids: studentAction.tokenIds,
        token_logprobs: studentAction.tokenLogprobs,
        parsed_action: parsedAction,
        observation_event: observationEvent,
        feature_key: studentAction.featureKey,
      });
      trace.push({ observation_event: observationEvent });

      const stopCandidate = stopConditionResolver({ workspace, policy: executionPolicy });
      if (stopCandidate) {
        stopCondition = stopCandidate;
        stopReason = stopCandidate;
        break;
      }
      if (parsedAction.action === 'stop') {
        stopCondition = 'student_stop';
        stopReason = studentAction.stopReason || 'student_stop';
        break;
      }
    }

    if (!stopCondition || stopCondition === 'unsafe_runner_state') {
      stopCondition = studentSteps.length >= Number(config.max_steps_per_episode || executionPolicy.max_steps_per_episode)
        ? 'max_steps_reached'
        : stopCondition;
      stopReason = stopCondition === 'max_steps_reached' ? 'budget_exhausted' : stopReason;
    }

    verification = await runFinalVerification({
      workspace,
      verificationCommand: task.verification_command,
      policy: {
        ...executionPolicy,
        max_steps_per_episode: Number(executionPolicy.max_steps_per_episode || 0) + 1,
      },
    });
    if (verification.verification_status === 'ok') {
      stopCondition = 'verification_passed';
      stopReason = 'verification_passed';
    }
  } finally {
    await destroyWorkspace(workspace);
  }

  const terminalReward = computeTerminalReward({
    baselineFailures: baseline.failingTests,
    finalFailures: verification.tests_after,
    newFailures: verification.new_failures,
    verificationStatus: verification.verification_status,
  });

  const teacherResponse = deps.teacherCaller
    ? await deps.teacherCaller({ task, studentSteps, verification, seed, config })
    : createTeacherFailureResponse(config.teacher_backend_requested);

  const rewardParts = {
    terminalReward,
    ...fuseReward({
      terminalReward,
      shapingScore: teacherResponse.shaping_score,
      callStatus: teacherResponse.call_status,
    }),
  };

  const placeholderMetrics = {
    advantage: 0,
    return: 0,
    policy_loss: 0,
    distill_loss: 0,
    kl_loss: 0,
  };
  const episode = buildEpisodeRecord({
    runId,
    task,
    seed,
    startedAt,
    endedAt: new Date(),
    studentSteps: studentSteps.map((step) => ({
      step_index: step.step_index,
      prompt_excerpt: step.prompt_excerpt,
      raw_output_text: step.raw_output_text,
      token_ids: step.token_ids,
      token_logprobs: step.token_logprobs,
      parsed_action: step.parsed_action,
      observation_event: step.observation_event,
    })),
    baseline,
    verification,
    rewardParts,
    teacherResponse,
    trainerMetrics: placeholderMetrics,
    stopCondition,
    stopReason,
    executionPolicy,
  });
  const persistedEpisode = await persistEpisodeFn({ runDir, episode });

  const trainerConfig = createTrainerConfig();
  const trainerResult = trainerUpdater({
    policy,
    referencePolicy,
    trajectory: {
      featureKey: buildStudentFeatureKey({ trace: [{ task_prompt: task.task_prompt, baseline_failing_tests: baseline.failingTests }] }),
      stepFeatureKeys: studentSteps.map((step) => step.feature_key || 'default'),
      stepTokenIds: studentSteps.map((step) => step.token_ids),
      tokenIds: studentSteps.flatMap((step) => step.token_ids),
      rewards: studentSteps.map((_, index) => (index === studentSteps.length - 1 ? rewardParts.fusedReward : 0)),
      distillationStatus: teacherResponse.reference_solution ? 'applied' : 'skipped',
      teacherTokenIds: [],
    },
    config: trainerConfig,
  });
  referencePolicy = maybeRefreshReferencePolicy({
    policy,
    referencePolicy,
    updateCount: policy.updateCount,
    config: trainerConfig,
  });
  const replayPool = deps.replayPool || (config.phase === '2C' ? await loadReplayPool({ rootDir }) : null);
  const replayBatch = replayPool
    ? buildMixedReplayBatch({
        pool: replayPool,
        batchSize: Number(config.replayBatchSize || 5),
      })
    : { realShadow: [], synthetic: [], effectiveRealRatio: 0 };

  await appendMetricsFn({
    runDir,
    metric: {
      step: policy.updateCount,
      reward: rewardParts.fusedReward,
      terminal_reward: rewardParts.terminalReward,
      step_count: studentSteps.length,
      stop_condition: stopCondition,
      episode_path: persistedEpisode.episodePath,
      replay_real_count: replayBatch.realShadow.length,
      replay_synthetic_count: replayBatch.synthetic.length,
    },
  });

  const checkpointPath = path.join(runDir.checkpointsDir, 'best', 'policy.json');
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(checkpointPath, `${JSON.stringify(clone(policy), null, 2)}\n`, 'utf8');
  await writeCheckpointMetadata({
    runDir,
    kind: 'best',
    metadata: { checkpointPath, seed, updateCount: policy.updateCount },
  });
  await writeCheckpointMetadata({
    runDir,
    kind: 'latest',
    metadata: { checkpointPath, seed, updateCount: policy.updateCount },
  });

  const heldOutEval = await heldOutEvaluator({
    checkpoint: policy,
    registry,
    policyFactory: (checkpoint) => checkpoint,
    teacherMode: 'none',
  });

  const summary = buildRunSummaryPayload({
    run: {
      runId,
      studentModelId: 'tiny-json-policy-v1',
      bestCheckpointPath: checkpointPath,
      status: 'ok',
    },
    metrics: heldOutEval.summary,
    config: {
      teacher_backend_requested: config.teacher_backend_requested,
      fallback_order: config.fallback_order || [],
      seed_results: [{ seed, status: 'ok', success_rate: heldOutEval.summary.successRate }],
    },
  });

  const summaryResult = await summaryWriter({
    rootDir,
    summary,
    sessionId: config.sessionId || '',
  });

  return {
    runId,
    seed,
    status: 'ok',
    runDir,
    summaryPath: summaryResult.summaryPath,
    bestCheckpointPath: checkpointPath,
    heldOutMetrics: heldOutEval.summary,
    referencePolicy,
    episodesCompleted: 1,
    updatesCompleted: Number(policy.updateCount || 0),
    replayBatch,
    lastEpisode: {
      ...episode,
      ...trainerResult.metrics,
      student_steps: episode.student_steps,
      advantage: trainerResult.metrics.advantage,
      return: trainerResult.metrics.return,
      replay_eligible: episode.replay_eligible,
      replay_priority: episode.replay_priority,
      stop_condition: episode.stop_condition,
    },
  };
}

async function runDefaultShadowAttempt({ rootDir, task, seed, attempt }) {
  const workspace = await createEpisodeWorktree({
    rootDir,
    runId: `shadow-s${seed}-a${attempt}`,
    taskId: task.task_id,
  });
  workspace.taskManifest = {
    baseline_failing_tests: task.baseline_failing_tests || [],
  };

  try {
    const verification = await runVerification({
      workspace,
      verificationCommand: task.verification_command,
      policy: {
        ...createDefaultExecutionPolicy(),
        max_steps_per_episode: Number(createDefaultExecutionPolicy().max_steps_per_episode || 0) + 1,
      },
    });
    return {
      task_id: task.task_id,
      seed,
      attempt,
      repaired: verification.verification_status === 'ok',
      contaminated_main_worktree: false,
      verification_status: verification.verification_status,
      tests_after: verification.tests_after,
    };
  } finally {
    await destroyEpisodeWorktree(workspace);
  }
}

export async function runRealShadowEval({ config, deps = {} }) {
  const rootDir = config.rootDir || process.cwd();
  const realTaskCollector = deps.realTaskCollector || (async () => await collectRealTasks({ rootDir }));
  const shadowAttemptRunner = deps.shadowAttemptRunner || runDefaultShadowAttempt;
  const seeds = Array.isArray(config.acceptanceSeeds) && config.acceptanceSeeds.length > 0
    ? config.acceptanceSeeds
    : [17, 29];
  const attemptsPerSeed = Number(config.shadowAttemptsPerSeed || 2);

  const taskPool = await realTaskCollector({ rootDir, config });
  const attemptResults = [];
  for (const task of taskPool.admitted || []) {
    for (const seed of seeds) {
      for (let attempt = 1; attempt <= attemptsPerSeed; attempt += 1) {
        attemptResults.push(await shadowAttemptRunner({ rootDir, task, seed, attempt, config }));
      }
    }
  }

  const repeatability = summarizeRealShadowEval({
    pool_status: taskPool.pool_status,
    admitted_tasks: taskPool.admitted_tasks,
    attempt_results: attemptResults,
  });

  const shadowDir = path.join(rootDir, 'experiments', 'rl-shell-v1', 'shadow-evals');
  await mkdir(shadowDir, { recursive: true });
  const shadowArtifactPath = path.join(shadowDir, `shadow-${Date.now()}.json`);
  await writeFile(shadowArtifactPath, `${JSON.stringify({
    pool_status: taskPool.pool_status,
    admitted_tasks: taskPool.admitted_tasks,
    attempt_results: attemptResults,
    repeatability,
  }, null, 2)}\n`, 'utf8');

  return {
    pool_status: taskPool.pool_status,
    admitted_tasks: taskPool.admitted_tasks,
    admitted: taskPool.admitted || [],
    attempt_results: attemptResults,
    repeatability,
    shadowArtifactPath,
  };
}

export async function runCampaign({ config, deps = {} }) {
  const rootDir = config.rootDir || process.cwd();
  const trainingRunner = deps.trainingRunner || runTrainingRun;
  const shadowEvalRunner = deps.shadowEvalRunner || runRealShadowEval;
  const replayPoolLoader = deps.replayPoolLoader || loadReplayPool;
  const registryLoader = deps.registryLoader || (async () => await loadTaskRegistry({
    rootDir,
    configPath: config.configPath || 'experiments/rl-shell-v1/configs/benchmark-v1.json',
  }));
  const registryGate = await registryLoader({ rootDir, config });
  if (registryGate?.valid === false) {
    return { status: registryGate.reason || 'invalid-registry' };
  }

  const seeds = Array.isArray(config.acceptanceSeeds) && config.acceptanceSeeds.length === 3
    ? config.acceptanceSeeds
    : [17, 29, 41];

  const seedResults = [];
  for (const seed of seeds) {
    const result = await trainingRunner({
      config,
      seed,
      deps: {
        ...deps,
        registryLoader: async () => registryGate,
      },
    });
    seedResults.push({
      seed,
      status: result.status,
      successRate: result.heldOutMetrics?.successRate || 0,
      regressionFreeFixRate: result.heldOutMetrics?.regressionFreeFixRate || 0,
      avgTokenCount: result.heldOutMetrics?.avgTokenCount || 0,
      bestCheckpointPath: result.bestCheckpointPath || '',
      runId: result.runId || '',
      summaryPath: result.summaryPath || '',
    });
  }

  const bestRun = pickBestCheckpoint(
    seedResults.map((row) => ({
      step: row.seed,
      successRate: row.successRate,
      regressionFreeFixRate: row.regressionFreeFixRate,
      avgTokenCount: row.avgTokenCount,
      bestCheckpointPath: row.bestCheckpointPath,
      runId: row.runId,
      summaryPath: row.summaryPath,
    }))
  );

  const campaignId = `campaign-${Date.now()}`;
  const campaignDir = path.join(rootDir, 'experiments', 'rl-shell-v1', 'campaigns');
  await mkdir(campaignDir, { recursive: true });
  const campaignArtifactPath = path.join(campaignDir, `${campaignId}.json`);
  const status = seedResults.some((row) => row.successRate >= 0.5) ? 'passed' : 'failed';
  let replayPoolStatus = undefined;
  let realRepeatedRepairRate = undefined;
  let replayMix = undefined;

  if (config.phase === '2C') {
    const shadowResult = await shadowEvalRunner({ config, deps });
    const replayPool = await replayPoolLoader({ rootDir });
    const replayBatch = buildMixedReplayBatch({
      pool: replayPool,
      batchSize: Number(config.replayBatchSize || 5),
    });
    replayPoolStatus = shadowResult.pool_status;
    realRepeatedRepairRate = shadowResult.repeatability.repeatedRepairRate;
    replayMix = {
      realShadow: replayBatch.realShadow.length,
      synthetic: replayBatch.synthetic.length,
    };
  }

  await writeFile(campaignArtifactPath, `${JSON.stringify({
    campaign_id: campaignId,
    phase: config.phase || 'v1',
    status,
    seed_results: seedResults,
    best_run: bestRun,
    replay_pool_status: replayPoolStatus,
    real_repeated_repair_rate: realRepeatedRepairRate,
    replay_mix: replayMix,
  }, null, 2)}\n`, 'utf8');

  return {
    campaignId,
    phase: config.phase || 'v1',
    status,
    seedResults,
    bestRun,
    replayPoolStatus,
    realRepeatedRepairRate,
    replayMix,
    campaignArtifactPath,
  };
}

export async function runPhase3Campaign({ config, deps = {} }) {
  const rootDir = config.rootDir || process.cwd();
  const maxTasks = Number(config.maxTasks || 0);
  const batchSize = Number(config.onlineBatchSize || 4);
  const rollbackThreshold = Number(config.rollbackThreshold || 3);
  const initialCheckpointId = config.initialCheckpointId || 'ckpt-initial';
  const nextEpisode = deps.nextEpisode;
  const onlineUpdater = deps.runOnlineUpdateBatch || runOnlineUpdateBatch;
  const performRollback = deps.performRollback;

  if (typeof nextEpisode !== 'function') {
    throw new Error('deps.nextEpisode is required');
  }

  const controlStore = deps.controlStore || await createControlStateStore({ rootDir });
  let duplicateEventApplications = 0;
  const applyTrackedEvent = async (event) => {
    const result = await applyControlEvent(controlStore, event);
    if (!result.applied) {
      duplicateEventApplications += 1;
    }
    return result;
  };
  let controlState = config.resume
    ? await readControlSnapshot(controlStore)
    : await writeControlSnapshot(controlStore, {
        active_checkpoint_id: initialCheckpointId,
        pre_update_ref_checkpoint_id: null,
        last_stable_checkpoint_id: initialCheckpointId,
        mode: 'collection',
        applied_event_ids: [],
        last_event_id: null,
      });
  if (!controlState.active_checkpoint_id) {
    controlState = await writeControlSnapshot(controlStore, {
      ...controlState,
      active_checkpoint_id: initialCheckpointId,
      pre_update_ref_checkpoint_id: null,
      last_stable_checkpoint_id: initialCheckpointId,
      mode: controlState.mode || 'collection',
    });
  }

  let epochNumber = 1;
  let batchNumber = 1;
  let updatesCompleted = 0;
  let updatesFailed = 0;
  let replayOnlyEpochs = 0;
  let rollbacksCompleted = 0;
  let comparisonFailedCount = 0;
  let betterCount = 0;
  let sameCount = 0;
  let worseCount = 0;
  let updatesAfterFreeze = 0;
  let currentEpoch = buildPhase3Epoch({
    epochNumber,
    phase: controlState.mode === 'monitoring' ? 'monitoring' : 'collection',
    controlState,
    initialCheckpointId,
  });
  let collectionEpisodes = [];
  let monitoringResults = [];

  for (let taskIndex = 0; taskIndex < maxTasks; taskIndex += 1) {
    if (controlState.mode === 'frozen_failure') {
      break;
    }
    const episode = await nextEpisode({
      taskIndex,
      currentEpoch,
      activeCheckpointId: controlState.active_checkpoint_id,
      controlState,
    });
    if (!episode || episode.admission_status !== 'admitted') {
      continue;
    }

    if (currentEpoch.phase === 'collection') {
      collectionEpisodes.push(episode);
      currentEpoch.admitted_trajectory_ids = [...currentEpoch.admitted_trajectory_ids, episode.episode_id];
      if (collectionEpisodes.length < batchSize) {
        continue;
      }

      const batchId = formatSequenceId('batch', batchNumber);
      const updateResult = await onlineUpdater({
        batchId,
        checkpointId: controlState.active_checkpoint_id,
        trajectories: collectionEpisodes,
      });

      if (updateResult.status !== 'ok') {
        updatesFailed += 1;
        const pointerPatch = applyPointerTransition(
          buildPhase3PointerState(controlState, initialCheckpointId),
          { type: 'update.failed' }
        );
        const failureEvent = await applyTrackedEvent({
          event_id: `update-failed-${batchNumber}`,
          snapshot_patch: {
            ...pointerPatch,
            mode: 'collection',
          },
        });
        controlState = failureEvent.snapshot;
        currentEpoch = reopenEpoch(currentEpoch, 'update_failed');
        currentEpoch = {
          ...currentEpoch,
          update_epoch_id: formatSequenceId('epoch', epochNumber),
          active_checkpoint_id: controlState.active_checkpoint_id,
          pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id,
        };
        collectionEpisodes = [];
        monitoringResults = [];
        batchNumber += 1;
        continue;
      }

      updatesCompleted += 1;
      const pointerPatch = applyPointerTransition(
        buildPhase3PointerState(controlState, initialCheckpointId),
        {
          type: 'update.completed',
          previous_active_checkpoint_id: controlState.active_checkpoint_id,
          new_active_checkpoint_id: updateResult.nextCheckpointId,
        }
      );
      const updateEvent = await applyTrackedEvent({
        event_id: `update-completed-${batchNumber}`,
        snapshot_patch: {
          ...pointerPatch,
          mode: 'monitoring',
        },
      });
      controlState = updateEvent.snapshot;
      epochNumber += 1;
      currentEpoch = buildPhase3Epoch({
        epochNumber,
        phase: 'monitoring',
        controlState,
        initialCheckpointId,
      });
      collectionEpisodes = [];
      monitoringResults = [];
      batchNumber += 1;
      continue;
    }

    monitoringResults.push({
      episode_id: episode.episode_id,
      comparison_status: episode.comparison_status || 'comparison_failed',
      relative_outcome: episode.relative_outcome ?? null,
    });
    if (episode.comparison_status === 'comparison_failed') {
      comparisonFailedCount += 1;
    } else if (episode.relative_outcome === 'better') {
      betterCount += 1;
    } else if (episode.relative_outcome === 'same') {
      sameCount += 1;
    } else if (episode.relative_outcome === 'worse') {
      worseCount += 1;
    }
    currentEpoch.comparison_results = [...monitoringResults];
    currentEpoch.degradation_streak = getRelativeOutcomeStreak(monitoringResults);

    if (currentEpoch.degradation_streak < rollbackThreshold) {
      continue;
    }

    rollbacksCompleted += 1;
    const restoredCheckpointId = controlState.pre_update_ref_checkpoint_id || controlState.last_stable_checkpoint_id;
    try {
      if (typeof performRollback === 'function') {
        await performRollback({
          restoredCheckpointId,
          controlState,
          currentEpoch,
        });
      }
    } catch (error) {
      const rollbackFailureEvent = await applyTrackedEvent({
        event_id: `rollback-failed-${rollbacksCompleted}`,
        snapshot_patch: {
          mode: 'frozen_failure',
        },
      });
      controlState = rollbackFailureEvent.snapshot;
      break;
    }
    const rollbackPatch = applyPointerTransition(
      buildPhase3PointerState(controlState, initialCheckpointId),
      {
        type: 'rollback.completed',
        restored_checkpoint_id: restoredCheckpointId,
      }
    );
    const rollbackEvent = await applyTrackedEvent({
      event_id: `rollback-completed-${rollbacksCompleted}`,
      snapshot_patch: {
        ...rollbackPatch,
        mode: 'collection',
      },
    });
    controlState = rollbackEvent.snapshot;
    epochNumber += 1;
    currentEpoch = buildPhase3Epoch({
      epochNumber,
      phase: 'collection',
      controlState,
      initialCheckpointId,
    });
    monitoringResults = [];
  }

  if (controlState.mode !== 'frozen_failure' && currentEpoch.phase === 'monitoring' && monitoringResults.length > 0) {
    currentEpoch = recordComparisonResults(currentEpoch, monitoringResults);

    if (currentEpoch.close_reason === 'replay_only') {
      replayOnlyEpochs += 1;
      const replayEvent = await applyTrackedEvent({
        event_id: `epoch-replay-only-${replayOnlyEpochs}`,
        snapshot_patch: {
          mode: 'monitoring',
        },
      });
      controlState = replayEvent.snapshot;
      currentEpoch = reopenEpoch(currentEpoch, 'replay_only');
      currentEpoch = {
        ...currentEpoch,
        update_epoch_id: formatSequenceId('epoch', epochNumber),
        active_checkpoint_id: controlState.active_checkpoint_id,
        pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id,
      };
    } else if (currentEpoch.promotion_eligible) {
      const stablePatch = applyPointerTransition(
        buildPhase3PointerState(controlState, initialCheckpointId),
        {
          type: 'epoch.closed',
          promotion_eligible: true,
        }
      );
      const stableEvent = await applyTrackedEvent({
        event_id: `epoch-closed-${epochNumber}`,
        snapshot_patch: {
          ...stablePatch,
          mode: 'collection',
        },
      });
      controlState = stableEvent.snapshot;
      epochNumber += 1;
      currentEpoch = buildPhase3Epoch({
        epochNumber,
        phase: 'collection',
        controlState,
        initialCheckpointId,
      });
    }
  }

  return {
    status: 'ok',
    updatesCompleted,
    updatesFailed,
    replayOnlyEpochs,
    rollbacksCompleted,
    betterCount,
    sameCount,
    worseCount,
    comparisonFailedCount,
    duplicateEventApplications,
    updatesAfterFreeze,
    currentEpoch,
    activeCheckpointId: controlState.active_checkpoint_id,
    preUpdateRefCheckpointId: controlState.pre_update_ref_checkpoint_id,
    lastStableCheckpointId: controlState.last_stable_checkpoint_id,
    controlState,
  };
}
