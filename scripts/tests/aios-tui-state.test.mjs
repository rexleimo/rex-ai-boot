import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialState, reduceState } from '../lib/tui/state.mjs';

test('main menu enter opens setup screen', () => {
  const state = createInitialState();
  const next = reduceState(state, 'enter');
  assert.equal(next.screen, 'setup');
  assert.equal(next.cursor, 0);
});

test('main menu down moves cursor and enter on exit requests quit', () => {
  let state = createInitialState();
  for (let index = 0; index < 4; index += 1) {
    state = reduceState(state, 'down');
  }
  assert.equal(state.cursor, 4);
  state = reduceState(state, 'enter');
  assert.equal(state.exitRequested, true);
});

test('setup screen space toggles selected component', () => {
  let state = reduceState(createInitialState(), 'enter');
  assert.equal(state.screen, 'setup');
  assert.equal(state.options.setup.components.browser, true);
  state = reduceState(state, 'space');
  assert.equal(state.options.setup.components.browser, false);
});

test('setup screen enter on run goes to confirm and back returns to setup', () => {
  let state = reduceState(createInitialState(), 'enter');
  for (let index = 0; index < 10; index += 1) {
    state = reduceState(state, 'down');
  }
  assert.equal(state.cursor, 10);
  state = reduceState(state, 'enter');
  assert.equal(state.screen, 'confirm');
  assert.equal(state.confirmAction, 'setup');

  state = reduceState(state, 'back');
  assert.equal(state.screen, 'setup');
});

test('setup screen can cycle skills scope and retain selected skills metadata', () => {
  let state = reduceState(createInitialState(), 'enter');
  for (let index = 0; index < 5; index += 1) {
    state = reduceState(state, 'down');
  }
  assert.equal(state.cursor, 5);
  assert.equal(state.options.setup.scope, 'global');
  state = reduceState(state, 'space');
  assert.equal(state.options.setup.scope, 'project');
  assert.deepEqual(state.options.setup.selectedSkills, []);
});

test('uninstall screen shows only installed skills for current scope and client, with no default selection', () => {
  let state = createInitialState({
    catalogSkills: [
      {
        name: 'find-skills',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'xhs-ops-methods',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
    ],
    installedSkills: {
      global: {
        codex: ['find-skills'],
      },
      project: {
        codex: ['xhs-ops-methods'],
      },
    },
  });

  state = reduceState(state, 'down');
  state = reduceState(state, 'down');
  state = reduceState(state, 'enter');
  assert.equal(state.screen, 'uninstall');
  assert.deepEqual(state.options.uninstall.selectedSkills, []);

  for (let index = 0; index < 5; index += 1) {
    state = reduceState(state, 'down');
  }
  assert.equal(state.cursor, 5);
  state = reduceState(state, 'space');
  assert.equal(state.options.uninstall.client, 'codex');
  assert.deepEqual(state.options.uninstall.selectedSkills, []);

  state = reduceState(state, 'up');
  assert.equal(state.cursor, 4);
  state = reduceState(state, 'space');
  assert.equal(state.options.uninstall.scope, 'project');
  assert.deepEqual(state.options.uninstall.selectedSkills, []);
});

test('skill picker toggles the skill shown at the current grouped cursor position', () => {
  let state = createInitialState({
    catalogSkills: [
      {
        name: 'optional-first',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
      {
        name: 'core-second',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'optional-third',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
    ],
  });

  state = reduceState(state, 'enter');
  for (let index = 0; index < 9; index += 1) {
    state = reduceState(state, 'down');
  }
  state = reduceState(state, 'enter');

  assert.equal(state.screen, 'skill-picker');
  assert.deepEqual(state.options.setup.selectedSkills, ['core-second']);

  state = reduceState(state, 'space');
  assert.deepEqual(state.options.setup.selectedSkills, []);
});

test('skill picker scrolls its window when the cursor moves beyond the visible page', () => {
  let state = createInitialState({
    viewportRows: 18,
    catalogSkills: Array.from({ length: 10 }, (_, index) => ({
      name: `skill-${index + 1}`,
      clients: ['codex'],
      scopes: ['global'],
      defaultInstall: { global: false, project: false },
    })),
  });

  state = reduceState(state, 'enter');
  for (let index = 0; index < 9; index += 1) {
    state = reduceState(state, 'down');
  }
  state = reduceState(state, 'enter');

  assert.equal(state.screen, 'skill-picker');
  assert.equal(state.scrollOffset, 0);

  for (let index = 0; index < 6; index += 1) {
    state = reduceState(state, 'down');
  }

  assert.equal(state.cursor, 6);
  assert.equal(state.scrollOffset, 5);
});

test('uninstall skill picker can select and clear all visible skills', () => {
  let state = createInitialState({
    catalogSkills: [
      {
        name: 'skill-a',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
      {
        name: 'skill-b',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
    ],
    installedSkills: {
      global: {
        codex: ['skill-a', 'skill-b'],
      },
    },
  });

  state = reduceState(state, 'down');
  state = reduceState(state, 'down');
  state = reduceState(state, 'enter');
  for (let index = 0; index < 5; index += 1) {
    state = reduceState(state, 'down');
  }
  state = reduceState(state, 'space');
  state = reduceState(state, 'down');
  state = reduceState(state, 'enter');

  assert.equal(state.screen, 'skill-picker');

  state.cursor = 2;
  state = reduceState(state, 'enter');
  assert.deepEqual(state.options.uninstall.selectedSkills, ['skill-a', 'skill-b']);

  state = reduceState(state, 'down');
  state = reduceState(state, 'enter');
  assert.deepEqual(state.options.uninstall.selectedSkills, []);
});

test('uninstall skill picker toggles the skill shown at the current cursor when installed order differs', () => {
  let state = createInitialState({
    viewportRows: 18,
    catalogSkills: [
      {
        name: 'contextdb-autopilot',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'seo-geo-page-optimization',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
    ],
    installedSkills: {
      global: {
        codex: ['seo-geo-page-optimization', 'contextdb-autopilot'],
      },
    },
  });

  state = reduceState(state, 'down');
  state = reduceState(state, 'down');
  state = reduceState(state, 'enter');
  for (let index = 0; index < 5; index += 1) {
    state = reduceState(state, 'down');
  }
  state = reduceState(state, 'space');
  state = reduceState(state, 'down');
  state = reduceState(state, 'enter');

  state = reduceState(state, 'down');
  state = reduceState(state, 'space');
  assert.deepEqual(state.options.uninstall.selectedSkills, ['seo-geo-page-optimization']);
});

test('quit key always requests exit', () => {
  const state = reduceState(createInitialState(), 'quit');
  assert.equal(state.exitRequested, true);
});
