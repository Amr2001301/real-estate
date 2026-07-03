import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';

// ── Interfaces ────────────────────────────────────────────────────────────────

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
  financial?:      Financial;
  funnel?:         Funnel;
  topProjects?:    TopProject[];
  currencySymbol?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function convPct(num: number, denom: number): string | null {
  if (denom <= 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

// ── FinancialStackedBar ───────────────────────────────────────────────────────

function FinancialStackedBar({ financial, currencySymbol = 'ر.س' }: { financial: Financial; currencySymbol?: string }) {
  const total       = financial.totalContractValue;
  const collected   = financial.totalCollectedVerified;
  const overdue     = financial.overdueTotal;
  const pending     = Math.max(0, total - collected - overdue);
  const liabilities = financial.pendingBonus + financial.pendingBrokerPayouts;

  const collectedPct = total > 0 ? (collected / total) * 100 : 0;
  const overduePct   = total > 0 ? (overdue   / total) * 100 : 0;
  const pendingPct   = Math.max(0, 100 - collectedPct - overduePct);
  const collectionRate = total > 0 ? Math.round(collectedPct) : null;

  const chips = [
    {
      label:    'محصّل',
      value:    formatCompact(collected, currencySymbol),
      pct:      Math.round(collectedPct),
      dotCls:   'bg-navy',
      pctCls:   'text-navy',
      valueCls: 'text-slate-900',
    },
    {
      label:    'مستحق',
      value:    formatCompact(pending, currencySymbol),
      pct:      Math.round(pendingPct),
      dotCls:   'bg-brand-400',
      pctCls:   'text-brand-600',
      valueCls: 'text-slate-900',
    },
    {
      label:    'متأخر',
      value:    formatCompact(overdue, currencySymbol),
      pct:      Math.round(overduePct),
      dotCls:   overdue > 0 ? 'bg-danger-700' : 'bg-slate-200',
      pctCls:   overdue > 0 ? 'text-danger-700' : 'text-slate-300',
      valueCls: overdue > 0 ? 'text-danger-700' : 'text-slate-300',
    },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1">

      {/* Hero metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-canvas/70 border border-hairline rounded-[14px] p-3.5">
          <p className="text-[11px] text-slate-400 mb-2">إجمالي التعاقدات</p>
          <p className="text-[22px] font-black text-slate-900 tabular-nums leading-none tracking-tight">
            {formatCompact(total, currencySymbol)}
          </p>
        </div>
        <div className="bg-canvas/70 border border-hairline rounded-[14px] p-3.5">
          <p className="text-[11px] text-slate-400 mb-2">معدل التحصيل</p>
          <p className={cn(
            'text-[22px] font-black tabular-nums leading-none tracking-tight',
            collectionRate === null       ? 'text-slate-400'   :
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
          <div className="bg-navy shrink-0 transition-all duration-700" style={{ width: `${collectedPct}%` }} />
        )}
        {pendingPct > 0 && (
          <div className="bg-brand-400 shrink-0 transition-all duration-700" style={{ width: `${pendingPct}%` }} />
        )}
        {overduePct > 0 && (
          <div className="bg-danger-700 shrink-0 transition-all duration-700 opacity-75" style={{ width: `${overduePct}%` }} />
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

      {/* Liabilities footer */}
      {liabilities > 0 && (
        <div className="mt-auto pt-3.5 border-t border-hairline flex items-center justify-between gap-2">
          <p className="text-[12px] text-slate-400">التزامات معلقة</p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="text-[13px] font-bold text-amber-700 tabular-nums">
              {formatCompact(liabilities, currencySymbol)}
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

  const visitsRate   = convPct(funnel.visits,        funnel.leads);
  const resRate      = convPct(funnel.reservations,   funnel.visits);
  const contractRate = convPct(funnel.contracts,      funnel.reservations);

  const stages = [
    {
      label:    'فرص البيع',
      value:    funnel.leads,
      pct:      100,
      badge:    'البداية',
      badgeCls: 'bg-brand-50 border-brand-100 text-brand-700',
    },
    {
      label:    'الزيارات',
      value:    funnel.visits,
      pct:      Math.round((funnel.visits        / maxVal) * 100),
      badge:    visitsRate   ? `${visitsRate} تحويل`   : null,
      badgeCls: 'bg-surface-muted border-hairline text-slate-500',
    },
    {
      label:    'الحجوزات',
      value:    funnel.reservations,
      pct:      Math.round((funnel.reservations   / maxVal) * 100),
      badge:    resRate      ? `${resRate} تحويل`      : null,
      badgeCls: 'bg-surface-muted border-hairline text-slate-500',
    },
    {
      label:    'عقود موقعة',
      value:    funnel.contracts,
      pct:      Math.round((funnel.contracts      / maxVal) * 100),
      badge:    contractRate ? `${contractRate} تحويل` : null,
      badgeCls: 'bg-surface-muted border-hairline text-slate-500',
    },
  ];

  return (
    <div className="space-y-4 flex-1">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[13px] font-semibold text-slate-700 leading-none">{stage.label}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[16px] font-bold text-slate-900 tabular-nums leading-none">
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

// ── Standalone card exports ───────────────────────────────────────────────────

export function FinancialHealthCard({ financial, currencySymbol = 'ر.س' }: { financial: Financial; currencySymbol?: string }) {
  return (
    <div className="bg-surface border border-hairline rounded-[20px] p-[22px] flex flex-col gap-4 h-full shadow-soft">
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 leading-none">الصحة المالية</h3>
        <p className="text-[12px] text-slate-400 mt-1">توزيع قيمة التعاقدات حسب حالة التحصيل</p>
      </div>
      <FinancialStackedBar financial={financial} currencySymbol={currencySymbol} />
    </div>
  );
}

export function SalesFunnelCard({ funnel }: { funnel: Funnel }) {
  if (funnel.leads === 0) return null;
  return (
    <div className="bg-surface border border-hairline rounded-[20px] p-[22px] flex flex-col gap-4 h-full shadow-soft">
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 leading-none">مسار التحويل البيعي</h3>
        <p className="text-[12px] text-slate-400 mt-1">من الفرصة حتى توقيع العقد</p>
      </div>
      <FunnelRows funnel={funnel} />
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function PlatformSummaryCard({ financial, funnel, topProjects, currencySymbol = 'ر.س' }: Props) {
  const hasFin      = financial != null;
  const hasFunnel   = funnel != null && funnel.leads > 0;
  const hasProjects = (topProjects?.length ?? 0) > 0;
  const hasAnalysis = hasFin || hasFunnel;

  // Project highlights
  const sortedByValue   = topProjects ? [...topProjects].sort((a, b) => b.contractValue - a.contractValue) : [];
  const bestSales       = sortedByValue[0] ?? null;
  const bestConversion  = topProjects
    ? [...topProjects]
        .filter((p) => p.totalUnits > 0 && p.id !== bestSales?.id)
        .sort((a, b) => (b.soldUnits / b.totalUnits) - (a.soldUnits / a.totalUnits))[0] ?? null
    : null;
  const usedIds         = new Set<string | undefined>([bestSales?.id, bestConversion?.id]);
  const needsAttention  = topProjects
    ? (topProjects.find((p) => !usedIds.has(p.id) && p.reservedUnits > 0)
        ?? topProjects.find((p) => !usedIds.has(p.id))
        ?? null)
    : null;

  if (!hasAnalysis && !hasProjects) return null;

  return (
    <div className="bg-surface border border-hairline rounded-3xl overflow-hidden shadow-soft">

      {/* Decorative gold accent stripe */}
      <div className="h-[2px] bg-gradient-to-l from-transparent via-brand-400/60 to-transparent" />

      {/* ── Analysis Row: Financial Health + Sales Funnel ─────────────────────── */}
      {hasAnalysis && (
        <div className={cn(
          'grid grid-cols-1',
          hasFin && hasFunnel && 'lg:grid-cols-5',
          hasProjects && 'border-b border-hairline',
        )}>

          {/* Financial Health */}
          {hasFin && (
            <div className={cn(
              'p-6 flex flex-col gap-4',
              hasFunnel && 'lg:col-span-3 border-b lg:border-b-0 lg:border-e border-hairline',
            )}>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-none">الصحة المالية</h3>
                <p className="text-[12px] text-slate-400 mt-1">توزيع قيمة التعاقدات حسب حالة التحصيل</p>
              </div>
              <FinancialStackedBar financial={financial} currencySymbol={currencySymbol} />
            </div>
          )}

          {/* Sales Funnel */}
          {hasFunnel && (
            <div className={cn(
              'p-6 flex flex-col gap-4',
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

      {/* ── Projects Row ──────────────────────────────────────────────────────── */}
      {hasProjects && (
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-[14px] font-bold text-slate-900 leading-none">تحليل المشاريع</h3>
            <p className="text-[12px] text-slate-400 mt-1">أعلى المشاريع تأثيرًا</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {bestSales && (
              <div className="border border-hairline rounded-[16px] p-4 bg-canvas/60 flex flex-col gap-1.5 hover:border-brand-200 transition-colors duration-150">
                <p className="text-[11px] font-medium text-slate-400">أفضل مبيعات</p>
                <p className="text-[14px] font-bold text-slate-900 leading-snug">{bestSales.name}</p>
                <p className="text-[20px] font-black text-slate-900 tabular-nums leading-none mt-1">
                  {formatCompact(bestSales.contractValue, currencySymbol)}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-50 border border-brand-100 text-[10px] text-brand-700 font-semibold">
                    {bestSales.soldUnits} وحدة مباعة
                  </span>
                </div>
              </div>
            )}

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
