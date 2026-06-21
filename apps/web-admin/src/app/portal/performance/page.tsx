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
  ArrowLeft,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  PortalPerformanceResponse,
  PortalProject,
} from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { MonthlyTrendChart } from '@/components/broker/monthly-trend-chart';
import { FunnelCard } from '@/components/broker/funnel-card';
import { ExportMenu } from '@/components/export-menu';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
} from '@/components/premium';

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

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface ConversionMetric {
  label: string;
  value: number;
  fromLabel: string;
  toLabel: string;
}

function ConversionCard({ label, value, fromLabel, toLabel }: ConversionMetric) {
  const pctVal = Math.min(Math.max(value * 100, 0), 100);
  const isHigh = pctVal >= 60;
  const isMed  = pctVal >= 30;
  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft p-4 overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-medium text-slate-600 leading-snug">{label}</p>
        <span
          className={cn(
            'text-xl font-bold tabular-nums shrink-0',
            isHigh ? 'text-success-700' : isMed ? 'text-warning-700' : 'text-danger-600',
          )}
        >
          {pct(value)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden mb-2.5">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            isHigh ? 'bg-success-500' : isMed ? 'bg-warning-500' : 'bg-danger-400',
          )}
          style={{ width: `${pctVal}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-2xs">
        <span className="text-slate-500">{fromLabel}</span>
        <ArrowLeft className="h-3 w-3 text-slate-300 shrink-0 rotate-180" aria-hidden />
        <span className="text-slate-500">{toLabel}</span>
      </div>
    </div>
  );
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

  const perf     = perfRes.data;
  const summary  = perf.summary;
  const projects = projectsRes.data ?? [];

  const maxSales = Math.max(
    ...perf.projectBreakdown.map((p) => Number(p.salesGross || 0)),
    1,
  );

  const isFiltered = !!(sp.from || sp.to || sp.projectId);

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title="أدائي"
        description="مؤشرات أداء شركة الوساطة الخاصة بك — الأرقام مأخوذة من نشاطك الفعلي."
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

      <PremiumFilterBar
        method="get"
        action="/portal/performance"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">تطبيق</Button>
            {isFiltered && (
              <Link href="/portal/performance">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label="المشروع">
          <Select
            name="projectId"
            inputSize="sm"
            defaultValue={sp.projectId ?? ''}
            className="w-56"
          >
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.project.id} value={p.project.id}>
                {tx(p.project.name)}
              </option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label="من تاريخ">
          <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-40" />
        </PremiumFilterField>
        <PremiumFilterField label="إلى تاريخ">
          <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-40" />
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumMetricStrip
        metrics={[
          { label: 'فرص مُرسلة',     value: summary.leadsSubmitted,     icon: <UserPlus />,      tone: 'brand'   },
          { label: 'حجوزات',          value: summary.reservationsCreated, icon: <BookmarkCheck />, tone: 'info'    },
          { label: 'عقود موقّعة',     value: summary.contractsSigned,     icon: <FileText />,      tone: 'teal'    },
          { label: 'إجمالي المبيعات', value: formatCurrency(summary.salesGross),        icon: <Banknote />,     tone: 'success', valueSize: 'compact' },
          { label: 'صافي العمولات',   value: formatCurrency(summary.commissionsNet),    icon: <BadgePercent />, tone: 'warning', valueSize: 'compact' },
          { label: 'مدفوع',           value: formatCurrency(summary.payoutsTotalNet),   icon: <Wallet />,       tone: 'success', valueSize: 'compact' },
        ]}
      />

      {/* Conversion rates */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          معدلات التحويل
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ConversionCard
            label="فرص → حجوزات"
            value={summary.leadToReservationRate}
            fromLabel={`${summary.leadsSubmitted} فرصة`}
            toLabel={`${summary.reservationsCreated} حجز`}
          />
          <ConversionCard
            label="حجوزات → عقود"
            value={summary.reservationToContractRate}
            fromLabel={`${summary.reservationsCreated} حجز`}
            toLabel={`${summary.contractsCreated} عقد`}
          />
          <ConversionCard
            label="توقيع العقود"
            value={summary.signedContractRate}
            fromLabel={`${summary.contractsCreated} عقد`}
            toLabel={`${summary.contractsSigned} موقّع`}
          />
          <ConversionCard
            label="عقود → مدفوعات"
            value={summary.contractToPaidPayoutRate}
            fromLabel={`${summary.contractsSigned} موقّع`}
            toLabel={`${summary.payoutsPaid} مدفوع`}
          />
        </div>
      </div>

      {/* Funnel + Monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FunnelCard summary={summary} title="قمع تحويل نشاطك" />

        <div className="bg-surface border border-hairline rounded-[20px] shadow-soft p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600" />
              الاتجاه الشهري
            </h2>
            <p className="text-2xs text-slate-500">آخر 6 أشهر أو حسب نطاق التاريخ</p>
          </div>
          <div className="flex-1">
            <MonthlyTrendChart data={perf.monthlyTrend} />
          </div>
        </div>
      </div>

      {/* Project breakdown */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-hairline">
          <Building2 className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-900">تفصيل المشاريع</h2>
          <span className="text-2xs text-slate-500 ms-1">
            {perf.projectBreakdown.length} مشروع
          </span>
        </div>

        {perf.projectBreakdown.length === 0 ? (
          <EmptyState icon={<Building2 />} title="لا توجد بيانات لمشاريع" description="—" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">المشروع</th>
                  <th className="text-start font-semibold py-3 px-4">عقود</th>
                  <th className="text-start font-semibold py-3 px-4">المبيعات</th>
                  <th className="text-start font-semibold py-3 px-4">صافي العمولات</th>
                  <th className="text-start font-semibold py-3 px-4">مدفوع</th>
                </tr>
              </thead>
              <tbody>
                {perf.projectBreakdown.map((p) => {
                  const barPct = Math.max((Number(p.salesGross || 0) / maxSales) * 100, 2);
                  return (
                    <tr key={p.projectId} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors">
                      <td className="py-3 ps-5 pe-4">
                        <p className="font-semibold text-slate-900">{p.projectName ? tx(p.projectName) : '—'}</p>
                        {p.city && <p className="text-2xs text-slate-500 mt-0.5">{p.city}</p>}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-xs">
                        <span className="font-semibold text-slate-900">{p.contractsSigned}</span>
                        <span className="text-slate-400"> / {p.contracts}</span>
                        <p className="text-2xs text-slate-400 mt-0.5">موقّع / إجمالي</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="tabular-nums text-xs font-semibold text-slate-900">{formatCurrency(p.salesGross)}</p>
                        <div className="mt-1.5 h-1.5 w-24 rounded-full bg-surface-muted overflow-hidden">
                          <div className="h-full bg-brand-400 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-xs font-semibold text-slate-900">
                        {formatCurrency(p.commissionNet)}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-xs text-slate-700">
                        {formatCurrency(p.payoutNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agent breakdown */}
      {perf.canSeeAllAgents && perf.agentBreakdown.length > 0 && (
        <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-hairline">
            <UsersIcon className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">أداء الوكلاء</h2>
            <span className="text-2xs text-slate-500 ms-1">
              {perf.agentBreakdown.length} وكيل
            </span>
            <span className="text-2xs text-slate-400 ms-auto">
              يظهر لمستخدمي الوسيط بصلاحية إدارة الموظفين فقط
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
                  <tr key={a.brokerAgentId} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">
                          {initials(a.fullName)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{a.fullName}</p>
                          <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                            {a.email ?? a.phone ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">{a.leadsSubmitted}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">{a.reservations}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">{a.contractsSigned}</td>
                    <td className="py-3 px-4 tabular-nums text-xs text-slate-700">{formatCurrency(a.salesGross)}</td>
                    <td className="py-3 px-4 tabular-nums text-xs font-semibold text-slate-900">
                      {formatCurrency(a.commissionNet)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!perf.canSeeAllAgents && (
        <p className="text-2xs text-slate-400 text-center">
          تفصيل الوكلاء يظهر فقط لمستخدمي الوسيط بصلاحية «إدارة الموظفين» أو لجهة الاتصال الرئيسية.
        </p>
      )}

    </div>
  );
}
