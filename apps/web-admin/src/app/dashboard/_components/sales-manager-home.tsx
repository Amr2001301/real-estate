import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Banknote,
  AlertCircle,
  AlertTriangle,
  Plus,
  CalendarPlus,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Bell,
  Star,
  Target,
  Info,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCompact, formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { PremiumPageHero } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';

interface PerformanceRow {
  salesId:                    string;
  salesName:                  string;
  period:                     string;
  leadsCount:                 number;
  openLeadsCount:             number;
  visitsCount:                number;
  upcomingVisitsCount:        number;
  reservationsCount:          number;
  activeReservationsCount:    number;
  convertedReservationsCount: number;
  signedContractsCount:       number;
  realizedValue:              number;
  targetAmount:               number | null;
  targetUnits:                number | null;
  achievedAmount:             number;
  achievedUnits:              number;
  targetAmountPercent:        number | null;
  targetUnitsPercent:         number | null;
}

interface ManagerAlert {
  label: string;
  desc:  string;
  count?: number;
  href?:  string;
  tone:  'warning' | 'danger' | 'info';
}

const STAGE_META = [
  { stage: 'NEW',         label: 'جديدة',      barCls: 'bg-slate-300',  dotCls: 'bg-slate-400'  },
  { stage: 'CONTACTED',   label: 'تم التواصل', barCls: 'bg-brand-200',  dotCls: 'bg-brand-400'  },
  { stage: 'QUALIFIED',   label: 'مؤهلة',      barCls: 'bg-sky-300',    dotCls: 'bg-sky-500'    },
  { stage: 'PROPOSAL',    label: 'عرض مقدم',   barCls: 'bg-amber-300',  dotCls: 'bg-amber-500'  },
  { stage: 'NEGOTIATION', label: 'تفاوض',      barCls: 'bg-brand-500',  dotCls: 'bg-brand-600'  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctDisplay(value: number | null): string {
  if (value === null) return '—';
  if (value > 200)   return 'تجاوز الهدف';
  return `${value}%`;
}

function pctSub(value: number | null): string | undefined {
  if (value === null || value < 100) return undefined;
  return value > 200 ? 'أعلى من الهدف بكثير' : 'تحقق الهدف';
}

function formatPeriod(period: string): string {
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const [year, monthStr] = period.split('-');
  const m = parseInt(monthStr ?? '1', 10);
  return `${MONTHS[m - 1] ?? ''} ${year ?? ''}`.trim();
}

function daysUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 86400000;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr), now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-brand-100   text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100  text-violet-700',
  'bg-sky-100     text-sky-700',
  'bg-amber-100   text-amber-700',
  'bg-pink-100    text-pink-700',
  'bg-teal-100    text-teal-700',
];

function avatarCls(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

// ── Design helpers ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{children}</span>
      <span className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, icon, topBar, iconCls, valueCls,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; topBar: string; iconCls: string; valueCls: string;
}) {
  return (
    <div className="relative bg-surface rounded-[18px] border border-hairline shadow-soft overflow-hidden">
      <div className={cn('h-[3px] bg-gradient-to-l', topBar)} />
      <div className="flex items-center gap-3 px-4 py-4">
        <span className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4', iconCls)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className={cn('text-xl font-black tabular-nums leading-none', valueCls)}>{value}</p>
          <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export async function SalesManagerDashboard() {
  const nowIso = new Date().toISOString();
  const period = nowIso.slice(0, 7);
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency);

  const [perfRes, leadsRes, reservationsRes, visitsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
    safe(api.get<Paged<VisitAppointment>>(
      `/visits/appointments?scheduledFrom=${nowIso}&pageSize=50`,
    )),
  ]);

  const perf         = perfRes.data        ?? [];
  const leads        = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits       = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // ── Team KPI rollups ──────────────────────────────────────────────────────
  const sum = (pick: (r: PerformanceRow) => number) =>
    perf.reduce((acc, r) => acc + pick(r), 0);

  const teamLeads              = sum((r) => r.leadsCount);
  const teamOpenLeads          = sum((r) => r.openLeadsCount);
  const teamUpcomingVisits     = sum((r) => r.upcomingVisitsCount);
  const teamActiveReservations = sum((r) => r.activeReservationsCount);
  const teamSigned             = sum((r) => r.signedContractsCount);
  const teamRealized           = sum((r) => r.realizedValue);
  const teamTargetAmount       = sum((r) => r.targetAmount ?? 0);
  const teamAmountPct          =
    teamTargetAmount > 0 ? Math.round((teamRealized / teamTargetAmount) * 100) : null;
  // For funnel
  const teamVisits             = sum((r) => r.visitsCount);
  const teamReservations       = sum((r) => r.reservationsCount);

  // ── Pipeline distribution ─────────────────────────────────────────────────
  const openLeads              = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
  const pipelineTotal          = openLeads.length;
  // Funnel: use direct-fetch counts (not monthly perf which can be 0 mid-month)
  const funnelReservations     = reservations.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').length;
  const funnelContracts        = Math.max(teamSigned, reservations.filter((r) => r.status === 'CONVERTED').length);
  const pipelineStageCount = openLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});

  // ── Top performer ─────────────────────────────────────────────────────────
  const repRows = perf.slice().sort((a, b) => b.realizedValue - a.realizedValue);
  const topPerformer = repRows.find((r) => r.achievedAmount > 0 || r.signedContractsCount > 0) ?? null;

  // ── Manager alerts ────────────────────────────────────────────────────────
  const inactiveReps = repRows.filter(
    (r) => r.leadsCount === 0 && r.visitsCount === 0 && r.reservationsCount === 0,
  );
  const teamExpiringCount = reservations.filter((r) => {
    if (!r.expiresAt || r.status === 'CONVERTED' || r.status === 'CANCELLED' || r.status === 'EXPIRED')
      return false;
    const d = daysUntil(r.expiresAt);
    return d >= 0 && d <= 7;
  }).length;
  const teamPendingCount = reservations.filter((r) => r.status === 'PENDING').length;

  const managerAlerts: ManagerAlert[] = [];
  if (teamExpiringCount > 0) {
    managerAlerts.push({
      label: 'حجوزات تنتهي قريباً', count: teamExpiringCount,
      desc:  `${teamExpiringCount} حجز ينتهي خلال 7 أيام — يحتاج متابعة فورية.`,
      href:  '/dashboard/reservations', tone: 'warning',
    });
  }
  if (teamPendingCount > 0) {
    managerAlerts.push({
      label: 'بانتظار الموافقة', count: teamPendingCount,
      desc:  `${teamPendingCount} حجز لم تتم مراجعته بعد.`,
      href:  '/dashboard/reservations', tone: 'info',
    });
  }
  if (inactiveReps.length > 0) {
    managerAlerts.push({
      label: 'مندوبون بدون نشاط',
      desc:
        inactiveReps.slice(0, 3).map((r) => r.salesName).join('، ') +
        (inactiveReps.length > 3 ? ` و${inactiveReps.length - 3} آخرون` : ''),
      tone: 'warning',
    });
  }

  // ── Section rows ──────────────────────────────────────────────────────────
  const recentLeads = leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const activeReservationRows = reservations
    .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
    .slice()
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
    .slice(0, 5);

  const upcomingVisitRows = visits.slice(0, 5);

  const showVisits       = !visitsRes.error       && upcomingVisitRows.length     > 0;
  const showReservations = !reservationsRes.error  && activeReservationRows.length > 0;
  const showLeads        = !leadsRes.error         && recentLeads.length           > 0;
  const bottomCount      = [showVisits, showReservations, showLeads].filter(Boolean).length;

  return (
    <div className="space-y-5">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="لوحة مدير المبيعات"
        description="متابعة أداء فريق المبيعات، الفرص، الزيارات، الحجوزات، وتحقيق الأهداف."
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/dashboard' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/leads/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة فرصة
              </Button>
            </Link>
            <Link href="/dashboard/visits/new">
              <Button variant="outline" size="md" leftIcon={<CalendarPlus className="h-4 w-4" />}>
                جدولة زيارة
              </Button>
            </Link>
            <Link href="/dashboard/reservations/new">
              <Button variant="outline" size="md" leftIcon={<BookmarkCheck className="h-4 w-4" />}>
                إنشاء حجز
              </Button>
            </Link>
            <Link href="/dashboard/my-compensation">
              <Button variant="outline" size="md" leftIcon={<Wallet className="h-4 w-4" />}>
                مستحقاتي وأهدافي
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── KPI tiles — Row 1 & Row 2 ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile
          label="فرص الفريق"
          value={leadsRes.error ? '—' : leads.length}
          sub={`${openLeads.length} مفتوحة`}
          icon={<Users />}
          topBar="from-brand-300 via-brand-500 to-brand-300"
          iconCls="bg-brand-50 text-brand-600 ring-1 ring-brand-100"
          valueCls="text-brand-700"
        />
        <KpiTile
          label="فرص مفتوحة"
          value={leadsRes.error ? '—' : openLeads.length}
          sub={`من أصل ${leads.length} فرصة`}
          icon={<Zap />}
          topBar="from-violet-300 via-violet-500 to-violet-300"
          iconCls="bg-violet-50 text-violet-600 ring-1 ring-violet-100"
          valueCls="text-violet-700"
        />
        <KpiTile
          label="زيارات قادمة"
          value={visitsRes.error ? '—' : visits.length}
          sub="مجدولة لاحقاً"
          icon={<CalendarClock />}
          topBar="from-sky-300 via-sky-500 to-sky-300"
          iconCls="bg-sky-50 text-sky-600 ring-1 ring-sky-100"
          valueCls="text-sky-700"
        />
        <KpiTile
          label="حجوزات نشطة"
          value={reservationsRes.error ? '—' : funnelReservations}
          sub={teamExpiringCount > 0 ? `${teamExpiringCount} تنتهي قريباً` : 'لا حجوزات تنتهي'}
          icon={<BookmarkCheck />}
          topBar={teamExpiringCount > 0 ? 'from-amber-300 via-amber-500 to-amber-300' : 'from-emerald-300 via-emerald-500 to-emerald-300'}
          iconCls={teamExpiringCount > 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'}
          valueCls={teamExpiringCount > 0 ? 'text-amber-700' : 'text-emerald-700'}
        />
        <KpiTile
          label="عقود الشهر"
          value={perfRes.error ? '—' : teamSigned}
          sub={formatPeriod(period)}
          icon={<FileText />}
          topBar="from-emerald-300 via-emerald-500 to-emerald-300"
          iconCls="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
          valueCls="text-emerald-700"
        />
        <KpiTile
          label="القيمة المحققة"
          value={perfRes.error ? '—' : formatCompact(teamRealized, symbol)}
          sub={`هذا الشهر · ${formatPeriod(period)}`}
          icon={<Banknote />}
          topBar="from-brand-300 via-brand-500 to-brand-300"
          iconCls="bg-brand-50 text-brand-600 ring-1 ring-brand-100"
          valueCls="text-brand-700"
        />
        <KpiTile
          label="الهدف المالي"
          value={perfRes.error ? '—' : pctDisplay(teamAmountPct)}
          sub={perfRes.error ? undefined : pctSub(teamAmountPct)}
          icon={<Target />}
          topBar={
            teamAmountPct === null ? 'from-slate-200 via-slate-300 to-slate-200'
            : teamAmountPct >= 80  ? 'from-emerald-300 via-emerald-500 to-emerald-300'
            : teamAmountPct >= 50  ? 'from-amber-300 via-amber-500 to-amber-300'
            :                        'from-red-300 via-red-400 to-red-300'
          }
          iconCls={
            teamAmountPct === null ? 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
            : teamAmountPct >= 80  ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
            : teamAmountPct >= 50  ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'
            :                        'bg-red-50 text-red-500 ring-1 ring-red-100'
          }
          valueCls={
            teamAmountPct === null ? 'text-slate-400'
            : teamAmountPct >= 80  ? 'text-emerald-700'
            : teamAmountPct >= 50  ? 'text-amber-700'
            :                        'text-red-600'
          }
        />
        <KpiTile
          label="تنبيهات الفريق"
          value={managerAlerts.length}
          sub={managerAlerts.length > 0 ? 'بنود تحتاج مراجعة' : 'لا تنبيهات'}
          icon={<Bell />}
          topBar={managerAlerts.length > 0 ? 'from-amber-300 via-amber-500 to-amber-300' : 'from-emerald-300 via-emerald-400 to-emerald-300'}
          iconCls={managerAlerts.length > 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'}
          valueCls={managerAlerts.length > 0 ? 'text-amber-700' : 'text-emerald-700'}
        />
      </div>

      {/* ── Team Performance Table ────────────────────────────────────────── */}
      <TeamPerformanceTable
        perfError={perfRes.error}
        repRows={repRows}
        period={period}
        symbol={symbol}
        topPerformerId={topPerformer?.salesId ?? null}
      />

      {/* ── Team Conversion Funnel ────────────────────────────────────────── */}
      {!leadsRes.error && (
        <TeamFunnel
          teamLeads={openLeads.length}
          teamVisits={visits.length}
          teamReservations={funnelReservations}
          teamContracts={funnelContracts}
          topPerformer={topPerformer}
          currency={currency}
          symbol={symbol}
        />
      )}

      {/* ── Pipeline + Alerts ─────────────────────────────────────────────── */}
      {(!leadsRes.error || managerAlerts.length > 0) && (
        <div className={cn('grid grid-cols-1 gap-5 items-start', managerAlerts.length > 0 ? 'lg:grid-cols-3' : '')}>
          {!leadsRes.error && (
            <div className={managerAlerts.length > 0 ? 'lg:col-span-2' : ''}>
              <PipelineCard stageCount={pipelineStageCount} total={pipelineTotal} />
            </div>
          )}
          {managerAlerts.length > 0 && (
            <AlertCard alerts={managerAlerts} />
          )}
        </div>
      )}

      {/* ── Activity section ──────────────────────────────────────────────── */}
      {bottomCount > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>آخر النشاط</SectionLabel>
          {showLeads && (showVisits || showReservations) ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
              <SectionCard
                title="أحدث الفرص"
                icon={<Zap />}
                iconCls="bg-brand-50 text-brand-600 ring-brand-100"
                href="/dashboard/leads"
                hrefLabel="فتح الفرص"
                error={leadsRes.error}
                empty={recentLeads.length === 0}
                emptyText="لا توجد فرص حديثة."
                className="lg:col-span-2"
              >
                {recentLeads.map((l) => (
                  <Link key={l.id} href={`/dashboard/leads/${l.id}` as never}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                        {l.client?.fullName ?? l.fullName}
                      </p>
                      <p className="text-2xs text-slate-400 truncate mt-0.5 leading-tight">
                        {l.assignedSales?.fullName ?? '—'}
                        {' · '}
                        {l.projectInterest ? tx(l.projectInterest.name) : 'بدون مشروع'}
                      </p>
                    </div>
                    <LeadStageBadge stage={l.stage} />
                  </Link>
                ))}
              </SectionCard>

              <div className="space-y-4">
                {showVisits && (
                  <SectionCard
                    title="زيارات قادمة للفريق"
                    icon={<CalendarClock />}
                    iconCls="bg-sky-50 text-sky-600 ring-sky-100"
                    href="/dashboard/visits"
                    hrefLabel="فتح الزيارات"
                    error={visitsRes.error}
                    empty={upcomingVisitRows.length === 0}
                    emptyText="لا توجد زيارات قادمة."
                  >
                    {upcomingVisitRows.map((v) => (
                      <Link key={v.id} href={`/dashboard/visits/appointments/${v.id}` as never}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                              {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                            </p>
                            {isToday(v.scheduledAt) && (
                              <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
                                اليوم
                              </span>
                            )}
                          </div>
                          <p className="text-2xs text-slate-400 mt-0.5 leading-tight">
                            <span className="tabular-nums">{formatDateTime(v.scheduledAt)}</span>
                            {v.assignedSales ? ` · ${v.assignedSales.fullName}` : ''}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={v.status} />
                      </Link>
                    ))}
                  </SectionCard>
                )}
                {showReservations && (
                  <SectionCard
                    title="حجوزات قيد المتابعة"
                    icon={<BookmarkCheck />}
                    iconCls="bg-emerald-50 text-emerald-600 ring-emerald-100"
                    href="/dashboard/reservations"
                    hrefLabel="فتح الحجوزات"
                    error={reservationsRes.error}
                    empty={activeReservationRows.length === 0}
                    emptyText="لا توجد حجوزات نشطة."
                  >
                    {activeReservationRows.map((r) => {
                      const rem = Math.ceil(daysUntil(r.expiresAt));
                      const isUrgent  = rem <= 1;
                      const isWarning = rem > 1 && rem <= 7;
                      return (
                        <Link key={r.id} href={`/dashboard/reservations/${r.id}` as never}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                              {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                              {r.unit?.code ? ` · ${r.unit.code}` : ''}
                            </p>
                            <p className="text-2xs mt-0.5 leading-tight">
                              <span className="text-slate-400">{r.sales?.fullName ?? '—'}</span>
                              {r.expiresAt && (
                                <>
                                  {' · '}
                                  <span className={cn(
                                    'tabular-nums font-medium',
                                    isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
                                  )}>
                                    {rem <= 0 ? 'ينتهي اليوم' : rem === 1 ? 'ينتهي غداً' : `يتبقى ${rem} أيام`}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <ReservationStatusBadge status={r.status} />
                        </Link>
                      );
                    })}
                  </SectionCard>
                )}
              </div>
            </div>
          ) : showLeads ? (
            <SectionCard
              title="أحدث الفرص"
              icon={<Zap />}
              iconCls="bg-brand-50 text-brand-600 ring-brand-100"
              href="/dashboard/leads"
              hrefLabel="فتح الفرص"
              error={leadsRes.error}
              empty={recentLeads.length === 0}
              emptyText="لا توجد فرص حديثة."
              className="max-w-2xl"
            >
              {recentLeads.map((l) => (
                <Link key={l.id} href={`/dashboard/leads/${l.id}` as never}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                      {l.client?.fullName ?? l.fullName}
                    </p>
                    <p className="text-2xs text-slate-400 truncate mt-0.5 leading-tight">
                      {l.assignedSales?.fullName ?? '—'}
                      {' · '}
                      {l.projectInterest ? tx(l.projectInterest.name) : 'بدون مشروع'}
                    </p>
                  </div>
                  <LeadStageBadge stage={l.stage} />
                </Link>
              ))}
            </SectionCard>
          ) : (
            <div className={cn('grid grid-cols-1 gap-4 lg:items-start', showVisits && showReservations ? 'lg:grid-cols-2' : '')}>
              {showVisits && (
                <SectionCard
                  title="زيارات قادمة للفريق"
                  icon={<CalendarClock />}
                  iconCls="bg-sky-50 text-sky-600 ring-sky-100"
                  href="/dashboard/visits"
                  hrefLabel="فتح الزيارات"
                  error={visitsRes.error}
                  empty={upcomingVisitRows.length === 0}
                  emptyText="لا توجد زيارات قادمة."
                >
                  {upcomingVisitRows.map((v) => (
                    <Link key={v.id} href={`/dashboard/visits/appointments/${v.id}` as never}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                        </p>
                        <p className="text-2xs text-slate-400 mt-0.5">
                          <span className="tabular-nums">{formatDateTime(v.scheduledAt)}</span>
                          {v.assignedSales ? ` · ${v.assignedSales.fullName}` : ''}
                        </p>
                      </div>
                      <AppointmentStatusBadge status={v.status} />
                    </Link>
                  ))}
                </SectionCard>
              )}
              {showReservations && (
                <SectionCard
                  title="حجوزات قيد المتابعة"
                  icon={<BookmarkCheck />}
                  iconCls="bg-emerald-50 text-emerald-600 ring-emerald-100"
                  href="/dashboard/reservations"
                  hrefLabel="فتح الحجوزات"
                  error={reservationsRes.error}
                  empty={activeReservationRows.length === 0}
                  emptyText="لا توجد حجوزات نشطة."
                >
                  {activeReservationRows.map((r) => {
                    const rem = Math.ceil(daysUntil(r.expiresAt));
                    const isUrgent  = rem <= 1;
                    const isWarning = rem > 1 && rem <= 7;
                    return (
                      <Link key={r.id} href={`/dashboard/reservations/${r.id}` as never}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                            {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                            {r.unit?.code ? ` · ${r.unit.code}` : ''}
                          </p>
                          <p className="text-2xs mt-0.5 leading-tight">
                            <span className="text-slate-400">{r.sales?.fullName ?? '—'}</span>
                            {r.expiresAt && (
                              <>
                                {' · '}
                                <span className={cn(
                                  'tabular-nums font-medium',
                                  isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
                                )}>
                                  {rem <= 0 ? 'ينتهي اليوم' : rem === 1 ? 'ينتهي غداً' : `يتبقى ${rem} أيام`}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <ReservationStatusBadge status={r.status} />
                      </Link>
                    );
                  })}
                </SectionCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Conversion Funnel ────────────────────────────────────────────────────
function TeamFunnel({
  teamLeads, teamVisits, teamReservations, teamContracts, topPerformer, currency, symbol,
}: {
  teamLeads:       number;
  teamVisits:      number;
  teamReservations: number;
  teamContracts:   number;
  topPerformer:    PerformanceRow | null;
  currency:        string;
  symbol:          string;
}) {
  const stages = [
    { label: 'الفرص المفتوحة',   value: teamLeads,        icon: <Zap />,           bg: 'bg-brand-50   text-brand-600   ring-brand-100'   },
    { label: 'الزيارات القادمة', value: teamVisits,        icon: <CalendarClock />, bg: 'bg-sky-50     text-sky-600     ring-sky-100'     },
    { label: 'الحجوزات النشطة',  value: teamReservations,  icon: <BookmarkCheck />, bg: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { label: 'العقود الموقعة',  value: teamContracts,     icon: <FileText />,      bg: 'bg-violet-50  text-violet-600  ring-violet-100'  },
  ] as const;

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-hairline bg-canvas/30">
        <span className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600 [&>svg]:h-4 [&>svg]:w-4">
          <TrendingUp />
        </span>
        <div>
          <h3 className="text-[13.5px] font-bold text-navy leading-none">مسار التحويل الجماعي</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">أداء الفريق من الفرصة إلى العقد</p>
        </div>
      </div>

      <div className="p-5">
        {/* Funnel stages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {stages.map((s, i) => {
            const prev = i > 0 ? stages[i - 1]!.value : null;
            const rate = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
            return (
              <div key={s.label} className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-2 w-full justify-center">
                  {i > 0 && <div className="hidden sm:block h-px flex-1 bg-hairline" />}
                  <span className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4 ring-1',
                    s.bg,
                  )}>
                    {s.icon}
                  </span>
                  {i < stages.length - 1 && <div className="hidden sm:block h-px flex-1 bg-hairline" />}
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{s.value}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">{s.label}</p>
                  {rate !== null && (
                    <p className={cn('text-[10px] font-semibold mt-0.5', rate > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                      {rate}% تحويل
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Top performer strip */}
        {topPerformer && (
          <div className="border-t border-hairline pt-4">
            <div className="flex items-center gap-3 rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
              <span className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center bg-amber-100 text-amber-700">
                <Star className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest leading-none">نجم الشهر</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5 leading-tight">{topPerformer.salesName}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-end">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">العقود</p>
                  <p className="text-lg font-black text-emerald-700 tabular-nums leading-tight">{topPerformer.signedContractsCount}</p>
                </div>
                {topPerformer.achievedAmount > 0 && (
                  <div className="text-end">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">المحقق</p>
                    <p className="text-sm font-black text-brand-700 tabular-nums leading-tight">{formatCompact(topPerformer.achievedAmount, symbol)}</p>
                  </div>
                )}
                {topPerformer.targetAmountPercent !== null && (
                  <div className="text-end">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">الإنجاز</p>
                    <p className={cn(
                      'text-sm font-black tabular-nums leading-tight',
                      topPerformer.targetAmountPercent >= 80 ? 'text-emerald-700'
                      : topPerformer.targetAmountPercent >= 50 ? 'text-amber-700'
                      : 'text-slate-600',
                    )}>
                      {Math.round(topPerformer.targetAmountPercent)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Team Performance Table ────────────────────────────────────────────────────
function TeamPerformanceTable({
  perfError, repRows, period, symbol, topPerformerId,
}: {
  perfError?:       string | null;
  repRows:          PerformanceRow[];
  period:           string;
  symbol?:          string;
  topPerformerId:   string | null;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600 [&>svg]:h-4 [&>svg]:w-4">
            <Users />
          </span>
          <div>
            <h3 className="text-[13.5px] font-bold text-navy leading-none">أداء فريق المبيعات</h3>
            {repRows.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">{repRows.length} مندوب · {period}</p>
            )}
          </div>
        </div>
        <Link href="/dashboard/targets"
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors">
          إدارة الأهداف
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {perfError ? (
        <div className="flex items-start gap-2 text-amber-700 text-sm px-5 py-4">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل هذا القسم.</p>
        </div>
      ) : repRows.length === 0 ? (
        <EmptyState icon={<Users />} title="لا يوجد مندوبو مبيعات بعد" className="py-8" />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[660px]">
            <thead className="bg-canvas/50 border-b border-hairline">
              <tr>
                <th className="px-5 py-3 text-start text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">المندوب</th>
                <th className="px-3 py-3 text-start text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">الحالة</th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-400 inline-block" />فرص</span>
                </th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400 inline-block" />زيارات</span>
                </th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-400 inline-block" />حجوزات</span>
                </th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />عقود</span>
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">المحقق</th>
                <th className="px-4 py-3 text-start text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">الإنجاز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {repRows.map((r) => {
                const isActive = r.leadsCount > 0 || r.visitsCount > 0 || r.reservationsCount > 0;
                const isTop    = r.salesId === topPerformerId;
                return (
                  <tr key={r.salesId}
                    className={cn('hover:bg-canvas/40 transition-colors', !isActive && 'opacity-60')}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black',
                          avatarCls(r.salesName),
                        )}>
                          {initials(r.salesName)}
                        </span>
                        <span className="font-semibold text-slate-800 text-sm">{r.salesName}</span>
                        {isTop && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                            <Star className="h-2.5 w-2.5 fill-amber-500 stroke-none" />
                            نجم
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold bg-slate-100 text-slate-500">
                          غير نشط
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 text-end font-medium">{r.leadsCount}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 text-end font-medium">{r.visitsCount}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 text-end font-medium">{r.reservationsCount}</td>
                    <td className="px-3 py-3 tabular-nums text-emerald-700 text-end font-bold">{r.signedContractsCount}</td>
                    <td className="px-4 py-3 tabular-nums font-bold text-slate-900 whitespace-nowrap text-end text-[13px]">
                      {r.achievedAmount > 0 ? (
                        formatCompact(r.achievedAmount, symbol)
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.targetAmountPercent !== null ? (
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <span className={cn(
                            'text-[18px] font-black tabular-nums leading-none',
                            r.targetAmountPercent >= 80  ? 'text-emerald-700'
                            : r.targetAmountPercent >= 50 ? 'text-amber-600'
                            : 'text-slate-500',
                          )}>
                            {Math.round(r.targetAmountPercent)}%
                          </span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                r.targetAmountPercent >= 80  ? 'bg-emerald-500'
                                : r.targetAmountPercent >= 50 ? 'bg-amber-400'
                                : 'bg-slate-300',
                              )}
                              style={{ width: `${Math.min(r.targetAmountPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-2xs text-slate-300 font-medium">لا هدف</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────
const STAGE_TILE: Record<string, { topBar: string; valueCls: string; tileCls: string }> = {
  NEW:         { topBar: 'from-slate-200 via-slate-300 to-slate-200',  valueCls: 'text-slate-700',  tileCls: 'bg-slate-50/60'   },
  CONTACTED:   { topBar: 'from-brand-200 via-brand-400 to-brand-200',  valueCls: 'text-brand-700',  tileCls: 'bg-brand-50/60'   },
  QUALIFIED:   { topBar: 'from-sky-200 via-sky-400 to-sky-200',        valueCls: 'text-sky-700',    tileCls: 'bg-sky-50/60'     },
  PROPOSAL:    { topBar: 'from-amber-200 via-amber-400 to-amber-200',  valueCls: 'text-amber-700',  tileCls: 'bg-amber-50/60'   },
  NEGOTIATION: { topBar: 'from-brand-400 via-brand-600 to-brand-400',  valueCls: 'text-brand-800',  tileCls: 'bg-brand-50/80'   },
};

function PipelineCard({ stageCount, total }: { stageCount: Record<string, number>; total: number }) {
  const items = STAGE_META.map((s) => ({ ...s, count: stageCount[s.stage] ?? 0 }));
  const activeCount = items.filter((s) => s.count > 0).length;

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600 [&>svg]:h-4 [&>svg]:w-4">
            <TrendingUp />
          </span>
          <div>
            <h3 className="text-[13.5px] font-bold text-navy leading-none">مسار المبيعات النشط</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {total > 0
                ? `${total} فرصة مفتوحة عبر ${activeCount} مراحل`
                : 'لا توجد فرص مفتوحة'}
            </p>
          </div>
        </div>
        <Link href="/dashboard/leads"
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors">
          فتح الفرص
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="p-5 space-y-4">
        {total > 0 ? (
          <>
            {/* Stage tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {items.map((s) => {
                const tile = STAGE_TILE[s.stage] ?? STAGE_TILE.NEW!;
                const pct  = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.stage}
                    className={cn(
                      'relative rounded-[14px] border border-hairline overflow-hidden',
                      tile.tileCls,
                      s.count === 0 && 'opacity-50',
                    )}>
                    <div className={cn('h-[3px] bg-gradient-to-l', tile.topBar)} />
                    <div className="px-3 py-3 text-center">
                      <p className={cn('text-2xl font-black tabular-nums leading-none', tile.valueCls)}>
                        {s.count}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">{s.label}</p>
                      {pct > 0 && (
                        <p className="text-[10px] text-slate-400 tabular-nums mt-0.5">{pct}%</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="flex rounded-full overflow-hidden h-2 gap-px bg-slate-100">
              {items.filter((s) => s.count > 0).map((s) => (
                <div key={s.stage}
                  className={cn('h-full first:rounded-s-full last:rounded-e-full', s.barCls)}
                  style={{ width: `${(s.count / total) * 100}%` }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 py-2">
            <AlertCircle className="h-4 w-4 text-slate-300 shrink-0" />
            <p className="text-xs text-slate-400">لا توجد فرص مفتوحة حالياً.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ alerts }: { alerts: ManagerAlert[] }) {
  const TONE_CONFIG: Record<ManagerAlert['tone'], {
    icon: React.ReactNode; ringCls: string; iconCls: string; countCls: string; titleCls: string;
  }> = {
    warning: {
      icon:     <AlertTriangle className="h-4 w-4" />,
      ringCls:  'bg-amber-50  ring-1 ring-amber-200  text-amber-600',
      iconCls:  '',
      countCls: 'bg-amber-100  text-amber-800',
      titleCls: 'text-amber-900',
    },
    danger: {
      icon:     <AlertCircle className="h-4 w-4" />,
      ringCls:  'bg-red-50    ring-1 ring-red-200    text-red-500',
      iconCls:  '',
      countCls: 'bg-red-100    text-red-800',
      titleCls: 'text-red-900',
    },
    info: {
      icon:     <Info className="h-4 w-4" />,
      ringCls:  'bg-brand-50  ring-1 ring-brand-200  text-brand-600',
      iconCls:  '',
      countCls: 'bg-brand-100  text-brand-800',
      titleCls: 'text-navy',
    },
  };

  return (
    <div className="bg-surface border border-amber-100 rounded-[20px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-amber-100 bg-amber-50/40">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-amber-600" />
            <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-bold text-amber-900 leading-none">تنبيهات الفريق</h3>
            <p className="text-[11px] text-amber-600 mt-0.5">{alerts.length} بنود تحتاج مراجعة</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-amber-200 text-amber-900 text-xs font-black px-2 tabular-nums">
          {alerts.length}
        </span>
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-hairline">
        {alerts.map((alert, i) => {
          const cfg = TONE_CONFIG[alert.tone];
          return (
            <div key={i} className="flex items-start gap-3.5 px-5 py-4">
              {/* Icon ring */}
              <span className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                cfg.ringCls,
              )}>
                {cfg.icon}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={cn('text-sm font-bold leading-tight', cfg.titleCls)}>{alert.label}</p>
                  {alert.count !== undefined && (
                    <span className={cn('inline-flex items-center justify-center h-5 min-w-5 rounded-full text-2xs font-black px-1.5 tabular-nums', cfg.countCls)}>
                      {alert.count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-snug">{alert.desc}</p>
                {alert.href && (
                  <Link href={alert.href as never}
                    className="inline-flex items-center gap-0.5 text-2xs font-bold text-brand-700 hover:text-brand-800 transition-colors mt-1.5">
                    عرض التفاصيل
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({
  title, icon, iconCls, href, hrefLabel = 'عرض الكل',
  error, empty, emptyText, className, children,
}: {
  title: string; icon: React.ReactNode; iconCls: string;
  href: string; hrefLabel?: string;
  error?: string | null; empty: boolean; emptyText: string;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn('bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <span className={cn(
            'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ring-1 [&>svg]:h-4 [&>svg]:w-4',
            iconCls,
          )}>
            {icon}
          </span>
          <h3 className="text-[13.5px] font-bold text-navy leading-none">{title}</h3>
        </div>
        <Link href={href as never}
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors shrink-0">
          {hrefLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {error ? (
        <div className="flex items-start gap-2 text-amber-700 text-xs px-5 py-4">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل هذا القسم.</p>
        </div>
      ) : empty ? (
        <div className="flex items-center gap-2.5 px-5 py-5">
          <AlertCircle className="h-4 w-4 text-slate-300 shrink-0" />
          <p className="text-xs text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </div>
  );
}
