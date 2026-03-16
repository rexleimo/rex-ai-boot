const MODE_OPTIONS = ['all', 'repo-only', 'opt-in', 'off'];
const CLIENT_OPTIONS = ['all', 'codex', 'claude', 'gemini', 'opencode'];
const SCOPE_OPTIONS = ['global', 'project'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cycle(list, current) {
  const index = list.indexOf(current);
  if (index === -1) {
    return list[0];
  }
  return list[(index + 1) % list.length];
}

function withCursor(state, maxCursor) {
  const next = clone(state);
  if (next.cursor < 0) {
    next.cursor = maxCursor;
  }
  if (next.cursor > maxCursor) {
    next.cursor = 0;
  }
  return next;
}

function ensureAnySetupComponent(state) {
  const components = state.options.setup.components;
  if (!components.browser && !components.shell && !components.skills && !components.superpowers) {
    components.shell = true;
  }
}

function ensureAnyUninstallComponent(state) {
  const components = state.options.uninstall.components;
  if (!components.browser && !components.shell && !components.skills && !components.superpowers) {
    components.shell = true;
  }
}

function buildRunRequest(state, action) {
  return {
    action,
    options: clone(state.options[action]),
  };
}

function skillMatchesClient(skill, client) {
  if (client === 'all') {
    return Array.isArray(skill.clients) && skill.clients.length > 0;
  }
  return Array.isArray(skill.clients) && skill.clients.includes(client);
}

function visibleSkillNames(catalogSkills, client, scope) {
  return catalogSkills
    .filter((skill) => Array.isArray(skill.scopes) && skill.scopes.includes(scope))
    .filter((skill) => skillMatchesClient(skill, client))
    .map((skill) => skill.name)
    .filter(Boolean);
}

function defaultSelectedSkills(catalogSkills, client, scope) {
  return catalogSkills
    .filter((skill) => Array.isArray(skill.scopes) && skill.scopes.includes(scope))
    .filter((skill) => skillMatchesClient(skill, client))
    .filter((skill) => Boolean(skill.defaultInstall?.[scope]))
    .map((skill) => skill.name);
}

function syncSelectedSkills(option, catalogSkills) {
  const visible = new Set(visibleSkillNames(catalogSkills, option.client, option.scope));
  const selected = Array.isArray(option.selectedSkills) ? option.selectedSkills.filter((name) => visible.has(name)) : [];
  option.selectedSkills = selected.length > 0 ? selected : defaultSelectedSkills(catalogSkills, option.client, option.scope);
}

function getSkillPickerActionState(state) {
  const action = state.skillPickerAction;
  if (!action || !state.options[action]) {
    return { action: '', skills: [] };
  }
  const option = state.options[action];
  return {
    action,
    skills: visibleSkillNames(state.catalogSkills, option.client, option.scope),
  };
}

export function createInitialState({ catalogSkills = [] } = {}) {
  const setup = {
    components: {
      browser: true,
      shell: true,
      skills: true,
      superpowers: true,
    },
    wrapMode: 'opt-in',
    scope: 'global',
    client: 'all',
    selectedSkills: defaultSelectedSkills(catalogSkills, 'all', 'global'),
    skipPlaywrightInstall: false,
    skipDoctor: false,
  };
  const update = {
    components: {
      browser: true,
      shell: true,
      skills: true,
      superpowers: true,
    },
    wrapMode: 'opt-in',
    scope: 'global',
    client: 'all',
    selectedSkills: defaultSelectedSkills(catalogSkills, 'all', 'global'),
    withPlaywrightInstall: false,
    skipDoctor: false,
  };
  const uninstall = {
    components: {
      browser: false,
      shell: true,
      skills: true,
      superpowers: false,
    },
    scope: 'global',
    client: 'all',
    selectedSkills: [],
  };

  return {
    screen: 'main',
    cursor: 0,
    confirmAction: '',
    skillPickerAction: '',
    exitRequested: false,
    shouldRun: null,
    catalogSkills,
    options: {
      setup,
      update,
      uninstall,
      doctor: {
        strict: false,
        globalSecurity: false,
      },
    },
  };
}

export function reduceState(state, action) {
  if (action === 'quit') {
    return {
      ...state,
      exitRequested: true,
      shouldRun: null,
    };
  }

  let next = clone(state);
  next.shouldRun = null;

  switch (next.screen) {
    case 'main': {
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, 4);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, 4);
      if (action === 'enter') {
        if (next.cursor === 0) return { ...next, screen: 'setup', cursor: 0 };
        if (next.cursor === 1) return { ...next, screen: 'update', cursor: 0 };
        if (next.cursor === 2) return { ...next, screen: 'uninstall', cursor: 0 };
        if (next.cursor === 3) return { ...next, screen: 'doctor', cursor: 0 };
        return { ...next, exitRequested: true };
      }
      return next;
    }
    case 'setup': {
      if (action === 'back') return { ...next, screen: 'main', cursor: 0 };
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, 11);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, 11);
      if (action === 'space' || action === 'right') {
        switch (next.cursor) {
          case 0:
            next.options.setup.components.browser = !next.options.setup.components.browser;
            break;
          case 1:
            next.options.setup.components.shell = !next.options.setup.components.shell;
            break;
          case 2:
            next.options.setup.components.skills = !next.options.setup.components.skills;
            break;
          case 3:
            next.options.setup.components.superpowers = !next.options.setup.components.superpowers;
            break;
          case 4:
            next.options.setup.wrapMode = cycle(MODE_OPTIONS, next.options.setup.wrapMode);
            break;
          case 5:
            next.options.setup.scope = cycle(SCOPE_OPTIONS, next.options.setup.scope);
            syncSelectedSkills(next.options.setup, next.catalogSkills);
            break;
          case 6:
            next.options.setup.client = cycle(CLIENT_OPTIONS, next.options.setup.client);
            syncSelectedSkills(next.options.setup, next.catalogSkills);
            break;
          case 7:
            next.options.setup.skipPlaywrightInstall = !next.options.setup.skipPlaywrightInstall;
            break;
          case 8:
            next.options.setup.skipDoctor = !next.options.setup.skipDoctor;
            break;
          default:
            break;
        }
        ensureAnySetupComponent(next);
        return next;
      }
      if (action === 'enter') {
        if (next.cursor === 9) {
          return { ...next, screen: 'skill-picker', skillPickerAction: 'setup', cursor: 0 };
        }
        if (next.cursor === 10) {
          return { ...next, screen: 'confirm', cursor: 0, confirmAction: 'setup' };
        }
        if (next.cursor === 11) {
          return { ...next, screen: 'main', cursor: 0 };
        }
      }
      return next;
    }
    case 'update': {
      if (action === 'back') return { ...next, screen: 'main', cursor: 0 };
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, 11);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, 11);
      if (action === 'space' || action === 'right') {
        switch (next.cursor) {
          case 0:
            next.options.update.components.browser = !next.options.update.components.browser;
            break;
          case 1:
            next.options.update.components.shell = !next.options.update.components.shell;
            break;
          case 2:
            next.options.update.components.skills = !next.options.update.components.skills;
            break;
          case 3:
            next.options.update.components.superpowers = !next.options.update.components.superpowers;
            break;
          case 4:
            next.options.update.wrapMode = cycle(MODE_OPTIONS, next.options.update.wrapMode);
            break;
          case 5:
            next.options.update.scope = cycle(SCOPE_OPTIONS, next.options.update.scope);
            syncSelectedSkills(next.options.update, next.catalogSkills);
            break;
          case 6:
            next.options.update.client = cycle(CLIENT_OPTIONS, next.options.update.client);
            syncSelectedSkills(next.options.update, next.catalogSkills);
            break;
          case 7:
            next.options.update.withPlaywrightInstall = !next.options.update.withPlaywrightInstall;
            break;
          case 8:
            next.options.update.skipDoctor = !next.options.update.skipDoctor;
            break;
          default:
            break;
        }
        ensureAnySetupComponent({ options: { setup: next.options.update } });
        return next;
      }
      if (action === 'enter') {
        if (next.cursor === 9) {
          return { ...next, screen: 'skill-picker', skillPickerAction: 'update', cursor: 0 };
        }
        if (next.cursor === 10) {
          return { ...next, screen: 'confirm', cursor: 0, confirmAction: 'update' };
        }
        if (next.cursor === 11) {
          return { ...next, screen: 'main', cursor: 0 };
        }
      }
      return next;
    }
    case 'uninstall': {
      if (action === 'back') return { ...next, screen: 'main', cursor: 0 };
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, 8);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, 8);
      if (action === 'space' || action === 'right') {
        switch (next.cursor) {
          case 0:
            next.options.uninstall.components.browser = !next.options.uninstall.components.browser;
            break;
          case 1:
            next.options.uninstall.components.shell = !next.options.uninstall.components.shell;
            break;
          case 2:
            next.options.uninstall.components.skills = !next.options.uninstall.components.skills;
            break;
          case 3:
            next.options.uninstall.components.superpowers = !next.options.uninstall.components.superpowers;
            break;
          case 4:
            next.options.uninstall.scope = cycle(SCOPE_OPTIONS, next.options.uninstall.scope);
            syncSelectedSkills(next.options.uninstall, next.catalogSkills);
            break;
          case 5:
            next.options.uninstall.client = cycle(CLIENT_OPTIONS, next.options.uninstall.client);
            syncSelectedSkills(next.options.uninstall, next.catalogSkills);
            break;
          default:
            break;
        }
        ensureAnyUninstallComponent(next);
        return next;
      }
      if (action === 'enter') {
        if (next.cursor === 6) {
          return { ...next, screen: 'skill-picker', skillPickerAction: 'uninstall', cursor: 0 };
        }
        if (next.cursor === 7) {
          return { ...next, screen: 'confirm', cursor: 0, confirmAction: 'uninstall' };
        }
        if (next.cursor === 8) {
          return { ...next, screen: 'main', cursor: 0 };
        }
      }
      return next;
    }
    case 'doctor': {
      if (action === 'back') return { ...next, screen: 'main', cursor: 0 };
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, 3);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, 3);
      if (action === 'space' || action === 'right') {
        if (next.cursor === 0) next.options.doctor.strict = !next.options.doctor.strict;
        if (next.cursor === 1) next.options.doctor.globalSecurity = !next.options.doctor.globalSecurity;
        return next;
      }
      if (action === 'enter') {
        if (next.cursor === 2) {
          return { ...next, screen: 'confirm', cursor: 0, confirmAction: 'doctor' };
        }
        if (next.cursor === 3) {
          return { ...next, screen: 'main', cursor: 0 };
        }
      }
      return next;
    }
    case 'skill-picker': {
      const picker = getSkillPickerActionState(next);
      const maxCursor = picker.skills.length;
      if (action === 'back') {
        return { ...next, screen: next.skillPickerAction, cursor: 0 };
      }
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, maxCursor);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, maxCursor);
      if (action === 'space' || action === 'right' || action === 'enter') {
        if (next.cursor === maxCursor) {
          return { ...next, screen: next.skillPickerAction, cursor: 0 };
        }

        const option = next.options[next.skillPickerAction];
        const skillName = picker.skills[next.cursor];
        const selected = new Set(option.selectedSkills || []);
        if (selected.has(skillName)) {
          selected.delete(skillName);
        } else {
          selected.add(skillName);
        }
        option.selectedSkills = [...selected];
        return next;
      }
      return next;
    }
    case 'confirm': {
      if (action === 'back') {
        return { ...next, screen: next.confirmAction, cursor: 0 };
      }
      if (action === 'up') return withCursor({ ...next, cursor: next.cursor - 1 }, 1);
      if (action === 'down') return withCursor({ ...next, cursor: next.cursor + 1 }, 1);
      if (action === 'enter') {
        if (next.cursor === 0) {
          const request = buildRunRequest(next, next.confirmAction);
          return {
            ...next,
            screen: 'main',
            cursor: 0,
            shouldRun: request,
          };
        }
        return { ...next, screen: next.confirmAction, cursor: 0 };
      }
      return next;
    }
    default:
      return next;
  }
}
