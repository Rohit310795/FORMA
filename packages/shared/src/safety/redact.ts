/**
 * Redaction for logs and audit summaries. Anything that looks like a credential
 * is masked before it can be written anywhere.
 */

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g, // OpenAI-style
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g, // Anthropic-style
  /\bAIza[0-9A-Za-z_-]{20,}\b/g, // Google API keys
  /\b(?:ghp|gho|ghs)_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/gi,
  /\b(?:api[_-]?key|apikey|secret|token|password)\b(\s*[:=]\s*)["']?[^\s"',}]{6,}/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWTs
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (match, sep?: string) => {
      if (typeof sep === 'string' && /[:=]/.test(sep)) {
        const key = match.split(/[:=]/)[0];
        return `${key}${sep}[REDACTED]`;
      }
      return '[REDACTED]';
    });
  }
  return out;
}

export function maskSuffix(secret: string): string {
  const trimmed = secret.trim();
  return trimmed.length >= 12 ? `…${trimmed.slice(-4)}` : '…';
}

/** Deep-redacts an object for logging: drops known sensitive keys, masks secret-like strings. */
export function redactObject(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (typeof value === 'string') return redactSecrets(value).slice(0, 2000);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactObject(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/key|secret|token|password|authorization|credential/i.test(k)) out[k] = '[REDACTED]';
      else out[k] = redactObject(v, depth + 1);
    }
    return out;
  }
  return value;
}
