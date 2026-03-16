import fs from 'node:fs';
import path from 'node:path';

import agentSpec from '../../../memory/specs/orchestrator-agents.json' with { type: 'json' };

export const ORCHESTRATOR_AGENT_MARKER = '<!-- AIOS-GENERATED: orchestrator-agents v1 -->';
const ORCHESTRATOR_AGENT_MARKER_END = '<!-- END AIOS-GENERATED -->';

function normalizeId(value) {
  return String(value || '').trim();
}

function normalizeRoleId(value) {
  return normalizeId(value).toLowerCase();
}

function normalizeAgentId(value) {
  const id = normalizeId(value).toLowerCase();
  return id.length > 0 ? id : '';
}

function normalizeTools(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeId(item)).filter(Boolean);
  }
  const text = normalizeId(value);
  return text ? [text] : [];
}

export function normalizeOrchestratorAgentSpec(raw = {}) {
  const schemaVersion = Number(raw?.schemaVersion) || 1;
  const roleMap = raw?.roleMap && typeof raw.roleMap === 'object' ? { ...raw.roleMap } : {};
  const agents = raw?.agents && typeof raw.agents === 'object' ? { ...raw.agents } : {};

  const normalizedAgents = {};
  for (const [agentId, agent] of Object.entries(agents)) {
    const id = normalizeAgentId(agentId);
    if (!id) continue;
    normalizedAgents[id] = {
      name: normalizeAgentId(agent?.name || id) || id,
      description: normalizeId(agent?.description),
      tools: normalizeTools(agent?.tools),
      model: normalizeId(agent?.model),
      role: normalizeRoleId(agent?.role),
      handoffTarget: normalizeId(agent?.handoffTarget || 'next-phase'),
      systemPrompt: normalizeId(agent?.systemPrompt),
    };
  }

  const normalizedRoleMap = {};
  for (const [roleId, agentId] of Object.entries(roleMap)) {
    const role = normalizeRoleId(roleId);
    const mapped = normalizeAgentId(agentId);
    if (!role || !mapped) continue;
    normalizedRoleMap[role] = mapped;
  }

  return {
    schemaVersion,
    roleMap: normalizedRoleMap,
    agents: normalizedAgents,
  };
}

export function resolveAgentRefIdForRole(roleId, spec = agentSpec) {
  const normalized = normalizeRoleId(roleId);
  const resolvedSpec = normalizeOrchestratorAgentSpec(spec);
  const mapped = normalizeAgentId(resolvedSpec.roleMap[normalized]);
  if (mapped) return mapped;

  // Fallback keeps dispatch plans stable even if roleMap is incomplete.
  const fallback = normalizeAgentId(normalized);
  return fallback || null;
}

function escapeYamlString(value) {
  const raw = normalizeId(value);
  const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function renderAgentMarkdown(rawAgent = {}) {
  const agent = {
    name: normalizeAgentId(rawAgent?.name),
    description: normalizeId(rawAgent?.description),
    tools: normalizeTools(rawAgent?.tools),
    model: normalizeId(rawAgent?.model),
    role: normalizeRoleId(rawAgent?.role),
    handoffTarget: normalizeId(rawAgent?.handoffTarget || 'next-phase'),
    systemPrompt: normalizeId(rawAgent?.systemPrompt),
  };

  const toolsYaml = `[${agent.tools.map((tool) => escapeYamlString(tool)).join(', ')}]`;

  const body = [
    ORCHESTRATOR_AGENT_MARKER,
    '',
    `Role: ${agent.role || '(unknown)'}`,
    '',
    agent.systemPrompt || 'You are a role-based subagent for AIOS orchestrations.',
    '',
    'Output Contract',
    'Output a single JSON object (no surrounding text) that conforms to `memory/specs/agent-handoff.schema.json`.',
    '',
    'Required fields:',
    '- schemaVersion',
    '- status',
    '- fromRole',
    '- toRole',
    '- taskTitle',
    '- contextSummary',
    '- findings',
    '- filesTouched',
    '- openQuestions',
    '- recommendations',
    '',
    `Set \`fromRole=${agent.role || 'unknown'}\` and \`toRole=${agent.handoffTarget || 'next-phase'}\`.`,
    '',
    ORCHESTRATOR_AGENT_MARKER_END,
    '',
  ].join('\n');

  return [
    '---',
    `name: ${agent.name}`,
    `description: ${escapeYamlString(agent.description)}`,
    `tools: ${toolsYaml}`,
    `model: ${agent.model || 'sonnet'}`,
    '---',
    '',
    body,
  ].join('\n');
}

function hasManagedMarker(content) {
  return String(content || '').includes(ORCHESTRATOR_AGENT_MARKER);
}

function listMarkdownFiles(absDir) {
  try {
    return fs.readdirSync(absDir, { withFileTypes: true })
      .filter((ent) => ent.isFile() && ent.name.toLowerCase().endsWith('.md'))
      .map((ent) => ent.name);
  } catch {
    return [];
  }
}

function writeFileUtf8(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
}

function readFileUtf8Optional(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function removeFile(absPath) {
  try {
    fs.rmSync(absPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function syncOneTarget({ rootDir, targetRel, spec, io }) {
  const absDir = path.join(rootDir, targetRel);
  fs.mkdirSync(absDir, { recursive: true });

  const normalized = normalizeOrchestratorAgentSpec(spec);
  const expected = new Set(Object.keys(normalized.agents).map((id) => `${id}.md`));

  let installed = 0;
  let updated = 0;
  let skipped = 0;
  let removed = 0;

  for (const [agentId, agent] of Object.entries(normalized.agents)) {
    const fileName = `${agentId}.md`;
    const absPath = path.join(absDir, fileName);
    const next = renderAgentMarkdown(agent);
    const existing = readFileUtf8Optional(absPath);

    if (!existing) {
      writeFileUtf8(absPath, next);
      installed += 1;
      continue;
    }

    if (!hasManagedMarker(existing)) {
      skipped += 1;
      io?.log?.(`[agents] skip (unmanaged): ${targetRel}/${fileName}`);
      continue;
    }

    if (existing !== next) {
      writeFileUtf8(absPath, next);
      updated += 1;
    }
  }

  for (const fileName of listMarkdownFiles(absDir)) {
    if (expected.has(fileName)) continue;
    const absPath = path.join(absDir, fileName);
    const existing = readFileUtf8Optional(absPath);
    if (!hasManagedMarker(existing)) continue;
    if (removeFile(absPath)) {
      removed += 1;
    }
  }

  return {
    targetRel,
    installed,
    updated,
    skipped,
    removed,
  };
}

export async function syncGeneratedAgents({ rootDir, spec = agentSpec, io = console, targets = null } = {}) {
  const fallbackTargets = ['.claude/agents', '.codex/agents'];
  const selectedTargets = Array.isArray(targets) && targets.length > 0
    ? [...new Set(targets.map((value) => String(value || '').trim()).filter(Boolean))]
    : fallbackTargets;
  const results = selectedTargets.map((targetRel) => syncOneTarget({ rootDir, targetRel, spec, io }));
  return {
    ok: true,
    targets: selectedTargets,
    results,
  };
}
