/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck  — noUncheckedIndexedAccess makes array[n] T|undefined; not worth fighting in tests.
/**
 * F2 — api-auth.ts 403 narrowing tests.
 *
 * Verifies that only 403 + code TENANT_CONTEXT_MISMATCH clears session cookies
 * and throws AuthError. All other 403s throw ForbiddenError without touching cookies.
 *
 * §1  403 + TENANT_CONTEXT_MISMATCH → safeClear() called, AuthError thrown
 * §2  403 + CAPABILITY_NOT_ENABLED  → cookies NOT cleared, ForbiddenError thrown
 * §3  403 + no code in body         → cookies NOT cleared, ForbiddenError thrown
 * §4  403 + message spoof ('Tenant mismatch') but code SOME_OTHER_CODE → NOT cleared
 * §5  403 + code TENANT_CONTEXT_MISMATCH with non-standard message → cleared (code wins)
 */

import { authFetch, AuthError, ForbiddenError } from '@/lib/api-auth';
import { cookies, headers } from 'next/headers';
import { clearSessionCookies } from '@/lib/auth-cookies';

jest.mock('@/lib/auth-cookies', () => ({
  setSessionCookies: jest.fn().mockResolvedValue(undefined),
  clearSessionCookies: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// next/headers mocks
// ---------------------------------------------------------------------------

const mockCookiesStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
const mockHeadersStore = { get: jest.fn() };

(cookies as jest.Mock).mockResolvedValue(mockCookiesStore);
(headers as jest.Mock).mockResolvedValue(mockHeadersStore);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mock403(body: unknown): void {
  const cloneJson = jest.fn().mockResolvedValue(body);
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: jest.fn().mockResolvedValue(body),
    clone: () => ({ json: cloneJson }),
    text: jest.fn().mockResolvedValue(''),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Simulate a valid access_token so doFetch proceeds past the cookie read.
  mockCookiesStore.get.mockReturnValue({ value: 'mock-access-token' });
  // Simulate a resolved tenant slug from F1.
  mockHeadersStore.get.mockReturnValue('some-tenant');
  // Re-apply default resolved value (clearAllMocks resets mock implementations).
  (cookies as jest.Mock).mockResolvedValue(mockCookiesStore);
  (headers as jest.Mock).mockResolvedValue(mockHeadersStore);
  (clearSessionCookies as jest.Mock).mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// §1  403 + TENANT_CONTEXT_MISMATCH → safeClear() + AuthError
// ---------------------------------------------------------------------------

test('§1 403 TENANT_CONTEXT_MISMATCH clears cookies and throws AuthError', async () => {
  mock403({ statusCode: 403, message: 'Tenant mismatch', code: 'TENANT_CONTEXT_MISMATCH' });

  await expect(authFetch('/some/endpoint')).rejects.toBeInstanceOf(AuthError);
  expect(clearSessionCookies).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// §2  403 + CAPABILITY_NOT_ENABLED → ForbiddenError, no cookie clear
// ---------------------------------------------------------------------------

test('§2 403 CAPABILITY_NOT_ENABLED throws ForbiddenError, does NOT clear cookies', async () => {
  mock403({ statusCode: 403, message: 'Capability not enabled', code: 'CAPABILITY_NOT_ENABLED' });

  const err = await authFetch('/some/endpoint').catch((e) => e);
  expect(err).toBeInstanceOf(ForbiddenError);
  expect(err).not.toBeInstanceOf(AuthError);
  expect(err.code).toBe('CAPABILITY_NOT_ENABLED');
  expect(clearSessionCookies).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// §3  403 + no code in body → ForbiddenError, no cookie clear
// ---------------------------------------------------------------------------

test('§3 403 with no code throws ForbiddenError, does NOT clear cookies', async () => {
  mock403({ statusCode: 403, message: 'Forbidden' });

  const err = await authFetch('/some/endpoint').catch((e) => e);
  expect(err).toBeInstanceOf(ForbiddenError);
  expect(err).not.toBeInstanceOf(AuthError);
  expect(err.code).toBeUndefined();
  expect(clearSessionCookies).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// §4  403 + message spoofed to 'Tenant mismatch' but code SOME_OTHER_CODE → NOT cleared
// ---------------------------------------------------------------------------

test('§4 message spoof "Tenant mismatch" without matching code does NOT clear cookies', async () => {
  mock403({ statusCode: 403, message: 'Tenant mismatch', code: 'SOME_OTHER_CODE' });

  const err = await authFetch('/some/endpoint').catch((e) => e);
  expect(err).toBeInstanceOf(ForbiddenError);
  expect(err).not.toBeInstanceOf(AuthError);
  expect(err.code).toBe('SOME_OTHER_CODE');
  expect(clearSessionCookies).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// §5  403 + code TENANT_CONTEXT_MISMATCH with non-standard message → cleared (code wins)
// ---------------------------------------------------------------------------

test('§5 code TENANT_CONTEXT_MISMATCH with non-standard message still clears cookies', async () => {
  mock403({ statusCode: 403, message: 'Access denied by policy', code: 'TENANT_CONTEXT_MISMATCH' });

  await expect(authFetch('/some/endpoint')).rejects.toBeInstanceOf(AuthError);
  expect(clearSessionCookies).toHaveBeenCalledTimes(1);
});
