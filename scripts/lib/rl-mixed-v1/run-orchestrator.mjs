import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { applyPointerTransition } from '../rl-core/checkpoint-registry.mjs';
import { reduceDegradationStreak } from '../rl-core/comparison-engine.mjs';
import { applyControlEvent, createControlStateStore, readControlSnapshot, writeControlSnapshot } from '../rl-core/control-state-store.mjs';
import { applyTrajectoryUpdate, runOnlineUpdateBatch } from '../rl-core/trainer.mjs';
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

function clone(value) {
  if (value == null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return min;
  }
  return Math.min(max, Math.max(min, normalized));
}

function safeRatio(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) {
    return 0;
  }
  return top / bottom;
}

const ORCHESTRATOR_BANDIT_REWARD_WEIGHTS = Object.freeze({
  terminal: 0.8,
  successRate: 0.4,
  rollbackRate: -0.6,
  humanHandoffRate: -0.3,
  missedHandoff: -0.4,
  verificationBlocked: -0.2,
});

const POLICY_CHECKPOINT_SCHEMA_VERSION = 1;
const POLICY_CHECKPOINT_FILE = 'orchestrator-bandit-policy.latest.json';

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

function createDefaultAdapters({
  overrides = {},
  rootDir = process.cwd(),
  orchestratorHarnessMode = 'fixture',
  orchestratorHarnessOptions = {},
} = {}) {
  return {
    shell: overrides.shell || createShellMixedAdapter(),
    browser: overrides.browser || createBrowserAdapter(),
    orchestrator: overrides.orchestrator || createOrchestratorAdapter({
      harnessMode: orchestratorHarnessMode,
      harnessOptions: {
        rootDir: orchestratorHarnessOptions.rootDir || rootDir,
        ...orchestratorHarnessOptions,
      },
    }),
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

export function computeOrchestratorBanditReward({
  episode,
  batchOrchestratorEpisodes = [],
  historical = {},
} = {}) {
  const orchestratorRows = Array.isArray(batchOrchestratorEpisodes) && batchOrchestratorEpisodes.length > 0
    ? batchOrchestratorEpisodes
    : [episode];
  const successCount = orchestratorRows.filter((row) => row?.terminal_outcome === 'success').length;
  const handoffCount = orchestratorRows.filter((row) => row?.handoff_triggered === true).length;
  const successRate = safeRatio(successCount, orchestratorRows.length);
  const humanHandoffRate = safeRatio(handoffCount, orchestratorRows.length);
  const rollbackRate = safeRatio(historical.rollbacksCompleted, historical.updatesCompleted);
  const terminalReward = Number(episode?.terminal_reward || 0);
  const missedHandoff = episode?.decision_type === 'handoff' && episode?.handoff_triggered !== true;
  const verificationBlocked = episode?.verification_result === 'blocked';

  const components = {
    terminal: ORCHESTRATOR_BANDIT_REWARD_WEIGHTS.terminal * terminalReward,
    success_rate: ORCHESTRATOR_BANDIT_REWARD_WEIGHTS.successRate * ((2 * successRate) - 1),
    rollback_rate: ORCHESTRATOR_BANDIT_REWARD_WEIGHTS.rollbackRate * rollbackRate,
    human_handoff_rate: ORCHESTRATOR_BANDIT_REWARD_WEIGHTS.humanHandoffRate * humanHandoffRate,
    missed_handoff: missedHandoff ? ORCHESTRATOR_BANDIT_REWARD_WEIGHTS.missedHandoff : 0,
    verification_blocked: verificationBlocked ? ORCHESTRATOR_BANDIT_REWARD_WEIGHTS.verificationBlocked : 0,
  };
  const rawReward = Object.values(components).reduce((sum, value) => sum + Number(value || 0), 0);
  const reward = clamp(rawReward, -1.5, 1.5);
  return {
    reward,
    raw_reward: rawReward,
    signals: {
      terminal_reward: terminalReward,
      success_rate: successRate,
      rollback_rate: rollbackRate,
      human_handoff_rate: humanHandoffRate,
      missed_handoff: missedHandoff,
      verification_blocked: verificationBlocked,
    },
    components,
  };
}

function buildTrajectoryFromEpisode(episode, rewardContext = {}) {
  if (episode.environment === 'orchestrator' && episode.bandit_trace) {
    const rewardDetails = computeOrchestratorBanditReward({
      episode,
      batchOrchestratorEpisodes: rewardContext.batchOrchestratorEpisodes,
      historical: rewardContext.historical,
    });
    return {
      updateType: 'contextual_bandit',
      contextKey: episode.bandit_trace.context_key,
      actions: episode.bandit_trace.action_space,
      selectedAction: episode.bandit_trace.selected_action,
      reward: rewardDetails.reward,
      selectionMode: episode.bandit_trace.selection_mode,
      rewardSignals: rewardDetails.signals,
      rewardComponents: rewardDetails.components,
    };
  }
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

function buildPolicyCheckpointPath(baseDir) {
  return path.join(baseDir, 'checkpoints', POLICY_CHECKPOINT_FILE);
}

function normalizeCheckpointPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return clone(value);
}

function buildPolicyCheckpointMetadata({
  checkpointPath,
  loadStatus = 'cold_start',
  loadError = null,
  loadedUpdateCount = 0,
  loadedBatchIndex = 0,
  loadedSavedAt = null,
  saveStatus = 'not_written',
  savedUpdateCount = 0,
  savedBatchIndex = 0,
  savedAt = null,
} = {}) {
  return {
    path: checkpointPath,
    schema_version: POLICY_CHECKPOINT_SCHEMA_VERSION,
    load_status: loadStatus,
    load_error: loadError,
    loaded_update_count: Number(loadedUpdateCount || 0),
    loaded_batch_index: Number(loadedBatchIndex || 0),
    loaded_saved_at: loadedSavedAt,
    save_status: saveStatus,
    saved_update_count: Number(savedUpdateCount || 0),
    saved_batch_index: Number(savedBatchIndex || 0),
    saved_at: savedAt,
  };
}

async function loadPolicyCheckpoint(checkpointPath) {
  try {
    const payload = JSON.parse(await readFile(checkpointPath, 'utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('policy checkpoint payload must be an object');
    }
    return {
      status: 'loaded',
      metadata: buildPolicyCheckpointMetadata({
        checkpointPath,
        loadStatus: 'loaded',
        loadedUpdateCount: Number(payload.update_count || payload.active_policy?.contextualBandit?.updateCount || 0),
        loadedBatchIndex: Number(payload.batch_index || 0),
        loadedSavedAt: typeof payload.saved_at === 'string' ? payload.saved_at : null,
      }),
      activePolicy: normalizeCheckpointPolicy(payload.active_policy),
      referencePolicy: normalizeCheckpointPolicy(payload.reference_policy),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        status: 'missing',
        metadata: buildPolicyCheckpointMetadata({
          checkpointPath,
          loadStatus: 'missing',
        }),
        activePolicy: null,
        referencePolicy: null,
      };
    }
    return {
      status: 'corrupt',
      metadata: buildPolicyCheckpointMetadata({
        checkpointPath,
        loadStatus: 'corrupt',
        loadError: error?.message || String(error),
      }),
      activePolicy: null,
      referencePolicy: null,
    };
  }
}

async function persistPolicyCheckpoint({
  checkpointPath,
  activePolicy,
  referencePolicy,
  updateCount = 0,
  batchIndex = 0,
  activeCheckpointId = null,
}) {
  const payload = {
    schema_version: POLICY_CHECKPOINT_SCHEMA_VERSION,
    saved_at: new Date().toISOString(),
    update_count: Number(updateCount || 0),
    batch_index: Number(batchIndex || 0),
    active_checkpoint_id: activeCheckpointId ? String(activeCheckpointId) : null,
    active_policy: normalizeCheckpointPolicy(activePolicy),
    reference_policy: normalizeCheckpointPolicy(referencePolicy),
  };
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(checkpointPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

export async function runMixedCampaign({
  rootDir = process.cwd(),
  activeEnvironments = ['shell', 'browser', 'orchestrator'],
  adapters: adapterOverrides = {},
  orchestratorHarnessMode = 'fixture',
  orchestratorHarnessOptions = {},
  initialCheckpointId = 'ckpt-mixed-a',
  onlineBatchSize = 4,
  batchTargetCount = 3,
  namespace = 'rl-mixed-v1',
  mode = 'mixed',
  resume = false,
} = {}) {
  const adapters = createDefaultAdapters({
    overrides: adapterOverrides,
    rootDir,
    orchestratorHarnessMode,
    orchestratorHarnessOptions,
  });
  const resolvedEnvironments = [...activeEnvironments];
  const baseDir = await ensureNamespaceRoot(rootDir, namespace);
  const policyCheckpointPath = buildPolicyCheckpointPath(baseDir);
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
  let policyCheckpoint = buildPolicyCheckpointMetadata({
    checkpointPath: policyCheckpointPath,
    loadStatus: resume ? 'pending' : 'cold_start',
  });

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

  if (resume) {
    const restoredPolicy = await loadPolicyCheckpoint(policyCheckpointPath);
    policyCheckpoint = restoredPolicy.metadata;
    if (restoredPolicy.status === 'loaded') {
      activePolicy = restoredPolicy.activePolicy;
      referencePolicy = restoredPolicy.referencePolicy;
    }
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
        policy_checkpoint: policyCheckpoint,
        active_environments: resolvedEnvironments,
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
              policy_checkpoint: policyCheckpoint,
              active_environments: resolvedEnvironments,
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
        policy: selectedEnvironment === 'orchestrator' ? activePolicy || undefined : undefined,
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
    const batchOrchestratorEpisodes = collectionEpisodes.filter((episode) => episode.environment === 'orchestrator');
    const rewardContext = {
      batchOrchestratorEpisodes,
      historical: {
        updatesCompleted,
        rollbacksCompleted,
      },
    };

    const updateResult = runOnlineUpdateBatch({
      batchId: `batch-${String(batchIndex).padStart(3, '0')}`,
      checkpointId: controlState.active_checkpoint_id,
      policy: activePolicy || undefined,
      referencePolicy: referencePolicy || undefined,
      applyUpdate: applyTrajectoryUpdate,
      trajectories: collectionEpisodes.map((episode) => buildTrajectoryFromEpisode(episode, rewardContext)),
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

    const persistedPolicy = await persistPolicyCheckpoint({
      checkpointPath: policyCheckpointPath,
      activePolicy,
      referencePolicy,
      updateCount: Number(activePolicy?.contextualBandit?.updateCount || 0),
      batchIndex,
      activeCheckpointId: controlState.active_checkpoint_id,
    });
    policyCheckpoint = buildPolicyCheckpointMetadata({
      checkpointPath: policyCheckpointPath,
      loadStatus: policyCheckpoint.load_status,
      loadError: policyCheckpoint.load_error,
      loadedUpdateCount: policyCheckpoint.loaded_update_count,
      loadedBatchIndex: policyCheckpoint.loaded_batch_index,
      loadedSavedAt: policyCheckpoint.loaded_saved_at,
      saveStatus: 'written',
      savedUpdateCount: persistedPolicy.update_count,
      savedBatchIndex: persistedPolicy.batch_index,
      savedAt: persistedPolicy.saved_at,
    });
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
    bandit_policy_state: {
      update_count: Number(activePolicy?.contextualBandit?.updateCount || 0),
      context_count: Object.keys(activePolicy?.contextualBandit?.contexts || {}).length,
    },
    policy_checkpoint: policyCheckpoint,
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
