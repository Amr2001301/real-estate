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

export const dynamic = 'force-dynamic';

function resolvedName(...parts: (string | null | undefined)[]): { name: string; isFallback: boolean } {
  for (const p of parts) {
    const n = p?.trim() ?? '';
    if (n.length > 1) return { name: n, isFallback: false };
    if (n.length === 1) return { name: 'عميل بدون اسم', isFallback: true };
  }
  return { name: '—', isFallback: false };
}

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: 'الموقع',
  MOBILE_APP: 'التطبيق',
  SALES: 'مبيعات',
  PHONE: 'هاتف',
  WHATSAPP: 'واتساب',
  OTHER: 'أخرى',
};

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

  const [statsRes, salesRes] = await Promise.all([
    safe(api.get<Stats>('/visits/stats')),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
  ]);

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
      ? 'طلبات الزيارة'
      : tab === 'appointments'
        ? 'الزيارات المجدولة'
        : tab === 'today'
          ? 'زيارات اليوم'
          : 'الزيارات السابقة';

  const tabs = [
    { label: 'طلبات الزيارة', href: '/dashboard/visits?tab=requests', count: stats?.totalRequests },
    { label: 'الزيارات المجدولة', href: '/dashboard/visits?tab=appointments', count: stats?.scheduledVisits },
    { label: 'زيارات اليوم', href: '/dashboard/visits?tab=today', count: stats?.todayVisits },
    { label: 'الزيارات السابقة', href: '/dashboard/visits?tab=past' },
  ];

  const activeHref = `/dashboard/visits?tab=${tab}`;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title="الزيارات"
        description="متابعة زيارات العملاء وجدولتها وحالات التأكيد."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الزيارات' },
        ]}
        actions={
          <Link href="/dashboard/visits/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              زيارة جديدة
            </Button>
          </Link>
        }
      />

      <PremiumMetricStrip
        metrics={[
          {
            label: 'طلبات جديدة',
            value: stats?.newRequests ?? '—',
            icon: <CalendarClock className="h-4 w-4" />,
            tone: 'info',
          },
          {
            label: 'زيارات اليوم',
            value: stats?.todayVisits ?? '—',
            icon: <CalendarDays className="h-4 w-4" />,
            primary: true,
            tone: 'brand',
          },
          {
            label: 'هذا الأسبوع',
            value: stats?.weekVisits ?? '—',
            icon: <CalendarCheck className="h-4 w-4" />,
            tone: 'success',
          },
          {
            label: 'تحتاج تأكيد',
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
              {requestsData.length} طلب
            </span>
          }
          padded={false}
        >
          {requestsData.length === 0 ? (
            <PremiumEmptyState
              icon={<CalendarClock />}
              title="لا توجد طلبات زيارة"
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">رقم الطلب</th>
                    <th className="text-start py-3 px-4">العميل</th>
                    <th className="text-start py-3 px-4">المشروع / الوحدة</th>
                    <th className="text-start py-3 px-4 whitespace-nowrap">التاريخ المفضل</th>
                    <th className="text-start py-3 px-4">المصدر</th>
                    <th className="text-start py-3 px-4">الحالة</th>
                    <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الإنشاء</th>
                    <th className="py-3 ps-4 pe-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {requestsData.map((r) => {
                    const { name, isFallback } = resolvedName(
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
                              <p className="text-xs text-slate-500">وحدة: {r.unit.code}</p>
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
                            <VisitRequestStatusBadge status={r.requestStatus} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="py-3 ps-4 pe-5 text-end">
                          <RequestActions request={r} salesOptions={salesOptions} />
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
              {appointmentsData.length} زيارة
            </span>
          }
          padded={false}
        >
          {appointmentsData.length === 0 ? (
            <PremiumEmptyState
              icon={<CalendarDays />}
              title="لا توجد زيارات"
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">رقم الزيارة</th>
                    <th className="text-start py-3 px-4">العميل</th>
                    <th className="text-start py-3 px-4">المشروع / الوحدة</th>
                    <th className="text-start py-3 px-4">الموعد</th>
                    <th className="text-start py-3 px-4">المندوب</th>
                    <th className="text-start py-3 px-4">الحالة</th>
                    <th className="py-3 ps-4 pe-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {appointmentsData.map((a) => {
                    const { name, isFallback } = resolvedName(
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
                              <p className="text-xs text-slate-500">وحدة: {a.unit.code}</p>
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
                          <AppointmentStatusBadge status={a.status} />
                        </td>
                        <td className="py-3 ps-4 pe-5 text-end">
                          <AppointmentActions appointment={a} salesOptions={salesOptions} />
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
