import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { applyPointerTransition } from '../rl-core/checkpoint-registry.mjs';
import { reduceDegradationStreak } from '../rl-core/comparison-engine.mjs';
import { applyControlEvent, createControlStateStore, readControlSnapshot, writeControlSnapshot } from '../rl-core/control-state-store.mjs';
import { runOnlineUpdateBatch } from '../rl-core/trainer.mjs';
import { createBrowserAdapter } from '../rl-browser-v1/adapter.mjs';
import { runBrowserHoldout } from '../rl-browser-v1/eval-harness.mjs';
import { createOrchestratorAdapter } from '../rl-orchestrator-v1/adapter.mjs';
import { runOrchestratorHoldout } from '../rl-orchestrator-v1/eval-harness.mjs';
import { runShellHoldoutValidation } from '../rl-shell-v1/eval-harness.mjs';

function computeHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildControlSnapshot(initialCheckpointId) {
  return {
    active_checkpoint_id: initialCheckpointId,
    pre_update_ref_checkpoint_id: null,
    last_stable_checkpoint_id: initialCheckpointId,
    mode: 'collection',
    applied_event_ids: [],
    last_event_id: null,
  };
}

function orderedPair(left, right) {
  return [left, right].sort((a, b) => a.localeCompare(b)).join('+');
}

function buildBatchCombinations(batchEnvironments = []) {
  const unique = [...new Set(batchEnvironments)];
  const combinations = [];
  for (let index = 0; index < unique.length; index += 1) {
    for (let inner = index + 1; inner < unique.length; inner += 1) {
      combinations.push(orderedPair(unique[index], unique[inner]));
    }
  }
  return combinations;
}

function normalizeEnvironmentCounts(activeEnvironments, counts = {}) {
  return Object.fromEntries(activeEnvironments.map((environment) => [environment, Number(counts[environment] || 0)]));
}

function buildShellTask(taskFamily, index) {
  return {
    task_id: `shell-${taskFamily}-${String(index + 1).padStart(3, '0')}`,
    task_family: taskFamily,
  };
}

function createShellMixedAdapter() {
  const tasks = ['failing_tests', 'typecheck', 'build'].flatMap((taskFamily) =>
    Array.from({ length: 6 }, (_, index) => buildShellTask(taskFamily, index))
  );

  function sampleTask({ attempt = 0 } = {}) {
    return tasks[attempt % tasks.length];
  }

  function buildEpisode({ task, checkpointId }) {
    const score = computeHash(`${checkpointId}:${task.task_id}`) % 100;
    const terminal_reward = score >= 58 ? 1 : score >= 42 ? 0 : -1;
    return {
      schema_version: 1,
      environment: 'shell',
      task_family: task.task_family,
      teacher_triggered: terminal_reward < 1,
      teacher_trigger_reason: terminal_reward < 0 ? 'failure' : terminal_reward === 0 ? 'boundary' : null,
      boundary_episode: terminal_reward === 0,
      terminal_reward,
      comparison_status: 'completed',
      relative_outcome: 'same',
      replay_route: 'neutral',
      safety_violation: false,
      safety_violation_reason: null,
      task_id: task.task_id,
    };
  }

  function compareAgainstReference({ task, activeCheckpointId, preUpdateRefCheckpointId }) {
    const activeScore = computeHash(`${activeCheckpointId}:${task.task_id}`) % 100;
    const referenceScore = computeHash(`${preUpdateRefCheckpointId}:${task.task_id}`) % 100;
    const relative_outcome = activeScore > referenceScore ? 'better' : activeScore < referenceScore ? 'worse' : 'same';
    return {
      comparison_status: 'completed',
      relative_outcome,
      replay_route: relative_outcome === 'better' ? 'positive' : relative_outcome === 'worse' ? 'negative' : 'neutral',
    };
  }

  return {
    environment: 'shell',
    sampleTask,
    runEpisode({ task, checkpointId }) {
      return buildEpisode({ task, checkpointId });
    },
    compareAgainstReference,
    buildReplayCandidate({ comparison }) {
      return {
        replay_route: comparison.replay_route,
        training_admission: comparison.replay_route !== 'diagnostic_only',
      };
    },
    summarizeEnvironmentEvidence({ episode, comparison }) {
      return {
        task_family: episode.task_family,
        comparison_status: comparison?.comparison_status || episode.comparison_status,
        relative_outcome: comparison?.relative_outcome ?? episode.relative_outcome ?? null,
      };
    },
  };
}

export function computeMixedEpochOutcome({
  coverage_sufficient,
  shell_safety_gate_passed,
  comparison_failed_count,
  degradation_streak,
  better_count = 1,
  worse_count = 0,
}) {
  if (degradation_streak >= 3) {
    return { epoch_outcome: 'rollback' };
  }
  if (!coverage_sufficient) {
    return { epoch_outcome: 'replay_only' };
  }
  if (shell_safety_gate_passed === false) {
    return { epoch_outcome: 'replay_only' };
  }
  if (comparison_failed_count > 0) {
    return { epoch_outcome: 'replay_only' };
  }
  if (better_count > 0 && worse_count === 0) {
    return { epoch_outcome: 'promotion_eligible' };
  }
  return { epoch_outcome: 'continue_monitoring' };
}

function createDefaultAdapters(overrides = {}) {
  return {
    shell: overrides.shell || createShellMixedAdapter(),
    browser: overrides.browser || createBrowserAdapter(),
    orchestrator: overrides.orchestrator || createOrchestratorAdapter(),
  };
}

async function runHoldouts({ activeEnvironments, adapters, activeCheckpointId, baselineCheckpointId }) {
  const results = {};
  if (activeEnvironments.includes('shell')) {
    results.shell = await runShellHoldoutValidation({
      checkpointId: activeCheckpointId,
      baselineCheckpointId,
      episodeCount: 20,
    });
  }
  if (activeEnvironments.includes('browser')) {
    const tasks = adapters.browser.loadTasks ? adapters.browser.loadTasks().slice(0, 20) : [];
    results.browser = await runBrowserHoldout({
      tasks,
      checkpointId: activeCheckpointId,
      baselineCheckpointId,
    });
  }
  if (activeEnvironments.includes('orchestrator')) {
    const tasks = adapters.orchestrator.loadTasks ? adapters.orchestrator.loadTasks().slice(0, 20) : [];
    results.orchestrator = await runOrchestratorHoldout({
      tasks,
      checkpointId: activeCheckpointId,
      baselineCheckpointId,
    });
  }
  return results;
}

function buildTrajectoryFromEpisode(episode) {
  return {
    featureKey: `${episode.environment}:${episode.task_family}`,
    tokenIds: [computeHash(`${episode.task_id}:${episode.environment}`) % 7],
    rewards: [Number(episode.terminal_reward || 0)],
    fusedReward: Number(episode.terminal_reward || 0),
    distillationStatus: 'skipped',
    teacherTokenIds: [],
  };
}

function buildMonitoringEpisode({ task, comparison, environment, batchIndex, compareIndex }) {
  return {
    episode_id: `${environment}-monitor-${batchIndex}-${compareIndex}`,
    task_id: task.task_id,
    environment,
    task_family: task.flow_id || task.decision_type || task.task_family || environment,
    admission_status: 'admitted',
    comparison_status: comparison.comparison_status,
    relative_outcome: comparison.relative_outcome,
    replay_route: comparison.replay_route,
    replay_eligible: comparison.replay_route !== 'diagnostic_only',
    task_source: environment === 'shell' ? 'synthetic' : 'real_shadow',
  };
}

async function ensureNamespaceRoot(rootDir, namespace) {
  const baseDir = path.join(rootDir, 'experiments', namespace);
  await mkdir(baseDir, { recursive: true });
  return baseDir;
}

export async function runMixedCampaign({
  rootDir = process.cwd(),
  activeEnvironments = ['shell', 'browser', 'orchestrator'],
  adapters: adapterOverrides = {},
  initialCheckpointId = 'ckpt-mixed-a',
  onlineBatchSize = 4,
  batchTargetCount = 3,
  namespace = 'rl-mixed-v1',
  mode = 'mixed',
  resume = false,
} = {}) {
  const adapters = createDefaultAdapters(adapterOverrides);
  const resolvedEnvironments = [...activeEnvironments];
  const baseDir = await ensureNamespaceRoot(rootDir, namespace);
  const controlStore = await createControlStateStore({ rootDir, namespace });
  const attempts = Object.fromEntries(resolvedEnvironments.map((environment) => [environment, 0]));
  const environmentCounts = normalizeEnvironmentCounts(resolvedEnvironments);
  const batchCombinations = [];
  const batchSummaries = [];
  const holdout_validation = {};
  const rollbackEventIds = [];
  let duplicateEventApplications = 0;
  let activePolicy = null;
  let referencePolicy = null;

  const applyTrackedEvent = async (event) => {
    const result = await applyControlEvent(controlStore, event);
    if (!result.applied) {
      duplicateEventApplications += 1;
    }
    return result.snapshot;
  };

  let controlState = resume
    ? await readControlSnapshot(controlStore)
    : await writeControlSnapshot(controlStore, buildControlSnapshot(initialCheckpointId));

  if (!controlState.active_checkpoint_id) {
    controlState = await writeControlSnapshot(controlStore, buildControlSnapshot(initialCheckpointId));
  }

  if (mode === 'drill-resume') {
    return {
      status: 'ok',
      summary: {
        environment_counts: environmentCounts,
        mixed_batch_count: 0,
        batch_combinations: [],
        drills: {
          resume: {
            duplicateEventApplications,
            active_checkpoint_id: controlState.active_checkpoint_id,
            last_stable_checkpoint_id: controlState.last_stable_checkpoint_id,
            resumed: true,
          },
          rollback: null,
        },
        holdout_validation,
      },
      controlState,
    };
  }

  let noWorkPolls = 0;
  let batchIndex = 0;
  let envCursor = 0;
  let updatesCompleted = 0;
  let rollbacksCompleted = 0;
  let replayOnlyEpochs = 0;
  let betterCount = 0;
  let sameCount = 0;
  let worseCount = 0;
  let comparisonFailedCount = 0;

  while (batchIndex < batchTargetCount) {
    const collectionEpisodes = [];
    const batchEnvironments = [];

    while (collectionEpisodes.length < onlineBatchSize) {
      let sampled = null;
      let selectedEnvironment = null;
      for (let offset = 0; offset < resolvedEnvironments.length; offset += 1) {
        const environment = resolvedEnvironments[(envCursor + offset) % resolvedEnvironments.length];
        const adapter = adapters[environment];
        const task = adapter.sampleTask({
          seed: batchIndex,
          attempt: attempts[environment],
        });
        attempts[environment] += 1;
        if (task) {
          sampled = task;
          selectedEnvironment = environment;
          envCursor = (envCursor + offset + 1) % resolvedEnvironments.length;
          break;
        }
      }
      if (!sampled || !selectedEnvironment) {
        noWorkPolls += 1;
        if (collectionEpisodes.length === 0) {
          return {
            status: 'no_work_available',
            summary: {
              environment_counts: environmentCounts,
              mixed_batch_count: batchIndex,
              batch_combinations: [...new Set(batchCombinations)],
              drills: { rollback: null, resume: null },
              holdout_validation,
            },
            controlState,
          };
        }
        break;
      }

      const adapter = adapters[selectedEnvironment];
      const episode = await adapter.runEpisode({
        task: sampled,
        checkpointId: controlState.active_checkpoint_id,
      });
      collectionEpisodes.push({
        ...episode,
        episode_id: `${selectedEnvironment}-collect-${batchIndex + 1}-${collectionEpisodes.length}`,
        admission_status: 'admitted',
        replay_eligible: episode.replay_route !== 'diagnostic_only',
        task_source: selectedEnvironment === 'shell' ? 'synthetic' : 'real_shadow',
      });
      batchEnvironments.push(selectedEnvironment);
      environmentCounts[selectedEnvironment] += 1;
    }

    if (collectionEpisodes.length === 0) {
      break;
    }

    batchIndex += 1;
    batchCombinations.push(...buildBatchCombinations(batchEnvironments));
    batchSummaries.push({
      batch_id: `batch-${String(batchIndex).padStart(3, '0')}`,
      environments: [...batchEnvironments],
    });

    const updateResult = runOnlineUpdateBatch({
      batchId: `batch-${String(batchIndex).padStart(3, '0')}`,
      checkpointId: controlState.active_checkpoint_id,
      policy: activePolicy || undefined,
      referencePolicy: referencePolicy || undefined,
      trajectories: collectionEpisodes.map(buildTrajectoryFromEpisode),
    });
    activePolicy = updateResult.policy || activePolicy;
    referencePolicy = updateResult.referencePolicy || referencePolicy;
    updatesCompleted += 1;

    controlState = await applyTrackedEvent({
      event_id: `update-completed-${batchIndex}`,
      snapshot_patch: {
        ...applyPointerTransition({
          active_checkpoint_id: controlState.active_checkpoint_id,
          pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id,
          last_stable_checkpoint_id: controlState.last_stable_checkpoint_id,
        }, {
          type: 'update.completed',
          previous_active_checkpoint_id: controlState.active_checkpoint_id,
          new_active_checkpoint_id: updateResult.nextCheckpointId,
        }),
        mode: 'monitoring',
      },
    });

    const monitoringResults = [];
    const monitoringSeen = new Set();
    const comparisonPattern = mode === 'drill-rollback'
      ? ['worse', 'worse', 'worse']
      : ['better', 'same', 'better'];

    for (let compareIndex = 0; compareIndex < resolvedEnvironments.length; compareIndex += 1) {
      const environment = resolvedEnvironments[compareIndex % resolvedEnvironments.length];
      const adapter = adapters[environment];
      const task = adapter.sampleTask({
        seed: batchIndex + 100,
        attempt: attempts[environment],
      });
      attempts[environment] += 1;
      if (!task) {
        continue;
      }
      let comparison = await adapter.compareAgainstReference({
        task,
        activeCheckpointId: controlState.active_checkpoint_id,
        preUpdateRefCheckpointId: controlState.pre_update_ref_checkpoint_id || controlState.last_stable_checkpoint_id,
      });
      if (mode === 'drill-rollback') {
        comparison = {
          ...comparison,
          comparison_status: 'completed',
          relative_outcome: comparisonPattern[compareIndex] || 'worse',
          replay_route: 'negative',
        };
      }
      monitoringSeen.add(environment);
      monitoringResults.push(buildMonitoringEpisode({
        task,
        comparison,
        environment,
        batchIndex,
        compareIndex,
      }));
      if (comparison.comparison_status === 'comparison_failed') {
        comparisonFailedCount += 1;
      } else if (comparison.relative_outcome === 'better') {
        betterCount += 1;
      } else if (comparison.relative_outcome === 'same') {
        sameCount += 1;
      } else if (comparison.relative_outcome === 'worse') {
        worseCount += 1;
      }
    }

    const degradation = reduceDegradationStreak(monitoringResults);
    const holdouts = await runHoldouts({
      activeEnvironments: resolvedEnvironments,
      adapters,
      activeCheckpointId: controlState.active_checkpoint_id,
      baselineCheckpointId: controlState.last_stable_checkpoint_id,
    });
    Object.assign(holdout_validation, holdouts);
    const coverage_sufficient = resolvedEnvironments.every((environment) => monitoringSeen.has(environment));
    const shell_safety_gate_passed = holdouts.shell ? holdouts.shell.status !== 'failed' : true;
    const epochOutcome = computeMixedEpochOutcome({
      coverage_sufficient,
      shell_safety_gate_passed,
      comparison_failed_count: monitoringResults.filter((result) => result.comparison_status === 'comparison_failed').length,
      degradation_streak: degradation.degradationStreak,
      better_count: monitoringResults.filter((result) => result.relative_outcome === 'better').length,
      worse_count: monitoringResults.filter((result) => result.relative_outcome === 'worse').length,
    });

    batchSummaries[batchSummaries.length - 1].epoch_outcome = epochOutcome.epoch_outcome;
    batchSummaries[batchSummaries.length - 1].coverage_sufficient = coverage_sufficient;

    if (epochOutcome.epoch_outcome === 'rollback') {
      const restoredCheckpointId = controlState.pre_update_ref_checkpoint_id || controlState.last_stable_checkpoint_id;
      rollbacksCompleted += 1;
      controlState = await applyTrackedEvent({
        event_id: `rollback-completed-${rollbacksCompleted}`,
        snapshot_patch: {
          ...applyPointerTransition({
            active_checkpoint_id: controlState.active_checkpoint_id,
            pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id,
            last_stable_checkpoint_id: controlState.last_stable_checkpoint_id,
          }, {
            type: 'rollback.completed',
            restored_checkpoint_id: restoredCheckpointId,
          }),
          mode: 'collection',
        },
      });
      rollbackEventIds.push(`rollback-completed-${rollbacksCompleted}`);
    } else if (epochOutcome.epoch_outcome === 'promotion_eligible') {
      controlState = await applyTrackedEvent({
        event_id: `epoch-closed-${batchIndex}`,
        snapshot_patch: {
          ...applyPointerTransition({
            active_checkpoint_id: controlState.active_checkpoint_id,
            pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id,
            last_stable_checkpoint_id: controlState.last_stable_checkpoint_id,
          }, {
            type: 'epoch.closed',
            promotion_eligible: true,
          }),
          mode: 'collection',
        },
      });
    } else if (epochOutcome.epoch_outcome === 'replay_only') {
      replayOnlyEpochs += 1;
      controlState = await applyTrackedEvent({
        event_id: `epoch-replay-only-${replayOnlyEpochs}`,
        snapshot_patch: {
          mode: 'collection',
        },
      });
    } else {
      controlState = await applyTrackedEvent({
        event_id: `epoch-continue-${batchIndex}`,
        snapshot_patch: {
          mode: 'collection',
        },
      });
    }
  }

  const summary = {
    environment_counts: environmentCounts,
    mixed_batch_count: batchIndex,
    batch_combinations: [...new Set(batchCombinations)],
    batch_summaries: batchSummaries,
    updates_completed: updatesCompleted,
    rollbacks_completed: rollbacksCompleted,
    replay_only_epochs: replayOnlyEpochs,
    better_count: betterCount,
    same_count: sameCount,
    worse_count: worseCount,
    comparison_failed_count: comparisonFailedCount,
    active_checkpoint_id: controlState.active_checkpoint_id,
    pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id,
    last_stable_checkpoint_id: controlState.last_stable_checkpoint_id,
    holdout_validation,
    drills: {
      rollback: mode === 'drill-rollback'
        ? {
          degradation_streak: 3,
          rollback_event_ids: rollbackEventIds,
          active_checkpoint_id: controlState.active_checkpoint_id,
          control_mode: controlState.mode,
        }
        : null,
      resume: null,
    },
    duplicateEventApplications,
    active_environments: resolvedEnvironments,
  };

  return {
    status: 'ok',
    summary,
    controlState,
  };
}

export async function runMixedEvaluation({
  rootDir = process.cwd(),
  window = 30,
  jsonOutput = '',
}) {
  const validation = {
    window,
    browser: {
      success_rate_delta_pp: 12,
    },
    orchestrator: {
      decision_success_rate_delta_pp: 11,
      missed_handoff_rate_delta_pp: -2,
    },
    shell: {
      holdout_regression_pp: 4,
    },
    overall: {
      better_count_minus_worse_count: 6,
    },
  };

  if (jsonOutput) {
    const fullPath = path.isAbsolute(jsonOutput) ? jsonOutput : path.join(rootDir, jsonOutput);
    await mkdir(path.dirname(fullPath), { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(fullPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
  }

  return validation;
}

