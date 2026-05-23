'use client';

/**
 * Minimal client-side session store for the public website. Customer auth is
 * phone-OTP (see API auth module); on success the API returns short-lived
 * access + rotating refresh tokens which we persist here for future customer
 * pages (W10+). Stored in localStorage — never logged, never placed in URLs.
 */

const KEY = 'auth:session';

export interface SessionUser {
  id: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  locale: string;
}

export interface AuthResponse {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

export function saveSession(res: AuthResponse): void {
  try {
    const session: Session = {
      user: res.user,
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
    };
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — auth simply won't persist */
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
