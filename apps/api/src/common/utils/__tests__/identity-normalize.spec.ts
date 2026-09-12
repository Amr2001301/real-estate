/**
 * MT-018 / MT-019 — Unit tests for identity-normalize.ts
 *
 * canonicalEmail — MT-018
 * canonicalPhone — MT-019 (E.164, strict no-guessing policy)
 *
 * Phone normalization policy under test:
 *   - E.164 (+ prefix): resolved without country hint — self-identifying
 *   - 00 IDD, local, national WITH explicit countryHint: resolved for that country
 *   - Any non-+ format WITHOUT countryHint: returns null (never guesses)
 *   - A number ambiguous across countries without a hint is always null
 */

import { canonicalEmail, canonicalPhone } from '../identity-normalize';

// ---------------------------------------------------------------------------
// MT-018 — canonicalEmail
// ---------------------------------------------------------------------------

describe('canonicalEmail', () => {
  it('trims leading and trailing whitespace', () => {
    expect(canonicalEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('lowercases uppercase characters', () => {
    expect(canonicalEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('trims and lowercases together', () => {
    expect(canonicalEmail('  SARA@EXAMPLE.COM  ')).toBe('sara@example.com');
  });

  it('returns the value unchanged when already canonical', () => {
    expect(canonicalEmail('user@example.com')).toBe('user@example.com');
  });

  it('returns null for null input', () => {
    expect(canonicalEmail(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(canonicalEmail(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(canonicalEmail('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(canonicalEmail('   ')).toBeNull();
  });

  it('does not strip Gmail dots (simple behaviour by design)', () => {
    expect(canonicalEmail('u.s.e.r@gmail.com')).toBe('u.s.e.r@gmail.com');
  });

  it('does not strip Gmail + aliases (simple behaviour by design)', () => {
    expect(canonicalEmail('user+tag@gmail.com')).toBe('user+tag@gmail.com');
  });
});

// ---------------------------------------------------------------------------
// MT-019 — canonicalPhone: E.164 input (+ prefix) resolves without hint
// ---------------------------------------------------------------------------

describe('canonicalPhone — E.164 format (+ prefix) resolves without country hint', () => {
  it('returns SA E.164 number unchanged', () => {
    expect(canonicalPhone('+966500000000')).toBe('+966500000000');
  });

  it('returns UAE E.164 number unchanged', () => {
    expect(canonicalPhone('+971501234567')).toBe('+971501234567');
  });

  it('returns Egyptian E.164 number unchanged', () => {
    expect(canonicalPhone('+201012345678')).toBe('+201012345678');
  });

  it('strips formatting spaces from E.164 number', () => {
    expect(canonicalPhone('+966 50 000 0000')).toBe('+966500000000');
  });

  it('strips formatting dashes from E.164 number', () => {
    expect(canonicalPhone('+966-50-000-0000')).toBe('+966500000000');
  });

  it('returns null for malformed + prefix — does not fall back to guessing', () => {
    expect(canonicalPhone('+0')).toBeNull();
  });

  it('returns null for + prefix with invalid country code', () => {
    expect(canonicalPhone('+99900000000')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MT-019 — canonicalPhone: non-E.164 format WITH explicit country hint
// ---------------------------------------------------------------------------

describe('canonicalPhone — non-E.164 format requires explicit country hint', () => {
  it('parses SA local 05xx with SA hint', () => {
    expect(canonicalPhone('0500000000', 'SA')).toBe('+966500000000');
  });

  it('parses UAE local 05xx with AE hint', () => {
    expect(canonicalPhone('0501234567', 'AE')).toBe('+971501234567');
  });

  it('parses Egyptian local 01xx with EG hint', () => {
    expect(canonicalPhone('01012345678', 'EG')).toBe('+201012345678');
  });

  it('accepts lowercase country hint', () => {
    expect(canonicalPhone('0500000000', 'sa')).toBe('+966500000000');
  });

  it('parses 00 IDD prefix with SA hint (SA IDD prefix is 00)', () => {
    expect(canonicalPhone('00966500000000', 'SA')).toBe('+966500000000');
  });

  it('parses 00 IDD prefix with AE hint', () => {
    expect(canonicalPhone('00971501234567', 'AE')).toBe('+971501234567');
  });

  it('returns null if the number is invalid for the given country', () => {
    expect(canonicalPhone('1234', 'SA')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MT-019 — canonicalPhone: non-+ format WITHOUT hint → null (no guessing)
// ---------------------------------------------------------------------------

describe('canonicalPhone — non-+ format without countryHint returns null', () => {
  it('SA local 05xx without hint returns null', () => {
    expect(canonicalPhone('0500000000')).toBeNull();
  });

  it('EG local 01xx without hint returns null', () => {
    expect(canonicalPhone('01012345678')).toBeNull();
  });

  it('AE local 05xx without hint returns null', () => {
    expect(canonicalPhone('0501234567')).toBeNull();
  });

  it('00 IDD prefix without hint returns null — IDD is not self-identifying', () => {
    // The library requires a country context to decode IDD prefixes.
    // 00966... without a hint must not be assumed to be Saudi Arabia.
    expect(canonicalPhone('00966500000000')).toBeNull();
  });

  it('ambiguous 05xx parseable under SA and AE: no hint → null', () => {
    // 0501234567 is valid local format in both SA (+966) and AE (+971).
    // Without a hint this function must not silently pick either country.
    expect(canonicalPhone('0501234567')).toBeNull();
  });

  it('digit-only string without hint returns null', () => {
    expect(canonicalPhone('5001234567')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MT-019 — canonicalPhone: null / empty / invalid input
// ---------------------------------------------------------------------------

describe('canonicalPhone — null / empty / invalid input', () => {
  it('returns null for null input', () => {
    expect(canonicalPhone(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(canonicalPhone(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(canonicalPhone('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(canonicalPhone('   ')).toBeNull();
  });

  it('returns null for alphabetic string', () => {
    expect(canonicalPhone('not-a-phone')).toBeNull();
  });

  it('returns null for too-short digit string', () => {
    expect(canonicalPhone('1234')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MT-019 — canonicalPhone: consistency across formats
// ---------------------------------------------------------------------------

describe('canonicalPhone — consistency across input formats', () => {
  it('E.164 and formatted international normalize to the same value', () => {
    const target = '+966500000000';
    expect(canonicalPhone('+966500000000')).toBe(target);
    expect(canonicalPhone('+966 50 000 0000')).toBe(target);
    expect(canonicalPhone('+966-50-000-0000')).toBe(target);
    // local with hint also reaches the same E.164
    expect(canonicalPhone('0500000000', 'SA')).toBe(target);
    // local without hint → null (never assumed)
    expect(canonicalPhone('0500000000')).toBeNull();
    // 00 IDD without hint → null
    expect(canonicalPhone('00966500000000')).toBeNull();
    // 00 IDD with SA hint → correct
    expect(canonicalPhone('00966500000000', 'SA')).toBe(target);
  });

  it('SA hint and AE hint resolve the same local digits to different E.164', () => {
    // Proves the hint is deterministic and there is no silent cascade
    const saResult = canonicalPhone('0501234567', 'SA');
    const aeResult = canonicalPhone('0501234567', 'AE');
    expect(saResult).toBe('+966501234567');
    expect(aeResult).toBe('+971501234567');
    expect(saResult).not.toBe(aeResult);
  });
});
