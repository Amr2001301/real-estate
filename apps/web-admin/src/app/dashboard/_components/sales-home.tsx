import Link from 'next/link';
import {
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
  Bell,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
} from '@/components/premium';

interface BonusEntryRow {
  id: string;
  amount: string | number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
}
interface PerformanceRow {
  signedContractsCount: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

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

function expiryLabel(dateStr: string): string {
  const d = Math.ceil(daysUntil(dateStr));
  if (d <= 0) return 'ينتهي اليوم';
  if (d === 1) return 'ينتهي غداً';
  return `يتبقى ${d} أيام`;
}

function leadAgeDays(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000);
}

// ── Design helpers ────────────────────────────────────────────────────────────

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

  const leads        = leadsRes.data?.data        ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits       = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // ── KPI computations ──────────────────────────────────────────────────────
  const openLeads          = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
  const activeReservations = reservations.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const convertedDeals     = reservations.filter((r) => r.status === 'CONVERTED').length;
  const signedThisMonth    = (perfRes.data ?? [])[0]?.signedContractsCount;
  const closedDeals        = signedThisMonth ?? convertedDeals;
  const availableUnits     = unitsRes.data?.meta.total ?? 0;
  const pendingComp        = (bonusRes.data ?? []).reduce(
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

  const todayVisits = visits.filter((v) => isToday(v.scheduledAt));

  const expiringUrgent = reservations.filter((r) => {
    if (r.status === 'CONVERTED' || r.status === 'CANCELLED' || r.status === 'EXPIRED')
      return false;
    const d = daysUntil(r.expiresAt);
    return d >= 0 && d < 2;
  });

  const hasTodayPriorities = todayVisits.length > 0 || expiringUrgent.length > 0;

  // ── Section rows ──────────────────────────────────────────────────────────
  const recentLeads = leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const upcomingVisitRows    = visits.slice(0, 5);
  const activeReservationRows = activeReservations
    .slice()
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
    .slice(0, 5);

  const showVisits       = !visitsRes.error       && upcomingVisitRows.length    > 0;
  const showReservations = !reservationsRes.error  && activeReservationRows.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="لوحة المبيعات"
        description="نظرة سريعة على فرصك، زياراتك، حجوزاتك، والعقود المتوقعة."
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
          </div>
        }
      />

      {/* ── Metric strip ──────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        metrics={[
          {
            label:    'فرصي المفتوحة',
            value:    openLeads.length,
            sub:      staleLeadsCount > 0 ? `${staleLeadsCount} تحتاج متابعة` : 'كلها في الوقت',
            icon:     <Zap />,
            tone:     'brand',
          },
          {
            label:    'متابعات مستحقة',
            value:    staleLeadsCount,
            sub:      staleLeadsCount > 0 ? 'بدون نشاط +3 أيام' : 'لا متابعات متأخرة',
            icon:     <AlertTriangle />,
            tone:     staleLeadsCount > 0 ? 'warning' : 'success',
          },
          {
            label:    'زياراتي القادمة',
            value:    visits.length,
            sub:      todayVisits.length > 0 ? `${todayVisits.length} اليوم` : 'لا زيارات اليوم',
            icon:     <CalendarClock />,
            tone:     'info',
          },
          {
            label:    'حجوزاتي النشطة',
            value:    activeReservations.length,
            sub:      expiringWithin7Count > 0 ? `${expiringWithin7Count} تنتهي قريباً` : 'لا حجوزات تنتهي قريباً',
            icon:     <BookmarkCheck />,
            tone:     expiringWithin7Count > 0 ? 'warning' : 'success',
          },
          {
            label:    'عقود هذا الشهر',
            value:    closedDeals,
            sub:      signedThisMonth !== undefined ? 'عقود موقّعة' : 'محوّلة إلى عقود',
            icon:     <FileText />,
            tone:     'purple',
          },
          {
            label:    'الوحدات المتاحة',
            value:    availableUnits,
            sub:      'جاهزة للعرض',
            icon:     <Home />,
            tone:     'teal',
          },
        ]}
      />

      {/* ── Quick Access ──────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>وصول سريع</SectionLabel>
        <QuickAccessStrip
          links={[
            { href: '/dashboard/units',           label: 'تصفّح الوحدات',    icon: <Boxes className="h-3.5 w-3.5" />      },
            { href: '/dashboard/projects',        label: 'تصفّح المشاريع',   icon: <Building2 className="h-3.5 w-3.5" />   },
            { href: '/dashboard/contracts',       label: 'عرض العقود',       icon: <FileText className="h-3.5 w-3.5" />    },
            { href: '/dashboard/installments',    label: 'خطط التقسيط',     icon: <CreditCard className="h-3.5 w-3.5" />  },
            { href: '/dashboard/my-compensation', label: 'مستحقاتي وأهدافي', icon: <Wallet className="h-3.5 w-3.5" />      },
          ]}
          trailingSlot={
            !bonusRes.error && pendingComp > 0 ? (
              <Link
                href="/dashboard/my-compensation"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                {formatCurrency(pendingComp)} معلّق
              </Link>
            ) : undefined
          }
        />
      </div>

      {/* ── أولويات اليوم ─────────────────────────────────────────────────── */}
      {hasTodayPriorities && (
        <div className="space-y-2.5">
          <SectionLabel>أولويات اليوم</SectionLabel>
          <TodayPriorityPanel
            todayVisits={todayVisits}
            expiringUrgent={expiringUrgent}
          />
        </div>
      )}

      {/* ── Content grid ──────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>نشاطي الحالي</SectionLabel>
        {showVisits && showReservations ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
            <SectionCard
              title="أحدث الفرص"
              icon={<Zap className="h-3.5 w-3.5 text-brand-600" />}
              iconBg="bg-brand-50"
              href="/dashboard/leads"
              hrefLabel="فتح الفرص"
              error={leadsRes.error}
              empty={recentLeads.length === 0}
              emptyText="لا توجد فرص حديثة."
              className="lg:col-span-2"
            >
              {recentLeads.map((l) => (
                <LeadRow key={l.id} lead={l} staleAfterDays={3} />
              ))}
            </SectionCard>

            <div className="space-y-4">
              <SectionCard
                title="زياراتي القادمة"
                icon={<CalendarClock className="h-3.5 w-3.5 text-blue-600" />}
                iconBg="bg-blue-50"
                href="/dashboard/visits"
                hrefLabel="فتح الزيارات"
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
                icon={<BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" />}
                iconBg="bg-emerald-50"
                href="/dashboard/reservations"
                hrefLabel="فتح الحجوزات"
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
              icon={<Zap className="h-3.5 w-3.5 text-brand-600" />}
              iconBg="bg-brand-50"
              href="/dashboard/leads"
              hrefLabel="فتح الفرص"
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
                icon={<CalendarClock className="h-3.5 w-3.5 text-blue-600" />}
                iconBg="bg-blue-50"
                href="/dashboard/visits"
                hrefLabel="فتح الزيارات"
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
                icon={<BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" />}
                iconBg="bg-emerald-50"
                href="/dashboard/reservations"
                hrefLabel="فتح الحجوزات"
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
          <SectionCard
            title="أحدث الفرص"
            icon={<Zap className="h-3.5 w-3.5 text-brand-600" />}
            iconBg="bg-brand-50"
            href="/dashboard/leads"
            hrefLabel="فتح الفرص"
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
    </div>
  );
}

// ── Row sub-components ────────────────────────────────────────────────────────

function LeadRow({ lead: l, staleAfterDays = 3 }: { lead: Lead; staleAfterDays?: number }) {
  const age     = leadAgeDays(l);
  const isStale = !l.upcomingVisit && age >= staleAfterDays;
  return (
    <Link
      href={`/dashboard/leads/${l.id}` as never}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
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
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
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
  const isUrgent  = remaining <= 1;
  const isWarning = remaining <= 7 && remaining > 1;
  return (
    <Link
      href={`/dashboard/reservations/${r.id}` as never}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate leading-tight">
          {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
          {r.unit?.code ? ` · ${r.unit.code}` : ''}
        </p>
        <p className={cn(
          'text-2xs mt-0.5 leading-tight tabular-nums',
          isUrgent ? 'font-semibold text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
        )}>
          {expiryLabel(r.expiresAt)}
        </p>
      </div>
      <ReservationStatusBadge status={r.status} />
    </Link>
  );
}

// ── Quick Access Strip (exported — shared with Sales Manager) ─────────────────

export function QuickAccessStrip({
  links,
  trailingSlot,
}: {
  links: { href: string; label: string; icon: React.ReactNode }[];
  trailingSlot?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex flex-wrap gap-px bg-hairline">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href as never}
            className="bg-surface flex-1 min-w-[80px] flex flex-col items-center gap-2 px-3 py-3.5 hover:bg-canvas/60 transition-colors group"
          >
            <span className={cn(
              'h-8 w-8 rounded-xl flex items-center justify-center',
              'bg-canvas/80 border border-hairline',
              '[&_svg]:h-3.5 [&_svg]:w-3.5 text-slate-400',
              'group-hover:bg-brand-50 group-hover:border-brand-100 group-hover:text-brand-600',
              'transition-colors',
            )}>
              {l.icon}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 group-hover:text-brand-700 transition-colors text-center leading-tight">
              {l.label}
            </span>
          </Link>
        ))}
        {trailingSlot && (
          <div className="bg-surface flex items-center justify-center px-5 py-3.5 border-s border-hairline">
            {trailingSlot}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Today priority panel ──────────────────────────────────────────────────────

function TodayPriorityPanel({
  todayVisits,
  expiringUrgent,
}: {
  todayVisits:     VisitAppointment[];
  expiringUrgent:  Reservation[];
}) {
  const total = todayVisits.length + expiringUrgent.length;

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-hairline bg-amber-50/40">
        <div className="relative shrink-0">
          <Bell className="h-4 w-4 text-amber-600" />
          <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 flex-1">أولويات اليوم</h3>
        <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-amber-100 text-amber-800 text-2xs font-black px-1.5 tabular-nums">
          {total}
        </span>
      </div>

      {todayVisits.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-5 py-1.5 bg-canvas/50 border-t border-hairline">
            <CalendarClock className="h-3.5 w-3.5 text-brand-500" />
            <span className="text-2xs font-bold uppercase tracking-wide text-slate-500 flex-1">زياراتي اليوم</span>
            <span className="text-2xs font-black text-slate-400 tabular-nums">{todayVisits.length}</span>
          </div>
          {todayVisits.map((v) => (
            <Link
              key={v.id}
              href={`/dashboard/visits/appointments/${v.id}` as never}
              className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60 transition-colors border-t border-hairline"
            >
              <div className="shrink-0 h-7 w-7 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                <CalendarClock className="h-3.5 w-3.5 text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  <span className="font-bold text-brand-700 tabular-nums">{formatDateTime(v.scheduledAt)}</span>
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
          <div className="flex items-center gap-2 px-5 py-1.5 bg-canvas/50 border-t border-hairline">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-2xs font-bold uppercase tracking-wide text-slate-500 flex-1">حجوزات تنتهي اليوم أو غداً</span>
            <span className="text-2xs font-black text-red-500 tabular-nums">{expiringUrgent.length}</span>
          </div>
          {expiringUrgent.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/reservations/${r.id}` as never}
              className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60 transition-colors border-t border-hairline"
            >
              <div className="shrink-0 h-7 w-7 rounded-xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center">
                <BookmarkCheck className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                  {r.unit?.code ? ` · وحدة ${r.unit.code}` : ''}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  {r.lead?.fullName ?? r.client?.fullName ?? '—'}
                  {' · '}
                  <span className="font-bold text-red-600">{expiryLabel(r.expiresAt)}</span>
                </p>
              </div>
              <ReservationStatusBadge status={r.status} />
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  iconBg,
  href,
  hrefLabel = 'عرض الكل',
  error,
  empty,
  emptyText,
  className,
  children,
}: {
  title:      string;
  icon:       React.ReactNode;
  iconBg:     string;
  href:       string;
  hrefLabel?: string;
  error?:     string | null;
  empty:      boolean;
  emptyText:  string;
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
      {error ? (
        <div className="flex items-start gap-2 text-amber-700 text-xs px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تعذّر تحميل هذا القسم.</p>
        </div>
      ) : empty ? (
        <div className="flex items-center gap-2.5 px-5 py-4">
          <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
          <p className="text-xs text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </div>
  );
}
