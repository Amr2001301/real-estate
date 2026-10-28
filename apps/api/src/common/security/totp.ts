import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * TFA1 — time-based one-time codes (RFC 6238: HMAC-SHA1, 6 digits, 30 s),
 * the codes Google Authenticator, Microsoft Authenticator and the like show.
 * The shared secret is stored encrypted (AES-256-GCM); recovery codes only as
 * hashes.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret: 20 random bytes, base32 as the apps expect. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function totpStep(at: number = Date.now()): number {
  return Math.floor(at / 1000 / STEP_SECONDS);
}

/**
 * The time step a code matches — this one, or one either side for a phone
 * clock a little off — or null. A step at or before `afterStep` (the last one
 * used) is refused, so a code seen over a shoulder cannot be used again.
 */
export function verifyTotp(secretB32: string, code: string, afterStep: number | null, at: number = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = totpStep(at);
  for (const step of [now, now - 1, now + 1]) {
    if (afterStep !== null && step <= afterStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUrl(secretB32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

// ── Secret at rest ──────────────────────────────────────────────────────────

function key(material: string): Buffer {
  return Buffer.from(hkdfSync('sha256', material, 'rep-totp', 'totp-secret-v1', 32));
}

/** `v1.<iv>.<tag>.<ciphertext>`, base64url parts. */
export function sealSecret(plain: string, material: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(material), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function openSecret(sealed: string, material: string): string {
  const [v, iv, tag, enc] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Unreadable secret');
  const d = createDecipheriv('aes-256-gcm', key(material), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}

// ── Recovery codes ──────────────────────────────────────────────────────────

/** Ten one-use codes like `k7m2-9xq4`; shown once, stored as hashes. */
export function newRecoveryCodes(n = 10): string[] {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase().replace(/\s+/g, '')).digest('hex');
}
