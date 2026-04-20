#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { getCommandSpawnSpec } from './lib/platform/process.mjs';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BLOCKED_SUBCOMMANDS = {
  codex: new Set([
    'exec', 'review', 'login', 'logout', 'mcp', 'mcp-server', 'app-server', 'app',
    'completion', 'sandbox', 'debug', 'apply', 'resume', 'fork', 'cloud', 'features',
    // Forward-compat: Codex CLI v0.113+ introduces plugin workflows; v0.114+ adds an experimental hooks engine.
    // These subcommands are operational/admin flows and should never be wrapped by ContextDB.
    'plugin', 'hooks',
    'help', '-h', '--help', '-V', '--version',
  ]),
  claude: new Set([
    'agents', 'auth', 'doctor', 'install', 'mcp', 'plugin', 'setup-token', 'update',
    'upgrade', '-h', '--help', '-v', '--version',
  ]),
  gemini: new Set([
    'mcp', 'extensions', 'skills', 'hooks', '-h', '--help', '-v', '--version',
  ]),
  opencode: new Set([
    'completion', 'acp', 'mcp', 'attach', 'run', 'debug', 'auth', 'agent', 'upgrade',
    'uninstall', 'serve', 'web', 'models', 'stats', 'export', 'import', 'github', 'pr',
    'session', 'db', '-h', '--help', '-v', '--version',
  ]),
};

function usage() {
  console.log(`Usage:
  node scripts/contextdb-shell-bridge.mjs --agent <codex-cli|claude-code|gemini-cli|opencode-cli> --command <codex|claude|gemini|opencode> [--cwd <path>] [-- <args...>]

Environment:
  ROOTPATH               Repo root containing scripts/ctx-agent.mjs
  CTXDB_RUNNER           Explicit runner path (overrides ROOTPATH discovery)
  CTXDB_REPO_NAME        Optional project name override
  CTXDB_WRAP_MODE        all|repo-only|opt-in|off (default: repo-only)
  CTXDB_MARKER_FILE      Marker filename for opt-in mode (default: .contextdb-enable)
  CTXDB_AUTO_CREATE_MARKER 1/true/yes/on to auto-create marker in opt-in mode (default: on)
  CTXDB_INTERACTIVE_AUTO_ROUTE 1/true/yes/on to inject route auto prompt in interactive mode (default: on)
  CTXDB_CODEX_DISABLE_MCP 1/true/yes/on to launch Codex without MCP startup in wrapped runs
  CTXDB_DEBUG            1/true/yes/on to print bridge decisions`);
}

function parseArgs(argv) {
  const opts = {
    agent: '',
    command: '',
    cwd: process.cwd(),
    passthroughArgs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--agent':
        opts.agent = argv[++i] || '';
        break;
      case '--command':
        opts.command = argv[++i] || '';
        break;
      case '--cwd':
        opts.cwd = argv[++i] || process.cwd();
        break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      case '--':
        opts.passthroughArgs = argv.slice(i + 1);
        i = argv.length;
        break;
      default:
        opts.passthroughArgs.push(arg);
        break;
    }
  }

  return opts;
}

function normalizeCodeHome(env, cwd) {
  const codexHome = env.CODEX_HOME;
  if (!codexHome) return;

  let normalized = codexHome.trim();
  const home = env.HOME || env.USERPROFILE || '';

  if (normalized === '~') {
    normalized = home || normalized;
  } else if (normalized.startsWith('~/') || normalized.startsWith('~\\')) {
    const suffix = normalized.slice(2);
    normalized = home ? path.join(home, suffix) : normalized;
  }

  if (!path.isAbsolute(normalized)) {
    normalized = path.resolve(cwd, normalized);
  }
  env.CODEX_HOME = normalized;

  if (!existsSync(normalized)) {
    try {
      mkdirSync(normalized, { recursive: true });
    } catch {
      // non-fatal: fallback to runtime behavior
    }
  }
}

function runGit(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function detectWorkspaceRoot(cwd) {
  const result = runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (result.status === 0) {
    const workspace = (result.stdout || '').trim();
    if (workspace) return workspace;
  }
  return path.resolve(cwd);
}

function normalizeForCompare(inputPath) {
  let output = path.resolve(inputPath);
  try {
    output = realpathSync(output);
  } catch {
    // ignore realpath failures and keep resolved absolute path
  }

  if (process.platform === 'win32') {
    return output.toLowerCase();
  }

  return output;
}

function shouldWrapWorkspace(workspace, env) {
  const mode = (env.CTXDB_WRAP_MODE || 'repo-only').trim().toLowerCase();

  switch (mode) {
    case 'all':
      return true;
    case 'repo-only': {
      const rootpath = env.ROOTPATH;
      if (!rootpath) return false;
      return normalizeForCompare(rootpath) === normalizeForCompare(workspace);
    }
    case 'opt-in': {
      const marker = env.CTXDB_MARKER_FILE || '.contextdb-enable';
      return existsSync(path.join(workspace, marker));
    }
    case 'off':
    case 'disabled':
    case 'none':
      return false;
    default:
      // preserve historical behavior for unknown modes
      return true;
  }
}

function isBlockedSubcommand(command, firstArg) {
  if (!firstArg) return false;
  const blocked = BLOCKED_SUBCOMMANDS[command];
  if (!blocked) return false;
  return blocked.has(firstArg);
}

function detectRunner(env) {
  if (env.CTXDB_RUNNER && existsSync(env.CTXDB_RUNNER)) {
    return { command: env.CTXDB_RUNNER, args: [] };
  }

  if (env.ROOTPATH) {
    const mcpDir = path.join(env.ROOTPATH, 'mcp-server');
    const nodeModulesDir = path.join(mcpDir, 'node_modules');
    const binDir = path.join(nodeModulesDir, '.bin');
    const tsxBin = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    const tsxPath = path.join(binDir, tsxBin);
    if (!existsSync(tsxPath)) {
      return null;
    }
  }

  if (env.ROOTPATH) {
    const candidate = path.join(env.ROOTPATH, 'scripts', 'ctx-agent.mjs');
    if (existsSync(candidate)) {
      return { command: 'node', args: [candidate] };
    }
  }

  return null;
}

function isInteractivePassthrough(command, passthroughArgs) {
  // Interactive mode: bare command with no positional arguments (no subcommand, no --prompt, etc.)
  const first = passthroughArgs[0] || '';
  if (!first) return true;
  // Allow help/version flags through to the native agent without ContextDB interference
  if (first === '--help' || first === '-h' || first === '--version' || first === '-v') return false;
  // Any other argument is a subcommand or flag — not bare interactive
  return false;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeTeamProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'gemini' || normalized === 'codex') {
    return normalized;
  }
  return '';
}

function inferTeamProviderFromCommand(command) {
  if (command === 'claude') return 'claude';
  if (command === 'gemini') return 'gemini';
  return 'codex';
}

function inferSubagentClientFromProvider(provider) {
  if (provider === 'claude') return 'claude-code';
  if (provider === 'gemini') return 'gemini-cli';
  return 'codex-cli';
}

function inferSubagentClientFromCommand(command) {
  if (command === 'claude') return 'claude-code';
  if (command === 'gemini') return 'gemini-cli';
  if (command === 'codex') return 'codex-cli';
  return '';
}

function normalizeSubagentClient(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'codex-cli' || normalized === 'claude-code' || normalized === 'gemini-cli') {
    return normalized;
  }
  return '';
}

function resolveSubagentClientForPrompt(command, provider, env) {
  const explicitRouteClient = normalizeSubagentClient(env.CTXDB_ROUTE_SUBAGENT_CLIENT);
  if (explicitRouteClient) return explicitRouteClient;
  const explicitClient = normalizeSubagentClient(env.AIOS_SUBAGENT_CLIENT);
  if (explicitClient) return explicitClient;
  const commandClient = normalizeSubagentClient(inferSubagentClientFromCommand(command));
  if (commandClient) return commandClient;
  return inferSubagentClientFromProvider(provider);
}

function buildInteractiveAutoPrompt(command, env) {
  const provider = normalizeTeamProvider(env.CTXDB_TEAM_PROVIDER)
    || (normalizeTeamProvider(env.AIOS_TEAM_PROVIDER))
    || inferTeamProviderFromCommand(command);
  const workers = parsePositiveInteger(env.CTXDB_TEAM_WORKERS, 3);
  const rawBlueprint = String(env.CTXDB_ORCHESTRATE_BLUEPRINT || '').trim().toLowerCase();
  const blueprint = rawBlueprint === 'bugfix' || rawBlueprint === 'refactor' || rawBlueprint === 'security'
    ? rawBlueprint
    : 'feature';
  const subagentClient = resolveSubagentClientForPrompt(command, provider, env);

  return [
    'Continue from this state and execute the next best step.',
    'Routing policy: default to single-route execution.',
    'Only choose team/subagent when the user explicitly asks for delegation/parallel work, or when there are 2+ clearly independent domains.',
    'Do NOT spawn built-in explorer/worker subagents just to scan a codebase; start single-agent first.',
    'If delegated workers are running, post a heartbeat every 30s and stop waiting after 120s with a fallback plan.',
    `If route=team, run: node scripts/aios.mjs team --provider ${provider} --workers ${workers} --task "<task>" --live --preflight auto --format json`,
    `If route=subagent, run: AIOS_EXECUTE_LIVE=1 AIOS_SUBAGENT_CLIENT=${subagentClient} node scripts/aios.mjs orchestrate ${blueprint} --task "<task>" --dispatch local --execute live --preflight auto --format json`,
    'Do not ask the user to manually trigger these commands unless they requested preview/dry-run.',
  ].join('\n');
}

function shouldInjectInteractiveAutoPrompt(env) {
  return parseBoolEnv(env.CTXDB_INTERACTIVE_AUTO_ROUTE, true);
}

function shouldDebug(env) {
  const value = (env.CTXDB_DEBUG || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
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

function shouldAutoCreateMarker(env) {
  return parseBoolEnv(env.CTXDB_AUTO_CREATE_MARKER, true);
}

function tryEnsureOptInMarker(workspace, env) {
  const marker = env.CTXDB_MARKER_FILE || '.contextdb-enable';
  const markerPath = path.join(workspace, marker);

  if (existsSync(markerPath)) {
    return { created: false, error: '' };
  }

  if (!shouldAutoCreateMarker(env)) {
    return { created: false, error: '' };
  }

  try {
    writeFileSync(markerPath, '', { encoding: 'utf8', flag: 'wx' });
    return { created: true, error: '' };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      return { created: false, error: '' };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { created: false, error: message };
  }
}

function spawnInherited(command, args, cwd, env) {
  const spec = getCommandSpawnSpec(command, args, { env });
  const result = spawnSync(spec.command, spec.args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: spec.shell ?? false,
  });

  if (result.error) {
    const reason = result.error.message || String(result.error);
    console.error(`[contextdb-shell-bridge] failed to run ${command}: ${reason}`);
    return 1;
  }

  return result.status ?? 1;
}

function validateOptions(opts) {
  const validAgents = new Set(['codex-cli', 'claude-code', 'gemini-cli', 'opencode-cli']);
  const validCommands = new Set(['codex', 'claude', 'gemini', 'opencode']);

  if (!validAgents.has(opts.agent)) {
    throw new Error('--agent must be one of: codex-cli, claude-code, gemini-cli, opencode-cli');
  }

  if (!validCommands.has(opts.command)) {
    throw new Error('--command must be one of: codex, claude, gemini, opencode');
  }
}

function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  try {
    validateOptions(opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[contextdb-shell-bridge] ${message}`);
    usage();
    process.exit(2);
  }

  const env = { ...process.env };
  if (opts.command === 'codex') {
    normalizeCodeHome(env, opts.cwd);
  }

  // Interactive mode detection: bare command invocation (no subcommand/flags) triggers
  // automatic handoff prompt injection so the new session resumes from the last checkpoint.
  const interactive = isInteractivePassthrough(opts.command, opts.passthroughArgs);
  if (interactive && !env.CTXDB_AUTO_PROMPT && shouldInjectInteractiveAutoPrompt(env)) {
    env.CTXDB_AUTO_PROMPT = buildInteractiveAutoPrompt(opts.command, env);
    if (shouldDebug(env)) {
      const preview = String(env.CTXDB_AUTO_PROMPT || '').split(/\r?\n/u)[0] || 'continue';
      console.error(`[contextdb-shell-bridge] interactive detected; auto-prompt=${preview}`);
    }
  } else if (interactive && shouldDebug(env) && !env.CTXDB_AUTO_PROMPT) {
    console.error('[contextdb-shell-bridge] interactive detected; auto-prompt disabled by CTXDB_INTERACTIVE_AUTO_ROUTE');
  }

  const firstArg = opts.passthroughArgs[0] || '';
  const blockedSubcommand = isBlockedSubcommand(opts.command, firstArg);
  const runner = blockedSubcommand ? null : detectRunner(env);
  const workspace = blockedSubcommand ? '' : detectWorkspaceRoot(opts.cwd);
  const mode = (env.CTXDB_WRAP_MODE || 'repo-only').trim().toLowerCase();
  let markerCreated = false;
  let markerCreateError = '';

  if (!blockedSubcommand && runner && workspace && mode === 'opt-in') {
    const markerResult = tryEnsureOptInMarker(workspace, env);
    markerCreated = markerResult.created;
    markerCreateError = markerResult.error;
  }

  const allowedByMode = workspace ? shouldWrapWorkspace(workspace, env) : false;
  const shouldWrap = Boolean(!blockedSubcommand && runner && workspace && allowedByMode);

  if (shouldDebug(env)) {
    const reason = shouldWrap
      ? 'wrap'
      : blockedSubcommand
        ? 'blocked-subcommand'
        : !runner
          ? 'runner-missing'
          : !workspace
            ? 'workspace-missing'
            : 'mode-blocked';
    console.error(
      `[contextdb-shell-bridge] command=${opts.command} agent=${opts.agent} decision=${reason} workspace=${workspace || '-'}`
    );
    if (mode === 'opt-in') {
      console.error(
        `[contextdb-shell-bridge] opt-in marker created=${markerCreated ? 'yes' : 'no'} auto-create=${shouldAutoCreateMarker(env) ? 'on' : 'off'}`
      );
      if (markerCreateError) {
        console.error(`[contextdb-shell-bridge] opt-in marker create error=${markerCreateError}`);
      }
    }
  }

  if (!shouldWrap) {
    const code = spawnInherited(opts.command, opts.passthroughArgs, opts.cwd, env);
    process.exit(code);
  }

  const project = env.CTXDB_REPO_NAME || path.basename(workspace);
  const args = [
    ...runner.args,
    '--workspace', workspace,
    '--agent', opts.agent,
    '--project', project,
  ];

  args.push('--', ...opts.passthroughArgs);

  const code = spawnInherited(runner.command, args, opts.cwd, env);
  process.exit(code);
}

main();
