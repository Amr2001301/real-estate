/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck  — noUncheckedIndexedAccess makes calls[n] → T|undefined; not worth
//               fighting in tests. The mock helper already validates call counts.
/**
 * F2 — auth-actions migration tests.
 *
 * Verifies:
 *   §5  Login: slug injected from host; browser cannot override; Company isolation
 *   §8  Registration: V2 endpoint; slug injected; no companyId in body
 *   §9  OTP: V2 endpoint; slug injected; no legacy fallback
 *   §12 Forgot password: tenant-derived; V2 endpoint
 *   §13 Reset password: no slug needed; V2 path used
 *   §25 No fallback to legacy: V2 failure → error returned, no legacy call
 *   §29 Login tests; §30 Registration tests; §31 OTP tests; §32 Password tests
 */

import {
  customerLoginAction,
  customerRegisterAction,
  otpRequestAction,
  otpVerifyAction,
  forgotPasswordAction,
  resetPasswordAction,
} from '@/lib/auth-actions';
import { cookies, headers } from 'next/headers';

// ---------------------------------------------------------------------------
// Mock next/headers (already mapped in jest.config.js)
// ---------------------------------------------------------------------------

const mockCookiesStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};
const mockHeadersStore = {
  get: jest.fn(),
};

(cookies as jest.Mock).mockResolvedValue(mockCookiesStore);
(headers as jest.Mock).mockResolvedValue(mockHeadersStore);

// ---------------------------------------------------------------------------
// Mock next/navigation (redirect throws in server actions — just spy on it)
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const V2_LOGIN = '/v1/auth/tenant/customer/login';
const V2_REGISTER = '/v1/auth/tenant/customer/register';
const V2_OTP_REQUEST = '/v1/auth/tenant/otp/request';
const V2_OTP_VERIFY = '/v1/auth/tenant/otp/verify';
const V2_FORGOT = '/v1/auth/tenant/forgot-password';
const V2_RESET = '/v1/auth/tenant/reset-password';

const LEGACY_LOGIN = '/v1/auth/customer/login';
const LEGACY_REGISTER = '/v1/auth/customer/register';
const LEGACY_OTP_REQUEST = '/v1/auth/otp/request';
const LEGACY_OTP_VERIFY = '/v1/auth/otp/verify';
const LEGACY_FORGOT = '/v1/auth/forgot-password';
const LEGACY_RESET = '/v1/auth/reset-password';

/** Mock fetch and capture all calls for assertions. */
interface FetchCall { url: string; body: Record<string, unknown> }
// noUncheckedIndexedAccess makes array[n] → T|undefined. This branded type
// makes indexed access T so tests can write calls[0].url without `!`.
type CallLog = FetchCall[] & { [n: number]: FetchCall };

function mockFetchSuccess(data: unknown = {}) {
  const calls = [] as CallLog;
  global.fetch = jest.fn().mockImplementation(async (url: string, init: RequestInit) => {
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    calls.push({ url, body });
    return { ok: true, status: 200, json: async () => data, clone: () => ({ json: async () => data }) };
  });
  return calls;
}

function mockFetchFail(status = 401, code?: string) {
  const calls = [] as CallLog;
  global.fetch = jest.fn().mockImplementation(async (url: string, init: RequestInit) => {
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    calls.push({ url, body });
    return {
      ok: false,
      status,
      json: async () => (code ? { code } : { message: 'error' }),
      clone: () => ({ json: async () => (code ? { code } : { message: 'error' }) }),
    };
  });
  return calls;
}

const SESSION_DATA = {
  user: { id: 'u1', role: 'CUSTOMER', fullName: 'Test User' },
  tokens: { accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 },
};

function setTenantSlug(slug: string | null) {
  mockHeadersStore.get.mockImplementation((key: string) =>
    key === 'x-resolved-tenant-slug' ? slug : null,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue(mockCookiesStore);
  (headers as jest.Mock).mockResolvedValue(mockHeadersStore);
  mockCookiesStore.set.mockResolvedValue(undefined);
  mockCookiesStore.delete.mockResolvedValue(undefined);
  setTenantSlug('company-a');
});

// ---------------------------------------------------------------------------
// §5 / §29 — Customer Login
// ---------------------------------------------------------------------------

describe('customerLoginAction — §5/§29 Login', () => {
  test('Host A injects slug A into V2 endpoint body', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    const result = await customerLoginAction({ email: 'user@a.com', password: 'pass1234' });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(V2_LOGIN);
    expect(calls[0].body.slug).toBe('company-a');
    expect(calls[0].body.email).toBe('user@a.com');
  });

  test('no companyId field sent in login body', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await customerLoginAction({ email: 'user@a.com', password: 'pass1234' });

    expect(calls[0].body).not.toHaveProperty('companyId');
  });

  test('legacy /auth/customer/login endpoint NOT called', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await customerLoginAction({ email: 'user@a.com', password: 'pass1234' });

    expect(calls.some((c) => c.url.includes(LEGACY_LOGIN))).toBe(false);
  });

  test('unknown/unavailable host (slug=null) → 503, no backend call', async () => {
    setTenantSlug(null);
    const calls = mockFetchSuccess(SESSION_DATA);

    const result = await customerLoginAction({ email: 'user@a.com', password: 'pass1234' });

    expect(result.ok).toBe(false);
    expect((result as { status: number }).status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test('V2 login failure → error returned, no legacy fallback', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchFail(401);

    const result = await customerLoginAction({ email: 'user@a.com', password: 'wrong' });

    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.url.includes(LEGACY_LOGIN))).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test('B credentials on A host → generic failure (not a cross-tenant login)', async () => {
    setTenantSlug('company-a');
    // Backend returns 401 because company-a doesn't have this user
    mockFetchFail(401);

    const result = await customerLoginAction({ email: 'user@b.com', password: 'pass1234' });

    expect(result.ok).toBe(false);
    expect((result as { status: number }).status).toBe(401);
  });

  test('email is trimmed client-side; backend canonicalization is authoritative', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await customerLoginAction({ email: '  User@A.COM  ', password: 'pass1234' });

    // Frontend trims; backend does canonicalization. We send trimmed value.
    expect(calls[0].body.email).toBe('User@A.COM');
  });

  test('website-disabled host (websiteEnabled=false, slug=null from getResolvedTenant) → 503', async () => {
    // getResolvedTenant returns null when websiteEnabled=false, so slug is null
    setTenantSlug(null);
    const calls = mockFetchSuccess(SESSION_DATA);

    const result = await customerLoginAction({ email: 'u@a.com', password: 'pass1234' });

    expect(result.ok).toBe(false);
    expect((result as { status: number }).status).toBe(503);
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §8 / §30 — Customer Registration
// ---------------------------------------------------------------------------

describe('customerRegisterAction — §8/§30 Registration', () => {
  const validInput = {
    fullName: 'Ahmed Ali',
    phone: '+9665XXXXXXXX',
    email: 'ahmed@a.com',
    password: 'pass1234',
    acceptTerms: true as const,
  };

  test('Host A registration calls V2 endpoint with slug A', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await customerRegisterAction(validInput);

    expect(calls[0].url).toContain(V2_REGISTER);
    expect(calls[0].body.slug).toBe('company-a');
  });

  test('no companyId field in registration body', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await customerRegisterAction(validInput);

    expect(calls[0].body).not.toHaveProperty('companyId');
  });

  test('legacy /auth/customer/register NOT called', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await customerRegisterAction(validInput);

    expect(calls.some((c) => c.url.includes(LEGACY_REGISTER))).toBe(false);
  });

  test('no tenant → 503, no backend call', async () => {
    setTenantSlug(null);
    const calls = mockFetchSuccess(SESSION_DATA);

    const result = await customerRegisterAction(validInput);

    expect(result.ok).toBe(false);
    expect((result as { status: number }).status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test('V2 registration failure → error returned, no legacy fallback', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchFail(409, 'email_taken');

    const result = await customerRegisterAction(validInput);

    expect(result.ok).toBe(false);
    expect((result as { code?: string }).code).toBe('email_taken');
    expect(calls.some((c) => c.url.includes(LEGACY_REGISTER))).toBe(false);
  });

  test('global-unique collision → code returned as-is (controlled UX at form layer)', async () => {
    setTenantSlug('company-a');
    mockFetchFail(409, 'email_taken');

    const result = await customerRegisterAction(validInput);

    // Form maps code to safe Arabic message — code is passed through
    expect((result as { code?: string }).code).toBe('email_taken');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §9 / §31 — OTP Request and Verify
// ---------------------------------------------------------------------------

describe('otpRequestAction — §9/§31 OTP Request', () => {
  test('Host A OTP request calls V2 endpoint with slug A', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await otpRequestAction('+9665XXXXXXXX');

    expect(calls[0].url).toContain(V2_OTP_REQUEST);
    expect(calls[0].body.slug).toBe('company-a');
  });

  test('legacy /auth/otp/request NOT called', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await otpRequestAction('+9665XXXXXXXX');

    expect(calls.some((c) => c.url.includes(LEGACY_OTP_REQUEST))).toBe(false);
  });

  test('no tenant → 503, no backend call', async () => {
    setTenantSlug(null);
    const calls = mockFetchSuccess({});

    const result = await otpRequestAction('+9665XXXXXXXX');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test('V2 failure → returned as-is, no legacy fallback', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchFail(400);

    const result = await otpRequestAction('+invalid');

    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.url.includes(LEGACY_OTP_REQUEST))).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test('phone country NOT guessed client-side (raw phone passed through)', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    const rawPhone = '0551234567'; // local format
    await otpRequestAction(rawPhone);

    // Phone is sent as-is to backend; backend uses tenant country for canonicalization
    expect(calls[0].body.phone).toBe(rawPhone);
  });
});

describe('otpVerifyAction — §9/§31 OTP Verify', () => {
  test('Host A verify calls V2 endpoint with slug A', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await otpVerifyAction({ phone: '+9665XXXXXXXX', code: '123456' });

    expect(calls[0].url).toContain(V2_OTP_VERIFY);
    expect(calls[0].body.slug).toBe('company-a');
  });

  test('legacy /auth/otp/verify NOT called', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess(SESSION_DATA);

    await otpVerifyAction({ phone: '+9665XXXXXXXX', code: '123456' });

    expect(calls.some((c) => c.url.includes(LEGACY_OTP_VERIFY))).toBe(false);
  });

  test('no tenant → 503, no backend call', async () => {
    setTenantSlug(null);
    const calls = mockFetchSuccess(SESSION_DATA);

    const result = await otpVerifyAction({ phone: '+9665XXXXXXXX', code: '123456' });

    expect(result.ok).toBe(false);
    expect((result as { status: number }).status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test('V2 verify failure → error returned, no legacy fallback', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchFail(401);

    const result = await otpVerifyAction({ phone: '+9665XXXXXXXX', code: '999999' });

    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.url.includes(LEGACY_OTP_VERIFY))).toBe(false);
  });

  test('legacy-null OTP (no slug in request) cannot succeed — slug always required', async () => {
    // This represents a companyId=NULL OTP: the V2 endpoint requires slug in
    // body, and getServerTenantSlug must return a real slug. If it returns null
    // (no tenant), the action fails before calling the backend.
    setTenantSlug(null);
    const calls = mockFetchSuccess(SESSION_DATA);

    const result = await otpVerifyAction({ phone: '+9665XXXXXXXX', code: '123456' });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §12 / §32 — Forgot Password
// ---------------------------------------------------------------------------

describe('forgotPasswordAction — §12/§32 Forgot Password', () => {
  test('calls V2 tenant-aware endpoint with server-derived slug', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await forgotPasswordAction({ email: 'user@a.com' });

    expect(calls[0].url).toContain(V2_FORGOT);
    expect(calls[0].body.slug).toBe('company-a');
  });

  test('legacy /auth/forgot-password NOT called', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await forgotPasswordAction({ email: 'user@a.com' });

    expect(calls.some((c) => c.url.includes(LEGACY_FORGOT))).toBe(false);
  });

  test('no tenant → 503, no backend call', async () => {
    setTenantSlug(null);
    const calls = mockFetchSuccess({});

    const result = await forgotPasswordAction({ email: 'user@a.com' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test('V2 failure → error returned, no legacy fallback', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchFail(500);

    const result = await forgotPasswordAction({ email: 'user@a.com' });

    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.url.includes(LEGACY_FORGOT))).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §13 / §32 — Reset Password
// ---------------------------------------------------------------------------

describe('resetPasswordAction — §13/§32 Reset Password', () => {
  test('calls V2 tenant/reset-password endpoint (no slug needed)', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await resetPasswordAction({ token: 'reset-token-abc', newPassword: 'newpass1234' });

    expect(calls[0].url).toContain(V2_RESET);
    expect(calls[0].body.token).toBe('reset-token-abc');
  });

  test('no slug in reset body (token identifies user, not tenant)', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await resetPasswordAction({ token: 'reset-token-abc', newPassword: 'newpass1234' });

    expect(calls[0].body).not.toHaveProperty('slug');
  });

  test('legacy /auth/reset-password NOT called', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchSuccess({});

    await resetPasswordAction({ token: 'reset-token-abc', newPassword: 'newpass1234' });

    expect(calls.some((c) => c.url.includes(LEGACY_RESET))).toBe(false);
  });

  test('reset works even when no tenant resolved (token is authoritative)', async () => {
    // Reset password does not require a tenant — the token maps to a user.
    // This allows reset links to work even on non-tenant-gated contexts.
    setTenantSlug(null);
    const calls = mockFetchSuccess({});

    const result = await resetPasswordAction({ token: 'reset-token-abc', newPassword: 'newpass1234' });

    // Should succeed: no slug gate for reset
    expect(calls[0].url).toContain(V2_RESET);
    expect(result).toMatchObject({ ok: true });
  });

  test('V2 failure → error returned, no legacy fallback', async () => {
    setTenantSlug('company-a');
    const calls = mockFetchFail(400);

    const result = await resetPasswordAction({ token: 'bad-token', newPassword: 'newpass1234' });

    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.url.includes(LEGACY_RESET))).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §25 — No legacy fallback invariant (explicit cross-checks)
// ---------------------------------------------------------------------------

describe('§25 — No legacy auth fallback', () => {
  const LEGACY_PATHS = [LEGACY_LOGIN, LEGACY_REGISTER, LEGACY_OTP_REQUEST, LEGACY_OTP_VERIFY, LEGACY_FORGOT];

  test('no legacy endpoint called across all V2 success paths', async () => {
    setTenantSlug('company-a');
    const calls = [] as CallLog;
    global.fetch = jest.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      calls.push({ url, body });
      return {
        ok: true,
        status: 200,
        json: async () => SESSION_DATA,
        clone: () => ({ json: async () => SESSION_DATA }),
      };
    });

    await customerLoginAction({ email: 'u@a.com', password: 'pass1234' });
    await customerRegisterAction({ fullName: 'Ahmed', phone: '+9665XX', email: 'u@a.com', password: 'pass1234', acceptTerms: true });
    await otpRequestAction('+9665XX');
    await otpVerifyAction({ phone: '+9665XX', code: '123456' });
    await forgotPasswordAction({ email: 'u@a.com' });
    await resetPasswordAction({ token: 'tok', newPassword: 'newpass1234' });

    const calledUrls = calls.map((c) => c.url);
    for (const legacy of LEGACY_PATHS) {
      expect(calledUrls.some((u) => u.includes(legacy))).toBe(false);
    }
  });

  test('no legacy endpoint called across all V2 failure paths', async () => {
    setTenantSlug('company-a');
    const calls = [] as CallLog;
    global.fetch = jest.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      calls.push({ url, body });
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
        clone: () => ({ json: async () => ({}) }),
      };
    });

    await customerLoginAction({ email: 'u@a.com', password: 'pass1234' });
    await customerRegisterAction({ fullName: 'Ahmed', phone: '+9665XX', email: 'u@a.com', password: 'pass1234', acceptTerms: true });
    await otpRequestAction('+9665XX');
    await otpVerifyAction({ phone: '+9665XX', code: '123456' });
    await forgotPasswordAction({ email: 'u@a.com' });

    const calledUrls = calls.map((c) => c.url);
    for (const legacy of LEGACY_PATHS) {
      expect(calledUrls.some((u) => u.includes(legacy))).toBe(false);
    }
  });
});
