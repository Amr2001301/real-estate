import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import { DataTable } from '@/components/table';
import type { Paged, User } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';

interface BonusRule {
  id: string;
  name: string;
  percentage: string | number;
  active: boolean;
}
interface BonusEntry {
  id: string;
  amount: string | number;
  period: string;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paidAt: string | null;
  sales?: { id: string; fullName: string };
  rule?: { name: string };
}

async function createRuleAction(formData: FormData) {
  'use server';
  await api.post('/bonus-rules', {
    name: String(formData.get('name') ?? ''),
    percentage: Number(formData.get('percentage') ?? 0),
  });
  revalidatePath('/dashboard/bonus');
}

async function setEntryStatusAction(id: string, formData: FormData) {
  'use server';
  await api.patch(`/bonus-entries/${id}`, { status: String(formData.get('status') ?? 'PENDING') });
  revalidatePath('/dashboard/bonus');
}

export default async function BonusPage() {
  const [rulesRes, entriesRes, salesRes] = await Promise.all([
    safe(api.get<BonusRule[]>('/bonus-rules')),
    safe(api.get<BonusEntry[] | Paged<BonusEntry>>('/bonus-entries')),
    safe(api.get<Paged<User>>('/users?role=SALES&pageSize=100')),
  ]);

  const entries = Array.isArray(entriesRes.data)
    ? entriesRes.data
    : (entriesRes.data?.data ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">العمولات</h1>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">قواعد العمولة</h2>
        <ul className="text-sm space-y-1 mb-4">
          {(rulesRes.data ?? []).map((r) => (
            <li key={r.id} className="flex justify-between border-b border-gray-100 py-1">
              <span>{r.name}</span>
              <span className="text-gray-500">{r.percentage}%</span>
            </li>
          ))}
          {(rulesRes.data ?? []).length === 0 && (
            <li className="text-xs text-gray-400">لا توجد قواعد</li>
          )}
        </ul>
        <form action={createRuleAction} className="flex flex-wrap gap-2">
          <input
            name="name"
            required
            placeholder="اسم القاعدة"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm flex-1 min-w-[140px]"
          />
          <input
            name="percentage"
            type="number"
            step="any"
            min={0}
            required
            placeholder="النسبة %"
            className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">
            + إضافة
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-bold mb-3">سجلات العمولات</h2>
        {entriesRes.error && (
          <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{entriesRes.error}</div>
        )}
        <DataTable
          rowKey={(e) => e.id}
          rows={entries}
          emptyMessage="لا توجد سجلات"
          columns={[
            { key: 'sales', header: 'المندوب', cell: (e) => e.sales?.fullName ?? '—' },
            { key: 'rule', header: 'القاعدة', cell: (e) => e.rule?.name ?? '—' },
            { key: 'period', header: 'الفترة', cell: (e) => e.period },
            { key: 'amount', header: 'المبلغ', cell: (e) => formatCurrency(e.amount) },
            { key: 'paidAt', header: 'تاريخ الدفع', cell: (e) => formatDate(e.paidAt) },
            {
              key: 'status',
              header: 'الحالة',
              cell: (e) => (
                <form action={setEntryStatusAction.bind(null, e.id)} className="flex gap-1">
                  <select
                    name="status"
                    defaultValue={e.status}
                    className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
                  >
                    <option value="PENDING">قيد الانتظار</option>
                    <option value="APPROVED">موافق</option>
                    <option value="PAID">مدفوع</option>
                  </select>
                  <button className="text-xs rounded bg-gray-800 text-white px-2">حفظ</button>
                </form>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
