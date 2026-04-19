const INDICATORS = [
  { pattern: /\bfirst\s+do\b|\bthen\b|\bnext\b|\bfinally\b|\b分几步\b/i, score: 20 },
  { pattern: /\bfrontend\b.*\bbackend\b|\bbackend\b.*\bfrontend\b|\btest\b.*\bdoc\b|\bdoc\b.*\btest\b|\bapi\b.*\bdb\b|\bdb\b.*\bapi\b/i, score: 20 },
  { pattern: /\borchestrate\b|\bharness\b|\bteam\b|\bsubagent\b|\bmulti[-\s]?agent\b|\bparallel\b/i, score: 30 },
  { pattern: /\bfeature\b|\bbugfix\b|\brefactor\b|\bsecurity\b|\bimplement\b/i, score: 15 },
  { pattern: /\b这些文件\b|\bacross\s+the\s+codebase\b|\bmulti[-\s]?file\b|\bcross[-\s]?file\b/i, score: 15 },
];

export const COMPLEXITY_THRESHOLD = 40;

export function classifyComplexity(userInput) {
  const text = String(userInput || '');
  let score = 0;
  for (const indicator of INDICATORS) {
    if (indicator.pattern.test(text)) {
      score += indicator.score;
    }
  }
  return {
    score,
    shouldLoad: score >= COMPLEXITY_THRESHOLD,
    reason: score >= COMPLEXITY_THRESHOLD ? 'complexity:high' : 'complexity:low',
  };
}
