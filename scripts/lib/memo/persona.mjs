import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureParentDir, readTextIfExists, writeText } from '../platform/fs.mjs';
import { assertWorkspaceMemoryContentSafe, scanWorkspaceMemoryContent } from './safety.mjs';

const LAYER_NAMES = {
  persona: 'persona',
  user: 'user profile',
};

const LAYER_DEFAULT_FILENAMES = {
  persona: 'SOUL.md',
  user: 'USER.md',
};

const LAYER_DEFAULT_MAX_CHARS = {
  persona: 2400,
  user: 2400,
};

const LAYER_ENV_MAX_CHARS = {
  persona: 'AIOS_PERSONA_MAX_CHARS',
  user: 'AIOS_USER_PROFILE_MAX_CHARS',
};

const LAYER_ENV_PATHS = {
  persona: 'AIOS_PERSONA_PATH',
  user: 'AIOS_USER_PROFILE_PATH',
};

const PERSONA_TEMPLATE = [
  '# AIOS Persona Baseline',
  '',
  '- Identity: pragmatic AI engineering partner',
  '- Primary objective: deliver safe, verifiable, high-leverage outcomes',
  '- Response style: concise, direct, evidence-first',
  '',
  '## Constraints',
  '- Do not hide risk; surface blockers and assumptions explicitly.',
  '- Preserve user intent and repository conventions.',
  '- Prefer reproducible commands and checkpoints over speculation.',
  '',
].join('\n');

const USER_PROFILE_TEMPLATE = [
  '# AIOS User Profile Memory',
  '',
  '- Preferred language: zh-CN + technical English terms',
  '- Delivery preference: executable implementation first, then concise review',
  '- Collaboration style: direct, pragmatic, no fluff',
  '',
  '## Stable Preferences',
  '- Keep changes auditable and test-backed when possible.',
  '- Prioritize workflows that improve long-running harness reliability.',
  '',
].join('\n');

function parseBoundedInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function normalizeLayer(layer = '') {
  const value = String(layer || '').trim().toLowerCase();
  if (value === 'persona' || value === 'user') {
    return value;
  }
  throw new Error(`Unsupported persona layer: ${layer}`);
}

function expandHome(rawPath, env = process.env) {
  const input = String(rawPath || '').trim();
  if (!input) return '';
  if (!input.startsWith('~')) {
    return path.resolve(input);
  }
  const home = String(env.HOME || os.homedir() || '').trim();
  if (!home) {
    return path.resolve(input.replace(/^~/, ''));
  }
  return path.resolve(path.join(home, input.slice(1)));
}

function resolveIdentityHome(env = process.env) {
  const explicit = String(env.AIOS_IDENTITY_HOME || '').trim();
  if (explicit) {
    return expandHome(explicit, env);
  }
  return path.resolve(path.join(os.homedir(), '.aios'));
}

function resolveLayerPath(layer, env = process.env) {
  const normalizedLayer = normalizeLayer(layer);
  const explicit = String(env[LAYER_ENV_PATHS[normalizedLayer]] || '').trim();
  if (explicit) {
    return expandHome(explicit, env);
  }
  return path.join(resolveIdentityHome(env), LAYER_DEFAULT_FILENAMES[normalizedLayer]);
}

function resolveLayerTemplate(layer) {
  const normalizedLayer = normalizeLayer(layer);
  return normalizedLayer === 'persona' ? PERSONA_TEMPLATE : USER_PROFILE_TEMPLATE;
}

function resolveLayerMaxChars(layer, env = process.env) {
  const normalizedLayer = normalizeLayer(layer);
  return parseBoundedInteger(
    env[LAYER_ENV_MAX_CHARS[normalizedLayer]],
    LAYER_DEFAULT_MAX_CHARS[normalizedLayer],
    { min: 256, max: 20000 }
  );
}

function displayLayerName(layer) {
  const normalizedLayer = normalizeLayer(layer);
  return LAYER_NAMES[normalizedLayer] || normalizedLayer;
}

function resolveLayerTargetLabel(layer) {
  return `${displayLayerName(layer)} memory`;
}

export function resolvePersonaPath(env = process.env) {
  return resolveLayerPath('persona', env);
}

export function resolveUserProfilePath(env = process.env) {
  return resolveLayerPath('user', env);
}

export function readPersonaLayer(layer = 'persona', { env = process.env } = {}) {
  const normalizedLayer = normalizeLayer(layer);
  const filePath = resolveLayerPath(normalizedLayer, env);
  const content = readTextIfExists(filePath);
  return {
    layer: normalizedLayer,
    path: filePath,
    content,
    exists: fs.existsSync(filePath),
  };
}

export function ensurePersonaLayer(layer = 'persona', { env = process.env } = {}) {
  const normalizedLayer = normalizeLayer(layer);
  const filePath = resolveLayerPath(normalizedLayer, env);
  if (fs.existsSync(filePath)) {
    return { layer: normalizedLayer, path: filePath, created: false };
  }
  ensureParentDir(filePath);
  writeText(filePath, `${resolveLayerTemplate(normalizedLayer)}\n`);
  return { layer: normalizedLayer, path: filePath, created: true };
}

export function writePersonaLayer(
  layer = 'persona',
  text = '',
  {
    mode = 'set',
    env = process.env,
  } = {}
) {
  const normalizedLayer = normalizeLayer(layer);
  const action = String(mode || 'set').trim().toLowerCase();
  if (action !== 'set' && action !== 'add') {
    throw new Error(`Unsupported persona write mode: ${mode}`);
  }

  const input = String(text ?? '').trim();
  if (!input) {
    const error = new Error(`${displayLayerName(normalizedLayer)} write requires non-empty text`);
    error.code = 'AIOS_MEMO_USAGE';
    throw error;
  }

  assertWorkspaceMemoryContentSafe(input, {
    allowEmpty: false,
    target: resolveLayerTargetLabel(normalizedLayer),
  });

  const filePath = resolveLayerPath(normalizedLayer, env);
  const existing = readTextIfExists(filePath).trimEnd();
  const next = action === 'set'
    ? input
    : (existing ? `${existing}\n\n${input}` : input);

  const maxChars = resolveLayerMaxChars(normalizedLayer, env);
  if (next.length > maxChars) {
    const error = new Error(
      `${displayLayerName(normalizedLayer)} exceeds capacity (${next.length}/${maxChars} chars)`
    );
    error.code = 'AIOS_MEMO_LAYER_LIMIT';
    throw error;
  }

  writeText(filePath, `${next.trimEnd()}\n`);
  return {
    layer: normalizedLayer,
    path: filePath,
    length: next.length,
    maxChars,
    mode: action,
  };
}

function clipWithSuffix(input = '', maxChars = 2000, suffix = '[truncated]') {
  const text = String(input || '');
  if (text.length <= maxChars) return text;
  const marker = `\n${suffix}\n`;
  const budget = Math.max(0, maxChars - marker.length);
  return `${text.slice(0, budget).trimEnd()}${marker}`;
}

function toDisplayPath(filePath, workspaceRoot = '') {
  const absolute = path.resolve(filePath || '');
  const root = String(workspaceRoot || '').trim();
  if (!root) return absolute;
  const normalizedRoot = path.resolve(root);
  if (!absolute.startsWith(normalizedRoot)) return absolute;
  const relative = path.relative(normalizedRoot, absolute).replace(/\\/g, '/');
  return relative || absolute;
}

function formatSafetyNotice(layer, safety) {
  const label = displayLayerName(layer);
  return [
    `## ${label === 'persona' ? 'Core Persona' : 'User Profile Memory'}`,
    '',
    '### Safety',
    `- Skipped unsafe ${label} content: ${safety.reason} (${safety.id})`,
    '',
  ].join('\n');
}

function buildLayerTitle(layer) {
  const normalizedLayer = normalizeLayer(layer);
  return normalizedLayer === 'persona' ? 'Core Persona' : 'User Profile Memory';
}

export function buildPersonaOverlay(layer = 'persona', {
  workspaceRoot = '',
  env = process.env,
} = {}) {
  const normalizedLayer = normalizeLayer(layer);
  const state = readPersonaLayer(normalizedLayer, { env });
  const rawText = String(state.content || '').trim();
  if (!rawText) return '';

  const safety = scanWorkspaceMemoryContent(rawText, { allowEmpty: true });
  if (!safety.ok) {
    return formatSafetyNotice(normalizedLayer, safety);
  }

  const maxChars = resolveLayerMaxChars(normalizedLayer, env);
  const clipped = clipWithSuffix(
    rawText,
    maxChars,
    `[${displayLayerName(normalizedLayer)} truncated]`
  );
  const displayPath = toDisplayPath(state.path, workspaceRoot);

  return [
    `## ${buildLayerTitle(normalizedLayer)}`,
    `Source: ${displayPath}`,
    '',
    clipped,
    '',
  ].join('\n');
}

export function getPersonaLayerDisplayName(layer = 'persona') {
  return displayLayerName(layer);
}
