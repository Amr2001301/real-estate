import { api, safe } from '@/lib/api';
import type { NotificationItem } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationList } from '@/components/notifications/notification-list';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalNotificationsPage() {
  const res = await safe(api.get<NotificationItem[]>('/me/notifications'));
  const items = res.data ?? [];

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
