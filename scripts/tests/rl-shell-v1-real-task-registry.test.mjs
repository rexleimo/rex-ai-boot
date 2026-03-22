import assert from 'node:assert/strict';
import test from 'node:test';

function makeCommandRunner(resultByCommand) {
  const calls = [];
  return {
    calls,
    run: async ({ command }) => {
      calls.push(command);
      const result = resultByCommand[command];
      if (!result) {
        return { status: 0, stdout: '', stderr: '' };
      }
      return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
      };
    },
  };
}

test('real-task registry admits only stable reproducible failing tasks', async () => {
  const mod = await import('../lib/rl-shell-v1/real-task-registry.mjs');
  const commandRunner = makeCommandRunner({
    'npm run test:scripts': {
      status: 1,
      stderr: 'not ok 1 - orchestrator manifest parse failure',
    },
    'cd mcp-server && npm run typecheck': {
      status: 0,
    },
    'cd mcp-server && npm run build': {
      status: 1,
      stderr: 'Build failed: missing module export',
    },
  });

  const result = await mod.collectRealTasks({
    rootDir: process.cwd(),
    mode: 'current-failures-first',
    baselineRepeats: 2,
    commandRunner: commandRunner.run,
    historicalFallback: async () => [],
  });

  assert.equal(result.admitted.every((task) => task.admission_status === 'admitted'), true);
  assert.equal(result.admitted.every((task) => task.baseline_reproduced === true), true);
});

test('real-task registry marks limited-pool when fewer than three tasks are admitted', async () => {
  const mod = await import('../lib/rl-shell-v1/real-task-registry.mjs');
  const commandRunner = makeCommandRunner({
    'npm run test:scripts': {
      status: 1,
      stderr: 'not ok 1 - orchestrator manifest parse failure',
    },
    'cd mcp-server && npm run typecheck': {
      status: 0,
    },
    'cd mcp-server && npm run build': {
      status: 0,
    },
  });

  const result = await mod.collectRealTasks({
    rootDir: process.cwd(),
    mode: 'current-failures-first',
    baselineRepeats: 2,
    commandRunner: commandRunner.run,
    historicalFallback: async () => [],
  });

  assert.equal(result.pool_status, 'limited-pool');
  assert.equal(result.admitted.length, 1);
});
