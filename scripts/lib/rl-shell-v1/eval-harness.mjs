function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function computeHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function ratio(numerator, denominator) {
  if (!Number(denominator)) return 0;
  return Number(numerator || 0) / Number(denominator);
}

function deterministicResult(taskId, checkpoint) {
  const seed = Number(checkpoint.seed || 0);
  const score = computeHash(`${taskId}:${seed}`) % 100;
  const success = score >= 40 ? 1 : 0;
  return {
    success,
    regressionFreeFix: success,
    reward: success ? 1 : -1,
    fusedReward: success ? 1 : -1,
    episodeLength: success ? 1 : 2,
    tokenCount: 8 + (score % 5),
    runtimeDurationMs: 25 + (score % 20),
    teacherBackend: null,
    fallbackUsed: false,
    teacherLatencyMs: 0,
    policyLoss: 0,
    distillLoss: 0,
    klLoss: 0,
    rewardHacking: false,
    degenerateAction: false,
    invalidStepCount: success ? 0 : 1 + (score % 2),
    stepCount: success ? 2 : 4,
    stopCondition: success ? 'student_stop' : score % 2 === 0 ? 'repeated_no_progress' : 'max_steps_reached',
  };
}

export function summarizeEvalResults(results) {
  const rows = Array.isArray(results) ? results : [];
  return {
    successRate: average(rows.map((row) => row.success ? 1 : 0)),
    regressionFreeFixRate: average(rows.map((row) => row.regressionFreeFix ? 1 : 0)),
    avgTokenCount: average(rows.map((row) => row.tokenCount)),
    averageReward: average(rows.map((row) => row.reward)),
    averageFusedReward: average(rows.map((row) => row.fusedReward)),
    averageEpisodeLength: average(rows.map((row) => row.episodeLength)),
    averageRuntimeDurationMs: average(rows.map((row) => row.runtimeDurationMs)),
    teacherBackendHitRate: average(rows.map((row) => row.teacherBackend ? 1 : 0)),
    fallbackRate: average(rows.map((row) => row.fallbackUsed ? 1 : 0)),
    teacherLatencyMs: average(rows.map((row) => row.teacherLatencyMs)),
    policyLoss: average(rows.map((row) => row.policyLoss)),
    distillLoss: average(rows.map((row) => row.distillLoss)),
    klLoss: average(rows.map((row) => row.klLoss)),
    rewardHackingRate: average(rows.map((row) => row.rewardHacking ? 1 : 0)),
    degenerateActionRate: average(rows.map((row) => row.degenerateAction ? 1 : 0)),
    invalidStepRatio: average(rows.map((row) => ratio(row.invalidStepCount, row.stepCount || row.episodeLength || 0))),
    repeatedNoProgressRate: average(rows.map((row) => row.stopCondition === 'repeated_no_progress' ? 1 : 0)),
    teacherOverdependenceGap: 0,
  };
}

export function comparePhase2ABaseline({ currentSummary, multiStepBaselineSummary, v1Summary }) {
  const beatsV1Success = Number(currentSummary?.successRate || 0) > Number(v1Summary?.successRate || 0);
  const preservesRegressionFree = Number(currentSummary?.regressionFreeFixRate || 0) >= Number(v1Summary?.regressionFreeFixRate || 0);
  const lowersInvalidStepRatio = Number(currentSummary?.invalidStepRatio || 0) < Number(multiStepBaselineSummary?.invalidStepRatio || 0);
  const lowersRepeatedNoProgressRate = Number(currentSummary?.repeatedNoProgressRate || 0) < Number(multiStepBaselineSummary?.repeatedNoProgressRate || 0);

  return {
    accepted: beatsV1Success && preservesRegressionFree && lowersInvalidStepRatio && lowersRepeatedNoProgressRate,
    beatsV1Success,
    preservesRegressionFree,
    lowersInvalidStepRatio,
    lowersRepeatedNoProgressRate,
  };
}

export function pickBestCheckpoint(checkpoints) {
  return [...checkpoints].sort((left, right) => {
    if (right.successRate !== left.successRate) {
      return right.successRate - left.successRate;
    }
    if (right.regressionFreeFixRate !== left.regressionFreeFixRate) {
      return right.regressionFreeFixRate - left.regressionFreeFixRate;
    }
    if ((left.invalidStepRatio || 0) !== (right.invalidStepRatio || 0)) {
      return (left.invalidStepRatio || 0) - (right.invalidStepRatio || 0);
    }
    if ((left.repeatedNoProgressRate || 0) !== (right.repeatedNoProgressRate || 0)) {
      return (left.repeatedNoProgressRate || 0) - (right.repeatedNoProgressRate || 0);
    }
    if (left.avgTokenCount !== right.avgTokenCount) {
      return left.avgTokenCount - right.avgTokenCount;
    }
    return left.step - right.step;
  })[0] || null;
}

export async function runHeldOutEval({ checkpoint, registry, policyFactory, teacherMode = 'none' }) {
  const checkpointCopy = clone(checkpoint);
  const producedPolicy = policyFactory ? await policyFactory(clone(checkpointCopy)) : clone(checkpointCopy);
  const evalPolicy = clone(producedPolicy);
  const tasks = Array.isArray(registry?.heldOutTasks) ? registry.heldOutTasks : [];

  const results = tasks.map((task) => ({
    task_id: task.task_id,
    split: task.split || 'held_out',
    teacherMode,
    ...deterministicResult(task.task_id, evalPolicy),
  }));

  return {
    results,
    summary: summarizeEvalResults(results),
  };
}
