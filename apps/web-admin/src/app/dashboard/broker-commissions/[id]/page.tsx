import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Briefcase,
  UserCircle,
  Building2,
  Home,
  Banknote,
  FileText,
  CalendarRange,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerCommission } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
} from '@/components/premium';
import {
  BrokerCommissionStatusBadge,
  BrokerStatusBadge,
} from '@/components/badges';
import {
  ApproveCommissionForm,
  RejectCommissionForm,
  CancelCommissionForm,
} from './_review-forms';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const SIDE_ROW = 'flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline last:border-b-0';
const TILE_BASE = 'flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline min-w-0';
const TILE_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]';

function SideRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className={SIDE_ROW}>
      <p className="text-[11px] font-semibold text-slate-400 shrink-0">{label}</p>
      <div className={cn('text-[13px] font-semibold text-slate-800 text-end truncate max-w-[60%]', valueClass)}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className={cn('text-[15px] font-bold tabular-nums leading-snug', highlight ? 'text-success-700' : 'text-slate-900')}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AdminBrokerCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerCommissionDetail;
  const currency = await getReportsCurrency();
  const r = await safe(api.get<AdminBrokerCommission>(`/broker-commissions/${id}`));
  if (r.error || !r.data) notFound();
  const c = r.data;

  const canApprove = c.status === 'PENDING' || c.status === 'REJECTED';
  const canReject = c.status === 'PENDING' || c.status === 'APPROVED';
  const canCancel = c.status !== 'CANCELLED';
  const showReview = (canApprove || canReject || canCancel) && c.status !== 'CANCELLED';

  const reviewCount = [canApprove, canReject, canCancel].filter(Boolean).length;
  const reviewGridCols =
    reviewCount === 1 ? 'lg:grid-cols-1' : reviewCount === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';

  const brokerContact = c.brokerAgent
    ? (c.brokerAgent.email ?? c.brokerAgent.phone ?? null)
    : null;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={c.commissionNumber}
        description={`${m.descriptionPrefix}${c.contract?.contractNumber ?? '—'}`}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: m.breadcrumbCommissions, href: '/dashboard/broker-commissions' },
          { label: c.commissionNumber },
        ]}
        meta={<BrokerCommissionStatusBadge status={c.status} />}
        actions={
          <Link href="/dashboard/broker-commissions">
            <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              {m.backBtn}
            </Button>
          </Link>
        }
      />

      {/* Rejection banner */}
      {c.status === 'REJECTED' && c.rejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-5">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{m.rejectionTitle}</p>
            <p className="mt-1 text-sm leading-relaxed">{c.rejectionReason}</p>
            {c.rejectedBy && (
              <p className="text-[11px] text-danger-500 mt-1.5">
                {m.rejectedBy} {c.rejectedBy.fullName} · {formatDateTime(c.rejectedAt)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Approval confirmation */}
      {c.approvedBy && c.status === 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 text-success-700 p-5">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{m.approvedTitle}</p>
            <p className="text-[11px] text-success-600 mt-1">
              {m.approvedBy} {c.approvedBy.fullName} · {formatDateTime(c.approvedAt)}
            </p>
          </div>
        </div>
      )}

      <PremiumDetailLayout
        main={
          <>
            {/* Contract + Reservation */}
            <PremiumSectionCard title={m.sectionContract} icon={<FileText />} padded={false}>
              <SideRow
                label={m.labelContractNumber}
                value={
                  c.contract ? (
                    <Link
                      href={`/dashboard/contracts/${c.contract.id}` as never}
                      className="font-mono text-brand-700 hover:underline"
                      dir="ltr"
                    >
                      {c.contract.contractNumber ?? '—'}
                    </Link>
                  ) : '—'
                }
              />
              <SideRow
                label={m.labelReservationNumber}
                value={
                  c.reservation ? (
                    <Link
                      href={`/dashboard/broker-reservations/${c.reservation.id}` as never}
                      className="font-mono text-brand-700 hover:underline"
                      dir="ltr"
                    >
                      {c.reservation.reservationNumber ?? '—'}
                    </Link>
                  ) : '—'
                }
              />
              <SideRow
                label={m.labelClient}
                value={c.contract?.customer?.fullName ?? c.reservation?.lead?.fullName ?? '—'}
              />
              <SideRow
                label={m.labelInternalRep}
                value={c.reservation?.sales?.fullName ?? '—'}
              />
            </PremiumSectionCard>

            {/* Unit + Project */}
            <PremiumSectionCard title={m.sectionUnit} icon={<Building2 />} padded={false}>
              <SideRow label={m.labelProject} value={c.project ? tx(c.project.name) : '—'} />
              <SideRow
                label={m.labelUnit}
                value={
                  c.unit ? (
                    <span dir="ltr" className="font-mono">
                      {c.unit.code} · {c.unit.type}
                    </span>
                  ) : '—'
                }
              />
              <SideRow label={m.labelDueDate} value={formatDate(c.earnedAt)} />
            </PremiumSectionCard>

            {/* Financials */}
            <PremiumSectionCard title={m.sectionFinancials} icon={<Banknote />} padded={false}>
              <div className="grid grid-cols-2 sm:grid-cols-3 divide-y sm:divide-y-0 divide-x-0 sm:divide-x sm:divide-x-reverse divide-hairline border-b border-hairline">
                <MetricCell label={m.labelBasis} value={formatCurrency(c.basisAmount, currency)} />
                <MetricCell
                  label={m.labelRate}
                  value={
                    c.commissionPct != null
                      ? `${Number(c.commissionPct).toFixed(2)}%`
                      : '—'
                  }
                />
                <MetricCell label={m.labelGross} value={formatCurrency(c.grossAmount, currency)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 divide-y sm:divide-y-0 divide-x-0 sm:divide-x sm:divide-x-reverse divide-hairline">
                <MetricCell
                  label={m.labelTax}
                  value={`${Number(c.taxPct).toFixed(2)}%`}
                  sub={formatCurrency(c.taxAmount, currency)}
                />
                <MetricCell
                  label={m.labelWithholding}
                  value={`${Number(c.withholdingPct).toFixed(2)}%`}
                  sub={formatCurrency(c.withholdingAmount, currency)}
                />
                <MetricCell
                  label={m.labelNet}
                  value={formatCurrency(c.netAmount, currency)}
                  highlight
                />
              </div>
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            {/* Broker card */}
            <PremiumSectionCard title={m.sectionBroker} icon={<Briefcase />}>
              {c.broker ? (
                <div className="space-y-3">
                  <div>
                    <Link
                      href={`/dashboard/brokers/${c.broker.id}` as never}
                      className="text-[15px] font-bold text-slate-900 hover:text-brand-700 transition-colors"
                    >
                      {c.broker.companyName}
                    </Link>
                    <div className="flex items-center gap-2 mt-1.5">
                      <BrokerStatusBadge status={c.broker.status} />
                      <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                        {c.broker.code}
                      </span>
                    </div>
                  </div>

                  {c.brokerAgent && (
                    <div className="pt-3 border-t border-hairline space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {m.labelContact}
                      </p>
                      <p className="text-[13.5px] font-semibold text-slate-800">
                        {c.brokerAgent.fullName}
                      </p>
                      {brokerContact && (
                        <div className={TILE_BASE}>
                          <span className={cn(TILE_ICON, 'bg-brand-50 text-brand-600')}>
                            {brokerContact.includes('@') ? <Mail /> : <Phone />}
                          </span>
                          <span className="text-[12.5px] font-medium text-slate-700 truncate" dir="ltr">
                            {brokerContact}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </PremiumSectionCard>

            {/* Notes (if any) */}
            {c.notes && (
              <PremiumSectionCard title={m.sectionNotes}>
                <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {c.notes}
                </p>
              </PremiumSectionCard>
            )}
          </>
        }
      />

      {/* Review forms */}
      {showReview && (
        <PremiumSectionCard title={m.sectionReview} padded={false}>
          <div className={cn('grid grid-cols-1 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-hairline', reviewGridCols)}>
            {canApprove && (
              <div className="flex flex-col p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-success-600 mb-4">
                  {m.reviewApproveLabel}
                </p>
                <ApproveCommissionForm id={c.id} locale={locale} />
              </div>
            )}
            {canReject && (
              <div className="flex flex-col p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-danger-600 mb-4">
                  {m.reviewRejectLabel}
                </p>
                <RejectCommissionForm id={c.id} locale={locale} />
              </div>
            )}
            {canCancel && (
              <div className="flex flex-col p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-4">
                  {m.reviewCancelLabel}
                </p>
                <CancelCommissionForm id={c.id} locale={locale} />
              </div>
            )}
          </div>
        </PremiumSectionCard>
      )}
    </div>
  );
}
