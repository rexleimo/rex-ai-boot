import { validateMixedEpisode, validateReplayCandidate } from '../rl-core/schema.mjs';
import { classifyReplayRoute } from '../rl-core/replay-pool.mjs';
import { selectContextualBanditAction } from '../rl-core/trainer.mjs';
import { createCiFixtureOrchestratorHarness, createRealOrchestratorHarness } from './decision-runner.mjs';
import {
  DECISION_TYPES,
  validateOrchestratorBanditTrace,
  validateOrchestratorEvidence,
  validateOrchestratorTask,
} from './schema.mjs';
import { loadRealOrchestratorTasks, sampleOrchestratorTask } from './task-registry.mjs';

function assertHarness(harness) {
  if (!harness || typeof harness.executeDecision !== 'function') {
    throw new Error('orchestrator infrastructure harness is required');
  }
}

function normalizeHarnessMode(mode = 'fixture') {
  const normalized = String(mode || 'fixture').trim().toLowerCase();
  if (normalized !== 'fixture' && normalized !== 'real') {
    throw new Error('orchestrator harness mode must be fixture or real');
  }
  return normalized;
}

export function createOrchestratorHarness({ mode = 'fixture', options = {} } = {}) {
  const normalizedMode = normalizeHarnessMode(mode);
  if (normalizedMode === 'real') {
    return createRealOrchestratorHarness(options);
  }
  return createCiFixtureOrchestratorHarness(options?.fixtureOverrides || {});
}

export function classifyTeacherTrigger({ terminalOutcome, boundaryEpisode }) {
  if (terminalOutcome === 'failed') {
    return { teacher_triggered: true, teacher_trigger_reason: 'failure' };
  }
  if (boundaryEpisode) {
    return { teacher_triggered: true, teacher_trigger_reason: 'boundary' };
  }
  return { teacher_triggered: false, teacher_trigger_reason: null };
}

function buildNormativeFields({ task, terminalReward, boundaryEpisode, comparisonStatus, relativeOutcome, replayRoute }) {
  const teacherTrigger = classifyTeacherTrigger({
    terminalOutcome: terminalReward > 0 ? 'success' : boundaryEpisode ? 'partial' : 'failed',
    boundaryEpisode,
  });
  return validateMixedEpisode({
    schema_version: 1,
    environment: 'orchestrator',
    task_family: task.decision_type,
    teacher_triggered: teacherTrigger.teacher_triggered,
    teacher_trigger_reason: teacherTrigger.teacher_trigger_reason,
    boundary_episode: boundaryEpisode,
    terminal_reward: terminalReward,
    comparison_status: comparisonStatus,
    relative_outcome: comparisonStatus === 'completed' ? relativeOutcome : null,
    replay_route: replayRoute,
    safety_violation: false,
    safety_violation_reason: null,
  });
}

function scoreEvidence(evidence) {
  if (evidence.terminal_outcome === 'success') return 2;
  if (evidence.terminal_outcome === 'partial') return 1;
  return 0;
}

function buildOrchestratorBanditContextKey(task) {
  const state = task.context_state || {};
  const blockerCount = Number(state.blocker_count ?? state.blockers ?? 0);
  const hasHumanNeed = Boolean(state.requiresHuman || state.requires_human);
  return `orchestrator:${task.decision_type}:blockers=${Number.isFinite(blockerCount) ? blockerCount : 0}:human=${hasHumanNeed ? 1 : 0}`;
}

export async function runOrchestratorEpisode({
  task,
  checkpointId,
  harness = createCiFixtureOrchestratorHarness(),
  policy = null,
  trainerConfig = undefined,
}) {
  const normalizedTask = validateOrchestratorTask(task);
  assertHarness(harness);
  const actionSpace = normalizedTask.available_executors.length > 0
    ? normalizedTask.available_executors
    : [normalizedTask.expected_executor];
  const banditSelection = policy && typeof policy === 'object'
    ? selectContextualBanditAction({
      policy,
      contextKey: buildOrchestratorBanditContextKey(normalizedTask),
      actions: actionSpace,
      config: trainerConfig,
      evaluationMode: false,
    })
    : null;

  let evidence;
  try {
    evidence = await harness.executeDecision({
      task: normalizedTask,
      checkpointId,
      attempt: 0,
      mode: 'episode',
      selectedExecutor: banditSelection?.selectedAction || null,
    });
  } catch (error) {
    throw new Error(`orchestrator infrastructure: ${error.message}`);
  }
  const normalizedEvidence = validateOrchestratorEvidence(evidence);
  const terminalReward = normalizedEvidence.terminal_outcome === 'success' ? 1 : normalizedEvidence.terminal_outcome === 'partial' ? 0 : -1;
  const boundaryEpisode = normalizedEvidence.terminal_outcome === 'partial' || normalizedTask.boundary_hint;
  const normative = buildNormativeFields({
    task: normalizedTask,
    terminalReward,
    boundaryEpisode,
    comparisonStatus: 'completed',
    relativeOutcome: 'same',
    replayRoute: 'neutral',
  });
  const banditTrace = banditSelection
    ? validateOrchestratorBanditTrace({
      algorithm: 'contextual_bandit',
      context_key: banditSelection.contextKey,
      action_space: banditSelection.actionSpace,
      selected_action: banditSelection.selectedAction,
      action_probability: banditSelection.actionProbability,
      action_probabilities: banditSelection.actionProbabilities,
      selection_mode: banditSelection.selectionMode,
    })
    : null;
  return {
    ...normative,
    task_id: normalizedTask.task_id,
    context_snapshot_id: normalizedTask.context_snapshot_id,
    context_state: normalizedEvidence.context_state,
    decision_type: normalizedEvidence.decision_type,
    decision_payload: normalizedEvidence.decision_payload,
    executor_selected: normalizedEvidence.executor_selected,
    preflight_selected: normalizedEvidence.preflight_selected,
    verification_result: normalizedEvidence.verification_result,
    handoff_triggered: normalizedEvidence.handoff_triggered,
    terminal_outcome: normalizedEvidence.terminal_outcome,
    bandit_trace: banditTrace,
  };
}

export async function compareOrchestratorAgainstReference({
  task,
  activeCheckpointId,
  preUpdateRefCheckpointId,
  harness = createCiFixtureOrchestratorHarness(),
}) {
  const normalizedTask = validateOrchestratorTask(task);
  assertHarness(harness);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (normalizedTask.forceComparisonFailure) {
      if (attempt === 0) {
        continue;
      }
      return {
        comparison_status: 'comparison_failed',
        relative_outcome: null,
        replay_route: 'diagnostic_only',
        pinned_inputs: {
          context_snapshot_id: normalizedTask.context_snapshot_id,
          available_executors: normalizedTask.available_executors,
          available_preflight_actions: normalizedTask.available_preflight_actions,
          evidence_packet: normalizedTask.hard_verification_evidence,
        },
      };
    }
    let activeEvidence;
    let referenceEvidence;
    try {
      activeEvidence = validateOrchestratorEvidence(await harness.executeDecision({
        task: normalizedTask,
        checkpointId: activeCheckpointId,
        attempt,
        mode: 'comparison',
      }));
      referenceEvidence = validateOrchestratorEvidence(await harness.executeDecision({
        task: normalizedTask,
        checkpointId: preUpdateRefCheckpointId,
        attempt,
        mode: 'comparison',
      }));
    } catch (error) {
      throw new Error(`orchestrator infrastructure: ${error.message}`);
    }

    const relative_outcome = scoreEvidence(activeEvidence) > scoreEvidence(referenceEvidence)
      ? 'better'
      : scoreEvidence(activeEvidence) < scoreEvidence(referenceEvidence)
        ? 'worse'
        : 'same';

    return {
      comparison_status: 'completed',
      relative_outcome,
      replay_route: relative_outcome === 'better' ? 'positive' : relative_outcome === 'worse' ? 'negative' : 'neutral',
      pinned_inputs: {
        context_snapshot_id: normalizedTask.context_snapshot_id,
        available_executors: normalizedTask.available_executors,
        available_preflight_actions: normalizedTask.available_preflight_actions,
        evidence_packet: normalizedTask.hard_verification_evidence,
      },
    };
  }

  return {
    comparison_status: 'comparison_failed',
    relative_outcome: null,
    replay_route: 'diagnostic_only',
    pinned_inputs: {
      context_snapshot_id: normalizedTask.context_snapshot_id,
      available_executors: normalizedTask.available_executors,
      available_preflight_actions: normalizedTask.available_preflight_actions,
      evidence_packet: normalizedTask.hard_verification_evidence,
    },
  };
}

export function buildOrchestratorReplayCandidate({ episode, comparison }) {
  const replay_route = comparison?.replay_route || classifyReplayRoute({
    ...episode,
    ...comparison,
  });
  return validateReplayCandidate({
    replay_route,
    training_admission: replay_route !== 'diagnostic_only',
  });
}

export function summarizeOrchestratorEnvironmentEvidence({ episode, comparison }) {
  return {
    decision_type: episode.decision_type,
    verification_result: episode.verification_result,
    terminal_outcome: episode.terminal_outcome,
    bandit_action: episode.bandit_trace?.selected_action || null,
    comparison_status: comparison?.comparison_status || episode.comparison_status,
    relative_outcome: comparison?.relative_outcome ?? episode.relative_outcome ?? null,
  };
}

export function createOrchestratorAdapter({
  tasks = loadRealOrchestratorTasks(),
  harness = null,
  harnessMode = 'fixture',
  harnessOptions = {},
} = {}) {
  const resolvedHarness = harness || createOrchestratorHarness({
    mode: harnessMode,
    options: harnessOptions,
  });
  return {
    environment: 'orchestrator',
    loadTasks: () => loadRealOrchestratorTasks({ tasks }),
    sampleTask({ seed = 0, attempt = 0 } = {}) {
      return sampleOrchestratorTask({ seed, attempt, tasks });
    },
    runEpisode({ task, checkpointId, policy = null, trainerConfig = undefined }) {
      return runOrchestratorEpisode({
        task,
        checkpointId,
        harness: resolvedHarness,
        policy,
        trainerConfig,
      });
    },
    compareAgainstReference({ task, activeCheckpointId, preUpdateRefCheckpointId }) {
      return compareOrchestratorAgainstReference({
        task,
        activeCheckpointId,
        preUpdateRefCheckpointId,
        harness: resolvedHarness,
      });
    },
    buildReplayCandidate: buildOrchestratorReplayCandidate,
    summarizeEnvironmentEvidence: summarizeOrchestratorEnvironmentEvidence,
  };
}
