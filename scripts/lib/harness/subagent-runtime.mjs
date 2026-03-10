import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import agentSpec from '../../../memory/specs/orchestrator-agents.json' with { type: 'json' };
import { runContextDbCli } from '../contextdb-cli.mjs';
import { spawnCommand, commandExists } from '../platform/process.mjs';
import { normalizeHandoffPayload, validateHandoffPayload } from './handoff.mjs';
import { normalizeOrchestratorAgentSpec } from './orchestrator-agents.mjs';
import { mergeParallelHandoffs } from './orchestrator.mjs';

export const SUBAGENT_CLIENT_ENV = 'AIOS_SUBAGENT_CLIENT';
export const SUBAGENT_CONCURRENCY_ENV = 'AIOS_SUBAGENT_CONCURRENCY';
export const SUBAGENT_TIMEOUT_MS_ENV = 'AIOS_SUBAGENT_TIMEOUT_MS';
export const SUBAGENT_CONTEXT_LIMIT_ENV = 'AIOS_SUBAGENT_CONTEXT_LIMIT';
export const SUBAGENT_CONTEXT_TOKEN_BUDGET_ENV = 'AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET';

const SUPPORTED_CLIENTS = new Set(['codex-cli', 'claude-code', 'gemini-cli']);
const CLIENT_COMMAND = {
  'codex-cli': 'codex',
  'claude-code': 'claude',
  'gemini-cli': 'gemini',
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function resolveRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', '..');
}

function parsePositiveInt(raw, fallback) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseNonNegativeInt(raw, fallback) {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
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
  lines.push('Required fields: fromRole, toRole, taskTitle, contextSummary.');
  lines.push(`Set fromRole=${normalizeText(job?.role) || 'unknown'} and toRole=${normalizeText(job?.launchSpec?.handoffTarget) || 'next-phase'}.`);
  lines.push('');

  if (contextText) {
    lines.push('Context Packet');
    lines.push(contextText.trim());
    lines.push('');
  }

  const ownedPrefixes = Array.isArray(phase?.ownedPathPrefixes) ? phase.ownedPathPrefixes.join(', ') : '';
  lines.push('Runtime Notes');
  lines.push(`- jobId=${normalizeText(job?.jobId)}`);
  lines.push(`- taskTitle=${normalizeText(plan?.taskTitle)}`);
  if (normalizeText(plan?.contextSummary)) {
    lines.push(`- contextSummary=${normalizeText(plan?.contextSummary)}`);
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
    lines.push(`ownedPathPrefixes: ${Array.isArray(phase.ownedPathPrefixes) ? JSON.stringify(phase.ownedPathPrefixes) : '[]'}`);
    lines.push('');
  }

  lines.push('## Upstream Handoffs');
  lines.push(renderDependencyContext(dependencyRuns));
  lines.push('');

  lines.push('## Deliverable');
  lines.push('- Summarize concrete findings.');
  lines.push('- If you touched files, list them in `filesTouched` (relative paths).');
  lines.push('- If blocked or need input, set `status` to `blocked` or `needs-input` and explain in `openQuestions`.');
  lines.push('- Otherwise set `status` to `completed`.');
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

async function runOneShot(clientId, { systemPrompt, userPrompt, timeoutMs, env }) {
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
    args = ['exec', fullPrompt];
  }

  const result = await spawnCommand(command, args, { env, timeoutMs });
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

function buildBlockedJobRun(plan, job, dependencyRuns, { executorLabel, reason }) {
  return {
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
    },
  };
}

async function executePhaseJob(plan, job, phase, dependencyRuns, { clientId, contextText, timeoutMs, env, io, agentSpecNormalized, executorLabel }) {
  const agent = resolveAgentForJob(job, agentSpecNormalized);
  const systemPrompt = buildSystemPrompt({ agent, contextText, plan, job, phase });
  const userPrompt = buildUserPrompt({ plan, job, phase, dependencyRuns });

  const startedAt = Date.now();
  const result = await runOneShot(clientId, { systemPrompt, userPrompt, timeoutMs, env });
  const elapsedMs = Date.now() - startedAt;

  const outputText = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const rawJson = extractJsonCandidate(outputText);

  if (result.exitCode !== 0) {
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: result.error || `exit=${result.exitCode}`,
    });
  }

  if (!rawJson) {
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: 'Failed to parse JSON handoff from subagent output',
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
    return buildBlockedJobRun(plan, job, dependencyRuns, {
      executorLabel,
      reason: `Invalid handoff payload: ${validation.errors.join('; ')}`,
    });
  }

  const payloadStatus = validation.value.status;
  const jobStatus = payloadStatus === 'blocked' || payloadStatus === 'needs-input'
    ? 'blocked'
    : 'completed';

  io?.log?.(`[subagent-runtime] completed ${job.jobId} status=${payloadStatus} elapsedMs=${elapsedMs}`);

  return {
    jobId: job.jobId,
    jobType: job.jobType,
    role: job.role,
    executor: normalizeText(job?.launchSpec?.executor) || 'unknown',
    executorLabel,
    dependsOn: Array.isArray(job.dependsOn) ? [...job.dependsOn] : [],
    status: jobStatus,
    elapsedMs,
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

export async function executeSubagentDispatchPlan(plan, dispatchPlan, { dispatchPolicy = null, io = console, env = process.env } = {}) {
  const normalizedClient = normalizeText(env?.[SUBAGENT_CLIENT_ENV]).toLowerCase();
  const clientId = normalizedClient || '';
  if (!SUPPORTED_CLIENTS.has(clientId)) {
    return {
      mode: 'live',
      ok: false,
      error: clientId
        ? `Unsupported ${SUBAGENT_CLIENT_ENV}: ${clientId}`
        : `Missing ${SUBAGENT_CLIENT_ENV}. Set it to one of: codex-cli, claude-code, gemini-cli`,
      executorRegistry: Array.isArray(dispatchPlan?.executorRegistry) ? [...dispatchPlan.executorRegistry] : [],
      executorDetails: Array.isArray(dispatchPlan?.executorDetails) ? dispatchPlan.executorDetails.map((item) => ({ ...item })) : [],
      jobRuns: [],
      finalOutputs: [],
    };
  }

  const rootDir = resolveRepoRoot();
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

