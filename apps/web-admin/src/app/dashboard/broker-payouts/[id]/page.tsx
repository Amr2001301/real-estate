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
        description={`${m.payoutWord} ${payout.payoutNumber}`}
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

      {/* ── Summary: the net, the key facts, and where the payout stands ── */}
      <section data-testid="payout-summary" className={cn(card, 'overflow-hidden')}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
          <div data-testid="payout-net" className="flex flex-col justify-center gap-1 border-b border-hairline p-7 lg:border-b-0 lg:border-e">
            <p className="text-[13px] font-bold text-[#B8913F] dark:text-[#D8B66A]">{m.netHeadline}</p>
            <p className="font-heading text-[52px] font-bold leading-none tabular-nums text-slate-900">
              <Amount parts={compactParts(payout.totalNet, symbol, locale)} />
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-slate-500">{money(payout.totalNet)}</p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {[
              {
                label: m.sectionBroker,
                value: payout.broker ? (
                  <Link href={`/dashboard/brokers/${payout.broker.id}` as never} className="hover:text-brand-700">{payout.broker.companyName}</Link>
                ) : '—',
              },
              { label: m.labelPeriod, value: payout.period ? periodLabel(payout.period, locale) : '—' },
              { label: m.sectionCommissions, value: m.commissionsCount(commissions.length) },
              { label: m.issuedLabel, value: formatDate(payout.createdAt, locale) },
            ].map((f, i) => (
              <div key={i} className={cn('flex flex-col justify-center gap-1.5 px-6 py-6', i > 0 && 'sm:border-s sm:border-hairline', i % 2 === 1 && 'max-sm:border-s max-sm:border-hairline', i >= 2 && 'max-sm:border-t max-sm:border-hairline')}>
                <dt className="text-[12px] font-semibold text-slate-500">{f.label}</dt>
                <dd className="text-[15px] font-bold leading-snug text-slate-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {!cancelled && (
          <ol data-testid="payout-steps" className="flex items-center gap-3 border-t border-hairline bg-surface-muted/30 px-7 py-5">
            {STEPS.map((st, i) => {
              const done = i <= stepAt;
              return (
                <li key={st} className={cn('flex items-center gap-3', i < STEPS.length - 1 && 'flex-1')}>
                  <span
                    aria-current={i === stepAt ? 'step' : undefined}
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                      done ? 'bg-[#C9A24E] text-[#1a1408]' : 'border border-hairline bg-surface text-slate-400',
                      i === stepAt && 'ring-4 ring-[#D8B66A]/25',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={cn('whitespace-nowrap text-[14px]', i === stepAt ? 'font-bold text-slate-900' : done ? 'font-semibold text-slate-700' : 'text-slate-500')}>
                    {m.steps[st]}
                  </span>
                  {i < STEPS.length - 1 && <span aria-hidden className={cn('h-0.5 flex-1 rounded-full', i < stepAt ? 'bg-[#C9A24E]' : 'bg-slate-500/20')} />}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* ── The statement: line items down to the net ───────────────────── */}
        <section data-testid="payout-statement" className={cn(card, 'overflow-hidden xl:col-span-2')}>
          <header className="flex items-center justify-between gap-4 px-7 py-5">
            <h2 className="font-heading text-[19px] font-bold text-slate-900">{m.statementTitle}</h2>
            <span className="font-mono text-[12.5px] text-slate-500" dir="ltr">{payout.payoutNumber}</span>
          </header>

          <div data-testid="payout-commissions" className="border-t border-hairline">
            {commissions.length === 0 ? (
              <p className="mx-7 my-5 rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-slate-500">{m.noCommissions}</p>
            ) : (
              <ul className="px-7">
                {commissions.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 border-b border-dashed border-hairline py-5 last:border-b-0">
                    <Avatar name={c.contract.customer?.fullName ?? '—'} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/broker-commissions/${c.id}` as never} className="text-[15px] font-bold text-slate-900 hover:text-brand-700">
                        {c.contract.customer?.fullName ?? c.commissionNumber}
                      </Link>
                      <p className="mt-1 text-[12.5px] text-slate-500">
                        {c.unit.building?.phase?.project ? tx(c.unit.building.phase.project.name) : '—'}
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="me-1 text-slate-400">{word('وحدة', 'Unit')}</span>
                        <span className="whitespace-nowrap font-mono" dir="ltr">{c.unit.code}</span>
                        {c.contract.contractNumber && (
                          <>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="me-1 text-slate-400">{word('عقد', 'Contract')}</span>
                            <span className="whitespace-nowrap font-mono" dir="ltr">{c.contract.contractNumber}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <BrokerCommissionStatusBadge status={c.status} locale={locale} />
                    <span className="w-36 whitespace-nowrap text-end text-[16px] font-bold tabular-nums text-slate-900">{money(c.netAmount)}</span>
                    {isDraft && (
                      <RemoveCommissionButton payoutId={payout.id} commissionId={c.id} commissionNumber={c.commissionNumber} locale={locale} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {adjustments.length > 0 && (
            <div className="border-t border-hairline px-7 py-4">
              <p className="text-[12px] font-semibold text-slate-500">{m.sectionAdjustments}</p>
              <ul className="mt-2 space-y-2">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-[13.5px]">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{a.reason}</span>
                    <span className={cn('w-36 whitespace-nowrap text-end font-bold tabular-nums', a.kind === 'TOP_UP' ? 'text-emerald-600' : 'text-rose-500')}>
                      {a.kind === 'TOP_UP' ? '+' : '−'}{money(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="space-y-3 border-t border-hairline bg-surface-muted/30 px-7 py-6 text-[14px]">
            {[
              [m.subtotal, money(payout.totalGross)],
              [m.lessTax, money(payout.totalTax)],
              [m.lessWithholding, money(payout.totalWithholding)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="w-40 whitespace-nowrap text-end font-semibold tabular-nums text-slate-800">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 border-t border-hairline pt-4">
              <dt className="text-[16px] font-bold text-slate-900">{m.totalNet}</dt>
              <dd className="whitespace-nowrap text-end text-[22px] font-bold tabular-nums text-[#9A7A2E] dark:text-[#D8B66A]">{money(payout.totalNet)}</dd>
            </div>
          </dl>
        </section>

        {/* ── Side: the one next action, payment details, log ─────────────── */}
        <aside className="space-y-6">
          {(isDraft || isApproved || isProcessing) && (
            <section data-testid="payout-next" className={cn(card, 'p-6')}>
              <p className="text-[12px] font-semibold text-slate-500">{m.nextStep}</p>
              <h2 className="mb-5 mt-0.5 font-heading text-[19px] font-bold text-slate-900">
                {isDraft ? m.actionApprove : isApproved ? m.actionProcess : m.actionMarkPaid}
              </h2>
              <div className="[&_button[type=submit]]:w-full">
                {isDraft && <ApprovePayoutForm id={payout.id} locale={locale} />}
                {isApproved && <ProcessPayoutForm id={payout.id} locale={locale} />}
                {isProcessing && <MarkPaidPayoutForm id={payout.id} locale={locale} />}
              </div>
              {canCancel && (
                <details className="group mt-5 border-t border-hairline pt-4">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-bold text-danger-600 [&::-webkit-details-marker]:hidden">
                    <XCircle className="h-4 w-4" />
                    {m.cancelToggle}
                  </summary>
                  <div className="mt-3 rounded-2xl border border-danger-500/25 p-4">
                    <CancelPayoutForm id={payout.id} locale={locale} />
                    <p className="mt-2 text-[11.5px] text-slate-500">{m.cancelNote}</p>
                  </div>
                </details>
              )}
            </section>
          )}

          {(payout.paymentMethod || payout.paymentReference || payout.scheduledAt || payout.paidAt) && (
            <section className={cn(card, 'p-6')}>
              <p className="text-[12px] font-semibold text-slate-500">{m.sectionPaymentDetails}</p>
              <dl className="mt-3 space-y-2.5 text-[13.5px]">
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

          <section data-testid="payout-log" className={cn(card, 'p-6')}>
            <p className="text-[12px] font-semibold text-slate-500">{m.timelineTitle}</p>
            <ol className="mt-4">
              {timeline.map((n, i) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < timeline.length - 1 && <span aria-hidden className="absolute start-[4px] top-4 h-full w-px bg-hairline" />}
                  <span className="relative mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full border-2 border-[#C9A24E] bg-surface" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] leading-relaxed text-slate-800">{n.text}</p>
                    {n.at && <p className="mt-0.5 text-[12px] text-slate-500">{formatDateTime(n.at, locale)}</p>}
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
