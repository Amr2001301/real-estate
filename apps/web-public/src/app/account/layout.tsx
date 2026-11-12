import { redirect } from 'next/navigation';
import { getSession, isPortalRole, type SessionRole } from '@/lib/session';
import { authFetch, AuthError } from '@/lib/api-auth';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { AccountSidebar } from '@/components/account/AccountSidebar';
import { AccountFrame } from '@/components/account/AccountFrame';

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
  } catch (e) {
    // AuthError here means expired session or tenant mismatch (403 + cookie cleared).
    // Redirect to /login so the cycle breaks — on the next load getSession() will
    // return null (cookies cleared) and the middleware will allow /login to render.
    if (e instanceof AuthError) redirect('/login');
  }

  // Unread notification count for the sidebar badge. AuthError → redirect; other
  // failures simply hide the badge (count 0).
  let unreadNotifications = 0;
  try {
    const res = await authFetch<{ count: number }>('/me/notifications/unread-count');
    unreadNotifications = Number(res.count) || 0;
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
  }

  return (
    <AccountFrame
      hero={{
        eyebrow: m.account.eyebrow,
        title: session.fullName ? m.account.welcome(session.fullName) : m.account.yourAccount,
        subtitle: m.account.subtitle,
      }}
      sidebar={
        <AccountSidebar
          fullName={session.fullName}
          roleLabel={roleLabel}
          avatarUrl={avatarUrl}
          isCustomer={session.role === 'CUSTOMER'}
          unreadNotifications={unreadNotifications}
          locale={locale}
        />
      }
    >
      {children}
    </AccountFrame>
  );
}
