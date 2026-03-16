import path from 'node:path';

import fs from 'node:fs';

import { collectUnexpectedSkillRootFindings, ensureManagedLink, isManagedLink, removeManagedLink } from '../platform/fs.mjs';
import { getClientHomes } from '../platform/paths.mjs';

const ALL_CLIENTS = ['codex', 'claude', 'gemini', 'opencode'];
const ALL_SCOPES = ['global', 'project'];

function enabledClients(client) {
  return client === 'all' ? ALL_CLIENTS : [client];
}

function normalizeScope(scope = 'global') {
  const value = String(scope || 'global').trim().toLowerCase();
  if (!ALL_SCOPES.includes(value)) {
    throw new Error(`Unsupported skills scope: ${value}`);
  }
  return value;
}

function normalizeSelectedSkills(selectedSkills = []) {
  if (Array.isArray(selectedSkills)) {
    return [...new Set(selectedSkills.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  return [...new Set(String(selectedSkills || '').split(',').map((item) => item.trim()).filter(Boolean))];
}

function resolveHomeMap(homeMap = {}, env = process.env) {
  return { ...getClientHomes(env), ...homeMap };
}

function resolveCatalogPath(rootDir) {
  return path.join(rootDir, 'config', 'skills-catalog.json');
}

export function loadSkillsCatalog(rootDir) {
  const catalogPath = resolveCatalogPath(rootDir);
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Skills catalog not found: ${catalogPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
  return skills.map((entry) => ({
    ...entry,
    clients: Array.isArray(entry.clients) ? entry.clients.map((client) => String(client || '').trim().toLowerCase()).filter(Boolean) : [],
    scopes: Array.isArray(entry.scopes) ? entry.scopes.map((scope) => String(scope || '').trim().toLowerCase()).filter(Boolean) : [],
    source: String(entry.source || '').trim(),
    name: String(entry.name || '').trim(),
    description: String(entry.description || '').trim(),
    defaultInstall: typeof entry.defaultInstall === 'object' && entry.defaultInstall
      ? entry.defaultInstall
      : { global: false, project: false },
    tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
  })).filter((entry) => entry.name && entry.source);
}

function resolveCatalogSourcePath(rootDir, source) {
  return fs.realpathSync(path.resolve(rootDir, source));
}

function resolveProjectSkillRoot(rootDir, client) {
  switch (client) {
    case 'codex':
      return path.join(rootDir, '.codex', 'skills');
    case 'claude':
      return path.join(rootDir, '.claude', 'skills');
    case 'gemini':
      return path.join(rootDir, '.gemini', 'skills');
    case 'opencode':
      return path.join(rootDir, '.opencode', 'skills');
    default:
      return '';
  }
}

function resolveTargetRoot({ rootDir, projectRoot, clientName, scope, homes }) {
  if (scope === 'project') {
    return resolveProjectSkillRoot(projectRoot || rootDir, clientName);
  }
  return path.join(homes[clientName], 'skills');
}

function resolveCatalogEntries({ rootDir, catalog, clientName, scope, selectedSkills }) {
  const selected = new Set(normalizeSelectedSkills(selectedSkills));
  return catalog
    .filter((entry) => entry.clients.includes(clientName))
    .filter((entry) => entry.scopes.includes(scope))
    .filter((entry) => selected.size === 0 || selected.has(entry.name))
    .map((entry) => ({
      ...entry,
      sourcePath: resolveCatalogSourcePath(rootDir, entry.source),
    }));
}

export async function installContextDbSkills({
  rootDir,
  projectRoot = rootDir,
  client = 'all',
  scope = 'global',
  selectedSkills = [],
  force = false,
  homeMap = {},
  io = console,
} = {}) {
  const homes = resolveHomeMap(homeMap);
  const normalizedScope = normalizeScope(scope);
  const catalog = loadSkillsCatalog(rootDir);

  for (const clientName of enabledClients(client)) {
    const targetRoot = resolveTargetRoot({ rootDir, projectRoot, clientName, scope: normalizedScope, homes });
    const entries = resolveCatalogEntries({ rootDir, catalog, clientName, scope: normalizedScope, selectedSkills });
    if (entries.length === 0) {
      io.log(`[warn] ${clientName} no catalog skills matched scope=${normalizedScope}.`);
      continue;
    }

    let installed = 0;
    let reused = 0;
    let replaced = 0;
    let skipped = 0;

    for (const entry of entries) {
      const targetPath = path.join(targetRoot, entry.name);
      const status = ensureManagedLink(targetPath, entry.sourcePath, { force });
      if (status === 'reused') {
        io.log(`[ok] ${clientName} skill already linked (${normalizedScope}): ${entry.name}`);
        reused += 1;
      } else if (status === 'skipped') {
        io.log(`[skip] ${clientName} skill exists (use --force to replace): ${entry.name}`);
        skipped += 1;
      } else {
        io.log(`[link] ${clientName} skill installed (${normalizedScope}): ${entry.name}`);
        if (status === 'replaced') replaced += 1;
        if (status === 'installed') installed += 1;
      }
    }

    io.log(`[done] ${clientName} skills scope=${normalizedScope} -> installed=${installed} reused=${reused} replaced=${replaced} skipped=${skipped}`);
  }
}

export async function uninstallContextDbSkills({
  rootDir,
  projectRoot = rootDir,
  client = 'all',
  scope = 'global',
  selectedSkills = [],
  homeMap = {},
  io = console,
} = {}) {
  const homes = resolveHomeMap(homeMap);
  const normalizedScope = normalizeScope(scope);
  const catalog = loadSkillsCatalog(rootDir);

  for (const clientName of enabledClients(client)) {
    const targetRoot = resolveTargetRoot({ rootDir, projectRoot, clientName, scope: normalizedScope, homes });
    const entries = resolveCatalogEntries({ rootDir, catalog, clientName, scope: normalizedScope, selectedSkills });
    if (entries.length === 0) {
      io.log(`[warn] ${clientName} no catalog skills matched scope=${normalizedScope}.`);
      continue;
    }

    let removed = 0;
    let skipped = 0;

    for (const entry of entries) {
      const targetPath = path.join(targetRoot, entry.name);
      if (removeManagedLink(targetPath, entry.sourcePath)) {
        io.log(`[remove] ${clientName} skill link removed (${normalizedScope}): ${entry.name}`);
        removed += 1;
      } else {
        io.log(`[skip] ${clientName} skill not managed by this repo: ${entry.name}`);
        skipped += 1;
      }
    }

    io.log(`[done] ${clientName} skills scope=${normalizedScope} -> removed=${removed} skipped=${skipped}`);
  }
}

export async function doctorContextDbSkills({
  rootDir,
  projectRoot = rootDir,
  client = 'all',
  scope = 'global',
  selectedSkills = [],
  homeMap = {},
  io = console,
} = {}) {
  const homes = resolveHomeMap(homeMap);
  const normalizedScope = normalizeScope(scope);
  const catalog = loadSkillsCatalog(rootDir);
  let warnings = 0;

  io.log('ContextDB Skills Doctor');
  io.log('-----------------------');
  io.log(`Scope: ${normalizedScope}`);

  const unexpectedRoots = collectUnexpectedSkillRootFindings(rootDir);
  for (const finding of unexpectedRoots) {
    io.log(`[warn] repo: non-discoverable skill root ${finding.root} contains SKILL.md files`);
    for (const file of finding.files) {
      io.log(`       move or convert: ${file}`);
    }
    io.log('       repo-local discoverable skills must live under .codex/skills or .claude/skills');
    warnings += 1;
  }

  for (const clientName of enabledClients(client)) {
    const targetRoot = resolveTargetRoot({ rootDir, projectRoot, clientName, scope: normalizedScope, homes });
    const entries = resolveCatalogEntries({ rootDir, catalog, clientName, scope: normalizedScope, selectedSkills });
    io.log(`${clientName} target root: ${targetRoot}`);
    if (entries.length === 0) {
      io.log(`[warn] ${clientName} no catalog skills matched scope=${normalizedScope}.`);
      warnings += 1;
      continue;
    }

    let okCount = 0;
    let warnCount = 0;
    for (const entry of entries) {
      const targetPath = path.join(targetRoot, entry.name);
      if (isManagedLink(targetPath, entry.sourcePath)) {
        io.log(`[ok] ${clientName}: ${entry.name} linked`);
        okCount += 1;
        continue;
      }
      if (fs.existsSync(targetPath)) {
        io.log(`[warn] ${clientName}: ${entry.name} exists but is not linked to this repo`);
        warnCount += 1;
        warnings += 1;
        continue;
      }
      io.log(`[warn] ${clientName}: ${entry.name} not installed`);
      warnCount += 1;
      warnings += 1;
    }
    io.log(`[summary] ${clientName} ok=${okCount} warn=${warnCount}`);
  }

  return { warnings, effectiveWarnings: warnings, errors: 0 };
}
