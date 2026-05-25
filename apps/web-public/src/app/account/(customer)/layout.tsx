import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/**
 * Role gate for the CUSTOMER-only (post-purchase) sections. Nests inside the
 * shared /account layout (which supplies the hero + sidebar and guards
 * auth/portal-role), so this only adds the CUSTOMER check — and it runs BEFORE
 * any page-level authFetch, avoiding a 403→/login bounce for CLIENT users
 * (authFetch treats 403 as an auth error).
 *
 * The route group `(customer)` does not affect URLs: pages remain at
 * /account/property, /account/contracts, etc. Backend @Roles(CUSTOMER) stays
 * authoritative; we never trust the non-httpOnly `user` cookie for authz.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'CUSTOMER') redirect('/account');

  return <>{children}</>;
}
