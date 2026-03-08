import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';

function requireCommand(name) {
  if (!commandExists(name)) {
    throw new Error(`Missing required command: ${name}`);
  }
}

function printSnippet(io, distPath) {
  io.log('');
  io.log('Done. Add this MCP server block to your client config:');
  io.log('');
  io.log('{');
  io.log('  "mcpServers": {');
  io.log('    "playwright-browser-mcp": {');
  io.log('      "command": "node",');
  io.log(`      "args": ["${distPath}"]`);
  io.log('    }');
  io.log('  }');
  io.log('}');
}

export async function installBrowserMcp({ rootDir, skipPlaywrightInstall = false, dryRun = false, io = console } = {}) {
  const mcpDir = path.join(rootDir, 'mcp-server');
  const distEntry = path.join(mcpDir, 'dist', 'index.js');

  if (!fs.existsSync(mcpDir)) {
    throw new Error(`mcp-server directory not found: ${mcpDir}`);
  }

  requireCommand('node');
  requireCommand('npm');
  requireCommand('npx');

  const runInMcp = (command, args) => {
    io.log(`+ (cd ${mcpDir} && ${command} ${args.join(' ')})`);
    if (!dryRun) {
      runCommand(command, args, { cwd: mcpDir });
    }
  };

  runInMcp('npm', ['install']);
  if (!skipPlaywrightInstall) {
    runInMcp('npx', ['playwright', 'install', 'chromium']);
  }
  runInMcp('npm', ['run', 'build']);

  const distPath = dryRun ? '<ABSOLUTE_PATH_TO_REPO>/mcp-server/dist/index.js' : fs.realpathSync(distEntry);
  printSnippet(io, distPath);
  return { distPath };
}

function testPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 300 }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function doctorBrowserMcp({ rootDir, io = console } = {}) {
  const mcpDir = path.join(rootDir, 'mcp-server');
  const distEntry = path.join(mcpDir, 'dist', 'index.js');
  const profileConfig = path.join(rootDir, 'config', 'browser-profiles.json');

  let warnings = 0;
  let errors = 0;
  const ok = (message) => io.log(`OK   ${message}`);
  const warn = (message) => {
    warnings += 1;
    io.log(`WARN ${message}`);
  };
  const err = (message) => {
    errors += 1;
    io.log(`ERR  ${message}`);
  };

  io.log('Browser MCP Doctor');
  io.log(`Repo: ${rootDir}`);
  io.log('');
  io.log('[1/6] Command checks');
  for (const command of ['node', 'npm', 'npx']) {
    if (commandExists(command)) ok(`command exists: ${command}`); else err(`missing command: ${command}`);
  }

  const version = captureCommand('node', ['-p', 'process.versions.node']);
  const major = Number((version.stdout.trim().split('.')[0] || '0'));
  if (major > 0 && major < 20) {
    warn(`node version is ${version.stdout.trim()} (recommended: >= 20)`);
  }

  io.log('');
  io.log('[2/6] mcp-server files');
  if (fs.existsSync(path.join(mcpDir, 'package.json'))) ok('mcp-server/package.json found'); else err('missing mcp-server/package.json');
  if (fs.existsSync(path.join(mcpDir, 'node_modules'))) ok('mcp-server/node_modules found'); else err('node_modules missing. Run: cd mcp-server; npm install');
  if (fs.existsSync(distEntry)) ok('build artifact found: mcp-server/dist/index.js'); else err('build artifact missing. Run: cd mcp-server; npm run build');

  io.log('');
  io.log('[3/6] Playwright runtime');
  const playwrightPath = captureCommand('node', ['-e', "process.stdout.write(require('playwright').chromium.executablePath())"], { cwd: mcpDir });
  if (playwrightPath.status === 0 && playwrightPath.stdout.trim() && fs.existsSync(playwrightPath.stdout.trim())) {
    ok('Playwright chromium executable found');
  } else {
    warn('Playwright chromium executable not installed. Run: cd mcp-server; npx playwright install chromium');
  }

  io.log('');
  io.log('[4/6] profile config');
  if (!fs.existsSync(profileConfig)) {
    err('profile config missing: config/browser-profiles.json');
  } else {
    ok('profile config found: config/browser-profiles.json');
  }

  let defaultProfile = null;
  if (fs.existsSync(profileConfig)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(profileConfig, 'utf8'));
      defaultProfile = parsed?.profiles?.default ?? null;
      if (!defaultProfile) {
        warn('profile config has no profiles.default entry');
      }
    } catch (error) {
      err(`profile config JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  io.log('');
  io.log('[5/6] default profile mode');
  if (!defaultProfile) {
    warn('default profile not configured; skipping CDP mode checks');
  } else if (defaultProfile.cdpUrl) {
    ok(`default profile uses cdpUrl: ${defaultProfile.cdpUrl}`);
  } else if (defaultProfile.cdpPort) {
    const port = Number(defaultProfile.cdpPort);
    if (!Number.isInteger(port) || port <= 0) {
      warn(`default cdpPort is not a valid integer: ${defaultProfile.cdpPort}`);
    } else if (await testPortOpen(port)) {
      ok(`default CDP port is reachable: ${port}`);
    } else {
      warn(`default CDP port is not reachable: ${port} (profile=default will auto-fallback to local launch)`);
    }
  } else {
    ok('default profile uses local launch mode (no CDP dependency)');
  }

  io.log('');
  io.log('[6/6] quick next steps');
  io.log('- If ERR exists: run install script first');
  io.log('  node scripts/aios.mjs setup --components browser');
  io.log('- Then smoke test in client chat: browser_launch -> browser_navigate -> browser_snapshot -> browser_close');

  io.log('');
  if (errors > 0) io.log(`Result: FAILED (${errors} errors, ${warnings} warnings)`);
  else io.log(`Result: OK (${warnings} warnings)`);

  return { warnings, effectiveWarnings: warnings, errors };
}
