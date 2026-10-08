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
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

// ── Brand-aligned colors ──────────────────────────────────────────────────────
const C = {
  commissions: '#C8A24B',   // brand-500 gold
  payouts:     '#10b981',   // emerald-500
  reservations: '#818cf8',  // indigo-400
  contracts:   '#34d399',   // emerald-400
};

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtAxisMoney(v: number, million: string, thousand: string): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}${million}`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}${thousand}`;
  return String(v);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
type TooltipPayloadItem = { name: string; value: number; color: string };

function FinancialTooltip({
  active,
  payload,
  label,
  fmtCurrency,
  dir,
}: {
  active?:      boolean;
  payload?:     TooltipPayloadItem[];
  label?:       string;
  fmtCurrency:  (v: number) => string;
  dir:          'rtl' | 'ltr';
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TT_STYLE, direction: dir }}>
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
  dir,
  numberLocale,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  dir: 'rtl' | 'ltr';
  numberLocale: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TT_STYLE, direction: dir }}>
      <p style={TT_LABEL}>{label}</p>
      {payload.map((item) => (
        <div key={item.name} style={TT_ROW}>
          <span style={{ ...TT_DOT, background: item.color }} />
          <span style={TT_NAME}>{item.name}</span>
          <span style={TT_VALUE}>{item.value.toLocaleString(numberLocale)}</span>
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
const LEGEND_STYLE = { fontSize: 11, paddingTop: 10 } as const;

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Mode = 'financial' | 'activity';

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  data:      BrokerMonthlyTrendPoint[];
  currency?: string;
  locale?:   Locale;
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

export function MonthlyTrendChart({ data, currency = 'SAR', locale = 'ar' }: Props) {
  const t = portalSharedT(locale).trend;
  const dir = locale === 'en' ? 'ltr' : 'rtl';
  const legendStyle = { ...LEGEND_STYLE, direction: dir } as const;
  const tabs: { key: Mode; label: string }[] = [
    { key: 'financial', label: t.tabFinancial },
    { key: 'activity',  label: t.tabActivity  },
  ];
  function fmtCurrency(v: number): string {
    return new Intl.NumberFormat(t.currencyLocale, {
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
        <p className="text-sm text-slate-500">{t.emptyTitle}</p>
        <p className="text-2xs text-slate-400">{t.emptyHint}</p>
      </div>
    );
  }

  const points = data.map(mapPoint);

  return (
    <div className="flex flex-col gap-3">

      {/* Tab toggle */}
      <div className="flex items-center gap-1 self-start">
        {tabs.map(({ key, label }) => (
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
              tickFormatter={(v: number) => fmtAxisMoney(v, t.axisMillion, t.axisThousand)}
              width={40}
            />

            <Tooltip
              content={<FinancialTooltip fmtCurrency={fmtCurrency} dir={dir} />}
              cursor={{ stroke: '#e7dfd3', strokeWidth: 1.5, strokeDasharray: '3 3' }}
            />

            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />

            <Area
              type="monotone"
              dataKey="commissionsNet"
              name={t.commissionsNet}
              stroke={C.commissions}
              strokeWidth={2.5}
              fill="url(#gradComm)"
              dot={{ r: 4, fill: C.commissions, strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 5.5, fill: C.commissions, strokeWidth: 2, stroke: 'white' }}
            />
            <Area
              type="monotone"
              dataKey="payoutsNet"
              name={t.payoutsNet}
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
              content={<ActivityTooltip dir={dir} numberLocale={t.numberLocale} />}
              cursor={{ fill: '#f8fafc', radius: 4 } as React.SVGProps<SVGRectElement>}
            />

            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />

            <Bar
              dataKey="reservations"
              name={t.reservations}
              fill={C.reservations}
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="contractsSigned"
              name={t.contractsSigned}
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
