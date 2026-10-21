import Link from 'next/link';
import { Wallet, Eye, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalPayout } from '@/lib/types';
import { formatDate, formatCurrency, compactParts, intlLocale } from '@/lib/format';
import { Amount, FigureBar } from '@/components/cockpit/cockpit';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale, type Locale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';
import { cn } from '@/lib/cn';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerPayoutStatusBadge } from '@/components/badges';
import { PayoutsFilterBar } from '@/components/broker/payouts-filter-bar';
import {
  PremiumPageHero,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  q?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function PortalPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalMoneyTeamT(locale);
  const t = m.payouts.list;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const word = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['q', 'status', 'period', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [r, rPaid, rApproved, rProcessing] = await Promise.all([
    safe(api.get<Paged<PortalPayout>>(`/portal/payouts?${qs.toString()}`)),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?page=1&pageSize=1&status=PAID')),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?page=1&pageSize=1&status=PROCESSING')),
  ]);

  const paged           = r.data;
  const rows            = paged?.data ?? [];
  const paidCount       = rPaid.data?.meta.total       ?? 0;
  const approvedCount   = rApproved.data?.meta.total   ?? 0;
  const processingCount = rProcessing.data?.meta.total ?? 0;

  const pageNet = rows.reduce((s, p) => s + Number(p.totalNet || 0), 0);
  const paidNet = rows
    .filter((p) => p.status === 'PAID')
    .reduce((s, p) => s + Number(p.totalNet || 0), 0);

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: m.common.breadcrumbPortal, href: '/portal' },
          { label: t.breadcrumb },
        ]}
      />

      {r.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadError(r.error)}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={5}
          figures={[
            { label: t.metrics.total, value: paged?.meta.total ?? 0 },
            { label: t.metrics.paid, value: paidCount },
            { label: t.metrics.processing, value: processingCount, warn: processingCount > 0 },
            { label: t.metrics.approved, value: approvedCount },
            {
              label: word('المدفوع', 'Paid out'),
              value: paidNet > 0 ? <Amount parts={compactParts(paidNet, symbol, locale)} /> : '—',
              sub: pageNet > 0
                ? `${word('من', 'of')} ${compactParts(pageNet, symbol, locale).join(' ')} · ${word('هذه الصفحة', 'this page')}`
                : word('هذه الصفحة', 'This page'),
            },
          ]}
        />
      </section>

      <PayoutsFilterBar locale={locale} sp={{ q: sp.q, status: sp.status, period: sp.period, from: sp.from, to: sp.to }} />

      <PremiumSectionCard
        icon={<Wallet />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState icon={<Wallet />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-payout-rows">
            {rows.map((p) => {
              const isCancelled = p.status === 'CANCELLED';
              const isPaid = p.status === 'PAID';
              const isProcessing = p.status === 'PROCESSING';
              return (
                <li
                  key={p.id}
                  data-testid="portal-payout-row"
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_130px_180px_36px]"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                    <Wallet className="h-[18px] w-[18px]" />
                  </span>

                  {/* Payout code + period */}
                  <div className="min-w-0">
                    <Link
                      href={`/portal/payouts/${p.id}` as never}
                      className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700"
                    >
                      <span className="me-1.5 text-[12px] font-semibold text-slate-400">{word('دفعة', 'Payout')}</span>
                      <span className="whitespace-nowrap font-mono" dir="ltr">{p.payoutNumber}</span>
                    </Link>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">
                      {p.period ? <>{word('عن', 'For')} {periodLabel(p.period, locale)}</> : '—'}
                    </p>
                  </div>

                  {/* Method + paid date */}
                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-500">{t.cols.method}</p>
                    <p className="font-semibold text-slate-800">
                      {p.paymentMethod ? (m.payouts.method[p.paymentMethod] ?? p.paymentMethod) : '—'}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-[12px] text-slate-500">
                      {p.paidAt ? (
                        <bdi>{formatDate(p.paidAt, locale)}</bdi>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="h-3 w-3" />
                          {t.notPaidYet}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Reference */}
                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-500">{t.cols.reference}</p>
                    {p.paymentReference ? (
                      <p className="truncate font-mono text-slate-700" dir="ltr">{p.paymentReference}</p>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )}
                  </div>

                  <div className="hidden lg:block">
                    <BrokerPayoutStatusBadge status={p.status} locale={locale} />
                  </div>

                  {/* Net */}
                  <div className="flex items-center gap-3 justify-self-end">
                    <span className="lg:hidden"><BrokerPayoutStatusBadge status={p.status} locale={locale} /></span>
                    <div className="text-end">
                      <p
                        className={cn(
                          'whitespace-nowrap text-[15px] font-bold tabular-nums',
                          isCancelled ? 'text-slate-400 line-through' : isPaid ? 'text-success-700' : 'text-slate-900',
                        )}
                      >
                        {formatCurrency(p.totalNet, currency, locale)}
                      </p>
                      {isPaid && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-success-600">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          {t.paidOut}
                        </p>
                      )}
                      {isProcessing && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-600">
                          <Loader2 className="h-3 w-3 shrink-0" />
                          {t.processing}
                        </p>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/portal/payouts/${p.id}` as never}
                    aria-label={m.common.view}
                    title={m.common.view}
                    className="hidden h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900 lg:inline-flex"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/payouts"
            locale={locale}
            params={{ q: sp.q, status: sp.status, period: sp.period, from: sp.from, to: sp.to }}
          />
        )}
      </PremiumSectionCard>

      <p className="text-2xs text-slate-400 text-center">
        {t.footnote}
      </p>
    </div>
  );
}

/** "2026-09" → "سبتمبر 2026" / "September 2026"; anything else as given. */
function periodLabel(period: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
