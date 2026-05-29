import type { Route } from 'next';
import Link from 'next/link';
import { Building2, Home, CalendarClock, CalendarCheck, UserRound, ArrowLeft, MessageSquare } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, cityLabel, unitTypeLabel } from '@/lib/format';
import type { MeVisitRequest, MeAppointmentSummary } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { StatusBadge } from '@/components/account/StatusBadge';
import { VisitConfirmActions } from '@/components/account/VisitConfirmActions';

/** Visit statuses worth surfacing as a secondary chip beside the request status. */
const PROGRESSED = new Set(['APPROVED', 'SCHEDULED', 'COMPLETED']);

/** Arabic label for the appointment lifecycle state — must stay in lockstep
 *  with the admin badges to give the customer the same vocabulary. */
const APPOINTMENT_LABEL: Record<MeAppointmentSummary['status'], string> = {
  SCHEDULED: 'بانتظار تأكيدك',
  CONFIRMED: 'مؤكدة',
  PENDING_RESCHEDULE: 'طلبت إعادة الجدولة',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
  NO_SHOW: 'لم تحضر',
  RESCHEDULED: 'أُعيدت جدولتها',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function VisitRequestCard({ visit }: { visit: MeVisitRequest }) {
  const projectName = visit.project ? pickAr(visit.project.name) : '';
  const unitLabel = visit.unit ? `${unitTypeLabel(visit.unit.type)} · ${visit.unit.code}` : '';
  const title = projectName || unitLabel || 'طلب زيارة';
  const subtitle = projectName ? unitLabel || cityLabel(visit.project?.city) : '';

  const detailHref: Route | null = visit.unit
    ? (routes.unit(visit.unit.id) as Route)
    : visit.project
      ? (routes.project(visit.project.id) as Route)
      : null;

  // P2 — the customer's view of the appointment lifecycle. The backend now
  // includes the latest appointment; if `appointments[0]` is SCHEDULED, the
  // customer is being asked to confirm or request a reschedule. Other states
  // surface as informational chips only.
  const appointment = visit.appointments?.[0] ?? null;
  const awaitingCustomer = appointment?.status === 'SCHEDULED';
  const pendingReschedule = appointment?.status === 'PENDING_RESCHEDULE';

  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
            {visit.unit ? <Home className="h-[18px] w-[18px]" aria-hidden /> : <Building2 className="h-[18px] w-[18px]" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">{title}</h3>
            {subtitle && <p className="line-clamp-1 text-xs text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <StatusBadge status={visit.requestStatus} />
          {appointment ? (
            <StatusBadge status={appointment.status} label={APPOINTMENT_LABEL[appointment.status]} />
          ) : (
            PROGRESSED.has(visit.status) && <StatusBadge status={visit.status} />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-gold-500" aria-hidden />
          الموعد المفضل: <span className="font-medium text-ink-strong">{formatDateTime(visit.preferredDate)}</span>
        </span>
        {appointment?.scheduledAt && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-gold-500" aria-hidden />
            الموعد المقترح: <span className="font-medium text-ink-strong">{formatDateTime(appointment.scheduledAt)}</span>
          </span>
        )}
        {!appointment && visit.scheduledAt && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-gold-500" aria-hidden />
            موعد محدد: <span className="font-medium text-ink-strong">{formatDateTime(visit.scheduledAt)}</span>
          </span>
        )}
        {visit.assignedSales && (
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-4 w-4 text-gold-500" aria-hidden />
            المستشار: <span className="font-medium text-ink-strong">{visit.assignedSales.fullName}</span>
          </span>
        )}
      </div>

      {visit.notes && (
        <p className="mt-3 rounded-xl bg-surface-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink-muted">
          {visit.notes}
        </p>
      )}

      {pendingReschedule && appointment?.customerFeedback && (
        <p className="mt-3 inline-flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-800">
          <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            سبب طلب إعادة الجدولة: <span className="font-medium">{appointment.customerFeedback}</span>
          </span>
        </p>
      )}

      {awaitingCustomer && appointment && (
        <VisitConfirmActions appointmentId={appointment.id} />
      )}

      {detailHref && (
        <Link
          href={detailHref}
          className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold-600 transition-colors hover:text-gold-500"
        >
          عرض التفاصيل
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        </Link>
      )}
    </PremiumCard>
  );
}
