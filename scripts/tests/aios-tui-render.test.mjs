import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';

import { renderState } from '../lib/tui/render.mjs';
import { createInitialState, reduceState } from '../lib/tui/state.mjs';

test('skill picker renders descriptions for visible skills', () => {
  const state = createInitialState({
    catalogSkills: [
      {
        name: 'verification-loop',
        description: 'Evidence-before-assertions workflow for critical system verification and release checks.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'seo-geo-page-optimization',
        description: 'Optimize a page for SEO and GEO.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
      {
        name: 'skill-constraints',
        description: 'Operational constraints and best practices for skill execution.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
    ],
  });

  let next = reduceState(state, 'enter');
  for (let index = 0; index < 6; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'space');
  for (let index = 0; index < 3; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.match(output, /Core/);
  assert.match(output, /Optional/);
  assert.match(output, /verification-loop/);
  assert.match(output, /Evidence-before-assertions workflow for critical syst\.\.\./);
  assert.doesNotMatch(output, /release checks\./);
  assert.match(output, /seo-geo-page-optimization/);
  assert.match(output, /Optimize a page for SEO and GEO\./);
  assert.match(output, /skill-constraints/);
  assert.match(output, /Operational constraints and best practices for skill\.\.\./);
});

test('global skill picker can show business skills without selecting them by default', () => {
  const state = createInitialState({
    catalogSkills: [
      {
        name: 'verification-loop',
        description: 'Evidence-before-assertions workflow.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'xhs-ops-methods',
        description: 'Reusable Xiaohongshu operations workflow.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
      {
        name: 'aios-jimeng-image-ops',
        description: 'Jimeng image generation workflow for aios.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
    ],
  });

  let next = reduceState(state, 'enter');
  for (let index = 0; index < 9; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.match(output, /\[x\] verification-loop/);
  assert.match(output, /\[ \] xhs-ops-methods/);
  assert.match(output, /\[ \] aios-jimeng-image-ops/);
});

test('repo catalog exposes xhs and jimeng skills to global scope without default selection', () => {
  const catalogPath = path.resolve(process.cwd(), 'config', 'skills-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const xhs = catalog.skills.find((skill) => skill.name === 'xhs-ops-methods');
  const jimeng = catalog.skills.find((skill) => skill.name === 'aios-jimeng-image-ops');

  assert.deepEqual(xhs.scopes, ['global', 'project']);
  assert.equal(xhs.defaultInstall.global, false);
  assert.equal(xhs.defaultInstall.project, false);

  assert.deepEqual(jimeng.scopes, ['global', 'project']);
  assert.equal(jimeng.defaultInstall.global, false);
  assert.equal(jimeng.defaultInstall.project, false);
});

test('repo catalog keeps system core skills in the default core selection set', () => {
  const catalogPath = path.resolve(process.cwd(), 'config', 'skills-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const skillConstraints = catalog.skills.find((skill) => skill.name === 'skill-constraints');
  const projectSystem = catalog.skills.find((skill) => skill.name === 'aios-project-system');
  const longRunningHarness = catalog.skills.find((skill) => skill.name === 'aios-long-running-harness');
  const contextdbAutopilot = catalog.skills.find((skill) => skill.name === 'contextdb-autopilot');

  assert.equal(skillConstraints.defaultInstall.global, true);
  assert.equal(skillConstraints.defaultInstall.project, false);
  assert.equal(projectSystem.defaultInstall.global, true);
  assert.equal(projectSystem.defaultInstall.project, false);
  assert.equal(longRunningHarness.defaultInstall.global, true);
  assert.equal(longRunningHarness.defaultInstall.project, false);
  assert.equal(contextdbAutopilot.defaultInstall.global, true);
  assert.equal(contextdbAutopilot.defaultInstall.project, false);
});

test('uninstall picker renders only installed skills for current scope and client', () => {
  const state = createInitialState({
    catalogSkills: [
      {
        name: 'find-skills',
        description: 'Discover installable skills.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'xhs-ops-methods',
        description: 'Reusable Xiaohongshu operations workflow.',
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

  let next = reduceState(state, 'down');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');
  for (let index = 0; index < 5; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'space');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.match(output, /find-skills/);
  assert.doesNotMatch(output, /xhs-ops-methods/);
  assert.match(output, /\[ \] find-skills/);
});

test('skill picker renders a windowed list with bulk action rows', () => {
  const state = createInitialState({
    viewportRows: 18,
    catalogSkills: Array.from({ length: 10 }, (_, index) => ({
      name: `skill-${index + 1}`,
      description: `Description ${index + 1}`,
      clients: ['codex'],
      scopes: ['global'],
      defaultInstall: { global: false, project: false },
    })),
    installedSkills: {
      global: {
        codex: Array.from({ length: 10 }, (_, index) => `skill-${index + 1}`),
      },
    },
  });

  let next = reduceState(state, 'down');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');
  for (let index = 0; index < 5; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'space');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.match(output, /Showing 1-5 of 10/);
  assert.match(output, /skill-1/);
  assert.match(output, /skill-5/);
  assert.doesNotMatch(output, /Description 1/);
  assert.doesNotMatch(output, /skill-7/);
  assert.match(output, /Select all/);
  assert.match(output, /Clear all/);
  assert.match(output, /Done/);
});

test('skill picker keeps bulk action rows anchored at the bottom of the viewport', () => {
  const state = createInitialState({
    viewportRows: 18,
    catalogSkills: [
      {
        name: 'skill-1',
        description: 'Description 1',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
      {
        name: 'skill-2',
        description: 'Description 2',
        clients: ['codex'],
        scopes: ['global'],
        defaultInstall: { global: false, project: false },
      },
    ],
    installedSkills: {
      global: {
        codex: ['skill-1', 'skill-2'],
      },
    },
  });

  let next = reduceState(state, 'down');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');
  for (let index = 0; index < 5; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'space');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');

  const lines = renderState(next, '/tmp/project').trimEnd().split('\n');
  assert.equal(lines.at(-1), '  Done');
  assert.equal(lines.at(-2), '  Clear all');
  assert.equal(lines.at(-3), '  Select all');
  assert.equal(lines.at(-4), '');
});

test('setup skill picker marks already installed skills', () => {
  const state = createInitialState({
    catalogSkills: [
      {
        name: 'find-skills',
        description: 'Discover installable skills.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
      },
      {
        name: 'seo-geo-page-optimization',
        description: 'Optimize a page for SEO and GEO.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: false, project: false },
      },
    ],
    installedSkills: {
      global: {
        codex: ['find-skills'],
      },
    },
  });

  let next = reduceState(state, 'enter');
  for (let index = 0; index < 9; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.match(output, /find-skills \(installed\)/);
  assert.doesNotMatch(output, /seo-geo-page-optimization \(installed\)/);
});

test('uninstall skill picker does not duplicate installed markers', () => {
  const state = createInitialState({
    catalogSkills: [
      {
        name: 'find-skills',
        description: 'Discover installable skills.',
        clients: ['codex'],
        scopes: ['global', 'project'],
        defaultInstall: { global: true, project: false },
      },
    ],
    installedSkills: {
      global: {
        codex: ['find-skills'],
      },
    },
  });

  let next = reduceState(state, 'down');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');
  for (let index = 0; index < 5; index += 1) {
    next = reduceState(next, 'down');
  }
  next = reduceState(next, 'space');
  next = reduceState(next, 'down');
  next = reduceState(next, 'enter');

  const output = renderState(next, '/tmp/project');
  assert.doesNotMatch(output, /\(installed\)/);
});
