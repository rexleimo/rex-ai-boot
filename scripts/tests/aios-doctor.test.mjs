import assert from 'node:assert/strict';
import test from 'node:test';

import { countEffectiveWarnLines } from '../lib/doctor/aggregate.mjs';

test('countEffectiveWarnLines ignores missing codex/claude/gemini path warnings', () => {
  const count = countEffectiveWarnLines([
    '[warn] codex not found in PATH',
    '[warn] claude not found in PATH',
    '[warn] gemini not found in PATH',
  ]);
  assert.equal(count, 0);
});

test('countEffectiveWarnLines counts actionable warnings', () => {
  const count = countEffectiveWarnLines([
    '[warn] rc file not found: /tmp/.zshrc',
    '[warn] CODEX_HOME directory does not exist (/tmp/.codex)',
  ]);
  assert.equal(count, 2);
});
