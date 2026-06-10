import Link from 'next/link';
import {
  TrendingUp,
  FileText,
  BookmarkCheck,
  BadgePercent,
  Wallet,
  UserPlus,
  Briefcase,
  BarChart3,
  ArrowRightLeft,
  CircleDollarSign,
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

// ── Vertical conversion stepper ───────────────────────────────────────────────
function ConversionStepper({ summary }: { summary: BrokerReportsSummary }) {
  const stages: Array<{ label: string; value: number; prev: number | null }> = [
    { label: 'فرص مُرسلة',   value: summary.leadsSubmitted,      prev: null },
    { label: 'فرص معتمدة',   value: summary.leadsApproved,       prev: summary.leadsSubmitted },
    { label: 'حجوزات',       value: summary.reservationsCreated, prev: summary.leadsApproved },
    { label: 'عقود',         value: summary.contractsCreated,    prev: summary.reservationsCreated },
    { label: 'عقود موقّعة',  value: summary.contractsSigned,     prev: summary.contractsCreated },
    { label: 'دفعات مدفوعة', value: summary.payoutsPaid,         prev: summary.contractsSigned },
  ];

  return (
    <ul>
      {stages.map((s, idx) => {
        const isLast = idx === stages.length - 1;
        const rawPct = s.prev !== null && s.prev > 0
          ? (s.value / s.prev) * 100
          : null;
        const barPct = rawPct !== null ? Math.min(Math.max(rawPct, 2), 100) : null;

        return (
          <li key={idx} className="flex gap-3">
            {/* Step indicator + connector */}
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <div className="h-6 w-6 rounded-full border-2 border-hairline bg-surface flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-slate-500 leading-none">{idx + 1}</span>
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-hairline mt-1 min-h-[16px]" />
              )}
            </div>

            {/* Stage content */}
            <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-3'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{s.label}</p>
                <p className="text-lg font-bold tabular-nums text-slate-900 shrink-0 leading-none">
                  {s.value.toLocaleString()}
                </p>
              </div>
              {s.prev !== null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-400 transition-all"
                      style={{ width: barPct !== null ? `${barPct}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-600 whitespace-nowrap w-12 text-end">
                    {rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AdminBrokerReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  // ── Query strings (unchanged) ─────────────────────────────────────────────
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

  // Financial realization — derived, no new API calls
  const commissionsNetNum = Number(summary?.commissionsNet ?? 0);
  const payoutsTotalNetNum = Number(summary?.payoutsTotalNet ?? 0);
  const unrealizedNet = Math.max(0, commissionsNetNum - payoutsTotalNetNum);
  const realizationRate = commissionsNetNum > 0 ? payoutsTotalNetNum / commissionsNetNum : 0;

  return (
    <div className="space-y-5">

      {/* ── 1. Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="تقارير الوسطاء"
        description="أداء الوسطاء، التحويلات، تحليل المبيعات والعمولات، وترتيب المشاريع."
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

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {(summaryRes.error || topRes.error || projRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {summaryRes.error ?? topRes.error ?? projRes.error}
        </div>
      )}

      {/* ── 2. Report control bar ─────────────────────────────────────────── */}
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
        <Input name="to"   inputSize="sm" type="date" defaultValue={sp.to   ?? ''} className="w-36 shrink-0" />
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
          {/* ── 3. Executive Financial Overview ──────────────────────────── */}

          {/* A. Hero sales card — full-width, compact, no empty vertical space */}
          <div className="relative overflow-hidden bg-surface border border-hairline rounded-2xl shadow-xs">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-400" aria-hidden />
            <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  إجمالي المبيعات
                </p>
                <p
                  className="mt-1.5 text-4xl lg:text-5xl font-bold tracking-tight tabular-nums text-slate-900 whitespace-nowrap leading-none"
                  dir="ltr"
                >
                  {formatCurrency(summary.salesGross)}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  إجمالي عائد المبيعات عبر قناة الوساطة في النطاق المختار
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-xl font-bold tabular-nums text-slate-900 leading-none">{summary.contractsSigned}</p>
                  <p className="text-2xs text-slate-400 mt-0.5">عقد موقّع</p>
                </div>
                <div className="w-px h-7 bg-hairline shrink-0" />
                <div className="text-center">
                  <p className="text-xl font-bold tabular-nums text-slate-900 leading-none">{summary.activeBrokers}</p>
                  <p className="text-2xs text-slate-400 mt-0.5">وسيط نشط</p>
                </div>
                <div className="w-px h-7 bg-hairline shrink-0" />
                <div className="text-center">
                  <p className="text-xl font-bold tabular-nums text-slate-900 leading-none">{summary.totalBrokers}</p>
                  <p className="text-2xs text-slate-400 mt-0.5">إجمالي الوسطاء</p>
                </div>
                {summary.totalBrokerAgents > 0 && (
                  <>
                    <div className="w-px h-7 bg-hairline shrink-0" />
                    <div className="text-center">
                      <p className="text-xl font-bold tabular-nums text-slate-900 leading-none">{summary.totalBrokerAgents}</p>
                      <p className="text-2xs text-slate-400 mt-0.5">مندوب وسيط</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* B. Secondary financial cards — 3-column row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'صافي العمولات',
                value: formatCurrency(summary.commissionsNet),
                note: `${summary.commissionsApproved} عمولة معتمدة`,
                icon: <BadgePercent className="h-4 w-4 text-slate-500" />,
              },
              {
                label: 'مدفوع للوسطاء',
                value: formatCurrency(summary.payoutsTotalNet),
                note: `${summary.payoutsPaid} دفعة مكتملة`,
                icon: <Wallet className="h-4 w-4 text-slate-500" />,
              },
              {
                label: 'المتبقي للصرف',
                value: formatCurrency(unrealizedNet),
                note: unrealizedNet > 0 ? `${summary.payoutsApproved + summary.payoutsProcessing} دفعة قيد التنفيذ` : 'تم سداد جميع العمولات',
                icon: <CircleDollarSign className="h-4 w-4 text-slate-400" />,
              },
            ].map((card, i) => (
              <div
                key={i}
                className="bg-surface border border-hairline rounded-2xl shadow-xs px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 whitespace-nowrap leading-tight" dir="ltr">
                    {card.value}
                  </p>
                  <p className="text-2xs text-slate-400 mt-0.5">{card.note}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-surface-muted flex items-center justify-center shrink-0">
                  {card.icon}
                </div>
              </div>
            ))}
          </div>

          {/* C. Pipeline summary row — volume KPIs (leads / reservations / signed) */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'فرص مُرسلة',  value: summary.leadsSubmitted,      icon: <UserPlus    className="h-4 w-4 text-slate-400" /> },
              { label: 'حجوزات',      value: summary.reservationsCreated, icon: <BookmarkCheck className="h-4 w-4 text-slate-400" /> },
              { label: 'عقود موقّعة', value: summary.contractsSigned,     icon: <FileText    className="h-4 w-4 text-slate-400" /> },
            ].map((tile, i) => (
              <div
                key={i}
                className="bg-surface border border-hairline rounded-2xl shadow-xs px-5 py-3.5 flex items-center gap-3.5"
              >
                <div className="h-9 w-9 rounded-xl bg-surface-muted flex items-center justify-center shrink-0">
                  {tile.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">{tile.value}</p>
                  <p className="text-2xs text-slate-400 mt-1">{tile.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── 4. Conversion Journey ─────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <h2 className="text-xs font-semibold text-slate-600 whitespace-nowrap">رحلة التحويل</h2>
              <div className="flex-1 h-px bg-hairline" />
            </div>

            <Card className="overflow-hidden">
              <div className="flex flex-col lg:flex-row">

                {/* Stepper pane — flexible width */}
                <div className="flex-1 px-6 py-5">
                  <p className="text-xs font-semibold text-slate-600 mb-3">
                    مراحل قمع التحويل
                  </p>
                  <ConversionStepper summary={summary} />
                  <p className="text-2xs text-slate-400 mt-2">
                    النسب محسوبة مقارنة بالمرحلة السابقة.
                  </p>
                </div>

                {/* Hairline divider — horizontal on mobile, vertical on desktop */}
                <div className="h-px bg-hairline lg:h-auto lg:w-px shrink-0" aria-hidden />

                {/* Ratios pane — fixed width on desktop, natural height (no stretching) */}
                <div className="lg:w-72 shrink-0 px-6 py-5">
                  <p className="text-xs font-semibold text-slate-600 mb-3">
                    معدلات التحويل الرئيسية
                  </p>
                  <div className="divide-y divide-hairline">
                    {[
                      {
                        label: 'فرص → حجوزات',
                        rate: pct(summary.leadToReservationRate),
                        detail: `${summary.reservationsCreated} حجز من ${summary.leadsApproved} فرصة معتمدة`,
                      },
                      {
                        label: 'حجوزات → عقود',
                        rate: pct(summary.reservationToContractRate),
                        detail: `${summary.contractsCreated} عقد من ${summary.reservationsCreated} حجز`,
                      },
                      {
                        label: 'توقيع العقود',
                        rate: pct(summary.signedContractRate),
                        detail: `${summary.contractsSigned} موقّع من ${summary.contractsCreated} عقد`,
                      },
                      {
                        label: 'عقود → مدفوعات',
                        rate: pct(summary.contractToPaidPayoutRate),
                        detail: `${summary.payoutsPaid} دفعة من ${summary.contractsSigned} عقد موقّع`,
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700">{item.label}</p>
                          <p className="text-2xs text-slate-400 mt-0.5 truncate">{item.detail}</p>
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-slate-900 shrink-0 leading-none">
                          {item.rate}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </Card>
          </div>

          {/* ── 5. Financial Realization ──────────────────────────────────── */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center gap-2">
              <BadgePercent className="h-4 w-4 text-brand-600 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">التحصيل والصرف</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline">
              {[
                {
                  label: 'إجمالي العمولات المعتمدة',
                  value: formatCurrency(summary.commissionsNet),
                  note: `${summary.commissionsApproved} عمولة`,
                  isMonetary: true,
                },
                {
                  label: 'المدفوع فعلياً',
                  value: formatCurrency(summary.payoutsTotalNet),
                  note: `${summary.payoutsPaid} دفعة مكتملة`,
                  isMonetary: true,
                },
                {
                  label: 'المتبقي للصرف',
                  value: formatCurrency(unrealizedNet),
                  note: `${summary.payoutsApproved + summary.payoutsProcessing} دفعة قيد التنفيذ`,
                  isMonetary: true,
                },
                {
                  label: 'نسبة التحصيل',
                  value: `${Math.min(realizationRate * 100, 100).toFixed(1)}%`,
                  note: 'نسبة ما تم صرفه من إجمالي العمولات',
                  isMonetary: false,
                },
              ].map((tile, i) => (
                <div key={i} className="bg-surface px-5 py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-tight">
                    {tile.label}
                  </p>
                  <p
                    className="mt-2 text-xl font-bold tabular-nums text-slate-900 whitespace-nowrap leading-none"
                    dir={tile.isMonetary ? 'ltr' : undefined}
                  >
                    {tile.value}
                  </p>
                  <p className="text-2xs text-slate-400 mt-1.5 leading-tight">{tile.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ── 6. Top Brokers Ranking ────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900">
              أعلى الوسطاء أداءً
            </h2>
            {top?.metric && (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-500">
                {METRIC_LABEL[top.metric]}
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-2 w-8">#</th>
                <th className="text-start font-semibold py-3 ps-2 pe-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">فرص</th>
                <th className="text-start font-semibold py-3 px-4">حجوزات</th>
                <th className="text-start font-semibold py-3 px-4">عقود موقّعة</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي المبيعات</th>
                <th className="text-start font-semibold py-3 px-4">صافي العمولات</th>
                <th className="text-start font-semibold py-3 px-4">مدفوع</th>
                <th className="text-start font-semibold py-3 px-4">معدّل التحويل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {(top?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<Briefcase />}
                      title="لا توجد بيانات"
                      description="لا توجد عمولات أو عقود من الوسطاء في النطاق المختار."
                    />
                  </td>
                </tr>
              )}
              {(top?.data ?? []).map((r, idx) => (
                <tr
                  key={r.brokerId}
                  className={`align-middle transition-colors${idx === 0 ? ' bg-brand-50/30 hover:bg-brand-50/50' : ' hover:bg-surface-muted/40'}`}
                >
                  {/* Rank — #1 gets gold badge, rest get muted number */}
                  <td className="py-3 ps-5 pe-2 w-8">
                    {idx === 0 ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 leading-none">
                        1
                      </span>
                    ) : (
                      <span className="text-xs font-semibold tabular-nums text-slate-400">{idx + 1}</span>
                    )}
                  </td>

                  {/* Broker name + code chip */}
                  <td className="py-3 ps-2 pe-4">
                    <Link
                      href={`/dashboard/brokers/${r.brokerId}/performance` as never}
                      className="font-medium text-slate-900 hover:text-brand-700 transition-colors"
                    >
                      {r.companyName}
                    </Link>
                    <span
                      className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 leading-none mt-0.5 block w-fit"
                      dir="ltr"
                    >
                      {r.code}
                    </span>
                  </td>

                  <td className="py-3 px-4 tabular-nums text-slate-700">{r.leads}</td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">{r.reservations}</td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">{r.contractsSigned}</td>

                  <td className="py-3 px-4">
                    <span className="tabular-nums text-slate-700 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.salesGross)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="tabular-nums font-medium text-slate-800 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.commissionNet)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="tabular-nums font-semibold text-slate-900 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.payoutNet)}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                      {pct(r.conversionRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 7. Project Performance ────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-600 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900">أداء المشاريع</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">المدينة</th>
                <th className="text-start font-semibold py-3 px-4">وسطاء</th>
                <th className="text-start font-semibold py-3 px-4">عقود</th>
                <th className="text-start font-semibold py-3 px-4">عقود موقّعة</th>
                <th className="text-start font-semibold py-3 px-4">المبيعات</th>
                <th className="text-start font-semibold py-3 px-4">صافي العمولات</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5">مدفوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {projects.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<BarChart3 />}
                      title="لا توجد بيانات لمشاريع الوسطاء"
                      description="ستظهر هنا عند وجود عمولات وسطاء على أي مشروع."
                    />
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.projectId} className="align-middle hover:bg-surface-muted/40 transition-colors">
                  <td className="py-3 ps-5 pe-4">
                    <Link
                      href={`/dashboard/projects/${p.projectId}` as never}
                      className="font-medium text-slate-900 hover:text-brand-700 transition-colors"
                    >
                      {p.projectName ? tx(p.projectName) : '—'}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {p.city ?? '—'}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">{p.brokerCount}</td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">{p.contracts}</td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">{p.contractsSigned}</td>
                  <td className="py-3 px-4">
                    <span className="tabular-nums text-slate-700 whitespace-nowrap" dir="ltr">
                      {formatCurrency(p.salesGross)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="tabular-nums font-medium text-slate-800 whitespace-nowrap" dir="ltr">
                      {formatCurrency(p.commissionNet)}
                    </span>
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <span className="tabular-nums font-semibold text-slate-900 whitespace-nowrap" dir="ltr">
                      {formatCurrency(p.payoutNet)}
                    </span>
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
