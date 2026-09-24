/**
 * Unit tests for src/lib/branding.ts
 *
 * Coverage:
 *   §1  hexToRgbVars — valid 6-digit hex → space-separated channels
 *   §2  hexToRgbVars — case-insensitive
 *   §3  hexToRgbVars — leading/trailing whitespace stripped
 *   §4  hexToRgbVars — invalid inputs return null
 *   §5  fetchBranding — empty slug returns null without fetching
 *   §6  fetchBranding — 200 response returns parsed body
 *   §7  fetchBranding — non-200 response returns null
 *   §8  fetchBranding — network error returns null
 *   §9  fetchBranding — fetch called with revalidate:300 (data cache TTL)
 *   §10 fetchBranding — fetch called with correct URL and slug encoding
 */

import { hexToRgbVars, fetchBranding } from '../lib/branding';
import type { BrandingData } from '../lib/branding';

// ── hexToRgbVars ─────────────────────────────────────────────────────────────

describe('hexToRgbVars', () => {
  test('§1 — navy #0F1E33 → "15 30 51"', () => {
    expect(hexToRgbVars('#0F1E33')).toBe('15 30 51');
  });

  test('§1 — gold #C8A24B → "200 162 75"', () => {
    expect(hexToRgbVars('#C8A24B')).toBe('200 162 75');
  });

  test('§1 — pure white #FFFFFF → "255 255 255"', () => {
    expect(hexToRgbVars('#FFFFFF')).toBe('255 255 255');
  });

  test('§1 — pure black #000000 → "0 0 0"', () => {
    expect(hexToRgbVars('#000000')).toBe('0 0 0');
  });

  test('§2 — lowercase hex accepted', () => {
    expect(hexToRgbVars('#0f1e33')).toBe('15 30 51');
  });

  test('§2 — mixed case hex accepted', () => {
    expect(hexToRgbVars('#C8a24b')).toBe('200 162 75');
  });

  test('§3 — leading/trailing whitespace stripped', () => {
    expect(hexToRgbVars('  #0F1E33  ')).toBe('15 30 51');
  });

  test('§4 — missing # prefix → null', () => {
    expect(hexToRgbVars('0F1E33')).toBeNull();
  });

  test('§4 — 3-digit shorthand → null (only 6-digit supported)', () => {
    expect(hexToRgbVars('#FFF')).toBeNull();
  });

  test('§4 — empty string → null', () => {
    expect(hexToRgbVars('')).toBeNull();
  });

  test('§4 — non-hex characters → null', () => {
    expect(hexToRgbVars('#ZZZZZZ')).toBeNull();
  });

  test('§4 — 8-digit with alpha → null (only 6-digit supported)', () => {
    expect(hexToRgbVars('#0F1E33FF')).toBeNull();
  });
});

// ── fetchBranding ─────────────────────────────────────────────────────────────

const BRANDING_FIXTURE: BrandingData = {
  slug: 'acme',
  name: 'Acme Real Estate',
  displayName: 'Acme',
  primaryColor: '#1E3A5F',
  accentColor: '#C8A24B',
  logoUrl: 'https://cdn.example.com/logo.png',
  contactEmail: 'info@acme.sa',
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('fetchBranding', () => {
  test('§5 — empty slug returns null without calling fetch', async () => {
    global.fetch = jest.fn();
    const result = await fetchBranding('');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('§6 — 200 response returns parsed JSON body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => BRANDING_FIXTURE,
    });
    const result = await fetchBranding('acme');
    expect(result).toEqual(BRANDING_FIXTURE);
  });

  test('§7 — 404 response returns null', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await fetchBranding('unknown')).toBeNull();
  });

  test('§7 — 500 response returns null', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    expect(await fetchBranding('acme')).toBeNull();
  });

  test('§8 — network error returns null (never throws)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(fetchBranding('acme')).resolves.toBeNull();
  });

  test('§8 — timeout (AbortError) returns null (never throws)', async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('Timeout'), { name: 'AbortError' }));
    await expect(fetchBranding('acme')).resolves.toBeNull();
  });

  test('§9 — fetch called with next.revalidate = 300', async () => {
    let capturedInit: RequestInit & { next?: { revalidate?: number } } | undefined;
    global.fetch = jest.fn().mockImplementation((_url: string, init: typeof capturedInit) => {
      capturedInit = init;
      return Promise.resolve({ ok: true, json: async () => BRANDING_FIXTURE });
    });
    await fetchBranding('acme');
    expect((capturedInit as { next?: { revalidate?: number } })?.next?.revalidate).toBe(300);
  });

  test('§10 — slug encoded in URL', async () => {
    let capturedUrl: string | undefined;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: async () => BRANDING_FIXTURE });
    });
    await fetchBranding('my tenant');
    expect(capturedUrl).toContain('slug=my%20tenant');
  });

  test('§10 — URL targets /v1/public/branding endpoint', async () => {
    let capturedUrl: string | undefined;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: async () => BRANDING_FIXTURE });
    });
    await fetchBranding('acme');
    expect(capturedUrl).toContain('/v1/public/branding');
    expect(capturedUrl).toContain('slug=acme');
  });
});
