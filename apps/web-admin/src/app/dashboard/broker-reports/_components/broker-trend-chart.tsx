'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

export interface BrokerTrendBucket {
  label: string;
  commissionsNet: number;
  payoutsNet: number;
  contractsSigned: number;
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}م`;
  if (v >= 1_000)     return `${Math.round(v / 1_000)}ك`;
  return String(Math.round(v));
}

function CustomTooltip({ active, payload, label, fmt, tooltipContracts, tooltipCommissions, tooltipPayouts }: {
  active?:  boolean;
  payload?: { name: string; value: number; color: string }[];
  label?:   string;
  fmt:      (v: number) => string;
  tooltipContracts?: string;
  tooltipCommissions?: string;
  tooltipPayouts?: string;
}) {
  if (!active || !payload?.length) return null;
  const contracts = (payload[0] as { payload?: { contractsSigned: number } })?.payload?.contractsSigned ?? 0;
  return (
    <div dir="rtl" className="bg-white rounded-2xl border border-slate-100 shadow-xl px-4 py-3 text-xs min-w-[170px]">
      <p className="font-bold text-slate-800 mb-2 text-[13px]">{label}</p>
      {contracts > 0 && (
        <div className="flex items-center justify-between gap-4 pb-2 mb-2 border-b border-slate-100">
          <span className="text-slate-400">{tooltipContracts ?? 'عقود موقّعة'}</span>
          <span className="font-black text-slate-900 tabular-nums">{contracts}</span>
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
            <span className="text-slate-500">
              {entry.name === 'commissionsNet' ? (tooltipCommissions ?? 'العمولات') : (tooltipPayouts ?? 'المدفوع')}
            </span>
          </div>
          <span className="font-bold tabular-nums text-slate-900" dir="ltr">
            {fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BrokerTrendChart({
  data,
  height = '100%',
  currency = 'SAR',
  locale = 'ar',
  tooltipContracts,
  tooltipCommissions,
  tooltipPayouts,
  noDataLabel,
}: {
  data:               BrokerTrendBucket[];
  height?:            number | `${number}%`;
  currency?:          string;
  locale?:            string;
  tooltipContracts?:  string;
  tooltipCommissions?: string;
  tooltipPayouts?:    string;
  noDataLabel?:       string;
}) {
  function fmt(v: number): string {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(v);
  }
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-end gap-3 px-2 pb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex gap-1 items-end">
            <div className="flex-1 bg-amber-100 rounded-t-md animate-pulse" style={{ height: `${45 + (i * 19) % 55}%` }} />
            <div className="flex-1 bg-emerald-100 rounded-t-md animate-pulse" style={{ height: `${20 + (i * 13) % 35}%` }} />
          </div>
        ))}
      </div>
    );
  }

  const isEmpty = data.every((d) => d.commissionsNet === 0 && d.payoutsNet === 0);
  if (isEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-slate-400">{noDataLabel ?? 'لا توجد عمولات في هذه الفترة'}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        barGap={4}
        barCategoryGap="28%"
        margin={{ top: 20, right: 4, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<CustomTooltip fmt={fmt} tooltipContracts={tooltipContracts} tooltipCommissions={tooltipCommissions} tooltipPayouts={tooltipPayouts} />} cursor={{ fill: '#f8fafc', radius: 6 }} />

        {/* Commissions Net — amber */}
        <Bar dataKey="commissionsNet" name="commissionsNet" radius={[6, 6, 0, 0]} maxBarSize={26} minPointSize={3}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.commissionsNet > 0 ? '#f59e0b' : '#fef3c7'} />
          ))}
          <LabelList
            dataKey="contractsSigned"
            position="top"
            formatter={(v: unknown) => typeof v === 'number' && v > 0 ? String(v) : ''}
            style={{ fontSize: 9, fill: '#78350f', fontWeight: 700, fontFamily: 'inherit' }}
          />
        </Bar>

        {/* Payouts Net — emerald */}
        <Bar dataKey="payoutsNet" name="payoutsNet" radius={[6, 6, 0, 0]} maxBarSize={26} minPointSize={3}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.payoutsNet > 0 ? '#10b981' : '#d1fae5'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
