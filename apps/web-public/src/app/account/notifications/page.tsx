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
import { Pagination } from '@/components/projects/Pagination';
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

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function AccountNotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);
  const locale = await getLocale();
  const m = siteT(locale).accountPages.notifications;

  let raw: Paginated<MeNotification> | MeNotification[];
  let unreadCount = 0;
  try {
    // The server writes each title and message in the reader's language.
    const lang = { headers: { 'Accept-Language': locale } };
    const [list, unread] = await Promise.all([
      authFetch<Paginated<MeNotification> | MeNotification[]>(
        `/me/notifications?page=${page}&pageSize=${PAGE_SIZE}`,
        lang,
      ),
      authFetch<{ count: number }>('/me/notifications/unread-count').catch(() => null),
    ]);
    raw = list;
    unreadCount = unread?.count ?? 0;
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
  // Unread across every page, not only this one.
  if (!unreadCount) unreadCount = notifications.filter((n) => !n.read).length;
  const totalPages = Array.isArray(raw) ? 1 : (raw.meta?.totalPages ?? 1);
  const buildHref = (nextPage: number): string =>
    nextPage > 1 ? `${routes.accountNotifications}?page=${nextPage}` : routes.accountNotifications;

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
        <>
          <PremiumCard className="divide-y divide-hairline/60 overflow-hidden">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} locale={locale} />
            ))}
          </PremiumCard>
          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}
