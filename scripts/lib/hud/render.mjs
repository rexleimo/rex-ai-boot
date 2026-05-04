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

function formatHarnessLine(state) {
  const harness = state?.latestHarnessRun && typeof state.latestHarnessRun === 'object'
    ? state.latestHarnessRun
    : null;
  if (!harness) return '';

  const parts = [
    `status=${normalizeText(harness.status) || 'unknown'}`,
  ];
  if (Number.isFinite(harness.iterationCount)) parts.push(`iteration=${Math.max(0, Math.floor(harness.iterationCount))}`);
  if (normalizeText(harness.lastOutcome)) parts.push(`outcome=${normalizeText(harness.lastOutcome)}`);
  if (normalizeText(harness.lastFailureClass)) parts.push(`fail=${normalizeText(harness.lastFailureClass)}`);
  const backoffDelay = Number.isFinite(harness.backoff?.nextDelayMs)
    ? Math.max(0, Math.floor(harness.backoff.nextDelayMs))
    : null;
  if (backoffDelay !== null) parts.push(`backoff=${backoffDelay}ms`);
  const stopRequested = state?.harnessControl?.stopRequested === true || harness.stopRequested === true;
  parts.push(`stopRequested=${stopRequested ? 'true' : 'false'}`);
  if (harness.worktree?.enabled === true) {
    parts.push(`worktree=${harness.worktree.preserved === true ? 'preserved' : 'enabled'}`);
  }
  return clipLine(`Harness: ${parts.join(' ')}`, 220);
}

function formatDispatchInsightsSignals(insights = null) {
  const signals = Array.isArray(insights?.signals) ? insights.signals : [];
  if (signals.length === 0) return 'signals=(none)';

  const parts = signals.slice(0, 3).map((signal) => {
    const id = normalizeText(signal?.id) || 'unknown';
    const severity = normalizeText(signal?.severity) || 'info';
    const count = Number.isFinite(signal?.count) && signal.count > 1 ? `#${Math.max(0, Math.floor(signal.count))}` : '';
    return `${id}:${severity}${count}`;
  });

  return `signals=${parts.join(', ')}`;
}

function formatDispatchInsightsActions(insights = null) {
  const actions = Array.isArray(insights?.suggestedActions) ? insights.suggestedActions : [];
  if (actions.length === 0) return 'actions=(none)';

  const parts = actions.slice(0, 3).map((action) => normalizeText(action?.id) || normalizeText(action?.label) || 'unknown');
  return `actions=${parts.join(', ')}`;
}

function formatDispatchInsightsLine(state) {
  const insights = state?.latestDispatch?.dispatchInsights && typeof state.latestDispatch.dispatchInsights === 'object'
    ? state.latestDispatch.dispatchInsights
    : null;
  if (!insights) return '';

  const status = normalizeText(insights.status) || 'attention';
  const score = Number.isFinite(insights.score) ? Math.max(0, Math.floor(insights.score)) : 0;
  return clipLine(
    `Dispatch Insights: status=${status} score=${score} ${formatDispatchInsightsSignals(insights)} ${formatDispatchInsightsActions(insights)}`,
    260
  );
}

function normalizeProgressCounts(progress = null) {
  if (!progress || typeof progress !== 'object') return null;
  const total = Number.isFinite(progress.total) ? Math.max(0, Math.floor(progress.total)) : 0;
  const queued = Number.isFinite(progress.queued) ? Math.max(0, Math.floor(progress.queued)) : 0;
  const running = Number.isFinite(progress.running) ? Math.max(0, Math.floor(progress.running)) : 0;
  const blocked = Number.isFinite(progress.blocked) ? Math.max(0, Math.floor(progress.blocked)) : 0;
  const done = Number.isFinite(progress.done) ? Math.max(0, Math.floor(progress.done)) : 0;
  const completionRatio = Number.isFinite(progress.completionRatio)
    ? Math.max(0, Math.min(1, Number(progress.completionRatio)))
    : total > 0
      ? Math.max(0, Math.min(1, done / total))
      : 0;
  if (total <= 0) return null;
  return {
    total,
    queued,
    running,
    blocked,
    done,
    completionRatio,
  };
}

function formatCompletionPercent(completionRatio = 0) {
  const ratio = Number.isFinite(completionRatio) ? Math.max(0, Math.min(1, Number(completionRatio))) : 0;
  return `${Math.round(ratio * 100)}%`;
}

function formatMinimalDispatchProgressLabel(state) {
  const dispatch = state?.latestDispatch || null;
  const progress = normalizeProgressCounts(dispatch?.jobProgress);
  if (!dispatch || !progress) return '';

  const parts = [
    `jobs=${progress.done}/${progress.total}`,
  ];
  if (progress.running > 0) parts.push(`run=${progress.running}`);
  if (progress.blocked > 0) parts.push(`blk=${progress.blocked}`);
  if (progress.queued > 0) parts.push(`q=${progress.queued}`);

  const tools = Array.isArray(dispatch.toolProgress)
    ? dispatch.toolProgress.map((item) => ({
      tool: normalizeText(item?.tool),
      progress: normalizeProgressCounts(item),
    }))
      .filter((item) => item.tool && item.progress)
    : [];
  if (tools.length > 0) {
    const primary = tools[0];
    parts.push(`tool=${primary.tool}:${primary.progress.done}/${primary.progress.total}`);
    if (tools.length > 1) parts.push(`+${tools.length - 1}`);
  }

  return parts.join(' ');
}

function formatMinimalWatchdogLabel(state) {
  const watchdog = state?.watchdog && typeof state.watchdog === 'object'
    ? state.watchdog
    : null;
  if (!watchdog) return '';
  const readiness = watchdog.readiness && typeof watchdog.readiness === 'object'
    ? watchdog.readiness
    : null;
  const verdict = normalizeText(readiness?.verdict);
  return verdict ? `readiness=${verdict}` : '';
}

function formatWatchdogLine(state) {
  const watchdog = state?.watchdog && typeof state.watchdog === 'object'
    ? state.watchdog
    : null;
  if (!watchdog) return '';
  const readiness = watchdog.readiness && typeof watchdog.readiness === 'object'
    ? watchdog.readiness
    : null;
  const verdict = normalizeText(readiness?.verdict);
  const decision = normalizeText(watchdog.decision);
  const bits = [
    'Watchdog:',
    decision ? `decision=${decision}` : '',
    verdict ? `readiness=${verdict}` : '',
  ].filter(Boolean);
  return bits.length > 1 ? bits.join(' ') : '';
}

function formatDispatchProgressLine(state) {
  const progress = normalizeProgressCounts(state?.latestDispatch?.jobProgress);
  if (!progress) return '';
  return [
    'Dispatch Progress:',
    `jobs total=${progress.total}`,
    `done=${progress.done}`,
    `running=${progress.running}`,
    `blocked=${progress.blocked}`,
    `queued=${progress.queued}`,
    `completion=${formatCompletionPercent(progress.completionRatio)}`,
  ].join(' ');
}

function formatToolProgressLine(state) {
  const toolProgress = Array.isArray(state?.latestDispatch?.toolProgress)
    ? state.latestDispatch.toolProgress
    : [];
  const normalized = toolProgress
    .map((item) => ({
      tool: normalizeText(item?.tool),
      progress: normalizeProgressCounts(item),
    }))
    .filter((item) => item.tool && item.progress);
  if (normalized.length === 0) return '';

  const top = normalized.slice(0, 3).map((item) =>
    `${item.tool} ${item.progress.done}/${item.progress.total} (r=${item.progress.running} b=${item.progress.blocked} q=${item.progress.queued})`
  );
  if (normalized.length > 3) {
    top.push(`+${normalized.length - 3} more`);
  }
  return clipLine(`Tool Progress: ${top.join(' | ')}`, 220);
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

function formatSkillCandidateLine(state) {
  const candidate = state?.latestSkillCandidate && typeof state.latestSkillCandidate === 'object'
    ? state.latestSkillCandidate
    : null;
  if (!candidate) return '';

  const skillId = normalizeText(candidate.skillId);
  const scope = normalizeText(candidate.scope);
  const failureClass = normalizeText(candidate.failureClass);
  const lessonCount = Number.isFinite(candidate.lessonCount) ? Math.max(0, Math.floor(candidate.lessonCount)) : 0;
  const reviewMode = normalizeText(candidate.reviewMode);
  const reviewStatus = normalizeText(candidate.reviewStatus);
  const sourceDraftTargetId = normalizeText(candidate.sourceDraftTargetId);
  const sourceArtifactPath = normalizeText(candidate.sourceArtifactPath);
  const artifactPath = normalizeText(candidate.artifactPath);
  const patchHint = clipLine(candidate.patchHint, 100);

  const parts = [];
  if (skillId) parts.push(`skill=${skillId}`);
  if (scope) parts.push(`scope=${scope}`);
  if (failureClass) parts.push(`failure=${failureClass}`);
  if (lessonCount > 0) parts.push(`lessons=${lessonCount}`);
  if (reviewMode) parts.push(`review=${reviewMode}`);
  if (reviewStatus) parts.push(`status=${reviewStatus}`);
  if (sourceDraftTargetId) parts.push(`draft=${sourceDraftTargetId}`);
  if (sourceArtifactPath) parts.push(`source=${sourceArtifactPath}`);
  if (artifactPath) parts.push(`artifact=${artifactPath}`);
  if (patchHint) parts.push(`hint="${patchHint}"`);
  if (parts.length === 0) return '';

  return clipLine(`SkillCandidate: ${parts.join(' ')}`, 260);
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
  const commands = [
    ...(Array.isArray(state?.harnessSuggestedCommands) ? state.harnessSuggestedCommands : []),
    ...(Array.isArray(state?.suggestedCommands) ? state.suggestedCommands : []),
  ];
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

function formatWatchMetaLine(watchMeta = null) {
  if (!watchMeta || typeof watchMeta !== 'object') return '';
  const renderIntervalMs = Number.isFinite(watchMeta.renderIntervalMs)
    ? Math.max(1, Math.floor(watchMeta.renderIntervalMs))
    : null;
  const renderIntervalLabel = normalizeText(watchMeta.renderIntervalLabel);
  const dataRefreshMs = Number.isFinite(watchMeta.dataRefreshMs)
    ? Math.max(1, Math.floor(watchMeta.dataRefreshMs))
    : null;
  const dataRefreshLabel = normalizeText(watchMeta.dataRefreshLabel);
  const resolvedRenderLabel = renderIntervalLabel || (renderIntervalMs ? `${renderIntervalMs}ms` : '');
  const resolvedDataRefreshLabel = dataRefreshLabel || (dataRefreshMs ? `${dataRefreshMs}ms` : '');
  if (!resolvedRenderLabel || !resolvedDataRefreshLabel) return '';
  const fastEnabled = watchMeta.fast === true ? 'on' : 'off';
  const dataAgeMs = Number.isFinite(watchMeta.dataAgeMs)
    ? `${Math.max(0, Math.floor(watchMeta.dataAgeMs))}ms`
    : 'n/a';
  const stalledEnabled = watchMeta.stalled === true;
  const stalledForMs = Number.isFinite(watchMeta.stalledForMs)
    ? Math.max(0, Math.floor(watchMeta.stalledForMs))
    : 0;
  const stalledThresholdMs = Number.isFinite(watchMeta.stalledThresholdMs)
    ? Math.max(1, Math.floor(watchMeta.stalledThresholdMs))
    : 0;
  const stalledToolSummary = normalizeText(watchMeta.stalledToolSummary);
  const stalledLabel = stalledEnabled
    ? ` stalled=on(${stalledForMs}ms>=${stalledThresholdMs}ms${stalledToolSummary ? ` tools=${stalledToolSummary}` : ''})`
    : '';
  return `watch: render=${resolvedRenderLabel} data-refresh=${resolvedDataRefreshLabel} fast=${fastEnabled} data-age=${dataAgeMs}${stalledLabel}`;
}

function formatMinimalQualityLabel(state) {
  const qualityGate = state?.latestQualityGate && typeof state.latestQualityGate === 'object'
    ? state.latestQualityGate
    : null;
  if (!qualityGate) return '';

  const outcome = normalizeText(qualityGate.outcome).toLowerCase();
  const categoryRef = normalizeText(qualityGate.categoryRef);
  const outcomeLabel = outcome === 'retry-needed'
    ? 'failed'
    : outcome === 'success'
      ? 'ok'
      : outcome;

  if (!outcomeLabel || outcomeLabel === 'ok') {
    return '';
  }

  if (categoryRef) {
    return `quality=${outcomeLabel}(${categoryRef})`;
  }

  return `quality=${outcomeLabel}`;
}

function formatMinimalSkillCandidateLabel(state) {
  const candidate = state?.latestSkillCandidate && typeof state.latestSkillCandidate === 'object'
    ? state.latestSkillCandidate
    : null;
  if (!candidate) return '';

  const skillId = normalizeText(candidate.skillId);
  const failureClass = normalizeText(candidate.failureClass);
  const scope = normalizeText(candidate.scope);
  const lessonCount = Number.isFinite(candidate.lessonCount) ? Math.max(0, Math.floor(candidate.lessonCount)) : 0;
  if (!skillId) return '';

  const scopeOrFailure = failureClass || scope || '';
  const countLabel = lessonCount > 0 ? `#${lessonCount}` : '';
  return scopeOrFailure
    ? `skill=${skillId}/${scopeOrFailure}${countLabel}`
    : `skill=${skillId}${countLabel}`;
}

function formatQualityGateLine(state) {
  const qualityGate = state?.latestQualityGate && typeof state.latestQualityGate === 'object'
    ? state.latestQualityGate
    : null;
  if (!qualityGate) return '';

  const outcomeRaw = normalizeText(qualityGate.outcome).toLowerCase();
  const outcomeLabel = outcomeRaw === 'retry-needed'
    ? 'failed'
    : outcomeRaw === 'success'
      ? 'ok'
      : outcomeRaw;
  if (!outcomeLabel) return '';

  const failureCategory = normalizeText(qualityGate.failureCategory);
  const categoryRef = normalizeText(qualityGate.categoryRef).replace(/^category:/, '');
  const category = failureCategory || categoryRef;
  return category
    ? `Quality: ${outcomeLabel} (${category})`
    : `Quality: ${outcomeLabel}`;
}

export function normalizeHudPreset(raw = 'focused') {
  const value = normalizeText(raw).toLowerCase();
  if (value === 'minimal' || value === 'focused' || value === 'full') return value;
  return 'focused';
}

export function renderHud(state, { preset = 'focused', watchMeta = null } = {}) {
  const resolvedPreset = normalizeHudPreset(preset);
  const resolvedWatchMeta = watchMeta || state?.watchMeta || null;
  const watchLine = formatWatchMetaLine(resolvedWatchMeta);

  if (resolvedPreset === 'minimal') {
    const sessionLine = formatSessionLine(state);
    const dispatch = state?.latestDispatch || null;
    const dispatchLabel = dispatch ? (dispatch.ok === true ? 'dispatch=ok' : `dispatch=blocked(${dispatch.blockedJobs || 0})`) : 'dispatch=none';
    const harnessLine = formatHarnessLine(state);
    const dispatchProgressLabel = formatMinimalDispatchProgressLabel(state);
    const qualityLabel = formatMinimalQualityLabel(state);
    const skillCandidateLabel = formatMinimalSkillCandidateLabel(state);
    const watchdogLabel = formatMinimalWatchdogLabel(state);
    const insights = dispatch?.dispatchInsights && typeof dispatch.dispatchInsights === 'object'
      ? dispatch.dispatchInsights
      : null;
    const insightsLabel = insights && insights.status && insights.status !== 'clear'
      ? `insights=${normalizeText(insights.status)}(${Number.isFinite(insights.score) ? Math.max(0, Math.floor(insights.score)) : 0})`
      : '';
    const statusLine = [
      harnessLine,
      dispatchLabel,
      insightsLabel,
      dispatchProgressLabel,
      qualityLabel,
      skillCandidateLabel,
      watchdogLabel,
    ].filter(Boolean).join(' ');
    return watchLine
      ? `${sessionLine}\n${statusLine}\n${watchLine}\n`
      : `${sessionLine}\n${statusLine}\n`;
  }

  const lines = [
    `AIOS HUD (${resolvedPreset})`,
    formatSessionLine(state),
    ...(watchLine ? [watchLine] : []),
    '',
    `Goal: ${clipLine(state?.session?.goal, 200) || '(none)'}`,
    formatCheckpointLine(state),
    formatHarnessLine(state),
    formatDispatchLine(state),
    formatDispatchInsightsLine(state),
    formatWatchdogLine(state),
  ];

  const dispatchProgressLine = formatDispatchProgressLine(state);
  if (dispatchProgressLine) {
    lines.push(dispatchProgressLine);
  }
  const toolProgressLine = formatToolProgressLine(state);
  if (toolProgressLine) {
    lines.push(toolProgressLine);
  }

  const qualityGateLine = formatQualityGateLine(state);
  if (qualityGateLine) {
    lines.push(qualityGateLine);
  }

  const hindsight = formatDispatchHindsightLine(state);
  if (hindsight) {
    lines.push(hindsight);
  }
  const fixHint = formatDispatchFixHintLine(state);
  if (fixHint) {
    lines.push(fixHint);
  }
  const skillCandidate = formatSkillCandidateLine(state);
  if (skillCandidate) {
    lines.push(skillCandidate);
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
