import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Banknote,
  AlertCircle,
  Plus,
  CalendarPlus,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Bell,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCompact, formatDate, formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';

interface PerformanceRow {
  salesId:                   string;
  salesName:                 string;
  period:                    string;
  leadsCount:                number;
  openLeadsCount:            number;
  visitsCount:               number;
  upcomingVisitsCount:       number;
  reservationsCount:         number;
  activeReservationsCount:   number;
  convertedReservationsCount: number;
  signedContractsCount:      number;
  realizedValue:             number;
  targetAmount:              number | null;
  targetUnits:               number | null;
  achievedAmount:            number;
  achievedUnits:             number;
  targetAmountPercent:       number | null;
  targetUnitsPercent:        number | null;
}

interface ManagerAlert {
  label: string;
  desc:  string;
  count?: number;
  href?:  string;
  tone:  'warning' | 'danger' | 'info';
}

const STAGE_META = [
  { stage: 'NEW',         label: 'جديدة',      barCls: 'bg-slate-300', dotCls: 'bg-slate-400' },
  { stage: 'CONTACTED',   label: 'تم التواصل', barCls: 'bg-brand-200', dotCls: 'bg-brand-400' },
  { stage: 'QUALIFIED',   label: 'مؤهلة',      barCls: 'bg-sky-300',   dotCls: 'bg-sky-500'   },
  { stage: 'PROPOSAL',    label: 'عرض مقدم',   barCls: 'bg-amber-300', dotCls: 'bg-amber-500' },
  { stage: 'NEGOTIATION', label: 'تفاوض',      barCls: 'bg-brand-500', dotCls: 'bg-brand-600' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Cap at 200 % — above that show a qualitative label so the card stays readable
function pctDisplay(value: number | null): string {
  if (value === null) return '—';
  if (value > 200)   return 'تجاوز الهدف';
  return `${value}%`;
}

function pctSub(value: number | null): string | undefined {
  if (value === null || value < 100) return undefined;
  return value > 200 ? 'أعلى من الهدف بكثير' : 'تحقق الهدف';
}

// Format "2026-06" → "يونيو 2026"
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
  const d   = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate()
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export async function SalesManagerDashboard() {
  const nowIso = new Date().toISOString();
  const period = nowIso.slice(0, 7);

  const [perfRes, leadsRes, reservationsRes, visitsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
    safe(
      api.get<Paged<VisitAppointment>>(
        `/visits/appointments?scheduledFrom=${nowIso}&pageSize=50`,
      ),
    ),
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
    teamTargetAmount > 0
      ? Math.round((teamRealized / teamTargetAmount) * 100)
      : null;

  // ── Pipeline distribution ─────────────────────────────────────────────────
  const openLeads    = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
  const pipelineTotal = openLeads.length;
  const pipelineStageCount = openLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});
  const pipelineMeaningful =
    STAGE_META.filter((s) => (pipelineStageCount[s.stage] ?? 0) > 0).length >= 2;

  // ── Manager alerts ────────────────────────────────────────────────────────
  const repRows = perf.slice().sort((a, b) => b.realizedValue - a.realizedValue);

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
      label: 'حجوزات بانتظار الموافقة', count: teamPendingCount,
      desc:  `${teamPendingCount} حجز لم تتم مراجعته بعد.`,
      href:  '/dashboard/reservations', tone: 'info',
    });
  }
  if (inactiveReps.length > 0) {
    managerAlerts.push({
      label: 'مندوبون بدون نشاط هذا الشهر',
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

  const showVisits       = !visitsRes.error       && upcomingVisitRows.length    > 0;
  const showReservations = !reservationsRes.error  && activeReservationRows.length > 0;
  const showLeads        = !leadsRes.error         && recentLeads.length           > 0;
  const bottomCount      = [showVisits, showReservations, showLeads].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="لوحة مدير المبيعات"
        description="متابعة أداء فريق المبيعات، الفرص، الزيارات، الحجوزات، وتحقيق الأهداف."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
        ]}
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

      {/* ── Metric strip — balanced 4+4 grid ─────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          // ── Row 1 ────────────────────────────────────────────────────────
          {
            label: 'فرص الفريق',
            value: leadsRes.error ? '—' : teamLeads,
            sub:   `${teamOpenLeads} مفتوحة`,
            icon:  <Users />,
            tone:  'brand',
          },
          {
            label: 'فرص مفتوحة',
            value: perfRes.error ? '—' : teamOpenLeads,
            sub:   `من أصل ${teamLeads} فرصة`,
            icon:  <Zap />,
            tone:  'purple',
          },
          {
            label: 'زيارات قادمة',
            value: perfRes.error ? '—' : teamUpcomingVisits,
            sub:   'مجدولة لاحقاً',
            icon:  <CalendarClock />,
            tone:  'info',
          },
          {
            label: 'حجوزات نشطة',
            value: perfRes.error ? '—' : teamActiveReservations,
            sub:   teamExpiringCount > 0 ? `${teamExpiringCount} تنتهي قريباً` : 'لا حجوزات تنتهي',
            icon:  <BookmarkCheck />,
            tone:  teamExpiringCount > 0 ? 'warning' : 'success',
          },
          // ── Row 2 ────────────────────────────────────────────────────────
          {
            label: 'عقود الشهر',
            value: perfRes.error ? '—' : teamSigned,
            sub:   formatPeriod(period),
            icon:  <FileText />,
            tone:  'success',
          },
          {
            // Primary: most business-critical metric — gets warm gold tint + larger value
            label:     'القيمة المحققة',
            value:     perfRes.error ? '—' : formatCompact(teamRealized),
            sub:       `هذا الشهر · ${formatPeriod(period)}`,
            icon:      <Banknote />,
            tone:      'brand',
            valueSize: 'compact',
            primary:   true,
          },
          {
            label: 'الهدف المالي',
            value: perfRes.error ? '—' : pctDisplay(teamAmountPct),
            sub:   perfRes.error ? undefined : pctSub(teamAmountPct),
            icon:  <TrendingUp />,
            tone:  teamAmountPct === null ? 'neutral'
                 : teamAmountPct >= 80    ? 'success'
                 : teamAmountPct >= 50    ? 'warning'
                 : 'brand',
          },
          {
            label: 'تنبيهات الفريق',
            value: managerAlerts.length,
            sub:   managerAlerts.length > 0 ? 'تحتاج مراجعة' : 'لا تنبيهات',
            icon:  <Bell />,
            tone:  managerAlerts.length > 0 ? 'warning' : 'success',
          },
        ]}
      />

      {/* ── Team Performance — full width ────────────────────────────────────── */}
      <TeamPerformanceTable
        perfError={perfRes.error}
        repRows={repRows}
        period={period}
      />

      {/* ── Pipeline + Alerts — side by side ──────────────────────────────── */}
      {(!leadsRes.error || managerAlerts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {!leadsRes.error && (
            <div className={managerAlerts.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <PipelineCard stageCount={pipelineStageCount} total={pipelineTotal} />
            </div>
          )}
          {managerAlerts.length > 0 && (
            <AlertCard alerts={managerAlerts} />
          )}
        </div>
      )}

      {/* ── Bottom content cards ──────────────────────────────────────────── */}
      {bottomCount > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>آخر النشاط</SectionLabel>
          {showLeads && (showVisits || showReservations) ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
              <ManagerSection
                title="أحدث الفرص"
                icon={<Zap className="h-3.5 w-3.5 text-brand-600" />}
                iconBg="bg-brand-50"
                href="/dashboard/leads"
                hrefLabel="فتح الفرص"
                className="lg:col-span-2"
              >
                {recentLeads.map((l) => (
                  <Link
                    key={l.id}
                    href={`/dashboard/leads/${l.id}` as never}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate leading-tight">
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
              </ManagerSection>

              <div className="space-y-4">
                {showVisits && (
                  <ManagerSection
                    title="زيارات قادمة للفريق"
                    icon={<CalendarClock className="h-3.5 w-3.5 text-blue-600" />}
                    iconBg="bg-blue-50"
                    href="/dashboard/visits"
                    hrefLabel="فتح الزيارات"
                  >
                    {upcomingVisitRows.map((v) => (
                      <Link
                        key={v.id}
                        href={`/dashboard/visits/appointments/${v.id}` as never}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                              {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                            </p>
                            {isToday(v.scheduledAt) && (
                              <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700">
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
                  </ManagerSection>
                )}
                {showReservations && (
                  <ManagerSection
                    title="حجوزات قيد المتابعة"
                    icon={<BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    href="/dashboard/reservations"
                    hrefLabel="فتح الحجوزات"
                  >
                    {activeReservationRows.map((r) => {
                      const rem       = Math.ceil(daysUntil(r.expiresAt));
                      const isUrgent  = rem <= 1;
                      const isWarning = rem > 1 && rem <= 7;
                      return (
                        <Link
                          key={r.id}
                          href={`/dashboard/reservations/${r.id}` as never}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate leading-tight">
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
                  </ManagerSection>
                )}
              </div>
            </div>
          ) : showLeads ? (
            <ManagerSection
              title="أحدث الفرص"
              icon={<Zap className="h-3.5 w-3.5 text-brand-600" />}
              iconBg="bg-brand-50"
              href="/dashboard/leads"
              hrefLabel="فتح الفرص"
              className="max-w-2xl"
            >
              {recentLeads.map((l) => (
                <Link
                  key={l.id}
                  href={`/dashboard/leads/${l.id}` as never}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate leading-tight">
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
            </ManagerSection>
          ) : (
            <div className={cn('grid grid-cols-1 gap-4 lg:items-start', showVisits && showReservations ? 'lg:grid-cols-2' : '')}>
              {showVisits && (
                <ManagerSection
                  title="زيارات قادمة للفريق"
                  icon={<CalendarClock className="h-3.5 w-3.5 text-blue-600" />}
                  iconBg="bg-blue-50"
                  href="/dashboard/visits"
                  hrefLabel="فتح الزيارات"
                >
                  {upcomingVisitRows.map((v) => (
                    <Link
                      key={v.id}
                      href={`/dashboard/visits/appointments/${v.id}` as never}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                            {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                          </p>
                          {isToday(v.scheduledAt) && (
                            <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700">
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
                </ManagerSection>
              )}
              {showReservations && (
                <ManagerSection
                  title="حجوزات قيد المتابعة"
                  icon={<BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" />}
                  iconBg="bg-emerald-50"
                  href="/dashboard/reservations"
                  hrefLabel="فتح الحجوزات"
                >
                  {activeReservationRows.map((r) => {
                    const rem       = Math.ceil(daysUntil(r.expiresAt));
                    const isUrgent  = rem <= 1;
                    const isWarning = rem > 1 && rem <= 7;
                    return (
                      <Link
                        key={r.id}
                        href={`/dashboard/reservations/${r.id}` as never}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate leading-tight">
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
                </ManagerSection>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Performance Table ────────────────────────────────────────────────────

function TeamPerformanceTable({
  perfError,
  repRows,
  period,
  className = '',
}: {
  perfError?: string | null;
  repRows:    PerformanceRow[];
  period:     string;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-hairline bg-canvas/40">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-brand-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
              أداء فريق المبيعات
            </h3>
            {repRows.length > 0 && (
              <p className="text-2xs text-slate-400 mt-0.5">
                {repRows.length} مندوب · {period}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/targets"
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors"
        >
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
          <table className="w-full text-sm min-w-[620px]">
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
                const isActive =
                  r.leadsCount > 0 || r.visitsCount > 0 || r.reservationsCount > 0;
                return (
                  <tr
                    key={r.salesId}
                    className={cn(
                      'hover:bg-canvas/40 transition-colors',
                      !isActive && 'opacity-60',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-black">
                          {r.salesName.charAt(0)}
                        </span>
                        <span className="font-semibold text-slate-800 text-sm">{r.salesName}</span>
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
                        formatCompact(r.achievedAmount)
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.targetAmountPercent !== null ? (
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <span className={cn(
                            'text-[18px] font-black tabular-nums leading-none',
                            r.targetAmountPercent >= 80 ? 'text-emerald-700'
                            : r.targetAmountPercent >= 50 ? 'text-amber-600'
                            : 'text-slate-500',
                          )}>
                            {Math.round(r.targetAmountPercent)}%
                          </span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                r.targetAmountPercent >= 80 ? 'bg-emerald-500'
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

function PipelineCard({
  stageCount,
  total,
}: {
  stageCount: Record<string, number>;
  total:      number;
}) {
  const items = STAGE_META.map((s) => ({ ...s, count: stageCount[s.stage] ?? 0 }));

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-hairline bg-canvas/40">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">مسار المبيعات النشط</h3>
            <p className="text-2xs text-slate-400 mt-0.5">
              {total > 0
                ? `${total} فرصة مفتوحة عبر ${items.filter((s) => s.count > 0).length} مراحل`
                : 'لا توجد فرص مفتوحة'}
            </p>
          </div>
        </div>
        <Link href="/dashboard/leads" className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors">
          فتح الفرص
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="px-5 py-4">
        {total > 0 ? (
          <>
            <div className="flex rounded-full overflow-hidden h-2 mb-4 gap-px bg-slate-100">
              {items
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.stage}
                    className={cn('h-full', s.barCls)}
                    style={{ width: `${(s.count / total) * 100}%` }}
                    title={`${s.label}: ${s.count}`}
                  />
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {items.map((s) => (
                <div key={s.stage} className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', s.dotCls, s.count === 0 && 'opacity-30')} />
                  <span className={cn('text-xs text-slate-500 flex-1', s.count === 0 && 'opacity-50')}>{s.label}</span>
                  <span className={cn('text-xs font-black tabular-nums', s.count > 0 ? 'text-slate-800' : 'text-slate-200')}>
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">لا توجد فرص مفتوحة حالياً.</p>
        )}
      </div>
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alerts }: { alerts: ManagerAlert[] }) {
  const chipCls: Record<ManagerAlert['tone'], string> = {
    warning: 'bg-amber-100 text-amber-800 border border-amber-200',
    danger:  'bg-red-100   text-red-800   border border-red-200',
    info:    'bg-brand-100 text-brand-800 border border-brand-200',
  };

  return (
    <div className="bg-surface border border-amber-100 rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-amber-100 bg-amber-50/50">
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 rounded-lg bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center shrink-0">
            <Bell className="h-3.5 w-3.5 text-amber-600" />
            <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-800 leading-tight">تنبيهات الفريق</h3>
            <p className="text-2xs text-amber-600 mt-0.5">{alerts.length} بنود تحتاج مراجعة</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-amber-200 text-amber-800 text-xs font-black px-2 tabular-nums">
          {alerts.length}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {alerts.map((alert, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-3.5">
            <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5', chipCls[alert.tone])}>
              {alert.count !== undefined && (
                <span className="tabular-nums">{alert.count}</span>
              )}
              {alert.label}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-600 leading-snug">{alert.desc}</p>
              {alert.href && (
                <Link
                  href={alert.href as never}
                  className="text-2xs font-bold text-brand-700 hover:text-brand-800 transition-colors mt-1 inline-block"
                >
                  عرض التفاصيل
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manager Section Card ──────────────────────────────────────────────────────

function ManagerSection({
  title,
  icon,
  iconBg,
  href,
  hrefLabel = 'عرض الكل',
  className,
  children,
}: {
  title:      string;
  icon:       React.ReactNode;
  iconBg:     string;
  href:       string;
  hrefLabel?: string;
  className?: string;
  children:   React.ReactNode;
}) {
  return (
    <div className={cn('bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-hairline bg-canvas/40">
        <div className="flex items-center gap-2">
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
            {icon}
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
        </div>
        <Link
          href={href as never}
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors"
        >
          {hrefLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </div>
  );
}
