import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';
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
import { campaignT, CHANNEL_TONE, STATUS_TONE } from '@/components/campaigns/messages';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const STATUSES: CampaignStatus[] = ['ACTIVE', 'PLANNED', 'PAUSED', 'ENDED'];

interface ListResponse {
  data: Campaign[];
  totals: { leads: number; won: number; spend: number; cpl: number | null; cpa: number | null };
}

/** «الحملات التسويقية» — every campaign with what it cost and brought. */
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ status?: string; channel?: string }> }) {
  const [sp, locale, session, currency] = await Promise.all([searchParams, getLocale(), getSession(), getReportsCurrency()]);
  const m = campaignT(locale);
  const symbol = currencySymbol(currency, locale);
  const canManage = session?.role === 'ADMIN';
  const qs = new URLSearchParams();
  if (sp.status) qs.set('status', sp.status);
  if (sp.channel) qs.set('channel', sp.channel);
  const res = await safe(api.get<ListResponse>(`/campaigns?${qs.toString()}`));
  const rows = res.data?.data ?? [];
  const t = res.data?.totals;
  const money = (n: number | null | undefined) => (n == null ? '—' : compactParts(n, symbol, locale).join(' '));
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams(qs);
    for (const [k, v] of Object.entries(over)) (v ? p.set(k, v) : p.delete(k));
    const s = p.toString();
    return `/dashboard/campaigns${s ? `?${s}` : ''}`;
  };
  const chip = (on: boolean) =>
    cn('rounded-full border px-3 py-1.5 text-[12.5px] font-semibold', on ? 'border-brand-500 bg-brand-500/12 text-brand-700' : 'border-hairline text-slate-600 hover:border-brand-500/40');

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.list.title}
        description={m.list.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: m.list.title }]}
        actions={
          canManage ? (
            <Link href={'/dashboard/campaigns/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} data-testid="campaign-new">{m.list.add}</Button>
            </Link>
          ) : null
        }
      >
        {t && (
          <PremiumMetricStrip
            cols={5}
            metrics={[
              { label: m.list.kpi.spend, value: compactParts(t.spend, symbol, locale)[0], unit: compactParts(t.spend, symbol, locale)[1] },
              { label: m.list.kpi.leads, value: t.leads },
              { label: m.list.kpi.cpl, value: t.cpl == null ? '—' : compactParts(t.cpl, symbol, locale)[0], unit: t.cpl == null ? '' : compactParts(t.cpl, symbol, locale)[1] },
              { label: m.list.kpi.sales, value: t.won },
              { label: m.list.kpi.cpa, value: t.cpa == null ? '—' : compactParts(t.cpa, symbol, locale)[0], unit: t.cpa == null ? '' : compactParts(t.cpa, symbol, locale)[1] },
            ]}
          />
        )}
      </PremiumPageHero>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-slate-400">{m.list.filters.status}:</span>
        <Link href={href({ status: '' }) as never} className={chip(!sp.status)}>{m.list.filters.all}</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s }) as never} className={chip(sp.status === s)}>{m.status[s]}</Link>
        ))}
      </div>

      {res.error ? (
        <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{res.error}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-hairline bg-surface px-6 py-14 text-center">
          <Megaphone className="h-9 w-9 text-brand-500" />
          <p className="font-heading text-[17px] font-semibold text-slate-800">{m.list.empty}</p>
          <p className="max-w-lg text-[13px] text-slate-500">{m.list.emptyHint}</p>
          {canManage && (
            <Link href={'/dashboard/campaigns/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.list.add}</Button>
            </Link>
          )}
        </div>
      ) : (
        <ul data-testid="campaign-list" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((c) => {
            const used = c.budget ? Math.min(100, Math.round((c.stats.spend / c.budget) * 100)) : null;
            return (
              <li key={c.id} data-testid="campaign-card">
                <Link href={`/dashboard/campaigns/${c.id}` as never} className="block rounded-[22px] border border-hairline bg-surface p-5 transition-shadow hover:shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-[17px] font-semibold text-slate-900">{c.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">
                        <span className={cn('rounded-full px-2.5 py-0.5', CHANNEL_TONE[c.channel as CampaignChannel])}>{m.channel[c.channel]}</span>
                        <span className={cn('rounded-full px-2.5 py-0.5', STATUS_TONE[c.status])}>{m.status[c.status]}</span>
                        {c.project && <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-slate-600">{tx(c.project.name, locale)}</span>}
                      </div>
                    </div>
                    {(c.startDate || c.endDate) && (
                      <p className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                        {c.startDate ? formatDate(c.startDate, locale, 'UTC') : '…'} – {c.endDate ? formatDate(c.endDate, locale, 'UTC') : '…'}
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="font-semibold text-slate-500">{m.list.cols.budget}</span>
                      <span className="tabular-nums text-slate-700">
                        <span className="font-semibold text-slate-900">{money(c.stats.spend)}</span>
                        {c.budget ? ` ${m.list.of} ${money(c.budget)}` : ` · ${m.list.noBudget}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div className={cn('h-full rounded-full', used !== null && used >= 100 ? 'bg-danger-500' : 'bg-gradient-to-l from-brand-400 to-brand-600')} style={{ width: `${used ?? (c.stats.spend > 0 ? 100 : 0)}%` }} />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-hairline pt-3 text-center">
                    {[
                      [m.list.cols.leads, String(c.stats.leads)],
                      [m.list.cols.cpl, money(c.stats.cpl)],
                      [m.list.cols.sales, String(c.stats.won)],
                      [m.list.cols.cpa, money(c.stats.cpa)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold text-slate-400">{k}</dt>
                        <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
