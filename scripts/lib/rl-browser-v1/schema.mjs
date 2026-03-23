function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNoUnknownKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown key: ${key}`);
    }
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertNullableString(value, label) {
  if (value === null) {
    return;
  }
  assertString(value, label);
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${label} must be an integer >= ${min}`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function assertStringArray(value, label) {
  assertArray(value, label);
  for (const [index, item] of value.entries()) {
    assertString(item, `${label}[${index}]`);
  }
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`${label} must be one of: ${Array.from(allowed).join(', ')}`);
  }
}

const FORM_STATES = new Set(['pristine', 'dirty', 'submitted', 'locked']);
const NAVIGATION_RESULTS = new Set(['same-page', 'navigated', 'success-page', 'blocked']);
const AUTH_STATES = new Set(['authenticated', 'login_required', 'reauth_required', 'unknown']);
const CHALLENGE_STATES = new Set(['none', 'challenge', 'blocked']);
const TERMINAL_STATUSES = new Set(['success', 'auth_required', 'challenge', 'validation_error', 'stalled', 'failed']);
const EXPLORATION_MODES = new Set(['controlled', 'open-ended']);

export function validateBrowserTask(raw) {
  assertObject(raw, 'browser task');
  assertNoUnknownKeys(
    raw,
    [
      'task_id',
      'target_site',
      'flow_id',
      'start_url',
      'comparison_start_url',
      'success_selector',
      'challenge_selector',
      'auth_state_class',
      'input_payload',
      'exploration_mode',
      'sensitive_action_flag',
      'flow_constraints',
      'requireHumanReauth',
      'forceChallengeDivergenceTwice',
    ],
    'browser task'
  );
  assertString(raw.task_id, 'browser task.task_id');
  assertString(raw.target_site ?? 'unknown.local', 'browser task.target_site');
  assertString(raw.flow_id, 'browser task.flow_id');
  assertString(raw.start_url, 'browser task.start_url');
  assertString(raw.comparison_start_url || raw.start_url, 'browser task.comparison_start_url');
  assertString(raw.success_selector, 'browser task.success_selector');
  assertString(raw.challenge_selector, 'browser task.challenge_selector');
  assertString(raw.auth_state_class || 'authenticated', 'browser task.auth_state_class');
  assertObject(raw.input_payload || {}, 'browser task.input_payload');
  assertEnum(raw.exploration_mode || 'controlled', EXPLORATION_MODES, 'browser task.exploration_mode');
  assertBoolean(Boolean(raw.sensitive_action_flag), 'browser task.sensitive_action_flag');
  if (raw.flow_constraints !== null && raw.flow_constraints !== undefined) {
    assertStringArray(raw.flow_constraints, 'browser task.flow_constraints');
  }
  assertBoolean(Boolean(raw.requireHumanReauth), 'browser task.requireHumanReauth');
  assertBoolean(Boolean(raw.forceChallengeDivergenceTwice), 'browser task.forceChallengeDivergenceTwice');
  return {
    ...raw,
    target_site: raw.target_site ?? 'unknown.local',
    comparison_start_url: raw.comparison_start_url || raw.start_url,
    auth_state_class: raw.auth_state_class || 'authenticated',
    input_payload: raw.input_payload || {},
    exploration_mode: raw.exploration_mode || 'controlled',
    sensitive_action_flag: Boolean(raw.sensitive_action_flag),
    flow_constraints: raw.flow_constraints ?? [],
    requireHumanReauth: Boolean(raw.requireHumanReauth),
    forceChallengeDivergenceTwice: Boolean(raw.forceChallengeDivergenceTwice),
  };
}

export function validateBrowserEvidence(raw) {
  assertObject(raw, 'browser evidence');
  assertNoUnknownKeys(
    raw,
    [
      'page_kind',
      'key_selectors_present',
      'form_state',
      'action_taken',
      'navigation_result',
      'form_error',
      'auth_state',
      'challenge_state',
      'sensitive_action_flag',
      'terminal_status',
    ],
    'browser evidence'
  );
  assertString(raw.page_kind, 'browser evidence.page_kind');
  assertStringArray(raw.key_selectors_present, 'browser evidence.key_selectors_present');
  assertEnum(raw.form_state, FORM_STATES, 'browser evidence.form_state');
  assertString(raw.action_taken, 'browser evidence.action_taken');
  assertEnum(raw.navigation_result, NAVIGATION_RESULTS, 'browser evidence.navigation_result');
  assertNullableString(raw.form_error, 'browser evidence.form_error');
  assertEnum(raw.auth_state, AUTH_STATES, 'browser evidence.auth_state');
  assertEnum(raw.challenge_state, CHALLENGE_STATES, 'browser evidence.challenge_state');
  assertBoolean(raw.sensitive_action_flag, 'browser evidence.sensitive_action_flag');
  assertEnum(raw.terminal_status, TERMINAL_STATUSES, 'browser evidence.terminal_status');
  return raw;
}

export function validateBrowserHoldoutResult(raw) {
  assertObject(raw, 'browser holdout result');
  assertNoUnknownKeys(
    raw,
    ['episode_count', 'success_rate', 'comparison_failed_rate', 'schema_validation_failures'],
    'browser holdout result'
  );
  assertInteger(raw.episode_count, 'browser holdout result.episode_count', { min: 0 });
  assertNumber(raw.success_rate, 'browser holdout result.success_rate');
  assertNumber(raw.comparison_failed_rate, 'browser holdout result.comparison_failed_rate');
  assertInteger(raw.schema_validation_failures, 'browser holdout result.schema_validation_failures', { min: 0 });
  return raw;
}

