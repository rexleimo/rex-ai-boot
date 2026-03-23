import assert from 'node:assert/strict';
import test from 'node:test';

function makeTask(overrides = {}) {
  return {
    task_id: 'browser-publish-001',
    target_site: 'example.test',
    flow_id: 'publish-sequence',
    start_url: 'https://example.test/publish',
    comparison_start_url: 'https://example.test/publish',
    success_selector: '[data-status="published"]',
    challenge_selector: '#captcha',
    auth_state_class: 'authenticated',
    input_payload: { title: 'Hello' },
    flow_constraints: ['controlled-submit'],
    ...overrides,
  };
}

test('browser adapter returns normalized episode and comparison payloads', async () => {
  const mod = await import('../lib/rl-browser-v1/adapter.mjs');
  const runnerMod = await import('../lib/rl-browser-v1/browser-runner.mjs');
  const task = makeTask();
  const browserDriver = runnerMod.createFixtureBrowserDriver();

  const episode = await mod.runBrowserEpisode({
    task,
    checkpointId: 'ckpt-browser-1',
    browserDriver,
  });
  assert.equal(episode.environment, 'browser');
  assert.equal(episode.teacher_triggered, false);
  assert.equal(episode.safety_violation, false);
  assert.equal(episode.schema_version, 1);
  assert.equal(episode.task_family, 'publish-sequence');
  assert.equal(['failure', 'boundary', null].includes(episode.teacher_trigger_reason), true);
  assert.equal(['completed', 'comparison_failed'].includes(episode.comparison_status), true);
  assert.equal(['positive', 'negative', 'neutral', 'diagnostic_only'].includes(episode.replay_route), true);

  const comparison = await mod.compareBrowserAgainstReference({
    task,
    activeCheckpointId: 'ckpt-browser-2',
    preUpdateRefCheckpointId: 'ckpt-browser-1',
    browserDriver,
  });
  assert.equal(comparison.comparison_status, 'completed');
  assert.equal(['better', 'same', 'worse'].includes(comparison.relative_outcome), true);
  assert.deepEqual(comparison.pinned_inputs, {
    target_site: 'example.test',
    flow_id: 'publish-sequence',
    start_url: 'https://example.test/publish',
    comparison_start_url: 'https://example.test/publish',
    auth_state_class: 'authenticated',
    input_payload: { title: 'Hello' },
  });
});

test('browser comparison falls back to comparison_failed after one automatic retry', async () => {
  const mod = await import('../lib/rl-browser-v1/adapter.mjs');
  const calls = [];
  const driver = {
    async executeFlow({ attempt, checkpointId }) {
      calls.push({ attempt, checkpointId });
      return {
        evidence: {
          page_kind: 'challenge',
          key_selectors_present: ['#captcha'],
          form_state: 'locked',
          action_taken: 'submit',
          navigation_result: 'blocked',
          form_error: null,
          auth_state: 'authenticated',
          challenge_state: 'challenge',
          sensitive_action_flag: false,
          terminal_status: 'challenge',
        },
        boundary: false,
        terminal_reward: -1,
        human_handoff_required: true,
        safety_violation: false,
        safety_violation_reason: null,
      };
    },
  };

  const comparison = await mod.compareBrowserAgainstReference({
    task: makeTask({ forceChallengeDivergenceTwice: true }),
    activeCheckpointId: 'ckpt-browser-2',
    preUpdateRefCheckpointId: 'ckpt-browser-1',
    browserDriver: driver,
  });

  assert.equal(comparison.comparison_status, 'comparison_failed');
  assert.equal(comparison.replay_route, 'diagnostic_only');
  assert.equal(comparison.human_handoff_required, true);
  assert.equal(calls.length, 4);
});

test('browser adapter returns auth failures in-band and throws only on infrastructure faults', async () => {
  const mod = await import('../lib/rl-browser-v1/adapter.mjs');
  const runnerMod = await import('../lib/rl-browser-v1/browser-runner.mjs');

  const authEpisode = await mod.runBrowserEpisode({
    task: makeTask({ requireHumanReauth: true }),
    checkpointId: 'ckpt-browser-1',
    browserDriver: runnerMod.createFixtureBrowserDriver(),
  });
  assert.equal(authEpisode.teacher_triggered, true);
  assert.equal(authEpisode.teacher_trigger_reason, 'failure');
  assert.equal(authEpisode.human_handoff_required, true);

  const reauthComparison = await mod.compareBrowserAgainstReference({
    task: makeTask({ requireHumanReauth: true }),
    activeCheckpointId: 'ckpt-browser-2',
    preUpdateRefCheckpointId: 'ckpt-browser-1',
    browserDriver: runnerMod.createFixtureBrowserDriver(),
  });
  assert.deepEqual(
    {
      replayRoute: reauthComparison.replay_route,
      handoffTriggered: reauthComparison.human_handoff_required,
    },
    {
      replayRoute: 'diagnostic_only',
      handoffTriggered: true,
    }
  );

  await assert.rejects(
    () => mod.runBrowserEpisode({
      task: makeTask(),
      checkpointId: 'ckpt-browser-1',
      browserDriver: runnerMod.createBrokenBrowserDriver(),
    }),
    /infrastructure/i
  );
});

