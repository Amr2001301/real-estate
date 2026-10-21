import Link from 'next/link';
import { BadgePercent, Eye, AlertCircle, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalCommission, PortalProject } from '@/lib/types';
import { tx, formatDate, formatCurrency, compactParts } from '@/lib/format';
import { Amount, FigureBar } from '@/components/cockpit/cockpit';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerCommissionStatusBadge } from '@/components/badges';
import { CommissionsFilterBar } from '@/components/broker/commissions-filter-bar';
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
  projectId?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function PortalCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = portalMoneyTeamT(locale);
  const t = m.commissions.list;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const word = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['q', 'status', 'projectId', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [commRes, projectsRes, rPending, rApproved, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalCommission>>(`/portal/commissions?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalCommission>>('/portal/commissions?page=1&pageSize=1&status=PENDING')),
    safe(api.get<Paged<PortalCommission>>('/portal/commissions?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalCommission>>('/portal/commissions?page=1&pageSize=1&status=REJECTED')),
  ]);

  const paged         = commRes.data;
  const rows          = paged?.data ?? [];
  const projects      = projectsRes.data ?? [];
  const pendingCount  = rPending.data?.meta.total  ?? 0;
  const approvedCount = rApproved.data?.meta.total ?? 0;
  const rejectedCount = rRejected.data?.meta.total ?? 0;

  const pageNet   = rows.reduce((sum, r) => sum + Number(r.netAmount   || 0), 0);

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

      {commRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadError(commRes.error)}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={5}
          figures={[
            { label: t.metrics.total, value: paged?.meta.total ?? 0 },
            { label: t.metrics.pending, value: pendingCount, warn: pendingCount > 0 },
            { label: t.metrics.approved, value: approvedCount },
            { label: t.metrics.rejected, value: rejectedCount },
            {
              label: word('صافي العمولات', 'Net commissions'),
              value: pageNet > 0 ? <Amount parts={compactParts(pageNet, symbol, locale)} /> : '—',
              sub: locale === 'en' ? 'This page' : 'هذه الصفحة',
            },
          ]}
        />
      </section>

      <CommissionsFilterBar projects={projects} locale={locale} sp={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }} />

      <PremiumSectionCard
        icon={<BadgePercent />}
        title={t.tableTitle}
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState icon={<BadgePercent />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="portal-commission-rows">
            {rows.map((c) => {
              const netAmt = Number(c.netAmount || 0);
              const grossAmt = Number(c.grossAmount || 0);
              const deduction = grossAmt > 0 ? ((grossAmt - netAmt) / grossAmt) * 100 : 0;
              const client = c.contract?.customer?.fullName ?? c.reservation?.lead?.fullName;
              return (
                <li
                  key={c.id}
                  data-testid="portal-commission-row"
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1.2fr)_120px_130px_180px_36px]"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                    <BadgePercent className="h-[18px] w-[18px]" />
                  </span>

                  {/* Commission code + client */}
                  <div className="min-w-0">
                    <Link
                      href={`/portal/commissions/${c.id}` as never}
                      className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700"
                    >
                      <span className="me-1.5 text-[12px] font-semibold text-slate-400">{word('عمولة', 'Commission')}</span>
                      <span className="whitespace-nowrap font-mono" dir="ltr">{c.commissionNumber}</span>
                    </Link>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">{client ?? '—'}</p>
                  </div>

                  {/* Project + unit + contract */}
                  <div className="hidden min-w-0 items-start gap-2 text-[12.5px] lg:flex">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24E]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{c.project ? tx(c.project.name, locale) : '—'}</p>
                      <p className="mt-0.5 flex flex-col text-[12px] text-slate-500">
                        {c.unit?.code && (
                          <span className="whitespace-nowrap">
                            <span className="me-1 text-slate-400">{word('وحدة', 'Unit')}</span>
                            <span className="font-mono" dir="ltr">{c.unit.code}</span>
                          </span>
                        )}
                        {c.contract?.contractNumber && (
                          <span className="whitespace-nowrap">
                            <span className="me-1 text-slate-400">{word('عقد', 'Contract')}</span>
                            <span className="font-mono" dir="ltr">{c.contract.contractNumber}</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Earned */}
                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-500">{t.cols.earnedAt}</p>
                    <p className="font-semibold text-slate-800"><bdi>{formatDate(c.earnedAt, locale)}</bdi></p>
                  </div>

                  <div className="hidden lg:block">
                    <BrokerCommissionStatusBadge status={c.status} locale={locale} />
                  </div>

                  {/* Net (gross below) */}
                  <div className="flex items-center gap-3 justify-self-end">
                    <span className="lg:hidden"><BrokerCommissionStatusBadge status={c.status} locale={locale} /></span>
                    <div className="text-end">
                      <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">
                        {formatCurrency(c.netAmount, currency, locale)}
                      </p>
                      <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">
                        {t.fromGross(formatCurrency(c.grossAmount, currency, locale))}
                        {deduction > 0.1 && t.deduction(deduction.toFixed(1))}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/portal/commissions/${c.id}` as never}
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
            basePath="/portal/commissions"
            locale={locale}
            params={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }}
          />
        )}
      </PremiumSectionCard>

      <p className="text-2xs text-slate-400 text-center">
        {t.footnote}
      </p>
    </div>
  );
}
