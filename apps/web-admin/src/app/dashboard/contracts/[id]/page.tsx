import Link from 'next/link';
import {
  FileText,
  Building2,
  Link2,
  CheckCircle2,
  Clock,
  CalendarDays,
  CreditCard,
  AlertCircle,
  Phone,
  Mail,
  ExternalLink,
  Wallet,
  Hourglass,
  BadgeCheck,
  Banknote,
  ArrowUpLeft,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { ExportMenu } from '@/components/export-menu';
import type { CancellationSuggestion, Contract, ContractAmendment, ContractCancellationView } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { getCompanyTimeZone, getReportsCurrency, todayIn } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { printT } from '@/messages/print';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { ContractPdfPanel } from './pdf-panel';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import { CreatePlanForm } from './create-plan-form';
import { RecordPaymentButton } from './record-payment-button';
import { DepositStateChip, rowPaymentNote } from '@/components/payments/payment-state';
import { WaiveLateFeeButton } from './waive-late-fee';
import { AmendmentsPanel } from './amendments-panel';
import { PlanChangesPanel } from './plan-changes-panel';
import { PaidBeforeSystem } from './paid-before-system';
import { AssignContractNumber } from './assign-number';
import { SignFollowupsAlert } from './sign-followups-alert';
import { SignContract } from './sign-contract';
import { ContractDeliveryDate } from './delivery-date';
import { LateFeeClause } from './late-fee-clause';
import { CancelContract } from './cancel-contract';
import { CancellationPanel } from './cancellation-panel';
import { HandoverPanel } from './handover-panel';
import { handoverT } from '@/messages/handover';
import { PrintButton } from '@/components/print/PrintButton';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumPanel,
  PremiumEmptyNote,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).contractDetailPage;

  const FREQ_LABELS: Record<string, string> = {
    MONTHLY: m.freqMonthly,
    QUARTERLY: m.freqQuarterly,
    SEMI_ANNUAL: m.freqSemiAnnual,
    YEARLY: m.freqYearly,
  };

  const INST_STATUS: Record<string, { label: string; cls: string }> = {
    PENDING: { label: m.instPending, cls: 'bg-slate-500/10 text-slate-600' },
    PAID: { label: m.instPaid, cls: 'bg-emerald-500/12 text-emerald-600' },
    OVERDUE: { label: m.instOverdue, cls: 'bg-danger-500/12 text-danger-600' },
    CANCELLED: { label: m.instCancelled, cls: 'bg-slate-500/10 text-slate-400 line-through' },
  };
  const WAIVED = { label: m.instWaived, cls: 'bg-slate-500/10 text-slate-500' };

  const PAYMENT_TYPE_LABELS: Record<string, string> = {
    RESERVATION: m.payReservation,
    DOWN_PAYMENT: m.payDownPayment,
    INSTALLMENT: m.payInstallment,
    FINAL_PAYMENT: m.payFinalPayment,
    BOUNCE_PENALTY: m.payBouncePenalty,
    LATE_FEE: m.payLateFee,
    TRANSFER_FEE: m.payTransferFee,
  };

  const [currency, timeZone] = await Promise.all([getReportsCurrency(), getCompanyTimeZone()]);
  const r = await safe(api.get<Contract>(`/contracts/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
        {r.error ?? m.notFound}
      </div>
    );
  }

  const contract = r.data;
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const plan = contract.installmentPlan;
  // What the customer still owes on the schedule — shown before a handover.
  // (fees included; the "remaining" figure below shows the price part.)
  const unpaid =
    Math.round(
      (plan?.installments ?? [])
        .filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE')
        .reduce((a, i) => a + Number(i.amount) * 100, 0),
    ) / 100;
  // Signed before the system: the price rows due before the day it was
  // entered, still unpaid, can be marked paid in one go.
  const enteredDay = todayIn(timeZone, new Date(contract.createdAt));
  const paidBeforeRows = contract.preSystem
    ? (plan?.installments ?? []).filter(
        (i) =>
          (i.status === 'PENDING' || i.status === 'OVERDUE') &&
          ['DOWN_PAYMENT', 'INSTALLMENT', 'FINAL_PAYMENT'].includes(i.type ?? 'INSTALLMENT') &&
          i.dueDate.slice(0, 10) < enteredDay,
      )
    : [];
  const projectName =
    tx(contract.unit?.building?.phase?.project?.name) || '—';
  const displayNumber = contract.contractNumber ?? contract.id.slice(0, 8);
  const customerEmail = (contract.customer as { email?: string | null } | undefined)?.email;
  // A cancelled contract shows its cancellation and refunds; an admin sees
  // the cancel form (pre-filled from the cancellation policy) on a live one.
  const isCancelled = contract.status === 'CANCELLED';
  const amendments = isAdmin
    ? ((await safe(api.get<ContractAmendment[]>(`/contracts/${id}/amendments`))).data ?? [])
    : [];
  const [cancellation, suggestion] = await Promise.all([
    isCancelled && isAdmin
      ? safe(api.get<ContractCancellationView>(`/contracts/${id}/cancellation`)).then((x) => x.data)
      : Promise.resolve(null),
    !isCancelled && isAdmin
      ? safe(api.get<CancellationSuggestion>(`/contracts/${id}/cancellation-suggestion`)).then((x) => x.data)
      : Promise.resolve(null),
  ]);

  // Money on the schedule (price rows only — fees and penalties aside).
  const PRICE_TYPES = ['RESERVATION', 'DOWN_PAYMENT', 'INSTALLMENT', 'FINAL_PAYMENT'];
  const rows = plan?.installments ?? [];
  const priceRows = rows.filter((i) => PRICE_TYPES.includes(i.type ?? 'INSTALLMENT'));
  const sumCents = (xs: typeof rows) => xs.reduce((a, i) => a + Math.round(Number(i.amount) * 100), 0);
  // Collected = the contract value less the price rows still open, so a
  // down payment settled outside the schedule still counts.
  const openPrice = sumCents(priceRows.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE')) / 100;
  const contractTotal = Number(contract.totalAmount);
  const collected = plan ? Math.max(0, Math.round((contractTotal - openPrice) * 100) / 100) : 0;
  const collectedPct = contractTotal > 0 ? Math.min(100, Math.round((collected / contractTotal) * 100)) : 0;
  const openRows = rows
    .filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdueCount = rows.filter((i) => i.status === 'OVERDUE').length;
  const next = openRows[0];

  return (
    <div className="space-y-6 pb-2">
      <PremiumPageHero
        title={`${m.titlePrefix}${displayNumber}`}
        description={`${contract.customer?.fullName ?? '—'} · ${m.heroUnit} ${contract.unit?.code ?? '—'} · ${projectName}`}
        breadcrumbs={[
          { label: m.heroBreadcrumbHome, href: '/dashboard' },
          { label: m.heroBreadcrumbContracts, href: '/dashboard/contracts' },
          { label: displayNumber },
        ]}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            {contract.preSystem && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-600"
                data-testid="pre-system-badge"
              >
                {m.preSystemBadge}
              </span>
            )}
            {isCancelled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-500/12 px-3 py-1 text-xs font-semibold text-danger-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {m.cancelledBadge}
              </span>
            ) : contract.signedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {m.metaSigned} · {formatDate(contract.signedAt, locale)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-xs font-semibold text-amber-600">
                <Clock className="h-3.5 w-3.5" />
                {m.metaPending}
              </span>
            )}
          </span>
        }
        actions={<PrintButton path="contracts" id={contract.id} label={printT(locale).common.print} />}
      >
        {/* Key figures */}
        <div
          data-testid="contract-kpis"
          className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-hairline bg-surface lg:grid-cols-4"
        >
          <Kpi label={m.kpiTotal} icon={<FileText />}>
            <Money value={formatCurrency(contract.totalAmount, currency, locale)} />
            <p className="text-[12px] text-slate-500">
              {m.fieldDownPayment}: <span className="tabular-nums">{formatCurrency(contract.downPayment, currency, locale)}</span>
            </p>
          </Kpi>
          <Kpi label={m.kpiCollected} icon={<Wallet />}>
            <Money value={formatCurrency(collected, currency, locale)} gold />
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className="block h-full rounded-full bg-gradient-to-l from-brand-400 to-brand-600"
                  style={{ width: `${collectedPct}%` }}
                />
              </div>
              <span className="text-[11.5px] text-slate-500 tabular-nums">{m.kpiCollectedPct(collectedPct)}</span>
            </div>
          </Kpi>
          {/* Remaining on the price, so collected + remaining = the contract
              value; open fees (late, transfer, penalty) are noted apart. */}
          <Kpi label={m.kpiRemaining} icon={<Hourglass />}>
            <Money value={formatCurrency(openPrice, currency, locale)} />
            {unpaid - openPrice > 0.005 && (
              <span className="text-[11.5px] text-slate-500" data-testid="kpi-open-fees">
                {locale === 'en' ? '+ fees' : '+ رسوم وغرامات'}{' '}
                <span className="tabular-nums">{formatCurrency(unpaid - openPrice, currency, locale)}</span>
              </span>
            )}
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                overdueCount > 0 ? 'bg-danger-500/12 text-danger-600' : 'bg-emerald-500/12 text-emerald-600',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', overdueCount > 0 ? 'bg-danger-500' : 'bg-emerald-500')} />
              {overdueCount > 0 ? m.kpiOverdue(overdueCount) : m.kpiNoOverdue}
            </span>
          </Kpi>
          <Kpi label={m.kpiNext} icon={<CalendarDays />}>
            {next ? (
              <>
                <Money value={formatCurrency(next.amount, currency, locale)} />
                <p className={cn('text-[12px] tabular-nums', next.status === 'OVERDUE' ? 'text-danger-600' : 'text-slate-500')}>
                  {formatDate(next.dueDate, locale)} · {PAYMENT_TYPE_LABELS[next.type] ?? m.payInstallment}
                </p>
              </>
            ) : (
              <p className="pt-1 text-[14px] font-semibold text-slate-500">{m.kpiNoNext}</p>
            )}
          </Kpi>
        </div>
      </PremiumPageHero>

      {isAdmin && contract.signFollowupFailed && !isCancelled && (
        <SignFollowupsAlert id={contract.id} locale={locale} />
      )}

      <PremiumDetailLayout
        main={
          <>
            {cancellation && (
              <PremiumPanel title={m.cancellationTitle}>
                <CancellationPanel
                  id={contract.id}
                  cancellation={cancellation}
                  currency={currency}
                  canManage={isAdmin}
                  locale={locale}
                />
              </PremiumPanel>
            )}

            {/* Contract key info */}
            <PremiumPanel title={m.sectionContractData}>
              <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-hairline sm:grid-cols-2">
                <Cell label={m.fieldContractNumber}>
                  {contract.contractNumber ? (
                    <span className="font-mono text-[16px] font-bold text-brand-700">{displayNumber}</span>
                  ) : isAdmin ? (
                    <AssignContractNumber id={contract.id} locale={locale} />
                  ) : (
                    <span className="font-mono text-[16px] font-bold text-slate-400">{displayNumber}</span>
                  )}
                </Cell>
                <Cell label={m.fieldCreatedAt}>
                  <span className="text-[13.5px] font-semibold text-slate-900 tabular-nums">{formatDateTime(contract.createdAt, locale)}</span>
                </Cell>
                <Cell label={m.fieldSignedAt}>
                  {contract.signedAt ? (
                    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-emerald-600 tabular-nums">
                      <CheckCircle2 className="h-4 w-4" />
                      {formatDateTime(contract.signedAt, locale)}
                    </span>
                  ) : (
                    <>
                      <span className="text-[13px] text-slate-500">{m.notSigned}</span>
                      {isAdmin && !isCancelled && (
                        <SignContract
                          contractId={contract.id}
                          today={todayIn(timeZone)}
                          deliveryDefault={contract.expectedDeliveryDate}
                          locale={locale}
                        />
                      )}
                    </>
                  )}
                </Cell>
                <Cell label={m.fieldDelivery}>
                  <ContractDeliveryDate
                    contractId={contract.id}
                    deliveryDate={contract.deliveryDate ?? null}
                    expected={contract.expectedDeliveryDate ?? null}
                    delayDays={contract.deliveryDelayDays ?? 0}
                    editable={isAdmin && !isCancelled && !!contract.signedAt}
                    locale={locale}
                  />
                </Cell>
                <Cell label={uiT(locale).common.lateFeeClause.label} wide>
                  <LateFeeClause
                    contractId={contract.id}
                    applies={contract.lateFeesApply ?? false}
                    editable={isAdmin && !isCancelled}
                    locale={locale}
                  />
                </Cell>
              </div>
            </PremiumPanel>

            {/* Installment plan */}
            <PremiumPanel
              title={m.sectionInstallmentPlan}
              sub={
                plan
                  ? m.planProgress(
                      rows.filter((i) => i.status === 'PAID').length,
                      rows.length,
                    )
                  : undefined
              }
              padding={plan ? 'none' : 'normal'}
              trailing={
                // The schedule as a branded workbook — the API allows ADMIN and SALES_MANAGER.
                plan && (isAdmin || session?.role === 'SALES_MANAGER') ? (
                  <ExportMenu
                    locale={locale}
                    filenameBase={`installments-${contract.contractNumber ?? contract.id.slice(0, 8)}`}
                    pdfPath={`/installment-plans/${plan.id}/export.pdf`}
                    xlsxPath={`/installment-plans/${plan.id}/export.xlsx`}
                  />
                ) : undefined
              }
            >
              {plan ? (
                <div>
                  <div className="mx-6 mb-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-hairline sm:grid-cols-4">
                    <PlanStat label={m.fieldInstallmentMonths} value={`${plan.totalMonths} ${m.monthSuffix}`} />
                    <PlanStat label={m.fieldMonthlyAmount} value={formatCurrency(plan.monthlyAmount, currency, locale)} gold />
                    <PlanStat label={m.fieldStartsAt} value={formatDate(plan.startsAt, locale)} />
                    <PlanStat label={m.fieldFrequency} value={FREQ_LABELS[plan.frequency] ?? plan.frequency} />
                  </div>

                  {rows.length > 0 && (
                    <div className="max-h-[460px] overflow-auto border-t border-hairline">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-surface">
                          <tr className="border-b border-hairline">
                            <th className={TH}>#</th>
                            <th className={TH}>{m.colType}</th>
                            <th className={TH}>{m.colDueDate}</th>
                            <th className={TH}>{m.colAmount}</th>
                            <th className={TH}>{m.colStatus}</th>
                            <th className={TH}>{locale === 'en' ? 'Payment' : 'تفاصيل الدفع'}</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {(() => {
                            let installmentCounter = 0;
                            return rows.map((inst) => {
                              const s = inst.waivedAt
                                ? WAIVED
                                : INST_STATUS[inst.status] ?? INST_STATUS['PENDING']!;
                              const waiting =
                                inst.awaitingPayment && inst.payment &&
                                (inst.payment.state === 'PENDING_REVIEW' || inst.payment.state === 'CHEQUE_PENDING')
                                  ? inst.payment.state
                                  : null;
                              const note = rowPaymentNote(inst.status, inst.payment, (d) => formatDate(d, locale), locale);
                              // Not while a proof or a cheque is waiting: the API refuses a second payment.
                              const canPay =
                                isAdmin &&
                                !inst.awaitingPayment &&
                                (inst.status === 'PENDING' || inst.status === 'OVERDUE');
                              const isInstallment =
                                !inst.type || inst.type === 'INSTALLMENT';
                              if (isInstallment) installmentCounter++;
                              const isNext = next?.id === inst.id;
                              return (
                                <tr
                                  key={inst.id}
                                  className={cn(
                                    'transition-colors duration-100 hover:bg-surface-muted/40',
                                    isNext && 'bg-brand-500/[0.06]',
                                  )}
                                >
                                  <td className="px-5 py-3.5">
                                    <span
                                      className={cn(
                                        'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums',
                                        inst.status === 'PAID'
                                          ? 'bg-emerald-500/12 text-emerald-600'
                                          : isNext
                                            ? 'bg-brand-500/15 text-brand-700'
                                            : 'bg-surface-muted text-slate-500',
                                      )}
                                    >
                                      {isInstallment ? installmentCounter : '•'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-[12.5px] font-medium text-slate-600">
                                    {PAYMENT_TYPE_LABELS[inst.type] ?? m.payInstallment}
                                  </td>
                                  <td className="px-4 py-3.5 text-[13px] text-slate-700 tabular-nums">
                                    {formatDate(inst.dueDate, locale)}
                                  </td>
                                  <td className="px-4 py-3.5 text-[13.5px] font-bold tabular-nums text-slate-900">
                                    {formatCurrency(inst.amount, currency, locale)}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    {/* A row with a proof or cheque waiting says so instead of a bare "pending". */}
                                    {waiting ? (
                                      <DepositStateChip state={waiting} locale={locale} />
                                    ) : (
                                      <span className={cn('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', s.cls)}>
                                        {s.label}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 text-[12px] text-slate-500" data-testid="row-payment-note">
                                    {note ??
                                      (inst.status === 'PAID' && inst.paidAt ? formatDate(inst.paidAt, locale) : '—')}
                                  </td>
                                  <td className="px-4 py-3.5 text-end">
                                    {canPay && inst.type === 'LATE_FEE' && (
                                      <span className="me-2">
                                        <WaiveLateFeeButton contractId={contract.id} installmentId={inst.id} locale={locale} />
                                      </span>
                                    )}
                                    {isAdmin && waiting === 'PENDING_REVIEW' && inst.payment && (
                                      <Link
                                        href={`/dashboard/deposits/${inst.payment.depositId}` as never}
                                        data-testid="review-proof-link"
                                        className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-bold text-amber-600 hover:text-amber-500"
                                      >
                                        {locale === 'en' ? 'Review proof' : 'راجِع الإيصال'}
                                      </Link>
                                    )}
                                    {isAdmin && waiting === 'CHEQUE_PENDING' && (
                                      <Link
                                        href={'/dashboard/cheques' as never}
                                        className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-bold text-sky-600 hover:text-sky-500"
                                      >
                                        {locale === 'en' ? 'Cheques' : 'صفحة الشيكات'}
                                      </Link>
                                    )}
                                    {canPay && (
                                      <RecordPaymentButton
                                        contractId={contract.id}
                                        installmentId={inst.id}
                                        amount={inst.amount}
                                        dueDate={inst.dueDate}
                                        installmentType={inst.type}
                                        currency={currency}
                                        locale={locale}
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {contract.reservationId ? (
                    <div className="flex items-start gap-2 rounded-2xl bg-danger-500/10 p-4 text-sm text-danger-600">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{m.noInstallmentFromReservation}</p>
                    </div>
                  ) : (
                    <PremiumEmptyNote>{m.noInstallmentManual}</PremiumEmptyNote>
                  )}
                  {isAdmin && (
                    <CreatePlanForm
                      contractId={contract.id}
                      labels={{
                        months: m.formMonthsPlaceholder,
                        monthly: m.formMonthlyAmountPlaceholder,
                        submit: m.btnCreatePlan,
                        backdated: contract.preSystem ? m.planBackdatedPreSystem : m.planBackdated,
                      }}
                      today={todayIn(timeZone)}
                    />
                  )}
                </div>
              )}
            </PremiumPanel>

            {/* Deposits */}
            <PremiumPanel
              title={m.sectionDeposits}
              trailing={
                isAdmin ? (
                  <Link href={`/dashboard/deposits/new?contractId=${contract.id}`}>
                    <Button variant="secondary" size="sm" type="button" leftIcon={<CreditCard className="h-3.5 w-3.5" />}>
                      {m.btnRegisterDeposit}
                    </Button>
                  </Link>
                ) : contract.deposits?.length ? (
                  <CountPill n={contract.deposits.length} />
                ) : undefined
              }
            >
              {contract.deposits && contract.deposits.length > 0 ? (
                <ul className="max-h-[420px] divide-y divide-hairline overflow-y-auto rounded-2xl border border-hairline">
                  {contract.deposits.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-100 hover:bg-surface-muted/40"
                    >
                      <span
                        className={cn(
                          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-[17px] [&_svg]:w-[17px]',
                          d.state === 'COLLECTED' || !d.state ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600',
                        )}
                      >
                        {d.state === 'COLLECTED' || !d.state ? <BadgeCheck /> : <Banknote />}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isAdmin ? (
                          <Link
                            href={`/dashboard/deposits/${d.id}`}
                            className="text-[15px] font-bold tabular-nums text-slate-900 hover:text-brand-700"
                          >
                            {formatCurrency(d.amount, currency, locale)}
                          </Link>
                        ) : (
                          <span className="text-[15px] font-bold tabular-nums text-slate-900">
                            {formatCurrency(d.amount, currency, locale)}
                          </span>
                        )}
                        <p className="mt-0.5 text-[12px] text-slate-500 tabular-nums">{formatDate(d.paidAt, locale)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {d.receiptUrl && (
                          <a
                            href={d.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-brand-700"
                          >
                            <ExternalLink className="h-3 w-3" /> {m.receiptLabel}
                          </a>
                        )}
                        <DepositStateChip state={d.state} locale={locale} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <PremiumEmptyNote>{m.emptyDeposits}</PremiumEmptyNote>
              )}
            </PremiumPanel>

            {!isCancelled && (
              <PremiumPanel title={handoverT(locale).title}>
                <HandoverPanel
                  id={contract.id}
                  handover={contract.handover ?? null}
                  signed={!!contract.signedAt}
                  canRecord={isAdmin}
                  unpaid={unpaid > 0 ? formatCurrency(unpaid, currency, locale) : null}
                  locale={locale}
                />
              </PremiumPanel>
            )}

            {/* Broker attribution */}
            {contract.broker && (
              <PremiumPanel title={m.sectionBroker}>
                <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-hairline sm:grid-cols-2">
                  <Cell label={m.fieldBrokerCompany}>
                    <Link
                      href={`/dashboard/brokers/${contract.broker.id}`}
                      className="text-[14px] font-bold text-brand-700 hover:text-brand-600"
                    >
                      {contract.broker.companyName}
                    </Link>
                    {contract.broker.commercialName && (
                      <p className="mt-0.5 text-[12px] text-slate-500">{contract.broker.commercialName}</p>
                    )}
                    <p className="mt-0.5 font-mono text-[11.5px] text-slate-500" dir="ltr">
                      {contract.broker.code}
                    </p>
                  </Cell>
                  {contract.brokerAgent && (
                    <Cell label={m.fieldBrokerContact}>
                      <p className="text-[13.5px] font-semibold text-slate-900">{contract.brokerAgent.fullName}</p>
                      <p className="mt-0.5 text-[12px] text-slate-500" dir="ltr">
                        {contract.brokerAgent.email ?? contract.brokerAgent.phone ?? '—'}
                      </p>
                    </Cell>
                  )}
                  {contract.reservation &&
                    (contract.reservation.commissionLockedPct != null ||
                      contract.reservation.commissionLockedAmount != null) && (
                      <Cell label={m.commissionSnapshot} wide>
                        <div className="flex flex-wrap gap-x-8 gap-y-1 text-[13px]">
                          {contract.reservation.commissionLockedPct != null && (
                            <span>
                              <span className="text-slate-500">{m.commissionPct}: </span>
                              <span className="font-semibold tabular-nums text-slate-900">
                                {Number(contract.reservation.commissionLockedPct).toFixed(2)}%
                              </span>
                            </span>
                          )}
                          {contract.reservation.commissionLockedAmount != null && (
                            <span>
                              <span className="text-slate-500">{m.commissionAmount}: </span>
                              <span className="font-semibold tabular-nums text-slate-900">
                                {String(contract.reservation.commissionLockedAmount)}
                              </span>
                            </span>
                          )}
                        </div>
                      </Cell>
                    )}
                </div>
              </PremiumPanel>
            )}

            {isAdmin && !isCancelled && paidBeforeRows.length > 0 && (
              <PremiumPanel title={m.paidBeforeTitle}>
                <PaidBeforeSystem
                  id={contract.id}
                  count={paidBeforeRows.length}
                  total={formatCurrency(
                    paidBeforeRows.reduce((a, i) => a + Math.round(Number(i.amount) * 100), 0) / 100,
                    currency,
                    locale,
                  )}
                  enteredOn={formatDate(contract.createdAt, locale)}
                  locale={locale}
                />
              </PremiumPanel>
            )}

            {isAdmin && !isCancelled && plan && (
              <PremiumPanel title={m.planChangesTitle} sub={m.planChangesSub}>
                <PlanChangesPanel
                  contractId={contract.id}
                  totalAmount={contract.totalAmount}
                  open={(plan.installments ?? []).filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE')}
                  currency={currency}
                  locale={locale}
                />
              </PremiumPanel>
            )}

            {isAdmin && (
              <PremiumPanel title={m.amendmentsTitle} sub={m.amendmentsSub}>
                <AmendmentsPanel
                  contractId={contract.id}
                  live={!isCancelled}
                  history={amendments}
                  currency={currency}
                  markupLeft={Number(contract.markupLeft ?? 0)}
                  locale={locale}
                />
              </PremiumPanel>
            )}

            {suggestion && (
              <PremiumPanel
                title={m.cancelTitle}
                sub={m.cancelSub}
                className="border-danger-500/25"
              >
                <CancelContract id={contract.id} suggestion={suggestion} currency={currency} locale={locale} />
              </PremiumPanel>
            )}
          </>
        }
        side={
          <>
            {/* Parties */}
            <PremiumPanel title={m.sectionParties} sub={m.partiesSub} padding="none">
              <div data-testid="contract-parties" className="divide-y divide-hairline border-t border-hairline">
                <div className="px-6 py-5">
                  <PartyLabel>{m.partyCustomer}</PartyLabel>
                  {contract.customer ? (
                    <>
                      <div className="flex items-center gap-3.5">
                        <Avatar name={contract.customer.fullName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-slate-900">{contract.customer.fullName}</p>
                          <Link
                            href={`/dashboard/customers/${contract.customer.id}`}
                            className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-700 hover:text-brand-600"
                          >
                            {m.linkViewClientProfile}
                            <ArrowUpLeft className="h-3.5 w-3.5 ltr:rotate-90" />
                          </Link>
                        </div>
                      </div>
                      {(contract.customer.phone || customerEmail) && (
                        <div className="mt-4 flex flex-col gap-2">
                          {contract.customer.phone && (
                            <ContactRow href={`tel:${contract.customer.phone}`} icon={<Phone />}>
                              {contract.customer.phone}
                            </ContactRow>
                          )}
                          {customerEmail && (
                            <ContactRow href={`mailto:${customerEmail}`} icon={<Mail />}>
                              {customerEmail}
                            </ContactRow>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">—</p>
                  )}
                </div>

                {contract.unit && (
                  <Link
                    href={`/dashboard/units/${contract.unit.id}`}
                    className="group flex items-center gap-3.5 px-6 py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                      <Building2 />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-slate-500">{m.partyUnit}</p>
                      <p className="flex items-center gap-2">
                        <span className="font-mono text-[15px] font-bold text-slate-900">{contract.unit.code}</span>
                        {contract.unit.type && (
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            {contract.unit.type}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[12px] text-slate-500">{projectName}</p>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-600 ltr:rotate-90" />
                  </Link>
                )}

                {contract.reservation && (
                  <Link
                    href={`/dashboard/reservations/${contract.reservation.id}`}
                    className="group flex items-center gap-3.5 px-6 py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-slate-500 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                      <Link2 />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-slate-500">{m.partyReservation}</p>
                      <p className="font-mono text-[14px] font-bold text-slate-900">
                        {contract.reservation.reservationNumber ?? contract.reservation.id.slice(0, 8)}
                      </p>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-600 ltr:rotate-90" />
                  </Link>
                )}
              </div>
            </PremiumPanel>

            {/* PDF panel */}
            <ContractPdfPanel contract={contract} locale={locale} />

            {/* Contract documents */}
            <div className="space-y-1.5">
              <p className="px-1 text-[11.5px] text-slate-500">{m.contractDocsNote}</p>
              <OwnerDocumentsCard
                ownerType="CONTRACT"
                ownerId={contract.id}
                title={m.contractDocsTitle}
                legacy={
                  contract.pdfUrl
                    ? [
                        {
                          label: m.contractDocsLegacyLabel,
                          href: contract.pdfUrl,
                          hint: m.contractDocsLegacyHint,
                        },
                      ]
                    : undefined
                }
              />
            </div>
          </>
        }
      />
    </div>
  );
}

const TH = 'px-4 py-3 text-start text-[11.5px] font-semibold text-slate-500 whitespace-nowrap first:ps-5';

function Kpi({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-hairline p-5 [&:not(:first-child)]:border-s max-lg:[&:nth-child(3)]:border-s-0 max-lg:[&:nth-child(n+3)]:border-t">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-500">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>
        {label}
      </div>
      {children}
    </div>
  );
}

/** A formatted amount ("1,850,000 ج.م") with the number in the display face. */
function Money({ value, gold }: { value: string; gold?: boolean }) {
  return (
    <span className={cn('num text-[26px] font-semibold leading-none', gold ? 'text-brand-700' : 'text-slate-900')}>
      {value}
    </span>
  );
}

function Cell({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={cn(
        'border-hairline px-5 py-4 [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-s',
        wide && 'sm:col-span-2',
      )}
    >
      <p className="mb-1.5 text-[11.5px] font-semibold text-slate-500">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function PlanStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="border-hairline px-4 py-3.5 [&:not(:first-child)]:border-s max-sm:[&:nth-child(3)]:border-s-0 max-sm:[&:nth-child(n+3)]:border-t">
      <p className="text-[11.5px] font-semibold text-slate-500">{label}</p>
      <p className={cn('mt-1 text-[15px] font-bold tabular-nums', gold ? 'text-brand-700' : 'text-slate-900')}>{value}</p>
    </div>
  );
}

function CountPill({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] font-semibold text-slate-600 tabular-nums">
      {n}
    </span>
  );
}

function PartyLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[11.5px] font-semibold text-slate-500">{children}</p>;
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span
      aria-hidden
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[16px] font-bold text-brand-700 ring-1 ring-brand-500/40"
    >
      {initials || '—'}
    </span>
  );
}

function ContactRow({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-2.5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/[0.05]"
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-slate-500 group-hover:text-brand-700 [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
      </span>
      <span className="truncate text-[13px] font-medium text-slate-700" dir="ltr">{children}</span>
    </a>
  );
}
