'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { CashflowTrendPoint } from '@/lib/types';

const COLLECTED_COLOR = '#10b981';
const DUE_COLOR = '#f59e0b';

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}م`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}ك`;
  return String(Math.round(v));
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir="rtl"
      className="bg-white rounded-xl border border-slate-200 shadow-md px-3.5 py-3 text-xs min-w-[140px]"
    >
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-slate-500">{entry.name === 'collected' ? 'المحصّل' : 'المستحق'}</span>
          </div>
          <span className="font-semibold tabular-nums text-slate-800">
            {new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CashflowBarChart({ data }: { data: CashflowTrendPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-52 flex items-end gap-2 px-4 pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex gap-0.5 items-end">
            <div
              className="flex-1 bg-slate-100 rounded-t-sm animate-pulse"
              style={{ height: `${50 + (i * 17) % 70}%` }}
            />
            <div
              className="flex-1 bg-slate-50 rounded-t-sm animate-pulse"
              style={{ height: `${30 + (i * 23) % 50}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  const isEmpty = data.every((d) => d.collected === 0 && d.due === 0);
  if (isEmpty) {
    return (
      <div className="h-52 flex flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-slate-400">لا توجد بيانات للفترة المحددة</p>
        <p className="text-[11px] text-slate-300">تظهر البيانات حسب المدفوعات والمستحقات المسجلة</p>
      </div>
    );
  }

  const activeMths = data.filter((d) => d.collected > 0 || d.due > 0).length;

  return (
    <div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} barGap={3} barSize={18} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
          <Bar dataKey="collected" name="collected" fill={COLLECTED_COLOR} radius={[4, 4, 0, 0]} minPointSize={3} />
          <Bar dataKey="due"       name="due"       fill={DUE_COLOR}       radius={[4, 4, 0, 0]} minPointSize={3} />
        </BarChart>
      </ResponsiveContainer>
      {activeMths <= 2 && (
        <p className="mt-1 text-center text-[11px] text-slate-300">
          تظهر البيانات حسب المدفوعات والمستحقات المسجلة خلال الأشهر الستة الماضية
        </p>
      )}
    </div>
  );
}
