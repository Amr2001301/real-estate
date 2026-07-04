import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Banknote,
  Wallet,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Clock,
  CircleDot,
  ArrowLeft,
  ShieldCheck,
  CalendarRange,
  BadgePercent,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalPayout } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import { BrokerPayoutStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE:        'شيك',
  CASH:          'نقدي',
  OTHER:         'أخرى',
};

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 font-semibold shrink-0">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

export default async function PortalPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currency = await getReportsCurrency();
  const r = await safe(api.get<PortalPayout>(`/portal/payouts/${id}`));
  if (r.error || !r.data) notFound();
  const payout = r.data;
  const commissions = payout.commissions ?? [];
  const isPaid = payout.status === 'PAID';

  const timelineSteps = [
    { label: 'إنشاء الدفعة', at: payout.createdAt,    done: true,               isFinal: false },
    { label: 'الاعتماد',     at: payout.approvedAt,   done: !!payout.approvedAt,  isFinal: false },
    { label: 'بدء التنفيذ', at: payout.processedAt,  done: !!payout.processedAt, isFinal: false },
    { label: 'تاريخ الدفع',  at: payout.paidAt,       done: !!payout.paidAt,      isFinal: true  },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <PremiumPageHero
        title={payout.payoutNumber}
        breadcrumbs={[
          { label: 'البوابة',   href: '/portal' },
          { label: 'المدفوعات', href: '/portal/payouts' },
          { label: payout.payoutNumber },
        ]}
        meta={<BrokerPayoutStatusBadge status={payout.status} />}
      />

      {/* Cancellation banner */}
      {payout.status === 'CANCELLED' && payout.cancelReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تم إلغاء الدفعة</p>
            <p className="mt-1 leading-relaxed">{payout.cancelReason}</p>
          </div>
        </div>
      )}

      {/* Layout */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* ── Net amount ───────────────────────────────────────────── */}
            <PremiumSectionCard title="الصافي المستحق" icon={<Banknote className="h-4 w-4" />}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                {/* Big amount */}
                <div className="flex-1">
                  <p className={cn(
                    'text-5xl font-black tabular-nums leading-none tracking-tight',
                    isPaid ? 'text-emerald-700' : 'text-slate-900',
                  )}>
                    {formatCurrency(payout.totalNet, currency)}
                  </p>
                  {payout.period && (
                    <span className="mt-3 inline-flex items-center rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1">
                      الفترة: {payout.period}
                    </span>
                  )}
                </div>

                {/* Breakdown */}
                <div className="sm:w-64 rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline divide-y divide-hairline overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-2xs text-slate-400">الإجمالي</span>
                    <span className="text-2xs font-semibold text-slate-700 tabular-nums">{formatCurrency(payout.totalGross, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-2xs text-slate-400">ضريبة القيمة المضافة</span>
                    <span className="text-2xs text-red-500 tabular-nums">− {formatCurrency(payout.totalTax, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-2xs text-slate-400">الحجز الضريبي</span>
                    <span className="text-2xs text-red-500 tabular-nums">− {formatCurrency(payout.totalWithholding, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50">
                    <span className="text-xs font-bold text-slate-700">الصافي</span>
                    <span className={cn('text-sm font-black tabular-nums', isPaid ? 'text-emerald-700' : 'text-slate-900')}>
                      {formatCurrency(payout.totalNet, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── Payment method ───────────────────────────────────────── */}
            <PremiumSectionCard title="طريقة الصرف" icon={<Wallet className="h-4 w-4" />}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {payout.paymentMethod ? (METHOD_LABEL[payout.paymentMethod] ?? payout.paymentMethod) : '—'}
                    </p>
                    <p className="text-2xs text-slate-400 mt-0.5">طريقة الدفع</p>
                  </div>
                </div>

                {payout.paymentReference && (
                  <div className="rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-3">
                    <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">مرجع الدفع</p>
                    <CodeText className="text-sm font-bold text-slate-800">{payout.paymentReference}</CodeText>
                  </div>
                )}

                {payout.receiptUrl && (
                  <a
                    href={payout.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-brand-700 hover:text-brand-800 font-medium"
                    dir="ltr"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    إيصال الدفع
                  </a>
                )}

                {!payout.paymentMethod && !payout.paymentReference && (
                  <p className="text-sm text-slate-400 italic">لم تُحدد طريقة الدفع بعد</p>
                )}
              </div>
            </PremiumSectionCard>

            {/* ── Commissions table ────────────────────────────────────── */}
            <PremiumSectionCard
              title="العمولات المُدرجة"
              icon={<BadgePercent className="h-4 w-4" />}
              trailing={
                commissions.length > 0
                  ? <span className="text-xs text-slate-400 tabular-nums">{commissions.length}</span>
                  : undefined
              }
              padded={false}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas/40 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="text-start font-semibold py-3 ps-6 pe-4">العمولة</th>
                      <th className="text-start font-semibold py-3 px-4">العقد</th>
                      <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                      <th className="text-end font-semibold py-3 px-4">إجمالي</th>
                      <th className="text-end font-semibold py-3 px-4 pe-6">صافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-slate-400 py-10">
                          لا توجد عمولات في هذه الدفعة.
                        </td>
                      </tr>
                    )}
                    {commissions.map((c) => (
                      <tr key={c.id} className="border-t border-hairline align-top hover:bg-canvas/40 transition-colors">
                        <td className="py-3.5 ps-6 pe-4">
                          <Link
                            href={`/portal/commissions/${c.id}` as never}
                            className="text-brand-700 hover:text-brand-800"
                          >
                            <CodeText className="text-xs font-semibold">{c.commissionNumber}</CodeText>
                          </Link>
                          <p className="text-2xs text-slate-400 mt-0.5 tabular-nums">{formatDate(c.earnedAt)}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <CodeText className="text-xs text-slate-700">{c.contract.contractNumber ?? '—'}</CodeText>
                        </td>
                        <td className="py-3.5 px-4">
                          <CodeText className="text-xs text-slate-700">{c.unit.code}</CodeText>
                          <p className="text-2xs text-slate-400 mt-0.5">
                            {c.unit.building?.phase?.project ? tx(c.unit.building.phase.project.name) : '—'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-end tabular-nums text-slate-600 text-xs">
                          {formatCurrency(c.grossAmount, currency)}
                        </td>
                        <td className="py-3.5 px-4 pe-6 text-end font-bold text-slate-900 tabular-nums text-xs">
                          {formatCurrency(c.netAmount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumSectionCard>
          </div>
        }
        side={
          <div className="space-y-4">

            {/* ── Quick actions ────────────────────────────────────────── */}
            <PremiumCommandPanel title="إجراءات سريعة">
              {payout.receiptUrl && (
                <a href={payout.receiptUrl} target="_blank" rel="noopener noreferrer" className={CMD_LINK}>
                  <span className={CMD_ICON}><ExternalLink /></span>
                  إيصال الدفع
                </a>
              )}
              <Link href={'/portal/payouts' as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                قائمة المدفوعات
              </Link>
            </PremiumCommandPanel>

            {/* ── Payout info ──────────────────────────────────────────── */}
            <PremiumSectionCard title="معلومات الدفعة">
              <dl className="flex flex-col gap-3">
                <InfoRow label="الحالة" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  <BrokerPayoutStatusBadge status={payout.status} />
                </InfoRow>
                <InfoRow label="الإنشاء" icon={<Clock className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700 text-xs tabular-nums">{formatDate(payout.createdAt)}</span>
                </InfoRow>
                {payout.approvedAt && (
                  <InfoRow label="الاعتماد" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    <span className="text-slate-700 text-xs tabular-nums">{formatDate(payout.approvedAt)}</span>
                  </InfoRow>
                )}
                {payout.processedAt && (
                  <InfoRow label="بدء التنفيذ" icon={<CalendarRange className="h-3.5 w-3.5" />}>
                    <span className="text-slate-700 text-xs tabular-nums">{formatDate(payout.processedAt)}</span>
                  </InfoRow>
                )}
                {payout.paidAt && (
                  <InfoRow label="تاريخ الدفع" icon={<Banknote className="h-3.5 w-3.5" />}>
                    <span className="text-emerald-700 text-xs font-semibold tabular-nums">{formatDate(payout.paidAt)}</span>
                  </InfoRow>
                )}

                {/* Net box */}
                <div className="pt-2 mt-1 border-t border-hairline">
                  <div className={cn(
                    'rounded-xl border px-3 py-2.5 text-center',
                    isPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100',
                  )}>
                    <p className={cn('text-2xs font-semibold uppercase tracking-wide', isPaid ? 'text-emerald-500' : 'text-amber-500')}>
                      الصافي المستحق
                    </p>
                    <p className={cn('text-2xl font-black tabular-nums mt-1 leading-none', isPaid ? 'text-emerald-700' : 'text-amber-700')}>
                      {formatCurrency(payout.totalNet, currency)}
                    </p>
                    {payout.period && (
                      <p className={cn('text-2xs mt-1', isPaid ? 'text-emerald-500' : 'text-amber-500')}>
                        الفترة: {payout.period}
                      </p>
                    )}
                  </div>
                </div>
              </dl>
            </PremiumSectionCard>

            {/* ── Timeline ─────────────────────────────────────────────── */}
            <PremiumSectionCard title="مسار الدفعة">
              <ol className="relative border-s border-hairline ms-2 space-y-0">
                {timelineSteps.map((step, i) => {
                  const isLast = i === timelineSteps.length - 1;
                  return (
                    <li key={step.label} className={cn('ms-5', !isLast && 'pb-5')}>
                      <span className={cn(
                        'absolute -start-2 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white',
                        step.isFinal && step.done ? 'bg-emerald-100' :
                        step.done                 ? 'bg-brand-50'    : 'bg-slate-100',
                      )}>
                        {step.isFinal && step.done
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          : step.done
                            ? <CircleDot className="h-3 w-3 text-brand-500" />
                            : <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        }
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <p className={cn(
                          'text-xs font-semibold',
                          step.isFinal && step.done ? 'text-emerald-700' :
                          step.done                 ? 'text-slate-800'   : 'text-slate-400',
                        )}>
                          {step.label}
                        </p>
                        {step.at && (
                          <p className="text-2xs text-slate-400 whitespace-nowrap tabular-nums">
                            {formatDateTime(step.at)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </PremiumSectionCard>
          </div>
        }
      />
    </div>
  );
}
