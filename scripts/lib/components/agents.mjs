import { syncGeneratedAgents } from '../harness/orchestrator-agents.mjs';

function resolveAgentTargets(client = 'all') {
  const normalized = String(client || 'all').trim().toLowerCase();
  if (normalized === 'claude') return ['.claude/agents'];
  if (normalized === 'codex') return ['.codex/agents'];
  // Gemini/OpenCode do not have a native repo agent root yet; reuse both catalogs.
  return ['.claude/agents', '.codex/agents'];
}

export async function installOrchestratorAgents({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  const targets = resolveAgentTargets(client);
  const result = await syncGeneratedAgents({ rootDir, io, targets });

  for (const item of result.results) {
    io.log(`[done] agents ${item.targetRel} -> installed=${item.installed} updated=${item.updated} skipped=${item.skipped} removed=${item.removed}`);
  }

  return result;
}

export async function uninstallOrchestratorAgents({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  const targets = resolveAgentTargets(client);
  const emptySpec = { schemaVersion: 1, roleMap: {}, agents: {} };
  const result = await syncGeneratedAgents({ rootDir, io, targets, spec: emptySpec });

  for (const item of result.results) {
    io.log(`[done] agents ${item.targetRel} -> removed=${item.removed} skipped=${item.skipped}`);
  }

  return result;
}

