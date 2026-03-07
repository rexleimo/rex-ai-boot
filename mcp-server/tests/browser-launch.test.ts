import test from 'node:test';
import assert from 'node:assert/strict';

import { tools } from '../src/browser/index.js';
import { resolveLaunchHeadless } from '../src/browser/launcher.js';

test('resolveLaunchHeadless defaults to visible browser', () => {
  const result = resolveLaunchHeadless({}, { name: 'default' }, undefined);

  assert.equal(result.headless, false);
  assert.equal(result.visible, true);
  assert.equal(result.source, 'default-visible');
});

test('resolveLaunchHeadless prefers visible over headless when both are provided', () => {
  const result = resolveLaunchHeadless({ visible: true, headless: true }, { name: 'default' }, 'true');

  assert.equal(result.headless, false);
  assert.equal(result.visible, true);
  assert.equal(result.source, 'arg-visible');
});

test('browser_launch schema exposes visible toggle for agents', () => {
  const launchTool = tools.find((tool) => tool.name === 'browser_launch');

  assert.ok(launchTool);
  assert.equal(typeof launchTool?.description, 'string');
  assert.match(launchTool?.description ?? '', /visible|headful/i);
  assert.equal('visible' in ((launchTool?.inputSchema as any)?.properties ?? {}), true);
});
