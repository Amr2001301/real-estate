import Link from 'next/link';
import {
  TrendingUp,
  UserPlus,
  ShieldCheck,
  BookmarkCheck,
  FileText,
  Wallet,
  Users as UsersIcon,
  Building2,
  FilePen,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { api, safe } from '@/lib/api';
import type {
  PortalPerformanceResponse,
  PortalProject,
} from '@/lib/types';
import { tx, compactParts } from '@/lib/format';
import { Avatar, Amount, FigureBar } from '@/components/cockpit/cockpit';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';
import type { BrokerReportsSummary } from '@/lib/types';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { portalDashboardT } from '@/messages/portal/dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { MonthlyTrendChart } from '@/components/broker/monthly-trend-chart';
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

// ── Funnel ────────────────────────────────────────────────────────────────────

const STAGES: Array<{ key: keyof BrokerReportsSummary; Icon: React.ComponentType<{ className?: string }>; tone: string }> = [
  { key: 'leadsSubmitted',      Icon: UserPlus,      tone: 'bg-brand-500/12 text-brand-700' },
  { key: 'leadsApproved',       Icon: ShieldCheck,   tone: 'bg-sky-500/12 text-sky-600' },
  { key: 'reservationsCreated', Icon: BookmarkCheck, tone: 'bg-violet-500/12 text-violet-600' },
  { key: 'contractsCreated',    Icon: FilePen,       tone: 'bg-amber-500/12 text-amber-600' },
  { key: 'contractsSigned',     Icon: FileText,      tone: 'bg-emerald-500/12 text-emerald-600' },
  { key: 'payoutsPaid',         Icon: Wallet,        tone: 'bg-teal-500/12 text-teal-600' },
];

/**
 * One row per stage: the bar grows from the start edge, scaled to the largest
 * stage; the step's conversion from the stage before sits at the row's end.
 */
function FunnelPanel({ summary, title, locale }: { summary: BrokerReportsSummary; title: string; locale: Locale }) {
  const t = portalSharedT(locale).funnel;
  const stages = STAGES.map((s) => ({ ...s, label: t.stages[s.key] ?? String(s.key), value: Number(summary[s.key] ?? 0) }));
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <section className="flex flex-col rounded-[22px] border border-hairline bg-surface" data-testid="portal-funnel">
      <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div>
          <h2 className="font-heading text-[19px] font-bold leading-snug text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">{t.stagesCount(stages.length)}</p>
        </div>
      </header>
      <ul className="flex-1 space-y-4 px-6 pb-5">
        {stages.map((s, i) => {
          const prev = i === 0 ? null : stages[i - 1]!.value;
          const conv = prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <li key={s.key} className="grid grid-cols-[36px_minmax(0,1fr)_56px] items-center gap-3">
              <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl [&_svg]:h-4 [&_svg]:w-4', s.tone)}>
                <s.Icon />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-bold text-slate-900">{s.label}</span>
                  <span className="text-[17px] font-bold tabular-nums text-slate-900">{s.value}</span>
                </div>
                <div className="mt-1.5 h-[5px] rounded-full bg-slate-500/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-[#B38B3A]"
                    style={{ width: `${s.value === 0 ? 0 : Math.max((s.value / max) * 100, 3)}%` }}
                  />
                </div>
              </div>
              <span className="justify-self-end">
                {i > 0 && (
                  <span
                    className={cn(
                      'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                      conv === null ? 'bg-slate-500/10 text-slate-400' : 'bg-[#C9A24E]/12 text-brand-700',
                    )}
                    title={locale === 'en' ? 'From the stage before' : 'من المرحلة السابقة'}
                  >
                    {conv === null ? '—' : `${conv}%`}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-hairline px-6 py-3.5 text-[11.5px] leading-relaxed text-slate-500">{t.footnote}</p>
    </section>
  );
}

function PanelHead({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-6 pb-4 pt-5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-400/50 text-brand-700 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <div>
        <h2 className="font-heading text-[19px] font-bold leading-snug text-slate-900">{title}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/** A labelled figure inside a row: small grey label over the value. */
function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{children}</p>
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
  const locale   = await getLocale();
  const m        = portalDashboardT(locale);
  const t        = m.performance;
  const currency = await getReportsCurrency();
  const symbol   = currencySymbol(currency, locale);
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
        {t.loadErrorFn(perfRes.error ?? t.unavailable)}
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

  const money = (n: number | string | null | undefined) => <Amount parts={compactParts(Number(n ?? 0), symbol, locale)} />;

  return (
    <div className="space-y-5">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.portal, href: '/portal' },
          { label: t.breadcrumb },
        ]}
        actions={
          <ExportMenu
            pdfPath="/portal/performance/export.pdf"
            xlsxPath="/portal/performance/export.xlsx"
            csvPath="/portal/performance/export.csv"
            filenameBase="my-performance"
            locale={locale}
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
            <Button type="submit" variant="primary" size="sm">{t.filters.apply}</Button>
            {isFiltered && (
              <Link href="/portal/performance">
                <Button type="button" variant="ghost" size="sm">{m.common.clear}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={t.filters.project}>
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-56">
            <option value="">{t.filters.allProjects}</option>
            {projects.map((p) => (
              <option key={p.project.id} value={p.project.id}>
                {tx(p.project.name, locale)}
              </option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={t.filters.from}>
          <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-40" />
        </PremiumFilterField>
        <PremiumFilterField label={t.filters.to}>
          <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-40" />
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* ── Figures ────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={6}
          figures={[
            { label: t.kpi.leadsSubmitted, value: summary.leadsSubmitted },
            { label: t.kpi.reservations, value: summary.reservationsCreated },
            { label: t.kpi.contractsSigned, value: summary.contractsSigned },
            { label: t.kpi.salesGross, value: money(summary.salesGross) },
            { label: t.kpi.commissionsNet, value: money(summary.commissionsNet) },
            { label: t.kpi.paid, value: money(summary.payoutsTotalNet) },
          ]}
        />
      </section>


      {/* ── Funnel + Monthly trend ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>{t.funnelSection}</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FunnelPanel summary={summary} title={t.funnelTitle} locale={locale} />

          <div className="bg-surface border border-hairline rounded-[22px] overflow-hidden flex flex-col">
            <PanelHead icon={<TrendingUp />} title={t.trendTitle} sub={t.trendSubtitle} />
            <div className="flex-1 px-5 pb-5">
              <MonthlyTrendChart data={perf.monthlyTrend} currency={currency} locale={locale} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Project breakdown ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>{t.projects.title}</SectionLabel>
        <div className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
          <PanelHead icon={<Building2 />} title={t.projects.title} sub={t.projects.countFn(perf.projectBreakdown.length)} />
          {perf.projectBreakdown.length === 0 ? (
            <EmptyState icon={<Building2 />} title={t.projects.empty} description="—" />
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline" data-testid="perf-project-rows">
              {perf.projectBreakdown.map((p) => {
                const barPct = Math.max((Number(p.salesGross || 0) / maxSales) * 100, 2);
                return (
                  <li
                    key={p.projectId}
                    className="grid grid-cols-2 items-center gap-x-6 gap-y-3 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1.2fr)_150px_130px]"
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-band text-[#D8B66A] [&_svg]:h-4 [&_svg]:w-4">
                        <Building2 />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-bold text-slate-900">{p.projectName ? tx(p.projectName, locale) : '—'}</p>
                        {p.city && <p className="mt-0.5 truncate text-[12px] text-slate-500">{p.city}</p>}
                      </div>
                    </div>
                    <Cell label={t.projects.signedOverTotal}>
                      {p.contractsSigned}
                      <span className="ms-1 text-[12px] font-semibold text-slate-400">/ {p.contracts}</span>
                    </Cell>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-400">{t.projects.cols.sales}</p>
                      <p className="mt-1 whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{money(p.salesGross)}</p>
                      <div className="mt-1.5 h-[5px] rounded-full bg-slate-500/15">
                        <div className="h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-[#B38B3A]" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <Cell label={t.projects.cols.commissionsNet}>{money(p.commissionNet)}</Cell>
                    <Cell label={t.projects.cols.paid}>{money(p.payoutNet)}</Cell>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Agent breakdown ─────────────────────────────────────────────────── */}
      {perf.canSeeAllAgents && perf.agentBreakdown.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>{t.agents.title}</SectionLabel>
          <div className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
            <PanelHead icon={<UsersIcon />} title={t.agents.title} sub={t.agents.countFn(perf.agentBreakdown.length)} />
            <ul className="divide-y divide-hairline border-t border-hairline" data-testid="perf-agent-rows">
              {perf.agentBreakdown.map((a) => (
                <li
                  key={a.brokerAgentId}
                  className="grid grid-cols-3 items-center gap-x-6 gap-y-3 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[minmax(0,1.5fr)_80px_80px_100px_140px_140px]"
                >
                  <div className="col-span-3 flex min-w-0 items-center gap-3 lg:col-span-1">
                    <Avatar name={a.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-slate-900">{a.fullName}</p>
                      <p className="mt-0.5 truncate text-[12px] text-slate-500"><bdi>{a.email ?? a.phone ?? '—'}</bdi></p>
                    </div>
                  </div>
                  <Cell label={t.agents.cols.leads}>{a.leadsSubmitted}</Cell>
                  <Cell label={t.agents.cols.reservations}>{a.reservations}</Cell>
                  <Cell label={t.agents.cols.contractsSigned}>{a.contractsSigned}</Cell>
                  <Cell label={t.agents.cols.sales}>{money(a.salesGross)}</Cell>
                  <Cell label={t.agents.cols.commissionsNet}>{money(a.commissionNet)}</Cell>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!perf.canSeeAllAgents && (
        <p className="text-2xs text-slate-400 text-center">
          {t.agents.restrictedNote}
        </p>
      )}

    </div>
  );
}
