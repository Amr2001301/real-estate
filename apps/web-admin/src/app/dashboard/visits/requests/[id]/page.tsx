import Link from 'next/link';
import {
  Phone, Mail, Building2, ExternalLink, AlertCircle, CalendarDays, Hash, DoorOpen,
  Clock, Radio, MessageSquare, CalendarPlus, CheckCircle2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import type { VisitRequest, VisitActivity } from '@/lib/types';
import { formatDate, formatDateTime, tx, intlLocale } from '@/lib/format';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { VisitTimeline } from '../../_components/visit-timeline';
import { RequestDetailActions } from './_components/request-detail-actions';
import { PremiumDetailLayout, PremiumPanel, PremiumEmptyNote } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { EntityLink } from '@/components/entity-link';

export const dynamic = 'force-dynamic';

interface VisitRequestDetail extends VisitRequest {
  visitActivities?: VisitActivity[];
}

function initials(name: string): string {
  // Words that start with a letter only: "E2E Visitor 1792…" reads EV, not E1.
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (!parts.length || name === '—') return '؟';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  // Skip the Arabic article: "رامي الشريف" reads رش, not را.
  const lead = (w: string) => (w.length > 3 && w.startsWith('ال') ? w.charAt(2) : w.charAt(0));
  return (lead(parts[0]!) + lead(parts[parts.length - 1]!)).toUpperCase();
}

export default async function VisitRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.visitsRequestDetail;

  const [reqRes, salesRes] = await Promise.all([
    safe(api.get<VisitRequestDetail>(`/visits/requests/${id}`)),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
  ]);

  if (reqRes.error || !reqRes.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>{m.loadError}{reqRes.error ?? m.notFound}</p>
      </div>
    );
  }

  const req          = reqRes.data;
  const salesOptions = salesRes.data?.data ?? [];
  const customerName  = req.customerName  ?? req.user?.fullName  ?? req.lead?.fullName  ?? '—';
  const customerPhone = req.customerPhone ?? req.user?.phone     ?? req.lead?.phone     ?? null;
  const customerEmail = req.customerEmail ?? req.user?.email     ?? req.lead?.email     ?? null;
  const activities: VisitActivity[] = req.visitActivities ?? [];
  const appointments = req.appointments ?? [];
  // Requests from the website and broker portal carry no number; show a short reference instead.
  const reference = req.requestNumber ?? `#${req.id.slice(0, 8).toUpperCase()}`;
  const customerNotes = req.requestNotes ?? req.notes;

  const details: Array<{ label: string; value: React.ReactNode; icon: React.ReactNode }> = [
    { label: m.fieldPreferredDate, value: formatDate(req.preferredDate, locale), icon: <CalendarDays /> },
    ...(req.preferredTime ? [{ label: m.fieldPreferredTime, value: <span dir="ltr">{req.preferredTime}</span>, icon: <Clock /> }] : []),
    ...(req.source ? [{ label: m.fieldSource, value: m.sourceLabels[req.source] ?? req.source, icon: <Radio /> }] : []),
    ...(req.preferredContactMethod ? [{ label: m.fieldPreferredContact, value: req.preferredContactMethod, icon: <MessageSquare /> }] : []),
    { label: m.fieldCreatedAt, value: formatDateTime(req.createdAt, locale), icon: <CalendarPlus /> },
    ...(req.convertedAt ? [{ label: m.fieldConvertedAt, value: formatDateTime(req.convertedAt, locale), icon: <CheckCircle2 /> }] : []),
  ];

  // Preferred date as a calendar card (date-only value: read it in UTC so the day never shifts).
  const preferred = req.preferredDate ? new Date(req.preferredDate) : null;
  const dateCard = preferred && !Number.isNaN(preferred.getTime())
    ? {
        day: new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', timeZone: 'UTC' }).format(preferred),
        month: new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(preferred),
        weekday: new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', timeZone: 'UTC' }).format(preferred),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section data-testid="visit-request-hero" className="relative overflow-hidden rounded-[26px] border border-hairline bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.10] via-transparent to-transparent" />
        <div className="relative space-y-6 p-6 sm:p-8">
          <nav aria-label="breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
              <li><Link href={'/dashboard' as never} className="hover:text-brand-700">{m.breadcrumbDashboard}</Link></li>
              <li aria-hidden>›</li>
              <li><Link href={'/dashboard/visits?tab=requests' as never} className="hover:text-brand-700">{m.breadcrumbVisits}</Link></li>
              <li aria-hidden>›</li>
              <li className="font-semibold text-brand-700">{m.heroKicker}</li>
            </ol>
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <span aria-hidden className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[26px] font-bold text-brand-700 ring-2 ring-brand-500/40 ring-offset-4 ring-offset-surface">
                {initials(customerName)}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-wider text-brand-700">{m.heroKicker}</p>
                <h1 className="truncate font-heading text-[30px] font-bold leading-tight text-slate-900">{customerName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {req.requestStatus && <VisitRequestStatusBadge status={req.requestStatus} />}
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 font-mono text-[12px] font-bold text-slate-600" dir="ltr">
                    <Hash className="h-3 w-3" />{reference.replace(/^#/, '')}
                  </span>
                  {req.source && (
                    <span className="rounded-full bg-sky-500/12 px-3 py-1 text-[12px] font-semibold text-sky-600">{m.sourceLabels[req.source] ?? req.source}</span>
                  )}
                  {req.project && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-[12px] font-semibold text-slate-600">
                      <Building2 className="h-3.5 w-3.5" /> {tx(req.project.name)}
                    </span>
                  )}
                </div>
                {(customerPhone || customerEmail) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-slate-500">
                    {customerPhone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{customerPhone}</span></span>}
                    {customerEmail && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{customerEmail}</span></span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
              {dateCard && (
                <div data-testid="visit-request-date" className="flex items-center gap-4 rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/[0.14] to-brand-700/[0.04] px-5 py-3.5">
                  <span className="font-heading text-[40px] font-bold leading-none tabular-nums text-brand-700">{dateCard.day}</span>
                  <div className="leading-tight">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700/80">{m.fieldPreferredDate}</p>
                    <p className="text-[15px] font-bold text-slate-900">{dateCard.month}</p>
                    <p className="text-[12px] text-slate-500">
                      {dateCard.weekday}
                      {req.preferredTime && <> · <span dir="ltr" className="tabular-nums">{req.preferredTime}</span></>}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <RequestDetailActions request={req} salesOptions={salesOptions} locale={locale} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <PremiumDetailLayout
        main={
          <>
            {/* Request details */}
            <PremiumPanel title={m.cardRequestTitle} padding="none">
              <dl className="grid grid-cols-1 gap-px border-t border-hairline bg-hairline sm:grid-cols-2">
                {details.map((d) => (
                  <div key={d.label} className="flex items-start gap-3 bg-surface px-6 py-4">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-700 [&_svg]:h-4 [&_svg]:w-4">{d.icon}</span>
                    <div className="min-w-0">
                      <dt className="text-[12px] font-semibold text-slate-500">{d.label}</dt>
                      <dd className="mt-1 text-[15px] font-bold text-slate-900 tabular-nums">{d.value}</dd>
                    </div>
                  </div>
                ))}
                {/* A filler keeps the last row solid instead of showing the hairline background */}
                {details.length % 2 === 1 && <div aria-hidden className="hidden bg-surface sm:block" />}
              </dl>
              {(customerNotes || req.adminNotes) && (
                <div className="grid gap-4 border-t border-hairline p-6 sm:grid-cols-2">
                  {customerNotes && <NoteBlock label={m.fieldCustomerNotes}>{customerNotes}</NoteBlock>}
                  {req.adminNotes && <NoteBlock label={m.fieldAdminNotes}>{req.adminNotes}</NoteBlock>}
                </div>
              )}
            </PremiumPanel>

            {/* Linked appointments */}
            <PremiumPanel
              title={m.cardAppointmentsTitle}
              trailing={<CountPill>{appointments.length}</CountPill>}
            >
              {appointments.length === 0 ? (
                <PremiumEmptyNote>{m.appointmentsEmpty}</PremiumEmptyNote>
              ) : (
                <ul className="space-y-2">
                  {appointments.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/dashboard/visits/appointments/${a.id}` as never}
                        className="flex items-center gap-3 rounded-2xl border border-hairline px-4 py-3 transition-colors hover:border-brand-500/40 hover:bg-surface-muted/40"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[13px] font-bold text-slate-900">{a.visitNumber}</p>
                          <p className="truncate text-[11.5px] text-slate-500">
                            <span className="tabular-nums">{formatDateTime(a.scheduledAt, locale)}</span>
                            {a.assignedSales?.fullName && <> · {a.assignedSales.fullName}</>}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PremiumPanel>

            {/* Timeline — the panel carries the only heading */}
            <section data-testid="visit-request-timeline">
              <PremiumPanel
                title={m.cardTimelineTitle}
                trailing={<CountPill>{m.eventsCount(activities.length)}</CountPill>}
              >
                <VisitTimeline activities={activities} locale={locale} />
              </PremiumPanel>
            </section>
          </>
        }
        side={
          <>
            <PremiumPanel title={m.cardCustomerTitle}>
              <div className="space-y-2">
                <p className="pb-1 text-[16px] font-bold text-slate-900">{customerName}</p>
                {customerPhone && <ContactRow href={`tel:${customerPhone}`} icon={<Phone />}>{customerPhone}</ContactRow>}
                {customerEmail && <ContactRow href={`mailto:${customerEmail}`} icon={<Mail />}>{customerEmail}</ContactRow>}
                {req.lead && req.leadId && (
                  <Link
                    href={`/dashboard/leads/${req.leadId}` as never}
                    className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-brand-500/[0.08] px-3.5 py-2.5 text-[13px] font-bold text-brand-700 transition-colors hover:bg-brand-500/15"
                  >
                    <span className="truncate">{m.leadLinkPrefix}{req.lead.fullName}</span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </Link>
                )}
              </div>
            </PremiumPanel>

            <PremiumPanel title={m.cardProjectTitle}>
              {req.project ? (
                <div className="space-y-2">
                  <Link
                    href={`/dashboard/projects/${req.projectId}` as never}
                    className="group flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-3 transition-colors hover:border-brand-500/40"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="truncate text-[14px] font-bold text-slate-900 group-hover:text-brand-700">{tx(req.project.name)}</span>
                  </Link>
                  {req.unit && (
                    <div className="flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-slate-500">
                        <DoorOpen className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900">
                          <EntityLink kind="unit" id={req.unit.id}>{req.unit.code}</EntityLink>
                        </p>
                        <p className="text-[11.5px] text-slate-500">{m.unitLabel} · {req.unit.type}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <PremiumEmptyNote>{m.noProject}</PremiumEmptyNote>
              )}
            </PremiumPanel>
          </>
        }
      />
    </div>
  );
}

function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-slate-600">{children}</span>
  );
}

function NoteBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-s-2 border-brand-500/60 bg-surface-muted/50 px-4 py-3">
      <p className="text-[12px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700">{children}</p>
    </div>
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
