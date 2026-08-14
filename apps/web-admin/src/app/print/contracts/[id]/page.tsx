import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { formatDate, tx } from '@/lib/format';
import type { Contract, SettingItem } from '@/lib/types';
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

export default async function ContractPrintPage({ params }: { params: Params }) {
  const { id } = await params;

  const [contractResult, currency, companyName] = await Promise.all([
    safe(api.get<Contract>(`/contracts/${id}`)),
    getReportsCurrency(),
    getCompanyName(),
  ]);

  if (contractResult.error || !contractResult.data) notFound();

  const c = contractResult.data;
  const sym = currencySymbol(currency);

  const customerName = c.customer?.fullName ?? '—';
  const customerPhone = c.customer?.phone ?? '—';
  const customerEmail = c.customer?.email ?? '—';

  const project = c.unit?.building?.phase?.project;
  const projectName = project ? tx(project.name) : '—';
  const unitCode = c.unit?.code ?? '—';

  const formatAmount = (v: string | number | null | undefined) =>
    v != null ? `${Number(v).toLocaleString('ar-SA')} ${sym}` : '—';

  const plan = c.installmentPlan;

  const freqLabel: Record<string, string> = {
    MONTHLY: 'شهري',
    QUARTERLY: 'ربع سنوي',
    SEMI_ANNUAL: 'نصف سنوي',
    ANNUAL: 'سنوي',
  };

  const installmentStatusLabel: Record<string, string> = {
    PENDING: 'قادم',
    PAID: 'مدفوع',
    OVERDUE: 'متأخر',
    WAIVED: 'مُعفى',
    PARTIAL: 'جزئي',
  };

  const installments = plan?.installments ?? [];

  return (
    <PrintDocument
      title={`عقد بيع ${c.contractNumber ? '#' + c.contractNumber : ''}`}
      companyName={companyName}
      documentType="عقد بيع وحدة عقارية"
      referenceNumber={c.contractNumber ?? undefined}
      date={formatDate(c.createdAt)}
    >
      {/* Customer */}
      <PrintSection title="بيانات المشتري" />
      <PrintRow label="الاسم" value={customerName} />
      <PrintRow label="الهاتف" value={customerPhone} />
      {customerEmail && customerEmail !== '—' && (
        <PrintRow label="البريد الإلكتروني" value={customerEmail} />
      )}

      {/* Unit */}
      <PrintSection title="بيانات الوحدة" />
      <PrintRow label="المشروع" value={projectName} />
      <PrintRow label="كود الوحدة" value={unitCode} />
      {c.unit?.type && <PrintRow label="نوع الوحدة" value={c.unit.type} />}
      {c.unit?.area != null && <PrintRow label="المساحة" value={`${c.unit.area} م²`} />}
      {c.unit?.floor != null && <PrintRow label="الطابق" value={String(c.unit.floor)} />}

      {/* Contract details */}
      <PrintSection title="تفاصيل العقد" />
      <PrintRow label="رقم العقد" value={c.contractNumber ?? '—'} />
      <PrintRow label="تاريخ الإبرام" value={formatDate(c.createdAt)} />
      {c.signedAt && <PrintRow label="تاريخ التوقيع" value={formatDate(c.signedAt)} />}
      {c.reservation?.reservationNumber && (
        <PrintRow label="رقم الحجز المحوّل" value={c.reservation.reservationNumber} />
      )}
      {c.broker && (
        <PrintRow
          label="الوسيط العقاري"
          value={c.broker.commercialName ?? c.broker.companyName}
        />
      )}

      {/* Financial */}
      <PrintSection title="المعلومات المالية" />
      <PrintRow label="إجمالي قيمة العقد" value={formatAmount(c.totalAmount)} highlight />
      <PrintRow label="الدفعة الأولى" value={formatAmount(c.downPayment)} />

      {plan && (
        <>
          <PrintRow label="دورية الأقساط" value={freqLabel[plan.frequency] ?? plan.frequency} />
          <PrintRow label="مدة الخطة" value={`${plan.totalMonths} شهر`} />
          <PrintRow label="القسط الدوري" value={formatAmount(plan.monthlyAmount)} />
          <PrintRow label="تاريخ أول قسط" value={formatDate(plan.startsAt)} />
        </>
      )}

      {/* Installment schedule — if available */}
      {installments.length > 0 && (
        <>
          <PrintSection title="جدول الأقساط" />
          <table className="w-full text-sm border-collapse mt-1">
            <thead>
              <tr className="border-b-2 border-[#C8A24B]">
                <th className="py-2 text-start font-semibold text-xs tracking-wide" style={{ color: '#64748B' }}>#</th>
                <th className="py-2 text-start font-semibold text-xs tracking-wide" style={{ color: '#64748B' }}>تاريخ الاستحقاق</th>
                <th className="py-2 text-end font-semibold text-xs tracking-wide" style={{ color: '#64748B' }}>المبلغ</th>
                <th className="py-2 text-end font-semibold text-xs tracking-wide" style={{ color: '#64748B' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst, i) => (
                <tr key={inst.id} className="border-b border-slate-100">
                  <td className="py-2 text-xs" style={{ color: '#94A3B8' }}>{i + 1}</td>
                  <td className="py-2 text-xs" style={{ color: '#0F1E33' }}>{formatDate(inst.dueDate)}</td>
                  <td className="py-2 text-end text-xs font-medium" style={{ color: '#0F1E33' }}>{formatAmount(inst.amount)}</td>
                  <td className="py-2 text-end text-xs">
                    <span
                      style={{
                        color: inst.status === 'PAID' ? '#059669'
                          : inst.status === 'OVERDUE' ? '#DC2626'
                          : '#64748B',
                      }}
                    >
                      {installmentStatusLabel[inst.status] ?? inst.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Signature block */}
      <div className="mt-14 grid grid-cols-2 gap-12">
        <div>
          <div className="mb-2 text-sm font-semibold" style={{ color: '#0F1E33' }}>توقيع المشتري</div>
          <div className="h-16 border-b border-slate-300" />
          <div className="mt-1.5 text-xs" style={{ color: '#94A3B8' }}>{customerName}</div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold" style={{ color: '#0F1E33' }}>توقيع ممثل الشركة</div>
          <div className="h-16 border-b border-slate-300" />
          <div className="mt-1.5 text-xs" style={{ color: '#94A3B8' }}>{companyName}</div>
        </div>
      </div>

      <p className="mt-8 text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
        هذا المستند نسخة من عقد البيع الصادر عن {companyName}. للاستفسار يرجى التواصل مع فريق المبيعات.
      </p>
    </PrintDocument>
  );
}
