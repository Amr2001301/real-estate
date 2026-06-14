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
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalPayout } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { CodeText } from '@/components/ui/code-text';
import { BrokerPayoutStatusBadge } from '@/components/badges';
import {
  DetailHero,
  DetailHeroCol,
  HeroColLabel,
  HeroDateRow,
  type DetailHeroStatus,
} from '@/components/portal/detail-hero';
import { DetailSection } from '@/components/portal/detail-section';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك',
  CASH: 'نقدي',
  OTHER: 'أخرى',
};

export default async function PortalPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalPayout>(`/portal/payouts/${id}`));
  if (r.error || !r.data) notFound();
  const payout = r.data;
  const commissions = payout.commissions ?? [];

  const heroStatus: DetailHeroStatus =
    payout.status === 'PAID' || payout.status === 'PROCESSING' ? 'success' :
    payout.status === 'CANCELLED' ? 'danger' :
    'warning';

  const isPaid = payout.status === 'PAID';

  const timelineSteps = [
    { label: 'إنشاء الدفعة', at: payout.createdAt, done: true, isFinal: false },
    { label: 'الاعتماد', at: payout.approvedAt ?? null, done: !!payout.approvedAt, isFinal: false },
    { label: 'بدء التنفيذ', at: payout.processedAt ?? null, done: !!payout.processedAt, isFinal: false },
    { label: 'تاريخ الدفع', at: payout.paidAt ?? null, done: !!payout.paidAt, isFinal: true },
  ].filter((s) => s.at !== null || s.label === 'إنشاء الدفعة');

  return (
    <div className="space-y-5">
      <PageHeader
        title={payout.payoutNumber}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'المدفوعات', href: '/portal/payouts' },
          { label: payout.payoutNumber },
        ]}
        meta={<BrokerPayoutStatusBadge status={payout.status} />}
      />

      {/* Cancellation reason */}
      {payout.status === 'CANCELLED' && payout.cancelReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تم إلغاء الدفعة</p>
            <p className="mt-1 leading-relaxed">{payout.cancelReason}</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <DetailHero status={heroStatus}>
        {/* Net amount + breakdown */}
        <DetailHeroCol position="first" highlight={isPaid ? 'success' : undefined}>
          <HeroColLabel>الصافي المستحق</HeroColLabel>
          <p className={cn(
            'text-4xl font-bold tabular-nums leading-none',
            isPaid ? 'text-emerald-700' : 'text-slate-900',
          )}>
            {formatCurrency(payout.totalNet)}
          </p>
          {payout.period && (
            <p className="text-xs text-slate-500 mt-2">
              الفترة:{' '}
              <span className="font-semibold text-slate-700">{payout.period}</span>
            </p>
          )}
          <div className="mt-4 space-y-1.5 pt-3 border-t border-hairline">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-400">الإجمالي</span>
              <span className="text-2xs font-semibold text-slate-700 tabular-nums">
                {formatCurrency(payout.totalGross)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-400">ضريبة القيمة المضافة</span>
              <span className="text-2xs text-slate-500 tabular-nums">
                − {formatCurrency(payout.totalTax)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-400">الحجز الضريبي</span>
              <span className="text-2xs text-slate-500 tabular-nums">
                − {formatCurrency(payout.totalWithholding)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-hairline">
              <span className="text-xs font-semibold text-slate-600">الصافي</span>
              <span className={cn('text-xs font-bold tabular-nums', isPaid ? 'text-emerald-700' : 'text-slate-900')}>
                {formatCurrency(payout.totalNet)}
              </span>
            </div>
          </div>
        </DetailHeroCol>

        {/* Payment method */}
        <DetailHeroCol position="middle">
          <HeroColLabel>طريقة الصرف</HeroColLabel>
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">
                {payout.paymentMethod
                  ? (METHOD_LABEL[payout.paymentMethod] ?? payout.paymentMethod)
                  : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">طريقة الدفع</p>
            </div>
          </div>
          {payout.paymentReference && (
            <div className="rounded-xl bg-slate-50 border border-hairline px-4 py-3 mb-3">
              <p className="text-2xs text-slate-400 mb-1">مرجع الدفع</p>
              <CodeText className="text-sm font-bold text-slate-800">
                {payout.paymentReference}
              </CodeText>
            </div>
          )}
          {payout.receiptUrl && (
            <a
              href={payout.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 font-medium"
              dir="ltr"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              إيصال الدفع
            </a>
          )}
          {!payout.paymentMethod && !payout.paymentReference && (
            <p className="text-sm text-slate-400">لم تُحدد طريقة الدفع بعد</p>
          )}
        </DetailHeroCol>

        {/* Dates */}
        <DetailHeroCol position="last">
          <HeroColLabel>التواريخ</HeroColLabel>
          <div className="space-y-2.5">
            <HeroDateRow
              label={<span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" />الإنشاء</span>}
              value={formatDate(payout.createdAt)}
            />
            {payout.approvedAt && (
              <HeroDateRow label="الاعتماد" value={formatDate(payout.approvedAt)} />
            )}
            {payout.scheduledAt && (
              <HeroDateRow label="الصرف المخطط" value={formatDate(payout.scheduledAt)} />
            )}
            {payout.processedAt && (
              <HeroDateRow label="بدء التنفيذ" value={formatDate(payout.processedAt)} />
            )}
            {payout.paidAt && (
              <HeroDateRow
                label={
                  <span className="flex items-center gap-1">
                    <Banknote className="h-3 w-3 text-emerald-500" />
                    تاريخ الدفع
                  </span>
                }
                value={formatDate(payout.paidAt)}
                tone="success"
              />
            )}
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* Commissions table */}
      <DetailSection
        title="العمولات المُدرجة"
        count={commissions.length}
        noBodyPad
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
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
                <tr key={c.id} className="border-t border-hairline align-top hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 ps-6 pe-4">
                    <Link
                      href={`/portal/commissions/${c.id}` as never}
                      className="text-slate-900 hover:text-brand-700"
                    >
                      <CodeText className="text-xs font-semibold">{c.commissionNumber}</CodeText>
                    </Link>
                    <p className="text-2xs text-slate-400 mt-0.5">{formatDate(c.earnedAt)}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <CodeText className="text-xs text-slate-700">
                      {c.contract.contractNumber ?? '—'}
                    </CodeText>
                  </td>
                  <td className="py-3.5 px-4">
                    <CodeText className="text-xs text-slate-700">{c.unit.code}</CodeText>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      {c.unit.building?.phase?.project
                        ? tx(c.unit.building.phase.project.name)
                        : '—'}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-end tabular-nums text-slate-600 text-xs">
                    {formatCurrency(c.grossAmount)}
                  </td>
                  <td className="py-3.5 px-4 pe-6 text-end font-semibold text-slate-900 tabular-nums text-xs">
                    {formatCurrency(c.netAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailSection>

      {/* Timeline — step-style */}
      <DetailSection title="مسار الدفعة">
        <ol className="relative border-s border-hairline ms-3 space-y-0">
          {timelineSteps.map((step, i) => {
            const isLast = i === timelineSteps.length - 1;
            return (
              <li key={step.label} className={cn('ms-5', !isLast && 'pb-5')}>
                <span
                  className={cn(
                    'absolute -start-2 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white',
                    step.isFinal && step.done
                      ? 'bg-emerald-100'
                      : step.done
                        ? 'bg-brand-50'
                        : 'bg-slate-100',
                  )}
                >
                  {step.isFinal && step.done ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  ) : step.done ? (
                    <CircleDot className="h-3 w-3 text-brand-500" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  )}
                </span>
                <div className="flex items-center justify-between gap-4">
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      step.isFinal && step.done
                        ? 'text-emerald-700'
                        : step.done
                          ? 'text-slate-800'
                          : 'text-slate-400',
                    )}
                  >
                    {step.label}
                  </p>
                  {step.at && (
                    <p className="text-2xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(step.at)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </DetailSection>
    </div>
  );
}
