import {
  Plus,
  AlertCircle,
  Activity,
  Building2,
  ArrowUpRight,
  TrendingUp,
  CalendarDays,
  ArrowLeft,
} from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { SalesPerformanceChart } from '@/components/dashboard/sales-performance-chart';
import { LeadSourceDonut } from '@/components/dashboard/lead-source-donut';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { GenerateReportButton } from '@/components/dashboard/generate-report-button';
import { FinancialHealthCard, SalesFunnelCard } from '@/components/dashboard/platform-summary';
import { ProjectHealthMatrix } from '@/components/dashboard/project-health-matrix';
import { ActionQueue } from './_components/action-queue';
import { SalesDashboard } from './_components/sales-home';
import { SalesManagerDashboard } from './_components/sales-manager-home';

// ── Types ─────────────────────────────────────────────────────────────────────

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
    totalContractValue:       number;
    totalCollectedVerified:   number;
    overdueTotal:             number;
    pendingBonus:             number;
    pendingBrokerPayouts:     number;
    collectedThisMonth:       number;
    prevMonthCollected:       number;
    signedContractsThisMonth: number;
    prevMonthSignedContracts: number;
    prevMonthNewLeads:        number;
  };
  cashflowForecast?: {
    next30:   number;
    next3160: number;
    next6190: number;
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
  return `منذ ${Math.round(hrs / 24)} يوم`;
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
      <TrendingUp className="h-5 w-5 text-slate-300" aria-hidden />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

// ── Revenue Command Strip ─────────────────────────────────────────────────────

interface CommandTile {
  label:    string;
  value:    string;
  sub:      string;
  valueCls: string;
  delta?:   string;
  deltaCls?: string;
}

function pctDelta(current: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function deltaLabel(pct: number): string {
  return `${pct >= 0 ? '↑' : '↓'}${Math.abs(pct)}% عن الشهر الماضي`;
}

function RevenueCommandStrip({
  kpis,
  financial,
}: {
  kpis:      AdminSummary['kpis'] | undefined | null;
  financial: AdminSummary['financial'] | undefined | null;
}) {
  const hasFin    = financial != null;
  const total     = financial?.totalContractValue     ?? 0;
  const collected = financial?.totalCollectedVerified ?? 0;
  const overdue   = financial?.overdueTotal           ?? 0;
  const rate      = total > 0 ? Math.round((collected / total) * 100) : null;

  const collectedThisMonth = financial?.collectedThisMonth ?? 0;
  const prevMonthCollected = financial?.prevMonthCollected ?? 0;
  const collectionDeltaPct = pctDelta(collectedThisMonth, prevMonthCollected);

  const signedThisMonth    = financial?.signedContractsThisMonth ?? 0;
  const prevSignedContracts = financial?.prevMonthSignedContracts ?? 0;
  const contractsDelta     = prevSignedContracts > 0 ? signedThisMonth - prevSignedContracts : null;

  const activeUnits = kpis
    ? kpis.availableUnits + kpis.reservedUnits + kpis.soldUnits
    : null;

  const tiles: CommandTile[] = [
    {
      label:    'إجمالي التعاقدات',
      value:    hasFin ? formatCompact(total) : '—',
      sub:      'القيمة الكلية للعقود',
      valueCls: 'text-slate-900',
    },
    {
      label:    'محصّل',
      value:    hasFin ? formatCompact(collected) : '—',
      sub:      hasFin && collectedThisMonth > 0
                  ? `هذا الشهر: ${formatCompact(collectedThisMonth)}`
                  : rate !== null ? `${rate}% من الإجمالي` : '—',
      valueCls: 'text-success-700',
      delta:    collectionDeltaPct !== null ? deltaLabel(collectionDeltaPct) : undefined,
      deltaCls: collectionDeltaPct !== null && collectionDeltaPct >= 0
                  ? 'text-success-600'
                  : 'text-danger-600',
    },
    {
      label:    'معدل التحصيل',
      value:    rate !== null ? `${rate}%` : '—',
      sub:      rate === null  ? '—'             :
                rate >= 70     ? 'أداء ممتاز'    :
                rate >= 40     ? 'يحتاج متابعة'  :
                                  'أداء منخفض',
      valueCls: rate === null  ? 'text-slate-400'  :
                rate >= 70     ? 'text-success-700' :
                rate >= 40     ? 'text-brand-600'   :
                                  'text-danger-700',
    },
    {
      label:    'متأخر',
      value:    hasFin ? formatCompact(overdue) : '—',
      sub:      hasFin && overdue > 0 ? 'تجاوزت الاستحقاق' : 'لا متأخرات',
      valueCls: hasFin && overdue > 0 ? 'text-danger-700' : 'text-slate-400',
    },
    {
      label:    'عقود الشهر',
      value:    hasFin ? String(signedThisMonth) : '—',
      sub:      kpis ? `${kpis.soldUnits} مباعة · ${kpis.reservedUnits} محجوزة` : '—',
      valueCls: 'text-slate-900',
      delta:    contractsDelta !== null
                  ? `${contractsDelta >= 0 ? '+' : ''}${contractsDelta} عن الشهر الماضي`
                  : undefined,
      deltaCls: contractsDelta !== null && contractsDelta >= 0
                  ? 'text-success-600'
                  : 'text-danger-600',
    },
  ];

  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-hairline">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface px-5 py-5">
            <p className="text-[11px] font-medium text-slate-400 mb-2 leading-none">{tile.label}</p>
            <p className={cn(
              'text-[22px] font-black tabular-nums leading-none tracking-tight',
              tile.valueCls,
            )}>
              {tile.value}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 leading-none">{tile.sub}</p>
            {tile.delta && (
              <p className={cn('text-[10px] font-semibold mt-1 leading-none', tile.deltaCls)}>
                {tile.delta}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cash Flow Forecast card ───────────────────────────────────────────────────

function CashFlowPreviewCard({
  forecast,
  overdueTotal,
}: {
  forecast:    NonNullable<AdminSummary['cashflowForecast']>;
  overdueTotal: number;
}) {
  const { next30, next3160, next6190 } = forecast;
  const grandTotal = next30 + next3160 + next6190 + overdueTotal;

  const slots = [
    { label: 'خلال 30 يوم',   amount: next30,       barCls: 'bg-success-400', valueCls: 'text-success-700' },
    { label: '31 – 60 يوم',  amount: next3160,      barCls: 'bg-amber-400',   valueCls: 'text-amber-700'   },
    { label: '61 – 90 يوم',  amount: next6190,      barCls: 'bg-brand-400',   valueCls: 'text-brand-700'   },
    { label: 'متأخر حالياً', amount: overdueTotal,  barCls: 'bg-danger-400',  valueCls: 'text-danger-700'  },
  ] as const;

  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline bg-canvas/50">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <p className="text-[13px] font-bold text-slate-800">توقع التدفق النقدي</p>
          {grandTotal > 0 && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[10px] font-bold">
              {formatCompact(grandTotal)} إجمالي
            </span>
          )}
        </div>
        <Link
          href={'/dashboard/financial-dashboard' as never}
          className="flex items-center gap-1 text-[11px] text-brand-700 hover:text-brand-800 font-bold transition-colors"
        >
          تفاصيل التحصيل
          <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-hairline">
        {slots.map((slot) => {
          const pct = grandTotal > 0 ? Math.round((slot.amount / grandTotal) * 100) : 0;
          return (
            <div key={slot.label} className="bg-surface px-5 py-4 flex flex-col gap-2">
              <p className="text-[11px] font-medium text-slate-400 leading-none">{slot.label}</p>
              <p className={cn('text-[20px] font-black tabular-nums leading-none tracking-tight', slot.valueCls)}>
                {formatCompact(slot.amount)}
              </p>
              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', slot.barCls)} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 leading-none tabular-nums">{pct}% من الإجمالي</p>
            </div>
          );
        })}
      </div>
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

  const topProjects  = summary?.topProjects ?? [];
  const hasFunnel    = !!(summary?.funnel && summary.funnel.leads > 0);
  const hasFinancial = !!summary?.financial;

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

      {/* ── 1. Revenue Command Strip ─────────────────────────────────────────── */}
      {summary && (
        <RevenueCommandStrip kpis={kpis} financial={summary.financial} />
      )}

      {/* ── 2. Action Required ──────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>يتطلب اتخاذ إجراء</SectionLabel>
        <ActionQueue alerts={summary?.alerts} />
      </div>

      {/* ── 3. Performance Analytics: Trend chart + Sales Funnel ─────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>تحليل الأداء</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-4">

          {/* Monthly trend chart */}
          <ChartPanel
            title="اتجاه الحجوزات الشهري"
            description="الحجوزات المسجلة — آخر 6 أشهر"
            className={hasFunnel ? 'lg:col-span-7' : 'lg:col-span-12'}
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

          {/* Sales Funnel — sits alongside trend chart */}
          {hasFunnel && summary?.funnel && (
            <div className="lg:col-span-5">
              <SalesFunnelCard funnel={summary.funnel} />
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Financial Health + Lead Sources ──────────────────────────────── */}
      {(hasFinancial || leadSlices.length > 0) && (
        <div className="space-y-2.5">
          <SectionLabel>الصحة المالية ومصادر العملاء</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-4">

            {/* Financial Health */}
            {hasFinancial && summary?.financial && (
              <div className={cn(
                'lg:col-span-8',
                leadSlices.length === 0 && 'lg:col-span-12',
              )}>
                <FinancialHealthCard financial={summary.financial} />
              </div>
            )}

            {/* Lead Sources donut */}
            {leadSlices.length > 0 && (
              <ChartPanel
                title="مصادر الفرص"
                description="توزيع العملاء المحتملين حسب القناة"
                className={cn(
                  hasFinancial ? 'lg:col-span-4' : 'lg:col-span-12',
                )}
              >
                <LeadSourceDonut
                  slices={leadSlices}
                  centerLabel={donutCenter}
                  centerSub={topSource?.source}
                />
              </ChartPanel>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Cash Flow Forecast ───────────────────────────────────────────── */}
      {summary?.cashflowForecast && (
        <div className="space-y-2.5">
          <SectionLabel>توقع التدفق النقدي — الـ 90 يوم القادمة</SectionLabel>
          <CashFlowPreviewCard
            forecast={summary.cashflowForecast}
            overdueTotal={summary.financial?.overdueTotal ?? 0}
          />
        </div>
      )}

      {/* ── 6. Project Health Matrix + Activity Feed ─────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>أداء المشاريع والنشاط الأخير</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-4">

          {/* Project Health Matrix */}
          <Card className="lg:col-span-7 p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-canvas/40">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">صحة المشاريع</h2>
                {topProjects.length > 0 && (
                  <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    {topProjects.length} مشروع
                  </span>
                )}
              </div>
              <Link
                href={'/dashboard/projects' as never}
                className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-bold transition-colors"
              >
                عرض الكل
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="p-4">
              <ProjectHealthMatrix projects={topProjects} />
            </div>
          </Card>

          {/* Activity Feed */}
          <Card className="lg:col-span-5 p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-hairline bg-canvas/40">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <Activity className="h-3.5 w-3.5 text-brand-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">آخر النشاطات</h2>
                {activityRows.length > 0 && (
                  <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
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

    </div>
  );
}
