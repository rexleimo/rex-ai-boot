import assert from 'node:assert/strict';
import test from 'node:test';

test('browser holdout returns normalized metrics with zero schema failures on fixture driver', async () => {
  const evalMod = await import('../lib/rl-browser-v1/eval-harness.mjs');
  const regMod = await import('../lib/rl-browser-v1/task-registry.mjs');

  const result = await evalMod.runBrowserHoldout({
    tasks: regMod.loadBrowserTasks({ count: 20 }).slice(0, 20),
    checkpointId: 'candidate',
  });

  assert.equal(result.environment, 'browser');
  assert.equal(result.episode_count, 20);
  assert.equal(result.schema_validation_failures, 0);
  assert.equal(typeof result.success_rate, 'number');
  assert.equal(typeof result.comparison_failed_rate, 'number');
});

