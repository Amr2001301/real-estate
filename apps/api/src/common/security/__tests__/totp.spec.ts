import { base32Decode, base32Encode, hashRecoveryCode, hotp, newRecoveryCodes, newTotpSecret, openSecret, otpauthUrl, sealSecret, totpStep, verifyTotp } from '../totp';

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 appendix B, SHA1 seed "12345678901234567890", last 6 digits.
  const seed = base32Encode(Buffer.from('12345678901234567890'));
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('at %i s the code is %s', (t, code) => {
    expect(hotp(base32Decode(seed), Math.floor(t / 30))).toBe(code);
    expect(verifyTotp(seed, code, null, t * 1000)).toBe(Math.floor(t / 30));
  });

  it('base32 round-trips', () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it('accepts one step of clock drift either side, not two', () => {
    const at = 1_700_000_000_000;
    const secret = base32Decode(seed);
    const step = totpStep(at);
    expect(verifyTotp(seed, hotp(secret, step - 1), null, at)).toBe(step - 1);
    expect(verifyTotp(seed, hotp(secret, step + 1), null, at)).toBe(step + 1);
    expect(verifyTotp(seed, hotp(secret, step - 2), null, at)).toBeNull();
    expect(verifyTotp(seed, 'abcdef', null, at)).toBeNull();
  });

  it('refuses a code from a step already used', () => {
    const at = 1_700_000_000_000;
    const step = totpStep(at);
    const code = hotp(base32Decode(seed), step);
    expect(verifyTotp(seed, code, step, at)).toBeNull();
    expect(verifyTotp(seed, code, step - 1, at)).toBe(step);
  });

  it('seals and opens the secret; another key cannot', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'material-a');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(openSecret(sealed, 'material-a')).toBe('JBSWY3DPEHPK3PXP');
    expect(() => openSecret(sealed, 'material-b')).toThrow();
  });

  it('builds the otpauth link the apps scan', () => {
    expect(otpauthUrl('ABC', 'a@b.com', 'Devora')).toBe('otpauth://totp/Devora%3Aa%40b.com?secret=ABC&issuer=Devora&algorithm=SHA1&digits=6&period=30');
  });

  it('recovery codes are unique and hash the same however typed', () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(hashRecoveryCode(` ${codes[0]!.toUpperCase()} `)).toBe(hashRecoveryCode(codes[0]!));
  });
});
