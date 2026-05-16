'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  collected: number;
  overdue: number;
  remaining: number;
  contractValue: number;
}

const SEGMENTS = [
  { key: 'collected', label: 'المحصّل', color: '#10b981' },
  { key: 'overdue',   label: 'المتأخر', color: '#ef4444' },
  { key: 'remaining', label: 'المتبقي', color: '#e2e8f0' },
] as const;

function DooltipContent({ active, payload }: {
  active?: boolean;
  payload?: { payload: { label: string; value: number; color: string } }[];
}) {
  if (!active || !payload?.length || !payload[0]) return null;
  const { label, value, color } = payload[0].payload;
  return (
    <div dir="rtl" className="bg-white rounded-xl border border-slate-200 shadow-md px-3 py-2 text-xs">
      <span style={{ color }} className="font-semibold">{label}</span>
      <span className="ms-2 text-slate-700 tabular-nums">
        {new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value)}
      </span>
    </div>
  );
}

export function PaymentDonutChart({ collected, overdue, remaining, contractValue }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const total = contractValue > 0 ? contractValue : collected + overdue + remaining;
  const collectedPct = total > 0 ? Math.round((collected / total) * 100) : 0;

  const rawData = [
    { ...SEGMENTS[0], value: collected },
    { ...SEGMENTS[1], value: overdue },
    { ...SEGMENTS[2], value: remaining },
  ].filter((d) => d.value > 0);

  const data = rawData.length > 0 ? rawData : [{ key: 'empty' as const, label: 'لا يوجد', color: '#e2e8f0', value: 1 }];

  if (!mounted) {
    return (
      <div className="h-36 flex items-center justify-center">
        <div className="h-28 w-28 rounded-full border-[12px] border-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={64}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<DooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{collectedPct}٪</span>
        <span className="text-[10px] text-slate-400 mt-0.5">محصّل</span>
      </div>
    </div>
  );
}
