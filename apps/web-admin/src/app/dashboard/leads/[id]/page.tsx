import Link from 'next/link';
import {
  Phone,
  Mail,
  Building2,
  Calendar,
  ArrowLeft,
  ExternalLink,
  Briefcase,
  DoorOpen,
  Hash,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import type { Lead, Paged, Reservation, LeadStage, VisitRequest, VisitAppointment } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ReservationStatusBadge,
  VisitRequestStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import { StageSegmented } from '@/components/crm/stage-segmented';
import { addNoteAction, assignLeadAction } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';
import { PremiumDetailLayout, PremiumPanel, PremiumEmptyNote } from '@/components/premium';
import { cn } from '@/lib/cn';
import { EntityLink } from '@/components/entity-link';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface LeadDetail extends Lead {
  activities?: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

const STAGES: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

// ── Stage style maps ──────────────────────────────────────────────────────────

const STAGE_CHIP: Record<LeadStage, string> = {
  NEW:         'bg-slate-500/10 text-slate-600',
  INTERESTED:  'bg-sky-500/12 text-sky-600',
  VISIT:       'bg-violet-500/12 text-violet-600',
  NEGOTIATION: 'bg-amber-500/12 text-amber-600',
  WON:         'bg-emerald-500/12 text-emerald-600',
  LOST:        'bg-danger-500/12 text-danger-600',
};

const STAGE_DOT: Record<LeadStage, string> = {
  NEW:         'bg-slate-400',
  INTERESTED:  'bg-sky-400',
  VISIT:       'bg-violet-400',
  NEGOTIATION: 'bg-amber-400',
  WON:         'bg-emerald-400',
  LOST:        'bg-rose-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).leadDetailPage;

  const STAGE_LABEL: Record<LeadStage, string> = {
    NEW:         m.stageNew,
    INTERESTED:  m.stageInterested,
    VISIT:       m.stageVisit,
    NEGOTIATION: m.stageNegotiation,
    WON:         m.stageWon,
    LOST:        m.stageLost,
  };

  const RESERVATION_LABELS: Record<string, string> = {
    CREATED:   m.activityReservationCreated,
    APPROVED:  m.activityReservationApproved,
    REJECTED:  m.activityReservationRejected,
    CANCELLED: m.activityReservationCancelled,
    EXPIRED:   m.activityReservationExpired,
  };

  // Assigning is for admins and sales managers (a manager within their team).
  const session = await getSession();
  const canAssign = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const [leadRes, salesRes, visitRequestsRes, appointmentsRes, reservationsRes] =
    await Promise.all([
      safe(api.get<LeadDetail>(`/leads/${id}`)),
      safe(staffOptions(['SALES', 'SALES_MANAGER'])),
      safe(api.get<Paged<VisitRequest>>(`/visits/requests?leadId=${id}&pageSize=10`)),
      safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?leadId=${id}&pageSize=10`)),
      safe(api.get<Paged<Reservation>>(`/reservations?leadId=${id}&pageSize=10`)),
    ]);

  if (leadRes.error || !leadRes.data) {
    return (
      <div className="flex items-start gap-3 rounded-[20px] bg-danger-500/10 text-danger-600 p-6 text-sm">
        {m.errorLoad} {leadRes.error ?? m.errorNotFound}
      </div>
    );
  }

  const lead = leadRes.data;
  const visitRequests = visitRequestsRes.data?.data ?? [];
  const appointments = appointmentsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];

  const displayName  = lead.client?.fullName ?? lead.fullName ?? m.unknownLead;
  const displayPhone = lead.client?.phone ?? lead.phone ?? null;
  const displayEmail = lead.client?.email ?? lead.email ?? null;
  const isBrokerLead = !!lead.brokerId;
  const brokerName   = lead.broker?.commercialName || lead.broker?.companyName || lead.broker?.code || null;
  const notesCount   = lead.notes?.length ?? 0;

  function renderLeadActivity(type: string, payload: unknown): ActivityMeta {
    const p = (payload ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);

    if (type === 'reservation') {
      const status = str('status') ?? '';
      const reservationId = str('reservationId');
      if (status === 'CONVERTED') {
        return {
          label: m.activityReservationConverted,
          dotColor: 'bg-emerald-500',
          link: str('contractId') ? `/dashboard/contracts/${str('contractId')}` : undefined,
          linkLabel: str('contractNumber'),
        };
      }
      return {
        label: RESERVATION_LABELS[status] ?? m.activityReservationDefault,
        dotColor:
          status === 'APPROVED' ? 'bg-emerald-500'
            : status === 'REJECTED' || status === 'CANCELLED' ? 'bg-danger-500'
              : status === 'EXPIRED' ? 'bg-amber-500'
                : 'bg-brand-500',
        link: reservationId ? `/dashboard/reservations/${reservationId}` : undefined,
        linkLabel: str('reservationNumber'),
      };
    }

    if (type === 'status_change') {
      const from = str('from') as LeadStage | undefined;
      const to = str('to') as LeadStage | undefined;
      return {
        label: m.activityStage(from ? STAGE_LABEL[from] ?? from : '—', to ? STAGE_LABEL[to] ?? to : '—'),
        dotColor: to === 'WON' ? 'bg-emerald-500' : to === 'LOST' ? 'bg-danger-500' : 'bg-amber-500',
      };
    }

    if (type === 'visit') {
      const status = str('status') ?? '';
      const visitId = str('visitId');
      return {
        label: m.activityVisit[status] ?? m.activityVisitDefault,
        dotColor: status === 'COMPLETED' ? 'bg-emerald-500' : status === 'CANCELLED' || status === 'NO_SHOW' ? 'bg-danger-500' : 'bg-violet-500',
        link: visitId ? `/dashboard/visits/appointments/${visitId}` : undefined,
        linkLabel: str('visitNumber'),
      };
    }

    if (type === 'created') return { label: m.activityCreated, dotColor: 'bg-sky-500' };
    if (type === 'assigned') return { label: m.activityAssigned, dotColor: 'bg-brand-500' };
    if (type === 'note') return { label: m.activityNoteAdded, dotColor: 'bg-slate-400' };
    if (type === 'broker_submitted') return { label: m.activityBrokerSubmitted, dotColor: 'bg-indigo-500' };
    if (type.startsWith('broker_')) return { label: m.activityBroker[type] ?? m.activityOther, dotColor: 'bg-indigo-500' };
    if (type.startsWith('relinked')) return { label: m.activityRelinked, dotColor: 'bg-slate-400' };
    return { label: m.activityOther, dotColor: 'bg-slate-400' };
  }

  const activities = lead.activities ?? [];
  const stageChip = cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold',
    STAGE_CHIP[lead.stage],
  );

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section data-testid="lead-hero" className="relative overflow-hidden rounded-[26px] border border-hairline bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.10] via-transparent to-transparent" />
        <div className="relative space-y-6 p-6 sm:p-8">
          <nav aria-label="breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
              <li><Link href={'/dashboard' as never} className="hover:text-brand-700">{m.breadcrumbHome}</Link></li>
              <li aria-hidden>›</li>
              <li><Link href={'/dashboard/leads' as never} className="hover:text-brand-700">{m.breadcrumbLeads}</Link></li>
              <li aria-hidden>›</li>
              <li className="font-semibold text-brand-700">{displayName}</li>
            </ol>
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <span aria-hidden className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[26px] font-bold text-brand-700 ring-2 ring-brand-500/40 ring-offset-4 ring-offset-surface">
                {initials(displayName)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-[30px] font-bold leading-tight text-slate-900">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={stageChip}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOT[lead.stage])} />
                    {STAGE_LABEL[lead.stage]}
                  </span>
                  {isBrokerLead ? (
                    <span className="rounded-full bg-indigo-500/12 px-3 py-1 text-[12px] font-semibold text-indigo-600">{m.sourceBroker}</span>
                  ) : lead.source ? (
                    <span className="rounded-full bg-sky-500/12 px-3 py-1 text-[12px] font-semibold text-sky-600">{tx(lead.source.name)}</span>
                  ) : null}
                  {lead.projectInterest && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-[12px] font-semibold text-slate-600">
                      <Building2 className="h-3.5 w-3.5" /> {tx(lead.projectInterest.name)}
                    </span>
                  )}
                </div>
                {(displayPhone || displayEmail) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-slate-500">
                    {displayPhone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{displayPhone}</span></span>}
                    {displayEmail && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{displayEmail}</span></span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lead.client?.id && (
                <Link href={`/dashboard/clients/${lead.client.id}` as never}>
                  <Button variant="outline" size="md" leftIcon={<ExternalLink className="h-4 w-4" />}>{m.btnClientProfile}</Button>
                </Link>
              )}
              {displayPhone && (
                <a href={`tel:${displayPhone}`}>
                  <Button variant="outline" size="md" leftIcon={<Phone className="h-4 w-4" />}>{m.btnCall}</Button>
                </a>
              )}
              {displayEmail && (
                <a href={`mailto:${displayEmail}`}>
                  <Button variant="primary" size="md" leftIcon={<Mail className="h-4 w-4" />}>{m.btnEmail}</Button>
                </a>
              )}
            </div>
          </div>
          <div className="border-t border-hairline pt-5">
            <p className="mb-3 text-[12.5px] font-semibold text-slate-500">{m.stageSectionTitle} · <span className="font-normal">{m.stageSectionDesc}</span></p>
            {/* WON is set by converting a reservation, never by hand. */}
            <StageSegmented
              leadId={lead.id}
              currentStage={lead.stage}
              stages={lead.stage === 'WON' ? ['WON'] : STAGES.filter((st) => st !== 'WON')}
            />
          </div>
        </div>
      </section>

      <PremiumDetailLayout
        main={
          <>
            {/* Notes */}
            <PremiumPanel
              title={m.notesSectionTitle}
              sub={m.notesSectionDesc}
              trailing={<CountPill n={notesCount} />}
            >
              <form action={addNoteAction.bind(null, lead.id)} className="flex flex-col gap-3">
                <Textarea name="body" required rows={3} placeholder={m.notesPlaceholder} className="text-[13px]" />
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm">{m.btnSaveNote}</Button>
                </div>
              </form>
              <div className="mt-5">
                {notesCount === 0 ? (
                  <PremiumEmptyNote>
                    <span className="block font-semibold text-slate-700">{m.emptyNotesTitle}</span>
                    {m.emptyNotesDesc}
                  </PremiumEmptyNote>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {lead.notes!.map((n) => (
                      <li key={n.id} className="relative rounded-2xl border border-hairline bg-surface-muted/40 px-5 py-4">
                        <span aria-hidden className="absolute end-0 top-4 bottom-4 w-[3px] rounded-s-full bg-brand-500" />
                        <p className="pe-3 text-[13.5px] leading-relaxed text-slate-800">{n.body}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                          <span className="font-semibold">{n.sales?.fullName ?? m.unknownNoteAuthor}</span>
                          <span className="text-slate-400">·</span>
                          <span className="tabular-nums">{formatDateTime(n.createdAt, locale)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PremiumPanel>

            {/* Visits + reservations side by side */}
            {(visitRequests.length > 0 || appointments.length > 0 || reservations.length > 0) && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PremiumPanel title={m.visitsSectionTitle} sub={m.visitsSectionDesc} trailing={<CountPill n={visitRequests.length + appointments.length} />}>
                  {visitRequests.length + appointments.length === 0 ? (
                    <PremiumEmptyNote>—</PremiumEmptyNote>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {visitRequests.map((r) => (
                        <RecordRow
                          key={r.id}
                          href={`/dashboard/visits/requests/${r.id}`}
                          code={r.requestNumber ?? r.id.slice(0, 8)}
                          kind={m.visitRequestsSubTitle}
                          when={formatDate(r.preferredDate, locale)}
                          badge={r.requestStatus ? <VisitRequestStatusBadge status={r.requestStatus} locale={locale} /> : null}
                        />
                      ))}
                      {appointments.map((a) => (
                        <RecordRow
                          key={a.id}
                          href={`/dashboard/visits/appointments/${a.id}`}
                          code={a.visitNumber}
                          kind={m.scheduledVisitsSubTitle}
                          when={formatDateTime(a.scheduledAt, locale)}
                          badge={<AppointmentStatusBadge status={a.status} locale={locale} />}
                        />
                      ))}
                    </ul>
                  )}
                </PremiumPanel>

                <PremiumPanel
                  title={m.reservationsSectionTitle}
                  trailing={<CountPill n={reservations.length} />}
                  link={reservations.length > 0 ? { href: `/dashboard/reservations?leadId=${lead.id}`, label: m.linkAllReservations } : undefined}
                >
                  {reservations.length === 0 ? (
                    <PremiumEmptyNote>—</PremiumEmptyNote>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {reservations.map((r) => {
                        const projectName = r.unit?.building?.phase?.project?.name ? tx(r.unit.building.phase.project.name) : null;
                        return (
                          <RecordRow
                            key={r.id}
                            href={`/dashboard/reservations/${r.id}`}
                            code={r.reservationNumber ?? r.id.slice(0, 8)}
                            kind={`${projectName ? `${projectName} · ` : ''}${r.unit?.code ?? '—'}`}
                            when={formatDate(r.expiresAt, locale)}
                            badge={<ReservationStatusBadge status={r.status} locale={locale} />}
                          />
                        );
                      })}
                    </ul>
                  )}
                </PremiumPanel>
              </div>
            )}

            {/* Timeline */}
            <PremiumPanel title={m.activitySectionTitle} sub={m.activitySectionDesc} trailing={activities.length ? <CountPill n={activities.length} /> : undefined}>
              {activities.length === 0 ? (
                <PremiumEmptyNote>
                  <span className="block font-semibold text-slate-700">{m.emptyActivityTitle}</span>
                  {m.emptyActivityDesc}
                </PremiumEmptyNote>
              ) : (
                <ol data-testid="lead-activity" className="max-h-[520px] overflow-y-auto">
                  {activities.map((a, i) => {
                    const meta = renderLeadActivity(a.type, a.payload);
                    return (
                      <li key={a.id} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-hairline">
                            <span className={cn('h-2 w-2 rounded-full', meta.dotColor)} />
                          </span>
                          {i < activities.length - 1 && <span className="my-1 w-px flex-1 bg-hairline" />}
                        </div>
                        <div className="min-w-0 pb-5">
                          <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-semibold text-slate-900">
                            {meta.label}
                            {meta.link && meta.linkLabel && (
                              <Link href={meta.link as never} className="font-mono text-[12px] font-bold text-brand-700 hover:text-brand-600">
                                {meta.linkLabel}
                              </Link>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-slate-500 tabular-nums">{formatDateTime(a.createdAt, locale)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </PremiumPanel>
          </>
        }
        side={
          <>
            {/* Assignment */}
            <PremiumPanel title={m.assignmentTitle}>
              <div className="space-y-3">
                <div className="flex items-center gap-3.5 rounded-2xl border border-hairline bg-surface-muted/40 px-4 py-3.5">
                  {lead.assignedSales ? (
                    <>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[14px] font-bold text-brand-700 ring-1 ring-brand-500/40">
                        {initials(lead.assignedSales.fullName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-slate-900">{lead.assignedSales.fullName}</p>
                        <p className="text-[11.5px] text-slate-500">{m.currentAssigneeLabel}</p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    </>
                  ) : (
                    <p className="text-[13px] text-slate-500">{m.unassigned}</p>
                  )}
                </div>
                {canAssign && (
                  <form action={assignLeadAction.bind(null, lead.id)} className="flex flex-col gap-2">
                    <Select name="assignedSalesId" defaultValue={lead.assignedSalesId ?? ''} inputSize="sm">
                      <option value="">{m.selectSalesPlaceholder}</option>
                      {salesRes.data?.data.map((st) => (
                        <option key={st.id} value={st.id}>{salesActorLabel(st)}</option>
                      ))}
                    </Select>
                    <Button type="submit" variant="outline" size="sm" className="w-full">{m.btnUpdateAssignment}</Button>
                  </form>
                )}
              </div>
            </PremiumPanel>

            {/* Client */}
            <PremiumPanel title={m.clientSectionTitle} link={lead.client ? { href: `/dashboard/clients/${lead.client.id}`, label: m.linkFullProfile } : undefined}>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[15px] font-bold text-slate-900">{lead.client?.fullName ?? displayName}</p>
                  {lead.client && (
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', lead.client.role === 'CUSTOMER' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/10 text-slate-600')}>
                      {lead.client.role === 'CUSTOMER' ? m.clientRoleOwner : m.clientRoleBrowser}
                    </span>
                  )}
                </div>
                {displayPhone && <ContactRow href={`tel:${displayPhone}`} icon={<Phone />}>{displayPhone}</ContactRow>}
                {displayEmail && <ContactRow href={`mailto:${displayEmail}`} icon={<Mail />}>{displayEmail}</ContactRow>}
              </div>
            </PremiumPanel>

            {/* Opportunity info */}
            <PremiumPanel title={m.opportunityInfoTitle} padding="none">
              <dl className="divide-y divide-hairline border-t border-hairline">
                <InfoRow label={m.fieldProjectInterest} icon={<Building2 className="h-3.5 w-3.5" />}>
                  <span className="text-end text-[13px] font-semibold text-slate-900">
                    {lead.projectInterest ? (
                      <EntityLink kind="project" id={lead.projectInterest.id} mono={false}>{tx(lead.projectInterest.name)}</EntityLink>
                    ) : '—'}
                  </span>
                </InfoRow>
                {lead.unitInterest && (
                  <InfoRow label={m.fieldUnit} icon={<DoorOpen className="h-3.5 w-3.5" />}>
                    <span className="text-[13px] font-bold text-slate-900">
                      <EntityLink kind="unit" id={lead.unitInterest.id}>{lead.unitInterest.code}</EntityLink>
                      {lead.unitInterest.type && <span className="ms-1.5 font-sans text-[11.5px] font-medium text-slate-500">{lead.unitInterest.type}</span>}
                    </span>
                  </InfoRow>
                )}
                <InfoRow label={m.fieldLeadSource} icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                  <span className="text-[13px] font-semibold text-slate-900">
                    {lead.brokerId ? m.sourceBroker : lead.source ? tx(lead.source.name) : m.sourceDirect}
                  </span>
                </InfoRow>
                {isBrokerLead && (
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-3 rounded-2xl bg-indigo-500/10 px-4 py-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600">
                        <Briefcase className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11.5px] text-indigo-600">{m.brokerLabel}</p>
                        <p className="truncate text-[13.5px] font-bold text-slate-900">
                          <EntityLink kind="broker" id={lead.broker?.id ?? lead.brokerId} mono={false}>{brokerName ?? '—'}</EntityLink>
                        </p>
                        {lead.brokerAgent?.fullName && (
                          <p className="truncate text-[12px] text-slate-500">{m.brokerAgentLabel}: {lead.brokerAgent.fullName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <InfoRow label={m.fieldCreatedAt} icon={<Calendar className="h-3.5 w-3.5" />}>
                  <span className="text-[12.5px] font-semibold text-slate-700 tabular-nums">{formatDateTime(lead.createdAt, locale)}</span>
                </InfoRow>
                <InfoRow label={m.fieldLeadId} icon={<Hash className="h-3.5 w-3.5" />}>
                  <span className="font-mono text-[12.5px] font-bold text-slate-600">#{lead.id.slice(0, 8).toUpperCase()}</span>
                </InfoRow>
              </dl>
            </PremiumPanel>

            {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmContent || lead.fbclid) && (
              <PremiumPanel title={m.adAttributionTitle} padding="none">
                <dl className="divide-y divide-hairline border-t border-hairline">
                  {lead.utmSource && <InfoRow label={m.fieldSource} icon={<BarChart2 className="h-3.5 w-3.5" />}><span className="font-mono text-[12px] font-semibold text-indigo-600">{lead.utmSource}</span></InfoRow>}
                  {lead.utmMedium && <InfoRow label={m.fieldMedium} icon={<BarChart2 className="h-3.5 w-3.5" />}><span className="font-mono text-[12px] text-slate-700">{lead.utmMedium}</span></InfoRow>}
                  {lead.utmCampaign && <InfoRow label={m.fieldCampaign} icon={<BarChart2 className="h-3.5 w-3.5" />}><span className="font-mono text-[12px] text-slate-700">{lead.utmCampaign}</span></InfoRow>}
                  {lead.utmContent && <InfoRow label={m.fieldContent} icon={<BarChart2 className="h-3.5 w-3.5" />}><span className="font-mono text-[12px] text-slate-700">{lead.utmContent}</span></InfoRow>}
                  {lead.fbclid && <InfoRow label={m.fieldFbclid} icon={<BarChart2 className="h-3.5 w-3.5" />}><span className="max-w-[140px] truncate font-mono text-[11px] text-slate-500">{lead.fbclid}</span></InfoRow>}
                </dl>
              </PremiumPanel>
            )}
          </>
        }
      />
    </div>
  );
}

function CountPill({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-slate-600">{n}</span>
  );
}

function ContactRow({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a href={href} className="group flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-2.5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/[0.05]">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-slate-500 group-hover:text-brand-700 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <span className="truncate text-[13px] font-medium text-slate-700" dir="ltr">{children}</span>
    </a>
  );
}

function RecordRow({ href, code, kind, when, badge }: { href: string; code: string; kind: string; when: string; badge: React.ReactNode }) {
  return (
    <li>
      <Link href={href as never} className="flex items-center gap-3 rounded-2xl border border-hairline px-4 py-3 transition-colors hover:border-brand-500/40 hover:bg-surface-muted/40">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[13px] font-bold text-slate-900">{code}</p>
          <p className="truncate text-[11.5px] text-slate-500">{kind} · <span className="tabular-nums">{when}</span></p>
        </div>
        {badge}
      </Link>
    </li>
  );
}

// ── InfoRow — label+icon on right, value on left (RTL) ───────────────────────

function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3.5">
      <dt className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-slate-500">
        <span className="shrink-0 text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="flex items-center justify-end min-w-0 flex-1">{children}</dd>
    </div>
  );
}

// ── Activity renderer ─────────────────────────────────────────────────────────

interface ActivityMeta {
  label: string;
  dotColor: string;
  link?: string;
  linkLabel?: string;
}
