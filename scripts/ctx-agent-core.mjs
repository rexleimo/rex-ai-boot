import { spawnSync } from 'node:child_process';
import { getCommandSpawnSpec } from './lib/platform/process.mjs';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBootstrapTask, isBootstrapEnabled } from './ctx-bootstrap.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MCP_DIR = path.join(ROOT_DIR, 'mcp-server');

function usage() {
  console.log(`Usage:
  scripts/ctx-agent.mjs --agent <claude-code|gemini-cli|codex-cli> [options] [-- <extra agent args>]

Options:
  --agent <name>      Agent name: claude-code | gemini-cli | codex-cli
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

export function shouldAutoRebuildNative(env = process.env) {
  return parseBoolEnv(env.CTXDB_AUTO_REBUILD_NATIVE, true);
}

function shouldStrictContextPack(env = process.env) {
  return parseBoolEnv(env.CTXDB_PACK_STRICT, false);
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
  const validAgents = new Set(['claude-code', 'gemini-cli', 'codex-cli']);
  if (!validAgents.has(opts.agent)) {
    throw new Error('--agent must be one of: claude-code, gemini-cli, codex-cli');
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

function runOneShotAgent(agent, contextText, prompt, extraArgs, { injectContext = true } = {}) {
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
  } else {
    cmd = 'codex';
    if (injectContext) {
      const fullPrompt = `${contextText}\n\n## New User Request\n${prompt}`;
      args = ['exec', fullPrompt, ...extraArgs];
    } else {
      args = ['exec', prompt, ...extraArgs];
    }
  }

  const result = runCommand(cmd, args);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const exitCode = result.status ?? 1;
  return { output, exitCode };
}

function runInteractiveAgent(agent, contextText, extraArgs, { injectContext = true } = {}) {
  let cmd = '';
  let args = [];

  if (agent === 'claude-code') {
    cmd = 'claude';
    args = injectContext ? ['--append-system-prompt', contextText, ...extraArgs] : [...extraArgs];
  } else if (agent === 'gemini-cli') {
    cmd = 'gemini';
    args = injectContext ? ['-i', contextText, ...extraArgs] : [...extraArgs];
  } else {
    cmd = 'codex';
    args = injectContext ? [...extraArgs, contextText] : [...extraArgs];
  }

  const result = runCommand(cmd, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message || String(result.error));
    process.exit(1);
  }
  process.exit(result.status ?? 1);
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
  const injectContext = packResult.ok && String(contextText).trim().length > 0;

  console.log(`Session: ${opts.sessionId}`);
  console.log(`Workspace: ${opts.workspaceRoot}`);
  if (packResult.mode === 'fresh') {
    console.log(`Context packet: ${packAbs}`);
  } else if (packResult.mode === 'stale') {
    console.log(`Context packet: ${packAbs} (stale)`);
  } else {
    console.log('Context packet: (unavailable)');
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
      const result = runOneShotAgent(opts.agent, contextText, opts.prompt, opts.extraArgs, { injectContext });
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

  runInteractiveAgent(opts.agent, contextText, opts.extraArgs, { injectContext });
}
