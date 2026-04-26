import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  appendSoloIteration,
  initSoloRunJournal,
  readSoloControl,
  readSoloRunStatus,
  requestSoloHarnessStop,
} from '../lib/harness/solo-journal.mjs';

test('initSoloRunJournal writes objective summary and control artifacts', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-solo-journal-'));

  try {
    const journal = await initSoloRunJournal({
      rootDir,
      sessionId: 'solo-session',
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

    assert.match(journal.summaryPath, /run-summary\.json$/);
    assert.match(journal.controlPath, /control\.json$/);

    const summary = JSON.parse(await readFile(journal.summaryPath, 'utf8'));
    assert.equal(summary.kind, 'solo-harness.run-summary');
    assert.equal(summary.status, 'running');
    assert.equal(summary.objective, 'Ship X');
    assert.equal(summary.provider, 'codex');
    assert.equal(summary.clientId, 'codex-cli');

    const statusPayload = await readSoloRunStatus({ rootDir, sessionId: 'solo-session' });
    assert.equal(statusPayload.sessionId, 'solo-session');
    assert.equal(statusPayload.status, 'running');
    assert.equal(statusPayload.objective, 'Ship X');
    assert.equal(statusPayload.worktree.enabled, false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('appendSoloIteration persists iteration artifact and stop control can be requested', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aios-solo-journal-'));

  try {
    await initSoloRunJournal({
      rootDir,
      sessionId: 'solo-session',
      objective: 'Ship Y',
      provider: 'codex',
      clientId: 'codex-cli',
      profile: 'standard',
      worktree: {
        enabled: true,
        baseRef: 'HEAD',
        path: '/tmp/demo',
        preserved: true,
        cleanupReason: '',
      },
    });

    const iteration = await appendSoloIteration({
      rootDir,
      sessionId: 'solo-session',
      iteration: 1,
      outcome: {
        schemaVersion: 1,
        kind: 'solo-harness.iteration',
        sessionId: 'solo-session',
        iteration: 1,
        outcome: 'success',
        summary: 'created docs',
        keyChanges: ['docs/checklist.md'],
        keyLearnings: ['need final review'],
        nextAction: 'run tests',
        shouldStop: false,
        failureClass: 'none',
        backoffAction: 'none',
        checkpointStatus: 'running',
        createdAt: '2026-04-26T15:00:00.000Z',
      },
      logEntries: [
        { ts: '2026-04-26T15:00:00.000Z', kind: 'response', text: 'iteration output' },
      ],
    });

    assert.match(iteration.iterationPath, /iteration-0001\.json$/);
    assert.match(iteration.logPath, /iteration-0001\.log\.jsonl$/);

    await requestSoloHarnessStop({
      rootDir,
      sessionId: 'solo-session',
      reason: 'operator-request',
    });
    const control = await readSoloControl({ rootDir, sessionId: 'solo-session' });
    assert.equal(control.stopRequested, true);
    assert.equal(control.reason, 'operator-request');

    const status = await readSoloRunStatus({ rootDir, sessionId: 'solo-session' });
    assert.equal(status.iterationCount, 1);
    assert.equal(status.lastOutcome, 'success');
    assert.equal(status.stopRequested, true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
