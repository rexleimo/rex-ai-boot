import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildLocalDispatchPlan, buildOrchestrationPlan } from '../lib/harness/orchestrator.mjs';

async function importAgentModule() {
  try {
    return await import('../lib/harness/orchestrator-agents.mjs');
  } catch {
    return null;
  }
}

async function makeRootDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'aios-orchestrator-agents-'));
}

test('orchestrator agent module exists', async () => {
  const agents = await importAgentModule();
  assert.ok(agents, 'expected orchestrator-agents module');
});

test('resolveAgentRefIdForRole maps role ids to stable agent ids', async () => {
  const agents = await importAgentModule();
  assert.ok(agents, 'expected orchestrator-agents module');

  assert.equal(agents.resolveAgentRefIdForRole('planner'), 'rex-planner');
  assert.equal(agents.resolveAgentRefIdForRole('implementer'), 'rex-implementer');
  assert.equal(agents.resolveAgentRefIdForRole('reviewer'), 'rex-reviewer');
  assert.equal(agents.resolveAgentRefIdForRole('security-reviewer'), 'rex-security-reviewer');
});

test('renderAgentMarkdown emits YAML frontmatter and a managed marker', async () => {
  const agents = await importAgentModule();
  assert.ok(agents, 'expected orchestrator-agents module');

  const md = agents.renderAgentMarkdown({
    name: 'rex-planner',
    description: 'Planner role',
    tools: ['Read'],
    model: 'sonnet',
    role: 'planner',
    handoffTarget: 'next-phase',
    systemPrompt: 'You are the planner.',
  });

  assert.match(md, /^---/);
  assert.match(md, /name:\s*rex-planner/);
  assert.match(md, /tools:\s*\[/);
  assert.match(md, /<!--\s*AIOS-GENERATED: orchestrator-agents v1\s*-->/);
  assert.match(md, /output a single JSON object/i);
});

test('syncGeneratedAgents writes managed files and skips non-managed files', async () => {
  const agents = await importAgentModule();
  assert.ok(agents, 'expected orchestrator-agents module');

  const rootDir = await makeRootDir();
  const claudeDir = path.join(rootDir, '.claude', 'agents');
  const codexDir = path.join(rootDir, '.codex', 'agents');
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.mkdir(codexDir, { recursive: true });

  // A manual file (no marker) must never be overwritten.
  await fs.writeFile(path.join(claudeDir, 'rex-planner.md'), 'manual\n', 'utf8');

  const spec = {
    schemaVersion: 1,
    roleMap: { planner: 'rex-planner' },
    agents: {
      'rex-planner': {
        name: 'rex-planner',
        description: 'Planner role',
        tools: ['Read'],
        model: 'sonnet',
        role: 'planner',
        handoffTarget: 'next-phase',
        systemPrompt: 'You are the planner.',
      },
    },
  };

  const result = await agents.syncGeneratedAgents({ rootDir, spec });
  assert.equal(result.ok, true);
  assert.equal(result.targets.includes('.claude/agents'), true);

  const manual = await fs.readFile(path.join(claudeDir, 'rex-planner.md'), 'utf8');
  assert.equal(manual, 'manual\n');

  const generated = await fs.readFile(path.join(codexDir, 'rex-planner.md'), 'utf8');
  assert.match(generated, /AIOS-GENERATED/);
});

test('buildLocalDispatchPlan injects agentRefId into phase job launchSpec', () => {
  const orchestration = buildOrchestrationPlan({ blueprint: 'feature', taskTitle: 'Ship blueprints' });
  const dispatch = buildLocalDispatchPlan(orchestration);

  const phaseJobs = dispatch.jobs.filter((job) => job.jobType === 'phase');
  assert.equal(phaseJobs.length > 0, true);
  assert.equal(phaseJobs.every((job) => typeof job.launchSpec.agentRefId === 'string' && job.launchSpec.agentRefId.length > 0), true);
});

