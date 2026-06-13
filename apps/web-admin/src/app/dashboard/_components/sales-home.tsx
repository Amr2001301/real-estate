import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Home,
  Wallet,
  CreditCard,
  Plus,
  CalendarPlus,
  Boxes,
  Building2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';

interface BonusEntryRow {
  id: string;
  amount: string | number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
}
interface PerformanceRow {
  signedContractsCount: number;
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

function expiryLabel(dateStr: string): string {
  const d = Math.ceil(daysUntil(dateStr));
  if (d <= 0) return 'ينتهي اليوم';
  if (d === 1) return 'ينتهي غداً';
  return `يتبقى ${d} أيام`;
}

function leadAgeDays(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000);
}

// ── Main component ──────────────────────────────────────────────────────────

export async function SalesDashboard({ userId }: { userId: string }) {
  const nowIso = new Date().toISOString();

  const [leadsRes, reservationsRes, visitsRes, unitsRes, bonusRes, perfRes] =
    await Promise.all([
      safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
      safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
      safe(
        api.get<Paged<VisitAppointment>>(
          `/visits/appointments?assignedSalesId=${userId}&scheduledFrom=${nowIso}&pageSize=50`,
        ),
      ),
      safe(api.get<Paged<unknown>>('/units?status=AVAILABLE&pageSize=1')),
      safe(api.get<BonusEntryRow[]>('/bonus-entries?status=PENDING')),
      safe(
        api.get<PerformanceRow[]>(
          `/sales-targets/performance?period=${nowIso.slice(0, 7)}`,
        ),
      ),
    ]);

  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits = (visitsRes.data?.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  // ── KPI computations ────────────────────────────────────────────────────
  const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
  const activeReservations = reservations.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const convertedDeals = reservations.filter((r) => r.status === 'CONVERTED').length;
  const signedThisMonth = (perfRes.data ?? [])[0]?.signedContractsCount;
  const closedDeals = signedThisMonth ?? convertedDeals;
  const availableUnits = unitsRes.data?.meta.total ?? 0;
  const pendingComp = (bonusRes.data ?? []).reduce(
    (sum, b) => sum + Number(b.amount ?? 0),
    0,
  );

  const staleLeadsCount = openLeads.filter(
    (l) => !l.upcomingVisit && leadAgeDays(l) >= 3,
  ).length;

  const expiringWithin7Count = reservations.filter((r) => {
    if (r.status === 'CONVERTED' || r.status === 'CANCELLED' || r.status === 'EXPIRED')
      return false;
    const d = daysUntil(r.expiresAt);
    return d >= 0 && d <= 7;
  }).length;

  // ── True today-priority items ────────────────────────────────────────────
  // Only items that literally require action today or tomorrow.
  // Old opportunities without visits are NOT today priorities.

  const todayVisits = visits.filter((v) => isToday(v.scheduledAt));

  const expiringUrgent = reservations.filter((r) => {
    if (r.status === 'CONVERTED' || r.status === 'CANCELLED' || r.status === 'EXPIRED')
      return false;
    const d = daysUntil(r.expiresAt);
    return d >= 0 && d < 2;
  });

  const hasTodayPriorities = todayVisits.length > 0 || expiringUrgent.length > 0;

  // ── Section rows ─────────────────────────────────────────────────────────
  const recentLeads = leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const upcomingVisitRows = visits.slice(0, 5);
  const activeReservationRows = activeReservations
    .slice()
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
    .slice(0, 5);

  // Hide empty visits/reservations cards entirely when both are empty
  // and no today-priority panel — leads card always shows.
  const showVisits = !visitsRes.error && upcomingVisitRows.length > 0;
  const showReservations = !reservationsRes.error && activeReservationRows.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="لوحة المبيعات"
        description="نظرة سريعة على فرصك، زياراتك، حجوزاتك، والعقود المتوقعة."
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
          </div>
        }
      />

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <PageKpiCard
          label="فرصي المفتوحة"
          value={openLeads.length}
          icon={<Users />}
          tone="brand"
        />
        <PageKpiCard
          label="متابعات مستحقة"
          value={staleLeadsCount}
          sub={staleLeadsCount > 0 ? 'بدون نشاط +3 أيام' : undefined}
          icon={<AlertCircle />}
          tone={staleLeadsCount > 0 ? 'warning' : 'neutral'}
        />
        <PageKpiCard
          label="زياراتي القادمة"
          value={visits.length}
          sub={todayVisits.length > 0 ? `اليوم: ${todayVisits.length}` : undefined}
          icon={<CalendarClock />}
          tone="neutral"
        />
        <PageKpiCard
          label="حجوزاتي قيد المتابعة"
          value={activeReservations.length}
          sub={expiringWithin7Count > 0 ? `${expiringWithin7Count} تنتهي قريباً` : undefined}
          icon={<BookmarkCheck />}
          tone={expiringWithin7Count > 0 ? 'warning' : 'success'}
        />
        <PageKpiCard
          label="عقود متوقعة هذا الشهر"
          value={closedDeals}
          sub={signedThisMonth !== undefined ? 'عقود موقّعة' : 'محوّلة إلى عقود'}
          icon={<FileText />}
          tone="info"
        />
        <PageKpiCard
          label="الوحدات المتاحة"
          value={availableUnits}
          icon={<Home />}
          tone="accent"
        />
      </div>

      {/* ── Quick access strip ───────────────────────────────────────────── */}
      <QuickAccessStrip
        links={[
          { href: '/dashboard/units',           label: 'تصفّح الوحدات',    icon: <Boxes className="h-3.5 w-3.5" />     },
          { href: '/dashboard/projects',        label: 'تصفّح المشاريع',   icon: <Building2 className="h-3.5 w-3.5" /> },
          { href: '/dashboard/contracts',       label: 'عرض العقود',       icon: <FileText className="h-3.5 w-3.5" />  },
          { href: '/dashboard/installments',    label: 'خطط التقسيط',     icon: <CreditCard className="h-3.5 w-3.5" />},
          { href: '/dashboard/my-compensation', label: 'مستحقاتي وأهدافي', icon: <Wallet className="h-3.5 w-3.5" />    },
        ]}
        trailingSlot={
          !bonusRes.error && pendingComp > 0 ? (
            <Link
              href="/dashboard/my-compensation"
              className="ms-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5" />
              {formatCurrency(pendingComp)} معلّق
            </Link>
          ) : undefined
        }
      />

      {/* ── أولويات اليوم (conditional — only when real items exist) ────── */}
      {hasTodayPriorities && (
        <TodayPriorityPanel
          todayVisits={todayVisits}
          expiringUrgent={expiringUrgent}
        />
      )}

      {/*
       * ── Content grid (asymmetric) ──────────────────────────────────────
       * When both side cards exist:
       *   [أحدث الفرص — 2/3] [زياراتي + حجوزاتي stacked — 1/3]
       * When one side card exists:
       *   [أحدث الفرص — 1/2] [the one card — 1/2]
       * When neither side card exists:
       *   [أحدث الفرص — constrained width]
       */}
      {showVisits && showReservations ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
          <SectionCard
            title="أحدث الفرص"
            href="/dashboard/leads"
            hrefLabel="فتح الفرص"
            emptyIcon={<Zap />}
            error={leadsRes.error}
            empty={recentLeads.length === 0}
            emptyText="لا توجد فرص حديثة."
            className="lg:col-span-2"
          >
            {recentLeads.map((l) => (
              <LeadRow key={l.id} lead={l} staleAfterDays={3} />
            ))}
          </SectionCard>

          {/* Side stack: visits on top, reservations below */}
          <div className="space-y-4">
            <SectionCard
              title="زياراتي القادمة"
              href="/dashboard/visits"
              hrefLabel="فتح الزيارات"
              emptyIcon={<CalendarClock />}
              error={visitsRes.error}
              empty={upcomingVisitRows.length === 0}
              emptyText="لا توجد زيارات قادمة."
            >
              {upcomingVisitRows.map((v) => (
                <VisitRow key={v.id} visit={v} />
              ))}
            </SectionCard>
            <SectionCard
              title="حجوزاتي النشطة"
              href="/dashboard/reservations"
              hrefLabel="فتح الحجوزات"
              emptyIcon={<BookmarkCheck />}
              error={reservationsRes.error}
              empty={activeReservationRows.length === 0}
              emptyText="لا توجد حجوزات نشطة."
            >
              {activeReservationRows.map((r) => (
                <ReservationRow key={r.id} reservation={r} />
              ))}
            </SectionCard>
          </div>
        </div>
      ) : showVisits || showReservations ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
          <SectionCard
            title="أحدث الفرص"
            href="/dashboard/leads"
            hrefLabel="فتح الفرص"
            emptyIcon={<Zap />}
            error={leadsRes.error}
            empty={recentLeads.length === 0}
            emptyText="لا توجد فرص حديثة."
          >
            {recentLeads.map((l) => (
              <LeadRow key={l.id} lead={l} staleAfterDays={3} />
            ))}
          </SectionCard>
          {showVisits && (
            <SectionCard
              title="زياراتي القادمة"
              href="/dashboard/visits"
              hrefLabel="فتح الزيارات"
              emptyIcon={<CalendarClock />}
              error={visitsRes.error}
              empty={upcomingVisitRows.length === 0}
              emptyText="لا توجد زيارات قادمة."
            >
              {upcomingVisitRows.map((v) => (
                <VisitRow key={v.id} visit={v} />
              ))}
            </SectionCard>
          )}
          {showReservations && (
            <SectionCard
              title="حجوزاتي النشطة"
              href="/dashboard/reservations"
              hrefLabel="فتح الحجوزات"
              emptyIcon={<BookmarkCheck />}
              error={reservationsRes.error}
              empty={activeReservationRows.length === 0}
              emptyText="لا توجد حجوزات نشطة."
            >
              {activeReservationRows.map((r) => (
                <ReservationRow key={r.id} reservation={r} />
              ))}
            </SectionCard>
          )}
        </div>
      ) : (
        /* Only leads — no side cards at all */
        <SectionCard
          title="أحدث الفرص"
          href="/dashboard/leads"
          hrefLabel="فتح الفرص"
          emptyIcon={<Zap />}
          error={leadsRes.error}
          empty={recentLeads.length === 0}
          emptyText="لا توجد فرص حديثة."
          className="max-w-2xl"
        >
          {recentLeads.map((l) => (
            <LeadRow key={l.id} lead={l} staleAfterDays={3} />
          ))}
        </SectionCard>
      )}
    </div>
  );
}

// ── Row sub-components ────────────────────────────────────────────────────

function LeadRow({
  lead: l,
  staleAfterDays = 3,
}: {
  lead: Lead;
  staleAfterDays?: number;
}) {
  const age = leadAgeDays(l);
  const isStale = !l.upcomingVisit && age >= staleAfterDays;
  return (
    <Link
      href={`/dashboard/leads/${l.id}` as never}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate leading-tight">
            {l.client?.fullName ?? l.fullName}
          </p>
          {isStale && (
            <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-amber-50 text-amber-700">
              متأخر
            </span>
          )}
        </div>
        <p className="text-2xs text-slate-400 truncate mt-0.5 leading-tight">
          {l.projectInterest ? tx(l.projectInterest.name) : 'بدون مشروع'}
          {' · '}
          {formatDate(l.createdAt)}
        </p>
      </div>
      <LeadStageBadge stage={l.stage} />
    </Link>
  );
}

function VisitRow({ visit: v }: { visit: VisitAppointment }) {
  const today = isToday(v.scheduledAt);
  return (
    <Link
      href={`/dashboard/visits/appointments/${v.id}` as never}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate leading-tight">
            {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
          </p>
          {today && (
            <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700">
              اليوم
            </span>
          )}
        </div>
        <p className="text-2xs text-slate-400 mt-0.5 leading-tight">
          <span className={cn('tabular-nums', today && 'font-semibold text-brand-700')}>
            {formatDateTime(v.scheduledAt)}
          </span>
          {v.project ? ` · ${tx(v.project.name)}` : ''}
        </p>
      </div>
      <AppointmentStatusBadge status={v.status} />
    </Link>
  );
}

function ReservationRow({ reservation: r }: { reservation: Reservation }) {
  const remaining = Math.ceil(daysUntil(r.expiresAt));
  const isUrgent = remaining <= 1;
  const isWarning = remaining <= 7 && remaining > 1;
  return (
    <Link
      href={`/dashboard/reservations/${r.id}` as never}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate leading-tight">
          {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
          {r.unit?.code ? ` · ${r.unit.code}` : ''}
        </p>
        <p
          className={cn(
            'text-2xs mt-0.5 leading-tight tabular-nums',
            isUrgent ? 'font-semibold text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
          )}
        >
          {expiryLabel(r.expiresAt)}
        </p>
      </div>
      <ReservationStatusBadge status={r.status} />
    </Link>
  );
}

// ── Quick access strip (exported — shared with Sales Manager) ─────────────

export function QuickAccessStrip({
  links,
  trailingSlot,
}: {
  links: { href: string; label: string; icon: React.ReactNode }[];
  trailingSlot?: React.ReactNode;
}) {
  return (
    <Card className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-slate-400 pe-2 border-e border-hairline me-0.5">
          وصول سريع
        </span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href as never}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-muted/60 ring-1 ring-inset ring-hairline px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-muted hover:text-brand-700 transition-colors"
          >
            <span className="text-slate-400">{l.icon}</span>
            {l.label}
          </Link>
        ))}
        {trailingSlot}
      </div>
    </Card>
  );
}

// ── Today priority panel ──────────────────────────────────────────────────

function TodayPriorityPanel({
  todayVisits,
  expiringUrgent,
}: {
  todayVisits: VisitAppointment[];
  expiringUrgent: Reservation[];
}) {
  const total = todayVisits.length + expiringUrgent.length;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-hairline">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <h3 className="text-sm font-semibold text-slate-900 flex-1">أولويات اليوم</h3>
        <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-amber-50 text-amber-700 text-2xs font-bold px-1.5">
          {total}
        </span>
      </div>

      {todayVisits.length > 0 && (
        <>
          <PrioritySectionHeader
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            title="زياراتي اليوم"
            count={todayVisits.length}
          />
          {todayVisits.map((v) => (
            <Link
              key={v.id}
              href={`/dashboard/visits/appointments/${v.id}` as never}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors border-t border-hairline"
            >
              <div className="shrink-0 h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center">
                <CalendarClock className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-brand-700 tabular-nums">
                    {formatDateTime(v.scheduledAt)}
                  </span>
                  {v.project ? ` · ${tx(v.project.name)}` : ''}
                  {v.unit ? ` · وحدة ${v.unit.code}` : ''}
                </p>
              </div>
              <AppointmentStatusBadge status={v.status} />
            </Link>
          ))}
        </>
      )}

      {expiringUrgent.length > 0 && (
        <>
          <PrioritySectionHeader
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            title="حجوزات تنتهي اليوم أو غداً"
            count={expiringUrgent.length}
          />
          {expiringUrgent.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/reservations/${r.id}` as never}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/40 transition-colors border-t border-hairline"
            >
              <div className="shrink-0 h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <BookmarkCheck className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                  {r.unit?.code ? ` · وحدة ${r.unit.code}` : ''}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  {r.lead?.fullName ?? r.client?.fullName ?? '—'}
                  {' · '}
                  <span className="font-semibold text-red-600">{expiryLabel(r.expiresAt)}</span>
                </p>
              </div>
              <ReservationStatusBadge status={r.status} />
            </Link>
          ))}
        </>
      )}
    </Card>
  );
}

function PrioritySectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50/70 border-t border-hairline">
      <span className="text-slate-400">{icon}</span>
      <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500 flex-1">
        {title}
      </span>
      <span className="text-2xs font-bold tabular-nums text-slate-400">{count}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  href,
  hrefLabel = 'عرض الكل',
  error,
  empty,
  emptyText,
  emptyIcon,
  className,
  children,
}: {
  title: string;
  href: string;
  hrefLabel?: string;
  error?: string | null;
  empty: boolean;
  emptyText: string;
  emptyIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
        {/* No arrow — text-only CTA */}
        <Link
          href={href as never}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        >
          {hrefLabel}
        </Link>
      </div>
      {error ? (
        <div className="flex items-start gap-2 text-warning-700 text-xs px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل هذا القسم.</p>
        </div>
      ) : empty ? (
        <div className="flex items-center gap-2 px-4 py-3 text-slate-400">
          <span className="h-3.5 w-3.5 shrink-0">{emptyIcon ?? <Users />}</span>
          <p className="text-xs">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </Card>
  );
}
