import Link from 'next/link';
import type { ReactNode } from 'react';
import { FileEdit, Inbox, Bell, CheckCheck, Clock, Megaphone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { NotificationItem, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { NotificationList } from '@/components/notifications/notification-list';
import { cn } from '@/lib/cn';

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

  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.length - unreadCount;
  // Backend returns items sorted newest-first; first item is the most recent.
  const lastDate = items.length > 0 ? (items[0]?.createdAt ?? null) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإشعارات"
        description="متابعة تنبيهات النظام ورسائل المستخدمين وقوالب الإشعارات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الإشعارات' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/notifications/broadcast">
              <Button variant="primary" size="sm" leftIcon={<Megaphone className="h-3.5 w-3.5" />}>
                إرسال يدوي
              </Button>
            </Link>
            <Link href="/dashboard/notifications/templates">
              <Button variant="outline" size="sm" leftIcon={<FileEdit className="h-3.5 w-3.5" />}>
                قوالب الإشعارات
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        <SummaryPill
          icon={<Inbox className="h-3.5 w-3.5" />}
          label="الإجمالي"
          value={items.length}
        />
        <div className="w-px h-6 bg-hairline shrink-0 hidden sm:block" aria-hidden />
        <SummaryPill
          icon={<Bell className="h-3.5 w-3.5" />}
          label="غير مقروءة"
          value={unreadCount}
          emphasis={unreadCount > 0}
        />
        <div className="w-px h-6 bg-hairline shrink-0 hidden sm:block" aria-hidden />
        <SummaryPill
          icon={<CheckCheck className="h-3.5 w-3.5" />}
          label="مقروءة"
          value={readCount}
        />
        {lastDate && (
          <>
            <div className="w-px h-6 bg-hairline shrink-0 hidden sm:block" aria-hidden />
            <SummaryPill
              icon={<Clock className="h-3.5 w-3.5" />}
              label="آخر إشعار"
              value={formatDate(lastDate)}
            />
          </>
        )}
      </div>

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الإشعارات: {res.error}
        </div>
      )}

      <NotificationList items={items} basePath="/dashboard" />
    </div>
  );
}

function SummaryPill({
  icon,
  label,
  value,
  emphasis,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-2xs text-slate-500 leading-none">{label}</span>
        <span className={cn('text-sm font-bold tabular-nums leading-none', emphasis ? 'text-brand-700' : 'text-slate-800')}>
          {value}
        </span>
      </div>
    </div>
  );
}
