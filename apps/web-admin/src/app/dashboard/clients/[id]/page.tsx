import Link from 'next/link';
import {
  Pencil,
  Phone,
  Mail,
  Languages,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Hash,
  Power,
  PowerOff,
  Briefcase,
  BookmarkCheck,
  CalendarClock,
  Plus,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { User, Lead, Paged, Reservation, VisitAppointment } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/confirm-button';
import { LeadStageBadge, ReservationStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { cn } from '@/lib/cn';
import { activateClientAction, deactivateClientAction } from '../actions';
import { PremiumDetailLayout, PremiumPanel, PremiumEmptyNote } from '@/components/premium';

interface AuditLog {
  id: string;
  actorId: string | null;
  actor?: { id: string; fullName: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditPaged {
  data: AuditLog[];
  meta: { page: number; pageSize: number; total: number };
}

interface ReservationActivityEntry {
  id: string;
  type: string;
  note: string | null;
  actorId: string | null;
  actor?: { id: string; fullName: string } | null;
  createdAt: string;
  reservation: {
    reservationNumber: string;
    unit: { code: string } | null;
  } | null;
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 1);
  return parts[0]![0]! + parts[parts.length - 1]![0]!;
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.clientDetailPage;

  const [userRes, auditRes, leadsRes, reservationsRes, reservationActivitiesRes, visitsRes] = await Promise.all([
    safe(api.get<User>(`/users/${id}`)),
    safe(api.get<AuditPaged>(`/audit-logs?entityId=${id}&pageSize=6`)),
    safe(api.get<Paged<Lead>>(`/leads?clientId=${id}&pageSize=20`)),
    safe(api.get<Paged<Reservation>>(`/reservations?clientId=${id}&pageSize=10`)),
    safe(api.get<ReservationActivityEntry[]>(`/reservations/activities?clientId=${id}&pageSize=8`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?clientId=${id}&pageSize=10`)),
  ]);

  if (userRes.error || !userRes.data) {
    return (
      <div className="rounded-2xl bg-danger-500/10 text-danger-600 p-6 text-sm">
        {m.errorLoad} {userRes.error ?? m.errorNotFound}
      </div>
    );
  }

  const u = userRes.data;
  const role = (u.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT') as
    | 'CLIENT'
    | 'CUSTOMER';
  const recentActivity = auditRes.data?.data ?? [];
  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const reservationActivities = reservationActivitiesRes.data ?? [];
  const visits = visitsRes.data?.data ?? [];

  const ACTION_LABEL: Record<string, string> = {
    POST: m.activityActionCreate,
    PATCH: m.activityActionUpdate,
    PUT: m.activityActionUpdate,
    DELETE: m.activityActionDelete,
  };

  const isOwner = role === 'CUSTOMER';
  const kpis = [
    { label: m.sectionLeads, value: String(leads.length), icon: <Briefcase /> },
    { label: m.sectionReservations, value: String(reservations.length), icon: <BookmarkCheck /> },
    { label: m.sectionVisits, value: String(visits.length), icon: <CalendarClock /> },
    { label: m.labelLastLogin, value: u.lastLoginAt ? formatDate(u.lastLoginAt, locale) : '—', icon: <Clock /> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section data-testid="client-hero" className="relative overflow-hidden rounded-[26px] border border-hairline bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.10] via-transparent to-transparent" />
        <div className="relative space-y-6 p-6 sm:p-8">
          <nav aria-label="breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
              <li><Link href={'/dashboard' as never} className="hover:text-brand-700">{m.breadcrumbDashboard}</Link></li>
              <li aria-hidden>›</li>
              <li><Link href={`/dashboard/clients?role=${role}` as never} className="hover:text-brand-700">{m.breadcrumbClients}</Link></li>
              <li aria-hidden>›</li>
              <li className="font-semibold text-brand-700">{u.fullName}</li>
            </ol>
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <span aria-hidden className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[26px] font-bold text-brand-700 ring-2 ring-brand-500/40 ring-offset-4 ring-offset-surface">
                {initials(u.fullName)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-[30px] font-bold leading-tight text-slate-900">{u.fullName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-3 py-1 text-[12px] font-semibold', isOwner ? 'bg-emerald-500/12 text-emerald-600' : 'bg-sky-500/12 text-sky-600')}>
                    {isOwner ? m.roleBadgeOwner : m.roleBadgeBrowser}
                  </span>
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold', u.active ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/10 text-slate-500')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', u.active ? 'bg-emerald-500' : 'bg-slate-400')} />
                    {u.active ? m.statusBadgeActive : m.statusBadgeSuspended}
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 font-mono text-[11.5px] text-slate-500">#{u.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <p className="mt-2 text-[13px] text-slate-500">{isOwner ? m.roleDescOwner : m.roleDescBrowser}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-slate-500">
                  {u.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{u.phone}</span></span>}
                  {u.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{u.email}</span></span>}
                  <span className="inline-flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" />{u.locale === 'en' ? m.localeEn : m.localeAr}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {u.phone && (
                <a href={`tel:${u.phone}`}>
                  <Button type="button" variant="outline" size="md" leftIcon={<Phone className="h-4 w-4" />}>{m.btnCall}</Button>
                </a>
              )}
              <Link href={`/dashboard/clients/${id}/edit` as never}>
                <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>{m.btnEdit}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key figures ───────────────────────────────────────────── */}
      <div data-testid="client-kpis" className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-hairline bg-surface lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={cn(
              'flex items-center gap-4 p-5',
              i > 0 && 'lg:border-s lg:border-hairline',
              i % 2 === 1 && 'max-lg:border-s max-lg:border-hairline',
              i >= 2 && 'max-lg:border-t max-lg:border-hairline',
            )}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-5 [&_svg]:w-5">{k.icon}</span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-500">{k.label}</p>
              <p className="num truncate text-[26px] font-semibold leading-tight text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <PremiumDetailLayout
        main={
          <>
            {/* Leads */}
            <PremiumPanel
              title={m.sectionLeads}
              trailing={
                <Link href={`/dashboard/leads/new?clientId=${u.id}` as never}>
                  <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>{m.btnNewLead}</Button>
                </Link>
              }
            >
              {leads.length === 0 ? (
                <PremiumEmptyNote>
                  <span className="block font-semibold text-slate-700">{m.emptyLeadsTitle}</span>
                  {m.emptyLeadsDesc}
                </PremiumEmptyNote>
              ) : (
                <ul className="flex flex-col gap-2">
                  {leads.map((l) => (
                    <RecordRow
                      key={l.id}
                      href={`/dashboard/leads/${l.id}`}
                      title={l.projectInterest ? tx(l.projectInterest.name) : 'CRM'}
                      meta={`${l.assignedSales?.fullName ?? m.unassigned} · ${formatDate(l.createdAt, locale)}`}
                      badge={<LeadStageBadge stage={l.stage} locale={locale} />}
                    />
                  ))}
                </ul>
              )}
            </PremiumPanel>

            {/* Reservations + visits */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PremiumPanel
                title={m.sectionReservations}
                link={reservations.length > 0 ? { href: `/dashboard/reservations?clientId=${u.id}`, label: m.linkViewAllReservations } : undefined}
              >
                {reservations.length === 0 ? (
                  <PremiumEmptyNote>
                    <span className="block font-semibold text-slate-700">{m.emptyReservationsTitle}</span>
                    {m.emptyReservationsDesc}
                  </PremiumEmptyNote>
                ) : (
                  <ul data-testid="client-reservations" className="flex flex-col gap-2">
                    {reservations.map((r) => {
                      const projectName = r.unit?.building?.phase?.project?.name ? tx(r.unit.building.phase.project.name) : null;
                      return (
                        <RecordRow
                          key={r.id}
                          href={`/dashboard/reservations/${r.id}`}
                          title={r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                          mono
                          meta={`${projectName ? `${projectName} · ` : ''}${m.unitPrefix} ${r.unit?.code ?? '—'}`}
                          badge={<ReservationStatusBadge status={r.status} locale={locale} />}
                        />
                      );
                    })}
                  </ul>
                )}
              </PremiumPanel>

              <PremiumPanel
                title={m.sectionVisits}
                link={visits.length > 0 ? { href: `/dashboard/visits?clientId=${u.id}`, label: m.linkViewAllVisits } : undefined}
              >
                {visits.length === 0 ? (
                  <PremiumEmptyNote>
                    <span className="block font-semibold text-slate-700">{m.emptyVisitsTitle}</span>
                    {m.emptyVisitsDesc}
                  </PremiumEmptyNote>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visits.map((v) => (
                      <RecordRow
                        key={v.id}
                        href={`/dashboard/visits/appointments/${v.id}`}
                        title={v.visitNumber}
                        mono
                        meta={`${v.project ? tx(v.project.name) : '—'} · ${formatDateTime(v.scheduledAt, locale)}`}
                        badge={<AppointmentStatusBadge status={v.status} locale={locale} />}
                      />
                    ))}
                  </ul>
                )}
              </PremiumPanel>
            </div>

            {/* Activity */}
            <PremiumPanel title={m.sectionActivity} link={{ href: `/dashboard/clients/${id}/activity`, label: m.linkFullActivity }}>
              {recentActivity.length === 0 && reservationActivities.length === 0 ? (
                <PremiumEmptyNote>
                  <span className="block font-semibold text-slate-700">{m.emptyActivityTitle}</span>
                  {m.emptyActivityDesc}
                </PremiumEmptyNote>
              ) : (
                <ol className="relative ms-4 space-y-5 border-s-2 border-hairline ps-6">
                  {reservationActivities.map((a) => (
                    <ReservationActivityItem key={a.id} entry={a} labels={m.reservationActivityLabels} byLabel={m.activityByLabel} systemLabel={m.activitySystem} locale={locale} />
                  ))}
                  {recentActivity.map((a) => (
                    <ActivityItem key={a.id} entry={a} actionLabels={ACTION_LABEL} byLabel={m.activityByLabel} systemLabel={m.activitySystem} locale={locale} />
                  ))}
                </ol>
              )}
            </PremiumPanel>
          </>
        }
        side={
          <>
            <PremiumPanel title={m.sectionAccountInfo} padding="none">
              <dl className="divide-y divide-hairline border-t border-hairline">
                <Row label={m.labelAccountStatus} icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', u.active ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/10 text-slate-500')}>
                    {u.active ? m.statusBadgeActive : m.statusBadgeSuspended}
                  </span>
                </Row>
                <Row label={m.labelClientType} icon={<ShieldAlert className="h-3.5 w-3.5" />}>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', isOwner ? 'bg-emerald-500/12 text-emerald-600' : 'bg-sky-500/12 text-sky-600')}>
                    {isOwner ? m.roleBadgeOwner : m.roleBadgeBrowser}
                  </span>
                </Row>
                <Row label={m.labelRegistered} icon={<Calendar className="h-3.5 w-3.5" />}>
                  <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{formatDate(u.createdAt, locale)}</span>
                </Row>
                <Row label={m.labelLastLogin} icon={<Clock className="h-3.5 w-3.5" />}>
                  <span className="text-[13px] font-semibold text-slate-900">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : m.noLoginYet}</span>
                </Row>
                <Row label={m.labelClientId} icon={<Hash className="h-3.5 w-3.5" />}>
                  <span className="font-mono text-[12px] text-slate-500">#{u.id.slice(0, 8).toUpperCase()}</span>
                </Row>
              </dl>
            </PremiumPanel>

            <PremiumPanel title={m.sectionAccountStatus} className={u.active ? 'border-danger-500/25' : undefined}>
              <p className="mb-4 text-[12.5px] leading-relaxed text-slate-500">{u.active ? m.statusDescActive : m.statusDescSuspended}</p>
              {u.active ? (
                <ConfirmButton label={m.btnDeactivate} confirm={m.confirmDeactivate} action={deactivateClientAction.bind(null, id)} />
              ) : (
                <form action={activateClientAction.bind(null, id)}>
                  <Button type="submit" variant="primary" size="sm" leftIcon={<Power className="h-4 w-4" />}>{m.btnActivate}</Button>
                </form>
              )}
              {!u.active && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                  <PowerOff className="h-3 w-3 text-slate-400" />
                  {m.suspendedSince} {formatDate(u.updatedAt ?? u.createdAt, locale)}
                </p>
              )}
            </PremiumPanel>
          </>
        }
      />
    </div>
  );
}

function RecordRow({ href, title, meta, badge, mono }: { href: string; title: string; meta: string; badge: React.ReactNode; mono?: boolean }) {
  return (
    <li>
      <Link href={href as never} className="flex items-center gap-3 rounded-2xl border border-hairline px-4 py-3 transition-colors hover:border-brand-500/40 hover:bg-surface-muted/40">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[13.5px] font-bold text-slate-900', mono && 'font-mono')}>{title}</p>
          <p className="truncate text-[11.5px] text-slate-500">{meta}</p>
        </div>
        {badge}
      </Link>
    </li>
  );
}

function Row({
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
      <dt className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function ReservationActivityItem({
  entry,
  labels,
  byLabel,
  systemLabel,
  locale = 'ar',
}: {
  entry: ReservationActivityEntry;
  labels: Record<string, string>;
  byLabel: string;
  systemLabel: string;
  locale?: Locale;
}) {
  const RESERVATION_ACTIVITY_TONE: Record<string, 'success' | 'danger' | 'warning' | 'brand'> = {
    CREATED: 'brand',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'danger',
    EXPIRED: 'warning',
    NOTE_ADDED: 'brand',
  };
  const tone = RESERVATION_ACTIVITY_TONE[entry.type] ?? 'brand';
  const dotClass = {
    success: 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/30',
    danger: 'bg-danger-500/12 text-danger-600 ring-danger-500/30',
    warning: 'bg-amber-500/12 text-amber-600 ring-amber-500/30',
    brand: 'bg-brand-500/12 text-brand-700 ring-brand-500/30',
  }[tone];
  const label = labels[entry.type] ?? entry.type;
  const unitCode = entry.reservation?.unit?.code;
  const reservationNumber = entry.reservation?.reservationNumber;
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -start-[33px] top-1 inline-flex h-7 w-7 items-center justify-center rounded-full ring-2',
          dotClass,
        )}
      >
        <BookmarkCheck className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-900">
            <span className="font-semibold">{label}</span>
            {unitCode && (
              <span className="font-mono text-xs text-slate-500"> — {unitCode}</span>
            )}
            {reservationNumber && (
              <span className="font-mono text-xs text-slate-400"> ({reservationNumber})</span>
            )}
          </p>
          <p className="mt-1 text-2xs text-slate-500">
            {byLabel}{' '}
            <span className="font-medium text-slate-700">
              {entry.actor?.fullName ?? systemLabel}
            </span>
          </p>
        </div>
        <time className="shrink-0 text-2xs text-slate-500 tabular-nums">
          {formatDateTime(entry.createdAt, locale)}
        </time>
      </div>
    </li>
  );
}

function ActivityItem({
  entry,
  actionLabels,
  byLabel,
  systemLabel,
  locale = 'ar',
}: {
  entry: AuditLog;
  actionLabels: Record<string, string>;
  byLabel: string;
  systemLabel: string;
  locale?: Locale;
}) {
  const tone =
    entry.action === 'POST'
      ? 'success'
      : entry.action === 'DELETE'
        ? 'danger'
        : 'brand';
  const dotClass: Record<typeof tone, string> = {
    success: 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/30',
    danger: 'bg-danger-500/12 text-danger-600 ring-danger-500/30',
    brand: 'bg-brand-500/12 text-brand-700 ring-brand-500/30',
  };
  const label = actionLabels[entry.action] ?? entry.action;
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -start-[33px] top-1 inline-flex h-7 w-7 items-center justify-center rounded-full ring-2',
          dotClass[tone],
        )}
      >
        <Activity className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-900">
            <span className="font-semibold">{label}</span>{' '}
            <span className="font-mono text-xs text-slate-500">{entry.entityType}</span>
          </p>
          <p className="mt-1 text-2xs text-slate-500">
            {byLabel}{' '}
            <span className="font-medium text-slate-700">
              {entry.actor?.fullName ?? systemLabel}
            </span>
            {entry.ip && (
              <span className="ms-2 inline-block font-mono text-slate-400" dir="ltr">
                {entry.ip}
              </span>
            )}
          </p>
        </div>
        <time className="shrink-0 text-2xs text-slate-500 tabular-nums">
          {formatDateTime(entry.createdAt, locale)}
        </time>
      </div>
    </li>
  );
}
