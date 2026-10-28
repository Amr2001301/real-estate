import Link from 'next/link';
import { FileEdit, Clock, Megaphone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { NotificationItem, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { NotificationList } from '@/components/notifications/notification-list';
import { Pagination } from '@/components/ui/pagination';
import {
  NotificationPreferences,
  type NotificationPrefs,
} from '@/components/notifications/notification-preferences';
import { PremiumPageHero, PremiumPanel } from '@/components/premium';
import { getSession } from '@/lib/session';
import { getMyCodes } from '@/lib/permissions';
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

const PAGE_SIZE = 20;

export default async function AdminNotificationsInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const locale = await getLocale();
  // The server writes each title and message in the reader's language.
  const lang = { headers: { 'Accept-Language': locale } };
  const [res, unreadRes] = await Promise.all([
    safe(
      api.get<Paged<NotificationItem> | NotificationItem[]>(
        `/me/notifications?page=${page}&pageSize=${PAGE_SIZE}`,
        lang,
      ),
    ),
    safe(api.get<{ count: number }>('/me/notifications/unread-count')),
  ]);
  const [prefsRes, session] = await Promise.all([
    safe(api.get<NotificationPrefs>('/users/me/notification-preferences')),
    getSession(),
  ]);
  const m = uiT(locale).pages.notifications;

  const items = extractItems(res.data);
  // Totals across every page, not only the one shown.
  const total =
    res.data && !Array.isArray(res.data) && res.data.meta ? res.data.meta.total : items.length;
  const unreadCount = unreadRes.data?.count ?? items.filter((n) => !n.read).length;
  // Backend returns items sorted newest-first; first item is the most recent.
  const lastDate = page === 1 && items.length > 0 ? (items[0]?.createdAt ?? null) : null;

  const isAdmin = session?.role === 'ADMIN';
  // Sending and the templates open to whoever holds their code (PRM).
  const codes = await getMyCodes();
  const canSend = isAdmin || codes.has('notifications:send');
  const canTemplates = isAdmin || codes.has('notifications:templates:manage');

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={isAdmin ? m.description : m.descriptionStaff}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        meta={
          lastDate ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-[11.5px] font-semibold text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {m.kpi.lastNotif}: {formatDate(lastDate, locale)}
            </span>
          ) : undefined
        }
        actions={
          // Sending and the templates: the admin, or whoever holds their code.
          canSend || canTemplates ? (
            <div className="flex items-center gap-2" data-testid="notifications-admin-actions">
              {canSend && (
                <Link href="/dashboard/notifications/broadcast">
                  <Button variant="primary" size="sm" leftIcon={<Megaphone className="h-3.5 w-3.5" />}>
                    {m.sendBtn}
                  </Button>
                </Link>
              )}
              {canTemplates && (
                <Link href="/dashboard/notifications/templates">
                  <Button variant="outline" size="sm" leftIcon={<FileEdit className="h-3.5 w-3.5" />}>
                    {m.templatesBtn}
                  </Button>
                </Link>
              )}
            </div>
          ) : undefined
        }
      />

      {res.error && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">
          {m.errorPrefix} {res.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <PremiumPanel
          className="lg:col-span-2"
          title={m.inboxTitle}
          sub={m.inboxSub(total, unreadCount)}
          padding="none"
        >
          <NotificationList items={items} basePath="/dashboard" locale={locale} bare />
        </PremiumPanel>

        {prefsRes.data && (
          <PremiumPanel title={m.prefsTitle} padding="none">
            <NotificationPreferences initial={prefsRes.data} locale={locale} bare />
          </PremiumPanel>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/dashboard/notifications"
        locale={locale}
      />
    </div>
  );
}
