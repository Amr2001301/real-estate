import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Briefcase,
  Banknote,
  Wallet,
  CalendarRange,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerPayout } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

function InfoRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5" dir={dir}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

export default async function AdminBrokerPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerPayoutDetail;
  const currency = await getReportsCurrency();
  const r = await safe(api.get<AdminBrokerPayout>(`/broker-payouts/${id}`));
  if (r.error || !r.data) notFound();
  const payout = r.data;
  const commissions = payout.commissions ?? [];

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

  return (
    <div className="space-y-5">
      <PageHeader
        title={payout.payoutNumber}
        description={
          payout.broker
            ? m.descriptionPayout(payout.broker.companyName, payout.period ?? '')
            : undefined
        }
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: m.breadcrumbPayouts, href: '/dashboard/broker-payouts' },
          { label: payout.payoutNumber },
        ]}
        meta={<BrokerPayoutStatusBadge status={payout.status} />}
        actions={
          <Link href="/dashboard/broker-payouts">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              {m.backBtn}
            </Button>
          </Link>
        }
      />

      {payout.status === 'CANCELLED' && payout.cancelReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{m.cancelledTitle}</p>
            <p className="mt-1 leading-relaxed">{payout.cancelReason}</p>
            {payout.cancelledBy && (
              <p className="text-2xs text-slate-500 mt-1">
                {m.cancelledBy} {payout.cancelledBy.fullName} • {formatDateTime(payout.cancelledAt)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            {m.sectionBroker}
          </h2>
          {payout.broker ? (
            <>
              <Link
                href={`/dashboard/brokers/${payout.broker.id}` as never}
                className="font-semibold text-slate-900 hover:text-brand-700"
              >
                {payout.broker.companyName}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <BrokerStatusBadge status={payout.broker.status} />
                <span className="font-mono text-2xs text-slate-500" dir="ltr">
                  {payout.broker.code}
                </span>
              </div>
            </>
          ) : '—'}
          <InfoRow icon={<CalendarRange />} label={m.labelPeriod} value={payout.period ?? '—'} dir="ltr" />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-brand-600" />
            {m.sectionTotals}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">{m.totalGross}</p>
              <p className="font-medium mt-1 text-slate-900 tabular-nums">{formatCurrency(payout.totalGross, currency)}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">{m.totalTax}</p>
              <p className="font-medium mt-1 text-slate-900 tabular-nums">{formatCurrency(payout.totalTax, currency)}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-xs text-slate-500">{m.totalWithholding}</p>
              <p className="font-medium mt-1 text-slate-900 tabular-nums">{formatCurrency(payout.totalWithholding, currency)}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3 bg-emerald-50/30">
              <p className="text-xs text-slate-500">{m.totalNet}</p>
              <p className="font-semibold mt-1 text-emerald-700 tabular-nums">{formatCurrency(payout.totalNet, currency)}</p>
            </div>
          </div>
        </Card>
      </div>

      {(payout.paymentMethod || payout.paymentReference || payout.paidAt || payout.scheduledAt) && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-600" />
            {m.sectionPaymentDetails}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
            <InfoRow icon={<Wallet />} label={m.labelPaymentMethod} value={payout.paymentMethod ? METHOD_LABEL[payout.paymentMethod] : '—'} />
            <InfoRow icon={<Wallet />} label={m.labelPaymentReference} value={payout.paymentReference ?? '—'} dir="ltr" />
            <InfoRow icon={<Clock />} label={m.labelScheduledAt} value={formatDate(payout.scheduledAt)} />
            <InfoRow icon={<CheckCircle2 />} label={m.labelPaidAt} value={formatDate(payout.paidAt)} />
          </div>
          {payout.receiptUrl && (
            <p className="mt-2 text-xs">
              <a
                href={payout.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 hover:text-brand-800 underline"
                dir="ltr"
              >
                {m.receiptLink}
              </a>
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{m.sectionCommissions} ({commissions.length})</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">{m.colCommission}</th>
                <th className="text-start font-semibold py-3 px-4">{m.colContract}</th>
                <th className="text-start font-semibold py-3 px-4">{m.colUnit}</th>
                <th className="text-start font-semibold py-3 px-4">{m.colGross}</th>
                <th className="text-start font-semibold py-3 px-4">{m.colNet}</th>
                <th className="text-start font-semibold py-3 px-4">{m.colStatus}</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-sm text-slate-500 py-8">
                    {m.noCommissions}
                  </td>
                </tr>
              )}
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-hairline align-top">
                  <td className="py-3 ps-5 pe-4">
                    <Link
                      href={`/dashboard/broker-commissions/${c.id}` as never}
                      className="font-mono text-xs text-slate-900 hover:text-brand-700"
                      dir="ltr"
                    >
                      {c.commissionNumber}
                    </Link>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {formatDate(c.earnedAt)}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">
                      {c.contract.contractNumber ?? '—'}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.contract.customer?.fullName ?? '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">{c.unit.code}</p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.unit.building?.phase?.project ? tx(c.unit.building.phase.project.name) : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(c.grossAmount, currency)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">{formatCurrency(c.netAmount, currency)}</td>
                  <td className="py-3 px-4">
                    <BrokerCommissionStatusBadge status={c.status} />
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    {isDraft && (
                      <RemoveCommissionButton
                        payoutId={payout.id}
                        commissionId={c.id}
                        commissionNumber={c.commissionNumber}
                        locale={locale}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(isDraft || isApproved || isProcessing) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {isDraft && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{m.actionApprove}</h3>
              <ApprovePayoutForm id={payout.id} locale={locale} />
            </Card>
          )}
          {isApproved && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{m.actionProcess}</h3>
              <ProcessPayoutForm id={payout.id} locale={locale} />
            </Card>
          )}
          {isProcessing && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{m.actionMarkPaid}</h3>
              <MarkPaidPayoutForm id={payout.id} locale={locale} />
            </Card>
          )}
          {canCancel && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{m.actionCancel}</h3>
              <CancelPayoutForm id={payout.id} locale={locale} />
              <p className="mt-2 text-2xs text-slate-500">
                {m.cancelNote}
              </p>
            </Card>
          )}
        </div>
      )}

      {payout.notes && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{m.sectionNotes}</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{payout.notes}</p>
        </Card>
      )}
    </div>
  );
}
