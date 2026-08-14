import { redirect } from 'next/navigation';
import { getSession, isPortalRole, type SessionRole } from '@/lib/session';
import { authFetch } from '@/lib/api-auth';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Container } from '@/components/ui/Container';
import { PageHero } from '@/components/layout/PageHero';
import { AccountSidebar } from '@/components/account/AccountSidebar';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  if (!session) redirect('/login');
  if (!isPortalRole(session.role)) redirect('/');

  const m = siteT(locale);
  const roleLabel =
    m.account.roles[session.role as Extract<SessionRole, 'CLIENT' | 'CUSTOMER'>] ?? session.role;

  // The session hint carries no avatar, so fetch it for the sidebar. Non-fatal:
  // on any failure the sidebar gracefully falls back to the initials avatar.
  let avatarUrl: string | null = null;
  try {
    const me = await authFetch<{ avatarUrl: string | null }>('/users/me');
    avatarUrl = me.avatarUrl ?? null;
  } catch {
    /* ignore — initials fallback */
  }

  // Unread notification count for the sidebar badge so customers see pending
  // notifications without opening the notifications page. Non-fatal: any
  // failure simply hides the badge (count 0).
  let unreadNotifications = 0;
  try {
    const res = await authFetch<{ count: number }>('/me/notifications/unread-count');
    unreadNotifications = Number(res.count) || 0;
  } catch {
    /* ignore — badge hidden */
  }

  return (
    <>
      <PageHero
        eyebrow={m.account.eyebrow}
        title={session.fullName ? m.account.welcome(session.fullName) : m.account.yourAccount}
        subtitle={m.account.subtitle}
        overlap
        compact
      />
      <Container className="relative z-10 -mt-14 pb-20 sm:-mt-16">
        <div className="grid gap-6 lg:grid-cols-[284px_minmax(0,1fr)] lg:gap-8">
          <AccountSidebar
            fullName={session.fullName}
            roleLabel={roleLabel}
            avatarUrl={avatarUrl}
            isCustomer={session.role === 'CUSTOMER'}
            unreadNotifications={unreadNotifications}
            locale={locale}
          />
          <div className="min-w-0 pt-12 md:pt-16 lg:pt-28">{children}</div>
        </div>
      </Container>
    </>
  );
}
