import path from 'node:path';

import fs from 'node:fs';

import { collectSkillEntries, collectUnexpectedSkillRootFindings, ensureManagedLink, isManagedLink, removeManagedLink } from '../platform/fs.mjs';
import { getClientHomes } from '../platform/paths.mjs';

const ALL_CLIENTS = ['codex', 'claude', 'gemini', 'opencode'];

function enabledClients(client) {
  return client === 'all' ? ALL_CLIENTS : [client];
}

export function getClientSourceRoots(rootDir, client) {
  switch (client) {
    case 'codex':
      return [path.join(rootDir, '.codex', 'skills')];
    case 'claude':
      return [path.join(rootDir, '.claude', 'skills')];
    case 'gemini':
      return [
        path.join(rootDir, '.gemini', 'skills'),
        path.join(rootDir, '.agents', 'skills'),
        path.join(rootDir, '.codex', 'skills'),
        path.join(rootDir, '.claude', 'skills'),
      ];
    case 'opencode':
      return [
        path.join(rootDir, '.opencode', 'skills'),
        path.join(rootDir, '.agents', 'skills'),
        path.join(rootDir, '.codex', 'skills'),
        path.join(rootDir, '.claude', 'skills'),
      ];
    default:
      return [];
  }
}

function resolveHomeMap(homeMap = {}, env = process.env) {
  return { ...getClientHomes(env), ...homeMap };
}

export async function installContextDbSkills({
  rootDir,
  client = 'all',
  force = false,
  homeMap = {},
  io = console,
} = {}) {
  const homes = resolveHomeMap(homeMap);

  for (const clientName of enabledClients(client)) {
    const targetRoot = path.join(homes[clientName], 'skills');
    const entries = collectSkillEntries(getClientSourceRoots(rootDir, clientName));
    if (entries.length === 0) {
      io.log(`[warn] ${clientName} no skill sources found.`);
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
        io.log(`[ok] ${clientName} skill already linked: ${entry.name}`);
        reused += 1;
      } else if (status === 'skipped') {
        io.log(`[skip] ${clientName} skill exists (use --force to replace): ${entry.name}`);
        skipped += 1;
      } else {
        io.log(`[link] ${clientName} skill installed: ${entry.name}`);
        if (status === 'replaced') replaced += 1;
        if (status === 'installed') installed += 1;
      }
    }

    io.log(`[done] ${clientName} skills -> installed=${installed} reused=${reused} replaced=${replaced} skipped=${skipped}`);
  }
}

export async function uninstallContextDbSkills({
  rootDir,
  client = 'all',
  homeMap = {},
  io = console,
} = {}) {
  const homes = resolveHomeMap(homeMap);

  for (const clientName of enabledClients(client)) {
    const targetRoot = path.join(homes[clientName], 'skills');
    const entries = collectSkillEntries(getClientSourceRoots(rootDir, clientName));
    if (entries.length === 0) {
      io.log(`[warn] ${clientName} no skill sources found.`);
      continue;
    }

    let removed = 0;
    let skipped = 0;

    for (const entry of entries) {
      const targetPath = path.join(targetRoot, entry.name);
      if (removeManagedLink(targetPath, entry.sourcePath)) {
        io.log(`[remove] ${clientName} skill link removed: ${entry.name}`);
        removed += 1;
      } else {
        io.log(`[skip] ${clientName} skill not managed by this repo: ${entry.name}`);
        skipped += 1;
      }
    }

    io.log(`[done] ${clientName} skills -> removed=${removed} skipped=${skipped}`);
  }
}

export async function doctorContextDbSkills({
  rootDir,
  client = 'all',
  homeMap = {},
  io = console,
} = {}) {
  const homes = resolveHomeMap(homeMap);
  let warnings = 0;

  io.log('ContextDB Skills Doctor');
  io.log('-----------------------');

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
    const targetRoot = path.join(homes[clientName], 'skills');
    const entries = collectSkillEntries(getClientSourceRoots(rootDir, clientName));
    io.log(`${clientName} target root: ${targetRoot}`);
    if (entries.length === 0) {
      io.log(`[warn] ${clientName} no skill sources found.`);
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
