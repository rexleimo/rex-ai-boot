import assert from 'node:assert/strict';
import test from 'node:test';

test('browser task registry samples deterministically and rejects inadmissible tasks', async () => {
  const mod = await import('../lib/rl-browser-v1/task-registry.mjs');

  const tasks = mod.loadBrowserTasks({
    tasks: [
      {
        task_id: 'browser-publish-001',
        target_site: 'example.test',
        flow_id: 'publish-sequence',
        start_url: 'https://example.test/publish',
        comparison_start_url: 'https://example.test/publish',
        success_selector: '[data-status="published"]',
        challenge_selector: '#captcha',
        flow_constraints: ['controlled-submit'],
      },
    ],
  });
  assert.equal(mod.sampleBrowserTask({ seed: 17, tasks }).task_id, 'browser-publish-001');

  assert.equal(
    mod.sampleBrowserTask({
      seed: 17,
      tasks: [{
        task_id: 'open-web',
        target_site: 'example.test',
        flow_id: 'explore',
        start_url: 'https://example.test',
        comparison_start_url: 'https://example.test',
        success_selector: 'body',
        challenge_selector: '#captcha',
        exploration_mode: 'open-ended',
      }],
    }),
    null
  );

  assert.equal(
    mod.sampleBrowserTask({
      seed: 18,
      tasks: [{
        task_id: 'unsafe-outbound',
        target_site: 'example.test',
        flow_id: 'send-live-post',
        start_url: 'https://example.test/publish',
        comparison_start_url: 'https://example.test/publish',
        success_selector: '[data-status="published"]',
        challenge_selector: '#captcha',
        sensitive_action_flag: true,
        flow_constraints: null,
      }],
    }),
    null
  );
});

