function parseBoolEnv(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function shouldAllowNonTtyWatch(env = process.env) {
  return parseBoolEnv(env?.CI, false);
}

export async function watchRenderLoop(
  render,
  {
    intervalMs = 1000,
    isTTY = Boolean(process.stdout.isTTY),
    env = process.env,
    writeStdout = (text) => process.stdout.write(text),
    writeStderr = (text) => process.stderr.write(text),
    registerSigint = (handler) => process.on('SIGINT', handler),
    setIntervalFn = (handler, ms) => setInterval(handler, ms),
    clearIntervalFn = (timer) => clearInterval(timer),
  } = {},
) {
  if (typeof render !== 'function') {
    throw new Error('watchRenderLoop requires a render() function');
  }

  const interval = Number.isFinite(intervalMs) ? Math.max(250, Math.floor(intervalMs)) : 1000;
  if (!isTTY && !shouldAllowNonTtyWatch(env)) {
    writeStderr('Watch mode requires a TTY (or CI=1).\n');
    process.exitCode = 1;
    return;
  }

  writeStdout('\x1b[?25l');

  let firstRender = true;
  let inFlight = false;
  let queued = false;
  let stopped = false;
  let timer;
  let resolveDone = () => {};
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearIntervalFn(timer);
    writeStdout('\x1b[?25h\x1b[2J\x1b[H');
    resolveDone();
  };

  const renderTick = async () => {
    if (stopped) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;

    try {
      const output = await render();
      if (firstRender) {
        writeStdout('\x1b[2J\x1b[H');
        firstRender = false;
      } else {
        writeStdout('\x1b[H');
      }
      writeStdout(String(output || '') + '\x1b[K\n\x1b[J');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeStderr(`Watch render failed: ${message}\n`);
      process.exitCode = 1;
      stop();
    } finally {
      inFlight = false;
    }

    if (queued) {
      queued = false;
      await renderTick();
    }
  };

  registerSigint(stop);
  timer = setIntervalFn(() => {
    void renderTick();
  }, interval);

  await renderTick();
  if (!stopped) {
    await done;
  }
}

