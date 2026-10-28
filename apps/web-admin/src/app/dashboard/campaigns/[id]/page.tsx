import Link from 'next/link';
import { Building2, CalendarDays, FileText, Pencil, Radio, Users } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { CampaignDetail } from '@/lib/types';
import { compactParts, formatDate, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { currencySymbol, getCompanyTimeZone, getReportsCurrency, todayIn } from '@/lib/currency';
import { uiT } from '@/messages/ui';
import { PremiumBars, PremiumMetricStrip, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { campaignT, CHANNEL_UTM_SOURCE } from '@/components/campaigns/messages';
import { BudgetRing, ChannelMark, LeadFunnel, StatusPill } from '@/components/campaigns/visuals';
import { TrackingLinks } from '../_components/tracking-links';
import { SpendPanel } from '../_components/spend-panel';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [locale, session, currency, zone] = await Promise.all([getLocale(), getSession(), getReportsCurrency(), getCompanyTimeZone()]);
  const m = campaignT(locale);
  const d = m.detail;
  const symbol = currencySymbol(currency, locale);
  const res = await safe(api.get<CampaignDetail>(`/campaigns/${id}`));
  if (!res.data) {
    return <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{res.error}</div>;
  }
  const c = res.data;
  const s = c.stats;
  const canManage = session?.role === 'ADMIN' || (await can('campaigns:manage'));
  const parts = (n: number | null) => (n == null ? (['—', ''] as const) : compactParts(n, symbol, locale));
  const full = (n: number) => `${n.toLocaleString(locale === 'en' ? 'en-EG' : 'ar-EG-u-nu-latn', { maximumFractionDigits: 2 })} ${symbol}`;
  const dateOf = (v: string) => formatDate(v, locale, 'UTC');
  const period = c.startDate || c.endDate ? `${c.startDate ? dateOf(c.startDate) : '…'} – ${c.endDate ? dateOf(c.endDate) : '…'}` : m.list.noDates;

  // Ad links: the project page when the campaign has one, and the home page.
  // A Meta ad runs on Facebook, Instagram and Messenger: Meta fills
  // {{site_source_name}} with fb / ig / msg, so each lead shows its platform
  // (left unencoded — Meta only fills it in literally).
  const meta = c.channel === 'FACEBOOK';
  const utm = `utm_source=${meta ? '{{site_source_name}}' : CHANNEL_UTM_SOURCE[c.channel]}&utm_medium=paid&utm_campaign=${encodeURIComponent(c.code)}`;
  const links = [
    ...(c.projectId ? [{ label: `${d.links.project}${c.project ? ` — ${tx(c.project.name, locale)}` : ''}`, url: `${c.siteUrl}/projects/${c.projectId}?${utm}` }] : []),
    { label: d.links.home, url: `${c.siteUrl}/?${utm}` },
  ];
  // The platform split matters where one ad runs on several (Meta), or once any lead says where it came from.
  const showPlatforms = s.leads > 0 && (meta || c.channel === 'INSTAGRAM' || c.platforms.some((p) => p.platform && p.platform !== 'OTHER'));
  const money: Record<string, string> = Object.fromEntries(c.spend.map((e) => [e.id, full(e.amount)]));
  money.total = full(s.spend);
  const dates: Record<string, string> = Object.fromEntries(c.spend.map((e) => [e.id, dateOf(e.spentOn)]));

  // Spend by day, oldest first, the last 14 days that had any.
  const byDay = [...c.spend.reduce((map, e) => map.set(e.spentOn.slice(0, 10), (map.get(e.spentOn.slice(0, 10)) ?? 0) + e.amount), new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
        <Link href={'/dashboard' as never} className="hover:text-brand-700">{uiT(locale).common.breadcrumbHome}</Link>
        <span aria-hidden>›</span>
        <Link href={'/dashboard/campaigns' as never} className="hover:text-brand-700">{m.list.title}</Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-brand-700">{c.name}</span>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-navy-band text-white shadow-[0_24px_60px_-30px_rgba(14,22,38,0.8)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,rgba(216,182,106,0.22),transparent_60%),radial-gradient(50%_80%_at_100%_100%,rgba(38,64,95,0.9),transparent)]" />
        <div className="relative grid grid-cols-1 items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <ChannelMark channel={c.channel} size={60} />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold tracking-wide text-[#D8B66A]">{m.list.eyebrow} · {m.channel[c.channel]}</p>
                <h1 className="mt-1 truncate font-heading text-[30px] font-bold leading-tight !text-white sm:text-[34px]">{c.name}</h1>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[12.5px] text-white/70">
              <StatusPill status={c.status} label={m.status[c.status]} dark />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 ring-1 ring-inset ring-white/10 tabular-nums">
                <CalendarDays className="h-3.5 w-3.5" /> {period}
              </span>
              {c.project && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 ring-1 ring-inset ring-white/10">
                  <Building2 className="h-3.5 w-3.5" /> {tx(c.project.name, locale)}
                </span>
              )}
              {c.source && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 ring-1 ring-inset ring-white/10">
                  <Radio className="h-3.5 w-3.5" /> {tx(c.source.name, locale)}
                </span>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/dashboard/leads?campaignId=${c.id}` as never}>
                <Button variant="primary" size="md" leftIcon={<Users className="h-4 w-4" />}>{d.viewLeads} · {s.leads}</Button>
              </Link>
              {canManage && (
                <Link href={`/dashboard/campaigns/${c.id}/edit` as never}>
                  <button type="button" data-testid="campaign-edit" className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/25 hover:bg-white/10">
                    <Pencil className="h-4 w-4" /> {d.edit}
                  </button>
                </Link>
              )}
            </div>
          </div>
          <div className="justify-self-center">
            <BudgetRing
              dark
              spent={s.spend}
              budget={c.budget}
              size={168}
              center={
                <>
                  <span className="text-[11px] font-semibold text-white/55">{d.kpi.spend}</span>
                  <span className="num mt-1 text-[34px] leading-none text-white">{parts(s.spend)[0]}</span>
                  <span className="mt-1 text-[11px] font-semibold text-[#D8B66A]">{parts(s.spend)[1]}</span>
                </>
              }
              caption={c.budget ? `${m.list.of} ${parts(c.budget).join(' ')} · ${Math.round((s.spend / c.budget) * 100)}%` : m.list.noBudget}
            />
          </div>
        </div>
      </section>

      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: d.kpi.leads, value: s.leads, sub: `${d.kpi.qualified} ${s.qualified}` },
          { label: d.kpi.cpl, value: parts(s.cpl)[0], unit: parts(s.cpl)[1] },
          { label: d.kpi.sales, value: s.won, sub: `${d.kpi.lost} ${s.lost}` },
          { label: d.kpi.cpa, value: parts(s.cpa)[0], unit: parts(s.cpa)[1], sub: s.cpa == null ? m.list.noSales : undefined },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 space-y-6">
          <PremiumPanel title={d.funnel.title} sub={d.funnel.desc}>
            <LeadFunnel
              steps={[
                { label: d.funnel.leads, value: s.leads, tone: 'bg-slate-400' },
                { label: d.funnel.qualified, value: s.qualified, tone: 'bg-gradient-to-l from-[#D8B66A] to-brand-600' },
                { label: d.funnel.sales, value: s.won, tone: 'bg-emerald-500' },
                { label: d.funnel.lost, value: s.lost, tone: 'bg-danger-400' },
              ]}
            />
          </PremiumPanel>

          {showPlatforms && (
            <PremiumPanel title={d.platforms.title} sub={d.platforms.desc}>
              <ul className="space-y-3" data-testid="campaign-platforms">
                {c.platforms.map((p) => {
                  const share = s.leads > 0 ? Math.round((p.leads / s.leads) * 100) : 0;
                  return (
                    <li key={p.platform ?? 'unknown'}>
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className={p.platform ? 'font-semibold text-slate-800' : 'font-semibold text-slate-500'}>
                          {p.platform ? d.platforms.names[p.platform] : d.platforms.unknown}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          <span className="font-semibold text-slate-900">{p.leads}</span> {d.platforms.leads} · {share}%
                          {p.won > 0 && <> · <span className="font-semibold text-emerald-700">{p.won}</span> {d.platforms.sales}</>}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={p.platform ? 'h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-brand-600' : 'h-full rounded-full bg-slate-300'}
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                      {!p.platform && <p className="mt-1 text-[11.5px] text-slate-400">{d.platforms.unknownHint}</p>}
                    </li>
                  );
                })}
              </ul>
            </PremiumPanel>
          )}

          <PremiumPanel title={d.spend.title} sub={d.spend.desc}>
            {byDay.length > 1 && (
              <div className="mb-6">
                <p className="mb-2 text-[11.5px] font-semibold text-slate-400">{d.chart}</p>
                <PremiumBars height={150} data={byDay.map(([day, v]) => ({ label: dayLabel(day), value: Math.round(v) }))} />
              </div>
            )}
            <SpendPanel campaignId={c.id} entries={c.spend} canManage={canManage} today={todayIn(zone)} m={d} money={money} dates={dates} />
          </PremiumPanel>
        </div>

        <div className="min-w-0 space-y-6">
          <PremiumPanel title={d.links.title} sub={d.links.desc}>
            <TrackingLinks links={links} labels={{ copy: d.links.copy, copied: d.links.copied, params: d.linkHint, open: d.open }} />
            {meta && <p className="mt-3 rounded-xl bg-[#D8B66A]/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-600">{d.metaHint}</p>}
          </PremiumPanel>

          {c.notes && (
            <PremiumPanel title={d.info.notes}>
              <p className="flex gap-2 whitespace-pre-line text-[13px] leading-relaxed text-slate-700">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {c.notes}
              </p>
            </PremiumPanel>
          )}
        </div>
      </div>
    </div>
  );
}
