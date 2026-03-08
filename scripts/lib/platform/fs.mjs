import fs from 'node:fs';
import path from 'node:path';

function normalizeForCompare(inputPath) {
  let output = path.resolve(inputPath);
  try {
    output = fs.realpathSync(output);
  } catch {
    // keep resolved absolute path
  }

  return process.platform === 'win32' ? output.toLowerCase() : output;
}

export function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function ensureFile(filePath) {
  ensureParentDir(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}

export function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

export function writeText(filePath, content) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
}

export function stripManagedBlock(content, beginMark, endMark) {
  const lines = content.split(/\r?\n/);
  const output = [];
  let skip = false;

  for (const line of lines) {
    if (line === beginMark) {
      skip = true;
      continue;
    }
    if (line === endMark) {
      skip = false;
      continue;
    }
    if (!skip) {
      output.push(line);
    }
  }

  return output.join('\n').replace(/\n+$/g, '\n');
}

export function stripMatchingLines(content, patterns) {
  return content
    .split(/\r?\n/)
    .filter((line) => patterns.every((pattern) => !pattern.test(line)))
    .join('\n')
    .replace(/\n+$/g, '\n');
}

export function isManagedLink(targetPath, sourcePath) {
  try {
    const stat = fs.lstatSync(targetPath);
    if (!stat.isSymbolicLink()) {
      return false;
    }
    const targetReal = normalizeForCompare(fs.realpathSync(targetPath));
    const sourceReal = normalizeForCompare(fs.realpathSync(sourcePath));
    return targetReal === sourceReal;
  } catch {
    return false;
  }
}

export function ensureManagedLink(targetPath, sourcePath, { force = false } = {}) {
  if (fs.existsSync(targetPath)) {
    if (isManagedLink(targetPath, sourcePath)) {
      return 'reused';
    }

    if (!force) {
      return 'skipped';
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
    ensureParentDir(targetPath);
    fs.symlinkSync(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir');
    return 'replaced';
  }

  ensureParentDir(targetPath);
  fs.symlinkSync(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir');
  return 'installed';
}

export function removeManagedLink(targetPath, sourcePath) {
  if (!isManagedLink(targetPath, sourcePath)) {
    return false;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

export function collectSkillEntries(sourceRoots) {
  const entries = [];
  const seen = new Set();

  for (const root of sourceRoots) {
    if (!root || !fs.existsSync(root)) {
      continue;
    }

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      const skillDir = path.join(root, entry.name);
      if (!fs.existsSync(path.join(skillDir, 'SKILL.md'))) continue;
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      entries.push({
        name: entry.name,
        sourcePath: fs.realpathSync(skillDir),
      });
    }
  }

  return entries;
}
