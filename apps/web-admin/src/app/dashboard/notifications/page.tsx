import Link from 'next/link';
import { FileEdit, Inbox, Bell, CheckCheck, Clock, Megaphone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { NotificationItem, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { NotificationList } from '@/components/notifications/notification-list';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

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
  const [locale, res] = await Promise.all([
    getLocale(),
    safe(api.get<Paged<NotificationItem> | NotificationItem[]>('/me/notifications')),
  ]);
  const m = uiT(locale).pages.notifications;

  const items = extractItems(res.data);

  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.length - unreadCount;
  // Backend returns items sorted newest-first; first item is the most recent.
  const lastDate = items.length > 0 ? (items[0]?.createdAt ?? null) : null;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/notifications/broadcast">
              <Button variant="primary" size="sm" leftIcon={<Megaphone className="h-3.5 w-3.5" />}>
                {m.sendBtn}
              </Button>
            </Link>
            <Link href="/dashboard/notifications/templates">
              <Button variant="outline" size="sm" leftIcon={<FileEdit className="h-3.5 w-3.5" />}>
                {m.templatesBtn}
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: m.kpi.total, value: items.length, icon: <Inbox /> },
          {
            label: m.kpi.unread,
            value: unreadCount,
            icon: <Bell />,
            tone: unreadCount > 0 ? 'brand' : 'neutral',
            primary: unreadCount > 0,
          },
          { label: m.kpi.read, value: readCount, icon: <CheckCheck /> },
          ...(lastDate
            ? [{ label: m.kpi.lastNotif, value: formatDate(lastDate), icon: <Clock />, valueSize: 'compact' as const }]
            : []),
        ]}
      />

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.errorPrefix} {res.error}
        </div>
      )}

      <NotificationList items={items} basePath="/dashboard" />
    </div>
  );
}
