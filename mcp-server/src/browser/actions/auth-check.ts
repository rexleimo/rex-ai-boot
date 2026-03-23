import { browserLauncher } from '../launcher.js';
import { detectAuthRequired, detectChallengeRequired } from '../auth.js';

export function normalizeRlAuthState(result: {
  auth?: { requiresHumanLogin?: boolean };
  challenge?: { requiresHumanVerification?: boolean };
}) {
  if (result?.auth?.requiresHumanLogin) {
    return 'login_required';
  }
  if (result?.challenge?.requiresHumanVerification) {
    return 'unknown';
  }
  return 'authenticated';
}

export async function authCheck(profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const [auth, challenge] = await Promise.all([
    detectAuthRequired(page),
    detectChallengeRequired(page),
  ]);
  return {
    success: true,
    profile,
    auth,
    challenge,
    rlAuthState: normalizeRlAuthState({ auth, challenge }),
    requiresHumanAction: auth.requiresHumanLogin || challenge.requiresHumanVerification,
  };
}
