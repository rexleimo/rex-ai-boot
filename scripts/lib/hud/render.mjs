function normalizeText(value) {
  return String(value ?? '').trim();
}

function clipLine(value, maxLen = 140) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function formatTelemetry(telemetry = null) {
  if (!telemetry || typeof telemetry !== 'object') return '';
  const parts = [];
  const verification = telemetry.verification && typeof telemetry.verification === 'object'
    ? telemetry.verification
    : null;
  if (verification?.result) {
    parts.push(`verify=${normalizeText(verification.result)}`);
  }
  if (Number.isFinite(telemetry.retryCount)) {
    parts.push(`retries=${Math.max(0, Math.floor(telemetry.retryCount))}`);
  }
  if (telemetry.failureCategory) {
    parts.push(`fail=${normalizeText(telemetry.failureCategory)}`);
  }
  if (Number.isFinite(telemetry.elapsedMs)) {
    parts.push(`elapsedMs=${Math.max(0, Math.floor(telemetry.elapsedMs))}`);
  }
  const cost = telemetry.cost && typeof telemetry.cost === 'object' ? telemetry.cost : null;
  if (cost) {
    const tokenPart = Number.isFinite(cost.totalTokens) && cost.totalTokens > 0
      ? `tokens=${Math.max(0, Math.floor(cost.totalTokens))}`
      : '';
    const usdPart = Number.isFinite(cost.usd) && cost.usd > 0
      ? `usd=${Number(cost.usd).toFixed(4)}`
      : '';
    const costParts = [tokenPart, usdPart].filter(Boolean);
    if (costParts.length > 0) {
      parts.push(`cost(${costParts.join(' ')})`);
    }
  }
  return parts.join(' ');
}

function formatSessionLine(state) {
  const session = state?.session || null;
  const selection = state?.selection || {};
  const sessionId = normalizeText(selection.sessionId || session?.sessionId);
  const agent = normalizeText(selection.agent || session?.agent);
  const provider = normalizeText(selection.provider);
  const status = normalizeText(session?.status);
  const updatedAt = normalizeText(session?.updatedAt);
  const bits = [
    sessionId ? `session=${sessionId}` : '',
    provider ? `provider=${provider}` : '',
    agent ? `agent=${agent}` : '',
    status ? `status=${status}` : '',
    updatedAt ? `updatedAt=${updatedAt}` : '',
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(' | ') : '(no session selected)';
}

function formatCheckpointLine(state) {
  const checkpoint = state?.latestCheckpoint || null;
  if (!checkpoint) return 'Checkpoint: (none)';
  const seq = Number.isFinite(checkpoint.seq) ? `#${checkpoint.seq}` : '';
  const status = normalizeText(checkpoint.status);
  const summary = clipLine(checkpoint.summary, 120);
  const telemetry = formatTelemetry(checkpoint.telemetry);
  const bits = [
    'Checkpoint:',
    seq,
    status,
    telemetry ? `[${telemetry}]` : '',
    summary ? `- ${summary}` : '',
  ].filter(Boolean);
  return bits.join(' ');
}

function formatDispatchLine(state) {
  const dispatch = state?.latestDispatch || null;
  if (!dispatch) return 'Dispatch: (none)';
  const ok = dispatch.ok === true ? 'ok' : 'blocked';
  const mode = normalizeText(dispatch.mode) || 'unknown';
  const jobs = Number.isFinite(dispatch.jobCount) ? String(dispatch.jobCount) : '0';
  const blocked = Number.isFinite(dispatch.blockedJobs) ? String(dispatch.blockedJobs) : '0';
  const executors = Array.isArray(dispatch.executors) && dispatch.executors.length > 0
    ? dispatch.executors.join(',')
    : 'none';
  const artifact = normalizeText(dispatch.artifactPath);
  return [
    'Dispatch:',
    `${ok}`,
    `mode=${mode}`,
    `jobs=${jobs}`,
    `blocked=${blocked}`,
    `executors=${executors}`,
    artifact ? `artifact=${artifact}` : '',
  ].filter(Boolean).join(' ');
}

function formatDispatchHindsightLine(state) {
  const hindsight = state?.dispatchHindsight && typeof state.dispatchHindsight === 'object'
    ? state.dispatchHindsight
    : null;
  if (!hindsight) return '';

  const pairs = Number.isFinite(hindsight.pairsAnalyzed) ? Math.max(0, Math.floor(hindsight.pairsAnalyzed)) : 0;
  if (pairs <= 0) return '';

  const comparedJobs = Number.isFinite(hindsight.comparedJobs) ? Math.max(0, Math.floor(hindsight.comparedJobs)) : 0;
  const repeatBlocked = Number.isFinite(hindsight.repeatedBlockedTurns) ? Math.max(0, Math.floor(hindsight.repeatedBlockedTurns)) : 0;
  const regressions = Number.isFinite(hindsight.regressions) ? Math.max(0, Math.floor(hindsight.regressions)) : 0;
  const resolved = Number.isFinite(hindsight.resolvedBlockedTurns) ? Math.max(0, Math.floor(hindsight.resolvedBlockedTurns)) : 0;
  const topFailures = Array.isArray(hindsight.topRepeatedFailureClasses) && hindsight.topRepeatedFailureClasses.length > 0
    ? hindsight.topRepeatedFailureClasses
      .slice(0, 3)
      .map((item) => `${normalizeText(item.failureClass) || 'unknown'}=${Number.isFinite(item.count) ? Math.max(0, Math.floor(item.count)) : 0}`)
      .join(', ')
    : 'none';
  const topJobs = Array.isArray(hindsight.topRepeatedJobs) && hindsight.topRepeatedJobs.length > 0
    ? hindsight.topRepeatedJobs
      .slice(0, 3)
      .map((item) => `${normalizeText(item.jobId) || 'unknown'}=${Number.isFinite(item.count) ? Math.max(0, Math.floor(item.count)) : 0}`)
      .join(', ')
    : 'none';

  return clipLine(
    `Dispatch Hindsight: pairs=${pairs} comparedJobs=${comparedJobs} repeatBlocked=${repeatBlocked} regressions=${regressions} resolved=${resolved} topFailures=${topFailures} topJobs=${topJobs}`,
    200
  );
}

function formatDispatchFixHintLine(state) {
  const fixHint = state?.dispatchFixHint && typeof state.dispatchFixHint === 'object'
    ? state.dispatchFixHint
    : null;
  if (!fixHint) return '';

  const targetId = normalizeText(fixHint.targetId);
  if (!targetId) return '';
  const title = normalizeText(fixHint.title) || targetId;
  const evidence = normalizeText(fixHint.evidence);
  const nextCommand = normalizeText(fixHint.nextCommand);
  const suffixParts = [];
  if (evidence) suffixParts.push(`(${evidence})`);
  if (nextCommand) suffixParts.push(`Next: ${nextCommand}`);
  const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';
  return clipLine(`FixHint: [${targetId}] ${title}${suffix}`, 200);
}

function formatDispatchHindsightLessons(state) {
  const hindsight = state?.dispatchHindsight && typeof state.dispatchHindsight === 'object'
    ? state.dispatchHindsight
    : null;
  if (!hindsight) return [];

  const lessons = Array.isArray(hindsight.lessons) ? hindsight.lessons : [];
  if (lessons.length === 0) return [];

  const lines = ['Hindsight lessons:'];
  for (const lesson of lessons.slice(0, 3)) {
    const kind = normalizeText(lesson?.kind) || 'unknown';
    const jobId = normalizeText(lesson?.jobId) || 'unknown';
    const failureClass = normalizeText(lesson?.from?.failureClass) || 'unknown';
    const workItemRefs = Array.isArray(lesson?.workItemRefs)
      ? lesson.workItemRefs.map((ref) => normalizeText(ref)).filter(Boolean)
      : [];
    const wiLabel = workItemRefs.length > 0 ? ` wi=${workItemRefs.join(',')}` : '';
    const hint = normalizeText(lesson?.hint);
    lines.push(`- ${kind} job=${jobId} fail=${failureClass}${wiLabel}${hint ? `: ${clipLine(hint, 120)}` : ''}`);
  }
  return lines;
}

function formatWorkItemsLine(state) {
  const totals = state?.latestDispatch?.workItems || null;
  if (!totals) return '';
  const parts = [];
  for (const key of ['total', 'queued', 'running', 'blocked', 'done']) {
    const value = totals[key];
    if (Number.isFinite(value)) parts.push(`${key}=${value}`);
  }
  return parts.length > 0 ? `WorkItems: ${parts.join(' ')}` : '';
}

function formatSuggestedCommands(state) {
  const commands = Array.isArray(state?.suggestedCommands) ? state.suggestedCommands : [];
  if (commands.length === 0) return [];
  const lines = ['Next:'];
  for (const cmd of commands.slice(0, 4)) {
    lines.push(`- ${cmd}`);
  }
  return lines;
}

function formatWarnings(state) {
  const warnings = Array.isArray(state?.warnings) ? state.warnings : [];
  if (warnings.length === 0) return [];
  const lines = ['Warnings:'];
  for (const warning of warnings.slice(0, 4)) {
    lines.push(`- ${warning}`);
  }
  return lines;
}

function formatBlockedJobs(state) {
  const blocked = Array.isArray(state?.latestDispatch?.blocked) ? state.latestDispatch.blocked : [];
  if (blocked.length === 0) return [];
  const lines = ['Blocked jobs:'];
  for (const job of blocked.slice(0, 10)) {
    const role = normalizeText(job.role) || 'unknown';
    const jobType = normalizeText(job.jobType) || 'unknown';
    const error = normalizeText(job.error);
    const failureClass = normalizeText(job.failureClass);
    const retryClass = normalizeText(job.retryClass);
    const failureLabel = failureClass ? ` fail=${failureClass}` : '';
    const retryLabel = retryClass ? ` retry=${retryClass}` : '';
    const workItemRefs = Array.isArray(job.workItemRefs) ? job.workItemRefs.map((ref) => normalizeText(ref)).filter(Boolean) : [];
    const wiLabel = workItemRefs.length > 0 ? ` wi=${workItemRefs.join(',')}` : '';
    const attempts = Number.isFinite(job.attempts) ? Math.max(0, Math.floor(job.attempts)) : 0;
    const attemptLabel = attempts > 0 ? ` a=${attempts}` : '';
    const turnId = normalizeText(job.turnId);
    const turnLabel = turnId ? ` turn=${clipLine(turnId, 90)}` : '';
    lines.push(`- ${job.jobId} (${role}/${jobType}${wiLabel}${attemptLabel}${failureLabel}${retryLabel})${turnLabel}${error ? `: ${clipLine(error, 120)}` : ''}`);
  }
  if (blocked.length > 10) {
    lines.push(`- +${blocked.length - 10} more`);
  }
  return lines;
}

export function normalizeHudPreset(raw = 'focused') {
  const value = normalizeText(raw).toLowerCase();
  if (value === 'minimal' || value === 'focused' || value === 'full') return value;
  return 'focused';
}

export function renderHud(state, { preset = 'focused' } = {}) {
  const resolvedPreset = normalizeHudPreset(preset);

  if (resolvedPreset === 'minimal') {
    const sessionLine = formatSessionLine(state);
    const dispatch = state?.latestDispatch || null;
    const dispatchLabel = dispatch ? (dispatch.ok === true ? 'dispatch=ok' : `dispatch=blocked(${dispatch.blockedJobs || 0})`) : 'dispatch=none';
    return `${sessionLine}\n${dispatchLabel}\n`;
  }

  const lines = [
    `AIOS HUD (${resolvedPreset})`,
    formatSessionLine(state),
    '',
    `Goal: ${clipLine(state?.session?.goal, 200) || '(none)'}`,
    formatCheckpointLine(state),
    formatDispatchLine(state),
  ];

  const hindsight = formatDispatchHindsightLine(state);
  if (hindsight) {
    lines.push(hindsight);
  }
  const fixHint = formatDispatchFixHintLine(state);
  if (fixHint) {
    lines.push(fixHint);
  }

  const workItems = formatWorkItemsLine(state);
  if (workItems) {
    lines.push(workItems);
  }

  if (resolvedPreset === 'full') {
    lines.push('');
    lines.push(...formatBlockedJobs(state));
    const lessons = formatDispatchHindsightLessons(state);
    if (lessons.length > 0) {
      lines.push('');
      lines.push(...lessons);
    }
  }

  const warnings = formatWarnings(state);
  if (warnings.length > 0) {
    lines.push('');
    lines.push(...warnings);
  }

  const next = formatSuggestedCommands(state);
  if (next.length > 0) {
    lines.push('');
    lines.push(...next);
  }

  return lines.join('\n').trimEnd() + '\n';
}
