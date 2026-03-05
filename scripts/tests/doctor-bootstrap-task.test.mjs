import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { inspectBootstrapTask } from '../doctor-bootstrap-task.mjs';

async function makeWs(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('warns when tasks directory is missing', async () => {
  const ws = await makeWs('aios-doctor-bootstrap-missing-');
  const result = await inspectBootstrapTask(ws);
  assert.equal(result.status, 'warn');
  assert.equal(result.code, 'tasks-missing');
});

test('ok when tasks/.current-task points to existing task file', async () => {
  const ws = await makeWs('aios-doctor-bootstrap-current-ok-');
  const taskDir = path.join(ws, 'tasks', 'pending', 'task_1_bootstrap_guidelines');
  await mkdir(taskDir, { recursive: true });
  await writeFile(path.join(taskDir, 'task.json'), '{}\n', 'utf8');
  await writeFile(path.join(ws, 'tasks', '.current-task'), 'pending/task_1_bootstrap_guidelines/task.json\n', 'utf8');

  const result = await inspectBootstrapTask(ws);
  assert.equal(result.status, 'ok');
  assert.equal(result.code, 'current-task-present');
});

test('warns when tasks/.current-task points to missing file', async () => {
  const ws = await makeWs('aios-doctor-bootstrap-current-broken-');
  await mkdir(path.join(ws, 'tasks'), { recursive: true });
  await writeFile(path.join(ws, 'tasks', '.current-task'), 'pending/missing/task.json\n', 'utf8');

  const result = await inspectBootstrapTask(ws);
  assert.equal(result.status, 'warn');
  assert.equal(result.code, 'current-task-broken');
});

test('warns when pending is empty and there is no current task', async () => {
  const ws = await makeWs('aios-doctor-bootstrap-empty-');
  await mkdir(path.join(ws, 'tasks', 'pending'), { recursive: true });

  const result = await inspectBootstrapTask(ws);
  assert.equal(result.status, 'warn');
  assert.equal(result.code, 'pending-empty');
});

test('warns when bootstrap task exists but current-task is missing', async () => {
  const ws = await makeWs('aios-doctor-bootstrap-orphan-');
  await mkdir(path.join(ws, 'tasks', 'pending', 'task_abc_bootstrap_guidelines'), { recursive: true });

  const result = await inspectBootstrapTask(ws);
  assert.equal(result.status, 'warn');
  assert.equal(result.code, 'bootstrap-without-current-task');
});

test('ok when pending has non-bootstrap tasks even without current-task', async () => {
  const ws = await makeWs('aios-doctor-bootstrap-pending-ok-');
  await mkdir(path.join(ws, 'tasks', 'pending', 'task_business_001'), { recursive: true });

  const result = await inspectBootstrapTask(ws);
  assert.equal(result.status, 'ok');
  assert.equal(result.code, 'pending-has-tasks');
});
