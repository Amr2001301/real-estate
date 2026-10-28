import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import type { User } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { getCompanyTimeZone } from '@/lib/currency';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { SessionsList, type SessionRow } from '@/components/security/sessions-list';
import { securityT } from '@/components/security/security-messages';
import { signOutUserEverywhereAction } from '@/lib/security-actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** SES1 — where a staff member is signed in; the admin can sign them out everywhere. */
export default async function UserSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [locale, zone] = await Promise.all([getLocale(), getCompanyTimeZone()]);
  const m = securityT(locale);
  const [userRes, res] = await Promise.all([
    safe(api.get<User>(`/users/${id}`)),
    safe(api.get<{ data: SessionRow[] }>(`/users/${id}/sessions`)),
  ]);
  if (userRes.error && userRes.status === 404) notFound();
  const name = userRes.data?.fullName ?? '—';
  const sessions = res.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={uiT(locale).nav.items.users}
        title={m.userTitle(name)}
        description={m.userDesc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: uiT(locale).nav.items.users, href: '/dashboard/users' },
          { label: m.devices },
        ]}
      />
      <PremiumPanel title={m.sessionsTitle} sub={m.sessionsSub(sessions.length)}>
        {res.error ? (
          <p role="alert" className="text-sm text-danger-600">{m.error}: {res.error}</p>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">{m.noneForUser}</p>
        ) : (
          <>
            <SessionsList sessions={sessions} locale={locale} timeZone={zone} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted/60 p-3">
              <p className="text-[12.5px] text-slate-600">{m.endAllHint}</p>
              <form action={signOutUserEverywhereAction.bind(null, id)}>
                <Button type="submit" variant="danger" size="sm">{m.endAll}</Button>
              </form>
            </div>
          </>
        )}
      </PremiumPanel>
    </div>
  );
}
