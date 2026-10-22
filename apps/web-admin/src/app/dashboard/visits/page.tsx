import Link from 'next/link';
import { CalendarClock, CalendarDays, AlertCircle, Plus, Phone, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import { getLocale, type Locale } from '@/lib/locale';
import type { Paged, VisitRequest, VisitAppointment } from '@/lib/types';
import { formatDate, formatTime, intlLocale, tx, DEFAULT_TIME_ZONE } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { Tabs } from '@/components/ui/tabs';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { RequestActions } from './_components/request-actions';
import { AppointmentActions } from './_components/appointment-actions';
import { PremiumPageHero, PremiumSectionCard, PremiumEmptyState } from '@/components/premium';
import { uiT } from '@/messages/ui';
import { EntityLink } from '@/components/entity-link';

export const dynamic = 'force-dynamic';

function resolvedName(noClientName: string, ...parts: (string | null | undefined)[]): { name: string; isFallback: boolean } {
  for (const p of parts) {
    const n = p?.trim() ?? '';
    if (n.length > 1) return { name: n, isFallback: false };
    if (n.length === 1) return { name: noClientName, isFallback: true };
  }
  return { name: '—', isFallback: false };
}

type Tab = 'requests' | 'appointments' | 'today' | 'past';

interface Stats {
  newRequests: number;
  totalRequests: number;
  todayVisits: number;
  weekVisits: number;
  scheduledVisits: number;
  pendingConfirmation: number;
}

interface SalesUser {
  id: string;
  fullName: string;
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; q?: string; clientId?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = (sp.tab as Tab) ?? (sp.clientId ? 'appointments' : 'requests');

  const [statsRes, salesRes, locale] = await Promise.all([
    safe(api.get<Stats>('/visits/stats')),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    getLocale(),
  ]);
  const m = uiT(locale).pages.visits;
  const SOURCE_LABEL: Record<string, string> = {
    WEBSITE: m.sourceLabels.WEBSITE,
    MOBILE_APP: m.sourceLabels.APP,
    SALES: m.sourceLabels.SALES,
    PHONE: m.sourceLabels.PHONE,
    WHATSAPP: m.sourceLabels.WHATSAPP,
    OTHER: m.sourceLabels.OTHER,
  };

  const stats = statsRes.data;
  const salesOptions: SalesUser[] = salesRes.data?.data ?? [];

  let requestsData: VisitRequest[] = [];
  let appointmentsData: VisitAppointment[] = [];
  let fetchError: string | null = null;

  if (tab === 'requests') {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (sp.status) qs.set('status', sp.status);
    if (sp.q) qs.set('q', sp.q);
    const r = await safe(api.get<Paged<VisitRequest>>(`/visits/requests?${qs}`));
    if (r.error) fetchError = r.error;
    requestsData = r.data?.data ?? [];
  } else if (tab === 'appointments') {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (sp.clientId) { qs.set('clientId', sp.clientId); } else { qs.set('status', 'SCHEDULED'); }
    if (sp.q) qs.set('q', sp.q);
    const r1 = await safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?${qs}`));
    if (sp.clientId) {
      appointmentsData = r1.data?.data ?? [];
      fetchError = r1.error ?? null;
    } else {
      const qs2 = new URLSearchParams({ pageSize: '50', status: 'CONFIRMED' });
      const r2 = await safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?${qs2}`));
      appointmentsData = [...(r1.data?.data ?? []), ...(r2.data?.data ?? [])];
      fetchError = r1.error ?? r2.error ?? null;
    }
  } else if (tab === 'today') {
    const qs = new URLSearchParams({ pageSize: '50', today: '1' });
    const r = await safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?${qs}`));
    if (r.error) fetchError = r.error;
    appointmentsData = r.data?.data ?? [];
  } else if (tab === 'past') {
    const qs = new URLSearchParams({ pageSize: '50' });
    const r = await safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?${qs}`));
    if (r.error) fetchError = r.error;
    appointmentsData = (r.data?.data ?? []).filter((a) =>
      ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(a.status),
    );
  }

  const tabTitle =
    tab === 'requests'
      ? m.tabs.requests
      : tab === 'appointments'
        ? m.tabs.scheduled
        : tab === 'today'
          ? m.tabs.today
          : m.tabs.past;

  const tabs = [
    { label: m.tabs.requests, href: '/dashboard/visits?tab=requests', count: stats?.totalRequests },
    { label: m.tabs.scheduled, href: '/dashboard/visits?tab=appointments', count: stats?.scheduledVisits },
    { label: m.tabs.today, href: '/dashboard/visits?tab=today', count: stats?.todayVisits },
    { label: m.tabs.past, href: '/dashboard/visits?tab=past' },
  ];

  const activeHref = `/dashboard/visits?tab=${tab}`;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <Link href="/dashboard/visits/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.addBtn}
            </Button>
          </Link>
        }
      />

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.kpi.newRequests, value: stats?.newRequests ?? '—', href: '/dashboard/visits?tab=requests', warn: (stats?.newRequests ?? 0) > 0 },
            { label: m.kpi.today, value: stats?.todayVisits ?? '—', href: '/dashboard/visits?tab=today' },
            { label: m.kpi.thisWeek, value: stats?.weekVisits ?? '—' },
            { label: m.kpi.needConfirm, value: stats?.pendingConfirmation ?? '—', href: '/dashboard/visits?tab=appointments', warn: (stats?.pendingConfirmation ?? 0) > 0 },
          ]}
        />
      </section>

      <Tabs items={tabs} activeHref={activeHref} />

      {fetchError && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{fetchError}</p>
        </div>
      )}

      {tab === 'requests' && (
        <PremiumSectionCard
          title={tabTitle}
          trailing={
            <span className="text-xs text-slate-400 tabular-nums">
              {requestsData.length} {m.requestSuffix}
            </span>
          }
          padded={false}
        >
          {requestsData.length === 0 ? (
            <PremiumEmptyState icon={<CalendarClock />} title={m.empty.noRequests} />
          ) : (
            <ul className="divide-y divide-hairline" data-testid="visit-rows">
              {requestsData.map((r) => {
                const { name, isFallback } = resolvedName(
                  m.noClientName,
                  r.customerName,
                  r.user?.fullName,
                  r.lead?.fullName,
                );
                return (
                  <li key={r.id} data-testid="visit-row" className={ROW}>
                    {/* Date-only: stored as midnight UTC, so read in UTC. */}
                    <DateTile value={r.preferredDate} time={r.preferredTime} timeZone="UTC" locale={locale} />
                    <ClientCell
                      name={name}
                      muted={isFallback}
                      phone={r.customerPhone ?? r.user?.phone ?? r.lead?.phone}
                      href={`/dashboard/visits/requests/${r.id}`}
                      kind={m.requestWord}
                      code={r.requestNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                    />
                    <PlaceCell
                      project={tx(r.project?.name)}
                      projectId={r.project?.id}
                      unit={r.unit?.code}
                      unitId={r.unit?.id}
                      unitWord={m.unitPrefix.replace(':', '')}
                    />
                    <div className="hidden min-w-0 text-[12.5px] lg:block">
                      <p className="truncate font-semibold text-slate-800">
                        {r.source ? SOURCE_LABEL[r.source] ?? r.source : '—'}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-slate-500">
                        {m.createdOn} {formatDate(r.createdAt, locale)}
                      </p>
                    </div>
                    <div className="hidden lg:block">
                      {r.requestStatus ? (
                        <VisitRequestStatusBadge status={r.requestStatus} locale={locale} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                    <RequestActions request={r} salesOptions={salesOptions} locale={locale} />
                  </li>
                );
              })}
            </ul>
          )}
        </PremiumSectionCard>
      )}

      {(tab === 'appointments' || tab === 'today' || tab === 'past') && (
        <PremiumSectionCard
          title={tabTitle}
          trailing={
            <span className="text-xs text-slate-400 tabular-nums">
              {appointmentsData.length} {m.visitSuffix}
            </span>
          }
          padded={false}
        >
          {appointmentsData.length === 0 ? (
            <PremiumEmptyState icon={<CalendarDays />} title={m.empty.noVisits} />
          ) : (
            <ul className="divide-y divide-hairline" data-testid="visit-rows">
              {appointmentsData.map((a) => {
                const { name, isFallback } = resolvedName(
                  m.noClientName,
                  a.client?.fullName,
                  a.lead?.fullName,
                  a.visitRequest?.customerName,
                );
                return (
                  <li key={a.id} data-testid="visit-row" className={ROW}>
                    <DateTile
                      value={a.scheduledAt}
                      time={formatTime(a.scheduledAt, locale)}
                      timeZone={DEFAULT_TIME_ZONE}
                      locale={locale}
                    />
                    <ClientCell
                      name={name}
                      muted={isFallback}
                      phone={a.client?.phone ?? a.lead?.phone ?? a.visitRequest?.customerPhone}
                      href={`/dashboard/visits/appointments/${a.id}`}
                      kind={m.visitWord}
                      code={a.visitNumber}
                    />
                    <PlaceCell
                      project={tx(a.project?.name)}
                      projectId={a.project?.id}
                      unit={a.unit?.code}
                      unitId={a.unit?.id}
                      unitWord={m.unitPrefix.replace(':', '')}
                    />
                    <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
                      {a.assignedSales ? (
                        <>
                          <Avatar name={a.assignedSales.fullName} className="h-8 w-8 text-[11px]" />
                          <div className="min-w-0 text-[12.5px]">
                            <p className="text-[11px] text-slate-400">{m.appointmentCols.agent}</p>
                            <p className="truncate font-semibold text-slate-800">{a.assignedSales.fullName}</p>
                          </div>
                        </>
                      ) : (
                        <span className="text-[12.5px] text-slate-400">{m.noAgent}</span>
                      )}
                    </div>
                    <div className="hidden lg:block">
                      <AppointmentStatusBadge status={a.status} locale={locale} />
                    </div>
                    <AppointmentActions appointment={a} salesOptions={salesOptions} locale={locale} />
                  </li>
                );
              })}
            </ul>
          )}
        </PremiumSectionCard>
      )}
    </div>
  );
}

const ROW =
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_190px_170px]';

/** A small calendar leaf: weekday, day number, month; the time beneath. */
function DateTile({
  value,
  time,
  timeZone,
  locale,
}: {
  value: string | null | undefined;
  time?: string | null;
  timeZone: string;
  locale: Locale;
}) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return <div className="h-[68px] w-16 rounded-2xl border border-dashed border-hairline" />;
  }
  const loc = intlLocale(locale);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { ...o, timeZone }).format(d);
  return (
    <div className="flex w-16 flex-col items-center overflow-hidden rounded-2xl border border-hairline bg-surface-muted/40 text-center">
      <span className="w-full bg-[#C9A24E]/12 py-0.5 text-[10.5px] font-bold text-brand-700">{part({ weekday: 'short' })}</span>
      <span className="pt-1 text-[22px] font-bold leading-none tabular-nums text-slate-900">{part({ day: 'numeric' })}</span>
      <span className="pb-1 text-[11px] font-semibold text-slate-500">{part({ month: 'short' })}</span>
      {time && (
        <span dir="ltr" className="w-full border-t border-hairline py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-600">
          {time}
        </span>
      )}
    </div>
  );
}

function ClientCell({
  name,
  muted,
  phone,
  href,
  kind,
  code,
}: {
  name: string;
  muted?: boolean;
  phone?: string | null;
  href: string;
  kind: string;
  code: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <div className="min-w-0">
        <Link
          href={href as never}
          className={cn('block truncate text-[14.5px] font-bold hover:text-brand-700', muted ? 'text-slate-400' : 'text-slate-900')}
        >
          {name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
          <Link href={href as never} data-testid="list-code" className="whitespace-nowrap hover:text-brand-700">
            <span className="me-1 text-slate-400">{kind}</span>
            <span className="font-mono font-semibold text-brand-700" dir="ltr">{code}</span>
          </Link>
          {phone && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Phone className="h-3 w-3 shrink-0" />
              <span dir="ltr">{phone}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceCell({
  project,
  unit,
  unitWord,
  projectId,
  unitId,
}: {
  project: string;
  unit?: string | null;
  unitWord: string;
  projectId?: string | null;
  unitId?: string | null;
}) {
  return (
    <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800">
          {project ? <EntityLink kind="project" id={projectId} mono={false}>{project}</EntityLink> : '—'}
        </p>
        {unit && (
          <p className="mt-0.5 text-slate-500">
            <span className="me-1 text-slate-400">{unitWord}</span>
            <EntityLink kind="unit" id={unitId} className="whitespace-nowrap">{unit}</EntityLink>
          </p>
        )}
      </div>
    </div>
  );
}
