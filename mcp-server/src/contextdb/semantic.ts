export interface SemanticCandidate<T> {
  id: string;
  text: string;
  value: T;
}

export interface SemanticProvider {
  name: string;
  isAvailable(): boolean;
  rank<T>(query: string, candidates: SemanticCandidate<T>[], limit: number): Promise<SemanticCandidate<T>[]>;
}

class TokenSemanticProvider implements SemanticProvider {
  name = 'token-overlap';

  isAvailable(): boolean {
    return true;
  }

  async rank<T>(query: string, candidates: SemanticCandidate<T>[], limit: number): Promise<SemanticCandidate<T>[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return candidates.slice(0, limit);
    }

    const queryTokens = tokenize(normalizedQuery);
    const scored = candidates.map((candidate, index) => ({
      candidate,
      index,
      score: scoreText(queryTokens, candidate.text),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    return scored.slice(0, limit).map((item) => item.candidate);
  }
}

const WORD_RE = /[\p{L}\p{N}]+/gu;
const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function tokenize(text: string): string[] {
  const chunks = String(text || '').toLowerCase().match(WORD_RE) ?? [];
  const tokens: string[] = [];

  for (const chunk of chunks) {
    const token = chunk.trim();
    if (!token) continue;

    if (CJK_CHAR_RE.test(token)) {
      const chars = Array.from(token).filter((char) => CJK_CHAR_RE.test(char));
      if (chars.length === 1) {
        tokens.push(chars[0]);
        continue;
      }
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.push(`${chars[index]}${chars[index + 1]}`);
      }
      if (token.length <= 8) {
        tokens.push(token);
      }
      continue;
    }

    if (token.length >= 2) {
      tokens.push(token);
    }
  }

  return Array.from(new Set(tokens));
}

function scoreText(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const textTokens = new Set(tokenize(text));
  let overlap = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      overlap += 1;
    }
  }

  const unionSize = new Set([...queryTokens, ...textTokens]).size || 1;
  const jaccard = overlap / unionSize;
  const containment = overlap / queryTokens.length;
  return jaccard * 0.6 + containment * 0.4;
}

function createSemanticProvider(): SemanticProvider | null {
  if (process.env.CONTEXTDB_SEMANTIC !== '1') {
    return null;
  }

  const provider = (process.env.CONTEXTDB_SEMANTIC_PROVIDER || 'token').toLowerCase();
  if (provider === 'none' || provider === 'off' || provider === 'disabled') {
    return null;
  }
  if (provider === 'token') {
    return new TokenSemanticProvider();
  }
  return null;
}

export function semanticCapabilities(): { enabled: boolean; provider: string | null; available: boolean } {
  const provider = createSemanticProvider();
  return {
    enabled: process.env.CONTEXTDB_SEMANTIC === '1',
    provider: provider?.name ?? null,
    available: provider?.isAvailable() ?? false,
  };
}

export async function semanticRerank<T>(
  query: string,
  candidates: SemanticCandidate<T>[],
  limit: number
): Promise<SemanticCandidate<T>[] | null> {
  const provider = createSemanticProvider();
  if (!provider || !provider.isAvailable()) {
    return null;
  }
  return await provider.rank(query, candidates, limit);
}
