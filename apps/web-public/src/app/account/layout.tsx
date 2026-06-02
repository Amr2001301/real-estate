import { redirect } from 'next/navigation';
import { getSession, isPortalRole, type SessionRole } from '@/lib/session';
import { authFetch } from '@/lib/api-auth';
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

  // The session hint carries no avatar, so fetch it for the sidebar. Non-fatal:
  // on any failure the sidebar gracefully falls back to the initials avatar.
  let avatarUrl: string | null = null;
  try {
    const me = await authFetch<{ avatarUrl: string | null }>('/users/me');
    avatarUrl = me.avatarUrl ?? null;
  } catch {
    /* ignore — initials fallback */
  }

  return (
    <>
      <PageHero
        eyebrow="منطقة العميل"
        title={session.fullName ? `مرحبًا، ${session.fullName}` : 'حسابك'}
        subtitle="تابع مفضلاتك وزياراتك وطلباتك، وحدّث بياناتك من مكان واحد."
        overlap
        compact
      />
      <Container className="relative z-10 -mt-14 pb-20 sm:-mt-16">
        <div className="grid gap-6 lg:grid-cols-[284px_minmax(0,1fr)] lg:gap-8">
          {/* The sidebar is a solid card, so it tucks into the navy band for a
              premium overlap. The content column carries a UNIFORM top clearance
              (pt-12 → lg:pt-20) so every account sub-page breathes the same
              distance from the hero and tab-switching never jitters vertically.
              On lg it also needs enough room to drop below the overlapping band. */}
          <AccountSidebar
            fullName={session.fullName}
            roleLabel={roleLabel}
            avatarUrl={avatarUrl}
            isCustomer={session.role === 'CUSTOMER'}
          />
          <div className="min-w-0 pt-12 md:pt-16 lg:pt-28">{children}</div>
        </div>
      </Container>
    </>
  );
}
