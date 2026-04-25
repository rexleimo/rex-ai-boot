export type ContextDbRetrievalMode = 'lexical' | 'semantic' | 'hybrid' | 'tail';

export interface ContextDbSearchExplain {
  retrievalMode: ContextDbRetrievalMode;
  queryTokens: string[];
  matchedTokens: string[];
  scoreParts: {
    textMatch: number;
    semantic: number;
    recency: number;
  };
  suppressionReasons: string[];
}

const WORD_RE = /[\p{L}\p{N}]+/gu;
const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function tokenizeForExplain(text: string): string[] {
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

export function buildSearchExplain(input: {
  query?: string;
  text: string;
  retrievalMode: ContextDbRetrievalMode;
  semanticScore?: number;
  recencyScore?: number;
  suppressionReasons?: string[];
}): ContextDbSearchExplain {
  const queryTokens = tokenizeForExplain(input.query ?? '');
  const textTokens = new Set(tokenizeForExplain(input.text));
  const matchedTokens = queryTokens.filter((token) => textTokens.has(token));
  const textMatch = queryTokens.length > 0 ? matchedTokens.length / queryTokens.length : 0;

  return {
    retrievalMode: input.retrievalMode,
    queryTokens,
    matchedTokens,
    scoreParts: {
      textMatch,
      semantic: clampScore(input.semanticScore ?? 0),
      recency: clampScore(input.recencyScore ?? 0),
    },
    suppressionReasons: Array.from(new Set(input.suppressionReasons ?? [])),
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
