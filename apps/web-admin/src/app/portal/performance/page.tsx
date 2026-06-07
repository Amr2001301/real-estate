import Link from 'next/link';
import {
  TrendingUp,
  UserPlus,
  BookmarkCheck,
  FileText,
  Banknote,
  BadgePercent,
  Wallet,
  Users as UsersIcon,
  Building2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  PortalPerformanceResponse,
  PortalProject,
} from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { MonthlyTrendChart } from '@/components/broker/monthly-trend-chart';
import { FunnelCard } from '@/components/broker/funnel-card';
import { ExportMenu } from '@/components/export-menu';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  from?: string;
  to?: string;
  projectId?: string;
  brokerAgentId?: string;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function PortalPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const key of ['from', 'to', 'projectId', 'brokerAgentId'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [perfRes, projectsRes] = await Promise.all([
    safe(api.get<PortalPerformanceResponse>(`/portal/performance?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
  ]);

  if (perfRes.error || !perfRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل الأداء: {perfRes.error ?? 'غير متاح'}
      </div>
    );
  }
  const perf = perfRes.data;
  const summary = perf.summary;
  const projects = projectsRes.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="أدائي"
        description="مؤشرات أداء شركة الوساطة الخاصة بك. الأرقام مأخوذة من نشاطك الفعلي ومحسوبة من نطاق التاريخ المختار."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الأداء' },
        ]}
        actions={
          <ExportMenu
            xlsxPath="/portal/performance/export.xlsx"
            csvPath="/portal/performance/export.csv"
            filenameBase="my-performance"
            params={{ from: sp.from, to: sp.to, projectId: sp.projectId, brokerAgentId: sp.brokerAgentId }}
          />
        }
      />

      <form
        method="get"
        action="/portal/performance"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Select
          name="projectId"
          inputSize="sm"
          defaultValue={sp.projectId ?? ''}
          className="w-56 shrink-0"
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>{tx(p.project.name)}</option>
          ))}
        </Select>
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-40 shrink-0" />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-40 shrink-0" />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.from || sp.to || sp.projectId) && (
            <Link href="/portal/performance">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <PageKpiCard label="فرص مُرسلة" value={summary.leadsSubmitted} icon={<UserPlus />} tone="brand" />
        <PageKpiCard label="حجوزات" value={summary.reservationsCreated} icon={<BookmarkCheck />} tone="info" />
        <PageKpiCard label="عقود موقّعة" value={summary.contractsSigned} icon={<FileText />} tone="accent" />
        <PageKpiCard label="إجمالي المبيعات" value={formatCurrency(summary.salesGross)} icon={<Banknote />} tone="success" compact />
        <PageKpiCard label="صافي العمولات" value={formatCurrency(summary.commissionsNet)} icon={<BadgePercent />} tone="warning" compact />
        <PageKpiCard label="مدفوع" value={formatCurrency(summary.payoutsTotalNet)} icon={<Wallet />} tone="success" compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-2xs text-slate-500">فرص → حجوزات</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.leadToReservationRate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs text-slate-500">حجوزات → عقود</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.reservationToContractRate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs text-slate-500">توقيع العقود</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.signedContractRate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs text-slate-500">عقود → مدفوعات</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.contractToPaidPayoutRate)}</p>
        </Card>
      </div>

      <FunnelCard summary={summary} title="قمع تحويل نشاطك" />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            الاتجاه الشهري
          </h2>
          <p className="text-2xs text-slate-500">آخر 6 أشهر أو حسب نطاق التاريخ</p>
        </div>
        <MonthlyTrendChart data={perf.monthlyTrend} />
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">المشاريع</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">عقود</th>
                <th className="text-start font-semibold py-3 px-4">مبيعات</th>
                <th className="text-start font-semibold py-3 px-4">صافي عمولات</th>
                <th className="text-start font-semibold py-3 px-4">مدفوع</th>
              </tr>
            </thead>
            <tbody>
              {perf.projectBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState icon={<Building2 />} title="لا توجد بيانات لمشاريع" description="—" />
                  </td>
                </tr>
              )}
              {perf.projectBreakdown.map((p) => (
                <tr key={p.projectId} className="border-t border-hairline">
                  <td className="py-3 ps-5 pe-4">
                    {p.projectName ? tx(p.projectName) : '—'}
                    {p.city && <p className="text-2xs text-slate-500 mt-0.5">{p.city}</p>}
                  </td>
                  <td className="py-3 px-4 tabular-nums">{p.contractsSigned} / {p.contracts}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(p.salesGross)}</td>
                  <td className="py-3 px-4 tabular-nums font-semibold">{formatCurrency(p.commissionNet)}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(p.payoutNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {perf.canSeeAllAgents && perf.agentBreakdown.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">الوكلاء</h2>
            <span className="text-2xs text-slate-500 ms-auto">
              تظهر للمستخدمين بصلاحية إدارة الموظفين فقط
            </span>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">الوكيل</th>
                  <th className="text-start font-semibold py-3 px-4">فرص</th>
                  <th className="text-start font-semibold py-3 px-4">حجوزات</th>
                  <th className="text-start font-semibold py-3 px-4">عقود موقّعة</th>
                  <th className="text-start font-semibold py-3 px-4">مبيعات</th>
                  <th className="text-start font-semibold py-3 px-4">صافي عمولات</th>
                </tr>
              </thead>
              <tbody>
                {perf.agentBreakdown.map((a) => (
                  <tr key={a.brokerAgentId} className="border-t border-hairline">
                    <td className="py-3 ps-5 pe-4">
                      <p className="font-medium text-slate-900">{a.fullName}</p>
                      <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">{a.email ?? a.phone ?? '—'}</p>
                    </td>
                    <td className="py-3 px-4 tabular-nums">{a.leadsSubmitted}</td>
                    <td className="py-3 px-4 tabular-nums">{a.reservations}</td>
                    <td className="py-3 px-4 tabular-nums">{a.contractsSigned}</td>
                    <td className="py-3 px-4 tabular-nums">{formatCurrency(a.salesGross)}</td>
                    <td className="py-3 px-4 tabular-nums font-semibold">{formatCurrency(a.commissionNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!perf.canSeeAllAgents && (
        <p className="text-2xs text-slate-500">
          نموذج الوكلاء يظهر فقط لمستخدمي الوسيط بصلاحية «إدارة الموظفين» أو لجهة الاتصال الرئيسية.
        </p>
      )}
    </div>
  );
}
