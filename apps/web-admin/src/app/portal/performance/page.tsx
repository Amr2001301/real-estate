import Link from 'next/link';
import {
  TrendingUp,
  UserPlus,
  BookmarkCheck,
  Banknote,
  BadgePercent,
  Wallet,
  Users as UsersIcon,
  Building2,
  FilePen,
  CircleDollarSign,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { api, safe } from '@/lib/api';
import type {
  PortalPerformanceResponse,
  PortalProject,
} from '@/lib/types';
import { tx, formatCurrency, formatCompact } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
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

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-[5px] w-[5px] rounded-full bg-brand-400/80 shrink-0" />
      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── KPI tiles (replaces PremiumMetricStrip) ───────────────────────────────────

interface KpiTile {
  label:    string;
  value:    string;
  icon:     ReactNode;
  iconCls:  string;
  topBar:   string;
  valueCls: string;
}

function KpiStrip({ tiles }: { tiles: KpiTile[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((tile) => {
        const isLong = tile.value.length > 8;
        return (
          <div
            key={tile.label}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs"
          >
            <div className={cn('h-[3px] w-full shrink-0 bg-gradient-to-l', tile.topBar)} />
            <div className="flex flex-1 flex-col px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]',
                  tile.iconCls,
                )}>
                  {tile.icon}
                </span>
                <p className="text-[11px] font-semibold text-slate-400 text-end leading-snug line-clamp-2">
                  {tile.label}
                </p>
              </div>
              <p className={cn(
                'mt-3 font-black tabular-nums leading-none tracking-tight',
                isLong ? 'text-[16px]' : 'text-[24px]',
                tile.valueCls,
              )}>
                {tile.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PortalPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp       = await searchParams;
  const currency = await getReportsCurrency();
  const symbol   = currencySymbol(currency);
  const qs       = new URLSearchParams();
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

  const kpiTiles: KpiTile[] = [
    { label: 'فرص مُرسلة',     value: String(summary.leadsSubmitted),                       icon: <UserPlus />,      iconCls: 'bg-brand-50 text-brand-600 ring-1 ring-brand-100',     topBar: 'from-brand-300 via-brand-500 to-brand-300',   valueCls: 'text-brand-700'   },
    { label: 'حجوزات',          value: String(summary.reservationsCreated),                  icon: <BookmarkCheck />, iconCls: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100',           topBar: 'from-sky-300 via-sky-500 to-sky-300',         valueCls: 'text-sky-700'     },
    { label: 'عقود موقّعة',     value: String(summary.contractsSigned),                      icon: <FilePen />,       iconCls: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100', topBar: 'from-emerald-300 via-emerald-500 to-emerald-300', valueCls: 'text-emerald-700' },
    { label: 'إجمالي المبيعات', value: formatCompact(Number(summary.salesGross), symbol),     icon: <Banknote />,      iconCls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',    topBar: 'from-slate-300 via-slate-400 to-slate-300',   valueCls: 'text-slate-900'   },
    { label: 'صافي العمولات',   value: formatCompact(Number(summary.commissionsNet), symbol), icon: <BadgePercent />,  iconCls: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',     topBar: 'from-amber-300 via-amber-500 to-amber-300',   valueCls: 'text-amber-700'   },
    { label: 'مدفوع',           value: formatCompact(Number(summary.payoutsTotalNet), symbol),icon: <CircleDollarSign />,iconCls: 'bg-teal-50 text-teal-600 ring-1 ring-teal-100',       topBar: 'from-teal-300 via-teal-500 to-teal-300',     valueCls: 'text-teal-700'    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
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

      {/* ── Filters ────────────────────────────────────────────────────────── */}
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
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-56">
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

      {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
      <KpiStrip tiles={kpiTiles} />


      {/* ── Funnel + Monthly trend ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>قمع التحويل والاتجاه الشهري</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FunnelCard summary={summary} title="قمع تحويل نشاطك" />

          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-navy leading-none">الاتجاه الشهري</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">آخر 6 أشهر أو حسب نطاق التاريخ</p>
                </div>
              </div>
            </div>
            <div className="flex-1 p-5">
              <MonthlyTrendChart data={perf.monthlyTrend} currency={currency} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Project breakdown ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>تفصيل المشاريع</SectionLabel>
        <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
            <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-navy leading-none">تفصيل المشاريع</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{perf.projectBreakdown.length} مشروع</p>
            </div>
          </div>

          {perf.projectBreakdown.length === 0 ? (
            <EmptyState icon={<Building2 />} title="لا توجد بيانات لمشاريع" description="—" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-canvas/40">
                    <th className="text-start py-3 ps-6 pe-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">المشروع</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">عقود</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">المبيعات</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">صافي العمولات</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">مدفوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {perf.projectBreakdown.map((p) => {
                    const barPct = Math.max((Number(p.salesGross || 0) / maxSales) * 100, 2);
                    return (
                      <tr key={p.projectId} className="hover:bg-canvas/40 transition-colors">
                        <td className="py-4 ps-6 pe-4">
                          <p className="text-[13px] font-bold text-slate-900">{p.projectName ? tx(p.projectName) : '—'}</p>
                          {p.city && <p className="text-[11px] text-slate-400 mt-0.5">{p.city}</p>}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-baseline gap-1 tabular-nums">
                            <span className="text-[15px] font-bold text-slate-900">{p.contractsSigned}</span>
                            <span className="text-[11px] text-slate-400">/ {p.contracts} إجمالي</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">موقّع / إجمالي</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-[13px] font-bold text-slate-900 tabular-nums">
                            {formatCompact(Number(p.salesGross), symbol)}
                          </p>
                          <div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-brand-400 rounded-full" style={{ width: `${barPct}%` }} />
                          </div>
                        </td>
                        <td className="py-4 px-4 tabular-nums">
                          <span className="text-[13px] font-bold text-amber-700">
                            {formatCompact(Number(p.commissionNet), symbol)}
                          </span>
                        </td>
                        <td className="py-4 px-4 tabular-nums">
                          <span className="text-[13px] font-semibold text-teal-700">
                            {formatCompact(Number(p.payoutNet), symbol)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Agent breakdown ─────────────────────────────────────────────────── */}
      {perf.canSeeAllAgents && perf.agentBreakdown.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>أداء الوكلاء</SectionLabel>
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
                  <UsersIcon className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-navy leading-none">أداء الوكلاء</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{perf.agentBreakdown.length} وكيل · يظهر لمستخدمي إدارة الموظفين فقط</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-canvas/40">
                    <th className="text-start py-3 ps-6 pe-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">الوكيل</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">فرص</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">حجوزات</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">عقود موقّعة</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">مبيعات</th>
                    <th className="text-start py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">صافي عمولات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {perf.agentBreakdown.map((a) => (
                    <tr key={a.brokerAgentId} className="hover:bg-canvas/40 transition-colors">
                      <td className="py-4 ps-6 pe-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">
                            {initials(a.fullName)}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-slate-900">{a.fullName}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5" dir="ltr">
                              {a.email ?? a.phone ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 tabular-nums text-[13px] font-semibold text-brand-700">{a.leadsSubmitted}</td>
                      <td className="py-4 px-4 tabular-nums text-[13px] font-semibold text-sky-700">{a.reservations}</td>
                      <td className="py-4 px-4 tabular-nums text-[13px] font-semibold text-emerald-700">{a.contractsSigned}</td>
                      <td className="py-4 px-4 tabular-nums text-[13px] font-semibold text-slate-700">{formatCompact(Number(a.salesGross), symbol)}</td>
                      <td className="py-4 px-4 tabular-nums text-[13px] font-bold text-amber-700">{formatCompact(Number(a.commissionNet), symbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
