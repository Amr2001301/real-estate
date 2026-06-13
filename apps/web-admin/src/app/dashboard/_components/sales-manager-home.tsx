import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Banknote,
  Target,
  AlertCircle,
  Plus,
  CalendarPlus,
  Wallet,
  AlertTriangle,
  Building2,
  Boxes,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import { QuickAccessStrip } from './sales-home';

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

interface ManagerAlert {
  label: string;
  desc: string;
  count?: number;
  href?: string;
  tone: 'warning' | 'danger' | 'info';
}

const STAGE_META = [
  { stage: 'NEW',         label: 'جديدة',      barCls: 'bg-slate-300', dotCls: 'bg-slate-400' },
  { stage: 'CONTACTED',   label: 'تم التواصل', barCls: 'bg-brand-200', dotCls: 'bg-brand-400' },
  { stage: 'QUALIFIED',   label: 'مؤهلة',      barCls: 'bg-sky-300',   dotCls: 'bg-sky-500'   },
  { stage: 'PROPOSAL',    label: 'عرض مقدم',   barCls: 'bg-amber-300', dotCls: 'bg-amber-500' },
  { stage: 'NEGOTIATION', label: 'تفاوض',      barCls: 'bg-brand-500', dotCls: 'bg-brand-600' },
] as const;

// ── Percent helpers ─────────────────────────────────────────────────────────

function pctDisplay(value: number | null): string {
  if (value === null) return '—';
  if (value > 999) return '+999%';
  return `${value}%`;
}

function pctSub(value: number | null): string | undefined {
  if (value === null || value < 100) return undefined;
  return value > 200 ? 'أعلى من الهدف بكثير' : 'تجاوز الهدف';
}

function pctTableDisplay(value: number | null): string {
  if (value === null) return '—';
  if (value > 999) return '+999%';
  return `${value}%`;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 86400000;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── Main component ──────────────────────────────────────────────────────────

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

  const perf = perfRes.data ?? [];
  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits = (visitsRes.data?.data ?? [])
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
  const teamAmountPct =
    teamTargetAmount > 0
      ? Math.round((teamRealized / teamTargetAmount) * 100)
      : null;

  // ── Pipeline distribution ─────────────────────────────────────────────────
  const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
  const pipelineTotal = openLeads.length;
  const pipelineStageCount = openLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});
  // Pipeline is only worth showing when ≥2 stages have data — a single bar
  // adds no distribution value (the KPI card already shows the total count).
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
      label: 'حجوزات تنتهي قريباً',
      desc: `${teamExpiringCount} حجز ينتهي خلال 7 أيام — يحتاج متابعة فورية.`,
      count: teamExpiringCount,
      href: '/dashboard/reservations',
      tone: 'warning',
    });
  }
  if (teamPendingCount > 0) {
    managerAlerts.push({
      label: 'حجوزات بانتظار الموافقة',
      desc: `${teamPendingCount} حجز لم تتم مراجعته بعد.`,
      count: teamPendingCount,
      href: '/dashboard/reservations',
      tone: 'info',
    });
  }
  if (inactiveReps.length > 0) {
    managerAlerts.push({
      label: 'مندوبون بدون نشاط هذا الشهر',
      desc:
        inactiveReps
          .slice(0, 3)
          .map((r) => r.salesName)
          .join('، ') +
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

  // Hide empty bottom cards entirely — no blank panels
  const showVisits       = !visitsRes.error       && upcomingVisitRows.length > 0;
  const showReservations = !reservationsRes.error  && activeReservationRows.length > 0;
  const showLeads        = !leadsRes.error         && recentLeads.length > 0;
  const bottomCount      = [showVisits, showReservations, showLeads].filter(Boolean).length;

  // ── Manager quick links ───────────────────────────────────────────────────
  const managerQuickLinks = [
    { href: '/dashboard/leads',           label: 'الفرص',     icon: <Zap className="h-3.5 w-3.5" />          },
    { href: '/dashboard/visits',          label: 'الزيارات',  icon: <CalendarClock className="h-3.5 w-3.5" /> },
    { href: '/dashboard/reservations',    label: 'الحجوزات',  icon: <BookmarkCheck className="h-3.5 w-3.5" /> },
    { href: '/dashboard/contracts',       label: 'العقود',    icon: <FileText className="h-3.5 w-3.5" />      },
    { href: '/dashboard/targets',         label: 'الأهداف',   icon: <Target className="h-3.5 w-3.5" />        },
    { href: '/dashboard/my-compensation', label: 'المستحقات', icon: <Wallet className="h-3.5 w-3.5" />        },
    { href: '/dashboard/projects',        label: 'المشاريع',  icon: <Building2 className="h-3.5 w-3.5" />     },
    { href: '/dashboard/units',           label: 'الوحدات',   icon: <Boxes className="h-3.5 w-3.5" />         },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="لوحة مدير المبيعات"
        description="متابعة أداء فريق المبيعات، الفرص، الزيارات، الحجوزات، وتحقيق الأهداف."
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

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard
          label="إجمالي فرص الفريق"
          value={leadsRes.error ? '—' : teamLeads}
          icon={<Users />}
          tone="brand"
        />
        <PageKpiCard
          label="فرص مفتوحة"
          value={perfRes.error ? '—' : teamOpenLeads}
          icon={<Zap />}
          tone="accent"
        />
        <PageKpiCard
          label="زيارات قادمة للفريق"
          value={perfRes.error ? '—' : teamUpcomingVisits}
          icon={<CalendarClock />}
          tone="neutral"
        />
        <PageKpiCard
          label="حجوزات نشطة"
          value={perfRes.error ? '—' : teamActiveReservations}
          icon={<BookmarkCheck />}
          tone="success"
        />
        <PageKpiCard
          label="عقود موقّعة هذا الشهر"
          value={perfRes.error ? '—' : teamSigned}
          icon={<FileText />}
          tone="info"
        />
        <PageKpiCard
          label="القيمة المحققة هذا الشهر"
          value={perfRes.error ? '—' : formatCurrency(teamRealized)}
          icon={<Banknote />}
          tone="success"
        />
        <PageKpiCard
          label="تحقيق الهدف المالي"
          value={perfRes.error ? '—' : pctDisplay(teamAmountPct)}
          sub={perfRes.error ? undefined : pctSub(teamAmountPct)}
          icon={<Target />}
          tone={
            teamAmountPct === null ? 'neutral'
              : teamAmountPct >= 80 ? 'success'
              : teamAmountPct >= 50 ? 'warning'
              : 'brand'
          }
        />
        <PageKpiCard
          label="تنبيهات الفريق"
          value={managerAlerts.length}
          sub={managerAlerts.length > 0 ? 'انقر للاطلاع' : 'لا شيء الآن'}
          icon={<AlertTriangle />}
          tone={managerAlerts.length > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* ── Quick access strip ───────────────────────────────────────────── */}
      <QuickAccessStrip links={managerQuickLinks} />

      {/* ── Pipeline strip (only when ≥2 stages active) ───────────────────── */}
      {!leadsRes.error && pipelineMeaningful && (
        <PipelineStrip stageCount={pipelineStageCount} total={pipelineTotal} />
      )}

      {/*
       * ── Compact alert strip (only when real alerts exist) ─────────────────
       * Rendered as a slim horizontal bar above the table — not a side card.
       * A single alert does not justify an entire 1/3-width column.
       */}
      {managerAlerts.length > 0 && (
        <AlertStrip alerts={managerAlerts} />
      )}

      {/* ── Team performance table — always full-width hero ───────────────── */}
      <TeamPerformanceTable
        perfError={perfRes.error}
        repRows={repRows}
        period={period}
      />

      {/*
       * ── Bottom cards (asymmetric) ─────────────────────────────────────────
       * أحدث الفرص is the main wide card (most rows).
       * زيارات + حجوزات stack vertically in the narrower side column.
       * Empty cards are hidden entirely — no blank panels.
       *
       * Layout:
       *   Leads + any side cards  → [leads 2/3] [side-stack 1/3]
       *   Only one side card      → [leads 1/2] [card 1/2]
       *   Only leads              → leads constrained width
       *   No leads, side cards    → equal columns
       */}
      {bottomCount > 0 && (
        showLeads && (showVisits || showReservations) ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
            {/* Main: leads takes 2/3 */}
            <ManagerSection
              title="أحدث الفرص"
              href="/dashboard/leads"
              hrefLabel="فتح الفرص"
              className="lg:col-span-2"
            >
              {recentLeads.map((l) => (
                <Link
                  key={l.id}
                  href={`/dashboard/leads/${l.id}` as never}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
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

            {/* Side stack: visits on top, reservations below */}
            <div className="space-y-4">
              {showVisits && (
                <ManagerSection
                  title="زيارات قادمة للفريق"
                  href="/dashboard/visits"
                  hrefLabel="فتح الزيارات"
                >
                  {upcomingVisitRows.map((v) => (
                    <Link
                      key={v.id}
                      href={`/dashboard/visits/appointments/${v.id}` as never}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
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
                  href="/dashboard/reservations"
                  hrefLabel="فتح الحجوزات"
                >
                  {activeReservationRows.map((r) => {
                    const rem = Math.ceil(daysUntil(r.expiresAt));
                    const isUrgent  = rem <= 1;
                    const isWarning = rem > 1 && rem <= 7;
                    return (
                      <Link
                        key={r.id}
                        href={`/dashboard/reservations/${r.id}` as never}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
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
                                <span
                                  className={cn(
                                    'tabular-nums font-medium',
                                    isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
                                  )}
                                >
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
          /* Leads only, no side cards */
          <ManagerSection
            title="أحدث الفرص"
            href="/dashboard/leads"
            hrefLabel="فتح الفرص"
            className="max-w-2xl"
          >
            {recentLeads.map((l) => (
              <Link
                key={l.id}
                href={`/dashboard/leads/${l.id}` as never}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
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
          /* No leads — only side cards, equal columns */
          <div className={cn('grid grid-cols-1 gap-4 lg:items-start', showVisits && showReservations ? 'lg:grid-cols-2' : '')}>
            {showVisits && (
              <ManagerSection
                title="زيارات قادمة للفريق"
                href="/dashboard/visits"
                hrefLabel="فتح الزيارات"
              >
                {upcomingVisitRows.map((v) => (
                  <Link
                    key={v.id}
                    href={`/dashboard/visits/appointments/${v.id}` as never}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
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
                href="/dashboard/reservations"
                hrefLabel="فتح الحجوزات"
              >
                {activeReservationRows.map((r) => {
                  const rem = Math.ceil(daysUntil(r.expiresAt));
                  const isUrgent  = rem <= 1;
                  const isWarning = rem > 1 && rem <= 7;
                  return (
                    <Link
                      key={r.id}
                      href={`/dashboard/reservations/${r.id}` as never}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
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
                              <span
                                className={cn(
                                  'tabular-nums font-medium',
                                  isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
                                )}
                              >
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
        )
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TeamPerformanceTable({
  perfError,
  repRows,
  period,
  className = '',
}: {
  perfError?: string | null;
  repRows: PerformanceRow[];
  period: string;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-hairline">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            أداء فريق المبيعات
          </h3>
          {repRows.length > 0 && (
            <p className="text-2xs text-slate-400 mt-0.5">
              {repRows.length} مندوب · {period}
            </p>
          )}
        </div>
        <Link
          href={'/dashboard/targets' as never}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        >
          إدارة الأهداف
        </Link>
      </div>

      {perfError ? (
        <div className="flex items-start gap-2 text-warning-700 text-sm px-5 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل هذا القسم.</p>
        </div>
      ) : repRows.length === 0 ? (
        <EmptyState icon={<Users />} title="لا يوجد مندوبو مبيعات بعد" className="py-8" />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
              <tr>
                <th className="px-5 py-2.5 text-start font-semibold">المندوب</th>
                <th className="px-3 py-2.5 text-start font-semibold whitespace-nowrap">الحالة</th>
                <th className="px-3 py-2.5 text-end font-semibold whitespace-nowrap">الفرص</th>
                <th className="px-3 py-2.5 text-end font-semibold whitespace-nowrap">الزيارات</th>
                <th className="px-3 py-2.5 text-end font-semibold whitespace-nowrap">الحجوزات</th>
                <th className="px-3 py-2.5 text-end font-semibold whitespace-nowrap">عقود</th>
                <th className="px-4 py-2.5 text-end font-semibold whitespace-nowrap">القيمة المحققة</th>
                <th className="px-4 py-2.5 text-start font-semibold whitespace-nowrap">تحقيق الهدف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {repRows.map((r) => {
                const isActive = r.leadsCount > 0 || r.visitsCount > 0 || r.reservationsCount > 0;
                return (
                  <tr
                    key={r.salesId}
                    className={cn(
                      'hover:bg-surface-muted/40 transition-colors',
                      !isActive && 'opacity-70',
                    )}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">
                          {r.salesName.charAt(0)}
                        </span>
                        <span className="font-medium text-slate-800 text-sm">{r.salesName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {isActive ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-emerald-50 text-emerald-700">
                          نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-slate-100 text-slate-500">
                          غير نشط
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600 text-end">{r.leadsCount}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600 text-end">{r.visitsCount}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600 text-end">{r.reservationsCount}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600 text-end">{r.signedContractsCount}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-800 whitespace-nowrap text-end">
                      {r.achievedAmount > 0 ? (
                        formatCurrency(r.achievedAmount)
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1 min-w-[72px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'text-xs font-semibold tabular-nums',
                              r.targetAmountPercent !== null && r.targetAmountPercent >= 80
                                ? 'text-emerald-700'
                                : r.targetAmountPercent !== null && r.targetAmountPercent >= 50
                                ? 'text-amber-600'
                                : 'text-slate-500',
                            )}
                          >
                            {pctTableDisplay(r.targetAmountPercent)}
                          </span>
                          {r.targetAmountPercent !== null && r.targetAmountPercent > 100 && (
                            <span className="text-2xs text-emerald-600 font-medium">↑</span>
                          )}
                        </div>
                        {r.targetAmountPercent !== null && (
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                r.targetAmountPercent >= 80
                                  ? 'bg-emerald-500'
                                  : r.targetAmountPercent >= 50
                                  ? 'bg-amber-400'
                                  : 'bg-slate-300',
                              )}
                              style={{ width: `${Math.min(r.targetAmountPercent, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PipelineStrip({
  stageCount,
  total,
}: {
  stageCount: Record<string, number>;
  total: number;
}) {
  const items = STAGE_META.map((s) => ({ ...s, count: stageCount[s.stage] ?? 0 }));

  return (
    <Card className="px-5 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">مسار المبيعات النشط</h3>
          <p className="text-2xs text-slate-500 mt-0.5">
            {total > 0
              ? `${total} فرصة مفتوحة عبر ${items.filter((s) => s.count > 0).length} مراحل`
              : 'لا توجد فرص مفتوحة حالياً'}
          </p>
        </div>
        <Link
          href={'/dashboard/leads' as never}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        >
          فتح الفرص
        </Link>
      </div>

      {total > 0 ? (
        <>
          <div className="flex rounded-full overflow-hidden h-2 mb-3 gap-px">
            {items
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.stage}
                  className={s.barCls}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map((s) => (
              <div key={s.stage} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    s.dotCls,
                    s.count === 0 && 'opacity-30',
                  )}
                />
                <span className={cn('text-xs text-slate-500', s.count === 0 && 'opacity-50')}>
                  {s.label}
                </span>
                <span
                  className={cn(
                    'text-xs font-bold tabular-nums',
                    s.count > 0 ? 'text-slate-800' : 'text-slate-300',
                  )}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">لا توجد فرص مفتوحة حالياً.</p>
      )}
    </Card>
  );
}

/**
 * Compact horizontal alert strip — used instead of a full side-card column.
 * Each alert appears as an inline chip so even 1 alert doesn't waste a column.
 */
function AlertStrip({ alerts }: { alerts: ManagerAlert[] }) {
  const chipCls: Record<ManagerAlert['tone'], string> = {
    warning: 'bg-amber-100 text-amber-800',
    danger:  'bg-red-100 text-red-800',
    info:    'bg-brand-100 text-brand-800',
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-amber-800">تنبيهات الفريق</span>
        <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-amber-200 text-amber-800 text-2xs font-bold px-1 tabular-nums">
          {alerts.length}
        </span>
      </div>
      <span className="text-amber-200 select-none shrink-0">|</span>
      {alerts.map((alert, i) => (
        <span key={i} className="flex items-center gap-1.5 flex-wrap">
          {i > 0 && <span className="text-amber-300 shrink-0">·</span>}
          <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium', chipCls[alert.tone])}>
            {alert.count !== undefined && (
              <span className="tabular-nums font-bold">{alert.count}</span>
            )}
            {alert.label}
          </span>
          <span className="text-2xs text-amber-700 truncate max-w-xs">{alert.desc}</span>
          {alert.href && (
            <Link
              href={alert.href as never}
              className="text-2xs font-semibold text-brand-700 hover:text-brand-800 transition-colors shrink-0"
            >
              فتح
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}

function ManagerSection({
  title,
  href,
  hrefLabel = 'عرض الكل',
  className,
  children,
}: {
  title: string;
  href: string;
  hrefLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
        <Link
          href={href as never}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        >
          {hrefLabel}
        </Link>
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </Card>
  );
}
