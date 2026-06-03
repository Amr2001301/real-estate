import {
  Bell, CheckCheck, BookmarkCheck, FileText, Wallet, BadgePercent, Users,
  MessageSquareText, Wrench, CalendarClock, type LucideIcon,
} from 'lucide-react';
import type { NotificationItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { markAllNotificationsReadAction } from '@/app/_actions/notifications';
import { AdminNotificationRow } from './notification-row';

interface Props {
  items: NotificationItem[];
  /** Either '/dashboard' or '/portal' — used to build links to entities. */
  basePath: '/dashboard' | '/portal';
}

// Arabic fallback titles by template code. Prefer these so old rows whose API
// `title` is still a raw code remain readable. New codes added for the
// maintenance/payment-proof/visit-feedback events.
const TEMPLATE_LABEL: Record<string, string> = {
  // Broker
  broker_lead_submitted: 'فرصة جديدة مرسلة',
  broker_lead_approved: 'تم اعتماد فرصة',
  broker_lead_rejected: 'تم رفض فرصة',
  broker_lead_marked_duplicate: 'تصنيف فرصة مكررة',
  broker_visit_requested: 'طلب زيارة جديد',
  broker_reservation_created: 'حجز جديد',
  broker_contract_created: 'تم إنشاء عقد',
  broker_contract_signed: 'تم توقيع عقد',
  broker_commission_earned: 'عمولة جديدة',
  broker_commission_approved: 'اعتماد عمولة',
  broker_commission_rejected: 'رفض عمولة',
  broker_commission_cancelled: 'إلغاء عمولة',
  broker_commission_paid: 'صرف عمولة',
  broker_payout_created: 'دفعة جديدة',
  broker_payout_approved: 'اعتماد دفعة',
  broker_payout_processing: 'دفعة قيد المعالجة',
  broker_payout_paid: 'دفعة مدفوعة',
  broker_payout_cancelled: 'إلغاء دفعة',
  // Visits
  visit_request_created: 'طلب زيارة جديد',
  visit_scheduled: 'تم جدولة زيارة',
  visit_sales_assigned: 'تم إسناد زيارة إليك',
  visit_customer_confirmed: 'العميل أكد الزيارة',
  visit_confirmed: 'تم تأكيد الزيارة',
  visit_customer_reschedule_requested: 'طلب العميل إعادة الجدولة',
  visit_rescheduled: 'تم إعادة جدولة الزيارة',
  visit_completed: 'اكتملت الزيارة',
  visit_cancelled: 'تم إلغاء الزيارة',
  visit_no_show: 'تسجيل عدم حضور',
  visit_day_reminder: 'تذكير بزيارة اليوم',
  visit_feedback_requested: 'مطلوب تقييم الزيارة',
  visit_feedback_received: 'تقييم زيارة جديد',
  // Inquiries
  info_request_created: 'استفسار جديد',
  // Reservations
  reservation_submitted_admin: 'حجز جديد بانتظار الموافقة',
  reservation_status_changed: 'تحديث حالة حجز',
  reservation_booking_paid: 'تم تأكيد دفعة حجز',
  reservation_payment_requested: 'مطلوب دفع مبلغ الحجز',
  // Contracts
  contract_created_customer: 'تم إنشاء عقد',
  contract_signed_customer: 'تم توقيع عقد',
  // Deposits / payment proofs
  deposit_recorded: 'تم تسجيل دفعة',
  deposit_verified: 'تم اعتماد دفعة',
  payment_proof_submitted: 'إثبات دفع جديد',
  booking_payment_proof_submitted: 'إثبات دفع حجز جديد',
  payment_proof_resubmitted: 'إعادة إرسال إثبات الدفع',
  payment_proof_approved: 'تم قبول إثبات الدفع',
  payment_proof_rejected: 'تم رفض إثبات الدفع',
  // Installments
  installment_plan_created: 'خطة تقسيط جديدة',
  installment_due_soon: 'قسط مستحق قريبًا',
  // Maintenance
  maintenance_request_created: 'طلب صيانة جديد',
  maintenance_request_assigned: 'تم تعيين طلب صيانة',
  maintenance_request_status_changed: 'تحديث حالة طلب الصيانة',
  maintenance_request_resolved: 'تم حل طلب الصيانة',
  maintenance_request_closed: 'تم إغلاق طلب الصيانة',
  maintenance_request_complaint_submitted: 'شكوى صيانة جديدة',
  maintenance_request_unresolved: 'طلب صيانة لم يُحل',
  maintenance_request_resolution_confirmed: 'تأكيد حل طلب الصيانة',
};

interface RelatedLink {
  href: string;
  icon: LucideIcon;
  label: string;
}

/** Map a notification payload/templateCode → dashboard/portal entity link.
 *  entityType (new) wins over legacy id keys; maintenance must beat the generic
 *  `requestId` → inquiries route. Returns null for unknown payloads. */
function relatedLink(
  payload: NotificationItem['payload'],
  base: '/dashboard' | '/portal',
  templateCode: string,
): RelatedLink | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const id = (key: string) => (typeof p[key] === 'string' ? (p[key] as string) : null);
  const isBroker = templateCode.startsWith('broker_');

  const entityType = id('entityType');
  const entityId = id('entityId');
  const leadId = id('leadId');
  const reservationId = id('reservationId');
  const contractId = id('contractId');
  const commissionId = id('commissionId');
  const payoutId = id('payoutId');
  const requestId = id('requestId');
  const infoRequestId = id('infoRequestId');
  const depositId = id('depositId');
  const maintenanceRequestId = id('maintenanceRequestId');
  const visitId = id('visitId');
  const appointmentId = id('appointmentId');

  if (base === '/dashboard') {
    // New entityType payloads first (maintenance/visit must beat legacy requestId).
    if (entityType === 'maintenance' && entityId) {
      return { href: `/dashboard/maintenance/${entityId}`, icon: Wrench, label: 'طلب الصيانة' };
    }
    if (entityType === 'visit' && entityId) {
      return { href: `/dashboard/visits/appointments/${entityId}`, icon: CalendarClock, label: 'الزيارة' };
    }
    if (maintenanceRequestId) {
      return { href: `/dashboard/maintenance/${maintenanceRequestId}`, icon: Wrench, label: 'طلب الصيانة' };
    }
    // Any deposit notification (submitted/approved/rejected/review) → deposit detail.
    if (depositId) {
      return { href: `/dashboard/deposits/${depositId}`, icon: Wallet, label: 'الدفعة' };
    }
    // Visit appointment (legacy visitId/appointmentId) before requestId.
    if (visitId || appointmentId) {
      return { href: `/dashboard/visits/appointments/${visitId ?? appointmentId}`, icon: CalendarClock, label: 'الزيارة' };
    }
    if (payoutId) return { href: `/dashboard/broker-payouts/${payoutId}`, icon: Wallet, label: 'الدفعة' };
    if (commissionId) return { href: `/dashboard/broker-commissions/${commissionId}`, icon: BadgePercent, label: 'العمولة' };
    if (contractId) {
      return isBroker
        ? { href: `/dashboard/broker-contracts/${contractId}`, icon: FileText, label: 'العقد' }
        : { href: `/dashboard/contracts/${contractId}`, icon: FileText, label: 'العقد' };
    }
    if (reservationId) {
      return isBroker
        ? { href: `/dashboard/broker-reservations/${reservationId}`, icon: BookmarkCheck, label: 'الحجز' }
        : { href: `/dashboard/reservations/${reservationId}`, icon: BookmarkCheck, label: 'الحجز' };
    }
    // Inquiries (info/visit request intake — no per-row detail page).
    if (requestId || infoRequestId) {
      return { href: `/dashboard/requests`, icon: MessageSquareText, label: 'الاستفسار' };
    }
    if (leadId) {
      return isBroker
        ? { href: `/dashboard/broker-leads/${leadId}`, icon: Users, label: 'الفرصة' }
        : { href: `/dashboard/leads/${leadId}`, icon: Users, label: 'الفرصة' };
    }
  } else {
    if (payoutId) return { href: `/portal/payouts/${payoutId}`, icon: Wallet, label: 'الدفعة' };
    if (commissionId) return { href: `/portal/commissions/${commissionId}`, icon: BadgePercent, label: 'العمولة' };
    if (contractId) return { href: `/portal/contracts/${contractId}`, icon: FileText, label: 'العقد' };
    if (reservationId) return { href: `/portal/reservations/${reservationId}`, icon: BookmarkCheck, label: 'الحجز' };
    if (leadId) return { href: `/portal/leads/${leadId}`, icon: Users, label: 'الفرصة' };
  }
  return null;
}

/** Category icon (+ tint) by template code — for the row even when unlinked. */
function categoryVisual(code: string, related: RelatedLink | null): { Icon: LucideIcon; chip: string } {
  const c = code.toLowerCase();
  if (c.includes('maintenance')) return { Icon: Wrench, chip: 'bg-amber-50 text-amber-600' };
  if (c.includes('payment_proof') || c.includes('deposit')) return { Icon: Wallet, chip: 'bg-emerald-50 text-emerald-600' };
  if (c.includes('payout')) return { Icon: Wallet, chip: 'bg-emerald-50 text-emerald-600' };
  if (c.includes('commission')) return { Icon: BadgePercent, chip: 'bg-violet-50 text-violet-600' };
  if (c.includes('contract')) return { Icon: FileText, chip: 'bg-sky-50 text-sky-600' };
  if (c.includes('reservation')) return { Icon: BookmarkCheck, chip: 'bg-brand-50 text-brand-600' };
  if (c.includes('visit')) return { Icon: CalendarClock, chip: 'bg-brand-50 text-brand-600' };
  if (c.includes('lead')) return { Icon: Users, chip: 'bg-slate-100 text-slate-600' };
  if (c.includes('request') || c.includes('inquiry')) return { Icon: MessageSquareText, chip: 'bg-slate-100 text-slate-600' };
  if (related) return { Icon: related.icon, chip: 'bg-slate-100 text-slate-600' };
  return { Icon: Bell, chip: 'bg-slate-100 text-slate-600' };
}

/** Never returns the raw template code. */
function resolveTitle(n: NotificationItem): string {
  const mapped = TEMPLATE_LABEL[n.templateCode];
  if (mapped) return mapped;
  const t = n.title?.trim();
  if (t && t !== n.templateCode) return t;
  return 'إشعار جديد';
}

function summarisePayload(payload: NotificationItem['payload']): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ['leadName', 'customerName', 'unitCode', 'projectName', 'contractNumber', 'commissionNumber', 'payoutNumber', 'reference', 'amount']) {
    const v = p[key];
    if ((typeof v === 'string' || typeof v === 'number') && String(v).trim()) parts.push(String(v));
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

function resolveBody(n: NotificationItem): string | null {
  const b = n.body?.trim();
  if (b && b !== n.templateCode) return b;
  return summarisePayload(n.payload);
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
            const title = resolveTitle(n);
            const body = resolveBody(n);
            const { Icon, chip } = categoryVisual(n.templateCode, related);
            const unread = !n.read;
            const rowClass = cn(
              'flex w-full items-start gap-3.5 px-4 py-3.5 text-start transition-colors',
              (unread || related) && 'cursor-pointer hover:bg-slate-50',
              unread && 'bg-brand-50/40',
            );
            return (
              <li key={n.id}>
                <AdminNotificationRow
                  id={n.id}
                  href={related?.href ?? null}
                  unread={unread}
                  basePath={basePath}
                  className={rowClass}
                >
                  <span className={cn('mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', chip)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm', unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                        {title}
                      </p>
                      <span className="shrink-0 text-2xs text-slate-400">{formatDateTime(n.createdAt)}</span>
                    </div>
                    {body && <p className="mt-0.5 truncate text-xs text-slate-500">{body}</p>}
                    {related && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                        <related.icon className="h-3 w-3" />
                        فتح {related.label}
                      </span>
                    )}
                  </div>
                  {unread && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  )}
                </AdminNotificationRow>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
