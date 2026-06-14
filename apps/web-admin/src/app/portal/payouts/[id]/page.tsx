import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Banknote,
  Wallet,
  CalendarRange,
  AlertTriangle,
  ExternalLink,
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

      {/* ── Cancellation reason ────────────────────────────────────────── */}
      {payout.status === 'CANCELLED' && payout.cancelReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تم إلغاء الدفعة</p>
            <p className="mt-1 leading-relaxed">{payout.cancelReason}</p>
          </div>
        </div>
      )}

      {/* ── Hero summary card ──────────────────────────────────────────── */}
      <DetailHero status={heroStatus}>
        {/* Net amount */}
        <DetailHeroCol position="first">
          <HeroColLabel>الصافي المستحق</HeroColLabel>
          <p className="text-4xl font-bold text-emerald-700 tabular-nums leading-none">
            {formatCurrency(payout.totalNet)}
          </p>
          {payout.period && (
            <p className="text-xs text-slate-500 mt-2">
              الفترة المرجعية:{' '}
              <span className="font-semibold text-slate-700">{payout.period}</span>
            </p>
          )}
          <div className="mt-4 space-y-1.5 pt-3 border-t border-hairline">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-400">الإجمالي</span>
              <span className="text-2xs font-medium text-slate-600 tabular-nums">
                {formatCurrency(payout.totalGross)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-400">الضريبة</span>
              <span className="text-2xs text-slate-500 tabular-nums">
                {formatCurrency(payout.totalTax)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-400">الحجز الضريبي</span>
              <span className="text-2xs text-slate-500 tabular-nums">
                {formatCurrency(payout.totalWithholding)}
              </span>
            </div>
          </div>
        </DetailHeroCol>

        {/* Payment details */}
        <DetailHeroCol position="middle">
          <HeroColLabel>تفاصيل الصرف</HeroColLabel>
          <div className="space-y-4">
            <div>
              <p className="text-2xs text-slate-400 mb-1">طريقة الدفع</p>
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
                {payout.paymentMethod
                  ? (METHOD_LABEL[payout.paymentMethod] ?? payout.paymentMethod)
                  : '—'}
              </p>
            </div>
            {payout.paymentReference && (
              <div>
                <p className="text-2xs text-slate-400 mb-1">مرجع الدفع</p>
                <CodeText className="text-sm font-semibold text-slate-800">
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
          </div>
        </DetailHeroCol>

        {/* Dates */}
        <DetailHeroCol position="last">
          <HeroColLabel>التواريخ</HeroColLabel>
          <div className="space-y-3">
            <HeroDateRow label="الإنشاء" value={formatDate(payout.createdAt)} />
            {payout.approvedAt && (
              <HeroDateRow label="الاعتماد" value={formatDate(payout.approvedAt)} />
            )}
            {payout.scheduledAt && (
              <HeroDateRow label="الصرف المخطط" value={formatDate(payout.scheduledAt)} />
            )}
            {payout.paidAt && (
              <HeroDateRow
                label={
                  <span className="flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    تاريخ الدفع
                  </span>
                }
                value={formatDate(payout.paidAt)}
                tone="success"
              />
            )}
            {payout.processedAt && (
              <HeroDateRow label="بدء التنفيذ" value={formatDate(payout.processedAt)} />
            )}
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* ── Commissions table ──────────────────────────────────────────── */}
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
                <th className="text-start font-semibold py-3 px-4">إجمالي</th>
                <th className="text-start font-semibold py-3 px-4 pe-6">صافي</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-slate-500 py-10">
                    لا توجد عمولات في هذه الدفعة.
                  </td>
                </tr>
              )}
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-hairline align-top hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 ps-6 pe-4">
                    <Link
                      href={`/portal/commissions/${c.id}` as never}
                      className="text-slate-900 hover:text-brand-700"
                    >
                      <CodeText className="text-xs font-semibold">{c.commissionNumber}</CodeText>
                    </Link>
                    <p className="text-2xs text-slate-500 mt-0.5">{formatDate(c.earnedAt)}</p>
                  </td>
                  <td className="py-3 px-4">
                    <CodeText className="text-xs text-slate-700">
                      {c.contract.contractNumber ?? '—'}
                    </CodeText>
                  </td>
                  <td className="py-3 px-4">
                    <CodeText className="text-xs text-slate-700">{c.unit.code}</CodeText>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.unit.building?.phase?.project
                        ? tx(c.unit.building.phase.project.name)
                        : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">
                    {formatCurrency(c.grossAmount)}
                  </td>
                  <td className="py-3 px-4 pe-6 font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(c.netAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailSection>

      {/* ── Timeline ──────────────────────────────────────────────────── */}
      <DetailSection icon={<CalendarRange />} title="الجدول الزمني">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
          {[
            { label: 'تاريخ الإنشاء', value: formatDate(payout.createdAt) },
            { label: 'تاريخ الاعتماد', value: formatDate(payout.approvedAt) },
            { label: 'تاريخ بدء التنفيذ', value: formatDate(payout.processedAt) },
            { label: 'آخر تحديث', value: formatDateTime(payout.updatedAt) },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
                {row.label}
              </p>
              <p className="text-sm font-medium text-slate-800 mt-1">{row.value ?? '—'}</p>
            </div>
          ))}
        </div>
      </DetailSection>
    </div>
  );
}
