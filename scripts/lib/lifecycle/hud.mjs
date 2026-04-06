import { readHudState } from '../hud/state.mjs';
import { normalizeHudPreset, renderHud } from '../hud/render.mjs';
import { createThrottledWatchRender, watchRenderLoop } from '../hud/watch.mjs';

const FAST_WATCH_DATA_REFRESH_MS = 1000;

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeIntervalMs(value, fallback = 1000) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(250, parsed) : fallback;
}

export function normalizeHudOptions(rawOptions = {}) {
  return {
    sessionId: normalizeText(rawOptions.sessionId),
    provider: normalizeText(rawOptions.provider).toLowerCase(),
    preset: normalizeHudPreset(rawOptions.preset || 'focused'),
    watch: rawOptions.watch === true,
    fast: rawOptions.fast === true,
    json: rawOptions.json === true,
    intervalMs: normalizeIntervalMs(rawOptions.intervalMs, 1000),
  };
}

export async function runHud(rawOptions = {}, { rootDir, io = console, env = process.env } = {}) {
  const options = normalizeHudOptions(rawOptions);
  const fastWatchMinimal = options.fast && options.watch && !options.json && options.preset === 'minimal';

  const renderOnce = async () => {
    const state = await readHudState({
      rootDir,
      sessionId: options.sessionId,
      provider: options.provider,
      fast: fastWatchMinimal,
    });

    if (options.json) {
      io.log(JSON.stringify(state, null, 2));
      return { exitCode: state.selection?.sessionId ? 0 : 1, state };
    }

    io.log(renderHud(state, { preset: options.preset }));
    return { exitCode: state.selection?.sessionId ? 0 : 1, state };
  };

  if (!options.watch || options.json) {
    if (options.watch && options.json) {
      io.log('[warn] hud --watch is ignored when --json is set.');
    }
    return await renderOnce();
  }

  const readAndRender = async () => {
    const state = await readHudState({
      rootDir,
      sessionId: options.sessionId,
      provider: options.provider,
      fast: fastWatchMinimal,
    });
    return renderHud(state, { preset: options.preset });
  };

  const watchRender = fastWatchMinimal
    ? createThrottledWatchRender(readAndRender, {
      minIntervalMs: Math.max(options.intervalMs, FAST_WATCH_DATA_REFRESH_MS),
    })
    : readAndRender;

  await watchRenderLoop(watchRender, {
    intervalMs: options.intervalMs,
    env,
  });

  return { exitCode: process.exitCode ?? 0 };
}
