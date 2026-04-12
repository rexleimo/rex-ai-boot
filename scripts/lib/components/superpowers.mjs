import os from 'node:os';
import path from 'node:path';

import { ensureManagedLink, isManagedLink } from '../platform/fs.mjs';
import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';
import { getAgentsHome, getClientHomes } from '../platform/paths.mjs';

const DEFAULT_REPO_URL = 'https://github.com/obra/superpowers.git';
const CLAUDE_PLUGIN_NAME = 'superpowers@claude-plugins-official';
const EXTRA_CLAUDE_REQUIRED_SKILLS = Object.freeze([
  'aios-long-running-harness',
]);

function getClaudePluginsPath(claudeHome) {
  return path.join(claudeHome, 'plugins');
}

function getClaudeInstalledPluginsPath(claudeHome) {
  return path.join(getClaudePluginsPath(claudeHome), 'installed_plugins.json');
}

async function isClaudePluginInstalled(claudeHome) {
  const fs = (await import('node:fs')).default;
  const pluginsPath = getClaudeInstalledPluginsPath(claudeHome);
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

function listSkillNames(fs, skillsRoot) {
  if (!skillsRoot || !fs.existsSync(skillsRoot)) {
    return [];
  }
  return fs.readdirSync(skillsRoot).filter((entry) => {
    const skillPath = path.join(skillsRoot, entry);
    return fs.statSync(skillPath).isDirectory() && fs.existsSync(path.join(skillPath, 'SKILL.md'));
  }).sort((left, right) => left.localeCompare(right));
}

function resolveLatestClaudePluginSkillsPath(fs, claudeHome) {
  const pluginCacheBase = path.join(getClaudePluginsPath(claudeHome), 'cache', 'claude-plugins-official', 'superpowers');
  if (!fs.existsSync(pluginCacheBase)) {
    return { pluginCacheBase, pluginSkillsPath: '' };
  }

  const versions = fs.readdirSync(pluginCacheBase).sort().reverse();
  for (const version of versions) {
    const candidate = path.join(pluginCacheBase, version, 'skills');
    if (fs.existsSync(candidate)) {
      return { pluginCacheBase, pluginSkillsPath: candidate };
    }
  }

  return { pluginCacheBase, pluginSkillsPath: '' };
}

function resolveClaudeSkillSource({ fs, claudeHome, repoSkillsSource, pluginInstalled }) {
  const { pluginCacheBase, pluginSkillsPath } = resolveLatestClaudePluginSkillsPath(fs, claudeHome);
  if (pluginInstalled && pluginSkillsPath) {
    return {
      sourceKind: 'plugin',
      sourcePath: pluginSkillsPath,
      pluginCacheBase,
    };
  }

  return {
    sourceKind: 'repo',
    sourcePath: repoSkillsSource,
    pluginCacheBase,
  };
}

function skillNameToPermission(skillName) {
  return `Skill(${String(skillName || '').trim()})`;
}

function sortUniqueStrings(values = []) {
  const output = [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
  output.sort((left, right) => left.localeCompare(right));
  return output;
}

function buildRequiredClaudeSkillPermissions({ fs, skillsSource, extraSkills = [] } = {}) {
  const discoveredSkills = listSkillNames(fs, skillsSource);
  const allSkills = sortUniqueStrings([...discoveredSkills, ...extraSkills]);
  return sortUniqueStrings(allSkills.map((skillName) => skillNameToPermission(skillName)));
}

function resolveClaudeSettingsPaths({
  claudeHome,
  rootDir = '',
  includeGlobal = true,
  includeProject = true,
} = {}) {
  const output = [];
  if (includeGlobal) {
    output.push(path.resolve(path.join(claudeHome, 'settings.local.json')));
  }
  if (includeProject && rootDir) {
    output.push(path.resolve(path.join(rootDir, '.claude', 'settings.local.json')));
  }
  return [...new Set(output)];
}

function readJsonObject(fs, filePath) {
  if (!fs.existsSync(filePath)) {
    return { payload: {}, exists: false };
  }

  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) {
    return { payload: {}, exists: true };
  }

  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected top-level JSON object');
  }

  return { payload: parsed, exists: true };
}

function syncClaudeSkillPermissionsInFile({
  fs,
  settingsPath,
  requiredPermissions,
}) {
  const { payload, exists } = readJsonObject(fs, settingsPath);
  const nextPayload = { ...payload };
  const nextPermissions = (
    payload.permissions
    && typeof payload.permissions === 'object'
    && !Array.isArray(payload.permissions)
  ) ? { ...payload.permissions } : {};

  const allowRaw = Array.isArray(nextPermissions.allow) ? nextPermissions.allow : [];
  const existingAllow = sortUniqueStrings(allowRaw);
  const existingSet = new Set(existingAllow);
  const missing = requiredPermissions.filter((permission) => !existingSet.has(permission));

  if (missing.length === 0 && Array.isArray(nextPermissions.allow) && sortUniqueStrings(nextPermissions.allow).length === nextPermissions.allow.length) {
    return {
      status: 'reused',
      added: 0,
      total: existingAllow.length,
      path: settingsPath,
    };
  }

  nextPermissions.allow = [...existingAllow, ...missing];
  nextPayload.permissions = nextPermissions;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(nextPayload, null, 2)}\n`, 'utf8');

  return {
    status: exists ? 'updated' : 'installed',
    added: missing.length,
    total: nextPermissions.allow.length,
    path: settingsPath,
  };
}

export async function syncClaudeSkillPermissions({
  rootDir = '',
  env = process.env,
  io = console,
  includeGlobal = true,
  includeProject = true,
  extraSkills = EXTRA_CLAUDE_REQUIRED_SKILLS,
} = {}) {
  const homeDir = os.homedir();
  const homes = getClientHomes(env, homeDir);
  const codexHome = homes.codex;
  const claudeHome = homes.claude;
  const skillsSource = path.join(codexHome, 'superpowers', 'skills');
  const fs = (await import('node:fs')).default;

  if (!fs.existsSync(skillsSource)) {
    io.log(`[warn] superpowers skills source not found for permission sync: ${skillsSource}`);
    return {
      installed: 0,
      updated: 0,
      reused: 0,
      skipped: 0,
      errors: 1,
      paths: [],
      requiredPermissions: [],
    };
  }

  const requiredPermissions = buildRequiredClaudeSkillPermissions({
    fs,
    skillsSource,
    extraSkills,
  });
  const settingsPaths = resolveClaudeSettingsPaths({
    claudeHome,
    rootDir,
    includeGlobal,
    includeProject,
  });

  let installed = 0;
  let updated = 0;
  let reused = 0;
  let skipped = 0;
  let errors = 0;

  for (const settingsPath of settingsPaths) {
    try {
      const result = syncClaudeSkillPermissionsInFile({
        fs,
        settingsPath,
        requiredPermissions,
      });
      if (result.status === 'installed') installed += 1;
      else if (result.status === 'updated') updated += 1;
      else reused += 1;
      io.log(`[ok] Claude skill permissions synced: ${settingsPath} (+${result.added}, total=${result.total})`);
    } catch (error) {
      errors += 1;
      io.log(`[warn] Claude skill permissions sync failed: ${settingsPath}`);
      io.log(`       ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (settingsPaths.length === 0) {
    skipped = 1;
    io.log('[info] Claude skill permissions sync skipped (no target settings paths resolved).');
  }

  io.log(`[done] Claude skill permissions sync: installed=${installed} updated=${updated} reused=${reused} skipped=${skipped} errors=${errors}`);
  return {
    installed,
    updated,
    reused,
    skipped,
    errors,
    paths: settingsPaths,
    requiredPermissions,
  };
}

function linkClaudeSkills({
  fs,
  sourcePath,
  claudeSkillsRoot,
  force = false,
  io = console,
} = {}) {
  const skillNames = listSkillNames(fs, sourcePath);
  let linked = 0;
  let reused = 0;
  let skipped = 0;

  for (const skillName of skillNames) {
    const skillSourcePath = path.join(sourcePath, skillName);
    const skillTargetPath = path.join(claudeSkillsRoot, skillName);
    const linkStatus = ensureManagedLink(skillTargetPath, skillSourcePath, { force });
    if (linkStatus === 'reused') {
      reused += 1;
      continue;
    }
    if (linkStatus === 'skipped') {
      skipped += 1;
      io.log(`[warn] Claude Code skill not linked (existing unmanaged path): ${skillTargetPath}`);
      continue;
    }
    linked += 1;
    io.log(`[link] Claude Code skill: ${skillName}`);
  }

  return {
    total: skillNames.length,
    linked,
    reused,
    skipped,
  };
}

export async function installSuperpowers({
  rootDir = '',
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
  const homes = getClientHomes(env, homeDir);
  const codexHome = homes.codex;
  const claudeHome = homes.claude;
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

  const fs = (await import('node:fs')).default;
  const pluginInstalled = installClaudePlugin ? await isClaudePluginInstalled(claudeHome) : false;
  const source = resolveClaudeSkillSource({
    fs,
    claudeHome,
    repoSkillsSource: skillsSource,
    pluginInstalled,
  });

  if (pluginInstalled) {
    io.log(`[ok] Claude Code plugin installed: ${CLAUDE_PLUGIN_NAME}`);
  } else if (installClaudePlugin) {
    io.log(`[note] Claude Code plugin not detected (${CLAUDE_PLUGIN_NAME}); using repo-linked superpowers skills`);
  }

  if (!fs.existsSync(source.sourcePath)) {
    io.log(`[warn] Claude Code skill source not found: ${source.sourcePath}`);
    if (source.sourceKind === 'plugin') {
      io.log(`       Run /reload-plugins in Claude Code to refresh plugin cache`);
      io.log(`       Plugin cache base: ${source.pluginCacheBase}`);
    }
  } else {
    const claudeSkillsRoot = path.join(claudeHome, 'skills');
    const linkResult = linkClaudeSkills({
      fs,
      sourcePath: source.sourcePath,
      claudeSkillsRoot,
      force,
      io,
    });
    io.log(`[ok] Claude Code skills (${source.sourceKind} source): ${linkResult.linked} linked, ${linkResult.reused} reused, ${linkResult.skipped} skipped`);
    if (linkResult.skipped > 0) {
      io.log('       Re-run with --force to replace unmanaged existing skill directories.');
    }
  }

  const permissionsResult = await syncClaudeSkillPermissions({
    rootDir,
    env,
    io,
    includeGlobal: true,
    includeProject: Boolean(rootDir),
  });
  if (permissionsResult.errors > 0) {
    io.log('[warn] Claude skill permission sync completed with warnings.');
  }

  io.log('[done] superpowers install complete');
}

export async function doctorSuperpowers({ env = process.env, io = console } = {}) {
  const homeDir = os.homedir();
  const homes = getClientHomes(env, homeDir);
  const codexHome = homes.codex;
  const claudeHome = homes.claude;
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
  io.log(`claude_home: ${claudeHome}`);
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

  const claudePluginInstalled = await isClaudePluginInstalled(claudeHome);
  if (claudePluginInstalled) {
    ok(`Claude Code plugin installed: ${CLAUDE_PLUGIN_NAME}`);
  } else {
    io.log(`INFO Claude Code plugin not installed: ${CLAUDE_PLUGIN_NAME} (optional)`);
  }

  const source = resolveClaudeSkillSource({
    fs,
    claudeHome,
    repoSkillsSource: skillsSource,
    pluginInstalled: claudePluginInstalled,
  });
  const expectedSkillNames = listSkillNames(fs, skillsSource);
  if (expectedSkillNames.length === 0) {
    warn(`no superpowers skills found in source: ${skillsSource}`);
  } else {
    const claudeSkillsRoot = path.join(claudeHome, 'skills');
    let availableSkills = 0;
    let managedLinks = 0;
    for (const skillName of expectedSkillNames) {
      const targetPath = path.join(claudeSkillsRoot, skillName);
      const targetSkillFile = path.join(targetPath, 'SKILL.md');
      if (!fs.existsSync(targetSkillFile)) {
        warn(`Claude Code skill missing: ${targetPath}`);
        continue;
      }
      availableSkills += 1;

      const repoSkillSource = path.join(skillsSource, skillName);
      const expectedSource = source.sourcePath ? path.join(source.sourcePath, skillName) : '';
      if ((expectedSource && isManagedLink(targetPath, expectedSource)) || isManagedLink(targetPath, repoSkillSource)) {
        managedLinks += 1;
      }
    }

    if (availableSkills === expectedSkillNames.length) {
      ok(`Claude Code skills available: ${availableSkills}/${expectedSkillNames.length}`);
    } else {
      io.log('       Run: node scripts/aios.mjs setup --components superpowers --force');
      if (source.sourceKind === 'plugin') {
        io.log('       If plugin cache is stale, run /reload-plugins in Claude Code.');
      }
    }

    if (managedLinks === expectedSkillNames.length) {
      ok(`Claude Code managed links healthy: ${managedLinks}/${expectedSkillNames.length}`);
    } else {
      warn(`Claude Code managed links drifted: ${managedLinks}/${expectedSkillNames.length}`);
      io.log('       Re-run with: node scripts/aios.mjs setup --components superpowers --force');
    }
  }

  if (errors > 0) {
    io.log(`Result: FAILED (${errors} errors, ${warnings} warnings)`);
  } else {
    io.log(`Result: OK (${warnings} warnings)`);
  }

  return { warnings, effectiveWarnings: warnings, errors };
}
