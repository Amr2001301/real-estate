import { redirect } from 'next/navigation';
import { getSession, isPortalRole, type SessionRole } from '@/lib/session';
import { Container } from '@/components/ui/Container';
import { AccountSidebar } from '@/components/account/AccountSidebar';

const ROLE_LABELS: Partial<Record<SessionRole, string>> = {
  CLIENT: 'عميل',
  CUSTOMER: 'عميل / مالك وحدة',
};

/**
 * Guard + shell for the authenticated portal area. Middleware already blocks
 * unauthenticated access to /account/*; this layout adds the role check
 * (which middleware can't do safely) and provides the shared sidebar so every
 * portal page feels like part of the same site rather than a separate app.
 *
 * Authorization here uses the server-side session (httpOnly token presence +
 * `user` hint); the backend RolesGuard remains the real authority. Customer
 * feature pages (contracts/deposits/maintenance/...) are NOT built yet.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isPortalRole(session.role)) redirect('/');

  const roleLabel = ROLE_LABELS[session.role] ?? session.role;

  return (
    <section className="min-h-screen bg-canvas pb-20 pt-28 sm:pt-32">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <AccountSidebar fullName={session.fullName} roleLabel={roleLabel} />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </section>
  );
}
