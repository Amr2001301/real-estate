'use client';

import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { computeDurationOption } from '@/lib/installment-calc';
import type { DurationOptionCalculated, InstallmentPlanDurationOption } from '@/lib/types';

interface Props {
  options: InstallmentPlanDurationOption[];
  netPrice: number;
  reservationAmount: number;
  downPaymentAmount: number;
  totalPrice: number;
}

function fmt(n: number): string {
  return formatCurrency(n.toFixed(2));
}

export function DurationSelector({
  options,
  netPrice,
  reservationAmount,
  downPaymentAmount,
  totalPrice,
}: Props) {
  const sorted = useMemo(
    () =>
      [...options]
        .sort((a, b) => a.order - b.order || a.durationMonths - b.durationMonths)
        .map((o) => ({
          ...o,
          calculated:
            o.calculated ??
            (computeDurationOption({
              netPrice,
              reservationAmount,
              downPaymentAmount,
              durationMonths: o.durationMonths,
              increasePercentage: Number(o.increasePercentage ?? 0),
            }) as DurationOptionCalculated),
        })),
    [options, netPrice, reservationAmount, downPaymentAmount],
  );

  const [selectedId, setSelectedId] = useState<string>(() => sorted[0]?.id ?? '');
  const selected = sorted.find((o) => o.id === selectedId) ?? sorted[0] ?? null;

  if (sorted.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>لا توجد خيارات مدة محددة لهذه الخطة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-slate-700" htmlFor="duration-select">
          اختر المدة:
        </label>
        <select
          id="duration-select"
          value={selected?.id ?? ''}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {sorted.map((o) => (
            <option key={o.id} value={o.id}>
              {o.durationMonths} شهر — زيادة {Number(o.increasePercentage)}%
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">تفاصيل الحساب</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">سعر الوحدة</dt>
              <dd className="font-medium tabular-nums">{fmt(totalPrice)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">دفعة الحجز</dt>
              <dd className="font-medium tabular-nums text-amber-700">
                − {fmt(reservationAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">الدفعة الأولى</dt>
              <dd className="font-medium tabular-nums text-amber-700">
                − {fmt(downPaymentAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-hairline pt-2 mt-1">
              <dt className="text-slate-500">المتبقي</dt>
              <dd className="font-bold tabular-nums">{fmt(selected.calculated.remainingAmount)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">
                نسبة الزيادة
                <span className="text-xs text-slate-400 mr-1">(محددة من الإدارة)</span>
              </dt>
              <dd className="font-medium tabular-nums">{Number(selected.increasePercentage)}%</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">المبلغ المُمول</dt>
              <dd className="font-medium tabular-nums">{fmt(selected.calculated.financedAmount)}</dd>
            </div>
            <div className="flex items-center justify-between sm:col-span-2 border-t border-hairline pt-2 mt-1">
              <dt className="text-slate-700 font-medium">القسط الشهري</dt>
              <dd className="font-bold tabular-nums text-brand-700 text-base">
                {fmt(selected.calculated.monthlyInstallment)}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <dt className="text-slate-700 font-medium">إجمالي السداد</dt>
              <dd className="font-bold tabular-nums">{fmt(selected.calculated.totalPayable)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-2">جميع الخيارات المتاحة</h4>
        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-hairline">
              <tr>
                <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">المدة</th>
                <th className="px-3 py-2.5 text-start text-xs font-medium text-slate-500">الزيادة</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">القسط الشهري</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">المبلغ المُمول</th>
                <th className="px-3 py-2.5 text-end text-xs font-medium text-slate-500">إجمالي السداد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {sorted.map((o) => {
                const isSelected = o.id === selected?.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">{o.durationMonths} شهر</td>
                    <td className="px-3 py-2 tabular-nums">{Number(o.increasePercentage)}%</td>
                    <td className="px-3 py-2 text-end tabular-nums font-medium">
                      {fmt(o.calculated.monthlyInstallment)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-slate-700">
                      {fmt(o.calculated.financedAmount)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-slate-700">
                      {fmt(o.calculated.totalPayable)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          نسبة الزيادة للعرض فقط ويتم تحديدها بواسطة الإدارة. لا يمكن للمبيعات تعديلها.
        </p>
      </div>
    </div>
  );
}
