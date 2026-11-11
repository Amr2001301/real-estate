/**
 * Shared server-only session-cookie helpers.
 *
 * This is a PLAIN server module (NOT 'use server') so these functions can be
 * imported and called by both the auth server actions (lib/auth-actions.ts)
 * and the authenticated fetch helper (lib/api-auth.ts) without becoming
 * client-callable server actions.
 *
 * IMPORTANT: cookies().set/delete may only run inside a Server Action or Route
 * Handler — never during a server-component render. Callers in a render context
 * must guard accordingly (see lib/api-auth.ts).
 */
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE } from '@/lib/cookie-names';

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export interface AuthSession {
  user: { id: string; role: string; fullName: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

/** Persist the session in cookies. Access cookie expires with the JWT. */
export async function setSessionCookies(result: AuthSession): Promise<void> {
  const c = await cookies();
  c.set(ACCESS_COOKIE, result.tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: result.tokens.expiresIn,
  });
  c.set(REFRESH_COOKIE, result.tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
  c.set(
    USER_COOKIE,
    JSON.stringify({
      id: result.user.id,
      role: result.user.role,
      fullName: result.user.fullName,
    }),
    {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: THIRTY_DAYS,
    },
  );
}

/** Remove all three session cookies. */
export async function clearSessionCookies(): Promise<void> {
  const c = await cookies();
  c.delete(ACCESS_COOKIE);
  c.delete(REFRESH_COOKIE);
  c.delete(USER_COOKIE);
}
