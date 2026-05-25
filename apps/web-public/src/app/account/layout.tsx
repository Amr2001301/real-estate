import { redirect } from 'next/navigation';
import { getSession, isPortalRole } from '@/lib/session';

/**
 * Guard for the authenticated portal area. Middleware already blocks
 * unauthenticated access to /account/*; this layout adds the role check
 * (which middleware can't do safely) and is the single server-side gate for
 * every future portal page.
 *
 * Portal feature pages (favorites, contracts, deposits, maintenance,
 * notifications) are NOT built yet — only the minimal landing stub below.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isPortalRole(session.role)) redirect('/');

  return <>{children}</>;
}
