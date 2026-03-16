#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs } from './lib/cli/parse-args.mjs';
import { getCommandHelpText, getInternalHelpText, getRootHelpText } from './lib/cli/help.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp(parsed) {
  if (!parsed || parsed.command === 'root') {
    process.stdout.write(getRootHelpText());
    return;
  }

  if (parsed.command === 'internal') {
    process.stdout.write(getInternalHelpText(parsed.options.target, parsed.options.action));
    return;
  }

  process.stdout.write(getCommandHelpText(parsed.command));
}

async function runInternal(options) {
  const { target, action } = options;

  if (target === 'shell') {
    const module = await import('./lib/components/shell.mjs');
    if (action === 'install') return module.installContextDbShell({ rootDir, mode: options.mode ?? 'opt-in', force: Boolean(options.force), rcFile: options.rcFile });
    if (action === 'update') return module.installContextDbShell({ rootDir, mode: options.mode ?? 'opt-in', force: true, rcFile: options.rcFile });
    if (action === 'uninstall') return module.uninstallContextDbShell({ rcFile: options.rcFile });
    if (action === 'doctor') return module.doctorContextDbShell({ rcFile: options.rcFile });
  }

  if (target === 'skills') {
    const module = await import('./lib/components/skills.mjs');
    if (action === 'install') return module.installContextDbSkills({ rootDir, client: options.client ?? 'all', force: Boolean(options.force) });
    if (action === 'update') return module.installContextDbSkills({ rootDir, client: options.client ?? 'all', force: true });
    if (action === 'uninstall') return module.uninstallContextDbSkills({ rootDir, client: options.client ?? 'all' });
    if (action === 'doctor') return module.doctorContextDbSkills({ rootDir, client: options.client ?? 'all' });
  }

  if (target === 'superpowers') {
    const module = await import('./lib/components/superpowers.mjs');
    if (action === 'install') return module.installSuperpowers({ repoUrl: options.repoUrl, update: Boolean(options.update), force: Boolean(options.force) });
    if (action === 'update') return module.installSuperpowers({ repoUrl: options.repoUrl, update: true, force: true });
    if (action === 'doctor') return module.doctorSuperpowers();
  }

  if (target === 'browser') {
    const module = await import('./lib/components/browser.mjs');
    if (action === 'install') return module.installBrowserMcp({ rootDir, dryRun: Boolean(options.dryRun), skipPlaywrightInstall: Boolean(options.skipPlaywrightInstall) });
    if (action === 'doctor') return module.doctorBrowserMcp({ rootDir });
  }

  if (target === 'privacy') {
    const module = await import('./lib/components/shell.mjs');
    if (action === 'install') return module.installPrivacyGuard({ rootDir, enable: options.enable !== false, disable: Boolean(options.disable), mode: options.mode ?? '' });
  }

  throw new Error(`Unsupported internal action: ${target} ${action}`);
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.stderr.write(getRootHelpText());
    process.exitCode = 1;
    return;
  }

  if (parsed.mode === 'help') {
    printHelp(parsed);
    return;
  }

  if (parsed.mode === 'interactive') {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      process.stderr.write('[warn] interactive TUI requires a TTY\n');
      process.stdout.write(getRootHelpText());
      process.exitCode = 1;
      return;
    }

    const { runInteractiveSession } = await import('./lib/tui/session.mjs');
    await runInteractiveSession({
      rootDir,
      onRun: async (action, options) => {
        if (action === 'setup') {
          const { runSetup } = await import('./lib/lifecycle/setup.mjs');
          await runSetup(options, { rootDir });
          return;
        }
        if (action === 'update') {
          const { runUpdate } = await import('./lib/lifecycle/update.mjs');
          await runUpdate(options, { rootDir });
          return;
        }
        if (action === 'uninstall') {
          const { runUninstall } = await import('./lib/lifecycle/uninstall.mjs');
          await runUninstall(options, { rootDir });
          return;
        }
        if (action === 'doctor') {
          const { runDoctor } = await import('./lib/lifecycle/doctor.mjs');
          await runDoctor(options, { rootDir });
          return;
        }

        process.stdout.write(`[warn] unknown interactive action: ${action}\n`);
      },
    });
    return;
  }

  if (parsed.command === 'internal') {
    await runInternal(parsed.options);
    return;
  }

  if (parsed.command === 'setup') {
    const { runSetup } = await import('./lib/lifecycle/setup.mjs');
    await runSetup(parsed.options, { rootDir });
    return;
  }

  if (parsed.command === 'update') {
    const { runUpdate } = await import('./lib/lifecycle/update.mjs');
    await runUpdate(parsed.options, { rootDir });
    return;
  }

  if (parsed.command === 'uninstall') {
    const { runUninstall } = await import('./lib/lifecycle/uninstall.mjs');
    await runUninstall(parsed.options, { rootDir });
    return;
  }

  if (parsed.command === 'doctor') {
    const { runDoctor } = await import('./lib/lifecycle/doctor.mjs');
    await runDoctor(parsed.options, { rootDir });
    return;
  }

  if (parsed.command === 'quality-gate') {
    const { runQualityGate } = await import('./lib/lifecycle/quality-gate.mjs');
    const result = await runQualityGate(parsed.options, { rootDir });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
    return;
  }

  if (parsed.command === 'orchestrate') {
    const { runOrchestrate } = await import('./lib/lifecycle/orchestrate.mjs');
    const result = await runOrchestrate(parsed.options, { rootDir });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
    return;
  }

  if (parsed.command === 'learn-eval') {
    const { runLearnEval } = await import('./lib/lifecycle/learn-eval.mjs');
    const result = await runLearnEval(parsed.options, { rootDir });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
    return;
  }

  if (parsed.command === 'entropy-gc') {
    const { runEntropyGc } = await import('./lib/lifecycle/entropy-gc.mjs');
    const result = await runEntropyGc(parsed.options, { rootDir });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
    return;
  }

  if (parsed.command === 'memo') {
    const { runMemo } = await import('./lib/memo/memo.mjs');
    await runMemo(parsed.options, { rootDir });
    return;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
