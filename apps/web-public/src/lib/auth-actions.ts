'use server';

/**
 * Server actions for public-website (CLIENT / CUSTOMER) authentication.
 *
 * These run on the server, call the backend auth endpoints directly, and set
 * the session in httpOnly cookies — the access token NEVER reaches client JS.
 * Mirrors the cookie contract of apps/web-admin/src/app/login/actions.ts:
 *   * access_token   httpOnly, sameSite=lax, secure in prod, maxAge=expiresIn
 *   * refresh_token  httpOnly, sameSite=lax, secure in prod, maxAge=30d
 *   * user           non-httpOnly JSON { id, role, fullName }, maxAge=30d
 *
 * NOTE: These actions are not yet wired into the auth forms — that is step 0.4
 * (CustomerAuthForm/OtpAuthForm rewire). They are self-contained and callable.
 * They return a typed result (status + optional code) so the client forms can
 * map failures to the existing friendly Arabic messages without changes here.
 */

import { cookies } from 'next/headers';
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
    // Network-level failure (API down / refused). Surface as status 0 so the
    // form maps it to "تعذر الاتصال بالخادم".
    return { ok: false, status: 0 };
  }

  if (!res.ok) {
    let code: string | undefined;
    try {
      const errBody = (await res.clone().json()) as { code?: unknown };
      if (typeof errBody?.code === 'string' && errBody.code.length <= 40) code = errBody.code;
    } catch {
      /* non-JSON error body — ignore */
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

/** Customer/Client email+password login → POST /v1/auth/customer/login. */
export async function customerLoginAction(input: LoginInput): Promise<AuthActionResult> {
  const email = input.email?.trim() ?? '';
  const password = input.password ?? '';
  if (!email || !password) return { ok: false, status: 400 };

  const res = await postAuth('/auth/customer/login', { email, password });
  if (!res.ok || !res.data) return { ok: false, status: res.status, code: res.code };

  await setSessionCookies(res.data);
  return { ok: true, redirectTo: safeAccountFrom(input.from) };
}

export interface RegisterInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  /** Must be true — the user explicitly accepted terms in the form. */
  acceptTerms: boolean;
  city?: string;
  interestType?: string;
  budgetRange?: string;
  preferredContactMethod?: string;
  from?: string;
}

/** Customer/Client registration → POST /v1/auth/customer/register (auto-login). */
export async function customerRegisterAction(input: RegisterInput): Promise<AuthActionResult> {
  const fullName = input.fullName?.trim() ?? '';
  const email = input.email?.trim() ?? '';
  const phone = (input.phone ?? '').replace(/[\s-]/g, '');
  const password = input.password ?? '';
  // Never register without explicit terms acceptance — defence-in-depth even
  // though the form also validates this client-side.
  if (!fullName || !email || !phone || !password || input.acceptTerms !== true) {
    return { ok: false, status: 400 };
  }

  const res = await postAuth('/auth/customer/register', {
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

export interface OtpVerifyInput {
  phone: string;
  code: string;
  fullName?: string;
  from?: string;
}

/** Verify a phone OTP and establish the session → POST /v1/auth/otp/verify. */
export async function otpVerifyAction(input: OtpVerifyInput): Promise<AuthActionResult> {
  const phone = (input.phone ?? '').replace(/[\s-]/g, '');
  const code = input.code?.trim() ?? '';
  if (!phone || !code) return { ok: false, status: 400 };

  const res = await postAuth('/auth/otp/verify', {
    phone,
    code,
    ...(input.fullName?.trim() ? { fullName: input.fullName.trim() } : {}),
  });
  if (!res.ok || !res.data) return { ok: false, status: res.status, code: res.code };

  await setSessionCookies(res.data);
  return { ok: true, redirectTo: safeAccountFrom(input.from) };
}

/**
 * Clear the session cookies and return to /login. Best-effort backend logout
 * (token revocation) is attempted but never blocks the local clear.
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
