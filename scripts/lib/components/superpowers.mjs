import os from 'node:os';
import path from 'node:path';

import { ensureManagedLink, isManagedLink } from '../platform/fs.mjs';
import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';
import { getAgentsHome, normalizeHomeDir } from '../platform/paths.mjs';

const DEFAULT_REPO_URL = 'https://github.com/obra/superpowers.git';
const CLAUDE_PLUGIN_NAME = 'superpowers@claude-plugins-official';

function getClaudePluginsPath(homeDir) {
  return path.join(homeDir, '.claude', 'plugins');
}

function getClaudeInstalledPluginsPath(homeDir) {
  return path.join(getClaudePluginsPath(homeDir), 'installed_plugins.json');
}

async function isClaudePluginInstalled(homeDir) {
  const fs = (await import('node:fs')).default;
  const pluginsPath = getClaudeInstalledPluginsPath(homeDir);
  if (!fs.existsSync(pluginsPath)) {
    return false;
  }
  try {
    const content = fs.readFileSync(pluginsPath, 'utf8');
    const data = JSON.parse(content);
    return Boolean(data.plugins?.[CLAUDE_PLUGIN_NAME]);
  } catch {
    return false;
  }
}

export async function installSuperpowers({
  repoUrl = DEFAULT_REPO_URL,
  update = false,
  force = false,
  installClaudePlugin = true,
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

  // Claude Code plugin check
  if (installClaudePlugin) {
    const pluginInstalled = await isClaudePluginInstalled(homeDir);
    if (pluginInstalled) {
      io.log(`[ok] Claude Code plugin already installed: ${CLAUDE_PLUGIN_NAME}`);

      // Link plugin skills to ~/.claude/skills/ for Skill tool access
      const claudeSkillsRoot = path.join(homeDir, '.claude', 'skills');
      const claudeSuperpowersLink = path.join(claudeSkillsRoot, 'superpowers');
      const pluginSkillsSource = path.join(getClaudePluginsPath(homeDir), 'cache', 'claude-plugins-official', 'superpowers', '5.0.7', 'skills');

      // Find the actual plugin version path
      const fs = (await import('node:fs')).default;
      let actualPluginSkillsPath = pluginSkillsSource;
      const pluginCacheBase = path.join(getClaudePluginsPath(homeDir), 'cache', 'claude-plugins-official', 'superpowers');
      if (fs.existsSync(pluginCacheBase)) {
        const versions = fs.readdirSync(pluginCacheBase).sort().reverse();
        if (versions.length > 0) {
          actualPluginSkillsPath = path.join(pluginCacheBase, versions[0], 'skills');
        }
      }

      if (fs.existsSync(actualPluginSkillsPath)) {
        // Link each skill individually to ~/.claude/skills/<skill-name>
        // Skill tool expects skills at ~/.claude/skills/<skill-name>/SKILL.md
        const skillNames = fs.readdirSync(actualPluginSkillsPath).filter((name) => {
          const skillPath = path.join(actualPluginSkillsPath, name);
          return fs.statSync(skillPath).isDirectory() && fs.existsSync(path.join(skillPath, 'SKILL.md'));
        });

        let linked = 0;
        let reused = 0;
        for (const skillName of skillNames) {
          const skillSourcePath = path.join(actualPluginSkillsPath, skillName);
          const skillTargetPath = path.join(claudeSkillsRoot, skillName);
          const linkStatus = ensureManagedLink(skillTargetPath, skillSourcePath, { force });
          if (linkStatus === 'reused') {
            reused += 1;
          } else {
            linked += 1;
            io.log(`[link] Claude Code skill: ${skillName}`);
          }
        }
        io.log(`[ok] Claude Code skills: ${linked} linked, ${reused} reused`);
      } else {
        io.log(`[warn] Plugin skills source not found: ${actualPluginSkillsPath}`);
        io.log(`       Run /reload-plugins in Claude Code to refresh plugin cache`);
      }
    } else {
      io.log(`[action] Claude Code plugin not installed. Run in Claude Code: /plugin install ${CLAUDE_PLUGIN_NAME}`);
      io.log(`[note] After installation, run /reload-plugins to activate skills`);
    }
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

  // Claude Code plugin check
  const claudeSkillsRoot = path.join(homeDir, '.claude', 'skills');
  const claudeSuperpowersLink = path.join(claudeSkillsRoot, 'superpowers');

  const claudePluginInstalled = await isClaudePluginInstalled(homeDir);
  if (claudePluginInstalled) {
    ok(`Claude Code plugin installed: ${CLAUDE_PLUGIN_NAME}`);

    // Find the actual plugin version path
    const pluginCacheBase = path.join(getClaudePluginsPath(homeDir), 'cache', 'claude-plugins-official', 'superpowers');
    let actualPluginSkillsPath = '';
    if (fs.existsSync(pluginCacheBase)) {
      const versions = fs.readdirSync(pluginCacheBase).sort().reverse();
      if (versions.length > 0) {
        actualPluginSkillsPath = path.join(pluginCacheBase, versions[0], 'skills');
      }
    }

    if (actualPluginSkillsPath && fs.existsSync(actualPluginSkillsPath)) {
      // Check each skill link
      const skillNames = fs.readdirSync(actualPluginSkillsPath).filter((name) => {
        const skillPath = path.join(actualPluginSkillsPath, name);
        return fs.statSync(skillPath).isDirectory() && fs.existsSync(path.join(skillPath, 'SKILL.md'));
      });

      let okSkills = 0;
      let missingSkills = 0;
      for (const skillName of skillNames) {
        const skillTargetPath = path.join(claudeSkillsRoot, skillName);
        const skillSourcePath = path.join(actualPluginSkillsPath, skillName);
        if (isManagedLink(skillTargetPath, skillSourcePath)) {
          okSkills += 1;
        } else if (fs.existsSync(skillTargetPath)) {
          warn(`Claude Code skill ${skillName} exists but not linked correctly`);
          missingSkills += 1;
        } else {
          warn(`Claude Code skill ${skillName} not linked`);
          missingSkills += 1;
        }
      }
      if (missingSkills === 0) {
        ok(`Claude Code skills: ${okSkills}/${skillNames.length} linked correctly`);
      } else {
        io.log(`       Run: node scripts/aios.mjs setup --components superpowers --force`);
      }
    } else {
      warn(`Plugin skills cache not found: ${pluginCacheBase}`);
      io.log('       Run /reload-plugins in Claude Code to refresh plugin cache');
    }
  } else {
    warn(`Claude Code plugin not installed: ${CLAUDE_PLUGIN_NAME}`);
    io.log('       Run in Claude Code: /plugin install superpowers@claude-plugins-official');
    io.log('       Then run: /reload-plugins');
  }

  if (errors > 0) {
    io.log(`Result: FAILED (${errors} errors, ${warnings} warnings)`);
  } else {
    io.log(`Result: OK (${warnings} warnings)`);
  }

  return { warnings, effectiveWarnings: warnings, errors };
}
