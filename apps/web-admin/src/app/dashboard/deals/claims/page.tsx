import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { compactParts, formatDate, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumMetricStrip, PremiumEmptyState } from '@/components/premium';
import { dealsT, CLAIM_STATUSES, type ClaimsPayload, type ClaimStatus } from '@/components/deals/messages';
import { CLAIM_TONE, CollectedBar, DealsTabs, Pill } from '../_components/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const STATUS_COLORS: Record<ClaimStatus, string> = { PENDING: '#8A8F99', SUBMITTED: '#F4ECD8', PARTIALLY_PAID: '#C79A3B', PAID: '#5E7F6B', REJECTED: '#B5543F' };

/** BRK-3 — what developers owe on primary sales; the admin's page. */
export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [sp, locale, currency, session] = await Promise.all([searchParams, getLocale(), getReportsCurrency(), getSession()]);
  if (session?.role !== 'ADMIN') redirect('/dashboard/deals');
  const m = dealsT(locale);
  const t = m.claims;
  const symbol = currencySymbol(currency, locale);
  const status = CLAIM_STATUSES.find((s) => s === sp.status);
  const res = await safe(api.get<ClaimsPayload>(`/deals/claims${status ? `?status=${status}` : ''}`));
  const data = res.data;
  const rows = data?.data ?? [];
  const counts = data?.counts ?? {};
  const totals = data?.totals ?? { claimed: 0, paid: 0, outstanding: 0 };
  const compact = (n: number) => compactParts(n, symbol, locale).join(' ');
  const money = (v: number | string) => formatExactCurrency(v, currency, locale);
  const open = (counts.PENDING ?? 0) + (counts.SUBMITTED ?? 0) + (counts.PARTIALLY_PAID ?? 0);
  const paidPct = totals.claimed > 0 ? Math.round((totals.paid / totals.claimed) * 100) : 0;
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col gap-6" data-testid="claims-page">
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
        <PremiumMetricStrip
          cols={4}
          metrics={[
            { label: t.kpiClaimed, value: compact(totals.claimed) },
            { label: t.kpiPaid, value: compact(totals.paid), sub: m.list.collectedPct(paidPct) },
            { label: t.kpiOutstanding, value: compact(totals.outstanding) },
            { label: t.kpiOpen, value: open },
          ]}
          distribution={CLAIM_STATUSES.map((s) => ({ label: m.claimStatus[s], value: counts[s] ?? 0, color: STATUS_COLORS[s] }))}
        />
      </PremiumPageHero>

      <DealsTabs active="claims" locale={locale} isAdmin />

      <nav aria-label={t.colStatus} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[undefined, ...CLAIM_STATUSES].map((s) => {
          const active = s === status;
          const n = s ? counts[s] ?? 0 : Object.values(counts).reduce((a, x) => a + x, 0);
          return (
            <Link
              key={s ?? 'all'}
              href={(s ? `/dashboard/deals/claims?status=${s}` : '/dashboard/deals/claims') as never}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold transition-colors',
                active
                  ? 'border-[#0E1626] bg-[#0E1626] text-[#F4ECD8] dark:border-[#D8B66A] dark:bg-[#D8B66A] dark:text-[#0E1626] dark:[&>span]:text-[#0E1626]/70'
                  : 'border-hairline bg-surface text-slate-600 hover:border-[#D8B66A]/50 hover:text-slate-900',
              )}
            >
              {s ? m.claimStatus[s] : m.list.all}
              <span className={cn('num text-[12px]', active ? 'text-[#D8B66A]' : 'text-slate-400')}>{n}</span>
            </Link>
          );
        })}
      </nav>

      {res.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{res.error}</div>}

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-hairline bg-surface">
          <PremiumEmptyState icon={<FileClock />} title={t.empty} description={t.emptyHint} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="claims-list">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/deals/${c.deal.id}` as never}
                className="group flex h-full flex-col rounded-[22px] border border-hairline bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-[#D8B66A]/50 hover:shadow-[0_18px_36px_-22px_rgb(10_17_32/0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-500">
                      <span className="num">{c.code}</span> · <span className="num">{c.deal.code}</span>
                    </p>
                    <p className="mt-1 truncate font-heading text-[17px] font-bold text-slate-900">{c.developerName}</p>
                  </div>
                  <Pill tone={CLAIM_TONE[c.status]}>{m.claimStatus[c.status]}</Pill>
                </div>
                <p className="mt-2 truncate text-[12.5px] text-slate-500">
                  {c.deal.customerName}
                  {c.deal.listing ? ` · ${c.deal.listing.title}` : ''}
                </p>
                <div className="mt-auto pt-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="num text-[18px] font-bold text-slate-900">{money(c.amount)}</span>
                    <span className="num text-[12px] text-slate-500">
                      {t.colPaid} {money(c.paid)}
                    </span>
                  </div>
                  <CollectedBar value={c.paid} total={Number(c.amount)} className="mt-2" />
                  <p className="mt-3 flex items-center justify-between text-[12px] text-slate-500">
                    <span>{c.submittedOn ? `${m.detail.submittedOn} ${formatDate(c.submittedOn, locale)}` : m.detail.notSubmitted}</span>
                    <span className="inline-flex items-center gap-0.5 font-bold text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
                      {t.open} <Chevron className="h-3.5 w-3.5" />
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
