import Link from 'next/link';
import { CalendarClock, CalendarDays, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import { getLocale, type Locale } from '@/lib/locale';
import type { Paged, Project, VisitRequest, VisitAppointment } from '@/lib/types';
import { formatDate, formatTime, intlLocale, tx, DEFAULT_TIME_ZONE } from '@/lib/format';
import { FigIcons, FigureBar } from '@/components/cockpit/cockpit';
import { AgentCell, DataTable, DateText, ListTableCard, PersonCell, Td, Th, Tr, UnitCell } from '@/components/lists/list-kit';
import { Tabs } from '@/components/ui/tabs';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { RequestActions } from './_components/request-actions';
import { AppointmentActions } from './_components/appointment-actions';
import { PremiumPageHero, PremiumEmptyState } from '@/components/premium';
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

  const [statsRes, salesRes, locale, coverRes] = await Promise.all([
    safe(api.get<Stats>('/visits/stats')),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    getLocale(),
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);
  const covers = new Map((coverRes.data?.data ?? []).map((p) => [p.id, p.media?.[0]?.url]));
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

      <section>
        <FigureBar
          variant="cards"
          bare
          cols={4}
          figures={[
            { label: m.kpi.newRequests, value: stats?.newRequests ?? '—', href: '/dashboard/visits?tab=requests', warn: (stats?.newRequests ?? 0) > 0, icon: FigIcons.pending },
            { label: m.kpi.today, value: stats?.todayVisits ?? '—', href: '/dashboard/visits?tab=today', icon: FigIcons.calendar, tone: 'blue' },
            { label: m.kpi.thisWeek, value: stats?.weekVisits ?? '—', icon: FigIcons.calendar, tone: 'gold' },
            { label: m.kpi.needConfirm, value: stats?.pendingConfirmation ?? '—', href: '/dashboard/visits?tab=appointments', warn: (stats?.pendingConfirmation ?? 0) > 0, icon: FigIcons.confirm },
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
        <ListTableCard
          title={tabTitle}
          sub={m.description}
          trailing={
            <span className="tabular-nums">
              {requestsData.length} {m.requestSuffix}
            </span>
          }
        >
          {requestsData.length === 0 ? (
            <PremiumEmptyState icon={<CalendarClock />} title={m.empty.noRequests} />
          ) : (
            <DataTable testId="visit-rows">
              <thead>
                <tr>
                  <Th>{locale === 'ar' ? 'رقم الطلب' : 'Request'}</Th>
                  <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                  <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                  <Th>{locale === 'ar' ? 'التاريخ المفضل' : 'Preferred date'}</Th>
                  <Th>{locale === 'ar' ? 'المصدر' : 'Source'}</Th>
                  <Th>{locale === 'ar' ? 'الحالة' : 'Status'}</Th>
                  <Th>{locale === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {requestsData.map((r) => {
                  const { name, isFallback } = resolvedName(
                    m.noClientName,
                    r.customerName,
                    r.user?.fullName,
                    r.lead?.fullName,
                  );
                  const href = `/dashboard/visits/requests/${r.id}`;
                  return (
                    <Tr key={r.id} testId="visit-row">
                      <Td>
                        <Link href={href as never} data-testid="list-code" className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
                          {r.requestNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                        </Link>
                      </Td>
                      <Td>
                        <PersonCell name={name} muted={isFallback} phone={r.customerPhone ?? r.user?.phone ?? r.lead?.phone} href={href} />
                      </Td>
                      <Td>
                        <UnitCell
                          cover={r.project?.id ? covers.get(r.project.id) : undefined}
                          project={r.project ? <EntityLink kind="project" id={r.project.id} mono={false}>{tx(r.project.name)}</EntityLink> : undefined}
                          unit={r.unit?.code ? <EntityLink kind="unit" id={r.unit.id}>{r.unit.code}</EntityLink> : undefined}
                          unitWord={m.unitPrefix}
                        />
                      </Td>
                      <Td>
                        {/* Date-only: stored as midnight UTC, so read in UTC. */}
                        <DateText>{r.preferredDate ? formatDate(r.preferredDate, locale, 'UTC') : '—'}</DateText>
                        {r.preferredTime && <span className="ms-1.5 text-[11.5px] tabular-nums text-slate-400" dir="ltr">{r.preferredTime}</span>}
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-slate-700">{r.source ? SOURCE_LABEL[r.source] ?? r.source : '—'}</span>
                      </Td>
                      <Td>
                        {r.requestStatus ? (
                          <VisitRequestStatusBadge status={r.requestStatus} locale={locale} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </Td>
                      <Td>
                        <DateText>{formatDate(r.createdAt, locale)}</DateText>
                      </Td>
                      <Td>
                        <RequestActions request={r} salesOptions={salesOptions} locale={locale} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </ListTableCard>
      )}

      {(tab === 'appointments' || tab === 'today' || tab === 'past') && (
        <ListTableCard
          title={tabTitle}
          sub={m.description}
          trailing={
            <span className="tabular-nums">
              {appointmentsData.length} {m.visitSuffix}
            </span>
          }
        >
          {appointmentsData.length === 0 ? (
            <PremiumEmptyState icon={<CalendarDays />} title={m.empty.noVisits} />
          ) : (
            <DataTable testId="visit-rows">
              <thead>
                <tr>
                  <Th>{locale === 'ar' ? 'الموعد' : 'Appointment'}</Th>
                  <Th>{locale === 'ar' ? 'رقم الزيارة' : 'Visit'}</Th>
                  <Th>{locale === 'ar' ? 'العميل' : 'Client'}</Th>
                  <Th>{locale === 'ar' ? 'المشروع / الوحدة' : 'Project / unit'}</Th>
                  <Th>{locale === 'ar' ? 'المندوب' : 'Agent'}</Th>
                  <Th>{locale === 'ar' ? 'الحالة' : 'Status'}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {appointmentsData.map((a) => {
                  const { name, isFallback } = resolvedName(
                    m.noClientName,
                    a.client?.fullName,
                    a.lead?.fullName,
                    a.visitRequest?.customerName,
                  );
                  const href = `/dashboard/visits/appointments/${a.id}`;
                  return (
                    <Tr key={a.id} testId="visit-row">
                      <Td>
                        <DateTile
                          value={a.scheduledAt}
                          time={formatTime(a.scheduledAt, locale)}
                          timeZone={DEFAULT_TIME_ZONE}
                          locale={locale}
                        />
                      </Td>
                      <Td>
                        <Link href={href as never} data-testid="list-code" className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline" dir="ltr">
                          {a.visitNumber}
                        </Link>
                      </Td>
                      <Td>
                        <PersonCell
                          name={name}
                          muted={isFallback}
                          phone={a.client?.phone ?? a.lead?.phone ?? a.visitRequest?.customerPhone}
                          href={href}
                        />
                      </Td>
                      <Td>
                        <UnitCell
                          cover={a.project?.id ? covers.get(a.project.id) : undefined}
                          project={a.listing ? a.listing.title : a.project ? <EntityLink kind="project" id={a.project.id} mono={false}>{tx(a.project.name)}</EntityLink> : undefined}
                          unit={a.unit?.code ?? a.listing?.code}
                          unitWord={m.unitPrefix}
                        />
                      </Td>
                      <Td>
                        <AgentCell name={a.assignedSales?.fullName} empty={m.noAgent} />
                      </Td>
                      <Td>
                        <AppointmentStatusBadge status={a.status} locale={locale} />
                      </Td>
                      <Td>
                        <AppointmentActions appointment={a} salesOptions={salesOptions} locale={locale} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </ListTableCard>
      )}
    </div>
  );
}

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
