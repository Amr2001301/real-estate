import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeftRight, ArrowUpRight, Check, XCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerPayout } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { PremiumPageHero } from '@/components/premium';
import { Amount, Avatar } from '@/components/cockpit/cockpit';
import { periodLabel } from '../../targets/utils';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  BrokerPayoutStatusBadge,
  BrokerStatusBadge,
  BrokerCommissionStatusBadge,
} from '@/components/badges';
import {
  ApprovePayoutForm,
  ProcessPayoutForm,
  MarkPaidPayoutForm,
  CancelPayoutForm,
} from './_action-forms';
import { RemoveCommissionButton } from './_remove-commission-button';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function AdminBrokerPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerPayoutDetail;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const r = await safe(api.get<AdminBrokerPayout>(`/broker-payouts/${id}`));
  if (r.error || !r.data) notFound();
  const payout = r.data;
  const commissions = payout.commissions ?? [];
  const adjustments = payout.adjustments ?? [];

  const isDraft = payout.status === 'DRAFT';
  const isApproved = payout.status === 'APPROVED';
  const isProcessing = payout.status === 'PROCESSING';
  const canCancel = isDraft || isApproved;

  const METHOD_LABEL: Record<string, string> = {
    BANK_TRANSFER: m.methodBankTransfer,
    CHEQUE: m.methodCheque,
    CASH: m.methodCash,
    OTHER: m.methodOther,
  };

  const money = (n: number | string | null | undefined) => formatCurrency(n, currency, locale);
  const STEPS = ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID'] as const;
  const stepAt = STEPS.indexOf(payout.status as (typeof STEPS)[number]);
  const cancelled = payout.status === 'CANCELLED';
  const card = 'rounded-[22px] border border-hairline bg-surface';

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={payout.payoutNumber}
        description={
          payout.broker
            ? m.descriptionPayout(payout.broker.companyName, payout.period ? periodLabel(payout.period, locale) : '')
            : undefined
        }
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: m.breadcrumbPayouts, href: '/dashboard/broker-payouts' },
          { label: payout.payoutNumber },
        ]}
        meta={<BrokerPayoutStatusBadge status={payout.status} locale={locale} />}
      />

      {cancelled && payout.cancelReason && (
        <div className="flex items-start gap-3 rounded-[22px] border border-danger-500/25 bg-danger-500/10 p-5 text-sm text-danger-600">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">{m.cancelledTitle}</p>
            <p className="mt-1 leading-relaxed">{payout.cancelReason}</p>
            {payout.cancelledBy && (
              <p className="mt-1 text-[12px] text-slate-500">
                {m.cancelledBy} {payout.cancelledBy.fullName} • {formatDateTime(payout.cancelledAt, locale)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* The money, and where the payout stands */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section data-testid="payout-net" className={cn(card, 'p-6 sm:p-7 xl:col-span-2')}>
          <p className="text-[13px] font-bold text-[#B8913F] dark:text-[#D8B66A]">{m.netHeadline}</p>
          <p className="mt-2 font-heading text-[44px] font-bold leading-none tabular-nums text-slate-900">
            <Amount parts={compactParts(payout.totalNet, symbol, locale)} />
          </p>
          <p className="mt-1 text-[12.5px] tabular-nums text-slate-500" dir="auto">{money(payout.totalNet)}</p>

          {/* gross − tax − withholding = net */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4">
            {[
              { label: m.totalGross, value: money(payout.totalGross), sign: '' },
              { label: m.totalTax, value: money(payout.totalTax), sign: '−' },
              { label: m.totalWithholding, value: money(payout.totalWithholding), sign: '−' },
              { label: m.totalNet, value: money(payout.totalNet), sign: '=' , strong: true },
            ].map((f) => (
              <div key={f.label} className={cn('bg-surface px-4 py-3.5', f.strong && 'bg-emerald-500/[0.06]')}>
                <dt className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                  {f.sign && <span className="font-bold text-slate-400">{f.sign}</span>}
                  {f.label}
                </dt>
                <dd className={cn('mt-1 whitespace-nowrap text-[14px] font-bold tabular-nums', f.strong ? 'text-emerald-600' : 'text-slate-900')}>{f.value}</dd>
              </div>
            ))}
          </dl>

          {/* Progress: draft → approved → processing → paid */}
          {!cancelled && (
            <ol data-testid="payout-steps" className="mt-7 grid grid-cols-4">
              {STEPS.map((st, i) => {
                const done = i <= stepAt;
                return (
                  <li key={st} className="relative flex flex-col items-center gap-2 text-center">
                    {i > 0 && (
                      <span className={cn('absolute end-1/2 top-3 h-0.5 w-full -translate-y-1/2', i <= stepAt ? 'bg-[#C9A24E]' : 'bg-slate-500/20')} aria-hidden />
                    )}
                    <span
                      aria-current={i === stepAt ? 'step' : undefined}
                      className={cn(
                        'relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                        done ? 'bg-[#C9A24E] text-[#1a1408]' : 'border border-hairline bg-surface text-slate-400',
                        i === stepAt && 'ring-4 ring-[#D8B66A]/25',
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={cn('text-[12px] font-semibold', done ? 'text-slate-900' : 'text-slate-500')}>{m.steps[st]}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <section className={cn(card, 'p-6')}>
            <p className="text-[12px] font-semibold text-slate-500">{m.sectionBroker}</p>
            {payout.broker ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={payout.broker.companyName} className="h-11 w-11 text-[14px]" />
                <div className="min-w-0">
                  <Link href={`/dashboard/brokers/${payout.broker.id}` as never} className="block truncate text-[15px] font-bold text-slate-900 hover:text-brand-700">
                    {payout.broker.companyName}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <BrokerStatusBadge status={payout.broker.status} />
                    <span className="font-mono text-[11px] text-slate-500" dir="ltr">{payout.broker.code}</span>
                  </div>
                </div>
              </div>
            ) : '—'}
            <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-[13px]">
              <span className="text-slate-500">{m.labelPeriod}</span>
              <span className="font-bold text-slate-900">{payout.period ? periodLabel(payout.period, locale) : '—'}</span>
            </div>
          </section>

          {(payout.paymentMethod || payout.paymentReference || payout.paidAt || payout.scheduledAt) && (
            <section className={cn(card, 'p-6')}>
              <p className="text-[12px] font-semibold text-slate-500">{m.sectionPaymentDetails}</p>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                {[
                  [m.labelPaymentMethod, payout.paymentMethod ? METHOD_LABEL[payout.paymentMethod] : null],
                  [m.labelPaymentReference, payout.paymentReference],
                  [m.labelScheduledAt, payout.scheduledAt ? formatDate(payout.scheduledAt, locale) : null],
                  [m.labelPaidAt, payout.paidAt ? formatDate(payout.paidAt, locale) : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-bold text-slate-900" dir="auto">{v}</dd>
                  </div>
                ))}
              </dl>
              {payout.receiptUrl && (
                <a href={payout.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 hover:text-brand-600">
                  {m.receiptLink}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* What happens next: the one main action, cancel tucked behind a toggle */}
      {(isDraft || isApproved || isProcessing) && (
        <section data-testid="payout-next" className={cn(card, 'p-6 sm:p-7')}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#D8B66A]/[0.16] text-[#B8913F] dark:text-[#D8B66A]">
              <ArrowLeftRight className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">{m.nextStep}</p>
              <h2 className="font-heading text-[18px] font-bold text-slate-900">
                {isDraft ? m.actionApprove : isApproved ? m.actionProcess : m.actionMarkPaid}
              </h2>
            </div>
          </div>
          <div className="mt-5 max-w-2xl">
            {isDraft && <ApprovePayoutForm id={payout.id} locale={locale} />}
            {isApproved && <ProcessPayoutForm id={payout.id} locale={locale} />}
            {isProcessing && <MarkPaidPayoutForm id={payout.id} locale={locale} />}
          </div>
          {canCancel && (
            <details className="group mt-6 border-t border-hairline pt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-bold text-danger-600 [&::-webkit-details-marker]:hidden">
                <XCircle className="h-4 w-4" />
                {m.cancelToggle}
              </summary>
              <div className="mt-4 max-w-2xl rounded-2xl border border-danger-500/25 p-5">
                <CancelPayoutForm id={payout.id} locale={locale} />
                <p className="mt-2 text-[12px] text-slate-500">{m.cancelNote}</p>
              </div>
            </details>
          )}
        </section>
      )}

      {/* Commissions in this payout */}
      <section data-testid="payout-commissions" className={card}>
        <header className="flex items-center justify-between gap-3 px-6 py-5">
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.sectionCommissions}</h2>
          <span className="text-[12.5px] text-slate-500">{m.commissionsCount(commissions.length)}</span>
        </header>
        {commissions.length === 0 ? (
          <p className="mx-6 mb-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{m.noCommissions}</p>
        ) : (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {commissions.map((c) => (
              <li key={c.id} className="grid grid-cols-1 items-center gap-3 px-6 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_auto_auto_auto]">
                <div className="min-w-0">
                  <Link href={`/dashboard/broker-commissions/${c.id}` as never} className="text-[14px] font-bold text-slate-900 hover:text-brand-700">
                    {c.contract.customer?.fullName ?? c.commissionNumber}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    <span className="font-mono" dir="ltr">{c.commissionNumber}</span> · {formatDate(c.earnedAt, locale)}
                  </p>
                </div>
                <div className="min-w-0 text-[12.5px]">
                  <p className="truncate font-semibold text-slate-700">
                    {c.unit.building?.phase?.project ? tx(c.unit.building.phase.project.name) : '—'}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span><span className="font-mono" dir="ltr">{c.unit.code}</span>
                    {c.contract.contractNumber && <> · <span className="me-1 text-slate-400">{locale === 'en' ? 'Contract' : 'عقد'}</span><span className="font-mono" dir="ltr">{c.contract.contractNumber}</span></>}
                  </p>
                </div>
                <BrokerCommissionStatusBadge status={c.status} locale={locale} />
                <div className="text-end">
                  <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{money(c.netAmount)}</p>
                  {Number(c.grossAmount) !== Number(c.netAmount) && (
                    <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">{m.colGross} {money(c.grossAmount)}</p>
                  )}
                </div>
                <div className="w-14 text-end">
                  {isDraft && (
                    <RemoveCommissionButton payoutId={payout.id} commissionId={c.id} commissionNumber={c.commissionNumber} locale={locale} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adjustments.length > 0 && (
        <section className={card}>
          <header className="px-6 py-5">
            <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.sectionAdjustments}</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">{m.adjustmentsHint}</p>
          </header>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {adjustments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/broker-commissions/${a.commission.id}` as never} className="font-mono text-[13px] font-bold text-slate-900 hover:text-brand-700" dir="ltr">
                    {a.commission.commissionNumber}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">{a.reason}</p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-bold', a.kind === 'TOP_UP' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-500')}>
                  {a.kind === 'TOP_UP' ? m.adjustmentTopUp : m.adjustmentClawback}
                </span>
                <span className={cn('whitespace-nowrap text-[15px] font-bold tabular-nums', a.kind === 'TOP_UP' ? 'text-emerald-600' : 'text-rose-500')}>
                  {a.kind === 'TOP_UP' ? '+' : '−'}{money(a.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payout.notes && (
        <section className={cn(card, 'p-6')}>
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.sectionNotes}</h2>
          <ol className="mt-4 space-y-3">
            {noteLines(payout.notes).map((n, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24E]" />
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-relaxed text-slate-800">{n.text}</p>
                  {n.at && <p className="mt-0.5 text-[11.5px] text-slate-500">{formatDateTime(n.at, locale)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * The notes field gathers one line per step, written by the API as
 * "[ISO time] [action] text". Show the text and a readable time, not the tags.
 */
function noteLines(notes: string): Array<{ text: string; at?: string }> {
  return notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]\s*(?:\[[A-Za-z_-]+\]\s*)?(.*)$/);
      return m ? { text: m[2] || '—', at: m[1] } : { text: l };
    });
}
