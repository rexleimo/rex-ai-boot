import { normalizeHandoffPayload, validateHandoffPayload } from './handoff.mjs';
import {
  LOCAL_MERGE_GATE_EXECUTOR,
  LOCAL_PHASE_EXECUTOR,
  createLocalDispatchExecutorRegistry,
  listLocalDispatchExecutors,
  resolveLocalDispatchExecutor,
} from './orchestrator-executors.mjs';

export const ORCHESTRATOR_ROLE_IDS = ['planner', 'implementer', 'reviewer', 'security-reviewer'];
export const ORCHESTRATOR_BLUEPRINT_NAMES = ['feature', 'bugfix', 'refactor', 'security'];
export const ORCHESTRATOR_FORMATS = ['text', 'json'];
export { LOCAL_PHASE_EXECUTOR, LOCAL_MERGE_GATE_EXECUTOR } from './orchestrator-executors.mjs';
export const MERGE_GATE_BLOCK_STATUSES = ['blocked', 'needs-input'];
export const MERGE_GATE_CONFLICT_RULE = 'overlapping file ownership blocks parallel merge';

export const ROLE_CARDS = {
  planner: {
    id: 'planner',
    label: 'Planner',
    responsibility: 'Clarify scope, risks, dependencies, and execution order before code changes.',
    ownership: 'Plans, scope boundaries, and work breakdown.',
  },
  implementer: {
    id: 'implementer',
    label: 'Implementer',
    responsibility: 'Own code changes inside the agreed file scope and report concrete results.',
    ownership: 'Production code, tests, and local verification for owned files.',
  },
  reviewer: {
    id: 'reviewer',
    label: 'Reviewer',
    responsibility: 'Review correctness, regressions, maintainability, and test coverage.',
    ownership: 'Findings only; does not own source edits in the orchestration contract.',
  },
  'security-reviewer': {
    id: 'security-reviewer',
    label: 'Security Reviewer',
    responsibility: 'Review auth, data handling, secrets, injection risks, and unsafe automation.',
    ownership: 'Security findings only; does not own source edits in the orchestration contract.',
  },
};

export const ORCHESTRATOR_BLUEPRINTS = {
  feature: {
    name: 'feature',
    description: 'Plan implementation first, then execute, then review quality and security in parallel.',
    phases: [
      { id: 'plan', role: 'planner', mode: 'sequential' },
      { id: 'implement', role: 'implementer', mode: 'sequential' },
      { id: 'review', role: 'reviewer', mode: 'parallel', group: 'final-checks' },
      { id: 'security', role: 'security-reviewer', mode: 'parallel', group: 'final-checks' },
    ],
  },
  bugfix: {
    name: 'bugfix',
    description: 'Reproduce and scope the bug first, implement the fix, then review correctness.',
    phases: [
      { id: 'plan', role: 'planner', mode: 'sequential' },
      { id: 'implement', role: 'implementer', mode: 'sequential' },
      { id: 'review', role: 'reviewer', mode: 'parallel', group: 'final-checks' },
    ],
  },
  refactor: {
    name: 'refactor',
    description: 'Plan safe refactor boundaries, implement small changes, then review design and regressions.',
    phases: [
      { id: 'plan', role: 'planner', mode: 'sequential' },
      { id: 'implement', role: 'implementer', mode: 'sequential' },
      { id: 'review', role: 'reviewer', mode: 'parallel', group: 'final-checks' },
    ],
  },
  security: {
    name: 'security',
    description: 'Lead with security review, scope required changes, then implement and re-review.',
    phases: [
      { id: 'security-assessment', role: 'security-reviewer', mode: 'sequential' },
      { id: 'plan', role: 'planner', mode: 'sequential' },
      { id: 'implement', role: 'implementer', mode: 'sequential' },
      { id: 'review', role: 'reviewer', mode: 'parallel', group: 'final-checks' },
    ],
  },
};

export function normalizeOrchestratorBlueprint(raw = 'feature') {
  const value = String(raw || 'feature').trim().toLowerCase();
  if (!ORCHESTRATOR_BLUEPRINT_NAMES.includes(value)) {
    throw new Error(`orchestrate blueprint must be one of: ${ORCHESTRATOR_BLUEPRINT_NAMES.join(', ')}`);
  }
  return value;
}

export function normalizeOrchestratorFormat(raw = 'text') {
  const value = String(raw || 'text').trim().toLowerCase();
  if (!ORCHESTRATOR_FORMATS.includes(value)) {
    throw new Error(`--format must be one of: ${ORCHESTRATOR_FORMATS.join(', ')}`);
  }
  return value;
}

export function getRoleCard(roleId) {
  const role = ROLE_CARDS[String(roleId || '').trim().toLowerCase()];
  if (!role) {
    throw new Error(`Unknown orchestrator role: ${roleId}`);
  }
  return role;
}

export function getOrchestratorBlueprint(name = 'feature') {
  const blueprint = ORCHESTRATOR_BLUEPRINTS[normalizeOrchestratorBlueprint(name)];
  return {
    ...blueprint,
    phases: blueprint.phases.map((phase) => ({ ...phase, roleCard: getRoleCard(phase.role) })),
  };
}

function normalizeLearnEvalOverlay(rawOverlay) {
  if (!rawOverlay || typeof rawOverlay !== 'object') {
    return null;
  }

  const appliedRecommendations = Array.isArray(rawOverlay.appliedRecommendations)
    ? rawOverlay.appliedRecommendations.map((item) => ({ ...item }))
    : [];

  return {
    sourceSessionId: String(rawOverlay.sourceSessionId || '').trim(),
    sourceGoal: String(rawOverlay.sourceGoal || '').trim(),
    selectedRecommendationId: rawOverlay.selectedRecommendationId ? String(rawOverlay.selectedRecommendationId).trim() : null,
    appliedRecommendationIds: Array.isArray(rawOverlay.appliedRecommendationIds)
      ? rawOverlay.appliedRecommendationIds.map((item) => String(item))
      : appliedRecommendations.map((item) => item.targetId),
    appliedRecommendations,
  };
}

function normalizeDispatchPlan(rawPlan) {
  if (!rawPlan || typeof rawPlan !== 'object') {
    return null;
  }

  return {
    ...rawPlan,
    notes: Array.isArray(rawPlan.notes) ? [...rawPlan.notes] : [],
    executorRegistry: Array.isArray(rawPlan.executorRegistry) ? [...rawPlan.executorRegistry] : [],
    executorDetails: Array.isArray(rawPlan.executorDetails)
      ? rawPlan.executorDetails.map((item) => ({
        ...item,
        executionModes: Array.isArray(item.executionModes) ? [...item.executionModes] : [],
        jobTypes: Array.isArray(item.jobTypes) ? [...item.jobTypes] : [],
        supportedRoles: Array.isArray(item.supportedRoles) ? [...item.supportedRoles] : [],
        outputTypes: Array.isArray(item.outputTypes) ? [...item.outputTypes] : [],
      }))
      : [],
    jobs: Array.isArray(rawPlan.jobs)
      ? rawPlan.jobs.map((job) => ({
        ...job,
        dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
        outputs: Array.isArray(job.outputs) ? [...job.outputs] : [],
        launchSpec: job.launchSpec ? { ...job.launchSpec } : {},
      }))
      : [],
  };
}

function normalizeDispatchRuntime(rawRuntime) {
  if (!rawRuntime || typeof rawRuntime !== 'object') {
    return null;
  }

  return {
    id: String(rawRuntime.id || '').trim(),
    label: String(rawRuntime.label || '').trim(),
    requiresModel: rawRuntime.requiresModel === true,
    executionMode: rawRuntime.executionMode ? String(rawRuntime.executionMode) : null,
  };
}

function normalizeDispatchRun(rawRun) {
  if (!rawRun || typeof rawRun !== 'object') {
    return null;
  }

  return {
    ...rawRun,
    runtime: normalizeDispatchRuntime(rawRun.runtime),
    executorRegistry: Array.isArray(rawRun.executorRegistry) ? [...rawRun.executorRegistry] : [],
    executorDetails: Array.isArray(rawRun.executorDetails)
      ? rawRun.executorDetails.map((item) => ({
        ...item,
        executionModes: Array.isArray(item.executionModes) ? [...item.executionModes] : [],
        jobTypes: Array.isArray(item.jobTypes) ? [...item.jobTypes] : [],
        supportedRoles: Array.isArray(item.supportedRoles) ? [...item.supportedRoles] : [],
        outputTypes: Array.isArray(item.outputTypes) ? [...item.outputTypes] : [],
      }))
      : [],
    finalOutputs: Array.isArray(rawRun.finalOutputs) ? rawRun.finalOutputs.map((item) => ({ ...item })) : [],
    jobRuns: Array.isArray(rawRun.jobRuns)
      ? rawRun.jobRuns.map((jobRun) => ({
        ...jobRun,
        dependsOn: Array.isArray(jobRun.dependsOn) ? [...jobRun.dependsOn] : [],
        inputSummary: jobRun.inputSummary ? { ...jobRun.inputSummary } : {},
        output: jobRun.output ? { ...jobRun.output } : null,
      }))
      : [],
  };
}

function normalizeDispatchEvidence(rawEvidence) {
  if (!rawEvidence || typeof rawEvidence !== 'object') {
    return null;
  }

  return {
    ...rawEvidence,
    persisted: rawEvidence.persisted === true,
    mode: rawEvidence.mode ? String(rawEvidence.mode) : null,
    reason: rawEvidence.reason ? String(rawEvidence.reason) : null,
    artifactPath: rawEvidence.artifactPath ? String(rawEvidence.artifactPath) : null,
    eventKind: rawEvidence.eventKind ? String(rawEvidence.eventKind) : null,
    eventId: rawEvidence.eventId ? String(rawEvidence.eventId) : null,
    checkpointId: rawEvidence.checkpointId ? String(rawEvidence.checkpointId) : null,
    checkpointStatus: rawEvidence.checkpointStatus ? String(rawEvidence.checkpointStatus) : null,
    error: rawEvidence.error ? String(rawEvidence.error) : null,
  };
}

function normalizeDispatchPolicy(rawPolicy) {
  if (!rawPolicy || typeof rawPolicy !== 'object') {
    return null;
  }

  return {
    status: rawPolicy.status ? String(rawPolicy.status) : 'caution',
    parallelism: rawPolicy.parallelism ? String(rawPolicy.parallelism) : 'parallel-with-merge-gate',
    blockerIds: Array.isArray(rawPolicy.blockerIds) ? rawPolicy.blockerIds.map((item) => String(item)) : [],
    advisoryIds: Array.isArray(rawPolicy.advisoryIds) ? rawPolicy.advisoryIds.map((item) => String(item)) : [],
    requiredActions: Array.isArray(rawPolicy.requiredActions)
      ? rawPolicy.requiredActions.map((item) => ({
        type: item?.type ? String(item.type) : 'command',
        action: String(item?.action || ''),
        sourceId: item?.sourceId ? String(item.sourceId) : null,
      }))
      : [],
    executorPreferences: Array.isArray(rawPolicy.executorPreferences)
      ? rawPolicy.executorPreferences.map((item) => ({
        executor: String(item?.executor || ''),
        confidence: item?.confidence ? String(item.confidence) : 'planned',
        observedCount: Number.isFinite(item?.observedCount) ? item.observedCount : 0,
        source: item?.source ? String(item.source) : 'dispatch-plan',
      }))
      : [],
    notes: Array.isArray(rawPolicy.notes) ? rawPolicy.notes.map((item) => String(item)) : [],
  };
}

function normalizeDispatchPreflight(rawPreflight) {
  if (!rawPreflight || typeof rawPreflight !== 'object') {
    return null;
  }

  return {
    mode: rawPreflight.mode ? String(rawPreflight.mode) : 'none',
    results: Array.isArray(rawPreflight.results)
      ? rawPreflight.results.map((item) => ({
        type: item?.type ? String(item.type) : 'command',
        sourceId: item?.sourceId ? String(item.sourceId) : null,
        action: String(item?.action || ''),
        status: item?.status ? String(item.status) : 'skipped',
        runner: item?.runner ? String(item.runner) : 'unsupported',
        summary: item?.summary ? String(item.summary) : '',
        exitCode: Number.isFinite(item?.exitCode) ? item.exitCode : null,
      }))
      : [],
  };
}

function collectExecutorDetails(jobs = []) {
  const usedExecutorIds = new Set(
    jobs.map((job) => String(job?.launchSpec?.executor || '').trim()).filter(Boolean)
  );

  return listLocalDispatchExecutors().filter((executor) => usedExecutorIds.has(executor.id));
}

export function buildOrchestrationPlan({
  blueprint = 'feature',
  taskTitle = '',
  contextSummary = '',
  learnEvalOverlay = null,
  dispatchPlan = null,
  dispatchRun = null,
  dispatchEvidence = null,
  dispatchPolicy = null,
  dispatchPreflight = null,
  effectiveDispatchPolicy = null,
} = {}) {
  const resolved = getOrchestratorBlueprint(blueprint);
  return {
    blueprint: resolved.name,
    description: resolved.description,
    taskTitle: String(taskTitle || '').trim() || 'Untitled task',
    contextSummary: String(contextSummary || '').trim(),
    learnEvalOverlay: normalizeLearnEvalOverlay(learnEvalOverlay),
    dispatchPlan: normalizeDispatchPlan(dispatchPlan),
    dispatchRun: normalizeDispatchRun(dispatchRun),
    dispatchEvidence: normalizeDispatchEvidence(dispatchEvidence),
    dispatchPolicy: normalizeDispatchPolicy(dispatchPolicy),
    dispatchPreflight: normalizeDispatchPreflight(dispatchPreflight),
    effectiveDispatchPolicy: normalizeDispatchPolicy(effectiveDispatchPolicy),
    phases: resolved.phases.map((phase, index) => ({
      step: index + 1,
      id: phase.id,
      role: phase.role,
      mode: phase.mode,
      group: phase.group || null,
      label: phase.roleCard.label,
      responsibility: phase.roleCard.responsibility,
      ownership: phase.roleCard.ownership,
    })),
  };
}

function createPhaseJob(plan, phase, dependsOn = [], handoffTarget = 'next-phase', modeOverride = null) {
  const contextSources = ['orchestration-plan'];
  if (plan.learnEvalOverlay) {
    contextSources.push('learn-eval-overlay');
  }

  const mode = modeOverride || phase.mode;

  return {
    jobId: `phase.${phase.id}`,
    jobType: 'phase',
    step: phase.step,
    phaseId: phase.id,
    role: phase.role,
    label: phase.label,
    mode,
    group: mode === 'parallel' ? phase.group : null,
    dependsOn: [...dependsOn],
    status: 'pending',
    outputs: ['handoff'],
    launchSpec: {
      executor: LOCAL_PHASE_EXECUTOR,
      requiresModel: false,
      inputs: contextSources,
      outputType: 'handoff',
      handoffTarget,
      promptSeed: `${phase.label}: ${phase.responsibility} Ownership: ${phase.ownership}`,
    },
  };
}

function createMergeGateJob(groupName, dependsOn = []) {
  return {
    jobId: `merge.${groupName}`,
    jobType: 'merge-gate',
    step: null,
    phaseId: null,
    role: 'merge-gate',
    label: 'Merge Gate',
    mode: 'sequential',
    group: groupName,
    dependsOn: [...dependsOn],
    status: 'pending',
    outputs: ['merged-handoff'],
    launchSpec: {
      executor: LOCAL_MERGE_GATE_EXECUTOR,
      requiresModel: false,
      inputs: ['parallel-handoffs'],
      outputType: 'merged-handoff',
      promptSeed: 'Validate handoff statuses and overlapping file ownership before merge.',
      blockStatuses: [...MERGE_GATE_BLOCK_STATUSES],
      conflictRule: MERGE_GATE_CONFLICT_RULE,
    },
  };
}

function getDispatchParallelism(plan) {
  return plan?.dispatchPolicy?.parallelism === 'serial-only'
    ? 'serial-only'
    : 'parallel-with-merge-gate';
}

export function buildLocalDispatchPlan(input = {}) {
  const plan = Array.isArray(input.phases) ? input : buildOrchestrationPlan(input);
  const parallelism = getDispatchParallelism(plan);
  const jobs = [];
  const notes = ['Skeleton only; no model runtime is invoked.'];
  let upstreamJobIds = [];
  let openParallelGroup = null;

  if (parallelism === 'serial-only') {
    notes.push('Policy applied: serial-only; grouped parallel phases are emitted as sequential jobs.');
  }

  const flushParallelGroup = () => {
    if (!openParallelGroup) {
      return;
    }

    if (openParallelGroup.jobIds.length > 1) {
      const mergeGateJob = createMergeGateJob(openParallelGroup.name, openParallelGroup.jobIds);
      jobs.push(mergeGateJob);
      upstreamJobIds = [mergeGateJob.jobId];
    } else {
      const job = jobs.find((item) => item.jobId === openParallelGroup.jobIds[0]);
      if (job) {
        job.launchSpec.handoffTarget = 'next-phase';
      }
      upstreamJobIds = [...openParallelGroup.jobIds];
    }

    openParallelGroup = null;
  };

  for (const phase of plan.phases) {
    const groupedParallel = phase.mode === 'parallel' && phase.group && parallelism === 'parallel-with-merge-gate';
    const policySerializedParallel = phase.mode === 'parallel' && phase.group && parallelism === 'serial-only';

    if (groupedParallel) {
      if (!openParallelGroup || openParallelGroup.name !== phase.group) {
        flushParallelGroup();
        openParallelGroup = {
          name: phase.group,
          upstreamJobIds: [...upstreamJobIds],
          jobIds: [],
        };
      }

      const job = createPhaseJob(plan, phase, openParallelGroup.upstreamJobIds, 'merge-gate');
      jobs.push(job);
      openParallelGroup.jobIds.push(job.jobId);
      continue;
    }

    flushParallelGroup();
    const job = createPhaseJob(
      plan,
      phase,
      upstreamJobIds,
      'next-phase',
      policySerializedParallel ? 'sequential' : null
    );
    jobs.push(job);
    upstreamJobIds = [job.jobId];
  }

  flushParallelGroup();

  const executorDetails = collectExecutorDetails(jobs);

  return {
    mode: 'local',
    readyForExecution: false,
    notes,
    executorRegistry: executorDetails.map((executor) => executor.id),
    executorDetails,
    mergeGate: {
      blockStatuses: [...MERGE_GATE_BLOCK_STATUSES],
      conflictRule: MERGE_GATE_CONFLICT_RULE,
    },
    jobs,
  };
}


export function createHandoffFromPhase(plan, phase, overrides = {}) {
  return normalizeHandoffPayload({
    fromRole: overrides.fromRole || phase.role,
    toRole: overrides.toRole || 'next-phase',
    taskTitle: plan.taskTitle,
    contextSummary: overrides.contextSummary || plan.contextSummary || phase.responsibility,
    findings: overrides.findings || [],
    filesTouched: overrides.filesTouched || [],
    openQuestions: overrides.openQuestions || [],
    recommendations: overrides.recommendations || [`Continue with ${phase.label.toLowerCase()}`],
    status: overrides.status || 'ready',
  });
}

export function mergeParallelHandoffs(handoffs = []) {
  const validated = handoffs.map((handoff) => {
    const result = validateHandoffPayload(handoff);
    if (!result.ok) {
      throw new Error(`Invalid handoff payload: ${result.errors.join('; ')}`);
    }
    return result.value;
  });

  const blocked = validated.filter((handoff) => handoff.status === 'blocked' || handoff.status === 'needs-input');
  const fileOwners = new Map();
  const conflicts = [];

  for (const handoff of validated) {
    for (const filePath of handoff.filesTouched) {
      const previousOwner = fileOwners.get(filePath);
      if (previousOwner && previousOwner !== handoff.fromRole) {
        conflicts.push({ filePath, owners: [previousOwner, handoff.fromRole] });
        continue;
      }
      fileOwners.set(filePath, handoff.fromRole);
    }
  }

  return {
    ok: blocked.length === 0 && conflicts.length === 0,
    blocked,
    conflicts,
    mergedFindings: validated.flatMap((handoff) => handoff.findings),
    mergedRecommendations: validated.flatMap((handoff) => handoff.recommendations),
    touchedFiles: [...fileOwners.keys()],
  };
}

function getPhaseForJob(plan, job) {
  return plan.phases.find((phase) => phase.id === job.phaseId);
}

function executePhaseJob(plan, job) {
  const phase = getPhaseForJob(plan, job);
  if (!phase) {
    throw new Error(`Unknown orchestration phase for job: ${job.jobId}`);
  }

  const payload = createHandoffFromPhase(plan, phase, {
    toRole: job.launchSpec.handoffTarget || 'next-phase',
    status: 'completed',
    contextSummary: `Dry-run placeholder for ${job.jobId}. ${phase.responsibility}`,
    findings: [`No model execution; synthetic output for ${job.jobId}.`],
    recommendations: [`Executor interface ready for ${job.role}.`],
  });

  return {
    status: 'simulated',
    output: {
      outputType: job.launchSpec.outputType,
      payload,
    },
  };
}

function executeMergeGateJob(plan, job, dependencyRuns = []) {
  const handoffs = dependencyRuns
    .map((run) => run?.output?.payload)
    .filter(Boolean);
  const mergeResult = mergeParallelHandoffs(handoffs);

  const payload = normalizeHandoffPayload({
    status: mergeResult.ok ? 'completed' : 'blocked',
    fromRole: 'merge-gate',
    toRole: 'complete',
    taskTitle: plan.taskTitle,
    contextSummary: mergeResult.ok
      ? `Dry-run merge gate passed for ${job.group}.`
      : `Dry-run merge gate blocked for ${job.group}.`,
    findings: mergeResult.mergedFindings,
    filesTouched: mergeResult.touchedFiles,
    recommendations: mergeResult.mergedRecommendations,
  });

  return {
    status: mergeResult.ok ? 'simulated' : 'blocked',
    output: {
      outputType: job.launchSpec.outputType,
      payload,
      mergeResult: {
        ok: mergeResult.ok,
        blockedCount: mergeResult.blocked.length,
        conflictCount: mergeResult.conflicts.length,
        touchedFiles: mergeResult.touchedFiles,
      },
    },
  };
}

function createLocalDryRunRuntimeInfo() {
  return {
    id: 'local-dry-run',
    label: 'Local Dry Run Runtime',
    requiresModel: false,
    executionMode: 'dry-run',
  };
}

export function executeLocalDispatchPlan(input = {}, rawDispatchPlan = null) {
  const plan = Array.isArray(input.phases) ? input : buildOrchestrationPlan(input);
  const dispatchPlan = normalizeDispatchPlan(rawDispatchPlan || plan.dispatchPlan || buildLocalDispatchPlan(plan));
  const registry = createLocalDispatchExecutorRegistry({
    executePhaseJob,
    executeMergeGateJob,
  });
  const jobRuns = [];
  const jobRunMap = new Map();

  for (const job of dispatchPlan.jobs) {
    const dependencyRuns = job.dependsOn
      .map((jobId) => jobRunMap.get(jobId))
      .filter(Boolean);
    const phase = job.jobType === 'phase' ? getPhaseForJob(plan, job) : null;
    const executor = resolveLocalDispatchExecutor(job, registry);
    const execution = executor.execute({
      plan,
      job,
      phase,
      dependencyRuns,
    });

    const jobRun = {
      jobId: job.jobId,
      jobType: job.jobType,
      role: job.role,
      executor: executor.id,
      executorLabel: executor.label,
      dependsOn: [...job.dependsOn],
      status: execution.status,
      inputSummary: {
        dependencyCount: dependencyRuns.length,
        inputTypes: Array.isArray(job.launchSpec.inputs) ? [...job.launchSpec.inputs] : [],
      },
      output: execution.output,
    };

    jobRuns.push(jobRun);
    jobRunMap.set(job.jobId, jobRun);
  }

  const executorDetails = collectExecutorDetails(dispatchPlan.jobs);

  return {
    mode: 'dry-run',
    runtime: createLocalDryRunRuntimeInfo(),
    ok: jobRuns.every((jobRun) => jobRun.status !== 'blocked'),
    executorRegistry: executorDetails.map((executor) => executor.id),
    executorDetails,
    jobRuns,
    finalOutputs: jobRuns
      .filter((jobRun) => jobRun.output?.outputType === 'merged-handoff' || jobRun.jobType === 'phase')
      .map((jobRun) => ({ jobId: jobRun.jobId, outputType: jobRun.output?.outputType || 'unknown' })),
  };
}

function buildRequiredActions(recommendations = []) {
  const seen = new Set();
  const actions = [];

  for (const item of recommendations) {
    if (item?.nextCommand) {
      const key = `command:${item.nextCommand}`;
      if (!seen.has(key)) {
        seen.add(key);
        actions.push({ type: 'command', action: item.nextCommand, sourceId: item.targetId || null });
      }
    }

    if (item?.nextArtifact) {
      const key = `artifact:${item.nextArtifact}`;
      if (!seen.has(key)) {
        seen.add(key);
        actions.push({ type: 'artifact', action: item.nextArtifact, sourceId: item.targetId || null });
      }
    }
  }

  return actions;
}

function buildExecutorPreferences(dispatchPlan, dispatchSignals = {}, dispatchRun = null) {
  const normalizedPlan = normalizeDispatchPlan(dispatchPlan);
  if (!normalizedPlan) {
    return [];
  }

  const counts = new Map(
    (Array.isArray(dispatchSignals.executorUsage) ? dispatchSignals.executorUsage : [])
      .map((item) => [String(item.executor || '').trim(), Number(item.count) || 0])
      .filter(([executor]) => executor)
  );

  for (const jobRun of Array.isArray(dispatchRun?.jobRuns) ? dispatchRun.jobRuns : []) {
    const executor = String(jobRun?.executor || '').trim();
    if (!executor) continue;
    counts.set(executor, (counts.get(executor) || 0) + 1);
  }

  const executorIds = normalizedPlan.executorDetails.length > 0
    ? normalizedPlan.executorDetails.map((item) => item.id)
    : normalizedPlan.executorRegistry;

  return executorIds
    .map((executor) => {
      const observedCount = counts.get(executor) || 0;
      return {
        executor,
        confidence: observedCount > 0 ? 'observed' : 'planned',
        observedCount,
        source: observedCount > 0 ? 'dispatch-evidence' : 'dispatch-plan',
      };
    })
    .sort((left, right) => right.observedCount - left.observedCount || left.executor.localeCompare(right.executor));
}

export function buildEffectiveDispatchPolicy({ dispatchPolicy = null, dispatchPreflight = null, learnEvalReport = null } = {}) {
  const rawPolicy = normalizeDispatchPolicy(dispatchPolicy);
  if (!rawPolicy) {
    return null;
  }

  const preflight = normalizeDispatchPreflight(dispatchPreflight);
  if (!preflight || preflight.results.length === 0) {
    return rawPolicy;
  }

  const passedIds = new Set(
    preflight.results
      .filter((item) => item.status === 'passed' && item.sourceId)
      .map((item) => item.sourceId)
  );
  const failedIds = new Set(
    preflight.results
      .filter((item) => item.status === 'failed' && item.sourceId)
      .map((item) => item.sourceId)
  );
  const skippedIds = new Set(
    preflight.results
      .filter((item) => item.status === 'skipped' && item.sourceId)
      .map((item) => item.sourceId)
  );
  const unresolvedBlockers = rawPolicy.blockerIds.filter((item) => !passedIds.has(item));
  const resolvedBlockers = rawPolicy.blockerIds.filter((item) => passedIds.has(item));
  const unresolvedActions = rawPolicy.requiredActions.filter((item) => !item.sourceId || unresolvedBlockers.includes(item.sourceId));

  let status = 'caution';
  if (unresolvedBlockers.length > 0) {
    status = 'blocked';
  } else if ((Number(learnEvalReport?.signals?.dispatch?.runs) || 0) > 0) {
    status = 'ready';
  }

  const notes = [...rawPolicy.notes];
  if (resolvedBlockers.length > 0) {
    notes.push(`Preflight resolved blockers: ${resolvedBlockers.join(', ')}.`);
  }
  if (failedIds.size > 0) {
    notes.push(`Preflight still failing: ${[...failedIds].join(', ')}.`);
  }
  if (skippedIds.size > 0) {
    notes.push(`Preflight skipped: ${[...skippedIds].join(', ')}.`);
  }

  return normalizeDispatchPolicy({
    ...rawPolicy,
    status,
    parallelism: unresolvedBlockers.includes('runbook.dispatch-merge-triage') ? 'serial-only' : 'parallel-with-merge-gate',
    blockerIds: unresolvedBlockers,
    requiredActions: unresolvedActions,
    notes,
  });
}

export function buildDispatchPolicy({ learnEvalReport = null, learnEvalOverlay = null, dispatchPlan = null, dispatchRun = null } = {}) {
  if (!learnEvalReport && !learnEvalOverlay && !dispatchPlan && !dispatchRun) {
    return null;
  }

  const recommendations = Array.isArray(learnEvalOverlay?.appliedRecommendations)
    ? learnEvalOverlay.appliedRecommendations
    : Array.isArray(learnEvalReport?.recommendations?.all)
      ? learnEvalReport.recommendations.all
      : [];
  const fixRecommendations = recommendations.filter((item) => item?.kind === 'fix');
  const observeRecommendations = recommendations.filter((item) => item?.kind === 'observe');
  const dispatchSignals = learnEvalReport?.signals?.dispatch || {};
  const currentBlockedJobs = Array.isArray(dispatchRun?.jobRuns)
    ? dispatchRun.jobRuns.filter((item) => item?.status === 'blocked').length
    : 0;
  const blockedMergePath = fixRecommendations.some((item) => item?.targetId === 'runbook.dispatch-merge-triage')
    || (Number(dispatchSignals.blockedRuns) || 0) > 0
    || (Number(dispatchSignals.blockedJobs) || 0) > 0
    || currentBlockedJobs > 0;
  const sessionId = String(learnEvalReport?.session?.sessionId || learnEvalOverlay?.sourceSessionId || '').trim();
  const policyFixRecommendations = [...fixRecommendations];

  if (blockedMergePath && !policyFixRecommendations.some((item) => item?.targetId === 'runbook.dispatch-merge-triage')) {
    policyFixRecommendations.push({
      kind: 'fix',
      targetId: 'runbook.dispatch-merge-triage',
      nextCommand: sessionId
        ? `node scripts/aios.mjs orchestrate --session ${sessionId} --dispatch local --execute dry-run --format json`
        : 'node scripts/aios.mjs doctor',
      nextArtifact: dispatchSignals.latestArtifactPath || undefined,
    });
  }

  let status = 'caution';
  if (policyFixRecommendations.length > 0) {
    status = 'blocked';
  } else if ((Number(dispatchSignals.runs) || 0) > 0 || Array.isArray(dispatchRun?.jobRuns)) {
    status = 'ready';
  }

  const notes = [];
  if (policyFixRecommendations.length > 0) {
    notes.push(`Blocked by ${policyFixRecommendations.length} fix recommendation${policyFixRecommendations.length === 1 ? '' : 's'}.`);
  } else if ((Number(dispatchSignals.runs) || 0) > 0 || Array.isArray(dispatchRun?.jobRuns)) {
    notes.push('Observed dispatch evidence is available for the current executor path.');
  } else {
    notes.push('No observed dispatch evidence yet; keep dispatch in caution mode.');
  }

  if (blockedMergePath) {
    notes.push('Observed merge-gate blockage suggests serial triage before parallel execution.');
  }

  return normalizeDispatchPolicy({
    status,
    parallelism: blockedMergePath ? 'serial-only' : 'parallel-with-merge-gate',
    blockerIds: policyFixRecommendations.map((item) => item.targetId),
    advisoryIds: observeRecommendations.map((item) => item.targetId),
    requiredActions: buildRequiredActions([...policyFixRecommendations, ...recommendations.filter((item) => item?.kind !== 'fix')]),
    executorPreferences: buildExecutorPreferences(dispatchPlan, dispatchSignals, dispatchRun),
    notes,
  });
}

function formatLearnEvalOverlay(overlay) {
  if (!overlay) {
    return [];
  }

  const lines = [
    'Learn-Eval Overlay:',
    `- session=${overlay.sourceSessionId || '(unknown)'}`,
    `- selected=${overlay.selectedRecommendationId || '(none)'}`,
  ];

  if (overlay.sourceGoal) {
    lines.push(`- goal=${overlay.sourceGoal}`);
  }

  if (overlay.appliedRecommendations.length > 0) {
    lines.push('- applied recommendations:');
    lines.push(...overlay.appliedRecommendations.map((item) => `  - [${item.kind}|${item.targetId}] ${item.title}`));
  } else {
    lines.push('- applied recommendations: (none)');
  }

  lines.push('');
  return lines;
}

function formatPolicySection(title, policy) {
  if (!policy) {
    return [];
  }

  const lines = [
    `${title}:`,
    `- status=${policy.status} parallelism=${policy.parallelism}`,
    `- blockers=${policy.blockerIds.length > 0 ? policy.blockerIds.join(', ') : '(none)'}`,
    `- advisories=${policy.advisoryIds.length > 0 ? policy.advisoryIds.join(', ') : '(none)'}`,
  ];

  if (Array.isArray(policy.requiredActions) && policy.requiredActions.length > 0) {
    lines.push('- required actions:');
    lines.push(...policy.requiredActions.map((item) => `  - [${item.type}] ${item.action}`));
  }

  if (Array.isArray(policy.executorPreferences) && policy.executorPreferences.length > 0) {
    lines.push('- executor preferences:');
    lines.push(...policy.executorPreferences.map((item) => `  - ${item.executor} confidence=${item.confidence} observed=${item.observedCount}`));
  }

  if (Array.isArray(policy.notes) && policy.notes.length > 0) {
    lines.push(...policy.notes.map((note) => `- note=${note}`));
  }

  lines.push('');
  return lines;
}

function formatDispatchPolicy(policy) {
  return formatPolicySection('Dispatch Policy', policy);
}

function formatEffectiveDispatchPolicy(policy) {
  return formatPolicySection('Effective Dispatch Policy', policy);
}

function formatDispatchPreflight(dispatchPreflight) {
  if (!dispatchPreflight) {
    return [];
  }

  const lines = [
    'Dispatch Preflight:',
    `- mode=${dispatchPreflight.mode} actions=${dispatchPreflight.results.length}`,
  ];

  if (dispatchPreflight.results.length > 0) {
    lines.push(...dispatchPreflight.results.map((item) => `- [${item.status}] ${item.runner} source=${item.sourceId || '(none)'} ${item.summary || item.action}`));
  }

  lines.push('');
  return lines;
}

function formatDispatchPlan(dispatchPlan) {
  if (!dispatchPlan) {
    return [];
  }

  const lines = [
    'Local Dispatch Skeleton:',
    `- mode=${dispatchPlan.mode} ready=${dispatchPlan.readyForExecution ? 'true' : 'false'} jobs=${dispatchPlan.jobs.length}`,
  ];

  if (Array.isArray(dispatchPlan.executorRegistry) && dispatchPlan.executorRegistry.length > 0) {
    lines.push(`- executors=${dispatchPlan.executorRegistry.join(', ')}`);
  }

  if (Array.isArray(dispatchPlan.notes) && dispatchPlan.notes.length > 0) {
    lines.push(...dispatchPlan.notes.map((note) => `- note=${note}`));
  }

  lines.push(...dispatchPlan.jobs.map((job) => {
    const dependsOn = job.dependsOn.length > 0 ? job.dependsOn.join(', ') : '(root)';
    return `- [${job.jobType}] ${job.jobId} role=${job.role} dependsOn=${dependsOn} executor=${job.launchSpec.executor}`;
  }));
  lines.push('');
  return lines;
}

function formatDispatchRun(dispatchRun) {
  if (!dispatchRun) {
    return [];
  }

  const lines = [
    'Local Dispatch Run:',
    `- mode=${dispatchRun.mode} ok=${dispatchRun.ok ? 'true' : 'false'} jobs=${dispatchRun.jobRuns.length}`,
  ];

  if (dispatchRun.runtime?.id) {
    lines.push(`- runtime=${dispatchRun.runtime.id} executionMode=${dispatchRun.runtime.executionMode || dispatchRun.mode}`);
  }

  if (Array.isArray(dispatchRun.executorRegistry) && dispatchRun.executorRegistry.length > 0) {
    lines.push(`- executors=${dispatchRun.executorRegistry.join(', ')}`);
  }

  lines.push(...dispatchRun.jobRuns.map((jobRun) => `- [${jobRun.status}] ${jobRun.jobId} output=${jobRun.output?.outputType || 'unknown'}`), '');

  return lines;
}

function formatDispatchEvidence(dispatchEvidence) {
  if (!dispatchEvidence) {
    return [];
  }

  const lines = [
    'Dispatch Evidence:',
    `- persisted=${dispatchEvidence.persisted ? 'true' : 'false'}`,
  ];

  if (dispatchEvidence.artifactPath) {
    lines.push(`- artifact=${dispatchEvidence.artifactPath}`);
  }
  if (dispatchEvidence.eventId) {
    lines.push(`- event=${dispatchEvidence.eventId}`);
  }
  if (dispatchEvidence.checkpointId) {
    lines.push(`- checkpoint=${dispatchEvidence.checkpointId}`);
  }
  if (dispatchEvidence.error) {
    lines.push(`- error=${dispatchEvidence.error}`);
  }

  lines.push('');
  return lines;
}

export function renderOrchestrationReport(input = {}) {
  const plan = Array.isArray(input.phases) ? input : buildOrchestrationPlan(input);
  return [
    `ORCHESTRATION BLUEPRINT: ${plan.blueprint}`,
    `Task: ${plan.taskTitle}`,
    `Description: ${plan.description}`,
    ...(plan.contextSummary ? ['', `Context: ${plan.contextSummary}`] : []),
    '',
    'Phases:',
    ...plan.phases.map((phase) => `- [${phase.mode}] ${phase.label}: ${phase.responsibility}`),
    '',
    ...formatLearnEvalOverlay(plan.learnEvalOverlay),
    ...formatDispatchPolicy(plan.dispatchPolicy),
    ...formatDispatchPreflight(plan.dispatchPreflight),
    ...formatEffectiveDispatchPolicy(plan.effectiveDispatchPolicy),
    ...formatDispatchPlan(plan.dispatchPlan),
    ...formatDispatchRun(plan.dispatchRun),
    ...formatDispatchEvidence(plan.dispatchEvidence),
    'Merge Gate:',
    '- Block on handoff status = blocked|needs-input',
    '- Block on overlapping file ownership across parallel outputs',
    '- Merge only findings and recommendations when ownership is clean',
    '',
  ].join('\n');
}
