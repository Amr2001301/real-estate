import Link from 'next/link';
import { Plus, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, UnitTypeOption } from '@/lib/types';
import { tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { PremiumPageHero, PremiumMetricStrip, PremiumFilterBar, PremiumFilterField, PremiumEmptyState } from '@/components/premium';
import { ListingCard } from '@/components/listings/listing-card';
import { listingsT, LISTING_KINDS, LISTING_STATUSES, type Listing, type ListingKind } from '@/components/listings/messages';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 12;

/** The band's foot: the listings by status, light to deep. */
const STATUS_COLORS = { AVAILABLE: '#F4ECD8', UNDER_OFFER: '#C79A3B', CLOSED: '#5E7F6B', WITHDRAWN: '#8A8F99' } as const;

/**
 * BRK-2 «الوحدات المعروضة» — a brokerage's listings: the navy band with the
 * whole inventory by kind and status, the kind tabs, search and status, and
 * the listings as photo cards.
 */
export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; q?: string; page?: string }>;
}) {
  const [sp, locale, currency] = await Promise.all([searchParams, getLocale(), getReportsCurrency()]);
  const m = listingsT(locale);
  const symbol = currencySymbol(currency, locale);
  const kind = LISTING_KINDS.includes(sp.kind as ListingKind) ? (sp.kind as ListingKind) : undefined;
  const status = LISTING_STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (kind) qs.set('kind', kind);
  if (status) qs.set('status', status);
  if (q) qs.set('q', q);

  const [pagedRes, allRes, typesRes] = await Promise.all([
    safe(api.get<Paged<Listing>>(`/listings?${qs.toString()}`)),
    // The whole inventory, for the band (one row; the counts are the server's).
    safe(api.get<Paged<Listing>>('/listings?pageSize=1')),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
  ]);
  const rows = pagedRes.data?.data ?? [];
  const total = pagedRes.data?.meta.total ?? 0;
  const tabCounts = pagedRes.data?.meta.facets?.counts?.kind ?? {};
  const all = allRes.data?.meta;
  const byKind = all?.facets?.counts?.kind ?? {};
  const byStatus = all?.facets?.counts?.status ?? {};
  const typeName = new Map((typesRes.data ?? []).map((t) => [t.code, tx(t.name, locale)]));
  const filtered = Boolean(kind || status || q);

  const href = (k?: ListingKind) => {
    const p = new URLSearchParams();
    if (k) p.set('kind', k);
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    const s = p.toString();
    return `/dashboard/listings${s ? `?${s}` : ''}`;
  };
  const tabTotal = Object.values(tabCounts).reduce((a, n) => a + n, 0);

  return (
    <div className="flex flex-col gap-6" data-testid="listings-page">
      <PremiumPageHero
        eyebrow={m.list.eyebrow}
        title={m.list.title}
        description={m.list.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: m.list.title }]}
        actions={
          <Link href={'/dashboard/listings/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.list.add}</Button>
          </Link>
        }
      >
        <PremiumMetricStrip
          cols={4}
          metrics={[
            { label: m.list.kpiTotal, value: all?.total ?? 0, sub: m.list.kpiAvailableSub(byStatus.UNDER_OFFER ?? 0) },
            ...LISTING_KINDS.map((k) => ({ label: m.kind[k], value: byKind[k] ?? 0, sub: m.kindHint[k] })),
          ]}
          distribution={LISTING_STATUSES.map((s) => ({ label: m.status[s], value: byStatus[s] ?? 0, color: STATUS_COLORS[s] }))}
        />
      </PremiumPageHero>

      {pagedRes.error && (
        <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{pagedRes.error}</div>
      )}

      {/* Kind tabs: counts within the search and status filters. */}
      <nav aria-label={m.list.title} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[undefined, ...LISTING_KINDS].map((k) => {
          const active = k === kind;
          const n = k ? tabCounts[k] ?? 0 : tabTotal;
          return (
            <Link
              key={k ?? 'all'}
              href={href(k) as never}
              data-testid={`kind-tab-${k ?? 'ALL'}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold transition-colors',
                active
                  ? 'border-[#0E1626] bg-[#0E1626] text-[#F4ECD8] dark:border-[#D8B66A] dark:bg-[#D8B66A] dark:text-[#0E1626] dark:[&>span]:text-[#0E1626]/70'
                  : 'border-hairline bg-surface text-slate-600 hover:border-[#D8B66A]/50 hover:text-slate-900',
              )}
            >
              {k ? m.kind[k] : m.list.all}
              <span className={cn('num text-[12px]', active ? 'text-[#D8B66A]' : 'text-slate-400')}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <PremiumFilterBar
        method="get"
        action="/dashboard/listings"
        summary={
          <span className="text-slate-700">
            <span className="num text-[20px] font-semibold text-slate-900">{total}</span> {m.list.results(total).replace(/^\d+\s*/, '')}
          </span>
        }
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{m.list.apply}</Button>
            {filtered && (
              <Link href={'/dashboard/listings' as never}>
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
            {LISTING_STATUSES.map((s) => <option key={s} value={s}>{m.status[s]}</option>)}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState
            icon={<Building2 />}
            title={filtered ? m.list.noMatch : m.list.empty}
            description={filtered ? undefined : m.list.emptyHint}
            action={
              filtered ? undefined : (
                <Link href={'/dashboard/listings/new' as never}>
                  <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.list.add}</Button>
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((l) => (
            <ListingCard key={l.id} listing={l} symbol={symbol} locale={locale} typeName={typeName.get(l.unitType) ?? l.unitType} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/dashboard/listings"
        params={{ ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}) }}
        locale={locale}
      />
    </div>
  );
}
