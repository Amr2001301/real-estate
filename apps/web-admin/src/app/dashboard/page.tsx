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
    <div className="flex items-center gap-2.5">
      <span className="h-[5px] w-[5px] rounded-full bg-brand-400/80 shrink-0" />
      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
      <TrendingUp className="h-5 w-5 text-slate-200" aria-hidden />
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
  icon:     ReactNode;
  iconCls:  string;
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

  const signedThisMonth     = financial?.signedContractsThisMonth ?? 0;
  const prevSignedContracts = financial?.prevMonthSignedContracts ?? 0;
  const contractsDelta      = prevSignedContracts > 0 ? signedThisMonth - prevSignedContracts : null;

  const activeUnits = kpis
    ? kpis.availableUnits + kpis.reservedUnits + kpis.soldUnits
    : null;

  void activeUnits;

  const rateIconCls = rate === null  ? 'bg-slate-100 text-slate-400'   :
                      rate >= 70     ? 'bg-success-50 text-success-600' :
                      rate >= 40     ? 'bg-amber-50 text-amber-600'     :
                                       'bg-danger-50 text-danger-500';

  const tiles: CommandTile[] = [
    {
      label:    'إجمالي التعاقدات',
      value:    hasFin ? formatCompact(total) : '—',
      sub:      'القيمة الكلية للعقود',
      valueCls: 'text-slate-900',
      icon:     <Building2 className="h-4 w-4" />,
      iconCls:  'bg-slate-100 text-slate-600',
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
      icon:     <TrendingUp className="h-4 w-4" />,
      iconCls:  'bg-success-50 text-success-600',
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
      icon:     <Activity className="h-4 w-4" />,
      iconCls:  rateIconCls,
    },
    {
      label:    'متأخر',
      value:    hasFin ? formatCompact(overdue) : '—',
      sub:      hasFin && overdue > 0 ? 'تجاوزت الاستحقاق' : 'لا متأخرات',
      valueCls: hasFin && overdue > 0 ? 'text-danger-700' : 'text-slate-400',
      icon:     <AlertCircle className="h-4 w-4" />,
      iconCls:  hasFin && overdue > 0 ? 'bg-danger-50 text-danger-500' : 'bg-slate-100 text-slate-400',
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
      icon:     <CalendarDays className="h-4 w-4" />,
      iconCls:  'bg-brand-50 text-brand-600',
    },
  ];

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-hairline">
        {tiles.map((tile, idx) => (
          <div
            key={tile.label}
            className={cn(
              'bg-surface px-6 py-6 flex flex-col gap-4',
              idx === 0 && 'bg-canvas/40',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]',
                tile.iconCls,
              )}>
                {tile.icon}
              </span>
              <p className="text-[11px] font-semibold text-slate-400 text-end leading-snug max-w-[90px]">
                {tile.label}
              </p>
            </div>
            <div>
              <p className={cn('text-[26px] font-black tabular-nums leading-none tracking-tight', tile.valueCls)}>
                {tile.value}
              </p>
              <p className="text-[11px] text-slate-400 mt-2.5 leading-none">{tile.sub}</p>
              {tile.delta && (
                <p className={cn('text-[10px] font-semibold mt-2 leading-none', tile.deltaCls)}>
                  {tile.delta}
                </p>
              )}
            </div>
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
  forecast:     NonNullable<AdminSummary['cashflowForecast']>;
  overdueTotal: number;
}) {
  const { next30, next3160, next6190 } = forecast;
  const grandTotal = next30 + next3160 + next6190 + overdueTotal;

  const slots = [
    { label: 'خلال 30 يوم',  amount: next30,      barCls: 'bg-success-400', valueCls: 'text-success-700' },
    { label: '31 – 60 يوم', amount: next3160,     barCls: 'bg-amber-400',   valueCls: 'text-amber-700'   },
    { label: '61 – 90 يوم', amount: next6190,     barCls: 'bg-brand-400',   valueCls: 'text-brand-700'   },
    { label: 'متأخر حالياً', amount: overdueTotal, barCls: 'bg-danger-400',  valueCls: 'text-danger-700'  },
  ] as const;

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
            <CalendarDays className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-navy leading-none">توقع التدفق النقدي</p>
            {grandTotal > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                الإجمالي:{' '}
                <span className="font-semibold text-slate-600">{formatCompact(grandTotal)} ر.س</span>
              </p>
            )}
          </div>
        </div>
        <Link
          href={'/dashboard/financial-dashboard' as never}
          className="flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-800 transition-colors"
        >
          تفاصيل التحصيل
          <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-hairline">
        {slots.map((slot) => {
          const pct = grandTotal > 0 ? Math.round((slot.amount / grandTotal) * 100) : 0;
          return (
            <div key={slot.label} className="bg-surface px-6 py-5 flex flex-col gap-2.5">
              <p className="text-[11px] font-medium text-slate-400 leading-none">{slot.label}</p>
              <p className={cn('text-[24px] font-black tabular-nums leading-none tracking-tight', slot.valueCls)}>
                {formatCompact(slot.amount)}
              </p>
              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                <div className={cn('h-full rounded-full', slot.barCls)} style={{ width: `${pct}%` }} />
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
    <div className="space-y-6">

      {/* ── Premium Command Hero ──────────────────────────────────────────────── */}
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 py-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-navy leading-tight">
                لوحة التحكم
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                نظرة عامة على أداء المنصة والإجراءات التشغيلية المعلقة.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <GenerateReportButton />
              <Link href={'/dashboard/projects/new' as never}>
                <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                  مشروع جديد
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-[18px] bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذر تحميل المؤشرات الحية</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{error}</p>
          </div>
        </div>
      )}

      {/* ── Executive KPI Strip ──────────────────────────────────────────────── */}
      {summary && (
        <RevenueCommandStrip kpis={kpis} financial={summary.financial} />
      )}

      {/* ── Action Required ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>يتطلب اتخاذ إجراء</SectionLabel>
        <ActionQueue alerts={summary?.alerts} />
      </div>

      {/* ── Performance Analytics ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>تحليل الأداء</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-5">

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

          {hasFunnel && summary?.funnel && (
            <div className="lg:col-span-5">
              <SalesFunnelCard funnel={summary.funnel} />
            </div>
          )}
        </div>
      </div>

      {/* ── Financial Health + Lead Sources ──────────────────────────────────── */}
      {(hasFinancial || leadSlices.length > 0) && (
        <div className="space-y-3">
          <SectionLabel>الصحة المالية ومصادر العملاء</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-5">

            {hasFinancial && summary?.financial && (
              <div className={cn('lg:col-span-8', leadSlices.length === 0 && 'lg:col-span-12')}>
                <FinancialHealthCard financial={summary.financial} />
              </div>
            )}

            {leadSlices.length > 0 && (
              <ChartPanel
                title="مصادر الفرص"
                description="توزيع العملاء المحتملين حسب القناة"
                className={cn(hasFinancial ? 'lg:col-span-4' : 'lg:col-span-12')}
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

      {/* ── Cash Flow Forecast ───────────────────────────────────────────────── */}
      {summary?.cashflowForecast && (
        <div className="space-y-3">
          <SectionLabel>توقع التدفق النقدي — الـ 90 يوم القادمة</SectionLabel>
          <CashFlowPreviewCard
            forecast={summary.cashflowForecast}
            overdueTotal={summary.financial?.overdueTotal ?? 0}
          />
        </div>
      )}

      {/* ── Project Health + Activity Feed ───────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>أداء المشاريع والنشاط الأخير</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-5">

          {/* Project Health Matrix */}
          <div className="lg:col-span-7 bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-navy leading-none">صحة المشاريع</h2>
                  {topProjects.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{topProjects.length} مشروع نشط</p>
                  )}
                </div>
              </div>
              <Link
                href={'/dashboard/projects' as never}
                className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors"
              >
                عرض الكل
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="p-5">
              <ProjectHealthMatrix projects={topProjects} />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-5 bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-navy leading-none">آخر النشاطات</h2>
                  {activityRows.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{activityRows.length} نشاط مسجّل</p>
                  )}
                </div>
              </div>
              <Link
                href={'/dashboard/audit' as never}
                className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors"
              >
                عرض الكل
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {activityRows.length > 0
              ? <ActivityTable rows={activityRows.slice(0, 6)} compact />
              : <EmptyBlock message="لا توجد نشاطات مسجلة بعد" />
            }
          </div>

        </div>
      </div>

    </div>
  );
}
