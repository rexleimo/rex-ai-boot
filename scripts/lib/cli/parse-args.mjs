import {
  createDefaultDoctorOptions,
  createDefaultEntropyGcOptions,
  createDefaultLearnEvalOptions,
  createDefaultOrchestrateOptions,
  createDefaultQualityGateOptions,
  createDefaultSetupOptions,
  createDefaultUninstallOptions,
  createDefaultUpdateOptions,
  normalizeClient,
  normalizeComponents,
  normalizeEntropyGcFormat,
  normalizeEntropyGcMode,
  normalizeHarnessProfile,
  normalizeLearnEvalFormat,
  normalizeOrchestrateDispatchMode,
  normalizeOrchestrateExecutionMode,
  normalizeOrchestratePreflightMode,
  normalizeQualityGateMode,
  normalizeSkillInstallMode,
  normalizeSkillNames,
  normalizeSkillScope,
  normalizeWrapMode,
} from '../lifecycle/options.mjs';
import { normalizeOrchestratorBlueprint, normalizeOrchestratorFormat } from '../harness/orchestrator.mjs';

const INTERNAL_TARGETS = new Set(['shell', 'skills', 'native', 'superpowers', 'browser', 'privacy']);
const PRIVACY_MODES = new Set(['regex', 'ollama', 'hybrid']);
const TEAM_PROVIDERS = new Set(['codex', 'claude', 'gemini']);
const HUD_PRESETS = new Set(['minimal', 'focused', 'full']);
const TEAM_PROVIDER_CLIENT_MAP = Object.freeze({
  codex: 'codex-cli',
  claude: 'claude-code',
  gemini: 'gemini-cli',
});

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parsePositiveInteger(raw, flag) {
  const value = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

function parsePrivacyMode(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!PRIVACY_MODES.has(value)) {
    throw new Error('--mode must be one of: regex, ollama, hybrid');
  }
  return value;
}

function normalizeTeamProvider(raw = 'codex') {
  const value = String(raw || 'codex').trim().toLowerCase();
  if (!TEAM_PROVIDERS.has(value)) {
    throw new Error(`--provider must be one of: ${[...TEAM_PROVIDERS].join(', ')}`);
  }
  return value;
}

function parseTeamSpec(raw = '') {
  const value = String(raw || '').trim().toLowerCase();
  const match = /^(\d+):(codex|claude|gemini)$/u.exec(value);
  if (!match) {
    return null;
  }
  const workers = parsePositiveInteger(match[1], 'team workers');
  return {
    workers,
    provider: normalizeTeamProvider(match[2]),
  };
}

function normalizeHudPreset(raw = '') {
  const value = String(raw || '').trim().toLowerCase();
  if (!HUD_PRESETS.has(value)) {
    throw new Error(`--preset must be one of: ${[...HUD_PRESETS].join(', ')}`);
  }
  return value;
}

function createDefaultHudOptions() {
  return {
    sessionId: '',
    provider: 'codex',
    preset: 'focused',
    watch: false,
    fast: false,
    json: false,
    intervalMs: 1000,
  };
}

function parseHudArgs(argv) {
  const rest = argv.slice(1);
  const options = createDefaultHudOptions();
  let help = false;
  let presetExplicit = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }

    switch (arg) {
      case '--session':
        options.sessionId = takeValue(rest, index, '--session');
        index += 1;
        break;
      case '--provider':
        options.provider = normalizeTeamProvider(takeValue(rest, index, '--provider'));
        index += 1;
        break;
      case '--preset':
        presetExplicit = true;
        options.preset = normalizeHudPreset(takeValue(rest, index, '--preset'));
        index += 1;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--fast':
        options.fast = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--interval-ms':
        options.intervalMs = parsePositiveInteger(takeValue(rest, index, '--interval-ms'), '--interval-ms');
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.provider = normalizeTeamProvider(options.provider);
  if (options.watch && !presetExplicit) {
    options.preset = 'minimal';
  }
  return {
    mode: help ? 'help' : 'command',
    help,
    command: 'hud',
    options,
  };
}

function createDefaultTeamOptions() {
  return {
    workers: 3,
    provider: 'codex',
    clientId: TEAM_PROVIDER_CLIENT_MAP.codex,
    blueprint: 'feature',
    taskTitle: '',
    contextSummary: '',
    sessionId: '',
    limit: 10,
    recommendationId: '',
    preflightMode: 'none',
    executionMode: 'live',
    resumeSessionId: '',
    retryBlocked: false,
    force: false,
    format: 'text',
    teamSpec: '3:codex',
  };
}

function createDefaultTeamStatusOptions() {
  return {
    subcommand: 'status',
    provider: 'codex',
    clientId: TEAM_PROVIDER_CLIENT_MAP.codex,
    sessionId: '',
    resumeSessionId: '',
    preset: 'focused',
    watch: false,
    fast: false,
    json: false,
    intervalMs: 1000,
  };
}

function parseTeamStatusArgs(argv) {
  const rest = argv.slice(2);
  const options = createDefaultTeamStatusOptions();
  let help = false;
  let presetExplicit = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }
    if (!arg.startsWith('-')) {
      if (!options.sessionId) {
        options.sessionId = String(arg || '').trim();
        continue;
      }
      throw new Error(`Unexpected argument: ${arg}`);
    }

    switch (arg) {
      case '--provider':
        options.provider = normalizeTeamProvider(takeValue(rest, index, '--provider'));
        index += 1;
        break;
      case '--session':
        options.sessionId = takeValue(rest, index, '--session');
        index += 1;
        break;
      case '--resume':
        options.resumeSessionId = takeValue(rest, index, '--resume');
        index += 1;
        break;
      case '--preset':
        presetExplicit = true;
        options.preset = normalizeHudPreset(takeValue(rest, index, '--preset'));
        index += 1;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--fast':
        options.fast = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--interval-ms':
        options.intervalMs = parsePositiveInteger(takeValue(rest, index, '--interval-ms'), '--interval-ms');
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.provider = normalizeTeamProvider(options.provider);
  options.clientId = TEAM_PROVIDER_CLIENT_MAP[options.provider];
  if (!options.sessionId && options.resumeSessionId) {
    options.sessionId = options.resumeSessionId;
  }
  if (options.watch && !presetExplicit) {
    options.preset = 'minimal';
  }

  return {
    mode: help ? 'help' : 'command',
    help,
    command: 'team',
    options,
  };
}

function createDefaultTeamHistoryOptions() {
  return {
    subcommand: 'history',
    provider: 'codex',
    clientId: TEAM_PROVIDER_CLIENT_MAP.codex,
    limit: 10,
    concurrency: 4,
    fast: false,
    since: '',
    status: '',
    json: false,
  };
}

function normalizeSinceIso(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw new Error('--since must be an ISO timestamp (e.g., 2026-04-06T00:00:00.000Z)');
  }
  return new Date(parsed).toISOString();
}

function parseTeamHistoryArgs(argv) {
  const rest = argv.slice(2);
  const options = createDefaultTeamHistoryOptions();
  let help = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }

    switch (arg) {
      case '--provider':
        options.provider = normalizeTeamProvider(takeValue(rest, index, '--provider'));
        index += 1;
        break;
      case '--limit':
        options.limit = parsePositiveInteger(takeValue(rest, index, '--limit'), '--limit');
        index += 1;
        break;
      case '--concurrency':
        options.concurrency = parsePositiveInteger(takeValue(rest, index, '--concurrency'), '--concurrency');
        index += 1;
        break;
      case '--fast':
        options.fast = true;
        break;
      case '--since':
        options.since = normalizeSinceIso(takeValue(rest, index, '--since'));
        index += 1;
        break;
      case '--status':
        options.status = String(takeValue(rest, index, '--status') ?? '').trim();
        index += 1;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.provider = normalizeTeamProvider(options.provider);
  options.clientId = TEAM_PROVIDER_CLIENT_MAP[options.provider];

  return {
    mode: help ? 'help' : 'command',
    help,
    command: 'team',
    options,
  };
}

function parseTeamArgs(argv) {
  const rest = argv.slice(1);
  const subcommand = rest[0] && !rest[0].startsWith('-') ? String(rest[0]).trim().toLowerCase() : '';
  if (subcommand === 'status') {
    return parseTeamStatusArgs(argv);
  }
  if (subcommand === 'history') {
    return parseTeamHistoryArgs(argv);
  }

  const options = createDefaultTeamOptions();
  let help = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }
    if (!arg.startsWith('-')) {
      const teamSpec = parseTeamSpec(arg);
      if (teamSpec) {
        options.workers = teamSpec.workers;
        options.provider = teamSpec.provider;
        continue;
      }
      options.taskTitle = options.taskTitle
        ? `${options.taskTitle} ${arg}`
        : arg;
      continue;
    }

    switch (arg) {
      case '--workers':
        options.workers = parsePositiveInteger(takeValue(rest, index, '--workers'), '--workers');
        index += 1;
        break;
      case '--provider':
        options.provider = normalizeTeamProvider(takeValue(rest, index, '--provider'));
        index += 1;
        break;
      case '--blueprint':
        options.blueprint = normalizeOrchestratorBlueprint(takeValue(rest, index, '--blueprint'));
        index += 1;
        break;
      case '--task':
        options.taskTitle = takeValue(rest, index, '--task');
        index += 1;
        break;
      case '--context':
        options.contextSummary = takeValue(rest, index, '--context');
        index += 1;
        break;
      case '--session':
        options.sessionId = takeValue(rest, index, '--session');
        index += 1;
        break;
      case '--resume':
        options.resumeSessionId = takeValue(rest, index, '--resume');
        index += 1;
        break;
      case '--limit':
        options.limit = parsePositiveInteger(takeValue(rest, index, '--limit'), '--limit');
        index += 1;
        break;
      case '--recommendation':
        options.recommendationId = takeValue(rest, index, '--recommendation');
        index += 1;
        break;
      case '--preflight':
        options.preflightMode = normalizeOrchestratePreflightMode(takeValue(rest, index, '--preflight'));
        index += 1;
        break;
      case '--format':
        options.format = normalizeOrchestratorFormat(takeValue(rest, index, '--format'));
        index += 1;
        break;
      case '--retry-blocked':
        options.retryBlocked = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.executionMode = 'dry-run';
        break;
      case '--live':
        options.executionMode = 'live';
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.provider = normalizeTeamProvider(options.provider);
  options.clientId = TEAM_PROVIDER_CLIENT_MAP[options.provider];
  options.teamSpec = `${options.workers}:${options.provider}`;
  if (!options.sessionId && options.resumeSessionId) {
    options.sessionId = options.resumeSessionId;
  }
  if (options.retryBlocked && !options.sessionId) {
    throw new Error('--retry-blocked requires --resume <session-id> or --session <session-id>');
  }

  return {
    mode: help ? 'help' : 'command',
    help,
    command: 'team',
    options,
  };
}

function parseInternalArgs(argv) {
  const target = String(argv[0] || '').trim().toLowerCase();
  const action = String(argv[1] || '').trim().toLowerCase();
  if (!INTERNAL_TARGETS.has(target)) {
    throw new Error(`Unknown internal target: ${argv[0] || '<missing>'}`);
  }
  if (!action) {
    throw new Error(`Missing internal action for target: ${target}`);
  }

  const rest = argv.slice(2);
  let help = false;
  const options = { target, action };
  if (target === 'native' && action === 'repair') {
    options.repairAction = 'list';
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }
    if (target === 'native' && action === 'repair' && !arg.startsWith('-')) {
      const repairAction = String(arg || '').trim().toLowerCase();
      if (!['list', 'show'].includes(repairAction)) {
        throw new Error('native repair action must be one of: list, show');
      }
      options.repairAction = repairAction;
      continue;
    }

    switch (arg) {
      case '--mode':
        if (target === 'privacy') {
          options.mode = parsePrivacyMode(takeValue(rest, index, '--mode'));
        } else {
          options.mode = normalizeWrapMode(takeValue(rest, index, '--mode'));
        }
        index += 1;
        break;
      case '--client':
        options.client = normalizeClient(takeValue(rest, index, '--client'));
        index += 1;
        break;
      case '--scope':
        options.scope = normalizeSkillScope(takeValue(rest, index, '--scope'));
        index += 1;
        break;
      case '--skills':
        options.skills = normalizeSkillNames(takeValue(rest, index, '--skills'));
        index += 1;
        break;
      case '--install-mode':
        if (target !== 'skills') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.installMode = normalizeSkillInstallMode(takeValue(rest, index, '--install-mode'));
        index += 1;
        break;
      case '--rc-file':
        options.rcFile = takeValue(rest, index, '--rc-file');
        index += 1;
        break;
      case '--repo':
        options.repoUrl = takeValue(rest, index, '--repo');
        index += 1;
        break;
      case '--repair-id':
        if (target !== 'native' || (action !== 'rollback' && action !== 'repair')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.repairId = takeValue(rest, index, '--repair-id');
        index += 1;
        break;
      case '--limit':
        if (target !== 'native' || action !== 'repair') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.limit = parsePositiveInteger(takeValue(rest, index, '--limit'), '--limit');
        index += 1;
        break;
      case '--force':
        options.force = true;
        break;
      case '--update':
        options.update = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        if (target !== 'native' || action !== 'doctor') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.verbose = true;
        break;
      case '--fix':
        if (target !== 'native' || action !== 'doctor') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.fix = true;
        break;
      case '--skip-playwright-install':
        options.skipPlaywrightInstall = true;
        break;
      case '--enable':
        options.enable = true;
        break;
      case '--disable':
        options.disable = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return {
    mode: help ? 'help' : 'command',
    help,
    command: 'internal',
    options,
  };
}

function parseMemoArgs(argv) {
  const rest = argv.slice(1);
  let help = false;
  const passthrough = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') {
      passthrough.push(...rest.slice(index + 1));
      break;
    }
    if (arg === '-h' || arg === '--help' || arg === 'help') {
      help = true;
      continue;
    }
    passthrough.push(arg);
  }

  return {
    mode: help ? 'help' : 'command',
    help,
    command: 'memo',
    options: {
      argv: passthrough,
    },
  };
}

function getCommandDefaults(command) {
  if (command === 'setup') return createDefaultSetupOptions();
  if (command === 'update') return createDefaultUpdateOptions();
  if (command === 'uninstall') return createDefaultUninstallOptions();
  if (command === 'doctor') return createDefaultDoctorOptions();
  if (command === 'quality-gate') return createDefaultQualityGateOptions();
  if (command === 'orchestrate') return createDefaultOrchestrateOptions();
  if (command === 'entropy-gc') return createDefaultEntropyGcOptions();
  return createDefaultLearnEvalOptions();
}

function parseTopLevelArgs(command, argv) {
  const rest = argv.slice(1);
  const defaults = getCommandDefaults(command);
  const options = { ...defaults };
  let help = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }

    if (command === 'quality-gate' && !arg.startsWith('-') && index === 0) {
      options.mode = normalizeQualityGateMode(arg);
      continue;
    }

    if (command === 'orchestrate' && !arg.startsWith('-') && index === 0) {
      options.blueprint = normalizeOrchestratorBlueprint(arg);
      continue;
    }

    if (command === 'entropy-gc' && !arg.startsWith('-') && index === 0) {
      options.mode = normalizeEntropyGcMode(arg);
      continue;
    }

    switch (arg) {
      case '--components':
        options.components = normalizeComponents(takeValue(rest, index, '--components'), defaults.components);
        index += 1;
        break;
      case '--mode':
        options.wrapMode = normalizeWrapMode(takeValue(rest, index, '--mode'));
        index += 1;
        break;
      case '--client':
        options.client = normalizeClient(takeValue(rest, index, '--client'));
        index += 1;
        break;
      case '--scope':
        if (command !== 'setup' && command !== 'update' && command !== 'uninstall') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.scope = normalizeSkillScope(takeValue(rest, index, '--scope'));
        index += 1;
        break;
      case '--skills':
        if (command !== 'setup' && command !== 'update' && command !== 'uninstall') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.skills = normalizeSkillNames(takeValue(rest, index, '--skills'));
        index += 1;
        break;
      case '--install-mode':
        if (command !== 'setup' && command !== 'update') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.installMode = normalizeSkillInstallMode(takeValue(rest, index, '--install-mode'));
        index += 1;
        break;
      case '--skip-playwright-install':
        options.skipPlaywrightInstall = true;
        break;
      case '--with-playwright-install':
        options.withPlaywrightInstall = true;
        break;
      case '--skip-doctor':
        options.skipDoctor = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--global-security':
        options.globalSecurity = true;
        break;
      case '--native':
        if (command !== 'doctor') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.nativeOnly = true;
        break;
      case '--verbose':
        if (command !== 'doctor') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.verbose = true;
        break;
      case '--fix':
        if (command !== 'doctor') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.fix = true;
        break;
      case '--dry-run':
        if (command !== 'doctor') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.dryRun = true;
        break;
      case '--profile':
        options.profile = normalizeHarnessProfile(takeValue(rest, index, '--profile'));
        index += 1;
        break;
      case '--task':
        options.taskTitle = takeValue(rest, index, '--task');
        index += 1;
        break;
      case '--context':
        options.contextSummary = takeValue(rest, index, '--context');
        index += 1;
        break;
      case '--session':
        if (command !== 'learn-eval' && command !== 'orchestrate' && command !== 'quality-gate' && command !== 'entropy-gc') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.sessionId = takeValue(rest, index, '--session');
        index += 1;
        break;
      case '--limit':
        if (command !== 'learn-eval' && command !== 'orchestrate') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.limit = parsePositiveInteger(takeValue(rest, index, '--limit'), '--limit');
        index += 1;
        break;
      case '--recommendation':
        if (command !== 'orchestrate') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.recommendationId = takeValue(rest, index, '--recommendation');
        index += 1;
        break;
      case '--dispatch':
        if (command !== 'orchestrate') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.dispatchMode = normalizeOrchestrateDispatchMode(takeValue(rest, index, '--dispatch'));
        index += 1;
        break;
      case '--execute':
        if (command !== 'orchestrate') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.executionMode = normalizeOrchestrateExecutionMode(takeValue(rest, index, '--execute'));
        index += 1;
        break;
      case '--preflight':
        if (command !== 'orchestrate') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.preflightMode = normalizeOrchestratePreflightMode(takeValue(rest, index, '--preflight'));
        index += 1;
        break;
      case '--format': {
        const value = takeValue(rest, index, '--format');
        if (command === 'orchestrate') {
          options.format = normalizeOrchestratorFormat(value);
        } else if (command === 'learn-eval') {
          options.format = normalizeLearnEvalFormat(value);
        } else if (command === 'entropy-gc') {
          options.format = normalizeEntropyGcFormat(value);
        } else {
          throw new Error(`Unknown option: ${arg}`);
        }
        index += 1;
        break;
      }
      case '--retain':
        if (command !== 'entropy-gc') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.retain = parsePositiveInteger(takeValue(rest, index, '--retain'), '--retain');
        index += 1;
        break;
      case '--min-age-hours':
        if (command !== 'entropy-gc') {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.minAgeHours = parsePositiveInteger(takeValue(rest, index, '--min-age-hours'), '--min-age-hours');
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return {
    mode: help ? 'help' : 'command',
    help,
    command,
    options,
  };
}

export function parseArgs(argv = []) {
  if (argv.length === 0) {
    return {
      mode: 'interactive',
      help: false,
      command: 'tui',
      options: {},
    };
  }

  const first = String(argv[0] || '').trim().toLowerCase();
  if (first === '-h' || first === '--help' || first === 'help') {
    return {
      mode: 'help',
      help: true,
      command: 'root',
      options: {},
    };
  }

  if (first === 'memo') {
    return parseMemoArgs(argv);
  }

  if (first === 'internal') {
    return parseInternalArgs(argv.slice(1));
  }

  if (first === 'team') {
    return parseTeamArgs(argv);
  }

  if (first === 'hud') {
    return parseHudArgs(argv);
  }

  const command = first === 'verify'
    ? 'doctor'
    : first === 'quality' || first === 'quality-gate'
      ? 'quality-gate'
      : first === 'entropy'
        ? 'entropy-gc'
      : first;

  if (!['setup', 'update', 'uninstall', 'doctor', 'quality-gate', 'orchestrate', 'team', 'hud', 'learn-eval', 'entropy-gc'].includes(command)) {
    throw new Error(`Unknown command: ${argv[0]}`);
  }

  return parseTopLevelArgs(command, argv);
}
