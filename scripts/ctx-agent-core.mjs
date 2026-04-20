import { spawn, spawnSync } from 'node:child_process';
import { getCommandSpawnSpec } from './lib/platform/process.mjs';
import { loadFacade, generateFacadeFromSession } from './lib/contextdb/facade.mjs';
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
import { scanWorkspaceMemoryContent } from './lib/memo/safety.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MCP_DIR = path.join(ROOT_DIR, 'mcp-server');
const ROUTE_MODES = new Set(['auto', 'single', 'team', 'subagent']);
const ROUTE_EXECUTION_MODES = new Set(['dry-run', 'live']);
const TEAM_ROUTE_PROVIDERS = new Set(['auto', 'codex', 'claude', 'gemini']);
const ORCHESTRATE_BLUEPRINTS = new Set(['feature', 'bugfix', 'refactor', 'security']);
const SUPPORTED_SUBAGENT_CLIENT_IDS = new Set(['codex-cli', 'claude-code', 'gemini-cli']);
const TEAM_ROUTE_KEYWORD_PATTERNS = [
  /并行|并发|同时推进|拆分|多模块|跨模块|跨系统|多阶段/u,
  /subagent|agent\s*team|multi[-\s]?agent|parallel|split/i,
  /frontend|backend|api|database|测试|test|文档|docs/i,
];

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
  --route <mode>      One-shot routing mode: auto|single|team|subagent (default: auto)
  --route-execute <mode> Routed execution mode: dry-run|live (default: live)
  --team-provider <name> Team provider for routed commands: auto|codex|claude|gemini (default: auto)
  --team-workers <n>  Team workers for routed commands (default: 3)
  --blueprint <name>  Orchestrate blueprint for routed subagent: feature|bugfix|refactor|security (default: feature)
  --no-bootstrap      Disable automatic first-task bootstrap for this run
  --no-checkpoint     Disable automatic checkpoint write in one-shot mode
  --dry-run           Skip remote model call, write synthetic response for pipeline testing
  --max-log-chars <n> Max characters stored in event logs (default: 8000)
  -h, --help          Show this help`);
  console.log(`
Environment:
  CTXDB_AUTO_REBUILD_NATIVE 1/true/yes/on to auto-rebuild better-sqlite3 on Node ABI mismatch (default: on)
  CTXDB_TASK_ROUTER_GUIDE 1/true/yes/on to inject routing checklist into context packet (default: on)
  CTXDB_LAZY_LOAD      1/true/yes/on to enable lazy context loading (default: on)`);
}

function runCommand(command, args, options = {}) {
  const spec = getCommandSpawnSpec(command, args, options);
  const result = spawnSync(spec.command, spec.args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env,
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
    env: options.env,
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

function parsePositiveInteger(rawValue, fallback, flagName = 'value') {
  const parsed = Number.parseInt(String(rawValue ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function normalizeRouteMode(rawValue = 'auto') {
  const value = String(rawValue || 'auto').trim().toLowerCase();
  if (!ROUTE_MODES.has(value)) {
    throw new Error('--route must be one of: auto, single, team, subagent');
  }
  return value;
}

function normalizeRouteExecutionMode(rawValue = 'dry-run') {
  const value = String(rawValue || 'live').trim().toLowerCase();
  if (!ROUTE_EXECUTION_MODES.has(value)) {
    throw new Error('--route-execute must be one of: dry-run, live');
  }
  return value;
}

function normalizeTeamRouteProvider(rawValue = 'auto') {
  const value = String(rawValue || 'auto').trim().toLowerCase();
  if (!TEAM_ROUTE_PROVIDERS.has(value)) {
    throw new Error('--team-provider must be one of: auto, codex, claude, gemini');
  }
  return value;
}

function normalizeOrchestrateBlueprint(rawValue = 'feature') {
  const value = String(rawValue || 'feature').trim().toLowerCase();
  if (!ORCHESTRATE_BLUEPRINTS.has(value)) {
    throw new Error('--blueprint must be one of: feature, bugfix, refactor, security');
  }
  return value;
}

function inferTeamProviderFromAgent(agent = '') {
  const normalized = String(agent || '').trim().toLowerCase();
  if (normalized === 'claude-code') return 'claude';
  if (normalized === 'gemini-cli') return 'gemini';
  return 'codex';
}

function inferSubagentClientFromProvider(provider = 'codex') {
  if (provider === 'claude') return 'claude-code';
  if (provider === 'gemini') return 'gemini-cli';
  return 'codex-cli';
}

function normalizeSubagentClient(rawValue = '') {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  return SUPPORTED_SUBAGENT_CLIENT_IDS.has(value) ? value : '';
}

export function resolveRoutedSubagentClient({
  agent = 'codex-cli',
  teamProvider = 'auto',
  env = process.env,
} = {}) {
  const explicitRouteClient = normalizeSubagentClient(env?.CTXDB_ROUTE_SUBAGENT_CLIENT || '');
  if (explicitRouteClient) return explicitRouteClient;
  const explicitSubagentClient = normalizeSubagentClient(env?.AIOS_SUBAGENT_CLIENT || '');
  if (explicitSubagentClient) return explicitSubagentClient;
  const agentClient = normalizeSubagentClient(agent);
  if (agentClient) return agentClient;
  const provider = teamProvider === 'auto'
    ? inferTeamProviderFromAgent(agent)
    : normalizeTeamRouteProvider(teamProvider);
  return inferSubagentClientFromProvider(provider);
}

function shouldInjectTaskRouterGuide(env = process.env) {
  return parseBoolEnv(env.CTXDB_TASK_ROUTER_GUIDE, true);
}

function buildTaskRouterGuide({
  agent = '',
  teamProvider = 'auto',
  teamWorkers = 3,
  blueprint = 'feature',
  routeMode = 'auto',
} = {}) {
  const provider = teamProvider === 'auto' ? inferTeamProviderFromAgent(agent) : teamProvider;
  const workers = parsePositiveInteger(teamWorkers, 3);
  const resolvedBlueprint = normalizeOrchestrateBlueprint(blueprint);
  const resolvedRouteMode = normalizeRouteMode(routeMode);
  const subagentClient = resolveRoutedSubagentClient({
    agent,
    teamProvider: provider,
    env: process.env,
  });

  return [
    '## AIOS Task Router',
    `Default mode: ${resolvedRouteMode}`,
    'Choose execution route before planning:',
    '- single: one focused domain with low coupling; continue in the active client.',
    '- subagent: one primary domain but needs staged orchestration/verification gates.',
    '- team: 2+ independent domains, parallelizable work-items, or merge-gate heavy delivery.',
    'Policy: when route=subagent/team, execute the matching AIOS command directly (live) unless user explicitly requests preview/dry-run.',
    'User trigger shortcuts in one-shot prompt text:',
    '- /single <task>',
    '- /subagent <task>',
    '- /team <task>',
    `Team trigger command: node scripts/aios.mjs team --provider ${provider} --workers ${workers} --task "<task>" --live --preflight auto --format json`,
    `Subagent trigger command: AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT=${subagentClient} node scripts/aios.mjs orchestrate ${resolvedBlueprint} --task "<task>" --dispatch local --execute live --preflight auto --format json`,
  ].join('\n');
}

function buildInteractiveRouteAutoPrompt({
  agent = 'codex-cli',
  teamProvider = 'auto',
  teamWorkers = 3,
  blueprint = 'feature',
} = {}) {
  const provider = teamProvider === 'auto'
    ? inferTeamProviderFromAgent(agent)
    : normalizeTeamRouteProvider(teamProvider);
  const workers = parsePositiveInteger(teamWorkers, 3);
  const resolvedBlueprint = normalizeOrchestrateBlueprint(blueprint);
  const subagentClient = resolveRoutedSubagentClient({
    agent,
    teamProvider: provider,
    env: process.env,
  });
  return [
    'Continue from this state and execute the next best step.',
    'Auto-route rule: classify each new user request as single/subagent/team before planning.',
    'If route=team, run: node scripts/aios.mjs team --provider '
      + `${provider} --workers ${workers} --task "<task>" --live --preflight auto --format json`,
    'If route=subagent, run: AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT='
      + `${subagentClient} node scripts/aios.mjs orchestrate ${resolvedBlueprint} --task "<task>" --dispatch local --execute live --preflight auto --format json`,
    'Do not ask the user to manually trigger these commands unless they requested dry-run/preview.',
  ].join('\n');
}

function countListMarkers(prompt = '') {
  const lines = String(prompt || '').split(/\r?\n/u);
  let count = 0;
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed) continue;
    if (/^(\d+[\.\)]|[-*+])\s+/u.test(trimmed)) count += 1;
  }
  return count;
}

function buildTeamRouteSignal(prompt = '') {
  const text = String(prompt || '').trim();
  if (!text) {
    return {
      score: 0,
      keywords: 0,
      listMarkers: 0,
      length: 0,
      shouldRoute: false,
      reason: 'empty prompt',
    };
  }

  const keywords = TEAM_ROUTE_KEYWORD_PATTERNS
    .reduce((acc, pattern) => (pattern.test(text) ? acc + 1 : acc), 0);
  const listMarkers = countListMarkers(text);
  const length = text.length;

  let score = 0;
  if (keywords >= 2) score += 2;
  if (listMarkers >= 2) score += 1;
  if (keywords >= 1 && listMarkers >= 2) score += 1;
  if (length >= 180) score += 1;
  if (/同时|并行|parallel|multi[-\s]?(step|stage|module)/iu.test(text)) score += 1;

  const strongTeamIntent = /并行|并发|parallel|multi[-\s]?agent|agent\s*team|跨模块|多模块|跨系统/iu.test(text);
  let recommendedRoute = 'single';
  if (strongTeamIntent && (keywords >= 1 || listMarkers >= 2)) {
    recommendedRoute = 'team';
  } else if (score >= 4) {
    recommendedRoute = 'team';
  } else if (score >= 2) {
    recommendedRoute = 'subagent';
  }

  return {
    score,
    keywords,
    listMarkers,
    length,
    shouldRoute: recommendedRoute !== 'single',
    recommendedRoute,
    reason: `${recommendedRoute} score=${score} (keywords=${keywords}, listMarkers=${listMarkers}, length=${length})`,
  };
}

export function resolveTaskRouteDecision({
  prompt = '',
  routeMode = 'auto',
} = {}) {
  const rawPrompt = String(prompt || '').trim();
  const normalizedRouteMode = normalizeRouteMode(routeMode);
  const commandMatch = /^\/(single|team|subagent)\b[:\s-]*/iu.exec(rawPrompt);

  if (commandMatch) {
    const commandRoute = normalizeRouteMode(commandMatch[1]);
    const stripped = rawPrompt.slice(commandMatch[0].length).trim();
    return {
      routeMode: commandRoute,
      taskPrompt: stripped || rawPrompt,
      explicitTrigger: true,
      reason: `prompt trigger /${commandRoute}`,
      signal: null,
    };
  }

  if (normalizedRouteMode !== 'auto') {
    return {
      routeMode: normalizedRouteMode,
      taskPrompt: rawPrompt,
      explicitTrigger: true,
      reason: `flag route=${normalizedRouteMode}`,
      signal: null,
    };
  }

  const signal = buildTeamRouteSignal(rawPrompt);
  if (signal.shouldRoute) {
    return {
      routeMode: signal.recommendedRoute === 'team' ? 'team' : 'subagent',
      taskPrompt: rawPrompt,
      explicitTrigger: false,
      reason: signal.reason,
      signal,
    };
  }

  return {
    routeMode: 'single',
    taskPrompt: rawPrompt,
    explicitTrigger: false,
    reason: signal.reason,
    signal,
  };
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

function formatWorkspaceMemorySafetyLine({ target, reason, id }) {
  const normalizedTarget = String(target || 'entry').trim() || 'entry';
  const normalizedReason = String(reason || '').trim() || 'blocked by safety policy';
  const normalizedId = String(id || '').trim();
  if (normalizedId) {
    return `- Skipped unsafe ${normalizedTarget}: ${normalizedReason} (${normalizedId})`;
  }
  return `- Skipped unsafe ${normalizedTarget}: ${normalizedReason}`;
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

  const safetyNotices = [];
  if (pinned) {
    const pinnedSafety = scanWorkspaceMemoryContent(pinned, { allowEmpty: true });
    if (!pinnedSafety.ok) {
      safetyNotices.push({
        target: 'pinned memory',
        reason: pinnedSafety.reason,
        id: pinnedSafety.id,
      });
      pinned = '';
    }
  }

  const memos = await loadRecentMemoEvents(workspaceMemoryEventsPath(workspaceRoot, sessionId), recentLimit);
  const safeMemos = [];
  for (const memo of memos) {
    const memoText = memo?.text ? String(memo.text) : '';
    const memoSafety = scanWorkspaceMemoryContent(memoText, { allowEmpty: true });
    if (!memoSafety.ok) {
      safetyNotices.push({
        target: 'memo entry',
        reason: memoSafety.reason,
        id: memoSafety.id,
      });
      continue;
    }
    safeMemos.push(memo);
  }

  if (!pinned && safeMemos.length === 0 && safetyNotices.length === 0) {
    return '';
  }

  const sections = [`## Workspace Memory`, `Space: ${space}`];
  if (pinned) {
    sections.push('### Pinned', pinned);
  }
  if (safeMemos.length > 0) {
    const lines = safeMemos.map((event) => formatWorkspaceMemoLine(event));
    sections.push('### Recent memos', lines.join('\n'));
  }
  if (safetyNotices.length > 0) {
    const lines = safetyNotices.slice(0, 6).map((item) => formatWorkspaceMemorySafetyLine(item));
    if (safetyNotices.length > lines.length) {
      lines.push(`- Additional unsafe entries skipped: ${safetyNotices.length - lines.length}`);
    }
    sections.push('### Safety', lines.join('\n'));
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

export function shouldLazyLoad(env = process.env) {
  const value = String(env?.CTXDB_LAZY_LOAD ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return true;
}

export function buildFacadePrompt(facade, agent) {
  if (!facade || !facade.sessionId) {
    return `This project uses ContextDB for session memory. No prior sessions found. Full history will be available at memory/context-db/exports/latest-${agent}-context.md.`;
  }
  const refs = facade.keyRefs?.length ? `refs: ${facade.keyRefs.join(', ')}` : '';
  return [
    `This project uses ContextDB for session memory.`,
    `Latest session: ${facade.goal} (status: ${facade.status}${refs ? ', ' + refs : ''}).`,
    `Full history at: ${facade.contextPacketPath}.`,
    `Load it when you need prior context.`,
  ].join(' ');
}

function normalizeFacadePathForCompare(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

export function shouldScheduleAsyncBootstrap(facadeResult, agent) {
  if (!facadeResult?.ok || !facadeResult.facade) {
    return true;
  }
  if (facadeResult.facade.hasStalePack === true) {
    return true;
  }
  const expectedPath = normalizeFacadePathForCompare(path.join('memory', 'context-db', 'exports', `latest-${agent}-context.md`));
  return normalizeFacadePathForCompare(facadeResult.facade.contextPacketPath) !== expectedPath;
}

function forkAsyncBootstrap(workspaceRoot, opts) {
  const scriptPath = path.join(__dirname, 'lib', 'contextdb', 'async-bootstrap-runner.mjs');
  const child = spawn(
    process.execPath,
    [
      scriptPath,
      '--workspace', workspaceRoot,
      '--agent', opts.agent,
      '--project', opts.project,
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    }
  );
  child.unref();
  return child;
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
    routeMode: 'auto',
    routeExecutionMode: 'live',
    teamProvider: 'auto',
    teamWorkers: '3',
    blueprint: 'feature',
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
      case '--route':
        opts.routeMode = argv[++i] || 'auto';
        break;
      case '--route-execute':
        opts.routeExecutionMode = argv[++i] || 'dry-run';
        break;
      case '--team-provider':
        opts.teamProvider = argv[++i] || 'auto';
        break;
      case '--team-workers':
        opts.teamWorkers = argv[++i] || '3';
        break;
      case '--blueprint':
        opts.blueprint = argv[++i] || 'feature';
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
  opts.routeMode = normalizeRouteMode(opts.routeMode);
  opts.routeExecutionMode = normalizeRouteExecutionMode(opts.routeExecutionMode);
  opts.teamProvider = normalizeTeamRouteProvider(opts.teamProvider);
  opts.teamWorkers = String(parsePositiveInteger(opts.teamWorkers, undefined, '--team-workers'));
  opts.blueprint = normalizeOrchestrateBlueprint(opts.blueprint);
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

function buildRoutedCommandSpec({
  workspaceRoot = process.cwd(),
  agent = 'codex-cli',
  routeMode = 'team',
  routeExecutionMode = 'dry-run',
  teamProvider = 'auto',
  teamWorkers = 3,
  blueprint = 'feature',
  taskPrompt = '',
} = {}) {
  const provider = teamProvider === 'auto'
    ? inferTeamProviderFromAgent(agent)
    : normalizeTeamRouteProvider(teamProvider);
  const subagentClient = resolveRoutedSubagentClient({
    agent,
    teamProvider: provider,
    env: process.env,
  });
  const workers = parsePositiveInteger(teamWorkers, 3);
  const executionMode = normalizeRouteExecutionMode(routeExecutionMode);
  const effectiveRoute = normalizeRouteMode(routeMode);
  const effectivePrompt = String(taskPrompt || '').trim();
  const commandEnv = {
    ...process.env,
    AIOS_SUBAGENT_CLIENT: subagentClient,
  };
  if (executionMode === 'live') {
    commandEnv.AIOS_EXECUTE_LIVE = '1';
  }

  if (effectiveRoute === 'team') {
    const args = [
      'scripts/aios.mjs',
      'team',
      '--provider',
      provider,
      '--workers',
      String(workers),
      '--task',
      effectivePrompt,
      '--preflight',
      'auto',
      '--format',
      'json',
    ];
    if (executionMode === 'dry-run') {
      args.push('--dry-run');
    } else {
      args.push('--live');
    }
    return {
      command: process.execPath,
      args,
      env: commandEnv,
      cwd: workspaceRoot,
      preview: `node scripts/aios.mjs team --provider ${provider} --workers ${workers} --task "${effectivePrompt}" --preflight auto --format json --${executionMode === 'dry-run' ? 'dry-run' : 'live'}`,
      provider,
      workers,
      executionMode,
      routeMode: effectiveRoute,
    };
  }

  if (effectiveRoute === 'subagent') {
    const effectiveBlueprint = normalizeOrchestrateBlueprint(blueprint);
    const args = [
      'scripts/aios.mjs',
      'orchestrate',
      effectiveBlueprint,
      '--task',
      effectivePrompt,
      '--dispatch',
      'local',
      '--execute',
      executionMode,
      '--preflight',
      'auto',
      '--format',
      'json',
    ];
    return {
      command: process.execPath,
      args,
      env: commandEnv,
      cwd: workspaceRoot,
      preview: `node scripts/aios.mjs orchestrate ${effectiveBlueprint} --task "${effectivePrompt}" --dispatch local --execute ${executionMode} --preflight auto --format json`,
      provider,
      workers,
      executionMode,
      routeMode: effectiveRoute,
      blueprint: effectiveBlueprint,
    };
  }

  throw new Error(`Unsupported routed mode: ${effectiveRoute}`);
}

function runRoutedOneShotTask({
  workspaceRoot = process.cwd(),
  agent = 'codex-cli',
  routeMode = 'team',
  routeExecutionMode = 'dry-run',
  teamProvider = 'auto',
  teamWorkers = 3,
  blueprint = 'feature',
  taskPrompt = '',
} = {}) {
  const spec = buildRoutedCommandSpec({
    workspaceRoot,
    agent,
    routeMode,
    routeExecutionMode,
    teamProvider,
    teamWorkers,
    blueprint,
    taskPrompt,
  });
  const result = runCommand(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
  });
  const commandOutput = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const lines = [
    `[ctx-agent route] mode=${spec.routeMode} execute=${spec.executionMode}`,
    `Command: ${spec.preview}`,
  ];
  if (commandOutput) {
    lines.push(commandOutput);
  }
  return {
    output: `${lines.join('\n')}\n`,
    exitCode: result.status ?? 1,
    preview: spec.preview,
    routeMode: spec.routeMode,
    executionMode: spec.executionMode,
  };
}

function runInteractiveAgent(
  agent,
  contextText,
  extraArgs,
  {
    injectContext = true,
    contextPacketPath = '',
    teamProvider = 'auto',
    teamWorkers = 3,
    blueprint = 'feature',
  } = {},
) {
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
    const effectiveAutoPrompt = autoPrompt || buildInteractiveRouteAutoPrompt({
      agent,
      teamProvider,
      teamWorkers,
      blueprint,
    });
    let combinedPrompt = injectContext ? contextText : '';
    if (effectiveAutoPrompt) {
      combinedPrompt = combinedPrompt
        ? `${combinedPrompt}\n\n## Auto Prompt\n${effectiveAutoPrompt}`
        : effectiveAutoPrompt;
      const promptSource = explicitAutoPrompt ? 'env' : 'context handoff';
      console.log(`Auto prompt: enabled (${promptSource})`);
    }
    args = combinedPrompt ? ['-i', combinedPrompt, ...extraArgs] : [...extraArgs];
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
    const effectiveAutoPrompt = explicitAutoPrompt
      ? explicitAutoPrompt
      : shouldInject
        ? ''
        : (autoPrompt || buildInteractiveRouteAutoPrompt({
          agent,
          teamProvider,
          teamWorkers,
          blueprint,
        }));
    let combinedPrompt = shouldInject ? contextText : '';
    if (effectiveAutoPrompt) {
      combinedPrompt = combinedPrompt
        ? `${combinedPrompt}\n\n## Auto Prompt\n${effectiveAutoPrompt}`
        : effectiveAutoPrompt;
      const promptSource = explicitAutoPrompt ? 'env' : 'context handoff';
      console.log(`Auto prompt: enabled (${promptSource})`);
    }
    args = combinedPrompt ? [...extraArgs, combinedPrompt] : [...extraArgs];
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

  const lazyMode = shouldLazyLoad(process.env);

  if (lazyMode && !opts.prompt) {
    let facadeResult = await loadFacade(opts.workspaceRoot);
    if (!facadeResult.ok) {
      const fallbackFacade = await generateFacadeFromSession(opts.workspaceRoot, opts.agent, opts.project);
      facadeResult = { ok: true, facade: fallbackFacade };
    }
    const facadePrompt = buildFacadePrompt(facadeResult.facade, opts.agent);
    const routerGuide = shouldInjectTaskRouterGuide(process.env)
      ? buildTaskRouterGuide({
          agent: opts.agent,
          teamProvider: opts.teamProvider,
          teamWorkers: opts.teamWorkers,
          blueprint: opts.blueprint,
          routeMode: opts.routeMode,
        })
      : '';
    const effectivePrompt = routerGuide
      ? `${facadePrompt}\n\n${routerGuide}`
      : facadePrompt;

    console.log(`Session: ${facadeResult.facade?.sessionId || '(new)'}`);
    console.log(`Workspace: ${opts.workspaceRoot}`);
    console.log('Context packet: (lazy-load; agent self-discovers memory)');
    if (routerGuide) {
      console.log(`Task router guide: enabled (mode=${opts.routeMode})`);
    }

    if (shouldScheduleAsyncBootstrap(facadeResult, opts.agent)) {
      forkAsyncBootstrap(opts.workspaceRoot, opts);
    }

    runInteractiveAgent(opts.agent, effectivePrompt, opts.extraArgs, {
      injectContext: true,
      teamProvider: opts.teamProvider,
      teamWorkers: opts.teamWorkers,
      blueprint: opts.blueprint,
    });
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

  const baseContextText = workspaceMemoryOverlay
    ? contextText
      ? `${workspaceMemoryOverlay}\n\n${contextText}`
      : workspaceMemoryOverlay
    : contextText;
  const routerGuide = shouldInjectTaskRouterGuide(process.env)
    ? buildTaskRouterGuide({
      agent: opts.agent,
      teamProvider: opts.teamProvider,
      teamWorkers: opts.teamWorkers,
      blueprint: opts.blueprint,
      routeMode: opts.routeMode,
    })
    : '';
  const effectiveContextText = routerGuide
    ? baseContextText
      ? `${baseContextText}\n\n${routerGuide}`
      : routerGuide
    : baseContextText;
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
  if (routerGuide) {
    console.log(`Task router guide: enabled (mode=${opts.routeMode})`);
  }

  if (opts.prompt) {
    const routeDecision = resolveTaskRouteDecision({
      prompt: opts.prompt,
      routeMode: opts.routeMode,
    });
    const routedPrompt = String(routeDecision.taskPrompt || '').trim() || String(opts.prompt || '').trim();
    if (routeDecision.routeMode !== 'single') {
      console.log(`[route] mode=${routeDecision.routeMode} (${routeDecision.reason})`);
    }

    const oneShotTurnSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const promptTurnId = `oneshot:${opts.sessionId}:${oneShotTurnSeed}:prompt`;
    const responseTurnId = `oneshot:${opts.sessionId}:${oneShotTurnSeed}:response`;

    ctx(opts.workspaceRoot, 'event:add', [
      '--session', opts.sessionId,
      '--role', 'user',
      '--kind', 'prompt',
      '--text', opts.prompt,
      '--turn-id', promptTurnId,
      '--turn-type', 'main',
      '--environment', 'cli',
      '--hindsight-status', 'pending',
    ]);

    let responseStatus = opts.checkpointStatus;
    let output = '';
    let exitCode = 0;
    const startedAt = Date.now();
    if (opts.dryRun) {
      if (routeDecision.routeMode === 'single') {
        output = `[dry-run] ${opts.agent} would execute prompt with context packet: ${packAbs}
Prompt: ${routedPrompt}`;
      } else {
        const routedSpec = buildRoutedCommandSpec({
          workspaceRoot: opts.workspaceRoot,
          agent: opts.agent,
          routeMode: routeDecision.routeMode,
          routeExecutionMode: opts.routeExecutionMode,
          teamProvider: opts.teamProvider,
          teamWorkers: opts.teamWorkers,
          blueprint: opts.blueprint,
          taskPrompt: routedPrompt,
        });
        output = `[dry-run] routed task via ${routeDecision.routeMode} (${routedSpec.executionMode})
Command: ${routedSpec.preview}
Task: ${routedPrompt}`;
      }
    } else {
      if (routeDecision.routeMode === 'single') {
        const result = runOneShotAgent(opts.agent, effectiveContextText, routedPrompt, opts.extraArgs, {
          injectContext,
          contextPacketPath: openCodeContextPacketPath,
        });
        output = result.output;
        exitCode = result.exitCode;
      } else {
        const result = runRoutedOneShotTask({
          workspaceRoot: opts.workspaceRoot,
          agent: opts.agent,
          routeMode: routeDecision.routeMode,
          routeExecutionMode: opts.routeExecutionMode,
          teamProvider: opts.teamProvider,
          teamWorkers: opts.teamWorkers,
          blueprint: opts.blueprint,
          taskPrompt: routedPrompt,
        });
        output = result.output;
        exitCode = result.exitCode;
      }
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
      '--turn-id', responseTurnId,
      '--parent-turn-id', promptTurnId,
      '--turn-type', 'main',
      '--environment', 'cli',
      '--hindsight-status', 'evaluated',
      '--outcome', exitCode === 0 ? 'success' : 'retry-needed',
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
    teamProvider: opts.teamProvider,
    teamWorkers: opts.teamWorkers,
    blueprint: opts.blueprint,
  });
}
