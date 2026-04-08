import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseArgs } from '../lib/cli/parse-args.mjs';

test('parseArgs returns interactive mode when no args are provided', () => {
  const result = parseArgs([]);
  assert.equal(result.mode, 'interactive');
  assert.equal(result.command, 'tui');
});

test('parseArgs normalizes setup options', () => {
  const result = parseArgs(['setup', '--components', 'all', '--mode', 'opt-in', '--client', 'all']);
  assert.equal(result.mode, 'command');
  assert.equal(result.command, 'setup');
  assert.deepEqual(result.options.components, ['all']);
  assert.equal(result.options.wrapMode, 'opt-in');
  assert.equal(result.options.client, 'all');
});

test('parseArgs accepts skills scope and selected skill names', () => {
  const result = parseArgs([
    'setup',
    '--components',
    'skills',
    '--client',
    'codex',
    '--scope',
    'project',
    '--skills',
    'find-skills,xhs-ops-methods',
  ]);
  assert.equal(result.command, 'setup');
  assert.equal(result.options.client, 'codex');
  assert.equal(result.options.scope, 'project');
  assert.deepEqual(result.options.skills, ['find-skills', 'xhs-ops-methods']);
});

test('parseArgs accepts install mode for skills workflows', () => {
  const setupResult = parseArgs([
    'setup',
    '--components',
    'skills',
    '--client',
    'codex',
    '--install-mode',
    'link',
  ]);
  assert.equal(setupResult.command, 'setup');
  assert.equal(setupResult.options.installMode, 'link');

  const updateResult = parseArgs([
    'update',
    '--components',
    'skills',
    '--client',
    'codex',
    '--install-mode',
    'copy',
  ]);
  assert.equal(updateResult.command, 'update');
  assert.equal(updateResult.options.installMode, 'copy');

  const internalResult = parseArgs([
    'internal',
    'skills',
    'install',
    '--client',
    'codex',
    '--install-mode',
    'link',
  ]);
  assert.equal(internalResult.command, 'internal');
  assert.equal(internalResult.options.target, 'skills');
  assert.equal(internalResult.options.installMode, 'link');
});

test('parseArgs accepts internal browser cdp lifecycle actions', () => {
  const start = parseArgs(['internal', 'browser', 'cdp-start']);
  assert.equal(start.command, 'internal');
  assert.equal(start.options.target, 'browser');
  assert.equal(start.options.action, 'cdp-start');

  const doctorFix = parseArgs(['internal', 'browser', 'doctor', '--fix', '--dry-run']);
  assert.equal(doctorFix.command, 'internal');
  assert.equal(doctorFix.options.target, 'browser');
  assert.equal(doctorFix.options.action, 'doctor');
  assert.equal(doctorFix.options.fix, true);
  assert.equal(doctorFix.options.dryRun, true);

  const status = parseArgs(['internal', 'browser', 'cdp-status']);
  assert.equal(status.command, 'internal');
  assert.equal(status.options.target, 'browser');
  assert.equal(status.options.action, 'cdp-status');

  const restart = parseArgs(['internal', 'browser', 'cdp-restart', '--help']);
  assert.equal(restart.command, 'internal');
  assert.equal(restart.mode, 'help');
  assert.equal(restart.options.target, 'browser');
  assert.equal(restart.options.action, 'cdp-restart');
});

test('parseArgs accepts native component, internal native target, and native-only doctor flags', () => {
  const setupResult = parseArgs([
    'setup',
    '--components',
    'shell,native',
    '--client',
    'claude',
  ]);
  assert.equal(setupResult.command, 'setup');
  assert.deepEqual(setupResult.options.components, ['shell', 'native']);
  assert.equal(setupResult.options.client, 'claude');

  const internalResult = parseArgs([
    'internal',
    'native',
    'install',
    '--client',
    'codex',
  ]);
  assert.equal(internalResult.command, 'internal');
  assert.equal(internalResult.options.target, 'native');
  assert.equal(internalResult.options.client, 'codex');

  const doctorResult = parseArgs(['doctor', '--native', '--verbose', '--fix', '--dry-run']);
  assert.equal(doctorResult.command, 'doctor');
  assert.equal(doctorResult.options.nativeOnly, true);
  assert.equal(doctorResult.options.verbose, true);
  assert.equal(doctorResult.options.fix, true);
  assert.equal(doctorResult.options.dryRun, true);

  const internalDoctor = parseArgs(['internal', 'native', 'doctor', '--verbose', '--fix', '--dry-run']);
  assert.equal(internalDoctor.command, 'internal');
  assert.equal(internalDoctor.options.target, 'native');
  assert.equal(internalDoctor.options.action, 'doctor');
  assert.equal(internalDoctor.options.verbose, true);
  assert.equal(internalDoctor.options.fix, true);
  assert.equal(internalDoctor.options.dryRun, true);

  const internalRollback = parseArgs(['internal', 'native', 'rollback', '--repair-id', 'latest', '--dry-run']);
  assert.equal(internalRollback.command, 'internal');
  assert.equal(internalRollback.options.target, 'native');
  assert.equal(internalRollback.options.action, 'rollback');
  assert.equal(internalRollback.options.repairId, 'latest');
  assert.equal(internalRollback.options.dryRun, true);

  const internalRepairList = parseArgs(['internal', 'native', 'repair', 'list', '--limit', '5']);
  assert.equal(internalRepairList.command, 'internal');
  assert.equal(internalRepairList.options.target, 'native');
  assert.equal(internalRepairList.options.action, 'repair');
  assert.equal(internalRepairList.options.repairAction, 'list');
  assert.equal(internalRepairList.options.limit, 5);

  const internalRepairShow = parseArgs(['internal', 'native', 'repair', 'show', '--repair-id', 'latest']);
  assert.equal(internalRepairShow.command, 'internal');
  assert.equal(internalRepairShow.options.target, 'native');
  assert.equal(internalRepairShow.options.action, 'repair');
  assert.equal(internalRepairShow.options.repairAction, 'show');
  assert.equal(internalRepairShow.options.repairId, 'latest');
});

test('parseArgs rejects invalid install mode', () => {
  assert.throws(() => parseArgs(['setup', '--install-mode', 'portable']), /--install-mode must be one of/);
});

test('parseArgs rejects invalid skills scope', () => {
  assert.throws(() => parseArgs(['setup', '--scope', 'workspace']), /--scope must be one of/);
});

test('parseArgs accepts doctor strict mode', () => {
  const result = parseArgs(['doctor', '--strict']);
  assert.equal(result.command, 'doctor');
  assert.equal(result.options.strict, true);
  assert.equal(result.options.globalSecurity, false);
  assert.equal(result.options.nativeOnly, false);
  assert.equal(result.options.fix, false);
  assert.equal(result.options.dryRun, false);
});

test('parseArgs accepts team shorthand and runtime overrides', () => {
  const shorthand = parseArgs(['team', '2:claude', 'Ship team runtime']);
  assert.equal(shorthand.command, 'team');
  assert.equal(shorthand.options.workers, 2);
  assert.equal(shorthand.options.provider, 'claude');
  assert.equal(shorthand.options.clientId, 'claude-code');
  assert.equal(shorthand.options.taskTitle, 'Ship team runtime');
  assert.equal(shorthand.options.executionMode, 'live');

  const explicit = parseArgs([
    'team',
    '--provider',
    'gemini',
    '--workers',
    '4',
    '--task',
    'Refactor team flow',
    '--dry-run',
    '--format',
    'json',
  ]);
  assert.equal(explicit.command, 'team');
  assert.equal(explicit.options.provider, 'gemini');
  assert.equal(explicit.options.clientId, 'gemini-cli');
  assert.equal(explicit.options.workers, 4);
  assert.equal(explicit.options.executionMode, 'dry-run');
  assert.equal(explicit.options.format, 'json');

  const resumeRetry = parseArgs([
    'team',
    '--resume',
    'session-123',
    '--retry-blocked',
    '--force',
    '--provider',
    'codex',
  ]);
  assert.equal(resumeRetry.command, 'team');
  assert.equal(resumeRetry.options.resumeSessionId, 'session-123');
  assert.equal(resumeRetry.options.sessionId, 'session-123');
  assert.equal(resumeRetry.options.retryBlocked, true);
  assert.equal(resumeRetry.options.force, true);
  assert.equal(resumeRetry.options.clientId, 'codex-cli');
});

test('parseArgs accepts hud command options', () => {
  const jsonResult = parseArgs(['hud', '--provider', 'codex', '--json']);
  assert.equal(jsonResult.command, 'hud');
  assert.equal(jsonResult.options.provider, 'codex');
  assert.equal(jsonResult.options.json, true);

  const sessionResult = parseArgs(['hud', '--session', 'session-123', '--preset', 'full']);
  assert.equal(sessionResult.command, 'hud');
  assert.equal(sessionResult.options.sessionId, 'session-123');
  assert.equal(sessionResult.options.preset, 'full');

  const watchResult = parseArgs(['hud', '--watch', '--fast', '--interval-ms', '500']);
  assert.equal(watchResult.command, 'hud');
  assert.equal(watchResult.options.watch, true);
  assert.equal(watchResult.options.fast, true);
  assert.equal(watchResult.options.preset, 'minimal');
  assert.equal(watchResult.options.intervalMs, 500);

  const autoFastWatch = parseArgs(['hud', '--watch', '--interval-ms', '250']);
  assert.equal(autoFastWatch.command, 'hud');
  assert.equal(autoFastWatch.options.watch, true);
  assert.equal(autoFastWatch.options.preset, 'minimal');
  assert.equal(autoFastWatch.options.fast, true);

  const noFastWatch = parseArgs(['hud', '--watch', '--interval-ms', '250', '--no-fast']);
  assert.equal(noFastWatch.command, 'hud');
  assert.equal(noFastWatch.options.watch, true);
  assert.equal(noFastWatch.options.preset, 'minimal');
  assert.equal(noFastWatch.options.fast, false);

  const autoIntervalWatch = parseArgs(['hud', '--watch', '--interval-ms', 'auto']);
  assert.equal(autoIntervalWatch.command, 'hud');
  assert.equal(autoIntervalWatch.options.watch, true);
  assert.equal(autoIntervalWatch.options.preset, 'minimal');
  assert.equal(autoIntervalWatch.options.intervalMs, 'auto');
  assert.equal(autoIntervalWatch.options.fast, true);

  const autoIntervalNoFast = parseArgs(['hud', '--watch', '--interval-ms', 'auto', '--no-fast']);
  assert.equal(autoIntervalNoFast.command, 'hud');
  assert.equal(autoIntervalNoFast.options.watch, true);
  assert.equal(autoIntervalNoFast.options.intervalMs, 'auto');
  assert.equal(autoIntervalNoFast.options.fast, false);
});

test('parseArgs accepts team status/history subcommands', () => {
  const status = parseArgs(['team', 'status', '--provider', 'codex', '--json']);
  assert.equal(status.command, 'team');
  assert.equal(status.options.subcommand, 'status');
  assert.equal(status.options.provider, 'codex');
  assert.equal(status.options.json, true);

  const statusDefaults = parseArgs(['team', 'status']);
  assert.equal(statusDefaults.command, 'team');
  assert.equal(statusDefaults.options.subcommand, 'status');
  assert.equal(statusDefaults.options.preset, 'focused');
  assert.equal(statusDefaults.options.watch, false);
  assert.equal(statusDefaults.options.showSkillCandidates, false);

  const statusShowSkillCandidates = parseArgs(['team', 'status', '--show-skill-candidates']);
  assert.equal(statusShowSkillCandidates.command, 'team');
  assert.equal(statusShowSkillCandidates.options.subcommand, 'status');
  assert.equal(statusShowSkillCandidates.options.showSkillCandidates, true);

  const statusWatchDefaults = parseArgs(['team', 'status', '--watch']);
  assert.equal(statusWatchDefaults.command, 'team');
  assert.equal(statusWatchDefaults.options.subcommand, 'status');
  assert.equal(statusWatchDefaults.options.watch, true);
  assert.equal(statusWatchDefaults.options.fast, false);
  assert.equal(statusWatchDefaults.options.preset, 'minimal');

  const statusWatchFast = parseArgs(['team', 'status', '--watch', '--fast']);
  assert.equal(statusWatchFast.command, 'team');
  assert.equal(statusWatchFast.options.subcommand, 'status');
  assert.equal(statusWatchFast.options.watch, true);
  assert.equal(statusWatchFast.options.fast, true);
  assert.equal(statusWatchFast.options.preset, 'minimal');

  const statusWatchAutoFast = parseArgs(['team', 'status', '--watch', '--interval-ms', '250']);
  assert.equal(statusWatchAutoFast.command, 'team');
  assert.equal(statusWatchAutoFast.options.subcommand, 'status');
  assert.equal(statusWatchAutoFast.options.watch, true);
  assert.equal(statusWatchAutoFast.options.fast, true);
  assert.equal(statusWatchAutoFast.options.preset, 'minimal');

  const statusWatchNoFast = parseArgs(['team', 'status', '--watch', '--interval-ms', '250', '--no-fast']);
  assert.equal(statusWatchNoFast.command, 'team');
  assert.equal(statusWatchNoFast.options.subcommand, 'status');
  assert.equal(statusWatchNoFast.options.watch, true);
  assert.equal(statusWatchNoFast.options.fast, false);
  assert.equal(statusWatchNoFast.options.preset, 'minimal');

  const statusWatchAutoInterval = parseArgs(['team', 'status', '--watch', '--interval-ms', 'auto']);
  assert.equal(statusWatchAutoInterval.command, 'team');
  assert.equal(statusWatchAutoInterval.options.subcommand, 'status');
  assert.equal(statusWatchAutoInterval.options.watch, true);
  assert.equal(statusWatchAutoInterval.options.intervalMs, 'auto');
  assert.equal(statusWatchAutoInterval.options.fast, true);
  assert.equal(statusWatchAutoInterval.options.preset, 'minimal');

  const statusWatchAutoIntervalNoFast = parseArgs(['team', 'status', '--watch', '--interval-ms', 'auto', '--no-fast']);
  assert.equal(statusWatchAutoIntervalNoFast.command, 'team');
  assert.equal(statusWatchAutoIntervalNoFast.options.subcommand, 'status');
  assert.equal(statusWatchAutoIntervalNoFast.options.watch, true);
  assert.equal(statusWatchAutoIntervalNoFast.options.intervalMs, 'auto');
  assert.equal(statusWatchAutoIntervalNoFast.options.fast, false);
  assert.equal(statusWatchAutoIntervalNoFast.options.preset, 'minimal');

  const statusWatchExplicitPreset = parseArgs(['team', 'status', '--preset', 'full', '--watch']);
  assert.equal(statusWatchExplicitPreset.command, 'team');
  assert.equal(statusWatchExplicitPreset.options.subcommand, 'status');
  assert.equal(statusWatchExplicitPreset.options.watch, true);
  assert.equal(statusWatchExplicitPreset.options.preset, 'full');

  const historyDefaults = parseArgs(['team', 'history']);
  assert.equal(historyDefaults.command, 'team');
  assert.equal(historyDefaults.options.subcommand, 'history');
  assert.equal(historyDefaults.options.provider, 'codex');
  assert.equal(historyDefaults.options.limit, 10);
  assert.equal(historyDefaults.options.concurrency, 4);
  assert.equal(historyDefaults.options.qualityFailedOnly, false);
  assert.equal(historyDefaults.options.qualityCategory, '');
  assert.equal(historyDefaults.options.qualityCategoryPrefix, '');
  assert.equal(historyDefaults.options.qualityCategoryPrefixMode, 'any');

  const history = parseArgs([
    'team',
    'history',
    '--provider',
    'claude',
    '--limit',
    '5',
    '--concurrency',
    '8',
    '--quality-failed-only',
    '--quality-category',
    'quality-logs',
    '--quality-category-prefix',
    'quality-, contextdb-quality-',
    '--quality-category-prefix-mode',
    'all',
  ]);
  assert.equal(history.command, 'team');
  assert.equal(history.options.subcommand, 'history');
  assert.equal(history.options.provider, 'claude');
  assert.equal(history.options.limit, 5);
  assert.equal(history.options.concurrency, 8);
  assert.equal(history.options.qualityFailedOnly, true);
  assert.equal(history.options.qualityCategory, 'quality-logs');
  assert.equal(history.options.qualityCategoryPrefix, 'quality-, contextdb-quality-');
  assert.equal(history.options.qualityCategoryPrefixMode, 'all');
});

test('parseArgs rejects invalid mode', () => {
  assert.throws(() => parseArgs(['setup', '--mode', 'bad-value']), /--mode must be one of/);
});

test('parseArgs rejects invalid watch interval token', () => {
  assert.throws(() => parseArgs(['hud', '--watch', '--interval-ms', 'fast']), /--interval-ms must be a positive integer or \"auto\"/);
});

test('parseArgs rejects invalid team history quality prefix mode', () => {
  assert.throws(
    () => parseArgs(['team', 'history', '--quality-category-prefix-mode', 'strict']),
    /--quality-category-prefix-mode must be one of: any, all/
  );
});

test('parseArgs rejects team --retry-blocked without a session target', () => {
  assert.throws(
    () => parseArgs(['team', '--retry-blocked']),
    /--retry-blocked requires --resume <session-id> or --session <session-id>/i
  );
});

test('parseArgs accepts memo passthrough args', () => {
  const result = parseArgs(['memo', 'add', 'hello', '#tag']);
  assert.equal(result.command, 'memo');
  assert.equal(result.mode, 'command');
  assert.deepEqual(result.options.argv, ['add', 'hello', '#tag']);
});

test('parseArgs accepts entropy-gc options', () => {
  const result = parseArgs([
    'entropy-gc',
    'auto',
    '--session',
    'codex-cli-20260303T080437-065e16c0',
    '--retain',
    '7',
    '--min-age-hours',
    '48',
    '--format',
    'json',
  ]);
  assert.equal(result.command, 'entropy-gc');
  assert.equal(result.mode, 'command');
  assert.equal(result.options.mode, 'auto');
  assert.equal(result.options.sessionId, 'codex-cli-20260303T080437-065e16c0');
  assert.equal(result.options.retain, 7);
  assert.equal(result.options.minAgeHours, 48);
  assert.equal(result.options.format, 'json');
});

test('parseArgs treats memo help as help mode', () => {
  const result = parseArgs(['memo', '--help']);
  assert.equal(result.command, 'memo');
  assert.equal(result.mode, 'help');
  assert.equal(result.help, true);
});

test('aios CLI prints help', () => {
  const result = spawnSync('node', ['scripts/aios.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /AIOS unified entry/i);
  assert.match(result.stdout, /setup/);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /team/);
  assert.match(result.stdout, /native/);
});

test('aios memo prints help', () => {
  const result = spawnSync('node', ['scripts/aios.mjs', 'memo', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /add <text>/i);
  assert.match(result.stdout, /pin show/i);
});

test('aios memo add emits side turn-envelope metadata', async () => {
  const repoRoot = process.cwd();
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-memo-turn-'));
  const cliPath = path.join(repoRoot, 'scripts', 'aios.mjs');

  try {
    const result = spawnSync('node', [cliPath, 'memo', 'add', 'record memo #ops'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const eventsPath = path.join(
      workspaceRoot,
      'memory',
      'context-db',
      'sessions',
      'workspace-memory--default',
      'l2-events.jsonl'
    );
    const eventsRaw = await fs.readFile(eventsPath, 'utf8');
    const events = eventsRaw.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const memoEvent = events[events.length - 1];

    assert.equal(memoEvent.kind, 'memo');
    assert.equal(memoEvent.turn?.turnType, 'side');
    assert.equal(memoEvent.turn?.environment, 'memo');
    assert.equal(memoEvent.turn?.hindsightStatus, 'na');
    assert.equal(memoEvent.turn?.outcome, 'success');
    assert.match(String(memoEvent.turn?.turnId || ''), /^memo:default:/);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});
