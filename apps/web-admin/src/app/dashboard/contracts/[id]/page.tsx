import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Contract } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { ContractPdfPanel } from './pdf-panel';
import { createInstallmentPlanAction } from '../actions';

interface ContractDetail extends Contract {
  installmentPlan?: {
    id: string;
    totalMonths: number;
    monthlyAmount: string | number;
    startsAt: string;
    installments?: Array<{
      id: string;
      dueDate: string;
      amount: string | number;
      status: string;
      paidAt: string | null;
    }>;
  } | null;
  deposits?: Array<{
    id: string;
    amount: string | number;
    paidAt: string;
    receiptUrl: string | null;
    verified: boolean;
  }>;
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<ContractDetail>(`/contracts/${id}`));

  if (r.error) return <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>;
  const contract = r.data!;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/contracts" className="text-sm text-brand-600 hover:underline">
          ← العقود
        </Link>
        <h1 className="text-2xl font-bold mt-1">عقد #{contract.id.slice(0, 8)}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {contract.customer?.fullName ?? '—'} · الوحدة {contract.unit?.code ?? '—'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold mb-4">التفاصيل</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Row k="العميل">{contract.customer?.fullName ?? '—'}</Row>
              <Row k="هاتف العميل" dir="ltr">
                {contract.customer?.phone ?? '—'}
              </Row>
              <Row k="الوحدة">{contract.unit?.code ?? '—'}</Row>
              <Row k="المشروع">{tx(contract.unit?.building?.phase?.project?.name)}</Row>
              <Row k="الإجمالي">{formatCurrency(contract.totalAmount)}</Row>
              <Row k="المقدم">{formatCurrency(contract.downPayment)}</Row>
              <Row k="تاريخ التوقيع">{formatDateTime(contract.signedAt)}</Row>
              <Row k="تاريخ الإنشاء">{formatDateTime(contract.createdAt)}</Row>
            </dl>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold mb-4">الدفعات المسجلة</h2>
            {contract.deposits && contract.deposits.length > 0 ? (
              <ul className="divide-y divide-gray-100 text-sm">
                {contract.deposits.map((d) => (
                  <li key={d.id} className="py-3 flex justify-between items-center">
                    <span>
                      {formatCurrency(d.amount)} ·{' '}
                      <span className="text-gray-500">{formatDate(d.paidAt)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {d.receiptUrl && (
                        <a
                          href={d.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline text-xs"
                        >
                          إيصال
                        </a>
                      )}
                      {d.verified ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          متحقق
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          غير متحقق
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">لا توجد دفعات بعد</p>
            )}
            <Link
              href={`/dashboard/deposits/new?contractId=${contract.id}`}
              className="inline-block mt-4 rounded-lg bg-gray-800 text-white px-3 py-1.5 text-sm"
            >
              + تسجيل دفعة
            </Link>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold mb-4">خطة التقسيط</h2>
            {contract.installmentPlan ? (
              <div className="text-sm">
                <p className="mb-3">
                  {contract.installmentPlan.totalMonths} شهرًا ×{' '}
                  {formatCurrency(contract.installmentPlan.monthlyAmount)} · بدءًا من{' '}
                  {formatDate(contract.installmentPlan.startsAt)}
                </p>
                <ul className="text-xs divide-y divide-gray-100 max-h-64 overflow-auto">
                  {contract.installmentPlan.installments?.map((inst, i) => (
                    <li key={inst.id} className="py-2 flex justify-between">
                      <span>
                        {i + 1}. {formatDate(inst.dueDate)}
                      </span>
                      <span className="flex items-center gap-2">
                        {formatCurrency(inst.amount)}
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            inst.status === 'PAID'
                              ? 'bg-green-100 text-green-700'
                              : inst.status === 'OVERDUE'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {inst.status === 'PAID'
                            ? 'مدفوع'
                            : inst.status === 'OVERDUE'
                              ? 'متأخر'
                              : 'قيد الانتظار'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <form
                action={createInstallmentPlanAction.bind(null, contract.id)}
                className="space-y-3"
              >
                <p className="text-sm text-gray-600">
                  أنشئ خطة تقسيط — تظهر للمبيعات والإدارة فقط (وليس للعميل).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    name="totalMonths"
                    type="number"
                    min={1}
                    max={360}
                    placeholder="عدد الأشهر"
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="monthlyAmount"
                    type="number"
                    step="any"
                    min={0}
                    placeholder="القسط الشهري"
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="startsAt"
                    type="date"
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">
                  إنشاء الخطة
                </button>
              </form>
            )}
          </section>
        </div>

        <aside>
          <ContractPdfPanel contract={contract} />
        </aside>
      </div>
    </div>
  );
}

function Row({ k, children, dir }: { k: string; children: React.ReactNode; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{k}</dt>
      <dd className="font-medium" dir={dir}>
        {children}
      </dd>
    </div>
  );
}
