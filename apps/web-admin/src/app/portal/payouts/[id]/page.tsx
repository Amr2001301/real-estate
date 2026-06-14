import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Banknote,
  Wallet,
  CalendarRange,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalPayout } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrokerPayoutStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE: 'شيك',
  CASH: 'نقدي',
  OTHER: 'أخرى',
};

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

  return (
    <div className="space-y-5">
      <PageHeader
        title={payout.payoutNumber}
        description={payout.period ? `الفترة المرجعية: ${payout.period}` : undefined}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'المدفوعات', href: '/portal/payouts' },
          { label: payout.payoutNumber },
        ]}
        meta={<BrokerPayoutStatusBadge status={payout.status} />}
        actions={
          <Link href="/portal/payouts">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      {payout.status === 'CANCELLED' && payout.cancelReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تم إلغاء الدفعة</p>
            <p className="mt-1 leading-relaxed">{payout.cancelReason}</p>
          </div>
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-600" />
          الإجماليات
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">الإجمالي</p>
            <p className="font-semibold mt-1 text-slate-900 tabular-nums">{formatCurrency(payout.totalGross)}</p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">الضريبة</p>
            <p className="font-semibold mt-1 text-slate-900 tabular-nums">{formatCurrency(payout.totalTax)}</p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3">
            <p className="text-xs text-slate-500">حجز ضريبي</p>
            <p className="font-semibold mt-1 text-slate-900 tabular-nums">{formatCurrency(payout.totalWithholding)}</p>
          </div>
          <div className="rounded-xl border border-hairline px-3 py-3 bg-emerald-50/30">
            <p className="text-xs text-slate-500">الصافي</p>
            <p className="font-semibold mt-1 text-emerald-700 tabular-nums">{formatCurrency(payout.totalNet)}</p>
          </div>
        </div>
      </Card>

      {(payout.paymentMethod ||
        payout.paymentReference ||
        payout.paidAt ||
        payout.scheduledAt) && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-600" />
            تفاصيل الصرف
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
            <InfoRow icon={<Wallet />} label="طريقة الدفع" value={payout.paymentMethod ? METHOD_LABEL[payout.paymentMethod] : '—'} />
            <InfoRow icon={<Wallet />} label="مرجع الدفع" value={payout.paymentReference ?? '—'} dir="ltr" />
            <InfoRow icon={<Clock />} label="تاريخ الصرف المخطط" value={formatDate(payout.scheduledAt)} />
            <InfoRow icon={<CheckCircle2 />} label="تاريخ الدفع" value={formatDate(payout.paidAt)} />
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
                فتح إيصال الدفع
              </a>
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            العمولات المُدرجة
            <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{commissions.length}</span>
          </h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العمولة</th>
                <th className="text-start font-semibold py-3 px-4">العقد</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي</th>
                <th className="text-start font-semibold py-3 px-4">صافي</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-slate-500 py-8">
                    لا توجد عمولات في هذه الدفعة.
                  </td>
                </tr>
              )}
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-hairline align-top">
                  <td className="py-3 ps-5 pe-4">
                    <Link
                      href={`/portal/commissions/${c.id}` as never}
                      className="font-mono text-xs text-slate-900 hover:text-brand-700"
                      dir="ltr"
                    >
                      {c.commissionNumber}
                    </Link>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {formatDate(c.earnedAt)}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700" dir="ltr">
                    {c.contract.contractNumber ?? '—'}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">{c.unit.code}</p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.unit.building?.phase?.project ? tx(c.unit.building.phase.project.name) : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{formatCurrency(c.grossAmount)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">{formatCurrency(c.netAmount)}</td>
                  <td className="py-3 ps-4 pe-5"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-2xs text-slate-500">
        <InfoRow icon={<CalendarRange />} label="تاريخ الإنشاء" value={formatDate(payout.createdAt)} />
        <InfoRow icon={<CalendarRange />} label="تاريخ الاعتماد" value={formatDate(payout.approvedAt)} />
        <InfoRow icon={<CalendarRange />} label="تاريخ بدء التنفيذ" value={formatDate(payout.processedAt)} />
        <InfoRow icon={<CalendarRange />} label="آخر تحديث" value={formatDateTime(payout.updatedAt)} />
      </div>
    </div>
  );
}
