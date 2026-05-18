'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BrokerMonthlyTrendPoint } from '@/lib/types';

interface Props {
  data: BrokerMonthlyTrendPoint[];
}

function numericPoint(p: BrokerMonthlyTrendPoint) {
  return {
    label: p.label,
    reservations: p.reservations,
    contractsSigned: p.contractsSigned,
    commissionsNet: Number(p.commissionsNet) || 0,
    payoutsNet: Number(p.payoutsNet) || 0,
  };
}

export function MonthlyTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        لا توجد بيانات شهرية في هذا النطاق.
      </p>
    );
  }
  const points = data.map(numericPoint);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="counts" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="money"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}م` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}ك` : String(v)
          }
        />
        <Tooltip
          contentStyle={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const numeric = Number(value);
            const key = String(name);
            if (key === 'commissionsNet' || key === 'payoutsNet') {
              return [Number.isFinite(numeric) ? numeric.toLocaleString() : '—', key];
            }
            return [value as number | string, key];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="counts" dataKey="reservations" name="حجوزات" fill="#6366f1" radius={[6, 6, 0, 0]} />
        <Bar yAxisId="counts" dataKey="contractsSigned" name="عقود موقّعة" fill="#10b981" radius={[6, 6, 0, 0]} />
        <Bar yAxisId="money" dataKey="commissionsNet" name="صافي العمولات" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
        <Bar yAxisId="money" dataKey="payoutsNet" name="صافي المدفوعات" fill="#a78bfa" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
