import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BadgePercent,
  BarChart3,
  BookmarkCheck,
  CalendarDays,
  FileText,
  Settings2,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
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

  const sorted = [...rows].sort((a, b) => {
    const aHas = a.targetAmount !== null, bHas = b.targetAmount !== null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas) return (b.targetAmountPercent ?? 0) - (a.targetAmountPercent ?? 0);
    return b.achievedAmount - a.achievedAmount;
  });

  const teamTheme  = theme(avgAttainment);
  const gaugeR     = 44;
  const gaugeCirc  = 2 * Math.PI * gaugeR;
  const gaugeFill  = gaugeCirc * (1 - Math.min(avgAttainment ?? 0, 100) / 100);
  const hasFilter  = !!(sp.period || sp.salesId);

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        className="mb-0"
        title="أداء فريق المبيعات"
        description={`مقارنة الإنجاز بالأهداف — ${periodLabel(period)}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المبيعات' },
          { label: 'الأداء والإنجاز' },
        ]}
        actions={
          <Link href="/dashboard/targets">
            <Button variant="ghost" size="sm">
              <Settings2 className="h-3.5 w-3.5 me-1.5" />
              إدارة الأهداف
            </Button>
          </Link>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <form
        method="get"
        action="/dashboard/sales/performance"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 shadow-xs"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <Input name="period" inputSize="sm" type="month" defaultValue={period} className="w-40" />
        </div>
        <Select name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-52 shrink-0">
          <option value="">كل المندوبين</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>{a.fullName}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {hasFilter && (
            <Link href="/dashboard/sales/performance">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Team attainment gauge + 4 KPIs
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
        {/* Top accent stripe */}
        <div className={cn('h-[3px]', teamTheme.bar)} />

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr] divide-y lg:divide-y-0 divide-x-0 lg:divide-x lg:divide-x-reverse divide-hairline">

          {/* Gauge hero */}
          <div className="flex items-center gap-8 px-8 py-6">
            {/* SVG gauge */}
            <div className="relative shrink-0">
              <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
                <circle cx="56" cy="56" r={gaugeR} fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="56" cy="56" r={gaugeR} fill="none"
                  stroke={teamTheme.accent}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCirc}
                  strokeDashoffset={gaugeFill}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-[18px] font-black tabular-nums leading-none', teamTheme.text)}>
                  {avgAttainment !== null ? `${Math.round(avgAttainment)}%` : '—'}
                </span>
              </div>
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                متوسط إنجاز الفريق
              </p>
              <p className={cn('text-[44px] font-black tabular-nums leading-none tracking-tight', teamTheme.text)}>
                {avgAttainment !== null ? `${avgAttainment.toFixed(1)}%` : '—'}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {avgAttainment !== null && (
                  <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full', teamTheme.badge)}>
                    {teamTheme.label}
                  </span>
                )}
                <span className="text-[11px] text-slate-400">
                  {rowsWithTarget.length > 0
                    ? `${rowsWithTarget.length} من ${rows.length} لديهم هدف`
                    : 'لا توجد أهداف محددة'}
                </span>
              </div>
              {totalTarget > 0 && (
                <div className="mt-4 max-w-[200px]">
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', teamTheme.bar)}
                      style={{ width: `${Math.min((totalAchieved / totalTarget) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1" dir="ltr">
                    <span>{formatCurrency(totalAchieved)}</span>
                    <span>{formatCurrency(totalTarget)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* KPI: Total revenue */}
          <HeroKpi
            icon={<Wallet className="h-4 w-4" />}
            iconClass="bg-emerald-50 text-emerald-600"
            label="إجمالي المبيعات"
          >
            <span dir="ltr" className="text-[22px] font-black tabular-nums text-emerald-700 leading-tight whitespace-nowrap">
              {formatCurrency(totalAchieved)}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">{rows.length} مندوب نشط</p>
          </HeroKpi>

          {/* KPI: Contracts */}
          <HeroKpi
            icon={<FileText className="h-4 w-4" />}
            iconClass="bg-violet-50 text-violet-600"
            label="عقود موقّعة"
          >
            <span className="text-[40px] font-black tabular-nums text-slate-900 leading-tight">
              {totalContracts.toLocaleString('ar-EG')}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">{totalLeads} فرصة إجمالية</p>
          </HeroKpi>

          {/* KPI: Bonus */}
          <HeroKpi
            icon={<BadgePercent className="h-4 w-4" />}
            iconClass="bg-amber-50 text-amber-600"
            label="مكافآت الفترة"
          >
            <span dir="ltr" className="text-[22px] font-black tabular-nums text-amber-700 leading-tight whitespace-nowrap">
              {formatCurrency(totalBonusAmt)}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">{bonus.length} إدخال</p>
          </HeroKpi>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PERFORMANCE TABLE — enterprise-grade data table
      ════════════════════════════════════════════════════════════════════ */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="لا توجد بيانات لهذه الفترة"
          description="تأكد من وجود مندوبين لديهم نشاط أو أهداف في هذه الفترة."
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">

          {/* Card header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-4 [&_svg]:w-4">
                <BarChart3 />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">تفاصيل أداء الفريق</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{rows.length} مندوب · {periodLabel(period)}</p>
              </div>
            </div>
            {/* Column legend */}
            <div className="hidden lg:flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-300 inline-block" />فرص</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-300 inline-block" />زيارات</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-300 inline-block" />حجوزات</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-300 inline-block" />عقود</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="hidden lg:grid grid-cols-[56px_1fr_140px_200px_44px_44px_44px_44px] items-center gap-2 px-6 py-2.5 bg-slate-50/80 border-b border-hairline">
            <div />
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">المندوب</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide text-center">الإنجاز</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">المحقق / الهدف</p>
            <p className="text-[10px] font-semibold text-sky-500 text-center">ف</p>
            <p className="text-[10px] font-semibold text-violet-500 text-center">ز</p>
            <p className="text-[10px] font-semibold text-amber-500 text-center">ح</p>
            <p className="text-[10px] font-semibold text-emerald-500 text-center">ع</p>
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
                    'group grid grid-cols-1 lg:grid-cols-[56px_1fr_140px_200px_44px_44px_44px_44px] items-center gap-2 px-6 py-4 hover:bg-slate-50/60 transition-colors',
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
                    <span className={cn('text-[16px] font-black tabular-nums leading-none', t.text)}>
                      {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                    </span>
                    <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn('h-full rounded-full', t.bar)} style={{ width: `${barW}%` }} />
                    </div>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md', t.badge)}>{t.label}</span>
                  </div>

                  {/* Amount vs target — desktop */}
                  <div className="hidden lg:block">
                    <p dir="ltr" className="text-[13px] font-black tabular-nums text-slate-900 leading-tight">
                      {formatCurrency(row.achievedAmount)}
                    </p>
                    {row.targetAmount !== null ? (
                      <p dir="ltr" className="text-[10px] text-slate-400 mt-0.5">
                        / {formatCurrency(row.targetAmount)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5">بدون هدف</p>
                    )}
                    {row.targetUnits !== null && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {row.achievedUnits}/{row.targetUnits} وحدة
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
                    <p dir="ltr" className="text-[13px] font-black tabular-nums text-slate-900">
                      {formatCurrency(row.achievedAmount)}
                      {row.targetAmount !== null && (
                        <span dir="ltr" className="text-[10px] text-slate-400 font-normal"> / {formatCurrency(row.targetAmount)}</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-[56px_1fr_140px_200px_44px_44px_44px_44px] items-center gap-2 px-6 py-3.5 bg-slate-50 border-t border-hairline">
            <div className="hidden lg:block" />
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">الإجمالي</p>
            <div className="hidden lg:flex justify-center">
              <span className={cn('text-[13px] font-black tabular-nums', teamTheme.text)}>
                {avgAttainment !== null ? `${avgAttainment.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="hidden lg:block">
              <span dir="ltr" className="text-[13px] font-bold tabular-nums text-slate-800">
                {formatCurrency(totalAchieved)}
              </span>
            </div>
            <CountCell value={totalLeads}     color="text-sky-600"     bold />
            <CountCell value={totalVisits}    color="text-violet-600"  bold />
            <CountCell value={totalRes}       color="text-amber-600"   bold />
            <CountCell value={totalContracts} color="text-emerald-600" bold />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM ROW — Pipeline + Bonus
      ════════════════════════════════════════════════════════════════════ */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Pipeline summary */}
          <div className="lg:col-span-2 bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 [&_svg]:h-4 [&_svg]:w-4">
                <TrendingUp />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">ملخص الأنبوب</p>
                <p className="text-[11px] text-slate-400 mt-0.5">مجموع نشاط الفريق</p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline">
              {([
                { label: 'فرص مفتوحة',    value: totalOpenLeads,  icon: <UserPlus className="h-3.5 w-3.5" />,      iconBg: 'bg-sky-50 text-sky-500',     color: 'text-sky-700' },
                { label: 'زيارات قادمة',  value: totalUpcoming,   icon: <CalendarDays className="h-3.5 w-3.5" />,  iconBg: 'bg-violet-50 text-violet-500', color: 'text-violet-700' },
                { label: 'حجوزات نشطة',   value: totalActiveRes,  icon: <BookmarkCheck className="h-3.5 w-3.5" />, iconBg: 'bg-amber-50 text-amber-500',  color: 'text-amber-700' },
                { label: 'حجوزات محوّلة', value: totalConvRes,    icon: <FileText className="h-3.5 w-3.5" />,      iconBg: 'bg-emerald-50 text-emerald-500', color: 'text-emerald-700' },
              ] as const).map((stat) => (
                <div key={stat.label} className="px-5 py-4">
                  <div className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg mb-2.5', stat.iconBg)}>
                    {stat.icon}
                  </div>
                  <p className={cn('text-[28px] font-black tabular-nums leading-none', stat.color)}>
                    {stat.value.toLocaleString('ar-EG')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bonus entries */}
          <div className="lg:col-span-3 bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hairline shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 [&_svg]:h-4 [&_svg]:w-4">
                  <BadgePercent />
                </span>
                <div>
                  <p className="text-[13px] font-bold text-slate-800">المكافآت والعمولات</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{periodLabel(period)}</p>
                </div>
              </div>
              <Link href="/dashboard/bonus">
                <Button variant="ghost" size="sm">عرض الكل</Button>
              </Link>
            </div>

            {bonus.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-10 text-sm text-slate-400">
                لا توجد مكافآت في هذه الفترة
              </div>
            ) : (
              <>
                <div className="divide-y divide-hairline flex-1">
                  {bonus.map((entry) => {
                    const S = {
                      PENDING:  { label: 'قيد الانتظار', cls: 'bg-slate-100 text-slate-600' },
                      APPROVED: { label: 'معتمد',         cls: 'bg-amber-100 text-amber-700' },
                      PAID:     { label: 'مدفوع',          cls: 'bg-emerald-100 text-emerald-700' },
                    } as const;
                    const s = S[entry.status] ?? S.PENDING;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/40 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{entry.sales?.fullName ?? '—'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {entry.rule?.name ?? (entry.source === 'CONTRACT_AUTO' ? 'عمولة عقد تلقائية' : 'يدوي')}
                            {entry.commissionPct ? ` · ${entry.commissionPct}%` : ''}
                            {entry.basisAmount ? ` على ${formatCurrency(Number(entry.basisAmount))}` : ''}
                          </p>
                        </div>
                        <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0', s.cls)}>
                          {s.label}
                        </span>
                        <p dir="ltr" className="text-[13px] font-black tabular-nums text-slate-900 shrink-0 whitespace-nowrap">
                          {formatCurrency(Number(entry.amount))}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50/60 border-t border-hairline shrink-0">
                  <div className="flex items-center gap-4">
                    {(['PENDING', 'APPROVED', 'PAID'] as const).map((st) => {
                      const count = bonus.filter((b) => b.status === st).length;
                      if (!count) return null;
                      const L = { PENDING: 'انتظار', APPROVED: 'معتمد', PAID: 'مدفوع' };
                      return <span key={st} className="text-[10px] text-slate-400">{count} {L[st]}</span>;
                    })}
                  </div>
                  <p dir="ltr" className="text-[13px] font-black tabular-nums text-slate-900">
                    {formatCurrency(totalBonusAmt)}
                  </p>
                </div>
              </>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroKpi({ icon, iconClass, label, children }: {
  icon: ReactNode; iconClass: string; label: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center gap-3 px-8 py-6">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', iconClass)}>{icon}</span>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 text-end leading-tight">{label}</p>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

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
