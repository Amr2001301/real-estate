import { redirect } from 'next/navigation';
import { getSiteCurrency } from '@/lib/site-currency';
import { currencySymbol } from '@/lib/format';
import { Price } from '@/components/currency/CurrencyProvider';
import type { Route } from 'next';
import Link from 'next/link';
import {
  CalendarClock, CheckCircle2, Clock, AlertCircle, Upload, Wallet,
} from 'lucide-react';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import { unitTypeLabel, formatDateShort } from '@/lib/format';
import type { MeInstallment, MeInstallmentsResponse } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { UnitFilter, type UnitOption } from '@/components/account/UnitFilter';
import { PaymentsTabs } from '@/components/account/PaymentsTabs';
import { SegmentedFilter } from '@/components/ui/SegmentedFilter';
import { cn } from '@/lib/cn';
import { accountT } from '@/messages/account';
import type { Locale } from '@/lib/locale';

export async function generateMetadata() {
  return pageMeta('installments', { robots: { index: false, follow: false } });
}

const STATUS_TONES: Record<MeInstallment['status'], 'success' | 'accent' | 'muted' | 'error'> = {
  PENDING: 'accent',
  PAID: 'success',
  OVERDUE: 'error',
};

const STATUS_TONE_CLS: Record<'success' | 'accent' | 'muted' | 'error', string> = {
  success: 'bg-success/10 text-success',
  accent: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error ring-1 ring-error/20',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function fmtMonthYear(iso: string | null, locale: Locale): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-u-nu-latn', { month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

// To the piaster, as the statement of account: rounded to the pound, the
// figures here did not match it (129,222.22 read 129,222).
const AMT_FMT = new Intl.NumberFormat('ar-SA-u-nu-latn', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const AMT_FMT_EN = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
function fmtAmt(s: string | null | undefined, locale: Locale = 'ar'): string {
  if (!s) return '—';
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return (locale === 'en' ? AMT_FMT_EN : AMT_FMT).format(n);
}

export default async function AccountInstallmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusParam = firstStr(sp.status).toUpperCase();
  const activeStatus = (['PAID', 'PENDING', 'OVERDUE'] as const).find((s) => s === statusParam);
  const activeContractId = firstStr(sp.contractId) || undefined;

  const [locale, currency] = await Promise.all([getLocale(), getSiteCurrency()]);
  const m = siteT(locale).accountPages.installments;
  const pm = siteT(locale).accountPages.payments;

  const FILTERS = [
    { key: 'all', label: m.filterAll, status: undefined },
    { key: 'PAID', label: m.filterPaid, status: 'PAID' as const },
    { key: 'PENDING', label: m.filterDue, status: 'PENDING' as const },
    { key: 'OVERDUE', label: m.filterLate, status: 'OVERDUE' as const },
  ];

  // The whole schedule (a long plan has more than 200 rows).
  const qs = new URLSearchParams({ page: '1', pageSize: '500' });
  if (activeStatus) qs.set('status', activeStatus);
  if (activeContractId) qs.set('contractId', activeContractId);

  let result: MeInstallmentsResponse;
  try {
    result = await authFetch<MeInstallmentsResponse>(`/me/installments?${qs.toString()}`);
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <AccountPageHeader title={pm.title} description={pm.description} />
        <PaymentsTabs active="schedule" locale={locale} />
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const installments = result.data;
  const summary = result.summary;
  const contracts = summary?.contracts ?? [];
  const activeFilterKey = activeStatus ?? 'all';

  const buildHref = (overrides: { status?: string; contractId?: string }): Route => {
    const params = new URLSearchParams();
    const status = 'status' in overrides ? overrides.status : activeStatus;
    const contractId = 'contractId' in overrides ? overrides.contractId : activeContractId;
    if (status) params.set('status', status);
    if (contractId) params.set('contractId', contractId);
    const query = params.toString();
    return (query ? `${routes.accountInstallments}?${query}` : routes.accountInstallments) as Route;
  };

  const contractUnitMap = new Map<string, { code: string; type: string } | null>();
  for (const inst of installments) {
    const c = inst.plan?.contract;
    if (c && !contractUnitMap.has(c.id)) {
      contractUnitMap.set(c.id, c.unit ? { code: c.unit.code, type: c.unit.type } : null);
    }
  }
  const unitOptions: UnitOption[] = contracts.map((c) => {
    const unit = contractUnitMap.get(c.id) ?? null;
    return {
      contractId: c.id,
      label: unit
        ? `${unit.code} — ${unitTypeLabel(unit.type, null, locale)}`
        : (c.contractNumber ?? `#${c.id.slice(0, 6)}`),
    };
  });

  const scheduleEmpty = (summary?.counts.total ?? installments.length) === 0;

  return (
    <div className="space-y-8">
      <AccountPageHeader title={pm.title} description={pm.description} />
      <PaymentsTabs active="schedule" locale={locale} />

      {scheduleEmpty ? (
        <EmptyState
          title={m.emptyAll}
          message={m.emptyAllMsg}
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.accountContracts} variant="outline" size="md">
              {m.viewContracts}
            </ButtonLink>
          }
        />
      ) : (
        <>
          {summary && <SummaryStrip summary={summary} m={m} symbol={currencySymbol(currency, locale)} locale={locale} />}

          {/* Filter row */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {contracts.length > 1 && (
              <UnitFilter
                options={unitOptions}
                activeContractId={activeContractId}
                activeStatus={activeStatus}
              />
            )}
            <SegmentedFilter
              className="sm:ms-auto"
              active={activeFilterKey}
              items={FILTERS.map((f) => ({
                key: f.key,
                label: f.label,
                href: buildHref({ status: f.status }),
                alert: f.key === 'OVERDUE',
                count:
                  f.key === 'all'
                    ? summary?.counts.total
                    : f.key === 'PAID'
                      ? summary?.counts.paid
                      : f.key === 'PENDING'
                        ? summary?.counts.pending
                        : summary?.counts.overdue,
              }))}
            />
          </div>

          {installments.length === 0 ? (
            <EmptyState
              title={m.emptyFilter}
              message={m.emptyFilterMsg}
              icon={<CalendarClock className="h-6 w-6" aria-hidden />}
              action={
                <ButtonLink href={routes.accountInstallments} variant="outline" size="md">
                  {m.viewAll}
                </ButtonLink>
              }
            />
          ) : (
            <>
              {/* What is due now (overdue, or due within 30 days) — or else the next one. */}
              {!activeStatus && <DueNow installments={installments} m={m} locale={locale} />}
              <ScheduleByYear installments={installments} m={m} locale={locale} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** One financial metric inside the summary strip. */
function SummaryBlock({
  icon: Icon,
  label,
  value,
  sub,
  separator,
  overdue,
  currency,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  sub?: string;
  separator?: boolean;
  overdue?: boolean;
  currency: string;
}) {
  return (
    <div className={cn('min-w-0', separator && 'sm:border-s sm:border-hairline/70 sm:ps-8')}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <Icon className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
        {label}
      </div>
      <div
        className={cn(
          'text-xl font-black tracking-tight tabular-nums',
          overdue ? 'text-error' : 'text-ink-strong',
        )}
        dir="auto"
      >
        {value}
        {value !== '—' && (
          <span className="ms-1.5 text-xs font-semibold text-ink-muted/60">{currency}</span>
        )}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-muted/70">{sub}</div>}
    </div>
  );
}

type InstallmentsMessages = ReturnType<typeof siteT>['accountPages']['installments'];

/** Single AccountCard containing all four financial KPIs in one horizontal row. */
function SummaryStrip({ summary, m, symbol, locale }: { summary: NonNullable<MeInstallmentsResponse['summary']>; m: InstallmentsMessages; symbol: string; locale: Locale }) {
  const hasOverdue = Number(summary.late?.amount ?? summary.overdue) > 0;
  return (
    <AccountCard accent="gold" className="p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-4">
        <SummaryBlock
          icon={CheckCircle2}
          label={m.totalPaid}
          value={fmtAmt(summary.totalPaid, locale)}
          sub={`${summary.counts.paid} ${m.paidCount}`}
          currency={symbol}
        />
        <SummaryBlock
          icon={Wallet}
          label={m.remaining}
          value={fmtAmt(summary.remaining, locale)}
          sub={[
            `${summary.counts.pending + summary.counts.overdue} ${m.unpaidCount}`,
            // The remaining includes fees and penalties: said, not hidden.
            Number(summary.fees?.open ?? 0) > 0 ? m.feesNote(`${fmtAmt(summary.fees!.open, locale)} ${symbol}`) : null,
          ].filter(Boolean).join(' · ')}
          separator
          currency={symbol}
        />
        <SummaryBlock
          icon={AlertCircle}
          label={m.overdue}
          value={fmtAmt(summary.late?.amount ?? summary.overdue, locale)}
          sub={`${summary.late?.count ?? summary.counts.overdue} ${m.overdueCount}`}
          separator
          overdue={hasOverdue}
          currency={symbol}
        />
        <SummaryBlock
          icon={CalendarClock}
          label={m.nextDue}
          value={fmtAmt(summary.nextDue?.amount ?? null, locale)}
          sub={
            summary.nextDue
              ? `${m.duePrefix} ${formatDateShort(summary.nextDue.dueDate, locale)}`
              : m.noDue
          }
          separator
          currency={symbol}
        />
      </div>
    </AccountCard>
  );
}

const DAY = 24 * 60 * 60 * 1000;
/** Whole days from today (UTC) to the due date; negative when it is past. */
function daysUntil(iso: string): number {
  const today = new Date();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime() - t) / DAY);
}

/** A row the customer may send a proof for now: unpaid and nothing waiting on it. */
function canSubmitProof(i: MeInstallment): boolean {
  return i.status !== 'PAID' && !i.paymentOnItsWay;
}

function proofHref(i: MeInstallment): Route {
  return {
    pathname: routes.accountDeposits,
    query: { submit: 'proof', installmentId: i.id, amount: i.amount },
  } as unknown as Route;
}

function rowTitle(i: MeInstallment, m: InstallmentsMessages, locale: Locale): string {
  return `${m.typeLabels[i.type] ?? m.installmentLabel} ${fmtMonthYear(i.dueDate, locale)}`;
}

/**
 * The top of the page: what the customer owes now — overdue rows and those
 * due within 30 days — each with its proof button. With none, the next row
 * to fall due. Proof buttons live here only, not on rows years away.
 */
function DueNow({ installments, m, locale }: { installments: MeInstallment[]; m: InstallmentsMessages; locale: Locale }) {
  const unpaid = installments.filter((i) => i.status !== 'PAID').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const now = unpaid.filter((i) => i.status === 'OVERDUE' || daysUntil(i.dueDate) <= 30);
  const rows = now.length > 0 ? now : unpaid.slice(0, 1);
  if (rows.length === 0) return null;
  return (
    <section className="mt-6" data-testid="installments-due-now">
      <h2 className="mb-3 text-base font-bold text-ink-strong">{now.length > 0 ? m.dueNowTitle : m.nextUpTitle}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((i) => {
          const days = daysUntil(i.dueDate);
          const late = i.status === 'OVERDUE' || days < 0;
          return (
            <AccountCard key={i.id} accent={late ? 'error' : 'gold'} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-strong">{rowTitle(i, m, locale)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted" dir="auto">{formatDateShort(i.dueDate, locale)}</p>
                </div>
                <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold', late ? STATUS_TONE_CLS.error : STATUS_TONE_CLS.accent)}>
                  {late ? m.lateBy(Math.abs(days)) : m.dueIn(days)}
                </span>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="font-display text-2xl font-black tracking-tight text-ink-strong" dir="auto">
                  <Price value={i.amount} />
                </p>
                {canSubmitProof(i) ? (
                  <Link
                    href={proofHref(i)}
                    className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-navy/90 active:scale-95"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    {m.submitProof}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-600" data-testid="installment-proof-waiting">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {m.proofWaiting}
                  </span>
                )}
              </div>
            </AccountCard>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The whole schedule as a compact table, one block per year: this year (and
 * any year with a late row) open, the others folded with what was paid.
 */
function ScheduleByYear({ installments, m, locale }: { installments: MeInstallment[]; m: InstallmentsMessages; locale: Locale }) {
  const thisYear = new Date().getUTCFullYear();
  const years = new Map<number, MeInstallment[]>();
  for (const i of [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    const y = Number(i.dueDate.slice(0, 4));
    years.set(y, [...(years.get(y) ?? []), i]);
  }
  return (
    <section className="mt-8" data-testid="installments-schedule">
      <h2 className="mb-3 text-base font-bold text-ink-strong">{m.scheduleTitle}</h2>
      <div className="space-y-3">
        {[...years].map(([year, rows]) => {
          const paid = rows.filter((r) => r.status === 'PAID').length;
          const anyLate = rows.some((r) => r.status === 'OVERDUE');
          const total = rows.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <details
              key={year}
              open={year === thisYear || anyLate || years.size === 1}
              className="group overflow-hidden rounded-2xl border border-hairline bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-surface-soft/60">
                <span className="font-display text-lg font-bold text-ink-strong">{year}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', anyLate ? STATUS_TONE_CLS.error : paid === rows.length ? STATUS_TONE_CLS.success : STATUS_TONE_CLS.muted)}>
                  {m.yearSummary(paid, rows.length)}
                </span>
                <span className="ms-auto text-sm font-semibold text-ink-muted" dir="auto">
                  <Price value={total} />
                </span>
                <span className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden>▾</span>
              </summary>
              <ul className="divide-y divide-hairline border-t border-hairline">
                {rows.map((i) => {
                  const tone = STATUS_TONES[i.status] ?? 'muted';
                  const label = accountT(locale).installmentStatus[i.status] ?? i.status;
                  return (
                    <li key={i.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-sm sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                      <span className="font-medium text-ink-strong">
                        {fmtMonthYear(i.dueDate, locale)}
                        <span className="ms-2 text-xs font-normal text-ink-muted" dir="auto">{formatDateShort(i.dueDate, locale)}</span>
                      </span>
                      <span className="order-3 text-xs text-ink-muted sm:order-none">{m.typeLabels[i.type] ?? m.installmentLabel}</span>
                      <span className="text-end font-semibold text-ink-strong sm:text-start" dir="auto"><Price value={i.amount} /></span>
                      <span className={cn('order-4 justify-self-end rounded-full px-2.5 py-0.5 text-xs font-medium sm:order-none', STATUS_TONE_CLS[tone])}>
                        {i.status === 'PAID' && i.paidAt ? `${label} · ${formatDateShort(i.paidAt, locale)}` : i.paymentOnItsWay ? m.proofWaiting : label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
