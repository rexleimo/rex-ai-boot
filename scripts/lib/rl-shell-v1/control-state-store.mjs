import {
  applyControlEvent,
  createControlStateStore as createCoreControlStateStore,
  readControlSnapshot,
  writeControlSnapshot,
} from '../rl-core/control-state-store.mjs';

export async function createControlStateStore({ rootDir }) {
  return createCoreControlStateStore({
    rootDir,
    namespace: 'rl-shell-v1',
  });
}

export { readControlSnapshot, writeControlSnapshot, applyControlEvent };
