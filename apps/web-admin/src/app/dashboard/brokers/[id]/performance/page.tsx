import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  TrendingUp,
  Users as UsersIcon,
  Building2,
  BookmarkCheck,
  FileText,
  FilePen,
  ShieldCheck,
  Wallet,
  UserPlus,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import type { BrokerDetailReport, BrokerReportsSummary } from '@/lib/types';
import { tx, formatCurrency, formatDate, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { portalSharedT } from '@/messages/portal/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumPageHero } from '@/components/premium';
import { Amount, Avatar, FigureBar } from '@/components/cockpit/cockpit';
import {
  BrokerStatusBadge,
  BrokerCommissionStatusBadge,
  BrokerPayoutStatusBadge,
  BrokerLeadStatusBadge,
  LeadStageBadge,
  ReservationStatusBadge,
} from '@/components/badges';
import { MonthlyTrendChart } from '@/components/broker/monthly-trend-chart';
import { ExportMenu } from '@/components/export-menu';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  from?: string;
  to?: string;
  projectId?: string;
  brokerAgentId?: string;
}

const CARD = 'rounded-[22px] border border-hairline bg-surface';

/** Funnel stages, each with its tone; the rate is against the stage before it. */
const STAGES: Array<{ key: keyof BrokerReportsSummary; icon: ReactNode; tile: string; bar: string }> = [
  { key: 'leadsSubmitted',      icon: <UserPlus />,      tile: 'bg-[#D8B66A]/[0.16] text-[#B8913F] dark:text-[#D8B66A]', bar: 'bg-[#C9A24E]' },
  { key: 'leadsApproved',       icon: <ShieldCheck />,   tile: 'bg-sky-500/12 text-sky-600',         bar: 'bg-sky-400' },
  { key: 'reservationsCreated', icon: <BookmarkCheck />, tile: 'bg-violet-500/12 text-violet-600',   bar: 'bg-violet-400' },
  { key: 'contractsCreated',    icon: <FilePen />,       tile: 'bg-amber-500/12 text-amber-600',     bar: 'bg-amber-400' },
  { key: 'contractsSigned',     icon: <FileText />,      tile: 'bg-emerald-500/12 text-emerald-600', bar: 'bg-emerald-400' },
  { key: 'payoutsPaid',         icon: <Wallet />,        tile: 'bg-teal-500/12 text-teal-600',       bar: 'bg-teal-400' },
];

function Code({ label, code }: { label: string; code: string | null | undefined }) {
  return (
    <span className="whitespace-nowrap">
      <span className="me-1 text-slate-400">{label}</span>
      <span className="font-mono" dir="ltr">{code ?? '—'}</span>
    </span>
  );
}

function SectionHead({ icon, title, sub, children }: { icon?: ReactNode; title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 px-6 py-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-[#B8913F] dark:text-[#D8B66A] [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{title}</h2>
          {sub && <p className="text-[12px] text-slate-500">{sub}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-[#9A7A2E] hover:text-[#B8913F] dark:text-[#D8B66A]">
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

const Empty = () => <li className="px-6 py-6 text-center text-[13px] text-slate-500">—</li>;

export default async function BrokerPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [currency, locale] = await Promise.all([getReportsCurrency(), getLocale()]);
  const m = uiT(locale).pages.brokerPerformancePage;
  const ft = portalSharedT(locale).funnel;
  const symbol = currencySymbol(currency, locale);
  const word = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const money = (n: number | string) => formatCurrency(n, currency, locale);
  const amount = (n: number | string) => <Amount parts={compactParts(n, symbol, locale)} />;

  const qs = new URLSearchParams();
  for (const key of ['from', 'to', 'projectId', 'brokerAgentId'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [reportRes, projectListRes] = await Promise.all([
    safe(api.get<BrokerDetailReport>(`/broker-reports/broker/${id}?${qs.toString()}`)),
    safe(projectOptions()),
  ]);
  if (reportRes.error || !reportRes.data) notFound();
  const report = reportRes.data;
  const summary = report.summary;
  const projectList = projectListRes.data?.data ?? [];

  const stages = STAGES.map((s) => ({ ...s, label: ft.stages[s.key] ?? String(s.key), value: Number(summary[s.key] ?? 0) }));
  const top = Math.max(stages[0]?.value ?? 0, 1);

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={`${m.titlePrefix}${report.broker.companyName}`}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: report.broker.companyName, href: `/dashboard/brokers/${id}` },
          { label: m.breadcrumbPerformance },
        ]}
        meta={
          <span className="inline-flex items-center gap-2.5">
            <BrokerStatusBadge status={report.broker.status} locale={locale} />
            <span className="text-[12px] text-slate-500"><Code label={word('كود', 'Code')} code={report.broker.code} /></span>
          </span>
        }
        actions={
          <ExportMenu locale={locale}
            pdfPath={`/broker-reports/export/broker/${id}.pdf`}
            xlsxPath={`/broker-reports/export/broker/${id}.xlsx`}
            csvPath={`/broker-reports/export/broker/${id}.csv`}
            filenameBase={`broker-${report.broker.code ?? id}`}
            params={{ from: sp.from, to: sp.to, projectId: sp.projectId, brokerAgentId: sp.brokerAgentId }}
          />
        }
      />

      <form
        method="get"
        action={`/dashboard/brokers/${id}/performance`}
        className={cn(CARD, 'flex flex-wrap items-center gap-3 p-3')}
      >
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-56">
          <option value="">{m.filterAllProjects}</option>
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>{tx(p.name)}</option>
          ))}
        </Select>
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} className="w-44" aria-label={word('من', 'From')} />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} className="w-44" aria-label={word('إلى', 'To')} />
        <div className="ms-auto flex items-center gap-1.5">
          {Object.values(sp).some(Boolean) && (
            <Link href={`/dashboard/brokers/${id}/performance`}>
              <Button type="button" variant="ghost" size="sm">{m.clearBtn}</Button>
            </Link>
          )}
          <Button type="submit" variant="primary" size="sm">{m.filterBtn}</Button>
        </div>
      </form>

      <section data-testid="perf-figures" className={cn(CARD, 'overflow-hidden')}>
        <FigureBar
          bare
          figures={[
            { label: m.kpiLeads, value: summary.leadsSubmitted, href: `/dashboard/broker-leads?brokerId=${id}` },
            { label: m.kpiReservations, value: summary.reservationsCreated, href: `/dashboard/broker-reservations?brokerId=${id}` },
            { label: m.kpiContractsSigned, value: summary.contractsSigned, href: `/dashboard/broker-contracts?brokerId=${id}` },
            { label: m.kpiSalesGross, value: amount(summary.salesGross) },
            { label: m.kpiCommissionsNet, value: amount(summary.commissionsNet), href: `/dashboard/broker-commissions?brokerId=${id}` },
            { label: m.kpiPaid, value: amount(summary.payoutsTotalNet), href: `/dashboard/broker-payouts?brokerId=${id}` },
          ]}
        />
      </section>

      {/* Funnel (2/3) + quick read (1/3) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-stretch">
        <section data-testid="perf-funnel" className={cn(CARD, 'flex flex-col xl:col-span-2')}>
          <SectionHead title={ft.defaultTitle}>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-semibold text-slate-500">{ft.stagesCount(stages.length)}</span>
          </SectionHead>
          <ol className="flex-1 space-y-4 border-t border-hairline px-6 py-5">
            {stages.map((s, i) => {
              const prev = i === 0 ? null : stages[i - 1]!.value;
              const rate = prev !== null && prev > 0 ? `${((s.value / prev) * 100).toFixed(1)}%` : null;
              return (
                <li key={s.key} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3">
                  <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full [&_svg]:h-4 [&_svg]:w-4', s.tile)}>{s.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-800">
                        {s.label}
                        {rate && (
                          <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-500" title={word('التحويل من المرحلة السابقة', 'Conversion from the previous stage')}>
                            {rate}
                          </span>
                        )}
                      </span>
                      <span className="text-[15px] font-bold tabular-nums text-slate-900">{s.value}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-500/15">
                      <div className={cn('h-full rounded-full', s.bar)} style={{ width: `${s.value > 0 ? Math.max((s.value / top) * 100, 3) : 0}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-hairline px-6 py-3.5 text-[12px] text-slate-500">{ft.footnote}</p>
        </section>

        <section data-testid="perf-quick-read" className={cn(CARD, 'flex flex-col')}>
          <SectionHead title={m.quickReadTitle} />
          <dl className="divide-y divide-hairline border-t border-hairline">
            {[
              [word('اعتماد الفرص', 'Leads approved'), `${summary.leadsApproved} / ${summary.leadsSubmitted}`],
              [word('حجوزات ملغاة', 'Bookings cancelled'), summary.reservationsCancelled],
              [word('عقود قيد التوقيع', 'Contracts awaiting signature'), summary.contractsCreated - summary.contractsSigned],
              [word('عمولات معتمدة بانتظار الدفع', 'Approved commissions awaiting payout'), summary.commissionsApproved],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-3 px-6 py-3.5 text-[13px]">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-bold tabular-nums text-slate-900" dir="ltr">{v}</dd>
              </div>
            ))}
          </dl>
          <dl className="mt-auto grid grid-cols-2 border-t border-hairline">
            {[
              [m.rateLeadToRes, summary.leadToReservationRate],
              [m.rateResToContract, summary.reservationToContractRate],
              [m.rateSignedContracts, summary.signedContractRate],
              [m.rateContractToPayout, summary.contractToPaidPayoutRate],
            ].map(([k, v], i) => (
              <div key={String(k)} className={cn('px-6 py-4', i % 2 === 0 && 'border-e border-hairline', i < 2 && 'border-b border-hairline')}>
                <dt className="text-[11.5px] text-slate-500">{k}</dt>
                <dd className="mt-1 text-[18px] font-bold tabular-nums text-slate-900">{`${(Number(v) * 100).toFixed(1)}%`}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className={CARD}>
        <SectionHead icon={<TrendingUp />} title={m.trendTitle} sub={m.trendDesc} />
        <div className="border-t border-hairline px-6 py-5">
          <MonthlyTrendChart data={report.monthlyTrend} currency={currency} locale={locale} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={CARD}>
          <SectionHead icon={<Building2 />} title={m.projectsTitle} />
          <ul className="divide-y divide-hairline border-t border-hairline">
            {report.projectBreakdown.length === 0 && (
              <li className="px-6 py-8 text-center">
                <p className="text-[13.5px] font-semibold text-slate-700">{m.noProjectsTitle}</p>
                <p className="mt-1 text-[12px] text-slate-500">{m.noProjectsDesc}</p>
              </li>
            )}
            {report.projectBreakdown.map((p) => (
              <li key={p.projectId} className="grid grid-cols-[minmax(0,1fr)_60px_120px_120px] items-center gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-slate-900">{p.projectName ? tx(p.projectName) : '—'}</p>
                  {p.city && <p className="mt-0.5 text-[12px] text-slate-500">{p.city}</p>}
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-slate-500">{m.colContracts}</p>
                  <p className="text-[13px] font-semibold tabular-nums text-slate-800" dir="ltr">{p.contractsSigned} / {p.contracts}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-slate-500">{m.colSales}</p>
                  <p className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-800">{money(p.salesGross)}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-slate-500">{m.colCommissionNet}</p>
                  <p className="whitespace-nowrap text-[13.5px] font-bold tabular-nums text-slate-900">{money(p.commissionNet)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={CARD}>
          <SectionHead icon={<UsersIcon />} title={m.agentsTitle} />
          <ul className="divide-y divide-hairline border-t border-hairline">
            {report.agentBreakdown.length === 0 && (
              <li className="px-6 py-8 text-center text-[13.5px] font-semibold text-slate-700">{m.noAgentsTitle}</li>
            )}
            {report.agentBreakdown.map((a) => (
              <li key={a.brokerAgentId} className="grid grid-cols-[36px_minmax(0,1fr)_50px_60px_120px] items-center gap-4 px-6 py-4">
                <Avatar name={a.fullName} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-slate-900">{a.fullName}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500" dir="ltr">{a.email ?? a.phone ?? '—'}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-slate-500">{m.colLeads}</p>
                  <p className="text-[13px] font-semibold tabular-nums text-slate-800">{a.leadsSubmitted}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-slate-500">{m.colReservations}</p>
                  <p className="text-[13px] font-semibold tabular-nums text-slate-800">{a.reservations}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-slate-500">{m.colCommissionNet}</p>
                  <p className="whitespace-nowrap text-[13.5px] font-bold tabular-nums text-slate-900">{money(a.commissionNet)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={CARD}>
          <SectionHead title={m.recentLeadsTitle}>
            <ViewAll href={`/dashboard/broker-leads?brokerId=${id}`} label={m.viewAllBtn} />
          </SectionHead>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {report.recent.leads.length === 0 && <Empty />}
            {report.recent.leads.map((l) => (
              <li key={l.id} className="flex min-h-[68px] items-center gap-3 px-6 py-3">
                <Avatar name={l.fullName} />
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/broker-leads/${l.id}` as never} className="block truncate text-[14px] font-bold text-slate-900 hover:text-brand-700">
                    {l.fullName}
                  </Link>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {l.projectInterest ? tx(l.projectInterest.name) : '—'} · {formatDate(l.createdAt, locale)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {l.brokerApprovalStatus && <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />}
                  <LeadStageBadge stage={l.stage} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={CARD}>
          <SectionHead title={m.recentReservationsTitle}>
            <ViewAll href={`/dashboard/broker-reservations?brokerId=${id}`} label={m.viewAllBtn} />
          </SectionHead>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {report.recent.reservations.length === 0 && <Empty />}
            {report.recent.reservations.map((r) => (
              <li key={r.id} className="flex min-h-[68px] items-center gap-3 px-6 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-600">
                  <BookmarkCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <Link href={`/dashboard/reservations/${r.id}` as never} className="font-bold text-slate-900 hover:text-brand-700">
                    <Code label={word('حجز', 'Booking')} code={r.reservationNumber} />
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    <Code label={word('وحدة', 'Unit')} code={r.unit.code} /> · {formatDate(r.createdAt, locale)}
                  </p>
                </div>
                <ReservationStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className={CARD}>
          <SectionHead title={m.recentContractsTitle}>
            <ViewAll href={`/dashboard/broker-contracts?brokerId=${id}`} label={m.viewAllBtn} />
          </SectionHead>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {report.recent.contracts.length === 0 && <Empty />}
            {report.recent.contracts.map((c) => (
              <li key={c.id} className="flex min-h-[68px] items-center gap-3 px-6 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <Link href={`/dashboard/contracts/${c.id}` as never} className="font-bold text-slate-900 hover:text-brand-700">
                    <Code label={word('عقد', 'Contract')} code={c.contractNumber} />
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    <Code label={word('وحدة', 'Unit')} code={c.unit.code} /> ·{' '}
                    {c.signedAt
                      ? m.contractSigned(formatDate(c.signedAt, locale) ?? '—')
                      : m.contractPending(formatDate(c.createdAt, locale) ?? '—')}
                  </p>
                </div>
                <span className="w-32 shrink-0 whitespace-nowrap text-end text-[14px] font-bold tabular-nums text-slate-900">{money(c.totalAmount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={CARD}>
          <SectionHead title={m.recentCommissionsTitle}>
            <div className="flex items-center gap-4">
              <ViewAll href={`/dashboard/broker-commissions?brokerId=${id}`} label={m.commissionsBtn} />
              <ViewAll href={`/dashboard/broker-payouts?brokerId=${id}`} label={m.payoutsBtn} />
            </div>
          </SectionHead>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {report.recent.commissions.length === 0 && report.recent.payouts.length === 0 && <Empty />}
            {report.recent.commissions.slice(0, 5).map((c) => (
              <li key={`c-${c.id}`} className="flex min-h-[68px] items-center gap-3 px-6 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.16] text-[#B8913F] dark:text-[#D8B66A]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <Link href={`/dashboard/broker-commissions/${c.id}` as never} className="font-bold text-slate-900 hover:text-brand-700">
                    <Code label={word('عمولة', 'Commission')} code={c.commissionNumber} />
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">{formatDate(c.earnedAt, locale)}</p>
                </div>
                <BrokerCommissionStatusBadge status={c.status} locale={locale} />
                <span className="w-32 shrink-0 whitespace-nowrap text-end text-[14px] font-bold tabular-nums text-slate-900">{money(c.netAmount)}</span>
              </li>
            ))}
            {report.recent.payouts.slice(0, 5).map((p) => (
              <li key={`p-${p.id}`} className="flex min-h-[68px] items-center gap-3 bg-surface-muted/30 px-6 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/12 text-teal-600">
                  <Wallet className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <Link href={`/dashboard/broker-payouts/${p.id}` as never} className="font-bold text-slate-900 hover:text-brand-700">
                    <Code label={word('دفعة', 'Payout')} code={p.payoutNumber} />
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">{p.period ?? formatDate(p.createdAt, locale)}</p>
                </div>
                <BrokerPayoutStatusBadge status={p.status} locale={locale} />
                <span className="w-32 shrink-0 whitespace-nowrap text-end text-[14px] font-bold tabular-nums text-slate-900">{money(p.totalNet)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
