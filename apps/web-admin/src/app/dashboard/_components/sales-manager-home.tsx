import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Banknote,
  Target,
  Percent,
  ArrowLeft,
  AlertCircle,
  Plus,
  CalendarPlus,
  Wallet,
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

function pctLabel(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('ar-EG')}%`;
}

/**
 * SALES_MANAGER dashboard home — an all-sales team view (no team scoping yet;
 * see the managerId/SalesTeam TODO on the performance endpoint). Every read is
 * an endpoint SALES_MANAGER is allowed to call; the list endpoints already
 * return all reps for non-SALES roles, and performance is manager-scoped to
 * SALES users only. All calls use safe() so a single failure degrades to a
 * section fallback rather than crashing the page.
 */
export async function SalesManagerDashboard() {
  const nowIso = new Date().toISOString();
  const period = nowIso.slice(0, 7);

  const [perfRes, leadsRes, reservationsRes, visitsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?scheduledFrom=${nowIso}&pageSize=50`)),
  ]);

  // Performance now returns the manager's own row plus their team (self + team),
  // so the dashboard is always usable — it shows at least the manager's own
  // figures even with no team assigned. The per-rep section handles the rare
  // empty/error case with its own fallback.
  const perf = perfRes.data ?? [];

  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // Team rollups from the performance rows (sum across reps).
  const sum = (pick: (r: PerformanceRow) => number) => perf.reduce((acc, r) => acc + pick(r), 0);
  const teamLeads = sum((r) => r.leadsCount);
  const teamOpenLeads = sum((r) => r.openLeadsCount);
  const teamUpcomingVisits = sum((r) => r.upcomingVisitsCount);
  const teamActiveReservations = sum((r) => r.activeReservationsCount);
  const teamSigned = sum((r) => r.signedContractsCount);
  const teamRealized = sum((r) => r.realizedValue);
  const teamTargetAmount = sum((r) => r.targetAmount ?? 0);
  const teamTargetUnits = sum((r) => r.targetUnits ?? 0);
  const teamAmountPct = teamTargetAmount > 0 ? Math.round((teamRealized / teamTargetAmount) * 100) : null;
  const teamUnitsPct = teamTargetUnits > 0 ? Math.round((teamSigned / teamTargetUnits) * 100) : null;

  const recentLeads = leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const activeReservationRows = reservations
    .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
    .slice(0, 5);
  const upcomingVisitRows = visits.slice(0, 5);
  const repRows = perf.slice().sort((a, b) => b.realizedValue - a.realizedValue);

  return (
    <div className="space-y-5">
      <PageHeader
        title="لوحة مدير المبيعات"
        description="نظرة شاملة على أداء فريق المبيعات: الفرص والزيارات والحجوزات والعقود وتحقيق الأهداف لهذا الشهر."
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

      {/* Team KPI rollups */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard label="إجمالي فرص الفريق" value={leadsRes.error ? '—' : teamLeads.toLocaleString('ar-EG')} icon={<Users />} tone="brand" />
        <PageKpiCard label="فرص مفتوحة" value={perfRes.error ? '—' : teamOpenLeads.toLocaleString('ar-EG')} icon={<Zap />} tone="accent" />
        <PageKpiCard label="زيارات قادمة" value={perfRes.error ? '—' : teamUpcomingVisits.toLocaleString('ar-EG')} icon={<CalendarClock />} tone="neutral" />
        <PageKpiCard label="حجوزات نشطة" value={perfRes.error ? '—' : teamActiveReservations.toLocaleString('ar-EG')} icon={<BookmarkCheck />} tone="success" />
        <PageKpiCard label="عقود موقّعة هذا الشهر" value={perfRes.error ? '—' : teamSigned.toLocaleString('ar-EG')} icon={<FileText />} tone="info" />
        <PageKpiCard label="القيمة المحققة هذا الشهر" value={perfRes.error ? '—' : formatCurrency(teamRealized)} icon={<Banknote />} tone="success" />
        <PageKpiCard label="نسبة تحقيق القيمة" value={perfRes.error ? '—' : pctLabel(teamAmountPct)} icon={<Percent />} tone="warning" />
        <PageKpiCard label="نسبة تحقيق الوحدات" value={perfRes.error ? '—' : pctLabel(teamUnitsPct)} icon={<Target />} tone="brand" />
      </div>

      {/* Per-rep performance */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">أداء فريق المبيعات</h3>
          <Link href={'/dashboard/targets' as never} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            الأهداف والأداء
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
        {perfRes.error ? (
          <div className="flex items-start gap-2 text-warning-700 text-sm p-4">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>تعذّر تحميل هذا القسم.</p>
          </div>
        ) : repRows.length === 0 ? (
          <EmptyState icon={<Users />} title="لا يوجد مندوبو مبيعات بعد" className="py-10" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                <tr>
                  <th className="px-4 py-2.5 text-right font-medium">المندوب</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الفرص</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الزيارات</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الحجوزات</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">عقود موقّعة</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">القيمة المحققة</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">نسبة تحقيق القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {repRows.map((r) => (
                  <tr key={r.salesId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.salesName}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.leadsCount.toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.visitsCount.toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.reservationsCount.toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.signedContractsCount.toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(r.achievedAmount)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{pctLabel(r.targetAmountPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ManagerSection title="أحدث الفرص" href="/dashboard/leads" error={leadsRes.error} empty={recentLeads.length === 0} emptyText="لا توجد فرص بعد.">
          {recentLeads.map((l) => (
            <Link key={l.id} href={`/dashboard/leads/${l.id}` as never} className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/40 rounded-lg transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{l.client?.fullName ?? l.fullName}</p>
                <p className="text-2xs text-slate-500 truncate">
                  {l.projectInterest ? tx(l.projectInterest.name) : 'بدون مشروع'} · {formatDate(l.createdAt)}
                </p>
              </div>
              <LeadStageBadge stage={l.stage} />
            </Link>
          ))}
        </ManagerSection>

        <ManagerSection title="حجوزات قيد المتابعة" href="/dashboard/reservations" error={reservationsRes.error} empty={activeReservationRows.length === 0} emptyText="لا توجد حجوزات نشطة.">
          {activeReservationRows.map((r) => (
            <Link key={r.id} href={`/dashboard/reservations/${r.id}` as never} className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/40 rounded-lg transition-colors">
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
        </ManagerSection>

        <ManagerSection title="زيارات قادمة" href="/dashboard/visits" error={visitsRes.error} empty={upcomingVisitRows.length === 0} emptyText="لا توجد زيارات قادمة.">
          {upcomingVisitRows.map((v) => (
            <Link key={v.id} href={`/dashboard/visits/appointments/${v.id}` as never} className="flex items-center gap-3 px-2 py-2.5 hover:bg-surface-muted/40 rounded-lg transition-colors">
              <CalendarClock className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}</p>
                <p className="text-2xs text-slate-500">{formatDateTime(v.scheduledAt)}</p>
              </div>
              <AppointmentStatusBadge status={v.status} />
            </Link>
          ))}
        </ManagerSection>
      </div>
    </div>
  );
}

function ManagerSection({
  title, href, error, empty, emptyText, children,
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
        <Link href={href as never} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
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
