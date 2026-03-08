import os from 'node:os';
import path from 'node:path';

import { ensureManagedLink, isManagedLink } from '../platform/fs.mjs';
import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';
import { getAgentsHome, normalizeHomeDir } from '../platform/paths.mjs';

const DEFAULT_REPO_URL = 'https://github.com/obra/superpowers.git';

export async function installSuperpowers({
  repoUrl = DEFAULT_REPO_URL,
  update = false,
  force = false,
  env = process.env,
  io = console,
} = {}) {
  if (!commandExists('git')) {
    throw new Error('Missing required command: git');
  }

  const homeDir = os.homedir();
  const codexHome = normalizeHomeDir(env.CODEX_HOME, path.join(homeDir, '.codex'), homeDir);
  const agentsHome = getAgentsHome(env, homeDir);
  const superpowersDir = path.join(codexHome, 'superpowers');
  const skillsSource = path.join(superpowersDir, 'skills');
  const skillsTarget = path.join(agentsHome, 'skills', 'superpowers');

  const gitDir = path.join(superpowersDir, '.git');
  if (path.dirname(gitDir) && commandExists('git')) {
    // noop; keeps branch explicit and stable
  }

  if (captureCommand('git', ['-C', superpowersDir, 'rev-parse', '--git-dir']).status === 0) {
    io.log(`[ok] superpowers repo found: ${superpowersDir}`);
    if (update) {
      io.log(`+ git -C ${superpowersDir} pull --ff-only`);
      runCommand('git', ['-C', superpowersDir, 'pull', '--ff-only']);
    }
  } else if (await import('node:fs').then((mod) => mod.default.existsSync(superpowersDir))) {
    if (!force) {
      throw new Error(`path exists but is not a git repo: ${superpowersDir}`);
    }
    (await import('node:fs')).default.rmSync(superpowersDir, { recursive: true, force: true });
    io.log(`+ git clone ${repoUrl} ${superpowersDir}`);
    runCommand('git', ['clone', repoUrl, superpowersDir]);
  } else {
    io.log(`+ git clone ${repoUrl} ${superpowersDir}`);
    runCommand('git', ['clone', repoUrl, superpowersDir]);
  }

  const status = ensureManagedLink(skillsTarget, skillsSource, { force });
  if (status === 'reused') {
    io.log(`[ok] superpowers link already configured: ${skillsTarget}`);
  } else {
    io.log(`[link] superpowers linked: ${skillsTarget} -> ${skillsSource}`);
  }

  io.log('[done] superpowers install complete');
}

export async function doctorSuperpowers({ env = process.env, io = console } = {}) {
  const homeDir = os.homedir();
  const codexHome = normalizeHomeDir(env.CODEX_HOME, path.join(homeDir, '.codex'), homeDir);
  const agentsHome = getAgentsHome(env, homeDir);
  const superpowersDir = path.join(codexHome, 'superpowers');
  const skillsSource = path.join(superpowersDir, 'skills');
  const skillsTarget = path.join(agentsHome, 'skills', 'superpowers');

  let warnings = 0;
  let errors = 0;
  const warn = (message) => {
    warnings += 1;
    io.log(`WARN ${message}`);
  };
  const err = (message) => {
    errors += 1;
    io.log(`ERR  ${message}`);
  };
  const ok = (message) => io.log(`OK   ${message}`);

  io.log('Superpowers Doctor');
  io.log('------------------');

  if (commandExists('git')) ok('command exists: git');
  else err('missing command: git');

  io.log(`codex_home: ${codexHome}`);
  io.log(`agents_home: ${agentsHome}`);
  io.log(`superpowers_dir: ${superpowersDir}`);

  if (captureCommand('git', ['-C', superpowersDir, 'rev-parse', '--git-dir']).status === 0) {
    ok('superpowers git repo found');
    const remote = captureCommand('git', ['-C', superpowersDir, 'config', '--get', 'remote.origin.url']);
    if (remote.stdout.trim()) ok(`origin: ${remote.stdout.trim()}`); else warn('origin URL is not configured');
    const head = captureCommand('git', ['-C', superpowersDir, 'rev-parse', '--short', 'HEAD']);
    if (head.stdout.trim()) ok(`HEAD: ${head.stdout.trim()}`); else warn('cannot read HEAD');
  } else {
    err(`missing superpowers git repo: ${superpowersDir}`);
  }

  const fs = (await import('node:fs')).default;
  if (fs.existsSync(skillsSource)) ok(`skills source found: ${skillsSource}`);
  else err(`missing skills source directory: ${skillsSource}`);

  if (isManagedLink(skillsTarget, skillsSource)) ok(`skills link valid: ${skillsTarget} -> ${skillsSource}`);
  else err(`skills link missing or incorrect: ${skillsTarget}`);

  if (errors > 0) {
    io.log(`Result: FAILED (${errors} errors, ${warnings} warnings)`);
  } else {
    io.log(`Result: OK (${warnings} warnings)`);
  }

  return { warnings, effectiveWarnings: warnings, errors };
}
