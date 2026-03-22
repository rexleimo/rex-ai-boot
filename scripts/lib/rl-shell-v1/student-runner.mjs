import { parseStudentAction } from './action-protocol.mjs';
import { sampleNextToken } from './student-policy.mjs';

function summarizeEvent(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }
  if (event.observation_event) {
    const observation = event.observation_event;
    return `${observation.action?.action || 'unknown'}:${observation.status}`;
  }
  if (event.action && event.status) {
    return `${event.action}:${event.status}`;
  }
  if (event.payload && typeof event.payload === 'object') {
    return Object.keys(event.payload).slice(0, 2).join(',');
  }
  return '';
}

export function truncateTraceForPrompt(trace, maxEvents = 12) {
  if (!Array.isArray(trace)) {
    return [];
  }
  return trace.slice(Math.max(0, trace.length - maxEvents));
}

export function buildStudentFeatureKey({ trace }) {
  const promptSource = [...trace].reverse().find((entry) => entry?.task_prompt || entry?.taskPrompt || entry?.prompt);
  const failSource = [...trace]
    .reverse()
    .find((entry) => Array.isArray(entry?.baseline_failing_tests) || Array.isArray(entry?.failingTests) || Array.isArray(entry?.tests_after));
  const recentEvents = truncateTraceForPrompt(trace, 3)
    .map(summarizeEvent)
    .filter(Boolean)
    .join(',');

  const prompt = promptSource?.task_prompt || promptSource?.taskPrompt || promptSource?.prompt || 'none';
  const failingTests = failSource?.baseline_failing_tests || failSource?.failingTests || failSource?.tests_after || [];

  return `prompt=${String(prompt).slice(0, 120)}|fail=${failingTests.join(';').slice(0, 120) || 'none'}|obs=${recentEvents || 'none'}`;
}

export async function requestStudentAction({ policy, trace, budget, evaluationMode = false }) {
  if (!budget || Number(budget.remainingSteps || 0) <= 0) {
    return {
      rawOutputText: '',
      tokenIds: [],
      tokenLogprobs: [],
      parsedAction: null,
      stopReason: 'budget_exhausted',
    };
  }

  const featureKey = buildStudentFeatureKey({ trace: truncateTraceForPrompt(trace) });
  const contextTokens = [];
  const tokenIds = [];
  const tokenLogprobs = [];

  for (let index = 0; index < 16; index += 1) {
    const sampled = sampleNextToken(policy, { contextTokens, featureKey, evaluationMode });
    if (!sampled) {
      break;
    }
    contextTokens.push(sampled.token);
    tokenIds.push(sampled.tokenId);
    tokenLogprobs.push(sampled.logprob);
    if (sampled.token === '}') {
      break;
    }
  }

  const rawOutputText = contextTokens.join('');
  let parsedAction = null;
  let stopReason = 'parse_failed';

  try {
    parsedAction = parseStudentAction(rawOutputText);
    stopReason = parsedAction.action === 'stop' ? 'student_stop' : 'action_emitted';
  } catch {
    parsedAction = null;
  }

  return {
    rawOutputText,
    tokenIds,
    tokenLogprobs,
    parsedAction,
    stopReason,
    featureKey,
  };
}
