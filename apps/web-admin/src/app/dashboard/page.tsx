import {
  Building2,
  Home,
  Zap,
  CalendarCheck2,
  Receipt,
  Wrench,
  AlertCircle,
  Clock,
  Plus,
  Users,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { SalesPerformanceChart } from '@/components/dashboard/sales-performance-chart';
import { LeadSourceDonut } from '@/components/dashboard/lead-source-donut';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { OperationalPanel } from '@/components/dashboard/operational-panel';
import { GenerateReportButton } from '@/components/dashboard/generate-report-button';
import { SalesDashboard } from './_components/sales-home';
import { SalesManagerDashboard } from './_components/sales-manager-home';

interface AdminSummary {
  kpis: {
    projects: number;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    newLeadsThisMonth: number;
    pendingDeposits: number;
    openMaintenance: number;
  };
  reservationTrend: Array<{ month: string; label: string; value: number }>;
  leadSources: Array<{ source: string; count: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    action: string;
    context: string | null;
    createdAt: string;
  }>;
  alerts: {
    contractsAwaitingSignature: number;
    depositsPendingReview: number;
    openMaintenance: number;
    reservationsExpiringSoon: number;
    visitsAwaitingConfirmation: number;
    infoRequestsOpen: number;
  };
}

const DONUT_COLORS = ['#C8A24B', '#A855F7', '#14B8A6', '#0F1E33', '#26405F', '#94A3B8'];

function activityHref(type: string, id: string): string | undefined {
  switch (type) {
    case 'reservation': return `/dashboard/reservations/${id}`;
    case 'deposit':     return `/dashboard/deposits/${id}`;
    case 'contract':    return `/dashboard/contracts/${id}`;
    case 'lead':        return `/dashboard/leads/${id}`;
    case 'maintenance': return `/dashboard/maintenance/${id}`;
    default:            return undefined;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.round(hrs / 24);
  return `منذ ${days} يوم`;
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Clock className="h-5 w-5 text-slate-300" aria-hidden />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

export default async function DashboardHome() {
  const session = await getSession();
  if (session && session.role === 'SALES') {
    return <SalesDashboard userId={session.id} />;
  }
  if (session && session.role === 'SALES_MANAGER') {
    return <SalesManagerDashboard />;
  }

  const [r, customersRes, teamRes] = await Promise.all([
    safe(api.get<AdminSummary>('/reports/admin-summary')),
    safe(api.get<{ meta: { total: number } }>('/users?role=CUSTOMER&pageSize=1')),
    safe(api.get<{ meta: { total: number } }>('/users?role=ADMIN,SALES,SALES_MANAGER,MAINTENANCE_SUPERVISOR&pageSize=1')),
  ]);
  const summary = r.data;
  const error = r.error;
  const totalCustomers = customersRes.data?.meta.total ?? 0;
  const totalTeam = teamRes.data?.meta.total ?? 0;

  const leadSlices = (summary?.leadSources ?? []).map((s, i) => ({
    label: s.source,
    value: s.count,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));
  const leadTotal = leadSlices.reduce((sum, s) => sum + s.value, 0);
  const topSource = summary?.leadSources?.[0];
  const donutCenter =
    topSource && leadTotal > 0 ? `${Math.round((topSource.count / leadTotal) * 100)}%` : undefined;

  const trendData = (summary?.reservationTrend ?? []).map((t) => ({
    month: t.label,
    value: t.value,
  }));

  const a = summary?.alerts;

  const activityRows = (summary?.recentActivity ?? []).map((it) => ({
    id: it.id,
    user: it.title,
    action: it.action,
    entity: it.context ?? '—',
    time: relativeTime(it.createdAt),
    href: activityHref(it.type, it.id),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="مرحبًا بك في ديفورا"
        description="تابع أداء محفظتك العقارية وعمليات فريقك من لوحة واحدة."
        actions={
          <>
            <GenerateReportButton />
            <Link href={'/dashboard/projects/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                مشروع جديد
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl bg-warning-50 text-warning-700 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذر تحميل المؤشرات الحية</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{error}</p>
          </div>
        </div>
      )}

      {/* KPI strip — 4-col desktop, 2-col mobile */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Row 1 */}
          <PageKpiCard label="إجمالي المشاريع"   value={summary.kpis.projects}       icon={<Building2 />}    tone="brand"   />
          <PageKpiCard label="الوحدات المتاحة"   value={summary.kpis.availableUnits} sub={`من إجمالي ${summary.kpis.totalUnits}`} icon={<Home />} tone="info" />
          <PageKpiCard label="الحجوزات النشطة"   value={summary.kpis.reservedUnits}  icon={<CalendarCheck2 />} tone="success" />
          <PageKpiCard label="إجمالي العملاء"    value={totalCustomers}              icon={<UserCheck />}    tone="teal"    />
          {/* Row 2 */}
          <PageKpiCard label="الفرص الجديدة"     value={summary.kpis.newLeadsThisMonth} sub={summary.kpis.newLeadsThisMonth > 0 ? 'هذا الشهر' : undefined} icon={<Zap />} tone="accent" />
          <PageKpiCard label="ودائع معلقة"       value={summary.kpis.pendingDeposits} icon={<Receipt />}     tone="warning" />
          <PageKpiCard label="طلبات صيانة مفتوحة" value={summary.kpis.openMaintenance} icon={<Wrench />}    tone="danger"  />
          <PageKpiCard label="أعضاء الفريق"      value={totalTeam}                   icon={<Users />}       tone="purple"  />
        </div>
      )}

      {/* Row 2: Sales chart (2-col) + Lead Source Donut (1-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel
          title="أداء المبيعات الشهري"
          description="الحجوزات المسجلة — آخر 6 أشهر"
          className="lg:col-span-2"
          trailing={
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-brand-50 text-brand-700 text-2xs font-semibold">
              آخر 6 أشهر
            </span>
          }
        >
          {trendData.length > 0 ? (
            <SalesPerformanceChart data={trendData} />
          ) : (
            <EmptyBlock message="لا توجد بيانات كافية" />
          )}
        </ChartPanel>

        <ChartPanel
          title="توزيع العملاء المحتملين"
          description="حسب مصدر القناة"
        >
          {leadSlices.length > 0 ? (
            <LeadSourceDonut slices={leadSlices} centerLabel={donutCenter} centerSub={topSource?.source} />
          ) : (
            <EmptyBlock message="لا توجد بيانات كافية" />
          )}
        </ChartPanel>
      </div>

      {/* Row 3: Activity (2-col) + Operational Panel side column (1-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Latest Activity — primary wide card */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">آخر النشاطات</h3>
            <Link
              href={'/dashboard/audit' as never}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
            >
              عرض الكل
            </Link>
          </div>
          <div className="p-4 sm:p-5">
            {activityRows.length > 0 ? (
              <ActivityTable rows={activityRows} />
            ) : (
              <EmptyBlock message="لا توجد بيانات كافية" />
            )}
          </div>
        </Card>

        {/* Side column: Operational Panel (consolidates alerts — same data source) */}
        <OperationalPanel alerts={a} />
      </div>

    </div>
  );
}
