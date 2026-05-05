import { readContinuitySummary, writeContinuitySummary } from '../contextdb/continuity.mjs';
import {
  appendSoloHookEvent,
  appendSoloIteration,
  readSoloControl,
  readSoloRunSummary,
  writeSoloRunSummary,
} from './solo-journal.mjs';

const SOLO_OUTCOMES = new Set(['success', 'noop', 'blocked', 'infra-retry', 'human-gate', 'stopped', 'failed']);
const SOLO_FAILURE_CLASSES = new Set([
  'none',
  'no-progress',
  'tool-error',
  'runtime-error',
  'workspace-mutation',
  'ownership-gate',
  'safety-gate',
  'stop-requested',
]);

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeStringArray(value) {
  const raw = Array.isArray(value) ? value : [];
  return Array.from(new Set(raw.map((item) => String(item ?? '').trim()).filter(Boolean)));
}

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Math.floor(delayMs || 0)));
  });
}

function addDelay(iso, delayMs) {
  const base = Date.parse(iso);
  const ts = Number.isFinite(base) ? base : Date.now();
  return new Date(ts + Math.max(0, Math.floor(delayMs))).toISOString();
}

function inferFailureClass(input = {}) {
  const normalized = normalizeText(input.failureClass);
  if (SOLO_FAILURE_CLASSES.has(normalized)) {
    return normalized;
  }

  const outcome = normalizeText(input.outcome, 'failed');
  if (outcome === 'success' || outcome === 'noop') return 'none';
  if (outcome === 'blocked') return 'no-progress';
  if (outcome === 'infra-retry') return 'runtime-error';
  if (outcome === 'human-gate') return 'safety-gate';
  if (outcome === 'stopped') return 'stop-requested';
  return 'runtime-error';
}

function inferBackoffAction(outcome = '', failureClass = '') {
  const normalizedOutcome = normalizeText(outcome);
  const normalizedFailure = normalizeText(failureClass);
  if (normalizedOutcome === 'infra-retry' && (normalizedFailure === 'runtime-error' || normalizedFailure === 'tool-error')) {
    return 'retry-with-backoff';
  }
  if (normalizedOutcome === 'human-gate') return 'human-gate';
  if (normalizedOutcome === 'blocked') return 'shrink-scope';
  return 'none';
}

function inferCheckpointStatus(outcome = '', shouldStop = false) {
  const normalizedOutcome = normalizeText(outcome);
  if (normalizedOutcome === 'success' || normalizedOutcome === 'noop') {
    return shouldStop ? 'done' : 'running';
  }
  if (normalizedOutcome === 'stopped') return 'done';
  return 'blocked';
}

export function normalizeSoloIterationOutcome(input = {}) {
  const sessionId = normalizeText(input.sessionId);
  if (!sessionId) {
    throw new Error('solo iteration outcome requires sessionId');
  }

  const iteration = Number.isFinite(input.iteration) ? Math.max(1, Math.floor(input.iteration)) : 1;
  const outcome = SOLO_OUTCOMES.has(normalizeText(input.outcome))
    ? normalizeText(input.outcome)
    : 'failed';
  const failureClass = inferFailureClass({
    failureClass: input.failureClass,
    outcome,
  });
  const shouldStopDefault = outcome === 'human-gate'
    || outcome === 'stopped'
    || outcome === 'failed';
  const shouldStop = input.shouldStop === true || shouldStopDefault;

  return {
    schemaVersion: 1,
    kind: 'solo-harness.iteration',
    sessionId,
    iteration,
    outcome,
    summary: normalizeText(input.summary, 'No summary recorded.'),
    keyChanges: normalizeStringArray(input.keyChanges),
    keyLearnings: normalizeStringArray(input.keyLearnings),
    nextAction: normalizeText(input.nextAction),
    shouldStop,
    failureClass,
    backoffAction: normalizeText(input.backoffAction, inferBackoffAction(outcome, failureClass)),
    checkpointStatus: normalizeText(input.checkpointStatus, inferCheckpointStatus(outcome, shouldStop)),
    createdAt: normalizeText(input.createdAt, new Date().toISOString()),
  };
}

export function classifySoloFailure(value = {}) {
  const detail = typeof value === 'string'
    ? value
    : value instanceof Error
      ? `${value.name}: ${value.message}`
      : normalizeText(value?.message || value?.summary || value?.stderr || value?.stdout);
  const normalized = detail.toLowerCase();

  if (normalized.includes('ownership') || normalized.includes('ownedpath')) return 'ownership-gate';
  if (normalized.includes('safety') || normalized.includes('human gate')) return 'safety-gate';
  if (normalized.includes('timeout') || normalized.includes('rate limit') || normalized.includes('econnreset')) return 'runtime-error';
  if (normalized.includes('tool')) return 'tool-error';
  if (normalized.includes('workspace') || normalized.includes('git')) return 'workspace-mutation';
  return 'runtime-error';
}

function buildHookDetail(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.length > 280 ? `${normalized.slice(0, 280).trimEnd()}…` : normalized;
}

function buildHookLogEntry({ hook = '', phase = '', iteration = 0, status = 'ok', detail = '' } = {}) {
  return {
    ts: new Date().toISOString(),
    kind: 'hook',
    hook: normalizeText(hook),
    phase: normalizeText(phase),
    iteration: Number.isFinite(iteration) ? Math.max(0, Math.floor(iteration)) : 0,
    status: normalizeText(status, 'ok'),
    detail: buildHookDetail(detail),
  };
}

async function invokeLifecycleHook({
  rootDir,
  sessionId,
  hook = '',
  phase = '',
  iteration = 0,
  callback = null,
  payload = {},
} = {}) {
  if (typeof callback !== 'function') {
    return null;
  }

  const baseEvent = {
    kind: 'lifecycle-hook',
    hook,
    phase,
    iteration,
  };

  try {
    await appendSoloHookEvent({
      rootDir,
      sessionId,
      event: {
        ...baseEvent,
        status: 'start',
      },
    });
  } catch {
    // Best-effort audit trail only.
  }

  try {
    const result = await callback(payload);
    const detail = typeof result === 'string'
      ? result
      : normalizeText(result?.detail || result?.summary || '');
    const logEntry = buildHookLogEntry({
      hook,
      phase,
      iteration,
      status: 'ok',
      detail,
    });
    try {
      await appendSoloHookEvent({
        rootDir,
        sessionId,
        event: {
          ...baseEvent,
          status: 'ok',
          detail: logEntry.detail,
        },
      });
    } catch {
      // Best-effort audit trail only.
    }
    return { ok: true, logEntry, result };
  } catch (error) {
    const detail = buildHookDetail(error instanceof Error ? error.message : String(error));
    const logEntry = buildHookLogEntry({
      hook,
      phase,
      iteration,
      status: 'error',
      detail,
    });
    try {
      await appendSoloHookEvent({
        rootDir,
        sessionId,
        event: {
          ...baseEvent,
          status: 'error',
          detail: logEntry.detail,
        },
      });
    } catch {
      // Best-effort audit trail only.
    }
    return { ok: false, logEntry, error };
  }
}

export function resolveSoloBackoffState({ previous = null, outcome = {}, nowIso = new Date().toISOString() } = {}) {
  const current = previous && typeof previous === 'object'
    ? previous
    : { consecutiveInfraFailures: 0, nextDelayMs: 0, until: null };
  const normalizedOutcome = normalizeText(outcome?.outcome);
  const failureClass = normalizeText(outcome?.failureClass);

  if (normalizedOutcome === 'infra-retry' && (failureClass === 'runtime-error' || failureClass === 'tool-error')) {
    const previousDelay = Number.isFinite(current.nextDelayMs) ? Math.max(0, Math.floor(current.nextDelayMs)) : 0;
    const nextDelayMs = previousDelay > 0 ? Math.min(previousDelay * 2, 300000) : 30000;
    return {
      consecutiveInfraFailures: Number.isFinite(current.consecutiveInfraFailures)
        ? Math.max(0, Math.floor(current.consecutiveInfraFailures)) + 1
        : 1,
      nextDelayMs,
      until: addDelay(nowIso, nextDelayMs),
    };
  }

  return {
    consecutiveInfraFailures: 0,
    nextDelayMs: 0,
    until: null,
  };
}

export function summarizeIterationForContinuity(outcome = {}) {
  const normalized = normalizeSoloIterationOutcome({
    sessionId: normalizeText(outcome.sessionId, 'continuity-session'),
    iteration: Number.isFinite(outcome.iteration) ? outcome.iteration : 1,
    ...outcome,
  });
  return {
    summary: normalized.summary,
    touchedFiles: normalized.keyChanges,
    nextActions: normalizeStringArray([normalized.nextAction]),
  };
}

function deriveRunStatus(outcome = {}) {
  const normalizedOutcome = normalizeText(outcome.outcome);
  const failureClass = normalizeText(outcome.failureClass);
  if (normalizedOutcome === 'infra-retry') return 'backoff';
  if (normalizedOutcome === 'human-gate' || failureClass === 'ownership-gate' || failureClass === 'safety-gate') {
    return 'human-gate';
  }
  if (normalizedOutcome === 'stopped') return 'stopped';
  if (normalizedOutcome === 'failed') return 'failed';
  if (normalizedOutcome === 'blocked') return outcome.shouldStop === true ? 'blocked' : 'running';
  if (outcome.shouldStop === true) return 'done';
  return 'running';
}

function buildStopOutcome({ sessionId, iteration } = {}) {
  return normalizeSoloIterationOutcome({
    sessionId,
    iteration,
    outcome: 'stopped',
    summary: 'Stop requested by operator.',
    keyChanges: [],
    keyLearnings: [],
    nextAction: 'Inspect harness status and resume when ready.',
    shouldStop: true,
    failureClass: 'stop-requested',
  });
}

function buildLogEntries({ prompt = '', rawOutput = '', extra = [] } = {}) {
  const entries = [];
  if (normalizeText(prompt)) {
    entries.push({
      ts: new Date().toISOString(),
      kind: 'prompt',
      text: String(prompt),
    });
  }
  if (normalizeText(rawOutput)) {
    entries.push({
      ts: new Date().toISOString(),
      kind: 'response',
      text: String(rawOutput),
    });
  }
  if (Array.isArray(extra)) {
    for (const item of extra) {
      if (item && typeof item === 'object') {
        entries.push(item);
      }
    }
  }
  return entries;
}

async function persistIterationState({
  rootDir,
  sessionId,
  summary,
  outcome,
  prompt = '',
  rawOutput = '',
  extraLogEntries = [],
} = {}) {
  await appendSoloIteration({
    rootDir,
    sessionId,
    iteration: outcome.iteration,
    outcome,
    logEntries: buildLogEntries({ prompt, rawOutput, extra: extraLogEntries }),
  });

  const continuity = summarizeIterationForContinuity(outcome);
  await writeContinuitySummary({
    workspaceRoot: rootDir,
    sessionId,
    intent: summary.objective,
    summary: continuity.summary,
    touchedFiles: continuity.touchedFiles,
    nextActions: continuity.nextActions,
  });

  const nextBackoff = resolveSoloBackoffState({
    previous: summary.backoff,
    outcome,
    nowIso: outcome.createdAt,
  });
  const nextStatus = deriveRunStatus(outcome);

  return await writeSoloRunSummary({
    rootDir,
    ...summary,
    status: nextStatus,
    iterationCount: outcome.iteration,
    lastIteration: outcome.iteration,
    lastOutcome: outcome.outcome,
    lastFailureClass: outcome.failureClass,
    stopRequested: false,
    backoff: nextBackoff,
    updatedAt: outcome.createdAt,
  });
}

export async function runSoloHarnessLoop({
  rootDir,
  sessionId,
  objective,
  provider,
  clientId,
  profile,
  worktree = null,
  maxIterations = 20,
  executeTurn,
  lifecycleHooks = {},
  sleepImpl = sleep,
} = {}) {
  if (typeof executeTurn !== 'function') {
    throw new Error('runSoloHarnessLoop requires executeTurn');
  }

  let summary = await readSoloRunSummary({ rootDir, sessionId });
  if (!summary) {
    summary = await writeSoloRunSummary({
      rootDir,
      sessionId,
      objective,
      provider,
      clientId,
      profile,
      worktree,
    });
  }

  let iteration = Number.isFinite(summary.lastIteration) ? summary.lastIteration + 1 : 1;
  const max = Number.isFinite(maxIterations) ? Math.max(1, Math.floor(maxIterations)) : 20;

  while (iteration <= max) {
    const control = await readSoloControl({ rootDir, sessionId });
    if (control?.stopRequested === true) {
      summary = await persistIterationState({
        rootDir,
        sessionId,
        summary,
        outcome: buildStopOutcome({ sessionId, iteration }),
      });
      await invokeLifecycleHook({
        rootDir,
        sessionId,
        hook: 'onSessionEnd',
        phase: 'session-end',
        iteration,
        callback: lifecycleHooks?.onSessionEnd,
        payload: {
          rootDir,
          sessionId,
          objective: summary.objective,
          iteration,
          summary,
          stoppedByControl: true,
          reason: 'control-stop-request',
        },
      });
      return {
        summary,
        stoppedByControl: true,
      };
    }

    const nowMs = Date.now();
    const untilMs = Date.parse(summary.backoff?.until || '');
    if (Number.isFinite(untilMs) && untilMs > nowMs) {
      await sleepImpl(untilMs - nowMs);
    }

    const turnLogEntries = [];
    const onTurnStartResult = await invokeLifecycleHook({
      rootDir,
      sessionId,
      hook: 'onTurnStart',
      phase: 'turn-start',
      iteration,
      callback: lifecycleHooks?.onTurnStart,
      payload: {
        rootDir,
        sessionId,
        objective: summary.objective,
        iteration,
        summary,
        provider: summary.provider,
        clientId: summary.clientId,
        profile: summary.profile,
        worktree,
      },
    });
    if (onTurnStartResult?.logEntry) {
      turnLogEntries.push(onTurnStartResult.logEntry);
    }

    const continuity = await readContinuitySummary({ workspaceRoot: rootDir, sessionId });
    const rawTurn = await executeTurn({
      rootDir,
      sessionId,
      objective: summary.objective,
      iteration,
      provider: summary.provider,
      clientId: summary.clientId,
      profile: summary.profile,
      summary,
      continuity,
      worktree,
    });

    const outcome = normalizeSoloIterationOutcome({
      sessionId,
      iteration,
      ...(rawTurn && typeof rawTurn === 'object' ? rawTurn : {}),
    });

    const onTurnCompleteResult = await invokeLifecycleHook({
      rootDir,
      sessionId,
      hook: 'onTurnComplete',
      phase: 'turn-complete',
      iteration,
      callback: lifecycleHooks?.onTurnComplete,
      payload: {
        rootDir,
        sessionId,
        objective: summary.objective,
        iteration,
        summary,
        outcome,
        rawTurn: rawTurn && typeof rawTurn === 'object' ? rawTurn : {},
      },
    });
    if (onTurnCompleteResult?.logEntry) {
      turnLogEntries.push(onTurnCompleteResult.logEntry);
    }

    const onBeforeContinuityCommitResult = await invokeLifecycleHook({
      rootDir,
      sessionId,
      hook: 'onBeforeContinuityCommit',
      phase: 'pre-continuity-commit',
      iteration,
      callback: lifecycleHooks?.onBeforeContinuityCommit,
      payload: {
        rootDir,
        sessionId,
        objective: summary.objective,
        iteration,
        summary,
        outcome,
      },
    });
    if (onBeforeContinuityCommitResult?.logEntry) {
      turnLogEntries.push(onBeforeContinuityCommitResult.logEntry);
    }

    summary = await persistIterationState({
      rootDir,
      sessionId,
      summary,
      outcome,
      prompt: rawTurn?.prompt || '',
      rawOutput: rawTurn?.rawOutput || '',
      extraLogEntries: [...(rawTurn?.logEntries || []), ...turnLogEntries],
    });

    if (outcome.shouldStop) {
      await invokeLifecycleHook({
        rootDir,
        sessionId,
        hook: 'onSessionEnd',
        phase: 'session-end',
        iteration,
        callback: lifecycleHooks?.onSessionEnd,
        payload: {
          rootDir,
          sessionId,
          objective: summary.objective,
          iteration,
          summary,
          stoppedByControl: false,
          reason: 'iteration-stop',
        },
      });
      return {
        summary,
        stoppedByControl: false,
      };
    }

    iteration += 1;
  }

  const maxOutcome = normalizeSoloIterationOutcome({
    sessionId,
    iteration,
    outcome: 'human-gate',
    summary: `Reached maxIterations (${max}).`,
    nextAction: 'Review the latest iteration and resume when the objective is ready for another loop.',
    shouldStop: true,
    failureClass: 'safety-gate',
  });
  summary = await persistIterationState({
    rootDir,
    sessionId,
    summary,
    outcome: maxOutcome,
  });

  await invokeLifecycleHook({
    rootDir,
    sessionId,
    hook: 'onSessionEnd',
    phase: 'session-end',
    iteration,
    callback: lifecycleHooks?.onSessionEnd,
    payload: {
      rootDir,
      sessionId,
      objective: summary.objective,
      iteration,
      summary,
      stoppedByControl: false,
      reason: 'max-iterations',
    },
  });

  return {
    summary,
    stoppedByControl: false,
  };
}
