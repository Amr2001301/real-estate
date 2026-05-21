import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Home,
  Wallet,
  Plus,
  CalendarPlus,
  Boxes,
  Building2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
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

interface BonusEntryRow {
  id: string;
  amount: string | number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
}

/**
 * Sales-focused dashboard home. Every data source is an endpoint SALES is
 * allowed to call, and the list endpoints (/leads, /reservations) already
 * self-scope to the authenticated sales user. Visits are scoped explicitly by
 * assignedSalesId. No ADMIN-only report endpoints are used, so the page never
 * 403s on load.
 */
export async function SalesDashboard({ userId }: { userId: string }) {
  const nowIso = new Date().toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [leadsRes, reservationsRes, visitsRes, unitsRes, bonusRes] =
    await Promise.all([
      // /leads self-scopes to the SALES user's assigned leads.
      safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
      // /reservations self-scopes to the SALES user's reservations.
      safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
      // Appointments are scoped explicitly to this sales user, upcoming only.
      safe(
        api.get<Paged<VisitAppointment>>(
          `/visits/appointments?assignedSalesId=${userId}&scheduledFrom=${nowIso}&pageSize=50`,
        ),
      ),
      // Global available-units count (read-only reference).
      safe(api.get<Paged<unknown>>('/units?status=AVAILABLE&pageSize=1')),
      // Self-scoped pending compensation (best-effort).
      safe(api.get<BonusEntryRow[]>('/bonus-entries?status=PENDING')),
    ]);

  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // KPI computations from self-scoped data.
  const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length;
  const newThisMonth = leads.filter(
    (l) => new Date(l.createdAt).getTime() >= monthStart.getTime(),
  ).length;
  const activeReservations = reservations.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  ).length;
  const convertedDeals = reservations.filter((r) => r.status === 'CONVERTED').length;
  const upcomingVisits = visits.length;
  const availableUnits = unitsRes.data?.meta.total ?? 0;

  const pendingComp = (bonusRes.data ?? []).reduce(
    (sum, b) => sum + Number(b.amount ?? 0),
    0,
  );

  const recentLeads = leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const activeReservationRows = reservations
    .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
    .slice(0, 5);
  const upcomingVisitRows = visits.slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        title="لوحة المبيعات"
        description="نظرة سريعة على فرصك وزياراتك وحجوزاتك."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/leads/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                إضافة فرصة
              </Button>
            </Link>
            <Link href="/dashboard/visits/new">
              <Button
                variant="outline"
                size="md"
                leftIcon={<CalendarPlus className="h-4 w-4" />}
              >
                جدولة زيارة
              </Button>
            </Link>
            <Link href="/dashboard/reservations/new">
              <Button
                variant="outline"
                size="md"
                leftIcon={<BookmarkCheck className="h-4 w-4" />}
              >
                إنشاء حجز
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <PageKpiCard
          label="فرصي المفتوحة"
          value={openLeads}
          icon={<Users />}
          tone="brand"
        />
        <PageKpiCard
          label="فرص جديدة هذا الشهر"
          value={newThisMonth}
          icon={<Zap />}
          tone="accent"
        />
        <PageKpiCard
          label="زياراتي القادمة"
          value={upcomingVisits}
          icon={<CalendarClock />}
          tone="neutral"
        />
        <PageKpiCard
          label="حجوزاتي قيد المتابعة"
          value={activeReservations}
          icon={<BookmarkCheck />}
          tone="success"
        />
        <PageKpiCard
          label="صفقاتي المكتملة"
          value={convertedDeals}
          sub="محوّلة إلى عقود"
          icon={<FileText />}
          tone="info"
        />
        <PageKpiCard
          label="الوحدات المتاحة"
          value={availableUnits}
          icon={<Home />}
          tone="warning"
        />
      </div>

      {/* Pending compensation (self-scoped, best-effort) — links to self-view */}
      {!bonusRes.error && pendingComp > 0 && (
        <Link href="/dashboard/my-compensation" className="block">
          <Card className="p-4 flex items-center justify-between gap-3 hover:bg-surface-muted/40 transition-colors">
            <span className="inline-flex items-center gap-2 text-sm text-slate-700">
              <Wallet className="h-4 w-4 text-brand-600" />
              مستحقاتي المعلقة
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {formatCurrency(pendingComp)}
              </span>
              <ArrowLeft className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />
            </span>
          </Card>
        </Link>
      )}

      {/* Quick links */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/dashboard/units" icon={<Boxes className="h-3.5 w-3.5" />} label="تصفّح الوحدات" />
          <QuickLink href="/dashboard/projects" icon={<Building2 className="h-3.5 w-3.5" />} label="تصفّح المشاريع" />
          <QuickLink href="/dashboard/contracts" icon={<FileText className="h-3.5 w-3.5" />} label="عرض العقود" />
          <QuickLink href="/dashboard/installments" icon={<Wallet className="h-3.5 w-3.5" />} label="خطط التقسيط" />
          <QuickLink href="/dashboard/my-compensation" icon={<Wallet className="h-3.5 w-3.5" />} label="مستحقاتي وأهدافي" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming visits */}
        <SectionCard
          title="زياراتي القادمة"
          href="/dashboard/visits"
          error={visitsRes.error}
          empty={upcomingVisitRows.length === 0}
          emptyText="لا توجد زيارات قادمة."
        >
          {upcomingVisitRows.map((v) => (
            <Link
              key={v.id}
              href={`/dashboard/visits/appointments/${v.id}` as never}
              className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/40 rounded-lg transition-colors"
            >
              <CalendarClock className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                </p>
                <p className="text-2xs text-slate-500">{formatDateTime(v.scheduledAt)}</p>
              </div>
              <AppointmentStatusBadge status={v.status} />
            </Link>
          ))}
        </SectionCard>

        {/* Recent leads */}
        <SectionCard
          title="أحدث فرصي"
          href="/dashboard/leads"
          error={leadsRes.error}
          empty={recentLeads.length === 0}
          emptyText="لا توجد فرص بعد."
        >
          {recentLeads.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/leads/${l.id}` as never}
              className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/40 rounded-lg transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {l.client?.fullName ?? l.fullName}
                </p>
                <p className="text-2xs text-slate-500 truncate">
                  {l.projectInterest ? tx(l.projectInterest.name) : 'بدون مشروع'}
                  {' · '}
                  {formatDate(l.createdAt)}
                </p>
              </div>
              <LeadStageBadge stage={l.stage} />
            </Link>
          ))}
        </SectionCard>

        {/* Active reservations */}
        <SectionCard
          title="حجوزاتي قيد المتابعة"
          href="/dashboard/reservations"
          error={reservationsRes.error}
          empty={activeReservationRows.length === 0}
          emptyText="لا توجد حجوزات نشطة."
        >
          {activeReservationRows.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/reservations/${r.id}` as never}
              className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/40 rounded-lg transition-colors"
            >
              <BookmarkCheck className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                  {r.unit?.code ? ` · وحدة ${r.unit.code}` : ''}
                </p>
                <p className="text-2xs text-slate-500">ينتهي {formatDate(r.expiresAt)}</p>
              </div>
              <ReservationStatusBadge status={r.status} />
            </Link>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href as never}
      className="inline-flex items-center gap-1.5 rounded-xl bg-surface-muted/60 ring-1 ring-inset ring-hairline px-3 py-2 text-xs font-medium text-slate-700 hover:bg-surface-muted hover:text-brand-700 transition-colors"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </Link>
  );
}

function SectionCard({
  title,
  href,
  error,
  empty,
  emptyText,
  children,
}: {
  title: string;
  href: string;
  error?: string | null;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
        <Link
          href={href as never}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          عرض الكل
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>
      <div className="p-2">
        {error ? (
          <div className="flex items-start gap-2 text-warning-700 text-xs p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>تعذّر تحميل هذا القسم.</p>
          </div>
        ) : empty ? (
          <EmptyState icon={<Users />} title={emptyText} className="py-8" />
        ) : (
          <div className="flex flex-col divide-y divide-hairline">{children}</div>
        )}
      </div>
    </Card>
  );
}
