import assert from 'node:assert/strict';
import test from 'node:test';

test('reward fusion implements full fused-reward math and teacher-term clamping', async () => {
  const mod = await import('../lib/rl-shell-v1/reward-fusion.mjs');

  assert.deepEqual(
    mod.fuseReward({ terminalReward: 1, shapingScore: -1, callStatus: 'ok' }),
    { teacherTerm: -0.2, fusedReward: 0.8 }
  );
  assert.deepEqual(
    mod.fuseReward({ terminalReward: 0, shapingScore: 2, callStatus: 'ok' }),
    { teacherTerm: 0.2, fusedReward: 0.2 }
  );
  assert.deepEqual(
    mod.fuseReward({ terminalReward: -1, shapingScore: 1, callStatus: 'ok' }),
    { teacherTerm: 0.2, fusedReward: -0.8 }
  );
  assert.deepEqual(
    mod.fuseReward({ terminalReward: -1, shapingScore: 1, callStatus: 'failed_all_backends' }),
    { teacherTerm: 0, fusedReward: -1 }
  );
});

test('computeTerminalReward follows the spec reward table', async () => {
  const mod = await import('../lib/rl-shell-v1/reward-fusion.mjs');

  assert.equal(
    mod.computeTerminalReward({
      baselineFailures: ['a', 'b'],
      finalFailures: [],
      newFailures: [],
      verificationStatus: 'ok',
    }),
    1
  );
  assert.equal(
    mod.computeTerminalReward({
      baselineFailures: ['a', 'b'],
      finalFailures: ['b'],
      newFailures: [],
      verificationStatus: 'ok',
    }),
    0.25
  );
  assert.equal(
    mod.computeTerminalReward({
      baselineFailures: ['a'],
      finalFailures: ['a'],
      newFailures: [],
      verificationStatus: 'ok',
    }),
    0
  );
  assert.equal(
    mod.computeTerminalReward({
      baselineFailures: ['a'],
      finalFailures: [],
      newFailures: ['c'],
      verificationStatus: 'ok',
    }),
    -1
  );
  assert.equal(
    mod.computeTerminalReward({
      baselineFailures: ['a'],
      finalFailures: ['a'],
      newFailures: [],
      verificationStatus: 'timeout',
    }),
    -1
  );
});
