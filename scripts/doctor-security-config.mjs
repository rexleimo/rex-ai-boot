#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  process.stdout.write(`Usage:
  scripts/doctor-security-config.sh [--workspace <path>] [--global] [--strict]

Options:
  --workspace <path>   Scan this workspace root (default: git root or cwd)
  --global             Also scan small allowlisted global config files
  --strict             Exit non-zero when findings exist
  -h, --help           Show this help
`);
}

function parseArgs(argv) {
  const out = {
    workspace: '',
    scanGlobal: false,
    strict: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--workspace') {
      out.workspace = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--global') {
      out.scanGlobal = true;
      continue;
    }
    if (arg === '--strict') {
      out.strict = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      out.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return out;
}

function detectGitRoot(cwd) {
  try {
    const txt = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const v = txt.trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function listFilesIfPresent(workspace, relPaths) {
  const out = [];
  for (const rel of relPaths) {
    const abs = path.join(workspace, rel);
    if (isFile(abs)) out.push(abs);
  }
  return out;
}

function listAgentMdFiles(workspace, relDir) {
  const absDir = path.join(workspace, relDir);
  let entries = [];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith('.md')) continue;
    out.push(path.join(absDir, ent.name));
  }
  return out;
}

function listFilesUnder(workspace, relDir, predicate) {
  const absDir = path.join(workspace, relDir);
  const out = [];

  function walk(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (entry.isFile() && predicate(entry.name, absPath)) {
        out.push(absPath);
      }
    }
  }

  walk(absDir);
  return out;
}

function readTextSafe(filePath, maxBytes) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return null;
    if (st.size > maxBytes) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function redactFinding(id) {
  // Never emit actual matches.
  return `[redacted:${id}]`;
}

function relativeTo(workspace, filePath) {
  try {
    const rel = path.relative(workspace, filePath);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  } catch {
    // ignore
  }
  return filePath;
}

function findSecretPatterns(text) {
  const patterns = [
    { id: 'openai_key', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
    { id: 'aws_access_key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { id: 'github_token', re: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
    { id: 'google_api_key', re: /\bAIza[0-9A-Za-z-_]{30,}\b/g },
    { id: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
    { id: 'private_key', re: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/g },
    { id: 'bearer_token', re: /\bAuthorization:\s*Bearer\s+[A-Za-z0-9._-]{10,}\b/g },
  ];

  const hits = new Set();
  for (const { id, re } of patterns) {
    if (re.test(text)) hits.add(id);
    re.lastIndex = 0;
  }
  return [...hits];
}

function findRiskyHookPatterns(text) {
  const patterns = [
    { id: 'curl_pipe_shell', re: /\bcurl\b[\s\S]{0,200}\|\s*(bash|sh)\b/i },
    { id: 'wget_pipe_shell', re: /\bwget\b[\s\S]{0,200}\|\s*(bash|sh)\b/i },
    { id: 'powershell_iex', re: /\bInvoke-WebRequest\b[\s\S]{0,200}\|\s*iex\b/i },
  ];

  const hits = new Set();
  for (const { id, re } of patterns) {
    if (re.test(text)) hits.add(id);
  }
  return [...hits];
}

function scanJsonBroadAllowlists(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, paths: [], error: 'invalid_json' };
  }

  const paths = [];
  const stack = [{ value: parsed, p: [] }];
  while (stack.length > 0) {
    const { value, p } = stack.pop();
    if (Array.isArray(value)) {
      if (value.some((v) => v === '*')) {
        paths.push(p.join('.'));
      }
      for (let i = 0; i < value.length; i += 1) {
        stack.push({ value: value[i], p: [...p, String(i)] });
      }
      continue;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        stack.push({ value: v, p: [...p, k] });
      }
    }
  }

  // Only report if it looks like an allow/permission path.
  const filtered = paths.filter((p) => /\ballow|\ballowed|\bpermission|\bpermit/i.test(p));
  return { ok: true, paths: filtered, error: '' };
}

function pickGlobalConfigFiles(homeDir) {
  const candidates = [
    path.join(homeDir, '.codex', 'config.toml'),
    path.join(homeDir, '.claude', 'settings.json'),
    path.join(homeDir, '.claude', 'mcp.json'),
    path.join(homeDir, '.gemini', 'settings.json'),
  ];

  const xdg = process.env.XDG_CONFIG_HOME && path.isAbsolute(process.env.XDG_CONFIG_HOME)
    ? process.env.XDG_CONFIG_HOME
    : path.join(homeDir, '.config');
  candidates.push(path.join(xdg, 'opencode', 'settings.json'));
  candidates.push(path.join(xdg, 'opencode', 'mcp.json'));

  return candidates.filter(isFile);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const cwd = process.cwd();
  const workspace = path.resolve(args.workspace || detectGitRoot(cwd) || cwd);
  const homeDir = process.env.HOME || '';

  process.stdout.write('Security Config Doctor\n');
  process.stdout.write('----------------------\n');
  process.stdout.write(`Workspace: ${workspace}\n`);

  const files = [];
  files.push(
    ...listFilesIfPresent(workspace, [
      'CLAUDE.md',
      'config/browser-profiles.json',
      '.claude/settings.json',
      '.claude/mcp.json',
      '.claude/hooks.json',
      '.claude/CLAUDE.md',
      '.codex/config.toml',
      '.gemini/settings.json',
      '.opencode/settings.json',
    ]),
  );
  files.push(...listAgentMdFiles(workspace, '.claude/agents'));
  files.push(...listAgentMdFiles(workspace, '.codex/agents'));
  files.push(...listFilesUnder(workspace, 'agent-sources', (name) => name.toLowerCase().endsWith('.json')));

  if (args.scanGlobal) {
    if (homeDir) {
      files.push(...pickGlobalConfigFiles(homeDir));
      process.stdout.write('[info] global scan enabled (allowlisted files only)\n');
    } else {
      process.stdout.write('[warn] HOME is not set; skipping global scan\n');
    }
  }

  const uniq = [...new Set(files)].sort();
  if (uniq.length === 0) {
    process.stdout.write('[info] no known config files found to scan\n');
    process.exit(0);
  }

  let findings = 0;
  for (const filePath of uniq) {
    const text = readTextSafe(filePath, 1024 * 1024); // 1 MiB cap
    if (text == null) {
      process.stdout.write(`[warn] unreadable or too large: ${filePath}\n`);
      findings += 1;
      continue;
    }

    const secretHits = findSecretPatterns(text);
    for (const id of secretHits) {
      process.stdout.write(
        `[warn] secret pattern ${redactFinding(id)} in ${relativeTo(workspace, filePath)}\n`,
      );
      findings += 1;
    }

    const hookHits = findRiskyHookPatterns(text);
    for (const id of hookHits) {
      process.stdout.write(
        `[warn] risky hook pattern ${redactFinding(id)} in ${relativeTo(workspace, filePath)}\n`,
      );
      findings += 1;
    }

    if (filePath.toLowerCase().endsWith('.json')) {
      const res = scanJsonBroadAllowlists(text);
      if (res.ok && res.paths.length > 0) {
        process.stdout.write(
          `[warn] broad allowlist \"*\" in ${relativeTo(workspace, filePath)} at: ${res.paths.join(', ')}\n`,
        );
        findings += 1;
      } else if (!res.ok) {
        process.stdout.write(`[warn] invalid json: ${relativeTo(workspace, filePath)}\n`);
        findings += 1;
      }
    }
  }

  process.stdout.write(`[summary] warn=${findings}\n`);
  if (args.strict && findings > 0) {
    process.exit(1);
  }
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`[error] ${err && err.message ? err.message : String(err)}\n`);
  process.exit(2);
}
