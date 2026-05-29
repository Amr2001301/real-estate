import { Bell, Check } from 'lucide-react';
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
  deposit_verified: 'تم اعتماد دفعتك',
};

export function notificationTitle(code: string): string {
  return NOTIFICATION_LABELS[code] ?? 'إشعار جديد';
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function NotificationCard({ notification }: { notification: MeNotification }) {
  const unread = notification.readAt === null;
  const title = notificationTitle(notification.templateCode);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        unread ? 'border-gold-300 bg-gold-100/40' : 'border-hairline bg-surface',
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          unread ? 'bg-gold-400 text-navy' : 'bg-surface-soft text-ink-muted',
        )}
      >
        <Bell className="h-5 w-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-hidden />}
          <h3 className="line-clamp-2 text-sm font-semibold text-ink-strong">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-ink-muted">{formatDateTime(notification.createdAt)}</p>
      </div>

      {unread ? (
        <form action={markNotificationReadAction.bind(null, notification.id)} className="shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-gold-600 transition-colors hover:bg-gold-100"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            تحديد كمقروء
          </button>
        </form>
      ) : (
        <span className="shrink-0 text-xs text-ink-muted/70">مقروء</span>
      )}
    </div>
  );
}
