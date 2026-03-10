import {
  createDefaultUninstallOptions,
  hasComponent,
  normalizeClient,
  normalizeComponents,
} from './options.mjs';
import { uninstallOrchestratorAgents } from '../components/agents.mjs';
import { uninstallContextDbShell } from '../components/shell.mjs';
import { uninstallContextDbSkills } from '../components/skills.mjs';

export function normalizeUninstallOptions(rawOptions = {}) {
  const defaults = createDefaultUninstallOptions();
  return {
    components: normalizeComponents(rawOptions.components, defaults.components),
    client: normalizeClient(rawOptions.client ?? defaults.client),
  };
}

export function planUninstall(rawOptions = {}) {
  const options = normalizeUninstallOptions(rawOptions);
  const args = [
    'uninstall',
    '--components', options.components.join(','),
    '--client', options.client,
  ];
  return {
    command: 'uninstall',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runUninstall(rawOptions = {}, { io = console, rootDir } = {}) {
  const { options } = planUninstall(rawOptions);
  io.log(`Uninstall components: ${options.components.join(',')}`);

  if (hasComponent(options.components, 'shell')) {
    await uninstallContextDbShell({ io });
  }

  if (hasComponent(options.components, 'skills')) {
    await uninstallContextDbSkills({ rootDir, client: options.client, io });
  }

  if (hasComponent(options.components, 'agents')) {
    await uninstallOrchestratorAgents({ rootDir, client: options.client, io });
  }

  if (hasComponent(options.components, 'browser')) {
    io.log('[info] Browser MCP has no destructive auto-uninstall script.');
    io.log('[info] It is safe to keep mcp-server build/runtime artifacts.');
  }

  if (hasComponent(options.components, 'superpowers')) {
    io.log('[info] Superpowers has no destructive auto-uninstall script.');
    io.log('[info] It is safe to keep ~/.codex/superpowers.');
  }

  if (hasComponent(options.components, 'shell')) {
    io.log('');
    io.log(process.platform === 'win32' ? 'Run: . $PROFILE' : 'Run: source ~/.zshrc');
  }

  io.log('Done.');
}
