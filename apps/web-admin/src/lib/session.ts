import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface SessionUser {
  id: string;
  role: 'ADMIN' | 'SALES';
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

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN' && user.role !== 'SALES') redirect('/login');
  return user;
}
