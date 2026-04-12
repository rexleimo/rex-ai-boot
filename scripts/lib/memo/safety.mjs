const INVISIBLE_UNICODE_CHARS = [
  '\u200B',
  '\u200C',
  '\u200D',
  '\u2060',
  '\uFEFF',
  '\u202A',
  '\u202B',
  '\u202C',
  '\u202D',
  '\u202E',
];

const THREAT_PATTERNS = [
  {
    id: 'prompt-injection',
    pattern: /ignore\s+(previous|all|above|prior)\s+instructions/i,
    reason: 'contains instruction-override prompt injection text',
  },
  {
    id: 'system-prompt-override',
    pattern: /system\s+prompt\s+override/i,
    reason: 'contains system-prompt override text',
  },
  {
    id: 'deception-hide',
    pattern: /do\s+not\s+tell\s+the\s+user/i,
    reason: 'contains deceptive concealment instruction',
  },
  {
    id: 'secret-exfiltration-curl',
    pattern: /curl\s+[^\n]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/i,
    reason: 'contains curl command that appears to exfiltrate secrets',
  },
  {
    id: 'secret-exfiltration-wget',
    pattern: /wget\s+[^\n]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/i,
    reason: 'contains wget command that appears to exfiltrate secrets',
  },
  {
    id: 'ssh-backdoor',
    pattern: /authorized_keys|~\/\.ssh|\$HOME\/\.ssh/i,
    reason: 'contains ssh credential/backdoor targeting text',
  },
];

export function scanWorkspaceMemoryContent(content = '', { allowEmpty = false } = {}) {
  const text = String(content ?? '');
  if (!allowEmpty && text.trim().length === 0) {
    return {
      ok: false,
      id: 'empty-content',
      reason: 'content is empty',
    };
  }

  for (const char of INVISIBLE_UNICODE_CHARS) {
    if (!text.includes(char)) continue;
    return {
      ok: false,
      id: 'invisible-unicode',
      reason: `contains invisible unicode character U+${char.codePointAt(0).toString(16).toUpperCase()}`,
    };
  }

  for (const entry of THREAT_PATTERNS) {
    if (!entry.pattern.test(text)) continue;
    return {
      ok: false,
      id: entry.id,
      reason: entry.reason,
    };
  }

  return {
    ok: true,
    id: 'ok',
    reason: '',
  };
}

export function assertWorkspaceMemoryContentSafe(content = '', { allowEmpty = false, target = 'memory content' } = {}) {
  const result = scanWorkspaceMemoryContent(content, { allowEmpty });
  if (result.ok) return;
  const error = new Error(`Blocked unsafe ${target}: ${result.reason} (${result.id})`);
  error.code = 'AIOS_MEMO_UNSAFE_CONTENT';
  throw error;
}
