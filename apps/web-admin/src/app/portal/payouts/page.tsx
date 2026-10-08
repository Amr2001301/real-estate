import Link from 'next/link';
import {
  Wallet,
  Eye,
  Clock,
  CircleDollarSign,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { CodeText } from '@/components/ui/code-text';
import { api, safe } from '@/lib/api';
import type { Paged, PortalPayout } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerPayoutStatusBadge } from '@/components/badges';
import { PayoutsFilterBar } from '@/components/broker/payouts-filter-bar';
import {
  PremiumPageHero,
  PremiumMetricStrip,
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

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: t.metrics.total, value: paged?.meta.total ?? 0, icon: <Wallet />,          tone: 'brand'   },
          { label: t.metrics.paid, value: paidCount,              icon: <CircleDollarSign />, tone: 'success' },
          { label: t.metrics.processing, value: processingCount,        icon: <Loader2 />,          tone: 'warning' },
          { label: t.metrics.approved, value: approvedCount,           icon: <Clock />,            tone: 'info'    },
        ]}
      />

      <PayoutsFilterBar locale={locale} sp={{ q: sp.q, status: sp.status, period: sp.period, from: sp.from, to: sp.to }} />

      <PremiumSectionCard
        icon={<Wallet />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
              <span>{t.countUnit}</span>
            </div>
            {pageNet > 0 && (
              <>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  {t.pageNet}{' '}
                  <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(pageNet, currency)}</span>
                </span>
              </>
            )}
            {paidNet > 0 && (
              <>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  {t.paidOf}{' '}
                  <span className="font-semibold text-success-700 tabular-nums">{formatCurrency(paidNet, currency)}</span>
                </span>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">{t.cols.payoutPeriod}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.net}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.status}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.method}</th>
                <th className="text-start font-semibold py-3 px-4">{t.cols.reference}</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<Wallet />}
                      title={t.emptyTitle}
                      description={t.emptyDescription}
                    />
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const isCancelled  = p.status === 'CANCELLED';
                const isPaid       = p.status === 'PAID';
                const isProcessing = p.status === 'PROCESSING';

                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-t border-hairline transition-colors align-top',
                      isPaid
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                        : isCancelled
                          ? 'bg-slate-50/60 hover:bg-slate-100/40'
                          : 'hover:bg-surface-muted/40',
                    )}
                  >
                    <td className="py-3 ps-5 pe-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-brand-700 font-semibold">
                        <Wallet className="h-3 w-3 text-brand-500 shrink-0" />
                        <CodeText>{p.payoutNumber}</CodeText>
                      </span>
                      {p.period && (
                        <p className="mt-0.5">
                          <CodeText className="text-2xs text-slate-400">{p.period}</CodeText>
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <p
                        className={cn(
                          'text-sm font-bold tabular-nums',
                          isCancelled
                            ? 'text-slate-400 line-through'
                            : isPaid
                              ? 'text-success-700'
                              : 'text-slate-900',
                        )}
                      >
                        {formatCurrency(p.totalNet, currency)}
                      </p>
                      {isPaid && (
                        <p className="text-2xs text-success-600 mt-0.5 flex items-center gap-0.5 font-medium">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          {t.paidOut}
                        </p>
                      )}
                      {isProcessing && (
                        <p className="text-2xs text-amber-600 mt-0.5 flex items-center gap-0.5 font-medium">
                          <Loader2 className="h-3 w-3 shrink-0" />
                          {t.processing}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <BrokerPayoutStatusBadge status={p.status} locale={locale} />
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-xs text-slate-700">
                        {p.paymentMethod ? (
                          m.payouts.method[p.paymentMethod] ?? p.paymentMethod
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </p>
                      <p className="text-2xs text-slate-500 mt-0.5 whitespace-nowrap">
                        {p.paidAt ? (
                          formatDate(p.paidAt)
                        ) : (
                          <span className="text-slate-400 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t.notPaidYet}
                          </span>
                        )}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      {p.paymentReference ? (
                        <CodeText className="text-2xs text-slate-500">{p.paymentReference}</CodeText>
                      ) : (
                        <span className="text-slate-400 text-2xs">—</span>
                      )}
                    </td>

                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/portal/payouts/${p.id}` as never}>
                        <IconButton label={m.common.view} variant="ghost" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
