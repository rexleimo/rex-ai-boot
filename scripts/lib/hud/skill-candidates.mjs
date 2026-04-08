function normalizeText(value) {
  return String(value ?? '').trim();
}

function clipLine(value, maxLen = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function normalizeCounter(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function formatSkillCandidateDetails(state, { limit = 6 } = {}) {
  const resolvedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 6;
  const recentCandidates = Array.isArray(state?.recentSkillCandidates)
    ? state.recentSkillCandidates
    : [];
  const fallbackLatest = state?.latestSkillCandidate && typeof state.latestSkillCandidate === 'object'
    ? [state.latestSkillCandidate]
    : [];
  const items = (recentCandidates.length > 0 ? recentCandidates : fallbackLatest).slice(0, resolvedLimit);

  const lines = ['', 'Skill Candidates:'];
  if (items.length === 0) {
    lines.push('- (none)');
    return lines.join('\n');
  }

  for (const candidate of items) {
    const skillId = normalizeText(candidate?.skillId) || 'unknown-skill';
    const scope = normalizeText(candidate?.scope) || 'general';
    const failureClass = normalizeText(candidate?.failureClass) || 'unknown';
    const lessonCount = normalizeCounter(candidate?.lessonCount);
    const reviewMode = normalizeText(candidate?.reviewMode) || 'manual';
    const reviewStatus = normalizeText(candidate?.reviewStatus) || 'candidate';
    const draftTargetId = normalizeText(candidate?.sourceDraftTargetId);
    const artifactPath = normalizeText(candidate?.artifactPath);
    const patchHint = clipLine(candidate?.patchHint, 120);

    const bits = [
      `skill=${skillId}`,
      `scope=${scope}`,
      `failure=${failureClass}`,
      lessonCount > 0 ? `lessons=${lessonCount}` : '',
      `review=${reviewMode}/${reviewStatus}`,
      draftTargetId ? `draft=${draftTargetId}` : '',
      artifactPath ? `artifact=${artifactPath}` : '',
      patchHint ? `hint="${patchHint}"` : '',
    ].filter(Boolean);
    lines.push(`- ${bits.join(' ')}`);
  }

  return lines.join('\n');
}
