import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  FileText,
  Settings2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { PremiumPageHero, PremiumMetricStrip, PremiumSectionCard, PremiumFilterBar, PremiumFilterField, PremiumEmptyState } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Search {
  period?: string;
  salesId?: string;
}

interface PerformanceRow {
  salesId: string;
  salesName: string;
  period: string;
  leadsCount: number;
  openLeadsCount: number;
  visitsCount: number;
  upcomingVisitsCount: number;
  reservationsCount: number;
  activeReservationsCount: number;
  convertedReservationsCount: number;
  signedContractsCount: number;
  realizedValue: number;
  targetAmount: number | null;
  targetUnits: number | null;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
  targetUnitsPercent: number | null;
}

interface BonusEntry {
  id: string;
  salesId: string;
  amount: string;
  period: string;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  source: 'MANUAL' | 'CONTRACT_AUTO';
  basisAmount?: string | null;
  commissionPct?: string | null;
  sales?: { id: string; fullName: string } | null;
  rule?: { id: string; name: string } | null;
}

interface SalesActor {
  id: string;
  fullName: string;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

const AR_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${AR_MONTHS[parseInt(m ?? '1', 10) - 1] ?? m} ${y}`;
}

interface Theme { bar: string; text: string; accent: string; badge: string; label: string }

function theme(pct: number | null): Theme {
  if (pct === null) return { bar: 'bg-slate-200', text: 'text-slate-400', accent: '#94a3b8', badge: 'bg-slate-100 text-slate-500', label: 'لا هدف' };
  if (pct >= 100)   return { bar: 'bg-emerald-400', text: 'text-emerald-700', accent: '#34d399', badge: 'bg-emerald-100 text-emerald-700', label: 'ممتاز' };
  if (pct >= 80)    return { bar: 'bg-emerald-400', text: 'text-emerald-600', accent: '#34d399', badge: 'bg-emerald-50 text-emerald-600', label: 'جيد' };
  if (pct >= 50)    return { bar: 'bg-amber-400',   text: 'text-amber-700',   accent: '#fbbf24', badge: 'bg-amber-100 text-amber-700',   label: 'متوسط' };
  return                  { bar: 'bg-red-400',     text: 'text-red-600',     accent: '#f87171', badge: 'bg-red-100 text-red-600',     label: 'ضعيف' };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp     = await searchParams;
  const period = sp.period ?? currentPeriod();

  const perfQs  = new URLSearchParams({ period });
  const bonusQs = new URLSearchParams({ period });
  if (sp.salesId) { perfQs.set('salesId', sp.salesId); bonusQs.set('salesId', sp.salesId); }

  const [perfRes, bonusRes, actorsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?${perfQs}`)),
    safe(api.get<BonusEntry[]>(`/bonus-entries?${bonusQs}`)),
    safe(api.get<SalesActor[]>('/sales-targets/actors')),
  ]);

  const rows   = perfRes.data   ?? [];
  const bonus  = bonusRes.data  ?? [];
  const actors = actorsRes.data ?? [];

  // ── Derived ───────────────────────────────────────────────────────────────
  const rowsWithTarget = rows.filter((r) => r.targetAmount !== null);
  const totalAchieved  = rows.reduce((s, r) => s + r.achievedAmount, 0);
  const totalTarget    = rows.reduce((s, r) => s + (r.targetAmount ?? 0), 0);
  const totalContracts = rows.reduce((s, r) => s + r.signedContractsCount, 0);
  const totalLeads     = rows.reduce((s, r) => s + r.leadsCount, 0);
  const totalVisits    = rows.reduce((s, r) => s + r.visitsCount, 0);
  const totalRes       = rows.reduce((s, r) => s + r.reservationsCount, 0);
  const totalOpenLeads = rows.reduce((s, r) => s + r.openLeadsCount, 0);
  const totalUpcoming  = rows.reduce((s, r) => s + r.upcomingVisitsCount, 0);
  const totalActiveRes = rows.reduce((s, r) => s + r.activeReservationsCount, 0);
  const totalConvRes   = rows.reduce((s, r) => s + r.convertedReservationsCount, 0);
  const totalBonusAmt  = bonus.reduce((s, b) => s + Number(b.amount), 0);

  const avgAttainment = rowsWithTarget.length > 0
    ? rowsWithTarget.reduce((s, r) => s + (r.targetAmountPercent ?? 0), 0) / rowsWithTarget.length
    : null;

  // Pipeline flow — monotonically non-increasing widths (% of first stage)
  const pipelineFlow = (() => {
    const stages = [
      { label: 'فرص مفتوحة',    value: totalOpenLeads,  bar: 'bg-sky-400',     text: 'text-sky-700',     dot: 'bg-sky-400' },
      { label: 'زيارات قادمة',  value: totalUpcoming,   bar: 'bg-violet-400',  text: 'text-violet-700',  dot: 'bg-violet-400' },
      { label: 'حجوزات نشطة',   value: totalActiveRes,  bar: 'bg-amber-400',   text: 'text-amber-700',   dot: 'bg-amber-400' },
      { label: 'حجوزات محوّلة', value: totalConvRes,    bar: 'bg-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    ];
    const first = stages[0]?.value ?? 1;
    let prevW = 100;
    return stages.map((s, i) => {
      const nat    = first > 0 ? (s.value / first) * 100 : 0;
      const capped = Math.min(nat, prevW);
      prevW = capped;
      const w    = Math.max(capped, s.value > 0 ? 5 : 0);
      const prev = stages[i - 1]?.value ?? 0;
      const conv = i > 0 && prev > 0 ? s.value / prev : null;
      return { ...s, pct: w, conv };
    });
  })();
  const pipelineOverallConv = totalOpenLeads > 0 ? totalConvRes / totalOpenLeads : null;

  const sorted = [...rows].sort((a, b) => {
    const aHas = a.targetAmount !== null, bHas = b.targetAmount !== null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas) return (b.targetAmountPercent ?? 0) - (a.targetAmountPercent ?? 0);
    return b.achievedAmount - a.achievedAmount;
  });

  const teamTheme = theme(avgAttainment);
  const hasFilter = !!(sp.period || sp.salesId);

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="أداء فريق المبيعات"
        description={`مقارنة الإنجاز بالأهداف — ${periodLabel(period)}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المبيعات' },
          { label: 'الأداء والإنجاز' },
        ]}
        actions={
          <Link href="/dashboard/targets">
            <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-bold text-amber-700 shadow-xs hover:bg-amber-100 transition-colors cursor-pointer select-none">
              <Settings2 className="h-3.5 w-3.5" />
              إدارة الأهداف
            </span>
          </Link>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/sales/performance"
        trailing={
          <>
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilter && (
              <Link href="/dashboard/sales/performance">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </>
        }
      >
        <PremiumFilterField label="الفترة" htmlFor="period">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <Input id="period" name="period" inputSize="sm" type="month" defaultValue={period} className="w-40" />
          </div>
        </PremiumFilterField>
        <PremiumFilterField label="المندوب" htmlFor="salesId">
          <Select id="salesId" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-52">
            <option value="">كل المندوبين</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>{a.fullName}</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* ═══════════════════════════════════════════════════════════════════
          KPI STRIP — matches أهداف وأداء المبيعات tile pattern
      ════════════════════════════════════════════════════════════════════ */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label:     'متوسط إنجاز الفريق',
            value:     avgAttainment !== null ? `${avgAttainment.toFixed(1)}%` : '—',
            icon:      <TrendingUp />,
            tone:      avgAttainment === null ? 'neutral'
                     : avgAttainment >= 80    ? 'success'
                     : avgAttainment >= 50    ? 'warning'
                     : 'danger',
            sub:       rowsWithTarget.length > 0
                         ? `${teamTheme.label} · ${rowsWithTarget.length}/${rows.length} هدف`
                         : 'لا توجد أهداف محددة',
            primary: true,
          },
          {
            label:     'إجمالي المبيعات',
            value:     formatCurrency(totalAchieved),
            icon:      <Wallet />,
            tone:      'success',
            sub:       `${rows.length} مندوب نشط هذه الفترة`,
            valueSize: 'compact',
          },
          {
            label: 'عقود موقّعة',
            value: String(totalContracts),
            icon:  <FileText />,
            tone:  'purple',
            sub:   `${totalLeads} فرصة في الأنبوب`,
          },
          {
            label:     'مكافآت الفترة',
            value:     formatCurrency(totalBonusAmt),
            icon:      <BadgePercent />,
            tone:      'brand',
            sub:       `${bonus.length} إدخال مكافأة`,
            valueSize: 'compact',
          },
        ]}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          PERFORMANCE TABLE — enterprise-grade data table
      ════════════════════════════════════════════════════════════════════ */}
      {rows.length === 0 ? (
        <PremiumEmptyState
          icon={<Users />}
          title="لا توجد بيانات لهذه الفترة"
          description="تأكد من وجود مندوبين لديهم نشاط أو أهداف في هذه الفترة."
        />
      ) : (
        <PremiumSectionCard
          icon={<BarChart3 />}
          title="تفاصيل أداء الفريق"
          description={`${rows.length} مندوب · ${periodLabel(period)}`}
          trailing={
            <div className="hidden lg:flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-300 inline-block" />فرص</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-300 inline-block" />زيارات</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-300 inline-block" />حجوزات</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-300 inline-block" />عقود</span>
            </div>
          }
          padded={false}
        >
          {/* Column headers */}
          <div className="hidden lg:grid grid-cols-[48px_1fr_130px_190px_56px_56px_56px_56px] items-center gap-2 px-5 py-3 bg-canvas/50 border-b border-hairline">
            <div />
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">المندوب</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 text-center">الإنجاز</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">المحقق / الهدف</p>
            <div className="flex flex-col items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="text-[9.5px] font-bold text-sky-600">فرص</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="text-[9.5px] font-bold text-violet-600">زيارات</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-[9.5px] font-bold text-amber-600">حجوزات</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[9.5px] font-bold text-emerald-600">عقود</span>
            </div>
          </div>

          {/* Data rows */}
          <div className="divide-y divide-hairline">
            {sorted.map((row, idx) => {
              const pct = row.targetAmountPercent;
              const t   = theme(pct);
              const barW = Math.min(pct ?? 0, 100);

              return (
                <div
                  key={row.salesId}
                  className={cn(
                    'group grid grid-cols-1 lg:grid-cols-[48px_1fr_130px_190px_56px_56px_56px_56px] items-center gap-2 px-5 py-4 hover:bg-canvas/40 transition-colors duration-100',
                    idx === 0 && pct !== null && pct >= 80 && 'bg-emerald-50/20',
                  )}
                >
                  {/* Rank */}
                  <div className="hidden lg:flex items-center justify-center">
                    <RankChip rank={idx + 1} />
                  </div>

                  {/* Name + mobile rank */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="lg:hidden shrink-0"><RankChip rank={idx + 1} /></div>
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-bold border"
                      style={{ backgroundColor: `${t.accent}18`, borderColor: `${t.accent}40`, color: t.accent }}
                    >
                      {row.salesName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">{row.salesName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md lg:hidden', t.badge)}>
                          {pct !== null ? `${pct.toFixed(0)}%` : t.label}
                        </span>
                        <p className="text-[10px] text-slate-400">{row.achievedUnits} وحدة</p>
                      </div>
                    </div>
                  </div>

                  {/* Attainment — desktop */}
                  <div className="hidden lg:flex flex-col items-center gap-1.5">
                    <span className={cn('text-[20px] font-black tabular-nums leading-none', t.text)}>
                      {pct !== null ? `${Math.round(pct)}%` : '—'}
                    </span>
                    {pct !== null ? (
                      <div className="w-[72px] h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={cn('h-full rounded-full', t.bar)} style={{ width: `${barW}%` }} />
                      </div>
                    ) : (
                      <div className="w-[72px] h-2 rounded-full bg-slate-100" />
                    )}
                    <span className={cn('text-[9.5px] font-bold px-2 py-0.5 rounded-full border', t.badge)}>{t.label}</span>
                  </div>

                  {/* Amount vs target — desktop */}
                  <div className="hidden lg:block min-w-0 space-y-1">
                    {/* Achieved / target on one line */}
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-[13px] font-black tabular-nums text-slate-900">
                        {row.achievedAmount > 0 ? formatCurrency(row.achievedAmount) : '—'}
                      </span>
                      {row.targetAmount !== null ? (
                        <span className="text-[12px] font-medium tabular-nums text-slate-400">
                          / {formatCurrency(row.targetAmount)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">بدون هدف</span>
                      )}
                    </div>
                    {/* Units */}
                    {row.targetUnits !== null && (
                      <p className="text-[13px] font-semibold tabular-nums text-slate-500">
                        {row.achievedUnits} / {row.targetUnits} وحدة
                      </p>
                    )}
                  </div>

                  {/* Pipeline counters — desktop */}
                  <CountCell value={row.leadsCount}            color="text-sky-600"     />
                  <CountCell value={row.visitsCount}           color="text-violet-600"  />
                  <CountCell value={row.reservationsCount}     color="text-amber-600"   />
                  <CountCell value={row.signedContractsCount}  color="text-emerald-600" />

                  {/* Mobile: amount + pipeline */}
                  <div className="lg:hidden flex items-center justify-between gap-3 pt-2 mt-2 border-t border-hairline/60">
                    <p className="text-[13px] font-black tabular-nums text-slate-900">
                      {row.achievedAmount > 0 ? formatCurrency(row.achievedAmount) : '—'}
                      {row.targetAmount !== null && (
                        <span className="text-[10px] text-slate-400 font-normal"> / {formatCurrency(row.targetAmount)}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3">
                      <MobilePill label="ف" value={row.leadsCount}           color="text-sky-600" />
                      <MobilePill label="ز" value={row.visitsCount}          color="text-violet-600" />
                      <MobilePill label="ح" value={row.reservationsCount}    color="text-amber-600" />
                      <MobilePill label="ع" value={row.signedContractsCount} color="text-emerald-600" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-1 lg:grid-cols-[48px_1fr_130px_190px_56px_56px_56px_56px] items-center gap-2 px-5 py-4 bg-canvas/50 border-t-2 border-hairline/60">
            <div className="hidden lg:block" />
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.06em]">الإجمالي</p>
            <div className="hidden lg:flex justify-center">
              <span className={cn('text-[14px] font-black tabular-nums', teamTheme.text)}>
                {avgAttainment !== null ? `${avgAttainment.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="hidden lg:block">
              <span className="text-[13px] font-bold tabular-nums text-slate-800">
                {totalAchieved > 0 ? formatCurrency(totalAchieved) : '—'}
              </span>
            </div>
            <CountCell value={totalLeads}     color="text-sky-600"     bold />
            <CountCell value={totalVisits}    color="text-violet-600"  bold />
            <CountCell value={totalRes}       color="text-amber-600"   bold />
            <CountCell value={totalContracts} color="text-emerald-600" bold />
          </div>
        </PremiumSectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM ROW — Pipeline + Bonus
      ════════════════════════════════════════════════════════════════════ */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Pipeline summary */}
          <PremiumSectionCard
            className="lg:col-span-2"
            icon={<TrendingUp />}
            title="ملخص الأنبوب"
            description="مجموع نشاط الفريق"
            padded={false}
          >
            <div className="px-5 py-5 space-y-0">
              {pipelineFlow.map((stage, i) => (
                <div key={stage.label}>

                  {/* Conversion connector between stages */}
                  {i > 0 && (
                    <div className="flex items-center gap-3 py-2 ps-1">
                      <div className="flex flex-col items-center self-stretch">
                        <div className="w-px flex-1 bg-slate-200" />
                      </div>
                      {stage.conv !== null && (
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                          stage.conv > 1   ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-200' :
                          stage.conv >= 0.4 ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200' :
                                             'text-slate-500 bg-slate-100',
                        )}>
                          {stage.conv > 1 ? '↑' : '↓'} {(stage.conv * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stage row */}
                  <div className="flex items-center gap-3">
                    {/* Dot */}
                    <div className={cn('h-3 w-3 rounded-full shrink-0', stage.dot)} />

                    {/* Label */}
                    <span className="text-[12px] font-semibold text-slate-700 w-28 shrink-0">{stage.label}</span>

                    {/* Proportional bar */}
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', stage.bar)}
                        style={{ width: `${stage.pct}%` }}
                      />
                    </div>

                    {/* Count */}
                    <span className={cn('text-[18px] font-black tabular-nums leading-none w-8 text-end shrink-0', stage.text)}>
                      {stage.value.toLocaleString('ar-EG')}
                    </span>
                  </div>

                </div>
              ))}

              {/* Overall conversion footer */}
              {pipelineOverallConv !== null && (
                <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">معدل التحويل الإجمالي</span>
                  <span className="text-[12px] font-black tabular-nums text-slate-700 bg-canvas border border-hairline px-2.5 py-1 rounded-full">
                    {(pipelineOverallConv * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </PremiumSectionCard>

          {/* Bonus entries */}
          <PremiumSectionCard
            className="lg:col-span-3"
            icon={<BadgePercent />}
            title="المكافآت والعمولات"
            description={periodLabel(period)}
            trailing={
              <Link href="/dashboard/bonus">
                <Button variant="ghost" size="sm">عرض الكل</Button>
              </Link>
            }
            padded={false}
          >
            {bonus.length === 0 ? (
              <PremiumEmptyState
                icon={<BadgePercent />}
                title="لا توجد مكافآت"
                description="لم يتم إنشاء أي مكافآت أو عمولات في هذه الفترة"
              />
            ) : (
              <>
                <div className="divide-y divide-hairline">
                  {bonus.map((entry) => {
                    const S = {
                      PENDING:  { label: 'قيد الانتظار', cls: 'bg-slate-100 text-slate-600' },
                      APPROVED: { label: 'معتمد',         cls: 'bg-amber-100 text-amber-700' },
                      PAID:     { label: 'مدفوع',          cls: 'bg-emerald-100 text-emerald-700' },
                    } as const;
                    const s = S[entry.status] ?? S.PENDING;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors duration-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{entry.sales?.fullName ?? '—'}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {entry.rule?.name ?? (entry.source === 'CONTRACT_AUTO' ? 'عمولة عقد تلقائية' : 'يدوي')}
                            {entry.commissionPct ? ` · ${entry.commissionPct}%` : ''}
                            {entry.basisAmount ? ` على ${formatCurrency(Number(entry.basisAmount))}` : ''}
                          </p>
                        </div>
                        <span className={cn('text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0', s.cls)}>
                          {s.label}
                        </span>
                        <p dir="ltr" className="text-[13px] font-black tabular-nums text-slate-900 shrink-0 whitespace-nowrap">
                          {formatCurrency(Number(entry.amount))}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-5 py-3 bg-canvas/30 border-t border-hairline">
                  <div className="flex items-center gap-3">
                    {(['PENDING', 'APPROVED', 'PAID'] as const).map((st) => {
                      const count = bonus.filter((b) => b.status === st).length;
                      if (!count) return null;
                      const L = { PENDING: 'انتظار', APPROVED: 'معتمد', PAID: 'مدفوع' };
                      const cls = { PENDING: 'bg-slate-100 text-slate-600', APPROVED: 'bg-amber-50 text-amber-700', PAID: 'bg-emerald-50 text-emerald-700' };
                      return (
                        <span key={st} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cls[st])}>
                          {count} {L[st]}
                        </span>
                      );
                    })}
                  </div>
                  <p dir="ltr" className="text-[14px] font-black tabular-nums text-slate-900">
                    {formatCurrency(totalBonusAmt)}
                  </p>
                </div>
              </>
            )}
          </PremiumSectionCard>

        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RankChip({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const medal = medals[rank];
  return (
    <div className={cn(
      'h-7 w-7 rounded-full flex items-center justify-center text-center',
      rank === 1 ? 'bg-amber-100' : rank <= 3 ? 'bg-slate-100' : 'bg-transparent',
    )}>
      {medal
        ? <span className="text-base leading-none">{medal}</span>
        : <span className="text-[11px] font-black text-slate-400">{rank}</span>
      }
    </div>
  );
}

function CountCell({ value, color, bold }: { value: number; color: string; bold?: boolean }) {
  return (
    <div className="hidden lg:flex items-center justify-center">
      <span className={cn('tabular-nums', bold ? 'text-[12px] font-black' : 'text-[14px] font-bold', color)}>
        {value}
      </span>
    </div>
  );
}

function MobilePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <span className={cn('text-[11px] font-black tabular-nums', color)}>{value}</span>
      <span className="text-[9px] text-slate-400">{label}</span>
    </div>
  );
}
