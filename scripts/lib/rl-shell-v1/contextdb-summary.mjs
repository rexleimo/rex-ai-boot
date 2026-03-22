import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runContextDbCli } from '../contextdb-cli.mjs';
import { validateRunSummary } from './schema.mjs';

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function defaultWriter({ rootDir, summary, sessionId, artifactPath }) {
  if (!sessionId) {
    return { persisted: false, skipped: true, artifactPath };
  }
  return runContextDbCli([
    'checkpoint',
    '--workspace',
    rootDir,
    '--session',
    sessionId,
    '--summary',
    `RL shell v1 run ${summary.run_id}`,
    '--status',
    summary.status === 'ok' ? 'done' : 'blocked',
    '--artifacts',
    artifactPath,
    '--next',
    `Inspect ${artifactPath}`,
    '--verify-result',
    summary.status === 'ok' ? 'passed' : 'failed',
    '--verify-evidence',
    `best_checkpoint=${summary.best_checkpoint_path}; primary_teacher=${summary.primary_teacher}`,
    '--retry-count',
    '0',
    '--elapsed-ms',
    '0',
    '--cost-total-tokens',
    '0',
    '--cost-usd',
    '0',
  ], { cwd: rootDir });
}

export function buildRunSummaryPayload({ run, metrics, config }) {
  return validateRunSummary({
    run_id: run.runId,
    spec_path: 'docs/superpowers/specs/2026-03-22-aios-shell-rl-v1-design.md',
    student_model_id: run.studentModelId || 'tiny-json-policy-v1',
    primary_teacher: config.teacher_backend_requested,
    fallback_order: config.fallback_order || [],
    train_split: 'benchmark-v1-train',
    held_out_split: 'benchmark-v1-held-out',
    best_checkpoint_path: run.bestCheckpointPath,
    best_metrics: metrics,
    seed_results: config.seed_results || [],
    status: run.status || 'ok',
  });
}

export async function writeRunSummary({ rootDir, summary, sessionId = '', writer = defaultWriter }) {
  const normalized = validateRunSummary(summary);
  const artifactPath = path.join(rootDir, 'experiments', 'rl-shell-v1', 'runs', normalized.run_id, 'run-summary.json');
  await writeJson(artifactPath, normalized);

  try {
    const result = await writer({
      rootDir,
      summary: normalized,
      sessionId,
      artifactPath,
    });
    return {
      ok: true,
      summaryPath: artifactPath,
      writerResult: result || null,
    };
  } catch (error) {
    console.warn(`[rl-shell-v1] ContextDB summary write failed: ${error.message}`);
    return {
      ok: false,
      summaryPath: artifactPath,
      error: error.message,
    };
  }
}
