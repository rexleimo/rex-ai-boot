import assert from 'node:assert/strict';
import test from 'node:test';

test('validateCheckpointLineage accepts canonical active/pre_update_ref/last_stable pointers', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');
  assert.doesNotThrow(() => mod.validateCheckpointLineage({
    active_checkpoint_id: 'ckpt-a',
    pre_update_ref_checkpoint_id: null,
    last_stable_checkpoint_id: 'ckpt-a',
  }));
});

test('validateComparisonResult requires relative_outcome for completed comparisons', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');
  assert.throws(
    () => mod.validateComparisonResult({
      comparison_status: 'completed',
      relative_outcome: null,
    }),
    /relative_outcome/i
  );
  assert.doesNotThrow(() => mod.validateComparisonResult({
    comparison_status: 'completed',
    relative_outcome: 'better',
  }));
});

test('validateReplayCandidate rejects training admission for diagnostic_only routes', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');
  assert.throws(
    () => mod.validateReplayCandidate({
      replay_route: 'diagnostic_only',
      training_admission: true,
    }),
    /diagnostic_only|training_admission/i
  );
  assert.doesNotThrow(() => mod.validateReplayCandidate({
    replay_route: 'negative',
    training_admission: true,
  }));
});

test('validateTeacherResponse enforces normalized backend, call_status, and shaping bounds', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');
  assert.doesNotThrow(() => mod.validateTeacherResponse({
    backend_used: 'codex-cli',
    call_status: 'complete',
    latency_ms: 12,
    critique: 'Read the failing file first.',
    reference_solution: null,
    shaping_score: 0.4,
    confidence: 0.8,
  }));
  assert.throws(
    () => mod.validateTeacherResponse({
      backend_used: 'codex-cli',
      call_status: 'complete',
      latency_ms: 12,
      critique: null,
      reference_solution: null,
      shaping_score: 2,
      confidence: 0.8,
    }),
    /shaping_score/i
  );
});

test('validateOnlineUpdateResult requires deterministic batch and checkpoint ids', async () => {
  const mod = await import('../lib/rl-core/schema.mjs');
  assert.doesNotThrow(() => mod.validateOnlineUpdateResult({
    status: 'ok',
    batch_id: 'batch-001',
    checkpoint_id: 'ckpt-a',
    next_checkpoint_id: 'ckpt-a-u1',
  }));
  assert.throws(
    () => mod.validateOnlineUpdateResult({
      status: 'ok',
      batch_id: '',
      checkpoint_id: 'ckpt-a',
      next_checkpoint_id: 'ckpt-a-u1',
    }),
    /batch_id/i
  );
});
