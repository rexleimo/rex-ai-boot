import runtimeSpec from '../../../memory/specs/orchestrator-runtimes.json' with { type: 'json' };
import { normalizeHandoffPayload } from './handoff.mjs';
import { createHandoffFromPhase, executeLocalDispatchPlan, mergeParallelHandoffs } from './orchestrator.mjs';

export const LOCAL_DRY_RUN_RUNTIME = 'local-dry-run';
export const SUBAGENT_RUNTIME = 'subagent-runtime';
export const LIVE_EXECUTION_ENV = 'AIOS_EXECUTE_LIVE';
export const SUBAGENT_SIMULATE_ENV = 'AIOS_SUBAGENT_SIMULATE';

const DISPATCH_RUNTIME_CATALOG = Object.freeze(
  Object.fromEntries(
    Object.entries(runtimeSpec.runtimes || {}).map(([id, definition]) => [
      id,
      Object.freeze({
        id,
        manifestVersion: runtimeSpec.schemaVersion || 1,
        label: String(definition.label || id),
        description: String(definition.description || ''),
        requiresModel: definition.requiresModel === true,
        executionModes: Object.freeze(Array.isArray(definition.executionModes) ? [...definition.executionModes] : []),
      }),
    ])
  )
);

function cloneDispatchRuntime(definition) {
  return {
    ...definition,
    executionModes: [...definition.executionModes],
  };
}

function isLiveExecutionEnabled(env = process.env) {
  const raw = String(env?.[LIVE_EXECUTION_ENV] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function isSubagentSimulationEnabled(env = process.env) {
  const raw = String(env?.[SUBAGENT_SIMULATE_ENV] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function getPhaseForJob(plan, job) {
  const phaseId = String(job?.phaseId || '').trim();
  if (!phaseId) return null;
  const phases = Array.isArray(plan?.phases) ? plan.phases : [];
  return phases.find((phase) => String(phase?.id || '').trim() === phaseId) || null;
}

function mapExecutorLabels(dispatchPlan) {
  const entries = Array.isArray(dispatchPlan?.executorDetails) ? dispatchPlan.executorDetails : [];
  return new Map(entries.map((item) => [String(item?.id || '').trim(), String(item?.label || '').trim()]).filter(([id]) => id));
}

function simulateSubagentDispatchRun(plan, dispatchPlan, { io } = {}) {
  const jobs = Array.isArray(dispatchPlan?.jobs) ? dispatchPlan.jobs : [];
  const executorLabels = mapExecutorLabels(dispatchPlan);
  const jobRuns = [];
  const jobRunMap = new Map();

  for (const job of jobs) {
    const dependencyRuns = Array.isArray(job.dependsOn)
      ? job.dependsOn.map((jobId) => jobRunMap.get(jobId)).filter(Boolean)
      : [];

    const executorId = String(job?.launchSpec?.executor || '').trim() || 'unknown';
    const executorLabel = executorLabels.get(executorId) || executorId;

    if (job.jobType === 'phase') {
      const phase = getPhaseForJob(plan, job);
      if (!phase) {
        jobRuns.push({
          jobId: job.jobId,
          jobType: job.jobType,
          role: job.role,
          executor: executorId,
          executorLabel,
          dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
          status: 'blocked',
          inputSummary: {
            dependencyCount: dependencyRuns.length,
            inputTypes: Array.isArray(job.launchSpec?.inputs) ? [...job.launchSpec.inputs] : [],
          },
          output: {
            outputType: job.launchSpec?.outputType || 'handoff',
            error: `Unknown orchestration phase for job: ${job.jobId}`,
          },
        });
        continue;
      }

      const payload = createHandoffFromPhase(plan, phase, {
        toRole: job.launchSpec?.handoffTarget || 'next-phase',
        status: 'completed',
        contextSummary: `Subagent runtime simulated output for ${job.jobId}. ${phase.responsibility}`,
        findings: [`Simulated subagent output for ${job.jobId}.`],
        recommendations: [`Runtime path validated for ${job.role}.`],
      });

      const jobRun = {
        jobId: job.jobId,
        jobType: job.jobType,
        role: job.role,
        executor: executorId,
        executorLabel,
        dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
        status: 'simulated',
        inputSummary: {
          dependencyCount: dependencyRuns.length,
          inputTypes: Array.isArray(job.launchSpec?.inputs) ? [...job.launchSpec.inputs] : [],
        },
        output: {
          outputType: job.launchSpec?.outputType || 'handoff',
          payload,
        },
      };

      jobRuns.push(jobRun);
      jobRunMap.set(job.jobId, jobRun);
      continue;
    }

    if (job.jobType === 'merge-gate') {
      const handoffs = dependencyRuns.map((run) => run?.output?.payload).filter(Boolean);
      const mergeResult = mergeParallelHandoffs(handoffs);
      const payload = normalizeHandoffPayload({
        status: mergeResult.ok ? 'completed' : 'blocked',
        fromRole: 'merge-gate',
        toRole: 'complete',
        taskTitle: plan?.taskTitle || 'Untitled task',
        contextSummary: mergeResult.ok
          ? `Subagent merge gate passed for ${job.group}.`
          : `Subagent merge gate blocked for ${job.group}.`,
        findings: mergeResult.mergedFindings,
        filesTouched: mergeResult.touchedFiles,
        recommendations: mergeResult.mergedRecommendations,
      });

      const jobRun = {
        jobId: job.jobId,
        jobType: job.jobType,
        role: job.role,
        executor: executorId,
        executorLabel,
        dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
        status: mergeResult.ok ? 'simulated' : 'blocked',
        inputSummary: {
          dependencyCount: dependencyRuns.length,
          inputTypes: Array.isArray(job.launchSpec?.inputs) ? [...job.launchSpec.inputs] : [],
        },
        output: {
          outputType: job.launchSpec?.outputType || 'merged-handoff',
          payload,
          mergeResult: {
            ok: mergeResult.ok,
            blockedCount: mergeResult.blocked.length,
            conflictCount: mergeResult.conflicts.length,
            touchedFiles: mergeResult.touchedFiles,
          },
        },
      };

      jobRuns.push(jobRun);
      jobRunMap.set(job.jobId, jobRun);
      continue;
    }

    const jobRun = {
      jobId: job.jobId,
      jobType: job.jobType,
      role: job.role,
      executor: executorId,
      executorLabel,
      dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
      status: 'blocked',
      inputSummary: {
        dependencyCount: dependencyRuns.length,
        inputTypes: Array.isArray(job.launchSpec?.inputs) ? [...job.launchSpec.inputs] : [],
      },
      output: {
        outputType: job.launchSpec?.outputType || 'unknown',
        error: `Unsupported job type in subagent runtime simulation: ${job.jobType}`,
      },
    };
    jobRuns.push(jobRun);
    jobRunMap.set(job.jobId, jobRun);
  }

  const executorDetails = Array.isArray(dispatchPlan?.executorDetails)
    ? dispatchPlan.executorDetails.map((item) => ({ ...item }))
    : [];
  const executorRegistry = Array.isArray(dispatchPlan?.executorRegistry)
    ? [...dispatchPlan.executorRegistry]
    : executorDetails.map((item) => item.id);

  io?.log?.(`[subagent-runtime] simulated jobs=${jobRuns.length}`);

  return {
    mode: 'live',
    ok: jobRuns.every((jobRun) => jobRun.status !== 'blocked'),
    executorRegistry,
    executorDetails,
    jobRuns,
    finalOutputs: jobRuns
      .filter((jobRun) => jobRun.output?.outputType === 'merged-handoff' || jobRun.jobType === 'phase')
      .map((jobRun) => ({ jobId: jobRun.jobId, outputType: jobRun.output?.outputType || 'unknown' })),
  };
}

export function normalizeDispatchRuntimeResult(result, runtime, executionMode) {
  if (!result || typeof result !== 'object') {
    throw new Error(`Dispatch runtime ${runtime.id} returned an invalid result`);
  }
  if (!Array.isArray(result.jobRuns)) {
    throw new Error(`Dispatch runtime ${runtime.id} returned invalid jobRuns`);
  }

  const mode = String(result.mode || executionMode || '').trim();
  if (mode !== executionMode) {
    throw new Error(`Dispatch runtime ${runtime.id} returned incompatible mode: ${mode || '(missing)'}`);
  }

  return {
    ...result,
    runtime: {
      id: runtime.id,
      manifestVersion: runtime.manifestVersion,
      label: runtime.label,
      description: runtime.description,
      requiresModel: runtime.requiresModel,
      executionMode,
    },
  };
}

export function listDispatchRuntimes() {
  return Object.values(DISPATCH_RUNTIME_CATALOG).map((definition) => cloneDispatchRuntime(definition));
}

export function getDispatchRuntime(runtimeId = LOCAL_DRY_RUN_RUNTIME) {
  const key = String(runtimeId || '').trim();
  const definition = DISPATCH_RUNTIME_CATALOG[key];
  if (!definition) {
    throw new Error(`Unknown dispatch runtime: ${runtimeId}`);
  }
  return cloneDispatchRuntime(definition);
}

export function selectDispatchRuntime({ executionMode = 'none' } = {}) {
  const mode = String(executionMode || 'none').trim();
  if (mode === 'dry-run') {
    return LOCAL_DRY_RUN_RUNTIME;
  }
  if (mode === 'live') {
    return SUBAGENT_RUNTIME;
  }
  throw new Error(`No dispatch runtime available for execution mode: ${mode}`);
}

export function createDispatchRuntimeRegistry({ executeDryRunPlan = executeLocalDispatchPlan } = {}) {
  if (typeof executeDryRunPlan !== 'function') {
    throw new Error('createDispatchRuntimeRegistry requires executeDryRunPlan');
  }

  const registry = {};

  for (const runtime of listDispatchRuntimes()) {
    if (runtime.id === LOCAL_DRY_RUN_RUNTIME) {
      registry[LOCAL_DRY_RUN_RUNTIME] = {
        ...runtime,
        execute({ plan, dispatchPlan, dispatchPolicy, io, env } = {}) {
          const result = executeDryRunPlan(plan, dispatchPlan, { dispatchPolicy, io, env });
          return normalizeDispatchRuntimeResult(result, runtime, 'dry-run');
        },
      };
      continue;
    }

    registry[runtime.id] = {
      ...runtime,
      execute({ plan, dispatchPlan, dispatchPolicy, io, env } = {}) {
        const mode = runtime.executionModes[0] || 'live';
        const gated = runtime.id === SUBAGENT_RUNTIME && !isLiveExecutionEnabled(env);
        const simulate = runtime.id === SUBAGENT_RUNTIME && isSubagentSimulationEnabled(env);
        const message = gated
          ? `Live execution is disabled by default. Set ${LIVE_EXECUTION_ENV}=1 to opt in.`
          : simulate
            ? ''
            : `Dispatch runtime ${runtime.id} is not implemented yet. Set ${SUBAGENT_SIMULATE_ENV}=1 to simulate.`;

        if (!gated && simulate) {
          return simulateSubagentDispatchRun(plan, dispatchPlan, { dispatchPolicy, io, env });
        }

        return {
          mode,
          ok: false,
          error: message,
          executorRegistry: [],
          executorDetails: [],
          jobRuns: [],
          finalOutputs: [],
        };
      },
    };
  }

  if (!registry[LOCAL_DRY_RUN_RUNTIME]) {
    throw new Error(`Runtime manifest missing required runtime: ${LOCAL_DRY_RUN_RUNTIME}`);
  }

  return registry;
}

export function resolveDispatchRuntime({ runtimeId = '', executionMode = 'none' } = {}, registry = {}) {
  const selectedRuntimeId = String(runtimeId || '').trim() || selectDispatchRuntime({ executionMode });
  const runtime = registry[selectedRuntimeId];

  if (!runtime) {
    throw new Error(`Unknown dispatch runtime: ${selectedRuntimeId}`);
  }

  if (!Array.isArray(runtime.executionModes) || !runtime.executionModes.includes(executionMode)) {
    throw new Error(`Dispatch runtime ${selectedRuntimeId} does not support execution mode: ${executionMode}`);
  }

  return runtime;
}
