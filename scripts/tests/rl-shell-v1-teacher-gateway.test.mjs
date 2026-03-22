import assert from 'node:assert/strict';
import test from 'node:test';

test('teacher gateway falls back and returns deterministic failure defaults when all backends fail', async () => {
  const mod = await import('../lib/rl-shell-v1/teacher-gateway.mjs');
  const result = await mod.callTeacher({
    primary: 'codex-cli',
    fallbacks: ['claude-code'],
    trace: [],
    transport: async () => {
      throw new Error('offline');
    },
  });

  assert.equal(result.call_status, 'failed_all_backends');
  assert.equal(result.shaping_score, 0);
  assert.equal(result.confidence, 0);
  assert.equal(result.reference_solution, null);
  assert.equal(result.critique, null);
});

test('teacher gateway normalizes successful fallback responses', async () => {
  const mod = await import('../lib/rl-shell-v1/teacher-gateway.mjs');
  const attempts = [];
  const result = await mod.callTeacher({
    primary: 'codex-cli',
    fallbacks: ['claude-code'],
    trace: [{ task_prompt: 'Fix the math helper' }],
    transport: async ({ backend }) => {
      attempts.push(backend);
      if (backend === 'codex-cli') {
        throw new Error('primary down');
      }
      return {
        critique: 'read the failing helper first',
        reference_solution: '{"action":"read","path":"src/math.mjs"}',
        shaping_score: 0.5,
        confidence: 0.75,
      };
    },
  });

  assert.deepEqual(attempts, ['codex-cli', 'claude-code']);
  assert.equal(result.backend_used, 'claude-code');
  assert.equal(result.call_status, 'fallback_ok');
  assert.equal(result.shaping_score, 0.5);
  assert.equal(result.confidence, 0.75);
});
