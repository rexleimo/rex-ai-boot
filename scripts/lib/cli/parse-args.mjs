import {
  createDefaultDoctorOptions,
  createDefaultSetupOptions,
  createDefaultUninstallOptions,
  createDefaultUpdateOptions,
  normalizeClient,
  normalizeComponents,
  normalizeWrapMode,
} from '../lifecycle/options.mjs';

const INTERNAL_TARGETS = new Set(['shell', 'skills', 'superpowers', 'browser', 'privacy']);
const PRIVACY_MODES = new Set(['regex', 'ollama', 'hybrid']);

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flag}`);
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

  if (first === 'internal') {
    return parseInternalArgs(argv.slice(1));
  }

  const command = first === 'verify' ? 'doctor' : first;
  if (!['setup', 'update', 'uninstall', 'doctor'].includes(command)) {
    throw new Error(`Unknown command: ${argv[0]}`);
  }

  const rest = argv.slice(1);
  const defaults = command === 'setup'
    ? createDefaultSetupOptions()
    : command === 'update'
      ? createDefaultUpdateOptions()
      : command === 'uninstall'
        ? createDefaultUninstallOptions()
        : createDefaultDoctorOptions();

  const options = { ...defaults };
  let help = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      help = true;
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
