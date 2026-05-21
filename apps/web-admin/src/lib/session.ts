import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type SessionRole = 'ADMIN' | 'SALES' | 'SALES_MANAGER' | 'BROKER';

export interface SessionUser {
  id: string;
  role: SessionRole;
  fullName: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get('access_token')?.value;
  const userJson = c.get('user')?.value;
  if (!token || !userJson) return null;
  try {
    return JSON.parse(userJson) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Gate for /dashboard/* — admin & sales workspace.
 * Sends BROKER users to /portal instead of /login so they land where they belong.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.role === 'BROKER') redirect('/portal');
  if (user.role !== 'ADMIN' && user.role !== 'SALES' && user.role !== 'SALES_MANAGER') {
    redirect('/login');
  }
  return user;
}

/**
 * Gate for /portal/* — broker workspace.
 * Sends non-broker users to /dashboard (or /login if not logged in).
 * BrokerUser.status and Broker.status are enforced server-side by BrokerScopeGuard;
 * those failures surface as API errors on each page rather than a redirect here.
 */
export async function requireBroker(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.role !== 'BROKER') redirect('/dashboard');
  return user;
}
