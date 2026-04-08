import { readHudState } from '../hud/state.mjs';
import { normalizeHudPreset, renderHud } from '../hud/render.mjs';
import { formatSkillCandidateDetails } from '../hud/skill-candidates.mjs';
import { buildWatchMeta } from '../hud/watch-meta.mjs';
import { resolveWatchCadence } from '../hud/watch-cadence.mjs';
import { createThrottledWatchRender, watchRenderLoop } from '../hud/watch.mjs';

const FAST_WATCH_DATA_REFRESH_MS = 1000;

function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeHudOptions(rawOptions = {}) {
  const cadence = resolveWatchCadence(rawOptions.intervalMs, { fallbackMs: 1000 });
  return {
    sessionId: normalizeText(rawOptions.sessionId),
    provider: normalizeText(rawOptions.provider).toLowerCase(),
    preset: normalizeHudPreset(rawOptions.preset || 'focused'),
    watch: rawOptions.watch === true,
    fast: rawOptions.fast === true,
    showSkillCandidates: rawOptions.showSkillCandidates === true,
    json: rawOptions.json === true,
    intervalMs: cadence.renderIntervalMs,
    intervalLabel: cadence.renderIntervalLabel,
    adaptiveInterval: cadence.adaptiveInterval,
  };
}

export async function runHud(rawOptions = {}, { rootDir, io = console, env = process.env } = {}) {
  const options = normalizeHudOptions(rawOptions);
  const skillCandidateLimit = options.showSkillCandidates ? 6 : 0;
  const fastWatchMinimal = options.fast && options.watch && !options.json && options.preset === 'minimal';
  const dataRefreshMs = fastWatchMinimal
    ? Math.max(options.intervalMs, FAST_WATCH_DATA_REFRESH_MS)
    : options.intervalMs;
  const dataRefreshLabel = options.adaptiveInterval
    ? fastWatchMinimal
      ? `auto(${dataRefreshMs}-${Math.max(dataRefreshMs, options.adaptiveInterval.maxIntervalMs)}ms)`
      : options.intervalLabel
    : `${dataRefreshMs}ms`;

  const renderOnce = async () => {
    const state = await readHudState({
      rootDir,
      sessionId: options.sessionId,
      provider: options.provider,
      fast: fastWatchMinimal,
      skillCandidateLimit,
    });

    if (options.json) {
      io.log(JSON.stringify(state, null, 2));
      return { exitCode: state.selection?.sessionId ? 0 : 1, state };
    }

    const hudText = renderHud(state, {
      preset: options.preset,
      watchMeta: options.watch
        ? buildWatchMeta(state, {
          renderIntervalMs: options.intervalMs,
          renderIntervalLabel: options.intervalLabel,
          dataRefreshMs,
          dataRefreshLabel,
          fast: fastWatchMinimal,
        })
        : null,
    }).trimEnd();
    const skillCandidateText = options.showSkillCandidates
      ? formatSkillCandidateDetails(state, { limit: skillCandidateLimit })
      : '';
    io.log([hudText, skillCandidateText].filter(Boolean).join('\n') + '\n');
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
      skillCandidateLimit,
    });
    const hudText = renderHud(state, {
      preset: options.preset,
      watchMeta: buildWatchMeta(state, {
        renderIntervalMs: options.intervalMs,
        renderIntervalLabel: options.intervalLabel,
        dataRefreshMs,
        dataRefreshLabel,
        fast: fastWatchMinimal,
      }),
    }).trimEnd();
    const skillCandidateText = options.showSkillCandidates
      ? formatSkillCandidateDetails(state, { limit: skillCandidateLimit })
      : '';
    return [hudText, skillCandidateText].filter(Boolean).join('\n') + '\n';
  };

  const watchRender = fastWatchMinimal
    ? createThrottledWatchRender(readAndRender, {
      minIntervalMs: dataRefreshMs,
    })
    : readAndRender;

  await watchRenderLoop(watchRender, {
    intervalMs: options.intervalMs,
    adaptiveInterval: options.adaptiveInterval,
    env,
  });

  return { exitCode: process.exitCode ?? 0 };
}
