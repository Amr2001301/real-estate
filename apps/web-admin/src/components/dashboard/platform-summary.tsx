import {
  FileText,
  Wallet,
  AlertTriangle,
  Building2,
  ChevronDown,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Kpis {
  projects:        number;
  availableUnits:  number;
  reservedUnits:   number;
  soldUnits:       number;
  signedContracts: number;
  totalCustomers:  number;
  totalTeam:       number;
}

interface Financial {
  totalContractValue:     number;
  totalCollectedVerified: number;
  overdueTotal:           number;
  pendingBonus:           number;
  pendingBrokerPayouts:   number;
}

interface Funnel {
  leads:        number;
  visits:       number;
  reservations: number;
  contracts:    number;
}

interface TopProject {
  id:              string;
  name:            string;
  totalUnits:      number;
  availableUnits:  number;
  reservedUnits:   number;
  soldUnits:       number;
  signedContracts: number;
  contractValue:   number;
}

interface Props {
  kpis:          Kpis;
  financial?:    Financial;
  funnel?:       Funnel;
  topProjects?:  TopProject[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function convPct(num: number, denom: number): string | null {
  if (denom <= 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

// ── FinancialStackedBar ───────────────────────────────────────────────────────

function FinancialStackedBar({ financial }: { financial: Financial }) {
  const total        = financial.totalContractValue;
  const collected    = financial.totalCollectedVerified;
  const overdue      = financial.overdueTotal;
  const pending      = Math.max(0, total - collected - overdue);
  const liabilities  = financial.pendingBonus + financial.pendingBrokerPayouts;

  const collectedPct = total > 0 ? (collected / total) * 100 : 0;
  const overduePct   = total > 0 ? (overdue   / total) * 100 : 0;
  const pendingPct   = Math.max(0, 100 - collectedPct - overduePct);
  const collectionRate = total > 0 ? Math.round(collectedPct) : null;

  const chips = [
    {
      label:    'محصّل',
      value:    formatCompact(collected),
      pct:      Math.round(collectedPct),
      dotCls:   'bg-navy',
      pctCls:   'text-navy',
      valueCls: 'text-slate-900',
    },
    {
      label:    'مستحق',
      value:    formatCompact(pending),
      pct:      Math.round(pendingPct),
      dotCls:   'bg-brand-400',
      pctCls:   'text-brand-600',
      valueCls: 'text-slate-900',
    },
    {
      label:    'متأخر',
      value:    formatCompact(overdue),
      pct:      Math.round(overduePct),
      dotCls:   overdue > 0 ? 'bg-danger-700' : 'bg-slate-200',
      pctCls:   overdue > 0 ? 'text-danger-700' : 'text-slate-300',
      valueCls: overdue > 0 ? 'text-danger-700' : 'text-slate-300',
    },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1">

      {/* Hero metrics row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-canvas/70 border border-hairline rounded-[14px] p-3.5">
          <p className="text-[11px] text-slate-400 mb-2">إجمالي التعاقدات</p>
          <p className="text-[22px] font-black text-slate-900 tabular-nums leading-none tracking-tight">
            {formatCompact(total)}
          </p>
        </div>
        <div className="bg-canvas/70 border border-hairline rounded-[14px] p-3.5">
          <p className="text-[11px] text-slate-400 mb-2">معدل التحصيل</p>
          <p className={cn(
            'text-[22px] font-black tabular-nums leading-none tracking-tight',
            collectionRate === null       ? 'text-slate-400'  :
            collectionRate >= 70          ? 'text-success-600' :
            collectionRate >= 40          ? 'text-brand-600'   :
                                            'text-danger-700',
          )}>
            {collectionRate !== null ? `${collectionRate}%` : '—'}
          </p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="h-3.5 w-full rounded-full overflow-hidden bg-surface-muted flex">
        {collectedPct > 0 && (
          <div
            className="bg-navy shrink-0 transition-all duration-700"
            style={{ width: `${collectedPct}%` }}
          />
        )}
        {pendingPct > 0 && (
          <div
            className="bg-brand-400 shrink-0 transition-all duration-700"
            style={{ width: `${pendingPct}%` }}
          />
        )}
        {overduePct > 0 && (
          <div
            className="bg-danger-700 shrink-0 transition-all duration-700 opacity-75"
            style={{ width: `${overduePct}%` }}
          />
        )}
      </div>

      {/* Segment chips */}
      <div className="grid grid-cols-3 gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="border border-hairline rounded-[14px] p-3.5 bg-canvas/60 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', chip.dotCls)} />
              <span className="text-[11px] text-slate-500 leading-none">{chip.label}</span>
            </div>
            <p className={cn('text-[14px] font-bold tabular-nums leading-none', chip.valueCls)}>
              {chip.value}
            </p>
            <p className={cn('text-[12px] font-semibold leading-none', chip.pctCls)}>
              {chip.pct}%
            </p>
          </div>
        ))}
      </div>

      {/* Liabilities footer — only rendered when non-zero, pushes to bottom */}
      {liabilities > 0 && (
        <div className="mt-auto pt-3.5 border-t border-hairline flex items-center justify-between gap-2">
          <p className="text-[12px] text-slate-400">التزامات معلقة</p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="text-[13px] font-bold text-amber-700 tabular-nums">
              {formatCompact(liabilities)}
            </p>
            <p className="text-[11px] text-slate-400">عمولات + مكافآت</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FunnelRows ────────────────────────────────────────────────────────────────

function FunnelRows({ funnel }: { funnel: Funnel }) {
  const maxVal = funnel.leads || 1;

  const visitsRate   = convPct(funnel.visits,       funnel.leads);
  const resRate      = convPct(funnel.reservations,  funnel.visits);
  const contractRate = convPct(funnel.contracts,     funnel.reservations);

  const stages = [
    {
      label:     'فرص البيع',
      value:     funnel.leads,
      pct:       100,
      badge:     'البداية',
      badgeCls:  'bg-brand-50 border-brand-100 text-brand-700',
    },
    {
      label:     'الزيارات',
      value:     funnel.visits,
      pct:       Math.round((funnel.visits       / maxVal) * 100),
      badge:     visitsRate   ? `${visitsRate} تحويل`   : null,
      badgeCls:  'bg-surface-muted border-hairline text-slate-500',
    },
    {
      label:     'الحجوزات',
      value:     funnel.reservations,
      pct:       Math.round((funnel.reservations  / maxVal) * 100),
      badge:     resRate      ? `${resRate} تحويل`      : null,
      badgeCls:  'bg-surface-muted border-hairline text-slate-500',
    },
    {
      label:     'عقود موقعة',
      value:     funnel.contracts,
      pct:       Math.round((funnel.contracts     / maxVal) * 100),
      badge:     contractRate ? `${contractRate} تحويل` : null,
      badgeCls:  'bg-surface-muted border-hairline text-slate-500',
    },
  ];

  return (
    <div className="space-y-3.5">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[13px] font-semibold text-slate-700 leading-none">
              {stage.label}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[15px] font-bold text-slate-900 tabular-nums leading-none">
                {stage.value.toLocaleString('ar-SA')}
              </span>
              {stage.badge && (
                <span className={cn(
                  'inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium whitespace-nowrap',
                  stage.badgeCls,
                )}>
                  {stage.badge}
                </span>
              )}
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-700"
              style={{ width: `${stage.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function PlatformSummaryCard({ kpis, financial, funnel, topProjects }: Props) {
  const hasFin      = financial != null;
  const hasFunnel   = funnel != null && funnel.leads > 0;
  const hasProjects = (topProjects?.length ?? 0) > 0;
  const hasAnalysis = hasFin || hasFunnel;

  // Derived financial
  const collectionRate = hasFin && financial.totalContractValue > 0
    ? Math.round((financial.totalCollectedVerified / financial.totalContractValue) * 100)
    : null;

  // Active units total
  const activeUnits = kpis.availableUnits + kpis.reservedUnits + kpis.soldUnits;

  // Project highlights
  const sortedByValue = topProjects ? [...topProjects].sort((a, b) => b.contractValue - a.contractValue) : [];
  const bestSales = sortedByValue[0] ?? null;

  const bestConversion = topProjects
    ? [...topProjects]
        .filter((p) => p.totalUnits > 0 && p.id !== bestSales?.id)
        .sort((a, b) => (b.soldUnits / b.totalUnits) - (a.soldUnits / a.totalUnits))[0] ?? null
    : null;

  const usedIds = new Set<string | undefined>([bestSales?.id, bestConversion?.id]);
  const needsAttention = topProjects
    ? (topProjects.find((p) => !usedIds.has(p.id) && p.reservedUnits > 0)
        ?? topProjects.find((p) => !usedIds.has(p.id))
        ?? null)
    : null;

  return (
    <div className="bg-surface border border-hairline rounded-3xl overflow-hidden shadow-soft">

      {/* ── 1. Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-hairline bg-canvas/40">
        {/* Title + subtitle */}
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 mt-0.5">
            <BarChart2 className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-slate-900 leading-none">
              المؤشرات التنفيذية
            </h2>
            <p className="text-[13px] text-slate-400 mt-1.5 leading-none">
              ملخص أداء التعاقدات والتحصيل والمبيعات
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="h-9 px-3.5 rounded-xl border border-hairline bg-canvas text-[13px] text-navy font-medium inline-flex items-center gap-1.5 hover:border-brand-200 transition-colors duration-150"
          >
            هذا الشهر
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
          <button
            type="button"
            className="h-9 px-3.5 rounded-xl border border-hairline bg-canvas text-[13px] text-navy font-medium inline-flex items-center gap-1.5 hover:border-brand-200 transition-colors duration-150"
          >
            كل المشاريع
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-success-50 border border-success-100 text-success-700 text-[10px] font-semibold shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse shrink-0" />
            بيانات حية
          </span>
        </div>
      </div>

      {/* ── 2. KPI Cards ──────────────────────────────────────────────────────── */}
      <div className={cn(
        'grid grid-cols-2 lg:grid-cols-4 gap-4 p-6',
        (hasAnalysis || hasProjects) && 'border-b border-hairline',
      )}>

        {/* Card 1 — إجمالي التعاقدات */}
        <div className="bg-surface border border-hairline rounded-[18px] p-[18px] flex flex-col gap-2 hover:border-brand-200 transition-colors duration-150">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-[13px] font-medium text-slate-400 leading-none">إجمالي التعاقدات</p>
          </div>
          <p className="text-[28px] font-black text-slate-900 tabular-nums leading-none tracking-tight mt-1">
            {hasFin ? formatCompact(financial.totalContractValue) : '—'}
          </p>
          {collectionRate !== null && (
            <p className="text-[12px] text-slate-400 leading-none">
              <span className="text-brand-600 font-semibold">{collectionRate}%</span>
              {' '}محصّل من الإجمالي
            </p>
          )}
        </div>

        {/* Card 2 — إجمالي التحصيل */}
        <div className="bg-surface border border-hairline rounded-[18px] p-[18px] flex flex-col gap-2 hover:border-brand-200 transition-colors duration-150">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-[13px] font-medium text-slate-400 leading-none">إجمالي التحصيل</p>
          </div>
          <p className="text-[28px] font-black text-slate-900 tabular-nums leading-none tracking-tight mt-1">
            {hasFin ? formatCompact(financial.totalCollectedVerified) : '—'}
          </p>
          {collectionRate !== null && (
            <p className="text-[12px] text-slate-400 leading-none">
              <span className="text-success-600 font-semibold">{collectionRate}%</span>
              {' '}من قيمة التعاقدات
            </p>
          )}
        </div>

        {/* Card 3 — المبالغ المتأخرة */}
        <div className="bg-surface border border-hairline rounded-[18px] p-[18px] flex flex-col gap-2 hover:border-brand-200 transition-colors duration-150">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-surface-muted flex items-center justify-center shrink-0">
              <AlertTriangle className={cn(
                'h-4 w-4',
                hasFin && financial.overdueTotal > 0 ? 'text-danger-600' : 'text-slate-400',
              )} />
            </div>
            <p className="text-[13px] font-medium text-slate-400 leading-none">المبالغ المتأخرة</p>
          </div>
          <p className={cn(
            'text-[28px] font-black tabular-nums leading-none tracking-tight mt-1',
            hasFin && financial.overdueTotal > 0 ? 'text-danger-700' : 'text-slate-900',
          )}>
            {hasFin ? formatCompact(financial.overdueTotal) : '—'}
          </p>
          {hasFin && (
            <p className={cn(
              'text-[12px] leading-none',
              financial.overdueTotal > 0 ? 'text-danger-600' : 'text-slate-400',
            )}>
              {financial.overdueTotal > 0 ? 'تجاوزت الاستحقاق' : 'لا توجد متأخرات'}
            </p>
          )}
        </div>

        {/* Card 4 — الوحدات النشطة */}
        <div className="bg-surface border border-hairline rounded-[18px] p-[18px] flex flex-col gap-2 hover:border-brand-200 transition-colors duration-150">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-[13px] font-medium text-slate-400 leading-none">الوحدات النشطة</p>
          </div>
          <p className="text-[28px] font-black text-slate-900 tabular-nums leading-none tracking-tight mt-1">
            {activeUnits}
            <span className="text-[16px] font-medium text-slate-400 ms-1">وحدة</span>
          </p>
          <p className="text-[12px] text-slate-400 leading-none">
            {kpis.availableUnits} متاح · {kpis.reservedUnits} محجوز · {kpis.soldUnits} مباع
          </p>
        </div>
      </div>

      {/* ── 3. Analysis Row ───────────────────────────────────────────────────── */}
      {hasAnalysis && (
        <div className={cn(
          'grid grid-cols-1 gap-4 p-6',
          hasFin && hasFunnel && 'lg:grid-cols-5',
          hasProjects && 'border-b border-hairline',
        )}>

          {/* Financial Health */}
          {hasFin && (
            <div className={cn(
              'border border-hairline rounded-[20px] p-[22px] flex flex-col gap-4 h-full',
              hasFunnel && 'lg:col-span-3',
            )}>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-none">الصحة المالية</h3>
                <p className="text-[12px] text-slate-400 mt-1">توزيع قيمة التعاقدات حسب حالة التحصيل</p>
              </div>
              <FinancialStackedBar financial={financial} />
            </div>
          )}

          {/* Sales Funnel */}
          {hasFunnel && (
            <div className={cn(
              'border border-hairline rounded-[20px] p-[22px] flex flex-col gap-4 h-full',
              hasFin && 'lg:col-span-2',
            )}>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-none">مسار التحويل البيعي</h3>
                <p className="text-[12px] text-slate-400 mt-1">من الفرصة حتى توقيع العقد</p>
              </div>
              <FunnelRows funnel={funnel} />
            </div>
          )}
        </div>
      )}

      {/* ── 4. Projects Row ───────────────────────────────────────────────────── */}
      {hasProjects && (
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-[14px] font-bold text-slate-900 leading-none">أداء المشاريع</h3>
            <p className="text-[12px] text-slate-400 mt-1">أعلى المشاريع تأثيرًا</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Best Sales */}
            {bestSales && (
              <div className="border border-hairline rounded-[16px] p-4 bg-canvas/60 flex flex-col gap-1.5 hover:border-brand-200 transition-colors duration-150">
                <p className="text-[11px] font-medium text-slate-400">أفضل مبيعات</p>
                <p className="text-[14px] font-bold text-slate-900 leading-snug">{bestSales.name}</p>
                <p className="text-[20px] font-black text-slate-900 tabular-nums leading-none mt-1">
                  {formatCompact(bestSales.contractValue)}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-50 border border-brand-100 text-[10px] text-brand-700 font-semibold">
                    {bestSales.soldUnits} وحدة مباعة
                  </span>
                </div>
              </div>
            )}

            {/* Best Conversion */}
            {bestConversion && (
              <div className="border border-hairline rounded-[16px] p-4 bg-canvas/60 flex flex-col gap-1.5 hover:border-brand-200 transition-colors duration-150">
                <p className="text-[11px] font-medium text-slate-400">أعلى تحويل</p>
                <p className="text-[14px] font-bold text-slate-900 leading-snug">{bestConversion.name}</p>
                <p className="text-[20px] font-black text-slate-900 tabular-nums leading-none mt-1">
                  {bestConversion.totalUnits > 0
                    ? `${Math.round((bestConversion.soldUnits / bestConversion.totalUnits) * 100)}%`
                    : '—'}
                </p>
                <p className="text-[11px] text-slate-400">نسبة مبيعات</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500 shrink-0" />
                  <span className="inline-flex items-center h-5 px-2 rounded-full bg-success-50 border border-success-100 text-[10px] text-success-700 font-semibold">
                    جيد
                  </span>
                </div>
              </div>
            )}

            {/* Needs Attention */}
            {needsAttention && (
              <div className="border border-hairline rounded-[16px] p-4 bg-canvas/60 flex flex-col gap-1.5 hover:border-brand-200 transition-colors duration-150">
                <p className="text-[11px] font-medium text-slate-400">يحتاج متابعة</p>
                <p className="text-[14px] font-bold text-slate-900 leading-snug">{needsAttention.name}</p>
                <p className="text-[20px] font-black text-slate-900 tabular-nums leading-none mt-1">
                  {needsAttention.reservedUnits}
                  <span className="text-[13px] font-medium text-slate-400 ms-1">محجوز</span>
                </p>
                <p className="text-[11px] text-slate-400">يحتاج تحويل إلى عقد</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger-600 shrink-0" />
                  <span className="inline-flex items-center h-5 px-2 rounded-full bg-danger-50 border border-danger-100 text-[10px] text-danger-700 font-semibold">
                    يحتاج متابعة
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
