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
import { markNotificationReadAction } from '@/lib/account-actions';

/**
 * templateCode → Arabic label. Records have no title/body, so this is the
 * source of human-readable titles. Unknown codes fall back to "إشعار جديد".
 */
const NOTIFICATION_LABELS: Record<string, string> = {
  visit_approved: 'تمت الموافقة على طلب الزيارة',
  // P3 — visit lifecycle (customer-facing). Server resolves title/body when
  // a template row exists; these client-side strings are the fallback for
  // legacy rows or when title is missing.
  visit_request_created: 'تم استلام طلب الزيارة',
  visit_scheduled: 'تم جدولة زيارتك',
  visit_rescheduled: 'تم تغيير موعد زيارتك',
  visit_completed: 'اكتملت زيارتك',
  visit_cancelled: 'تم إلغاء الزيارة',
  visit_no_show: 'تسجيل عدم الحضور',
  visit_day_reminder: 'تذكير بزيارتك اليوم',
  maintenance_request_created: 'تم إنشاء طلب الصيانة',
  maintenance_request_assigned: 'تم إسناد طلب الصيانة',
  maintenance_request_status_changed: 'تحديث حالة طلب الصيانة',
  maintenance_request_resolved: 'تم حل طلب الصيانة',
  maintenance_request_closed: 'تم إغلاق طلب الصيانة',
  // P4 — customer-facing labels for the new event codes.
  reservation_status_changed: 'تحديث حالة الحجز',
  reservation_booking_paid: 'تم تأكيد دفعة الحجز',
  contract_created_customer: 'تم إنشاء عقدك',
  contract_signed_customer: 'تم توقيع عقدك',
  // P12 — a downloadable contract document is now available.
  contract_document_available: 'عقدك جاهز للتحميل',
  deposit_verified: 'تم اعتماد دفعتك',
  // P11.7 — installment due-soon reminder.
  installment_due_soon: 'تذكير بقسط مستحق قريباً',
};

export function notificationTitle(code: string): string {
  return NOTIFICATION_LABELS[code] ?? 'إشعار جديد';
}

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

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/**
 * One notification row. UNREAD rows are a submit button that marks the
 * notification read on click (whole-row affordance + cursor-pointer); READ rows
 * are static and ultra-clean (no dot, no action). Designed to sit inside a
 * divided list container.
 */
export function NotificationCard({ notification }: { notification: MeNotification }) {
  const unread = notification.readAt === null;
  const title = notificationTitle(notification.templateCode);
  const { Icon, chip } = notificationVisual(notification.templateCode, title);

  const inner = (
    <>
      {/* Semantic icon — far start (right in RTL) */}
      <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', chip)}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>

      {/* Title + timestamp */}
      <div className="min-w-0 flex-1">
        <h3 className={cn('line-clamp-2 text-sm font-semibold', unread ? 'text-ink-strong' : 'text-ink')}>
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(notification.createdAt)}</p>
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

  const base = 'flex w-full items-center gap-3.5 p-4 text-start transition-colors duration-200';

  if (unread) {
    return (
      <form action={markNotificationReadAction.bind(null, notification.id)} className="block">
        <button
          type="submit"
          aria-label={`تحديد كمقروء: ${title}`}
          className={cn(base, 'cursor-pointer hover:bg-surface-soft/60')}
        >
          {inner}
        </button>
      </form>
    );
  }

  return <div className={base}>{inner}</div>;
}
