import assert from 'node:assert/strict';
import test from 'node:test';

test('browser schema validates controlled task, evidence, and holdout payloads', async () => {
  const mod = await import('../lib/rl-browser-v1/schema.mjs');

  assert.doesNotThrow(() => mod.validateBrowserTask({
    task_id: 'browser-publish-001',
    target_site: 'example.test',
    flow_id: 'publish-sequence',
    start_url: 'https://example.test/publish',
    comparison_start_url: 'https://example.test/publish',
    success_selector: '[data-status="published"]',
    challenge_selector: '#captcha',
  }));

  assert.doesNotThrow(() => mod.validateBrowserEvidence({
    page_kind: 'publish-form',
    key_selectors_present: ['[data-form]'],
    form_state: 'dirty',
    action_taken: 'submit',
    navigation_result: 'same-page',
    form_error: 'title-required',
    auth_state: 'authenticated',
    challenge_state: 'none',
    sensitive_action_flag: false,
    terminal_status: 'validation_error',
  }));

  assert.doesNotThrow(() => mod.validateBrowserHoldoutResult({
    episode_count: 20,
    success_rate: 0.65,
    comparison_failed_rate: 0.15,
    schema_validation_failures: 0,
  }));
});

