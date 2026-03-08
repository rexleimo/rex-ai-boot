import path from 'node:path';

import { inspectBootstrapTask } from '../../doctor-bootstrap-task.mjs';
import { doctorBrowserMcp } from '../components/browser.mjs';
import { doctorContextDbShell } from '../components/shell.mjs';
import { doctorContextDbSkills } from '../components/skills.mjs';
import { doctorSuperpowers } from '../components/superpowers.mjs';
import { commandExists, captureCommand, runCommand } from '../platform/process.mjs';

export function countEffectiveWarnLines(input) {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\r?\n/);
  return lines
    .filter((line) => line.startsWith('[warn] '))
    .filter((line) => !/^\[warn\] (codex|claude|gemini) not found in PATH$/u.test(line))
    .length;
}

function printCaptured(io, text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.length > 0) {
      io.log(line);
    }
  }
}

export async function runDoctorSuite({ rootDir, strict = false, globalSecurity = false, io = console } = {}) {
  let effectiveWarns = 0;

  io.log('AIOS Verify');
  io.log('-----------');
  io.log(`Repo: ${rootDir}`);
  io.log(`Strict: ${strict}`);

  io.log('');
  io.log('== doctor-contextdb-shell ==');
  const shellResult = await doctorContextDbShell({ io });
  effectiveWarns += shellResult.effectiveWarnings;

  io.log('');
  io.log('== doctor-contextdb-skills ==');
  const skillsResult = await doctorContextDbSkills({ rootDir, client: 'all', io });
  effectiveWarns += skillsResult.effectiveWarnings;

  io.log('');
  io.log('== doctor-superpowers ==');
  const superpowersResult = await doctorSuperpowers({ io });
  if (superpowersResult.errors > 0) {
    throw new Error(`doctor-superpowers failed (${superpowersResult.errors} errors)`);
  }
  effectiveWarns += superpowersResult.effectiveWarnings;

  io.log('');
  io.log('== doctor-security-config ==');
  const securityScript = path.join(rootDir, 'scripts', 'doctor-security-config.mjs');
  const securityArgs = [securityScript, '--workspace', rootDir];
  if (globalSecurity) securityArgs.push('--global');
  const securityResult = captureCommand(process.execPath, securityArgs, { cwd: rootDir });
  printCaptured(io, securityResult.stdout);
  printCaptured(io, securityResult.stderr);
  effectiveWarns += countEffectiveWarnLines(`${securityResult.stdout}\n${securityResult.stderr}`);

  io.log('');
  io.log('== doctor-bootstrap-task ==');
  const bootstrap = await inspectBootstrapTask(rootDir);
  io.log('Bootstrap Task Doctor');
  io.log('---------------------');
  io.log(`Workspace: ${bootstrap.workspaceRoot}`);
  io.log(`[${bootstrap.status}] ${bootstrap.message}`);
  if (bootstrap.status !== 'ok') {
    effectiveWarns += 1;
  }

  io.log('');
  io.log('== doctor-browser-mcp ==');
  const browserResult = await doctorBrowserMcp({ rootDir, io });
  if (browserResult.errors > 0) {
    effectiveWarns += 1;
  } else {
    effectiveWarns += browserResult.effectiveWarnings;
  }

  io.log('');
  io.log('== mcp-server build ==');
  const mcpDir = path.join(rootDir, 'mcp-server');
  if (!commandExists('npm')) {
    io.log('[warn] npm not found; skipping mcp-server build');
    effectiveWarns += 1;
  } else {
    io.log('+ npm run typecheck');
    runCommand('npm', ['run', 'typecheck'], { cwd: mcpDir });
    io.log('+ npm run build');
    runCommand('npm', ['run', 'build'], { cwd: mcpDir });
  }

  io.log('');
  io.log(`[summary] effective_warn=${effectiveWarns}`);
  if (strict && effectiveWarns > 0) {
    io.log('[fail] strict mode: warnings found');
    return { effectiveWarns, exitCode: 1 };
  }

  io.log('[ok] verify-aios complete');
  return { effectiveWarns, exitCode: 0 };
}
