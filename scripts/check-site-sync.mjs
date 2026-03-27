import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

function formatPath(relPath) {
  return relPath.split(path.sep).join('/');
}

async function readUtf8(relPath) {
  const absPath = path.join(rootDir, relPath);
  return fs.readFile(absPath, 'utf8');
}

async function fileExists(relPath) {
  const absPath = path.join(rootDir, relPath);
  try {
    const stat = await fs.stat(absPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function assertIncludes(errors, { relPath, expected }) {
  if (!expected) return;
  errors.push(`missing expected content in ${formatPath(relPath)}: ${JSON.stringify(expected)}`);
}

async function checkFileContains(errors, relPath, needles = []) {
  const text = await readUtf8(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      assertIncludes(errors, { relPath, expected: needle });
    }
  }
}

async function main() {
  const errors = [];

  const coreBlogEn = [
    'rl-training-system.md',
    'contextdb-fts-bm25-search.md',
    'windows-cli-startup-stability.md',
    'orchestrate-live.md',
  ];

  const locales = ['zh', 'ja', 'ko'];

  // Blog: core posts exist for EN + locales.
  for (const fileName of coreBlogEn) {
    if (!(await fileExists(path.join('blog-site', fileName)))) {
      errors.push(`missing blog canonical: ${formatPath(path.join('blog-site', fileName))}`);
    }
    for (const locale of locales) {
      const localized = path.join('blog-site', locale, fileName);
      if (!(await fileExists(localized))) {
        errors.push(`missing blog translation (${locale}): ${formatPath(localized)}`);
      }
    }
  }

  // Docs home: all locales link to the core posts via canonical /blog/... paths.
  const coreBlogLinks = [
    '/blog/rl-training-system/',
    '/blog/contextdb-fts-bm25-search/',
    '/blog/windows-cli-startup-stability/',
    '/blog/orchestrate-live/',
  ];
  await checkFileContains(errors, 'docs-site/index.md', coreBlogLinks);
  for (const locale of locales) {
    await checkFileContains(errors, path.join('docs-site', locale, 'index.md'), coreBlogLinks);
  }

  // Blog index: all locales list core posts (relative links inside the blog build).
  const coreBlogIndexLinks = [
    '(rl-training-system.md)',
    '(contextdb-fts-bm25-search.md)',
    '(windows-cli-startup-stability.md)',
    '(orchestrate-live.md)',
  ];
  await checkFileContains(errors, 'blog-site/index.md', coreBlogIndexLinks);
  for (const locale of locales) {
    await checkFileContains(errors, path.join('blog-site', locale, 'index.md'), coreBlogIndexLinks);
  }

  // Blog nav includes the core set explicitly for discoverability.
  await checkFileContains(errors, 'mkdocs.blog.yml', [
    'AIOS RL Training System: rl-training-system.md',
    'ContextDB Search Upgrade: contextdb-fts-bm25-search.md',
    'Windows CLI Startup Stability: windows-cli-startup-stability.md',
    'Orchestrate Live: orchestrate-live.md',
  ]);

  if (errors.length > 0) {
    console.error('[check-site-sync] FAILED');
    for (const line of errors) {
      console.error(`- ${line}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[check-site-sync] OK');
}

await main();
