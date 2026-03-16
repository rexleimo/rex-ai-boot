function renderCheckbox(label, checked, active) {
  const prefix = active ? '▸' : ' ';
  const mark = checked ? '[x]' : '[ ]';
  return `${prefix} ${mark} ${label}`;
}

function renderItem(label, active) {
  return `${active ? '▸' : ' '} ${label}`;
}

function renderValue(label, value, active) {
  return `${active ? '▸' : ' '} ${label}: ${value}`;
}

function renderDescription(text) {
  return `      ${text}`;
}

function truncateDescription(text, maxLength = 56) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function installedSkillNames(installedSkills, client, scope) {
  const scopeMap = installedSkills?.[scope] || {};
  if (client === 'all') {
    return [...new Set(Object.values(scopeMap).flatMap((items) => Array.isArray(items) ? items : []))];
  }
  return Array.isArray(scopeMap[client]) ? scopeMap[client] : [];
}

function renderSelectedSkills(selectedSkills) {
  if (!Array.isArray(selectedSkills) || selectedSkills.length === 0) {
    return '<none>';
  }
  if (selectedSkills.length <= 3) {
    return selectedSkills.join(',');
  }
  return `${selectedSkills.length} selected`;
}

function joinSelected(components) {
  return Object.entries(components)
    .filter(([, selected]) => selected)
    .map(([name]) => name)
    .join(',') || '<none>';
}

function splitSkillGroups(skills) {
  const core = [];
  const optional = [];
  for (const skill of skills) {
    if (skill?.defaultInstall?.global) {
      core.push(skill);
    } else {
      optional.push(skill);
    }
  }
  return { core, optional };
}

function renderSkillSection(lines, skills, options, stateCursor, startIndex, title) {
  if (skills.length === 0) {
    return startIndex;
  }
  lines.push(title);
  let cursorIndex = startIndex;
  for (const skill of skills) {
    lines.push(renderCheckbox(skill.name, Array.isArray(options?.selectedSkills) && options.selectedSkills.includes(skill.name), stateCursor === cursorIndex));
    if (skill.description) {
      lines.push(renderDescription(truncateDescription(skill.description)));
    }
    cursorIndex += 1;
  }
  return cursorIndex;
}

export function renderState(state, rootDir) {
  const lines = [
    'AIOS — Unified Entry (Node TUI)',
    `Repo: ${rootDir}`,
    'Use ↑/↓ to move, SPACE to toggle, ENTER to confirm, B to back, Q to quit',
    '',
  ];

  if (state.screen === 'main') {
    const items = ['Setup', 'Update', 'Uninstall', 'Doctor', 'Exit'];
    items.forEach((item, index) => lines.push(renderItem(item, state.cursor === index)));
    return `${lines.join('\n')}\n`;
  }

  if (state.screen === 'setup') {
    const opts = state.options.setup;
    lines.push('Setup configuration', '');
    lines.push(renderCheckbox('Browser MCP', opts.components.browser, state.cursor === 0));
    lines.push(renderCheckbox('Shell wrappers', opts.components.shell, state.cursor === 1));
    lines.push(renderCheckbox('Skills', opts.components.skills, state.cursor === 2));
    lines.push(renderCheckbox('Superpowers', opts.components.superpowers, state.cursor === 3));
    lines.push(renderValue('Mode', opts.wrapMode, state.cursor === 4));
    lines.push(renderValue('Skills scope', opts.scope, state.cursor === 5));
    lines.push(renderValue('Client', opts.client, state.cursor === 6));
    lines.push(renderCheckbox('Skip Playwright install', opts.skipPlaywrightInstall, state.cursor === 7));
    lines.push(renderCheckbox('Skip doctor', opts.skipDoctor, state.cursor === 8));
    lines.push(renderValue('Selected skills', renderSelectedSkills(opts.selectedSkills), state.cursor === 9));
    lines.push(renderItem('Run setup', state.cursor === 10));
    lines.push(renderItem('Back', state.cursor === 11));
    return `${lines.join('\n')}\n`;
  }

  if (state.screen === 'update') {
    const opts = state.options.update;
    lines.push('Update configuration', '');
    lines.push(renderCheckbox('Browser MCP', opts.components.browser, state.cursor === 0));
    lines.push(renderCheckbox('Shell wrappers', opts.components.shell, state.cursor === 1));
    lines.push(renderCheckbox('Skills', opts.components.skills, state.cursor === 2));
    lines.push(renderCheckbox('Superpowers', opts.components.superpowers, state.cursor === 3));
    lines.push(renderValue('Mode', opts.wrapMode, state.cursor === 4));
    lines.push(renderValue('Skills scope', opts.scope, state.cursor === 5));
    lines.push(renderValue('Client', opts.client, state.cursor === 6));
    lines.push(renderCheckbox('With Playwright install', opts.withPlaywrightInstall, state.cursor === 7));
    lines.push(renderCheckbox('Skip doctor', opts.skipDoctor, state.cursor === 8));
    lines.push(renderValue('Selected skills', renderSelectedSkills(opts.selectedSkills), state.cursor === 9));
    lines.push(renderItem('Run update', state.cursor === 10));
    lines.push(renderItem('Back', state.cursor === 11));
    return `${lines.join('\n')}\n`;
  }

  if (state.screen === 'uninstall') {
    const opts = state.options.uninstall;
    lines.push('Uninstall configuration', '');
    lines.push(renderCheckbox('Browser MCP', opts.components.browser, state.cursor === 0));
    lines.push(renderCheckbox('Shell wrappers', opts.components.shell, state.cursor === 1));
    lines.push(renderCheckbox('Skills', opts.components.skills, state.cursor === 2));
    lines.push(renderCheckbox('Superpowers', opts.components.superpowers, state.cursor === 3));
    lines.push(renderValue('Skills scope', opts.scope, state.cursor === 4));
    lines.push(renderValue('Client', opts.client, state.cursor === 5));
    lines.push(renderValue('Selected skills', renderSelectedSkills(opts.selectedSkills), state.cursor === 6));
    lines.push(renderItem('Run uninstall', state.cursor === 7));
    lines.push(renderItem('Back', state.cursor === 8));
    return `${lines.join('\n')}\n`;
  }

  if (state.screen === 'doctor') {
    const opts = state.options.doctor;
    lines.push('Doctor configuration', '');
    lines.push(renderCheckbox('Strict', opts.strict, state.cursor === 0));
    lines.push(renderCheckbox('Global security scan', opts.globalSecurity, state.cursor === 1));
    lines.push(renderItem('Run doctor', state.cursor === 2));
    lines.push(renderItem('Back', state.cursor === 3));
    return `${lines.join('\n')}\n`;
  }

  if (state.screen === 'confirm') {
    const action = state.confirmAction;
    const options = action ? state.options[action] : {};
    lines.push(`Confirm ${action}`, '');
    if (options.components) {
      lines.push(`Selected components: ${joinSelected(options.components)}`);
    }
    if (options.wrapMode) {
      lines.push(`Mode: ${options.wrapMode}`);
    }
    if (options.client) {
      lines.push(`Client: ${options.client}`);
    }
    if (options.scope) {
      lines.push(`Scope: ${options.scope}`);
    }
    if (Array.isArray(options.selectedSkills)) {
      lines.push(`Selected skills: ${renderSelectedSkills(options.selectedSkills)}`);
    }
    if (action === 'doctor') {
      lines.push(`Strict: ${options.strict ? 'true' : 'false'}`);
      lines.push(`Global security: ${options.globalSecurity ? 'true' : 'false'}`);
    }
    lines.push('');
    lines.push(renderItem(`Run ${action}`, state.cursor === 0));
    lines.push(renderItem('Back', state.cursor === 1));
    return `${lines.join('\n')}\n`;
  }

  if (state.screen === 'skill-picker') {
    const owner = state.skillPickerAction;
    const options = owner ? state.options[owner] : null;
    const skills = owner && options
      ? state.catalogSkills
        .filter((skill) => Array.isArray(skill.scopes) && skill.scopes.includes(options.scope))
        .filter((skill) => options.client === 'all' || (Array.isArray(skill.clients) && skill.clients.includes(options.client)))
        .filter((skill) => owner !== 'uninstall' || installedSkillNames(state.installedSkills, options.client, options.scope).includes(skill.name))
      : [];
    lines.push(`Select skills for ${owner || 'unknown'}`, '');
    if (skills.length === 0 && owner === 'uninstall') {
      lines.push('No installed skills for current scope/client');
    }
    const groups = splitSkillGroups(skills);
    let cursorIndex = 0;
    cursorIndex = renderSkillSection(lines, groups.core, options, state.cursor, cursorIndex, 'Core');
    cursorIndex = renderSkillSection(lines, groups.optional, options, state.cursor, cursorIndex, 'Optional');
    if (skills.length === 0 && owner !== 'uninstall') {
      lines.push('No skills available for current scope/client');
    }
    lines.push(renderItem('Done', state.cursor === skills.length));
    return `${lines.join('\n')}\n`;
  }

  return `${lines.join('\n')}\n`;
}
