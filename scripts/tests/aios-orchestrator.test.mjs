import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseArgs } from '../lib/cli/parse-args.mjs';
import {
  createLocalDispatchExecutorRegistry,
  resolveLocalDispatchExecutor,
  selectLocalDispatchExecutor,
} from '../lib/harness/orchestrator-executors.mjs';
import {
  buildLocalDispatchPlan,
  buildOrchestrationPlan,
  executeLocalDispatchPlan,
  getOrchestratorBlueprint,
  mergeParallelHandoffs,
  renderOrchestrationReport,
} from '../lib/harness/orchestrator.mjs';
import { planOrchestrate, runOrchestrate } from '../lib/lifecycle/orchestrate.mjs';

async function importDispatchRuntimes() {
  try {
    return await import('../lib/harness/orchestrator-runtimes.mjs');
  } catch {
    return null;
  }
}

async function importDispatchRuntimeSpec() {
  try {
    return await import('../../memory/specs/orchestrator-runtimes.json', { with: { type: 'json' } });
  } catch {
    return null;
  }
}

async function makeRootDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'aios-orchestrator-'));
}

async function writeSession(rootDir, sessionId, metaOverrides = {}, checkpoints = []) {
  const sessionDir = path.join(rootDir, 'memory', 'context-db', 'sessions', sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const meta = {
    schemaVersion: 1,
    sessionId,
    agent: 'codex-cli',
    project: 'rex-ai-boot',
    goal: 'Ship orchestrator blueprints',
    tags: [],
    status: 'running',
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:10:00.000Z',
    ...metaOverrides,
  };
  const lastCheckpoint = checkpoints[checkpoints.length - 1] || null;

  await fs.writeFile(path.join(sessionDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(sessionDir, 'l2-events.jsonl'), '', 'utf8');
  await fs.writeFile(
    path.join(sessionDir, 'l1-checkpoints.jsonl'),
    checkpoints.map((item) => JSON.stringify(item)).join('\n') + (checkpoints.length > 0 ? '\n' : ''),
    'utf8'
  );
  await fs.writeFile(
    path.join(sessionDir, 'state.json'),
    `${JSON.stringify({
      lastEventAt: null,
      lastEventSeq: 0,
      lastCheckpointAt: lastCheckpoint?.ts || null,
      lastCheckpointSeq: checkpoints.length,
      status: lastCheckpoint?.status || meta.status || 'running',
      nextActions: Array.isArray(lastCheckpoint?.nextActions) ? lastCheckpoint.nextActions : [],
    }, null, 2)}\n`,
    'utf8'
  );
}

async function writeDispatchEvidence(rootDir, sessionId, {
  seq = 1,
  ts = '2026-03-09T03:00:00.000Z',
  ok = true,
  executors = ['local-phase', 'local-merge-gate'],
  blockedJobs = 0,
  artifactName = 'dispatch-run-20260309T030000Z.json',
} = {}) {
  const artifactPath = path.join('memory', 'context-db', 'sessions', sessionId, 'artifacts', artifactName);
  const artifactAbsPath = path.join(rootDir, artifactPath);
  await fs.mkdir(path.dirname(artifactAbsPath), { recursive: true });
  await fs.writeFile(
    artifactAbsPath,
    `${JSON.stringify({
      schemaVersion: 1,
      kind: 'orchestration.dispatch-run',
      sessionId,
      persistedAt: ts,
      dispatchRun: {
        mode: 'dry-run',
        ok,
        executorRegistry: executors,
        jobRuns: [
          { jobId: 'phase.plan', status: 'simulated', output: { outputType: 'handoff' } },
          {
            jobId: 'merge.final-checks',
            status: blockedJobs > 0 ? 'blocked' : 'simulated',
            output: { outputType: 'merged-handoff' },
          },
        ],
        finalOutputs: [
          { jobId: 'phase.plan', outputType: 'handoff' },
          { jobId: 'merge.final-checks', outputType: 'merged-handoff' },
        ],
      },
    }, null, 2)}\n`,
    'utf8'
  );

  const sessionDir = path.join(rootDir, 'memory', 'context-db', 'sessions', sessionId);
  const eventsPath = path.join(sessionDir, 'l2-events.jsonl');
  const event = {
    seq,
    ts,
    role: 'assistant',
    kind: 'orchestration.dispatch-run',
    text: `orchestrate dry-run ${ok ? 'ready' : 'blocked'} artifact=${artifactPath}`,
    refs: [artifactPath],
  };
  await fs.appendFile(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');

  return { artifactPath, eventId: `${sessionId}#${seq}` };
}

function runContextDbCli(args, { cwd = process.cwd() } = {}) {
  const tsxCli = path.join(cwd, 'mcp-server', 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const contextDbCli = path.join(cwd, 'mcp-server', 'src', 'contextdb', 'cli.ts');
  const result = spawnSync(process.execPath, [tsxCli, contextDbCli, ...args], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const stdout = String(result.stdout || '').trim();
  return stdout.length > 0 ? JSON.parse(stdout) : {};
}

test('parseArgs accepts orchestrate blueprint and task', () => {
  const result = parseArgs(['orchestrate', 'feature', '--task', 'Add harness orchestrator']);
  assert.equal(result.command, 'orchestrate');
  assert.equal(result.options.blueprint, 'feature');
  assert.equal(result.options.taskTitle, 'Add harness orchestrator');
});

test('parseArgs accepts orchestrate learn-eval overlay options', () => {
  const result = parseArgs([
    'orchestrate',
    '--session',
    'session-123',
    '--limit',
    '5',
    '--recommendation',
    'blueprint.security',
  ]);
  assert.equal(result.command, 'orchestrate');
  assert.equal(result.options.sessionId, 'session-123');
  assert.equal(result.options.limit, 5);
  assert.equal(result.options.recommendationId, 'blueprint.security');
});

test('parseArgs accepts local dispatch mode for orchestrate', () => {
  const result = parseArgs(['orchestrate', 'feature', '--dispatch', 'local']);
  assert.equal(result.command, 'orchestrate');
  assert.equal(result.options.dispatchMode, 'local');
});

test('parseArgs accepts local dry-run execute mode for orchestrate', () => {
  const result = parseArgs(['orchestrate', 'feature', '--dispatch', 'local', '--execute', 'dry-run']);
  assert.equal(result.command, 'orchestrate');
  assert.equal(result.options.dispatchMode, 'local');
  assert.equal(result.options.executionMode, 'dry-run');
});

test('parseArgs accepts local live execute mode for orchestrate', () => {
  const result = parseArgs(['orchestrate', 'feature', '--dispatch', 'local', '--execute', 'live']);
  assert.equal(result.command, 'orchestrate');
  assert.equal(result.options.dispatchMode, 'local');
  assert.equal(result.options.executionMode, 'live');
});

test('parseArgs accepts orchestrate preflight mode', () => {
  const result = parseArgs(['orchestrate', 'feature', '--dispatch', 'local', '--preflight', 'auto']);
  assert.equal(result.command, 'orchestrate');
  assert.equal(result.options.preflightMode, 'auto');
});

test('getOrchestratorBlueprint expands role cards', () => {
  const blueprint = getOrchestratorBlueprint('feature');
  assert.equal(blueprint.phases.length, 4);
  assert.equal(blueprint.phases[0].roleCard.label, 'Planner');
  assert.equal(blueprint.phases[2].group, 'final-checks');
});

test('buildOrchestrationPlan creates ordered phases', () => {
  const plan = buildOrchestrationPlan({ blueprint: 'bugfix', taskTitle: 'Fix auth wall detection' });
  assert.equal(plan.blueprint, 'bugfix');
  assert.equal(plan.phases[0].role, 'planner');
  assert.equal(plan.phases[1].role, 'implementer');
});

test('selectLocalDispatchExecutor resolves supported local job types', () => {
  assert.equal(selectLocalDispatchExecutor({ jobType: 'phase' }), 'local-phase');
  assert.equal(selectLocalDispatchExecutor({ jobType: 'merge-gate' }), 'local-merge-gate');
});

test('dispatch runtime manifest spec defines the local dry-run runtime', async () => {
  const runtimeSpec = await importDispatchRuntimeSpec();
  assert.ok(runtimeSpec, 'expected runtime manifest spec');

  assert.equal(runtimeSpec.default.schemaVersion, 1);
  assert.equal(typeof runtimeSpec.default.runtimes['local-dry-run']?.label, 'string');
  assert.equal(runtimeSpec.default.runtimes['local-dry-run']?.requiresModel, false);
  assert.equal(runtimeSpec.default.runtimes['subagent-runtime']?.requiresModel, true);
  assert.equal(runtimeSpec.default.runtimes['subagent-runtime']?.executionModes?.includes('live'), true);
});

test('dispatch runtime registry lists the local dry-run runtime', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  const all = runtimes.listDispatchRuntimes();
  const runtime = runtimes.getDispatchRuntime('local-dry-run');

  assert.equal(all.some((item) => item.id === 'local-dry-run'), true);
  assert.equal(runtime.id, 'local-dry-run');
  assert.equal(runtime.manifestVersion, 1);
  assert.equal(runtime.requiresModel, false);
  assert.deepEqual(runtime.executionModes, ['dry-run']);
});

test('dispatch runtime registry selects local dry-run for dry-run execution', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  assert.equal(runtimes.selectDispatchRuntime({ executionMode: 'dry-run' }), 'local-dry-run');
});

test('dispatch runtime registry selects the subagent runtime for live execution', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  assert.equal(runtimes.selectDispatchRuntime({ executionMode: 'live' }), 'subagent-runtime');
});

test('dispatch runtime registry rejects unknown runtime ids and unsupported modes', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  assert.throws(() => runtimes.getDispatchRuntime('missing-runtime'), /Unknown dispatch runtime/i);
  assert.throws(() => runtimes.selectDispatchRuntime({ executionMode: 'none' }), /No dispatch runtime available/i);
});

test('dispatch runtime registry exposes the subagent runtime adapter contract as a stub', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  const registry = runtimes.createDispatchRuntimeRegistry({ executeDryRunPlan: () => ({ mode: 'dry-run', ok: true, jobRuns: [] }) });
  const runtime = runtimes.resolveDispatchRuntime({ runtimeId: 'subagent-runtime', executionMode: 'live' }, registry);

  assert.equal(runtime.requiresModel, true);
  assert.equal(runtime.manifestVersion, 1);

  const result = runtime.execute({ plan: { phases: [] }, dispatchPlan: { jobs: [] }, dispatchPolicy: null, env: {} });
  assert.equal(result.mode, 'live');
  assert.equal(result.ok, false);
  assert.equal(Array.isArray(result.jobRuns), true);
  assert.match(String(result.error || ''), /AIOS_EXECUTE_LIVE/i);
});

test('dispatch runtime registry can simulate the subagent runtime when explicitly enabled', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  const registry = runtimes.createDispatchRuntimeRegistry({ executeDryRunPlan: () => ({ mode: 'dry-run', ok: true, jobRuns: [] }) });
  const runtime = runtimes.resolveDispatchRuntime({ runtimeId: 'subagent-runtime', executionMode: 'live' }, registry);

  const plan = buildOrchestrationPlan({ blueprint: 'feature', taskTitle: 'Simulate subagent runtime' });
  const dispatchPlan = buildLocalDispatchPlan(plan);

  const result = runtime.execute({
    plan,
    dispatchPlan,
    dispatchPolicy: null,
    env: {
      AIOS_EXECUTE_LIVE: '1',
      AIOS_SUBAGENT_SIMULATE: '1',
    },
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.ok, true);
  assert.equal(result.jobRuns.length > 0, true);
  assert.equal(result.executorRegistry.length > 0, true);
});

test('dispatch runtime registry keeps blocked workflow results as structured runtime output', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  const registry = runtimes.createDispatchRuntimeRegistry({
    executeDryRunPlan: () => ({
      mode: 'dry-run',
      ok: false,
      executorRegistry: [],
      executorDetails: [],
      jobRuns: [
        { jobId: 'merge.final-checks', status: 'blocked', output: { outputType: 'merged-handoff' } },
      ],
      finalOutputs: [],
    }),
  });
  const runtime = runtimes.resolveDispatchRuntime({ executionMode: 'dry-run' }, registry);
  const result = runtime.execute({ plan: { phases: [] }, dispatchPlan: { jobs: [] }, dispatchPolicy: null });

  assert.equal(result.ok, false);
  assert.equal(result.runtime.id, 'local-dry-run');
  assert.equal(result.jobRuns[0].status, 'blocked');
});

test('dispatch runtime registry rejects invalid runtime output', async () => {
  const runtimes = await importDispatchRuntimes();
  assert.ok(runtimes, 'expected runtime registry module');

  const registry = runtimes.createDispatchRuntimeRegistry({
    executeDryRunPlan: () => ({ mode: 'dry-run', ok: true, jobRuns: null }),
  });
  const runtime = runtimes.resolveDispatchRuntime({ executionMode: 'dry-run' }, registry);

  assert.throws(
    () => runtime.execute({ plan: { phases: [] }, dispatchPlan: { jobs: [] }, dispatchPolicy: null }),
    /invalid jobRuns/i
  );
});

test('createLocalDispatchExecutorRegistry exposes executor metadata and resolution', () => {
  const registry = createLocalDispatchExecutorRegistry({
    executePhaseJob: () => ({ status: 'simulated', output: { outputType: 'handoff', payload: {} } }),
    executeMergeGateJob: () => ({ status: 'simulated', output: { outputType: 'merged-handoff', payload: {} } }),
  });

  const phaseExecutor = resolveLocalDispatchExecutor({
    jobType: 'phase',
    role: 'planner',
    launchSpec: { executor: 'local-phase' },
  }, registry);
  const mergeExecutor = resolveLocalDispatchExecutor({
    jobType: 'merge-gate',
    role: 'merge-gate',
    launchSpec: { executor: 'local-merge-gate' },
  }, registry);

  assert.equal(phaseExecutor.id, 'local-phase');
  assert.equal(phaseExecutor.requiresModel, false);
  assert.deepEqual(phaseExecutor.executionModes, ['dry-run']);
  assert.deepEqual(phaseExecutor.jobTypes, ['phase']);
  assert.deepEqual(phaseExecutor.supportedRoles, ['planner', 'implementer', 'reviewer', 'security-reviewer']);
  assert.equal(phaseExecutor.concurrencyMode, 'parallel-safe');

  assert.equal(mergeExecutor.id, 'local-merge-gate');
  assert.deepEqual(mergeExecutor.jobTypes, ['merge-gate']);
  assert.deepEqual(mergeExecutor.outputTypes, ['merged-handoff']);
  assert.equal(mergeExecutor.concurrencyMode, 'serial-only');
});

test('buildLocalDispatchPlan creates job dependencies and a merge gate for parallel groups', () => {
  const orchestration = buildOrchestrationPlan({ blueprint: 'feature', taskTitle: 'Ship blueprints' });
  const dispatch = buildLocalDispatchPlan(orchestration);

  assert.equal(dispatch.mode, 'local');
  assert.equal(dispatch.jobs.length, 5);
  assert.deepEqual(dispatch.jobs.map((job) => job.jobId), [
    'phase.plan',
    'phase.implement',
    'phase.review',
    'phase.security',
    'merge.final-checks',
  ]);

  const planJob = dispatch.jobs.find((job) => job.jobId === 'phase.plan');
  const implementJob = dispatch.jobs.find((job) => job.jobId === 'phase.implement');
  const reviewJob = dispatch.jobs.find((job) => job.jobId === 'phase.review');
  const securityJob = dispatch.jobs.find((job) => job.jobId === 'phase.security');
  const mergeJob = dispatch.jobs.find((job) => job.jobId === 'merge.final-checks');

  assert.deepEqual(planJob?.dependsOn, []);
  assert.deepEqual(implementJob?.dependsOn, ['phase.plan']);
  assert.deepEqual(reviewJob?.dependsOn, ['phase.implement']);
  assert.deepEqual(securityJob?.dependsOn, ['phase.implement']);
  assert.deepEqual(mergeJob?.dependsOn, ['phase.review', 'phase.security']);
  assert.equal(mergeJob?.jobType, 'merge-gate');
  assert.equal(reviewJob?.launchSpec.requiresModel, false);
  assert.equal(reviewJob?.launchSpec.executor, 'local-phase');
  assert.equal(mergeJob?.launchSpec.executor, 'local-merge-gate');
  assert.deepEqual(dispatch.executorRegistry, ['local-phase', 'local-merge-gate']);
  assert.equal(dispatch.executorDetails[0]?.requiresModel, false);
  assert.deepEqual(dispatch.executorDetails[0]?.jobTypes, ['phase']);
  assert.deepEqual(dispatch.executorDetails[1]?.jobTypes, ['merge-gate']);
});

test('buildLocalDispatchPlan serializes grouped phases when policy requires serial-only', () => {
  const orchestration = buildOrchestrationPlan({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchPolicy: {
      status: 'blocked',
      parallelism: 'serial-only',
    },
  });
  const dispatch = buildLocalDispatchPlan(orchestration);

  assert.equal(dispatch.jobs.length, 4);
  assert.deepEqual(dispatch.jobs.map((job) => job.jobId), [
    'phase.plan',
    'phase.implement',
    'phase.review',
    'phase.security',
  ]);
  assert.deepEqual(dispatch.jobs.map((job) => job.dependsOn), [
    [],
    ['phase.plan'],
    ['phase.implement'],
    ['phase.review'],
  ]);
  assert.equal(dispatch.jobs.some((job) => job.jobType === 'merge-gate'), false);
  assert.match(dispatch.notes.join(' '), /serial-only/i);
});

test('executeLocalDispatchPlan simulates phase jobs and merge-gate outputs', () => {
  const orchestration = buildOrchestrationPlan({ blueprint: 'feature', taskTitle: 'Ship blueprints' });
  const dispatch = buildLocalDispatchPlan(orchestration);
  const run = executeLocalDispatchPlan(orchestration, dispatch);

  assert.equal(run.mode, 'dry-run');
  assert.equal(run.runtime?.id, 'local-dry-run');
  assert.equal(run.runtime?.executionMode, 'dry-run');
  assert.equal(run.ok, true);
  assert.equal(run.jobRuns.length, 5);
  assert.equal(run.jobRuns.every((jobRun) => jobRun.status === 'simulated'), true);
  assert.deepEqual(run.executorRegistry, ['local-phase', 'local-merge-gate']);
  assert.equal(run.executorDetails[0]?.label, 'Local Phase Executor');
  assert.equal(run.executorDetails[1]?.label, 'Local Merge Gate Executor');

  const reviewRun = run.jobRuns.find((jobRun) => jobRun.jobId === 'phase.review');
  const mergeRun = run.jobRuns.find((jobRun) => jobRun.jobId === 'merge.final-checks');

  assert.equal(reviewRun?.executor, 'local-phase');
  assert.equal(reviewRun?.output.outputType, 'handoff');
  assert.equal(reviewRun?.output.payload.toRole, 'merge-gate');
  assert.equal(mergeRun?.executor, 'local-merge-gate');
  assert.equal(mergeRun?.output.outputType, 'merged-handoff');
  assert.equal(mergeRun?.output.mergeResult.ok, true);
  assert.equal(mergeRun?.output.payload.status, 'completed');
});

test('mergeParallelHandoffs blocks conflicting file ownership', () => {
  const result = mergeParallelHandoffs([
    {
      fromRole: 'reviewer',
      toRole: 'merge-gate',
      taskTitle: 'Review auth flow',
      contextSummary: 'Quality findings',
      filesTouched: ['src/auth.ts'],
    },
    {
      fromRole: 'security-reviewer',
      toRole: 'merge-gate',
      taskTitle: 'Review auth flow',
      contextSummary: 'Security findings',
      filesTouched: ['src/auth.ts'],
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].filePath, 'src/auth.ts');
});

test('mergeParallelHandoffs blocks blocked statuses', () => {
  const result = mergeParallelHandoffs([
    {
      fromRole: 'reviewer',
      toRole: 'merge-gate',
      taskTitle: 'Review auth flow',
      contextSummary: 'Needs clarification',
      status: 'needs-input',
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.blocked.length, 1);
});

test('mergeParallelHandoffs blocks file touches from read-only roles', () => {
  const result = mergeParallelHandoffs([
    {
      fromRole: 'reviewer',
      toRole: 'merge-gate',
      taskTitle: 'Review auth flow',
      contextSummary: 'Quality findings',
      filesTouched: ['src/new-file.ts'],
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(Array.isArray(result.ownershipViolations), true);
  assert.equal(result.ownershipViolations.length, 1);
  assert.equal(result.ownershipViolations[0].filePath, 'src/new-file.ts');
});

test('planOrchestrate emits stable preview', () => {
  const plan = planOrchestrate({ blueprint: 'security', taskTitle: 'Audit login flow', format: 'json' });
  assert.match(plan.preview, /orchestrate security --task/);
  assert.match(plan.preview, /--format json/);
});

test('planOrchestrate includes learn-eval overlay flags in preview', () => {
  const plan = planOrchestrate({ sessionId: 'security-stable', limit: 5, recommendationId: 'blueprint.security' });
  assert.match(plan.preview, /orchestrate --session security-stable --limit 5 --recommendation blueprint\.security/);
});

test('planOrchestrate includes local dispatch mode in preview', () => {
  const plan = planOrchestrate({ sessionId: 'security-stable', dispatchMode: 'local' });
  assert.match(plan.preview, /--dispatch local/);
});

test('planOrchestrate includes dry-run execute mode in preview', () => {
  const plan = planOrchestrate({ sessionId: 'security-stable', dispatchMode: 'local', executionMode: 'dry-run' });
  assert.match(plan.preview, /--execute dry-run/);
});

test('planOrchestrate includes live execute mode in preview', () => {
  const plan = planOrchestrate({ sessionId: 'security-stable', dispatchMode: 'local', executionMode: 'live' });
  assert.match(plan.preview, /--execute live/);
});

test('runOrchestrate defaults to local dry-run execution when dispatch/execute are omitted', async () => {
  const rootDir = await makeRootDir();
  const logs = [];
  await runOrchestrate(
    { blueprint: 'feature', taskTitle: 'Default dry-run', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchPlan.mode, 'local');
  assert.equal(report.dispatchRun.mode, 'dry-run');
  assert.equal(report.dispatchRun.runtime?.id, 'local-dry-run');
  assert.equal(report.dispatchEvidence.persisted, false);
  assert.equal(report.dispatchEvidence.reason, 'session-required');
});

test('runOrchestrate resolves blueprint and context from learn-eval overlay', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'security-stable',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );

  const logs = [];
  const result = await runOrchestrate(
    { sessionId: 'security-stable', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(result.exitCode, 0);
  assert.equal(report.blueprint, 'security');
  assert.equal(report.taskTitle, 'Audit login flow hardening');
  assert.equal(report.learnEvalOverlay.sourceSessionId, 'security-stable');
  assert.equal(report.learnEvalOverlay.selectedRecommendationId, 'blueprint.security');
  assert.equal(report.learnEvalOverlay.appliedRecommendationIds.includes('checklist.verification-standard'), true);
  assert.match(report.contextSummary, /learn-eval overlay/i);
});

test('runOrchestrate adds a local dispatch skeleton without invoking models', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'security-stable',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { sessionId: 'security-stable', dispatchMode: 'local', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchPlan.mode, 'local');
  assert.equal(report.dispatchPlan.readyForExecution, false);
  assert.equal(report.dispatchPlan.jobs.every((job) => job.launchSpec.requiresModel === false), true);
  assert.equal(report.dispatchPlan.jobs.filter((job) => job.jobType === 'phase').every((job) => job.launchSpec.executor === 'local-phase'), true);
  assert.equal(report.dispatchPlan.jobs.filter((job) => job.jobType === 'merge-gate').every((job) => job.launchSpec.executor === 'local-merge-gate'), true);
  assert.deepEqual(report.dispatchPlan.executorRegistry, ['local-phase']);
});

test('runOrchestrate throws when the selected dispatch runtime returns invalid output', async () => {
  const rootDir = await makeRootDir();
  const logs = [];

  await assert.rejects(
    () => runOrchestrate(
      { blueprint: 'feature', taskTitle: 'Invalid runtime output', dispatchMode: 'local', executionMode: 'dry-run', format: 'json' },
      {
        rootDir,
        io: { log: (line) => logs.push(line) },
        dispatchRuntimeRegistry: {
          'local-dry-run': {
            id: 'local-dry-run',
            label: 'Local Dry Run Runtime',
            requiresModel: false,
            executionModes: ['dry-run'],
            execute() {
              return { mode: 'dry-run', ok: true, jobRuns: null };
            },
          },
        },
      }
    ),
    /jobRuns/
  );
});

test('runOrchestrate blocks live execution by default without persisting evidence', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'live-session',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Validate live gate behavior' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { sessionId: 'live-session', dispatchMode: 'local', executionMode: 'live', format: 'json' },
    { rootDir, env: {}, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchRun.mode, 'live');
  assert.equal(report.dispatchRun.runtime?.id, 'subagent-runtime');
  assert.equal(report.dispatchRun.ok, false);
  assert.match(String(report.dispatchRun.error || ''), /AIOS_EXECUTE_LIVE/i);

  assert.equal(report.effectiveDispatchPolicy.status, 'blocked');
  assert.equal(report.effectiveDispatchPolicy.blockerIds.includes('runbook.dispatch-runtime-unavailable'), true);
  assert.equal(report.effectiveDispatchPolicy.requiredActions.some((item) => /--dispatch local --execute dry-run/.test(item.action)), true);

  assert.equal(report.dispatchEvidence.persisted, false);
  assert.equal(report.dispatchEvidence.reason, 'mode-unsupported');

  await assert.rejects(
    () => fs.access(path.join(rootDir, 'memory', 'context-db', 'sessions', 'live-session', 'artifacts')),
    /ENOENT/
  );
  const eventsRaw = await fs.readFile(path.join(rootDir, 'memory', 'context-db', 'sessions', 'live-session', 'l2-events.jsonl'), 'utf8');
  assert.equal(eventsRaw.trim(), '');
});

test('runOrchestrate adds a dry-run dispatch run without invoking models', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'security-stable',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { sessionId: 'security-stable', dispatchMode: 'local', executionMode: 'dry-run', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchRun.mode, 'dry-run');
  assert.equal(report.dispatchRun.runtime?.id, 'local-dry-run');
  assert.equal(report.dispatchRun.runtime?.executionMode, 'dry-run');
  assert.equal(report.dispatchRun.ok, true);
  assert.equal(report.dispatchRun.jobRuns.every((jobRun) => jobRun.status === 'simulated'), true);
  assert.equal(report.dispatchRun.jobRuns.every((jobRun) => typeof jobRun.output.outputType === 'string'), true);
  assert.deepEqual(report.dispatchRun.executorRegistry, ['local-phase']);
  assert.equal(report.dispatchRun.executorDetails[0]?.requiresModel, false);
  assert.equal(report.dispatchRun.jobRuns.find((jobRun) => jobRun.jobId === 'phase.plan')?.executor, 'local-phase');
  assert.equal(report.dispatchRun.jobRuns.some((jobRun) => jobRun.executor === 'local-merge-gate'), false);
});

test('runOrchestrate persists dry-run evidence into ContextDB JSONL and SQLite sidecar', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'security-stable',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { sessionId: 'security-stable', dispatchMode: 'local', executionMode: 'dry-run', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchEvidence.persisted, true);
  assert.equal(report.dispatchEvidence.eventKind, 'orchestration.dispatch-run');
  assert.match(report.dispatchEvidence.artifactPath, /dispatch-run-/);

  const artifactPath = path.join(rootDir, report.dispatchEvidence.artifactPath);
  const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  assert.equal(artifact.dispatchRun.mode, 'dry-run');
  assert.equal(artifact.dispatchRun.runtime?.id, 'local-dry-run');
  assert.equal(artifact.dispatchRun.executorRegistry.includes('local-phase'), true);

  const eventsRaw = await fs.readFile(path.join(rootDir, 'memory', 'context-db', 'sessions', 'security-stable', 'l2-events.jsonl'), 'utf8');
  const checkpointsRaw = await fs.readFile(path.join(rootDir, 'memory', 'context-db', 'sessions', 'security-stable', 'l1-checkpoints.jsonl'), 'utf8');
  const lastEvent = JSON.parse(eventsRaw.trim().split('\n').at(-1));
  const lastCheckpoint = JSON.parse(checkpointsRaw.trim().split('\n').at(-1));

  assert.equal(lastEvent.kind, 'orchestration.dispatch-run');
  assert.equal(lastEvent.refs.includes(report.dispatchEvidence.artifactPath), true);
  assert.match(lastCheckpoint.summary, /dry-run/);
  assert.equal(lastCheckpoint.telemetry.verification.result, 'partial');
  assert.equal(lastCheckpoint.artifacts.includes(report.dispatchEvidence.artifactPath), true);

  const sqlitePath = path.join(rootDir, 'memory', 'context-db', 'index', 'context.db');
  const timeline = runContextDbCli(['timeline', '--workspace', rootDir, '--session', 'security-stable', '--limit', '10']);
  assert.equal(Array.isArray(timeline.items), true);
  assert.equal(timeline.items.some((item) => item.id === report.dispatchEvidence.eventId), true);
  assert.equal(timeline.items.some((item) => item.id === report.dispatchEvidence.checkpointId), true);
  await fs.access(sqlitePath);
});
test('runOrchestrate keeps explicit blueprint when overlay also recommends one', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'security-stable',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { blueprint: 'refactor', sessionId: 'security-stable', taskTitle: 'Manual override', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.blueprint, 'refactor');
  assert.equal(report.learnEvalOverlay.selectedRecommendationId, 'blueprint.security');
});

test('runOrchestrate preflight clears verification blocker and records results', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'preflight-session',
    { updatedAt: '2026-03-09T03:30:00.000Z', goal: 'Stabilize verification signals' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'running',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'unknown', evidence: '' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { sessionId: 'preflight-session', dispatchMode: 'local', preflightMode: 'auto', format: 'json' },
    {
      rootDir,
      io: { log: (line) => logs.push(line) },
      preflightAdapters: {
        qualityGate: async () => ({ ok: true, exitCode: 0, mode: 'full', results: [] }),
        doctor: async () => ({ ok: true, exitCode: 0 }),
      },
    }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchPolicy.status, 'blocked');
  assert.equal(report.effectiveDispatchPolicy.status, 'caution');
  assert.deepEqual(report.effectiveDispatchPolicy.blockerIds, []);
  assert.equal(report.dispatchPreflight.results.some((item) => item.sourceId === 'gate.verification-results' && item.status === 'passed'), true);
  assert.equal(report.dispatchPreflight.results.some((item) => item.type === 'artifact' && item.status === 'skipped'), false);
  assert.equal(report.dispatchPlan.jobs.some((job) => job.jobType === 'merge-gate'), true);
});

test('runOrchestrate preflight refreshes learn-eval from session-scoped verification telemetry', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'preflight-refresh',
    { updatedAt: '2026-03-09T03:35:00.000Z', goal: 'Refresh learn-eval after preflight' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T03:05:00.000Z',
        status: 'running',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
      },
      {
        seq: 3,
        ts: '2026-03-09T03:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'partial', evidence: 'dispatch dry-run' },
          retryCount: 0,
          elapsedMs: 600,
        },
      },
      {
        seq: 4,
        ts: '2026-03-09T03:15:00.000Z',
        status: 'running',
        summary: 'Checkpoint 4',
        nextActions: [],
        artifacts: [],
      },
    ]
  );

  const adapterCalls = [];
  const logs = [];
  await runOrchestrate(
    { sessionId: 'preflight-refresh', dispatchMode: 'local', preflightMode: 'auto', format: 'json' },
    {
      rootDir,
      io: { log: (line) => logs.push(line) },
      preflightAdapters: {
        qualityGate: async (options) => {
          adapterCalls.push(options.sessionId);
          runContextDbCli([
            'checkpoint',
            '--workspace',
            rootDir,
            '--session',
            'preflight-refresh',
            '--summary',
            'Recorded quality-gate full passed',
            '--status',
            'done',
            '--verify-result',
            'passed',
            '--verify-evidence',
            'quality-gate full',
            '--retry-count',
            '0',
            '--elapsed-ms',
            '100',
          ]);
          return { ok: true, exitCode: 0, mode: 'full', results: [] };
        },
        doctor: async () => ({ ok: true, exitCode: 0 }),
      },
    }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.deepEqual(adapterCalls, ['preflight-refresh']);
  assert.equal(report.dispatchPolicy.blockerIds.includes('gate.verification-results'), true);
  assert.equal(report.effectiveDispatchPolicy.blockerIds.includes('gate.verification-results'), false);
  assert.equal(report.effectiveDispatchPolicy.status, 'caution');
});

test('runOrchestrate preflight executes supported local orchestrate dry-run actions', async () => {
  const rootDir = await makeRootDir();
  const dispatch = await writeDispatchEvidence(rootDir, 'preflight-blocked', { ok: false, blockedJobs: 1 });
  await writeSession(
    rootDir,
    'preflight-blocked',
    { updatedAt: '2026-03-09T03:40:00.000Z', goal: 'Recover blocked merge path' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'blocked',
        summary: 'Merge gate blocked',
        nextActions: [],
        artifacts: [dispatch.artifactPath],
        telemetry: {
          verification: { result: 'failed', evidence: `event=${dispatch.eventId}; artifact=${dispatch.artifactPath}` },
          retryCount: 0,
          failureCategory: 'merge-gate-blocked',
          elapsedMs: 50,
        },
      },
    ]
  );

  const calls = [];
  const logs = [];
  await runOrchestrate(
    { sessionId: 'preflight-blocked', dispatchMode: 'local', preflightMode: 'auto', format: 'json' },
    {
      rootDir,
      io: { log: (line) => logs.push(line) },
      preflightAdapters: {
        qualityGate: async () => ({ ok: true, exitCode: 0, mode: 'full', results: [] }),
        doctor: async () => ({ ok: true, exitCode: 0 }),
        orchestrate: async (options) => {
          calls.push(options);
          return {
            exitCode: 0,
            report: {
              dispatchRun: {
                ok: true,
                jobRuns: [
                  { jobId: 'phase.plan', status: 'simulated' },
                  { jobId: 'merge.final-checks', status: 'simulated' },
                ],
              },
            },
          };
        },
      },
    }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sessionId, 'preflight-blocked');
  assert.equal(calls[0].dispatchMode, 'local');
  assert.equal(calls[0].executionMode, 'dry-run');
  assert.equal(calls[0].preflightMode, 'none');
  assert.equal(report.dispatchPreflight.results.some((item) => item.sourceId === 'runbook.dispatch-merge-triage' && item.status === 'passed' && item.runner === 'orchestrate'), true);
  assert.equal(report.effectiveDispatchPolicy.blockerIds.includes('runbook.dispatch-merge-triage'), false);
  assert.equal(report.dispatchPlan.jobs.some((job) => job.jobType === 'merge-gate'), true);
});

test('runOrchestrate preflight skips non-local-dry-run orchestrate actions', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'preflight-promote',
    { updatedAt: '2026-03-09T05:20:00.000Z', goal: 'Ship orchestrator blueprints' },
    [
      {
        seq: 1,
        ts: '2026-03-09T05:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 1000,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T05:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 1,
          elapsedMs: 1100,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T05:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate quick' },
          retryCount: 0,
          elapsedMs: 1000,
        },
      },
    ]
  );

  const calls = [];
  const logs = [];
  await runOrchestrate(
    { sessionId: 'preflight-promote', preflightMode: 'auto', format: 'json' },
    {
      rootDir,
      io: { log: (line) => logs.push(line) },
      preflightAdapters: {
        qualityGate: async (options) => ({ ok: true, exitCode: 0, mode: options.mode, results: [] }),
        doctor: async () => ({ ok: true, exitCode: 0 }),
        orchestrate: async (options) => {
          calls.push(options);
          return {
            exitCode: 0,
            report: {
              dispatchRun: {
                ok: true,
                jobRuns: [],
              },
            },
          };
        },
      },
    }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(calls.length, 0);
  assert.equal(report.dispatchPreflight.results.some((item) => item.sourceId === 'blueprint.feature' && item.status === 'skipped' && item.runner === 'unsupported'), true);
  assert.equal(report.dispatchPreflight.results.some((item) => item.sourceId === 'checklist.verification-standard' && item.status === 'passed' && item.runner === 'quality-gate'), true);
});

test('runOrchestrate preflight still records artifact-only actions as skipped', async () => {
  const rootDir = await makeRootDir();
  const dispatch = await writeDispatchEvidence(rootDir, 'preflight-artifact', { ok: true, blockedJobs: 0 });
  await writeSession(
    rootDir,
    'preflight-artifact',
    { updatedAt: '2026-03-09T03:45:00.000Z', goal: 'Observe dispatch evidence' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T03:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 950,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T03:10:00.000Z',
        status: 'running',
        summary: 'Recorded dry-run evidence',
        nextActions: [],
        artifacts: [dispatch.artifactPath],
        telemetry: {
          verification: { result: 'partial', evidence: `event=${dispatch.eventId}; artifact=${dispatch.artifactPath}` },
          retryCount: 0,
          elapsedMs: 50,
        },
      },
    ]
  );

  const logs = [];
  await runOrchestrate(
    { sessionId: 'preflight-artifact', dispatchMode: 'local', preflightMode: 'auto', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchPreflight.results.some((item) => item.type === 'artifact' && item.sourceId === 'sample.dispatch-evidence-present' && item.status === 'skipped'), true);
  assert.equal(report.effectiveDispatchPolicy.status, 'ready');
});

test('runOrchestrate derives blocked dispatch policy from learn-eval and dispatch evidence', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'blocked-session',
    { updatedAt: '2026-03-09T03:30:00.000Z', goal: 'Stabilize merge gate behavior' },
    [
      {
        seq: 1,
        ts: '2026-03-09T03:00:00.000Z',
        status: 'blocked',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'unknown', evidence: '' },
          retryCount: 0,
          elapsedMs: 900,
        },
      },
    ]
  );
  await writeDispatchEvidence(rootDir, 'blocked-session', { ok: false, blockedJobs: 1 });

  const logs = [];
  await runOrchestrate(
    { sessionId: 'blocked-session', dispatchMode: 'local', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchPolicy.status, 'blocked');
  assert.equal(report.dispatchPolicy.parallelism, 'serial-only');
  assert.equal(report.dispatchPolicy.blockerIds.includes('gate.verification-results'), true);
  assert.equal(report.dispatchPolicy.blockerIds.includes('runbook.dispatch-merge-triage'), true);
  assert.equal(report.dispatchPolicy.requiredActions.some((item) => /quality-gate full/.test(item.action)), true);
  assert.equal(report.dispatchPolicy.requiredActions.some((item) => /--dispatch local --execute dry-run --format json/.test(item.action)), true);
  assert.equal(report.dispatchPlan.jobs.some((job) => job.jobType === 'merge-gate'), false);
  assert.deepEqual(report.dispatchPlan.jobs.map((job) => job.jobId), [
    'phase.plan',
    'phase.implement',
    'phase.review',
    'phase.security',
  ]);
  assert.deepEqual(report.dispatchPlan.jobs.find((job) => job.jobId === 'phase.security')?.dependsOn, ['phase.review']);
  assert.deepEqual(report.dispatchPolicy.executorPreferences, []);
  assert.deepEqual(report.dispatchPlan.executorRegistry, ['local-phase']);
});

test('runOrchestrate derives ready dispatch policy when observed evidence is clean', async () => {
  const rootDir = await makeRootDir();
  await writeSession(
    rootDir,
    'ready-session',
    { updatedAt: '2026-03-09T02:30:00.000Z', goal: 'Audit login flow hardening' },
    [
      {
        seq: 1,
        ts: '2026-03-09T02:00:00.000Z',
        status: 'done',
        summary: 'Checkpoint 1',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1200,
        },
      },
      {
        seq: 2,
        ts: '2026-03-09T02:05:00.000Z',
        status: 'done',
        summary: 'Checkpoint 2',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1400,
        },
      },
      {
        seq: 3,
        ts: '2026-03-09T02:10:00.000Z',
        status: 'done',
        summary: 'Checkpoint 3',
        nextActions: [],
        artifacts: [],
        telemetry: {
          verification: { result: 'passed', evidence: 'quality-gate pre-pr' },
          retryCount: 0,
          elapsedMs: 1600,
        },
      },
    ]
  );
  await writeDispatchEvidence(rootDir, 'ready-session', {
    ok: true,
    blockedJobs: 0,
    seq: 2,
    ts: '2026-03-09T03:10:00.000Z',
    artifactName: 'dispatch-run-20260309T031000Z.json',
  });

  const logs = [];
  await runOrchestrate(
    { blueprint: 'feature', sessionId: 'ready-session', dispatchMode: 'local', format: 'json' },
    { rootDir, io: { log: (line) => logs.push(line) } }
  );
  const report = JSON.parse(logs.join('\n'));

  assert.equal(report.dispatchPolicy.status, 'ready');
  assert.equal(report.dispatchPolicy.parallelism, 'parallel-with-merge-gate');
  assert.deepEqual(report.dispatchPolicy.blockerIds, []);
  assert.equal(report.dispatchPlan.jobs.some((job) => job.jobType === 'merge-gate'), true);
  assert.equal(report.dispatchPlan.jobs.find((job) => job.jobId === 'phase.security')?.dependsOn.includes('phase.implement'), true);
  assert.equal(report.dispatchPolicy.executorPreferences.every((item) => item.confidence === 'observed'), true);
  assert.equal(report.dispatchPolicy.notes.some((note) => /observed dispatch evidence/i.test(note)), true);
});

test('renderOrchestrationReport includes merge gate guidance', () => {
  const report = renderOrchestrationReport({ blueprint: 'feature', taskTitle: 'Ship blueprints' });
  assert.match(report, /ORCHESTRATION BLUEPRINT: feature/);
  assert.match(report, /Merge Gate:/);
  assert.match(report, /overlapping file ownership/);
});

test('renderOrchestrationReport includes learn-eval overlay summary', () => {
  const report = renderOrchestrationReport({
    blueprint: 'security',
    taskTitle: 'Audit login flow hardening',
    learnEvalOverlay: {
      sourceSessionId: 'security-stable',
      selectedRecommendationId: 'blueprint.security',
      appliedRecommendationIds: ['blueprint.security', 'checklist.verification-standard'],
      appliedRecommendations: [
        { kind: 'promote', targetId: 'blueprint.security', title: 'promote workflow blueprint' },
        { kind: 'promote', targetId: 'checklist.verification-standard', title: 'promote verification checklist' },
      ],
    },
  });
  assert.match(report, /Learn-Eval Overlay:/);
  assert.match(report, /session=security-stable/);
  assert.match(report, /blueprint\.security/);
});

test('renderOrchestrationReport includes dispatch policy summary', () => {
  const report = renderOrchestrationReport({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchPolicy: {
      status: 'blocked',
      parallelism: 'serial-only',
      blockerIds: ['runbook.dispatch-merge-triage'],
      advisoryIds: ['sample.dispatch-evidence-present'],
      requiredActions: [
        { type: 'command', action: 'node scripts/aios.mjs doctor' },
      ],
      executorPreferences: [
        { executor: 'local-phase', confidence: 'observed', observedCount: 2, source: 'dispatch-evidence' },
      ],
      notes: ['Observed dispatch evidence shows merge-gate blockage.'],
    },
  });
  assert.match(report, /Dispatch Policy:/);
  assert.match(report, /status=blocked/);
  assert.match(report, /parallelism=serial-only/);
  assert.match(report, /runbook\.dispatch-merge-triage/);
});

test('renderOrchestrationReport includes local dry-run execution summary', () => {
  const report = renderOrchestrationReport({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchRun: {
      mode: 'dry-run',
      ok: true,
      executorRegistry: ['local-phase', 'local-merge-gate'],
      executorDetails: [
        { id: 'local-phase', label: 'Local Phase Executor', jobTypes: ['phase'], supportedRoles: ['planner', 'implementer', 'reviewer', 'security-reviewer'], outputTypes: ['handoff'], executionModes: ['dry-run'], concurrencyMode: 'parallel-safe', requiresModel: false },
        { id: 'local-merge-gate', label: 'Local Merge Gate Executor', jobTypes: ['merge-gate'], supportedRoles: ['merge-gate'], outputTypes: ['merged-handoff'], executionModes: ['dry-run'], concurrencyMode: 'serial-only', requiresModel: false },
      ],
      jobRuns: [
        { jobId: 'phase.plan', status: 'simulated', output: { outputType: 'handoff' } },
        { jobId: 'merge.final-checks', status: 'simulated', output: { outputType: 'merged-handoff' } },
      ],
    },
  });
  assert.match(report, /Local Dispatch Run:/);
  assert.match(report, /phase\.plan/);
  assert.match(report, /merged-handoff/);
});

test('renderOrchestrationReport includes dispatch run errors when present', () => {
  const report = renderOrchestrationReport({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchRun: {
      mode: 'live',
      ok: false,
      error: 'Live execution is disabled by default.',
      executorRegistry: [],
      executorDetails: [],
      jobRuns: [],
      finalOutputs: [],
    },
  });
  assert.match(report, /Local Dispatch Run:/);
  assert.match(report, /error=Live execution is disabled by default\./);
});

test('renderOrchestrationReport includes dispatch evidence summary', () => {
  const report = renderOrchestrationReport({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchEvidence: {
      persisted: true,
      artifactPath: 'memory/context-db/sessions/security-stable/artifacts/dispatch-run-20260309T030000Z.json',
      eventId: 'security-stable#1',
      checkpointId: 'security-stable#C4',
    },
  });
  assert.match(report, /Dispatch Evidence:/);
  assert.match(report, /security-stable#1/);
  assert.match(report, /dispatch-run-20260309T030000Z\.json/);
});

test('renderOrchestrationReport includes dispatch evidence reasons when present', () => {
  const report = renderOrchestrationReport({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchEvidence: {
      persisted: false,
      reason: 'mode-unsupported',
      mode: 'live',
    },
  });
  assert.match(report, /Dispatch Evidence:/);
  assert.match(report, /reason=mode-unsupported/);
});

test('renderOrchestrationReport includes local dispatch skeleton summary', () => {
  const report = renderOrchestrationReport({
    blueprint: 'feature',
    taskTitle: 'Ship blueprints',
    dispatchPlan: {
      mode: 'local',
      readyForExecution: false,
      executorRegistry: ['local-phase', 'local-merge-gate'],
      executorDetails: [
        { id: 'local-phase', label: 'Local Phase Executor', jobTypes: ['phase'], supportedRoles: ['planner', 'implementer', 'reviewer', 'security-reviewer'], outputTypes: ['handoff'], executionModes: ['dry-run'], concurrencyMode: 'parallel-safe', requiresModel: false },
        { id: 'local-merge-gate', label: 'Local Merge Gate Executor', jobTypes: ['merge-gate'], supportedRoles: ['merge-gate'], outputTypes: ['merged-handoff'], executionModes: ['dry-run'], concurrencyMode: 'serial-only', requiresModel: false },
      ],
      jobs: [
        { jobId: 'phase.plan', jobType: 'phase', role: 'planner', dependsOn: [], launchSpec: { executor: 'local-phase', requiresModel: false } },
        { jobId: 'merge.final-checks', jobType: 'merge-gate', role: 'merge-gate', dependsOn: ['phase.review', 'phase.security'], launchSpec: { executor: 'local-merge-gate', requiresModel: false } },
      ],
    },
  });
  assert.match(report, /Local Dispatch Skeleton:/);
  assert.match(report, /phase\.plan/);
  assert.match(report, /merge\.final-checks/);
});
