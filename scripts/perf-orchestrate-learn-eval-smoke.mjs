#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv = []) {
  const options = {
    orchestrateMaxMs: parseNumber(process.env.AIOS_PERF_ORCHESTRATE_MAX_MS, 30000),
    learnEvalMaxMs: parseNumber(process.env.AIOS_PERF_LEARN_EVAL_MAX_MS, 20000),
    jsonOut: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--orchestrate-max-ms') {
      options.orchestrateMaxMs = parseNumber(argv[i + 1], options.orchestrateMaxMs);
      i += 1;
      continue;
    }
    if (token === '--learn-eval-max-ms') {
      options.learnEvalMaxMs = parseNumber(argv[i + 1], options.learnEvalMaxMs);
      i += 1;
      continue;
    }
    if (token === '--json-out') {
      options.jsonOut = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
  }

  return options;
}

function runCommand(command, args, { cwd }) {
  const startedAt = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
  return {
    elapsedMs,
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error ? String(result.error.message || result.error) : '',
  };
}

function requireOk(label, result) {
  if (result.status === 0) return;
  const snippet = [result.error, result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')
    .trim()
    .slice(0, 4000);
  throw new Error(`${label} failed (exit=${result.status}):\n${snippet}`);
}

function parseJsonOutput(label, stdout) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch (error) {
    throw new Error(`${label} returned non-JSON output: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createSessionId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.random().toString(16).slice(2, 8);
  return `perf-smoke-${stamp}-${rand}`;
}

function writeJsonReport(filePath, value) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const mcpDir = path.join(repoRoot, 'mcp-server');
  const sessionId = createSessionId();
  const failures = [];

  const initRun = runCommand('npm', ['run', 'contextdb', '--', 'init', '--workspace', repoRoot], { cwd: mcpDir });
  requireOk('contextdb init', initRun);

  const sessionRun = runCommand('npm', [
    'run',
    'contextdb',
    '--',
    'session:new',
    '--workspace',
    repoRoot,
    '--session-id',
    sessionId,
    '--agent',
    'perf-smoke',
    '--project',
    'perf-smoke',
    '--goal',
    'orchestrate-learn-eval-smoke',
  ], { cwd: mcpDir });
  requireOk('contextdb session:new', sessionRun);

  for (let i = 1; i <= 5; i += 1) {
    const checkpointRun = runCommand('npm', [
      'run',
      'contextdb',
      '--',
      'checkpoint',
      '--workspace',
      repoRoot,
      '--session',
      sessionId,
      '--summary',
      `perf smoke checkpoint ${i}`,
      '--status',
      'running',
      '--verify-result',
      'passed',
      '--elapsed-ms',
      String(900 + i * 20),
    ], { cwd: mcpDir });
    requireOk(`contextdb checkpoint #${i}`, checkpointRun);
  }

  const orchestrateRun = runCommand('node', [
    'scripts/aios.mjs',
    'orchestrate',
    'feature',
    '--task',
    'performance smoke',
    '--dispatch',
    'local',
    '--execute',
    'dry-run',
    '--format',
    'json',
  ], { cwd: repoRoot });
  requireOk('aios orchestrate dry-run', orchestrateRun);
  const orchestratePayload = parseJsonOutput('aios orchestrate dry-run', orchestrateRun.stdout);

  const learnEvalRun = runCommand('node', [
    'scripts/aios.mjs',
    'learn-eval',
    '--session',
    sessionId,
    '--limit',
    '5',
    '--format',
    'json',
  ], { cwd: repoRoot });
  requireOk('aios learn-eval', learnEvalRun);
  const learnEvalPayload = parseJsonOutput('aios learn-eval', learnEvalRun.stdout);

  if (orchestrateRun.elapsedMs > options.orchestrateMaxMs) {
    failures.push(`orchestrate dry-run exceeded threshold: ${orchestrateRun.elapsedMs}ms > ${options.orchestrateMaxMs}ms`);
  }
  if (learnEvalRun.elapsedMs > options.learnEvalMaxMs) {
    failures.push(`learn-eval exceeded threshold: ${learnEvalRun.elapsedMs}ms > ${options.learnEvalMaxMs}ms`);
  }
  if (orchestratePayload?.dispatchRun?.ok !== true) {
    failures.push('orchestrate dry-run did not produce dispatchRun.ok=true');
  }
  if (learnEvalPayload?.session?.sessionId !== sessionId) {
    failures.push(`learn-eval session mismatch: expected ${sessionId}`);
  }

  const report = {
    ok: failures.length === 0,
    benchmark: 'aios-orchestrate-learn-eval-smoke',
    generatedAt: new Date().toISOString(),
    thresholds: {
      orchestrateMaxMs: options.orchestrateMaxMs,
      learnEvalMaxMs: options.learnEvalMaxMs,
    },
    measured: {
      orchestrateMs: orchestrateRun.elapsedMs,
      learnEvalMs: learnEvalRun.elapsedMs,
    },
    sessionId,
    samples: {
      orchestrate: {
        dispatchOk: orchestratePayload?.dispatchRun?.ok === true,
        jobs: Array.isArray(orchestratePayload?.dispatchRun?.jobRuns) ? orchestratePayload.dispatchRun.jobRuns.length : 0,
      },
      learnEval: {
        analyzedCheckpoints: learnEvalPayload?.sample?.analyzedCheckpoints ?? null,
        recommendationCount: Array.isArray(learnEvalPayload?.recommendations?.all) ? learnEvalPayload.recommendations.all.length : 0,
      },
    },
    failures,
  };

  if (options.jsonOut) {
    writeJsonReport(options.jsonOut, report);
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
