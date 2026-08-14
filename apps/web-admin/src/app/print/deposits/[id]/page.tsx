import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import type { Deposit, SettingItem } from '@/lib/types';
import {
  PrintDocument,
  PrintRow,
  PrintSection,
} from '@/components/print/PrintDocument';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

async function getCompanyName(): Promise<string> {
  const res = await safe(api.get<SettingItem[]>('/settings?group=company'));
  const items = res.data ?? [];
  const name = items.find((i) => i.key === 'company.name')?.value;
  return typeof name === 'string' && name ? name : 'شركتنا';
}

export default async function DepositPrintPage({ params }: { params: Params }) {
  const { id } = await params;

  const [depositResult, currency, companyName] = await Promise.all([
    safe(api.get<Deposit>(`/deposits/${id}`)),
    getReportsCurrency(),
    getCompanyName(),
  ]);

  if (depositResult.error || !depositResult.data) notFound();

  const d = depositResult.data;
  const sym = currencySymbol(currency);

  const formatAmount = (v: string | number | null | undefined) =>
    v != null ? `${Number(v).toLocaleString('ar-SA')} ${sym}` : '—';

  const typeLabel: Record<string, string> = {
    BOOKING_AMOUNT:   'عربون حجز',
    DOWN_PAYMENT:     'دفعة أولى',
    INSTALLMENT:      'قسط',
    FINAL_PAYMENT:    'دفعة أخيرة',
    OTHER:            'دفعة أخرى',
  };

  const methodLabel: Record<string, string> = {
    CASH:          'نقدي',
    BANK_TRANSFER: 'تحويل بنكي',
    CHEQUE:        'شيك',
    OTHER:         'أخرى',
  };

  const reviewStatusLabel: Record<string, string> = {
    NO_PROOF:       'بدون إيصال',
    PENDING_REVIEW: 'قيد المراجعة',
    APPROVED:       'مقبول',
    REJECTED:       'مرفوض',
  };

  // Determine client name from linked reservation or contract
  const clientName =
    d.reservation?.client?.fullName ??
    d.reservation?.lead?.fullName ??
    d.contract?.customer?.fullName ??
    '—';

  const unitCode =
    d.reservation?.unit?.code ?? d.contract?.unit?.code ?? '—';

  const referenceNumber = d.contract?.contractNumber ?? d.reservation?.reservationNumber ?? d.id.slice(-8).toUpperCase();

  return (
    <PrintDocument
      title={`وصل دفع — ${typeLabel[d.type] ?? d.type}`}
      companyName={companyName}
      documentType="وصل استلام دفعة"
      referenceNumber={referenceNumber}
      date={formatDate(d.paidAt)}
    >
      {/* Payment details */}
      <PrintSection title="تفاصيل الدفعة" />
      <PrintRow label="نوع الدفعة" value={typeLabel[d.type] ?? d.type} />
      <PrintRow label="المبلغ" value={formatAmount(d.amount)} highlight />
      <PrintRow label="تاريخ الدفع" value={formatDate(d.paidAt)} />
      {d.paymentMethod && (
        <PrintRow label="طريقة الدفع" value={methodLabel[d.paymentMethod] ?? d.paymentMethod} />
      )}
      {d.reviewStatus && (
        <PrintRow label="حالة الإيصال" value={reviewStatusLabel[d.reviewStatus] ?? d.reviewStatus} />
      )}
      {d.reviewedAt && d.reviewedBy && (
        <PrintRow label="مراجعة بواسطة" value={`${d.reviewedBy.fullName} — ${formatDate(d.reviewedAt)}`} />
      )}

      {/* Client / unit */}
      <PrintSection title="بيانات العميل والوحدة" />
      <PrintRow label="العميل" value={clientName} />
      <PrintRow label="كود الوحدة" value={unitCode} />
      {d.contract?.contractNumber && (
        <PrintRow label="رقم العقد" value={d.contract.contractNumber} />
      )}
      {d.reservation?.reservationNumber && (
        <PrintRow label="رقم الحجز" value={d.reservation.reservationNumber} />
      )}
      {d.installment && (
        <>
          <PrintSection title="تفاصيل القسط" />
          <PrintRow label="تاريخ الاستحقاق" value={formatDate(d.installment.dueDate)} />
          <PrintRow label="مبلغ القسط" value={formatAmount(d.installment.amount)} />
        </>
      )}

      {/* Signature block */}
      <div className="mt-14 grid grid-cols-2 gap-12">
        <div>
          <div className="mb-2 text-sm font-semibold" style={{ color: '#0F1E33' }}>توقيع العميل</div>
          <div className="h-16 border-b border-slate-300" />
          <div className="mt-1.5 text-xs" style={{ color: '#94A3B8' }}>{clientName}</div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold" style={{ color: '#0F1E33' }}>توقيع ممثل الشركة</div>
          <div className="h-16 border-b border-slate-300" />
          <div className="mt-1.5 text-xs" style={{ color: '#94A3B8' }}>{companyName}</div>
        </div>
      </div>

      <p className="mt-8 text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
        هذا وصل استلام رسمي يُثبت سداد الدفعة المذكورة أعلاه. يُرجى الاحتفاظ بهذا الوصل للرجوع إليه.
        لأي استفسار تواصل مع فريق المالية في {companyName}.
      </p>
    </PrintDocument>
  );
}
