import { cookies } from 'next/headers';

/**
 * Server-side session helper for the public website's authenticated area.
 *
 * Mirrors apps/web-admin/src/lib/session.ts, but for portal users (CLIENT /
 * CUSTOMER). The session lives in three cookies set by the auth server actions
 * (see lib/auth-actions.ts):
 *   * access_token   — httpOnly JWT, NOT readable here beyond presence
 *   * refresh_token  — httpOnly, for rotation
 *   * user           — non-httpOnly JSON hint { id, role, fullName }
 *
 * This reads the `user` hint for convenience ONLY. It never verifies the JWT
 * cryptographically and the `user` cookie must NOT be trusted for real
 * authorization — the backend RolesGuard is the source of truth. Page/layout
 * code may use the role here to choose what to render; the API still rejects
 * anything the role isn't entitled to.
 */

export type SessionRole =
  | 'CLIENT'
  | 'CUSTOMER'
  | 'ADMIN'
  | 'SALES'
  | 'SALES_MANAGER'
  | 'MAINTENANCE_SUPERVISOR'
  | 'BROKER';

export interface SessionUser {
  id: string;
  role: SessionRole;
  fullName: string;
}

/**
 * Returns the signed-in user from cookies, or null when not authenticated.
 * Requires BOTH the httpOnly access_token and the readable `user` hint to be
 * present and parseable.
 */
export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get('access_token')?.value;
  const userJson = c.get('user')?.value;
  if (!token || !userJson) return null;
  try {
    const parsed = JSON.parse(userJson) as Partial<SessionUser>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.role !== 'string') {
      return null;
    }
    return {
      id: parsed.id,
      role: parsed.role as SessionRole,
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
    };
  } catch {
    return null;
  }
}

/** True for the two portal-facing roles that the /account area is built for. */
export function isPortalRole(role: SessionRole): boolean {
  return role === 'CLIENT' || role === 'CUSTOMER';
}
