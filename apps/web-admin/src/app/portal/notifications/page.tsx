import { api, safe } from '@/lib/api';
import type { NotificationItem } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
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
  const res = await safe(api.get<{ data: NotificationItem[]; meta: Record<string, unknown> }>('/me/notifications'));
  const items = normalizeNotifications(res.data);

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإشعارات"
        description="تنبيهات بشأن فرصك، حجوزاتك، عقودك، وعمولاتك."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الإشعارات' },
        ]}
      />

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الإشعارات: {res.error}
        </div>
      )}

      <NotificationList items={items} basePath="/portal" />
    </div>
  );
}
