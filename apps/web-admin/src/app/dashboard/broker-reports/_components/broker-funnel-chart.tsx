'use client';
import { cn } from '@/lib/cn';

import { intlLocale } from '@/lib/format';
import type { Locale } from '@/lib/locale';
export interface FunnelStage {
  label: string;
  value: number;
  pctOfFirst: number;
  convFromPrev: number | null;
  color: string;
  bg: string;
  text: string;
  dot: string;
}

const HEX_MAP: Record<string, string> = {
  'bg-brand-500':   '#d97706',
  'bg-sky-500':     '#0ea5e9',
  'bg-violet-500':  '#8b5cf6',
  'bg-amber-500':   '#f59e0b',
  'bg-emerald-500': '#10b981',
  'bg-teal-500':    '#14b8a6',
};

function ConvBadge({ rate }: { rate: number }) {
  // Above 100%: a later stage outran the one before it (e.g. direct bookings).
  const cls =
    rate > 1    ? 'text-amber-600 bg-amber-500/12' :
    rate >= 0.4 ? 'text-emerald-600 bg-emerald-500/12' :
                  'text-slate-500 bg-surface-muted';
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', cls)} dir="ltr">
      {(rate * 100).toFixed(0)}%
    </span>
  );
}

/** The funnel as one row of stage cards: count, share of the first stage, and the step's conversion. */
export function BrokerFunnelChart({
  stages,
  overallConv,
  overallLabel = 'فرصة → دفعة مُنجزة',
  noDataLabel = 'لا توجد بيانات',
  locale = 'ar',
}: {
  stages: FunnelStage[];
  overallConv: number | null;
  overallLabel?: string;
  noDataLabel?: string;
  locale?: Locale;
}) {
  if (!stages.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        {noDataLabel}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="broker-funnel">
        {stages.map((stage, i) => {
          const hex = HEX_MAP[stage.dot] ?? '#94a3b8';
          const pct = i === 0 ? 100 : stage.pctOfFirst;
          return (
            <div
              key={stage.label}
              className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-muted/30 px-4 py-3.5"
            >
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: hex }} />
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[12px] font-semibold text-slate-600">{stage.label}</p>
                {i > 0 && stage.convFromPrev !== null && <ConvBadge rate={stage.convFromPrev} />}
              </div>
              <p className="mt-2 text-[30px] font-bold leading-none tabular-nums" style={{ color: hex }}>
                {stage.value.toLocaleString(intlLocale(locale))}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted" dir="ltr">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: hex }} />
                </div>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {overallConv !== null && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
          <span className="text-[12px] text-slate-500">{overallLabel}</span>
          <span className="rounded-full bg-brand-500/12 px-3 py-1 text-[12px] font-bold tabular-nums text-brand-700">
            {(overallConv * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
