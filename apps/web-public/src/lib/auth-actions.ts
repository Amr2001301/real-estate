'use server';

/**
 * Server actions for public-website (CLIENT / CUSTOMER) authentication.
 *
 * F2 — MT-052 / MT-094: All customer auth operations are now tenant-aware.
 * The resolved tenant slug is read server-side from the F1 middleware header
 * (x-resolved-tenant-slug) and injected into every backend request body.
 * The browser NEVER controls which company the operation targets.
 *
 * Endpoint mapping (legacy → V2):
 *   /auth/customer/login      → /auth/tenant/customer/login
 *   /auth/customer/register   → /auth/tenant/customer/register
 *   /auth/otp/request         → /auth/tenant/otp/request
 *   /auth/otp/verify          → /auth/tenant/otp/verify
 *   /auth/forgot-password     → /auth/tenant/forgot-password
 *   /auth/reset-password      → /auth/tenant/reset-password  (no slug; token identifies user)
 *   /auth/logout, /auth/refresh — tenant-neutral; kept as-is.
 *
 * Cookie contract (unchanged from legacy):
 *   access_token   httpOnly, sameSite=lax, secure in prod, maxAge=expiresIn
 *   refresh_token  httpOnly, sameSite=lax, secure in prod, maxAge=30d
 *   user           non-httpOnly JSON { id, role, fullName }, maxAge=30d
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { setSessionCookies, clearSessionCookies, type AuthSession } from '@/lib/auth-cookies';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

type AuthResponse = AuthSession;

export type AuthActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; status: number; code?: string };

interface PostResult {
  ok: boolean;
  status: number;
  code?: string;
  data?: AuthResponse;
}

/** POST a JSON body to a backend auth endpoint (server-side, no caching). */
async function postAuth(path: string, body: unknown): Promise<PostResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0 };
  }

  if (!res.ok) {
    let code: string | undefined;
    try {
      const errBody = (await res.clone().json()) as { code?: unknown };
      if (typeof errBody?.code === 'string' && errBody.code.length <= 40) code = errBody.code;
    } catch {
      /* non-JSON error body */
    }
    return { ok: false, status: res.status, code };
  }

  try {
    const data = (await res.json()) as AuthResponse;
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: res.status };
  }
}

/**
 * Read the server-resolved tenant slug from the F1 middleware header.
 * Returns null when running on a hostname with no associated tenant (platform
 * base domain, unknown host, suspended/archived company, website disabled).
 * Callers MUST treat null as a hard failure — never fall back to legacy.
 */
async function getServerTenantSlug(): Promise<string | null> {
  const h = await headers();
  const slug = h.get('x-resolved-tenant-slug');
  return slug || null;
}

/**
 * Validate a post-login `from` target: must be an internal path inside the
 * /account area. Anything else (external, other section, malformed) falls back
 * to /account. Defence-in-depth against open redirects.
 */
function safeAccountFrom(from?: string): string {
  const fallback = '/account';
  if (!from || from.length > 2048) return fallback;
  if (!from.startsWith('/')) return fallback;
  if (from.startsWith('//') || from.startsWith('/\\')) return fallback;
  const pathOnly = from.split(/[?#]/, 1)[0] ?? '';
  return pathOnly === '/account' || pathOnly.startsWith('/account/') ? from : fallback;
}

export interface LoginInput {
  email: string;
  password: string;
  from?: string;
}

/**
 * Customer/Client email+password login → POST /v1/auth/tenant/customer/login.
 * Slug is server-derived (F1 header); browser payload cannot override Company.
 */
export async function customerLoginAction(input: LoginInput): Promise<AuthActionResult> {
  const slug = await getServerTenantSlug();
  if (!slug) return { ok: false, status: 503, code: 'no_tenant' };

  const email = input.email?.trim() ?? '';
  const password = input.password ?? '';
  if (!email || !password) return { ok: false, status: 400 };

  const res = await postAuth('/auth/tenant/customer/login', { slug, email, password });
  if (!res.ok || !res.data) return { ok: false, status: res.status, code: res.code };

  await setSessionCookies(res.data);
  return { ok: true, redirectTo: safeAccountFrom(input.from) };
}

export interface RegisterInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  acceptTerms: boolean;
  city?: string;
  interestType?: string;
  budgetRange?: string;
  preferredContactMethod?: string;
  from?: string;
}

/**
 * Customer/Client registration → POST /v1/auth/tenant/customer/register.
 * Slug is server-derived. Browser payload never contains companyId.
 *
 * Note: Global User email/phone uniqueness still exists (legacy constraint).
 * A customer already registered in another Company may receive a conflict
 * error. This is a known Expand-phase limitation resolved in B-Contract.
 * Use a safe generic message for such conflicts.
 */
export async function customerRegisterAction(input: RegisterInput): Promise<AuthActionResult> {
  const slug = await getServerTenantSlug();
  if (!slug) return { ok: false, status: 503, code: 'no_tenant' };

  const fullName = input.fullName?.trim() ?? '';
  const email = input.email?.trim() ?? '';
  const phone = (input.phone ?? '').replace(/[\s-]/g, '');
  const password = input.password ?? '';
  if (!fullName || !email || !phone || !password || input.acceptTerms !== true) {
    return { ok: false, status: 400 };
  }

  const res = await postAuth('/auth/tenant/customer/register', {
    slug,
    fullName,
    phone,
    email,
    password,
    acceptTerms: input.acceptTerms,
    ...(input.city ? { city: input.city } : {}),
    ...(input.interestType ? { interestType: input.interestType } : {}),
    ...(input.budgetRange ? { budgetRange: input.budgetRange } : {}),
    ...(input.preferredContactMethod ? { preferredContactMethod: input.preferredContactMethod } : {}),
  });
  if (!res.ok || !res.data) return { ok: false, status: res.status, code: res.code };

  await setSessionCookies(res.data);
  return { ok: true, redirectTo: safeAccountFrom(input.from) };
}

/**
 * Request a phone OTP → POST /v1/auth/tenant/otp/request.
 * Slug is server-derived. Backend resolves slug→companyId and scopes the OTP.
 */
export async function otpRequestAction(phone: string): Promise<{ ok: boolean; status: number }> {
  const slug = await getServerTenantSlug();
  if (!slug) return { ok: false, status: 503 };

  const res = await postAuth('/auth/tenant/otp/request', { slug, phone });
  return { ok: res.ok, status: res.status };
}

export interface OtpVerifyInput {
  phone: string;
  code: string;
  fullName?: string;
  from?: string;
}

/**
 * Verify a phone OTP → POST /v1/auth/tenant/otp/verify.
 * Slug is server-derived. OTP is scoped to the resolved company; an OTP issued
 * for Company A cannot be consumed on Company B's host.
 */
export async function otpVerifyAction(input: OtpVerifyInput): Promise<AuthActionResult> {
  const slug = await getServerTenantSlug();
  if (!slug) return { ok: false, status: 503, code: 'no_tenant' };

  const phone = (input.phone ?? '').replace(/[\s-]/g, '');
  const code = input.code?.trim() ?? '';
  if (!phone || !code) return { ok: false, status: 400 };

  const res = await postAuth('/auth/tenant/otp/verify', {
    slug,
    phone,
    code,
    ...(input.fullName?.trim() ? { fullName: input.fullName.trim() } : {}),
  });
  if (!res.ok || !res.data) return { ok: false, status: res.status, code: res.code };

  await setSessionCookies(res.data);
  return { ok: true, redirectTo: safeAccountFrom(input.from) };
}

export interface ForgotPasswordInput {
  email: string;
}

/**
 * Request a password-reset email → POST /v1/auth/tenant/forgot-password.
 * Slug is server-derived. Enumeration-safe: always returns success to the form.
 */
export async function forgotPasswordAction(
  input: ForgotPasswordInput,
): Promise<{ ok: boolean; status: number }> {
  const slug = await getServerTenantSlug();
  if (!slug) return { ok: false, status: 503 };

  const email = input.email?.trim() ?? '';
  if (!email) return { ok: false, status: 400 };

  const res = await postAuth('/auth/tenant/forgot-password', { slug, email });
  return { ok: res.ok, status: res.status };
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

/**
 * Exchange a reset token for a new password → POST /v1/auth/tenant/reset-password.
 * No slug required: the opaque token identifies the User directly.
 * Opening a reset link from Company A on Company B's hostname still resets
 * Company A's user's password (token is authoritative, not the host).
 */
export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<{ ok: boolean; status: number }> {
  const token = input.token?.trim() ?? '';
  const newPassword = input.newPassword ?? '';
  if (!token || newPassword.length < 8) return { ok: false, status: 400 };

  const res = await postAuth('/auth/tenant/reset-password', { token, newPassword });
  return { ok: res.ok, status: res.status };
}

export interface VerifyEmailInput {
  token: string;
}

/** Submit the token from /verify-email?token=... → POST /v1/auth/verify-email. */
export async function verifyEmailAction(
  input: VerifyEmailInput,
): Promise<{ ok: boolean; alreadyVerified?: boolean; status: number }> {
  const token = input.token?.trim() ?? '';
  if (!token) return { ok: false, status: 400 };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0 };
  }

  if (!res.ok) return { ok: false, status: res.status };
  try {
    const body = (await res.json()) as { ok?: boolean; alreadyVerified?: boolean };
    return { ok: true, alreadyVerified: body.alreadyVerified ?? false, status: res.status };
  } catch {
    return { ok: true, status: res.status };
  }
}

/** Resend the email-verification link. Requires a valid session cookie. */
export async function resendVerificationAction(): Promise<{ ok: boolean; status: number }> {
  const c = await cookies();
  const accessToken = c.get('access_token')?.value;
  if (!accessToken) return { ok: false, status: 401 };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0 };
  }
  return { ok: res.ok, status: res.status };
}

/**
 * Clear the session cookies and return to /login. Best-effort backend logout
 * (token revocation) is attempted but never blocks the local clear.
 * Logout remains available even when the Company is suspended or token expired.
 */
export async function logoutAction(): Promise<void> {
  const c = await cookies();
  const refreshToken = c.get('refresh_token')?.value;
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      /* ignore — local cookie clear below is what matters */
    }
  }
  await clearSessionCookies();
  redirect('/login');
}
