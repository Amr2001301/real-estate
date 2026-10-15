import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import type { NotificationItem } from '@/lib/types';
import { PremiumPageHero } from '@/components/premium';
import { NotificationList } from '@/components/notifications/notification-list';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 20;

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// The API returns a paginated envelope: { data: NotificationItem[], meta: {...} }.
// This normalizer safely extracts the array regardless of future shape changes.
function normalizeNotifications(input: unknown): NotificationItem[] {
  if (Array.isArray(input)) return input as NotificationItem[];
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as NotificationItem[];
    if (Array.isArray(obj.items)) return obj.items as NotificationItem[];
    if (Array.isArray(obj.notifications)) return obj.notifications as NotificationItem[];
  }
  return [];
}

export default async function PortalNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const locale = await getLocale();
  const m = portalDashboardT(locale);
  const t = m.notifications;
  const res = await safe(
    api.get<{ data: NotificationItem[]; meta: Record<string, unknown> }>(
      `/me/notifications?page=${page}&pageSize=${PAGE_SIZE}`,
      { headers: { 'Accept-Language': locale } },
    ),
  );
  const items = normalizeNotifications(res.data);
  const total = typeof res.data?.meta?.total === 'number' ? res.data.meta.total : items.length;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: t.title },
        ]}
      />

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {t.loadErrorFn(res.error)}
        </div>
      )}

      <NotificationList items={items} basePath="/portal" locale={locale} />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/portal/notifications"
        locale={locale}
      />
    </div>
  );
}
