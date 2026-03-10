import path from 'node:path';

import {
  createDefaultQualityGateOptions,
  normalizeHarnessProfile,
  normalizeQualityGateMode,
} from './options.mjs';
import { getDisabledGateIds, isHarnessGateEnabled } from '../harness/profile.mjs';
import { persistQualityGateEvidence } from '../harness/verification-evidence.mjs';
import { captureCommand } from '../platform/process.mjs';

const LOG_AUDIT_TARGETS = ['scripts', 'mcp-server/src'];
const LOG_AUDIT_EXCLUDE_GLOBS = [
  '!scripts/tests/**',
  '!scripts/contextdb-shell-bridge.mjs',
  '!scripts/ctx-agent-core.mjs',
  '!scripts/doctor-bootstrap-task.mjs',
  '!scripts/lib/lifecycle/quality-gate.mjs',
  '!mcp-server/src/contextdb/cli.ts',
];
const QUALITY_FAILURE_CATEGORY_BY_LABEL = {
  Build: 'quality-build',
  Types: 'quality-types',
  ContextDB: 'quality-contextdb',
  Scripts: 'quality-scripts',
  Logs: 'quality-logs',
  Security: 'quality-security',
  Git: 'quality-git',
};

function summarizeCommandResult(result) {
  return result.status === 0 ? 'OK' : 'FAIL';
}

function countNonEmptyLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .length;
}

function runCheck(command, args, options = {}) {
  return captureCommand(command, args, options);
}

function auditConsoleLogs(rootDir, { checkRunner = runCheck } = {}) {
  const args = ['-n'];
  for (const glob of LOG_AUDIT_EXCLUDE_GLOBS) {
    args.push('-g', glob);
  }
  args.push('console\\.log', ...LOG_AUDIT_TARGETS);
  return checkRunner('rg', args, { cwd: rootDir });
}

function summarizeGitStatus(rootDir, { checkRunner = runCheck } = {}) {
  return checkRunner('git', ['status', '--short'], {
    cwd: rootDir,
  });
}

function extractFailedChecks(results = []) {
  return results
    .filter((item) => item.status === 'FAIL')
    .map((item) => item.label)
    .filter(Boolean);
}

function deriveQualityFailureCategory(results = []) {
  const categories = [...new Set(
    extractFailedChecks(results)
      .map((label) => QUALITY_FAILURE_CATEGORY_BY_LABEL[label])
      .filter(Boolean)
  )];

  if (categories.length === 0) {
    return undefined;
  }

  return categories.length === 1 ? categories[0] : 'quality-multi';
}

export function normalizeQualityGateOptions(rawOptions = {}) {
  const defaults = createDefaultQualityGateOptions();
  return {
    mode: normalizeQualityGateMode(rawOptions.mode ?? defaults.mode),
    profile: normalizeHarnessProfile(rawOptions.profile ?? defaults.profile),
    globalSecurity: Boolean(rawOptions.globalSecurity ?? defaults.globalSecurity),
    sessionId: String(rawOptions.sessionId ?? defaults.sessionId ?? '').trim(),
  };
}

export function planQualityGate(rawOptions = {}) {
  const options = normalizeQualityGateOptions(rawOptions);
  const args = ['quality-gate', options.mode];
  if (options.profile !== 'standard') args.push('--profile', options.profile);
  if (options.globalSecurity) args.push('--global-security');
  if (options.sessionId) args.push('--session', options.sessionId);
  return {
    command: 'quality-gate',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runQualityGate(
  rawOptions = {},
  {
    rootDir,
    io = console,
    env = process.env,
    checkRunner = runCheck,
    persistVerification = persistQualityGateEvidence,
  } = {}
) {
  const startedAt = Date.now();
  const { options } = planQualityGate(rawOptions);
  const disabledGates = getDisabledGateIds(env);
  const mcpDir = path.join(rootDir, 'mcp-server');
  const results = [];

  io.log(`QUALITY GATE: ${options.mode.toUpperCase()}`);
  io.log('--------------------------');
  io.log(`Profile: ${options.profile}`);

  if (isHarnessGateEnabled('quality:build', { profile: options.profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const result = checkRunner('npm', ['run', 'build'], { cwd: mcpDir });
    results.push({ label: 'Build', status: summarizeCommandResult(result), detail: result.stderr || result.stdout });
  } else {
    results.push({ label: 'Build', status: 'SKIP', detail: 'disabled by profile/gates' });
  }

  if (isHarnessGateEnabled('quality:types', { profile: options.profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const result = checkRunner('npm', ['run', 'typecheck'], { cwd: mcpDir });
    results.push({ label: 'Types', status: summarizeCommandResult(result), detail: result.stderr || result.stdout });
  } else {
    results.push({ label: 'Types', status: 'SKIP', detail: 'disabled by profile/gates' });
  }

  if (options.mode !== 'quick') {
    if (isHarnessGateEnabled('quality:scripts', { profile: options.profile, disabledGates, profiles: ['standard', 'strict'] })) {
      const result = checkRunner('npm', ['run', 'test:scripts'], { cwd: rootDir });
      results.push({ label: 'Scripts', status: summarizeCommandResult(result), detail: result.stderr || result.stdout });
    } else {
      results.push({ label: 'Scripts', status: 'SKIP', detail: 'disabled by profile/gates' });
    }

    if (isHarnessGateEnabled('quality:contextdb', { profile: options.profile, disabledGates, profiles: ['standard', 'strict'] })) {
      const result = checkRunner('npm', ['run', 'test:contextdb'], { cwd: mcpDir });
      results.push({ label: 'ContextDB', status: summarizeCommandResult(result), detail: result.stderr || result.stdout });
    } else {
      results.push({ label: 'ContextDB', status: 'SKIP', detail: 'disabled by profile/gates' });
    }

    if (isHarnessGateEnabled('quality:logs', { profile: options.profile, disabledGates, profiles: ['standard', 'strict'] })) {
      const result = auditConsoleLogs(rootDir, { checkRunner });
      if (result.status === 0) {
        const count = countNonEmptyLines(result.stdout);
        results.push({
          label: 'Logs',
          status: count === 0 ? 'OK' : 'FAIL',
          detail: count === 0 ? '0 console.log hits' : `${count} console.log hits`,
        });
      } else if (result.status === 1) {
        results.push({ label: 'Logs', status: 'OK', detail: '0 console.log hits' });
      } else {
        const detail = (result.error?.message || result.stderr || result.stdout || `rg exit=${result.status}`).trim();
        results.push({ label: 'Logs', status: 'FAIL', detail });
      }
    } else {
      results.push({ label: 'Logs', status: 'SKIP', detail: 'disabled by profile/gates' });
    }
  }

  if (options.mode === 'pre-pr') {
    if (isHarnessGateEnabled('quality:security', { profile: options.profile, disabledGates, profiles: ['standard', 'strict'] })) {
      const args = ['scripts/doctor-security-config.mjs', '--workspace', rootDir];
      if (options.globalSecurity) args.push('--global');
      const result = checkRunner(process.execPath, args, { cwd: rootDir });
      results.push({ label: 'Security', status: summarizeCommandResult(result), detail: result.stderr || result.stdout });
    } else {
      results.push({ label: 'Security', status: 'SKIP', detail: 'disabled by profile/gates' });
    }
  }

  if (isHarnessGateEnabled('quality:git', { profile: options.profile, disabledGates, profiles: ['minimal', 'standard', 'strict'] })) {
    const result = summarizeGitStatus(rootDir, { checkRunner });
    const changedCount = countNonEmptyLines(result.stdout);
    results.push({
      label: 'Git',
      status: result.status === 0 ? 'OK' : 'FAIL',
      detail: changedCount === 0 ? 'clean working tree' : `${changedCount} changed paths`,
    });
  } else {
    results.push({ label: 'Git', status: 'SKIP', detail: 'disabled by profile/gates' });
  }

  let failed = false;
  for (const result of results) {
    io.log(`${result.label}: ${result.status} ${result.detail ? `- ${String(result.detail).split(/\r?\n/)[0]}` : ''}`.trim());
    if (result.status === 'FAIL') {
      failed = true;
    }
  }

  io.log('');
  io.log(`Ready for PR: ${failed ? 'NO' : 'YES'}`);

  const failedChecks = extractFailedChecks(results);
  const report = {
    ok: !failed,
    exitCode: failed ? 1 : 0,
    results,
    failedChecks,
    failureCategory: deriveQualityFailureCategory(results),
    profile: options.profile,
    mode: options.mode,
    sessionId: options.sessionId,
  };

  if (options.sessionId) {
    report.verificationEvidence = await persistVerification({
      rootDir,
      sessionId: options.sessionId,
      report,
      elapsedMs: Date.now() - startedAt,
    });
  }

  return report;
}
