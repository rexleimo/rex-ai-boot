import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { runContextDbCli } from '../contextdb-cli.mjs';
import { generateFacadeFromSession } from './facade.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = { workspaceRoot: '', agent: '', project: '' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1] || '';
    if (key === '--workspace') opts.workspaceRoot = value;
    if (key === '--agent') opts.agent = value;
    if (key === '--project') opts.project = value;
  }
  return opts;
}

async function minimalSafeContextPack(workspaceRoot, { eventLimit, packPath }, agent, project) {
  const packAbs = path.join(workspaceRoot, packPath);
  try {
    runContextDbCli(['init'], { cwd: workspaceRoot });
    const latestResult = runContextDbCli(['session:latest', '--agent', agent, '--project', project], { cwd: workspaceRoot });
    const lines = String(latestResult.stdout || '').trim().split(/\r?\n/);
    const lastLine = lines.at(-1) || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(lastLine);
    } catch {
      // ignore parse failure
    }
    const sessionId = parsed.sessionId;
    if (!sessionId) {
      return { ok: false, mode: 'none', packAbs, contextText: '' };
    }
    runContextDbCli(['context:pack', '--session', sessionId, '--limit', String(eventLimit), '--out', packPath], { cwd: workspaceRoot });
    const contextText = await readFile(packAbs, 'utf8');
    return { ok: true, mode: 'fresh', packAbs, contextText };
  } catch {
    try {
      const contextText = await readFile(packAbs, 'utf8');
      if (String(contextText).trim()) {
        return { ok: true, mode: 'stale', packAbs, contextText };
      }
    } catch {
      // ignore missing stale pack
    }
    return { ok: false, mode: 'none', packAbs, contextText: '' };
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workspaceRoot || !opts.agent || !opts.project) {
    console.error('Usage: node async-bootstrap-runner.mjs --workspace <path> --agent <name> --project <name>');
    process.exit(1);
  }

  const packPath = path.join('memory', 'context-db', 'exports', `latest-${opts.agent}-context.md`);
  const packResult = await minimalSafeContextPack(
    opts.workspaceRoot,
    { eventLimit: 30, packPath },
    opts.agent,
    opts.project
  );

  const facade = await generateFacadeFromSession(opts.workspaceRoot, opts.agent, opts.project);
  facade.hasStalePack = packResult.mode !== 'fresh';
  facade.contextPacketPath = packPath;

  const facadePath = path.join(opts.workspaceRoot, 'memory', 'context-db', '.facade.json');
  await writeFile(facadePath, JSON.stringify(facade, null, 2) + '\n', 'utf8');
}

main().catch((err) => {
  console.error('[async-bootstrap-runner]', err.message || String(err));
  process.exit(1);
});
