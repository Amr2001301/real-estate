import Link from 'next/link';
import { Plus, Handshake, Building2, UserRound } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged } from '@/lib/types';
import { compactParts, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { PremiumPageHero, PremiumMetricStrip, PremiumFilterBar, PremiumFilterField, PremiumEmptyState } from '@/components/premium';
import { KindTag } from '@/components/listings/listing-card';
import { listingsT, LISTING_KINDS, type ListingKind } from '@/components/listings/messages';
import { dealsT, DEAL_STATUSES, type DealRow } from '@/components/deals/messages';
import { CollectedBar, DealsTabs, DEAL_TONE, Pill, CLAIM_TONE } from './_components/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;
const KIND_COLORS = { PRIMARY: '#F4ECD8', RESALE: '#C79A3B', RENT: '#5E7F6B' } as const;

/**
 * BRK-3 «الصفقات والعمولات» — the brokerage's closed deals: the navy band
 * with the sales and the commission collected, the kind tabs, and each deal
 * with its value, commission and how much of it is in.
 */
export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; q?: string; page?: string }>;
}) {
  const [sp, locale, currency, session] = await Promise.all([searchParams, getLocale(), getReportsCurrency(), getSession()]);
  const m = dealsT(locale);
  const lm = listingsT(locale);
  const symbol = currencySymbol(currency, locale);
  const kind = LISTING_KINDS.includes(sp.kind as ListingKind) ? (sp.kind as ListingKind) : undefined;
  const status = DEAL_STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const isAdmin = session?.role === 'ADMIN';

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (kind) qs.set('kind', kind);
  if (status) qs.set('status', status);
  if (q) qs.set('q', q);

  const [pagedRes, allRes] = await Promise.all([
    safe(api.get<Paged<DealRow>>(`/deals?${qs.toString()}`)),
    safe(api.get<Paged<DealRow>>('/deals?pageSize=1')),
  ]);
  const rows = pagedRes.data?.data ?? [];
  const total = pagedRes.data?.meta.total ?? 0;
  const tabCounts = pagedRes.data?.meta.facets?.counts?.kind ?? {};
  const all = allRes.data?.meta.facets;
  const byStatus = all?.counts?.status ?? {};
  const byKind = all?.counts?.kind ?? {};
  const sums = all?.sums ?? {};
  const commission = Number(sums.commission ?? 0);
  const received = Number(sums.received ?? 0);
  const collectedPct = commission > 0 ? Math.round((received / commission) * 100) : 0;
  const filtered = Boolean(kind || status || q);
  const money = (v: string | number) => formatCurrency(v, currency, locale);
  const compact = (v: number) => compactParts(v, symbol, locale).join(' ');

  const href = (k?: ListingKind) => {
    const p = new URLSearchParams();
    if (k) p.set('kind', k);
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    const s = p.toString();
    return `/dashboard/deals${s ? `?${s}` : ''}`;
  };
  const tabTotal = Object.values(tabCounts).reduce((a, n) => a + n, 0);
  const addButton = (
    <Link href={'/dashboard/deals/new' as never}>
      <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.list.add}</Button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6" data-testid="deals-page">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.list.title}
        description={m.list.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: m.list.title }]}
        actions={addButton}
      >
        <PremiumMetricStrip
          cols={4}
          metrics={[
            { label: m.list.kpiDeals, value: byStatus.CLOSED ?? 0, sub: m.list.kpiDealsSub(byStatus.CANCELLED ?? 0) },
            { label: m.list.kpiValue, value: compact(Number(sums.dealValue ?? 0)) },
            { label: m.list.kpiCommission, value: compact(commission), sub: `${m.list.kpiReceived} ${compact(received)}` },
            { label: m.list.kpiOutstanding, value: compact(Number(sums.outstanding ?? 0)), sub: m.list.collectedPct(collectedPct) },
          ]}
          distribution={LISTING_KINDS.map((k) => ({ label: lm.kind[k], value: byKind[k] ?? 0, color: KIND_COLORS[k] }))}
        />
      </PremiumPageHero>

      <DealsTabs active="deals" locale={locale} isAdmin={isAdmin} />

      {pagedRes.error && (
        <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{pagedRes.error}</div>
      )}

      <nav aria-label={lm.list.title} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[undefined, ...LISTING_KINDS].map((k) => {
          const active = k === kind;
          const n = k ? tabCounts[k] ?? 0 : tabTotal;
          return (
            <Link
              key={k ?? 'all'}
              href={href(k) as never}
              data-testid={`deal-kind-${k ?? 'ALL'}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold transition-colors',
                active
                  ? 'border-[#0E1626] bg-[#0E1626] text-[#F4ECD8] dark:border-[#D8B66A] dark:bg-[#D8B66A] dark:text-[#0E1626] dark:[&>span]:text-[#0E1626]/70'
                  : 'border-hairline bg-surface text-slate-600 hover:border-[#D8B66A]/50 hover:text-slate-900',
              )}
            >
              {k ? lm.kind[k] : m.list.all}
              <span className={cn('num text-[12px]', active ? 'text-[#D8B66A]' : 'text-slate-400')}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <PremiumFilterBar
        method="get"
        action="/dashboard/deals"
        summary={
          <span className="text-slate-700">
            <span className="num text-[20px] font-semibold text-slate-900">{total}</span> {m.list.results(total).replace(/^\d+\s*/, '')}
          </span>
        }
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{m.list.apply}</Button>
            {filtered && (
              <Link href={'/dashboard/deals' as never}>
                <Button type="button" variant="ghost" size="sm">{m.list.clear}</Button>
              </Link>
            )}
          </div>
        }
      >
        {kind && <input type="hidden" name="kind" value={kind} />}
        <PremiumFilterField label={m.list.search} htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ''} placeholder={m.list.searchPlaceholder} />
        </PremiumFilterField>
        <PremiumFilterField label={m.list.statusFilter} htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ''}>
            <option value="">{m.list.anyStatus}</option>
            {DEAL_STATUSES.map((s) => <option key={s} value={s}>{m.status[s]}</option>)}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState
            icon={<Handshake />}
            title={filtered ? m.list.noMatch : m.list.empty}
            description={filtered ? undefined : m.list.emptyHint}
            action={filtered ? undefined : addButton}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
          {/* Column heads on wide screens; each row reads as a card on a phone. */}
          <div className="hidden grid-cols-[1.1fr_1.5fr_1fr_1fr_1.3fr] gap-4 border-b border-hairline bg-surface-muted/40 px-6 py-3 text-[11.5px] font-bold uppercase tracking-wide text-slate-500 lg:grid">
            <span>{m.list.colDeal}</span>
            <span>{m.list.colCustomer}</span>
            <span>{m.list.colAgent}</span>
            <span className="text-end">{m.list.colValue}</span>
            <span className="text-end">{m.list.colCommission}</span>
          </div>
          <ul className="divide-y divide-hairline" data-testid="deals-list">
            {rows.map((d) => {
              const comm = Number(d.commissionTotal);
              const got = Number(d.commissionReceived);
              const cancelled = d.status === 'CANCELLED';
              return (
                <li key={d.id}>
                  <Link
                    href={`/dashboard/deals/${d.id}` as never}
                    data-testid={`deal-row-${d.code}`}
                    className={cn(
                      'grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-[#D8B66A]/[0.05] sm:px-6 lg:grid-cols-[1.1fr_1.5fr_1fr_1fr_1.3fr] lg:items-center',
                      cancelled && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="num text-[14.5px] font-bold text-slate-900">{d.code}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <KindTag kind={d.kind} locale={locale} />
                        {cancelled ? <Pill tone={DEAL_TONE.CANCELLED}>{m.status.CANCELLED}</Pill> : d.claim && <Pill tone={CLAIM_TONE[d.claim.status]}>{m.claimStatus[d.claim.status]}</Pill>}
                      </div>
                    </div>
                    <div className="min-w-0 text-end lg:text-start">
                      <p className="truncate text-[14px] font-bold text-slate-900">{d.customerName}</p>
                      <p className="mt-1 flex items-center justify-end gap-1.5 truncate text-[12.5px] text-slate-500 lg:justify-start">
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{d.listing ? `${d.listing.code} · ${d.listing.title}` : m.list.noListing}</span>
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-700">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
                        <span className="truncate">{d.agent?.fullName ?? m.list.noAgent}</span>
                      </p>
                      <p className="mt-1 text-[12px] text-slate-500">{formatDate(d.closedOn, locale)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-[11px] font-semibold text-slate-500 lg:hidden">{m.list.colValue}</p>
                      <p className="num text-[14px] font-bold text-slate-900">{money(d.dealValue)}</p>
                    </div>
                    <div className="col-span-2 lg:col-span-1">
                      <div className="flex items-baseline justify-between gap-2 lg:justify-end">
                        <span className="text-[11px] font-semibold text-slate-500 lg:hidden">{m.list.colCommission}</span>
                        <span className="num text-[14px] font-bold text-slate-900">{money(comm)}</span>
                      </div>
                      <CollectedBar value={got} total={comm} className="mt-2" />
                      <p className="num mt-1 text-end text-[11.5px] text-slate-500">
                        {m.list.colCollected} {money(got)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/dashboard/deals"
        params={{ ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}) }}
        locale={locale}
      />
    </div>
  );
}
