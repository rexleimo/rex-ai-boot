import { createDefaultLearnEvalOptions, normalizeLearnEvalFormat } from './options.mjs';
import { buildLearnEvalReport, renderLearnEvalReport } from '../harness/learn-eval.mjs';
import { persistLearnEvalHindsightEvidence } from '../harness/learn-eval-evidence.mjs';
import { parseArgs } from '../cli/parse-args.mjs';

const AIOS_COMMAND_PREFIX = 'node scripts/aios.mjs ';
const DRAFT_TARGET_PREFIX = 'draft.';

function normalizeDraftTargetId(value = '') {
  return String(value || '').trim();
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
  if (!trimmed.startsWith(AIOS_COMMAND_PREFIX)) return null;

  try {
    return parseArgs(tokenizeCliFragment(trimmed.slice(AIOS_COMMAND_PREFIX.length)));
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

function isDraftRecommendation(item) {
  const targetId = normalizeDraftTargetId(item?.targetId);
  return targetId.startsWith(DRAFT_TARGET_PREFIX);
}

function selectDraftRecommendations(report, options) {
  const allRecommendations = Array.isArray(report?.recommendations?.all)
    ? report.recommendations.all
    : [];
  const draftRecommendations = allRecommendations.filter((item) => isDraftRecommendation(item));
  const requestedDraftId = normalizeDraftTargetId(options.applyDraftId);

  if (requestedDraftId) {
    const selected = draftRecommendations.find((item) => normalizeDraftTargetId(item.targetId) === requestedDraftId);
    if (!selected) {
      throw new Error(`Unknown draft recommendation: ${requestedDraftId}`);
    }
    return [selected];
  }

  if (options.applyDrafts) {
    return draftRecommendations;
  }

  return [];
}

function summarizeDraftApplyResults(results = []) {
  const safeResults = Array.isArray(results) ? results : [];
  const counts = {
    selected: safeResults.length,
    applied: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };

  for (const item of safeResults) {
    const status = String(item?.status || '').trim();
    if (status === 'applied') counts.applied += 1;
    else if (status === 'failed') counts.failed += 1;
    else if (status === 'dry-run') counts.dryRun += 1;
    else counts.skipped += 1;
  }

  return counts;
}

function renderDraftApplySummary(draftApply = null) {
  if (!draftApply || typeof draftApply !== 'object') return '';

  const counts = draftApply.counts || {
    selected: 0,
    applied: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };
  const lines = [
    '',
    'Draft Apply:',
    `- mode=${draftApply.mode} dryRun=${draftApply.dryRun} selected=${counts.selected} applied=${counts.applied} dryRunActions=${counts.dryRun} failed=${counts.failed} skipped=${counts.skipped}`,
  ];
  for (const result of Array.isArray(draftApply.results) ? draftApply.results : []) {
    const targetId = normalizeDraftTargetId(result?.targetId) || '(unknown)';
    const status = String(result?.status || 'skipped').trim() || 'skipped';
    const message = String(result?.summary || '').trim() || '(no summary)';
    lines.push(`- [${status}] ${targetId}: ${message}`);
  }
  return lines.join('\n');
}

async function executeParsedAiosAction(parsedAction, { rootDir, sessionId, env }) {
  if (!parsedAction || parsedAction.mode === 'help') {
    return {
      status: 'failed',
      summary: 'Unsupported draft command (cannot parse action)',
      exitCode: 1,
      command: '',
    };
  }

  const command = String(parsedAction.command || '').trim();
  if (command === 'memo') {
    const { runMemo } = await import('../memo/memo.mjs');
    const buffered = createBufferedIo();
    await runMemo(parsedAction.options, { io: buffered.io });
    return {
      status: 'applied',
      summary: buffered.lines.at(-1) || 'Memo command completed',
      exitCode: 0,
      command,
    };
  }

  if (command === 'quality-gate') {
    const { runQualityGate } = await import('./quality-gate.mjs');
    const buffered = createBufferedIo();
    const qualityOptions = {
      ...parsedAction.options,
      sessionId: String(parsedAction.options?.sessionId || '').trim() || sessionId,
    };
    const result = await runQualityGate(qualityOptions, { rootDir, io: buffered.io, env });
    return {
      status: result.exitCode === 0 ? 'applied' : 'failed',
      summary: buffered.lines.at(-1) || `quality-gate ${qualityOptions.mode || 'full'}`,
      exitCode: result.exitCode,
      command,
    };
  }

  return {
    status: 'failed',
    summary: `Unsupported draft command: ${command || '(unknown)'}`,
    exitCode: 1,
    command,
  };
}

async function executeStructuredDraftAction(draftAction, { rootDir, sessionId, env }) {
  const actionKind = String(draftAction?.kind || '').trim();
  if (actionKind === 'memo-add') {
    const text = String(draftAction?.text || '').trim();
    if (!text) {
      return {
        status: 'failed',
        summary: 'Invalid memo-add draft action: missing text',
        exitCode: 1,
        command: 'memo',
      };
    }

    const { runMemo } = await import('../memo/memo.mjs');
    const buffered = createBufferedIo();
    await runMemo({ argv: ['add', text] }, { io: buffered.io });
    return {
      status: 'applied',
      summary: buffered.lines.at(-1) || 'Memo command completed',
      exitCode: 0,
      command: 'memo',
    };
  }

  if (actionKind === 'quality-gate') {
    const { runQualityGate } = await import('./quality-gate.mjs');
    const buffered = createBufferedIo();
    const mode = String(draftAction?.mode || '').trim() || 'pre-pr';
    const result = await runQualityGate(
      {
        mode,
        sessionId: sessionId || '',
      },
      { rootDir, io: buffered.io, env }
    );
    return {
      status: result.exitCode === 0 ? 'applied' : 'failed',
      summary: buffered.lines.at(-1) || `quality-gate ${mode}`,
      exitCode: result.exitCode,
      command: 'quality-gate',
    };
  }

  return {
    status: 'failed',
    summary: `Unsupported draftAction kind: ${actionKind || '(unknown)'}`,
    exitCode: 1,
    command: actionKind,
  };
}

async function executeDraftRecommendations(
  recommendations = [],
  {
    rootDir,
    sessionId = '',
    env = process.env,
    dryRun = false,
  } = {}
) {
  const results = [];
  for (const recommendation of recommendations) {
    const targetId = normalizeDraftTargetId(recommendation?.targetId);
    const nextCommand = String(recommendation?.nextCommand || '').trim();
    const draftAction = recommendation?.draftAction && typeof recommendation.draftAction === 'object'
      ? recommendation.draftAction
      : null;
    if (!targetId) continue;

    if (!nextCommand && !draftAction) {
      results.push({
        targetId,
        status: 'skipped',
        summary: 'Missing nextCommand/draftAction on draft recommendation',
        nextCommand: '',
      });
      continue;
    }

    if (dryRun) {
      const dryRunSummary = draftAction
        ? `Would apply draftAction: ${String(draftAction.kind || 'unknown')}`
        : `Would run: ${nextCommand}`;
      results.push({
        targetId,
        status: 'dry-run',
        summary: dryRunSummary,
        nextCommand,
      });
      continue;
    }

    try {
      const execution = draftAction
        ? await executeStructuredDraftAction(draftAction, { rootDir, sessionId, env })
        : await executeParsedAiosAction(parseAiosCommandAction(nextCommand), { rootDir, sessionId, env });
      results.push({
        targetId,
        status: execution.status,
        summary: execution.summary,
        exitCode: execution.exitCode,
        nextCommand,
      });
    } catch (error) {
      results.push({
        targetId,
        status: 'failed',
        summary: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        nextCommand,
      });
    }
  }

  const counts = summarizeDraftApplyResults(results);
  return {
    mode: recommendations.length === 1 ? 'single' : 'all',
    dryRun,
    selectedTargetIds: recommendations.map((item) => normalizeDraftTargetId(item?.targetId)).filter(Boolean),
    counts,
    results,
  };
}

export function normalizeLearnEvalOptions(rawOptions = {}) {
  const defaults = createDefaultLearnEvalOptions();
  const limit = Number.isFinite(rawOptions.limit)
    ? Math.max(1, Math.floor(rawOptions.limit))
    : defaults.limit;
  const applyDraftId = normalizeDraftTargetId(rawOptions.applyDraftId ?? defaults.applyDraftId);
  const applyDrafts = rawOptions.applyDrafts === true;
  const applyDryRun = rawOptions.applyDryRun === true;
  const sessionId = String(rawOptions.sessionId || '').trim();

  if (applyDraftId && applyDrafts) {
    throw new Error('--apply-draft and --apply-drafts cannot be used together');
  }
  if ((applyDraftId || applyDrafts) && !sessionId) {
    throw new Error('--apply-draft/--apply-drafts requires --session');
  }

  return {
    sessionId,
    limit,
    format: normalizeLearnEvalFormat(rawOptions.format ?? defaults.format),
    applyDraftId,
    applyDrafts,
    applyDryRun,
  };
}

export function planLearnEval(rawOptions = {}) {
  const options = normalizeLearnEvalOptions(rawOptions);
  const args = ['learn-eval'];
  if (options.sessionId) {
    args.push('--session', options.sessionId);
  }
  if (options.limit !== 10) {
    args.push('--limit', String(options.limit));
  }
  if (options.format !== 'text') {
    args.push('--format', options.format);
  }
  if (options.applyDraftId) {
    args.push('--apply-draft', options.applyDraftId);
  } else if (options.applyDrafts) {
    args.push('--apply-drafts');
  }
  if (options.applyDryRun) {
    args.push('--apply-dry-run');
  }
  return {
    command: 'learn-eval',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runLearnEval(
  rawOptions = {},
  {
    rootDir,
    io = console,
    env = process.env,
    persistHindsightEvidence = persistLearnEvalHindsightEvidence,
    buildReport = buildLearnEvalReport,
    executeDrafts = executeDraftRecommendations,
  } = {}
) {
  const { options } = planLearnEval(rawOptions);
  const report = await buildReport(options, { rootDir });
  const hindsightEvidence = await persistHindsightEvidence({ rootDir, report });
  if (hindsightEvidence && typeof hindsightEvidence === 'object') {
    report.hindsightEvidence = hindsightEvidence;
  }

  let exitCode = 0;
  if (options.applyDraftId || options.applyDrafts) {
    const selectedDrafts = selectDraftRecommendations(report, options);
    const draftApply = await executeDrafts(selectedDrafts, {
      rootDir,
      sessionId: options.sessionId,
      env,
      dryRun: options.applyDryRun,
    });
    draftApply.mode = options.applyDraftId ? 'single' : 'all';
    draftApply.requestedTargetId = options.applyDraftId || null;
    report.draftApply = draftApply;
    if (Number(draftApply?.counts?.failed || 0) > 0) {
      exitCode = 1;
    }
  }

  if (options.format === 'json') {
    io.log(JSON.stringify(report, null, 2));
    return { exitCode, report };
  }

  const output = [renderLearnEvalReport(report)];
  if (report.draftApply) {
    output.push(renderDraftApplySummary(report.draftApply));
  }
  io.log(output.filter(Boolean).join('\n'));
  return { exitCode, report };
}
