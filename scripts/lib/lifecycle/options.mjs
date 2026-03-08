export const COMPONENT_NAMES = ['browser', 'shell', 'skills', 'superpowers'];
export const WRAP_MODES = ['all', 'repo-only', 'opt-in', 'off'];
export const CLIENT_NAMES = ['all', 'codex', 'claude', 'gemini', 'opencode'];

export function normalizeWrapMode(raw = 'opt-in') {
  const value = String(raw || 'opt-in').trim().toLowerCase();
  if (!WRAP_MODES.includes(value)) {
    throw new Error(`--mode must be one of: ${WRAP_MODES.join(', ')}`);
  }
  return value;
}

export function normalizeClient(raw = 'all') {
  const value = String(raw || 'all').trim().toLowerCase();
  if (!CLIENT_NAMES.includes(value)) {
    throw new Error(`--client must be one of: ${CLIENT_NAMES.join(', ')}`);
  }
  return value;
}

export function normalizeComponents(raw, fallback = COMPONENT_NAMES) {
  if (Array.isArray(raw)) {
    return normalizeComponents(raw.join(','), fallback);
  }

  if (raw && typeof raw === 'object') {
    const selected = COMPONENT_NAMES.filter((name) => raw[name] === true);
    return selected.length > 0 ? selected : [...fallback];
  }

  const input = String(raw ?? '').trim();
  const normalized = input.length > 0
    ? input.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
    : [...fallback];

  if (normalized.length === 0) {
    return [...fallback];
  }

  if (normalized.includes('all')) {
    return ['all'];
  }

  for (const item of normalized) {
    if (!COMPONENT_NAMES.includes(item)) {
      throw new Error(`Unsupported component: ${item}. Allowed: ${COMPONENT_NAMES.join(', ')} (or all)`);
    }
  }

  return [...new Set(normalized)];
}

export function hasComponent(components, needle) {
  return components.includes('all') || components.includes(needle);
}

export function createDefaultSetupOptions() {
  return {
    components: [...COMPONENT_NAMES],
    wrapMode: 'opt-in',
    client: 'all',
    skipPlaywrightInstall: false,
    skipDoctor: false,
  };
}

export function createDefaultUpdateOptions() {
  return {
    components: [...COMPONENT_NAMES],
    wrapMode: 'opt-in',
    client: 'all',
    withPlaywrightInstall: false,
    skipDoctor: false,
  };
}

export function createDefaultUninstallOptions() {
  return {
    components: ['shell', 'skills'],
    client: 'all',
  };
}

export function createDefaultDoctorOptions() {
  return {
    strict: false,
    globalSecurity: false,
  };
}
