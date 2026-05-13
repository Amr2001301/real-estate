import Link from 'next/link';
import { CalendarClock, CalendarCheck, CalendarDays, Clock, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, safe } from '@/lib/api';
import type { Paged, VisitRequest, VisitAppointment } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tabs } from '@/components/ui/tabs';
import { DataTable } from '@/components/table';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { RequestActions } from './_components/request-actions';
import { AppointmentActions } from './_components/appointment-actions';

export const dynamic = 'force-dynamic';

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
  searchParams: Promise<{ tab?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = (sp.tab as Tab) ?? 'requests';

  const [statsRes, salesRes] = await Promise.all([
    safe(api.get<Stats>('/visits/stats')),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES&pageSize=100')),
  ]);

  const stats = statsRes.data;
  const salesOptions: SalesUser[] = salesRes.data?.data ?? [];

  // Fetch data for active tab
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
    qs.set('status', 'SCHEDULED');
    if (sp.q) qs.set('q', sp.q);
    const r1 = await safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?${qs}`));
    const qs2 = new URLSearchParams({ pageSize: '50', status: 'CONFIRMED' });
    const r2 = await safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?${qs2}`));
    appointmentsData = [...(r1.data?.data ?? []), ...(r2.data?.data ?? [])];
    fetchError = r1.error ?? r2.error ?? null;
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

  const tabs = [
    { label: 'طلبات الزيارة', href: '/dashboard/visits?tab=requests', count: stats?.totalRequests },
    { label: 'الزيارات المجدولة', href: '/dashboard/visits?tab=appointments', count: stats?.scheduledVisits },
    { label: 'زيارات اليوم', href: '/dashboard/visits?tab=today', count: stats?.todayVisits },
    { label: 'الزيارات السابقة', href: '/dashboard/visits?tab=past' },
  ];

  const activeHref = `/dashboard/visits?tab=${tab}`;

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="الزيارات"
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="طلبات جديدة"
          value={stats?.newRequests ?? '—'}
          icon={<CalendarClock />}
          tone="info"
        />
        <KpiCard
          label="زيارات اليوم"
          value={stats?.todayVisits ?? '—'}
          icon={<CalendarDays />}
          tone="brand"
        />
        <KpiCard
          label="هذا الأسبوع"
          value={stats?.weekVisits ?? '—'}
          icon={<CalendarCheck />}
          tone="success"
        />
        <KpiCard
          label="تحتاج تأكيد"
          value={stats?.pendingConfirmation ?? '—'}
          icon={<Clock />}
          tone="warning"
        />
      </div>

      {/* Tabs */}
      <Tabs items={tabs} activeHref={activeHref} />

      {/* Error */}
      {fetchError && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{fetchError}</p>
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <DataTable
          rowKey={(r) => r.id}
          rows={requestsData}
          emptyMessage="لا توجد طلبات زيارة"
          columns={[
            {
              key: 'number',
              header: 'رقم الطلب',
              cell: (r) => (
                <Link
                  href={`/dashboard/visits/requests/${r.id}` as never}
                  className="font-mono text-xs text-brand-700 hover:underline"
                >
                  {r.requestNumber ?? r.id.slice(0, 8)}
                </Link>
              ),
            },
            {
              key: 'customer',
              header: 'العميل',
              cell: (r) => (
                <div>
                  <p className="font-medium text-slate-900">
                    {r.customerName ?? r.user?.fullName ?? r.lead?.fullName ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.customerPhone ?? r.user?.phone ?? r.lead?.phone ?? ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'project',
              header: 'المشروع / الوحدة',
              cell: (r) => (
                <div>
                  <p>{tx(r.project?.name)}</p>
                  {r.unit && <p className="text-xs text-slate-500">وحدة: {r.unit.code}</p>}
                </div>
              ),
            },
            {
              key: 'preferred',
              header: 'التاريخ المفضل',
              cell: (r) => (
                <div>
                  <p>{formatDate(r.preferredDate)}</p>
                  {r.preferredTime && <p className="text-xs text-slate-500">{r.preferredTime}</p>}
                </div>
              ),
            },
            {
              key: 'source',
              header: 'المصدر',
              cell: (r) => {
                const LABELS: Record<string, string> = {
                  WEBSITE: 'الموقع', MOBILE_APP: 'التطبيق', SALES: 'مبيعات',
                  PHONE: 'هاتف', WHATSAPP: 'واتساب', OTHER: 'أخرى',
                };
                return r.source ? (LABELS[r.source] ?? r.source) : '—';
              },
            },
            {
              key: 'status',
              header: 'الحالة',
              cell: (r) =>
                r.requestStatus ? (
                  <VisitRequestStatusBadge status={r.requestStatus} />
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                ),
            },
            {
              key: 'date',
              header: 'تاريخ الإنشاء',
              cell: (r) => formatDate(r.createdAt),
            },
            {
              key: 'actions',
              header: '',
              cell: (r) => (
                <RequestActions request={r} salesOptions={salesOptions} />
              ),
            },
          ]}
        />
      )}

      {/* Appointments tabs (scheduled, today, past) */}
      {(tab === 'appointments' || tab === 'today' || tab === 'past') && (
        <DataTable
          rowKey={(a) => a.id}
          rows={appointmentsData}
          emptyMessage="لا توجد زيارات"
          columns={[
            {
              key: 'number',
              header: 'رقم الزيارة',
              cell: (a) => (
                <Link
                  href={`/dashboard/visits/appointments/${a.id}` as never}
                  className="font-mono text-xs text-brand-700 hover:underline"
                >
                  {a.visitNumber}
                </Link>
              ),
            },
            {
              key: 'customer',
              header: 'العميل',
              cell: (a) => (
                <div>
                  <p className="font-medium text-slate-900">
                    {a.client?.fullName ?? a.lead?.fullName ?? a.visitRequest?.customerName ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.client?.phone ?? a.lead?.phone ?? a.visitRequest?.customerPhone ?? ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'project',
              header: 'المشروع / الوحدة',
              cell: (a) => (
                <div>
                  <p>{tx(a.project?.name)}</p>
                  {a.unit && <p className="text-xs text-slate-500">وحدة: {a.unit.code}</p>}
                </div>
              ),
            },
            {
              key: 'scheduledAt',
              header: 'الموعد',
              cell: (a) => formatDateTime(a.scheduledAt),
            },
            {
              key: 'sales',
              header: 'المندوب',
              cell: (a) => a.assignedSales?.fullName ?? '—',
            },
            {
              key: 'status',
              header: 'الحالة',
              cell: (a) => <AppointmentStatusBadge status={a.status} />,
            },
            {
              key: 'actions',
              header: '',
              cell: (a) => (
                <AppointmentActions appointment={a} salesOptions={salesOptions} />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
