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
  assert.match(output, /seo-geo-page-optimization/);
  assert.match(output, /Optimize a page for SEO and GEO\./);
  assert.match(output, /skill-constraints/);
  assert.match(output, /Operational constraints and best practices for skill execution\./);
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
