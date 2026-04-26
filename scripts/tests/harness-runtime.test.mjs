import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  normalizeSoloIterationOutcome,
  resolveSoloBackoffState,
  runSoloHarnessLoop,
} from '../lib/harness/solo-runtime.mjs';
import {
  initSoloRunJournal,
  readSoloControl,
  readSoloRunStatus,
  requestSoloHarnessStop,
} from '../lib/harness/solo-journal.mjs';
import { runHarnessCommand } from '../lib/lifecycle/harness.mjs';

test('normalizeSoloIterationOutcome fills defaults for a success outcome', () => {
  const success = normalizeSoloIterationOutcome({
    sessionId: 's1',
    iteration: 1,
    outcome: 'success',
    summary: 'done',
    shouldStop: false,
  });

  assert.equal(success.failureClass, 'none');
  assert.equal(success.backoffAction, 'none');
  assert.equal(success.checkpointStatus, 'running');
});

test('normalizeSoloIterationOutcome preserves blocked no-progress decisions', () => {
  const blocked = normalizeSoloIterationOutcome({
    sessionId: 's1',
    iteration: 2,
    outcome: 'blocked',
    summary: 'No safe next mutation',
    failureClass: 'no-progress',
    shouldStop: false,
  });

  assert.equal(blocked.failureClass, 'no-progress');
  assert.equal(blocked.outcome, 'blocked');
});

test('resolveSoloBackoffState doubles delay for infra failures', () => {
  const infra = resolveSoloBackoffState({
    previous: { consecutiveInfraFailures: 1, nextDelayMs: 60000, until: null },
    outcome: { outcome: 'infra-retry', failureClass: 'runtime-error' },
    nowIso: '2026-04-26T15:00:00.000Z',
  });

  assert.equal(infra.consecutiveInfraFailures, 2);
  assert.equal(infra.nextDelayMs, 120000);
});

test('runSoloHarnessLoop appends iterations and stops when executeTurn requests it', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-solo-runtime-'));

  try {
    await initSoloRunJournal({
      rootDir,
      sessionId: 's1',
      objective: 'Ship X',
      provider: 'codex',
      clientId: 'codex-cli',
      profile: 'standard',
      worktree: {
        enabled: false,
        baseRef: 'HEAD',
        path: '',
        preserved: false,
        cleanupReason: '',
      },
    });

    const result = await runSoloHarnessLoop({
      rootDir,
      sessionId: 's1',
      objective: 'Ship X',
      provider: 'codex',
      clientId: 'codex-cli',
      profile: 'standard',
      maxIterations: 2,
      executeTurn: async ({ iteration }) => ({
        outcome: iteration === 1 ? 'success' : 'stopped',
        summary: iteration === 1 ? 'made progress' : 'operator requested stop',
        keyChanges: iteration === 1 ? ['docs/checklist.md'] : [],
        keyLearnings: [],
        nextAction: 'continue',
        shouldStop: iteration === 2,
        failureClass: iteration === 2 ? 'stop-requested' : 'none',
      }),
      sleepImpl: async () => {},
    });

    assert.equal(result.summary.iterationCount, 2);
    assert.equal(result.summary.status, 'stopped');

    const status = await readSoloRunStatus({ rootDir, sessionId: 's1' });
    assert.equal(status.iterationCount, 2);
    assert.equal(status.lastFailureClass, 'stop-requested');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('runHarnessCommand supports dry-run, stop, status, and resume with injected executeTurn', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-solo-harness-command-'));
  const logs = [];

  try {
    const dryRun = await runHarnessCommand(
      {
        subcommand: 'run',
        objective: 'Ship release checklist',
        sessionId: 'demo-session',
        provider: 'codex',
        profile: 'standard',
        worktree: true,
        baseRef: 'HEAD',
        dryRun: true,
        json: true,
      },
      {
        rootDir,
        io: { log: (line) => logs.push(String(line)) },
      }
    );
    assert.equal(dryRun.exitCode, 0);
    const dryRunPayload = JSON.parse(logs.at(-1));
    assert.equal(dryRunPayload.sessionId, 'demo-session');
    assert.equal(dryRunPayload.worktree.enabled, true);

    const stopResult = await runHarnessCommand(
      { subcommand: 'stop', sessionId: 'demo-session', json: true },
      { rootDir, io: { log: (line) => logs.push(String(line)) } }
    );
    assert.equal(stopResult.exitCode, 0);
    const control = await readSoloControl({ rootDir, sessionId: 'demo-session' });
    assert.equal(control.stopRequested, true);

    const statusResult = await runHarnessCommand(
      { subcommand: 'status', sessionId: 'demo-session', json: true },
      { rootDir, io: { log: (line) => logs.push(String(line)) } }
    );
    assert.equal(statusResult.exitCode, 0);
    const statusPayload = JSON.parse(logs.at(-1));
    assert.equal(statusPayload.stopRequested, true);

    const resumeResult = await runHarnessCommand(
      {
        subcommand: 'resume',
        sessionId: 'demo-session',
        json: true,
      },
      {
        rootDir,
        io: { log: (line) => logs.push(String(line)) },
        executeTurn: async () => ({
          outcome: 'success',
          summary: 'resumed successfully',
          keyChanges: ['README.md'],
          keyLearnings: [],
          nextAction: 'done',
          shouldStop: true,
          failureClass: 'none',
        }),
        sleepImpl: async () => {},
      }
    );
    assert.equal(resumeResult.exitCode, 0);
    const finalPayload = JSON.parse(logs.at(-1));
    assert.equal(finalPayload.lastOutcome, 'success');
    assert.equal(finalPayload.status, 'done');

    const finalControl = await readSoloControl({ rootDir, sessionId: 'demo-session' });
    assert.equal(finalControl.stopRequested, false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('runSoloHarnessLoop exits on requested stop before another executeTurn begins', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-solo-runtime-stop-'));

  try {
    await initSoloRunJournal({
      rootDir,
      sessionId: 'stop-session',
      objective: 'Stop test',
      provider: 'codex',
      clientId: 'codex-cli',
      profile: 'standard',
      worktree: {
        enabled: false,
        baseRef: 'HEAD',
        path: '',
        preserved: false,
        cleanupReason: '',
      },
    });
    await requestSoloHarnessStop({ rootDir, sessionId: 'stop-session' });

    let called = 0;
    const result = await runSoloHarnessLoop({
      rootDir,
      sessionId: 'stop-session',
      objective: 'Stop test',
      provider: 'codex',
      clientId: 'codex-cli',
      profile: 'standard',
      maxIterations: 3,
      executeTurn: async () => {
        called += 1;
        return {
          outcome: 'success',
          summary: 'unexpected',
          shouldStop: false,
        };
      },
      sleepImpl: async () => {},
    });

    assert.equal(called, 0);
    assert.equal(result.summary.status, 'stopped');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
