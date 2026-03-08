import {
  createDefaultSetupOptions,
  hasComponent,
  normalizeClient,
  normalizeComponents,
  normalizeWrapMode,
} from './options.mjs';
import { installBrowserMcp } from '../components/browser.mjs';
import { doctorBrowserMcp } from '../components/browser.mjs';
import { doctorContextDbShell, installContextDbShell, installPrivacyGuard } from '../components/shell.mjs';
import { doctorContextDbSkills, installContextDbSkills } from '../components/skills.mjs';
import { doctorSuperpowers, installSuperpowers } from '../components/superpowers.mjs';

export function normalizeSetupOptions(rawOptions = {}) {
  const defaults = createDefaultSetupOptions();
  return {
    components: normalizeComponents(rawOptions.components, defaults.components),
    wrapMode: normalizeWrapMode(rawOptions.wrapMode ?? defaults.wrapMode),
    client: normalizeClient(rawOptions.client ?? defaults.client),
    skipPlaywrightInstall: Boolean(rawOptions.skipPlaywrightInstall ?? defaults.skipPlaywrightInstall),
    skipDoctor: Boolean(rawOptions.skipDoctor ?? defaults.skipDoctor),
  };
}

export function planSetup(rawOptions = {}) {
  const options = normalizeSetupOptions(rawOptions);
  const args = [
    'setup',
    '--components', options.components.join(','),
    '--mode', options.wrapMode,
    '--client', options.client,
  ];
  if (options.skipPlaywrightInstall) args.push('--skip-playwright-install');
  if (options.skipDoctor) args.push('--skip-doctor');
  return {
    command: 'setup',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runSetup(rawOptions = {}, { rootDir, io = console } = {}) {
  const { options } = planSetup(rawOptions);
  io.log(`Setup components: ${options.components.join(',')}`);

  if (hasComponent(options.components, 'browser')) {
    await installBrowserMcp({ rootDir, skipPlaywrightInstall: options.skipPlaywrightInstall, io });
    if (!options.skipDoctor) {
      await doctorBrowserMcp({ rootDir, io });
    }
  }

  if (hasComponent(options.components, 'shell')) {
    await installContextDbShell({ rootDir, mode: options.wrapMode, io });
    await installPrivacyGuard({ rootDir, io });
    if (!options.skipDoctor) {
      await doctorContextDbShell({ io });
    }
  }

  if (hasComponent(options.components, 'skills')) {
    await installContextDbSkills({ rootDir, client: options.client, io });
    if (!options.skipDoctor) {
      await doctorContextDbSkills({ rootDir, client: options.client, io });
    }
  }

  if (hasComponent(options.components, 'superpowers')) {
    await installSuperpowers({ io });
    if (!options.skipDoctor) {
      const result = await doctorSuperpowers({ io });
      if (result.errors > 0) {
        throw new Error(`doctor-superpowers failed (${result.errors} errors)`);
      }
    }
  }

  if (hasComponent(options.components, 'shell')) {
    io.log('');
    io.log(process.platform === 'win32' ? 'Run: . $PROFILE' : 'Run: source ~/.zshrc');
  }

  io.log('Done.');
}
