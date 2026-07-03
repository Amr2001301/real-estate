'use client';

import { cn } from '@/lib/cn';

export interface LeadSourceSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices:       LeadSourceSlice[];
  centerLabel?: string;
  centerSub?:   string;
  className?:   string;
}

const SIZE         = 168;
const STROKE       = 20;
const RADIUS       = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP          = 2; // gap between segments in px arc

export function LeadSourceDonut({ slices, centerLabel, centerSub, className }: Props) {
  const total   = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const isEmpty = slices.every((s) => s.value === 0);

  let offset = 0;
  const segments = slices.map((s) => {
    const fraction   = s.value / total;
    const length     = Math.max(0, fraction * CIRCUMFERENCE - GAP);
    const dasharray  = `${length} ${CIRCUMFERENCE - length}`;
    const dashoffset = -offset;
    offset          += fraction * CIRCUMFERENCE;
    return { ...s, dasharray, dashoffset, fraction };
  });

  const topSlice     = [...slices].sort((a, b) => b.value - a.value)[0];
  const displayLabel = centerLabel ?? (topSlice ? `${Math.round((topSlice.value / total) * 100)}%` : '—');
  const displaySub   = centerSub   ?? topSlice?.label ?? '';

  return (
    <div className={cn('flex flex-col gap-5', className)}>

      {/* Donut + center */}
      <div className="flex items-center justify-center">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="-rotate-90"
            aria-hidden
          >
            {/* Track ring */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="rgb(241 237 230 / 0.8)"
              strokeWidth={STROKE}
            />
            {isEmpty ? (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="rgb(231 223 211 / 0.4)"
                strokeWidth={STROKE}
              />
            ) : (
              segments.map((seg) => (
                <circle
                  key={seg.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE}
                  strokeDasharray={seg.dasharray}
                  strokeDashoffset={seg.dashoffset}
                  strokeLinecap="butt"
                  className="transition-opacity hover:opacity-75"
                />
              ))
            )}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
            <span className="text-[30px] font-black tabular-nums leading-none tracking-tight text-navy">
              {displayLabel}
            </span>
            {displaySub && (
              <span className="mt-1 text-[11px] font-medium text-slate-400 max-w-[80px] leading-tight">
                {displaySub}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legend — full-width rows with mini progress bars */}
      {!isEmpty && (
        <ul className="flex flex-col gap-2.5">
          {slices.map((s, i) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <li key={s.label} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  {/* Rank number */}
                  <span
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                    style={{ backgroundColor: s.color }}
                  >
                    {i + 1}
                  </span>
                  {/* Label */}
                  <span className="text-[12px] font-semibold text-slate-700 flex-1 truncate leading-none">
                    {s.label}
                  </span>
                  {/* Count badge */}
                  <span
                    className="inline-flex items-center justify-center h-5 min-w-[28px] rounded-full px-1.5 text-[10px] font-black tabular-nums"
                    style={{ backgroundColor: `${s.color}20`, color: s.color }}
                  >
                    {s.value}
                  </span>
                  {/* Percentage */}
                  <span className="text-[11px] font-bold tabular-nums text-slate-500 w-8 text-end shrink-0">
                    {pct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden ms-7">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isEmpty && (
        <p className="text-center text-xs text-slate-400 py-4">لا توجد بيانات بعد</p>
      )}
    </div>
  );
}
