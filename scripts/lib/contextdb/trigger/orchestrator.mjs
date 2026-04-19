import { detectIntent } from './intent.mjs';
import { classifyComplexity } from './complexity.mjs';
import { evaluatePolicy } from './rl-policy.mjs';

export async function shouldLoadMemory(userInput, { useRL = false } = {}) {
  const intent = detectIntent(userInput);
  if (intent.shouldLoad || intent.reason === 'intent:negative') {
    return intent;
  }

  const complexity = classifyComplexity(userInput);
  if (complexity.shouldLoad) {
    return complexity;
  }

  if (useRL) {
    const policy = await evaluatePolicy(userInput);
    if (policy.shouldLoad) {
      return policy;
    }
  }

  return { shouldLoad: false, reason: 'orchestrator:no-trigger' };
}
