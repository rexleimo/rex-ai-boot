import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyComplexity } from '../lib/contextdb/trigger/complexity.mjs';

test('high score for multi-step + cross-domain', () => {
  const r = classifyComplexity('First do X, then Y. We need frontend and backend changes.');
  assert.ok(r.score >= 40);
  assert.equal(r.shouldLoad, true);
  assert.equal(r.reason, 'complexity:high');
});

test('medium score for blueprint keyword only', () => {
  const r = classifyComplexity('Implement this feature');
  assert.ok(r.score >= 15 && r.score < 40);
  assert.equal(r.shouldLoad, false);
  assert.equal(r.reason, 'complexity:low');
});

test('high score for orchestrate/team language', () => {
  const r = classifyComplexity('Please orchestrate a team to fix the bug and write doc and test');
  assert.ok(r.score >= 40);
  assert.equal(r.shouldLoad, true);
});

test('zero score for simple prompt', () => {
  const r = classifyComplexity('hello');
  assert.equal(r.score, 0);
  assert.equal(r.shouldLoad, false);
});
