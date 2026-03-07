import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHybridLayoutModel } from '../src/browser/actions/snapshot.js';

test('buildHybridLayoutModel returns compact layout regions for editor-like pages', () => {
  const result = buildHybridLayoutModel({
    title: 'Create post',
    url: 'https://social.example.com/publish',
    viewport: { width: 1440, height: 900 },
    textSample: 'Create a new post\nDraft saved\nPublish',
    stats: {
      imageCount: 2,
      canvasCount: 0,
      modalCount: 0,
      textNodeCount: 5,
      interactiveCount: 4,
    },
    elements: [
      {
        role: 'button',
        tag: 'button',
        text: 'Publish',
        selectorHint: '#publish',
        clickable: true,
        x: 1260,
        y: 24,
        width: 120,
        height: 40,
        zIndex: 10,
      },
      {
        role: 'textbox',
        tag: 'textarea',
        text: 'Write your post',
        selectorHint: 'textarea.compose',
        clickable: true,
        x: 280,
        y: 180,
        width: 760,
        height: 260,
        zIndex: 1,
      },
      {
        role: 'navigation',
        tag: 'nav',
        text: 'Home Analytics Posts',
        selectorHint: 'nav.sidebar',
        clickable: false,
        x: 0,
        y: 90,
        width: 220,
        height: 760,
        zIndex: 1,
      },
    ],
    textBlocks: [
      {
        text: 'Create a new post',
        x: 280,
        y: 120,
        width: 300,
        height: 30,
      },
    ],
  });

  assert.equal(result.pageSummary.pageType, 'editor');
  assert.equal(result.visualHints.needsVisualFallback, false);
  assert.equal(result.regions.some((region) => region.name === 'header'), true);
  assert.equal(result.regions.some((region) => region.name === 'left-sidebar'), true);
  assert.equal(result.regions.some((region) => region.name === 'main'), true);
  assert.equal(result.elements.some((element) => element.selectorHint === '#publish'), true);
});

test('buildHybridLayoutModel requests visual fallback for canvas-heavy modal pages', () => {
  const result = buildHybridLayoutModel({
    title: 'Verification',
    url: 'https://visual.example.com/challenge',
    viewport: { width: 1280, height: 720 },
    textSample: '',
    stats: {
      imageCount: 8,
      canvasCount: 1,
      modalCount: 1,
      textNodeCount: 0,
      interactiveCount: 1,
    },
    elements: [
      {
        role: 'button',
        tag: 'button',
        text: 'Verify',
        selectorHint: '.verify',
        clickable: true,
        x: 540,
        y: 470,
        width: 180,
        height: 48,
        zIndex: 200,
      },
    ],
    textBlocks: [],
  });

  assert.equal(result.visualHints.needsVisualFallback, true);
  assert.match(result.visualHints.reason, /canvas|visual|modal/i);
  assert.equal(result.regions.some((region) => region.name === 'modal'), true);
});
