export async function evaluatePolicy(_userInput, _context) {
  // TODO: integrate with rl-core policy model when loaded
  return { shouldLoad: false, reason: 'rl:unavailable' };
}
