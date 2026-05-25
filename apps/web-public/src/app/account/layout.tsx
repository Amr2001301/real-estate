import { redirect } from 'next/navigation';
import { getSession, isPortalRole, type SessionRole } from '@/lib/session';
import { Container } from '@/components/ui/Container';
import { PageHero } from '@/components/layout/PageHero';
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
    <>
      <PageHero
        eyebrow="منطقة العميل"
        title={session.fullName ? `مرحبًا، ${session.fullName}` : 'حسابك'}
        subtitle="تابع مفضلاتك وزياراتك وطلباتك، وحدّث بياناتك من مكان واحد."
        overlap
      />
      <Container className="relative z-10 -mt-16 pb-20 sm:-mt-20">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <AccountSidebar fullName={session.fullName} roleLabel={roleLabel} isCustomer={session.role === 'CUSTOMER'} />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </>
  );
}
