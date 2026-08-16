'use client';

import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { computeDurationOption } from '@/lib/installment-calc';
import type { DurationOptionCalculated, InstallmentPlanDurationOption } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface Props {
  options:           InstallmentPlanDurationOption[];
  netPrice:          number;
  reservationAmount: number;
  downPaymentAmount: number;
  totalPrice:        number;
  currency?:         string;
  locale?:           Locale;
}

export function DurationSelector({
  options,
  netPrice,
  reservationAmount,
  downPaymentAmount,
  totalPrice,
  currency = 'SAR',
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.installments.detail.durationSelector;

  function fmt(n: number): string {
    return formatCurrency(n.toFixed(2), currency);
  }
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
        <p>{m.noOptions}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Duration picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <label
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          htmlFor="duration-select"
        >
          {m.selectLabel}
        </label>
        <select
          id="duration-select"
          value={selected?.id ?? ''}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {sorted.map((o) => (
            <option key={o.id} value={o.id}>
              {m.optionLabel(o.durationMonths, Number(o.increasePercentage))}
            </option>
          ))}
        </select>
      </div>

      {/* Calculation card */}
      {selected && (
        <div className="rounded-2xl bg-canvas/50 border border-hairline p-5 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            {m.calcTitle}
          </p>

          {/* Breakdown rows */}
          <div className="space-y-2.5">
            <CalcRow label={m.rowUnitPrice} value={fmt(totalPrice)} />
            <CalcRow
              label={m.rowReservation}
              value={`− ${fmt(reservationAmount)}`}
              valueClass="text-amber-700"
            />
            <CalcRow
              label={m.rowDownPayment}
              value={`− ${fmt(downPaymentAmount)}`}
              valueClass="text-amber-700"
            />
            <div className="h-px bg-hairline" />
            <CalcRow
              label={m.rowRemaining}
              value={fmt(selected.calculated.remainingAmount)}
              valueClass="font-bold text-slate-900"
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-[12px] text-slate-500 shrink-0">
                {m.rowIncreasePct}
                <span className="text-[10px] text-slate-400 ms-1">{m.increaseByAdmin}</span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-slate-800">
                {Number(selected.increasePercentage)}%
              </span>
            </div>
            <CalcRow label={m.rowFinancedAmount} value={fmt(selected.calculated.financedAmount)} />
          </div>

          {/* Gold accent separator */}
          <div
            className="h-[2px] rounded-full"
            style={{
              background:
                'linear-gradient(to left, transparent, #e6c46a 30%, #b8923e 50%, #e6c46a 70%, transparent)',
            }}
          />

          {/* Key totals */}
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                {m.monthlyInstallment}
              </p>
              <p className="text-[20px] font-black tabular-nums leading-none text-brand-700">
                {fmt(selected.calculated.monthlyInstallment)}
              </p>
            </div>
            <div className="text-end">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                {m.totalPayable}
              </p>
              <p className="text-[16px] font-bold tabular-nums leading-none text-slate-900">
                {fmt(selected.calculated.totalPayable)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2.5">
          {m.allOptionsTitle}
        </p>
        <div className="overflow-x-auto rounded-2xl border border-hairline">
          <table className="w-full text-sm">
            <thead className="bg-canvas/50 border-b border-hairline">
              <tr>
                <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                  {m.colDuration}
                </th>
                <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                  {m.colIncrease}
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                  {m.colMonthly}
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                  {m.colFinanced}
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                  {m.colTotal}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {sorted.map((o) => {
                const isSelected = o.id === selected?.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer transition-colors duration-100 ${
                      isSelected ? 'bg-brand-50' : 'hover:bg-canvas/40'
                    }`}
                  >
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-900">
                      {m.durationLabel(o.durationMonths)}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-slate-600">
                      {Number(o.increasePercentage)}%
                    </td>
                    <td className="px-4 py-3 text-end text-[13px] font-bold tabular-nums text-brand-700">
                      {fmt(o.calculated.monthlyInstallment)}
                    </td>
                    <td className="px-4 py-3 text-end text-[12px] tabular-nums text-slate-600">
                      {fmt(o.calculated.financedAmount)}
                    </td>
                    <td className="px-4 py-3 text-end text-[12px] tabular-nums text-slate-600">
                      {fmt(o.calculated.totalPayable)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {m.footNote}
        </p>
      </div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12px] text-slate-500 shrink-0">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums text-slate-800 ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}
