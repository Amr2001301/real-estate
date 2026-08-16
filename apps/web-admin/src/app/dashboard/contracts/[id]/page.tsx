import Link from 'next/link';
import {
  FileText,
  User,
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
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Contract } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { ContractPdfPanel } from './pdf-panel';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import { createInstallmentPlanAction } from '../actions';
import { RecordPaymentButton } from './record-payment-button';
import { PrintButton } from '@/components/print/PrintButton';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
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
    PENDING: { label: m.instPending, cls: 'bg-slate-100 text-slate-600' },
    PAID: { label: m.instPaid, cls: 'bg-success-100 text-success-700' },
    OVERDUE: { label: m.instOverdue, cls: 'bg-danger-100 text-danger-700' },
  };

  const PAYMENT_TYPE_LABELS: Record<string, string> = {
    RESERVATION: m.payReservation,
    DOWN_PAYMENT: m.payDownPayment,
    INSTALLMENT: m.payInstallment,
    FINAL_PAYMENT: m.payFinalPayment,
  };

  const CMD_LINK =
    'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
  const CMD_ICON =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

  const currency = await getReportsCurrency();
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
  const projectName =
    tx(contract.unit?.building?.phase?.project?.name) || '—';
  const displayNumber = contract.contractNumber ?? contract.id.slice(0, 8);
  const customerEmail = (contract.customer as { email?: string | null } | undefined)?.email;

  return (
    <div className="space-y-5 pb-2">
      <PremiumPageHero
        title={`${m.titlePrefix}${displayNumber}`}
        description={`${contract.customer?.fullName ?? '—'} · ${m.heroUnit} ${contract.unit?.code ?? '—'} · ${projectName}`}
        breadcrumbs={[
          { label: m.heroBreadcrumbHome, href: '/dashboard' },
          { label: m.heroBreadcrumbContracts, href: '/dashboard/contracts' },
          { label: displayNumber },
        ]}
        meta={
          contract.signedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-success-700 bg-success-50 px-2.5 py-1 rounded-full border border-success-100">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {m.metaSigned} · {formatDate(contract.signedAt)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              {m.metaPending}
            </span>
          )
        }
        actions={<PrintButton path="contracts" id={contract.id} />}
      />

      <PremiumDetailLayout
        main={
          <>
            {/* Contract key info */}
            <PremiumSectionCard title={m.sectionContractData} icon={<FileText />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                <Field label={m.fieldContractNumber}>
                  <span className="font-mono text-[15px] font-bold text-brand-700">{displayNumber}</span>
                </Field>
                <Field label={m.fieldTotal}>
                  <span className="text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(contract.totalAmount, currency)}</span>
                </Field>
                <Field label={m.fieldDownPayment}>
                  <span className="text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(contract.downPayment, currency)}</span>
                </Field>
                <Field label={m.fieldSignedAt}>
                  {contract.signedAt ? (
                    <span className="text-[13px] font-semibold text-success-700">{formatDateTime(contract.signedAt)}</span>
                  ) : (
                    <span className="text-[13px] text-slate-400">{m.notSigned}</span>
                  )}
                </Field>
                <Field label={m.fieldCreatedAt}>
                  <span className="text-[13px] font-semibold text-slate-800">{formatDateTime(contract.createdAt)}</span>
                </Field>
              </div>
            </PremiumSectionCard>

            {/* Source reservation */}
            {contract.reservation && (
              <PremiumSectionCard title={m.sectionFromReservation} icon={<Link2 />}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 [&_svg]:h-5 [&_svg]:w-5">
                    <Link2 />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 mb-1">
                      {m.reservationNote}
                    </p>
                    <Link
                      href={`/dashboard/reservations/${contract.reservation.id}`}
                      className="font-mono text-[14px] font-bold text-indigo-700 hover:underline"
                    >
                      {contract.reservation.reservationNumber ??
                        contract.reservation.id.slice(0, 8)}
                    </Link>
                  </div>
                </div>
              </PremiumSectionCard>
            )}

            {/* Broker attribution */}
            {contract.broker && (
              <PremiumSectionCard title={m.sectionBroker} icon={<Building2 />}>
                <div className="space-y-5">
                  <Field label={m.fieldBrokerCompany}>
                    <Link
                      href={`/dashboard/brokers/${contract.broker.id}`}
                      className="text-[13.5px] font-bold text-brand-700 hover:underline"
                    >
                      {contract.broker.companyName}
                    </Link>
                    {contract.broker.commercialName && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{contract.broker.commercialName}</p>
                    )}
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5" dir="ltr">
                      {contract.broker.code}
                    </p>
                  </Field>
                  {contract.brokerAgent && (
                    <Field label={m.fieldBrokerContact}>
                      <p className="text-[13px] font-semibold text-slate-800">{contract.brokerAgent.fullName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5" dir="ltr">
                        {contract.brokerAgent.email ?? contract.brokerAgent.phone ?? '—'}
                      </p>
                    </Field>
                  )}
                  {contract.reservation &&
                    (contract.reservation.commissionLockedPct !== null ||
                      contract.reservation.commissionLockedAmount !== null) && (
                      <div className="rounded-xl bg-canvas/60 border border-hairline px-4 py-3 text-xs text-slate-700 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">
                          {m.commissionSnapshot}
                        </p>
                        {contract.reservation.commissionLockedPct !== null &&
                          contract.reservation.commissionLockedPct !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">{m.commissionPct}</span>
                              <span className="font-semibold tabular-nums">
                                {Number(contract.reservation.commissionLockedPct).toFixed(2)}%
                              </span>
                            </div>
                          )}
                        {contract.reservation.commissionLockedAmount !== null &&
                          contract.reservation.commissionLockedAmount !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">{m.commissionAmount}</span>
                              <span className="font-semibold tabular-nums">
                                {String(contract.reservation.commissionLockedAmount)}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              </PremiumSectionCard>
            )}

            {/* Installment plan */}
            <PremiumSectionCard
              title={m.sectionInstallmentPlan}
              icon={<CalendarDays />}
              padded={!plan}
            >
              {plan ? (
                <div>
                  {/* Summary bar */}
                  <div className="px-5 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-b border-hairline">
                    <Field label={m.fieldInstallmentMonths}>
                      <span className="text-[14px] font-bold tabular-nums text-slate-900">{plan.totalMonths} {m.monthSuffix}</span>
                    </Field>
                    <Field label={m.fieldMonthlyAmount}>
                      <span className="text-[14px] font-bold tabular-nums text-slate-900">{formatCurrency(plan.monthlyAmount, currency)}</span>
                    </Field>
                    <Field label={m.fieldStartsAt}>
                      <span className="text-[14px] font-bold text-slate-900">{formatDate(plan.startsAt)}</span>
                    </Field>
                    <Field label={m.fieldFrequency}>
                      <span className="text-[14px] font-bold text-slate-900">{FREQ_LABELS[plan.frequency] ?? plan.frequency}</span>
                    </Field>
                  </div>

                  {/* Installments table */}
                  {plan.installments && plan.installments.length > 0 && (
                    <div className="overflow-auto max-h-[420px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-canvas/60 backdrop-blur-sm border-b border-hairline">
                          <tr>
                            <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">#</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.colType}</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colDueDate}</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.colAmount}</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.colStatus}</th>
                            <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colPaidAt}</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {(() => {
                            let installmentCounter = 0;
                            return plan.installments!.map((inst) => {
                              const s =
                                INST_STATUS[inst.status] ?? INST_STATUS['PENDING']!;
                              const canPay =
                                isAdmin &&
                                (inst.status === 'PENDING' || inst.status === 'OVERDUE');
                              const isInstallment =
                                !inst.type || inst.type === 'INSTALLMENT';
                              if (isInstallment) installmentCounter++;
                              const rowLabel = isInstallment
                                ? String(installmentCounter)
                                : PAYMENT_TYPE_LABELS[inst.type] ?? inst.type;
                              return (
                                <tr
                                  key={inst.id}
                                  className="hover:bg-canvas/40 transition-colors duration-100"
                                >
                                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">
                                    {isInstallment ? rowLabel : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                                    {PAYMENT_TYPE_LABELS[inst.type] ?? m.payInstallment}
                                  </td>
                                  <td className="px-4 py-3 text-[13px] text-slate-700">
                                    {formatDate(inst.dueDate)}
                                  </td>
                                  <td className="px-4 py-3 text-[13px] font-bold tabular-nums text-slate-900">
                                    {formatCurrency(inst.amount, currency)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn('inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold', s.cls)}>
                                      {s.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[12px] text-slate-400">
                                    {inst.paidAt ? formatDate(inst.paidAt) : '—'}
                                  </td>
                                  <td className="px-4 py-3">
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
                    <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>{m.noInstallmentFromReservation}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {m.noInstallmentManual}
                    </p>
                  )}
                  {isAdmin && (
                    <form
                      action={createInstallmentPlanAction.bind(null, contract.id)}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          name="totalMonths"
                          type="number"
                          min={1}
                          max={360}
                          placeholder={m.formMonthsPlaceholder}
                          required
                          className="rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                        <input
                          name="monthlyAmount"
                          type="number"
                          step="any"
                          min={0}
                          placeholder={m.formMonthlyAmountPlaceholder}
                          required
                          className="rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                        <input
                          name="startsAt"
                          type="date"
                          required
                          className="rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface"
                        />
                      </div>
                      <Button type="submit" variant="primary" size="sm">
                        {m.btnCreatePlan}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </PremiumSectionCard>

            {/* Deposits */}
            <PremiumSectionCard
              title={m.sectionDeposits}
              icon={<CreditCard />}
              trailing={
                isAdmin ? (
                  <Link href={`/dashboard/deposits/new?contractId=${contract.id}`}>
                    <Button variant="secondary" size="sm" type="button" leftIcon={<CreditCard className="h-3.5 w-3.5" />}>
                      {m.btnRegisterDeposit}
                    </Button>
                  </Link>
                ) : undefined
              }
              padded={false}
            >
              {contract.deposits && contract.deposits.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {contract.deposits.map((d) => (
                    <li
                      key={d.id}
                      className="px-5 sm:px-6 py-3.5 flex items-center gap-3 hover:bg-canvas/40 transition-colors duration-100"
                    >
                      <div className="min-w-0 flex-1">
                        {isAdmin ? (
                          <Link
                            href={`/dashboard/deposits/${d.id}`}
                            className="text-[15px] font-bold tabular-nums text-brand-700 hover:underline"
                          >
                            {formatCurrency(d.amount, currency)}
                          </Link>
                        ) : (
                          <span className="text-[15px] font-bold tabular-nums text-slate-900">
                            {formatCurrency(d.amount, currency)}
                          </span>
                        )}
                        <p className="text-[12px] text-slate-400 mt-0.5">{formatDate(d.paidAt)}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {d.receiptUrl && (
                          <a
                            href={d.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> {m.receiptLabel}
                          </a>
                        )}
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                            d.verified
                              ? 'bg-success-50 text-success-700'
                              : 'bg-amber-50 text-amber-700',
                          )}
                        >
                          {d.verified ? m.depositVerified : m.depositUnverified}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  {m.emptyDeposits}
                </div>
              )}
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            {/* Quick navigation */}
            <PremiumCommandPanel title={m.quickActionsTitle}>
              {contract.customer && (
                <Link href={`/dashboard/customers/${contract.customer.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><User /></span>
                  <span>{m.cmdViewClient}</span>
                </Link>
              )}
              {contract.unit && (
                <Link href={`/dashboard/units/${contract.unit.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Building2 /></span>
                  <span>{m.cmdViewUnit}</span>
                </Link>
              )}
              {contract.reservation && (
                <Link href={`/dashboard/reservations/${contract.reservation.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Link2 /></span>
                  <span>{m.cmdLinkedReservation}</span>
                </Link>
              )}
              {isAdmin && (
                <Link href={`/dashboard/deposits/new?contractId=${contract.id}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><CreditCard /></span>
                  <span>{m.cmdRegisterDeposit}</span>
                </Link>
              )}
            </PremiumCommandPanel>

            {/* Customer */}
            <PremiumSectionCard title={m.sectionCustomer} icon={<User />}>
              {contract.customer ? (
                <div className="space-y-2.5">
                  <p className="text-[15px] font-bold text-slate-900">
                    {contract.customer.fullName}
                  </p>
                  {contract.customer.phone && (
                    <a
                      href={`tel:${contract.customer.phone}`}
                      className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <Phone />
                      </span>
                      <span className="text-sm font-medium text-slate-700" dir="ltr">
                        {contract.customer.phone}
                      </span>
                    </a>
                  )}
                  {customerEmail && (
                    <a
                      href={`mailto:${customerEmail}`}
                      className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <Mail />
                      </span>
                      <span className="text-sm font-medium text-slate-700 truncate" dir="ltr">
                        {customerEmail}
                      </span>
                    </a>
                  )}
                  <Link
                    href={`/dashboard/customers/${contract.customer.id}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {m.linkViewClientProfile}
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </PremiumSectionCard>

            {/* Unit */}
            <PremiumSectionCard title={m.sectionUnit} icon={<Building2 />}>
              {contract.unit ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/units/${contract.unit.id}`}
                      className="text-[16px] font-bold text-brand-700 hover:underline"
                    >
                      {contract.unit.code}
                    </Link>
                    {contract.unit.type && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-canvas px-2 py-0.5 rounded-lg border border-hairline">
                        {contract.unit.type}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500">{projectName}</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">—</p>
              )}
            </PremiumSectionCard>

            {/* Financial summary */}
            <PremiumSectionCard title={m.sectionFinancialSummary} padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow label={m.sideTotal}>
                  <span className="text-[14px] font-bold tabular-nums text-slate-900">
                    {formatCurrency(contract.totalAmount, currency)}
                  </span>
                </SideRow>
                <SideRow label={m.sideDownPayment}>
                  <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                    {formatCurrency(contract.downPayment, currency)}
                  </span>
                </SideRow>
                {plan && (
                  <>
                    <SideRow label={m.sideInstallmentCount}>
                      <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                        {plan.totalMonths} {m.monthSuffix}
                      </span>
                    </SideRow>
                    <SideRow label={m.sideMonthlyAmount}>
                      <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                        {formatCurrency(plan.monthlyAmount, currency)}
                      </span>
                    </SideRow>
                  </>
                )}
                <SideRow label={m.sideSignStatus}>
                  {contract.signedAt ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {m.sideSignedAt} {formatDate(contract.signedAt)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      {m.sidePending}
                    </span>
                  )}
                </SideRow>
              </div>
            </PremiumSectionCard>

            {/* PDF panel */}
            <ContractPdfPanel contract={contract} locale={locale} />

            {/* Contract documents */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400 px-1">
                {m.contractDocsNote}
              </p>
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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <p className="text-[12px] font-medium text-slate-500 shrink-0">{label}</p>
      <div className="text-end">{children}</div>
    </div>
  );
}
