import os from 'node:os';
import path from 'node:path';

import { commandExists, runCommand } from '../platform/process.mjs';
import {
  ensureFile,
  readTextIfExists,
  stripManagedBlock,
  stripMatchingLines,
  writeText,
} from '../platform/fs.mjs';
import { resolvePowerShellProfilePath, resolveShellRcFile } from '../platform/paths.mjs';

const BEGIN_MARK = '# >>> contextdb-shell >>>';
const END_MARK = '# <<< contextdb-shell <<<';

function buildPosixBlock(rootDir, mode) {
  return `${BEGIN_MARK}\n# ContextDB transparent CLI wrappers (codex/claude/gemini)\nexport ROOTPATH="\${ROOTPATH:-${rootDir}}"\nexport CTXDB_WRAP_MODE="\${CTXDB_WRAP_MODE:-${mode}}"\nif [[ -f "\$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then\n  source "\$ROOTPATH/scripts/contextdb-shell.zsh"\nfi\n${END_MARK}\n`;
}

function buildPowerShellBlock(rootDir, mode) {
  return `${BEGIN_MARK}\n# ContextDB transparent CLI wrappers (codex/claude/gemini, PowerShell)\nif (-not $env:ROOTPATH) { $env:ROOTPATH = "${rootDir}" }\nif (-not $env:CTXDB_WRAP_MODE) { $env:CTXDB_WRAP_MODE = "${mode}" }\n$ctxShell = Join-Path $env:ROOTPATH "scripts/contextdb-shell.ps1"\nif (Test-Path $ctxShell) {\n  . $ctxShell\n}\n${END_MARK}\n`;
}

export async function installPrivacyGuard({ rootDir, enable = true, disable = false, mode = '', io = console } = {}) {
  const scriptPath = path.join(rootDir, 'scripts', 'privacy-guard.mjs');
  const args = [scriptPath, 'init'];
  if (enable && !disable) {
    args.push('--enable');
  }
  if (disable) {
    args.push('--disable');
  }
  if (mode) {
    args.push('--mode', mode);
  }
  io.log(`+ ${process.execPath} ${args.join(' ')}`);
  runCommand(process.execPath, args);
}

export async function installContextDbShell({
  rootDir,
  mode = 'opt-in',
  force = false,
  platform = process.platform,
  rcFile,
  env = process.env,
  io = console,
} = {}) {
  const targetFile = rcFile || (platform === 'win32' ? resolvePowerShellProfilePath(env, os.homedir()) : resolveShellRcFile(env, os.homedir()));
  ensureFile(targetFile);

  let content = readTextIfExists(targetFile);
  if (content.includes(BEGIN_MARK) && !force) {
    io.log(`Already installed (${BEGIN_MARK}). Use --force to update.`);
    return { status: 'reused', targetFile };
  }

  if (content.includes(BEGIN_MARK)) {
    content = stripManagedBlock(content, BEGIN_MARK, END_MARK);
  }

  const patterns = platform === 'win32'
    ? [/^\.\s+.*scripts\/contextdb-shell\.ps1\s*$/u, /^# ContextDB transparent CLI wrappers \(codex\/claude\/gemini, PowerShell\)$/u]
    : [/^source ".*\/scripts\/contextdb-shell\.zsh"$/u, /^# ContextDB transparent CLI wrappers \(codex\/claude\/gemini\)$/u];

  content = stripMatchingLines(content, patterns).trimEnd();
  const block = platform === 'win32' ? buildPowerShellBlock(rootDir, mode) : buildPosixBlock(rootDir, mode);
  const nextContent = `${content}${content ? '\n\n' : ''}${block}`;
  writeText(targetFile, nextContent);

  io.log(`Installed into ${targetFile}`);
  io.log(`Default wrap mode: ${mode}`);
  return { status: 'installed', targetFile };
}

export async function uninstallContextDbShell({
  platform = process.platform,
  rcFile,
  env = process.env,
  io = console,
} = {}) {
  const targetFile = rcFile || (platform === 'win32' ? resolvePowerShellProfilePath(env, os.homedir()) : resolveShellRcFile(env, os.homedir()));
  const content = readTextIfExists(targetFile);
  if (!content) {
    io.log(`No shell config found at ${targetFile}`);
    return { status: 'missing', targetFile };
  }

  const patterns = platform === 'win32'
    ? [/^\.\s+.*scripts\/contextdb-shell\.ps1\s*$/u, /^# ContextDB transparent CLI wrappers \(codex\/claude\/gemini, PowerShell\)$/u]
    : [/^source ".*\/scripts\/contextdb-shell\.zsh"$/u, /^# ContextDB transparent CLI wrappers \(codex\/claude\/gemini\)$/u];
  const stripped = stripMatchingLines(stripManagedBlock(content, BEGIN_MARK, END_MARK), patterns).trimEnd();
  writeText(targetFile, stripped ? `${stripped}\n` : '');
  io.log(`Removed managed shell block from ${targetFile}`);
  return { status: 'removed', targetFile };
}

export async function doctorContextDbShell({
  platform = process.platform,
  rcFile,
  env = process.env,
  io = console,
} = {}) {
  const targetFile = rcFile || (platform === 'win32' ? resolvePowerShellProfilePath(env, os.homedir()) : resolveShellRcFile(env, os.homedir()));
  let warnings = 0;
  let effectiveWarnings = 0;

  const warn = (message, { effective = true } = {}) => {
    warnings += 1;
    if (effective) effectiveWarnings += 1;
    io.log(`[warn] ${message}`);
  };

  io.log('ContextDB Shell Doctor');
  io.log('----------------------');
  io.log(`RC file: ${targetFile}`);

  const content = readTextIfExists(targetFile);
  if (!content) {
    warn(`rc file not found: ${targetFile}`);
  } else if (content.includes(BEGIN_MARK)) {
    io.log(`[ok] contextdb managed block found in ${targetFile}`);
  } else {
    warn(`contextdb managed block not found in ${targetFile}`);
  }

  io.log(`ROOTPATH: ${env.ROOTPATH || '<unset>'}`);
  io.log(`CTXDB_WRAP_MODE: ${env.CTXDB_WRAP_MODE || '<unset>'}`);
  io.log(`CODEX_HOME: ${env.CODEX_HOME || '<unset>'}`);

  if (env.CODEX_HOME) {
    if (!path.isAbsolute(env.CODEX_HOME)) {
      warn(`CODEX_HOME is relative (${env.CODEX_HOME}); wrappers resolve it against current working directory at runtime`);
    } else {
      io.log('[ok] CODEX_HOME looks valid');
    }
  }

  for (const command of ['codex', 'claude', 'gemini']) {
    if (commandExists(command)) {
      io.log(`[ok] ${command} found in PATH`);
    } else {
      warn(`${command} not found in PATH`, { effective: false });
    }
  }

  return { warnings, effectiveWarnings, errors: 0 };
}
