export const SKILL_PICKER_PAGE_SIZE = 6;
const DEFAULT_VIEWPORT_ROWS = 24;

export function shouldShowSkillDescriptions(owner) {
  return owner !== 'uninstall';
}

export function getSkillPickerPageSize({ viewportRows = DEFAULT_VIEWPORT_ROWS, owner = '' } = {}) {
  const safeRows = Math.max(12, Number(viewportRows) || DEFAULT_VIEWPORT_ROWS);
  const showDescriptions = shouldShowSkillDescriptions(owner);
  const reservedRows = 11;
  const groupHeaderBudget = 2;
  const itemHeight = showDescriptions ? 2 : 1;
  const availableRows = Math.max(itemHeight, safeRows - reservedRows - groupHeaderBudget);
  return Math.max(1, Math.floor(availableRows / itemHeight));
}

function skillMatchesClient(skill, client) {
  if (client === 'all') {
    return Array.isArray(skill.clients) && skill.clients.length > 0;
  }
  return Array.isArray(skill.clients) && skill.clients.includes(client);
}

function filterSkills(skills, client, scope) {
  return skills
    .filter((skill) => Array.isArray(skill.scopes) && skill.scopes.includes(scope))
    .filter((skill) => skillMatchesClient(skill, client));
}

export function getOrderedVisibleSkills(skills, client, scope) {
  const visible = filterSkills(skills, client, scope);
  const core = [];
  const optional = [];

  for (const skill of visible) {
    if (skill?.defaultInstall?.global) {
      core.push(skill);
    } else {
      optional.push(skill);
    }
  }

  return [...core, ...optional];
}

export function getOrderedVisibleSkillNames(skills, client, scope) {
  return getOrderedVisibleSkills(skills, client, scope)
    .map((skill) => skill.name)
    .filter(Boolean);
}

export function getSkillWindow(skills, scrollOffset, pageSize = SKILL_PICKER_PAGE_SIZE) {
  const total = Array.isArray(skills) ? skills.length : 0;
  const safePageSize = Math.max(1, pageSize);
  const maxOffset = Math.max(0, total - safePageSize);
  const offset = Math.max(0, Math.min(scrollOffset || 0, maxOffset));
  const visibleSkills = (skills || []).slice(offset, offset + safePageSize);

  return {
    offset,
    pageSize: safePageSize,
    total,
    start: total === 0 ? 0 : offset + 1,
    end: total === 0 ? 0 : offset + visibleSkills.length,
    visibleSkills,
  };
}

export function syncSkillPickerScroll(cursor, scrollOffset, skillCount, pageSize = SKILL_PICKER_PAGE_SIZE) {
  if (skillCount <= 0) {
    return 0;
  }

  const safePageSize = Math.max(1, pageSize);
  const maxOffset = Math.max(0, skillCount - safePageSize);
  const effectiveCursor = Math.max(0, Math.min(cursor, skillCount - 1));
  let nextOffset = Math.max(0, Math.min(scrollOffset || 0, maxOffset));

  if (effectiveCursor < nextOffset) {
    nextOffset = effectiveCursor;
  }
  if (effectiveCursor >= nextOffset + safePageSize) {
    nextOffset = effectiveCursor - safePageSize + 1;
  }

  return Math.max(0, Math.min(nextOffset, maxOffset));
}
