import Link from 'next/link';
import { FileEdit } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { NotificationItem, Paged } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { NotificationList } from '@/components/notifications/notification-list';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Normalise the response from `/me/notifications` into an array.
 *
 * The backend returns the standard `Paged<NotificationItem>` shape
 * (`{ data, meta }`) — a P5 bug surfaced where this page cast it as a plain
 * array and `items.filter is not a function` crashed at render time. The
 * helper accepts both shapes (defence-in-depth in case any deployment ever
 * returns the array form) and any other surprise becomes an empty list
 * rather than a runtime crash.
 */
function extractItems(value: unknown): NotificationItem[] {
  if (Array.isArray(value)) return value as NotificationItem[];
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: NotificationItem[] }).data;
  }
  return [];
}

export default async function AdminNotificationsInboxPage() {
  const res = await safe(
    api.get<Paged<NotificationItem> | NotificationItem[]>('/me/notifications'),
  );
  const items = extractItems(res.data);

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإشعارات"
        description="جميع الإشعارات الواردة. اضغط على الإشعار للانتقال إلى السجل المرتبط."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الإشعارات' },
        ]}
        actions={
          <Link href="/dashboard/notifications/templates">
            <Button variant="outline" size="sm" leftIcon={<FileEdit className="h-3.5 w-3.5" />}>
              قوالب الإشعارات
            </Button>
          </Link>
        }
      />

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الإشعارات: {res.error}
        </div>
      )}

      <NotificationList items={items} basePath="/dashboard" />
    </div>
  );
}
