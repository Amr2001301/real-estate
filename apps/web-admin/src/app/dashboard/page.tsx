import {
  Building2,
  Home,
  Zap,
  CalendarCheck2,
  Receipt,
  Wrench,
  Banknote,
  AlertCircle,
  FileText,
  MessageSquare,
  Clock,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { BookingsTrendChart } from '@/components/dashboard/bookings-trend-chart';
import { LeadSourceDonut } from '@/components/dashboard/lead-source-donut';
import { AlertList, type AlertItem } from '@/components/dashboard/alert-list';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { SupportCard } from '@/components/dashboard/support-card';
import { GenerateReportButton } from '@/components/dashboard/generate-report-button';
import { SalesDashboard } from './_components/sales-home';
import { SalesManagerDashboard } from './_components/sales-manager-home';

// P14 — the single ADMIN dashboard feed. Every value is DB-derived; there is
// no demo data on this screen anymore.
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

const DONUT_COLORS = ['#C8A24B', '#0F1E33', '#26405F', '#D4B36A', '#94A3B8', '#CBD5E1'];

/** Server-rendered relative time in Arabic (no client JS needed). */
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
  // Non-admin staff get their own home — the admin summary below is ADMIN-only
  // and would 403 for them.
  const session = await getSession();
  if (session && session.role === 'SALES') {
    return <SalesDashboard userId={session.id} />;
  }
  if (session && session.role === 'SALES_MANAGER') {
    return <SalesManagerDashboard />;
  }

  const r = await safe(api.get<AdminSummary>('/reports/admin-summary'));
  const summary = r.data;
  const error = r.error;

  // Lead-source distribution → donut slices + center label (top source share).
  const leadSlices = (summary?.leadSources ?? []).map((s, i) => ({
    label: s.source,
    value: s.count,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));
  const leadTotal = leadSlices.reduce((sum, s) => sum + s.value, 0);
  const topSource = summary?.leadSources?.[0];
  const donutCenter =
    topSource && leadTotal > 0 ? `${Math.round((topSource.count / leadTotal) * 100)}%` : undefined;

  // Reservation trend → bar chart (zeros render as empty bars — never faked).
  const trendData = (summary?.reservationTrend ?? []).map((t) => ({ month: t.label, value: t.value }));

  // Alerts → only actionable, non-zero counts (no fabricated rows).
  const a = summary?.alerts;
  const alertItems: AlertItem[] = a
    ? (
        [
          a.contractsAwaitingSignature > 0 && {
            id: 'contracts',
            tone: 'danger' as const,
            title: `${a.contractsAwaitingSignature} عقود بانتظار التوقيع`,
            description: 'عقود لم تُوقَّع بعد',
            icon: <FileText />,
          },
          a.depositsPendingReview > 0 && {
            id: 'deposits',
            tone: 'info' as const,
            title: `${a.depositsPendingReview} دفعات بانتظار المراجعة`,
            description: 'إثباتات دفع مقدّمة من العملاء',
            icon: <Banknote />,
          },
          a.openMaintenance > 0 && {
            id: 'maintenance',
            tone: 'warning' as const,
            title: `${a.openMaintenance} طلبات صيانة مفتوحة`,
            icon: <Wrench />,
          },
          a.reservationsExpiringSoon > 0 && {
            id: 'reservations',
            tone: 'warning' as const,
            title: `${a.reservationsExpiringSoon} حجوزات تنتهي قريباً`,
            description: 'خلال 7 أيام',
            icon: <CalendarCheck2 />,
          },
          a.visitsAwaitingConfirmation > 0 && {
            id: 'visits',
            tone: 'info' as const,
            title: `${a.visitsAwaitingConfirmation} زيارات بانتظار تأكيد العميل`,
            icon: <CalendarCheck2 />,
          },
          a.infoRequestsOpen > 0 && {
            id: 'info',
            tone: 'neutral' as const,
            title: `${a.infoRequestsOpen} استفسارات مفتوحة`,
            icon: <MessageSquare />,
          },
        ].filter(Boolean) as AlertItem[]
      )
    : [];

  // Recent activity → table rows (derived from real createdAt rows).
  const activityRows = (summary?.recentActivity ?? []).map((it) => ({
    id: it.id,
    user: it.title,
    action: it.action,
    entity: it.context ?? '—',
    time: relativeTime(it.createdAt),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="مرحباً بك في المجلس الرقمي"
        description="نظرة عامة على أداء المحفظة العقارية والعمليات الجارية اليوم."
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

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <PageKpiCard label="إجمالي المشاريع" value={summary.kpis.projects} icon={<Building2 />} tone="brand" />
          <PageKpiCard
            label="الوحدات المتاحة"
            value={summary.kpis.availableUnits}
            sub={`من إجمالي ${summary.kpis.totalUnits}`}
            icon={<Home />}
            tone="info"
          />
          <PageKpiCard
            label="الفرص الجديدة"
            value={summary.kpis.newLeadsThisMonth}
            sub={summary.kpis.newLeadsThisMonth > 0 ? 'هذا الشهر' : undefined}
            icon={<Zap />}
            tone="accent"
          />
          <PageKpiCard label="الحجوزات النشطة" value={summary.kpis.reservedUnits} icon={<CalendarCheck2 />} tone="success" />
          <PageKpiCard label="ودائع معلقة" value={summary.kpis.pendingDeposits} icon={<Receipt />} tone="warning" />
          <PageKpiCard label="طلبات صيانة مفتوحة" value={summary.kpis.openMaintenance} icon={<Wrench />} tone="danger" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel title="توزيع العملاء المحتملين" description="حسب مصدر القناة" className="lg:col-span-1">
          {leadSlices.length > 0 ? (
            <LeadSourceDonut slices={leadSlices} centerLabel={donutCenter} centerSub={topSource?.source} />
          ) : (
            <EmptyBlock message="لا توجد بيانات كافية" />
          )}
        </ChartPanel>

        <ChartPanel
          title="اتجاهات الحجوزات"
          description="مقارنة الـ 6 أشهر الماضية"
          className="lg:col-span-2"
          trailing={
            <span className="inline-flex items-center h-7 px-3 rounded-full bg-brand-50 text-brand-700 text-2xs font-semibold">
              آخر 6 أشهر
            </span>
          }
        >
          {trendData.length > 0 ? (
            <BookingsTrendChart data={trendData} />
          ) : (
            <EmptyBlock message="لا توجد بيانات كافية" />
          )}
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="overflow-hidden lg:col-span-1">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-hairline">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-danger-50 text-danger-600 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">تنبيهات معلقة</h3>
          </div>
          <div className="p-4 sm:p-5">
            {alertItems.length > 0 ? (
              <AlertList items={alertItems} />
            ) : (
              <EmptyBlock message="لا توجد تنبيهات حالياً" />
            )}
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">آخر النشاطات</h3>
            <Link
              href={'/dashboard/audit' as never}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              عرض الكل
              <ArrowLeft className="h-3.5 w-3.5" />
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
      </div>

      <SupportCard />
    </div>
  );
}
