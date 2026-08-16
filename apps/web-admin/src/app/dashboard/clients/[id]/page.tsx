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
  ArrowLeft,
  Hash,
  Power,
  PowerOff,
  Briefcase,
  BookmarkCheck,
  CalendarClock,
  Plus,
  UserCog,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { User, Lead, Paged, Reservation, VisitAppointment } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/confirm-button';
import { LeadStageBadge, ReservationStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { cn } from '@/lib/cn';
import { activateClientAction, deactivateClientAction } from '../actions';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
  PremiumEmptyState,
} from '@/components/premium';

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

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return parts[0]![0]! + parts[parts.length - 1]![0]!;
}

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

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
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
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

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={u.fullName}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbClients, href: `/dashboard/clients?role=${role}` },
          { label: u.fullName },
        ]}
        meta={
          <>
            <Badge tone={role === 'CUSTOMER' ? 'success' : 'info'} variant="soft">
              {role === 'CUSTOMER' ? m.roleBadgeOwner : m.roleBadgeBrowser}
            </Badge>
            <Badge tone={u.active ? 'success' : 'gray'} variant="soft" dot>
              {u.active ? m.statusBadgeActive : m.statusBadgeSuspended}
            </Badge>
            <span className="text-2xs font-mono text-slate-400">
              ID: #{u.id.slice(0, 8).toUpperCase()}
            </span>
          </>
        }
        actions={
          <>
            {u.phone && (
              <a href={`tel:${u.phone}`}>
                <Button type="button" variant="outline" size="md" leftIcon={<Phone className="h-4 w-4" />}>
                  {m.btnCall}
                </Button>
              </a>
            )}
            <Link href={`/dashboard/clients/${id}/edit` as never}>
              <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>
                {m.btnEdit}
              </Button>
            </Link>
          </>
        }
      />

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            <PremiumSectionCard title={m.sectionProfile}>
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5">
                <span
                  className={cn(
                    'inline-flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold ring-2 ring-white shadow-sm uppercase tabular-nums',
                    paletteFor(u.fullName ?? u.id),
                  )}
                  aria-hidden
                >
                  {initials(u.fullName)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-xl font-semibold text-navy tracking-tight truncate">
                      {u.fullName}
                    </h2>
                    <Badge tone={role === 'CUSTOMER' ? 'success' : 'info'} variant="soft" size="sm">
                      {role === 'CUSTOMER' ? m.roleBadgeOwner : m.roleBadgeBrowser}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {role === 'CUSTOMER' ? m.roleDescOwner : m.roleDescBrowser}
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ContactCell
                      icon={<Mail className="h-4 w-4" />}
                      tone="info"
                      label={m.labelEmail}
                      value={u.email}
                      href={u.email ? `mailto:${u.email}` : undefined}
                      isLtr
                    />
                    <ContactCell
                      icon={<Phone className="h-4 w-4" />}
                      tone="brand"
                      label={m.labelPhone}
                      value={u.phone}
                      href={u.phone ? `tel:${u.phone}` : undefined}
                      isLtr
                    />
                    <ContactCell
                      icon={<Languages className="h-4 w-4" />}
                      tone="purple"
                      label={m.labelLocale}
                      value={u.locale === 'en' ? m.localeEn : m.localeAr}
                    />
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            <PremiumSectionCard
              title={m.sectionLeads}
              icon={<Briefcase className="h-4 w-4" />}
              trailing={
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 tabular-nums">{leads.length}</span>
                  <Link href={`/dashboard/leads/new?clientId=${u.id}` as never}>
                    <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                      {m.btnNewLead}
                    </Button>
                  </Link>
                </div>
              }
              padded={false}
            >
              {leads.length === 0 ? (
                <PremiumEmptyState
                  icon={<Briefcase />}
                  title={m.emptyLeadsTitle}
                  description={m.emptyLeadsDesc}
                  action={
                    <Link href={`/dashboard/leads/new?clientId=${u.id}` as never}>
                      <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                        {m.btnCreateLead}
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {leads.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/dashboard/leads/${l.id}` as never}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                      >
                        <span className="font-mono text-2xs text-slate-400 shrink-0">
                          #{l.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900">
                              {l.projectInterest ? tx(l.projectInterest.name) : 'CRM'}
                            </p>
                            <LeadStageBadge stage={l.stage} />
                          </div>
                          <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-2">
                            {l.assignedSales?.fullName ? (
                              <span className="inline-flex items-center gap-1">
                                <UserCog className="h-3 w-3" />
                                {l.assignedSales.fullName}
                              </span>
                            ) : (
                              <span className="text-slate-400">{m.unassigned}</span>
                            )}
                            <span className="text-slate-300">·</span>
                            <span>{formatDate(l.createdAt)}</span>
                          </p>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-slate-300 rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard
              title={m.sectionReservations}
              icon={<BookmarkCheck className="h-4 w-4" />}
              trailing={
                reservations.length > 0 ? (
                  <Link
                    href={`/dashboard/reservations?clientId=${u.id}` as never}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    {m.linkViewAllReservations}
                    <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                ) : undefined
              }
              padded={false}
            >
              {reservations.length === 0 ? (
                <PremiumEmptyState
                  icon={<BookmarkCheck />}
                  title={m.emptyReservationsTitle}
                  description={m.emptyReservationsDesc}
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {reservations.map((r) => {
                    const projectName = r.unit?.building?.phase?.project?.name
                      ? tx(r.unit.building.phase.project.name)
                      : null;
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/dashboard/reservations/${r.id}` as never}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                        >
                          <span className="font-mono text-2xs text-slate-400 shrink-0">
                            {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {projectName ? `${projectName} · ` : ''}
                                {m.unitPrefix} {r.unit?.code ?? '—'}
                              </p>
                              <ReservationStatusBadge status={r.status} />
                            </div>
                            <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-2 flex-wrap">
                              {r.sales?.fullName && (
                                <>
                                  <span className="inline-flex items-center gap-1">
                                    <UserCog className="h-3 w-3" />
                                    {r.sales.fullName}
                                  </span>
                                  <span className="text-slate-300">·</span>
                                </>
                              )}
                              <span>{m.expiresLabel} {formatDate(r.expiresAt)}</span>
                            </p>
                          </div>
                          <ArrowLeft className="h-4 w-4 text-slate-300 rtl:rotate-180" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard
              title={m.sectionVisits}
              icon={<CalendarClock className="h-4 w-4" />}
              trailing={
                visits.length > 0 ? (
                  <Link
                    href={`/dashboard/visits?clientId=${u.id}` as never}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    {m.linkViewAllVisits}
                    <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                ) : undefined
              }
              padded={false}
            >
              {visits.length === 0 ? (
                <PremiumEmptyState
                  icon={<CalendarClock />}
                  title={m.emptyVisitsTitle}
                  description={m.emptyVisitsDesc}
                />
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {visits.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/dashboard/visits/appointments/${v.id}` as never}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                      >
                        <span className="font-mono text-2xs text-slate-400 shrink-0">
                          {v.visitNumber}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {v.project ? tx(v.project.name) : '—'}
                              {v.unit ? ` · ${m.unitPrefix} ${v.unit.code}` : ''}
                            </p>
                            <AppointmentStatusBadge status={v.status} />
                          </div>
                          <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-2 flex-wrap">
                            {v.assignedSales && (
                              <>
                                <span className="inline-flex items-center gap-1">
                                  <UserCog className="h-3 w-3" />
                                  {v.assignedSales.fullName}
                                </span>
                                <span className="text-slate-300">·</span>
                              </>
                            )}
                            <span>{formatDateTime(v.scheduledAt)}</span>
                          </p>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-slate-300 rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard
              title={m.sectionActivity}
              icon={<Activity className="h-4 w-4" />}
              trailing={
                <Link
                  href={`/dashboard/clients/${id}/activity` as never}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  {m.linkFullActivity}
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              }
            >
              {recentActivity.length === 0 && reservationActivities.length === 0 ? (
                <PremiumEmptyState
                  icon={<Activity />}
                  title={m.emptyActivityTitle}
                  description={m.emptyActivityDesc}
                />
              ) : (
                <ol className="relative ms-4 border-s-2 border-hairline ps-6 space-y-5">
                  {reservationActivities.map((a) => (
                    <ReservationActivityItem key={a.id} entry={a} labels={m.reservationActivityLabels} byLabel={m.activityByLabel} systemLabel={m.activitySystem} />
                  ))}
                  {recentActivity.map((a) => (
                    <ActivityItem key={a.id} entry={a} actionLabels={ACTION_LABEL} byLabel={m.activityByLabel} systemLabel={m.activitySystem} />
                  ))}
                </ol>
              )}
            </PremiumSectionCard>
          </div>
        }
        side={
          <div className="space-y-5">
            <PremiumCommandPanel title={m.sectionQuickActions}>
              {u.phone && (
                <a href={`tel:${u.phone}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Phone /></span>
                  {m.cmdCall}
                </a>
              )}
              <Link href={`/dashboard/clients/${id}/edit` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><Pencil /></span>
                {m.cmdEdit}
              </Link>
              <Link href={`/dashboard/clients/${id}/activity` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><Activity /></span>
                {m.cmdActivity}
              </Link>
              <Link href={`/dashboard/clients?role=${role}` as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                {m.cmdClientsList}
              </Link>
            </PremiumCommandPanel>

            <PremiumSectionCard title={m.sectionAccountInfo}>
              <dl className="flex flex-col gap-3 text-sm">
                <Row label={m.labelAccountStatus} icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  {u.active ? (
                    <Badge tone="success" variant="soft" dot size="sm">{m.statusBadgeActive}</Badge>
                  ) : (
                    <Badge tone="gray" variant="soft" dot size="sm">{m.statusBadgeSuspended}</Badge>
                  )}
                </Row>
                <Row label={m.labelClientType} icon={<ShieldAlert className="h-3.5 w-3.5" />}>
                  <Badge tone={role === 'CUSTOMER' ? 'success' : 'info'} variant="soft" size="sm">
                    {role === 'CUSTOMER' ? m.roleBadgeOwner : m.roleBadgeBrowser}
                  </Badge>
                </Row>
                <Row label={m.labelRegistered} icon={<Calendar className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700">{formatDate(u.createdAt)}</span>
                </Row>
                <Row label={m.labelLastLogin} icon={<Clock className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : m.noLoginYet}
                  </span>
                </Row>
                <Row label={m.labelClientId} icon={<Hash className="h-3.5 w-3.5" />}>
                  <span className="font-mono text-2xs text-slate-500">
                    #{u.id.slice(0, 8).toUpperCase()}
                  </span>
                </Row>
              </dl>
            </PremiumSectionCard>

            <PremiumSectionCard title={m.sectionAccountStatus}>
              <p className="text-xs text-slate-500 mb-4">
                {u.active ? m.statusDescActive : m.statusDescSuspended}
              </p>
              {u.active ? (
                <ConfirmButton
                  label={m.btnDeactivate}
                  confirm={m.confirmDeactivate}
                  action={deactivateClientAction.bind(null, id)}
                />
              ) : (
                <form action={activateClientAction.bind(null, id)}>
                  <Button type="submit" variant="primary" size="sm" leftIcon={<Power className="h-4 w-4" />}>
                    {m.btnActivate}
                  </Button>
                </form>
              )}
              {!u.active && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-2xs text-slate-500">
                  <PowerOff className="h-3 w-3 text-slate-400" />
                  {m.suspendedSince} {formatDate(u.updatedAt ?? u.createdAt)}
                </p>
              )}
            </PremiumSectionCard>
          </div>
        }
      />
    </div>
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
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 font-semibold">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function ContactCell({
  icon,
  label,
  value,
  href,
  tone,
  isLtr,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
  tone: 'brand' | 'info' | 'purple';
  isLtr?: boolean;
}) {
  const ICON_TONE: Record<typeof tone, string> = {
    brand: 'bg-brand-50 text-brand-600',
    info: 'bg-info-50 text-info-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  const inner = (
    <>
      <span
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
          ICON_TONE[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className="text-sm font-medium text-slate-900 truncate"
          dir={isLtr ? 'ltr' : undefined}
        >
          {value ?? <span className="text-slate-400">—</span>}
        </p>
      </div>
    </>
  );

  const className =
    'flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline';

  if (href && value) {
    return (
      <a href={href} className={cn(className, 'hover:bg-canvas transition-colors')}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function ReservationActivityItem({
  entry,
  labels,
  byLabel,
  systemLabel,
}: {
  entry: ReservationActivityEntry;
  labels: Record<string, string>;
  byLabel: string;
  systemLabel: string;
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
    success: 'bg-success-100 text-success-700 ring-success-200',
    danger: 'bg-danger-100 text-danger-700 ring-danger-200',
    warning: 'bg-warning-100 text-warning-700 ring-warning-200',
    brand: 'bg-brand-100 text-brand-700 ring-brand-200',
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
          {formatDateTime(entry.createdAt)}
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
}: {
  entry: AuditLog;
  actionLabels: Record<string, string>;
  byLabel: string;
  systemLabel: string;
}) {
  const tone =
    entry.action === 'POST'
      ? 'success'
      : entry.action === 'DELETE'
        ? 'danger'
        : 'brand';
  const dotClass: Record<typeof tone, string> = {
    success: 'bg-success-100 text-success-700 ring-success-200',
    danger: 'bg-danger-100 text-danger-700 ring-danger-200',
    brand: 'bg-brand-100 text-brand-700 ring-brand-200',
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
          {formatDateTime(entry.createdAt)}
        </time>
      </div>
    </li>
  );
}
