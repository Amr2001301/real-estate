import {
  Bell,
  Wrench,
  FileText,
  Wallet,
  CalendarClock,
  BookmarkCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MeNotification } from '@/lib/api-types';
import { notificationHref } from '@/lib/notification-link';
import { notificationTitle } from '@/lib/notification-title';

export { notificationTitle };
import { NotificationRow } from '@/components/account/NotificationRow';

/**
 * Maps a notification to a semantic icon + tinted chip, keyed off the template
 * code (robust) with an Arabic-title fallback. Tones use theme tokens so they
 * stay legible in dark mode: warning=amber (maintenance), success=green
 * (contracts/payments), gold=brand (scheduling + general). The chip string
 * includes its own `ring-1` so any consumer (this row, the dashboard's
 * RecentRow) can apply it directly for a consistent look across the app.
 */
export function notificationVisual(code: string, title: string): { Icon: LucideIcon; chip: string } {
  const c = code.toLowerCase();
  if (c.includes('maintenance') || title.includes('صيانة')) {
    return { Icon: Wrench, chip: 'bg-warning/10 text-warning ring-1 ring-warning/20' };
  }
  if (c.includes('contract') || c.includes('document') || title.includes('عقد') || title.includes('تحميل')) {
    return { Icon: FileText, chip: 'bg-success/10 text-success ring-1 ring-success/20' };
  }
  if (
    c.includes('deposit') ||
    c.includes('installment') ||
    c.includes('booking_paid') ||
    title.includes('دفعة') ||
    title.includes('قسط')
  ) {
    return { Icon: Wallet, chip: 'bg-success/10 text-success ring-1 ring-success/20' };
  }
  if (c.includes('visit') || title.includes('زيار') || title.includes('جدولة')) {
    return { Icon: CalendarClock, chip: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70' };
  }
  if (c.includes('reservation') || title.includes('حجز')) {
    return { Icon: BookmarkCheck, chip: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70' };
  }
  return { Icon: Bell, chip: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70' };
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/**
 * One notification row. When the payload resolves to a customer route the whole
 * row becomes a link to that page (marking the notification read on click if it
 * was unread). Otherwise an UNREAD row stays a click-to-mark-read affordance and
 * a READ row is static. Designed to sit inside a divided list container.
 */
export function NotificationCard({
  notification,
  locale = 'ar',
}: {
  notification: MeNotification;
  locale?: string;
}) {
  const unread = !notification.read;
  const title = notificationTitle(notification.templateCode, notification.title);
  const body = notification.body?.trim();
  const { Icon, chip } = notificationVisual(notification.templateCode, title);
  const href = notificationHref(notification.payload);

  const inner = (
    <>
      {/* Semantic icon — far start (right in RTL) */}
      <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', chip)}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>

      {/* Title + message + timestamp */}
      <div className="min-w-0 flex-1">
        <h3 className={cn('line-clamp-2 text-sm font-semibold', unread ? 'text-ink-strong' : 'text-ink')}>
          {title}
        </h3>
        {body && <p className="mt-0.5 line-clamp-3 text-sm text-ink">{body}</p>}
        <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(notification.createdAt, locale)}</p>
      </div>

      {/* Unread dot — far end (left in RTL). Read rows show nothing. */}
      {unread && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold-500 shadow-[0_0_8px_rgba(200,162,75,0.6)]"
          aria-hidden
        />
      )}
    </>
  );

  const base = cn(
    'flex w-full items-center gap-3.5 p-4 text-start transition-colors duration-200',
    (unread || href) && 'cursor-pointer hover:bg-surface-soft/60',
  );

  return (
    <NotificationRow id={notification.id} href={href} unread={unread} className={base}>
      {inner}
    </NotificationRow>
  );
}
