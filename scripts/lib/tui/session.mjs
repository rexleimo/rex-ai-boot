import readline from 'node:readline';

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

export async function runInteractiveSession({ rootDir, onRun }) {
  const stateRef = { current: createInitialState() };

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
