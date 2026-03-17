import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

import { loadSkillsCatalog } from '../components/skills.mjs';
import { getClientHomes } from '../platform/paths.mjs';
import { renderState } from './render.mjs';
import { createInitialState, reduceState } from './state.mjs';

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function toAction(str, key) {
  if (key?.name === 'up') return 'up';
  if (key?.name === 'down') return 'down';
  if (key?.name === 'left') return 'left';
  if (key?.name === 'right') return 'right';
  if (key?.name === 'return' || key?.name === 'enter') return 'enter';
  if (key?.name === 'space') return 'space';
  if (key?.name === 'q') return 'quit';
  if (key?.name === 'b') return 'back';
  if (str === 'q' || str === 'Q') return 'quit';
  if (str === 'b' || str === 'B') return 'back';
  return '';
}

async function waitForReturn() {
  process.stdout.write('\nPress Enter to return to the menu...');
  await new Promise((resolve) => {
    process.stdin.setRawMode(false);
    process.stdin.once('data', () => resolve());
  });
}

function collectInstalledSkills({ rootDir, projectRoot, catalogSkills }) {
  const homes = getClientHomes(process.env);
  const installedSkills = {
    global: {},
    project: {},
  };

  for (const skill of catalogSkills) {
    for (const client of Array.isArray(skill.clients) ? skill.clients : []) {
      const globalRoot = path.join(homes[client] || '', 'skills');
      const projectRootForClient = path.join(projectRoot, client === 'opencode' ? '.opencode/skills' : `.${client}/skills`);
      const globalPath = path.join(globalRoot, skill.name);
      const projectPath = path.join(projectRootForClient, skill.name);

      if (fs.existsSync(globalPath)) {
        installedSkills.global[client] = installedSkills.global[client] || [];
        installedSkills.global[client].push(skill.name);
      }
      if (fs.existsSync(projectPath)) {
        installedSkills.project[client] = installedSkills.project[client] || [];
        installedSkills.project[client].push(skill.name);
      }
    }
  }

  return installedSkills;
}

export async function runInteractiveSession({ rootDir, onRun }) {
  let catalogSkills = [];
  try {
    catalogSkills = loadSkillsCatalog(rootDir);
  } catch {
    catalogSkills = [];
  }
  const installedSkills = collectInstalledSkills({ rootDir, projectRoot: process.cwd(), catalogSkills });
  const stateRef = { current: createInitialState({ catalogSkills, installedSkills, viewportRows: process.stdout.rows || 24 }) };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  const cleanup = () => {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore cleanup failure
    }
    process.stdout.write('\x1B[?25h');
  };

  const draw = () => {
    clearScreen();
    process.stdout.write(renderState(stateRef.current, rootDir));
  };

  draw();

  return new Promise((resolve, reject) => {
    const handler = async (str, key) => {
      try {
        const action = toAction(str, key);
        if (!action) {
          return;
        }

        stateRef.current = reduceState(stateRef.current, action);
        if (stateRef.current.exitRequested) {
          process.stdin.removeListener('keypress', handler);
          cleanup();
          clearScreen();
          resolve();
          return;
        }

        const request = stateRef.current.shouldRun;
        if (request) {
          process.stdin.removeListener('keypress', handler);
          cleanup();
          clearScreen();
          await onRun(request.action, request.options);
          await waitForReturn();
          process.stdin.setRawMode(true);
          stateRef.current.shouldRun = null;
          process.stdin.on('keypress', handler);
        }

        draw();
      } catch (error) {
        process.stdin.removeListener('keypress', handler);
        cleanup();
        reject(error);
      }
    };

    process.stdin.on('keypress', handler);
  });
}
