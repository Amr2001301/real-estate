import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import type { NotificationItem } from '@/lib/types';
import { PremiumPageHero } from '@/components/premium';
import { NotificationList } from '@/components/notifications/notification-list';

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

export default async function PortalNotificationsPage() {
  const locale = await getLocale();
  const m = portalDashboardT(locale);
  const t = m.notifications;
  const res = await safe(api.get<{ data: NotificationItem[]; meta: Record<string, unknown> }>('/me/notifications'));
  const items = normalizeNotifications(res.data);

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
    </div>
  );
}
