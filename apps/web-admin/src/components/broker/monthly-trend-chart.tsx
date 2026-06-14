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

// Compact Arabic money formatter
function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}م`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}ك`;
  return String(v);
}

// Recharts custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        direction: 'rtl',
      }}
    >
      <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{label}</p>
      {payload.map((item) => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: item.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#64748b' }}>{item.name}:</span>
          <span style={{ fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {Number.isFinite(item.value)
              ? item.value.toLocaleString('ar-EG')
              : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

function numericPoint(p: BrokerMonthlyTrendPoint) {
  return {
    label:          p.label,
    reservations:   p.reservations,
    contractsSigned: p.contractsSigned,
    commissionsNet: Number(p.commissionsNet)  || 0,
    payoutsNet:     Number(p.payoutsNet)      || 0,
  };
}

export function MonthlyTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <p className="text-sm text-slate-500">لا توجد بيانات شهرية في هذا النطاق.</p>
        <p className="text-2xs text-slate-400">جرّب توسيع نطاق التاريخ.</p>
      </div>
    );
  }

  const points = data.map(numericPoint);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={points}
        margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        barCategoryGap="35%"
      >
        <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
        />

        {/* Left axis: counts */}
        <YAxis
          yAxisId="counts"
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />

        {/* Right axis: money */}
        <YAxis
          yAxisId="money"
          orientation="right"
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtMoney}
          width={36}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />

        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 12, direction: 'rtl' }}
          iconType="circle"
          iconSize={8}
        />

        <Bar
          yAxisId="counts"
          dataKey="reservations"
          name="حجوزات"
          fill="#818cf8"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          yAxisId="counts"
          dataKey="contractsSigned"
          name="عقود موقّعة"
          fill="#34d399"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          yAxisId="money"
          dataKey="commissionsNet"
          name="صافي العمولات"
          fill="#f59e0b"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          yAxisId="money"
          dataKey="payoutsNet"
          name="صافي المدفوعات"
          fill="#06b6d4"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
