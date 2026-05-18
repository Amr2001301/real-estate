/**
 * List of field-name fragments whose values must never be written to the
 * AuditLog or any other persisted log. Matching is case-insensitive and
 * substring — `passwordHash` matches `password`, `refreshToken` matches
 * `token`, `apiKey` matches `key`, etc.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'idtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'otp',
  'pin',
  'apikey',
  'apisecret',
];

const MASK = '***REDACTED***';
const MAX_DEPTH = 8;

function shouldMask(key: string): boolean {
  const lc = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((frag) => lc.includes(frag));
}

/**
 * Returns a deep-cloned copy of `value` with any property whose name matches a
 * sensitive fragment replaced by a redaction marker. The original input is
 * never mutated.
 *
 * Used by AuditInterceptor (and any future log writer) before persisting a
 * request/response payload.
 */
export function maskSensitiveFields<T = unknown>(value: T, depth = 0): T {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    return value.map((v) => maskSensitiveFields(v, depth + 1)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (shouldMask(k)) {
        out[k] = MASK;
        continue;
      }
      out[k] = maskSensitiveFields(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
