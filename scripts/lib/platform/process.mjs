import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const WINDOWS_SHELL_COMMANDS = new Set(['codex', 'claude', 'gemini']);

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

function shouldUseWindowsShellCommand(command, { platform = process.platform } = {}) {
  if (platform !== 'win32') {
    return false;
  }

  const normalized = path.basename(command).toLowerCase();
  const extension = path.extname(normalized);
  if (extension === '.cmd' || extension === '.bat') {
    return true;
  }

  if (extension.length > 0) {
    return false;
  }

  return WINDOWS_SHELL_COMMANDS.has(normalized);
}

export function getCommandSpawnSpec(command, args = [], options = {}) {
  const { platform, execPath } = splitExecutionOptions(options);
  const windowsNodeCli = getWindowsNodeCli(command, { platform, execPath });
  if (windowsNodeCli) {
    return {
      command: windowsNodeCli.command,
      args: [...windowsNodeCli.argsPrefix, ...args],
      shell: false,
    };
  }

  return {
    command,
    args,
    shell: shouldUseWindowsShellCommand(command, { platform }),
  };
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
    shell: spec.shell ?? spawnOptions.shell ?? false,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null,
  };
}

export function spawnCommand(command, args = [], options = {}) {
  const { timeoutMs, ...rest } = options || {};
  const { spawnOptions } = splitExecutionOptions(rest);
  const spec = getCommandSpawnSpec(command, args, rest);

  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...spawnOptions,
      shell: spec.shell ?? spawnOptions.shell ?? false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let timer = null;

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
    }

    const finalize = (payload) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      resolve(payload);
    };

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          // ignore kill errors
        }
      }, Math.floor(timeoutMs));
    }

    child.on('error', (error) => {
      finalize({
        status: 1,
        stdout,
        stderr,
        error,
        timedOut,
      });
    });

    child.on('close', (code) => {
      finalize({
        status: typeof code === 'number' ? code : 1,
        stdout,
        stderr,
        error: null,
        timedOut,
      });
    });
  });
}

export function runCommand(command, args = [], options = {}) {
  const { spawnOptions } = splitExecutionOptions(options);
  const spec = getCommandSpawnSpec(command, args, options);
  const result = spawnSync(spec.command, spec.args, {
    stdio: 'inherit',
    ...spawnOptions,
    shell: spec.shell ?? spawnOptions.shell ?? false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`.trim());
  }

  return result;
}
