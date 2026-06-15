import {
  Building2,
  Home,
  Zap,
  FileSignature,
  Clock,
  Plus,
  Users,
  UserCheck,
  AlertCircle,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { SalesPerformanceChart } from '@/components/dashboard/sales-performance-chart';
import { LeadSourceDonut } from '@/components/dashboard/lead-source-donut';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { GenerateReportButton } from '@/components/dashboard/generate-report-button';
import { FunnelBar } from '@/components/dashboard/funnel-bar';
import { FinancialPanel } from '@/components/dashboard/financial-panel';
import { KpiStrip } from '@/components/dashboard/kpi-strip';
import { ProjectPerformanceTable } from '@/components/dashboard/project-performance-table';
import { ActionQueue } from './_components/action-queue';
import { SalesDashboard } from './_components/sales-home';
import { SalesManagerDashboard } from './_components/sales-manager-home';

// ── AdminSummary ──────────────────────────────────────────────────────────────
interface AdminSummary {
  kpis: {
    projects:          number;
    totalUnits:        number;
    availableUnits:    number;
    reservedUnits:     number;
    soldUnits:         number;
    newLeadsThisMonth: number;
    pendingDeposits:   number;
    openMaintenance:   number;
    signedContracts:   number;
    totalCustomers:    number;
    totalTeam:         number;
  };
  funnel?: {
    leads:        number;
    visits:       number;
    reservations: number;
    contracts:    number;
  };
  financial?: {
    totalContractValue:     number;
    totalCollectedVerified: number;
    overdueTotal:           number;
    pendingBonus:           number;
    pendingBrokerPayouts:   number;
  };
  topProjects?: Array<{
    id:              string;
    name:            string;
    totalUnits:      number;
    availableUnits:  number;
    reservedUnits:   number;
    soldUnits:       number;
    signedContracts: number;
    contractValue:   number;
  }>;
  reservationTrend: Array<{ month: string; label: string; value: number }>;
  leadSources:      Array<{ source: string; count: number }>;
  recentActivity: Array<{
    id:        string;
    type:      string;
    title:     string;
    action:    string;
    context:   string | null;
    createdAt: string;
  }>;
  alerts: {
    contractsAwaitingSignature:  number;
    depositsPendingReview:       number;
    openMaintenance:             number;
    reservationsExpiringSoon:    number;
    visitsAwaitingConfirmation:  number;
    infoRequestsOpen:            number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#C8A24B', '#A855F7', '#14B8A6', '#0F1E33', '#26405F', '#94A3B8'];

function activityHref(type: string, id: string): string | undefined {
  switch (type) {
    case 'reservation':  return `/dashboard/reservations/${id}`;
    case 'deposit':      return `/dashboard/deposits/${id}`;
    case 'contract':     return `/dashboard/contracts/${id}`;
    case 'lead':         return `/dashboard/leads/${id}`;
    case 'maintenance':  return `/dashboard/maintenance/${id}`;
    default:             return undefined;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.round(diffMs / 60000);
  if (mins < 1)  return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  const days = Math.round(hrs / 24);
  return `منذ ${days} يوم`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Clock className="h-5 w-5 text-slate-300" aria-hidden />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function DashboardHome() {
  const session = await getSession();
  if (session?.role === 'SALES')         return <SalesDashboard userId={session.id} />;
  if (session?.role === 'SALES_MANAGER') return <SalesManagerDashboard />;

  const r       = await safe(api.get<AdminSummary>('/reports/admin-summary'));
  const summary = r.data;
  const error   = r.error;

  const kpis = summary?.kpis;

  // Charts
  const leadSlices = (summary?.leadSources ?? []).map((s, i) => ({
    label: s.source,
    value: s.count,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));
  const leadTotal   = leadSlices.reduce((sum, s) => sum + s.value, 0);
  const topSource   = summary?.leadSources?.[0];
  const donutCenter = topSource && leadTotal > 0
    ? `${Math.round((topSource.count / leadTotal) * 100)}%`
    : undefined;

  const trendData = (summary?.reservationTrend ?? []).map((t) => ({
    month: t.label,
    value: t.value,
  }));

  // Activity feed — strip "type:" prefix from IDs before building route hrefs
  const activityRows = (summary?.recentActivity ?? []).map((it) => {
    const rawId = it.id.includes(':') ? it.id.split(':').slice(1).join(':') : it.id;
    return {
      id:     it.id,
      user:   it.title,
      action: it.action,
      entity: it.context ?? '—',
      time:   relativeTime(it.createdAt),
      href:   activityHref(it.type, rawId),
      type:   it.type,
    };
  });

  const fin        = summary?.financial;
  const hasFin     = fin != null;
  const funnel     = summary?.funnel;
  const hasFunnel  = funnel != null && funnel.leads > 0;
  const topProjects = summary?.topProjects ?? [];

  // Compact KPI strip items
  const kpiItems = kpis
    ? [
        { label: 'المشاريع',         value: kpis.projects },
        { label: 'وحدات متاحة',     value: kpis.availableUnits, sub: `محجوز ${kpis.reservedUnits} · مباع ${kpis.soldUnits ?? 0}` },
        { label: 'عقود موقعة',      value: kpis.signedContracts ?? 0 },
        { label: 'العملاء النشطون', value: kpis.totalCustomers ?? 0 },
        { label: 'فرص جديدة',       value: kpis.newLeadsThisMonth, sub: 'هذا الشهر' },
        { label: 'الفريق',          value: kpis.totalTeam ?? 0 },
      ]
    : [];

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على أداء المنصة والإجراءات التشغيلية المعلقة."
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

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذر تحميل المؤشرات الحية</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{error}</p>
          </div>
        </div>
      )}

      {/* ── 1. Executive Operations Panel ───────────────────────────────────── */}
      {/* Action Required (primary, right) + Financial Snapshot (secondary, left) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-4">
        <div className="lg:col-span-8">
          <ActionQueue alerts={summary?.alerts} />
        </div>
        {hasFin && (
          <div className="lg:col-span-4">
            <FinancialPanel financial={fin!} />
          </div>
        )}
      </div>

      {/* ── 2. Business KPI Strip ───────────────────────────────────────────── */}
      {kpiItems.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>نظرة الأعمال</SectionLabel>
          <KpiStrip items={kpiItems} />
        </div>
      )}

      {/* ── 3. Conversion Funnel ────────────────────────────────────────────── */}
      {hasFunnel && (
        <div className="space-y-2.5">
          <SectionLabel>مسار التحويل</SectionLabel>
          <FunnelBar
            leads={funnel!.leads}
            visits={funnel!.visits}
            reservations={funnel!.reservations}
            contracts={funnel!.contracts}
          />
        </div>
      )}

      {/* ── 4. Analytics ────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>تحليل الأداء</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartPanel
            title="اتجاه الحجوزات الشهري"
            description="الحجوزات المسجلة — آخر 6 أشهر"
            className="lg:col-span-2"
            trailing={
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-brand-50 text-brand-700 text-2xs font-semibold">
                آخر 6 أشهر
              </span>
            }
          >
            {trendData.length > 0
              ? <SalesPerformanceChart data={trendData} />
              : <EmptyBlock message="لا توجد بيانات كافية" />
            }
          </ChartPanel>

          <ChartPanel
            title="مصادر الفرص"
            description="توزيع العملاء المحتملين حسب القناة"
          >
            {leadSlices.length > 0
              ? (
                <LeadSourceDonut
                  slices={leadSlices}
                  centerLabel={donutCenter}
                  centerSub={topSource?.source}
                />
              )
              : <EmptyBlock message="لا توجد بيانات كافية" />
            }
          </ChartPanel>
        </div>
      </div>

      {/* ── 5. Projects (right) + Activity Feed (left) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-4">

        {/* Project Performance — primary column */}
        <Card className="lg:col-span-7 p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">أداء المشاريع</h2>
              {topProjects.length > 0 && (
                <span className="text-2xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                  {topProjects.length} مشروع
                </span>
              )}
            </div>
          </div>
          {topProjects.length > 0
            ? <ProjectPerformanceTable projects={topProjects} />
            : <EmptyBlock message="لا توجد مشاريع منشورة بعد" />
          }
        </Card>

        {/* Recent Activity — vertical feed */}
        <Card className="lg:col-span-5 p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">آخر النشاطات</h2>
              {activityRows.length > 0 && (
                <span className="text-2xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                  {activityRows.length}
                </span>
              )}
            </div>
            <Link
              href={'/dashboard/audit' as never}
              className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
            >
              عرض الكل
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {activityRows.length > 0
            ? <ActivityTable rows={activityRows} compact />
            : <EmptyBlock message="لا توجد نشاطات مسجلة بعد" />
          }
        </Card>

      </div>

    </div>
  );
}
