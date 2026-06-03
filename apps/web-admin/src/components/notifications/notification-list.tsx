import Link from 'next/link';
import { Bell, CheckCheck, BookmarkCheck, FileText, Wallet, BadgePercent, Users, Activity, MessageSquareText, Wrench, CalendarClock } from 'lucide-react';
import type { NotificationItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/app/_actions/notifications';

interface Props {
  items: NotificationItem[];
  /** Either '/dashboard' or '/portal' — used to build links to entities. */
  basePath: '/dashboard' | '/portal';
}

const TEMPLATE_LABEL: Record<string, string> = {
  broker_lead_submitted: 'فرصة جديدة مرسلة',
  broker_lead_approved: 'تم اعتماد فرصة',
  broker_lead_rejected: 'تم رفض فرصة',
  broker_visit_requested: 'طلب زيارة جديد',
  broker_reservation_created: 'حجز جديد',
  broker_contract_created: 'تم إنشاء عقد',
  broker_contract_signed: 'تم توقيع عقد',
  broker_commission_earned: 'عمولة جديدة',
  broker_commission_approved: 'اعتماد عمولة',
  broker_commission_rejected: 'رفض عمولة',
  broker_payout_created: 'دفعة جديدة',
  broker_payout_approved: 'اعتماد دفعة',
  broker_payout_paid: 'دفعة مدفوعة',
  // P3 — visit lifecycle (staff/admin-facing).
  visit_request_created: 'طلب زيارة جديد',
  // P13 — general info/contact inquiry intake (admin/sales-manager-facing).
  info_request_created: 'استفسار جديد',
  visit_scheduled: 'تم جدولة زيارة',
  visit_sales_assigned: 'تم إسناد زيارة إليك',
  visit_customer_confirmed: 'العميل أكد الزيارة',
  visit_customer_reschedule_requested: 'طلب العميل إعادة الجدولة',
  visit_rescheduled: 'تم تعديل موعد زيارة',
  visit_completed: 'اكتملت الزيارة',
  visit_cancelled: 'تم إلغاء الزيارة',
  visit_no_show: 'تسجيل عدم حضور',
  visit_day_reminder: 'تذكير بزيارة اليوم',
  // P4 — staff-facing labels for the new non-visit events.
  reservation_submitted_admin: 'حجز جديد بانتظار الموافقة',
  reservation_status_changed: 'تحديث حالة حجز',
  reservation_booking_paid: 'تم تأكيد دفعة حجز',
  contract_created_customer: 'تم إنشاء عقد',
  contract_signed_customer: 'تم توقيع عقد',
  deposit_recorded: 'تم تسجيل دفعة',
  deposit_verified: 'تم اعتماد دفعة',
  installment_plan_created: 'خطة تقسيط جديدة',
  broker_lead_marked_duplicate: 'تصنيف فرصة مكررة',
  broker_commission_cancelled: 'إلغاء عمولة',
  broker_commission_paid: 'صرف عمولة',
  broker_payout_processing: 'دفعة قيد المعالجة',
  broker_payout_cancelled: 'إلغاء دفعة',
};

interface RelatedLink {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function relatedLink(
  payload: NotificationItem['payload'],
  base: '/dashboard' | '/portal',
  templateCode: string,
): RelatedLink | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const id = (key: string) => (typeof p[key] === 'string' ? (p[key] as string) : null);
  const leadId = id('leadId');
  const reservationId = id('reservationId');
  const contractId = id('contractId');
  const commissionId = id('commissionId');
  const payoutId = id('payoutId');
  const requestId = id('requestId');
  // Gap 3 — payment-proof review payloads carry depositId + action + entityType.
  const depositId = id('depositId');
  const action = id('action');
  const entityType = id('entityType');
  const entityId = id('entityId');

  if (base === '/dashboard') {
    // Maintenance resolution-loop notifications carry entityType='maintenance'
    // (+ entityId). Checked BEFORE the generic `requestId` branch below —
    // those payloads also carry requestId (= the maintenance request id), which
    // would otherwise mis-route to the inquiries list (/dashboard/requests).
    if (entityType === 'maintenance' && entityId) {
      return { href: `/dashboard/maintenance/${entityId}`, icon: Wrench, label: 'طلب الصيانة' };
    }
    // Visit feedback notifications (visit_feedback_received) carry
    // entityType='visit' + entityId (the appointment). Open the appointment.
    if (entityType === 'visit' && entityId) {
      return { href: `/dashboard/visits/appointments/${entityId}`, icon: CalendarClock, label: 'الزيارة' };
    }
    // Gap 3 — a payment-proof awaiting review (booking amount OR installment)
    // opens the deposit detail where approve/reject lives. Checked early so it
    // doesn't fall through to a contract/reservation link.
    if (depositId && (action === 'review_payment_proof' || entityType === 'deposit')) {
      return { href: `/dashboard/deposits/${depositId}`, icon: Wallet, label: 'الدفعة' };
    }
    // P13 — info_request_created carries requestId; route to the inquiries list
    // (there is no per-request detail page — rows expand inline). Checked first
    // so an inquiry notification never falls through to a broker entity link.
    if (requestId) return { href: `/dashboard/requests`, icon: MessageSquareText, label: 'الاستفسار' };
    if (payoutId) return { href: `/dashboard/broker-payouts/${payoutId}`, icon: Wallet, label: 'الدفعة' };
    if (commissionId) return { href: `/dashboard/broker-commissions/${commissionId}`, icon: BadgePercent, label: 'العمولة' };
    if (contractId) return { href: `/dashboard/broker-contracts/${contractId}`, icon: FileText, label: 'العقد' };
    // Reservation notifications: broker-attributed events keep the broker view;
    // general events (reservation_submitted_admin, reservation_status_changed,
    // reservation_booking_paid) open the standard reservation detail.
    if (reservationId) {
      return templateCode.startsWith('broker_')
        ? { href: `/dashboard/broker-reservations/${reservationId}`, icon: BookmarkCheck, label: 'الحجز' }
        : { href: `/dashboard/reservations/${reservationId}`, icon: BookmarkCheck, label: 'الحجز' };
    }
    if (leadId) return { href: `/dashboard/broker-leads/${leadId}`, icon: Users, label: 'الفرصة' };
  } else {
    if (payoutId) return { href: `/portal/payouts/${payoutId}`, icon: Wallet, label: 'الدفعة' };
    if (commissionId) return { href: `/portal/commissions/${commissionId}`, icon: BadgePercent, label: 'العمولة' };
    if (contractId) return { href: `/portal/contracts/${contractId}`, icon: FileText, label: 'العقد' };
    if (reservationId) return { href: `/portal/reservations/${reservationId}`, icon: BookmarkCheck, label: 'الحجز' };
    if (leadId) return { href: `/portal/leads/${leadId}`, icon: Users, label: 'الفرصة' };
  }
  return null;
}

function summarisePayload(payload: NotificationItem['payload']): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ['leadName', 'unitCode', 'contractNumber', 'commissionNumber', 'payoutNumber', 'amount']) {
    const v = p[key];
    if (typeof v === 'string' || typeof v === 'number') parts.push(String(v));
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

export function NotificationList({ items, basePath }: Props) {
  const unreadCount = items.filter((n) => !n.read).length;

  if (items.length === 0) {
    return (
      <Card className="overflow-hidden">
        <EmptyState
          icon={<Bell />}
          title="لا توجد إشعارات"
          description="عند وصول إشعارات جديدة ستظهر هنا."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-hairline bg-white px-3 py-2 shadow-xs">
          <p className="text-sm text-slate-700">
            <span className="font-semibold tabular-nums">{unreadCount}</span> إشعار غير مقروء
          </p>
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="basePath" value={basePath} />
            <Button type="submit" variant="ghost" size="sm" leftIcon={<CheckCheck className="h-3.5 w-3.5" />}>
              تعليم الكل كمقروء
            </Button>
          </form>
        </div>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-hairline">
          {items.map((n) => {
            const related = relatedLink(n.payload, basePath, n.templateCode);
            const label = TEMPLATE_LABEL[n.templateCode] ?? n.templateCode;
            const summary = summarisePayload(n.payload);
            return (
              <li
                key={n.id}
                className={cn(
                  'px-4 py-3 flex items-start gap-3',
                  !n.read && 'bg-brand-50/40',
                )}
              >
                <div className="mt-0.5">
                  <span
                    aria-hidden
                    className={cn(
                      'inline-block h-2 w-2 rounded-full',
                      n.read ? 'bg-slate-300' : 'bg-brand-500',
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <span className="text-2xs text-slate-500 shrink-0">{formatDateTime(n.createdAt)}</span>
                  </div>
                  {summary && (
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{summary}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    {related && (
                      <Link
                        href={related.href as never}
                        className="text-xs text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                      >
                        <related.icon className="h-3 w-3" />
                        فتح {related.label}
                      </Link>
                    )}
                    {!n.read && (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="basePath" value={basePath} />
                        <button
                          type="submit"
                          className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                        >
                          <Activity className="h-3 w-3" />
                          تعليم كمقروء
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
