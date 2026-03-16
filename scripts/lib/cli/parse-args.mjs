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
  normalizeWrapMode,
} from '../lifecycle/options.mjs';
import { normalizeOrchestratorBlueprint, normalizeOrchestratorFormat } from '../harness/orchestrator.mjs';

const INTERNAL_TARGETS = new Set(['shell', 'skills', 'superpowers', 'browser', 'privacy']);
const PRIVACY_MODES = new Set(['regex', 'ollama', 'hybrid']);

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

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
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
      case '--rc-file':
        options.rcFile = takeValue(rest, index, '--rc-file');
        index += 1;
        break;
      case '--repo':
        options.repoUrl = takeValue(rest, index, '--repo');
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

  const command = first === 'verify'
    ? 'doctor'
    : first === 'quality' || first === 'quality-gate'
      ? 'quality-gate'
      : first === 'entropy'
        ? 'entropy-gc'
      : first;

  if (!['setup', 'update', 'uninstall', 'doctor', 'quality-gate', 'orchestrate', 'learn-eval', 'entropy-gc'].includes(command)) {
    throw new Error(`Unknown command: ${argv[0]}`);
  }

  return parseTopLevelArgs(command, argv);
}
