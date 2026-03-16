import {
  buildDispatchPolicy,
  buildEffectiveDispatchPolicy,
  buildLocalDispatchPlan,
  buildOrchestrationPlan,
  normalizeOrchestratorBlueprint,
  normalizeOrchestratorFormat,
  renderOrchestrationReport,
} from '../harness/orchestrator.mjs';
import {
  createDispatchRuntimeRegistry,
  normalizeDispatchRuntimeResult,
  resolveDispatchRuntime,
} from '../harness/orchestrator-runtimes.mjs';
import { persistDispatchEvidence } from '../harness/orchestrator-evidence.mjs';
import { buildLearnEvalReport } from '../harness/learn-eval.mjs';
import { buildWorkItemTelemetry } from '../harness/work-item-telemetry.mjs';
import { parseArgs } from '../cli/parse-args.mjs';
import { runDoctor } from './doctor.mjs';
import { executeEntropyGc } from './entropy-gc.mjs';
import { runQualityGate } from './quality-gate.mjs';
import { evaluateClarityGate, persistClarityGateDecision } from '../harness/clarity-gate.mjs';
import {
  normalizeOrchestrateDispatchMode,
  normalizeOrchestrateExecutionMode,
  normalizeOrchestratePreflightMode,
} from './options.mjs';

const DEFAULT_PREFLIGHT_ADAPTERS = {
  qualityGate: runQualityGate,
  doctor: runDoctor,
  orchestrate: runOrchestrate,
};

function normalizePositiveInteger(rawValue, fallback) {
  const value = Number.parseInt(String(rawValue ?? '').trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseBooleanEnv(rawValue, fallback = false) {
  const value = String(rawValue ?? '').trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function extractBlueprintFromTargetId(targetId) {
  const match = /^blueprint\.([a-z0-9-]+)$/i.exec(String(targetId || '').trim());
  return match ? normalizeOrchestratorBlueprint(match[1]) : null;
}

function selectOverlayRecommendation(recommendations, recommendationId = '') {
  if (recommendationId) {
    const selected = recommendations.find((item) => item.targetId === recommendationId);
    if (!selected) {
      throw new Error(`Unknown learn-eval recommendation: ${recommendationId}`);
    }
    return selected;
  }

  return recommendations.find((item) => item.kind === 'promote' && item.targetType === 'blueprint') || null;
}

function buildOverlayContext(overlay) {
  if (!overlay || overlay.appliedRecommendations.length === 0) {
    return '';
  }

  const topItems = overlay.appliedRecommendations
    .slice(0, 3)
    .map((item) => `[${item.kind}] ${item.targetId}`)
    .join(', ');

  return `learn-eval overlay: session=${overlay.sourceSessionId}; selected=${overlay.selectedRecommendationId || 'none'}; top=${topItems}`;
}

function buildLearnEvalOverlay(report, recommendationId = '') {
  const appliedRecommendations = Array.isArray(report.recommendations?.all)
    ? report.recommendations.all.map((item) => ({ ...item }))
    : [];
  const selectedRecommendation = selectOverlayRecommendation(appliedRecommendations, recommendationId);

  return {
    sourceSessionId: report.session.sessionId,
    sourceGoal: report.session.goal,
    selectedRecommendationId: selectedRecommendation?.targetId || null,
    appliedRecommendationIds: appliedRecommendations.map((item) => item.targetId),
    appliedRecommendations,
  };
}

function tokenizeCliFragment(value = '') {
  const tokens = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s]+)/g;
  for (const match of String(value || '').matchAll(pattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens.filter(Boolean);
}

function parseAiosCommandAction(action = '') {
  const trimmed = String(action || '').trim();
  const prefix = 'node scripts/aios.mjs ';
  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  try {
    return parseArgs(tokenizeCliFragment(trimmed.slice(prefix.length)));
  } catch {
    return null;
  }
}

function createBufferedIo() {
  const lines = [];
  return {
    lines,
    io: {
      log(line) {
        lines.push(String(line));
      },
    },
  };
}

function isSupportedPreflightOrchestrateAction(options = {}) {
  return options.dispatchMode === 'local' && options.executionMode === 'dry-run';
}

function buildPreflightOrchestrateOptions(options = {}, sessionId = '') {
  const nestedOptions = sessionId && !options.sessionId
    ? { ...options, sessionId }
    : { ...options };
  nestedOptions.preflightMode = 'none';
  return nestedOptions;
}

async function runPreflightAction(item, { rootDir, env, sessionId, preflightAdapters }) {
  if (item.type !== 'command') {
    return {
      type: item.type,
      sourceId: item.sourceId || null,
      action: item.action,
      status: 'skipped',
      runner: 'unsupported',
      summary: 'artifact-only action is not executable in preflight',
      exitCode: null,
    };
  }

  const parsed = parseAiosCommandAction(item.action);
  if (!parsed || parsed.mode === 'help') {
    return {
      type: item.type,
      sourceId: item.sourceId || null,
      action: item.action,
      status: 'skipped',
      runner: 'unsupported',
      summary: 'unsupported orchestrate action',
      exitCode: null,
    };
  }

  const priorExitCode = process.exitCode;
  const buffered = createBufferedIo();
  try {
    if (parsed.command === 'quality-gate') {
      const qualityGateOptions = sessionId && !parsed.options.sessionId
        ? { ...parsed.options, sessionId }
        : parsed.options;
      const result = await preflightAdapters.qualityGate(qualityGateOptions, {
        rootDir,
        io: buffered.io,
        env,
      });
      process.exitCode = priorExitCode;
      return {
        type: item.type,
        sourceId: item.sourceId || null,
        action: item.action,
        status: result?.exitCode === 0 || result?.ok === true ? 'passed' : 'failed',
        runner: 'quality-gate',
        summary: buffered.lines.at(-1) || `quality-gate ${result?.mode || 'full'}`,
        exitCode: Number.isFinite(result?.exitCode) ? result.exitCode : (result?.ok === true ? 0 : 1),
      };
    }

    if (parsed.command === 'doctor') {
      const result = await preflightAdapters.doctor(parsed.options, {
        rootDir,
        io: buffered.io,
      });
      process.exitCode = priorExitCode;
      return {
        type: item.type,
        sourceId: item.sourceId || null,
        action: item.action,
        status: result?.exitCode === 0 || result?.ok === true ? 'passed' : 'failed',
        runner: 'doctor',
        summary: buffered.lines.at(-1) || 'doctor completed',
        exitCode: Number.isFinite(result?.exitCode) ? result.exitCode : (result?.ok === true ? 0 : 1),
      };
    }

    if (parsed.command === 'orchestrate') {
      if (!isSupportedPreflightOrchestrateAction(parsed.options)) {
        return {
          type: item.type,
          sourceId: item.sourceId || null,
          action: item.action,
          status: 'skipped',
          runner: 'unsupported',
          summary: 'unsupported orchestrate action: only local dry-run is executable in preflight',
          exitCode: null,
        };
      }

      const orchestrateOptions = buildPreflightOrchestrateOptions(parsed.options, sessionId);
      const orchestrateRunner = preflightAdapters.orchestrate || runOrchestrate;
      const result = await orchestrateRunner(orchestrateOptions, {
        rootDir,
        io: buffered.io,
        env,
        preflightAdapters,
      });
      const dispatchOk = result?.report?.dispatchRun?.ok === true;
      const jobCount = Array.isArray(result?.report?.dispatchRun?.jobRuns) ? result.report.dispatchRun.jobRuns.length : 0;
      process.exitCode = priorExitCode;
      return {
        type: item.type,
        sourceId: item.sourceId || null,
        action: item.action,
        status: dispatchOk ? 'passed' : 'failed',
        runner: 'orchestrate',
        summary: dispatchOk ? 'orchestrate dry-run ready jobs=' + String(jobCount) : 'orchestrate dry-run blocked jobs=' + String(jobCount),
        exitCode: dispatchOk ? 0 : (Number.isFinite(result?.exitCode) ? result.exitCode : 1),
      };
    }
  } finally {
    process.exitCode = priorExitCode;
  }

  return {
    type: item.type,
    sourceId: item.sourceId || null,
    action: item.action,
    status: 'skipped',
    runner: 'unsupported',
    summary: `unsupported command: ${parsed.command}`,
    exitCode: null,
  };
}

async function executeDispatchPreflight(dispatchPolicy, {
  rootDir,
  env = process.env,
  sessionId = '',
  preflightMode = 'none',
  preflightAdapters = DEFAULT_PREFLIGHT_ADAPTERS,
} = {}) {
  if (preflightMode === 'none' || !dispatchPolicy) {
    return null;
  }

  const results = [];
  for (const item of Array.isArray(dispatchPolicy.requiredActions) ? dispatchPolicy.requiredActions : []) {
    results.push(await runPreflightAction(item, { rootDir, env, sessionId, preflightAdapters }));
  }

  return {
    mode: preflightMode,
    results,
  };
}

export function normalizeOrchestrateOptions(rawOptions = {}) {
  const blueprintRaw = String(rawOptions.blueprint || '').trim();
  const taskTitleRaw = String(rawOptions.taskTitle || '').trim();
  const sessionId = String(rawOptions.sessionId || '').trim();
  const recommendationId = String(rawOptions.recommendationId || '').trim();
  const dispatchModeRaw = String(rawOptions.dispatchMode ?? '').trim();
  const executionModeRaw = String(rawOptions.executionMode ?? '').trim();
  const preflightModeRaw = String(rawOptions.preflightMode ?? '').trim();
  const dispatchModeProvided = dispatchModeRaw.length > 0;
  const executionModeProvided = executionModeRaw.length > 0;
  const preflightModeProvided = preflightModeRaw.length > 0;

  let dispatchMode = dispatchModeProvided ? normalizeOrchestrateDispatchMode(dispatchModeRaw) : 'none';
  let executionMode = executionModeProvided ? normalizeOrchestrateExecutionMode(executionModeRaw) : 'none';
  let preflightMode = preflightModeProvided ? normalizeOrchestratePreflightMode(preflightModeRaw) : 'none';

  // Smart defaults: if the operator didn't specify dispatch/execute, default to
  // a local dry-run execution so we always produce a runnable DAG + evidence
  // (0 token cost).
  if (!dispatchModeProvided && !executionModeProvided) {
    dispatchMode = 'local';
    executionMode = 'dry-run';
  }

  // If an operator specifies an execution mode but omits dispatch mode, assume
  // local dispatch (we only support local execution in this harness).
  if (!dispatchModeProvided && executionModeProvided && executionMode !== 'none') {
    dispatchMode = 'local';
  }

  // If an operator opts into local dispatch but omits execution mode, default
  // to dry-run (keeps orchestration zero-cost unless explicitly set to live).
  if (dispatchMode === 'local' && !executionModeProvided) {
    executionMode = 'dry-run';
  }

  if (recommendationId && !sessionId) {
    throw new Error('--recommendation requires --session');
  }
  if (executionMode !== 'none' && dispatchMode !== 'local') {
    throw new Error('--execute requires --dispatch local');
  }
  if (preflightMode !== 'none' && !sessionId) {
    throw new Error('--preflight requires --session');
  }

  return {
    blueprint: blueprintRaw ? normalizeOrchestratorBlueprint(blueprintRaw) : 'feature',
    blueprintExplicit: blueprintRaw.length > 0,
    taskTitle: taskTitleRaw || 'Untitled task',
    taskTitleExplicit: taskTitleRaw.length > 0,
    contextSummary: String(rawOptions.contextSummary || '').trim(),
    sessionId,
    limit: normalizePositiveInteger(rawOptions.limit, 10),
    recommendationId,
    dispatchMode,
    executionMode,
    preflightMode,
    format: normalizeOrchestratorFormat(rawOptions.format ?? 'text'),
  };
}

export function planOrchestrate(rawOptions = {}) {
  const options = normalizeOrchestrateOptions(rawOptions);
  const args = ['orchestrate'];

  if (!options.sessionId || options.blueprintExplicit) {
    args.push(options.blueprint);
  }
  if (!options.sessionId || options.taskTitleExplicit) {
    args.push('--task', JSON.stringify(options.taskTitle));
  }
  if (options.contextSummary) {
    args.push('--context', JSON.stringify(options.contextSummary));
  }
  if (options.sessionId) {
    args.push('--session', options.sessionId);
    if (options.limit !== 10) {
      args.push('--limit', String(options.limit));
    }
  }
  if (options.recommendationId) {
    args.push('--recommendation', options.recommendationId);
  }
  if (options.dispatchMode !== 'none') {
    args.push('--dispatch', options.dispatchMode);
  }
  if (options.executionMode !== 'none') {
    args.push('--execute', options.executionMode);
  }
  if (options.preflightMode !== 'none') {
    args.push('--preflight', options.preflightMode);
  }
  if (options.format !== 'text') {
    args.push('--format', options.format);
  }
  return {
    command: 'orchestrate',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runOrchestrate(
  rawOptions = {},
  {
    rootDir,
    io = console,
    env = process.env,
    preflightAdapters = DEFAULT_PREFLIGHT_ADAPTERS,
    dispatchRuntimeRegistry = createDispatchRuntimeRegistry(),
  } = {}
) {
  const { options } = planOrchestrate(rawOptions);

  let blueprint = options.blueprint;
  let taskTitle = options.taskTitle;
  let contextSummary = options.contextSummary;
  let learnEvalOverlay = null;
  let learnEvalReport = null;

  if (options.sessionId) {
    learnEvalReport = await buildLearnEvalReport(
      { sessionId: options.sessionId, limit: options.limit },
      { rootDir }
    );
    learnEvalOverlay = buildLearnEvalOverlay(learnEvalReport, options.recommendationId);

    if (!options.blueprintExplicit) {
      const recommendedBlueprint = extractBlueprintFromTargetId(learnEvalOverlay.selectedRecommendationId);
      if (recommendedBlueprint) {
        blueprint = recommendedBlueprint;
      }
    }

    if (!options.taskTitleExplicit && String(learnEvalReport.session.goal || '').trim()) {
      taskTitle = String(learnEvalReport.session.goal).trim();
    }

    const overlayContext = buildOverlayContext(learnEvalOverlay);
    contextSummary = [options.contextSummary, overlayContext].filter(Boolean).join(' | ');
  }

  const rawDispatchPolicy = buildDispatchPolicy({
    learnEvalReport,
    learnEvalOverlay,
  });
  const dispatchPreflight = await executeDispatchPreflight(rawDispatchPolicy, {
    rootDir,
    env,
    sessionId: options.sessionId,
    preflightMode: options.preflightMode,
    preflightAdapters,
  });
  let effectiveLearnEvalReport = learnEvalReport;
  if (
    options.sessionId
    && dispatchPreflight?.results?.some((item) => (item.runner === 'quality-gate' || item.runner === 'orchestrate') && item.status !== 'skipped')
  ) {
    effectiveLearnEvalReport = await buildLearnEvalReport(
      { sessionId: options.sessionId, limit: options.limit },
      { rootDir }
    );
  }
  const preflightDispatchPolicy = buildDispatchPolicy({
    learnEvalReport: effectiveLearnEvalReport,
    learnEvalOverlay,
  }) || rawDispatchPolicy;
  const effectiveDispatchPolicy = buildEffectiveDispatchPolicy({
    dispatchPolicy: preflightDispatchPolicy,
    dispatchPreflight,
    learnEvalReport: effectiveLearnEvalReport,
  }) || preflightDispatchPolicy || rawDispatchPolicy;

  const basePlan = buildOrchestrationPlan({
    blueprint,
    taskTitle,
    contextSummary,
    learnEvalOverlay,
    dispatchPolicy: rawDispatchPolicy,
    dispatchPreflight,
    effectiveDispatchPolicy,
  });
  const dagPlan = {
    ...basePlan,
    dispatchPolicy: effectiveDispatchPolicy,
  };

  const dispatchPlan = options.dispatchMode === 'local'
    ? buildLocalDispatchPlan(dagPlan)
    : null;
  const dispatchRunStartedAt = Date.now();
  const dispatchRuntime = options.executionMode !== 'none'
    ? resolveDispatchRuntime({ executionMode: options.executionMode }, dispatchRuntimeRegistry)
    : null;
  const rawDispatchRun = dispatchRuntime
    ? await dispatchRuntime.execute({
      plan: dagPlan,
      dispatchPlan,
      dispatchPolicy: effectiveDispatchPolicy,
      io,
      env,
      rootDir,
    })
    : null;
  const dispatchRun = dispatchRuntime && rawDispatchRun
    ? normalizeDispatchRuntimeResult(rawDispatchRun, dispatchRuntime, options.executionMode)
    : null;

  const postDispatchPolicy = buildDispatchPolicy({
    learnEvalReport: effectiveLearnEvalReport,
    learnEvalOverlay,
    dispatchPlan,
    dispatchRun,
  }) || preflightDispatchPolicy || rawDispatchPolicy;
  const finalEffectiveDispatchPolicy = buildEffectiveDispatchPolicy({
    dispatchPolicy: postDispatchPolicy,
    dispatchPreflight,
    learnEvalReport: effectiveLearnEvalReport,
  }) || effectiveDispatchPolicy || postDispatchPolicy;
  const clarityGate = options.executionMode === 'live' && dispatchRun
    ? evaluateClarityGate(
      {
        sessionId: options.sessionId,
        learnEvalReport: effectiveLearnEvalReport,
        dispatchRun,
      },
      {
        blockedCheckpointThreshold: normalizePositiveInteger(env?.AIOS_HUMAN_GATE_BLOCKED_THRESHOLD, 2),
        maxFilesTouched: normalizePositiveInteger(env?.AIOS_HUMAN_GATE_MAX_FILES, 25),
      }
    )
    : null;
  const clarityGateEvidence = clarityGate?.needsHuman
    ? persistClarityGateDecision({
      rootDir,
      sessionId: options.sessionId,
      gate: clarityGate,
    })
    : null;
  const resolvedClarityGate = clarityGate
    ? {
      ...clarityGate,
      ...(clarityGateEvidence ? { evidence: clarityGateEvidence } : {}),
    }
    : null;
  const clarityAdjustedPolicy = resolvedClarityGate?.needsHuman
    ? {
      ...finalEffectiveDispatchPolicy,
      status: 'blocked',
      parallelism: 'serial-only',
      blockerIds: [...new Set([...(finalEffectiveDispatchPolicy?.blockerIds || []), 'gate.clarity-human'])],
      requiredActions: [
        ...(Array.isArray(finalEffectiveDispatchPolicy?.requiredActions) ? finalEffectiveDispatchPolicy.requiredActions : []),
        {
          type: 'command',
          action: `node scripts/aios.mjs entropy-gc dry-run --session ${options.sessionId} --format json`,
          sourceId: 'gate.clarity-human',
        },
        {
          type: 'command',
          action: `node scripts/aios.mjs orchestrate --session ${options.sessionId} --dispatch local --execute live --format json`,
          sourceId: 'gate.clarity-human',
        },
      ],
      notes: [
        ...(Array.isArray(finalEffectiveDispatchPolicy?.notes) ? finalEffectiveDispatchPolicy.notes : []),
        'Clarity gate required human input before continuing automation.',
      ],
    }
    : finalEffectiveDispatchPolicy;
  const entropyGc = options.executionMode === 'live'
    && dispatchRun
    && dispatchRun.ok === true
    && options.sessionId
    && parseBooleanEnv(env?.AIOS_ENTROPY_AUTO, true)
    ? await executeEntropyGc(
      {
        sessionId: options.sessionId,
        mode: resolvedClarityGate?.needsHuman ? 'off' : 'auto',
        retain: normalizePositiveInteger(env?.AIOS_ENTROPY_RETAIN, 5),
        minAgeHours: normalizePositiveInteger(env?.AIOS_ENTROPY_MIN_AGE_HOURS, 24),
        format: 'json',
      },
      {
        rootDir,
        persistEvidence: true,
      }
    )
    : null;
  const dispatchPolicy = rawDispatchPolicy;
  const workItemTelemetry = buildWorkItemTelemetry({
    dispatchPlan,
    dispatchRun,
  });

  const reportBasePlan = buildOrchestrationPlan({
    blueprint,
    taskTitle,
    contextSummary,
    learnEvalOverlay,
    dispatchPolicy,
    dispatchPreflight,
    effectiveDispatchPolicy: clarityAdjustedPolicy,
  });
  const dispatchEvidence = dispatchRun
    ? await persistDispatchEvidence({
      rootDir,
      sessionId: options.sessionId,
      report: {
        ...reportBasePlan,
        ...(dispatchPlan ? { dispatchPlan } : {}),
        ...(dispatchRun ? { dispatchRun } : {}),
        ...(dispatchPolicy ? { dispatchPolicy } : {}),
        ...(dispatchPreflight ? { dispatchPreflight } : {}),
        ...(clarityAdjustedPolicy ? { effectiveDispatchPolicy: clarityAdjustedPolicy } : {}),
        ...(resolvedClarityGate ? { clarityGate: resolvedClarityGate } : {}),
        ...(entropyGc ? { entropyGc } : {}),
        ...(workItemTelemetry ? { workItemTelemetry } : {}),
      },
      elapsedMs: Date.now() - dispatchRunStartedAt,
    })
    : null;

  const report = {
    ...reportBasePlan,
    ...(dispatchPlan ? { dispatchPlan } : {}),
    ...(dispatchRun ? { dispatchRun } : {}),
    ...(dispatchPolicy ? { dispatchPolicy } : {}),
    ...(dispatchPreflight ? { dispatchPreflight } : {}),
    ...(clarityAdjustedPolicy ? { effectiveDispatchPolicy: clarityAdjustedPolicy } : {}),
    ...(resolvedClarityGate ? { clarityGate: resolvedClarityGate } : {}),
    ...(entropyGc ? { entropyGc } : {}),
    ...(workItemTelemetry ? { workItemTelemetry } : {}),
    ...(dispatchEvidence ? { dispatchEvidence } : {}),
  };

  if (options.format === 'json') {
    io.log(JSON.stringify(report, null, 2));
    return { exitCode: 0, report };
  }

  io.log(renderOrchestrationReport(report));
  return { exitCode: 0, report };
}
