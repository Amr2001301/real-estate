import { redirect } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import { extractPaginatedData } from '@/lib/extract-paginated';
import type { MeNotification, Paginated } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { NotificationCard } from '@/components/account/NotificationCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { markAllNotificationsReadAction } from '@/lib/account-actions';

export const metadata = buildMetadata({
  title: 'الإشعارات',
  description: 'إشعاراتك في ديفورا.',
  robots: { index: false, follow: false },
});

// P10 — the local `extractItems` helper that used to live here is gone;
// callers now use the shared `extractPaginatedData<T>` from
// `@/lib/extract-paginated`. Same tolerance for legacy-array vs paginated
// `{data, meta}` responses, just one source of truth so the dashboard and
// this page never drift apart again.

export default async function AccountNotificationsPage() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.notifications;

  let raw: Paginated<MeNotification> | MeNotification[];
  try {
    raw = await authFetch<Paginated<MeNotification> | MeNotification[]>(
      '/me/notifications',
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <AccountPageHeader title={m.title} description={m.description} />
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const notifications = extractPaginatedData<MeNotification>(raw);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-8">
      <AccountPageHeader
        title={m.title}
        description={m.description}
        actions={
          unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-strong transition-colors hover:border-gold-300 hover:text-gold-600"
              >
                <CheckCheck className="h-4 w-4" aria-hidden />
                {m.markAllRead}
              </button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<Bell className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              {m.backToDashboard}
            </ButtonLink>
          }
        />
      ) : (
        <PremiumCard className="divide-y divide-hairline/60 overflow-hidden">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </PremiumCard>
      )}
    </div>
  );
}
