import type { Route } from 'next';
import Link from 'next/link';
import {
  Building2,
  Home,
  CalendarClock,
  CalendarCheck,
  UserRound,
  MessageSquare,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, cityLabel, unitTypeLabel } from '@/lib/format';
import type { MeVisitRequest, MeAppointmentSummary } from '@/lib/api-types';
import { StatusBadge } from '@/components/account/StatusBadge';
import { formatDateTimeShort } from '@/lib/format';
import { VisitConfirmActions } from '@/components/account/VisitConfirmActions';
import { VisitFeedback } from '@/components/account/VisitFeedback';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** Visit statuses worth surfacing when there's no appointment yet. */
const PROGRESSED = new Set(['APPROVED', 'SCHEDULED', 'COMPLETED']);

function TicketRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-600 ring-1 ring-gold-200/60">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-ink-muted">{label}</div>
        <div className="mt-0.5 text-sm font-medium leading-snug text-ink-strong" dir="auto">
          {value}
        </div>
      </div>
    </div>
  );
}

export async function VisitRequestCard({ visit }: { visit: MeVisitRequest }) {
  const locale = await getLocale();
  const t = accountT(locale);
  const tv = t.visit;
  const projectName = visit.project ? pickAr(visit.project.name, '', locale) : '';
  const unitLabel = visit.unit ? `${unitTypeLabel(visit.unit.type, null, locale)} · ${visit.unit.code}` : '';
  const title = projectName || unitLabel || tv.title;
  const subtitle = projectName ? unitLabel || cityLabel(visit.project?.city, locale) : '';
  const TypeIcon = visit.unit ? Home : Building2;

  const detailHref: Route | null = visit.unit
    ? (routes.unit(visit.unit.id) as Route)
    : visit.project
      ? (routes.project(visit.project.id) as Route)
      : null;

  // P2 — appointment lifecycle. SCHEDULED → the customer must confirm or request
  // a reschedule; other states are informational only.
  const appointment = visit.appointments?.[0] ?? null;
  const awaitingCustomer = appointment?.status === 'SCHEDULED';
  const pendingReschedule = appointment?.status === 'PENDING_RESCHEDULE';
  const suggested = appointment?.scheduledAt ?? (!appointment ? visit.scheduledAt : null);
  const suggestedLabel = appointment ? tv.suggested : tv.fixed;

  // A single, most-meaningful badge.
  const badge: { status: string; label?: string } | null = appointment
    ? { status: appointment.status, label: t.appointment[appointment.status] }
    : visit.requestStatus
      ? { status: visit.requestStatus }
      : PROGRESSED.has(visit.status)
        ? { status: visit.status }
        : null;

  return (
    <div className="group relative isolate flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-xl">
      {/* Architectural watermark — large, ultra-subtle, behind everything */}
      <TypeIcon
        className="pointer-events-none absolute -bottom-8 -left-8 -z-10 h-48 w-48 text-ink-strong opacity-[0.05]"
        strokeWidth={1}
        aria-hidden
      />

      {/* Stretched link: whole card navigates. Sibling overlay so the confirm
          controls can layer above it — a button inside an <a> is invalid HTML. */}
      {detailHref && (
        <Link href={detailHref} aria-label={tv.viewDetails(title)} className="absolute inset-0 z-[1]" />
      )}

      {/* ── Header: title (start) ⟷ badge (end) ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-lg font-bold tracking-tight text-ink-strong">{title}</h3>
          {subtitle && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
              <span className="line-clamp-1">{subtitle}</span>
            </p>
          )}
        </div>
        {badge && (
          <StatusBadge
            status={badge.status}
            label={badge.label}
            className="shrink-0 px-3 font-semibold shadow-sm ring-1 ring-black/5"
          />
        )}
      </div>

      {/* ── Visit Ticket ── */}
      <div className="mt-4 space-y-4 rounded-xl border border-hairline bg-surface-soft/60 p-4">
        <div className="space-y-3.5">
          <TicketRow icon={CalendarClock} label={tv.preferred} value={formatDateTimeShort(visit.preferredDate, locale)} />
          {suggested && <TicketRow icon={CalendarCheck} label={suggestedLabel} value={formatDateTimeShort(suggested, locale)} />}
          {visit.assignedSales && (
            <TicketRow icon={UserRound} label={tv.advisor} value={visit.assignedSales.fullName} />
          )}
        </div>

        {/* User comment — mini speech-bubble at the very bottom of the ticket */}
        {visit.notes && (
          <div className="flex items-start gap-2 rounded-xl border border-hairline bg-surface p-3 text-xs leading-relaxed text-ink-muted">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
            <p className="line-clamp-3" dir="auto">
              {visit.notes}
            </p>
          </div>
        )}
      </div>

      {pendingReschedule && appointment?.customerFeedback && (
        <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
          {tv.rescheduleReason} <span className="font-medium">{appointment.customerFeedback}</span>
        </p>
      )}

      {/* Interactive controls sit ABOVE the stretched link (z-[2]) */}
      {awaitingCustomer && appointment && (
        <div className="relative z-[2] mt-3">
          <VisitConfirmActions appointmentId={appointment.id} />
        </div>
      )}

      {/* Gap 7 — post-visit feedback (form when COMPLETED + unrated, else the
          read-only rating). Above the stretched link so the controls work. */}
      {appointment?.status === 'COMPLETED' && (
        <div className="relative z-[2]">
          <VisitFeedback appointment={appointment} />
        </div>
      )}
    </div>
  );
}
