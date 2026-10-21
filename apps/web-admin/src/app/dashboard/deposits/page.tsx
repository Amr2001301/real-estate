import Link from 'next/link';
import {
  DollarSign, CreditCard, Landmark, Hash,
  SlidersHorizontal, ReceiptText,
  ExternalLink, Plus, AlertCircle, RotateCcw,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import type { PagedDeposits, Deposit, DepositType } from '@/lib/types';
import { formatCurrency, formatDate, tx, intlLocale } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { VerifyToggle } from './verify-toggle';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumRangeField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { CodeCell, PersonCell } from '@/components/premium/list-cells';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectOption { id: string; name: { ar: string; en: string } }

// ── Maps ──────────────────────────────────────────────────────────────────────

const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-sky-500/12 text-sky-600',
  DOWN_PAYMENT:   'bg-brand-500/12 text-brand-700',
  INSTALLMENT:    'bg-violet-500/12 text-violet-600',
  FINAL_PAYMENT:  'bg-emerald-500/12 text-emerald-600',
  FEE:            'bg-danger-500/12 text-danger-600',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCustomerName(d: Deposit): string {
  if (d.contract?.customer?.fullName) return d.contract.customer.fullName;
  if (d.reservation?.client?.fullName) return d.reservation.client.fullName;
  if (d.reservation?.lead?.fullName) return d.reservation.lead.fullName;
  return '—';
}

function getUnitCode(d: Deposit): string {
  return d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';
}

function getDueDate(d: Deposit): string | null {
  if (d.installment?.dueDate) return d.installment.dueDate;
  if (d.type === 'BOOKING_AMOUNT' && d.reservation) {
    return d.reservation.expiresAt ?? d.reservation.createdAt ?? null;
  }
  return null;
}

function getDueDateTitle(d: Deposit, m: ReturnType<typeof uiT>['pages']['deposits']): string | undefined {
  if (d.type === 'BOOKING_AMOUNT') {
    return d.reservation?.expiresAt ? m.dueReservationEnd : m.dueAtReservation;
  }
  return undefined;
}

function buildApiUrl(sp: Record<string, string | undefined>, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (sp.type) params.set('type', sp.type);
  if (sp.reviewStatus) params.set('reviewStatus', sp.reviewStatus);
  if (sp.projectId) params.set('projectId', sp.projectId);
  if (sp.q) params.set('q', sp.q);
  if (sp.ref) params.set('ref', sp.ref);
  if (sp.paidAtFrom) params.set('paidAtFrom', sp.paidAtFrom);
  if (sp.paidAtTo) params.set('paidAtTo', sp.paidAtTo);
  if (sp.dueDateFrom) params.set('dueDateFrom', sp.dueDateFrom);
  if (sp.dueDateTo) params.set('dueDateTo', sp.dueDateTo);
  if (sp.verified) params.set('verified', sp.verified);
  return `/deposits?${params.toString()}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [currency, locale, session] = await Promise.all([
    getReportsCurrency(),
    getLocale(),
    getSession(),
  ]);
  const m = uiT(locale).pages.deposits;
  const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
    BOOKING_AMOUNT: m.typeLabels.RESERVATION,
    DOWN_PAYMENT:   m.typeLabels.DOWN_PAYMENT,
    INSTALLMENT:    m.typeLabels.INSTALLMENT,
    FINAL_PAYMENT:  m.typeLabels.FINAL_PAYMENT,
    FEE:            m.typeLabels.FEE,
  };
  // Registering + verifying deposits are admin/finance actions; SALES is read-only.
  const isAdmin = session?.role === 'ADMIN';
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 20;

  // Advanced filter state
  const hasAdvancedFilters = !!(
    sp.ref || sp.paidAtFrom || sp.paidAtTo || sp.dueDateFrom || sp.dueDateTo || sp.verified
  );
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = hasAdvancedFilters || !!(sp.type || sp.reviewStatus || sp.projectId || sp.q);

  // URL builder for the advanced toggle link (preserves all active params)
  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      type: sp.type, reviewStatus: sp.reviewStatus, projectId: sp.projectId, q: sp.q,
      ref: sp.ref, paidAtFrom: sp.paidAtFrom, paidAtTo: sp.paidAtTo,
      dueDateFrom: sp.dueDateFrom, dueDateTo: sp.dueDateTo,
      verified: sp.verified, showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const qs = p.toString();
    return `/dashboard/deposits${qs ? `?${qs}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  const [depositsRes, projectsRes] = await Promise.all([
    safe(api.get<PagedDeposits>(buildApiUrl(sp, page, pageSize))),
    safe(projectOptions()),
  ]);

  const deposits = depositsRes.data;
  const totals   = deposits?.totals;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          isAdmin ? (
            <Link href="/dashboard/deposits/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addBtn}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: m.kpi.totalCollected,
            value: totals ? formatCurrency(totals.totalAmount, currency, locale) : '—',
            icon: <DollarSign />,
            tone: 'brand',
            primary: true,
            sub: totals ? `${totals.count} ${m.depositSuffix}` : undefined,
          },
          {
            label: m.kpi.reservationAmounts,
            value: totals ? formatCurrency(totals.bookingAmount, currency, locale) : '—',
            icon: <Landmark />,
            tone: 'info',
          },
          {
            label: m.kpi.monthlyInstallments,
            value: totals ? formatCurrency(totals.installment, currency, locale) : '—',
            icon: <CreditCard />,
            tone: 'neutral',
          },
          {
            label: m.kpi.totalDeposits,
            value: totals?.count ?? 0,
            icon: <Hash />,
            tone: 'success',
            sub: m.kpi.totalDepositsSub,
          },
        ]}
      />

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/deposits">
        {/* Hidden inputs: preserve active advanced filter values when only quick filters are submitted */}
        {!showFilters && sp.ref        && <input type="hidden" name="ref"        value={sp.ref} />}
        {!showFilters && sp.paidAtFrom && <input type="hidden" name="paidAtFrom" value={sp.paidAtFrom} />}
        {!showFilters && sp.paidAtTo   && <input type="hidden" name="paidAtTo"   value={sp.paidAtTo} />}
        {!showFilters && sp.dueDateFrom && <input type="hidden" name="dueDateFrom" value={sp.dueDateFrom} />}
        {!showFilters && sp.dueDateTo  && <input type="hidden" name="dueDateTo"  value={sp.dueDateTo} />}
        {!showFilters && sp.verified   && <input type="hidden" name="verified"   value={sp.verified} />}

        {/* Search first: the inset field the bar is built around */}
        <PremiumFilterField label={uiT(locale).common.searchBtn} htmlFor="dep-q">
          <Input
            id="dep-q"
            name="q"
            inputSize="sm"
            placeholder={m.filter.searchPlaceholder}
            defaultValue={sp.q ?? ''}
          />
        </PremiumFilterField>

        {/* Row 1 ends with the actions; reset shows only when something is set */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          <Link
            href={toggleFiltersUrl as never}
            className={cn(
              'relative inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
              showFilters
                ? 'border-brand-500/50 bg-brand-500/10 text-brand-700'
                : 'border-hairline text-slate-500 hover:border-brand-500/30 hover:text-slate-800',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? m.filter.advancedHide : m.filter.advancedShow}
            {hasAdvancedFilters && !showFilters && (
              <span className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-surface" />
            )}
          </Link>
          {hasAnyFilter && (
            <Link
              href="/dashboard/deposits"
              title={m.filter.resetBtn}
              aria-label={m.filter.resetBtn}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-danger-500/40 hover:text-danger-600"
            >
              <RotateCcw className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Row 2: every filter as a pill; advanced ones join the same row */}
        <div className="flex w-full basis-full flex-wrap items-center gap-2 border-t border-hairline px-0.5 pt-2.5">
          {/* Type */}
          <PremiumFilterField label={m.filter.typeLabel} htmlFor="dep-type">
            <Select id="dep-type" name="type" inputSize="sm" defaultValue={sp.type ?? ''} className="w-28 shrink-0">
              <option value="">{m.filter.allTypes}</option>
              <option value="BOOKING_AMOUNT">{m.typeLabels.RESERVATION}</option>
              <option value="DOWN_PAYMENT">{m.typeLabels.DOWN_PAYMENT}</option>
              <option value="INSTALLMENT">{m.typeLabels.INSTALLMENT}</option>
              <option value="FINAL_PAYMENT">{m.typeLabels.FINAL_PAYMENT}</option>
              <option value="FEE">{m.typeLabels.FEE}</option>
            </Select>
          </PremiumFilterField>

          {/* Review status */}
          <PremiumFilterField label={m.filter.reviewLabel} htmlFor="dep-reviewStatus">
            <Select id="dep-reviewStatus" name="reviewStatus" inputSize="sm" defaultValue={sp.reviewStatus ?? ''} className="w-32 shrink-0">
              <option value="">{m.filter.allReviews}</option>
              <option value="PENDING_REVIEW">{m.filter.underReview}</option>
              <option value="APPROVED">{m.filter.approved}</option>
              <option value="REJECTED">{m.filter.rejected}</option>
              <option value="NO_PROOF">{m.filter.noProof}</option>
            </Select>
          </PremiumFilterField>

          {/* Project */}
          <PremiumFilterField label={uiT(locale).pages.units.filter.projectLabel} htmlFor="dep-projectId">
            <Select id="dep-projectId" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-32 shrink-0">
              <option value="">{uiT(locale).common.allProjects}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{tx(p.name)}</option>
              ))}
            </Select>
          </PremiumFilterField>

          {showFilters && (
            <>
              <PremiumRangeField
                label={m.filter.paidRangeLabel}
                from={{ id: 'paidAtFrom', value: sp.paidAtFrom, label: m.filter.dateFrom }}
                to={{ id: 'paidAtTo', value: sp.paidAtTo, label: m.filter.dateTo }}
              />
              <PremiumRangeField
                label={m.filter.dueRangeLabel}
                from={{ id: 'dueDateFrom', value: sp.dueDateFrom, label: m.filter.dueFrom }}
                to={{ id: 'dueDateTo', value: sp.dueDateTo, label: m.filter.dueTo }}
              />
              <PremiumFilterField label={m.filter.refLabel} htmlFor="ref" className="[&>span:last-child>svg]:hidden">
                <Input id="ref" name="ref" inputSize="sm" placeholder={m.filter.refPlaceholder} defaultValue={sp.ref ?? ''} className="w-40" />
              </PremiumFilterField>
              <PremiumFilterField label={m.filter.verifiedLabel} htmlFor="verified">
                <Select id="verified" name="verified" inputSize="sm" defaultValue={sp.verified ?? ''}>
                  <option value="">{m.filter.allVerified}</option>
                  <option value="true">{m.filter.verified}</option>
                  <option value="false">{m.filter.notVerified}</option>
                </Select>
              </PremiumFilterField>
            </>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {depositsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{depositsRes.error}</p>
        </div>
      )}

      {/* ── Deposits table ───────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<ReceiptText />}
        title={m.sectionTitle}
        padded={false}
        trailing={
          deposits ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {deposits.meta.total.toLocaleString(intlLocale(locale))} {m.depositSuffix}
            </span>
          ) : undefined
        }
      >
        {!deposits || deposits.data.length === 0 ? (
          <PremiumEmptyState
            icon={<CreditCard />}
            title={m.empty.title}
            description={m.empty.description}
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]" data-testid="deposits-table">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.type}</th>
                  <th className="text-start py-3 px-4">{m.cols.client}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.ref}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.due}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.amount}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.paidAt}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.verified}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {deposits.data.map((d) => {
                  const dueDate = getDueDate(d);
                  return (
                    <tr key={d.id} className="hover:bg-brand-500/[0.04] transition-colors duration-100">

                      <td className="px-4 py-3 whitespace-nowrap">
                        {isAdmin ? (
                          <Link
                            href={`/dashboard/deposits/${d.id}`}
                            className={cn(
                              'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight hover:opacity-80 transition-opacity',
                              DEPOSIT_TYPE_CLS[d.type as DepositType] ?? 'bg-slate-100 text-slate-600',
                            )}
                            title={m.detailTooltip}
                          >
                            {DEPOSIT_TYPE_LABELS[d.type as DepositType] ?? d.type}
                          </Link>
                        ) : (
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight',
                            DEPOSIT_TYPE_CLS[d.type as DepositType] ?? 'bg-slate-100 text-slate-600',
                          )}>
                            {DEPOSIT_TYPE_LABELS[d.type as DepositType] ?? d.type}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {/* The unit rides under the client: one column instead of two */}
                        <PersonCell name={getCustomerName(d)} sub={getUnitCode(d)} subLabel={uiT(locale).common.codeKind.unit} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {d.contractId && d.contract ? (
                          <CodeCell
                            href={`/dashboard/contracts/${d.contractId}`}
                            code={d.contract.contractNumber ?? `#${d.contractId.slice(0, 8).toUpperCase()}`}
                            muted={!d.contract.contractNumber}
                            kind={uiT(locale).common.codeKind.contract}
                          />
                        ) : d.reservationId && d.reservation ? (
                          <CodeCell
                            href={`/dashboard/reservations/${d.reservationId}`}
                            code={d.reservation.reservationNumber ?? `#${d.reservationId.slice(0, 8).toUpperCase()}`}
                            muted={!d.reservation.reservationNumber}
                            kind={uiT(locale).common.codeKind.reservation}
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {dueDate ? (
                          <span className="text-xs text-slate-500 tabular-nums" title={getDueDateTitle(d, m)}>
                            {formatDate(dueDate, locale)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold tabular-nums text-slate-900">{formatCurrency(d.amount, currency, locale)}</span>
                        {d.receiptUrl && (
                          <a
                            href={d.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {m.receiptView}
                          </a>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {formatDate(d.paidAt, locale)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {isAdmin ? (
                          <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} locale={locale} />
                        ) : (
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                              d.verified
                                ? 'bg-emerald-500/12 text-emerald-600'
                                : 'bg-amber-500/12 text-amber-600'
                            }`}
                          >
                            {d.verified ? m.verifiedBadge : m.notVerifiedBadge}
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {deposits && deposits.meta.total > pageSize && (
        <Pagination
          basePath="/dashboard/deposits"
          page={page}
          pageSize={pageSize}
          total={deposits.meta.total}
          params={{
            type: sp.type,
            reviewStatus: sp.reviewStatus,
            projectId: sp.projectId,
            q: sp.q,
            ref: sp.ref,
            paidAtFrom: sp.paidAtFrom,
            paidAtTo: sp.paidAtTo,
            dueDateFrom: sp.dueDateFrom,
            dueDateTo: sp.dueDateTo,
            verified: sp.verified,
          }}
          locale={locale}
        />
      )}
    </div>
  );
}
