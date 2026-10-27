import Link from 'next/link';
import { ArrowLeft, BarChart3, Info } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { CampaignChannel, CampaignFigures, CampaignReport } from '@/lib/types';
import { compactParts, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { currencySymbol, getCompanyTimeZone, getReportsCurrency, todayIn } from '@/lib/currency';
import { projectOptions } from '@/lib/options';
import { uiT } from '@/messages/ui';
import { PremiumBars, PremiumMetricStrip, PremiumPageHero, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/export-menu';
import { cn } from '@/lib/cn';
import { campaignT } from '@/components/campaigns/messages';
import { campaignReportT } from '@/components/campaigns/report-messages';
import { ChannelMark } from '@/components/campaigns/visuals';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  from?: string;
  to?: string;
  channel?: string;
  projectId?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CHANNELS: CampaignChannel[] = [
  'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'GOOGLE', 'SNAPCHAT', 'WHATSAPP', 'SMS', 'EMAIL', 'BILLBOARD', 'EVENT', 'OTHER',
];

/** Return on spend as a pill: gold above zero, red below. */
function RoiPill({ roi }: { roi: number | null }) {
  if (roi == null) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold tabular-nums',
        roi >= 0 ? 'bg-emerald-500/12 text-emerald-700' : 'bg-danger-500/10 text-danger-600',
      )}
      dir="ltr"
    >
      {roi > 0 ? '+' : ''}
      {roi.toLocaleString('en-US')}%
    </span>
  );
}

/** «تقارير الحملات» — what the campaigns cost and brought in, by campaign, channel, project and month. */
export default async function CampaignReportPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, locale, zone, currency] = await Promise.all([searchParams, getLocale(), getCompanyTimeZone(), getReportsCurrency()]);
  const m = campaignReportT(locale);
  const cm = campaignT(locale);
  const symbol = currencySymbol(currency, locale);

  const today = todayIn(zone);
  const [y, mo] = today.split('-').map(Number) as [number, number];
  const ymd = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  const yearSoFar = { key: 'year' as const, from: ymd(y, 1, 1), to: today };
  const presets = [
    { key: 'month' as const, from: ymd(y, mo, 1), to: today },
    { key: 'quarter' as const, from: ymd(y, mo - 2, 1), to: today },
    yearSoFar,
    { key: 'all' as const, from: '', to: '' },
  ];
  // Opens on the year so far.
  const untouched = sp.from === undefined && sp.to === undefined;
  const from = untouched ? yearSoFar.from : sp.from && DAY.test(sp.from) ? sp.from : '';
  const to = untouched ? yearSoFar.to : sp.to && DAY.test(sp.to) ? sp.to : '';
  const channel = CHANNELS.includes(sp.channel as CampaignChannel) ? (sp.channel as CampaignChannel) : '';
  const projectId = sp.projectId && /^[0-9a-f-]{36}$/i.test(sp.projectId) ? sp.projectId : '';

  const filters = new URLSearchParams();
  if (from) filters.set('from', from);
  if (to) filters.set('to', to);
  if (channel) filters.set('channel', channel);
  if (projectId) filters.set('projectId', projectId);
  const hrefWith = (over: Record<string, string>) => {
    const p = new URLSearchParams(filters);
    // An explicit empty period means «all time», not «untouched».
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    for (const k of ['channel', 'projectId']) if (!p.get(k)) p.delete(k);
    return `/dashboard/campaigns/report?${p.toString()}`;
  };

  const [res, projectsRes] = await Promise.all([
    safe(api.get<CampaignReport>(`/campaigns/report?${filters.toString()}`)),
    safe(projectOptions()),
  ]);
  const r = res.data;
  const t = r?.totals;

  const parts = (n: number | null | undefined) => (n == null ? (['—', ''] as const) : compactParts(n, symbol, locale));
  const money = (n: number | null | undefined) => (n == null ? '—' : parts(n).join(' '));
  // Table cells: the exact amount; the currency sits in the column heading.
  const amount = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
  const rate = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
  const hasData = !!r && (r.campaigns.length > 0 || r.totals.spend > 0 || r.totals.leads > 0);

  const selectCls =
    'h-9 rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

  const figureCells = (f: CampaignFigures) => (
    <>
      <td className="num px-3 py-3 text-end text-[15px] text-slate-900">{amount(f.spend)}</td>
      <td className="num px-3 py-3 text-end text-[15px] text-slate-900">{f.leads}</td>
      <td className="num px-3 py-3 text-end text-[15px] text-slate-900">{f.sales}</td>
      <td className="num px-3 py-3 text-end text-[15px] font-semibold text-slate-900">{amount(f.revenue)}</td>
      <td className="num px-3 py-3 text-end text-[14px] text-slate-700">{amount(f.cpl)}</td>
      <td className="num px-3 py-3 text-end text-[14px] text-slate-700">{amount(f.cpa)}</td>
      <td className="px-3 py-3 text-end"><RoiPill roi={f.roi} /></td>
    </>
  );
  const head = (first: string, extra?: string) => (
    <thead>
      <tr className="border-b border-hairline text-[11.5px] font-semibold text-slate-400">
        <th className="px-3 pb-2.5 text-start">{first}</th>
        {extra && <th className="px-3 pb-2.5 text-end">{extra}</th>}
        {[`${m.cols.spend} (${symbol})`, m.cols.leads, m.cols.sales, `${m.cols.revenue} (${symbol})`, `${m.cols.cpl} (${symbol})`, `${m.cols.cpa} (${symbol})`, m.cols.roi].map((c) => (
          <th key={c} className="px-3 pb-2.5 text-end">{c}</th>
        ))}
      </tr>
    </thead>
  );

  const maxChannel = Math.max(1, ...(r?.byChannel ?? []).flatMap((c) => [c.spend, c.revenue]));

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.back, href: '/dashboard/campaigns' },
          { label: m.title },
        ]}
        actions={
          <>
            <ExportMenu
              locale={locale}
              filenameBase="campaigns-report"
              pdfPath="/campaigns/report/export.pdf"
              xlsxPath="/campaigns/report/export.xlsx"
              params={{ from: from || undefined, to: to || undefined, channel: channel || undefined, projectId: projectId || undefined }}
            />
            <Link href={'/dashboard/campaigns' as never}>
              <Button variant="outline" size="md" rightIcon={<ArrowLeft className="h-4 w-4 ltr:rotate-180" />}>{m.back}</Button>
            </Link>
          </>
        }
      >
        {t && hasData && (
          <PremiumMetricStrip
            cols={4}
            metrics={[
              { label: m.kpi.spend, value: parts(t.spend)[0], unit: parts(t.spend)[1], sub: m.kpi.count(t.campaigns) },
              { label: m.kpi.leads, value: t.leads, sub: t.leadShare == null ? undefined : m.kpi.leadsSub(t.leadShare) },
              { label: m.kpi.cpl, value: parts(t.cpl)[0], unit: parts(t.cpl)[1] },
              { label: m.kpi.sales, value: t.sales, sub: m.kpi.salesSub(rate(t.conversion)) },
              { label: m.kpi.cpa, value: parts(t.cpa)[0], unit: parts(t.cpa)[1] },
              { label: m.kpi.revenue, value: parts(t.revenue)[0], unit: parts(t.revenue)[1] },
              // Isolated left-to-right so the sign stays in front in Arabic.
              { label: m.kpi.roi, value: t.roi == null ? '—' : `\u2066${t.roi > 0 ? '+' : ''}${t.roi}%\u2069`, sub: m.kpi.roiSub },
              { label: m.kpi.allLeads, value: t.otherLeads + t.leads, sub: m.kpi.otherSub(t.otherLeads) },
            ]}
          />
        )}
      </PremiumPageHero>

      {/* Filters */}
      <div className="rounded-[20px] border border-hairline bg-surface p-4" data-testid="campaign-report-filters">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const on = p.from === from && p.to === to;
            return (
              <Link
                key={p.key}
                href={hrefWith({ from: p.from, to: p.to }) as never}
                data-testid={`report-preset-${p.key}`}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold',
                  on ? 'border-brand-500 bg-brand-500/12 text-brand-700' : 'border-hairline text-slate-600 hover:border-brand-500/40',
                )}
              >
                {m.presets[p.key]}
              </Link>
            );
          })}
        </div>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-semibold text-slate-500">
            {m.filters.from}
            <input type="date" name="from" defaultValue={from} className={cn(selectCls, 'mt-1 block')} />
          </label>
          <label className="text-[12px] font-semibold text-slate-500">
            {m.filters.to}
            <input type="date" name="to" defaultValue={to} className={cn(selectCls, 'mt-1 block')} />
          </label>
          <label className="text-[12px] font-semibold text-slate-500">
            {m.filters.channel}
            <select name="channel" defaultValue={channel} className={cn(selectCls, 'mt-1 block')}>
              <option value="">{m.filters.all}</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{cm.channel[c]}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-slate-500">
            {m.filters.project}
            <select name="projectId" defaultValue={projectId} className={cn(selectCls, 'mt-1 block')}>
              <option value="">{m.filters.all}</option>
              {(projectsRes.data?.data ?? []).map((p) => <option key={p.id} value={p.id}>{tx(p.name, locale)}</option>)}
            </select>
          </label>
          <Button type="submit" variant="primary" size="sm">{m.filters.apply}</Button>
          <Link href={'/dashboard/campaigns/report' as never} className="pb-2 text-[12.5px] font-semibold text-slate-500 hover:text-slate-800">
            {m.filters.reset}
          </Link>
        </form>
      </div>

      {res.error ? (
        <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{m.error}: {res.error}</div>
      ) : !r || !hasData ? (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-hairline bg-surface px-6 py-14 text-center">
          <BarChart3 className="h-8 w-8 text-brand-600" />
          <p className="font-heading text-[17px] font-semibold text-slate-800">{m.empty}</p>
          <p className="max-w-md text-[13px] text-slate-500">{m.emptyHint}</p>
        </div>
      ) : (
        <div data-testid="campaign-report" className="space-y-6">
          {/* Ranking */}
          <PremiumPanel title={m.board} sub={m.boardSub} padding="none">
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full min-w-[860px] text-[13px]">
                {head(m.cols.campaign)}
                <tbody className="divide-y divide-hairline">
                  {r.campaigns.map((c, i) => (
                    <tr key={c.id} data-testid="report-campaign-row" className="hover:bg-surface-muted/40">
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/campaigns/${c.id}` as never} className="flex min-w-0 items-center gap-3">
                          <span className="num w-5 shrink-0 text-center text-[15px] text-slate-400">{i + 1}</span>
                          <ChannelMark channel={c.channel} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-900 hover:text-brand-700">{c.name}</span>
                            <span className="block truncate text-[11.5px] text-slate-500">
                              {cm.channel[c.channel]}
                              {c.project && <> · {tx(c.project.name, locale)}</>}
                            </span>
                          </span>
                        </Link>
                      </td>
                      {figureCells(c)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#D8B66A]/50 bg-[#D8B66A]/[0.06] font-semibold">
                    <td className="px-3 py-3 text-slate-900">{m.total}</td>
                    {figureCells(r.totals)}
                  </tr>
                </tfoot>
              </table>
            </div>
          </PremiumPanel>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Channels compared */}
            <PremiumPanel title={m.byChannel} sub={m.byChannelSub}>
              <ul className="space-y-4" data-testid="report-channels">
                {r.byChannel.map((c) => (
                  <li key={c.channel}>
                    <div className="flex items-center gap-3">
                      <ChannelMark channel={c.channel} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13.5px] font-bold text-slate-900">{cm.channel[c.channel]}</span>
                          <RoiPill roi={c.roi} />
                        </div>
                        <p className="text-[11.5px] text-slate-500">
                          {m.kpi.count(c.campaigns)} · {c.leads} {m.cols.leads} · {m.cols.cpl} {money(c.cpl)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5 ps-11">
                      {([
                        ['spend', c.spend, 'bg-slate-400'],
                        ['revenue', c.revenue, 'bg-gradient-to-l from-[#D8B66A] to-brand-600'],
                      ] as const).map(([k, v, tone]) => (
                        <div key={k} className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="w-14 shrink-0">{m.spentVsRevenue[k]}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                            <div className={cn('h-full rounded-full', tone)} style={{ width: `${v > 0 ? Math.max(2, (v / maxChannel) * 100) : 0}%` }} />
                          </div>
                          <span className="num w-20 shrink-0 text-end text-[13px] text-slate-800">{money(v)}</span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </PremiumPanel>

            {/* By month */}
            <PremiumPanel title={m.trend} sub={m.inThousands(symbol)}>
              <PremiumBars data={r.trend.slice(-12).map((x) => ({ label: monthLabel(x.month), value: Math.round(x.spend / 100) / 10 }))} height={180} />
              <p className="mb-2 mt-6 text-[12.5px] font-semibold text-slate-500">{m.trendLeads}</p>
              <PremiumBars data={r.trend.slice(-12).map((x) => ({ label: monthLabel(x.month), value: x.leads }))} height={120} />
            </PremiumPanel>
          </div>

          {/* By project */}
          <PremiumPanel title={m.byProject} sub={m.byProjectSub} padding="none">
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full min-w-[820px] text-[13px]" data-testid="report-projects">
                {head(m.filters.project, m.cols.campaigns)}
                <tbody className="divide-y divide-hairline">
                  {r.byProject.map((p) => (
                    <tr key={p.projectId ?? 'none'}>
                      <td className={cn('px-3 py-3 font-semibold', p.projectId ? 'text-slate-900' : 'text-slate-500')}>
                        {p.name ? tx(p.name, locale) : m.noProject}
                      </td>
                      <td className="num px-3 py-3 text-end text-[15px] text-slate-700">{p.campaigns}</td>
                      {figureCells(p)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumPanel>

          {/* How it is counted */}
          <section className="rounded-[20px] border border-hairline bg-surface-muted/40 p-5">
            <h2 className="flex items-center gap-2 text-[13.5px] font-bold text-slate-800">
              <Info className="h-4 w-4 text-brand-600" /> {m.how.title}
            </h2>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-[12.5px] leading-relaxed text-slate-600">
              {m.how.items.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
