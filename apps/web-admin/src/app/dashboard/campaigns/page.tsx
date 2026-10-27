import Link from 'next/link';
import { ArrowLeft, CalendarDays, Megaphone, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Campaign, CampaignChannel, CampaignStatus } from '@/lib/types';
import { compactParts, formatDate, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { currencySymbol, getReportsCurrency } from '@/lib/currency';
import { uiT } from '@/messages/ui';
import { PremiumMetricStrip, PremiumPageHero } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { campaignT } from '@/components/campaigns/messages';
import { BudgetRing, ChannelMark, LeadFunnel, StatusPill } from '@/components/campaigns/visuals';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const STATUSES: CampaignStatus[] = ['ACTIVE', 'PLANNED', 'PAUSED', 'ENDED'];

interface ListResponse {
  data: Campaign[];
  totals: { leads: number; won: number; spend: number; cpl: number | null; cpa: number | null };
}

/** «الحملات التسويقية» — every campaign with what it cost and brought. */
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [sp, locale, session, currency] = await Promise.all([searchParams, getLocale(), getSession(), getReportsCurrency()]);
  const m = campaignT(locale);
  const L = m.list;
  const symbol = currencySymbol(currency, locale);
  const canManage = session?.role === 'ADMIN';
  // All of them once: the status tabs count from the same list.
  const res = await safe(api.get<ListResponse>('/campaigns'));
  const all = res.data?.data ?? [];
  const status = STATUSES.includes(sp.status as CampaignStatus) ? (sp.status as CampaignStatus) : null;
  const rows = status ? all.filter((c) => c.status === status) : all;
  const t = res.data?.totals;
  const parts = (n: number | null | undefined) => (n == null ? (['—', ''] as const) : compactParts(n, symbol, locale));
  const money = (n: number | null | undefined) => (n == null ? '—' : parts(n).join(' '));
  const dateOf = (v: string) => formatDate(v, locale, 'UTC');

  // By channel: spend, leads and cost per lead.
  const byChannel = [...all.reduce((map, c) => {
    const r = map.get(c.channel) ?? { channel: c.channel, count: 0, spend: 0, leads: 0 };
    r.count += 1;
    r.spend += c.stats.spend;
    r.leads += c.stats.leads;
    return map.set(c.channel, r);
  }, new Map<CampaignChannel, { channel: CampaignChannel; count: number; spend: number; leads: number }>()).values()].sort((a, b) => b.spend - a.spend);
  const maxSpend = Math.max(1, ...byChannel.map((c) => c.spend));

  return (
    <div className="space-y-7">
      <PremiumPageHero
        eyebrow={L.eyebrow}
        title={L.title}
        description={L.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: L.title }]}
        actions={
          canManage ? (
            <Link href={'/dashboard/campaigns/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} data-testid="campaign-new">{L.add}</Button>
            </Link>
          ) : null
        }
      >
        {t && all.length > 0 && (
          <PremiumMetricStrip
            cols={5}
            metrics={[
              { label: L.kpi.spend, value: parts(t.spend)[0], unit: parts(t.spend)[1] },
              { label: L.kpi.leads, value: t.leads },
              { label: L.kpi.cpl, value: parts(t.cpl)[0], unit: parts(t.cpl)[1] },
              { label: L.kpi.sales, value: t.won },
              { label: L.kpi.cpa, value: parts(t.cpa)[0], unit: parts(t.cpa)[1] },
            ]}
          />
        )}
      </PremiumPageHero>

      {res.error ? (
        <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{res.error}</div>
      ) : all.length === 0 ? (
        <div className="relative overflow-hidden rounded-[28px] border border-hairline bg-surface px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(216,182,106,0.16),transparent)]" />
          <div className="relative mx-auto flex max-w-lg flex-col items-center gap-4">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-brand-400 to-brand-700 text-[#1a1408] shadow-[0_12px_30px_-10px_rgba(184,140,58,0.6)]">
              <Megaphone className="h-7 w-7" />
            </span>
            <p className="font-heading text-[22px] font-bold text-slate-900">{L.empty}</p>
            <p className="text-[13.5px] leading-relaxed text-slate-500">{L.emptyHint}</p>
            {canManage && (
              <Link href={'/dashboard/campaigns/new' as never}>
                <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{L.add}</Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Channel performance */}
          {byChannel.length > 0 && (
            <section className="rounded-[24px] border border-hairline bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-[17px] font-bold text-slate-900">{L.mix}</h2>
                <p className="text-[12px] text-slate-500">{L.mixSub}</p>
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {byChannel.map((c) => (
                  <li key={c.channel} className="rounded-2xl bg-surface-muted/50 p-4 ring-1 ring-inset ring-hairline">
                    <div className="flex items-center gap-3">
                      <ChannelMark channel={c.channel} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-bold text-slate-900">{m.channel[c.channel]}</p>
                        <p className="text-[11.5px] text-slate-500">{c.count} {L.campaigns}</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-brand-600" style={{ width: `${Math.max(4, (c.spend / maxSpend) * 100)}%` }} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                      {[
                        [L.spent, c.spend],
                        [L.cols.leads, null],
                        [L.cols.cpl, c.leads > 0 ? c.spend / c.leads : undefined],
                      ].map(([k, v], i) => (
                        <div key={String(k)} className="min-w-0">
                          <dt className="truncate">{k}</dt>
                          <dd className="mt-0.5 whitespace-nowrap">
                            {i === 1 ? (
                              <span className="num text-[16px] text-slate-900">{c.leads}</span>
                            ) : v === undefined ? (
                              <span className="num text-[16px] text-slate-400">—</span>
                            ) : (
                              <>
                                <span className="num text-[16px] text-slate-900">{parts(v as number)[0]}</span>{' '}
                                <span className="text-[9.5px] font-semibold text-brand-700">{parts(v as number)[1]}</span>
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Status tabs */}
          <nav className="flex flex-wrap items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-inset ring-hairline w-fit">
            {[null, ...STATUSES].map((s) => {
              const on = s === status;
              const count = s ? all.filter((c) => c.status === s).length : all.length;
              return (
                <Link
                  key={s ?? 'all'}
                  href={(s ? `/dashboard/campaigns?status=${s}` : '/dashboard/campaigns') as never}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors',
                    on ? 'bg-navy-band text-white shadow-soft' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {s ? m.status[s] : L.filters.all}
                  <span className={cn('rounded-full px-1.5 text-[10.5px] tabular-nums', on ? 'bg-white/15 text-white' : 'bg-surface-muted text-slate-500')}>{count}</span>
                </Link>
              );
            })}
          </nav>

          <ul data-testid="campaign-list" className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {rows.map((c) => {
              const s = c.stats;
              return (
                <li key={c.id} data-testid="campaign-card">
                  <Link
                    href={`/dashboard/campaigns/${c.id}` as never}
                    className="group flex h-full flex-col rounded-[24px] border border-hairline bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D8B66A]/60 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] sm:p-6"
                  >
                    <div className="flex items-start gap-3.5">
                      <ChannelMark channel={c.channel} size={46} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading text-[18px] font-bold leading-snug text-slate-900">{c.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-slate-500">
                          {m.channel[c.channel]}
                          {c.project && <> · {tx(c.project.name, locale)}</>}
                        </p>
                      </div>
                      <StatusPill status={c.status} label={m.status[c.status]} />
                    </div>

                    <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-5">
                      <BudgetRing
                        spent={s.spend}
                        budget={c.budget}
                        size={92}
                        center={
                          <>
                            <span className="num text-[19px] leading-none text-slate-900">{parts(s.spend)[0]}</span>
                            <span className="mt-0.5 text-[9.5px] font-semibold text-brand-700">{parts(s.spend)[1]}</span>
                          </>
                        }
                        caption={c.budget ? `${L.of} ${money(c.budget)}` : L.noBudget}
                      />
                      <LeadFunnel
                        dense
                        steps={[
                          { label: L.funnel.leads, value: s.leads, tone: 'bg-slate-400' },
                          { label: L.funnel.qualified, value: s.qualified, tone: 'bg-[#D8B66A]' },
                          { label: L.funnel.sales, value: s.won, tone: 'bg-emerald-500' },
                        ]}
                      />
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-hairline ring-1 ring-hairline">
                      <div className="bg-surface-muted/40 px-4 py-3">
                        <dt className="text-[11px] font-semibold text-slate-500">{L.cols.cpl}</dt>
                        <dd className="num mt-0.5 text-[18px] text-slate-900">{money(s.cpl)}</dd>
                      </div>
                      <div className="bg-surface-muted/40 px-4 py-3">
                        <dt className="text-[11px] font-semibold text-slate-500">{L.cols.cpa}</dt>
                        <dd className={cn('mt-0.5', s.cpa == null ? 'pt-1 text-[12px] text-slate-400' : 'num text-[18px] text-slate-900')}>
                          {s.cpa == null ? L.noSales : money(s.cpa)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12px] text-slate-500">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {c.startDate || c.endDate ? `${c.startDate ? dateOf(c.startDate) : '…'} – ${c.endDate ? dateOf(c.endDate) : '…'}` : L.noDates}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-brand-700 opacity-80 transition-opacity group-hover:opacity-100">
                        {L.open} <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
            {canManage && !status && (
              <li>
                <Link
                  href={'/dashboard/campaigns/new' as never}
                  className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-hairline text-center transition-colors hover:border-[#D8B66A]/70 hover:bg-[#D8B66A]/[0.04]"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D8B66A]/15 text-brand-700"><Plus className="h-5 w-5" /></span>
                  <span className="font-heading text-[16px] font-bold text-slate-800">{L.newTile}</span>
                  <span className="text-[12px] text-slate-500">{L.newTileSub}</span>
                </Link>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
