import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  FileText,
  BookmarkCheck,
  Banknote,
  BadgePercent,
  Wallet,
  UserPlus,
  Briefcase,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Broker,
  BrokerReportProjectRow,
  BrokerReportsSummary,
  Paged,
  Project,
  TopBrokersResponse,
} from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { ExportMenu } from '@/components/export-menu';
import { FunnelCard } from '@/components/broker/funnel-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  brokerId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  metric?: string;
}

const METRIC_LABEL: Record<string, string> = {
  leads: 'فرص',
  reservations: 'حجوزات',
  contracts: 'عقود',
  salesGross: 'إجمالي المبيعات',
  commissionNet: 'صافي العمولات',
  payoutNet: 'صافي المدفوعات',
};

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function AdminBrokerReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const summaryQs = new URLSearchParams();
  if (sp.brokerId) summaryQs.set('brokerId', sp.brokerId);
  if (sp.projectId) summaryQs.set('projectId', sp.projectId);
  if (sp.from) summaryQs.set('from', sp.from);
  if (sp.to) summaryQs.set('to', sp.to);

  const topQs = new URLSearchParams();
  if (sp.projectId) topQs.set('projectId', sp.projectId);
  if (sp.from) topQs.set('from', sp.from);
  if (sp.to) topQs.set('to', sp.to);
  if (sp.metric) topQs.set('metric', sp.metric);
  topQs.set('limit', '10');

  const projectsQs = new URLSearchParams();
  if (sp.brokerId) projectsQs.set('brokerId', sp.brokerId);
  if (sp.from) projectsQs.set('from', sp.from);
  if (sp.to) projectsQs.set('to', sp.to);

  const [summaryRes, topRes, projRes, brokersRes, projectListRes] = await Promise.all([
    safe(api.get<BrokerReportsSummary>(`/broker-reports/summary?${summaryQs.toString()}`)),
    safe(api.get<TopBrokersResponse>(`/broker-reports/top-brokers?${topQs.toString()}`)),
    safe(api.get<{ data: BrokerReportProjectRow[] }>(`/broker-reports/projects?${projectsQs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const summary = summaryRes.data;
  const top = topRes.data;
  const projects = projRes.data?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projectList = projectListRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="تقارير الوسطاء"
        description="مؤشرات الأداء، التحويلات، أعلى الوسطاء، وتفصيل المشاريع لشركاء الوساطة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'تقارير الوسطاء' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              label="تصدير الملخص"
              xlsxPath="/broker-reports/export/summary.xlsx"
              csvPath="/broker-reports/export/summary.csv"
              filenameBase="broker-summary"
              params={{ brokerId: sp.brokerId, projectId: sp.projectId, from: sp.from, to: sp.to }}
            />
            <ExportMenu
              label="تصدير أعلى الوسطاء"
              xlsxPath="/broker-reports/export/top-brokers.xlsx"
              csvPath="/broker-reports/export/top-brokers.csv"
              filenameBase="top-brokers"
              params={{ projectId: sp.projectId, from: sp.from, to: sp.to, metric: sp.metric }}
            />
          </div>
        }
      />

      {(summaryRes.error || topRes.error || projRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {summaryRes.error ?? topRes.error ?? projRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/broker-reports"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Select name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.companyName}</option>
          ))}
        </Select>
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
          <option value="">كل المشاريع</option>
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>{tx(p.name)}</option>
          ))}
        </Select>
        <Select name="metric" inputSize="sm" defaultValue={sp.metric ?? 'salesGross'} className="w-52 shrink-0">
          {Object.entries(METRIC_LABEL).map(([v, l]) => (
            <option key={v} value={v}>أعلى الوسطاء: {l}</option>
          ))}
        </Select>
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-36 shrink-0" />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-36 shrink-0" />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-reports">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
            <PageKpiCard label="فرص مُرسلة" value={summary.leadsSubmitted} icon={<UserPlus />} tone="brand" />
            <PageKpiCard label="حجوزات" value={summary.reservationsCreated} icon={<BookmarkCheck />} tone="info" />
            <PageKpiCard label="عقود موقّعة" value={summary.contractsSigned} icon={<FileText />} tone="accent" />
            <PageKpiCard label="إجمالي المبيعات" value={formatCurrency(summary.salesGross)} icon={<Banknote />} tone="success" compact />
            <PageKpiCard label="صافي العمولات" value={formatCurrency(summary.commissionsNet)} icon={<BadgePercent />} tone="warning" compact />
            <PageKpiCard label="مدفوع للوسطاء" value={formatCurrency(summary.payoutsTotalNet)} icon={<Wallet />} tone="success" compact />
          </div>

          <FunnelCard summary={summary} />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-2xs text-slate-500">فرص → حجوزات</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {pct(summary.leadToReservationRate)}
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                {summary.reservationsCreated} حجز من {summary.leadsApproved} فرصة معتمدة
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-2xs text-slate-500">حجوزات → عقود</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {pct(summary.reservationToContractRate)}
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                {summary.contractsCreated} عقد من {summary.reservationsCreated} حجز
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-2xs text-slate-500">توقيع العقود</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {pct(summary.signedContractRate)}
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                {summary.contractsSigned} موقّع من {summary.contractsCreated}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-2xs text-slate-500">عقود → مدفوعات</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {pct(summary.contractToPaidPayoutRate)}
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                {summary.payoutsPaid} دفعة مدفوعة
              </p>
            </Card>
          </div>
        </>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            أعلى الوسطاء — {METRIC_LABEL[top?.metric ?? 'salesGross']}
          </h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">فرص</th>
                <th className="text-start font-semibold py-3 px-4">حجوزات</th>
                <th className="text-start font-semibold py-3 px-4">عقود موقّعة</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي المبيعات</th>
                <th className="text-start font-semibold py-3 px-4">صافي العمولات</th>
                <th className="text-start font-semibold py-3 px-4">مدفوع</th>
                <th className="text-start font-semibold py-3 px-4">معدّل التحويل</th>
              </tr>
            </thead>
            <tbody>
              {(top?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<Briefcase />}
                      title="لا توجد بيانات"
                      description="لا توجد عمولات أو عقود من الوسطاء في النطاق المختار."
                    />
                  </td>
                </tr>
              )}
              {(top?.data ?? []).map((r) => (
                <tr key={r.brokerId} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors align-top">
                  <td className="py-3 ps-5 pe-4">
                    <Link
                      href={`/dashboard/brokers/${r.brokerId}/performance` as never}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {r.companyName}
                    </Link>
                    <p className="text-2xs text-slate-500 mt-0.5 font-mono" dir="ltr">{r.code}</p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{r.leads}</td>
                  <td className="py-3 px-4 tabular-nums">{r.reservations}</td>
                  <td className="py-3 px-4 tabular-nums">{r.contractsSigned}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(r.salesGross)}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(r.commissionNet)}</td>
                  <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                    {formatCurrency(r.payoutNet)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {pct(r.conversionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">المشاريع</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">وسطاء</th>
                <th className="text-start font-semibold py-3 px-4">عقود</th>
                <th className="text-start font-semibold py-3 px-4">عقود موقّعة</th>
                <th className="text-start font-semibold py-3 px-4">المبيعات</th>
                <th className="text-start font-semibold py-3 px-4">صافي العمولات</th>
                <th className="text-start font-semibold py-3 px-4">مدفوع</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<BarChart3 />}
                      title="لا توجد بيانات لمشاريع الوسطاء"
                      description="ستظهر هنا عند وجود عمولات وسطاء على أي مشروع."
                    />
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.projectId} className="border-t border-hairline align-top">
                  <td className="py-3 ps-5 pe-4">
                    <Link
                      href={`/dashboard/projects/${p.projectId}` as never}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {p.projectName ? tx(p.projectName) : '—'}
                    </Link>
                    {p.city && <p className="text-2xs text-slate-500 mt-0.5">{p.city}</p>}
                  </td>
                  <td className="py-3 px-4 tabular-nums">{p.brokerCount}</td>
                  <td className="py-3 px-4 tabular-nums">{p.contracts}</td>
                  <td className="py-3 px-4 tabular-nums">{p.contractsSigned}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(p.salesGross)}</td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(p.commissionNet)}</td>
                  <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                    {formatCurrency(p.payoutNet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
