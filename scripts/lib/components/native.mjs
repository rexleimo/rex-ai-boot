import { syncNativeEnhancements } from '../native/sync.mjs';
import { doctorNativeEnhancements as runNativeDoctor } from '../native/doctor.mjs';

export async function installNativeEnhancements({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  const result = await syncNativeEnhancements({ rootDir, client, mode: 'install', io });
  for (const item of result.results) {
    io.log(`[done] native ${item.client} -> installed=${item.installed} updated=${item.updated} reused=${item.reused} removed=${item.removed}`);
  }
  return result;
}

export async function updateNativeEnhancements({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  const result = await syncNativeEnhancements({ rootDir, client, mode: 'install', io });
  for (const item of result.results) {
    io.log(`[done] native ${item.client} -> installed=${item.installed} updated=${item.updated} reused=${item.reused} removed=${item.removed}`);
  }
  return result;
}

export async function uninstallNativeEnhancements({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  const result = await syncNativeEnhancements({ rootDir, client, mode: 'uninstall', io });
  for (const item of result.results) {
    io.log(`[done] native ${item.client} -> removed=${item.removed} reused=${item.reused}`);
  }
  return result;
}

export async function doctorNativeEnhancements({
  rootDir,
  client = 'all',
  io = console,
} = {}) {
  return runNativeDoctor({ rootDir, client, io });
}
