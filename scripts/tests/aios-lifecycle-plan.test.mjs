import assert from 'node:assert/strict';
import test from 'node:test';

import { planDoctor } from '../lib/lifecycle/doctor.mjs';
import { planEntropyGc } from '../lib/lifecycle/entropy-gc.mjs';
import { planSetup } from '../lib/lifecycle/setup.mjs';
import { planUninstall } from '../lib/lifecycle/uninstall.mjs';

test('planSetup uses the current lifecycle defaults', () => {
  const plan = planSetup();
  assert.equal(plan.command, 'setup');
  assert.deepEqual(plan.options.components, ['browser', 'shell', 'skills', 'agents', 'superpowers']);
  assert.equal(plan.options.wrapMode, 'opt-in');
  assert.equal(plan.options.client, 'all');
  assert.match(plan.preview, /setup --components browser,shell,skills,agents,superpowers/);
});

test('planUninstall defaults to shell and skills only', () => {
  const plan = planUninstall();
  assert.equal(plan.command, 'uninstall');
  assert.deepEqual(plan.options.components, ['shell', 'skills']);
  assert.equal(plan.options.client, 'all');
});

test('planDoctor preserves strict and global security flags', () => {
  const plan = planDoctor({ strict: true, globalSecurity: true });
  assert.equal(plan.command, 'doctor');
  assert.equal(plan.options.strict, true);
  assert.equal(plan.options.globalSecurity, true);
  assert.match(plan.preview, /doctor --strict --global-security/);
});

test('planEntropyGc preserves explicit options', () => {
  const plan = planEntropyGc({
    sessionId: 'codex-cli-20260303T080437-065e16c0',
    mode: 'dry-run',
    retain: 9,
    minAgeHours: 72,
    format: 'json',
  });
  assert.equal(plan.command, 'entropy-gc');
  assert.equal(plan.options.mode, 'dry-run');
  assert.equal(plan.options.sessionId, 'codex-cli-20260303T080437-065e16c0');
  assert.equal(plan.options.retain, 9);
  assert.equal(plan.options.minAgeHours, 72);
  assert.equal(plan.options.format, 'json');
  assert.match(plan.preview, /entropy-gc dry-run/);
  assert.match(plan.preview, /--retain 9/);
});
