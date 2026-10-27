import Link from 'next/link';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { CampaignDetail } from '@/lib/types';
import { compactParts, formatDate, tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { currencySymbol, getCompanyTimeZone, getReportsCurrency, todayIn } from '@/lib/currency';
import { uiT } from '@/messages/ui';
import { PremiumMetricStrip, PremiumPageHero, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { campaignT, CHANNEL_TONE, CHANNEL_UTM_SOURCE, STATUS_TONE } from '@/components/campaigns/messages';
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
  const canManage = session?.role === 'ADMIN';
  const parts = (n: number | null) => (n == null ? (['—', ''] as const) : compactParts(n, symbol, locale));
  const full = (n: number) => `${n.toLocaleString(locale === 'en' ? 'en-EG' : 'ar-EG-u-nu-latn', { maximumFractionDigits: 2 })} ${symbol}`;

  // Ad links: the project page when the campaign has one, and the home page.
  const utm = new URLSearchParams({ utm_source: CHANNEL_UTM_SOURCE[c.channel], utm_medium: 'paid', utm_campaign: c.code });
  const links = [
    ...(c.projectId ? [{ label: `${d.links.project}${c.project ? ` — ${tx(c.project.name, locale)}` : ''}`, url: `${c.siteUrl}/projects/${c.projectId}?${utm}` }] : []),
    { label: d.links.home, url: `${c.siteUrl}/?${utm}` },
  ];
  const money: Record<string, string> = Object.fromEntries(c.spend.map((e) => [e.id, full(e.amount)]));
  money.total = full(s.spend);
  const dates: Record<string, string> = Object.fromEntries(c.spend.map((e) => [e.id, formatDate(e.spentOn, locale, 'UTC')]));

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={c.name}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/campaigns' },
          { label: c.name },
        ]}
        meta={
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
            <span className={cn('rounded-full px-2.5 py-0.5', CHANNEL_TONE[c.channel])}>{m.channel[c.channel]}</span>
            <span className={cn('rounded-full px-2.5 py-0.5', STATUS_TONE[c.status])}>{m.status[c.status]}</span>
            {c.project && <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-slate-600">{tx(c.project.name, locale)}</span>}
          </div>
        }
        actions={
          <>
            <Link href={`/dashboard/leads?campaignId=${c.id}` as never}>
              <Button variant="outline" size="md" leftIcon={<Users className="h-4 w-4" />}>{d.viewLeads}</Button>
            </Link>
            {canManage && (
              <Link href={`/dashboard/campaigns/${c.id}/edit` as never}>
                <Button variant="outline" size="md" leftIcon={<Pencil className="h-4 w-4" />} data-testid="campaign-edit">{d.edit}</Button>
              </Link>
            )}
          </>
        }
      >
        <PremiumMetricStrip
          cols={5}
          metrics={[
            { label: d.kpi.spend, value: parts(s.spend)[0], unit: parts(s.spend)[1], sub: c.budget ? `${d.kpi.budget} ${parts(c.budget).join(' ')}` : undefined },
            { label: d.kpi.leads, value: s.leads, sub: `${d.kpi.qualified} ${s.qualified} · ${d.kpi.lost} ${s.lost}` },
            { label: d.kpi.cpl, value: parts(s.cpl)[0], unit: parts(s.cpl)[1] },
            { label: d.kpi.sales, value: s.won },
            { label: d.kpi.cpa, value: parts(s.cpa)[0], unit: parts(s.cpa)[1] },
          ]}
        />
      </PremiumPageHero>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          <PremiumPanel title={d.spend.title} sub={d.spend.desc}>
            <SpendPanel campaignId={c.id} entries={c.spend} canManage={canManage} today={todayIn(zone)} m={d} money={money} dates={dates} />
          </PremiumPanel>
        </div>
        <div className="min-w-0 space-y-6">
          <PremiumPanel title={d.links.title} sub={d.links.desc}>
            <TrackingLinks links={links} labels={{ copy: d.links.copy, copied: d.links.copied }} />
            <p className="mt-3 text-[12px] text-slate-500">
              {d.links.code}: <code dir="ltr" className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-slate-700">{c.code}</code>
            </p>
          </PremiumPanel>
          <PremiumPanel title={d.info.title}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-slate-500">{d.info.channel}</dt>
              <dd className="font-semibold text-slate-800">{m.channel[c.channel]}</dd>
              <dt className="text-slate-500">{d.info.project}</dt>
              <dd className="font-semibold text-slate-800">{c.project ? tx(c.project.name, locale) : d.info.none}</dd>
              <dt className="text-slate-500">{d.info.source}</dt>
              <dd className="font-semibold text-slate-800">{c.source ? tx(c.source.name, locale) : d.info.none}</dd>
              <dt className="text-slate-500">{d.info.period}</dt>
              <dd className="tabular-nums text-slate-800">
                {c.startDate ? formatDate(c.startDate, locale, 'UTC') : '…'} – {c.endDate ? formatDate(c.endDate, locale, 'UTC') : '…'}
              </dd>
              {c.notes && (
                <>
                  <dt className="text-slate-500">{d.info.notes}</dt>
                  <dd className="whitespace-pre-line text-slate-700">{c.notes}</dd>
                </>
              )}
            </dl>
          </PremiumPanel>
          <Link href={'/dashboard/campaigns' as never} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" /> {d.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
