import { validateMixedEpisode, validateReplayCandidate } from '../rl-core/schema.mjs';
import { classifyReplayRoute } from '../rl-core/replay-pool.mjs';
import { createFixtureBrowserDriver } from './browser-runner.mjs';
import { validateBrowserEvidence, validateBrowserTask } from './schema.mjs';
import { loadBrowserTasks, sampleBrowserTask } from './task-registry.mjs';

function assertDriver(driver) {
  if (!driver || typeof driver.executeFlow !== 'function') {
    throw new Error('browser infrastructure driver is required');
  }
}

function buildTeacherTrigger({ terminalStatus, boundaryEpisode }) {
  if (terminalStatus !== 'success' && !boundaryEpisode) {
    return {
      teacher_triggered: true,
      teacher_trigger_reason: 'failure',
    };
  }
  if (boundaryEpisode) {
    return {
      teacher_triggered: true,
      teacher_trigger_reason: 'boundary',
    };
  }
  return {
    teacher_triggered: false,
    teacher_trigger_reason: null,
  };
}

function buildNormativeFields({ task, terminalReward, boundaryEpisode, safetyViolation, safetyViolationReason, comparisonStatus, relativeOutcome, replayRoute, teacherTrigger }) {
  const normative = validateMixedEpisode({
    schema_version: 1,
    environment: 'browser',
    task_family: task.flow_id,
    teacher_triggered: teacherTrigger.teacher_triggered,
    teacher_trigger_reason: teacherTrigger.teacher_trigger_reason,
    boundary_episode: boundaryEpisode,
    terminal_reward: terminalReward,
    comparison_status: comparisonStatus,
    relative_outcome: comparisonStatus === 'completed' ? relativeOutcome : null,
    replay_route: replayRoute,
    safety_violation: safetyViolation,
    safety_violation_reason: safetyViolationReason,
  });
  return normative;
}

export async function runBrowserEpisode({ task, checkpointId, browserDriver = createFixtureBrowserDriver() }) {
  const normalizedTask = validateBrowserTask(task);
  assertDriver(browserDriver);
  let result;
  try {
    result = await browserDriver.executeFlow({
      task: normalizedTask,
      checkpointId,
      attempt: 0,
      mode: 'episode',
    });
  } catch (error) {
    throw new Error(`browser infrastructure: ${error.message}`);
  }

  const evidence = validateBrowserEvidence(result.evidence);
  const boundaryEpisode = evidence.terminal_status === 'validation_error';
  const teacherTrigger = buildTeacherTrigger({
    terminalStatus: evidence.terminal_status,
    boundaryEpisode,
  });
  const replayRoute = result.safety_violation ? 'diagnostic_only' : 'neutral';
  const normative = buildNormativeFields({
    task: normalizedTask,
    terminalReward: result.terminal_reward,
    boundaryEpisode,
    safetyViolation: Boolean(result.safety_violation),
    safetyViolationReason: result.safety_violation ? result.safety_violation_reason : null,
    comparisonStatus: 'completed',
    relativeOutcome: 'same',
    replayRoute,
    teacherTrigger,
  });

  return {
    ...normative,
    task_id: normalizedTask.task_id,
    checkpoint_id: checkpointId,
    target_site: normalizedTask.target_site,
    flow_id: normalizedTask.flow_id,
    start_url: normalizedTask.start_url,
    comparison_start_url: normalizedTask.comparison_start_url,
    auth_state_class: normalizedTask.auth_state_class,
    input_payload: normalizedTask.input_payload,
    evidence,
    human_handoff_required: Boolean(result.human_handoff_required),
  };
}

export async function compareBrowserAgainstReference({
  task,
  activeCheckpointId,
  preUpdateRefCheckpointId,
  browserDriver = createFixtureBrowserDriver(),
}) {
  const normalizedTask = validateBrowserTask(task);
  assertDriver(browserDriver);
  const pinned_inputs = {
    target_site: normalizedTask.target_site,
    flow_id: normalizedTask.flow_id,
    start_url: normalizedTask.start_url,
    comparison_start_url: normalizedTask.comparison_start_url,
    auth_state_class: normalizedTask.auth_state_class,
    input_payload: normalizedTask.input_payload,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let activeResult;
    let referenceResult;
    try {
      activeResult = await browserDriver.executeFlow({
        task: normalizedTask,
        checkpointId: activeCheckpointId,
        attempt,
        mode: 'comparison',
      });
      referenceResult = await browserDriver.executeFlow({
        task: normalizedTask,
        checkpointId: preUpdateRefCheckpointId,
        attempt,
        mode: 'comparison',
      });
    } catch (error) {
      throw new Error(`browser infrastructure: ${error.message}`);
    }

    const activeEvidence = validateBrowserEvidence(activeResult.evidence);
    const referenceEvidence = validateBrowserEvidence(referenceResult.evidence);
    const requiresHuman = Boolean(activeResult.human_handoff_required || referenceResult.human_handoff_required);
    const challengeDivergence = activeEvidence.challenge_state !== 'none' || referenceEvidence.challenge_state !== 'none';

    if (requiresHuman || challengeDivergence) {
      if (attempt === 0) {
        continue;
      }
      return {
        comparison_status: 'comparison_failed',
        relative_outcome: null,
        replay_route: 'diagnostic_only',
        human_handoff_required: true,
        pinned_inputs,
      };
    }

    const relative_outcome = activeResult.terminal_reward > referenceResult.terminal_reward
      ? 'better'
      : activeResult.terminal_reward < referenceResult.terminal_reward
        ? 'worse'
        : 'same';
    return {
      comparison_status: 'completed',
      relative_outcome,
      replay_route: relative_outcome === 'better' ? 'positive' : relative_outcome === 'worse' ? 'negative' : 'neutral',
      human_handoff_required: false,
      active_terminal_status: activeEvidence.terminal_status,
      reference_terminal_status: referenceEvidence.terminal_status,
      pinned_inputs,
    };
  }

  return {
    comparison_status: 'comparison_failed',
    relative_outcome: null,
    replay_route: 'diagnostic_only',
    human_handoff_required: true,
    pinned_inputs,
  };
}

export function buildBrowserReplayCandidate({ episode, comparison }) {
  const replay_route = comparison?.replay_route || classifyReplayRoute({
    ...episode,
    ...comparison,
  });
  return validateReplayCandidate({
    replay_route,
    training_admission: replay_route !== 'diagnostic_only',
  });
}

export function summarizeBrowserEnvironmentEvidence({ episode, comparison }) {
  return {
    flow_id: episode.flow_id,
    target_site: episode.target_site,
    terminal_status: episode.evidence?.terminal_status || null,
    comparison_status: comparison?.comparison_status || episode.comparison_status,
    relative_outcome: comparison?.relative_outcome ?? episode.relative_outcome ?? null,
  };
}

export function createBrowserAdapter({ tasks = loadBrowserTasks(), browserDriver = createFixtureBrowserDriver() } = {}) {
  return {
    environment: 'browser',
    loadTasks: () => loadBrowserTasks({ tasks }),
    sampleTask({ seed = 0, attempt = 0 } = {}) {
      return sampleBrowserTask({ seed, attempt, tasks });
    },
    runEpisode({ task, checkpointId }) {
      return runBrowserEpisode({ task, checkpointId, browserDriver });
    },
    compareAgainstReference({ task, activeCheckpointId, preUpdateRefCheckpointId }) {
      return compareBrowserAgainstReference({
        task,
        activeCheckpointId,
        preUpdateRefCheckpointId,
        browserDriver,
      });
    },
    buildReplayCandidate: buildBrowserReplayCandidate,
    summarizeEnvironmentEvidence: summarizeBrowserEnvironmentEvidence,
  };
}

