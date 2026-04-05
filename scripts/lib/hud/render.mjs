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
    const workItemRefs = Array.isArray(job.workItemRefs) ? job.workItemRefs.map((ref) => normalizeText(ref)).filter(Boolean) : [];
    const wiLabel = workItemRefs.length > 0 ? ` wi=${workItemRefs.join(',')}` : '';
    const attempts = Number.isFinite(job.attempts) ? Math.max(0, Math.floor(job.attempts)) : 0;
    const attemptLabel = attempts > 0 ? ` a=${attempts}` : '';
    const turnId = normalizeText(job.turnId);
    const turnLabel = turnId ? ` turn=${clipLine(turnId, 90)}` : '';
    lines.push(`- ${job.jobId} (${role}/${jobType}${wiLabel}${attemptLabel})${turnLabel}${error ? `: ${clipLine(error, 120)}` : ''}`);
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

  const workItems = formatWorkItemsLine(state);
  if (workItems) {
    lines.push(workItems);
  }

  if (resolvedPreset === 'full') {
    lines.push('');
    lines.push(...formatBlockedJobs(state));
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
