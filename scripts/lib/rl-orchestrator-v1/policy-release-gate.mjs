import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function computeHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return min;
  }
  return Math.min(max, Math.max(min, normalized));
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeMode(value = 'legacy') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['legacy', 'off', 'observe', 'canary', 'full'].includes(normalized)) {
    return normalized;
  }
  return 'legacy';
}

function safePositiveInteger(value, fallback) {
  const normalized = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }
  return normalized;
}

export function normalizePolicyReleaseConfig({
  policyRelease = null,
  rootDir = process.cwd(),
  requestedExecutionMode = 'dry-run',
  env = process.env,
} = {}) {
  if (!policyRelease || typeof policyRelease !== 'object' || Array.isArray(policyRelease)) {
    return {
      enabled: false,
      mode: 'legacy',
      requested_execution_mode: String(requestedExecutionMode || 'dry-run'),
      policy_execution_mode: String(requestedExecutionMode || 'dry-run'),
      baseline_execution_mode: 'dry-run',
      rollout_rate: 1,
      kill_switch_env_key: 'AIOS_RL_POLICY_RELEASE_OFF',
      kill_switch_file: '',
      auto_downgrade: false,
      downgrade_failure_rate_threshold: 0.6,
      downgrade_consecutive_failures: 3,
      downgrade_min_samples: 6,
      downgrade_rollout_factor: 0.5,
      downgrade_min_rollout_rate: 0.05,
      eval_window_size: 24,
      state_path: path.join(rootDir, 'experiments', 'rl-mixed-v1', 'release', 'orchestrator-policy-release.state.json'),
      env,
    };
  }

  const requested = String(requestedExecutionMode || 'dry-run').trim() || 'dry-run';
  const mode = normalizeMode(policyRelease.mode || 'canary');
  const statePath = String(policyRelease.statePath || '').trim();

  return {
    enabled: true,
    mode,
    requested_execution_mode: requested,
    policy_execution_mode: String(policyRelease.policyExecutionMode || requested).trim() || requested,
    baseline_execution_mode: String(policyRelease.baselineExecutionMode || 'dry-run').trim() || 'dry-run',
    rollout_rate: clamp(policyRelease.rolloutRate ?? 0.1, 0, 1),
    kill_switch_env_key: String(policyRelease.killSwitchEnvKey || 'AIOS_RL_POLICY_RELEASE_OFF').trim() || 'AIOS_RL_POLICY_RELEASE_OFF',
    kill_switch_file: String(policyRelease.killSwitchFile || '').trim(),
    auto_downgrade: policyRelease.autoDowngrade !== false,
    downgrade_failure_rate_threshold: clamp(policyRelease.downgradeFailureRateThreshold ?? 0.6, 0.05, 1),
    downgrade_consecutive_failures: safePositiveInteger(policyRelease.downgradeConsecutiveFailures, 3),
    downgrade_min_samples: safePositiveInteger(policyRelease.downgradeMinSamples, 6),
    downgrade_rollout_factor: clamp(policyRelease.downgradeRolloutFactor ?? 0.5, 0.1, 0.95),
    downgrade_min_rollout_rate: clamp(policyRelease.downgradeMinRolloutRate ?? 0.05, 0, 0.5),
    eval_window_size: safePositiveInteger(policyRelease.evalWindowSize, 24),
    state_path: statePath || path.join(rootDir, 'experiments', 'rl-mixed-v1', 'release', 'orchestrator-policy-release.state.json'),
    env,
  };
}

function createDefaultState(config) {
  return {
    schema_version: 1,
    updated_at: null,
    effective_mode: config.mode,
    effective_rollout_rate: config.rollout_rate,
    counters: {
      total: 0,
      policy_applied: 0,
      baseline_routed: 0,
      policy_fallback: 0,
      policy_success: 0,
      policy_failure: 0,
      consecutive_policy_failures: 0,
      consecutive_policy_success: 0,
      downgrades: 0,
    },
    recent: [],
    last_downgrade_reason: null,
  };
}

function normalizeState(raw, config) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : createDefaultState(config);
  const counters = source.counters && typeof source.counters === 'object' && !Array.isArray(source.counters)
    ? source.counters
    : {};
  const recent = Array.isArray(source.recent)
    ? source.recent
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        return {
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString(),
          policy_applied: entry.policy_applied === true,
          policy_requested: entry.policy_requested === true,
          policy_fallback: entry.policy_fallback === true,
          success: entry.success === true,
          failed: entry.failed === true,
        };
      })
      .filter(Boolean)
      .slice(-config.eval_window_size)
    : [];

  return {
    schema_version: 1,
    updated_at: typeof source.updated_at === 'string' ? source.updated_at : null,
    effective_mode: normalizeMode(source.effective_mode || config.mode),
    effective_rollout_rate: clamp(source.effective_rollout_rate ?? config.rollout_rate, 0, 1),
    counters: {
      total: Number(counters.total || 0),
      policy_applied: Number(counters.policy_applied || 0),
      baseline_routed: Number(counters.baseline_routed || 0),
      policy_fallback: Number(counters.policy_fallback || 0),
      policy_success: Number(counters.policy_success || 0),
      policy_failure: Number(counters.policy_failure || 0),
      consecutive_policy_failures: Number(counters.consecutive_policy_failures || 0),
      consecutive_policy_success: Number(counters.consecutive_policy_success || 0),
      downgrades: Number(counters.downgrades || 0),
    },
    recent,
    last_downgrade_reason: typeof source.last_downgrade_reason === 'string'
      ? source.last_downgrade_reason
      : null,
  };
}

async function readJsonObject(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

export async function loadPolicyReleaseState(config) {
  const state = await readJsonObject(config.state_path);
  return normalizeState(state, config);
}

export async function writePolicyReleaseState(config, state) {
  await mkdir(path.dirname(config.state_path), { recursive: true });
  await writeFile(config.state_path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function isKillSwitchActive(config) {
  const envKey = String(config.kill_switch_env_key || '').trim();
  if (envKey && parseBoolean(config.env?.[envKey], false)) {
    return true;
  }
  const filePath = String(config.kill_switch_file || '').trim();
  if (!filePath) {
    return false;
  }
  try {
    const content = String(await readFile(filePath, 'utf8')).trim().toLowerCase();
    if (!content) return true;
    return parseBoolean(content, true);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

function computeCanaryBucket({ taskId = '', checkpointId = '', attempt = 0 } = {}) {
  const hash = computeHash(`${taskId}:${checkpointId}:${attempt}`);
  return (hash % 10000) / 10000;
}

export async function decidePolicyReleaseRoute({
  config,
  state,
  taskId = '',
  checkpointId = '',
  attempt = 0,
  selectedExecutor = null,
} = {}) {
  const candidateExecutor = typeof selectedExecutor === 'string' && selectedExecutor.trim().length > 0
    ? selectedExecutor.trim()
    : null;
  if (!config.enabled) {
    return {
      mode: 'legacy',
      effective_mode: 'legacy',
      apply_policy_executor: Boolean(candidateExecutor),
      applied_executor: candidateExecutor,
      candidate_executor: candidateExecutor,
      execution_mode: config.requested_execution_mode,
      rollout_rate: 1,
      reason: candidateExecutor ? 'legacy_passthrough' : 'no_candidate_executor',
      downgraded: false,
    };
  }

  const killSwitch = await isKillSwitchActive(config);
  const effectiveMode = killSwitch ? 'off' : normalizeMode(state.effective_mode || config.mode);
  const rolloutRate = clamp(state.effective_rollout_rate ?? config.rollout_rate, 0, 1);

  if (!candidateExecutor) {
    return {
      mode: config.mode,
      effective_mode: effectiveMode,
      apply_policy_executor: false,
      applied_executor: null,
      candidate_executor: null,
      execution_mode: config.baseline_execution_mode,
      rollout_rate: rolloutRate,
      reason: 'no_candidate_executor',
      downgraded: false,
    };
  }

  if (effectiveMode === 'off') {
    return {
      mode: config.mode,
      effective_mode: effectiveMode,
      apply_policy_executor: false,
      applied_executor: null,
      candidate_executor: candidateExecutor,
      execution_mode: config.baseline_execution_mode,
      rollout_rate: rolloutRate,
      reason: killSwitch ? 'kill_switch_active' : 'mode_off',
      downgraded: false,
    };
  }

  if (effectiveMode === 'observe') {
    return {
      mode: config.mode,
      effective_mode: effectiveMode,
      apply_policy_executor: false,
      applied_executor: null,
      candidate_executor: candidateExecutor,
      execution_mode: config.baseline_execution_mode,
      rollout_rate: rolloutRate,
      reason: 'observe_mode',
      downgraded: false,
    };
  }

  if (effectiveMode === 'full') {
    return {
      mode: config.mode,
      effective_mode: effectiveMode,
      apply_policy_executor: true,
      applied_executor: candidateExecutor,
      candidate_executor: candidateExecutor,
      execution_mode: config.policy_execution_mode,
      rollout_rate: 1,
      reason: 'full_mode',
      downgraded: false,
    };
  }

  const bucket = computeCanaryBucket({
    taskId,
    checkpointId,
    attempt,
  });
  const apply = bucket < rolloutRate;
  return {
    mode: config.mode,
    effective_mode: effectiveMode,
    apply_policy_executor: apply,
    applied_executor: apply ? candidateExecutor : null,
    candidate_executor: candidateExecutor,
    execution_mode: apply ? config.policy_execution_mode : config.baseline_execution_mode,
    rollout_rate: rolloutRate,
    canary_bucket: bucket,
    reason: apply ? 'canary_sampled' : 'canary_holdout',
    downgraded: false,
  };
}

function calculatePolicyFailureRate(recent = []) {
  const policyRows = recent.filter((row) => row.policy_applied === true);
  if (policyRows.length === 0) {
    return 0;
  }
  const failureCount = policyRows.filter((row) => row.failed === true).length;
  return failureCount / policyRows.length;
}

function resolvePolicyExecutorEffectiveness({ decision, evidence } = {}) {
  if (decision?.apply_policy_executor !== true) {
    return false;
  }

  const routedExecutor = typeof decision.applied_executor === 'string' && decision.applied_executor.trim().length > 0
    ? decision.applied_executor.trim()
    : '';
  if (!routedExecutor) {
    return true;
  }

  const appliedExecutor = typeof evidence?.decision_payload?.dispatch_phase_executor_applied === 'string'
    ? evidence.decision_payload.dispatch_phase_executor_applied.trim()
    : '';
  if (!appliedExecutor) {
    return true;
  }

  return appliedExecutor === routedExecutor;
}

function downgradeState(state, config, reason) {
  const next = {
    ...state,
    counters: {
      ...state.counters,
      downgrades: Number(state.counters.downgrades || 0) + 1,
      consecutive_policy_failures: 0,
    },
    last_downgrade_reason: reason,
  };

  if (next.effective_mode === 'full') {
    next.effective_mode = 'canary';
    next.effective_rollout_rate = clamp(config.rollout_rate, config.downgrade_min_rollout_rate, 1);
    return next;
  }

  if (next.effective_mode === 'canary') {
    const reduced = next.effective_rollout_rate * config.downgrade_rollout_factor;
    if (reduced <= config.downgrade_min_rollout_rate) {
      next.effective_mode = 'observe';
      next.effective_rollout_rate = 0;
    } else {
      next.effective_rollout_rate = clamp(reduced, config.downgrade_min_rollout_rate, 1);
    }
    return next;
  }

  next.effective_mode = 'observe';
  next.effective_rollout_rate = 0;
  return next;
}

export function updatePolicyReleaseState({
  config,
  state,
  decision,
  evidence,
} = {}) {
  const next = normalizeState(state, config);
  const success = evidence?.terminal_outcome === 'success' && evidence?.verification_result === 'passed';
  const failed = evidence?.terminal_outcome === 'failed'
    || evidence?.verification_result === 'failed'
    || evidence?.verification_result === 'blocked';
  const policyRequested = decision.apply_policy_executor === true;
  const policyAppliedEffective = resolvePolicyExecutorEffectiveness({ decision, evidence });

  next.updated_at = new Date().toISOString();
  next.counters.total += 1;

  if (policyAppliedEffective) {
    next.counters.policy_applied += 1;
    if (success) {
      next.counters.policy_success += 1;
      next.counters.consecutive_policy_success += 1;
      next.counters.consecutive_policy_failures = 0;
    }
    if (failed) {
      next.counters.policy_failure += 1;
      next.counters.consecutive_policy_failures += 1;
      next.counters.consecutive_policy_success = 0;
    }
  } else {
    next.counters.baseline_routed += 1;
    if (policyRequested) {
      next.counters.policy_fallback += 1;
    }
  }

  next.recent.push({
    timestamp: next.updated_at,
    policy_applied: policyAppliedEffective,
    policy_requested: policyRequested,
    policy_fallback: policyRequested && !policyAppliedEffective,
    success,
    failed,
  });
  next.recent = next.recent.slice(-config.eval_window_size);

  let downgraded = false;
  if (config.auto_downgrade && decision.apply_policy_executor) {
    const failureRate = calculatePolicyFailureRate(next.recent);
    const policySampleCount = next.recent.filter((row) => row.policy_applied).length;
    const consecutiveFail = next.counters.consecutive_policy_failures;
    const shouldDowngradeByRate = policySampleCount >= config.downgrade_min_samples
      && failureRate >= config.downgrade_failure_rate_threshold;
    const shouldDowngradeByStreak = consecutiveFail >= config.downgrade_consecutive_failures;

    if (shouldDowngradeByRate || shouldDowngradeByStreak) {
      const reason = shouldDowngradeByStreak
        ? `consecutive_policy_failures=${consecutiveFail}`
        : `policy_failure_rate=${failureRate.toFixed(3)}`;
      const downgradedState = downgradeState(next, config, reason);
      downgradedState.updated_at = next.updated_at;
      return {
        state: downgradedState,
        downgraded: true,
        downgrade_reason: reason,
      };
    }
  }

  return {
    state: next,
    downgraded,
    downgrade_reason: null,
  };
}
