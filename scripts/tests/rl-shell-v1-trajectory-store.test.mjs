import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function makeEpisodeRecordWithTruncatedStreams() {
  return {
    episode_id: 'episode-001',
    run_id: 'run-001',
    task_id: 'task-001',
    split: 'train',
    repo_snapshot_id: 'task-001@v1',
    student_model_id: 'tiny-json-policy-v1',
    teacher_backend_requested: 'codex-cli',
    teacher_backend_used: 'codex-cli',
    seed: 17,
    start_ts: '2026-03-22T03:00:00.000Z',
    end_ts: '2026-03-22T03:00:05.000Z',
    status: 'failed',
    task_prompt: 'Fix the bug',
    constraints: ['Do not edit tests'],
    baseline_failing_tests: ['tests/math.test.mjs::addition'],
    baseline_reproduced: true,
    student_steps: [
      {
        step_index: 1,
        prompt_excerpt: 'Fix the bug',
        raw_output_text: '{"action":"run","command":"node --test"}',
        token_ids: [1, 2, 3],
        token_logprobs: [-0.1, -0.2, -0.3],
        parsed_action: { action: 'run', command: 'node --test' },
        observation_event: {
          schema_version: 1,
          step_index: 1,
          action: { action: 'run', command: 'node --test' },
          status: 'error',
          error_code: 'command_failed',
          error_message: null,
          payload: {
            exit_code: 1,
            stdout_excerpt: 'stdout\n[TRUNCATED]\n',
            stderr_excerpt: 'stderr\n[TRUNCATED]\n',
            stdout_truncated: true,
            stderr_truncated: true,
            files_touched: ['src/math.mjs'],
          },
        },
      },
    ],
    commands_executed: ['node --test'],
    files_read: ['src/math.mjs'],
    files_touched: ['src/math.mjs'],
    patch_apply_results: [{ applied: false, reject_reason: 'none' }],
    stdout_summary: 'stdout\n[TRUNCATED]\n',
    stderr_summary: 'stderr\n[TRUNCATED]\n',
    final_diff: '*** Begin Patch\n*** End Patch\n',
    tests_before: ['tests/math.test.mjs::addition'],
    tests_after: ['tests/math.test.mjs::addition'],
    runtime_failures: [],
    timeout_flag: false,
    stop_reason: 'budget_exhausted',
    teacher_call_status: 'ok',
    teacher_latency_ms: 123,
    teacher_confidence: 0.7,
    teacher_critique: 'Read the function before editing it.',
    teacher_reference_solution: [
      { action: 'read', path: 'src/math.mjs' },
      { action: 'run', command: 'node --test' },
      { action: 'stop', message: 'done' },
    ],
    teacher_shaping_score: 0.4,
    distillation_status: 'applied',
    distillation_skip_reason: null,
    terminal_reward: 0,
    teacher_term: 0.08,
    fused_reward: 0.08,
    advantage: 0.08,
    return: 0.08,
    policy_loss: 0.1,
    distill_loss: 0.2,
    kl_loss: 0.01,
    stdout_artifact_path: 'artifacts/stdout.log',
    stderr_artifact_path: 'artifacts/stderr.log',
    final_diff_artifact_path: 'artifacts/final.patch',
    observation_trace_artifact_path: 'artifacts/trace.json',
  };
}

async function makeRunRoot() {
  return await mkdtemp(path.join(os.tmpdir(), 'aios-rl-shell-v1-store-'));
}

test('trajectory store writes one episode json plus full artifact files for truncated outputs', async () => {
  const mod = await import('../lib/rl-shell-v1/trajectory-store.mjs');
  const rootDir = await makeRunRoot();
  const runDir = await mod.createRunLayout({ rootDir, runId: 'run-001' });
  const record = await mod.persistEpisode({
    runDir,
    episode: makeEpisodeRecordWithTruncatedStreams(),
  });

  assert.equal(record.episodePath.endsWith('.json'), true);
  assert.equal(record.stdoutArtifactPath.endsWith('.log'), true);
  assert.equal(record.stderrArtifactPath.endsWith('.log'), true);
  assert.equal(record.finalDiffArtifactPath.endsWith('.patch'), true);
  assert.equal(record.observationTraceArtifactPath.endsWith('.json'), true);
  assert.match(await readFile(record.observationTraceArtifactPath, 'utf8'), /command_failed|step_index/);
});

test('trajectory store appends metrics and keeps latest/best checkpoint metadata separate', async () => {
  const mod = await import('../lib/rl-shell-v1/trajectory-store.mjs');
  const rootDir = await makeRunRoot();
  const runDir = await mod.createRunLayout({ rootDir, runId: 'run-002' });

  await mod.appendMetrics({
    runDir,
    metric: { step: 1, fused_reward: 0.2 },
  });
  await mod.writeCheckpointMetadata({
    runDir,
    kind: 'latest',
    metadata: { checkpoint: 'ckpt-1', step: 1 },
  });
  await mod.writeCheckpointMetadata({
    runDir,
    kind: 'best',
    metadata: { checkpoint: 'ckpt-best', success_rate: 0.5 },
  });

  const metrics = await readFile(path.join(runDir.runPath, 'metrics.jsonl'), 'utf8');
  const latest = await readFile(path.join(runDir.checkpointsDir, 'latest', 'metadata.json'), 'utf8');
  const best = await readFile(path.join(runDir.checkpointsDir, 'best', 'metadata.json'), 'utf8');

  assert.match(metrics, /fused_reward/);
  assert.match(latest, /ckpt-1/);
  assert.match(best, /ckpt-best/);
});
