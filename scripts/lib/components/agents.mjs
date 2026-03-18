import { resolveAgentTargets, syncCanonicalAgents } from '../agents/sync.mjs';

export async function installOrchestratorAgents({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  const targets = resolveAgentTargets(client);
  const result = await syncCanonicalAgents({ rootDir, io, targets, mode: 'install' });

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
  const result = await syncCanonicalAgents({
    rootDir,
    io,
    targets,
    mode: 'uninstall',
    writeCompatibilityExport: false,
  });

  for (const item of result.results) {
    io.log(`[done] agents ${item.targetRel} -> removed=${item.removed} skipped=${item.skipped}`);
  }

  return result;
}
