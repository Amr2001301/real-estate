import Link from 'next/link';
import {
  BadgePercent,
  BarChart3,
  Briefcase,
  CircleDollarSign,
  Trophy,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { BrokerTrendChart } from './_components/broker-trend-chart';
import { BrokerFunnelChart, type FunnelStage } from './_components/broker-funnel-chart';
import { cn } from '@/lib/cn';
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
import { getReportsCurrency } from '@/lib/currency';
import { ExportMenu } from '@/components/export-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Search {
  brokerId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  metric?: string;
}

interface MonthlyTrendBucket {
  label: string;
  reservations: number;
  contractsSigned: number;
  commissionsNet: string;
  payoutsNet: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const METRIC_LABEL: Record<string, string> = {
  leads:         'فرص',
  reservations:  'حجوزات',
  contracts:     'عقود',
  salesGross:    'إجمالي المبيعات',
  commissionNet: 'صافي العمولات',
  payoutNet:     'صافي المدفوعات',
};

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function shortMonth(label: string): string {
  const mm = parseInt(label.split('-')[1] ?? '1', 10) - 1;
  return (AR_MONTHS[mm] ?? label).slice(0, 3);
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AdminBrokerReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const currency = await getReportsCurrency();

  const summaryQs = new URLSearchParams();
  if (sp.brokerId)  summaryQs.set('brokerId',  sp.brokerId);
  if (sp.projectId) summaryQs.set('projectId', sp.projectId);
  if (sp.from)      summaryQs.set('from', sp.from);
  if (sp.to)        summaryQs.set('to',   sp.to);

  const topQs = new URLSearchParams(summaryQs);
  if (sp.metric) topQs.set('metric', sp.metric);
  topQs.set('limit', '10');

  const projQs = new URLSearchParams();
  if (sp.brokerId)  projQs.set('brokerId',  sp.brokerId);
  if (sp.from)      projQs.set('from', sp.from);
  if (sp.to)        projQs.set('to',   sp.to);

  const [summaryRes, topRes, projRes, trendRes, brokersRes, projectListRes] = await Promise.all([
    safe(api.get<BrokerReportsSummary>(`/broker-reports/summary?${summaryQs}`)),
    safe(api.get<TopBrokersResponse>(`/broker-reports/top-brokers?${topQs}`)),
    safe(api.get<{ data: BrokerReportProjectRow[] }>(`/broker-reports/projects?${projQs}`)),
    safe(api.get<MonthlyTrendBucket[]>(`/broker-reports/monthly-trend?${summaryQs}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const s         = summaryRes.data;
  const top       = topRes.data;
  const projects  = projRes.data?.data ?? [];
  const trend     = trendRes.data ?? [];
  const brokers   = brokersRes.data?.data ?? [];
  const projList  = projectListRes.data?.data ?? [];

  // ── Derived financials ────────────────────────────────────────────────────
  const commissionsNet  = Number(s?.commissionsNet ?? 0);
  const payoutsPaidNet  = Number(s?.payoutsTotalNet ?? 0);
  const pendingPayout   = Math.max(0, commissionsNet - payoutsPaidNet);
  const realizationRate = commissionsNet > 0 ? Math.min(payoutsPaidNet / commissionsNet, 1) : 0;

  // ── Monthly trend derived ─────────────────────────────────────────────────
  const maxContracts   = trend.reduce((m, b) => Math.max(m, b.contractsSigned), 0);
  const totalTrendContracts = trend.reduce((s, b) => s + b.contractsSigned, 0);

  // ── Funnel stages ─────────────────────────────────────────────────────────
  const funnelStages: FunnelStage[] = s ? (() => {
    const raw = [
      { label: 'فرص مُرسلة',   value: s.leadsSubmitted,      color: 'bg-brand-500',   bg: 'bg-brand-100',   text: 'text-brand-700',   dot: 'bg-brand-500' },
      { label: 'فرص معتمدة',   value: s.leadsApproved,       color: 'bg-sky-500',     bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500' },
      { label: 'حجوزات',       value: s.reservationsCreated, color: 'bg-violet-500',  bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500' },
      { label: 'عقود',         value: s.contractsCreated,    color: 'bg-amber-500',   bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
      { label: 'عقود موقّعة',  value: s.contractsSigned,     color: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      { label: 'دفعات مُنجزة', value: s.payoutsPaid,         color: 'bg-teal-500',    bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500' },
    ];
    const first = raw[0]?.value ?? 1;
    return raw.map((r, i) => ({
      ...r,
      pctOfFirst: first > 0 ? Math.min((r.value / first) * 100, 100) : 0,
      convFromPrev: i > 0 && (raw[i - 1]?.value ?? 0) > 0
        ? r.value / (raw[i - 1]!.value)
        : null,
    }));
  })() : [];

  const overallConv = s && s.leadsSubmitted > 0
    ? s.payoutsPaid / s.leadsSubmitted
    : null;

  // ── Top broker for strip ──────────────────────────────────────────────────
  const topBroker = top?.data?.[0];

  const anyError = summaryRes.error || topRes.error || projRes.error;
  const hasFilter = Object.values(sp).some(Boolean);

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PremiumPageHero
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

      {anyError && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {anyError}
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/broker-reports"
        trailing={
          <>
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilter && (
              <Link href="/dashboard/broker-reports">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </>
        }
      >
        <PremiumFilterField label="الوسيط" htmlFor="br-broker">
          <Select id="br-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44">
            <option value="">كل الوسطاء</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label="المشروع" htmlFor="br-project">
          <Select id="br-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40">
            <option value="">كل المشاريع</option>
            {projList.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label="ترتيب حسب" htmlFor="br-metric">
          <Select id="br-metric" name="metric" inputSize="sm" defaultValue={sp.metric ?? 'salesGross'} className="w-48">
            {Object.entries(METRIC_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label="من" htmlFor="br-from">
          <Input id="br-from" name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-36" />
        </PremiumFilterField>
        <PremiumFilterField label="إلى" htmlFor="br-to">
          <Input id="br-to" name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-36" />
        </PremiumFilterField>
      </PremiumFilterBar>

      {s && (
        <PremiumMetricStrip
          variant="compact"
          cols={5}
          metrics={[
            {
              label:     'إجمالي المبيعات',
              value:     formatCurrency(s.salesGross, currency),
              icon:      <Wallet />,
              tone:      'brand',
              primary:   true,
              sub:       `${s.contractsSigned} عقد موقّع`,
              valueSize: 'compact',
            },
            {
              label:     'صافي العمولات',
              value:     formatCurrency(s.commissionsNet, currency),
              icon:      <BadgePercent />,
              tone:      'success',
              sub:       `${s.commissionsApproved} عمولة معتمدة`,
              valueSize: 'compact',
            },
            {
              label:     'المدفوع للوسطاء',
              value:     formatCurrency(s.payoutsTotalNet, currency),
              icon:      <CircleDollarSign />,
              tone:      'purple',
              sub:       `${s.payoutsPaid} دفعة مكتملة`,
              valueSize: 'compact',
            },
            {
              label:     'قيد الصرف',
              value:     pendingPayout > 0 ? formatCurrency(pendingPayout, currency) : '—',
              icon:      <TrendingUp />,
              tone:      pendingPayout > 0 ? 'warning' : 'neutral',
              sub:       `${(realizationRate * 100).toFixed(0)}% محصّل`,
              valueSize: 'compact',
            },
            {
              label:     'أعلى وسيط',
              value:     topBroker?.companyName ?? '—',
              icon:      <Trophy />,
              tone:      'neutral',
              sub:       topBroker ? formatCurrency(Number(topBroker.salesGross), currency) : undefined,
            },
          ]}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN GRID — Charts (RIGHT) | Rankings sticky (LEFT)
          RTL: DOM first = visual right, DOM second = visual left
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Charts column — visual RIGHT (DOM first in RTL) */}
        {s ? (
          <div className="space-y-5">
            <PremiumSectionCard
              title="الاتجاه الشهري للعمولات"
              description="العمولات المعتمدة مقابل المدفوع آخر 6 أشهر"
              icon={<BarChart3 />}
              trailing={
                <div className="text-end">
                  <p className="text-[13px] font-black tabular-nums text-slate-900 leading-none">
                    {totalTrendContracts.toLocaleString('ar-EG')} عقد
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5" dir="ltr">
                    {formatCurrency(trend.reduce((acc, b) => acc + Number(b.commissionsNet), 0), currency)}
                  </p>
                </div>
              }
            >
              <div className="h-[230px]">
                <BrokerTrendChart
                  data={trend.map((b) => ({
                    label: shortMonth(b.label),
                    commissionsNet: Number(b.commissionsNet),
                    payoutsNet: Number(b.payoutsNet),
                    contractsSigned: b.contractsSigned,
                  }))}
                  height={230}
                  currency={currency}
                />
              </div>
              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-hairline">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-5 rounded-sm bg-amber-300 inline-block" />
                  <span className="text-[10px] text-slate-400">العمولات المعتمدة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-5 rounded-sm bg-emerald-400 inline-block" />
                  <span className="text-[10px] text-slate-400">المدفوع للوسطاء</span>
                </div>
                <span className="text-[10px] text-slate-300 ms-auto">الأرقام = عقود موقّعة</span>
              </div>
            </PremiumSectionCard>

            <PremiumSectionCard
              title="قمع التحويل"
              description="من الفرصة إلى الدفعة المُنجزة"
              icon={<TrendingUp />}
            >
              <BrokerFunnelChart stages={funnelStages} overallConv={overallConv} />
            </PremiumSectionCard>
          </div>
        ) : (
          <div />
        )}

        {/* Rankings column — visual LEFT (DOM second in RTL), sticky */}
        <div className="sticky top-5 self-start space-y-5">

          {/* Top Brokers */}
          <PremiumSectionCard
            title="أعلى الوسطاء أداءً"
            description={`مرتبون حسب: ${METRIC_LABEL[sp.metric ?? 'salesGross']}`}
            icon={<TrendingUp />}
            trailing={
              (top?.data.length ?? 0) > 0 ? (
                <span className="inline-flex items-center rounded-lg bg-canvas px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-hairline">
                  {top?.data.length} وسيط
                </span>
              ) : undefined
            }
            padded={false}
          >
            {(top?.data ?? []).length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<Briefcase />} title="لا توجد بيانات" description="لا توجد عمولات في النطاق المختار." />
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {(top?.data ?? []).map((r, idx) => {
                  const maxSales = Number(top?.data?.[0]?.salesGross ?? 1);
                  const barW     = maxSales > 0 ? (Number(r.salesGross) / maxSales) * 100 : 0;
                  return (
                    <div key={r.brokerId} className={cn('flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors duration-100', idx === 0 && 'bg-amber-50/20')}>
                      <RankBadge rank={idx + 1} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/brokers/${r.brokerId}/performance` as never}
                          className="text-[13px] font-semibold text-slate-900 hover:text-brand-700 transition-colors truncate block"
                        >
                          {r.companyName}
                        </Link>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', idx === 0 ? 'bg-amber-400' : 'bg-slate-300')}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{r.contractsSigned} عقد</span>
                          <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md" dir="ltr">
                            {r.code}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-[13px] font-black tabular-nums text-slate-900" dir="ltr">
                          {formatCurrency(r.salesGross, currency)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5" dir="ltr">
                          عمولة: {formatCurrency(r.commissionNet, currency)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PremiumSectionCard>

          {/* Project Performance */}
          <PremiumSectionCard
            title="أداء المشاريع"
            description="مرتبة حسب إجمالي المبيعات"
            icon={<BarChart3 />}
            trailing={
              projects.length > 0 ? (
                <span className="inline-flex items-center rounded-lg bg-canvas px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-hairline">
                  {projects.length} مشروع
                </span>
              ) : undefined
            }
            padded={false}
          >
            {projects.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<BarChart3 />} title="لا توجد بيانات" description="ستظهر هنا عند وجود عمولات على أي مشروع." />
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {projects.map((p, idx) => {
                  const maxProjSales = Number(projects[0]?.salesGross ?? 1);
                  const barW         = maxProjSales > 0 ? (Number(p.salesGross) / maxProjSales) * 100 : 0;
                  const projName     = p.projectName ? tx(p.projectName) : '—';
                  return (
                    <div key={p.projectId} className={cn('flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors duration-100', idx === 0 && 'bg-amber-50/20')}>
                      <RankBadge rank={idx + 1} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/projects/${p.projectId}` as never}
                          className="text-[13px] font-semibold text-slate-900 hover:text-brand-700 transition-colors truncate block"
                        >
                          {projName}
                        </Link>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', idx === 0 ? 'bg-amber-400' : 'bg-slate-300')}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{p.contractsSigned}/{p.contracts} عقد</span>
                          {p.city && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[50px]">{p.city}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-[13px] font-black tabular-nums text-slate-900" dir="ltr">
                          {formatCurrency(p.salesGross, currency)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5" dir="ltr">
                          عمولة: {formatCurrency(p.commissionNet, currency)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PremiumSectionCard>

        </div>

      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const medal = medals[rank];
  return (
    <div className={cn(
      'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
      rank === 1 ? 'bg-amber-100' : rank <= 3 ? 'bg-slate-100' : 'bg-slate-50',
    )}>
      {medal
        ? <span className="text-base leading-none">{medal}</span>
        : <span className="text-[11px] font-black text-slate-400">{rank}</span>
      }
    </div>
  );
}
