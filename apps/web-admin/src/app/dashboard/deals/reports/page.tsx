import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Building, Home, KeyRound, Scale, Users } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { compactParts, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumPageHero, PremiumMetricStrip, PremiumFilterBar, PremiumFilterField, PremiumEmptyState } from '@/components/premium';
import { listingsT, type ListingKind } from '@/components/listings/messages';
import { dealsT, type ReportPayload } from '@/components/deals/messages';
import { DealsTabs, Panel } from '../_components/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const KIND_ICON: Record<ListingKind, typeof Building> = { PRIMARY: Building, RESALE: Home, RENT: KeyRound };
function shift(period: string, n: number) {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/**
 * BRK-4 «التقارير المالية» — the admin's view of what the deals earned: the
 * commission, what is collected, the team's shares and bonuses, what the
 * company keeps; the 12-month trend, by deal type and by person.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const [sp, locale, currency, session, timeZone] = await Promise.all([searchParams, getLocale(), getReportsCurrency(), getSession(), getCompanyTimeZone()]);
  if (session?.role !== 'ADMIN') redirect('/dashboard/deals');
  const m = dealsT(locale);
  const t = m.reports;
  const lm = listingsT(locale);
  const symbol = currencySymbol(currency, locale);
  const now = todayIn(timeZone).slice(0, 7);
  const to = sp.to && PERIOD.test(sp.to) ? sp.to : now;
  const from = sp.from && PERIOD.test(sp.from) && sp.from <= to ? sp.from : to;
  const res = await safe(api.get<ReportPayload>(`/deals/report?from=${from}&to=${to}`));
  const r = res.data;
  const money = (v: number) => formatExactCurrency(v, currency, locale);
  const compact = (v: number) => compactParts(v, symbol, locale).join(' ');

  const quarterStart = `${now.slice(0, 4)}-${String(Math.floor((Number(now.slice(5)) - 1) / 3) * 3 + 1).padStart(2, '0')}`;
  const presets = [
    { label: t.thisMonth, from: now, to: now },
    { label: t.lastMonth, from: shift(now, -1), to: shift(now, -1) },
    { label: t.thisQuarter, from: quarterStart, to: now },
    { label: t.thisYear, from: `${now.slice(0, 4)}-01`, to: now },
  ];
  const monthLabel = (p: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(`${p}-01T00:00:00Z`));

  const tot = r?.totals;
  const collectedPct = tot && tot.commission > 0 ? Math.round((tot.received / tot.commission) * 100) : 0;
  const trendMax = Math.max(1, ...(r?.trend ?? []).map((x) => Math.max(x.commission, x.received)));
  const kindMax = Math.max(1, ...(r?.byKind ?? []).map((k) => k.commission));

  return (
    <div className="flex flex-col gap-6" data-testid="reports-page">
      <PremiumPageHero
        eyebrow={m.list.title}
        title={t.title}
        description={t.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/deals' },
          { label: t.title },
        ]}
      >
        {tot && (
          <PremiumMetricStrip
            cols={4}
            metrics={[
              { label: t.kpiCommission, value: compact(tot.commission), sub: t.dealsSub(tot.deals) },
              { label: t.kpiReceived, value: compact(tot.received), sub: t.collectedSub(collectedPct) },
              { label: t.kpiShares, value: compact(tot.staffShares + tot.bonuses), sub: t.sharesSub(compact(tot.staffSharesPaid + tot.bonusesPaid)) },
              { label: t.kpiNet, value: compact(tot.companyNet), sub: t.netSub, primary: true },
            ]}
          />
        )}
      </PremiumPageHero>

      <DealsTabs active="reports" locale={locale} isAdmin />

      <nav aria-label={t.title} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {presets.map((p) => {
          const on = p.from === from && p.to === to;
          return (
            <Link
              key={p.label}
              href={`/dashboard/deals/reports?from=${p.from}&to=${p.to}` as never}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-[13px] font-bold transition-colors',
                on
                  ? 'border-[#0E1626] bg-[#0E1626] text-[#F4ECD8] dark:border-[#D8B66A] dark:bg-[#D8B66A] dark:text-[#0E1626]'
                  : 'border-hairline bg-surface text-slate-600 hover:border-[#D8B66A]/50 hover:text-slate-900',
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      <PremiumFilterBar
        method="get"
        action="/dashboard/deals/reports"
        summary={<span className="text-[14px] font-semibold text-slate-700">{from === to ? monthLabel(from, { month: 'long', year: 'numeric' }) : `${monthLabel(from, { month: 'short', year: 'numeric' })} — ${monthLabel(to, { month: 'short', year: 'numeric' })}`}</span>}
        trailing={<Button type="submit" variant="primary" size="sm">{t.show}</Button>}
      >
        <PremiumFilterField label={t.from} htmlFor="from">
          <Input id="from" name="from" type="month" defaultValue={from} max={now} />
        </PremiumFilterField>
        <PremiumFilterField label={t.to} htmlFor="to">
          <Input id="to" name="to" type="month" defaultValue={to} max={now} />
        </PremiumFilterField>
      </PremiumFilterBar>

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {r && tot && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
            {/* The 12 months: commission (gold) and collected (green) side by side. */}
            <Panel icon={<BarChart3 />} title={t.trend} sub={t.trendSub} className="lg:col-span-2" testId="report-trend">
              <div className="mb-4 flex items-center gap-4 text-[12px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#C79A3B]" />{t.legendCommission}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#5E7F6B]" />{t.legendReceived}</span>
              </div>
              <div className="flex h-[200px] items-end gap-1.5 border-b border-hairline sm:gap-2.5" role="img" aria-label={r.trend.map((x) => `${x.month} ${x.commission}`).join('، ')}>
                {r.trend.map((x) => {
                  const inRange = x.month >= from && x.month <= to;
                  return (
                    <div key={x.month} className="group relative flex h-full flex-1 items-end justify-center gap-[3px]">
                      <span
                        className={cn('w-full max-w-[16px] rounded-t-md', x.commission > 0 ? 'bg-gradient-to-b from-[#D8B66A] to-[#B38B3A]' : 'bg-surface-sunken', !inRange && 'opacity-45')}
                        style={{ height: x.commission > 0 ? `${Math.max(4, (x.commission / trendMax) * 92)}%` : '3px' }}
                      />
                      <span
                        className={cn('w-full max-w-[16px] rounded-t-md', x.received > 0 ? 'bg-[#5E7F6B]' : 'bg-surface-sunken', !inRange && 'opacity-45')}
                        style={{ height: x.received > 0 ? `${Math.max(4, (x.received / trendMax) * 92)}%` : '3px' }}
                      />
                      {x.commission > 0 && (
                        <span className="num pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded-md bg-[#0E1626] px-2 py-1 text-[11px] font-bold text-[#F4ECD8] group-hover:block">
                          {compact(x.commission)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1.5 sm:gap-2.5">
                {r.trend.map((x) => (
                  <span key={x.month} className={cn('flex-1 truncate text-center text-[11px]', x.month >= from && x.month <= to ? 'font-bold text-brand-700' : 'text-slate-400')}>
                    <span className="num sm:hidden">{Number(x.month.slice(5))}</span>
                    <span className="hidden sm:inline">{monthLabel(x.month, { month: 'short' })}</span>
                  </span>
                ))}
              </div>
            </Panel>

            {/* From commission to what the company keeps. */}
            <Panel icon={<Scale />} title={t.breakdown} testId="report-breakdown">
              <dl className="space-y-3 text-[13.5px]">
                {[
                  [t.kpiCommission, tot.commission, 'text-slate-900'],
                  [t.bShares, -tot.staffShares, 'text-slate-600'],
                  [t.bBonuses, -tot.bonuses, 'text-slate-600'],
                ].map(([k, v, cls]) => (
                  <div key={String(k)} className="flex items-baseline justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className={cn('num font-bold', String(cls))}>{Number(v) < 0 ? `− ${money(-Number(v))}` : money(Math.abs(Number(v)))}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
                  <dt className="font-bold text-slate-900">{t.bNet}</dt>
                  <dd className="num font-heading text-[22px] font-bold text-brand-700">{money(tot.companyNet)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 rounded-xl bg-amber-500/10 px-3 py-2">
                  <dt className="text-[12.5px] text-amber-800 dark:text-amber-300">{t.bOutstanding}</dt>
                  <dd className="num text-[13px] font-bold text-amber-800 dark:text-amber-300">{money(tot.outstanding)}</dd>
                </div>
              </dl>
            </Panel>
          </div>

          <section>
            <h2 className="mb-3 font-heading text-[17px] font-bold text-slate-900">{t.byKind}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {r.byKind.map((k) => {
                const Icon = KIND_ICON[k.kind];
                return (
                  <div key={k.kind} className="rounded-[20px] border border-hairline bg-surface p-5" data-testid={`report-kind-${k.kind}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5 text-[14px] font-bold text-slate-900">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8B66A]/45 bg-[#0E1626] text-[#E6C77E]"><Icon className="h-4 w-4" /></span>
                        {lm.kind[k.kind]}
                      </span>
                      <span className="num text-[12.5px] font-semibold text-slate-500">{t.dealsSub(k.deals)}</span>
                    </div>
                    <p className="num mt-4 text-[20px] font-bold text-slate-900">{money(k.commission)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-500/15">
                      <div className="h-full rounded-full bg-[#C79A3B]" style={{ width: `${(k.commission / kindMax) * 100}%` }} />
                    </div>
                    <p className="num mt-2 text-[12px] text-slate-500">{m.list.colValue}: {compact(k.dealValue)}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <Panel icon={<Users />} title={t.byAgent} sub={t.byAgentSub} testId="report-agents">
            {r.byAgent.length === 0 ? (
              <PremiumEmptyState icon={<Users />} title={t.empty} />
            ) : (
              <ol className="divide-y divide-hairline">
                {r.byAgent.map((a, i) => (
                  <li key={a.userId} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn('num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold', i === 0 ? 'bg-[#0E1626] text-[#E6C77E]' : 'bg-slate-500/10 text-slate-600')}>{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-slate-900">{a.fullName}</p>
                        <p className="num text-[12px] text-slate-500">{t.dealsSub(a.deals)}</p>
                      </div>
                    </div>
                    <dl className="flex gap-6 text-end">
                      <div>
                        <dt className="text-[11.5px] text-slate-500">{t.colCommission}</dt>
                        <dd className="num text-[14px] font-bold text-slate-900">{money(a.commission)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] text-slate-500">{t.colShares}</dt>
                        <dd className="num text-[14px] font-bold text-brand-700">{money(a.shares)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
