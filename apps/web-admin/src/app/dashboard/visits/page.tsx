import Link from 'next/link';
import {
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  Clock,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import type { Paged, VisitRequest, VisitAppointment } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { Tabs } from '@/components/ui/tabs';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { RequestActions } from './_components/request-actions';
import { AppointmentActions } from './_components/appointment-actions';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { uiT } from '@/messages/ui';

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
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
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

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          {
            label: m.kpi.newRequests,
            value: stats?.newRequests ?? '—',
            icon: <CalendarClock className="h-4 w-4" />,
            tone: 'info',
          },
          {
            label: m.kpi.today,
            value: stats?.todayVisits ?? '—',
            icon: <CalendarDays className="h-4 w-4" />,
            primary: true,
            tone: 'brand',
          },
          {
            label: m.kpi.thisWeek,
            value: stats?.weekVisits ?? '—',
            icon: <CalendarCheck className="h-4 w-4" />,
            tone: 'success',
          },
          {
            label: m.kpi.needConfirm,
            value: stats?.pendingConfirmation ?? '—',
            icon: <Clock className="h-4 w-4" />,
            tone: 'warning',
          },
        ]}
      />

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
            <PremiumEmptyState
              icon={<CalendarClock />}
              title={m.empty.noRequests}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">{m.requestCols.id}</th>
                    <th className="text-start py-3 px-4">{m.requestCols.client}</th>
                    <th className="text-start py-3 px-4">{m.requestCols.project}</th>
                    <th className="text-start py-3 px-4 whitespace-nowrap">{m.requestCols.preferredDate}</th>
                    <th className="text-start py-3 px-4">{m.requestCols.source}</th>
                    <th className="text-start py-3 px-4">{m.requestCols.status}</th>
                    <th className="text-start py-3 px-4 whitespace-nowrap">{m.requestCols.created}</th>
                    <th className="py-3 ps-4 pe-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {requestsData.map((r) => {
                    const { name, isFallback } = resolvedName(
                      m.noClientName,
                      r.customerName,
                      r.user?.fullName,
                      r.lead?.fullName,
                    );
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                      >
                        <td className="py-3 ps-5 pe-4">
                          <Link
                            href={`/dashboard/visits/requests/${r.id}` as never}
                            className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                          >
                            {r.requestNumber ?? r.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p
                              className={cn(
                                'font-medium',
                                isFallback ? 'text-slate-400 italic text-xs' : 'text-slate-900',
                              )}
                            >
                              {name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.customerPhone ?? r.user?.phone ?? r.lead?.phone ?? ''}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-slate-800">{tx(r.project?.name)}</p>
                            {r.unit && (
                              <p className="text-xs text-slate-500">{m.unitPrefix} {r.unit.code}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-slate-800">{formatDate(r.preferredDate)}</p>
                            {r.preferredTime && (
                              <p className="text-xs text-slate-500">{r.preferredTime}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-sm">
                          {r.source ? (SOURCE_LABEL[r.source] ?? r.source) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {r.requestStatus ? (
                            <VisitRequestStatusBadge status={r.requestStatus} locale={locale} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="py-3 ps-4 pe-5 text-end">
                          <RequestActions request={r} salesOptions={salesOptions} locale={locale} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
            <PremiumEmptyState
              icon={<CalendarDays />}
              title={m.empty.noVisits}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">{m.appointmentCols.id}</th>
                    <th className="text-start py-3 px-4">{m.appointmentCols.client}</th>
                    <th className="text-start py-3 px-4">{m.appointmentCols.project}</th>
                    <th className="text-start py-3 px-4">{m.appointmentCols.scheduled}</th>
                    <th className="text-start py-3 px-4">{m.appointmentCols.agent}</th>
                    <th className="text-start py-3 px-4">{m.appointmentCols.status}</th>
                    <th className="py-3 ps-4 pe-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {appointmentsData.map((a) => {
                    const { name, isFallback } = resolvedName(
                      m.noClientName,
                      a.client?.fullName,
                      a.lead?.fullName,
                      a.visitRequest?.customerName,
                    );
                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                      >
                        <td className="py-3 ps-5 pe-4">
                          <Link
                            href={`/dashboard/visits/appointments/${a.id}` as never}
                            className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                          >
                            {a.visitNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p
                              className={cn(
                                'font-medium',
                                isFallback ? 'text-slate-400 italic text-xs' : 'text-slate-900',
                              )}
                            >
                              {name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {a.client?.phone ??
                                a.lead?.phone ??
                                a.visitRequest?.customerPhone ??
                                ''}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-slate-800">{tx(a.project?.name)}</p>
                            {a.unit && (
                              <p className="text-xs text-slate-500">{m.unitPrefix} {a.unit.code}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                          {formatDateTime(a.scheduledAt)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {a.assignedSales?.fullName ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <AppointmentStatusBadge status={a.status} locale={locale} />
                        </td>
                        <td className="py-3 ps-4 pe-5 text-end">
                          <AppointmentActions appointment={a} salesOptions={salesOptions} locale={locale} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PremiumSectionCard>
      )}
    </div>
  );
}
