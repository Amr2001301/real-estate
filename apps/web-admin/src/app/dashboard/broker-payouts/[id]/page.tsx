import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowUpRight, Check, XCircle } from 'lucide-react';
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
  const word = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const timeline = [
    { text: m.createdEvent, at: payout.createdAt },
    ...(payout.notes ? noteLines(payout.notes) : []),
    ...(payout.paidAt ? [{ text: m.paidEvent, at: payout.paidAt }] : []),
  ];

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={payout.broker?.companyName ?? payout.payoutNumber}
        description={`${m.payoutWord} ${payout.payoutNumber}${payout.period ? ` · ${periodLabel(payout.period, locale)}` : ''}`}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* ── The statement: line items down to the net ───────────────────── */}
        <section data-testid="payout-statement" className={cn(card, 'overflow-hidden xl:col-span-2')}>
          <header className="flex flex-wrap items-end justify-between gap-4 px-7 pb-6 pt-7">
            <div>
              <p className="text-[13px] font-bold text-[#B8913F] dark:text-[#D8B66A]">{m.statementTitle}</p>
              <p className="mt-1 text-[12.5px] text-slate-500">
                <span className="font-mono" dir="ltr">{payout.payoutNumber}</span>
                {' · '}
                {m.issuedOn(formatDate(payout.createdAt, locale))}
              </p>
            </div>
            <div data-testid="payout-net" className="text-end">
              <p className="text-[12px] font-semibold text-slate-500">{m.netHeadline}</p>
              <p className="mt-1 font-heading text-[40px] font-bold leading-none tabular-nums text-slate-900">
                <Amount parts={compactParts(payout.totalNet, symbol, locale)} />
              </p>
            </div>
          </header>

          {/* Line items */}
          <div data-testid="payout-commissions" className="border-t border-hairline">
            <p className="flex items-center justify-between px-7 pb-2 pt-5 text-[12px] font-semibold text-slate-500">
              <span>{m.sectionCommissions}</span>
              <span>{m.commissionsCount(commissions.length)}</span>
            </p>
            {commissions.length === 0 ? (
              <p className="mx-7 mb-5 rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-slate-500">{m.noCommissions}</p>
            ) : (
              <ul className="px-7">
                {commissions.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 border-b border-dashed border-hairline py-4 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/broker-commissions/${c.id}` as never} className="text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                        {c.contract.customer?.fullName ?? c.commissionNumber}
                      </Link>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {c.unit.building?.phase?.project ? tx(c.unit.building.phase.project.name) : '—'}
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="me-1 text-slate-400">{word('وحدة', 'Unit')}</span>
                        <span className="font-mono" dir="ltr">{c.unit.code}</span>
                        {c.contract.contractNumber && (
                          <>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="me-1 text-slate-400">{word('عقد', 'Contract')}</span>
                            <span className="font-mono" dir="ltr">{c.contract.contractNumber}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <BrokerCommissionStatusBadge status={c.status} locale={locale} />
                    <span className="w-36 whitespace-nowrap text-end text-[15px] font-bold tabular-nums text-slate-900">{money(c.netAmount)}</span>
                    {isDraft && (
                      <RemoveCommissionButton payoutId={payout.id} commissionId={c.id} commissionNumber={c.commissionNumber} locale={locale} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Price changes after payment */}
          {adjustments.length > 0 && (
            <div className="border-t border-hairline px-7 py-4">
              <p className="text-[12px] font-semibold text-slate-500">{m.sectionAdjustments}</p>
              <ul className="mt-2 space-y-2">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{a.reason}</span>
                    <span className={cn('w-36 whitespace-nowrap text-end font-bold tabular-nums', a.kind === 'TOP_UP' ? 'text-emerald-600' : 'text-rose-500')}>
                      {a.kind === 'TOP_UP' ? '+' : '−'}{money(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Totals, receipt style */}
          <dl className="space-y-2.5 border-t border-hairline bg-surface-muted/30 px-7 py-5 text-[13.5px]">
            {[
              [m.subtotal, money(payout.totalGross)],
              [m.lessTax, money(payout.totalTax)],
              [m.lessWithholding, money(payout.totalWithholding)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="w-36 whitespace-nowrap text-end font-semibold tabular-nums text-slate-800">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
              <dt className="text-[15px] font-bold text-slate-900">{m.totalNet}</dt>
              <dd className="whitespace-nowrap text-end text-[20px] font-bold tabular-nums text-[#9A7A2E] dark:text-[#D8B66A]">{money(payout.totalNet)}</dd>
            </div>
          </dl>
        </section>

        {/* ── Side: status and next action, broker, log ───────────────────── */}
        <aside className="space-y-6">
          <section data-testid="payout-status" className={cn(card, 'p-6')}>
            <p className="text-[12px] font-semibold text-slate-500">{m.statusTitle}</p>
            {!cancelled && (
              <ol data-testid="payout-steps" className="mt-4 space-y-0">
                {STEPS.map((st, i) => {
                  const done = i <= stepAt;
                  return (
                    <li key={st} className="relative flex items-center gap-3 pb-4 last:pb-0">
                      {i < STEPS.length - 1 && (
                        <span aria-hidden className={cn('absolute start-3 top-6 h-[calc(100%-12px)] w-0.5 -translate-x-1/2 rtl:translate-x-1/2', i < stepAt ? 'bg-[#C9A24E]' : 'bg-slate-500/20')} />
                      )}
                      <span
                        aria-current={i === stepAt ? 'step' : undefined}
                        className={cn(
                          'relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                          done ? 'bg-[#C9A24E] text-[#1a1408]' : 'border border-hairline bg-surface text-slate-400',
                          i === stepAt && 'ring-4 ring-[#D8B66A]/25',
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className={cn('text-[13.5px]', i === stepAt ? 'font-bold text-slate-900' : done ? 'font-semibold text-slate-700' : 'text-slate-500')}>
                        {m.steps[st]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            {(payout.paymentMethod || payout.paymentReference || payout.scheduledAt || payout.paidAt) && (
              <dl className="mt-5 space-y-2 border-t border-hairline pt-4 text-[13px]">
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
                {payout.receiptUrl && (
                  <a href={payout.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 pt-1 text-[13px] font-bold text-brand-700 hover:text-brand-600">
                    {m.receiptLink}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </dl>
            )}

            {(isDraft || isApproved || isProcessing) && (
              <div data-testid="payout-next" className="mt-5 border-t border-hairline pt-5">
                <p className="text-[12px] font-semibold text-slate-500">{m.nextStep}</p>
                <p className="mb-4 mt-0.5 font-heading text-[17px] font-bold text-slate-900">
                  {isDraft ? m.actionApprove : isApproved ? m.actionProcess : m.actionMarkPaid}
                </p>
                <div className="[&_button[type=submit]]:w-full">
                  {isDraft && <ApprovePayoutForm id={payout.id} locale={locale} />}
                  {isApproved && <ProcessPayoutForm id={payout.id} locale={locale} />}
                  {isProcessing && <MarkPaidPayoutForm id={payout.id} locale={locale} />}
                </div>
                {canCancel && (
                  <details className="group mt-4">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-bold text-danger-600 [&::-webkit-details-marker]:hidden">
                      <XCircle className="h-4 w-4" />
                      {m.cancelToggle}
                    </summary>
                    <div className="mt-3 rounded-2xl border border-danger-500/25 p-4">
                      <CancelPayoutForm id={payout.id} locale={locale} />
                      <p className="mt-2 text-[11.5px] text-slate-500">{m.cancelNote}</p>
                    </div>
                  </details>
                )}
              </div>
            )}
          </section>

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

          <section data-testid="payout-log" className={cn(card, 'p-6')}>
            <p className="text-[12px] font-semibold text-slate-500">{m.timelineTitle}</p>
            <ol className="mt-4">
              {timeline.map((n, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span aria-hidden className="absolute start-[3px] top-3 h-full w-px bg-hairline" />
                  )}
                  <span className="relative mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[#C9A24E]" />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-relaxed text-slate-800">{n.text}</p>
                    {n.at && <p className="mt-0.5 text-[11.5px] text-slate-500">{formatDateTime(n.at, locale)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
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
