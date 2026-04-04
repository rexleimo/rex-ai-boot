import fs from 'node:fs/promises';
import path from 'node:path';

import { checkGeneratedSkillsSync } from '../skills/sync.mjs';
import { readNativeSyncMetadata } from './install-metadata.mjs';
import { renderClaudeNativeOutputs } from './emitters/claude.mjs';
import { renderCodexNativeOutputs } from './emitters/codex.mjs';
import { renderGeminiNativeOutputs } from './emitters/gemini.mjs';
import { renderOpencodeNativeOutputs } from './emitters/opencode.mjs';
import {
  AIOS_NATIVE_JSON_KEY,
  hasManagedMarkdownBlock,
  parseJsonObject,
  wrapManagedMarkdown,
} from './emitters/shared.mjs';
import { buildNativeOutputPlan, loadNativeSyncManifest, resolveNativeClients } from './source-tree.mjs';

const EMITTERS = {
  codex: renderCodexNativeOutputs,
  claude: renderClaudeNativeOutputs,
  gemini: renderGeminiNativeOutputs,
  opencode: renderOpencodeNativeOutputs,
};

async function readOptional(targetPath) {
  try {
    return await fs.readFile(targetPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildIssue({ client, status = 'warn', message, fix }) {
  return {
    client,
    status,
    message: String(message || '').trim(),
    fix: String(fix || '').trim(),
  };
}

function buildFixCommand(client) {
  return `node scripts/aios.mjs update --components native --client ${client}`;
}

async function inspectOperation({ rootDir, client, operation, fixCommand, issues }) {
  const targetPath = path.join(rootDir, operation.targetPath);
  const current = await readOptional(targetPath);

  if (operation.kind === 'markdown-block') {
    if (!current) {
      issues.push(buildIssue({ client, message: `[missing] ${operation.targetPath}`, fix: fixCommand }));
      return;
    }
    try {
      if (!hasManagedMarkdownBlock(current)) {
        issues.push(buildIssue({ client, message: `[unmanaged conflict] ${operation.targetPath}`, fix: fixCommand }));
        return;
      }
    } catch {
      issues.push(buildIssue({ client, status: 'error', message: `[malformed] ${operation.targetPath}`, fix: fixCommand }));
      return;
    }
    const expectedBlock = wrapManagedMarkdown(operation.content);
    if (!current.includes(expectedBlock)) {
      issues.push(buildIssue({ client, message: `[drift] ${operation.targetPath}`, fix: fixCommand }));
    }
    return;
  }

  if (operation.kind === 'managed-file') {
    if (!current) {
      issues.push(buildIssue({ client, message: `[missing] ${operation.targetPath}`, fix: fixCommand }));
      return;
    }
    try {
      if (!hasManagedMarkdownBlock(current)) {
        issues.push(buildIssue({ client, message: `[unmanaged conflict] ${operation.targetPath}`, fix: fixCommand }));
        return;
      }
    } catch {
      issues.push(buildIssue({ client, status: 'error', message: `[malformed] ${operation.targetPath}`, fix: fixCommand }));
      return;
    }
    if (current !== wrapManagedMarkdown(operation.content)) {
      issues.push(buildIssue({ client, message: `[drift] ${operation.targetPath}`, fix: fixCommand }));
    }
    return;
  }

  if (!current) {
    issues.push(buildIssue({ client, message: `[missing] ${operation.targetPath}`, fix: fixCommand }));
    return;
  }

  let parsed;
  try {
    parsed = parseJsonObject(current, targetPath);
  } catch {
    issues.push(buildIssue({ client, status: 'error', message: `[invalid json] ${operation.targetPath}`, fix: fixCommand }));
    return;
  }
  if (!(AIOS_NATIVE_JSON_KEY in parsed)) {
    issues.push(buildIssue({ client, message: `[missing] ${operation.targetPath}#${AIOS_NATIVE_JSON_KEY}`, fix: fixCommand }));
    return;
  }
  if (JSON.stringify(parsed[AIOS_NATIVE_JSON_KEY]) !== JSON.stringify(operation.content)) {
    issues.push(buildIssue({ client, message: `[drift] ${operation.targetPath}#${AIOS_NATIVE_JSON_KEY}`, fix: fixCommand }));
  }
}

async function inspectClient({ rootDir, manifest, client }) {
  const plan = buildNativeOutputPlan({ rootDir, manifest, client });
  const rendered = EMITTERS[client]({ rootDir, manifest });
  const fixCommand = buildFixCommand(client);
  const issues = [];
  const metadata = readNativeSyncMetadata(plan.metadataRoot);
  let hasManagedFootprint = false;

  for (const operation of rendered.operations) {
    const targetPath = path.join(rootDir, operation.targetPath);
    const current = await readOptional(targetPath);
    if (!current) {
      continue;
    }
    if (operation.kind === 'json-merge') {
      try {
        const parsed = parseJsonObject(current, targetPath);
        if (AIOS_NATIVE_JSON_KEY in parsed) {
          hasManagedFootprint = true;
        }
      } catch {
        hasManagedFootprint = true;
      }
      continue;
    }
    try {
      if (hasManagedMarkdownBlock(current)) {
        hasManagedFootprint = true;
      }
    } catch {
      hasManagedFootprint = true;
    }
  }

  for (const relativePath of plan.outputs) {
    if (relativePath === 'AGENTS.md' || relativePath === 'CLAUDE.md' || relativePath.endsWith('settings.local.json') || relativePath.endsWith('AIOS.md')) {
      continue;
    }
    if (await pathExists(path.join(rootDir, relativePath))) {
      hasManagedFootprint = true;
    }
  }

  if (!metadata) {
    if (!hasManagedFootprint) {
      return {
        client,
        tier: plan.tier,
        issues,
      };
    }
    issues.push(buildIssue({ client, message: `[missing] ${plan.metadataPath}`, fix: fixCommand }));
  } else {
    if (metadata.client !== client) {
      issues.push(buildIssue({ client, message: `[drift] ${plan.metadataPath} client=${metadata.client}`, fix: fixCommand }));
    }
    if (metadata.tier !== plan.tier) {
      issues.push(buildIssue({ client, message: `[drift] ${plan.metadataPath} tier=${metadata.tier}`, fix: fixCommand }));
    }
    if (JSON.stringify(metadata.managedTargets || []) !== JSON.stringify(rendered.managedTargets)) {
      issues.push(buildIssue({ client, message: `[drift] ${plan.metadataPath} managedTargets`, fix: fixCommand }));
    }
  }

  for (const operation of rendered.operations) {
    await inspectOperation({ rootDir, client, operation, fixCommand, issues });
  }

  const skillsResult = await checkGeneratedSkillsSync({
    rootDir,
    surfaces: [client],
    io: { log() {} },
  });
  if (!skillsResult.ok) {
    for (const issue of skillsResult.issues) {
      issues.push(buildIssue({ client, message: issue, fix: fixCommand }));
    }
  }

  if (client === 'codex' || client === 'claude') {
    const agentRoot = path.join(rootDir, `.${client}`, 'agents');
    if (!(await pathExists(agentRoot))) {
      issues.push(buildIssue({ client, message: `[missing] .${client}/agents`, fix: fixCommand }));
    }
  }

  return {
    client,
    tier: plan.tier,
    issues,
  };
}

export async function checkNativeEnhancementsSync({ rootDir, client = 'all' } = {}) {
  const manifest = loadNativeSyncManifest(rootDir);
  const clients = resolveNativeClients(client);
  const reports = [];
  const issues = [];

  for (const currentClient of clients) {
    const report = await inspectClient({ rootDir, manifest, client: currentClient });
    reports.push(report);
    for (const issue of report.issues) {
      issues.push(`[${issue.client}] ${issue.message}`);
    }
  }

  return {
    ok: issues.length === 0,
    reports,
    issues,
  };
}

export async function doctorNativeEnhancements({ rootDir, client = 'all', io = console } = {}) {
  const result = await checkNativeEnhancementsSync({ rootDir, client });
  let effectiveWarnings = 0;
  let errors = 0;

  io.log('Native Enhancements Doctor');
  io.log('--------------------------');

  for (const report of result.reports) {
    if (report.issues.length === 0) {
      io.log(`[ok] native ${report.client} tier=${report.tier}`);
      continue;
    }

    for (const issue of report.issues) {
      if (issue.status === 'error') {
        errors += 1;
      } else {
        effectiveWarnings += 1;
      }
      io.log(`[${issue.status}] native ${issue.client}: ${issue.message}`);
      if (issue.fix) {
        io.log(`  fix: ${issue.fix}`);
      }
    }
  }

  return {
    ok: errors === 0 && effectiveWarnings === 0,
    effectiveWarnings,
    errors,
    issues: result.issues,
  };
}
