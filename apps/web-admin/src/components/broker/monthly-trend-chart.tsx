'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import type { BrokerMonthlyTrendPoint } from '@/lib/types';
import { cn } from '@/lib/cn';

// ── Brand-aligned colors ──────────────────────────────────────────────────────
const C = {
  commissions: '#C8A24B',   // brand-500 gold
  payouts:     '#10b981',   // emerald-500
  reservations: '#818cf8',  // indigo-400
  contracts:   '#34d399',   // emerald-400
};

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtAxisMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}م`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}ك`;
  return String(v);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
type TooltipPayloadItem = { name: string; value: number; color: string };

function FinancialTooltip({
  active,
  payload,
  label,
  fmtCurrency,
}: {
  active?:      boolean;
  payload?:     TooltipPayloadItem[];
  label?:       string;
  fmtCurrency:  (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL}>{label}</p>
      {payload.map((item) => (
        <div key={item.name} style={TT_ROW}>
          <span style={{ ...TT_DOT, background: item.color }} />
          <span style={TT_NAME}>{item.name}</span>
          <span style={TT_VALUE}>{fmtCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL}>{label}</p>
      {payload.map((item) => (
        <div key={item.name} style={TT_ROW}>
          <span style={{ ...TT_DOT, background: item.color }} />
          <span style={TT_NAME}>{item.name}</span>
          <span style={TT_VALUE}>{item.value.toLocaleString('ar-EG')}</span>
        </div>
      ))}
    </div>
  );
}

const TT_STYLE: React.CSSProperties = {
  background: 'white',
  border: '1px solid #e7dfd3',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
  direction: 'rtl',
  minWidth: 180,
};
const TT_LABEL: React.CSSProperties = { fontWeight: 700, color: '#1e293b', marginBottom: 8, fontSize: 13 };
const TT_ROW:   React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 };
const TT_DOT:   React.CSSProperties = { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0 };
const TT_NAME:  React.CSSProperties = { color: '#64748b', flex: 1 };
const TT_VALUE: React.CSSProperties = { fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' };

// ── Shared axis / grid config ─────────────────────────────────────────────────
const TICK_STYLE = { fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' } as const;
const LEGEND_STYLE = { fontSize: 11, paddingTop: 10, direction: 'rtl' } as const;

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Mode = 'financial' | 'activity';

const TABS: { key: Mode; label: string }[] = [
  { key: 'financial', label: 'المالية' },
  { key: 'activity',  label: 'النشاط'  },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  data:      BrokerMonthlyTrendPoint[];
  currency?: string;
}

function mapPoint(p: BrokerMonthlyTrendPoint) {
  return {
    label:           p.label,
    reservations:    p.reservations,
    contractsSigned: p.contractsSigned,
    commissionsNet:  Number(p.commissionsNet) || 0,
    payoutsNet:      Number(p.payoutsNet) || 0,
  };
}

export function MonthlyTrendChart({ data, currency = 'SAR' }: Props) {
  function fmtCurrency(v: number): string {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);
  }
  const [mode, setMode] = useState<Mode>('financial');

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <p className="text-sm text-slate-500">لا توجد بيانات شهرية في هذا النطاق.</p>
        <p className="text-2xs text-slate-400">جرّب توسيع نطاق التاريخ.</p>
      </div>
    );
  }

  const points = data.map(mapPoint);

  return (
    <div className="flex flex-col gap-3">

      {/* Tab toggle */}
      <div className="flex items-center gap-1 self-start">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
              mode === key
                ? 'bg-brand-100 text-brand-800 shadow-xs'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Financial: area chart ──────────────────────────────────────── */}
      {mode === 'financial' && (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={points} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradComm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.commissions} stopOpacity={0.18} />
                <stop offset="100%" stopColor={C.commissions} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPay" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.payouts} stopOpacity={0.15} />
                <stop offset="100%" stopColor={C.payouts} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="label"
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAxisMoney}
              width={40}
            />

            <Tooltip
              content={<FinancialTooltip fmtCurrency={fmtCurrency} />}
              cursor={{ stroke: '#e7dfd3', strokeWidth: 1.5, strokeDasharray: '3 3' }}
            />

            <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />

            <Area
              type="monotone"
              dataKey="commissionsNet"
              name="صافي العمولات"
              stroke={C.commissions}
              strokeWidth={2.5}
              fill="url(#gradComm)"
              dot={{ r: 4, fill: C.commissions, strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 5.5, fill: C.commissions, strokeWidth: 2, stroke: 'white' }}
            />
            <Area
              type="monotone"
              dataKey="payoutsNet"
              name="صافي المدفوعات"
              stroke={C.payouts}
              strokeWidth={2.5}
              fill="url(#gradPay)"
              dot={{ r: 4, fill: C.payouts, strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 5.5, fill: C.payouts, strokeWidth: 2, stroke: 'white' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* ── Activity: grouped bars ─────────────────────────────────────── */}
      {mode === 'activity' && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={points}
            margin={{ top: 6, right: 8, left: 4, bottom: 0 }}
            barCategoryGap="32%"
            barGap={3}
          >
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="label"
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />

            <Tooltip
              content={<ActivityTooltip />}
              cursor={{ fill: '#f8fafc', radius: 4 } as React.SVGProps<SVGRectElement>}
            />

            <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />

            <Bar
              dataKey="reservations"
              name="حجوزات"
              fill={C.reservations}
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="contractsSigned"
              name="عقود موقّعة"
              fill={C.contracts}
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
