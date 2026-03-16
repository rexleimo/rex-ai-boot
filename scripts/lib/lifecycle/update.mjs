import {
  createDefaultUpdateOptions,
  hasComponent,
  normalizeClient,
  normalizeComponents,
  normalizeSkillNames,
  normalizeSkillScope,
  normalizeWrapMode,
} from './options.mjs';
import { installOrchestratorAgents } from '../components/agents.mjs';
import { installBrowserMcp } from '../components/browser.mjs';
import { doctorBrowserMcp } from '../components/browser.mjs';
import { doctorContextDbShell, installContextDbShell, installPrivacyGuard } from '../components/shell.mjs';
import { doctorContextDbSkills, installContextDbSkills } from '../components/skills.mjs';
import { doctorSuperpowers, installSuperpowers } from '../components/superpowers.mjs';

export function normalizeUpdateOptions(rawOptions = {}) {
  const defaults = createDefaultUpdateOptions();
  return {
    components: normalizeComponents(rawOptions.components, defaults.components),
    wrapMode: normalizeWrapMode(rawOptions.wrapMode ?? defaults.wrapMode),
    client: normalizeClient(rawOptions.client ?? defaults.client),
    scope: normalizeSkillScope(rawOptions.scope ?? defaults.scope),
    skills: normalizeSkillNames(rawOptions.skills ?? defaults.skills),
    withPlaywrightInstall: Boolean(rawOptions.withPlaywrightInstall ?? defaults.withPlaywrightInstall),
    skipDoctor: Boolean(rawOptions.skipDoctor ?? defaults.skipDoctor),
  };
}

export function planUpdate(rawOptions = {}) {
  const options = normalizeUpdateOptions(rawOptions);
  const args = [
    'update',
    '--components', options.components.join(','),
    '--mode', options.wrapMode,
    '--client', options.client,
    '--scope', options.scope,
  ];
  if (options.skills.length > 0) args.push('--skills', options.skills.join(','));
  if (options.withPlaywrightInstall) args.push('--with-playwright-install');
  if (options.skipDoctor) args.push('--skip-doctor');
  return {
    command: 'update',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runUpdate(rawOptions = {}, { rootDir, projectRoot = rootDir, io = console } = {}) {
  const { options } = planUpdate(rawOptions);
  io.log(`Update components: ${options.components.join(',')}`);

  if (hasComponent(options.components, 'browser')) {
    await installBrowserMcp({ rootDir, skipPlaywrightInstall: !options.withPlaywrightInstall, io });
    if (!options.skipDoctor) {
      await doctorBrowserMcp({ rootDir, io });
    }
  }

  if (hasComponent(options.components, 'shell')) {
    await installContextDbShell({ rootDir, mode: options.wrapMode, force: true, io });
    await installPrivacyGuard({ rootDir, io });
    if (!options.skipDoctor) {
      await doctorContextDbShell({ io });
    }
  }

  if (hasComponent(options.components, 'skills')) {
    await installContextDbSkills({ rootDir, projectRoot, client: options.client, scope: options.scope, selectedSkills: options.skills, force: true, io });
    if (!options.skipDoctor) {
      await doctorContextDbSkills({ rootDir, projectRoot, client: options.client, scope: options.scope, selectedSkills: options.skills, io });
    }
  }

  if (hasComponent(options.components, 'agents')) {
    await installOrchestratorAgents({ rootDir, client: options.client, io });
  }

  if (hasComponent(options.components, 'superpowers')) {
    await installSuperpowers({ update: true, force: true, io });
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
