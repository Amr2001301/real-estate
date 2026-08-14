import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { formatDate, tx } from '@/lib/format';
import type { Reservation, SettingItem } from '@/lib/types';
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

export default async function ReservationPrintPage({ params }: { params: Params }) {
  const { id } = await params;

  const [resResult, currency, companyName] = await Promise.all([
    safe(api.get<Reservation>(`/reservations/${id}`)),
    getReportsCurrency(),
    getCompanyName(),
  ]);

  if (resResult.error || !resResult.data) notFound();

  const r = resResult.data;
  const sym = currencySymbol(currency);

  const clientName = r.client?.fullName ?? r.lead?.fullName ?? '—';
  const clientPhone = r.client?.phone ?? r.lead?.phone ?? '—';
  const clientEmail = r.client?.email ?? r.lead?.email ?? '—';

  const project = r.unit?.building?.phase?.project;
  const projectName = project ? tx(project.name) : '—';
  const unitCode = r.unit?.code ?? '—';

  const formatAmount = (v: string | number | null | undefined) =>
    v != null ? `${Number(v).toLocaleString('ar-SA')} ${sym}` : '—';

  const statusLabel: Record<string, string> = {
    PENDING: 'معلّق',
    APPROVED: 'موافق عليه',
    REJECTED: 'مرفوض',
    CANCELLED: 'ملغى',
    EXPIRED: 'منتهي الصلاحية',
    CONVERTED: 'محوّل إلى عقد',
  };

  return (
    <PrintDocument
      title={`وصل الحجز ${r.reservationNumber ? '#' + r.reservationNumber : ''}`}
      companyName={companyName}
      documentType="وصل حجز وحدة عقارية"
      referenceNumber={r.reservationNumber}
      date={formatDate(r.createdAt)}
    >
      {/* Customer info */}
      <PrintSection title="بيانات العميل" />
      <PrintRow label="الاسم" value={clientName} />
      <PrintRow label="الهاتف" value={clientPhone} />
      {clientEmail && clientEmail !== '—' && <PrintRow label="البريد الإلكتروني" value={clientEmail} />}

      {/* Unit info */}
      <PrintSection title="بيانات الوحدة" />
      <PrintRow label="المشروع" value={projectName} />
      <PrintRow label="كود الوحدة" value={unitCode} />
      {r.unit?.type && <PrintRow label="نوع الوحدة" value={r.unit.type} />}

      {/* Reservation details */}
      <PrintSection title="تفاصيل الحجز" />
      <PrintRow label="رقم الحجز" value={r.reservationNumber ?? '—'} />
      <PrintRow label="تاريخ الحجز" value={formatDate(r.createdAt)} />
      <PrintRow label="تاريخ الانتهاء" value={formatDate(r.expiresAt)} />
      <PrintRow label="الحالة" value={statusLabel[r.status] ?? r.status} />
      {r.contract?.contractNumber && (
        <PrintRow label="رقم العقد" value={r.contract.contractNumber} />
      )}

      {/* Financial */}
      <PrintSection title="المعلومات المالية" />
      <PrintRow label="مبلغ الحجز (العربون)" value={formatAmount(r.bookingAmount)} highlight />
      {r.snapshotDownPaymentAmount != null && (
        <PrintRow label="الدفعة الأولى" value={formatAmount(r.snapshotDownPaymentAmount)} />
      )}
      {r.snapshotFinancedAmount != null && (
        <PrintRow label="المبلغ المموّل" value={formatAmount(r.snapshotFinancedAmount)} />
      )}
      {r.snapshotTotalPayable != null && (
        <PrintRow label="إجمالي المبلغ" value={formatAmount(r.snapshotTotalPayable)} highlight />
      )}
      {r.selectedDurationMonths != null && (
        <PrintRow label="مدة السداد" value={`${r.selectedDurationMonths} شهر`} />
      )}
      {r.snapshotMonthlyInstallment != null && (
        <PrintRow label="القسط الشهري" value={formatAmount(r.snapshotMonthlyInstallment)} />
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

      {/* Disclaimer */}
      <p className="mt-8 text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
        هذا المستند وصل حجز رسمي صادر عن {companyName}. يُرجى الاحتفاظ بنسخة منه للرجوع إليها.
        لأي استفسار يرجى التواصل مع فريق المبيعات.
      </p>
    </PrintDocument>
  );
}
