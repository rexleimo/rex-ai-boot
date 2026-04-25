#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifest = path.join(rootDir, 'memory/knowledge/competitor-watchlist.json');

function parseArgs(argv) {
  const options = {
    manifest: defaultManifest,
    dryRun: false,
    repo: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') {
      options.manifest = path.resolve(rootDir, argv[index + 1]);
      index += 1;
    } else if (arg === '--repo') {
      options.repo = argv[index + 1];
      index += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/update-competitor-repos.mjs [--repo owner/name] [--dry-run]\n\nDownloads GitHub tarball snapshots for repositories in memory/knowledge/competitor-watchlist.json into temp/competitor-repos/.\n`);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aios-competitor-watchlist',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}: ${await response.text()}`);
  }

  return response.json();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}

function safeSlug(project) {
  return project.local_slug || project.canonical_repo.replace(/[^A-Za-z0-9._-]/g, '__');
}

async function ensureInsideRoot(targetRoot, candidatePath) {
  const rootReal = await fs.realpath(targetRoot).catch(async () => {
    await fs.mkdir(targetRoot, { recursive: true });
    return fs.realpath(targetRoot);
  });
  const candidate = path.resolve(candidatePath);
  if (!candidate.startsWith(`${rootReal}${path.sep}`) && candidate !== rootReal) {
    throw new Error(`Refusing to write outside ${rootReal}: ${candidate}`);
  }
}

async function syncProject({ project, localRoot, dryRun }) {
  const fullName = project.canonical_repo;
  if (!fullName || project.status === 'unresolved') {
    return { skipped: true, reason: 'unresolved', project };
  }

  const repoInfo = await githubJson(`https://api.github.com/repos/${fullName}`);
  const branch = await githubJson(`https://api.github.com/repos/${fullName}/branches/${repoInfo.default_branch}`);
  const slug = safeSlug(project);
  const targetDir = path.join(localRoot, slug);
  const tmpRoot = path.join(localRoot, '.tmp');
  const extractDir = path.join(tmpRoot, `${slug}-${Date.now()}`);
  const archivePath = path.join(tmpRoot, `${slug}.tar.gz`);
  await ensureInsideRoot(localRoot, targetDir);

  const metadata = {
    canonical_repo: fullName,
    github_url: repoInfo.html_url,
    description: repoInfo.description,
    default_branch: repoInfo.default_branch,
    commit_sha: branch.commit.sha,
    pushed_at: repoInfo.pushed_at,
    updated_at: repoInfo.updated_at,
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    open_issues: repoInfo.open_issues_count,
    license: repoInfo.license?.spdx_id ?? null,
    synced_at: new Date().toISOString(),
    source: `https://api.github.com/repos/${fullName}`,
  };

  if (dryRun) {
    return { dryRun: true, targetDir, metadata };
  }

  await fs.rm(extractDir, { recursive: true, force: true });
  await fs.mkdir(extractDir, { recursive: true });
  await fs.mkdir(tmpRoot, { recursive: true });

  run('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--header',
    'Accept: application/vnd.github+json',
    '--header',
    'User-Agent: aios-competitor-watchlist',
    '--output',
    archivePath,
    `https://api.github.com/repos/${fullName}/tarball/${repoInfo.default_branch}`,
  ]);
  run('tar', ['-xzf', archivePath, '-C', extractDir, '--strip-components=1']);

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.rename(extractDir, targetDir);
  await fs.writeFile(path.join(targetDir, '.source.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await fs.rm(archivePath, { force: true });

  project.github_url = repoInfo.html_url;
  project.description = repoInfo.description;
  project.default_branch = repoInfo.default_branch;
  project.last_commit_sha = branch.commit.sha;
  project.last_pushed_at = repoInfo.pushed_at;
  project.last_github_updated_at = repoInfo.updated_at;
  project.stars = repoInfo.stargazers_count;
  project.forks = repoInfo.forks_count;
  project.license = repoInfo.license?.spdx_id ?? null;
  project.local_path = path.relative(rootDir, targetDir);
  project.last_synced_at = metadata.synced_at;

  return { synced: true, targetDir, metadata };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const manifest = await readJson(options.manifest);
  const localRoot = path.resolve(rootDir, manifest.default_local_root || 'temp/competitor-repos');
  await fs.mkdir(localRoot, { recursive: true });

  const projects = manifest.projects.filter((project) => {
    return project.status !== 'inactive' && (!options.repo || project.canonical_repo === options.repo || project.input_name === options.repo);
  });

  if (projects.length === 0) {
    throw new Error(`No projects matched ${options.repo ?? 'active manifest entries'}`);
  }

  const results = [];
  for (const project of projects) {
    process.stdout.write(`\n==> ${project.canonical_repo}\n`);
    const result = await syncProject({ project, localRoot, dryRun: options.dryRun });
    results.push(result);
    if (result.metadata) {
      process.stdout.write(`${options.dryRun ? 'would sync' : 'synced'} ${project.canonical_repo} @ ${result.metadata.commit_sha.slice(0, 12)} -> ${path.relative(rootDir, result.targetDir)}\n`);
    }
  }

  if (!options.dryRun) {
    manifest.last_updated_at = new Date().toISOString();
    await writeJson(options.manifest, manifest);
  }

  process.stdout.write(`\nProcessed ${results.length} project(s).\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
