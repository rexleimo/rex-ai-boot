import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateTaskManifest,
  validateObservationEvent,
  validateTeacherResponse,
  validateEpisodeRecord,
  validateRunSummary,
} from '../lib/rl-shell-v1/schema.mjs';

function makeValidEpisodeRecord() {
  return {
    episode_id: 'episode-001',
    run_id: 'run-001',
    task_id: 'task-001',
    task_source: 'synthetic',
    split: 'train',
    repo_snapshot_id: 'task-001@v1',
    student_model_id: 'tiny-json-policy-v1',
    teacher_backend_requested: 'codex-cli',
    teacher_backend_used: 'codex-cli',
    attempt_id: null,
    update_epoch_id: 'epoch-001',
    batch_id: 'batch-001',
    pre_update_ref_checkpoint_id: null,
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
        raw_output_text: '{"action":"read","path":"src/math.mjs"}',
        token_ids: [1, 2, 3],
        token_logprobs: [-0.1, -0.2, -0.3],
        parsed_action: { action: 'read', path: 'src/math.mjs' },
        observation_event: {
          schema_version: 1,
          step_index: 1,
          action: { action: 'read', path: 'src/math.mjs' },
          status: 'ok',
          error_code: null,
          error_message: null,
          payload: {
            path: 'src/math.mjs',
            content_excerpt: 'export function add(a, b) { return a - b; }',
            content_truncated: false,
            bytes_read: 42,
          },
        },
      },
    ],
    commands_executed: ['node --test'],
    files_read: ['src/math.mjs'],
    files_touched: ['src/math.mjs'],
    patch_apply_results: [{ applied: false, reject_reason: 'none' }],
    verification_executed: true,
    verification_passed: false,
    stdout_summary: '',
    stderr_summary: '1 failing test',
    final_diff: '',
    tests_before: ['tests/math.test.mjs::addition'],
    tests_after: ['tests/math.test.mjs::addition'],
    runtime_failures: [],
    timeout_flag: false,
    stop_reason: 'budget_exhausted',
    stop_condition: 'max_steps_reached',
    no_progress_window: 3,
    teacher_call_status: 'ok',
    teacher_latency_ms: 123,
    teacher_confidence: 0.7,
    teacher_critique: 'Read the function before editing it.',
    teacher_reference_solution: [
      { action: 'read', path: 'src/math.mjs' },
      { action: 'patch', diff: '--- a/src/math.mjs\n+++ b/src/math.mjs\n@@\n-return a - b;\n+return a + b;\n' },
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
    comparison_status: 'completed',
    relative_outcome: 'worse',
    rollback_batch: false,
    admission_status: 'admitted',
    admission_reason: null,
    replay_eligible: true,
    replay_priority: 0.6,
    replay_route: 'negative',
    policy_loss: 0.1,
    distill_loss: 0.2,
    kl_loss: 0.01,
    stdout_artifact_path: 'artifacts/stdout.log',
    stderr_artifact_path: 'artifacts/stderr.log',
    final_diff_artifact_path: 'artifacts/final.patch',
    observation_trace_artifact_path: 'artifacts/trace.json',
  };
}

test('validateTaskManifest accepts v1 task manifests and rejects missing verification_command', () => {
  const valid = {
    schema_version: 1,
    task_id: 'bugfix-001',
    repo_snapshot_id: 'bugfix-001@v1',
    repo_source_path: 'experiments/rl-shell-v1/tasks/bugfix-001',
    split: 'train',
    task_prompt: 'Fix the bug',
    verification_command: 'npm test -- --runInBand',
    baseline_failing_tests: ['tests/math.test.mjs::addition'],
    constraints: ['Do not edit tests'],
  };

  assert.doesNotThrow(() => validateTaskManifest(valid));
  assert.throws(() => validateTaskManifest({ ...valid, verification_command: '' }), /verification_command/i);
});

test('validateObservationEvent enforces payload-by-action contracts', () => {
  const event = {
    schema_version: 1,
    step_index: 1,
    action: { action: 'run', command: 'npm test -- --runInBand' },
    status: 'ok',
    error_code: null,
    error_message: null,
    payload: {
      exit_code: 1,
      stdout_excerpt: '',
      stderr_excerpt: '1 failing test',
      stdout_truncated: false,
      stderr_truncated: false,
      files_touched: ['src/math.mjs'],
    },
  };

  assert.doesNotThrow(() => validateObservationEvent(event));
  assert.throws(() => validateObservationEvent({ ...event, status: 'bad' }), /status/i);
});

test('validateTeacherResponse enforces failure defaults and call_status enum', () => {
  const failed = {
    backend_used: 'codex-cli',
    call_status: 'failed_all_backends',
    latency_ms: 0,
    critique: null,
    reference_solution: null,
    shaping_score: 0,
    confidence: 0,
  };

  assert.doesNotThrow(() => validateTeacherResponse(failed));
  assert.throws(() => validateTeacherResponse({ ...failed, call_status: 'bad' }), /call_status/i);
});

test('validateEpisodeRecord requires reward, distillation, and artifact fields', () => {
  const episode = makeValidEpisodeRecord();
  assert.doesNotThrow(() => validateEpisodeRecord(episode));
  assert.throws(() => validateEpisodeRecord({ ...episode, update_epoch_id: undefined }), /update_epoch_id/i);
  assert.throws(() => validateEpisodeRecord({ ...episode, verification_executed: undefined }), /verification_executed/i);
  assert.throws(() => validateEpisodeRecord({ ...episode, comparison_status: undefined }), /comparison_status/i);
  assert.throws(() => validateEpisodeRecord({ ...episode, replay_route: undefined }), /replay_route/i);
  assert.throws(() => validateEpisodeRecord({ ...episode, fused_reward: undefined }), /fused_reward/i);
  assert.throws(() => validateEpisodeRecord({ ...episode, task_source: undefined }), /task_source/i);
  assert.doesNotThrow(() => validateEpisodeRecord({
    ...episode,
    task_source: 'synthetic',
    stop_condition: 'repeated_no_progress',
    no_progress_window: 3,
    replay_eligible: true,
    replay_priority: 0.6,
  }));
});

test('validateEpisodeRecord requires attempt_id for real shadow episodes', () => {
  const episode = makeValidEpisodeRecord();
  assert.throws(
    () => validateEpisodeRecord({ ...episode, task_source: 'real_shadow', attempt_id: null }),
    /attempt_id/i
  );
  assert.doesNotThrow(() => validateEpisodeRecord({
    ...episode,
    task_source: 'real_shadow',
    attempt_id: 'attempt-001',
  }));
});

test('validateRunSummary enforces ContextDB summary contract', () => {
  const summary = {
    run_id: 'run-001',
    spec_path: 'docs/superpowers/specs/2026-03-22-aios-shell-rl-v1-design.md',
    student_model_id: 'tiny-json-policy-v1',
    phase: '3',
    primary_teacher: 'codex-cli',
    fallback_order: ['claude-code'],
    train_split: 'benchmark-v1-train',
    held_out_split: 'benchmark-v1-held-out',
    best_checkpoint_path: 'experiments/rl-shell-v1/runs/run-001/checkpoints/best/policy.json',
    best_metrics: { success_rate: 0.5 },
    updates_completed: 2,
    updates_failed: 1,
    rollbacks_completed: 1,
    replay_only_epochs: 1,
    comparison_failed_count: 1,
    seed_results: [{ seed: 17, status: 'ok' }],
    status: 'ok',
  };

  assert.doesNotThrow(() => validateRunSummary(summary));
  assert.throws(() => validateRunSummary({ ...summary, primary_teacher: '' }), /primary_teacher/i);
  assert.throws(() => validateRunSummary({ ...summary, updates_completed: undefined }), /updates_completed/i);
  assert.throws(() => validateRunSummary({ ...summary, comparison_failed_count: undefined }), /comparison_failed_count/i);
});
