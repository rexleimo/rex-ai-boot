import { spawnSync } from 'node:child_process';
import { getCommandSpawnSpec } from './lib/platform/process.mjs';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBootstrapTask, isBootstrapEnabled } from './ctx-bootstrap.mjs';
import {
  normalizeWorkspaceMemorySpace,
  workspaceMemoryEventsPath,
  workspaceMemoryMetaPath,
  workspaceMemoryPinnedPath,
  workspaceMemorySessionId,
  workspaceMemoryStatePath,
} from './lib/memo/workspace-memory.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MCP_DIR = path.join(ROOT_DIR, 'mcp-server');

function usage() {
  console.log(`Usage:
  scripts/ctx-agent.mjs --agent <claude-code|gemini-cli|codex-cli|opencode-cli> [options] [-- <extra agent args>]

Options:
  --agent <name>      Agent name: claude-code | gemini-cli | codex-cli | opencode-cli
  --workspace <path>  Workspace root to store context-db (default: current git root, else current dir)
  --project <name>    Project name (default: current directory name)
  --goal <text>       Session goal (used when creating a new session)
  --session <id>      Reuse a specific session id
  --prompt <text>     Run one-shot mode and auto log request/response/checkpoint
  --limit <n>         Number of recent events in context packet (default: 30)
  --status <state>    Checkpoint status on success: running|blocked|done (default: running)
  --no-bootstrap      Disable automatic first-task bootstrap for this run
  --no-checkpoint     Disable automatic checkpoint write in one-shot mode
  --dry-run           Skip remote model call, write synthetic response for pipeline testing
  --max-log-chars <n> Max characters stored in event logs (default: 8000)
  -h, --help          Show this help`);
  console.log(`
Environment:
  CTXDB_AUTO_REBUILD_NATIVE 1/true/yes/on to auto-rebuild better-sqlite3 on Node ABI mismatch (default: on)`);
}

function runCommand(command, args, options = {}) {
  const spec = getCommandSpawnSpec(command, args, options);
  const result = spawnSync(spec.command, spec.args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['pipe', 'pipe', 'pipe'],
    shell: spec.shell ?? false,
  });

  return result;
}

function runCommandWithInput(command, args, input, options = {}) {
  const spec = getCommandSpawnSpec(command, args, options);
  const result = spawnSync(spec.command, spec.args, {
    cwd: options.cwd,
    encoding: 'utf8',
    input: String(input ?? ''),
    stdio: options.stdio ?? ['pipe', 'pipe', 'pipe'],
    shell: spec.shell ?? false,
  });

  return result;
}

function ensureSuccess(result, context) {
  if (result.error) {
    const reason = result.error.message || String(result.error);
    throw new Error(`${context}: ${reason}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const detail = stderr || stdout || `exit=${result.status}`;
    throw new Error(`${context}: ${detail}`);
  }
}

function parseBoolEnv(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return defaultValue;
}

function shouldInjectWorkspaceMemory(env = process.env) {
  return parseBoolEnv(env.CTXDB_WORKSPACE_MEMORY, true);
}

function parseBoundedIntegerEnv(value, defaultValue, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(parsed, min), max);
}

async function readActiveSpaceFromState(workspaceRoot) {
  try {
    const raw = await fs.readFile(workspaceMemoryStatePath(workspaceRoot), 'utf8');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.activeSpace === 'string' ? parsed.activeSpace.trim() : '';
  } catch {
    return '';
  }
}

async function resolveWorkspaceMemorySpace(workspaceRoot, env = process.env) {
  const envSpace = String(env.WORKSPACE_MEMORY_SPACE || '').trim();
  if (envSpace) return normalizeWorkspaceMemorySpace(envSpace);
  const stored = await readActiveSpaceFromState(workspaceRoot);
  if (stored) return normalizeWorkspaceMemorySpace(stored);
  return 'default';
}

async function readTailText(filePath, maxBytes) {
  try {
    const stats = await fs.stat(filePath);
    const size = Number(stats.size) || 0;
    if (size <= 0) return '';
    const readSize = Math.min(size, maxBytes);
    const start = size - readSize;

    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, start);
      let text = buffer.toString('utf8');
      if (start > 0) {
        const newline = text.indexOf('\n');
        text = newline >= 0 ? text.slice(newline + 1) : '';
      }
      return text;
    } finally {
      await handle.close();
    }
  } catch {
    return '';
  }
}

function formatWorkspaceMemoRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return '';
  const tokens = refs
    .map((ref) => String(ref || '').trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((ref) => `#${ref}`);
  return tokens.length > 0 ? ` ${tokens.join(' ')}` : '';
}

function formatWorkspaceMemoLine(event) {
  const ts = event?.ts ? String(event.ts) : '';
  const rawText = event?.text ? String(event.text) : '';
  const text = rawText.replace(/\s+/g, ' ').trim();
  const refsLabel = formatWorkspaceMemoRefs(event?.refs);
  return ts ? `- [${ts}]${refsLabel}: ${text}` : `- ${text}`;
}

async function loadRecentMemoEvents(eventsPath, limit) {
  if (limit <= 0) return [];
  const tail = await readTailText(eventsPath, 1_000_000);
  if (!tail.trim()) return [];

  const lines = tail.split('\n');
  const results = [];
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = String(lines[index] || '').trim();
    if (!line) continue;
    try {
      const event = JSON.parse(line);
      if (event?.kind !== 'memo') continue;
      if (event?.role && String(event.role) !== 'user') continue;
      results.push(event);
      if (results.length >= limit) break;
    } catch {
      // ignore malformed lines
    }
  }
  return results;
}

export async function buildWorkspaceMemoryOverlay(workspaceRoot, env = process.env) {
  if (!shouldInjectWorkspaceMemory(env)) return '';

  const space = await resolveWorkspaceMemorySpace(workspaceRoot, env);
  const maxChars = parseBoundedIntegerEnv(env.WORKSPACE_MEMORY_MAX_CHARS, 4000, { min: 256, max: 20000 });
  const recentLimit = parseBoundedIntegerEnv(env.WORKSPACE_MEMORY_RECENT_LIMIT, 10, { min: 0, max: 50 });

  const sessionId = workspaceMemorySessionId(space);
  if (!existsSync(workspaceMemoryMetaPath(workspaceRoot, sessionId))) {
    return '';
  }

  let pinned = '';
  try {
    pinned = await fs.readFile(workspaceMemoryPinnedPath(workspaceRoot, sessionId), 'utf8');
  } catch {
    pinned = '';
  }
  pinned = String(pinned || '').trim();

  const memos = await loadRecentMemoEvents(workspaceMemoryEventsPath(workspaceRoot, sessionId), recentLimit);

  if (!pinned && memos.length === 0) {
    return '';
  }

  const sections = [`## Workspace Memory`, `Space: ${space}`];
  if (pinned) {
    sections.push('### Pinned', pinned);
  }
  if (memos.length > 0) {
    const lines = memos.map((event) => formatWorkspaceMemoLine(event));
    sections.push('### Recent memos', lines.join('\n'));
  }

  const overlayRaw = `${sections.join('\n\n')}\n`;
  if (overlayRaw.length <= maxChars) {
    return overlayRaw;
  }

  const suffix = '\n[workspace memory truncated]\n';
  const budget = Math.max(0, maxChars - suffix.length);
  const trimmed = overlayRaw.slice(0, budget).trimEnd();
  return `${trimmed}${suffix}`;
}

export function shouldAutoRebuildNative(env = process.env) {
  return parseBoolEnv(env.CTXDB_AUTO_REBUILD_NATIVE, true);
}

function shouldStrictContextPack(env = process.env) {
  return parseBoolEnv(env.CTXDB_PACK_STRICT, false);
}

function getAutoPrompt(env = process.env) {
  const value = String(env.CTXDB_AUTO_PROMPT || '').trim();
  return value || '';
}

function extractHandoffPrompt(contextText) {
  const text = String(contextText || '');
  if (!text) return '';
  const match = /(^|\n)## Handoff Prompt\s*\n([\s\S]*?)(\n## |\n?$)/u.exec(text);
  if (!match || !match[2]) return '';
  return String(match[2]).trim();
}

const DEFAULT_HANDOFF_PROMPT = 'Continue from this state. Preserve constraints, avoid repeating completed work, and update the next checkpoint when done.';

async function writeLatestInjectedContext({ workspaceRoot, agent, sessionId, contextText }) {
  const text = String(contextText || '').trimEnd();
  if (!text) return { ok: false, relPath: '', absPath: '' };

  const relPath = path.join('memory', 'context-db', 'exports', `latest-${agent}-context.md`);
  const absPath = path.join(workspaceRoot, relPath);
  const generatedAt = new Date().toISOString();
  const header = `<!-- AIOS: latest injected context for ${agent}; session=${sessionId}; generated=${generatedAt} -->\n`;
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, `${header}${text}\n`, 'utf8');
  return { ok: true, relPath, absPath };
}

function buildOpenCodePrompt({
  contextPacketPath = '',
  contextText = '',
  prompt = '',
  injectContext = true,
  promptKind = 'request',
} = {}) {
  const requestText = String(prompt || '').trim();
  const inlineContext = String(contextText || '').trim();

  if (!injectContext) {
    return requestText;
  }

  if (contextPacketPath) {
    const handoffText = requestText || (promptKind === 'handoff' ? DEFAULT_HANDOFF_PROMPT : '');
    if (!handoffText) {
      return `Read the context packet at "${contextPacketPath}" first.`;
    }
    if (promptKind === 'handoff') {
      return `Read the context packet at "${contextPacketPath}" first.\n\n${handoffText}`;
    }
    return `Read the context packet at "${contextPacketPath}" first.\n\nThen continue with this request:\n${handoffText}`;
  }

  if (!inlineContext) {
    return requestText || (promptKind === 'handoff' ? DEFAULT_HANDOFF_PROMPT : '');
  }

  const handoffText = requestText || (promptKind === 'handoff' ? DEFAULT_HANDOFF_PROMPT : '');
  if (!handoffText) {
    return inlineContext;
  }
  if (promptKind === 'handoff') {
    return `${inlineContext}\n\n${handoffText}`;
  }
  return `${inlineContext}\n\n## New User Request\n${handoffText}`;
}

function getCommandFailureDetail(result) {
  if (result.error) {
    return result.error.message || String(result.error);
  }
  const stderr = (result.stderr || '').trim();
  const stdout = (result.stdout || '').trim();
  return stderr || stdout || `exit=${result.status ?? 1}`;
}

export function isBetterSqlite3AbiMismatch(detail) {
  if (!detail) return false;
  const normalized = String(detail).toLowerCase();
  const mentionsAddon = normalized.includes('better_sqlite3.node') || normalized.includes('better-sqlite3');
  const mentionsAbi = normalized.includes('node_module_version')
    || normalized.includes('compiled against a different node.js version');
  return mentionsAddon && mentionsAbi;
}
export function classifyOneShotFailure(detail) {
  if (!detail) return undefined;
  const normalized = String(detail).toLowerCase();
  if (normalized.includes('timeout') || normalized.includes('timed out')) return 'timeout';
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) return 'rate-limit';
  if (normalized.includes('auth') || normalized.includes('login')) return 'auth';
  if (normalized.includes('network') || normalized.includes('enotfound') || normalized.includes('econn')) return 'network';
  if (normalized.includes('permission') || normalized.includes('denied')) return 'permission';
  return 'tool';
}

function resolveWorkspaceRoot(cwd) {
  const git = runCommand('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
  if (git.status === 0) {
    return (git.stdout || '').trim();
  }
  return cwd;
}

function parseArgs(argv) {
  const opts = {
    agent: '',
    project: '',
    workspaceRoot: '',
    goal: '',
    sessionId: '',
    prompt: '',
    eventLimit: '30',
    checkpointStatus: 'running',
    autoBootstrap: true,
    autoCheckpoint: true,
    dryRun: false,
    maxLogChars: '8000',
    extraArgs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--agent':
        opts.agent = argv[++i] || '';
        break;
      case '--workspace':
        opts.workspaceRoot = argv[++i] || '';
        break;
      case '--project':
        opts.project = argv[++i] || '';
        break;
      case '--goal':
        opts.goal = argv[++i] || '';
        break;
      case '--session':
        opts.sessionId = argv[++i] || '';
        break;
      case '--prompt':
        opts.prompt = argv[++i] || '';
        break;
      case '--limit':
        opts.eventLimit = argv[++i] || '30';
        break;
      case '--status':
        opts.checkpointStatus = argv[++i] || 'running';
        break;
      case '--no-bootstrap':
        opts.autoBootstrap = false;
        break;
      case '--no-checkpoint':
        opts.autoCheckpoint = false;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--max-log-chars':
        opts.maxLogChars = argv[++i] || '8000';
        break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      case '--':
        opts.extraArgs = argv.slice(i + 1);
        i = argv.length;
        break;
      default:
        opts.extraArgs.push(arg);
        break;
    }
  }

  return opts;
}

function validateOpts(opts) {
  if (!opts.agent) {
    throw new Error('Missing required --agent');
  }
  const validAgents = new Set(['claude-code', 'gemini-cli', 'codex-cli', 'opencode-cli']);
  if (!validAgents.has(opts.agent)) {
    throw new Error('--agent must be one of: claude-code, gemini-cli, codex-cli, opencode-cli');
  }
  const validStatus = new Set(['running', 'blocked', 'done']);
  if (!validStatus.has(opts.checkpointStatus)) {
    throw new Error('--status must be one of: running, blocked, done');
  }
  if (!/^\d+$/.test(opts.maxLogChars)) {
    throw new Error('--max-log-chars must be a non-negative integer');
  }
}

let nativeRepairAttempted = false;

function ctx(workspaceRoot, subcommand, args) {
  const commandArgs = ['run', '-s', 'contextdb', '--', subcommand, '--workspace', workspaceRoot, ...args];
  const firstResult = runCommand('npm', commandArgs, {
    cwd: MCP_DIR,
  });

  if (!firstResult.error && firstResult.status === 0) {
    return (firstResult.stdout || '').trim();
  }

  const firstFailure = getCommandFailureDetail(firstResult);
  const shouldRetryWithRepair = !nativeRepairAttempted
    && shouldAutoRebuildNative(process.env)
    && isBetterSqlite3AbiMismatch(firstFailure);

  if (!shouldRetryWithRepair) {
    ensureSuccess(firstResult, `contextdb ${subcommand} failed`);
    return (firstResult.stdout || '').trim();
  }

  nativeRepairAttempted = true;
  console.warn('[contextdb] Detected better-sqlite3 Node ABI mismatch. Running `npm rebuild better-sqlite3` and retrying once.');

  const rebuildResult = runCommand('npm', ['rebuild', 'better-sqlite3'], {
    cwd: MCP_DIR,
  });
  if (rebuildResult.error || rebuildResult.status !== 0) {
    const rebuildFailure = getCommandFailureDetail(rebuildResult);
    throw new Error(`contextdb ${subcommand} failed: ${firstFailure}\nauto-rebuild failed: ${rebuildFailure}`);
  }

  const retryResult = runCommand('npm', commandArgs, {
    cwd: MCP_DIR,
  });
  ensureSuccess(retryResult, `contextdb ${subcommand} failed`);
  return (retryResult.stdout || '').trim();
}

function parseJsonValue(text, getter) {
  if (!text) return '';
  const data = JSON.parse(text);
  return getter(data) || '';
}

function extractLatestSessionId(jsonText) {
  return parseJsonValue(jsonText, (x) => x?.data?.session?.sessionId || x?.session?.sessionId);
}

function extractCreatedSessionId(jsonText) {
  return parseJsonValue(jsonText, (x) => x?.data?.sessionId || x?.sessionId);
}

function runOneShotAgent(agent, contextText, prompt, extraArgs, { injectContext = true, contextPacketPath = '' } = {}) {
  let cmd = '';
  let args = [];

  if (agent === 'claude-code') {
    cmd = 'claude';
    args = injectContext
      ? ['--print', '--append-system-prompt', contextText, prompt, ...extraArgs]
      : ['--print', prompt, ...extraArgs];
  } else if (agent === 'gemini-cli') {
    cmd = 'gemini';
    if (injectContext) {
      const fullPrompt = `${contextText}\n\n## New User Request\n${prompt}`;
      args = ['-p', fullPrompt, ...extraArgs];
    } else {
      args = ['-p', prompt, ...extraArgs];
    }
  } else if (agent === 'codex-cli') {
    cmd = 'codex';
    if (injectContext) {
      const fullPrompt = `${contextText}\n\n## New User Request\n${prompt}`;
      args = ['exec', '-', ...extraArgs];
      const result = runCommandWithInput(cmd, args, fullPrompt);
      const output = `${result.stdout || ''}${result.stderr || ''}`;
      const exitCode = result.status ?? 1;
      return { output, exitCode };
    } else {
      args = ['exec', '-', ...extraArgs];
      const result = runCommandWithInput(cmd, args, prompt);
      const output = `${result.stdout || ''}${result.stderr || ''}`;
      const exitCode = result.status ?? 1;
      return { output, exitCode };
    }
  } else {
    cmd = 'opencode';
    const fullPrompt = buildOpenCodePrompt({
      contextPacketPath,
      contextText,
      prompt,
      injectContext,
      promptKind: 'request',
    });
    args = ['run', ...extraArgs, fullPrompt];
  }

  const result = runCommand(cmd, args);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const exitCode = result.status ?? 1;
  return { output, exitCode };
}

function runInteractiveAgent(agent, contextText, extraArgs, { injectContext = true, contextPacketPath = '' } = {}) {
  let cmd = '';
  let args = [];
  const explicitAutoPrompt = getAutoPrompt(process.env);
  const handoffPrompt = extractHandoffPrompt(contextText);
  const autoPrompt = explicitAutoPrompt || handoffPrompt;

  if (agent === 'claude-code') {
    cmd = 'claude';
    args = injectContext ? ['--append-system-prompt', contextText, ...extraArgs] : [...extraArgs];
    if (autoPrompt) {
      const promptSource = explicitAutoPrompt ? 'env' : 'context handoff';
      console.log(`Auto prompt: enabled (${promptSource})`);
      args.push(autoPrompt);
    }
  } else if (agent === 'gemini-cli') {
    cmd = 'gemini';
    args = injectContext ? ['-i', contextText, ...extraArgs] : [...extraArgs];
  } else if (agent === 'codex-cli') {
    cmd = 'codex';
    let shouldInject = injectContext;
    if (shouldInject && process.platform === 'win32') {
      const spec = getCommandSpawnSpec(cmd, [], { env: process.env });
      if (spec.shell === true) {
        shouldInject = false;
        console.warn('[warn] Windows shell wrapper detected for codex; skipping auto prompt injection. Paste the context packet as your first prompt.');
      }
    }
    args = shouldInject ? [...extraArgs, contextText] : [...extraArgs];
  } else {
    cmd = 'opencode';
    const promptText = buildOpenCodePrompt({
      contextPacketPath,
      contextText,
      prompt: autoPrompt,
      injectContext,
      promptKind: 'handoff',
    });
    args = promptText ? ['--prompt', promptText, ...extraArgs] : [...extraArgs];
    if (promptText) {
      const promptSource = explicitAutoPrompt
        ? (contextPacketPath && injectContext ? 'env via file' : 'env')
        : (contextPacketPath && injectContext ? 'context handoff via file' : 'context handoff');
      console.log(`Auto prompt: enabled (${promptSource})`);
    }
  }

  const result = runCommand(cmd, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message || String(result.error));
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

async function ensureOpenCodeContextPacket({ workspaceRoot, sessionId, packAbs, contextText, baseContextText }) {
  const effectiveContext = String(contextText || '').trim();
  if (!effectiveContext) {
    return '';
  }

  const baseText = String(baseContextText || '').trim();
  if (packAbs && effectiveContext === baseText) {
    return packAbs;
  }

  const exportsDir = packAbs
    ? path.dirname(packAbs)
    : path.join(workspaceRoot, 'memory', 'context-db', 'exports');
  await fs.mkdir(exportsDir, { recursive: true });

  const filePath = packAbs
    ? packAbs.replace(/\.md$/u, '-opencode.md')
    : path.join(exportsDir, `${sessionId}-opencode-context.md`);
  await fs.writeFile(filePath, effectiveContext.endsWith('\n') ? effectiveContext : `${effectiveContext}\n`, 'utf8');
  return filePath;
}

async function safeContextPack(workspaceRoot, { sessionId, eventLimit, packPath }, { strict = false } = {}) {
  const packAbs = path.join(workspaceRoot, packPath);
  try {
    ctx(workspaceRoot, 'context:pack', ['--session', sessionId, '--limit', eventLimit, '--out', packPath]);
    const contextText = await fs.readFile(packAbs, 'utf8');
    return { ok: true, mode: 'fresh', packAbs, contextText };
  } catch (error) {
    if (strict) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] contextdb context:pack failed: ${reason}`);

    try {
      const contextText = await fs.readFile(packAbs, 'utf8');
      if (String(contextText).trim()) {
        console.warn(`[warn] using last context packet: ${packAbs}`);
        return { ok: true, mode: 'stale', packAbs, contextText };
      }
    } catch {
      // ignore missing stale pack fallback
    }

    console.warn('[warn] continuing without context packet.');
    return { ok: false, mode: 'none', packAbs, contextText: '' };
  }
}

export async function runCtxAgent(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  validateOpts(opts);

  if (!opts.workspaceRoot) {
    opts.workspaceRoot = resolveWorkspaceRoot(process.cwd());
  }

  if (!existsSync(opts.workspaceRoot)) {
    throw new Error(`--workspace is not a directory: ${opts.workspaceRoot}`);
  }

  opts.workspaceRoot = path.resolve(opts.workspaceRoot);

  if (!opts.project) {
    opts.project = path.basename(opts.workspaceRoot);
  }

  if (opts.autoBootstrap && isBootstrapEnabled(process.env)) {
    try {
      const bootstrapResult = await ensureBootstrapTask(opts.workspaceRoot, {
        project: opts.project,
        agent: opts.agent,
      });
      if (bootstrapResult.created) {
        console.log(`Bootstrap task created: tasks/${bootstrapResult.taskPath}`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[warn] bootstrap task initialization failed: ${reason}`);
    }
  }

  ctx(opts.workspaceRoot, 'init', []);

  if (!opts.sessionId) {
    const latestJson = ctx(opts.workspaceRoot, 'session:latest', ['--agent', opts.agent, '--project', opts.project]);
    opts.sessionId = extractLatestSessionId(latestJson);
    if (!opts.sessionId) {
      if (!opts.goal) {
        opts.goal = `Shared context session for ${opts.agent} on ${opts.project}`;
      }
      const createJson = ctx(opts.workspaceRoot, 'session:new', [
        '--agent', opts.agent,
        '--project', opts.project,
        '--goal', opts.goal,
      ]);
      opts.sessionId = extractCreatedSessionId(createJson);
    }
  }

  if (!opts.sessionId) {
    throw new Error('Failed to resolve session id from contextdb output');
  }

  const packPath = path.join('memory', 'context-db', 'exports', `${opts.sessionId}-context.md`);
  const strictPack = shouldStrictContextPack(process.env);
  const packResult = await safeContextPack(opts.workspaceRoot, {
    sessionId: opts.sessionId,
    eventLimit: opts.eventLimit,
    packPath,
  }, { strict: strictPack });
  const packAbs = packResult.packAbs;
  const contextText = packResult.contextText;
  let workspaceMemoryOverlay = '';
  try {
    workspaceMemoryOverlay = await buildWorkspaceMemoryOverlay(opts.workspaceRoot, process.env);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] workspace memory overlay skipped: ${reason}`);
  }

  if (workspaceMemoryOverlay) {
    console.log('Workspace memory overlay: enabled');
  }

  const effectiveContextText = workspaceMemoryOverlay
    ? contextText
      ? `${workspaceMemoryOverlay}\n\n${contextText}`
      : workspaceMemoryOverlay
    : contextText;
  const injectContext = String(effectiveContextText).trim().length > 0;

  let latestInjected = null;
  if (injectContext) {
    try {
      latestInjected = await writeLatestInjectedContext({
        workspaceRoot: opts.workspaceRoot,
        agent: opts.agent,
        sessionId: opts.sessionId,
        contextText: effectiveContextText,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[warn] latest context snapshot write failed: ${reason}`);
    }
  }

  const openCodeContextPacketPath = opts.agent === 'opencode-cli' && injectContext
    ? await ensureOpenCodeContextPacket({
      workspaceRoot: opts.workspaceRoot,
      sessionId: opts.sessionId,
      packAbs: packResult.ok ? packAbs : '',
      contextText: effectiveContextText,
      baseContextText: contextText,
    })
    : '';

  console.log(`Session: ${opts.sessionId}`);
  console.log(`Workspace: ${opts.workspaceRoot}`);
  if (packResult.mode === 'fresh') {
    console.log(`Context packet: ${packAbs}`);
  } else if (packResult.mode === 'stale') {
    console.log(`Context packet: ${packAbs} (stale)`);
  } else {
    console.log('Context packet: (unavailable)');
  }
  if (latestInjected?.ok && latestInjected.relPath) {
    console.log(`Latest injected context: ${latestInjected.relPath}`);
    if (!opts.prompt) {
      console.log(
        `Rehydrate tip: after /new (codex) or /clear (claude/gemini), restart the CLI (preferred) or re-attach ${latestInjected.relPath} as your first prompt.`
      );
    }
  }

  if (opts.prompt) {
    ctx(opts.workspaceRoot, 'event:add', [
      '--session', opts.sessionId,
      '--role', 'user',
      '--kind', 'prompt',
      '--text', opts.prompt,
    ]);

    let responseStatus = opts.checkpointStatus;
    let output = '';
    let exitCode = 0;
    const startedAt = Date.now();
    if (opts.dryRun) {
      output = `[dry-run] ${opts.agent} would execute prompt with context packet: ${packAbs}
Prompt: ${opts.prompt}`;
    } else {
      const result = runOneShotAgent(opts.agent, effectiveContextText, opts.prompt, opts.extraArgs, {
        injectContext,
        contextPacketPath: openCodeContextPacketPath,
      });
      output = result.output;
      exitCode = result.exitCode;
    }
    const elapsedMs = Date.now() - startedAt;

    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);

    if (exitCode !== 0) {
      responseStatus = 'blocked';
    }

    const maxChars = Number.parseInt(opts.maxLogChars, 10);
    const logOutput = output.slice(0, Number.isFinite(maxChars) ? maxChars : 8000);
    const kind = exitCode === 0 ? 'response' : 'error';

    ctx(opts.workspaceRoot, 'event:add', [
      '--session', opts.sessionId,
      '--role', 'assistant',
      '--kind', kind,
      '--text', logOutput,
    ]);

    if (opts.autoCheckpoint) {
      const promptSnippet = opts.prompt.replace(/\n/g, ' ').slice(0, 200);
      const responseSnippet = output.replace(/\n/g, ' ').slice(0, 300);
      const summary = `Auto checkpoint: ${opts.agent} one-shot run completed. prompt=\"${promptSnippet}\" response=\"${responseSnippet}\"`;
      const nextActions = responseStatus === 'blocked'
        ? 'Inspect error output|Retry with adjusted prompt'
        : 'Review response|Continue with next prompt';
      const failureCategory = responseStatus === 'blocked' ? classifyOneShotFailure(output) : undefined;
      const checkpointArgs = [
        '--session', opts.sessionId,
        '--summary', summary,
        '--status', responseStatus,
        '--next', nextActions,
        '--verify-result', 'unknown',
        '--retry-count', '0',
        '--elapsed-ms', String(elapsedMs),
      ];
      if (failureCategory) {
        checkpointArgs.push('--failure-category', failureCategory);
      }
      ctx(opts.workspaceRoot, 'checkpoint', checkpointArgs);
    }

    try {
      await safeContextPack(opts.workspaceRoot, {
        sessionId: opts.sessionId,
        eventLimit: opts.eventLimit,
        packPath,
      }, { strict: strictPack });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[warn] context packet refresh skipped: ${reason}`);
    }

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
    return;
  }

  runInteractiveAgent(opts.agent, effectiveContextText, opts.extraArgs, {
    injectContext,
    contextPacketPath: openCodeContextPacketPath,
  });
}
