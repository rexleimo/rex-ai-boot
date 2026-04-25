#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AIOS_NATIVE_JSON_KEY = 'aiosNative';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonIfChanged(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current === next) {
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

const claudeSettingsSource = path.join(rootDir, 'client-sources', 'native-base', 'claude', 'project', 'settings.local.json');
const claudeSettingsTarget = path.join(rootDir, '.claude', 'settings.local.json');

if (fs.existsSync(claudeSettingsSource)) {
  const current = readJson(claudeSettingsTarget, {});
  const source = readJson(claudeSettingsSource, {});
  const next = {
    ...current,
    [AIOS_NATIVE_JSON_KEY]: source,
  };
  const changed = writeJsonIfChanged(claudeSettingsTarget, next);
  console.log(`${changed ? '[write]' : '[ok]'} .claude/settings.local.json#${AIOS_NATIVE_JSON_KEY}`);
}
