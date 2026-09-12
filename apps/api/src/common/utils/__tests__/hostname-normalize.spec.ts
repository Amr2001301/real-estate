/**
 * MT-046 — normalizeHostname unit tests
 */

import { normalizeHostname, InvalidHostnameError } from '../hostname-normalize';

describe('normalizeHostname — valid inputs', () => {
  test.each([
    ['acme.example.com', 'acme.example.com'],
    ['ACME.EXAMPLE.COM', 'acme.example.com'],
    ['  acme.example.com  ', 'acme.example.com'],
    ['acme.example.com.', 'acme.example.com'],       // trailing dot (DNS FQDN)
    ['www.acme.example.com', 'acme.example.com'],    // www stripped
    ['acme.example.com:443', 'acme.example.com'],    // port stripped
    ['acme.example.com:8080', 'acme.example.com'],
    ['sub.sub.acme.example.com', 'sub.sub.acme.example.com'],
    ['acme-corp.example.com', 'acme-corp.example.com'],
    ['xn--n3h.example.com', 'xn--n3h.example.com'], // punycode label
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected);
  });
});

describe('normalizeHostname — rejected inputs', () => {
  const rejectedInputs: Array<string | null | undefined> = [
    '',
    null,
    undefined,
    'https://acme.example.com',
    'http://acme.example.com',
    'acme.example.com/path',
    'acme.example.com?q=1',
    'localhost',          // single label
    'acme',
    '.acme.example.com', // empty label
    'acme..example.com', // empty label
    '-acme.example.com', // leading hyphen
    'acme-.example.com', // trailing hyphen
    'acme!.example.com', // special char
  ];

  test.each(rejectedInputs)('throws InvalidHostnameError for %s', (input) => {
    expect(() => normalizeHostname(input as string)).toThrow(InvalidHostnameError);
  });

  test('throws on hostname > 253 characters', () => {
    const long = 'a'.repeat(63) + '.' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(64) + '.com';
    expect(() => normalizeHostname(long)).toThrow(InvalidHostnameError);
  });
});

describe('normalizeHostname — www stripping is idempotent', () => {
  test('www.www.acme.com strips only the leading www.', () => {
    expect(normalizeHostname('www.www.acme.com')).toBe('www.acme.com');
  });
});

describe('normalizeHostname — Section 5: www + platform base domain collision', () => {
  test('www.platform.example.com normalizes to platform.example.com (= PLATFORM_BASE_DOMAIN)', () => {
    // This is the www collision bug: slug=www, base=platform.example.com →
    // www.platform.example.com → strips www. → platform.example.com.
    // The collision is prevented upstream by RESERVED_PLATFORM_SLUGS.has('www').
    expect(normalizeHostname('www.platform.example.com')).toBe('platform.example.com');
  });

  test('WwW.Platform.Example.Com normalizes to platform.example.com', () => {
    expect(normalizeHostname('WwW.Platform.Example.Com')).toBe('platform.example.com');
  });

  test('www stripping leaves a valid two-label hostname when base is example.com', () => {
    expect(normalizeHostname('www.example.com')).toBe('example.com');
  });
});
