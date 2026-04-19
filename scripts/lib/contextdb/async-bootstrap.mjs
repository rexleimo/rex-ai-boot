import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateFacadeFromSession } from './facade.mjs';

export async function runAsyncBootstrap(
  workspaceRoot,
  { agent, project, safeContextPack }
) {
  try {
    const packPath = path.join('memory', 'context-db', 'exports', `latest-${agent}-context.md`);
    const packResult = await safeContextPack(workspaceRoot, {
      sessionId: '', // safeContextPack resolves session internally when empty
      eventLimit: 30,
      packPath,
    });

    const facade = await generateFacadeFromSession(workspaceRoot, agent, project);
    facade.hasStalePack = packResult.mode !== 'fresh';
    facade.contextPacketPath = packPath;

    const facadePath = path.join(workspaceRoot, 'memory', 'context-db', '.facade.json');
    await writeFile(facadePath, JSON.stringify(facade, null, 2) + '\n', 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] async bootstrap failed: ${reason}`);
  }
}
