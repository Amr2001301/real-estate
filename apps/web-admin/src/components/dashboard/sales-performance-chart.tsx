'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  month: string;
  value: number;
}

interface Props {
  data: DataPoint[];
}

export function SalesPerformanceChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-slate-400">
        لا توجد بيانات كافية
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={196}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#C8A24B" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#C8A24B" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="navyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#26405F" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#26405F" stopOpacity={0.01} />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke="#E7DFD3"
          strokeDasharray="4 4"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          dy={4}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #E7DFD3',
            borderRadius: 8,
            fontSize: 12,
            boxShadow: '0 4px 16px -4px rgb(15 30 51 / 0.12)',
          }}
          cursor={{ stroke: '#C8A24B', strokeWidth: 1, strokeDasharray: '4 2' }}
          formatter={(v) => [v, 'الحجوزات']}
          labelStyle={{ fontWeight: 600, color: '#0F1E33', marginBottom: 2 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#C8A24B"
          strokeWidth={2.5}
          fill="url(#goldFill)"
          dot={false}
          activeDot={{ r: 4, fill: '#C8A24B', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
