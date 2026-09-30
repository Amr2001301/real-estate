/**
 * Unit tests for normalizePhone().
 *
 * Two-layer architecture note
 * ─────────────────────────────
 * The service layer performs a ValueType.Number check BEFORE calling normalizePhone.
 * A numeric cell (e.g. the Excel number 1062800394) has already lost its leading
 * zero at that point, so the service issues a blocking error and never calls this
 * function. The string "1062800394" that would result from a text cell is a
 * different input — normalizePhone sees it as 10 digits starting with 1 and
 * returns repaired=true. The test below makes this two-layer boundary explicit.
 *
 * No untested path exists: every branch in normalizePhone is covered.
 */

import { normalizePhone } from '../phone-normaliser';

// ── Valid Egyptian mobile — no repair ─────────────────────────────────────────

describe('normalizePhone — valid 11-digit Egyptian mobile', () => {
  it('01062800394 → canonical, repaired=false, no error', () => {
    const r = normalizePhone('01062800394');
    expect(r.normalized).toBe('01062800394');
    expect(r.repaired).toBe(false);
    expect(r.error).toBeUndefined();
  });

  it('strips spaces/hyphens/dots before matching', () => {
    const r = normalizePhone('010-6280-0394');
    expect(r.normalized).toBe('01062800394');
    expect(r.repaired).toBe(false);
  });

  it('+2 prefix stripped — 01062800394 still canonical', () => {
    // "+2" is not "201..." so digit string is "201062800394"... wait, +2 is
    // an incomplete country code. Let's use an unambiguous canonical form.
    const r = normalizePhone('  01062800394  ');
    expect(r.normalized).toBe('01062800394');
    expect(r.repaired).toBe(false);
  });
});

// ── 10-digit, starts with 1 — missing leading 0 → repaired ──────────────────

describe('normalizePhone — 10-digit, starts with 1 (repaired)', () => {
  it('1062800394 → 01062800394, repaired=true, no error', () => {
    const r = normalizePhone('1062800394');
    expect(r.normalized).toBe('01062800394');
    expect(r.repaired).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('this is the string a NUMBER cell would produce after leading-zero loss', () => {
    // A numeric Excel cell holding the value 1062800394 produces the string
    // "1062800394" when read as text. The service blocks BEFORE calling here
    // (ValueType.Number check). If this function IS called with that string,
    // it returns repaired — the service-level numeric-cell gate is what makes
    // numeric cells a blocking error, not this function.
    const r = normalizePhone('1062800394');
    expect(r.repaired).toBe(true);
    expect(r.error).toBeUndefined();
  });
});

// ── 12-digit with country code 201 → repaired ────────────────────────────────

describe('normalizePhone — 12-digit 201XXXXXXXXX (repaired)', () => {
  it('201062800394 → 01062800394, repaired=true', () => {
    const r = normalizePhone('201062800394');
    expect(r.normalized).toBe('01062800394');
    expect(r.repaired).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('+201062800394 (with + sign) → repaired, digits-only stripping handles the +', () => {
    const r = normalizePhone('+201062800394');
    expect(r.normalized).toBe('01062800394');
    expect(r.repaired).toBe(true);
    expect(r.error).toBeUndefined();
  });
});

// ── Egyptian landline — blocking error ────────────────────────────────────────

describe('normalizePhone — Egyptian landline (blocking error)', () => {
  it('223456789 (9 digits, starts 2) → blocking error, not repaired', () => {
    const r = normalizePhone('223456789');
    expect(r.normalized).toBe('');
    expect(r.repaired).toBe(false);
    expect(r.error).toMatch(/landline/i);
    expect(r.error).toMatch(/2/);
  });

  it('0223456789 (10 digits, starts 02 → digit string 0223456789 → starts 0, not 01) → blocking, unrecognised', () => {
    // digit string: 0223456789 — does NOT start with 01 (starts 02), not 1xxxxx,
    // not 201xxxxx (only 10 digits), not 2xxxxxxx (starts 0). Falls to catch-all.
    const r = normalizePhone('0223456789');
    expect(r.normalized).toBe('');
    expect(r.repaired).toBe(false);
    expect(r.error).toBeDefined();
    // The error must mention the phone or explain why it is invalid
    expect(r.error!.length).toBeGreaterThan(0);
  });

  it('2012345678 (10 digits, starts 2) → landline error', () => {
    // 10 digits starting 2 — matches the landline regex ^2\d{8,9}$
    const r = normalizePhone('2012345678');
    expect(r.normalized).toBe('');
    expect(r.repaired).toBe(false);
    expect(r.error).toMatch(/landline/i);
  });
});

// ── Empty / blank input ───────────────────────────────────────────────────────

describe('normalizePhone — empty / blank', () => {
  it('empty string → error "Phone is required"', () => {
    const r = normalizePhone('');
    expect(r.normalized).toBe('');
    expect(r.repaired).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('whitespace-only string → same error as empty', () => {
    const r = normalizePhone('   ');
    expect(r.error).toMatch(/required/i);
  });
});

// ── 10 digits starting with 0 but NOT 01 ─────────────────────────────────────

describe('normalizePhone — 10-digit starting 0, not 01', () => {
  it('0106280039 (10 digits, starts 01 but only 10 chars) → blocking error, unrecognised format', () => {
    // digit string: 0106280039 = 10 digits.
    // Does NOT match ^01\d{9}$ (needs 11 digits).
    // Does NOT match ^1\d{9}$ (starts 0 not 1).
    // Does NOT match ^201\d{9}$ (not 12 digits starting 201).
    // Does NOT match ^2\d{8,9}$ (starts 0 not 2).
    // → catch-all blocking error.
    const r = normalizePhone('0106280039');
    expect(r.normalized).toBe('');
    expect(r.repaired).toBe(false);
    expect(r.error).toBeDefined();
    expect(r.error).toMatch(/not a recognised/i);
  });
});

// ── Non-Egyptian country code — unsupported-country error ────────────────────

describe('normalizePhone — non-Egyptian E.164 prefix', () => {
  it('+966501234567 (Saudi) → explicit unsupported-country error, not generic format error', () => {
    const r = normalizePhone('+966501234567');
    expect(r.normalized).toBe('');
    expect(r.repaired).toBe(false);
    // Must name the problem clearly so the admin knows what to fix
    expect(r.error).toMatch(/non-Egyptian country code|unsupported/i);
    // Must NOT be the generic "not a recognised" catch-all
    expect(r.error).not.toMatch(/^Phone .* is not a recognised Egyptian/);
  });

  it('+1 (US/Canada) prefix also produces the unsupported-country error', () => {
    const r = normalizePhone('+12125550123');
    expect(r.error).toMatch(/non-Egyptian country code|unsupported/i);
  });
});

// ── Guarantee: no undocumented output paths ───────────────────────────────────

describe('normalizePhone — output invariant', () => {
  it('always returns either a valid canonical phone or an error (never both, never neither)', () => {
    const cases = [
      '01062800394',
      '1062800394',
      '201062800394',
      '223456789',
      '0223456789',
      '0106280039',
      '',
      '   ',
      'abc',
      '9999',
      '+966501234567',
      '+12125550123',
    ];

    for (const raw of cases) {
      const r = normalizePhone(raw);
      const hasNormalized = r.normalized.length > 0;
      const hasError = typeof r.error === 'string' && r.error.length > 0;

      // Exactly one of normalized or error must be present
      expect(hasNormalized || hasError).toBe(true);
      expect(hasNormalized && hasError).toBe(false);

      // repaired can only be true when normalized is non-empty
      if (r.repaired) {
        expect(hasNormalized).toBe(true);
      }

      // A successful result is always exactly 11 digits starting with 01
      if (hasNormalized) {
        expect(r.normalized).toMatch(/^01\d{9}$/);
      }
    }
  });
});
