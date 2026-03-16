import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import agentSpec from '../../../memory/specs/orchestrator-agents.json' with { type: 'json' };
import { runContextDbCli } from '../contextdb-cli.mjs';
import { spawnCommand, spawnCommandWithInput, commandExists } from '../platform/process.mjs';
import { normalizeHandoffPayload, validateHandoffPayload } from './handoff.mjs';
import { normalizeOrchestratorAgentSpec } from './orchestrator-agents.mjs';
import { mergeParallelHandoffs } from './orchestrator.mjs';

export const SUBAGENT_CLIENT_ENV = 'AIOS_SUBAGENT_CLIENT';
export const SUBAGENT_CONCURRENCY_ENV = 'AIOS_SUBAGENT_CONCURRENCY';
export const SUBAGENT_TIMEOUT_MS_ENV = 'AIOS_SUBAGENT_TIMEOUT_MS';
export const SUBAGENT_CONTEXT_LIMIT_ENV = 'AIOS_SUBAGENT_CONTEXT_LIMIT';
export const SUBAGENT_CONTEXT_TOKEN_BUDGET_ENV = 'AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET';
export const SUBAGENT_UPSTREAM_MAX_ATTEMPTS_ENV = 'AIOS_SUBAGENT_UPSTREAM_MAX_ATTEMPTS';
export const SUBAGENT_UPSTREAM_BACKOFF_MS_ENV = 'AIOS_SUBAGENT_UPSTREAM_BACKOFF_MS';

const SUPPORTED_CLIENTS = new Set(['codex-cli']);
const CLIENT_COMMAND = {
  'codex-cli': 'codex',
};

const CODEX_OUTPUT_SCHEMA_REL = path.join('memory', 'specs', 'agent-handoff.schema.json');

function normalizeText(value) {
  return String(value ?? '').trim();
}

function clipText(value, maxLen = 8000) {
  const text = String(value ?? '');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n...[truncated]`;
}

function normalizeOwnedPath(value = '') {
  return normalizeText(value)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function normalizeOwnedPathPrefixes(raw = []) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => normalizeOwnedPath(item))
    .filter((item) => item.length > 0 || item === '');
}

function isAllowedByOwnedPrefixes(filePath, prefixes = []) {
  if (!Array.isArray(prefixes) || prefixes.length === 0) {
    return false;
  }
  if (prefixes.some((prefix) => prefix === '')) {
    return true;
  }
  return prefixes.some((prefix) => {
    if (filePath === prefix) return true;
    return filePath.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
  });
}

function resolveOwnedPathPrefixes(phase = null, job = null) {
  const jobPrefixes = normalizeOwnedPathPrefixes(job?.launchSpec?.ownedPathPrefixes);
  if (jobPrefixes.length > 0) {
    return jobPrefixes;
  }
  return normalizeOwnedPathPrefixes(phase?.ownedPathPrefixes);
}

function evaluatePhaseFilePolicy(payload = {}, phase = null, job = null) {
  const filesTouched = Array.isArray(payload?.filesTouched)
    ? payload.filesTouched.map((item) => normalizeOwnedPath(item)).filter(Boolean)
    : [];
  if (filesTouched.length === 0) {
    return { ok: true, violations: [] };
  }

  const canEditFiles = phase?.canEditFiles === true;
  const ownedPathPrefixes = resolveOwnedPathPrefixes(phase, job);
  const violations = [];

  for (const filePath of filesTouched) {
    if (!canEditFiles) {
      violations.push(`${filePath} (role is read-only for this phase)`);
      continue;
    }
    if (ownedPathPrefixes.length === 0) {
      violations.push(`${filePath} (ownedPathPrefixes missing for editable phase)`);
      continue;
    }
    if (!isAllowedByOwnedPrefixes(filePath, ownedPathPrefixes)) {
      violations.push(`${filePath} (not under ownedPathPrefixes: ${ownedPathPrefixes.join(', ')})`);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

function summarizeFilePolicyViolation(violations = []) {
  if (!Array.isArray(violations) || violations.length === 0) {
    return 'File policy violation';
  }
  const preview = violations.slice(0, 3).join('; ');
  const remaining = violations.length > 3 ? `; +${violations.length - 3} more` : '';
  return `File policy violation: ${preview}${remaining}`;
}

function resolveRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // scripts/lib/harness/subagent-runtime.mjs -> repo root is three levels up.
  return path.resolve(here, '..', '..', '..');
}

function safeFileSlug(value) {
  const text = normalizeText(value).toLowerCase();
  return text.replace(/[^a-z0-9._-]+/g, '_').slice(0, 120) || 'job';
}

function parsePositiveInt(raw, fallback) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseNonNegativeInt(raw, fallback) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseNonNegativeNumber(raw, fallback = 0) {
  const value = Number.parseFloat(String(raw ?? '').trim());
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeCostTelemetry(raw = {}) {
  const inputTokens = parseNonNegativeInt(raw?.inputTokens, 0);
  const outputTokens = parseNonNegativeInt(raw?.outputTokens, 0);
  let totalTokens = parseNonNegativeInt(raw?.totalTokens, 0);
  const usd = parseNonNegativeNumber(raw?.usd, 0);
  if (totalTokens === 0 && (inputTokens > 0 || outputTokens > 0)) {
    totalTokens = inputTokens + outputTokens;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    usd: Number(usd.toFixed(4)),
  };
}

function hasCostTelemetry(raw = {}) {
  const cost = normalizeCostTelemetry(raw);
  return cost.inputTokens > 0 || cost.outputTokens > 0 || cost.totalTokens > 0 || cost.usd > 0;
}

function mergeCostTelemetry(base = {}, next = {}) {
  const left = normalizeCostTelemetry(base);
  const right = normalizeCostTelemetry(next);
  return normalizeCostTelemetry({
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    usd: left.usd + right.usd,
  });
}

function pickFirstMatch(text, patterns = [], parser = Number.parseInt) {
  const source = String(text || '');
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (!match || !match[1]) continue;
    const value = parser(String(match[1]).trim(), 10);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return 0;
}

function collectCostTelemetryFromText(rawText = '') {
  const text = String(rawText || '');
  return normalizeCostTelemetry({
    inputTokens: pickFirstMatch(text, [
      /\binput[\s_-]*tokens?\b\s*[:=]\s*(\d+)\b/i,
      /\bprompt[\s_-]*tokens?\b\s*[:=]\s*(\d+)\b/i,
    ], Number.parseInt),
    outputTokens: pickFirstMatch(text, [
      /\boutput[\s_-]*tokens?\b\s*[:=]\s*(\d+)\b/i,
      /\bcompletion[\s_-]*tokens?\b\s*[:=]\s*(\d+)\b/i,
    ], Number.parseInt),
    totalTokens: pickFirstMatch(text, [
      /\btotal[\s_-]*tokens?\b\s*[:=]\s*(\d+)\b/i,
    ], Number.parseInt),
    usd: pickFirstMatch(text, [
      /\busd\b\s*[:=]\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\b/i,
      /\bcost\b\s*[:=]\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\b/i,
    ], Number.parseFloat),
  });
}

function readUsageShape(source = {}) {
  if (!source || typeof source !== 'object') {
    return normalizeCostTelemetry();
  }
  return normalizeCostTelemetry({
    inputTokens: source.inputTokens ?? source.input_tokens ?? source.promptTokens ?? source.prompt_tokens,
    outputTokens: source.outputTokens ?? source.output_tokens ?? source.completionTokens ?? source.completion_tokens,
    totalTokens: source.totalTokens ?? source.total_tokens,
    usd: source.usd,
  });
}

function collectCostTelemetryFromJson(rawJson = null) {
  if (!rawJson || typeof rawJson !== 'object') {
    return normalizeCostTelemetry();
  }

  const usageCandidates = [
    rawJson,
    rawJson.usage,
    rawJson.usageMetadata,
    rawJson.tokenUsage,
    rawJson.metrics?.usage,
    rawJson.cost,
  ];

  let combined = normalizeCostTelemetry();
  for (const candidate of usageCandidates) {
    const next = readUsageShape(candidate);
    combined = normalizeCostTelemetry({
      inputTokens: Math.max(combined.inputTokens, next.inputTokens),
      outputTokens: Math.max(combined.outputTokens, next.outputTokens),
      totalTokens: Math.max(combined.totalTokens, next.totalTokens),
      usd: Math.max(combined.usd, next.usd),
    });
  }

  if (combined.usd === 0 && Number.isFinite(rawJson.costUsd)) {
    combined = normalizeCostTelemetry({
      ...combined,
      usd: Math.max(combined.usd, parseNonNegativeNumber(rawJson.costUsd, 0)),
    });
  }
  return combined;
}

function collectCostTelemetry({ rawText = '', rawJson = null } = {}) {
  const fromText = collectCostTelemetryFromText(rawText);
  const fromJson = collectCostTelemetryFromJson(rawJson);
  return normalizeCostTelemetry({
    inputTokens: Math.max(fromText.inputTokens, fromJson.inputTokens),
    outputTokens: Math.max(fromText.outputTokens, fromJson.outputTokens),
    totalTokens: Math.max(fromText.totalTokens, fromJson.totalTokens),
    usd: Math.max(fromText.usd, fromJson.usd),
  });
}

function detectSessionIdFromPlan(plan) {
  const overlay = plan?.learnEvalOverlay;
  const sessionId = normalizeText(overlay?.sourceSessionId || overlay?.sessionId || '');
  return sessionId || null;
}

async function loadContextPacket({ rootDir, sessionId, env, io }) {
  if (!sessionId) return { ok: false, contextText: '', contextPath: null, error: 'missing sessionId' };

  const limit = parsePositiveInt(env?.[SUBAGENT_CONTEXT_LIMIT_ENV], 30);
  const tokenBudgetRaw = String(env?.[SUBAGENT_CONTEXT_TOKEN_BUDGET_ENV] ?? '').trim();
  const tokenBudget = tokenBudgetRaw ? parseNonNegativeInt(tokenBudgetRaw, 0) : null;
  const outRel = path.join('memory', 'context-db', 'exports', `${sessionId}-context.md`);

  try {
    const args = [
      'context:pack',
      '--workspace',
      rootDir,
      '--session',
      sessionId,
      '--limit',
      String(limit),
      '--out',
      outRel,
    ];
    if (tokenBudget && tokenBudget > 0) {
      args.push('--token-budget', String(tokenBudget));
    }
    runContextDbCli(args, { cwd: rootDir });
    const absPath = path.join(rootDir, outRel);
    const contextText = await fs.readFile(absPath, 'utf8');
    return { ok: true, contextText: String(contextText || ''), contextPath: absPath, error: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io?.log?.(`[subagent-runtime] context pack failed: ${message}`);
    return { ok: false, contextText: '', contextPath: null, error: message };
  }
}

function extractJsonCandidate(rawText = '') {
  const text = String(rawText || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // ignore and try extraction below
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // ignore
    }
  }

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const candidate = text.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

function renderDependencyContext(dependencyRuns = []) {
  const handoffs = dependencyRuns
    .map((run) => run?.output?.payload)
    .filter(Boolean);
  if (handoffs.length === 0) {
    return '(none)';
  }
  return handoffs.map((payload, index) => `- upstream[${index + 1}]: ${JSON.stringify(payload)}`).join('\n');
}

function buildSystemPrompt({ agent, contextText, plan, job, phase }) {
  const lines = [];
  if (agent?.systemPrompt) {
    lines.push(agent.systemPrompt);
  } else {
    lines.push('You are a role-based subagent for AIOS orchestrations.');
  }

  lines.push('');
  lines.push('Output Contract');
  lines.push('Output a single JSON object (no surrounding text) that conforms to `memory/specs/agent-handoff.schema.json`.');
  lines.push('');
  lines.push('Required fields: schemaVersion, status, fromRole, toRole, taskTitle, contextSummary, findings, filesTouched, openQuestions, recommendations.');
  lines.push('Set schemaVersion=1. Always include array fields (empty arrays are OK).');
  lines.push(`Set fromRole=${normalizeText(job?.role) || 'unknown'} and toRole=${normalizeText(job?.launchSpec?.handoffTarget) || 'next-phase'}.`);
  lines.push('');

  if (contextText) {
    lines.push('Context Packet');
    lines.push(contextText.trim());
    lines.push('');
  }

  const ownedPrefixes = resolveOwnedPathPrefixes(phase, job).join(', ');
  const workItemRefs = Array.isArray(job?.launchSpec?.workItemRefs)
    ? job.launchSpec.workItemRefs.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  lines.push('Runtime Notes');
  lines.push(`- jobId=${normalizeText(job?.jobId)}`);
  lines.push(`- taskTitle=${normalizeText(plan?.taskTitle)}`);
  if (normalizeText(plan?.contextSummary)) {
    lines.push(`- contextSummary=${normalizeText(plan?.contextSummary)}`);
  }
  if (workItemRefs.length > 0) {
    lines.push(`- workItemRefs=${workItemRefs.join(', ')}`);
  }
  if (normalizeText(ownedPrefixes)) {
    lines.push(`- ownedPathPrefixes=${ownedPrefixes}`);
  }
  lines.push('');

  return lines.join('\n');
}

function buildUserPrompt({ plan, job, phase, dependencyRuns }) {
  const lines = [];
  lines.push(`# Orchestration Phase`);
  lines.push(`jobId: ${normalizeText(job?.jobId)}`);
  lines.push(`role: ${normalizeText(job?.role)}`);
  lines.push(`taskTitle: ${normalizeText(plan?.taskTitle)}`);
  lines.push('');

  if (phase) {
    lines.push('## Responsibility');
    lines.push(`${normalizeText(phase.label)}: ${normalizeText(phase.responsibility)}`);
    lines.push('');

    lines.push('## Ownership');
    lines.push(normalizeText(phase.ownership) || '(none)');
    lines.push('');

    lines.push('## File Policy');
    lines.push(`canEditFiles: ${phase.canEditFiles === true ? 'true' : 'false'}`);
    lines.push(`ownedPathPrefixes: ${JSON.stringify(resolveOwnedPathPrefixes(phase, job))}`);
    lines.push('');
  }

  lines.push('## Upstream Handoffs');
  lines.push(renderDependencyContext(dependencyRuns));
  lines.push('');

  const workItemRefs = Array.isArray(job?.launchSpec?.workItemRefs)
    ? job.launchSpec.workItemRefs.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  if (workItemRefs.length > 0) {
    lines.push('## Decomposed Work Items');
    const workItemMap = new Map(
      (Array.isArray(plan?.workItems) ? plan.workItems : [])
        .map((item) => [normalizeText(item?.itemId), item])
        .filter(([id]) => id)
    );
    for (const itemId of workItemRefs) {
      const item = workItemMap.get(itemId);
      if (!item) {
        lines.push(`- ${itemId}`);
        continue;
      }
      const summary = normalizeText(item.summary) || normalizeText(item.title);
      lines.push(`- [${normalizeText(item.type) || 'general'}] ${itemId}: ${summary}`);
    }
    lines.push('');
  }

  lines.push('## Deliverable');
  lines.push('- Summarize concrete findings.');
  lines.push('- If you touched files, list them in `filesTouched` (relative paths).');
  lines.push('- If blocked or need input, set `status` to `blocked` or `needs-input` and explain in `openQuestions`.');
  lines.push('- Otherwise set `status` to `completed`.');
  lines.push('- If upstream handoffs do not clearly require code changes, return a no-op handoff instead of exploring indefinitely.');
  lines.push('- If the next step is manual, environment-specific, or external, report it in `openQuestions`/`recommendations` without waiting for it to happen.');
  lines.push('- Do not run broad verification commands unless you actually changed owned files.');
  lines.push('');
  lines.push('Output ONLY the JSON object.');
  lines.push('');

  return lines.join('\n');
}

function resolveAgentForJob(job, spec) {
  const agentId = normalizeText(job?.launchSpec?.agentRefId);
  if (!agentId) return null;
  return spec.agents[agentId] || null;
}

function isUnsupportedCodexFlagError(text, flags = []) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return false;
  if (!/(unexpected argument|unknown option|unrecognized option|found argument|invalid option)/i.test(text)) {
    return false;
  }
  return flags.some((flag) => normalized.includes(String(flag).toLowerCase()));
}

function isCodexSchemaValidationError(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return false;
  return normalized.includes('invalid_json_schema')
    || normalized.includes('text.format.schema');
}

function isCodexUpstreamError(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return false;
  return normalized.includes('upstream_error')
    || normalized.includes('server_error');
}

function shouldRetryCodexResult(result, { exitCode, combinedText }) {
  if (!result || result.error || result.timedOut) {
    return false;
  }
  if (exitCode === 0) {
    return false;
  }
  return isCodexUpstreamError(combinedText);
}

function sleepMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Math.floor(ms)));
  });
}

async function runCodexExecWithRetry(command, args, { env, timeoutMs, cwd, input, io }) {
  const maxAttempts = parsePositiveInt(env?.[SUBAGENT_UPSTREAM_MAX_ATTEMPTS_ENV], 2);
  const baseBackoffMs = parsePositiveInt(env?.[SUBAGENT_UPSTREAM_BACKOFF_MS_ENV], 1200);
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await spawnCommandWithInput(command, args, {
      env,
      timeoutMs,
      cwd: cwd || undefined,
      input,
    });
    lastResult = result;

    const exitCode = Number.isFinite(result.status) ? result.status : 1;
    const combinedText = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    if (!shouldRetryCodexResult(result, { exitCode, combinedText }) || attempt >= maxAttempts) {
      return { ...result, attempts: attempt };
    }

    const delayMs = Math.max(1, Math.floor(baseBackoffMs * Math.pow(2, attempt - 1)));
    io?.log?.(`[subagent-runtime] codex upstream_error retry attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms`);
    await sleepMs(delayMs);
  }

  return {
    ...(lastResult || { status: 1, stdout: '', stderr: '', error: null, timedOut: false }),
    attempts: maxAttempts,
  };
}

function attachAttemptMeta(result, payload) {
  const attempts = Number.isFinite(result?.attempts) ? Math.max(1, Math.floor(result.attempts)) : 0;
  if (attempts > 0) {
    return { ...payload, attempts };
  }
  return payload;
}

async function runOneShot(clientId, { systemPrompt, userPrompt, timeoutMs, env, io = null, cwd = null, codexOutput = null }) {
  const command = CLIENT_COMMAND[clientId];
  if (!command) {
    return { exitCode: 1, stdout: '', stderr: '', error: `Unsupported subagent client: ${clientId}` };
  }

  if (!commandExists(command, { env })) {
    return { exitCode: 127, stdout: '', stderr: '', error: `Command not found: ${command}` };
  }

  const systemText = normalizeText(systemPrompt);
  const promptText = normalizeText(userPrompt);

  let args = [];
  if (clientId === 'claude-code') {
    args = systemText
      ? ['--print', '--append-system-prompt', systemText, promptText]
      : ['--print', promptText];
  } else if (clientId === 'gemini-cli') {
    const fullPrompt = systemText
      ? `${systemText}\n\n## New User Request\n${promptText}`
      : promptText;
    args = ['-p', fullPrompt];
  } else {
    const fullPrompt = systemText
      ? `${systemText}\n\n## New User Request\n${promptText}`
      : promptText;

    const structuredFlags = [];
    if (codexOutput?.schemaPath) {
      structuredFlags.push('--output-schema', codexOutput.schemaPath);
    }
    if (codexOutput?.lastMessagePath) {
      structuredFlags.push('--output-last-message', codexOutput.lastMessagePath);
    }
    if (codexOutput?.color) {
      structuredFlags.push('--color', codexOutput.color);
    }

    if (structuredFlags.length > 0) {
      args = ['exec', ...structuredFlags, '-'];
      const result = await runCodexExecWithRetry(command, args, { env, timeoutMs, cwd, input: fullPrompt, io });
      const combinedStdout = String(result.stdout || '');
      const combinedStderr = String(result.stderr || '');
      const exitCode = Number.isFinite(result.status) ? result.status : 1;

      if (result.error) {
        return attachAttemptMeta(result, {
          exitCode,
          stdout: combinedStdout,
          stderr: combinedStderr,
          error: result.error.message || String(result.error),
        });
      }

      if (result.timedOut) {
        return attachAttemptMeta(result, {
          exitCode: exitCode || 124,
          stdout: combinedStdout,
          stderr: combinedStderr,
          error: `Timed out after ${timeoutMs} ms`,
        });
      }

      if (exitCode !== 0) {
        const combined = `${combinedStdout}\n${combinedStderr}`.trim();
        const structuredFlags = ['--output-schema', '--output-last-message', '--color'];
        if (isUnsupportedCodexFlagError(combined, structuredFlags) || isCodexSchemaValidationError(combined)) {
          const fallbackArgs = ['exec'];
          if (codexOutput?.lastMessagePath) {
            fallbackArgs.push('--output-last-message', codexOutput.lastMessagePath);
          }
          if (codexOutput?.color) {
            fallbackArgs.push('--color', codexOutput.color);
          }
          fallbackArgs.push('-');

          const fallback = await runCodexExecWithRetry(command, fallbackArgs, { env, timeoutMs, cwd, input: fullPrompt, io });
          const fallbackStdout = String(fallback.stdout || '');
          const fallbackStderr = String(fallback.stderr || '');
          const fallbackExit = Number.isFinite(fallback.status) ? fallback.status : 1;
          if (fallback.error) {
            return attachAttemptMeta(fallback, {
              exitCode: fallbackExit,
              stdout: fallbackStdout,
              stderr: fallbackStderr,
              error: fallback.error.message || String(fallback.error),
            });
          }
          if (fallback.timedOut) {
            return attachAttemptMeta(fallback, {
              exitCode: fallbackExit || 124,
              stdout: fallbackStdout,
              stderr: fallbackStderr,
              error: `Timed out after ${timeoutMs} ms`,
            });
          }

          if (fallbackExit !== 0) {
            const fallbackCombined = `${fallbackStdout}\n${fallbackStderr}`.trim();
            const fallbackFlags = ['--output-last-message', '--color'];
            if (isUnsupportedCodexFlagError(fallbackCombined, fallbackFlags)) {
              const plainFallback = await runCodexExecWithRetry(command, ['exec', '-'], { env, timeoutMs, cwd, input: fullPrompt, io });
              const plainStdout = String(plainFallback.stdout || '');
              const plainStderr = String(plainFallback.stderr || '');
              const plainExit = Number.isFinite(plainFallback.status) ? plainFallback.status : 1;
              if (plainFallback.error) {
                return attachAttemptMeta(plainFallback, {
                  exitCode: plainExit,
                  stdout: plainStdout,
                  stderr: plainStderr,
                  error: plainFallback.error.message || String(plainFallback.error),
                });
              }
              if (plainFallback.timedOut) {
                return attachAttemptMeta(plainFallback, {
                  exitCode: plainExit || 124,
                  stdout: plainStdout,
                  stderr: plainStderr,
                  error: `Timed out after ${timeoutMs} ms`,
                });
              }
              return attachAttemptMeta(plainFallback, {
                exitCode: plainExit,
                stdout: plainStdout,
                stderr: plainStderr,
                error: '',
              });
            }
          }
          return attachAttemptMeta(fallback, {
            exitCode: fallbackExit,
            stdout: fallbackStdout,
            stderr: fallbackStderr,
            error: '',
          });
        }
      }

      return attachAttemptMeta(result, {
        exitCode,
        stdout: combinedStdout,
        stderr: combinedStderr,
        error: '',
      });
    }

    args = ['exec', '-'];
    const result = await runCodexExecWithRetry(command, args, { env, timeoutMs, cwd, input: fullPrompt, io });
    const combinedStdout = String(result.stdout || '');
    const combinedStderr = String(result.stderr || '');
    const exitCode = Number.isFinite(result.status) ? result.status : 1;

    if (result.error) {
      return attachAttemptMeta(result, {
        exitCode,
        stdout: combinedStdout,
        stderr: combinedStderr,
        error: result.error.message || String(result.error),
      });
    }
    if (result.timedOut) {
      return attachAttemptMeta(result, {
        exitCode: exitCode || 124,
        stdout: combinedStdout,
        stderr: combinedStderr,
        error: `Timed out after ${timeoutMs} ms`,
      });
    }

    return attachAttemptMeta(result, {
      exitCode,
      stdout: combinedStdout,
      stderr: combinedStderr,
      error: '',
    });
  }

  const result = await spawnCommand(command, args, { env, timeoutMs, cwd: cwd || undefined });
  const combinedStdout = String(result.stdout || '');
  const combinedStderr = String(result.stderr || '');
  const exitCode = Number.isFinite(result.status) ? result.status : 1;

  if (result.error) {
    return { exitCode, stdout: combinedStdout, stderr: combinedStderr, error: result.error.message || String(result.error) };
  }
  if (result.timedOut) {
    return { exitCode: exitCode || 124, stdout: combinedStdout, stderr: combinedStderr, error: `Timed out after ${timeoutMs} ms` };
  }

  return { exitCode, stdout: combinedStdout, stderr: combinedStderr, error: '' };
}

function buildBlockedJobRun(plan, job, dependencyRuns, {
  executorLabel,
  reason,
  elapsedMs = null,
  cost = null,
  rawOutput = '',
  attempts = 0,
}) {
  const jobRun = {
    jobId: job.jobId,
    jobType: job.jobType,
    role: job.role,
    executor: normalizeText(job?.launchSpec?.executor) || 'unknown',
    executorLabel,
    dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
    status: 'blocked',
    inputSummary: {
      dependencyCount: dependencyRuns.length,
      inputTypes: Array.isArray(job.launchSpec?.inputs) ? [...job.launchSpec.inputs] : [],
    },
    output: {
      outputType: job.launchSpec?.outputType || 'unknown',
      error: normalizeText(reason) || 'blocked',
      ...(normalizeText(rawOutput) ? { rawOutput: clipText(rawOutput) } : {}),
    },
  };
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
    jobRun.elapsedMs = Math.floor(elapsedMs);
  }
  if (hasCostTelemetry(cost)) {
    jobRun.cost = normalizeCostTelemetry(cost);
  }
  if (Number.isFinite(attempts) && attempts > 0) {
    jobRun.attempts = Math.max(0, Math.floor(attempts));
  }
  return jobRun;
}

function buildFailureReason({ baseReason, exitCode, rawCommandOutput }) {
  const normalizedBase = normalizeText(baseReason);
  const trimmedOutput = normalizeText(rawCommandOutput);
  if (!trimmedOutput) {
    return normalizedBase || `exit=${exitCode}`;
  }

  const firstLine = trimmedOutput
    .split(/\r?\n/u)
    .map((line) => normalizeText(line))
    .find((line) => line.length > 0) || '';

  if (!firstLine) {
    return normalizedBase || `exit=${exitCode}`;
  }

  if (normalizedBase.length > 0 && normalizedBase !== `exit=${exitCode}`) {
    return `${normalizedBase}; ${firstLine}`;
  }
  return `exit=${exitCode}; ${firstLine}`;
}

async function executePhaseJob(plan, job, phase, dependencyRuns, {
  clientId,
  contextText,
  timeoutMs,
  env,
  io,
  agentSpecNormalized,
  executorLabel,
  dispatchPolicy,
  rootDir,
  codexTempDir,
}) {
  const agent = resolveAgentForJob(job, agentSpecNormalized);
  const systemPrompt = buildSystemPrompt({ agent, contextText, plan, job, phase });
  const userPrompt = buildUserPrompt({ plan, job, phase, dependencyRuns });

  const codexOutput = clientId === 'codex-cli' && codexTempDir && rootDir
    ? {
      schemaPath: path.join(rootDir, CODEX_OUTPUT_SCHEMA_REL),
      lastMessagePath: path.join(codexTempDir, `${safeFileSlug(job?.jobId)}.json`),
      color: 'never',
    }
    : null;

  const startedAt = Date.now();
  const result = await runOneShot(clientId, {
    systemPrompt,
    userPrompt,
    timeoutMs,
    env,
    io,
    cwd: rootDir,
    codexOutput,
  });
  const elapsedMs = Date.now() - startedAt;

  const rawCommandOutput = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  let outputText = rawCommandOutput;
  if (codexOutput?.lastMessagePath) {
    try {
      const lastMessage = await fs.readFile(codexOutput.lastMessagePath, 'utf8');
      if (String(lastMessage || '').trim()) {
        outputText = String(lastMessage || '').trim();
      }
    } catch {
      // ignore missing last-message file and fall back to stdout/stderr extraction
    }
  }
  const rawJson = extractJsonCandidate(outputText);
  const costTelemetry = collectCostTelemetry({ rawText: rawCommandOutput, rawJson });
  const allowTimedOutHandoff = result.exitCode !== 0
    && /timed out/i.test(String(result.error || ''))
    && Boolean(rawJson);

  if (result.exitCode !== 0 && !allowTimedOutHandoff) {
    const attemptCount = Number.isFinite(result.attempts) ? Math.max(1, Math.floor(result.attempts)) : 1;
    const failureReason = buildFailureReason({
      baseReason: result.error || `exit=${result.exitCode}${attemptCount > 1 ? ` after ${attemptCount} attempts` : ''}`,
      exitCode: result.exitCode,
      rawCommandOutput,
    });
    io?.log?.(`[subagent-runtime] blocked ${job.jobId} reason=${failureReason}`);
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: failureReason,
      elapsedMs,
      cost: costTelemetry,
      rawOutput: clipText(rawCommandOutput),
      attempts: attemptCount,
    });
  }
  if (allowTimedOutHandoff) {
    io?.log?.(`[subagent-runtime] continuing ${job.jobId} with last-message payload after timeout`);
  }

  if (!rawJson) {
    io?.log?.(`[subagent-runtime] blocked ${job.jobId} reason=Failed to parse JSON handoff from subagent output`);
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: 'Failed to parse JSON handoff from subagent output',
      elapsedMs,
      cost: costTelemetry,
      rawOutput: clipText(rawCommandOutput),
      attempts: Number.isFinite(result.attempts) ? Math.max(1, Math.floor(result.attempts)) : 0,
    });
  }

  const normalizedPayload = normalizeHandoffPayload(rawJson);
  normalizedPayload.fromRole = normalizeText(job.role) || normalizedPayload.fromRole;
  normalizedPayload.toRole = normalizeText(job.launchSpec?.handoffTarget) || normalizedPayload.toRole;
  normalizedPayload.taskTitle = normalizeText(plan.taskTitle) || normalizedPayload.taskTitle;
  if (!normalizedPayload.contextSummary) {
    normalizedPayload.contextSummary = normalizeText(plan.contextSummary) || normalizeText(phase?.responsibility) || 'context missing';
  }

  const validation = validateHandoffPayload(normalizedPayload);
  if (!validation.ok) {
    io?.log?.(`[subagent-runtime] blocked ${job.jobId} reason=Invalid handoff payload`);
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: `Invalid handoff payload: ${validation.errors.join('; ')}`,
      elapsedMs,
      cost: costTelemetry,
      rawOutput: clipText(outputText),
      attempts: Number.isFinite(result.attempts) ? Math.max(1, Math.floor(result.attempts)) : 0,
    });
  }

  const filePolicy = evaluatePhaseFilePolicy(validation.value, phase, job);
  if (!filePolicy.ok) {
    const reason = summarizeFilePolicyViolation(filePolicy.violations);
    io?.log?.(`[subagent-runtime] blocked ${job.jobId} reason=${reason}`);
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason,
      elapsedMs,
      cost: costTelemetry,
      rawOutput: clipText(outputText),
      attempts: Number.isFinite(result.attempts) ? Math.max(1, Math.floor(result.attempts)) : 0,
    });
  }

  const payloadStatus = validation.value.status;
  const jobStatus = payloadStatus === 'blocked' || payloadStatus === 'needs-input'
    ? 'blocked'
    : 'completed';

  const costNote = hasCostTelemetry(costTelemetry)
    ? ` tokens=${costTelemetry.totalTokens} usd=${costTelemetry.usd}`
    : '';
  io?.log?.(`[subagent-runtime] completed ${job.jobId} status=${payloadStatus} elapsedMs=${elapsedMs}${costNote}`);

  return {
    jobId: job.jobId,
    jobType: job.jobType,
    role: job.role,
    executor: normalizeText(job?.launchSpec?.executor) || 'unknown',
    executorLabel,
    dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
    status: jobStatus,
    elapsedMs,
    ...(hasCostTelemetry(costTelemetry) ? { cost: costTelemetry } : {}),
    ...(Number.isFinite(result.attempts) && result.attempts > 0 ? { attempts: Math.floor(result.attempts) } : {}),
    inputSummary: {
      dependencyCount: dependencyRuns.length,
      inputTypes: Array.isArray(job.launchSpec?.inputs) ? [...job.launchSpec.inputs] : [],
    },
    output: {
      outputType: job.launchSpec?.outputType || 'handoff',
      payload: validation.value,
      rawOutput: outputText.slice(0, 8000),
    },
  };
}

function executeMergeGateJob(plan, job, dependencyRuns, { executorLabel }) {
  const payloads = dependencyRuns.map((run) => run?.output?.payload).filter(Boolean);
  if (payloads.length !== dependencyRuns.length) {
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: 'Missing upstream handoff payloads; merge-gate cannot run',
    });
  }

  let mergeResult;
  try {
    mergeResult = mergeParallelHandoffs(payloads);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildBlockedJobRun(plan, job, dependencyRuns, { executorLabel, reason: message });
  }

  const payload = normalizeHandoffPayload({
    status: mergeResult.ok ? 'completed' : 'blocked',
    fromRole: 'merge-gate',
    toRole: 'complete',
    taskTitle: plan.taskTitle,
    contextSummary: mergeResult.ok
      ? `Merge gate passed for ${job.group}.`
      : `Merge gate blocked for ${job.group}.`,
    findings: mergeResult.mergedFindings,
    filesTouched: mergeResult.touchedFiles,
    recommendations: mergeResult.mergedRecommendations,
  });

  return {
    jobId: job.jobId,
    jobType: job.jobType,
    role: job.role,
    executor: normalizeText(job?.launchSpec?.executor) || 'unknown',
    executorLabel,
    dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
    status: mergeResult.ok ? 'completed' : 'blocked',
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
}

export async function executeSubagentDispatchPlan(
  plan,
  dispatchPlan,
  { dispatchPolicy = null, io = console, env = process.env, rootDir: runtimeRootDir = null } = {}
) {
  const normalizedClient = normalizeText(env?.[SUBAGENT_CLIENT_ENV]).toLowerCase();
  const clientId = normalizedClient || '';
  if (!SUPPORTED_CLIENTS.has(clientId)) {
    const codexOnlyHint = `This repository runs subagent live execution in codex-only mode (set ${SUBAGENT_CLIENT_ENV}=codex-cli).`;
    return {
      mode: 'live',
      ok: false,
      error: clientId
        ? `Unsupported ${SUBAGENT_CLIENT_ENV}: ${clientId}. ${codexOnlyHint}`
        : `Missing ${SUBAGENT_CLIENT_ENV}. ${codexOnlyHint}`,
      executorRegistry: Array.isArray(dispatchPlan?.executorRegistry) ? [...dispatchPlan.executorRegistry] : [],
      executorDetails: Array.isArray(dispatchPlan?.executorDetails) ? dispatchPlan.executorDetails.map((item) => ({ ...item })) : [],
      jobRuns: [],
      finalOutputs: [],
    };
  }

  const rootDir = normalizeText(runtimeRootDir) ? path.resolve(String(runtimeRootDir)) : resolveRepoRoot();
  const sessionId = detectSessionIdFromPlan(plan);
  const contextPacket = await loadContextPacket({ rootDir, sessionId, env, io });
  const contextText = contextPacket.ok ? contextPacket.contextText : '';

  const concurrency = parsePositiveInt(env?.[SUBAGENT_CONCURRENCY_ENV], 2);
  const timeoutMs = parsePositiveInt(env?.[SUBAGENT_TIMEOUT_MS_ENV], 10 * 60 * 1000);

  const jobs = Array.isArray(dispatchPlan?.jobs) ? dispatchPlan.jobs : [];
  const executorDetails = Array.isArray(dispatchPlan?.executorDetails)
    ? dispatchPlan.executorDetails.map((item) => ({ ...item }))
    : [];
  const executorRegistry = Array.isArray(dispatchPlan?.executorRegistry)
    ? [...dispatchPlan.executorRegistry]
    : executorDetails.map((item) => item.id);
  const executorLabels = new Map(executorDetails.map((item) => [String(item?.id || '').trim(), String(item?.label || '').trim()]).filter(([id]) => id));

  const agentSpecNormalized = normalizeOrchestratorAgentSpec(agentSpec);

  const codexTempDir = clientId === 'codex-cli'
    ? await fs.mkdtemp(path.join(os.tmpdir(), 'aios-codex-last-message-'))
    : null;

  const pending = new Map(jobs.map((job) => [job.jobId, job]));
  const running = new Map();
  const jobRunMap = new Map();

  const startJob = async (job) => {
    const dependencyRuns = Array.isArray(job.dependsOn)
      ? job.dependsOn.map((jobId) => jobRunMap.get(jobId)).filter(Boolean)
      : [];
    const executorId = normalizeText(job?.launchSpec?.executor) || 'unknown';
    const executorLabel = executorLabels.get(executorId) || executorId;

    if (dependencyRuns.some((run) => run.status === 'blocked')) {
      return buildBlockedJobRun(plan, job, dependencyRuns, { executorLabel, reason: 'Blocked by dependency' });
    }

    if (job.jobType === 'phase') {
      const phases = Array.isArray(plan?.phases) ? plan.phases : [];
      const phase = phases.find((item) => normalizeText(item?.id) === normalizeText(job.phaseId)) || null;
      if (!phase) {
        return buildBlockedJobRun(plan, job, dependencyRuns, { executorLabel, reason: `Unknown orchestration phase for job: ${job.jobId}` });
      }
      return await executePhaseJob(plan, job, phase, dependencyRuns, {
        clientId,
        contextText,
        timeoutMs,
        env,
        io,
        agentSpecNormalized,
        executorLabel,
        dispatchPolicy,
        rootDir,
        codexTempDir,
      });
    }

    if (job.jobType === 'merge-gate') {
      return executeMergeGateJob(plan, job, dependencyRuns, { executorLabel, dispatchPolicy });
    }

    return buildBlockedJobRun(plan, job, dependencyRuns, { executorLabel, reason: `Unsupported job type: ${job.jobType}` });
  };

  while (pending.size > 0 || running.size > 0) {
    let started = false;

    for (const [jobId, job] of pending) {
      if (running.size >= concurrency) {
        break;
      }

      const deps = Array.isArray(job.dependsOn) ? job.dependsOn : [];
      if (!deps.every((depId) => jobRunMap.has(depId))) {
        continue;
      }

      pending.delete(jobId);
      started = true;

      const promise = startJob(job).then((jobRun) => {
        jobRunMap.set(jobId, jobRun);
        running.delete(jobId);
        return jobRun;
      });
      running.set(jobId, promise);
    }

    if (running.size > 0) {
      await Promise.race(running.values());
      continue;
    }

    if (!started && pending.size > 0) {
      // Cycle or missing dependencies; mark remaining jobs blocked.
      break;
    }
  }

  for (const job of jobs) {
    if (jobRunMap.has(job.jobId)) {
      continue;
    }
    const deps = Array.isArray(job.dependsOn) ? job.dependsOn : [];
    const dependencyRuns = deps.map((jobId) => jobRunMap.get(jobId)).filter(Boolean);
    const executorId = normalizeText(job?.launchSpec?.executor) || 'unknown';
    const executorLabel = executorLabels.get(executorId) || executorId;
    jobRunMap.set(job.jobId, buildBlockedJobRun(plan, job, dependencyRuns, { executorLabel, reason: 'Unresolved job dependency cycle' }));
  }

  const jobRuns = jobs.map((job) => jobRunMap.get(job.jobId)).filter(Boolean);
  const totalCost = jobRuns.reduce(
    (acc, jobRun) => mergeCostTelemetry(acc, jobRun?.cost || null),
    normalizeCostTelemetry()
  );

  if (codexTempDir) {
    try {
      await fs.rm(codexTempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  return {
    mode: 'live',
    ok: jobRuns.every((jobRun) => jobRun.status !== 'blocked'),
    executorRegistry,
    executorDetails,
    jobRuns,
    ...(hasCostTelemetry(totalCost) ? { cost: totalCost } : {}),
    finalOutputs: jobRuns
      .filter((jobRun) => jobRun.output?.outputType === 'merged-handoff' || jobRun.jobType === 'phase')
      .map((jobRun) => ({ jobId: jobRun.jobId, outputType: jobRun.output?.outputType || 'unknown' })),
  };
}
