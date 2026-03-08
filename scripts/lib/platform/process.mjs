import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function splitExecutionOptions(options = {}) {
  const {
    platform = process.platform,
    execPath = process.execPath,
    ...spawnOptions
  } = options;

  return { platform, execPath, spawnOptions };
}

function findFirstExisting(paths) {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getWindowsNodeCli(command, { platform = process.platform, execPath = process.execPath } = {}) {
  if (platform !== 'win32' || !fs.existsSync(execPath)) {
    return null;
  }

  const nodeDir = path.dirname(execPath);
  const npmCli = findFirstExisting([
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]);

  const npxCli = findFirstExisting([
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ]);

  if (command === 'npm' && npmCli) {
    return { command: execPath, argsPrefix: [npmCli] };
  }

  if (command === 'npx') {
    if (npxCli) {
      return { command: execPath, argsPrefix: [npxCli] };
    }

    if (npmCli) {
      return { command: execPath, argsPrefix: [npmCli, 'exec', '--'] };
    }
  }

  return null;
}

export function getCommandSpawnSpec(command, args = [], options = {}) {
  const { platform, execPath } = splitExecutionOptions(options);
  const windowsNodeCli = getWindowsNodeCli(command, { platform, execPath });
  if (windowsNodeCli) {
    return {
      command: windowsNodeCli.command,
      args: [...windowsNodeCli.argsPrefix, ...args],
    };
  }

  return { command, args };
}

export function commandExists(name, options = {}) {
  const { platform, execPath, spawnOptions } = splitExecutionOptions(options);
  if (getWindowsNodeCli(name, { platform, execPath })) {
    return true;
  }

  const probe = platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(probe, [name], {
    stdio: 'ignore',
    env: spawnOptions.env,
  });
  return result.status === 0;
}

export function captureCommand(command, args = [], options = {}) {
  const { spawnOptions } = splitExecutionOptions(options);
  const spec = getCommandSpawnSpec(command, args, options);
  const result = spawnSync(spec.command, spec.args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...spawnOptions,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null,
  };
}

export function runCommand(command, args = [], options = {}) {
  const { spawnOptions } = splitExecutionOptions(options);
  const spec = getCommandSpawnSpec(command, args, options);
  const result = spawnSync(spec.command, spec.args, {
    stdio: 'inherit',
    ...spawnOptions,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`.trim());
  }

  return result;
}
