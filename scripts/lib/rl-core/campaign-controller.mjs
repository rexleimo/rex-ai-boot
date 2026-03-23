import { applyPointerTransition } from './checkpoint-registry.mjs';
import {
  normalizeEpisodeComparison,
  reduceDegradationStreak as reduceDegradationStreakFromResults,
  summarizeComparisonResults,
} from './comparison-engine.mjs';
import { createControlStateStore, applyControlEvent, readControlSnapshot, writeControlSnapshot } from './control-state-store.mjs';
import { recordComparisonResults, reopenEpoch, seedEpoch } from './epoch-ledger.mjs';
import { runOnlineUpdateBatch } from './trainer.mjs';

function formatSequenceId(prefix, value) {
  return `${prefix}-${String(value).padStart(3, '0')}`;
}

function buildPointerState(controlState, initialCheckpointId) {
  return {
    active_checkpoint_id: controlState.active_checkpoint_id || initialCheckpointId,
    pre_update_ref_checkpoint_id: controlState.pre_update_ref_checkpoint_id ?? null,
    last_stable_checkpoint_id: controlState.last_stable_checkpoint_id || initialCheckpointId,
  };
}

function buildEpoch({ epochNumber, phase, controlState, initialCheckpointId }) {
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

function createInitialSnapshot(initialCheckpointId) {
  return {
    active_checkpoint_id: initialCheckpointId,
    pre_update_ref_checkpoint_id: null,
    last_stable_checkpoint_id: initialCheckpointId,
    mode: 'collection',
    applied_event_ids: [],
    last_event_id: null,
  };
}

export function computeEpochOutcome({
  activeEnvironments = [],
  betterCount = 0,
  worseCount = 0,
  comparisonFailedCount = 0,
  coverageSatisfied = true,
  shellSafetyGatePassed,
  shellSafetyGate,
  degradationStreak = 0,
}) {
  if (degradationStreak >= 3) {
    return {
      outcome: 'rollback',
      shellSafetyGateCalled: false,
      shellSafetyGatePassed: shellSafetyGatePassed ?? null,
    };
  }

  if (!coverageSatisfied) {
    return {
      outcome: 'replay_only',
      shellSafetyGateCalled: false,
      shellSafetyGatePassed: shellSafetyGatePassed ?? null,
    };
  }

  let gateCalled = false;
  let gatePassed = shellSafetyGatePassed;
  const promotionCandidate = betterCount > 0 && worseCount === 0 && comparisonFailedCount === 0;
  if (promotionCandidate && activeEnvironments.includes('shell')) {
    if (typeof shellSafetyGate === 'function') {
      gateCalled = true;
      gatePassed = Boolean(shellSafetyGate());
    } else if (typeof gatePassed !== 'boolean') {
      gatePassed = true;
    }
  }

  if (promotionCandidate && activeEnvironments.includes('shell') && gatePassed === false) {
    return {
      outcome: 'replay_only',
      shellSafetyGateCalled: gateCalled,
      shellSafetyGatePassed: gatePassed,
    };
  }

  if (comparisonFailedCount > 0) {
    return {
      outcome: 'replay_only',
      shellSafetyGateCalled: gateCalled,
      shellSafetyGatePassed: gatePassed ?? null,
    };
  }

  if (promotionCandidate) {
    return {
      outcome: 'promotion_eligible',
      shellSafetyGateCalled: gateCalled,
      shellSafetyGatePassed: gatePassed ?? null,
    };
  }

  return {
    outcome: 'continue_monitoring',
    shellSafetyGateCalled: gateCalled,
    shellSafetyGatePassed: gatePassed ?? null,
  };
}

export function reduceMonitoringDegradation(results, { rollbackThreshold = 3 } = {}) {
  return reduceDegradationStreakFromResults(results, { rollbackThreshold });
}

export { reduceDegradationStreakFromResults as reduceDegradationStreak };

export async function runOnlineCampaign({ config, deps = {} }) {
  const rootDir = config.rootDir || process.cwd();
  const namespace = config.namespace || 'rl-core';
  const maxTasks = Number(config.maxTasks || 0);
  const batchSize = Number(config.onlineBatchSize || 4);
  const rollbackThreshold = Number(config.rollbackThreshold || 3);
  const idleBackoffBudget = Number(config.idleBackoffBudget || 0);
  const activeEnvironments = Array.isArray(config.activeEnvironments) && config.activeEnvironments.length > 0
    ? [...config.activeEnvironments]
    : ['shell'];
  const initialCheckpointId = config.initialCheckpointId || 'ckpt-initial';
  const nextEpisode = deps.nextEpisode;
  const sampleTask = deps.sampleTask;
  const episodeRunner = deps.runEpisode;
  const onlineUpdater = deps.runOnlineUpdateBatch || runOnlineUpdateBatch;
  const performRollback = deps.performRollback;
  const holdoutValidator = deps.holdoutValidator;
  const coverageResolver = deps.coverageResolver;
  const shellSafetyEvaluator = deps.shellSafetyEvaluator;

  if (typeof nextEpisode !== 'function' && typeof sampleTask !== 'function') {
    throw new Error('deps.nextEpisode is required');
  }

  const controlStore = deps.controlStore || await createControlStateStore({ rootDir, namespace });
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
    : await writeControlSnapshot(controlStore, createInitialSnapshot(initialCheckpointId));

  if (!controlState.active_checkpoint_id) {
    controlState = await writeControlSnapshot(controlStore, {
      ...controlState,
      ...createInitialSnapshot(initialCheckpointId),
      mode: controlState.mode || 'collection',
      applied_event_ids: Array.isArray(controlState.applied_event_ids) ? controlState.applied_event_ids : [],
      last_event_id: controlState.last_event_id ?? null,
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
  let currentEpoch = buildEpoch({
    epochNumber,
    phase: controlState.mode === 'monitoring' ? 'monitoring' : 'collection',
    controlState,
    initialCheckpointId,
  });
  let collectionEpisodes = [];
  let monitoringResults = [];
  let idlePolls = 0;

  for (let taskIndex = 0; taskIndex < maxTasks; taskIndex += 1) {
    if (controlState.mode === 'frozen_failure') {
      break;
    }

    if (typeof nextEpisode !== 'function' && typeof sampleTask === 'function') {
      const task = await sampleTask({
        taskIndex,
        currentEpoch,
        activeCheckpointId: controlState.active_checkpoint_id,
        controlState,
      });
      if (task === null) {
        idlePolls += 1;
        if (idleBackoffBudget > 0 && idlePolls >= idleBackoffBudget) {
          return {
            status: 'no_work_available',
            idlePolls,
            activeEnvironments,
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
        continue;
      }
      if (typeof episodeRunner !== 'function') {
        throw new Error('deps.runEpisode is required when sampleTask returns work');
      }
      idlePolls = 0;
      const episode = await episodeRunner({
        task,
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
            buildPointerState(controlState, initialCheckpointId),
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
          buildPointerState(controlState, initialCheckpointId),
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
        currentEpoch = buildEpoch({
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

      const normalized = normalizeEpisodeComparison(episode);
      monitoringResults.push(normalized);
      if (normalized.comparison_status === 'comparison_failed') {
        comparisonFailedCount += 1;
      } else if (normalized.relative_outcome === 'better') {
        betterCount += 1;
      } else if (normalized.relative_outcome === 'same') {
        sameCount += 1;
      } else if (normalized.relative_outcome === 'worse') {
        worseCount += 1;
      }
      currentEpoch.comparison_results = [...monitoringResults];
      const degradation = reduceDegradationStreakFromResults(monitoringResults, { rollbackThreshold });
      currentEpoch.degradation_streak = degradation.degradationStreak;

      if (!degradation.shouldRollback) {
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
      } catch {
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
        buildPointerState(controlState, initialCheckpointId),
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
      currentEpoch = buildEpoch({
        epochNumber,
        phase: 'collection',
        controlState,
        initialCheckpointId,
      });
      monitoringResults = [];
      continue;
    }

    idlePolls = 0;
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
          buildPointerState(controlState, initialCheckpointId),
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
        buildPointerState(controlState, initialCheckpointId),
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
      currentEpoch = buildEpoch({
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

    const normalized = normalizeEpisodeComparison(episode);
    monitoringResults.push(normalized);
    if (normalized.comparison_status === 'comparison_failed') {
      comparisonFailedCount += 1;
    } else if (normalized.relative_outcome === 'better') {
      betterCount += 1;
    } else if (normalized.relative_outcome === 'same') {
      sameCount += 1;
    } else if (normalized.relative_outcome === 'worse') {
      worseCount += 1;
    }
    currentEpoch.comparison_results = [...monitoringResults];
    const degradation = reduceDegradationStreakFromResults(monitoringResults, { rollbackThreshold });
    currentEpoch.degradation_streak = degradation.degradationStreak;

    if (!degradation.shouldRollback) {
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
    } catch {
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
      buildPointerState(controlState, initialCheckpointId),
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
    currentEpoch = buildEpoch({
      epochNumber,
      phase: 'collection',
      controlState,
      initialCheckpointId,
    });
    monitoringResults = [];
  }

  if (controlState.mode !== 'frozen_failure' && currentEpoch.phase === 'monitoring' && monitoringResults.length > 0) {
    currentEpoch = recordComparisonResults(currentEpoch, monitoringResults);
    const degradation = reduceDegradationStreakFromResults(monitoringResults, { rollbackThreshold });
    currentEpoch.degradation_streak = degradation.degradationStreak;
    const summary = summarizeComparisonResults(monitoringResults);
    const holdoutResult = typeof holdoutValidator === 'function'
      ? await holdoutValidator({
        candidateCheckpointId: controlState.active_checkpoint_id,
        baselineCheckpointId: controlState.last_stable_checkpoint_id,
        currentEpoch,
      })
      : null;
    const coverageSatisfied = typeof coverageResolver === 'function'
      ? await coverageResolver({
        currentEpoch,
        monitoringResults,
        activeEnvironments,
        controlState,
        holdoutResult,
      })
      : config.coverageSatisfied ?? true;
    const shellSafetyGatePassed = typeof shellSafetyEvaluator === 'function'
      ? await shellSafetyEvaluator({
        currentEpoch,
        monitoringResults,
        activeEnvironments,
        controlState,
        holdoutResult,
      })
      : holdoutResult?.status !== 'failed';
    const epochOutcome = computeEpochOutcome({
      activeEnvironments,
      betterCount: summary.betterCount,
      worseCount: summary.worseCount,
      comparisonFailedCount: summary.comparisonFailedCount,
      coverageSatisfied,
      shellSafetyGatePassed,
      degradationStreak: currentEpoch.degradation_streak,
    });

    if (epochOutcome.outcome === 'replay_only') {
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
    } else if (epochOutcome.outcome === 'promotion_eligible' && currentEpoch.promotion_eligible) {
      const stablePatch = applyPointerTransition(
        buildPointerState(controlState, initialCheckpointId),
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
      currentEpoch = buildEpoch({
        epochNumber,
        phase: 'collection',
        controlState,
        initialCheckpointId,
      });
    }
  }

  if (controlState.mode === 'frozen_failure') {
    updatesAfterFreeze = 0;
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
